import { useState, useEffect } from "react";
import { Booking } from "../types";
import { subscribeBookings } from "../services/adminFirestoreService";

const statusConfig: Record<string, { color: string; bg: string; dot: string }> =
  {
    "Trip Started": { color: "#E21B23", bg: "#FEF2F2", dot: "bg-[#E21B23]" },
    "Waiting at Pickup": {
      color: "#F59E0B",
      bg: "#FFFBEB",
      dot: "bg-yellow-500",
    },
    "En Route to Pickup": {
      color: "#3B82F6",
      bg: "#EFF6FF",
      dot: "bg-blue-500",
    },
    Completed: { color: "#10B981", bg: "#ECFDF5", dot: "bg-green-500" },
    Confirmed: { color: "#3B82F6", bg: "#EFF6FF", dot: "bg-blue-500" },
    Assigned: { color: "#8B5CF6", bg: "#F5F3FF", dot: "bg-purple-500" },
  };

export default function LiveTrips() {
  const [liveTripsList, setLiveTripsList] = useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<{
    title: string;
    src: string;
  } | null>(null);

  useEffect(() => {
    const unsub = subscribeBookings((bookings: Booking[]) => {
      const active = bookings.filter(
        (b: any) =>
          b.status === "Ongoing" ||
          b.status === "In Progress" ||
          b.status === "En Route to Pickup" ||
          b.status === "Trip Started" ||
          b.status === "Assigned",
      );
      if (active.length > 0) {
        setLiveTripsList(
          active.map((a: any) => ({
            id: a.id,
            bookingId: a.bookingId || a.id,
            driver: a.driver || a.assignedDriverName || "Unassigned",
            vehicle: a.vehicle || a.assignedVehicleNumber || "—",
            pickup: a.pickup || a.pickupAddress || "—",
            drop: a.drop || a.dropAddress || "—",
            customerPhone: a.phone || a.customerPhone || "",
            status: a.status === "Ongoing" ? "Trip Started" : a.status,
            startedAt: a.time || "—",
            eta: a.eta || "—",
            currentLocation:
              a.currentLocation || a.pickup || a.pickupAddress || "—",
            boardingOTPVerified: Boolean(a.verified || a.boardingOTP),
            fare:
              a.fare === undefined || a.fare === null || a.fare === ""
                ? "—"
                : typeof a.fare === "number"
                  ? `₹${a.fare.toLocaleString("en-IN")}`
                  : String(a.fare).startsWith("₹")
                    ? a.fare
                    : `₹${a.fare}`,
            vendor: a.vendor || a.vendorName || "Direct Fleet",
            driverPhone: a.driverPhone || a.assignedDriverPhone || "",
            preTrip: a.preTrip || null,
          })),
        );
      } else {
        setLiveTripsList([]);
      }
    });
    return () => unsub();
  }, []);

  const trip =
    liveTripsList.find((t) => t.id === selectedTrip) || liveTripsList[0];

  return (
    <div className="p-6 space-y-5">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Active Trips",
            value: liveTripsList.length,
            color: "#E21B23",
          },
          {
            label: "Trip Started",
            value: liveTripsList.filter((t) => t.status === "Trip Started")
              .length,
            color: "#E21B23",
          },
          {
            label: "En Route to Pickup",
            value: liveTripsList.filter(
              (t) => t.status === "En Route to Pickup",
            ).length,
            color: "#3B82F6",
          },
          {
            label: "Waiting at Pickup",
            value: liveTripsList.filter((t) => t.status === "Waiting at Pickup")
              .length,
            color: "#F59E0B",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: s.color }}
              />
              <span className="text-[11px] text-[#999]">{s.label}</span>
            </div>
            <div className="text-[26px] font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Trip List */}
        <div className="space-y-3">
          <h3 className="text-[13px] font-bold text-[#111]">Live Trip Feed</h3>
          {liveTripsList.map((t) => {
            const sc = statusConfig[t.status] || statusConfig["Trip Started"];
            return (
              <div
                key={t.id}
                onClick={() => setSelectedTrip(t.id)}
                className={`bg-white rounded-xl border-2 shadow-sm p-4 cursor-pointer transition-all hover:shadow-md ${selectedTrip === t.id ? "border-[#E21B23]" : "border-[#E5E5E5]"}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div
                      className="text-[11px] font-mono font-bold"
                      style={{ color: "#E21B23" }}
                    >
                      {t.bookingId}
                    </div>
                    <div className="text-[12px] font-semibold text-[#111] mt-0.5">
                      {t.driver}
                    </div>
                    <div className="text-[10px] text-[#999]">{t.vehicle}</div>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full`}
                    style={{ color: sc.color, background: sc.bg }}
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full mr-1 animate-pulse"
                      style={{ background: sc.color }}
                    />
                    {t.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <div className="w-px h-4 bg-[#E5E5E5]" />
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "#E21B23" }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[#666] truncate max-w-[160px]">
                      {t.pickup}
                    </div>
                    <div className="text-[#666] truncate max-w-[160px]">
                      {t.drop}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-[#999]">
                    📍 {t.currentLocation}
                  </span>
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: "#E21B23" }}
                  >
                    {t.fare}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trip Detail Panel */}
        {trip && (
          <div className="lg:col-span-2 space-y-4">
            {/* Map Placeholder */}
            <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
              <div
                className="relative"
                style={{
                  height: 220,
                  background:
                    "linear-gradient(135deg, #F5F5F5 0%, #E5E5E5 100%)",
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                  <svg
                    className="w-10 h-10 text-[#E21B23]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <p className="text-[12px] text-[#999] font-medium">
                    Live Map — Google Maps Integration
                  </p>
                  <p className="text-[11px] text-[#999]">
                    Current Location: {trip.currentLocation}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[11px] text-green-600 font-medium">
                      Live GPS Tracking Active
                    </span>
                  </div>
                </div>
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-[11px] font-semibold text-[#111] shadow-sm border border-[#E5E5E5]">
                  ETA: {trip.eta}
                </div>
                <div
                  className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-[11px] font-semibold shadow-sm border border-[#E5E5E5]"
                  style={{ color: "#E21B23" }}
                >
                  {trip.status}
                </div>
              </div>
            </div>

            {/* Trip Info & OTP */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
                <h4 className="text-[12px] font-bold text-[#111] mb-3 flex items-center gap-2">
                  <span
                    className="w-1 h-3.5 rounded-full"
                    style={{ background: "#E21B23" }}
                  />
                  Trip Details
                </h4>
                <div className="space-y-2">
                  {[
                    { label: "Driver", value: trip.driver },
                    { label: "Vehicle", value: trip.vehicle },
                    { label: "Vendor", value: trip.vendor },
                    { label: "Started", value: trip.startedAt },
                    { label: "Fare", value: trip.fare },
                  ].map((f) => (
                    <div
                      key={f.label}
                      className="flex justify-between text-[12px]"
                    >
                      <span className="text-[#999]">{f.label}</span>
                      <span className="font-semibold text-[#111]">
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
                <h4 className="text-[12px] font-bold text-[#111] mb-3 flex items-center gap-2">
                  <span
                    className="w-1 h-3.5 rounded-full"
                    style={{ background: "#E21B23" }}
                  />
                  Boarding OTP
                </h4>
                {trip.boardingOTPVerified ? (
                  <div className="text-center py-2">
                    <div className="text-[11px] text-green-600 font-semibold flex items-center justify-center gap-1 mb-2">
                      <svg
                        className="w-4 h-4"
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
                      OTP Verified
                    </div>
                    <div
                      className="text-[28px] font-bold tracking-widest"
                      style={{ color: "#E21B23" }}
                    >
                      {trip.boardingOTPVerified ? "••••" : "—"}
                    </div>
                    <div className="text-[10px] text-[#999] mt-1">
                      Customer boarded successfully
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-2">
                      <svg
                        className="w-5 h-5 text-yellow-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div className="text-[12px] font-semibold text-yellow-700">
                      Awaiting OTP Verification
                    </div>
                    <div className="text-[10px] text-[#999] mt-1">
                      Customer has not boarded yet
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pre-Trip Verification Photos */}
            {(() => {
              const photos = [
                { label: "Driver Selfie", src: trip.preTrip?.selfie },
                { label: "Vehicle Front", src: trip.preTrip?.vehicleFront },
                { label: "Odometer", src: trip.preTrip?.odometer },
                { label: "Rear Seat", src: trip.preTrip?.rearSeat },
              ];
              const submitted = photos.filter(
                (p) => typeof p.src === "string" && p.src.length > 0,
              );
              return (
                <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
                  <h4 className="text-[12px] font-bold text-[#111] mb-3 flex items-center gap-2">
                    <span
                      className="w-1 h-3.5 rounded-full"
                      style={{ background: "#E21B23" }}
                    />
                    Pre-Trip Verification Photos
                    <span
                      className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${submitted.length === 4 ? "text-green-600 bg-green-50" : "text-[#999] bg-[#F5F5F5]"}`}
                    >
                      {submitted.length}/4 Submitted
                    </span>
                  </h4>
                  {submitted.length === 0 ? (
                    <div className="py-6 text-center text-[11px] text-[#999]">
                      Driver has not uploaded verification photos yet
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      {photos.map((p) => (
                        <div key={p.label} className="text-center">
                          <button
                            disabled={!p.src}
                            onClick={() =>
                              p.src &&
                              setPhotoModal({ title: p.label, src: p.src })
                            }
                            className="block w-full aspect-square rounded-xl border-2 border-[#E5E5E5] overflow-hidden hover:border-[#E21B23] transition-colors relative group disabled:opacity-40 disabled:hover:border-[#E5E5E5]"
                          >
                            {p.src ? (
                              <img
                                src={p.src}
                                alt={p.label}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] text-[#BBB]">
                                Missing
                              </div>
                            )}
                            {p.src && (
                              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                <svg
                                  className="w-2.5 h-2.5 text-white"
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
                              </div>
                            )}
                          </button>
                          <div className="text-[10px] text-[#999] mt-1.5 font-medium">
                            {p.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => alert(`Driver: ${trip.driver}${trip.driverPhone ? `\nPhone: ${trip.driverPhone}` : "\nNo phone number on file"}`)}
                className="flex-1 py-2.5 text-[12px] font-semibold border border-[#E5E5E5] rounded-xl hover:bg-[#F5F5F5] text-[#444] transition-colors cursor-pointer"
              >
                Contact Driver
              </button>
              <button
                onClick={() => alert(`Customer for ${trip.bookingId}${trip.customerPhone ? `\nPhone: ${trip.customerPhone}` : "\nNo phone number on file"}`)}
                className="flex-1 py-2.5 text-[12px] font-semibold border border-[#E5E5E5] rounded-xl hover:bg-[#F5F5F5] text-[#444] transition-colors cursor-pointer"
              >
                Contact Customer
              </button>
              <button
                onClick={async () => {
                  if (window.confirm(`Are you sure you want to trigger an Emergency Cancel for booking ${trip.bookingId}?`)) {
                    import('../services/adminFirestoreService').then(({ updateFirestoreDocument, COLLECTIONS }) => {
                      updateFirestoreDocument(COLLECTIONS.BOOKINGS, trip.bookingId, { status: "Cancelled" });
                    });
                    setLiveTripsList(prev => prev.filter(t => t.id !== trip.id));
                    alert(`Trip ${trip.bookingId} cancelled.`);
                  }
                }}
                className="flex-1 py-2.5 text-[12px] font-semibold border border-[#E5E5E5] rounded-xl hover:bg-[#FEF2F2] text-[#E21B23] transition-colors cursor-pointer"
              >
                Emergency Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Photo Modal */}
      {photoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setPhotoModal(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
              <span className="font-semibold text-[#111] text-[13px]">
                {photoModal.title}
              </span>
              <button
                onClick={() => setPhotoModal(null)}
                className="text-[#999] hover:text-[#111]"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <img
              src={photoModal.src}
              alt={photoModal.title}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
