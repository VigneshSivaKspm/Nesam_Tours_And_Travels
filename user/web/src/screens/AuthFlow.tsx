import React, { useEffect, useRef, useState } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import {
  confirmOtpCode,
  createRecaptchaVerifier,
  describePhoneAuthError,
  sendOtpToPhone,
  signOutUser,
} from '../services/authService';
import { registerCustomerProfile } from '../services/userFirestoreService';
import { uploadProfilePhoto, validateImageFile } from '../services/storageService';
import { isValidEmail, isValidIndianMobile, isValidName, localMobile, formatPhone } from '../utils/format';
import { describeError } from '../utils/retry';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { ErrorNotice, Spinner, inputCls, labelCls, primaryBtn, secondaryBtn } from '../components/ui';

type Intent = 'login' | 'signup';
const INTENT_KEY = 'nt-auth-intent';
const RESEND_COOLDOWN_S = 30;

function readIntent(): Intent | null {
  try {
    const v = sessionStorage.getItem(INTENT_KEY);
    return v === 'login' || v === 'signup' ? v : null;
  } catch {
    return null;
  }
}
function writeIntent(v: Intent) {
  try {
    sessionStorage.setItem(INTENT_KEY, v);
  } catch {
    /* storage unavailable — message wording only */
  }
}

interface AuthFlowProps {
  /** 'needs-profile' once the phone is verified but no customer doc exists. */
  mode: 'signed-out' | 'needs-profile';
  uid?: string;
  phone?: string;
}

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center p-4">
    <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-200 p-6 sm:p-8 min-h-[560px] flex flex-col">
      {children}
    </div>
  </div>
);

export const AuthFlow: React.FC<AuthFlowProps> = ({ mode, uid, phone }) => {
  if (mode === 'needs-profile') return <ProfileSetup uid={uid!} phone={phone ?? ''} />;
  return <PhoneLogin />;
};

// ── Welcome → phone → OTP ───────────────────────────────────────────────────

