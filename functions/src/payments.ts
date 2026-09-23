import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createHmac } from 'crypto';
import Razorpay from 'razorpay';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './admin';

const RAZORPAY_KEY_ID = defineSecret('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');

// Secret Manager requires these params to have a value for `firebase deploy` to
// run at all. Until real Razorpay keys are set, they hold the sentinel "UNSET",
// which we treat exactly like "not configured".
const UNSET = 'UNSET';
function isConfigured(...values: string[]): boolean {
  return values.every((v) => v && v !== UNSET);
}

/**
 * Creates a Razorpay order for a booking's total fare. Until real keys are
 * configured (see functions/README.md), this throws PAYMENT_NOT_CONFIGURED
 * rather than fabricating a fake order id.
 */
export const createRazorpayOrder = onCall(
  { secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const keyId = RAZORPAY_KEY_ID.value();
    const keySecret = RAZORPAY_KEY_SECRET.value();
    if (!isConfigured(keyId, keySecret)) {
      throw new HttpsError('failed-precondition', 'PAYMENT_NOT_CONFIGURED');
    }

    const { bookingId } = (request.data ?? {}) as { bookingId?: string };
    if (!bookingId) throw new HttpsError('invalid-argument', 'bookingId is required.');

    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) throw new HttpsError('not-found', 'Booking not found.');

    const booking = bookingSnap.data()!;
    if (booking.customerId !== uid) {
      throw new HttpsError('permission-denied', 'This booking does not belong to you.');
    }

    const amountPaise = Math.round(Number(booking.totalFare ?? 0) * 100);
    if (!amountPaise || amountPaise <= 0) {
      throw new HttpsError('failed-precondition', 'This booking has no payable fare.');
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: bookingId,
      notes: { bookingId, customerId: uid },
    });

    await bookingRef.update({
      razorpayOrderId: order.id,
      paymentStatus: 'Order Created',
    });

    return { orderId: order.id, amount: order.amount, currency: order.currency, keyId };
  }
);

/**
 * Verifies a completed Razorpay checkout against the HMAC signature Razorpay
 * returns to the client — never trust a client-reported "payment succeeded".
 */
export const verifyRazorpayPayment = onCall(
  { secrets: [RAZORPAY_KEY_SECRET] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const keySecret = RAZORPAY_KEY_SECRET.value();
    if (!isConfigured(keySecret)) {
      throw new HttpsError('failed-precondition', 'PAYMENT_NOT_CONFIGURED');
    }

    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = (request.data ?? {}) as {
      bookingId?: string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    };

    if (!bookingId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new HttpsError('invalid-argument', 'Missing payment verification fields.');
    }

    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) throw new HttpsError('not-found', 'Booking not found.');

    const booking = bookingSnap.data()!;
    if (booking.customerId !== uid) {
      throw new HttpsError('permission-denied', 'This booking does not belong to you.');
    }
    if (booking.razorpayOrderId !== razorpayOrderId) {
      throw new HttpsError('failed-precondition', 'Order does not match this booking.');
    }

    const expectedSignature = createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      await bookingRef.update({ paymentStatus: 'Verification Failed' });
      throw new HttpsError('invalid-argument', 'Payment signature verification failed.');
    }

    await bookingRef.update({
      paymentStatus: 'Paid',
      razorpayPaymentId,
      paidAt: FieldValue.serverTimestamp(),
    });

    return { verified: true };
  }
);
