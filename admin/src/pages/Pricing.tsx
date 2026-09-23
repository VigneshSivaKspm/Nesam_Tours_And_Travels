import { useState, useEffect, useMemo } from "react";
import {
  FareRule,
  PricingModel,
  TravelService,
  VehicleCategory,
  MasterLocation,
  Booking,
  FareCalculationInput,
  FareCalculationResult,
} from "../types";
import {
  subscribeFareRules,
  subscribeServices,
  subscribeVehicleCategories,
  subscribeLocations,
  subscribeBookings,
  addFirestoreDocument,
  setFirestoreDocument,
  deleteFirestoreDocument,
  COLLECTIONS,
} from "../services/adminFirestoreService";
import { calculateCentralFare, isNightTime } from "../services/fareEngine";

const PRICING_MODELS: { value: PricingModel; label: string; desc: string }[] = [
  { value: "BASE_PLUS_PER_KM", label: "Base Fare + Per KM", desc: "Initial base fare covering base KM, then per-KM rate for extra distance." },
  { value: "PER_KM", label: "Pure Per KM", desc: "Distance × Per-KM rate with minimum daily billable KM." },
  { value: "FIXED_ROUTE", label: "Fixed Route Fare", desc: "Fixed fare between specific Origin and Destination locations." },
  { value: "HOURLY_RENTAL", label: "Hourly / Rental Package", desc: "Included Hours & Included KM package with extra hour/KM charges." },
  { value: "PER_DAY", label: "Outstation Daily Minimum", desc: "Daily minimum distance rate × trip days + daily driver batta." },
];

const MODEL_BADGES: Record<PricingModel, { bg: string; text: string; border: string }> = {
  BASE_PLUS_PER_KM: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  PER_KM: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  FIXED_ROUTE: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  HOURLY_RENTAL: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  PER_DAY: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
};

// Preset Baseline Fare Rules for Tamil Nadu Operations
const PRESET_FARE_RULES: Partial<FareRule>[] = [
  {
    name: "Airport Taxi Sedan Standard",
    serviceName: "Airport Taxi",
    pricingType: "BASE_PLUS_PER_KM",
    baseFare: 350,
    baseKm: 10,
    perKmRate: 13,
    driverBatta: 250,
    waitingChargePerHour: 80,
    nightChargeEnabled: true,
    nightStartTime: "22:00",
    nightEndTime: "05:00",
    nightChargeType: "Percentage",
    nightChargeValue: 15,
    status: "Active",
    priority: 1,
  },
  {
    name: "Airport Taxi Innova SUV Standard",
    serviceName: "Airport Taxi",
    pricingType: "BASE_PLUS_PER_KM",
    baseFare: 550,
    baseKm: 10,
    perKmRate: 19,
    driverBatta: 350,
    waitingChargePerHour: 100,
    nightChargeEnabled: true,
    nightStartTime: "22:00",
    nightEndTime: "05:00",
    nightChargeType: "Percentage",
    nightChargeValue: 15,
    status: "Active",
    priority: 1,
  },
  {
    name: "Outstation Sedan Daily Rate",
    serviceName: "Outstation Cab",
    pricingType: "PER_DAY",
    baseFare: 0,
    baseKm: 0,
    perKmRate: 14,
    minimumKmPerDay: 250,
    driverBatta: 300,
    nightChargeEnabled: true,
    nightStartTime: "22:00",
    nightEndTime: "05:00",
    nightChargeType: "Fixed",
    nightChargeValue: 200,
    status: "Active",
    priority: 1,
  },
  {
    name: "Outstation Innova Crysta Premium",
    serviceName: "Outstation Cab",
    pricingType: "PER_DAY",
    baseFare: 0,
    baseKm: 0,
    perKmRate: 20,
    minimumKmPerDay: 250,
    driverBatta: 450,
    nightChargeEnabled: true,
    nightStartTime: "22:00",
    nightEndTime: "05:00",
    nightChargeType: "Fixed",
    nightChargeValue: 300,
    status: "Active",
    priority: 1,
  },
  {
    name: "Local Rental 4Hrs / 40Kms Package",
    serviceName: "Local Rental",
    pricingType: "HOURLY_RENTAL",
    baseFare: 900,
    baseKm: 40,
    includedHours: 4,
    perKmRate: 12,
    extraKmRate: 14,
    extraHourRate: 120,
    driverBatta: 150,
    waitingChargePerHour: 100,
    status: "Active",
    priority: 1,
  },
  {
    name: "Local Rental 8Hrs / 80Kms Full Day",
    serviceName: "Local Rental",
    pricingType: "HOURLY_RENTAL",
    baseFare: 1700,
    baseKm: 80,
    includedHours: 8,
    perKmRate: 12,
    extraKmRate: 14,
    extraHourRate: 120,
    driverBatta: 250,
    waitingChargePerHour: 100,
    status: "Active",
    priority: 1,
  },
];

