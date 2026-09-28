// Six-step driver KYC wizard (native port of driver/web RegistrationScreen.tsx).
// Modes: 'signup' (new driver), 'resubmit' (after rejection), 'update'
// (approved driver refreshing documents). The signup draft survives an app
// restart (AsyncStorage; the Web used localStorage).
import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import type { ApprovalStatus, RegistrationData, VehicleCategory } from '../types/driver';
import { Button, Card, Notice, Row, TextField } from '../components/ui';
import { DateField, OptionChips, PhotoField, displayDate } from '../components/forms';
import { registerDriver, resubmitDriverDocuments } from '../services/driverService';
import { localDateISO, maskAadhaar, maskAccount, validateStep, type Errors } from '../validation/kyc';
import { describeError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';

export type RegistrationMode = 'signup' | 'resubmit' | 'update';

const STEPS = ['Personal', 'ID & Licence', 'Vehicle', 'Vehicle docs', 'Bank', 'Review'];

const VEHICLE_TYPES: { value: VehicleCategory; label: string; seats: number }[] = [
  { value: 'Hatchback', label: 'Hatchback', seats: 4 },
  { value: 'Sedan', label: 'Sedan', seats: 4 },
  { value: 'SUV', label: 'SUV', seats: 6 },
  { value: 'Premium SUV', label: 'Premium SUV', seats: 7 },
  { value: 'Tempo Traveller', label: 'Tempo Traveller', seats: 12 },
];

const draftKey = (uid: string) => `nesam-driver-signup-draft-${uid}`;

interface Props {
  uid: string;
  mode: RegistrationMode;
  initial: RegistrationData;
  currentStatus?: ApprovalStatus;
  rejectionReason?: string;
  vendorName?: string;
  onDone?: () => void;
  onCancel?: () => void;
  onSignOut?: () => void;
}

export function RegistrationScreen({ uid, mode, initial, currentStatus, rejectionReason, vendorName, onDone, onCancel, onSignOut }: Props) {
  const [data, setData] = useState<RegistrationData>(initial);
  const [step, setStep] = useState(1);
  const [draftLoaded, setDraftLoaded] = useState(mode !== 'signup');
  const [confirmAccount, setConfirmAccount] = useState(initial.bank.accountNumber);
  const [errors, setErrors] = useState<Errors>({});
  const [showPhotoErrors, setShowPhotoErrors] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [uploads, setUploads] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const submittingRef = useRef(false);

  // Restore a signup draft (the verified phone always comes from auth).
  useEffect(() => {
    if (mode !== 'signup') return undefined;
    let alive = true;
    AsyncStorage.getItem(draftKey(uid))
      .then((raw) => {
        if (!alive || !raw) return;
        const draft = JSON.parse(raw) as { data: RegistrationData; step: number };
        if (draft?.data?.profile) {
          setData({ ...draft.data, profile: { ...draft.data.profile, phone: initial.profile.phone } });
          setConfirmAccount(draft.data.bank?.accountNumber ?? '');
          setStep(Math.min(Math.max(1, draft.step || 1), STEPS.length));
        }
      })
      .catch(() => undefined)
      .finally(() => alive && setDraftLoaded(true));
    return () => {
      alive = false;
    };
  }, [mode, uid, initial.profile.phone]);

  useEffect(() => {
    if (mode !== 'signup' || !draftLoaded) return;
    AsyncStorage.setItem(draftKey(uid), JSON.stringify({ data, step })).catch(() => undefined);
  }, [mode, draftLoaded, uid, data, step]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [step]);

  // Android back walks back through the steps instead of leaving the form.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (submitting) return true;
      if (step > 1) {
        setErrors({});
        setStep((s) => s - 1);
        return true;
      }
      if (onCancel) {
        onCancel();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, submitting, onCancel]);

  const setProfile = (patch: Partial<RegistrationData['profile']>) => setData((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  const setIdentity = (patch: Partial<RegistrationData['identity']>) => setData((d) => ({ ...d, identity: { ...d.identity, ...patch } }));
  const setLicense = (patch: Partial<RegistrationData['license']>) => setData((d) => ({ ...d, license: { ...d.license, ...patch } }));
  const setVehicle = (patch: Partial<RegistrationData['vehicle']>) => setData((d) => ({ ...d, vehicle: { ...d.vehicle, ...patch } }));
  const setBank = (patch: Partial<RegistrationData['bank']>) => setData((d) => ({ ...d, bank: { ...d.bank, ...patch } }));
  const onBusy = (busy: boolean) => setUploads((n) => Math.max(0, n + (busy ? 1 : -1)));

  const goNext = () => {
    if (uploads > 0) return setSubmitError('Please wait for uploads to finish.');
    const errs = validateStep(step, data, confirmAccount);
    setErrors(errs);
    setShowPhotoErrors(true);
    setSubmitError('');
    if (Object.keys(errs).length > 0) return undefined;
    setShowPhotoErrors(false);
    setStep((s) => Math.min(s + 1, STEPS.length));
    return undefined;
  };

  const jumpTo = (target: number) => {
    if (target <= step) {
      setErrors({});
      setStep(target);
      return;
    }
    for (let s = step; s < target; s++) {
      const errs = validateStep(s, data, confirmAccount);
      if (Object.keys(errs).length) {
        setStep(s);
        setErrors(errs);
        setShowPhotoErrors(true);
        return;
      }
    }
    setStep(target);
  };

  const submit = async () => {
    if (submittingRef.current) return;
    for (let s = 1; s <= 5; s++) {
      const errs = validateStep(s, data, confirmAccount);
      if (Object.keys(errs).length) {
        setStep(s);
        setErrors(errs);
        setShowPhotoErrors(true);
        return;
      }
    }
    if (!consent) {
      setSubmitError('Please confirm the declaration to continue.');
      return;
    }
    submittingRef.current = true;
    setSubmitError('');
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await registerDriver(data);
        await AsyncStorage.removeItem(draftKey(uid)).catch(() => undefined);
      } else {
        await resubmitDriverDocuments(uid, data, currentStatus ?? 'Pending');
      }
      onDone?.();
    } catch (err) {
      setSubmitError(describeError(err, 'We could not save your application. Please sign out, sign in again and retry.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const confirmLeave = () => {
    if (!onCancel) return;
    Alert.alert('Leave without saving?', 'Changes on this form will be lost.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: onCancel },
    ]);
  };

  const title = mode === 'signup' ? 'Driver Partner Registration' : mode === 'resubmit' ? 'Update & Resubmit' : 'Update Documents';
  const p = data.profile;
  const id = data.identity;
  const l = data.license;
  const v = data.vehicle;
  const b = data.bank;
  const today = localDateISO();
  const dobMax = new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate());

  if (!draftLoaded) return null;

  return (
    <SafeAreaView style={styles.root} edges={mode === 'update' ? [] : ['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {mode !== 'update' ? (
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={type.h2}>{title}</Text>
              <Text style={type.small}>Verified mobile: {p.phone}</Text>
            </View>
            {onCancel ? <Button small variant="secondary" title="Back" onPress={confirmLeave} /> : null}
            {onSignOut ? <Button small variant="ghost" title="Sign out" onPress={onSignOut} /> : null}
          </View>
        ) : null}

        {vendorName && mode === 'signup' ? <Notice tone="info" message={`You were invited by ${vendorName}. Your account will be linked to this fleet.`} /> : null}
        {mode === 'resubmit' && rejectionReason ? <Notice message={`Reason for rejection: ${rejectionReason}`} /> : null}
        {mode === 'update' ? <Notice tone="warning" message="Updated documents are re-verified by the NESAM team. You can keep taking trips meanwhile." /> : null}

        <View style={styles.stepper}>
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <Pressable key={label} onPress={() => jumpTo(n)} style={styles.stepItem} accessibilityRole="button" accessibilityLabel={`Step ${n}: ${label}`}>
                <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
                  {done ? <Ionicons name="checkmark" size={14} color={colors.white} /> : <Text style={[styles.stepNum, active && { color: colors.white }]}>{n}</Text>}
                </View>
                <Text style={[styles.stepLabel, active && { color: colors.ink }]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Card>
          {step === 1 ? (
            <>
              <Text style={styles.sectionTitle}>Personal details</Text>
              <PhotoField
                label="Profile photo"
                hint="Clear front-facing photo, no sunglasses"
                value={p.photoUrl}
                folder="kyc"
                name="profile"
                required
                showError={showPhotoErrors}
                onBusyChange={onBusy}
                onChange={(url) => setProfile({ photoUrl: url })}
              />
              <TextField label="Full name (as on licence)" required value={p.name} onChangeText={(t) => setProfile({ name: t })} error={errors.name} autoComplete="name" />
              <DateField label="Date of birth" required value={p.dob} onChange={(d) => setProfile({ dob: d })} maximumDate={dobMax} error={errors.dob} />
              <OptionChips
                label="Gender"
                required
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'Other', label: 'Other' },
                ]}
                value={p.gender as 'Male' | 'Female' | 'Other' | ''}
                onChange={(g) => setProfile({ gender: g })}
                error={errors.gender}
              />
              <TextField label="Email (optional)" value={p.email} onChangeText={(t) => setProfile({ email: t })} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
              <TextField label="Residential address" required value={p.address} onChangeText={(t) => setProfile({ address: t })} multiline error={errors.address} />
              <TextField label="City" required value={p.city} onChangeText={(t) => setProfile({ city: t })} error={errors.city} />
              <TextField label="Pincode" required value={p.pincode} onChangeText={(t) => setProfile({ pincode: t.replace(/\D/g, '').slice(0, 6) })} keyboardType="number-pad" maxLength={6} error={errors.pincode} />
              <TextField label="Emergency contact name" required value={p.emergencyContactName} onChangeText={(t) => setProfile({ emergencyContactName: t })} error={errors.emergencyContactName} />
              <TextField
                label="Emergency contact mobile"
                required
                prefix="+91"
                value={p.emergencyContact}
                onChangeText={(t) => setProfile({ emergencyContact: t.replace(/\D/g, '').slice(0, 10) })}
                keyboardType="phone-pad"
                maxLength={10}
                error={errors.emergencyContact}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.sectionTitle}>Identity proof</Text>
              <TextField
                label="Aadhaar number"
                required
                value={id.aadhaarNumber}
                onChangeText={(t) => setIdentity({ aadhaarNumber: t.replace(/\D/g, '').slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ') })}
                keyboardType="number-pad"
                maxLength={14}
                placeholder="1234 5678 9012"
                error={errors.aadhaarNumber}
              />
              <PhotoField label="Aadhaar front" value={id.aadhaarFrontUrl} folder="kyc" name="aadhaar-front" required showError={showPhotoErrors} onBusyChange={onBusy} onChange={(url) => setIdentity({ aadhaarFrontUrl: url })} />
              <PhotoField label="Aadhaar back" value={id.aadhaarBackUrl} folder="kyc" name="aadhaar-back" required showError={showPhotoErrors} onBusyChange={onBusy} onChange={(url) => setIdentity({ aadhaarBackUrl: url })} />
              <TextField
                label="PAN number (optional)"
                value={id.panNumber}
                onChangeText={(t) => setIdentity({ panNumber: t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) })}
                autoCapitalize="characters"
                maxLength={10}
                placeholder="ABCDE1234F"
                error={errors.panNumber}
              />
              <PhotoField label="PAN card" hint="Optional" value={id.panPhotoUrl} folder="kyc" name="pan" onBusyChange={onBusy} onChange={(url) => setIdentity({ panPhotoUrl: url })} />
              <Text style={[styles.sectionTitle, { marginTop: space.md }]}>Driving licence</Text>
              <TextField
                label="Driving licence number"
                required
                value={l.number}
                onChangeText={(t) => setLicense({ number: t.toUpperCase() })}
                autoCapitalize="characters"
                placeholder="TN01 20190012345"
                error={errors.licenseNumber}
              />
              <DateField label="Licence valid till" required value={l.expiryDate} onChange={(d) => setLicense({ expiryDate: d })} minimumDate={new Date()} error={errors.licenseExpiry} />
              <PhotoField label="Licence front" value={l.frontPhotoUrl} folder="kyc" name="dl-front" required showError={showPhotoErrors} onBusyChange={onBusy} onChange={(url) => setLicense({ frontPhotoUrl: url })} />
              <PhotoField label="Licence back" value={l.backPhotoUrl} folder="kyc" name="dl-back" required showError={showPhotoErrors} onBusyChange={onBusy} onChange={(url) => setLicense({ backPhotoUrl: url })} />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={styles.sectionTitle}>Vehicle details</Text>
              <TextField
                label="Registration number"
                required
                value={v.vehicleNumber}
                onChangeText={(t) => setVehicle({ vehicleNumber: t.toUpperCase() })}
                autoCapitalize="characters"
                placeholder="TN 01 AB 1234"
                error={errors.vehicleNumber}
              />
              <OptionChips
                label="Vehicle category"
                required
                options={VEHICLE_TYPES.map((t) => ({ value: t.value, label: `${t.label} (${t.seats})` }))}
                value={v.vehicleType}
                onChange={(val) => {
                  const t = VEHICLE_TYPES.find((x) => x.value === val)!;
                  setVehicle({ vehicleType: t.value, capacity: t.seats });
                }}
              />
              <TextField label="Make / brand" required value={v.make} onChangeText={(t) => setVehicle({ make: t })} placeholder="Maruti Suzuki" error={errors.make} />
              <TextField label="Model" required value={v.model} onChangeText={(t) => setVehicle({ model: t })} placeholder="Dzire" error={errors.model} />
              <TextField label="Manufacturing year" required value={v.year} onChangeText={(t) => setVehicle({ year: t.replace(/\D/g, '').slice(0, 4) })} keyboardType="number-pad" maxLength={4} error={errors.year} />
              <TextField label="Colour" required value={v.color} onChangeText={(t) => setVehicle({ color: t })} placeholder="White" error={errors.color} />
              <TextField
                label="Seating capacity (excl. driver)"
                required
                value={v.capacity ? String(v.capacity) : ''}
                onChangeText={(t) => setVehicle({ capacity: Number(t.replace(/\D/g, '').slice(0, 2)) || 0 })}
                keyboardType="number-pad"
                maxLength={2}
                error={errors.capacity}
              />
              <OptionChips
                label="Fuel type"
                required
                options={['Diesel', 'Petrol', 'CNG', 'Electric'].map((f) => ({ value: f, label: f }))}
                value={v.fuelType}
                onChange={(f) => setVehicle({ fuelType: f })}
              />
              <Text style={[styles.sectionTitle, { marginTop: space.sm }]}>Vehicle photos</Text>
              <PhotoField label="Front (with plate)" value={v.frontPhotoUrl} folder="vehicle" name="front" required showError={showPhotoErrors} onBusyChange={onBusy} onChange={(url) => setVehicle({ frontPhotoUrl: url })} />
              <PhotoField label="Rear (with plate)" value={v.rearPhotoUrl} folder="vehicle" name="rear" required showError={showPhotoErrors} onBusyChange={onBusy} onChange={(url) => setVehicle({ rearPhotoUrl: url })} />
              <PhotoField label="Side view" value={v.sidePhotoUrl} folder="vehicle" name="side" required showError={showPhotoErrors} onBusyChange={onBusy} onChange={(url) => setVehicle({ sidePhotoUrl: url })} />
              <PhotoField label="Interior" value={v.interiorPhotoUrl} folder="vehicle" name="interior" required showError={showPhotoErrors} onBusyChange={onBusy} onChange={(url) => setVehicle({ interiorPhotoUrl: url })} />
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Text style={styles.sectionTitle}>Registration certificate (RC)</Text>
              <TextField label="RC number" required value={v.rcNumber} onChangeText={(t) => setVehicle({ rcNumber: t.toUpperCase() })} autoCapitalize="characters" error={errors.rcNumber} />
              <PhotoField label="RC photo" value={v.rcDocUrl} folder="vehicle" name="rc" required showError={showPhotoErrors} onBusyChange={onBusy} onChange={(url) => setVehicle({ rcDocUrl: url })} />
              <Text style={styles.sectionTitle}>Commercial insurance</Text>
              <TextField label="Policy number" required value={v.insuranceNumber} onChangeText={(t) => setVehicle({ insuranceNumber: t })} error={errors.insuranceNumber} />
              <DateField label="Insurance valid till" required value={v.insuranceExpiry} onChange={(d) => setVehicle({ insuranceExpiry: d })} minimumDate={new Date()} error={errors.insuranceExpiry} />
              <PhotoField label="Insurance policy" value={v.insuranceDocUrl} folder="vehicle" name="insurance" required showError={showPhotoErrors} onBusyChange={onBusy} onChange={(url) => setVehicle({ insuranceDocUrl: url })} />
              <Text style={styles.sectionTitle}>Taxi / tourist permit</Text>
              <TextField label="Permit number" required value={v.statePermitNumber} onChangeText={(t) => setVehicle({ statePermitNumber: t })} error={errors.statePermitNumber} />
              <DateField label="Permit valid till" required value={v.permitExpiry} onChange={(d) => setVehicle({ permitExpiry: d })} minimumDate={new Date()} error={errors.permitExpiry} />
              <PhotoField label="Permit document" value={v.statePermitDocUrl} folder="vehicle" name="permit" required showError={showPhotoErrors} onBusyChange={onBusy} onChange={(url) => setVehicle({ statePermitDocUrl: url })} />
              <Text style={styles.sectionTitle}>Fitness certificate (FC) — if applicable</Text>
              <DateField label="FC valid till" value={v.fitnessExpiry} onChange={(d) => setVehicle({ fitnessExpiry: d })} minimumDate={new Date()} error={errors.fitnessExpiry} />
              <PhotoField label="FC document" value={v.fitnessDocUrl} folder="vehicle" name="fitness" onBusyChange={onBusy} onChange={(url) => setVehicle({ fitnessDocUrl: url })} />
              <Text style={styles.sectionTitle}>Pollution (PUC)</Text>
              <Text style={type.small}>Carry a valid PUC certificate in the vehicle; NESAM operations may ask for it during audits.</Text>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <Text style={styles.sectionTitle}>Payout bank account</Text>
              <Text style={[type.small, { marginBottom: space.md }]}>Your trip earnings are paid to this account.</Text>
              <TextField label="Account holder name" required value={b.accountHolder} onChangeText={(t) => setBank({ accountHolder: t })} error={errors.accountHolder} />
              <TextField
                label="Account number"
                required
                value={b.accountNumber}
                onChangeText={(t) => setBank({ accountNumber: t.replace(/\D/g, '').slice(0, 18) })}
                keyboardType="number-pad"
                secureTextEntry
                autoComplete="off"
                error={errors.accountNumber}
              />
              <TextField
                label="Confirm account number"
                required
                value={confirmAccount}
                onChangeText={(t) => setConfirmAccount(t.replace(/\D/g, '').slice(0, 18))}
                keyboardType="number-pad"
                autoComplete="off"
                contextMenuHidden
                error={errors.confirmAccount}
              />
              <TextField
                label="IFSC code"
                required
                value={b.ifsc}
                onChangeText={(t) => setBank({ ifsc: t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) })}
                autoCapitalize="characters"
                maxLength={11}
                placeholder="SBIN0001234"
                error={errors.ifsc}
              />
              <TextField label="Bank name" value={b.bankName} onChangeText={(t) => setBank({ bankName: t })} />
              <TextField label="UPI ID (optional)" value={b.upiId} onChangeText={(t) => setBank({ upiId: t.trim() })} autoCapitalize="none" placeholder="name@okaxis" error={errors.upiId} />
            </>
          ) : null}

          {step === 6 ? (
            <>
              <Text style={styles.sectionTitle}>Review & submit</Text>
              <View style={styles.reviewHead}>
                {p.photoUrl ? <Image source={{ uri: p.photoUrl }} style={styles.reviewPhoto} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{p.name}</Text>
                  <Text style={type.small}>{p.phone}</Text>
                </View>
              </View>
              <ReviewSection title="Personal" onEdit={() => setStep(1)}>
                <Row label="Date of birth" value={displayDate(p.dob)} />
                <Row label="Gender" value={p.gender} />
                <Row label="Email" value={p.email || '—'} />
                <Row label="Address" value={`${p.address}, ${p.city} - ${p.pincode}`} />
                <Row label="Emergency" value={`${p.emergencyContactName} (${p.emergencyContact})`} />
              </ReviewSection>
              <ReviewSection title="Identity & licence" onEdit={() => setStep(2)}>
                <Row label="Aadhaar" value={maskAadhaar(id.aadhaarNumber)} />
                <Row label="PAN" value={id.panNumber || '—'} />
                <Row label="Licence no." value={l.number} />
                <Row label="Licence valid till" value={displayDate(l.expiryDate)} />
              </ReviewSection>
              <ReviewSection title="Vehicle" onEdit={() => setStep(3)}>
                <Row label="Registration" value={v.vehicleNumber} />
                <Row label="Vehicle" value={`${v.make} ${v.model} (${v.year}) • ${v.color}`} />
                <Row label="Category" value={`${v.vehicleType} • ${v.capacity} seats • ${v.fuelType}`} />
                <Row label="RC no." value={v.rcNumber} />
                <Row label="Insurance till" value={displayDate(v.insuranceExpiry)} />
                <Row label="Permit till" value={displayDate(v.permitExpiry)} />
                <Row label="FC till" value={v.fitnessExpiry ? displayDate(v.fitnessExpiry) : '—'} />
              </ReviewSection>
              <ReviewSection title="Bank" onEdit={() => setStep(5)}>
                <Row label="Account holder" value={b.accountHolder} />
                <Row label="Account no." value={maskAccount(b.accountNumber)} />
                <Row label="IFSC" value={b.ifsc} />
                <Row label="UPI" value={b.upiId || '—'} />
              </ReviewSection>
              {[v.insuranceExpiry, v.permitExpiry, l.expiryDate].some((d) => d && d <= today) ? (
                <Notice message="A document above has expired. Go back and update it before submitting." />
              ) : null}
              <Pressable style={styles.consent} onPress={() => setConsent((c) => !c)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
                <Switch value={consent} onValueChange={setConsent} trackColor={{ true: colors.primary, false: colors.border }} />
                <Text style={[type.small, { flex: 1 }]}>
                  I declare that the information and documents provided are genuine and belong to me / my vehicle, and I authorise NESAM Tours & Travels to verify them.
                </Text>
              </Pressable>
            </>
          ) : null}

          <Notice message={submitError} />
          {Object.keys(errors).length > 0 ? <Text style={styles.fixHint}>Please fix the highlighted fields.</Text> : null}

          <View style={styles.nav}>
            <Button
              title="Back"
              variant="secondary"
              disabled={step === 1 || submitting}
              onPress={() => {
                setErrors({});
                setStep((s) => Math.max(1, s - 1));
              }}
              style={{ flex: 1 }}
            />
            {step < STEPS.length ? (
              <Button title={uploads > 0 ? 'Uploading…' : 'Save & continue'} disabled={uploads > 0} onPress={goNext} style={{ flex: 2 }} />
            ) : (
              <Button
                title={submitting ? 'Submitting…' : mode === 'signup' ? 'Submit for verification' : 'Resubmit for verification'}
                loading={submitting}
                disabled={!consent}
                onPress={() => void submit()}
                style={{ flex: 2 }}
              />
            )}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.reviewSection}>
      <View style={styles.reviewTitleRow}>
        <Text style={type.h3}>{title}</Text>
        <Text style={styles.edit} onPress={onEdit} accessibilityRole="button">
          Edit
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  stepper: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: space.sm, marginBottom: space.md, borderWidth: 1, borderColor: colors.border },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  stepDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepNum: { fontSize: 12, fontWeight: '800', color: colors.muted },
  stepLabel: { fontSize: 9, fontWeight: '700', color: colors.muted },
  sectionTitle: { ...type.h3, marginBottom: space.md },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  reviewPhoto: { width: 52, height: 52, borderRadius: 12 },
  reviewSection: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  reviewTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  edit: { color: colors.primary, fontWeight: '800' },
  consent: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  fixHint: { color: colors.primaryDark, fontSize: 12, fontWeight: '700', textAlign: 'right', marginBottom: space.sm },
  nav: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
});
