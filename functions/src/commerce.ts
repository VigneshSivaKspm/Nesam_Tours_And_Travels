import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomInt } from 'crypto';
import { db } from './admin';
import { calculateFare, mapCategory, mapCoupon, normalizeCode, serviceName, validateCoupon } from './domain/pricing';
import { DEFAULT_RIDE_CATEGORIES } from './domain/defaults';
import { GeoPlace, RouteInfo } from './domain/types';

const approved = (s: unknown) => ['Approved', 'APPROVED', 'Active'].includes(String(s));
const text = (v: unknown, max = 300) => typeof v === 'string' ? v.trim().slice(0, max) : '';
function id(v: unknown): string {
  if (typeof v !== 'string' || !/^[a-zA-Z0-9_-]{10,100}$/.test(v)) throw new HttpsError('invalid-argument', 'Invalid request ID.');
  return v;
}
function place(v: any): GeoPlace {
  if (!v || !Number.isFinite(v.lat) || !Number.isFinite(v.lng) || v.lat < 6.5 || v.lat > 35.7 || v.lng < 68.1 || v.lng > 97.4) {
    throw new HttpsError('invalid-argument', 'Choose valid pickup and drop locations in India.');
  }
  return { id: 'pin', name: text(v.name, 120), address: text(v.address), lat: v.lat, lng: v.lng, type: v.type === 'airport' ? 'airport' : 'other' };
}

