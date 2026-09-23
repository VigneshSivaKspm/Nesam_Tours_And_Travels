import { useState, useEffect } from "react";
import { NotificationRecord } from "../types";
import { subscribeNotifications, setFirestoreDocument, COLLECTIONS } from "../services/adminFirestoreService";

const typeIcon: Record<string, { icon: string; color: string; bg: string }> = {
  booking: { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", color: "#3B82F6", bg: "#EFF6FF" },
  payment: { icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z", color: "#10B981", bg: "#ECFDF5" },
  trip: { icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z", color: "#E21B23", bg: "#FEF2F2" },
  alert: { icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", color: "#F59E0B", bg: "#FFFBEB" },
  vendor: { icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", color: "#8B5CF6", bg: "#F5F3FF" },
  driver: { icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", color: "#6366F1", bg: "#EEF2FF" },
  penalty: { icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636", color: "#E21B23", bg: "#FEF2F2" },
  marketplace: { icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z", color: "#F59E0B", bg: "#FFFBEB" },
  payout: { icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z", color: "#10B981", bg: "#ECFDF5" },
};

export default function Notifications() {
  const [filter, setFilter] = useState("All");
  const [sendTarget, setSendTarget] = useState("All Users");
  const [sendChannel, setSendChannel] = useState("SMS");
  const [sendMessage, setSendMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [activeTab, setActiveTab] = useState<"inbox" | "send">("inbox");
  const [notifs, setNotifs] = useState<NotificationRecord[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    const unsub = subscribeNotifications(setNotifs);
    return () => unsub();
  }, []);

  const unreadCount = notifs.filter((n) => !n.read).length;

  const types = ["All", "booking", "payment", "trip", "alert", "vendor", "driver", "penalty", "marketplace", "payout"];
  const filtered = notifs.filter((n) => filter === "All" || n.type === filter);

  const markAllRead = () => {
    setNotifs(notifs.map((n) => ({ ...n, read: true })));
    notifs.forEach(n => setFirestoreDocument(COLLECTIONS.NOTIFICATIONS, String(n.id), { read: true }));
  };

  const handleSend = () => {
    const newNotif = {
      id: Date.now(),
      type: "alert",
      title: `Broadcast to ${sendTarget}`,
      message: sendMessage,
      time: "Just now",
      read: false
    };
    setFirestoreDocument(COLLECTIONS.NOTIFICATIONS, String(newNotif.id), newNotif);
    setSent(true);
    setSendMessage("");
    setTimeout(() => setSent(false), 2500);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Notifications", value: notifs.length, color: "#111" },
          { label: "Unread", value: unreadCount, color: "#E21B23" },
          { label: "Alerts", value: notifs.filter((n) => n.type === "alert").length, color: "#F59E0B" },
          { label: "Marketplace Events", value: notifs.filter((n) => n.type === "marketplace").length, color: "#8B5CF6" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
            <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[#111]">Notifications & Alert Center</h1>
          <p className="text-[12px] text-[#999] mt-0.5">Automated system notifications, alerts, SMS/WhatsApp broad-casts</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`px-4 py-2 text-[12px] font-semibold rounded-lg transition-colors ${activeTab === "inbox" ? "text-white" : "border border-[#E5E5E5] text-[#444] hover:bg-[#F5F5F5]"}`}
            style={activeTab === "inbox" ? { background: "#E21B23" } : {}}
          >
            Notification Inbox ({unreadCount} unread)
          </button>
          <button
            onClick={() => setActiveTab("send")}
            className={`px-4 py-2 text-[12px] font-semibold rounded-lg transition-colors ${activeTab === "send" ? "text-white" : "border border-[#E5E5E5] text-[#444] hover:bg-[#F5F5F5]"}`}
            style={activeTab === "send" ? { background: "#E21B23" } : {}}
          >
            Send Notification
          </button>
        </div>
      </div>

      {/* Inbox */}
      {activeTab === "inbox" && (
        <div className="space-y-4">
          {/* Filters + Mark All Read */}
          <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
            <div className="flex flex-wrap gap-1">
              {types.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all capitalize ${filter === t ? "text-white" : "text-[#666] hover:text-[#111] bg-[#F5F5F5]"}`}
                  style={filter === t ? { background: "#E21B23" } : {}}
                >
                  {t}
                </button>
              ))}
            </div>
            <button onClick={markAllRead} className="ml-auto text-[11px] font-semibold text-[#666] hover:text-[#111] transition-colors px-3 py-1 border border-[#E5E5E5] rounded-lg cursor-pointer">
              Mark all read
            </button>
          </div>

          {/* Notification Items */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
            {filtered.map((n) => {
              const ic = typeIcon[n.type] || typeIcon.alert;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 px-5 py-4 border-b border-[#F5F5F5] last:border-0 transition-colors ${!n.read ? "bg-[#FAFAFA]" : "bg-white"}`}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: ic.bg }}>
                    <svg className="w-4.5 h-4.5" style={{ color: ic.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      {ic.icon.split(" M").map((d: string, di: number) => (
                        <path key={di} strokeLinecap="round" strokeLinejoin="round" d={di === 0 ? d : "M" + d} />
                      ))}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[12px] font-semibold text-[#111]">{n.title}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-[#999]">{n.time}</span>
                        {!n.read && <div className="w-2 h-2 rounded-full" style={{ background: "#E21B23" }} />}
                      </div>
                    </div>
                    <div className="text-[11px] text-[#666] mt-0.5 leading-relaxed">{n.message}</div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-12 flex flex-col items-center text-center">
                <svg className="w-10 h-10 text-[#E5E5E5] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-[13px] text-[#999]">No notifications found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Send Notification */}
      {activeTab === "send" && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-6 space-y-5">
            <h3 className="text-[14px] font-bold text-[#111] flex items-center gap-2">
              <span className="w-1 h-4 rounded-full" style={{ background: "#E21B23" }} />
              Compose Notification
            </h3>

            <div>
              <label className="text-[11px] font-semibold text-[#999] uppercase tracking-wide block mb-2">Target Audience</label>
              <div className="flex flex-wrap gap-2">
                {["All Users", "Customers Only", "Drivers Only", "Vendors Only", "Specific User"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setSendTarget(t)}
                    className={`px-4 py-2 rounded-lg text-[12px] font-semibold border transition-all ${sendTarget === t ? "text-white border-transparent" : "text-[#666] border-[#E5E5E5] hover:border-[#E21B23]"}`}
                    style={sendTarget === t ? { background: "#E21B23" } : {}}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#999] uppercase tracking-wide block mb-2">Delivery Channel</label>
              <div className="flex gap-2">
                {["SMS", "WhatsApp", "Email", "Push Notification"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setSendChannel(c)}
                    className={`px-4 py-2 rounded-lg text-[12px] font-semibold border transition-all ${sendChannel === c ? "text-white border-transparent" : "text-[#666] border-[#E5E5E5] hover:border-[#E21B23]"}`}
                    style={sendChannel === c ? { background: "#111" } : {}}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#999] uppercase tracking-wide block mb-2">Subject / Title</label>
              <input
                placeholder="e.g. Booking Confirmation"
                className="w-full px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] text-[#111]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#999] uppercase tracking-wide block mb-2">Message Body</label>
              <textarea
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                rows={4}
                placeholder="Type your message here..."
                className="w-full px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] text-[#111] resize-none"
              />
              <div className="text-[10px] text-[#999] mt-1 text-right">{sendMessage.length} / 160 chars{sendChannel === "SMS" ? " (SMS limit)" : ""}</div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSend}
                className={`px-6 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all ${sent ? "bg-green-600" : "hover:opacity-90"}`}
                style={!sent ? { background: "#E21B23" } : {}}
              >
                {sent ? "✓ Sent Successfully!" : `Send via ${sendChannel}`}
              </button>
              <button
                onClick={() => setShowPreviewModal(true)}
                className="px-6 py-2.5 text-[13px] font-semibold text-[#666] border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] transition-colors cursor-pointer"
              >
                Preview
              </button>
            </div>
          </div>

          {/* Channel info */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { channel: "SMS", detail: "0.50₹/message via configured gateway", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
              { channel: "WhatsApp", detail: "₹1–2/conversation via WhatsApp Business API", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
              { channel: "Email", detail: "Via SMTP — Booking confirmations & invoices", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
              { channel: "Push", detail: "Firebase FCM — App & browser push alerts", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
            ].map((c) => (
              <div key={c.channel} className="bg-white rounded-xl border border-[#E5E5E5] p-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#F5F5F5] flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" style={{ color: "#E21B23" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
                  </svg>
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-[#111]">{c.channel}</div>
                  <div className="text-[10px] text-[#999] mt-0.5">{c.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
