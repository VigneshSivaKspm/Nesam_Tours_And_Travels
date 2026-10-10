// My Trips: Upcoming / Completed / Cancelled, one card per booking.
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCustomerData } from '../context/CustomerData';
import { Button, EmptyState, Notice } from '../components/ui';
import { CancelRideSheet } from '../components/CancelRideSheet';
import type { TripRecord } from '../types';
import { formatDate, formatINR, formatTime } from '../utils/format';
import { paymentLabel, tabOfTrip, tripStatusChip, type TripTab } from '../utils/tripView';
import { colors, radius, space } from '../theme';

const TABS: TripTab[] = ['Upcoming', 'Completed', 'Cancelled'];

export function TripsScreen() {
  const navigation = useNavigation();
  const { trips, tripsLoading, tripsError, retryTrips } = useCustomerData();
  const [tab, setTab] = useState<TripTab>('Upcoming');
  const [cancelTrip, setCancelTrip] = useState<TripRecord | null>(null);

  const shown = useMemo(() => {
    const list = trips.filter((t) => tabOfTrip(t) === tab);
    // Upcoming: soonest pickup first. History: newest first.
    const pickupAt = (t: TripRecord) => (t.scheduledAt ?? t.createdAt)?.getTime() ?? 0;
    const closedAt = (t: TripRecord) => (t.completedAt ?? t.cancelledAt ?? t.createdAt)?.getTime() ?? 0;
    return tab === 'Upcoming' ? list.sort((a, b) => pickupAt(a) - pickupAt(b)) : list.sort((a, b) => closedAt(b) - closedAt(a));
  }, [trips, tab]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <CancelRideSheet key={cancelTrip?.id ?? 'none'} trip={cancelTrip} onClose={() => setCancelTrip(null)} />
      <FlatList
        data={shown}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={retryTrips} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.title} accessibilityRole="header">
              My Trips
            </Text>
            <Text style={styles.subtitle}>Your journeys, organised</Text>
            <View style={styles.tabs} accessibilityRole="tablist">
              {TABS.map((t) => {
                const on = t === tab;
                const count = trips.filter((x) => tabOfTrip(x) === t).length;
                return (
                  <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, on && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${t}, ${count} trips`}>
                    <Text style={[styles.tabText, on && styles.tabTextOn]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
            {tripsError ? <Notice message={tripsError} onRetry={retryTrips} /> : null}
          </View>
        }
        ListEmptyComponent={
          tripsLoading ? (
            <Text style={styles.loading}>Loading your trips…</Text>
          ) : (
            <EmptyState
              title={tab === 'Upcoming' ? 'No upcoming trips' : tab === 'Completed' ? 'No completed trips yet' : 'No cancelled trips'}
              message={tab === 'Upcoming' ? 'Book a ride and it will appear here.' : undefined}
              action={tab === 'Upcoming' ? <Button title="Book a ride" onPress={() => navigation.navigate('Tabs', { screen: 'Book' })} /> : undefined}
            />
          )
        }
        renderItem={({ item: t }) => <TripCard trip={t} onOpen={() => navigation.navigate('ActiveRide', { bookingId: t.id })} onCancel={() => setCancelTrip(t)} />}
      />
    </SafeAreaView>
  );
}

function TripCard({ trip: t, onOpen, onCancel }: { trip: TripRecord; onOpen: () => void; onCancel: () => void }) {
  const tab = tabOfTrip(t);
  const chip = tripStatusChip(t);
  const pay = paymentLabel(t);
  const when = t.scheduledAt ?? t.createdAt;
  const needsRating = t.status === 'Completed' && t.rating == null;
  const cancellable = ['Pending', 'Approved', 'Confirmed'].includes(t.status);
  const total = t.status === 'Completed' ? t.fare + t.tollCharges : t.fare;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{tab === 'Upcoming' ? 'Upcoming trip' : tab === 'Completed' ? 'Recent journey' : 'Cancelled trip'}</Text>
        <Text style={styles.code} numberOfLines={1}>
          {t.bookingId}
        </Text>
      </View>
      <View style={[styles.chip, { backgroundColor: chip.bg }]}>
        <Text style={[styles.chipText, { color: chip.fg }]}>{chip.label}</Text>
      </View>

      <View style={styles.route}>
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <Text style={styles.place} numberOfLines={1}>
            {t.pickup.name}
          </Text>
        </View>
        <View style={styles.connector} />
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text style={styles.place} numberOfLines={1}>
            {t.drop.name}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={22} color={colors.slate} />
        <Text style={styles.meta}>{when ? `${formatDate(when)} · ${formatTime(when)}` : t.date}</Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="car-outline" size={22} color={colors.slate} />
        <Text style={styles.meta} numberOfLines={1}>
          {t.categoryName} · {t.tripType}
          {t.driver ? ` · ${t.driver.name}` : ''}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fare}>{formatINR(total)}</Text>
          <Text style={[styles.payText, pay.tone === 'success' && { color: colors.success, fontWeight: '700' }, pay.tone === 'danger' && { color: colors.primaryDark, fontWeight: '700' }]}>{pay.text}</Text>
        </View>
        <Pressable onPress={onOpen} style={({ pressed }) => [styles.outline, pressed && { backgroundColor: colors.primarySoft }]} accessibilityRole="button" accessibilityLabel={`${tab === 'Completed' ? 'View receipt' : 'View details'} for ${t.bookingId}`}>
          <Text style={styles.outlineText}>{tab === 'Completed' ? (needsRating ? 'Receipt & rate' : 'View receipt') : 'View details'}</Text>
        </Pressable>
      </View>
      {cancellable ? (
        <Text style={styles.cancel} onPress={onCancel} accessibilityRole="button">
          Cancel ride
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  list: { padding: space.lg, paddingBottom: space.xxl },
  title: { fontSize: 32, fontWeight: '900', color: colors.ink },
  subtitle: { fontSize: 18, color: colors.slate, marginTop: 2, marginBottom: space.lg },
  tabs: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  tab: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 16, fontWeight: '600', color: colors.slate },
  tabTextOn: { color: colors.white, fontWeight: '800' },
  loading: { textAlign: 'center', marginTop: space.xl, fontSize: 15, color: colors.slate },
  card: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, padding: space.lg, marginBottom: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  cardTitle: { fontSize: 19, fontWeight: '800', color: colors.navy },
  code: { fontSize: 14, color: colors.slate, flexShrink: 1 },
  chip: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 6, marginTop: space.sm },
  chipText: { fontSize: 15, fontWeight: '700' },
  route: { marginTop: space.md },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 14, height: 14, borderRadius: 7 },
  connector: { width: 0, height: 14, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.faint, marginLeft: 6 },
  place: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  meta: { flex: 1, fontSize: 16, color: colors.slate },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  fare: { fontSize: 26, fontWeight: '900', color: colors.ink },
  payText: { fontSize: 15, color: colors.slate, marginTop: 2 },
  outline: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  cancel: { color: colors.slate, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline', alignSelf: 'flex-start', marginTop: space.md, paddingVertical: 4 },
});
