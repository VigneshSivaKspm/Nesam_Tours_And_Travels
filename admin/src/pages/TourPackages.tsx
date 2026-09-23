import { useState, useEffect, useMemo } from "react";
import { TourPackage, VehicleCategory, Vendor, Booking, ItineraryDay } from "../types";
import {
  subscribeTourPackages,
  subscribeVehicleCategories,
  subscribeVendors,
  subscribeBookings,
  setFirestoreDocument,
  deleteFirestoreDocument,
  COLLECTIONS,
} from "../services/adminFirestoreService";

function formatCurrency(n: number): string {
  return "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const PRESET_PACKAGE_TEMPLATES = [
  {
    name: "Chennai - Pondicherry Coastal Weekend",
    code: "PKG_PONDY_3D",
    slug: "chennai-pondicherry-coastal-weekend",
    startingLocation: "Chennai",
    destinations: ["Chennai", "Mahabalipuram", "Pondicherry"],
    durationDays: 3,
    durationNights: 2,
    shortDescription: "3-Day coastal trip featuring UNESCO monuments in Mahabalipuram & French Colony in Pondicherry.",
    fullDescription: "Experience the serene French heritage of Pondicherry combined with ancient rock-cut temples of Mahabalipuram. Includes private AC cab transfer, driver allowance, and flexible itinerary.",
    coverImageUrl: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=600&q=80",
    pricingModel: "Per Package" as const,
    basePrice: 9500,
    offerPrice: 8500,
    adultPrice: 4250,
    childPrice: 2100,
    inclusions: [
      "Dedicated Private AC Sedan / SUV",
      "Driver Batta, Toll, Parking & State Taxes",
      "Hotel Pickup & Drop in Chennai",
      "2 Night Stay with Daily Breakfast",
    ],
    exclusions: [
      "Monument & Temple Entry Tickets",
      "Lunch & Dinner",
      "Personal Expenses & Laundry",
      "GST 5%",
    ],
    itinerary: [
      {
        dayNumber: 1,
        title: "Chennai Pickup → Mahabalipuram → Pondicherry",
        description: "Driver picks up from Chennai. Visit Shore Temple & Pancha Rathas in Mahabalipuram. Proceed to Pondicherry & check in.",
        activities: "Mahabalipuram UNESCO World Heritage Sightseeing",
        meals: "Breakfast",
        stay: "French Quarter Hotel, Pondicherry",
      },
      {
        dayNumber: 2,
        title: "Pondicherry Sightseeing & Auroville",
        description: "Visit Sri Aurobindo Ashram, Auroville Globe Matrimandir, Promenade Beach, and French Colony lanes.",
        activities: "Auroville Visitor Center, Rock Beach Walk",
        meals: "Breakfast",
        stay: "French Quarter Hotel, Pondicherry",
      },
      {
        dayNumber: 3,
        title: "Paradise Beach → Return to Chennai Drop",
        description: "Morning boat ride to Paradise Beach. Afternoon shopping & return drive to Chennai for evening drop.",
        activities: "Paradise Beach Speedboat Ride",
        meals: "Breakfast",
        stay: "Home / Drop",
      },
    ],
  },
  {
    name: "Ooty & Kodaikanal Hill Station Special",
    code: "PKG_OOTY_KODAI_5D",
    slug: "ooty-kodaikanal-hill-station-special",
    startingLocation: "Coimbatore",
    destinations: ["Coimbatore", "Ooty", "Coonoor", "Kodaikanal"],
    durationDays: 5,
    durationNights: 4,
    shortDescription: "5-Day scenic hill station tour covering Ooty botanical gardens, Coonoor tea estates & Kodaikanal lake.",
    fullDescription: "Explore the Queen and Princess of Hill Stations in Tamil Nadu. Enjoy cool mountain air, toy train rides, pine forests, and breathtaking valley view points.",
    coverImageUrl: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=600&q=80",
    pricingModel: "Per Package" as const,
    basePrice: 18500,
    offerPrice: 16900,
    adultPrice: 8450,
    childPrice: 4200,
    inclusions: [
      "Private Hill-Station Spec AC SUV / Innova",
      "All Driver Night Allowances & Fuel Charges",
      "Intercity Tolls & Hill Station Permits",
      "4 Nights Hotel Accommodation with Breakfast",
    ],
    exclusions: [
      "Toy Train Tickets (Subject to availability)",
      "Boating & Botanical Garden Entrance Fees",
      "Lunch & Dinner",
    ],
    itinerary: [
      {
        dayNumber: 1,
        title: "Coimbatore Pickup → Ooty Drive (85 km)",
        description: "Pickup from Coimbatore station/airport. Scenic drive up the Nilgiri ghat road to Ooty. Check in and evening lake walk.",
        activities: "Ooty Lake Evening Stroll",
        meals: "Breakfast",
        stay: "3-Star Mountain Resort, Ooty",
      },
      {
        dayNumber: 2,
        title: "Ooty & Coonoor Sightseeing",
        description: "Visit Botanical Garden, Doddabetta Peak, Tea Factory, and Sim's Park in Coonoor.",
        activities: "Nilgiri Tea Garden Tour & Tasting",
        meals: "Breakfast",
        stay: "3-Star Mountain Resort, Ooty",
      },
      {
        dayNumber: 3,
        title: "Ooty → Kodaikanal Hill Drive (250 km)",
        description: "Drive through Palani hills ghat road to Kodaikanal. Check in at resort and enjoy evening near Kodai Lake.",
        activities: "Ghat Road Viewpoint Stops",
        meals: "Breakfast",
        stay: "Valley View Resort, Kodaikanal",
      },
      {
        dayNumber: 4,
        title: "Kodaikanal Sightseeing",
        description: "Visit Pillar Rocks, Coaker's Walk, Pine Forest, Green Valley View, and Kurinji Andavar Temple.",
        activities: "Pine Forest Walk & Kodai Lake Boating",
        meals: "Breakfast",
        stay: "Valley View Resort, Kodaikanal",
      },
      {
        dayNumber: 5,
        title: "Kodaikanal → Madurai / Coimbatore Drop",
        description: "Morning shopping for Kodai homemade chocolates and spices. Return drop at Madurai or Coimbatore.",
        activities: "Spice & Chocolate Shopping",
        meals: "Breakfast",
        stay: "Home / Drop",
      },
    ],
  },
  {
    name: "Madurai & Rameswaram Temple Pilgrimage",
    code: "PKG_MADURAI_RAMES_3D",
    slug: "madurai-rameswaram-temple-pilgrimage",
    startingLocation: "Madurai",
    destinations: ["Madurai", "Rameswaram", "Dhanushkodi"],
    durationDays: 3,
    durationNights: 2,
    shortDescription: "3-Day sacred temple tour covering Meenakshi Amman Temple, Pamban Bridge & Dhanushkodi.",
    fullDescription: "Holy pilgrimage circuit visiting Meenakshi Amman Temple in Madurai, Ramanathaswamy Temple with 22 holy wells in Rameswaram, and the ghost town of Dhanushkodi.",
    coverImageUrl: "https://images.unsplash.com/photo-1600100397608-f090742f40cb?auto=format&fit=crop&w=600&q=80",
    pricingModel: "Per Package" as const,
    basePrice: 11000,
    offerPrice: 9900,
    adultPrice: 4950,
    childPrice: 2500,
    inclusions: [
      "Private AC Sedan / SUV Cab",
      "Driver Allowance, Toll & Parking",
      "Madurai Airport / Station Pickup & Drop",
      "2 Night Hotel Stay",
    ],
    exclusions: ["Special Darshan Tickets", "Holy Bath / Puja Fees", "Meals"],
    itinerary: [
      {
        dayNumber: 1,
        title: "Madurai Arrival → Meenakshi Amman Temple",
        description: "Pickup in Madurai. Visit Meenakshi Amman Temple, Thirumalai Nayakar Palace, and Gandhi Museum.",
        activities: "Evening Meenakshi Temple Night Ceremony",
        meals: "Breakfast",
        stay: "Heritage Hotel, Madurai",
      },
      {
        dayNumber: 2,
        title: "Madurai → Rameswaram & Pamban Bridge",
        description: "Drive across Pamban Sea Bridge to Rameswaram. Visit Ramanathaswamy Temple, Agni Theertham, and APJ Abdul Kalam Memorial.",
        activities: "Pamban Sea Bridge View & Holy Bath",
        meals: "Breakfast",
        stay: "Pilgrim Resort, Rameswaram",
      },
      {
        dayNumber: 3,
        title: "Dhanushkodi Excursion → Madurai Drop",
        description: "Early morning drive to Dhanushkodi land's end where Bay of Bengal meets Indian Ocean. Return to Madurai for drop.",
        activities: "Dhanushkodi Ram Setu Point Visit",
        meals: "Breakfast",
        stay: "Home / Drop",
      },
    ],
  },
];

