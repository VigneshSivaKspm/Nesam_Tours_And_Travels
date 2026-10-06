import { useEffect, useMemo, useState } from "react";
import type { Booking, Customer, Driver, FareRule, MasterLocation, TravelService, Vehicle, VehicleCategory, Vendor } from "../types";
import {
  subscribeBookings, subscribeCustomers, subscribeDrivers, subscribeFareRules, subscribeLocations, subscribeServices, subscribeVehicleCategories, subscribeVehicles, subscribeVendors,
} from "../services/adminFirestoreService";
import { AdminBookingError, normalizePhone, updateBookingContact, emailError } from "../services/adminBookingService";
import ManualBookingModal from "../components/ManualBookingModal";
import { ErrorBanner, Modal, Toast, useToast } from "../components/Feedback";
import { Field, inputCls } from "../components/FormKit";
import { AlertBadge, PaymentBadge, StatusBadge } from "../components/booking/BookingBadges";
import { ApproveDialog, AssignDriverModal, CancelBookingModal, RejectDialog } from "../components/booking/BookingActions";
import { BOOKING_TABS, paymentOf, tabOf, unassignedSeverity, type BookingTab } from "../domain/bookingFlow";
import { useCan } from "../components/AccessContext";
import { useNow } from "../hooks/useNow";
import { useOperationsSettings } from "../hooks/useOperationsSettings";
import { bookingPickupDate, formatDate, formatTime12, isoDateIST, relativeFromNow } from "../utils/time";

type TabKey = BookingTab | "Cancelled";
const PAGE_SIZE = 20;
const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const fareNumber = (b: Booking) => (typeof b.fare === "number" ? b.fare : Number(String(b.fare ?? "").replace(/[^\d.]/g, "")) || 0);

interface Filters {
  search: string;
  date: string;
  category: string;
  driver: string;
  vendor: string;
  payment: string;
  assignment: "" | "assigned" | "unassigned";
  service: string;
  sort: "pickup" | "created";
}
const NO_FILTERS: Filters = { search: "", date: "", category: "", driver: "", vendor: "", payment: "", assignment: "", service: "", sort: "pickup" };

interface ContactForm { customer: string; phone: string; email: string; notes: string }

