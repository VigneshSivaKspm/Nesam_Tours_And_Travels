export interface CustomerProfile {
  name: string;
  phone: string;
  email: string;
  photoUrl: string;
  walletBalance: number;
  emergencyContact: string;
}

export interface VehicleCategory {
  id: string;
  name: string;
  passengers: number;
  luggage: number;
  ratePerKm: number;
  baseFare: number;
  image: string;
}

export interface TripRecord {
  bookingId: string;
  pickup: string;
  drop: string;
  serviceType: string;
  date: string;
  time: string;
  fare: number;
  status: 'Confirmed' | 'Driver Assigned' | 'Trip Started' | 'Completed' | 'Cancelled';
  driverName?: string;
  vehicleNo?: string;
  otp?: string;
}
