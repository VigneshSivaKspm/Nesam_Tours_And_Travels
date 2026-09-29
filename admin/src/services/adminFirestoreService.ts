import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  Booking,
  Driver,
  Vehicle,
  Vendor,
  Customer,
  MarketplaceTrip,
  PaymentTransaction,
  PenaltyRecord,
  NotificationRecord,
  StaffMember,
  VehicleCategory,
  Invoice,
  TravelService,
  TourPackage,
  MasterLocation,
  FareRule,
  MasterCoupon,
  CustomerReview,
} from "../types";

export const COLLECTIONS = {
  BOOKINGS: "bookings",
  DRIVERS: "drivers",
  VEHICLES: "vehicles",
  VENDORS: "vendors",
  CUSTOMERS: "customers",
  MARKETPLACE: "marketplace_trips",
  PAYMENTS: "payments",
  PENALTIES: "penalties",
  NOTIFICATIONS: "notifications",
  STAFF: "staff",
  VEHICLE_CATEGORIES: "vehicle_categories",
  INVOICES: "invoices",
  SERVICES: "services",
  TOUR_PACKAGES: "tour_packages",
  LOCATIONS: "locations",
  FARE_RULES: "fare_rules",
  COUPONS: "coupons",
  REVIEWS: "reviews",
};

/**
 * User-facing text for a failed Firestore read or write. Raw Firebase
 * messages are never shown to operators.
 */
export function describeDataError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "permission-denied":
      return "You do not have permission for this action. Make sure your admin account is active.";
    case "unavailable":
    case "deadline-exceeded":
      return "Cannot reach the database. Check your internet connection and try again.";
    case "not-found":
      return "This record no longer exists. It may have been deleted by another admin.";
    case "already-exists":
      return "A record with this ID already exists.";
    case "failed-precondition":
      return "The database is not ready for this query (a required index may be missing).";
    case "resource-exhausted":
      return "Too many requests right now. Please wait a moment and try again.";
    case "unauthenticated":
      return "Your session has expired. Sign in again.";
    default:
      return error instanceof Error && error.message && !/firebase|firestore/i.test(error.message)
        ? error.message
        : "Something went wrong while talking to the database. Please try again.";
  }
}

/**
 * Generic real-time collection subscriber.
 *
 * When `onError` is supplied, a listener failure (permission denied, network
 * loss, missing index) is reported through it and the last delivered data is
 * left untouched, so pages can show an error state instead of a misleading
 * "no records" state. Without `onError` the failure is logged and an empty
 * list is delivered.
 */
export function subscribeToCollection<T>(
  collectionName: string,
  callback: (data: T[]) => void,
  onError?: (message: string) => void,
) {
  const fail = (err: unknown) => {
    console.warn(`Firestore listener error on ${collectionName}:`, err);
    if (onError) onError(describeDataError(err));
    else callback([]);
  };
  try {
    const q = query(collection(db, collectionName));
    return onSnapshot(
      q,
      (snapshot) => {
        callback(
          snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) as T[],
        );
      },
      fail,
    );
  } catch (err) {
    fail(err);
    return () => {};
  }
}

/**
 * Specific Subscribers
 */
