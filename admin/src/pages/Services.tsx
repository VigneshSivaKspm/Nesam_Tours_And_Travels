import { useState, useEffect, useMemo } from "react";
import { TravelService, VehicleCategory, Booking } from "../types";
import {
  subscribeServices,
  subscribeVehicleCategories,
  subscribeBookings,
  setFirestoreDocument,
  deleteFirestoreDocument,
  COLLECTIONS,
} from "../services/adminFirestoreService";

const PRESET_SERVICE_TEMPLATES = [
  {
    name: "Airport Taxi",
    code: "AIRPORT_TAXI",
    slug: "airport-taxi",
    serviceType: "Airport Taxi",
    shortDescription: "Reliable airport pickups and drops with guaranteed on-time driver arrival.",
    fullDescription: "Dedicated airport taxi service offering hassle-free transfers to and from airports across Tamil Nadu. Features flight tracking, driver meet & greet, and baggage assistance.",
    icon: "✈️",
    displayOrder: 1,
    featured: true,
    onlineBookingEnabled: true,
    adminBookingEnabled: true,
    airportOptions: { airportPickup: true, airportDrop: true },
    seoTitle: "Book Airport Taxi in Tamil Nadu | Nesam Tours & Travels",
    seoDescription: "Book affordable airport cabs with transparent pricing and 24/7 customer support.",
  },
  {
    name: "Outstation Cab",
    code: "OUTSTATION_CAB",
    slug: "outstation-cab",
    serviceType: "Outstation Cab",
    shortDescription: "Intercity outstation rides for one-way and round trips with experienced drivers.",
    fullDescription: "Comfortable long-distance outstation travel covering all major cities, tourist destinations, and pilgrimage spots. Transparent per-km rates with driver batta.",
    icon: "🗺️",
    displayOrder: 2,
    featured: true,
    onlineBookingEnabled: true,
    adminBookingEnabled: true,
    outstationOptions: { oneWayAllowed: true, roundTripAllowed: true },
    seoTitle: "Outstation Cab Service | One Way & Round Trip Cabs",
    seoDescription: "Book outstation cabs with top-rated drivers and all-India tourist permit vehicles.",
  },
  {
    name: "One Way Taxi",
    code: "ONE_WAY_TAXI",
    slug: "one-way-taxi",
    serviceType: "One Way Taxi",
    shortDescription: "Pay for one way only for drop rides across major city routes.",
    fullDescription: "Economical one-way drop taxi service between cities. Pay only for the distance traveled one way without return fare charges.",
    icon: "🚕",
    displayOrder: 3,
    featured: true,
    onlineBookingEnabled: true,
    adminBookingEnabled: true,
    outstationOptions: { oneWayAllowed: true, roundTripAllowed: false },
    seoTitle: "One Way Drop Taxi Service | Pay Only One-Way",
    seoDescription: "Save up to 50% on intercity rides with Nesam One Way Taxi service.",
  },
  {
    name: "Local Rental",
    code: "LOCAL_RENTAL",
    slug: "local-rental",
    serviceType: "Local Rental",
    shortDescription: "Flexible hourly rental packages (4hr/40km, 8hr/80km, 12hr/120km) for city travel.",
    fullDescription: "Chauffeur-driven hourly cab rentals for business meetings, shopping, sightseeing, and multi-stop city errands.",
    icon: "⏱️",
    displayOrder: 4,
    featured: false,
    onlineBookingEnabled: true,
    adminBookingEnabled: true,
    seoTitle: "Hourly Local Cab Rental | 4Hr, 8Hr & 12Hr Packages",
    seoDescription: "Rent a car with driver in Chennai and major cities for local hourly usage.",
  },
  {
    name: "Corporate Travel",
    code: "CORPORATE_TRAVEL",
    slug: "corporate-travel",
    serviceType: "Corporate Travel",
    shortDescription: "Executive employee transportation, VIP client transfers, and corporate billing.",
    fullDescription: "Custom corporate travel solutions featuring monthly invoicing, GST compliance, priority fleet allocation, and dedicated account management.",
    icon: "💼",
    displayOrder: 5,
    featured: false,
    onlineBookingEnabled: false,
    adminBookingEnabled: true,
    seoTitle: "Corporate Taxi & Employee Transport Solutions",
    seoDescription: "Streamlined corporate cab rentals and executive fleet management.",
  },
  {
    name: "Recurring Transport",
    code: "RECURRING_TRANSPORT",
    slug: "recurring-transport",
    serviceType: "Recurring Transport",
    shortDescription: "Scheduled daily or weekly commute services for staff and recurring clients.",
    fullDescription: "Automated recurring bookings for daily office commute, school runs, and fixed routine transportation.",
    icon: "🔄",
    displayOrder: 6,
    featured: false,
    onlineBookingEnabled: false,
    adminBookingEnabled: true,
    seoTitle: "Recurring Daily & Weekly Commute Cab Services",
    seoDescription: "Automated daily commuting taxi service for hassle-free transportation.",
  },
];

