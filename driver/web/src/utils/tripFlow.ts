import type { TripSubStatus } from '../types';

/**
 * The driver's step on a trip. The server (functions/src/domain/bookingFlow.ts)
 * is authoritative and re-checks every step; this only reads what it stored.
 * Older trips without a sub-status map from their legacy stage.
 */
export function tripSubStatusOf(b: { tripSubStatus?: unknown; tripStage?: unknown; status?: unknown }): TripSubStatus {
  const v = String(b.tripSubStatus ?? '');
  if (v === 'Not Started' || v === 'Trip Started' || v === 'Reached Pickup' || v === 'Trip Ended') return v;
  if (b.status === 'Completed') return 'Trip Ended';
  switch (b.tripStage) {
    case 'En Route Pickup': return 'Trip Started';
    case 'Reached Pickup':
    case 'In Progress':
    case 'Arrived Destination': return 'Reached Pickup';
    case 'Completed': return 'Trip Ended';
    default: return 'Not Started';
  }
}
