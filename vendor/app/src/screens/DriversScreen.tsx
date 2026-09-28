// Driver roster, vehicle assignment and invites (native port of vendor/web
// DriverManagementScreen.tsx; invites go to driver_invites and are never
// pre-approved, as firestore.rules require).
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVendorData } from '../context/VendorData';
import { Avatar, Badge, Button, Card, Chip, EmptyState, Notice, Row, Screen, Sheet, TextField } from '../components/ui';
import { assignVehicle, inviteDriver, revokeInvite, setDriverFleetStatus, VendorActionError } from '../services/vendorService';
import type { FleetDriver } from '../types/operations';
import { displayDate } from '../components/fields';
import { formatPhone } from '../utils/format';
import { daysUntil } from '../utils/wallet';
import { describeDataError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';

export function DriversScreen() {
  const { drivers, invites, vehicles } = useVendorData();
  const [assignFor, setAssignFor] = useState<FleetDriver | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const toggleFleetStatus = (d: FleetDriver) => {
    const next = d.fleetStatus === 'Suspended' ? 'Active' : 'Suspended';
    Alert.alert(next === 'Suspended' ? `Suspend ${d.name}?` : `Reactivate ${d.name}?`, next === 'Suspended' ? 'They will not be dispatched on your trips until reactivated.' : 'They can be dispatched on your trips again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: next === 'Suspended' ? 'Suspend' : 'Reactivate',
        style: next === 'Suspended' ? 'destructive' : 'default',
        onPress: () => {
          setDriverFleetStatus(d.id, next).catch((e: unknown) => setMessage({ tone: 'error', text: describeDataError(e) }));
        },
      },
    ]);
  };

  const revoke = (phone: string) =>
    Alert.alert('Revoke invite?', `${formatPhone(phone)} will no longer be linked to your fleet when they register.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => {
          revokeInvite(phone).catch((e: unknown) => setMessage({ tone: 'error', text: describeDataError(e) }));
        },
      },
    ]);

  return (
    <Screen edges={[]}>
      {assignFor ? (
        <AssignSheet
          key={assignFor.id}
          driver={assignFor}
          onClose={() => setAssignFor(null)}
          onDone={(text) => {
            setAssignFor(null);
            setMessage({ tone: 'success', text });
          }}
        />
      ) : null}
      {inviteOpen ? (
        <InviteSheet
          onClose={() => setInviteOpen(false)}
          onDone={(text) => {
            setInviteOpen(false);
            setMessage({ tone: 'success', text });
          }}
        />
      ) : null}
      <Button title="+ Invite a driver" onPress={() => setInviteOpen(true)} style={{ marginBottom: space.md }} />
      {message ? <Notice tone={message.tone} message={message.text} /> : null}

      <Text style={[type.h3, styles.section]}>Drivers in your fleet ({drivers.length})</Text>
      {drivers.length === 0 ? (
        <EmptyState title="No drivers linked yet" message="Invite drivers by mobile number. They are linked to your fleet when they register in the NESAM Driver app." />
      ) : (
        drivers.map((d) => {
          const licenceDays = daysUntil(d.licenseExpiry);
          return (
            <Card key={d.id}>
              <View style={styles.head}>
                <Avatar name={d.name} photoUrl={d.photoUrl} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{d.name}</Text>
                  <Text style={type.small}>
                    {formatPhone(d.phone)} · ★ {d.rating.toFixed(1)}
                  </Text>
                </View>
                <Badge label={d.approvalStatus} tone={d.approvalStatus === 'Approved' ? 'success' : d.approvalStatus === 'Rejected' ? 'danger' : 'warning'} />
              </View>
              <View style={styles.badges}>
                <Badge label={d.presenceStatus} tone={d.presenceStatus === 'Online' ? 'success' : d.presenceStatus === 'On Trip' ? 'brand' : 'neutral'} />
                {d.fleetStatus === 'Suspended' ? <Badge label="Suspended by you" tone="danger" /> : null}
                {licenceDays != null && licenceDays < 0 ? <Badge label="Licence expired" tone="danger" /> : null}
              </View>
              <Row label="Assigned vehicle" value={d.assignedVehicleNumber || 'None'} />
              <Row label="Licence" value={d.licenseNumber ? `${d.licenseNumber} · till ${displayDate(d.licenseExpiry) || '—'}` : '—'} />
              <Row label="Documents" value={d.docStatus} />
              <View style={styles.actions}>
                <Button small variant="secondary" title="Assign vehicle" onPress={() => setAssignFor(d)} style={{ flex: 1 }} disabled={vehicles.length === 0} />
                <Button small variant="ghost" title={d.fleetStatus === 'Suspended' ? 'Reactivate' : 'Suspend'} onPress={() => toggleFleetStatus(d)} />
              </View>
            </Card>
          );
        })
      )}

      <Text style={[type.h3, styles.section]}>Pending invites ({invites.length})</Text>
      {invites.length === 0 ? (
        <Text style={type.small}>No pending invites.</Text>
      ) : (
        invites.map((i) => (
          <View key={i.phone} style={styles.invite}>
            <Ionicons name="mail-outline" size={18} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{i.name || 'Driver'}</Text>
              <Text style={type.tiny}>
                {formatPhone(i.phone)}
                {i.vehicleAssignment ? ` · ${i.vehicleAssignment}` : ''}
              </Text>
            </View>
            <Pressable onPress={() => revoke(i.phone)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Revoke invite for ${i.phone}`}>
              <Text style={styles.revoke}>Revoke</Text>
            </Pressable>
          </View>
        ))
      )}
    </Screen>
  );
}

