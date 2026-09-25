import { useState, useEffect } from "react";
import { Vehicle, VehicleCategory } from "../types";
import { subscribeVehicles, subscribeVehicleCategories, updateFirestoreDocument, setFirestoreDocument, COLLECTIONS } from "../services/adminFirestoreService";

const statusStyle: Record<string, string> = {
  Available: "bg-green-50 text-green-700 border-green-200",
  "On Trip": "bg-orange-50 text-orange-700 border-orange-200",
  Maintenance: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Reserved: "bg-blue-50 text-blue-700 border-blue-200",
  Inactive: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function Vehicles() {
  const [vehicleList, setVehicleList] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [newVehicle, setNewVehicle] = useState({ number: '', category: 'Sedan', make: '', model: '', year: '', seats: '', fuel: 'Diesel' });

  useEffect(() => {
    const unsubV = subscribeVehicles(setVehicleList);
    const unsubC = subscribeVehicleCategories(setCategories);
    return () => {
      unsubV();
      unsubC();
    };
  }, []);

  const handleAddVehicle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newVehicle.number.trim()) {
      alert("Vehicle Registration Number is required.");
      return;
    }
    const id = 'VEH-' + Date.now();
    const vehicleName = `${newVehicle.make.trim()} ${newVehicle.model.trim()}`.trim() || newVehicle.category;
    const createdVehicle: Vehicle = {
      id,
      name: vehicleName,
      number: newVehicle.number.trim().toUpperCase(),
      category: newVehicle.category,
      seats: Number(newVehicle.seats) || 4,
      driver: 'Unassigned',
      status: 'Available',
      rate: '₹12/km',
      docStatus: 'Approved',
      fuel: newVehicle.fuel
    };

    // Optimistically update vehicle list immediately
    setVehicleList((prev) => [createdVehicle, ...prev]);
    setShowAddModal(false);
    setNewVehicle({ number: '', category: 'Sedan', make: '', model: '', year: '', seats: '', fuel: 'Diesel' });

    // Save to Firestore
    try {
      await setFirestoreDocument(COLLECTIONS.VEHICLES, id, createdVehicle);
    } catch (err) {
      console.warn("Error saving vehicle to Firestore:", err);
    }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Registered Vehicles", value: vehicleList.length.toString(), color: "#E21B23" },
          { label: "Available on Road", value: vehicleList.filter((v) => v.status === "Available").length.toString(), color: "#10B981" },
          { label: "Active On Trip", value: vehicleList.filter((v) => v.status === "On Trip").length.toString(), color: "#F59E0B" },
          { label: "Service / Maintenance", value: vehicleList.filter((v) => v.status === "Maintenance").length.toString(), color: "#999" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
            <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] text-[#999] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Vehicle Table */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
          <span className="text-[14px] font-bold text-[#111]">Fleet Vehicle Directory & Compliance Verification</span>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-white rounded-lg" style={{ background: "#E21B23" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Register Vehicle
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                {["Vehicle", "Number", "Category", "Seats", "Compliance Documents", "Driver", "Status", "Rate", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicleList.map((v, i) => (
                <tr key={i} className="table-row border-b border-[#F5F5F5] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#F5F5F5] flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-[#E21B23]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-[#111]">{v.name}</div>
                        <div className="text-[10px] text-[#999]">{v.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[11px] font-mono font-bold text-[#444]">{v.number}</td>
                  <td className="px-4 py-3 text-[11px] text-[#666]">{v.category}</td>
                  <td className="px-4 py-3 text-[12px] font-medium text-[#111] text-center">{v.seats}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-50 text-green-700">RC: Verified</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Ins: Active</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">FC: Valid</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700">Permit: All India</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#666] font-medium">{v.driver}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusStyle[v.status]}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-semibold" style={{ color: "#E21B23" }}>{v.rate}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setSelectedVehicle(v)} className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] hover:bg-[#FEF2F2] text-[#E21B23] font-medium transition-colors">Compliance Audit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Verification Audit Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Vehicle Compliance Audit</h3>
                <p className="text-xs text-gray-500 font-mono">{selectedVehicle.number} • {selectedVehicle.name}</p>
              </div>
              <button onClick={() => setSelectedVehicle(null)} className="text-gray-400 hover:text-gray-700 text-sm font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl border flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 block">Registration Certificate (RC)</span>
                  <span className="text-[10px] text-gray-500 font-mono">Reg Date: 12-Jan-2023</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">✓ Verified</span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 block">Commercial Vehicle Insurance</span>
                  <span className="text-[10px] text-gray-500 font-mono">Policy Exp: 31-Dec-2026</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">✓ Active</span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 block">Fitness Certificate (FC)</span>
                  <span className="text-[10px] text-gray-500 font-mono">FC Expiry: 15-Oct-2027</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">✓ Valid</span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 block">State / All India Tourist Permit</span>
                  <span className="text-[10px] text-gray-500 font-mono">Permit No: TN-PERM-99482</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">✓ All India</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                onClick={() => setSelectedVehicle(null)}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-700"
              >
                Close Audit
              </button>
              <button
                onClick={() => {
                  updateFirestoreDocument(COLLECTIONS.VEHICLES, selectedVehicle.id, { docStatus: 'Approved', status: 'Available' });
                  setSelectedVehicle(null);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow"
              >
                Approve Vehicle Status
              </button>
            </div>
          </div>
        </div>
      )}


      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">Register Vehicle</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-3">
              <input placeholder="Vehicle Number" className="w-full p-2 border rounded text-xs" required onChange={(e) => setNewVehicle({...newVehicle, number: e.target.value})} />
              <select className="w-full p-2 border rounded text-xs" onChange={(e) => setNewVehicle({...newVehicle, category: e.target.value})}>
                {categories.length > 0
                  ? categories.filter(c => c.status === 'Active').map(c => (
                      <option key={c.id} value={c.name}>{c.name} ({c.seatingCapacity} Seats)</option>
                    ))
                  : ['Sedan', 'SUV', 'Innova', 'Tempo Traveller', 'Mini Bus'].map(catName => (
                      <option key={catName} value={catName}>{catName}</option>
                    ))
                }
              </select>
              <input placeholder="Make" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewVehicle({...newVehicle, make: e.target.value})} />
              <input placeholder="Model" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewVehicle({...newVehicle, model: e.target.value})} />
              <input placeholder="Year" type="number" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewVehicle({...newVehicle, year: e.target.value})} />
              <input placeholder="Seating Capacity" type="number" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewVehicle({...newVehicle, seats: e.target.value})} />
              <select className="w-full p-2 border rounded text-xs" onChange={(e) => setNewVehicle({...newVehicle, fuel: e.target.value})}>
                <option>Diesel</option><option>Petrol</option><option>CNG</option><option>EV</option>
              </select>
              <button
                type="button"
                onClick={handleAddVehicle}
                className="w-full p-2.5 bg-[#E21B23] hover:bg-[#c4151c] text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow"
              >
                Register Vehicle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
