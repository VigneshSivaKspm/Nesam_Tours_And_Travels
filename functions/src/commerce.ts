import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomInt } from 'crypto';
import { db } from './admin';
import { auditInTx } from './audit';
import { marketplaceOffer, optionalEmail, whatsappContact, AWAITING_APPROVAL } from './bookingBuild';
import { buildFareBreakup } from './domain/fareBreakup';
import { calculateFare, isOutstation, mapCategory, mapCoupon, normalizeCode, serviceName, validateCoupon } from './domain/pricing';
import { COMMISSION_NOT_CONFIGURED, partnerPayoutFor, resolveCommission } from './domain/finance';
import { formatDate, formatDateTime12, formatTime12 } from './domain/time';
import { GeoPlace } from './domain/types';
import { loadCommissionPolicy } from './commission';
import { effectiveAdjustment, loadFareAdjustment } from './fareConfig';
import { assertLegalAccepted } from './legal';
import { notifyInTx, pushAfterCommit, NotifyInput } from './notify';
import { NO_BOOKABLE_CATEGORIES, approved, inIndia, requestIdOf as id, routeFor, text } from './shared';

function place(v: any): GeoPlace {
  if (!v || !inIndia(v.lat, v.lng)) throw new HttpsError('invalid-argument', 'Choose valid pickup and drop locations in India.');
  return { id: 'pin', name: text(v.name, 120), address: text(v.address), lat: v.lat, lng: v.lng, type: v.type === 'airport' ? 'airport' : 'other' };
}

