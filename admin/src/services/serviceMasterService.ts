import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS, describeDataError } from "./adminFirestoreService";
import type { Booking, TravelService, VehicleCategory } from "../types";

export class ServiceActionError extends Error {}

export const SERVICE_TYPES = [
  "Airport Taxi",
  "Outstation Cab",
  "One Way Taxi",
  "Local Rental",
  "Corporate Travel",
  "Recurring Transport",
] as const;

export type ServiceForm = Omit<TravelService, "id" | "allowedVehicleCategoryNames" | "createdAt" | "updatedAt" | "createdBy">;
export type ServiceField = "name" | "code" | "slug" | "serviceType" | "imageUrl" | "displayOrder" | "seoTitle" | "seoDescription" | "channels" | "shortDescription";

export const deriveCode = (v: string) =>
  v.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 30).replace(/^_+|_+$/g, "");
export const deriveSlug = (v: string) =>
  v.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60).replace(/^-+|-+$/g, "");

export function validateService(f: ServiceForm, services: TravelService[], editingId: string | null): Partial<Record<ServiceField, string>> {
  const e: Partial<Record<ServiceField, string>> = {};
  const others = services.filter((s) => s.id !== editingId);
  const name = f.name.trim();
  const code = deriveCode(f.code || name);
  const slug = deriveSlug(f.slug || name);
  if (name.length < 3 || name.length > 60) e.name = "Name must be 3–60 characters.";
  else if (others.some((s) => (s.name || "").trim().toLowerCase() === name.toLowerCase())) e.name = `A service named "${name}" already exists.`;
  if (!code) e.code = "Code must contain letters or numbers.";
  else if (others.some((s) => deriveCode(s.code || s.name || "") === code)) e.code = `Code ${code} is already used.`;
  if (!slug) e.slug = "URL slug must contain letters or numbers.";
  else if (others.some((s) => deriveSlug(s.slug || s.name || "") === slug)) e.slug = `Slug "${slug}" is already used.`;
  if (!(SERVICE_TYPES as readonly string[]).includes(f.serviceType)) e.serviceType = "Choose a service type.";
  if (f.imageUrl && !/^https?:\/\/\S+$/i.test(f.imageUrl.trim())) e.imageUrl = "Enter a full image link starting with http:// or https://.";
  if (!Number.isInteger(f.displayOrder ?? 1) || (f.displayOrder ?? 1) < 1) e.displayOrder = "Display order must be a whole number of 1 or more.";
  if ((f.shortDescription || "").length > 160) e.shortDescription = "Keep the short description under 160 characters.";
  if ((f.seoTitle || "").length > 70) e.seoTitle = "SEO title should be 70 characters or fewer.";
  if ((f.seoDescription || "").length > 170) e.seoDescription = "SEO description should be 170 characters or fewer.";
  if (f.status === "Active" && !f.onlineBookingEnabled && !f.adminBookingEnabled) {
    e.channels = "An active service must be bookable online or by admin.";
  }
  return e;
}

function payload(f: ServiceForm, categories: VehicleCategory[]) {
  const ids = (f.allowedVehicleCategoryIds || []).filter((id) => categories.some((c) => c.id === id));
  return {
    name: f.name.trim(),
    code: deriveCode(f.code || f.name),
    slug: deriveSlug(f.slug || f.name),
    serviceType: f.serviceType,
    shortDescription: (f.shortDescription || "").trim(),
    fullDescription: (f.fullDescription || "").trim(),
    icon: f.icon || "",
    imageUrl: (f.imageUrl || "").trim(),
    status: f.status,
    displayOrder: f.displayOrder || 1,
    featured: Boolean(f.featured),
    onlineBookingEnabled: Boolean(f.onlineBookingEnabled),
    adminBookingEnabled: Boolean(f.adminBookingEnabled),
    allowedVehicleCategoryIds: ids,
    allowedVehicleCategoryNames: ids.map((id) => categories.find((c) => c.id === id)!.name),
    airportOptions: f.airportOptions ?? { airportPickup: false, airportDrop: false },
    outstationOptions: f.outstationOptions ?? { oneWayAllowed: false, roundTripAllowed: false },
    seoTitle: (f.seoTitle || "").trim(),
    seoDescription: (f.seoDescription || "").trim(),
  };
}

