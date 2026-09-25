import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RideMap } from '../components/RideMap';
import { PlaceSearch } from '../components/PlaceSearch';
import { FareLines } from '../components/FareLines';
import { ErrorNotice, Spinner, primaryBtn } from '../components/ui';
import {
  AppliedCoupon,
  Coupon,
  DriverPresence,
  FareBreakdown,
  GeoPlace,
  LatLng,
  LocationItem,
  PaymentMethod,
  RideCategory,
  RouteInfo,
  TripRecord,
  TripType,
  UserProfile,
} from '../types';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getRoute, reverseGeocode, LOCATION_ERROR_TEXT } from '../services/geoService';
import {
  calculateFare,
  categoryServesVehicle,
  isOutstation,
  serviceName,
  subscribeToCoupons,
  subscribeToRideCategories,
  validateCoupon,
} from '../services/pricingService';
import { createRideRequest, nearbyDrivers, subscribeToOnlineDrivers } from '../services/rideService';
import { savePlace, subscribeToSavedPlaces } from '../services/userFirestoreService';
import {
  AVG_CITY_SPEED_KMPH,
  NEARBY_RADIUS_KM,
  SCHEDULE_MAX_DAYS,
  SCHEDULE_MIN_LEAD_MIN,
} from '../config/constants';
import { formatDistance, formatDuration, formatINR } from '../utils/format';
import { haversineKm, isValidLatLng, ROAD_FACTOR } from '../utils/geo';
import { describeError } from '../utils/retry';

