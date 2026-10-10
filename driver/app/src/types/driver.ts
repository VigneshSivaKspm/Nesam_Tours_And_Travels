// Copied from driver/web/src/types.d.ts (as a regular module) and extended
// with the fields the mobile app reads: trip notes, assignment time and the
// payout reference / processed date.
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
  /** null until customers have rated this driver. */
  rating: number | null;
  joiningDate: string;
  vendorId?: string;
  vendorName?: string;
  /** Vehicle record paired with this driver by NESAM/vendor; a claim must name it. */
  assignedVehicleId?: string;
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

/** Vehicle verification recorded by the server: three camera photos (no driver selfie) and the starting odometer. */
export interface PreTripPhotos {
  vehicleFront: string;
  vehicleRear: string;
  vehicleInterior: string;
  odometerReading: number;
  capturedAt: string;
}

/** The driver's three trip steps — Reached Pickup → Trip Started → Trip Ended (stored as tripSubStatus; the server enforces the order). */
export type TripSubStatus = 'Not Started' | 'Reached Pickup' | 'Trip Started' | 'Trip Ended';

// Driver-reported progress, stored on the booking as `tripStage`.
export type TripStage =
  | 'Assigned'
  | 'En Route Pickup'
  | 'Reached Pickup'
  | 'In Progress'
  | 'Arrived Destination'
  | 'Completed';

// Booking lifecycle status (see firestore.rules).
export type BookingStatus = 'Pending' | 'Approved' | 'Confirmed' | 'Assigned' | 'Ongoing' | 'Completed' | 'Cancelled' | 'Rejected';

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
  /** The agreed payout recorded on the booking; 0 when none is recorded (see payoutRecorded). */
  driverEarnings: number;
  /** false = no driverPayout on the booking: shown as "Not recorded", never estimated. */
  payoutRecorded: boolean;
  /** true once finance finalized the trip (bookings/{id}.finance); driverEarnings is then the finalized amount. */
  payoutFinalized: boolean;
  /** Assigned through a vendor: the vendor is paid and settles with the driver. */
  fleetTrip: boolean;
  tollCharges: number;
  status: BookingStatus;
  /** Legacy stage the older screens read; the server mirrors the sub-status into it. */
  stage: TripStage;
  subStatus: TripSubStatus;
  /** The three vehicle photos and odometer were submitted and accepted for review. */
  verificationSubmitted: boolean;
  /** The customer's boarding OTP was verified at pickup. */
  boardingVerified: boolean;
  /** What the customer still owes on this booking, from the recorded payments. */
  balanceDue?: number;
  reachedPickupAt?: Date | null;
  /** Booked pickup time (pickupAt / scheduledAt); null when the booking does not say. */
  pickupAt: Date | null;
  scheduledDate: string;
  scheduledTime: string;
  paymentMode: string;
  /** Rider's note for the driver (gate number, landmark, luggage). */
  notes: string;
  startOdometer?: number;
  endOdometer?: number;
  preTrip?: PreTripPhotos;
  tolls: TollReceipt[];
  completedAt?: Date | null;
  assignedAt?: Date | null;
}

/** An open marketplace offer a driver may accept. */
export interface MarketplaceOffer {
  id: string;
  bookingId: string;
  pickup: TripLocation;
  drop: TripLocation;
  pickupTime: string;
  travelDate: string;
  vehicleCategory: string;
  distanceKm: number;
  offeredPayout: number;
}

export interface DriverEarningsSummary {
  todayEarnings: number;
  thisWeekEarnings: number;
  thisMonthEarnings: number;
  lifetimeEarnings: number;
  totalTripsCompleted: number;
  tollReimbursements: number;
}

/** wallets/driver_{uid}, written only by the server (functions/src/ledger.ts). */
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
  /** Bank / UPI reference once paid (when the finance team records one). */
  utr: string;
  processedAt: string;
}

export type NotificationCategory = 'bookings' | 'approvals' | 'trips' | 'payments' | 'penalties' | 'general';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';
export type NotificationSound = 'new_booking' | 'approval' | 'general';

export interface DriverNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  createdAtMs: number;
  category: NotificationCategory;
  severity: NotificationSeverity;
  sound: NotificationSound;
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
