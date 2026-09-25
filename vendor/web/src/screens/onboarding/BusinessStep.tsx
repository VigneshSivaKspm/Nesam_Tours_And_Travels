import React, { useMemo, useState } from 'react';
import type { BusinessInfo, VendorRecord } from '../../types';
import { INDIAN_STATES } from '../../config/onboarding';
import { saveBusinessStep, type VendorInvite } from '../../services/onboardingService';
import { describeDataError } from '../../utils/retry';
import {
  digitsOnly,
  hasErrors,
  normalizeSpaces,
  validateAltPhone,
  validateBusinessName,
  validateEmail,
  validatePersonName,
  validatePincode,
  validateRequired,
} from '../../utils/validation';
import { Button, ErrorBanner, SelectField, TextField } from '../../components/onboarding/ui';

interface BusinessStepProps {
  record: VendorRecord | null;
  invite: VendorInvite | null;
  phone: string;
  onNext: () => void;
}

export const BusinessStep: React.FC<BusinessStepProps> = ({ record, invite, phone, onNext }) => {
  const b = record?.business;
  const [form, setForm] = useState({
    vendorName: b?.vendorName ?? invite?.vendorName ?? '',
    businessName: b?.businessName ?? invite?.businessName ?? '',
    email: b?.email ?? invite?.email ?? '',
    altPhone: b?.altPhone ?? '',
    line1: b?.address.line1 ?? '',
    line2: b?.address.line2 ?? '',
    city: b?.address.city ?? invite?.city ?? '',
    state: b?.address.state ?? '',
    pincode: b?.address.pincode ?? '',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const errors = useMemo(
    () => ({
      vendorName: validatePersonName(form.vendorName, 'Vendor name'),
      businessName: validateBusinessName(form.businessName),
      email: validateEmail(form.email),
      altPhone: validateAltPhone(form.altPhone, phone),
      line1: validateRequired(form.line1, 'Address line 1', 150),
      line2: normalizeSpaces(form.line2).length > 150 ? 'Address line 2 must be under 150 characters.' : '',
      city: validateRequired(form.city, 'City', 60),
      state: form.state ? '' : 'Select a state.',
      pincode: validatePincode(form.pincode),
    }),
    [form, phone],
  );

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const blur = (key: string) => () => setTouched((t) => ({ ...t, [key]: true }));
  const err = (key: keyof typeof errors) => (submitted || touched[key] ? errors[key] : '');

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors)) return;
    const business: BusinessInfo = {
      vendorName: normalizeSpaces(form.vendorName),
      businessName: normalizeSpaces(form.businessName),
      email: form.email.trim().toLowerCase(),
      altPhone: digitsOnly(form.altPhone),
      address: {
        line1: normalizeSpaces(form.line1),
        line2: normalizeSpaces(form.line2),
        city: normalizeSpaces(form.city),
        state: form.state,
        pincode: form.pincode.trim(),
      },
    };
    setSaving(true);
    setSaveError('');
    try {
      await saveBusinessStep(record, business);
      onNext();
    } catch (error) {
      setSaveError(describeDataError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField id="vendorName" label="Vendor (Owner) Name" required value={form.vendorName} onChange={set('vendorName')} onBlur={blur('vendorName')} error={err('vendorName')} placeholder="Ravi Kumar" autoComplete="name" autoFocus />
        <TextField id="businessName" label="Business / Agency Name" required value={form.businessName} onChange={set('businessName')} onBlur={blur('businessName')} error={err('businessName')} placeholder="Sri Balaji Travels" autoComplete="organization" />
        <TextField id="email" label="Email Address" required type="email" value={form.email} onChange={set('email')} onBlur={blur('email')} error={err('email')} placeholder="ops@company.in" autoComplete="email" />
        <TextField
          id="altPhone"
          label="Alternate Contact Number"
          prefix="+91"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={form.altPhone}
          onChange={(v) => set('altPhone')(digitsOnly(v))}
          onBlur={blur('altPhone')}
          error={err('altPhone')}
          hint="Optional"
          placeholder="90000 00000"
        />
      </div>

      <div className="pt-2">
        <h2 className="text-[13px] font-bold text-[#111] mb-3">Business Address</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <TextField id="line1" label="Address Line 1" required value={form.line1} onChange={set('line1')} onBlur={blur('line1')} error={err('line1')} placeholder="Door no., street" autoComplete="address-line1" />
          </div>
          <div className="sm:col-span-2">
            <TextField id="line2" label="Address Line 2" value={form.line2} onChange={set('line2')} onBlur={blur('line2')} error={err('line2')} placeholder="Area, landmark (optional)" autoComplete="address-line2" />
          </div>
          <TextField id="city" label="City" required value={form.city} onChange={set('city')} onBlur={blur('city')} error={err('city')} placeholder="Chennai" autoComplete="address-level2" />
          <SelectField id="state" label="State / UT" required value={form.state} onChange={set('state')} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} placeholder="Select state" error={err('state')} />
          <TextField id="pincode" label="PIN Code" required inputMode="numeric" maxLength={6} value={form.pincode} onChange={(v) => set('pincode')(digitsOnly(v))} onBlur={blur('pincode')} error={err('pincode')} placeholder="600001" autoComplete="postal-code" />
        </div>
      </div>

      {submitted && hasErrors(errors) && <ErrorBanner message="Please fix the highlighted fields." />}
      <ErrorBanner message={saveError} onRetry={saveError ? () => handleSubmit() : undefined} />

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={saving}>
          {saving ? 'Saving…' : 'Save & Continue'}
        </Button>
      </div>
    </form>
  );
};
