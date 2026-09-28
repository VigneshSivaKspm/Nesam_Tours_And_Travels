import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  addDoc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "./adminFirestoreService";
import { NotificationRecord } from "../types";

const LOCAL_READ_KEY = "nesam_admin_read_operational_notifs";
const LOCAL_DISMISSED_KEY = "nesam_admin_dismissed_operational_notifs";

function getLocalSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveLocalSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.warn("Error saving to localStorage:", err);
  }
}

/**
 * Parses timestamps from Firestore Timestamp, Date, string, or number
 * into a human-readable relative time string.
 */
export function formatTimeAgo(input: any): string {
  if (!input) return "Recently";
  let date: Date | null = null;

  if (input instanceof Timestamp) {
    date = input.toDate();
  } else if (input?.seconds && typeof input.seconds === "number") {
    date = new Date(input.seconds * 1000);
  } else if (input instanceof Date) {
    date = input;
  } else if (typeof input === "string" || typeof input === "number") {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }

  if (!date) return "Recently";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "Just now";

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Checks whether a notification document is specifically for the Super Admin / Admin console.
 * Strictly excludes notifications meant for drivers, customers, or vendors.
 */
export function isAdminNotification(data: any): boolean {
  if (!data) return false;

  // Explicitly exclude driver/customer/vendor targeted messages
  if (
    data.recipientType === "driver" ||
    data.recipientType === "customer" ||
    data.recipientType === "vendor"
  ) {
    return false;
  }

  // Explicitly for admin
  if (
    data.recipientType === "admin" ||
    data.recipientRole === "admin" ||
    data.recipientId === "admin" ||
    data.target === "admin" ||
    data.targetRole === "admin"
  ) {
    return true;
  }

  // System or broadcast alerts that are not targeted to a specific driver or customer
  if (!data.recipientType && !data.recipientId) {
    return true;
  }

  return false;
}

/**
 * Subscribes to Admin notifications by combining:
 * 1. Admin-targeted notifications stored in Firestore `notifications`
 * 2. Real-time operational system alerts (Driver KYC pending, Vendor approvals, Pending Bookings, SOS alerts)
 */
export function subscribeAdminNotifications(
  callback: (notifications: NotificationRecord[]) => void,
): () => void {
  let firestoreNotifs: NotificationRecord[] = [];
  let pendingDriverNotifs: NotificationRecord[] = [];
  let pendingVendorNotifs: NotificationRecord[] = [];
  let pendingBookingNotifs: NotificationRecord[] = [];
  let sosNotifs: NotificationRecord[] = [];

  const publish = () => {
    const readSet = getLocalSet(LOCAL_READ_KEY);
    const dismissedSet = getLocalSet(LOCAL_DISMISSED_KEY);

    const merged = [
      ...firestoreNotifs,
      ...pendingDriverNotifs,
      ...pendingVendorNotifs,
      ...pendingBookingNotifs,
      ...sosNotifs,
    ].filter((n) => !dismissedSet.has(String(n.id)));

    // Apply read state and time formatting
    const formatted = merged.map((n) => {
      const isRead = n.isSystemAlert ? readSet.has(String(n.id)) : Boolean(n.read);
      return {
        ...n,
        read: isRead,
        time: n.time || formatTimeAgo(n.createdAt),
      };
    });

    // Sort newest first
    formatted.sort((a, b) => {
      const timeA = toMillis(a.createdAt);
      const timeB = toMillis(b.createdAt);
      return timeB - timeA;
    });

    callback(formatted);
  };

  // 1. Stored Admin Notifications in Firestore
  const qNotifs = query(collection(db, COLLECTIONS.NOTIFICATIONS));
  const unsubNotifs = onSnapshot(
    qNotifs,
    (snap) => {
      firestoreNotifs = snap.docs
        .map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            ...d,
            createdAt: d.createdAt || d.updatedAt || new Date().toISOString(),
          } as NotificationRecord;
        })
        .filter(isAdminNotification);
      publish();
    },
    (err) => {
      console.warn("Admin notifications listener error:", err);
    },
  );

  // 2. Real-time Pending Drivers (KYC Verification Alert)
  const qDrivers = query(collection(db, COLLECTIONS.DRIVERS));
  const unsubDrivers = onSnapshot(
    qDrivers,
    (snap) => {
      const pendingDrivers = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter(
          (d) =>
            d.status === "Pending" ||
            (d.status === "Approved" && d.docStatus === "Pending"),
        );

      pendingDriverNotifs = pendingDrivers.map((d) => ({
        id: `sys-driver-${d.id}`,
        type: "driver",
        title:
          d.status === "Approved"
            ? "Driver Document Re-upload"
            : "New Driver KYC Application",
        message: `${d.name || d.phone || "Driver"} (${d.city || "Tamil Nadu"}) submitted documents for verification.`,
        actionUrl: "drivers",
        priority: "high",
        isSystemAlert: true,
        read: false,
        createdAt: d.submittedAt || d.createdAt || d.updatedAt,
      }));
      publish();
    },
    (err) => console.warn("Driver alerts listener error:", err),
  );

  // 3. Real-time Pending Vendors (Approval Alert)
  const qVendors = query(collection(db, COLLECTIONS.VENDORS));
  const unsubVendors = onSnapshot(
    qVendors,
    (snap) => {
      const pendingVendors = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter(
          (v) =>
            v.status === "Pending" ||
            v.status === "PENDING_APPROVAL" ||
            String(v.status).toLowerCase().includes("pending"),
        );

      pendingVendorNotifs = pendingVendors.map((v) => ({
        id: `sys-vendor-${v.id}`,
        type: "vendor",
        title: "Vendor Onboarding Pending",
        message: `${v.companyName || v.name || "Vendor"} submitted registration for fleet onboarding.`,
        actionUrl: "vendors",
        priority: "normal",
        isSystemAlert: true,
        read: false,
        createdAt: v.createdAt || v.updatedAt,
      }));
      publish();
    },
    (err) => console.warn("Vendor alerts listener error:", err),
  );

  // 4. Real-time Pending Bookings (Unassigned Rides Alert)
  const qBookings = query(collection(db, COLLECTIONS.BOOKINGS));
  const unsubBookings = onSnapshot(
    qBookings,
    (snap) => {
      const pendingBookings = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter(
          (b) =>
            b.status === "Pending" &&
            !b.assignedDriverId &&
            !b.assignedVendorId,
        )
        .slice(0, 10); // Keep top 10 most recent

      pendingBookingNotifs = pendingBookings.map((b) => ({
        id: `sys-booking-${b.id}`,
        type: "booking",
        title: "New Booking Pending Dispatch",
        message: `Booking #${b.bookingId || b.id} from ${b.customer || "Customer"} (${b.pickup || "Pickup"} → ${b.drop || "Drop"}) requires assignment.`,
        actionUrl: "bookings",
        priority: "high",
        isSystemAlert: true,
        read: false,
        createdAt: b.createdAt || b.date,
      }));
      publish();
    },
    (err) => console.warn("Booking alerts listener error:", err),
  );

  // 5. Real-time Emergency SOS Alerts
  const qSos = query(collection(db, "sos_alerts"));
  const unsubSos = onSnapshot(
    qSos,
    (snap) => {
      const activeSos = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter((s) => s.status !== "Resolved" && s.status !== "Dismissed");

      sosNotifs = activeSos.map((s) => ({
        id: `sys-sos-${s.id}`,
        type: "alert",
        title: "🚨 Emergency SOS Alert",
        message: `Emergency SOS triggered on trip ${s.tripId || s.bookingId || s.id}! Immediate assistance required.`,
        actionUrl: "trips",
        priority: "urgent",
        isSystemAlert: true,
        read: false,
        createdAt: s.createdAt || s.timestamp,
      }));
      publish();
    },
    () => {
      // SOS collection may be empty or not yet initialized
      sosNotifs = [];
      publish();
    },
  );

  return () => {
    unsubNotifs();
    unsubDrivers();
    unsubVendors();
    unsubBookings();
    unsubSos();
  };
}

