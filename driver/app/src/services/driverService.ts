import { getFunctions, httpsCallable } from 'firebase/functions';
// Driver data layer. Copied from driver/web/src/services/driverFirestoreService.ts
// and adapted for the mobile app:
//   • the marketplace claim runs in a transaction that re-checks the offer is
//     still Open (on top of firestore.rules driverClaimOk), so two phones can
//     never both win a trip and the loser gets a clear "taken" error;
//   • the driver's live position is written to bookings/{id}.driverLocation
//     during a trip (driverProgressOk allows it) so the customer can track;
//   • the boarding OTP is only ever submitted as `otpAttempt` — the driver
//     never reads booking_secrets; a wrong code is rejected by the rules.

import {
  writeBatch,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type {
  ApprovalStatus,
  BankDetails,
  BookingStatus,
  DocumentStatus,
  DriverAccount,
  DriverNotification,
  DriverPenalty,
  DriverProfile,
  DriverStatus,
  DriverWallet,
  DrivingLicense,
  IdentityDetails,
  LedgerEntry,
  MarketplaceOffer,
  PayoutRequest,
  PenaltyStatus,
  RegistrationData,
  TollReceipt,
  TripDetails,
  TripStage,
  VehicleCategory,
  VehicleDetails,
} from '../types/driver';
import { withTimeout } from '../utils/retry';
import { toDate as toDateTime } from '../utils/time';
import { tripSubStatusOf } from '../utils/tripFlow';
import { mapLedgerEntry, mapWallet } from '../utils/ledger';
import { categoryOf, ctaOf, severityOf, soundOf } from '../utils/notificationModel';

export const BOOKINGS_COLLECTION = 'bookings';
export const DRIVERS_COLLECTION = 'drivers';
export const MARKETPLACE_COLLECTION = 'marketplace_trips';
export const PAYOUT_REQUESTS_COLLECTION = 'payout_requests';
export const NOTIFICATIONS_COLLECTION = 'notifications';
export const DRIVER_INVITES_COLLECTION = 'driver_invites';

const WRITE_TIMEOUT_MS = 15000;
/** Share of the fare a driver earns when the booking carries no explicit payout. */
export const MIN_PAYOUT = 100;

export class DriverActionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

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
  if (typeof v === 'object' && typeof (v as { toDate?: unknown }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
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

/** Formats an E.164 Indian number (+919876543210) as "+91 98765 43210". */
export function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  if (local.length !== 10) return e164;
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

// ── Empty records ──────────────────────────────────────────────────────────

export const EMPTY_IDENTITY: IdentityDetails = { aadhaarNumber: '', aadhaarFrontUrl: '', aadhaarBackUrl: '', panNumber: '', panPhotoUrl: '' };
export const EMPTY_LICENSE: DrivingLicense = { number: '', expiryDate: '', frontPhotoUrl: '', backPhotoUrl: '' };
export const EMPTY_VEHICLE: VehicleDetails = {
  vehicleNumber: '',
  vehicleType: 'Sedan',
  make: '',
  model: '',
  year: '',
  color: '',
  capacity: 4,
  fuelType: 'Diesel',
  rcNumber: '',
  rcDocUrl: '',
  insuranceNumber: '',
  insuranceExpiry: '',
  insuranceDocUrl: '',
  fitnessExpiry: '',
  fitnessDocUrl: '',
  statePermitNumber: '',
  permitExpiry: '',
  statePermitDocUrl: '',
  frontPhotoUrl: '',
  rearPhotoUrl: '',
  sidePhotoUrl: '',
  interiorPhotoUrl: '',
};
export const EMPTY_BANK: BankDetails = { accountHolder: '', accountNumber: '', ifsc: '', bankName: '', upiId: '' };

export function emptyRegistration(phone: string): RegistrationData {
  return {
    profile: { name: '', phone, email: '', photoUrl: '', dob: '', gender: '', address: '', city: '', pincode: '', emergencyContactName: '', emergencyContact: '' },
    identity: { ...EMPTY_IDENTITY },
    license: { ...EMPTY_LICENSE },
    vehicle: { ...EMPTY_VEHICLE },
    bank: { ...EMPTY_BANK },
  };
}

// ── Driver account (drivers/{uid}) ─────────────────────────────────────────

const APPROVAL_VALUES: ApprovalStatus[] = ['Pending', 'Approved', 'Rejected', 'Suspended'];
const DOC_VALUES: DocumentStatus[] = ['Pending', 'Approved', 'Rejected'];

function pickStrings(src: DocumentData, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) if (src[k] != null) out[k] = str(src[k]);
  return out;
}

export function mapDriverDoc(uid: string, data: DocumentData): DriverAccount {
  const approval = APPROVAL_VALUES.includes(data.status) ? (data.status as ApprovalStatus) : 'Pending';
  const docStatus = DOC_VALUES.includes(data.docStatus) ? (data.docStatus as DocumentStatus) : 'Pending';
  const presence: DriverStatus = data.presenceStatus === 'Online' || data.presenceStatus === 'On Trip' ? data.presenceStatus : 'Offline';
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
    // Only a rating backed by real customer reviews is shown.
    rating: typeof data.rating === 'number' && typeof data.ratingCount === 'number' && data.ratingCount > 0 ? data.rating : null,
    joiningDate: created ? created.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : str(data.joiningDate) || 'New Partner',
    vendorId: data.vendorId || undefined,
    vendorName: data.vendorName || undefined,
    assignedVehicleId: str(data.assignedVehicleId) || undefined,
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
      name: driver.name,
      phone: driver.phone,
      email: driver.email,
      photoUrl: driver.photoUrl,
      dob: driver.dob,
      gender: driver.gender,
      address: driver.address,
      city: driver.city,
      pincode: driver.pincode,
      emergencyContactName: driver.emergencyContactName,
      emergencyContact: driver.emergencyContact,
    },
    identity: { ...EMPTY_IDENTITY, ...pickStrings(id, Object.keys(EMPTY_IDENTITY)) },
    license: {
      ...EMPTY_LICENSE,
      ...pickStrings(li, Object.keys(EMPTY_LICENSE)),
      number: str(li.number || data.licenseNumber),
      expiryDate: str(li.expiryDate || data.licenseExpiry),
    },
    vehicle: {
      ...EMPTY_VEHICLE,
      ...pickStrings(vi, Object.keys(EMPTY_VEHICLE).filter((k) => k !== 'capacity')),
      vehicleType: (vi.vehicleType || 'Sedan') as VehicleCategory,
      capacity: typeof vi.capacity === 'number' ? vi.capacity : 4,
    },
    bank: { ...EMPTY_BANK, ...pickStrings(bank, Object.keys(EMPTY_BANK)) },
  };
}

