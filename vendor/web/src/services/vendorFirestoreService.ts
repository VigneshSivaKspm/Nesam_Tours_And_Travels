import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  FleetVehicle,
  FleetDriver,
  OpenTrip,
  BidProposal,
  VendorTrip,
  PayoutRequest,
  VendorProfile
} from '../types';

export const VEHICLES_COLLECTION = 'vehicles';
export const DRIVERS_COLLECTION = 'drivers';
export const MARKETPLACE_COLLECTION = 'marketplace_trips';
export const BOOKINGS_COLLECTION = 'bookings';
export const VENDORS_COLLECTION = 'vendors';
export const PAYOUTS_COLLECTION = 'payout_requests';

/**
 * Sync Vendor Profile to Firestore
 */
export async function syncVendorProfile(profile: VendorProfile) {
  try {
    const vendorRef = doc(db, VENDORS_COLLECTION, profile.id);
    await setDoc(vendorRef, {
      ...profile,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('Vendor profile sync error (offline resilient):', error);
  }
}

/**
 * Real-time listener for Fleet Vehicles
 */
export function subscribeToFleetVehicles(vendorId: string, callback: (vehicles: FleetVehicle[]) => void) {
  try {
    const q = query(collection(db, VEHICLES_COLLECTION), where('vendorId', '==', vendorId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const vehicles: FleetVehicle[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: data.id || docSnap.id,
            vehicleNumber: data.vehicleNumber || data.number || 'TN 01 AB 1234',
            category: data.category || 'Sedan',
            make: data.make || 'Toyota',
            model: data.model || data.name || 'Innova',
            year: data.year || '2023',
            seatingCapacity: data.seatingCapacity || data.seats || 4,
            status: data.status || 'Active',
            assignedDriverId: data.assignedDriverId || undefined,
            assignedDriverName: data.assignedDriverName || data.driver || undefined,
            docStatus: data.docStatus || (data.verified ? 'Approved' : 'Pending'),
            rcDocUrl: data.rcDocUrl || undefined,
            insuranceDocUrl: data.insuranceDocUrl || undefined,
            fitnessDocUrl: data.fitnessDocUrl || undefined,
            statePermitDocUrl: data.statePermitDocUrl || undefined
          };
        });
        callback(vehicles);
      } else {
        callback([]);
      }
    }, () => callback([]));
    return unsubscribe;
  } catch {
    callback([]);
    return () => {};
  }
}

/**
 * Real-time listener for Fleet Drivers
 */
export function subscribeToFleetDrivers(vendorId: string, callback: (drivers: FleetDriver[]) => void) {
  try {
    const q = query(collection(db, DRIVERS_COLLECTION), where('vendorId', '==', vendorId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const drivers: FleetDriver[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: data.id || docSnap.id,
            name: data.name || 'Driver Partner',
            phone: data.phone || '+91 94432 12345',
            email: data.email || 'driver@nesam.in',
            photoUrl: data.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            licenseNumber: data.licenseNumber || 'TN43 20180004521',
            licenseExpiry: data.licenseExpiry || '2028-12-31',
            status: data.status === 'On Trip' ? 'On Trip' : data.status === 'Suspended' ? 'Suspended' : 'Available',
            assignedVehicleNumber: data.assignedVehicleNumber || data.vehicle || undefined,
            rating: data.rating || 4.8,
            totalTrips: data.totalTrips || data.trips || 120,
            docStatus: data.docStatus || (data.verified ? 'Approved' : 'Pending')
          };
        });
        callback(drivers);
      } else {
        callback([]);
      }
    }, () => callback([]));
    return unsubscribe;
  } catch {
    callback([]);
    return () => {};
  }
}

/**
 * Add / Update Fleet Vehicle in Firestore
 */
