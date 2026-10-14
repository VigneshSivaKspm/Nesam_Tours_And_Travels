// Vendor onboarding wizard (spec page 13): business + account details, then
// fleet documentation (each vehicle detected from its registration number, with
// RC, insurance, FC, permit and a front photo), then Admin approval.
// Progress is saved to vendors/{uid} after every step, so the application can be
// resumed on any device; admin-flagged sections are highlighted.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { FleetVehicleDoc, OnboardingSection, PayoutDetails, StoredFile, VendorRecord } from '../../types/vendor';
import { ONBOARDING_STEPS, SECTION_LABELS, stepOfSection } from '../../config/onboarding';
import {
  EDITABLE_STATUSES,
  getVendorInvite,
  getVendorKyc,
  missingSections,
  saveBusinessAccountStep,
  saveFleetStep,
  submitForReview,
  type VendorInvite,
  type VendorKyc,
} from '../../services/onboardingService';
import { digitsOnly, hasErrors, normalizeSpaces, validateAccountNumber, validateBusinessName, validateIfsc, validatePersonName, validateUpi } from '../../utils/validation';
import { buildFleetDetails, emptyVehicle, indiaToday, isPlate, normalizePlate, validateVehicle, type VehicleErrors } from '../../utils/fleet';
import { applyDetection, lookupVehicle, type VehicleLookupResult } from '../../services/vehicleLookup';
import { describeDataError } from '../../utils/retry';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { Badge, Button, Card, Chip, FullScreenLoader, Notice, Row, TextField } from '../../components/ui';
import { FileUploadField } from '../../components/FileUploadField';
import { DateField, displayDate } from '../../components/fields';
import { colors, radius, space, type } from '../../theme';

const VEHICLE_TYPE_CHOICES = ['Hatchback', 'Sedan', 'SUV', 'Premium SUV', 'Tempo Traveller'] as const;
const DETECT_DELAY_MS = 800;

interface WizardProps {
  record: VendorRecord | null;
  phone: string;
  notice?: string;
  onSignOut: () => void;
}

function initialStep(record: VendorRecord | null): number {
  if (!record) return 0;
  if ((record.status === 'CHANGES_REQUESTED' || record.status === 'REJECTED') && record.review?.flaggedSections.length) {
    return stepOfSection(record.review.flaggedSections[0]!);
  }
  return Math.min(record.onboardingStep, ONBOARDING_STEPS.length - 1);
}

