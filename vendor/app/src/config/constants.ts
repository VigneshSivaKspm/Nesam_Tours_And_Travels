import { VendorProfile, FleetVehicle, OpenTrip, VendorTrip } from '../types/vendor';

export const DEFAULT_VENDOR_PROFILE: VendorProfile = {
  companyName: 'Nesam Express Fleet Services',
  gstin: '33AAACN9042K1Z8',
  phone: '+91 98401 55667',
  fleetCount: 12,
  driverCount: 10
};

export const DEFAULT_VEHICLES: FleetVehicle[] = [
  {
    id: 'V1',
    vehicleNumber: 'TN 09 BX 4821',
    category: 'Sedan',
    makeModel: 'Maruti Suzuki Dzire',
    assignedDriver: 'Muthu Kumar',
    status: 'On Trip'
  },
  {
    id: 'V2',
    vehicleNumber: 'TN 01 CV 9820',
    category: 'SUV',
    makeModel: 'Toyota Innova Crysta',
    assignedDriver: 'Karthik Raja',
    status: 'Active'
  }
];

export const DEFAULT_OPEN_TRIPS: OpenTrip[] = [];
export const DEFAULT_ACTIVE_TRIPS: VendorTrip[] = [];
