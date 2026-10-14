import React, { useMemo, useState } from 'react';
import type { PayoutDetails, VendorRecord } from '../../types';
import { saveBusinessAccountStep, type VendorKyc } from '../../services/onboardingService';
import { describeDataError } from '../../utils/retry';
import {
  digitsOnly,
  hasErrors,
  normalizeSpaces,
  validateAccountNumber,
  validateBusinessName,
  validateIfsc,
  validatePersonName,
  validateUpi,
} from '../../utils/validation';
import { Button, ErrorBanner, TextField } from '../../components/onboarding/ui';

interface Props {
  record: VendorRecord;
  kyc: VendorKyc | null;
  onKycChange: (k: VendorKyc) => void;
  onNext: () => void;
}

/** Spec page 13: "business/account details" — owner and business name, and the payout account. */
export const BusinessAccountStep: React.FC<Props> = ({ record, kyc, onKycChange, onNext }) => {
  const b = record.business;
  const saved = kyc?.payout;
  const [form, setForm] = useState({
    vendorName: b?.vendorName ?? '',
    businessName: b?.businessName ?? '',
    accountHolderName: saved?.accountHolderName ?? b?.vendorName ?? '',
    accountNumber: saved?.accountNumber ?? '',
    confirmAccountNumber: saved?.accountNumber ?? '',
    ifsc: saved?.ifsc ?? '',
    upiId: saved?.upiId ?? '',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const errors = useMemo(
    () => ({
      vendorName: validatePersonName(form.vendorName, 'Owner name'),
      businessName: validateBusinessName(form.businessName),
      accountHolderName: validatePersonName(form.accountHolderName, 'Account holder name'),
      accountNumber: validateAccountNumber(form.accountNumber),
      confirmAccountNumber: !form.confirmAccountNumber
        ? 'Please re-enter the account number.'
        : form.confirmAccountNumber !== form.accountNumber
          ? 'Account numbers do not match.'
          : '',
      ifsc: validateIfsc(form.ifsc),
      upiId: validateUpi(form.upiId),
    }),
    [form],
  );

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const blur = (key: string) => () => setTouched((t) => ({ ...t, [key]: true }));
  const err = (key: keyof typeof errors) => (submitted || touched[key] ? errors[key] : '');

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors) || saving) return;
    const payout: PayoutDetails = {
      accountHolderName: normalizeSpaces(form.accountHolderName),
      accountNumber: digitsOnly(form.accountNumber),
      ifsc: form.ifsc.trim().toUpperCase(),
      upiId: form.upiId.trim().toLowerCase(),
    };
    setSaving(true);
    setSaveError('');
    try {
      await saveBusinessAccountStep(record, { vendorName: normalizeSpaces(form.vendorName), businessName: normalizeSpaces(form.businessName) }, payout);
      onKycChange({ identityNumber: kyc?.identityNumber ?? '', payout });
      onNext();
    } catch (error) {
      setSaveError(describeDataError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <h2 className="text-[13px] font-bold text-[#111] mb-3">Business details</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField id="vendorName" label="Owner Name" required value={form.vendorName} onChange={set('vendorName')} onBlur={blur('vendorName')} error={err('vendorName')} placeholder="Ravi Kumar" autoComplete="name" autoFocus />
          <TextField id="businessName" label="Business / Agency Name" required value={form.businessName} onChange={set('businessName')} onBlur={blur('businessName')} error={err('businessName')} placeholder="Sri Balaji Travels" autoComplete="organization" />
        </div>
      </div>

      <div>
        <h2 className="text-[13px] font-bold text-[#111] mb-3">Account details</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <TextField id="accountHolderName" label="Bank Account Holder Name" required value={form.accountHolderName} onChange={set('accountHolderName')} onBlur={blur('accountHolderName')} error={err('accountHolderName')} hint="Exactly as printed on your passbook / cheque" />
          </div>
          <TextField id="accountNumber" label="Account Number" required inputMode="numeric" autoComplete="off" value={form.accountNumber} onChange={(v) => set('accountNumber')(digitsOnly(v).slice(0, 18))} onBlur={blur('accountNumber')} error={err('accountNumber')} />
          <TextField
            id="confirmAccountNumber"
            label="Confirm Account Number"
            required
            inputMode="numeric"
            autoComplete="off"
            value={form.confirmAccountNumber}
            onChange={(v) => set('confirmAccountNumber')(digitsOnly(v).slice(0, 18))}
            onBlur={blur('confirmAccountNumber')}
            onPaste={(e) => e.preventDefault()}
            error={err('confirmAccountNumber')}
          />
          <TextField id="ifsc" label="IFSC Code" required value={form.ifsc} onChange={(v) => set('ifsc')(v.toUpperCase().replace(/\s/g, '').slice(0, 11))} onBlur={blur('ifsc')} error={err('ifsc')} placeholder="SBIN0001234" />
          <TextField id="upiId" label="UPI ID" value={form.upiId} onChange={(v) => set('upiId')(v.replace(/\s/g, ''))} onBlur={blur('upiId')} error={err('upiId')} placeholder="business@okhdfcbank" hint="Optional · used for instant settlements" />
        </div>
        <p className="mt-3 text-[11px] text-[#888]">
          Account details are stored in a restricted record visible only to you and the NESAM finance team. After approval, changes require re-verification by support.
        </p>
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