interface RideBookingScreenProps {
  profile: UserProfile;
  trips: TripRecord[];
  hasLiveRide: boolean;
  onRideRequested: (bookingId: string, unconfirmed: boolean) => void;
  onOpenSavedPlaces: () => void;
}

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: 'Cash', label: 'Cash', hint: 'Pay the driver at drop' },
  { id: 'UPI', label: 'UPI', hint: 'GPay / PhonePe / Paytm at drop' },
  { id: 'Wallet', label: 'NESAM Wallet', hint: '' },
  { id: 'Card', label: 'Card', hint: 'Coming soon' },
];

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const RideBookingScreen: React.FC<RideBookingScreenProps> = ({
  profile,
  trips,
  hasLiveRide,
  onRideRequested,
  onOpenSavedPlaces,
}) => {
  const { position, error: locError, permission, locating, locate } = useDeviceLocation(true);
  const { online } = useNetworkStatus();

  const [pickup, setPickup] = useState<GeoPlace | null>(null);
  const [drop, setDrop] = useState<GeoPlace | null>(null);
  const [adjustingPickup, setAdjustingPickup] = useState(false);
  const [resolvingPin, setResolvingPin] = useState(false);
  const [panTo, setPanTo] = useState<{ point: LatLng; key: number; zoom?: number } | null>(null);

  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const [categories, setCategories] = useState<RideCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [onlineDrivers, setOnlineDrivers] = useState<DriverPresence[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<LocationItem[]>([]);

  const [tripType, setTripType] = useState<TripType>('One Way');
  const [timing, setTiming] = useState<'now' | 'schedule'>('now');
  const [scheduleValue, setScheduleValue] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('Cash');
  const [promoInput, setPromoInput] = useState('');
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [notes, setNotes] = useState('');
  const [showExtras, setShowExtras] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [savedDropMsg, setSavedDropMsg] = useState('');
  const [now, setNow] = useState(() => Date.now());

  // Live data.
  useEffect(
    () =>
      subscribeToRideCategories((cats) => {
        setCategories(cats);
        setCategoryId((cur) => (cats.some((c) => c.id === cur) ? cur : cats[Math.min(1, cats.length - 1)]?.id ?? ''));
      }),
    [],
  );
  useEffect(() => subscribeToOnlineDrivers(setOnlineDrivers), []);
  useEffect(() => subscribeToCoupons(setCoupons), []);
  useEffect(() => subscribeToSavedPlaces(profile.uid, setSavedPlaces), [profile.uid]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // First GPS fix becomes the pickup (unless the rider already chose one).
  const pickupFromGps = useRef(false);
  useEffect(() => {
    if (!position || pickupFromGps.current || pickup) return;
    pickupFromGps.current = true;
    setPanTo({ point: position, key: Date.now(), zoom: 17 });
    // Not aborted on the next GPS tick — this lookup runs exactly once, and
    // reverseGeocode never rejects without a signal. `cur ??` keeps any
    // pickup the rider picked meanwhile.
    void reverseGeocode(position).then((p) => {
      if (mountedRef.current) setPickup((cur) => cur ?? { ...p, type: 'current' });
    });
  }, [position]); // eslint-disable-line react-hooks/exhaustive-deps

  // Centre-pin: reverse-geocode wherever the rider drops the pin.
  const pinMode = !drop || adjustingPickup;
  const pinAbort = useRef<AbortController | null>(null);
  const pinTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onCenterChange = useCallback(
    (c: LatLng) => {
      if (pickup && haversineKm(c, pickup) < 0.015) return; // our own pan
      clearTimeout(pinTimer.current);
      pinAbort.current?.abort();
      setResolvingPin(true);
      pinTimer.current = setTimeout(() => {
        const controller = new AbortController();
        pinAbort.current = controller;
        reverseGeocode(c, controller.signal)
          .then((p) => {
            setPickup(p);
            pickupFromGps.current = true;
          })
          .catch(() => undefined)
          .finally(() => !controller.signal.aborted && setResolvingPin(false));
      }, 450);
    },
    [pickup],
  );
  useEffect(() => () => {
    clearTimeout(pinTimer.current);
    pinAbort.current?.abort();
  }, []);

  // Route whenever both ends are known.
  useEffect(() => {
    setRoute(null);
    if (!pickup || !drop) return undefined;
    const controller = new AbortController();
    setRouteLoading(true);
    getRoute(pickup, drop, controller.signal)
      .then(setRoute)
      .catch(() => undefined)
      .finally(() => !controller.signal.aborted && setRouteLoading(false));
    return () => controller.abort();
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const [fitKey, setFitKey] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (route && !adjustingPickup) setFitKey(`${route.distanceKm}-${Date.now()}`);
  }, [route, adjustingPickup]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const category = categories.find((c) => c.id === categoryId) ?? null;
  const scheduledAt = useMemo(() => {
    if (timing !== 'schedule' || !scheduleValue) return null;
    const d = new Date(scheduleValue);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [timing, scheduleValue]);
  const scheduleError = useMemo(() => {
    if (timing !== 'schedule') return '';
    if (!scheduledAt) return 'Choose a pickup date and time.';
    const lead = (scheduledAt.getTime() - now) / 60000;
    if (lead < SCHEDULE_MIN_LEAD_MIN) return `Scheduled rides need at least ${SCHEDULE_MIN_LEAD_MIN} minutes’ notice.`;
    if (lead > SCHEDULE_MAX_DAYS * 1440) return `You can schedule up to ${SCHEDULE_MAX_DAYS} days ahead.`;
    return '';
  }, [timing, scheduledAt, now]);
  const pickupTime = scheduledAt ?? new Date(now);

  const quotes = useMemo(() => {
    const m = new Map<string, FareBreakdown>();
    if (!route) return m;
    for (const c of categories) {
      m.set(c.id, calculateFare({ category: c, route, tripType, pickupTime, discount: c.id === categoryId ? coupon?.discount ?? 0 : 0 }));
    }
    return m;
  }, [route, categories, tripType, pickupTime.getTime(), categoryId, coupon?.discount]); // eslint-disable-line react-hooks/exhaustive-deps

  const nearby = useMemo(
    () => (pickup ? nearbyDrivers(onlineDrivers, pickup, NEARBY_RADIUS_KM, now) : []),
    [onlineDrivers, pickup?.lat, pickup?.lng, now], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const etaFor = (c: RideCategory): number | null => {
    const d = nearby.find((n) => categoryServesVehicle(c, n.vehicleCategory));
    return d ? Math.max(2, Math.round(((d.distanceKm * ROAD_FACTOR) / AVG_CITY_SPEED_KMPH) * 60 + 1)) : null;
  };

  const history = trips.filter((t) => t.status !== 'Cancelled');
  const isFirstBooking = history.length === 0;
  const recentPlaces = useMemo(() => {
    const seen = new Set<string>();
    const out: GeoPlace[] = [];
    for (const t of trips) {
      for (const p of [t.drop, t.pickup]) {
        if (!isValidLatLng(p) || seen.has(p.name)) continue;
        seen.add(p.name);
        out.push({ ...p, id: `recent-${t.id}-${p.id}`, type: 'recent' });
      }
    }
    return out.slice(0, 6);
  }, [trips]);

  // Re-validate the coupon whenever the fare it was applied to changes.
  useEffect(() => {
    if (!coupon || !route || !category) return;
    const base = calculateFare({ category, route, tripType, pickupTime });
    const res = validateCoupon(coupons, coupon.code, {
      subtotal: base.subtotal,
      categoryId: category.id,
      service: pickup && drop ? serviceName(pickup, drop, route.distanceKm) : 'Local',
      isFirstBooking,
      customerUses: history.filter((t) => t.couponCode === coupon.code).length,
    });
    if (!res.ok) {
      setCoupon(null);
      setPromoMsg({ ok: false, text: `Promo removed: ${res.message}` });
    } else if (res.coupon.discount !== coupon.discount) {
      setCoupon(res.coupon);
      setPromoMsg({ ok: true, text: res.coupon.message });
    }
  }, [categoryId, route, tripType, coupons]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPromo = () => {
    if (!route || !category || !pickup || !drop) {
      setPromoMsg({ ok: false, text: 'Set your pickup and destination first.' });
      return;
    }
    const base = calculateFare({ category, route, tripType, pickupTime });
    const res = validateCoupon(coupons, promoInput, {
      subtotal: base.subtotal,
      categoryId: category.id,
      service: serviceName(pickup, drop, route.distanceKm),
      isFirstBooking,
      customerUses: history.filter((t) => t.couponCode.toUpperCase() === promoInput.trim().toUpperCase()).length,
    });
    if (res.ok) {
      setCoupon(res.coupon);
      setPromoMsg({ ok: true, text: res.coupon.message });
    } else {
      setCoupon(null);
      setPromoMsg({ ok: false, text: res.message });
    }
  };

  const quote = category ? quotes.get(category.id) ?? null : null;
  const walletShort = payment === 'Wallet' && quote ? quote.total > profile.walletBalance : false;
  const tooClose = pickup && drop ? haversineKm(pickup, drop) < 0.2 : false;
  const tooFar = route ? route.distanceKm > 1500 : false;

  const blocker =
    !online
      ? 'You’re offline. Reconnect to request a ride.'
      : hasLiveRide
        ? 'You already have a ride in progress.'
        : !pickup
          ? 'Set your pickup point.'
          : !drop
            ? 'Where are you going?'
            : tooClose
              ? 'Pickup and destination are too close together.'
              : tooFar
                ? 'That trip is too long to book online — please call support.'
                : routeLoading || !route
                  ? 'Calculating route…'
                  : !category || !quote
                    ? 'Choose a ride type.'
                    : scheduleError || (walletShort ? 'Wallet balance is too low for this fare.' : '');

  const submit = async () => {
    if (blocker || submitting || !pickup || !drop || !route || !category || !quote) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await createRideRequest({
        profile,
        pickup,
        drop,
        category,
        route,
        fare: quote,
        tripType,
        paymentMethod: payment,
        couponCode: coupon?.code ?? '',
        notes,
        scheduledAt: timing === 'schedule' ? scheduledAt : null,
      });
      onRideRequested(res.id, res.unconfirmed);
    } catch (e) {
      setSubmitError(describeError(e, 'We couldn’t place your ride request. Please try again.'));
      setSubmitting(false);
    }
  };

  const saveDrop = async () => {
    if (!drop) return;
    try {
      await savePlace({ ...drop, id: '', type: 'favorite' }, profile.uid);
      setSavedDropMsg('Saved to favourites');
    } catch (e) {
      setSavedDropMsg(describeError(e, 'Couldn’t save this place.'));
    }
    setTimeout(() => setSavedDropMsg(''), 2500);
  };

  const goToCurrentLocation = async () => {
    const p = await locate();
    if (!p) return;
    setPanTo({ point: p, key: Date.now(), zoom: 17 });
    setPickup({ ...(await reverseGeocode(p)), type: 'current' });
  };

  const home = savedPlaces.find((p) => p.type === 'home');
  const work = savedPlaces.find((p) => p.type === 'work');
  const locationHint = locError ? LOCATION_ERROR_TEXT[locError.kind] : permission === 'prompt' && !position ? 'Allow location access to set your pickup automatically.' : '';
  const outstation = route ? isOutstation(route.distanceKm) : false;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-white">
      {/* Map */}
      <div className="relative md:order-2 md:flex-1 h-[42vh] md:h-auto shrink-0">
        <RideMap
          className="h-full"
          centerPin={pinMode}
          onCenterChange={onCenterChange}
          pickup={pickup}
          drop={drop}
          route={route && !adjustingPickup ? route.path : null}
          nearby={!drop ? nearby : []}
          userLocation={position}
          fitKey={fitKey}
          panTo={panTo}
        >
          {pinMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[600] bg-gray-900/90 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow">
              {resolvingPin ? 'Finding address…' : 'Move the map to set your pickup'}
            </div>
          )}
          <button
            onClick={() => void goToCurrentLocation()}
            aria-label="Go to my location"
            className="absolute bottom-24 right-3 z-[600] w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-blue-600 text-lg"
          >
            {locating ? <Spinner className="w-4 h-4" /> : '◎'}
          </button>
          {adjustingPickup && (
            <button
              onClick={() => setAdjustingPickup(false)}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[600] bg-[#E31E24] text-white text-sm font-bold px-6 py-3 rounded-full shadow-lg"
            >
              Confirm pickup
            </button>
          )}
        </RideMap>
      </div>

      {/* Panel */}
      <div className="md:order-1 md:w-[420px] md:shrink-0 md:border-r border-gray-200 flex-1 md:flex-none overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Locations */}
          <div className="space-y-2">
            <PlaceSearch
              label="Pickup"
              placeholder={resolvingPin ? 'Finding address…' : 'Pickup location'}
              accent="pickup"
              value={pickup}
              onSelect={(p) => {
                setPickup(p);
                pickupFromGps.current = true;
                setPanTo({ point: p, key: Date.now(), zoom: 17 });
              }}
              savedPlaces={savedPlaces}
              recentPlaces={recentPlaces}
              near={position}
              onUseCurrentLocation={() => void goToCurrentLocation()}
              locating={locating || resolvingPin}
            />
            <PlaceSearch
              label="Destination"
              placeholder="Where to?"
              accent="drop"
              value={drop}
              onSelect={(p) => {
                setDrop(p);
                setAdjustingPickup(false);
              }}
              savedPlaces={savedPlaces}
              recentPlaces={recentPlaces}
              near={pickup ?? position}
              onClear={() => {
                setDrop(null);
                setCoupon(null);
                setPromoMsg(null);
              }}
            />
            {locationHint && !pickup && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{locationHint}</p>}

            <div className="flex flex-wrap gap-2 pt-1">
              {[home, work].map(
                (p) =>
                  p && (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (isValidLatLng(p as Partial<LatLng>)) setDrop(p as GeoPlace);
                      }}
                      disabled={!isValidLatLng(p as Partial<LatLng>)}
                      title={isValidLatLng(p as Partial<LatLng>) ? p.address : 'Re-save this place from search to add its map position'}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                    >
                      {p.type === 'home' ? '🏠 Home' : '💼 Work'}
                    </button>
                  ),
              )}
              <button onClick={onOpenSavedPlaces} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200">
                ★ Saved places
              </button>
              {drop && !pinMode && (
                <button onClick={() => setAdjustingPickup(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200">
                  ✥ Adjust pickup pin
                </button>
              )}
              {drop && (
                <button onClick={() => void saveDrop()} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200">
                  ☆ Save destination
                </button>
              )}
            </div>
            {savedDropMsg && <p className="text-[11px] text-gray-600">{savedDropMsg}</p>}
          </div>

          {!drop && (
            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600">
              {pickup ? (
                nearby.length ? (
                  <>
                    <span className="font-bold text-gray-900">{nearby.length}</span> driver{nearby.length === 1 ? '' : 's'} online near your pickup.
                  </>
                ) : (
                  'No drivers online right now near your pickup — you can still request, and a partner will be dispatched.'
                )
              ) : (
                'Set your pickup to see available rides.'
              )}
            </div>
          )}

          {drop && pickup && (
            <>
              {/* Route summary */}
              <div className="flex items-center justify-between text-xs text-gray-600 border-y border-gray-100 py-2">
                {routeLoading || !route ? (
                  <Spinner className="w-3.5 h-3.5 text-gray-400" label="Calculating route…" />
                ) : (
                  <span>
                    <strong className="text-gray-900">{formatDistance(route.distanceKm)}</strong> · about{' '}
                    <strong className="text-gray-900">{formatDuration(route.durationMin)}</strong>
                    {route.estimated && <span className="text-amber-700"> · estimated</span>}
                    {outstation && <span className="ml-1 text-[10px] font-bold uppercase text-[#E31E24]">Outstation</span>}
                  </span>
                )}
                <div className="flex bg-gray-100 rounded-lg p-0.5" role="radiogroup" aria-label="Trip type">
                  {(['One Way', 'Round Trip'] as TripType[]).map((t) => (
                    <button
                      key={t}
                      role="radio"
                      aria-checked={tripType === t}
                      onClick={() => setTripType(t)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${tripType === t ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timing */}
              <div className="flex gap-2" role="radiogroup" aria-label="When">
                {(['now', 'schedule'] as const).map((t) => (
                  <button
                    key={t}
                    role="radio"
                    aria-checked={timing === t}
                    onClick={() => {
                      setTiming(t);
                      if (t === 'schedule' && !scheduleValue) setScheduleValue(toLocalInputValue(new Date(Date.now() + 60 * 60000)));
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                      timing === t ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 bg-white'
                    }`}
                  >
                    {t === 'now' ? 'Ride now' : 'Schedule'}
                  </button>
                ))}
              </div>
              {timing === 'schedule' && (
                <div>
                  <input
                    type="datetime-local"
                    value={scheduleValue}
                    min={toLocalInputValue(new Date(now + SCHEDULE_MIN_LEAD_MIN * 60000))}
                    max={toLocalInputValue(new Date(now + SCHEDULE_MAX_DAYS * 86400000))}
                    onChange={(e) => setScheduleValue(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-semibold"
                    aria-label="Pickup date and time"
                  />
                  {scheduleError && <p className="text-[11px] text-red-600 mt-1">{scheduleError}</p>}
                </div>
              )}

              {/* Categories */}
              <div className="space-y-2" role="radiogroup" aria-label="Ride type">
                {categories.map((c) => {
                  const q = quotes.get(c.id);
                  const eta = etaFor(c);
                  const selected = c.id === categoryId;
                  return (
                    <button
                      key={c.id}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setCategoryId(c.id)}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                        selected ? 'border-[#E31E24] bg-red-50/40 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="w-14 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {c.imageUrl ? <img src={c.imageUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-xl">🚖</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{c.name}</span>
                          <span className="text-[11px] text-gray-500">· {c.seats} seats</span>
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {timing === 'schedule' ? (
                            'Driver assigned before pickup'
                          ) : eta != null ? (
                            <span className="text-emerald-700 font-semibold">{eta} min away</span>
                          ) : (
                            'No cars nearby — partner dispatch'
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {q ? (
                          <>
                            <div className="text-sm font-black text-gray-900">{formatINR(q.total)}</div>
                            {selected && q.discount > 0 && <div className="text-[10px] text-emerald-700 font-bold">−{formatINR(q.discount)} promo</div>}
                          </>
                        ) : (
                          <Spinner className="w-3.5 h-3.5 text-gray-300" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Fare breakdown for the selected ride */}
              {quote && (
                <details className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600">
                  <summary className="cursor-pointer font-bold text-gray-800">Fare breakdown</summary>
                  <FareLines fare={quote} />
                  <p className="mt-2 text-[10px] text-gray-400">Tolls, parking and state permits paid by the driver are added at the end of the trip.</p>
                </details>
              )}

              {/* Payment */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Payment</p>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
                  {PAYMENT_OPTIONS.map((p) => {
                    const disabled = p.id === 'Card' || (p.id === 'Wallet' && (!quote || profile.walletBalance < quote.total));
                    const hint = p.id === 'Wallet' ? `Balance ${formatINR(profile.walletBalance)}` : p.hint;
                    return (
                      <button
                        key={p.id}
                        role="radio"
                        aria-checked={payment === p.id}
                        disabled={disabled}
                        onClick={() => setPayment(p.id)}
                        className={`text-left px-3 py-2 rounded-xl border text-xs disabled:opacity-45 disabled:cursor-not-allowed ${
                          payment === p.id ? 'border-[#E31E24] bg-red-50/40' : 'border-gray-200'
                        }`}
                      >
                        <span className="block font-bold text-gray-900">{p.label}</span>
                        <span className="block text-[10px] text-gray-500">{hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Promo + notes */}
              <button onClick={() => setShowExtras((s) => !s)} className="text-xs font-bold text-[#E31E24]">
                {showExtras ? '− Hide promo code & note' : '+ Add promo code or note for driver'}
                {coupon && !showExtras ? ` · ${coupon.code} applied` : ''}
              </button>
              {showExtras && (
                <div className="space-y-3">
                  <div>
                    <div className="flex gap-2">
                      <input
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                        placeholder="Promo code"
                        aria-label="Promo code"
                        className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold tracking-wider uppercase"
                      />
                      {coupon ? (
                        <button
                          onClick={() => {
                            setCoupon(null);
                            setPromoMsg(null);
                            setPromoInput('');
                          }}
                          className="px-4 rounded-xl text-xs font-bold bg-gray-100"
                        >
                          Remove
                        </button>
                      ) : (
                        <button onClick={applyPromo} disabled={!promoInput.trim()} className="px-4 rounded-xl text-xs font-bold bg-gray-900 text-white disabled:opacity-40">
                          Apply
                        </button>
                      )}
                    </div>
                    {promoMsg && <p className={`text-[11px] mt-1 ${promoMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{promoMsg.text}</p>}
                  </div>
                  <div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value.slice(0, 300))}
                      rows={2}
                      placeholder="Note for driver (e.g. gate number, landmark, luggage)"
                      aria-label="Note for driver"
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm"
                    />
                    <p className="text-[10px] text-gray-400 text-right">{notes.length}/300</p>
                  </div>
                </div>
              )}
            </>
          )}

          {submitError && <ErrorNotice message={submitError} onRetry={() => void submit()} />}
        </div>

        {/* Sticky confirm */}
        {drop && pickup && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <button onClick={() => void submit()} disabled={!!blocker || submitting} className={primaryBtn}>
              {submitting ? (
                <Spinner label="Requesting…" />
              ) : blocker ? (
                blocker
              ) : (
                <>
                  {timing === 'schedule' ? 'Schedule' : 'Request'} {category?.name} · {formatINR(quote!.total)}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
