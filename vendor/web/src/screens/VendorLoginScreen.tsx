import React, { useState } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { Building2, ShieldCheck, Loader2 } from 'lucide-react';
import { VendorProfile } from '../types';
import { DEFAULT_VENDOR_PROFILE } from '../config/constants';
import {
  createRecaptchaVerifier,
  sendOtpToPhone,
  confirmOtpCode,
  describePhoneAuthError,
} from '../services/authService';
import {
  getExistingVendorProfile,
  registerVendorProfile,
} from '../services/vendorFirestoreService';

interface VendorLoginScreenProps {
  onComplete: (profile: VendorProfile) => void;
}

type Step = 'login' | 'otp' | 'signup';

const RED = '#E21B23';

export const VendorLoginScreen: React.FC<VendorLoginScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>('login');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);

  const [sendError, setSendError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [signupError, setSignupError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // New-vendor signup fields
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [gstin, setGstin] = useState('');

  const handleOtpChange = (index: number, val: string) => {
    const digitsOnly = val.replace(/\D/g, '');
    if (digitsOnly.length > 1) {
      const pasted = digitsOnly.slice(0, 6);
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pasted[i] || '';
      }
      setOtp(newOtp);
      const focusTarget = Math.min(pasted.length, 5);
      document.getElementById(`vendor-otp-${focusTarget}`)?.focus();
      return;
    }

    const singleChar = digitsOnly.slice(-1);
    const next = [...otp];
    next[index] = singleChar;
    setOtp(next);
    if (singleChar && index < 5) {
      document.getElementById(`vendor-otp-${index + 1}`)?.focus();
    }
  };

  const handleSendOtp = async () => {
    if (mobileNumber.length !== 10) {
      setSendError('Enter a valid 10-digit mobile number.');
      return;
    }
    setSendError('');
    setOtpError('');
    setIsSending(true);
    try {
      const verifier = createRecaptchaVerifier('vendor-recaptcha-container');
      const result = await sendOtpToPhone(`+91${mobileNumber}`, verifier);
      setConfirmation(result);
      setStep('otp');
    } catch (error) {
      console.error('Firebase SMS dispatch failed:', error);
      setSendError(describePhoneAuthError(error));
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const entered = otp.join('');
    if (entered.length < 6) {
      setOtpError('Please enter the 6-digit OTP.');
      return;
    }
    if (!confirmation) {
      setOtpError('Authentication session expired. Please request a new OTP.');
      return;
    }
    setOtpError('');
    setIsVerifying(true);
    try {
      const user = await confirmOtpCode(confirmation, entered);
      const existing = await getExistingVendorProfile(user.uid);
      if (existing) {
        onComplete(existing);
        return;
      }
      // Brand-new account — collect company details.
      setStep('signup');
    } catch (error) {
      console.error('Firebase OTP confirmation failed:', error);
      setOtpError(describePhoneAuthError(error));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRegister = async () => {
    if (!companyName.trim() || !contactPerson.trim()) {
      setSignupError('Company name and contact person are required.');
      return;
    }
    setSignupError('');
    setIsRegistering(true);
    try {
      const profile: VendorProfile = {
        ...DEFAULT_VENDOR_PROFILE,
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim(),
        email: email.trim(),
        phone: `+91 ${mobileNumber}`,
        city: city.trim() || 'Chennai',
        gstin: gstin.trim(),
        verificationStatus: 'Pending',
        joinedDate: 'New Partner',
      };
      await registerVendorProfile(profile);
      onComplete(profile);
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      if (code === 'functions/already-exists') {
        setSignupError('An account already exists for this number. Please sign in.');
      } else {
        setSignupError(describePhoneAuthError(error));
      }
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4 py-10 font-sans antialiased"
      style={{ background: '#F5F5F5' }}
    >
      <div id="vendor-recaptcha-container" />

      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-7">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white shadow-sm"
            style={{ background: RED }}
          >
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-[19px] font-bold text-[#111111]">Nesam Fleet Partner</h1>
          <p className="text-[13px] text-[#999] mt-1">
            {step === 'signup'
              ? 'Tell us about your fleet business'
              : 'Sign in to your vendor dashboard'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
          {step === 'login' && (
            <>
              <label className="block text-[12px] font-semibold text-[#444] mb-1.5">
                Registered Mobile Number
              </label>
              <div className="flex items-center bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg px-3.5 py-2.5 focus-within:border-[#E21B23] focus-within:ring-1 focus-within:ring-[#E21B23]/20 transition-all">
                <span className="text-[13px] font-bold text-[#E21B23] mr-2.5">+91</span>
                <input
                  type="tel"
                  autoFocus
                  placeholder="90000 00000"
                  maxLength={10}
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  className="bg-transparent w-full text-[13px] font-semibold text-[#111] focus:outline-none placeholder-[#BBB]"
                />
              </div>

              {sendError && (
                <div className="mt-3 px-3 py-2 rounded-lg text-[12px] font-medium text-[#E21B23] bg-[#FEF2F2] border border-[#FBD5D5]">
                  {sendError}
                </div>
              )}

              <button
                onClick={handleSendOtp}
                disabled={isSending}
                className="w-full mt-5 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
                style={{ background: RED }}
              >
                {isSending && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSending ? 'Sending OTP…' : 'Continue with OTP'}
              </button>

              <p className="text-center text-[11px] text-[#999] mt-5 leading-relaxed">
                By continuing, you agree to NESAM's Fleet Partner Terms of Service and Privacy Policy.
              </p>
            </>
          )}

          {step === 'otp' && (
            <>
              <button
                onClick={() => {
                  setStep('login');
                  setOtp(['', '', '', '', '', '']);
                  setOtpError('');
                }}
                className="text-[12px] text-[#999] hover:text-[#111] mb-4 font-semibold"
              >
                ← Change Number
              </button>

              <p className="text-[13px] text-[#444] mb-4">
                Enter the 6-digit OTP sent to{' '}
                <span className="font-bold text-[#111]">+91 {mobileNumber}</span>
              </p>

              <div className="flex justify-between gap-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`vendor-otp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
                        document.getElementById(`vendor-otp-${idx - 1}`)?.focus();
                      }
                    }}
                    className={`w-11 h-12 text-center bg-[#F5F5F5] border rounded-lg text-[16px] font-bold text-[#111] focus:outline-none focus:border-[#E21B23] focus:ring-1 focus:ring-[#E21B23]/20 transition-all ${
                      otpError ? 'border-[#FBD5D5]' : 'border-[#E5E5E5]'
                    }`}
                  />
                ))}
              </div>

              {otpError && (
                <div className="mt-3 px-3 py-2 rounded-lg text-[12px] font-medium text-[#E21B23] bg-[#FEF2F2] border border-[#FBD5D5]">
                  {otpError}
                </div>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={isVerifying}
                className="w-full mt-5 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
                style={{ background: RED }}
              >
                {isVerifying && <Loader2 className="w-4 h-4 animate-spin" />}
                {isVerifying ? 'Verifying…' : 'Verify & Continue'}
              </button>

              <div className="text-right mt-3">
                <button
                  onClick={handleSendOtp}
                  disabled={isSending}
                  className="text-[12px] font-semibold hover:underline disabled:opacity-60"
                  style={{ color: RED }}
                >
                  Resend OTP
                </button>
              </div>
            </>
          )}

          {step === 'signup' && (
            <>
              <div className="space-y-3.5">
                <Field
                  label="Company / Fleet Name *"
                  value={companyName}
                  onChange={setCompanyName}
                  placeholder="Sri Balaji Travels"
                  autoFocus
                />
                <Field
                  label="Contact Person *"
                  value={contactPerson}
                  onChange={setContactPerson}
                  placeholder="Fleet Operations Manager"
                />
                <Field
                  label="Business Email"
                  value={email}
                  onChange={setEmail}
                  placeholder="ops@company.in"
                  type="email"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City" value={city} onChange={setCity} placeholder="Chennai" />
                  <Field label="GSTIN" value={gstin} onChange={setGstin} placeholder="33ABCDE1234F1Z5" />
                </div>
              </div>

              {signupError && (
                <div className="mt-3 px-3 py-2 rounded-lg text-[12px] font-medium text-[#E21B23] bg-[#FEF2F2] border border-[#FBD5D5]">
                  {signupError}
                </div>
              )}

              <button
                onClick={handleRegister}
                disabled={isRegistering}
                className="w-full mt-5 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
                style={{ background: RED }}
              >
                {isRegistering && <Loader2 className="w-4 h-4 animate-spin" />}
                {isRegistering ? 'Creating Account…' : 'Create Vendor Account'}
              </button>

              <p className="text-center text-[11px] text-[#999] mt-4 leading-relaxed flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                Your account is reviewed by the Nesam team before going live.
              </p>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-[#BBB] mt-6">
          Nesam Tours &amp; Travels — Fleet Partner Portal
        </p>
      </div>
    </div>
  );
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, placeholder, type = 'text', autoFocus }) => (
  <div>
    <label className="block text-[12px] font-semibold text-[#444] mb-1.5">{label}</label>
    <input
      type={type}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3.5 py-2.5 text-[13px] bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] focus:ring-1 focus:ring-[#E21B23]/20 transition-all placeholder-[#BBB]"
    />
  </div>
);
