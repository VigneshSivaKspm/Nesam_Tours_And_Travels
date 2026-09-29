import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

process.env.GCLOUD_PROJECT = 'demo-nesam-server';
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${process.env.FIRESTORE_EMULATOR_PORT || 8089}`;
const { db } = await import('../../functions/lib/admin.js');
const { createBooking, requestPartnerPayout } = await import('../../functions/lib/commerce.js');
const { onTripCompleted } = await import('../../functions/lib/trips.js');
const { calculateFare } = await import('../../functions/lib/domain/pricing.js');
const { DEFAULT_RIDE_CATEGORIES } = await import('../../functions/lib/domain/defaults.js');
let env;
const realFetch = globalThis.fetch;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-nesam-server', firestore: { host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8089) } });
  await env.clearFirestore();
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: 10000, duration: 1200 }] }) });
});
after(async () => { globalThis.fetch = realFetch; await db.terminate(); await env?.cleanup(); });
const call = (handler, uid, data) => handler.run({ auth: uid ? { uid, token: {} } : undefined, data });
const request = (requestId, extra = {}) => ({
  requestId, pickup: { name: 'Pickup', address: 'Theni', lat: 10.01, lng: 77.47 },
  drop: { name: 'Drop', address: 'Destination', lat: 10.10, lng: 77.50 },
  categoryId: 'sedan', tripType: 'One Way', paymentMethod: 'Cash',
  expectedFare: calculateFare({ category: DEFAULT_RIDE_CATEGORIES[1], route: { distanceKm: 10, durationMin: 20 }, tripType: 'One Way', pickupTime: new Date() }).total,
  ...extra,
});
test('server: auth and suspended customer are rejected', async () => {
  await assert.rejects(call(createBooking, null, request('auth_request_01')), /Sign in/);
  await db.doc('customers/blocked').set({ status: 'Suspended' });
  await assert.rejects(call(createBooking, 'blocked', request('blocked_request_01')), /not active/);
});
test('server: forged fare is rejected; canonical booking and replay are atomic', async () => {
  await db.doc('customers/customer').set({ status: 'Approved', name: 'Test', phone: '+910000000000' });
  await assert.rejects(call(createBooking, 'customer', request('fare_request_01', { expectedFare: 0 })), /current fare/);
  assert.equal((await db.doc('bookings/fare_request_01').get()).exists, false);
  const data = request('valid_request_01');
  const a = await call(createBooking, 'customer', data);
  const b = await call(createBooking, 'customer', data);
  assert.equal(a.id, b.id);
  const booking = (await db.doc(`bookings/${a.id}`).get()).data();
  assert.equal(booking.fareVerified, true);
  assert.equal(booking.fare, data.expectedFare);
  assert.equal((await db.doc(`marketplace_trips/${a.id}`).get()).data().offeredPayout, Math.round(booking.fare * 0.85));
  assert.match((await db.doc(`booking_secrets/${a.id}`).get()).data().otp, /^\d{4}$/);
});
test('server: concurrent payout requests reserve funds once; replay is idempotent', async () => {
  await db.doc('drivers/driver').set({ status: 'Approved' });
  await db.doc('driver_private/driver').set({ bank: { upiId: 'test@bank' } });
  await db.doc('bookings/settled').set({ assignedDriverId: 'driver', status: 'Completed', payment: 'Paid', paymentMethod: 'UPI', fareVerified: true, fare: 1200, driverPayout: 1000 });
  const payload = requestId => ({ requestId, role: 'driver', amount: 800, method: 'UPI' });
  const results = await Promise.allSettled([call(requestPartnerPayout, 'driver', payload('payout_request_01')), call(requestPartnerPayout, 'driver', payload('payout_request_02'))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const winner = results.find(r => r.status === 'fulfilled').value;
  assert.equal((await call(requestPartnerPayout, 'driver', payload(winner.id))).id, winner.id);
  assert.equal((await db.collection('payout_requests').where('driverId', '==', 'driver').get()).size, 1);
});
test('server: cash and fleet trips do not double-pay a driver', async () => {
  await db.doc('drivers/fleet').set({ status: 'Approved', vendorId: 'vendor' });
  await db.doc('driver_private/fleet').set({ bank: { upiId: 'test@bank' } });
  await db.doc('bookings/fleet_trip').set({ assignedDriverId: 'fleet', assignedVendorId: 'vendor', status: 'Completed', payment: 'Paid', paymentMethod: 'UPI', fareVerified: true, driverPayout: 5000 });
  await db.doc('bookings/cash_trip').set({ assignedDriverId: 'fleet', status: 'Completed', payment: 'Paid', paymentMethod: 'Cash', fareVerified: true, driverPayout: 5000 });
  await assert.rejects(call(requestPartnerPayout, 'fleet', { requestId: 'fleet_payout_01', role: 'driver', amount: 100, method: 'UPI' }), /Available settled balance is ₹0/);
});
test('server: duplicate trip-completion delivery produces one ledger entry', async () => {
  const event = { params: { bookingId: 'settled' }, data: { after: { data: () => ({ status: 'Completed' }) } } };
  await Promise.all([onTripCompleted.run(event), onTripCompleted.run(event)]);
  assert.equal((await db.collection('wallet_ledger').where('bookingId', '==', 'settled').get()).size, 1);
  assert.equal((await db.doc('drivers/driver').get()).data().walletBalance, undefined);
});
