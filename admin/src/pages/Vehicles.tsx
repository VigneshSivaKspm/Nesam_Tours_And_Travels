import { useState, useEffect, useMemo } from "react";
import { Vehicle, VehicleCategory, Driver } from "../types";
import {
  subscribeVehicles,
  subscribeVehicleCategories,
  subscribeDrivers,
  updateFirestoreDocument,
  setFirestoreDocument,
  deleteFirestoreDocument,
  COLLECTIONS,
} from "../services/adminFirestoreService";

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
  const [driverList, setDriverList] = useState<Driver[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [newVehicle, setNewVehicle] = useState({
    number: "",
    category: "Sedan",
    make: "",
    model: "",
    year: "2023",
    seats: "4",
    fuel: "Diesel",
    driver: "Unassigned",
    rate: "₹12/km",
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    const unsubV = subscribeVehicles(setVehicleList);
    const unsubC = subscribeVehicleCategories(setCategories);
    const unsubD = subscribeDrivers(setDriverList);

    return () => {
      unsubV();
      unsubC();
      unsubD();
    };
  }, []);

  const handleAddVehicle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newVehicle.number.trim()) {
      alert("Vehicle Registration Number is required (e.g. TN01 AB 1234).");
      return;
    }
    const id = "VEH-" + Date.now();
    const vehicleName =
      `${newVehicle.make.trim()} ${newVehicle.model.trim()}`.trim() ||
      newVehicle.category;
    const createdVehicle: Vehicle = {
      id,
      name: vehicleName,
      number: newVehicle.number.trim().toUpperCase(),
      category: newVehicle.category,
      seats: Number(newVehicle.seats) || 4,
      driver: newVehicle.driver || "Unassigned",
      status: "Available",
      rate: newVehicle.rate.startsWith("₹") ? newVehicle.rate : `₹${newVehicle.rate}`,
      docStatus: "Approved",
      fuel: newVehicle.fuel,
    };

    setVehicleList((prev) => [createdVehicle, ...prev]);
    setShowAddModal(false);
    setNewVehicle({
      number: "",
      category: "Sedan",
      make: "",
      model: "",
      year: "2023",
      seats: "4",
      fuel: "Diesel",
      driver: "Unassigned",
      rate: "₹12/km",
    });

    try {
      await setFirestoreDocument(COLLECTIONS.VEHICLES, id, createdVehicle);
      showToast(`Vehicle ${createdVehicle.number} registered successfully!`);
    } catch (err) {
      console.warn("Error saving vehicle to Firestore:", err);
    }
  };

  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editVehicle) return;

    setVehicleList((prev) =>
      prev.map((v) => (v.id === editVehicle.id ? editVehicle : v))
    );
    const target = editVehicle;
    setEditVehicle(null);

    try {
      await setFirestoreDocument(COLLECTIONS.VEHICLES, target.id, target);
      showToast(`Vehicle ${target.number} updated successfully!`);
    } catch (err) {
      console.warn("Error updating vehicle in Firestore:", err);
    }
  };

  const handleDeleteVehicle = async (id: string, num: string) => {
    if (!confirm(`Are you sure you want to remove vehicle ${num}?`)) return;
    setVehicleList((prev) => prev.filter((v) => v.id !== id));
    try {
      await deleteFirestoreDocument(COLLECTIONS.VEHICLES, id);
      showToast(`Vehicle ${num} deleted.`);
    } catch (err) {
      console.warn("Error deleting vehicle:", err);
    }
  };

  // Filtered List
  const filteredVehicles = useMemo(() => {
    return vehicleList.filter((v) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        q === "" ||
        (v.number && v.number.toLowerCase().includes(q)) ||
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.category && v.category.toLowerCase().includes(q)) ||
        (v.driver && v.driver.toLowerCase().includes(q));
      const matchStatus =
        statusFilter === "All" || v.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [vehicleList, search, statusFilter]);

  const activeCategories = categories.filter((c) => c.status === "Active");

  return (
    <div className="p-6 space-y-5">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-18 right-6 z-50 bg-[#111] text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 border border-white/10 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Registered Vehicles",
            value: vehicleList.length.toString(),
            color: "#E21B23",
          },
          {
            label: "Available on Road",
            value: vehicleList
              .filter((v) => v.status === "Available")
              .length.toString(),
            color: "#10B981",
          },
          {
            label: "Active On Trip",
            value: vehicleList
              .filter((v) => v.status === "On Trip")
              .length.toString(),
            color: "#F59E0B",
          },
          {
            label: "Service / Maintenance",
            value: vehicleList
              .filter((v) => v.status === "Maintenance")
              .length.toString(),
            color: "#6B7280",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4"
          >
            <div className="text-[22px] font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-[11px] text-[#999] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        {/* Card Header & Controls */}
        <div className="p-4 border-b border-[#E5E5E5] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#FAFAFA]">
          <div>
            <h2 className="text-[14px] font-bold text-[#111]">
              Fleet Vehicle Directory & Compliance Verification
            </h2>
            <p className="text-[11px] text-[#888]">
              Manage physical vehicles, driver assignments, and verify RTO compliance documents.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white rounded-lg shadow-sm hover:opacity-90 active:scale-95 cursor-pointer transition-all"
              style={{ background: "#E21B23" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Register Vehicle
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="px-4 py-3 border-b border-[#EBEBEB] flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by vehicle number, model, driver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23]"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            {["All", "Available", "On Trip", "Maintenance"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  statusFilter === st
                    ? "bg-[#111] text-white"
                    : "bg-[#F5F5F5] text-[#666] hover:bg-[#EBEBEB]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                {[
                  "Vehicle",
                  "Number",
                  "Category",
                  "Seats",
                  "Compliance Documents",
                  "Assigned Driver",
                  "Status",
                  "Rate",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] font-semibold text-[#888] uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((v) => (
                <tr
                  key={v.id}
                  className="table-row border-b border-[#F5F5F5] hover:bg-gray-50/60 last:border-0 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#FEF2F2] flex items-center justify-center shrink-0">
                        <svg
                          className="w-5 h-5 text-[#E21B23]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="text-[12px] font-bold text-[#111]">
                          {v.name}
                        </div>
                        <div className="text-[10px] text-[#999] font-mono">
                          {v.fuel ? `${v.fuel} • ` : ""}
                          {v.id}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-[12px] font-mono font-bold text-[#111]">
                    {v.number}
                  </td>

                  <td className="px-4 py-3 text-[12px] text-[#444] font-medium">
                    {v.category}
                  </td>

                  <td className="px-4 py-3 text-[12px] font-semibold text-[#111] text-center">
                    {v.seats}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                        RC: Verified
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        Ins: Active
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        FC: Valid
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        Permit: All India
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-[12px] text-[#333] font-medium">
                    {v.driver && v.driver !== "Unassigned" ? (
                      <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                        {v.driver}
                      </span>
                    ) : (
                      <span className="text-[#999] italic">Unassigned</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusStyle[v.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}
                    >
                      {v.status}
                    </span>
                  </td>

                  <td
                    className="px-4 py-3 text-[12px] font-bold"
                    style={{ color: "#E21B23" }}
                  >
                    {v.rate || "₹12/km"}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedVehicle(v)}
                        className="text-[11px] px-2.5 py-1 rounded-md border border-[#E5E5E5] hover:bg-[#FEF2F2] text-[#E21B23] font-semibold transition-colors cursor-pointer"
                        title="Audit compliance documents"
                      >
                        Audit
                      </button>
                      <button
                        onClick={() => setEditVehicle({ ...v })}
                        className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] hover:bg-gray-100 text-[#444] font-medium transition-colors cursor-pointer"
                        title="Edit Vehicle"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(v.id, v.number)}
                        className="text-[11px] px-1.5 py-1 rounded-md text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Remove vehicle"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredVehicles.length === 0 && (
            <div className="py-14 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2 text-gray-400">
                🚗
              </div>
              <p className="text-[13px] font-semibold text-gray-800">
                No vehicles found
              </p>
              <p className="text-[11px] text-gray-500 mb-4">
                {search || statusFilter !== "All"
                  ? "Try adjusting your search query or filters"
                  : "Register the first vehicle to get started"}
              </p>
              {!search && statusFilter === "All" && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-[#E21B23] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                >
                  Register Vehicle
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Compliance Verification Audit Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Vehicle Compliance Audit
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  {selectedVehicle.number} • {selectedVehicle.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedVehicle(null)}
                className="text-gray-400 hover:text-gray-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 block">
                    Registration Certificate (RC)
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    State: Tamil Nadu RTO • Reg: Valid
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  ✓ Verified
                </span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 block">
                    Commercial Vehicle Insurance
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    Comprehensive Policy • Active till Dec 2026
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  ✓ Active
                </span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 block">
                    Fitness Certificate (FC)
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    Commercial FC Valid till Oct 2027
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  ✓ Valid
                </span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 block">
                    State & All India Tourist Permit
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    Permit No: TN-PERM-99482
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  ✓ All India
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-gray-100 pt-3">
              <span className="text-[11px] text-gray-500">
                Status: <strong className="text-gray-800">{selectedVehicle.status}</strong>
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedVehicle(null)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={async () => {
                    await updateFirestoreDocument(
                      COLLECTIONS.VEHICLES,
                      selectedVehicle.id,
                      { docStatus: "Approved", status: "Available" }
                    );
                    setVehicleList((prev) =>
                      prev.map((v) =>
                        v.id === selectedVehicle.id
                          ? { ...v, docStatus: "Approved", status: "Available" }
                          : v
                      )
                    );
                    showToast(`Vehicle ${selectedVehicle.number} approved for road trips!`);
                    setSelectedVehicle(null);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer transition-colors"
                >
                  Approve for Road
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Vehicle Modal */}
      {editVehicle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                Edit Vehicle: {editVehicle.number}
              </h3>
              <button
                onClick={() => setEditVehicle(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Vehicle Name / Model
                </label>
                <input
                  value={editVehicle.name}
                  onChange={(e) =>
                    setEditVehicle({ ...editVehicle, name: e.target.value })
                  }
                  className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Category
                  </label>
                  <select
                    value={editVehicle.category}
                    onChange={(e) =>
                      setEditVehicle({
                        ...editVehicle,
                        category: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                  >
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Status
                  </label>
                  <select
                    value={editVehicle.status}
                    onChange={(e) =>
                      setEditVehicle({ ...editVehicle, status: e.target.value })
                    }
                    className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                  >
                    <option value="Available">Available</option>
                    <option value="On Trip">On Trip</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Reserved">Reserved</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Seating Capacity
                  </label>
                  <input
                    type="number"
                    value={editVehicle.seats}
                    onChange={(e) =>
                      setEditVehicle({
                        ...editVehicle,
                        seats: Number(e.target.value),
                      })
                    }
                    className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Base Rate per KM
                  </label>
                  <input
                    value={editVehicle.rate}
                    onChange={(e) =>
                      setEditVehicle({ ...editVehicle, rate: e.target.value })
                    }
                    placeholder="₹14/km"
                    className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Assigned Driver
                </label>
                <select
                  value={editVehicle.driver || "Unassigned"}
                  onChange={(e) =>
                    setEditVehicle({ ...editVehicle, driver: e.target.value })
                  }
                  className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                >
                  <option value="Unassigned">Unassigned (Fleet Pool)</option>
                  {driverList.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} ({d.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditVehicle(null)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-5 py-2 bg-[#E21B23] hover:bg-[#c4151c] text-white text-xs font-bold rounded-xl cursor-pointer shadow"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                Register New Fleet Vehicle
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Registration Number *
                </label>
                <input
                  placeholder="e.g. TN01 AB 1234"
                  className="w-full p-2 border border-gray-200 rounded-lg text-xs font-mono uppercase"
                  value={newVehicle.number}
                  onChange={(e) =>
                    setNewVehicle({ ...newVehicle, number: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Category
                  </label>
                  <select
                    className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                    value={newVehicle.category}
                    onChange={(e) =>
                      setNewVehicle({
                        ...newVehicle,
                        category: e.target.value,
                      })
                    }
                  >
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({c.seatingCapacity} Seats)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Fuel Type
                  </label>
                  <select
                    className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                    value={newVehicle.fuel}
                    onChange={(e) =>
                      setNewVehicle({ ...newVehicle, fuel: e.target.value })
                    }
                  >
                    <option>Diesel</option>
                    <option>Petrol</option>
                    <option>CNG</option>
                    <option>Electric (EV)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Make
                  </label>
                  <input
                    placeholder="e.g. Toyota"
                    className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                    value={newVehicle.make}
                    onChange={(e) =>
                      setNewVehicle({ ...newVehicle, make: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Model
                  </label>
                  <input
                    placeholder="e.g. Innova Crysta"
                    className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                    value={newVehicle.model}
                    onChange={(e) =>
                      setNewVehicle({ ...newVehicle, model: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Seating Capacity
                  </label>
                  <input
                    placeholder="4"
                    type="number"
                    className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                    value={newVehicle.seats}
                    onChange={(e) =>
                      setNewVehicle({ ...newVehicle, seats: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Per KM Rate
                  </label>
                  <input
                    placeholder="₹14/km"
                    className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                    value={newVehicle.rate}
                    onChange={(e) =>
                      setNewVehicle({ ...newVehicle, rate: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Assign Driver (Optional)
                </label>
                <select
                  className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                  value={newVehicle.driver}
                  onChange={(e) =>
                    setNewVehicle({ ...newVehicle, driver: e.target.value })
                  }
                >
                  <option value="Unassigned">Unassigned (Assign Later)</option>
                  {driverList.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} ({d.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAddVehicle}
                  className="w-full p-2.5 bg-[#E21B23] hover:bg-[#c4151c] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow"
                >
                  Register Vehicle to Fleet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
