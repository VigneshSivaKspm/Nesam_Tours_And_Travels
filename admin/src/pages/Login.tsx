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
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-xl font-bold"
            style={{ background: "#E21B23" }}
          >
            NT
          </div>
          <h1 className="text-[19px] font-bold text-[#111111]">Nesam Admin</h1>
          <p className="text-[13px] text-[#999] mt-1">Sign in to the Super Admin Panel</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm"
        >
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#111]">
            <div className="font-bold text-[#E21B23] mb-1">🔑 Super Admin Credentials:</div>
            <div>Email: <span className="font-mono font-semibold">admin@nesam.in</span></div>
            <div>Password: <span className="font-mono font-semibold">Admin@123456</span></div>
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
      </div>
    </div>
  );
}
