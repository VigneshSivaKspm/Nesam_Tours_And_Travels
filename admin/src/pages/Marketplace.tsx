import { useState, useEffect } from "react";
import { MarketplaceTrip } from "../types";
import {
  subscribeMarketplace,
  updateFirestoreDocument,
  setFirestoreDocument,
  COLLECTIONS,
  subscribeDrivers,
} from "../services/adminFirestoreService";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";

const statusConfig: Record<string, { badge: string; label: string }> = {
  Open: { badge: "bg-blue-50 text-blue-700 border-blue-200", label: "Open" },
  "Bid Received": {
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    label: "Bid Received",
  },
  "Counter Bid": {
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    label: "Counter Bid",
  },
  Accepted: {
    badge: "bg-green-50 text-green-700 border-green-200",
    label: "Accepted",
  },
  Closed: {
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    label: "Closed",
  },
};

const bidStatusStyle: Record<string, string> = {
  Accepted: "text-green-700 bg-green-50",
  Pending: "text-yellow-700 bg-yellow-50",
  Counter: "text-orange-700 bg-orange-50",
  Rejected: "text-[#E21B23] bg-red-50",
};

export default function Marketplace() {
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);
  const [tripBids, setTripBids] = useState<Record<string, any[]>>({});
  const [liveTrips, setLiveTrips] = useState<MarketplaceTrip[]>([]);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showAssignModal, setShowAssignModal] =
    useState<MarketplaceTrip | null>(null);
  const [liveDrivers, setLiveDrivers] = useState<any[]>([]);
  const [newPost, setNewPost] = useState({
    bookingId: "",
    date: "",
    time: "",
    pickup: "",
    drop: "",
    vehicleType: "Sedan",
    distance: "50 km",
    offeredPayout: 1000,
  });
  const [assignDriver, setAssignDriver] = useState("");

  useEffect(() => {
    const unsub = subscribeMarketplace(setLiveTrips);
    const unsub2 = subscribeDrivers(setLiveDrivers);
    return () => {
      unsub();
      unsub2();
    };
  }, []);

  useEffect(() => {
    if (!expandedTrip) return;
    const unsub = onSnapshot(
      collection(db, "marketplace_trips", expandedTrip, "bids"),
      (snap) => {
        setTripBids((prev) => ({
          ...prev,
          [expandedTrip]: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        }));
      },
    );
    return () => unsub();
  }, [expandedTrip]);

  const handlePostTrip = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPost.bookingId.trim()) {
      alert("Booking ID is required.");
      return;
    }
    const id = "MKT-" + Date.now();
    const createdTrip: MarketplaceTrip = {
      id,
      bookingId: newPost.bookingId.trim(),
      date: newPost.date,
      time: newPost.time,
      pickup: newPost.pickup.trim() || "Chennai",
      drop: newPost.drop.trim() || "Destination",
      vehicleType: newPost.vehicleType,
      distance: newPost.distance.trim() || "50 km",
      offeredPayout: "₹" + (newPost.offeredPayout || 1000),
      status: "Open",
      bids: [],
      postedAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    // Optimistically update live trips immediately
    setLiveTrips((prev) => [createdTrip, ...prev]);
    setShowPostModal(false);
    setNewPost({
      bookingId: "",
      date: "",
      time: "",
      pickup: "",
      drop: "",
      vehicleType: "Sedan",
      distance: "50 km",
      offeredPayout: 1000,
    });

    // Save to Firestore
    try {
      await setFirestoreDocument(COLLECTIONS.MARKETPLACE, id, createdTrip);
    } catch (err) {
      console.warn("Error saving marketplace trip to Firestore:", err);
    }
  };

  const filtered = liveTrips.filter(
    (t) => statusFilter === "All" || t.status === statusFilter,
  );

  const stats = [
    {
      label: "Open Trips",
      value: liveTrips.filter((t) => t.status === "Open").length,
      color: "#3B82F6",
    },
    {
      label: "Bids Received",
      value: liveTrips.filter(
        (t) => t.status === "Bid Received" || (t.bids && t.bids.length > 0),
      ).length,
      color: "#8B5CF6",
    },
    {
      label: "Counter Bids",
      value: liveTrips.filter(
        (t) => t.status === "Counter Bid" || t.lastCounterRate,
      ).length,
      color: "#F59E0B",
    },
    {
      label: "Closed Today",
      value: liveTrips.filter((t) => t.status === "Closed").length,
      color: "#10B981",
    },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4"
          >
            <div className="text-[26px] font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-[11px] text-[#999]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
        <svg
          className="w-5 h-5 text-blue-600 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="text-[12px] text-blue-800">
          <span className="font-semibold">Marketplace:</span> Unassigned
          bookings are posted here. Vendors can accept at the offered rate or
          submit a counter-bid. Admin reviews counter-bids and approves/rejects.
        </div>
      </div>

      {/* Filters & Post Trip */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
        <div className="flex gap-1">
          {["All", "Open", "Bid Received", "Counter Bid", "Closed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${statusFilter === s ? "text-white" : "text-[#666] hover:text-[#111] bg-[#F5F5F5]"}`}
              style={statusFilter === s ? { background: "#E21B23" } : {}}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowPostModal(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
          style={{ background: "#E21B23" }}
        >
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Post to Marketplace
        </button>
      </div>

      {/* Trip Cards */}
      <div className="space-y-3">
        {filtered.map((trip) => {
          const sc = statusConfig[trip.status] || statusConfig.Open;
          const isExpanded = expandedTrip === trip.id;
          const bids = tripBids[trip.id] || trip.bids || [];
          return (
            <div
              key={trip.id}
              className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden"
            >
              {/* Trip Row */}
              <div className="p-4">
                <div className="flex flex-wrap items-start gap-4">
                  {/* Route */}
                  <div className="flex-1 min-w-48">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-[11px] font-mono font-bold"
                        style={{ color: "#E21B23" }}
                      >
                        {trip.bookingId}
                      </span>
                      <span className="text-[10px] text-[#999]">
                        • Posted {trip.postedAt}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <div className="w-px h-6 bg-[#E5E5E5]" />
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: "#E21B23" }}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-[12px] font-semibold text-[#111]">
                          {typeof trip.pickup === "object"
                            ? (trip.pickup as any).address
                            : trip.pickup}
                        </div>
                        <div className="text-[12px] font-semibold text-[#111]">
                          {typeof trip.drop === "object"
                            ? (trip.drop as any).address
                            : trip.drop}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap gap-6 text-center">
                    <div>
                      <div className="text-[10px] text-[#999] uppercase tracking-wide mb-1">
                        Date & Time
                      </div>
                      <div className="text-[12px] font-semibold text-[#111]">
                        {trip.date}
                      </div>
                      <div className="text-[11px] text-[#666]">{trip.time}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#999] uppercase tracking-wide mb-1">
                        Vehicle
                      </div>
                      <div className="text-[12px] font-semibold text-[#111]">
                        {trip.vehicleType}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#999] uppercase tracking-wide mb-1">
                        Distance
                      </div>
                      <div className="text-[12px] font-semibold text-[#111]">
                        {trip.distance}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#999] uppercase tracking-wide mb-1">
                        Offered Payout
                      </div>
                      <div
                        className="text-[15px] font-bold"
                        style={{ color: "#E21B23" }}
                      >
                        {trip.offeredPayout}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#999] uppercase tracking-wide mb-1">
                        Bids
                      </div>
                      <div className="text-[15px] font-bold text-[#111]">
                        {trip.bids?.length || 0}
                      </div>
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${sc.badge}`}
                    >
                      {sc.label}
                    </span>
                    <div className="flex gap-1">
                      {bids.length > 0 && (
                        <button
                          onClick={() =>
                            setExpandedTrip(isExpanded ? null : trip.id)
                          }
                          className="text-[11px] px-3 py-1.5 rounded-lg border border-[#E5E5E5] text-[#444] font-semibold hover:bg-[#F5F5F5] transition-colors"
                        >
                          {isExpanded
                            ? "Hide Bids"
                            : `View Bids (${bids.length})`}
                        </button>
                      )}
                      {trip.status === "Open" && (
                        <button
                          onClick={() => setShowAssignModal(trip)}
                          className="text-[11px] px-3 py-1.5 rounded-lg border border-[#E5E5E5] text-[#444] font-semibold hover:bg-[#F5F5F5] transition-colors"
                        >
                          Assign Manually
                        </button>
                      )}
                      {trip.status === "Counter Bid" && (
                        <>
                          <button
                            onClick={() => {
                              updateFirestoreDocument(
                                COLLECTIONS.MARKETPLACE,
                                trip.id,
                                { status: "Accepted" },
                              );
                              updateFirestoreDocument(
                                COLLECTIONS.BOOKINGS,
                                trip.bookingId,
                                { status: "Assigned" },
                              );
                            }}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-green-600 text-white font-semibold hover:opacity-90 transition-opacity"
                          >
                            Accept Counter
                          </button>
                          <button
                            onClick={() =>
                              updateFirestoreDocument(
                                COLLECTIONS.MARKETPLACE,
                                trip.id,
                                { status: "Closed" },
                              )
                            }
                            className="text-[11px] px-3 py-1.5 rounded-lg border border-[#E5E5E5] text-[#E21B23] font-semibold hover:bg-[#FEF2F2] transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bids Panel */}
              {isExpanded && bids && bids.length > 0 && (
                <div className="border-t border-[#E5E5E5] bg-[#F9F9F9] p-4">
                  <div className="text-[11px] font-semibold text-[#999] uppercase tracking-wide mb-3">
                    Bids Received
                  </div>
                  <div className="space-y-2">
                    {bids.map((bid: any, bi: number) => (
                      <div
                        key={bi}
                        className="flex items-center justify-between bg-white rounded-lg border border-[#E5E5E5] px-4 py-3"
                      >
                        <div>
                          <div className="text-[12px] font-semibold text-[#111]">
                            {bid.vendorName}
                          </div>
                          <div className="text-[10px] text-[#999] mt-0.5">
                            {bid.time}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-[15px] font-bold text-[#111]">
                            {bid.amount}
                          </div>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${bidStatusStyle[bid.status] || "bg-gray-100 text-gray-600"}`}
                          >
                            {bid.status}
                          </span>
                          {bid.status === "Pending" && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  updateFirestoreDocument(
                                    COLLECTIONS.MARKETPLACE,
                                    trip.id,
                                    { status: "Accepted" },
                                  );
                                  updateFirestoreDocument(
                                    COLLECTIONS.BOOKINGS,
                                    trip.bookingId,
                                    {
                                      status: "Assigned",
                                      assignedVendorId:
                                        bid.vendorId || bid.vendor || "",
                                      assignedVendorName: bid.vendorName || "",
                                    },
                                  );
                                }}
                                className="text-[11px] px-2 py-1 rounded-md bg-green-600 text-white font-medium hover:opacity-90"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() =>
                                  updateFirestoreDocument(
                                    COLLECTIONS.MARKETPLACE,
                                    trip.id,
                                    { status: "Closed" },
                                  )
                                }
                                className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] text-[#E21B23] font-medium hover:bg-[#FEF2F2]"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {bid.status === "Counter" && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  updateFirestoreDocument(
                                    COLLECTIONS.MARKETPLACE,
                                    trip.id,
                                    { status: "Accepted" },
                                  );
                                  updateFirestoreDocument(
                                    COLLECTIONS.BOOKINGS,
                                    trip.bookingId,
                                    {
                                      status: "Assigned",
                                      assignedVendorId:
                                        bid.vendorId || bid.vendor || "",
                                      assignedVendorName: bid.vendorName || "",
                                    },
                                  );
                                }}
                                className="text-[11px] px-2 py-1 rounded-md bg-green-600 text-white font-medium hover:opacity-90"
                              >
                                Approve Counter
                              </button>
                              <button
                                onClick={() =>
                                  updateFirestoreDocument(
                                    COLLECTIONS.MARKETPLACE,
                                    trip.id,
                                    { status: "Closed" },
                                  )
                                }
                                className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] text-[#E21B23] font-medium hover:bg-[#FEF2F2]"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-16 flex flex-col items-center text-center">
            <svg
              className="w-12 h-12 text-[#E5E5E5] mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-[13px] font-medium text-[#999]">
              No marketplace trips found
            </p>
          </div>
        )}
      </div>

      {showPostModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">
                Post Trip to Marketplace
              </h3>
              <button
                onClick={() => setShowPostModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <input
                placeholder="Booking ID *"
                className="w-full p-2 border rounded text-xs"
                required
                onChange={(e) =>
                  setNewPost({ ...newPost, bookingId: e.target.value })
                }
              />
              <input
                type="date"
                className="w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewPost({ ...newPost, date: e.target.value })
                }
              />
              <input
                type="time"
                className="w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewPost({ ...newPost, time: e.target.value })
                }
              />
              <input
                placeholder="Pickup"
                className="w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewPost({ ...newPost, pickup: e.target.value })
                }
              />
              <input
                placeholder="Drop"
                className="w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewPost({ ...newPost, drop: e.target.value })
                }
              />
              <select
                className="w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewPost({ ...newPost, vehicleType: e.target.value })
                }
              >
                <option>Sedan</option>
                <option>SUV</option>
                <option>Innova</option>
                <option>Tempo Traveller</option>
              </select>
              <input
                placeholder="Distance (e.g. 50 km)"
                className="w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewPost({ ...newPost, distance: e.target.value })
                }
              />
              <input
                placeholder="Offered Payout (₹)"
                type="number"
                className="w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewPost({
                    ...newPost,
                    offeredPayout: Number(e.target.value),
                  })
                }
              />
              <button
                type="button"
                onClick={handlePostTrip}
                className="w-full p-2.5 bg-[#E21B23] hover:bg-[#c4151c] text-white text-xs font-bold rounded-lg mt-2 cursor-pointer transition-colors shadow"
              >
                Post Trip
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">
                Assign Driver
              </h3>
              <button
                onClick={() => setShowAssignModal(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <select
                className="w-full p-2 border rounded text-xs"
                onChange={(e) => setAssignDriver(e.target.value)}
              >
                <option value="">Select a driver...</option>
                {liveDrivers
                  .filter((d) => d.status === "Online")
                  .map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.vehicle})
                    </option>
                  ))}
              </select>
              <button
                onClick={() => {
                  if (assignDriver && showAssignModal) {
                    const drv = liveDrivers.find((d) => d.id === assignDriver);
                    if (drv) {
                      updateFirestoreDocument(
                        COLLECTIONS.BOOKINGS,
                        showAssignModal.bookingId,
                        {
                          status: "Assigned",
                          assignedDriverId: drv.id,
                          assignedDriverName: drv.name,
                          driver: drv.name,
                        },
                      );
                      updateFirestoreDocument(
                        COLLECTIONS.MARKETPLACE,
                        showAssignModal.id,
                        { status: "Closed" },
                      );
                      setShowAssignModal(null);
                    }
                  }
                }}
                className="w-full p-2 bg-[#E21B23] text-white text-xs font-bold rounded mt-2"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