const PhoneLogin: React.FC = () => {
  const [step, setStep] = useState<'welcome' | 'phone' | 'otp'>('welcome');
  const [intent, setIntent] = useState<Intent>(readIntent() ?? 'login');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { online } = useNetworkStatus();

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const start = (i: Intent) => {
    setIntent(i);
    writeIntent(i);
    setError('');
    setStep('phone');
  };

  const sendOtp = async () => {
    if (!isValidIndianMobile(mobile)) {
      setError('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.');
      return;
    }
    if (!online) {
      setError('You’re offline. Connect to the internet to receive your OTP.');
      return;
    }
    setError('');
    setSending(true);
    try {
      const verifier = createRecaptchaVerifier('recaptcha-container');
      const result = await sendOtpToPhone(`+91${mobile}`, verifier);
      setConfirmation(result);
      setOtp(['', '', '', '', '', '']);
      setStep('otp');
      setCooldown(RESEND_COOLDOWN_S);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (e) {
      setError(describePhoneAuthError(e));
    } finally {
      setSending(false);
    }
  };

  const verify = async (digits = otp) => {
    const code = digits.join('');
    if (code.length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    if (!confirmation) {
      setError('Your OTP session expired. Please request a new code.');
      return;
    }
    setError('');
    setVerifying(true);
    try {
      // App's auth listener takes over from here (dashboard or profile setup).
      await confirmOtpCode(confirmation, code);
    } catch (e) {
      setError(describePhoneAuthError(e));
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
      setVerifying(false);
    }
  };

  const onOtpChange = (index: number, raw: string) => {
    let digits = raw.replace(/\D/g, '');
    const next = [...otp];
    // Typing over an already-filled first box yields "old+new": keep the new digit.
    if (digits.length === 2 && otp[index]) digits = digits.slice(-1);
    if (digits.length > 1) {
      // Paste / SMS autofill of the whole code.
      for (let i = 0; i < 6; i++) next[i] = digits[i] ?? '';
      setOtp(next);
      otpRefs.current[Math.min(digits.length, 5)]?.focus();
      if (digits.length >= 6) void verify(next);
      return;
    }
    next[index] = digits;
    setOtp(next);
    if (digits && index < 5) otpRefs.current[index + 1]?.focus();
    if (digits && next.every((d) => d)) void verify(next);
  };

  if (step === 'welcome') {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <img src="/icons/logo.png" alt="NESAM Tours & Travels" className="w-24 h-24 rounded-3xl object-contain bg-gray-50 border border-gray-200 p-2" />
          <h1 className="text-2xl font-black tracking-wide text-gray-900">NESAM TOURS & TRAVELS</h1>
          <p className="text-xs font-bold tracking-widest uppercase text-[#E31E24]">Safe Journey, Happy Memories</p>
          <p className="text-sm text-gray-500 max-w-xs mt-2">
            Book verified cabs in minutes, track your driver live, and pay your way.
          </p>
        </div>
        <div className="space-y-3">
          <button onClick={() => start('login')} className={primaryBtn}>
            Log in
          </button>
          <button onClick={() => start('signup')} className={secondaryBtn}>
            Create an account
          </button>
          <p className="text-[11px] text-gray-400 text-center leading-snug pt-1">
            By continuing you agree to NESAM’s Terms & Conditions and Privacy Policy.
          </p>
        </div>
      </Shell>
    );
  }

  if (step === 'phone') {
    return (
      <Shell>
        <button onClick={() => setStep('welcome')} className="self-start text-xs font-bold text-gray-500 hover:text-gray-900 mb-6">
          ← Back
        </button>
        <h2 className="text-xl font-black text-gray-900">{intent === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="text-sm text-gray-500 mt-1">We’ll text a 6-digit code to verify your number.</p>
        <form
          className="mt-8 space-y-4 flex-1 flex flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void sendOtp();
          }}
        >
          <div>
            <label htmlFor="mobile" className={labelCls}>
              Mobile number
            </label>
            <div className="flex items-center bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus-within:border-[#E31E24] focus-within:bg-white">
              <span className="text-sm font-bold text-gray-700 mr-3">+91</span>
              <input
                id="mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                autoFocus
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value.replace(/\D/g, '').slice(0, 10));
                  setError('');
                }}
                placeholder="98765 43210"
                className="flex-1 bg-transparent text-base font-bold tracking-wider text-gray-900 focus:outline-none placeholder-gray-300"
              />
            </div>
          </div>
          {error && <ErrorNotice message={error} />}
          <div className="flex-1" />
          <button type="submit" disabled={sending || mobile.length !== 10} className={primaryBtn}>
            {sending ? <Spinner label="Sending OTP…" /> : 'Send OTP'}
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <button
        onClick={() => {
          setStep('phone');
          setError('');
        }}
        className="self-start text-xs font-bold text-gray-500 hover:text-gray-900 mb-6"
      >
        ← Change number
      </button>
      <h2 className="text-xl font-black text-gray-900">Enter verification code</h2>
      <p className="text-sm text-gray-500 mt-1">
        Sent to <span className="font-bold text-gray-900">{formatPhone(mobile)}</span>
      </p>
      <form
        className="mt-8 space-y-4 flex-1 flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <div className="flex justify-between gap-2" role="group" aria-label="6-digit code">
          {otp.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                otpRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={i === 0 ? 6 : 1}
              value={d}
              aria-label={`Digit ${i + 1}`}
              disabled={verifying}
              onChange={(e) => onOtpChange(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
              }}
              className={`w-full aspect-square text-center bg-gray-50 border ${
                error ? 'border-red-400' : 'border-gray-300'
              } rounded-xl text-xl font-black text-gray-900 focus:border-[#E31E24] focus:bg-white focus:outline-none`}
            />
          ))}
        </div>
        {error && <ErrorNotice message={error} />}
        <div className="text-xs text-center text-gray-500">
          {cooldown > 0 ? (
            <>Resend code in {cooldown}s</>
          ) : (
            <button type="button" onClick={() => void sendOtp()} disabled={sending} className="font-bold text-[#E31E24] hover:underline">
              {sending ? 'Resending…' : 'Resend code'}
            </button>
          )}
        </div>
        <div className="flex-1" />
        <button type="submit" disabled={verifying || otp.join('').length !== 6} className={primaryBtn}>
          {verifying ? <Spinner label="Verifying…" /> : 'Verify & continue'}
        </button>
      </form>
    </Shell>
  );
};

// ── New customer profile ────────────────────────────────────────────────────