export default function Bookings({ onSelectBooking, initialTab }: { onSelectBooking: (id: string) => void; initialTab?: string }) {
  const [tab, setTab] = useState<TabKey>((BOOKING_TABS as readonly string[]).includes(initialTab ?? "") || initialTab === "Cancelled" ? (initialTab as TabKey) : "Pending");
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<TravelService[]>([]);
  const [locations, setLocations] = useState<MasterLocation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [fareRules, setFareRules] = useState<FareRule[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const { toast, show: showToast } = useToast(9000);
  const canFinance = useCan("finance");
  const now = useNow(30000);
  const ops = useOperationsSettings();

  const [approving, setApproving] = useState<Booking | null>(null);
  const [rejecting, setRejecting] = useState<Booking | null>(null);
  const [assigning, setAssigning] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);

  useEffect(() => {
    setLoadError(null);
    setBookings(null);
    const unsubs = [
      subscribeBookings(setBookings, setLoadError),
      subscribeDrivers(setDrivers, setLoadError),
      subscribeVendors(setVendors, setLoadError),
      subscribeVehicles(setVehicles, setLoadError),
      subscribeServices(setServices, setLoadError),
      subscribeLocations(setLocations, setLoadError),
      subscribeCustomers(setCustomers, setLoadError),
      subscribeFareRules(setFareRules, setLoadError),
      subscribeVehicleCategories(setCategories, setLoadError),
    ];
    return () => unsubs.forEach((u) => u());
  }, [retryKey]);

  useEffect(() => setPage(1), [tab, f]);

  const all = bookings ?? [];
  const pickupOf = (b: Booking) => bookingPickupDate(b);
  const severityOf = (b: Booking) => {
    const p = pickupOf(b);
    return unassignedSeverity(b, p ? p.getTime() : null, now.getTime(), { warningHours: ops.warningHours, criticalHours: ops.criticalHours });
  };

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { Pending: 0, Approved: 0, Confirmed: 0, Ongoing: 0, Completed: 0, Cancelled: 0 };
    for (const b of all) {
      const t = tabOf(b.status);
      if (t) c[t]++;
      else if (b.status === "Cancelled" || b.status === "Rejected") c.Cancelled++;
    }
    return c;
  }, [all]);

  const categoriesInUse = useMemo(() => Array.from(new Set(all.map((b) => b.vehicleCategory || b.vehicle).filter(Boolean))).sort(), [all]);
  const serviceNames = useMemo(() => Array.from(new Set(all.map((b) => b.service).filter(Boolean))).sort(), [all]);
  const driverOptions = useMemo(() => Array.from(new Map(all.filter((b) => b.assignedDriverId).map((b) => [b.assignedDriverId!, b.assignedDriverName || b.driver || b.assignedDriverId!])).entries()), [all]);
  const vendorOptions = useMemo(() => Array.from(new Map(all.filter((b) => b.assignedVendorId).map((b) => [b.assignedVendorId!, b.assignedVendorName || b.assignedVendorId!])).entries()), [all]);

  const unassignedCritical = useMemo(() => all.filter((b) => severityOf(b) === "critical").length, [all, now, ops.warningHours, ops.criticalHours]); // eslint-disable-line react-hooks/exhaustive-deps
  const unassignedWarn = useMemo(() => all.filter((b) => severityOf(b) === "warning").length, [all, now, ops.warningHours, ops.criticalHours]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = f.search.trim().toLowerCase();
    const rows = all.filter((b) => {
      if (tab === "Cancelled" ? !(b.status === "Cancelled" || b.status === "Rejected") : tabOf(b.status) !== tab) return false;
      if (q) {
        const hay = [b.id, b.bookingId, b.customer, b.phone, b.customerPhone, b.driver, b.assignedDriverName, b.assignedVehicleNumber, b.vehicle, b.pickup, b.drop].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (f.date) {
        const p = pickupOf(b);
        if (!p || isoDateIST(p) !== f.date) return false;
      }
      if (f.category && (b.vehicleCategory || b.vehicle) !== f.category) return false;
      if (f.driver && b.assignedDriverId !== f.driver) return false;
      if (f.vendor && b.assignedVendorId !== f.vendor) return false;
      if (f.service && b.service !== f.service) return false;
      if (f.payment && paymentOf(b).status !== f.payment) return false;
      if (f.assignment === "assigned" && !b.assignedDriverId) return false;
      if (f.assignment === "unassigned" && b.assignedDriverId) return false;
      return true;
    });
    const t = (b: Booking) => (f.sort === "created" ? bookingTime(b.createdAt) : pickupOf(b)?.getTime() ?? 0);
    // Open work is sorted by what is coming up first; finished work by what happened last.
    const upcoming = tab !== "Completed" && tab !== "Cancelled" && f.sort === "pickup";
    return rows.sort((a, b) => (upcoming ? t(a) - t(b) : t(b) - t(a)));
  }, [all, tab, f]); // eslint-disable-line react-hooks/exhaustive-deps

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const filtersActive = JSON.stringify({ ...f, sort: "" }) !== JSON.stringify({ ...NO_FILTERS, sort: "" });

  const exportCsv = () => {
    const headers = ["Booking ID", "Status", "Customer", "Mobile", "Service", "Pickup", "Drop", "Pickup date", "Pickup time", "Vehicle", "Driver", "Vehicle no.", "Fare", "Paid", "Balance", "Payment status"];
    const rows = filtered.map((b) => {
      const p = pickupOf(b);
      const pay = paymentOf(b);
      return [b.bookingId || b.id, b.status, b.customer, b.phone || "", b.service, b.pickup, b.drop, p ? formatDate(p) : b.date, p ? formatTime12(p) : b.time, b.vehicleCategory || b.vehicle, b.assignedDriverName || b.driver || "", b.assignedVehicleNumber || "", fareNumber(b), pay.totalPaid, pay.balanceDue, pay.status];
    });
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings_${tab.toLowerCase()}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const done = (text: string) => {
    setApproving(null); setRejecting(null); setAssigning(null); setCancelling(null);
    showToast(text);
  };

  const tabs: { key: TabKey; label: string }[] = [...BOOKING_TABS.map((k) => ({ key: k as TabKey, label: k })), { key: "Cancelled", label: "Cancelled / Rejected" }];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Toast toast={toast} />
      {loadError && <ErrorBanner message={loadError} onRetry={() => setRetryKey((k) => k + 1)} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#111]">Bookings</h2>
        <div className="flex gap-2">
          <button onClick={exportCsv} disabled={filtered.length === 0} className="px-4 py-2.5 text-sm font-semibold text-[#333] border border-[#D4D4D4] rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50">Export</button>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg bg-[#E21B23] hover:bg-[#c4151c]">+ Create New Booking</button>
        </div>
      </div>

      {(unassignedCritical > 0 || unassignedWarn > 0) && (
        <button
          type="button"
          onClick={() => { setTab("Approved"); setF({ ...NO_FILTERS, assignment: "unassigned" }); }}
          className={`w-full text-left p-3 rounded-xl border text-sm font-semibold ${unassignedCritical ? "bg-red-50 border-red-300 text-red-800" : "bg-amber-50 border-amber-300 text-amber-900"}`}
        >
          ⚠ {unassignedCritical > 0 ? `${unassignedCritical} booking${unassignedCritical > 1 ? "s" : ""} need a driver urgently (pickup within ${ops.criticalHours} h)` : ""}
          {unassignedCritical > 0 && unassignedWarn > 0 ? " · " : ""}
          {unassignedWarn > 0 ? `${unassignedWarn} with no driver within ${ops.warningHours} h of pickup` : ""} — tap to view
        </button>
      )}

      {/* Status tabs */}
      <div role="tablist" aria-label="Booking status" className="flex gap-1 overflow-x-auto border-b border-[#D4D4D4]">
        {tabs.map((t) => (
          <button
            key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? "border-[#E21B23] text-[#E21B23]" : "border-transparent text-[#555] hover:text-[#111]"}`}
          >
            {t.label} <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${tab === t.key ? "bg-[#E21B23] text-white" : "bg-gray-200 text-[#333]"}`}>{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {/* Search & filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 bg-white rounded-xl border border-[#E5E5E5] p-3">
        <input value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} placeholder="Search ID, customer, mobile, driver, vehicle no." aria-label="Search bookings" className={`${inputCls} sm:col-span-2`} />
        <div className="flex items-center gap-2"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} aria-label="Pickup date" className={inputCls} /></div>
        <select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value as Filters["sort"] })} aria-label="Sort" className={inputCls}>
          <option value="pickup">Sort: pickup time</option>
          <option value="created">Sort: newest booked</option>
        </select>
        <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Vehicle category" className={inputCls}><option value="">All vehicle categories</option>{categoriesInUse.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={f.assignment} onChange={(e) => setF({ ...f, assignment: e.target.value as Filters["assignment"] })} aria-label="Assignment" className={inputCls}><option value="">Assigned & unassigned</option><option value="assigned">Driver assigned</option><option value="unassigned">No driver yet</option></select>
        <select value={f.driver} onChange={(e) => setF({ ...f, driver: e.target.value })} aria-label="Driver" className={inputCls}><option value="">All drivers</option>{driverOptions.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <select value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} aria-label="Vendor" className={inputCls}><option value="">All vendors</option>{vendorOptions.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <select value={f.payment} onChange={(e) => setF({ ...f, payment: e.target.value })} aria-label="Payment status" className={inputCls}><option value="">All payment statuses</option>{["Unpaid", "Partially Paid", "Paid", "Refund Pending", "Refunded"].map((s) => <option key={s}>{s}</option>)}</select>
        <select value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })} aria-label="Service" className={inputCls}><option value="">All services</option>{serviceNames.map((s) => <option key={s}>{s}</option>)}</select>
        {filtersActive && <button type="button" onClick={() => setF({ ...NO_FILTERS, sort: f.sort })} className="text-sm font-semibold text-[#E21B23] text-left hover:underline">Clear filters</button>}
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E5E5] text-sm font-semibold text-[#111]">{bookings === null && !loadError ? "Loading bookings…" : `${filtered.length} ${tab === "Cancelled" ? "cancelled / rejected" : tab.toLowerCase()} booking${filtered.length === 1 ? "" : "s"}`}</div>

        {bookings === null && !loadError && <div className="py-16 text-center text-sm text-[#555]" role="status">Loading bookings…</div>}
        {bookings !== null && filtered.length === 0 && (
          <div className="py-14 text-center">
            <p className="text-sm font-semibold text-[#333]">{filtersActive ? "No bookings match these filters." : `No ${tab === "Cancelled" ? "cancelled or rejected" : tab.toLowerCase()} bookings.`}</p>
            {filtersActive && <button type="button" onClick={() => setF({ ...NO_FILTERS, sort: f.sort })} className="mt-2 text-sm font-semibold text-[#E21B23] hover:underline">Clear filters</button>}
          </div>
        )}

        {/* Desktop table */}
        {paginated.length > 0 && (
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead><tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">{["Booking", "Customer", "Route", "Pickup", "Vehicle / Driver", "Fare", "Payment", "Status", "Actions"].map((h) => <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-[#555] uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {paginated.map((b) => {
                  const p = pickupOf(b);
                  const sev = severityOf(b);
                  const pay = paymentOf(b);
                  return (
                    <tr key={b.id} className={`table-row border-b border-[#F0F0F0] align-top ${sev === "critical" ? "bg-red-50" : sev === "warning" ? "bg-amber-50" : ""}`}>
                      <td className="px-3 py-3"><button onClick={() => onSelectBooking(b.id)} className="text-sm font-mono font-semibold text-[#E21B23] hover:underline">{b.bookingId || b.id}</button><div className="text-xs text-[#555]">{b.service}</div></td>
                      <td className="px-3 py-3 text-sm"><div className="font-semibold text-[#111]">{b.customer}</div><div className="text-xs text-[#555]">{b.phone}</div></td>
                      <td className="px-3 py-3 text-sm max-w-[200px]"><div className="truncate" title={b.pickup}>{b.pickup}</div><div className="truncate text-[#555]" title={b.drop}>→ {b.drop}</div></td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap"><div className="font-semibold text-[#111]">{p ? formatTime12(p) : b.time}</div><div className="text-xs text-[#555]">{p ? formatDate(p) : b.date}{p && tab !== "Completed" && tab !== "Cancelled" ? ` · ${relativeFromNow(p, now)}` : ""}</div></td>
                      <td className="px-3 py-3 text-sm"><div>{b.vehicleCategory || b.vehicle}</div><div className="text-xs text-[#555]">{b.assignedDriverName || b.driver || (b.assignedVendorName ? `Vendor: ${b.assignedVendorName}` : "No driver")}{b.assignedVehicleNumber ? ` · ${b.assignedVehicleNumber}` : ""}</div><div className="mt-1"><AlertBadge severity={sev} label={p ? relativeFromNow(p, now).replace(/^in /, "") : undefined} /></div></td>
                      <td className="px-3 py-3 text-sm font-semibold whitespace-nowrap">{rupees(fareNumber(b))}</td>
                      <td className="px-3 py-3"><PaymentBadge status={pay.status} />{pay.balanceDue > 0 && pay.totalPaid > 0 && <div className="text-xs text-[#555] mt-1">Due {rupees(pay.balanceDue)}</div>}</td>
                      <td className="px-3 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-3 py-3"><RowActions b={b} onView={() => onSelectBooking(b.id)} onApprove={() => setApproving(b)} onReject={() => setRejecting(b)} onAssign={() => setAssigning(b)} onCancel={() => setCancelling(b)} onEdit={() => setEditing(b)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile / tablet cards */}
        {paginated.length > 0 && (
          <ul className="lg:hidden divide-y divide-[#EEE]">
            {paginated.map((b) => {
              const p = pickupOf(b);
              const sev = severityOf(b);
              const pay = paymentOf(b);
              return (
                <li key={b.id} className={`p-4 space-y-2 ${sev === "critical" ? "bg-red-50" : sev === "warning" ? "bg-amber-50" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => onSelectBooking(b.id)} className="text-sm font-mono font-semibold text-[#E21B23]">{b.bookingId || b.id}</button>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="text-sm"><span className="font-semibold">{b.customer}</span> · {b.phone}</div>
                  <div className="text-sm text-[#333]">{b.pickup} → {b.drop}</div>
                  <div className="text-sm"><strong>{p ? formatTime12(p) : b.time}</strong> · {p ? formatDate(p) : b.date} · {b.vehicleCategory || b.vehicle}</div>
                  <div className="text-sm text-[#555]">{b.assignedDriverName || b.driver || "No driver assigned"}{b.assignedVehicleNumber ? ` · ${b.assignedVehicleNumber}` : ""}</div>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{rupees(fareNumber(b))}</span><PaymentBadge status={pay.status} /><AlertBadge severity={sev} label={p ? relativeFromNow(p, now).replace(/^in /, "") : undefined} /></div>
                  <RowActions b={b} onView={() => onSelectBooking(b.id)} onApprove={() => setApproving(b)} onReject={() => setRejecting(b)} onAssign={() => setAssigning(b)} onCancel={() => setCancelling(b)} onEdit={() => setEditing(b)} />
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-[#E5E5E5] flex items-center justify-between gap-2">
            <span className="text-sm text-[#555]">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-1 items-center">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg disabled:opacity-40">Previous</button>
              <span className="text-sm px-2">Page {page} of {pages}</span>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {approving && <ApproveDialog booking={approving} onClose={() => setApproving(null)} onDone={done} />}
      {rejecting && <RejectDialog booking={rejecting} onClose={() => setRejecting(null)} onDone={done} />}
      {assigning && <AssignDriverModal booking={assigning} drivers={drivers} vehicles={vehicles} vendors={vendors} onClose={() => setAssigning(null)} onDone={done} />}
      {cancelling && <CancelBookingModal booking={cancelling} canCharge={canFinance} onClose={() => setCancelling(null)} onDone={done} />}
      {editing && <ContactModal booking={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); showToast("Contact details updated."); }} />}
      {showAdd && (
        <ManualBookingModal
          customers={customers} services={services} locations={locations} categories={categories} fareRules={fareRules}
          onClose={() => setShowAdd(false)}
          onCreated={(b) => {
            setShowAdd(false);
            setTab("Pending");
            showToast(`Booking ${b.bookingId} created for ${rupees(b.fare)} and is waiting for approval.`);
          }}
        />
      )}
    </div>
  );
}

function bookingTime(v: unknown): number {
  const t = v as { toMillis?: () => number; seconds?: number } | undefined;
  return typeof t?.toMillis === "function" ? t.toMillis() : typeof t?.seconds === "number" ? t.seconds * 1000 : 0;
}

function RowActions({ b, onView, onApprove, onReject, onAssign, onCancel, onEdit }: {
  b: Booking; onView: () => void; onApprove: () => void; onReject: () => void; onAssign: () => void; onCancel: () => void; onEdit: () => void;
}) {
  const btn = "text-xs px-2.5 py-1.5 rounded-md border font-semibold";
  const open = ["Pending", "Approved", "Confirmed", "Assigned"].includes(b.status);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button onClick={onView} className={`${btn} border-[#D4D4D4] text-[#111] hover:bg-gray-50`}>View</button>
      {b.status === "Pending" && <button onClick={onApprove} className={`${btn} border-green-600 bg-green-600 text-white hover:bg-green-700`}>Approve</button>}
      {b.status === "Pending" && <button onClick={onReject} className={`${btn} border-red-300 text-red-700 hover:bg-red-50`}>Reject</button>}
      {["Approved", "Confirmed", "Assigned"].includes(b.status) && <button onClick={onAssign} className={`${btn} border-[#E21B23] text-[#E21B23] hover:bg-[#FEF2F2]`}>{b.assignedDriverId ? "Change driver" : "Assign driver"}</button>}
      {open && b.status !== "Pending" && <button onClick={onCancel} className={`${btn} border-red-300 text-red-700 hover:bg-red-50`}>Cancel</button>}
      {b.status !== "Completed" && <button onClick={onEdit} className={`${btn} border-[#D4D4D4] text-[#333] hover:bg-gray-50`}>Edit contact</button>}
    </div>
  );
}

function ContactModal({ booking, onClose, onSaved }: { booking: Booking; onClose: () => void; onSaved: () => void }) {
  const [c, setC] = useState<ContactForm>({ customer: booking.customer || "", phone: booking.phone || "", email: booking.customerEmail || "", notes: booking.notes || "" });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const e: Partial<Record<keyof ContactForm, string>> = {};
    if (c.customer.trim().length < 2) e.customer = "Enter the customer name.";
    const phone = normalizePhone(c.phone);
    if (!phone) e.phone = "Enter a valid 10-digit Indian mobile number.";
    const em = emailError(c.email);
    if (em) e.email = em;
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setError(null);
    try {
      await updateBookingContact(booking.id, { customer: c.customer.trim(), phone, notes: c.notes.trim(), email: c.email.trim().toLowerCase() });
      onSaved();
    } catch (err) {
      setError(err instanceof AdminBookingError ? err.message : "The changes were not saved. Please try again.");
      setSaving(false);
    }
  };
  return (
    <Modal title="Edit contact details" subtitle={`Booking ${booking.bookingId || booking.id} · fare, payment and status are changed from Booking Details`} onClose={onClose} busy={saving}
      footer={<><button onClick={onClose} disabled={saving} className="px-4 py-2.5 border border-[#D4D4D4] rounded-lg text-sm font-semibold disabled:opacity-50">Cancel</button><button onClick={save} disabled={saving} className="px-4 py-2.5 bg-[#E21B23] text-white rounded-lg text-sm font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {error && <div role="alert" className="sm:col-span-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
        <Field label="Customer name" required error={errors.customer}><input value={c.customer} onChange={(e) => setC({ ...c, customer: e.target.value })} maxLength={80} className={inputCls} /></Field>
        <Field label="Mobile number" required error={errors.phone}><input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} inputMode="tel" className={inputCls} /></Field>
        <Field label="Email address" hint="Optional" error={errors.email} className="sm:col-span-2"><input type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} maxLength={120} className={inputCls} /></Field>
        <Field label="Notes" className="sm:col-span-2"><input value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })} maxLength={300} className={inputCls} /></Field>
      </div>
    </Modal>
  );
}
