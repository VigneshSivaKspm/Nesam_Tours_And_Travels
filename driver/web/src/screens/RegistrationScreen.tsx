import React, { useEffect, useMemo, useState } from 'react';
import {
  User,
  CreditCard,
  Car,
  FileText,
  Landmark,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Loader2,
  LogOut,
  ArrowLeft,
} from 'lucide-react';
import type { ApprovalStatus, RegistrationData, VehicleCategory } from '../types';
import { PhotoUpload } from '../components/PhotoUpload';
import {
  registerDriver,
  resubmitDriverDocuments,
  describeFirestoreError,
} from '../services/driverFirestoreService';

export type RegistrationMode = 'signup' | 'resubmit' | 'update';

interface RegistrationScreenProps {
  uid: string;
  mode: RegistrationMode;
  initial: RegistrationData;
  currentStatus?: ApprovalStatus;
  rejectionReason?: string;
  onSubmitted: () => void;
  onCancel?: () => void;
  onSignOut?: () => void;
}

const STEPS = [
  { id: 1, label: 'Personal', icon: User },
  { id: 2, label: 'ID & License', icon: CreditCard },
  { id: 3, label: 'Vehicle', icon: Car },
  { id: 4, label: 'Vehicle Docs', icon: FileText },
  { id: 5, label: 'Bank', icon: Landmark },
  { id: 6, label: 'Review', icon: ShieldCheck },
];

const VEHICLE_TYPES: { value: VehicleCategory; label: string; seats: number }[] = [
  { value: 'Hatchback', label: 'Hatchback (Swift / i20)', seats: 4 },
  { value: 'Sedan', label: 'Sedan (Dzire / Etios)', seats: 4 },
  { value: 'SUV', label: 'SUV (Ertiga / Innova)', seats: 6 },
  { value: 'Premium SUV', label: 'Premium SUV (Innova Crysta)', seats: 7 },
  { value: 'Tempo Traveller', label: 'Tempo Traveller (12+ seats)', seats: 12 },
];

const draftKey = (uid: string) => `nesam-driver-signup-draft-${uid}`;

