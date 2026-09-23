import React from 'react';
import {
  DriverStatus,
  DriverProfile,
  TripDetails,
  DriverEarningsSummary,
  VehicleDetails,
  DrivingLicense
} from '../types';
import {
  ShieldCheck,
  MapPin,
  Clock,
  Car,
  Navigation,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Sparkles,
  PhoneCall,
  UserCheck
} from 'lucide-react';

interface DashboardScreenProps {
  status: DriverStatus;
  onStatusChange: (newStatus: DriverStatus) => void;
  profile: DriverProfile;
  license: DrivingLicense;
  vehicle: VehicleDetails;
  activeTrip: TripDetails | null;
  availableTrips: TripDetails[];
  earnings: DriverEarningsSummary;
  onAcceptTrip: (trip: TripDetails) => void;
  onStartPreTrip: (trip: TripDetails) => void;
  onContinueTrip: (trip: TripDetails) => void;
  onNavigate: (tab: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  status,
  onStatusChange,
  profile,
  license,
  vehicle,
  activeTrip,
  availableTrips,
  earnings,
  onAcceptTrip,
  onStartPreTrip,
  onContinueTrip,
  onNavigate
}) => {
  const isOnline = status === 'Online' || status === 'On-Duty' || status === 'Assigned Trip' || status === 'On Trip';

  return (
    <div className="space-y-5 sm:space-y-6 max-w-6xl mx-auto">

      {/* Top Banner & Status Card */}
      <div className="bg-white text-gray-900 rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {profile.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={profile.name}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-[#E21E26] shadow-sm shrink-0"
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#E21E26] flex items-center justify-center text-white text-xl font-bold shadow-sm shrink-0">
                {(profile.name || 'D').charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">{profile.name}</h1>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                  license.status === 'Approved'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  <ShieldCheck className="w-3 h-3" /> {license.status === 'Approved' ? 'VERIFIED DRIVER' : 'DOCS PENDING'}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">
                {vehicle.make ? `${vehicle.make} ${vehicle.model} • ` : ''}<span className="text-gray-900 font-bold">{vehicle.vehicleNumber}</span>
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-2 text-gray-600">
                <span className="flex items-center gap-1 text-amber-500 font-bold">
                  ★ {profile.rating}
                </span>
                <span className="text-gray-300">•</span>
                <span>{earnings.totalTripsCompleted} Trips</span>
                <span className="text-gray-300">•</span>
                <span className="text-emerald-600 font-semibold">{earnings.acceptanceRate}% Accept Rate</span>
              </div>
            </div>
          </div>

          {/* Large Interactive Status Toggle */}
          <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 flex flex-col gap-2 w-full md:w-auto md:min-w-[240px]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Duty Availability</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                status === 'Online' ? 'bg-emerald-100 text-emerald-700' :
                status === 'On-Duty' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-gray-200">
              {(['Offline', 'Online', 'On-Duty'] as DriverStatus[]).map((st) => {
                const isActive = status === st;
                return (
                  <button
                    key={st}
                    onClick={() => onStatusChange(st)}
                    className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                      isActive
                        ? st === 'Online'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : st === 'On-Duty'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-gray-600 text-white'
                        : 'text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Document Verification Alert (If any document pending/rejected) */}
      {(license.status !== 'Approved' || vehicle.status !== 'Approved') && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-bold">Document Verification Required</p>
              <p className="text-xs text-amber-700">
                Please upload valid Driving License, RC, Insurance, Fitness &amp; State Permit.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('registration')}
            className="px-4 py-2 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-lg transition-colors shrink-0"
          >
            Upload Docs
          </button>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] shadow-sm">
          <div className="text-xs text-gray-500 font-medium">Today's Earnings</div>
          <div className="text-2xl font-black text-[#E21E26] mt-1">₹{earnings.todayEarnings.toLocaleString('en-IN')}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Net take home
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] shadow-sm">
          <div className="text-xs text-gray-500 font-medium">This Week</div>
          <div className="text-2xl font-black text-gray-900 mt-1">₹{earnings.thisWeekEarnings.toLocaleString('en-IN')}</div>
          <div className="text-[11px] text-gray-500 mt-1">7 days total</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] shadow-sm">
          <div className="text-xs text-gray-500 font-medium">Completed Trips</div>
          <div className="text-2xl font-black text-gray-900 mt-1">{earnings.totalTripsCompleted}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">100% Completion</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] shadow-sm">
          <div className="text-xs text-gray-500 font-medium">Driver Rating</div>
          <div className="text-2xl font-black text-amber-500 mt-1 flex items-center gap-1">
            ★ {profile.rating}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Top Rated Partner</div>
        </div>
      </div>

      {/* Active / Assigned Trip Section */}
      {activeTrip && (
        <div className="bg-white rounded-2xl border-2 border-[#E21E26] shadow-lg p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-[#E21E26] text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
            {activeTrip.status}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Navigation className="w-5 h-5 text-[#E21E26] animate-bounce" />
            <h2 className="text-lg font-bold text-gray-900">Current Assigned Trip</h2>
            <span className="text-xs text-gray-500 font-mono">({activeTrip.bookingId})</span>
          </div>

          <div className="grid md:grid-cols-3 gap-6 bg-[#F7F7F7] p-4 rounded-xl border border-gray-200">
            {/* Customer Details */}
            <div>
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Customer</span>
              <p className="font-bold text-gray-900 text-sm mt-0.5">{activeTrip.customerName}</p>
              <p className="text-xs text-gray-600 flex items-center gap-1 mt-1 font-mono">
                <PhoneCall className="w-3.5 h-3.5 text-[#E21E26]" /> {activeTrip.customerPhone}
              </p>
            </div>

            {/* Route */}
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-700">Pickup</span>
                  <p className="text-xs text-gray-800 font-medium line-clamp-1">{activeTrip.pickup.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#E21E26] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-red-700">Drop</span>
                  <p className="text-xs text-gray-800 font-medium line-clamp-1">{activeTrip.drop.address}</p>
                </div>
              </div>
            </div>

            {/* Fare & CTA */}
            <div className="flex flex-col justify-between items-end border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-6">
              <div className="text-right">
                <span className="text-[11px] text-gray-500 font-medium">Net Driver Payout</span>
                <p className="text-2xl font-black text-[#E21E26]">₹{activeTrip.driverEarnings}</p>
                <span className="text-[10px] text-gray-500">Distance: {activeTrip.distanceKm} km</span>
              </div>

              {activeTrip.status === 'Assigned' || activeTrip.status === 'Pre-Trip Pending' ? (
                <button
                  onClick={() => onStartPreTrip(activeTrip)}
                  className="w-full md:w-auto px-5 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all mt-3"
                >
                  <Sparkles className="w-4 h-4" /> Start Pre-Trip Verification
                </button>
              ) : (
                <button
                  onClick={() => onContinueTrip(activeTrip)}
                  className="w-full md:w-auto px-5 py-2.5 bg-[#111111] hover:bg-[#262626] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all mt-3"
                >
                  <Navigation className="w-4 h-4 text-[#E21E26]" /> Open Trip Navigation
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Available Trips Marketplace */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Car className="w-5 h-5 text-[#E21E26]" /> Available Trips Near You
            </h2>
            <p className="text-xs text-gray-500">Pick up high-earning outstation and city rides</p>
          </div>

          <span className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
            {availableTrips.length} Trips Available
          </span>
        </div>

        {!isOnline ? (
          <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">You are currently Offline</p>
            <p className="text-xs text-gray-500 mt-1">Switch your status to Online or On-Duty to receive trip assignments.</p>
            <button
              onClick={() => onStatusChange('Online')}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow"
            >
              Go Online Now
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {availableTrips.map((trip) => (
              <div key={trip.id} className="border border-gray-200 hover:border-[#E21E26] rounded-xl p-4 transition-all hover:shadow-md bg-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-mono text-gray-500">{trip.bookingId}</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      {trip.vehicleType}
                    </span>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Pickup ({trip.pickupDistanceKm} km away)</span>
                        <p className="text-xs text-gray-800 font-semibold line-clamp-1">{trip.pickup.address}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Drop</span>
                        <p className="text-xs text-gray-800 font-semibold line-clamp-1">{trip.drop.address}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-2">
                  <div>
                    <span className="text-[10px] text-gray-500 font-medium">Est. Earnings</span>
                    <p className="text-lg font-black text-[#E21E26]">₹{trip.driverEarnings}</p>
                  </div>

                  <button
                    onClick={() => onAcceptTrip(trip)}
                    className="px-4 py-2 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-lg shadow flex items-center gap-1 transition-all"
                  >
                    Accept Trip <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
