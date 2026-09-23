import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { Booking, Vendor } from "../types";
import { subscribeBookings, subscribeVendors } from "../services/adminFirestoreService";
import { parseAmount, bookingDate, isPaid, formatINR, inMonth, pctChange, formatPct } from "../utils/analytics";

const COLORS = ["#E21B23", "#111111", "#444444", "#777777", "#AAAAAA"];

const SERVICE_TYPES = [
  { name: "Airport Taxi", match: "airport" },
  { name: "Outstation", match: "outstation" },
  { name: "One Way", match: "one way" },
  { name: "Local Rental", match: "local" },
  { name: "Tour Package", match: "tour" },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState<"bookings" | "revenue" | "vendors" | "cancellations" | "gst">("bookings");
  const [liveBookings, setLiveBookings] = useState<Booking[]>([]);
  const [liveVendors, setLiveVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    const unsub1 = subscribeBookings(setLiveBookings);
    const unsub2 = subscribeVendors(setLiveVendors);
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const now = new Date();
  const lastMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const thisMonthBookings = useMemo(
    () => liveBookings.filter((b) => inMonth(bookingDate(b), now)),
    [liveBookings],
  );
  const lastMonthBookings = useMemo(
    () => liveBookings.filter((b) => inMonth(bookingDate(b), lastMonthRef)),
    [liveBookings],
  );

  const revenue = (list: Booking[]) =>
    list.filter(isPaid).reduce((s, b) => s + parseAmount(b.fare), 0);

  const monthRevenue = revenue(thisMonthBookings);
  const lastMonthRevenue = revenue(lastMonthBookings);
  const cancellations = thisMonthBookings.filter((b) => b.status === "Cancelled").length;
  const lastMonthCancellations = lastMonthBookings.filter((b) => b.status === "Cancelled").length;
  const avgBookingValue =
    thisMonthBookings.length > 0 ? monthRevenue / thisMonthBookings.length : 0;
  const lastAvg =
    lastMonthBookings.length > 0 ? lastMonthRevenue / lastMonthBookings.length : 0;

  const summaryCards = [
    {
      label: "Total Bookings (Month)",
      value: thisMonthBookings.length.toLocaleString(),
      change: pctChange(thisMonthBookings.length, lastMonthBookings.length),
      invert: false,
      color: "#E21B23",
    },
    {
      label: "Gross Revenue (Month)",
      value: formatINR(monthRevenue),
      change: pctChange(monthRevenue, lastMonthRevenue),
      invert: false,
      color: "#111",
    },
    {
      label: "Cancellations (Month)",
      value: cancellations.toString(),
      change: pctChange(cancellations, lastMonthCancellations),
      invert: true,
      color: "#F59E0B",
    },
    {
      label: "Avg Booking Value",
      value: formatINR(avgBookingValue),
      change: pctChange(avgBookingValue, lastAvg),
      invert: false,
      color: "#10B981",
    },
  ];

  const bookingsByType = useMemo(() => {
    const count = (list: Booking[], match: string) =>
      list.filter((b) =>
        (b.service || b.serviceType || "").toLowerCase().includes(match),
      ).length;
    return SERVICE_TYPES.map((t) => ({
      name: t.name,
      thisMonth: count(thisMonthBookings, t.match),
      lastMonth: count(lastMonthBookings, t.match),
    }));
  }, [thisMonthBookings, lastMonthBookings]);

  const hasTypeData = bookingsByType.some((d) => d.thisMonth > 0 || d.lastMonth > 0);

  const revenueTrend = useMemo(() => {
    const buckets: { label: string; start: Date; end: Date }[] = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      buckets.push({ label: start.toLocaleString("en-US", { month: "short" }), start, end });
    }
    return buckets.map((bk) => {
      const inRange = liveBookings.filter((b) => {
        const d = bookingDate(b);
        return d !== null && d >= bk.start && d < bk.end;
      });
      const total = inRange.reduce((s, b) => s + parseAmount(b.fare), 0);
      const tour = inRange
        .filter((b) => (b.service || b.serviceType || "").toLowerCase().includes("tour"))
        .reduce((s, b) => s + parseAmount(b.fare), 0);
      return { month: bk.label, total, booking: total - tour, tour };
    });
  }, [liveBookings]);

  const hasRevenueTrend = revenueTrend.some((d) => d.total > 0);

  const cancellationReasons = useMemo(() => {
    const cancelled = liveBookings.filter((b) => b.status === "Cancelled");
    const counts = new Map<string, number>();
    for (const b of cancelled) {
      const reason = (b as any).cancelReason || (b as any).cancellationReason || "Not specified";
      counts.set(reason, (counts.get(reason) || 0) + 1);
    }
    const total = cancelled.length;
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({
        reason,
        count,
        pct: total > 0 ? `${Math.round((count / total) * 100)}%` : "0%",
      }));
  }, [liveBookings]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-[#E5E5E5] rounded-xl p-3 shadow-xl text-[12px]">
          <div className="font-semibold text-[#111] mb-1">{label}</div>
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-[#666]">{p.name}:</span>
              <span className="font-semibold text-[#111]">{typeof p.value === "number" && p.value > 1000 ? `₹${(p.value / 1000).toFixed(0)}K` : p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((s) => {
          const good = s.change === null ? null : s.invert ? s.change <= 0 : s.change >= 0;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
              <div className="text-[20px] font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[11px] text-[#999] mt-0.5">{s.label}</div>
              <div className={`text-[11px] font-semibold mt-1 ${good === null ? "text-[#999]" : good ? "text-green-600" : "text-[#E21B23]"}`}>
                {formatPct(s.change)}{s.change !== null && " vs last month"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-white rounded-xl border border-[#E5E5E5] p-1 w-fit shadow-sm">
        {[
          { key: "bookings", label: "Bookings" },
          { key: "revenue", label: "Revenue" },
          { key: "vendors", label: "Vendor Reports" },
          { key: "cancellations", label: "Cancellations" },
          { key: "gst", label: "GST Summary" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${activeTab === t.key ? "text-white shadow-sm" : "text-[#666] hover:text-[#111]"}`}
            style={activeTab === t.key ? { background: "#E21B23" } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bookings Report */}
      {activeTab === "bookings" && (
        <div className="space-y-5">
          {hasTypeData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
                <h3 className="text-[14px] font-bold text-[#111] mb-4">Bookings by Service Type</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bookingsByType} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#999" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="thisMonth" name="This Month" fill="#E21B23" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lastMonth" name="Last Month" fill="#E5E5E5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
                <h3 className="text-[14px] font-bold text-[#111] mb-4">Booking Service Mix (This Month)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={bookingsByType.filter((d) => d.thisMonth > 0).map((d, i) => ({ ...d, value: d.thisMonth, fill: COLORS[i % COLORS.length] }))} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={3}>
                      {bookingsByType.filter((d) => d.thisMonth > 0).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend formatter={(v) => <span className="text-[11px] text-[#666]">{v}</span>} />
                    <Tooltip formatter={(v: any) => [`${v} trips`, ""]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E5E5" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-10 text-center text-[13px] font-medium text-[#999]">
              No bookings recorded for this month or last month yet
            </div>
          )}
        </div>
      )}

      {/* Revenue Report */}
      {activeTab === "revenue" && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
            <h3 className="text-[14px] font-bold text-[#111] mb-4">Revenue Trend (Last 12 Months)</h3>
            {hasRevenueTrend ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="total" name="Total Revenue" stroke="#E21B23" strokeWidth={2.5} dot={{ r: 4, fill: "#E21B23" }} />
                  <Line type="monotone" dataKey="booking" name="Booking Revenue" stroke="#111111" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="tour" name="Tour Revenue" stroke="#888888" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-[13px] font-medium text-[#999]">
                No revenue recorded in the last 12 months
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vendor Reports */}
      {activeTab === "vendors" && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
            <span className="text-[13px] font-bold text-[#111]">Vendor Fleet Performance</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                  {["Vendor", "City", "Fleet Size", "Status", "Commission Rate"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liveVendors.map((v, i) => (
                  <tr key={i} className="border-b border-[#F5F5F5] last:border-0 text-[12px]">
                    <td className="px-4 py-3 font-semibold text-[#111]">{v.companyName || v.name}</td>
                    <td className="px-4 py-3 text-[#666]">{v.city || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-[#111]">{v.fleetSize ?? 0} vehicles</td>
                    <td className="px-4 py-3 text-green-700 font-semibold">{v.status}</td>
                    <td className="px-4 py-3 font-semibold text-[#E21B23]">{v.commission || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {liveVendors.length === 0 && (
              <div className="py-16 text-center text-[13px] font-medium text-[#999]">No vendors registered yet</div>
            )}
          </div>
        </div>
      )}

      {/* Cancellations */}
      {activeTab === "cancellations" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
            <h3 className="text-[14px] font-bold text-[#111] mb-4">Cancellation Reason Breakdown</h3>
            {cancellationReasons.length > 0 ? (
              <div className="space-y-3">
                {cancellationReasons.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[#F9F9F9]">
                    <div className="text-[13px] font-semibold text-[#111]">{r.reason}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-[#999]">{r.count} trips</span>
                      <span className="text-[12px] font-bold text-[#E21B23] px-2 py-0.5 rounded bg-red-50">{r.pct}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-[12px] text-[#999]">No cancellations recorded</div>
            )}
          </div>
        </div>
      )}

      {/* GST Summary */}
      {activeTab === "gst" && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
          <h3 className="text-[14px] font-bold text-[#111] mb-2">GST Compliance Overview</h3>
          <p className="text-[12px] text-[#666]">Tax reports and returns summary for platform trips.</p>
        </div>
      )}
    </div>
  );
}
