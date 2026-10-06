// Admin (phone / walk-in) bookings. Priced by the same server fare engine as
// customer bookings. The admin never types the base fare: it is calculated from
// the vehicle category, route, global adjustment and an optional discount. The
// only way to charge a different amount is an explicit, reasoned override that
// needs finance access and is stored with the booking and audited.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomInt } from 'crypto';
import { db } from './admin';
import { auditInTx } from './audit';
import { adminDiscountOf, marketplaceOffer, optionalEmail, pinPlace, indianPhone, whatsappContact, AWAITING_APPROVAL } from './bookingBuild';
import { PAYMENT_METHODS, summarizePayments } from './domain/bookingFlow';
import { buildFareBreakup } from './domain/fareBreakup';
import { applyFareOverride, calculateFare, isOutstation, mapCategory, serviceName } from './domain/pricing';
import { COMMISSION_NOT_CONFIGURED, buildFinanceSnapshot, partnerPayoutFor, resolveCommission } from './domain/finance';
import { distanceKm } from './domain/verification';
import { formatDate, formatDateTime12, formatTime12 } from './domain/time';
import { FareBreakdown, GeoPlace } from './domain/types';
import { effectiveAdjustment, loadFareAdjustment } from './fareConfig';
import { loadCommissionPolicy } from './commission';
import { notifyInTx, pushAfterCommit, NotifyInput } from './notify';
import { NO_BOOKABLE_CATEGORIES, approved, inIndia, requestIdOf, requirePermission, routeFor, text } from './shared';

const MAX_FARE = 1000000;
const ADMIN_SCHEDULE_MAX_DAYS = 180;

function overrideOf(v: any, calculatedTotal: number | null): { fare: number; reason: string } | null {
  if (v == null) return null;
  const fare = v.fare;
  const reason = text(v.reason, 300);
  if (!Number.isSafeInteger(fare) || fare < 1 || fare > MAX_FARE) throw new HttpsError('invalid-argument', 'Enter the override fare as a whole rupee amount.');
  if (reason.length < 10) throw new HttpsError('invalid-argument', 'Give a reason of at least 10 characters for the fare override.');
  if (calculatedTotal !== null && fare === calculatedTotal) throw new HttpsError('invalid-argument', 'The override fare is the same as the calculated fare.');
  return { fare, reason };
}

async function locationPlace(id: unknown, role: 'pickup' | 'drop'): Promise<GeoPlace> {
  const label = role === 'pickup' ? 'Pickup' : 'Drop';
  if (typeof id !== 'string' || !id) throw new HttpsError('invalid-argument', `Choose the ${role} location or drop a pin on the map.`);
  const snap = await db.doc(`locations/${id}`).get();
  const l = snap.data();
  if (!snap.exists || !l || l.status !== 'Active') throw new HttpsError('failed-precondition', `${label} location is not active.`);
  if (l.adminBookingEnabled === false || (role === 'pickup' ? l.pickupEnabled === false : l.dropEnabled === false)) {
    throw new HttpsError('failed-precondition', `${text(l.name)} is not enabled for admin ${role}s.`);
  }
  if (!inIndia(l.lat, l.lng)) throw new HttpsError('failed-precondition', `${text(l.name)} has no map coordinates. Add them in Locations to price trips from it.`);
  return { id, name: text(l.name, 120), address: text(l.address) || text(l.city), lat: l.lat, lng: l.lng, type: l.type === 'Airport' ? 'airport' : 'other' };
}

/** A map pin wins; otherwise the chosen master location. */
async function resolvePlace(input: any, role: 'pickup' | 'drop'): Promise<{ place: GeoPlace; source: 'map_pin' | 'master' }> {
  const pin = pinPlace(input[`${role}Point`], role);
  if (pin) return { place: pin, source: 'map_pin' };
  return { place: await locationPlace(input[`${role}LocationId`], role), source: 'master' };
}