const defaultFormState = {
  id: "",
  name: "",
  code: "",
  slug: "",
  serviceType: "Airport Taxi",
  shortDescription: "",
  fullDescription: "",
  icon: "✈️",
  imageUrl: "",
  status: "Active" as "Active" | "Inactive",
  displayOrder: 1,
  featured: false,
  onlineBookingEnabled: true,
  adminBookingEnabled: true,
  allowedVehicleCategoryIds: [] as string[],
  airportOptions: {
    airportPickup: true,
    airportDrop: true,
  },
  outstationOptions: {
    oneWayAllowed: true,
    roundTripAllowed: true,
  },
  seoTitle: "",
  seoDescription: "",
};

export default function Services() {
  const [services, setServices] = useState<TravelService[]>([]);
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"order" | "name" | "type">("order");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(defaultFormState);
  const [activeTab, setActiveTab] = useState<"basic" | "booking" | "seo">("basic");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<TravelService | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const unsubServices = subscribeServices((data) => {
      setServices(data);
      setLoading(false);
    });
    const unsubCats = subscribeVehicleCategories((data) => {
      setVehicleCategories(data);
    });
    const unsubBookings = subscribeBookings((data) => {
      setBookings(data);
    });
    return () => {
      unsubServices();
      unsubCats();
      unsubBookings();
    };
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // KPIs
  const stats = useMemo(() => {
    const totalCount = services.length;
    const activeCount = services.filter((s) => s.status === "Active").length;
    const inactiveCount = services.filter((s) => s.status === "Inactive").length;
    const featuredCount = services.filter((s) => s.featured).length;
    return { totalCount, activeCount, inactiveCount, featuredCount };
  }, [services]);

  // Filtered & Sorted Services
  const filteredServices = useMemo(() => {
    return services
      .filter((srv) => {
        const q = search.trim().toLowerCase();
        const matchSearch =
          q === "" ||
          srv.name.toLowerCase().includes(q) ||
          (srv.code && srv.code.toLowerCase().includes(q)) ||
          (srv.shortDescription && srv.shortDescription.toLowerCase().includes(q)) ||
          (srv.serviceType && srv.serviceType.toLowerCase().includes(q));

        const matchStatus = statusFilter === "All" || srv.status === statusFilter;
        const matchType = typeFilter === "All" || srv.serviceType === typeFilter;
        return matchSearch && matchStatus && matchType;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "type") return (a.serviceType || "").localeCompare(b.serviceType || "");
        return (a.displayOrder || 99) - (b.displayOrder || 99);
      });
  }, [services, search, statusFilter, typeFilter, sortBy]);

  // Modal open
  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData(defaultFormState);
    setActiveTab("basic");
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (srv: TravelService) => {
    setIsEditing(true);
    setFormData({
      id: srv.id,
      name: srv.name,
      code: srv.code || "",
      slug: srv.slug || "",
      serviceType: srv.serviceType || "Airport Taxi",
      shortDescription: srv.shortDescription || "",
      fullDescription: srv.fullDescription || "",
      icon: srv.icon || "✈️",
      imageUrl: srv.imageUrl || "",
      status: srv.status || "Active",
      displayOrder: srv.displayOrder || 1,
      featured: Boolean(srv.featured),
      onlineBookingEnabled: srv.onlineBookingEnabled !== false,
      adminBookingEnabled: srv.adminBookingEnabled !== false,
      allowedVehicleCategoryIds: srv.allowedVehicleCategoryIds || [],
      airportOptions: srv.airportOptions || { airportPickup: true, airportDrop: true },
      outstationOptions: srv.outstationOptions || { oneWayAllowed: true, roundTripAllowed: true },
      seoTitle: srv.seoTitle || "",
      seoDescription: srv.seoDescription || "",
    });
    setActiveTab("basic");
    setFormError(null);
    setShowModal(true);
  };

  const handleApplyPreset = (tmplName: string) => {
    const tmpl = PRESET_SERVICE_TEMPLATES.find((t) => t.name === tmplName);
    if (!tmpl) return;
    setFormData((prev) => ({
      ...prev,
      name: tmpl.name,
      code: tmpl.code,
      slug: tmpl.slug,
      serviceType: tmpl.serviceType,
      shortDescription: tmpl.shortDescription,
      fullDescription: tmpl.fullDescription,
      icon: tmpl.icon,
      displayOrder: tmpl.displayOrder,
      featured: tmpl.featured,
      onlineBookingEnabled: tmpl.onlineBookingEnabled,
      adminBookingEnabled: tmpl.adminBookingEnabled,
      airportOptions: tmpl.airportOptions || prev.airportOptions,
      outstationOptions: tmpl.outstationOptions || prev.outstationOptions,
      seoTitle: tmpl.seoTitle,
      seoDescription: tmpl.seoDescription,
    }));
  };

  const handleToggleCategory = (catId: string) => {
    setFormData((prev) => {
      const current = prev.allowedVehicleCategoryIds || [];
      const updated = current.includes(catId)
        ? current.filter((id) => id !== catId)
        : [...current, catId];
      return { ...prev, allowedVehicleCategoryIds: updated };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formData.name.trim();
    if (!name) {
      setFormError("Service Name is required.");
      setActiveTab("basic");
      return;
    }

    const code = (formData.code || name).toUpperCase().replace(/\s+/g, "_");
    const slug = (formData.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-");

    // Check duplicate name or code
    const duplicate = services.find(
      (s) =>
        s.id !== formData.id &&
        (s.name.trim().toLowerCase() === name.toLowerCase() || (s.code && s.code.toUpperCase() === code))
    );

    if (duplicate) {
      setFormError(`A service with name "${name}" or code "${code}" already exists.`);
      setActiveTab("basic");
      return;
    }

    setSaving(true);
    try {
      const docId = formData.id ? formData.id : `SRV-${code.substring(0, 12)}`;

      // Resolve category names for reference
      const categoryNames = vehicleCategories
        .filter((c) => (formData.allowedVehicleCategoryIds || []).includes(c.id))
        .map((c) => c.name);

      const payload: TravelService = {
        id: docId,
        name,
        code,
        slug,
        serviceType: formData.serviceType,
        shortDescription: formData.shortDescription.trim(),
        fullDescription: formData.fullDescription.trim(),
        icon: formData.icon,
        imageUrl: formData.imageUrl.trim(),
        status: formData.status,
        displayOrder: Number(formData.displayOrder || 1),
        featured: Boolean(formData.featured),
        onlineBookingEnabled: Boolean(formData.onlineBookingEnabled),
        adminBookingEnabled: Boolean(formData.adminBookingEnabled),
        allowedVehicleCategoryIds: formData.allowedVehicleCategoryIds,
        allowedVehicleCategoryNames: categoryNames,
        airportOptions: formData.airportOptions,
        outstationOptions: formData.outstationOptions,
        seoTitle: formData.seoTitle.trim(),
        seoDescription: formData.seoDescription.trim(),
      };

      const ok = await setFirestoreDocument(COLLECTIONS.SERVICES, docId, payload);
      if (ok) {
        if (isEditing) {
          setServices((prev) => prev.map((s) => (s.id === docId ? payload : s)));
        } else {
          setServices((prev) => [payload, ...prev]);
        }
        setShowModal(false);
        showToast(
          isEditing
            ? `Service "${name}" updated successfully.`
            : `Service "${name}" created successfully.`,
          "success"
        );
      } else {
        setFormError("Failed to save service to database. Please try again.");
      }
    } catch (err: any) {
      console.error("Save service error:", err);
      setFormError(err.message || "An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  // Toggle active/inactive status
  const handleToggleStatus = async (srv: TravelService) => {
    const newStatus = srv.status === "Active" ? "Inactive" : "Active";
    const ok = await setFirestoreDocument(COLLECTIONS.SERVICES, srv.id, {
      ...srv,
      status: newStatus,
    });
    if (ok) {
      showToast(`Service "${srv.name}" marked as ${newStatus}.`, "success");
    } else {
      showToast(`Failed to update status for "${srv.name}".`, "error");
    }
  };

  // Delete handling
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    // Check if bookings reference this service name
    const bookingCount = bookings.filter(
      (b) =>
        (b.service || "").toLowerCase() === deleteTarget.name.toLowerCase() ||
        (b.serviceType || "").toLowerCase() === deleteTarget.serviceType.toLowerCase()
    ).length;

    if (bookingCount > 0) {
      setDeleteError(
        `Cannot delete service "${deleteTarget.name}" because ${bookingCount} booking(s) reference it. Please deactivate the service instead.`
      );
      setDeleting(false);
      return;
    }

    try {
      const ok = await deleteFirestoreDocument(COLLECTIONS.SERVICES, deleteTarget.id);
      if (ok) {
        setDeleteTarget(null);
        showToast(`Service "${deleteTarget.name}" removed successfully.`, "success");
      } else {
        setDeleteError("Failed to delete service from database.");
      }
    } catch (err: any) {
      console.error("Delete service error:", err);
      setDeleteError(err.message || "An error occurred during deletion.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toast Alert */}
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

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[#111111]">Services</h1>
          <p className="text-[13px] text-[#666666]">
            Configure Airport Taxi, Outstation Cab, One Way Taxi, Local Rental, Corporate and Recurring services.
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
          + Add Service
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Services",
            value: stats.totalCount.toString(),
            color: "#E21B23",
            sub: "Offered travel services",
          },
          {
            label: "Active Services",
            value: stats.activeCount.toString(),
            color: "#10B981",
            sub: "Available for booking",
          },
          {
            label: "Inactive Services",
            value: stats.inactiveCount.toString(),
            color: "#6B7280",
            sub: "Deactivated / Hidden",
          },
          {
            label: "Featured Services",
            value: stats.featuredCount.toString(),
            color: "#F59E0B",
            sub: "Promoted on web & app",
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

      {/* Main Content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-12 text-center text-[13px] text-[#999999]">
          Loading services configuration...
        </div>
      ) : services.length === 0 ? (
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
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2H10a2 2 0 00-2 2v2m4 6h.01"
              />
            </svg>
          </div>
          <h2 className="text-[18px] font-bold text-[#111111] mb-2">Services</h2>
          <p className="text-[13px] text-[#999999] max-w-sm mb-6">
            Configure Airport Taxi, Outstation Cab, One Way Taxi, Local Rental, Corporate and Recurring services.
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
        /* Service Grid & Directory View */
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="p-4 bg-white rounded-xl border border-[#E5E5E5] shadow-sm flex flex-wrap items-center justify-between gap-3">
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
                placeholder="Search service name, type, code..."
                className="w-full pl-9 pr-4 py-2 text-[12px] bg-[#FAFAFA] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] placeholder-[#999999]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#E21B23] text-[#444444]"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#E21B23] text-[#444444]"
              >
                <option value="All">All Service Types</option>
                <option value="Airport Taxi">Airport Taxi</option>
                <option value="Outstation Cab">Outstation Cab</option>
                <option value="One Way Taxi">One Way Taxi</option>
                <option value="Local Rental">Local Rental</option>
                <option value="Corporate Travel">Corporate Travel</option>
                <option value="Recurring Transport">Recurring Transport</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#E21B23] text-[#444444]"
              >
                <option value="order">Display Order</option>
                <option value="name">Service Name</option>
                <option value="type">Service Type</option>
              </select>
            </div>
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredServices.length === 0 ? (
              <div className="col-span-full bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-xs text-[#999999]">
                No travel services match your search filters.
              </div>
            ) : (
              filteredServices.map((srv) => (
                <div
                  key={srv.id}
                  className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#FEF2F2] flex items-center justify-center text-[22px] border border-[#FEE2E2] shrink-0">
                          {srv.imageUrl ? (
                            <img
                              src={srv.imageUrl}
                              alt={srv.name}
                              className="w-full h-full object-cover rounded-xl"
                              onError={(e) => {
                                (e.target as any).style.display = "none";
                              }}
                            />
                          ) : (
                            srv.icon || "🚕"
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-[14px] font-bold text-[#111111]">{srv.name}</h3>
                            {srv.featured && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                ★ Featured
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-[#888888]">
                            {srv.code || srv.slug}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          srv.status === "Active"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        {srv.status}
                      </span>
                    </div>

                    {/* Short Description */}
                    <p className="text-[12px] text-[#666666] line-clamp-2 leading-relaxed">
                      {srv.shortDescription || "No short description provided."}
                    </p>

                    {/* Service Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-50 text-[#E21B23] border border-red-100">
                        {srv.serviceType}
                      </span>
                      {srv.onlineBookingEnabled && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                          Online Booking
                        </span>
                      )}
                      {srv.adminBookingEnabled && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
                          Admin Booking
                        </span>
                      )}
                    </div>

                    {/* Vehicle Category Mappings */}
                    {srv.allowedVehicleCategoryNames && srv.allowedVehicleCategoryNames.length > 0 && (
                      <div className="pt-2 border-t border-[#F5F5F5]">
                        <span className="text-[10px] font-semibold text-[#999999] uppercase tracking-wider block mb-1">
                          Vehicle Categories
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {srv.allowedVehicleCategoryNames.map((cName) => (
                            <span
                              key={cName}
                              className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700"
                            >
                              {cName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-between">
                    <span className="text-[10px] text-[#999999] font-mono">
                      Order: {srv.displayOrder || 1}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(srv)}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-[#E5E5E5] text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(srv)}
                        className={`px-2 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                          srv.status === "Active"
                            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {srv.status === "Active" ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(srv)}
                        className="px-2 py-1 text-[11px] font-medium rounded-lg border border-red-200 bg-red-50 text-[#E21B23] hover:bg-red-100 transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Service Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#FAFAFA]">
              <div>
                <h3 className="text-[16px] font-bold text-[#111111]">
                  {isEditing ? "Edit Travel Service" : "+ Add Travel Service"}
                </h3>
                <p className="text-[11px] text-[#666666]">
                  Configure service details, vehicle category mappings, and availability.
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
                    {PRESET_SERVICE_TEMPLATES.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.serviceType})
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
                { id: "basic", label: "Basic Info" },
                { id: "booking", label: "Availability & Categories" },
                { id: "seo", label: "SEO & Content" },
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

            {/* Form Body */}
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
                          Service Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Airport Taxi, Outstation Cab"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Service Type
                        </label>
                        <select
                          value={formData.serviceType}
                          onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        >
                          <option value="Airport Taxi">Airport Taxi</option>
                          <option value="Outstation Cab">Outstation Cab</option>
                          <option value="One Way Taxi">One Way Taxi</option>
                          <option value="Local Rental">Local Rental</option>
                          <option value="Corporate Travel">Corporate Travel</option>
                          <option value="Recurring Transport">Recurring Transport</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Service Code / Unique Identifier
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. AIRPORT_TAXI"
                          value={formData.code}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] font-mono focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          URL Slug
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. airport-taxi"
                          value={formData.slug}
                          onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] font-mono focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#111111] mb-1">
                        Short Description
                      </label>
                      <input
                        type="text"
                        placeholder="Brief 1-sentence tagline for cards and lists..."
                        value={formData.shortDescription}
                        onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#111111] mb-1">
                        Full Overview Description
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Detailed service overview, features, terms..."
                        value={formData.fullDescription}
                        onChange={(e) => setFormData({ ...formData, fullDescription: e.target.value })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Icon Emoji
                        </label>
                        <select
                          value={formData.icon}
                          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        >
                          <option value="✈️">✈️ Airport</option>
                          <option value="🗺️">🗺️ Outstation</option>
                          <option value="🚕">🚕 Taxi Drop</option>
                          <option value="⏱️">⏱️ Rental</option>
                          <option value="💼">💼 Corporate</option>
                          <option value="🔄">🔄 Recurring</option>
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

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">Featured</label>
                        <select
                          value={formData.featured ? "Yes" : "No"}
                          onChange={(e) => setFormData({ ...formData, featured: e.target.value === "Yes" })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        >
                          <option value="No">No</option>
                          <option value="Yes">Yes (Promoted)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: BOOKING & VEHICLE CATEGORIES */}
                {activeTab === "booking" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-[#E5E5E5]">
                        <input
                          type="checkbox"
                          id="onlineBook"
                          checked={formData.onlineBookingEnabled}
                          onChange={(e) =>
                            setFormData({ ...formData, onlineBookingEnabled: e.target.checked })
                          }
                          className="w-4 h-4 accent-[#E21B23]"
                        />
                        <div>
                          <label htmlFor="onlineBook" className="text-[12px] font-bold text-[#111111] block">
                            Enable Online Customer Booking
                          </label>
                          <span className="text-[10px] text-gray-500">Available on public website & mobile app</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-[#E5E5E5]">
                        <input
                          type="checkbox"
                          id="adminBook"
                          checked={formData.adminBookingEnabled}
                          onChange={(e) =>
                            setFormData({ ...formData, adminBookingEnabled: e.target.checked })
                          }
                          className="w-4 h-4 accent-[#E21B23]"
                        />
                        <div>
                          <label htmlFor="adminBook" className="text-[12px] font-bold text-[#111111] block">
                            Enable Admin Booking Panel
                          </label>
                          <span className="text-[10px] text-gray-500">Selectable in + New Booking form</span>
                        </div>
                      </div>
                    </div>

                    {/* Allowed Vehicle Categories */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#111111] mb-2">
                        Allowed Vehicle Categories for this Service
                      </label>
                      {vehicleCategories.length === 0 ? (
                        <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
                          No vehicle categories configured. Configure categories in Fleet &gt; Vehicle Categories.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl border border-[#E5E5E5]">
                          {vehicleCategories
                            .filter((c) => c.status === "Active")
                            .map((cat) => {
                              const checked = (formData.allowedVehicleCategoryIds || []).includes(cat.id);
                              return (
                                <label
                                  key={cat.id}
                                  className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                    checked
                                      ? "bg-red-50 border-red-200 text-[#E21B23] font-bold"
                                      : "bg-white border-gray-200 text-gray-700"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleToggleCategory(cat.id)}
                                    className="accent-[#E21B23]"
                                  />
                                  <span>
                                    {cat.icon || "🚘"} {cat.name} ({cat.seatingCapacity} Seats)
                                  </span>
                                </label>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: SEO & METADATA */}
                {activeTab === "seo" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[#111111] mb-1">
                        SEO Page Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Book Airport Taxi in Tamil Nadu | Nesam Tours"
                        value={formData.seoTitle}
                        onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#111111] mb-1">
                        SEO Meta Description
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Compelling page meta description for Google search results..."
                        value={formData.seoDescription}
                        onChange={(e) => setFormData({ ...formData, seoDescription: e.target.value })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                      />
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
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {saving
                    ? "Saving..."
                    : isEditing
                    ? "Update Travel Service"
                    : "Save Travel Service"}
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
                <h3 className="text-base font-bold text-gray-900">Delete Travel Service?</h3>
                <p className="text-xs text-gray-500 font-mono">{deleteTarget.name} ({deleteTarget.code})</p>
              </div>
            </div>

            <p className="text-xs text-gray-600">
              Are you sure you want to delete this travel service? Historical bookings will not be affected.
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
