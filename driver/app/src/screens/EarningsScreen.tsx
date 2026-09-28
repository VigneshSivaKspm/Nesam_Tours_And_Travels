// Earnings summary, 7-day chart and completed trips (port of driver/web
// EarningsScreen.tsx; the recharts bar chart becomes plain native bars).
import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDriverData } from '../context/DriverData';
import { Card, EmptyState } from '../components/ui';
import { last7Days, tripTotal } from '../utils/earnings';
import { formatINR } from '../utils/format';
import { colors, radius, space, type } from '../theme';

export function EarningsScreen() {
  const { earnings, completedTrips } = useDriverData();
  const days = useMemo(() => last7Days(completedTrips), [completedTrips]);
  const max = Math.max(1, ...days.map((d) => d.amount));
  const weekAvg = Math.round(days.reduce((s, d) => s + d.amount, 0) / 7);

  const header = (
    <View>
      <Text style={type.h1}>Earnings</Text>
      <Text style={[type.small, { marginBottom: space.md }]}>Payout per trip is shown before you accept it. Toll and parking receipts are reimbursed in full.</Text>
      <View style={styles.grid}>
        {[
          { label: 'Today', value: earnings.todayEarnings, color: colors.primary },
          { label: 'Last 7 days', value: earnings.thisWeekEarnings, color: colors.ink },
          { label: 'This month', value: earnings.thisMonthEarnings, color: colors.ink },
          { label: 'Lifetime', value: earnings.lifetimeEarnings, color: colors.success },
        ].map((c) => (
          <View key={c.label} style={styles.stat}>
            <Text style={type.tiny}>{c.label.toUpperCase()}</Text>
            <Text style={[styles.statValue, { color: c.color }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatINR(c.value)}
            </Text>
          </View>
        ))}
      </View>
      <Card>
        <View style={styles.chartHead}>
          <Text style={type.h3}>Last 7 days</Text>
          <Text style={type.small}>Avg {formatINR(weekAvg)} / day</Text>
        </View>
        <View style={styles.chart} accessibilityLabel={`Earnings last 7 days: ${days.map((d) => `${d.label} ${formatINR(d.amount)}`).join(', ')}`}>
          {days.map((d) => (
            <View key={d.key} style={styles.barCol}>
              <Text style={styles.barValue} numberOfLines={1}>
                {d.amount ? formatINR(d.amount) : ''}
              </Text>
              <View style={[styles.bar, { height: Math.max(3, (d.amount / max) * 120) }]} />
              <Text style={type.tiny}>{d.label}</Text>
            </View>
          ))}
        </View>
      </Card>
      <View style={styles.listHead}>
        <Text style={type.h3}>Completed trips</Text>
        <Text style={type.small}>
          {earnings.totalTripsCompleted} trips · tolls {formatINR(earnings.tollReimbursements)}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <FlatList
        data={completedTrips}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState title="No completed trips yet" message="Earnings from finished trips appear here." />}
        renderItem={({ item: t }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.code}>{t.bookingId}</Text>
              <Text style={type.small} numberOfLines={1}>
                {t.pickup.address} → {t.drop.address}
              </Text>
              <Text style={type.tiny}>{t.completedAt?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) ?? t.scheduledDate}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.total}>{formatINR(tripTotal(t))}</Text>
              {t.tollCharges ? <Text style={type.tiny}>incl. {formatINR(t.tollCharges)} tolls</Text> : null}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md },
  statValue: { fontSize: 20, fontWeight: '900', marginTop: 4 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 170, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '70%', backgroundColor: colors.primary, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barValue: { fontSize: 8, color: colors.muted },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm, marginBottom: space.sm },
  row: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    marginBottom: space.sm,
  },
  code: { fontSize: 13, fontWeight: '800', color: colors.ink },
  total: { fontSize: 16, fontWeight: '900', color: colors.primary },
});
