import { useState, useEffect } from "react";
import {
  subscribeToCollection,
  COLLECTIONS,
} from "../services/adminFirestoreService";
import { normalizeVendorStatus } from "../utils/vendorStatus";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  userName?: string | null;
  userEmail?: string | null;
}

const navGroups = [
  {
    label: "Overview",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
      },
      {
        id: "trips",
        label: "Live Trips",
        icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
      },
    ],
  },
  {
    label: "Bookings",
    items: [
      {
        id: "bookings",
        label: "All Bookings",
        icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
      },
      {
        id: "marketplace",
        label: "Open Marketplace",
        icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        id: "customers",
        label: "Customers",
        icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
      },
      {
        id: "vendors",
        label: "Vendors",
        icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
      },
      {
        id: "drivers",
        label: "Drivers",
        icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
      },
    ],
  },
  {
    label: "Fleet",
    items: [
      {
        id: "vehicles",
        label: "Vehicles",
        icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
      },
      {
        id: "categories",
        label: "Vehicle Categories",
        icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        id: "payments",
        label: "Payments",
        icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
      },
      {
        id: "invoices",
        label: "Invoices",
        icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
      },
      {
        id: "earnings",
        label: "Driver Earnings",
        icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
      },
      {
        id: "vendor-finance",
        label: "Vendor Finance",
        icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      },
    ],
  },
  {
    label: "Compliance",
    items: [
      {
        id: "penalties",
        label: "Penalties",
        icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
      },
      {
        id: "reports",
        label: "Reports & Analytics",
        icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        id: "services",
        label: "Services",
        icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
      },
      {
        id: "packages",
        label: "Tour Packages",
        icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064",
      },
      {
        id: "locations",
        label: "Locations",
        icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
      },
      {
        id: "pricing",
        label: "Pricing & Fare",
        icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
      },
      {
        id: "offers",
        label: "Offers & Coupons",
        icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        id: "b2b",
        label: "B2B Integrations",
        icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
      },
      {
        id: "reviews",
        label: "Reviews",
        icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
      },
      {
        id: "staff",
        label: "Staff & Roles",
        icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
      },
      {
        id: "settings",
        label: "Settings",
        icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
      },
    ],
  },
  {
    label: "Help & Support",
    items: [
      {
        id: "support",
        label: "Support Tickets",
        icon: "M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z",
      },
    ],
  },
];

export default function Sidebar({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  userName,
  userEmail,
}: SidebarProps) {
  const displayName = userName || userEmail?.split("@")[0] || "Admin";
  const initials =
    displayName
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "A";
  const [badges, setBadges] = useState({
    trips: 0,
    marketplace: 0,
    vendors: 0,
    drivers: 0,
    notifications: 0,
  });

  useEffect(() => {
    const unsubTrips = subscribeToCollection(
      COLLECTIONS.BOOKINGS,
      (data: any[]) => {
        const active = data.filter((b) =>
          ["Ongoing", "Assigned", "Trip Started"].includes(b.status),
        ).length;
        setBadges((prev) => ({ ...prev, trips: active }));
      },
    );
    const unsubMarketplace = subscribeToCollection(
      "marketplace_trips",
      (data: any[]) => {
        const open = data.filter((t) => t.status === "Open").length;
        setBadges((prev) => ({ ...prev, marketplace: open }));
      },
    );
    const unsubVendors = subscribeToCollection(
      COLLECTIONS.VENDORS,
      (data: any[]) => {
        const pending = data.filter(
          (v) =>
            v.status === "Pending" ||
            v.status === "PENDING_APPROVAL" ||
            normalizeVendorStatus(v) === "PENDING_APPROVAL",
        ).length;
        setBadges((prev) => ({ ...prev, vendors: pending }));
      },
    );
    const unsubDrivers = subscribeToCollection(
      COLLECTIONS.DRIVERS,
      (data: any[]) => {
        // New applications + approved drivers with re-uploaded documents.
        const pending = data.filter(
          (d) =>
            d.status === "Pending" ||
            (d.status === "Approved" && d.docStatus === "Pending"),
        ).length;
        setBadges((prev) => ({ ...prev, drivers: pending }));
      },
    );
    const unsubNotifs = subscribeToCollection(
      "notifications",
      (data: any[]) => {
        const unread = data.filter((n) => n.read === false).length;
        setBadges((prev) => ({ ...prev, notifications: unread }));
      },
    );

    return () => {
      unsubTrips();
      unsubMarketplace();
      unsubVendors();
      unsubDrivers();
      unsubNotifs();
    };
  }, []);

  const getBadge = (id: string): string | undefined => {
    if (id === "trips" && badges.trips > 0) return badges.trips.toString();
    if (id === "marketplace" && badges.marketplace > 0)
      return badges.marketplace.toString();
    if (id === "vendors" && badges.vendors > 0)
      return badges.vendors.toString();
    if (id === "drivers" && badges.drivers > 0)
      return badges.drivers.toString();
    if (id === "notifications" && badges.notifications > 0)
      return badges.notifications.toString();
    if (id === "support") return "3";
    return undefined;
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-screen flex flex-col z-40 transition-all duration-300 ease-in-out ${collapsed ? "w-[68px]" : "w-[240px]"}`}
      style={{ background: "#111111" }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/icons/logo.png"
            alt="Nesam Tours & Travels"
            className="shrink-0 w-9 h-9 rounded-lg object-contain bg-white/10 p-1 shadow-sm"
          />
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-white font-bold text-[13px] leading-tight tracking-wide truncate">
                NESAM TOURS
              </div>
              <div className="text-white/40 text-[10px] leading-tight tracking-widest uppercase truncate">
                & TRAVELS PVT. LTD.
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="ml-auto shrink-0 text-white/30 hover:text-white/80 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {collapsed ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-3 px-2 space-y-1">
        {navGroups.map((group) => (
          <div key={group.label}>
            {/* Group Label */}
            {!collapsed && (
              <div className="px-3 pt-3 pb-1 text-[9px] font-bold text-white/25 uppercase tracking-widest">
                {group.label}
              </div>
            )}
            {collapsed && <div className="h-px bg-white/10 mx-2 my-2" />}

            {/* Items */}
            {group.items.map((item) => {
              const isActive = activePage === item.id;
              const dynamicBadge = getBadge(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`nav-item w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left group relative ${isActive ? "text-white" : "text-white/50 hover:text-white/80 hover:bg-white/5"}`}
                  style={isActive ? { background: "#E21B23" } : {}}
                >
                  <svg
                    className={`shrink-0 w-[17px] h-[17px] ${isActive ? "text-white" : "text-white/50 group-hover:text-white/80"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    {item.icon.split(" M").map((d, i) => (
                      <path
                        key={i}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={i === 0 ? d : "M" + d}
                      />
                    ))}
                  </svg>
                  {!collapsed && (
                    <span className="text-[12px] font-medium truncate flex-1">
                      {item.label}
                    </span>
                  )}
                  {!collapsed && dynamicBadge && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0"
                      style={{
                        background: isActive
                          ? "rgba(255,255,255,0.25)"
                          : "#E21B23",
                      }}
                    >
                      {dynamicBadge}
                    </span>
                  )}
                  {collapsed && dynamicBadge && (
                    <div
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                      style={{ background: "#E21B23" }}
                    >
                      {dynamicBadge}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom user */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase"
            style={{ background: "#E21B23" }}
          >
            {initials}
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-white text-[12px] font-semibold truncate">
                {displayName}
              </div>
              <div className="text-white/40 text-[11px] truncate">
                {userEmail || "—"}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
