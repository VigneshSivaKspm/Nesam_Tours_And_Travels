// Driver presence shown in the header / dashboard. Stored on drivers/{uid}
// as `presenceStatus` — never as `status`, which is the admin approval state.
export type DriverStatus = 'Offline' | 'Online' | 'On Trip';

// drivers/{uid}.status — set to 'Pending' at signup, changed only by an admin
// (except Rejected → Pending when the driver resubmits corrected documents).
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Suspended';

export type DocumentStatus = 'Pending' | 'Approved' | 'Rejected';

export type VehicleCategory = 'Hatchback' | 'Sedan' | 'SUV' | 'Premium SUV' | 'Tempo Traveller';

export interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  photoUrl: string;
  dob: string;
  gender: string;
  address: string;
  city: string;
  pincode: string;
  emergencyContactName: string;
  emergencyContact: string;
  /** null until the driver has been rated. */
  rating: number | null;
  /** "" when the account creation date is not recorded. */
  joiningDate: string;
  /** vehicles/{id} this driver is paired with (by admin or fleet); "" when none. */
  assignedVehicleId: string;
  assignedVehicleNumber: string;
  vendorId?: string;
  vendorName?: string;
  approvalStatus: ApprovalStatus;
  docStatus: DocumentStatus;
  rejectionReason?: string;
  presenceStatus: DriverStatus;
}

export interface IdentityDetails {
  aadhaarNumber: string;
  aadhaarFrontUrl: string;
  aadhaarBackUrl: string;
  panNumber: string;
  panPhotoUrl: string;
}

export interface DrivingLicense {
  number: string;
  expiryDate: string;
  frontPhotoUrl: string;
  backPhotoUrl: string;
}

export interface VehicleDetails {
  vehicleNumber: string;
  vehicleType: VehicleCategory;
  make: string;
  model: string;
  year: string;
  color: string;
  capacity: number;
  fuelType: string;
  rcNumber: string;
  rcDocUrl: string;
  insuranceNumber: string;
  insuranceExpiry: string;
  insuranceDocUrl: string;
  fitnessExpiry: string;
  fitnessDocUrl: string;
  statePermitNumber: string;
  permitExpiry: string;
  statePermitDocUrl: string;
  frontPhotoUrl: string;
  rearPhotoUrl: string;
  sidePhotoUrl: string;
  interiorPhotoUrl: string;
}

export interface BankDetails {
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  upiId: string;
}

/** Everything the signup wizard collects. */
export interface RegistrationData {
  profile: Pick<DriverProfile,
    'name' | 'phone' | 'email' | 'photoUrl' | 'dob' | 'gender' | 'address' |
    'city' | 'pincode' | 'emergencyContactName' | 'emergencyContact'>;
  identity: IdentityDetails;
  license: DrivingLicense;
  vehicle: VehicleDetails;
  bank: BankDetails;
}

/** A complete driver record as read back from drivers/{uid}. */
export interface DriverAccount extends RegistrationData {
  driver: DriverProfile;
}

/**
 * Vehicle verification photos (front, rear, dashboard/interior), captured with the
 * camera inside a server-issued session. Older trips may carry the earlier
 * four-photo record instead, including a driver selfie that is no longer asked for.
 */
export interface PreTripPhotos {
  odometerReading: number;
  capturedAt: string;
}

// The three driver steps, advanced only by the server (advanceTrip).
export type TripSubStatus = 'Not Started' | 'Trip Started' | 'Reached Pickup' | 'Trip Ended';

// Legacy driver-reported progress, still stored on the booking as `tripStage`.
export type TripStage =
  | 'Assigned'
  | 'En Route Pickup'
  | 'Reached Pickup'
  | 'In Progress'
  | 'Arrived Destination'
  | 'Completed';

// Booking lifecycle status (see firestore.rules).
export type BookingStatus = 'Pending' | 'Approved' | 'Confirmed' | 'Assigned' | 'Ongoing' | 'Completed' | 'Cancelled' | 'Rejected';

export interface FareLine {
  key: string;
  label: string;
  amount: number | null;
  treatment: 'included' | 'extra' | 'not_applicable';
  detail: string;
}