function loadDraft(uid: string): { data: RegistrationData; step: number } | null {
  try {
    const raw = localStorage.getItem(draftKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(uid: string, data: RegistrationData, step: number) {
  try {
    localStorage.setItem(draftKey(uid), JSON.stringify({ data, step }));
  } catch {
    /* storage unavailable — draft just won't survive a reload */
  }
}

function clearDraft(uid: string) {
  try {
    localStorage.removeItem(draftKey(uid));
  } catch {
    /* ignore */
  }
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const isFutureDate = (d: string) => !!d && d > todayISO();

function ageOn(dob: string): number {
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

type Errors = Record<string, string>;

function validateStep(step: number, d: RegistrationData, confirmAccount: string): Errors {
  const e: Errors = {};
  const req = (key: string, val: string, msg = 'Required') => {
    if (!val || !val.trim()) e[key] = msg;
  };

  if (step === 1) {
    const p = d.profile;
    req('photoUrl', p.photoUrl, 'Profile photo is required');
    req('name', p.name);
    if (p.name.trim() && p.name.trim().length < 3) e.name = 'Enter your full name';
    if (p.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) e.email = 'Invalid email';
    req('dob', p.dob);
    if (p.dob && ageOn(p.dob) < 18) e.dob = 'You must be at least 18 years old';
    req('gender', p.gender);
    req('address', p.address);
    req('city', p.city);
    if (!/^\d{6}$/.test(p.pincode.trim())) e.pincode = 'Enter a 6-digit pincode';
    req('emergencyContactName', p.emergencyContactName);
    if (!/^[6-9]\d{9}$/.test(p.emergencyContact.replace(/\D/g, '').slice(-10))) {
      e.emergencyContact = 'Enter a valid 10-digit mobile number';
    }
  }

  if (step === 2) {
    const id = d.identity;
    const l = d.license;
    if (!/^\d{12}$/.test(id.aadhaarNumber.replace(/\s/g, ''))) e.aadhaarNumber = 'Enter the 12-digit Aadhaar number';
    req('aadhaarFrontUrl', id.aadhaarFrontUrl);
    req('aadhaarBackUrl', id.aadhaarBackUrl);
    if (id.panNumber.trim() && !/^[A-Z]{5}\d{4}[A-Z]$/i.test(id.panNumber.trim())) e.panNumber = 'Invalid PAN (e.g. ABCDE1234F)';
    if (l.number.replace(/[\s-]/g, '').length < 10) e.licenseNumber = 'Enter a valid driving licence number';
    req('licenseExpiry', l.expiryDate);
    if (l.expiryDate && !isFutureDate(l.expiryDate)) e.licenseExpiry = 'Licence has expired';
    req('dlFront', l.frontPhotoUrl);
    req('dlBack', l.backPhotoUrl);
  }

  if (step === 3) {
    const v = d.vehicle;
    if (!/^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{0,3}[\s-]?\d{1,4}$/i.test(v.vehicleNumber.trim())) {
      e.vehicleNumber = 'Enter a valid registration number (e.g. TN 01 AB 1234)';
    }
    req('make', v.make);
    req('model', v.model);
    const year = Number(v.year);
    if (!year || year < 2000 || year > new Date().getFullYear()) e.year = 'Enter a valid year';
    req('color', v.color);
    if (!v.capacity || v.capacity < 2 || v.capacity > 30) e.capacity = 'Enter seating capacity';
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
    if (v.insuranceExpiry && !isFutureDate(v.insuranceExpiry)) e.insuranceExpiry = 'Insurance has expired';
    req('insuranceDocUrl', v.insuranceDocUrl);
    if (v.fitnessExpiry && !isFutureDate(v.fitnessExpiry)) e.fitnessExpiry = 'Fitness certificate has expired';
    req('statePermitNumber', v.statePermitNumber);
    req('permitExpiry', v.permitExpiry);
    if (v.permitExpiry && !isFutureDate(v.permitExpiry)) e.permitExpiry = 'Permit has expired';
    req('statePermitDocUrl', v.statePermitDocUrl);
  }

  if (step === 5) {
    const b = d.bank;
    req('accountHolder', b.accountHolder);
    if (!/^\d{9,18}$/.test(b.accountNumber)) e.accountNumber = 'Enter a valid account number (9–18 digits)';
    if (confirmAccount !== b.accountNumber) e.confirmAccount = 'Account numbers do not match';
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(b.ifsc.trim())) e.ifsc = 'Invalid IFSC (e.g. SBIN0001234)';
    if (b.upiId.trim() && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(b.upiId.trim())) e.upiId = 'Invalid UPI ID';
  }

  return e;
}

// ── Small form primitives ──────────────────────────────────────────────────

const inputCls = (err?: string) =>
  `w-full px-3 py-2.5 border rounded-lg text-sm font-semibold focus:outline-none focus:border-[#E21E26] bg-white ${
    err ? 'border-red-400' : 'border-gray-300'
  }`;

const Field: React.FC<{ label: string; error?: string; required?: boolean; className?: string; children: React.ReactNode }> = ({
  label, error, required, className, children,
}) => (
  <div className={className}>
    <label className="text-xs font-bold text-gray-700 block mb-1">
      {label} {required && <span className="text-[#E21E26]">*</span>}
    </label>
    {children}
    {error && <p className="text-[11px] text-red-600 font-semibold mt-1">{error}</p>}
  </div>
);

const ReviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0 text-xs">
    <span className="text-gray-500">{label}</span>
    <span className="font-semibold text-gray-900 text-right break-all">{value || '—'}</span>
  </div>
);

const maskAccount = (n: string) => (n.length > 4 ? `${'•'.repeat(n.length - 4)}${n.slice(-4)}` : n);
const maskAadhaar = (n: string) => {
  const d = n.replace(/\s/g, '');
  return d.length === 12 ? `XXXX XXXX ${d.slice(-4)}` : d;
};

// ── Wizard ─────────────────────────────────────────────────────────────────

export const RegistrationScreen: React.FC<RegistrationScreenProps> = ({
  uid,
  mode,
  initial,
  currentStatus,
  rejectionReason,
  onSubmitted,
  onCancel,
  onSignOut,
}) => {
  const draft = useMemo(() => (mode === 'signup' ? loadDraft(uid) : null), [uid, mode]);
  const [data, setData] = useState<RegistrationData>(() =>
    draft ? { ...draft.data, profile: { ...draft.data.profile, phone: initial.profile.phone } } : initial,
  );
  const [step, setStep] = useState<number>(draft?.step ?? 1);
  const [confirmAccount, setConfirmAccount] = useState(initial.bank.accountNumber);
  const [errors, setErrors] = useState<Errors>({});
  const [showPhotoErrors, setShowPhotoErrors] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (mode === 'signup') saveDraft(uid, data, step);
  }, [uid, mode, data, step]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const setProfile = (patch: Partial<RegistrationData['profile']>) =>
    setData((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  const setIdentity = (patch: Partial<RegistrationData['identity']>) =>
    setData((d) => ({ ...d, identity: { ...d.identity, ...patch } }));
  const setLicense = (patch: Partial<RegistrationData['license']>) =>
    setData((d) => ({ ...d, license: { ...d.license, ...patch } }));
  const setVehicle = (patch: Partial<RegistrationData['vehicle']>) =>
    setData((d) => ({ ...d, vehicle: { ...d.vehicle, ...patch } }));
  const setBank = (patch: Partial<RegistrationData['bank']>) =>
    setData((d) => ({ ...d, bank: { ...d.bank, ...patch } }));

  const goNext = () => {
    const errs = validateStep(step, data, confirmAccount);
    setErrors(errs);
    setShowPhotoErrors(true);
    if (Object.keys(errs).length > 0) return;
    setShowPhotoErrors(false);
    setStep((s) => Math.min(s + 1, STEPS.length));
  };

  const jumpTo = (target: number) => {
    // Only allow jumping back, or forward over steps that already validate.
    if (target <= step) {
      setErrors({});
      setStep(target);
      return;
    }
    for (let s = step; s < target; s++) {
      const errs = validateStep(s, data, confirmAccount);
      if (Object.keys(errs).length > 0) {
        setStep(s);
        setErrors(errs);
        setShowPhotoErrors(true);
        return;
      }
    }
    setStep(target);
  };

  const handleSubmit = async () => {
    for (let s = 1; s <= 5; s++) {
      const errs = validateStep(s, data, confirmAccount);
      if (Object.keys(errs).length > 0) {
        setStep(s);
        setErrors(errs);
        setShowPhotoErrors(true);
        return;
      }
    }
    if (!consent) {
      setSubmitError('Please confirm the declaration to continue.');
      return;
    }
    setSubmitError('');
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await registerDriver(data);
        clearDraft(uid);
      } else {
        await resubmitDriverDocuments(uid, data, currentStatus ?? 'Pending');
      }
      onSubmitted();
    } catch (err) {
      setSubmitError(
        describeFirestoreError(err, 'We could not save your application. Please sign out, sign in again and retry.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    mode === 'signup' ? 'Driver Partner Registration' : mode === 'resubmit' ? 'Update & Resubmit Application' : 'Update Documents';

  const p = data.profile;
  const id = data.identity;
  const l = data.license;
  const v = data.vehicle;
  const b = data.bank;

  return (
    <div className={mode === 'update' ? '' : 'min-h-screen bg-[#F7F7F7] p-4 sm:p-6'}>
      <div className="space-y-5 max-w-4xl mx-auto pb-10">
        {/* Header */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {mode !== 'update' && (
              <img src="/icons/logo.png" alt="NESAM" className="w-11 h-11 rounded-xl object-contain bg-gray-50 border border-gray-200 p-1" />
            )}
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-gray-900">{title}</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Verified mobile: <span className="font-bold text-gray-800">{p.phone}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onCancel && (
              <button onClick={onCancel} className="px-3 py-2 text-xs font-bold text-gray-600 border border-gray-300 rounded-lg flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            {onSignOut && (
              <button onClick={onSignOut} className="px-3 py-2 text-xs font-bold text-gray-600 border border-gray-300 rounded-lg flex items-center gap-1 hover:text-[#E21E26]">
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            )}
          </div>
        </div>

        {mode === 'resubmit' && rejectionReason && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs text-red-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Reason for rejection</p>
              <p>{rejectionReason}</p>
            </div>
          </div>
        )}
        {mode === 'update' && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Updated documents are re-verified by the NESAM team. You can keep taking trips meanwhile.</span>
          </div>
        )}

        {/* Stepper */}
        <div className="grid grid-cols-6 gap-1.5 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
          {STEPS.map((st) => {
            const Icon = st.icon;
            const active = step === st.id;
            const done = step > st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => jumpTo(st.id)}
                className={`flex flex-col items-center py-2 px-1 rounded-lg transition-all ${
                  active ? 'bg-[#E21E26] text-white font-bold shadow' : done ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {done ? <CheckCircle className="w-4 h-4 mb-1" /> : <Icon className="w-4 h-4 mb-1" />}
                <span className="text-[10px] hidden sm:inline">{st.label}</span>
                <span className="text-[10px] sm:hidden">{st.id}</span>
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm space-y-5">
          {/* STEP 1 — PERSONAL */}
          {step === 1 && (
            <>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-[#E21E26]" /> Personal Details
              </h2>
              <div className="grid sm:grid-cols-[180px_1fr] gap-5">
                <PhotoUpload
                  label="Profile Photo"
                  hint="Clear front-facing photo, no sunglasses"
                  value={p.photoUrl}
                  folder="kyc"
                  name="profile"
                  capture="user"
                  required
                  showError={showPhotoErrors}
                  onChange={(url) => setProfile({ photoUrl: url })}
                />
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Full Name (as on licence)" required error={errors.name} className="md:col-span-2">
                    <input className={inputCls(errors.name)} value={p.name} onChange={(e) => setProfile({ name: e.target.value })} autoComplete="name" />
                  </Field>
                  <Field label="Date of Birth" required error={errors.dob}>
                    <input type="date" max={todayISO()} className={inputCls(errors.dob)} value={p.dob} onChange={(e) => setProfile({ dob: e.target.value })} />
                  </Field>
                  <Field label="Gender" required error={errors.gender}>
                    <select className={inputCls(errors.gender)} value={p.gender} onChange={(e) => setProfile({ gender: e.target.value })}>
                      <option value="">Select</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </Field>
                  <Field label="Email (optional)" error={errors.email} className="md:col-span-2">
                    <input type="email" className={inputCls(errors.email)} value={p.email} onChange={(e) => setProfile({ email: e.target.value })} autoComplete="email" />
                  </Field>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Residential Address" required error={errors.address} className="md:col-span-3">
                  <textarea className={`${inputCls(errors.address)} h-20`} value={p.address} onChange={(e) => setProfile({ address: e.target.value })} />
                </Field>
                <Field label="City" required error={errors.city}>
                  <input className={inputCls(errors.city)} value={p.city} onChange={(e) => setProfile({ city: e.target.value })} />
                </Field>
                <Field label="Pincode" required error={errors.pincode}>
                  <input inputMode="numeric" maxLength={6} className={inputCls(errors.pincode)} value={p.pincode} onChange={(e) => setProfile({ pincode: e.target.value.replace(/\D/g, '') })} />
                </Field>
                <div className="hidden md:block" />
                <Field label="Emergency Contact Name" required error={errors.emergencyContactName}>
                  <input className={inputCls(errors.emergencyContactName)} value={p.emergencyContactName} onChange={(e) => setProfile({ emergencyContactName: e.target.value })} />
                </Field>
                <Field label="Emergency Contact Mobile" required error={errors.emergencyContact}>
                  <input type="tel" inputMode="numeric" maxLength={10} className={inputCls(errors.emergencyContact)} value={p.emergencyContact} onChange={(e) => setProfile({ emergencyContact: e.target.value.replace(/\D/g, '') })} />
                </Field>
              </div>
            </>
          )}

          {/* STEP 2 — IDENTITY & LICENCE */}
          {step === 2 && (
            <>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#E21E26]" /> Identity Proof
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Aadhaar Number" required error={errors.aadhaarNumber}>
                  <input inputMode="numeric" maxLength={14} className={inputCls(errors.aadhaarNumber)} value={id.aadhaarNumber} onChange={(e) => setIdentity({ aadhaarNumber: e.target.value.replace(/[^\d ]/g, '') })} placeholder="1234 5678 9012" />
                </Field>
                <Field label="PAN Number (optional)" error={errors.panNumber}>
                  <input maxLength={10} className={`${inputCls(errors.panNumber)} uppercase`} value={id.panNumber} onChange={(e) => setIdentity({ panNumber: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" />
                </Field>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <PhotoUpload label="Aadhaar Front" value={id.aadhaarFrontUrl} folder="kyc" name="aadhaar-front" capture="environment" required showError={showPhotoErrors} onChange={(url) => setIdentity({ aadhaarFrontUrl: url })} />
                <PhotoUpload label="Aadhaar Back" value={id.aadhaarBackUrl} folder="kyc" name="aadhaar-back" capture="environment" required showError={showPhotoErrors} onChange={(url) => setIdentity({ aadhaarBackUrl: url })} />
                <PhotoUpload label="PAN Card" hint="Optional" value={id.panPhotoUrl} folder="kyc" name="pan" capture="environment" onChange={(url) => setIdentity({ panPhotoUrl: url })} />
              </div>

              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 pt-3 border-t border-gray-100">
                <CreditCard className="w-5 h-5 text-[#E21E26]" /> Driving Licence
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Driving Licence Number" required error={errors.licenseNumber}>
                  <input className={`${inputCls(errors.licenseNumber)} uppercase font-mono`} value={l.number} onChange={(e) => setLicense({ number: e.target.value.toUpperCase() })} placeholder="TN01 20190012345" />
                </Field>
                <Field label="Licence Valid Till" required error={errors.licenseExpiry}>
                  <input type="date" className={inputCls(errors.licenseExpiry)} value={l.expiryDate} onChange={(e) => setLicense({ expiryDate: e.target.value })} />
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <PhotoUpload label="Licence Front" value={l.frontPhotoUrl} folder="kyc" name="dl-front" capture="environment" required showError={showPhotoErrors} onChange={(url) => setLicense({ frontPhotoUrl: url })} />
                <PhotoUpload label="Licence Back" value={l.backPhotoUrl} folder="kyc" name="dl-back" capture="environment" required showError={showPhotoErrors} onChange={(url) => setLicense({ backPhotoUrl: url })} />
              </div>
            </>
          )}

          {/* STEP 3 — VEHICLE */}
          {step === 3 && (
            <>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Car className="w-5 h-5 text-[#E21E26]" /> Vehicle Details
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Registration Number" required error={errors.vehicleNumber}>
                  <input className={`${inputCls(errors.vehicleNumber)} uppercase font-mono`} value={v.vehicleNumber} onChange={(e) => setVehicle({ vehicleNumber: e.target.value.toUpperCase() })} placeholder="TN 01 AB 1234" />
                </Field>
                <Field label="Vehicle Category" required>
                  <select
                    className={inputCls()}
                    value={v.vehicleType}
                    onChange={(e) => {
                      const t = VEHICLE_TYPES.find((x) => x.value === e.target.value)!;
                      setVehicle({ vehicleType: t.value, capacity: t.seats });
                    }}
                  >
                    {VEHICLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Make / Brand" required error={errors.make}>
                  <input className={inputCls(errors.make)} value={v.make} onChange={(e) => setVehicle({ make: e.target.value })} placeholder="Maruti Suzuki" />
                </Field>
                <Field label="Model" required error={errors.model}>
                  <input className={inputCls(errors.model)} value={v.model} onChange={(e) => setVehicle({ model: e.target.value })} placeholder="Dzire" />
                </Field>
                <Field label="Manufacturing Year" required error={errors.year}>
                  <input inputMode="numeric" maxLength={4} className={inputCls(errors.year)} value={v.year} onChange={(e) => setVehicle({ year: e.target.value.replace(/\D/g, '') })} placeholder="2022" />
                </Field>
                <Field label="Colour" required error={errors.color}>
                  <input className={inputCls(errors.color)} value={v.color} onChange={(e) => setVehicle({ color: e.target.value })} placeholder="White" />
                </Field>
                <Field label="Seating Capacity (excl. driver)" required error={errors.capacity}>
                  <input type="number" min={2} max={30} className={inputCls(errors.capacity)} value={v.capacity || ''} onChange={(e) => setVehicle({ capacity: Number(e.target.value) })} />
                </Field>
                <Field label="Fuel Type" required>
                  <select className={inputCls()} value={v.fuelType} onChange={(e) => setVehicle({ fuelType: e.target.value })}>
                    <option>Diesel</option>
                    <option>Petrol</option>
                    <option>CNG</option>
                    <option>Electric</option>
                  </select>
                </Field>
              </div>
              <p className="text-xs font-bold text-gray-700 pt-2">Vehicle Photos <span className="text-[#E21E26]">*</span></p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <PhotoUpload compact label="Front (with plate)" value={v.frontPhotoUrl} folder="vehicle" name="front" capture="environment" required showError={showPhotoErrors} onChange={(url) => setVehicle({ frontPhotoUrl: url })} />
                <PhotoUpload compact label="Rear (with plate)" value={v.rearPhotoUrl} folder="vehicle" name="rear" capture="environment" required showError={showPhotoErrors} onChange={(url) => setVehicle({ rearPhotoUrl: url })} />
                <PhotoUpload compact label="Side View" value={v.sidePhotoUrl} folder="vehicle" name="side" capture="environment" required showError={showPhotoErrors} onChange={(url) => setVehicle({ sidePhotoUrl: url })} />
                <PhotoUpload compact label="Interior" value={v.interiorPhotoUrl} folder="vehicle" name="interior" capture="environment" required showError={showPhotoErrors} onChange={(url) => setVehicle({ interiorPhotoUrl: url })} />
              </div>
            </>
          )}

          {/* STEP 4 — VEHICLE DOCUMENTS */}
          {step === 4 && (
            <>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#E21E26]" /> Vehicle Documents
              </h2>
              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-3 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-extrabold text-gray-900">Registration Certificate (RC)</p>
                  <Field label="RC Number" required error={errors.rcNumber}>
                    <input className={`${inputCls(errors.rcNumber)} uppercase font-mono`} value={v.rcNumber} onChange={(e) => setVehicle({ rcNumber: e.target.value.toUpperCase() })} />
                  </Field>
                  <PhotoUpload compact label="RC Photo" value={v.rcDocUrl} folder="vehicle" name="rc" capture="environment" required showError={showPhotoErrors} onChange={(url) => setVehicle({ rcDocUrl: url })} />
                </div>
                <div className="space-y-3 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-extrabold text-gray-900">Commercial Insurance</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Policy Number" required error={errors.insuranceNumber}>
                      <input className={`${inputCls(errors.insuranceNumber)} font-mono`} value={v.insuranceNumber} onChange={(e) => setVehicle({ insuranceNumber: e.target.value })} />
                    </Field>
                    <Field label="Valid Till" required error={errors.insuranceExpiry}>
                      <input type="date" className={inputCls(errors.insuranceExpiry)} value={v.insuranceExpiry} onChange={(e) => setVehicle({ insuranceExpiry: e.target.value })} />
                    </Field>
                  </div>
                  <PhotoUpload compact label="Insurance Policy" value={v.insuranceDocUrl} folder="vehicle" name="insurance" capture="environment" required showError={showPhotoErrors} onChange={(url) => setVehicle({ insuranceDocUrl: url })} />
                </div>
                <div className="space-y-3 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-extrabold text-gray-900">Taxi / Tourist Permit</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Permit Number" required error={errors.statePermitNumber}>
                      <input className={`${inputCls(errors.statePermitNumber)} font-mono`} value={v.statePermitNumber} onChange={(e) => setVehicle({ statePermitNumber: e.target.value })} />
                    </Field>
                    <Field label="Valid Till" required error={errors.permitExpiry}>
                      <input type="date" className={inputCls(errors.permitExpiry)} value={v.permitExpiry} onChange={(e) => setVehicle({ permitExpiry: e.target.value })} />
                    </Field>
                  </div>
                  <PhotoUpload compact label="Permit Document" value={v.statePermitDocUrl} folder="vehicle" name="permit" capture="environment" required showError={showPhotoErrors} onChange={(url) => setVehicle({ statePermitDocUrl: url })} />
                </div>
                <div className="space-y-3 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-extrabold text-gray-900">Fitness Certificate (FC) <span className="font-normal text-gray-500">— if applicable</span></p>
                  <Field label="FC Valid Till" error={errors.fitnessExpiry}>
                    <input type="date" className={inputCls(errors.fitnessExpiry)} value={v.fitnessExpiry} onChange={(e) => setVehicle({ fitnessExpiry: e.target.value })} />
                  </Field>
                  <PhotoUpload compact label="FC Document" value={v.fitnessDocUrl} folder="vehicle" name="fitness" capture="environment" onChange={(url) => setVehicle({ fitnessDocUrl: url })} />
                </div>
              </div>
            </>
          )}

          {/* STEP 5 — BANK */}
          {step === 5 && (
            <>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-[#E21E26]" /> Payout Bank Account
              </h2>
              <p className="text-xs text-gray-500 -mt-3">Your trip earnings are paid to this account.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Account Holder Name" required error={errors.accountHolder} className="md:col-span-2">
                  <input className={inputCls(errors.accountHolder)} value={b.accountHolder} onChange={(e) => setBank({ accountHolder: e.target.value })} />
                </Field>
                <Field label="Account Number" required error={errors.accountNumber}>
                  <input inputMode="numeric" className={`${inputCls(errors.accountNumber)} font-mono`} value={b.accountNumber} onChange={(e) => setBank({ accountNumber: e.target.value.replace(/\D/g, '') })} autoComplete="off" />
                </Field>
                <Field label="Confirm Account Number" required error={errors.confirmAccount}>
                  <input inputMode="numeric" className={`${inputCls(errors.confirmAccount)} font-mono`} value={confirmAccount} onChange={(e) => setConfirmAccount(e.target.value.replace(/\D/g, ''))} onPaste={(e) => e.preventDefault()} autoComplete="off" />
                </Field>
                <Field label="IFSC Code" required error={errors.ifsc}>
                  <input maxLength={11} className={`${inputCls(errors.ifsc)} uppercase font-mono`} value={b.ifsc} onChange={(e) => setBank({ ifsc: e.target.value.toUpperCase() })} placeholder="SBIN0001234" />
                </Field>
                <Field label="Bank Name">
                  <input className={inputCls()} value={b.bankName} onChange={(e) => setBank({ bankName: e.target.value })} />
                </Field>
                <Field label="UPI ID (optional)" error={errors.upiId} className="md:col-span-2">
                  <input className={`${inputCls(errors.upiId)} font-mono`} value={b.upiId} onChange={(e) => setBank({ upiId: e.target.value.trim() })} placeholder="name@okaxis" />
                </Field>
              </div>
            </>
          )}

          {/* STEP 6 — REVIEW */}
          {step === 6 && (
            <>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#E21E26]" /> Review &amp; Submit
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {p.photoUrl && <img src={p.photoUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />}
                    <div>
                      <p className="text-sm font-extrabold text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.phone}</p>
                    </div>
                    <button type="button" onClick={() => setStep(1)} className="ml-auto text-[11px] font-bold text-[#E21E26]">Edit</button>
                  </div>
                  <ReviewRow label="Date of birth" value={p.dob} />
                  <ReviewRow label="Gender" value={p.gender} />
                  <ReviewRow label="Email" value={p.email} />
                  <ReviewRow label="Address" value={`${p.address}, ${p.city} - ${p.pincode}`} />
                  <ReviewRow label="Emergency contact" value={`${p.emergencyContactName} (${p.emergencyContact})`} />
                </div>
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between mb-2">
                    <p className="text-xs font-extrabold text-gray-900">Identity &amp; Licence</p>
                    <button type="button" onClick={() => setStep(2)} className="text-[11px] font-bold text-[#E21E26]">Edit</button>
                  </div>
                  <ReviewRow label="Aadhaar" value={maskAadhaar(id.aadhaarNumber)} />
                  <ReviewRow label="PAN" value={id.panNumber} />
                  <ReviewRow label="Licence no." value={l.number} />
                  <ReviewRow label="Licence valid till" value={l.expiryDate} />
                </div>
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between mb-2">
                    <p className="text-xs font-extrabold text-gray-900">Vehicle</p>
                    <button type="button" onClick={() => setStep(3)} className="text-[11px] font-bold text-[#E21E26]">Edit</button>
                  </div>
                  <ReviewRow label="Registration" value={v.vehicleNumber} />
                  <ReviewRow label="Vehicle" value={`${v.make} ${v.model} (${v.year}) • ${v.color}`} />
                  <ReviewRow label="Category" value={`${v.vehicleType} • ${v.capacity} seats • ${v.fuelType}`} />
                  <ReviewRow label="RC no." value={v.rcNumber} />
                  <ReviewRow label="Insurance till" value={v.insuranceExpiry} />
                  <ReviewRow label="Permit till" value={v.permitExpiry} />
                  <ReviewRow label="FC till" value={v.fitnessExpiry} />
                </div>
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between mb-2">
                    <p className="text-xs font-extrabold text-gray-900">Bank</p>
                    <button type="button" onClick={() => setStep(5)} className="text-[11px] font-bold text-[#E21E26]">Edit</button>
                  </div>
                  <ReviewRow label="Account holder" value={b.accountHolder} />
                  <ReviewRow label="Account no." value={maskAccount(b.accountNumber)} />
                  <ReviewRow label="IFSC" value={b.ifsc} />
                  <ReviewRow label="UPI" value={b.upiId} />
                </div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {[p.photoUrl, id.aadhaarFrontUrl, l.frontPhotoUrl, l.backPhotoUrl, v.frontPhotoUrl, v.rcDocUrl, v.insuranceDocUrl, v.statePermitDocUrl]
                  .filter(Boolean)
                  .map((url) => (
                    <img key={url} src={url} alt="" className="h-16 w-full object-cover rounded-lg border border-gray-200" />
                  ))}
              </div>

              <label className="flex items-start gap-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[#E21E26]" />
                <span>
                  I declare that the information and documents provided are genuine and belong to me / my vehicle, and I
                  authorise NESAM Tours &amp; Travels to verify them.
                </span>
              </label>

              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3 rounded-xl">{submitError}</div>
              )}
            </>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { setErrors({}); setStep((s) => Math.max(1, s - 1)); }}
              disabled={step === 1 || submitting}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 text-xs font-bold rounded-xl disabled:opacity-40"
            >
              Back
            </button>
            {step < STEPS.length ? (
              <button type="button" onClick={goNext} className="px-6 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow">
                Save &amp; Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow disabled:opacity-60 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Submitting...' : mode === 'signup' ? 'Submit for Verification' : 'Resubmit for Verification'}
              </button>
            )}
          </div>
          {Object.keys(errors).length > 0 && (
            <p className="text-[11px] text-red-600 font-semibold text-right -mt-2">Please fix the highlighted fields.</p>
          )}
        </div>
      </div>
    </div>
  );
};
