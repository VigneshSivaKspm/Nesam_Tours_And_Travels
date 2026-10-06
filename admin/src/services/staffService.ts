/**
 * Staff accounts and roles. Reads are live Firestore listeners; every change
 * goes through a super-admin Cloud Function (firestore.rules deny client
 * writes to admins/ and staff_roles/), which also writes the audit log.
 */
import { httpsCallable } from "firebase/functions";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, functions } from "./firebase";
import { describeDataError } from "./adminFirestoreService";
import { PERMISSIONS, accessFromAdminDoc, isPermission, type Permission } from "../config/permissions";

export class StaffActionError extends Error {}

export interface StaffAccount {
  uid: string;
  name: string;
  email: string;
  role: string;
  status: string;
  staffRole: string;
  roleName: string;
  permissions: Permission[];
  isSuper: boolean;
  rejectionReason: string;
  createdAt: Date | null;
}

export interface StaffRole {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface LegacyStaffRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  targetId: string;
  actorName: string;
  at: Date | null;
  details: Record<string, unknown>;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const toDate = (v: unknown): Date | null =>
  v && typeof (v as { toDate?: unknown }).toDate === "function" ? (v as { toDate: () => Date }).toDate() : null;

function mapAccount(uid: string, d: Record<string, unknown>): StaffAccount {
  const access = accessFromAdminDoc(d);
  return {
    uid,
    name: str(d.name),
    email: str(d.email),
    role: str(d.role),
    status: str(d.status),
    staffRole: access.staffRole,
    roleName: access.roleName,
    permissions: access.permissions,
    isSuper: access.isSuper,
    rejectionReason: str(d.rejectionReason),
    createdAt: toDate(d.createdAt),
  };
}

type OnError = (message: string) => void;

export function subscribeStaffAccounts(cb: (accounts: StaffAccount[]) => void, onError: OnError) {
  return onSnapshot(
    collection(db, "admins"),
    (snap) => cb(snap.docs.map((d) => mapAccount(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name))),
    (err) => onError(describeDataError(err)),
  );
}

export function subscribeStaffRoles(cb: (roles: StaffRole[]) => void, onError: OnError) {
  return onSnapshot(
    collection(db, "staff_roles"),
    (snap) =>
      cb(
        snap.docs
          .map((d) => ({
            id: d.id,
            name: str(d.data().name),
            permissions: (Array.isArray(d.data().permissions) ? d.data().permissions : []).filter(isPermission),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    (err) => onError(describeDataError(err)),
  );
}

/** Records from the old Staff screen — never linked to a sign-in account. */
export function subscribeLegacyStaff(cb: (records: LegacyStaffRecord[]) => void, onError: OnError) {
  return onSnapshot(
    collection(db, "staff"),
    (snap) =>
      cb(snap.docs.map((d) => ({ id: d.id, name: str(d.data().name), email: str(d.data().email), role: str(d.data().role), status: str(d.data().status) }))),
    (err) => onError(describeDataError(err)),
  );
}

export function subscribeAuditLog(cb: (entries: AuditEntry[]) => void, onError: OnError) {
  return onSnapshot(
    query(collection(db, "admin_audit"), orderBy("at", "desc"), limit(50)),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          id: d.id,
          action: str(d.data().action),
          targetId: str(d.data().targetId),
          actorName: str(d.data().actorName),
          at: toDate(d.data().at),
          details: (d.data().details as Record<string, unknown>) || {},
        })),
      ),
    (err) => onError(describeDataError(err)),
  );
}

function describeCallError(err: unknown): string {
  const code = (err as { code?: string }).code || "";
  const message = (err as { message?: string }).message || "";
  if (/^functions\/(invalid-argument|failed-precondition|permission-denied|not-found|already-exists|unauthenticated)$/.test(code) && message) return message;
  return "The change could not be saved. Check your connection and try again.";
}

async function call(name: string, data: Record<string, unknown>) {
  try {
    await httpsCallable(functions, name)(data);
  } catch (err) {
    throw new StaffActionError(describeCallError(err));
  }
}

export const approveAdminRequest = (uid: string, staffRole: string) => call("approveAdminRequest", { uid, staffRole });
export const rejectAdminRequest = (uid: string, reason: string) => call("rejectAdminRequest", { uid, reason: reason.trim() });
export const updateAdminAccess = (uid: string, change: { staffRole?: string; status?: "active" | "inactive" }) =>
  call("updateAdminAccess", { uid, ...change });
export const deleteStaffRole = (roleId: string) => call("deleteStaffRole", { roleId });

export function validateRole(name: string, permissions: Permission[], roles: StaffRole[], editingId: string | null) {
  const e: { name?: string; permissions?: string } = {};
  const n = name.trim();
  if (n.length < 2 || n.length > 40) e.name = "Use 2–40 characters.";
  else if (n.toLowerCase() === "super admin") e.name = "Super Admin is a built-in role.";
  else if (roles.some((r) => r.id !== editingId && r.name.toLowerCase() === n.toLowerCase())) e.name = "Another role already has this name.";
  if (!permissions.length) e.permissions = "Choose at least one area.";
  return e;
}

export async function saveStaffRole(name: string, permissions: Permission[], roleId: string | null) {
  await call("saveStaffRole", {
    name: name.trim(),
    permissions: PERMISSIONS.filter((p) => permissions.includes(p)),
    ...(roleId ? { roleId } : {}),
  });
}
