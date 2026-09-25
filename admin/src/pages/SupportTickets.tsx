import { useState, useEffect } from "react";
import {
  subscribeToCollection,
  updateFirestoreDocument,
} from "../services/adminFirestoreService";

const SUPPORT_COLLECTION = "support_tickets";

const statusColor: Record<string, string> = {
  Open: "bg-yellow-50 text-yellow-700 border-yellow-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  Resolved: "bg-green-50 text-green-700 border-green-200",
  Closed: "bg-gray-50 text-gray-600 border-gray-200",
};

export default function SupportTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    const unsub = subscribeToCollection<any>(SUPPORT_COLLECTION, setTickets);
    return () => unsub();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await updateFirestoreDocument(SUPPORT_COLLECTION, id, {
      status,
      updatedAt: new Date().toISOString(),
    });
  };

  const filtered = tickets.filter((t) => {
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

  const openCount = tickets.filter(
    (t) => t.status === "Open" || !t.status,
  ).length;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[#111]">Support Tickets</h1>
          <p className="text-[13px] text-[#999] mt-0.5">
            {openCount} open ticket{openCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: tickets.length, color: "#E21B23" },
          {
            label: "Open",
            value: tickets.filter((t) => t.status === "Open" || !t.status)
              .length,
            color: "#F59E0B",
          },
          {
            label: "In Progress",
            value: tickets.filter((t) => t.status === "In Progress").length,
            color: "#3B82F6",
          },
          {
            label: "Resolved",
            value: tickets.filter((t) => t.status === "Resolved").length,
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
                  className="px-4 py-10 text-center text-[#999] text-[13px]"
                >
                  {search || statusFilter !== "All"
                    ? "No tickets match your filters."
                    : "No support tickets yet."}
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