function AssignSheet({ driver, onClose, onDone }: { driver: FleetDriver; onClose: () => void; onDone: (text: string) => void }) {
  const { vehicles } = useVendorData();
  const [vehicleId, setVehicleId] = useState(driver.assignedVehicleId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const approved = vehicles.filter((v) => v.docStatus === 'Approved' && v.status !== 'Inactive');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
      await assignVehicle(driver, vehicle, vehicles);
      onDone(vehicle ? `${vehicle.vehicleNumber} assigned to ${driver.name}.` : `Vehicle unassigned from ${driver.name}.`);
    } catch (e) {
      setError(e instanceof VendorActionError ? e.message : describeDataError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible onClose={onClose} title={`Assign vehicle · ${driver.name}`} dismissible={!busy}>
      {approved.length === 0 ? <Notice tone="info" message="No approved vehicles yet. Vehicles become assignable once NESAM approves their documents." /> : null}
      <View style={styles.chips}>
        <Chip label="None" active={!vehicleId} onPress={() => setVehicleId('')} />
        {approved.map((v) => (
          <Chip key={v.id} label={`${v.vehicleNumber}${v.assignedDriverId && v.assignedDriverId !== driver.id ? ` (${v.assignedDriverName})` : ''}`} active={vehicleId === v.id} onPress={() => setVehicleId(v.id)} />
        ))}
      </View>
      <Text style={[type.tiny, { marginBottom: space.md }]}>Choosing a vehicle already assigned to someone else moves it to {driver.name}.</Text>
      <Notice message={error} />
      <Button title={busy ? 'Saving…' : 'Save'} loading={busy} disabled={vehicleId === driver.assignedVehicleId} onPress={() => void save()} />
    </Sheet>
  );
}

function InviteSheet({ onClose, onDone }: { onClose: () => void; onDone: (text: string) => void }) {
  const { identity, vehicles } = useVendorData();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await inviteDriver(identity, mobile, name, vehicle);
      onDone(`Invite sent for ${formatPhone(mobile)}. Ask them to sign up in the NESAM Driver app with this number.`);
    } catch (e) {
      setError(e instanceof VendorActionError ? e.message : describeDataError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible onClose={onClose} title="Invite a driver" dismissible={!busy}>
      <Text style={[type.small, { marginBottom: space.md }]}>
        The driver signs up in the NESAM Driver app with this mobile number and is linked to your fleet automatically. NESAM still verifies their documents. Drivers who already have an account can’t be
        linked by invite — contact NESAM support.
      </Text>
      <TextField label="Driver name" required value={name} onChangeText={setName} autoComplete="name" />
      <TextField label="Mobile number" required prefix="+91" value={mobile} onChangeText={(t) => setMobile(t.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" />
      {vehicles.length ? (
        <>
          <Text style={[type.label, { marginBottom: 6 }]}>Vehicle (optional)</Text>
          <View style={styles.chips}>
            <Chip label="None" active={!vehicle} onPress={() => setVehicle('')} />
            {vehicles.map((v) => (
              <Chip key={v.id} label={v.vehicleNumber} active={vehicle === v.vehicleNumber} onPress={() => setVehicle(v.vehicleNumber)} />
            ))}
          </View>
        </>
      ) : null}
      <Notice message={error} />
      <Button title={busy ? 'Sending…' : 'Send invite'} loading={busy} onPress={() => void submit()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.md, marginBottom: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginVertical: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  invite: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, marginBottom: space.sm },
  revoke: { color: colors.danger, fontWeight: '700' },
});