export function OnboardingWizard({ record, phone, notice, onSignOut }: WizardProps) {
  const { online } = useNetworkStatus();
  const [step, setStep] = useState(() => initialStep(record));
  const [invite, setInvite] = useState<VendorInvite | null>(null);
  const [kyc, setKyc] = useState<VendorKyc | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(true);
  const hasRecord = !!record;

  // One-time prefill: admin pre-approval (by phone) + private account details (resuming vendors).
  useEffect(() => {
    let alive = true;
    Promise.all([getVendorInvite(phone), hasRecord ? getVendorKyc().catch(() => null) : Promise.resolve(null)]).then(([inv, k]) => {
      if (!alive) return;
      setInvite(inv);
      setKyc(k);
      setPrefillLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [phone, hasRecord]);

  const maxReachable = Math.max(record?.onboardingStep ?? 0, step);
  const next = useCallback(() => setStep((s) => Math.min(s + 1, ONBOARDING_STEPS.length - 1)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  // Android back steps backwards through the wizard.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, back]);

  if (prefillLoading) return <FullScreenLoader label="Preparing your application…" />;

  const correction = record && (record.status === 'CHANGES_REQUESTED' || record.status === 'REJECTED') ? record : null;
  const current = ONBOARDING_STEPS[step]!;
  const flagged = correction?.review?.flaggedSections ?? [];

  let body: React.ReactNode;
  if (!record) body = <FullScreenLoader label="Saving…" />;
  else if (step === 0) body = <BusinessAccountStep record={record} kyc={kyc} onKycChange={setKyc} onNext={next} />;
  else if (step === 1) body = <FleetStep record={record} onNext={next} onBack={back} />;
  else body = <ReviewStep record={record} preApproved={!!invite?.preApproved} onEdit={(i) => i <= maxReachable && setStep(i)} onBack={back} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={type.h3}>Fleet Partner Onboarding</Text>
          <Text style={type.tiny}>{phone}</Text>
        </View>
        <Button small variant="ghost" title="Sign out" onPress={onSignOut} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.stepper}>
          {ONBOARDING_STEPS.map((s, i) => {
            const done = i < step || (record?.onboardingStep ?? 0) > i;
            const active = i === step;
            const isFlagged = flagged.some((f) => stepOfSection(f) === i);
            return (
              <Pressable key={s.key} onPress={() => i <= maxReachable && setStep(i)} disabled={i > maxReachable} style={styles.stepItem} accessibilityRole="button" accessibilityLabel={`Step ${i + 1}: ${s.title}`}>
                <View style={[styles.stepDot, active && styles.stepActive, !active && isFlagged && styles.stepFlagged, !active && !isFlagged && done && styles.stepDone]}>
                  {done && !active && !isFlagged ? <Ionicons name="checkmark" size={14} color={colors.success} /> : <Text style={[styles.stepNum, active && { color: colors.white }]}>{i + 1}</Text>}
                </View>
                <Text style={[styles.stepLabel, active && { color: colors.ink }]} numberOfLines={1}>
                  {s.short}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!online ? <Notice tone="warning" message="You’re offline. Uploads and saves will fail until you reconnect." /> : null}
        {notice && step === 0 ? <Notice tone="info" message={notice} /> : null}
        {correction ? (
          <Notice
            tone="warning"
            message={`${correction.status === 'REJECTED' ? 'Your application was not approved.' : 'The NESAM team requested changes.'}${
              correction.review?.note ? `\n${correction.review.note}` : ''
            }${flagged.length ? `\nPlease update: ${flagged.map((s) => SECTION_LABELS[s]).join(', ')}. Then resubmit from the final step.` : ''}`}
          />
        ) : null}

        <Card>
          <Text style={type.tiny}>
            STEP {step + 1} OF {ONBOARDING_STEPS.length}
          </Text>
          <Text style={[type.h2, { marginBottom: space.md }]}>{current.title}</Text>
          {body}
        </Card>
        <Text style={[type.tiny, { textAlign: 'center' }]}>Your progress is saved after each step — you can sign out and continue later.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Step 1: business + account details ──────────────────────────────────────

function BusinessAccountStep({ record, kyc, onKycChange, onNext }: { record: VendorRecord; kyc: VendorKyc | null; onKycChange: (k: VendorKyc) => void; onNext: () => void }) {
  const b = record.business;
  const saved = kyc?.payout;
  const [form, setForm] = useState({
    vendorName: b?.vendorName ?? '',
    businessName: b?.businessName ?? '',
    accountHolderName: saved?.accountHolderName ?? b?.vendorName ?? '',
    accountNumber: saved?.accountNumber ?? '',
    confirmAccountNumber: saved?.accountNumber ?? '',
    ifsc: saved?.ifsc ?? '',
    upiId: saved?.upiId ?? '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const errors = useMemo(
    () => ({
      vendorName: validatePersonName(form.vendorName, 'Owner name'),
      businessName: validateBusinessName(form.businessName),
      accountHolderName: validatePersonName(form.accountHolderName, 'Account holder name'),
      accountNumber: validateAccountNumber(form.accountNumber),
      confirmAccountNumber: !form.confirmAccountNumber ? 'Please re-enter the account number.' : form.confirmAccountNumber !== form.accountNumber ? 'Account numbers do not match.' : '',
      ifsc: validateIfsc(form.ifsc),
      upiId: validateUpi(form.upiId),
    }),
    [form],
  );
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const err = (key: keyof typeof errors) => (submitted ? errors[key] : '');

  const submit = async () => {
    setSubmitted(true);
    if (hasErrors(errors) || saving) return;
    const payout: PayoutDetails = {
      accountHolderName: normalizeSpaces(form.accountHolderName),
      accountNumber: digitsOnly(form.accountNumber),
      ifsc: form.ifsc.trim().toUpperCase(),
      upiId: form.upiId.trim().toLowerCase(),
    };
    setSaving(true);
    setSaveError('');
    try {
      await saveBusinessAccountStep(record, { vendorName: normalizeSpaces(form.vendorName), businessName: normalizeSpaces(form.businessName) }, payout);
      onKycChange({ identityNumber: kyc?.identityNumber ?? '', payout });
      onNext();
    } catch (e) {
      setSaveError(describeDataError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <Text style={[type.h3, { marginBottom: space.sm }]}>Business details</Text>
      <TextField label="Owner name" required value={form.vendorName} onChangeText={set('vendorName')} error={err('vendorName')} placeholder="Ravi Kumar" autoComplete="name" />
      <TextField label="Business / agency name" required value={form.businessName} onChangeText={set('businessName')} error={err('businessName')} placeholder="Sri Balaji Travels" />

      <Text style={[type.h3, { marginVertical: space.sm }]}>Account details</Text>
      <TextField label="Bank account holder name" required value={form.accountHolderName} onChangeText={set('accountHolderName')} error={err('accountHolderName')} hint="Exactly as printed on your passbook / cheque" />
      <TextField label="Account number" required value={form.accountNumber} onChangeText={(v) => set('accountNumber')(digitsOnly(v).slice(0, 18))} error={err('accountNumber')} keyboardType="number-pad" secureTextEntry autoComplete="off" />
      <TextField
        label="Confirm account number"
        required
        value={form.confirmAccountNumber}
        onChangeText={(v) => set('confirmAccountNumber')(digitsOnly(v).slice(0, 18))}
        error={err('confirmAccountNumber')}
        keyboardType="number-pad"
        contextMenuHidden
        autoComplete="off"
      />
      <TextField label="IFSC code" required value={form.ifsc} onChangeText={(v) => set('ifsc')(v.toUpperCase().replace(/\s/g, '').slice(0, 11))} error={err('ifsc')} placeholder="SBIN0001234" autoCapitalize="characters" />
      <TextField label="UPI ID" value={form.upiId} onChangeText={(v) => set('upiId')(v.replace(/\s/g, ''))} error={err('upiId')} placeholder="business@okhdfcbank" hint="Optional · used for instant settlements" autoCapitalize="none" />
      <Text style={[type.tiny, { marginBottom: space.md }]}>
        Account details are stored in a restricted record visible only to you and the NESAM finance team. After approval, changes require re-verification by support.
      </Text>
      {submitted && hasErrors(errors) ? <Notice message="Please fix the highlighted fields." /> : null}
      <Notice message={saveError} onRetry={saveError ? () => void submit() : undefined} />
      <Button title={saving ? 'Saving…' : 'Save & continue'} loading={saving} onPress={() => void submit()} />
    </View>
  );
}

// ── Step 2: fleet documentation ─────────────────────────────────────────────

type Detection = { state: 'idle' } | { state: 'loading' } | { state: 'done'; result: VehicleLookupResult } | { state: 'error'; message: string };

function FleetStep({ record, onNext, onBack }: { record: VendorRecord; onNext: () => void; onBack: () => void }) {
  const saved = useMemo(() => record.fleet?.vehicles ?? [], [record.fleet]);
  const legacy = !!record.fleet && !record.fleet.vehicles?.length;
  const [vehicles, setVehicles] = useState<FleetVehicleDoc[]>(saved);
  const [draft, setDraft] = useState<FleetVehicleDoc>(emptyVehicle());
  const [adding, setAdding] = useState(saved.length === 0);
  const [detection, setDetection] = useState<Detection>({ state: 'idle' });
  const [detectedFor, setDetectedFor] = useState('');
  const [errors, setErrors] = useState<VehicleErrors>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [stepError, setStepError] = useState('');
  const seq = useRef(0);

  const persisted = useMemo(
    () => new Set(saved.flatMap((v) => [...v.rcFiles, ...v.insuranceFiles, ...v.fitnessFiles, ...v.permitFiles, ...v.frontPhotoFiles].map((f) => f.path))),
    [saved],
  );
  const busySetter = useCallback((k: string) => (v: boolean) => setBusy((b) => (b[k] === v ? b : { ...b, [k]: v })), []);
  const onRc = useMemo(() => busySetter('rc'), [busySetter]);
  const onIns = useMemo(() => busySetter('ins'), [busySetter]);
  const onFc = useMemo(() => busySetter('fc'), [busySetter]);
  const onPermit = useMemo(() => busySetter('permit'), [busySetter]);
  const onFront = useMemo(() => busySetter('front'), [busySetter]);
  const uploading = Object.values(busy).some(Boolean);

  const plate = normalizePlate(draft.registrationNumber);
  const result = detection.state === 'done' ? detection.result : null;
  const manual = result != null && (result.status === 'unavailable' || result.status === 'not_configured');

  const detect = useCallback(async (raw: string) => {
    const wanted = normalizePlate(raw);
    if (!isPlate(wanted)) return;
    const mine = ++seq.current;
    setDetection({ state: 'loading' });
    try {
      const r = await lookupVehicle(wanted);
      if (mine !== seq.current) return;
      setDetection({ state: 'done', result: r });
      setDetectedFor(wanted);
      if (r.status === 'found') setDraft((d) => applyDetection(d, r, indiaToday()));
      else setDraft((d) => ({ ...d, source: 'manual', registrationNumber: raw.trim().toUpperCase() }));
    } catch (e) {
      if (mine !== seq.current) return;
      setDetection({ state: 'error', message: describeDataError(e) });
    }
  }, []);

  // Detect on its own once a full plate is typed (from idle only: errors are retried by the button).
  useEffect(() => {
    if (!adding || !isPlate(draft.registrationNumber) || detectedFor === plate || detection.state !== 'idle') return undefined;
    const t = setTimeout(() => void detect(draft.registrationNumber), DETECT_DELAY_MS);
    return () => clearTimeout(t);
  }, [adding, draft.registrationNumber, plate, detectedFor, detection.state, detect]);

  const onPlate = (text: string) => {
    const upper = text.toUpperCase();
    if (normalizePlate(upper) !== plate) {
      seq.current++;
      setDetection({ state: 'idle' });
      setDetectedFor('');
      setDraft((d) => ({ ...emptyVehicle(), registrationNumber: upper, rcFiles: d.rcFiles, insuranceFiles: d.insuranceFiles, fitnessFiles: d.fitnessFiles, permitFiles: d.permitFiles, frontPhotoFiles: d.frontPhotoFiles }));
    } else setDraft((d) => ({ ...d, registrationNumber: upper }));
  };

  const setFiles = (key: 'rcFiles' | 'insuranceFiles' | 'fitnessFiles' | 'permitFiles' | 'frontPhotoFiles') => (files: StoredFile[]) => setDraft((d) => ({ ...d, [key]: files }));

  const addVehicle = () => {
    const e = validateVehicle(draft, {
      detectedFor,
      duplicate: result?.status === 'found' && result.duplicate,
      notFound: result?.status === 'not_found',
      others: vehicles.map((v) => normalizePlate(v.registrationNumber)),
    });
    setErrors(e);
    if (Object.keys(e).length || uploading) return;
    setVehicles((list) => [...list, { ...draft, registrationNumber: plate, source: result?.status === 'found' ? 'vahan' : 'manual' }]);
    setDraft(emptyVehicle());
    setDetection({ state: 'idle' });
    setDetectedFor('');
    setErrors({});
    setAdding(false);
  };

  const submit = async () => {
    setStepError('');
    if (!vehicles.length) {
      setStepError('Add at least one vehicle with its documents.');
      return;
    }
    if (adding && draft.registrationNumber.trim()) {
      setStepError('Finish adding the vehicle you started, or clear it, before continuing.');
      return;
    }
    if (uploading || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await saveFleetStep(record, buildFleetDetails(vehicles));
      onNext();
    } catch (e) {
      setSaveError(describeDataError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      {legacy ? <Notice tone="info" message="Please add each vehicle below with its own RC, insurance, FC and permit. Earlier combined uploads are kept for reference." /> : null}

      {vehicles.map((v) => (
        <View key={v.registrationNumber} style={styles.vehicle}>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>{v.registrationNumber}</Text>
            <Text style={type.small}>{[v.make, v.model].filter(Boolean).join(' ') || v.category}</Text>
            <Text style={type.tiny}>
              {[v.category, v.seatClass ? `${v.seatClass} seats` : '', v.fuelType].filter(Boolean).join(' • ')}
            </Text>
            <Text style={type.tiny}>
              Insurance {displayDate(v.insuranceUpto)} · FC {displayDate(v.fitnessUpto)} · Permit {displayDate(v.permitUpto)}
            </Text>
          </View>
          <Badge label={v.source === 'vahan' ? 'Register verified' : 'Manual check'} tone={v.source === 'vahan' ? 'success' : 'warning'} />
          <Text style={styles.remove} onPress={() => setVehicles((list) => list.filter((x) => x.registrationNumber !== v.registrationNumber))} accessibilityRole="button" accessibilityLabel={`Remove ${v.registrationNumber}`}>
            Remove
          </Text>
        </View>
      ))}

      {adding ? (
        <View style={styles.editor}>
          <Text style={[type.h3, { marginBottom: space.sm }]}>{vehicles.length ? 'Add another vehicle' : 'Add a vehicle'}</Text>
          <TextField label="Registration number" required value={draft.registrationNumber} onChangeText={onPlate} autoCapitalize="characters" placeholder="TN 01 AB 1234" error={errors.registrationNumber} />
          <Text style={[type.tiny, { marginBottom: space.sm }]}>Make, model, seats and fuel type are filled in automatically from the vehicle register.</Text>
          <Button
            title={detection.state === 'loading' ? 'Checking…' : detectedFor === plate && plate ? 'Check again' : 'Detect vehicle'}
            variant="secondary"
            loading={detection.state === 'loading'}
            disabled={!isPlate(draft.registrationNumber) || detection.state === 'loading'}
            onPress={() => void detect(draft.registrationNumber)}
            style={{ marginBottom: space.md }}
          />
          {detection.state === 'loading' ? (
            <View style={styles.detecting}>
              <ActivityIndicator color={colors.primary} />
              <Text style={type.small}>Looking up {draft.registrationNumber} in the vehicle register…</Text>
            </View>
          ) : null}
          {detection.state === 'error' ? <Notice message={detection.message} /> : null}
          {result?.status === 'not_found' ? <Notice message="This registration number was not found in the vehicle register. Check the number on the plate and try again." /> : null}
          {result?.status === 'found' && result.duplicate ? <Notice message="This vehicle is already registered with another NESAM partner. Please contact NESAM support." /> : null}
          {result?.status === 'found' && draft.source === 'vahan' ? (
            <View style={styles.detected}>
              <View style={styles.detectedHead}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[type.h3, { flex: 1 }]}>Vehicle found</Text>
                <Badge label={draft.category === 'Premium SUV' ? 'Innova Crysta' : draft.category} tone="brand" />
              </View>
              <Text style={type.body}>{[draft.make, draft.model].filter(Boolean).join(' ')}</Text>
              <Text style={type.small}>{[draft.fuelType, draft.seatClass ? `${draft.seatClass} seats` : '', draft.year].filter(Boolean).join(' • ')}</Text>
              <Text style={[type.tiny, { marginTop: 4 }]}>Registered to {result.vehicle.ownerNameMasked || 'the owner on record'}.</Text>
              {result.issues.map((i) => (
                <Text key={i.code} style={[type.tiny, { color: colors.warning, marginTop: 4 }]}>
                  ⚠ {i.message} Enter the dates from your current document below.
                </Text>
              ))}
            </View>
          ) : null}
          {manual ? (
            <>
              <Notice tone="warning" message="Automatic vehicle detection is unavailable right now. Choose the vehicle type — NESAM will verify the vehicle from your documents." />
              <Text style={[type.label, { marginBottom: 6 }]}>
                Vehicle type<Text style={{ color: colors.primary }}> *</Text>
              </Text>
              <View style={styles.chips}>
                {VEHICLE_TYPE_CHOICES.map((t) => (
                  <Chip key={t} label={t === 'Premium SUV' ? 'Innova Crysta' : t} active={draft.category === t} onPress={() => setDraft((d) => ({ ...d, category: t }))} />
                ))}
              </View>
              {errors.category ? <Text style={styles.err}>{errors.category}</Text> : null}
            </>
          ) : null}

          <Text style={[type.h3, { marginVertical: space.sm }]}>Vehicle documents</Text>
          <FileUploadField label="RC (registration certificate)" required category="vehicle_rc" files={draft.rcFiles} onChange={setFiles('rcFiles')} persistedPaths={persisted} onBusyChange={onRc} error={errors.rcFiles} max={2} />
          <FileUploadField label="Insurance" required category="vehicle_insurance" files={draft.insuranceFiles} onChange={setFiles('insuranceFiles')} persistedPaths={persisted} onBusyChange={onIns} error={errors.insuranceFiles} max={2} />
          <DateField label="Insurance valid till" required value={draft.insuranceUpto} onChange={(d) => setDraft((x) => ({ ...x, insuranceUpto: d }))} minimumDate={new Date()} error={errors.insuranceUpto} />
          <FileUploadField label="FC (fitness certificate)" required category="vehicle_fc" files={draft.fitnessFiles} onChange={setFiles('fitnessFiles')} persistedPaths={persisted} onBusyChange={onFc} error={errors.fitnessFiles} max={2} />
          <DateField label="FC valid till" required value={draft.fitnessUpto} onChange={(d) => setDraft((x) => ({ ...x, fitnessUpto: d }))} minimumDate={new Date()} error={errors.fitnessUpto} />
          <FileUploadField label="Permit" required category="vehicle_permit" files={draft.permitFiles} onChange={setFiles('permitFiles')} persistedPaths={persisted} onBusyChange={onPermit} error={errors.permitFiles} max={2} />
          <DateField label="Permit valid till" required value={draft.permitUpto} onChange={(d) => setDraft((x) => ({ ...x, permitUpto: d }))} minimumDate={new Date()} error={errors.permitUpto} />
          <FileUploadField label="Vehicle front (with plate)" required hint="Clear photo showing the number plate · JPG/PNG/WEBP" category="vehicle_photos" files={draft.frontPhotoFiles} onChange={setFiles('frontPhotoFiles')} persistedPaths={persisted} onBusyChange={onFront} error={errors.frontPhotoFiles} max={1} />
          {Object.keys(errors).length ? <Notice message="Please fix the highlighted fields." /> : null}
          <View style={styles.nav}>
            {vehicles.length ? <Button title="Cancel" variant="secondary" onPress={() => { setAdding(false); setDraft(emptyVehicle()); setErrors({}); setDetection({ state: 'idle' }); setDetectedFor(''); }} style={{ flex: 1 }} /> : null}
            <Button title={uploading ? 'Uploading…' : 'Add vehicle'} disabled={uploading} onPress={addVehicle} style={{ flex: 2 }} />
          </View>
        </View>
      ) : (
        <Button title="+ Add another vehicle" variant="secondary" onPress={() => setAdding(true)} style={{ marginBottom: space.md }} />
      )}

      {stepError ? <Notice message={stepError} /> : null}
      <Notice message={saveError} onRetry={saveError ? () => void submit() : undefined} />
      <View style={styles.nav}>
        <Button title="Back" variant="secondary" onPress={onBack} disabled={saving} style={{ flex: 1 }} />
        <Button title={saving ? 'Saving…' : 'Save & continue'} loading={saving} disabled={uploading} onPress={() => void submit()} style={{ flex: 2 }} />
      </View>
    </View>
  );
}

// ── Step 3: review ──────────────────────────────────────────────────────────

function ReviewStep({ record, preApproved, onEdit, onBack }: { record: VendorRecord; preApproved: boolean; onEdit: (i: number) => void; onBack: () => void }) {
  const { online } = useNetworkStatus();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const missing = missingSections(record);
  const { business: b, fleet: f, payoutSummary: p } = record;
  const isResubmission = record.status !== 'INCOMPLETE';
  const flaggedNow = isResubmission ? (record.review?.flaggedSections ?? []) : [];

  const submit = async () => {
    if (missing.length || !agreed || submitting) return;
    if (!EDITABLE_STATUSES.includes(record.status)) {
      setError('This application has already been submitted.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitForReview(record, preApproved);
      // The vendors/{uid} listener re-routes to the status screen / dashboard.
    } catch (e) {
      setError(describeDataError(e));
      setSubmitting(false);
    }
  };

  return (
    <View>
      <ReviewSection id="business" missing={missing} flagged={flaggedNow} onEdit={onEdit}>
        <Row label="Owner name" value={b?.vendorName ?? ''} />
        <Row label="Business name" value={b?.businessName ?? ''} />
      </ReviewSection>
      <ReviewSection id="payout" missing={missing} flagged={flaggedNow} onEdit={onEdit}>
        <Row label="Account holder" value={p?.accountHolderName ?? ''} />
        <Row label="Account" value={p ? `••••${p.bankLast4}` : ''} />
        <Row label="IFSC" value={p?.ifsc ?? ''} />
        <Row label="UPI" value={p?.upiId || '—'} />
      </ReviewSection>
      <ReviewSection id="fleet" missing={missing} flagged={flaggedNow} onEdit={onEdit}>
        <Row label="Vehicles" value={f?.vehicles?.length ? `${f.vehicles.length}` : ''} />
        {(f?.vehicles ?? []).map((v) => (
          <Row key={v.registrationNumber} label={v.registrationNumber} value={`${[v.make, v.model].filter(Boolean).join(' ') || v.category} · ${v.source === 'vahan' ? 'register verified' : 'manual check'}`} />
        ))}
      </ReviewSection>
      <Pressable style={styles.agree} onPress={() => setAgreed((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
        <Switch value={agreed} onValueChange={setAgreed} trackColor={{ true: colors.primary, false: colors.border }} />
        <Text style={[type.small, { flex: 1 }]}>
          I confirm the details are accurate and agree to the NESAM Fleet Partner terms, commission policy and document verification.
        </Text>
      </Pressable>
      {missing.length ? <Notice message={`Complete: ${[...new Set(missing.map((m) => SECTION_LABELS[m]))].join(', ')}.`} /> : null}
      {!online ? <Notice tone="warning" message="You’re offline — reconnect to submit." /> : null}
      <Notice message={error} />
      <View style={styles.nav}>
        <Button title="Back" variant="secondary" onPress={onBack} disabled={submitting} style={{ flex: 1 }} />
        <Button
          title={submitting ? 'Submitting…' : isResubmission ? 'Resubmit for review' : preApproved ? 'Submit & activate' : 'Submit for review'}
          loading={submitting}
          disabled={!!missing.length || !agreed || !online}
          onPress={() => void submit()}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );
}

function ReviewSection({
  id,
  missing,
  flagged,
  onEdit,
  children,
}: {
  id: OnboardingSection;
  missing: OnboardingSection[];
  flagged: OnboardingSection[];
  onEdit: (i: number) => void;
  children: React.ReactNode;
}) {
  const isMissing = missing.includes(id);
  const isFlagged = flagged.includes(id);
  return (
    <View style={[styles.section, isMissing && { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft }, !isMissing && isFlagged && { borderColor: colors.warningBorder }]}>
      <View style={styles.sectionHead}>
        <Text style={type.h3}>{SECTION_LABELS[id]}</Text>
        <Text style={styles.edit} onPress={() => onEdit(stepOfSection(id))} accessibilityRole="button">
          Edit
        </Text>
      </View>
      {isMissing ? <Text style={styles.err}>This section is incomplete.</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  content: { padding: space.lg, paddingBottom: space.xxl },
  stepper: { flexDirection: 'row', marginBottom: space.md },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  stepActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepDone: { borderColor: colors.success, backgroundColor: colors.successSoft },
  stepFlagged: { borderColor: colors.warning, backgroundColor: colors.warningSoft },
  stepNum: { fontSize: 12, fontWeight: '800', color: colors.muted },
  stepLabel: { fontSize: 10, fontWeight: '700', color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  err: { color: colors.primaryDark, fontSize: 12, marginBottom: space.sm },
  section: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  edit: { color: colors.primary, fontWeight: '800' },
  agree: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  nav: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  vehicle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, backgroundColor: colors.card },
  remove: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  editor: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.md, backgroundColor: colors.bg },
  detecting: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  detected: { borderWidth: 1, borderColor: colors.success, backgroundColor: colors.successSoft, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  detectedHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 4 },
});
