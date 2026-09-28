// Trip history with filters (port of user/web TripsHistoryScreen.tsx).
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useCustomerData } from '../context/CustomerData';
import { Badge, Button, EmptyState, Notice, Segmented } from '../components/ui';
import { CancelRideSheet } from '../components/CancelRideSheet';
import { isActiveStatus } from '../services/rideService';
import type { TripRecord } from '../types';
import { formatINR } from '../utils/format';
import { colors, radius, space, type } from '../theme';

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

function tone(phase: TripRecord['phase']) {
  if (phase === 'completed') return 'success' as const;
  if (phase === 'cancelled') return 'danger' as const;
  if (phase === 'searching') return 'warning' as const;
  if (phase === 'partner_confirmed') return 'info' as const;
  return 'brand' as const;
}

export function TripsScreen() {
  const navigation = useNavigation();
  const { trips, tripsLoading, tripsError, retryTrips } = useCustomerData();
  const [filter, setFilter] = useState<Filter>('All');
  const [cancelTrip, setCancelTrip] = useState<TripRecord | null>(null);

  const filtered = useMemo(
    () =>
      trips.filter((t) =>
        filter === 'All' ? true : filter === 'Upcoming' ? isActiveStatus(t.status) : filter === 'Completed' ? t.status === 'Completed' : t.status === 'Cancelled',
      ),
    [trips, filter],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <CancelRideSheet key={cancelTrip?.id ?? 'none'} trip={cancelTrip} onClose={() => setCancelTrip(null)} />
      <View style={styles.header}>
        <Text style={type.h1}>My trips</Text>
        <Text style={type.small}>Track active rides, view receipts and rate past trips</Text>
        <View style={{ height: space.md }} />
        <Segmented
          options={(['All', 'Upcoming', 'Completed', 'Cancelled'] as Filter[]).map((f) => ({ value: f, label: f }))}
          value={filter}
          onChange={setFilter}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: space.lg, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={retryTrips} colors={[colors.primary]} />}
        ListHeaderComponent={tripsError ? <Notice message={tripsError} onRetry={retryTrips} /> : null}
        ListEmptyComponent={
          tripsLoading ? (
            <Text style={[type.small, { textAlign: 'center', marginTop: space.xl }]}>Loading your trips…</Text>
          ) : (
            <EmptyState
              title={`No ${filter === 'All' ? '' : `${filter.toLowerCase()} `}trips yet`}
              message="Your rides will appear here."
              action={<Button title="Book a ride" onPress={() => navigation.navigate('Tabs', { screen: 'Book' })} />}
            />
          )
        }
        renderItem={({ item: t }) => {
          const needsRating = t.status === 'Completed' && t.rating == null;
          return (
            <View style={styles.card}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={type.tiny}>{t.bookingId}</Text>
                  <Text style={styles.date}>
                    {t.date}
                    {t.time && t.time !== 'Now' ? ` · ${t.time}` : ''}
                  </Text>
                </View>
                <Badge label={PHASE_LABEL[t.phase]} tone={tone(t.phase)} />
              </View>
              <View style={styles.place}>
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
                <Text style={styles.placeText} numberOfLines={1}>
                  {t.pickup.name}
                </Text>
              </View>
              <View style={styles.place}>
                <View style={[styles.dot, { backgroundColor: colors.primary, borderRadius: 2 }]} />
                <Text style={styles.placeText} numberOfLines={1}>
                  {t.drop.name}
                </Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={[type.small, { flex: 1 }]} numberOfLines={1}>
                  {t.categoryName}
                  {t.driver ? ` · ${t.driver.name}` : ''}
                </Text>
                <Text style={type.h3}>{formatINR(t.fare + t.tollCharges)}</Text>
              </View>
              <View style={styles.actions}>
                <Button
                  small
                  variant="dark"
                  title={isActiveStatus(t.status) ? 'Track ride' : needsRating ? 'Receipt & rate' : 'View details'}
                  onPress={() => navigation.navigate('ActiveRide', { bookingId: t.id })}
                  style={{ flex: 1 }}
                />
                {['Pending', 'Confirmed'].includes(t.status) ? <Button small variant="secondary" title="Cancel" onPress={() => setCancelTrip(t)} /> : null}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { padding: space.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, marginBottom: space.md },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: space.sm },
  date: { fontSize: 13, fontWeight: '800', color: colors.ink },
  place: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  placeText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  fareRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md, marginTop: space.sm, gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
});
