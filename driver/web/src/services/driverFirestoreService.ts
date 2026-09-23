import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { TripDetails, DriverProfile, DriverStatus, TripStatus } from '../types';

export const BOOKINGS_COLLECTION = 'bookings';
export const DRIVERS_COLLECTION = 'drivers';
export const MARKETPLACE_COLLECTION = 'marketplace_trips';
export const PAYOUT_REQUESTS_COLLECTION = 'payout_requests';

/**
 * Real-time listener for Driver Profile
 */
export function subscribeToDriverProfile(driverId: string, callback: (profile: Partial<DriverProfile>) => void) {
  try {
    const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
    const unsubscribe = onSnapshot(driverRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          id: data.id || docSnap.id,
          name: data.name || 'Driver Partner',
          phone: data.phone || '',
          email: data.email || '',
          rating: data.rating || 5.0,
          totalTrips: data.totalTrips || data.trips || 0,
          joiningDate: data.joiningDate || 'Active Partner',
          vendorName: data.vendor || data.vendorName || 'Direct Fleet'
        });
      }
    });
    return unsubscribe;
  } catch {
    return () => {};
  }
}

/**
 * Sync Driver Profile & online/offline presence to Firestore.
 *
 * Written to `presenceStatus`, NOT `status` — `status` on this same document
 * is the KYC-approval field ('Pending'/'Approved'/'Rejected'), set at
 * registration and changed only by an admin. Firestore rules also block the
 * driver from changing `status` themselves. Writing presence there would
 * stomp the approval state every time the driver toggles online/offline.
 */
