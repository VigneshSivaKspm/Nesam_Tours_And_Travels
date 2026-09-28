import {
  buildDispatchUpdate,
  buildNewVehicleDoc,
  buildVendorClaimUpdate,
  canDispatch,
  dispatchBlocker,
  mapFleetDriver,
  mapMarketTrip,
  mapVendorBooking,
  validateCounterRate,
  validateVendorPayout,
} from '../src/services/vendorService';
import { buildOnboardingPath, validateUploadFile } from '../src/services/storageService';
import { commissionOf, daysUntil, netPayout, summarizeVendorWallet, walletTransactions } from '../src/utils/wallet';
import {
  validateAadhaar,
  validateAccountNumber,
  validateAltPhone,
  validateFleetSize,
  validateGstin,
  validateIfsc,
  validatePan,
  validatePincode,
  validateUpi,
} from '../src/utils/validation';
import type { VendorPayoutRequest } from '../src/types/operations';

const vendor = { id: 'v1', companyName: 'Sri Balaji Travels', phone: '+919800000001' };

describe('Indian validators (copied from Vendor Web)', () => {
  it('validates GSTIN, PAN and IFSC', () => {
    expect(validateGstin('33ABCDE1234F1Z5')).toBe('');
    expect(validateGstin('33ABCDE1234F1X5')).toBeTruthy();
    expect(validatePan('ABCDE1234F')).toBe('');
    expect(validatePan('ABCD1234F')).toBeTruthy();
    expect(validateIfsc('SBIN0001234')).toBe('');
    expect(validateIfsc('SBIN1001234')).toBeTruthy();
  });
  it('validates Aadhaar with Verhoeff checksum', () => {
    expect(validateAadhaar('2345 6789 0124')).toBe('');
    expect(validateAadhaar('234567890123')).toBeTruthy();
    expect(validateAadhaar('123456789012')).toBeTruthy();
  });
  it('validates UPI, account, pincode, fleet size and alternate phone', () => {
    expect(validateUpi('')).toBe('');
    expect(validateUpi('fleet@okhdfcbank')).toBe('');
    expect(validateUpi('fleet@@x')).toBeTruthy();
    expect(validateAccountNumber('000000000')).toBeTruthy();
    expect(validateAccountNumber('123456789012')).toBe('');
    expect(validatePincode('012345')).toBeTruthy();
    expect(validateFleetSize('0')).toBeTruthy();
    expect(validateFleetSize('12')).toBe('');
    expect(validateAltPhone('9800000001', '+919800000001')).toBeTruthy();
  });
});

describe('rules payloads', () => {
  it('claim writes exactly the vendorClaimOk allow-list', () => {
    const u = buildVendorClaimUpdate(vendor, 1200);
    expect(Object.keys(u).sort()).toEqual(['assignedVendorId', 'assignedVendorName', 'confirmedAt', 'status', 'updatedAt', 'vendorPayout']);
    expect(u).toMatchObject({ status: 'Confirmed', assignedVendorId: 'v1', vendorPayout: 1200 });
  });
  it('dispatch writes exactly the vendorDispatchOk allow-list', () => {
    const driver = mapFleetDriver('d1', { name: 'Kumar', phone: '+91 98000 00002', status: 'Approved', vendorId: 'v1' });
    const u = buildDispatchUpdate(driver, 'TN01AB1234');
    expect(Object.keys(u).sort()).toEqual(
      ['assignedAt', 'assignedDriverId', 'assignedDriverName', 'assignedVehicleNumber', 'driver', 'driverPhone', 'status', 'tripStage', 'updatedAt'].sort(),
    );
  });
  it('new vehicles always await NESAM review', () => {
    const d = buildNewVehicleDoc(vendor, 'veh1', {
      vehicleNumber: 'tn 01 ab 1234',
      category: 'Sedan',
      make: 'Toyota',
      model: 'Etios',
      year: '2022',
      seatingCapacity: 4,
      fuelType: 'Diesel',
      status: 'Active',
      rcNumber: 'rc1',
      rcDocUrl: 'u',
      insuranceExpiry: '2099-01-01',
      insuranceDocUrl: 'u',
      fitnessExpiry: '',
      fitnessDocUrl: '',
      permitExpiry: '2099-01-01',
      statePermitDocUrl: 'u',
    });
    expect(d).toMatchObject({ docStatus: 'Pending', vendorId: 'v1', vehicleNumber: 'TN 01 AB 1234', rcNumber: 'RC1' });
  });
});

