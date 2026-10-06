import type { Booking } from "../types";

type Breakup = NonNullable<Booking["fareBreakup"]>;
type Line = Breakup["lines"][number];

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const TREATMENT: Record<Line["treatment"], { label: string; cls: string }> = {
  included: { label: "Included", cls: "bg-green-50 text-green-800 border-green-200" },
  extra: { label: "Extra · payable separately", cls: "bg-amber-50 text-amber-900 border-amber-200" },
  not_applicable: { label: "Not applicable", cls: "bg-gray-100 text-gray-700 border-gray-200" },
};

const SUMMARY_KEYS = ["gst"];

/**
 * The fare as a customer would read it: what is inside the package price and
 * what is charged separately, and the total payable. Reads the breakup the
 * booking server stored (so every screen and the invoice agree).
 */
export default function FareBreakupView({ breakup, total, compact = false }: { breakup: Breakup | null | undefined; total: number; compact?: boolean }) {
  if (!breakup || !Array.isArray(breakup.lines) || breakup.lines.length === 0) {
    return (
      <div className="rounded-lg border border-[#E5E5E5] bg-gray-50 p-3 text-sm text-[#444]">
        <div className="flex justify-between font-semibold"><span>Total payable</span><span>{rupees(total)}</span></div>
        <p className="text-xs text-[#666] mt-1">A line-by-line breakup was not stored for this booking (it was created before breakups were recorded).</p>
      </div>
    );
  }
  const included = breakup.lines.filter((l) => l.treatment === "included" && !SUMMARY_KEYS.includes(l.key));
  const extras = breakup.lines.filter((l) => l.treatment !== "included");
  const gst = breakup.lines.find((l) => l.key === "gst");
  const row = (l: Line) => (
    <li key={l.key} className="flex items-start justify-between gap-3 py-1.5 border-b border-[#EEE] last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[#111]">{l.label}</div>
        {!compact && <div className="text-xs text-[#555]">{l.detail}</div>}
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-semibold ${l.amount !== null && l.amount < 0 ? "text-green-700" : "text-[#111]"}`}>{l.amount === null ? "—" : l.amount < 0 ? `− ${rupees(-l.amount)}` : rupees(l.amount)}</div>
        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded border text-[11px] font-semibold ${TREATMENT[l.treatment].cls}`}>{TREATMENT[l.treatment].label}</span>
      </div>
    </li>
  );
  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white">
      <div className="px-4 pt-3 pb-1 text-[13px] font-bold text-[#111] uppercase tracking-wide">Included in the fare</div>
      <ul className="px-4">{included.map(row)}{gst && row(gst)}</ul>
      <div className="flex justify-between items-center px-4 py-2.5 bg-[#FEF2F2] border-y border-[#F5D0D0]">
        <span className="text-sm font-bold text-[#111]">Total payable (package)</span>
        <span className="text-base font-extrabold text-[#E21B23]">{rupees(total)}</span>
      </div>
      <div className="px-4 pt-3 pb-1 text-[13px] font-bold text-[#111] uppercase tracking-wide">Other charges</div>
      <ul className="px-4 pb-2">{extras.map(row)}</ul>
      {breakup.hasActualsExtras && <p className="px-4 pb-3 text-xs text-[#555]">Charges marked “—” are billed at actual cost after the trip and are not part of the total above.</p>}
    </div>
  );
}
