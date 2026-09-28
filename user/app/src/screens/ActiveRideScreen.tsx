// Live ride: searching → partner confirmed → driver en route → arrived →
// in trip → completed / cancelled. Native port of user/web ActiveRideScreen.tsx.
import React, { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useRideFocus } from '../navigation/MainNavigator';
import { useCustomerData } from '../context/CustomerData';
import { Avatar, Badge, Button, Card, FullScreenLoader, Notice, Screen } from '../components/ui';
import { RideMap } from '../components/RideMap';
import { CancelRideSheet } from '../components/CancelRideSheet';
import { RatingCard } from '../components/RatingCard';
import { TripReceipt } from '../components/TripReceipt';
import { SafetySheet, shareTrip } from '../components/SafetySheet';
import { cancelRide, subscribeToBoardingOtp, subscribeToBooking } from '../services/rideService';
import { getRoute } from '../services/geoService';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { PRESENCE_STALE_MS, SEARCH_GIVE_UP_AFTER_MS, SEARCH_SLOW_AFTER_MS } from '../config/constants';
import type { LatLng, RouteInfo, TripRecord } from '../types';
import { formatDateTime, formatDistance, formatDuration, formatINR, formatPhone, localMobile, timeAgo } from '../utils/format';
import { haversineKm, isValidLatLng } from '../utils/geo';
import { describeError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveRide'>;

const PHASE_TITLE: Record<TripRecord['phase'], string> = {
  searching: 'Finding your driver',
  partner_confirmed: 'Ride confirmed',
  driver_en_route: 'Driver on the way',
  driver_arrived: 'Your driver has arrived',
  in_trip: 'On your way',
  completed: 'Trip completed',
  cancelled: 'Ride cancelled',
};

export function ActiveRideScreen({ route, navigation }: Props) {
  const { bookingId, unconfirmed } = route.params;
  const { profile } = useCustomerData();
  const { dismiss, undismiss } = useRideFocus();
  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [pending, setPending] = useState(!!unconfirmed);
  const [fromCache, setFromCache] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [vanished, setVanished] = useState(false);
  const [subKey, setSubKey] = useState(0);
  const [otp, setOtp] = useState<string | null>(null);
  // ETA is tagged with its target so a stale one never shows after a phase change.
  const [etaState, setEtaState] = useState<{ target: string; info: RouteInfo } | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [autoCancelError, setAutoCancelError] = useState('');
  const { online } = useNetworkStatus();
  const { position } = useDeviceLocation(true);

  // Leaving this screen (back, minimise) stops it re-opening automatically.
  useEffect(() => {
    undismiss(bookingId);
    return navigation.addListener('beforeRemove', () => dismiss(bookingId));
  }, [navigation, bookingId, dismiss, undismiss]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  // Booking document — source of truth for every phase.
  useEffect(() => {
    return subscribeToBooking(
      bookingId,
      (s) => {
        setPending(s.pending);
        setFromCache(s.fromCache);
        if (s.trip) {
          setTrip(s.trip);
          setVanished(false);
        } else if (!s.fromCache) {
          // Gone on the server: a rejected request or a booking removed by an admin.
          setVanished(true);
          setTrip(null);
        }
      },
      (e) => setLoadError(describeError(e, 'We couldn’t load this ride.')),
    );
  }, [bookingId, subKey]);

  useEffect(() => subscribeToBoardingOtp(bookingId, setOtp), [bookingId]);

  const tracking = !!trip && ['driver_en_route', 'driver_arrived', 'in_trip'].includes(trip.phase);
  const driverLoc = tracking ? (trip?.driverLocation ?? null) : null;
  const driverFresh = !!driverLoc?.updatedAt && now - driverLoc.updatedAt.getTime() < PRESENCE_STALE_MS;

  // ETA: driver → pickup before the trip, driver → drop during it. Re-routed
  // when the driver has moved ~150 m or every 45 s, whichever comes first.
  const etaAnchor = useRef<{ at: number; from: LatLng | null; target: string }>({ at: 0, from: null, target: '' });
  useEffect(() => {
    if (!trip || !driverLoc) return undefined;
    const target = trip.phase === 'in_trip' ? trip.drop : trip.pickup;
    if (!isValidLatLng(target)) return undefined;
    const key = trip.phase === 'in_trip' ? 'drop' : 'pickup';
    const a = etaAnchor.current;
    const moved = a.from ? haversineKm(a.from, driverLoc) : Infinity;
    if (a.target === key && moved < 0.15 && Date.now() - a.at < 45000) return undefined;
    etaAnchor.current = { at: Date.now(), from: driverLoc, target: key };
    const controller = new AbortController();
    getRoute(driverLoc, target, controller.signal)
      .then((r) => !controller.signal.aborted && setEtaState({ target: key, info: r }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [driverLoc?.lat, driverLoc?.lng, trip?.phase]); // eslint-disable-line react-hooks/exhaustive-deps -- throttled on position/phase

  // Searching: withdraw an instant request nobody accepted.
  const searchingFor = trip?.createdAt ? now - trip.createdAt.getTime() : 0;
  const slow = trip?.phase === 'searching' && !trip.isScheduled && searchingFor > SEARCH_SLOW_AFTER_MS;
  const gaveUp = useRef(false);
  useEffect(() => {
    if (!trip || trip.phase !== 'searching' || trip.isScheduled || pending || gaveUp.current) return;
    if (searchingFor < SEARCH_GIVE_UP_AFTER_MS || !online) return;
    gaveUp.current = true;
    cancelRide(trip, 'No driver found').catch((e: unknown) => {
      gaveUp.current = false;
      setAutoCancelError(describeError(e, 'We couldn’t withdraw your request automatically.'));
    });
  }, [searchingFor, trip, pending, online]);

  const etaTarget = trip?.phase === 'in_trip' ? 'drop' : 'pickup';
  const eta = driverLoc && etaState?.target === etaTarget ? etaState.info : null;

  if (loadError && !trip) {
    return (
      <Screen edges={[]}>
        <Notice
          message={loadError}
          onRetry={() => {
            setLoadError('');
            setSubKey((k) => k + 1);
          }}
        />
        <Button title="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }
  if (vanished) {
    return (
      <Screen edges={[]}>
        <Notice message="This ride is no longer available. If you just requested it, our servers did not accept the request and nothing was charged — please try again, or contact support if it keeps happening." />
        <Button title="Back to booking" onPress={() => navigation.navigate('Tabs', { screen: 'Book' })} />
      </Screen>
    );
  }
  if (!trip) return <FullScreenLoader label={pending ? 'Sending your ride request…' : 'Loading your ride…'} />;

  const phase = trip.phase;
  const canCancel = ['Pending', 'Confirmed', 'Assigned'].includes(trip.status);
  const minutesAway = eta ? Math.max(1, Math.round(eta.durationMin)) : null;
  const straightKm = driverLoc && isValidLatLng(trip.pickup) ? haversineKm(driverLoc, trip.pickup) : null;
  const sharePoint: LatLng | null = phase === 'in_trip' && driverLoc ? driverLoc : position;
  const driverPhone = trip.driver ? localMobile(trip.driver.phone) : '';

  return (
    <Screen edges={[]}>
      <SafetySheet visible={showSafety} onClose={() => setShowSafety(false)} trip={trip} profile={profile} location={sharePoint} />
      {showCancel ? <CancelRideSheet trip={trip} onClose={() => setShowCancel(false)} /> : null}

      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={type.h1}>{PHASE_TITLE[phase]}</Text>
          <Text style={type.small}>
            Booking {trip.bookingId}
            {pending ? ' · sending…' : ''}
            {!pending && fromCache && !online ? ' · offline — showing last update' : ''}
          </Text>
        </View>
        {tracking ? <Button small variant="danger" title="SOS" onPress={() => setShowSafety(true)} accessibilityLabel="Open safety centre" /> : null}
      </View>

      {phase !== 'completed' && phase !== 'cancelled' ? (
        <RideMap
          pickup={phase === 'in_trip' ? null : trip.pickup}
          drop={trip.drop}
          driver={driverLoc ? { ...driverLoc, label: trip.driver?.name, stale: !driverFresh } : null}
          route={eta && !eta.estimated ? eta.path : null}
          userLocation={phase === 'in_trip' ? null : position}
        />
      ) : null}

      {phase === 'searching' ? (
        <Card>
          <Text style={type.body}>
            {trip.isScheduled && trip.scheduledAt
              ? `Scheduled for ${formatDateTime(trip.scheduledAt)}. We’ll assign a driver before your pickup and update you here.`
              : pending
                ? 'Sending your request…'
                : 'Contacting drivers near your pickup. This usually takes under a minute.'}
          </Text>
          {slow ? (
            <Notice
              tone="warning"
              style={{ marginTop: space.md }}
              message={`It’s taking longer than usual. We’ll keep looking for up to ${Math.round(SEARCH_GIVE_UP_AFTER_MS / 60000)} minutes — or you can cancel for free.`}
            />
          ) : null}
          <Notice message={autoCancelError} />
        </Card>
      ) : null}

      {phase === 'partner_confirmed' ? (
        <Card>
          <Text style={type.body}>
            {trip.assignedVendorName ? <Text style={{ fontWeight: '800' }}>{trip.assignedVendorName}</Text> : 'Our partner'} accepted your ride and is
            assigning a driver.
          </Text>
        </Card>
      ) : null}

      {trip.driver && tracking ? (
        <Card>
          {phase === 'driver_en_route' ? (
            <View style={styles.etaRow}>
              <Text style={styles.etaLabel}>ARRIVING IN</Text>
              <Text style={styles.eta}>{minutesAway != null ? `${minutesAway} min` : '—'}</Text>
            </View>
          ) : null}
          {phase === 'in_trip' ? (
            <View style={styles.etaRow}>
              <Text style={styles.etaLabel} numberOfLines={1}>
                REACHING {trip.drop.name.toUpperCase()} IN
              </Text>
              <Text style={styles.eta}>{minutesAway != null ? formatDuration(minutesAway) : '—'}</Text>
            </View>
          ) : null}
          {driverLoc && !driverFresh ? <Text style={styles.stale}>Driver location last updated {timeAgo(driverLoc.updatedAt, now)}.</Text> : null}
          {!driverLoc ? <Text style={type.small}>Live location appears once your driver’s app shares it.</Text> : null}

          <View style={styles.driverRow}>
            <Avatar name={trip.driver.name} photoUrl={trip.driver.photoUrl} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={type.h3} numberOfLines={1}>
                {trip.driver.name}
              </Text>
              <Text style={type.small}>
                {trip.driver.rating != null ? `★ ${trip.driver.rating.toFixed(1)} · ` : ''}
                {trip.driver.vehicleModel || trip.categoryName}
              </Text>
            </View>
            {trip.driver.vehicleNumber ? <Text style={styles.plate}>{trip.driver.vehicleNumber}</Text> : null}
          </View>

          {phase === 'driver_en_route' || phase === 'driver_arrived' ? (
            <View style={[styles.otpBox, phase === 'driver_arrived' && styles.otpBoxArrived]}>
              <Text style={[type.small, { flex: 1 }]}>{phase === 'driver_arrived' ? 'Share this code to start your ride' : 'Start-of-ride code'}</Text>
              <Text style={styles.otp} accessibilityLabel={`Ride code ${otp ? otp.split('').join(' ') : 'unavailable'}`}>
                {otp ?? '····'}
              </Text>
            </View>
          ) : null}
          {phase === 'driver_arrived' ? (
            <Text style={[type.small, { marginTop: space.sm }]}>Meet your driver at {trip.pickup.name}. Only share the code once you’re in the car.</Text>
          ) : null}

          <View style={styles.actions}>
            {driverPhone ? (
              <>
                <Button small variant="dark" title="Call" onPress={() => void Linking.openURL(`tel:+91${driverPhone}`)} style={styles.action} />
                <Button
                  small
                  variant="secondary"
                  title="WhatsApp"
                  onPress={() =>
                    void Linking.openURL(`whatsapp://send?phone=91${driverPhone}`).catch(() => Linking.openURL(`https://wa.me/91${driverPhone}`))
                  }
                  style={styles.action}
                />
              </>
            ) : (
              <Badge label="No phone on file" />
            )}
            <Button small variant="secondary" title="Share trip" onPress={() => void shareTrip(trip, sharePoint)} style={styles.action} />
          </View>
          {driverPhone ? <Text style={[type.tiny, { marginTop: 4 }]}>Calls go to {formatPhone(driverPhone)}.</Text> : null}
        </Card>
      ) : null}

      {phase !== 'completed' ? (
        <Card>
          <View style={styles.place}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.placeName}>{trip.pickup.name}</Text>
              <Text style={type.small}>{trip.pickup.address}</Text>
            </View>
          </View>
          <View style={styles.place}>
            <View style={[styles.dot, { backgroundColor: colors.primary, borderRadius: 2 }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.placeName}>{trip.drop.name}</Text>
              <Text style={type.small}>{trip.drop.address}</Text>
            </View>
          </View>
          <View style={styles.summary}>
            <Text style={[type.small, { flex: 1 }]}>
              {trip.categoryName} · {trip.tripType} · {trip.paymentMethod}
            </Text>
            <Text style={type.h3}>{formatINR(trip.fare)}</Text>
          </View>
          {trip.notes ? <Text style={type.small}>Note: {trip.notes}</Text> : null}
          {phase === 'driver_en_route' && straightKm != null ? <Text style={type.tiny}>Driver is {formatDistance(straightKm)} from your pickup.</Text> : null}
        </Card>
      ) : null}

      {tracking ? <Button title="Safety centre · SOS" variant="secondary" onPress={() => setShowSafety(true)} /> : null}
      {canCancel ? <Button title="Cancel ride" variant="ghost" onPress={() => setShowCancel(true)} style={{ marginTop: space.sm }} /> : null}

      {phase === 'completed' ? (
        <>
          <Card style={styles.doneCard}>
            <Text style={styles.doneTick}>✓</Text>
            <Text style={[type.h3, { color: colors.success, textAlign: 'center' }]}>You’ve arrived at {trip.drop.name}</Text>
            <Text style={[type.small, { textAlign: 'center' }]}>{formatDateTime(trip.completedAt)}</Text>
          </Card>
          <TripReceipt trip={trip} customerName={profile.name} />
          <RatingCard trip={trip} profile={profile} />
          <Button title="Book again" onPress={() => navigation.navigate('Tabs', { screen: 'Book' })} />
          <Button title="Get help with this trip" variant="ghost" onPress={() => navigation.navigate('Support', { bookingId: trip.bookingId })} />
        </>
      ) : null}

      {phase === 'cancelled' ? (
        <>
          <Card>
            <Text style={type.body}>
              {trip.cancelledBy === 'customer' ? 'You cancelled this ride' : 'This ride was cancelled'}
              {trip.cancelReason ? ` — “${trip.cancelReason}”` : ''}.
            </Text>
            <Text style={[type.small, { marginTop: 4 }]}>
              {trip.cancellationFee > 0 ? `A cancellation fee of ${formatINR(trip.cancellationFee)} applies per our policy.` : 'No cancellation fee was charged.'}
            </Text>
          </Card>
          <Button title="Book another ride" onPress={() => navigation.navigate('Tabs', { screen: 'Book' })} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  etaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.sm, gap: space.sm },
  etaLabel: { fontSize: 11, fontWeight: '800', color: colors.muted, flexShrink: 1 },
  eta: { fontSize: 24, fontWeight: '900', color: colors.primary },
  stale: { fontSize: 12, color: colors.warning },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  plate: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontWeight: '900',
    letterSpacing: 1,
    backgroundColor: '#FEFCE8',
    color: colors.ink,
    fontSize: 12,
  },
  otpBox: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: space.md, marginTop: space.md, backgroundColor: colors.bg },
  otpBoxArrived: { backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.successBorder },
  otp: { fontSize: 28, fontWeight: '900', letterSpacing: 8, color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  action: { flexGrow: 1 },
  place: { flexDirection: 'row', gap: space.md, marginBottom: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  placeName: { fontSize: 14, fontWeight: '800', color: colors.ink },
  summary: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm, marginTop: space.xs },
  doneCard: { alignItems: 'center', backgroundColor: colors.successSoft, borderColor: colors.successBorder },
  doneTick: { fontSize: 32, color: colors.success },
});
