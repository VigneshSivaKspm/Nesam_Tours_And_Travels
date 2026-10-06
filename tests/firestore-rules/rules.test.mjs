// firestore.rules against the exact write shapes of the three mobile apps
// (user/app, driver/app, vendor/app). Payloads mirror the apps' builders —
// buildRideRequestDocs, buildCancelUpdate, buildClaimUpdate,
// buildStartTripUpdate, buildVendorClaimUpdate, buildDispatchUpdate,
// buildNewVehicleDoc … — whose field sets are pinned by the apps' unit tests.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

let env;
const ctx = {};

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'nesam-rules-mobile',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8089) },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'customers/cust1'), { role: 'customer', status: 'Approved', walletBalance: 0, name: 'Priya' });
    await setDoc(doc(db, 'customers/cust2'), { role: 'customer', status: 'Approved', walletBalance: 0, name: 'Other' });
    for (const id of ['drvA', 'drvB']) await setDoc(doc(db, `drivers/${id}`), { role: 'driver', status: 'Approved', vendorId: '', rating: 5 });
    await setDoc(doc(db, 'drivers/drvP'), { role: 'driver', status: 'Pending', vendorId: '' });
    await setDoc(doc(db, 'drivers/fd1'), { role: 'driver', status: 'Approved', vendorId: 'v1', name: 'Fleet One' });
    await setDoc(doc(db, 'drivers/fd2'), { role: 'driver', status: 'Approved', vendorId: 'v2', name: 'Fleet Two' });
    for (const id of ['v1', 'v2']) await setDoc(doc(db, `vendors/${id}`), { uid: id, role: 'vendor', status: 'APPROVED', phone: '+91980000000' + id.slice(1) });
    await setDoc(doc(db, 'vehicles/veh1'), { vendorId: 'v1', vehicleNumber: 'TN01AB1234', docStatus: 'Approved', assignedDriverId: '', assignedDriverName: '' });
  });
  const auth = (uid, phone) => env.authenticatedContext(uid, phone ? { phone_number: phone } : {}).firestore();
  Object.assign(ctx, {
    cust: auth('cust1', '+919800000011'),
    cust2: auth('cust2', '+919800000012'),
    drvA: auth('drvA'),
    drvB: auth('drvB'),
    drvP: auth('drvP'),
    v1: auth('v1', '+919800000001'),
    v2: auth('v2', '+919800000002'),
    newDriver: auth('newDrv', '+919811111111'),
    newVendor: auth('newVen', '+919822222222'),
    anon: env.unauthenticatedContext().firestore(),
  });
});

after(async () => {
  await env?.cleanup();
});

let seq = 0;
const newId = (p) => `${p}${++seq}`;

/** Customer app: buildRideRequestDocs() written in one batch. */
function rideBatch(db, id, { otp = '4321', fare = 500, extra = {}, status = 'Approved', market = {} } = {}) {
  const b = writeBatch(db);
  b.set(doc(db, 'bookings', id), {
    id,
    bookingId: `NT260929-${id}`,
    customerId: 'cust1',
    customer: 'Priya',
    phone: '+91 9800000011',
    pickup: 'Theni',
    pickupLat: 10.01,
    pickupLng: 77.47,
    drop: 'Madurai',
    dropLat: 9.83,
    dropLng: 78.09,
    fare, fareVerified: true,
    payment: 'Pending',
    paymentMethod: 'Cash',
    status,
    source: 'customer-app',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  });
  b.set(doc(db, 'booking_secrets', id), { customerId: 'cust1', otp, createdAt: serverTimestamp() });
  // Partners see a trip only once an admin has approved the booking.
  b.set(doc(db, 'marketplace_trips', id), { id, status: status === 'Approved' ? 'Open' : 'Awaiting Approval', offeredPayout: Math.round(fare * 0.85), createdAt: serverTimestamp(), ...market });
  return b;
}

async function openTrip(opts) {
  const id = newId('bk');
  await env.withSecurityRulesDisabled(c => rideBatch(c.firestore(), id, opts).commit());
  return id;
}