export async function saveVehicleToFirestore(vehicle: FleetVehicle, vendorId: string) {
  try {
    const vehicleRef = doc(db, VEHICLES_COLLECTION, vehicle.id);
    await setDoc(vehicleRef, { ...vehicle, vendorId, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) { console.warn('Save vehicle error:', error); }
}

/**
 * Add / Update Fleet Driver in Firestore
 */
export async function saveDriverToFirestore(driver: FleetDriver, vendorId: string) {
  try {
    const driverRef = doc(db, DRIVERS_COLLECTION, driver.id);
    await setDoc(driverRef, { ...driver, vendorId, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) { console.warn('Save driver error:', error); }
}

/**
 * Real-time listener for open marketplace trips
 */
export function subscribeToOpenMarketplaceTrips(callback: (trips: OpenTrip[]) => void) {
  try {
    const q = query(collection(db, MARKETPLACE_COLLECTION));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const trips: OpenTrip[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: data.id || docSnap.id,
            bookingId: data.bookingId || 'NESAM-BK-' + docSnap.id.substring(0, 4),
            route: data.route || 'Chennai Airport Gate 4 ➔ Puducherry White Town',
            pickup: data.pickup || {
              address: 'Chennai Airport Gate 4',
              city: 'Chennai',
              time: '02:30 PM'
            },
            drop: data.drop || {
              address: 'Puducherry White Town',
              city: 'Puducherry'
            },
            travelDate: data.travelDate || 'Today, 26 Aug',
            vehicleCategory: data.vehicleCategory || 'Sedan',
            distanceKm: data.distanceKm || 165,
            offeredPayout: data.offeredPayout || 4200,
            status: data.status || 'Open'
          };
        });
        callback(trips);
      } else {
        callback([]);
      }
    }, (err) => {
      console.warn('Marketplace trips listener error:', err);
      callback([]);
    });

    return unsubscribe;
  } catch (err) {
    console.warn('Marketplace listener initialization error:', err);
    callback([]);
    return () => {};
  }
}

/**
 * Submit Counter Bid in Firestore
 */
export async function submitBidToFirestore(bid: BidProposal, vendorId: string, vendorName: string) {
  try {
    // Write to bids subcollection to preserve all bids
    const bidRef = doc(db, MARKETPLACE_COLLECTION, bid.tripId, 'bids', bid.id);
    await setDoc(bidRef, {
      id: bid.id,
      vendorId,
      vendorName,
      vendorCounterRate: bid.vendorCounterRate,
      biddingNote: bid.biddingNote,
      offeredPayout: bid.offeredPayout,
      submittedAt: serverTimestamp(),
      status: 'Pending Review'
    });
    // Also update marketplace trip status
    const tripRef = doc(db, MARKETPLACE_COLLECTION, bid.tripId);
    await updateDoc(tripRef, {
      status: 'Bidding',
      lastCounterRate: bid.vendorCounterRate,
      lastBidAt: serverTimestamp()
    });
  } catch (error) { console.warn('Submit bid error:', error); }
}

/**
 * Assign Driver & Vehicle to Active Trip in Firestore
 */
