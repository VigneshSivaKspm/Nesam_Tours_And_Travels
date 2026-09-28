import { useEffect, useRef } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { TripDetails } from '../types/driver';
import { watchPosition } from '../services/locationService';
import { updateDriverLocation } from '../services/driverService';
import { haversineKm } from '../utils/geo';
import { LOCATION_SHARE_INTERVAL_MS, LOCATION_SHARE_MIN_MOVE_KM } from '../config/constants';

const SHARING_STAGES = ['En Route Pickup', 'Reached Pickup', 'In Progress', 'Arrived Destination'];
const KEEP_AWAKE_TAG = 'nesam-trip';

/**
 * While a trip is under way (after the pre-trip check, until completion) the
 * driver's position is written to bookings/{id}.driverLocation — throttled to
 * one write per LOCATION_SHARE_INTERVAL_MS or per LOCATION_SHARE_MIN_MOVE_KM —
 * and the screen is kept awake. Runs while the app is in the foreground.
 */
export function useTripLocationSharing(trip: TripDetails | null): void {
  const bookingId = trip?.id ?? null;
  const sharing = !!trip && (trip.status === 'Assigned' || trip.status === 'Ongoing') && SHARING_STAGES.includes(trip.stage);
  const last = useRef<{ at: number; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!sharing || !bookingId) return undefined;
    last.current = null;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    const stop = watchPosition(
      (p) => {
        const prev = last.current;
        const now = Date.now();
        const moved = prev ? haversineKm(prev, p) : Infinity;
        if (prev && now - prev.at < LOCATION_SHARE_INTERVAL_MS && moved < LOCATION_SHARE_MIN_MOVE_KM) return;
        last.current = { at: now, lat: p.lat, lng: p.lng };
        // Best effort: a dropped update is replaced by the next one.
        updateDriverLocation(bookingId, { lat: p.lat, lng: p.lng, heading: p.heading }).catch(() => {
          last.current = prev;
        });
      },
      () => undefined,
    );
    return () => {
      stop();
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [sharing, bookingId]);
}
