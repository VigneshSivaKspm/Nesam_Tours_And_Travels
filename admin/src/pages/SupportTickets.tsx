import { useState, useEffect } from "react";
import {
  subscribeToCollection,
  updateFirestoreDocument,
  setFirestoreDocument,
} from "../services/adminFirestoreService";

const SUPPORT_COLLECTION = "support_tickets";

const statusColor: Record<string, string> = {
  Open: "bg-yellow-50 text-yellow-700 border-yellow-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  Resolved: "bg-green-50 text-green-700 border-green-200",
  Closed: "bg-gray-50 text-gray-600 border-gray-200",
};

const defaultMockTickets = [
  {
    id: "TCK-8021",
    customerName: "Meenakshi Sundaram",
    customerPhone: "+91 98410 77665",
    category: "Airport Pickup Query",
    description: "Flight 6E-241 landing at Chennai Terminal 4 was delayed by 45 minutes. Need confirmation that driver will wait without extra waiting fee.",
    priority: "High",
    status: "Open",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    bookingId: "NTT-2024-4826",
    assignedTo: "Pradeep Kumar",
  },
  {
    id: "TCK-8022",
    customerName: "Venkatesh Prasad",
    customerPhone: "+91 97909 33445",
    category: "Refund Request",
    description: "Cancelled Outstation booking NTT-2024-4780 24 hours in advance. Requesting status of advance ₹2,500 refund to original payment source.",
    priority: "Medium",
    status: "In Progress",
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    bookingId: "NTT-2024-4780",
    assignedTo: "Kiran Raj",
  },
  {
    id: "TCK-8023",
    customerName: "Cognizant Travel Desk (Anand)",
    customerPhone: "+91 99401 55667",
    category: "Corporate GST Invoice",
    description: "Need revised tax invoice with corporate GSTIN 33AAACC1234D1Z8 for 4 airport cabs booked on 22nd Aug.",
    priority: "High",
    status: "In Progress",
    createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
    bookingId: "NTT-2024-4820",
    assignedTo: "Kiran Raj",
  },
  {
    id: "TCK-8024",
    customerName: "Saravanan Natarajan",
    customerPhone: "+91 94432 99887",
    category: "Tour Package Itinerary",
    description: "Can we include Pykara Lake boating on Day 2 of the 3-day Ooty Tour Package instead of Doddabetta Peak?",
    priority: "Low",
    status: "Resolved",
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    bookingId: "NTT-2024-4815",
    assignedTo: "Sumathi Devi",
  },
  {
    id: "TCK-8025",
    customerName: "Rajesh Kannan",
    customerPhone: "+91 98844 22331",
    category: "Driver Feedback",
    description: "Driver Anand R. on trip NTT-2024-4712 was extremely helpful with luggage and elderly parents. Highly recommended!",
    priority: "Low",
    status: "Closed",
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    bookingId: "NTT-2024-4712",
    assignedTo: "Sumathi Devi",
  },
];