export const createAdminBooking = onCall({ timeoutSeconds: 60 }, async (request) => {
  const input = request.data ?? {};
  const admin = await requirePermission(request.auth, 'operations');
  // Charging a different amount than the calculated fare is a finance decision.
  if (input.override != null && !admin.permissions.includes('finance')) {
    throw new HttpsError('permission-denied', 'Your role does not include finance access, which a fare override requires.');
  }
  // A discount changes what the customer pays, so it needs finance access too.
  if (input.discount != null && !admin.permissions.includes('finance') && !admin.permissions.includes('pricing')) {
    throw new HttpsError('permission-denied', 'Giving a discount needs pricing or finance access.');
  }
  const requestId = requestIdOf(input.requestId);
  const ref = db.doc(`bookings/${requestId}`);
  const existing = await ref.get();
  if (existing.exists) {
    if (existing.data()!.createdBy !== admin.uid) throw new HttpsError('permission-denied', 'Request already used.');
    return { id: requestId, bookingId: existing.data()!.bookingId, fare: existing.data()!.fare };
  }

  const name = text(input.customerName, 80);
  if (name.length < 2) throw new HttpsError('invalid-argument', 'Enter the customer name.');
  const phone = indianPhone(input.customerPhone);
  const whatsapp = whatsappContact(input.customerWhatsapp, phone);
  const email = optionalEmail(input.customerEmail);
  const paymentMethod = PAYMENT_METHODS.includes(input.paymentMethod) ? input.paymentMethod : null;
  if (!paymentMethod) throw new HttpsError('invalid-argument', `Choose how the customer will pay: ${PAYMENT_METHODS.join(', ')}.`);
  const tripType = input.tripType === 'Round Trip' ? 'Round Trip' : 'One Way';
  if (typeof input.categoryId !== 'string' || !input.categoryId) throw new HttpsError('invalid-argument', 'Choose a vehicle category.');
  const discountIn = adminDiscountOf(input.discount);
  const now = new Date();
  const scheduled = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (scheduled && (!Number.isFinite(scheduled.getTime()) || scheduled.getTime() < now.getTime() - 5 * 60000 || scheduled.getTime() > now.getTime() + ADMIN_SCHEDULE_MAX_DAYS * 86400000)) {
    throw new HttpsError('invalid-argument', `Choose a pickup time from now up to ${ADMIN_SCHEDULE_MAX_DAYS} days ahead.`);
  }
  const when = scheduled ?? now;
  const [pickupR, dropR] = await Promise.all([resolvePlace(input, 'pickup'), resolvePlace(input, 'drop')]);
  const pickup = pickupR.place, drop = dropR.place;
  if (distanceKm(pickup, drop) < 0.1) throw new HttpsError('invalid-argument', 'Pickup and drop must be different locations.');
  const pickupDetails = text(input.pickupAddress), dropDetails = text(input.dropAddress);
  pickup.address = pickupR.source === 'map_pin' ? [pickupDetails, pickup.address].filter(Boolean).join(', ') : pickupDetails || pickup.address;
  drop.address = dropR.source === 'map_pin' ? [dropDetails, drop.address].filter(Boolean).join(', ') : dropDetails || drop.address;
  const route = await routeFor(pickup, drop);

  const advanceIn = input.advance && typeof input.advance === 'object' ? input.advance : null;
  if (advanceIn) {
    if (!(PAYMENT_METHODS as readonly string[]).includes(advanceIn.method)) throw new HttpsError('invalid-argument', 'Choose the advance payment method.');
    if (typeof advanceIn.amount !== 'number' || !(advanceIn.amount > 0) || advanceIn.amount > MAX_FARE) throw new HttpsError('invalid-argument', 'Enter the advance amount.');
    if (advanceIn.method !== 'Cash' && text(advanceIn.reference, 120).length < 4) throw new HttpsError('invalid-argument', `Enter the ${advanceIn.method === 'UPI' ? 'UPI transaction' : 'transfer'} reference for the advance.`);
  }
  const pushes: { id: string; input: NotifyInput }[] = [];

  const result = await db.runTransaction(async (tx) => {
    pushes.length = 0; // the callback can retry; only the committed attempt may push
    const customerId = typeof input.customerId === 'string' ? input.customerId : '';
    const [previous, categories, serviceSnap, customer, policy, adjustmentDoc] = await Promise.all([
      tx.get(ref),
      tx.get(db.collection('vehicle_categories').where('status', '==', 'Active')),
      typeof input.serviceId === 'string' && input.serviceId ? tx.get(db.doc(`services/${input.serviceId}`)) : Promise.resolve(null),
      customerId ? tx.get(db.doc(`customers/${customerId}`)) : Promise.resolve(null),
      loadCommissionPolicy(tx),
      loadFareAdjustment(tx),
    ]);
    if (previous.exists) {
      if (previous.data()!.createdBy !== admin.uid) throw new HttpsError('permission-denied', 'Request already used.');
      return { id: requestId, bookingId: previous.data()!.bookingId, fare: previous.data()!.fare };
    }
    if (customer && (!customer.exists || !approved(customer.data()!.status))) throw new HttpsError('failed-precondition', 'The selected customer account is not active.');
    const configured = categories.docs.map((d) => mapCategory(d.id, d.data())).filter((c) => c !== null);
    if (!configured.length) throw new HttpsError('failed-precondition', NO_BOOKABLE_CATEGORIES);
    const category = configured.find((c) => c.id === input.categoryId);
    if (!category) throw new HttpsError('failed-precondition', 'This vehicle category is not bookable (inactive or no per-km rate).');
    let service = serviceName(pickup, drop, route.distanceKm), serviceId = '';
    if (serviceSnap) {
      if (!serviceSnap.exists || serviceSnap.data()!.status !== 'Active') throw new HttpsError('failed-precondition', 'The selected service is not active.');
      if (serviceSnap.data()!.adminBookingEnabled === false) throw new HttpsError('failed-precondition', 'The selected service is not enabled for admin bookings.');
      service = text(serviceSnap.data()!.name, 120) || service;
      serviceId = serviceSnap.id;
    }

    const adjustment = effectiveAdjustment(adjustmentDoc, now);
    const calculated = calculateFare({ category, route, tripType, pickupTime: when, adjustment, adminDiscount: discountIn });
    const breakup = buildFareBreakup(category, calculated, isOutstation(route.distanceKm));
    const commission = resolveCommission(policy, { serviceId, categoryId: category.id });
    // The admin form asks for this quote first and books against it; nothing is written.
    if (input.quoteOnly === true) {
      return { quote: calculated, breakup, service, categoryName: category.name, commissionConfigured: !!commission, adjustmentApplied: calculated.globalAdjustment };
    }
    if (!commission) throw new HttpsError('failed-precondition', COMMISSION_NOT_CONFIGURED);
    if (!Number.isFinite(input.expectedFare) || input.expectedFare !== calculated.total) {
      throw new HttpsError('failed-precondition', `The calculated fare is ₹${calculated.total}. Review it and submit again.`, { fare: calculated });
    }
    const override = overrideOf(input.override, calculated.total);
    const fare = override ? applyFareOverride(calculated, override.fare) : calculated;
    if (advanceIn && advanceIn.amount > fare.total) throw new HttpsError('invalid-argument', `The advance cannot be more than the fare (₹${fare.total}).`);

    const date = formatDate(when);
    const time = scheduled ? formatTime12(when) : 'Now';
    const bookingCode = `NT${now.getTime()}-${requestId.slice(0, 5)}`;
    const stamp = FieldValue.serverTimestamp();
    const fareOverride = override
      ? { calculatedFare: calculated.total, overriddenFare: override.fare, reason: override.reason, byUid: admin.uid, byName: admin.name, at: Timestamp.now() }
      : null;
    const advanceTxn = advanceIn ? {
      id: `adv_${requestId.slice(0, 20)}`, bookingId: requestId, bookingCode, amount: advanceIn.amount, method: advanceIn.method, kind: 'advance', status: 'Success',
      collectorType: 'admin', collectorId: admin.uid, collectorName: admin.name, paymentDate: Timestamp.fromDate(now), reference: text(advanceIn.reference, 120),
      notes: text(advanceIn.notes, 300), enteredBy: admin.uid, enteredByRole: 'admin', enteredByName: admin.name, createdAt: stamp,
    } : null;
    const summary = summarizePayments(fare.total, advanceTxn ? [{ amount: advanceTxn.amount, method: advanceTxn.method, kind: 'advance', collectorType: 'admin', status: 'Success' }] : []);
    tx.create(ref, {
      id: requestId, bookingId: bookingCode, customerId, customer: name, phone, customerWhatsapp: whatsapp,
      customerEmail: email || (customer ? text(customer.data()!.email) : ''),
      pickup: pickup.name, pickupAddress: pickup.address, pickupLat: pickup.lat, pickupLng: pickup.lng, pickupLatitude: pickup.lat, pickupLongitude: pickup.lng,
      pickupType: pickup.type, pickupLocationId: pickupR.source === 'master' ? pickup.id : '', pickupSource: pickupR.source,
      drop: drop.name, dropAddress: drop.address, dropLat: drop.lat, dropLng: drop.lng, dropType: drop.type, dropLocationId: dropR.source === 'master' ? drop.id : '', dropSource: dropR.source,
      service, serviceId, tripType, vehicle: category.name, vehicleCategory: category.name, vehicleCategoryId: category.id,
      fare: fare.total, fareBreakdown: fare, fareBreakup: breakup, fareVerified: true, fareOverride, commission, distanceKm: fare.distanceKm, durationMin: fare.durationMin,
      discountDetails: fare.discountDetail ? { ...fare.discountDetail, byUid: admin.uid, byName: admin.name } : null,
      globalAdjustmentApplied: fare.globalAdjustment ?? null,
      routeEstimated: false, couponCode: '', discount: fare.discount, notes: text(input.notes), payment: summary.status === 'Paid' ? 'Paid' : 'Pending', paymentStatus: summary.status,
      paymentSummary: { ...summary, updatedAt: Timestamp.now() }, paymentMethod,
      rideTiming: scheduled ? 'scheduled' : 'now', scheduledAt: scheduled ? Timestamp.fromDate(scheduled) : null, pickupAt: Timestamp.fromDate(when),
      date, time, status: 'Pending', tripSubStatus: 'Not Started', source: 'admin', createdBy: admin.uid, createdByName: admin.name, createdAt: stamp, updatedAt: stamp,
    });
    const otp = String(randomInt(1000, 10000));
    tx.create(db.doc(`booking_secrets/${requestId}`), { customerId, otp, createdAt: stamp });
    // Hidden from drivers and vendors until an admin approves the booking.
    tx.create(db.doc(`marketplace_trips/${requestId}`), marketplaceOffer({
      id: requestId, bookingCode, pickup, drop, time, date, service, tripType, category, distanceKm: fare.distanceKm,
      offeredPayout: partnerPayoutFor(fare, commission), pickupAt: when, status: AWAITING_APPROVAL,
    }));
    if (advanceTxn) {
      tx.create(db.doc(`bookings/${requestId}/payment_transactions/${advanceTxn.id}`), advanceTxn);
      tx.set(db.doc(`payments/${requestId}_${advanceTxn.id}`), {
        id: `${requestId}_${advanceTxn.id}`, bookingId: bookingCode, bookingDocumentId: requestId, customerId, customer: name, amount: advanceTxn.amount,
        method: advanceTxn.method, status: 'Success', gateway: 'Received by NESAM', reference: advanceTxn.reference, date: now.toISOString(), verifiedBy: admin.uid,
        collectorType: 'admin', collectorId: admin.uid, collectorName: admin.name, kind: 'advance', createdAt: stamp,
      });
    }
    tx.create(ref.collection('events').doc(), { type: 'created', actorId: admin.uid, actorRole: 'admin', at: stamp });
    if (override) {
      tx.create(ref.collection('events').doc(), {
        type: 'fare_override', actorId: admin.uid, actorRole: 'admin', calculatedFare: calculated.total, fare: override.fare, reason: override.reason, at: stamp,
      });
    }
    auditInTx(tx, {
      action: 'booking_created', entity: 'booking', entityId: requestId, performedBy: admin.uid, performedByName: admin.name, role: 'admin', bookingId: requestId,
      next: { bookingCode, fare: fare.total, calculatedFare: calculated.total, discount: fare.discountDetail, adjustment: fare.globalAdjustment, advance: advanceTxn?.amount ?? 0, pickupSource: pickupR.source },
    });
    if (override) {
      auditInTx(tx, { action: 'fare_override', entity: 'booking', entityId: requestId, performedBy: admin.uid, performedByName: admin.name, role: 'admin', bookingId: requestId, previous: { fare: calculated.total }, next: { fare: override.fare }, reason: override.reason });
    }
    if (fare.discountDetail) {
      auditInTx(tx, { action: 'discount_applied', entity: 'booking', entityId: requestId, performedBy: admin.uid, performedByName: admin.name, role: 'admin', bookingId: requestId, next: fare.discountDetail, reason: fare.discountDetail.reason });
    }
    const n: NotifyInput = {
      recipientType: 'admin', recipientId: 'admin', category: 'bookings', severity: 'info', sound: 'new_booking',
      title: 'New booking awaiting approval',
      message: `${bookingCode} · ${name} · ${pickup.name} → ${drop.name} · ${formatDateTime12(when)} · ₹${fare.total.toLocaleString('en-IN')}`,
      bookingId: requestId, bookingCode, cta: { label: 'Review booking', page: 'booking-detail', bookingId: requestId }, push: true, sentBy: admin.uid,
    };
    pushes.push({ id: notifyInTx(tx, n), input: n });
    return { id: requestId, bookingId: bookingCode, fare: fare.total, calculatedFare: calculated.total, otp };
  });
  await pushAfterCommit(pushes);
  return result;
});

