// Live trip execution. The driver's steps are exactly three, in order:
//   Reached Pickup  →  Trip Started  →  Trip End
// Every step is a server call that checks the order, stamps the time and where it
// happened, and ignores a repeated tap. At the pickup the driver verifies the
// customer's boarding OTP; Trip Started also needs the vehicle photos (taken
// before leaving or at the pickup).
import React, { useRef, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDriverData } from '../context/DriverData';
import { Badge, Button, Card, EmptyState, Notice, Row, Sheet, TextField } from '../components/ui';
import { PhotoField } from '../components/forms';
import { DriverActionError, saveTripTolls, tollTotal } from '../services/driverService';
import { ActionError } from '../services/callables';
import { refreshDeviceIntegrity } from '../services/deviceSecurity';
import { getCurrentPosition, LocationError } from '../services/locationService';
import { advanceTrip, newRequestId, recordCollection, verifyBoarding, type Fix, type TripStep } from '../services/tripService';
import type { TollReceipt, TripDetails } from '../types/driver';
import { formatINR, formatPhone, localMobile } from '../utils/format';
import { payoutNote, payoutText } from '../utils/earnings';
import { haversineKm } from '../utils/geo';
import { describeError } from '../utils/retry';
import { formatTime12 } from '../utils/time';
import { startBlockers, TRIP_STEPS, TRIP_STEP_LABELS } from '../utils/tripFlow';
import { PICKUP_RADIUS_KM } from '../config/constants';
import { colors, radius, space, type } from '../theme';

