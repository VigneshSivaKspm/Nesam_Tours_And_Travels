import { useState, useEffect } from "react";
import { Booking, TravelService, MasterLocation, FareRule, VehicleCategory, Customer } from "../types";
import {
  subscribeBookings,
  subscribeServices,
  subscribeLocations,
  subscribeFareRules,
  subscribeVehicleCategories,
  subscribeCustomers,
  setFirestoreDocument,
  COLLECTIONS,
} from "../services/adminFirestoreService";
import { calculateCentralFare } from "../services/fareEngine";

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    Completed: "bg-green-50 text-green-700 border-green-200",
    Confirmed: "bg-blue-50 text-blue-700 border-blue-200",
    Ongoing: "bg-orange-50 text-orange-700 border-orange-200",
    Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Cancelled: "bg-red-50 text-[#E21B23] border-red-200",
    Assigned: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${styles[status] || "bg-gray-50 text-gray-600 border-gray-200"}`}
    >
      {status}
    </span>
  );
};

const PaymentBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    Paid: "text-green-700 bg-green-50",
    Pending: "text-yellow-700 bg-yellow-50",
    Unpaid: "text-red-700 bg-red-50",
    Refunded: "text-gray-600 bg-gray-100",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${styles[status] || "bg-gray-50 text-gray-600"}`}
    >
      {status}
    </span>
  );
};

