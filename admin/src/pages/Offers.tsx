import { useState, useEffect, useMemo } from "react";
import {
  MasterCoupon,
  DiscountType,
  CouponStatus,
  TravelService,
  VehicleCategory,
  Booking,
  CouponValidationContext,
  CouponValidationResult,
} from "../types";
import {
  subscribeCoupons,
  subscribeServices,
  subscribeVehicleCategories,
  subscribeBookings,
  addFirestoreDocument,
  setFirestoreDocument,
  deleteFirestoreDocument,
  COLLECTIONS,
} from "../services/adminFirestoreService";
import {
  normalizeCouponCode,
  getEffectiveCouponStatus,
  validateAndCalculateCoupon,
} from "../services/couponEngine";

const STATUS_BADGES: Record<CouponStatus, { bg: string; text: string; border: string }> = {
  Active: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  Scheduled: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  Expired: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  Inactive: { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200" },
  Draft: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  Archived: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

// Preset Baseline Offers for Nesam Tours & Travels
const PRESET_COUPONS: Partial<MasterCoupon>[] = [
  {
    name: "Flat ₹200 OFF Welcome Offer",
    code: "NESAM200",
    description: "Flat ₹200 discount on all taxi bookings above ₹1,000.",
    discountType: "FIXED_AMOUNT",
    discountValue: 200,
    minimumBookingAmount: 1000,
    validFrom: new Date().toISOString().split("T")[0],
    validUntil: "2026-12-31",
    totalUsageLimit: 500,
    usedCount: 14,
    perCustomerLimit: 1,
    status: "Active",
  },
  {
    name: "Airport Taxi 10% Special",
    code: "AIRPORT10",
    description: "10% OFF on all Airport Pickup & Drop bookings (Max discount ₹300).",
    discountType: "PERCENTAGE",
    discountValue: 10,
    maximumDiscount: 300,
    minimumBookingAmount: 800,
    serviceNames: ["Airport Taxi"],
    validFrom: new Date().toISOString().split("T")[0],
    validUntil: "2026-12-31",
    totalUsageLimit: 250,
    usedCount: 28,
    perCustomerLimit: 2,
    status: "Active",
  },
  {
    name: "Outstation Flat ₹500 Mega Discount",
    code: "OUTSTATION500",
    description: "Flat ₹500 OFF on multi-day outstation trips over ₹3,000.",
    discountType: "FIXED_AMOUNT",
    discountValue: 500,
    minimumBookingAmount: 3000,
    serviceNames: ["Outstation Cab", "One Way Taxi"],
    validFrom: new Date().toISOString().split("T")[0],
    validUntil: "2026-12-31",
    totalUsageLimit: 100,
    usedCount: 8,
    perCustomerLimit: 1,
    status: "Active",
  },
  {
    name: "First Time Customer 15% OFF",
    code: "FIRSTFEST",
    description: "15% discount for first-time customer bookings (Max ₹400).",
    discountType: "PERCENTAGE",
    discountValue: 15,
    maximumDiscount: 400,
    minimumBookingAmount: 500,
    firstBookingOnly: true,
    validFrom: new Date().toISOString().split("T")[0],
    validUntil: "2026-12-31",
    totalUsageLimit: 1000,
    usedCount: 42,
    perCustomerLimit: 1,
    status: "Active",
  },
];

export default function Offers() {
  const [coupons, setCoupons] = useState<MasterCoupon[]>([]);
  const [services, setServices] = useState<TravelService[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Controls
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [serviceFilter, setServiceFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "code" | "discount" | "usage">("newest");

  // Modal Form State
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<MasterCoupon | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "discount" | "validity" | "restrictions">("basic");

  // Form Fields
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    description: string;
    termsAndConditions: string;
    discountType: DiscountType;
    discountValue: number;
    maximumDiscount: string;
    minimumBookingAmount: string;
    validFrom: string;
    validUntil: string;
    totalUsageLimit: string;
    perCustomerLimit: string;
    firstBookingOnly: boolean;
    serviceNames: string[];
    vehicleCategoryIds: string[];
    adminBookingOnly: boolean;
    status: CouponStatus;
  }>({
    name: "",
    code: "",
    description: "",
    termsAndConditions: "",
    discountType: "PERCENTAGE",
    discountValue: 10,
    maximumDiscount: "",
    minimumBookingAmount: "1000",
    validFrom: new Date().toISOString().split("T")[0],
    validUntil: "2026-12-31",
    totalUsageLimit: "100",
    perCustomerLimit: "1",
    firstBookingOnly: false,
    serviceNames: [],
    vehicleCategoryIds: [],
    adminBookingOnly: false,
    status: "Active",
  });

  // Simulator Test Widget
  const [simCode, setSimCode] = useState("NESAM200");
  const [simSubtotal, setSimSubtotal] = useState<number>(1500);
  const [simService, setSimService] = useState("Airport Taxi");
  const [simResult, setSimResult] = useState<CouponValidationResult | null>(null);

  // Delete & Safety Dialog
  const [deletingCoupon, setDeletingCoupon] = useState<MasterCoupon | null>(null);
  const [deleteRefNotice, setDeleteRefNotice] = useState<string | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubC = subscribeCoupons((data) => {
      setCoupons(data);
      setLoading(false);
    });
    const unsubS = subscribeServices(setServices);
    const unsubCat = subscribeVehicleCategories(setCategories);
    const unsubB = subscribeBookings(setBookings);

    return () => {
      unsubC();
      unsubS();
      unsubCat();
      unsubB();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Run Test Simulation Widget
  useEffect(() => {
    if (simCode.trim()) {
      const context: CouponValidationContext = {
        eligibleSubtotal: simSubtotal,
        serviceName: simService,
        currentDate: new Date(),
      };
      const res = validateAndCalculateCoupon(coupons, simCode, context);
      setSimResult(res);
    } else {
      setSimResult(null);
    }
  }, [simCode, simSubtotal, simService, coupons]);

  // Dashboard Stats
  const stats = useMemo(() => {
    const total = coupons.length;
    let active = 0;
    let scheduled = 0;
    let expired = 0;
    let totalUsed = 0;

    const now = new Date();

    coupons.forEach((c) => {
      const eff = getEffectiveCouponStatus(c, now);
      if (eff === "Active") active++;
      if (eff === "Scheduled") scheduled++;
      if (eff === "Expired") expired++;
      totalUsed += c.usedCount || 0;
    });

    return { total, active, scheduled, expired, totalUsed };
  }, [coupons]);

  // Filtered & Sorted Coupons
  const filteredCoupons = useMemo(() => {
    const now = new Date();
    return coupons
      .filter((c) => {
        const q = search.trim().toLowerCase();
        const matchSearch =
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q));

        const effectiveStatus = getEffectiveCouponStatus(c, now);
        const matchStatus = statusFilter === "All" || effectiveStatus === statusFilter || c.status === statusFilter;
        const matchType = typeFilter === "All" || c.discountType === typeFilter;
        const matchService =
          serviceFilter === "All" ||
          !c.serviceNames ||
          c.serviceNames.length === 0 ||
          c.serviceNames.includes(serviceFilter);

        return matchSearch && matchStatus && matchType && matchService;
      })
      .sort((a, b) => {
        if (sortBy === "code") return a.code.localeCompare(b.code);
        if (sortBy === "discount") return b.discountValue - a.discountValue;
        if (sortBy === "usage") return (b.usedCount || 0) - (a.usedCount || 0);
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
  }, [coupons, search, statusFilter, typeFilter, serviceFilter, sortBy]);

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingCoupon(null);
    setFormData({
      name: "",
      code: "",
      description: "",
      termsAndConditions: "",
      discountType: "PERCENTAGE",
      discountValue: 10,
      maximumDiscount: "500",
      minimumBookingAmount: "1000",
      validFrom: new Date().toISOString().split("T")[0],
      validUntil: "2026-12-31",
      totalUsageLimit: "100",
      perCustomerLimit: "1",
      firstBookingOnly: false,
      serviceNames: [],
      vehicleCategoryIds: [],
      adminBookingOnly: false,
      status: "Active",
    });

    setFormError(null);
    setActiveTab("basic");
    setShowModal(true);
  };

  // Open Edit Form
  const handleOpenEdit = (c: MasterCoupon) => {
    setEditingCoupon(c);
    setFormData({
      name: c.name || "",
      code: c.code || "",
      description: c.description || "",
      termsAndConditions: c.termsAndConditions || "",
      discountType: c.discountType || "PERCENTAGE",
      discountValue: c.discountValue || 0,
      maximumDiscount: c.maximumDiscount ? String(c.maximumDiscount) : "",
      minimumBookingAmount: c.minimumBookingAmount ? String(c.minimumBookingAmount) : "",
      validFrom: c.validFrom || new Date().toISOString().split("T")[0],
      validUntil: c.validUntil || "2026-12-31",
      totalUsageLimit: c.totalUsageLimit !== undefined ? String(c.totalUsageLimit) : "",
      perCustomerLimit: c.perCustomerLimit !== undefined ? String(c.perCustomerLimit) : "1",
      firstBookingOnly: c.firstBookingOnly || false,
      serviceNames: c.serviceNames || [],
      vehicleCategoryIds: c.vehicleCategoryIds || [],
      adminBookingOnly: c.adminBookingOnly || false,
      status: c.status || "Active",
    });

    setFormError(null);
    setActiveTab("basic");
    setShowModal(true);
  };

  // Save Form Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nameTrim = formData.name.trim();
    const codeNorm = normalizeCouponCode(formData.code);

    if (!nameTrim) {
      setFormError("Offer Name is required.");
      setActiveTab("basic");
      return;
    }

    if (!codeNorm) {
      setFormError("Coupon Code is required.");
      setActiveTab("basic");
      return;
    }

    if (formData.discountValue <= 0) {
      setFormError("Discount value must be greater than 0.");
      setActiveTab("discount");
      return;
    }

    if (formData.discountType === "PERCENTAGE" && formData.discountValue > 100) {
      setFormError("Percentage discount cannot exceed 100%.");
      setActiveTab("discount");
      return;
    }

    // Uniqueness Check
    const existingDup = coupons.find(
      (c) => normalizeCouponCode(c.code) === codeNorm && (!editingCoupon || c.id !== editingCoupon.id)
    );

    if (existingDup) {
      setFormError(`A coupon with code "${codeNorm}" already exists. Codes must be unique.`);
      setActiveTab("basic");
      return;
    }

    setIsSubmitting(true);

    const payload: Partial<MasterCoupon> = {
      name: nameTrim,
      code: codeNorm,
      description: formData.description.trim(),
      termsAndConditions: formData.termsAndConditions.trim(),
      discountType: formData.discountType,
      discountValue: Number(formData.discountValue) || 0,
      maximumDiscount: formData.maximumDiscount ? Number(formData.maximumDiscount) : undefined,
      minimumBookingAmount: formData.minimumBookingAmount ? Number(formData.minimumBookingAmount) : undefined,
      validFrom: formData.validFrom,
      validUntil: formData.validUntil,
      totalUsageLimit: formData.totalUsageLimit ? Number(formData.totalUsageLimit) : undefined,
      usedCount: editingCoupon ? editingCoupon.usedCount || 0 : 0,
      perCustomerLimit: formData.perCustomerLimit ? Number(formData.perCustomerLimit) : 1,
      firstBookingOnly: formData.firstBookingOnly,
      serviceNames: formData.serviceNames,
      vehicleCategoryIds: formData.vehicleCategoryIds,
      adminBookingOnly: formData.adminBookingOnly,
      status: formData.status,
    };

    let ok = false;
    let newDocId: string | null = null;
    if (editingCoupon) {
      ok = await setFirestoreDocument(COLLECTIONS.COUPONS, editingCoupon.id, payload);
    } else {
      newDocId = await addFirestoreDocument(COLLECTIONS.COUPONS, payload);
      ok = !!newDocId;
    }

    setIsSubmitting(false);

    if (ok) {
      if (editingCoupon) {
        setCoupons((prev) => prev.map((c) => (c.id === editingCoupon.id ? ({ ...c, ...payload } as MasterCoupon) : c)));
      } else {
        setCoupons((prev) => [{ id: newDocId || `CPN-${Date.now()}`, ...payload } as MasterCoupon, ...prev]);
      }
      setShowModal(false);
      showToast(
        editingCoupon
          ? `Coupon "${codeNorm}" updated successfully.`
          : `Coupon "${codeNorm}" created successfully.`
      );
    } else {
      setFormError("Failed to save offer. Please check your internet connection.");
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (c: MasterCoupon) => {
    const nextStatus = c.status === "Active" ? "Inactive" : "Active";
    const ok = await setFirestoreDocument(COLLECTIONS.COUPONS, c.id, {
      status: nextStatus,
    });
    if (ok) {
      showToast(`Coupon "${c.code}" is now ${nextStatus}.`);
    }
  };

  // Duplicate Coupon
  const handleDuplicate = async (c: MasterCoupon) => {
    const newCode = `${c.code}_COPY`;
    const copyPayload: Partial<MasterCoupon> = {
      ...c,
      name: `${c.name} (Copy)`,
      code: newCode,
      usedCount: 0,
      status: "Inactive",
    };
    delete (copyPayload as any).id;

    const id = await addFirestoreDocument(COLLECTIONS.COUPONS, copyPayload);
    if (id) {
      showToast(`Duplicated coupon as "${newCode}".`);
    }
  };

  // Prompt Delete
  const handlePromptDelete = (c: MasterCoupon) => {
    setDeletingCoupon(c);
    setDeleteRefNotice(null);

    // Check if any booking redeemed this coupon
    const refBookings = bookings.filter(
      (b) => (b as any).appliedCoupon?.toLowerCase() === c.code.toLowerCase()
    );

    if (refBookings.length > 0 || (c.usedCount || 0) > 0) {
      setDeleteRefNotice(
        `This coupon has ${refBookings.length || c.usedCount} recorded redemption(s). Hard deletion will remove financial audit trail. Deactivating is recommended.`
      );
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingCoupon) return;
    const ok = await deleteFirestoreDocument(COLLECTIONS.COUPONS, deletingCoupon.id);
    if (ok) {
      showToast(`Coupon "${deletingCoupon.code}" deleted.`);
    }
    setDeletingCoupon(null);
  };

  // Preset Auto-Populate
  const handleLoadPresets = async () => {
    if (!window.confirm("Load baseline promotional coupons for Nesam Tours & Travels?")) {
      return;
    }
    setLoading(true);
    let count = 0;

    for (const preset of PRESET_COUPONS) {
      const exists = coupons.some(
        (c) => normalizeCouponCode(c.code) === normalizeCouponCode(preset.code || "")
      );
      if (!exists) {
        await addFirestoreDocument(COLLECTIONS.COUPONS, preset);
        count++;
      }
    }

    setLoading(false);
    showToast(`Successfully loaded ${count} preset offers!`);
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
          <h1 className="text-xl font-bold text-[#111111] tracking-tight">Offers & Coupons</h1>
          <p className="text-xs text-[#666] mt-0.5">
            Create discount codes and promotional coupons with usage limits, expiry dates and service restrictions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {coupons.length > 0 && (
            <button
              onClick={handleLoadPresets}
              className="px-3 py-2 text-xs font-semibold text-[#111111] bg-white border border-[#E5E5E5] rounded-xl hover:bg-gray-50 transition-all flex items-center gap-1.5 shadow-xs"
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
            Create Offer
          </button>
        </div>
      </div>

      {/* Dashboard Summary Cards */}
      {coupons.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#E21B23] flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#666]">Total Offers</div>
              <div className="text-lg font-bold text-[#111111]">{stats.total}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#666]">Active Offers</div>
              <div className="text-lg font-bold text-[#111111]">{stats.active}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#666]">Scheduled Offers</div>
              <div className="text-lg font-bold text-[#111111]">{stats.scheduled}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#666]">Total Redemptions</div>
              <div className="text-lg font-bold text-[#111111]">{stats.totalUsed}</div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Coupon Test Simulator Widget */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-50 text-[#E21B23] flex items-center justify-center font-bold text-xs">
              🏷️
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111111]">Coupon Verification Test Engine</h2>
              <p className="text-[11px] text-[#666]">
                Simulate promo codes and subtotal thresholds to test real-time validation and discount calculations.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
            Engine Connected
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-semibold text-[#666] mb-1">Coupon Code to Test</label>
            <input
              type="text"
              value={simCode}
              onChange={(e) => setSimCode(e.target.value)}
              placeholder="e.g. NESAM200, AIRPORT10"
              className="w-full p-2 border border-[#E5E5E5] rounded-xl font-mono uppercase text-xs focus:border-[#E21B23] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#666] mb-1">Eligible Subtotal (₹)</label>
            <input
              type="number"
              value={simSubtotal}
              onChange={(e) => setSimSubtotal(parseFloat(e.target.value) || 0)}
              className="w-full p-2 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none font-bold"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#666] mb-1">Service Context</label>
            <select
              value={simService}
              onChange={(e) => setSimService(e.target.value)}
              className="w-full p-2 border border-[#E5E5E5] rounded-xl bg-white text-xs focus:border-[#E21B23] focus:outline-none"
            >
              {services.length > 0
                ? services.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))
                : ["Airport Taxi", "Outstation Cab", "One Way Taxi", "Local Rental", "Tour Package"].map((srv) => (
                    <option key={srv} value={srv}>
                      {srv}
                    </option>
                  ))}
            </select>
          </div>
        </div>

        {/* Live Simulation Output Display */}
        {simResult && (
          <div
            className={`border rounded-xl p-3.5 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              simResult.valid
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                : "bg-red-50/70 border-red-200 text-red-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-white shrink-0 ${simResult.valid ? "bg-emerald-600" : "bg-red-600"}`}>
                {simResult.valid ? "✓" : "✕"}
              </span>
              <div>
                <div className="font-bold text-sm">{simResult.message}</div>
                {simResult.coupon && (
                  <div className="text-[10px] text-gray-600 mt-0.5">
                    Code: <strong className="font-mono text-gray-900">{simResult.coupon.code}</strong> | Valid: {simResult.coupon.validFrom} to {simResult.coupon.validUntil}
                  </div>
                )}
              </div>
            </div>

            {simResult.valid && (
              <div className="text-right shrink-0">
                <div className="text-[10px] text-gray-600">Final Payable Amount:</div>
                <div className="text-base font-bold text-[#E21B23]">
                  ₹{simResult.finalPayableAmount.toLocaleString()}
                  <span className="text-xs font-normal text-emerald-700 ml-1.5">(-₹{simResult.discountAmount})</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content Directory */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-2 border-[#E21B23] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-[#666]">Loading Master Offers & Coupons from Firestore…</p>
        </div>
      ) : coupons.length === 0 ? (
        /* Empty State Placeholder (Matches Screenshot & Prompt Instructions) */
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-10 sm:p-16 text-center max-w-2xl mx-auto my-8 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#E21B23] flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-inner">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[#111111] mb-2">Offers & Coupons</h2>
          <p className="text-xs text-[#666] mb-6 leading-relaxed max-w-md mx-auto">
            Create discount codes and promotional coupons with usage limits, expiry dates and service restrictions.
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
              Load Preset Offers
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 sm:p-5 space-y-4 shadow-xs">
          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="relative flex-1">
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search offers by code, name, description..."
                className="w-full pl-9 pr-4 py-2 border border-[#E5E5E5] rounded-xl text-xs focus:outline-none focus:border-[#E21B23]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-[#E5E5E5] rounded-xl text-xs bg-white text-[#111111] focus:outline-none focus:border-[#E21B23]"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Expired">Expired</option>
                <option value="Inactive">Inactive</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-[#E5E5E5] rounded-xl text-xs bg-white text-[#111111] focus:outline-none focus:border-[#E21B23]"
              >
                <option value="All">All Types</option>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
              </select>

              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="px-3 py-2 border border-[#E5E5E5] rounded-xl text-xs bg-white text-[#111111] focus:outline-none focus:border-[#E21B23]"
              >
                <option value="All">All Services</option>
                {services.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-[#E5E5E5] rounded-xl text-xs bg-white text-[#111111] focus:outline-none focus:border-[#E21B23]"
              >
                <option value="newest">Sort: Newest</option>
                <option value="code">Sort: Code</option>
                <option value="discount">Sort: Discount</option>
                <option value="usage">Sort: Usage</option>
              </select>
            </div>
          </div>

          {/* Offers Table */}
          <div className="overflow-x-auto border border-[#E5E5E5] rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-[#E5E5E5] text-[#666] font-semibold">
                <tr>
                  <th className="py-3 px-3">Offer / Code</th>
                  <th className="py-3 px-3">Discount Value</th>
                  <th className="py-3 px-3">Validity Window</th>
                  <th className="py-3 px-3">Usage Stats</th>
                  <th className="py-3 px-3">Service Scope</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredCoupons.map((c) => {
                  const effectiveStatus = getEffectiveCouponStatus(c);
                  const badge = STATUS_BADGES[effectiveStatus] || STATUS_BADGES.Inactive;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-3 font-semibold text-[#111111]">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 font-mono font-bold bg-[#111111] text-white rounded text-[11px] tracking-wider">
                            {c.code}
                          </span>
                          <span>{c.name}</span>
                        </div>
                        {c.description && <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{c.description}</div>}
                      </td>

                      <td className="py-3 px-3 font-bold text-[#E21B23]">
                        {c.discountType === "PERCENTAGE" ? (
                          <span>
                            {c.discountValue}% OFF
                            {c.maximumDiscount && <span className="text-[10px] text-gray-500 font-normal"> (Max ₹{c.maximumDiscount})</span>}
                          </span>
                        ) : (
                          <span>₹{c.discountValue} OFF</span>
                        )}
                        {c.minimumBookingAmount && (
                          <div className="text-[10px] text-gray-500 font-normal">Min ₹{c.minimumBookingAmount}</div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-[#111111]">
                        <div>{c.validFrom} to {c.validUntil}</div>
                      </td>

                      <td className="py-3 px-3 text-[#111111] font-medium">
                        <div>
                          {c.usedCount || 0} / {c.totalUsageLimit ? c.totalUsageLimit : "∞"} used
                        </div>
                      </td>

                      <td className="py-3 px-3 text-[#666]">
                        {c.serviceNames && c.serviceNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.serviceNames.map((s) => (
                              <span key={s} className="px-1.5 py-0.5 text-[10px] bg-gray-100 rounded text-gray-700">
                                {s}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400">All Services</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {effectiveStatus}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right space-x-2">
                        <button
                          onClick={() => handleToggleStatus(c)}
                          className={`text-[11px] font-semibold ${
                            c.status === "Active" ? "text-amber-600 hover:underline" : "text-emerald-600 hover:underline"
                          }`}
                        >
                          {c.status === "Active" ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => handleDuplicate(c)}
                          className="text-blue-600 hover:underline font-semibold text-[11px]"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="text-[#111111] hover:underline font-semibold text-[11px]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handlePromptDelete(c)}
                          className="text-red-600 hover:underline font-semibold text-[11px]"
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
        </div>
      )}

      {/* Add / Edit Offer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-[#E5E5E5] max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E5E5E5] flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-base font-bold text-[#111111]">
                  {editingCoupon ? "Edit Offer / Coupon" : "Create Offer / Coupon"}
                </h3>
                <p className="text-[11px] text-[#666]">
                  Configure discount parameters, validity dates, usage caps, and service restrictions.
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
                  activeTab === "basic" ? "border-[#E21B23] text-[#E21B23]" : "border-transparent text-[#666] hover:text-[#111111]"
                }`}
              >
                1. Basic Info & Code
              </button>
              <button
                onClick={() => setActiveTab("discount")}
                className={`pb-2.5 border-b-2 transition-all ${
                  activeTab === "discount" ? "border-[#E21B23] text-[#E21B23]" : "border-transparent text-[#666] hover:text-[#111111]"
                }`}
              >
                2. Discount Configuration
              </button>
              <button
                onClick={() => setActiveTab("validity")}
                className={`pb-2.5 border-b-2 transition-all ${
                  activeTab === "validity" ? "border-[#E21B23] text-[#E21B23]" : "border-transparent text-[#666] hover:text-[#111111]"
                }`}
              >
                3. Validity & Limits
              </button>
              <button
                onClick={() => setActiveTab("restrictions")}
                className={`pb-2.5 border-b-2 transition-all ${
                  activeTab === "restrictions" ? "border-[#E21B23] text-[#E21B23]" : "border-transparent text-[#666] hover:text-[#111111]"
                }`}
              >
                4. Restrictions
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
                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Offer Title / Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Flat ₹200 Welcome Offer"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Coupon Code * (Uppercase, Normalized)
                      </label>
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        placeholder="e.g. NESAM200, AIRPORT10"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs font-mono font-bold uppercase focus:border-[#E21B23] focus:outline-none text-[#E21B23]"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Short Description
                      </label>
                      <input
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Customer-facing offer details (e.g. 10% OFF on all airport rides above ₹1000)"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Terms & Conditions
                      </label>
                      <textarea
                        rows={2}
                        value={formData.termsAndConditions}
                        onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                        placeholder="Detailed terms, non-refundable conditions, single-use policy..."
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DISCOUNT CONFIGURATION */}
              {activeTab === "discount" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Discount Type *
                      </label>
                      <select
                        value={formData.discountType}
                        onChange={(e) => setFormData({ ...formData, discountType: e.target.value as DiscountType })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs bg-white focus:border-[#E21B23] focus:outline-none font-semibold"
                      >
                        <option value="PERCENTAGE">Percentage (%) Discount</option>
                        <option value="FIXED_AMOUNT">Fixed Amount (₹) Discount</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        {formData.discountType === "PERCENTAGE" ? "Discount Percentage (%) *" : "Discount Amount (₹) *"}
                      </label>
                      <input
                        type="number"
                        value={formData.discountValue}
                        onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                        placeholder={formData.discountType === "PERCENTAGE" ? "e.g. 15" : "e.g. 200"}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs font-bold focus:border-[#E21B23] focus:outline-none"
                        required
                      />
                    </div>

                    {formData.discountType === "PERCENTAGE" && (
                      <div>
                        <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                          Maximum Discount Cap (₹)
                        </label>
                        <input
                          type="number"
                          value={formData.maximumDiscount}
                          onChange={(e) => setFormData({ ...formData, maximumDiscount: e.target.value })}
                          placeholder="e.g. 500 (Leave empty for uncapped)"
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Minimum Booking Subtotal (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.minimumBookingAmount}
                        onChange={(e) => setFormData({ ...formData, minimumBookingAmount: e.target.value })}
                        placeholder="e.g. 1000"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: VALIDITY & LIMITS */}
              {activeTab === "validity" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Valid From Date *
                      </label>
                      <input
                        type="date"
                        value={formData.validFrom}
                        onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Valid Until Date *
                      </label>
                      <input
                        type="date"
                        value={formData.validUntil}
                        onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Total Global Usage Limit
                      </label>
                      <input
                        type="number"
                        value={formData.totalUsageLimit}
                        onChange={(e) => setFormData({ ...formData, totalUsageLimit: e.target.value })}
                        placeholder="e.g. 100 (Leave empty for unlimited)"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Usage Limit Per Customer
                      </label>
                      <input
                        type="number"
                        value={formData.perCustomerLimit}
                        onChange={(e) => setFormData({ ...formData, perCustomerLimit: e.target.value })}
                        placeholder="e.g. 1"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#111111]">
                        <input
                          type="checkbox"
                          checked={formData.firstBookingOnly}
                          onChange={(e) => setFormData({ ...formData, firstBookingOnly: e.target.checked })}
                          className="accent-[#E21B23]"
                        />
                        First-Time Customer Booking Only
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: RESTRICTIONS & SCOPE */}
              {activeTab === "restrictions" && (
                <div className="space-y-4">
                  {/* Service Restrictions */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                      Applicable Travel Services (Leave blank for All Services)
                    </label>
                    <div className="border border-[#E5E5E5] rounded-xl p-3 bg-white space-y-1.5 max-h-36 overflow-y-auto">
                      {services.length === 0 ? (
                        <div className="text-[11px] text-[#666]">No travel services configured yet.</div>
                      ) : (
                        services.map((srv) => (
                          <label key={srv.id} className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={formData.serviceNames.includes(srv.name)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...formData.serviceNames, srv.name]
                                  : formData.serviceNames.filter((name) => name !== srv.name);
                                setFormData({ ...formData, serviceNames: next });
                              }}
                              className="accent-[#E21B23]"
                            />
                            <span className="text-[#111111] font-medium">{srv.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Vehicle Restrictions */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                      Applicable Vehicle Categories (Leave blank for All Classes)
                    </label>
                    <div className="border border-[#E5E5E5] rounded-xl p-3 bg-white space-y-1.5 max-h-36 overflow-y-auto">
                      {categories.map((cat) => (
                        <label key={cat.id} className="flex items-center gap-2 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={formData.vehicleCategoryIds.includes(cat.id)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...formData.vehicleCategoryIds, cat.id]
                                : formData.vehicleCategoryIds.filter((id) => id !== cat.id);
                              setFormData({ ...formData, vehicleCategoryIds: next });
                            }}
                            className="accent-[#E21B23]"
                          />
                          <span className="text-[#111111] font-medium">{cat.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Status & Admin Only */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Master Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as CouponStatus })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs bg-white focus:border-[#E21B23] focus:outline-none font-semibold"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Draft">Draft</option>
                      </select>
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#111111]">
                        <input
                          type="checkbox"
                          checked={formData.adminBookingOnly}
                          onChange={(e) => setFormData({ ...formData, adminBookingOnly: e.target.checked })}
                          className="accent-[#E21B23]"
                        />
                        Admin Booking Only
                      </label>
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
                      onClick={() =>
                        setActiveTab(
                          activeTab === "restrictions" ? "validity" : activeTab === "validity" ? "discount" : "basic"
                        )
                      }
                      className="px-3 py-2 border border-[#E5E5E5] text-[#111111] rounded-xl font-semibold text-xs"
                    >
                      ← Back
                    </button>
                  )}
                  {activeTab !== "restrictions" && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab(
                          activeTab === "basic" ? "discount" : activeTab === "discount" ? "validity" : "restrictions"
                        )
                      }
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
                    {editingCoupon ? "Save Changes" : "Create Offer"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingCoupon && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-[#E5E5E5]">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111111]">Delete Offer</h3>
                <p className="text-xs text-[#666]">{deletingCoupon.code} ({deletingCoupon.name})</p>
              </div>
            </div>

            {deleteRefNotice ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-2">
                <div className="font-bold">⚠️ Financial Audit Notice</div>
                <p>{deleteRefNotice}</p>
              </div>
            ) : (
              <p className="text-xs text-[#666]">
                Are you sure you want to delete coupon <strong>"{deletingCoupon.code}"</strong>?
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingCoupon(null)}
                className="px-4 py-2 border border-[#E5E5E5] text-[#111111] text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>

              {deleteRefNotice ? (
                <button
                  onClick={() => {
                    handleToggleStatus(deletingCoupon);
                    setDeletingCoupon(null);
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
