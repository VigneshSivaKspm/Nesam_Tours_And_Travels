export type DriverStatus = 'Offline' | 'Online' | 'On-Duty' | 'Assigned Trip' | 'On Trip';

export interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  photoUrl: string;
  vehicleNumber: string;
  vehicleModel: string;
  rating: number;
  totalTrips: number;
}

export interface TripDetails {
  id: string;
  bookingId: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropAddress: string;
  pickupDistanceKm: number;
  distanceKm: number;
  fareAmount: number;
  driverEarnings: number;
  customerOTP: string;
  status: 'Assigned' | 'Pre-Trip Pending' | 'En Route Pickup' | 'Reached Pickup' | 'In Progress' | 'Reached Destination' | 'Completed';
  startOdometer?: number;
  endOdometer?: number;
  tollAmount?: number;
}

export interface EarningsData {
  today: number;
  weekly: number;
  monthly: number;
  walletBalance: number;
}
