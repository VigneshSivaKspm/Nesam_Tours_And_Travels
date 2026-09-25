import { useState, useEffect } from "react";
import {
  subscribeSettings,
  saveSettings,
} from "../services/adminFirestoreService";

const tabs = ["Company", "Booking", "Payment", "Notifications", "General"];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("Company");
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState<any>({
    companyName: "Nesam Tours & Travels Pvt. Ltd.",
    gst: "33AABCN1234F1Z5",
    phone: "+91 44 4567 8901",
    email: "info@nesamtours.in",
    website: "www.nesamtours.in",
    address: "No. 42, Mount Road, Anna Salai, Chennai - 600002, Tamil Nadu",
    advanceBookingLimit: "30",
    minBookingNotice: "2",
    cancelWindow: "24",
    cancelCharge: "10",
    allowCod: true,
    smsEnabled: true,
    emailEnabled: true,
    whatsappEnabled: false,
    pushEnabled: true,
    currency: "INR (₹)",
    timezone: "Asia/Kolkata (IST)",
    language: "English",
    gstRate: "5",
    upi: "nesamtours@hdfc",
  });

  useEffect(() => {
    const unsub = subscribeSettings((data) => {
      if (Object.keys(data).length > 0) {
        setFormData((prev: any) => ({ ...prev, ...data }));
      }
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    const { rzpKey, rzpSecret, ...safeData } = formData;
    await saveSettings(safeData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex gap-1 bg-white rounded-xl border border-[#E5E5E5] p-1 w-fit shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              activeTab === tab
                ? "text-white shadow-sm"
                : "text-[#666] hover:text-[#111]"
            }`}
            style={activeTab === tab ? { background: "#E21B23" } : {}}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-6">
        {activeTab === "Company" && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h3 className="text-[15px] font-bold text-[#111] mb-4 flex items-center gap-2">
                <span
                  className="w-1 h-4 rounded-full"
                  style={{ background: "#E21B23" }}
                />
                Company Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    label: "Company Name",
                    value: "Nesam Tours & Travels Private Limited",
                  },
                  { label: "GST Number", value: "33AABCN1234F1Z5" },
                  { label: "Phone", value: "+91 44 4567 8901" },
                  { label: "Email", value: "info@nesamtours.in" },
                  { label: "Website", value: "www.nesamtours.in" },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="text-[11px] font-semibold text-[#999] uppercase tracking-wide block mb-1.5">
                      {f.label}
                    </label>
                    <input
                      defaultValue={f.value}
                      className="w-full px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] focus:ring-1 focus:ring-[#E21B23]/20 text-[#111]"
                    />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="text-[11px] font-semibold text-[#999] uppercase tracking-wide block mb-1.5">
                    Address
                  </label>
                  <textarea
                    value={formData.address || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] focus:ring-1 focus:ring-[#E21B23]/20 text-[#111] resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Booking" && (
          <div className="space-y-5 max-w-xl">
            <h3 className="text-[15px] font-bold text-[#111] flex items-center gap-2">
              <span
                className="w-1 h-4 rounded-full"
                style={{ background: "#E21B23" }}
              />
              Booking Rules
            </h3>
            {[
              {
                label: "Advance Booking Limit (days)",
                key: "advanceBookingLimit",
              },
              {
                label: "Minimum Booking Notice (hours)",
                key: "minBookingNotice",
              },
              { label: "Cancellation Window (hours)", key: "cancelWindow" },
              { label: "Cancellation Charge (%)", key: "cancelCharge" },
            ].map((f) => (
              <div key={f.label}>
                <label className="text-[11px] font-semibold text-[#999] uppercase tracking-wide block mb-1.5">
                  {f.label}
                </label>
                <input
                  type="number"
                  value={formData[f.key] || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, [f.key]: e.target.value })
                  }
                  className="w-full px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] text-[#111]"
                />
              </div>
            ))}
            <div>
              <label className="text-[11px] font-semibold text-[#999] uppercase tracking-wide block mb-1.5">
                Allow Cash on Delivery
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={!!formData.allowCod}
                    onChange={(e) =>
                      setFormData({ ...formData, allowCod: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-[#E5E5E5] rounded-full peer peer-checked:bg-[#E21B23] transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                </div>
                <span className="text-[13px] text-[#444]">Enabled</span>
              </label>
            </div>
          </div>
        )}

        {activeTab === "Notifications" && (
          <div className="space-y-4 max-w-xl">
            <h3 className="text-[15px] font-bold text-[#111] flex items-center gap-2">
              <span
                className="w-1 h-4 rounded-full"
                style={{ background: "#E21B23" }}
              />
              Notification Channels
            </h3>
            {[
              {
                label: "SMS Notifications",
                key: "smsEnabled",
                desc: "Send SMS for bookings and updates",
              },
              {
                label: "Email Notifications",
                key: "emailEnabled",
                desc: "Send email confirmations",
              },
              {
                label: "WhatsApp Notifications",
                key: "whatsappEnabled",
                desc: "Send WhatsApp updates via API",
              },
              {
                label: "Push Notifications",
                key: "pushEnabled",
                desc: "Browser and app push alerts",
              },
            ].map((n) => (
              <div
                key={n.label}
                className="flex items-center justify-between p-4 border border-[#E5E5E5] rounded-xl"
              >
                <div>
                  <div className="text-[13px] font-semibold text-[#111]">
                    {n.label}
                  </div>
                  <div className="text-[11px] text-[#999] mt-0.5">{n.desc}</div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={!!formData[n.key]}
                      onChange={(e) =>
                        setFormData({ ...formData, [n.key]: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-[#E5E5E5] rounded-full peer peer-checked:bg-[#E21B23] transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                  </div>
                </label>
              </div>
            ))}
          </div>
        )}

        {activeTab === "General" && (
          <div className="space-y-5 max-w-xl">
            <h3 className="text-[15px] font-bold text-[#111] flex items-center gap-2">
              <span
                className="w-1 h-4 rounded-full"
                style={{ background: "#E21B23" }}
              />
              General Settings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Currency", key: "currency" },
                { label: "Time Zone", key: "timezone" },
                { label: "Language", key: "language" },
                { label: "GST Rate (%)", key: "gstRate" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-[11px] font-semibold text-[#999] uppercase tracking-wide block mb-1.5">
                    {f.label}
                  </label>
                  <input
                    value={formData[f.key] || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, [f.key]: e.target.value })
                    }
                    className="w-full px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] text-[#111]"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Payment" && (
          <div className="space-y-5 max-w-xl">
            <h3 className="text-[15px] font-bold text-[#111] flex items-center gap-2">
              <span
                className="w-1 h-4 rounded-full"
                style={{ background: "#E21B23" }}
              />
              Payment Settings
            </h3>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="text-[13px] font-semibold text-yellow-800 mb-1">
                ⚠️ Security Notice
              </div>
              <div className="text-[12px] text-yellow-700">
                Payment gateway API secrets must never be stored in Firestore.
                Configure keys via environment variables on your server or Cloud
                Functions only.
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#999] uppercase tracking-wide block mb-1.5">
                UPI ID (for manual payments)
              </label>
              <input
                value={formData.upi || ""}
                onChange={(e) =>
                  setFormData({ ...formData, upi: e.target.value })
                }
                className="w-full px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] text-[#111] font-mono"
                placeholder="nesamtours@hdfc"
              />
            </div>
          </div>
        )}

        <div className="mt-8 pt-5 border-t border-[#E5E5E5] flex gap-3">
          <button
            onClick={handleSave}
            className={`px-6 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all ${saved ? "bg-green-600" : "hover:opacity-90"}`}
            style={!saved ? { background: "#E21B23" } : {}}
          >
            {saved ? "✓ Saved!" : "Save Changes"}
          </button>
          <button
            onClick={() => setSaved(false)}
            className="px-6 py-2.5 text-[13px] font-semibold text-[#666] border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
