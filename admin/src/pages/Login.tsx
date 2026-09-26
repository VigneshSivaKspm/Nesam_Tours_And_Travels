import { useState, type FormEvent } from "react";
import { signInAdmin, describeAuthError } from "../services/authService";

export default function Login({ onSignUp }: { onSignUp?: () => void }) {
  const [email, setEmail] = useState("admin@nesam.in");
  const [password, setPassword] = useState("Admin@123456");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await signInAdmin(email.trim(), password);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

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
            Sign in to the Super Admin Panel
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm"
        >
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#111]">
            <div className="font-bold text-[#E21B23] mb-1">
              🔑 Super Admin Credentials:
            </div>
            <div>
              Email:{" "}
              <span className="font-mono font-semibold">admin@nesam.in</span>
            </div>
            <div>
              Password:{" "}
              <span className="font-mono font-semibold">Admin@123456</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-lg text-[12px] font-medium text-[#E21B23] bg-[#FEF2F2] border border-[#FBD5D5]">
              {error}
            </div>
          )}

          <label className="block text-[12px] font-semibold text-[#444] mb-1.5">
            Email
          </label>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@nesam.in"
            className="w-full mb-4 px-3.5 py-2.5 text-[13px] bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] focus:ring-1 focus:ring-[#E21B23]/20 transition-all"
            required
          />

          <label className="block text-[12px] font-semibold text-[#444] mb-1.5">
            Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {onSignUp && (
          <p className="text-center text-[12px] text-[#999] mt-6">
            Need an account?{" "}
            <button
              type="button"
              onClick={onSignUp}
              className="font-semibold text-[#E21B23] hover:underline"
            >
              Request access
            </button>
          </p>
        )}

        <div className="text-center mt-6 flex items-center justify-center gap-2 text-[11px] text-[#AAA]">
          <svg
            className="w-3.5 h-3.5 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
          <span>Official NESAM Tours & Travels Admin Portal</span>
        </div>
      </div>
    </div>
  );
}
