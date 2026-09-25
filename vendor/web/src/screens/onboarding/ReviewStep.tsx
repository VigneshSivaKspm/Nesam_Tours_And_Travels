import React, { useState } from 'react';
import { AlertTriangle, Pencil } from 'lucide-react';
import type { OnboardingSection, VendorRecord } from '../../types';
import { BUSINESS_REG_TYPES, IDENTITY_PROOF_TYPES, ONBOARDING_STEPS, SECTION_LABELS } from '../../config/onboarding';
import { missingSections, submitForReview } from '../../services/onboardingService';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { describeDataError } from '../../utils/retry';
import { Button, ErrorBanner } from '../../components/onboarding/ui';

interface ReviewStepProps {
  record: VendorRecord;
  preApproved: boolean;
  onEdit: (stepIndex: number) => void;
  onBack: () => void;
}

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1.5 text-[12px]">
    <span className="text-[#888] shrink-0">{label}</span>
    <span className="font-semibold text-[#111] text-right break-words min-w-0">{value || '—'}</span>
  </div>
);

export const ReviewStep: React.FC<ReviewStepProps> = ({ record, preApproved, onEdit, onBack }) => {
  const online = useOnlineStatus();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const missing = missingSections(record);
  const { business: b, documents: d, fleet: f, payoutSummary: p } = record;
  const isResubmission = record.status !== 'INCOMPLETE';

  const Section: React.FC<{ id: OnboardingSection; children: React.ReactNode }> = ({ id, children }) => {
    const isMissing = missing.includes(id);
    const flagged = record.review?.flaggedSections.includes(id) && isResubmission;
    return (
      <div className={`rounded-xl border p-4 ${isMissing ? 'border-[#FBD5D5] bg-[#FFF8F8]' : flagged ? 'border-amber-200 bg-amber-50/40' : 'border-[#E5E5E5]'}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-bold text-[#111] flex items-center gap-1.5">
            {isMissing && <AlertTriangle className="w-4 h-4 text-[#E21B23]" />}
            {SECTION_LABELS[id]}
          </h3>
          <button
            type="button"
            onClick={() => onEdit(ONBOARDING_STEPS.findIndex((s) => s.key === id))}
            className="text-[12px] font-semibold text-[#E21B23] flex items-center gap-1 hover:underline"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
        {isMissing ? <p className="text-[12px] text-[#B4141B]">This section is incomplete.</p> : children}
      </div>
    );
  };

  const handleSubmit = async () => {
    if (missing.length || !agreed) return;
    setSubmitting(true);
    setError('');
    try {
      await submitForReview(record, preApproved);
      // The vendors/{uid} listener re-routes to the pending screen / dashboard.
    } catch (err) {
      setError(describeDataError(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Section id="business">
        <Row label="Vendor name" value={b?.vendorName} />
        <Row label="Business name" value={b?.businessName} />
        <Row label="Email" value={b?.email} />
        <Row label="Alternate number" value={b?.altPhone ? `+91 ${b.altPhone}` : ''} />
        <Row
          label="Address"
          value={b ? [b.address.line1, b.address.line2, b.address.city, `${b.address.state} ${b.address.pincode}`].filter(Boolean).join(', ') : ''}
        />
      </Section>

      <Section id="documents">
        <Row
          label={BUSINESS_REG_TYPES.find((t) => t.value === d?.businessRegistration.type)?.label ?? 'Registration'}
          value={d ? `${d.businessRegistration.number} · ${d.businessRegistration.files.length} file(s)` : ''}
        />
        <Row
          label={IDENTITY_PROOF_TYPES.find((t) => t.value === d?.identityProof.type)?.label ?? 'Identity proof'}
          value={d ? `${d.identityProof.maskedNumber} · ${d.identityProof.files.length} file(s)` : ''}
        />
      </Section>

      <Section id="fleet">
        <Row label="Vehicle types" value={f?.vehicleTypes.join(', ')} />
        <Row label="Fleet size" value={f ? `${f.fleetSize} vehicle(s)` : ''} />
        <Row label="RC documents" value={f ? `${f.rcFiles.length} file(s)` : ''} />
        <Row label="Vehicle photos" value={f ? `${f.vehiclePhotos.length} file(s)` : ''} />
        <Row label="Insurance / fitness" value={f ? `${f.insuranceFiles.length} file(s)` : ''} />
      </Section>

      <Section id="payout">
        <Row label="Account holder" value={p?.accountHolderName} />
        <Row label="Account number" value={p ? `••••${p.bankLast4}` : ''} />
        <Row label="IFSC" value={p?.ifsc} />
        <Row label="UPI ID" value={p?.upiId} />
      </Section>

      <label className="flex items-start gap-2.5 text-[12px] text-[#444] cursor-pointer select-none pt-1">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[#E21B23]"
        />
        I confirm that the information and documents provided are genuine, and I agree to NESAM's Fleet Partner Terms
        of Service and Privacy Policy.
      </label>

      {missing.length > 0 && <ErrorBanner message="Complete the highlighted sections before submitting." />}
      <ErrorBanner message={error} onRetry={error ? handleSubmit : undefined} />

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button onClick={handleSubmit} loading={submitting} disabled={!agreed || missing.length > 0 || !online}>
          {submitting ? 'Submitting…' : isResubmission ? 'Resubmit for Review' : 'Submit Application'}
        </Button>
      </div>
    </div>
  );
};