describe('dispatch rules', () => {
  const approved = mapFleetDriver('d1', { name: 'Kumar', status: 'Approved' });
  const booking = (id: string, over: Record<string, unknown>) => mapVendorBooking(id, { bookingId: id, fare: 1000, ...over });
  it('only approved, active, free drivers can be dispatched', () => {
    expect(dispatchBlocker(approved, [], 'b1')).toBe('');
    expect(dispatchBlocker(mapFleetDriver('d2', { name: 'X', status: 'Pending' }), [], 'b1')).toMatch(/not approved/);
    expect(dispatchBlocker(mapFleetDriver('d3', { name: 'Y', status: 'Approved', fleetStatus: 'Suspended' }), [], 'b1')).toMatch(/suspended/);
    const busy = [booking('b2', { status: 'Ongoing', assignedDriverId: 'd1' })];
    expect(dispatchBlocker(approved, busy, 'b1')).toMatch(/already on trip/);
    expect(dispatchBlocker(approved, [booking('b1', { status: 'Assigned', assignedDriverId: 'd1' })], 'b1')).toBe('');
  });
  it('allows (re)dispatch only before the trip starts', () => {
    expect(canDispatch(booking('b', { status: 'Confirmed' }))).toBe(true);
    expect(canDispatch(booking('b', { status: 'Assigned', tripStage: 'Assigned' }))).toBe(true);
    expect(canDispatch(booking('b', { status: 'Assigned', tripStage: 'En Route Pickup' }))).toBe(false);
    expect(canDispatch(booking('b', { status: 'Ongoing' }))).toBe(false);
  });
});

describe('bids & payouts', () => {
  it('validates counter rates', () => {
    expect(validateCounterRate(0, 1000)).toBeTruthy();
    expect(validateCounterRate(1000, 1000)).toMatch(/offered rate/);
    expect(validateCounterRate(5000, 1000)).toMatch(/too high/);
    expect(validateCounterRate(1100.5, 1000)).toMatch(/whole/);
    expect(validateCounterRate(1200, 1000)).toBe('');
  });
  it('validates payout amounts', () => {
    expect(validateVendorPayout(100, 10000)).toMatch(/Minimum/);
    expect(validateVendorPayout(20000, 10000)).toMatch(/exceeds/);
    expect(validateVendorPayout(5000, 10000)).toBe('');
  });
});

describe('wallet', () => {
  const now = new Date(2026, 8, 28, 12);
  const b = (id: string, over: Record<string, unknown>) => mapVendorBooking(id, { bookingId: id, status: 'Completed', ...over });
  const bookings = [
    b('a', { fare: 1000, vendorPayout: 850, tollCharges: 100, completedAt: new Date(2026, 8, 28, 9) }),
    b('b', { fare: 2000, completedAt: new Date(2026, 7, 10) }),
    b('c', { fare: 999, status: 'Assigned' }),
  ];
  const p = (amount: number, status: string): VendorPayoutRequest => ({ id: status + amount, amount, method: 'UPI', details: '', status, requestedAt: '', utr: '', processedAt: '', createdMs: 1 });

  it('uses the accepted payout, else the commission rate', () => {
    expect(netPayout(bookings[0]!, 0.15)).toBe(850);
    expect(netPayout(bookings[1]!, 0.15)).toBe(1700);
    expect(commissionOf(bookings[1]!, 0.2)).toBe(400);
  });
  it('derives the available balance', () => {
    const w = summarizeVendorWallet(bookings, [p(500, 'Paid'), p(300, 'Pending'), p(700, 'Rejected')], 0.15, now);
    expect(w.completedTrips).toBe(2);
    expect(w.grossFares).toBe(3000);
    expect(w.commission).toBe(450);
    expect(w.netEarnings).toBe(2550);
    expect(w.tolls).toBe(100);
    expect(w.available).toBe(2550 + 100 - 500 - 300);
    expect(w.todayNet).toBe(850);
  });
  it('lists credits and debits newest first', () => {
    const t = walletTransactions(bookings, [p(500, 'Paid')], 0.15);
    expect(t.filter((x) => x.kind === 'credit')).toHaveLength(2);
    expect(t.find((x) => x.id === 'trip-a')?.amount).toBe(950);
  });
  it('computes days until expiry', () => {
    expect(daysUntil('2026-09-30', now)).toBe(2);
    expect(daysUntil('2026-09-27', now)).toBeLessThan(0);
    expect(daysUntil('garbage', now)).toBeNull();
  });
});

describe('mapping & storage', () => {
  it('maps marketplace offers defensively', () => {
    const t = mapMarketTrip('m1', { pickup: { address: 'A', city: 'Theni', time: '10:00 AM' }, drop: { address: 'B', city: 'Madurai' }, offeredPayout: '₹1,200', status: 'Bidding', bidCount: 2 });
    expect(t).toMatchObject({ route: 'Theni ➔ Madurai', offeredPayout: 1200, status: 'Bidding', bidCount: 2 });
  });
  it('builds safe onboarding storage paths', () => {
    expect(buildOnboardingPath('u1', 'vehicle_rc', 'My RC (front).PDF', 1700000000000, 'abc123')).toBe('vendors/u1/onboarding/vehicle_rc/1700000000000_abc123_my-rc-front.pdf');
  });
  it('mirrors storage.rules upload limits', () => {
    expect(validateUploadFile({ name: 'a.pdf', mimeType: 'application/pdf', size: 1000 })).toBe('');
    expect(validateUploadFile({ name: 'a.exe', mimeType: 'application/x-msdownload', size: 1000 })).toBeTruthy();
    expect(validateUploadFile({ name: 'big.jpg', mimeType: 'image/jpeg', size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
    expect(validateUploadFile({ name: 'empty.png', mimeType: 'image/png', size: 0 })).toMatch(/empty/);
  });
});
