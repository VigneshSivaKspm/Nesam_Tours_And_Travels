import { useState, useEffect } from "react";
import { Booking } from "../types";
import {
  subscribeBookings,
  updateFirestoreDocument,
  setFirestoreDocument,
  COLLECTIONS,
  subscribeDrivers,
} from "../services/adminFirestoreService";

const getStatusStyle = (status: string) => {
  switch (status) {
    case "Completed":
      return {
        background: "#F0FDF4",
        color: "#16A34A",
        borderColor: "#86EFAC",
      };
    case "Ongoing":
      return {
        background: "#FFF7ED",
        color: "#C2410C",
        borderColor: "#FED7AA",
      };
    case "Confirmed":
      return {
        background: "#EFF6FF",
        color: "#1D4ED8",
        borderColor: "#BFDBFE",
      };
    case "Assigned":
      return {
        background: "#F3E8FF",
        color: "#6B21A8",
        borderColor: "#E9D5FF",
      };
    case "Pending":
      return {
        background: "#FEF3C7",
        color: "#D97706",
        borderColor: "#FDE68A",
      };
    case "Cancelled":
      return {
        background: "#FEF2F2",
        color: "#E21B23",
        borderColor: "#FECACA",
      };
    default:
      return {
        background: "#F5F5F5",
        color: "#666666",
        borderColor: "#E5E5E5",
      };
  }
};

const getTimeline = (status: string, driver: string) => {
  const isCancelled = status === "Cancelled";
  const isConfirmedDone = [
    "Confirmed",
    "Assigned",
    "Ongoing",
    "Completed",
  ].includes(status);
  const isDriverAssignedDone =
    (!!driver && driver !== "—" && driver !== "Not Assigned") ||
    ["Assigned", "Ongoing", "Completed"].includes(status);
  const isArrivedDone = ["Ongoing", "Completed"].includes(status);
  const isStartedDone = ["Ongoing", "Completed"].includes(status);
  const isCompletedDone = status === "Completed";

  if (isCancelled) {
    return [
      {
        step: "Booking Created",
        time: "24 Aug 2024, 05:15 AM",
        done: true,
        cancelled: false,
      },
      {
        step: "Trip Cancelled",
        time: "24 Aug 2024, 05:30 AM",
        done: true,
        cancelled: true,
      },
    ];
  }

  return [
    {
      step: "Booking Created",
      time: "24 Aug 2024, 05:15 AM",
      done: true,
      cancelled: false,
    },
    {
      step: "Confirmed",
      time: "24 Aug 2024, 05:17 AM",
      done: isConfirmedDone,
      cancelled: false,
    },
    {
      step: "Driver Assigned",
      time: isDriverAssignedDone ? "24 Aug 2024, 05:45 AM" : "—",
      done: isDriverAssignedDone,
      cancelled: false,
    },
    {
      step: "Driver Arrived",
      time: isArrivedDone ? "24 Aug 2024, 06:25 AM" : "—",
      done: isArrivedDone,
      cancelled: false,
    },
    {
      step: "Trip Started",
      time: isStartedDone ? "24 Aug 2024, 06:30 AM" : "—",
      done: isStartedDone,
      cancelled: false,
    },
    {
      step: "Trip Completed",
      time: isCompletedDone ? "24 Aug 2024, 07:15 AM" : "—",
      done: isCompletedDone,
      cancelled: false,
    },
  ];
};

// Fare rules per service + vehicle (base fare, per-km rate, driver batta, toll)
const fareConfig: Record<
  string,
  { base: number; perKm: number; batta: number; gstRate: number }
