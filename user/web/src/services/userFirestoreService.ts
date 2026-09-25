// Customer profile, saved places, notifications and support tickets.
// Ride/booking operations live in rideService.ts.

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { LocationItem, NotificationItem, SupportTicket, UserProfile } from '../types';
import { num, str, timeAgo, toDate } from '../utils/format';
import { withTimeout } from '../utils/retry';

// Firestore queues and retries writes itself; re-issuing one after a timeout
// could turn a create into a (rule-rejected) update. So: timeout only.
const WRITE_TIMEOUT_MS = 15000;

export const CUSTOMERS_COLLECTION = 'customers';
export const SAVED_PLACES_COLLECTION = 'saved_places';
export const NOTIFICATIONS_COLLECTION = 'notifications';
export const SUPPORT_COLLECTION = 'support_tickets';

// ── Profile ─────────────────────────────────────────────────────────────────

function mapProfile(uid: string, d: Record<string, any>): UserProfile {
  return {
    uid,
    name: str(d.name),
    phone: str(d.phone),
    email: str(d.email),
    photoUrl: str(d.photoUrl),
    walletBalance: num(d.walletBalance),
    emergencyContact: str(d.emergencyContact),
    language: str(d.language) || 'English',
    status: str(d.status) || 'Approved',
  };
}

/**
 * Live profile for the signed-in customer. Emits `null` when no profile doc
 * exists yet (new user → registration), and calls `onError` if it can't be
 * read so the UI can offer a retry instead of mistaking it for a new user.
 */
export function subscribeToCustomerProfile(
  uid: string,
  cb: (profile: UserProfile | null) => void,
  onError: (e: unknown) => void,
): () => void {
  return onSnapshot(
    doc(db, CUSTOMERS_COLLECTION, uid),
    (snap) => {
      // A cache miss while offline looks like "no document" — wait for the
      // server rather than routing an existing customer to sign-up.
      if (!snap.exists() && snap.metadata.fromCache) return;
      cb(snap.exists() ? mapProfile(uid, snap.data()) : null);
    },
    onError,
  );
}

export interface NewCustomerProfile {
  name: string;
  email: string;
  emergencyContact: string;
  photoUrl: string;
}

/**
 * Creates customers/{uid}. Customers are auto-approved; firestore.rules only
 * accepts a self-created doc with exactly this role/status and a zero wallet.
 */
export async function registerCustomerProfile(p: NewCustomerProfile): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Your session has expired. Please sign in again.');
  const phone = user.phoneNumber || '';
  await withTimeout(
      setDoc(doc(db, CUSTOMERS_COLLECTION, user.uid), {
        uid: user.uid,
        name: p.name.trim(),
        phone: phone ? `+91 ${phone.slice(-10)}` : '',
        phoneE164: phone,
        email: p.email.trim().toLowerCase(),
        photoUrl: p.photoUrl,
        walletBalance: 0,
        emergencyContact: p.emergencyContact,
        language: 'English',
        role: 'customer',
        status: 'Approved',
        createdAt: serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
  );
}

export type EditableProfile = Partial<Pick<UserProfile, 'name' | 'email' | 'photoUrl' | 'emergencyContact' | 'language'>>;

/** Only the fields firestore.rules lets a customer change. */
export async function updateCustomerProfile(uid: string, data: EditableProfile): Promise<void> {
  const allowed: Record<string, unknown> = {};
  for (const k of ['name', 'email', 'photoUrl', 'emergencyContact', 'language'] as const) {
    if (data[k] !== undefined) allowed[k] = typeof data[k] === 'string' ? (data[k] as string).trim() : data[k];
  }
  await withTimeout(updateDoc(doc(db, CUSTOMERS_COLLECTION, uid), { ...allowed, updatedAt: serverTimestamp() }), WRITE_TIMEOUT_MS);
}

// ── Saved places ────────────────────────────────────────────────────────────

export function subscribeToSavedPlaces(
  ownerId: string,
  cb: (places: LocationItem[]) => void,
  onError?: (e: unknown) => void,
): () => void {
  return onSnapshot(
    query(collection(db, SAVED_PLACES_COLLECTION), where('ownerId', '==', ownerId)),
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            name: str(x.name),
            address: str(x.address),
            type: (['home', 'work', 'favorite', 'other'].includes(x.type) ? x.type : 'favorite') as LocationItem['type'],
            lat: typeof x.lat === 'number' ? x.lat : undefined,
            lng: typeof x.lng === 'number' ? x.lng : undefined,
          };
        }),
      ),
    (err) => {
      console.warn('[profile] saved places unavailable:', err);
      cb([]);
      onError?.(err);
    },
  );
}

export async function savePlace(place: LocationItem, ownerId: string): Promise<void> {
  const id = place.id.startsWith('place-') ? place.id : `place-${ownerId.slice(0, 6)}-${Date.now()}`;
  await withTimeout(
      setDoc(
        doc(db, SAVED_PLACES_COLLECTION, id),
        {
          name: place.name.trim(),
          address: place.address.trim(),
          type: place.type,
          ...(place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : {}),
          ownerId,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
      WRITE_TIMEOUT_MS,
  );
}

export async function deleteSavedPlace(placeId: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db, SAVED_PLACES_COLLECTION, placeId)), WRITE_TIMEOUT_MS);
}

// ── Notifications ───────────────────────────────────────────────────────────

const NOTIF_CATEGORIES: NotificationItem['category'][] = ['Bookings', 'Driver', 'Payments', 'Offers', 'Support', 'System'];

export function subscribeToUserNotifications(
  recipientId: string,
  cb: (notifs: NotificationItem[]) => void,
): () => void {
  return onSnapshot(
    query(collection(db, NOTIFICATIONS_COLLECTION), where('recipientId', '==', recipientId)),
    (snap) => {
      const items = snap.docs.map((d) => {
        const x = d.data();
        const created = toDate(x.createdAt);
        return {
          item: {
            id: d.id,
            title: str(x.title) || 'Notification',
            message: str(x.message),
            time: created ? timeAgo(created) : str(x.time) || '',
            category: NOTIF_CATEGORIES.includes(x.category) ? x.category : 'System',
            read: Boolean(x.read),
          } as NotificationItem,
          at: created?.getTime() ?? 0,
        };
      });
      items.sort((a, b) => b.at - a.at);
      cb(items.map((i) => i.item));
    },
    (err) => {
      console.warn('[profile] notifications unavailable:', err);
      cb([]);
    },
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, id), { read: true, readAt: serverTimestamp() });
}

// ── Support ─────────────────────────────────────────────────────────────────

import { addDoc } from 'firebase/firestore';

export async function submitSupportTicketInFirestore(ticket: any): Promise<void> {
  await withTimeout(
      addDoc(collection(db, SUPPORT_COLLECTION), { ...ticket, status: 'Open', createdAt: serverTimestamp() }),
      WRITE_TIMEOUT_MS,
  );
}

export function subscribeToSupportTickets(customerId: string, cb: (tickets: any[]) => void): () => void {
  return onSnapshot(
    query(collection(db, SUPPORT_COLLECTION), where('customerId', '==', customerId)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([]),
  );
}