/** Legacy bookings (no server breakdown) get a breakdown whose only component is the admin fare. */
function baseBreakdown(b: FirebaseFirestore.DocumentData): FareBreakdown {
  const fb = b.fareBreakdown;
  if (fb && typeof fb === 'object' && Number.isFinite(fb.total) && Number.isFinite(fb.subtotal)) return fb as FareBreakdown;
  const km = Number(b.distanceKm);
  return {
    baseFare: 0, distanceFare: 0, timeFare: 0, nightCharge: 0, driverAllowance: 0, minimumFareAdjustment: 0, adminAdjustment: 0,
    subtotal: 0, discount: 0, taxableAmount: 0, gstRate: 0.05, gst: 0, total: 0,
    distanceKm: Number.isFinite(km) ? km : 0, durationMin: 0, perKmRate: 0, perMinuteRate: 0,
  };
}

export const overrideBookingFare = onCall(async (request) => {
  const admin = await requirePermission(request.auth, 'finance');
  const input = request.data ?? {};
  if (typeof input.bookingId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.bookingId)) throw new HttpsError('invalid-argument', 'Invalid booking.');
  const ref = db.doc(`bookings/${input.bookingId}`);
  const market = db.doc(`marketplace_trips/${input.bookingId}`);
  const tripEntryRef = db.doc(`wallet_ledger/trip_${input.bookingId}`);
  return db.runTransaction(async (tx) => {
    const [snap, trip, tripEntry] = await Promise.all([tx.get(ref), tx.get(market), tx.get(tripEntryRef)]);
    if (!snap.exists) throw new HttpsError('not-found', 'Booking not found.');
    const b = snap.data()!;
    if (b.status === 'Cancelled' || b.status === 'Rejected') throw new HttpsError('failed-precondition', 'Cancelled or rejected bookings cannot be repriced.');
    if (b.payment === 'Paid' || b.paymentStatus === 'Paid') throw new HttpsError('failed-precondition', 'This booking is already paid. Refund or adjust the payment instead.');
    if (b.invoiceId) throw new HttpsError('failed-precondition', `Invoice ${text(b.invoiceNumber) || b.invoiceId} exists for this trip. Void it before changing the fare.`);
    const base = baseBreakdown(b);
    const calculatedFare = b.fareOverride?.calculatedFare ?? (base.total > 0 ? base.total : null);
    const override = overrideOf(input, null)!;
    // Legacy fares may be stored as text such as "₹1,500".
    const previousFare = Number(String(b.fare ?? '').replace(/[^\d.]/g, '')) || 0;
    // Confirming the same amount is allowed only to verify an unverified legacy fare.
    if (override.fare === previousFare && b.fareVerified === true) throw new HttpsError('invalid-argument', 'The new fare is the same as the current fare.');
    const payout = Math.max(Number(b.driverPayout) || 0, Number(b.vendorPayout) || 0);
    if (override.fare < payout) throw new HttpsError('failed-precondition', `The fare cannot be below the ₹${payout} already agreed with the partner.`);
    const fare = applyFareOverride(base, override.fare);
    const stamp = FieldValue.serverTimestamp();
    // A completed but unpaid trip's finance snapshot follows the audited fare
    // change; the agreed partner payout never changes.
    const revised = b.finance && b.finance.schema === 1 ? buildFinanceSnapshot({ ...b, fare: fare.total, fareBreakdown: fare }) : null;
    tx.update(ref, {
      fare: fare.total, fareBreakdown: fare, fareVerified: true,
      fareOverride: { calculatedFare, overriddenFare: override.fare, previousFare, reason: override.reason, byUid: admin.uid, byName: admin.name, at: Timestamp.now() },
      ...(revised ? { finance: { ...revised, finalizedAt: b.finance.finalizedAt ?? stamp, revisedAt: stamp } } : {}),
      updatedAt: stamp,
    });
    if (revised && tripEntry.exists && tripEntry.data()!.schema === 2 && tripEntry.data()!.status === 'pending') {
      tx.update(tripEntryRef, { grossAmount: revised.fareTotal, commissionAmount: revised.platformRevenue ?? 0 });
    }
    // An unclaimed marketplace offer follows the new fare at the commission the
    // booking was published under; bookings from before the policy keep their offer.
    const c = b.commission;
    if (trip.exists && ['Open', 'Bidding', AWAITING_APPROVAL].includes(trip.data()!.status) && c && typeof c.rate === 'number' && (c.base === 'taxable' || c.base === 'total')) {
      tx.update(market, { offeredPayout: partnerPayoutFor(fare, c), updatedAt: stamp });
    }
    tx.create(ref.collection('events').doc(), {
      type: 'fare_override', actorId: admin.uid, actorRole: 'admin', previousFare, calculatedFare, fare: fare.total, reason: override.reason, at: stamp,
    });
    auditInTx(tx, { action: 'fare_override', entity: 'booking', entityId: input.bookingId, performedBy: admin.uid, performedByName: admin.name, role: 'admin', bookingId: input.bookingId, previous: { fare: previousFare }, next: { fare: fare.total }, reason: override.reason });
    return { fare: fare.total };
  });
});
