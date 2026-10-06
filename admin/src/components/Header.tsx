import { useState, useEffect, useRef } from "react";
import { CATEGORIES, CATEGORY_LABEL, TONE_CLASSES, categoryOf, ctaLabelOf, toneOf, type NotificationCategory } from "../services/notificationModel";
import { useNotifications } from "./NotificationHost";
import { formatTimeAgo } from "../services/adminNotificationService";

interface HeaderProps {
  title: string;
  breadcrumb: string[];
  onNavigate: (page: string) => void;
  onCreateBooking?: () => void;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  onSignOut?: () => void;
}

export default function Header({ title, breadcrumb, onNavigate, onCreateBooking, userName, userEmail, userRole, onSignOut }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [tab, setTab] = useState<"all" | NotificationCategory>("all");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unread, unreadByCategory, loading, markAllRead, open, soundOn, setSoundOn, audio } = useNotifications();

  const displayName = userName || userEmail?.split("@")[0] || "Admin";
  const initials = displayName.split(/\s+/).map((w) => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "A";
  const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : "Administrator";

  useEffect(() => {
    if (!showNotifications) return;
    const onDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowNotifications(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showNotifications]);

  const list = (tab === "all" ? notifications : notifications.filter((n) => categoryOf(n) === tab)).slice(0, 40);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E5E5E5] h-16 flex items-center px-4 md:px-6 gap-3">
      <div className="flex-1 min-w-0 pl-12 lg:pl-0">
        <h1 className="text-[17px] font-bold text-[#111111] leading-tight truncate">{title}</h1>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#666]">
          <span>Nesam Admin</span>
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span>/</span>
              <span className={i === breadcrumb.length - 1 ? "text-[#E21B23] font-medium" : ""}>{crumb}</span>
            </span>
          ))}
        </div>
      </div>

      {onCreateBooking && (
        <button className="flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-semibold text-white rounded-lg bg-[#E21B23] hover:bg-[#c4151c] active:scale-95 transition-all" onClick={onCreateBooking}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">Create New Booking</span>
          <span className="sm:hidden">New</span>
        </button>
      )}

      {/* Notifications */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
          className="relative p-2 text-[#555] hover:text-[#111] hover:bg-[#F5F5F5] rounded-lg transition-all"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          aria-expanded={showNotifications}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 text-[11px] font-bold text-white rounded-full flex items-center justify-center bg-[#E21B23]">{unread > 99 ? "99+" : unread}</span>
          )}
        </button>

        {showNotifications && (
          <div className="absolute right-0 top-12 w-[min(26rem,calc(100vw-1.5rem))] bg-white rounded-xl shadow-2xl border border-[#E5E5E5] z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#111]">Notifications</span>
                {unread > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white bg-[#E21B23]">{unread} unread</span>}
              </div>
              {unread > 0 && <button onClick={() => markAllRead()} className="text-xs font-semibold text-[#555] hover:text-[#E21B23]">Mark all read</button>}
            </div>

            <div role="tablist" aria-label="Notification categories" className="flex gap-1 overflow-x-auto px-2 pt-2 border-b border-[#EEE]">
              {(["all", ...CATEGORIES] as const).map((k) => {
                const count = k === "all" ? unread : unreadByCategory[k];
                return (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-2.5 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px ${tab === k ? "border-[#E21B23] text-[#E21B23]" : "border-transparent text-[#555] hover:text-[#111]"}`}>
                    {k === "all" ? "All" : CATEGORY_LABEL[k]}{count > 0 && <span className="ml-1 px-1.5 rounded-full bg-[#E21B23] text-white text-[10px]">{count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-[#F0F0F0]">
              {loading ? (
                <div className="py-8 text-center text-sm text-[#555]" role="status">Loading…</div>
              ) : list.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <div className="text-sm font-semibold text-[#111]">All caught up</div>
                  <div className="text-xs text-[#555] mt-0.5">{tab === "all" ? "No notifications or alerts." : `No ${CATEGORY_LABEL[tab].toLowerCase()} notifications.`}</div>
                </div>
              ) : (
                list.map((n) => {
                  const tone = TONE_CLASSES[toneOf(n)];
                  return (
                    <button key={n.id} onClick={() => { setShowNotifications(false); open(n); }} className={`w-full text-left p-3.5 flex gap-3 items-start group ${!n.read ? "bg-[#FFF8F8] hover:bg-[#FFF0F0]" : "bg-white hover:bg-[#F9FAFB]"}`}>
                      <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: n.read ? "#D1D5DB" : tone.dot }} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5 mb-0.5">
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${tone.chip}`}>{CATEGORY_LABEL[categoryOf(n)]}</span>
                          <span className="text-xs text-[#555] shrink-0">{n.time || formatTimeAgo(n.createdAt)}</span>
                        </div>
                        <div className="text-sm font-semibold text-[#111] group-hover:text-[#E21B23] leading-snug">{n.title}</div>
                        <div className="text-xs text-[#444] mt-0.5 line-clamp-2">{n.message}</div>
                        <div className="mt-1 text-xs font-semibold text-[#E21B23]">{ctaLabelOf(n)} →</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-[#E5E5E5] bg-[#FAFAFA]">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#333]">
                <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} className="w-4 h-4 accent-[#E21B23]" />
                Sound
                {soundOn && audio === "locked" && <span className="font-normal text-amber-800">(click anywhere once to enable)</span>}
                {audio === "unsupported" && <span className="font-normal text-[#777]">(not supported)</span>}
              </label>
              <button className="text-sm font-bold text-[#E21B23] hover:underline" onClick={() => { setShowNotifications(false); onNavigate("notifications"); }}>
                Open Notification Center →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="relative">
        <button onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }} className="flex items-center gap-2 pl-2 pr-2 md:pr-3 py-1.5 hover:bg-[#F5F5F5] rounded-lg transition-all" aria-label="Account menu">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 uppercase bg-[#E21B23]">{initials}</div>
          <div className="hidden md:block text-left">
            <div className="text-sm font-semibold text-[#111] leading-tight">{displayName}</div>
            <div className="text-xs text-[#555] leading-tight">{roleLabel}</div>
          </div>
        </button>
        {showProfile && (
          <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-2xl border border-[#E5E5E5] z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E5E5]">
              <div className="text-sm font-semibold text-[#111]">{displayName}</div>
              <div className="text-xs text-[#555] break-all">{userEmail || "—"}</div>
            </div>
            <button onClick={() => { setShowProfile(false); onNavigate("settings"); }} className="w-full text-left px-4 py-2.5 text-sm text-[#333] hover:bg-[#F5F5F5]">Settings</button>
            <div className="border-t border-[#E5E5E5]">
              <button onClick={() => onSignOut?.()} className="w-full text-left px-4 py-2.5 text-sm font-medium text-[#E21B23] hover:bg-[#FEF2F2]">Sign Out</button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
