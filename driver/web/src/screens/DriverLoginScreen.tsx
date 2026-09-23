import React, { useState } from 'react';
import { DriverProfile } from '../types';
import type { ConfirmationResult } from 'firebase/auth';
import {
  createRecaptchaVerifier,
  sendOtpToPhone,
  confirmOtpCode,
  describePhoneAuthError,
} from '../services/authService';
import {
  getExistingDriverProfile,
  registerDriverProfile,
} from '../services/driverFirestoreService';

interface DriverLoginScreenProps {
  onComplete: (profile: DriverProfile) => void;
}

export const DriverLoginScreen: React.FC<DriverLoginScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'login' | 'otp'>('login');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [sendError, setSendError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) val = val[val.length - 1];
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);
    if (val && index < 5) {
      const nextInput = document.getElementById(`driver-otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleSendOtp = async () => {
    if (mobileNumber.length !== 10) {
      setSendError('Enter a valid 10-digit mobile number.');
      return;
    }
    setSendError('');
    setIsSending(true);
    try {
      const verifier = createRecaptchaVerifier('driver-recaptcha-container');
      const result = await sendOtpToPhone(`+91${mobileNumber}`, verifier);
      setConfirmation(result);
      setStep('otp');
    } catch (error) {
      setSendError(describePhoneAuthError(error));
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const entered = otp.join('');
    if (entered.length < 6 || !confirmation) {
      setOtpError('Please enter the 6-digit OTP.');
      return;
    }
    setOtpError('');
    setIsVerifying(true);
    try {
      const user = await confirmOtpCode(confirmation, entered);
      const existing = await getExistingDriverProfile(user.uid);
      if (existing) {
        onComplete(existing);
        return;
      }
      const profile: DriverProfile = {
        id: user.uid,
        name: 'Driver Partner',
        phone: `+91 ${mobileNumber}`,
        email: '',
        photoUrl: '',
        address: '',
        emergencyContact: '',
        rating: 5.0,
        totalTrips: 0,
        joiningDate: 'New Partner',
      };
      await registerDriverProfile(profile);
      onComplete(profile);
    } catch (error) {
      setOtpError(describePhoneAuthError(error));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] text-gray-900 flex flex-col items-center justify-center p-4 sm:p-6">
      <div id="driver-recaptcha-container" />

      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8">
        {step === 'login' && (
          <div className="space-y-6">
            <div>
              <img
                src="/icons/logo.png"
                alt="NESAM Driver Partner"
                className="w-14 h-14 rounded-2xl object-contain bg-gray-50 border border-gray-200 p-1.5 mb-4"
              />
              <h2 className="text-xl font-black text-gray-900 mb-1">Driver Partner Login</h2>
              <p className="text-xs text-gray-500">Enter your registered mobile number to continue</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Mobile Number
                </label>
                <div className="flex items-center bg-gray-50 border border-gray-300 rounded-2xl px-4 py-3 focus-within:border-[#E21E26] focus-within:bg-white transition-colors">
                  <span className="text-sm font-bold text-[#E21E26] mr-3">+91</span>
                  <input
                    type="tel"
                    placeholder="90000 00000"
                    maxLength={10}
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                    className="bg-transparent w-full text-sm font-bold text-gray-900 focus:outline-none placeholder-gray-400"
                  />
                </div>
              </div>

              {sendError && (
                <div className="text-[11px] text-[#D92D20] text-center font-semibold">{sendError}</div>
              )}

              <button
                onClick={handleSendOtp}
                disabled={isSending}
                className="w-full bg-[#E21E26] text-white py-3.5 rounded-2xl font-black text-sm hover:bg-[#C9141B] transition-colors shadow-sm disabled:opacity-60"
              >
                {isSending ? 'Sending OTP...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-6">
            <div>
              <button
                onClick={() => setStep('login')}
                className="text-xs text-gray-400 hover:text-gray-700 mb-4 flex items-center gap-1 font-bold"
              >
                ← Change Number
              </button>
              <h2 className="text-xl font-black text-gray-900 mb-1">Verify Your Number</h2>
              <p className="text-xs text-gray-500">
                Enter the 6-digit OTP sent to <span className="text-gray-900 font-bold">+91 {mobileNumber}</span>
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between gap-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`driver-otp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    className={`w-full aspect-square text-center bg-gray-50 border ${
                      otpError ? 'border-red-500' : 'border-gray-300'
                    } rounded-xl text-lg font-black text-gray-900 focus:border-[#E21E26] focus:bg-white focus:outline-none transition-colors`}
                  />
                ))}
              </div>

              {otpError && (
                <div className="text-[11px] text-[#D92D20] text-center font-semibold">{otpError}</div>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={isVerifying}
                className="w-full bg-[#E21E26] text-white py-3.5 rounded-2xl font-black text-sm hover:bg-[#C9141B] transition-colors shadow-sm disabled:opacity-60"
              >
                {isVerifying ? 'Verifying...' : 'Verify & Continue'}
              </button>

              <div className="flex justify-end items-center text-xs text-gray-400 px-1">
                <button
                  onClick={handleSendOtp}
                  disabled={isSending}
                  className="text-[#E21E26] font-bold hover:underline disabled:opacity-60"
                >
                  Resend OTP
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400 mt-6 text-center">
        NESAM Tours &amp; Travels • Driver Partner Portal
      </p>
    </div>
  );
};
