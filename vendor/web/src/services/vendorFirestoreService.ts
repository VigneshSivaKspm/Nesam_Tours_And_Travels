import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  runTransaction,
  addDoc,
  collection,
  collectionGroup,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { describeDataError } from "../utils/retry";
import type {
  BidProposal,
  FleetDriver,
  FleetVehicle,
  OpenTrip,
  PayoutRequest,
  TransactionRecord,
  VendorTrip,
  WalletDetails,
} from "../types";
import {
  mapBid,
  mapDriver,
  mapLedgerEntry,
  mapOpenTrip,
  mapPayout,
  mapVehicle,
  mapVendorTrip,
  mapWallet,
} from "./vendorMappers";

export const VEHICLES_COLLECTION = "vehicles";
export const DRIVERS_COLLECTION = "drivers";
export const MARKETPLACE_COLLECTION = "marketplace_trips";
export const BOOKINGS_COLLECTION = "bookings";
export const PAYOUTS_COLLECTION = "payout_requests";

type OnError = (message: string) => void;

/** Live list; a listener failure is reported (never shown as an empty list). */
function listen<T>(q: ReturnType<typeof query>, map: (id: string, d: Record<string, unknown>) => T | null, cb: (items: T[]) => void, onError: OnError) {
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => map(d.id, d.data() as Record<string, unknown>)).filter((x): x is T => x !== null)),
    (err) => onError(describeDataError(err)),
  );
}

export function subscribeToFleetVehicles(vendorId: string, cb: (vehicles: FleetVehicle[]) => void, onError: OnError) {
  return listen(query(collection(db, VEHICLES_COLLECTION), where("vendorId", "==", vendorId)), mapVehicle, cb, onError);
}

export function subscribeToFleetDrivers(vendorId: string, cb: (drivers: FleetDriver[]) => void, onError: OnError) {
  return listen(query(collection(db, DRIVERS_COLLECTION), where("vendorId", "==", vendorId)), mapDriver, cb, onError);
}

export interface VehicleCategoryOption {
  id: string;
  name: string;
  seatingCapacity: number | null;
}

/** Vehicle categories configured by NESAM (the only categories a vehicle can be registered under). */
export function subscribeToVehicleCategories(cb: (categories: VehicleCategoryOption[]) => void, onError: OnError) {
  return listen(
    query(collection(db, "vehicle_categories"), where("status", "==", "Active")),
    (id, d) => {
      const name = typeof d.name === "string" ? d.name.trim() : "";
      const seats = typeof d.seatingCapacity === "number" && d.seatingCapacity > 0 ? d.seatingCapacity : null;
      return name ? { id, name, seatingCapacity: seats } : null;
    },
    (cats) => cb(cats.sort((a, b) => a.name.localeCompare(b.name))),
    onError,
  );
}

export interface NewVehicle {
  vehicleNumber: string;
  categoryId: string;
  category: string;
  make: string;
  model: string;
  year: string;
  seatingCapacity: number;
}

