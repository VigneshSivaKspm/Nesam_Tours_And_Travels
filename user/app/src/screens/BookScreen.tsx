// Booking home — step 1 of 3: trip type, pickup, destination and when.
// "Find a Cab" opens Choose your ride; pricing and booking happen in the next
// steps (ChooseRideScreen, ConfirmBookingScreen) from the shared BookingDraft.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Notice, Screen } from '../components/ui';
import { BrandHeader, IconButton, SupportBanner } from '../components/brand';
import { PlaceSearchModal } from '../components/PlaceSearchModal';
import { useCustomerData } from '../context/CustomerData';
import { useBookingDraft } from '../context/BookingDraft';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { LOCATION_ERROR_TEXT, reverseGeocode } from '../services/geoService';
import { SCHEDULE_MAX_DAYS, SCHEDULE_MIN_LEAD_MIN, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { scheduleProblem } from '../utils/bookingRules';
import type { GeoPlace, LatLng, LocationItem } from '../types';
import { formatDate, formatTime } from '../utils/format';
import { haversineKm, isValidLatLng } from '../utils/geo';
import { colors, radius, space } from '../theme';

type PickerTarget = { field: 'pickup' | 'drop'; query?: string } | null;

export function BookScreen() {
  const navigation = useNavigation();
  const { profile, trips, liveRide, savedPlaces } = useCustomerData();
  const { draft, update } = useBookingDraft();
  const { pickup, drop, tripType, scheduledAt } = draft;
  const { position, error: locError, permission, locating, locate } = useDeviceLocation(true);
  const { online } = useNetworkStatus();
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [problem, setProblem] = useState('');

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
      // Never replaces a pickup the rider chose while the address was loading.
      if (mounted.current) update((d) => (d.pickup ? {} : { pickup: { ...p, type: 'current' } }));
    });
  }, [position, pickup, update]);

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

  const locateMe = async () => {
    const p = await locate();
    if (!p) return;
    const place = await reverseGeocode(p);
    if (mounted.current) {
      pickupFromGps.current = true;
      update({ pickup: { ...place, type: 'current' } });
    }
  };

  const openSchedulePicker = () => {
    const min = new Date(Date.now() + SCHEDULE_MIN_LEAD_MIN * 60000);
    const max = new Date(Date.now() + SCHEDULE_MAX_DAYS * 86400000);
    const initial = scheduledAt ?? new Date(Date.now() + 60 * 60000);
    try {
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
              update({ scheduledAt: d });
              setProblem(scheduleProblem(d));
            },
          });
        },
      });
    } catch {
      setProblem('The date picker is not available on this device.');
    }
  };

  const callForRental = () =>
    Alert.alert('Local rental', `Hourly local rentals are booked through NESAM support. Call ${SUPPORT_PHONE_DISPLAY}?`, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Call', onPress: () => void Linking.openURL(`tel:${SUPPORT_PHONE}`) },
    ]);

  const findCab = () => {
    const reason = !online
      ? 'You’re offline. Reconnect to book a ride.'
      : liveRide
        ? 'You already have a ride in progress. Open it from the banner above.'
        : !pickup
          ? 'Set your pickup point.'
          : !drop
            ? 'Where are you going? Set the destination.'
            : haversineKm(pickup, drop) < 0.2
              ? 'Pickup and destination are too close together.'
              : scheduleProblem(scheduledAt);
    setProblem(reason);
    if (!reason) navigation.navigate('ChooseRide');
  };

  const home = savedPlaces.find((p) => p.type === 'home');
  const work = savedPlaces.find((p) => p.type === 'work');
  const goToSaved = (p: LocationItem | undefined) => {
    if (p && isValidLatLng(p as Partial<LatLng>)) {
      update({ drop: p as GeoPlace });
      setProblem('');
    } else navigation.navigate('SavedPlaces');
  };
  const airport = pickup?.type === 'airport' || drop?.type === 'airport';
  const locationHint = locError ? LOCATION_ERROR_TEXT[locError.kind] : permission === 'prompt' && !position ? 'Allow location access to set your pickup automatically.' : '';
  const firstName = profile.name.split(' ')[0] || 'there';

  return (
    <Screen bg={colors.page}>
      <PlaceSearchModal
        visible={picker !== null}
        title={picker?.field === 'pickup' ? 'Set pickup' : 'Where to?'}
        initialQuery={picker?.query}
        onClose={() => setPicker(null)}
        onSelect={(p) => {
          if (picker?.field === 'pickup') {
            pickupFromGps.current = true;
            update({ pickup: p });
          } else update({ drop: p });
          setProblem('');
        }}
        savedPlaces={savedPlaces}
        recentPlaces={recentPlaces}
        near={picker?.field === 'drop' ? (pickup ?? position) : position}
        onUseCurrentLocation={picker?.field === 'pickup' ? () => void locateMe() : undefined}
      />

      <BrandHeader right={<IconButton icon="headset-outline" label="Help and support" onPress={() => navigation.navigate('Support')} />} />
      <Text style={styles.welcome}>Welcome, {firstName}</Text>
      <Text style={styles.headline} accessibilityRole="header">
        Plan your next journey
      </Text>

      {liveRide ? (
        <Pressable style={styles.liveBanner} onPress={() => navigation.navigate('ActiveRide', { bookingId: liveRide.id })} accessibilityRole="button">
          <Ionicons name="navigate" size={18} color={colors.white} />
          <Text style={styles.liveText} numberOfLines={1}>
            Ride in progress · {liveRide.drop.name}
          </Text>
          <Text style={styles.liveText}>View →</Text>
        </Pressable>
      ) : null}

      <View style={styles.tiles} accessibilityRole="radiogroup">
        <Tile icon="car" label="One Way" active={tripType === 'One Way'} onPress={() => update({ tripType: 'One Way' })} />
        <Tile icon="sync" label="Round Trip" active={tripType === 'Round Trip'} onPress={() => update({ tripType: 'Round Trip' })} />
        <Tile icon="time-outline" label="Local Rental" hint="Call to book" onPress={callForRental} />
        <Tile icon="airplane" label="Airport" hint={airport ? 'Airport trip' : undefined} active={airport} onPress={() => setPicker({ field: 'drop', query: 'airport' })} />
      </View>

      <View style={styles.routeCard}>
        <View style={styles.placeRow}>
          <View style={styles.dotCol}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <View style={styles.dash} />
          </View>
          <Pressable style={{ flex: 1 }} onPress={() => setPicker({ field: 'pickup' })} accessibilityRole="button" accessibilityLabel={`Pickup: ${pickup?.name ?? 'not set'}`}>
            <Text style={styles.placeLabel}>PICKUP</Text>
            <Text style={styles.placeName} numberOfLines={1}>
              {pickup?.name ?? (locating ? 'Finding your location…' : 'Set pickup location')}
            </Text>
            {pickup && pickup.address !== pickup.name ? (
              <Text style={styles.placeAddr} numberOfLines={1}>
                {pickup.address}
              </Text>
            ) : null}
          </Pressable>
          <Pressable onPress={() => void locateMe()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Use my current location" style={styles.pinBtn}>
            <Ionicons name="locate-outline" size={24} color={colors.slate} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => pickup && drop && update({ pickup: drop, drop: pickup })}
          disabled={!pickup || !drop}
          style={[styles.swap, (!pickup || !drop) && { opacity: 0.4 }]}
          accessibilityRole="button"
          accessibilityLabel="Swap pickup and destination"
        >
          <Ionicons name="swap-vertical" size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.placeRow}>
          <View style={styles.dotCol}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          </View>
          <Pressable style={{ flex: 1 }} onPress={() => setPicker({ field: 'drop' })} accessibilityRole="button" accessibilityLabel={`Destination: ${drop?.name ?? 'not set'}`}>
            <Text style={styles.placeLabel}>DESTINATION</Text>
            <Text style={[styles.placeName, !drop && { color: colors.slate }]} numberOfLines={1}>
              {drop?.name ?? 'Where to?'}
            </Text>
            {drop && drop.address !== drop.name ? (
              <Text style={styles.placeAddr} numberOfLines={1}>
                {drop.address}
              </Text>
            ) : null}
          </Pressable>
          {drop ? (
            <Pressable onPress={() => update({ drop: null })} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear destination" style={styles.pinBtn}>
              <Ionicons name="close-circle" size={24} color={colors.faint} />
            </Pressable>
          ) : (
            <Pressable onPress={() => setPicker({ field: 'drop' })} hitSlop={10} accessibilityRole="button" accessibilityLabel="Search destination" style={styles.pinBtn}>
              <Ionicons name="location-outline" size={24} color={colors.slate} />
            </Pressable>
          )}
        </View>

        <View style={styles.whenRow}>
          <Pressable style={styles.whenBox} onPress={openSchedulePicker} accessibilityRole="button" accessibilityLabel={`Pickup date: ${scheduledAt ? formatDate(scheduledAt) : 'today'}. Change`}>
            <Ionicons name="calendar-outline" size={26} color={colors.ink} />
            <View>
              <Text style={styles.whenLabel}>Date</Text>
              <Text style={styles.whenValue}>{scheduledAt ? formatDate(scheduledAt) : 'Today'}</Text>
            </View>
          </Pressable>
          <Pressable style={styles.whenBox} onPress={openSchedulePicker} accessibilityRole="button" accessibilityLabel={`Pickup time: ${scheduledAt ? formatTime(scheduledAt) : 'now'}. Change`}>
            <Ionicons name="time-outline" size={26} color={colors.ink} />
            <View>
              <Text style={styles.whenLabel}>Time</Text>
              <Text style={styles.whenValue}>{scheduledAt ? formatTime(scheduledAt) : 'Now'}</Text>
            </View>
          </Pressable>
        </View>
        {scheduledAt ? (
          <Text
            style={styles.rideNow}
            onPress={() => {
              update({ scheduledAt: null });
              setProblem('');
            }}
            accessibilityRole="button"
          >
            Ride now instead
          </Text>
        ) : null}

        {problem ? <Notice message={problem} style={{ marginTop: space.md, marginBottom: 0 }} /> : null}
        <Pressable onPress={findCab} style={({ pressed }) => [styles.findBtn, pressed && { backgroundColor: colors.primaryDark }]} accessibilityRole="button">
          <Text style={styles.findText}>Find a Cab</Text>
          <Ionicons name="arrow-forward" size={24} color={colors.white} />
        </Pressable>
      </View>

      {locationHint && !pickup ? <Notice tone="warning" message={locationHint} style={{ marginTop: space.md }} /> : null}

      <View style={styles.savedHead}>
        <Text style={styles.sectionTitle}>Saved places</Text>
        <Text style={styles.viewAll} onPress={() => navigation.navigate('SavedPlaces')} accessibilityRole="link">
          View all
        </Text>
      </View>
      <View style={styles.savedRow}>
        <SavedCard icon="home-outline" label="Home" place={home} onPress={() => goToSaved(home)} />
        <SavedCard icon="briefcase-outline" label="Office" place={work} onPress={() => goToSaved(work)} />
      </View>

      <SupportBanner />
    </Screen>
  );
}

