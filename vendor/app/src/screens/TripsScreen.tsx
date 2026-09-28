// Awarded trips and driver dispatch (native port of vendor/web
// TripAssignmentScreen.tsx, using vendorDispatchOk instead of the Web's
// rule-violating write).
import React, { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVendorData } from '../context/VendorData';
import { Badge, Button, Card, Chip, EmptyState, Notice, Row, Segmented, Sheet } from '../components/ui';
import { canDispatch, dispatchBlocker, dispatchDriver, VendorActionError } from '../services/vendorService';
import type { FleetDriver, VendorBooking } from '../types/operations';
import { formatINR, formatPhone, localMobile } from '../utils/format';
import { netPayout } from '../utils/wallet';
import { describeDataError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';

type Tab = 'active' | 'completed';

export function TripsScreen() {
  const { bookings, activeBookings, profile, errors } = useVendorData();
  const [tab, setTab] = useState<Tab>('active');
  const [dispatchFor, setDispatchFor] = useState<VendorBooking | null>(null);
  const [message, setMessage] = useState('');
  const completed = useMemo(
    () => bookings.filter((b) => b.status === 'Completed').sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)),
    [bookings],
  );
  const data = tab === 'active' ? activeBookings : completed;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {dispatchFor ? (
        <DispatchSheet
          key={dispatchFor.id}
          booking={dispatchFor}
          onClose={() => setDispatchFor(null)}
          onDone={(name) => {
            setDispatchFor(null);
            setMessage(`${name} has been dispatched. The trip now appears in their driver app.`);
          }}
        />
      ) : null}
      <View style={styles.header}>
        <Text style={type.h1}>Trips</Text>
        <Segmented
          options={[
            { value: 'active', label: `Active (${activeBookings.length})` },
            { value: 'completed', label: `Completed (${completed.length})` },
          ]}
          value={tab}
          onChange={setTab}
        />
        {message ? <Notice tone="success" message={message} style={{ marginTop: space.md, marginBottom: 0 }} /> : null}
      </View>
      <FlatList
        data={data}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Notice message={errors.bookings} />}
        ListEmptyComponent={
          <EmptyState title={tab === 'active' ? 'No active trips' : 'No completed trips yet'} message={tab === 'active' ? 'Accept trips from the marketplace to see them here.' : undefined} />
        }
        renderItem={({ item: b }) => {
          const needsDriver = b.status === 'Confirmed' || (b.status === 'Assigned' && !b.driverId);
          const customerPhone = localMobile(b.customerPhone);
          const driverPhone = localMobile(b.driverPhone);
          return (
            <Card style={needsDriver ? { borderColor: colors.warningBorder } : undefined}>
              <View style={styles.rowBetween}>
                <Text style={type.tiny}>{b.bookingId}</Text>
                <Badge
                  label={b.status === 'Completed' ? 'Completed' : needsDriver ? 'Needs driver' : b.status === 'Ongoing' ? 'On trip' : b.tripStage || b.status}
                  tone={b.status === 'Completed' ? 'success' : needsDriver ? 'warning' : 'brand'}
                />
              </View>
              <Text style={[type.h3, { marginTop: 4 }]}>{b.customerName}</Text>
              <Text style={type.small} numberOfLines={2}>
                {b.pickupAddress} → {b.dropAddress}
              </Text>
              <Text style={type.small}>
                {b.date} {b.time} {b.vehicleCategory ? `· ${b.vehicleCategory}` : ''} {b.paymentMethod ? `· ${b.paymentMethod}` : ''}
              </Text>
              {b.driverId ? (
                <View style={styles.driverRow}>
                  <Ionicons name="person-circle-outline" size={20} color={colors.ink} />
                  <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                    {b.driverName} · {b.vehicleNumber}
                  </Text>
                  {driverPhone ? (
                    <Pressable onPress={() => void Linking.openURL(`tel:+91${driverPhone}`)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Call driver">
                      <Ionicons name="call-outline" size={20} color={colors.primary} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <Row label="Fare" value={formatINR(b.fare)} />
              <Row label="Your payout" value={formatINR(netPayout(b, profile.commissionRate))} bold />
              <View style={styles.actions}>
                {customerPhone && b.status !== 'Completed' ? (
                  <Button small variant="secondary" title={`Call ${formatPhone(customerPhone)}`} onPress={() => void Linking.openURL(`tel:+91${customerPhone}`)} style={{ flex: 1 }} />
                ) : null}
                {canDispatch(b) ? <Button small title={b.driverId ? 'Reassign driver' : 'Dispatch driver'} onPress={() => setDispatchFor(b)} style={{ flex: 1 }} /> : null}
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

function DispatchSheet({ booking, onClose, onDone }: { booking: VendorBooking; onClose: () => void; onDone: (driverName: string) => void }) {
  const { drivers, vehicles, bookings } = useVendorData();
  const [driverId, setDriverId] = useState(booking.driverId);
  const driver = drivers.find((d) => d.id === driverId) ?? null;
  const defaultVehicle = (d: FleetDriver | null) => d?.assignedVehicleNumber || d?.ownVehicleNumber || '';
  const [vehicleNumber, setVehicleNumber] = useState(booking.vehicleNumber || defaultVehicle(driver));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const usableVehicles = vehicles.filter((v) => v.status === 'Active' && v.docStatus === 'Approved');

  const pickDriver = (d: FleetDriver) => {
    setDriverId(d.id);
    setVehicleNumber(defaultVehicle(d));
    setError('');
  };

  const submit = async () => {
    if (!driver) return setError('Choose a driver.');
    setBusy(true);
    setError('');
    try {
      await dispatchDriver(booking, driver, vehicleNumber, bookings);
      onDone(driver.name);
    } catch (e) {
      setError(e instanceof VendorActionError ? e.message : describeDataError(e));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Sheet visible onClose={onClose} title={`Dispatch · ${booking.bookingId}`} dismissible={!busy}>
      <Text style={[type.small, { marginBottom: space.md }]}>
        {booking.pickupAddress} → {booking.dropAddress} · {booking.date} {booking.time}
      </Text>
      <Text style={[type.label, { marginBottom: space.sm }]}>Driver</Text>
      {drivers.length === 0 ? <Notice tone="info" message="No drivers are linked to your fleet yet. Invite drivers from More › Drivers." /> : null}
      {drivers.map((d) => {
        const blocker = dispatchBlocker(d, bookings, booking.id);
        const on = d.id === driverId;
        return (
          <Pressable
            key={d.id}
            onPress={() => !blocker && pickDriver(d)}
            disabled={!!blocker}
            style={[styles.option, on && styles.optionOn, !!blocker && { opacity: 0.5 }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: !!blocker }}
          >
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>{d.name}</Text>
              <Text style={type.small}>{blocker || `${d.presenceStatus} · ★ ${d.rating.toFixed(1)}${d.assignedVehicleNumber ? ` · ${d.assignedVehicleNumber}` : ''}`}</Text>
            </View>
            {on ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
          </Pressable>
        );
      })}
      {driver ? (
        <>
          <Text style={[type.label, { marginVertical: space.sm }]}>Vehicle for this trip</Text>
          <View style={styles.chips}>
            {[...new Set([defaultVehicle(driver), ...usableVehicles.map((v) => v.vehicleNumber)].filter(Boolean))].map((num) => (
              <Chip key={num} label={num} active={vehicleNumber === num} onPress={() => setVehicleNumber(num)} />
            ))}
          </View>
          {!vehicleNumber ? <Text style={type.small}>Add an approved vehicle in Fleet, or assign one to this driver.</Text> : null}
        </>
      ) : null}
      <Notice message={error} />
      <Button title={busy ? 'Dispatching…' : 'Dispatch driver'} loading={busy} disabled={!driver || !vehicleNumber} onPress={() => void submit()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { padding: space.lg, paddingBottom: space.sm, gap: space.md },
  list: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.bg, borderRadius: radius.sm, padding: space.sm, marginVertical: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
});
