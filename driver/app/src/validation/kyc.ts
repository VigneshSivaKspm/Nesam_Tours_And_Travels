// Six-step driver KYC validation. Copied from validateStep() in
// driver/web/src/screens/RegistrationScreen.tsx and hardened with the
// validators from vendor/web/src/utils/validation.ts (Aadhaar Verhoeff
// checksum, stricter PAN / IFSC / UPI formats). Dates are compared as local
// calendar days (the Web used UTC, which misjudged expiry before 05:30 IST).
import type { RegistrationData } from '../types/driver';

export type Errors = Record<string, string>;

export function localDateISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const isFutureDate = (iso: string, today = localDateISO()) => !!iso && iso > today;

export function ageOn(dob: string, now = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return 0;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
  return age;
}

// Verhoeff checksum tables (UIDAI Aadhaar).
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function isValidAadhaar(value: string): boolean {
  const v = value.replace(/\s/g, '');
  if (!/^[2-9]\d{11}$/.test(v)) return false;
  let c = 0;
  const digits = v.split('').reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = VERHOEFF_D[c]![VERHOEFF_P[i % 8]![digits[i]!]!]!;
  return c === 0;
}

export const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_RE = /^[A-Za-z0-9.\-_]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/;
export const VEHICLE_NO_RE = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{0,3}[\s-]?\d{1,4}$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export function validateStep(step: number, d: RegistrationData, confirmAccount: string, today = localDateISO()): Errors {
  const e: Errors = {};
  const req = (key: string, val: string, msg = 'Required') => {
    if (!val || !val.trim()) e[key] = msg;
  };

  if (step === 1) {
    const p = d.profile;
    req('photoUrl', p.photoUrl, 'Profile photo is required');
    req('name', p.name);
    if (p.name.trim() && (p.name.trim().length < 3 || !/^[A-Za-z][A-Za-z .'-]*$/.test(p.name.trim()))) e.name = 'Enter your full name as on your licence';
    if (p.email.trim() && !EMAIL_RE.test(p.email.trim())) e.email = 'Invalid email';
    req('dob', p.dob);
    if (p.dob && ageOn(p.dob) < 18) e.dob = 'You must be at least 18 years old';
    if (p.dob && ageOn(p.dob) > 75) e.dob = 'Please check your date of birth';
    req('gender', p.gender);
    req('address', p.address);
    req('city', p.city);
    if (!/^[1-9]\d{5}$/.test(p.pincode.trim())) e.pincode = 'Enter a 6-digit pincode';
    req('emergencyContactName', p.emergencyContactName);
    if (!MOBILE_RE.test(p.emergencyContact.replace(/\D/g, '').slice(-10))) e.emergencyContact = 'Enter a valid 10-digit mobile number';
    else if (p.phone.replace(/\D/g, '').endsWith(p.emergencyContact.replace(/\D/g, '').slice(-10))) {
      e.emergencyContact = 'Emergency contact must differ from your own number';
    }
  }

  if (step === 2) {
    const id = d.identity;
    const l = d.license;
    if (!isValidAadhaar(id.aadhaarNumber)) e.aadhaarNumber = 'Enter a valid 12-digit Aadhaar number';
    req('aadhaarFrontUrl', id.aadhaarFrontUrl);
    req('aadhaarBackUrl', id.aadhaarBackUrl);
    if (id.panNumber.trim() && !PAN_RE.test(id.panNumber.trim().toUpperCase())) e.panNumber = 'Invalid PAN (e.g. ABCDE1234F)';
    if (l.number.replace(/[\s-]/g, '').length < 10 || !/^[A-Z]{2}/i.test(l.number.trim())) e.licenseNumber = 'Enter a valid driving licence number';
    req('licenseExpiry', l.expiryDate);
    if (l.expiryDate && !isFutureDate(l.expiryDate, today)) e.licenseExpiry = 'Licence has expired';
    req('dlFront', l.frontPhotoUrl);
    req('dlBack', l.backPhotoUrl);
  }

  if (step === 3) {
    const v = d.vehicle;
    if (!VEHICLE_NO_RE.test(v.vehicleNumber.trim().toUpperCase())) e.vehicleNumber = 'Enter a valid registration number (e.g. TN 01 AB 1234)';
    req('make', v.make);
    req('model', v.model);
    const year = Number(v.year);
    if (!year || year < 2000 || year > new Date().getFullYear()) e.year = 'Enter a valid year';
    req('color', v.color);
    if (!Number.isInteger(v.capacity) || v.capacity < 2 || v.capacity > 30) e.capacity = 'Enter seating capacity (2–30)';
    req('vehFront', v.frontPhotoUrl);
    req('vehRear', v.rearPhotoUrl);
    req('vehSide', v.sidePhotoUrl);
    req('vehInterior', v.interiorPhotoUrl);
  }

  if (step === 4) {
    const v = d.vehicle;
    req('rcNumber', v.rcNumber);
    req('rcDocUrl', v.rcDocUrl);
    req('insuranceNumber', v.insuranceNumber);
    req('insuranceExpiry', v.insuranceExpiry);
    if (v.insuranceExpiry && !isFutureDate(v.insuranceExpiry, today)) e.insuranceExpiry = 'Insurance has expired';
    req('insuranceDocUrl', v.insuranceDocUrl);
    if (v.fitnessExpiry && !isFutureDate(v.fitnessExpiry, today)) e.fitnessExpiry = 'Fitness certificate has expired';
    req('statePermitNumber', v.statePermitNumber);
    req('permitExpiry', v.permitExpiry);
    if (v.permitExpiry && !isFutureDate(v.permitExpiry, today)) e.permitExpiry = 'Permit has expired';
    req('statePermitDocUrl', v.statePermitDocUrl);
  }

  if (step === 5) {
    const b = d.bank;
    req('accountHolder', b.accountHolder);
    if (!/^\d{9,18}$/.test(b.accountNumber) || /^0+$/.test(b.accountNumber)) e.accountNumber = 'Enter a valid account number (9–18 digits)';
    if (confirmAccount !== b.accountNumber) e.confirmAccount = 'Account numbers do not match';
    if (!IFSC_RE.test(b.ifsc.trim().toUpperCase())) e.ifsc = 'Invalid IFSC (e.g. SBIN0001234)';
    if (b.upiId.trim() && !UPI_RE.test(b.upiId.trim())) e.upiId = 'Invalid UPI ID';
  }

  return e;
}

export const maskAccount = (n: string) => (n.length > 4 ? `${'•'.repeat(Math.min(n.length - 4, 8))}${n.slice(-4)}` : n);
export const maskAadhaar = (n: string) => {
  const d = n.replace(/\s/g, '');
  return d.length === 12 ? `XXXX XXXX ${d.slice(-4)}` : d;
};
