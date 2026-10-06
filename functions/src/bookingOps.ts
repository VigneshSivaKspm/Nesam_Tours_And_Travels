// Admin booking operations, each validated against the booking state machine
// (domain/bookingFlow.ts) and written with an audit entry:
//   approveBooking · rejectBooking · cancelBooking · updateRefund
//   assignDriver (assign / reassign / remove, with a never-overwritten history)
//   acknowledgeUnassignedAlert · migrateMarketplaceVisibility
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { DocumentData, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from './admin';
import { audit, auditInTx } from './audit';
import { AWAITING_APPROVAL } from './bookingBuild';
import { sendCustomerMessage } from './customerComms';
import { assignableVehicle } from './marketplace';
import { REFUND_STATUSES, RefundStatus, maxRefund, refundBlocker, summarizePayments, transitionBlocker } from './domain/bookingFlow';
import { formatDateTime12, pickupInstant } from './domain/time';
import { notify, notifyInTx, pushAfterCommit, NotifyInput } from './notify';
import { txnsRef } from './bookingPayments';
import { approved, requireAdmin, requirePermission, requireSuperAdmin, text } from './shared';

const docId = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(v)) throw new HttpsError('invalid-argument', `Invalid ${what}.`);
  return v;
};
const money = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const code = (b: DocumentData, id: string) => text(b.bookingId) || id;

// ── Approve / reject ──────────────────────────────────────────────────────

/** Tell eligible approved partners an approved trip is available. Best effort, de-duplicated. */
async function announceToPartners(bookingId: string, b: DocumentData, offer: DocumentData): Promise<number> {
  const aliases: string[] = Array.isArray(offer.eligibleVehicleTypes) ? offer.eligibleVehicleTypes : [];
  const [drivers, vendors] = await Promise.all([
    db.collection('drivers').where('status', '==', 'Approved').where('presenceStatus', '==', 'Online').limit(300).get(),
    db.collection('vendors').where('status', 'in', ['APPROVED', 'Approved', 'Active']).limit(200).get(),
  ]);
  const when = pickupInstant(b);
  const base = {
    category: 'bookings' as const, severity: 'info' as const, sound: 'new_booking' as const, push: true,
    title: 'New trip available',
    message: `${text(b.pickup)} → ${text(b.drop)}${when ? ` · ${formatDateTime12(when)}` : ''} · ${text(b.vehicleCategory)} · payout ₹${money(offer.offeredPayout).toLocaleString('en-IN')}`,
    bookingId, bookingCode: code(b, bookingId), cta: { label: 'View trip', page: 'marketplace', bookingId },
  };
  const targets: { id: string; type: 'driver' | 'vendor' }[] = [
    ...drivers.docs
      .filter((d) => !d.data().vendorId && d.data().fleetStatus !== 'Suspended'
        && (!aliases.length || aliases.includes(String(d.data().vehicleType ?? '').trim().toLowerCase())))
      .map((d) => ({ id: d.id, type: 'driver' as const })),
    ...vendors.docs.map((v) => ({ id: v.id, type: 'vendor' as const })),
  ];
  let sent = 0;
  for (let i = 0; i < targets.length; i += 25) {
    await Promise.all(targets.slice(i, i + 25).map(async (t) => {
      const id = await notify({ ...base, recipientId: t.id, recipientType: t.type, dedupeKey: `trip_available_${bookingId}_${t.id}` }).catch(() => null);
      if (id) sent++;
    }));
  }
  return sent;
}

