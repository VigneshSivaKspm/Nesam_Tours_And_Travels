import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { TripRecord, LocationItem, NotificationItem, SupportTicket, UserProfile } from '../types';

export const BOOKINGS_COLLECTION = 'bookings';
export const MARKETPLACE_COLLECTION = 'marketplace_trips';
export const SAVED_PLACES_COLLECTION = 'saved_places';
export const NOTIFICATIONS_COLLECTION = 'notifications';
export const SUPPORT_COLLECTION = 'support_tickets';

/**
 * Creates a real booking in Firestore and broadcasts to marketplace_trips for driver/vendor bidding
 */
export async function createBookingInFirestore(tripData: TripRecord, customerId: string): Promise<string> {
  try {
    const bookingId = tripData.id || `BK-${Date.now()}`;
    const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);

    const payload = {
      id: bookingId,
      bookingId: tripData.bookingId || bookingId,
      customerId,
      customer: tripData.passengerName || 'Nesam Customer',
      phone: tripData.passengerPhone || '+91 85319 70197',
      pickup: tripData.pickup.name || tripData.pickup.address,
      pickupAddress: tripData.pickup.address,
      drop: tripData.drop.name || tripData.drop.address,
      dropAddress: tripData.drop.address,
      service: tripData.tripType || 'One Way Taxi',
      vehicle: tripData.vehicle.name,
      vehicleCategory: tripData.vehicle.category,
      fare: `₹${tripData.fare}`,
      status: tripData.status || 'Confirmed',
      payment: tripData.paymentStatus || 'Paid',
      paymentMethod: tripData.paymentMethod || 'UPI',
      date: tripData.date || 'Today',
      time: tripData.time || 'Immediate',
      distanceKm: tripData.distanceKm,
      boardingOTP: tripData.otp || '4892',
      createdAt: serverTimestamp()
    };

    await setDoc(bookingRef, payload);

    // Also broadcast to marketplace_trips so drivers and vendors can bid/accept
    const marketplaceRef = doc(db, MARKETPLACE_COLLECTION, bookingId);
    await setDoc(marketplaceRef, {
      id: bookingId,
      bookingId: payload.bookingId,
      route: `${payload.pickup} ➔ ${payload.drop}`,
      pickup: {
        address: payload.pickupAddress,
        city: payload.pickup,
        time: payload.time
      },
      drop: {
        address: payload.dropAddress,
        city: payload.drop
      },
      travelDate: payload.date,
      vehicleCategory: payload.vehicleCategory,
      distanceKm: payload.distanceKm,
      offeredPayout: Math.round(tripData.fare * 0.85),
      status: 'Open',
      createdAt: serverTimestamp()
    });

    return bookingId;
  } catch (error) {
    console.warn('Firestore booking creation error:', error);
    return tripData.id;
  }
}

/**
 * Real-time listener for the signed-in customer's own bookings.
 */
