import { useState, useEffect, useMemo } from "react";
import { Invoice, Booking } from "../types";
import {
  subscribeInvoices,
  subscribeBookings,
  subscribeSettings,
  setFirestoreDocument,
  COLLECTIONS,
} from "../services/adminFirestoreService";

function formatCurrency(n: number): string {
  return "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numberToWords(num: number): string {
  if (!num || num === 0) return "Zero Rupees Only";
  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty ", "Thirty ", "Forty ", "Fifty ", "Sixty ", "Seventy ", "Eighty ", "Ninety "];

  function inWords(n: number): string {
    if ((n = n.toString() as any).length > 9) return "overflow";
    const nArr = ("000000000" + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nArr) return "";
    let str = "";
    str += Number(nArr[1]) !== 0 ? (a[Number(nArr[1])] || (b as any)[nArr[1][0]] + a[Number(nArr[1][1])]) + "Crore " : "";
    str += Number(nArr[2]) !== 0 ? (a[Number(nArr[2])] || (b as any)[nArr[2][0]] + a[Number(nArr[2][1])]) + "Lakh " : "";
    str += Number(nArr[3]) !== 0 ? (a[Number(nArr[3])] || (b as any)[nArr[3][0]] + a[Number(nArr[3][1])]) + "Thousand " : "";
    str += Number(nArr[4]) !== 0 ? (a[Number(nArr[4])] || (b as any)[nArr[4][0]] + a[Number(nArr[4][1])]) + "Hundred " : "";
    str += Number(nArr[5]) !== 0 ? (str !== "" ? "and " : "") + (a[Number(nArr[5])] || (b as any)[nArr[5][0]] + a[Number(nArr[5][1])]) : "";
    return str;
  }

  const rounded = Math.round(num);
  const words = inWords(rounded);
  return `Rupees ${words.trim()} Only`;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings / Company Defaults
  const [companySettings, setCompanySettings] = useState({
    name: "Nesam Tours & Travels Private Limited",
    gstin: "33AABCN1234F1Z5",
    phone: "+91 44 4567 8901",
    email: "info@nesamtours.in",
    address: "No. 42, Mount Road, Anna Salai, Chennai - 600002, Tamil Nadu",
    sacCode: "9964",
    gstRate: "5",
  });

  // Filters & Sorting
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [dateFilter, setDateFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "amount">("newest");

  // View / Print Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const unsubInv = subscribeInvoices((data) => {
      setInvoices(data);
      setLoading(false);
    });
    const unsubB = subscribeBookings((data) => {
      setBookings(data);
    });
    const unsubS = subscribeSettings((data) => {
      if (data && Object.keys(data).length > 0) {
        setCompanySettings((prev) => ({
          ...prev,
          name: data.companyName || prev.name,
          gstin: data.gst || prev.gstin,
          phone: data.phone || prev.phone,
          email: data.email || prev.email,
          address: data.address || prev.address,
          gstRate: data.gstRate || prev.gstRate,
        }));
      }
    });
    return () => {
      unsubInv();
      unsubB();
      unsubS();
    };
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // KPIs
  const stats = useMemo(() => {
    const totalCount = invoices.length;
    const paidCount = invoices.filter((i) => i.paymentStatus === "Paid" && i.invoiceStatus !== "Cancelled").length;
    const pendingCount = invoices.filter((i) => i.paymentStatus !== "Paid" && i.invoiceStatus !== "Cancelled").length;
    const totalAmount = invoices
      .filter((i) => i.invoiceStatus !== "Cancelled")
      .reduce((sum, i) => sum + (i.grandTotal || 0), 0);
    return { totalCount, paidCount, pendingCount, totalAmount };
  }, [invoices]);

  // Filtered & Sorted Invoices
  const filteredInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        const q = search.trim().toLowerCase();
        const matchSearch =
          q === "" ||
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.bookingId.toLowerCase().includes(q) ||
          (inv.customerSnapshot?.name || "").toLowerCase().includes(q) ||
          (inv.customerSnapshot?.phone || "").toLowerCase().includes(q);

        const matchPayment = paymentFilter === "All" || inv.paymentStatus === paymentFilter;
        const matchStatus = statusFilter === "All" || inv.invoiceStatus === statusFilter;

        let matchDate = true;
        if (dateFilter !== "All" && inv.invoiceDate) {
          const invDate = new Date(inv.invoiceDate);
          const now = new Date();
          if (dateFilter === "Today") {
            matchDate = invDate.toDateString() === now.toDateString();
          } else if (dateFilter === "This Week") {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchDate = invDate >= weekAgo;
          } else if (dateFilter === "This Month") {
            matchDate = invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
          }
        }
        return matchSearch && matchPayment && matchStatus && matchDate;
      })
      .sort((a, b) => {
        if (sortBy === "oldest") return new Date(a.invoiceDate || 0).getTime() - new Date(b.invoiceDate || 0).getTime();
        if (sortBy === "amount") return (b.grandTotal || 0) - (a.grandTotal || 0);
        return new Date(b.invoiceDate || 0).getTime() - new Date(a.invoiceDate || 0).getTime();
      });
  }, [invoices, search, paymentFilter, statusFilter, dateFilter, sortBy]);

  // Eligible Bookings for Invoice Generation
  const eligibleBookings = useMemo(() => {
    return bookings.filter((b) => {
      const alreadyHasInvoice = invoices.some(
        (inv) => inv.bookingId === b.id && inv.invoiceStatus !== "Cancelled"
      );
      return !alreadyHasInvoice;
    });
  }, [bookings, invoices]);

  // Selected Booking Details for Modal Pre-fill
  const selectedBooking = useMemo(() => {
    return bookings.find((b) => b.id === selectedBookingId) || null;
  }, [bookings, selectedBookingId]);

  // Generate Unique Sequential Invoice Number
  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const existingNumSeq = invoices.map((i) => {
      const match = (i.invoiceNumber || "").match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxSeq = existingNumSeq.length > 0 ? Math.max(...existingNumSeq) : 0;
    const nextSeq = (maxSeq + 1).toString().padStart(4, "0");
    return `NES-INV-${year}-${nextSeq}`;
  };

  // Create Invoice Handler
  const handleCreateInvoice = async () => {
    if (!selectedBooking) {
      setCreateError("Please select a valid booking to generate invoice.");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const invoiceNo = generateInvoiceNumber();
      const docId = `INV-${selectedBooking.id}`;

      // Calculate fare breakdown from booking
      const parseNum = (v: any) => {
        if (typeof v === "number") return v;
        if (!v) return 0;
        return parseFloat(v.toString().replace(/[^0-9.]/g, "")) || 0;
      };

      const bookingFare = parseNum(selectedBooking.fare);
      const rateGst = parseFloat(companySettings.gstRate || "5") / 100;

      // Base charges
      const subtotal = Math.round((bookingFare / (1 + rateGst)) * 100) / 100;
      const discount = 0;
      const taxableAmount = subtotal - discount;
      const totalTax = Math.round((bookingFare - taxableAmount) * 100) / 100;
      const cgst = Math.round((totalTax / 2) * 100) / 100;
      const sgst = Math.round((totalTax - cgst) * 100) / 100;
      const grandTotal = bookingFare;

      const isPaid = selectedBooking.payment === "Paid" || selectedBooking.paymentStatus === "Paid";
      const paidAmount = isPaid ? grandTotal : 0;
      const balanceAmount = grandTotal - paidAmount;
      const paymentStatus: "Paid" | "Partially Paid" | "Pending" = isPaid
        ? "Paid"
        : paidAmount > 0
        ? "Partially Paid"
        : "Pending";

      const items = [
        {
          description: `${selectedBooking.service || "Taxi Service"} — ${selectedBooking.pickup || "Origin"} to ${selectedBooking.drop || "Destination"}`,
          amount: subtotal,
          qty: 1,
          rate: subtotal,
        },
      ];

      const newInvoice: Invoice = {
        id: docId,
        invoiceNumber: invoiceNo,
        bookingId: selectedBooking.id,
        customerId: selectedBooking.customer,
        invoiceDate: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        companySnapshot: {
          name: companySettings.name,
          gstin: companySettings.gstin,
          address: companySettings.address,
          phone: companySettings.phone,
          email: companySettings.email,
          sacCode: companySettings.sacCode,
        },
        customerSnapshot: {
          name: selectedBooking.customerName || selectedBooking.customer || "Valued Customer",
          phone: selectedBooking.customerPhone || selectedBooking.phone || "—",
          email: "",
          address: "",
        },
        tripSnapshot: {
          service: selectedBooking.service,
          pickup: selectedBooking.pickup,
          drop: selectedBooking.drop,
          travelDate: selectedBooking.date,
          travelTime: selectedBooking.time,
          vehicle: selectedBooking.vehicle,
          driverName: selectedBooking.driver || "Assigned Driver",
          distanceKm: selectedBooking.distanceKm || 0,
        },
        items,
        subtotal,
        discount,
        taxableAmount,
        gstRate: rateGst,
        cgst,
        sgst,
        totalTax,
        grandTotal,
        paidAmount,
        balanceAmount,
        paymentStatus,
        invoiceStatus: "Issued",
        terms: "1. Goods once rendered are non-refundable. 2. Payments via UPI, Card, or Cash. 3. This is a computer-generated tax invoice.",
        createdAt: new Date().toISOString(),
      };

      const ok = await setFirestoreDocument(COLLECTIONS.INVOICES, docId, newInvoice);
      if (ok) {
        setShowCreateModal(false);
        setSelectedBookingId("");
        showToast(`Tax invoice ${invoiceNo} generated successfully.`, "success");
      } else {
        setCreateError("Failed to save invoice to Firestore database.");
      }
    } catch (err: any) {
      console.error("Create invoice error:", err);
      setCreateError(err.message || "An unexpected error occurred.");
    } finally {
      setCreating(false);
    }
  };

  // Void/Cancel Invoice
  const handleVoidInvoice = async (inv: Invoice) => {
    if (!window.confirm(`Are you sure you want to void invoice ${inv.invoiceNumber}?`)) return;
    const ok = await setFirestoreDocument(COLLECTIONS.INVOICES, inv.id, {
      ...inv,
      invoiceStatus: "Cancelled",
    });
    if (ok) {
      showToast(`Invoice ${inv.invoiceNumber} marked as Cancelled.`, "success");
    } else {
      showToast(`Failed to void invoice.`, "error");
    }
  };

  // Print Invoice Handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Print stylesheet to isolate invoice document */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible;
          }
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            color: black;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold text-white transition-all ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          <span>{toast.type === "success" ? "✓" : "⚠️"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[#111111]">Invoices</h1>
          <p className="text-[13px] text-[#666666]">
            View, download and manage GST-compliant tax invoices and customer receipts.
          </p>
        </div>

        <button
          onClick={() => {
            setCreateError(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-white rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          style={{ background: "#E21B23" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          + Create Invoice
        </button>
      </div>

      {/* Dashboard KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Invoices",
            value: stats.totalCount.toString(),
            color: "#E21B23",
            sub: "All issued tax records",
          },
          {
            label: "Paid Invoices",
            value: stats.paidCount.toString(),
            color: "#10B981",
            sub: "Fully settled receipts",
          },
          {
            label: "Pending / Unpaid",
            value: stats.pendingCount.toString(),
            color: "#F59E0B",
            sub: "Awaiting payment",
          },
          {
            label: "Total Invoiced Amount",
            value: formatCurrency(stats.totalAmount),
            color: "#3B82F6",
            sub: "Gross billing value",
          },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
            <div className="text-[22px] font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-[12px] font-semibold text-[#111111] mt-0.5">{s.label}</div>
            <div className="text-[10px] text-[#999999]">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-12 text-center text-[13px] text-[#999999]">
          Loading invoices data...
        </div>
      ) : invoices.length === 0 ? (
        /* Empty State Placeholder */
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#FEF2F2" }}>
            <svg
              className="w-8 h-8"
              style={{ color: "#E21B23" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h2 className="text-[18px] font-bold text-[#111111] mb-2">Invoices</h2>
          <p className="text-[13px] text-[#999999] max-w-sm mb-6">
            View, download and manage GST-compliant tax invoices for all completed bookings. Auto-generate customer receipts.
          </p>
          <button
            onClick={() => {
              setCreateError(null);
              setShowCreateModal(true);
            }}
            className="px-6 py-2.5 text-[13px] font-semibold text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            style={{ background: "#E21B23" }}
          >
            Get Started
          </button>
        </div>
      ) : (
        /* Invoice Directory Table */
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3 bg-[#FAFAFA]">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]"
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
                placeholder="Search invoice no., booking ID, customer..."
                className="w-full pl-9 pr-4 py-2 text-[12px] bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] placeholder-[#999999]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#E21B23] text-[#444444]"
              >
                <option value="All">All Payment Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Pending">Pending</option>
              </select>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#E21B23] text-[#444444]"
              >
                <option value="All">All Dates</option>
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 text-[12px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#E21B23] text-[#444444]"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="amount">Highest Amount</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Invoice No.
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Booking ID
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Invoice Date
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Total Amount
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Paid
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Balance
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Payment Status
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#999999] uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-[12px] text-[#999999]">
                      No invoices match your search filters.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA] transition-colors">
                      {/* Invoice No */}
                      <td className="px-4 py-3.5">
                        <div className="text-[12px] font-bold font-mono text-[#111111]">{inv.invoiceNumber}</div>
                        <div className="text-[10px] text-[#999999]">SAC: {inv.companySnapshot?.sacCode || "9964"}</div>
                      </td>

                      {/* Booking ID */}
                      <td className="px-4 py-3.5">
                        <span className="text-[11px] font-mono font-semibold text-[#E21B23]">
                          {inv.bookingId}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="text-[12px] font-semibold text-[#111111]">
                          {inv.customerSnapshot?.name || "Customer"}
                        </div>
                        <div className="text-[10px] text-[#999999]">
                          {inv.customerSnapshot?.phone || "—"}
                        </div>
                      </td>

                      {/* Invoice Date */}
                      <td className="px-4 py-3.5 text-[12px] text-[#666666]">
                        {inv.invoiceDate || "—"}
                      </td>

                      {/* Total Amount */}
                      <td className="px-4 py-3.5 text-right text-[12px] font-bold text-[#111111]">
                        {formatCurrency(inv.grandTotal)}
                      </td>

                      {/* Paid */}
                      <td className="px-4 py-3.5 text-right text-[12px] font-semibold text-emerald-600">
                        {formatCurrency(inv.paidAmount)}
                      </td>

                      {/* Balance */}
                      <td className="px-4 py-3.5 text-right text-[12px] font-semibold text-[#E21B23]">
                        {formatCurrency(inv.balanceAmount)}
                      </td>

                      {/* Payment Status */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            inv.paymentStatus === "Paid"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : inv.paymentStatus === "Partially Paid"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-[#E21B23] border-red-200"
                          }`}
                        >
                          {inv.paymentStatus}
                        </span>
                      </td>

                      {/* Invoice Status */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            inv.invoiceStatus === "Issued"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          {inv.invoiceStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-[#E5E5E5] text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            View
                          </button>
                          {inv.invoiceStatus !== "Cancelled" && (
                            <button
                              onClick={() => handleVoidInvoice(inv)}
                              className="px-2 py-1 text-[11px] font-medium rounded-lg border border-red-200 bg-red-50 text-[#E21B23] hover:bg-red-100 transition-colors cursor-pointer"
                            >
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE INVOICE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#FAFAFA]">
              <div>
                <h3 className="text-[16px] font-bold text-[#111111]">+ Generate Tax Invoice</h3>
                <p className="text-[11px] text-[#666666]">
                  Select an eligible booking to auto-generate a GST-compliant invoice.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                  ⚠️ {createError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-[#111111] mb-1">
                  Select Booking *
                </label>
                <select
                  value={selectedBookingId}
                  onChange={(e) => setSelectedBookingId(e.target.value)}
                  className="w-full p-2.5 border border-[#E5E5E5] rounded-lg text-[12px] focus:outline-none focus:border-[#E21B23]"
                >
                  <option value="">-- Choose Completed or Confirmed Booking --</option>
                  {eligibleBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id} — {b.customer || "Customer"} ({b.service} - {b.fare})
                    </option>
                  ))}
                </select>
              </div>

              {selectedBooking && (
                <div className="p-4 bg-gray-50 rounded-xl border border-[#E5E5E5] space-y-3 text-xs">
                  <div className="flex justify-between border-b pb-2">
                    <span className="font-semibold text-gray-700">Customer:</span>
                    <span className="font-bold text-gray-900">{selectedBooking.customer}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="font-semibold text-gray-700">Phone:</span>
                    <span className="font-mono text-gray-900">{selectedBooking.phone || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="font-semibold text-gray-700">Route:</span>
                    <span className="text-gray-900 font-medium">{selectedBooking.pickup} → {selectedBooking.drop}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="font-semibold text-gray-700">Vehicle / Service:</span>
                    <span className="text-gray-900">{selectedBooking.vehicle} ({selectedBooking.service})</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="font-semibold text-gray-700">Travel Date:</span>
                    <span className="text-gray-900">{selectedBooking.date} {selectedBooking.time}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="font-semibold text-gray-700">Booking Fare:</span>
                    <span className="font-bold text-[#E21B23]">{selectedBooking.fare}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-700">Payment Status:</span>
                    <span className="font-bold text-emerald-700">{selectedBooking.payment || "Pending"}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#E5E5E5] flex items-center justify-between bg-[#FAFAFA]">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-[#E5E5E5] rounded-lg text-[12px] font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCreateInvoice}
                disabled={creating || !selectedBooking}
                className="px-6 py-2 text-[13px] font-semibold text-white rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                style={{ background: "#E21B23" }}
              >
                {creating ? "Generating Invoice..." : "Generate Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE DETAIL & A4 PRINTABLE MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-6">
            {/* Modal Header Actions */}
            <div className="no-print px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#FAFAFA]">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-[#111111]">Tax Invoice Preview</span>
                <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-bold">
                  {selectedInvoice.invoiceNumber}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[12px] font-semibold hover:bg-gray-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print / Download PDF
                </button>

                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* A4 INVOICE BODY (PRINTABLE CONTAINER) */}
            <div id="printable-invoice" className="p-8 space-y-6 text-[#111111] bg-white max-h-[75vh] overflow-y-auto">
              {/* Header section */}
              <div className="flex justify-between border-b pb-6">
                <div>
                  <div className="text-[20px] font-black text-[#E21B23] tracking-wide uppercase">
                    {selectedInvoice.companySnapshot?.name || companySettings.name}
                  </div>
                  <div className="text-[11px] text-gray-600 max-w-sm mt-1">
                    {selectedInvoice.companySnapshot?.address || companySettings.address}
                  </div>
                  <div className="text-[11px] text-gray-600 mt-1">
                    Phone: {selectedInvoice.companySnapshot?.phone || companySettings.phone} • Email: {selectedInvoice.companySnapshot?.email || companySettings.email}
                  </div>
                  <div className="text-[11px] font-bold text-gray-900 mt-1">
                    GSTIN: {selectedInvoice.companySnapshot?.gstin || companySettings.gstin}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[18px] font-black text-gray-900 tracking-wider">TAX INVOICE</div>
                  <div className="text-[10px] text-gray-500 uppercase font-semibold">Original For Recipient</div>
                  <div className="text-[13px] font-mono font-bold text-[#E21B23] mt-2">
                    {selectedInvoice.invoiceNumber}
                  </div>
                  <div className="text-[11px] text-gray-600 mt-0.5">Date: {selectedInvoice.invoiceDate}</div>
                  <div className="text-[11px] text-gray-600">Booking ID: {selectedInvoice.bookingId}</div>
                  <div className="mt-2">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">
                      Payment Status: {selectedInvoice.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bill To & Trip Info */}
              <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block mb-1">
                    Billed To (Customer Details)
                  </span>
                  <div className="text-sm font-bold text-gray-900">
                    {selectedInvoice.customerSnapshot?.name}
                  </div>
                  <div className="text-gray-600">Phone: {selectedInvoice.customerSnapshot?.phone}</div>
                  {selectedInvoice.customerSnapshot?.email && (
                    <div className="text-gray-600">Email: {selectedInvoice.customerSnapshot.email}</div>
                  )}
                  {selectedInvoice.customerSnapshot?.address && (
                    <div className="text-gray-600">Address: {selectedInvoice.customerSnapshot.address}</div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block mb-1">
                    Trip & Vehicle Details
                  </span>
                  <div className="text-gray-900 font-semibold">
                    {selectedInvoice.tripSnapshot?.service || "Cab Service"} ({selectedInvoice.tripSnapshot?.vehicle})
                  </div>
                  <div className="text-gray-600">
                    Route: {selectedInvoice.tripSnapshot?.pickup} → {selectedInvoice.tripSnapshot?.drop}
                  </div>
                  <div className="text-gray-600">
                    Travel Date: {selectedInvoice.tripSnapshot?.travelDate} {selectedInvoice.tripSnapshot?.travelTime}
                  </div>
                  <div className="text-gray-600">
                    Driver: {selectedInvoice.tripSnapshot?.driverName || "Assigned Driver"}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-700 font-bold uppercase text-[10px]">
                      <th className="px-4 py-2.5 text-left">#</th>
                      <th className="px-4 py-2.5 text-left">Description / Particulars</th>
                      <th className="px-4 py-2.5 text-center">SAC Code</th>
                      <th className="px-4 py-2.5 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items?.map((item, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="px-4 py-2.5 text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{item.description}</td>
                        <td className="px-4 py-2.5 text-center font-mono text-gray-600">
                          {selectedInvoice.companySnapshot?.sacCode || "9964"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Calculations summary */}
              <div className="grid grid-cols-2 gap-6 text-xs pt-2">
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block mb-1">
                    Amount in Words
                  </span>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 font-semibold text-gray-900 italic">
                    {numberToWords(selectedInvoice.grandTotal)}
                  </div>

                  <div className="mt-4 text-[10px] text-gray-500 space-y-1">
                    <p className="font-bold text-gray-700">Terms & Conditions:</p>
                    <p>{selectedInvoice.terms}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-right">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal (Excl. Tax):</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>

                  {selectedInvoice.discount > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Discount:</span>
                      <span className="font-semibold text-emerald-600">- {formatCurrency(selectedInvoice.discount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-gray-600">
                    <span>Taxable Amount:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(selectedInvoice.taxableAmount)}</span>
                  </div>

                  <div className="flex justify-between text-gray-600">
                    <span>CGST (2.5%):</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(selectedInvoice.cgst)}</span>
                  </div>

                  <div className="flex justify-between text-gray-600">
                    <span>SGST (2.5%):</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(selectedInvoice.sgst)}</span>
                  </div>

                  <div className="flex justify-between text-gray-900 font-bold border-t pt-2 text-sm">
                    <span>Grand Total:</span>
                    <span className="text-[#E21B23]">{formatCurrency(selectedInvoice.grandTotal)}</span>
                  </div>

                  <div className="flex justify-between text-emerald-700 font-semibold text-xs pt-1">
                    <span>Total Paid:</span>
                    <span>{formatCurrency(selectedInvoice.paidAmount)}</span>
                  </div>

                  <div className="flex justify-between text-red-700 font-semibold text-xs">
                    <span>Balance Due:</span>
                    <span>{formatCurrency(selectedInvoice.balanceAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Signatory footer */}
              <div className="pt-8 flex items-center justify-between border-t text-[11px] text-gray-500">
                <div>
                  Thank you for choosing <span className="font-bold text-gray-800">Nesam Tours & Travels</span>!
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">For Nesam Tours & Travels Pvt. Ltd.</div>
                  <div className="h-10"></div>
                  <div className="text-[10px] text-gray-400 font-mono">Authorized Signatory</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
