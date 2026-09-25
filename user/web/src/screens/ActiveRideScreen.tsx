import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RideMap } from '../components/RideMap';
import { SafetyCenterModal, shareTrip } from '../components/SafetyCenterModal';
import { CancelRideDialog } from '../components/CancelRideDialog';
import { TripReceipt } from '../components/TripReceipt';
import { RatingForm } from '../components/RatingForm';
import { Avatar, ErrorNotice, Spinner, primaryBtn, secondaryBtn } from '../components/ui';
import { DriverPresence, LatLng, RouteInfo, TripRecord, UserProfile } from '../types';
import {
  cancelRide,
  isPresenceFresh,
  subscribeToBoardingOtp,
  subscribeToBooking,
  subscribeToDriverPresence,
} from '../services/rideService';
import { getRoute } from '../services/geoService';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { SEARCH_GIVE_UP_AFTER_MS, SEARCH_SLOW_AFTER_MS } from '../config/constants';
import { formatDateTime, formatDistance, formatDuration, formatINR, formatPhone, telHref, timeAgo } from '../utils/format';
import { haversineKm, isValidLatLng } from '../utils/geo';
import { describeError } from '../utils/retry';

interface ActiveRideScreenProps {
  bookingId: string;
  profile: UserProfile;
  /** The create call timed out — the request may still be in flight. */
  unconfirmed?: boolean;
  onClose: () => void;
}

const PHASE_TITLE: Record<TripRecord['phase'], string> = {
  searching: 'Finding your driver',
  partner_confirmed: 'Ride confirmed',
  driver_en_route: 'Driver on the way',
  driver_arrived: 'Your driver has arrived',
  in_trip: 'On your way',
  completed: 'Trip completed',
  cancelled: 'Ride cancelled',
};

