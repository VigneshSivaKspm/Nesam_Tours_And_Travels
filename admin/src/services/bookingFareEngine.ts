/**
 * Customer booking fare engine — an exact mirror of the authoritative server
 * policy in functions/src/domain/pricing.ts (calculateFare / mapCategory).
 * Customer app & web bookings are priced by the server from vehicle
 * category fares only; this module lets admins preview those prices.
 * tests/firestore-rules/admin.test.mjs checks both produce identical results.
 */
import type { VehicleCategory } from "../types";

export const BOOKING_GST_RATE = 0.05;
const NIGHT_END_HOUR = 6;
const NIGHT_START_HOUR = 22;
export const OUTSTATION_THRESHOLD_KM = 40;

export interface EngineCategory {
  id: string;
  name: string;
  fare: {
    baseFare: number;
    baseKm: number;
    perKmRate: number;
    perMinuteRate: number;
    minimumFare: number;
    nightCharge: number;
    driverAllowance: number;
    outstationPerKmRate?: number;
  };
}

export interface BookingFareBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  nightCharge: number;
  driverAllowance: number;
  minimumFareAdjustment: number;
  subtotal: number;
  discount: number;
  taxableAmount: number;
  gstRate: number;
  gst: number;
  total: number;
  distanceKm: number;
  durationMin: number;
  perKmRate: number;
  perMinuteRate: number;
}

const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Same mapping as the server; null = the server skips the category (no per-km rate). */
export function toEngineCategory(c: VehicleCategory): EngineCategory | null {
  const f = (c.fare || {}) as unknown as Record<string, unknown>;
  const perKmRate = num(f.perKmRate);
  if (!c.name || perKmRate <= 0) return null;
  const waitingPerHour = num(f.waitingChargePerHour);
  return {
    id: c.id,
    name: c.name,
    fare: {
      baseFare: num(f.baseFare),
      baseKm: num(f.baseKm),
      perKmRate,
      perMinuteRate: f.perMinuteRate != null ? num(f.perMinuteRate) : waitingPerHour > 0 ? waitingPerHour / 60 : 0,
      minimumFare: num(f.minimumFare),
      nightCharge: num(f.nightAllowance),
      driverAllowance: num(f.outstationDriverBattaPerDay) || num(f.driverAllowance),
      outstationPerKmRate: num(f.outstationPerKmRate) || undefined,
    },
  };
}

export const isOutstation = (oneWayKm: number) => oneWayKm > OUTSTATION_THRESHOLD_KM;

export function isNightPickup(d: Date): boolean {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(d));
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
}

export function calculateBookingFare(input: {
  category: EngineCategory;
  distanceKm: number;
  durationMin: number;
  tripType: "One Way" | "Round Trip";
  pickupTime: Date;
  discount?: number;
}): BookingFareBreakdown {
  const { category, tripType, pickupTime, discount = 0 } = input;
  const f = category.fare;
  const legs = tripType === "Round Trip" ? 2 : 1;
  const km = input.distanceKm * legs;
  const minutes = input.durationMin * legs;
  const outstation = isOutstation(input.distanceKm);
  const perKmRate = outstation && f.outstationPerKmRate ? f.outstationPerKmRate : f.perKmRate;
  const perMinuteRate = outstation ? 0 : f.perMinuteRate;
  const baseFare = Math.round(f.baseFare);
  const distanceFare = Math.round(Math.max(0, km - f.baseKm) * perKmRate);
  const timeFare = Math.round(minutes * perMinuteRate);
  const nightCharge = isNightPickup(pickupTime) ? Math.round(f.nightCharge) : 0;
  const driverAllowance = outstation ? Math.round(f.driverAllowance * Math.max(1, Math.ceil(minutes / 720))) : 0;
  const raw = baseFare + distanceFare + timeFare + nightCharge + driverAllowance;
  const minimumFareAdjustment = Math.max(0, Math.round(f.minimumFare) - raw);
  const subtotal = raw + minimumFareAdjustment;
  const appliedDiscount = Math.min(Math.max(0, Math.round(discount)), subtotal);
  const taxableAmount = subtotal - appliedDiscount;
  const gst = Math.round(taxableAmount * BOOKING_GST_RATE);
  return {
    baseFare,
    distanceFare,
    timeFare,
    nightCharge,
    driverAllowance,
    minimumFareAdjustment,
    subtotal,
    discount: appliedDiscount,
    taxableAmount,
    gstRate: BOOKING_GST_RATE,
    gst,
    total: taxableAmount + gst,
    distanceKm: Math.round(km * 10) / 10,
    durationMin: Math.round(minutes),
    perKmRate,
    perMinuteRate,
  };
}
