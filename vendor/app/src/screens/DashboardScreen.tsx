// Fleet overview (native port of vendor/web DashboardScreen.tsx, driven by
// live data instead of the Web's static counters).
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useVendorData } from '../context/VendorData';
import { Badge, Card, EmptyState, Notice } from '../components/ui';
import { daysUntil } from '../utils/wallet';
import { EXPIRY_WARNING_DAYS } from '../config/constants';
import { formatINR } from '../utils/format';
import { colors, radius, space, type } from '../theme';

export function DashboardScreen() {
  const navigation = useNavigation();
  const { profile, vehicles, drivers, activeBookings, awaitingDispatch, marketTrips, wallet, errors } = useVendorData();

  const expiring = useMemo(
    () =>
      vehicles.flatMap((v) =>
        (
          [
            ['Insurance', v.insuranceExpiry],
            ['Permit', v.permitExpiry],
            ['Fitness', v.fitnessExpiry],
          ] as const
        )
          .map(([label, date]) => ({ label, date, days: daysUntil(date) }))
          .filter((x) => x.days != null && x.days <= EXPIRY_WARNING_DAYS)
          .map((x) => ({ ...x, vehicle: v.vehicleNumber })),
      ),
    [vehicles],
  );
  const approvedDrivers = drivers.filter((d) => d.approvalStatus === 'Approved').length;
  const onlineDrivers = drivers.filter((d) => d.presenceStatus === 'Online').length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.tiny}>NESAM FLEET PARTNER</Text>
        <Text style={type.h1} numberOfLines={1}>
          {profile.companyName}
        </Text>
        <Text style={[type.small, { marginBottom: space.md }]}>{profile.contactPerson ? `Hello, ${profile.contactPerson.split(' ')[0]}` : 'Welcome back'}</Text>

        <Notice message={errors.bookings} />
        {awaitingDispatch.length ? (
          <Notice tone="warning" message={`${awaitingDispatch.length} trip(s) waiting for a driver. Dispatch now so the customer isn’t kept waiting.`} onRetry={() => navigation.navigate('Tabs', { screen: 'Trips' })} />
        ) : null}
        {expiring.length ? (
          <Notice tone="warning" message={`${expiring.length} vehicle document(s) expired or expiring within ${EXPIRY_WARNING_DAYS} days.`} onRetry={() => navigation.navigate('Documents')} />
        ) : null}

        <View style={styles.grid}>
          <Stat label="Available balance" value={formatINR(wallet.available)} accent onPress={() => navigation.navigate('Wallet')} />
          <Stat label="This month (net)" value={formatINR(wallet.monthNet)} />
          <Stat label="Active trips" value={String(activeBookings.length)} onPress={() => navigation.navigate('Tabs', { screen: 'Trips' })} />
          <Stat label="Open marketplace" value={String(marketTrips.length)} onPress={() => navigation.navigate('Tabs', { screen: 'Market' })} />
          <Stat label="Vehicles" value={`${vehicles.filter((v) => v.status === 'Active').length}/${vehicles.length}`} onPress={() => navigation.navigate('Tabs', { screen: 'Fleet' })} />
          <Stat label="Drivers (online)" value={`${approvedDrivers} (${onlineDrivers})`} onPress={() => navigation.navigate('Drivers')} />
        </View>

        <Text style={[type.h3, styles.section]}>Quick actions</Text>
        <View style={styles.actions}>
          <Action icon="pricetags-outline" label="Find trips" onPress={() => navigation.navigate('Tabs', { screen: 'Market' })} />
          <Action icon="navigate-outline" label="Dispatch" onPress={() => navigation.navigate('Tabs', { screen: 'Trips' })} />
          <Action icon="car-outline" label="Add vehicle" onPress={() => navigation.navigate('Tabs', { screen: 'Fleet' })} />
          <Action icon="person-add-outline" label="Invite driver" onPress={() => navigation.navigate('Drivers')} />
          <Action icon="wallet-outline" label="Payout" onPress={() => navigation.navigate('Wallet')} />
          <Action icon="document-text-outline" label="Documents" onPress={() => navigation.navigate('Documents')} />
        </View>

        <Text style={[type.h3, styles.section]}>Active trips</Text>
        {activeBookings.length === 0 ? (
          <EmptyState title="No active trips" message="Trips you accept from the marketplace or that NESAM awards you appear here." />
        ) : (
          activeBookings.slice(0, 5).map((b) => (
            <Card key={b.id}>
              <View style={styles.row}>
                <Text style={type.tiny}>{b.bookingId}</Text>
                <Badge label={b.status === 'Confirmed' || !b.driverId ? 'Needs driver' : b.tripStage || b.status} tone={b.status === 'Confirmed' || !b.driverId ? 'warning' : 'brand'} />
              </View>
              <Text style={type.body} numberOfLines={1}>
                {b.pickupAddress} → {b.dropAddress}
              </Text>
              <Text style={type.small}>
                {b.date} {b.time} {b.driverName ? `· ${b.driverName}` : ''}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.action} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value, accent, onPress }: { label: string; value: string; accent?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={styles.stat} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
      <Text style={type.tiny}>{label.toUpperCase()}</Text>
      <Text style={[styles.statValue, accent && { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md },
  statValue: { fontSize: 20, fontWeight: '900', color: colors.ink, marginTop: 4 },
  section: { marginTop: space.lg, marginBottom: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  action: { flexBasis: '31%', flexGrow: 1, alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: space.md },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
});