export default function SupportTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const unsub = subscribeToCollection<any>(SUPPORT_COLLECTION, setTickets);
    return () => unsub();
  }, []);

  const displayTickets = tickets.length > 0 ? tickets : defaultMockTickets;

  const handleSeedTickets = async () => {
    setSeeding(true);
    try {
      for (const t of defaultMockTickets) {
        await setFirestoreDocument(SUPPORT_COLLECTION, t.id, t);
      }
      alert("Sample support tickets synchronized to Firestore!");
    } catch (e: any) {
      console.error(e);
      alert("Error saving tickets: " + (e?.message || e));
    } finally {
      setSeeding(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setTickets((prev) =>
      (prev.length > 0 ? prev : defaultMockTickets).map((item) =>
        item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item,
      ),
    );
    if (selected?.id === id) {
      setSelected((prev: any) => (prev ? { ...prev, status } : null));
    }
    await updateFirestoreDocument(SUPPORT_COLLECTION, id, {
      status,
      updatedAt: new Date().toISOString(),
    });
  };

  const filtered = displayTickets.filter((t) => {
    const matchSearch =
      search === "" ||
      (t.id && t.id.toLowerCase().includes(search.toLowerCase())) ||
      (t.customerName &&
        t.customerName.toLowerCase().includes(search.toLowerCase())) ||
      (t.description &&
        t.description.toLowerCase().includes(search.toLowerCase())) ||
      (t.message && t.message.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "All" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openCount = displayTickets.filter(
    (t) => t.status === "Open" || !t.status,
  ).length;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#111]">Support Tickets</h1>
          <p className="text-[13px] text-[#999] mt-0.5">
            {openCount} open ticket{openCount !== 1 ? "s" : ""}
          </p>
        </div>

        {tickets.length === 0 && (
          <button
            onClick={handleSeedTickets}
            disabled={seeding}
            className="px-4 py-2 border border-amber-300 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>⚡</span>
            <span>{seeding ? "Syncing..." : "Sync Sample Tickets to Cloud"}</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: displayTickets.length, color: "#E21B23" },
          {
            label: "Open",
            value: displayTickets.filter((t) => t.status === "Open" || !t.status)
              .length,
            color: "#F59E0B",
          },
          {
            label: "In Progress",
            value: displayTickets.filter((t) => t.status === "In Progress").length,
            color: "#3B82F6",
          },
          {
            label: "Resolved",
            value: displayTickets.filter((t) => t.status === "Resolved").length,
            color: "#10B981",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-[#E5E5E5] p-4 shadow-sm"
          >
            <div className="text-[11px] font-semibold text-[#999] uppercase tracking-wide mb-1">
              {s.label}
            </div>
            <div className="text-[22px] font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tickets…"
          className="px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] w-60"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23]"
        >
          {["All", "Open", "In Progress", "Resolved", "Closed"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
            <tr>
              {[
                "Ticket ID",
                "Customer",
                "Category",
                "Description",
                "Status",
                "Created",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 font-semibold text-[#666] text-[11px] uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F5F5F5]">
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-[#999] text-[13px]"
                >
                  <div className="font-medium text-gray-700 mb-2">
                    {search || statusFilter !== "All"
                      ? "No tickets match your filters."
                      : "No support tickets on record."}
                  </div>
                  {tickets.length === 0 && (
                    <button
                      onClick={handleSeedTickets}
                      disabled={seeding}
                      className="px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm hover:opacity-90 inline-flex items-center gap-2 cursor-pointer"
                      style={{ backgroundColor: "#E21B23" }}
                    >
                      <span>⚡</span>
                      <span>Sync Sample Support Tickets</span>
                    </button>
                  )}
                </td>
              </tr>
            )}
            {filtered.map((t) => (
              <tr
                key={t.id}
                className="hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                onClick={() => setSelected(t)}
              >
                <td className="px-4 py-3 font-mono text-[11px] text-[#666]">
                  {t.id}
                </td>
                <td className="px-4 py-3 font-semibold text-[#111]">
                  {t.customerName || "Customer"}
                </td>
                <td className="px-4 py-3 text-[#666]">
                  {t.category || "General"}
                </td>
                <td className="px-4 py-3 text-[#666] max-w-[220px] truncate">
                  {t.description || t.message || "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor[t.status] || statusColor["Open"]}`}
                  >
                    {t.status || "Open"}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#999] text-[11px]">
                  {t.createdAt
                    ? typeof t.createdAt === "string"
                      ? t.createdAt.split("T")[0]
                      : new Date(
                          t.createdAt?.seconds * 1000,
                        ).toLocaleDateString("en-IN")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {t.status !== "Resolved" && t.status !== "Closed" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next =
                            t.status === "Open" || !t.status
                              ? "In Progress"
                              : "Resolved";
                          updateStatus(t.id, next);
                        }}
                        className="px-2 py-1 text-[11px] font-semibold text-[#E21B23] border border-[#E21B23] rounded hover:bg-[#E21B23] hover:text-white transition-colors"
                      >
                        {t.status === "Open" || !t.status ? "Start" : "Resolve"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-[16px] font-bold text-[#111]">
                  Ticket: {selected.id}
                </h2>
                <p className="text-[12px] text-[#999] mt-0.5">
                  {selected.customerName || "Customer"}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-[#999] text-xl leading-none hover:text-[#111]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              {selected.category && (
                <div>
                  <span className="font-semibold text-[#666] text-[11px] uppercase tracking-wide">
                    Category
                  </span>
                  <div className="mt-0.5">{selected.category}</div>
                </div>
              )}
              <div>
                <span className="font-semibold text-[#666] text-[11px] uppercase tracking-wide">
                  Issue
                </span>
                <div className="mt-0.5 text-[#333]">
                  {selected.description || selected.message || "—"}
                </div>
              </div>
              {selected.bookingId && (
                <div>
                  <span className="font-semibold text-[#666] text-[11px] uppercase tracking-wide">
                    Booking ID
                  </span>
                  <div className="mt-0.5 font-mono text-[12px]">
                    {selected.bookingId}
                  </div>
                </div>
              )}
              <div>
                <span className="font-semibold text-[#666] text-[11px] uppercase tracking-wide mb-2 block">
                  Update Status
                </span>
                <div className="flex gap-2 flex-wrap">
                  {["Open", "In Progress", "Resolved", "Closed"].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        updateStatus(selected.id, s);
                        setSelected({ ...selected, status: s });
                      }}
                      className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg border transition-colors ${
                        selected.status === s
                          ? "bg-[#E21B23] text-white border-[#E21B23]"
                          : "text-[#666] border-[#E5E5E5] hover:bg-[#F5F5F5]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
