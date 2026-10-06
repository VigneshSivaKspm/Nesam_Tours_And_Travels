/**
 * Staff permissions. These keys are enforced by firestore.rules / storage.rules
 * (can('…')) and by the server functions (functions/src/permissions.ts);
 * tests check all three lists stay identical. Hiding a page here is only a
 * convenience — the rules are what actually allow or deny each action.
 */
export const SUPER_ADMIN_ROLE = "super_admin";

export const PERMISSIONS = [
  "operations",
  "people",
  "fleet",
  "pricing",
  "content",
  "finance",
  "compliance",
  "reports",
  "engagement",
  "system",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_INFO: Record<Permission, { label: string; description: string }> = {
  operations: { label: "Operations", description: "Bookings, live trips, marketplace, manual bookings and dispatch" },
  people: { label: "People", description: "Customers, vendors and drivers, including KYC review and approvals" },
  fleet: { label: "Fleet", description: "Vehicles and their document review" },
  pricing: { label: "Pricing", description: "Vehicle category fares, fare rules, offers and coupons" },
  content: { label: "Content", description: "Services, tour packages and locations" },
  finance: { label: "Finance", description: "Payments, invoices, earnings, payouts and fare overrides" },
  compliance: { label: "Compliance", description: "Penalties and disputes" },
  reports: { label: "Reports", description: "Reports & analytics (read access to financial records)" },
  engagement: { label: "Engagement", description: "Notifications, reviews and support tickets" },
  system: { label: "System", description: "Company settings and B2B integrations" },
};

/** Permission a page needs. null = every active admin; "super" = super admins only. */
export const PAGE_ACCESS: Record<string, Permission | null | "super"> = {
  dashboard: null,
  trips: "operations",
  bookings: "operations",
  "booking-detail": "operations",
  marketplace: "operations",
  customers: "people",
  vendors: "people",
  drivers: "people",
  vehicles: "fleet",
  categories: "pricing",
  pricing: "pricing",
  offers: "pricing",
  services: "content",
  packages: "content",
  locations: "content",
  payments: "finance",
  invoices: "finance",
  earnings: "finance",
  "vendor-finance": "finance",
  commission: "finance",
  penalties: "compliance",
  reports: "reports",
  notifications: "engagement",
  reviews: "engagement",
  support: "engagement",
  b2b: "system",
  settings: "system",
  security: "system",
  legal: "system",
  staff: "super",
};

export interface AdminAccess {
  isSuper: boolean;
  staffRole: string;
  roleName: string;
  permissions: Permission[];
}

export const isPermission = (v: unknown): v is Permission =>
  typeof v === "string" && (PERMISSIONS as readonly string[]).includes(v);

/** Same interpretation as the rules: an admin without staffRole predates roles and is a super admin. */
export function accessFromAdminDoc(d: Record<string, unknown> | undefined): AdminAccess {
  const staffRole = typeof d?.staffRole === "string" && d.staffRole ? d.staffRole : SUPER_ADMIN_ROLE;
  const isSuper = staffRole === SUPER_ADMIN_ROLE;
  return {
    isSuper,
    staffRole,
    roleName: isSuper ? "Super Admin" : typeof d?.roleName === "string" && d.roleName ? d.roleName : "Staff",
    permissions: isSuper ? [...PERMISSIONS] : Array.isArray(d?.permissions) ? d.permissions.filter(isPermission) : [],
  };
}

export function canAccessPage(access: AdminAccess, page: string): boolean {
  const need = PAGE_ACCESS[page];
  if (need === undefined || need === null) return true;
  if (need === "super") return access.isSuper;
  return access.permissions.includes(need);
}
