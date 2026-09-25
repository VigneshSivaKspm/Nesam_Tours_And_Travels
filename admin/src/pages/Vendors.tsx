import { useState, useEffect } from "react";
import { Vendor } from "../types";
import { subscribeVendors, updateFirestoreDocument, setFirestoreDocument, COLLECTIONS } from "../services/adminFirestoreService";

const statusStyle: Record<string, { badge: string; dot: string }> = {
  Active: { badge: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  Pending: { badge: "bg-yellow-50 text-yellow-700 border-yellow-200", dot: "bg-yellow-500" },
  Suspended: { badge: "bg-red-50 text-[#E21B23] border-red-200", dot: "bg-[#E21B23]" },
  Blacklisted: { badge: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" },
};

const docStatus: Record<string, string> = {
  Verified: "text-green-700 bg-green-50",
  Pending: "text-yellow-700 bg-yellow-50",
  Uploaded: "text-blue-700 bg-blue-50",
  Expired: "text-[#E21B23] bg-red-50",
};

export default function Vendors() {
  const [vendorsList, setVendorsList] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVendor, setNewVendor] = useState({ companyName: '', owner: '', phone: '', email: '', city: '', gst: '', commission: 10 });

  useEffect(() => {
    const unsub = subscribeVendors(setVendorsList);
    return () => unsub();
  }, []);

  const pendingVendors = vendorsList.filter((v) => v.status === "Pending");

  const filtered = vendorsList.filter((v) => {
    const matchSearch =
      search === "" ||
      (v.name && v.name.toLowerCase().includes(search.toLowerCase())) ||
      (v.owner && v.owner.toLowerCase().includes(search.toLowerCase())) ||
      (v.phone && v.phone.includes(search));
    const matchStatus = statusFilter === "All" || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleUpdateStatus = (id: string, newStatus: string) => {
    setVendorsList(prev => prev.map(v => v.id === id ? { ...v, status: newStatus } : v));
    updateFirestoreDocument(COLLECTIONS.VENDORS, id, { status: newStatus, verified: newStatus === "Active" });
    setSelectedVendor(null);
  };

  const handleAddVendor = async () => {
    if (!newVendor.companyName.trim()) {
      alert("Please enter company name");
      return;
    }
    const id = 'VEN-' + Date.now();
    const vendorRecord: Vendor = {
      id,
      name: newVendor.companyName.trim(),
      owner: newVendor.owner.trim() || 'Operations Manager',
      phone: newVendor.phone.trim() || '+91 90000 00000',
      email: newVendor.email.trim() || 'vendor@nesam.in',
      city: newVendor.city.trim() || 'Chennai',
      gst: newVendor.gst.trim() || 'Pending',
      commission: newVendor.commission || 10,
      status: 'Active',
      verified: true,
      fleetSize: 0,
      activeDrivers: 0,
      docs: { gst: 'Verified', pan: 'Verified' },
      wallet: '₹0'
    };

    setVendorsList(prev => [vendorRecord, ...prev.filter(v => v.id !== id)]);
    setShowAddModal(false);
    setNewVendor({ companyName: '', owner: '', phone: '', email: '', city: '', gst: '', commission: 10 });

    await setFirestoreDocument(COLLECTIONS.VENDORS, id, vendorRecord);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Vendors", value: vendorsList.length, color: "#E21B23", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
          { label: "Active Vendors", value: vendorsList.filter((v) => v.status === "Active").length, color: "#10B981", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
          { label: "Pending Approval", value: pendingVendors.length, color: "#F59E0B", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
          { label: "Suspended", value: vendorsList.filter((v) => v.status === "Suspended").length, color: "#999", icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${s.color}18` }}>
              <svg className="w-5 h-5" style={{ color: s.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
              </svg>
            </div>
            <div>
              <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[11px] text-[#999]">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Approval Alert */}
      {pendingVendors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-yellow-800">{pendingVendors.length} vendor{pendingVendors.length > 1 ? "s" : ""} awaiting approval</div>
            <div className="text-[12px] text-yellow-700 mt-0.5">{pendingVendors.map((v) => v.name).join(", ")} — review documents and approve or reject.</div>
          </div>
          <button onClick={() => setActiveTab("pending")} className="text-[12px] font-semibold text-yellow-800 border border-yellow-300 px-3 py-1.5 rounded-lg hover:bg-yellow-100 transition-colors">
            Review Now
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-[#E5E5E5] p-1 w-fit shadow-sm">
        {[{ key: "all", label: "All Vendors" }, { key: "pending", label: `Pending (${pendingVendors.length})` }].map((t) => (
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

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor name, owner, phone..."
            className="w-full pl-9 pr-4 py-2 text-[13px] bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] placeholder-[#999]"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#E21B23] text-[#444]">
          {["All", "Active", "Pending", "Suspended"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowAddModal(true)} className="ml-auto flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer" style={{ background: "#E21B23" }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Register Vendor
        </button>
      </div>

      {/* Vendor Table */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E5E5]">
          <span className="text-[13px] font-semibold text-[#111]">{(activeTab === "pending" ? pendingVendors : filtered).length} vendors</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                {["Vendor", "Owner", "City", "Fleet", "Commission", "Documents", "Wallet", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(activeTab === "pending" ? pendingVendors : filtered).map((v, i) => {
                const st = statusStyle[v.status] || statusStyle.Active;
                return (
                  <tr key={i} className="table-row border-b border-[#F5F5F5] last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: v.status === "Active" ? "#E21B23" : v.status === "Pending" ? "#F59E0B" : "#999" }}>
                          {(v.name || 'Vendor').split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold text-[#111]">{v.name}</div>
                          <div className="text-[10px] text-[#999]">{v.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] font-medium text-[#111]">{v.owner}</div>
                      <div className="text-[10px] text-[#999]">{v.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#666]">{v.city}</td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] font-semibold text-[#111]">{v.fleetSize} vehicles</div>
                      <div className="text-[10px] text-[#999]">{v.activeDrivers} active drivers</div>
                    </td>
                    <td className="px-4 py-3 text-[12px] font-bold" style={{ color: "#E21B23" }}>{v.commission}%</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(v.docs || {}).map(([key, val]) => (
                          <span key={key} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${docStatus[val as string] || "text-gray-600 bg-gray-100"}`}>{val as string}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-[#111]">{v.wallet}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${st.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setSelectedVendor(v)} className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] hover:bg-[#FEF2F2] text-[#E21B23] font-medium transition-colors">Audit</button>
                        {v.status === "Pending" && (
                          <>
                            <button onClick={() => handleUpdateStatus(v.id, "Active")} className="text-[11px] px-2 py-1 rounded-md border border-green-200 hover:bg-green-50 text-green-700 font-medium transition-colors">Approve</button>
                            <button onClick={() => handleUpdateStatus(v.id, "Suspended")} className="text-[11px] px-2 py-1 rounded-md border border-red-200 hover:bg-red-50 text-[#E21B23] font-medium transition-colors">Reject</button>
                          </>
                        )}
                        {v.status === "Active" && (
                          <button onClick={() => handleUpdateStatus(v.id, "Suspended")} className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] hover:bg-[#F5F5F5] text-[#444] font-medium transition-colors">Suspend</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendor Audit Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-[#111]">Vendor Audit: {selectedVendor.name}</h3>
                <p className="text-xs text-gray-500 font-mono">ID: {selectedVendor.id} • Owner: {selectedVendor.owner}</p>
              </div>
              <button onClick={() => setSelectedVendor(null)} className="text-gray-400 hover:text-gray-700 text-sm font-bold">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="border rounded-xl p-3 bg-gray-50">
                <span className="font-bold text-gray-800 block mb-1">GST Registration Certificate</span>
                <span className="text-[10px] text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded">✓ Verified GSTIN</span>
              </div>

              <div className="border rounded-xl p-3 bg-gray-50">
                <span className="font-bold text-gray-800 block mb-1">Company PAN Document</span>
                <span className="text-[10px] text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded">✓ Verified PAN</span>
              </div>

              <div className="border rounded-xl p-3 bg-gray-50">
                <span className="font-bold text-gray-800 block mb-1">Fleet Capacity</span>
                <span className="font-semibold text-gray-900">{selectedVendor.fleetSize} Commercial Vehicles</span>
              </div>

              <div className="border rounded-xl p-3 bg-gray-50">
                <span className="font-bold text-gray-800 block mb-1">Fleet Drivers</span>
                <span className="font-semibold text-gray-900">{selectedVendor.activeDrivers} Registered Drivers</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                onClick={() => handleUpdateStatus(selectedVendor.id, "Suspended")}
                className="px-4 py-2 border border-red-300 text-red-700 text-xs font-bold rounded-lg hover:bg-red-50"
              >
                Reject / Suspend Vendor
              </button>

              <button
                onClick={() => handleUpdateStatus(selectedVendor.id, "Active")}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow"
              >
                ✓ Approve Vendor Account
              </button>
            </div>
          </div>
        </div>
      )}


      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">Register New Vendor</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-3">
              <input placeholder="Company Name *" className="w-full p-2 border rounded text-xs" required onChange={(e) => setNewVendor({...newVendor, companyName: e.target.value})} />
              <input placeholder="Owner Name" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewVendor({...newVendor, owner: e.target.value})} />
              <input placeholder="Phone" type="tel" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewVendor({...newVendor, phone: e.target.value})} />
              <input placeholder="Email" type="email" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewVendor({...newVendor, email: e.target.value})} />
              <input placeholder="City" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewVendor({...newVendor, city: e.target.value})} />
              <input placeholder="GST Number" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewVendor({...newVendor, gst: e.target.value})} />
              <input placeholder="Commission % (Default 10)" type="number" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewVendor({...newVendor, commission: Number(e.target.value) || 10})} />
              
              <button onClick={handleAddVendor} className="w-full p-2.5 bg-[#E21B23] hover:bg-[#C41820] text-white text-xs font-bold rounded mt-2 cursor-pointer transition-colors shadow">Register Vendor</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
