import React, { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import type { PayoutDetails, VendorRecord } from '../../types';
import { savePayoutStep, type VendorKyc } from '../../services/onboardingService';
import { describeDataError } from '../../utils/retry';
import {
  digitsOnly,
  hasErrors,
  normalizeSpaces,
  validateAccountNumber,
  validateIfsc,
  validatePersonName,
  validateUpi,
} from '../../utils/validation';
import { Button, ErrorBanner, TextField } from '../../components/onboarding/ui';

interface PayoutStepProps {
  record: VendorRecord;
  kyc: VendorKyc | null;
  onKycChange: (kyc: VendorKyc) => void;
  onNext: () => void;
  onBack: () => void;
}

export const PayoutStep: React.FC<PayoutStepProps> = ({ record, kyc, onKycChange, onNext, onBack }) => {
  const saved = kyc?.payout;
  const [form, setForm] = useState({
    accountHolderName: saved?.accountHolderName ?? record.business?.vendorName ?? '',
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
    if (hasErrors(errors)) return;
    const payout: PayoutDetails = {
      accountHolderName: normalizeSpaces(form.accountHolderName),
      accountNumber: digitsOnly(form.accountNumber),
      ifsc: form.ifsc.trim().toUpperCase(),
      upiId: form.upiId.trim().toLowerCase(),
    };
    setSaving(true);
    setSaveError('');
    try {
      await savePayoutStep(record, payout);
      onKycChange({ identityNumber: kyc?.identityNumber ?? '', payout });
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
        <div className="sm:col-span-2">
          <TextField
            id="accountHolderName"
            label="Bank Account Holder Name"
            required
            value={form.accountHolderName}
            onChange={set('accountHolderName')}
            onBlur={blur('accountHolderName')}
            error={err('accountHolderName')}
            hint="Exactly as printed on your bank passbook / cheque"
            autoComplete="off"
          />
        </div>
        <TextField
          id="accountNumber"
          label="Account Number"
          required
          inputMode="numeric"
          maxLength={18}
          value={form.accountNumber}
          onChange={(v) => set('accountNumber')(digitsOnly(v))}
          onBlur={blur('accountNumber')}
          error={err('accountNumber')}
          autoComplete="off"
        />
        <TextField
          id="confirmAccountNumber"
          label="Confirm Account Number"
          required
          inputMode="numeric"
          maxLength={18}
          value={form.confirmAccountNumber}
          onChange={(v) => set('confirmAccountNumber')(digitsOnly(v))}
          onBlur={blur('confirmAccountNumber')}
          onPaste={(e) => e.preventDefault()}
          error={err('confirmAccountNumber')}
          autoComplete="off"
        />
        <TextField
          id="ifsc"
          label="IFSC Code"
          required
          maxLength={11}
          value={form.ifsc}
          onChange={(v) => set('ifsc')(v.toUpperCase().replace(/\s/g, ''))}
          onBlur={blur('ifsc')}
          error={err('ifsc')}
          placeholder="SBIN0001234"
          autoCapitalize="characters"
          autoComplete="off"
        />
        <TextField
          id="upiId"
          label="UPI ID"
          value={form.upiId}
          onChange={(v) => set('upiId')(v.replace(/\s/g, ''))}
          onBlur={blur('upiId')}
          error={err('upiId')}
          placeholder="business@okhdfcbank"
          hint="Optional · used for instant settlements"
          autoComplete="off"
        />
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-[#777]">
        <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" />
        Bank details are stored in a restricted record visible only to you and the Nesam finance team.
        After approval, changes to payout details require re-verification by support.
      </p>

      {submitted && hasErrors(errors) && <ErrorBanner message="Please fix the highlighted fields." />}
      <ErrorBanner message={saveError} onRetry={saveError ? () => handleSubmit() : undefined} />

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button type="submit" loading={saving}>
          {saving ? 'Saving…' : 'Save & Continue'}
        </Button>
      </div>
    </form>
  );
};
