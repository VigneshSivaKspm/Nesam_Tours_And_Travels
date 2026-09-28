import { useState, useEffect, useMemo } from "react";
import { NotificationRecord } from "../types";
import { notifications as defaultMockNotifs } from "../data/mockData";
import {
  subscribeAdminNotifications,
  subscribeOutboundNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  dismissAdminNotification,
  sendAdminNotification,
  subscribeCustomers,
  subscribeDrivers,
  subscribeVendors,
  setFirestoreDocument,
  COLLECTIONS,
} from "../services/adminFirestoreService";

interface NotificationsPageProps {
  onNavigate?: (page: string) => void;
}

const typeIcon: Record<string, { label: string; color: string; bg: string }> = {
  booking: { label: "Booking", color: "#059669", bg: "#ECFDF5" },
  payment: { label: "Finance", color: "#16A34A", bg: "#F0FDF4" },
  payout: { label: "Payout", color: "#16A34A", bg: "#F0FDF4" },
  trip: { label: "Trip", color: "#E21B23", bg: "#FEF2F2" },
  alert: { label: "Alert", color: "#DC2626", bg: "#FEF2F2" },
  vendor: { label: "Vendor", color: "#7C3AED", bg: "#F5F3FF" },
  driver: { label: "Driver", color: "#2563EB", bg: "#EFF6FF" },
  penalty: { label: "Penalty", color: "#D97706", bg: "#FFFBEB" },
  marketplace: { label: "Marketplace", color: "#D97706", bg: "#FFFBEB" },
  system: { label: "System", color: "#4B5563", bg: "#F3F4F6" },
};

const TEMPLATES = [
  {
    name: "KYC Reminder",
    target: "all_drivers" as const,
    channel: "In-App" as const,
    type: "driver",
    title: "Document Verification Required",
    message: "Please ensure your Driving License, RC, and Insurance documents are up to date to maintain online trip dispatch.",
  },
  {
    name: "Surge / Holiday Alert",
    target: "all_drivers" as const,
    channel: "Push Notification" as const,
    type: "alert",
    title: "High Demand Expected This Weekend!",
    message: "Festive season demand is active across Chennai, Coimbatore & Madurai routes. Go online to maximize your trip earnings.",
  },
  {
    name: "Customer Booking Offer",
    target: "all_customers" as const,
    channel: "WhatsApp" as const,
    type: "booking",
    title: "Flat ₹200 OFF on Outstation Cabs",
    message: "Planning a weekend getaway? Use promo code NESAM200 on your next outstation booking. Valid till Sunday midnight.",
  },
  {
    name: "System Maintenance Notice",
    target: "admin" as const,
    channel: "In-App" as const,
    type: "system",
    title: "Scheduled Maintenance Window",
    message: "Server maintenance scheduled for tonight from 02:00 AM to 03:00 AM IST. Offline dispatch procedures will be in effect.",
  },
];

