import { useState, useEffect, useMemo } from "react";
import { MasterLocation, LocationType, TravelService, Booking, TourPackage } from "../types";
import {
  subscribeLocations,
  subscribeServices,
  subscribeBookings,
  subscribeTourPackages,
  addFirestoreDocument,
  setFirestoreDocument,
  deleteFirestoreDocument,
  COLLECTIONS,
} from "../services/adminFirestoreService";

const LOCATION_TYPES: LocationType[] = [
  "City",
  "Area / Locality",
  "Airport",
  "Railway Station",
  "Bus Stand",
  "Landmark",
  "Tourist Place",
  "Other",
];

const STATES_LIST = [
  "Tamil Nadu",
  "Puducherry",
  "Karnataka",
  "Kerala",
  "Andhra Pradesh",
  "Telangana",
  "Maharashtra",
  "Goa",
  "Other",
];

const TYPE_BADGES: Record<LocationType, { bg: string; text: string; border: string }> = {
  City: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "Area / Locality": { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  Airport: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "Railway Station": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Bus Stand": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  Landmark: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Tourist Place": { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  Other: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
};

// Preset Baseline Locations across Tamil Nadu & Transport Hubs
const PRESET_LOCATIONS: Partial<MasterLocation>[] = [
  {
    name: "Chennai International Airport (MAA)",
    code: "MAA",
    type: "Airport",
    state: "Tamil Nadu",
    district: "Chengalpattu",
    city: "Chennai",
    area: "Meenambakkam",
    pincode: "600027",
    address: "Grand Southern Trunk Rd, Meenambakkam, Chennai, Tamil Nadu 600027",
    lat: 12.9941,
    lng: 80.1709,
    pickupEnabled: true,
    dropEnabled: true,
    onlineBookingEnabled: true,
    adminBookingEnabled: true,
    status: "Active",
    displayOrder: 1,
  },
  {
    name: "Coimbatore International Airport (CJB)",
    code: "CJB",
    type: "Airport",
    state: "Tamil Nadu",
    district: "Coimbatore",
    city: "Coimbatore",
    area: "Peelamedu",
    pincode: "641014",
    address: "Civil Aerodrome Post, Peelamedu, Coimbatore, Tamil Nadu 641014",
    lat: 11.03,
    lng: 77.0434,
    pickupEnabled: true,
    dropEnabled: true,
    onlineBookingEnabled: true,
    adminBookingEnabled: true,
    status: "Active",
    displayOrder: 2,
  },
  {
    name: "Chennai Central Railway Station (MAS)",
    code: "MAS",
    type: "Railway Station",
    state: "Tamil Nadu",
    district: "Chennai",
    city: "Chennai",
    area: "Park Town",
    pincode: "600003",
    address: "Kannappar Thidal, Park Town, Chennai, Tamil Nadu 600003",
    lat: 13.0827,
    lng: 80.2756,
    pickupEnabled: true,
    dropEnabled: true,
    onlineBookingEnabled: true,
    adminBookingEnabled: true,
    status: "Active",
    displayOrder: 3,
  },
  {
    name: "Madurai Junction Railway Station (MDU)",
    code: "MDU",
    type: "Railway Station",
    state: "Tamil Nadu",
    district: "Madurai",
    city: "Madurai",
    area: "West Veli Street",
    pincode: "625001",
    address: "Railway Colony, Madurai, Tamil Nadu 625001",
    lat: 9.9195,
    lng: 78.1193,
    pickupEnabled: true,
    dropEnabled: true,
    onlineBookingEnabled: true,
    adminBookingEnabled: true,
    status: "Active",
    displayOrder: 4,
  },
  {
    name: "Coimbatore City Center",
    code: "CBE-CITY",
    type: "City",
    state: "Tamil Nadu",
    district: "Coimbatore",
    city: "Coimbatore",
    area: "Gandhipuram",
    pincode: "641012",
    address: "Gandhipuram, Coimbatore, Tamil Nadu 641012",
    lat: 11.0168,
    lng: 76.9558,
    pickupEnabled: true,
    dropEnabled: true,
    onlineBookingEnabled: true,
    adminBookingEnabled: true,
    status: "Active",
    displayOrder: 5,
  },
  {
    name: "Salem Central Bus Stand",
    code: "SLM-BUS",
    type: "Bus Stand",
    state: "Tamil Nadu",
    district: "Salem",
    city: "Salem",
    area: "Zaheerabad",
    pincode: "636004",
    address: "Meyyanur, Salem, Tamil Nadu 636004",
    lat: 11.6643,
    lng: 78.146,
    pickupEnabled: true,
    dropEnabled: true,
    onlineBookingEnabled: true,
    adminBookingEnabled: true,
    status: "Active",
    displayOrder: 6,
  },
  {
    name: "Gobichettipalayam Town",
    code: "GOBI-CITY",
    type: "City",
    state: "Tamil Nadu",
    district: "Erode",
    city: "Gobichettipalayam",
    area: "Kutchery Street",
    pincode: "638452",
    address: "Gobichettipalayam, Erode District, Tamil Nadu 638452",
    lat: 11.4549,
    lng: 77.4382,
    pickupEnabled: true,
    dropEnabled: true,
    onlineBookingEnabled: true,
    adminBookingEnabled: true,
    status: "Active",
    displayOrder: 7,
  },
  {
    name: "Tiruchirappalli International Airport (TRZ)",
    code: "TRZ",
    type: "Airport",
    state: "Tamil Nadu",
    district: "Tiruchirappalli",
    city: "Tiruchirappalli",
    area: "Airport Post",
    pincode: "620007",
    address: "Airport Road, Tiruchirappalli, Tamil Nadu 620007",
    lat: 10.7654,
    lng: 78.7097,
    pickupEnabled: true,
    dropEnabled: true,
    onlineBookingEnabled: true,
    adminBookingEnabled: true,
    status: "Active",
    displayOrder: 8,
  },
  {
    name: "Pondicherry Promenade Beach",
    code: "PDY-BEACH",
    type: "Tourist Place",
    state: "Puducherry",
    district: "Puducherry",
    city: "Pondicherry",
    area: "White Town",
    pincode: "605001",
    address: "Goubert Ave, White Town, Pondicherry 605001",
    lat: 11.9338,
    lng: 79.8356,
    pickupEnabled: true,
    dropEnabled: true,
    onlineBookingEnabled: true,
    adminBookingEnabled: true,
    status: "Active",
    displayOrder: 9,
  },
];

export default function Locations() {
  const [locations, setLocations] = useState<MasterLocation[]>([]);
  const [services, setServices] = useState<TravelService[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [packages, setPackages] = useState<TourPackage[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Controls
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [stateFilter, setStateFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"name" | "city" | "type" | "displayOrder">("displayOrder");
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid");

  // Modal Form State
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<MasterLocation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "geo" | "services">("basic");

  // Form Fields
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    type: LocationType;
    state: string;
    district: string;
    city: string;
    area: string;
    pincode: string;
    address: string;
    parentLocationId: string;
    lat: string;
    lng: string;
    placeId: string;
    pickupEnabled: boolean;
    dropEnabled: boolean;
    onlineBookingEnabled: boolean;
    adminBookingEnabled: boolean;
    serviceIds: string[];
    status: "Active" | "Inactive";
    displayOrder: number;
  }>({
    name: "",
    code: "",
    type: "City",
    state: "Tamil Nadu",
    district: "",
    city: "",
    area: "",
    pincode: "",
    address: "",
    parentLocationId: "",
    lat: "",
    lng: "",
    placeId: "",
    pickupEnabled: true,
    dropEnabled: true,
    onlineBookingEnabled: true,
    adminBookingEnabled: true,
    serviceIds: [],
    status: "Active",
    displayOrder: 1,
  });

  // Delete & Safety Dialog
  const [deletingLocation, setDeletingLocation] = useState<MasterLocation | null>(null);
  const [deleteRefNotice, setDeleteRefNotice] = useState<string | null>(null);

  // Success Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubLoc = subscribeLocations((data) => {
      setLocations(data);
      setLoading(false);
    });
    const unsubSrv = subscribeServices(setServices);
    const unsubBkg = subscribeBookings(setBookings);
    const unsubPkg = subscribeTourPackages(setPackages);

    return () => {
      unsubLoc();
      unsubSrv();
      unsubBkg();
      unsubPkg();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Dashboard Stats
  const stats = useMemo(() => {
    const total = locations.length;
    const active = locations.filter((l) => l.status === "Active").length;
    const cities = new Set(locations.map((l) => l.city.trim().toLowerCase()).filter(Boolean)).size;
    const transportHubs = locations.filter((l) =>
      ["Airport", "Railway Station", "Bus Stand"].includes(l.type)
    ).length;
    return { total, active, cities, transportHubs };
  }, [locations]);

  // Filtered & Sorted Locations
  const filteredLocations = useMemo(() => {
    return locations
      .filter((loc) => {
        const query = search.trim().toLowerCase();
        const matchSearch =
          !query ||
          loc.name.toLowerCase().includes(query) ||
          (loc.code && loc.code.toLowerCase().includes(query)) ||
          loc.city.toLowerCase().includes(query) ||
          (loc.district && loc.district.toLowerCase().includes(query)) ||
          loc.state.toLowerCase().includes(query) ||
          (loc.area && loc.area.toLowerCase().includes(query)) ||
          (loc.pincode && loc.pincode.includes(query));

        const matchType = typeFilter === "All" || loc.type === typeFilter;
        const matchState = stateFilter === "All" || loc.state === stateFilter;
        const matchStatus = statusFilter === "All" || loc.status === statusFilter;

        return matchSearch && matchType && matchState && matchStatus;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "city") return a.city.localeCompare(b.city);
        if (sortBy === "type") return a.type.localeCompare(b.type);
        return (a.displayOrder || 99) - (b.displayOrder || 99);
      });
  }, [locations, search, typeFilter, stateFilter, statusFilter, sortBy]);

  // Reset & Open Create Form
  const handleOpenCreate = () => {
    setEditingLocation(null);
    setFormData({
      name: "",
      code: "",
      type: "City",
      state: "Tamil Nadu",
      district: "",
      city: "",
      area: "",
      pincode: "",
      address: "",
      parentLocationId: "",
      lat: "",
      lng: "",
      placeId: "",
      pickupEnabled: true,
      dropEnabled: true,
      onlineBookingEnabled: true,
      adminBookingEnabled: true,
      serviceIds: services.filter((s) => s.status === "Active").map((s) => s.id),
      status: "Active",
      displayOrder: locations.length + 1,
    });
    setFormError(null);
    setActiveTab("basic");
    setShowModal(true);
  };

  // Open Edit Form
  const handleOpenEdit = (loc: MasterLocation) => {
    setEditingLocation(loc);
    setFormData({
      name: loc.name || "",
      code: loc.code || "",
      type: loc.type || "City",
      state: loc.state || "Tamil Nadu",
      district: loc.district || "",
      city: loc.city || "",
      area: loc.area || "",
      pincode: loc.pincode || "",
      address: loc.address || "",
      parentLocationId: loc.parentLocationId || "",
      lat: loc.lat !== undefined ? String(loc.lat) : "",
      lng: loc.lng !== undefined ? String(loc.lng) : "",
      placeId: loc.placeId || "",
      pickupEnabled: loc.pickupEnabled !== false,
      dropEnabled: loc.dropEnabled !== false,
      onlineBookingEnabled: loc.onlineBookingEnabled !== false,
      adminBookingEnabled: loc.adminBookingEnabled !== false,
      serviceIds: loc.serviceIds || [],
      status: loc.status || "Active",
      displayOrder: loc.displayOrder || 1,
    });
    setFormError(null);
    setActiveTab("basic");
    setShowModal(true);
  };

  // Save Form Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    const nameTrim = formData.name.trim();
    const cityTrim = formData.city.trim();
    const stateTrim = formData.state.trim();

    if (!nameTrim) {
      setFormError("Location Name is required.");
      setActiveTab("basic");
      return;
    }

    if (!cityTrim) {
      setFormError("City / Town is required.");
      setActiveTab("geo");
      return;
    }

    if (!stateTrim) {
      setFormError("State is required.");
      setActiveTab("geo");
      return;
    }

    // Latitude & Longitude validation
    let latNum: number | undefined;
    let lngNum: number | undefined;

    if (formData.lat.trim()) {
      latNum = parseFloat(formData.lat.trim());
      if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        setFormError("Latitude must be a valid number between -90 and 90.");
        setActiveTab("geo");
        return;
      }
    }

    if (formData.lng.trim()) {
      lngNum = parseFloat(formData.lng.trim());
      if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        setFormError("Longitude must be a valid number between -180 and 180.");
        setActiveTab("geo");
        return;
      }
    }

    // Duplicate Check in same city
    const existingDup = locations.find(
      (l) =>
        l.name.trim().toLowerCase() === nameTrim.toLowerCase() &&
        l.city.trim().toLowerCase() === cityTrim.toLowerCase() &&
        (!editingLocation || l.id !== editingLocation.id)
    );

    if (existingDup) {
      setFormError(`A location named "${nameTrim}" already exists in ${cityTrim}.`);
      setActiveTab("basic");
      return;
    }

    setIsSubmitting(true);

    const generatedCode =
      formData.code.trim().toUpperCase() ||
      nameTrim
        .replace(/[^a-[#111111]0-9]/gi, "")
        .substring(0, 8)
        .toUpperCase();

    const parentLoc = locations.find((l) => l.id === formData.parentLocationId);

    const payload: Partial<MasterLocation> = {
      name: nameTrim,
      normalizedName: nameTrim.toLowerCase(),
      code: generatedCode,
      type: formData.type,
      state: stateTrim,
      district: formData.district.trim(),
      city: cityTrim,
      area: formData.area.trim(),
      pincode: formData.pincode.trim(),
      address: formData.address.trim(),
      parentLocationId: formData.parentLocationId || undefined,
      parentLocationName: parentLoc ? parentLoc.name : undefined,
      lat: latNum,
      lng: lngNum,
      placeId: formData.placeId.trim() || undefined,
      pickupEnabled: formData.pickupEnabled,
      dropEnabled: formData.dropEnabled,
      onlineBookingEnabled: formData.onlineBookingEnabled,
      adminBookingEnabled: formData.adminBookingEnabled,
      serviceIds: formData.serviceIds,
      status: formData.status,
      displayOrder: Number(formData.displayOrder) || 1,
    };

    let success = false;
    if (editingLocation) {
      success = await setFirestoreDocument(COLLECTIONS.LOCATIONS, editingLocation.id, payload);
    } else {
      const docId = await addFirestoreDocument(COLLECTIONS.LOCATIONS, payload);
      success = !!docId;
    }

    setIsSubmitting(false);

    if (success) {
      setShowModal(false);
      showToast(
        editingLocation
          ? `Location "${nameTrim}" updated successfully.`
          : `Location "${nameTrim}" created successfully.`
      );
    } else {
      setFormError("Failed to save location to database. Please check your internet connection.");
    }
  };

  // Toggle Active Status Quick Action
  const handleToggleStatus = async (loc: MasterLocation) => {
    const nextStatus = loc.status === "Active" ? "Inactive" : "Active";
    const ok = await setFirestoreDocument(COLLECTIONS.LOCATIONS, loc.id, {
      status: nextStatus,
    });
    if (ok) {
      showToast(`Location "${loc.name}" is now ${nextStatus}.`);
    } else {
      showToast("Failed to update status.");
    }
  };

  // Check references before deletion
  const handlePromptDelete = (loc: MasterLocation) => {
    setDeletingLocation(loc);
    setDeleteRefNotice(null);

    // Check bookings reference
    const refBookings = bookings.filter(
      (b) =>
        (b.pickup && b.pickup.toLowerCase().includes(loc.name.toLowerCase())) ||
        (b.drop && b.drop.toLowerCase().includes(loc.name.toLowerCase()))
    );

    // Check packages reference
    const refPackages = packages.filter(
      (p) =>
        p.startingLocation?.toLowerCase() === loc.name.toLowerCase() ||
        p.endingLocation?.toLowerCase() === loc.name.toLowerCase() ||
        (p.destinations && p.destinations.some((d) => d.toLowerCase() === loc.name.toLowerCase()))
    );

    if (refBookings.length > 0 || refPackages.length > 0) {
      setDeleteRefNotice(
        `This location is referenced by ${refBookings.length} booking(s) and ${refPackages.length} tour package(s). Hard deletion will break transaction history. Deactivating is strongly recommended.`
      );
    }
  };

  // Confirm Delete Handler
  const handleConfirmDelete = async () => {
    if (!deletingLocation) return;
    const ok = await deleteFirestoreDocument(COLLECTIONS.LOCATIONS, deletingLocation.id);
    if (ok) {
      showToast(`Location "${deletingLocation.name}" removed.`);
    } else {
      showToast("Failed to delete location.");
    }
    setDeletingLocation(null);
  };

  // One-click Preset Importer
  const handleLoadPresets = async () => {
    if (!window.confirm("Load preset master locations (Airports, Junctions & Cities across TN & Puducherry)?")) {
      return;
    }
    setLoading(true);
    let addedCount = 0;

    for (const preset of PRESET_LOCATIONS) {
      const exists = locations.some(
        (l) => l.name.toLowerCase() === preset.name?.toLowerCase()
      );
      if (!exists) {
        await addFirestoreDocument(COLLECTIONS.LOCATIONS, preset);
        addedCount++;
      }
    }

    setLoading(false);
    showToast(`Successfully loaded ${addedCount} preset master locations!`);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#111111] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-gray-800 animate-slide-up text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111111] tracking-tight">Locations</h1>
          <p className="text-xs text-[#666] mt-0.5">
            Manage master cities, airports, railway stations, bus stands, and pickup points across Tamil Nadu & beyond.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {locations.length > 0 && (
            <button
              onClick={handleLoadPresets}
              className="px-3 py-2 text-xs font-semibold text-[#111111] bg-white border border-[#E5E5E5] rounded-xl hover:bg-gray-50 transition-all flex items-center gap-1.5 shadow-sm"
              title="Quickly populate major Tamil Nadu transport hubs & cities"
            >
              <svg className="w-3.5 h-3.5 text-[#E21B23]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Auto-Populate Presets
            </button>
          )}

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 text-xs font-semibold text-white rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center gap-2"
            style={{ background: "#E21B23" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Location
          </button>
        </div>
      </div>

      {/* Summary Dashboard Cards (Only when real data exists) */}
      {locations.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#E21B23] flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#666]">Total Locations</div>
              <div className="text-lg font-bold text-[#111111]">{stats.total}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#666]">Cities & Towns</div>
              <div className="text-lg font-bold text-[#111111]">{stats.cities}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#666]">Transport Hubs</div>
              <div className="text-lg font-bold text-[#111111]">{stats.transportHubs}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#666]">Active Locations</div>
              <div className="text-lg font-bold text-[#111111]">{stats.active}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-2 border-[#E21B23] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-[#666]">Loading Master Locations from Firestore…</p>
        </div>
      ) : locations.length === 0 ? (
        /* Empty State Placeholder (Matches Screenshot & Prompt Instructions) */
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-10 sm:p-16 text-center max-w-2xl mx-auto my-8 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#E21B23] flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-inner">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[#111111] mb-2">Locations</h2>
          <p className="text-xs text-[#666] mb-6 leading-relaxed max-w-md mx-auto">
            Manage cities, airports, pickup points and drop points across Tamil Nadu and beyond.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleOpenCreate}
              className="w-full sm:w-auto px-6 py-2.5 text-xs font-semibold text-white rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md"
              style={{ background: "#E21B23" }}
            >
              Get Started
            </button>
            <button
              onClick={handleLoadPresets}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-[#111111] bg-gray-50 border border-[#E5E5E5] rounded-xl hover:bg-gray-100 transition-all"
            >
              Load TN Hub Presets
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 sm:p-5 space-y-4 shadow-xs">
          {/* Controls Bar: Search, Filters, Sort, View Toggle */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search locations by name, code, city, district, pincode…"
                className="w-full pl-9 pr-4 py-2 border border-[#E5E5E5] rounded-xl text-xs focus:outline-none focus:border-[#E21B23] transition-colors"
              />
            </div>

            {/* Filter Selects */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-[#E5E5E5] rounded-xl text-xs bg-white text-[#111111] focus:outline-none focus:border-[#E21B23]"
              >
                <option value="All">All Types</option>
                {LOCATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {/* State Filter */}
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="px-3 py-2 border border-[#E5E5E5] rounded-xl text-xs bg-white text-[#111111] focus:outline-none focus:border-[#E21B23]"
              >
                <option value="All">All States</option>
                {STATES_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-[#E5E5E5] rounded-xl text-xs bg-white text-[#111111] focus:outline-none focus:border-[#E21B23]"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-[#E5E5E5] rounded-xl text-xs bg-white text-[#111111] focus:outline-none focus:border-[#E21B23]"
              >
                <option value="displayOrder">Sort: Order</option>
                <option value="name">Sort: Name</option>
                <option value="city">Sort: City</option>
                <option value="type">Sort: Type</option>
              </select>

              {/* View Switcher */}
              <div className="flex border border-[#E5E5E5] rounded-xl p-0.5 bg-gray-50">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    viewMode === "grid" ? "bg-white text-[#111111] shadow-xs" : "text-[#666] hover:text-[#111111]"
                  }`}
                  title="Grid view"
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    viewMode === "table" ? "bg-white text-[#111111] shadow-xs" : "text-[#666] hover:text-[#111111]"
                  }`}
                  title="Table view"
                >
                  Table
                </button>
              </div>
            </div>
          </div>

          {/* Results Info */}
          <div className="text-[11px] text-[#666] flex items-center justify-between border-t border-[#E5E5E5] pt-3">
            <span>
              Showing <strong className="text-[#111111]">{filteredLocations.length}</strong> of {locations.length} location records
            </span>
          </div>

          {/* Locations Directory Display */}
          {filteredLocations.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-[#E5E5E5] rounded-xl bg-gray-50">
              <p className="text-xs text-[#666]">No locations match your current search or filters.</p>
              <button
                onClick={() => {
                  setSearch("");
                  setTypeFilter("All");
                  setStateFilter("All");
                  setStatusFilter("All");
                }}
                className="mt-2 text-xs font-semibold text-[#E21B23] hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {filteredLocations.map((loc) => {
                const badge = TYPE_BADGES[loc.type] || TYPE_BADGES.Other;
                return (
                  <div
                    key={loc.id}
                    className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-3 hover:border-gray-300 transition-all hover:shadow-sm flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}>
                              {loc.type}
                            </span>
                            {loc.code && (
                              <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 text-gray-700 rounded border border-gray-200">
                                {loc.code}
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-[#111111] mt-1.5 leading-snug">{loc.name}</h3>
                        </div>

                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                            loc.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          {loc.status}
                        </span>
                      </div>

                      {/* City & Geography */}
                      <div className="text-xs text-[#666] space-y-1">
                        <div className="flex items-center gap-1 text-[#111111] font-medium">
                          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          <span>
                            {loc.city}
                            {loc.district && `, ${loc.district}`} ({loc.state})
                          </span>
                        </div>

                        {loc.area && (
                          <div className="text-[11px] text-[#666] pl-4">Locality: {loc.area}</div>
                        )}

                        {loc.address && (
                          <p className="text-[11px] text-[#666] line-clamp-2 pl-4 italic">
                            "{loc.address}"
                          </p>
                        )}
                      </div>

                      {/* Coordinates badge if available */}
                      {(loc.lat !== undefined || loc.lng !== undefined) && (
                        <div className="text-[10px] font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200 inline-block">
                          Lat: {loc.lat ?? "N/A"}, Lng: {loc.lng ?? "N/A"}
                        </div>
                      )}

                      {/* Availability Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {loc.pickupEnabled && (
                          <span className="px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 rounded border border-emerald-100 font-medium">
                            ✓ Pickup
                          </span>
                        )}
                        {loc.dropEnabled && (
                          <span className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded border border-blue-100 font-medium">
                            ✓ Drop
                          </span>
                        )}
                        {loc.onlineBookingEnabled && (
                          <span className="px-2 py-0.5 text-[10px] bg-purple-50 text-purple-700 rounded border border-purple-100 font-medium">
                            ✓ Online Booking
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#E5E5E5]">
                      <button
                        onClick={() => handleToggleStatus(loc)}
                        className={`text-[11px] font-semibold ${
                          loc.status === "Active" ? "text-amber-600 hover:text-amber-800" : "text-emerald-600 hover:text-emerald-800"
                        }`}
                      >
                        {loc.status === "Active" ? "Deactivate" : "Activate"}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(loc)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#111111] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handlePromptDelete(loc)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-x-auto border border-[#E5E5E5] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-[#E5E5E5] text-[#666] font-semibold">
                  <tr>
                    <th className="py-3 px-3">Location</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">City / State</th>
                    <th className="py-3 px-3">Pincode</th>
                    <th className="py-3 px-3">Pickup / Drop</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {filteredLocations.map((loc) => {
                    const badge = TYPE_BADGES[loc.type] || TYPE_BADGES.Other;
                    return (
                      <tr key={loc.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-3 font-semibold text-[#111111]">
                          <div>{loc.name}</div>
                          {loc.code && <div className="text-[10px] font-mono text-gray-500">{loc.code}</div>}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {loc.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#111111]">
                          {loc.city}, {loc.state}
                        </td>
                        <td className="py-3 px-3 text-[#666] font-mono">{loc.pincode || "—"}</td>
                        <td className="py-3 px-3">
                          <div className="flex gap-1">
                            {loc.pickupEnabled && <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Pickup</span>}
                            {loc.dropEnabled && <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Drop</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                              loc.status === "Active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-gray-100 text-gray-600 border-gray-200"
                            }`}
                          >
                            {loc.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            onClick={() => handleOpenEdit(loc)}
                            className="text-[#111111] hover:underline font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handlePromptDelete(loc)}
                            className="text-red-600 hover:underline font-semibold"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Location Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-[#E5E5E5] max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E5E5E5] flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-base font-bold text-[#111111]">
                  {editingLocation ? "Edit Master Location" : "Add Master Location"}
                </h3>
                <p className="text-[11px] text-[#666]">
                  Configure reusable location data for bookings, services, and tour packages.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Tabs */}
            <div className="flex border-b border-[#E5E5E5] bg-white px-5 pt-2 gap-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("basic")}
                className={`pb-2.5 border-b-2 transition-all ${
                  activeTab === "basic"
                    ? "border-[#E21B23] text-[#E21B23]"
                    : "border-transparent text-[#666] hover:text-[#111111]"
                }`}
              >
                1. Basic Info & Type
              </button>
              <button
                onClick={() => setActiveTab("geo")}
                className={`pb-2.5 border-b-2 transition-all ${
                  activeTab === "geo"
                    ? "border-[#E21B23] text-[#E21B23]"
                    : "border-transparent text-[#666] hover:text-[#111111]"
                }`}
              >
                2. Geography & Coordinates
              </button>
              <button
                onClick={() => setActiveTab("services")}
                className={`pb-2.5 border-b-2 transition-all ${
                  activeTab === "services"
                    ? "border-[#E21B23] text-[#E21B23]"
                    : "border-transparent text-[#666] hover:text-[#111111]"
                }`}
              >
                3. Availability & Services
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formError}
                </div>
              )}

              {/* TAB 1: BASIC INFO */}
              {activeTab === "basic" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Location Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Chennai International Airport (MAA), Madurai Jn"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Location Type *
                      </label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as LocationType })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs bg-white focus:border-[#E21B23] focus:outline-none"
                      >
                        {LOCATION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Location Code / IATA
                      </label>
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="e.g. MAA, CJB, MDU"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs uppercase font-mono focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Parent Location (Optional Hierarchy)
                      </label>
                      <select
                        value={formData.parentLocationId}
                        onChange={(e) => setFormData({ ...formData, parentLocationId: e.target.value })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs bg-white focus:border-[#E21B23] focus:outline-none"
                      >
                        <option value="">No Parent (Top-level)</option>
                        {locations
                          .filter((l) => !editingLocation || l.id !== editingLocation.id)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name} ({l.city}, {l.state})
                            </option>
                          ))}
                      </select>
                      <span className="text-[10px] text-[#666] mt-0.5 block">
                        Allows linking an airport or bus stand to a master parent city.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: GEOGRAPHY & COORDINATES */}
              {activeTab === "geo" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        State *
                      </label>
                      <select
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs bg-white focus:border-[#E21B23] focus:outline-none"
                      >
                        {STATES_LIST.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        District / Region
                      </label>
                      <input
                        type="text"
                        value={formData.district}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        placeholder="e.g. Chengalpattu, Coimbatore, Erode"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        City / Town *
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="e.g. Chennai, Coimbatore, Salem"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Area / Locality
                      </label>
                      <input
                        type="text"
                        value={formData.area}
                        onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                        placeholder="e.g. Meenambakkam, Peelamedu, Gandhipuram"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Pincode
                      </label>
                      <input
                        type="text"
                        value={formData.pincode}
                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                        placeholder="e.g. 600027, 641014"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs font-mono focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Full Address Description
                      </label>
                      <textarea
                        rows={2}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Full street address, landmark description..."
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>

                    {/* Coordinates */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Latitude (-90 to +90)
                      </label>
                      <input
                        type="text"
                        value={formData.lat}
                        onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                        placeholder="e.g. 12.9941"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs font-mono focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Longitude (-180 to +180)
                      </label>
                      <input
                        type="text"
                        value={formData.lng}
                        onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                        placeholder="e.g. 80.1709"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs font-mono focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: AVAILABILITY & SERVICES */}
              {activeTab === "services" && (
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 border border-[#E5E5E5] rounded-xl space-y-2">
                    <div className="text-[11px] font-bold text-[#111111]">Booking Availability Config</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded-lg border border-[#E5E5E5]">
                        <input
                          type="checkbox"
                          checked={formData.pickupEnabled}
                          onChange={(e) => setFormData({ ...formData, pickupEnabled: e.target.checked })}
                          className="accent-[#E21B23]"
                        />
                        <span className="text-[#111111] font-medium">Pickup Allowed</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded-lg border border-[#E5E5E5]">
                        <input
                          type="checkbox"
                          checked={formData.dropEnabled}
                          onChange={(e) => setFormData({ ...formData, dropEnabled: e.target.checked })}
                          className="accent-[#E21B23]"
                        />
                        <span className="text-[#111111] font-medium">Drop Allowed</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded-lg border border-[#E5E5E5]">
                        <input
                          type="checkbox"
                          checked={formData.onlineBookingEnabled}
                          onChange={(e) => setFormData({ ...formData, onlineBookingEnabled: e.target.checked })}
                          className="accent-[#E21B23]"
                        />
                        <span className="text-[#111111] font-medium">Online Customer Booking</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded-lg border border-[#E5E5E5]">
                        <input
                          type="checkbox"
                          checked={formData.adminBookingEnabled}
                          onChange={(e) => setFormData({ ...formData, adminBookingEnabled: e.target.checked })}
                          className="accent-[#E21B23]"
                        />
                        <span className="text-[#111111] font-medium">Admin Booking Only</span>
                      </label>
                    </div>
                  </div>

                  {/* Status & Display Order */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Master Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs bg-white focus:border-[#E21B23] focus:outline-none"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Display Order Sequence
                      </label>
                      <input
                        type="number"
                        value={formData.displayOrder}
                        onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 1 })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Associated Services */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                      Associated Travel Services
                    </label>
                    <div className="border border-[#E5E5E5] rounded-xl p-3 bg-white space-y-1.5 max-h-36 overflow-y-auto">
                      {services.length === 0 ? (
                        <div className="text-[11px] text-[#666]">No travel services configured yet.</div>
                      ) : (
                        services.map((srv) => (
                          <label key={srv.id} className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={formData.serviceIds.includes(srv.id)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...formData.serviceIds, srv.id]
                                  : formData.serviceIds.filter((id) => id !== srv.id);
                                setFormData({ ...formData, serviceIds: next });
                              }}
                              className="accent-[#E21B23]"
                            />
                            <span className="text-[#111111] font-medium">{srv.name}</span>
                            <span className="text-[10px] text-[#666]">({srv.serviceType})</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-[#E5E5E5] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {activeTab !== "basic" && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(activeTab === "services" ? "geo" : "basic")}
                      className="px-3 py-2 border border-[#E5E5E5] text-[#111111] rounded-xl font-semibold text-xs"
                    >
                      ← Back
                    </button>
                  )}
                  {activeTab !== "services" && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(activeTab === "basic" ? "geo" : "services")}
                      className="px-3 py-2 bg-gray-100 text-[#111111] rounded-xl font-semibold text-xs hover:bg-gray-200"
                    >
                      Next Step →
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-[#E5E5E5] text-[#666] rounded-xl font-semibold text-xs hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-white font-semibold rounded-xl text-xs hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                    style={{ background: "#E21B23" }}
                  >
                    {isSubmitting && (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    )}
                    {editingLocation ? "Save Changes" : "Create Location"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation & Safeguard Dialog */}
      {deletingLocation && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-[#E5E5E5]">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111111]">Delete Location</h3>
                <p className="text-xs text-[#666]">{deletingLocation.name}</p>
              </div>
            </div>

            {deleteRefNotice ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-2">
                <div className="font-bold">⚠️ Linked References Guard</div>
                <p>{deleteRefNotice}</p>
              </div>
            ) : (
              <p className="text-xs text-[#666]">
                Are you sure you want to delete <strong>"{deletingLocation.name}"</strong> from master locations?
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingLocation(null)}
                className="px-4 py-2 border border-[#E5E5E5] text-[#111111] text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>

              {deleteRefNotice ? (
                <button
                  onClick={() => {
                    handleToggleStatus(deletingLocation);
                    setDeletingLocation(null);
                  }}
                  className="px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-xl hover:bg-amber-700"
                >
                  Deactivate Instead
                </button>
              ) : (
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700"
                >
                  Confirm Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
