import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './admin';
import { GeoPlace, RouteInfo } from './domain/types';
import { AdminAccess, Permission, accessOf } from './permissions';

export const approved = (s: unknown) => ['Approved', 'APPROVED', 'Active'].includes(String(s));
export const text = (v: unknown, max = 300) => typeof v === 'string' ? v.trim().slice(0, max) : '';

/** Client-generated idempotency key (also the booking document id). */
export function requestIdOf(v: unknown): string {
  if (typeof v !== 'string' || !/^[a-zA-Z0-9_-]{10,100}$/.test(v)) throw new HttpsError('invalid-argument', 'Invalid request ID.');
  return v;
}

export const inIndia = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
  && lat >= 6.5 && lat <= 35.7 && lng >= 68.1 && lng <= 97.4;

export async function routeFor(a: GeoPlace, b: GeoPlace): Promise<RouteInfo> {
  // Never accept distance or duration from the caller.
  const base = (process.env.ROUTING_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
  try {
    const response = await fetch(`${base}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('routing unavailable');
    const result = await response.json() as any;
    const r = result.code === 'Ok' && result.routes?.[0];
    if (!r || !Number.isFinite(r.distance) || r.distance <= 0 || !Number.isFinite(r.duration) || r.duration <= 0) throw new Error('invalid route');
    return { distanceKm: r.distance / 1000, durationMin: r.duration / 60, estimated: false, path: [] };
  } catch {
    throw new HttpsError('unavailable', 'Route pricing is temporarily unavailable. Please try again.');
  }
}

type CallerAuth = { uid: string; token?: { email?: string } } | undefined;

/** Same check as firestore.rules isAdmin(): an admins/{uid} doc with role admin and status active. */
export async function requireAdmin(auth: CallerAuth): Promise<AdminAccess> {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const snap = await db.doc(`admins/${auth.uid}`).get();
  const a = snap.data();
  if (!snap.exists || a?.role !== 'admin' || a?.status !== 'active') throw new HttpsError('permission-denied', 'Only active admins can do this.');
  return accessOf(auth.uid, a, text(auth.token?.email, 120));
}

/** Same check as firestore.rules can(p): an active admin holding every listed permission. */
export async function requirePermission(auth: CallerAuth, ...needed: Permission[]): Promise<AdminAccess> {
  const admin = await requireAdmin(auth);
  const missing = needed.filter((p) => !admin.permissions.includes(p));
  if (missing.length) throw new HttpsError('permission-denied', `Your role does not include ${missing.join(' and ')} access.`);
  return admin;
}

export async function requireSuperAdmin(auth: CallerAuth): Promise<AdminAccess> {
  const admin = await requireAdmin(auth);
  if (!admin.isSuper) throw new HttpsError('permission-denied', 'Only a super admin can manage staff access.');
  return admin;
}

export const NO_BOOKABLE_CATEGORIES =
  'Booking is unavailable: no active vehicle category has fares configured. An admin must set the category fares first.';
