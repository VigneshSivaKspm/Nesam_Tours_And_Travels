import { useEffect, useMemo, useState } from "react";
import type { Booking, Invoice } from "../types";
import { subscribeBookings, subscribeInvoices, subscribeSettings } from "../services/adminFirestoreService";
import {
  InvoiceActionError,
  amountInWords,
  buildInvoiceLines,
  companyFromSettings,
  companyProblems,
  createInvoice,
  invoiceBlocker,
  livePaymentStatus,
  voidInvoice,
  type BillingDetails,
} from "../services/invoiceService";
import { auth } from "../services/firebase";
import { parseAmount } from "../utils/analytics";
import { ConfirmDialog, ErrorBanner, Modal, Toast, useToast } from "../components/Feedback";

function formatCurrency(n: number): string {
  return "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const actionError = (e: unknown) =>
  e instanceof InvoiceActionError ? e.message : "Something went wrong. Please try again.";

const invoiceTime = (inv: Invoice) => new Date(inv.invoiceDate || 0).getTime() || 0;

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "amount">("newest");

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const { toast, show } = useToast();

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const fail = (m: string) => {
      setLoadError(m);
      setLoading(false);
    };
    const unsubs = [
      subscribeInvoices((data) => {
        setInvoices(data);
        setLoading(false);
      }, fail),
      subscribeBookings(setBookings, fail),
      subscribeSettings((data) => setSettings(data || {})),
    ];
    return () => unsubs.forEach((u) => u());
  }, [retryKey]);

  const company = useMemo(() => companyFromSettings(settings), [settings]);
  const missingCompany = companyProblems(company);
  // Payment status comes from the booking (it changes after the invoice is issued).
  const paymentByInvoice = useMemo(() => {
    const byId = new Map(bookings.map((b) => [b.id, b]));
    const byCode = new Map(bookings.map((b) => [b.bookingId || b.id, b]));
    return new Map(
      invoices.map((inv) => [
        inv.id,
        livePaymentStatus(inv, byId.get(inv.bookingDocumentId || "") ?? byId.get(inv.bookingId) ?? byCode.get(inv.bookingId)),
      ]),
    );
  }, [invoices, bookings]);
  const paymentOf = (inv: Invoice) => paymentByInvoice.get(inv.id) ?? inv.paymentStatus;

  const stats = useMemo(() => {
    const isPaid = (i: Invoice) => (paymentByInvoice.get(i.id) ?? i.paymentStatus) === "Paid";
    const active = invoices.filter((i) => i.invoiceStatus !== "Cancelled");
    const paid = active.filter(isPaid);
    return {
      totalCount: active.length,
      paidCount: paid.length,
      pendingCount: active.length - paid.length,
      totalAmount: active.reduce((s, i) => s + (i.grandTotal || 0), 0),
      outstanding: active.filter((i) => !isPaid(i)).reduce((s, i) => s + (i.grandTotal || 0), 0),
      voided: invoices.length - active.length,
    };
  }, [invoices, paymentByInvoice]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    return invoices
      .filter((inv) => {
        const matchSearch =
          !q ||
          [inv.invoiceNumber, inv.bookingId, inv.customerSnapshot?.name, inv.customerSnapshot?.phone, inv.customerSnapshot?.gstin]
            .some((v) => (v || "").toLowerCase().includes(q));
        if (!matchSearch) return false;
        if (paymentFilter !== "All" && (paymentByInvoice.get(inv.id) ?? inv.paymentStatus) !== paymentFilter) return false;
        if (statusFilter !== "All" && inv.invoiceStatus !== statusFilter) return false;
        if (dateFilter !== "All") {
          const d = new Date(inv.invoiceDate || 0);
          if (dateFilter === "Today" && d.toDateString() !== now.toDateString()) return false;
          if (dateFilter === "Last 7 Days" && now.getTime() - d.getTime() > 7 * 86400000) return false;
          if (dateFilter === "This Month" && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "oldest") return invoiceTime(a) - invoiceTime(b) || a.invoiceNumber.localeCompare(b.invoiceNumber);
        if (sortBy === "amount") return (b.grandTotal || 0) - (a.grandTotal || 0);
        return invoiceTime(b) - invoiceTime(a) || b.invoiceNumber.localeCompare(a.invoiceNumber);
      });
  }, [invoices, paymentByInvoice, search, paymentFilter, statusFilter, dateFilter, sortBy]);

  const confirmVoid = async () => {
    if (!voidTarget || voiding) return;
    setVoiding(true);
    setVoidError(null);
    try {
      await voidInvoice(voidTarget, voidReason, auth.currentUser?.uid || "");
      show(`Invoice ${voidTarget.invoiceNumber} voided. The trip can be invoiced again.`);
      setVoidTarget(null);
      if (selectedInvoice?.id === voidTarget.id) setSelectedInvoice(null);
    } catch (e) {
      setVoidError(actionError(e));
    } finally {
      setVoiding(false);
    }
  };

  const openCreate = () => setShowCreateModal(true);

  return (
    <div className="p-6 space-y-6">
      {/* Print stylesheet isolates the invoice document */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-invoice, #printable-invoice * { visibility: visible; }
          #printable-invoice { position: absolute; left: 0; top: 0; width: 100%; max-height: none !important; overflow: visible !important; background: white; color: black; padding: 20px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <Toast toast={toast} />
      {loadError && <ErrorBanner message={loadError} onRetry={() => setRetryKey((k) => k + 1)} />}
      {missingCompany.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold">
          Invoices cannot be issued until Settings → Company has {missingCompany.join(", ")}.
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[#111111]">Invoices</h1>
          <p className="text-[13px] text-[#666666]">GST tax invoices for completed trips. Print or save as PDF from the invoice preview.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-white rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          style={{ background: "#E21B23" }}
        >
          + Create Invoice
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Issued Invoices", value: stats.totalCount.toString(), color: "#E21B23", sub: stats.voided ? `${stats.voided} voided` : "Active tax records" },
          { label: "Paid Invoices", value: stats.paidCount.toString(), color: "#10B981", sub: "Trip payment recorded" },
          { label: "Awaiting Payment", value: stats.pendingCount.toString(), color: "#F59E0B", sub: `${formatCurrency(stats.outstanding)} outstanding` },
          { label: "Total Invoiced Amount", value: formatCurrency(stats.totalAmount), color: "#3B82F6", sub: "Active invoices, incl. GST" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
            <div className="text-[22px] font-bold" style={{ color: s.color }}>{loading ? "—" : s.value}</div>
            <div className="text-[12px] font-semibold text-[#111111] mt-0.5">{s.label}</div>
            <div className="text-[10px] text-[#999999]">{s.sub}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-12 text-center text-[13px] text-[#999999]">Loading invoices…</div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-16 flex flex-col items-center text-center">
          <h2 className="text-[18px] font-bold text-[#111111] mb-2">No invoices found.</h2>
          <p className="text-[13px] text-[#999999] max-w-sm mb-6">GST tax invoices are issued for completed trips. Create the first invoice from a completed booking.</p>
          <button onClick={openCreate} className="px-6 py-2.5 text-[13px] font-semibold text-white rounded-lg hover:opacity-90 cursor-pointer shadow-sm" style={{ background: "#E21B23" }}>
            + Create Invoice
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3 bg-[#FAFAFA]">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice no., booking, customer, GSTIN…"
              className="flex-1 min-w-[200px] max-w-md px-3 py-2 text-[12px] bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Payment status" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white">
                <option value="All">All payment statuses</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
              <select aria-label="Invoice status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white">
                <option value="All">Issued & voided</option>
                <option value="Issued">Issued</option>
                <option value="Cancelled">Voided</option>
              </select>
              <select aria-label="Date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white">
                <option value="All">All dates</option>
                <option value="Today">Today</option>
                <option value="Last 7 Days">Last 7 days</option>
                <option value="This Month">This month</option>
              </select>
              <select aria-label="Sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="amount">Highest amount</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                  {["Invoice No.", "Booking", "Customer", "Invoice Date", "Total", "Payment", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#999999] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[12px] text-[#999999]">No invoices match your filters.</td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const payment = paymentOf(inv);
                    return (
                      <tr key={inv.id} className={`border-b border-[#F5F5F5] hover:bg-[#FAFAFA] ${inv.invoiceStatus === "Cancelled" ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3.5 text-[12px] font-bold font-mono text-[#111111] whitespace-nowrap">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3.5 text-[11px] font-mono font-semibold text-[#E21B23]">{inv.bookingId}</td>
                        <td className="px-4 py-3.5">
                          <div className="text-[12px] font-semibold text-[#111111]">{inv.customerSnapshot?.name || "—"}</div>
                          <div className="text-[10px] text-[#999999]">{inv.customerSnapshot?.gstin ? `GSTIN ${inv.customerSnapshot.gstin}` : inv.customerSnapshot?.phone || "—"}</div>
                        </td>
                        <td className="px-4 py-3.5 text-[12px] text-[#666666] whitespace-nowrap">{inv.invoiceDate || "—"}</td>
                        <td className="px-4 py-3.5 text-[12px] font-bold text-[#111111]">{formatCurrency(inv.grandTotal)}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${payment === "Paid" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                            {payment}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${inv.invoiceStatus === "Issued" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                            {inv.invoiceStatus === "Cancelled" ? "Voided" : inv.invoiceStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setSelectedInvoice(inv)} className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-[#E5E5E5] text-gray-700 hover:bg-gray-50 cursor-pointer">
                              View / Print
                            </button>
                            {inv.invoiceStatus !== "Cancelled" && (
                              <button
                                onClick={() => {
                                  setVoidReason("");
                                  setVoidError(null);
                                  setVoidTarget(inv);
                                }}
                                className="px-2 py-1 text-[11px] font-medium rounded-lg border border-red-200 bg-red-50 text-[#E21B23] hover:bg-red-100 cursor-pointer"
                              >
                                Void
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateInvoiceModal
          bookings={bookings}
          invoices={invoices}
          companyReady={missingCompany.length === 0}
          company={company}
          onClose={() => setShowCreateModal(false)}
          onCreated={(number) => {
            setShowCreateModal(false);
            show(`Tax invoice ${number} issued.`);
          }}
        />
      )}

      {voidTarget && (
        <ConfirmDialog
          title={`Void invoice ${voidTarget.invoiceNumber}?`}
          message={
            <div className="space-y-2">
              <p>Voided invoices are kept for tax records and cannot be reissued under the same number. The trip can then be invoiced again.</p>
              <label className="block">
                <span className="text-[11px] font-bold text-gray-800">Reason *</span>
                <textarea rows={2} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} maxLength={300} placeholder="e.g. Customer requested billing under company GSTIN" className="mt-1 w-full p-2 border border-[#E5E5E5] rounded-lg text-[12px]" />
              </label>
            </div>
          }
          confirmLabel="Void Invoice"
          danger
          busy={voiding}
          error={voidError}
          onConfirm={confirmVoid}
          onCancel={() => setVoidTarget(null)}
        />
      )}

      {selectedInvoice && (
        <InvoicePreview invoice={selectedInvoice} payment={paymentOf(selectedInvoice)} onClose={() => setSelectedInvoice(null)} />
      )}
    </div>
  );
}

function CreateInvoiceModal({
  bookings,
  invoices,
  companyReady,
  company,
  onClose,
  onCreated,
}: {
  bookings: Booking[];
  invoices: Invoice[];
  companyReady: boolean;
  company: ReturnType<typeof companyFromSettings>;
  onClose: () => void;
  onCreated: (invoiceNumber: string) => void;
}) {
  const [bookingId, setBookingId] = useState("");
  const [billing, setBilling] = useState<BillingDetails>({ name: "", gstin: "", address: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible = useMemo(
    () =>
      bookings
        .filter((b) => !invoiceBlocker(b, invoices))
        .sort((a, b) => String(b.bookingId || b.id).localeCompare(String(a.bookingId || a.id))),
    [bookings, invoices],
  );
  const booking = eligible.find((b) => b.id === bookingId) || null;
  const lines = booking ? buildInvoiceLines(booking) : null;

  const create = async () => {
    if (busy || !booking) return;
    setBusy(true);
    setError(null);
    try {
      const { invoiceNumber } = await createInvoice({ booking, company, billing, actorId: auth.currentUser?.uid || "" });
      onCreated(invoiceNumber);
    } catch (e) {
      setError(actionError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Issue Tax Invoice"
      subtitle="Choose a completed trip. Amounts come from the booking's server-priced fare breakdown."
      onClose={onClose}
      busy={busy}
      size="lg"
      footer={
        <>
          <button onClick={onClose} disabled={busy} className="px-4 py-2 border border-[#E5E5E5] rounded-lg text-[12px] font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => void create()} disabled={busy || !booking || !companyReady} className="px-6 py-2 text-[12px] font-bold text-white rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50" style={{ background: "#E21B23" }}>
            {busy ? "Issuing…" : "Issue Invoice"}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold">{error}</div>}
        {!companyReady && <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl font-semibold">Complete Settings → Company (name, GSTIN, address) first.</div>}
        <label className="block">
          <span className="text-[11px] font-bold text-[#111]">Completed trip *</span>
          <select value={bookingId} onChange={(e) => setBookingId(e.target.value)} className="mt-1 w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] bg-white">
            <option value="">{eligible.length ? "Choose a completed trip without an invoice" : "No completed trips are waiting for an invoice"}</option>
            {eligible.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bookingId || b.id} — {b.customer || b.customerName || "Customer"} — ₹{parseAmount(b.fare).toLocaleString("en-IN")}
              </option>
            ))}
          </select>
        </label>

        {booking && lines && (
          <div className="p-4 bg-gray-50 rounded-xl border border-[#E5E5E5] space-y-1.5">
            <div className="font-semibold text-gray-900">{booking.pickup} → {booking.drop}</div>
            <div className="text-gray-600">{booking.service || "—"} • {booking.vehicle || booking.vehicleCategory || "—"} • {booking.date} {booking.time}</div>
            <div className="grid grid-cols-2 gap-x-4 pt-2 border-t border-gray-200">
              <span>Taxable value</span><span className="text-right font-semibold">{formatCurrency(lines.taxableAmount)}</span>
              {lines.discount > 0 && (<><span>Discount (included)</span><span className="text-right">- {formatCurrency(lines.discount)}</span></>)}
              <span>GST ({(lines.gstRate * 100).toFixed(1).replace(/\.0$/, "")}%)</span><span className="text-right font-semibold">{formatCurrency(lines.totalTax)}</span>
              {lines.tolls > 0 && (<><span>Tolls (non-taxable)</span><span className="text-right">{formatCurrency(lines.tolls)}</span></>)}
              <span className="font-bold">Invoice total</span><span className="text-right font-bold text-[#E21B23]">{formatCurrency(lines.grandTotal)}</span>
            </div>
            <div className="text-gray-500">Payment: {booking.payment === "Paid" ? "recorded" : "not recorded yet (the invoice will show it as pending)"}</div>
          </div>
        )}

        <div className="pt-2 border-t border-gray-100">
          <div className="text-[11px] font-bold text-gray-900 mb-2">Billing details (optional — for business customers)</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={billing.name} onChange={(e) => setBilling({ ...billing, name: e.target.value })} placeholder={booking?.customer ? `Bill to (default: ${booking.customer})` : "Bill to name"} className="p-2.5 border border-[#E5E5E5] rounded-lg" />
            <input value={billing.gstin} onChange={(e) => setBilling({ ...billing, gstin: e.target.value.toUpperCase() })} placeholder="Customer GSTIN" maxLength={15} className="p-2.5 border border-[#E5E5E5] rounded-lg font-mono" />
            <input value={billing.email} onChange={(e) => setBilling({ ...billing, email: e.target.value })} placeholder="Billing email" className="p-2.5 border border-[#E5E5E5] rounded-lg" />
            <input value={billing.address} onChange={(e) => setBilling({ ...billing, address: e.target.value })} placeholder="Billing address" className="p-2.5 border border-[#E5E5E5] rounded-lg" />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function InvoicePreview({ invoice: inv, payment, onClose }: { invoice: Invoice; payment: string; onClose: () => void }) {
  const ratePct = ((inv.gstRate > 1 ? inv.gstRate / 100 : inv.gstRate || 0.05) * 100) / 2;
  const tolls = (inv.items || []).filter((i) => !i.sacCode).reduce((s, i) => s + (i.amount || 0), 0);
  const paid = payment === "Paid";
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-6" role="dialog" aria-modal="true" aria-label={`Invoice ${inv.invoiceNumber}`}>
        <div className="no-print px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#FAFAFA]">
          <span className="text-[14px] font-bold text-[#111111]">Tax Invoice {inv.invoiceNumber}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[12px] font-semibold hover:bg-gray-800 cursor-pointer">
              Print / Save as PDF
            </button>
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm">✕</button>
          </div>
        </div>

        <div id="printable-invoice" className="p-8 space-y-6 text-[#111111] bg-white max-h-[75vh] overflow-y-auto relative">
          {inv.invoiceStatus === "Cancelled" && (
            <div className="border-2 border-red-500 text-red-600 font-black text-center py-2 rounded-lg tracking-widest">
              VOID{(inv as Invoice & { voidReason?: string }).voidReason ? ` — ${(inv as Invoice & { voidReason?: string }).voidReason}` : ""}
            </div>
          )}
          <div className="flex justify-between gap-6 border-b pb-6">
            <div>
              <div className="text-[20px] font-black text-[#E21B23] tracking-wide uppercase">{inv.companySnapshot?.name}</div>
              <div className="text-[11px] text-gray-600 max-w-sm mt-1 whitespace-pre-line">{inv.companySnapshot?.address}</div>
              <div className="text-[11px] text-gray-600 mt-1">
                {[inv.companySnapshot?.phone && `Phone: ${inv.companySnapshot.phone}`, inv.companySnapshot?.email && `Email: ${inv.companySnapshot.email}`].filter(Boolean).join(" • ")}
              </div>
              <div className="text-[11px] font-bold text-gray-900 mt-1">GSTIN: {inv.companySnapshot?.gstin}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[18px] font-black text-gray-900 tracking-wider">TAX INVOICE</div>
              <div className="text-[13px] font-mono font-bold text-[#E21B23] mt-2">{inv.invoiceNumber}</div>
              <div className="text-[11px] text-gray-600 mt-0.5">Date: {inv.invoiceDate}</div>
              <div className="text-[11px] text-gray-600">Booking: {inv.bookingId}</div>
              <div className="mt-2">
                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${paid ? "bg-green-100 text-green-800 border-green-200" : "bg-amber-100 text-amber-800 border-amber-200"}`}>
                  {paid ? "PAID" : "PAYMENT PENDING"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block mb-1">Billed To</span>
              <div className="text-sm font-bold text-gray-900">{inv.customerSnapshot?.name}</div>
              {inv.customerSnapshot?.gstin && <div className="text-gray-700 font-semibold">GSTIN: {inv.customerSnapshot.gstin}</div>}
              {inv.customerSnapshot?.phone && <div className="text-gray-600">Phone: {inv.customerSnapshot.phone}</div>}
              {inv.customerSnapshot?.email && <div className="text-gray-600">Email: {inv.customerSnapshot.email}</div>}
              {inv.customerSnapshot?.address && <div className="text-gray-600">Address: {inv.customerSnapshot.address}</div>}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block mb-1">Trip Details</span>
              <div className="text-gray-900 font-semibold">{inv.tripSnapshot?.service || "Passenger transport"}{inv.tripSnapshot?.vehicle ? ` (${inv.tripSnapshot.vehicle})` : ""}</div>
              <div className="text-gray-600">Route: {inv.tripSnapshot?.pickup} → {inv.tripSnapshot?.drop}</div>
              <div className="text-gray-600">Travel: {inv.tripSnapshot?.travelDate} {inv.tripSnapshot?.travelTime}</div>
              {inv.tripSnapshot?.vehicleNumber && <div className="text-gray-600">Vehicle: {inv.tripSnapshot.vehicleNumber}</div>}
              {inv.tripSnapshot?.driverName && <div className="text-gray-600">Driver: {inv.tripSnapshot.driverName}</div>}
              {Number(inv.tripSnapshot?.distanceKm) > 0 && <div className="text-gray-600">Distance: {inv.tripSnapshot?.distanceKm} km</div>}
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 border-b text-gray-700 font-bold uppercase text-[10px]">
                  <th className="px-4 py-2.5 text-left">#</th>
                  <th className="px-4 py-2.5 text-left">Description</th>
                  <th className="px-4 py-2.5 text-center">SAC</th>
                  <th className="px-4 py-2.5 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(inv.items || []).map((item, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="px-4 py-2.5 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{item.description}</td>
                    <td className="px-4 py-2.5 text-center font-mono text-gray-600">{item.sacCode || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-6 text-xs pt-2">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block mb-1">Amount in Words</span>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 font-semibold text-gray-900 italic">{amountInWords(inv.grandTotal)}</div>
              {inv.terms && <p className="mt-4 text-[10px] text-gray-500">{inv.terms}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-gray-600"><span>Subtotal:</span><span className="font-semibold text-gray-900">{formatCurrency(inv.subtotal)}</span></div>
              {inv.discount > 0 && <div className="flex justify-between text-gray-600"><span>Discount:</span><span className="font-semibold text-emerald-600">- {formatCurrency(inv.discount)}</span></div>}
              <div className="flex justify-between text-gray-600"><span>Taxable value:</span><span className="font-semibold text-gray-900">{formatCurrency(inv.taxableAmount)}</span></div>
              <div className="flex justify-between text-gray-600"><span>CGST ({ratePct}%):</span><span className="font-semibold text-gray-900">{formatCurrency(inv.cgst)}</span></div>
              <div className="flex justify-between text-gray-600"><span>SGST ({ratePct}%):</span><span className="font-semibold text-gray-900">{formatCurrency(inv.sgst)}</span></div>
              {tolls > 0 && <div className="flex justify-between text-gray-600"><span>Tolls (non-taxable):</span><span className="font-semibold text-gray-900">{formatCurrency(tolls)}</span></div>}
              <div className="flex justify-between text-gray-900 font-bold border-t pt-2 text-sm"><span>Grand Total:</span><span className="text-[#E21B23]">{formatCurrency(inv.grandTotal)}</span></div>
              <div className="flex justify-between text-gray-600 pt-1"><span>Paid:</span><span className="font-semibold">{formatCurrency(paid ? inv.grandTotal : 0)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Balance due:</span><span className="font-semibold">{formatCurrency(paid ? 0 : inv.grandTotal)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
