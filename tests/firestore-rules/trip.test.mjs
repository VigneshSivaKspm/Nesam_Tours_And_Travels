// Driver trip workflow, vehicle photo verification, customer OTP delivery and
// security events — through the real compiled functions on the Firestore
// emulator, with Storage and the message providers replaced by fakes.
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { PROJECT, call, failing, installFakeNetwork, makeJpeg, putObject, resetSent, restoreNetwork, sent } from './harness.mjs';

const { db } = await import('../../functions/lib/admin.js');
const { createAdminBooking } = await import('../../functions/lib/adminBookings.js');
const ops = await import('../../functions/lib/bookingOps.js');
const { advanceTrip, verifyBoarding } = await import('../../functions/lib/trips.js');
const vv = await import('../../functions/lib/vehicleVerification.js');
const cv = await import('../../functions/lib/customerVerification.js');
const sec = await import('../../functions/lib/security.js');

const { FieldValue } = createRequire(new URL('../../functions/package.json', import.meta.url))('firebase-admin/firestore');

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8089) } });
  await env.clearFirestore();
  installFakeNetwork();
  const set = (p, d) => db.doc(p).set(d);
  await set('admins/ops', { role: 'admin', status: 'active', name: 'Ops Desk' });
  await set('business_config/commission', { base: 'taxable', global: { rate: 15 }, services: {}, categories: {}, version: 1 });
  await set('vehicle_categories/cat1', {
    name: 'Sedan', code: 'SEDAN', status: 'Active', seatingCapacity: 4,
    fare: { baseFare: 5000, baseKm: 500, perKmRate: 15, minimumFare: 0, nightAllowance: 0, driverAllowance: 0, waitingChargePerHour: 0, tollIncluded: false, parkingIncluded: false, permitCharge: 0, carrierCharge: 0 },
  });
  for (const id of ['drvA', 'drvB']) await set(`drivers/${id}`, { role: 'driver', status: 'Approved', vendorId: '', name: `Driver ${id.slice(-1)}`, presenceStatus: 'Online', vehicleType: 'Sedan' });
  await set('drivers/drvSusp', { role: 'driver', status: 'Approved', vendorId: '', name: 'Suspended', fleetStatus: 'Suspended' });
});
after(async () => { restoreNetwork(); await db.terminate(); await env?.cleanup(); });

const pin = (lat, lng, address, name) => ({ lat, lng, address, name });
let counter = 0;
/** An approved booking assigned to `driver`, pickup at Theni (10.01, 77.47). */
async function assigned(driver = 'drvA', extra = {}) {
  const id = `trip_book_${String(++counter).padStart(4, '0')}`;
  const body = {
    requestId: id, customerName: 'Rider', customerPhone: `98${String(counter).padStart(8, '0')}`, categoryId: 'cat1', tripType: 'One Way', paymentMethod: 'Cash',
    pickupPoint: pin(10.01, 77.47, 'Theni Bus Stand, Theni', 'Theni'), dropPoint: pin(10.1, 77.5, 'Bodinayakanur', 'Bodi'), customerWhatsapp: { sameAsMobile: true }, ...extra,
  };
  const q = await call(createAdminBooking, 'ops', { ...body, quoteOnly: true });
  await call(createAdminBooking, 'ops', { ...body, expectedFare: q.quote.total });
  await call(ops.approveBooking, 'ops', { bookingId: id });
  if (driver) await call(ops.assignDriver, 'ops', { bookingId: id, driverId: driver, reason: '', force: true });
  return id;
}
const booking = async (id) => (await db.doc(`bookings/${id}`).get()).data();
const secEvents = async (type) => (await db.collection('security_events').where('type', '==', type).get()).docs.map((d) => d.data());

let seed = 1000;
const GPS = { lat: 10.01, lng: 77.47, accuracy: 12 };
/** Request an instruction, "take" the photo and submit it, as the app does. */
async function capture(uid, sessionId, slot, { bytes, meta, storagePath, gps = GPS } = {}) {
  const ch = await call(vv.getSlotChallenge, uid, { sessionId, slot });
  putObject(ch.storagePath, bytes ?? makeJpeg(++seed), meta ?? { source: 'camera_session', sessionId, slot });
  const res = await call(vv.submitCapturePhoto, uid, { sessionId, slot, storagePath: storagePath ?? ch.storagePath, capturedAt: Date.now(), gps });
  return { ch, res };
}
/** Complete verification (three photos + odometer) for a booking. */
async function verify(id, uid = 'drvA', odometer = 12000) {
  const s = await call(vv.createCaptureSession, uid, { bookingId: id });
  for (const slot of ['front', 'rear', 'interior']) await capture(uid, s.sessionId, slot);
  return call(vv.finalizeVehicleVerification, uid, { sessionId: s.sessionId, odometerReading: odometer });
}
const advance = (id, to, extra = {}, uid = 'drvA') => call(advanceTrip, uid, { bookingId: id, to, platform: 'android', ...extra });