export const approveBooking = onCall({ timeoutSeconds: 120 }, async (request) => {
  const admin = await requirePermission(request.auth, 'operations');
  const bookingId = docId(request.data?.bookingId, 'booking');
  const note = text(request.data?.note, 300);
  const ref = db.doc(`bookings/${bookingId}`);
  const market = db.doc(`marketplace_trips/${bookingId}`);
  const pushes: { id: string; input: NotifyInput }[] = [];
  const { booking, offer } = await db.runTransaction(async (tx) => {
    pushes.length = 0;
    const [snap, m] = await Promise.all([tx.get(ref), tx.get(market)]);
    if (!snap.exists) throw new HttpsError('not-found', 'Booking not found.');
    const b = snap.data()!;
    const blocker = transitionBlocker(b.status, 'Approved');
    if (blocker) throw new HttpsError('failed-precondition', blocker);
    if (b.fareVerified !== true) throw new HttpsError('failed-precondition', 'Verify the fare first (Booking Details → Set fare).');
    if (!m.exists) throw new HttpsError('failed-precondition', 'This booking has no marketplace record. Contact the platform team.');
    const stamp = FieldValue.serverTimestamp();
    tx.update(ref, { status: 'Approved', approvedAt: stamp, approvedBy: admin.uid, approvedByName: admin.name, approvalNote: note, updatedAt: stamp });
    if (m.data()!.status === AWAITING_APPROVAL || m.data()!.status === 'Closed') tx.update(market, { status: 'Open', openedAt: stamp, updatedAt: stamp });
    tx.create(ref.collection('events').doc(), { type: 'approved', actorId: admin.uid, actorRole: 'admin', note, at: stamp });
    auditInTx(tx, { action: 'booking_approved', entity: 'booking', entityId: bookingId, performedBy: admin.uid, performedByName: admin.name, role: 'admin', bookingId, previous: { status: b.status }, next: { status: 'Approved' }, reason: note });
    if (b.customerId) {
      const n: NotifyInput = {
        recipientType: 'customer', recipientId: b.customerId, category: 'approvals', severity: 'success', sound: 'approval', title: 'Booking approved',
        message: `Your booking ${code(b, bookingId)} is approved. We are finding your driver.`, bookingId, bookingCode: code(b, bookingId), push: true, sentBy: admin.uid,
      };
      pushes.push({ id: notifyInTx(tx, n), input: n });
    }
    return { booking: { ...b, status: 'Approved' } as DocumentData, offer: m.data()! };
  });
  await pushAfterCommit(pushes);
  // Partners and the customer are told after the approval is safely committed.
  const announced = await announceToPartners(bookingId, booking, offer).catch((err) => { console.warn('announce failed', err); return 0; });
  let customerChannels: { channel: string; status: string; error?: string }[] = [];
  try {
    const secret = await db.doc(`booking_secrets/${bookingId}`).get();
    const results = await sendCustomerMessage(bookingId, booking, 'booking_approved', { otp: secret.data()?.otp });
    customerChannels = results.map((r) => ({ channel: r.channel, status: r.status, ...(r.error ? { error: r.error } : {}) }));
  } catch (err) {
    console.warn('customer message failed', err);
  }
  return { ok: true, partnersNotified: announced, customerChannels };
});

export const rejectBooking = onCall(async (request) => {
  const admin = await requirePermission(request.auth, 'operations');
  const bookingId = docId(request.data?.bookingId, 'booking');
  const reason = text(request.data?.reason, 300);
  if (reason.length < 5) throw new HttpsError('invalid-argument', 'Give the reason for rejecting this booking.');
  const ref = db.doc(`bookings/${bookingId}`);
  const market = db.doc(`marketplace_trips/${bookingId}`);
  const pushes: { id: string; input: NotifyInput }[] = [];
  const b = await db.runTransaction(async (tx) => {
    pushes.length = 0;
    const [snap, m, all] = await Promise.all([tx.get(ref), tx.get(market), tx.get(txnsRef(bookingId))]);
    if (!snap.exists) throw new HttpsError('not-found', 'Booking not found.');
    const cur = snap.data()!;
    const blocker = transitionBlocker(cur.status, 'Rejected');
    if (blocker) throw new HttpsError('failed-precondition', blocker);
    const paid = summarizePayments(0, all.docs.map((d) => ({ amount: d.data().amount, method: d.data().method, status: d.data().status, kind: d.data().kind, collectorType: d.data().collectorType }))).totalPaid;
    const stamp = FieldValue.serverTimestamp();
    tx.update(ref, {
      status: 'Rejected', rejectionReason: reason, rejectedAt: stamp, rejectedBy: admin.uid, rejectedByName: admin.name,
      cancellation: { cancelledBy: { type: 'admin', id: admin.uid, name: admin.name }, reason, charge: 0, at: stamp, rejected: true },
      // Anything already paid (an advance) is returned in full.
      refund: paid > 0 ? { status: 'Pending', eligible: true, amount: paid, method: '', reference: '', requestedAt: stamp, history: [] } : { status: 'Not Applicable', eligible: false, amount: 0, history: [] },
      updatedAt: stamp,
    });
    if (m.exists) tx.update(market, { status: 'Closed', updatedAt: stamp });
    tx.create(ref.collection('events').doc(), { type: 'rejected', actorId: admin.uid, actorRole: 'admin', reason, at: stamp });
    auditInTx(tx, { action: 'booking_rejected', entity: 'booking', entityId: bookingId, performedBy: admin.uid, performedByName: admin.name, role: 'admin', bookingId, previous: { status: cur.status }, next: { status: 'Rejected', refundDue: paid }, reason });
    if (cur.customerId) {
      const n: NotifyInput = { recipientType: 'customer', recipientId: cur.customerId, category: 'bookings', severity: 'warning', sound: 'general', title: 'Booking could not be accepted', message: `Booking ${code(cur, bookingId)}: ${reason}`, bookingId, bookingCode: code(cur, bookingId), push: true, sentBy: admin.uid };
      pushes.push({ id: notifyInTx(tx, n), input: n });
    }
    return cur;
  });
  await pushAfterCommit(pushes);
  await sendCustomerMessage(bookingId, b, 'booking_cancelled', { reason }).catch((err) => console.warn('customer message failed', err));
  return { ok: true };
});

