// Ride booking: pickup/destination, ride type, timing, fare, promo, payment.
// Native port of user/web/src/screens/RideBookingScreen.tsx. The fare engine,
// coupon validation, scheduling limits and booking payload are the Web's.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Chip, Notice, Screen, SectionTitle, Segmented } from '../components/ui';
import { FareLines } from '../components/FareLines';
import { PlaceSearchModal } from '../components/PlaceSearchModal';
import { RideMap } from '../components/RideMap';
import { useCustomerData } from '../context/CustomerData';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getRoute, LOCATION_ERROR_TEXT, reverseGeocode } from '../services/geoService';
import { calculateFare, isOutstation, serviceName, subscribeToCoupons, subscribeToRideCategories, validateCoupon } from '../services/pricingService';
import { createRideRequest } from '../services/rideService';
import { savePlace } from '../services/userService';
import { SCHEDULE_MAX_DAYS, SCHEDULE_MIN_LEAD_MIN } from '../config/constants';
import type { AppliedCoupon, Coupon, FareBreakdown, GeoPlace, LatLng, PaymentMethod, RideCategory, RouteInfo, TripType } from '../types';
import { formatDateTime, formatDistance, formatDuration, formatINR } from '../utils/format';
import { haversineKm, isValidLatLng } from '../utils/geo';
import { describeError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: 'Cash', label: 'Cash', hint: 'Pay the driver at drop' },
  { id: 'UPI', label: 'UPI', hint: 'GPay / PhonePe / Paytm at drop' },
  { id: 'Wallet', label: 'NESAM Wallet', hint: '' },
];

type PickerTarget = 'pickup' | 'drop' | null;