const ProfileSetup: React.FC<{ uid: string; phone: string }> = ({ uid, phone }) => {
  const intent = readIntent();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emergency, setEmergency] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const own = localMobile(phone);
  const errors = {
    name: !isValidName(name) ? 'Enter your full name (letters and spaces, 2–60 characters).' : '',
    email: !isValidEmail(email) ? 'Enter a valid email address — receipts are sent here.' : '',
    emergency: !isValidIndianMobile(emergency)
      ? 'Enter a 10-digit mobile number for your emergency contact.'
      : emergency === own
        ? 'Your emergency contact must be a different number from yours.'
        : '',
  };
  const valid = !errors.name && !errors.email && !errors.emergency;

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError('');
    setPhotoFailed(false);
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const save = async (skipPhoto = false) => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    setError('');
    let photoUrl = '';
    try {
      if (photo && !skipPhoto) {
        try {
          photoUrl = await uploadProfilePhoto(uid, photo, setProgress);
        } catch (e) {
          setPhotoFailed(true);
          setError(`${describeError(e, 'Photo upload failed.')} You can retry, or continue without a photo and add one later.`);
          setSaving(false);
          setProgress(null);
          return;
        }
      }
      await registerCustomerProfile({
        name,
        email,
        emergencyContact: `+91 ${emergency}`,
        photoUrl,
      });
      // App's profile listener switches to the dashboard; keep the spinner.
    } catch (e) {
      setError(describeError(e, 'We couldn’t create your profile. Please try again.'));
      setSaving(false);
      setProgress(null);
    }
  };

  const fieldErr = (k: keyof typeof errors) =>
    touched && errors[k] ? <p className="text-[11px] text-red-600 mt-1">{errors[k]}</p> : null;

  return (
    <Shell>
      <h2 className="text-xl font-black text-gray-900">Complete your profile</h2>
      <p className="text-sm text-gray-500 mt-1">
        {intent === 'login'
          ? 'We didn’t find an account for this number, so let’s set one up.'
          : 'Drivers use this to identify you at pickup.'}
      </p>
      <form
        className="mt-6 space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex items-center gap-4">
          <label className="relative w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#E31E24] shrink-0">
            {preview ? (
              <img src={preview} alt="Profile preview" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-gray-500 text-center px-2">Add photo</span>
            )}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </label>
          <div className="text-xs text-gray-500">
            <p className="font-bold text-gray-700">Profile picture</p>
            <p>Optional — helps your driver recognise you.</p>
            {progress != null && <p className="text-[#E31E24] font-bold mt-1">Uploading… {progress}%</p>}
          </div>
        </div>

        <div>
          <label htmlFor="name" className={labelCls}>
            Full name
          </label>
          <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="As on your ID" />
          {fieldErr('name')}
        </div>
        <div>
          <label htmlFor="email" className={labelCls}>
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="you@example.com"
          />
          {fieldErr('email')}
        </div>
        <div>
          <label htmlFor="emergency" className={labelCls}>
            Emergency contact
          </label>
          <div className="flex items-center bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus-within:border-[#E31E24] focus-within:bg-white">
            <span className="text-sm font-bold text-gray-700 mr-3">+91</span>
            <input
              id="emergency"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={emergency}
              onChange={(e) => setEmergency(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="flex-1 bg-transparent text-sm font-medium text-gray-900 focus:outline-none placeholder-gray-400"
              placeholder="Family member or friend"
            />
          </div>
          {fieldErr('emergency')}
          <p className="text-[11px] text-gray-400 mt-1">We share your live trip with them only when you trigger SOS or share.</p>
        </div>

        {error && <ErrorNotice message={error} />}

        <button type="submit" disabled={saving} className={primaryBtn}>
          {saving ? <Spinner label="Saving…" /> : photoFailed ? 'Retry upload & continue' : 'Save & start booking'}
        </button>
        {photoFailed && !saving && (
          <button type="button" onClick={() => void save(true)} className={secondaryBtn}>
            Continue without photo
          </button>
        )}
        <button
          type="button"
          onClick={() => void signOutUser()}
          className="w-full text-xs font-bold text-gray-500 hover:text-gray-900 py-2"
        >
          Not your number? Sign out
        </button>
      </form>
    </Shell>
  );
};