// ── Cancellation & refund ─────────────────────────────────────────────────

export const cancelBooking = onCall(async (request) => {
  const admin = await requirePermission(request.auth, 'operations');
  const input = request.data ?? {};
  const bookingId = docId(input.bookingId, 'booking');
  const reason = text(input.reason, 300);
  if (reason.length < 5) throw new HttpsError('invalid-argument', 'Give the cancellation reason.');
  const charge = input.cancellationCharge == null ? 0 : input.cancellationCharge;
  if (typeof charge !== 'number' || !Number.isFinite(charge) || charge < 0 || charge > 1000000) throw new HttpsError('invalid-argument', 'Enter the cancellation charge in rupees (0 or more).');
  if (charge > 0 && !admin.permissions.includes('finance')) throw new HttpsError('permission-denied', 'Setting a cancellation charge needs finance access.');
  const refundMethod = text(input.refundMethod, 30);
  const ref = db.doc(`bookings/${bookingId}`);
  const market = db.doc(`marketplace_trips/${bookingId}`);
  const pushes: { id: string; input: NotifyInput }[] = [];
  const result = await db.runTransaction(async (tx) => {
    pushes.length = 0;
    const [snap, m, all] = await Promise.all([tx.get(ref), tx.get(market), tx.get(txnsRef(bookingId))]);
    if (!snap.exists) throw new HttpsError('not-found', 'Booking not found.');
    const b = snap.data()!;
    const blocker = transitionBlocker(b.status, 'Cancelled');
    if (blocker) throw new HttpsError('failed-precondition', blocker);
    if (b.status === 'Ongoing' && !admin.isSuper) throw new HttpsError('permission-denied', 'Only a super admin can cancel a trip that has started.');
    const paid = summarizePayments(money(b.fare), all.docs.map((d) => ({ amount: d.data().amount, method: d.data().method, status: d.data().status, kind: d.data().kind, collectorType: d.data().collectorType }))).totalPaid;
    const refundable = maxRefund(paid, charge);
    const eligible = input.refundEligible !== false && refundable > 0;
    const wanted = input.refundAmount == null ? refundable : input.refundAmount;
    if (eligible) {
      if (typeof wanted !== 'number' || !(wanted > 0)) throw new HttpsError('invalid-argument', 'Enter the refund amount.');
      if (wanted > refundable + 0.005) throw new HttpsError('failed-precondition', `The refund cannot exceed ₹${refundable.toLocaleString('en-IN')} (paid minus the cancellation charge).`);
      if (wanted !== refundable && !admin.permissions.includes('finance')) throw new HttpsError('permission-denied', 'Refunding a different amount needs finance access.');
    }
    const stamp = FieldValue.serverTimestamp();
    const refund = eligible
      ? { status: 'Pending', eligible: true, amount: wanted, method: refundMethod, reference: '', requestedAt: stamp, history: [] }
      : { status: 'Not Applicable', eligible: false, amount: 0, method: '', reference: '', history: [] };
    tx.update(ref, {
      status: 'Cancelled', cancelledAt: stamp, cancelReason: reason, cancelledBy: 'admin', cancellationFee: charge,
      cancellation: { cancelledBy: { type: 'admin', id: admin.uid, name: admin.name }, reason, charge, at: stamp, amountPaid: paid },
      refund, updatedAt: stamp,
    });
    if (m.exists) tx.update(market, { status: 'Closed', updatedAt: stamp });
    tx.create(ref.collection('events').doc(), { type: 'cancelled', actorId: admin.uid, actorRole: 'admin', reason, charge, refundAmount: eligible ? wanted : 0, at: stamp });
    auditInTx(tx, { action: 'booking_cancelled', entity: 'booking', entityId: bookingId, performedBy: admin.uid, performedByName: admin.name, role: 'admin', bookingId, previous: { status: b.status }, next: { status: 'Cancelled', charge, refund: eligible ? wanted : 0, paid }, reason });
    const label = code(b, bookingId);
    for (const [recipientId, recipientType] of [[b.assignedDriverId, 'driver'], [b.assignedVendorId, 'vendor']] as const) {
      if (!recipientId) continue;
      const n: NotifyInput = { recipientType, recipientId, category: 'trips', severity: 'warning', sound: 'general', title: 'Trip cancelled', message: `Booking ${label} was cancelled by NESAM. ${reason}`, bookingId, bookingCode: label, push: true, sentBy: admin.uid };
      pushes.push({ id: notifyInTx(tx, n), input: n });
    }
    if (b.customerId) {
      const n: NotifyInput = { recipientType: 'customer', recipientId: b.customerId, category: 'bookings', severity: 'warning', sound: 'general', title: 'Booking cancelled', message: `Booking ${label} was cancelled. ${reason}`, bookingId, bookingCode: label, push: true, sentBy: admin.uid };
      pushes.push({ id: notifyInTx(tx, n), input: n });
    }
    return { booking: b, refundAmount: eligible ? wanted : 0, paid };
  });
  await pushAfterCommit(pushes);
  await sendCustomerMessage(bookingId, result.booking, 'booking_cancelled', { reason }).catch((err) => console.warn('customer message failed', err));
  return { ok: true, refundAmount: result.refundAmount, amountPaid: result.paid };
});

