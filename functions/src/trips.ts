import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './admin';

// One deterministic audit record per booking, including independent drivers.
// No double wallet credits; payout eligibility is checked by requestPartnerPayout.
export const onTripCompleted = onDocumentUpdated('bookings/{bookingId}', async event => {
  if (event.data?.after.data().status !== 'Completed') return;
  const bookingRef = db.doc(`bookings/${event.params.bookingId}`);
  const ledgerRef = db.doc(`wallet_ledger/trip_${event.params.bookingId}`);
  await db.runTransaction(async tx => {
    const [booking, ledger] = await Promise.all([tx.get(bookingRef), tx.get(ledgerRef)]);
    if (ledger.exists || !booking.exists) return;
    const b = booking.data()!;
    if (b.status !== 'Completed' || b.fareVerified !== true) return;
    const vendorId = b.assignedVendorId || '';
    const driverId = vendorId ? '' : b.assignedDriverId || '';
    const amount = Number(vendorId ? b.vendorPayout : b.driverPayout);
    if ((!vendorId && !driverId) || !Number.isFinite(amount) || amount < 0) return;
    tx.create(ledgerRef, { bookingId: booking.id, vendorId, driverId, fare: b.fare,
      amount, type: 'Trip Revenue', createdAt: FieldValue.serverTimestamp() });
  });
});