export const ActiveRideScreen: React.FC<ActiveRideScreenProps> = ({ bookingId, profile, unconfirmed, onClose }) => {
  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [pending, setPending] = useState(!!unconfirmed);
  const [fromCache, setFromCache] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [vanished, setVanished] = useState(false);
  const [subKey, setSubKey] = useState(0);

  const [otp, setOtp] = useState<string | null>(null);
  const [presence, setPresence] = useState<DriverPresence | null>(null);
  const [eta, setEta] = useState<RouteInfo | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [now, setNow] = useState(Date.now());
  const [autoCancelError, setAutoCancelError] = useState('');
  const { online } = useNetworkStatus();
  const { position } = useDeviceLocation(true);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  // Booking document (source of truth for every phase).
  useEffect(() => {
    setLoadError('');
    return subscribeToBooking(
      bookingId,
      (s) => {
        setPending(s.pending);
        setFromCache(s.fromCache);
        if (s.trip) {
          setTrip(s.trip);
          setVanished(false);
        } else if (!s.fromCache) {
          // Gone on the server: a rejected request (seen only locally) or a
          // booking removed by an admin.
          setVanished(true);
          setTrip(null);
        }
      },
      (e) => setLoadError(describeError(e, 'We couldn’t load this ride.')),
    );
  }, [bookingId, subKey]);

  useEffect(() => subscribeToBoardingOtp(bookingId, setOtp), [bookingId]);

  // Live driver position while a driver is attached and the ride is active.
  const driverId = trip?.driver?.id ?? '';
  const tracking = !!trip && ['driver_en_route', 'driver_arrived', 'in_trip'].includes(trip.phase);
  useEffect(() => {
    if (!driverId || !tracking) {
      setPresence(null);
      return undefined;
    }
    return subscribeToDriverPresence(driverId, setPresence);
  }, [driverId, tracking]);

  const driverFresh = presence ? isPresenceFresh(presence, now) : false;
  const driverPos: LatLng | null = presence && isValidLatLng(presence) ? presence : null;

  // ETA: driver → pickup before the trip, driver → drop during it. Re-routed
  // when the driver has moved ~150 m or every 45 s, whichever comes first.
  const etaAnchor = useRef<{ at: number; from: LatLng | null; target: string }>({ at: 0, from: null, target: '' });
  useEffect(() => {
    if (!trip || !driverPos || !tracking) {
      setEta(null);
      return undefined;
    }
    const target = trip.phase === 'in_trip' ? trip.drop : trip.pickup;
    if (!isValidLatLng(target)) return undefined;
    const key = trip.phase === 'in_trip' ? 'drop' : 'pickup';
    const a = etaAnchor.current;
    const moved = a.from ? haversineKm(a.from, driverPos) : Infinity;
    if (a.target === key && moved < 0.15 && Date.now() - a.at < 45000) return undefined;
    etaAnchor.current = { at: Date.now(), from: driverPos, target: key };
    const controller = new AbortController();
    getRoute(driverPos, target, controller.signal).then(setEta).catch(() => undefined);
    return () => controller.abort();
  }, [driverPos?.lat, driverPos?.lng, trip?.phase, tracking]); // eslint-disable-line react-hooks/exhaustive-deps

  // Map framing: refit on phase change and when the driver first appears.
  const [fitKey, setFitKey] = useState<string>('init');
  const hadDriver = useRef(false);
  useEffect(() => setFitKey(`${trip?.phase}-${Date.now()}`), [trip?.phase]);
  useEffect(() => {
    if (driverPos && !hadDriver.current) {
      hadDriver.current = true;
      setFitKey(`driver-${Date.now()}`);
    }
  }, [driverPos]);

  // Searching: slow / give-up handling for instant requests.
  const searchingFor = trip?.createdAt ? now - trip.createdAt.getTime() : 0;
  const slow = trip?.phase === 'searching' && !trip.isScheduled && searchingFor > SEARCH_SLOW_AFTER_MS;
  const gaveUp = useRef(false);
  useEffect(() => {
    if (!trip || trip.phase !== 'searching' || trip.isScheduled || pending || gaveUp.current) return;
    if (searchingFor < SEARCH_GIVE_UP_AFTER_MS || !online) return;
    gaveUp.current = true;
    cancelRide(trip, profile.uid, 'No driver found').catch((e) => {
      gaveUp.current = false;
      setAutoCancelError(describeError(e, 'We couldn’t withdraw your request automatically.'));
    });
  }, [searchingFor, trip, pending, online, profile.uid]);

  // ── Render helpers ───────────────────────────────────────────────────────
  if (loadError && !trip) {
    return (
      <Centered>
        <ErrorNotice message={loadError} onRetry={() => setSubKey((k) => k + 1)} />
        <button onClick={onClose} className={`${secondaryBtn} mt-3`}>
          Back
        </button>
      </Centered>
    );
  }
  if (vanished) {
    return (
      <Centered>
        <ErrorNotice message="This ride is no longer available. If you just requested it, the request was not accepted by our servers and nothing was charged — please try again, or contact support if it keeps happening." />
        <button onClick={onClose} className={`${primaryBtn} mt-3`}>
          Back to booking
        </button>
      </Centered>
    );
  }
  if (!trip) {
    return (
      <Centered>
        <Spinner className="w-6 h-6 text-[#E31E24]" label={pending ? 'Sending your ride request…' : 'Loading your ride…'} />
      </Centered>
    );
  }

  const phase = trip.phase;
  const canCancel = ['Pending', 'Confirmed', 'Assigned'].includes(trip.status);
  const minutesAway = eta ? Math.max(1, Math.round(eta.durationMin)) : null;
  const straightKm = driverPos && isValidLatLng(trip.pickup) ? haversineKm(driverPos, trip.pickup) : null;
  const sharePoint = phase === 'in_trip' && driverPos ? driverPos : position;

  const onShare = async () => {
    const r = await shareTrip(trip, sharePoint);
    if (r === 'shared') setShareMsg('Trip shared');
    setTimeout(() => setShareMsg(''), 2500);
  };

  const mapDriver =
    driverPos && tracking
      ? { ...driverPos, heading: presence?.heading ?? null, stale: !driverFresh, label: trip.driver?.name }
      : null;
  const mapRoute = eta && !eta.estimated ? eta.path : null;

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-white">
      <SafetyCenterModal open={showSafety} onClose={() => setShowSafety(false)} trip={trip} profile={profile} location={sharePoint} />
      <CancelRideDialog trip={showCancel ? trip : null} customerId={profile.uid} onClose={() => setShowCancel(false)} />

      {/* Map */}
      {phase !== 'completed' && phase !== 'cancelled' && (
        <div className="relative md:order-2 md:flex-1 h-[40vh] md:h-auto shrink-0">
          <RideMap
            className="h-full"
            pickup={phase === 'in_trip' ? null : trip.pickup}
            drop={trip.drop}
            driver={mapDriver}
            route={mapRoute}
            userLocation={phase === 'in_trip' ? null : position}
            fitKey={fitKey}
          >
            {phase === 'searching' && (
              <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none">
                <div className="relative w-56 h-56">
                  <span className="nt-radar-ring" />
                  <span className="nt-radar-ring" />
                  <span className="nt-radar-ring" />
                </div>
              </div>
            )}
            {tracking && (
              <button
                onClick={() => setShowSafety(true)}
                className="absolute top-3 right-3 z-[600] bg-[#D92D20] text-white text-xs font-black px-4 py-2 rounded-full shadow-lg"
              >
                SOS
              </button>
            )}
          </RideMap>
        </div>
      )}

      {/* Panel */}
      <div className="md:order-1 md:w-[420px] md:shrink-0 md:border-r border-gray-200 flex-1 md:flex-none overflow-y-auto">
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-900">{PHASE_TITLE[phase]}</h2>
              <p className="text-[11px] text-gray-500">
                Booking {trip.bookingId}
                {pending && ' · sending…'}
                {!pending && fromCache && !online && ' · offline — showing last update'}
              </p>
            </div>
            <button onClick={onClose} className="text-xs font-bold text-gray-500 hover:text-gray-900 shrink-0">
              {phase === 'completed' || phase === 'cancelled' ? 'Done' : 'Minimise'}
            </button>
          </div>

          {/* Searching */}
          {phase === 'searching' && (
            <div className="space-y-3">
              {trip.isScheduled && trip.scheduledAt ? (
                <p className="text-sm text-gray-700">
                  Scheduled for <strong>{formatDateTime(trip.scheduledAt)}</strong>. We’ll assign a driver before your pickup and notify you here.
                </p>
              ) : (
                <p className="text-sm text-gray-700">
                  {pending ? 'Sending your request…' : 'Contacting drivers near your pickup. This usually takes under a minute.'}
                </p>
              )}
              {slow && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                  It’s taking longer than usual. You can keep waiting — we’ll keep looking for up to{' '}
                  {Math.round(SEARCH_GIVE_UP_AFTER_MS / 60000)} minutes — or cancel for free.
                </div>
              )}
              {autoCancelError && <ErrorNotice message={autoCancelError} />}
            </div>
          )}

          {phase === 'partner_confirmed' && (
            <p className="text-sm text-gray-700">
              {trip.assignedVendorName ? <strong>{trip.assignedVendorName}</strong> : 'Our partner'} accepted your ride and is assigning a driver.
            </p>
          )}

          {/* Driver card */}
          {trip.driver && (phase === 'driver_en_route' || phase === 'driver_arrived' || phase === 'in_trip') && (
            <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
              {phase === 'driver_en_route' && (
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Arriving in</span>
                  <span className="text-2xl font-black text-[#E31E24]">
                    {minutesAway != null ? `${minutesAway} min` : driverPos ? '…' : '—'}
                  </span>
                </div>
              )}
              {phase === 'in_trip' && (
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Reaching {trip.drop.name} in</span>
                  <span className="text-2xl font-black text-[#E31E24]">{minutesAway != null ? formatDuration(minutesAway) : '—'}</span>
                </div>
              )}
              {presence && !driverFresh && (
                <p className="text-[11px] text-amber-700">Driver location last updated {timeAgo(presence.updatedAt, now)}.</p>
              )}
              {!presence && <p className="text-[11px] text-gray-500">Live location will appear once your driver’s app shares it.</p>}

              <div className="flex items-center gap-3">
                <Avatar name={trip.driver.name} photoUrl={trip.driver.photoUrl} className="w-14 h-14 text-base" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-gray-900 truncate">{trip.driver.name}</div>
                  <div className="text-[11px] text-gray-500">
                    {trip.driver.rating != null ? `★ ${trip.driver.rating.toFixed(1)} · ` : ''}
                    {trip.driver.vehicleModel || trip.categoryName}
                  </div>
                </div>
                {trip.driver.vehicleNumber && (
                  <div className="text-right">
                    <div className="inline-block border-2 border-gray-900 rounded-md px-2 py-0.5 text-xs font-black tracking-wider text-gray-900 bg-yellow-50">
                      {trip.driver.vehicleNumber}
                    </div>
                  </div>
                )}
              </div>

              {(phase === 'driver_en_route' || phase === 'driver_arrived') && (
                <div className={`rounded-xl p-3 flex items-center justify-between ${phase === 'driver_arrived' ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50'}`}>
                  <span className="text-xs text-gray-700">
                    {phase === 'driver_arrived' ? 'Share this code to start your ride' : 'Start-of-ride code'}
                  </span>
                  <span className="text-2xl font-black tracking-[0.3em] text-gray-900" aria-label={`Ride code ${otp ?? 'unavailable'}`}>
                    {otp ?? '····'}
                  </span>
                </div>
              )}
              {phase === 'driver_arrived' && (
                <p className="text-xs text-gray-600">
                  Meet your driver at <strong>{trip.pickup.name}</strong>. Only share the code once you’re in the car.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                {trip.driver.phone ? (
                  <a href={telHref(trip.driver.phone)} className="py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold text-center">
                    Call driver
                  </a>
                ) : (
                  <span className="py-2.5 rounded-xl bg-gray-100 text-gray-400 text-xs font-bold text-center">No phone on file</span>
                )}
                <button onClick={() => void onShare()} className="py-2.5 rounded-xl bg-gray-100 text-gray-900 text-xs font-bold border border-gray-200">
                  {shareMsg || 'Share trip'}
                </button>
              </div>
              {trip.driver.phone && <p className="text-[10px] text-gray-400">Calls go to {formatPhone(trip.driver.phone)}.</p>}
            </div>
          )}

          {/* Route summary (not on completion — the receipt covers it) */}
          {phase !== 'completed' && (
            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3 text-xs space-y-2">
              <div className="flex gap-2">
                <span className="mt-1 w-2 h-2 rounded-full bg-green-600 shrink-0" />
                <span>
                  <span className="font-bold text-gray-900">{trip.pickup.name}</span>
                  <span className="block text-gray-500">{trip.pickup.address}</span>
                </span>
              </div>
              <div className="flex gap-2">
                <span className="mt-1 w-2 h-2 rounded-sm bg-[#E31E24] shrink-0" />
                <span>
                  <span className="font-bold text-gray-900">{trip.drop.name}</span>
                  <span className="block text-gray-500">{trip.drop.address}</span>
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-gray-600">
                <span>
                  {trip.categoryName} · {trip.tripType} · {trip.paymentMethod}
                </span>
                <span className="font-black text-gray-900">{formatINR(trip.fare)}</span>
              </div>
              {trip.notes && <p className="text-gray-500">Note: {trip.notes}</p>}
              {phase === 'driver_en_route' && straightKm != null && (
                <p className="text-gray-400">Driver is {formatDistance(straightKm)} from your pickup.</p>
              )}
            </div>
          )}

          {tracking && (
            <button onClick={() => setShowSafety(true)} className="w-full py-3 rounded-2xl border-2 border-red-200 bg-red-50 text-[#D92D20] text-sm font-black">
              Safety centre · SOS
            </button>
          )}

          {canCancel && (
            <button onClick={() => setShowCancel(true)} className="w-full text-center text-xs font-bold text-gray-500 hover:text-[#D92D20] py-2">
              Cancel ride
            </button>
          )}

          {/* Completed */}
          {phase === 'completed' && (
            <>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                <div className="text-3xl">✓</div>
                <p className="text-sm font-bold text-emerald-900">You’ve arrived at {trip.drop.name}</p>
                <p className="text-[11px] text-emerald-800">{formatDateTime(trip.completedAt)}</p>
              </div>
              <TripReceipt trip={trip} customerName={profile.name} />
              <RatingForm trip={trip} profile={profile} />
              <button onClick={onClose} className={secondaryBtn}>
                Done
              </button>
            </>
          )}

          {/* Cancelled */}
          {phase === 'cancelled' && (
            <>
              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 space-y-1">
                <p>
                  {trip.cancelledBy === 'customer' ? 'You cancelled this ride' : 'This ride was cancelled'}
                  {trip.cancelReason ? ` — “${trip.cancelReason}”` : ''}.
                </p>
                {trip.cancellationFee > 0 ? (
                  <p className="text-amber-800 text-xs">A cancellation fee of {formatINR(trip.cancellationFee)} applies per our policy.</p>
                ) : (
                  <p className="text-xs text-gray-500">No cancellation fee was charged.</p>
                )}
              </div>
              <button onClick={onClose} className={primaryBtn}>
                Book another ride
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 flex items-center justify-center p-6">
    <div className="w-full max-w-sm text-center">{children}</div>
  </div>
);
