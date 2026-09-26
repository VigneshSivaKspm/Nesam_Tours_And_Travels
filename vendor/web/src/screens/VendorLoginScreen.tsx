import React, { useEffect, useRef, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import {
  AlertTriangle,
  ArrowLeft,
  LogIn,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import {
  confirmOtpCode,
  createRecaptchaVerifier,
  describePhoneAuthError,
  resetRecaptchaVerifier,
  sendOtpToPhone,
  setAuthIntent,
  type AuthIntent,
} from "../services/authService";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import {
  Button,
  ErrorBanner,
  OfflineBanner,
  RED,
} from "../components/onboarding/ui";

type Step = "choose" | "phone" | "otp";

const RESEND_COOLDOWN_S = 30;
const EMPTY_OTP = ["", "", "", "", "", ""];

/**
 * Entry flow: choose Login / Sign Up → phone → OTP. On success Firebase Auth
 * fires onAuthStateChanged and App routes from the vendors/{uid} document, so
 * this screen never decides the destination itself.
 */
export const VendorLoginScreen: React.FC = () => {
  const online = useOnlineStatus();
  const [step, setStep] = useState<Step>("choose");
  const [mode, setMode] = useState<AuthIntent>("login");
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState(EMPTY_OTP);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null,
  );
  const [sendError, setSendError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const verifyingRef = useRef(false);

  useEffect(() => {
    // Firebase Phone Auth authorizes 'localhost' by default, but rejects IP addresses like 127.0.0.1 with auth/invalid-app-credential.
    if (
      typeof window !== "undefined" &&
      window.location.hostname === "127.0.0.1"
    ) {
      window.location.hostname = "localhost";
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => () => resetRecaptchaVerifier(), []);

  const choose = (m: AuthIntent) => {
    setMode(m);
    setAuthIntent(m);
    setSendError("");
    setStep("phone");
  };

  const handleSendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      setSendError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (isSending || cooldown > 0) return;
    setSendError("");
    setOtpError("");
    setIsSending(true);
    try {
      const verifier = createRecaptchaVerifier("vendor-recaptcha-container");
      const result = await sendOtpToPhone(`+91${mobileNumber}`, verifier);
      setConfirmation(result);
      setOtp(EMPTY_OTP);
      setStep("otp");
      setCooldown(RESEND_COOLDOWN_S);
      setTimeout(() => document.getElementById("vendor-otp-0")?.focus(), 50);
    } catch (error) {
      const message = describePhoneAuthError(error);
      if (step === "otp") setOtpError(message);
      else setSendError(message);
    } finally {
      setIsSending(false);
    }
  };

  const verify = async (code: string) => {
    if (verifyingRef.current) return;
    if (code.length < 6) {
      setOtpError("Please enter the 6-digit OTP.");
      return;
    }
    if (!confirmation) {
      setOtpError("Your verification session expired. Please resend the OTP.");
      return;
    }
    verifyingRef.current = true;
    setOtpError("");
    setIsVerifying(true);
    try {
      await confirmOtpCode(confirmation, code);
      // App takes over via the auth listener; keep the spinner until unmount.
    } catch (error) {
      setOtpError(describePhoneAuthError(error));
      setIsVerifying(false);
      verifyingRef.current = false;
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    const digits = val.replace(/\D/g, "");
    const next = [...otp];
    if (digits.length >= 6) {
      // Paste / SMS autofill of the full code into any box
      const pasted = digits.slice(0, 6);
      for (let i = 0; i < 6; i++) next[i] = pasted[i] || "";
      setOtp(next);
      document
        .getElementById(`vendor-otp-${Math.min(pasted.length, 5)}`)
        ?.focus();
    } else {
      next[index] = digits.slice(-1);
      setOtp(next);
      if (next[index] && index < 5)
        document.getElementById(`vendor-otp-${index + 1}`)?.focus();
    }
    const code = next.join("");
    if (code.length === 6) verify(code);
  };

  const isSignup = mode === "signup";

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4 py-10 font-sans antialiased"
      style={{ background: "#F5F5F5" }}
    >
      <div id="vendor-recaptcha-container" />

      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <img
            src="/icons/logo.png"
            alt="NESAM Fleet Partner"
            className="w-16 h-16 rounded-2xl object-contain bg-white border border-[#E5E5E5] p-2 mx-auto mb-4 shadow-sm"
          />
          <h1 className="text-[19px] font-bold text-[#111111]">
            Nesam Fleet Partner
          </h1>
          <p className="text-[13px] text-[#999] mt-1">
            {step === "choose"
              ? "Manage your fleet, drivers and bookings"
              : isSignup
                ? "Create your vendor account"
                : "Sign in to your vendor dashboard"}
          </p>
        </div>

        {!online && (
          <div className="mb-3">
            <OfflineBanner />
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
          {step === "choose" && (
            <div className="space-y-3">
              <button
                onClick={() => choose("login")}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-[#E5E5E5] hover:border-[#E21B23] hover:bg-[#FEF7F7] transition-colors text-left"
              >
                <span
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                  style={{ background: RED }}
                >
                  <LogIn className="w-5 h-5" />
                </span>
                <span>
                  <span className="block text-[14px] font-bold text-[#111]">
                    Login
                  </span>
                  <span className="block text-[12px] text-[#888]">
                    I already have a vendor account
                  </span>
                </span>
              </button>
              <button
                onClick={() => choose("signup")}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-[#E5E5E5] hover:border-[#E21B23] hover:bg-[#FEF7F7] transition-colors text-left"
              >
                <span className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#111] text-white shrink-0">
                  <UserPlus className="w-5 h-5" />
                </span>
                <span>
                  <span className="block text-[14px] font-bold text-[#111]">
                    Sign Up
                  </span>
                  <span className="block text-[12px] text-[#888]">
                    Register my travel agency / fleet
                  </span>
                </span>
              </button>
            </div>
          )}

          {step === "phone" && (
            <>
              <button
                onClick={() => setStep("choose")}
                className="flex items-center gap-1 text-[12px] text-[#999] hover:text-[#111] mb-4 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              {typeof window !== "undefined" &&
                /^(127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)$/.test(
                  window.location.hostname,
                ) && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">
                        Local IP Detected ({window.location.hostname}):
                      </span>{" "}
                      Firebase Phone Auth blocks IP addresses by default.
                      <div className="mt-1">
                        Please use{" "}
                        <a
                          href={`http://localhost:${window.location.port || "3003"}`}
                          className="font-bold text-[#E21B23] underline"
                        >
                          http://localhost:{window.location.port || "3003"}
                        </a>{" "}
                        for OTP to work smoothly.
                      </div>
                    </div>
                  </div>
                )}
              <label
                htmlFor="vendor-phone"
                className="block text-[12px] font-semibold text-[#444] mb-1.5"
              >
                {isSignup ? "Mobile Number" : "Registered Mobile Number"}
              </label>
              <div className="flex items-center bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg px-3.5 py-2.5 focus-within:border-[#E21B23] focus-within:ring-1 focus-within:ring-[#E21B23]/20 transition-all">
                <span className="text-[13px] font-bold text-[#E21B23] mr-2.5">
                  +91
                </span>
                <input
                  id="vendor-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  autoFocus
                  placeholder="90000 00000"
                  maxLength={10}
                  value={mobileNumber}
                  onChange={(e) =>
                    setMobileNumber(e.target.value.replace(/\D/g, ""))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                  className="bg-transparent w-full text-[13px] font-semibold text-[#111] focus:outline-none placeholder-[#BBB]"
                />
              </div>
              {isSignup && (
                <p className="mt-1.5 text-[11px] text-[#999]">
                  This number becomes your login and primary business contact.
                </p>
              )}
              <div className="mt-3">
                <ErrorBanner message={sendError} />
              </div>
              <Button
                className="w-full mt-4"
                onClick={handleSendOtp}
                loading={isSending}
                disabled={!online}
              >
                {isSending ? "Sending OTP…" : "Send OTP"}
              </Button>
              <p className="text-center text-[11px] text-[#999] mt-5 leading-relaxed">
                By continuing, you agree to NESAM's Fleet Partner Terms of
                Service and Privacy Policy.
              </p>
            </>
          )}

          {step === "otp" && (
            <>
              <button
                onClick={() => {
                  setStep("phone");
                  setOtp(EMPTY_OTP);
                  setOtpError("");
                }}
                disabled={isVerifying}
                className="flex items-center gap-1 text-[12px] text-[#999] hover:text-[#111] mb-4 font-semibold disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Change number
              </button>
              <p className="text-[13px] text-[#444] mb-4">
                Enter the 6-digit OTP sent to{" "}
                <span className="font-bold text-[#111]">
                  +91 {mobileNumber}
                </span>
              </p>
              <div className="flex justify-between gap-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`vendor-otp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete={idx === 0 ? "one-time-code" : "off"}
                    aria-label={`OTP digit ${idx + 1}`}
                    maxLength={6}
                    value={digit}
                    disabled={isVerifying}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !otp[idx] && idx > 0)
                        document
                          .getElementById(`vendor-otp-${idx - 1}`)
                          ?.focus();
                      if (e.key === "Enter") verify(otp.join(""));
                    }}
                    className={`w-11 h-12 text-center bg-[#F5F5F5] border rounded-lg text-[16px] font-bold text-[#111] focus:outline-none focus:border-[#E21B23] focus:ring-1 focus:ring-[#E21B23]/20 transition-all disabled:opacity-60 ${
                      otpError ? "border-[#FBD5D5]" : "border-[#E5E5E5]"
                    }`}
                  />
                ))}
              </div>
              <div className="mt-3">
                <ErrorBanner message={otpError} />
              </div>
              <Button
                className="w-full mt-4"
                onClick={() => verify(otp.join(""))}
                loading={isVerifying}
                disabled={!online}
              >
                {isVerifying ? "Verifying…" : "Verify & Continue"}
              </Button>
              <div className="text-right mt-3">
                <button
                  onClick={handleSendOtp}
                  disabled={isSending || cooldown > 0 || isVerifying}
                  className="text-[12px] font-semibold hover:underline disabled:opacity-50 disabled:no-underline"
                  style={{ color: RED }}
                >
                  {cooldown > 0
                    ? `Resend OTP in ${cooldown}s`
                    : isSending
                      ? "Sending…"
                      : "Resend OTP"}
                </button>
              </div>
            </>
          )}
        </div>

        {step !== "choose" && (
          <p className="text-center text-[11px] text-[#999] mt-5 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            {isSignup
              ? "New accounts are verified by the Nesam team before going live."
              : "Secured with SMS one-time password."}
          </p>
        )}
        <p className="text-center text-[11px] text-[#BBB] mt-4">
          Nesam Tours &amp; Travels — Fleet Partner Portal
        </p>
      </div>
    </div>
  );
};
