import { ageOn, isFutureDate, isValidAadhaar, localDateISO, maskAadhaar, maskAccount, validateStep } from '../src/validation/kyc';
import { emptyRegistration } from '../src/services/driverService';
import type { RegistrationData } from '../src/types/driver';

// 2345 6789 0124 passes the Verhoeff checksum (UIDAI test pattern).
const VALID_AADHAAR = '234567890124';

function filled(): RegistrationData {
  const d = emptyRegistration('+91 98765 43210');
  d.profile = {
    ...d.profile,
    name: 'Murugan K',
    photoUrl: 'https://x/p.jpg',
    dob: '1990-05-10',
    gender: 'Male',
    address: '12 Main Rd',
    city: 'Theni',
    pincode: '625531',
    emergencyContactName: 'Selvi',
    emergencyContact: '9123456780',
  };
  d.identity = { aadhaarNumber: VALID_AADHAAR, aadhaarFrontUrl: 'u', aadhaarBackUrl: 'u', panNumber: 'ABCDE1234F', panPhotoUrl: '' };
  d.license = { number: 'TN01 20190012345', expiryDate: '2099-01-01', frontPhotoUrl: 'u', backPhotoUrl: 'u' };
  d.vehicle = {
    ...d.vehicle,
    vehicleNumber: 'TN 01 AB 1234',
    make: 'Maruti',
    model: 'Dzire',
    year: '2021',
    color: 'White',
    capacity: 4,
    frontPhotoUrl: 'u',
    rearPhotoUrl: 'u',
    sidePhotoUrl: 'u',
    interiorPhotoUrl: 'u',
    rcNumber: 'TN01AB1234',
    rcDocUrl: 'u',
    insuranceNumber: 'POL1',
    insuranceExpiry: '2099-01-01',
    insuranceDocUrl: 'u',
    statePermitNumber: 'P1',
    permitExpiry: '2099-01-01',
    statePermitDocUrl: 'u',
  };
  d.bank = { accountHolder: 'Murugan K', accountNumber: '123456789012', ifsc: 'SBIN0001234', bankName: 'SBI', upiId: 'murugan@oksbi' };
  return d;
}

describe('KYC validation', () => {
  it('accepts a complete application on every step', () => {
    const d = filled();
    for (let s = 1; s <= 5; s++) expect(validateStep(s, d, d.bank.accountNumber, '2026-09-28')).toEqual({});
  });

  it('checks the Aadhaar Verhoeff checksum', () => {
    expect(isValidAadhaar(VALID_AADHAAR)).toBe(true);
    expect(isValidAadhaar('2345 6789 0124')).toBe(true);
    expect(isValidAadhaar('234567890123')).toBe(false);
    expect(isValidAadhaar('123456789012')).toBe(false);
    expect(isValidAadhaar('23456789012')).toBe(false);
  });

  it('rejects invalid identity, licence and vehicle data', () => {
    const d = filled();
    d.identity.panNumber = 'ABC123';
    d.license.expiryDate = '2020-01-01';
    const e2 = validateStep(2, d, '', '2026-09-28');
    expect(e2.panNumber).toBeTruthy();
    expect(e2.licenseExpiry).toMatch(/expired/i);
    d.vehicle.vehicleNumber = 'NOTAPLATE';
    d.vehicle.capacity = 0;
    const e3 = validateStep(3, d, '', '2026-09-28');
    expect(e3.vehicleNumber).toBeTruthy();
    expect(e3.capacity).toBeTruthy();
  });

  it('requires unexpired vehicle documents', () => {
    const d = filled();
    d.vehicle.insuranceExpiry = '2026-09-28';
    d.vehicle.permitExpiry = '';
    const e = validateStep(4, d, '', '2026-09-28');
    expect(e.insuranceExpiry).toMatch(/expired/i);
    expect(e.permitExpiry).toBeTruthy();
  });

  it('validates bank details and the confirmation', () => {
    const d = filled();
    expect(validateStep(5, d, '999', '2026-09-28').confirmAccount).toBeTruthy();
    d.bank.ifsc = 'SBIN1234567';
    d.bank.upiId = 'no-at-sign';
    d.bank.accountNumber = '000000000';
    const e = validateStep(5, d, d.bank.accountNumber, '2026-09-28');
    expect(e.ifsc).toBeTruthy();
    expect(e.upiId).toBeTruthy();
    expect(e.accountNumber).toBeTruthy();
  });

  it('enforces age and a distinct emergency contact', () => {
    const d = filled();
    d.profile.dob = localDateISO(new Date(new Date().getFullYear() - 17, 0, 1));
    d.profile.emergencyContact = '9876543210';
    const e = validateStep(1, d, '', '2026-09-28');
    expect(e.dob).toMatch(/18/);
    expect(e.emergencyContact).toMatch(/differ/);
    expect(ageOn('2000-09-29', new Date(2018, 8, 28))).toBe(17);
    expect(ageOn('2000-09-28', new Date(2018, 8, 28))).toBe(18);
  });

  it('compares dates as local calendar days', () => {
    expect(isFutureDate('2026-09-29', '2026-09-28')).toBe(true);
    expect(isFutureDate('2026-09-28', '2026-09-28')).toBe(false);
  });

  it('masks sensitive numbers', () => {
    expect(maskAadhaar(VALID_AADHAAR)).toBe('XXXX XXXX 0124');
    expect(maskAccount('123456789012')).toBe('••••••••9012');
  });
});