export default function Bookings({
  onSelectBooking,
}: {
  onSelectBooking: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [serviceFilter, setServiceFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBooking, setNewBooking] = useState({
    name: "",
    phone: "",
    service: "Airport Taxi",
    pickup: "",
    drop: "",
    date: "",
    time: "",
    vehicle: "Sedan",
    fare: 0,
    payment: "Cash",
  });
  const [liveBookings, setLiveBookings] = useState<Booking[]>([]);
  const [liveServices, setLiveServices] = useState<TravelService[]>([]);
  const [liveLocations, setLiveLocations] = useState<MasterLocation[]>([]);
  const [liveFareRules, setLiveFareRules] = useState<FareRule[]>([]);
  const [liveCategories, setLiveCategories] = useState<VehicleCategory[]>([]);
  const [liveCustomers, setLiveCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    const unsubB = subscribeBookings(setLiveBookings);
    const unsubS = subscribeServices(setLiveServices);
    const unsubL = subscribeLocations(setLiveLocations);
    const unsubF = subscribeFareRules(setLiveFareRules);
    const unsubC = subscribeVehicleCategories(setLiveCategories);
    const unsubCust = subscribeCustomers(setLiveCustomers);
    return () => {
      unsubB();
      unsubS();
      unsubL();
      unsubF();
      unsubC();
      unsubCust();
    };
  }, []);

  const handleCreateBooking = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newBooking.name.trim()) {
      alert("Customer Name is required.");
      return;
    }
    const id = "NTT-" + Date.now();
    const createdBooking: Booking = {
      id,
      customer: newBooking.name.trim(),
      customerName: newBooking.name.trim(),
      customerPhone: newBooking.phone.trim(),
      phone: newBooking.phone.trim(),
      service: newBooking.service,
      pickup: newBooking.pickup.trim() || "Pickup Location",
      drop: newBooking.drop.trim() || "Drop Location",
      date: newBooking.date || new Date().toISOString().split("T")[0],
      time: newBooking.time || "10:00 AM",
      vehicle: newBooking.vehicle,
      fare: "₹" + (newBooking.fare || 0),
      payment: newBooking.payment,
      paymentStatus: "Pending",
      status: "Confirmed",
      boardingOTP: String(Math.floor(1000 + Math.random() * 9000)),
    };

    // Optimistically update bookings list immediately
    setLiveBookings((prev) => [createdBooking, ...prev]);
    setShowAddModal(false);
    setNewBooking({
      name: "",
      phone: "",
      service: "Airport Taxi",
      pickup: "",
      drop: "",
      date: "",
      time: "",
      vehicle: "Sedan",
      fare: 0,
      payment: "Cash",
    });

    // Save to Firestore
    try {
      await setFirestoreDocument(COLLECTIONS.BOOKINGS, id, createdBooking);
    } catch (err) {
      console.warn("Error saving booking to Firestore:", err);
    }
  };

  const statuses = [
    "All",
    "Pending",
    "Confirmed",
    "Assigned",
    "Ongoing",
    "Completed",
    "Cancelled",
  ];
  const services = [
    "All",
    "Airport Taxi",
    "Outstation Cab",
    "One Way Taxi",
    "Local Rental",
    "Tour Package",
  ];

  const filtered = liveBookings.filter((b) => {
    const matchSearch =
      search === "" ||
      (b.id && b.id.toLowerCase().includes(search.toLowerCase())) ||
      (b.customer && b.customer.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "All" || b.status === statusFilter;
    const matchService = serviceFilter === "All" || b.service === serviceFilter;
    const matchDate = dateFilter === "" || b.date === dateFilter;
    return matchSearch && matchStatus && matchService && matchDate;
  });

  const paginated = filtered.slice((page - 1) * 20, page * 20);

  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const handleExportCSV = () => {
    const headers = [
      "Booking ID",
      "Customer",
      "Phone",
      "Service",
      "Pickup",
      "Drop",
      "Date",
      "Time",
      "Vehicle",
      "Driver",
      "Fare",
      "Payment",
      "Status",
    ];
    const rows = filtered.map((b) => [
      b.id,
      b.customer,
      b.phone || "",
      b.service,
      b.pickup,
      b.drop,
      b.date,
      b.time,
      b.vehicle,
      b.driver,
      b.fare,
      b.payment,
      b.status,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        headers.join(","),
        ...rows.map((e) => e.map((val) => `"${val}"`).join(",")),
      ].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bookings_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveEdit = async () => {
    if (!editingBooking) return;
    setLiveBookings((prev) =>
      prev.map((b) => (b.id === editingBooking.id ? editingBooking : b))
    );
    await setFirestoreDocument(
      COLLECTIONS.BOOKINGS,
      editingBooking.id,
      editingBooking,
    );
    setEditingBooking(null);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
        <div className="relative flex-1 min-w-48">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]"
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
            placeholder="Search booking ID, customer..."
            className="w-full pl-9 pr-4 py-2 text-[13px] bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] placeholder-[#999]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#E21B23] text-[#444]"
        >
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#E21B23] text-[#444]"
        >
          {services.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] text-[#444]"
        />
        <div className="flex gap-2 ml-auto">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-[#444] border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] transition-colors cursor-pointer"
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
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
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
            Add Booking
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", count: liveBookings.length, color: "#111111" },
          {
            label: "Pending",
            count: liveBookings.filter((b: any) => b.status === "Pending")
              .length,
            color: "#F59E0B",
          },
          {
            label: "Ongoing",
            count: liveBookings.filter((b: any) => b.status === "Ongoing")
              .length,
            color: "#E21B23",
          },
          {
            label: "Completed",
            count: liveBookings.filter((b: any) => b.status === "Completed")
              .length,
            color: "#10B981",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-[#E5E5E5] p-4 flex items-center gap-3"
          >
            <div
              className="w-2 h-8 rounded-full"
              style={{ background: s.color }}
            />
            <div>
              <div className="text-[20px] font-bold" style={{ color: s.color }}>
                {s.count}
              </div>
              <div className="text-[11px] text-[#999]">{s.label} Bookings</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#111]">
            {filtered.length} bookings
          </span>
          <span className="text-[11px] text-[#999]">
            Sorted by date (newest first)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                {[
                  "Booking ID",
                  "Customer",
                  "Service",
                  "Pickup",
                  "Destination",
                  "Date & Time",
                  "Vehicle",
                  "Driver",
                  "Fare",
                  "Payment",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((b, i) => (
                <tr
                  key={i}
                  className="table-row border-b border-[#F5F5F5] last:border-0"
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onSelectBooking(b.id)}
                      className="text-[12px] font-mono font-semibold hover:underline"
                      style={{ color: "#E21B23" }}
                    >
                      {b.id}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-medium text-[#111] whitespace-nowrap">
                    {b.customer}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] px-2 py-0.5 bg-[#F5F5F5] rounded-md font-medium text-[#444]">
                      {b.service}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[#666] max-w-[120px] truncate">
                    {b.pickup}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[#666] max-w-[120px] truncate">
                    {b.drop}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-[11px] text-[#111]">{b.date}</div>
                    <div className="text-[10px] text-[#999]">{b.time}</div>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[#666] whitespace-nowrap">
                    {b.vehicle}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[#666]">
                    {b.driver}
                  </td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-[#111]">
                    {b.fare}
                  </td>
                  <td className="px-4 py-3">
                    <PaymentBadge status={b.payment} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onSelectBooking(b.id)}
                        className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] hover:bg-[#FEF2F2] text-[#E21B23] font-medium transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => setEditingBooking(b)}
                        className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] hover:bg-[#F5F5F5] text-[#444] font-medium transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-16 flex flex-col items-center text-center">
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-[13px] font-medium text-[#999]">
                No bookings found
              </p>
            </div>
          )}
        </div>
        {/* Pagination */}
        <div className="px-5 py-3 border-t border-[#E5E5E5] flex items-center justify-between">
          <span className="text-[12px] text-[#999]">
            Showing {paginated.length} of {filtered.length} results
          </span>
          <div className="flex gap-1">
            {Array.from({ length: Math.ceil(filtered.length / 20) }).map(
              (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`w-8 h-8 text-[12px] rounded-lg font-medium transition-colors ${
                    page === i + 1
                      ? "text-white"
                      : "text-[#666] hover:bg-[#F5F5F5]"
                  }`}
                  style={page === i + 1 ? { background: "#E21B23" } : {}}
                >
                  {i + 1}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Edit Booking Modal */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">
                Edit Booking: {editingBooking.id}
              </h3>
              <button
                onClick={() => setEditingBooking(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#666] block mb-1">
                  Customer Name
                </label>
                <input
                  value={editingBooking.customer || ""}
                  onChange={(e) =>
                    setEditingBooking({
                      ...editingBooking,
                      customer: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#666] block mb-1">
                  Phone
                </label>
                <input
                  value={editingBooking.phone || ""}
                  onChange={(e) =>
                    setEditingBooking({
                      ...editingBooking,
                      phone: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#666] block mb-1">
                  Service Type
                </label>
                <select
                  value={editingBooking.service || "Airport Taxi"}
                  onChange={(e) =>
                    setEditingBooking({
                      ...editingBooking,
                      service: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded text-xs"
                >
                  {liveServices.length > 0
                    ? liveServices.filter(s => s.status === "Active").map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))
                    : ["Airport Taxi", "Outstation Cab", "One Way Taxi", "Local Rental", "Tour Package"].map(srvName => (
                        <option key={srvName} value={srvName}>{srvName}</option>
                      ))
                  }
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#666] block mb-1">
                  Vehicle
                </label>
                <input
                  value={editingBooking.vehicle || ""}
                  onChange={(e) =>
                    setEditingBooking({
                      ...editingBooking,
                      vehicle: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#666] block mb-1">
                  Assigned Driver
                </label>
                <input
                  value={editingBooking.driver || ""}
                  onChange={(e) =>
                    setEditingBooking({
                      ...editingBooking,
                      driver: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#666] block mb-1">
                  Fare
                </label>
                <input
                  value={editingBooking.fare || ""}
                  onChange={(e) =>
                    setEditingBooking({
                      ...editingBooking,
                      fare: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#666] block mb-1">
                  Payment Status
                </label>
                <select
                  value={editingBooking.payment}
                  onChange={(e) =>
                    setEditingBooking({
                      ...editingBooking,
                      payment: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded text-xs"
                >
                  <option>Paid</option>
                  <option>Pending</option>
                  <option>Unpaid</option>
                  <option>Refunded</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#666] block mb-1">
                  Booking Status
                </label>
                <select
                  value={editingBooking.status}
                  onChange={(e) =>
                    setEditingBooking({
                      ...editingBooking,
                      status: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded text-xs"
                >
                  <option>Pending</option>
                  <option>Confirmed</option>
                  <option>Assigned</option>
                  <option>Ongoing</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>
              </div>
              <div className="col-span-2 flex gap-2 pt-2">
                <button
                  onClick={() => setEditingBooking(null)}
                  className="w-1/2 p-2 border border-gray-300 text-gray-700 text-xs font-bold rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="w-1/2 p-2 bg-[#E21B23] text-white text-xs font-bold rounded"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Booking Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">
                Add New Booking
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Customer Name *"
                list="registered-customers"
                className="col-span-2 w-full p-2 border rounded text-xs"
                required
                onChange={(e) => {
                  const val = e.target.value;
                  const found = liveCustomers.find((c) => c.name === val);
                  if (found) {
                    setNewBooking((prev) => ({
                      ...prev,
                      name: found.name,
                      phone: found.phone || prev.phone,
                    }));
                  } else {
                    setNewBooking((prev) => ({ ...prev, name: val }));
                  }
                }}
              />
              <datalist id="registered-customers">
                {liveCustomers.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.phone} ({c.id})
                  </option>
                ))}
              </datalist>
              <input
                placeholder="Phone"
                type="tel"
                className="col-span-2 w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewBooking({ ...newBooking, phone: e.target.value })
                }
              />

              <select
                className="col-span-2 w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewBooking({ ...newBooking, service: e.target.value })
                }
              >
                {liveServices.length > 0
                  ? liveServices.filter(s => s.status === "Active").map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))
                  : ["Airport Taxi", "Outstation Cab", "One Way Taxi", "Local Rental", "Tour Package"].map(srvName => (
                      <option key={srvName} value={srvName}>{srvName}</option>
                    ))
                }
              </select>

              <input
                placeholder="Pickup Address"
                list="master-pickup-locations"
                className="w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewBooking({ ...newBooking, pickup: e.target.value })
                }
              />
              <datalist id="master-pickup-locations">
                {liveLocations
                  .filter((l) => l.status === "Active" && l.pickupEnabled !== false)
                  .map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.city} ({l.type})
                    </option>
                  ))}
              </datalist>

              <input
                placeholder="Drop Address"
                list="master-drop-locations"
                className="w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewBooking({ ...newBooking, drop: e.target.value })
                }
              />
              <datalist id="master-drop-locations">
                {liveLocations
                  .filter((l) => l.status === "Active" && l.dropEnabled !== false)
                  .map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.city} ({l.type})
                    </option>
                  ))}
              </datalist>

              <input
                type="date"
                className="w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewBooking({ ...newBooking, date: e.target.value })
                }
              />
              <input
                type="time"
                className="w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewBooking({ ...newBooking, time: e.target.value })
                }
              />

              <select
                className="col-span-2 w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewBooking({ ...newBooking, vehicle: e.target.value })
                }
              >
                <option>Sedan</option>
                <option>SUV</option>
                <option>Innova</option>
                <option>Tempo Traveller</option>
              </select>

              <input
                placeholder="Fare (₹)"
                type="number"
                className="w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewBooking({ ...newBooking, fare: Number(e.target.value) })
                }
              />
              <select
                className="w-full p-2 border rounded text-xs"
                onChange={(e) =>
                  setNewBooking({ ...newBooking, payment: e.target.value })
                }
              >
                <option>Cash</option>
                <option>UPI</option>
                <option>Card</option>
              </select>

              <button
                type="button"
                onClick={handleCreateBooking}
                className="col-span-2 w-full p-2.5 bg-[#E21B23] hover:bg-[#c4151c] text-white text-xs font-bold rounded-lg mt-2 cursor-pointer transition-colors shadow"
              >
                Create Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