const defaultFormState = {
  id: "",
  name: "",
  code: "",
  slug: "",
  shortDescription: "",
  fullDescription: "",
  startingLocation: "Chennai",
  endingLocation: "Chennai",
  destinations: ["Chennai", "Pondicherry"],
  durationDays: 3,
  durationNights: 2,
  pricingModel: "Per Package" as const,
  basePrice: 9500,
  offerPrice: 8500,
  adultPrice: 4250,
  childPrice: 2100,
  allowedVehicleCategoryIds: [] as string[],
  preferredVendorId: "",
  coverImageUrl: "",
  status: "Active" as const,
  published: true,
  featured: false,
  displayOrder: 1,
  inclusions: [
    "Dedicated Private AC Vehicle",
    "Driver Batta, Toll, Parking & Taxes",
    "Hotel Pickup & Drop",
  ],
  exclusions: ["Entry Tickets & Personal Expenses", "Meals not specified", "GST 5%"],
  itinerary: [
    {
      dayNumber: 1,
      title: "Day 1: Arrival & Sightseeing",
      description: "Pickup from location, check in to hotel, and afternoon sightseeing.",
      activities: "City Sightseeing Walk",
      meals: "Breakfast",
      stay: "3-Star Hotel",
    },
    {
      dayNumber: 2,
      title: "Day 2: Full Day Exploration",
      description: "Full day tour of key tourist destinations and local experiences.",
      activities: "Sightseeing & Shopping",
      meals: "Breakfast",
      stay: "3-Star Hotel",
    },
    {
      dayNumber: 3,
      title: "Day 3: Return & Drop",
      description: "Morning check out and comfortable return transfer for drop off.",
      activities: "Return Transfer",
      meals: "Breakfast",
      stay: "Home / Drop",
    },
  ] as ItineraryDay[],
  seoTitle: "",
  seoDescription: "",
};

