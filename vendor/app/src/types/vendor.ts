export interface VendorProfile {
  companyName: string;
  gstin: string;
  phone: string;
  fleetCount: number;
  driverCount: number;
}

export interface FleetVehicle {
  id: string;
  vehicleNumber: string;
  category: string;
  makeModel: string;
  assignedDriver: string;
  status: 'Active' | 'On Trip' | 'Maintenance';
}

export interface OpenTrip {
  id: string;
  bookingId: string;
  route: string;
  travelDate: string;
  vehicleCategory: string;
  offeredPayout: number;
}

export interface VendorTrip {
  id: string;
  bookingId: string;
  customerName: string;
  route: string;
  driverName: string;
  vehicleNumber: string;
  vendorPayout: number;
  status: string;
}
