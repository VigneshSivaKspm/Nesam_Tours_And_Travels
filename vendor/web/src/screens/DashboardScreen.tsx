import React from 'react';
import {
  VendorProfile,
  FleetVehicle,
  FleetDriver,
  OpenTrip,
  VendorTrip,
  WalletDetails
} from '../types';
import {
  Car,
  Users,
  Gavel,
  ShieldCheck,
  TrendingUp,
  Wallet,
  ArrowRight,
  Navigation,
  CheckCircle,
  Building2,
  PhoneCall
} from 'lucide-react';

interface DashboardScreenProps {
  profile: VendorProfile;
  vehicles: FleetVehicle[];
  drivers: FleetDriver[];
  openTrips: OpenTrip[];
  activeTrips: VendorTrip[];
  wallet: WalletDetails;
  onNavigate: (tab: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  profile,
  vehicles,
  drivers,
  openTrips,
  activeTrips,
  wallet,
  onNavigate
}) => {
  const activeVehicles = vehicles.filter(v => v.status === 'Active' || v.status === 'On Trip').length;
  const availableDrivers = drivers.filter(d => d.status === 'Available').length;

  return (
    <div className="space-y-6 pb-20">

      {/* Corporate Fleet Hero Banner */}
      <div className="bg-[#111111] text-white rounded-2xl p-6 border border-[#262626] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#E21E26] flex items-center justify-center text-white font-black text-2xl shadow-lg">
              {profile.companyName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight">{profile.companyName}</h1>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> VERIFIED FLEET VENDOR
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                GSTIN: <span className="font-mono text-white">{profile.gstin}</span> • City: <span className="text-white font-bold">{profile.city}</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                Contact: {profile.contactPerson} ({profile.phone})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-[#1A1A1A] p-4 rounded-2xl border border-[#333] shrink-0">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Fleet Revenue</span>
              <p className="text-2xl font-black text-[#E21E26]">₹{wallet.lifetimeEarnings.toLocaleString('en-IN')}</p>
              <span className="text-[10px] text-emerald-400 font-semibold">10% Platform Commission</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:border-[#E21E26]" onClick={() => onNavigate('fleet')}>
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Total Fleet Vehicles</span>
            <Car className="w-4 h-4 text-[#E21E26]" />
          </div>
          <div className="text-2xl font-black text-gray-900 mt-1">{vehicles.length}</div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">{activeVehicles} Active Vehicles</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:border-[#E21E26]" onClick={() => onNavigate('drivers')}>
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Fleet Drivers</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-gray-900 mt-1">{drivers.length}</div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">{availableDrivers} Drivers Ready for Ride</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:border-[#E21E26]" onClick={() => onNavigate('marketplace')}>
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Open Trip Feed</span>
            <Gavel className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1">{openTrips.length}</div>
          <span className="text-[11px] text-gray-500 mt-1 block">Live Bidding Engine</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:border-[#E21E26]" onClick={() => onNavigate('wallet')}>
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Wallet Balance</span>
            <Wallet className="w-4 h-4 text-[#E21E26]" />
          </div>
          <div className="text-2xl font-black text-[#E21E26] mt-1">₹{wallet.availableBalance.toLocaleString('en-IN')}</div>
          <span className="text-[11px] text-gray-500 mt-1 block">Instant UPI / Bank Payouts</span>
        </div>

      </div>

      {/* Main Two-Column Layout */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left Column: Active Fleet Vehicles Preview & Dispatch Status */}
        <div className="lg:col-span-2 space-y-6">

          {/* Active Trips Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-[#E21E26]" /> Active Dispatched Fleet Trips
              </h2>
              <button onClick={() => onNavigate('trips')} className="text-xs font-bold text-[#E21E26] hover:underline">
                View All Trips →
              </button>
            </div>

            {activeTrips.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 italic text-center">No active trips currently in transit.</p>
            ) : (
              <div className="space-y-3">
                {activeTrips.map(t => (
                  <div key={t.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-900">{t.bookingId}</span>
                        <span className="text-[10px] bg-red-100 text-[#E21E26] font-bold px-2 py-0.5 rounded">
                          {t.status}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-gray-800 mt-1">{t.customerName} • {t.scheduledTime}</p>
                      <p className="text-xs text-gray-600 mt-0.5">Route: {t.pickupAddress} ➔ {t.dropAddress}</p>
                      <p className="text-[11px] text-gray-500 font-mono mt-1">
                        Assigned Driver: <span className="font-bold text-gray-900">{t.driverName}</span> ({t.vehicleNumber})
                      </p>
                    </div>

                    <div className="text-right border-t md:border-t-0 pt-2 md:pt-0 border-gray-200">
                      <span className="text-[10px] text-gray-500">Vendor Net Earnings</span>
                      <p className="text-lg font-black text-[#E21E26]">₹{t.vendorPayout}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vehicle Fleet Status Table Preview */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Car className="w-4 h-4 text-[#E21E26]" /> Registered Fleet Vehicles
              </h2>
              <button onClick={() => onNavigate('fleet')} className="text-xs font-bold text-[#E21E26] hover:underline">
                Manage Fleet →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-[10px] border-b">
                  <tr>
                    <th className="p-3">Vehicle Number</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Make / Model</th>
                    <th className="p-3">Assigned Driver</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vehicles.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="p-3 font-mono font-bold text-gray-900">{v.vehicleNumber}</td>
                      <td className="p-3 font-semibold text-gray-700">{v.category}</td>
                      <td className="p-3 text-gray-600">{v.make} {v.model} ({v.year})</td>
                      <td className="p-3 font-medium text-gray-900">{v.assignedDriverName || 'Unassigned'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          v.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                          v.status === 'On Trip' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-emerald-600 text-[11px] font-bold">✓ Approved</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column: Marketplace Trips & Bidding Feed */}
        <div className="space-y-6">

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Gavel className="w-4 h-4 text-[#E21E26]" /> Open Trips Marketplace
                </h2>
                <p className="text-[11px] text-gray-500">Accept rate or place counter bids</p>
              </div>

              <button
                onClick={() => onNavigate('marketplace')}
                className="px-3 py-1.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-lg shadow transition-all"
              >
                Go to Bids
              </button>
            </div>

            <div className="space-y-3">
              {openTrips.map(trip => (
                <div key={trip.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50 hover:border-[#E21E26] transition-all space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-gray-500">{trip.bookingId}</span>
                    <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {trip.vehicleCategory}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-gray-900 line-clamp-1">{trip.route}</p>
                  <p className="text-[11px] text-gray-600">Date: {trip.travelDate} ({trip.distanceKm} km)</p>

                  <div className="flex items-center justify-between border-t border-gray-200 pt-2 mt-1">
                    <div>
                      <span className="text-[10px] text-gray-500">Offered Payout</span>
                      <p className="text-base font-black text-[#E21E26]">₹{trip.offeredPayout}</p>
                    </div>

                    <button
                      onClick={() => onNavigate('marketplace')}
                      className="px-3 py-1 bg-[#111] hover:bg-[#262626] text-white text-[11px] font-bold rounded"
                    >
                      Bid / Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
