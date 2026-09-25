import React, { useMemo, useState } from 'react';
import { CheckCircle, FileText, Loader2, ShieldCheck } from 'lucide-react';
import type { StoredFile, VendorRecord } from '../types';
import { BUSINESS_REG_TYPES, IDENTITY_PROOF_TYPES, INDIAN_STATES } from '../config/onboarding';
import { updateApprovedContactInfo } from '../services/onboardingService';
import { resolveFileUrl } from '../services/storageService';
import { describeDataError } from '../utils/retry';
import {
  digitsOnly,
  hasErrors,
  normalizeSpaces,
  validateAltPhone,
  validateEmail,
  validatePincode,
  validateRequired,
} from '../utils/validation';
import { Button, ErrorBanner, SelectField, TextField } from '../components/onboarding/ui';

interface DocumentsVerificationScreenProps {
  record: VendorRecord;
}

const FileLinks: React.FC<{ files: StoredFile[] }> = ({ files }) => {
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState('');
  const open = async (f: StoredFile) => {
    const win = window.open('', '_blank');
    if (win) win.opener = null;
    setOpening(f.path);
    setError('');
    try {
      const url = await resolveFileUrl(f.path);
      if (win) win.location.href = url;
      else window.open(url, '_blank', 'noopener');
    } catch (err) {
      win?.close();
      setError(describeDataError(err));
    } finally {
      setOpening(null);
    }
  };
  if (!files.length) return <span className="text-[11px] text-[#999]">No files</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((f) => (
        <button
          key={f.path}
          onClick={() => open(f)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#F5F5F5] border border-[#E5E5E5] text-[11px] font-medium text-[#333] hover:border-[#E21B23] max-w-[180px]"
          title={f.name}
        >
          {opening === f.path ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> : <FileText className="w-3 h-3 shrink-0" />}
          <span className="truncate">{f.name}</span>
        </button>
      ))}
      {error && <p className="w-full text-[11px] text-[#E21B23]">{error}</p>}
    </div>
  );
};

const Info: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="border rounded-xl p-4 bg-gray-50 space-y-1.5">
    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</div>
    <div className="text-xs font-semibold text-gray-900">{children}</div>
  </div>
);

export const DocumentsVerificationScreen: React.FC<DocumentsVerificationScreenProps> = ({ record }) => {
  const b = record.business;
  const [form, setForm] = useState({
    email: b?.email ?? '',
    altPhone: b?.altPhone ?? '',
    line1: b?.address.line1 ?? '',
    line2: b?.address.line2 ?? '',
    city: b?.address.city ?? '',
    state: b?.address.state ?? '',
    pincode: b?.address.pincode ?? '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const errors = useMemo(
    () => ({
      email: validateEmail(form.email),
      altPhone: validateAltPhone(form.altPhone, record.phone),
      line1: validateRequired(form.line1, 'Address line 1', 150),
      city: validateRequired(form.city, 'City', 60),
      state: form.state ? '' : 'Select a state.',
      pincode: validatePincode(form.pincode),
    }),
    [form, record.phone],
  );
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : '');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!b || hasErrors(errors)) return;
    setSaving(true);
    setSaveError('');
    try {
      await updateApprovedContactInfo(b, {
        email: form.email.trim().toLowerCase(),
        altPhone: digitsOnly(form.altPhone),
        address: {
          line1: normalizeSpaces(form.line1),
          line2: normalizeSpaces(form.line2),
          city: normalizeSpaces(form.city),
          state: form.state,
          pincode: form.pincode.trim(),
        },
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (error) {
      setSaveError(describeDataError(error));
    } finally {
      setSaving(false);
    }
  };

  const d = record.documents;
  const f = record.fleet;
  const p = record.payoutSummary;

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-[#111111] text-white p-6 rounded-2xl border border-[#262626] shadow-xl flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#E21E26]" /> {b?.businessName || 'Vendor'} — Verification
          </h1>
          <p className="text-xs text-gray-400 mt-1">Documents and details approved by the Nesam verification team</p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <ShieldCheck className="w-4 h-4" /> VERIFIED VENDOR
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900 border-b pb-2">Verified Documents</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Info label={BUSINESS_REG_TYPES.find((t) => t.value === d?.businessRegistration.type)?.label ?? 'Business Registration'}>
            <div className="font-mono mb-2">{d?.businessRegistration.number || '—'}</div>
            <FileLinks files={d?.businessRegistration.files ?? []} />
          </Info>
          <Info label={IDENTITY_PROOF_TYPES.find((t) => t.value === d?.identityProof.type)?.label ?? 'Identity Proof'}>
            <div className="font-mono mb-2">{d?.identityProof.maskedNumber || '—'}</div>
            <FileLinks files={d?.identityProof.files ?? []} />
          </Info>
          <Info label="Registration Certificates (RC)">
            <FileLinks files={f?.rcFiles ?? []} />
          </Info>
          <Info label="Insurance / Fitness">
            <FileLinks files={f?.insuranceFiles ?? []} />
          </Info>
          <Info label="Fleet">
            {f ? `${f.fleetSize} vehicle(s) · ${f.vehicleTypes.join(', ')}` : '—'}
          </Info>
          <Info label="Payout Account">
            {p ? `${p.accountHolderName} · ••••${p.bankLast4} · ${p.ifsc}${p.upiId ? ` · ${p.upiId}` : ''}` : '—'}
            <p className="text-[11px] font-normal text-gray-500 mt-1">To change bank details, contact partner support — changes are re-verified.</p>
          </Info>
        </div>
      </div>

      <form onSubmit={handleSave} noValidate className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900 border-b pb-2">Contact Details</h2>
        <p className="text-[12px] text-gray-500">
          Registered name <span className="font-semibold text-gray-800">{b?.vendorName}</span> and login number{' '}
          <span className="font-semibold text-gray-800">{record.phone}</span> can only be changed by support.
        </p>

        {savedSuccess && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" /> Contact details saved.
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <TextField id="c-email" label="Email Address" required type="email" value={form.email} onChange={set('email')} error={err('email')} />
          <TextField id="c-alt" label="Alternate Contact Number" prefix="+91" inputMode="numeric" maxLength={10} value={form.altPhone} onChange={(v) => set('altPhone')(digitsOnly(v))} error={err('altPhone')} hint="Optional" />
          <div className="md:col-span-2">
            <TextField id="c-line1" label="Address Line 1" required value={form.line1} onChange={set('line1')} error={err('line1')} />
          </div>
          <div className="md:col-span-2">
            <TextField id="c-line2" label="Address Line 2" value={form.line2} onChange={set('line2')} />
          </div>
          <TextField id="c-city" label="City" required value={form.city} onChange={set('city')} error={err('city')} />
          <SelectField id="c-state" label="State / UT" required value={form.state} onChange={set('state')} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} placeholder="Select state" error={err('state')} />
          <TextField id="c-pin" label="PIN Code" required inputMode="numeric" maxLength={6} value={form.pincode} onChange={(v) => set('pincode')(digitsOnly(v))} error={err('pincode')} />
        </div>

        <ErrorBanner message={saveError} />
        <div className="flex justify-end pt-2">
          <Button type="submit" loading={saving} disabled={!b}>
            {saving ? 'Saving…' : 'Save Contact Details'}
          </Button>
        </div>
      </form>
    </div>
  );
};
