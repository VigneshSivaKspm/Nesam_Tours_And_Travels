import React, { useState } from "react";
import { TripRecord } from "../types";
import { StatusBadge } from "../components/StatusBadge";

interface TripsHistoryScreenProps {
  trips: TripRecord[];
  onTrackTrip: (trip: TripRecord) => void;
  onCancelTrip: (tripId: string, reason: string) => void;
}

export const TripsHistoryScreen: React.FC<TripsHistoryScreenProps> = ({
  trips,
  onTrackTrip,
  onCancelTrip,
}) => {
  const [activeTab, setActiveTab] = useState<
    "All" | "Upcoming" | "Completed" | "Cancelled"
  >("All");
  const [selectedInvoice, setSelectedInvoice] = useState<TripRecord | null>(
    null,
  );
  const [selectedCancelTrip, setSelectedCancelTrip] =
    useState<TripRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("Change of Plans");

  const filteredTrips = trips.filter((t) => {
    if (activeTab === "All") return true;
    if (activeTab === "Upcoming")
      return (
        t.status === "Confirmed" ||
        t.status === "Trip Started" ||
        t.status === "Pending"
      );
    if (activeTab === "Completed") return t.status === "Completed";
    if (activeTab === "Cancelled") return t.status === "Cancelled";
    return true;
  });

  return (
    <div className="flex-1 bg-[#F7F7F7] overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* ── INVOICE MODAL ── */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4 animate-in zoom-in-95 border border-gray-200">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <div className="flex items-center gap-3">
                <img
                  src="/icons/logo.png"
                  alt="NESAM Logo"
                  className="w-9 h-9 object-contain rounded-lg"
                />
                <div>
                  <h3 className="text-sm font-black text-[#111111] uppercase tracking-wider">
                    OFFICIAL TAX INVOICE
                  </h3>
                  <p className="text-[10px] text-[#E31E24] font-bold uppercase">
                    NESAM TOURS & TRAVELS PRIVATE LIMITED
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400 font-bold">
                  Booking Reference:
                </span>
                <span className="font-bold text-[#111111]">
                  {selectedInvoice.bookingId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-bold">Invoice Date:</span>
                <span className="font-bold text-[#111111]">
                  {selectedInvoice.date}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-bold">
                  Service Category:
                </span>
                <span className="font-bold text-[#111111]">
                  {selectedInvoice.tripType}
                </span>
              </div>

              <div className="border-t border-gray-200 pt-2 space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>Base Ride Fare ({selectedInvoice.distanceKm} km)</span>
                  <span className="font-bold">
                    ₹{Math.round(selectedInvoice.fare / 1.05)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>GST (5%)</span>
                  <span className="font-bold">
                    ₹
                    {selectedInvoice.fare -
                      Math.round(selectedInvoice.fare / 1.05)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-gray-900 pt-2 text-[#E31E24]">
                  <span>Total Amount Paid:</span>
                  <span>₹{selectedInvoice.fare.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  alert(
                    `Downloading PDF Tax Invoice for ${selectedInvoice.bookingId}...`,
                  );
                  setSelectedInvoice(null);
                }}
                className="flex-1 bg-[#E31E24] text-white py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-[#C41820]"
              >
                Download PDF Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CANCELLATION MODAL ── */}
      {selectedCancelTrip && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4 border border-gray-200">
            <h3 className="text-sm font-black text-[#D92D20] uppercase tracking-wider">
              CANCEL BOOKING #{selectedCancelTrip.bookingId}?
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Please select a reason for cancellation. As per NESAM policy, 100%
              refund is initiated to source account if cancelled before captain
              dispatch.
            </p>

            <div className="space-y-2">
              {[
                "Change of Plans",
                "Captain Delayed",
                "Booked by Mistake",
                "Found Alternate Travel",
              ].map((reason) => (
                <div
                  key={reason}
                  onClick={() => setCancelReason(reason)}
                  className={`p-3 rounded-2xl border text-xs font-bold cursor-pointer transition-all ${
                    cancelReason === reason
                      ? "border-[#E31E24] bg-red-50 text-[#E31E24]"
                      : "border-gray-200 text-gray-700"
                  }`}
                >
                  {reason}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedCancelTrip(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-2xl font-bold text-xs"
              >
                Keep Booking
              </button>
              <button
                onClick={() => {
                  onCancelTrip(selectedCancelTrip.id, cancelReason);
                  setSelectedCancelTrip(null);
                }}
                className="flex-1 bg-[#D92D20] text-white py-3 rounded-2xl font-bold text-xs shadow"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-[#111111] uppercase tracking-wider">
            MY TRIPS & HISTORY
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Track active rides, download invoices, & manage bookings
          </p>
        </div>
        <div className="flex gap-1.5 bg-gray-200 p-1.5 rounded-2xl">
          {(["All", "Upcoming", "Completed", "Cancelled"] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTab === tab
                    ? "bg-[#E31E24] text-white shadow-sm"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                {tab}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Trips List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTrips.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-3xl border border-gray-200 text-center space-y-2">
            <h3 className="text-sm font-bold text-gray-700">
              No {activeTab.toLowerCase()} trips found
            </h3>
            <p className="text-xs text-gray-400">
              Book a ride today for safe, reliable travel.
            </p>
          </div>
        ) : (
          filteredTrips.map((trip) => (
            <div
              key={trip.id}
              className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-4 hover:border-[#E31E24] transition-all flex flex-col justify-between"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">
                    Booking #{trip.bookingId}
                  </span>
                  <div className="text-xs font-black text-[#111111]">
                    {trip.date} • {trip.time}
                  </div>
                </div>
                <StatusBadge status={trip.status} />
              </div>

              {/* Route */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#20A464]" />
                  <span className="font-bold text-[#111111] truncate">
                    {trip.pickup.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E31E24]" />
                  <span className="font-bold text-[#111111] truncate">
                    {trip.drop.name}
                  </span>
                </div>
              </div>

              {/* Driver & Fare */}
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100 text-xs">
                <div>
                  <div className="font-black text-[#111111]">
                    {trip.vehicle.name}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">
                    {trip.driver
                      ? `Captain: ${trip.driver.name}`
                      : "Awaiting Driver"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-[#E31E24] text-sm">
                    ₹{trip.fare.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-gray-400 font-bold">
                    {trip.paymentMethod}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {trip.status === "Trip Started" ||
                trip.status === "Confirmed" ? (
                  <button
                    onClick={() => onTrackTrip(trip)}
                    className="flex-1 bg-[#E31E24] text-white py-2.5 rounded-2xl text-xs font-black shadow hover:bg-[#C41820]"
                  >
                    Track Live Ride →
                  </button>
                ) : null}

                {trip.status === "Completed" && (
                  <button
                    onClick={() => setSelectedInvoice(trip)}
                    className="flex-1 bg-gray-100 text-[#111111] border border-gray-300 py-2.5 rounded-2xl text-xs font-bold hover:bg-gray-200"
                  >
                    View Tax Invoice
                  </button>
                )}

                {trip.status === "Confirmed" && (
                  <button
                    onClick={() => setSelectedCancelTrip(trip)}
                    className="px-4 bg-red-50 text-[#D92D20] border border-red-200 py-2.5 rounded-2xl text-xs font-bold hover:bg-red-100"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