export default function Pricing() {
  const [fareRules, setFareRules] = useState<FareRule[]>([]);
  const [services, setServices] = useState<TravelService[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [locations, setLocations] = useState<MasterLocation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Controls
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [modelFilter, setModelFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Modal Form State
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<FareRule | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"identity" | "pricing" | "allowances" | "overrides">("identity");

  // Form Data
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    serviceId: string;
    serviceName: string;
    vehicleCategoryId: string;
    vehicleCategoryName: string;
    pricingType: PricingModel;
    originLocationId: string;
    destinationLocationId: string;
    baseFare: number;
    baseKm: number;
    perKmRate: number;
    minimumKmPerDay: number;
    minimumFare: number;
    includedHours: number;
    extraKmRate: number;
    extraHourRate: number;
    driverBatta: number;
    nightChargeEnabled: boolean;
    nightStartTime: string;
    nightEndTime: string;
    nightChargeType: "Fixed" | "Percentage";
    nightChargeValue: number;
    freeWaitingMinutes: number;
    waitingChargePerHour: number;
    tollMode: "Included" | "Excluded" | "Fixed";
    fixedTollAmount: number;
    parkingMode: "Included" | "Excluded" | "Fixed";
    fixedParkingAmount: number;
    permitCharge: number;
    priority: number;
    status: "Active" | "Inactive";
    effectiveFrom: string;
    effectiveUntil: string;
  }>({
    name: "",
    code: "",
    serviceId: "",
    serviceName: "",
    vehicleCategoryId: "",
    vehicleCategoryName: "",
    pricingType: "BASE_PLUS_PER_KM",
    originLocationId: "",
    destinationLocationId: "",
    baseFare: 350,
    baseKm: 10,
    perKmRate: 13,
    minimumKmPerDay: 250,
    minimumFare: 350,
    includedHours: 4,
    extraKmRate: 14,
    extraHourRate: 120,
    driverBatta: 250,
    nightChargeEnabled: true,
    nightStartTime: "22:00",
    nightEndTime: "05:00",
    nightChargeType: "Percentage",
    nightChargeValue: 15,
    freeWaitingMinutes: 15,
    waitingChargePerHour: 80,
    tollMode: "Excluded",
    fixedTollAmount: 0,
    parkingMode: "Excluded",
    fixedParkingAmount: 0,
    permitCharge: 0,
    priority: 1,
    status: "Active",
    effectiveFrom: "",
    effectiveUntil: "",
  });

  // Central Test Calculator Widget State
  const [calcInput, setCalcInput] = useState<FareCalculationInput>({
    serviceName: "Airport Taxi",
    vehicleCategoryId: "",
    distanceKm: 25,
    tripDays: 1,
    tripHours: 4,
    pickupTime: "23:00",
    waitingMinutes: 30,
    tollAmount: 100,
    parkingAmount: 50,
    permitAmount: 0,
    discountAmount: 0,
  });
  const [calcResult, setCalcResult] = useState<FareCalculationResult | null>(null);

  // Delete & Safety Dialog
  const [deletingRule, setDeletingRule] = useState<FareRule | null>(null);
  const [deleteRefNotice, setDeleteRefNotice] = useState<string | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubF = subscribeFareRules((data) => {
      setFareRules(data);
      setLoading(false);
    });
    const unsubS = subscribeServices(setServices);
    const unsubC = subscribeVehicleCategories((data) => {
      setCategories(data);
      if (data.length > 0 && !calcInput.vehicleCategoryId) {
        setCalcInput((prev) => ({ ...prev, vehicleCategoryId: data[0].id }));
      }
    });
    const unsubL = subscribeLocations(setLocations);
    const unsubB = subscribeBookings(setBookings);

    return () => {
      unsubF();
      unsubS();
      unsubC();
      unsubL();
      unsubB();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Run central fare calculation for preview widget whenever inputs, rules or categories change
  useEffect(() => {
    if (categories.length > 0) {
      const result = calculateCentralFare(calcInput, fareRules, categories);
      setCalcResult(result);
    }
  }, [calcInput, fareRules, categories]);

  // Dashboard Summary Stats
  const stats = useMemo(() => {
    const total = fareRules.length;
    const active = fareRules.filter((r) => r.status === "Active").length;
    const servicesCount = new Set(fareRules.map((r) => r.serviceName).filter(Boolean)).size;
    const categoriesCount = new Set(fareRules.map((r) => r.vehicleCategoryId).filter(Boolean)).size;
    return { total, active, servicesCount, categoriesCount };
  }, [fareRules]);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return fareRules.filter((rule) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        rule.name.toLowerCase().includes(q) ||
        (rule.serviceName && rule.serviceName.toLowerCase().includes(q)) ||
        (rule.vehicleCategoryName && rule.vehicleCategoryName.toLowerCase().includes(q)) ||
        (rule.code && rule.code.toLowerCase().includes(q));

      const matchService = serviceFilter === "All" || rule.serviceName === serviceFilter || rule.serviceId === serviceFilter;
      const matchCategory = categoryFilter === "All" || rule.vehicleCategoryId === categoryFilter;
      const matchModel = modelFilter === "All" || rule.pricingType === modelFilter;
      const matchStatus = statusFilter === "All" || rule.status === statusFilter;

      return matchSearch && matchService && matchCategory && matchModel && matchStatus;
    });
  }, [fareRules, search, serviceFilter, categoryFilter, modelFilter, statusFilter]);

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingRule(null);
    const defaultCat = categories.find((c) => c.status === "Active") || categories[0];
    const defaultSrv = services.find((s) => s.status === "Active") || services[0];

    setFormData({
      name: "",
      code: "",
      serviceId: defaultSrv ? defaultSrv.id : "",
      serviceName: defaultSrv ? defaultSrv.name : "Airport Taxi",
      vehicleCategoryId: defaultCat ? defaultCat.id : "",
      vehicleCategoryName: defaultCat ? defaultCat.name : "Sedan",
      pricingType: "BASE_PLUS_PER_KM",
      originLocationId: "",
      destinationLocationId: "",
      baseFare: defaultCat?.fare?.baseFare || 350,
      baseKm: defaultCat?.fare?.baseKm || 10,
      perKmRate: defaultCat?.fare?.perKmRate || 13,
      minimumKmPerDay: 250,
      minimumFare: 350,
      includedHours: 4,
      extraKmRate: 14,
      extraHourRate: 120,
      driverBatta: defaultCat?.fare?.driverAllowance || 250,
      nightChargeEnabled: true,
      nightStartTime: "22:00",
      nightEndTime: "05:00",
      nightChargeType: "Percentage",
      nightChargeValue: 15,
      freeWaitingMinutes: 15,
      waitingChargePerHour: defaultCat?.fare?.waitingChargePerHour || 80,
      tollMode: "Excluded",
      fixedTollAmount: 0,
      parkingMode: "Excluded",
      fixedParkingAmount: 0,
      permitCharge: 0,
      priority: 1,
      status: "Active",
      effectiveFrom: new Date().toISOString().split("T")[0],
      effectiveUntil: "",
    });

    setFormError(null);
    setActiveTab("identity");
    setShowModal(true);
  };

  // Open Edit Form
  const handleOpenEdit = (rule: FareRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name || "",
      code: rule.code || "",
      serviceId: rule.serviceId || "",
      serviceName: rule.serviceName || "",
      vehicleCategoryId: rule.vehicleCategoryId || "",
      vehicleCategoryName: rule.vehicleCategoryName || "",
      pricingType: rule.pricingType || "BASE_PLUS_PER_KM",
      originLocationId: rule.originLocationId || "",
      destinationLocationId: rule.destinationLocationId || "",
      baseFare: rule.baseFare || 0,
      baseKm: rule.baseKm || 0,
      perKmRate: rule.perKmRate || 0,
      minimumKmPerDay: rule.minimumKmPerDay || 250,
      minimumFare: rule.minimumFare || 0,
      includedHours: rule.includedHours || 4,
      extraKmRate: rule.extraKmRate || 0,
      extraHourRate: rule.extraHourRate || 0,
      driverBatta: rule.driverBatta || 0,
      nightChargeEnabled: rule.nightChargeEnabled !== false,
      nightStartTime: rule.nightStartTime || "22:00",
      nightEndTime: rule.nightEndTime || "05:00",
      nightChargeType: rule.nightChargeType || "Percentage",
      nightChargeValue: rule.nightChargeValue || 15,
      freeWaitingMinutes: rule.freeWaitingMinutes || 15,
      waitingChargePerHour: rule.waitingChargePerHour || 80,
      tollMode: rule.tollMode || "Excluded",
      fixedTollAmount: rule.fixedTollAmount || 0,
      parkingMode: rule.parkingMode || "Excluded",
      fixedParkingAmount: rule.fixedParkingAmount || 0,
      permitCharge: rule.permitCharge || 0,
      priority: rule.priority || 1,
      status: rule.status || "Active",
      effectiveFrom: rule.effectiveFrom || "",
      effectiveUntil: rule.effectiveUntil || "",
    });

    setFormError(null);
    setActiveTab("identity");
    setShowModal(true);
  };

  // Save Form Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nameTrim = formData.name.trim();
    if (!nameTrim) {
      setFormError("Rule Name is required.");
      setActiveTab("identity");
      return;
    }

    if (!formData.vehicleCategoryId) {
      setFormError("Please select a Vehicle Category.");
      setActiveTab("identity");
      return;
    }

    if (formData.pricingType === "FIXED_ROUTE") {
      if (!formData.originLocationId || !formData.destinationLocationId) {
        setFormError("Origin and Destination locations are required for Fixed Route pricing.");
        setActiveTab("identity");
        return;
      }
    }

    // Overlapping Rule Protection Check
    const overlapping = fareRules.find(
      (r) =>
        r.status === "Active" &&
        r.vehicleCategoryId === formData.vehicleCategoryId &&
        r.serviceName === formData.serviceName &&
        r.pricingType === formData.pricingType &&
        (!editingRule || r.id !== editingRule.id) &&
        (formData.pricingType !== "FIXED_ROUTE" ||
          (r.originLocationId === formData.originLocationId && r.destinationLocationId === formData.destinationLocationId))
    );

    if (overlapping && formData.status === "Active") {
      setFormError(
        `An active fare rule "${overlapping.name}" already covers ${formData.serviceName} + ${formData.vehicleCategoryName}. Deactivate it first or change rule scope.`
      );
      setActiveTab("identity");
      return;
    }

    setIsSubmitting(true);

    const catObj = categories.find((c) => c.id === formData.vehicleCategoryId);
    const srvObj = services.find((s) => s.id === formData.serviceId || s.name === formData.serviceName);
    const originLoc = locations.find((l) => l.id === formData.originLocationId);
    const destLoc = locations.find((l) => l.id === formData.destinationLocationId);

    const payload: Partial<FareRule> = {
      name: nameTrim,
      code: formData.code.trim() || `FARE-${Date.now().toString().slice(-4)}`,
      serviceId: srvObj ? srvObj.id : undefined,
      serviceName: srvObj ? srvObj.name : formData.serviceName,
      vehicleCategoryId: formData.vehicleCategoryId,
      vehicleCategoryName: catObj ? catObj.name : formData.vehicleCategoryName,
      pricingType: formData.pricingType,
      originLocationId: formData.originLocationId || undefined,
      originLocationName: originLoc ? originLoc.name : undefined,
      destinationLocationId: formData.destinationLocationId || undefined,
      destinationLocationName: destLoc ? destLoc.name : undefined,
      baseFare: Number(formData.baseFare) || 0,
      baseKm: Number(formData.baseKm) || 0,
      perKmRate: Number(formData.perKmRate) || 0,
      minimumKmPerDay: Number(formData.minimumKmPerDay) || 0,
      minimumFare: Number(formData.minimumFare) || 0,
      includedHours: Number(formData.includedHours) || 0,
      extraKmRate: Number(formData.extraKmRate) || 0,
      extraHourRate: Number(formData.extraHourRate) || 0,
      driverBatta: Number(formData.driverBatta) || 0,
      nightChargeEnabled: formData.nightChargeEnabled,
      nightStartTime: formData.nightStartTime,
      nightEndTime: formData.nightEndTime,
      nightChargeType: formData.nightChargeType,
      nightChargeValue: Number(formData.nightChargeValue) || 0,
      freeWaitingMinutes: Number(formData.freeWaitingMinutes) || 0,
      waitingChargePerHour: Number(formData.waitingChargePerHour) || 0,
      tollMode: formData.tollMode,
      fixedTollAmount: Number(formData.fixedTollAmount) || 0,
      parkingMode: formData.parkingMode,
      fixedParkingAmount: Number(formData.fixedParkingAmount) || 0,
      permitCharge: Number(formData.permitCharge) || 0,
      priority: Number(formData.priority) || 1,
      status: formData.status,
      effectiveFrom: formData.effectiveFrom,
      effectiveUntil: formData.effectiveUntil,
    };

    let ok = false;
    if (editingRule) {
      ok = await setFirestoreDocument(COLLECTIONS.FARE_RULES, editingRule.id, payload);
    } else {
      const id = await addFirestoreDocument(COLLECTIONS.FARE_RULES, payload);
      ok = !!id;
    }

    setIsSubmitting(false);

    if (ok) {
      setShowModal(false);
      showToast(
        editingRule
          ? `Fare rule "${nameTrim}" updated successfully.`
          : `Fare rule "${nameTrim}" created successfully.`
      );
    } else {
      setFormError("Failed to save fare rule to database. Please check your internet connection.");
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (rule: FareRule) => {
    const nextStatus = rule.status === "Active" ? "Inactive" : "Active";
    const ok = await setFirestoreDocument(COLLECTIONS.FARE_RULES, rule.id, {
      status: nextStatus,
    });
    if (ok) {
      showToast(`Fare rule "${rule.name}" is now ${nextStatus}.`);
    }
  };

  // Duplicate Fare Rule
  const handleDuplicate = async (rule: FareRule) => {
    const copyPayload: Partial<FareRule> = {
      ...rule,
      name: `${rule.name} (Copy)`,
      code: `FARE-${Date.now().toString().slice(-4)}`,
      status: "Inactive",
    };
    delete (copyPayload as any).id;

    const newId = await addFirestoreDocument(COLLECTIONS.FARE_RULES, copyPayload);
    if (newId) {
      showToast(`Duplicated "${rule.name}" as new Inactive Draft rule.`);
    }
  };

  // Prompt Delete
  const handlePromptDelete = (rule: FareRule) => {
    setDeletingRule(rule);
    setDeleteRefNotice(null);

    // Check if any existing booking relies on this rule
    const refBookings = bookings.filter(
      (b) =>
        (b.vehicleCategory && b.vehicleCategory.toLowerCase() === rule.vehicleCategoryName?.toLowerCase()) ||
        (b.service && b.service.toLowerCase() === rule.serviceName?.toLowerCase())
    );

    if (refBookings.length > 0) {
      setDeleteRefNotice(
        `This rule covers ${refBookings.length} existing booking(s). Hard deletion will remove auditable fare parameters. Deactivating is recommended.`
      );
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingRule) return;
    const ok = await deleteFirestoreDocument(COLLECTIONS.FARE_RULES, deletingRule.id);
    if (ok) {
      showToast(`Fare rule "${deletingRule.name}" deleted.`);
    }
    setDeletingRule(null);
  };

  // Auto-Populate Baseline Fare Rules
  const handleLoadPresets = async () => {
    if (!window.confirm("Load preset baseline fare rules for Tamil Nadu Taxi Services?")) {
      return;
    }
    setLoading(true);
    let count = 0;

    for (const preset of PRESET_FARE_RULES) {
      const exists = fareRules.some((r) => r.name.toLowerCase() === preset.name?.toLowerCase());
      if (!exists) {
        const cat = categories.find((c) => c.status === "Active") || categories[0];
        const srv = services.find((s) => s.name === preset.serviceName) || services[0];

        const payload: Partial<FareRule> = {
          ...preset,
          vehicleCategoryId: cat ? cat.id : "cat-sedan",
          vehicleCategoryName: cat ? cat.name : "Sedan",
          serviceId: srv ? srv.id : undefined,
          serviceName: srv ? srv.name : preset.serviceName,
          code: `FARE-${Math.floor(1000 + Math.random() * 9000)}`,
        };

        await addFirestoreDocument(COLLECTIONS.FARE_RULES, payload);
        count++;
      }
    }

    setLoading(false);
    showToast(`Loaded ${count} preset fare rules successfully!`);
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
          <h1 className="text-xl font-bold text-[#111111] tracking-tight">Pricing & Fare Management</h1>
          <p className="text-xs text-[#666] mt-0.5">
            Centralized master engine for base fares, per-KM rates, driver batta, waiting charges, night surcharges & route fares.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {fareRules.length > 0 && (
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
            Add Fare Rule
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {fareRules.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#E21B23] flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#666]">Total Fare Rules</div>
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
              <div className="text-[11px] font-medium text-[#666]">Active Rules</div>
              <div className="text-lg font-bold text-[#111111]">{stats.active}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#666]">Services Configured</div>
              <div className="text-lg font-bold text-[#111111]">{stats.servicesCount}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#666]">Fleet Classes Covered</div>
              <div className="text-lg font-bold text-[#111111]">{stats.categoriesCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Central Interactive Fare Test Calculator Widget */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-50 text-[#E21B23] flex items-center justify-center font-bold text-xs">
              ⚡
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111111]">Central Fare Calculator Test Engine</h2>
              <p className="text-[11px] text-[#666]">
                Simulate trip parameters to test matching fare rules and real-time breakdowns.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
            Engine Connected
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-semibold text-[#666] mb-1">Service Type</label>
            <select
              value={calcInput.serviceName}
              onChange={(e) => setCalcInput({ ...calcInput, serviceName: e.target.value })}
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

          <div>
            <label className="block text-[10px] font-semibold text-[#666] mb-1">Vehicle Category</label>
            <select
              value={calcInput.vehicleCategoryId}
              onChange={(e) => setCalcInput({ ...calcInput, vehicleCategoryId: e.target.value })}
              className="w-full p-2 border border-[#E5E5E5] rounded-xl bg-white text-xs focus:border-[#E21B23] focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#666] mb-1">Distance (KM)</label>
            <input
              type="number"
              value={calcInput.distanceKm}
              onChange={(e) => setCalcInput({ ...calcInput, distanceKm: parseFloat(e.target.value) || 0 })}
              className="w-full p-2 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#666] mb-1">Trip Days</label>
            <input
              type="number"
              value={calcInput.tripDays}
              onChange={(e) => setCalcInput({ ...calcInput, tripDays: parseInt(e.target.value) || 1 })}
              className="w-full p-2 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#666] mb-1">Pickup Time</label>
            <input
              type="time"
              value={calcInput.pickupTime}
              onChange={(e) => setCalcInput({ ...calcInput, pickupTime: e.target.value })}
              className="w-full p-2 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#666] mb-1">Waiting (Mins)</label>
            <input
              type="number"
              value={calcInput.waitingMinutes}
              onChange={(e) => setCalcInput({ ...calcInput, waitingMinutes: parseInt(e.target.value) || 0 })}
              className="w-full p-2 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
            />
          </div>
        </div>

        {/* Live Calculation Output Display */}
        {calcResult && (
          <div className="bg-gray-50 border border-[#E5E5E5] rounded-xl p-4 text-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#111111]">Matched Rule:</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white border border-gray-200 text-[#E21B23]">
                  {calcResult.matchedRule ? calcResult.matchedRule.name : "Category Default Fallback"}
                </span>
                {calcResult.fallbackUsed && (
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Fallback Mode
                  </span>
                )}
              </div>

              <div className="text-right">
                <span className="text-[11px] text-[#666]">Estimated Grand Total (incl. 5% GST): </span>
                <span className="text-base font-bold text-[#E21B23]">₹{calcResult.grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Itemized Breakdown List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {calcResult.breakdown.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-[11px]">
                  <span className="text-gray-700">{item.label}</span>
                  <span className={`font-semibold ${item.amount < 0 ? "text-emerald-600" : "text-[#111111]"}`}>
                    {item.amount < 0 ? `-₹${Math.abs(item.amount)}` : `₹${item.amount}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-2 border-[#E21B23] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-[#666]">Loading Master Fare Rules from Firestore…</p>
        </div>
      ) : fareRules.length === 0 ? (
        /* Empty State Placeholder (Matches Screenshot & Prompt Instructions) */
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-10 sm:p-16 text-center max-w-2xl mx-auto my-8 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#E21B23] flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-inner">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[#111111] mb-2">Pricing & Fare Management</h2>
          <p className="text-xs text-[#666] mb-6 leading-relaxed max-w-md mx-auto">
            Set base fare, per-km rates, driver batta, waiting charges, toll handling and night surcharges for all service types.
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
              Load Preset Fare Rules
            </button>
          </div>
        </div>
      ) : (
        /* Fare Rules Directory Table */
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
                placeholder="Search rules by name, service, category, code..."
                className="w-full pl-9 pr-4 py-2 border border-[#E5E5E5] rounded-xl text-xs focus:outline-none focus:border-[#E21B23]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-[#E5E5E5] rounded-xl text-xs bg-white text-[#111111] focus:outline-none focus:border-[#E21B23]"
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="px-3 py-2 border border-[#E5E5E5] rounded-xl text-xs bg-white text-[#111111] focus:outline-none focus:border-[#E21B23]"
              >
                <option value="All">All Pricing Types</option>
                {PRICING_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-[#E5E5E5] rounded-xl text-xs bg-white text-[#111111] focus:outline-none focus:border-[#E21B23]"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-[#E5E5E5] rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-[#E5E5E5] text-[#666] font-semibold">
                <tr>
                  <th className="py-3 px-3">Rule Name</th>
                  <th className="py-3 px-3">Pricing Type</th>
                  <th className="py-3 px-3">Service & Category</th>
                  <th className="py-3 px-3">Base Fare</th>
                  <th className="py-3 px-3">Per KM</th>
                  <th className="py-3 px-3">Driver Batta</th>
                  <th className="py-3 px-3">Night Charge</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredRules.map((rule) => {
                  const badge = MODEL_BADGES[rule.pricingType] || MODEL_BADGES.BASE_PLUS_PER_KM;
                  return (
                    <tr key={rule.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-3 font-semibold text-[#111111]">
                        <div>{rule.name}</div>
                        {rule.code && <div className="text-[10px] font-mono text-gray-500">{rule.code}</div>}
                      </td>

                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {PRICING_MODELS.find((m) => m.value === rule.pricingType)?.label || rule.pricingType}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-[#111111]">
                        <div className="font-semibold">{rule.serviceName || "All Services"}</div>
                        <div className="text-[10px] text-gray-500">{rule.vehicleCategoryName || "All Categories"}</div>
                      </td>

                      <td className="py-3 px-3 font-semibold text-[#111111]">
                        ₹{rule.baseFare}
                        {rule.baseKm > 0 && <span className="text-[10px] font-normal text-gray-500"> ({rule.baseKm}km)</span>}
                      </td>

                      <td className="py-3 px-3 font-semibold text-[#111111]">
                        ₹{rule.perKmRate}/km
                      </td>

                      <td className="py-3 px-3 text-[#111111]">
                        ₹{rule.driverBatta}/day
                      </td>

                      <td className="py-3 px-3">
                        {rule.nightChargeEnabled ? (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-medium">
                            ✓ {rule.nightChargeValue}{rule.nightChargeType === "Percentage" ? "%" : "₹"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-500">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                            rule.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          {rule.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right space-x-2">
                        <button
                          onClick={() => handleToggleStatus(rule)}
                          className={`text-[11px] font-semibold ${
                            rule.status === "Active" ? "text-amber-600 hover:underline" : "text-emerald-600 hover:underline"
                          }`}
                        >
                          {rule.status === "Active" ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => handleDuplicate(rule)}
                          className="text-blue-600 hover:underline font-semibold text-[11px]"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => handleOpenEdit(rule)}
                          className="text-[#111111] hover:underline font-semibold text-[11px]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handlePromptDelete(rule)}
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

      {/* Add / Edit Fare Rule Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-[#E5E5E5] max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E5E5E5] flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-base font-bold text-[#111111]">
                  {editingRule ? "Edit Master Fare Rule" : "Add Master Fare Rule"}
                </h3>
                <p className="text-[11px] text-[#666]">
                  Configure master pricing parameters for central fare calculation.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form Tabs */}
            <div className="flex border-b border-[#E5E5E5] bg-white px-5 pt-2 gap-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("identity")}
                className={`pb-2.5 border-b-2 transition-all ${
                  activeTab === "identity" ? "border-[#E21B23] text-[#E21B23]" : "border-transparent text-[#666] hover:text-[#111111]"
                }`}
              >
                1. Rule Identity & Scope
              </button>
              <button
                onClick={() => setActiveTab("pricing")}
                className={`pb-2.5 border-b-2 transition-all ${
                  activeTab === "pricing" ? "border-[#E21B23] text-[#E21B23]" : "border-transparent text-[#666] hover:text-[#111111]"
                }`}
              >
                2. Base & Distance Rules
              </button>
              <button
                onClick={() => setActiveTab("allowances")}
                className={`pb-2.5 border-b-2 transition-all ${
                  activeTab === "allowances" ? "border-[#E21B23] text-[#E21B23]" : "border-transparent text-[#666] hover:text-[#111111]"
                }`}
              >
                3. Allowances & Surcharges
              </button>
              <button
                onClick={() => setActiveTab("overrides")}
                className={`pb-2.5 border-b-2 transition-all ${
                  activeTab === "overrides" ? "border-[#E21B23] text-[#E21B23]" : "border-transparent text-[#666] hover:text-[#111111]"
                }`}
              >
                4. Tolls & Settings
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

              {/* TAB 1: IDENTITY & SCOPE */}
              {activeTab === "identity" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Rule Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Airport Taxi Sedan Standard Rate, Outstation Daily Innova"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Travel Service *
                      </label>
                      <select
                        value={formData.serviceName}
                        onChange={(e) => {
                          const srv = services.find((s) => s.name === e.target.value);
                          setFormData({
                            ...formData,
                            serviceName: e.target.value,
                            serviceId: srv ? srv.id : "",
                          });
                        }}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs bg-white focus:border-[#E21B23] focus:outline-none"
                      >
                        {services.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Vehicle Category *
                      </label>
                      <select
                        value={formData.vehicleCategoryId}
                        onChange={(e) => {
                          const cat = categories.find((c) => c.id === e.target.value);
                          setFormData({
                            ...formData,
                            vehicleCategoryId: e.target.value,
                            vehicleCategoryName: cat ? cat.name : "",
                          });
                        }}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs bg-white focus:border-[#E21B23] focus:outline-none"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.seatingCapacity} seats)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Pricing Model *
                      </label>
                      <select
                        value={formData.pricingType}
                        onChange={(e) => setFormData({ ...formData, pricingType: e.target.value as PricingModel })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs bg-white focus:border-[#E21B23] focus:outline-none font-semibold"
                      >
                        {PRICING_MODELS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label} — {m.desc}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Fixed Route Location Selectors */}
                    {formData.pricingType === "FIXED_ROUTE" && (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                            Origin Location *
                          </label>
                          <select
                            value={formData.originLocationId}
                            onChange={(e) => setFormData({ ...formData, originLocationId: e.target.value })}
                            className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs bg-white focus:border-[#E21B23] focus:outline-none"
                          >
                            <option value="">Select Origin Location</option>
                            {locations.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name} ({l.city})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                            Destination Location *
                          </label>
                          <select
                            value={formData.destinationLocationId}
                            onChange={(e) => setFormData({ ...formData, destinationLocationId: e.target.value })}
                            className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs bg-white focus:border-[#E21B23] focus:outline-none"
                          >
                            <option value="">Select Destination Location</option>
                            {locations.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name} ({l.city})
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: BASE & DISTANCE RULES */}
              {activeTab === "pricing" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Base Fare (₹) *
                      </label>
                      <input
                        type="number"
                        value={formData.baseFare}
                        onChange={(e) => setFormData({ ...formData, baseFare: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g. 350"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Base Included Distance (KM)
                      </label>
                      <input
                        type="number"
                        value={formData.baseKm}
                        onChange={(e) => setFormData({ ...formData, baseKm: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g. 10 (0 if no base km)"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Per-KM Rate (₹/km) *
                      </label>
                      <input
                        type="number"
                        value={formData.perKmRate}
                        onChange={(e) => setFormData({ ...formData, perKmRate: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g. 13"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Min Outstation Billable KM / Day
                      </label>
                      <input
                        type="number"
                        value={formData.minimumKmPerDay}
                        onChange={(e) => setFormData({ ...formData, minimumKmPerDay: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g. 250"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>

                    {/* Hourly Package fields */}
                    {formData.pricingType === "HOURLY_RENTAL" && (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                            Included Hours
                          </label>
                          <input
                            type="number"
                            value={formData.includedHours}
                            onChange={(e) => setFormData({ ...formData, includedHours: parseInt(e.target.value) || 4 })}
                            className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                            Extra KM Rate (₹/km)
                          </label>
                          <input
                            type="number"
                            value={formData.extraKmRate}
                            onChange={(e) => setFormData({ ...formData, extraKmRate: parseFloat(e.target.value) || 0 })}
                            className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                            Extra Hour Rate (₹/hr)
                          </label>
                          <input
                            type="number"
                            value={formData.extraHourRate}
                            onChange={(e) => setFormData({ ...formData, extraHourRate: parseFloat(e.target.value) || 0 })}
                            className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: ALLOWANCES & SURCHARGES */}
              {activeTab === "allowances" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Driver Batta / Allowance (₹ per day) *
                      </label>
                      <input
                        type="number"
                        value={formData.driverBatta}
                        onChange={(e) => setFormData({ ...formData, driverBatta: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g. 250"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Waiting Charge Rate (₹ per hour)
                      </label>
                      <input
                        type="number"
                        value={formData.waitingChargePerHour}
                        onChange={(e) => setFormData({ ...formData, waitingChargePerHour: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g. 80"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>

                    {/* Night Surcharge Box */}
                    <div className="sm:col-span-2 p-3 bg-gray-50 border border-[#E5E5E5] rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-[#111111]">
                          <input
                            type="checkbox"
                            checked={formData.nightChargeEnabled}
                            onChange={(e) => setFormData({ ...formData, nightChargeEnabled: e.target.checked })}
                            className="accent-[#E21B23]"
                          />
                          Night Surcharge Enabled
                        </label>
                        <span className="text-[10px] text-[#666]">Evaluated across midnight windows</span>
                      </div>

                      {formData.nightChargeEnabled && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          <div>
                            <label className="block text-[10px] font-semibold text-[#666]">Night Window Start</label>
                            <input
                              type="time"
                              value={formData.nightStartTime}
                              onChange={(e) => setFormData({ ...formData, nightStartTime: e.target.value })}
                              className="w-full p-2 border rounded-lg bg-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-[#666]">Night Window End</label>
                            <input
                              type="time"
                              value={formData.nightEndTime}
                              onChange={(e) => setFormData({ ...formData, nightEndTime: e.target.value })}
                              className="w-full p-2 border rounded-lg bg-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-[#666]">Charge Type</label>
                            <select
                              value={formData.nightChargeType}
                              onChange={(e) => setFormData({ ...formData, nightChargeType: e.target.value as any })}
                              className="w-full p-2 border rounded-lg bg-white text-xs"
                            >
                              <option value="Percentage">Percentage (%)</option>
                              <option value="Fixed">Fixed Amount (₹)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-[#666]">
                              {formData.nightChargeType === "Percentage" ? "Value (%)" : "Amount (₹)"}
                            </label>
                            <input
                              type="number"
                              value={formData.nightChargeValue}
                              onChange={(e) => setFormData({ ...formData, nightChargeValue: parseFloat(e.target.value) || 0 })}
                              className="w-full p-2 border rounded-lg bg-white text-xs font-bold text-[#E21B23]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: TOLLS, PARKING & SETTINGS */}
              {activeTab === "overrides" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Toll Charges Mode
                      </label>
                      <select
                        value={formData.tollMode}
                        onChange={(e) => setFormData({ ...formData, tollMode: e.target.value as any })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs bg-white focus:border-[#E21B23] focus:outline-none"
                      >
                        <option value="Excluded">Excluded (Actuals at Toll Gates)</option>
                        <option value="Included">Included in Fare</option>
                        <option value="Fixed">Fixed Amount</option>
                      </select>
                    </div>

                    {formData.tollMode === "Fixed" && (
                      <div>
                        <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                          Fixed Toll Amount (₹)
                        </label>
                        <input
                          type="number"
                          value={formData.fixedTollAmount}
                          onChange={(e) => setFormData({ ...formData, fixedTollAmount: parseFloat(e.target.value) || 0 })}
                          className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Interstate Permit Charge (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.permitCharge}
                        onChange={(e) => setFormData({ ...formData, permitCharge: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g. 350 for interstate permit"
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs focus:border-[#E21B23] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full p-2.5 border border-[#E5E5E5] rounded-xl text-xs bg-white focus:border-[#E21B23] focus:outline-none font-semibold"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="pt-4 border-t border-[#E5E5E5] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {activeTab !== "identity" && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab(
                          activeTab === "overrides" ? "allowances" : activeTab === "allowances" ? "pricing" : "identity"
                        )
                      }
                      className="px-3 py-2 border border-[#E5E5E5] text-[#111111] rounded-xl font-semibold text-xs"
                    >
                      ← Back
                    </button>
                  )}
                  {activeTab !== "overrides" && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab(
                          activeTab === "identity" ? "pricing" : activeTab === "pricing" ? "allowances" : "overrides"
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
                    {editingRule ? "Save Changes" : "Create Fare Rule"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation & Safeguard Dialog */}
      {deletingRule && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-[#E5E5E5]">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111111]">Delete Fare Rule</h3>
                <p className="text-xs text-[#666]">{deletingRule.name}</p>
              </div>
            </div>

            {deleteRefNotice ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-2">
                <div className="font-bold">⚠️ Linked Bookings Guard</div>
                <p>{deleteRefNotice}</p>
              </div>
            ) : (
              <p className="text-xs text-[#666]">
                Are you sure you want to delete <strong>"{deletingRule.name}"</strong>?
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingRule(null)}
                className="px-4 py-2 border border-[#E5E5E5] text-[#111111] text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>

              {deleteRefNotice ? (
                <button
                  onClick={() => {
                    handleToggleStatus(deletingRule);
                    setDeletingRule(null);
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