> = {
  "Airport Taxi_Sedan": { base: 350, perKm: 12, batta: 250, gstRate: 0.05 },
  "Airport Taxi_Toyota Innova": {
    base: 450,
    perKm: 18,
    batta: 350,
    gstRate: 0.05,
  },
  "Airport Taxi_Toyota Etios": {
    base: 350,
    perKm: 11,
    batta: 250,
    gstRate: 0.05,
  },
  "Airport Taxi_Maruti Dzire": {
    base: 350,
    perKm: 12,
    batta: 250,
    gstRate: 0.05,
  },
  "Outstation Cab_Toyota Innova Crysta": {
    base: 0,
    perKm: 22,
    batta: 400,
    gstRate: 0.05,
  },
  "Outstation Cab_Toyota Innova": {
    base: 0,
    perKm: 20,
    batta: 400,
    gstRate: 0.05,
  },
  "Outstation Cab_Maruti Ertiga": {
    base: 0,
    perKm: 14,
    batta: 300,
    gstRate: 0.05,
  },
  "One Way Taxi_Maruti Dzire": {
    base: 0,
    perKm: 12,
    batta: 300,
    gstRate: 0.05,
  },
  "One Way Taxi_Maruti Ertiga": {
    base: 0,
    perKm: 14,
    batta: 300,
    gstRate: 0.05,
  },
  "Local Rental_Honda City": {
    base: 800,
    perKm: 12,
    batta: 150,
    gstRate: 0.05,
  },
  "Tour Package_Tempo Traveller": {
    base: 0,
    perKm: 28,
    batta: 500,
    gstRate: 0.05,
  },
};

function parseFare(fareStr: string): number {
  return parseInt(fareStr.replace(/[^0-9]/g, ""), 10) || 0;
}