export function subscribeToDriverAccount(uid: string, callback: (account: DriverAccount | null) => void, onError?: (error: unknown) => void) {
  let profile: Record<string, unknown> | null | undefined;
  let privateFields: Record<string, unknown> | undefined;
  const emit = () => {
    if (profile === undefined || privateFields === undefined) return;
    callback(profile ? mapDriverDoc(uid, { ...profile, ...privateFields }) : null);
  };
  const a = onSnapshot(doc(db, DRIVERS_COLLECTION, uid), snap => {
    if (!snap.exists() && snap.metadata.fromCache) return;
    profile = snap.exists() ? snap.data() : null; emit();
  }, err => onError?.(err));
  const b = onSnapshot(doc(db, 'driver_private', uid), snap => {
    if (!snap.exists() && snap.metadata.fromCache) return;
    privateFields = snap.data() ?? {}; emit();
  }, err => onError?.(err));
  return () => { a(); b(); };
}
export interface DriverInvite {
  name?: string;
  vendorId?: string;
  vendorName?: string;
  preApproved?: boolean;
}

/** An admin or vendor may pre-register a driver by phone number. */
export async function getDriverInvite(phoneE164: string): Promise<DriverInvite | null> {
  if (!phoneE164) return null;
  try {
    const snap = await getDoc(doc(db, DRIVER_INVITES_COLLECTION, phoneE164));
    return snap.exists() ? (snap.data() as DriverInvite) : null;
  } catch {
    return null;
  }
}

