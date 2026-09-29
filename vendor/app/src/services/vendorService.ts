import { getFunctions, httpsCallable } from 'firebase/functions';
// Vendor operations: marketplace, bidding, dispatch, fleet, drivers, invites
// and payouts.
//
// The Vendor Web dashboard service (vendor/web/src/services/vendorFirestoreService.ts)
// is NOT a usable reference here — it assigns a fabricated driver on accept,
// swallows rule rejections and fills gaps with mock values (audit VEN-W1).
// These functions are written against firestore.rules, the actual contract:
//   vendorClaimOk / marketplace "vendor accepts" (accept offered rate),
//   bids create + marketplace "Bidding" bookkeeping (counter-bid),
//   vendorDispatchOk (assign one of the vendor's own drivers),
//   vehicles (docStatus stays Pending on vendor edits), drivers fleet fields,
//   driver_invites (never preApproved), payout_requests (status Pending).
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  DriverInviteRecord,
  FleetDriver,
  FleetVehicle,
  MarketTrip,
  VendorBid,
  VendorBooking,
  VendorPayoutRequest,
  VehicleStatus,
} from '../types/operations';
import { num, str, toDate } from '../utils/format';
import { withTimeout } from '../utils/retry';

export const MIN_PAYOUT = 500;
export const DEFAULT_COMMISSION_RATE = 0.15;
/** A counter-bid may not exceed this multiple of the offered payout. */
export const MAX_COUNTER_MULTIPLE = 3;

export class VendorActionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface VendorIdentity {
  id: string;
  companyName: string;
  phone: string;
}

// ── Marketplace ────────────────────────────────────────────────────────────

export function mapMarketTrip(id: string, d: DocumentData): MarketTrip {
  const pickup = d.pickup && typeof d.pickup === 'object' ? d.pickup : { address: str(d.pickup) };
  const drop = d.drop && typeof d.drop === 'object' ? d.drop : { address: str(d.drop) };
  return {
    id,
    bookingId: str(d.bookingId) || id,
    route: str(d.route) || `${str(pickup.city || pickup.address)} ➔ ${str(drop.city || drop.address)}`,
    pickup: { address: str(pickup.address) || 'Pickup', city: str(pickup.city), time: str(pickup.time) },
    drop: { address: str(drop.address) || 'Drop', city: str(drop.city) },
    travelDate: str(d.travelDate),
    service: str(d.service),
    tripType: str(d.tripType),
    vehicleCategory: str(d.vehicleCategory || d.categoryName),
    distanceKm: num(d.distanceKm),
    offeredPayout: num(d.offeredPayout),
    status: str(d.status) || 'Open',
    bidCount: num(d.bidCount),
    createdMs: toDate(d.createdAt)?.getTime() ?? 0,
  };
}

export function subscribeToMarketplace(cb: (trips: MarketTrip[]) => void, onError?: (e: unknown) => void): () => void {
  return onSnapshot(
    query(collection(db, 'marketplace_trips'), where('status', 'in', ['Open', 'Bidding'])),
    (snap) => {
      const trips = snap.docs.map((d) => mapMarketTrip(d.id, d.data()));
      trips.sort((a, b) => b.createdMs - a.createdMs);
      cb(trips);
    },
    (err) => {
      cb([]);
      onError?.(err);
    },
  );
}

