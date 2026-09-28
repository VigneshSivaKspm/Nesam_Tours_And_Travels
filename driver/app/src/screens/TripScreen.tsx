// Live trip execution (native port of driver/web TripExecutionScreen.tsx):
// to pickup → at pickup (boarding OTP) → on trip → end trip (odometer, tolls).
import React, { useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDriverData } from '../context/DriverData';
import { Badge, Button, Card, EmptyState, Notice, Row, Sheet, TextField } from '../components/ui';
import { PhotoField } from '../components/forms';
import {
  completeTrip,
  DriverActionError,
  markArrivedDestination,
  markReachedPickup,
  saveTripTolls,
  startTripWithOtp,
  tollTotal,
} from '../services/driverService';
import { getCurrentPosition, LocationError } from '../services/locationService';
import type { TollReceipt, TripDetails, TripStage } from '../types/driver';
import { formatINR, formatPhone, localMobile } from '../utils/format';
import { haversineKm } from '../utils/geo';
import { describeError } from '../utils/retry';
import { PICKUP_RADIUS_KM } from '../config/constants';
import { colors, radius, space, type } from '../theme';

const STAGE_ORDER: TripStage[] = ['En Route Pickup', 'Reached Pickup', 'In Progress', 'Arrived Destination'];
const STAGE_LABELS = ['To pickup', 'At pickup', 'On trip', 'End trip'];