/** Driver app: acceptMarketplaceTrip() transaction. */
function driverClaim(db, uid, id) {
  return runTransaction(db, async (tx) => {
    const m = await tx.get(doc(db, 'marketplace_trips', id));
    if (!m.exists() || m.data().status !== 'Open') throw new Error('taken');
    tx.update(doc(db, 'bookings', id), {
      status: 'Assigned',
      tripStage: 'Assigned',
      assignedDriverId: uid,
      assignedDriverName: uid,
      driver: uid,
      driverPhone: '',
      assignedVehicleNumber: 'TN01AB1234',
      driverPayout: 425,
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.update(doc(db, 'marketplace_trips', id), { status: 'Assigned', assignedDriverId: uid, assignedDriverName: uid, updatedAt: serverTimestamp() });
  });
}

/** Vendor app: acceptOfferedRate() transaction. */
function vendorAccept(db, uid, id) {
  return runTransaction(db, async (tx) => {
    const m = await tx.get(doc(db, 'marketplace_trips', id));
    const s = m.exists() ? m.data().status : '';
    if (s !== 'Open' && s !== 'Bidding') throw new Error('taken');
    tx.update(doc(db, 'bookings', id), {
      status: 'Confirmed',
      assignedVendorId: uid,
      assignedVendorName: uid,
      vendorPayout: 425,
      confirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.update(doc(db, 'marketplace_trips', id), { status: 'Assigned', assignedVendorId: uid, assignedVendorName: uid, updatedAt: serverTimestamp() });
  });
}

const cancelUpdate = (extra = {}) => ({ status: 'Cancelled', cancelReason: 'Changed my plans', cancelledBy: 'customer', cancelledAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });

// ── Customer app ────────────────────────────────────────────────────────────

test('customer: registers own profile only with zero wallet', async () => {
  const me = env.authenticatedContext('custNew', { phone_number: '+919833333333' }).firestore();
  await assertFails(setDoc(doc(me, 'customers/custNew'), { uid: 'custNew', role: 'customer', status: 'Approved', walletBalance: 500 }));
  await assertSucceeds(setDoc(doc(me, 'customers/custNew'), { uid: 'custNew', name: 'New', role: 'customer', status: 'Approved', walletBalance: 0, createdAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(me, 'customers/custNew'), { walletBalance: 1000 }));
  await assertSucceeds(updateDoc(doc(me, 'customers/custNew'), { name: 'New Name', language: 'Tamil', updatedAt: serverTimestamp() }));
});

test('customer: creates a ride (booking + secret + marketplace) — mobile shape', async () => {
  await openTrip();
});

test('customer: own booking events accepted; foreign and invalid events denied', async () => {
  const id = await openTrip();
  const b = writeBatch(ctx.cust);
  b.set(doc(collection(ctx.cust, 'bookings', id, 'events')), { type: 'created', actorId: 'cust1', actorRole: 'customer', at: serverTimestamp() });
  await assertSucceeds(b.commit());
  // …but an event can't be forged for someone else's booking or another actor.
  await assertFails(setDoc(doc(collection(ctx.cust2, 'bookings', id, 'events')), { type: 'x', actorId: 'cust2' }));
  await assertFails(setDoc(doc(collection(ctx.cust, 'bookings', id, 'events')), { type: 'x', actorId: 'someoneElse' }));
});

test('customer: cannot create a pre-assigned, negative-fare or foreign booking', async () => {
  await assertFails(rideBatch(ctx.cust, newId('bk'), { fare: -1 }).commit());
  await assertFails(rideBatch(ctx.cust, newId('bk'), { extra: { assignedDriverId: 'drvA' } }).commit());
  await assertFails(rideBatch(ctx.cust, newId('bk'), { extra: { status: 'Confirmed' } }).commit());
  await assertFails(rideBatch(ctx.cust2, newId('bk')).commit());
});

test('customer: cancels with and without the quoted fee; fee is bounded', async () => {
  const a = await openTrip();
  await assertSucceeds(updateDoc(doc(ctx.cust, 'bookings', a), cancelUpdate()));
  const b = await openTrip();
  await assertFails(updateDoc(doc(ctx.cust, 'bookings', b), cancelUpdate({ cancellationFee: 10000 })));
  await assertSucceeds(updateDoc(doc(ctx.cust, 'bookings', b), cancelUpdate({ cancellationFee: 50 })));
  const c = await openTrip();
  await assertFails(updateDoc(doc(ctx.cust2, 'bookings', c), cancelUpdate()));
  await assertSucceeds(updateDoc(doc(ctx.cust, 'marketplace_trips', c), { status: 'Closed', updatedAt: serverTimestamp() }));
});

test('customer: reads own OTP; nobody else can', async () => {
  const id = await openTrip({ otp: '5678' });
  assert.equal((await getDoc(doc(ctx.cust, 'booking_secrets', id))).data().otp, '5678');
  await assertFails(getDoc(doc(ctx.cust2, 'booking_secrets', id)));
  await assertFails(getDoc(doc(ctx.drvA, 'booking_secrets', id)));
});

test('customer: SOS alert only for own booking', async () => {
  const id = await openTrip();
  await assertSucceeds(setDoc(doc(collection(ctx.cust, 'sos_alerts')), { bookingId: id, customerId: 'cust1', status: 'Open', createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(collection(ctx.cust2, 'sos_alerts')), { bookingId: id, customerId: 'cust2', status: 'Open' }));
});

test('customer: saved places, support tickets, notifications', async () => {
  await assertSucceeds(setDoc(doc(ctx.cust, 'saved_places', 'place-1'), { name: 'Home', address: 'x', type: 'home', ownerId: 'cust1' }));
  await assertFails(setDoc(doc(ctx.cust, 'saved_places', 'place-2'), { name: 'Home', ownerId: 'cust2' }));
  await assertSucceeds(setDoc(doc(collection(ctx.cust, 'support_tickets')), { customerId: 'cust1', category: 'Other', description: 'Something happened', status: 'Open' }));
  await assertFails(setDoc(doc(collection(ctx.cust, 'support_tickets')), { customerId: 'cust1', status: 'Resolved' }));
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'notifications/n1'), { recipientId: 'cust1', title: 't', read: false }));
  await assertSucceeds(updateDoc(doc(ctx.cust, 'notifications/n1'), { read: true, readAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(ctx.cust, 'notifications/n1'), { title: 'changed' }));
});

// ── Driver app ──────────────────────────────────────────────────────────────

test('driver: self-registration is Pending and cannot self-approve', async () => {
  const base = { role: 'driver', verified: false, vendorId: '', name: 'New Driver', presenceStatus: 'Offline', rating: 5 };
  await assertFails(setDoc(doc(ctx.newDriver, 'drivers/newDrv'), { ...base, status: 'Approved' }));
  await assertFails(setDoc(doc(ctx.newDriver, 'drivers/newDrv'), { ...base, status: 'Pending', vendorId: 'v1' }));
  await assertSucceeds(setDoc(doc(ctx.newDriver, 'drivers/newDrv'), { ...base, status: 'Pending' }));
  await assertFails(updateDoc(doc(ctx.newDriver, 'drivers/newDrv'), { status: 'Approved' }));
  await assertFails(updateDoc(doc(ctx.newDriver, 'drivers/newDrv'), { rating: 5.0001 }));
  await assertSucceeds(updateDoc(doc(ctx.newDriver, 'drivers/newDrv'), { presenceStatus: 'Online', updatedAt: serverTimestamp() }));
});

test('driver: a vendor invite links the fleet on registration, never pre-approves', async () => {
  const invited = env.authenticatedContext('invDrv', { phone_number: '+919844444444' }).firestore();
  await assertSucceeds(setDoc(doc(ctx.v1, 'driver_invites', '+919844444444'), { phone: '+919844444444', name: 'Invited', vendorId: 'v1', vendorName: 'V1', preApproved: false }));
  await assertFails(setDoc(doc(ctx.v1, 'driver_invites', '+919855555555'), { vendorId: 'v1', preApproved: true }));
  assert.equal((await getDoc(doc(invited, 'driver_invites', '+919844444444'))).data().vendorId, 'v1');
  await assertSucceeds(setDoc(doc(invited, 'drivers/invDrv'), { role: 'driver', status: 'Pending', verified: false, vendorId: 'v1' }));
  // Another fleet can't hijack an existing invite.
  await assertFails(setDoc(doc(ctx.v2, 'driver_invites', '+919844444444'), { vendorId: 'v2', preApproved: false }));
});

test('driver: two drivers claiming the same trip — exactly one wins', async () => {
  const id = await openTrip();
  const results = await Promise.allSettled([driverClaim(ctx.drvA, 'drvA', id), driverClaim(ctx.drvB, 'drvB', id)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
});

test('driver: a pending driver cannot claim', async () => {
  const id = await openTrip();
  await assertFails(driverClaim(ctx.drvP, 'drvP', id));
});

test('driver: after claiming, status and trip steps are server-only; tolls and live position are allowed', async () => {
  const id = await openTrip({ otp: '2468' });
  await assertSucceeds(driverClaim(ctx.drvA, 'drvA', id));
  const ref = doc(ctx.drvA, 'bookings', id);
  await assertSucceeds(updateDoc(ref, { driverLocation: { lat: 10, lng: 77, heading: null, updatedAt: serverTimestamp() }, updatedAt: serverTimestamp() }));
  const tolls = [{ id: 't1', name: 'Toll: X', amount: 85, receiptPhotoUrl: 'u', uploadedAt: 'now' }];
  await assertSucceeds(updateDoc(ref, { tolls, tollCharges: 85, updatedAt: serverTimestamp() }));
  // The three trip steps, the OTP, evidence and the odometer belong to the trip functions.
  await assertFails(getDoc(doc(ctx.drvA, 'booking_secrets', id)));
  await assertFails(updateDoc(ref, { status: 'Ongoing', tripStage: 'En Route Pickup', tripSubStatus: 'Trip Started', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { tripStage: 'Reached Pickup', reachedPickupAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { status: 'Ongoing', tripStage: 'In Progress', otpAttempt: '2468', startedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { preTrip: { odometerReading: 1 }, startOdometer: 1, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { vehicleVerification: { status: 'Submitted' }, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { boardingVerifiedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { status: 'Completed', tripStage: 'Completed', tripSubStatus: 'Trip Ended', completedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { paymentSummary: { totalPaid: 99999 }, payment: 'Paid', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { fare: 1 }));
  // Another driver can't touch it either.
  await assertFails(updateDoc(doc(ctx.drvB, 'bookings', id), { tolls, tollCharges: 85, updatedAt: serverTimestamp() }));
});

test('approval: partners cannot claim or even see a trip that is not Approved', async () => {
  const pending = await openTrip({ status: 'Pending' });
  // Drivers and vendors cannot read the hidden marketplace record…
  await assertFails(getDoc(doc(ctx.drvA, 'marketplace_trips', pending)));
  await assertFails(getDoc(doc(ctx.v1, 'marketplace_trips', pending)));
  const open = await getDocs(query(collection(ctx.drvA, 'marketplace_trips'), where('status', '==', 'Open')));
  assert.ok(!open.docs.some((d) => d.id === pending));
  // …and the claim is refused even if they write it directly.
  await assertFails(driverClaim(ctx.drvA, 'drvA', pending));
  await assertFails(vendorAccept(ctx.v1, 'v1', pending));
  // Once an admin approves it (server side) the same claim works.
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), 'bookings', pending), { status: 'Approved' });
    await updateDoc(doc(c.firestore(), 'marketplace_trips', pending), { status: 'Open' });
  });
  await assertSucceeds(driverClaim(ctx.drvA, 'drvA', pending));
});

test('approval: a trip published for specific vehicle types is claimable only by a matching driver', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'drivers/drvSedan'), { role: 'driver', status: 'Approved', vendorId: '', vehicleType: 'Sedan' }));
  const sedanOnly = await openTrip({ market: { eligibleVehicleTypes: ['sedan'], vehicleCategory: 'Sedan' } });
  const suvOnly = await openTrip({ market: { eligibleVehicleTypes: ['suv'], vehicleCategory: 'SUV' } });
  const drv = env.authenticatedContext('drvSedan').firestore();
  await assertFails(driverClaim(drv, 'drvSedan', suvOnly));
  await assertSucceeds(driverClaim(drv, 'drvSedan', sedanOnly));
  // Trips published before the list existed stay open to every approved driver.
  await assertSucceeds(driverClaim(ctx.drvA, 'drvA', await openTrip()));
});

test('new records: audit, security, verification and delivery logs are server-only', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'audit_logs/a1'), { action: 'x', performedBy: 'u' });
    await setDoc(doc(db, 'security_events/s1'), { type: 'root_detected', userId: 'drvA' });
    await setDoc(doc(db, 'vehicle_verifications/vv1'), { driverId: 'drvA', status: 'Submitted' });
    await setDoc(doc(db, 'otp_verifications/o1'), { codeHash: 'x' });
    await setDoc(doc(db, 'capture_sessions/c1'), { driverId: 'drvA' });
    await setDoc(doc(db, 'notification_deliveries/d1'), { channel: 'sms' });
    await setDoc(doc(db, 'legal_documents/terms_driver'), { status: 'Published', version: 1, role: 'driver', body: 'x' });
    await setDoc(doc(db, 'legal_documents/draft_x'), { status: 'Draft', version: 0, role: 'driver', body: 'x' });
    await setDoc(doc(db, 'legal_acceptances/drvA_terms_driver_v1'), { userId: 'drvA' });
    await setDoc(doc(db, 'legal_acceptances/drvB_terms_driver_v1'), { userId: 'drvB' });
    await setDoc(doc(db, 'public_config/fare_adjustment'), { enabled: true, percent: 10, direction: 'increase' });
  });
  for (const path of ['audit_logs/a1', 'security_events/s1', 'otp_verifications/o1', 'capture_sessions/c1', 'notification_deliveries/d1']) {
    await assertFails(getDoc(doc(ctx.drvA, path)));
    await assertFails(getDoc(doc(ctx.v1, path)));
    await assertFails(getDoc(doc(ctx.cust, path)));
  }
  for (const db of [ctx.drvA, ctx.v1, ctx.cust]) {
    await assertFails(setDoc(doc(db, 'audit_logs/forged'), { action: 'x' }));
    await assertFails(setDoc(doc(db, 'security_events/forged'), { type: 'x' }));
    await assertFails(setDoc(doc(db, 'vehicle_verifications/forged'), { driverId: 'x', status: 'Submitted' }));
    await assertFails(setDoc(doc(db, 'legal_acceptances/forged'), { userId: 'x' }));
    await assertFails(setDoc(doc(db, 'public_config/fare_adjustment'), { enabled: true, percent: 0, direction: 'decrease' }));
    await assertFails(setDoc(doc(db, 'penalties/forged'), { driverId: 'drvA', amount: 1, status: 'Waived' }));
  }
  // A driver reads their own verification record, their own acceptance and published (not draft) documents.
  await assertSucceeds(getDoc(doc(ctx.drvA, 'vehicle_verifications/vv1')));
  await assertFails(getDoc(doc(ctx.drvB, 'vehicle_verifications/vv1')));
  await assertSucceeds(getDoc(doc(ctx.drvA, 'legal_documents/terms_driver')));
  await assertFails(getDoc(doc(ctx.drvA, 'legal_documents/draft_x')));
  await assertSucceeds(getDoc(doc(ctx.drvA, 'legal_acceptances/drvA_terms_driver_v1')));
  await assertFails(getDoc(doc(ctx.drvA, 'legal_acceptances/drvB_terms_driver_v1')));
  await assertSucceeds(getDoc(doc(ctx.cust, 'public_config/fare_adjustment')));
  await assertFails(getDoc(doc(ctx.anon, 'public_config/fare_adjustment')));
});