export async function assignTripInFirestore(tripId: string, driverId: string, driverName: string, vehicleNumber: string, vendorId: string) {
  try {
    // Update bookings
    const bookingRef = doc(db, BOOKINGS_COLLECTION, tripId);
    await setDoc(bookingRef, { id: tripId, status: 'Assigned', assignedDriverId: driverId, assignedDriverName: driverName, assignedVehicleNumber: vehicleNumber, assignedVendorId: vendorId, updatedAt: serverTimestamp() }, { merge: true });
    // Update marketplace_trips to remove from open feed
    const marketRef = doc(db, MARKETPLACE_COLLECTION, tripId);
    await setDoc(marketRef, { status: 'Assigned', updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) { console.warn('Assign trip error:', error); }
}

/**
 * Save Payout Request to Firestore
 */
export async function submitPayoutRequestToFirestore(request: PayoutRequest, vendorId: string) {
  try {
    const payoutRef = doc(db, PAYOUTS_COLLECTION, request.id);
    await setDoc(payoutRef, { ...request, vendorId, createdAt: serverTimestamp() }, { merge: true });
  } catch (error) { console.warn('Submit payout request error:', error); }
}

import { getDoc } from 'firebase/firestore';

export async function getVendorProfileFromFirestore(vendorId: string): Promise<VendorProfile | null> {
  try {
    const vendorRef = doc(db, VENDORS_COLLECTION, vendorId);
    const snap = await getDoc(vendorRef);
    if (snap.exists()) {
      return mapVendorProfile(vendorId, snap.data());
    }
    return null;
  } catch { return null; }
}

/**
 * Map a raw Firestore vendor document (which may be a freshly registered doc
 * with only `companyName`/`status`, or a fully-populated profile) into the
 * VendorProfile shape the app expects.
 */
function mapVendorProfile(uid: string, data: Record<string, any>): VendorProfile {
  const rawStatus = data.status || data.verificationStatus || 'Pending';
  const verificationStatus =
    rawStatus === 'Approved' ? 'Approved'
    : rawStatus === 'Rejected' ? 'Rejected'
    : rawStatus === 'Needs Correction' ? 'Needs Correction'
    : 'Pending';
  return {
    id: uid,
    companyName: data.companyName || 'Vendor Partner Fleet',
    contactPerson: data.contactPerson || 'Fleet Operations Manager',
    phone: data.phone || '',
    email: data.email || '',
    gstin: data.gstin || '',
    panNumber: data.panNumber || '',
    address: data.address || 'Tamil Nadu, India',
    city: data.city || 'Chennai',
    totalFleetSize: typeof data.totalFleetSize === 'number' ? data.totalFleetSize : 0,
    totalDriversCount: typeof data.totalDriversCount === 'number' ? data.totalDriversCount : 0,
    verificationStatus,
    joinedDate: data.joinedDate || 'New Partner',
    bankAccountName: data.bankAccountName || '',
    bankAccountNumber: data.bankAccountNumber || '',
    ifscCode: data.ifscCode || '',
    upiId: data.upiId || '',
  };
}

/**
 * Returns the existing vendor profile for a signed-in Firebase Auth uid, or
 * null when this account has not completed vendor registration yet.
 */
export async function getExistingVendorProfile(uid: string): Promise<VendorProfile | null> {
  return getVendorProfileFromFirestore(uid);
}

/**
 * Registers a brand-new vendor by writing vendors/{uid} directly. The doc
 * starts as status: 'Pending'; an admin approves it from the admin panel.
 * Firestore rules enforce that a self-created doc can only be 'Pending'.
 */
export async function registerVendorProfile(profile: VendorProfile): Promise<VendorProfile> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to register.');
  await setDoc(doc(db, 'vendors', user.uid), {
    uid: user.uid,
    companyName: profile.companyName || '',
    contactPerson: profile.contactPerson || '',
    email: profile.email || '',
    phone: profile.phone || user.phoneNumber || '',
    gstin: profile.gstin || '',
    panNumber: profile.panNumber || '',
    address: profile.address || '',
    city: profile.city || '',
    joinedDate: profile.joinedDate || 'New Partner',
    role: 'vendor',
    status: 'Pending',
    createdAt: serverTimestamp(),
  });
  return profile;
}

export function subscribeToVendorActiveTrips(vendorId: string, callback: (trips: VendorTrip[]) => void) {
  try {
    const q = query(collection(db, BOOKINGS_COLLECTION), where('assignedVendorId', '==', vendorId));
    const unsub = onSnapshot(q, (snap) => {
      const trips: VendorTrip[] = snap.docs
        .map(d => ({
          id: d.id,
          bookingId: d.data().bookingId || d.id,
          customerName: d.data().customer || 'Passenger',
          customerPhone: d.data().phone || '+91 98400 00000',
          pickupAddress: d.data().pickupAddress || d.data().pickup || 'Pickup',
          dropAddress: d.data().dropAddress || d.data().drop || 'Destination',
          scheduledTime: `${d.data().date || 'Today'}, ${d.data().time || '10:00 AM'}`,
          vehicleNumber: d.data().assignedVehicleNumber || 'TN 01 AB 1234',
          driverId: d.data().assignedDriverId || '',
          driverName: d.data().assignedDriverName || 'Driver',
          driverPhone: '+91 94400 00000',
          grossFare: typeof d.data().fare === 'number' ? d.data().fare : parseInt(String(d.data().fare || '2000').replace(/[^0-9]/g, '')) || 2000,
          platformFee: Math.round((typeof d.data().fare === 'number' ? d.data().fare : parseInt(String(d.data().fare || '2000').replace(/[^0-9]/g, '')) || 2000) * 0.1),
          vendorPayout: Math.round((typeof d.data().fare === 'number' ? d.data().fare : parseInt(String(d.data().fare || '2000').replace(/[^0-9]/g, '')) || 2000) * 0.9),
          status: d.data().status || 'Assigned'
        }))
        .filter(t => t.status !== 'Completed' && t.status !== 'Cancelled');
      callback(trips);
    }, () => callback([]));
    return unsub;
  } catch { callback([]); return () => {}; }
}

export function subscribeToVendorPayouts(vendorId: string, callback: (payouts: PayoutRequest[]) => void) {
  try {
    const q = query(collection(db, PAYOUTS_COLLECTION), where('vendorId', '==', vendorId));
    const unsub = onSnapshot(q, (snap) => {
      const payouts = snap.docs.map(d => ({ id: d.id, ...d.data() })) as PayoutRequest[];
      callback(payouts);
    }, () => callback([]));
    return unsub;
  } catch { callback([]); return () => {}; }
}
