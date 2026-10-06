// Driver trip workflow, validated on the server:
//   Trip Started  →  Reached Pickup  →  Trip Ended
// Only the next step is accepted, every step is stamped and (with permission)
// geo-tagged, a repeated tap is a no-op, and an attempt to skip a step is
// refused and logged as a security event. The customer's boarding OTP is
// verified at the pickup (verifyBoarding) and is required before Trip Ended.
// Clients cannot write status or stage fields directly (firestore.rules).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { timingSafeEqual } from 'crypto';
import { db } from './admin';
import { auditInTx } from './audit';
import { LEGACY_STAGE_FOR, TRIP_SUB_STATUSES, TripSubStatus, tripStageBlocker, tripSubStatusOf } from './domain/bookingFlow';
import { distanceKm } from './domain/verification';
import { formatDateTime12 } from './domain/time';
import { notifyInTx, pushAfterCommit, NotifyInput } from './notify';
import { assertDeviceTrusted, logSecurityEvent, requestIp } from './security';
import { approved, inIndia, text } from './shared';

const PICKUP_RADIUS_KM = 2;
const MAX_TOLLS = 50000;
const BOARDING_MAX_ATTEMPTS = 5;
const BOARDING_LOCK_MS = 10 * 60000;

const docId = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(v)) throw new HttpsError('invalid-argument', `Invalid ${what}.`);
  return v;
};

interface Fix { lat: number; lng: number; accuracy: number | null }

function fixOf(v: unknown): Fix | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!inIndia(o.lat, o.lng)) return null;
  return { lat: o.lat as number, lng: o.lng as number, accuracy: typeof o.accuracy === 'number' && Number.isFinite(o.accuracy) ? Math.round(o.accuracy) : null };
}

async function activeDriver(uid: string | undefined) {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const d = await db.doc(`drivers/${uid}`).get();
  const p = d.data();
  if (!d.exists || !p || !approved(p.status) || p.fleetStatus === 'Suspended') throw new HttpsError('permission-denied', 'Your driver account is not active.');
  return { uid, name: text(p.name) };
}

interface TollIn { id: string; name: string; amount: number; receiptPhotoUrl: string; uploadedAt: string }

function tollsOf(v: unknown): TollIn[] {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > 20) throw new HttpsError('invalid-argument', 'Too many toll receipts.');
  const out = v.map((t: any) => {
    const amount = t?.amount;
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_TOLLS) throw new HttpsError('invalid-argument', 'Each toll amount must be greater than zero.');
    return { id: text(t.id, 60) || `TOLL-${Date.now()}`, name: text(t.name, 80), amount, receiptPhotoUrl: text(t.receiptPhotoUrl, 600), uploadedAt: text(t.uploadedAt, 40) };
  });
  if (out.reduce((s, t) => s + t.amount, 0) > MAX_TOLLS) throw new HttpsError('invalid-argument', `Toll charges cannot exceed ₹${MAX_TOLLS.toLocaleString('en-IN')}.`);
  return out;
}

