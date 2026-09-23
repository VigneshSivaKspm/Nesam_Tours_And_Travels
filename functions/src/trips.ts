import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { db } from './admin';

const DEFAULT_COMMISSION_RATE = 0.15;

/**
 * When a booking transitions to Completed, computes the platform's commission
 * from the assigned vendor's actual commissionRate (falls back to 15% if the
 * vendor doc doesn't have one yet), writes an audit entry to wallet_ledger,
 * and credits the vendor's walletBalance with its fleet-revenue share.
 *
 * The same share is also credited to the assigned driver's walletBalance:
 * the vendor and driver wallets are two different dashboards over the same
 * trip revenue (fleet total vs. this driver's personal earnings), not two
 * separate payouts of platform money.
 */
export const onTripCompleted = onDocumentUpdated('bookings/{bookingId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.status === after.status || after.status !== 'Completed') return;

  const bookingId = event.params.bookingId;
  const vendorId: string | undefined = after.assignedVendorId;
  const driverId: string | undefined = after.assignedDriverId;
  const totalFare = Number(after.totalFare ?? 0);

  if (!vendorId || !totalFare) {
    logger.warn(`onTripCompleted: booking ${bookingId} missing assignedVendorId or totalFare, skipping payout.`);
    return;
  }

  const vendorRef = db.collection('vendors').doc(vendorId);
  const vendorSnap = await vendorRef.get();
  const commissionRate = Number(vendorSnap.data()?.commissionRate ?? DEFAULT_COMMISSION_RATE);

  const platformCommission = Math.round(totalFare * commissionRate * 100) / 100;
  const vendorPayout = Math.round((totalFare - platformCommission) * 100) / 100;

  const ledgerRef = db.collection('wallet_ledger').doc();
  const batch = db.batch();

  batch.set(ledgerRef, {
    bookingId,
    vendorId,
    driverId: driverId ?? null,
    totalFare,
    commissionRate,
    platformCommission,
    vendorPayout,
    createdAt: FieldValue.serverTimestamp(),
  });

  batch.update(vendorRef, {
    walletBalance: FieldValue.increment(vendorPayout),
  });

  if (driverId) {
    batch.update(db.collection('drivers').doc(driverId), {
      walletBalance: FieldValue.increment(vendorPayout),
    });
  }

  await batch.commit();
  logger.info(`onTripCompleted: booking ${bookingId} settled — vendor ${vendorId} credited ₹${vendorPayout}`);
});
