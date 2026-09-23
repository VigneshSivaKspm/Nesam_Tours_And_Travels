import { DriverProfile, TripDetails, EarningsData } from '../types/driver';

export const DEFAULT_DRIVER_PROFILE: DriverProfile = {
  id: 'DRV-7892',
  name: 'Muthu Kumar',
  phone: '+91 98450 12345',
  email: 'muthu.kumar@nesamtours.com',
  photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  vehicleNumber: 'TN 09 BX 4821',
  vehicleModel: 'Maruti Suzuki Dzire Tour S',
  rating: 4.9,
  totalTrips: 342
};

export const DEFAULT_ACTIVE_TRIP: TripDetails = {
  id: 'TRIP-9904',
  bookingId: 'NESAM-BK-4082',
  customerName: 'Senthil Nathan',
  customerPhone: '+91 97910 88231',
  pickupAddress: 'Chennai International Airport Terminal 2',
  dropAddress: 'Hotel Grand Chola, Guindy, Chennai',
  pickupDistanceKm: 1.2,
  distanceKm: 14.5,
  fareAmount: 780,
  driverEarnings: 702,
  customerOTP: '482910',
  status: 'Assigned'
};

export const DEFAULT_AVAILABLE_TRIPS: TripDetails[] = [];

export const DEFAULT_EARNINGS: EarningsData = {
  today: 2450,
  weekly: 14820,
  monthly: 58400,
  walletBalance: 4250
};
