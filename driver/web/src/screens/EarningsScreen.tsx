import React, { useMemo } from 'react';
import type { DriverEarningsSummary, LedgerEntry, TripDetails } from '../types';
import { BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { isEarning, tripEarningStatus } from '../services/driverEarnings';

interface EarningsScreenProps {
  earnings: DriverEarningsSummary;
  completedTrips: TripDetails[];
  ledger: LedgerEntry[];
  /** Fleet drivers are paid by their vendor, not by NESAM. */
  fleetDriver: boolean;
  fleetName?: string;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting payment',
  available: 'In wallet',
  cancelled: 'Reversed',
};

export const EarningsScreen: React.FC<EarningsScreenProps> = ({ earnings, completedTrips, ledger, fleetDriver, fleetName }) => {
  // Credited earnings for the last 7 days, oldest first.
  const chartData = useMemo(() => {
    const days: { day: string; key: string; earnings: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({ day: d.toLocaleDateString('en-IN', { weekday: 'short' }), key: d.toDateString(), earnings: 0 });
    }
    for (const e of ledger) {
      if (!isEarning(e) || !e.createdAt) continue;
      const slot = days.find((d) => d.key === e.createdAt!.toDateString());
      if (slot) slot.earnings += e.amount;
    }
    return days;
  }, [ledger]);

  const weekAvg = Math.round(chartData.reduce((s, d) => s + d.earnings, 0) / 7);

  if (fleetDriver) {
    return (
      <div className="space-y-5 sm:space-y-6 max-w-5xl mx-auto">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#E21E26]">Earnings</span>
          <h1 className="text-lg sm:text-xl font-extrabold mt-0.5">Paid by your fleet</h1>
          <p className="text-xs text-gray-500">
            {fleetName || 'Your fleet operator'} receives the payout for trips you drive for them and settles your pay directly. NESAM does not hold a wallet balance for you.
          </p>
        </div>
        <CompletedTrips trips={completedTrips} ledger={ledger} fleetDriver />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 max-w-5xl mx-auto">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
        <span className="text-[10px] uppercase font-bold tracking-widest text-[#E21E26]">Earnings</span>
        <h1 className="text-lg sm:text-xl font-extrabold mt-0.5">Your Trip Earnings</h1>
        <p className="text-xs text-gray-500">
          The payout for a trip is shown before you accept it. It is credited once NESAM verifies the trip fare; approved toll receipts are reimbursed in full.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Today', value: earnings.todayEarnings, cls: 'text-[#E21E26]' },
          { label: 'Last 7 Days', value: earnings.thisWeekEarnings, cls: 'text-gray-900' },
          { label: 'This Month', value: earnings.thisMonthEarnings, cls: 'text-gray-900' },
          { label: 'Lifetime', value: earnings.lifetimeEarnings, cls: 'text-emerald-600' },
        ].map((c) => (
          <div key={c.label} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs text-gray-500 font-medium">{c.label}</span>
            <p className={`text-2xl font-black mt-1 ${c.cls}`}>{inr(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-[#E21E26]" /> Last 7 Days
          </h2>
          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Avg {inr(weekAvg)} / day</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day" stroke="#888888" fontSize={12} />
              <YAxis stroke="#888888" fontSize={12} />
              <Tooltip formatter={(val: number) => [inr(val), 'Earnings']} />
              <Bar dataKey="earnings" fill="#E21E26" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <CompletedTrips trips={completedTrips} ledger={ledger} fleetDriver={false} />
    </div>
  );
};

function CompletedTrips({ trips, ledger, fleetDriver }: { trips: TripDetails[]; ledger: LedgerEntry[]; fleetDriver: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">Completed Trips</h2>
        <span className="text-xs text-gray-500 font-medium">{trips.length} trips</span>
      </div>
      {trips.length === 0 ? (
        <p className="p-8 text-center text-xs text-gray-400">No completed trips yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-[10px] border-b">
              <tr>
                <th className="p-3">Booking</th>
                <th className="p-3">Date</th>
                <th className="p-3">Route</th>
                {!fleetDriver && <th className="p-3">Payout</th>}
                <th className="p-3">Tolls</th>
                {!fleetDriver && <th className="p-3">Status</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
              {trips.map((t) => {
                const status = tripEarningStatus(ledger, t.id);
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold">{t.bookingId}</td>
                    <td className="p-3 whitespace-nowrap">{t.completedAt?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) ?? (t.scheduledDate || '—')}</td>
                    <td className="p-3 max-w-[240px] truncate">{t.pickup.address || '—'} → {t.drop.address || '—'}</td>
                    {!fleetDriver && <td className="p-3">{t.driverEarnings !== null ? inr(t.driverEarnings) : '—'}</td>}
                    <td className="p-3">
                      {t.tollCharges > 0 ? `${inr(t.tollCharges)}${t.tollsApproved ? '' : ' (awaiting approval)'}` : '—'}
                    </td>
                    {!fleetDriver && (
                      <td className="p-3 font-semibold">
                        {status ? STATUS_LABEL[status] || status : <span className="text-amber-700">Not credited yet</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
