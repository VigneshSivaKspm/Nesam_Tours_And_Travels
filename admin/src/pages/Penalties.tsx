import { useState, useEffect } from "react";
import { PenaltyRecord } from "../types";
import { penaltyRules } from "../config/constants";
import { subscribePenalties, updateFirestoreDocument, setFirestoreDocument, COLLECTIONS } from "../services/adminFirestoreService";

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

export default function Penalties() {
  const [activeTab, setActiveTab] = useState<"history" | "rules" | "disputes">("history");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPenalty, setNewPenalty] = useState({ type: 'Cancellation', entityType: 'Driver', entityId: '', reason: '', amount: 500 });
  const [penaltyList, setPenaltyList] = useState<PenaltyRecord[]>([]);

  useEffect(() => {
    const unsub = subscribePenalties(setPenaltyList);
    return () => unsub();
  }, []);

  const handleAddPenalty = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPenalty.entityId.trim()) {
      alert("Entity ID (Driver/Vendor ID) is required.");
      return;
    }
    const id = 'PEN-' + Date.now();
    const createdPenalty: PenaltyRecord = {
      id,
      entityType: newPenalty.entityType as "Driver" | "Vendor",
      entityName: newPenalty.entityId.trim(),
      type: newPenalty.type,
      reason: newPenalty.reason.trim() || `${newPenalty.type} Violation`,
      amount: '₹' + (newPenalty.amount || 500),
      date: new Date().toISOString().split('T')[0],
      status: 'Applied'
    };

    // Optimistically update penalty list immediately
    setPenaltyList((prev) => [createdPenalty, ...prev]);
    setShowAddModal(false);
    setNewPenalty({ type: 'Cancellation', entityType: 'Driver', entityId: '', reason: '', amount: 500 });

    // Save to Firestore
    try {
      await setFirestoreDocument(COLLECTIONS.PENALTIES, id, createdPenalty);
    } catch (err) {
      console.warn("Error saving penalty to Firestore:", err);
    }
  };

  const disputed = penaltyList.filter((p) => p.status === "Disputed");
  const pending = penaltyList.filter((p) => p.status === "Pending");

  const totalApplied = penaltyList
    .filter((p) => p.status === "Applied")
    .reduce((sum, p) => sum + parseInt((p.amount || "0").replace(/[^0-9]/g, "") || "0"), 0);

  return (
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Penalties (Month)", value: penaltyList.length, color: "#E21B23" },
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
        <div className="text-[12px] font-bold text-[#111] mb-3">Cancellation & Penalty Workflow</div>
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
          { key: "history", label: "Penalty History" },
          { key: "rules", label: "Penalty Rules" },
          { key: "disputes", label: `Disputes (${disputed.length})` },
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

      {/* Penalty History Table */}
      {activeTab === "history" && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
            <span className="text-[13px] font-bold text-[#111]">All Penalties</span>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-[#E5E5E5] text-[#E21B23] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
            >
              + Add Penalty
            </button>
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
                {penaltyList.map((p, i) => (
                  <tr key={i} className="table-row border-b border-[#F5F5F5] last:border-0">
                    <td className="px-4 py-3 text-[11px] font-mono font-bold text-[#444]">{p.id}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${penaltyTypeStyle[p.type]}`}>{p.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] font-semibold text-[#111]">{p.entity}</div>
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
                    <td className="px-4 py-3 text-[12px] text-green-700 font-semibold">{p.custCompensation}</td>
                    <td className="px-4 py-3 text-[11px] text-[#666]">{p.date}</td>
                    <td className="px-4 py-3 text-[11px] font-mono" style={{ color: "#E21B23" }}>{p.bookingId}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${statusStyle[p.status]}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => alert(`Penalty Details:\nID: ${p.id}\nEntity: ${p.entity}\nReason: ${p.reason}\nAmount: ${p.amount}\nStatus: ${p.status}`)}
                          className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] hover:bg-[#FEF2F2] text-[#E21B23] font-medium transition-colors cursor-pointer"
                        >
                          View
                        </button>
                        {p.status === "Pending" && (
                          <button
                            onClick={() => updateFirestoreDocument(COLLECTIONS.PENALTIES, p.id, { status: "Applied", walletDeducted: true })}
                            className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] hover:bg-green-50 text-green-700 font-medium transition-colors cursor-pointer"
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
            <button
              onClick={() => alert("Configure Rule: Penalty rule configuration saved.")}
              className="text-[12px] font-semibold text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
              style={{ background: "#E21B23" }}
            >
              Add Rule
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                  {["Trigger Condition", "Driver/Vendor Penalty", "Customer Compensation", "When Applied", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {penaltyRules.map((r, i) => (
                  <tr key={i} className="table-row border-b border-[#F5F5F5] last:border-0">
                    <td className="px-4 py-3 text-[12px] text-[#111] font-medium">{r.trigger}</td>
                    <td className="px-4 py-3 text-[12px] font-bold" style={{ color: "#E21B23" }}>{r.driverPenalty}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-green-700">{r.custCompensation}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F5F5F5] text-[#666]">{r.timing}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => alert(`Edit Rule: ${r.trigger}`)}
                          className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] hover:bg-[#FEF2F2] text-[#E21B23] font-medium transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
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
              <p className="text-[13px] font-medium text-[#999]">No active disputes</p>
            </div>
          )}
          {disputed.map((p, i) => (
            <div key={i} className="bg-white rounded-xl border border-orange-200 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono font-bold text-[#E21B23]">{p.id}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded text-orange-700 bg-orange-50">Disputed</span>
                  </div>
                  <div className="text-[13px] font-semibold text-[#111]">{p.entity} — {p.reason}</div>
                  <div className="text-[11px] text-[#999] mt-0.5">Booking: {p.bookingId} • Date: {p.date} • Penalty: {p.amount}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateFirestoreDocument(COLLECTIONS.PENALTIES, p.id, { status: "Applied", walletDeducted: true })}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:opacity-90 cursor-pointer"
                  >
                    Uphold Penalty
                  </button>
                  <button
                    onClick={() => updateFirestoreDocument(COLLECTIONS.PENALTIES, p.id, { status: "Reversed", walletDeducted: false })}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[#E5E5E5] text-[#444] hover:bg-[#F5F5F5] cursor-pointer"
                  >
                    Reverse Penalty
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">Add Penalty</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-3">
              <select className="w-full p-2 border rounded text-xs" onChange={(e) => setNewPenalty({...newPenalty, type: e.target.value})}>
                <option>Cancellation</option><option>Late Arrival</option><option>Misconduct</option><option>No Show</option>
              </select>
              <select className="w-full p-2 border rounded text-xs" onChange={(e) => setNewPenalty({...newPenalty, entityType: e.target.value})}>
                <option>Driver</option><option>Vendor</option>
              </select>
              <input placeholder="Entity ID (Driver/Vendor ID)" className="w-full p-2 border rounded text-xs" required onChange={(e) => setNewPenalty({...newPenalty, entityId: e.target.value})} />
              <input placeholder="Reason" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewPenalty({...newPenalty, reason: e.target.value})} />
              <input placeholder="Amount (₹)" type="number" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewPenalty({...newPenalty, amount: Number(e.target.value)})} />
              
              <button
                type="button"
                onClick={handleAddPenalty}
                className="w-full p-2.5 bg-[#E21B23] hover:bg-[#c4151c] text-white text-xs font-bold rounded-lg mt-2 cursor-pointer transition-colors shadow"
              >
                Submit Penalty
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
