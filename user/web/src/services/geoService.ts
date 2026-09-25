// Device location, place search (Photon), reverse geocoding and routing (OSRM).
// Every network call has a timeout, honours an AbortSignal, is cached, and
// degrades gracefully: routing falls back to a straight-line estimate so
// fares can still be quoted when the routing server is unreachable.

import { GEOCODER_URL, ROUTING_URL, INDIA_BBOX, AVG_CITY_SPEED_KMPH } from '../config/constants';
import { GeoPlace, LatLng, PlaceType, RouteInfo } from '../types';
import { haversineKm, ROAD_FACTOR, isValidLatLng } from '../utils/geo';
import { TimeoutError } from '../utils/retry';

// ── Device location ─────────────────────────────────────────────────────────

export type LocationErrorKind = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout';

export class LocationError extends Error {
  constructor(public kind: LocationErrorKind, message: string) {
    super(message);
  }
}

export const LOCATION_ERROR_TEXT: Record<LocationErrorKind, string> = {
  unsupported: 'This browser does not support location. Search for your pickup instead.',
  insecure: 'Location needs a secure (https) connection. Search for your pickup instead.',
  denied:
    'Location permission is blocked. Enable it from your browser’s site settings (the icon left of the address bar), or search for your pickup.',
  unavailable: 'We couldn’t get a GPS fix. Move to an open area or search for your pickup.',
  timeout: 'Getting your location is taking too long. Try again or search for your pickup.',
};

export interface DevicePosition extends LatLng {
  accuracy: number;
  heading: number | null;
  speed: number | null;
}

function toLocationError(err: GeolocationPositionError): LocationError {
  const kind: LocationErrorKind =
    err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable';
  return new LocationError(kind, LOCATION_ERROR_TEXT[kind]);
}

function checkSupport(): LocationError | null {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return new LocationError('insecure', LOCATION_ERROR_TEXT.insecure);
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return new LocationError('unsupported', LOCATION_ERROR_TEXT.unsupported);
  }
  return null;
}

function toPosition(pos: GeolocationPosition): DevicePosition {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    heading: pos.coords.heading ?? null,
    speed: pos.coords.speed ?? null,
  };
}

export function getCurrentPosition(timeoutMs = 15000): Promise<DevicePosition> {
  const unsupported = checkSupport();
  if (unsupported) return Promise.reject(unsupported);
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(toPosition(pos)),
      (err) => reject(toLocationError(err)),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10000 },
    );
  });
}