/**
 * Subscribes to ALL outbound notifications sent across the platform
 * (to Drivers, Customers, Vendors) for audit and outbox inspection.
 */
export function subscribeOutboundNotifications(
  callback: (notifications: NotificationRecord[]) => void,
): () => void {
  const q = query(collection(db, COLLECTIONS.NOTIFICATIONS));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ...d,
          time: d.time || formatTimeAgo(d.createdAt),
        } as NotificationRecord;
      });

      items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      callback(items);
    },
    (err) => console.warn("Outbound notifications subscription error:", err),
  );
}

/**
 * Mark a single admin notification as read.
 */
export async function markAdminNotificationRead(
  notification: NotificationRecord,
): Promise<void> {
  const notifId = String(notification.id);

  if (notification.isSystemAlert || notifId.startsWith("sys-")) {
    const readSet = getLocalSet(LOCAL_READ_KEY);
    readSet.add(notifId);
    saveLocalSet(LOCAL_READ_KEY, readSet);
    return;
  }

  try {
    const docRef = doc(db, COLLECTIONS.NOTIFICATIONS, notifId);
    await updateDoc(docRef, { read: true, readAt: serverTimestamp() });
  } catch (err) {
    console.warn(`Error marking notification ${notifId} read:`, err);
  }
}

/**
 * Mark all given admin notifications as read.
 */