/** Write operational and private fields atomically; no bank/identity data leaks to vendor readers. */
async function writeDriverProfile(uid: string, payload: Record<string, unknown>, create = false): Promise<void> {
  const { bank, identity, ...publicFields } = payload;
  const batch = writeBatch(db);
  const ref = doc(db, DRIVERS_COLLECTION, uid);
  if (create) batch.set(ref, publicFields); else batch.update(ref, publicFields);
  if (bank || identity) batch.set(doc(db, 'driver_private', uid), {
    ...(bank ? { bank } : {}), ...(identity ? { identity } : {}), updatedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}
/** Flattened fields kept alongside the nested records for the admin/vendor panels. */
export function registrationFields(data: RegistrationData) {
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
    vehicleInfo: { ...v, vehicleNumber: v.vehicleNumber.trim().toUpperCase(), rcNumber: v.rcNumber.trim().toUpperCase() },
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

/** The drivers/{uid} document firestore.rules (driverSelfCreateOk) accepts. */
export function buildNewDriverDoc(uid: string, phoneE164: string, data: RegistrationData, invite: DriverInvite | null) {
  return {
    ...registrationFields(data),
    uid,
    id: uid,
    phone: phoneE164 ? formatPhone(phoneE164) : data.profile.phone,
    phoneE164,
    role: 'driver',
    status: invite?.preApproved ? 'Approved' : 'Pending',
    verified: false,
    vendorId: invite?.vendorId || '',
    vendorName: invite?.vendorName || '',
    presenceStatus: 'Offline',
    createdAt: serverTimestamp(),
  };
}

/** Creates drivers/{uid}; Pending until an admin approves (unless pre-approved by invite). */
export async function registerDriver(data: RegistrationData): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new DriverActionError('unauthenticated', 'Your session has expired. Please sign in again.');
  const phoneE164 = user.phoneNumber || '';
  const invite = await getDriverInvite(phoneE164);
  await withTimeout(writeDriverProfile(user.uid, buildNewDriverDoc(user.uid, phoneE164, data, invite), true), WRITE_TIMEOUT_MS);
}

/**
 * Updates KYC details. A rejected driver goes back to 'Pending' for another
 * review; an approved driver stays approved but docStatus drops to 'Pending'.
 */
export async function resubmitDriverDocuments(uid: string, data: RegistrationData, currentStatus: ApprovalStatus): Promise<void> {
  await withTimeout(
    writeDriverProfile(uid, {
      ...registrationFields(data),
      ...(currentStatus === 'Rejected' ? { status: 'Pending', rejectionReason: '' } : {}),
    }),
    WRITE_TIMEOUT_MS,
  );
}

export type ContactFields = Pick<DriverProfile, 'email' | 'address' | 'city' | 'pincode' | 'emergencyContactName' | 'emergencyContact'> & {
  bank: BankDetails;
};

/** Contact / payout details that don't need re-verification. */
export async function updateDriverContactDetails(uid: string, fields: ContactFields): Promise<void> {
  await withTimeout(writeDriverProfile(uid, { ...fields, updatedAt: serverTimestamp() }), WRITE_TIMEOUT_MS);
}

/** Online/offline presence: `presenceStatus`, never `status` (admin approval). */
export async function setDriverPresence(uid: string, presence: DriverStatus): Promise<void> {
  await withTimeout(
    writeDriverProfile(uid, { presenceStatus: presence, lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    WRITE_TIMEOUT_MS,
  );
}

// ── Marketplace ────────────────────────────────────────────────────────────

export function mapOffer(id: string, data: DocumentData): MarketplaceOffer & { createdMs: number } {
  const pickup = typeof data.pickup === 'object' && data.pickup ? data.pickup : { address: str(data.pickup) };
  const drop = typeof data.drop === 'object' && data.drop ? data.drop : { address: str(data.drop) };
  return {
    id,
    bookingId: str(data.bookingId) || id,
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
    createdMs: toDate(data.createdAt)?.getTime() ?? 0,
  };
}

export function subscribeToOpenMarketplace(callback: (offers: MarketplaceOffer[]) => void, onError?: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, MARKETPLACE_COLLECTION), where('status', '==', 'Open')),
    (snap) => {
      const offers = snap.docs.map((d) => mapOffer(d.id, d.data()));
      offers.sort((a, b) => b.createdMs - a.createdMs);
      callback(offers.map(({ createdMs: _createdMs, ...o }) => o));
    },
    (err) => {
      callback([]);
      onError?.(err);
    },
  );
}

/** Booking fields an independent driver's claim writes (rules: driverClaimOk). */
export function buildClaimUpdate(driver: DriverProfile, vehicle: { id: string; number: string }, offeredPayout: number) {
  return {
    status: 'Assigned',
    tripStage: 'Assigned',
    assignedDriverId: driver.id,
    assignedDriverName: driver.name,
    driver: driver.name,
    driverPhone: driver.phone,
    // '' when the driver has no paired vehicle record (rules: must equal drivers/{uid}.assignedVehicleId).
    assignedVehicleId: vehicle.id,
    assignedVehicleNumber: vehicle.number,
    driverPayout: offeredPayout,
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Claims an open marketplace booking atomically. The transaction re-reads the
 * offer; if another partner took it first the transaction aborts cleanly, and
 * firestore.rules independently reject any claim of a non-Open trip.
 */
export async function acceptMarketplaceTrip(driver: DriverProfile, registeredVehicleNumber: string, offer: MarketplaceOffer): Promise<void> {
  if (driver.vendorId) throw new DriverActionError('taken', 'Fleet drivers receive trips from their vendor, not the marketplace.');
  const marketRef = doc(db, MARKETPLACE_COLLECTION, offer.id);
  const bookingRef = doc(db, BOOKINGS_COLLECTION, offer.id);
  // A driver paired with a vehicle record takes the trip in that vehicle (its id
  // and exact registration number); otherwise the registered number is noted.
  let vehicle = { id: '', number: registeredVehicleNumber };
  if (driver.assignedVehicleId) {
    const v = await getDoc(doc(db, 'vehicles', driver.assignedVehicleId));
    const number = v.exists() ? str(v.data().vehicleNumber) : '';
    if (!number) throw new DriverActionError('taken', 'Your paired vehicle record is unavailable. Contact NESAM support.');
    vehicle = { id: v.id, number };
  }
  try {
    await withTimeout(
      runTransaction(db, async (tx) => {
        const snap = await tx.get(marketRef);
        if (!snap.exists() || snap.data().status !== 'Open') {
          throw new DriverActionError('taken', 'This trip is no longer available — another partner has taken it.');
        }
        tx.update(bookingRef, buildClaimUpdate(driver, vehicle, offer.offeredPayout));
        tx.update(marketRef, { status: 'Assigned', assignedDriverId: driver.id, assignedDriverName: driver.name, updatedAt: serverTimestamp() });
      }),
      WRITE_TIMEOUT_MS,
    );
  } catch (err) {
    if (err instanceof DriverActionError) throw err;
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'permission-denied' || code === 'failed-precondition' || code === 'aborted') {
      throw new DriverActionError('taken', 'This trip is no longer available — another partner may have taken it, or it was cancelled.');
    }
    throw err;
  }
}

// ── Assigned bookings / trip execution ─────────────────────────────────────

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Bookings store a location as flat fields (pickup/pickupAddress/pickupLat…) or as an object. */
function readLocation(data: DocumentData, key: 'pickup' | 'drop', fallback: string) {
  const v = data[key];
  if (v && typeof v === 'object') {
    return {
      address: str(v.address || v.name || data[`${key}Address`]) || fallback,
      lat: num(v.lat) ?? num(data[`${key}Lat`]),
      lng: num(v.lng) ?? num(data[`${key}Lng`]),
    };
  }
  return { address: str(data[`${key}Address`] || v) || fallback, lat: num(data[`${key}Lat`]), lng: num(data[`${key}Lng`]) };
}

const STAGES: TripStage[] = ['Assigned', 'En Route Pickup', 'Reached Pickup', 'In Progress', 'Arrived Destination', 'Completed'];
const STATUSES: BookingStatus[] = ['Pending', 'Approved', 'Confirmed', 'Assigned', 'Ongoing', 'Completed', 'Cancelled', 'Rejected'];
const LEGACY_STAGE: Record<string, TripStage> = { 'Not Started': 'Assigned', 'Reached Pickup': 'Reached Pickup', 'Trip Started': 'In Progress', 'Trip Ended': 'Completed' };

export function mapBooking(id: string, data: DocumentData): TripDetails {
  const fare = parseAmount(data.fare);
  const raw = str(data.status);
  const status: BookingStatus = (STATUSES as string[]).includes(raw) ? (raw as BookingStatus) : raw === 'Trip Started' ? 'Ongoing' : 'Pending';
  const subStatus = tripSubStatusOf(data);
  // The server mirrors the sub-status into tripStage; trips from before it existed keep their own stage.
  let stage: TripStage = STAGES.includes(data.tripStage) ? data.tripStage : (LEGACY_STAGE[subStatus] ?? 'Assigned');
  if (status === 'Completed') stage = 'Completed';

  // The server records the payout; the app never estimates one. Once finance has
  // finalized the trip, its snapshot is the amount that counts.
  const fin = data.finance && typeof data.finance === 'object' && data.finance.schema === 1 ? data.finance : null;
  const finalized = !!fin && fin.partnerType === 'driver' && typeof fin.partnerPayout === 'number' && Number.isFinite(fin.partnerPayout);
  const payoutRecorded = finalized || (data.driverPayout != null && data.driverPayout !== '');
  const payout = finalized ? fin.partnerPayout : payoutRecorded ? parseAmount(data.driverPayout) : 0;
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
    payoutRecorded,
    payoutFinalized: finalized,
    fleetTrip: !!str(data.assignedVendorId) || fin?.partnerType === 'vendor',
    tollCharges: parseAmount(data.tollCharges),
    status,
    stage,
    subStatus: status === 'Completed' ? 'Trip Ended' : subStatus,
    verificationSubmitted: data.vehicleVerification?.status === 'Submitted',
    // Trips started under the earliest flow checked the OTP at start and kept no boarding stamp.
    boardingVerified: !!data.boardingVerifiedAt || (!!data.startedAt && !data.tripStartedAt),
    balanceDue: typeof data.paymentSummary?.balanceDue === "number" ? data.paymentSummary.balanceDue : undefined,
    reachedPickupAt: toDateTime(data.reachedPickupAt),
    pickupAt: toDateTime(data.pickupAt) ?? toDateTime(data.scheduledAt),
    scheduledDate: str(data.date),
    scheduledTime: str(data.time),
    paymentMode: str(data.paymentMethod) || 'Cash',
    notes: str(data.notes),
    startOdometer: typeof data.startOdometer === 'number' ? data.startOdometer : undefined,
    endOdometer: typeof data.endOdometer === 'number' ? data.endOdometer : undefined,
    preTrip: preTrip
      ? {
          vehicleFront: str(preTrip.vehicleFront),
          vehicleRear: str(preTrip.vehicleRear),
          vehicleInterior: str(preTrip.vehicleInterior),
          odometerReading: parseAmount(preTrip.odometerReading),
          capturedAt: str(preTrip.capturedAt),
        }
      : undefined,
    tolls: Array.isArray(data.tolls)
      ? (data.tolls as unknown[]).filter((t): t is TollReceipt => !!t && typeof t === 'object' && typeof (t as TollReceipt).amount === 'number')
      : [],
    completedAt: toDate(data.completedAt),
    assignedAt: toDate(data.assignedAt),
  };
}

/** Every booking ever assigned to this driver (active + history). */
export function subscribeToDriverBookings(driverId: string, callback: (trips: TripDetails[]) => void, onError?: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, BOOKINGS_COLLECTION), where('assignedDriverId', '==', driverId)),
    (snap) => callback(snap.docs.map((d) => mapBooking(d.id, d.data()))),
    (err) => onError?.(err),
  );
}

