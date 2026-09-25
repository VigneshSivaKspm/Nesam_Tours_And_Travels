import React from 'react';
import { Ban, Car, Check, Clock, IndianRupee, Lock, LogOut, Radio, Users, XCircle, ClipboardList } from 'lucide-react';
import type { VendorRecord } from '../types';
import { SECTION_LABELS } from '../config/onboarding';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Button, OfflineBanner, RED } from '../components/onboarding/ui';

interface AccountStatusScreenProps {
  record: VendorRecord;
  onSignOut: () => void;
  /** REJECTED only: reopen the wizard to correct and reapply. */
  onReapply?: () => void;
}

// Shown only when configured (vendor/web/.env): VITE_SUPPORT_PHONE, VITE_SUPPORT_EMAIL.
const SUPPORT_CONTACT = [import.meta.env.VITE_SUPPORT_PHONE, import.meta.env.VITE_SUPPORT_EMAIL]
  .filter(Boolean)
  .join(' · ');

const LOCKED_FEATURES = [
  { icon: Car, label: 'Add & manage fleet vehicles' },
  { icon: Users, label: 'Onboard and assign drivers' },
  { icon: ClipboardList, label: 'Accept ride requests & bookings' },
  { icon: IndianRupee, label: 'Earnings, wallet & payouts' },
];

const formatDate = (ms: number | null) =>
  ms ? new Date(ms).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';

export const AccountStatusScreen: React.FC<AccountStatusScreenProps> = ({ record, onSignOut, onReapply }) => {
  const online = useOnlineStatus();
  const businessName = record.business?.businessName || 'your business';

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-10 font-sans antialiased" style={{ background: '#F5F5F5' }}>
      <div className="w-full max-w-md space-y-4">
        {!online && <OfflineBanner />}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-6 sm:p-7">{children}</div>
        <div className="flex items-center justify-between text-[11px] text-[#999] px-1">
          <span>{SUPPORT_CONTACT ? `Need help? ${SUPPORT_CONTACT}` : ''}</span>
          <button onClick={onSignOut} className="flex items-center gap-1 font-semibold text-[#666] hover:text-[#111]">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );

  if (record.status === 'SUSPENDED') {
    return shell(
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-gray-100">
          <Ban className="w-7 h-7 text-gray-500" />
        </div>
        <h1 className="text-[18px] font-bold text-[#111]">Account suspended</h1>
        <p className="text-[13px] text-[#666] mt-2">
          Operations for {businessName} are paused by the Nesam team. Contact partner support to resolve this.
        </p>
        {record.review?.note && (
          <p className="mt-4 text-[12px] text-left bg-[#F5F5F5] rounded-lg p-3 text-[#444] whitespace-pre-wrap">{record.review.note}</p>
        )}
      </div>,
    );
  }

  if (record.status === 'REJECTED') {
    return shell(
      <div>
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-[#FEF2F2]">
          <XCircle className="w-7 h-7" style={{ color: RED }} />
        </div>
        <h1 className="text-[18px] font-bold text-[#111] text-center">Application not approved</h1>
        <p className="text-[13px] text-[#666] mt-2 text-center">
          We couldn't approve {businessName} with the information provided.
        </p>
        {record.review?.note && (
          <div className="mt-4 text-[12px] bg-[#FEF2F2] border border-[#FBD5D5] rounded-lg p-3 text-[#7A1015]">
            <div className="font-bold mb-1">Reason from the verification team</div>
            <p className="whitespace-pre-wrap">{record.review.note}</p>
          </div>
        )}
        {!!record.review?.flaggedSections.length && (
          <p className="mt-3 text-[12px] text-[#444]">
            Sections to fix:{' '}
            <span className="font-semibold">{record.review.flaggedSections.map((s) => SECTION_LABELS[s]).join(', ')}</span>
          </p>
        )}
        {onReapply && (
          <Button className="w-full mt-5" onClick={onReapply}>
            Correct details & reapply
          </Button>
        )}
      </div>,
    );
  }

  // PENDING_APPROVAL
  const steps = [
    { label: 'Application submitted', sub: formatDate(record.submittedAt), state: 'done' as const },
    { label: 'Documents under review', sub: 'Usually within 24–48 business hours', state: 'active' as const },
    { label: 'Account activated', sub: 'You will be taken to your dashboard automatically', state: 'todo' as const },
  ];

  return shell(
    <div>
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-amber-50">
        <Clock className="w-7 h-7 text-amber-500" />
      </div>
      <h1 className="text-[18px] font-bold text-[#111] text-center">Verification pending</h1>
      <p className="text-[13px] text-[#666] mt-2 text-center">
        Thanks for applying, {record.business?.vendorName?.split(' ')[0] || 'partner'}! Our team is reviewing the
        details and documents for <span className="font-semibold text-[#111]">{businessName}</span>.
      </p>

      <ol className="mt-6 space-y-4">
        {steps.map((s) => (
          <li key={s.label} className="flex gap-3">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                s.state === 'done' ? 'bg-emerald-500 text-white' : s.state === 'active' ? 'bg-amber-100 text-amber-600' : 'bg-[#F0F0F0] text-[#BBB]'
              }`}
            >
              {s.state === 'done' ? <Check className="w-3.5 h-3.5" /> : s.state === 'active' ? <Clock className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3" />}
            </span>
            <div>
              <div className={`text-[13px] font-semibold ${s.state === 'todo' ? 'text-[#999]' : 'text-[#111]'}`}>{s.label}</div>
              {s.sub && <div className="text-[11px] text-[#999]">{s.sub}</div>}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-xl bg-[#F9F9F9] border border-[#EEE] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#999] mb-2.5">Unlocks after approval</div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {LOCKED_FEATURES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 text-[12px] text-[#888]">
              <Lock className="w-3 h-3 shrink-0" />
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 text-[11px] font-semibold text-emerald-600">
        <Radio className="w-3.5 h-3.5 animate-pulse" />
        This page updates automatically when your status changes
      </div>
    </div>,
  );
};
