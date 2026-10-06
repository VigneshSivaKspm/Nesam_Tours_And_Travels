// The customer-readable fare breakup stored on every booking (`fareBreakup`).
// It is derived from the server-calculated FareBreakdown and the category's
// own configuration, so every app shows the same lines in the same words and
// never recomputes them. Each line says whether it is already in the price
// ("included") or payable separately ("extra").
import { FareBreakdown, RideCategory } from './types';

export type FareLineTreatment = 'included' | 'extra' | 'not_applicable';

export interface FareLine {
  key: string;
  label: string;
  /** Rupees. Negative for reductions. null = billed at actuals / rate only. */
  amount: number | null;
  treatment: FareLineTreatment;
  /** Human-readable rate, coverage or rule, e.g. "Includes 250 KM". */
  detail: string;
}

export interface FareBreakup {
  schema: 1;
  lines: FareLine[];
  /** What the customer pays for the package (incl. GST) — always equals fare.total. */
  packageTotal: number;
  /** Extras whose amount is known up front. Others are billed at actuals. */
  knownExtras: number;
  /** True when at least one extra is billed at actuals. */
  hasActualsExtras: boolean;
}

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function buildFareBreakup(category: RideCategory, fare: FareBreakdown, outstation: boolean): FareBreakup {
  const x = category.fare.extras;
  const lines: FareLine[] = [];
  const add = (l: FareLine) => lines.push(l);

  add({
    key: 'base', label: 'Base package', amount: fare.baseFare, treatment: 'included',
    detail: category.fare.baseKm > 0 ? `Includes ${category.fare.baseKm} KM` : 'Base fare',
  });
  add({
    key: 'distance', label: 'Distance charge', amount: fare.distanceFare, treatment: 'included',
    detail: fare.distanceFare > 0
      ? `${fare.distanceKm} KM booked at ${rupees(fare.perKmRate)}/KM beyond the included ${category.fare.baseKm} KM`
      : `${fare.distanceKm} KM booked, within the included KM`,
  });
  if (fare.timeFare > 0) add({ key: 'time', label: 'Time charge', amount: fare.timeFare, treatment: 'included', detail: `${fare.durationMin} min at ${rupees(fare.perMinuteRate)}/min` });
  if (fare.nightCharge > 0) add({ key: 'night', label: 'Night charge', amount: fare.nightCharge, treatment: 'included', detail: 'Pickup between 10:00 PM and 06:00 AM' });
  add(outstation
    ? { key: 'driverAllowance', label: 'Driver allowance', amount: fare.driverAllowance, treatment: 'included', detail: 'Outstation trip — included in the fare' }
    : { key: 'driverAllowance', label: 'Driver allowance', amount: null, treatment: 'not_applicable', detail: 'Not applicable to local trips' });
  if (fare.minimumFareAdjustment > 0) add({ key: 'minimum', label: 'Minimum fare top-up', amount: fare.minimumFareAdjustment, treatment: 'included', detail: 'Applied so the fare reaches the category minimum' });
  if (fare.globalAdjustment) {
    const a = fare.globalAdjustment;
    add({ key: 'adjustment', label: a.name || 'Fare adjustment', amount: a.amount, treatment: 'included', detail: `${a.direction === 'increase' ? '+' : '−'}${a.percent}% on the package total` });
  }
  if (fare.adminAdjustment) add({ key: 'agreed', label: 'Agreed fare adjustment', amount: fare.adminAdjustment, treatment: 'included', detail: 'Authorised by NESAM staff' });
  if (fare.discount > 0) {
    const d = fare.discountDetail;
    add({
      key: 'discount', label: 'Discount', amount: -fare.discount, treatment: 'included',
      detail: d?.type === 'percentage' ? `${d.value}% discount` : d?.type === 'fixed' ? `Flat ${rupees(d.value)} discount` : 'Promo discount',
    });
  }
  add({ key: 'gst', label: `GST (${Math.round(fare.gstRate * 100)}%)`, amount: fare.gst, treatment: 'included', detail: 'Included in the total payable' });

  // Charges outside the package.
  add({
    key: 'extraKm', label: 'Extra KM', amount: null, treatment: 'extra',
    detail: `${rupees(x?.extraKmRate ?? fare.perKmRate)} per KM beyond the ${fare.distanceKm} KM booked`,
  });
  add({
    key: 'waiting', label: 'Waiting charges', amount: null, treatment: 'extra',
    detail: x && x.waitingPerHour > 0 ? `${rupees(x.waitingPerHour)} per hour of waiting` : 'Billed at actuals',
  });
  add(x?.tollIncluded
    ? { key: 'toll', label: 'Toll', amount: null, treatment: 'included', detail: 'Included in the fare' }
    : { key: 'toll', label: 'Toll', amount: null, treatment: 'extra', detail: 'Payable separately at actuals' });
  add(x?.parkingIncluded
    ? { key: 'parking', label: 'Parking', amount: null, treatment: 'included', detail: 'Included in the fare' }
    : { key: 'parking', label: 'Parking', amount: null, treatment: 'extra', detail: 'Payable separately at actuals' });
  add(outstation
    ? { key: 'stateTax', label: 'State tax / permit', amount: x && x.permitCharge > 0 ? x.permitCharge : null, treatment: 'extra', detail: x && x.permitCharge > 0 ? 'Payable separately per trip' : 'Payable separately at actuals' }
    : { key: 'stateTax', label: 'State tax / permit', amount: null, treatment: 'not_applicable', detail: 'Not applicable to local trips' });
  if (x && x.carrierCharge > 0) add({ key: 'carrier', label: 'Carrier / luggage', amount: x.carrierCharge, treatment: 'extra', detail: 'Payable separately if a carrier is used' });

  const extras = lines.filter((l) => l.treatment === 'extra');
  return {
    schema: 1,
    lines,
    packageTotal: fare.total,
    knownExtras: extras.reduce((s, l) => s + (l.amount ?? 0), 0),
    hasActualsExtras: extras.some((l) => l.amount === null),
  };
}
