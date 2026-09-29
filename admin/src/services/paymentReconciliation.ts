import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export async function reconcilePayment(db: Firestore, bookingId: string, amount: string, reference: string, tolls: boolean, actorId: string): Promise<void> {
  if (!actorId || !reference.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error('Enter the received amount and bank/UPI reference.');
      await runTransaction(db, async tx => {
        const ref = doc(db, 'bookings', bookingId), paymentRef = doc(db, 'payments', `booking_${bookingId}`);
        const [snap, prior] = await Promise.all([tx.get(ref), tx.get(paymentRef)]);
        if (!snap.exists()) throw new Error('Booking no longer exists.');
        const b = snap.data();
        if (b.status !== 'Completed' || b.fareVerified !== true) throw new Error('Complete the trip and review its fare before reconciliation.');
        if (b.paymentMethod === 'Cash') throw new Error('Cash collected by the partner is not a platform payout balance.');
        if (prior.exists() || b.payment === 'Paid') throw new Error('Payment was already reconciled.');
        const total = Number(b.fare) + Number(b.tollCharges || 0);
        if (Number(amount) !== total) throw new Error(`Expected received amount: ₹${total}. Reconcile partial payments separately before marking this booking paid.`);
        if (Number(b.tollCharges || 0) > 0 && !tolls) throw new Error('Review the driver’s toll receipts and approve them first.');
        const stamp = serverTimestamp();
        tx.update(ref, { payment: 'Paid', paidAt: stamp, paymentReference: reference.trim(), tollsApproved: tolls, updatedAt: stamp });
        tx.set(paymentRef, { id: paymentRef.id, bookingId: b.bookingId || bookingId, bookingDocumentId: bookingId,
          customerId: b.customerId || '', customer: b.customer || '', amount: total, method: b.paymentMethod,
          status: 'Success', gateway: 'Manual reconciliation', reference: reference.trim(), date: new Date().toISOString(),
          verifiedBy: actorId, createdAt: stamp });
        tx.set(doc(ref, 'events', `payment_${bookingId}`), { type: 'payment_reconciled', actorId: actorId, actorRole: 'admin', at: stamp });
      });
}