export default function TourPackages() {
  const [tourPackages, setTourPackages] = useState<TourPackage[]>([]);
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [durationFilter, setDurationFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"order" | "name" | "price_asc" | "price_desc">("order");

  // Editor Modal
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(defaultFormState);
  const [activeTab, setActiveTab] = useState<"basic" | "itinerary" | "pricing" | "inclusions">("basic");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Destination input in form
  const [newDestInput, setNewDestInput] = useState("");

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<TourPackage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const unsubPkgs = subscribeTourPackages((data) => {
      setTourPackages(data);
      setLoading(false);
    });
    const unsubCats = subscribeVehicleCategories((data) => {
      setVehicleCategories(data);
    });
    const unsubVendors = subscribeVendors((data) => {
      setVendors(data);
    });
    const unsubBookings = subscribeBookings((data) => {
      setBookings(data);
    });
    return () => {
      unsubPkgs();
      unsubCats();
      unsubVendors();
      unsubBookings();
    };
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // KPIs
  const stats = useMemo(() => {
    const totalCount = tourPackages.length;
    const activeCount = tourPackages.filter((p) => p.status === "Active").length;
    const draftCount = tourPackages.filter((p) => p.status === "Draft").length;
    const departuresCount = tourPackages.reduce(
      (sum, p) => sum + (p.departures ? p.departures.length : 0),
      0
    );
    return { totalCount, activeCount, draftCount, departuresCount };
  }, [tourPackages]);

  // Filtered & Sorted Packages
  const filteredPackages = useMemo(() => {
    return tourPackages
      .filter((pkg) => {
        const q = search.trim().toLowerCase();
        const matchSearch =
          q === "" ||
          pkg.name.toLowerCase().includes(q) ||
          (pkg.code && pkg.code.toLowerCase().includes(q)) ||
          (pkg.destinations || []).some((d) => d.toLowerCase().includes(q));

        const matchStatus = statusFilter === "All" || pkg.status === statusFilter;

        let matchDuration = true;
        if (durationFilter === "Short") matchDuration = pkg.durationDays <= 3;
        if (durationFilter === "Medium") matchDuration = pkg.durationDays >= 4 && pkg.durationDays <= 7;
        if (durationFilter === "Long") matchDuration = pkg.durationDays >= 8;

        return matchSearch && matchStatus && matchDuration;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "price_asc") return (a.basePrice || 0) - (b.basePrice || 0);
        if (sortBy === "price_desc") return (b.basePrice || 0) - (a.basePrice || 0);
        return (a.displayOrder || 99) - (b.displayOrder || 99);
      });
  }, [tourPackages, search, statusFilter, durationFilter, sortBy]);

  // Modal open
  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData(defaultFormState);
    setActiveTab("basic");
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (pkg: TourPackage) => {
    setIsEditing(true);
    setFormData({
      id: pkg.id,
      name: pkg.name,
      code: pkg.code || "",
      slug: pkg.slug || "",
      shortDescription: pkg.shortDescription || "",
      fullDescription: pkg.fullDescription || "",
      startingLocation: pkg.startingLocation || "Chennai",
      endingLocation: pkg.endingLocation || "Chennai",
      destinations: pkg.destinations || [],
      durationDays: pkg.durationDays || 3,
      durationNights: pkg.durationNights || 2,
      pricingModel: pkg.pricingModel || "Per Package",
      basePrice: pkg.basePrice || 9500,
      offerPrice: pkg.offerPrice || 0,
      adultPrice: pkg.adultPrice || 0,
      childPrice: pkg.childPrice || 0,
      allowedVehicleCategoryIds: pkg.allowedVehicleCategoryIds || [],
      preferredVendorId: pkg.preferredVendorId || "",
      coverImageUrl: pkg.coverImageUrl || "",
      status: pkg.status || "Active",
      published: pkg.published !== false,
      featured: Boolean(pkg.featured),
      displayOrder: pkg.displayOrder || 1,
      inclusions: pkg.inclusions || [],
      exclusions: pkg.exclusions || [],
      itinerary: pkg.itinerary || [],
      seoTitle: pkg.seoTitle || "",
      seoDescription: pkg.seoDescription || "",
    });
    setActiveTab("basic");
    setFormError(null);
    setShowModal(true);
  };

  const handleDuplicate = async (pkg: TourPackage) => {
    const code = `${pkg.code || "PKG"}_COPY`;
    const docId = `PKG-${Date.now().toString().slice(-6)}`;
    const duplicatePayload: TourPackage = {
      ...pkg,
      id: docId,
      name: `${pkg.name} (Copy)`,
      code,
      slug: `${pkg.slug}-copy`,
      status: "Draft",
      published: false,
      createdAt: new Date().toISOString(),
    };

    const ok = await setFirestoreDocument(COLLECTIONS.TOUR_PACKAGES, docId, duplicatePayload);
    if (ok) {
      showToast(`Package duplicated as draft "${duplicatePayload.name}".`, "success");
    } else {
      showToast("Failed to duplicate package.", "error");
    }
  };

  const handleApplyPreset = (tmplName: string) => {
    const tmpl = PRESET_PACKAGE_TEMPLATES.find((t) => t.name === tmplName);
    if (!tmpl) return;
    setFormData((prev) => ({
      ...prev,
      name: tmpl.name,
      code: tmpl.code,
      slug: tmpl.slug,
      startingLocation: tmpl.startingLocation,
      destinations: tmpl.destinations,
      durationDays: tmpl.durationDays,
      durationNights: tmpl.durationNights,
      shortDescription: tmpl.shortDescription,
      fullDescription: tmpl.fullDescription,
      coverImageUrl: tmpl.coverImageUrl,
      pricingModel: tmpl.pricingModel,
      basePrice: tmpl.basePrice,
      offerPrice: tmpl.offerPrice,
      adultPrice: tmpl.adultPrice,
      childPrice: tmpl.childPrice,
      inclusions: tmpl.inclusions,
      exclusions: tmpl.exclusions,
      itinerary: tmpl.itinerary as any,
    }));
  };

  // Itinerary Handlers
  const handleAddItineraryDay = () => {
    const nextDayNum = (formData.itinerary || []).length + 1;
    const newDay: ItineraryDay = {
      dayNumber: nextDayNum,
      title: `Day ${nextDayNum}: Sightseeing & Travel`,
      description: "Day itinerary details and schedule...",
      activities: "Local Sightseeing",
      meals: "Breakfast",
      stay: "Hotel / Resort",
    };
    setFormData((prev) => ({
      ...prev,
      itinerary: [...(prev.itinerary || []), newDay],
    }));
  };

  const handleUpdateItineraryDay = (index: number, updated: Partial<ItineraryDay>) => {
    setFormData((prev) => {
      const list = [...(prev.itinerary || [])];
      list[index] = { ...list[index], ...updated };
      return { ...prev, itinerary: list };
    });
  };

  const handleRemoveItineraryDay = (index: number) => {
    setFormData((prev) => {
      const list = (prev.itinerary || [])
        .filter((_, i) => i !== index)
        .map((d, i) => ({ ...d, dayNumber: i + 1 }));
      return { ...prev, itinerary: list };
    });
  };

  // Category toggle
  const handleToggleCategory = (catId: string) => {
    setFormData((prev) => {
      const current = prev.allowedVehicleCategoryIds || [];
      const updated = current.includes(catId)
        ? current.filter((id) => id !== catId)
        : [...current, catId];
      return { ...prev, allowedVehicleCategoryIds: updated };
    });
  };

  // Destination handlers
  const handleAddDestination = () => {
    if (!newDestInput.trim()) return;
    setFormData((prev) => ({
      ...prev,
      destinations: [...(prev.destinations || []), newDestInput.trim()],
    }));
    setNewDestInput("");
  };

  const handleRemoveDestination = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      destinations: (prev.destinations || []).filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formData.name.trim();
    if (!name) {
      setFormError("Package Name is required.");
      setActiveTab("basic");
      return;
    }

    if (formData.basePrice <= 0 || isNaN(formData.basePrice)) {
      setFormError("Base Package Price must be a valid positive amount.");
      setActiveTab("pricing");
      return;
    }

    const code = (formData.code || name).toUpperCase().replace(/\s+/g, "_");
    const slug = (formData.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const duplicate = tourPackages.find(
      (p) =>
        p.id !== formData.id &&
        (p.name.trim().toLowerCase() === name.toLowerCase() || (p.code && p.code.toUpperCase() === code))
    );

    if (duplicate) {
      setFormError(`A tour package with name "${name}" or code "${code}" already exists.`);
      setActiveTab("basic");
      return;
    }

    setSaving(true);
    try {
      const docId = formData.id ? formData.id : `PKG-${code.substring(0, 12)}`;

      const categoryNames = vehicleCategories
        .filter((c) => (formData.allowedVehicleCategoryIds || []).includes(c.id))
        .map((c) => c.name);

      const prefVendor = vendors.find((v) => v.id === formData.preferredVendorId);

      const payload: TourPackage = {
        id: docId,
        name,
        code,
        slug,
        shortDescription: formData.shortDescription.trim(),
        fullDescription: formData.fullDescription.trim(),
        startingLocation: formData.startingLocation.trim(),
        endingLocation: formData.endingLocation.trim(),
        destinations: formData.destinations,
        durationDays: Number(formData.durationDays || 1),
        durationNights: Number(formData.durationNights || 0),
        itinerary: formData.itinerary,
        pricingModel: formData.pricingModel,
        basePrice: Number(formData.basePrice || 0),
        offerPrice: Number(formData.offerPrice || 0),
        adultPrice: Number(formData.adultPrice || 0),
        childPrice: Number(formData.childPrice || 0),
        allowedVehicleCategoryIds: formData.allowedVehicleCategoryIds,
        allowedVehicleCategoryNames: categoryNames,
        preferredVendorId: formData.preferredVendorId,
        preferredVendorName: prefVendor ? prefVendor.companyName || prefVendor.name : "",
        coverImageUrl: formData.coverImageUrl.trim(),
        status: formData.status,
        published: Boolean(formData.published),
        featured: Boolean(formData.featured),
        displayOrder: Number(formData.displayOrder || 1),
        inclusions: formData.inclusions,
        exclusions: formData.exclusions,
        seoTitle: formData.seoTitle.trim(),
        seoDescription: formData.seoDescription.trim(),
      };

      const ok = await setFirestoreDocument(COLLECTIONS.TOUR_PACKAGES, docId, payload);
      if (ok) {
        setShowModal(false);
        showToast(
          isEditing
            ? `Tour package "${name}" updated successfully.`
            : `Tour package "${name}" created successfully.`,
          "success"
        );
      } else {
        setFormError("Failed to save tour package to database.");
      }
    } catch (err: any) {
      console.error("Save tour package error:", err);
      setFormError(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (pkg: TourPackage) => {
    const newStatus = pkg.status === "Active" ? "Inactive" : "Active";
    const ok = await setFirestoreDocument(COLLECTIONS.TOUR_PACKAGES, pkg.id, {
      ...pkg,
      status: newStatus,
    });
    if (ok) {
      showToast(`Package "${pkg.name}" marked as ${newStatus}.`, "success");
    } else {
      showToast(`Failed to update status for "${pkg.name}".`, "error");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    const bookingCount = bookings.filter(
      (b) =>
        (b.service || "").toLowerCase().includes("tour") ||
        (b.drop || "").toLowerCase().includes((deleteTarget.destinations[0] || "").toLowerCase())
    ).length;

    if (bookingCount > 0) {
      setDeleteError(
        `Cannot delete package "${deleteTarget.name}" because historical bookings exist. Please mark the package as Inactive or Archived instead.`
      );
      setDeleting(false);
      return;
    }

    try {
      const ok = await deleteFirestoreDocument(COLLECTIONS.TOUR_PACKAGES, deleteTarget.id);
      if (ok) {
        setDeleteTarget(null);
        showToast(`Tour package "${deleteTarget.name}" removed.`, "success");
      } else {
        setDeleteError("Failed to delete tour package from database.");
      }
    } catch (err: any) {
      console.error("Delete package error:", err);
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
          <h1 className="text-[20px] font-bold text-[#111111]">Tour Packages</h1>
          <p className="text-[13px] text-[#666666]">
            Create and manage tour packages with itineraries, pricing, vehicle assignments and vendor partnerships.
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
          + Add Tour Package
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Packages",
            value: stats.totalCount.toString(),
            color: "#E21B23",
            sub: "All tour circuits",
          },
          {
            label: "Active Packages",
            value: stats.activeCount.toString(),
            color: "#10B981",
            sub: "Available for booking",
          },
          {
            label: "Draft Packages",
            value: stats.draftCount.toString(),
            color: "#F59E0B",
            sub: "In preparation",
          },
          {
            label: "Upcoming Departures",
            value: stats.departuresCount.toString(),
            color: "#3B82F6",
            sub: "Scheduled departure dates",
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
          Loading tour packages...
        </div>
      ) : tourPackages.length === 0 ? (
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
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2"
              />
            </svg>
          </div>
          <h2 className="text-[18px] font-bold text-[#111111] mb-2">Tour Packages</h2>
          <p className="text-[13px] text-[#999999] max-w-sm mb-6">
            Create and manage tour packages with itineraries, pricing, vehicle assignments and vendor partnerships.
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
        /* Directory Grid & Controls */
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
                placeholder="Search package name, code, destination..."
                className="w-full pl-9 pr-4 py-2 text-[12px] bg-[#FAFAFA] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] placeholder-[#999999]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#E21B23] text-[#444444]"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Inactive">Inactive</option>
              </select>

              <select
                value={durationFilter}
                onChange={(e) => setDurationFilter(e.target.value)}
                className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#E21B23] text-[#444444]"
              >
                <option value="All">All Durations</option>
                <option value="Short">Short (1-3 Days)</option>
                <option value="Medium">Medium (4-7 Days)</option>
                <option value="Long">Long (8+ Days)</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#E21B23] text-[#444444]"
              >
                <option value="order">Display Order</option>
                <option value="name">Package Name</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPackages.length === 0 ? (
              <div className="col-span-full bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-xs text-[#999999]">
                No tour packages match your search filters.
              </div>
            ) : (
              filteredPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  {/* Image / Header */}
                  <div>
                    <div className="relative h-40 bg-gray-100 overflow-hidden">
                      {pkg.coverImageUrl ? (
                        <img
                          src={pkg.coverImageUrl}
                          alt={pkg.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as any).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#FEF2F2] text-[40px]">
                          🏝️
                        </div>
                      )}

                      <div className="absolute top-3 left-3 flex gap-1.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-xs ${
                            pkg.status === "Active"
                              ? "bg-emerald-500 text-white border-emerald-600"
                              : pkg.status === "Draft"
                              ? "bg-amber-500 text-white border-amber-600"
                              : "bg-gray-600 text-white border-gray-700"
                          }`}
                        >
                          {pkg.status}
                        </span>
                        {pkg.featured && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-gray-900 shadow-xs">
                            ★ Featured
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-3 right-3 bg-black/75 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold backdrop-blur-xs">
                        {pkg.durationDays} Days / {pkg.durationNights} Nights
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-[#888888] font-bold uppercase">
                            {pkg.code}
                          </span>
                          <span className="text-[14px] font-black text-[#E21B23]">
                            {formatCurrency(pkg.basePrice)}
                          </span>
                        </div>
                        <h3 className="text-[14px] font-bold text-[#111111] line-clamp-1 mt-0.5">
                          {pkg.name}
                        </h3>
                      </div>

                      {/* Route sequence */}
                      <div className="text-[11px] text-[#666666] flex items-center gap-1 font-medium line-clamp-1">
                        <span className="text-gray-400">📍 Route:</span>
                        <span>{(pkg.destinations || []).join(" → ")}</span>
                      </div>

                      {/* Short Description */}
                      <p className="text-[11px] text-[#777777] line-clamp-2 leading-relaxed">
                        {pkg.shortDescription || "No short description provided."}
                      </p>

                      {/* Vehicle Category Badges & Vendor */}
                      <div className="pt-2 border-t border-[#F5F5F5] flex items-center justify-between text-[10px]">
                        <div className="flex flex-wrap gap-1">
                          {(pkg.allowedVehicleCategoryNames || []).slice(0, 3).map((cName) => (
                            <span key={cName} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                              {cName}
                            </span>
                          ))}
                        </div>

                        {pkg.preferredVendorName && (
                          <span className="text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            Partner: {pkg.preferredVendorName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 bg-[#FAFAFA] border-t border-[#E5E5E5] flex items-center justify-between">
                    <button
                      onClick={() => handleDuplicate(pkg)}
                      className="text-[11px] font-semibold text-gray-600 hover:text-[#E21B23] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>📋</span> Duplicate
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(pkg)}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-[#E5E5E5] text-gray-700 hover:bg-white transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(pkg)}
                        className={`px-2 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                          pkg.status === "Active"
                            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {pkg.status === "Active" ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(pkg)}
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

      {/* Add / Edit Tour Package Modal Editor */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-6">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#FAFAFA]">
              <div>
                <h3 className="text-[16px] font-bold text-[#111111]">
                  {isEditing ? "Edit Tour Package" : "+ Add Tour Package"}
                </h3>
                <p className="text-[11px] text-[#666666]">
                  Configure tour itineraries, destinations, vehicle assignments, and pricing.
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
                    {PRESET_PACKAGE_TEMPLATES.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.durationDays}D/{t.durationNights}N)
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
            <div className="flex border-b border-[#E5E5E5] bg-[#F5F5F5] px-6 pt-2 overflow-x-auto">
              {[
                { id: "basic", label: "Basic Info & Route" },
                { id: "itinerary", label: "Day-by-Day Itinerary" },
                { id: "pricing", label: "Pricing & Vehicles" },
                { id: "inclusions", label: "Inclusions & Terms" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 text-[12px] font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
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

                {/* TAB 1: BASIC INFO & ROUTE */}
                {activeTab === "basic" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Package Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Chennai - Pondicherry Coastal Weekend"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-[#111111] mb-1">
                            Code
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. PKG_PONDY"
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
                            placeholder="e.g. pondy-tour"
                            value={formData.slug}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                            className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] font-mono focus:outline-none focus:border-[#E21B23]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Route Destinations Builder */}
                    <div className="p-3 bg-gray-50 rounded-xl border border-[#E5E5E5] space-y-2">
                      <label className="block text-[11px] font-bold text-[#111111]">
                        Route & Destinations Sequence
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {(formData.destinations || []).map((dest, idx) => (
                          <span
                            key={idx}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-gray-300 text-xs font-semibold text-gray-800 shadow-2xs"
                          >
                            <span>📍 {dest}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveDestination(idx)}
                              className="text-red-500 font-bold hover:text-red-700 ml-1"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Add destination stop (e.g. Pondicherry)..."
                          value={newDestInput}
                          onChange={(e) => setNewDestInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddDestination();
                            }
                          }}
                          className="flex-1 p-2 border border-[#E5E5E5] rounded-lg text-[12px] bg-white focus:outline-none focus:border-[#E21B23]"
                        />
                        <button
                          type="button"
                          onClick={handleAddDestination}
                          className="px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800"
                        >
                          + Add Stop
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Duration Days *
                        </label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={formData.durationDays}
                          onChange={(e) =>
                            setFormData({ ...formData, durationDays: parseInt(e.target.value) || 1 })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Duration Nights *
                        </label>
                        <input
                          type="number"
                          min={0}
                          required
                          value={formData.durationNights}
                          onChange={(e) =>
                            setFormData({ ...formData, durationNights: parseInt(e.target.value) || 0 })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Status
                        </label>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        >
                          <option value="Active">Active (Published)</option>
                          <option value="Draft">Draft (Internal)</option>
                          <option value="Inactive">Inactive (Hidden)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#111111] mb-1">
                        Short Tagline Description
                      </label>
                      <input
                        type="text"
                        placeholder="Brief 1-line overview for cards..."
                        value={formData.shortDescription}
                        onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#111111] mb-1">
                        Cover Image URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/photo-..."
                        value={formData.coverImageUrl}
                        onChange={(e) => setFormData({ ...formData, coverImageUrl: e.target.value })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 2: ITINERARY BUILDER */}
                {activeTab === "itinerary" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] font-bold text-[#111111]">
                        Day-by-Day Tour Itinerary ({formData.itinerary?.length || 0} Days)
                      </label>
                      <button
                        type="button"
                        onClick={handleAddItineraryDay}
                        className="px-3 py-1.5 bg-[#E21B23] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer"
                      >
                        + Add Day
                      </button>
                    </div>

                    {(formData.itinerary || []).map((day, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-[#E5E5E5] space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="font-bold text-xs text-[#E21B23] uppercase">
                            Day {day.dayNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItineraryDay(idx)}
                            className="text-xs font-semibold text-red-600 hover:text-red-800"
                          >
                            Remove Day
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-700 mb-1">
                              Day Title
                            </label>
                            <input
                              type="text"
                              value={day.title}
                              onChange={(e) => handleUpdateItineraryDay(idx, { title: e.target.value })}
                              placeholder="e.g. Day 1: Chennai Pickup & Sightseeing"
                              className="w-full p-2 border border-[#E5E5E5] rounded-lg text-xs bg-white focus:outline-none focus:border-[#E21B23]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-700 mb-1">
                              Stay / Accommodation
                            </label>
                            <input
                              type="text"
                              value={day.stay || ""}
                              onChange={(e) => handleUpdateItineraryDay(idx, { stay: e.target.value })}
                              placeholder="e.g. 3-Star Hotel in Pondicherry"
                              className="w-full p-2 border border-[#E5E5E5] rounded-lg text-xs bg-white focus:outline-none focus:border-[#E21B23]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-700 mb-1">
                            Day Schedule & Overview
                          </label>
                          <textarea
                            rows={2}
                            value={day.description}
                            onChange={(e) => handleUpdateItineraryDay(idx, { description: e.target.value })}
                            placeholder="Detail planned morning, afternoon and evening schedule..."
                            className="w-full p-2 border border-[#E5E5E5] rounded-lg text-xs bg-white focus:outline-none focus:border-[#E21B23]"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-700 mb-1">
                              Key Activities & Visits
                            </label>
                            <input
                              type="text"
                              value={day.activities || ""}
                              onChange={(e) => handleUpdateItineraryDay(idx, { activities: e.target.value })}
                              placeholder="e.g. Beach walk, Monument visits"
                              className="w-full p-2 border border-[#E5E5E5] rounded-lg text-xs bg-white focus:outline-none focus:border-[#E21B23]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-700 mb-1">
                              Meals Included
                            </label>
                            <input
                              type="text"
                              value={day.meals || ""}
                              onChange={(e) => handleUpdateItineraryDay(idx, { meals: e.target.value })}
                              placeholder="e.g. Breakfast & Dinner"
                              className="w-full p-2 border border-[#E5E5E5] rounded-lg text-xs bg-white focus:outline-none focus:border-[#E21B23]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 3: PRICING & VEHICLES */}
                {activeTab === "pricing" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Base Package Price (₹) *
                        </label>
                        <input
                          type="number"
                          min={0}
                          required
                          value={formData.basePrice}
                          onChange={(e) =>
                            setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Offer / Special Price (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.offerPrice}
                          onChange={(e) =>
                            setFormData({ ...formData, offerPrice: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#111111] mb-1">
                          Pricing Model
                        </label>
                        <select
                          value={formData.pricingModel}
                          onChange={(e) => setFormData({ ...formData, pricingModel: e.target.value as any })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                        >
                          <option value="Per Package">Per Package (Flat)</option>
                          <option value="Per Person">Per Person</option>
                          <option value="Vehicle Based">Vehicle Based</option>
                        </select>
                      </div>
                    </div>

                    {/* Preferred Vendor Assignment */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#111111] mb-1">
                        Preferred Fleet Partner / Vendor
                      </label>
                      <select
                        value={formData.preferredVendorId}
                        onChange={(e) => setFormData({ ...formData, preferredVendorId: e.target.value })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                      >
                        <option value="">-- Internal Fleet / Open Partner Assignment --</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.companyName || v.name} ({v.city})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Vehicle Categories */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#111111] mb-2">
                        Eligible Vehicle Categories for this Package
                      </label>
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
                    </div>
                  </div>
                )}

                {/* TAB 4: INCLUSIONS & TERMS */}
                {activeTab === "inclusions" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[#111111] mb-1">
                        Package Inclusions (Comma Separated)
                      </label>
                      <textarea
                        rows={3}
                        value={(formData.inclusions || []).join("\n")}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            inclusions: e.target.value.split("\n").filter((s) => s.trim() !== ""),
                          })
                        }
                        placeholder="Enter each inclusion on a new line..."
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#111111] mb-1">
                        Package Exclusions (Comma Separated)
                      </label>
                      <textarea
                        rows={3}
                        value={(formData.exclusions || []).join("\n")}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            exclusions: e.target.value.split("\n").filter((s) => s.trim() !== ""),
                          })
                        }
                        placeholder="Enter each exclusion on a new line..."
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
                  className="px-4 py-2 border border-[#E5E5E5] rounded-lg text-[12px] font-semibold text-gray-700 hover:bg-gray-100"
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
                    ? "Update Tour Package"
                    : "Save Tour Package"}
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
                <h3 className="text-base font-bold text-gray-900">Delete Tour Package?</h3>
                <p className="text-xs text-gray-500 font-mono">{deleteTarget.name} ({deleteTarget.code})</p>
              </div>
            </div>

            <p className="text-xs text-gray-600">
              Are you sure you want to delete this tour package? Historical bookings will remain intact.
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
