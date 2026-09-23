import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
  addDoc,
  getDoc,
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
 * Generic real-time collection subscriber with pure empty array default
 */
export function subscribeToCollection<T>(
  collectionName: string,
  callback: (data: T[]) => void,
) {
  try {
    const q = query(collection(db, collectionName));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const items = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as T[];
          callback(items);
        } else {
          callback([]);
        }
      },
      (err) => {
        console.warn(`Firestore listener error on ${collectionName}:`, err);
        callback([]);
      },
    );
    return unsubscribe;
  } catch (err) {
    console.warn(`Firestore subscription failed on ${collectionName}:`, err);
    callback([]);
    return () => {};
  }
}

/**
 * Specific Subscribers
 */
export const subscribeBookings = (cb: (data: Booking[]) => void) =>
  subscribeToCollection<Booking>(COLLECTIONS.BOOKINGS, cb);

export const subscribeDrivers = (cb: (data: Driver[]) => void) =>
  subscribeToCollection<Driver>(COLLECTIONS.DRIVERS, cb);

export const subscribeVehicles = (cb: (data: Vehicle[]) => void) =>
  subscribeToCollection<Vehicle>(COLLECTIONS.VEHICLES, cb);

export const subscribeVehicleCategories = (cb: (data: VehicleCategory[]) => void) =>
  subscribeToCollection<VehicleCategory>(COLLECTIONS.VEHICLE_CATEGORIES, cb);

export const subscribeVendors = (cb: (data: Vendor[]) => void) =>
  subscribeToCollection<Vendor>(COLLECTIONS.VENDORS, cb);

export const subscribeCustomers = (cb: (data: Customer[]) => void) =>
  subscribeToCollection<Customer>(COLLECTIONS.CUSTOMERS, cb);

export const subscribeMarketplace = (cb: (data: MarketplaceTrip[]) => void) =>
  subscribeToCollection<MarketplaceTrip>(COLLECTIONS.MARKETPLACE, cb);

export const subscribePayments = (cb: (data: PaymentTransaction[]) => void) =>
  subscribeToCollection<PaymentTransaction>(COLLECTIONS.PAYMENTS, cb);

export const subscribeInvoices = (cb: (data: Invoice[]) => void) =>
  subscribeToCollection<Invoice>(COLLECTIONS.INVOICES, cb);

export const subscribeServices = (cb: (data: TravelService[]) => void) =>
  subscribeToCollection<TravelService>(COLLECTIONS.SERVICES, cb);

export const subscribeTourPackages = (cb: (data: TourPackage[]) => void) =>
  subscribeToCollection<TourPackage>(COLLECTIONS.TOUR_PACKAGES, cb);

export const subscribeLocations = (cb: (data: MasterLocation[]) => void) =>
  subscribeToCollection<MasterLocation>(COLLECTIONS.LOCATIONS, cb);

export const subscribeFareRules = (cb: (data: FareRule[]) => void) =>
  subscribeToCollection<FareRule>(COLLECTIONS.FARE_RULES, cb);

export const subscribeCoupons = (cb: (data: MasterCoupon[]) => void) =>
  subscribeToCollection<MasterCoupon>(COLLECTIONS.COUPONS, cb);

export const subscribeReviews = (cb: (data: CustomerReview[]) => void) =>
  subscribeToCollection<CustomerReview>(COLLECTIONS.REVIEWS, cb);

export const subscribePenalties = (cb: (data: PenaltyRecord[]) => void) =>
  subscribeToCollection<PenaltyRecord>(COLLECTIONS.PENALTIES, cb);

export const subscribeNotifications = (
  cb: (data: NotificationRecord[]) => void,
) => subscribeToCollection<NotificationRecord>(COLLECTIONS.NOTIFICATIONS, cb);

export const subscribeStaff = (cb: (data: StaffMember[]) => void) =>
  subscribeToCollection<StaffMember>(COLLECTIONS.STAFF, cb);

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

export const subscribePayoutRequests = (cb: (data: any[]) => void) =>
  subscribeToCollection<any>("payout_requests", cb);
