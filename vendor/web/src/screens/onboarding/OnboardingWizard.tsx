import React, { useEffect, useState } from 'react';
import { Building2, Check, LogOut, MessageSquareWarning } from 'lucide-react';
import type { VendorRecord } from '../../types';
import { ONBOARDING_STEPS, SECTION_LABELS } from '../../config/onboarding';
import { getVendorInvite, getVendorKyc, type VendorInvite, type VendorKyc } from '../../services/onboardingService';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { FullScreenLoader, OfflineBanner, RED } from '../../components/onboarding/ui';
import { BusinessStep } from './BusinessStep';
import { DocumentsStep } from './DocumentsStep';
import { FleetStep } from './FleetStep';
import { PayoutStep } from './PayoutStep';
import { ReviewStep } from './ReviewStep';

export interface StepProps {
  record: VendorRecord;
  onNext: () => void;
  onBack: () => void;
}

interface OnboardingWizardProps {
  /** null until the first step is saved (brand-new vendor). */
  record: VendorRecord | null;
  phone: string;
  /** Informational banner, e.g. login attempted with an unregistered number. */
  notice?: string;
  onSignOut: () => void;
}

function initialStep(record: VendorRecord | null): number {
  if (!record) return 0;
  if ((record.status === 'CHANGES_REQUESTED' || record.status === 'REJECTED') && record.review?.flaggedSections.length) {
    const first = ONBOARDING_STEPS.findIndex((s) => s.key === record.review!.flaggedSections[0]);
    if (first >= 0) return first;
  }
  return Math.min(record.onboardingStep, ONBOARDING_STEPS.length - 1);
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ record, phone, notice, onSignOut }) => {
  const online = useOnlineStatus();
  const [step, setStep] = useState(() => initialStep(record));
  const [invite, setInvite] = useState<VendorInvite | null>(null);
  const [kyc, setKyc] = useState<VendorKyc | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(true);

  // One-time prefill: admin invite (new vendors) + private KYC (resuming vendors).
  useEffect(() => {
    let alive = true;
    Promise.all([
      getVendorInvite(phone),
      record ? getVendorKyc().catch(() => null) : Promise.resolve(null),
    ]).then(([inv, k]) => {
      if (!alive) return;
      setInvite(inv);
      setKyc(k);
      setPrefillLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to top on step change (long forms on mobile).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  if (prefillLoading) return <FullScreenLoader label="Preparing your application…" />;

  // Only allow jumping to steps that have been reached before.
  const maxReachable = Math.max(record?.onboardingStep ?? 0, step);
  const goTo = (i: number) => {
    if (i <= maxReachable) setStep(i);
  };
  const next = () => setStep((s) => Math.min(s + 1, ONBOARDING_STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const correction = record && (record.status === 'CHANGES_REQUESTED' || record.status === 'REJECTED') ? record : null;
  const current = ONBOARDING_STEPS[step];

  const renderStep = () => {
    if (step === 0) {
      return <BusinessStep record={record} invite={invite} phone={phone} onNext={next} />;
    }
    if (!record) return <FullScreenLoader label="Saving…" />;
    switch (step) {
      case 1:
        return <DocumentsStep record={record} kyc={kyc} onKycChange={setKyc} onNext={next} onBack={back} />;
      case 2:
        return <FleetStep record={record} onNext={next} onBack={back} />;
      case 3:
        return <PayoutStep record={record} kyc={kyc} onKycChange={setKyc} onNext={next} onBack={back} />;
      default:
        return <ReviewStep record={record} preApproved={!!invite?.preApproved} onEdit={goTo} onBack={back} />;
    }
  };

  return (
    <div className="min-h-screen w-full font-sans antialiased" style={{ background: '#F5F5F5' }}>
      <header className="bg-white border-b border-[#E5E5E5] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: RED }}>
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-[#111] leading-tight">Fleet Partner Onboarding</div>
              <div className="text-[11px] text-[#999] leading-tight">{phone}</div>
            </div>
          </div>
          <button onClick={onSignOut} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#666] hover:text-[#111]">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Stepper */}
        <ol className="flex items-center gap-1 sm:gap-2" aria-label="Onboarding progress">
          {ONBOARDING_STEPS.map((s, i) => {
            const done = i < step || (record?.onboardingStep ?? 0) > i;
            const active = i === step;
            const flagged = correction?.review?.flaggedSections.includes(s.key as never);
            return (
              <li key={s.key} className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  disabled={i > maxReachable}
                  aria-current={active ? 'step' : undefined}
                  className="w-full flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                >
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold border-2 transition-colors ${
                      active
                        ? 'text-white border-transparent'
                        : flagged
                          ? 'bg-amber-50 border-amber-400 text-amber-700'
                          : done
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-600'
                            : 'bg-white border-[#E5E5E5] text-[#999]'
                    }`}
                    style={active ? { background: RED } : undefined}
                  >
                    {done && !active && !flagged ? <Check className="w-4 h-4" /> : i + 1}
                  </span>
                  <span className={`text-[10px] sm:text-[11px] font-semibold truncate max-w-full ${active ? 'text-[#111]' : 'text-[#999]'}`}>
                    {s.short}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {!online && <OfflineBanner />}

        {notice && step === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-[12px] font-medium text-blue-900">{notice}</div>
        )}

        {correction && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <MessageSquareWarning className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[12px] text-amber-900 space-y-1">
              <div className="font-bold text-[13px]">
                {correction.status === 'REJECTED' ? 'Your application was not approved' : 'The Nesam team requested changes'}
              </div>
              {correction.review?.note && <p className="whitespace-pre-wrap">{correction.review.note}</p>}
              {!!correction.review?.flaggedSections.length && (
                <p>
                  Please update:{' '}
                  <span className="font-semibold">
                    {correction.review.flaggedSections.map((s) => SECTION_LABELS[s]).join(', ')}
                  </span>
                  . Then resubmit from the final step.
                </p>
              )}
            </div>
          </div>
        )}

        <section className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-5 sm:p-6">
          <div className="mb-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#999]">
              Step {step + 1} of {ONBOARDING_STEPS.length}
            </div>
            <h1 className="text-[17px] font-bold text-[#111] mt-0.5">{current.title}</h1>
          </div>
          {renderStep()}
        </section>

        <p className="text-center text-[11px] text-[#BBB]">
          Your progress is saved after each step — you can sign out and continue later.
        </p>
      </main>
    </div>
  );
};
