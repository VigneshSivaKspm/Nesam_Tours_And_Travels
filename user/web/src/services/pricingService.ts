// Ride categories, fare calculation and coupon validation.
//
// Categories and coupons are admin-managed (`vehicle_categories`, `coupons`).
// The fare shown here is the upfront price written to the booking; tolls the
// driver pays en route are added to the final receipt.

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';
import {
  DEFAULT_RIDE_CATEGORIES,
  GST_RATE,
  NIGHT_END_HOUR,
  NIGHT_START_HOUR,
  OUTSTATION_THRESHOLD_KM,
} from '../config/constants';
import { AppliedCoupon, Coupon, FareBreakdown, GeoPlace, RideCategory, RouteInfo, TripType } from '../types';
import { num, str } from '../utils/format';

// ── Categories ──────────────────────────────────────────────────────────────

function vehicleTypeAliases(...labels: string[]): string[] {
  const out = new Set<string>();
  for (const raw of labels) {
    const l = raw.trim().toLowerCase();
    if (!l) continue;
    out.add(l);
    if (l === 'mini' || l === 'hatchback') {
      out.add('mini');
      out.add('hatchback');
    }
    if (l === 'auto' || l === 'auto rickshaw') {
      out.add('auto');
      out.add('auto rickshaw');
    }
  }
  return [...out];
}

function mapCategory(id: string, d: Record<string, any>): RideCategory | null {
  const f = d.fare && typeof d.fare === 'object' ? d.fare : {};
  const perKmRate = num(f.perKmRate);
  if (!str(d.name) || perKmRate <= 0) return null; // unpriceable — skip
  const waitingPerHour = num(f.waitingChargePerHour);
  return {
    id,
    name: str(d.name),
    description: str(d.description),
    seats: num(d.seatingCapacity) || num(d.recommendedPassengers) || 4,
    imageUrl: str(d.imageUrl) || undefined,
    matchVehicleTypes: vehicleTypeAliases(str(d.name), str(d.code)),
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
    displayOrder: num(d.displayOrder, 99),
  };
}

/**
 * Live list of bookable categories. Emits the built-in defaults while
 * loading, if the collection is empty, or if it can't be read.
 */
export function subscribeToRideCategories(cb: (cats: RideCategory[], fromAdmin: boolean) => void): () => void {
  cb(DEFAULT_RIDE_CATEGORIES, false);
  return onSnapshot(
    query(collection(db, 'vehicle_categories'), where('status', '==', 'Active')),
    (snap) => {
      const cats = snap.docs
        .map((d) => mapCategory(d.id, d.data()))
        .filter((c): c is RideCategory => !!c)
        .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
      if (cats.length) cb(cats, true);
      else cb(DEFAULT_RIDE_CATEGORIES, false);
    },
    (err) => {
      console.warn('[pricing] vehicle_categories unavailable, using defaults:', err);
      cb(DEFAULT_RIDE_CATEGORIES, false);
    },
  );
}

export function categoryServesVehicle(cat: RideCategory, vehicleType: string): boolean {
  return cat.matchVehicleTypes.includes(vehicleType.trim().toLowerCase());
}

// ── Service classification ──────────────────────────────────────────────────

export function isOutstation(oneWayKm: number): boolean {
  return oneWayKm > OUTSTATION_THRESHOLD_KM;
}

export function serviceName(pickup: GeoPlace, drop: GeoPlace, oneWayKm: number): string {
  if (pickup.type === 'airport' || drop.type === 'airport') return 'Airport';
  return isOutstation(oneWayKm) ? 'Outstation' : 'Local';
}

export function isNightTime(d: Date): boolean {
  const h = d.getHours();
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
}

// ── Fare engine ─────────────────────────────────────────────────────────────

export interface FareInput {
  category: RideCategory;
  route: RouteInfo;
  tripType: TripType;
  pickupTime: Date;
  discount?: number;
}

export function calculateFare({ category, route, tripType, pickupTime, discount = 0 }: FareInput): FareBreakdown {
  const f = category.fare;
  const legs = tripType === 'Round Trip' ? 2 : 1;
  const km = route.distanceKm * legs;
  const minutes = route.durationMin * legs;
  const outstation = isOutstation(route.distanceKm);

  const perKmRate = outstation && f.outstationPerKmRate ? f.outstationPerKmRate : f.perKmRate;
  // Outstation trips are priced per km plus driver allowance; time isn't billed.
  const perMinuteRate = outstation ? 0 : f.perMinuteRate;

  const baseFare = Math.round(f.baseFare);
  const distanceFare = Math.round(Math.max(0, km - f.baseKm) * perKmRate);
  const timeFare = Math.round(minutes * perMinuteRate);
  const nightCharge = isNightTime(pickupTime) ? Math.round(f.nightCharge) : 0;
  // One allowance per 12 hours of driving (covers the return leg on round trips).
  const driverAllowance = outstation ? Math.round(f.driverAllowance * Math.max(1, Math.ceil(minutes / 720))) : 0;

  const raw = baseFare + distanceFare + timeFare + nightCharge + driverAllowance;
  const minimumFareAdjustment = Math.max(0, Math.round(f.minimumFare) - raw);
  const subtotal = raw + minimumFareAdjustment;
  const appliedDiscount = Math.min(Math.max(0, Math.round(discount)), subtotal);
  const taxableAmount = subtotal - appliedDiscount;
  const gst = Math.round(taxableAmount * GST_RATE);

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
    gstRate: GST_RATE,
    gst,
    total: taxableAmount + gst,
    distanceKm: Math.round(km * 10) / 10,
    durationMin: Math.round(minutes),
    perKmRate,
    perMinuteRate,
  };
}