function Tile({ icon, label, hint, active, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; hint?: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, active && styles.tileOn, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
    >
      <Ionicons name={icon} size={30} color={active ? colors.primary : colors.ink} />
      <Text style={[styles.tileText, active && { color: colors.primary }]}>{label}</Text>
      {hint ? <Text style={[styles.tileHint, active && { color: colors.primary }]}>{hint}</Text> : null}
    </Pressable>
  );
}

function SavedCard({ icon, label, place, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; place?: LocationItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.saved, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={place ? `Go to ${label}: ${place.name}` : `Add ${label} address`}>
      <Ionicons name={icon} size={28} color={colors.ink} />
      <View style={{ flex: 1 }}>
        <Text style={styles.savedLabel}>{label}</Text>
        <Text style={styles.savedSub} numberOfLines={1}>
          {place ? (place.name && place.name.toLowerCase() !== label.toLowerCase() ? place.name : place.address) : 'Add address'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.slate} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  welcome: { fontSize: 18, color: colors.slate },
  headline: { fontSize: 28, fontWeight: '900', color: colors.ink, marginBottom: space.lg },
  liveBanner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.ink, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  liveText: { color: colors.white, fontWeight: '700', fontSize: 14, flexShrink: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.md },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: space.md,
  },
  tileOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  tileText: { fontSize: 17, fontWeight: '700', color: colors.ink },
  tileHint: { fontSize: 12, color: colors.slate, fontWeight: '600' },
  routeCard: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, padding: space.lg },
  placeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: 64 },
  dotCol: { width: 18, alignItems: 'center', paddingTop: 26 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  dash: { width: 0, flex: 1, minHeight: 44, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.faint, marginTop: 6 },
  placeLabel: { fontSize: 13, color: colors.slate, fontWeight: '600', letterSpacing: 0.5 },
  placeName: { fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: 2 },
  placeAddr: { fontSize: 13, color: colors.slate, marginTop: 2 },
  pinBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  swap: {
    alignSelf: 'flex-end',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -8,
    zIndex: 1,
  },
  whenRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  whenBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: space.md },
  whenLabel: { fontSize: 13, color: colors.slate },
  whenValue: { fontSize: 18, fontWeight: '800', color: colors.ink },
  rideNow: { color: colors.primary, fontWeight: '700', fontSize: 14, marginTop: space.sm, alignSelf: 'flex-end', paddingVertical: 4 },
  findBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 58,
    marginTop: space.lg,
  },
  findText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  savedHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xl, marginBottom: space.md },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  viewAll: { fontSize: 15, color: colors.slate, fontWeight: '600', padding: 4 },
  savedRow: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
  saved: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: space.md,
    minHeight: 76,
  },
  savedLabel: { fontSize: 17, fontWeight: '700', color: colors.ink },
  savedSub: { fontSize: 13, color: colors.slate, marginTop: 2 },
});