/** Customer-initiated cancellations arrive through rules; give them the same cancellation / refund record. */
export const onBookingCancelled = onDocumentUpdated('bookings/{bookingId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === 'Cancelled' || after.status !== 'Cancelled' || after.refund) return;
  const bookingId = event.params.bookingId;
  const ref = db.doc(`bookings/${bookingId}`);
  await db.runTransaction(async (tx) => {
    const [snap, all] = await Promise.all([tx.get(ref), tx.get(txnsRef(bookingId))]);
    const b = snap.data();
    if (!snap.exists || !b || b.refund || b.status !== 'Cancelled') return;
    const paid = summarizePayments(money(b.fare), all.docs.map((d) => ({ amount: d.data().amount, method: d.data().method, status: d.data().status, kind: d.data().kind, collectorType: d.data().collectorType }))).totalPaid;
    const charge = Math.max(0, money(b.cancellationFee));
    const refundable = maxRefund(paid, charge);
    const stamp = FieldValue.serverTimestamp();
    const by = text(b.cancelledBy) || 'customer';
    tx.update(ref, {
      cancellation: { cancelledBy: { type: by, id: by === 'customer' ? text(b.customerId) : '', name: by === 'customer' ? text(b.customer) : '' }, reason: text(b.cancelReason), charge, at: b.cancelledAt ?? stamp, amountPaid: paid },
      refund: refundable > 0
        ? { status: 'Pending', eligible: true, amount: refundable, method: '', reference: '', requestedAt: stamp, history: [] }
        : { status: 'Not Applicable', eligible: false, amount: 0, method: '', reference: '', history: [] },
    });
    auditInTx(tx, { action: 'booking_cancelled', entity: 'booking', entityId: bookingId, performedBy: by === 'customer' ? text(b.customerId) : 'system', performedByName: text(b.customer), role: by === 'customer' ? 'customer' : 'system', bookingId, previous: { status: before.status }, next: { status: 'Cancelled', charge, refund: refundable, paid }, reason: text(b.cancelReason) });
  });
  const b = after;
  if (money(b.paymentSummary?.totalPaid) > 0) {
    await notify({
      recipientType: 'admin', recipientId: 'admin', category: 'payments', severity: 'warning', sound: 'general', title: 'Refund to review',
      message: `${code(b, bookingId)} was cancelled by the customer after payment. Review the refund.`, bookingId, bookingCode: code(b, bookingId),
      cta: { label: 'Open booking', page: 'booking-detail', bookingId }, dedupeKey: `refund_review_${bookingId}`, push: true,
    }).catch(() => null);
  }
});