export function mapsDirections(loc: TripDetails['pickup']): string {
  return loc.lat != null && loc.lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc.address)}`;
}

const reason = (err: unknown, fallback: string) =>
  err instanceof ActionError || err instanceof DriverActionError || err instanceof LocationError ? err.message : describeError(err, fallback);

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
  // Keyed so per-trip form state (OTP, odometer, tolls) never leaks between trips.
  return <TripExecution key={activeTrip.id} trip={activeTrip} onVerifyVehicle={() => navigation.navigate('PreTrip', { bookingId: activeTrip.id })} />;
}

const METHODS = ['Cash', 'UPI', 'Bank Transfer'] as const;

function TripExecution({ trip, onVerifyVehicle }: { trip: TripDetails; onVerifyVehicle: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [otp, setOtp] = useState('');
  const [endOdometer, setEndOdometer] = useState('');
  const [tolls, setTolls] = useState<TollReceipt[]>(trip.tolls);
  const [tollOpen, setTollOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<(typeof METHODS)[number]>('Cash');
  const [payRef, setPayRef] = useState('');
  // One request id per action attempt, kept until it succeeds, so a retry is recognised by the server.
  const ids = useRef<Record<string, string>>({});
  const requestId = (key: string) => (ids.current[key] ??= newRequestId());

  const stepIdx = TRIP_STEPS.indexOf(trip.subStatus as TripStep);
  const phone = localMobile(trip.customerPhone);

  const run = async (fn: () => Promise<void>, fallback: string) => {
    if (busy) return;
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(reason(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  /** Position for the step, or null when the phone can't give one (the server notes that). */
  const hereOrNull = (): Promise<Fix | null> => getCurrentPosition(8000).catch(() => null);

  /** Runs a trip step; if the server says this phone needs a fresh integrity check, does it and retries once. */
  const step = async (to: TripStep, extra: { location?: Fix | null; endOdometer?: number; tolls?: TollReceipt[] } = {}) => {
    const call = () => advanceTrip({ bookingId: trip.id, to, requestId: requestId(to), ...extra });
    try {
      await call();
    } catch (err) {
      const needs = err instanceof ActionError && (err.details as { integrity?: string } | undefined)?.integrity === 'required';
      if (!needs) throw err;
      await refreshDeviceIntegrity();
      await call();
    }
    delete ids.current[to];
  };

  const blockers = startBlockers(trip);
  const startTrip = () => run(async () => step('Trip Started', { location: await hereOrNull() }), 'Could not start the trip.');

  const reachedPickup = () =>
    run(async () => {
      const here = await getCurrentPosition(12000);
      if (trip.pickup.lat != null && trip.pickup.lng != null) {
        const d = haversineKm(here, { lat: trip.pickup.lat, lng: trip.pickup.lng });
        if (d > PICKUP_RADIUS_KM) {
          throw new DriverActionError('too-far', `You are ${d.toFixed(1)} km from the pickup point. Move within ${PICKUP_RADIUS_KM} km to continue.`);
        }
      }
      await step('Reached Pickup', { location: here });
    }, 'Could not update the trip.');

  const checkOtp = () => run(async () => {
    await verifyBoarding(trip.id, otp);
    setOtp('');
    setInfo(trip.verificationSubmitted ? 'Boarding OTP verified. Tap Trip Started when the customer is on board.' : 'Boarding OTP verified. Complete the vehicle photos, then tap Trip Started.');
  }, 'Could not verify the OTP.');

  const removeToll = (id: string) =>
    run(async () => {
      const next = tolls.filter((t) => t.id !== id);
      await saveTripTolls(trip.id, next);
      setTolls(next);
    }, 'Could not remove the receipt.');

  const endTrip = () => {
    const end = Number(endOdometer);
    const start = trip.startOdometer ?? 0;
    if (!(end > 0)) return setError('Enter the ending odometer reading.');
    if (end < start) return setError(`Ending reading must be at least the starting reading (${start} km).`);
    if (end - start > 5000) return setError('That odometer reading looks wrong — please check it.');
    return run(async () => step('Trip Ended', { location: await hereOrNull(), endOdometer: end, tolls }), 'Could not end the trip. Please try again.');
  };

  const collect = () => {
    const amount = Number(payAmount);
    if (!(amount > 0)) return setError('Enter the amount you collected.');
    if (payMethod !== 'Cash' && payRef.trim().length < 3) return setError('Enter the payment reference for UPI / bank transfers.');
    return run(async () => {
      await recordCollection({ bookingId: trip.id, amount, method: payMethod, reference: payRef.trim(), requestId: requestId('collect') });
      delete ids.current.collect;
      setPayAmount('');
      setPayRef('');
      setInfo(`Recorded ${formatINR(amount)} (${payMethod}).`);
    }, 'Could not record the payment.');
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
            <Badge label={trip.subStatus === 'Not Started' ? 'GO TO PICKUP' : trip.subStatus === 'Reached Pickup' ? 'AT PICKUP' : 'LIVE TRIP'} tone="brand" />
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
              <Text style={styles.payout}>{payoutText(trip)}</Text>
            </View>
          </View>
          <Text style={[type.tiny, { marginTop: space.xs, textAlign: 'right' }]}>{payoutNote(trip)}</Text>
        </Card>

        <View style={styles.timeline}>
          {TRIP_STEP_LABELS.map((label, i) => (
            <View key={label} style={[styles.stage, i === stepIdx + 1 && styles.stageNow, i <= stepIdx && styles.stageDone]}>
              <Text style={[styles.stageText, i === stepIdx + 1 && { color: colors.primary }, i <= stepIdx && { color: colors.success }]}>{i <= stepIdx ? `✓ ${label}` : label}</Text>
            </View>
          ))}
        </View>

        <Notice message={error} />
        {info ? <Notice tone="success" message={info} /> : null}

        {trip.subStatus === 'Not Started' ? (
          <Card>
            <Text style={type.h3}>Drive to pickup</Text>
            <Text style={[type.body, styles.addr]}>{trip.pickup.address}</Text>
            <Text style={type.small}>Your location is checked when you mark arrival — you must be within {PICKUP_RADIUS_KM} km of the pickup point.</Text>
            <Button title="Navigate in Google Maps" variant="dark" onPress={() => void Linking.openURL(mapsDirections(trip.pickup))} style={styles.gap} />
            <Button title={busy ? 'Checking location…' : 'Reached Pickup'} loading={busy} onPress={() => void reachedPickup()} style={styles.gap} />
          </Card>
        ) : null}

        {(trip.subStatus === 'Not Started' || trip.subStatus === 'Reached Pickup') && !trip.verificationSubmitted ? (
          <Card>
            <Text style={type.h3}>Vehicle photos</Text>
            <Text style={[type.small, { marginVertical: space.sm }]}>
              Take the front, rear and dashboard photos with the camera {trip.subStatus === 'Not Started' ? 'now or at the pickup' : 'before you start the trip'}.
            </Text>
            <Button title="Take vehicle photos" variant={trip.subStatus === 'Reached Pickup' ? 'primary' : 'secondary'} onPress={onVerifyVehicle} />
          </Card>
        ) : null}

        {trip.subStatus === 'Reached Pickup' && !trip.boardingVerified ? (
          <Card style={{ borderColor: colors.primary, borderWidth: 2 }}>
            <Text style={type.h3}>Boarding OTP</Text>
            <Text style={type.small}>Ask {trip.customerName} for the 4-digit code shown in their app or message. Five wrong tries lock this check for 10 minutes.</Text>
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
            <Button title={busy ? 'Verifying…' : 'Verify OTP'} loading={busy} disabled={otp.length !== 4} onPress={() => void checkOtp()} />
          </Card>
        ) : null}

        {trip.subStatus === 'Reached Pickup' ? (
          <Card>
            <Text style={type.h3}>Start the trip</Text>
            {blockers.length ? (
              <Text style={[type.small, { marginVertical: space.sm }]}>Still needed: {blockers.join(' and ')}.</Text>
            ) : (
              <Text style={[type.small, { marginVertical: space.sm }]}>OTP and vehicle photos verified. Start when the customer is on board.</Text>
            )}
            <Button title={busy ? 'Starting…' : 'Trip Started'} loading={busy} disabled={blockers.length > 0} onPress={() => void startTrip()} />
          </Card>
        ) : null}

        {trip.subStatus === 'Trip Started' ? (
          <>
            <Card>
              <Badge label="● Passenger on board" tone="success" />
              <Text style={[type.h3, { marginTop: space.sm }]}>Driving to destination</Text>
              <Text style={[type.body, styles.addr]}>{trip.drop.address}</Text>
              {trip.distanceKm > 0 ? <Text style={type.small}>Estimated distance {trip.distanceKm} km</Text> : null}
              <Button title="Navigate" variant="secondary" onPress={() => void Linking.openURL(mapsDirections(trip.drop))} style={styles.gap} />
            </Card>

            <Card>
              <Text style={type.h3}>Trip End</Text>
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
                <Row label="Trip payout" value={payoutText(trip)} bold />
                <Row label="Tolls & parking claimed" value={formatINR(totalTolls)} />
                <Text style={type.tiny}>
                  {trip.paymentMode === 'Cash'
                    ? 'Cash trip: collect tolls with the fare from the customer. NESAM reimburses tolls only on non-cash trips.'
                    : 'Reimbursed to your wallet once NESAM approves the receipts.'}
                </Text>
              </View>
              <Button title={busy ? 'Ending…' : 'Trip End'} loading={busy} onPress={() => void endTrip()} />
            </Card>

            <Card>
              <Text style={type.h3}>Money collected from the customer</Text>
              <Text style={[type.small, { marginVertical: space.sm }]}>
                Record every amount you take (cash, UPI or bank transfer). Each one is saved as its own payment against this booking
                {trip.balanceDue != null ? ` — balance due ${formatINR(trip.balanceDue)}` : ''}.
              </Text>
              <View style={styles.kindRow}>
                {METHODS.map((m) => (
                  <Button key={m} small variant={payMethod === m ? 'primary' : 'secondary'} title={m} onPress={() => setPayMethod(m)} style={{ flex: 1 }} />
                ))}
              </View>
              <TextField label="Amount collected (₹)" value={payAmount} onChangeText={(t) => setPayAmount(t.replace(/[^\d.]/g, '').slice(0, 8))} keyboardType="decimal-pad" />
              {payMethod !== 'Cash' ? <TextField label="UPI / bank reference" value={payRef} onChangeText={setPayRef} autoCapitalize="characters" /> : null}
              <Button title="Record payment" variant="secondary" disabled={busy} onPress={() => void collect()} />
            </Card>
          </>
        ) : null}

        {trip.reachedPickupAt ? <Text style={[type.tiny, { textAlign: 'center' }]}>Reached pickup at {formatTime12(trip.reachedPickupAt)}</Text> : null}
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
