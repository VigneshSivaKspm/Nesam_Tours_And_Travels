import { getFunctions, httpsCallable } from 'firebase/functions';
// Ride lifecycle for the customer: request → dispatch → live tracking →
// completion, cancellation, rating and SOS.
//
// Booking creation uses the server callable for pricing and atomic dispatch.
// Customer updates remain constrained by firestore.rules. Live location comes
// from the assigned driver's driverLocation field on the booking.

import { collection, doc, onSnapshot, query, serverTimestamp, Timestamp, where, writeBatch } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { db } from '../config/firebase';
import {
  FREE_CANCEL_AFTER_ASSIGN_MS,
  INSTANT_CANCELLATION_FEE,
  PARTNER_PAYOUT_SHARE,
  SCHEDULED_CANCELLATION_FEE,
  SCHEDULED_FREE_CANCEL_BEFORE_MS,
} from '../config/constants';
import type {
  BookingStatus,
  DriverCard,
  DriverLocation,
  FareBreakdown,
  GeoPlace,
  LatLng,
  PaymentMethod,
  RideCategory,
  RidePhase,
  RouteInfo,
  TripRecord,
  TripStage,
  TripType,
  UserProfile,
} from '../types';
import { formatDate, formatTime, num, str, toDate } from '../utils/format';
import { isValidLatLng } from '../utils/geo';
import { withTimeout, errorCode } from '../utils/retry';
import { serviceName } from './pricingService';

export const BOOKINGS = 'bookings';
const SECRETS = 'booking_secrets';
const MARKETPLACE = 'marketplace_trips';
const REVIEWS = 'reviews';
const SOS = 'sos_alerts';

// ── Mapping ─────────────────────────────────────────────────────────────────

const STATUSES: BookingStatus[] = ['Pending', 'Confirmed', 'Assigned', 'Ongoing', 'Completed', 'Cancelled'];
const STAGES: TripStage[] = ['Assigned', 'En Route Pickup', 'Reached Pickup', 'In Progress', 'Arrived Destination', 'Completed'];

/** Also maps labels written by older builds of the panels. */
export function normalizeStatus(raw: string): BookingStatus {
  if ((STATUSES as string[]).includes(raw)) return raw as BookingStatus;
  if (raw === 'Trip Started' || raw === 'In Progress') return 'Ongoing';
  if (raw === 'Driver Assigned' || raw === 'Driver Near Pickup' || raw === 'Driver Arrived') return 'Assigned';
  return 'Pending';
}

export function derivePhase(status: BookingStatus, stage: TripStage | null, hasDriver = true): RidePhase {
  switch (status) {
    case 'Cancelled':
      return 'cancelled';
    case 'Completed':
      return 'completed';
    case 'Ongoing':
      return 'in_trip';
    case 'Assigned':
      if (!hasDriver) return 'partner_confirmed';
      if (stage === 'Reached Pickup') return 'driver_arrived';
      if (stage === 'In Progress' || stage === 'Arrived Destination') return 'in_trip';
      return 'driver_en_route';
    case 'Confirmed':
      return 'partner_confirmed';
    default:
      return 'searching';
  }
}

function place(prefix: 'pickup' | 'drop', d: Record<string, unknown>): GeoPlace {
  const name = str(d[prefix]) || (prefix === 'pickup' ? 'Pickup' : 'Destination');
  const lat = d[`${prefix}Lat`];
  const lng = d[`${prefix}Lng`];
  return {
    id: `${prefix}`,
    name,
    address: str(d[`${prefix}Address`]) || name,
    type: d[`${prefix}Type`] === 'airport' ? 'airport' : 'other',
    lat: typeof lat === 'number' ? lat : NaN,
    lng: typeof lng === 'number' ? lng : NaN,
  };
}