export async function markAllAdminNotificationsRead(
  notifications: NotificationRecord[],
): Promise<void> {
  const readSet = getLocalSet(LOCAL_READ_KEY);
  const firestoreIds: string[] = [];

  notifications.forEach((n) => {
    const notifId = String(n.id);
    if (n.isSystemAlert || notifId.startsWith("sys-")) {
      readSet.add(notifId);
    } else {
      firestoreIds.push(notifId);
    }
  });

  saveLocalSet(LOCAL_READ_KEY, readSet);

  if (firestoreIds.length > 0) {
    try {
      const batch = writeBatch(db);
      for (const id of firestoreIds) {
        batch.update(doc(db, COLLECTIONS.NOTIFICATIONS, id), {
          read: true,
          readAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      console.warn("Error marking all notifications read:", err);
    }
  }
}

/**
 * Dismiss / delete a notification.
 */
export async function dismissAdminNotification(
  notification: NotificationRecord,
): Promise<void> {
  const notifId = String(notification.id);

  if (notification.isSystemAlert || notifId.startsWith("sys-")) {
    const dismissedSet = getLocalSet(LOCAL_DISMISSED_KEY);
    dismissedSet.add(notifId);
    saveLocalSet(LOCAL_DISMISSED_KEY, dismissedSet);
    return;
  }

  try {
    await deleteDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notifId));
  } catch (err) {
    console.warn(`Error deleting notification ${notifId}:`, err);
  }
}

export interface ComposeNotificationInput {
  target: "admin" | "all_drivers" | "all_customers" | "all_vendors" | "single_user";
  recipientId?: string;
  recipientName?: string;
  recipientType?: "admin" | "driver" | "customer" | "vendor";
  channel: "In-App" | "SMS" | "WhatsApp" | "Email" | "Push Notification";
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
}

/**
 * Send a notification with appropriate fanout and recipient targeting.
 */
export async function sendAdminNotification(
  input: ComposeNotificationInput,
  userList?: { id: string; name: string; type: string }[],
): Promise<{ success: boolean; count: number }> {
  try {
    const { target, title, message, channel, type, actionUrl } = input;
    const now = serverTimestamp();

    if (target === "admin") {
      await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
        recipientType: "admin",
        recipientRole: "admin",
        recipientId: "admin",
        target: "admin",
        channel,
        type,
        title,
        message,
        actionUrl: actionUrl || "dashboard",
        read: false,
        createdAt: now,
        sentBy: "Super Admin",
      });
      return { success: true, count: 1 };
    }

    if (target === "single_user" && input.recipientId) {
      await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
        recipientId: input.recipientId,
        recipientType: input.recipientType || "customer",
        recipientName: input.recipientName || "User",
        channel,
        type,
        title,
        message,
        actionUrl: actionUrl || "",
        read: false,
        createdAt: now,
        sentBy: "Super Admin",
      });
      return { success: true, count: 1 };
    }

    // Broadcast targets: fan-out to active recipients in the target role
    let targets: { id: string; type: string; name: string }[] = [];
    if (userList && userList.length > 0) {
      if (target === "all_drivers") {
        targets = userList.filter((u) => u.type === "driver");
      } else if (target === "all_customers") {
        targets = userList.filter((u) => u.type === "customer");
      } else if (target === "all_vendors") {
        targets = userList.filter((u) => u.type === "vendor");
      }
    }

    // Also write a general broadcast marker for the recipient type
    const roleType =
      target === "all_drivers"
        ? "driver"
        : target === "all_customers"
          ? "customer"
          : "vendor";

    if (targets.length > 0) {
      const batch = writeBatch(db);
      let count = 0;
      for (const u of targets.slice(0, 400)) {
        const docRef = doc(collection(db, COLLECTIONS.NOTIFICATIONS));
        batch.set(docRef, {
          recipientId: u.id,
          recipientType: u.type,
          recipientName: u.name,
          channel,
          type,
          title,
          message,
          actionUrl: actionUrl || "",
          read: false,
          createdAt: now,
          sentBy: "Super Admin",
        });
        count++;
      }
      await batch.commit();
      return { success: true, count };
    }

    // Fallback if userList was not populated: write a broadcast notice
    await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
      broadcast: true,
      recipientType: roleType,
      channel,
      type,
      title,
      message,
      actionUrl: actionUrl || "",
      read: false,
      createdAt: now,
      sentBy: "Super Admin",
    });

    return { success: true, count: 1 };
  } catch (err) {
    console.error("Error sending admin notification:", err);
    return { success: false, count: 0 };
  }
}

function toMillis(v: any): number {
  if (!v) return 0;
  if (v instanceof Timestamp) return v.toMillis();
  if (v?.seconds && typeof v.seconds === "number") return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string" || typeof v === "number") {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}
