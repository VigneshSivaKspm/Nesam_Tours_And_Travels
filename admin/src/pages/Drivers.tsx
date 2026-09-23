import { useState, useEffect } from "react";
import { Driver } from "../types";
import { subscribeDrivers, updateFirestoreDocument, COLLECTIONS } from "../services/adminFirestoreService";

const statusStyle: Record<string, string> = {
  "On Trip": "bg-orange-50 text-orange-700 border-orange-200",
  Online: "bg-green-50 text-green-700 border-green-200",
  Offline: "bg-gray-100 text-gray-600 border-gray-200",
  Suspended: "bg-red-50 text-[#E21B23] border-red-200",
};

export default function Drivers() {
  const [liveDrivers, setLiveDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [activeTab, setActiveTab] = useState<"docs" | "pretrip">("docs");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: '', phone: '', licenseNumber: '', licenseExpiry: '', vehicle: '', status: 'Online', rating: 5 });

  useEffect(() => {
    const unsub = subscribeDrivers(setLiveDrivers);
    return () => unsub();
  }, []);

  const handleApprove = (id: string) => {
    updateFirestoreDocument(COLLECTIONS.DRIVERS, id, { verified: true, docStatus: 'Approved' });
    setSelectedDriver(null);
  };

  const handleReject = (id: string) => {
    updateFirestoreDocument(COLLECTIONS.DRIVERS, id, { verified: false, docStatus: 'Rejected' });
    setSelectedDriver(null);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Drivers", value: liveDrivers.length.toString(), color: "#E21B23" },
          { label: "Online", value: liveDrivers.filter((d) => d.status === "Online").length.toString(), color: "#10B981" },
          { label: "On Trip", value: liveDrivers.filter((d) => d.status === "On Trip").length.toString(), color: "#F59E0B" },
          { label: "Suspended", value: liveDrivers.filter((d) => d.status === "Suspended").length.toString(), color: "#999" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
            <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] text-[#999] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
          <span className="text-[14px] font-bold text-[#111]">Driver Partner Audit & Verification</span>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-white rounded-lg" style={{ background: "#E21B23" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Driver
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                {["Driver", "Phone", "Assigned Vehicle", "License", "Status", "Total Trips", "Earnings", "Rating", "Verified", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liveDrivers.map((d, i) => {
                const isVerified = d.verified ?? true;
                return (
                  <tr key={i} className="table-row border-b border-[#F5F5F5] last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                          style={{ background: d.status === "Suspended" ? "#999" : "#E21B23" }}>
                          {(d.name || "Driver").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold text-[#111]">{d.name}</div>
                          <div className="text-[10px] text-[#999]">{d.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#666]">{d.phone}</td>
                    <td className="px-4 py-3 text-[11px] font-mono text-[#444]">{d.vehicle}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        d.license === "Valid" ? "text-green-700 bg-green-50" :
                        d.license === "Expiring Soon" ? "text-yellow-700 bg-yellow-50" :
                        "text-[#E21B23] bg-red-50"
                      }`}>{d.license}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusStyle[d.status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          d.status === "Online" ? "bg-green-500" :
                          d.status === "On Trip" ? "bg-orange-500" :
                          d.status === "Offline" ? "bg-gray-400" : "bg-[#E21B23]"
                        }`} />
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-[#111] text-center">{d.trips}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold" style={{ color: "#E21B23" }}>{d.earnings}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-[12px]">
                        <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        <span className="font-semibold text-[#111]">{d.rating}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isVerified ? (
                        <span className="flex items-center gap-1 text-[11px] text-green-700 font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Verified
                        </span>
                      ) : (
                        <span className="text-[11px] text-yellow-600 font-medium">Pending Review</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSelectedDriver(d)}
                          className="text-[11px] px-2.5 py-1 rounded-md border border-[#E5E5E5] bg-[#FEF2F2] text-[#E21B23] font-bold hover:bg-[#E21B23] hover:text-white transition-colors"
                        >
                          Audit Docs
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Driver Document Verification Modal */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-[#111]">Document Audit: {selectedDriver.name}</h3>
                <p className="text-xs text-gray-500 font-mono">ID: {selectedDriver.id} • Vehicle: {selectedDriver.vehicle}</p>
              </div>
              <button onClick={() => setSelectedDriver(null)} className="text-gray-400 hover:text-gray-700 text-sm font-bold">✕</button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-gray-200 gap-4">
              <button
                onClick={() => setActiveTab("docs")}
                className={`pb-2 text-xs font-bold ${activeTab === "docs" ? "text-[#E21B23] border-b-2 border-[#E21B23]" : "text-gray-500"}`}
              >
                Registration & Vehicle Documents (RC/DL/Insurance/Permit)
              </button>
              <button
                onClick={() => setActiveTab("pretrip")}
                className={`pb-2 text-xs font-bold ${activeTab === "pretrip" ? "text-[#E21E26] border-b-2 border-[#E21E26]" : "text-gray-500"}`}
              >
                Pre-Trip Live Verification Photos
              </button>
            </div>

            {activeTab === "docs" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-xl p-3 bg-gray-50 text-xs">
                  <span className="font-bold text-gray-800 block mb-1">Driving License (DL)</span>
                  <img src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&auto=format&fit=crop&q=80" alt="DL Front" className="h-28 w-full object-cover rounded mb-1" />
                  <span className="text-[10px] text-green-700 font-bold">✓ DL Valid</span>
                </div>

                <div className="border rounded-xl p-3 bg-gray-50 text-xs">
                  <span className="font-bold text-gray-800 block mb-1">Vehicle RC Document</span>
                  <img src="https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&auto=format&fit=crop&q=80" alt="RC" className="h-28 w-full object-cover rounded mb-1" />
                  <span className="text-[10px] text-green-700 font-bold">✓ RC Verified</span>
                </div>

                <div className="border rounded-xl p-3 bg-gray-50 text-xs">
                  <span className="font-bold text-gray-800 block mb-1">Commercial Insurance</span>
                  <img src="https://images.unsplash.com/photo-1450133064473-71024230f91b?w=400&auto=format&fit=crop&q=80" alt="Insurance" className="h-28 w-full object-cover rounded mb-1" />
                  <span className="text-[10px] text-green-700 font-bold">✓ Policy Active</span>
                </div>

                <div className="border rounded-xl p-3 bg-gray-50 text-xs">
                  <span className="font-bold text-gray-800 block mb-1">Fitness & State Permit</span>
                  <img src="https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&auto=format&fit=crop&q=80" alt="Permit" className="h-28 w-full object-cover rounded mb-1" />
                  <span className="text-[10px] text-green-700 font-bold">✓ All-State Taxi Permit</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-xl p-3 bg-gray-50 text-xs">
                  <span className="font-bold text-gray-800 block mb-1">1. Live Driver Selfie</span>
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80" alt="Selfie" className="h-28 w-full object-cover rounded" />
                </div>

                <div className="border rounded-xl p-3 bg-gray-50 text-xs">
                  <span className="font-bold text-gray-800 block mb-1">2. Vehicle Front & Plate</span>
                  <img src="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80" alt="Vehicle Front" className="h-28 w-full object-cover rounded" />
                </div>

                <div className="border rounded-xl p-3 bg-gray-50 text-xs">
                  <span className="font-bold text-gray-800 block mb-1">3. Odometer Cluster (84,290 KM)</span>
                  <img src="https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=400&auto=format&fit=crop&q=80" alt="Odometer" className="h-28 w-full object-cover rounded" />
                </div>

                <div className="border rounded-xl p-3 bg-gray-50 text-xs">
                  <span className="font-bold text-gray-800 block mb-1">4. Rear Passenger Seat</span>
                  <img src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&auto=format&fit=crop&q=80" alt="Rear Seat" className="h-28 w-full object-cover rounded" />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                onClick={() => handleReject(selectedDriver.id)}
                className="px-4 py-2 border border-red-300 text-red-700 text-xs font-bold rounded-lg hover:bg-red-50"
              >
                Reject / Request Re-upload
              </button>

              <button
                onClick={() => handleApprove(selectedDriver.id)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow"
              >
                ✓ Approve Driver Account
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">Add New Driver</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-3">
              <input placeholder="Driver Name *" className="w-full p-2 border rounded text-xs" required onChange={(e) => setNewDriver({...newDriver, name: e.target.value})} />
              <input placeholder="Phone *" type="tel" className="w-full p-2 border rounded text-xs" required onChange={(e) => setNewDriver({...newDriver, phone: e.target.value})} />
              <input placeholder="License Number" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewDriver({...newDriver, licenseNumber: e.target.value})} />
              <input type="date" title="License Expiry" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewDriver({...newDriver, licenseExpiry: e.target.value})} />
              <input placeholder="Assigned Vehicle (Optional)" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewDriver({...newDriver, vehicle: e.target.value})} />
              <select className="w-full p-2 border rounded text-xs" onChange={(e) => setNewDriver({...newDriver, status: e.target.value})}>
                <option>Online</option><option>Offline</option>
              </select>
              <input placeholder="Rating (1-5)" type="number" min="1" max="5" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewDriver({...newDriver, rating: Number(e.target.value)})} />
              <button onClick={() => {
                import('../services/adminFirestoreService').then(({ setFirestoreDocument, COLLECTIONS }) => {
                  const id = 'DRV-' + Date.now();
                  setFirestoreDocument(COLLECTIONS.DRIVERS, id, {
                    id, name: newDriver.name, phone: newDriver.phone, licenseNumber: newDriver.licenseNumber,
                    licenseExpiry: newDriver.licenseExpiry, status: newDriver.status, rating: newDriver.rating,
                    vehicle: newDriver.vehicle, verified: false, docStatus: 'Pending', trips: 0, earnings: '₹0'
                  });
                  setShowAddModal(false);
                });
              }} className="w-full p-2 bg-[#E21B23] text-white text-xs font-bold rounded mt-2">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