async function commitInChunks(updates: { ref: DocumentReference; data: Record<string, unknown> }[]) {
  for (let i = 0; i < updates.length; i += 400) {
    const batch = writeBatch(db);
    for (const u of updates.slice(i, i + 400)) batch.update(u.ref, u.data);
    await batch.commit();
  }
}

/** Keeps the service name stored on fare rules and coupons in step with a rename. */
async function propagateRename(s: TravelService, oldName: string, newName: string) {
  const stamp = serverTimestamp();
  const [rules, coupons] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.FARE_RULES), where("serviceId", "==", s.id))),
    getDocs(query(collection(db, COLLECTIONS.COUPONS), where("serviceNames", "array-contains", oldName))),
  ]);
  const updates = [
    ...rules.docs.map((d) => ({ ref: d.ref, data: { serviceName: newName, updatedAt: stamp } as Record<string, unknown> })),
    ...coupons.docs.map((d) => ({
      ref: d.ref,
      data: { serviceNames: (d.data().serviceNames as string[]).map((n) => (n === oldName ? newName : n)), updatedAt: stamp } as Record<string, unknown>,
    })),
  ];
  await commitInChunks(updates);
  return updates.length;
}

export async function saveService(f: ServiceForm, existing: TravelService | null, categories: VehicleCategory[], actorId: string) {
  const data = payload(f, categories);
  try {
    if (!existing) {
      const ref = doc(collection(db, COLLECTIONS.SERVICES));
      await setDoc(ref, { ...data, id: ref.id, createdBy: actorId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return { id: ref.id, renamed: 0 };
    }
    await updateDoc(doc(db, COLLECTIONS.SERVICES, existing.id), { ...data, updatedAt: serverTimestamp() });
  } catch (err) {
    throw new ServiceActionError(describeDataError(err));
  }
  if (existing.name.trim() === data.name) return { id: existing.id, renamed: 0 };
  try {
    return { id: existing.id, renamed: await propagateRename(existing, existing.name.trim(), data.name) };
  } catch (err) {
    throw new ServiceActionError(`The service was saved, but linked fare rules/coupons still show the old name (${describeDataError(err)}). Save again to retry.`);
  }
}

export async function setServiceStatus(s: TravelService, status: "Active" | "Inactive") {
  if (status === "Active" && s.onlineBookingEnabled === false && s.adminBookingEnabled === false) {
    throw new ServiceActionError("Enable online or admin booking before activating this service.");
  }
  try {
    await updateDoc(doc(db, COLLECTIONS.SERVICES, s.id), { status, updatedAt: serverTimestamp() });
  } catch (err) {
    throw new ServiceActionError(describeDataError(err));
  }
}

export interface ServiceReferences {
  bookings: number;
  fareRules: number;
  coupons: number;
  locations: number;
}

export async function findServiceReferences(s: TravelService, bookings: Booking[]): Promise<ServiceReferences> {
  const name = s.name.trim().toLowerCase();
  try {
    const [fareRules, coupons, locations] = await Promise.all([
      getDocs(query(collection(db, COLLECTIONS.FARE_RULES), where("serviceId", "==", s.id))),
      getDocs(query(collection(db, COLLECTIONS.COUPONS), where("serviceNames", "array-contains", s.name))),
      getDocs(query(collection(db, COLLECTIONS.LOCATIONS), where("serviceIds", "array-contains", s.id))),
    ]);
    return {
      bookings: bookings.filter((b) => (b.service || "").trim().toLowerCase() === name).length,
      fareRules: fareRules.size,
      coupons: coupons.size,
      locations: locations.size,
    };
  } catch (err) {
    throw new ServiceActionError(describeDataError(err));
  }
}

export async function deleteService(s: TravelService, bookings: Booking[]) {
  const r = await findServiceReferences(s, bookings);
  const used = (
    [
      [r.bookings, "booking"],
      [r.fareRules, "fare rule"],
      [r.coupons, "coupon"],
      [r.locations, "location"],
    ] as [number, string][]
  )
    .filter(([n]) => n > 0)
    .map(([n, l]) => `${n} ${l}${n === 1 ? "" : "s"}`)
    .join(", ");
  if (used) throw new ServiceActionError(`"${s.name}" is used by ${used}. Deactivate it instead.`);
  try {
    await deleteDoc(doc(db, COLLECTIONS.SERVICES, s.id));
  } catch (err) {
    throw new ServiceActionError(describeDataError(err));
  }
}
