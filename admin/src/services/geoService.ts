/**
 * Place search (autocomplete) and reverse geocoding for the admin map picker.
 * Uses the same open Photon / OpenStreetMap services as the customer app, so no
 * API key is needed. Endpoints are overridable per environment for production
 * volume (VITE_GEOCODER_URL, VITE_MAP_TILE_URL).
 */
export const GEOCODER_URL = ((import.meta.env.VITE_GEOCODER_URL as string | undefined) || "https://photon.komoot.io").replace(/\/$/, "");
export const MAP_TILE_URL = (import.meta.env.VITE_MAP_TILE_URL as string | undefined) || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const MAP_ATTRIBUTION =
  (import.meta.env.VITE_MAP_ATTRIBUTION as string | undefined) || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
/** Search results are limited to India (lon/lat bounding box). */
export const INDIA_BBOX = "68.1,6.5,97.4,35.7";
/** Map centre until a point is chosen (head office, Theni). */
export const DEFAULT_CENTER = { lat: 10.0104, lng: 77.4768 };

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlaceResult extends LatLng {
  id: string;
  name: string;
  address: string;
  type: "airport" | "other";
}

export const inIndia = (p: LatLng) =>
  Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= 6.5 && p.lat <= 35.7 && p.lng >= 68.1 && p.lng <= 97.4;

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | number | undefined>;
}

function featureToPlace(f: PhotonFeature): PlaceResult | null {
  const [lng, lat] = f.geometry?.coordinates ?? [];
  if (typeof lat !== "number" || typeof lng !== "number" || !inIndia({ lat, lng })) return null;
  const p = f.properties ?? {};
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  const street = [s("housenumber"), s("street")].filter(Boolean).join(" ");
  const name = s("name") || street || s("locality") || s("district") || s("city") || "Pinned location";
  const parts = [s("name") && street ? street : "", s("locality"), s("district"), s("city"), s("state"), s("postcode")].filter(
    (x, i, arr) => !!x && x !== name && arr.indexOf(x) === i,
  );
  return {
    id: `osm-${p.osm_type ?? "x"}${p.osm_id ?? `${lat.toFixed(5)},${lng.toFixed(5)}`}`,
    name,
    address: [name, ...parts].join(", "),
    type: s("osm_value") === "aerodrome" || /airport/i.test(name) ? "airport" : "other",
    lat,
    lng,
  };
}

async function getJson<T>(url: string, signal?: AbortSignal, timeoutMs = 8000): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!res.ok) throw new Error(`Geocoder returned ${res.status}`);
  return (await res.json()) as T;
}

/** Autocomplete suggestions for a typed address (3+ characters), biased towards `near`. */
export async function searchPlaces(query: string, near?: LatLng | null, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const bias = near ? `&lat=${near.lat.toFixed(3)}&lon=${near.lng.toFixed(3)}` : "";
  const data = await getJson<{ features?: PhotonFeature[] }>(`${GEOCODER_URL}/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&bbox=${INDIA_BBOX}${bias}`, signal);
  const seen = new Set<string>();
  return (data.features ?? [])
    .map(featureToPlace)
    .filter((p): p is PlaceResult => {
      if (!p) return false;
      const k = `${p.name}|${p.address}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/** Address for a point. Never throws: when the geocoder is unreachable the coordinates are the label. */
export async function reverseGeocode(p: LatLng, signal?: AbortSignal): Promise<{ name: string; address: string; resolved: boolean }> {
  const coords = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  try {
    const data = await getJson<{ features?: PhotonFeature[] }>(`${GEOCODER_URL}/reverse?lat=${p.lat}&lon=${p.lng}&lang=en&limit=1`, signal, 6000);
    const place = data.features?.[0] ? featureToPlace(data.features[0]) : null;
    if (place) return { name: place.name, address: place.address, resolved: true };
  } catch (err) {
    if (signal?.aborted) throw err;
  }
  return { name: "Pinned location", address: coords, resolved: false };
}
