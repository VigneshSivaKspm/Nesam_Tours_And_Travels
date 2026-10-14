// Fleet documentation helpers (spec page 13): plate handling, per-vehicle
// validation and the FleetDetails the application stores. Pure, no I/O.
// Mirrored in vendor/web/src/utils/fleet.ts.
import type { FleetDetails, FleetVehicleDoc } from '../types';

/** Plate as printed, with or without spaces/hyphens. */
export const normalizePlate = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const isPlate = (v: string) => {
  const n = normalizePlate(v);
  return (n.length >= 6 && /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(n)) || /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(n);
};

/** Today in India (YYYY-MM-DD); document validity is a calendar-day matter. */
export function indiaToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export const emptyVehicle = (): FleetVehicleDoc => ({
  registrationNumber: '',
  source: 'manual',
  category: '',
  make: '',
  model: '',
  fuelType: '',
  passengerSeats: 0,
  seatClass: '',
  year: '',
  issues: [],
  insuranceUpto: '',
  fitnessUpto: '',
  permitUpto: '',
  rcFiles: [],
  insuranceFiles: [],
  fitnessFiles: [],
  permitFiles: [],
  frontPhotoFiles: [],
});

export type VehicleErrors = Partial<Record<'registrationNumber' | 'category' | 'rcFiles' | 'insuranceFiles' | 'insuranceUpto' | 'fitnessFiles' | 'fitnessUpto' | 'permitFiles' | 'permitUpto' | 'frontPhotoFiles', string>>;

/**
 * What a vehicle needs before it joins the application: a detected (or, when
 * the register was unreachable, hand-typed) identity, each of RC / insurance /
 * FC / permit with an unexpired validity, and the front photo.
 * `detectedFor` is the plate the last register check was run for.
 */
export function validateVehicle(v: FleetVehicleDoc, ctx: { detectedFor: string; duplicate: boolean; notFound: boolean; others: string[]; today?: string }): VehicleErrors {
  const today = ctx.today ?? indiaToday();
  const e: VehicleErrors = {};
  const plate = normalizePlate(v.registrationNumber);
  if (!isPlate(plate)) e.registrationNumber = 'Enter a valid registration number (e.g. TN 01 AB 1234).';
  else if (ctx.others.includes(plate)) e.registrationNumber = 'This vehicle is already in your application.';
  else if (ctx.detectedFor !== plate) e.registrationNumber = 'Check the vehicle first: tap "Detect vehicle".';
  else if (ctx.notFound) e.registrationNumber = 'This registration number was not found in the vehicle register. Check it and try again.';
  else if (ctx.duplicate) e.registrationNumber = 'This vehicle is already registered with another NESAM partner. Contact NESAM support.';
  if (!v.category) e.category = 'Choose the vehicle type.';
  if (!v.rcFiles.length) e.rcFiles = 'Upload the RC.';
  if (!v.insuranceFiles.length) e.insuranceFiles = 'Upload the insurance policy.';
  if (!v.insuranceUpto) e.insuranceUpto = 'Required';
  else if (v.insuranceUpto <= today) e.insuranceUpto = 'Insurance has expired.';
  if (!v.fitnessFiles.length) e.fitnessFiles = 'Upload the fitness certificate (FC).';
  if (!v.fitnessUpto) e.fitnessUpto = 'Required';
  else if (v.fitnessUpto <= today) e.fitnessUpto = 'Fitness certificate has expired.';
  if (!v.permitFiles.length) e.permitFiles = 'Upload the permit.';
  if (!v.permitUpto) e.permitUpto = 'Required';
  else if (v.permitUpto <= today) e.permitUpto = 'Permit has expired.';
  if (!v.frontPhotoFiles.length) e.frontPhotoFiles = 'Upload the vehicle front photo.';
  return e;
}

/** The FleetDetails stored on vendors/{uid}: the vehicles plus per-document aggregates for the viewers. */
export function buildFleetDetails(vehicles: FleetVehicleDoc[]): FleetDetails {
  return {
    vehicleTypes: [...new Set(vehicles.map((v) => v.category).filter(Boolean))],
    fleetSize: vehicles.length,
    rcFiles: vehicles.flatMap((v) => v.rcFiles),
    vehiclePhotos: vehicles.flatMap((v) => v.frontPhotoFiles),
    insuranceFiles: vehicles.flatMap((v) => v.insuranceFiles),
    fcFiles: vehicles.flatMap((v) => v.fitnessFiles),
    permitFiles: vehicles.flatMap((v) => v.permitFiles),
    plates: vehicles.map((v) => normalizePlate(v.registrationNumber)),
    vehicles,
  };
}

/** True when every stored vehicle still passes (an expiry may have passed while the draft sat). */
export function fleetIsComplete(fleet: FleetDetails | null, today = indiaToday()): boolean {
  const list = fleet?.vehicles;
  if (!list?.length) return false;
  const seen = new Set<string>();
  return list.every((v) => {
    const plate = normalizePlate(v.registrationNumber);
    if (!isPlate(plate) || seen.has(plate)) return false;
    seen.add(plate);
    const e = validateVehicle(v, { detectedFor: plate, duplicate: false, notFound: false, others: [], today });
    return Object.keys(e).length === 0;
  });
}