export interface PaymentSummary {
  amountDue: number;
  totalPaid: number;
  balanceDue: number;
  partnerCashHeld: number;
  status: string;
}

export interface TripLocation {
  address: string;
  lat?: number;
  lng?: number;
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
  distanceKm: number;
  vehicleType: string;
  serviceType: string;
  fareAmount: number;
  /** Agreed payout for this driver (independent trips); null when not recorded or a fleet trip. */
  driverEarnings: number | null;
  /** Assigned through a fleet vendor, who settles the driver's pay. */
  fleetTrip: boolean;
  tollCharges: number;
  tollsApproved: boolean;
  status: BookingStatus;
  stage: TripStage;
  scheduledDate: string;
  scheduledTime: string;
  paymentMode: string;
  startOdometer?: number;
  endOdometer?: number;
  preTrip?: PreTripPhotos;
  tolls: TollReceipt[];
  completedAt?: Date | null;
  /** Server-validated trip step. */
  subStatus: TripSubStatus;
  /** Pickup instant; the date/time strings above are display copies for older bookings. */
  pickupAt: Date | null;
  /** The three vehicle photos were captured and submitted for this trip. */
  verificationSubmitted: boolean;
  /** The customer's boarding OTP has been verified. */
  boardingVerified: boolean;
  /** Older trips verified the OTP when starting; they have no separate boarding step. */
  legacyFlow: boolean;
  fareBreakup: FareLine[] | null;
  paymentSummary: PaymentSummary | null;
  tripStartedAt: Date | null;
  reachedPickupAt: Date | null;
  tripEndedAt: Date | null;
}

/** An open marketplace offer a driver may accept. */
export interface MarketplaceOffer {
  id: string;
  bookingId: string;
  pickup: TripLocation;
  drop: TripLocation;
  pickupTime: string;
  travelDate: string;
  pickupAt: Date | null;
  vehicleCategory: string;
  distanceKm: number;
  /** null when the offer has no valid payout (it cannot be accepted). */
  offeredPayout: number | null;
}

/** Credited earnings (trip payouts + approved tolls) from the partner ledger. */
export interface DriverEarningsSummary {
  todayEarnings: number;
  thisWeekEarnings: number;
  thisMonthEarnings: number;
  lifetimeEarnings: number;
  totalTripsCompleted: number;
  tollReimbursements: number;
}

/** wallets/driver_{uid} — computed by the server from the partner ledger. */
export interface DriverWallet {
  /** Withdrawable now; negative when cash fares collected exceed earnings. */
  available: number;
  /** Earnings on trips whose customer payment is not verified yet. */
  pending: number;
  reserved: number;
  paidOut: number;
  cashCollected: number;
  tripEarnings: number;
  tollReimbursements: number;
}

/** wallet_ledger entry (schema 2) for this driver. */
export interface LedgerEntry {
  id: string;
  type: string;
  direction: 'credit' | 'debit';
  amount: number;
  status: string;
  bookingId: string;
  bookingCode: string;
  createdAt: Date | null;
}

export interface PayoutRequest {
  id: string;
  amount: number;
  requestedAt: string;
  method: 'UPI' | 'Bank Transfer';
  details: string;
  status: string; // Pending | Paid | Deferred | Rejected
}

export type NotificationCategory = 'bookings' | 'approvals' | 'trips' | 'payments' | 'penalties' | 'general';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';

export interface DriverNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  createdAtMs: number;
  category: NotificationCategory;
  severity: NotificationSeverity;
  sound: 'new_booking' | 'approval' | 'general';
  bookingId: string;
  bookingCode: string;
  ctaLabel: string;
  ctaPage: string;
  /** false = quiet inbox entry (no popup or tone). */
  popup: boolean;
}

export type PenaltyStatus = 'Pending' | 'Acknowledged' | 'Paid' | 'Deducted' | 'Waived' | 'Disputed';

export interface DriverPenalty {
  id: string;
  amount: number;
  category: string;
  reason: string;
  description: string;
  bookingCode: string;
  bookingId: string;
  incidentDate: string;
  status: PenaltyStatus;
  acknowledged: boolean;
  acknowledgedAt: Date | null;
  disputeNote: string;
  issuedAt: Date | null;
  issuedByName: string;
}
