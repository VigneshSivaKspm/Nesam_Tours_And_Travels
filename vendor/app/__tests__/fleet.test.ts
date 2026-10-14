import { buildFleetDetails, emptyVehicle, fleetIsComplete, isPlate, normalizePlate, validateVehicle } from '../src/utils/fleet';
import { missingSections } from '../src/services/onboardingService';
import { applyDetection, type VehicleLookupResult } from '../src/services/vehicleLookup';
import type { FleetVehicleDoc, StoredFile, VendorRecord } from '../src/types/vendor';

const TODAY = '2026-10-13';
const file = (n: string): StoredFile => ({ path: `vendors/v1/onboarding/x/${n}`, name: n, contentType: 'image/jpeg', size: 1000, uploadedAt: 1 });

function vehicle(plate = 'TN01AB1234'): FleetVehicleDoc {
  return {
    ...emptyVehicle(),
    registrationNumber: plate,
    source: 'vahan',
    category: 'Sedan',
    make: 'Maruti',
    model: 'Dzire',
    insuranceUpto: '2099-01-01',
    fitnessUpto: '2099-01-01',
    permitUpto: '2099-01-01',
    rcFiles: [file('rc')],
    insuranceFiles: [file('ins')],
    fitnessFiles: [file('fc')],
    permitFiles: [file('permit')],
    frontPhotoFiles: [file('front')],
  };
}
const ctx = (over: Partial<Parameters<typeof validateVehicle>[1]> = {}) => ({ detectedFor: 'TN01AB1234', duplicate: false, notFound: false, others: [], today: TODAY, ...over });

describe('fleet documentation (spec page 13)', () => {
  it('accepts a vehicle with RC, insurance, FC, permit and front photo', () => {
    expect(validateVehicle(vehicle(), ctx())).toEqual({});
  });

  it('asks for each document and an unexpired validity', () => {
    const v = { ...vehicle(), rcFiles: [], insuranceUpto: '2026-10-13', fitnessFiles: [], permitUpto: '', frontPhotoFiles: [] };
    const e = validateVehicle(v, ctx());
    expect(e.rcFiles).toBeTruthy();
    expect(e.insuranceUpto).toMatch(/expired/i);
    expect(e.fitnessFiles).toBeTruthy();
    expect(e.permitUpto).toBeTruthy();
    expect(e.frontPhotoFiles).toBeTruthy();
  });

  it('the plate must have been checked against the register, and not be a duplicate', () => {
    expect(validateVehicle(vehicle(), ctx({ detectedFor: '' })).registrationNumber).toMatch(/detect/i);
    expect(validateVehicle(vehicle(), ctx({ notFound: true })).registrationNumber).toMatch(/not found/i);
    expect(validateVehicle(vehicle(), ctx({ duplicate: true })).registrationNumber).toMatch(/already registered/i);
    expect(validateVehicle(vehicle(), ctx({ others: ['TN01AB1234'] })).registrationNumber).toMatch(/already in your application/i);
    expect(validateVehicle({ ...vehicle(), registrationNumber: 'NOTAPLATE' }, ctx()).registrationNumber).toBeTruthy();
  });

  it('plates ignore spaces and hyphens', () => {
    expect(normalizePlate('tn-01 ab 1234')).toBe('TN01AB1234');
    expect(isPlate('TN 01 AB 1234')).toBe(true);
    expect(isPlate('TN01')).toBe(false);
  });

  it('builds the stored fleet with per-document aggregates', () => {
    const f = buildFleetDetails([vehicle('TN01AB1234'), { ...vehicle('TN02CD5678'), category: 'SUV' }]);
    expect(f.fleetSize).toBe(2);
    expect(f.vehicleTypes.sort()).toEqual(['SUV', 'Sedan']);
    expect(f.rcFiles).toHaveLength(2);
    expect(f.fcFiles).toHaveLength(2);
    expect(f.permitFiles).toHaveLength(2);
    expect(f.vehiclePhotos).toHaveLength(2);
  });

  it('a stored application is complete only while every vehicle still passes', () => {
    expect(fleetIsComplete(null)).toBe(false);
    expect(fleetIsComplete(buildFleetDetails([]))).toBe(false);
    expect(fleetIsComplete(buildFleetDetails([vehicle()]), TODAY)).toBe(true);
    // The insurance lapsed while the application sat as a draft.
    expect(fleetIsComplete(buildFleetDetails([{ ...vehicle(), insuranceUpto: '2026-10-01' }]), TODAY)).toBe(false);
    // The same vehicle twice is not a fleet of two.
    expect(fleetIsComplete(buildFleetDetails([vehicle(), vehicle()]), TODAY)).toBe(false);
  });

  it('the register fills the vehicle; only still-valid dates are prefilled', () => {
    const r: Extract<VehicleLookupResult, { status: 'found' }> = {
      status: 'found',
      registrationNumber: 'TN01AB1234',
      duplicate: false,
      fetchedAtMs: 1,
      source: 'surepass',
      issues: [{ code: 'insurance_expired', message: 'Insurance expired.' }],
      vehicle: {
        registrationNumber: 'TN01AB1234', make: 'Toyota', model: 'Innova Crysta', variant: '2.4 Gx', fuelType: 'Diesel', seatingCapacity: 8, passengerSeats: 7, seatClass: '7+1',
        manufactureYear: '2021', colour: 'White', usage: 'commercial', registrationStatus: 'ACTIVE', registrationActive: true, ownerNameMasked: 'R••• K•••', category: 'Premium SUV', specClass: 'Crysta',
        validity: { fitnessUpto: '2027-06-30', insuranceUpto: '2026-01-01', permitUpto: '', taxUpto: '', pucUpto: '' },
      },
    };
    const v = applyDetection(emptyVehicle(), r, TODAY);
    expect(v).toMatchObject({ source: 'vahan', category: 'Premium SUV', make: 'Toyota', model: 'Innova Crysta 2.4 Gx', passengerSeats: 7, seatClass: '7+1', fitnessUpto: '2027-06-30' });
    expect(v.insuranceUpto).toBe('');
    expect(v.permitUpto).toBe('');
    expect(v.issues).toEqual(['insurance_expired']);
  });

  it('missing sections follow page 13: business, account details, fleet', () => {
    const base: VendorRecord = { uid: 'v1', phone: '+919800000001', status: 'INCOMPLETE', onboardingStep: 0, business: null, documents: null, fleet: null, payoutSummary: null, review: null, submittedAt: null };
    expect(missingSections(base).sort()).toEqual(['business', 'fleet', 'payout']);
    const done: VendorRecord = {
      ...base,
      business: { vendorName: 'Ravi', businessName: 'Sri Balaji', email: '', altPhone: '', address: { line1: '', line2: '', city: '', state: '', pincode: '' } },
      payoutSummary: { accountHolderName: 'Ravi', bankLast4: '9012', ifsc: 'SBIN0001234', upiId: '' },
      fleet: buildFleetDetails([vehicle()]),
    };
    // No identity proof or business registration document is required any more.
    expect(missingSections(done)).toEqual([]);
  });
});
