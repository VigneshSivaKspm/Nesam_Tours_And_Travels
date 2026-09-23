export interface Booking {
  id: string;
  customer: string;
  customerName?: string;
  customerPhone?: string;
  phone?: string;
  vendor?: string;
  service: string;
  serviceType?: string;
  pickup: string;
  pickupAddress?: string;
  drop: string;
  dropAddress?: string;
  date: string;
  time: string;
  vehicle: string;
  vehicleCategory?: string;
  driver?: string;
  fare: string | number;
  payment: string;
  paymentStatus?: string;
  paymentMethod?: string;
  status: string;
  boardingOTP?: string;
  verified?: boolean;
  distanceKm?: number;
  createdAt?: any;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle?: string;
  assignedVehicleNumber?: string;
  vendor?: string | null;
  license?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  status: string;
  trips?: number;
  totalTrips?: number;
  earnings?: string;
  rating?: number;
  verified?: boolean;
  wallet?: string;
  penalties?: number;
  tds?: string;
  docs?: {
    license?: string;
    photo?: string;
    rc?: string;
    insurance?: string;
    permit?: string;
  };
  preTrip?: {
    selfie?: boolean;
    vehicleFront?: boolean;
    odometer?: boolean;
    rearSeat?: boolean;
  };
  docStatus?: string;
  createdAt?: any;
}

export interface VehicleCategoryFare {
  baseFare: number;
  baseKm: number;
  perKmRate: number;
  minimumFare: number;
  driverAllowance: number;
  nightAllowance: number;
  waitingChargePerHour: number;
  extraHourCharge: number;
  extraKmCharge: number;
  tollIncluded: boolean;
  parkingIncluded: boolean;
  permitCharge: number;
  outstationPerKmRate?: number;
  outstationDriverBattaPerDay?: number;
  outstationMinKmPerDay?: number;
}

export interface VehicleCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  imageUrl?: string;
  icon?: string;
  seatingCapacity: number;
  luggageCapacity?: string | number;
  acSupported?: 'AC' | 'Non-AC' | 'Both' | boolean;
  recommendedPassengers?: number;
  displayOrder?: number;
  status: 'Active' | 'Inactive';
  fare: VehicleCategoryFare;
  vehicleCount?: number;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface Vehicle {
  id: string;
  name?: string;
  make?: string;
  model?: string;
  year?: string;
  number: string;
  vehicleNumber?: string;
  category: string;
  seats?: number;
  seatingCapacity?: number;
  fuel?: string;
  fuelType?: string;
  driver?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  vendor?: string | null;
  vendorName?: string;
  status: string;
  rate?: string;
  docs?: {
    rc?: string;
    insurance?: string;
    fitness?: string;
    permit?: string;
  };
  docStatus?: string;
  createdAt?: any;
}

export interface Vendor {
  id: string;
  name: string;
  companyName?: string;
  owner: string;
  phone: string;
  email: string;
  city: string;
  gst?: string;
  gstin?: string;
  panNumber?: string;
  status: string;
  verified: boolean;
  fleetSize?: number;
  activeDrivers?: number;
  commission?: string;
  wallet?: string;
  walletBalance?: number;
  lifetimeEarnings?: string;
  joined?: string;
  joinedDate?: string;
  docs?: Record<string, string>;
  createdAt?: any;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  bookings: number;
  spent: string;
  wallet: string;
  status: string;
  lastBooking: string;
  createdAt?: any;
}

export interface MarketplaceTrip {
  id: string;
  bookingId: string;
  pickup: any;
  drop: any;
  date?: string;
  time?: string;
  travelDate?: string;
  vehicleType?: string;
  vehicleCategory?: string;
  distance?: string;
  distanceKm?: number;
  offeredPayout: string | number;
  status: string;
  postedAt?: string;
  lastCounterRate?: number;
  bids?: Array<{
    vendorId: string;
    vendorName: string;
    amount: string | number;
    status: string;
    time?: string;
  }>;
  createdAt?: any;
}

export interface PaymentTransaction {
  id: string;
  bookingId: string;
  customer: string;
  amount: string;
  method: string;
  gateway?: string;
  date: string;
  status: string;
  refund?: string;
  gst?: string;
  vendorShare?: string;
  commission?: string;
}

export interface PenaltyRecord {
  id: string;
  type: string;
  entity: string;
  entityId: string;
  reason: string;
  amount: string;
  walletDeducted: boolean;
  custCompensation: string;
  date: string;
  status: string;
  bookingId?: string;
}

export interface NotificationRecord {
  id: number | string;
  type: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  status: string;
  lastLogin: string;
  permissions: string[];
}