// ── Coupons ─────────────────────────────────────────────────────────────────

function mapCoupon(id: string, d: Record<string, any>): Coupon {
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
  return {
    id,
    code: str(d.code),
    name: str(d.name),
    description: str(d.description),
    discountType: d.discountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED_AMOUNT',
    discountValue: num(d.discountValue),
    maximumDiscount: num(d.maximumDiscount),
    minimumBookingAmount: num(d.minimumBookingAmount),
    validFrom: str(d.validFrom),
    validUntil: str(d.validUntil),
    firstBookingOnly: Boolean(d.firstBookingOnly),
    vehicleCategoryIds: arr(d.vehicleCategoryIds),
    serviceNames: arr(d.serviceNames),
    totalUsageLimit: num(d.totalUsageLimit),
    usedCount: num(d.usedCount),
    perCustomerLimit: num(d.perCustomerLimit),
    status: str(d.status),
    adminBookingOnly: Boolean(d.adminBookingOnly),
  };
}

export function normalizeCode(code: string): string {
  return (code || '').trim().toUpperCase().replace(/\s+/g, '');
}

function todayIso(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isCouponLive(c: Coupon, now = new Date()): boolean {
  if (c.adminBookingOnly) return false;
  if (!['Active', 'Scheduled', ''].includes(c.status)) return false;
  const today = todayIso(now);
  if (c.validFrom && today < c.validFrom) return false;
  if (c.validUntil && today > c.validUntil) return false;
  if (c.totalUsageLimit > 0 && c.usedCount >= c.totalUsageLimit) return false;
  return true;
}

export function subscribeToCoupons(cb: (coupons: Coupon[]) => void): () => void {
  return onSnapshot(
    collection(db, 'coupons'),
    (snap) => cb(snap.docs.map((d) => mapCoupon(d.id, d.data()))),
    (err) => {
      console.warn('[pricing] coupons unavailable:', err);
      cb([]);
    },
  );
}

export interface CouponContext {
  subtotal: number;
  categoryId: string;
  service: string;
  isFirstBooking: boolean;
  /** How many of this customer's non-cancelled bookings already used the code. */
  customerUses: number;
}

export type CouponResult = { ok: true; coupon: AppliedCoupon } | { ok: false; message: string };

export function validateCoupon(coupons: Coupon[], input: string, ctx: CouponContext): CouponResult {
  const code = normalizeCode(input);
  if (!code) return { ok: false, message: 'Enter a promo code.' };
  const c = coupons.find((x) => normalizeCode(x.code) === code);
  if (!c || c.adminBookingOnly) return { ok: false, message: `“${input.trim()}” is not a valid promo code.` };

  const today = todayIso(new Date());
  if (!['Active', 'Scheduled', ''].includes(c.status)) return { ok: false, message: `${c.code} is no longer active.` };
  if (c.validFrom && today < c.validFrom) return { ok: false, message: `${c.code} starts on ${c.validFrom}.` };
  if (c.validUntil && today > c.validUntil) return { ok: false, message: `${c.code} expired on ${c.validUntil}.` };
  if (c.totalUsageLimit > 0 && c.usedCount >= c.totalUsageLimit)
    return { ok: false, message: `${c.code} has been fully redeemed.` };
  if (c.perCustomerLimit > 0 && ctx.customerUses >= c.perCustomerLimit)
    return { ok: false, message: `You have already used ${c.code} the maximum number of times.` };
  if (c.minimumBookingAmount > 0 && ctx.subtotal < c.minimumBookingAmount)
    return { ok: false, message: `${c.code} needs a minimum fare of ₹${c.minimumBookingAmount}.` };
  if (c.firstBookingOnly && !ctx.isFirstBooking) return { ok: false, message: `${c.code} is for your first ride only.` };
  if (c.vehicleCategoryIds.length && !c.vehicleCategoryIds.includes(ctx.categoryId))
    return { ok: false, message: `${c.code} isn't valid for this ride type.` };
  if (c.serviceNames.length) {
    const s = ctx.service.toLowerCase();
    const match = c.serviceNames.some((n) => {
      const x = n.toLowerCase();
      return x.includes(s) || s.includes(x);
    });
    if (!match) return { ok: false, message: `${c.code} is only valid for: ${c.serviceNames.join(', ')}.` };
  }

  let discount =
    c.discountType === 'PERCENTAGE'
      ? (ctx.subtotal * Math.min(100, Math.max(0, c.discountValue))) / 100
      : c.discountValue;
  if (c.maximumDiscount > 0) discount = Math.min(discount, c.maximumDiscount);
  discount = Math.round(Math.min(Math.max(0, discount), ctx.subtotal));
  if (discount <= 0) return { ok: false, message: `${c.code} gives no discount on this ride.` };
  return { ok: true, coupon: { code: c.code, discount, message: `${c.code} applied — you save ₹${discount}` } };
}