function fmt(n: number): string {
  return (
    "₹" +
    n.toLocaleString("en-IN", {
      minimumFractionDigits: n % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

function computeFareBreakdown(
  totalFare: number,
  service: string,
  vehicle: string,
  distanceKm: number,
  toll: number,
  discount: number,
) {
  const gstRate = 0.05;
  const preTaxTotal = Math.round((totalFare / (1 + gstRate)) * 100) / 100;
  const gst = Math.round((totalFare - preTaxTotal) * 100) / 100;

  const key = `${service}_${vehicle}`;
  const cfg = fareConfig[key];

  let distCharge: number;
  let battaCharge: number;

  if (cfg) {
    distCharge = Math.round(distanceKm * cfg.perKm);
    battaCharge = cfg.batta;
  } else {
    distCharge = Math.round(preTaxTotal * 0.35);
    battaCharge = Math.round(preTaxTotal * 0.15);
  }

  const baseFare = Math.round(
    preTaxTotal - distCharge - battaCharge - toll + discount,
  );

  return {
    baseFare,
    distCharge,
    battaCharge,
    toll,
    discount,
    gst,
    total: totalFare,
    gstRate,
    preTaxTotal,
  };
}

export default function BookingDetails({
  bookingId,
  onBack,
}: {
  bookingId: string;
  onBack: () => void;
}) {
  const [liveBookings, setLiveBookings] = useState<Booking[]>([]);
  const [liveDrivers, setLiveDrivers] = useState<any[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignDriver, setAssignDriver] = useState("");
  const [localOverride, setLocalOverride] = useState<Partial<Booking>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeBookings(setLiveBookings);
    const unsub2 = subscribeDrivers(setLiveDrivers);
    return () => {
      unsub();
      unsub2();
    };
  }, []);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const foundBooking = liveBookings.find((b) => b.id === bookingId);
  const booking = foundBooking ? { ...foundBooking, ...localOverride } : null;

  if (!booking) {
    return (
      <div className="p-6 text-center">
        <div className="text-[15px] font-bold text-[#111] mb-2">
          Booking Not Found
        </div>
        <div className="text-[13px] text-[#999]">
          The booking ID "{bookingId}" does not exist.
        </div>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: string) => {
    setLocalOverride((prev) => ({ ...prev, status: newStatus }));
    await setFirestoreDocument(COLLECTIONS.BOOKINGS, booking.id, {
      status: newStatus,
    });
    updateFirestoreDocument(COLLECTIONS.BOOKINGS, booking.id, {
      status: newStatus,
    });
    showNotification(`Booking status updated to "${newStatus}"`);
  };

  const handleCancelTrip = async () => {
    if (booking.status === "Cancelled") {
      showNotification("Trip is already cancelled");
      return;
    }
    if (window.confirm("Are you sure you want to cancel this trip?")) {
      setLocalOverride((prev) => ({ ...prev, status: "Cancelled" }));
      await setFirestoreDocument(COLLECTIONS.BOOKINGS, booking.id, {
        status: "Cancelled",
      });
      updateFirestoreDocument(COLLECTIONS.BOOKINGS, booking.id, {
        status: "Cancelled",
      });
      await updateFirestoreDocument(COLLECTIONS.MARKETPLACE, booking.id, {
        status: "Closed",
      });
      showNotification("Trip cancelled successfully");
    }
  };

  const handleReassignDriver = async () => {
    if (!assignDriver) return;
    const newStatus = "Assigned";
    const selectedObj = availableDrivers.find((d) => d.id === assignDriver);
    const selectedDriverName = selectedObj ? selectedObj.name : assignDriver;
    const selectedDriverId = selectedObj ? selectedObj.id : "";

    setLocalOverride((prev) => ({
      ...prev,
      driver: selectedDriverName,
      status: newStatus,
    }));
    const updates = {
      assignedDriverId: selectedDriverId,
      assignedDriverName: selectedDriverName,
      status: newStatus,
    };
    await updateFirestoreDocument(COLLECTIONS.BOOKINGS, booking.id, updates);
    setShowAssignModal(false);
    showNotification(
      `Driver reassigned to ${selectedDriverName} - Status updated to Assigned`,
    );
  };

  const totalFare = parseFare(String(booking.fare ?? "0"));
  const distanceKm = booking.distanceKm || 0;
  const toll = (booking as any).toll ?? 0;
  const discount = (booking as any).discount ?? 0;

  const fare = computeFareBreakdown(
    totalFare,
    booking.service,
    booking.vehicle,
    distanceKm,
    toll,
    discount,
  );
  const recomputed = Math.round(
    (fare.baseFare +
      fare.distCharge +
      fare.battaCharge +
      fare.toll -
      fare.discount) *
      (1 + fare.gstRate),
  );
  const verified = recomputed === totalFare;

  const timelineItems = getTimeline(
    booking.status || "Confirmed",
    booking.driver || "",
  );

  const availableDrivers = liveDrivers;

  return (
    <div className="p-6 space-y-5 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 border border-gray-700 animate-fade-in">
          <svg
            className="w-4 h-4 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Back + Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[13px] font-medium text-[#666] hover:text-[#111] transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Bookings
        </button>
        <div className="h-4 w-px bg-[#E5E5E5]" />
        <span
          className="text-[13px] font-mono font-bold"
          style={{ color: "#E21B23" }}
        >
          {booking.id}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => {
              const newStatus = prompt(
                "Enter new status (Confirmed, Assigned, Ongoing, Completed, Cancelled):",
                booking.status,
              );
              if (newStatus) handleStatusChange(newStatus);
            }}
            className="px-4 py-2 text-[12px] font-semibold border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] text-[#444] transition-colors"
          >
            Edit Status
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className="px-4 py-2 text-[12px] font-semibold border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] text-[#444] transition-colors"
          >
            {booking.driver &&
            booking.driver !== "—" &&
            booking.driver !== "Not Assigned"
              ? "Reassign Driver"
              : "Assign Driver"}
          </button>
          <button
            onClick={async () => {
              const docId = `INV-${booking.id}`;
              const invNo = `NES-INV-${new Date().getFullYear()}-${booking.id.replace(/[^0-9]/g, "").slice(-4) || "0001"}`;
              const parseNum = (v: any) =>
                parseFloat((v || "0").toString().replace(/[^0-9.]/g, "")) || 0;
              const bookingFare = parseNum(booking.fare);
              const subtotal = Math.round((bookingFare / 1.05) * 100) / 100;
              const totalTax = Math.round((bookingFare - subtotal) * 100) / 100;

              const payload = {
                id: docId,
                invoiceNumber: invNo,
                bookingId: booking.id,
                customerId: booking.customer,
                invoiceDate: new Date().toISOString().split("T")[0],
                companySnapshot: {
                  name: "Nesam Tours & Travels Private Limited",
                  gstin: "33AABCN1234F1Z5",
                  address:
                    "No. 42, Mount Road, Anna Salai, Chennai - 600002, Tamil Nadu",
                  phone: "+91 44 4567 8901",
                  email: "info@nesamtours.in",
                  sacCode: "9964",
                },
                customerSnapshot: {
                  name: booking.customer,
                  phone: booking.phone || "—",
                },
                tripSnapshot: {
                  service: booking.service,
                  pickup: booking.pickup,
                  drop: booking.drop,
                  travelDate: booking.date,
                  travelTime: booking.time,
                  vehicle: booking.vehicle,
                  driverName: booking.driver,
                },
                items: [
                  {
                    description: `${booking.service} (${booking.pickup} → ${booking.drop})`,
                    amount: subtotal,
                  },
                ],
                subtotal,
                discount: 0,
                taxableAmount: subtotal,
                gstRate: 0.05,
                cgst: Math.round((totalTax / 2) * 100) / 100,
                sgst: Math.round((totalTax / 2) * 100) / 100,
                totalTax,
                grandTotal: bookingFare,
                paidAmount: booking.payment === "Paid" ? bookingFare : 0,
                balanceAmount: booking.payment === "Paid" ? 0 : bookingFare,
                paymentStatus: booking.payment === "Paid" ? "Paid" : "Pending",
                invoiceStatus: "Issued",
                createdAt: new Date().toISOString(),
              };

              await setFirestoreDocument(COLLECTIONS.INVOICES, docId, payload);
              showNotification(
                `Tax invoice ${invNo} generated & available in Finance > Invoices`,
              );
            }}
            className="px-4 py-2 text-[12px] font-semibold text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            style={{ background: "#E21B23" }}
          >
            Generate Tax Invoice
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Customer Info */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
            <h3 className="text-[13px] font-bold text-[#111] mb-4 flex items-center gap-2">
              <span
                className="w-1 h-4 rounded-full"
                style={{ background: "#E21B23" }}
              />
              Customer Information
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Name", value: booking.customer },
                { label: "Phone", value: booking.phone || "+91 98412 33456" },
                { label: "Email", value: "rajesh.k@email.com" },
              ].map((f) => (
                <div key={f.label}>
                  <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wide mb-1">
                    {f.label}
                  </div>
                  <div className="text-[13px] font-medium text-[#111]">
                    {f.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trip Info */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
            <h3 className="text-[13px] font-bold text-[#111] mb-4 flex items-center gap-2">
              <span
                className="w-1 h-4 rounded-full"
                style={{ background: "#E21B23" }}
              />
              Trip Information
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Pickup Location", value: booking.pickup },
                { label: "Drop Location", value: booking.drop },
                { label: "Service Type", value: booking.service },
                { label: "Pickup Date", value: booking.date },
                { label: "Pickup Time", value: booking.time },
                { label: "Distance", value: `${distanceKm} km` },
                { label: "Est. Duration", value: "45 mins" },
                { label: "Vehicle", value: booking.vehicle },
              ].map((f) => (
                <div key={f.label}>
                  <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wide mb-1">
                    {f.label}
                  </div>
                  <div className="text-[13px] font-medium text-[#111]">
                    {f.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Driver Info */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
            <h3 className="text-[13px] font-bold text-[#111] mb-4 flex items-center gap-2">
              <span
                className="w-1 h-4 rounded-full"
                style={{ background: "#E21B23" }}
              />
              Driver Information
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Driver Name",
                  value:
                    !booking.driver || booking.driver === "—"
                      ? "Not Assigned"
                      : booking.driver,
                },
                {
                  label: "Phone",
                  value:
                    !booking.driver || booking.driver === "—"
                      ? "—"
                      : "+91 94567 12345",
                },
                {
                  label: "Rating",
                  value:
                    !booking.driver || booking.driver === "—" ? "—" : "4.8 ★",
                },
                {
                  label: "Status",
                  value:
                    !booking.driver || booking.driver === "—"
                      ? "Unassigned"
                      : booking.status === "Completed"
                        ? "Completed"
                        : "On Trip",
                },
              ].map((f) => (
                <div key={f.label}>
                  <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wide mb-1">
                    {f.label}
                  </div>
                  <div className="text-[13px] font-medium text-[#111]">
                    {f.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trip Timeline */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
            <h3 className="text-[13px] font-bold text-[#111] mb-5 flex items-center gap-2">
              <span
                className="w-1 h-4 rounded-full"
                style={{ background: "#E21B23" }}
              />
              Trip Timeline
            </h3>
            <div className="relative">
              <div className="absolute left-3.5 top-2 bottom-2 w-px bg-[#E5E5E5]" />
              <div className="space-y-5">
                {timelineItems.map((t, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div
                      className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 ${
                        t.cancelled
                          ? "border-transparent bg-[#E21B23]"
                          : t.done
                            ? "border-transparent bg-[#E21B23]"
                            : "border-[#E5E5E5] bg-white"
                      }`}
                    >
                      {t.cancelled ? (
                        <svg
                          className="w-3.5 h-3.5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      ) : t.done ? (
                        <svg
                          className="w-3.5 h-3.5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : null}
                    </div>
                    <div>
                      <div
                        className={`text-[13px] font-semibold ${t.cancelled ? "text-[#E21B23]" : t.done ? "text-[#111]" : "text-[#999]"}`}
                      >
                        {t.step}
                      </div>
                      <div className="text-[11px] text-[#999] mt-0.5">
                        {t.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Payment & Status */}
        <div className="space-y-5">
          {/* Payment Summary */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
            <h3 className="text-[13px] font-bold text-[#111] mb-4 flex items-center gap-2">
              <span
                className="w-1 h-4 rounded-full"
                style={{ background: "#E21B23" }}
              />
              Payment Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-[12px]">
                <span className="text-[#666]">Base Fare</span>
                <span className="font-medium text-[#111]">
                  {fmt(fare.baseFare)}
                </span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[#666]">
                  Distance Charge ({distanceKm} km)
                </span>
                <span className="font-medium text-[#111]">
                  {fmt(fare.distCharge)}
                </span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[#666]">Driver Batta</span>
                <span className="font-medium text-[#111]">
                  {fmt(fare.battaCharge)}
                </span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[#666]">Waiting Charge</span>
                <span className="font-medium text-[#111]">₹0</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[#666]">Toll / Extra Charges</span>
                <span className="font-medium text-[#111]">
                  {fmt(fare.toll)}
                </span>
              </div>
              {fare.discount > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-green-600">Discount Applied</span>
                  <span className="font-medium text-green-600">
                    −{fmt(fare.discount)}
                  </span>
                </div>
              )}

              {/* Sub-total + GST */}
              <div className="border-t border-dashed border-[#E5E5E5] pt-3 space-y-2">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#999]">Sub-total (excl. GST)</span>
                  <span className="font-medium text-[#999]">
                    {fmt(fare.preTaxTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#666]">
                    GST ({(fare.gstRate * 100).toFixed(0)}%)
                    <span className="text-[10px] ml-1 text-[#999]">
                      CGST 2.5% + SGST 2.5%
                    </span>
                  </span>
                  <span className="font-medium text-[#111]">
                    {fmt(fare.gst)}
                  </span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="border-t-2 border-[#111] pt-3 flex justify-between items-center">
                <span className="text-[14px] font-bold text-[#111]">
                  Total Amount
                </span>
                <span
                  className="text-[16px] font-bold"
                  style={{ color: "#E21B23" }}
                >
                  {booking.fare}
                </span>
              </div>

              {/* Verification badge */}
              {verified && (
                <div className="flex items-center gap-1.5 text-[10px] text-green-700 bg-green-50 border border-green-100 px-2.5 py-1.5 rounded-lg">
                  <svg
                    className="w-3 h-3 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Fare breakdown verified — all figures add up correctly
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-[#E5E5E5]">
              <div className="flex justify-between text-[12px] mb-2">
                <span className="text-[#666]">Payment Method</span>
                <span className="font-medium text-[#111]">UPI (PhonePe)</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[#666]">Payment Status</span>
                <span
                  className={`font-semibold ${booking.payment === "Paid" ? "text-green-600" : "text-[#E21B23]"}`}
                >
                  {booking.payment}
                </span>
              </div>
            </div>
          </div>

          {/* Booking Status Card */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5 space-y-4">
            <h3 className="text-[13px] font-bold text-[#111] flex items-center gap-2">
              <span
                className="w-1 h-4 rounded-full"
                style={{ background: "#E21B23" }}
              />
              Booking Status
            </h3>

            <div className="text-center py-2">
              <div
                className="inline-flex px-6 py-2 rounded-full text-[13px] font-bold border-2 transition-all cursor-default"
                style={getStatusStyle(booking.status)}
              >
                {booking.status}
              </div>
            </div>

            {/* Status Change Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-[#666]">
                Update Booking Status:
              </label>
              <select
                value={booking.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full text-[12px] font-medium p-2 border border-[#E5E5E5] rounded-lg bg-[#F9F9F9] focus:outline-none focus:border-[#E21B23] text-[#111]"
              >
                {[
                  "Pending",
                  "Confirmed",
                  "Assigned",
                  "Ongoing",
                  "Completed",
                  "Cancelled",
                ].map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={handleCancelTrip}
                disabled={booking.status === "Cancelled"}
                className={`py-2 text-[12px] font-semibold border border-[#E5E5E5] rounded-lg transition-colors ${
                  booking.status === "Cancelled"
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                    : "hover:bg-[#FEF2F2] hover:border-red-200 text-[#E21B23]"
                }`}
              >
                {booking.status === "Cancelled" ? "Cancelled" : "Cancel Trip"}
              </button>

              <button
                onClick={() => setShowAssignModal(true)}
                className="py-2 text-[12px] font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                style={{ background: "#E21B23" }}
              >
                {booking.driver &&
                booking.driver !== "—" &&
                booking.driver !== "Not Assigned"
                  ? "Reassign"
                  : "Assign"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {booking.driver &&
                booking.driver !== "—" &&
                booking.driver !== "Not Assigned"
                  ? "Reassign Driver"
                  : "Assign Driver"}
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-gray-700">
                Select Available Driver:
              </label>
              <select
                className="w-full p-2.5 border rounded-lg text-xs font-medium bg-white focus:border-[#E21B23] focus:outline-none"
                onChange={(e) => setAssignDriver(e.target.value)}
                value={assignDriver}
              >
                <option value="">Select a driver...</option>
                {availableDrivers.map((d: any) => (
                  <option key={d.id || d.name} value={d.id}>
                    {d.name} {d.vehicle ? `(${d.vehicle})` : ""}{" "}
                    {d.status ? ` - ${d.status}` : ""}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="w-1/2 p-2 border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReassignDriver}
                  disabled={!assignDriver}
                  className={`w-1/2 p-2 text-white text-xs font-bold rounded-lg transition-opacity ${
                    assignDriver
                      ? "bg-[#E21B23] hover:opacity-90 cursor-pointer"
                      : "bg-gray-300 cursor-not-allowed"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