async function routeFor(a: GeoPlace, b: GeoPlace): Promise<RouteInfo> {
  // Never accept distance or duration from the customer's request.
  const base = (process.env.ROUTING_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
  try {
    const response = await fetch(`${base}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('routing unavailable');
    const result = await response.json() as any;
    const r = result.code === 'Ok' && result.routes?.[0];
    if (!r || !Number.isFinite(r.distance) || r.distance <= 0 || !Number.isFinite(r.duration) || r.duration <= 0) throw new Error('invalid route');
    return { distanceKm: r.distance / 1000, durationMin: r.duration / 60, estimated: false, path: [] };
  } catch {
    throw new HttpsError('unavailable', 'Route pricing is temporarily unavailable. Please try again.');
  }
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
  const pickup = place(input.pickup), drop = place(input.drop);
  const route = await routeFor(pickup, drop);
  const tripType = input.tripType === 'Round Trip' ? 'Round Trip' : 'One Way';
  const now = new Date();
  const scheduled = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (scheduled && (!Number.isFinite(scheduled.getTime()) || scheduled.getTime() < now.getTime() + 30 * 60000 || scheduled.getTime() > now.getTime() + 30 * 86400000)) {
    throw new HttpsError('invalid-argument', 'Schedule pickup between 30 minutes and 30 days ahead.');
  }
  const when = scheduled ?? now;
  return db.runTransaction(async (tx) => {
    const [previous, customer, categories, coupons, history] = await Promise.all([
      tx.get(ref), tx.get(db.doc(`customers/${uid}`)),
      tx.get(db.collection('vehicle_categories').where('status', '==', 'Active')),
      tx.get(db.collection('coupons')),
      tx.get(db.collection('bookings').where('customerId', '==', uid)),
    ]);
    if (!customer.exists || !approved(customer.data()!.status)) throw new HttpsError('permission-denied', 'Your account is not active.');
    if (previous.exists) {
      if (previous.data()!.customerId !== uid) throw new HttpsError('permission-denied', 'Request already used.');
      return { id: requestId, fare: previous.data()!.fare };
    }
    if (!scheduled && history.docs.some(d => ['Pending', 'Confirmed', 'Assigned', 'Ongoing'].includes(d.data().status) && d.data().rideTiming !== 'scheduled')) {
      throw new HttpsError('failed-precondition', 'You already have a ride in progress. Open Trips to continue it.');
    }
    const configured = categories.docs.map(d => mapCategory(d.id, d.data())).filter(c => c !== null);
    const category = (configured.length ? configured : DEFAULT_RIDE_CATEGORIES).find(c => c.id === input.categoryId);
    if (!category) throw new HttpsError('failed-precondition', 'This vehicle category is no longer available.');
    const service = serviceName(pickup, drop, route.distanceKm);
    const beforeDiscount = calculateFare({ category, route, tripType, pickupTime: when });
    const couponCode = normalizeCode(text(input.couponCode, 50));
    let discount = 0, usedCoupon;
    if (couponCode) {
      const prior = history.docs.map(d => d.data()).filter(b => b.status !== 'Cancelled');
      const result = validateCoupon(coupons.docs.map(d => mapCoupon(d.id, d.data())), couponCode, {
        subtotal: beforeDiscount.subtotal, categoryId: category.id, service,
        isFirstBooking: prior.length === 0, customerUses: prior.filter(b => normalizeCode(b.couponCode || '') === couponCode).length,
      });
      if (!result.ok) throw new HttpsError('failed-precondition', result.message);
      discount = result.coupon.discount;
      usedCoupon = coupons.docs.find(d => normalizeCode(d.data().code || '') === couponCode);
    }
    const fare = calculateFare({ category, route, tripType, pickupTime: when, discount });
    if (!Number.isFinite(input.expectedFare) || fare.total !== input.expectedFare) {
      throw new HttpsError('failed-precondition', `The current fare is ₹${fare.total}. Review the updated fare and book again.`, { fare });
    }
    const c = customer.data()!;
    const date = when.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
    const time = scheduled ? when.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : 'Now';
    const bookingCode = `NT${now.getTime()}-${requestId.slice(0, 5)}`;
    const stamp = FieldValue.serverTimestamp();
    tx.create(ref, {
      id: requestId, bookingId: bookingCode, customerId: uid, customer: text(c.name), phone: text(c.phone), customerEmail: text(c.email),
      pickup: pickup.name, pickupAddress: pickup.address, pickupLat: pickup.lat, pickupLng: pickup.lng, pickupType: pickup.type,
      drop: drop.name, dropAddress: drop.address, dropLat: drop.lat, dropLng: drop.lng, dropType: drop.type,
      service, tripType, vehicle: category.name, vehicleCategory: category.name, vehicleCategoryId: category.id,
      fare: fare.total, fareBreakdown: fare, fareVerified: true, distanceKm: fare.distanceKm, durationMin: fare.durationMin,
      routeEstimated: false, couponCode, discount, notes: text(input.notes), payment: 'Pending',
      paymentMethod: input.paymentMethod === 'UPI' ? 'UPI' : 'Cash',
      rideTiming: scheduled ? 'scheduled' : 'now', scheduledAt: scheduled ? Timestamp.fromDate(scheduled) : null,
      date, time, status: 'Pending', source: 'customer', createdAt: stamp, updatedAt: stamp,
    });
    tx.create(db.doc(`booking_secrets/${requestId}`), { customerId: uid, otp: String(randomInt(1000, 10000)), createdAt: stamp });
    tx.create(db.doc(`marketplace_trips/${requestId}`), {
      id: requestId, bookingId: bookingCode, route: `${pickup.name} → ${drop.name}`,
      pickup: { address: pickup.address, city: pickup.name, lat: pickup.lat, lng: pickup.lng, time },
      drop: { address: drop.address, city: drop.name, lat: drop.lat, lng: drop.lng }, travelDate: date,
      service, tripType, vehicleCategory: category.name, vehicleCategoryId: category.id,
      distanceKm: fare.distanceKm, offeredPayout: Math.round(fare.total * 0.85), status: 'Open', createdAt: stamp,
    });
    tx.create(ref.collection('events').doc(), { type: 'created', actorId: uid, actorRole: 'customer', at: stamp });
    if (usedCoupon) tx.update(usedCoupon.ref, { usedCount: FieldValue.increment(1) });
    // Serializes first-booking/per-customer coupon eligibility across concurrent requests.
    tx.update(customer.ref, { lastBookingAt: stamp });
    return { id: requestId, fare: fare.total };
  });
});

export const requestPartnerPayout = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const input = request.data ?? {};
  if (!['driver', 'vendor'].includes(input.role)) throw new HttpsError('invalid-argument', 'Choose a partner role.');
  if (!Number.isSafeInteger(input.amount) || input.amount < 100 || input.amount > 10000000) throw new HttpsError('invalid-argument', 'Enter a valid payout amount of at least ₹100.');
  if (input.role === 'vendor' && input.amount < 500) throw new HttpsError('invalid-argument', 'Minimum fleet payout is ₹500.');
  if (!['UPI', 'Bank Transfer'].includes(input.method)) throw new HttpsError('invalid-argument', 'Invalid payout method.');
  const role: 'driver' | 'vendor' = input.role;
  const key = `${role}Id`;
  const ref = db.doc(`payout_requests/${id(input.requestId)}`);
  const lock = db.doc(`payout_locks/${role}_${uid}`);
  return db.runTransaction(async tx => {
    const [profile, existing, , trips, payouts, privateDoc] = await Promise.all([
      tx.get(db.doc(`${role}s/${uid}`)), tx.get(ref), tx.get(lock),
      tx.get(db.collection('bookings').where(role === 'driver' ? 'assignedDriverId' : 'assignedVendorId', '==', uid)),
      tx.get(db.collection('payout_requests').where(key, '==', uid)),
      tx.get(db.doc(`${role === 'driver' ? 'driver_private' : 'vendor_kyc'}/${uid}`)),
    ]);
    if (!profile.exists || !approved(profile.data()!.status)) throw new HttpsError('permission-denied', 'Partner account is not approved.');
    if (existing.exists) {
      if (existing.data()![key] !== uid) throw new HttpsError('permission-denied', 'Request already used.');
      return { id: ref.id };
    }
    const revenue = trips.docs.reduce((sum, d) => {
      const b = d.data();
      // Cash collected by a partner is not also payable by the platform.
      // Legacy/unverified trips require an admin reconciliation before payout.
      if (b.status !== 'Completed' || b.payment !== 'Paid' || b.paymentMethod === 'Cash' || b.fareVerified !== true) return sum;
      if (role === 'driver' && b.assignedVendorId) return sum; // fleet revenue belongs to the vendor
      const share = Number(role === 'driver' ? b.driverPayout : b.vendorPayout);
      const tolls = b.tollsApproved === true ? Number(b.tollCharges || 0) : 0;
      return sum + (Number.isFinite(share) && share >= 0 ? share : 0) + (Number.isFinite(tolls) && tolls >= 0 ? tolls : 0);
    }, 0);
    const reserved = payouts.docs.reduce((sum, d) => ['Rejected', 'Cancelled'].includes(d.data().status) ? sum : sum + Number(d.data().amount || 0), 0);
    const available = Math.max(0, Math.floor(revenue - reserved));
    if (input.amount > available) throw new HttpsError('failed-precondition', `Available settled balance is ₹${available}. Cash trips and unverified payments cannot be withdrawn.`);
    const destination = privateDoc.data();
    const bank = role === 'driver' ? destination?.bank : destination?.payout;
    if (!bank || (input.method === 'UPI' ? !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(String(bank.upiId || '')) : !/^\d{8,20}$/.test(String(bank.accountNumber || '')) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(bank.ifsc || '')))) throw new HttpsError('failed-precondition', 'Save valid payout details in your profile first.');
    const details = input.method === 'UPI' ? text(bank.upiId) : `Account ending ${String(bank.accountNumber).slice(-4)} · ${text(bank.ifsc)}`;
    tx.create(ref, { id: ref.id, [key]: uid, [`${role}Name`]: text(profile.data()!.companyName || profile.data()!.name), amount: input.amount,
      method: input.method, details, status: 'Pending', createdAt: FieldValue.serverTimestamp(), requestedAt: new Date().toISOString() });
    tx.set(lock, { updatedAt: FieldValue.serverTimestamp() });
    return { id: ref.id };
  });
});


