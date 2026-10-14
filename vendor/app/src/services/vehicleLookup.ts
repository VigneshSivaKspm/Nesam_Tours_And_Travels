// Automatic vehicle detection: asks the server (which holds the VAHAN provider
// key) to look the registration number up. The app never talks to the register
// itself and never sees the raw provider response.
import { callFunction } from './callables';
import type { FleetVehicleDoc } from '../types/vendor';

export interface DetectedVehicle {
  registrationNumber: string;
  make: string;
  model: string;
  variant: string;
  fuelType: string;
  /** RC seating capacity; includes the driver's seat. */
  seatingCapacity: number;
  passengerSeats: number;
  seatClass: string;
  manufactureYear: string;
  colour: string;
  usage: 'commercial' | 'private' | 'unknown';
  registrationStatus: string;
  registrationActive: boolean | null;
  ownerNameMasked: string;
  category: 'Hatchback' | 'Sedan' | 'SUV' | 'Premium SUV' | 'Tempo Traveller';
  specClass: string;
  validity: { fitnessUpto: string; insuranceUpto: string; permitUpto: string; taxUpto: string; pucUpto: string };
}

export type VehicleLookupResult =
  | { status: 'found'; registrationNumber: string; vehicle: DetectedVehicle; issues: { code: string; message: string }[]; duplicate: boolean; fetchedAtMs: number; source: string }
  | { status: 'not_found' | 'not_configured' | 'unavailable'; registrationNumber: string };

export async function lookupVehicle(registrationNumber: string): Promise<VehicleLookupResult> {
  return callFunction<{ registrationNumber: string }, VehicleLookupResult>('lookupVehicleByRegistration', { registrationNumber }, 45000);
}

/** Fills a fleet vehicle from the register; dates are prefilled only while still in the future. */
export function applyDetection(v: FleetVehicleDoc, r: Extract<VehicleLookupResult, { status: 'found' }>, today: string): FleetVehicleDoc {
  const usable = (iso: string) => (iso && iso > today ? iso : '');
  const d = r.vehicle;
  return {
    ...v,
    registrationNumber: r.registrationNumber,
    source: 'vahan',
    category: d.category,
    make: d.make,
    model: [d.model, d.variant].filter(Boolean).join(' ').trim() || d.model,
    fuelType: d.fuelType,
    passengerSeats: d.passengerSeats,
    seatClass: d.seatClass,
    year: d.manufactureYear,
    issues: r.issues.map((i) => i.code),
    insuranceUpto: usable(d.validity.insuranceUpto) || v.insuranceUpto,
    fitnessUpto: usable(d.validity.fitnessUpto) || v.fitnessUpto,
    permitUpto: usable(d.validity.permitUpto) || v.permitUpto,
  };
}