export function tollTotal(tolls: TollReceipt[]): number {
  return Math.round(tolls.reduce((s, t) => s + (Number.isFinite(t.amount) ? t.amount : 0), 0) * 100) / 100;
}

/** Saves toll/parking receipts as they are added so an app restart doesn't lose them. */
export async function saveTripTolls(bookingId: string, tolls: TollReceipt[]): Promise<void> {
  await withTimeout(
    updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), { tolls, tollCharges: tollTotal(tolls), updatedAt: serverTimestamp() }),
    WRITE_TIMEOUT_MS,
  );
}

/** Live position for the customer's tracking view (allowed while Assigned/Ongoing). */
export async function updateDriverLocation(bookingId: string, loc: { lat: number; lng: number; heading: number | null }): Promise<void> {
  await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), {
    driverLocation: { lat: loc.lat, lng: loc.lng, heading: loc.heading, updatedAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
}

// ── Payouts ────────────────────────────────────────────────────────────────

export function validatePayoutAmount(amount: number, available: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount.';
  if (!Number.isInteger(amount)) return 'Enter a whole-rupee amount.';
  if (amount < MIN_PAYOUT) return `Minimum payout is ₹${MIN_PAYOUT}.`;
  if (amount > available) return 'Amount exceeds your available balance.';
  return '';
}

/** The server re-checks the ledger balance, reserves the amount and pays to the account saved in the profile. */
export async function requestPayout(amount: number, available: number, method: 'UPI' | 'Bank Transfer'): Promise<void> {
  const invalid = validatePayoutAmount(amount, available);
  if (invalid) throw new DriverActionError('invalid-amount', invalid);
  const payoutRef = doc(collection(db, PAYOUT_REQUESTS_COLLECTION));
  await httpsCallable(getFunctions(), 'requestPartnerPayout')({ requestId: payoutRef.id, role: 'driver', amount, method });
}
/** The server-computed wallet (wallets/driver_{uid}); a missing document is an empty wallet. */
export function subscribeToDriverWallet(driverId: string, callback: (wallet: DriverWallet) => void, onError?: (e: unknown) => void) {
  return onSnapshot(
    doc(db, 'wallets', `driver_${driverId}`),
    (snap) => callback(mapWallet(snap.exists() ? snap.data() : undefined)),
    (err) => onError?.(err),
  );
}

/** This driver's ledger entries (schema 2), newest first. */
export function subscribeToDriverLedger(driverId: string, callback: (entries: LedgerEntry[]) => void, onError?: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, 'wallet_ledger'), where('driverId', '==', driverId)),
    (snap) => {
      const rows = snap.docs.map((d) => mapLedgerEntry(d.id, d.data())).filter((e): e is LedgerEntry => e !== null);
      rows.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      callback(rows);
    },
    (err) => {
      callback([]);
      onError?.(err);
    },
  );
}

