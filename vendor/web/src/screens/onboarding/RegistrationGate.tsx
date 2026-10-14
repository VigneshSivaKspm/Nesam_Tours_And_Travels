import React, { useCallback, useEffect, useState } from 'react';
import { Building2, LogOut, PhoneCall } from 'lucide-react';
import { getRegistrationRequest, redeemVendorInvitation, requestVendorRegistration, type RegistrationState } from '../../services/onboardingService';
import { describeDataError } from '../../utils/retry';
import { Button, ErrorBanner, TextField } from '../../components/onboarding/ui';

const STORAGE_KEY = 'nesam-vendor-invite';

/** Accepts a bare code or a pasted link ("…?invite=CODE"). */
export function inviteTokenFrom(input: string): string {
  const s = input.trim();
  const m = /[?&#]invite=([A-Za-z0-9_-]+)/.exec(s);
  const t = m ? m[1] : s;
  return /^[A-Za-z0-9_-]{20,64}$/.test(t) ? t : '';
}

/**
 * The invitation arrives as ".../?invite=CODE". It is remembered for this tab
 * so it survives the phone sign-in, and cleared from the address bar so the
 * code is not left in browser history or shared by a screenshot of the URL.
 */
export function captureInviteFromUrl(): string {
  try {
    const url = new URL(window.location.href);
    const token = inviteTokenFrom(url.searchParams.get('invite') ?? '');
    if (token) {
      sessionStorage.setItem(STORAGE_KEY, token);
      url.searchParams.delete('invite');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
    return sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

const forget = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

/**
 * Shown to a signed-in phone number that has no vendor account (spec page 13):
 * "request registration in the Vendor app; the office issues a one-time
 * invitation link". Redeeming the invitation creates the application, and the
 * vendors/{uid} listener then moves on to the onboarding wizard.
 */
export const RegistrationGate: React.FC<{ phone: string; onSignOut: () => void }> = ({ phone, onSignOut }) => {
  const [state, setState] = useState<RegistrationState | null>(null);
  const [code, setCode] = useState(() => captureInviteFromUrl());
  const [busy, setBusy] = useState<'request' | 'redeem' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void getRegistrationRequest().then((r) => {
      if (alive && r) setState(r.status === 'Invited' ? 'invited' : 'requested');
    });
    return () => {
      alive = false;
    };
  }, []);

  const redeem = useCallback(async (raw: string) => {
    const token = inviteTokenFrom(raw);
    if (!token) {
      setError('That does not look like a NESAM invitation link or code. Paste the whole link you received.');
      return;
    }
    setBusy('redeem');
    setError('');
    try {
      await redeemVendorInvitation(token);
      forget();
      // vendors/{uid} now exists; the gatekeeper's listener opens the wizard.
    } catch (e) {
      setError(describeDataError(e));
      setBusy(null);
    }
  }, []);

  // A link opened in this browser redeems itself as soon as the phone is verified.
  useEffect(() => {
    const token = inviteTokenFrom(code);
    if (token && sessionStorage.getItem(STORAGE_KEY) === token) void redeem(token);
    // Only on first render: later edits to the box wait for the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const request = async () => {
    setBusy('request');
    setError('');
    try {
      setState(await requestVendorRegistration());
    } catch (e) {
      setError(describeDataError(e));
    } finally {
      setBusy(null);
    }
  };

  const requested = state === 'requested' || state === 'invited';

  return (
    <div className="min-h-screen w-full font-sans antialiased flex items-center justify-center px-4 py-10" style={{ background: '#F5F5F5' }}>
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <Building2 className="w-10 h-10 text-[#E21B23] mx-auto" />
          <h1 className="text-[18px] font-bold text-[#111] mt-2">Become a NESAM fleet partner</h1>
          <p className="text-[12px] text-[#666] mt-1">Vendor accounts are opened by invitation. {phone} has no vendor account yet.</p>
        </div>

        <section className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-5 space-y-3">
          <h2 className="text-[13px] font-bold text-[#111]">1. Request registration</h2>
          {requested ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-[12px] font-medium text-emerald-900">
              {state === 'invited'
                ? 'NESAM has issued an invitation for your number. Paste the link or code below.'
                : 'Request received. NESAM will contact you with a one-time invitation link.'}
            </div>
          ) : (
            <>
              <p className="text-[12px] text-[#666]">Tell NESAM you want to register {phone}. The office will send you a one-time invitation link.</p>
              <Button onClick={request} loading={busy === 'request'}>
                {busy === 'request' ? 'Sending…' : 'Request Registration'}
              </Button>
            </>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-5 space-y-3">
          <h2 className="text-[13px] font-bold text-[#111]">2. I have an invitation</h2>
          <p className="text-[12px] text-[#666]">Paste the link or code NESAM sent you. It works once, for {phone} only.</p>
          <TextField id="inviteCode" label="Invitation link or code" value={code} onChange={setCode} placeholder="Paste here" autoComplete="off" />
          <Button onClick={() => void redeem(code)} loading={busy === 'redeem'} disabled={!code.trim()}>
            {busy === 'redeem' ? 'Checking…' : 'Continue'}
          </Button>
        </section>

        <ErrorBanner message={error} />

        <div className="flex items-center justify-between text-[12px] font-semibold text-[#666]">
          <a href="tel:+918531970197" className="flex items-center gap-1.5 hover:text-[#111]">
            <PhoneCall className="w-4 h-4" /> Partner support
          </a>
          <button type="button" onClick={onSignOut} className="flex items-center gap-1.5 hover:text-[#111]">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
};