export interface RoleDefinition {
  name: string;
  permissions: string[];
  color: string;
}

export interface InvoiceItem {
  description: string;
  amount: number;
  qty?: number;
  rate?: number;
}

export interface CompanySnapshot {
  name: string;
  gstin: string;
  address: string;
  phone: string;
  email: string;
  sacCode?: string;
}

export interface CustomerSnapshot {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
}

export interface TripSnapshot {
  service: string;
  pickup: string;
  drop: string;
  travelDate: string;
  travelTime?: string;
  vehicle: string;
  vehicleCategory?: string;
  vehicleNumber?: string;
  driverName?: string;
  distanceKm?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  customerId?: string;
  invoiceDate: string;
  dueDate?: string;
  companySnapshot: CompanySnapshot;
  customerSnapshot: CustomerSnapshot;
  tripSnapshot: TripSnapshot;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  taxableAmount: number;
  gstRate: number; // e.g. 0.05 for 5%
  cgst: number;
  sgst: number;
  totalTax: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: "Paid" | "Partially Paid" | "Pending";
  invoiceStatus: "Issued" | "Draft" | "Cancelled";
  terms?: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface TravelService {
  id: string;
  name: string;
  code: string;
  slug: string;
  serviceType: string;
  shortDescription?: string;
  fullDescription?: string;
  icon?: string;
  imageUrl?: string;
  status: "Active" | "Inactive";
  displayOrder?: number;
  featured?: boolean;
  onlineBookingEnabled?: boolean;
  adminBookingEnabled?: boolean;
  allowedVehicleCategoryIds?: string[];
  allowedVehicleCategoryNames?: string[];
  airportOptions?: {
    airportPickup: boolean;
    airportDrop: boolean;
  };
  outstationOptions?: {
    oneWayAllowed: boolean;
    roundTripAllowed: boolean;
  };
  seoTitle?: string;
  seoDescription?: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface ItineraryDay {
  dayNumber: number;
  title: string;
  description: string;
  activities?: string;
  meals?: string;
  stay?: string;
}

export interface PackageDeparture {
  id: string;
  date: string;
  time?: string;
  availableSeats?: number;
  status: "Available" | "Filling Fast" | "Sold Out" | "Cancelled";
}

export interface TourPackage {
  id: string;
  name: string;
  code: string;
  slug: string;
  shortDescription?: string;
  fullDescription?: string;
  startingLocation: string;
  endingLocation?: string;
  destinations: string[];
  durationDays: number;
  durationNights: number;
  itinerary: ItineraryDay[];
  pricingModel: "Per Package" | "Per Person" | "Vehicle Based";
  basePrice: number;
  offerPrice?: number;
  adultPrice?: number;
  childPrice?: number;
  allowedVehicleCategoryIds?: string[];
  allowedVehicleCategoryNames?: string[];
  preferredVendorId?: string;
  preferredVendorName?: string;
  departures?: PackageDeparture[];
  inclusions: string[];
  exclusions: string[];
  highlights?: string[];
  coverImageUrl?: string;
  galleryImages?: string[];
  status: "Draft" | "Active" | "Inactive" | "Archived";
  published: boolean;
  featured?: boolean;
  displayOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export type LocationType =
  | "City"
  | "Area / Locality"
  | "Airport"
  | "Railway Station"
  | "Bus Stand"
  | "Landmark"
  | "Tourist Place"
  | "Other";

export interface MasterLocation {
  id: string;
  name: string;
  normalizedName?: string;
  code?: string;
  type: LocationType;
  state: string;
  district?: string;
  city: string;
  area?: string;
  pincode?: string;
  address?: string;
  parentLocationId?: string;
  parentLocationName?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  pickupEnabled: boolean;
  dropEnabled: boolean;
  onlineBookingEnabled?: boolean;
  adminBookingEnabled?: boolean;
  serviceIds?: string[];
  status: "Active" | "Inactive";
  displayOrder?: number;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export type PricingModel =
  | "PER_KM"
  | "BASE_PLUS_PER_KM"
  | "FIXED_ROUTE"
  | "HOURLY_RENTAL"
  | "PER_DAY";

export interface FareRule {
  id: string;
  name: string;
  code?: string;
  serviceId?: string;
  serviceName?: string;
  vehicleCategoryId: string;
  vehicleCategoryName?: string;
  pricingType: PricingModel;
  
  // Location / Route specific
  originLocationId?: string;
  originLocationName?: string;
  destinationLocationId?: string;
  destinationLocationName?: string;

  // Base & Distance
  baseFare: number;
  baseKm: number;
  perKmRate: number;
  minimumKmPerDay?: number;
  minimumFare?: number;

  // Hourly / Rental Package
  includedHours?: number;
  extraKmRate?: number;
  extraHourRate?: number;

  // Allowances & Surcharges
  driverBatta: number;
  nightChargeEnabled?: boolean;
  nightStartTime?: string; // e.g. "22:00"
  nightEndTime?: string;   // e.g. "05:00"
  nightChargeType?: "Fixed" | "Percentage";
  nightChargeValue?: number;

  // Waiting Charges
  freeWaitingMinutes?: number;
  waitingChargePerHour?: number;

  // Additional Charges & Modes
  tollMode?: "Included" | "Excluded" | "Fixed";
  fixedTollAmount?: number;
  parkingMode?: "Included" | "Excluded" | "Fixed";
  fixedParkingAmount?: number;
  permitCharge?: number;

  // Status & Priority
  priority?: number;
  status: "Active" | "Inactive";
  effectiveFrom?: string;
  effectiveUntil?: string;
  
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface FareCalculationInput {
  serviceName?: string;
  serviceId?: string;
  vehicleCategoryId?: string;
  vehicleCategoryName?: string;
  originLocationId?: string;
  originLocationName?: string;
  destinationLocationId?: string;
  destinationLocationName?: string;
  distanceKm: number;
  tripDays?: number;
  tripHours?: number;
  pickupTime?: string;
  waitingMinutes?: number;
  tollAmount?: number;
  parkingAmount?: number;
  permitAmount?: number;
  discountAmount?: number;
}

export interface FareBreakdownItem {
  label: string;
  amount: number;
  details?: string;
}

export interface FareCalculationResult {
  matchedRule: FareRule | null;
  baseFare: number;
  distanceFare: number;
  driverBatta: number;
  nightCharge: number;
  waitingCharge: number;
  extraKmCharge: number;
  extraHourCharge: number;
  tollAmount: number;
  parkingAmount: number;
  permitAmount: number;
  discountAmount: number;
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  billableDistanceKm: number;
  breakdown: FareBreakdownItem[];
  fallbackUsed?: boolean;
}

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type CouponStatus = "Draft" | "Active" | "Scheduled" | "Expired" | "Inactive" | "Archived";

export interface MasterCoupon {
  id: string;
  name: string;
  code: string;
  description?: string;
  termsAndConditions?: string;

  // Discount configuration
  discountType: DiscountType;
  discountValue: number;
  maximumDiscount?: number;
  minimumBookingAmount?: number;

  // Validity
  validFrom: string;
  validUntil: string;

  // Usage limits
  totalUsageLimit?: number;
  usedCount: number;
  perCustomerLimit?: number;

  // Restrictions
  firstBookingOnly?: boolean;
  serviceIds?: string[];
  serviceNames?: string[];
  vehicleCategoryIds?: string[];
  vehicleCategoryNames?: string[];
  locationIds?: string[];
  tourPackageIds?: string[];
  adminBookingOnly?: boolean;

  status: CouponStatus;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface CouponValidationContext {
  customerPhone?: string;
  customerId?: string;
  serviceName?: string;
  serviceId?: string;
  vehicleCategoryId?: string;
  vehicleCategoryName?: string;
  eligibleSubtotal: number;
  pickupLocationId?: string;
  dropLocationId?: string;
  tourPackageId?: string;
  isFirstBooking?: boolean;
  currentDate?: Date;
}

export interface CouponValidationResult {
  valid: boolean;
  reasonCode?: string;
  message: string;
  coupon: MasterCoupon | null;
  discountAmount: number;
  finalPayableAmount: number;
}

export type ModerationStatus = "Pending" | "Published" | "Hidden" | "Flagged" | "Archived";
export type FlagReason = "Spam" | "Abusive Content" | "Irrelevant" | "Duplicate" | "Privacy Concern" | "Other";

export interface AdminResponse {
  text: string;
  respondedBy: string;
  respondedAt: string;
  updatedAt?: string;
}

export interface ModerationMeta {
  flagged?: boolean;
  reason?: FlagReason | string;
  moderatedBy?: string;
  moderatedAt?: string;
  internalNotes?: string;
}

export interface CustomerReview {
  id: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  
  driverId?: string;
  driverName?: string;
  vehicleNumber?: string;
  serviceId?: string;
  serviceName?: string;
  tourPackageId?: string;

  overallRating: number; // 1 to 5
  driverRating?: number;
  serviceRating?: number;

  reviewText?: string;
  
  status: ModerationStatus;
  adminResponse?: AdminResponse;
  moderation?: ModerationMeta;

  createdAt: any;
  updatedAt?: any;
}