export function subscribeToPayoutRequests(driverId: string, callback: (requests: PayoutRequest[]) => void, onError?: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, PAYOUT_REQUESTS_COLLECTION), where('driverId', '==', driverId)),
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
          utr: str(data.utr || data.transactionRef || data.referenceId),
          processedAt: str(data.processedAt),
          t: created?.getTime() ?? 0,
        };
      });
      rows.sort((a, b) => b.t - a.t);
      callback(rows.map(({ t: _t, ...r }) => r));
    },
    (err) => {
      callback([]);
      onError?.(err);
    },
  );
}

// ── Notifications ──────────────────────────────────────────────────────────

export function subscribeToDriverNotifications(recipientId: string, callback: (n: DriverNotification[]) => void) {
  return onSnapshot(
    query(collection(db, NOTIFICATIONS_COLLECTION), where('recipientId', '==', recipientId)),
    (snap) => {
      const rows = snap.docs.map((d): DriverNotification => {
        const data = d.data();
        const created = toDateTime(data.createdAt);
        const base = { type: str(data.type), category: str(data.category), severity: str(data.severity), priority: str(data.priority), sound: str(data.sound), cta: data.cta, bookingId: str(data.bookingId) };
        return {
          id: d.id,
          title: str(data.title) || 'Notification',
          message: str(data.message || data.desc || data.body),
          time: formatDateTime(created),
          read: Boolean(data.read),
          createdAtMs: created?.getTime() ?? 0,
          category: categoryOf(base),
          severity: severityOf(base),
          sound: soundOf(base),
          bookingId: str(data.bookingId),
          bookingCode: str(data.bookingCode),
          ...ctaOf(base),
          popup: data.push !== false,
        };
      });
      rows.sort((a, b) => b.createdAtMs - a.createdAtMs);
      callback(rows);
    },
    () => callback([]),
  );
}