export default function NotificationsPage({ onNavigate }: NotificationsPageProps) {
  const [activeTab, setActiveTab] = useState<"inbox" | "outbox" | "send">("inbox");
  const [filterType, setFilterType] = useState("All");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Inbound Admin Notifications & Operational Alerts
  const [adminNotifs, setAdminNotifs] = useState<NotificationRecord[]>([]);

  // Outbound Notifications (Sent to drivers, customers, vendors)
  const [outboundNotifs, setOutboundNotifs] = useState<NotificationRecord[]>([]);
  const [outboundFilter, setOutboundFilter] = useState<"all" | "driver" | "customer" | "vendor">("all");

  // User lists for recipient selection
  const [users, setUsers] = useState<{ id: string; name: string; type: "customer" | "driver" | "vendor" }[]>([]);

  // Compose State
  const [sendTarget, setSendTarget] = useState<"admin" | "all_drivers" | "all_customers" | "all_vendors" | "single_user">("admin");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [sendChannel, setSendChannel] = useState<"In-App" | "SMS" | "WhatsApp" | "Email" | "Push Notification">("In-App");
  const [sendCategory, setSendCategory] = useState("alert");
  const [sendTitle, setSendTitle] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState("");

  useEffect(() => {
    // 1. Subscribe to Admin notifications & real-time operational alerts
    const unsubAdmin = subscribeAdminNotifications(setAdminNotifs);

    // 2. Subscribe to outbound platform notifications
    const unsubOutbound = subscribeOutboundNotifications(setOutboundNotifs);

    // 3. Subscribe to users (customers, drivers, vendors)
    const unsubCust = subscribeCustomers((custs) =>
      setUsers((prev) => [
        ...prev.filter((u) => u.type !== "customer"),
        ...custs.map((c) => ({
          id: c.id,
          name: `${c.name || "Customer"} (${c.phone || c.email || "No contact"})`,
          type: "customer" as const,
        })),
      ]),
    );

    const unsubDrv = subscribeDrivers((drvs) =>
      setUsers((prev) => [
        ...prev.filter((u) => u.type !== "driver"),
        ...drvs.map((d) => ({
          id: d.id,
          name: `${d.name || "Driver"} (${d.phone || (d as any).vehicle || (d as any).vehicleNumber || "Driver"})`,
          type: "driver" as const,
        })),
      ]),
    );

    const unsubVend = subscribeVendors((vends) =>
      setUsers((prev) => [
        ...prev.filter((u) => u.type !== "vendor"),
        ...vends.map((v) => ({
          id: v.id,
          name: `${v.companyName || v.name || "Vendor"} (${v.phone || "Vendor"})`,
          type: "vendor" as const,
        })),
      ]),
    );

    return () => {
      unsubAdmin();
      unsubOutbound();
      unsubCust();
      unsubDrv();
      unsubVend();
    };
  }, []);

  const fallbackAdminNotifs: NotificationRecord[] = useMemo(() => {
    return defaultMockNotifs.map((n) => ({
      id: `notif-${n.id}`,
      type: n.type as any,
      title: n.title,
      message: n.message,
      time: n.time,
      createdAt: new Date(Date.now() - n.id * 3600000).toISOString(),
      read: n.read,
      target: "admin",
      channel: "In-App",
    }));
  }, []);

  const displayAdminNotifs = adminNotifs.length > 0 ? adminNotifs : fallbackAdminNotifs;
  const unreadCount = displayAdminNotifs.filter((n) => !n.read).length;

  const [seedingAlerts, setSeedingAlerts] = useState(false);
  const handleSeedAlerts = async () => {
    setSeedingAlerts(true);
    try {
      for (const n of defaultMockNotifs) {
        await setFirestoreDocument(COLLECTIONS.NOTIFICATIONS, `notif-${n.id}`, {
          type: n.type,
          title: n.title,
          message: n.message,
          time: n.time,
          createdAt: new Date(Date.now() - n.id * 3600000).toISOString(),
          read: n.read,
          target: "admin",
          channel: "In-App",
        });
      }
      alert("Operational alerts successfully synchronized to Firestore!");
    } catch (e: any) {
      console.error(e);
      alert("Error syncing alerts: " + (e?.message || e));
    } finally {
      setSeedingAlerts(false);
    }
  };

  // Filtered Admin Inbox Alerts
  const filteredAdminNotifs = useMemo(() => {
    return displayAdminNotifs
      .filter((n) => filterType === "All" || n.type === filterType)
      .filter((n) => (!unreadOnly ? true : !n.read))
      .filter((n) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          n.title?.toLowerCase().includes(q) ||
          n.message?.toLowerCase().includes(q) ||
          n.type?.toLowerCase().includes(q)
        );
      });
  }, [displayAdminNotifs, filterType, unreadOnly, searchQuery]);

  // Filtered Outbound Notifications
  const filteredOutboundNotifs = useMemo(() => {
    return outboundNotifs
      .filter((n) => {
        if (outboundFilter === "all") return true;
        return n.recipientType === outboundFilter;
      })
      .filter((n) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          n.title?.toLowerCase().includes(q) ||
          n.message?.toLowerCase().includes(q) ||
          n.recipientName?.toLowerCase().includes(q) ||
          n.recipientType?.toLowerCase().includes(q)
        );
      });
  }, [outboundNotifs, outboundFilter, searchQuery]);

  const handleAction = (n: NotificationRecord) => {
    markAdminNotificationRead(n);
    if (!onNavigate) return;
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
    }
  };

  const handleSend = async () => {
    if (!sendTitle.trim() || !sendMessage.trim()) {
      alert("Please enter both a title and message body.");
      return;
    }

    setIsSending(true);
    const selectedUser = users.find((u) => u.id === selectedUserId);

    const res = await sendAdminNotification(
      {
        target: sendTarget,
        recipientId: selectedUserId,
        recipientName: selectedUser?.name,
        recipientType: selectedUser?.type,
        channel: sendChannel,
        type: sendCategory,
        title: sendTitle.trim(),
        message: sendMessage.trim(),
      },
      users,
    );

    setIsSending(false);
    if (res.success) {
      setSendSuccessMessage(
        sendTarget === "admin"
          ? "Alert successfully posted to Super Admin Console!"
          : `Notification dispatched successfully (${res.count} recipient${res.count > 1 ? "s" : ""})!`,
      );
      setSendTitle("");
      setSendMessage("");
      setTimeout(() => setSendSuccessMessage(""), 4000);
    } else {
      alert("Failed to dispatch notification. Please check connection and permissions.");
    }
  };

  const applyTemplate = (t: (typeof TEMPLATES)[0]) => {
    setSendTarget(t.target);
    setSendChannel(t.channel);
    setSendCategory(t.type);
    setSendTitle(t.title);
    setSendMessage(t.message);
  };

  const typesList = [
    "All",
    "driver",
    "booking",
    "vendor",
    "alert",
    "payment",
    "penalty",
    "system",
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#E5E5E5]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold text-[#111]">
              Notifications &amp; Alert Center
            </h1>
            <span
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white"
              style={{ background: "#E21B23" }}
            >
              Super Admin Console
            </span>
          </div>
          <p className="text-[13px] text-[#666] mt-0.5">
            Real-time platform operations, live dispatch alerts, driver KYC updates, and communications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {adminNotifs.length === 0 && (
            <button
              onClick={handleSeedAlerts}
              disabled={seedingAlerts}
              className="px-3.5 py-2 text-[12px] font-bold text-amber-900 bg-amber-50 border border-amber-300 rounded-xl hover:bg-amber-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <span>⚡</span>
              <span>{seedingAlerts ? "Syncing Alerts…" : "Sync Operational Alerts to Cloud"}</span>
            </button>
          )}

          {/* Tab Controls */}
          <div className="flex items-center bg-[#F5F5F5] p-1 rounded-xl border border-[#E5E5E5]">
            <button
              onClick={() => { setActiveTab("inbox"); setSearchQuery(""); }}
              className={`px-4 py-2 text-[12px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "inbox"
                  ? "bg-white text-[#111] shadow-sm"
                  : "text-[#666] hover:text-[#111]"
              }`}
            >
              <span>Admin Alerts</span>
              {unreadCount > 0 && (
                <span className="w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ background: "#E21B23" }}>
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab("outbox"); setSearchQuery(""); }}
              className={`px-4 py-2 text-[12px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "outbox"
                  ? "bg-white text-[#111] shadow-sm"
                  : "text-[#666] hover:text-[#111]"
              }`}
            >
              <span>Sent Notices / Outbox</span>
              <span className="text-[11px] text-[#999]">({outboundNotifs.length})</span>
            </button>

            <button
              onClick={() => { setActiveTab("send"); setSearchQuery(""); }}
              className={`px-4 py-2 text-[12px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "send"
                  ? "bg-white text-[#111] shadow-sm"
                  : "text-[#666] hover:text-[#111]"
              }`}
            >
              <span>+ Compose &amp; Send</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: ADMIN ALERTS INBOX */}
      {activeTab === "inbox" && (
        <div className="space-y-5">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#888] uppercase tracking-wider">Total Alerts</div>
              <div className="text-[24px] font-extrabold text-[#111] mt-1">{displayAdminNotifs.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#888] uppercase tracking-wider">Unread Action Items</div>
              <div className="text-[24px] font-extrabold mt-1" style={{ color: "#E21B23" }}>
                {unreadCount}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#888] uppercase tracking-wider">Driver KYC Applications</div>
              <div className="text-[24px] font-extrabold text-blue-600 mt-1">
                {displayAdminNotifs.filter((n) => n.type === "driver").length}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#888] uppercase tracking-wider">Bookings &amp; SOS</div>
              <div className="text-[24px] font-extrabold text-emerald-600 mt-1">
                {displayAdminNotifs.filter((n) => n.type === "booking" || n.type === "alert").length}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-[#E5E5E5] p-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {typesList.map((t) => {
                const isSelected = filterType === t;
                const badge = typeIcon[t] || { label: t, color: "#111", bg: "#F5F5F5" };
                return (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all capitalize cursor-pointer ${
                      isSelected
                        ? "text-white"
                        : "text-[#666] bg-[#F5F5F5] hover:bg-[#EAEAEA] hover:text-[#111]"
                    }`}
                    style={isSelected ? { background: "#E21B23" } : {}}
                  >
                    {t === "All" ? "All Categories" : badge.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setUnreadOnly(!unreadOnly)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                  unreadOnly
                    ? "bg-[#FEF2F2] text-[#E21B23] border-[#E21B23]"
                    : "bg-white text-[#666] border-[#E5E5E5] hover:bg-[#F5F5F5]"
                }`}
              >
                {unreadOnly ? "Showing: Unread Only" : "Filter: All Status"}
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAdminNotificationsRead(displayAdminNotifs)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ background: "#111" }}
                >
                  Mark All Read
                </button>
              )}
            </div>
          </div>

          {/* Alerts List */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-xs overflow-hidden divide-y divide-[#F5F5F5]">
            {filteredAdminNotifs.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-[#F5F5F5] mx-auto flex items-center justify-center text-green-600 mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="text-[14px] font-bold text-[#111]">No notifications to display</div>
                <div className="text-[12px] text-[#999] mt-1 mb-4">
                  {unreadOnly
                    ? "All notifications have been marked as read."
                    : "No active platform alerts match the selected criteria."}
                </div>
                {adminNotifs.length === 0 && (
                  <button
                    onClick={handleSeedAlerts}
                    disabled={seedingAlerts}
                    className="px-4 py-2 text-[12px] font-bold text-white rounded-lg shadow-sm hover:opacity-90 transition-opacity inline-flex items-center gap-2 cursor-pointer"
                    style={{ background: "#E21B23" }}
                  >
                    <span>⚡</span>
                    <span>Sync Sample Operational Alerts to Cloud</span>
                  </button>
                )}
              </div>
            ) : (
              filteredAdminNotifs.map((n) => {
                const badge = typeIcon[n.type] || typeIcon.system;
                return (
                  <div
                    key={n.id}
                    className={`p-4 sm:p-5 flex flex-col sm:flex-row items-start justify-between gap-4 transition-colors ${
                      !n.read ? "bg-[#FFF9F9]" : "bg-white hover:bg-[#FAFAFA]"
                    }`}
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                        style={{ background: !n.read ? "#E21B23" : "#D1D5DB" }}
                      />

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                            style={{ color: badge.color, backgroundColor: badge.bg }}
                          >
                            {badge.label}
                          </span>
                          {n.priority === "urgent" && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-red-600 text-white animate-pulse">
                              URGENT
                            </span>
                          )}
                          {n.isSystemAlert && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              System Real-time
                            </span>
                          )}
                          <span className="text-[11px] text-[#999] font-medium ml-auto sm:ml-0">
                            {n.time}
                          </span>
                        </div>

                        <div className="text-[13px] font-bold text-[#111] leading-snug">
                          {n.title}
                        </div>

                        <div className="text-[12px] text-[#555] leading-relaxed">
                          {n.message}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleAction(n)}
                        className="px-3.5 py-1.5 text-[11px] font-bold text-white rounded-lg transition-all hover:opacity-90 active:scale-95 cursor-pointer flex items-center gap-1 shadow-xs"
                        style={{ background: "#E21B23" }}
                      >
                        <span>Take Action</span>
                        <span>&rarr;</span>
                      </button>

                      <button
                        onClick={() => markAdminNotificationRead({ ...n, read: !n.read })}
                        title={n.read ? "Mark as unread" : "Mark as read"}
                        className="px-2.5 py-1.5 text-[11px] font-semibold text-[#666] hover:text-[#111] border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] transition-colors cursor-pointer"
                      >
                        {n.read ? "Mark Unread" : "Mark Read"}
                      </button>

                      <button
                        onClick={() => dismissAdminNotification(n)}
                        title="Dismiss notification"
                        className="p-1.5 text-[#999] hover:text-[#E21B23] rounded-lg hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SENT NOTIFICATIONS / OUTBOX AUDIT LOG */}
      {activeTab === "outbox" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-[#E5E5E5] p-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-[#111]">Recipient Filter:</span>
              {(["all", "driver", "customer", "vendor"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setOutboundFilter(r)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold capitalize transition-colors cursor-pointer ${
                    outboundFilter === r
                      ? "text-white"
                      : "text-[#666] bg-[#F5F5F5] hover:bg-[#EAEAEA]"
                  }`}
                  style={outboundFilter === r ? { background: "#111" } : {}}
                >
                  {r === "all" ? "All Recipients" : `${r}s`}
                </button>
              ))}
            </div>

            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search outbox..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-[12px] bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg w-56 focus:outline-none focus:border-[#E21B23]"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-xs overflow-hidden divide-y divide-[#F5F5F5]">
            {filteredOutboundNotifs.length === 0 ? (
              <div className="py-16 text-center text-[#999] text-[13px]">
                No outbound notifications matching current filter.
              </div>
            ) : (
              filteredOutboundNotifs.map((n) => {
                const isDriver = n.recipientType === "driver";
                const isCustomer = n.recipientType === "customer";
                const isVendor = n.recipientType === "vendor";

                return (
                  <div key={n.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            isDriver
                              ? "bg-blue-100 text-blue-700"
                              : isCustomer
                                ? "bg-emerald-100 text-emerald-700"
                                : isVendor
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          Target: {n.recipientType || "Broadcast"}
                        </span>

                        {n.channel && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            Channel: {n.channel}
                          </span>
                        )}

                        <span className="text-[11px] text-[#999]">
                          Sent {n.time}
                        </span>
                      </div>

                      <div className="text-[13px] font-bold text-[#111]">
                        {n.title}
                      </div>

                      <div className="text-[12px] text-[#555] leading-relaxed">
                        {n.message}
                      </div>

                      {n.recipientId && (
                        <div className="text-[10px] text-[#999] font-mono">
                          Recipient ID: {n.recipientId} {n.recipientName ? `• ${n.recipientName}` : ""}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                          n.read
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${n.read ? "bg-green-600" : "bg-gray-400"}`} />
                        {n.read ? "Read by recipient" : "Delivered / Unopened"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: COMPOSE & SEND */}
      {activeTab === "send" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E5E5] p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5F5F5]">
              <h2 className="text-[15px] font-bold text-[#111] flex items-center gap-2">
                <span className="w-1.5 h-4 rounded-full" style={{ background: "#E21B23" }} />
                Compose Broadcast or Direct Notification
              </h2>
            </div>

            {sendSuccessMessage && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-[13px] font-semibold flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {sendSuccessMessage}
              </div>
            )}

            {/* Recipient Target */}
            <div>
              <label className="text-[11px] font-bold text-[#888] uppercase tracking-wider block mb-2">
                Target Audience
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: "admin", label: "Super Admin" },
                  { id: "all_drivers", label: "All Drivers" },
                  { id: "all_customers", label: "All Customers" },
                  { id: "all_vendors", label: "All Vendors" },
                  { id: "single_user", label: "Specific User" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSendTarget(t.id as any)}
                    className={`py-2 px-2.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      sendTarget === t.id
                        ? "text-white border-transparent shadow-xs"
                        : "text-[#555] border-[#E5E5E5] hover:bg-[#F5F5F5]"
                    }`}
                    style={sendTarget === t.id ? { background: "#111" } : {}}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {sendTarget === "single_user" && (
                <div className="mt-3">
                  <label className="text-[11px] font-semibold text-[#888] block mb-1">
                    Select User / Driver / Vendor
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23]"
                  >
                    <option value="">-- Choose recipient --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        [{u.type.toUpperCase()}] {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Channel Selection */}
            <div>
              <label className="text-[11px] font-bold text-[#888] uppercase tracking-wider block mb-2">
                Delivery Channel
              </label>
              <div className="flex flex-wrap gap-2">
                {(["In-App", "SMS", "WhatsApp", "Email", "Push Notification"] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setSendChannel(ch)}
                    className={`px-3.5 py-1.5 rounded-lg text-[12px] font-bold border transition-all cursor-pointer ${
                      sendChannel === ch
                        ? "bg-[#FEF2F2] text-[#E21B23] border-[#E21B23]"
                        : "text-[#666] border-[#E5E5E5] hover:bg-[#F5F5F5]"
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            {/* Category / Type */}
            <div>
              <label className="text-[11px] font-bold text-[#888] uppercase tracking-wider block mb-2">
                Alert Category
              </label>
              <select
                value={sendCategory}
                onChange={(e) => setSendCategory(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23]"
              >
                <option value="alert">General Alert &amp; Warning</option>
                <option value="driver">Driver Compliance / Operation</option>
                <option value="booking">Booking &amp; Trip Notice</option>
                <option value="vendor">Vendor Notification</option>
                <option value="payment">Payment &amp; Wallet</option>
                <option value="system">System Maintenance</option>
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="text-[11px] font-bold text-[#888] uppercase tracking-wider block mb-2">
                Subject / Title
              </label>
              <input
                type="text"
                value={sendTitle}
                onChange={(e) => setSendTitle(e.target.value)}
                placeholder="e.g. Action Required: Vehicle Inspection"
                className="w-full px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23]"
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="text-[11px] font-bold text-[#888] uppercase tracking-wider block mb-2">
                Message Body
              </label>
              <textarea
                rows={4}
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                placeholder="Enter complete notification message..."
                className="w-full px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] resize-none"
              />
              <div className="flex justify-between items-center text-[11px] text-[#999] mt-1">
                <span>Supports markdown and standard emojis</span>
                <span>{sendMessage.length} chars</span>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                disabled={isSending}
                onClick={handleSend}
                className="px-6 py-2.5 text-[13px] font-bold text-white rounded-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                style={{ background: "#E21B23" }}
              >
                {isSending ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <span>Dispatch Notification</span>
                    <span>&rarr;</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Presets & Live Preview */}
          <div className="space-y-4">
            {/* Live Preview Card */}
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 shadow-xs">
              <div className="text-[11px] font-bold text-[#888] uppercase tracking-wider mb-3">
                Live Preview (Recipient View)
              </div>
              <div className="p-3.5 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 uppercase">
                    {sendCategory}
                  </span>
                  <span className="text-[10px] text-[#999]">Just now</span>
                </div>
                <div className="text-[13px] font-bold text-[#111]">
                  {sendTitle.trim() || "Notification Title"}
                </div>
                <div className="text-[12px] text-[#666] leading-relaxed">
                  {sendMessage.trim() || "Notification body text will render here as recipients see it."}
                </div>
                <div className="pt-1 text-[10px] text-[#999] flex items-center justify-between border-t border-[#EAEAEA]">
                  <span>Via {sendChannel}</span>
                  <span className="font-semibold text-[#E21B23]">Nesam System</span>
                </div>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 shadow-xs space-y-3">
              <div className="text-[11px] font-bold text-[#888] uppercase tracking-wider">
                Quick Template Presets
              </div>
              <div className="space-y-2">
                {TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    type="button"
                    onClick={() => applyTemplate(tmpl)}
                    className="w-full text-left p-2.5 rounded-lg border border-[#E5E5E5] hover:border-[#E21B23] hover:bg-[#FFF9F9] transition-all cursor-pointer group"
                  >
                    <div className="text-[12px] font-bold text-[#111] group-hover:text-[#E21B23]">
                      {tmpl.name}
                    </div>
                    <div className="text-[11px] text-[#666] line-clamp-1 mt-0.5">
                      {tmpl.title}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
