export type DriverStatus = 'Offline' | 'Online' | 'On-Duty' | 'Assigned Trip' | 'On Trip';

export type DocumentStatus = 'Pending' | 'Approved' | 'Rejected' | 'Needs Correction';

export interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  photoUrl: string;
  address: string;
  emergencyContact: string;
  rating: number;
  totalTrips: number;
  joiningDate: string;
  vendorId?: string;
  vendorName?: string;
}

export interface DrivingLicense {
  number: string;
  expiryDate: string;
  frontPhotoUrl?: string;
  backPhotoUrl?: string;
  status: DocumentStatus;
}

export interface VehicleDetails {
  vehicleNumber: string;
  vehicleType: 'Sedan' | 'SUV' | 'Mini' | 'Luxury' | 'Tempo Traveller';
  make: string;
  model: string;
  year: string;
  capacity: number;
  color: string;
  rcNumber: string;
  rcDocUrl?: string;
  insuranceNumber: string;
  insuranceExpiry: string;
  insuranceDocUrl?: string;
  fitnessExpiry: string;
  fitnessDocUrl?: string;
  statePermitNumber: string;
  statePermitDocUrl?: string;
  status: DocumentStatus;
}

export interface PreTripVerification {
  id: string;
  tripId: string;
  timestamp: string;
  driverSelfieUrl?: string;
  vehicleFrontPhotoUrl?: string;
  odometerPhotoUrl?: string;
  odometerReading: number;
  rearSeatPhotoUrl?: string;
  verifiedBySystem: boolean;
  status: 'Pending' | 'Passed' | 'Rejected';
}

export type TripStatus =
  | 'Assigned'
  | 'Pre-Trip Pending'
  | 'En Route Pickup'
  | 'Reached Pickup'
  | 'Boarding Verification'
  | 'In Progress'
  | 'Arrived Destination'
  | 'Completed'
  | 'Cancelled';

export interface TripLocation {
  address: string;
  lat: number;
  lng: number;
  landMark?: string;
}

export interface TollReceipt {
  id: string;
  name: string;
  amount: number;
  receiptPhotoUrl: string;
  uploadedAt: string;
}

export interface TripDetails {
  id: string;
  bookingId: string;
  customerName: string;
  customerPhone: string;
  pickup: TripLocation;
  drop: TripLocation;
  pickupDistanceKm: number;
  distanceKm: number;
  estimatedTimeMin: number;
  vehicleType: string;
  fareAmount: number;
  driverEarnings: number;
  platformCommission: number;
  tollCharges: number;
  customerOTP: string;
  status: TripStatus;
  scheduledTime: string;
  startOdometer?: number;
  endOdometer?: number;
  preTripVerification?: PreTripVerification;
  tolls?: TollReceipt[];
  paymentMode: 'Cash' | 'Online Wallet' | 'Razorpay';
}

export interface DriverEarningsSummary {
  todayEarnings: number;
  thisWeekEarnings: number;
  thisMonthEarnings: number;
  lifetimeEarnings: number;
  totalTripsCompleted: number;
  acceptanceRate: number;
  completionRate: number;
  platformFeeRate: number; // e.g. 10%
}

export interface WalletDetails {
  availableBalance: number;
  pendingBalance: number;
  totalPayouts: number;
  upiId?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
}

export interface PayoutRequest {
  id: string;
  amount: number;
  requestedAt: string;
  processedAt?: string;
  payoutMethod: 'UPI' | 'Bank Transfer';
  targetDetails: string;
  status: 'Pending' | 'Approved' | 'Completed' | 'Rejected';
}

export interface TransactionRecord {
  id: string;
  tripId?: string;
  type: 'Trip Earnings' | 'Platform Fee' | 'Toll Reimbursement' | 'Payout Withdrawal' | 'Bonus';
  amount: number;
  isCredit: boolean;
  timestamp: string;
  description: string;
  status: 'Success' | 'Processing' | 'Failed';
}
