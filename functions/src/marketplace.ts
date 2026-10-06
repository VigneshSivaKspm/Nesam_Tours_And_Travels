// Admin marketplace actions. They decide a partner's payout, so they run on
// the server (firestore.rules deny client writes to payouts, commission and
// offers): award a vendor's counter-bid, (re)post a reviewed booking, and
// assign an independent driver.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { DocumentData, FieldValue, Transaction } from 'firebase-admin/firestore';
import { db } from './admin';
import { COMMISSION_NOT_CONFIGURED, partnerPayoutFor, resolveCommission } from './domain/finance';
import { loadCommissionPolicy } from './commission';
import { approved, requirePermission, text } from './shared';

const docId = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(v)) throw new HttpsError('invalid-argument', `Invalid ${what}.`);
  return v;
};
const money = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
// Only an approved booking can be offered, awarded or assigned from the marketplace.
const unassigned = (b: DocumentData) => b.status === 'Approved' && !b.assignedVendorId && !b.assignedDriverId;

/**
 * A vehicle a trip may be assigned to: exists, owned by `ownerVendorId`
 * ('' for NESAM-owned / independent), documents approved and in service.
 * Availability across trips is enforced with dispatch (Phase D).
 */
export async function assignableVehicle(tx: Transaction, vehicleId: string, ownerVendorId: string, driverId?: string) {
  const snap = await tx.get(db.doc(`vehicles/${vehicleId}`));
  const v = snap.data();
  if (!snap.exists || !v) throw new HttpsError('failed-precondition', 'The selected vehicle no longer exists.');
  if ((v.vendorId || '') !== ownerVendorId) throw new HttpsError('failed-precondition', 'The selected vehicle does not belong to this partner.');
  if (v.docStatus !== 'Approved') throw new HttpsError('failed-precondition', `${text(v.vehicleNumber) || 'The vehicle'} is not approved yet.`);
  if (['Inactive', 'Maintenance'].includes(v.status)) throw new HttpsError('failed-precondition', `${text(v.vehicleNumber) || 'The vehicle'} is not in service.`);
  if (driverId && v.assignedDriverId && v.assignedDriverId !== driverId) throw new HttpsError('failed-precondition', `${text(v.vehicleNumber) || 'The vehicle'} is paired with another driver.`);
  return { id: snap.id, number: text(v.vehicleNumber, 20) };
}

export const awardMarketplaceBid = onCall(async (request) => {
  const admin = await requirePermission(request.auth, 'operations');
  const tripId = docId(request.data?.tripId, 'trip');
  const bidId = docId(request.data?.bidId, 'bid');
  const market = db.doc(`marketplace_trips/${tripId}`);
  const booking = db.doc(`bookings/${tripId}`);
  await db.runTransaction(async (tx) => {
    const [m, b, winner, bids] = await Promise.all([tx.get(market), tx.get(booking), tx.get(market.collection('bids').doc(bidId)), tx.get(market.collection('bids'))]);
    if (!m.exists || !b.exists || !['Open', 'Bidding'].includes(m.data()!.status) || !unassigned(b.data()!)) throw new HttpsError('failed-precondition', 'This trip has already been assigned or withdrawn.');
    if (!winner.exists || winner.data()!.status !== 'Pending Review') throw new HttpsError('failed-precondition', 'This bid is no longer pending.');
    const bid = winner.data()!;
    const vendor = await tx.get(db.doc(`vendors/${bid.vendorId}`));
    if (!vendor.exists || !approved(vendor.data()!.status)) throw new HttpsError('failed-precondition', 'Vendor is not approved.');
    const payout = Number(bid.vendorCounterRate);
    if (!Number.isFinite(payout) || payout <= 0 || payout > money(b.data()!.fare)) throw new HttpsError('failed-precondition', 'The counter payout must be positive and within the customer fare. Reprice the booking first if needed.');
    const stamp = FieldValue.serverTimestamp();
    tx.update(booking, { status: 'Confirmed', assignedVendorId: bid.vendorId, assignedVendorName: text(bid.vendorName), vendorPayout: payout, payoutSource: 'bid', confirmedAt: stamp, updatedAt: stamp });
    tx.update(market, { status: 'Assigned', assignedVendorId: bid.vendorId, assignedVendorName: text(bid.vendorName), acceptedBidId: bidId, updatedAt: stamp });
    for (const other of bids.docs) tx.update(other.ref, { status: other.id === bidId ? 'Accepted' : 'Rejected', reviewedAt: stamp });
    tx.create(booking.collection('events').doc(), { type: 'bid_awarded', actorId: admin.uid, actorRole: 'admin', bidId, vendorId: bid.vendorId, payout, at: stamp });
  });
  return { ok: true };
});

/**
 * Publishes (or re-publishes) an unassigned booking whose fare is verified.
 * The offer comes from the commission policy; a finance admin may set a
 * specific payout instead (recorded as a manual payout).
 */
