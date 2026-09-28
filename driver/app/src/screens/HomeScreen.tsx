// Dashboard + marketplace (native port of driver/web DashboardScreen.tsx and
// the accept/presence handlers of DriverWorkspace.tsx).
import React, { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverData } from '../context/DriverData';
import { Avatar, Badge, Button, Card, EmptyState, Notice, Sheet } from '../components/ui';
import { acceptMarketplaceTrip, DriverActionError, setDriverPresence } from '../services/driverService';
import type { DriverStatus, MarketplaceOffer } from '../types/driver';
import { categoryMatches } from '../utils/earnings';
import { formatINR } from '../utils/format';
import { describeError } from '../utils/retry';
import { EMERGENCY_NUMBER, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { colors, radius, space, type } from '../theme';

export function HomeScreen() {
  const navigation = useNavigation();
  const { account, activeTrip, offers, offersError, earnings, unreadCount, bookingsError } = useDriverData();
  const { driver, vehicle } = account;
  const status: DriverStatus = driver.presenceStatus;
  const isOnline = status === 'Online' || status === 'On Trip';
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [sos, setSos] = useState(false);

  const matching = useMemo(() => offers.filter((o) => categoryMatches(o.vehicleCategory, vehicle.vehicleType)), [offers, vehicle.vehicleType]);
  const visible = showAll ? offers : matching;

  const changePresence = async (next: DriverStatus) => {
    if (activeTrip) {
      setMessage({ tone: 'error', text: 'Finish your current trip before changing your duty status.' });
      return;
    }
    setPresenceBusy(true);
    setMessage(null);
    try {
      await setDriverPresence(driver.id, next);
    } catch (e) {
      setMessage({ tone: 'error', text: describeError(e, 'Could not update your status.') });
    } finally {
      setPresenceBusy(false);
    }
  };

  const accept = (offer: MarketplaceOffer) => {
    if (activeTrip) {
      setMessage({ tone: 'error', text: 'You already have an active trip.' });
      return;
    }
    const mismatch = !categoryMatches(offer.vehicleCategory, vehicle.vehicleType);
    Alert.alert(
      'Accept this trip?',
      `${offer.pickup.address} → ${offer.drop.address}\nYour payout: ${formatINR(offer.offeredPayout)}${
        mismatch ? `\n\nBooked as ${offer.vehicleCategory}. Accept only if your ${vehicle.vehicleType} qualifies.` : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept trip',
          onPress: () => {
            setAcceptingId(offer.id);
            setMessage(null);
            acceptMarketplaceTrip(driver, vehicle.vehicleNumber, offer)
              .then(() => {
                setMessage({ tone: 'success', text: 'Trip accepted! Complete the pre-trip check before heading to pickup.' });
                navigation.navigate('PreTrip', { bookingId: offer.id });
              })
              .catch((e: unknown) =>
                setMessage({ tone: 'error', text: e instanceof DriverActionError ? e.message : describeError(e, 'This trip is no longer available.') }),
              )
              .finally(() => setAcceptingId(null));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Sheet visible={sos} onClose={() => setSos(false)} title="Emergency SOS">
        <Text style={[type.small, { marginBottom: space.md }]}>24×7 driver control and police help.</Text>
        <Button title={`Call police emergency (${EMERGENCY_NUMBER})`} variant="danger" onPress={() => void Linking.openURL(`tel:${EMERGENCY_NUMBER}`)} />
        <Button title={`Call NESAM control room (${SUPPORT_PHONE_DISPLAY})`} variant="secondary" onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} style={{ marginTop: space.sm }} />
      </Sheet>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={() => setMessage(null)} colors={[colors.primary]} />}>
        <View style={styles.topBar}>
          <Text style={type.h1}>Dashboard</Text>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Pressable onPress={() => setSos(true)} accessibilityRole="button" accessibilityLabel="Emergency SOS" hitSlop={8}>
              <Ionicons name="warning" size={24} color={colors.danger} />
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Notifications')} accessibilityRole="button" accessibilityLabel={`Notifications, ${unreadCount} unread`} hitSlop={8}>
              <Ionicons name="notifications-outline" size={24} color={colors.ink} />
              {unreadCount > 0 ? <View style={styles.dot} /> : null}
            </Pressable>
          </View>
        </View>

        <Card>
          <View style={styles.profileRow}>
            <Avatar name={driver.name} photoUrl={driver.photoUrl} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={type.h2} numberOfLines={1}>
                {driver.name}
              </Text>
              <Text style={type.small} numberOfLines={1}>
                {vehicle.make} {vehicle.model} • {vehicle.vehicleNumber} • {vehicle.vehicleType}
              </Text>
              <Text style={type.small}>
                ★ {driver.rating.toFixed(1)} · {earnings.totalTripsCompleted} trips{driver.vendorName ? ` · ${driver.vendorName}` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.dutyRow}>
            <Text style={type.label}>Duty status</Text>
            <Badge label={status} tone={status === 'Online' ? 'success' : status === 'On Trip' ? 'brand' : 'neutral'} />
          </View>
          <View style={styles.toggle}>
            {(['Offline', 'Online'] as DriverStatus[]).map((st) => {
              const active = status === st || (st === 'Online' && status === 'On Trip');
              return (
                <Pressable
                  key={st}
                  disabled={presenceBusy || active || !!activeTrip}
                  onPress={() => void changePresence(st)}
                  style={[styles.toggleBtn, active && (st === 'Online' ? styles.online : styles.offline)]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: presenceBusy || !!activeTrip }}
                >
                  <Text style={[styles.toggleText, active && { color: colors.white }]}>{st === 'Online' ? 'Go Online' : 'Go Offline'}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {message ? <Notice tone={message.tone} message={message.text} /> : null}
        <Notice message={bookingsError} />
        {driver.docStatus === 'Rejected' ? (
          <Notice
            message={`Document update required: ${driver.rejectionReason || 'Some updated documents were not accepted. Please upload them again.'}`}
            onRetry={() => navigation.navigate('UpdateDocuments')}
          />
        ) : null}

        <View style={styles.stats}>
          <Stat label="Today" value={formatINR(earnings.todayEarnings)} accent />
          <Stat label="Last 7 days" value={formatINR(earnings.thisWeekEarnings)} />
          <Stat label="Trips" value={String(earnings.totalTripsCompleted)} />
          <Stat label="Rating" value={`★ ${driver.rating.toFixed(1)}`} />
        </View>

        {activeTrip ? (
          <Card style={styles.activeCard}>
            <View style={styles.activeHead}>
              <Text style={type.h3}>Current trip</Text>
              <Badge label={activeTrip.stage} tone="brand" />
            </View>
            <Text style={type.small}>{activeTrip.bookingId}</Text>
            <Text style={[type.body, { marginTop: space.sm }]} numberOfLines={2}>
              <Text style={{ fontWeight: '800' }}>Pickup: </Text>
              {activeTrip.pickup.address}
            </Text>
            <Text style={type.body} numberOfLines={2}>
              <Text style={{ fontWeight: '800' }}>Drop: </Text>
              {activeTrip.drop.address}
            </Text>
            <Text style={styles.payout}>Your payout {formatINR(activeTrip.driverEarnings)}</Text>
            {activeTrip.stage === 'Assigned' ? (
              <Button title="Start pre-trip check" onPress={() => navigation.navigate('PreTrip', { bookingId: activeTrip.id })} />
            ) : (
              <Button title="Open trip" variant="dark" onPress={() => navigation.navigate('Tabs', { screen: 'Trip' })} />
            )}
          </Card>
        ) : null}

        <View style={styles.marketHead}>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>Available trips</Text>
            <Text style={type.small}>{showAll ? 'All open trips' : `Trips for ${vehicle.vehicleType} vehicles`}</Text>
          </View>
          {isOnline && !activeTrip ? <Button small variant="ghost" title={showAll ? 'My category' : `Show all (${offers.length})`} onPress={() => setShowAll((s) => !s)} /> : null}
        </View>
        <Notice message={offersError} />

        {!isOnline ? (
          <EmptyState title="You are offline" message="Go online to see and accept trips." action={<Button title="Go online now" variant="success" loading={presenceBusy} onPress={() => void changePresence('Online')} />} />
        ) : activeTrip ? (
          <EmptyState title="Finish your current trip" message="New trips appear here once you complete it." />
        ) : visible.length === 0 ? (
          <EmptyState title="No open trips right now" message="New bookings appear here instantly — stay online." />
        ) : (
          visible.map((offer) => {
            const mismatch = !categoryMatches(offer.vehicleCategory, vehicle.vehicleType);
            return (
              <Card key={offer.id}>
                <View style={styles.offerHead}>
                  <Text style={type.tiny}>{offer.bookingId}</Text>
                  <Badge label={offer.vehicleCategory || 'Any vehicle'} tone={mismatch ? 'warning' : 'success'} />
                </View>
                <View style={styles.place}>
                  <View style={[styles.pdot, { backgroundColor: colors.success }]} />
                  <Text style={[type.body, { flex: 1 }]}>{offer.pickup.address}</Text>
                </View>
                <View style={styles.place}>
                  <View style={[styles.pdot, { backgroundColor: colors.primary }]} />
                  <Text style={[type.body, { flex: 1 }]}>{offer.drop.address}</Text>
                </View>
                <Text style={type.small}>
                  {offer.travelDate || 'Date TBC'}
                  {offer.pickupTime ? ` • ${offer.pickupTime}` : ''}
                  {offer.distanceKm > 0 ? ` • ${offer.distanceKm} km` : ''}
                </Text>
                <View style={styles.offerFoot}>
                  <View>
                    <Text style={type.tiny}>YOUR PAYOUT</Text>
                    <Text style={styles.offerPayout}>{formatINR(offer.offeredPayout)}</Text>
                  </View>
                  <Button small title={acceptingId === offer.id ? 'Accepting…' : 'Accept trip'} loading={acceptingId === offer.id} disabled={acceptingId !== null} onPress={() => accept(offer)} />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={type.tiny}>{label.toUpperCase()}</Text>
      <Text style={[styles.statValue, accent && { color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  dot: { position: 'absolute', top: 0, right: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dutyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.lg, marginBottom: space.sm },
  toggle: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.md, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, minHeight: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  online: { backgroundColor: colors.success },
  offline: { backgroundColor: '#4B5563' },
  toggleText: { fontWeight: '800', color: colors.muted },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md },
  statValue: { fontSize: 20, fontWeight: '900', color: colors.ink, marginTop: 4 },
  activeCard: { borderColor: colors.primary, borderWidth: 2 },
  activeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payout: { fontSize: 18, fontWeight: '900', color: colors.primary, marginVertical: space.sm },
  marketHead: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm, marginBottom: space.sm },
  offerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  place: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: 4 },
  pdot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  offerFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  offerPayout: { fontSize: 20, fontWeight: '900', color: colors.primary },
});
