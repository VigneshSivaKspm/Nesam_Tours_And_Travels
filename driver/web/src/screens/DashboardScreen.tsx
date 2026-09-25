import React, { useMemo, useState } from 'react';
import type { DriverAccount, DriverEarningsSummary, DriverStatus, MarketplaceOffer, TripDetails } from '../types';
import {
  ShieldCheck,
  MapPin,
  Car,
  Navigation,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Sparkles,
  PhoneCall,
  Loader2,
  Calendar,
  Clock,
} from 'lucide-react';

interface DashboardScreenProps {
  status: DriverStatus;
  presenceBusy: boolean;
  onStatusChange: (next: DriverStatus) => void;
  account: DriverAccount;
  activeTrip: TripDetails | null;
  offers: MarketplaceOffer[];
  earnings: DriverEarningsSummary;
  acceptingId: string | null;
  onAcceptTrip: (offer: MarketplaceOffer) => void;
  onStartPreTrip: () => void;
  onOpenTrip: () => void;
  onNavigate: (tab: string) => void;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Trip categories are admin-defined names ("Sedan (AC)", "Innova Crysta"),
 * so match loosely on the driver's vehicle type. A plain SUV must not match
 * "Premium SUV" trips.
 */
function categoryMatches(tripCategory: string, driverType: string): boolean {
  const cat = normalise(tripCategory);
  const mine = normalise(driverType);
  if (!cat) return true;
  if (cat.includes('premium') !== mine.includes('premium')) return false;
  return cat.includes(mine) || mine.includes(cat);
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  status,
  presenceBusy,
  onStatusChange,
  account,
  activeTrip,
  offers,
  earnings,
  acceptingId,
  onAcceptTrip,
  onStartPreTrip,
  onOpenTrip,
  onNavigate,
}) => {
  const { driver, vehicle } = account;
  const isOnline = status === 'Online' || status === 'On Trip';
  const [showAll, setShowAll] = useState(false);

  // Only offers for the driver's own vehicle category, unless they opt to see all.
  const matching = useMemo(
    () => offers.filter((o) => categoryMatches(o.vehicleCategory, vehicle.vehicleType)),
    [offers, vehicle.vehicleType],
  );
  const visibleOffers = showAll ? offers : matching;

  return (
    <div className="space-y-5 sm:space-y-6 max-w-6xl mx-auto">
      {/* Profile & duty status */}
      <div className="bg-white text-gray-900 rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {driver.photoUrl ? (
              <img src={driver.photoUrl} alt={driver.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-[#E21E26] shadow-sm shrink-0" />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#E21E26] flex items-center justify-center text-white text-xl font-bold shadow-sm shrink-0">
                {(driver.name || 'D').charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">{driver.name}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border bg-emerald-50 text-emerald-700 border-emerald-200">
                  <ShieldCheck className="w-3 h-3" /> VERIFIED DRIVER
                </span>
              </div>
              <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">
                {vehicle.make} {vehicle.model} • <span className="text-gray-900 font-bold">{vehicle.vehicleNumber}</span> • {vehicle.vehicleType}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-2 text-gray-600">
                <span className="text-amber-500 font-bold">★ {driver.rating.toFixed(1)}</span>
                <span className="text-gray-300">•</span>
                <span>{earnings.totalTripsCompleted} Trips</span>
                {driver.vendorName && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span>{driver.vendorName}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 flex flex-col gap-2 w-full md:w-auto md:min-w-[240px]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Duty Status</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                status === 'Online' ? 'bg-emerald-100 text-emerald-700' : status === 'On Trip' ? 'bg-red-100 text-[#E21E26]' : 'bg-gray-200 text-gray-600'
              }`}>
                {status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-gray-200">
              {(['Offline', 'Online'] as DriverStatus[]).map((st) => {
                const active = status === st || (st === 'Online' && status === 'On Trip');
                return (
                  <button
                    key={st}
                    disabled={presenceBusy || active}
                    onClick={() => onStatusChange(st)}
                    className={`py-2 rounded-lg text-xs font-bold transition-colors disabled:cursor-default ${
                      active ? (st === 'Online' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-600 text-white') : 'text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    {st === 'Online' ? 'Go Online' : 'Go Offline'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {driver.docStatus === 'Rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-bold">Document update required</p>
              <p className="text-xs">{driver.rejectionReason || 'Some of your updated documents were not accepted. Please upload them again.'}</p>
            </div>
          </div>
          <button onClick={() => onNavigate('profile')} className="px-4 py-2 bg-[#E21E26] text-white text-xs font-bold rounded-lg shrink-0">
            View Documents
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs text-gray-500 font-medium">Today's Earnings</div>
          <div className="text-2xl font-black text-[#E21E26] mt-1">{inr(earnings.todayEarnings)}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Incl. tolls</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs text-gray-500 font-medium">Last 7 Days</div>
          <div className="text-2xl font-black text-gray-900 mt-1">{inr(earnings.thisWeekEarnings)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs text-gray-500 font-medium">Completed Trips</div>
          <div className="text-2xl font-black text-gray-900 mt-1">{earnings.totalTripsCompleted}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs text-gray-500 font-medium">Rating</div>
          <div className="text-2xl font-black text-amber-500 mt-1">★ {driver.rating.toFixed(1)}</div>
        </div>
      </div>

      {/* Active trip */}
      {activeTrip && (
        <div className="bg-white rounded-2xl border-2 border-[#E21E26] shadow-lg p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-[#E21E26] text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
            {activeTrip.stage}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Navigation className="w-5 h-5 text-[#E21E26]" />
            <h2 className="text-lg font-bold text-gray-900">Current Trip</h2>
            <span className="text-xs text-gray-500 font-mono">({activeTrip.bookingId})</span>
          </div>

          <div className="grid md:grid-cols-3 gap-5 bg-[#F7F7F7] p-4 rounded-xl border border-gray-200">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Customer</span>
              <p className="font-bold text-gray-900 text-sm mt-0.5">{activeTrip.customerName}</p>
              {activeTrip.customerPhone && (
                <a href={`tel:${activeTrip.customerPhone}`} className="text-xs text-gray-600 flex items-center gap-1 mt-1 font-mono hover:text-[#E21E26]">
                  <PhoneCall className="w-3.5 h-3.5 text-[#E21E26]" /> {activeTrip.customerPhone}
                </a>
              )}
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {activeTrip.scheduledDate} {activeTrip.scheduledTime}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-700">Pickup</span>
                  <p className="text-xs text-gray-800 font-medium">{activeTrip.pickup.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#E21E26] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-red-700">Drop</span>
                  <p className="text-xs text-gray-800 font-medium">{activeTrip.drop.address}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-between items-stretch md:items-end border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-5">
              <div className="md:text-right">
                <span className="text-[11px] text-gray-500 font-medium">Your Payout</span>
                <p className="text-2xl font-black text-[#E21E26]">{inr(activeTrip.driverEarnings)}</p>
                {activeTrip.distanceKm > 0 && <span className="text-[10px] text-gray-500">{activeTrip.distanceKm} km • {activeTrip.paymentMode}</span>}
              </div>
              {activeTrip.stage === 'Assigned' ? (
                <button onClick={onStartPreTrip} className="px-5 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 mt-3">
                  <Sparkles className="w-4 h-4" /> Start Pre-Trip Check
                </button>
              ) : (
                <button onClick={onOpenTrip} className="px-5 py-2.5 bg-[#111111] hover:bg-[#262626] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 mt-3">
                  <Navigation className="w-4 h-4 text-[#E21E26]" /> Open Trip
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Marketplace */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Car className="w-5 h-5 text-[#E21E26]" /> Available Trips
            </h2>
            <p className="text-xs text-gray-500">
              {showAll ? 'All open trips' : `Trips for ${vehicle.vehicleType} vehicles`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAll((v) => !v)} className="text-[11px] font-bold text-[#E21E26] hover:underline">
              {showAll ? 'Only my category' : `Show all (${offers.length})`}
            </button>
            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">{visibleOffers.length} open</span>
          </div>
        </div>

        {!isOnline ? (
          <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">You are Offline</p>
            <p className="text-xs text-gray-500 mt-1">Go online to see and accept trips.</p>
            <button onClick={() => onStatusChange('Online')} disabled={presenceBusy} className="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow disabled:opacity-60">
              Go Online Now
            </button>
          </div>
        ) : activeTrip ? (
          <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500">
            Finish your current trip to accept a new one.
          </div>
        ) : visibleOffers.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">No open trips right now</p>
            <p className="text-xs text-gray-500 mt-1">New bookings appear here instantly — stay online.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {visibleOffers.map((offer) => {
              const mismatch = !categoryMatches(offer.vehicleCategory, vehicle.vehicleType);
              return (
                <div key={offer.id} className="border border-gray-200 hover:border-[#E21E26] rounded-xl p-4 transition-all hover:shadow-md bg-white flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2 gap-2">
                      <span className="font-mono text-gray-500 truncate">{offer.bookingId}</span>
                      <span className={`font-bold px-2 py-0.5 rounded border shrink-0 ${mismatch ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
                        {offer.vehicleCategory || 'Any vehicle'}
                      </span>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">Pickup</span>
                          <p className="text-xs text-gray-800 font-semibold">{offer.pickup.address}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">Drop</span>
                          <p className="text-xs text-gray-800 font-semibold">{offer.drop.address}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {offer.travelDate || 'Date TBC'} {offer.pickupTime && `• ${offer.pickupTime}`}
                      {offer.distanceKm > 0 && ` • ${offer.distanceKm} km`}
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-3">
                    <div>
                      <span className="text-[10px] text-gray-500 font-medium">Your Payout</span>
                      <p className="text-lg font-black text-[#E21E26]">{inr(offer.offeredPayout)}</p>
                    </div>
                    <button
                      onClick={() => onAcceptTrip(offer)}
                      disabled={acceptingId !== null}
                      title={mismatch ? `Booked as ${offer.vehicleCategory} — accept only if your vehicle qualifies` : undefined}
                      className="px-4 py-2 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-lg shadow flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {acceptingId === offer.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {acceptingId === offer.id ? 'Accepting...' : 'Accept Trip'}
                      {acceptingId !== offer.id && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