test('device tokens: a device registers and removes only its own', async () => {
  const ok = { ownerId: 'drvA', token: 'tok-1', platform: 'android', role: 'driver', createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(ctx.drvA, 'device_tokens/drvA_tok1'), ok));
  await assertFails(setDoc(doc(ctx.drvB, 'device_tokens/forged'), ok));
  await assertFails(setDoc(doc(ctx.drvA, 'device_tokens/extra'), { ...ok, admin: true }));
  await assertFails(updateDoc(doc(ctx.drvA, 'device_tokens/drvA_tok1'), { ownerId: 'drvB' }));
  await assertFails(deleteDoc(doc(ctx.drvB, 'device_tokens/drvA_tok1')));
  await assertSucceeds(deleteDoc(doc(ctx.drvA, 'device_tokens/drvA_tok1')));
});

test('driver: payout requests are Pending-only and self-scoped', async () => {
  await assertFails(setDoc(doc(collection(ctx.drvA, 'payout_requests')), { driverId: 'drvA', amount: 500, method: 'UPI', details: 'a@b', status: 'Pending' }));
  await assertFails(setDoc(doc(collection(ctx.drvA, 'payout_requests')), { driverId: 'drvA', amount: 500, status: 'Paid' }));
  await assertFails(setDoc(doc(collection(ctx.drvA, 'payout_requests')), { driverId: 'drvA', amount: -5, status: 'Pending' }));
  await assertFails(setDoc(doc(collection(ctx.drvA, 'payout_requests')), { driverId: 'drvB', amount: 500, status: 'Pending' }));
  await assertFails(setDoc(doc(collection(ctx.drvP, 'payout_requests')), { driverId: 'drvP', amount: 500, status: 'Pending' }));
});

