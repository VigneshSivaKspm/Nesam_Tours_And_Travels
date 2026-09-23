import { VendorProfile, FleetVehicle, OpenTrip, VendorTrip } from '../types/vendor';

export const MOCK_VENDOR_PROFILE: VendorProfile = {
  companyName: 'Nesam Express Fleet Services',
  gstin: '33AAACN9042K1Z8',
  phone: '+91 98401 55667',
  fleetCount: 12,
  driverCount: 10
};

export const MOCK_VEHICLES: FleetVehicle[] = [
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

export const MOCK_OPEN_TRIPS: OpenTrip[] = [
  {
    id: 'OT1',
    bookingId: 'NESAM-BK-8821',
    route: 'Chennai to Puducherry Package',
    travelDate: 'Tomorrow, 07:00 AM',
    vehicleCategory: 'Sedan',
    offeredPayout: 4200
  },
  {
    id: 'OT2',
    bookingId: 'NESAM-BK-8835',
    route: 'Chennai Airport to Tirupati Pilgrimage',
    travelDate: '27 Aug, 09:30 AM',
    vehicleCategory: 'SUV',
    offeredPayout: 8500
  }
];

export const MOCK_ACTIVE_TRIPS: VendorTrip[] = [
  {
    id: 'VT1',
    bookingId: 'NESAM-BK-4082',
    customerName: 'Senthil Nathan',
    route: 'Chennai Airport to Guindy',
    driverName: 'Muthu Kumar',
    vehicleNumber: 'TN 09 BX 4821',
    vendorPayout: 702,
    status: 'In Progress'
  }
];
