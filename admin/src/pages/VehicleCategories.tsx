import { useState, useEffect } from "react";
import { VehicleCategory, Vehicle } from "../types";
import {
  subscribeVehicleCategories,
  subscribeVehicles,
  setFirestoreDocument,
  deleteFirestoreDocument,
  COLLECTIONS,
} from "../services/adminFirestoreService";

const PRESET_TEMPLATES = [
  {
    name: "Sedan",
    code: "SEDAN",
    description: "Comfortable 4-seater AC sedan ideal for airport transfers, city rides, and short outstation trips.",
    icon: "🚘",
    seatingCapacity: 4,
    luggageCapacity: "2 Large Bags",
    acSupported: "Both",
    recommendedPassengers: 4,
    displayOrder: 1,
    fare: {
      baseFare: 350,
      baseKm: 10,
      perKmRate: 12,
      minimumFare: 350,
      driverAllowance: 250,
      nightAllowance: 150,
      waitingChargePerHour: 80,
      extraHourCharge: 100,
      extraKmCharge: 12,
      tollIncluded: false,
      parkingIncluded: false,
      permitCharge: 0,
      outstationPerKmRate: 14,
      outstationDriverBattaPerDay: 300,
      outstationMinKmPerDay: 250,
    },
  },
  {
    name: "SUV",
    code: "SUV",
    description: "Spacious 6-7 seater SUV suitable for family trips, outstation travel, and hilly terrains.",
    icon: "🚙",
    seatingCapacity: 6,
    luggageCapacity: "3 Large Bags",
    acSupported: "AC",
    recommendedPassengers: 6,
    displayOrder: 2,
    fare: {
      baseFare: 450,
      baseKm: 10,
      perKmRate: 16,
      minimumFare: 450,
      driverAllowance: 350,
      nightAllowance: 200,
      waitingChargePerHour: 100,
      extraHourCharge: 120,
      extraKmCharge: 16,
      tollIncluded: false,
      parkingIncluded: false,
      permitCharge: 0,
      outstationPerKmRate: 18,
      outstationDriverBattaPerDay: 400,
      outstationMinKmPerDay: 250,
    },
  },
  {
    name: "Innova",
    code: "INNOVA",
    description: "Premium 7-seater MPV with superior ride comfort, dual AC, and high reliability.",
    icon: "🚐",
    seatingCapacity: 7,
    luggageCapacity: "4 Bags",
    acSupported: "AC",
    recommendedPassengers: 7,
    displayOrder: 3,
    fare: {
      baseFare: 550,
      baseKm: 10,
      perKmRate: 18,
      minimumFare: 550,
      driverAllowance: 400,
      nightAllowance: 250,
      waitingChargePerHour: 120,
      extraHourCharge: 150,
      extraKmCharge: 18,
      tollIncluded: false,
      parkingIncluded: false,
      permitCharge: 0,
      outstationPerKmRate: 20,
      outstationDriverBattaPerDay: 450,
      outstationMinKmPerDay: 300,
    },
  },
  {
    name: "Innova Crysta",
    code: "CRYSTA",
    description: "Luxury 7-seater Innova Crysta offering executive comfort, captain seats, and plush interiors.",
    icon: "🚐",
    seatingCapacity: 7,
    luggageCapacity: "4 Large Bags",
    acSupported: "AC",
    recommendedPassengers: 6,
    displayOrder: 4,
    fare: {
      baseFare: 700,
      baseKm: 10,
      perKmRate: 21,
      minimumFare: 700,
      driverAllowance: 500,
      nightAllowance: 300,
      waitingChargePerHour: 150,
      extraHourCharge: 200,
      extraKmCharge: 21,
      tollIncluded: false,
      parkingIncluded: false,
      permitCharge: 0,
      outstationPerKmRate: 23,
      outstationDriverBattaPerDay: 500,
      outstationMinKmPerDay: 300,
    },
  },
  {
    name: "Tempo Traveller",
    code: "TEMPO",
    description: "12 to 18-seater pushback seating vehicle tailored for group tours and corporate events.",
    icon: "🚌",
    seatingCapacity: 12,
    luggageCapacity: "8 Bags",
    acSupported: "Both",
    recommendedPassengers: 12,
    displayOrder: 5,
    fare: {
      baseFare: 1200,
      baseKm: 10,
      perKmRate: 26,
      minimumFare: 1200,
      driverAllowance: 600,
      nightAllowance: 350,
      waitingChargePerHour: 200,
      extraHourCharge: 250,
      extraKmCharge: 26,
      tollIncluded: false,
      parkingIncluded: false,
      permitCharge: 0,
      outstationPerKmRate: 28,
      outstationDriverBattaPerDay: 600,
      outstationMinKmPerDay: 300,
    },
  },
];