export function watchPosition(
  onPosition: (p: DevicePosition) => void,
  onError: (e: LocationError) => void,
): () => void {
  const unsupported = checkSupport();
  if (unsupported) {
    onError(unsupported);
    return () => undefined;
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onPosition(toPosition(pos)),
    (err) => onError(toLocationError(err)),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export type PermissionStateLite = 'granted' | 'denied' | 'prompt' | 'unknown';

export async function getLocationPermission(): Promise<PermissionStateLite> {
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return (status?.state as PermissionStateLite) ?? 'unknown';
  } catch {
    return 'unknown'; // Safari < 16 has no Permissions API for geolocation
  }
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, signal?: AbortSignal, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new TimeoutError()), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { code: res.status >= 500 ? 'unavailable' : 'http' });
    return (await res.json()) as T;
  } catch (err) {
    if (controller.signal.aborted && !signal?.aborted) throw new TimeoutError();
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

class LruCache<V> {
  private map = new Map<string, V>();
  constructor(private max: number) {}
  get(k: string): V | undefined {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: string, v: V) {
    this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }
}

// ── Place search / reverse geocoding (Photon) ───────────────────────────────

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

function featureToPlace(f: PhotonFeature): GeoPlace | null {
  const [lng, lat] = f.geometry?.coordinates ?? [];
  if (!isValidLatLng({ lat, lng })) return null;
  const p = f.properties ?? {};
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const name = p.name || street || p.locality || p.district || p.city || 'Pinned location';
  const parts = [
    p.name && street ? street : '',
    p.locality,
    p.district,
    p.city,
    p.state,
    p.postcode,
  ].filter((x, i, arr): x is string => !!x && x !== name && arr.indexOf(x) === i);
  const type: PlaceType = p.osm_value === 'aerodrome' || /airport/i.test(name) ? 'airport' : 'other';
  return {
    id: `osm-${p.osm_type ?? 'x'}${p.osm_id ?? `${lat.toFixed(5)},${lng.toFixed(5)}`}`,
    name,
    address: parts.join(', ') || name,
    type,
    lat,
    lng,
  };
}

const searchCache = new LruCache<GeoPlace[]>(60);

export async function searchPlaces(query: string, near?: LatLng | null, signal?: AbortSignal): Promise<GeoPlace[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const bias = near ? `&lat=${near.lat.toFixed(3)}&lon=${near.lng.toFixed(3)}` : '';
  const key = `${q.toLowerCase()}|${bias}`;
  const cached = searchCache.get(key);
  if (cached) return cached;
  const url = `${GEOCODER_URL}/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&bbox=${INDIA_BBOX}${bias}`;
  const data = await fetchJson<{ features?: PhotonFeature[] }>(url, signal);
  const seen = new Set<string>();
  const results = (data.features ?? [])
    .map(featureToPlace)
    .filter((p): p is GeoPlace => {
      if (!p) return false;
      const k = `${p.name}|${p.address}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  searchCache.set(key, results);
  return results;
}

const reverseCache = new LruCache<GeoPlace>(60);

/** Never throws: falls back to a coordinate label if the geocoder is down. */
export async function reverseGeocode(p: LatLng, signal?: AbortSignal): Promise<GeoPlace> {
  const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
  const cached = reverseCache.get(key);
  if (cached) return { ...cached, lat: p.lat, lng: p.lng };
  const fallback: GeoPlace = {
    id: `pin-${key}`,
    name: 'Pinned location',
    address: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
    type: 'other',
    lat: p.lat,
    lng: p.lng,
  };
  try {
    const data = await fetchJson<{ features?: PhotonFeature[] }>(
      `${GEOCODER_URL}/reverse?lat=${p.lat}&lon=${p.lng}&lang=en&limit=1`,
      signal,
      6000,
    );
    const f = data.features?.[0];
    const place = f ? featureToPlace(f) : null;
    if (!place) return fallback;
    // Keep the exact pin position; the geocoder snaps to the nearest feature.
    const result = { ...place, id: `pin-${key}`, lat: p.lat, lng: p.lng };
    reverseCache.set(key, result);
    return result;
  } catch (err) {
    if (signal?.aborted) throw err;
    return fallback;
  }
}

// ── Routing (OSRM) ──────────────────────────────────────────────────────────

const routeCache = new LruCache<RouteInfo>(40);

export function estimateRoute(from: LatLng, to: LatLng): RouteInfo {
  const distanceKm = haversineKm(from, to) * ROAD_FACTOR;
  return {
    distanceKm,
    durationMin: (distanceKm / AVG_CITY_SPEED_KMPH) * 60,
    path: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    estimated: true,
  };
}

/** Never throws (except on abort): falls back to `estimateRoute`. */
export async function getRoute(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<RouteInfo> {
  const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const cached = routeCache.get(key);
  if (cached) return cached;
  try {
    const url =
      `${ROUTING_URL}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson&alternatives=false&steps=false`;
    const data = await fetchJson<{
      code: string;
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    }>(url, signal, 10000);
    const r = data.code === 'Ok' ? data.routes?.[0] : undefined;
    if (!r) throw new Error(`OSRM: ${data.code}`);
    const info: RouteInfo = {
      distanceKm: r.distance / 1000,
      durationMin: r.duration / 60,
      path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
      estimated: false,
    };
    routeCache.set(key, info);
    return info;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('[geo] routing unavailable, using straight-line estimate:', err);
    return estimateRoute(from, to);
  }
}
