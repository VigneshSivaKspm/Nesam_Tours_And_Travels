// Operational (post-approval) types for the Vendor app. The Vendor Web
// dashboard types in ./vendor.ts carried mock-oriented unions; these mirror
// the documents firestore.rules actually governs.

export interface MarketTrip {
  id: string;
  bookingId: string;
  route: string;
  pickup: { address: string; city: string; time: string };
  drop: { address: string; city: string };
  travelDate: string;
  service: string;
  tripType: string;
  vehicleCategory: string;
  distanceKm: number;
  offeredPayout: number;
  status: string;
  bidCount: number;
  createdMs: number;
}

export type BidStatus = 'Pending Review' | 'Accepted' | 'Rejected' | 'Outbid' | string;

export interface VendorBid {
  id: string;
  tripId: string;
  bookingId: string;
  offeredPayout: number;
  vendorCounterRate: number;
  biddingNote: string;
  status: BidStatus;
  submittedAt: Date | null;
}

export interface VendorBooking {
  id: string;
  bookingId: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropAddress: string;
  date: string;
  time: string;
  vehicleCategory: string;
  status: string;
  tripStage: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  vehicleNumber: string;
  fare: number;
  /** The agreed fleet payout recorded on the booking; 0 when none is recorded (see payoutRecorded). */
  vendorPayout: number;
  payoutRecorded: boolean;
  /** true once NESAM finance finalized the trip; vendorPayout is then the finalized amount. */
  payoutFinalized: boolean;
  tollCharges: number;
  paymentMethod: string;
  confirmedAt: Date | null;
  completedAt: Date | null;
}

export type VehicleStatus = 'Active' | 'Maintenance' | 'Inactive';
export type ReviewStatus = 'Pending' | 'Approved' | 'Rejected';

export interface FleetVehicle {
  id: string;
  vehicleNumber: string;
  category: string;
  make: string;
  model: string;
  year: string;
  seatingCapacity: number;
  fuelType: string;
  status: VehicleStatus;
  docStatus: ReviewStatus;
  rejectionReason: string;
  assignedDriverId: string;
  assignedDriverName: string;
  rcNumber: string;
  rcDocUrl: string;
  insuranceExpiry: string;
  insuranceDocUrl: string;
  fitnessExpiry: string;
  fitnessDocUrl: string;
  permitExpiry: string;
  statePermitDocUrl: string;
}

export interface FleetDriver {
  id: string;
  name: string;
  phone: string;
  photoUrl: string;
  approvalStatus: string;
  presenceStatus: string;
  fleetStatus: 'Active' | 'Suspended';
  licenseNumber: string;
  licenseExpiry: string;
  vehicleType: string;
  ownVehicleNumber: string;
  assignedVehicleId: string;
  assignedVehicleNumber: string;
  rating: number;
  docStatus: string;
}

export interface DriverInviteRecord {
  phone: string;
  name: string;
  vehicleAssignment: string;
  createdAt: Date | null;
}

export interface VendorPayoutRequest {
  id: string;
  amount: number;
  method: 'UPI' | 'Bank Transfer';
  details: string;
  status: string;
  requestedAt: string;
  utr: string;
  processedAt: string;
  createdMs: number;
}

/** wallets/vendor_{uid}, written only by the server (functions/src/ledger.ts). */
export interface WalletDetails {
  /** Withdrawable now; negative when cash collected exceeds earnings. */
  available: number;
  /** Earnings on trips whose customer payment is not verified yet. */
  pending: number;
  /** Held for open payout requests. */
  reserved: number;
  paidOut: number;
  cashCollected: number;
  tripEarnings: number;
  tollReimbursements: number;
}

/** wallet_ledger entry (schema 2) for this vendor. */
export interface LedgerRecord {
  id: string;
  type: string;
  direction: 'credit' | 'debit';
  amount: number;
  status: string;
  bookingCode: string;
  createdAt: Date | null;
}