const PENALTY_STATUSES: PenaltyStatus[] = ['Pending', 'Acknowledged', 'Paid', 'Deducted', 'Waived', 'Disputed'];
const LEGACY_PENALTY: Record<string, PenaltyStatus> = { Applied: 'Pending', Recovered: 'Paid', Reversed: 'Waived' };

/** Penalties issued to this driver (read-only here; acknowledging and disputing are server functions). */
export function subscribeToDriverPenalties(driverId: string, callback: (p: DriverPenalty[]) => void, onError?: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, 'penalties'), where('driverId', '==', driverId)),
    (snap) => {
      const rows = snap.docs.map((d): DriverPenalty => {
        const data = d.data();
        const raw = str(data.status);
        return {
          id: d.id,
          amount: parseAmount(data.amount),
          category: str(data.category) || 'Other',
          reason: str(data.reason),
          description: str(data.description || data.notes),
          bookingCode: str(data.bookingCode),
          bookingId: str(data.bookingDocumentId),
          incidentDate: str(data.incidentDate),
          status: PENALTY_STATUSES.includes(raw as PenaltyStatus) ? (raw as PenaltyStatus) : (LEGACY_PENALTY[raw] ?? 'Pending'),
          acknowledged: data.acknowledged === true,
          acknowledgedAt: toDateTime(data.acknowledgedAt),
          disputeNote: str(data.disputeNote),
          issuedAt: toDateTime(data.issuedAt) ?? toDateTime(data.createdAt),
          issuedByName: str(data.issuedByName),
        };
      });
      rows.sort((a, b) => (b.issuedAt?.getTime() ?? 0) - (a.issuedAt?.getTime() ?? 0));
      callback(rows);
    },
    (err) => {
      callback([]);
      onError?.(err);
    },
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, id), { read: true, readAt: serverTimestamp() });
}
