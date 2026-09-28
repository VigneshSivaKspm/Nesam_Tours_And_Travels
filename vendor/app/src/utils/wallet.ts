// Vendor wallet maths (pure, unit-tested). The Vendor Web wallet showed a
// hard-coded 10% fee and never loaded a balance; here every figure is derived
// from the vendor's completed bookings and its payout requests:
//   net payout   = vendorPayout locked in when the trip was accepted, else
//                  fare × (1 − commissionRate)
//   commission   = fare − net payout
//   credit       = net payout + tolls reimbursed on the trip
//   available    = Σ credits − paid payouts − pending payouts
import type { VendorBooking, VendorPayoutRequest, WalletTransaction } from '../types/operations';

export const RELEASED_PAYOUT_STATES = ['Deferred', 'Rejected', 'Cancelled'];

export function netPayout(b: VendorBooking, commissionRate: number): number {
  if (b.vendorPayout > 0) return Math.round(b.vendorPayout);
  return Math.round(b.fare * (1 - commissionRate));
}

export function commissionOf(b: VendorBooking, commissionRate: number): number {
  return Math.max(0, Math.round(b.fare - netPayout(b, commissionRate)));
}

export interface VendorWallet {
  completedTrips: number;
  grossFares: number;
  commission: number;
  netEarnings: number;
  tolls: number;
  paidOut: number;
  pending: number;
  available: number;
  todayNet: number;
  monthNet: number;
}

export function summarizeVendorWallet(bookings: VendorBooking[], payouts: VendorPayoutRequest[], commissionRate: number, now = new Date()): VendorWallet {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const done = bookings.filter((b) => b.status === 'Completed');
  let grossFares = 0;
  let commission = 0;
  let netEarnings = 0;
  let tolls = 0;
  let todayNet = 0;
  let monthNet = 0;
  for (const b of done) {
    const net = netPayout(b, commissionRate);
    grossFares += b.fare;
    commission += commissionOf(b, commissionRate);
    netEarnings += net;
    tolls += b.tollCharges;
    const at = b.completedAt?.getTime() ?? 0;
    if (at >= today) todayNet += net;
    if (at >= monthStart) monthNet += net;
  }
  const paidOut = payouts.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const pending = payouts.filter((p) => p.status !== 'Paid' && !RELEASED_PAYOUT_STATES.includes(p.status)).reduce((s, p) => s + p.amount, 0);
  return {
    completedTrips: done.length,
    grossFares: Math.round(grossFares),
    commission,
    netEarnings,
    tolls: Math.round(tolls),
    paidOut,
    pending,
    available: Math.max(0, Math.floor(netEarnings + tolls - paidOut - pending)),
    todayNet,
    monthNet,
  };
}

export function walletTransactions(bookings: VendorBooking[], payouts: VendorPayoutRequest[], commissionRate: number): WalletTransaction[] {
  const credits: WalletTransaction[] = bookings
    .filter((b) => b.status === 'Completed')
    .map((b) => ({
      id: `trip-${b.id}`,
      kind: 'credit',
      title: `Trip ${b.bookingId}`,
      subtitle: `Fare ₹${Math.round(b.fare)} − commission ₹${commissionOf(b, commissionRate)}${b.tollCharges ? ` + tolls ₹${Math.round(b.tollCharges)}` : ''}`,
      amount: netPayout(b, commissionRate) + Math.round(b.tollCharges),
      status: 'Credited',
      atMs: b.completedAt?.getTime() ?? 0,
    }));
  const debits: WalletTransaction[] = payouts.map((p) => ({
    id: `payout-${p.id}`,
    kind: 'debit',
    title: `Payout · ${p.method}`,
    subtitle: p.utr ? `UTR ${p.utr}` : p.details,
    amount: p.amount,
    status: p.status,
    atMs: p.createdMs,
  }));
  return [...credits, ...debits].sort((a, b) => b.atMs - a.atMs);
}

/** Days until an ISO date (negative when expired); null when unknown. */
export function daysUntil(iso: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59).getTime();
  return Math.floor((end - now.getTime()) / 86400000);
}