export function subscribeToUserBookings(customerId: string, callback: (trips: TripRecord[]) => void) {
  try {
    const q = query(collection(db, BOOKINGS_COLLECTION), where('customerId', '==', customerId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const liveTrips: TripRecord[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            bookingId: data.bookingId || docSnap.id,
            pickup: {
              id: 'p-1',
              name: data.pickup || 'Pickup',
              address: data.pickupAddress || data.pickup || '',
              type: 'other'
            },
            drop: {
              id: 'd-1',
              name: data.drop || 'Destination',
              address: data.dropAddress || data.drop || '',
              type: 'other'
            },
            tripType: data.service || 'One Way',
            date: data.date || 'Today',
            time: data.time || '10:00 AM',
            vehicle: {
              id: 'veh-1',
              name: data.vehicle || 'Sedan (AC)',
              category: data.vehicleCategory || 'Sedan',
              passengers: 4,
              luggage: 2,
              basePrice: 450,
              perKmRate: 13,
              image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=300&auto=format&fit=crop&q=80',
              tagline: 'Comfortable sedans with AC',
              eta: '4 mins away'
            },
            fare: typeof data.fare === 'number' ? data.fare : parseInt(String(data.fare || '1500').replace(/[^0-9]/g, '')) || 1500,
            status: data.status || 'Confirmed',
            paymentStatus: data.payment === 'Paid' ? 'Paid' : 'Pending',
            paymentMethod: data.paymentMethod || 'UPI',
            distanceKm: data.distanceKm || 25,
            duration: '45 mins',
            otp: data.boardingOTP || '4892'
          };
        });
        callback(liveTrips);
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
 * Cancel a booking in Firestore
 */
export async function cancelBookingInFirestore(bookingId: string, reason?: string) {
  try {
    const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
    await updateDoc(bookingRef, {
      status: 'Cancelled',
      cancelReason: reason || 'Cancelled by User',
      payment: 'Refunded',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.warn('Firestore cancellation error:', error);
  }
}

/**
 * Real-time listener for the signed-in customer's own saved places.
 */
export function subscribeToSavedPlaces(ownerId: string, callback: (places: LocationItem[]) => void) {
  try {
    const q = query(collection(db, SAVED_PLACES_COLLECTION), where('ownerId', '==', ownerId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const places = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as LocationItem[];
        callback(places);
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
 * Save user custom place to Firestore
 */
export async function savePlaceInFirestore(place: LocationItem, ownerId: string) {
  try {
    const placeRef = doc(db, SAVED_PLACES_COLLECTION, place.id);
    await setDoc(placeRef, { ...place, ownerId, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.warn('Save place in firestore error:', error);
  }
}

/**
 * Real-time listener for the signed-in customer's own notifications.
 */
export function subscribeToUserNotifications(recipientId: string, callback: (notifs: NotificationItem[]) => void) {
  try {
    const q = query(collection(db, NOTIFICATIONS_COLLECTION), where('recipientId', '==', recipientId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const notifs = snapshot.docs.map(d => ({
          id: d.id,
          title: d.data().title || 'Notification',
          message: d.data().message || '',
          time: d.data().time || 'Just now',
          category: d.data().category || 'System',
          read: Boolean(d.data().read)
        })) as NotificationItem[];
        callback(notifs);
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
 * Submit support ticket in Firestore
 */
export async function submitSupportTicketInFirestore(ticket: SupportTicket, customerId: string) {
  try {
    const ticketRef = doc(db, SUPPORT_COLLECTION, ticket.id);
    await setDoc(ticketRef, { ...ticket, customerId, createdAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.warn('Submit support ticket error:', error);
  }
}

/**
 * Registers a brand-new customer by writing customers/{uid} directly.
 * Customers are auto-approved (status: 'Approved'); Firestore rules only let
 * a self-created customer doc be created with exactly that role/status.
 */
export async function registerCustomerProfile(profile: UserProfile): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to register.');
  await setDoc(doc(db, 'customers', user.uid), {
    uid: user.uid,
    name: profile.name || '',
    phone: profile.phone || user.phoneNumber || '',
    email: profile.email || '',
    photoUrl: profile.photoUrl || '',
    walletBalance: profile.walletBalance ?? 0,
    emergencyContact: profile.emergencyContact || '',
    language: profile.language || 'English',
    role: 'customer',
    status: 'Approved',
    createdAt: serverTimestamp(),
  });
}

/**
 * Looks up an existing customer profile by uid — used right after phone
 * verification to decide whether this is a returning customer (skip the
 * profile-setup step) or a brand-new one (registerCustomerProfile above).
 */
export async function getExistingCustomerProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'customers', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid,
    name: data.name || '',
    phone: data.phone || '',
    email: data.email || '',
    photoUrl: data.photoUrl || '',
    walletBalance: typeof data.walletBalance === 'number' ? data.walletBalance : 0,
    emergencyContact: data.emergencyContact || '',
    language: data.language || 'English',
  };
}

// Update user profile
export async function updateUserProfileInFirestore(userId: string, data: Partial<UserProfile>) {
  try {
    const userRef = doc(db, 'customers', userId);
    await updateDoc(userRef, { ...data, updatedAt: serverTimestamp() });
  } catch (error) {
    console.warn('Update user profile error:', error);
  }
}

// Delete a saved place
export async function deleteSavedPlaceInFirestore(placeId: string) {
  try {
    const placeRef = doc(db, SAVED_PLACES_COLLECTION, placeId);
    await deleteDoc(placeRef);
  } catch (error) {
    console.warn('Delete saved place error:', error);
  }
}

// Get the signed-in customer's own support tickets
export function subscribeToSupportTickets(customerId: string, callback: (tickets: any[]) => void) {
  try {
    const q = query(collection(db, SUPPORT_COLLECTION), where('customerId', '==', customerId));
    const unsub = onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => callback([]));
    return unsub;
  } catch { callback([]); return () => {}; }
}
