import { useState } from "react";

interface B2BPartner {
  id: string;
  name: string;
  logo: string;
  category: string;
  status: "Active" | "Testing" | "Inactive";
  apiKey: string;
  webhookUrl: string;
  revenueSplit: string;
  lastSync: string;
  totalBookings: number;
  totalRevenue: number;
}

const initialPartners: B2BPartner[] = [
  {
    id: "MMT",
    name: "MakeMyTrip (MMT)",
    logo: "✈️",
    category: "Online Travel Agency (OTA)",
    status: "Active",
    apiKey: "mmt_live_sec_89410a8c2f1e40",
    webhookUrl: "https://api.nesamexpress.com/v1/b2b/webhooks/mmt",
    revenueSplit: "12% Commission to MMT, 88% to Nesam",
    lastSync: "2 mins ago",
    totalBookings: 1420,
    totalRevenue: 4850000
  },
  {
    id: "TC",
    name: "Thomas Cook India",
    logo: "🧳",
    category: "Corporate & Outstation Tour Partner",
    status: "Active",
    apiKey: "tc_live_sec_77190b91e32d55",
    webhookUrl: "https://api.nesamexpress.com/v1/b2b/webhooks/thomascook",
    revenueSplit: "10% Commission to TC, 90% to Nesam",
    lastSync: "14 mins ago",
    totalBookings: 680,
    totalRevenue: 3200000
  },
  {
    id: "TNT",
    name: "Tamil Nadu Tourism (TTDC)",
    logo: "🏛️",
    category: "Government State Tourism Board",
    status: "Active",
    apiKey: "ttdc_govt_sec_99014a11b660c2",
    webhookUrl: "https://api.nesamexpress.com/v1/b2b/webhooks/ttdc",
    revenueSplit: "5% Govt Cess, 95% Direct Fleet Payout",
    lastSync: "1 hour ago",
    totalBookings: 2150,
    totalRevenue: 7900000
  }
];

const mockWebhookLogs = [
  { id: "LOG-901", partner: "MakeMyTrip", event: "BOOKING_CREATED", bookingId: "NESAM-MMT-8821", status: "Success", timestamp: "14:32:05" },
  { id: "LOG-902", partner: "Thomas Cook", event: "DRIVER_ASSIGNED", bookingId: "NESAM-TC-7712", status: "Success", timestamp: "14:28:19" },
  { id: "LOG-903", partner: "Tamil Nadu Tourism", event: "TRIP_COMPLETED", bookingId: "NESAM-TTDC-4401", status: "Success", timestamp: "14:15:40" },
  { id: "LOG-904", partner: "MakeMyTrip", event: "CANCELLATION_SYNC", bookingId: "NESAM-MMT-8809", status: "Processed", timestamp: "13:50:11" },
];

export default function B2BIntegrations() {
  const [partners, setPartners] = useState<B2BPartner[]>(initialPartners);
  const [selectedPartner, setSelectedPartner] = useState<B2BPartner | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const handleTestConnection = (partnerName: string) => {
    setSyncStatusMsg(`Testing API Ping connection to ${partnerName}...`);
    setTimeout(() => {
      setSyncStatusMsg(`✅ Connection to ${partnerName} API endpoint verified successfully (200 OK - Response Time: 42ms)`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    }, 1200);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-[#111111] text-white p-6 rounded-2xl border border-[#262626] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#E21B23]">ENTERPRISE B2B APIS</span>
          <h1 className="text-xl font-extrabold mt-0.5">Corporate & B2B Integration Engine</h1>
          <p className="text-xs text-gray-400">Automated API sync with MakeMyTrip, Thomas Cook & Tamil Nadu Tourism (TTDC)</p>
        </div>

        <button
          onClick={() => handleTestConnection("All Partners")}
          className="px-5 py-2.5 bg-[#E21B23] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          ⚡ Run Health Check Ping
        </button>
      </div>

      {syncStatusMsg && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
          <span>{syncStatusMsg}</span>
        </div>
      )}

      {/* Partner Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {partners.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4 hover:border-[#E21B23] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.logo}</span>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{p.name}</h3>
                    <span className="text-[10px] text-gray-500 font-medium">{p.category}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  ● {p.status}
                </span>
              </div>

              <div className="space-y-2.5 py-3 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Total Bookings:</span>
                  <span className="font-bold text-gray-900">{p.totalBookings.toLocaleString()} Bookings</span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>Total Gross Revenue:</span>
                  <span className="font-bold text-[#E21B23]">₹{(p.totalRevenue / 100000).toFixed(2)} Lakhs</span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>Commercial Split:</span>
                  <span className="font-semibold text-gray-800 text-[11px]">{p.revenueSplit}</span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>API Key (Secret):</span>
                  <span className="font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{p.apiKey.substring(0, 12)}...</span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>Last Webhook Sync:</span>
                  <span className="font-mono text-gray-500">{p.lastSync}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
              <button
                onClick={() => setSelectedPartner(p)}
                className="text-xs font-bold text-[#E21B23] hover:underline"
              >
                Configure API & Webhooks
              </button>

              <button
                onClick={() => handleTestConnection(p.name)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[11px] font-bold rounded-lg"
              >
                Test Ping
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Webhook Activity Log */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-bold text-gray-900">Real-Time B2B Webhook Event Log</h2>
          <span className="text-xs font-mono text-gray-500">Auto-refresh: Active (5s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-500 uppercase tracking-wider text-[10px]">
                <th className="p-3 text-left">Event ID</th>
                <th className="p-3 text-left">Partner</th>
                <th className="p-3 text-left">Event Type</th>
                <th className="p-3 text-left">Booking Ref</th>
                <th className="p-3 text-left">Sync Status</th>
                <th className="p-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {mockWebhookLogs.map(log => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3 font-mono font-bold text-gray-900">{log.id}</td>
                  <td className="p-3 font-bold text-gray-800">{log.partner}</td>
                  <td className="p-3 font-mono text-blue-700 font-bold">{log.event}</td>
                  <td className="p-3 font-mono text-gray-700">{log.bookingId}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      ✓ {log.status}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono text-gray-500">{log.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIGURATION MODAL */}
      {selectedPartner && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">B2B Integration Config: {selectedPartner.name}</h3>
              <button onClick={() => setSelectedPartner(null)} className="text-gray-400 hover:text-gray-700 text-sm font-bold">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">API Secret Key</label>
                <input
                  type="text"
                  value={selectedPartner.apiKey}
                  onChange={e => setSelectedPartner({ ...selectedPartner, apiKey: e.target.value })}
                  className="w-full px-3 py-2 border rounded font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Webhook Endpoint URL</label>
                <input
                  type="text"
                  value={selectedPartner.webhookUrl}
                  onChange={e => setSelectedPartner({ ...selectedPartner, webhookUrl: e.target.value })}
                  className="w-full px-3 py-2 border rounded font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Commercial Revenue Terms</label>
                <input
                  type="text"
                  value={selectedPartner.revenueSplit}
                  onChange={e => setSelectedPartner({ ...selectedPartner, revenueSplit: e.target.value })}
                  className="w-full px-3 py-2 border rounded font-semibold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => setSelectedPartner(null)}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setPartners(partners.map(p => p.id === selectedPartner.id ? selectedPartner : p));
                  setSelectedPartner(null);
                }}
                className="px-6 py-2 bg-[#E21B23] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow"
              >
                Save Integration Settings
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
