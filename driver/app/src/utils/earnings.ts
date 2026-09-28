// Earnings and wallet maths, extracted from driver/web/src/DriverWorkspace.tsx
// so they are testable. The wallet is derived from completed trips (payout +
// toll reimbursement) minus paid and pending payout requests, exactly as the
// Driver Web panel shows it.
import type { DriverEarningsSummary, PayoutRequest, TripDetails } from '../types/driver';

/** Payout requests in these states no longer hold money back from the wallet. */
export const RELEASED_PAYOUT_STATES = ['Deferred', 'Rejected', 'Cancelled'];

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function tripTotal(t: TripDetails): number {
  return t.driverEarnings + t.tollCharges;
}

export function summarizeEarnings(completedTrips: TripDetails[], now = new Date()): DriverEarningsSummary {
  const today = startOfDay(now);
  const weekAgo = today - 6 * 86400000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const sum = { todayEarnings: 0, thisWeekEarnings: 0, thisMonthEarnings: 0, lifetimeEarnings: 0, tollReimbursements: 0 };
  for (const t of completedTrips) {
    const amount = tripTotal(t);
    const at = t.completedAt?.getTime() ?? 0;
    sum.lifetimeEarnings += amount;
    sum.tollReimbursements += t.tollCharges;
    if (at >= today) sum.todayEarnings += amount;
    if (at >= weekAgo) sum.thisWeekEarnings += amount;
    if (at >= monthStart) sum.thisMonthEarnings += amount;
  }
  return { ...sum, totalTripsCompleted: completedTrips.length };
}

export interface WalletSummary {
  availableBalance: number;
  pendingPayouts: number;
  totalPaidOut: number;
}

export function summarizeWallet(lifetimeEarnings: number, payouts: PayoutRequest[]): WalletSummary {
  const paidOut = payouts.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const pending = payouts.filter((p) => p.status !== 'Paid' && !RELEASED_PAYOUT_STATES.includes(p.status)).reduce((s, p) => s + p.amount, 0);
  return {
    availableBalance: Math.max(0, Math.floor(lifetimeEarnings - paidOut - pending)),
    pendingPayouts: pending,
    totalPaidOut: paidOut,
  };
}

/** Last 7 days (oldest first) of completed-trip earnings, for the chart. */
export function last7Days(completedTrips: TripDetails[], now = new Date()): { label: string; key: string; amount: number }[] {
  const days: { label: string; key: string; amount: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({ label: d.toLocaleDateString('en-IN', { weekday: 'short' }), key: d.toDateString(), amount: 0 });
  }
  for (const t of completedTrips) {
    if (!t.completedAt) continue;
    const slot = days.find((d) => d.key === t.completedAt!.toDateString());
    if (slot) slot.amount += tripTotal(t);
  }
  return days;
}

/**
 * Trip categories are admin-defined names ("Sedan (AC)", "Innova Crysta"), so
 * match loosely on the driver's vehicle type; a plain SUV must not match
 * "Premium SUV" trips (from driver/web DashboardScreen.tsx).
 */
export function categoryMatches(tripCategory: string, driverType: string): boolean {
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const cat = normalise(tripCategory);
  const mine = normalise(driverType);
  if (!cat) return true;
  if (cat.includes('premium') !== mine.includes('premium')) return false;
  if ((cat === 'mini' && mine === 'hatchback') || (cat === 'hatchback' && mine === 'mini')) return true;
  return cat.includes(mine) || mine.includes(cat);
}