export const subscribeBookings = (cb: (data: Booking[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<Booking>(COLLECTIONS.BOOKINGS, cb, onError);

export const subscribeDrivers = (cb: (data: Driver[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<Driver>(COLLECTIONS.DRIVERS, cb, onError);

export const subscribeVehicles = (cb: (data: Vehicle[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<Vehicle>(COLLECTIONS.VEHICLES, cb, onError);

export const subscribeVehicleCategories = (cb: (data: VehicleCategory[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<VehicleCategory>(COLLECTIONS.VEHICLE_CATEGORIES, cb, onError);

export const subscribeVendors = (cb: (data: Vendor[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<Vendor>(COLLECTIONS.VENDORS, cb, onError);

export const subscribeCustomers = (cb: (data: Customer[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<Customer>(COLLECTIONS.CUSTOMERS, cb, onError);

export const subscribeMarketplace = (cb: (data: MarketplaceTrip[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<MarketplaceTrip>(COLLECTIONS.MARKETPLACE, cb, onError);

export const subscribePayments = (cb: (data: PaymentTransaction[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<PaymentTransaction>(COLLECTIONS.PAYMENTS, cb, onError);

export const subscribeInvoices = (cb: (data: Invoice[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<Invoice>(COLLECTIONS.INVOICES, cb, onError);

export const subscribeServices = (cb: (data: TravelService[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<TravelService>(COLLECTIONS.SERVICES, cb, onError);

export const subscribeTourPackages = (cb: (data: TourPackage[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<TourPackage>(COLLECTIONS.TOUR_PACKAGES, cb, onError);

export const subscribeLocations = (cb: (data: MasterLocation[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<MasterLocation>(COLLECTIONS.LOCATIONS, cb, onError);

export const subscribeFareRules = (cb: (data: FareRule[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<FareRule>(COLLECTIONS.FARE_RULES, cb, onError);

export const subscribeCoupons = (cb: (data: MasterCoupon[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<MasterCoupon>(COLLECTIONS.COUPONS, cb, onError);

export const subscribeReviews = (cb: (data: CustomerReview[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<CustomerReview>(COLLECTIONS.REVIEWS, cb, onError);

export const subscribePenalties = (cb: (data: PenaltyRecord[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<PenaltyRecord>(COLLECTIONS.PENALTIES, cb, onError);

import {
  subscribeAdminNotifications,
  subscribeOutboundNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  dismissAdminNotification,
  sendAdminNotification,
} from "./adminNotificationService";

export {
  subscribeAdminNotifications,
  subscribeOutboundNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  dismissAdminNotification,
  sendAdminNotification,
};

export const subscribeNotifications = (
  cb: (data: NotificationRecord[]) => void,
) => subscribeAdminNotifications(cb);

export const subscribeStaff = (cb: (data: StaffMember[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<StaffMember>(COLLECTIONS.STAFF, cb, onError);

/**
 * Mutations
 */
export async function updateFirestoreDocument(
  collectionName: string,
  docId: string,
  data: any,
) {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
    return true;
  } catch (error) {
    console.warn(`Update ${collectionName}/${docId} error:`, error);
    return false;
  }
}

export async function setFirestoreDocument(
  collectionName: string,
  docId: string,
  data: any,
) {
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(
      docRef,
      { ...data, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return true;
  } catch (error) {
    console.warn(`Set ${collectionName}/${docId} error:`, error);
    return false;
  }
}

export async function deleteFirestoreDocument(
  collectionName: string,
  docId: string,
) {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.warn(`Delete ${collectionName}/${docId} error:`, error);
    return false;
  }
}

// Add document with auto-generated ID
export async function addFirestoreDocument(collectionName: string, data: any) {
  try {
    const colRef = collection(db, collectionName);
    const docRef = await addDoc(colRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.warn(`Add ${collectionName} error:`, error);
    return null;
  }
}

// Subscribe to settings
export function subscribeSettings(cb: (data: any) => void) {
  try {
    const settingsRef = doc(db, "settings", "config");
    return onSnapshot(
      settingsRef,
      (snap) => {
        if (snap.exists()) cb(snap.data());
        else cb({});
      },
      () => cb({}),
    );
  } catch {
    cb({});
    return () => {};
  }
}

// Save settings
export async function saveSettings(data: any) {
  try {
    const settingsRef = doc(db, "settings", "config");
    await setDoc(
      settingsRef,
      { ...data, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return true;
  } catch (error) {
    console.warn("Save settings error:", error);
    return false;
  }
}

export const subscribePayoutRequests = (cb: (data: any[]) => void, onError?: (message: string) => void) =>
  subscribeToCollection<any>("payout_requests", cb, onError);