export const postBookingToMarketplace = onCall(async (request) => {
  const admin = await requirePermission(request.auth, 'operations');
  const value = text(request.data?.booking, 128);
  if (!value) throw new HttpsError('invalid-argument', 'Enter the booking code or ID.');
  const manual = request.data?.payout;
  if (manual != null) {
    if (!admin.permissions.includes('finance')) throw new HttpsError('permission-denied', 'Setting a payout by hand needs finance access. Leave it blank to use the commission policy.');
    if (!Number.isSafeInteger(manual) || manual <= 0) throw new HttpsError('invalid-argument', 'Enter the payout in whole rupees.');
  }
  const byCode = await db.collection('bookings').where('bookingId', '==', value).get();
  if (byCode.size > 1) throw new HttpsError('failed-precondition', 'Duplicate booking code. Use the document ID.');
  const bookingId = byCode.empty ? docId(value, 'booking') : byCode.docs[0].id;
  const ref = db.doc(`bookings/${bookingId}`);
  const market = db.doc(`marketplace_trips/${bookingId}`);
  return db.runTransaction(async (tx) => {
    const [snap, prior, policy] = await Promise.all([tx.get(ref), tx.get(market), loadCommissionPolicy(tx)]);
    if (!snap.exists) throw new HttpsError('not-found', 'Booking not found.');
    const b = snap.data()!;
    if (!unassigned(b)) throw new HttpsError('failed-precondition', 'Only an approved, unassigned booking can be posted. Approve it first.');
    if (prior.exists && !['Closed', 'Open'].includes(prior.data()!.status)) throw new HttpsError('failed-precondition', 'This marketplace trip is already in progress.');
    if (b.fareVerified !== true) throw new HttpsError('failed-precondition', 'Verify the fare first (Booking Details → Verify / set fare).');
    const fareTotal = money(b.fare);
    const fb = b.fareBreakdown && typeof b.fareBreakdown === 'object' ? b.fareBreakdown : null;
    const taxableAmount = fb && Number.isFinite(fb.taxableAmount) ? fb.taxableAmount : Math.round((fareTotal / 1.05) * 100) / 100;
    let payout: number;
    let payoutSource: string;
    let commission = b.commission && typeof b.commission.rate === 'number' ? b.commission : null;
    if (manual != null) {
      if (manual > fareTotal) throw new HttpsError('failed-precondition', 'The payout must be within the customer fare.');
      payout = manual;
      payoutSource = 'manual';
    } else {
      commission = commission ?? resolveCommission(policy, { serviceId: text(b.serviceId), categoryId: text(b.vehicleCategoryId) });
      if (!commission) throw new HttpsError('failed-precondition', COMMISSION_NOT_CONFIGURED);
      payout = partnerPayoutFor({ taxableAmount, total: fareTotal }, commission);
      payoutSource = 'offered';
    }
    const stamp = FieldValue.serverTimestamp();
    tx.set(market, {
      id: bookingId, bookingId: text(b.bookingId) || bookingId, route: `${text(b.pickup)} → ${text(b.drop)}`,
      // Area only, approximate coordinates: the exact address is shared once the trip is theirs.
      pickup: { address: text(b.pickup), city: text(b.pickup), time: text(b.time), ...(Number.isFinite(b.pickupLat) ? { lat: Math.round(b.pickupLat * 100) / 100, lng: Math.round(b.pickupLng * 100) / 100 } : {}) },
      drop: { address: text(b.drop), city: text(b.drop), ...(Number.isFinite(b.dropLat) ? { lat: Math.round(b.dropLat * 100) / 100, lng: Math.round(b.dropLng * 100) / 100 } : {}) },
      travelDate: text(b.date), service: text(b.service), tripType: text(b.tripType),
      vehicleCategory: text(b.vehicleCategory) || text(b.vehicle), vehicleCategoryId: text(b.vehicleCategoryId),
      distanceKm: money(b.distanceKm), offeredPayout: payout, status: 'Open', createdAt: stamp,
    });
    tx.update(ref, { ...(commission && !b.commission ? { commission } : {}), payoutSource, updatedAt: stamp });
    tx.create(ref.collection('events').doc(), { type: 'posted_to_marketplace', actorId: admin.uid, actorRole: 'admin', payout, payoutSource, at: stamp });
    return { bookingId, offeredPayout: payout };
  });
});

export const assignIndependentDriver = onCall(async (request) => {
  const admin = await requirePermission(request.auth, 'operations');
  const tripId = docId(request.data?.tripId, 'trip');
  const driverId = docId(request.data?.driverId, 'driver');
  const booking = db.doc(`bookings/${tripId}`);
  const market = db.doc(`marketplace_trips/${tripId}`);
  await db.runTransaction(async (tx) => {
    const [b, m, d] = await Promise.all([tx.get(booking), tx.get(market), tx.get(db.doc(`drivers/${driverId}`))]);
    if (!b.exists || !m.exists || !unassigned(b.data()!) || !['Open', 'Bidding'].includes(m.data()!.status)) throw new HttpsError('failed-precondition', 'Trip no longer available.');
    const driver = d.data();
    if (!d.exists || !driver || driver.status !== 'Approved' || driver.vendorId || driver.presenceStatus !== 'Online' || driver.fleetStatus === 'Suspended') {
      throw new HttpsError('failed-precondition', 'Choose an available approved independent driver.');
    }
    const payout = Number(m.data()!.offeredPayout);
    if (!Number.isFinite(payout) || payout <= 0) throw new HttpsError('failed-precondition', 'This trip has no valid offer. Re-post it first.');
    // The driver's registered vehicle record, when there is one.
    const vehicle = driver.assignedVehicleId ? await assignableVehicle(tx, driver.assignedVehicleId, '', driverId) : null;
    const stamp = FieldValue.serverTimestamp();
    tx.update(booking, {
      status: 'Assigned', tripStage: 'Assigned', assignedDriverId: driverId, assignedDriverName: text(driver.name), driver: text(driver.name),
      driverPhone: text(driver.phone), assignedVehicleId: vehicle?.id ?? '', assignedVehicleNumber: vehicle?.number ?? text(driver.assignedVehicleNumber || driver.vehicleNumber, 20),
      driverPayout: payout, payoutSource: 'offered', assignedAt: stamp, updatedAt: stamp,
    });
    tx.update(market, { status: 'Assigned', assignedDriverId: driverId, assignedDriverName: text(driver.name), updatedAt: stamp });
    tx.create(booking.collection('events').doc(), { type: 'driver_assigned', actorId: admin.uid, actorRole: 'admin', driverId, at: stamp });
  });
  return { ok: true };
});
