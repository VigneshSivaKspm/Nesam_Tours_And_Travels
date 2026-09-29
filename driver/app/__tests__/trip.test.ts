import {
  buildClaimUpdate,
  buildNewDriverDoc,
  buildStartTripUpdate,
  emptyRegistration,
  mapBooking,
  mapDriverDoc,
  tollTotal,
  validatePayoutAmount,
} from '../src/services/driverService';
import { categoryMatches, last7Days, summarizeEarnings, summarizeWallet } from '../src/utils/earnings';
import type { DriverProfile, PayoutRequest, TripDetails } from '../src/types/driver';

const driver = mapDriverDoc('drv1', { name: 'Murugan', phone: '+91 98765 43210', status: 'Approved' }).driver as DriverProfile;

describe('rules payloads', () => {
  it('claim writes exactly the driverClaimOk allow-list', () => {
    expect(Object.keys(buildClaimUpdate(driver, 'TN01AB1234', 425)).sort()).toEqual(
      ['assignedAt', 'assignedDriverId', 'assignedDriverName', 'assignedVehicleNumber', 'driver', 'driverPayout', 'driverPhone', 'status', 'tripStage', 'updatedAt'].sort(),
    );
    expect(buildClaimUpdate(driver, 'x', 1)).toMatchObject({ status: 'Assigned', assignedDriverId: 'drv1' });
  });

  it('trip start sends the OTP only as an attempt', () => {
    const u = buildStartTripUpdate('1234');
    expect(u).toMatchObject({ status: 'Ongoing', tripStage: 'In Progress', otpAttempt: '1234' });
    expect(Object.keys(u).sort()).toEqual(['otpAttempt', 'startedAt', 'status', 'tripStage', 'updatedAt']);
  });

  it('a self-registered driver can never grant itself approval', () => {
    const d = buildNewDriverDoc('drv1', '+919876543210', emptyRegistration('+91 98765 43210'), null);
    expect(d).toMatchObject({ role: 'driver', status: 'Pending', verified: false, vendorId: '' });
    const invited = buildNewDriverDoc('drv1', '+919876543210', emptyRegistration(''), { vendorId: 'v1', vendorName: 'Fleet', preApproved: false });
    expect(invited).toMatchObject({ status: 'Pending', vendorId: 'v1' });
  });
});

describe('booking mapping', () => {
  it('reads flat and nested locations and derives stage', () => {
    const t = mapBooking('b1', { status: 'Ongoing', tripStage: 'Reached Pickup', fare: 1000, pickup: 'A', pickupLat: 10, pickupLng: 77, drop: { address: 'B', lat: 9, lng: 78 } });
    expect(t.stage).toBe('In Progress');
    expect(t.pickup).toMatchObject({ address: 'A', lat: 10 });
    expect(t.drop).toMatchObject({ address: 'B', lng: 78 });
    expect(t.driverEarnings).toBe(850);
  });
  it('prefers the explicit driver payout and ignores malformed tolls', () => {
    const t = mapBooking('b1', { status: 'Completed', fare: 1000, driverPayout: 700, tolls: [{ id: 'a', amount: 50 }, 'junk', null] });
    expect(t.driverEarnings).toBe(700);
    expect(t.tolls).toHaveLength(1);
    expect(t.stage).toBe('Completed');
  });
  it('maps legacy "Trip Started" to Ongoing', () => {
    expect(mapBooking('b', { status: 'Trip Started' }).status).toBe('Ongoing');
  });
});

function trip(id: string, earnings: number, tolls: number, completedAt: Date): TripDetails {
  return { ...mapBooking(id, { status: 'Completed' }), driverEarnings: earnings, tollCharges: tolls, completedAt };
}

describe('earnings & wallet', () => {
  const now = new Date(2026, 8, 28, 15, 0);
  const trips = [trip('a', 500, 50, new Date(2026, 8, 28, 9)), trip('b', 300, 0, new Date(2026, 8, 25, 9)), trip('c', 1000, 0, new Date(2026, 7, 1, 9))];

  it('summarises by period including tolls', () => {
    const s = summarizeEarnings(trips, now);
    expect(s.todayEarnings).toBe(550);
    expect(s.thisWeekEarnings).toBe(850);
    expect(s.thisMonthEarnings).toBe(850);
    expect(s.lifetimeEarnings).toBe(1850);
    expect(s.tollReimbursements).toBe(50);
    expect(s.totalTripsCompleted).toBe(3);
  });

  it('holds back pending payouts and releases rejected ones', () => {
    const p = (amount: number, status: string): PayoutRequest => ({ id: status + amount, amount, requestedAt: '', method: 'UPI', details: '', status, utr: '', processedAt: '' });
    const w = summarizeWallet(1850, [p(500, 'Paid'), p(300, 'Pending'), p(400, 'Rejected'), p(100, 'Deferred')]);
    expect(w.totalPaidOut).toBe(500);
    expect(w.pendingPayouts).toBe(400);
    expect(w.availableBalance).toBe(950);
    expect(summarizeWallet(100, [p(500, 'Paid')]).availableBalance).toBe(0);
  });

  it('builds the 7-day chart', () => {
    const days = last7Days(trips, now);
    expect(days).toHaveLength(7);
    expect(days[6]!.amount).toBe(550);
    expect(days[3]!.amount).toBe(300);
  });

  it('validates payout amounts', () => {
    expect(validatePayoutAmount(99, 1000)).toMatch(/Minimum/);
    expect(validatePayoutAmount(1001, 1000)).toMatch(/exceeds/);
    expect(validatePayoutAmount(150.5, 1000)).toMatch(/whole/);
    expect(validatePayoutAmount(-5, 1000)).toBeTruthy();
    expect(validatePayoutAmount(500, 1000)).toBe('');
  });

  it('adds tolls precisely', () => {
    expect(tollTotal([{ id: 'a', name: '', amount: 10.1, receiptPhotoUrl: '', uploadedAt: '' }, { id: 'b', name: '', amount: 20.2, receiptPhotoUrl: '', uploadedAt: '' }])).toBe(30.3);
  });
});

describe('category matching', () => {
  it('matches loosely but keeps premium separate', () => {
    expect(categoryMatches('Sedan (AC)', 'Sedan')).toBe(true);
    expect(categoryMatches('SUV', 'SUV')).toBe(true);
    expect(categoryMatches('Premium SUV', 'SUV')).toBe(false);
    expect(categoryMatches('SUV', 'Premium SUV')).toBe(false);
    expect(categoryMatches('Mini', 'Hatchback')).toBe(true);
    expect(categoryMatches('', 'Sedan')).toBe(true);
    expect(categoryMatches('Tempo Traveller', 'Sedan')).toBe(false);
  });
});


describe('settled withdrawable balance', () => {
  it('excludes cash, unpaid and fleet trips, and unapproved tolls', () => {
    const base = { status: 'Completed', fare: 1000, driverPayout: 850, fareVerified: true, payment: 'Paid', paymentMethod: 'UPI', tollCharges: 50 };
    expect(mapBooking('p', base).withdrawableAmount).toBe(850);
    expect(mapBooking('p', { ...base, tollsApproved: true }).withdrawableAmount).toBe(900);
    expect(mapBooking('p', { ...base, paymentMethod: 'Cash' }).withdrawableAmount).toBe(0);
    expect(mapBooking('p', { ...base, assignedVendorId: 'vendor' }).withdrawableAmount).toBe(0);
    expect(mapBooking('p', { ...base, payment: 'Pending' }).withdrawableAmount).toBe(0);
  });
});