function mapFareBreakdown(v: unknown): FareBreakdown | null {
  if (!v || typeof v !== 'object') return null;
  const f = v as Record<string, unknown>;
  const keys: (keyof FareBreakdown)[] = [
    'baseFare', 'distanceFare', 'timeFare', 'nightCharge', 'driverAllowance', 'minimumFareAdjustment',
    'subtotal', 'discount', 'taxableAmount', 'gstRate', 'gst', 'total', 'distanceKm', 'durationMin',
    'perKmRate', 'perMinuteRate',
  ];
  const out = {} as FareBreakdown;
  for (const k of keys) out[k] = num(f[k]);
  return out;
}

function mapDriverLocation(v: unknown): DriverLocation | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const loc = { lat: num(o.lat, NaN), lng: num(o.lng, NaN) };
  if (!isValidLatLng(loc)) return null;
  return { ...loc, heading: typeof o.heading === 'number' ? o.heading : null, updatedAt: toDate(o.updatedAt ?? o.at) };
}

export function mapBooking(id: string, d: Record<string, unknown>): TripRecord {
  const status = normalizeStatus(str(d.status));
  const stage = (STAGES as string[]).includes(str(d.tripStage)) ? (d.tripStage as TripStage) : null;
  const scheduledAt = toDate(d.scheduledAt);
  const createdAt = toDate(d.createdAt);
  const when = scheduledAt ?? createdAt;
  const driverId = str(d.assignedDriverId);
  const driver: DriverCard | null = driverId
    ? {
        id: driverId,
        name: str(d.assignedDriverName || d.driver) || 'Your driver',
        phone: str(d.driverPhone),
        photoUrl: str(d.driverPhotoUrl),
        rating: typeof d.driverRating === 'number' ? d.driverRating : null,
        vehicleModel: str(d.assignedVehicleModel),
        vehicleNumber: str(d.assignedVehicleNumber),
      }
    : null;

  return {
    id,
    bookingId: str(d.bookingId) || id,
    customerId: str(d.customerId),
    pickup: place('pickup', d),
    drop: place('drop', d),
    service: str(d.service) || 'Local',
    tripType: d.tripType === 'Round Trip' ? 'Round Trip' : 'One Way',
    categoryId: str(d.vehicleCategoryId),
    categoryName: str(d.vehicleCategory || d.vehicle) || 'Cab',
    status,
    tripStage: stage,
    phase: derivePhase(status, stage, !!driverId),
    fare: num(d.fare),
    fareBreakdown: mapFareBreakdown(d.fareBreakdown),
    tollCharges: num(d.tollCharges),
    couponCode: str(d.couponCode),
    paymentMethod: str(d.paymentMethod) || 'Cash',
    paymentStatus: str(d.payment) || 'Pending',
    distanceKm: num(d.distanceKm),
    durationMin: num(d.durationMin),
    notes: str(d.notes),
    isScheduled: d.rideTiming === 'scheduled',
    scheduledAt,
    createdAt,
    assignedAt: toDate(d.assignedAt),
    startedAt: toDate(d.startedAt),
    completedAt: toDate(d.completedAt),
    cancelledAt: toDate(d.cancelledAt),
    cancelReason: str(d.cancelReason),
    cancelledBy: str(d.cancelledBy),
    cancellationFee: num(d.cancellationFee),
    driver,
    driverLocation: mapDriverLocation(d.driverLocation),
    assignedVendorName: str(d.assignedVendorName),
    rating: typeof d.rating === 'number' ? d.rating : null,
    reviewComment: str(d.reviewComment),
    date: str(d.date) || (when ? formatDate(when) : ''),
    time: str(d.time) || (when ? formatTime(when) : ''),
  };
}

export function isActiveStatus(s: BookingStatus): boolean {
  return s === 'Pending' || s === 'Confirmed' || s === 'Assigned' || s === 'Ongoing';
}

/**
 * A ride that should take over the home screen: anything underway, or an
 * instant request / a scheduled ride whose pickup is within the hour.
 */
export function isLiveRide(t: TripRecord, now = Date.now()): boolean {
  if (t.status === 'Ongoing') return true;
  if (!isActiveStatus(t.status)) return false;
  if (!t.isScheduled || !t.scheduledAt) return true;
  return t.scheduledAt.getTime() - now <= 60 * 60 * 1000;
}