export function BookScreen() {
  const navigation = useNavigation();
  const { profile, trips, liveRide, savedPlaces } = useCustomerData();
  const { position, error: locError, permission, locating, locate } = useDeviceLocation(true);
  const { online } = useNetworkStatus();

  const [pickup, setPickup] = useState<GeoPlace | null>(null);
  const [drop, setDrop] = useState<GeoPlace | null>(null);
  const [picker, setPicker] = useState<PickerTarget>(null);
  // A route is tagged with the endpoints it was computed for; a result for
  // older endpoints is simply not shown (no reset needed when they change).
  const [routeState, setRouteState] = useState<{ key: string; info: RouteInfo } | null>(null);

  const [categories, setCategories] = useState<RideCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  const [tripType, setTripType] = useState<TripType>('One Way');
  const [timing, setTiming] = useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('Cash');
  const [promoInput, setPromoInput] = useState('');
  // The code the rider applied; its discount is re-derived on every fare change.
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [promoError, setPromoError] = useState('');
  const [notes, setNotes] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const submittingRef = useRef(false);

  // Live data.
  useEffect(
    () =>
      subscribeToRideCategories((cats) => {
        setCategories(cats);
        setCategoryId((cur) => (cats.some((c) => c.id === cur) ? cur : (cats[Math.min(1, cats.length - 1)]?.id ?? '')));
      }),
    [],
  );
  useEffect(() => subscribeToCoupons(setCoupons), []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // First GPS fix becomes the pickup (unless the rider already chose one).
  const pickupFromGps = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!position || pickupFromGps.current || pickup) return;
    pickupFromGps.current = true;
    void reverseGeocode(position).then((p) => {
      if (mounted.current) setPickup((cur) => cur ?? { ...p, type: 'current' });
    });
  }, [position, pickup]);

  // Route whenever both ends are known.
  const routeKey = pickup && drop ? `${pickup.lat},${pickup.lng}>${drop.lat},${drop.lng}` : '';
  const route = routeKey && routeState?.key === routeKey ? routeState.info : null;
  const routeLoading = !!routeKey && !route;
  useEffect(() => {
    if (!pickup || !drop) return undefined;
    const key = `${pickup.lat},${pickup.lng}>${drop.lat},${drop.lng}`;
    const controller = new AbortController();
    getRoute(pickup, drop, controller.signal)
      .then((r) => !controller.signal.aborted && setRouteState({ key, info: r }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps -- routeKey encodes both endpoints

  // ── Derived ───────────────────────────────────────────────────────────────
  const category = categories.find((c) => c.id === categoryId) ?? null;
  const scheduleError = useMemo(() => {
    if (timing !== 'schedule') return '';
    if (!scheduledAt) return 'Choose a pickup date and time.';
    const lead = (scheduledAt.getTime() - now) / 60000;
    if (lead < SCHEDULE_MIN_LEAD_MIN) return `Scheduled rides need at least ${SCHEDULE_MIN_LEAD_MIN} minutes’ notice.`;
    if (lead > SCHEDULE_MAX_DAYS * 1440) return `You can schedule up to ${SCHEDULE_MAX_DAYS} days ahead.`;
    return '';
  }, [timing, scheduledAt, now]);
  const pickupTime = timing === 'schedule' && scheduledAt ? scheduledAt : new Date(now);
  const pickupTimeMs = pickupTime.getTime();

  const history = useMemo(() => trips.filter((t) => t.status !== 'Cancelled'), [trips]);
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

  /** Validates a promo code against the current, undiscounted fare. */
  const checkCoupon = (code: string) => {
    if (!route || !category || !pickup || !drop) return null;
    const base = calculateFare({ category, route, tripType, pickupTime: new Date(pickupTimeMs) });
    return validateCoupon(coupons, code, {
      subtotal: base.subtotal,
      categoryId: category.id,
      service: serviceName(pickup, drop, route.distanceKm),
      isFirstBooking,
      customerUses: history.filter((t) => t.couponCode.toUpperCase() === code.trim().toUpperCase()).length,
    });
  };

  // The applied code is re-validated whenever the priced inputs change, so a
  // discount can never outlive the fare it was granted on.
  const couponCheck = appliedCode ? checkCoupon(appliedCode) : null;
  const coupon: AppliedCoupon | null = couponCheck?.ok ? couponCheck.coupon : null;
  const promoMsg: { ok: boolean; text: string } | null = couponCheck
    ? couponCheck.ok
      ? { ok: true, text: couponCheck.coupon.message }
      : { ok: false, text: `Promo not applied: ${couponCheck.message}` }
    : promoError
      ? { ok: false, text: promoError }
      : null;

  const applyPromo = () => {
    const res = checkCoupon(promoInput);
    if (!res) return setPromoError('Set your pickup and destination first.');
    if (res.ok) {
      setAppliedCode(res.coupon.code);
      setPromoError('');
    } else {
      setAppliedCode(null);
      setPromoError(res.message);
    }
    return undefined;
  };
  const clearPromo = () => {
    setAppliedCode(null);
    setPromoError('');
    setPromoInput('');
  };

  // Cheap (one quote per category) and recomputed from derived inputs; the
  // React Compiler memoizes it, so no manual useMemo.
  const quotes = new Map<string, FareBreakdown>();
  if (route) {
    for (const c of categories) {
      quotes.set(c.id, calculateFare({ category: c, route, tripType, pickupTime: new Date(pickupTimeMs), discount: c.id === categoryId ? (coupon?.discount ?? 0) : 0 }));
    }
  }

  const quote = category ? (quotes.get(category.id) ?? null) : null;
  const walletShort = payment === 'Wallet' && quote ? quote.total > profile.walletBalance : false;
  const tooClose = pickup && drop ? haversineKm(pickup, drop) < 0.2 : false;
  const tooFar = route ? route.distanceKm > 1500 : false;

  const blocker = !online
    ? 'You’re offline. Reconnect to request a ride.'
    : liveRide
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
    if (blocker || submittingRef.current || !pickup || !drop || !route || !category || !quote) return;
    submittingRef.current = true;
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
      // Reset the form for the next booking; the ride screen takes over.
      setDrop(null);
      clearPromo();
      setNotes('');
      setTiming('now');
      setScheduledAt(null);
      navigation.navigate('ActiveRide', { bookingId: res.id, unconfirmed: res.unconfirmed });
    } catch (e) {
      setSubmitError(describeError(e, 'We couldn’t place your ride request. Please try again.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const locateMe = async () => {
    const p = await locate();
    if (!p) return;
    const place = await reverseGeocode(p);
    if (mounted.current) {
      pickupFromGps.current = true;
      setPickup({ ...place, type: 'current' });
    }
  };

  const swap = () => {
    if (!pickup || !drop) return;
    setPickup(drop);
    setDrop(pickup);
  };

  const saveDrop = async () => {
    if (!drop) return;
    try {
      await savePlace({ ...drop, id: '', type: 'favorite' }, profile.uid);
      setSavedMsg('Saved to favourites');
    } catch (e) {
      setSavedMsg(describeError(e, 'Couldn’t save this place.'));
    }
    setTimeout(() => mounted.current && setSavedMsg(''), 2500);
  };

  const openSchedulePicker = () => {
    const min = new Date(Date.now() + SCHEDULE_MIN_LEAD_MIN * 60000);
    const max = new Date(Date.now() + SCHEDULE_MAX_DAYS * 86400000);
    const initial = scheduledAt ?? new Date(Date.now() + 60 * 60000);
    DateTimePickerAndroid.open({
      value: initial,
      mode: 'date',
      minimumDate: min,
      maximumDate: max,
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        DateTimePickerAndroid.open({
          value: initial,
          mode: 'time',
          is24Hour: false,
          onChange: (e2, time) => {
            if (e2.type !== 'set' || !time) return;
            const d = new Date(date);
            d.setHours(time.getHours(), time.getMinutes(), 0, 0);
            setScheduledAt(d);
          },
        });
      },
    });
  };

  const home = savedPlaces.find((p) => p.type === 'home');
  const work = savedPlaces.find((p) => p.type === 'work');
  const locationHint = locError ? LOCATION_ERROR_TEXT[locError.kind] : permission === 'prompt' && !position ? 'Allow location access to set your pickup automatically.' : '';
  const outstation = route ? isOutstation(route.distanceKm) : false;

  return (
    <Screen
      footer={
        pickup && drop ? (
          <Button
            title={submitting ? 'Requesting…' : blocker || `${timing === 'schedule' ? 'Schedule' : 'Request'} ${category?.name ?? ''} · ${quote ? formatINR(quote.total) : ''}`}
            loading={submitting}
            disabled={!!blocker}
            onPress={() => void submit()}
          />
        ) : undefined
      }
    >
      <PlaceSearchModal
        visible={picker !== null}
        title={picker === 'pickup' ? 'Set pickup' : 'Where to?'}
        onClose={() => setPicker(null)}
        onSelect={(p) => {
          if (picker === 'pickup') {
            pickupFromGps.current = true;
            setPickup(p);
          } else {
            setDrop(p);
          }
        }}
        savedPlaces={savedPlaces}
        recentPlaces={recentPlaces}
        near={picker === 'drop' ? (pickup ?? position) : position}
        onUseCurrentLocation={picker === 'pickup' ? () => void locateMe() : undefined}
      />

      <Text style={type.h1}>Hi {profile.name.split(' ')[0] || 'there'} 👋</Text>
      <Text style={[type.small, { marginBottom: space.lg }]}>Where would you like to go today?</Text>

      {liveRide ? (
        <Pressable style={styles.liveBanner} onPress={() => navigation.navigate('ActiveRide', { bookingId: liveRide.id })} accessibilityRole="button">
          <Ionicons name="navigate" size={18} color={colors.white} />
          <Text style={styles.liveText} numberOfLines={1}>
            Ride in progress · {liveRide.drop.name}
          </Text>
          <Text style={styles.liveText}>View →</Text>
        </Pressable>
      ) : null}

      <Card>
        <Pressable style={styles.placeRow} onPress={() => setPicker('pickup')} accessibilityRole="button" accessibilityLabel="Set pickup">
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <View style={{ flex: 1 }}>
            <Text style={type.tiny}>PICKUP</Text>
            <Text style={styles.placeName} numberOfLines={1}>
              {pickup?.name ?? (locating ? 'Finding your location…' : 'Set pickup location')}
            </Text>
            {pickup ? (
              <Text style={type.small} numberOfLines={1}>
                {pickup.address}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={() => void locateMe()} hitSlop={10} accessibilityLabel="Use my current location" accessibilityRole="button">
            <Ionicons name="locate" size={22} color={colors.info} />
          </Pressable>
        </Pressable>
        <View style={styles.placeDivider}>
          <View style={styles.connector} />
          {pickup && drop ? (
            <Pressable onPress={swap} style={styles.swap} accessibilityLabel="Swap pickup and destination" accessibilityRole="button">
              <Ionicons name="swap-vertical" size={18} color={colors.ink} />
            </Pressable>
          ) : null}
        </View>
        <Pressable style={styles.placeRow} onPress={() => setPicker('drop')} accessibilityRole="button" accessibilityLabel="Set destination">
          <View style={[styles.dot, { backgroundColor: colors.primary, borderRadius: 2 }]} />
          <View style={{ flex: 1 }}>
            <Text style={type.tiny}>DESTINATION</Text>
            <Text style={[styles.placeName, !drop && { color: colors.muted }]} numberOfLines={1}>
              {drop?.name ?? 'Where to?'}
            </Text>
            {drop ? (
              <Text style={type.small} numberOfLines={1}>
                {drop.address}
              </Text>
            ) : null}
          </View>
          {drop ? (
            <Pressable
              onPress={() => {
                setDrop(null);
                clearPromo();
              }}
              hitSlop={10}
              accessibilityLabel="Clear destination"
              accessibilityRole="button"
            >
              <Ionicons name="close-circle" size={22} color={colors.faint} />
            </Pressable>
          ) : null}
        </Pressable>
      </Card>

      {locationHint && !pickup ? <Notice tone="warning" message={locationHint} /> : null}

      <View style={styles.chips}>
        {[home, work].map((p) =>
          p ? (
            <Chip
              key={p.id}
              label={p.type === 'home' ? 'Home' : 'Work'}
              onPress={() => {
                if (isValidLatLng(p as Partial<LatLng>)) setDrop(p as GeoPlace);
              }}
            />
          ) : null,
        )}
        <Chip label="Saved places" onPress={() => navigation.navigate('SavedPlaces')} />
        <Chip label="Offers" onPress={() => navigation.navigate('Offers')} />
        {drop ? <Chip label="☆ Save destination" onPress={() => void saveDrop()} /> : null}
      </View>
      {savedMsg ? <Text style={type.small}>{savedMsg}</Text> : null}

      {pickup && drop ? (
        <>
          <RideMap pickup={pickup} drop={drop} route={route && !route.estimated ? route.path : null} userLocation={null} height={200} />
          <View style={styles.routeRow}>
            <Text style={type.small}>
              {routeLoading || !route ? (
                'Calculating route…'
              ) : (
                <>
                  <Text style={styles.strong}>{formatDistance(route.distanceKm)}</Text> · about{' '}
                  <Text style={styles.strong}>{formatDuration(route.durationMin)}</Text>
                  {route.estimated ? ' · estimated' : ''}
                </>
              )}
            </Text>
            {outstation ? <Badge label="Outstation" tone="brand" /> : null}
          </View>

          <SectionTitle>Trip</SectionTitle>
          <Segmented
            options={[
              { value: 'One Way', label: 'One way' },
              { value: 'Round Trip', label: 'Round trip' },
            ]}
            value={tripType}
            onChange={setTripType}
          />
          <View style={{ height: space.sm }} />
          <Segmented
            options={[
              { value: 'now', label: 'Ride now' },
              { value: 'schedule', label: 'Schedule' },
            ]}
            value={timing}
            onChange={(v) => {
              setTiming(v);
              if (v === 'schedule' && !scheduledAt) openSchedulePicker();
            }}
          />
          {timing === 'schedule' ? (
            <Pressable style={styles.scheduleBox} onPress={openSchedulePicker} accessibilityRole="button">
              <Ionicons name="calendar-outline" size={18} color={colors.ink} />
              <Text style={[styles.strong, { flex: 1 }]}>{scheduledAt ? formatDateTime(scheduledAt) : 'Choose pickup date & time'}</Text>
              <Text style={styles.change}>Change</Text>
            </Pressable>
          ) : null}
          {scheduleError ? <Text style={styles.err}>{scheduleError}</Text> : null}

          <SectionTitle>Choose a ride</SectionTitle>
          {categories.map((c) => {
            const q = quotes.get(c.id);
            const selected = c.id === categoryId;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCategoryId(c.id)}
                style={[styles.cat, selected && styles.catOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Ionicons name="car" size={26} color={selected ? colors.primary : colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName}>
                    {c.name} <Text style={type.small}>· {c.seats} seats</Text>
                  </Text>
                  <Text style={type.small} numberOfLines={1}>
                    {timing === 'schedule' ? 'Driver assigned before pickup' : c.description || 'Partner dispatch'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.catFare}>{q ? formatINR(q.total) : '—'}</Text>
                  {selected && q && q.discount > 0 ? <Text style={styles.promoSave}>−{formatINR(q.discount)} promo</Text> : null}
                </View>
              </Pressable>
            );
          })}

          {quote ? (
            <Card>
              <Pressable onPress={() => setShowBreakdown((s) => !s)} style={styles.breakdownHead} accessibilityRole="button">
                <Text style={type.h3}>Fare breakdown</Text>
                <Ionicons name={showBreakdown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
              </Pressable>
              {showBreakdown ? (
                <>
                  <FareLines fare={quote} />
                  <Text style={[type.tiny, { marginTop: space.sm }]}>Tolls, parking and state permits paid by the driver are added at the end of the trip.</Text>
                </>
              ) : null}
            </Card>
          ) : null}

          <SectionTitle>Payment</SectionTitle>
          <View style={styles.payGrid}>
            {PAYMENT_OPTIONS.map((p) => {
              const disabled = p.id === 'Wallet' && (!quote || profile.walletBalance < quote.total);
              const hint = p.id === 'Wallet' ? `Balance ${formatINR(profile.walletBalance)}` : p.hint;
              const on = payment === p.id;
              return (
                <Pressable
                  key={p.id}
                  disabled={disabled}
                  onPress={() => setPayment(p.id)}
                  style={[styles.pay, on && styles.catOn, disabled && { opacity: 0.45 }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled }}
                >
                  <Text style={styles.strong}>{p.label}</Text>
                  <Text style={type.tiny}>{hint}</Text>
                </Pressable>
              );
            })}
          </View>

          <SectionTitle>Promo code & note</SectionTitle>
          <View style={styles.promoRow}>
            <TextInput
              value={promoInput}
              onChangeText={(v) => setPromoInput(v.toUpperCase())}
              placeholder="Promo code"
              placeholderTextColor={colors.faint}
              autoCapitalize="characters"
              style={styles.promoInput}
              editable={!appliedCode}
            />
            {appliedCode ? (
              <Button
                small
                variant="secondary"
                title="Remove"
                onPress={clearPromo}
              />
            ) : (
              <Button small variant="dark" title="Apply" disabled={!promoInput.trim()} onPress={applyPromo} />
            )}
          </View>
          {promoMsg ? <Text style={[styles.promoMsg, { color: promoMsg.ok ? colors.success : colors.primaryDark }]}>{promoMsg.text}</Text> : null}
          <TextInput
            value={notes}
            onChangeText={(v) => setNotes(v.slice(0, 300))}
            placeholder="Note for driver (gate number, landmark, luggage)"
            placeholderTextColor={colors.faint}
            multiline
            style={styles.notes}
          />
          <Text style={[type.tiny, { textAlign: 'right' }]}>{notes.length}/300</Text>
          <Notice message={submitError} onRetry={() => void submit()} />
        </>
      ) : (
        <Card>
          <Text style={type.h3}>Airport · Local · Outstation</Text>
          <Text style={[type.small, { marginTop: 4 }]}>
            Set your pickup and destination to see fares for every NESAM ride type. Trips over 40 km are priced as outstation with driver
            allowance; airport trips are detected automatically.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  liveText: { color: colors.white, fontWeight: '700', fontSize: 13, flexShrink: 1 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  placeName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  dot: { width: 12, height: 12, borderRadius: 6 },
  placeDivider: { flexDirection: 'row', alignItems: 'center', height: 24 },
  connector: { width: 2, height: 24, backgroundColor: colors.border, marginLeft: 5 },
  swap: { marginLeft: 'auto', padding: 6, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  routeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  strong: { fontWeight: '800', color: colors.ink, fontSize: 14 },
  scheduleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  change: { color: colors.primary, fontWeight: '700' },
  err: { color: colors.primaryDark, fontSize: 12, marginTop: 4 },
  cat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: space.sm,
  },
  catOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  catName: { fontSize: 15, fontWeight: '800', color: colors.ink },
  catFare: { fontSize: 16, fontWeight: '900', color: colors.ink },
  promoSave: { fontSize: 11, color: colors.success, fontWeight: '700' },
  breakdownHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pay: {
    flexGrow: 1,
    flexBasis: '30%',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  promoRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 44,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  promoMsg: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  notes: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 64,
    textAlignVertical: 'top',
    color: colors.ink,
    backgroundColor: colors.card,
    marginTop: space.md,
  },
});
