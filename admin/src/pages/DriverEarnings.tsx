import { useState, useEffect, useMemo } from "react";
import { Booking, Driver } from "../types";
import {
  subscribeDrivers,
  subscribeBookings,
  subscribePayoutRequests,
  updateFirestoreDocument,
} from "../services/adminFirestoreService";
import { parseAmount, bookingDate, formatINR, inMonth } from "../utils/analytics";

const COMMISSION_RATE = 0.15;
const TDS_RATE = 0.01;

const isCompleted = (b: Booking) =>
  ["completed", "trip completed"].includes((b.status || "").toLowerCase());

export default function DriverEarnings() {
  const [activeTab, setActiveTab] = useState<"earnings" | "tds" | "payouts">("earnings");
  const [liveDrivers, setLiveDrivers] = useState<Driver[]>([]);
  const [liveBookings, setLiveBookings] = useState<Booking[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);

  useEffect(() => {
    const unsub = subscribeDrivers(setLiveDrivers);
    const unsub2 = subscribePayoutRequests(setPayouts);
    const unsub3 = subscribeBookings(setLiveBookings);
    return () => {
      unsub();
      unsub2();
      unsub3();
    };
  }, []);

  // Per-driver earnings derived from completed bookings assigned to them.
  const driverRows = useMemo(() => {
    return liveDrivers.map((d) => {
      const trips = liveBookings.filter(
        (b: any) =>
          isCompleted(b) &&
          (b.assignedDriverId
            ? b.assignedDriverId === d.id
            : !!b.driver && !!d.name && b.driver.toLowerCase() === d.name.toLowerCase()),
      );
      const gross = trips.reduce((s, b) => s + parseAmount(b.fare), 0);
      const commission = gross * COMMISSION_RATE;
      const net = gross - commission;
      const tds = commission * TDS_RATE;
      return {
        driver: d,
        tripCount: trips.length || d.trips || d.totalTrips || 0,
        gross,
        commission,
        net,
        tds,
        wallet: parseAmount(d.wallet),
      };
    });
  }, [liveDrivers, liveBookings]);

  const pendingPayouts = useMemo(
    () =>
      payouts.filter((p) =>
        ["pending", "requested", "open"].includes((p.status || "").toLowerCase()),
      ),
    [payouts],
  );

  const tdsThisMonth = useMemo(() => {
    const now = new Date();
    return (
      liveBookings
        .filter((b) => isCompleted(b) && inMonth(bookingDate(b), now))
        .reduce((s, b) => s + parseAmount(b.fare), 0) *
      COMMISSION_RATE *
      TDS_RATE
    );
  }, [liveBookings]);

  const kpis = [
    {
      label: "Drivers Earning",
      value: driverRows.filter((r) => r.gross > 0).length,
      color: "#E21B23",
    },
    {
      label: "Total Wallet Balance",
      value: formatINR(driverRows.reduce((s, r) => s + r.wallet, 0)),
      color: "#111",
    },
    {
      label: "Pending Payouts",
      value: formatINR(
        pendingPayouts.reduce((s, p) => s + parseAmount(p.amount), 0),
      ),
      color: "#F59E0B",
    },
    { label: "TDS This Month", value: formatINR(tdsThisMonth), color: "#8B5CF6" },
  ];

  // Monthly TDS aggregates for the last 6 months, computed from bookings.
  const tdsRecords = useMemo(() => {
    const now = new Date();
    const rows: {
      month: string;
      totalPayouts: number;
      tdsDeducted: number;
      driverCommissions: number;
    }[] = [];
    for (let i = 0; i < 6; i++) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const trips = liveBookings.filter(
        (b) => isCompleted(b) && inMonth(bookingDate(b), ref),
      );
      const gross = trips.reduce((s, b) => s + parseAmount(b.fare), 0);
      const commission = gross * COMMISSION_RATE;
      rows.push({
        month: ref.toLocaleString("en-US", { month: "short", year: "numeric" }),
        totalPayouts: gross - commission,
        driverCommissions: commission,
        tdsDeducted: commission * TDS_RATE,
      });
    }
    return rows.filter((r) => r.driverCommissions > 0);
  }, [liveBookings]);

  return (
    <div className="p-6 space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
            <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] text-[#999] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-[#E5E5E5] p-1 w-fit shadow-sm">
        {[{ key: "earnings", label: "Driver Earnings" }, { key: "tds", label: "TDS Records (1%)" }, { key: "payouts", label: "Payout Requests" }].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all ${activeTab === t.key ? "text-white shadow-sm" : "text-[#666] hover:text-[#111]"}`}
            style={activeTab === t.key ? { background: "#E21B23" } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Earnings Table */}
      {activeTab === "earnings" && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
            <span className="text-[13px] font-bold text-[#111]">Driver Earnings Ledger</span>
            <span className="text-[11px] text-[#999]">Gross from completed trips · 15% commission · 1% TDS</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                  {["Driver", "Vendor", "Trips", "Gross Earnings", "Commission (15%)", "Net Earnings", "1% TDS", "Wallet Balance", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {driverRows.map((r, i) => (
                  <tr key={i} className="table-row border-b border-[#F5F5F5] last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: "#E21B23" }}>
                          {(r.driver.name || "Driver").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold text-[#111]">{r.driver.name}</div>
                          <div className="text-[10px] text-[#999]">{r.driver.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#666]">{r.driver.vendor || "Direct Fleet"}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-[#111] text-center">{r.tripCount}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-[#111]">{formatINR(r.gross)}</td>
                    <td className="px-4 py-3 text-[11px]" style={{ color: "#E21B23" }}>{formatINR(r.commission)}</td>
                    <td className="px-4 py-3 text-[12px] font-bold text-green-700">{formatINR(r.net)}</td>
                    <td className="px-4 py-3 text-[11px] text-[#666]">{formatINR(r.tds)}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold" style={{ color: "#111" }}>{r.driver.wallet || formatINR(r.wallet)}</td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-semibold text-green-700">{r.driver.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {driverRows.length === 0 && (
              <div className="py-16 text-center text-[13px] font-medium text-[#999]">No drivers registered yet</div>
            )}
          </div>
        </div>
      )}

      {/* TDS Records */}
      {activeTab === "tds" && (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-[12px] text-yellow-800">
              <span className="font-semibold">TDS Compliance (Section 194C):</span> 1% TDS is deducted on all driver commission payments above ₹30,000 per financial year. TDS must be deposited by the 7th of the following month. Form 26Q to be filed quarterly.
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#111]">Monthly TDS Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                    {["Month", "Net Payouts", "TDS Rate", "TDS Deducted", "Driver Commissions", "Filing Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tdsRecords.map((r, i) => (
                    <tr key={i} className="table-row border-b border-[#F5F5F5] last:border-0">
                      <td className="px-4 py-3 text-[12px] font-semibold text-[#111]">{r.month}</td>
                      <td className="px-4 py-3 text-[12px] text-[#444]">{formatINR(r.totalPayouts)}</td>
                      <td className="px-4 py-3 text-[12px] font-semibold" style={{ color: "#E21B23" }}>1%</td>
                      <td className="px-4 py-3 text-[13px] font-bold text-[#111]">{formatINR(r.tdsDeducted)}</td>
                      <td className="px-4 py-3 text-[12px] text-[#666]">{formatINR(r.driverCommissions)}</td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded text-yellow-700 bg-yellow-50">Not filed</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tdsRecords.length === 0 && (
                <div className="py-16 text-center text-[13px] font-medium text-[#999]">No commissionable trips in the last 6 months</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payout Requests */}
      {activeTab === "payouts" && (
        <div className="space-y-3">
          {pendingPayouts.map((p, i) => (
            <div key={p.id || i} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0" style={{ background: "#E21B23" }}>
                  {String(p.driverName || p.vendorName || p.driverId || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#111]">{p.driverName || p.vendorName || p.driverId || p.vendorId}</div>
                  <div className="text-[11px] text-[#999]">Requested {typeof p.requestedAt === "string" ? p.requestedAt : p.createdAt?.toDate?.().toLocaleDateString?.() || "recently"}{p.method ? ` • ${p.method}: ${p.details || ""}` : ""}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[15px] font-bold text-yellow-700">{formatINR(parseAmount(p.amount))}</div>
                  <div className="text-[10px] text-[#999]">Pending payout request</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateFirestoreDocument("payout_requests", p.id, { status: "Paid", processedAt: new Date().toISOString() })} className="text-[12px] font-semibold px-4 py-2 rounded-lg bg-green-600 text-white hover:opacity-90 transition-opacity cursor-pointer">Approve &amp; Pay</button>
                  <button onClick={() => updateFirestoreDocument("payout_requests", p.id, { status: "Deferred", processedAt: new Date().toISOString() })} className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-[#E5E5E5] text-[#444] hover:bg-[#F5F5F5] cursor-pointer">Defer</button>
                </div>
              </div>
            </div>
          ))}
          {pendingPayouts.length === 0 && (
            <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm py-16 text-center text-[13px] font-medium text-[#999]">
              No pending payout requests
            </div>
          )}
        </div>
      )}
    </div>
  );
}
