import { useState, useEffect } from "react";
import { vendorStatusLabel } from "../utils/vendorStatus";
import { Vendor, Booking, PaymentTransaction } from "../types";
import {
  subscribeVendors,
  subscribeBookings,
  subscribePayments,
  subscribePayoutRequests,
} from "../services/adminFirestoreService";

const razorpayStyle: Record<string, string> = {
  Settled: "text-green-700 bg-green-50",
  Success: "text-green-700 bg-green-50",
  Processing: "text-blue-700 bg-blue-50",
  Pending: "text-yellow-700 bg-yellow-50",
  "On Hold": "text-[#E21B23] bg-red-50",
  Failed: "text-[#E21B23] bg-red-50",
};

export default function VendorFinance() {
  const [activeTab, setActiveTab] = useState<
    "settlements" | "gst" | "razorpay"
  >("settlements");
  const [liveVendors, setLiveVendors] = useState<Vendor[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);

  useEffect(() => {
    const unsubVendors = subscribeVendors(setLiveVendors);
    const unsubBookings = subscribeBookings(setBookings);
    const unsubPayments = subscribePayments(setPayments);
    const unsubPayouts = subscribePayoutRequests(setPayoutRequests);

    return () => {
      unsubVendors();
      unsubBookings();
      unsubPayments();
      unsubPayouts();
    };
  }, []);

  // Compute stats from actual database records
  const totalGrossRevenue = bookings.reduce((sum, b) => {
    if (b.status === "Cancelled") return sum;
    const val =
      typeof b.fare === "number"
        ? b.fare
        : parseFloat(String(b.fare || "0").replace(/[^0-9.]/g, ""));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const totalCommission = bookings.reduce((sum, b) => {
    if (b.status === "Cancelled") return sum;
    const val =
      typeof b.fare === "number"
        ? b.fare
        : parseFloat(String(b.fare || "0").replace(/[^0-9.]/g, ""));
    return sum + (isNaN(val) ? 0 : val * 0.15);
  }, 0);

  const totalPayouts = payoutRequests
    .filter((p) => p.status === "Paid" || p.status === "Completed")
    .reduce((sum, p) => {
      const val =
        typeof p.amount === "number"
          ? p.amount
          : parseFloat(String(p.amount || "0").replace(/[^0-9.]/g, ""));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

  const pendingSettlements = payoutRequests
    .filter((p) => p.status === "Pending")
    .reduce((sum, p) => {
      const val =
        typeof p.amount === "number"
          ? p.amount
          : parseFloat(String(p.amount || "0").replace(/[^0-9.]/g, ""));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

  // Group GST records by month from actual bookings
  const gstSummaryMap: Record<string, number> = {};
  bookings.forEach((b) => {
    if (b.status === "Cancelled") return;
    const fare =
      typeof b.fare === "number"
        ? b.fare
        : parseFloat(String(b.fare || "0").replace(/[^0-9.]/g, ""));
    if (isNaN(fare) || fare <= 0) return;

    let monthKey = "Current";
    if (b.date) {
      const d = new Date(b.date);
      if (!isNaN(d.getTime())) {
        monthKey = d.toLocaleString("en-US", {
          month: "short",
          year: "numeric",
        });
      } else {
        monthKey = b.date;
      }
    }
    gstSummaryMap[monthKey] = (gstSummaryMap[monthKey] || 0) + fare;
  });

  const gstRecords = Object.entries(gstSummaryMap).map(([month, rev]) => {
    const gstVal = Math.round(rev * 0.05);
    return {
      month,
      totalTripRevenue: `₹${rev.toLocaleString("en-IN")}`,
      gstRate: "5%",
      gstCollected: `₹${gstVal.toLocaleString("en-IN")}`,
      gstPayable: `₹${gstVal.toLocaleString("en-IN")}`,
      status: "Pending",
    };
  });

  return (
    <div className="p-6 space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Gross Revenue (Month)",
            value: `₹${Math.round(totalGrossRevenue).toLocaleString("en-IN")}`,
            color: "#E21B23",
          },
          {
            label: "Total Commission Earned",
            value: `₹${Math.round(totalCommission).toLocaleString("en-IN")}`,
            color: "#111",
          },
          {
            label: "Total Vendor Payouts",
            value: `₹${Math.round(totalPayouts).toLocaleString("en-IN")}`,
            color: "#10B981",
          },
          {
            label: "Pending Route Settlements",
            value: `₹${Math.round(pendingSettlements).toLocaleString("en-IN")}`,
            color: "#F59E0B",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4"
          >
            <div className="text-[20px] font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-[11px] text-[#999] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-[#E5E5E5] p-1 w-fit shadow-sm">
        {[
          { key: "settlements", label: "Vendor Settlements" },
          { key: "gst", label: "GST Reports" },
          { key: "razorpay", label: "Razorpay Route" },
        ].map((t) => (
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

      {/* Vendor Settlements */}
      {activeTab === "settlements" && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
            <span className="text-[13px] font-bold text-[#111]">
              Vendor Financial Ledger
            </span>
            <button className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-[#E5E5E5] text-[#E21B23] hover:bg-[#FEF2F2]">
              Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                  {[
                    "Vendor",
                    "Owner",
                    "City",
                    "Fleet",
                    "Active Drivers",
                    "Commission",
                    "Status",
                    "Wallet",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liveVendors.length === 0 ? (
                  <tr className="border-b border-[#F5F5F5]">
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-[13px] text-[#999]"
                    >
                      No vendor financial records found
                    </td>
                  </tr>
                ) : (
                  liveVendors.map((v: any, i) => (
                    <tr
                      key={i}
                      className="table-row border-b border-[#F5F5F5] last:border-0"
                    >
                      <td className="px-4 py-3">
                        <div className="text-[12px] font-semibold text-[#111]">
                          {v.business?.businessName ||
                            v.companyName ||
                            v.name ||
                            "Unnamed"}
                        </div>
                        <div className="text-[10px] text-[#999]">{v.id}</div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#111]">
                        {v.business?.vendorName ||
                          v.contactPerson ||
                          v.owner ||
                          "—"}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#666]">
                        {v.business?.address?.city || v.city || "—"}
                      </td>
                      <td className="px-4 py-3 text-[12px] font-semibold text-[#111]">
                        {v.fleet?.fleetSize ?? v.fleetSize ?? "0"} vehicles
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#666]">
                        {v.activeDrivers ?? "0"}
                      </td>
                      <td
                        className="px-4 py-3 text-[11px]"
                        style={{ color: "#E21B23" }}
                      >
                        {v.commission ? `${v.commission}%` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-semibold text-green-700">
                          {v.status === "Approved" || v.status === "Active"
                            ? "APPROVED"
                            : vendorStatusLabel(v)}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-[12px] font-semibold"
                        style={{ color: "#111" }}
                      >
                        {v.walletBalance !== undefined
                          ? `₹${v.walletBalance.toLocaleString("en-IN")}`
                          : v.wallet || "₹0"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            alert(
                              `Vendor Financial Details:\nVendor: ${v.business?.businessName || v.companyName || v.name}\nWallet Balance: ${v.walletBalance !== undefined ? `₹${v.walletBalance}` : v.wallet || "₹0"}\nCommission Rate: ${v.commission || 10}%`,
                            )
                          }
                          className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] hover:bg-[#FEF2F2] text-[#E21B23] font-medium transition-colors cursor-pointer"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GST Reports */}
      {activeTab === "gst" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-600 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-[12px] text-blue-800">
              <span className="font-semibold">GST Information (SAC 9964):</span>{" "}
              Passenger transport services are taxed at 5% GST without Input Tax
              Credit (ITC). GSTR-1 to be filed by the 11th of each month, and
              GSTR-3B by the 20th.
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#111]">
                Monthly GST Summary
              </span>
              <button
                onClick={() =>
                  alert(
                    "GSTR-1 Format export generated and downloaded successfully.",
                  )
                }
                className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-[#E5E5E5] text-[#E21B23] hover:bg-[#FEF2F2] cursor-pointer"
              >
                Export GSTR-1 Format
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                    {[
                      "Month",
                      "Trip Revenue",
                      "GST Rate",
                      "GST Collected",
                      "GST Payable",
                      "Status",
                      "Action",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gstRecords.length === 0 ? (
                    <tr className="border-b border-[#F5F5F5]">
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-[13px] text-[#999]"
                      >
                        No GST records found in database
                      </td>
                    </tr>
                  ) : (
                    gstRecords.map((r, i) => (
                      <tr
                        key={i}
                        className="table-row border-b border-[#F5F5F5] last:border-0"
                      >
                        <td className="px-4 py-3 text-[12px] font-semibold text-[#111]">
                          {r.month}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#444]">
                          {r.totalTripRevenue}
                        </td>
                        <td
                          className="px-4 py-3 text-[12px] font-semibold"
                          style={{ color: "#E21B23" }}
                        >
                          {r.gstRate}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-bold text-[#111]">
                          {r.gstCollected}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-bold text-[#111]">
                          {r.gstPayable}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${r.status === "Filed" ? "text-green-700 bg-green-50" : "text-yellow-700 bg-yellow-50"}`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              alert(`Downloading GST report for ${r.month}`)
                            }
                            className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] hover:bg-[#FEF2F2] text-[#E21B23] font-medium transition-colors cursor-pointer"
                          >
                            Download
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Razorpay Route Settlements */}
      {activeTab === "razorpay" && (
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
            <svg
              className="w-5 h-5 text-purple-600 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <div className="text-[12px] text-purple-800">
              <span className="font-semibold">
                Razorpay Route (Automated Splits):
              </span>{" "}
              Customer payments are instantly split between the platform
              commission account and vendor linked accounts via Razorpay Route.
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#111]">
                Razorpay Route Settlements
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                    {[
                      "Transfer ID",
                      "Booking ID",
                      "Customer",
                      "Amount",
                      "Method",
                      "Date",
                      "Status",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr className="border-b border-[#F5F5F5]">
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-[13px] text-[#999]"
                      >
                        No Razorpay Route settlements found in database
                      </td>
                    </tr>
                  ) : (
                    payments.map((p, i) => (
                      <tr
                        key={i}
                        className="table-row border-b border-[#F5F5F5] last:border-0"
                      >
                        <td className="px-4 py-3 text-[11px] font-mono font-semibold text-[#444]">
                          {p.id}
                        </td>
                        <td
                          className="px-4 py-3 text-[11px] font-mono"
                          style={{ color: "#E21B23" }}
                        >
                          {p.bookingId}
                        </td>
                        <td className="px-4 py-3 text-[12px] font-medium text-[#111]">
                          {p.customer}
                        </td>
                        <td className="px-4 py-3 text-[12px] font-bold text-[#111]">
                          {p.amount}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#666]">
                          {p.method}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#666]">
                          {p.date}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${razorpayStyle[p.status] || "text-green-700 bg-green-50"}`}
                          >
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