// ── Subscriptions ───────────────────────────────────────────────────────────

export function subscribeToUserBookings(
  customerId: string,
  cb: (trips: TripRecord[]) => void,
  onError?: (e: unknown) => void,
): () => void {
  return onSnapshot(
    query(collection(db, BOOKINGS), where('customerId', '==', customerId)),
    (snap) => {
      const trips = snap.docs.map((d) => mapBooking(d.id, d.data()));
      trips.sort((a, b) => (b.createdAt?.getTime() ?? Infinity) - (a.createdAt?.getTime() ?? Infinity));
      cb(trips);
    },
    (err) => onError?.(err),
  );
}

export interface BookingSnapshot {
  trip: TripRecord | null;
  /** Written locally but not yet acknowledged by the server. */
  pending: boolean;
  /** Served from the local cache. */
  fromCache: boolean;
}

export function subscribeToBooking(id: string, cb: (s: BookingSnapshot) => void, onError?: (e: unknown) => void): () => void {
  return onSnapshot(
    doc(db, BOOKINGS, id),
    { includeMetadataChanges: true },
    (snap) =>
      cb({
        trip: snap.exists() ? mapBooking(snap.id, snap.data()) : null,
        pending: snap.metadata.hasPendingWrites,
        fromCache: snap.metadata.fromCache,
      }),
    (err) => onError?.(err),
  );
}

/** Boarding OTP lives in booking_secrets so drivers can never read it. */
export function subscribeToBoardingOtp(id: string, cb: (otp: string | null) => void): () => void {
  return onSnapshot(
    doc(db, SECRETS, id),
    (snap) => cb(snap.exists() ? str(snap.data().otp) || null : null),
    () => cb(null),
  );
}

// ── Create ──────────────────────────────────────────────────────────────────

function randomUint32(): number {
  const buf = new Uint32Array(1);
  Crypto.getRandomValues(buf);
  return buf[0] ?? 0;
}

export function generateOtp(rand: () => number = randomUint32): string {
  return String(1000 + (rand() % 9000));
}

export function generateBookingCode(now: Date, rand: () => number = randomUint32): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tail = '';
  let n = rand();
  for (let i = 0; i < 5; i++) {
    tail += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length);
  }
  return `NT${yy}${mm}${dd}-${tail}`;
}

export interface RideRequestInput {
  profile: UserProfile;
  pickup: GeoPlace;
  drop: GeoPlace;
  category: RideCategory;
  route: RouteInfo;
  fare: FareBreakdown;
  tripType: TripType;
  paymentMethod: PaymentMethod;
  couponCode: string;
  notes: string;
  scheduledAt: Date | null;
}

export interface RideRequestResult {
  id: string;
  /** true when the server hadn't acknowledged within the wait window. */
  unconfirmed: boolean;
}