export const updateRefund = onCall(async (request) => {
  const admin = await requirePermission(request.auth, 'finance');
  const input = request.data ?? {};
  const bookingId = docId(input.bookingId, 'booking');
  const to = input.status as RefundStatus;
  if (!(REFUND_STATUSES as readonly string[]).includes(to) || to === 'Not Applicable' || to === 'Pending') throw new HttpsError('invalid-argument', 'Choose Processing, Completed, Failed or Rejected.');
  const method = text(input.method, 30);
  const reference = text(input.reference, 120);
  const note = text(input.note, 300);
  const ref = db.doc(`bookings/${bookingId}`);
  const pushes: { id: string; input: NotifyInput }[] = [];
  const b = await db.runTransaction(async (tx) => {
    pushes.length = 0;
    const [snap, all] = await Promise.all([tx.get(ref), tx.get(txnsRef(bookingId))]);
    if (!snap.exists) throw new HttpsError('not-found', 'Booking not found.');
    const cur = snap.data()!;
    const r = cur.refund;
    if (!r || r.status === 'Not Applicable') throw new HttpsError('failed-precondition', 'This booking has no refund to process.');
    const blocker = refundBlocker(r.status, to);
    if (blocker) throw new HttpsError('failed-precondition', blocker);
    if (to === 'Completed' && (!method || (method !== 'Cash' && reference.length < 4))) throw new HttpsError('invalid-argument', 'Enter the refund method and its transaction reference.');
    if (to === 'Rejected' && note.length < 5) throw new HttpsError('invalid-argument', 'Give the reason for rejecting the refund.');
    let amount = money(r.amount);
    if (input.amount != null) {
      if (r.status !== 'Pending') throw new HttpsError('failed-precondition', 'The refund amount can only be changed while it is pending.');
      const paid = summarizePayments(money(cur.fare), all.docs.map((d) => ({ amount: d.data().amount, method: d.data().method, status: d.data().status, kind: d.data().kind, collectorType: d.data().collectorType }))).totalPaid;
      const ceiling = maxRefund(paid, money(cur.cancellationFee));
      if (typeof input.amount !== 'number' || !(input.amount > 0) || input.amount > ceiling + 0.005) throw new HttpsError('invalid-argument', `The refund must be between ₹1 and ₹${ceiling.toLocaleString('en-IN')}.`);
      amount = input.amount;
    }
    const entry = { status: to, amount, method: method || r.method || '', reference, note, by: admin.uid, byName: admin.name, at: Timestamp.now() };
    const history = [...(Array.isArray(r.history) ? r.history : []).slice(-19), entry];
    const stamp = FieldValue.serverTimestamp();
    tx.update(ref, {
      refund: {
        ...r, status: to, amount, method: entry.method, reference: reference || r.reference || '', history,
        ...(to === 'Completed' ? { processedBy: admin.uid, processedByName: admin.name, processedAt: stamp } : {}),
      },
      updatedAt: stamp,
    });
    tx.create(ref.collection('events').doc(), { type: `refund_${to.toLowerCase()}`, actorId: admin.uid, actorRole: 'admin', amount, method: entry.method, reference, at: stamp });
    auditInTx(tx, { action: `refund_${to.toLowerCase()}`, entity: 'refund', entityId: bookingId, performedBy: admin.uid, performedByName: admin.name, role: 'admin', bookingId, previous: { status: r.status, amount: money(r.amount) }, next: { status: to, amount, method: entry.method, reference }, reason: note });
    if (cur.customerId) {
      const n: NotifyInput = {
        recipientType: 'customer', recipientId: cur.customerId, category: 'payments', severity: to === 'Completed' ? 'success' : to === 'Processing' ? 'info' : 'warning', sound: 'general',
        title: `Refund ${to.toLowerCase()}`, message: `Your refund of ₹${amount.toLocaleString('en-IN')} for ${code(cur, bookingId)} is ${to.toLowerCase()}.`, bookingId, bookingCode: code(cur, bookingId), push: true, sentBy: admin.uid,
      };
      pushes.push({ id: notifyInTx(tx, n), input: n });
    }
    return { ...cur, refund: { status: to, amount } };
  });
  await pushAfterCommit(pushes);
  if (to === 'Completed' || to === 'Rejected') {
    await sendCustomerMessage(bookingId, b, 'refund_update', { reason: `${to === 'Completed' ? 'completed' : 'rejected'} (₹${money(b.refund.amount).toLocaleString('en-IN')})` }).catch(() => null);
  }
  return { ok: true };
});

// ── Driver assignment ─────────────────────────────────────────────────────

/** A new assignment that clashes with another trip of the same driver is refused unless forced. */
const CONFLICT_WINDOW_MS = 3 * 3600000;