/** Registers a vehicle for NESAM document review (firestore.rules: docStatus "Pending"). */
export async function createVehicle(vendorId: string, v: NewVehicle): Promise<string> {
  const ref = await addDoc(collection(db, VEHICLES_COLLECTION), {
    ...v,
    vehicleNumber: v.vehicleNumber.trim().toUpperCase().replace(/\s+/g, " "),
    vendorId,
    status: "Active",
    docStatus: "Pending",
    assignedDriverId: "",
    assignedDriverName: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function setVehicleStatus(vehicleId: string, status: FleetVehicle["status"]) {
  await updateDoc(doc(db, VEHICLES_COLLECTION, vehicleId), { status, updatedAt: serverTimestamp() });
}

/**
 * Pairs a fleet driver with a vehicle (null unpairs). Both records are kept in
 * step in one batch: the vehicle names its driver and the driver its vehicle
 * (by id), and any previous pairing on either side is released.
 */
export async function pairVehicleDriver(vehicle: FleetVehicle, driver: FleetDriver | null, vehicles: FleetVehicle[]) {
  const batch = writeBatch(db);
  const stamp = serverTimestamp();
  batch.update(doc(db, VEHICLES_COLLECTION, vehicle.id), {
    assignedDriverId: driver?.id ?? "",
    assignedDriverName: driver?.name ?? "",
    updatedAt: stamp,
  });
  if (vehicle.assignedDriverId && vehicle.assignedDriverId !== driver?.id) {
    batch.update(doc(db, DRIVERS_COLLECTION, vehicle.assignedDriverId), { assignedVehicleId: "", assignedVehicleNumber: "", updatedAt: stamp });
  }
  if (driver) {
    const previous = vehicles.find((v) => v.id !== vehicle.id && v.assignedDriverId === driver.id);
    if (previous) batch.update(doc(db, VEHICLES_COLLECTION, previous.id), { assignedDriverId: "", assignedDriverName: "", updatedAt: stamp });
    batch.update(doc(db, DRIVERS_COLLECTION, driver.id), { assignedVehicleId: vehicle.id, assignedVehicleNumber: vehicle.vehicleNumber, updatedAt: stamp });
  }
  await batch.commit();
}

/** Fleet-side suspension; a suspended driver can't be dispatched or go on duty for the fleet. */
export async function setDriverSuspended(driverId: string, suspended: boolean) {
  await updateDoc(doc(db, DRIVERS_COLLECTION, driverId), { fleetStatus: suspended ? "Suspended" : "Active", updatedAt: serverTimestamp() });
}

export async function inviteDriverByVendor(phone: string, vendorId: string, vendorName: string, vehicleNumber: string) {
  const digits = phone.replace(/\D/g, "").slice(-10);
  const normalizedPhone = "+91" + digits;
  await setDoc(
    doc(db, "driver_invites", normalizedPhone),
    {
      phone: normalizedPhone,
      vendorId,
      vendorName,
      vehicleAssignment: vehicleNumber || null,
      preApproved: false,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeToOpenMarketplaceTrips(cb: (trips: OpenTrip[]) => void, onError: OnError) {
  // Vendors may read only offers still open to them (firestore.rules).
  return listen(query(collection(db, MARKETPLACE_COLLECTION), where("status", "in", ["Open", "Bidding"])), mapOpenTrip, cb, onError);
}

export function subscribeToVendorBids(vendorId: string, cb: (bids: BidProposal[]) => void, onError: OnError) {
  return listen(query(collectionGroup(db, "bids"), where("vendorId", "==", vendorId)), mapBid, (bids) =>
    cb(bids.sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))), onError);
}

export async function submitBidToFirestore(trip: OpenTrip, counterRate: number, note: string, vendorId: string, vendorName: string) {
  await addDoc(collection(db, MARKETPLACE_COLLECTION, trip.id, "bids"), {
    tripId: trip.id,
    bookingId: trip.bookingId,
    vendorId,
    vendorName,
    vendorCounterRate: counterRate,
    offeredPayout: trip.offeredPayout,
    biddingNote: note.trim(),
    status: "Pending Review",
    submittedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, MARKETPLACE_COLLECTION, trip.id), {
    status: "Bidding",
    lastBidAt: serverTimestamp(),
  });
}

/**
 * Dispatches one of the vendor's drivers in one of its vehicles, referenced by
 * the vehicle's document id (firestore.rules vendorDispatchOk checks both).
 */
export async function assignTripInFirestore(tripId: string, driver: FleetDriver, vehicle: FleetVehicle) {
  await updateDoc(doc(db, BOOKINGS_COLLECTION, tripId), {
    status: "Assigned",
    tripStage: "Assigned",
    assignedDriverId: driver.id,
    assignedDriverName: driver.name,
    driver: driver.name,
    driverPhone: driver.phone,
    assignedVehicleId: vehicle.id,
    assignedVehicleNumber: vehicle.vehicleNumber,
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToVendorActiveTrips(vendorId: string, cb: (trips: VendorTrip[]) => void, onError: OnError) {
  return listen(query(collection(db, BOOKINGS_COLLECTION), where("assignedVendorId", "==", vendorId)), mapVendorTrip, (trips) =>
    cb(trips.filter((t) => t.status !== "Completed" && t.status !== "Cancelled")), onError);
}

export function subscribeToVendorPayouts(vendorId: string, cb: (payouts: PayoutRequest[]) => void, onError: OnError) {
  return listen(query(collection(db, PAYOUTS_COLLECTION), where("vendorId", "==", vendorId)), mapPayout, (payouts) =>
    cb(payouts.sort((a, b) => (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0))), onError);
}

/** The server-computed wallet (functions/src/ledger.ts). The portal never computes a balance. */
export function subscribeToVendorWallet(vendorId: string, cb: (wallet: WalletDetails) => void, onError: OnError) {
  return onSnapshot(
    doc(db, "wallets", `vendor_${vendorId}`),
    (snap) => cb(mapWallet(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)),
    (err) => onError(describeDataError(err)),
  );
}

export function subscribeToVendorLedger(vendorId: string, cb: (entries: TransactionRecord[]) => void, onError: OnError) {
  return listen(query(collection(db, "wallet_ledger"), where("vendorId", "==", vendorId)), mapLedgerEntry, (entries) =>
    cb(entries.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))), onError);
}

/** The server checks the ledger balance and pays to the saved payout account. */
export async function requestVendorPayout(requestId: string, amount: number, method: "UPI" | "Bank Transfer") {
  await httpsCallable(getFunctions(), 'requestPartnerPayout')({ requestId, role: 'vendor', amount, method });
}

export async function acceptOfferedRate(tripId: string, vendorId: string, vendorName: string): Promise<void> {
  await runTransaction(db, async tx => {
    const ref = doc(db, 'marketplace_trips', tripId);
    const snap = await tx.get(ref);
    if (!snap.exists() || !['Open', 'Bidding'].includes(snap.data().status)) throw new Error('This trip is no longer available.');
    const payout = Number(snap.data().offeredPayout);
    if (!Number.isFinite(payout) || payout <= 0) throw new Error('This trip needs an administrator to review its payout.');
    tx.update(doc(db, 'bookings', tripId), { status: 'Confirmed', assignedVendorId: vendorId, assignedVendorName: vendorName,
      vendorPayout: payout, confirmedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    tx.update(ref, { status: 'Assigned', assignedVendorId: vendorId, assignedVendorName: vendorName, updatedAt: serverTimestamp() });
  });
}

/** Human message for a failed write or callable. */
export function describeActionError(err: unknown, fallback: string): string {
  const code = (err as { code?: string }).code || "";
  const message = (err as { message?: string }).message || "";
  if (code === "permission-denied") return "This change isn't allowed for your account or the record changed. Refresh and try again.";
  if (/^functions\/(invalid-argument|failed-precondition|permission-denied|unauthenticated)$/.test(code) && message) return message;
  if (!code && message) return message;
  return fallback;
}