/** Document payloads for a new ride request (exported for the rules tests). */
export function buildRideRequestDocs(input: RideRequestInput, bookingDocId: string, now: Date, otp: string, bookingCode: string) {
  const { profile, pickup, drop, category, route, fare, tripType, paymentMethod, couponCode, notes, scheduledAt } = input;
  const when = scheduledAt ?? now;
  const service = serviceName(pickup, drop, route.distanceKm);
  const date = formatDate(when);
  const time = scheduledAt ? formatTime(scheduledAt) : 'Now';
  return {
    booking: {
      id: bookingDocId,
      bookingId: bookingCode,
      customerId: profile.uid,
      customer: profile.name,
      phone: profile.phone,
      customerEmail: profile.email,
      pickup: pickup.name,
      pickupAddress: pickup.address,
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      pickupType: pickup.type,
      drop: drop.name,
      dropAddress: drop.address,
      dropLat: drop.lat,
      dropLng: drop.lng,
      dropType: drop.type,
      service,
      tripType,
      vehicle: category.name,
      vehicleCategory: category.name,
      vehicleCategoryId: category.id,
      fare: fare.total,
      fareBreakdown: fare,
      distanceKm: fare.distanceKm,
      durationMin: fare.durationMin,
      routeEstimated: route.estimated,
      couponCode: couponCode || '',
      discount: fare.discount,
      notes: notes.trim().slice(0, 300),
      payment: 'Pending',
      paymentMethod,
      rideTiming: scheduledAt ? 'scheduled' : 'now',
      scheduledAt: scheduledAt ? Timestamp.fromDate(scheduledAt) : null,
      date,
      time,
      status: 'Pending',
      source: 'customer-app',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    secret: {
      customerId: profile.uid,
      otp,
      createdAt: serverTimestamp(),
    },
    marketplace: {
      id: bookingDocId,
      bookingId: bookingCode,
      route: `${pickup.name} ➔ ${drop.name}`,
      pickup: { address: pickup.address, city: pickup.name, lat: pickup.lat, lng: pickup.lng, time },
      drop: { address: drop.address, city: drop.name, lat: drop.lat, lng: drop.lng },
      travelDate: date,
      service,
      tripType,
      vehicleCategory: category.name,
      vehicleCategoryId: category.id,
      distanceKm: fare.distanceKm,
      offeredPayout: Math.round(fare.total * PARTNER_PAYOUT_SHARE),
      status: 'Open',
      createdAt: serverTimestamp(),
    },
  };
}

// Reuse a request ID after an uncertain transport failure; the server deduplicates it.
const pendingBookingIds = new Map<string, string>();
export async function createRideRequest(input: RideRequestInput): Promise<RideRequestResult> {
  const key = JSON.stringify([input.profile.uid, input.pickup.lat, input.pickup.lng, input.drop.lat, input.drop.lng, input.category.id, input.tripType, input.scheduledAt?.toISOString(), input.couponCode]);
  const requestId = pendingBookingIds.get(key) ?? doc(collection(db, BOOKINGS)).id;
  pendingBookingIds.set(key, requestId);
  const call = httpsCallable(getFunctions(), 'createBooking', { timeout: 60000 });
  await call({ requestId, pickup: input.pickup, drop: input.drop,
    categoryId: input.category.id, tripType: input.tripType, expectedFare: input.fare.total,
    paymentMethod: input.paymentMethod, couponCode: input.couponCode, notes: input.notes,
    scheduledAt: input.scheduledAt?.toISOString() ?? null });
  pendingBookingIds.delete(key);
  return { id: requestId, unconfirmed: false };
}
// ── Cancel ──────────────────────────────────────────────────────────────────

export interface CancellationQuote {
  allowed: boolean;
  fee: number;
  explanation: string;
}

export function cancellationQuote(t: TripRecord, now = Date.now()): CancellationQuote {
  if (t.status === 'Ongoing') {
    return { allowed: false, fee: 0, explanation: 'The trip has started and can no longer be cancelled. Use SOS or call support if you need help.' };
  }
  if (!['Pending', 'Confirmed', 'Assigned'].includes(t.status)) {
    return { allowed: false, fee: 0, explanation: 'This ride can no longer be cancelled.' };
  }
  if (t.isScheduled && t.scheduledAt) {
    const until = t.scheduledAt.getTime() - now;
    if (until > SCHEDULED_FREE_CANCEL_BEFORE_MS || t.status === 'Pending') {
      return { allowed: true, fee: 0, explanation: 'Free cancellation — no charge applies.' };
    }
    return {
      allowed: true,
      fee: SCHEDULED_CANCELLATION_FEE,
      explanation: `Pickup is less than an hour away and a partner is committed, so a ₹${SCHEDULED_CANCELLATION_FEE} cancellation fee applies.`,
    };
  }
  if (t.status !== 'Assigned' || !t.assignedAt) {
    return { allowed: true, fee: 0, explanation: 'No driver has been assigned yet — cancellation is free.' };
  }
  const since = now - t.assignedAt.getTime();
  if (since <= FREE_CANCEL_AFTER_ASSIGN_MS) {
    const left = Math.ceil((FREE_CANCEL_AFTER_ASSIGN_MS - since) / 60000);
    return { allowed: true, fee: 0, explanation: `Free cancellation for about ${left} more min after driver assignment.` };
  }
  return {
    allowed: true,
    fee: INSTANT_CANCELLATION_FEE,
    explanation: `Your driver is already on the way, so a ₹${INSTANT_CANCELLATION_FEE} cancellation fee applies.`,
  };
}

/** Booking fields a customer cancellation writes (customerUpdateOk allow-list). */
export function buildCancelUpdate(reason: string, cancellationFee = 0) {
  return {
    status: 'Cancelled',
    cancelReason: reason.slice(0, 200),
    cancellationFee,
    cancelledBy: 'customer',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function cancelRide(trip: TripRecord, reason: string): Promise<void> {
  const quote = cancellationQuote(trip);
  if (!quote.allowed) throw new Error(quote.explanation);
  const bookingRef = doc(db, BOOKINGS, trip.id);

  const build = (withMarketplace: boolean) => {
    const batch = writeBatch(db);
    batch.update(bookingRef, buildCancelUpdate(reason, quote.fee));
    // Withdraw the open marketplace offer so no partner can still claim it.
    if (withMarketplace) batch.update(doc(db, MARKETPLACE, trip.id), { status: 'Closed', updatedAt: serverTimestamp() });
    return batch;
  };

  try {
    await withTimeout(build(true).commit(), 15000);
  } catch (err) {
    // Admin-created bookings have no marketplace doc, and the rules reject an
    // update to a missing doc — retry without it. If the booking update itself
    // was the problem, the retry fails the same way and surfaces.
    const code = errorCode(err);
    if (code === 'not-found' || code === 'permission-denied') {
      await withTimeout(build(false).commit(), 15000);
      return;
    }
    throw err;
  }
}

// ── Rate ────────────────────────────────────────────────────────────────────

export async function rateTrip(trip: TripRecord, profile: UserProfile, rating: number, comment: string): Promise<void> {
  const stars = Math.round(rating);
  if (stars < 1 || stars > 5) throw new Error('Choose between 1 and 5 stars.');
  const text = comment.trim().slice(0, 500);
  const batch = writeBatch(db);
  batch.update(doc(db, BOOKINGS, trip.id), {
    rating: stars,
    reviewComment: text,
    ratedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // Review doc id must equal the booking doc id (firestore.rules).
  batch.set(doc(db, REVIEWS, trip.id), {
    bookingId: trip.id,
    bookingCode: trip.bookingId,
    customerId: profile.uid,
    customerName: profile.name,
    customerPhone: profile.phone,
    driverId: trip.driver?.id ?? '',
    driverName: trip.driver?.name ?? '',
    vehicleNumber: trip.driver?.vehicleNumber ?? '',
    serviceName: trip.service,
    overallRating: stars,
    driverRating: stars,
    reviewText: text,
    status: 'Pending',
    createdAt: serverTimestamp(),
  });
  await withTimeout(batch.commit(), 15000);
}

// ── SOS ─────────────────────────────────────────────────────────────────────

export async function raiseSos(trip: TripRecord, profile: UserProfile, location: LatLng | null): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, SOS)), {
    bookingId: trip.id,
    bookingCode: trip.bookingId,
    customerId: profile.uid,
    customerName: profile.name,
    customerPhone: profile.phone,
    emergencyContact: profile.emergencyContact,
    driverId: trip.driver?.id ?? '',
    driverName: trip.driver?.name ?? '',
    driverPhone: trip.driver?.phone ?? '',
    vehicleNumber: trip.driver?.vehicleNumber ?? '',
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
    tripStatus: trip.status,
    status: 'Open',
    source: 'customer-app',
    createdAt: serverTimestamp(),
  });
  await withTimeout(batch.commit(), 10000);
}
