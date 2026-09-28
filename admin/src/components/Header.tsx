import { useState, useEffect, useRef } from "react";
import { NotificationRecord } from "../types";
import {
  subscribeAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "../services/adminFirestoreService";

interface HeaderProps {
  title: string;
  breadcrumb: string[];
  onNavigate: (page: string) => void;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  onSignOut?: () => void;
}

const pageTitles: Record<string, string> = {
  dashboard: "Dashboard", bookings: "Bookings", trips: "Live Trips",
  customers: "Customers", drivers: "Drivers", vehicles: "Vehicles",
  categories: "Vehicle Categories", services: "Services", packages: "Tour Packages",
  locations: "Locations", pricing: "Pricing & Fare Management", offers: "Offers & Coupons",
  payments: "Payments", invoices: "Invoices", earnings: "Driver Earnings",
  reviews: "Reviews", notifications: "Notifications", reports: "Reports & Analytics",
  staff: "Staff & Roles", settings: "Settings",
};

const getBadgeStyle = (type: string) => {
  switch (type) {
    case "driver":
      return { label: "Driver", color: "#2563EB", bg: "#EFF6FF" };
    case "booking":
      return { label: "Booking", color: "#059669", bg: "#ECFDF5" };
    case "vendor":
      return { label: "Vendor", color: "#7C3AED", bg: "#F5F3FF" };
    case "alert":
    case "trip":
      return { label: "Alert", color: "#DC2626", bg: "#FEF2F2" };
    case "payment":
    case "payout":
      return { label: "Finance", color: "#16A34A", bg: "#F0FDF4" };
    case "penalty":
      return { label: "Penalty", color: "#D97706", bg: "#FFFBEB" };
    default:
      return { label: "System", color: "#4B5563", bg: "#F3F4F6" };
  }
};

export default function Header({ title, breadcrumb, onNavigate, userName, userEmail, userRole, onSignOut }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [liveNotifs, setLiveNotifs] = useState<NotificationRecord[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = userName || userEmail?.split("@")[0] || "Admin";
  const initials =
    displayName
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "A";
  const roleLabel = userRole
    ? userRole.charAt(0).toUpperCase() + userRole.slice(1)
    : "Administrator";

  useEffect(() => {
    const unsub = subscribeAdminNotifications(setLiveNotifs);
    return () => unsub();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);

  const unread = liveNotifs.filter((n) => !n.read).length;

  const handleNotificationClick = (n: NotificationRecord) => {
    markAdminNotificationRead(n);
    setShowNotifications(false);
    if (n.actionUrl) {
      onNavigate(n.actionUrl);
    } else if (n.type === "driver") {
      onNavigate("drivers");
    } else if (n.type === "booking") {
      onNavigate("bookings");
    } else if (n.type === "vendor") {
      onNavigate("vendors");
    } else if (n.type === "alert" || n.type === "trip") {
      onNavigate("trips");
    } else if (n.type === "penalty") {
      onNavigate("penalties");
    } else {
      onNavigate("notifications");
    }
  };

  const handleMarkAllRead = () => {
    markAllAdminNotificationsRead(liveNotifs);
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E5E5E5] h-16 flex items-center px-6 gap-4">
      {/* Left */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[17px] font-bold text-[#111111] leading-tight">{title}</h1>
        <div className="flex items-center gap-1.5 text-[11px] text-[#999]">
          <span>Nesam Admin</span>
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span>/</span>
              <span className={i === breadcrumb.length - 1 ? "text-[#E21B23] font-medium" : ""}>
                {crumb}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative hidden md:block">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search anything..."
          className="pl-9 pr-4 py-2 text-[13px] bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg w-60 focus:outline-none focus:border-[#E21B23] focus:ring-1 focus:ring-[#E21B23]/20 transition-all placeholder-[#999]"
        />
      </div>

      {/* Actions */}
      <button
        className="hidden md:flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white rounded-lg transition-all hover:opacity-90 active:scale-95 cursor-pointer"
        style={{ background: "#E21B23" }}
        onClick={() => onNavigate("bookings")}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New Booking
      </button>

      {/* Notifications */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
          className="relative p-2 text-[#666] hover:text-[#111] hover:bg-[#F5F5F5] rounded-lg transition-all cursor-pointer"
          aria-label="Admin Notifications"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 text-[9px] font-bold text-white rounded-full flex items-center justify-center animate-pulse" style={{ background: "#E21B23" }}>
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        {showNotifications && (
          <div className="absolute right-0 top-12 w-88 sm:w-96 bg-white rounded-xl shadow-2xl border border-[#E5E5E5] z-50 overflow-hidden">
            {/* Popover Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[13px] text-[#111]">Admin Alerts</span>
                {unread > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "#E21B23" }}>
                    {unread} unread
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-[#666] hover:text-[#E21B23] transition-colors cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-[#F5F5F5]">
              {liveNotifs.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-[#F5F5F5] flex items-center justify-center text-[#999] mb-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-[12px] font-semibold text-[#111]">All caught up!</div>
                  <div className="text-[11px] text-[#999] mt-0.5">No pending admin notifications or operational alerts.</div>
                </div>
              ) : (
                liveNotifs.map((n) => {
                  const badge = getBadgeStyle(n.type);
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left p-3.5 flex gap-3 items-start transition-colors cursor-pointer group ${
                        !n.read ? "bg-[#FFF8F8] hover:bg-[#FFF0F0]" : "bg-white hover:bg-[#F9FAFB]"
                      }`}
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: !n.read ? "#E21B23" : "#D1D5DB" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                            style={{ color: badge.color, backgroundColor: badge.bg }}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-[#999] shrink-0 font-medium">
                            {n.time}
                          </span>
                        </div>
                        <div className="text-[12px] font-semibold text-[#111] group-hover:text-[#E21B23] transition-colors leading-snug">
                          {n.title}
                        </div>
                        <div className="text-[11px] text-[#666] mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-[#E21B23]">
                          <span>Take action</span>
                          <span>&rarr;</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <button
              className="w-full py-2.5 text-[12px] font-bold text-center border-t border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              style={{ color: "#E21B23" }}
              onClick={() => { setShowNotifications(false); onNavigate("notifications"); }}
            >
              <span>View All Notifications &amp; Alert Center</span>
              <span>&rarr;</span>
            </button>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="relative">
        <button
          onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
          className="flex items-center gap-2 pl-2 pr-3 py-1.5 hover:bg-[#F5F5F5] rounded-lg transition-all"
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 uppercase" style={{ background: "#E21B23" }}>{initials}</div>
          <div className="hidden md:block text-left">
            <div className="text-[12px] font-semibold text-[#111] leading-tight">{displayName}</div>
            <div className="text-[10px] text-[#999] leading-tight">{roleLabel}</div>
          </div>
          <svg className="w-4 h-4 text-[#999] hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showProfile && (
          <div className="absolute right-0 top-12 w-52 bg-white rounded-xl shadow-2xl border border-[#E5E5E5] z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E5E5]">
              <div className="text-[13px] font-semibold text-[#111]">{displayName}</div>
              <div className="text-[11px] text-[#999]">{userEmail || "—"}</div>
            </div>
            {["Profile", "Settings", "Activity Log"].map((item) => (
              <button key={item} className="w-full text-left px-4 py-2.5 text-[13px] text-[#444] hover:bg-[#F5F5F5] transition-colors">
                {item}
              </button>
            ))}
            <div className="border-t border-[#E5E5E5]">
              <button
                onClick={() => onSignOut?.()}
                className="w-full text-left px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-[#FEF2F2]"
                style={{ color: "#E21B23" }}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
