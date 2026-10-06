import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Booking, PaymentTransaction } from "../types";
import { subscribeBookings, subscribePayments, subscribeToCollection } from "../services/adminFirestoreService";
import {
  bookingsAwaitingPayment,
  expectedAmount,
  isSuccessfulPayment,
  mapPayment,
  toDate,
  type PaymentRow,
} from "../services/paymentService";
import { RecordPaymentModal } from "../components/booking/BookingActions";
import { formatINR, parseAmount } from "../utils/analytics";
import { ErrorBanner, Modal, Toast, useToast } from "../components/Feedback";
import { formatDateTime12, formatShortDateTime12, formatHourLabel } from "../utils/time";

const statusStyle: Record<string, string> = {
  Success: "text-green-700 bg-green-50 border-green-200",
  Paid: "text-green-700 bg-green-50 border-green-200",
  Pending: "text-yellow-700 bg-yellow-50 border-yellow-200",
  Refunded: "text-gray-600 bg-gray-100 border-gray-200",
  Failed: "text-[#E21B23] bg-red-50 border-red-200",
};

const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dateLabel = (d: Date | null) =>
  d ? formatDateTime12(d) : "—";

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const content = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Payments() {
  const [rawPayments, setRawPayments] = useState<PaymentTransaction[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [admins, setAdmins] = useState<{ id: string; name?: string; email?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [tab, setTab] = useState<"transactions" | "awaiting">("transactions");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDateStr, setToDateStr] = useState("");
  const [viewing, setViewing] = useState<PaymentRow | null>(null);
  const [verifying, setVerifying] = useState<Booking | null>(null);
  const { toast, show } = useToast();

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const fail = (m: string) => {
      setLoadError(m);
      setLoading(false);
    };
    const unsubs = [
      subscribePayments((data) => {
        setRawPayments(data);
        setLoading(false);
      }, fail),
      subscribeBookings(setBookings, fail),
      subscribeToCollection<{ id: string; name?: string; email?: string }>("admins", setAdmins, () => setAdmins([])),
    ];
    return () => unsubs.forEach((u) => u());
  }, [retryKey]);

  const payments = useMemo(
    () => rawPayments.map((p) => mapPayment(p as PaymentTransaction & Record<string, unknown>)).sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)),
    [rawPayments],
  );
  const awaiting = useMemo(() => bookingsAwaitingPayment(bookings), [bookings]);
  const adminName = (uid: string) => {
    const a = admins.find((x) => x.id === uid);
    return a ? a.name || a.email || uid : uid || "—";
  };

  const kpis = useMemo(() => {
    const todayKey = new Date().toDateString();
    let collected = 0;
    let today = 0;
    for (const p of payments) {
      if (!isSuccessfulPayment(p.status)) continue;
      collected += p.amount;
      if (p.date?.toDateString() === todayKey) today += p.amount;
    }
    const awaitingAmount = awaiting.reduce((s, b) => s + expectedAmount(b), 0);
    return { collected, today, awaitingAmount, awaitingCount: awaiting.length, count: payments.filter((p) => isSuccessfulPayment(p.status)).length };
  }, [payments, awaiting]);

  const weekData = useMemo(() => {
    const days: { key: string; day: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ key: d.toDateString(), day: d.toLocaleDateString("en-IN", { weekday: "short" }), amount: 0 });
    }
    for (const p of payments) {
      if (!isSuccessfulPayment(p.status)) continue;
      const slot = days.find((d) => d.key === p.date?.toDateString());
      if (slot) slot.amount += p.amount;
    }
    return days.map(({ day, amount }) => ({ day, amount }));
  }, [payments]);

  const methodBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of payments) if (isSuccessfulPayment(p.status)) totals.set(p.method, (totals.get(p.method) || 0) + p.amount);
    const grand = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([method, amount]) => ({ method, amount: formatINR(amount), pct: grand > 0 ? Math.round((amount / grand) * 100) : 0 }));
  }, [payments]);

  const methods = useMemo(() => [...new Set(payments.map((p) => p.method))].sort(), [payments]);
  const statuses = useMemo(() => [...new Set(payments.map((p) => p.status))].sort(), [payments]);
  const dateRangeError = fromDate && toDateStr && fromDate > toDateStr ? "The start date is after the end date." : "";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const to = toDateStr ? new Date(`${toDateStr}T23:59:59.999`).getTime() : null;
    return payments.filter((p) => {
      if (statusFilter !== "All" && p.status !== statusFilter) return false;
      if (methodFilter !== "All" && p.method !== methodFilter) return false;
      const t = p.date?.getTime();
      if (from !== null && (t === undefined || t < from)) return false;
      if (to !== null && (t === undefined || t > to)) return false;
      return (
        !q ||
        [p.id, p.bookingCode, p.customer, p.method, p.reference].some((v) => v.toLowerCase().includes(q))
      );
    });
  }, [payments, search, statusFilter, methodFilter, fromDate, toDateStr]);

  const filteredTotal = filtered.filter((p) => isSuccessfulPayment(p.status)).reduce((s, p) => s + p.amount, 0);

  const exportCsv = () =>
    downloadCsv(
      `nesam_payments_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Payment ID", "Booking", "Customer", "Amount", "Method", "Gateway", "Reference", "Date", "Status", "Verified By"],
      filtered.map((p) => [p.id, p.bookingCode, p.customer, p.amount, p.method, p.gateway, p.reference, p.date ? p.date.toISOString() : "", p.status, adminName(p.verifiedBy)]),
    );

  return (
    <div className="p-6 space-y-5">
      <Toast toast={toast} />
      {loadError && <ErrorBanner message={loadError} onRetry={() => setRetryKey((k) => k + 1)} />}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[#111]">Payment Transactions & Collections</h1>
          <p className="text-[13px] text-[#666]">
            Verified customer payments for completed trips. Customers pay by UPI (to the company) or cash (to the driver).
          </p>
        </div>
        <button
          onClick={() => setTab("awaiting")}
          className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white rounded-lg shadow-sm hover:opacity-90 active:scale-95 cursor-pointer transition-all"
          style={{ background: "#E21B23" }}
        >
          Record Payment ({awaiting.length} awaiting)
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Collected", value: formatINR(kpis.collected), color: "#E21B23" },
          { label: "Today's Collection", value: formatINR(kpis.today), color: "#111" },
          { label: "Payments Recorded", value: kpis.count.toLocaleString("en-IN"), color: "#10B981" },
          { label: `Awaiting Verification (${kpis.awaitingCount} trips)`, value: formatINR(kpis.awaitingAmount), color: "#F59E0B" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
            <div className="text-[20px] font-bold" style={{ color: s.color }}>{loading ? "—" : s.value}</div>
            <div className="text-[11px] text-[#999] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Chart + Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
          <h3 className="text-[14px] font-bold text-[#111] mb-5">Collections — Last 7 Days (₹)</h3>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={weekData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={(v) => formatINR(Number(v))} />
              <Tooltip
                formatter={(v) => [rupees(Number(v)), "Collected"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E5E5" }}
              />
              <Bar dataKey="amount" fill="#E21B23" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
          <h3 className="text-[14px] font-bold text-[#111] mb-4">Payment Methods</h3>
          {methodBreakdown.length > 0 ? (
            <div className="space-y-3.5">
              {methodBreakdown.map((m) => (
                <div key={m.method}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="font-semibold text-[#333]">{m.method}</span>
                    <span className="font-bold text-[#111]">{m.amount} ({m.pct}%)</span>
                  </div>
                  <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${m.pct}%`, background: "#E21B23" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-[12px] text-[#999]">No payments recorded yet.</div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-[#E5E5E5] p-1 w-fit shadow-sm">
        {[
          { key: "transactions" as const, label: `Transactions (${payments.length})` },
          { key: "awaiting" as const, label: `Awaiting Verification (${awaiting.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${tab === t.key ? "text-white shadow-sm" : "text-[#666] hover:text-[#111]"}`}
            style={tab === t.key ? { background: "#E21B23" } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "transactions" ? (
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E5E5] space-y-3 bg-[#FAFAFA]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[14px] font-bold text-[#111]">Payment Transactions</h3>
                <span className="text-[11px] text-[#888]">
                  {filtered.length} shown • {formatINR(filteredTotal)} collected
                </span>
              </div>
              <button
                onClick={exportCsv}
                disabled={filtered.length === 0}
                className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-[#E5E5E5] bg-white text-[#E21B23] hover:bg-[#FEF2F2] cursor-pointer disabled:opacity-40"
              >
                📥 Export CSV
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                placeholder="Search payment, booking, customer, reference…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-1.5 text-[12px] border border-[#DDD] rounded-lg focus:outline-none focus:border-[#E21B23]"
              />
              <select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-1.5 text-[12px] border border-[#DDD] rounded-lg bg-white">
                <option value="All">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select aria-label="Method" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="px-3 py-1.5 text-[12px] border border-[#DDD] rounded-lg bg-white">
                <option value="All">All methods</option>
                {methods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <label className="text-[11px] text-[#666] flex items-center gap-1">
                From
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-2 py-1 text-[12px] border border-[#DDD] rounded-lg" />
              </label>
              <label className="text-[11px] text-[#666] flex items-center gap-1">
                To
                <input type="date" value={toDateStr} onChange={(e) => setToDateStr(e.target.value)} className="px-2 py-1 text-[12px] border border-[#DDD] rounded-lg" />
              </label>
            </div>
            {dateRangeError && <p className="text-[11px] text-red-600">{dateRangeError}</p>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                  {["Date", "Booking", "Customer", "Amount", "Method", "Reference", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#888] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="table-row border-b border-[#F5F5F5] hover:bg-gray-50/60 last:border-0 transition-colors">
                    <td className="px-4 py-3 text-[11px] text-[#666] whitespace-nowrap">{dateLabel(p.date)}</td>
                    <td className="px-4 py-3 text-[11px] font-mono font-semibold" style={{ color: "#E21B23" }}>{p.bookingCode || "—"}</td>
                    <td className="px-4 py-3 text-[12px] font-medium text-[#111]">{p.customer || "—"}</td>
                    <td className="px-4 py-3 text-[12px] font-bold text-[#111]">{rupees(p.amount)}</td>
                    <td className="px-4 py-3 text-[12px] text-[#444] font-medium">{p.method}</td>
                    <td className="px-4 py-3 text-[11px] text-[#666] font-mono max-w-[180px] truncate">{p.reference || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusStyle[p.status] || "text-gray-600 bg-gray-100 border-gray-200"}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setViewing(p)} className="text-[11px] px-2.5 py-1 rounded-md border border-[#E5E5E5] hover:bg-[#FEF2F2] text-[#E21B23] font-semibold">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && filtered.length === 0 && (
              <div className="py-12 text-center text-[13px] text-[#999]">
                {payments.length === 0 ? "No payments recorded yet." : "No payments match your filters."}
              </div>
            )}
            {loading && <div className="py-12 text-center text-[13px] text-[#999]">Loading payments…</div>}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E5E5] bg-[#FAFAFA]">
            <h3 className="text-[14px] font-bold text-[#111]">Completed Trips With a Balance Due</h3>
            <p className="text-[11px] text-[#888]">
              Record each payment received — cash, UPI or bank transfer, in one or more parts, and who collected it. The paid amount and balance are worked out from these records.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                  {["Booking", "Customer", "Route", "Method", "Balance Due", "Completed", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#888] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {awaiting.map((b) => (
                  <tr key={b.id} className="border-b border-[#F5F5F5] last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-[11px] font-mono font-semibold" style={{ color: "#E21B23" }}>{b.bookingId || b.id}</td>
                    <td className="px-4 py-3 text-[12px] text-[#111]">{b.customer || b.customerName || "—"}</td>
                    <td className="px-4 py-3 text-[11px] text-[#666] max-w-[220px] truncate">{b.pickup} → {b.drop}</td>
                    <td className="px-4 py-3 text-[12px] text-[#444]">{b.paymentMethod || "—"}</td>
                    <td className="px-4 py-3 text-[12px] font-bold text-[#111]">
                      {rupees(expectedAmount(b))}
                      {Number(b.tollCharges || 0) > 0 && <div className="text-[10px] font-normal text-[#888]">incl. tolls {rupees(Number(b.tollCharges))}</div>}
                      {b.paymentSummary && b.paymentSummary.totalPaid > 0 && <div className="text-[10px] font-normal text-[#888]">paid {rupees(b.paymentSummary.totalPaid)}</div>}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#666]">{dateLabel(toDate(b.completedAt))}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setVerifying(b)}
                        className="text-[11px] px-3 py-1.5 rounded-md bg-[#E21B23] text-white font-semibold hover:opacity-90"
                      >
                        Record payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && awaiting.length === 0 && (
              <div className="py-12 text-center text-[13px] text-[#999]">No completed trips are waiting for payment verification.</div>
            )}
          </div>
        </div>
      )}

      {viewing && (
        <Modal title={`Payment ${viewing.id}`} onClose={() => setViewing(null)}>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            {[
              ["Booking", viewing.bookingCode || "—"],
              ["Customer", viewing.customer || "—"],
              ["Amount", rupees(viewing.amount)],
              ["Status", viewing.status],
              ["Method", viewing.method],
              ["Gateway / Channel", viewing.gateway || "—"],
              ["Reference", viewing.reference || "—"],
              ["Recorded", dateLabel(viewing.date)],
              ["Verified by", viewing.verifiedBy ? adminName(viewing.verifiedBy) : "—"],
            ].map(([k, v]) => (
              <div key={k} className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <div className="text-[10px] text-gray-500">{k}</div>
                <div className="font-semibold text-gray-900 break-words">{v}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {verifying && (
        <RecordPaymentModal
          booking={verifying}
          onClose={() => setVerifying(null)}
          onDone={(msg) => {
            setVerifying(null);
            show(msg);
          }}
        />
      )}
    </div>
  );
}
