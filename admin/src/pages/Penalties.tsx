import { useState, useEffect } from "react";
import { PenaltyRecord, Driver, Vendor } from "../types";
import { penaltyRules } from "../config/constants";
import {
  subscribePenalties,
  subscribeDrivers,
  subscribeVendors,
  updateFirestoreDocument,
  setFirestoreDocument,
  COLLECTIONS,
} from "../services/adminFirestoreService";

const penaltyTypeStyle: Record<string, string> = {
  Driver: "bg-blue-50 text-blue-700 border-blue-200",
  Vendor: "bg-purple-50 text-purple-700 border-purple-200",
};

const statusStyle: Record<string, string> = {
  Applied: "text-green-700 bg-green-50",
  Pending: "text-yellow-700 bg-yellow-50",
  Disputed: "text-orange-700 bg-orange-50",
  Reversed: "text-gray-600 bg-gray-100",
};

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const content = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Penalties() {
  const [activeTab, setActiveTab] = useState<"history" | "rules" | "disputes">("history");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPenaltyDetail, setSelectedPenaltyDetail] = useState<any | null>(null);
  const [newPenalty, setNewPenalty] = useState({
    type: "Cancellation",
    entityType: "Driver",
    entityId: "",
    entityName: "",
    reason: "",
    amount: 500,
    bookingId: "",
  });
  const [penaltyList, setPenaltyList] = useState<PenaltyRecord[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    const unsubPenalties = subscribePenalties(setPenaltyList);
    const unsubDrivers = subscribeDrivers(setDrivers);
    const unsubVendors = subscribeVendors(setVendors);

    return () => {
      unsubPenalties();
      unsubDrivers();
      unsubVendors();
    };
  }, []);

  const displayPenalties: any[] = penaltyList;
  const availableDrivers: any[] = drivers;
  const availableVendors: any[] = vendors;

  const handleAddPenalty = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPenalty.entityId.trim()) {
      alert("Please select a valid Driver or Vendor.");
      return;
    }
    const id = "PEN-" + Date.now();
    const createdPenalty: any = {
      id,
      entityType: newPenalty.entityType as "Driver" | "Vendor",
      type: newPenalty.entityType as "Driver" | "Vendor",
      entity: newPenalty.entityName || newPenalty.entityId,
      entityId: newPenalty.entityId.trim(),
      reason: newPenalty.reason.trim() || `${newPenalty.type} Violation`,
      amount: "₹" + (newPenalty.amount || 500),
      walletDeducted: true,
      custCompensation: `₹${Math.round((newPenalty.amount || 500) * 0.5)}`,
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      status: "Applied",
      bookingId: newPenalty.bookingId.trim(),
    };

    setPenaltyList((prev) => [createdPenalty, ...prev]);
    setShowAddModal(false);
    setNewPenalty({
      type: "Cancellation",
      entityType: "Driver",
      entityId: "",
      entityName: "",
      reason: "",
      amount: 500,
      bookingId: "",
    });

    try {
      await setFirestoreDocument(COLLECTIONS.PENALTIES, id, createdPenalty);
    } catch (err) {
      console.warn("Error saving penalty to Firestore:", err);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string, walletDeducted: boolean) => {
    setPenaltyList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: newStatus as any, walletDeducted } : p))
    );
    try {
      await updateFirestoreDocument(COLLECTIONS.PENALTIES, id, {
        status: newStatus,
        walletDeducted,
      });
    } catch (err) {
      console.warn("Error updating penalty status:", err);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      "Penalty ID",
      "Type",
      "Entity",
      "Entity ID",
      "Violation Reason",
      "Penalty Amount",
      "Wallet Deducted",
      "Customer Compensation",
      "Date",
      "Booking Reference",
      "Status",
    ];
    const rows = displayPenalties.map((p: any) => [
      p.id,
      p.type || p.entityType,
      p.entity || p.entityName,
      p.entityId || "—",
      p.reason,
      p.amount,
      p.walletDeducted ? "Yes" : "No",
      p.custCompensation || "₹0",
      p.date,
      p.bookingId || "—",
      p.status,
    ]);
    downloadCsv("nesam_penalties_audit_report.csv", headers, rows);
  };

  const disputed = displayPenalties.filter((p) => p.status === "Disputed");
  const pending = displayPenalties.filter((p) => p.status === "Pending");

  const totalApplied = displayPenalties
    .filter((p) => p.status === "Applied")
    .reduce((sum, p) => sum + parseInt((p.amount || "0").replace(/[^0-9]/g, "") || "0"), 0);

  return (
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Penalties (Month)", value: displayPenalties.length, color: "#E21B23" },
          { label: "Total Amount Applied", value: `₹${totalApplied.toLocaleString()}`, color: "#111" },
          { label: "Pending Review", value: pending.length, color: "#F59E0B" },
          { label: "Disputed", value: disputed.length, color: "#8B5CF6" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
            <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] text-[#999] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Workflow Banner */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-bold text-[#111]">Cancellation & Penalty Workflow</span>

        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {["Booking Cancelled", "Reason Assessed", "Penalty Calculated", "Wallet Deducted", "Customer Compensated"].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[#F5F5F5] rounded-lg px-3 py-1.5">
                <div className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: "#E21B23" }}>{i + 1}</div>
                <span className="text-[11px] font-medium text-[#444]">{step}</span>
              </div>
              {i < 4 && <svg className="w-4 h-4 text-[#999] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-[#E5E5E5] p-1 w-fit shadow-sm">
        {[
          { key: "history", label: `Penalty History (${displayPenalties.length})` },
          { key: "rules", label: "Penalty Rules" },
          { key: "disputes", label: `Disputes (${disputed.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${activeTab === t.key ? "text-white shadow-sm" : "text-[#666] hover:text-[#111]"}`}
            style={activeTab === t.key ? { background: "#E21B23" } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Penalty History Table */}
      {activeTab === "history" && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
            <span className="text-[13px] font-bold text-[#111]">All Penalties ({displayPenalties.length})</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-[#E5E5E5] text-[#444] hover:bg-[#F5F5F5] transition-colors cursor-pointer"
              >
                📥 Export CSV
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-[12px] font-semibold px-4 py-2 rounded-lg text-white bg-[#E21B23] hover:bg-[#c4151c] transition-colors cursor-pointer shadow-sm"
              >
                + Issue Penalty
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                  {["Penalty ID", "Type", "Entity", "Reason", "Amount", "Wallet Deducted", "Customer Compensation", "Date", "Booking", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayPenalties.map((p, i) => (
                  <tr key={p.id || i} className="table-row border-b border-[#F5F5F5] last:border-0 hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-3 text-[11px] font-mono font-bold text-[#444]">{p.id}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${penaltyTypeStyle[p.type || p.entityType] || "bg-gray-50 text-gray-700"}`}>
                        {p.type || p.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] font-semibold text-[#111]">{p.entity || p.entityName}</div>
                      <div className="text-[10px] text-[#999]">{p.entityId}</div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#666] max-w-[180px]">{p.reason}</td>
                    <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#E21B23" }}>{p.amount}</td>
                    <td className="px-4 py-3">
                      {p.walletDeducted ? (
                        <span className="text-[11px] text-green-700 font-semibold flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          Deducted
                        </span>
                      ) : (
                        <span className="text-[11px] text-yellow-600 font-semibold">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-green-700 font-semibold">{p.custCompensation || "—"}</td>
                    <td className="px-4 py-3 text-[11px] text-[#666]">{p.date}</td>
                    <td className="px-4 py-3 text-[11px] font-mono" style={{ color: "#E21B23" }}>{p.bookingId || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${statusStyle[p.status] || "text-gray-700 bg-gray-50"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setSelectedPenaltyDetail(p)}
                          className="text-[11px] px-2.5 py-1 rounded-md border border-[#E5E5E5] hover:bg-[#FEF2F2] text-[#E21B23] font-medium transition-colors cursor-pointer"
                        >
                          View
                        </button>
                        {p.status === "Pending" && (
                          <button
                            onClick={() => handleUpdateStatus(p.id, "Applied", true)}
                            className="text-[11px] px-2.5 py-1 rounded-md bg-green-50 text-green-700 border border-green-200 font-medium hover:bg-green-100 transition-colors cursor-pointer"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Penalty Rules */}
      {activeTab === "rules" && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
            <span className="text-[13px] font-bold text-[#111]">Penalty Rule Configuration</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                  {["Trigger Condition", "Driver/Vendor Penalty", "Customer Compensation", "When Applied"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {penaltyRules.map((r, i) => (
                  <tr key={i} className="table-row border-b border-[#F5F5F5] last:border-0 hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 text-[12px] text-[#111] font-medium">{r.trigger}</td>
                    <td className="px-4 py-3 text-[12px] font-bold" style={{ color: "#E21B23" }}>{r.driverPenalty}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-green-700">{r.custCompensation}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-[#F5F5F5] text-[#555]">{r.timing}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Disputes */}
      {activeTab === "disputes" && (
        <div className="space-y-3">
          {disputed.length === 0 && (
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-12 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-[13px] font-medium text-[#999]">No active disputes under review</p>
            </div>
          )}
          {disputed.map((p, i) => (
            <div key={p.id || i} className="bg-white rounded-xl border border-orange-200 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono font-bold text-[#E21B23]">{p.id}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded text-orange-700 bg-orange-50">Disputed</span>
                  </div>
                  <div className="text-[13px] font-semibold text-[#111]">{p.entity || p.entityName} — {p.reason}</div>
                  <div className="text-[11px] text-[#999] mt-0.5">Booking: {p.bookingId || "—"} • Date: {p.date} • Penalty: {p.amount}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateStatus(p.id, "Applied", true)}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:opacity-90 cursor-pointer shadow-sm transition-opacity"
                  >
                    Uphold Penalty
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(p.id, "Reversed", false)}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[#E5E5E5] text-[#444] hover:bg-[#F5F5F5] cursor-pointer transition-colors"
                  >
                    Reverse Penalty
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Penalty Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">Issue Compliance Penalty</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700 font-bold text-lg">✕</button>
            </div>
            <form onSubmit={handleAddPenalty} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#666] block mb-1">Entity Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPenalty({ ...newPenalty, entityType: "Driver", entityId: "", entityName: "" })}
                    className={`p-2 rounded-lg text-xs font-semibold border ${newPenalty.entityType === "Driver" ? "bg-red-50 text-[#E21B23] border-[#E21B23]" : "bg-white text-gray-700 border-gray-200"}`}
                  >
                    Driver
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPenalty({ ...newPenalty, entityType: "Vendor", entityId: "", entityName: "" })}
                    className={`p-2 rounded-lg text-xs font-semibold border ${newPenalty.entityType === "Vendor" ? "bg-red-50 text-[#E21B23] border-[#E21B23]" : "bg-white text-gray-700 border-gray-200"}`}
                  >
                    Vendor
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#666] block mb-1">
                  Select {newPenalty.entityType}
                </label>
                <select
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-[#E21B23]"
                  value={newPenalty.entityId}
                  required
                  onChange={(e) => {
                    const selId = e.target.value;
                    let selName = "";
                    if (newPenalty.entityType === "Driver") {
                      const d = availableDrivers.find((drv: any) => drv.id === selId);
                      selName = d ? d.name : selId;
                    } else {
                      const v = availableVendors.find((ven: any) => ven.id === selId);
                      selName = v ? (v.business?.businessName || v.name) : selId;
                    }
                    setNewPenalty({ ...newPenalty, entityId: selId, entityName: selName });
                  }}
                >
                  <option value="">-- Choose {newPenalty.entityType} --</option>
                  {newPenalty.entityType === "Driver" ? (
                    availableDrivers.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.id}) • {d.vehicleNumber || d.vehicle || "Active"}
                      </option>
                    ))
                  ) : (
                    availableVendors.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.business?.businessName || v.companyName || v.name} ({v.id})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#666] block mb-1">Violation Category</label>
                <select
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs"
                  value={newPenalty.type}
                  onChange={(e) => {
                    const val = e.target.value;
                    let defaultAmt = 500;
                    if (val === "No Show") defaultAmt = 1000;
                    if (val === "Late Arrival") defaultAmt = 300;
                    if (val === "Misconduct") defaultAmt = 1500;
                    setNewPenalty({ ...newPenalty, type: val, amount: defaultAmt });
                  }}
                >
                  <option value="Cancellation">Trip Cancellation (&lt; 2 hrs)</option>
                  <option value="Late Arrival">Late Arrival (&gt; 30 min)</option>
                  <option value="No Show">No Show at Pickup</option>
                  <option value="Misconduct">Behavioral Misconduct / Complaint</option>
                  <option value="Document Lapse">Document / Insurance Lapse</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-[#666] block mb-1">Penalty Amount (₹)</label>
                  <input
                    type="number"
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs font-semibold"
                    value={newPenalty.amount}
                    onChange={(e) => setNewPenalty({ ...newPenalty, amount: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#666] block mb-1">Booking ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. NTT-2024-4821"
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs font-mono"
                    value={newPenalty.bookingId}
                    onChange={(e) => setNewPenalty({ ...newPenalty, bookingId: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#666] block mb-1">Violation Details / Reason</label>
                <textarea
                  rows={2}
                  placeholder="Describe specific grounds for the penalty..."
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs"
                  value={newPenalty.reason}
                  onChange={(e) => setNewPenalty({ ...newPenalty, reason: e.target.value })}
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#E21B23] hover:bg-[#c4151c] text-white text-xs font-bold rounded-lg shadow cursor-pointer transition-colors"
                >
                  Apply Penalty
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Penalty Detail Modal */}
      {selectedPenaltyDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-[16px] text-[#111]">Penalty Details</h3>
                <p className="text-[12px] text-[#666]">{selectedPenaltyDetail.id}</p>
              </div>
              <button
                onClick={() => setSelectedPenaltyDetail(null)}
                className="text-gray-400 hover:text-black text-xl font-bold w-8 h-8 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between p-2.5 bg-gray-50 rounded-lg">
                <span className="text-[#888]">Target Entity:</span>
                <span className="font-bold text-[#111]">{selectedPenaltyDetail.entity || selectedPenaltyDetail.entityName} ({selectedPenaltyDetail.entityId})</span>
              </div>
              <div className="flex justify-between p-2.5 bg-gray-50 rounded-lg">
                <span className="text-[#888]">Violation Reason:</span>
                <span className="font-medium text-[#111] text-right">{selectedPenaltyDetail.reason}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-gray-50 rounded-lg">
                <span className="text-[#888]">Amount:</span>
                <span className="font-bold text-[#E21B23]">{selectedPenaltyDetail.amount}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-gray-50 rounded-lg">
                <span className="text-[#888]">Customer Compensation:</span>
                <span className="font-bold text-green-700">{selectedPenaltyDetail.custCompensation || "—"}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-gray-50 rounded-lg">
                <span className="text-[#888]">Status:</span>
                <span className="font-semibold text-green-700">{selectedPenaltyDetail.status}</span>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedPenaltyDetail(null)}
                className="px-5 py-2 rounded-xl bg-[#111] text-white text-[13px] font-semibold hover:bg-black cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
