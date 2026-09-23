import { Booking } from "../types";

/** Parse "₹1,250" | 1250 | "1250.5" -> number (0 on failure). */
export const parseAmount = (v: string | number | undefined | null): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Best-effort date for a booking: Firestore Timestamp -> createdAt seconds -> date string. */
export const bookingDate = (b: Booking): Date | null => {
  const c = b.createdAt as any;
  if (c?.toDate) return c.toDate();
  if (c?.seconds) return new Date(c.seconds * 1000);
  if (b.date) {
    const d = new Date(b.date);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
};

export const isPaid = (b: Booking): boolean =>
  b.payment === "Paid" || b.paymentStatus === "Paid";

/** Compact Indian-currency formatting: ₹1.2K, ₹3.84L, ₹1.20Cr. */
export const formatINR = (n: number): string => {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

export const inMonth = (d: Date | null, ref: Date): boolean =>
  d !== null &&
  d.getMonth() === ref.getMonth() &&
  d.getFullYear() === ref.getFullYear();

/** Signed percentage change; null when there is no baseline. */
export const pctChange = (current: number, previous: number): number | null =>
  previous > 0 ? ((current - previous) / previous) * 100 : null;

export const formatPct = (v: number | null): string =>
  v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