export const advanceTrip = onCall({ timeoutSeconds: 60 }, async (request) => {
  const input = request.data ?? {};
  const driver = await activeDriver(request.auth?.uid);
  const bookingId = docId(input.bookingId, 'booking');
  const to = input.to as TripSubStatus;
  if (!(TRIP_SUB_STATUSES as readonly string[]).includes(to) || to === 'Not Started') throw new HttpsError('invalid-argument', 'Choose Trip Started, Reached Pickup or Trip Ended.');
  const platform = text(input.platform, 12) || 'android';
  const requestId = text(input.requestId, 100);
  const fix = fixOf(input.location);
  await assertDeviceTrusted(driver.uid, platform);

  const ref = db.doc(`bookings/${bookingId}`);
  const pushes: { id: string; input: NotifyInput }[] = [];
  let violation = '';
  const result = await db.runTransaction(async (tx) => {
    pushes.length = 0;
    violation = '';
    const [snap, verification] = await Promise.all([tx.get(ref), to === 'Trip Started' ? tx.get(db.doc(`vehicle_verifications/${bookingId}`)) : Promise.resolve(null)]);
    if (!snap.exists) throw new HttpsError('not-found', 'This trip no longer exists.');
    const b = snap.data()!;
    if (b.assignedDriverId !== driver.uid) throw new HttpsError('permission-denied', 'This trip is not assigned to you.');
    if (['Cancelled', 'Rejected', 'Completed'].includes(b.status)) throw new HttpsError('failed-precondition', `This trip is ${String(b.status).toLowerCase()}.`);
    const current = tripSubStatusOf(b);
    // A repeated tap or retry of the same request changes nothing.
    if (current === to && requestId && b.lastTripRequestId === requestId) return { ok: true, duplicate: true, stage: to };
    const blocker = tripStageBlocker(current, to);
    if (blocker) { violation = blocker; throw new HttpsError('failed-precondition', blocker); }

    const stamp = FieldValue.serverTimestamp();
    const geo = fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, at: Timestamp.now() } : null;
    const base = { tripSubStatus: to, tripStage: LEGACY_STAGE_FOR[to], lastTripRequestId: requestId, updatedAt: stamp };
    let update: Record<string, unknown>;
    let adminMsg = '';
    const label = text(b.bookingId) || bookingId;

    if (to === 'Trip Started') {
      if (!['Assigned', 'Confirmed'].includes(b.status)) throw new HttpsError('failed-precondition', 'This trip cannot be started in its current state.');
      const v = verification!.data();
      if (!verification!.exists || !v || v.driverId !== driver.uid || v.status !== 'Submitted') {
        throw new HttpsError('failed-precondition', 'Complete the vehicle photo verification before starting the trip.', { verificationRequired: true });
      }
      update = {
        ...base, status: 'Ongoing', tripStartedAt: stamp, startedAt: stamp, tripStartedLocation: geo,
        startOdometer: v.odometerReading ?? FieldValue.delete(),
        vehicleVerification: { status: 'Submitted', riskLevel: v.riskLevel ?? 'low', flagged: v.flagged === true, submittedAt: v.submittedAt ?? null },
      };
      adminMsg = `Trip ${label} started by ${driver.name}.`;
    } else if (to === 'Reached Pickup') {
      if (b.status !== 'Ongoing') throw new HttpsError('failed-precondition', 'Start the trip first.');
      let locationNote = '';
      if (fix && Number.isFinite(b.pickupLat) && Number.isFinite(b.pickupLng)) {
        const d = distanceKm(fix, { lat: b.pickupLat, lng: b.pickupLng });
        if (d > PICKUP_RADIUS_KM) throw new HttpsError('failed-precondition', `You are ${d.toFixed(1)} km from the pickup point. Move within ${PICKUP_RADIUS_KM} km to continue.`, { distanceKm: Math.round(d * 10) / 10 });
      } else locationNote = 'location_unavailable';
      update = { ...base, reachedPickupAt: stamp, reachedPickupLocation: geo, ...(locationNote ? { reachedPickupLocationNote: locationNote } : {}), boardingVerifiedAt: FieldValue.delete() };
      adminMsg = `${driver.name} reached the pickup for ${label}.`;
    } else {
      if (b.status !== 'Ongoing') throw new HttpsError('failed-precondition', 'This trip is not in progress.');
      const legacy = Boolean(b.startedAt) && !b.tripStartedAt; // boarding OTP was checked at start in the older flow
      if (!b.boardingVerifiedAt && !legacy) throw new HttpsError('failed-precondition', "Verify the customer's boarding OTP before ending the trip.", { boardingRequired: true });
      const end = input.endOdometer;
      const start = typeof b.startOdometer === 'number' ? b.startOdometer : 0;
      if (!Number.isFinite(end) || end <= 0) throw new HttpsError('invalid-argument', 'Enter the ending odometer reading.');
      if (end < start) throw new HttpsError('invalid-argument', `The ending reading must be at least the starting reading (${start} km).`);
      const tolls = tollsOf(input.tolls);
      update = {
        ...base, status: 'Completed', tripEndedAt: stamp, completedAt: stamp, tripEndedLocation: geo, endOdometer: end,
        tolls, tollCharges: tolls.reduce((s, t) => s + t.amount, 0),
      };
      adminMsg = `Trip ${label} completed by ${driver.name}.`;
    }
    tx.update(ref, update);
    tx.create(ref.collection('events').doc(), { type: `trip_${to.toLowerCase().replace(/\s+/g, '_')}`, actorId: driver.uid, actorRole: 'driver', location: geo, at: stamp });
    auditInTx(tx, {
      action: 'trip_status_changed', entity: 'booking', entityId: bookingId, performedBy: driver.uid, performedByName: driver.name, role: 'driver', bookingId,
      previous: { tripSubStatus: current, status: b.status }, next: { tripSubStatus: to, status: (update.status as string) ?? b.status }, meta: { located: !!geo, platform },
    });
    const admin: NotifyInput = {
      recipientType: 'admin', recipientId: 'admin', category: 'trips', severity: to === 'Trip Ended' ? 'success' : 'info', sound: 'general',
      title: to === 'Trip Started' ? 'Trip started' : to === 'Reached Pickup' ? 'Driver at pickup' : 'Trip completed', message: `${adminMsg} ${formatDateTime12(new Date())}`,
      bookingId, bookingCode: label, cta: { label: 'Open trip', page: 'booking-detail', bookingId }, push: to === 'Trip Ended', sentBy: driver.uid,
    };
    pushes.push({ id: notifyInTx(tx, admin), input: admin });
    if (b.customerId) {
      const c: NotifyInput = {
        recipientType: 'customer', recipientId: b.customerId, category: 'trips', severity: 'info', sound: 'general', push: true, sentBy: driver.uid,
        title: to === 'Trip Started' ? 'Your driver is on the way' : to === 'Reached Pickup' ? 'Your driver has arrived' : 'Trip completed',
        message: to === 'Trip Started' ? `${driver.name} has started towards your pickup.` : to === 'Reached Pickup' ? `${driver.name} is at your pickup point. Share your boarding OTP.` : `Thank you for travelling with NESAM (${label}).`,
        bookingId, bookingCode: label,
      };
      pushes.push({ id: notifyInTx(tx, c), input: c });
    }
    return { ok: true, duplicate: false, stage: to };
  }).catch(async (err) => {
    if (violation) {
      await logSecurityEvent({ type: 'trip_state_violation', severity: 'medium', userId: driver.uid, role: 'driver', bookingId, platform, source: 'server', details: { attempted: to, reason: violation }, ip: requestIp(request) }).catch(() => null);
    }
    throw err;
  });
  await pushAfterCommit(pushes);
  return result;
});

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** The customer reads a 4-digit code to the driver at pickup. Five wrong tries lock the check for ten minutes. */
export const verifyBoarding = onCall(async (request) => {
  const driver = await activeDriver(request.auth?.uid);
  const bookingId = docId(request.data?.bookingId, 'booking');
  const otp = text(request.data?.otp, 8);
  if (!/^\d{4}$/.test(otp)) throw new HttpsError('invalid-argument', "Enter the 4-digit OTP from the customer's app or message.");
  const ref = db.doc(`bookings/${bookingId}`);
  let locked = false;
  const out = await db.runTransaction(async (tx) => {
    locked = false;
    const [snap, secret] = await Promise.all([tx.get(ref), tx.get(db.doc(`booking_secrets/${bookingId}`))]);
    if (!snap.exists) throw new HttpsError('not-found', 'This trip no longer exists.');
    const b = snap.data()!;
    if (b.assignedDriverId !== driver.uid) throw new HttpsError('permission-denied', 'This trip is not assigned to you.');
    if (b.status !== 'Ongoing' || tripSubStatusOf(b) !== 'Reached Pickup') throw new HttpsError('failed-precondition', 'Mark that you have reached the pickup first.');
    if (b.boardingVerifiedAt) return { ok: true, already: true };
    const attempts = b.boardingAttempts ?? { count: 0 };
    const lockedUntil = (attempts.lockedUntil as Timestamp | undefined)?.toMillis?.() ?? 0;
    if (lockedUntil > Date.now()) throw new HttpsError('resource-exhausted', `Too many wrong codes. Try again in ${Math.ceil((lockedUntil - Date.now()) / 60000)} minutes, or ask the customer to check the code.`);
    const expected = String(secret.data()?.otp ?? '');
    if (!expected) throw new HttpsError('failed-precondition', 'This booking has no boarding OTP. Contact NESAM support.');
    if (safeEqual(otp, expected)) {
      tx.update(ref, { boardingVerifiedAt: FieldValue.serverTimestamp(), boardingAttempts: { count: 0 }, updatedAt: FieldValue.serverTimestamp() });
      tx.create(ref.collection('events').doc(), { type: 'boarding_verified', actorId: driver.uid, actorRole: 'driver', at: FieldValue.serverTimestamp() });
      return { ok: true, already: false };
    }
    const count = (attempts.count ?? 0) + 1;
    locked = count >= BOARDING_MAX_ATTEMPTS;
    tx.update(ref, { boardingAttempts: { count: locked ? 0 : count, ...(locked ? { lockedUntil: Timestamp.fromMillis(Date.now() + BOARDING_LOCK_MS) } : {}) } });
    return { ok: false, remaining: Math.max(0, BOARDING_MAX_ATTEMPTS - count), locked };
  });
  if (locked) {
    await logSecurityEvent({ type: 'otp_attempts_exceeded', severity: 'medium', userId: driver.uid, role: 'driver', bookingId, source: 'server', details: { purpose: 'boarding' }, ip: requestIp(request) }).catch(() => null);
  }
  if (!out.ok) {
    throw new HttpsError('failed-precondition', locked ? 'Too many wrong codes. The check is locked for 10 minutes.' : `That code is not correct. ${out.remaining} attempt${out.remaining === 1 ? '' : 's'} left.`);
  }
  return out;
});