/** Booking fields written when a vendor takes a trip at the offered rate (vendorClaimOk). */
export function buildVendorClaimUpdate(vendor: VendorIdentity, offeredPayout: number) {
  return {
    status: 'Confirmed',
    assignedVendorId: vendor.id,
    assignedVendorName: vendor.companyName,
    vendorPayout: offeredPayout,
    confirmedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Accepts a marketplace trip at the offered rate. The transaction re-reads
 * the offer so two vendors (or a vendor and a driver) can never both win; the
 * rules independently reject a claim on a trip that is no longer open.
 */
export async function acceptOfferedRate(vendor: VendorIdentity, trip: MarketTrip): Promise<void> {
  const marketRef = doc(db, 'marketplace_trips', trip.id);
  try {
    await withTimeout(
      runTransaction(db, async (tx) => {
        const snap = await tx.get(marketRef);
        const status = snap.exists() ? str(snap.data().status) : '';
        if (status !== 'Open' && status !== 'Bidding') {
          throw new VendorActionError('taken', 'This trip is no longer available — another partner has taken it.');
        }
        const payout = num(snap.data()?.offeredPayout) || trip.offeredPayout;
        tx.update(doc(db, 'bookings', trip.id), buildVendorClaimUpdate(vendor, payout));
        tx.update(marketRef, { status: 'Assigned', assignedVendorId: vendor.id, assignedVendorName: vendor.companyName, updatedAt: serverTimestamp() });
      }),
      15000,
    );
  } catch (err) {
    if (err instanceof VendorActionError) throw err;
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'permission-denied' || code === 'failed-precondition' || code === 'aborted') {
      throw new VendorActionError('taken', 'This trip is no longer available — it may have been taken or withdrawn.');
    }
    throw err;
  }
}

export function validateCounterRate(rate: number, offered: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return 'Enter your counter rate.';
  if (!Number.isInteger(rate)) return 'Enter a whole-rupee amount.';
  if (offered > 0 && rate === offered) return 'That is the offered rate — use “Accept offered rate” instead.';
  if (offered > 0 && rate > offered * MAX_COUNTER_MULTIPLE) return `Counter rate looks too high (max ₹${Math.round(offered * MAX_COUNTER_MULTIPLE)}).`;
  return '';
}

/** Submits a counter-bid. Each bid is its own auto-id document, so vendors can't overwrite each other. */
export async function submitCounterBid(vendor: VendorIdentity, trip: MarketTrip, rate: number, note: string): Promise<void> {
  const invalid = validateCounterRate(rate, trip.offeredPayout);
  if (invalid) throw new VendorActionError('invalid-rate', invalid);
  const marketRef = doc(db, 'marketplace_trips', trip.id);
  const bidRef = doc(collection(marketRef, 'bids'));
  const batch = writeBatch(db);
  batch.set(bidRef, {
    tripId: trip.id,
    bookingId: trip.bookingId,
    vendorId: vendor.id,
    vendorName: vendor.companyName,
    vendorPhone: vendor.phone,
    offeredPayout: trip.offeredPayout,
    vendorCounterRate: rate,
    biddingNote: note.trim().slice(0, 300),
    status: 'Pending Review',
    source: 'vendor-app',
    submittedAt: serverTimestamp(),
  });
  batch.update(marketRef, { status: 'Bidding', bidCount: increment(1), lastCounterRate: rate, lastBidAt: serverTimestamp(), updatedAt: serverTimestamp() });
  try {
    await withTimeout(batch.commit(), 15000);
  } catch (err) {
    if ((err as { code?: string })?.code === 'permission-denied') {
      throw new VendorActionError('closed', 'Bidding has closed on this trip.');
    }
    throw err;
  }
}

export function mapBid(id: string, d: DocumentData): VendorBid {
  return {
    id,
    tripId: str(d.tripId),
    bookingId: str(d.bookingId) || str(d.tripId),
    offeredPayout: num(d.offeredPayout),
    vendorCounterRate: num(d.vendorCounterRate),
    biddingNote: str(d.biddingNote),
    status: str(d.status) || 'Pending Review',
    submittedAt: toDate(d.submittedAt),
  };
}

export function subscribeToMyBids(vendorId: string, cb: (bids: VendorBid[]) => void, onError?: (e: unknown) => void): () => void {
  return onSnapshot(
    query(collectionGroup(db, 'bids'), where('vendorId', '==', vendorId)),
    (snap) => {
      const bids = snap.docs.map((d) => mapBid(d.id, d.data()));
      bids.sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
      cb(bids);
    },
    (err) => {
      cb([]);
      onError?.(err);
    },
  );
}

/** Withdraws a bid still under review (rules allow delete only while 'Pending Review'). */
export async function withdrawBid(bid: VendorBid): Promise<void> {
  if (bid.status !== 'Pending Review') throw new VendorActionError('locked', 'Only bids under review can be withdrawn.');
  await withTimeout(deleteDoc(doc(db, 'marketplace_trips', bid.tripId, 'bids', bid.id)), 15000);
}

// ── Awarded trips & dispatch ───────────────────────────────────────────────

export function mapVendorBooking(id: string, d: DocumentData): VendorBooking {
  return {
    id,
    bookingId: str(d.bookingId) || id,
    customerName: str(d.customer || d.customerName) || 'Passenger',
    customerPhone: str(d.phone || d.customerPhone),
    pickupAddress: str(d.pickupAddress || d.pickup) || 'Pickup',
    dropAddress: str(d.dropAddress || d.drop) || 'Destination',
    date: str(d.date),
    time: str(d.time),
    vehicleCategory: str(d.vehicleCategory || d.vehicle),
    status: str(d.status),
    tripStage: str(d.tripStage),
    driverId: str(d.assignedDriverId),
    driverName: str(d.assignedDriverName || d.driver),
    driverPhone: str(d.driverPhone),
    vehicleNumber: str(d.assignedVehicleNumber),
    fare: num(d.fare),
    vendorPayout: num(d.vendorPayout),
    tollCharges: num(d.tollCharges),
    withdrawableAmount: d.status === 'Completed' && d.fareVerified === true && d.payment === 'Paid' && d.paymentMethod !== 'Cash'
      ? Math.max(0, num(d.vendorPayout)) + (d.tollsApproved === true ? Math.max(0, num(d.tollCharges)) : 0) : 0,
    paymentMethod: str(d.paymentMethod),
    confirmedAt: toDate(d.confirmedAt),
    completedAt: toDate(d.completedAt),
  };
}

export function subscribeToVendorBookings(vendorId: string, cb: (b: VendorBooking[]) => void, onError?: (e: unknown) => void): () => void {
  return onSnapshot(
    query(collection(db, 'bookings'), where('assignedVendorId', '==', vendorId)),
    (snap) => cb(snap.docs.map((d) => mapVendorBooking(d.id, d.data()))),
    (err) => onError?.(err),
  );
}

export const isActiveBooking = (b: VendorBooking) => b.status === 'Confirmed' || b.status === 'Assigned' || b.status === 'Ongoing';
export const canDispatch = (b: VendorBooking) => b.status === 'Confirmed' || (b.status === 'Assigned' && (!b.tripStage || b.tripStage === 'Assigned'));

/** Booking fields written when dispatching a driver (vendorDispatchOk allow-list). */
export function buildDispatchUpdate(driver: FleetDriver, vehicleNumber: string) {
  return {
    status: 'Assigned',
    tripStage: 'Assigned',
    assignedDriverId: driver.id,
    assignedDriverName: driver.name,
    driver: driver.name,
    driverPhone: driver.phone,
    assignedVehicleNumber: vehicleNumber,
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/** Why a driver can't take this trip right now ('' when they can). */
export function dispatchBlocker(driver: FleetDriver, bookings: VendorBooking[], forBookingId: string): string {
  if (driver.approvalStatus !== 'Approved') return `${driver.name} is not approved by NESAM yet.`;
  if (driver.fleetStatus === 'Suspended') return `${driver.name} is suspended in your fleet.`;
  const busy = bookings.find((b) => b.id !== forBookingId && b.driverId === driver.id && (b.status === 'Assigned' || b.status === 'Ongoing'));
  if (busy) return `${driver.name} is already on trip ${busy.bookingId}.`;
  return '';
}

export async function dispatchDriver(booking: VendorBooking, driver: FleetDriver, vehicleNumber: string, allBookings: VendorBooking[]): Promise<void> {
  if (!canDispatch(booking)) throw new VendorActionError('locked', 'This trip has already started — the driver can no longer be changed.');
  const blocker = dispatchBlocker(driver, allBookings, booking.id);
  if (blocker) throw new VendorActionError('driver-busy', blocker);
  if (!vehicleNumber.trim()) throw new VendorActionError('no-vehicle', 'Choose the vehicle for this trip.');
  await withTimeout(updateDoc(doc(db, 'bookings', booking.id), buildDispatchUpdate(driver, vehicleNumber.trim().toUpperCase())), 15000);
}

// ── Fleet vehicles ─────────────────────────────────────────────────────────

const VEHICLE_STATUSES: VehicleStatus[] = ['Active', 'Maintenance', 'Inactive'];

export function mapVehicle(id: string, d: DocumentData): FleetVehicle {
  const docStatus = str(d.docStatus);
  return {
    id,
    vehicleNumber: str(d.vehicleNumber || d.number),
    category: str(d.category) || 'Sedan',
    make: str(d.make),
    model: str(d.model || d.name),
    year: str(d.year),
    seatingCapacity: num(d.seatingCapacity || d.seats, 4),
    fuelType: str(d.fuelType || d.fuel),
    status: VEHICLE_STATUSES.includes(d.status) ? d.status : 'Active',
    docStatus: docStatus === 'Approved' || docStatus === 'Rejected' ? docStatus : 'Pending',
    rejectionReason: str(d.rejectionReason),
    assignedDriverId: str(d.assignedDriverId),
    assignedDriverName: str(d.assignedDriverName),
    rcNumber: str(d.rcNumber),
    rcDocUrl: str(d.rcDocUrl),
    insuranceExpiry: str(d.insuranceExpiry),
    insuranceDocUrl: str(d.insuranceDocUrl),
    fitnessExpiry: str(d.fitnessExpiry),
    fitnessDocUrl: str(d.fitnessDocUrl),
    permitExpiry: str(d.permitExpiry),
    statePermitDocUrl: str(d.statePermitDocUrl),
  };
}

export function subscribeToFleetVehicles(vendorId: string, cb: (v: FleetVehicle[]) => void, onError?: (e: unknown) => void): () => void {
  return onSnapshot(
    query(collection(db, 'vehicles'), where('vendorId', '==', vendorId)),
    (snap) => cb(snap.docs.map((d) => mapVehicle(d.id, d.data())).sort((a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber))),
    (err) => {
      cb([]);
      onError?.(err);
    },
  );
}

export type VehicleInput = Omit<FleetVehicle, 'id' | 'docStatus' | 'rejectionReason' | 'assignedDriverId' | 'assignedDriverName'>;

export function newVehicleId(): string {
  return doc(collection(db, 'vehicles')).id;
}

/** New vehicles always start docStatus 'Pending' for NESAM review (rules). */
export function buildNewVehicleDoc(vendor: VendorIdentity, id: string, v: VehicleInput) {
  return {
    id,
    ...v,
    vehicleNumber: v.vehicleNumber.trim().toUpperCase(),
    rcNumber: v.rcNumber.trim().toUpperCase(),
    vendorId: vendor.id,
    vendorName: vendor.companyName,
    docStatus: 'Pending',
    assignedDriverId: '',
    assignedDriverName: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function addVehicle(vendor: VendorIdentity, id: string, v: VehicleInput, existing: FleetVehicle[]): Promise<void> {
  const reg = v.vehicleNumber.trim().toUpperCase().replace(/[\s-]/g, '');
  if (existing.some((x) => x.vehicleNumber.toUpperCase().replace(/[\s-]/g, '') === reg)) {
    throw new VendorActionError('duplicate', 'This vehicle is already in your fleet.');
  }
  await withTimeout(setDoc(doc(db, 'vehicles', id), buildNewVehicleDoc(vendor, id, v)), 15000);
}

/** Document changes send the vehicle back to NESAM review. */
export async function updateVehicleDocuments(id: string, patch: Partial<VehicleInput>): Promise<void> {
  await withTimeout(updateDoc(doc(db, 'vehicles', id), { ...patch, docStatus: 'Pending', updatedAt: serverTimestamp() }), 15000);
}

export async function setVehicleStatus(id: string, status: VehicleStatus): Promise<void> {
  await withTimeout(updateDoc(doc(db, 'vehicles', id), { status, updatedAt: serverTimestamp() }), 15000);
}

export async function deleteVehicle(v: FleetVehicle): Promise<void> {
  if (v.assignedDriverId) throw new VendorActionError('assigned', `Unassign ${v.assignedDriverName || 'the driver'} before removing this vehicle.`);
  await withTimeout(deleteDoc(doc(db, 'vehicles', v.id)), 15000);
}

// ── Fleet drivers ──────────────────────────────────────────────────────────

export function mapFleetDriver(id: string, d: DocumentData): FleetDriver {
  const li = d.licenseInfo || {};
  const vi = d.vehicleInfo || {};
  return {
    id,
    name: str(d.name) || 'Driver',
    phone: str(d.phone),
    photoUrl: str(d.photoUrl),
    approvalStatus: str(d.status) || 'Pending',
    presenceStatus: str(d.presenceStatus) || 'Offline',
    fleetStatus: d.fleetStatus === 'Suspended' ? 'Suspended' : 'Active',
    licenseNumber: str(li.number || d.licenseNumber),
    licenseExpiry: str(li.expiryDate || d.licenseExpiry),
    vehicleType: str(vi.vehicleType || d.vehicleType),
    ownVehicleNumber: str(vi.vehicleNumber || d.vehicleNumber),
    assignedVehicleId: str(d.assignedVehicleId),
    assignedVehicleNumber: str(d.assignedVehicleNumber),
    rating: num(d.rating, 5),
    docStatus: str(d.docStatus) || 'Pending',
  };
}

export function subscribeToFleetDrivers(vendorId: string, cb: (d: FleetDriver[]) => void, onError?: (e: unknown) => void): () => void {
  return onSnapshot(
    query(collection(db, 'drivers'), where('vendorId', '==', vendorId)),
    (snap) => cb(snap.docs.map((d) => mapFleetDriver(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name))),
    (err) => {
      cb([]);
      onError?.(err);
    },
  );
}

/**
 * Links a vehicle to a driver (or unlinks with vehicle = null). Writes only
 * the fleet fields the rules allow on drivers/{id} and keeps the vehicle's
 * assignedDriver fields in step, releasing any previous pairing.
 */
export async function assignVehicle(driver: FleetDriver, vehicle: FleetVehicle | null, vehicles: FleetVehicle[]): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'drivers', driver.id), {
    assignedVehicleId: vehicle?.id ?? '',
    assignedVehicleNumber: vehicle?.vehicleNumber ?? '',
    updatedAt: serverTimestamp(),
  });
  // Release whatever this driver or this vehicle was paired with before.
  for (const v of vehicles) {
    const wasDriversVehicle = v.assignedDriverId === driver.id && v.id !== vehicle?.id;
    if (wasDriversVehicle) batch.update(doc(db, 'vehicles', v.id), { assignedDriverId: '', assignedDriverName: '', updatedAt: serverTimestamp() });
  }
  if (vehicle) {
    batch.update(doc(db, 'vehicles', vehicle.id), { assignedDriverId: driver.id, assignedDriverName: driver.name, updatedAt: serverTimestamp() });
    if (vehicle.assignedDriverId && vehicle.assignedDriverId !== driver.id) {
      batch.update(doc(db, 'drivers', vehicle.assignedDriverId), { assignedVehicleId: '', assignedVehicleNumber: '', updatedAt: serverTimestamp() });
    }
  }
  await withTimeout(batch.commit(), 15000);
}

export async function setDriverFleetStatus(driverId: string, fleetStatus: 'Active' | 'Suspended'): Promise<void> {
  await withTimeout(updateDoc(doc(db, 'drivers', driverId), { fleetStatus, updatedAt: serverTimestamp() }), 15000);
}

// ── Driver invites ─────────────────────────────────────────────────────────

export function subscribeToInvites(vendorId: string, cb: (i: DriverInviteRecord[]) => void): () => void {
  return onSnapshot(
    query(collection(db, 'driver_invites'), where('vendorId', '==', vendorId)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => {
            const x = d.data();
            return { phone: d.id, name: str(x.name), vehicleAssignment: str(x.vehicleAssignment), createdAt: toDate(x.createdAt) };
          })
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
      ),
    () => cb([]),
  );
}

/** Pre-registers a driver by phone (doc id = +91XXXXXXXXXX). Never pre-approved. */
export async function inviteDriver(vendor: VendorIdentity, mobile10: string, name: string, vehicleNumber: string): Promise<void> {
  if (!/^[6-9]\d{9}$/.test(mobile10)) throw new VendorActionError('invalid-phone', 'Enter a valid 10-digit mobile number.');
  if (name.trim().length < 2) throw new VendorActionError('invalid-name', 'Enter the driver’s name.');
  const phone = `+91${mobile10}`;
  try {
    await withTimeout(
      setDoc(doc(db, 'driver_invites', phone), {
        phone,
        name: name.trim(),
        vendorId: vendor.id,
        vendorName: vendor.companyName,
        vehicleAssignment: vehicleNumber.trim().toUpperCase() || null,
        preApproved: false,
        createdAt: serverTimestamp(),
      }),
      15000,
    );
  } catch (err) {
    if ((err as { code?: string })?.code === 'permission-denied') {
      throw new VendorActionError('taken', 'This number has already been invited by another fleet or by NESAM.');
    }
    throw err;
  }
}

export async function revokeInvite(phone: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db, 'driver_invites', phone)), 15000);
}

