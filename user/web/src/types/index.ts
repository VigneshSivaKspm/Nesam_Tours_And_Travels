export interface UserProfile {
  uid: string;
  name: string;
  phone: string;
  email: string;
  photoUrl: string;
  walletBalance: number;
  emergencyContact: string;
  language: string;
}

export interface LocationItem {
  id: string;
  name: string;
  address: string;
  type: 'home' | 'work' | 'favorite' | 'recent' | 'airport' | 'other';
  lat?: number;
  lng?: number;
}

export interface VehicleOption {
  id: string;
  name: string;
  category: 'Hatchback' | 'Sedan' | 'SUV' | 'Premium SUV' | 'Tempo Traveller';
  passengers: number;
  luggage: number;
  basePrice: number;
  perKmRate: number;
  image: string;
  tagline: string;
  eta: string;
}

export interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  rating: number;
  tripsCount: number;
  vehicleName: string;
  vehicleNumber: string;
  photoUrl: string;
  verified: boolean;
  currentLat: number;
  currentLng: number;
}

export interface TripRecord {
  id: string;
  bookingId: string;
  pickup: LocationItem;
  drop: LocationItem;
  tripType: 'One Way' | 'Round Trip' | 'Local' | 'Airport' | 'Outstation';
  date: string;
  time: string;
  vehicle: VehicleOption;
  driver?: DriverInfo;
  fare: number;
  status: 'Confirmed' | 'Driver Assigned' | 'Driver Near Pickup' | 'Driver Arrived' | 'Trip Started' | 'Completed' | 'Cancelled' | 'Pending';
  paymentStatus: 'Paid' | 'Pending' | 'Refunded';
  paymentMethod: string;
  distanceKm: number;
  duration: string;
  otp?: string;
  rating?: number;
  reviewComment?: string;
  passengerName?: string;
  passengerPhone?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  category: 'Bookings' | 'Driver' | 'Payments' | 'Offers' | 'Support' | 'System';
  read: boolean;
}

export interface SupportTicket {
  id: string;
  category: string;
  bookingId?: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  createdAt: string;
}

export interface CouponOffer {
  code: string;
  discount: string;
  desc: string;
  validTill: string;
  minFare: number;
  category: 'Airport' | 'Outstation' | 'Local' | 'All';
  highlight?: boolean;
}
