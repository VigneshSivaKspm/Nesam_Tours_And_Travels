import React, { useEffect, useRef, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
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
  signOutUser,
} from "../services/authService";
import { registerCustomerProfile } from "../services/userFirestoreService";
import {
  uploadProfilePhoto,
  validateImageFile,
} from "../services/storageService";
import {
  isValidEmail,
  isValidIndianMobile,
  isValidName,
  localMobile,
  formatPhone,
} from "../utils/format";
import { describeError } from "../utils/retry";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

type Intent = "login" | "signup";
const INTENT_KEY = "nt-auth-intent";
const RESEND_COOLDOWN_S = 30;

function readIntent(): Intent | null {
  try {
    const v = sessionStorage.getItem(INTENT_KEY);
    return v === "login" || v === "signup" ? v : null;
  } catch {
    return null;
  }
}
function writeIntent(v: Intent) {
  try {
    sessionStorage.setItem(INTENT_KEY, v);
  } catch {
    /* storage unavailable */
  }
}

interface AuthFlowProps {
  /** 'needs-profile' once the phone is verified but no customer doc exists. */
  mode: "signed-out" | "needs-profile";
  uid?: string;
  phone?: string;
}

const Shell: React.FC<{
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({
  title = "Nesam Tours & Travels",
  subtitle = "Safe Journey, Happy Memories",
  children,
}) => (
  <div
    className="min-h-screen w-full flex items-center justify-center px-4 py-10 font-sans antialiased"
    style={{ background: "#F5F5F5" }}
  >
    <div id="recaptcha-container" />

    <div className="w-full max-w-sm">
      <div className="text-center mb-7">
        <img
          src="/icons/logo.png"
          alt="NESAM Tours & Travels"
          className="w-16 h-16 rounded-2xl object-contain bg-white border border-[#E5E5E5] p-2 mx-auto mb-4 shadow-sm"
        />
        <h1 className="text-[19px] font-bold text-[#111111]">{title}</h1>
        <p className="text-[13px] text-[#999] mt-1">{subtitle}</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
        {children}
      </div>

      <div className="text-center mt-6 flex items-center justify-center gap-2 text-[11px] text-[#AAA]">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>Official NESAM Tours & Travels Customer Portal</span>
      </div>
    </div>
  </div>
);

export const AuthFlow: React.FC<AuthFlowProps> = ({ mode, uid, phone }) => {
  if (mode === "needs-profile")
    return <ProfileSetup uid={uid!} phone={phone ?? ""} />;
  return <PhoneLogin />;
};

// ── Welcome → phone → OTP ───────────────────────────────────────────────────

const PhoneLogin: React.FC = () => {
  const [step, setStep] = useState<"welcome" | "phone" | "otp">("welcome");
  const [intent, setIntent] = useState<Intent>(readIntent() ?? "login");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null,
  );
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { online } = useNetworkStatus();

  useEffect(() => {
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

  const start = (i: Intent) => {
    setIntent(i);
    writeIntent(i);
    setError("");
    setStep("phone");
  };

  const sendOtp = async () => {
    if (!isValidIndianMobile(mobile)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!online) {
      setError("You’re offline. Connect to the internet to receive your OTP.");
      return;
    }
    setError("");
    setSending(true);
    try {
      const verifier = createRecaptchaVerifier("recaptcha-container");
      const result = await sendOtpToPhone(`+91${mobile}`, verifier);
      setConfirmation(result);
      setOtp(["", "", "", "", "", ""]);
      setStep("otp");
      setCooldown(RESEND_COOLDOWN_S);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (e) {
      setError(describePhoneAuthError(e));
    } finally {
      setSending(false);
    }
  };

  const verify = async (digits = otp) => {
    const code = digits.join("");
    if (code.length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    if (!confirmation) {
      setError("Your OTP session expired. Please request a new code.");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      await confirmOtpCode(confirmation, code);
    } catch (e) {
      setError(describePhoneAuthError(e));
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      setVerifying(false);
    }
  };

  const onOtpChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const next = [...otp];
    if (digits.length >= 6) {
      const pasted = digits.slice(0, 6);
      for (let i = 0; i < 6; i++) next[i] = pasted[i] || "";
      setOtp(next);
      otpRefs.current[Math.min(pasted.length, 5)]?.focus();
      void verify(next);
      return;
    }
    next[index] = digits.slice(-1);
    setOtp(next);
    if (next[index] && index < 5) otpRefs.current[index + 1]?.focus();
    if (next.every((d) => d)) void verify(next);
  };

  if (step === "welcome") {
    return (
      <Shell
        title="Nesam Tours & Travels"
        subtitle="Safe Journey, Happy Memories"
      >
        <div className="space-y-3">
          <button
            onClick={() => start("login")}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-[#E5E5E5] hover:border-[#E21B23] hover:bg-[#FEF7F7] transition-colors text-left"
          >
            <span
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
              style={{ background: "#E21B23" }}
            >
              <LogIn className="w-5 h-5" />
            </span>
            <span>
              <span className="block text-[14px] font-bold text-[#111]">
                Login
              </span>
              <span className="block text-[12px] text-[#888]">
                I already have an account
              </span>
            </span>
          </button>

          <button
            onClick={() => start("signup")}
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
                Create a new passenger account
              </span>
            </span>
          </button>
        </div>

        <p className="text-[11px] text-[#999] text-center mt-5 leading-relaxed">
          By continuing you agree to NESAM’s Terms &amp; Conditions and Privacy
          Policy.
        </p>
      </Shell>
    );
  }

  if (step === "phone") {
    const isSignup = intent === "signup";
    return (
      <Shell
        title="Nesam Tours & Travels"
        subtitle={
          isSignup
            ? "Create your passenger account"
            : "Sign in with your mobile number"
        }
      >
        <button
          onClick={() => {
            setStep("welcome");
            setError("");
          }}
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
                    href={`http://localhost:${window.location.port || "3000"}`}
                    className="font-bold text-[#E21B23] underline"
                  >
                    http://localhost:{window.location.port || "3000"}
                  </a>{" "}
                  for OTP to work smoothly.
                </div>
              </div>
            </div>
          )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendOtp();
          }}
        >
          <label
            htmlFor="user-phone"
            className="block text-[12px] font-semibold text-[#444] mb-1.5"
          >
            {isSignup ? "Mobile Number" : "Registered Mobile Number"}
          </label>
          <div className="flex items-center bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg px-3.5 py-2.5 focus-within:border-[#E21B23] focus-within:ring-1 focus-within:ring-[#E21B23]/20 transition-all">
            <span className="text-[13px] font-bold text-[#E21B23] mr-2.5">
              +91
            </span>
            <input
              id="user-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              autoFocus
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && void sendOtp()}
              placeholder="98765 43210"
              className="bg-transparent w-full text-[13px] font-semibold text-[#111] focus:outline-none placeholder-[#BBB]"
            />
          </div>

          {isSignup && (
            <p className="mt-1.5 text-[11px] text-[#999]">
              This number becomes your login and primary contact for trips.
            </p>
          )}

          {error && (
            <div className="mt-3 px-3 py-2.5 rounded-lg text-[12px] font-medium text-[#E21B23] bg-[#FEF2F2] border border-[#FBD5D5]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={sending || mobile.length !== 10 || !online}
            className="w-full mt-4 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: "#E21B23" }}
          >
            {sending && <Loader2 className="w-4 h-4 animate-spin" />}
            {sending ? "Sending OTP…" : "Send OTP"}
          </button>

          <p className="text-center text-[11px] text-[#999] mt-5 leading-relaxed">
            By continuing, you agree to NESAM's Terms of Service and Privacy
            Policy.
          </p>
        </form>
      </Shell>
    );
  }

  return (
    <Shell title="Nesam Tours & Travels" subtitle="Verify your mobile number">
      <button
        onClick={() => {
          setStep("phone");
          setOtp(["", "", "", "", "", ""]);
          setError("");
        }}
        disabled={verifying}
        className="flex items-center gap-1 text-[12px] text-[#999] hover:text-[#111] mb-4 font-semibold disabled:opacity-50"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Change number
      </button>

      <p className="text-[13px] text-[#444] mb-4">
        Enter the 6-digit OTP sent to{" "}
        <span className="font-bold text-[#111]">{formatPhone(mobile)}</span>
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <div
          className="flex justify-between gap-2"
          role="group"
          aria-label="6-digit code"
        >
          {otp.map((d, i) => (
            <input
              key={i}
              id={`user-otp-${i}`}
              ref={(el) => {
                otpRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={i === 0 ? 6 : 1}
              value={d}
              aria-label={`Digit ${i + 1}`}
              disabled={verifying}
              onChange={(e) => onOtpChange(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !otp[i] && i > 0)
                  otpRefs.current[i - 1]?.focus();
                if (e.key === "Enter" && otp.join("").length === 6)
                  void verify();
              }}
              className={`w-11 h-12 text-center bg-[#F5F5F5] border rounded-lg text-[16px] font-bold text-[#111] focus:outline-none focus:border-[#E21B23] focus:ring-1 focus:ring-[#E21B23]/20 transition-all disabled:opacity-60 ${
                error ? "border-[#FBD5D5]" : "border-[#E5E5E5]"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mt-3 px-3 py-2.5 rounded-lg text-[12px] font-medium text-[#E21B23] bg-[#FEF2F2] border border-[#FBD5D5]">
            {error}
          </div>
        )}

        <div className="text-[12px] text-center text-[#888] mt-4">
          {cooldown > 0 ? (
            <>
              Resend code in{" "}
              <span className="font-bold text-[#111]">{cooldown}s</span>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void sendOtp()}
              disabled={sending}
              className="font-bold text-[#E21B23] hover:underline"
            >
              {sending ? "Resending…" : "Resend code"}
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={verifying || otp.join("").length !== 6}
          className="w-full mt-4 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: "#E21B23" }}
        >
          {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
          {verifying ? "Verifying…" : "Verify & Continue"}
        </button>
      </form>
    </Shell>
  );
};

// ── New customer profile ────────────────────────────────────────────────────

const ProfileSetup: React.FC<{ uid: string; phone: string }> = ({
  uid,
  phone,
}) => {
  const intent = readIntent();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emergency, setEmergency] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const own = localMobile(phone);
  const errors = {
    name: !isValidName(name)
      ? "Enter your full name (letters and spaces, 2–60 characters)."
      : "",
    email: !isValidEmail(email)
      ? "Enter a valid email address — receipts are sent here."
      : "",
    emergency: !isValidIndianMobile(emergency)
      ? "Enter a 10-digit mobile number for your emergency contact."
      : emergency === own
        ? "Your emergency contact must be a different number from yours."
        : "",
  };
  const valid = !errors.name && !errors.email && !errors.emergency;

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setPhotoFailed(false);
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const save = async (skipPhoto = false) => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    setError("");
    let photoUrl = "";
    try {
      if (photo && !skipPhoto) {
        try {
          photoUrl = await uploadProfilePhoto(uid, photo, setProgress);
        } catch (e) {
          setPhotoFailed(true);
          setError(
            `${describeError(e, "Photo upload failed.")} You can retry, or continue without a photo and add one later.`,
          );
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
    } catch (e) {
      setError(
        describeError(e, "We couldn’t create your profile. Please try again."),
      );
      setSaving(false);
      setProgress(null);
    }
  };

  const fieldErr = (k: keyof typeof errors) =>
    touched && errors[k] ? (
      <p className="text-[11px] text-[#E21B23] mt-1">{errors[k]}</p>
    ) : null;

  return (
    <Shell
      title="Nesam Tours & Travels"
      subtitle={
        intent === "login"
          ? "Set up your profile to continue"
          : "Complete your passenger profile"
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex items-center gap-4 mb-4">
          <label className="relative w-16 h-16 rounded-2xl bg-[#F5F5F5] border-2 border-dashed border-[#E5E5E5] flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#E21B23] shrink-0 transition-colors">
            {preview ? (
              <img
                src={preview}
                alt="Profile preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] font-bold text-[#888] text-center px-1">
                Add photo
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => pickPhoto(e.target.files?.[0])}
            />
          </label>
          <div className="text-[12px] text-[#666]">
            <p className="font-bold text-[#111]">Profile Photo</p>
            <p className="text-[11px] text-[#999]">
              Optional — helps your driver recognize you.
            </p>
            {progress != null && (
              <p className="text-[#E21B23] font-bold mt-0.5">
                Uploading… {progress}%
              </p>
            )}
          </div>
        </div>

        <label
          htmlFor="name"
          className="block text-[12px] font-semibold text-[#444] mb-1.5"
        >
          Full Name
        </label>
        <input
          id="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-1 px-3.5 py-2.5 text-[13px] bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] focus:ring-1 focus:ring-[#E21B23]/20 transition-all font-semibold text-[#111]"
          placeholder="e.g. John Doe"
        />
        {fieldErr("name")}

        <label
          htmlFor="email"
          className="block text-[12px] font-semibold text-[#444] mb-1.5 mt-3"
        >
          Email Address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-1 px-3.5 py-2.5 text-[13px] bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] focus:ring-1 focus:ring-[#E21B23]/20 transition-all font-semibold text-[#111]"
          placeholder="you@example.com"
        />
        {fieldErr("email")}

        <label
          htmlFor="emergency"
          className="block text-[12px] font-semibold text-[#444] mb-1.5 mt-3"
        >
          Emergency Contact
        </label>
        <div className="flex items-center bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg px-3.5 py-2.5 focus-within:border-[#E21B23] focus-within:ring-1 focus-within:ring-[#E21B23]/20 transition-all">
          <span className="text-[13px] font-bold text-[#E21B23] mr-2.5">
            +91
          </span>
          <input
            id="emergency"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={emergency}
            onChange={(e) =>
              setEmergency(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            className="bg-transparent w-full text-[13px] font-semibold text-[#111] focus:outline-none placeholder-[#BBB]"
            placeholder="Family member or friend"
          />
        </div>
        {fieldErr("emergency")}
        <p className="text-[11px] text-[#999] mt-1.5">
          We share your live trip with them only when you trigger SOS or share
          trip.
        </p>

        {error && (
          <div className="mt-3 px-3 py-2.5 rounded-lg text-[12px] font-medium text-[#E21B23] bg-[#FEF2F2] border border-[#FBD5D5]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full mt-4 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: "#E21B23" }}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving
            ? "Saving…"
            : photoFailed
              ? "Retry Upload & Continue"
              : "Save & Start Booking"}
        </button>

        {photoFailed && !saving && (
          <button
            type="button"
            onClick={() => void save(true)}
            className="w-full mt-2 py-2 text-[12px] font-semibold text-[#666] bg-[#F5F5F5] hover:bg-[#EBEBEB] rounded-lg border border-[#E5E5E5] transition-colors"
          >
            Continue without photo
          </button>
        )}

        <button
          type="button"
          onClick={() => void signOutUser()}
          className="w-full text-center text-[12px] font-semibold text-[#999] hover:text-[#111] mt-3"
        >
          Not your number? Sign out
        </button>
      </form>
    </Shell>
  );
};
