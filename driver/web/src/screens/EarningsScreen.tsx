import React from 'react';
import { DriverEarningsSummary } from '../types';
import { DEFAULT_WEEKLY_EARNINGS_CHART_DATA as WEEKLY_EARNINGS_CHART_DATA } from '../config/constants';
import {
  DollarSign,
  TrendingUp,
  Award,
  BarChart2,
  Calendar,
  Percent,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface EarningsScreenProps {
  earnings: DriverEarningsSummary;
}

export const EarningsScreen: React.FC<EarningsScreenProps> = ({ earnings }) => {
  return (
    <div className="space-y-5 sm:space-y-6 max-w-5xl mx-auto">

      {/* Top Banner */}
      <div className="bg-white text-gray-900 p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#E21E26]">Financial Ledger</span>
          <h1 className="text-lg sm:text-xl font-extrabold mt-0.5">Driver Partner Earnings</h1>
          <p className="text-xs text-gray-500">Transparent trip payouts with low 10% platform commission</p>
        </div>

        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center gap-3 shrink-0">
          <Percent className="w-6 h-6 text-amber-500" />
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-bold">Commission Rate</span>
            <p className="text-sm font-black text-gray-900">{earnings.platformFeeRate}% Flat Fee</p>
          </div>
        </div>
      </div>

      {/* Earnings Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs text-gray-500 font-medium">Today's Take Home</span>
          <p className="text-2xl font-black text-[#E21E26] mt-1">₹{earnings.todayEarnings.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Live updated</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs text-gray-500 font-medium">This Week</span>
          <p className="text-2xl font-black text-gray-900 mt-1">₹{earnings.thisWeekEarnings.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-gray-500 mt-1 block">Last 7 Days</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs text-gray-500 font-medium">This Month</span>
          <p className="text-2xl font-black text-gray-900 mt-1">₹{earnings.thisMonthEarnings.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-gray-500 mt-1 block">30 Days Total</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs text-gray-500 font-medium">Lifetime Total</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">₹{earnings.lifetimeEarnings.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">{earnings.totalTripsCompleted} Completed Rides</span>
        </div>
      </div>

      {/* Weekly Earnings Chart */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-[#E21E26]" /> Weekly Payout Breakdown
          </h2>
          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            Avg ₹2,117 / Day
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={WEEKLY_EARNINGS_CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" stroke="#888888" fontSize={12} />
              <YAxis stroke="#888888" fontSize={12} />
              <Tooltip formatter={(val: any) => [`₹${val}`, 'Earnings']} />
              <Bar dataKey="gross" fill="#E21E26" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trip-wise Recent Earnings Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Trip-Wise Earnings Breakdown</h2>
          <span className="text-xs text-gray-500 font-medium">Showing recent trip credits</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-[10px] border-b">
              <tr>
                <th className="p-3">Booking ID</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Gross Fare</th>
                <th className="p-3">Platform Fee (10%)</th>
                <th className="p-3">Tolls</th>
                <th className="p-3">Net Payout</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
              <tr className="hover:bg-gray-50">
                <td className="p-3 font-mono font-bold">NESAM-BK-4082</td>
                <td className="p-3">Senthil Nathan</td>
                <td className="p-3">₹780</td>
                <td className="p-3 text-red-600">- ₹78</td>
                <td className="p-3 text-emerald-600">+ ₹50</td>
                <td className="p-3 font-extrabold text-[#E21E26]">₹752</td>
                <td className="p-3"><span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">Credited</span></td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-3 font-mono font-bold">NESAM-BK-4050</td>
                <td className="p-3">Ramesh Kumar</td>
                <td className="p-3">₹850</td>
                <td className="p-3 text-red-600">- ₹85</td>
                <td className="p-3 text-emerald-600">+ ₹60</td>
                <td className="p-3 font-extrabold text-[#E21E26]">₹825</td>
                <td className="p-3"><span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">Credited</span></td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-3 font-mono font-bold">NESAM-BK-3991</td>
                <td className="p-3">Deepa Krishnan</td>
                <td className="p-3">₹1,450</td>
                <td className="p-3 text-red-600">- ₹145</td>
                <td className="p-3 text-emerald-600">+ ₹0</td>
                <td className="p-3 font-extrabold text-[#E21E26]">₹1,305</td>
                <td className="p-3"><span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">Credited</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
