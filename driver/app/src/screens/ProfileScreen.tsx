// Driver profile, contact/bank edit, documents with expiry badges (port of
// driver/web ProfileScreen.tsx).
import React, { useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useDriverData } from '../context/DriverData';
import { useSignOut } from '../navigation/MainNavigator';
import { Avatar, Badge, Button, Card, Notice, Row, Sheet, TextField } from '../components/ui';
import { updateDriverContactDetails, type ContactFields } from '../services/driverService';
import { displayDate } from '../components/forms';
import { IFSC_RE, MOBILE_RE, UPI_RE } from '../validation/kyc';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { describeError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';

function expiryBadge(date: string) {
  if (!date) return null;
  const days = Math.floor((new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(days)) return null;
  if (days < 0) return <Badge label="Expired" tone="danger" />;
  if (days <= 30) return <Badge label={`Expires in ${days}d`} tone="warning" />;
  return null;
}

function DocThumb({ label, url, expiry }: { label: string; url: string; expiry?: string }) {
  return (
    <Pressable
      style={styles.doc}
      disabled={!url}
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="button"
      accessibilityLabel={`${label}${url ? '' : ', not uploaded'}`}
    >
      {url ? <Image source={{ uri: url }} style={styles.docImg} /> : <View style={[styles.docImg, styles.docMissing]}><Text style={type.tiny}>Not uploaded</Text></View>}
      <Text style={styles.docLabel} numberOfLines={1}>
        {label}
      </Text>
      {expiry ? expiryBadge(expiry) : null}
    </Pressable>
  );
}

export function ProfileScreen() {
  const navigation = useNavigation();
  const signOut = useSignOut();
  const { account, completedTrips } = useDriverData();
  const { driver, identity, license, vehicle, bank } = account;
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You’ll need to verify your phone number again to sign back in.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {editing ? (
        <ContactSheet
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
          }}
        />
      ) : null}
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.idCard}>
          <Avatar name={driver.name} photoUrl={driver.photoUrl} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={type.h2}>{driver.name}</Text>
            <Text style={type.small}>{driver.phone}</Text>
            <Text style={type.small}>
              {driver.rating != null ? `★ ${driver.rating.toFixed(1)}` : 'No ratings yet'} • {completedTrips.length} trips • since {driver.joiningDate}
            </Text>
            {driver.vendorName ? <Text style={type.small}>Fleet: {driver.vendorName}</Text> : null}
            <View style={styles.badges}>
              <Badge label="Account approved" tone="success" />
              <Badge label={`Documents: ${driver.docStatus}`} tone={driver.docStatus === 'Approved' ? 'success' : driver.docStatus === 'Rejected' ? 'danger' : 'warning'} />
            </View>
          </View>
        </Card>
        {driver.docStatus === 'Rejected' && driver.rejectionReason ? <Notice message={`Document note from NESAM: ${driver.rejectionReason}`} /> : null}
        {saved ? <Notice tone="success" message="Profile updated." /> : null}

        <Card>
          <View style={styles.cardHead}>
            <Text style={type.h3}>Contact & bank</Text>
            <Button small variant="ghost" title="Edit" onPress={() => setEditing(true)} />
          </View>
          <Row label="Email" value={driver.email || '—'} />
          <Row label="Date of birth" value={displayDate(driver.dob) || '—'} />
          <Row label="Address" value={[driver.address, driver.city, driver.pincode].filter(Boolean).join(', ') || '—'} />
          <Row label="Emergency contact" value={driver.emergencyContact ? `${driver.emergencyContactName} (${driver.emergencyContact})` : '—'} />
          <Row label="Account holder" value={bank.accountHolder || '—'} />
          <Row label="Account no." value={bank.accountNumber ? `••••${bank.accountNumber.slice(-4)}` : '—'} />
          <Row label="IFSC" value={bank.ifsc || '—'} />
          <Row label="UPI" value={bank.upiId || '—'} />
        </Card>

        <Card>
          <Text style={[type.h3, { marginBottom: space.sm }]}>Licence & ID</Text>
          <Row label="Licence no." value={license.number} />
          <Row label="Licence valid till" value={displayDate(license.expiryDate)} />
          <Row label="Aadhaar" value={identity.aadhaarNumber ? `XXXX XXXX ${identity.aadhaarNumber.slice(-4)}` : '—'} />
          <Row label="PAN" value={identity.panNumber || '—'} />
          <Text style={[type.h3, { marginVertical: space.sm }]}>Vehicle</Text>
          <Row label="Registration" value={vehicle.vehicleNumber} />
          <Row label="Vehicle" value={`${vehicle.make} ${vehicle.model} (${vehicle.year})`} />
          <Row label="Category" value={`${vehicle.vehicleType} • ${vehicle.capacity} seats • ${vehicle.fuelType}`} />
          <Row label="Colour" value={vehicle.color} />
        </Card>

        <Card>
          <View style={styles.cardHead}>
            <Text style={type.h3}>Documents</Text>
            <Button small variant="dark" title="Update documents" onPress={() => navigation.navigate('UpdateDocuments')} />
          </View>
          <View style={styles.docs}>
            <DocThumb label="Licence (front)" url={license.frontPhotoUrl} expiry={license.expiryDate} />
            <DocThumb label="Licence (back)" url={license.backPhotoUrl} />
            <DocThumb label="Aadhaar (front)" url={identity.aadhaarFrontUrl} />
            <DocThumb label="Aadhaar (back)" url={identity.aadhaarBackUrl} />
            <DocThumb label="RC" url={vehicle.rcDocUrl} />
            <DocThumb label="Insurance" url={vehicle.insuranceDocUrl} expiry={vehicle.insuranceExpiry} />
            <DocThumb label="Permit" url={vehicle.statePermitDocUrl} expiry={vehicle.permitExpiry} />
            <DocThumb label="Fitness (FC)" url={vehicle.fitnessDocUrl} expiry={vehicle.fitnessExpiry} />
            <DocThumb label="Vehicle front" url={vehicle.frontPhotoUrl} />
            <DocThumb label="Vehicle rear" url={vehicle.rearPhotoUrl} />
            <DocThumb label="Vehicle side" url={vehicle.sidePhotoUrl} />
            <DocThumb label="Interior" url={vehicle.interiorPhotoUrl} />
          </View>
        </Card>

        <Button title={`Call support (${SUPPORT_PHONE_DISPLAY})`} variant="secondary" onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
        <Button title="Sign out" variant="ghost" onPress={confirmSignOut} style={{ marginTop: space.sm }} />
        <Text style={[type.tiny, { textAlign: 'center', marginTop: space.md }]}>NESAM Driver v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ContactSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { account } = useDriverData();
  const { driver, bank } = account;
  const [form, setForm] = useState<ContactFields>({
    email: driver.email,
    address: driver.address,
    city: driver.city,
    pincode: driver.pincode,
    emergencyContactName: driver.emergencyContactName,
    emergencyContact: driver.emergencyContact,
    bank: { ...bank },
  });
  const [confirm, setConfirm] = useState(bank.accountNumber);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<ContactFields>) => setForm((f) => ({ ...f, ...patch }));
  const setBank = (patch: Partial<ContactFields['bank']>) => setForm((f) => ({ ...f, bank: { ...f.bank, ...patch } }));

  const save = async () => {
    if (form.email && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(form.email.trim())) return setError('Invalid email.');
    if (!form.address.trim() || !form.city.trim()) return setError('Enter your address and city.');
    if (!/^[1-9]\d{5}$/.test(form.pincode)) return setError('Enter a 6-digit pincode.');
    if (!form.emergencyContactName.trim()) return setError('Enter the emergency contact name.');
    if (!MOBILE_RE.test(form.emergencyContact)) return setError('Enter a valid emergency contact number.');
    if (!form.bank.accountHolder.trim()) return setError('Enter the account holder name.');
    if (!/^\d{9,18}$/.test(form.bank.accountNumber)) return setError('Enter a valid bank account number.');
    if (confirm !== form.bank.accountNumber) return setError('Account numbers do not match.');
    if (!IFSC_RE.test(form.bank.ifsc.toUpperCase())) return setError('Invalid IFSC code.');
    if (form.bank.upiId && !UPI_RE.test(form.bank.upiId)) return setError('Invalid UPI ID.');
    setSaving(true);
    setError('');
    try {
      await updateDriverContactDetails(driver.id, {
        ...form,
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        emergencyContactName: form.emergencyContactName.trim(),
        bank: { ...form.bank, ifsc: form.bank.ifsc.toUpperCase(), accountHolder: form.bank.accountHolder.trim() },
      });
      onSaved();
    } catch (e) {
      setError(describeError(e, 'Could not save your changes.'));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Sheet visible onClose={onClose} title="Contact & bank" dismissible={!saving}>
      <TextField label="Email" value={form.email} onChangeText={(t) => set({ email: t })} keyboardType="email-address" autoCapitalize="none" />
      <TextField label="Address" value={form.address} onChangeText={(t) => set({ address: t })} multiline />
      <TextField label="City" value={form.city} onChangeText={(t) => set({ city: t })} />
      <TextField label="Pincode" value={form.pincode} onChangeText={(t) => set({ pincode: t.replace(/\D/g, '').slice(0, 6) })} keyboardType="number-pad" />
      <TextField label="Emergency contact name" value={form.emergencyContactName} onChangeText={(t) => set({ emergencyContactName: t })} />
      <TextField label="Emergency mobile" prefix="+91" value={form.emergencyContact} onChangeText={(t) => set({ emergencyContact: t.replace(/\D/g, '').slice(0, 10) })} keyboardType="phone-pad" />
      <Text style={[type.h3, { marginVertical: space.sm }]}>Bank account</Text>
      <TextField label="Account holder" value={form.bank.accountHolder} onChangeText={(t) => setBank({ accountHolder: t })} />
      <TextField label="Account number" value={form.bank.accountNumber} onChangeText={(t) => setBank({ accountNumber: t.replace(/\D/g, '').slice(0, 18) })} keyboardType="number-pad" secureTextEntry />
      <TextField label="Confirm account number" value={confirm} onChangeText={(t) => setConfirm(t.replace(/\D/g, '').slice(0, 18))} keyboardType="number-pad" contextMenuHidden />
      <TextField label="IFSC" value={form.bank.ifsc} onChangeText={(t) => setBank({ ifsc: t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) })} autoCapitalize="characters" />
      <TextField label="Bank name" value={form.bank.bankName} onChangeText={(t) => setBank({ bankName: t })} />
      <TextField label="UPI ID" value={form.bank.upiId} onChangeText={(t) => setBank({ upiId: t.trim() })} autoCapitalize="none" />
      <Notice message={error} />
      <Button title={saving ? 'Saving…' : 'Save'} loading={saving} onPress={() => void save()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  idCard: { flexDirection: 'row', gap: space.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  docs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  doc: { width: '31%', gap: 4 },
  docImg: { width: '100%', height: 72, borderRadius: radius.sm, backgroundColor: colors.bg },
  docMissing: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  docLabel: { fontSize: 11, fontWeight: '700', color: colors.text },
});
