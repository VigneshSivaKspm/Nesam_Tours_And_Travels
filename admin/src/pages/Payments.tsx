import { useState, useEffect, useMemo } from "react";
import { PaymentTransaction } from "../types";
import { subscribePayments } from "../services/adminFirestoreService";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { parseAmount, formatINR } from "../utils/analytics";

const parseDate = (v: string | undefined | null): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const isSuccess = (s: string) =>
  ["success", "paid", "completed", "captured"].includes((s || "").toLowerCase());

export default function Payments() {
  const [paymentList, setPaymentList] = useState<PaymentTransaction[]>([]);

  useEffect(() => {
    const unsub = subscribePayments(setPaymentList);
    return () => unsub();
  }, []);

  const statusStyle: Record<string, string> = {
    Success: "text-green-700 bg-green-50",
    Paid: "text-green-700 bg-green-50",
    Pending: "text-yellow-700 bg-yellow-50",
    Refunded: "text-gray-600 bg-gray-100",
    Failed: "text-[#E21B23] bg-red-50",
  };

  const kpis = useMemo(() => {
    const now = new Date();
    const sameDay = (d: Date | null) =>
      d !== null &&
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    let collected = 0;
    let today = 0;
    let pending = 0;
    let refunds = 0;
    let failed = 0;

    for (const p of paymentList) {
      const amt = parseAmount(p.amount);
      const d = parseDate(p.date);
      const status = (p.status || "").toLowerCase();
      if (isSuccess(status)) {
        collected += amt;
        if (sameDay(d)) today += amt;
      }
      if (status === "pending") pending += amt;
      if (status === "refunded" || p.refund) refunds += parseAmount(p.refund) || amt;
      if (status === "failed") failed += amt;
    }
    return { collected, today, pending, refunds, failed };
  }, [paymentList]);

  const weekData = useMemo(() => {
    const now = new Date();
    const days: { day: string; start: Date; end: Date }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
      days.push({
        day: start.toLocaleString("en-US", { weekday: "short" }),
        start,
        end,
      });
    }
    return days.map((bk) => ({
      day: bk.day,
      amount: paymentList
        .filter((p) => {
          const d = parseDate(p.date);
          return d !== null && d >= bk.start && d < bk.end && isSuccess(p.status);
        })
        .reduce((s, p) => s + parseAmount(p.amount), 0),
    }));
  }, [paymentList]);

  const methodBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of paymentList) {
      if (!isSuccess(p.status)) continue;
      const method = p.method || "Other";
      totals.set(method, (totals.get(method) || 0) + parseAmount(p.amount));
    }
    const grand = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([method, amount]) => ({
        method,
        amount: formatINR(amount),
        pct: grand > 0 ? Math.round((amount / grand) * 100) : 0,
      }));
  }, [paymentList]);

  const hasWeekData = weekData.some((d) => d.amount > 0);

  return (
    <div className="p-6 space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Collected", value: formatINR(kpis.collected), color: "#E21B23" },
          { label: "Today's Collection", value: formatINR(kpis.today), color: "#111" },
          { label: "Pending", value: formatINR(kpis.pending), color: "#F59E0B" },
          { label: "Refunds", value: formatINR(kpis.refunds), color: "#666" },
          { label: "Failed", value: formatINR(kpis.failed), color: "#E21B23" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
            <div className="text-[20px] font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] text-[#999] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Chart + Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
          <h3 className="text-[14px] font-bold text-[#111] mb-5">Weekly Collection</h3>
          {hasWeekData ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}K`} />
                <Tooltip formatter={(v: any) => [`₹${v.toLocaleString()}`, "Amount"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E5E5" }} />
                <Bar dataKey="amount" fill="#E21B23" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[13px] font-medium text-[#999]">
              No collections in the last 7 days
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
          <h3 className="text-[14px] font-bold text-[#111] mb-4">Payment Methods</h3>
          {methodBreakdown.length > 0 ? (
            <div className="space-y-3">
              {methodBreakdown.map((m) => (
                <div key={m.method}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="font-medium text-[#444]">{m.method}</span>
                    <span className="font-semibold text-[#111]">{m.amount}</span>
                  </div>
                  <div className="h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${m.pct}%`, background: "#E21B23" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-[12px] text-[#999]">No payments recorded</div>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <span className="text-[14px] font-bold text-[#111]">Recent Transactions</span>
          <span className="text-[11px] text-[#999]">{paymentList.length} transactions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                {["Transaction ID", "Booking ID", "Customer", "Amount", "Method", "Gateway", "Date", "Status", "Refund"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paymentList.map((p, i) => (
                <tr key={i} className="table-row border-b border-[#F5F5F5] last:border-0">
                  <td className="px-4 py-3 text-[11px] font-mono font-semibold text-[#444]">{p.id}</td>
                  <td className="px-4 py-3 text-[11px] font-mono" style={{ color: "#E21B23" }}>{p.bookingId}</td>
                  <td className="px-4 py-3 text-[12px] font-medium text-[#111]">{p.customer}</td>
                  <td className="px-4 py-3 text-[12px] font-bold text-[#111]">{p.amount}</td>
                  <td className="px-4 py-3 text-[12px] text-[#666]">{p.method}</td>
                  <td className="px-4 py-3 text-[11px] text-[#666]">{p.gateway}</td>
                  <td className="px-4 py-3 text-[11px] text-[#666]">{p.date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${statusStyle[p.status] || "text-gray-600 bg-gray-100"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[#666]">{p.refund}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {paymentList.length === 0 && (
            <div className="py-16 text-center text-[13px] font-medium text-[#999]">
              No transactions yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
