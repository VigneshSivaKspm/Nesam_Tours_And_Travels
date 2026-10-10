// How a booking is presented to the customer (unit-tested).
import { isActiveStatus } from '../services/rideService';
import type { TripRecord } from '../types';
import { formatINR } from './format';

export type TripTab = 'Upcoming' | 'Completed' | 'Cancelled';

export const tabOfTrip = (t: TripRecord): TripTab => (isActiveStatus(t.status) ? 'Upcoming' : t.status === 'Completed' ? 'Completed' : 'Cancelled');

/** Status chip text + colours; the text always carries the meaning, colour only reinforces it. */
export function tripStatusChip(t: TripRecord): { label: string; fg: string; bg: string } {
  const blue = { fg: '#1D4ED8', bg: '#E0EDFF' };
  const green = { fg: '#15803D', bg: '#DCFCE7' };
  const amber = { fg: '#B45309', bg: '#FEF3C7' };
  const red = { fg: '#B91C1C', bg: '#FEE2E2' };
  if (t.status === 'Pending') return { label: 'Awaiting approval', ...amber };
  if (t.status === 'Approved') return { label: 'Approved · finding driver', ...amber };
  if (t.status === 'Rejected') return { label: 'Not accepted', ...red };
  switch (t.phase) {
    case 'partner_confirmed':
      return { label: 'Confirmed', ...blue };
    case 'driver_en_route':
      return { label: 'Driver assigned', ...blue };
    case 'driver_arrived':
      return { label: 'Driver at pickup', ...blue };
    case 'in_trip':
      return { label: 'On trip', ...blue };
    case 'completed':
      return { label: 'Completed', ...green };
    case 'cancelled':
      return { label: 'Cancelled', ...red };
    default:
      return { label: 'Finding driver', ...amber };
  }
}

/** What the customer still has to do about money on this trip. */
export function paymentLabel(t: TripRecord): { text: string; tone: 'muted' | 'success' | 'danger' } {
  if (t.status === 'Cancelled' || t.status === 'Rejected') {
    if (t.refund && t.refund.amount > 0) return { text: `Refund ${t.refund.status.toLowerCase()}: ${formatINR(t.refund.amount)}`, tone: 'muted' };
    return t.cancellationFee > 0 ? { text: `Cancellation fee ${formatINR(t.cancellationFee)}`, tone: 'danger' } : { text: 'No charge', tone: 'muted' };
  }
  if (t.paymentStatus === 'Paid' || (t.paid && t.paid.totalPaid > 0 && t.paid.balanceDue <= 0)) return { text: 'Paid', tone: 'success' };
  if (t.paid && t.paid.totalPaid > 0) return { text: `Balance ${formatINR(t.paid.balanceDue)}`, tone: 'danger' };
  return { text: t.paymentMethod === 'UPI' ? 'Pay by UPI' : 'Pay at drop', tone: 'muted' };
}

/** Bookings with money to show: completed ones, and cancelled ones that were charged or refunded. */
export function paymentRows(trips: TripRecord[]): TripRecord[] {
  return trips
    .filter((t) => t.status === 'Completed' || t.cancellationFee > 0 || (t.refund && t.refund.amount > 0) || (t.paid && t.paid.totalPaid > 0))
    .sort((a, b) => ((b.completedAt ?? b.cancelledAt ?? b.createdAt)?.getTime() ?? 0) - ((a.completedAt ?? a.cancelledAt ?? a.createdAt)?.getTime() ?? 0));
}