const defaultFormState = {
  id: "",
  name: "",
  code: "",
  description: "",
  imageUrl: "",
  icon: "🚘",
  seatingCapacity: 4,
  luggageCapacity: "2 Bags" as string | number,
  acSupported: "Both" as const,
  recommendedPassengers: 4,
  displayOrder: 1,
  status: "Active" as "Active" | "Inactive",
  fare: {
    baseFare: 350,
    baseKm: 10,
    perKmRate: 12,
    minimumFare: 350,
    driverAllowance: 250,
    nightAllowance: 150,
    waitingChargePerHour: 80,
    extraHourCharge: 100,
    extraKmCharge: 12,
    tollIncluded: false,
    parkingIncluded: false,
    permitCharge: 0,
    outstationPerKmRate: 14,
    outstationDriverBattaPerDay: 300,
    outstationMinKmPerDay: 250,
  },
};

export default function VehicleCategories() {
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [sortBy, setSortBy] = useState<"name" | "order" | "seats" | "created">("order");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(defaultFormState);
  const [activeTab, setActiveTab] = useState<"basic" | "specs" | "fare" | "outstation">("basic");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<VehicleCategory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const unsubCats = subscribeVehicleCategories((data) => {
      setCategories(data);
      setLoading(false);
    });
    const unsubVehicles = subscribeVehicles((data) => {
      setVehicles(data);
    });
    return () => {
      unsubCats();
      unsubVehicles();
    };
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Compute Vehicle Count per Category
  const getVehicleCountForCategory = (cat: VehicleCategory) => {
    return vehicles.filter((v) => {
      const cName = (v.category || "").trim().toLowerCase();
      return (
        cName === cat.name.trim().toLowerCase() ||
        cName === (cat.code || "").trim().toLowerCase() ||
        cName === cat.id.toLowerCase()
      );
    }).length;
  };

  // Filtered & Sorted Categories
  const filteredCategories = categories
    .filter((cat) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        q === "" ||
        cat.name.toLowerCase().includes(q) ||
        (cat.code && cat.code.toLowerCase().includes(q)) ||
        (cat.description && cat.description.toLowerCase().includes(q));
      const matchStatus = statusFilter === "All" || cat.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "seats") return b.seatingCapacity - a.seatingCapacity;
      if (sortBy === "order") return (a.displayOrder || 99) - (b.displayOrder || 99);
      return 0;
    });

  // Modal actions
  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData(defaultFormState);
    setActiveTab("basic");
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (cat: VehicleCategory) => {
    setIsEditing(true);
    setFormData({
      id: cat.id,
      name: cat.name,
      code: cat.code || "",
      description: cat.description || "",
      imageUrl: cat.imageUrl || "",
      icon: cat.icon || "🚘",
      seatingCapacity: cat.seatingCapacity || 4,
      luggageCapacity: cat.luggageCapacity || "2 Bags",
      acSupported: (cat.acSupported as any) || "Both",
      recommendedPassengers: cat.recommendedPassengers || cat.seatingCapacity || 4,
      displayOrder: cat.displayOrder || 1,
      status: cat.status || "Active",
      fare: {
        baseFare: cat.fare?.baseFare ?? 350,
        baseKm: cat.fare?.baseKm ?? 10,
        perKmRate: cat.fare?.perKmRate ?? 12,
        minimumFare: cat.fare?.minimumFare ?? 350,
        driverAllowance: cat.fare?.driverAllowance ?? 250,
        nightAllowance: cat.fare?.nightAllowance ?? 150,
        waitingChargePerHour: cat.fare?.waitingChargePerHour ?? 80,
        extraHourCharge: cat.fare?.extraHourCharge ?? 100,
        extraKmCharge: cat.fare?.extraKmCharge ?? 12,
        tollIncluded: Boolean(cat.fare?.tollIncluded),
        parkingIncluded: Boolean(cat.fare?.parkingIncluded),
        permitCharge: cat.fare?.permitCharge ?? 0,
        outstationPerKmRate: cat.fare?.outstationPerKmRate ?? 14,
        outstationDriverBattaPerDay: cat.fare?.outstationDriverBattaPerDay ?? 300,
        outstationMinKmPerDay: cat.fare?.outstationMinKmPerDay ?? 250,
      },
    });
    setActiveTab("basic");
    setFormError(null);
    setShowModal(true);
  };

  const handleApplyPreset = (templateName: string) => {
    const tmpl = PRESET_TEMPLATES.find((t) => t.name === templateName);
    if (!tmpl) return;
    setFormData((prev) => ({
      ...prev,
      name: tmpl.name,
      code: tmpl.code,
      description: tmpl.description,
      icon: tmpl.icon,
      seatingCapacity: tmpl.seatingCapacity,
      luggageCapacity: tmpl.luggageCapacity,
      acSupported: tmpl.acSupported as any,
      recommendedPassengers: tmpl.recommendedPassengers,
      displayOrder: tmpl.displayOrder,
      fare: { ...tmpl.fare },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formData.name.trim();
    if (!name) {
      setFormError("Category Name is required.");
      setActiveTab("basic");
      return;
    }
    if (formData.seatingCapacity <= 0 || isNaN(formData.seatingCapacity)) {
      setFormError("Seating capacity must be a valid positive number.");
      setActiveTab("specs");
      return;
    }

    // Check duplicate name or code
    const normalizedName = name.toLowerCase();
    const code = (formData.code || name).toUpperCase().replace(/\s+/g, "_");
    const duplicate = categories.find(
      (c) =>
        c.id !== formData.id &&
        (c.name.trim().toLowerCase() === normalizedName || (c.code && c.code.toUpperCase() === code))
    );

    if (duplicate) {
      setFormError(`A category with name "${name}" or code "${code}" already exists.`);
      setActiveTab("basic");
      return;
    }

    setSaving(true);
    try {
      const docId = formData.id ? formData.id : `CAT-${code.substring(0, 10)}`;
      const payload: VehicleCategory = {
        id: docId,
        name,
        code,
        description: formData.description.trim(),
        imageUrl: formData.imageUrl.trim(),
        icon: formData.icon,
        seatingCapacity: Number(formData.seatingCapacity),
        luggageCapacity: formData.luggageCapacity,
        acSupported: formData.acSupported,
        recommendedPassengers: Number(formData.recommendedPassengers),
        displayOrder: Number(formData.displayOrder || 1),
        status: formData.status,
        fare: {
          baseFare: Number(formData.fare.baseFare || 0),
          baseKm: Number(formData.fare.baseKm || 0),
          perKmRate: Number(formData.fare.perKmRate || 0),
          minimumFare: Number(formData.fare.minimumFare || 0),
          driverAllowance: Number(formData.fare.driverAllowance || 0),
          nightAllowance: Number(formData.fare.nightAllowance || 0),
          waitingChargePerHour: Number(formData.fare.waitingChargePerHour || 0),
          extraHourCharge: Number(formData.fare.extraHourCharge || 0),
          extraKmCharge: Number(formData.fare.extraKmCharge || 0),
          tollIncluded: Boolean(formData.fare.tollIncluded),
          parkingIncluded: Boolean(formData.fare.parkingIncluded),
          permitCharge: Number(formData.fare.permitCharge || 0),
          outstationPerKmRate: Number(formData.fare.outstationPerKmRate || 0),
          outstationDriverBattaPerDay: Number(formData.fare.outstationDriverBattaPerDay || 0),
          outstationMinKmPerDay: Number(formData.fare.outstationMinKmPerDay || 0),
        },
      };

      const ok = await setFirestoreDocument(COLLECTIONS.VEHICLE_CATEGORIES, docId, payload);
      if (ok) {
        if (isEditing) {
          setCategories((prev) => prev.map((c) => (c.id === docId ? payload : c)));
        } else {
          setCategories((prev) => [payload, ...prev]);
        }
        setShowModal(false);
        showToast(
          isEditing
            ? `Vehicle category "${name}" updated successfully.`
            : `Vehicle category "${name}" created successfully.`,
          "success"
        );
      } else {
        setFormError("Failed to save vehicle category to database. Please try again.");
      }
    } catch (err: any) {
      console.error("Error saving vehicle category:", err);
      setFormError(err.message || "An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  // Toggle status
  const handleToggleStatus = async (cat: VehicleCategory) => {
    const newStatus = cat.status === "Active" ? "Inactive" : "Active";
    const ok = await setFirestoreDocument(COLLECTIONS.VEHICLE_CATEGORIES, cat.id, {
      ...cat,
      status: newStatus,
    });
    if (ok) {
      showToast(`Category "${cat.name}" marked as ${newStatus}.`, "success");
    } else {
      showToast(`Failed to update status for "${cat.name}".`, "error");
    }
  };

  // Delete handling
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    const vehicleCount = getVehicleCountForCategory(deleteTarget);
    if (vehicleCount > 0) {
      setDeleteError(
        `Cannot delete category "${deleteTarget.name}" because ${vehicleCount} registered vehicle(s) are currently assigned to it. Please deactivate the category or reassign the vehicles first.`
      );
      setDeleting(false);
      return;
    }

    try {
      const ok = await deleteFirestoreDocument(COLLECTIONS.VEHICLE_CATEGORIES, deleteTarget.id);
      if (ok) {
        setDeleteTarget(null);
        showToast(`Vehicle category "${deleteTarget.name}" removed successfully.`, "success");
      } else {
        setDeleteError("Failed to delete category from database.");
      }
    } catch (err: any) {
      console.error("Delete category error:", err);
      setDeleteError(err.message || "An error occurred during deletion.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold text-white transition-all ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          <span>{toast.type === "success" ? "✓" : "⚠️"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Action Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[#111111]">Vehicle Categories</h1>
          <p className="text-[13px] text-[#666666]">
            Configure fleet vehicle types, seating capacities, and default fare calculation rules.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-white rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          style={{ background: "#E21B23" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          + Add Vehicle Category
        </button>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Categories",
            value: categories.length.toString(),
            color: "#E21B23",
            sub: "Configured types",
          },
          {
            label: "Active Categories",
            value: categories.filter((c) => c.status === "Active").length.toString(),
            color: "#10B981",
            sub: "Available for booking",
          },
          {
            label: "Inactive Categories",
            value: categories.filter((c) => c.status === "Inactive").length.toString(),
            color: "#6B7280",
            sub: "Hidden from customers",
          },
          {
            label: "Total Vehicles",
            value: vehicles.length.toString(),
            color: "#3B82F6",
            sub: "Registered fleet",
          },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
            <div className="text-[24px] font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-[12px] font-semibold text-[#111111] mt-0.5">{s.label}</div>
            <div className="text-[10px] text-[#999999]">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-12 text-center text-[13px] text-[#999999]">
          Loading vehicle categories...
        </div>
      ) : categories.length === 0 ? (
        /* Empty State Placeholder */
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#FEF2F2" }}>
            <svg
              className="w-8 h-8"
              style={{ color: "#E21B23" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z"
              />
            </svg>
          </div>
          <h2 className="text-[18px] font-bold text-[#111111] mb-2">Vehicle Categories</h2>
          <p className="text-[13px] text-[#999999] max-w-sm mb-6">
            Manage vehicle categories including Sedan, SUV, Innova, Tempo Traveller and configure fare rules per category.
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-6 py-2.5 text-[13px] font-semibold text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            style={{ background: "#E21B23" }}
          >
            Get Started
          </button>
        </div>
      ) : (
        /* Category Directory Table & Controls */
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3 bg-[#FAFAFA]">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search category name, code..."
                className="w-full pl-9 pr-4 py-2 text-[12px] bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] placeholder-[#999999]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#666666] font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#E21B23] text-[#444444]"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <span className="text-[11px] text-[#666666] font-medium ml-2">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#E21B23] text-[#444444]"
              >
                <option value="order">Display Order</option>
                <option value="name">Category Name</option>
                <option value="seats">Seating Capacity</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Category
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Seating & Luggage
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Base Fare
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Per KM Rate
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Driver Batta
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Vehicles
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[12px] text-[#999999]">
                      No vehicle categories match your search filters.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((cat) => {
                    const vehicleCount = getVehicleCountForCategory(cat);
                    return (
                      <tr key={cat.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA] transition-colors">
                        {/* Category Name & Code */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center text-[20px] shrink-0 border border-[#FEE2E2]">
                              {cat.imageUrl ? (
                                <img
                                  src={cat.imageUrl}
                                  alt={cat.name}
                                  className="w-full h-full object-cover rounded-xl"
                                  onError={(e) => {
                                    (e.target as any).style.display = "none";
                                  }}
                                />
                              ) : (
                                cat.icon || "🚘"
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-bold text-[#111111]">{cat.name}</span>
                                {cat.code && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-bold uppercase">
                                    {cat.code}
                                  </span>
                                )}
                              </div>
                              {cat.description && (
                                <div className="text-[11px] text-[#888888] line-clamp-1 max-w-xs">
                                  {cat.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Seating */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="text-[12px] font-bold text-[#111111]">
                            {cat.seatingCapacity} Seats
                          </div>
                          <div className="text-[10px] text-[#999999]">
                            {cat.luggageCapacity || "Standard"} • {cat.acSupported || "AC"}
                          </div>
                        </td>

                        {/* Base Fare */}
                        <td className="px-4 py-3.5">
                          <div className="text-[12px] font-bold text-[#E21B23]">
                            ₹{cat.fare?.baseFare ?? 0}
                          </div>
                          <div className="text-[10px] text-[#888888]">
                            Min {cat.fare?.baseKm ?? 10} km
                          </div>
                        </td>

                        {/* Per KM */}
                        <td className="px-4 py-3.5">
                          <div className="text-[12px] font-semibold text-[#111111]">
                            ₹{cat.fare?.perKmRate ?? 0} <span className="text-[10px] font-normal text-[#888888]">/ km</span>
                          </div>
                          {cat.fare?.outstationPerKmRate ? (
                            <div className="text-[10px] text-[#888888]">
                              Outstation: ₹{cat.fare.outstationPerKmRate}/km
                            </div>
                          ) : null}
                        </td>

                        {/* Driver Batta */}
                        <td className="px-4 py-3.5">
                          <div className="text-[12px] font-medium text-[#444444]">
                            ₹{cat.fare?.driverAllowance ?? 0}
                          </div>
                          <div className="text-[10px] text-[#999999]">Per day / trip</div>
                        </td>

                        {/* Vehicle Count */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {vehicleCount} {vehicleCount === 1 ? "Vehicle" : "Vehicles"}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              cat.status === "Active"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-gray-100 text-gray-600 border-gray-200"
                            }`}
                          >
                            {cat.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(cat)}
                              className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-[#E5E5E5] text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleStatus(cat)}
                              className={`px-2 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                                cat.status === "Active"
                                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {cat.status === "Active" ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              onClick={() => setDeleteTarget(cat)}
                              className="px-2 py-1 text-[11px] font-medium rounded-lg border border-red-200 bg-red-50 text-[#E21B23] hover:bg-red-100 transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#FAFAFA]">
              <div>
                <h3 className="text-[16px] font-bold text-[#111111]">
                  {isEditing ? "Edit Vehicle Category" : "+ Add Vehicle Category"}
                </h3>
                <p className="text-[11px] text-[#666666]">
                  Configure category details, passenger capacity, and fare rules.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {!isEditing && (
                  <select
                    onChange={(e) => handleApplyPreset(e.target.value)}
                    defaultValue=""
                    className="px-2.5 py-1 text-[11px] border border-[#E5E5E5] rounded-lg bg-white text-gray-700 focus:outline-none focus:border-[#E21B23]"
                  >
                    <option value="" disabled>
                      Auto-fill Template...
                    </option>
                    {PRESET_TEMPLATES.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.seatingCapacity} Seats)
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-[#E5E5E5] bg-[#F5F5F5] px-6 pt-2">
              {[
                { id: "basic", label: "Category Info" },
                { id: "specs", label: "Vehicle Specs" },
                { id: "fare", label: "Local Fare Rules" },
                { id: "outstation", label: "Outstation & Extra Charges" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 text-[12px] font-semibold border-b-2 transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? "border-[#E21B23] text-[#E21B23] bg-white rounded-t-lg"
                      : "border-transparent text-[#666666] hover:text-[#111111]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Form Form Container */}
            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                    ⚠️ {formError}
                  </div>
                )}

                {/* TAB 1: BASIC INFO */}
                {activeTab === "basic" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Category Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Sedan, SUV, Innova"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Category Code
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. SEDAN, SUV, INNOVA"
                          value={formData.code}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] font-mono focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#111111] mb-1">Description</label>
                      <textarea
                        rows={2}
                        placeholder="Brief overview of vehicle category for customers and admin display..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Icon Emoji
                        </label>
                        <select
                          value={formData.icon}
                          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        >
                          <option value="🚘">🚘 Sedan (Dzire / Etios)</option>
                          <option value="🚙">🚙 SUV (Ertiga / Harrier)</option>
                          <option value="🚐">🚐 Innova / Crysta</option>
                          <option value="🚌">🚌 Tempo Traveller</option>
                          <option value="🚕">🚕 Hatchback / Mini</option>
                          <option value="✨">✨ Luxury Class</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Image URL (Optional)
                        </label>
                        <input
                          type="url"
                          placeholder="https://example.com/sedan.png"
                          value={formData.imageUrl}
                          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">Status</label>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        >
                          <option value="Active">Active (Selectable)</option>
                          <option value="Inactive">Inactive (Hidden)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: SPECS */}
                {activeTab === "specs" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Seating Capacity *
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          required
                          value={formData.seatingCapacity}
                          onChange={(e) =>
                            setFormData({ ...formData, seatingCapacity: parseInt(e.target.value) || 0 })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Recommended Passengers
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={formData.recommendedPassengers}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              recommendedPassengers: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Luggage Capacity
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 2 Large Bags"
                          value={formData.luggageCapacity}
                          onChange={(e) => setFormData({ ...formData, luggageCapacity: e.target.value })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          AC Support
                        </label>
                        <select
                          value={formData.acSupported}
                          onChange={(e) => setFormData({ ...formData, acSupported: e.target.value as any })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        >
                          <option value="AC">AC Only</option>
                          <option value="Non-AC">Non-AC Only</option>
                          <option value="Both">Both AC / Non-AC</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Display Order
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={formData.displayOrder}
                          onChange={(e) =>
                            setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 1 })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: LOCAL FARE */}
                {activeTab === "fare" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Base Fare (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.fare.baseFare}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fare: { ...formData.fare, baseFare: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Base KM / Minimum KM
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.fare.baseKm}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fare: { ...formData.fare, baseKm: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Per KM Rate (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.fare.perKmRate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fare: { ...formData.fare, perKmRate: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Driver Allowance (Batta) (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.fare.driverAllowance}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fare: { ...formData.fare, driverAllowance: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Night Allowance (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.fare.nightAllowance}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fare: { ...formData.fare, nightAllowance: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Minimum Fare (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.fare.minimumFare}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fare: { ...formData.fare, minimumFare: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: OUTSTATION & EXTRAS */}
                {activeTab === "outstation" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Outstation Per KM Rate (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.fare.outstationPerKmRate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fare: {
                                ...formData.fare,
                                outstationPerKmRate: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Outstation Driver Batta / Day (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.fare.outstationDriverBattaPerDay}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fare: {
                                ...formData.fare,
                                outstationDriverBattaPerDay: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Waiting Charge / Hour (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.fare.waitingChargePerHour}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fare: {
                                ...formData.fare,
                                waitingChargePerHour: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Extra Hour Charge (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.fare.extraHourCharge}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fare: {
                                ...formData.fare,
                                extraHourCharge: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Extra KM Charge (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.fare.extraKmCharge}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fare: {
                                ...formData.fare,
                                extraKmCharge: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Permit Charge (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.fare.permitCharge}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fare: { ...formData.fare, permitCharge: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-[#E5E5E5]">
                        <input
                          type="checkbox"
                          id="tollInc"
                          checked={formData.fare.tollIncluded}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fare: { ...formData.fare, tollIncluded: e.target.checked },
                            })
                          }
                          className="w-4 h-4 accent-[#E21B23]"
                        />
                        <label htmlFor="tollInc" className="text-[12px] font-semibold text-[#111111]">
                          Toll Included in Base Fare
                        </label>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-[#E5E5E5]">
                        <input
                          type="checkbox"
                          id="parkInc"
                          checked={formData.fare.parkingIncluded}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fare: { ...formData.fare, parkingIncluded: e.target.checked },
                            })
                          }
                          className="w-4 h-4 accent-[#E21B23]"
                        />
                        <label htmlFor="parkInc" className="text-[12px] font-semibold text-[#111111]">
                          Parking Included in Base Fare
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-[#E5E5E5] flex items-center justify-between bg-[#FAFAFA]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-[#E5E5E5] rounded-lg text-[12px] font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 text-[13px] font-semibold text-white rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  style={{ background: "#E21B23" }}
                >
                  {saving && (
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  )}
                  {saving
                    ? "Saving..."
                    : isEditing
                    ? "Update Vehicle Category"
                    : "Save Vehicle Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center font-bold text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Delete Vehicle Category?</h3>
                <p className="text-xs text-gray-500 font-mono">{deleteTarget.name} ({deleteTarget.code})</p>
              </div>
            </div>

            <p className="text-xs text-gray-600">
              Are you sure you want to permanently remove this vehicle category? This action cannot be undone.
            </p>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
