/**
 * Trip actions. Each is a server function that validates the step order, stamps
 * the time, records where it happened and ignores a repeated tap. The app never
 * writes a trip's status or step itself.
 */
import { callFunction, newId } from './callables';
import type { TollReceipt, TripSubStatus } from '../types/driver';

export interface Fix {
  lat: number;
  lng: number;
  accuracy?: number | null;
}

export type TripStep = Exclude<TripSubStatus, 'Not Started'>;

/** One idempotency key per button press attempt: a retry or double tap changes nothing the second time. */
export const newRequestId = () => newId('trip');

const fixOf = (f?: Fix | null) => (f ? { lat: f.lat, lng: f.lng, accuracy: f.accuracy ?? undefined } : undefined);

export function advanceTrip(args: { bookingId: string; to: TripStep; location?: Fix | null; endOdometer?: number; tolls?: TollReceipt[]; requestId: string }) {
  return callFunction<unknown, { ok: boolean; duplicate: boolean; stage: TripStep }>('advanceTrip', {
    bookingId: args.bookingId,
    to: args.to,
    location: fixOf(args.location),
    platform: 'android',
    requestId: args.requestId,
    ...(args.endOdometer !== undefined ? { endOdometer: args.endOdometer } : {}),
    ...(args.tolls ? { tolls: args.tolls } : {}),
  });
}

export const verifyBoarding = (bookingId: string, otp: string) => callFunction<unknown, { ok: boolean }>('verifyBoarding', { bookingId, otp });

export interface CollectionInput {
  bookingId: string;
  amount: number;
  method: 'Cash' | 'UPI' | 'Bank Transfer';
  reference: string;
  notes?: string;
  requestId: string;
}

/** The driver records money collected from the customer; it is saved as a payment against them. */
export const recordCollection = (i: CollectionInput) =>
  callFunction<unknown, { id: string; duplicate: boolean }>('recordPayment', {
    bookingId: i.bookingId,
    amount: i.amount,
    method: i.method,
    reference: i.reference,
    notes: i.notes ?? '',
    requestId: i.requestId,
    collectorType: 'driver',
  });

export const acknowledgePenalty = (penaltyId: string) => callFunction<unknown, { ok: boolean }>('acknowledgePenalty', { penaltyId, confirmed: true });
export const disputePenalty = (penaltyId: string, note: string) => callFunction<unknown, { ok: boolean }>('disputePenalty', { penaltyId, note });