export const createBooking = onCall({ timeoutSeconds: 60 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const input = request.data ?? {};
  const requestId = id(input.requestId);
  if (!['Cash', 'UPI'].includes(input.paymentMethod)) throw new HttpsError('failed-precondition', 'Choose cash or UPI. Wallet and card checkout are not enabled.');
  const ref = db.doc(`bookings/${requestId}`);
  const existing = await ref.get();
  if (existing.exists) {
    if (existing.data()!.customerId !== uid) throw new HttpsError('permission-denied', 'Request already used.');
    return { id: requestId, fare: existing.data()!.fare };
  }
  // Customers must have accepted the current published Terms & Privacy Policy (none published → no block).
  await assertLegalAccepted(uid, 'customer');
  const pickup = place(input.pickup), drop = place(input.drop);
  const route = await routeFor(pickup, drop);
  const tripType = input.tripType === 'Round Trip' ? 'Round Trip' : 'One Way';
  const now = new Date();
  const scheduled = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (scheduled && (!Number.isFinite(scheduled.getTime()) || scheduled.getTime() < now.getTime() + 30 * 60000 || scheduled.getTime() > now.getTime() + 30 * 86400000)) {
    throw new HttpsError('invalid-argument', 'Schedule pickup between 30 minutes and 30 days ahead.');
  }
  const when = scheduled ?? now;
  const pushes: { id: string; input: NotifyInput }[] = [];
  const result = await db.runTransaction(async (tx) => {
    pushes.length = 0; // the callback can retry; only the committed attempt may push
    const [previous, customer, categories, coupons, history, policy, adjustmentDoc] = await Promise.all([
      tx.get(ref), tx.get(db.doc(`customers/${uid}`)),
      tx.get(db.collection('vehicle_categories').where('status', '==', 'Active')),
      tx.get(db.collection('coupons')),
      tx.get(db.collection('bookings').where('customerId', '==', uid)),
      loadCommissionPolicy(tx),
      loadFareAdjustment(tx),
    ]);
    if (!customer.exists || !approved(customer.data()!.status)) throw new HttpsError('permission-denied', 'Your account is not active.');
    if (previous.exists) {
      if (previous.data()!.customerId !== uid) throw new HttpsError('permission-denied', 'Request already used.');
      return { id: requestId, fare: previous.data()!.fare };
    }
    if (!scheduled && history.docs.some(d => ['Pending', 'Approved', 'Confirmed', 'Assigned', 'Ongoing'].includes(d.data().status) && d.data().rideTiming !== 'scheduled')) {
      throw new HttpsError('failed-precondition', 'You already have a ride in progress. Open Trips to continue it.');
    }
    // Only admin-configured categories with a per-km rate can be priced; a
    // price is never invented when none is configured.
    const configured = categories.docs.map(d => mapCategory(d.id, d.data())).filter(c => c !== null);
    if (!configured.length) throw new HttpsError('failed-precondition', NO_BOOKABLE_CATEGORIES);
    const category = configured.find(c => c.id === input.categoryId);
    if (!category) throw new HttpsError('failed-precondition', 'This vehicle category is no longer available.');
    // The partner offer needs a configured commission; none is ever invented.
    const commission = resolveCommission(policy, { categoryId: category.id });
    if (!commission) throw new HttpsError('failed-precondition', COMMISSION_NOT_CONFIGURED);
    const service = serviceName(pickup, drop, route.distanceKm);
    const adjustment = effectiveAdjustment(adjustmentDoc, now);
    const beforeDiscount = calculateFare({ category, route, tripType, pickupTime: when, adjustment });
    const couponCode = normalizeCode(text(input.couponCode, 50));
    let discount = 0, usedCoupon;
    if (couponCode) {
      const prior = history.docs.map(d => d.data()).filter(b => b.status !== 'Cancelled' && b.status !== 'Rejected');
      const result = validateCoupon(coupons.docs.map(d => mapCoupon(d.id, d.data())), couponCode, {
        subtotal: beforeDiscount.subtotal, categoryId: category.id, service,
        isFirstBooking: prior.length === 0, customerUses: prior.filter(b => normalizeCode(b.couponCode || '') === couponCode).length,
      });
      if (!result.ok) throw new HttpsError('failed-precondition', result.message);
      discount = result.coupon.discount;
      usedCoupon = coupons.docs.find(d => normalizeCode(d.data().code || '') === couponCode);
    }
    const fare = calculateFare({ category, route, tripType, pickupTime: when, discount, adjustment });
    if (!Number.isFinite(input.expectedFare) || fare.total !== input.expectedFare) {
      throw new HttpsError('failed-precondition', `The current fare is ₹${fare.total}. Review the updated fare and book again.`, { fare });
    }
    const breakup = buildFareBreakup(category, fare, isOutstation(route.distanceKm));
    const c = customer.data()!;
    const phone = text(c.phone);
    // Optional extras from the customer's own booking form.
    const whatsapp = phone && /^\+91[6-9]\d{9}$/.test(phone.replace(/\s/g, '')) ? whatsappContact(input.whatsapp, phone.replace(/\s/g, '')) : null;
    const email = optionalEmail(input.email) || text(c.email);
    const date = formatDate(when);
    const time = scheduled ? formatTime12(when) : 'Now';
    const bookingCode = `NT${now.getTime()}-${requestId.slice(0, 5)}`;
    const stamp = FieldValue.serverTimestamp();
    tx.create(ref, {
      id: requestId, bookingId: bookingCode, customerId: uid, customer: text(c.name), phone, ...(whatsapp ? { customerWhatsapp: whatsapp } : {}), customerEmail: email,
      pickup: pickup.name, pickupAddress: pickup.address, pickupLat: pickup.lat, pickupLng: pickup.lng, pickupLatitude: pickup.lat, pickupLongitude: pickup.lng, pickupType: pickup.type,
      drop: drop.name, dropAddress: drop.address, dropLat: drop.lat, dropLng: drop.lng, dropType: drop.type,
      service, tripType, vehicle: category.name, vehicleCategory: category.name, vehicleCategoryId: category.id,
      fare: fare.total, fareBreakdown: fare, fareBreakup: breakup, fareVerified: true, commission, distanceKm: fare.distanceKm, durationMin: fare.durationMin,
      discountDetails: fare.discountDetail, globalAdjustmentApplied: fare.globalAdjustment ?? null,
      routeEstimated: false, couponCode, discount, notes: text(input.notes), payment: 'Pending', paymentStatus: 'Unpaid',
      paymentMethod: input.paymentMethod === 'UPI' ? 'UPI' : 'Cash',
      rideTiming: scheduled ? 'scheduled' : 'now', scheduledAt: scheduled ? Timestamp.fromDate(scheduled) : null, pickupAt: Timestamp.fromDate(when),
      date, time, status: 'Pending', tripSubStatus: 'Not Started', source: 'customer', createdAt: stamp, updatedAt: stamp,
    });
    tx.create(db.doc(`booking_secrets/${requestId}`), { customerId: uid, otp: String(randomInt(1000, 10000)), createdAt: stamp });
    // Partners cannot see the trip until an admin approves the booking.
    tx.create(db.doc(`marketplace_trips/${requestId}`), marketplaceOffer({
      id: requestId, bookingCode, pickup, drop, time, date, service, tripType, category, distanceKm: fare.distanceKm,
      offeredPayout: partnerPayoutFor(fare, commission), pickupAt: when, status: AWAITING_APPROVAL,
    }));
    tx.create(ref.collection('events').doc(), { type: 'created', actorId: uid, actorRole: 'customer', at: stamp });
    auditInTx(tx, { action: 'booking_created', entity: 'booking', entityId: requestId, performedBy: uid, performedByName: text(c.name), role: 'customer', bookingId: requestId, next: { bookingCode, fare: fare.total, adjustment: fare.globalAdjustment, discount: fare.discountDetail } });
    if (usedCoupon) tx.update(usedCoupon.ref, { usedCount: FieldValue.increment(1) });
    // Serializes first-booking/per-customer coupon eligibility across concurrent requests.
    tx.update(customer.ref, { lastBookingAt: stamp });
    const n: NotifyInput = {
      recipientType: 'admin', recipientId: 'admin', category: 'bookings', severity: 'info', sound: 'new_booking',
      title: 'New booking awaiting approval', message: `${bookingCode} · ${text(c.name)} · ${pickup.name} → ${drop.name} · ${formatDateTime12(when)} · ₹${fare.total.toLocaleString('en-IN')}`,
      bookingId: requestId, bookingCode, cta: { label: 'Review booking', page: 'booking-detail', bookingId: requestId }, push: true, sentBy: uid,
    };
    pushes.push({ id: notifyInTx(tx, n), input: n });
    return { id: requestId, fare: fare.total };
  });
  await pushAfterCommit(pushes);
  return result;
});