export const assignDriver = onCall({ timeoutSeconds: 60 }, async (request) => {
  const admin = await requirePermission(request.auth, 'operations');
  const input = request.data ?? {};
  const bookingId = docId(input.bookingId, 'booking');
  const newDriverId = input.driverId ? docId(input.driverId, 'driver') : '';
  const wantedVehicleId = input.vehicleId ? docId(input.vehicleId, 'vehicle') : '';
  const reason = text(input.reason, 300);
  const force = input.force === true;
  const ref = db.doc(`bookings/${bookingId}`);
  const market = db.doc(`marketplace_trips/${bookingId}`);
  const pushes: { id: string; input: NotifyInput }[] = [];

  const out = await db.runTransaction(async (tx) => {
    pushes.length = 0;
    const [snap, m, verification] = await Promise.all([tx.get(ref), tx.get(market), tx.get(db.doc(`vehicle_verifications/${bookingId}`))]);
    if (!snap.exists) throw new HttpsError('not-found', 'Booking not found.');
    if (!m.exists) throw new HttpsError('failed-precondition', 'This booking has no marketplace record. Contact the platform team.');
    const b = snap.data()!;
    const oldDriverId: string = b.assignedDriverId || '';
    const action = !newDriverId ? 'remove' : oldDriverId ? 'reassign' : 'assign';
    if (action === 'remove' && !oldDriverId && !b.assignedVendorId) throw new HttpsError('failed-precondition', 'There is no assignment to remove.');
    if (!['Approved', 'Confirmed', 'Assigned'].includes(b.status)) {
      throw new HttpsError('failed-precondition', b.status === 'Pending'
        ? 'Approve the booking before assigning a driver.'
        : `A ${String(b.status).toLowerCase()} booking cannot be assigned or reassigned.`);
    }
    if (action !== 'assign' && reason.length < 5) throw new HttpsError('invalid-argument', 'Give the reason for changing the assignment.');
    if (action === 'reassign' && newDriverId === oldDriverId && !wantedVehicleId) throw new HttpsError('invalid-argument', 'That driver is already assigned. Choose a different driver or vehicle.');

    const payout = money(m.data()!.offeredPayout);
    const stamp = FieldValue.serverTimestamp();
    const oldDriver = { id: oldDriverId, name: text(b.assignedDriverName || b.driver), vehicleId: text(b.assignedVehicleId), vehicleNumber: text(b.assignedVehicleNumber), vendorId: text(b.assignedVendorId) };

    // ── Remove ──
    if (action === 'remove') {
      tx.update(ref, {
        status: 'Approved', tripStage: FieldValue.delete(), tripSubStatus: 'Not Started',
        assignedDriverId: '', assignedDriverName: '', driver: '', driverPhone: '', assignedVehicleId: '', assignedVehicleNumber: '',
        assignedVendorId: '', assignedVendorName: '', driverPayout: FieldValue.delete(), vendorPayout: FieldValue.delete(), payoutSource: FieldValue.delete(),
        assignedAt: FieldValue.delete(), lastAssignment: { action, by: admin.uid, byName: admin.name, reason, at: Timestamp.now() },
        assignmentChanges: FieldValue.increment(1), updatedAt: stamp,
      });
      tx.update(market, { status: 'Open', assignedDriverId: FieldValue.delete(), assignedDriverName: FieldValue.delete(), assignedVendorId: FieldValue.delete(), assignedVendorName: FieldValue.delete(), acceptedBidId: FieldValue.delete(), updatedAt: stamp });
      if (verification.exists) tx.update(verification.ref, { status: 'Superseded', supersededAt: stamp });
      tx.create(ref.collection('assignments').doc(), { action, oldDriver, newDriver: null, changedBy: admin.uid, changedByName: admin.name, reason, at: stamp });
      tx.create(ref.collection('events').doc(), { type: 'assignment_removed', actorId: admin.uid, actorRole: 'admin', driverId: oldDriverId, reason, at: stamp });
      auditInTx(tx, { action: 'driver_removed', entity: 'booking', entityId: bookingId, performedBy: admin.uid, performedByName: admin.name, role: 'admin', bookingId, previous: oldDriver, next: { status: 'Approved' }, reason });
      for (const [rid, rtype] of [[oldDriverId, 'driver'], [oldDriver.vendorId, 'vendor']] as const) {
        if (!rid) continue;
        const n: NotifyInput = { recipientType: rtype, recipientId: rid, category: 'trips', severity: 'warning', sound: 'general', title: 'Trip removed from you', message: `Booking ${code(b, bookingId)} was reassigned by NESAM. ${reason}`, bookingId, bookingCode: code(b, bookingId), push: true, sentBy: admin.uid };
        pushes.push({ id: notifyInTx(tx, n), input: n });
      }
      return { action, booking: b, newDriver: null as null | { id: string; name: string } };
    }

    // ── Assign / reassign ──
    const [d, conflicts] = await Promise.all([
      tx.get(db.doc(`drivers/${newDriverId}`)),
      tx.get(db.collection('bookings').where('assignedDriverId', '==', newDriverId).where('status', 'in', ['Assigned', 'Ongoing'])),
    ]);
    const driver = d.data();
    if (!d.exists || !driver || !approved(driver.status) || driver.fleetStatus === 'Suspended') throw new HttpsError('failed-precondition', 'Choose an approved driver who is not suspended.');
    const when = pickupInstant(b);
    for (const other of conflicts.docs) {
      if (other.id === bookingId) continue;
      const o = other.data();
      const at = pickupInstant(o);
      const clash = o.status === 'Ongoing' || (when && at && Math.abs(at.getTime() - when.getTime()) < CONFLICT_WINDOW_MS);
      if (clash && !force) {
        throw new HttpsError('failed-precondition', `${text(driver.name) || 'This driver'} already has trip ${code(o, other.id)}${at ? ` at ${formatDateTime12(at)}` : ''}. Choose another driver, or confirm to assign anyway.`, { conflict: true });
      }
    }
    const vendorId: string = text(driver.vendorId);
    let vendorName = '';
    if (vendorId) {
      const v = await tx.get(db.doc(`vendors/${vendorId}`));
      if (!v.exists || !approved(v.data()!.status)) throw new HttpsError('failed-precondition', "This driver's fleet operator is not approved.");
      vendorName = text(v.data()!.companyName || v.data()!.name);
    }
    const vehicleId = wantedVehicleId || text(driver.assignedVehicleId);
    const vehicle = vehicleId ? await assignableVehicle(tx, vehicleId, vendorId, newDriverId) : null;
    if (payout <= 0) throw new HttpsError('failed-precondition', 'This trip has no valid payout offer. Re-post it first.');
    const currentPayout = money(b.driverPayout) || money(b.vendorPayout);
    const agreed = currentPayout > 0 ? currentPayout : payout;
    const vehicleNumber = vehicle?.number ?? text(driver.assignedVehicleNumber || driver.vehicleNumber, 20);
    tx.update(ref, {
      status: 'Assigned', tripStage: 'Assigned', tripSubStatus: 'Not Started',
      assignedDriverId: newDriverId, assignedDriverName: text(driver.name), driver: text(driver.name), driverPhone: text(driver.phone),
      assignedVehicleId: vehicle?.id ?? '', assignedVehicleNumber: vehicleNumber,
      assignedVendorId: vendorId, assignedVendorName: vendorName,
      ...(vendorId ? { vendorPayout: agreed, driverPayout: FieldValue.delete() } : { driverPayout: agreed, vendorPayout: FieldValue.delete() }),
      payoutSource: b.payoutSource || 'offered', assignedAt: stamp,
      lastAssignment: { action, by: admin.uid, byName: admin.name, reason, at: Timestamp.now() }, assignmentChanges: FieldValue.increment(1), updatedAt: stamp,
    });
    tx.update(market, {
      status: 'Assigned', assignedDriverId: vendorId ? FieldValue.delete() : newDriverId, assignedDriverName: vendorId ? FieldValue.delete() : text(driver.name),
      assignedVendorId: vendorId || FieldValue.delete(), assignedVendorName: vendorId ? vendorName : FieldValue.delete(), updatedAt: stamp,
    });
    // Evidence submitted by the previous driver does not carry over to the new one.
    if (verification.exists && verification.data()!.driverId !== newDriverId) tx.update(verification.ref, { status: 'Superseded', supersededAt: stamp });
    const newDriver = { id: newDriverId, name: text(driver.name), vehicleId: vehicle?.id ?? '', vehicleNumber, vendorId };
    tx.create(ref.collection('assignments').doc(), { action, oldDriver: oldDriverId || oldDriver.vendorId ? oldDriver : null, newDriver, changedBy: admin.uid, changedByName: admin.name, reason, forced: force, at: stamp });
    tx.create(ref.collection('events').doc(), { type: action === 'assign' ? 'driver_assigned' : 'driver_reassigned', actorId: admin.uid, actorRole: 'admin', driverId: newDriverId, oldDriverId, reason, at: stamp });
    auditInTx(tx, { action: action === 'assign' ? 'driver_assigned' : 'driver_reassigned', entity: 'booking', entityId: bookingId, performedBy: admin.uid, performedByName: admin.name, role: 'admin', bookingId, previous: oldDriverId ? oldDriver : null, next: newDriver, reason });
    const label = code(b, bookingId);
    const toNew: NotifyInput = { recipientType: vendorId ? 'vendor' : 'driver', recipientId: vendorId || newDriverId, category: 'bookings', severity: 'info', sound: 'new_booking', title: vendorId ? `Trip assigned to ${text(driver.name)}` : 'Trip assigned to you', message: `${text(b.pickup)} → ${text(b.drop)}${when ? ` · ${formatDateTime12(when)}` : ''} (${label})`, bookingId, bookingCode: label, cta: { label: 'Open trip', page: 'trip', bookingId }, push: true, sentBy: admin.uid };
    pushes.push({ id: notifyInTx(tx, toNew), input: toNew });
    if (vendorId) {
      const toDriver: NotifyInput = { ...toNew, recipientType: 'driver', recipientId: newDriverId, title: 'Trip assigned to you' };
      pushes.push({ id: notifyInTx(tx, toDriver), input: toDriver });
    }
    for (const [rid, rtype] of [[oldDriverId, 'driver'], [oldDriver.vendorId && oldDriver.vendorId !== vendorId ? oldDriver.vendorId : '', 'vendor']] as const) {
      if (!rid || rid === newDriverId) continue;
      const n: NotifyInput = { recipientType: rtype, recipientId: rid, category: 'trips', severity: 'warning', sound: 'general', title: 'Trip reassigned', message: `Booking ${label} was reassigned to another driver. ${reason}`, bookingId, bookingCode: label, push: true, sentBy: admin.uid };
      pushes.push({ id: notifyInTx(tx, n), input: n });
    }
    return { action, booking: { ...b, assignedDriverName: text(driver.name), assignedVehicleNumber: vehicleNumber }, newDriver };
  });
  await pushAfterCommit(pushes);
  if (out.newDriver) await sendCustomerMessage(bookingId, out.booking, 'driver_assigned').catch((err) => console.warn('customer message failed', err));
  return { ok: true, action: out.action };
});

