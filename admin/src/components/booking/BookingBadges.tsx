import type { AlertSeverity } from "../../domain/bookingFlow";

const STATUS: Record<string, string> = {
  Pending: "bg-yellow-50 text-yellow-800 border-yellow-300",
  Approved: "bg-sky-50 text-sky-800 border-sky-300",
  Confirmed: "bg-blue-50 text-blue-800 border-blue-300",
  Assigned: "bg-indigo-50 text-indigo-800 border-indigo-300",
  Ongoing: "bg-orange-50 text-orange-800 border-orange-300",
  Completed: "bg-green-50 text-green-800 border-green-300",
  Cancelled: "bg-red-50 text-red-800 border-red-300",
  Rejected: "bg-red-50 text-red-800 border-red-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS[status] || "bg-gray-50 text-gray-700 border-gray-300"}`}>{status}</span>
  );
}

const PAYMENT: Record<string, string> = {
  Paid: "text-green-800 bg-green-50 border-green-300",
  "Partially Paid": "text-amber-900 bg-amber-50 border-amber-300",
  Unpaid: "text-red-800 bg-red-50 border-red-300",
  "Refund Pending": "text-purple-800 bg-purple-50 border-purple-300",
  Refunded: "text-gray-700 bg-gray-100 border-gray-300",
};

export function PaymentBadge({ status }: { status: string }) {
  return <span className={`inline-flex px-2 py-0.5 rounded border text-xs font-semibold ${PAYMENT[status] || "bg-gray-50 text-gray-700 border-gray-300"}`}>{status}</span>;
}

export function AlertBadge({ severity, label }: { severity: AlertSeverity; label?: string }) {
  if (severity === "none" || severity === "normal") return null;
  const cls = severity === "critical" ? "bg-red-600 text-white border-red-700" : "bg-amber-100 text-amber-900 border-amber-400";
  return (
    <span role="status" className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${cls}`}>
      {severity === "critical" ? "⚠ URGENT" : "⚠ No driver"}
      {label ? ` · ${label}` : ""}
    </span>
  );
}
