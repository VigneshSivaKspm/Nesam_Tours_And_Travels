import { useState, type FormEvent } from "react";
import { signUpAdmin, describeAuthError } from "../services/authService";

export default function Signup({
  onBackToLogin,
}: {
  onBackToLogin: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signUpAdmin(name.trim(), email.trim(), password);
      setDone(true);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full mb-4 px-3.5 py-2.5 text-[13px] bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] focus:ring-1 focus:ring-[#E21B23]/20 transition-all";
  const labelClass = "block text-[12px] font-semibold text-[#444] mb-1.5";

  return (
    <div
      className="h-screen w-screen flex items-center justify-center px-4"
      style={{ background: "#F5F5F5" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/icons/logo.png"
            alt="Nesam Admin"
            className="w-16 h-16 rounded-2xl object-contain bg-white border border-[#E5E5E5] p-2 mx-auto mb-4 shadow-sm"
          />
          <h1 className="text-[19px] font-bold text-[#111111]">Nesam Admin</h1>
          <p className="text-[13px] text-[#999] mt-1">
            Request access to the Super Admin Panel
          </p>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm text-center">
            <div
              className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: "#ECFDF5" }}
            >
              <svg
                className="w-6 h-6 text-[#059669]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-[15px] font-bold text-[#111111] mb-2">
              Account created
            </h2>
            <p className="text-[12px] text-[#666] mb-6">
              Your request is pending approval. The platform team will grant
              Super Admin access to{" "}
              <span className="font-semibold">{email}</span>. You'll be able to
              sign in once approved.
            </p>
            <button
              onClick={onBackToLogin}
              className="w-full py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all hover:opacity-90 active:scale-95"
              style={{ background: "#E21B23" }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm"
          >
            {error && (
              <div className="mb-4 px-3 py-2.5 rounded-lg text-[12px] font-medium text-[#E21B23] bg-[#FEF2F2] border border-[#FBD5D5]">
                {error}
              </div>
            )}

            <label className={labelClass}>Full Name</label>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className={inputClass}
              required
            />

            <label className={labelClass}>Email</label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@nesam.in"
              className={inputClass}
              required
            />

            <label className={labelClass}>Password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
              required
            />

            <label className={labelClass}>Confirm Password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="w-full mb-6 px-3.5 py-2.5 text-[13px] bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] focus:ring-1 focus:ring-[#E21B23]/20 transition-all"
              required
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:active:scale-100"
              style={{ background: "#E21B23" }}
            >
              {submitting ? "Creating account…" : "Create Account"}
            </button>
          </form>
        )}

        {!done && (
          <p className="text-center text-[12px] text-[#999] mt-6">
            Already have an account?{" "}
            <button
              onClick={onBackToLogin}
              className="font-semibold text-[#E21B23] hover:underline"
            >
              Sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
