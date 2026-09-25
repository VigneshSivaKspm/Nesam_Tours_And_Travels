import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type {
  ApprovalStatus,
  BankDetails,
  BookingStatus,
  DocumentStatus,
  DriverAccount,
  DriverNotification,
  DriverProfile,
  DriverStatus,
  DrivingLicense,
  IdentityDetails,
  MarketplaceOffer,
  PayoutRequest,
  PreTripPhotos,
  RegistrationData,
  TollReceipt,
  TripDetails,
  TripStage,
  VehicleCategory,
  VehicleDetails,
} from '../types';

export const BOOKINGS_COLLECTION = 'bookings';
export const DRIVERS_COLLECTION = 'drivers';
export const MARKETPLACE_COLLECTION = 'marketplace_trips';
export const PAYOUT_REQUESTS_COLLECTION = 'payout_requests';
export const NOTIFICATIONS_COLLECTION = 'notifications';
export const DRIVER_INVITES_COLLECTION = 'driver_invites';

// ── Small helpers ──────────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

export function parseAmount(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(str(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'object' && v && typeof (v as { toDate?: unknown }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate();
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDateTime(d: Date | null): string {
  if (!d) return '';
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Human-readable message for a Firestore write failure. */
export function describeFirestoreError(error: unknown, fallback: string): string {
  const code = (error as { code?: string })?.code ?? '';
  console.error('[Firestore - Driver]', code, error);
  if (code === 'permission-denied') return fallback;
  if (code === 'unavailable') return 'You appear to be offline. Please check your internet connection.';
  if (code === 'not-found') return 'This record no longer exists.';
  return (error as Error)?.message || fallback;
}

// ── Empty records ──────────────────────────────────────────────────────────

export const EMPTY_IDENTITY: IdentityDetails = {
  aadhaarNumber: '', aadhaarFrontUrl: '', aadhaarBackUrl: '', panNumber: '', panPhotoUrl: '',
};

export const EMPTY_LICENSE: DrivingLicense = {
  number: '', expiryDate: '', frontPhotoUrl: '', backPhotoUrl: '',
};

export const EMPTY_VEHICLE: VehicleDetails = {
  vehicleNumber: '', vehicleType: 'Sedan', make: '', model: '', year: '', color: '',
  capacity: 4, fuelType: 'Diesel',
  rcNumber: '', rcDocUrl: '',
  insuranceNumber: '', insuranceExpiry: '', insuranceDocUrl: '',
  fitnessExpiry: '', fitnessDocUrl: '',
  statePermitNumber: '', permitExpiry: '', statePermitDocUrl: '',
  frontPhotoUrl: '', rearPhotoUrl: '', sidePhotoUrl: '', interiorPhotoUrl: '',
};

export const EMPTY_BANK: BankDetails = {
  accountHolder: '', accountNumber: '', ifsc: '', bankName: '', upiId: '',
};

export function emptyRegistration(phone: string): RegistrationData {
  return {
    profile: {
      name: '', phone, email: '', photoUrl: '', dob: '', gender: '', address: '',
      city: '', pincode: '', emergencyContactName: '', emergencyContact: '',
    },
    identity: { ...EMPTY_IDENTITY },
    license: { ...EMPTY_LICENSE },
    vehicle: { ...EMPTY_VEHICLE },
    bank: { ...EMPTY_BANK },
  };
}

/** Formats an E.164 Indian number (+919876543210) as "+91 98765 43210". */
export function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  if (local.length !== 10) return e164;
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

// ── Driver account (drivers/{uid}) ─────────────────────────────────────────

const APPROVAL_VALUES: ApprovalStatus[] = ['Pending', 'Approved', 'Rejected', 'Suspended'];
const DOC_VALUES: DocumentStatus[] = ['Pending', 'Approved', 'Rejected'];

function mapDriverDoc(uid: string, data: Record<string, any>): DriverAccount {
  const approval = APPROVAL_VALUES.includes(data.status) ? data.status as ApprovalStatus : 'Pending';
  const docStatus = DOC_VALUES.includes(data.docStatus) ? data.docStatus as DocumentStatus : 'Pending';
  const presence: DriverStatus =
    data.presenceStatus === 'Online' || data.presenceStatus === 'On Trip' ? data.presenceStatus : 'Offline';
  const created = toDate(data.createdAt);

  const driver: DriverProfile = {
    id: uid,
    name: str(data.name),
    phone: str(data.phone),
    email: str(data.email),
    photoUrl: str(data.photoUrl),
    dob: str(data.dob),
    gender: str(data.gender),
    address: str(data.address),
    city: str(data.city),
    pincode: str(data.pincode),
    emergencyContactName: str(data.emergencyContactName),
    emergencyContact: str(data.emergencyContact),
    rating: typeof data.rating === 'number' ? data.rating : 5,
    joiningDate: created
      ? created.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
      : str(data.joiningDate) || 'New Partner',
    vendorId: data.vendorId || undefined,
    vendorName: data.vendorName || undefined,
    approvalStatus: approval,
    docStatus,
    rejectionReason: data.rejectionReason || undefined,
    presenceStatus: presence,
  };

  const li = data.licenseInfo || {};
  const vi = data.vehicleInfo || {};
  const id = data.identity || {};
  const bank = data.bank || {};

  return {
    driver,
    profile: {
      name: driver.name, phone: driver.phone, email: driver.email, photoUrl: driver.photoUrl,
      dob: driver.dob, gender: driver.gender, address: driver.address, city: driver.city,
      pincode: driver.pincode, emergencyContactName: driver.emergencyContactName,
      emergencyContact: driver.emergencyContact,
    },
    identity: { ...EMPTY_IDENTITY, ...pickStrings(id, Object.keys(EMPTY_IDENTITY)) } as IdentityDetails,
    license: {
      ...EMPTY_LICENSE,
      ...pickStrings(li, Object.keys(EMPTY_LICENSE)),
      number: str(li.number || data.licenseNumber),
      expiryDate: str(li.expiryDate || data.licenseExpiry),
    } as DrivingLicense,
    vehicle: {
      ...EMPTY_VEHICLE,
      ...pickStrings(vi, Object.keys(EMPTY_VEHICLE).filter((k) => k !== 'capacity')),
      vehicleType: (vi.vehicleType || 'Sedan') as VehicleCategory,
      capacity: typeof vi.capacity === 'number' ? vi.capacity : 4,
    } as VehicleDetails,
    bank: { ...EMPTY_BANK, ...pickStrings(bank, Object.keys(EMPTY_BANK)) } as BankDetails,
  };
}

function pickStrings(src: Record<string, any>, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) if (src[k] != null) out[k] = str(src[k]);
  return out;
}

export async function getDriverAccount(uid: string): Promise<DriverAccount | null> {
  const snap = await getDoc(doc(db, DRIVERS_COLLECTION, uid));
  return snap.exists() ? mapDriverDoc(uid, snap.data()) : null;
}

export function subscribeToDriverAccount(
  uid: string,
  callback: (account: DriverAccount | null) => void,
  onError?: (error: unknown) => void,
) {
  return onSnapshot(
    doc(db, DRIVERS_COLLECTION, uid),
    (snap) => callback(snap.exists() ? mapDriverDoc(uid, snap.data()) : null),
    (err) => {
      console.warn('Driver profile subscription error:', err);
      onError?.(err);
    },
  );
}

export interface DriverInvite {
  name?: string;
  vendorId?: string;
  vendorName?: string;
  preApproved?: boolean;
}

/**
 * An admin or vendor may pre-register a driver by phone number. The invite
 * pre-fills the name, links the vendor and (admin only) pre-approves.
 */
export async function getDriverInvite(phoneE164: string): Promise<DriverInvite | null> {
  if (!phoneE164) return null;
  try {
    const snap = await getDoc(doc(db, DRIVER_INVITES_COLLECTION, phoneE164));
    return snap.exists() ? (snap.data() as DriverInvite) : null;
  } catch (err) {
    console.warn('Driver invite lookup failed:', err);
    return null;
  }
}

/** Flattened fields kept alongside the nested records for the admin/vendor panels. */
function registrationFields(data: RegistrationData) {
  const p = data.profile;
  const v = data.vehicle;
  return {
    name: p.name.trim(),
    email: p.email.trim(),
    photoUrl: p.photoUrl,
    dob: p.dob,
    gender: p.gender,
    address: p.address.trim(),
    city: p.city.trim(),
    pincode: p.pincode.trim(),
    emergencyContactName: p.emergencyContactName.trim(),
    emergencyContact: p.emergencyContact.trim(),
    identity: {
      ...data.identity,
      aadhaarNumber: data.identity.aadhaarNumber.replace(/\s/g, ''),
      panNumber: data.identity.panNumber.trim().toUpperCase(),
    },
    licenseInfo: { ...data.license, number: data.license.number.trim().toUpperCase() },
    vehicleInfo: {
      ...v,
      vehicleNumber: v.vehicleNumber.trim().toUpperCase(),
      rcNumber: v.rcNumber.trim().toUpperCase(),
    },
    bank: { ...data.bank, ifsc: data.bank.ifsc.trim().toUpperCase() },
    licenseNumber: data.license.number.trim().toUpperCase(),
    licenseExpiry: data.license.expiryDate,
    license: 'Submitted',
    vehicleNumber: v.vehicleNumber.trim().toUpperCase(),
    vehicleType: v.vehicleType,
    vehicle: `${v.make} ${v.model} • ${v.vehicleNumber.trim().toUpperCase()}`.trim(),
    docStatus: 'Pending',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Creates drivers/{uid} for a brand-new driver. The account starts in
 * 'Pending' until an admin approves it — unless an admin invite for this
 * phone number pre-approved it (firestore.rules checks the invite).
 */
export async function registerDriver(data: RegistrationData): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Your session has expired. Please sign in again.');
  const phoneE164 = user.phoneNumber || '';
  const invite = await getDriverInvite(phoneE164);

  await setDoc(doc(db, DRIVERS_COLLECTION, user.uid), {
    ...registrationFields(data),
    uid: user.uid,
    id: user.uid,
    phone: phoneE164 ? formatPhone(phoneE164) : data.profile.phone,
    phoneE164,
    role: 'driver',
    status: invite?.preApproved ? 'Approved' : 'Pending',
    verified: false,
    vendorId: invite?.vendorId || '',
    vendorName: invite?.vendorName || '',
    presenceStatus: 'Offline',
    rating: 5,
    totalTrips: 0,
    createdAt: serverTimestamp(),
  });
}

/**
 * Updates KYC details on an existing account. A rejected driver's status goes
 * back to 'Pending' for another admin review; an approved driver stays
 * approved but docStatus drops to 'Pending' so the admin re-audits.
 */
export async function resubmitDriverDocuments(
  uid: string,
  data: RegistrationData,
  currentStatus: ApprovalStatus,
): Promise<void> {
  await updateDoc(doc(db, DRIVERS_COLLECTION, uid), {
    ...registrationFields(data),
    ...(currentStatus === 'Rejected' ? { status: 'Pending', rejectionReason: '' } : {}),
  });
}

/** Contact / payout details that don't need re-verification. */
export async function updateDriverContactDetails(
  uid: string,
  fields: Partial<Pick<DriverProfile, 'email' | 'address' | 'city' | 'pincode' | 'emergencyContactName' | 'emergencyContact'>> & { bank?: BankDetails },
): Promise<void> {
  await updateDoc(doc(db, DRIVERS_COLLECTION, uid), { ...fields, updatedAt: serverTimestamp() });
}

/**
 * Online/offline presence. Written to `presenceStatus`, never `status` —
 * `status` is the admin approval state and the rules block drivers from it.
 */
export async function setDriverPresence(uid: string, presence: DriverStatus): Promise<void> {
  await updateDoc(doc(db, DRIVERS_COLLECTION, uid), {
    presenceStatus: presence,
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ── Marketplace ────────────────────────────────────────────────────────────

export function subscribeToOpenMarketplace(callback: (offers: MarketplaceOffer[]) => void) {
  const q = query(collection(db, MARKETPLACE_COLLECTION), where('status', '==', 'Open'));
  return onSnapshot(
    q,
    (snap) => {
      const offers = snap.docs.map((d) => {
        const data = d.data();
        const pickup = typeof data.pickup === 'object' && data.pickup ? data.pickup : { address: str(data.pickup) };
        const drop = typeof data.drop === 'object' && data.drop ? data.drop : { address: str(data.drop) };
        return {
          id: d.id,
          bookingId: str(data.bookingId) || d.id,
          pickup: {
            address: str(pickup.address || pickup.city) || 'Pickup location',
            lat: typeof pickup.lat === 'number' ? pickup.lat : undefined,
            lng: typeof pickup.lng === 'number' ? pickup.lng : undefined,
          },
          drop: {
            address: str(drop.address || drop.city) || 'Drop location',
            lat: typeof drop.lat === 'number' ? drop.lat : undefined,
            lng: typeof drop.lng === 'number' ? drop.lng : undefined,
          },
          pickupTime: str(pickup.time),
          travelDate: str(data.travelDate),
          vehicleCategory: str(data.vehicleCategory || data.categoryName),
          distanceKm: parseAmount(data.distanceKm),
          offeredPayout: parseAmount(data.offeredPayout),
          _created: toDate(data.createdAt)?.getTime() ?? 0,
        };
      });
      offers.sort((a, b) => b._created - a._created);
      callback(offers.map(({ _created, ...o }) => o));
    },
    (err) => {
      console.warn('Marketplace subscription error:', err);
      callback([]);
    },
  );
}

/**
 * Claims an open marketplace booking. Booking + marketplace doc are written
 * in one batch — the rules cross-check each against the other, and a batch
 * guarantees two drivers can't both win the same trip.
 */
export async function acceptMarketplaceTrip(
  driver: DriverProfile,
  vehicleNumber: string,
  offer: MarketplaceOffer,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, BOOKINGS_COLLECTION, offer.id), {
    status: 'Assigned',
    tripStage: 'Assigned',
    assignedDriverId: driver.id,
    assignedDriverName: driver.name,
    driver: driver.name,
    driverPhone: driver.phone,
    assignedVehicleNumber: vehicleNumber,
    driverPayout: offer.offeredPayout,
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, MARKETPLACE_COLLECTION, offer.id), {
    status: 'Assigned',
    assignedDriverId: driver.id,
    assignedDriverName: driver.name,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

// ── Assigned bookings / trip execution ─────────────────────────────────────

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/**
 * Bookings store a location either as flat fields (pickup / pickupAddress /
 * pickupLat / pickupLng) or as an object ({ name, address, lat, lng }).
 */
function readLocation(data: Record<string, any>, key: 'pickup' | 'drop', fallback: string) {
  const v = data[key];
  if (v && typeof v === 'object') {
    return {
      address: str(v.address || v.name || data[`${key}Address`]) || fallback,
      lat: num(v.lat) ?? num(data[`${key}Lat`]),
      lng: num(v.lng) ?? num(data[`${key}Lng`]),
    };
  }
  return {
    address: str(data[`${key}Address`] || v) || fallback,
    lat: num(data[`${key}Lat`]),
    lng: num(data[`${key}Lng`]),
  };
}

const STAGES: TripStage[] =['Assigned', 'En Route Pickup', 'Reached Pickup', 'In Progress', 'Arrived Destination', 'Completed'];

function mapBooking(id: string, data: Record<string, any>): TripDetails {
  const fare = parseAmount(data.fare);
  const status = str(data.status) as BookingStatus;
  let stage: TripStage = STAGES.includes(data.tripStage) ? data.tripStage : 'Assigned';
  if (status === 'Ongoing' && STAGES.indexOf(stage) < STAGES.indexOf('In Progress')) stage = 'In Progress';
  if (status === 'Completed') stage = 'Completed';

  const payout = data.driverPayout != null ? parseAmount(data.driverPayout) : Math.round(fare * 0.85);
  const preTrip = data.preTrip && typeof data.preTrip === 'object' ? data.preTrip : undefined;

  return {
    id,
    bookingId: str(data.bookingId) || id,
    customerName: str(data.passengerName || data.customer || data.customerName) || 'Passenger',
    customerPhone: str(data.passengerPhone || data.phone || data.customerPhone),
    pickup: readLocation(data, 'pickup', 'Pickup location'),
    drop: readLocation(data, 'drop', 'Drop location'),
    distanceKm: parseAmount(data.distanceKm),
    vehicleType: str(data.categoryName || data.vehicleCategory || data.vehicle),
    serviceType: str(data.service),
    fareAmount: fare,
    driverEarnings: payout,
    tollCharges: parseAmount(data.tollCharges),
    status,
    stage,
    scheduledDate: str(data.date),
    scheduledTime: str(data.time),
    paymentMode: str(data.paymentMethod) || 'Cash',
    startOdometer: typeof data.startOdometer === 'number' ? data.startOdometer : undefined,
    endOdometer: typeof data.endOdometer === 'number' ? data.endOdometer : undefined,
    preTrip: preTrip
      ? {
          selfie: str(preTrip.selfie),
          vehicleFront: str(preTrip.vehicleFront),
          odometer: str(preTrip.odometer),
          rearSeat: str(preTrip.rearSeat),
          odometerReading: parseAmount(preTrip.odometerReading),
          capturedAt: str(preTrip.capturedAt),
        }
      : undefined,
    tolls: Array.isArray(data.tolls) ? data.tolls as TollReceipt[] : [],
    completedAt: toDate(data.completedAt),
  };
}

/** Every booking ever assigned to this driver (active + history). */
export function subscribeToDriverBookings(driverId: string, callback: (trips: TripDetails[]) => void) {
  const q = query(collection(db, BOOKINGS_COLLECTION), where('assignedDriverId', '==', driverId));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => mapBooking(d.id, d.data()))),
    (err) => {
      console.warn('Driver bookings subscription error:', err);
      callback([]);
    },
  );
}

export async function submitPreTripVerification(bookingId: string, photos: PreTripPhotos): Promise<void> {
  await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), {
    preTrip: photos,
    startOdometer: photos.odometerReading,
    tripStage: 'En Route Pickup',
    updatedAt: serverTimestamp(),
  });
}

export async function markReachedPickup(
  bookingId: string,
  location?: { lat: number; lng: number } | null,
): Promise<void> {
  await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), {
    tripStage: 'Reached Pickup',
    reachedPickupAt: serverTimestamp(),
    ...(location ? { driverLocation: location } : {}),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Starts the ride. The rules compare `otpAttempt` to booking_secrets/{id}.otp
 * (which the driver can't read), so a wrong OTP surfaces as permission-denied.
 */
export async function startTripWithOtp(bookingId: string, otp: string): Promise<void> {
  await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), {
    status: 'Ongoing',
    tripStage: 'In Progress',
    otpAttempt: otp,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function markArrivedDestination(bookingId: string): Promise<void> {
  await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), {
    tripStage: 'Arrived Destination',
    arrivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Saves toll receipts as they are added so a page reload doesn't lose them. */
export async function saveTripTolls(bookingId: string, tolls: TollReceipt[]): Promise<void> {
  await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), {
    tolls,
    tollCharges: tolls.reduce((s, t) => s + t.amount, 0),
    updatedAt: serverTimestamp(),
  });
}

export async function completeTrip(
  bookingId: string,
  endOdometer: number,
  tolls: TollReceipt[],
): Promise<void> {
  await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), {
    status: 'Completed',
    tripStage: 'Completed',
    endOdometer,
    tolls,
    tollCharges: tolls.reduce((s, t) => s + t.amount, 0),
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ── Payouts ────────────────────────────────────────────────────────────────

export async function requestPayout(
  driver: DriverProfile,
  amount: number,
  method: 'UPI' | 'Bank Transfer',
  details: string,
): Promise<void> {
  const payoutRef = doc(collection(db, PAYOUT_REQUESTS_COLLECTION));
  await setDoc(payoutRef, {
    id: payoutRef.id,
    driverId: driver.id,
    driverName: driver.name,
    driverPhone: driver.phone,
    amount,
    method,
    details,
    status: 'Pending',
    requestedAt: formatDateTime(new Date()),
    createdAt: serverTimestamp(),
  });
}

export function subscribeToPayoutRequests(driverId: string, callback: (requests: PayoutRequest[]) => void) {
  const q = query(collection(db, PAYOUT_REQUESTS_COLLECTION), where('driverId', '==', driverId));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data();
        const created = toDate(data.createdAt);
        return {
          id: d.id,
          amount: parseAmount(data.amount),
          requestedAt: typeof data.requestedAt === 'string' ? data.requestedAt : formatDateTime(created),
          method: (data.method === 'Bank Transfer' ? 'Bank Transfer' : 'UPI') as PayoutRequest['method'],
          details: str(data.details),
          status: str(data.status) || 'Pending',
          _t: created?.getTime() ?? 0,
        };
      });
      rows.sort((a, b) => b._t - a._t);
      callback(rows.map(({ _t, ...r }) => r));
    },
    (err) => {
      console.warn('Payout subscription error:', err);
      callback([]);
    },
  );
}

// ── Notifications ──────────────────────────────────────────────────────────

export function subscribeToDriverNotifications(recipientId: string, callback: (n: DriverNotification[]) => void) {
  const q = query(collection(db, NOTIFICATIONS_COLLECTION), where('recipientId', '==', recipientId));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data();
        const created = toDate(data.createdAt);
        return {
          id: d.id,
          title: str(data.title) || 'Notification',
          message: str(data.message || data.desc || data.body),
          time: formatDateTime(created),
          read: Boolean(data.read),
          createdAtMs: created?.getTime() ?? 0,
        };
      });
      rows.sort((a, b) => b.createdAtMs - a.createdAtMs);
      callback(rows);
    },
    (err) => {
      console.warn('Notifications subscription error:', err);
      callback([]);
    },
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, id), { read: true, readAt: serverTimestamp() });
}
