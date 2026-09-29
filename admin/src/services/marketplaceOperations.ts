import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export function createMarketplaceService(db: Firestore) {

async function resolveBookingId(value: string): Promise<string> {
  const matches = await getDocs(query(collection(db, 'bookings'), where('bookingId', '==', value.trim())));
  if (matches.size > 1) throw new Error('Duplicate booking code. Use the document ID.');
  return matches.empty ? value.trim() : matches.docs[0].id;
}

async function awardBid(tripId: string, bidId: string): Promise<void> {
  const market = doc(db, 'marketplace_trips', tripId);
  const booking = doc(db, 'bookings', tripId);
  const bids = await getDocs(collection(market, 'bids'));
  await runTransaction(db, async tx => {
    const [m, b, winner] = await Promise.all([tx.get(market), tx.get(booking), tx.get(doc(market, 'bids', bidId))]);
    if (!m.exists() || !b.exists() || !['Open', 'Bidding'].includes(m.data().status) || b.data().status !== 'Pending' || b.data().assignedVendorId || b.data().assignedDriverId) throw new Error('This trip has already been assigned or withdrawn.');
    if (!winner.exists() || winner.data().status !== 'Pending Review') throw new Error('This bid is no longer pending.');
    const bid = winner.data();
    const vendor = await tx.get(doc(db, 'vendors', bid.vendorId));
    if (!vendor.exists() || !['APPROVED', 'Approved', 'Active'].includes(vendor.data().status)) throw new Error('Vendor is not approved.');
    const payout = Number(bid.vendorCounterRate);
    if (!Number.isFinite(payout) || payout <= 0 || payout > Number(b.data().fare)) throw new Error('Counter payout must be positive and within the customer fare. Reprice the booking first if needed.');
    const stamp = serverTimestamp();
    tx.update(booking, { status: 'Confirmed', assignedVendorId: bid.vendorId, assignedVendorName: bid.vendorName || '', vendorPayout: payout, confirmedAt: stamp, updatedAt: stamp });
    tx.update(market, { status: 'Assigned', assignedVendorId: bid.vendorId, assignedVendorName: bid.vendorName || '', acceptedBidId: bidId, updatedAt: stamp });
    for (const other of bids.docs) tx.update(other.ref, { status: other.id === bidId ? 'Accepted' : 'Rejected', reviewedAt: stamp });
    if (!bids.docs.some(d => d.id === bidId)) tx.update(winner.ref, { status: 'Accepted', reviewedAt: stamp });
  });
}

async function rejectBid(tripId: string, bidId: string): Promise<void> {
  await runTransaction(db, async tx => {
    const ref = doc(db, 'marketplace_trips', tripId, 'bids', bidId);
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().status !== 'Pending Review') throw new Error('This bid has already been reviewed.');
    tx.update(ref, { status: 'Rejected', reviewedAt: serverTimestamp() });
  });
}

async function postBooking(value: string, payout: number): Promise<void> {
  const bookingId = await resolveBookingId(value);
  await runTransaction(db, async tx => {
    const ref = doc(db, 'bookings', bookingId), market = doc(db, 'marketplace_trips', bookingId);
    const [snap, prior] = await Promise.all([tx.get(ref), tx.get(market)]);
    if (!snap.exists()) throw new Error('Booking not found.');
    const b = snap.data();
    if (b.status !== 'Pending' || b.assignedVendorId || b.assignedDriverId) throw new Error('Only an unassigned pending booking can be posted.');
    if (prior.exists() && !['Closed', 'Open'].includes(prior.data().status)) throw new Error('This marketplace trip is already in progress.');
    if (!Number.isFinite(payout) || payout <= 0 || payout > Number(b.fare)) throw new Error('Payout must be positive and within the reviewed customer fare.');
    const stamp = serverTimestamp();
    tx.set(market, { id: bookingId, bookingId: b.bookingId || bookingId, route: `${b.pickup} → ${b.drop}`,
      pickup: { address: b.pickupAddress || b.pickup || '', city: b.pickup || '', time: b.time || '' },
      drop: { address: b.dropAddress || b.drop || '', city: b.drop || '' }, travelDate: b.date || '',
      vehicleCategory: b.vehicleCategory || b.vehicle || '', distanceKm: Number(b.distanceKm || 0),
      offeredPayout: payout, status: 'Open', createdAt: stamp });
    tx.update(ref, { fareVerified: true, updatedAt: stamp });
  });
}

async function assignIndependentDriver(tripId: string, driverId: string): Promise<void> {
  await runTransaction(db, async tx => {
    const booking = doc(db, 'bookings', tripId), market = doc(db, 'marketplace_trips', tripId);
    const [b, m, d] = await Promise.all([tx.get(booking), tx.get(market), tx.get(doc(db, 'drivers', driverId))]);
    if (!b.exists() || !m.exists() || b.data().status !== 'Pending' || !['Open', 'Bidding'].includes(m.data().status)) throw new Error('Trip no longer available.');
    if (!d.exists() || d.data().status !== 'Approved' || d.data().vendorId || d.data().presenceStatus !== 'Online' || d.data().fleetStatus === 'Suspended') throw new Error('Choose an available approved independent driver.');
    const stamp = serverTimestamp();
    tx.update(booking, { status: 'Assigned', tripStage: 'Assigned', assignedDriverId: driverId,
      assignedDriverName: d.data().name || '', driver: d.data().name || '', driverPhone: d.data().phone || '',
      assignedVehicleNumber: d.data().vehicleNumber || '', driverPayout: Number(m.data().offeredPayout), assignedAt: stamp, updatedAt: stamp });
    tx.update(market, { status: 'Assigned', assignedDriverId: driverId, assignedDriverName: d.data().name || '', updatedAt: stamp });
  });
}

return { resolveBookingId, awardBid, rejectBid, postBooking, assignIndependentDriver };
}

