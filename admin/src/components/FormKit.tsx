import type { ReactNode } from "react";

/** One input style for every admin form: readable size, clear border, visible focus and disabled state. */
export const inputCls =
  "w-full px-3 py-2.5 border border-[#D4D4D4] rounded-lg text-sm bg-white text-[#111] placeholder-[#767676] focus:border-[#E21B23] focus:outline-none disabled:bg-gray-100 disabled:text-[#4a4a4a]";
export const inputErrCls = "border-red-500";

export function Field({
  label, required, hint, error, children, className = "",
}: { label: string; required?: boolean; hint?: string; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[13px] font-semibold text-[#333] mb-1">
        {label}
        {required && <span className="text-[#E21B23]"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="block text-xs text-[#555] mt-1">{hint}</span>}
      {error && <span role="alert" className="block text-xs font-semibold text-red-700 mt-1">{error}</span>}
    </label>
  );
}

export function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-[13px] font-bold uppercase tracking-wide text-[#111]">{title}</h4>
        {subtitle && <p className="text-xs text-[#555]">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function Notice({ tone, children }: { tone: "error" | "warn" | "info" | "ok"; children: ReactNode }) {
  const cls = {
    error: "bg-red-50 border-red-200 text-red-800",
    warn: "bg-amber-50 border-amber-200 text-amber-900",
    info: "bg-blue-50 border-blue-200 text-blue-900",
    ok: "bg-green-50 border-green-200 text-green-800",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`p-3 rounded-lg border text-sm ${cls}`}>
      {children}
    </div>
  );
}

export const primaryBtn = "px-4 py-2.5 bg-[#E21B23] text-white rounded-lg text-sm font-semibold disabled:opacity-60 hover:bg-[#c4151c]";
export const secondaryBtn = "px-4 py-2.5 border border-[#D4D4D4] text-[#333] rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50";
export const darkBtn = "px-4 py-2.5 bg-[#111] text-white rounded-lg text-sm font-semibold disabled:opacity-60";