// ── Payouts ────────────────────────────────────────────────────────────────

export function subscribeToVendorPayouts(vendorId: string, cb: (p: VendorPayoutRequest[]) => void): () => void {
  return onSnapshot(
    query(collection(db, 'payout_requests'), where('vendorId', '==', vendorId)),
    (snap) => {
      const rows = snap.docs.map((d) => {
        const x = d.data();
        const created = toDate(x.createdAt);
        return {
          id: d.id,
          amount: num(x.amount),
          method: (x.method === 'Bank Transfer' || x.payoutMethod === 'Bank Transfer' ? 'Bank Transfer' : 'UPI') as VendorPayoutRequest['method'],
          details: str(x.details || x.targetDetails),
          status: str(x.status) || 'Pending',
          requestedAt: str(x.requestedAt) || (created ? created.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''),
          utr: str(x.utr || x.transactionRef || x.referenceId),
          processedAt: str(x.processedAt),
          createdMs: created?.getTime() ?? 0,
        };
      });
      rows.sort((a, b) => b.createdMs - a.createdMs);
      cb(rows);
    },
    () => cb([]),
  );
}

export function validateVendorPayout(amount: number, available: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount.';
  if (!Number.isInteger(amount)) return 'Enter a whole-rupee amount.';
  if (amount < MIN_PAYOUT) return `Minimum payout is ₹${MIN_PAYOUT}.`;
  if (amount > available) return 'Amount exceeds your available balance.';
  return '';
}

export async function requestVendorPayout(vendor: VendorIdentity, amount: number, available: number, method: 'UPI' | 'Bank Transfer', details: string): Promise<void> {
  const invalid = validateVendorPayout(amount, available);
  if (invalid) throw new VendorActionError('invalid-amount', invalid);
  const ref = doc(collection(db, 'payout_requests'));
  await httpsCallable(getFunctions(), 'requestPartnerPayout')({ requestId: ref.id, role: 'vendor', amount, method });
}
