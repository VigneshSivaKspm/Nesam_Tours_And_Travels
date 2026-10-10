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

/** vehicles/{id} owned by this vendor, as stored (no display defaults). */
export interface FleetVehicle {
  id: string;
  vehicleNumber: string;
  category: string;
  categoryId: string;
  make: string;
  model: string;
  year: string;
  /** null when not recorded. */
  seatingCapacity: number | null;
  status: 'Active' | 'Maintenance' | 'Inactive';
  assignedDriverId: string;
  assignedDriverName: string;
  docStatus: VerificationStatus;
  rejectionReason: string;
}

/** drivers/{uid} in this vendor's fleet, as stored. */
export interface FleetDriver {
  id: string;
  name: string;
  phone: string;
  email: string;
  photoUrl: string;
  licenseNumber: string;
  licenseExpiry: string;
  /** Account review by NESAM. */
  accountStatus: VerificationStatus;
  /** Suspended by the fleet (vendor). */
  suspended: boolean;
  /** Duty status reported by the driver app. */
  online: boolean;
  assignedVehicleId: string;
  assignedVehicleNumber: string;
  /** null until the driver has ratings. */
  rating: number | null;
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
  vehicleCategory: string;
  distanceKm: number | null;
  /** Partner payout offered by the platform; null = not valid (cannot be accepted). */
  offeredPayout: number | null;
  status: 'Open' | 'Bidding';
}

/** marketplace_trips/{tripId}/bids/{id} submitted by this vendor. */
export interface BidProposal {
  id: string;
  tripId: string;
  bookingId: string;
  offeredPayout: number | null;
  vendorCounterRate: number;
  biddingNote: string;
  submittedAt: Date | null;
  status: string;
}

export interface VendorTrip {
  id: string;
  bookingId: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropAddress: string;
  scheduledTime: string;
  vehicleId: string;
  vehicleNumber: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  /** Customer fare incl. GST; null when not recorded. */
  grossFare: number | null;
  /** Agreed payout for this trip (accepted offer or awarded bid); null when not recorded. */
  vendorPayout: number | null;
  status: string;
  tripStage: string;
  /** Not Started / Reached Pickup / Trip Started / Trip Ended (blank on older trips). */
  tripSubStatus: string;
  /** The driver has submitted the three vehicle photos for this trip. */
  verificationSubmitted: boolean;
  verificationRisk: string;
  /** Derived by the server from the recorded payments; blank on older trips. */
  paymentStatus: string;
  totalPaid: number | null;
  balanceDue: number | null;
  fareLines: { key: string; label: string; amount: number | null; treatment: string; detail: string }[];
}

/** wallets/vendor_{uid} — computed by the server from the partner ledger. */
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
  updatedAt: Date | null;
}

export interface PayoutRequest {
  id: string;
  amount: number;
  requestedAt: Date | null;
  processedAt: string;
  payoutMethod: string;
  targetDetails: string;
  status: string;
  utr: string;
  adminNote: string;
}

/** wallet_ledger entry (schema 2) for this vendor. */
export interface TransactionRecord {
  id: string;
  type: string;
  direction: 'credit' | 'debit';
  amount: number;
  status: string;
  bookingCode: string;
  payoutRequestId: string;
  createdAt: Date | null;
}

// ─── Vendor onboarding / approval pipeline ──────────────────────────────────

/**
 * Canonical lifecycle of a vendors/{uid} document.
 *   INCOMPLETE        wizard started, not yet submitted
 *   PENDING_APPROVAL  submitted, awaiting admin review (vendor is read-only)
 *   CHANGES_REQUESTED admin asked for corrections (vendor may edit + resubmit)
 *   APPROVED          full operational access
 *   REJECTED          admin rejected (vendor may correct + reapply)
 *   SUSPENDED         admin disabled an approved account
 */
export type VendorStatus =
  | 'INCOMPLETE'
  | 'PENDING_APPROVAL'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED';

export type OnboardingSection = 'business' | 'documents' | 'fleet' | 'payout';

/** Metadata for a file in Firebase Storage. Only the path is stored — the
 *  download URL is resolved on demand so Storage rules stay authoritative. */
export interface StoredFile {
  path: string;
  name: string;
  contentType: string;
  size: number;
  uploadedAt: number;
}

export interface BusinessInfo {
  vendorName: string;
  businessName: string;
  email: string;
  altPhone: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    pincode: string;
  };
}

export type BusinessRegType = 'GST' | 'BUSINESS_REGISTRATION' | 'TRADE_LICENSE';
export type IdentityProofType = 'AADHAAR' | 'PAN' | 'PASSPORT';

export interface VendorDocuments {
  businessRegistration: {
    type: BusinessRegType;
    number: string;
    files: StoredFile[];
  };
  identityProof: {
    type: IdentityProofType;
    /** Masked for display only; the full number lives in vendor_kyc. */
    maskedNumber: string;
    files: StoredFile[];
  };
}

export interface FleetDetails {
  vehicleTypes: string[];
  fleetSize: number;
  rcFiles: StoredFile[];
  vehiclePhotos: StoredFile[];
  insuranceFiles: StoredFile[];
}

/** Private payout details — vendor_kyc/{uid}, readable by owner + admin only. */
export interface PayoutDetails {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
}

export interface PayoutSummary {
  accountHolderName: string;
  bankLast4: string;
  ifsc: string;
  upiId: string;
}

export interface AdminReview {
  note: string;
  flaggedSections: OnboardingSection[];
  reviewedAt?: number;
}

/** Normalised view of vendors/{uid} used by the gatekeeper + wizard. */
export interface VendorRecord {
  uid: string;
  phone: string;
  status: VendorStatus;
  onboardingStep: number;
  business: BusinessInfo | null;
  documents: VendorDocuments | null;
  fleet: FleetDetails | null;
  payoutSummary: PayoutSummary | null;
  review: AdminReview | null;
  submittedAt: number | null;
}
