import {
  buildCancelUpdate,
  buildRideRequestDocs,
  cancellationQuote,
  derivePhase,
  generateBookingCode,
  generateOtp,
  isLiveRide,
  mapBooking,
  normalizeStatus,
} from '../src/services/rideService';
import { calculateFare } from '../src/services/pricingService';
import { DEFAULT_RIDE_CATEGORIES, INSTANT_CANCELLATION_FEE, PARTNER_PAYOUT_SHARE, SCHEDULED_CANCELLATION_FEE } from '../src/config/constants';
import type { GeoPlace, TripRecord, UserProfile } from '../src/types';

const profile: UserProfile = {
  uid: 'cust1',
  name: 'Priya',
  phone: '+91 9800000001',
  email: 'p@example.com',
  photoUrl: '',
  walletBalance: 0,
  emergencyContact: '+91 9800000009',
  language: 'English',
  status: 'Approved',
};
const pickup: GeoPlace = { id: 'a', name: 'Theni Bus Stand', address: 'Theni', type: 'other', lat: 10.01, lng: 77.47 };
const drop: GeoPlace = { id: 'b', name: 'Madurai Airport', address: 'Madurai', type: 'airport', lat: 9.83, lng: 78.09 };

function trip(over: Partial<TripRecord>): TripRecord {
  return { ...mapBooking('b1', { customerId: 'cust1', status: 'Pending' }), ...over };
}

describe('status mapping', () => {
  it('normalises legacy labels', () => {
    expect(normalizeStatus('Trip Started')).toBe('Ongoing');
    expect(normalizeStatus('Driver Assigned')).toBe('Assigned');
    expect(normalizeStatus('weird')).toBe('Pending');
  });
  it('derives the rider phase', () => {
    expect(derivePhase('Pending', null)).toBe('searching');
    expect(derivePhase('Confirmed', null)).toBe('partner_confirmed');
    expect(derivePhase('Assigned', 'En Route Pickup')).toBe('driver_en_route');
    expect(derivePhase('Assigned', 'Reached Pickup')).toBe('driver_arrived');
    expect(derivePhase('Ongoing', 'In Progress')).toBe('in_trip');
    expect(derivePhase('Completed', 'Completed')).toBe('completed');
    expect(derivePhase('Cancelled', null)).toBe('cancelled');
  });
  it('treats "Assigned" without a driver (vendor awarded) as partner-confirmed', () => {
    expect(derivePhase('Assigned', null, false)).toBe('partner_confirmed');
    expect(mapBooking('x', { status: 'Assigned', assignedVendorId: 'v1' }).phase).toBe('partner_confirmed');
  });
  it('maps driverLocation only when valid', () => {
    expect(mapBooking('x', { driverLocation: { lat: 10, lng: 77 } }).driverLocation?.lat).toBe(10);
    expect(mapBooking('x', { driverLocation: { lat: 0, lng: 0 } }).driverLocation).toBeNull();
  });
});

describe('codes', () => {
  it('generates 4-digit OTPs', () => {
    for (const n of [0, 1, 8999, 9000, 123456789, 4294967295]) expect(generateOtp(() => n)).toMatch(/^\d{4}$/);
  });
  it('generates booking codes in the NTyymmdd-XXXXX format', () => {
    expect(generateBookingCode(new Date(2026, 8, 28), () => 123456)).toMatch(/^NT260928-[A-HJ-NP-Z2-9]{5}$/);
  });
});

describe('cancellation policy', () => {
  const now = Date.UTC(2026, 8, 28, 12, 0);
  it('is free before assignment', () => {
    expect(cancellationQuote(trip({ status: 'Pending' }), now)).toMatchObject({ allowed: true, fee: 0 });
  });
  it('is free within 3 minutes of assignment, then charged', () => {
    expect(cancellationQuote(trip({ status: 'Assigned', assignedAt: new Date(now - 60000) }), now).fee).toBe(0);
    expect(cancellationQuote(trip({ status: 'Assigned', assignedAt: new Date(now - 10 * 60000) }), now).fee).toBe(INSTANT_CANCELLATION_FEE);
  });
  it('charges late cancellation of a committed scheduled ride', () => {
    const t = trip({ status: 'Confirmed', isScheduled: true, scheduledAt: new Date(now + 30 * 60000) });
    expect(cancellationQuote(t, now).fee).toBe(SCHEDULED_CANCELLATION_FEE);
  });
  it('forbids cancelling a started or finished trip', () => {
    expect(cancellationQuote(trip({ status: 'Ongoing' }), now).allowed).toBe(false);
    expect(cancellationQuote(trip({ status: 'Completed' }), now).allowed).toBe(false);
  });
  it('writes only the fields the customer cancel rule allows', () => {
    expect(Object.keys(buildCancelUpdate('Changed my plans')).sort()).toEqual(['cancelReason', 'cancellationFee', 'cancelledAt', 'cancelledBy', 'status', 'updatedAt']);
    expect(buildCancelUpdate('x'.repeat(500)).cancelReason).toHaveLength(200);
  });
});

describe('live ride detection', () => {
  const now = Date.UTC(2026, 8, 28, 12, 0);
  it('treats scheduled rides as live only within an hour of pickup', () => {
    expect(isLiveRide(trip({ status: 'Confirmed', isScheduled: true, scheduledAt: new Date(now + 3 * 3600000) }), now)).toBe(false);
    expect(isLiveRide(trip({ status: 'Confirmed', isScheduled: true, scheduledAt: new Date(now + 30 * 60000) }), now)).toBe(true);
    expect(isLiveRide(trip({ status: 'Ongoing' }), now)).toBe(true);
    expect(isLiveRide(trip({ status: 'Completed' }), now)).toBe(false);
  });
});

describe('ride request payload', () => {
  const category = DEFAULT_RIDE_CATEGORIES[1]!;
  const route = { distanceKm: 120, durationMin: 150, path: [], estimated: false };
  const fare = calculateFare({ category, route, tripType: 'One Way', pickupTime: new Date(2026, 8, 28, 12) });
  const docs = buildRideRequestDocs(
    { profile, pickup, drop, category, route, fare, tripType: 'One Way', paymentMethod: 'Cash', couponCode: '', notes: '  gate 2  ', scheduledAt: null },
    'doc123',
    new Date(2026, 8, 28, 12),
    '4321',
    'NT260928-ABCDE',
  );

  it('preserves the legacy booking shape for mapping compatibility', () => {
    expect(docs.booking).toMatchObject({ customerId: 'cust1', status: 'Pending', payment: 'Pending', fare: fare.total, source: 'customer-app' });
    expect(docs.booking).not.toHaveProperty('assignedDriverId');
    expect(docs.booking).not.toHaveProperty('assignedVendorId');
    expect(docs.booking.notes).toBe('gate 2');
    expect(docs.booking.service).toBe('Airport');
  });
  it('keeps the OTP out of the booking and in the secret doc', () => {
    expect(JSON.stringify(docs.booking)).not.toContain('4321');
    expect(docs.secret).toMatchObject({ customerId: 'cust1', otp: '4321' });
  });
  it('publishes an Open marketplace offer at the partner share', () => {
    expect(docs.marketplace).toMatchObject({ id: 'doc123', status: 'Open', offeredPayout: Math.round(fare.total * PARTNER_PAYOUT_SHARE) });
  });
});
