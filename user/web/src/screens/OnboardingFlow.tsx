import React, { useState } from "react";
import { UserProfile } from "../types";
import type { ConfirmationResult } from "firebase/auth";
import {
  createRecaptchaVerifier,
  sendOtpToPhone,
  confirmOtpCode,
  describePhoneAuthError,
} from "../services/authService";
import {
  getExistingCustomerProfile,
  registerCustomerProfile,
} from "../services/userFirestoreService";

interface OnboardingFlowProps {
  onComplete: (user: UserProfile) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
}) => {
  const [step, setStep] = useState<
    "splash" | "onboarding" | "login" | "otp" | "profile"
  >("splash");
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otpError, setOtpError] = useState("");
  const [sendError, setSendError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null,
  );
  const [verifiedUid, setVerifiedUid] = useState("");

  const onboardingSlides = [
    {
      title: "BOOK YOUR RIDE",
      desc: "Book reliable rides for local, outstation & airport travel across Tamil Nadu.",
      svgPath:
        "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1",
    },
    {
      title: "TRACK YOUR DRIVER",
      desc: "Know where your captain is in real-time and when they will arrive.",
      svgPath:
        "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
    },
    {
      title: "TRAVEL WITH CONFIDENCE",
      desc: "Transparent pricing, 100% verified captains, and 24/7 dedicated support.",
      svgPath:
        "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    },
  ];

  // Auto transition splash -> onboarding after 1.5s
  React.useEffect(() => {
    if (step === "splash") {
      const timer = setTimeout(() => setStep("onboarding"), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [step]);

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) val = val[val.length - 1];
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    // Auto focus next
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleSendOtp = async () => {
    if (mobileNumber.length !== 10) {
      setSendError("Enter a valid 10-digit mobile number.");
      return;
    }
    setSendError("");
    setIsSending(true);
    try {
      const verifier = createRecaptchaVerifier("recaptcha-container");
      const result = await sendOtpToPhone(`+91${mobileNumber}`, verifier);
      setConfirmation(result);
      setStep("otp");
    } catch (error) {
      setSendError(describePhoneAuthError(error));
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const entered = otp.join("");
    if (entered.length < 6 || !confirmation) {
      setOtpError("Please enter the 6-digit OTP.");
      return;
    }
    setOtpError("");
    setIsVerifying(true);
    try {
      const user = await confirmOtpCode(confirmation, entered);
      setVerifiedUid(user.uid);
      const existing = await getExistingCustomerProfile(user.uid);
      if (existing) {
        onComplete(existing);
      } else {
        setStep("profile");
      }
    } catch (error) {
      setOtpError(describePhoneAuthError(error));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const profile: UserProfile = {
        uid: verifiedUid,
        name: name || "Customer",
        email,
        phone: `+91 ${mobileNumber}`,
        photoUrl:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        walletBalance: 0,
        emergencyContact: "",
        language: "English",
      };
      await registerCustomerProfile(profile);
      onComplete(profile);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 min-h-[600px] bg-white text-gray-900 flex flex-col justify-between p-6 relative overflow-hidden">
      <div id="recaptcha-container" />
      {/* ── 1. SPLASH SCREEN ── */}
      {step === "splash" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
          <img
            src="/icons/logo.png"
            alt="NESAM Tours & Travels"
            className="w-24 h-24 rounded-3xl object-contain shadow-sm mb-4 bg-gray-50 border border-gray-200 p-2"
          />
          <h1 className="text-xl sm:text-2xl font-black tracking-wider text-gray-900">
            NESAM TOURS & TRAVELS
          </h1>
          <p className="text-xs text-[#E31E24] font-bold tracking-widest uppercase mt-1">
            "Safe Journey, Happy Memories"
          </p>
          <div className="mt-8 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E31E24] animate-ping" />
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              Loading Platform...
            </span>
          </div>
        </div>
      )}

      {/* ── 2. ONBOARDING SLIDES ── */}
      {step === "onboarding" && (
        <div className="flex-1 flex flex-col justify-between py-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-1.5">
              {onboardingSlides.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === onboardingIndex
                      ? "w-8 bg-[#E31E24]"
                      : "w-2 bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setStep("login")}
              className="text-xs font-bold text-gray-400 hover:text-gray-700 transition-colors"
            >
              Skip
            </button>
          </div>

          <div className="my-auto text-center flex flex-col items-center">
            <div className="w-28 h-28 rounded-3xl bg-red-50 border border-[#E31E24]/20 flex items-center justify-center mb-6 shadow-sm">
              <svg
                className="w-12 h-12 text-[#E31E24]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={onboardingSlides[onboardingIndex].svgPath}
                />
              </svg>
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-wide">
              {onboardingSlides[onboardingIndex].title}
            </h2>
            <p className="text-xs text-gray-500 max-w-xs mt-2 leading-relaxed">
              {onboardingSlides[onboardingIndex].desc}
            </p>
          </div>

          <div>
            <button
              onClick={() => {
                if (onboardingIndex < onboardingSlides.length - 1) {
                  setOnboardingIndex(onboardingIndex + 1);
                } else {
                  setStep("login");
                }
              }}
              className="w-full bg-[#E31E24] text-white py-3.5 rounded-2xl font-black text-sm hover:bg-[#C41820] transition-colors shadow-lg"
            >
              {onboardingIndex === onboardingSlides.length - 1
                ? "Get Started"
                : "Next"}
            </button>
          </div>
        </div>
      )}

      {/* ── 3. LOGIN SCREEN ── */}
      {step === "login" && (
        <div className="flex-1 flex flex-col justify-between py-4">
          <div>
            <img
              src="/icons/logo.png"
              alt="NESAM Tours & Travels"
              className="w-14 h-14 rounded-2xl object-contain bg-gray-50 border border-gray-200 p-1.5 mb-4 shadow-sm"
            />
            <h2 className="text-xl font-black text-gray-900 mb-1">
              Welcome to NESAM
            </h2>
            <p className="text-xs text-gray-500">
              Enter your mobile number to get started
            </p>
          </div>

          <div className="my-auto space-y-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Mobile Number
              </label>
              <div className="flex items-center bg-gray-50 border border-gray-300 rounded-2xl px-4 py-3 focus-within:border-[#E31E24] focus-within:bg-white transition-colors">
                <span className="text-sm font-bold text-[#E31E24] mr-3">
                  +91
                </span>
                <input
                  type="tel"
                  placeholder="85319 70197"
                  maxLength={10}
                  value={mobileNumber}
                  onChange={(e) =>
                    setMobileNumber(e.target.value.replace(/\D/g, ""))
                  }
                  className="bg-transparent w-full text-sm font-bold text-gray-900 focus:outline-none placeholder-gray-400"
                />
              </div>
            </div>

            {sendError && (
              <div className="text-[11px] text-[#D92D20] text-center font-semibold">
                {sendError}
              </div>
            )}

            <button
              onClick={handleSendOtp}
              disabled={isSending}
              className="w-full bg-[#E31E24] text-white py-3.5 rounded-2xl font-black text-sm hover:bg-[#C41820] transition-colors shadow-lg disabled:opacity-60"
            >
              {isSending ? "Sending OTP..." : "Continue"}
            </button>
          </div>

          <p className="text-[10px] text-gray-400 text-center leading-tight">
            By continuing, you agree to NESAM's{" "}
            <span className="underline text-gray-600 cursor-pointer">
              Terms & Conditions
            </span>{" "}
            and{" "}
            <span className="underline text-gray-600 cursor-pointer">
              Privacy Policy
            </span>
            .
          </p>
        </div>
      )}

      {/* ── 4. OTP VERIFICATION ── */}
      {step === "otp" && (
        <div className="flex-1 flex flex-col justify-between py-4">
          <div>
            <button
              onClick={() => setStep("login")}
              className="text-xs text-gray-400 hover:text-gray-700 mb-4 flex items-center gap-1 font-bold"
            >
              ← Change Number
            </button>
            <h2 className="text-xl font-black text-gray-900 mb-1">
              Verify Your Number
            </h2>
            <p className="text-xs text-gray-500">
              Enter the 6-digit OTP sent to{" "}
              <span className="text-gray-900 font-bold">
                +91 {mobileNumber}
              </span>
            </p>
          </div>

          <div className="my-auto space-y-4">
            <div className="flex justify-between gap-2">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-${idx}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  className={`w-full aspect-square text-center bg-gray-50 border ${
                    otpError ? "border-red-500" : "border-gray-300"
                  } rounded-xl text-lg font-black text-gray-900 focus:border-[#E31E24] focus:bg-white focus:outline-none transition-colors`}
                />
              ))}
            </div>

            {otpError && (
              <div className="text-[11px] text-[#D92D20] text-center font-semibold">
                {otpError}
              </div>
            )}

            <button
              onClick={handleVerifyOtp}
              disabled={isVerifying}
              className="w-full bg-[#E31E24] text-white py-3.5 rounded-2xl font-black text-sm hover:bg-[#C41820] transition-colors shadow-lg disabled:opacity-60"
            >
              {isVerifying ? "Verifying..." : "Verify & Continue"}
            </button>

            <div className="flex justify-end items-center text-xs text-gray-400 px-1">
              <button
                onClick={handleSendOtp}
                disabled={isSending}
                className="text-[#E31E24] font-bold hover:underline disabled:opacity-60"
              >
                Resend OTP
              </button>
            </div>
          </div>

          <div className="text-center text-[10px] text-gray-400 uppercase font-bold tracking-wider">
            NESAM Authentication Protocol
          </div>
        </div>
      )}

      {/* ── 5. PROFILE SETUP ── */}
      {step === "profile" && (
        <div className="flex-1 flex flex-col justify-between py-4">
          <div>
            <h2 className="text-xl font-black text-gray-900 mb-1">
              Complete Your Profile
            </h2>
            <p className="text-xs text-gray-500">
              Help captains identify you easily
            </p>
          </div>

          <div className="my-auto space-y-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-xs font-bold text-gray-900 focus:border-[#E31E24] focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-xs font-bold text-gray-900 focus:border-[#E31E24] focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={isSaving || !name}
              className="w-full bg-[#E31E24] text-white py-3.5 rounded-2xl font-black text-sm hover:bg-[#C41820] transition-colors shadow-lg mt-2 disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save & Start Booking"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