// ── Vendor app ──────────────────────────────────────────────────────────────

test('vendor: onboarding starts INCOMPLETE and is bound to the verified phone', async () => {
  const base = { uid: 'newVen', role: 'vendor', phone: '+919822222222', onboardingStep: 1 };
  await assertFails(setDoc(doc(ctx.newVendor, 'vendors/newVen'), { ...base, status: 'APPROVED' }));
  await assertFails(setDoc(doc(ctx.newVendor, 'vendors/newVen'), { ...base, phone: '+910000000000', status: 'INCOMPLETE' }));
  await assertSucceeds(setDoc(doc(ctx.newVendor, 'vendors/newVen'), { ...base, status: 'INCOMPLETE', createdAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(ctx.newVendor, 'vendors/newVen'), { status: 'PENDING_APPROVAL', submittedAt: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(ctx.newVendor, 'vendor_kyc/newVen'), { payout: { accountNumber: '123456789012' }, updatedAt: serverTimestamp() }));
  // Unapproved vendors see no marketplace.
  await assertFails(getDocs(query(collection(ctx.newVendor, 'marketplace_trips'), where('status', '==', 'Open'))));
});

test('vendor: accepts the offered rate atomically', async () => {
  const id = await openTrip();
  await assertSucceeds(vendorAccept(ctx.v1, 'v1', id));
  // A second vendor can no longer even read a trip another vendor won…
  await assertFails(getDoc(doc(ctx.v2, 'marketplace_trips', id)));
  await assert.rejects(vendorAccept(ctx.v2, 'v2', id));
  // …and the rules reject the claim even when that guard is bypassed.
  const raw = writeBatch(ctx.v2);
  raw.update(doc(ctx.v2, 'bookings', id), { status: 'Confirmed', assignedVendorId: 'v2', assignedVendorName: 'v2', vendorPayout: 425, confirmedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  raw.update(doc(ctx.v2, 'marketplace_trips', id), { status: 'Assigned', assignedVendorId: 'v2', assignedVendorName: 'v2', updatedAt: serverTimestamp() });
  await assertFails(raw.commit());
});

test('vendor and driver racing for one trip — exactly one wins', async () => {
  const id = await openTrip();
  const results = await Promise.allSettled([vendorAccept(ctx.v1, 'v1', id), driverClaim(ctx.drvA, 'drvA', id)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
});

test('vendor: counter-bids are isolated per vendor', async () => {
  const id = await openTrip();
  const bid = (db, vendorId) => {
    const b = writeBatch(db);
    const ref = doc(collection(db, 'marketplace_trips', id, 'bids'));
    b.set(ref, { tripId: id, vendorId, vendorCounterRate: 600, offeredPayout: 425, status: 'Pending Review', submittedAt: serverTimestamp() });
    b.update(doc(db, 'marketplace_trips', id), { status: 'Bidding', bidCount: increment(1), lastCounterRate: 600, lastBidAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { commit: () => b.commit(), ref };
  };
  const b1 = bid(ctx.v1, 'v1');
  await assertSucceeds(b1.commit());
  await assertSucceeds(bid(ctx.v2, 'v2').commit());
  await assertFails(setDoc(doc(collection(ctx.v1, 'marketplace_trips', id, 'bids')), { tripId: id, vendorId: 'v2', status: 'Pending Review' }));
  await assertFails(updateDoc(doc(ctx.v2, 'marketplace_trips', id, 'bids', b1.ref.id), { vendorCounterRate: 1 }));
  await assertFails(deleteDoc(doc(ctx.v2, 'marketplace_trips', id, 'bids', b1.ref.id)));
  const mine = await getDocs(query(collectionGroup(ctx.v1, 'bids'), where('vendorId', '==', 'v1')));
  assert.ok(mine.size >= 1 && mine.docs.every((d) => d.data().vendorId === 'v1'));
  await assertFails(getDocs(query(collectionGroup(ctx.v1, 'bids'), where('vendorId', '==', 'v2'))));
  await assertSucceeds(deleteDoc(b1.ref));
  // A bidding trip can still be accepted at the offered rate.
  await assertSucceeds(vendorAccept(ctx.v2, 'v2', id));
});

test('vendor: dispatches only its own drivers in its own approved vehicle (by id), then the driver runs the trip', async () => {
  const id = await openTrip({ otp: '1357' });
  await assertSucceeds(vendorAccept(ctx.v1, 'v1', id));
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'vehicles/vehPend'), { vendorId: 'v1', vehicleNumber: 'TN09PP0001', docStatus: 'Pending' });
    await setDoc(doc(db, 'vehicles/vehV2'), { vendorId: 'v2', vehicleNumber: 'TN09VV0002', docStatus: 'Approved' });
    await setDoc(doc(db, 'vehicles/vehShop'), { vendorId: 'v1', vehicleNumber: 'TN09SS0003', docStatus: 'Approved', status: 'Maintenance' });
  });
  const dispatch = (driverId, vehicleId = 'veh1', number = 'TN01AB1234') => ({
    status: 'Assigned',
    tripStage: 'Assigned',
    assignedDriverId: driverId,
    assignedDriverName: driverId,
    driver: driverId,
    driverPhone: '',
    ...(vehicleId === null ? {} : { assignedVehicleId: vehicleId }),
    assignedVehicleNumber: number,
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await assertFails(updateDoc(doc(ctx.v1, 'bookings', id), dispatch('fd2')));
  await assertFails(updateDoc(doc(ctx.v2, 'bookings', id), dispatch('fd2')));
  // The vehicle is referenced by id and must be the vendor's own, approved, in service, number matching.
  await assertFails(updateDoc(doc(ctx.v1, 'bookings', id), dispatch('fd1', null)));
  await assertFails(updateDoc(doc(ctx.v1, 'bookings', id), dispatch('fd1', 'vehV2', 'TN09VV0002')));
  await assertFails(updateDoc(doc(ctx.v1, 'bookings', id), dispatch('fd1', 'vehPend', 'TN09PP0001')));
  await assertFails(updateDoc(doc(ctx.v1, 'bookings', id), dispatch('fd1', 'vehShop', 'TN09SS0003')));
  await assertFails(updateDoc(doc(ctx.v1, 'bookings', id), dispatch('fd1', 'veh1', 'TN99ZZ9999')));
  // A vendor never sets its own payout while dispatching.
  await assertFails(updateDoc(doc(ctx.v1, 'bookings', id), { ...dispatch('fd1'), vendorPayout: 9999 }));
  await assertSucceeds(updateDoc(doc(ctx.v1, 'bookings', id), dispatch('fd1')));
  const fd1 = env.authenticatedContext('fd1').firestore();
  // The dispatched driver may keep tolls and position; the trip steps are the server's.
  await assertSucceeds(updateDoc(doc(fd1, 'bookings', id), { driverLocation: { lat: 10, lng: 77, heading: null }, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(fd1, 'bookings', id), { tripStage: 'Reached Pickup', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(fd1, 'bookings', id), { status: 'Ongoing', tripStage: 'In Progress', otpAttempt: '1357', startedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
});

test('vendor: fleet vehicles await review; driver fleet fields only', async () => {
  const v = { vendorId: 'v1', vehicleNumber: 'TN02CD5678', category: 'Sedan', assignedDriverId: '', assignedDriverName: '' };
  await assertFails(setDoc(doc(ctx.v1, 'vehicles/veh2'), { ...v, docStatus: 'Approved' }));
  await assertFails(setDoc(doc(ctx.v1, 'vehicles/veh3'), { ...v, vendorId: 'v2', docStatus: 'Pending' }));
  await assertSucceeds(setDoc(doc(ctx.v1, 'vehicles/veh2'), { ...v, docStatus: 'Pending', createdAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(ctx.v1, 'vehicles/veh2'), { docStatus: 'Approved' }));
  await assertSucceeds(updateDoc(doc(ctx.v1, 'vehicles/veh1'), { status: 'Maintenance', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(ctx.v2, 'vehicles/veh1'), { status: 'Inactive' }));
  // assignVehicle(): driver fleet fields + vehicle pairing in one batch.
  const b = writeBatch(ctx.v1);
  b.update(doc(ctx.v1, 'drivers/fd1'), { assignedVehicleId: 'veh1', assignedVehicleNumber: 'TN01AB1234', updatedAt: serverTimestamp() });
  b.update(doc(ctx.v1, 'vehicles/veh1'), { assignedDriverId: 'fd1', assignedDriverName: 'Fleet One', updatedAt: serverTimestamp() });
  await assertSucceeds(b.commit());
  await assertSucceeds(updateDoc(doc(ctx.v1, 'drivers/fd1'), { fleetStatus: 'Suspended', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(ctx.v1, 'drivers/fd1'), { status: 'Rejected' }));
  await assertFails(updateDoc(doc(ctx.v1, 'drivers/fd2'), { fleetStatus: 'Suspended' }));
  await assertSucceeds(deleteDoc(doc(ctx.v1, 'vehicles/veh2')));
});

test('vendor: payout requests are Pending-only and self-scoped', async () => {
  await assertFails(setDoc(doc(collection(ctx.v1, 'payout_requests')), { vendorId: 'v1', amount: 5000, method: 'UPI', details: 'x@y', status: 'Pending' }));
  await assertFails(setDoc(doc(collection(ctx.v1, 'payout_requests')), { vendorId: 'v1', amount: 5000, status: 'Paid' }));
  await assertFails(setDoc(doc(collection(ctx.v1, 'payout_requests')), { vendorId: 'v2', amount: 5000, status: 'Pending' }));
  await assertFails(setDoc(doc(collection(ctx.newVendor, 'payout_requests')), { vendorId: 'newVen', amount: 5000, status: 'Pending' }));
});

test('unauthenticated clients get nothing', async () => {
  await assertFails(getDocs(collection(ctx.anon, 'marketplace_trips')));
  await assertFails(getDoc(doc(ctx.anon, 'customers/cust1')));
  await assertFails(setDoc(doc(collection(ctx.anon, 'bookings')), { status: 'Pending', fare: 1, payment: 'Pending', customerId: 'x' }));
});

test('security: driver cannot alter wallet, approved KYC or public bank data', async () => {
  await assertFails(updateDoc(doc(ctx.drvA, 'drivers/drvA'), { walletBalance: 999999 }));
  await assertFails(updateDoc(doc(ctx.drvA, 'drivers/drvA'), { licenseNumber: 'REPLACED' }));
  await assertFails(updateDoc(doc(ctx.drvA, 'drivers/drvA'), { bank: { accountNumber: '123456' } }));
  await assertSucceeds(updateDoc(doc(ctx.drvA, 'drivers/drvA'), { licenseNumber: 'REPLACED', docStatus: 'Pending' }));
});
test('security: private bank is owner/admin only and registration can write atomically', async () => {
  const fd1 = env.authenticatedContext('fd1').firestore();
  await assertSucceeds(setDoc(doc(fd1, 'driver_private/fd1'), { bank: { accountNumber: '12345678' }, updatedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(fd1, 'driver_private/fd1')));
  await assertFails(getDoc(doc(ctx.v1, 'driver_private/fd1')));
  const fresh = env.authenticatedContext('privateNew').firestore();
  const batch = writeBatch(fresh);
  batch.set(doc(fresh, 'drivers/privateNew'), { role: 'driver', status: 'Pending', vendorId: '', verified: false, docStatus: 'Pending' });
  batch.set(doc(fresh, 'driver_private/privateNew'), { bank: { accountNumber: '12345678' }, identity: { aadhaarNumber: 'test' } });
  await assertSucceeds(batch.commit());
});
test('security: claimant cannot choose their payout', async () => {
  const id = await openTrip();
  await assertFails(updateDoc(doc(ctx.drvB, 'bookings', id), { status: 'Assigned', assignedDriverId: 'drvB', driverPayout: 999999 }));
  await assertFails(updateDoc(doc(ctx.v1, 'bookings', id), { status: 'Confirmed', assignedVendorId: 'v1', vendorPayout: 999999 }));
});
test('security: vendor cannot dispatch pending or suspended fleet drivers', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'drivers/pendingFleet'), { role: 'driver', status: 'Pending', vendorId: 'v1' }));
  const id = await openTrip();
  await vendorAccept(ctx.v1, 'v1', id);
  await assertFails(updateDoc(doc(ctx.v1, 'bookings', id), { status: 'Assigned', assignedDriverId: 'pendingFleet' }));
});
test('security: pending driver cannot read marketplace', async () => {
  await assertFails(getDocs(query(collection(ctx.drvP, 'marketplace_trips'), where('status', '==', 'Open'))));
});
test('security: direct oversized payout and negative toll charges denied', async () => {
  await assertFails(setDoc(doc(collection(ctx.drvB, 'payout_requests')), { driverId: 'drvB', amount: 999999999, status: 'Pending' }));
  const id = await openTrip();
  await driverClaim(ctx.drvB, 'drvB', id);
  await assertFails(updateDoc(doc(ctx.drvB, 'bookings', id), { tollCharges: -10000 }));
});
test('security: inactive admin retains no privileged writes', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'admins/inactiveAdmin'), { role: 'admin', status: 'inactive' }));
  await assertFails(setDoc(doc(env.authenticatedContext('inactiveAdmin').firestore(), 'settings/audit'), { changed: true }));
});


// ── Phase B: partner money is server-only ───────────────────────────────────

test('ledger & wallets: partners read only their own; nobody writes them from a client', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'wallet_ledger/trip_x1'), { schema: 2, walletId: 'driver_drvA', driverId: 'drvA', actorType: 'driver', actorId: 'drvA', netAmount: 500, status: 'available' });
    await setDoc(doc(db, 'wallet_ledger/trip_x2'), { schema: 2, walletId: 'vendor_v1', vendorId: 'v1', actorType: 'vendor', actorId: 'v1', netAmount: 900, status: 'available' });
    await setDoc(doc(db, 'wallets/driver_drvA'), { driverId: 'drvA', available: 500 });
    await setDoc(doc(db, 'wallets/vendor_v1'), { vendorId: 'v1', available: 900 });
  });
  await assertSucceeds(getDoc(doc(ctx.drvA, 'wallet_ledger/trip_x1')));
  await assertSucceeds(getDocs(query(collection(ctx.drvA, 'wallet_ledger'), where('driverId', '==', 'drvA'))));
  await assertFails(getDoc(doc(ctx.drvB, 'wallet_ledger/trip_x1')));
  await assertFails(getDocs(collection(ctx.drvA, 'wallet_ledger')));
  await assertSucceeds(getDocs(query(collection(ctx.v1, 'wallet_ledger'), where('vendorId', '==', 'v1'))));
  await assertFails(getDoc(doc(ctx.v2, 'wallet_ledger/trip_x2')));
  await assertFails(getDoc(doc(ctx.cust, 'wallet_ledger/trip_x1')));

  await assertSucceeds(getDoc(doc(ctx.drvA, 'wallets/driver_drvA')));
  await assertSucceeds(getDoc(doc(ctx.v1, 'wallets/vendor_v1')));
  // A partner's wallet that the server has not created yet reads as missing, not as an error.
  await assertSucceeds(getDoc(doc(ctx.drvB, 'wallets/driver_drvB')));
  await assertFails(getDoc(doc(ctx.drvB, 'wallets/driver_drvA')));
  await assertFails(getDoc(doc(ctx.v2, 'wallets/vendor_v1')));
  await assertFails(getDoc(doc(ctx.v1, 'wallets/driver_drvA')));

  for (const db of [ctx.drvA, ctx.v1, ctx.cust]) {
    await assertFails(setDoc(doc(db, 'wallet_ledger/forged'), { schema: 2, driverId: 'drvA', walletId: 'driver_drvA', netAmount: 99999, status: 'available' }));
    await assertFails(updateDoc(doc(db, 'wallets/driver_drvA'), { available: 99999 }));
    await assertFails(setDoc(doc(db, 'wallets/vendor_v1'), { vendorId: 'v1', available: 99999 }));
  }
  await assertFails(setDoc(doc(ctx.drvA, 'business_config/commission'), { base: 'taxable', global: { rate: 0 } }));
  await assertFails(getDoc(doc(ctx.drvA, 'business_config/commission')));
});

test('driver claim: the vehicle is the one paired on the driver record (by id); money fields stay server-set', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'drivers/drvV'), { role: 'driver', status: 'Approved', vendorId: '', assignedVehicleId: 'vehIndie', assignedVehicleNumber: 'TN05IN0005' });
    await setDoc(doc(db, 'vehicles/vehIndie'), { vendorId: '', vehicleNumber: 'TN05IN0005', docStatus: 'Approved', assignedDriverId: 'drvV' });
    await setDoc(doc(db, 'vehicles/vehOther'), { vendorId: '', vehicleNumber: 'TN05OT0006', docStatus: 'Approved', assignedDriverId: 'drvB' });
  });
  const drvV = env.authenticatedContext('drvV').firestore();
  const claim = (db, uid, id, vehicle) => runTransaction(db, async (tx) => {
    await tx.get(doc(db, 'marketplace_trips', id));
    tx.update(doc(db, 'bookings', id), {
      status: 'Assigned', tripStage: 'Assigned', assignedDriverId: uid, assignedDriverName: uid, driver: uid, driverPhone: '',
      ...vehicle, driverPayout: 425, assignedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    tx.update(doc(db, 'marketplace_trips', id), { status: 'Assigned', assignedDriverId: uid, assignedDriverName: uid, updatedAt: serverTimestamp() });
  });
  const id = await openTrip();
  // Not their paired vehicle, no vehicle id, or a mismatched number: refused.
  await assertFails(claim(drvV, 'drvV', id, { assignedVehicleId: 'vehOther', assignedVehicleNumber: 'TN05OT0006' }));
  await assertFails(claim(drvV, 'drvV', id, { assignedVehicleNumber: 'TN05IN0005' }));
  await assertFails(claim(drvV, 'drvV', id, { assignedVehicleId: 'vehIndie', assignedVehicleNumber: 'TN05IN9999' }));
  await assertSucceeds(claim(drvV, 'drvV', id, { assignedVehicleId: 'vehIndie', assignedVehicleNumber: 'TN05IN0005' }));
  // After claiming, the driver cannot change the payout, fare or commission.
  for (const field of [{ driverPayout: 9999 }, { fare: 1 }, { commission: { rate: 0 } }, { finance: { partnerPayout: 9999 } }, { payoutSource: 'manual' }]) {
    await assertFails(updateDoc(doc(drvV, 'bookings', id), { ...field, updatedAt: serverTimestamp() }));
  }
  // A driver without a paired vehicle record claims with no vehicle id (legacy self-registered vehicle).
  const id2 = await openTrip();
  await assertFails(claim(ctx.drvB, 'drvB', id2, { assignedVehicleId: 'vehOther', assignedVehicleNumber: 'TN05OT0006' }));
  await assertSucceeds(claim(ctx.drvB, 'drvB', id2, { assignedVehicleNumber: 'TN01AB1234' }));
});