// ── Unassigned alert acknowledgement ──────────────────────────────────────

export const acknowledgeUnassignedAlert = onCall(async (request) => {
  const admin = await requirePermission(request.auth, 'operations');
  const bookingId = docId(request.data?.bookingId, 'booking');
  const ref = db.doc(`bookings/${bookingId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Booking not found.');
    const alert = snap.data()!.unassignedAlert;
    if (!alert) throw new HttpsError('failed-precondition', 'This booking has no active alert.');
    tx.update(ref, { 'unassignedAlert.acknowledgedBy': admin.uid, 'unassignedAlert.acknowledgedByName': admin.name, 'unassignedAlert.acknowledgedAt': FieldValue.serverTimestamp(), 'unassignedAlert.acknowledgedSeverity': alert.severity });
  });
  return { ok: true };
});

// ── Migration ─────────────────────────────────────────────────────────────

/**
 * One-off, idempotent. Before the approval step existed, a pending booking's
 * marketplace trip was already open to partners. This hides those trips again
 * until an admin approves the booking. dryRun (default) only reports.
 */
export const migrateMarketplaceVisibility = onCall({ timeoutSeconds: 300 }, async (request) => {
  const admin = await requireSuperAdmin(request.auth);
  const dryRun = request.data?.dryRun !== false;
  const pending = await db.collection('bookings').where('status', '==', 'Pending').get();
  const report = { dryRun, pendingBookings: pending.size, tripsToHide: 0, alreadyHidden: 0 };
  const stamp = FieldValue.serverTimestamp();
  for (const b of pending.docs) {
    const m = await db.doc(`marketplace_trips/${b.id}`).get();
    if (!m.exists) continue;
    if (['Open', 'Bidding'].includes(m.data()!.status) && !b.data().assignedVendorId && !b.data().assignedDriverId) {
      report.tripsToHide++;
      if (!dryRun) await m.ref.update({ status: AWAITING_APPROVAL, updatedAt: stamp });
    } else if (m.data()!.status === AWAITING_APPROVAL) report.alreadyHidden++;
  }
  if (!dryRun) await audit({ action: 'marketplace_visibility_migrated', entity: 'system', entityId: 'marketplace_trips', performedBy: admin.uid, performedByName: admin.name, role: 'admin', meta: { ...report } });
  return report;
});
