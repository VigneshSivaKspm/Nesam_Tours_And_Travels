import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

process.env.GCLOUD_PROJECT = 'demo-nesam-server';
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${process.env.FIRESTORE_EMULATOR_PORT || 8089}`;
const { db } = await import('../../functions/lib/admin.js');
const { createBooking } = await import('../../functions/lib/commerce.js');
const { createAdminBooking, overrideBookingFare } = await import('../../functions/lib/adminBookings.js');
const { calculateFare, mapCategory } = await import('../../functions/lib/domain/pricing.js');
const { partnerPayoutFor } = await import('../../functions/lib/domain/finance.js');
// Platform commission used by these tests (finance.test.mjs covers the policy itself).
const POLICY = { base: 'taxable', global: { rate: 15 }, services: { svc_air: { rate: 10 } }, categories: {}, version: 1 };
/** The partner offer for a booking, from its own commission snapshot. */
const offerFor = (b) => partnerPayoutFor(b.fareBreakdown, b.commission);
// Admin-configured category (the only source of customer fares).
const SEDAN = { name: 'Sedan', code: 'SEDAN', status: 'Active', seatingCapacity: 4, fare: { baseFare: 70, baseKm: 2, perKmRate: 16, waitingChargePerHour: 105, minimumFare: 100, nightAllowance: 50, driverAllowance: 400 } };
const ROUTE = { distanceKm: 10, durationMin: 20 };
const quote = (pickupTime = new Date()) => calculateFare({ category: mapCategory('sedan', SEDAN), route: ROUTE, tripType: 'One Way', pickupTime }).total;
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
  expectedFare: quote(),
  ...extra,
});
test('server: auth and suspended customer are rejected', async () => {
  await assert.rejects(call(createBooking, null, request('auth_request_01')), /Sign in/);
  await db.doc('customers/blocked').set({ status: 'Suspended' });
  await assert.rejects(call(createBooking, 'blocked', request('blocked_request_01')), /not active/);
});
test('server: without configured category fares nothing is priced (no built-in rates)', async () => {
  await db.doc('customers/customer').set({ status: 'Approved', name: 'Test', phone: '+910000000000' });
  await assert.rejects(call(createBooking, 'customer', request('nocat_request_01', { expectedFare: 123 })), /no active vehicle category has fares configured/);
  // An active category without a per-km rate is not bookable either.
  await db.doc('vehicle_categories/sedan').set({ ...SEDAN, fare: { baseFare: 300 } });
  await assert.rejects(call(createBooking, 'customer', request('nocat_request_02', { expectedFare: 300 })), /no active vehicle category has fares configured/);
  await db.doc('vehicle_categories/suv').set({ name: 'SUV', status: 'Active', fare: { perKmRate: 20 } });
  await assert.rejects(call(createBooking, 'customer', request('nocat_request_03')), /no longer available/);
  assert.equal((await db.collection('bookings').where('customerId', '==', 'customer').get()).size, 0);
  await db.doc('vehicle_categories/sedan').set(SEDAN);
});
test('server: without a commission policy no booking is created (no invented partner share)', async () => {
  await assert.rejects(call(createBooking, 'customer', request('nopolicy_request_01')), /commission policy is not configured/);
  assert.equal((await db.doc('bookings/nopolicy_request_01').get()).exists, false);
  assert.equal((await db.doc('marketplace_trips/nopolicy_request_01').get()).exists, false);
  await db.doc('business_config/commission').set(POLICY);
});

test('server: forged fare is rejected; canonical booking and replay are atomic', async () => {
  await assert.rejects(call(createBooking, 'customer', request('fare_request_01', { expectedFare: 0 })), /current fare/);
  assert.equal((await db.doc('bookings/fare_request_01').get()).exists, false);
  const data = request('valid_request_01');
  const a = await call(createBooking, 'customer', data);
  const b = await call(createBooking, 'customer', data);
  assert.equal(a.id, b.id);
  const booking = (await db.doc(`bookings/${a.id}`).get()).data();
  assert.equal(booking.fareVerified, true);
  assert.equal(booking.fare, data.expectedFare);
  // The booking stores the commission it was published under; the offer follows from it.
  assert.deepEqual(booking.commission, { rate: 15, base: 'taxable', source: 'global', policyVersion: 1 });
  const offer = (await db.doc(`marketplace_trips/${a.id}`).get()).data().offeredPayout;
  assert.equal(offer, Math.round((booking.fareBreakdown.taxableAmount * 85) / 100));
  assert.equal(offer, offerFor(booking));
  assert.match((await db.doc(`booking_secrets/${a.id}`).get()).data().otp, /^\d{4}$/);
});
// ── Admin (phone) bookings and fare overrides ───────────────────────────────

const adminAuth = (uid) => ({ uid, token: { email: `${uid}@nesam.test` } });
const adminCall = (handler, uid, data) => handler.run({ auth: adminAuth(uid), data });
const adminRequest = (requestId, extra = {}) => ({
  requestId, customerName: 'Walk-in Caller', customerPhone: '98765 43210', pickupLocationId: 'loc_theni', dropLocationId: 'loc_bodi',
  categoryId: 'sedan', tripType: 'One Way', paymentMethod: 'Cash', expectedFare: quote(), ...extra,
});

test('admin bookings: only active admins; locations need coordinates', async () => {
  await db.doc('admins/ops').set({ role: 'admin', status: 'active', name: 'Ops Desk' });
  await db.doc('admins/gone').set({ role: 'admin', status: 'inactive' });
  await db.doc('locations/loc_theni').set({ name: 'Theni Bus Stand', type: 'Bus Stand', city: 'Theni', status: 'Active', pickupEnabled: true, dropEnabled: true, lat: 10.01, lng: 77.47 });
  await db.doc('locations/loc_bodi').set({ name: 'Bodinayakanur', type: 'City', city: 'Bodi', status: 'Active', pickupEnabled: true, dropEnabled: true, lat: 10.01, lng: 77.35 });
  await db.doc('locations/loc_nomap').set({ name: 'Cumbum', type: 'City', city: 'Cumbum', status: 'Active', pickupEnabled: true, dropEnabled: true, lat: null, lng: null });
  await assert.rejects(call(createAdminBooking, null, adminRequest('adm_request_00')), /Sign in/);
  await assert.rejects(adminCall(createAdminBooking, 'customer', adminRequest('adm_request_01')), /Only active admins/);
  await assert.rejects(adminCall(createAdminBooking, 'gone', adminRequest('adm_request_02')), /Only active admins/);
  await assert.rejects(adminCall(createAdminBooking, 'ops', adminRequest('adm_request_03', { dropLocationId: 'loc_nomap' })), /no map coordinates/);
  await assert.rejects(adminCall(createAdminBooking, 'ops', adminRequest('adm_request_04', { customerPhone: '12345' })), /10-digit/);
  await assert.rejects(adminCall(createAdminBooking, 'ops', adminRequest('adm_request_05', { categoryId: 'suv_missing' })), /not bookable/);
});

test('admin bookings: the quote step writes nothing; services must be enabled for admin bookings', async () => {
  const q = await adminCall(createAdminBooking, 'ops', { ...adminRequest('adm_request_06'), expectedFare: undefined, quoteOnly: true });
  assert.equal(q.quote.total, quote());
  assert.equal(q.commissionConfigured, true);
  assert.equal(q.categoryName, 'Sedan');
  assert.equal((await db.doc('bookings/adm_request_06').get()).exists, false);
  assert.equal((await db.doc('marketplace_trips/adm_request_06').get()).exists, false);
  await db.doc('services/svc_off').set({ name: 'Temple Tour', status: 'Active', adminBookingEnabled: false });
  await db.doc('services/svc_air').set({ name: 'Airport Transfer', status: 'Active' });
  await assert.rejects(adminCall(createAdminBooking, 'ops', adminRequest('adm_request_07', { serviceId: 'svc_off' })), /not enabled for admin bookings/);
  const { id } = await adminCall(createAdminBooking, 'ops', adminRequest('adm_request_08', { serviceId: 'svc_air' }));
  const b = (await db.doc(`bookings/${id}`).get()).data();
  assert.deepEqual([b.service, b.serviceId], ['Airport Transfer', 'svc_air']);
  // The service rule is more specific than the global rate.
  assert.deepEqual(b.commission, { rate: 10, base: 'taxable', source: 'service:svc_air', policyVersion: 1 });
  assert.equal((await db.doc(`marketplace_trips/${id}`).get()).data().offeredPayout, Math.round((b.fareBreakdown.taxableAmount * 90) / 100));
});

test('admin bookings: priced by the server engine; stale quotes rejected; replay is idempotent', async () => {
  const stale = await adminCall(createAdminBooking, 'ops', adminRequest('adm_request_10', { expectedFare: 1 })).catch((e) => e);
  assert.match(stale.message, /calculated fare is ₹\d+/);
  assert.equal(stale.details.fare.total, quote());
  const data = adminRequest('adm_request_11');
  const res = await adminCall(createAdminBooking, 'ops', data);
  assert.equal((await adminCall(createAdminBooking, 'ops', data)).id, res.id);
  const b = (await db.doc(`bookings/${res.id}`).get()).data();
  assert.equal(b.fare, quote());
  assert.equal(b.fareBreakdown.total, b.fare);
  assert.equal(b.fareVerified, true);
  assert.equal(b.fareOverride, null);
  assert.equal(b.source, 'admin');
  assert.equal(b.createdBy, 'ops');
  assert.equal(b.phone, '+919876543210');
  assert.equal(b.pickupLocationId, 'loc_theni');
  assert.equal(b.service, 'Local');
  assert.match((await db.doc(`booking_secrets/${res.id}`).get()).data().otp, /^\d{4}$/);
  assert.equal(b.commission.source, 'global');
  assert.equal((await db.doc(`marketplace_trips/${res.id}`).get()).data().offeredPayout, offerFor(b));
  const events = await db.collection(`bookings/${res.id}/events`).get();
  assert.deepEqual(events.docs.map((d) => d.data().type), ['created']);
});

test('admin bookings: a fare override needs a reason and is stored with the calculated fare', async () => {
  await assert.rejects(adminCall(createAdminBooking, 'ops', adminRequest('adm_request_20', { override: { fare: 999, reason: 'deal' } })), /reason of at least 10/);
  await assert.rejects(adminCall(createAdminBooking, 'ops', adminRequest('adm_request_21', { override: { fare: quote(), reason: 'Same amount as calculated' } })), /same as the calculated/);
  await assert.rejects(adminCall(createAdminBooking, 'ops', adminRequest('adm_request_22', { override: { fare: 99.5, reason: 'Corporate contract rate' } })), /whole rupee/);
  const res = await adminCall(createAdminBooking, 'ops', adminRequest('adm_request_23', { override: { fare: 1000, reason: 'Corporate contract rate (quote Q-17)' } }));
  const b = (await db.doc(`bookings/${res.id}`).get()).data();
  assert.equal(b.fare, 1000);
  assert.deepEqual({ calc: b.fareOverride.calculatedFare, fare: b.fareOverride.overriddenFare, by: b.fareOverride.byUid, name: b.fareOverride.byName },
    { calc: quote(), fare: 1000, by: 'ops', name: 'Ops Desk' });
  const fb = b.fareBreakdown;
  assert.equal(fb.total, 1000);
  assert.equal(fb.taxableAmount + fb.gst, 1000);
  assert.equal(fb.gst, Math.round(fb.taxableAmount * 0.05));
  const components = fb.baseFare + fb.distanceFare + fb.timeFare + fb.nightCharge + fb.driverAllowance + fb.minimumFareAdjustment;
  assert.equal(components + fb.adminAdjustment, fb.subtotal);
  // Offer = fare excluding GST × (100 − 15)%, from the overridden fare.
  assert.equal((await db.doc(`marketplace_trips/${res.id}`).get()).data().offeredPayout, Math.round((fb.taxableAmount * 85) / 100));
  const types = (await db.collection(`bookings/${res.id}/events`).get()).docs.map((d) => d.data().type).sort();
  assert.deepEqual(types, ['created', 'fare_override']);
});

test('fare overrides on existing bookings: guarded by payment, invoice and partner payout', async () => {
  const { id } = await adminCall(createAdminBooking, 'ops', adminRequest('adm_request_30'));
  const calc = quote();
  await assert.rejects(adminCall(overrideBookingFare, 'customer', { bookingId: id, fare: 900, reason: 'Extra waiting at airport' }), /Only active admins/);
  await assert.rejects(adminCall(overrideBookingFare, 'ops', { bookingId: id, fare: 900, reason: 'short' }), /reason of at least 10/);
  await assert.rejects(adminCall(overrideBookingFare, 'ops', { bookingId: id, fare: calc, reason: 'No change at all here' }), /same as the current/);

  await adminCall(overrideBookingFare, 'ops', { bookingId: id, fare: 900, reason: 'Extra waiting at airport' });
  let b = (await db.doc(`bookings/${id}`).get()).data();
  assert.equal(b.fare, 900);
  assert.equal(b.fareOverride.calculatedFare, calc);
  assert.equal(b.fareOverride.previousFare, calc);
  assert.equal(b.fareBreakdown.taxableAmount + b.fareBreakdown.gst, 900);
  assert.equal((await db.doc(`marketplace_trips/${id}`).get()).data().offeredPayout, offerFor(b));

  // A second override still records the original calculated fare.
  await adminCall(overrideBookingFare, 'ops', { bookingId: id, fare: 950, reason: 'Customer asked for an extra stop' });
  b = (await db.doc(`bookings/${id}`).get()).data();
  assert.deepEqual([b.fare, b.fareOverride.calculatedFare, b.fareOverride.previousFare], [950, calc, 900]);

  const agreedOffer = (await db.doc(`marketplace_trips/${id}`).get()).data().offeredPayout;
  await db.doc(`bookings/${id}`).update({ driverPayout: 800 });
  await db.doc(`marketplace_trips/${id}`).update({ status: 'Assigned' });
  await assert.rejects(adminCall(overrideBookingFare, 'ops', { bookingId: id, fare: 700, reason: 'Customer negotiated a discount' }), /below the ₹800 already agreed/);
  await adminCall(overrideBookingFare, 'ops', { bookingId: id, fare: 820, reason: 'Customer negotiated a discount' });
  // A claimed offer is never repriced.
  assert.equal((await db.doc(`marketplace_trips/${id}`).get()).data().offeredPayout, agreedOffer);

  await db.doc(`bookings/${id}`).update({ invoiceId: 'inv_1', invoiceNumber: 'NES-INV-2026-00001' });
  await assert.rejects(adminCall(overrideBookingFare, 'ops', { bookingId: id, fare: 830, reason: 'Late correction after trip' }), /NES-INV-2026-00001 exists/);
  await db.doc(`bookings/${id}`).update({ invoiceId: '', payment: 'Paid' });
  await assert.rejects(adminCall(overrideBookingFare, 'ops', { bookingId: id, fare: 830, reason: 'Late correction after trip' }), /already paid/);

  // Legacy booking with a hand-typed fare and no breakdown gets a consistent one.
  await db.doc('bookings/legacy_admin').set({ status: 'Completed', fare: '₹1,500', payment: 'Pending', distanceKm: 40 });
  await adminCall(overrideBookingFare, 'ops', { bookingId: 'legacy_admin', fare: 1500, reason: 'Verified against the paper trip sheet' });
  const legacy = (await db.doc('bookings/legacy_admin').get()).data();
  assert.deepEqual([legacy.fare, legacy.fareVerified, legacy.fareOverride.calculatedFare], [1500, true, null]);
  assert.equal(legacy.fareBreakdown.adminAdjustment, legacy.fareBreakdown.subtotal);
});

// ── Staff access (Phase A) ──────────────────────────────────────────────────

const staffFns = await import('../../functions/lib/staff.js');
const staffCall = (fn, uid, data) => fn.run({ auth: { uid, token: {} }, data });

test('staff: only super admins manage access; roles sync to every holder; all changes audited', async () => {
  await db.doc('admins/rootAdmin').set({ role: 'admin', status: 'active', name: 'Owner' }); // pre-roles = super admin
  await db.doc('admins/opsOnly').set({ role: 'admin', status: 'active', staffRole: 'r_x', permissions: ['operations'] });
  await db.doc('admins/reqOne1').set({ role: 'pending', status: 'pending', email: 'one@nesam.test' });
  await db.doc('admins/reqTwo2').set({ role: 'pending', status: 'pending', email: 'two@nesam.test' });

  await assert.rejects(staffCall(staffFns.saveStaffRole, 'opsOnly', { name: 'Dispatcher', permissions: ['operations'] }), /super admin/);
  await assert.rejects(staffCall(staffFns.approveAdminRequest, 'opsOnly', { uid: 'reqOne1', staffRole: 'super_admin' }), /super admin/);
  await assert.rejects(staffCall(staffFns.saveStaffRole, 'rootAdmin', { name: 'Bad', permissions: ['everything'] }), /valid permission/);
  await assert.rejects(staffCall(staffFns.saveStaffRole, 'rootAdmin', { name: 'Super Admin', permissions: ['finance'] }), /built-in/);

  const { roleId } = await staffCall(staffFns.saveStaffRole, 'rootAdmin', { name: 'Dispatcher', permissions: ['operations', 'operations'] });
  await assert.rejects(staffCall(staffFns.saveStaffRole, 'rootAdmin', { name: 'dispatcher', permissions: ['finance'] }), /already has this name/);
  assert.deepEqual((await db.doc(`staff_roles/${roleId}`).get()).data().permissions, ['operations']);

  await staffCall(staffFns.approveAdminRequest, 'rootAdmin', { uid: 'reqOne1', staffRole: roleId });
  let one = (await db.doc('admins/reqOne1').get()).data();
  assert.deepEqual([one.role, one.status, one.staffRole, one.roleName, one.permissions], ['admin', 'active', roleId, 'Dispatcher', ['operations']]);
  await assert.rejects(staffCall(staffFns.approveAdminRequest, 'rootAdmin', { uid: 'reqOne1', staffRole: roleId }), /no longer pending/);

  // Editing the role updates every account holding it.
  const synced = await staffCall(staffFns.saveStaffRole, 'rootAdmin', { roleId, name: 'Dispatch Lead', permissions: ['people', 'operations'] });
  assert.equal(synced.syncedAdmins, 1);
  one = (await db.doc('admins/reqOne1').get()).data();
  assert.deepEqual([one.roleName, one.permissions], ['Dispatch Lead', ['operations', 'people']]);

  // Decline, then approve after reconsideration.
  await assert.rejects(staffCall(staffFns.rejectAdminRequest, 'rootAdmin', { uid: 'reqTwo2', reason: 'no' }), /at least 5/);
  await staffCall(staffFns.rejectAdminRequest, 'rootAdmin', { uid: 'reqTwo2', reason: 'Unknown requester' });
  assert.equal((await db.doc('admins/reqTwo2').get()).data().status, 'rejected');
  await staffCall(staffFns.approveAdminRequest, 'rootAdmin', { uid: 'reqTwo2', staffRole: 'super_admin' });
  assert.equal((await db.doc('admins/reqTwo2').get()).data().staffRole, 'super_admin');

  // Access changes: never your own; roles in use cannot be deleted.
  await assert.rejects(staffCall(staffFns.updateAdminAccess, 'rootAdmin', { uid: 'rootAdmin', status: 'inactive' }), /your own access/);
  await assert.rejects(staffCall(staffFns.deleteStaffRole, 'rootAdmin', { roleId }), /assigned to 1 account/);
  await staffCall(staffFns.updateAdminAccess, 'rootAdmin', { uid: 'reqOne1', staffRole: 'super_admin' });
  await staffCall(staffFns.deleteStaffRole, 'rootAdmin', { roleId });
  assert.equal((await db.doc(`staff_roles/${roleId}`).get()).exists, false);
  await staffCall(staffFns.updateAdminAccess, 'rootAdmin', { uid: 'reqOne1', status: 'inactive' });
  // A deactivated super admin has lost every privilege, including staff management.
  await assert.rejects(staffCall(staffFns.saveStaffRole, 'reqOne1', { name: 'Anything', permissions: ['finance'] }), /Only active admins/);

  const actions = (await db.collection('admin_audit').get()).docs.map((d) => d.data().action).sort();
  assert.deepEqual(actions, ['admin_access_changed', 'admin_access_changed', 'admin_approved', 'admin_approved', 'admin_rejected', 'role_created', 'role_deleted', 'role_updated']);
});

test('staff: two super admins demoting each other at once never leaves the platform without one', async () => {
  await db.doc('admins/superA').set({ role: 'admin', status: 'active', staffRole: 'super_admin' });
  await db.doc('admins/superB').set({ role: 'admin', status: 'active', staffRole: 'super_admin' });
  // Every other super admin is out of the picture for this test.
  const others = (await db.collection('admins').where('role', '==', 'admin').where('status', '==', 'active').get()).docs
    .filter((d) => !['superA', 'superB'].includes(d.id) && (d.data().staffRole || 'super_admin') === 'super_admin');
  for (const d of others) await d.ref.update({ status: 'inactive' });
  const results = await Promise.allSettled([
    staffCall(staffFns.updateAdminAccess, 'superA', { uid: 'superB', status: 'inactive' }),
    staffCall(staffFns.updateAdminAccess, 'superB', { uid: 'superA', status: 'inactive' }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const actives = (await db.collection('admins').where('status', '==', 'active').get()).docs
    .filter((d) => d.data().role === 'admin' && (d.data().staffRole || 'super_admin') === 'super_admin');
  assert.equal(actives.length, 1);
  for (const d of others) await d.ref.update({ status: 'active' });
});

test('staff: admin booking functions enforce operations and finance permissions', async () => {
  await db.doc('admins/opsDesk').set({ role: 'admin', status: 'active', staffRole: 'r_y', permissions: ['operations'] });
  await db.doc('admins/finDesk').set({ role: 'admin', status: 'active', staffRole: 'r_z', permissions: ['finance'] });
  await assert.rejects(adminCall(createAdminBooking, 'finDesk', adminRequest('perm_request_01')), /operations access/);
  await assert.rejects(
    adminCall(createAdminBooking, 'opsDesk', adminRequest('perm_request_02', { override: { fare: 900, reason: 'Corporate contract rate' } })),
    /finance access/,
  );
  const { id } = await adminCall(createAdminBooking, 'opsDesk', adminRequest('perm_request_03'));
  await assert.rejects(adminCall(overrideBookingFare, 'opsDesk', { bookingId: id, fare: 900, reason: 'Customer asked for a stop' }), /finance access/);
  await adminCall(overrideBookingFare, 'finDesk', { bookingId: id, fare: 900, reason: 'Customer asked for a stop' });
  assert.equal((await db.doc(`bookings/${id}`).get()).data().fare, 900);
});
