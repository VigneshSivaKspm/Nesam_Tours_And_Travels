export type VerificationStatus = 'Pending' | 'Approved' | 'Rejected' | 'Needs Correction';

export interface VendorProfile {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  gstin: string;
  panNumber: string;
  address: string;
  city: string;
  totalFleetSize: number;
  totalDriversCount: number;
  verificationStatus: VerificationStatus;
  joinedDate: string;
  bankAccountName: string;
  bankAccountNumber: string;
  ifscCode: string;
  upiId: string;
}

export interface FleetVehicle {
  id: string;
  vehicleNumber: string;
  category: 'Sedan' | 'SUV' | 'Mini' | 'Luxury' | 'Tempo Traveller';
  make: string;
  model: string;
  year: string;
  seatingCapacity: number;
  status: 'Active' | 'On Trip' | 'Maintenance' | 'Inactive';
  assignedDriverId?: string;
  assignedDriverName?: string;
  rcDocUrl?: string;
  insuranceDocUrl?: string;
  fitnessDocUrl?: string;
  statePermitDocUrl?: string;
  docStatus: VerificationStatus;
}

export interface FleetDriver {
  id: string;
  name: string;
  phone: string;
  email: string;
  photoUrl: string;
  licenseNumber: string;
  licenseExpiry: string;
  licenseFrontUrl?: string;
  licenseBackUrl?: string;
  status: 'Available' | 'On Trip' | 'Offline' | 'Suspended';
  assignedVehicleNumber?: string;
  rating: number;
  totalTrips: number;
  docStatus: VerificationStatus;
}

export interface OpenTrip {
  id: string;
  bookingId: string;
  route: string;
  pickup: {
    address: string;
    city: string;
    time: string;
  };
  drop: {
    address: string;
    city: string;
  };
  travelDate: string;
  vehicleCategory: 'Sedan' | 'SUV' | 'Mini' | 'Luxury' | 'Tempo Traveller';
  distanceKm: number;
  offeredPayout: number; // Customer/Platform offered payout
  status: 'Open' | 'Bidding' | 'Assigned' | 'Cancelled';
}

export interface BidProposal {
  id: string;
  tripId: string;
  bookingId: string;
  offeredPayout: number;
  vendorCounterRate: number; // Proposed payout
  biddingNote?: string;
  submittedAt: string;
  status: 'Pending Review' | 'Accepted' | 'Rejected' | 'Outbid';
}

export interface VendorTrip {
  id: string;
  bookingId: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropAddress: string;
  scheduledTime: string;
  vehicleNumber: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  grossFare: number;
  platformFee: number; // 10%
  vendorPayout: number;
  status: 'Assigned' | 'En Route Pickup' | 'Reached Pickup' | 'In Progress' | 'Completed' | 'Cancelled';
}

export interface WalletDetails {
  availableBalance: number;
  pendingBalance: number;
  lifetimeEarnings: number;
  upiId: string;
  bankAccountName: string;
  bankAccountNumber: string;
  ifscCode: string;
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
  type: 'Trip Revenue' | 'Platform Fee' | 'Payout Withdrawal';
  amount: number;
  isCredit: boolean;
  timestamp: string;
  description: string;
  status: 'Success' | 'Processing' | 'Failed';
}
