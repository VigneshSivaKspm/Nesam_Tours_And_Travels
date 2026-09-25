import React, { useState } from 'react';
import { TripRecord, UserProfile } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { CancelRideDialog } from '../components/CancelRideDialog';
import { ErrorNotice } from '../components/ui';
import { isActiveStatus } from '../services/rideService';
import { formatINR } from '../utils/format';

interface TripsHistoryScreenProps {
  profile: UserProfile;
  trips: TripRecord[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onOpenTrip: (trip: TripRecord) => void;
}

type Filter = 'All' | 'Upcoming' | 'Completed' | 'Cancelled';

const PHASE_LABEL: Record<TripRecord['phase'], string> = {
  searching: 'Finding driver',
  partner_confirmed: 'Confirmed',
  driver_en_route: 'Driver on the way',
  driver_arrived: 'Driver arrived',
  in_trip: 'On trip',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const TripsHistoryScreen: React.FC<TripsHistoryScreenProps> = ({ profile, trips, loading, error, onRetry, onOpenTrip }) => {
  const [filter, setFilter] = useState<Filter>('All');
  const [cancelTrip, setCancelTrip] = useState<TripRecord | null>(null);

  const filtered = trips.filter((t) =>
    filter === 'All'
      ? true
      : filter === 'Upcoming'
        ? ['Pending', 'Confirmed', 'Assigned', 'Ongoing', 'In Progress'].includes(t.status)
        : filter === 'Completed'
          ? t.status === 'Completed'
          : t.status === 'Cancelled',
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
      <CancelRideDialog trip={cancelTrip} customerId={profile.uid} onClose={() => setCancelTrip(null)} />

      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">My trips</h2>
          <p className="text-xs text-gray-500">Track active rides, view receipts and rate past trips</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl" role="tablist">
          {(['All', 'Upcoming', 'Completed', 'Cancelled'] as Filter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === f ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorNotice message={error} onRetry={onRetry} />}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-gray-200 text-center">
          <p className="text-sm font-bold text-gray-700">No {filter === 'All' ? '' : filter.toLowerCase() + ' '}trips yet</p>
          <p className="text-xs text-gray-400 mt-1">Your rides will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((t) => {
            const needsRating = t.status === 'Completed' && t.rating == null;
            return (
              <div key={t.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-[11px] text-gray-400 font-semibold">{t.bookingId}</div>
                    <div className="text-xs font-bold text-gray-900">
                      {t.date}
                      {t.time && t.time !== 'Now' ? ` · ${t.time}` : ''}
                    </div>
                  </div>
                  <StatusBadge status={PHASE_LABEL[t.phase]} tone={t.phase} />
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-green-600 shrink-0" />
                    <span className="font-semibold text-gray-900 truncate">{t.pickup.name}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-sm bg-[#E31E24] shrink-0" />
                    <span className="font-semibold text-gray-900 truncate">{t.drop.name}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-xl text-xs">
                  <span className="text-gray-600 truncate">
                    {t.categoryName}
                    {t.driver ? ` · ${t.driver.name}` : ''}
                  </span>
                  <span className="font-black text-gray-900">{formatINR(t.fare + t.tollCharges)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onOpenTrip(t)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-black"
                  >
                    {isActiveStatus(t.status) ? 'Track ride' : needsRating ? 'Receipt & rate' : 'View details'}
                  </button>
                  {['Pending', 'Confirmed'].includes(t.status) && (
                    <button
                      onClick={() => setCancelTrip(t)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-red-50 text-[#D92D20] border border-red-200"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
