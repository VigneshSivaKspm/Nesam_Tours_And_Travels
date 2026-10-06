import type { Booking } from "../types";
import { subscribeToDocument } from "./adminFirestoreService";

/** Live view of one booking. `undefined` is "still loading" for the caller; a missing booking is `null`. */
export function subscribeBookingById(id: string, cb: (b: Booking | null) => void, onError?: (message: string) => void) {
  return subscribeToDocument<Booking>(`bookings/${id}`, cb, onError);
}
