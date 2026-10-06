// ── External map services (all overridable per environment) ────────────────
// Defaults are the public community endpoints, which are fine for development
// and light traffic. For production volume point these at a self-hosted or
// commercial instance (Photon/OSRM are open source; MapTiler/Stadia offer
// hosted tiles) — no code change needed.
export const MAP_TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const GEOCODER_URL = (import.meta.env.VITE_GEOCODER_URL || 'https://photon.komoot.io').replace(/\/$/, '');
export const ROUTING_URL = (import.meta.env.VITE_ROUTING_URL || 'https://router.project-osrm.org').replace(/\/$/, '');

/** Optional company UPI VPA — enables a "Pay via UPI app" deep link on the receipt. */
export const COMPANY_UPI_ID: string = import.meta.env.VITE_COMPANY_UPI_ID || '';
export const COMPANY_NAME = 'NESAM Tours & Travels';

// Search results are restricted to India (lon/lat bounding box).
export const INDIA_BBOX = '68.1,6.5,97.4,35.7';
/** Map centre used until the device location is known (Theni, head office). */
export const DEFAULT_CENTER = { lat: 10.0104, lng: 77.4768 };

// ── Contacts ────────────────────────────────────────────────────────────────
export const SUPPORT_PHONE = '+918531970197';
export const SUPPORT_PHONE_DISPLAY = '85319 70197';
export const EMERGENCY_NUMBER = '112';

// ── Pricing policy ──────────────────────────────────────────────────────────
export const GST_RATE = 0.05; // passenger transport services (no ITC)
/** Trips longer than this (one way) are outstation: driver allowance applies. */
export const OUTSTATION_THRESHOLD_KM = 40;
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;

// ── Dispatch & tracking ─────────────────────────────────────────────────────
export const NEARBY_RADIUS_KM = 10;
export const PRESENCE_STALE_MS = 3 * 60 * 1000;
export const AVG_CITY_SPEED_KMPH = 24;
/** After this long without a driver, offer the rider options. */
export const SEARCH_SLOW_AFTER_MS = 3 * 60 * 1000;
/** An instant request nobody accepts is withdrawn after this long. */
export const SEARCH_GIVE_UP_AFTER_MS = 10 * 60 * 1000;
/** Earliest / latest schedulable pickup. */
export const SCHEDULE_MIN_LEAD_MIN = 30;
export const SCHEDULE_MAX_DAYS = 30;

// ── Cancellation policy ─────────────────────────────────────────────────────
/** Free cancellation window after a driver is assigned (instant rides). */
export const FREE_CANCEL_AFTER_ASSIGN_MS = 3 * 60 * 1000;
export const INSTANT_CANCELLATION_FEE = 50;
/** Scheduled rides are free to cancel until this long before pickup. */
export const SCHEDULED_FREE_CANCEL_BEFORE_MS = 60 * 60 * 1000;
export const SCHEDULED_CANCELLATION_FEE = 100;

export const CANCEL_REASONS = [
  'Driver is taking too long',
  'Driver asked me to cancel',
  'Changed my plans',
  'Booked by mistake',
  'Wrong pickup location',
  'Found another ride',
  'Other',
];
