import { useState, useEffect } from "react";
import { NotificationRecord } from "../types";
import { subscribeNotifications } from "../services/adminFirestoreService";

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

export default function Header({ title, breadcrumb, onNavigate, userName, userEmail, userRole, onSignOut }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [liveNotifs, setLiveNotifs] = useState<NotificationRecord[]>([]);

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
    const unsub = subscribeNotifications(setLiveNotifs);
    return () => unsub();
  }, []);

  const unread = liveNotifs.filter((n) => !n.read).length;

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
        className="hidden md:flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white rounded-lg transition-all hover:opacity-90 active:scale-95"
        style={{ background: "#E21B23" }}
        onClick={() => onNavigate("bookings")}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New Booking
      </button>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
          className="relative p-2 text-[#666] hover:text-[#111] hover:bg-[#F5F5F5] rounded-lg transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 text-[9px] font-bold text-white rounded-full flex items-center justify-center" style={{ background: "#E21B23" }}>
              {unread}
            </span>
          )}
        </button>
        {showNotifications && (
          <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-[#E5E5E5] z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
              <span className="font-semibold text-[13px] text-[#111]">Notifications</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: "#E21B23" }}>{unread} new</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {liveNotifs.map((n) => (
                <div key={n.id} className={`px-4 py-3 border-b border-[#F5F5F5] flex gap-3 ${!n.read ? "bg-[#FEF2F2]" : ""}`}>
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: !n.read ? "#E21B23" : "#D1D5DB" }} />
                  <div>
                    <div className="text-[12px] font-semibold text-[#111]">{n.title}</div>
                    <div className="text-[11px] text-[#666] mt-0.5">{n.message}</div>
                    <div className="text-[10px] text-[#999] mt-1">{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              className="w-full py-2.5 text-[12px] font-semibold text-center hover:bg-[#F5F5F5] transition-colors"
              style={{ color: "#E21B23" }}
              onClick={() => { setShowNotifications(false); onNavigate("notifications"); }}
            >
              View All Notifications
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