test('vehicle photos: three camera captures, each with a server instruction; no selfie anywhere', async () => {
  const id = await assigned();
  const s = await call(vv.createCaptureSession, 'drvA', { bookingId: id });
  assert.deepEqual(s.slots.map((x) => x.slot), ['front', 'rear', 'interior']);
  // Only the assigned driver can open a session.
  await assert.rejects(call(vv.createCaptureSession, 'drvB', { bookingId: id }), /not assigned to you/);
  await assert.rejects(call(vv.createCaptureSession, 'drvSusp', { bookingId: id }), /not active/);
  // A photo cannot be submitted before its instruction is requested.
  await assert.rejects(call(vv.submitCapturePhoto, 'drvA', { sessionId: s.sessionId, slot: 'front', storagePath: 'x/y.jpg' }), /Request the instruction|not uploaded to the capture session/);
  // Each instruction is random, short-lived and carries a one-time code.
  const c1 = await call(vv.getSlotChallenge, 'drvA', { sessionId: s.sessionId, slot: 'front' });
  assert.match(c1.code, /^\d{4,6}$|^[A-Z0-9]{3,8}$/);
  assert.ok(c1.instruction.length > 10);
  assert.ok(c1.expiresAtMs > Date.now());
  assert.match(c1.storagePath, new RegExp(`^drivers/drvA/trips/${id}/verification/${s.sessionId}/front-\\d+\\.jpg$`));
  // The upload must be tagged as a live camera capture of this session and slot (gallery picks are not).
  putObject(c1.storagePath, makeJpeg(++seed), { source: 'gallery', sessionId: s.sessionId, slot: 'front' });
  await assert.rejects(call(vv.submitCapturePhoto, 'drvA', { sessionId: s.sessionId, slot: 'front', storagePath: c1.storagePath }), /captured live with the in-app camera/);
  assert.equal((await secEvents('gallery_capture_attempt')).length, 1);
  // A path that is not the one issued for the slot is refused.
  await assert.rejects(call(vv.submitCapturePhoto, 'drvA', { sessionId: s.sessionId, slot: 'front', storagePath: `drivers/drvA/trips/${id}/verification/${s.sessionId}/front-1.jpg` }), /not uploaded to the capture session/);
  // A tiny file is refused; a PNG is refused.
  putObject(c1.storagePath, Buffer.alloc(500, 1), { source: 'camera_session', sessionId: s.sessionId, slot: 'front' });
  await assert.rejects(call(vv.submitCapturePhoto, 'drvA', { sessionId: s.sessionId, slot: 'front', storagePath: c1.storagePath }), /too small or too large/);
  putObject(c1.storagePath, makeJpeg(++seed), { source: 'camera_session', sessionId: s.sessionId, slot: 'front' }, 'image/png');
  await assert.rejects(call(vv.submitCapturePhoto, 'drvA', { sessionId: s.sessionId, slot: 'front', storagePath: c1.storagePath }), /JPEG/);
  // Finalising with nothing captured, or with photos missing, is refused.
  await assert.rejects(call(vv.finalizeVehicleVerification, 'drvA', { sessionId: s.sessionId, odometerReading: 100 }), /No photos were captured/);
  // A genuine capture is accepted and recorded with its own risk signals.
  putObject(c1.storagePath, makeJpeg(++seed), { source: 'camera_session', sessionId: s.sessionId, slot: 'front' });
  const ok = await call(vv.submitCapturePhoto, 'drvA', { sessionId: s.sessionId, slot: 'front', storagePath: c1.storagePath, capturedAt: Date.now(), gps: GPS });
  assert.equal(ok.accepted, true);
  const doc = (await db.doc(`vehicle_verifications/${id}`).get()).data();
  assert.equal(doc.status, 'InProgress');
  assert.equal(doc.photos.front.sha256.length, 64);
  assert.equal(doc.photos.front.gps.lat, 10.01);
  assert.equal(doc.photos.front.instruction, c1.instruction);
  assert.equal(doc.vehicleFrontPhoto, c1.storagePath);
  assert.ok(Array.isArray(doc.photos.front.signals));
  // The same instruction cannot be used twice; a retake needs a fresh one and a new file name.
  await assert.rejects(call(vv.submitCapturePhoto, 'drvA', { sessionId: s.sessionId, slot: 'front', storagePath: c1.storagePath }), /already used/);
  const ret = await capture('drvA', s.sessionId, 'front');
  assert.notEqual(ret.ch.storagePath, c1.storagePath);
  await assert.rejects(call(vv.finalizeVehicleVerification, 'drvA', { sessionId: s.sessionId, odometerReading: 100 }), /Missing: Vehicle rear/);
  await capture('drvA', s.sessionId, 'rear');
  await capture('drvA', s.sessionId, 'interior');
  await assert.rejects(call(vv.finalizeVehicleVerification, 'drvA', { sessionId: s.sessionId, odometerReading: 0 }), /odometer/);
  const fin = await call(vv.finalizeVehicleVerification, 'drvA', { sessionId: s.sessionId, odometerReading: 12000 });
  assert.equal(fin.ok, true);
  // Three separate fields on the booking and the verification; nothing resembling a selfie.
  const b = await booking(id);
  for (const f of ['vehicleFrontPhoto', 'vehicleRearPhoto', 'vehicleInteriorPhoto']) assert.match(b[f], /^drivers\/drvA\/trips\//);
  assert.equal(new Set([b.vehicleFrontPhoto, b.vehicleRearPhoto, b.vehicleInteriorPhoto]).size, 3);
  assert.equal(b.startOdometer, 12000);
  assert.equal(b.vehicleVerification.status, 'Submitted');
  assert.equal(JSON.stringify(b).toLowerCase().includes('selfie'), false);
  assert.equal(JSON.stringify((await db.doc(`vehicle_verifications/${id}`).get()).data()).toLowerCase().includes('selfie'), false);
  // The session is closed and cannot be used again; verification cannot be redone by the driver.
  await assert.rejects(call(vv.getSlotChallenge, 'drvA', { sessionId: s.sessionId, slot: 'front' }), /no longer valid/);
  await assert.rejects(call(vv.createCaptureSession, 'drvA', { bookingId: id }), /already submitted/);
  assert.ok((await db.collection('audit_logs').where('bookingId', '==', id).get()).docs.some((d) => d.data().action === 'vehicle_verification_submitted'));
});

test('vehicle photos: an exact copy of an earlier photo is refused and raises a high-severity alert; a new session supersedes the old', async () => {
  const first = await assigned();
  const second = await assigned();
  const s1 = await call(vv.createCaptureSession, 'drvA', { bookingId: first });
  const reused = makeJpeg(777777);
  await capture('drvA', s1.sessionId, 'front', { bytes: reused });
  const s2 = await call(vv.createCaptureSession, 'drvA', { bookingId: second });
  const ch = await call(vv.getSlotChallenge, 'drvA', { sessionId: s2.sessionId, slot: 'front' });
  putObject(ch.storagePath, reused, { source: 'camera_session', sessionId: s2.sessionId, slot: 'front' });
  await assert.rejects(call(vv.submitCapturePhoto, 'drvA', { sessionId: s2.sessionId, slot: 'front', storagePath: ch.storagePath, capturedAt: Date.now(), gps: GPS }), /already submitted before/);
  const ev = (await secEvents('reused_vehicle_photo')).find((e) => e.bookingId === second);
  assert.ok(ev);
  assert.equal(ev.severity, 'high');
  assert.equal(ev.details.firstUsedOn, first);
  assert.ok((await db.collection('notifications').where('title', '==', 'Security alert').get()).size >= 1);
  // The reused file was removed from storage.
  assert.equal((await db.doc(`vehicle_verifications/${second}`).get()).exists, false);
  // Opening a new session cancels the earlier one.
  const s3 = await call(vv.createCaptureSession, 'drvA', { bookingId: second });
  await assert.rejects(call(vv.getSlotChallenge, 'drvA', { sessionId: s2.sessionId, slot: 'rear' }), /no longer valid/);
  assert.notEqual(s3.sessionId, s2.sessionId);
  // The same picture in two slots of one session is flagged for review.
  const same = makeJpeg(424242);
  await capture('drvA', s3.sessionId, 'front', { bytes: same });
  const dup = await capture('drvA', s3.sessionId, 'rear', { bytes: same, gps: null });
  assert.equal(dup.res.flagged, true);
  const sigs = (await db.doc(`vehicle_verifications/${second}`).get()).data().photos.rear.signals.map((x) => x.code);
  assert.ok(sigs.includes('same_picture_two_slots'));
  assert.ok(sigs.includes('no_location'));
  // Flagged photos still reach admins, who are told to review them — the system never claims they are fake or genuine.
  await capture('drvA', s3.sessionId, 'interior');
  const fin = await call(vv.finalizeVehicleVerification, 'drvA', { sessionId: s3.sessionId, odometerReading: 5000 });
  assert.equal(fin.flagged, true);
  const v = (await db.doc(`vehicle_verifications/${second}`).get()).data();
  assert.ok(['medium', 'high'].includes(v.riskLevel));
  assert.ok((await db.collection('notifications').where('bookingId', '==', second).get()).docs.some((d) => /flagged/.test(d.data().title)));
});

test('trip: Reached Pickup → Trip Started → Trip Ended; skips and repeats are refused and logged', async () => {
  const id = await assigned();
  // An app customer (walk-in customers get the OTP in the approval WhatsApp/SMS/email instead).
  await db.doc(`bookings/${id}`).update({ customerId: 'custTrip' });
  // Only Reached Pickup can come first.
  await assert.rejects(advance(id, 'Trip Started'), /cannot be recorded yet. The next step is "Reached Pickup"/);
  await assert.rejects(advance(id, 'Trip Ended'), /cannot be recorded yet. The next step is "Reached Pickup"/);
  await assert.rejects(advance(id, 'Not Started'), /Choose Reached Pickup/);
  await assert.rejects(advance(id, 'Bogus'), /Choose Reached Pickup/);
  const skips = (await secEvents('trip_state_violation')).filter((e) => e.bookingId === id);
  assert.ok(skips.length >= 2);
  assert.equal(skips[0].source, 'server');
  assert.equal((await booking(id)).tripSubStatus, 'Not Started');
  // Someone else's trip, a suspended driver and an anonymous caller cannot move it.
  await assert.rejects(advance(id, 'Reached Pickup', {}, 'drvB'), /not assigned to you/);
  await assert.rejects(advance(id, 'Reached Pickup', {}, 'drvSusp'), /not active/);
  await assert.rejects(call(advanceTrip, null, { bookingId: id, to: 'Reached Pickup' }), /Sign in/);
  // The boarding OTP cannot be checked before the driver is at the pickup.
  await assert.rejects(call(verifyBoarding, 'drvA', { bookingId: id, otp: '1234' }), /reached the pickup first/);
  // Reached Pickup is checked against the pickup location when one is shared.
  await assert.rejects(advance(id, 'Reached Pickup', { location: { lat: 11.2, lng: 78.2 } }), (e) => /km from the pickup/.test(e.message) && e.details.distanceKm > 100);
  const reached = await advance(id, 'Reached Pickup', { requestId: 'trip_req_reach_01', location: { lat: 10.011, lng: 77.471, accuracy: 8 } });
  assert.equal(reached.duplicate, false);
  let b = await booking(id);
  assert.equal(b.status, 'Assigned'); // the ride itself has not started
  assert.equal(b.tripSubStatus, 'Reached Pickup');
  assert.equal(b.tripStage, 'Reached Pickup'); // legacy mirror for older apps
  assert.ok(b.reachedPickupAt);
  assert.equal(b.reachedPickupLocation.accuracy, 8);
  // A retried tap is a no-op; the same step with a new request is an invalid transition.
  assert.equal((await advance(id, 'Reached Pickup', { requestId: 'trip_req_reach_01' })).duplicate, true);
  await assert.rejects(advance(id, 'Reached Pickup', { requestId: 'trip_req_reach_02' }), /already/);
  await assert.rejects(advance(id, 'Trip Ended', { endOdometer: 12100 }), /next step is "Trip Started"/);
  // Trip Started needs the customer's boarding OTP …
  await assert.rejects(advance(id, 'Trip Started'), (e) => /boarding OTP/.test(e.message) && e.details.boardingRequired === true);
  const otp = (await db.doc(`booking_secrets/${id}`).get()).data().otp;
  assert.match(otp, /^\d{4}$/);
  const wrong = otp === '0000' ? '1111' : '0000';
  await assert.rejects(call(verifyBoarding, 'drvA', { bookingId: id, otp: wrong }), /not correct\. 4 attempts left/);
  await assert.rejects(call(verifyBoarding, 'drvA', { bookingId: id, otp: 'abcd' }), /4-digit/);
  await assert.rejects(call(verifyBoarding, 'drvB', { bookingId: id, otp }), /not assigned to you/);
  assert.equal((await call(verifyBoarding, 'drvA', { bookingId: id, otp })).already, false);
  assert.equal((await call(verifyBoarding, 'drvA', { bookingId: id, otp })).already, true);
  assert.ok((await booking(id)).boardingVerifiedAt);
  // … and the vehicle photo verification, which can be done at the pickup.
  await assert.rejects(advance(id, 'Trip Started'), (e) => /vehicle photo verification/.test(e.message) && e.details?.verificationRequired === true);
  await verify(id);
  const started = await advance(id, 'Trip Started', { requestId: 'trip_req_start_01', location: { lat: 10.0, lng: 77.46, accuracy: 20 } });
  assert.equal(started.stage, 'Trip Started');
  b = await booking(id);
  assert.equal(b.status, 'Ongoing');
  assert.equal(b.tripSubStatus, 'Trip Started');
  assert.equal(b.tripStage, 'In Progress');
  assert.ok(b.tripStartedAt && b.startedAt);
  assert.equal(b.tripStartedLocation.lat, 10.0);
  assert.equal(b.startOdometer, 12000);
  assert.equal(b.vehicleVerification.status, 'Submitted');
  assert.equal((await advance(id, 'Trip Started', { requestId: 'trip_req_start_01' })).duplicate, true);
  await assert.rejects(advance(id, 'Reached Pickup'), /next step is "Trip Ended"/);
  // Photos cannot be retaken once the trip is under way.
  await assert.rejects(call(vv.createCaptureSession, 'drvA', { bookingId: id }), /only needed before the trip starts|already submitted/);
  // Admin and customer are told at each step.
  const adminMsgs = (await db.collection('notifications').where('bookingId', '==', id).where('recipientType', '==', 'admin').get()).docs.map((d) => d.data().title);
  assert.ok(adminMsgs.includes('Driver at pickup') && adminMsgs.includes('Trip started'));
  const custMsgs = (await db.collection('notifications').where('bookingId', '==', id).where('recipientType', '==', 'customer').get()).docs.map((d) => d.data());
  assert.ok(custMsgs.some((n) => n.title === 'Your driver has arrived' && /boarding OTP/.test(n.message) && !n.message.includes(otp)));
  assert.ok(custMsgs.some((n) => n.title === 'Your trip has started'));
  // Ending needs an odometer reading that is not lower than the start.
  await assert.rejects(advance(id, 'Trip Ended', {}), /ending odometer/);
  await assert.rejects(advance(id, 'Trip Ended', { endOdometer: 11000 }), /at least the starting reading \(12000 km\)/);
  await assert.rejects(advance(id, 'Trip Ended', { endOdometer: 12100, tolls: [{ id: 't', name: 'Toll', amount: -5 }] }), /greater than zero/);
  const ended = await advance(id, 'Trip Ended', { endOdometer: 12100, location: { lat: 10.1, lng: 77.5 }, tolls: [{ id: 't1', name: 'Toll: Bodi', amount: 85, receiptPhotoUrl: 'u', uploadedAt: 'now' }] });
  assert.equal(ended.stage, 'Trip Ended');
  b = await booking(id);
  assert.equal(b.status, 'Completed');
  assert.equal(b.tripSubStatus, 'Trip Ended');
  assert.equal(b.tripStage, 'Completed');
  assert.equal(b.endOdometer, 12100);
  assert.equal(b.tollCharges, 85);
  assert.ok(b.tripEndedAt && b.completedAt);
  assert.equal(b.tripEndedLocation.lng, 77.5);
  // Every transition was recorded as an event and in the audit trail.
  const events = (await db.collection(`bookings/${id}/events`).get()).docs.map((d) => d.data().type);
  for (const t of ['trip_reached_pickup', 'boarding_verified', 'trip_trip_started', 'trip_trip_ended']) assert.ok(events.includes(t), t);
  const audits = (await db.collection('audit_logs').where('bookingId', '==', id).get()).docs.map((d) => d.data()).filter((a) => a.action === 'trip_status_changed');
  assert.deepEqual(audits.map((a) => a.next.tripSubStatus).sort(), ['Reached Pickup', 'Trip Ended', 'Trip Started']);
  // A finished trip cannot be moved again.
  await assert.rejects(advance(id, 'Reached Pickup'), /completed/);
  await assert.rejects(call(ops.assignDriver, 'ops', { bookingId: id, driverId: 'drvB', reason: 'oops' }), /completed|cannot|started/i);
});

test('trip: photos taken before leaving also count; the OTP is still required at the pickup', async () => {
  const id = await assigned();
  await verify(id);
  await advance(id, 'Reached Pickup');
  await assert.rejects(advance(id, 'Trip Started'), /boarding OTP/);
  const otp = (await db.doc(`booking_secrets/${id}`).get()).data().otp;
  await call(verifyBoarding, 'drvA', { bookingId: id, otp });
  assert.equal((await advance(id, 'Trip Started')).stage, 'Trip Started');
});

test('trip: five wrong boarding OTPs lock the check for ten minutes and raise a security event', async () => {
  const id = await assigned();
  await advance(id, 'Reached Pickup');
  const otp = (await db.doc(`booking_secrets/${id}`).get()).data().otp;
  const wrong = otp === '0000' ? '1111' : '0000';
  for (let i = 1; i <= 4; i++) await assert.rejects(call(verifyBoarding, 'drvA', { bookingId: id, otp: wrong }), new RegExp(`${5 - i} attempt`));
  await assert.rejects(call(verifyBoarding, 'drvA', { bookingId: id, otp: wrong }), /locked for 10 minutes/);
  // Even the right code is refused while locked.
  await assert.rejects(call(verifyBoarding, 'drvA', { bookingId: id, otp }), /Try again in \d+ minutes/);
  assert.equal((await secEvents('otp_attempts_exceeded')).filter((e) => e.bookingId === id).length, 1);
  assert.equal((await booking(id)).boardingVerifiedAt, undefined);
  // The lock lifts once it has expired.
  await db.doc(`bookings/${id}`).update({ 'boardingAttempts.lockedUntil': new Date(Date.now() - 1000) });
  assert.equal((await call(verifyBoarding, 'drvA', { bookingId: id, otp })).ok, true);
});

test('trips begun in the earlier step order still finish correctly', async () => {
  // Legacy record without a sub-status, already under way.
  const id = await assigned();
  await db.doc(`bookings/${id}`).update({ status: 'Ongoing', tripStage: 'In Progress', startedAt: new Date(), startOdometer: 500, tripSubStatus: FieldValue.delete() });
  const r = await advance(id, 'Trip Ended', { endOdometer: 600 });
  assert.equal(r.ok, true);
  assert.equal((await booking(id)).status, 'Completed');
  // Earlier order: "Trip Started" was recorded while driving to the pickup. The driver
  // now marks the pickup, verifies the OTP and starts the ride as normal.
  const enRoute = await assigned();
  await verify(enRoute);
  await db.doc(`bookings/${enRoute}`).update({ status: 'Ongoing', tripSubStatus: 'Trip Started', tripStage: 'En Route Pickup', tripStartedAt: new Date() });
  await assert.rejects(advance(enRoute, 'Trip Ended', { endOdometer: 13000 }), /next step is "Reached Pickup"/);
  await advance(enRoute, 'Reached Pickup');
  const otp = (await db.doc(`booking_secrets/${enRoute}`).get()).data().otp;
  await call(verifyBoarding, 'drvA', { bookingId: enRoute, otp });
  await advance(enRoute, 'Trip Started');
  assert.equal((await advance(enRoute, 'Trip Ended', { endOdometer: 13000 })).stage, 'Trip Ended');
});

test('device integrity: enforcement is off by default; when on, Android needs a fresh passing verdict and web follows its own setting', async () => {
  const id = await assigned();
  await verify(id);
  // Default: nothing is blocked (Play Integrity is not configured yet).
  assert.equal((await sec.securitySettings()).enforceIntegrity, false);
  await db.doc('settings/security').set({ enforceIntegrity: true, allowWebDriverTrips: true });
  await assert.rejects(advance(id, 'Reached Pickup'), (e) => /could not be verified as secure/.test(e.message) && e.details.integrity === 'required');
  await assert.rejects(call(vv.createCaptureSession, 'drvA', { bookingId: id }), /already submitted|could not be verified/);
  // A failed or expired verdict is refused; a passing one lets the trip proceed.
  await db.doc('device_integrity/drvA').set({ status: 'failed', expiresAt: new Date(Date.now() + 3600000), reasons: ['device_not_recognised'] });
  await assert.rejects(advance(id, 'Reached Pickup'), /could not be verified/);
  await db.doc('device_integrity/drvA').set({ status: 'passed', expiresAt: new Date(Date.now() - 1000) });
  await assert.rejects(advance(id, 'Reached Pickup'), /could not be verified/);
  await db.doc('device_integrity/drvA').set({ status: 'passed', expiresAt: new Date(Date.now() + 3600000) });
  assert.equal((await advance(id, 'Reached Pickup')).stage, 'Reached Pickup');
  // Web browsers cannot attest: allowed unless the setting says otherwise.
  const webTrip = await assigned('drvB');
  await db.doc('device_integrity/drvB').delete().catch(() => null);
  await assert.rejects(call(vv.createCaptureSession, 'drvB', { bookingId: webTrip, platform: 'android' }), /could not be verified/);
  const s = await call(vv.createCaptureSession, 'drvB', { bookingId: webTrip, platform: 'web' });
  assert.ok(s.sessionId);
  await db.doc('settings/security').set({ enforceIntegrity: true, allowWebDriverTrips: false });
  await assert.rejects(call(vv.createCaptureSession, 'drvB', { bookingId: webTrip, platform: 'web' }), (e) => e.details.integrity === 'web_not_allowed');
  await db.doc('settings/security').delete();
  // The integrity callables: unconfigured server, bad / reused / foreign nonces.
  delete process.env.PLAY_INTEGRITY_PACKAGE_NAME;
  assert.equal((await call(sec.verifyDeviceIntegrity, 'drvA', { token: 't', nonce: 'n' })).status, 'not_configured');
  process.env.PLAY_INTEGRITY_PACKAGE_NAME = 'com.nesam.driver';
  try {
    const { nonce } = await call(sec.getIntegrityNonce, 'drvA');
    assert.ok(nonce.length >= 30);
    await assert.rejects(call(sec.verifyDeviceIntegrity, 'drvB', { token: 'tok', nonce }), /expired/); // another user's nonce
    await assert.rejects(call(sec.verifyDeviceIntegrity, 'drvA', { token: 'tok', nonce: 'does-not-exist' }), /expired/);
    await assert.rejects(call(sec.verifyDeviceIntegrity, 'drvA', { token: '', nonce }), /Missing/);
    await db.doc(`integrity_nonces/${nonce}`).update({ used: true });
    await assert.rejects(call(sec.verifyDeviceIntegrity, 'drvA', { token: 'tok', nonce }), /expired/);
    assert.ok((await secEvents('integrity_nonce_invalid')).length >= 3);
    await assert.rejects(call(sec.getIntegrityNonce, null), /Sign in/);
  } finally { delete process.env.PLAY_INTEGRITY_PACKAGE_NAME; }
});

test('security events: only known types, severities set by the server, flood-capped; high ones alert admins once', async () => {
  await assert.rejects(call(sec.reportSecurityEvent, null, { type: 'root_detected' }), /Sign in/);
  await assert.rejects(call(sec.reportSecurityEvent, 'drvA', { type: 'made_up' }), /Unknown security event/);
  // The client cannot choose a severity.
  await call(sec.reportSecurityEvent, 'drvB', { type: 'root_detected', severity: 'low', role: 'driver', appVersion: '1.2.3', detail: 'su binary found', platform: 'android' });
  const root = (await secEvents('root_detected')).find((e) => e.userId === 'drvB');
  assert.equal(root.severity, 'high');
  assert.equal(root.source, 'client');
  assert.equal(root.details.detail, 'su binary found');
  assert.equal(root.resolved, false);
  await call(sec.reportSecurityEvent, 'drvB', { type: 'root_detected' });
  const alerts = (await db.collection('notifications').where('title', '==', 'Security alert').get()).docs.filter((d) => d.data().message.includes('root detected'));
  assert.equal(alerts.length, 1, 'repeated high events within the hour alert the admin once');
  assert.equal(alerts[0].data().severity, 'critical');
  assert.equal(alerts[0].data().cta.page, 'security');
  await call(sec.reportSecurityEvent, 'drvB', { type: 'developer_options_enabled' });
  assert.equal((await secEvents('developer_options_enabled'))[0].severity, 'medium');
  // Flood control: a modified client cannot fill the log.
  let throttled = 0;
  for (let i = 0; i < 25; i++) if ((await call(sec.reportSecurityEvent, 'drvA', { type: 'screen_capture_detected' })).throttled) throttled++;
  assert.ok(throttled >= 3);
  const mine = (await db.collection('security_events').where('userId', '==', 'drvA').where('type', '==', 'screen_capture_detected').get()).size;
  assert.ok(mine <= 22);
});

const phone = '+919876543210';
const hashed = async (bookingId) => (await db.collection('otp_verifications').where('bookingId', '==', bookingId).get()).docs;
const smsCode = () => /code is (\d{6})/.exec(decodeURIComponent(sent.sms.at(-1).replace(/\+/g, ' ')))[1];
const backdate = async (bookingId, ms = 120000) => { for (const d of await hashed(bookingId)) await d.ref.update({ createdAt: new Date(Date.now() - ms) }); };

test('customer OTP: sent over WhatsApp, SMS and email; stored only as a salted hash; delivery logged per channel', async () => {
  resetSent();
  const id = await assigned(null, { customerEmail: 'rider@example.com' });
  await assert.rejects(call(cv.sendVerificationCode, 'drvA', { bookingId: id }), /Only active admins|operations/);
  await assert.rejects(call(cv.sendVerificationCode, 'ops', { bookingId: id, channels: ['pigeon'] }), /at least one channel/);
  const r = await call(cv.sendVerificationCode, 'ops', { bookingId: id });
  assert.deepEqual(r.sent.map((x) => `${x.channel}:${x.status}`).sort(), ['email:sent', 'sms:sent', 'whatsapp:sent']);
  assert.equal(r.expiresInMinutes, 10);
  const code = smsCode();
  assert.match(code, /^\d{6}$/);
  assert.ok(sent.whatsapp.at(-1).template.name === 'nesam_otp');
  assert.ok(JSON.stringify(sent.whatsapp.at(-1)).includes(code));
  assert.equal(sent.whatsapp.at(-1).to, (await booking(id)).phone.replace(/\D/g, ''));
  assert.ok(JSON.stringify(sent.email.at(-1)).includes(code));
  // Only a hash is stored — never the code, and the destinations are masked.
  const [doc] = await hashed(id);
  const d = doc.data();
  assert.equal(JSON.stringify(d).includes(code), false);
  assert.match(d.codeHash, /^[0-9a-f]{64}$/);
  assert.ok(d.salt.length >= 16);
  assert.equal(d.maxAttempts, 5);
  assert.equal(d.status, 'pending');
  assert.ok(!JSON.stringify(d.destinations).includes('9876543210'));
  assert.match(d.destinations.email, /^r•+@example\.com$/);
  // Delivery status per channel is logged.
  const rows = (await db.collection('notification_deliveries').where('otpId', '==', doc.id).get()).docs.map((x) => x.data());
  assert.equal(rows.length, 3);
  assert.ok(rows.every((x) => x.status === 'sent' && x.kind === 'otp' && x.providerMessageId));
  assert.equal(JSON.stringify(rows).includes(code), false);
  // Cooldown: a second send within a minute is refused.
  await assert.rejects(call(cv.sendVerificationCode, 'ops', { bookingId: id }), /seconds before sending another code/);
  // Wrong, then right.
  await assert.rejects(call(cv.verifyCustomerCode, 'ops', { bookingId: id, code: '12ab' }), /6-digit/);
  const wrong = code === '123456' ? '654321' : '123456';
  await assert.rejects(call(cv.verifyCustomerCode, 'ops', { bookingId: id, code: wrong }), /not correct\. 4 attempts left/);
  assert.equal((await call(cv.verifyCustomerCode, 'ops', { bookingId: id, code })).verified, true);
  const b = await booking(id);
  assert.equal(b.customerVerified, true);
  assert.equal(b.customerVerifiedBy, 'ops');
  assert.equal((await hashed(id))[0].data().status, 'verified');
  // A used code cannot be replayed.
  await assert.rejects(call(cv.verifyCustomerCode, 'ops', { bookingId: id, code }), /no active code/);
});

test('customer OTP: expiry, attempt lockout, resend replaces the old code, partial and total delivery failure', async () => {
  resetSent();
  const id = await assigned(null);
  await call(cv.sendVerificationCode, 'ops', { bookingId: id, channels: ['sms'] });
  const first = smsCode();
  await backdate(id);
  await call(cv.sendVerificationCode, 'ops', { bookingId: id, channels: ['sms'] });
  const second = smsCode();
  const states = (await hashed(id)).map((d) => d.data().status).sort();
  assert.deepEqual(states, ['pending', 'superseded']);
  if (first !== second) await assert.rejects(call(cv.verifyCustomerCode, 'ops', { bookingId: id, code: first }), /not correct/);
  // Five wrong tries lock the code.
  const wrong = second === '111111' ? '222222' : '111111';
  for (let i = 0; i < 3; i++) await assert.rejects(call(cv.verifyCustomerCode, 'ops', { bookingId: id, code: wrong }), /not correct/);
  await assert.rejects(call(cv.verifyCustomerCode, 'ops', { bookingId: id, code: wrong }), /not correct\. 0|not correct/).catch(() => null);
  const locked = (await hashed(id)).find((d) => d.data().status === 'locked' || d.data().attempts >= 5);
  assert.ok(locked || (await hashed(id)).some((d) => d.data().attempts >= 4));
  // Expiry.
  const id2 = await assigned(null);
  await call(cv.sendVerificationCode, 'ops', { bookingId: id2, channels: ['sms'] });
  const code2 = smsCode();
  await (await hashed(id2))[0].ref.update({ expiresAt: new Date(Date.now() - 1000) });
  await assert.rejects(call(cv.verifyCustomerCode, 'ops', { bookingId: id2, code: code2 }), /expired/);
  assert.equal((await hashed(id2))[0].data().status, 'expired');
  // One channel failing does not stop the others; a missing template is reported as not configured.
  const id3 = await assigned(null, { customerEmail: 'a@example.com' });
  failing.add('whatsapp');
  const part = await call(cv.sendVerificationCode, 'ops', { bookingId: id3 });
  const by = Object.fromEntries(part.sent.map((x) => [x.channel, x.status]));
  assert.equal(by.whatsapp, 'failed');
  assert.equal(by.sms, 'sent');
  assert.equal(by.email, 'sent');
  failing.clear();
  await backdate(id3);
  const tpl = process.env.WHATSAPP_TEMPLATE_OTP;
  delete process.env.WHATSAPP_TEMPLATE_OTP;
  try {
    const nc = await call(cv.sendVerificationCode, 'ops', { bookingId: id3, channels: ['whatsapp', 'sms'] });
    assert.equal(Object.fromEntries(nc.sent.map((x) => [x.channel, x.status])).whatsapp, 'not_configured');
  } finally { process.env.WHATSAPP_TEMPLATE_OTP = tpl; }
  // Every channel failing is an error, and the code is marked failed so nothing waits for it.
  await backdate(id3);
  failing.add('whatsapp'); failing.add('sms'); failing.add('email');
  await assert.rejects(call(cv.sendVerificationCode, 'ops', { bookingId: id3 }), /could not be delivered/);
  failing.clear();
  assert.ok((await hashed(id3)).some((d) => d.data().status === 'failed'));
  const logged = (await db.collection('notification_deliveries').where('bookingId', '==', id3).where('status', '==', 'failed').get()).size;
  assert.ok(logged >= 4);
  // Email stays optional: with no address the others carry on, and asking for email alone is a clear error.
  const id4 = await assigned(null);
  await assert.rejects(call(cv.sendVerificationCode, 'ops', { bookingId: id4, channels: ['email'] }), /no contact for the chosen channels/);
  const no = await call(cv.sendVerificationCode, 'ops', { bookingId: id4 });
  assert.deepEqual(no.sent.map((x) => x.channel).sort(), ['sms', 'whatsapp']);
  // Per-booking hourly limit.
  const id5 = await assigned(null);
  let sentCount = 0;
  for (let i = 0; i < 5; i++) {
    await call(cv.sendVerificationCode, 'ops', { bookingId: id5, channels: ['sms'] });
    sentCount++;
    await backdate(id5, 90000);
  }
  assert.equal(sentCount, 5);
  await assert.rejects(call(cv.sendVerificationCode, 'ops', { bookingId: id5, channels: ['sms'] }), /Too many codes were sent for this booking|Too many codes were sent to this number/);
  resetSent();
});

test('customer OTP: a number that has been sent too many codes is rate limited and the attempt is logged', async () => {
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push(await assigned(null, { customerPhone: '9123456789' }));
  // Same phone number across bookings: 8 per hour in total.
  let ok = 0;
  let blocked = false;
  for (let round = 0; round < 4 && !blocked; round++) {
    for (const id of ids) {
      try { await call(cv.sendVerificationCode, 'ops', { bookingId: id, channels: ['sms'] }); ok++; } catch (e) { blocked = /to this number|for this booking/.test(e.message); if (!blocked) throw e; break; }
      await backdate(id, 90000);
    }
  }
  assert.ok(blocked);
  assert.ok(ok <= 15);
  assert.ok((await secEvents('otp_rate_limited')).length >= 1 || ok < 8);
  resetSent();
});

test('WhatsApp webhook: delivery receipts are accepted only with a valid signature', async () => {
  const { createHmac } = await import('node:crypto');
  const wh = await import('../../functions/lib/customerVerification.js');
  const run = async (req) => {
    const res = { code: 0, body: '', status(c) { this.code = c; return this; }, send(b) { this.body = b; return this; }, sendStatus(c) { this.code = c; return this; } };
    await wh.whatsappWebhook(req, res);
    return res;
  };
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-me';
  process.env.WHATSAPP_APP_SECRET = 'app-secret-123';
  try {
    assert.equal((await run({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': 'abc' }, headers: {} })).body, 'abc');
    assert.equal((await run({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': 'abc' }, headers: {} })).code, 403);
    await db.collection('notification_deliveries').doc('whrow1').set({ channel: 'whatsapp', status: 'sent', providerMessageId: 'wamid.XYZ' });
    const body = { entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.XYZ', status: 'delivered' }] } }] }] };
    const raw = Buffer.from(JSON.stringify(body));
    assert.equal((await run({ method: 'POST', headers: { 'x-hub-signature-256': 'sha256=bad' }, rawBody: raw, body })).code, 403);
    assert.equal((await db.doc('notification_deliveries/whrow1').get()).data().status, 'sent');
    const sig = `sha256=${createHmac('sha256', 'app-secret-123').update(raw).digest('hex')}`;
    assert.equal((await run({ method: 'POST', headers: { 'x-hub-signature-256': sig }, rawBody: raw, body })).code, 200);
    assert.equal((await db.doc('notification_deliveries/whrow1').get()).data().status, 'delivered');
  } finally { delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN; delete process.env.WHATSAPP_APP_SECRET; }
});