export async function syncDriverProfileToFirestore(profile: DriverProfile, status: DriverStatus) {
  try {
    const driverRef = doc(db, DRIVERS_COLLECTION, profile.id);
    await setDoc(driverRef, {
      id: profile.id,
      name: profile.name,
      phone: profile.phone,
      email: profile.email,
      presenceStatus: status,
      rating: profile.rating,
      totalTrips: profile.totalTrips,
      joiningDate: profile.joiningDate,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('Driver profile sync error (offline resilient):', error);
  }
}

/**
 * Registers a brand-new driver by writing drivers/{uid} directly. The doc
 * starts as status: 'Pending'; an admin approves it from the admin panel.
 * Firestore rules enforce that a self-created doc can only be 'Pending'.
 */
export async function registerDriverProfile(profile: DriverProfile): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to register.');
  await setDoc(doc(db, DRIVERS_COLLECTION, user.uid), {
    uid: user.uid,
    id: user.uid,
    name: profile.name || '',
    phone: profile.phone || user.phoneNumber || '',
    email: profile.email || '',
    photoUrl: profile.photoUrl || '',
    address: profile.address || '',
    emergencyContact: profile.emergencyContact || '',
    rating: profile.rating ?? 5.0,
    totalTrips: profile.totalTrips ?? 0,
    joiningDate: profile.joiningDate || 'New Partner',
    role: 'driver',
    status: 'Pending',
    createdAt: serverTimestamp(),
  });
}

/**
 * Looks up an existing driver profile by uid — used right after phone
 * verification to decide whether this is a returning driver (skip
 * registration) or a brand-new one (registerDriverProfile above).
 */
export async function getExistingDriverProfile(uid: string): Promise<DriverProfile | null> {
  const snap = await getDoc(doc(db, DRIVERS_COLLECTION, uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: uid,
    name: data.name || 'Driver Partner',
    phone: data.phone || '',
    email: data.email || '',
    photoUrl: data.photoUrl || '',
    address: data.address || '',
    emergencyContact: data.emergencyContact || '',
    rating: typeof data.rating === 'number' ? data.rating : 5.0,
    totalTrips: typeof data.totalTrips === 'number' ? data.totalTrips : 0,
    joiningDate: data.joiningDate || 'New Partner',
    vendorId: data.vendorId,
    vendorName: data.vendorName || data.vendor,
  };
}

/**
 * Real-time listener for incoming available marketplace trips
 */
export function subscribeToMarketplaceTrips(callback: (trips: TripDetails[]) => void) {
  try {
    const q = query(collection(db, MARKETPLACE_COLLECTION));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const liveTrips: TripDetails[] = snapshot.docs.filter(d => {
            const status = d.data().status;
            return status === 'Open' || !status;
          }).map(docSnap => {
          const data = docSnap.data();
          const pickupLat = data.pickup?.lat || 13.0827;
          const pickupLng = data.pickup?.lng || 80.2707;
          const dropLat = data.drop?.lat || 11.9416;
          const dropLng = data.drop?.lng || 79.8083;

          return {
            id: data.id || docSnap.id,
            bookingId: data.bookingId || 'NESAM-BK-' + docSnap.id.substring(0, 4),
            customerName: data.customerName || data.customer || 'Verified Passenger',
            customerPhone: data.customerPhone || '+91 98400 11223',
            pickup: {
              address: data.pickup?.address || data.pickup || 'Chennai Central Railway Station',
              lat: pickupLat,
              lng: pickupLng
            },
            drop: {
              address: data.drop?.address || data.drop || 'Pondicherry White Town Beach Road',
              lat: dropLat,
              lng: dropLng
            },
            pickupDistanceKm: 1.5,
            distanceKm: data.distanceKm || 155,
            estimatedTimeMin: Math.round((data.distanceKm || 155) * 1.5),
            vehicleType: data.vehicleCategory || data.vehicle || 'Sedan',
            fareAmount: Math.round((data.offeredPayout || 3200) * 1.15),
            driverEarnings: data.offeredPayout || 3200,
            platformCommission: Math.round((data.offeredPayout || 3200) * 0.15),
            tollCharges: 120,
            customerOTP: data.otp || data.boardingOTP || '4821',
            status: (data.status as TripStatus) || 'Assigned',
            scheduledTime: data.travelDate ? `${data.travelDate}, ${data.pickup?.time || '10:00 AM'}` : 'Today, 02:30 PM',
            paymentMode: 'Razorpay'
          };
        });
        callback(liveTrips);
      } else {
        callback([]);
      }
    }, (err) => {
      console.warn('Marketplace subscription error:', err);
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
 * Update trip status in Firestore
 */
export async function updateTripStatusInFirestore(tripId: string, status: string, additionalData?: any) {
  try {
    const bookingRef = doc(db, BOOKINGS_COLLECTION, tripId);
    await setDoc(bookingRef, { id: tripId, status, ...additionalData, updatedAt: serverTimestamp() }, { merge: true });
    if (status === 'Assigned') {
      const marketRef = doc(db, MARKETPLACE_COLLECTION, tripId);
      await setDoc(marketRef, { status: 'Assigned', updatedAt: serverTimestamp() }, { merge: true });
    }
  } catch (error) {
    console.warn('Update trip status error:', error);
  }
}

/**
 * Request Payout in Firestore
 */
export async function requestPayoutInFirestore(driverId: string, amount: number, method: string, details: string) {
  try {
    const payoutId = `PAYOUT-${Date.now()}`;
    const payoutRef = doc(db, PAYOUT_REQUESTS_COLLECTION, payoutId);
    await setDoc(payoutRef, {
      id: payoutId,
      driverId,
      amount,
      method,
      details,
      status: 'Processing',
      requestedAt: serverTimestamp()
    });
  } catch (error) {
    console.warn('Request payout error:', error);
  }
}

/**
 * Submit Driver KYC Documents in Firestore
 */
export async function submitDriverKycInFirestore(driverId: string, licenseData: any, vehicleData: any) {
  try {
    const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
    await setDoc(driverRef, {
      license: licenseData,
      vehicle: vehicleData,
      docStatus: 'Pending',
      verified: false,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('Submit driver KYC error:', error);
  }
}

export type PayoutRequest = any;

export function subscribeToPayoutRequests(driverId: string, callback: (requests: PayoutRequest[]) => void) {
  try {
    const q = query(collection(db, PAYOUT_REQUESTS_COLLECTION), where('driverId', '==', driverId));
    const unsub = onSnapshot(q, (snap) => {
      const requests = snap.docs.map(d => ({ ...d.data() })) as PayoutRequest[];
      callback(requests);
    }, () => callback([]));
    return unsub;
  } catch { callback([]); return () => {}; }
}

export function subscribeToDriverCompletedTrips(driverId: string, callback: (trips: any[]) => void) {
  try {
    const q = query(collection(db, BOOKINGS_COLLECTION), where('assignedDriverId', '==', driverId));
    const unsub = onSnapshot(q, (snap) => {
      const trips = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(trips);
    }, () => callback([]));
    return unsub;
  } catch { callback([]); return () => {}; }
}

export function subscribeToActiveTrip(driverId: string, callback: (trip: any | null) => void) {
  try {
    const q = query(
      collection(db, BOOKINGS_COLLECTION),
      where('assignedDriverId', '==', driverId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const activeTrip = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find((t: any) => t.status !== 'Completed' && t.status !== 'Cancelled');
      callback(activeTrip || null);
    }, () => callback(null));
    return unsub;
  } catch { callback(null); return () => {}; }
}

export function subscribeToDriverNotifications(recipientId: string, callback: (notifs: any[]) => void) {
  try {
    const q = query(collection(db, 'notifications'), where('recipientId', '==', recipientId));
    const unsub = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(notifs);
    }, () => callback([]));
    return unsub;
  } catch { callback([]); return () => {}; }
}