export function mapsDirections(loc: TripDetails['pickup']): string {
  return loc.lat != null && loc.lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc.address)}`;
}

export function TripScreen() {
  const navigation = useNavigation();
  const { activeTrip } = useDriverData();

  if (!activeTrip) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.content}>
          <EmptyState title="No active trip" message="Go online and accept a trip from the dashboard." action={<Button title="Go to dashboard" onPress={() => navigation.navigate('Tabs', { screen: 'Home' })} />} />
        </View>
      </SafeAreaView>
    );
  }
  if (activeTrip.stage === 'Assigned') {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.content}>
          <EmptyState
            title="Pre-trip check required"
            message="Complete the vehicle safety check before driving to the pickup point."
            action={<Button title="Start pre-trip check" onPress={() => navigation.navigate('PreTrip', { bookingId: activeTrip.id })} />}
          />
        </View>
      </SafeAreaView>
    );
  }
  // Keyed so per-trip form state (OTP, odometer, tolls) never leaks between trips.
  return <TripExecution key={activeTrip.id} trip={activeTrip} />;
}

function TripExecution({ trip }: { trip: TripDetails }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [endOdometer, setEndOdometer] = useState('');
  const [tolls, setTolls] = useState<TollReceipt[]>(trip.tolls);
  const [tollOpen, setTollOpen] = useState(false);

  const stageIdx = STAGE_ORDER.indexOf(trip.stage);
  const phone = localMobile(trip.customerPhone);

  const run = async (fn: () => Promise<void>, fallback: string) => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof DriverActionError || err instanceof LocationError ? err.message : describeError(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const reachedPickup = () =>
    run(async () => {
      const here = await getCurrentPosition(12000);
      if (trip.pickup.lat != null && trip.pickup.lng != null) {
        const d = haversineKm(here, { lat: trip.pickup.lat, lng: trip.pickup.lng });
        if (d > PICKUP_RADIUS_KM) {
          throw new DriverActionError('too-far', `You are ${d.toFixed(1)} km from the pickup point. Move within ${PICKUP_RADIUS_KM} km to continue.`);
        }
      }
      await markReachedPickup(trip.id, here);
    }, 'Could not update the trip.');

  const startTrip = () => run(() => startTripWithOtp(trip.id, otp), 'Could not start the trip.');

  const removeToll = (id: string) =>
    run(async () => {
      const next = tolls.filter((t) => t.id !== id);
      await saveTripTolls(trip.id, next);
      setTolls(next);
    }, 'Could not remove the receipt.');

  const complete = () => {
    const end = Number(endOdometer);
    const start = trip.startOdometer ?? 0;
    if (!(end > 0)) return setError('Enter the ending odometer reading.');
    if (end < start) return setError(`Ending reading must be at least the starting reading (${start} km).`);
    if (end - start > 5000) return setError('That odometer reading looks wrong — please check it.');
    return run(() => completeTrip(trip.id, end, tolls), 'Could not complete the trip. Please try again.');
  };

  const totalTolls = tollTotal(tolls);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <TollSheet
        key={tollOpen ? 'open' : 'closed'}
        visible={tollOpen}
        trip={trip}
        onClose={() => setTollOpen(false)}
        onSaved={async (toll) => {
          const next = [...tolls, toll];
          await saveTripTolls(trip.id, next);
          setTolls(next);
          setTollOpen(false);
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={styles.headRow}>
            <Badge label="LIVE TRIP" tone="brand" />
            <Text style={type.tiny}>{trip.bookingId}</Text>
          </View>
          <Text style={[type.h2, { marginTop: space.sm }]}>{trip.customerName}</Text>
          <Text style={type.small}>
            {trip.scheduledDate} {trip.scheduledTime} • {trip.paymentMode}
          </Text>
          {trip.notes ? <Notice tone="info" message={`Customer note: ${trip.notes}`} style={{ marginTop: space.sm }} /> : null}
          <View style={styles.headActions}>
            {phone ? <Button small variant="success" title={`Call ${formatPhone(phone)}`} onPress={() => void Linking.openURL(`tel:+91${phone}`)} style={{ flex: 1 }} /> : null}
            <View style={styles.payoutBox}>
              <Text style={type.tiny}>YOUR PAYOUT</Text>
              <Text style={styles.payout}>{formatINR(trip.driverEarnings)}</Text>
            </View>
          </View>
        </Card>

        <View style={styles.timeline}>
          {STAGE_LABELS.map((label, i) => (
            <View key={label} style={[styles.stage, i === stageIdx && styles.stageNow, i < stageIdx && styles.stageDone]}>
              <Text style={[styles.stageText, i === stageIdx && { color: colors.primary }, i < stageIdx && { color: colors.success }]}>{label}</Text>
            </View>
          ))}
        </View>

        <Notice message={error} />

        {trip.stage === 'En Route Pickup' ? (
          <Card>
            <Text style={type.h3}>Drive to pickup</Text>
            <Text style={[type.body, styles.addr]}>{trip.pickup.address}</Text>
            <Text style={type.small}>Your location is checked when you mark arrival — you must be within {PICKUP_RADIUS_KM} km of the pickup point.</Text>
            <Button title="Navigate in Google Maps" variant="dark" onPress={() => void Linking.openURL(mapsDirections(trip.pickup))} style={styles.gap} />
            <Button title={busy ? 'Checking location…' : 'I’ve reached pickup'} loading={busy} onPress={() => void reachedPickup()} style={styles.gap} />
          </Card>
        ) : null}

        {trip.stage === 'Reached Pickup' ? (
          <Card style={{ borderColor: colors.primary, borderWidth: 2 }}>
            <Text style={type.h3}>Boarding OTP</Text>
            <Text style={type.small}>Ask {trip.customerName} for the 4-digit code shown in their app.</Text>
            <TextInput
              value={otp}
              onChangeText={(t) => {
                setOtp(t.replace(/\D/g, '').slice(0, 4));
                setError('');
              }}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="• • • •"
              placeholderTextColor={colors.faint}
              style={styles.otp}
              accessibilityLabel="Boarding OTP"
            />
            <Button title={busy ? 'Verifying…' : 'Verify OTP & start trip'} loading={busy} disabled={otp.length !== 4} onPress={() => void startTrip()} />
          </Card>
        ) : null}

        {trip.stage === 'In Progress' ? (
          <Card>
            <Badge label="● Trip in progress" tone="success" />
            <Text style={[type.h3, { marginTop: space.sm }]}>Driving to destination</Text>
            <Text style={[type.body, styles.addr]}>{trip.drop.address}</Text>
            {trip.distanceKm > 0 ? <Text style={type.small}>Estimated distance {trip.distanceKm} km</Text> : null}
            <Button title="Navigate" variant="secondary" onPress={() => void Linking.openURL(mapsDirections(trip.drop))} style={styles.gap} />
            <Button title="Add toll / parking" variant="secondary" onPress={() => setTollOpen(true)} style={styles.gap} />
            <Button title={busy ? 'Updating…' : 'Arrived at destination'} variant="dark" loading={busy} onPress={() => void run(() => markArrivedDestination(trip.id), 'Could not update the trip.')} style={styles.gap} />
          </Card>
        ) : null}

        {trip.stage === 'Arrived Destination' ? (
          <Card>
            <Text style={type.h3}>End trip</Text>
            <Text style={[type.small, { marginBottom: space.md }]}>Enter the final odometer reading and add any toll / parking receipts.</Text>
            <TextField
              label="Ending odometer (km)"
              required
              value={endOdometer}
              onChangeText={(t) => setEndOdometer(t.replace(/\D/g, '').slice(0, 7))}
              keyboardType="number-pad"
              placeholder={trip.startOdometer ? String(trip.startOdometer + Math.round(trip.distanceKm)) : ''}
              hint={
                trip.startOdometer != null
                  ? `Start reading ${trip.startOdometer} km${Number(endOdometer) > trip.startOdometer ? ` • Driven ${Number(endOdometer) - trip.startOdometer} km` : ''}`
                  : undefined
              }
            />
            <View style={styles.tollHead}>
              <Text style={type.label}>Toll & parking receipts</Text>
              <Button small variant="dark" title="+ Add" onPress={() => setTollOpen(true)} />
            </View>
            {tolls.length === 0 ? <Text style={type.small}>No tolls added.</Text> : null}
            {tolls.map((t) => (
              <View key={t.id} style={styles.toll}>
                {t.receiptPhotoUrl ? <Image source={{ uri: t.receiptPhotoUrl }} style={styles.tollImg} /> : null}
                <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={styles.tollAmt}>{formatINR(t.amount)}</Text>
                <Text style={styles.remove} onPress={() => void removeToll(t.id)} accessibilityRole="button">
                  Remove
                </Text>
              </View>
            ))}
            <View style={styles.summary}>
              <Row label="Trip payout" value={formatINR(trip.driverEarnings)} />
              <Row label="Toll & parking reimbursement" value={`+ ${formatINR(totalTolls)}`} />
              <Row label="Total earnings" value={formatINR(trip.driverEarnings + totalTolls)} bold />
            </View>
            <Button title={busy ? 'Completing…' : 'Complete trip'} loading={busy} onPress={() => void complete()} />
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function TollSheet({ visible, trip, onClose, onSaved }: { visible: boolean; trip: TripDetails; onClose: () => void; onSaved: (t: TollReceipt) => Promise<void> }) {
  const [kind, setKind] = useState<'Toll' | 'Parking'>('Toll');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [photo, setPhoto] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const value = Number(amount);
    if (!name.trim()) return setError(`Enter the ${kind === 'Toll' ? 'toll plaza' : 'parking'} name.`);
    if (!(value > 0) || value > 10000) return setError('Enter a valid amount (up to ₹10,000).');
    if (!photo) return setError('Upload a photo of the receipt.');
    setSaving(true);
    setError('');
    try {
      await onSaved({ id: `TOLL-${Date.now()}`, name: `${kind}: ${name.trim()}`, amount: Math.round(value * 100) / 100, receiptPhotoUrl: photo, uploadedAt: new Date().toISOString() });
    } catch (e) {
      setError(describeError(e, 'Could not save the receipt.'));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Add toll / parking receipt" dismissible={!saving && !uploading}>
      <View style={styles.kindRow}>
        {(['Toll', 'Parking'] as const).map((k) => (
          <Button key={k} small variant={kind === k ? 'primary' : 'secondary'} title={k} onPress={() => setKind(k)} style={{ flex: 1 }} />
        ))}
      </View>
      <TextField label={kind === 'Toll' ? 'Toll plaza name' : 'Parking location'} value={name} onChangeText={setName} />
      <TextField label="Amount (₹)" value={amount} onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, '').slice(0, 7))} keyboardType="decimal-pad" />
      <PhotoField label="Receipt photo" value={photo} folder={`trips/${trip.id}/tolls`} name={kind.toLowerCase()} required onBusyChange={setUploading} onChange={setPhoto} />
      <Notice message={error} />
      <Button title={saving ? 'Saving…' : 'Save receipt'} loading={saving} disabled={uploading} onPress={() => void save()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  payoutBox: { alignItems: 'flex-end', marginLeft: 'auto' },
  payout: { fontSize: 20, fontWeight: '900', color: colors.primary },
  timeline: { flexDirection: 'row', gap: space.xs, marginBottom: space.md },
  stage: { flex: 1, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingVertical: space.sm, alignItems: 'center' },
  stageNow: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  stageDone: { borderColor: colors.successBorder, backgroundColor: colors.successSoft },
  stageText: { fontSize: 11, fontWeight: '800', color: colors.muted },
  addr: { fontWeight: '700', marginVertical: space.sm },
  gap: { marginTop: space.sm },
  otp: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 16,
    textAlign: 'center',
    paddingVertical: 12,
    marginVertical: space.md,
    color: colors.ink,
  },
  tollHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  toll: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tollImg: { width: 36, height: 36, borderRadius: 6 },
  tollAmt: { fontWeight: '800', color: colors.primary },
  remove: { color: colors.muted, fontWeight: '700', fontSize: 12, paddingLeft: space.sm },
  summary: { backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md, marginVertical: space.md },
  kindRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
});
