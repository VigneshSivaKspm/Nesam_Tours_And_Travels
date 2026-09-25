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
  rating: number;
  joiningDate: string;
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

export interface PreTripPhotos {
  selfie: string;
  vehicleFront: string;
  odometer: string;
  rearSeat: string;
  odometerReading: number;
  capturedAt: string;
}

// Driver-reported progress, stored on the booking as `tripStage`.
export type TripStage =
  | 'Assigned'
  | 'En Route Pickup'
  | 'Reached Pickup'
  | 'In Progress'
  | 'Arrived Destination'
  | 'Completed';

// Booking lifecycle status (see firestore.rules).
export type BookingStatus = 'Pending' | 'Confirmed' | 'Assigned' | 'Ongoing' | 'Completed' | 'Cancelled';

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
  driverEarnings: number;
  tollCharges: number;
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

export interface PayoutRequest {
  id: string;
  amount: number;
  requestedAt: string;
  method: 'UPI' | 'Bank Transfer';
  details: string;
  status: string; // Pending | Paid | Deferred | Rejected
}

export interface DriverNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  createdAtMs: number;
}
