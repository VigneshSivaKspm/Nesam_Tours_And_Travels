// Vendor onboarding wizard (native port of vendor/web screens/onboarding/*).
// Progress is saved to vendors/{uid} after every step, so the application can
// be resumed on any device; admin-flagged sections are highlighted.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type {
  BusinessInfo,
  BusinessRegType,
  FleetDetails,
  IdentityProofType,
  OnboardingSection,
  PayoutDetails,
  StoredFile,
  VendorDocuments,
  VendorRecord,
} from '../../types/vendor';
import { BUSINESS_REG_TYPES, IDENTITY_PROOF_TYPES, INDIAN_STATES, ONBOARDING_STEPS, SECTION_LABELS, VEHICLE_TYPES } from '../../config/onboarding';
import {
  EDITABLE_STATUSES,
  getVendorInvite,
  getVendorKyc,
  missingSections,
  saveBusinessStep,
  saveDocumentsStep,
  saveFleetStep,
  savePayoutStep,
  submitForReview,
  type VendorInvite,
  type VendorKyc,
} from '../../services/onboardingService';
import {
  digitsOnly,
  hasErrors,
  maskTail,
  normalizeSpaces,
  validateAadhaar,
  validateAccountNumber,
  validateAltPhone,
  validateBusinessName,
  validateEmail,
  validateFleetSize,
  validateGstin,
  validateIfsc,
  validatePan,
  validatePassport,
  validatePersonName,
  validatePincode,
  validateRegistrationNumber,
  validateRequired,
  validateUpi,
} from '../../utils/validation';
import { describeDataError } from '../../utils/retry';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { Button, Card, Chip, FullScreenLoader, Notice, Row, TextField } from '../../components/ui';
import { SelectField } from '../../components/SelectField';
import { FileUploadField } from '../../components/FileUploadField';
import { colors, radius, space, type } from '../../theme';

interface WizardProps {
  record: VendorRecord | null;
  phone: string;
  notice?: string;
  onSignOut: () => void;
}

function initialStep(record: VendorRecord | null): number {
  if (!record) return 0;
  if ((record.status === 'CHANGES_REQUESTED' || record.status === 'REJECTED') && record.review?.flaggedSections.length) {
    const first = ONBOARDING_STEPS.findIndex((s) => s.key === record.review!.flaggedSections[0]);
    if (first >= 0) return first;
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

  // One-time prefill: admin invite (new vendors) + private KYC (resuming vendors).
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

  let body: React.ReactNode;
  if (step === 0) body = <BusinessStep record={record} invite={invite} phone={phone} onNext={next} />;
  else if (!record) body = <FullScreenLoader label="Saving…" />;
  else if (step === 1) body = <DocumentsStep record={record} kyc={kyc} onKycChange={setKyc} onNext={next} onBack={back} />;
  else if (step === 2) body = <FleetStep record={record} onNext={next} onBack={back} />;
  else if (step === 3) body = <PayoutStep record={record} kyc={kyc} onKycChange={setKyc} onNext={next} onBack={back} />;
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
            const flagged = correction?.review?.flaggedSections.includes(s.key as OnboardingSection);
            return (
              <Pressable key={s.key} onPress={() => i <= maxReachable && setStep(i)} disabled={i > maxReachable} style={styles.stepItem} accessibilityRole="button" accessibilityLabel={`Step ${i + 1}: ${s.title}`}>
                <View style={[styles.stepDot, active && styles.stepActive, !active && flagged && styles.stepFlagged, !active && !flagged && done && styles.stepDone]}>
                  {done && !active && !flagged ? <Ionicons name="checkmark" size={14} color={colors.success} /> : <Text style={[styles.stepNum, active && { color: colors.white }]}>{i + 1}</Text>}
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
            }${correction.review?.flaggedSections.length ? `\nPlease update: ${correction.review.flaggedSections.map((s) => SECTION_LABELS[s]).join(', ')}. Then resubmit from the final step.` : ''}`}
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

// ── Step 1: business ────────────────────────────────────────────────────────

function BusinessStep({ record, invite, phone, onNext }: { record: VendorRecord | null; invite: VendorInvite | null; phone: string; onNext: () => void }) {
  const b = record?.business;
  const [form, setForm] = useState({
    vendorName: b?.vendorName ?? invite?.vendorName ?? '',
    businessName: b?.businessName ?? invite?.businessName ?? '',
    email: b?.email ?? invite?.email ?? '',
    altPhone: b?.altPhone ?? '',
    line1: b?.address.line1 ?? '',
    line2: b?.address.line2 ?? '',
    city: b?.address.city ?? invite?.city ?? '',
    state: b?.address.state ?? '',
    pincode: b?.address.pincode ?? '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const errors = useMemo(
    () => ({
      vendorName: validatePersonName(form.vendorName, 'Vendor name'),
      businessName: validateBusinessName(form.businessName),
      email: validateEmail(form.email),
      altPhone: validateAltPhone(form.altPhone, phone),
      line1: validateRequired(form.line1, 'Address line 1', 150),
      line2: normalizeSpaces(form.line2).length > 150 ? 'Address line 2 must be under 150 characters.' : '',
      city: validateRequired(form.city, 'City', 60),
      state: form.state ? '' : 'Select a state.',
      pincode: validatePincode(form.pincode),
    }),
    [form, phone],
  );
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const err = (key: keyof typeof errors) => (submitted ? errors[key] : '');

  const submit = async () => {
    setSubmitted(true);
    if (hasErrors(errors) || saving) return;
    const business: BusinessInfo = {
      vendorName: normalizeSpaces(form.vendorName),
      businessName: normalizeSpaces(form.businessName),
      email: form.email.trim().toLowerCase(),
      altPhone: digitsOnly(form.altPhone),
      address: { line1: normalizeSpaces(form.line1), line2: normalizeSpaces(form.line2), city: normalizeSpaces(form.city), state: form.state, pincode: form.pincode.trim() },
    };
    setSaving(true);
    setSaveError('');
    try {
      await saveBusinessStep(record, business);
      onNext();
    } catch (e) {
      setSaveError(describeDataError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <TextField label="Vendor (owner) name" required value={form.vendorName} onChangeText={set('vendorName')} error={err('vendorName')} placeholder="Ravi Kumar" autoComplete="name" />
      <TextField label="Business / agency name" required value={form.businessName} onChangeText={set('businessName')} error={err('businessName')} placeholder="Sri Balaji Travels" />
      <TextField label="Email address" required value={form.email} onChangeText={set('email')} error={err('email')} keyboardType="email-address" autoCapitalize="none" placeholder="ops@company.in" />
      <TextField
        label="Alternate contact number"
        prefix="+91"
        value={form.altPhone}
        onChangeText={(v) => set('altPhone')(digitsOnly(v).slice(0, 10))}
        error={err('altPhone')}
        keyboardType="phone-pad"
        hint="Optional"
      />
      <Text style={[type.h3, { marginVertical: space.sm }]}>Business address</Text>
      <TextField label="Address line 1" required value={form.line1} onChangeText={set('line1')} error={err('line1')} placeholder="Door no., street" />
      <TextField label="Address line 2" value={form.line2} onChangeText={set('line2')} error={err('line2')} placeholder="Area, landmark (optional)" />
      <TextField label="City" required value={form.city} onChangeText={set('city')} error={err('city')} />
      <SelectField label="State / UT" required value={form.state} onChange={set('state')} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} placeholder="Select state" error={err('state')} />
      <TextField label="PIN code" required value={form.pincode} onChangeText={(v) => set('pincode')(digitsOnly(v).slice(0, 6))} error={err('pincode')} keyboardType="number-pad" />
      {submitted && hasErrors(errors) ? <Notice message="Please fix the highlighted fields." /> : null}
      <Notice message={saveError} onRetry={saveError ? () => void submit() : undefined} />
      <Button title={saving ? 'Saving…' : 'Save & continue'} loading={saving} onPress={() => void submit()} />
    </View>
  );
}

// ── Step 2: documents ───────────────────────────────────────────────────────

const formatAadhaar = (v: string) => digitsOnly(v).slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ');
function maskIdentity(t: IdentityProofType, n: string): string {
  return t === 'AADHAAR' ? `XXXX XXXX ${digitsOnly(n).slice(-4)}` : maskTail(n.toUpperCase(), 4);
}

function DocumentsStep({ record, kyc, onKycChange, onNext, onBack }: { record: VendorRecord; kyc: VendorKyc | null; onKycChange: (k: VendorKyc) => void; onNext: () => void; onBack: () => void }) {
  const saved = record.documents;
  const [regType, setRegType] = useState<BusinessRegType>(saved?.businessRegistration.type ?? 'GST');
  const [regNumber, setRegNumber] = useState(saved?.businessRegistration.number ?? '');
  const [regFiles, setRegFiles] = useState<StoredFile[]>(saved?.businessRegistration.files ?? []);
  const [idType, setIdType] = useState<IdentityProofType>(saved?.identityProof.type ?? 'AADHAAR');
  const [idNumber, setIdNumber] = useState(saved && saved.identityProof.type !== 'AADHAAR' ? (kyc?.identityNumber ?? '') : '');
  const [idFiles, setIdFiles] = useState<StoredFile[]>(saved?.identityProof.files ?? []);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const persisted = useMemo(() => new Set([...(saved?.businessRegistration.files ?? []), ...(saved?.identityProof.files ?? [])].map((f) => f.path)), [saved]);
  const onRegBusy = useCallback((v: boolean) => setBusy((b) => (b.reg === v ? b : { ...b, reg: v })), []);
  const onIdBusy = useCallback((v: boolean) => setBusy((b) => (b.id === v ? b : { ...b, id: v })), []);
  const uploading = Object.values(busy).some(Boolean);
  const keepSavedAadhaar = idType === 'AADHAAR' && !idNumber && saved?.identityProof.type === 'AADHAAR' && !!saved.identityProof.maskedNumber;

  const errors = {
    regNumber: regType === 'GST' ? validateGstin(regNumber) : validateRegistrationNumber(regNumber),
    regFiles: regFiles.length ? '' : 'Upload your business registration document.',
    idNumber: keepSavedAadhaar ? '' : idType === 'AADHAAR' ? validateAadhaar(idNumber) : idType === 'PAN' ? validatePan(idNumber) : validatePassport(idNumber),
    idFiles: idFiles.length ? '' : 'Upload your identity proof (front and back if applicable).',
  };
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : '');
  const regMeta = BUSINESS_REG_TYPES.find((t) => t.value === regType)!;
  const idMeta = IDENTITY_PROOF_TYPES.find((t) => t.value === idType)!;

  const submit = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean) || uploading || saving) return;
    const cleanId = idType === 'AADHAAR' ? digitsOnly(idNumber) : idNumber.trim().toUpperCase();
    const documents: VendorDocuments = {
      businessRegistration: { type: regType, number: regType === 'GST' ? regNumber.trim().toUpperCase() : regNumber.trim(), files: regFiles },
      identityProof: { type: idType, maskedNumber: keepSavedAadhaar ? saved!.identityProof.maskedNumber : maskIdentity(idType, cleanId), files: idFiles },
    };
    setSaving(true);
    setSaveError('');
    try {
      await saveDocumentsStep(record, documents, cleanId);
      onKycChange({ identityNumber: idType === 'AADHAAR' ? documents.identityProof.maskedNumber : cleanId, payout: kyc?.payout ?? null });
      onNext();
    } catch (e) {
      setSaveError(describeDataError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <Text style={[type.h3, { marginBottom: space.sm }]}>Business registration</Text>
      <SelectField label="Document type" required value={regType} onChange={(v) => setRegType(v as BusinessRegType)} options={BUSINESS_REG_TYPES.map(({ value, label }) => ({ value, label }))} />
      <TextField
        label={regType === 'GST' ? 'GSTIN' : 'Registration / licence number'}
        required
        value={regNumber}
        onChangeText={(v) => setRegNumber(regType === 'GST' ? v.toUpperCase().replace(/\s/g, '').slice(0, 15) : v.slice(0, 30))}
        error={err('regNumber')}
        placeholder={regMeta.placeholder}
        autoCapitalize="characters"
      />
      <FileUploadField label={`${regMeta.label} copy`} required category="business_registration" files={regFiles} onChange={setRegFiles} persistedPaths={persisted} onBusyChange={onRegBusy} error={err('regFiles')} max={5} />

      <Text style={[type.h3, { marginBottom: space.sm }]}>Owner identity proof</Text>
      <SelectField
        label="ID type"
        required
        value={idType}
        onChange={(v) => {
          setIdType(v as IdentityProofType);
          setIdNumber('');
        }}
        options={IDENTITY_PROOF_TYPES.map(({ value, label }) => ({ value, label }))}
      />
      <TextField
        label={`${idMeta.label} number`}
        required
        value={idNumber}
        onChangeText={(v) => setIdNumber(idType === 'AADHAAR' ? formatAadhaar(v) : v.toUpperCase().replace(/\s/g, '').slice(0, idType === 'PAN' ? 10 : 8))}
        error={err('idNumber')}
        hint={keepSavedAadhaar ? `Saved: ${saved!.identityProof.maskedNumber} — leave blank to keep` : undefined}
        placeholder={keepSavedAadhaar ? saved!.identityProof.maskedNumber : idMeta.placeholder}
        keyboardType={idType === 'AADHAAR' ? 'number-pad' : 'default'}
        autoCapitalize="characters"
        autoComplete="off"
      />
      <FileUploadField
        label={`${idMeta.label} copy`}
        required
        hint={idType === 'AADHAAR' ? 'Upload a masked Aadhaar (first 8 digits hidden) · JPG/PNG/PDF' : undefined}
        category="identity_proof"
        files={idFiles}
        onChange={setIdFiles}
        persistedPaths={persisted}
        onBusyChange={onIdBusy}
        error={err('idFiles')}
        max={2}
      />
      <Text style={[type.tiny, { marginBottom: space.md }]}>
        ID numbers are stored separately and visible only to you and the NESAM verification team.{idType === 'AADHAAR' ? ' Only the last 4 digits of your Aadhaar are retained.' : ''}
      </Text>
      {submitted && uploading ? <Notice message="Please wait for uploads to finish." /> : null}
      {submitted && Object.values(errors).some(Boolean) ? <Notice message="Please fix the highlighted fields." /> : null}
      <Notice message={saveError} onRetry={saveError ? () => void submit() : undefined} />
      <StepNav onBack={onBack} saving={saving} uploading={uploading} onNext={() => void submit()} />
    </View>
  );
}

// ── Step 3: fleet ───────────────────────────────────────────────────────────

function FleetStep({ record, onNext, onBack }: { record: VendorRecord; onNext: () => void; onBack: () => void }) {
  const saved = record.fleet;
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(saved?.vehicleTypes ?? []);
  const [fleetSize, setFleetSize] = useState(saved?.fleetSize ? String(saved.fleetSize) : '');
  const [rcFiles, setRcFiles] = useState<StoredFile[]>(saved?.rcFiles ?? []);
  const [vehiclePhotos, setVehiclePhotos] = useState<StoredFile[]>(saved?.vehiclePhotos ?? []);
  const [insuranceFiles, setInsuranceFiles] = useState<StoredFile[]>(saved?.insuranceFiles ?? []);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const persisted = useMemo(
    () => new Set([...(saved?.rcFiles ?? []), ...(saved?.vehiclePhotos ?? []), ...(saved?.insuranceFiles ?? [])].map((f) => f.path)),
    [saved],
  );
  const onRc = useCallback((v: boolean) => setBusy((b) => (b.rc === v ? b : { ...b, rc: v })), []);
  const onPhoto = useCallback((v: boolean) => setBusy((b) => (b.photo === v ? b : { ...b, photo: v })), []);
  const onIns = useCallback((v: boolean) => setBusy((b) => (b.ins === v ? b : { ...b, ins: v })), []);
  const uploading = Object.values(busy).some(Boolean);

  const errors = {
    vehicleTypes: vehicleTypes.length ? '' : 'Select at least one vehicle type.',
    fleetSize: validateFleetSize(fleetSize),
    rcFiles: rcFiles.length ? '' : 'Upload at least one Registration Certificate (RC).',
    vehiclePhotos: vehiclePhotos.length ? '' : 'Upload at least one vehicle photo.',
    insuranceFiles: insuranceFiles.length ? '' : 'Upload insurance / fitness certificates.',
  };
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : '');
  const toggle = (t: string) => setVehicleTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const submit = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean) || uploading || saving) return;
    const fleet: FleetDetails = { vehicleTypes: VEHICLE_TYPES.filter((t) => vehicleTypes.includes(t)), fleetSize: Number(fleetSize), rcFiles, vehiclePhotos, insuranceFiles };
    setSaving(true);
    setSaveError('');
    try {
      await saveFleetStep(record, fleet);
      onNext();
    } catch (e) {
      setSaveError(describeDataError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <Text style={[type.label, { marginBottom: 6 }]}>
        Vehicle types managed<Text style={{ color: colors.primary }}> *</Text>
      </Text>
      <View style={styles.chips}>
        {VEHICLE_TYPES.map((t) => (
          <Chip key={t} label={t} active={vehicleTypes.includes(t)} onPress={() => toggle(t)} />
        ))}
      </View>
      {err('vehicleTypes') ? <Text style={styles.err}>{err('vehicleTypes')}</Text> : null}
      <TextField label="Initial fleet size" required value={fleetSize} onChangeText={(v) => setFleetSize(digitsOnly(v).slice(0, 4))} keyboardType="number-pad" error={err('fleetSize')} hint="Number of vehicles you operate" />
      <FileUploadField label="Vehicle registration certificates (RC)" required category="vehicle_rc" files={rcFiles} onChange={setRcFiles} persistedPaths={persisted} onBusyChange={onRc} error={err('rcFiles')} max={20} />
      <FileUploadField
        label="Vehicle photos"
        required
        hint="Clear exterior photos showing the number plate"
        category="vehicle_photos"
        files={vehiclePhotos}
        onChange={setVehiclePhotos}
        persistedPaths={persisted}
        onBusyChange={onPhoto}
        error={err('vehiclePhotos')}
        max={20}
      />
      <FileUploadField label="Insurance / fitness certificates" required category="vehicle_insurance" files={insuranceFiles} onChange={setInsuranceFiles} persistedPaths={persisted} onBusyChange={onIns} error={err('insuranceFiles')} max={20} />
      {submitted && uploading ? <Notice message="Please wait for uploads to finish." /> : null}
      {submitted && Object.values(errors).some(Boolean) ? <Notice message="Please fix the highlighted fields." /> : null}
      <Notice message={saveError} onRetry={saveError ? () => void submit() : undefined} />
      <StepNav onBack={onBack} saving={saving} uploading={uploading} onNext={() => void submit()} />
    </View>
  );
}

// ── Step 4: payout ──────────────────────────────────────────────────────────

function PayoutStep({ record, kyc, onKycChange, onNext, onBack }: { record: VendorRecord; kyc: VendorKyc | null; onKycChange: (k: VendorKyc) => void; onNext: () => void; onBack: () => void }) {
  const saved = kyc?.payout;
  const [form, setForm] = useState({
    accountHolderName: saved?.accountHolderName ?? record.business?.vendorName ?? '',
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
      await savePayoutStep(record, payout);
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
        Bank details are stored in a restricted record visible only to you and the NESAM finance team. After approval, changes require re-verification by support.
      </Text>
      {submitted && hasErrors(errors) ? <Notice message="Please fix the highlighted fields." /> : null}
      <Notice message={saveError} onRetry={saveError ? () => void submit() : undefined} />
      <StepNav onBack={onBack} saving={saving} uploading={false} onNext={() => void submit()} />
    </View>
  );
}

// ── Step 5: review ──────────────────────────────────────────────────────────

function ReviewStep({ record, preApproved, onEdit, onBack }: { record: VendorRecord; preApproved: boolean; onEdit: (i: number) => void; onBack: () => void }) {
  const { online } = useNetworkStatus();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const missing = missingSections(record);
  const { business: b, documents: d, fleet: f, payoutSummary: p } = record;
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
        <Row label="Vendor name" value={b?.vendorName ?? ''} />
        <Row label="Business name" value={b?.businessName ?? ''} />
        <Row label="Email" value={b?.email ?? ''} />
        <Row label="Alternate number" value={b?.altPhone ? `+91 ${b.altPhone}` : '—'} />
        <Row label="Address" value={b ? [b.address.line1, b.address.line2, b.address.city, `${b.address.state} ${b.address.pincode}`].filter(Boolean).join(', ') : ''} />
      </ReviewSection>
      <ReviewSection id="documents" missing={missing} flagged={flaggedNow} onEdit={onEdit}>
        <Row
          label={BUSINESS_REG_TYPES.find((t) => t.value === d?.businessRegistration.type)?.label ?? 'Registration'}
          value={d ? `${d.businessRegistration.number} · ${d.businessRegistration.files.length} file(s)` : ''}
        />
        <Row label={IDENTITY_PROOF_TYPES.find((t) => t.value === d?.identityProof.type)?.label ?? 'Identity proof'} value={d ? `${d.identityProof.maskedNumber} · ${d.identityProof.files.length} file(s)` : ''} />
      </ReviewSection>
      <ReviewSection id="fleet" missing={missing} flagged={flaggedNow} onEdit={onEdit}>
        <Row label="Vehicle types" value={f?.vehicleTypes.join(', ') ?? ''} />
        <Row label="Fleet size" value={f ? `${f.fleetSize} vehicle(s)` : ''} />
        <Row label="RC documents" value={f ? `${f.rcFiles.length} file(s)` : ''} />
        <Row label="Vehicle photos" value={f ? `${f.vehiclePhotos.length} file(s)` : ''} />
        <Row label="Insurance / fitness" value={f ? `${f.insuranceFiles.length} file(s)` : ''} />
      </ReviewSection>
      <ReviewSection id="payout" missing={missing} flagged={flaggedNow} onEdit={onEdit}>
        <Row label="Account holder" value={p?.accountHolderName ?? ''} />
        <Row label="Account" value={p ? `••••${p.bankLast4}` : ''} />
        <Row label="IFSC" value={p?.ifsc ?? ''} />
        <Row label="UPI" value={p?.upiId || '—'} />
      </ReviewSection>
      <Pressable style={styles.agree} onPress={() => setAgreed((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
        <Switch value={agreed} onValueChange={setAgreed} trackColor={{ true: colors.primary, false: colors.border }} />
        <Text style={[type.small, { flex: 1 }]}>
          I confirm the details are accurate and agree to the NESAM Fleet Partner terms, commission policy and document verification.
        </Text>
      </Pressable>
      {missing.length ? <Notice message={`Complete: ${missing.map((m) => SECTION_LABELS[m]).join(', ')}.`} /> : null}
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
        <Text style={styles.edit} onPress={() => onEdit(ONBOARDING_STEPS.findIndex((s) => s.key === id))} accessibilityRole="button">
          Edit
        </Text>
      </View>
      {isMissing ? <Text style={styles.err}>This section is incomplete.</Text> : children}
    </View>
  );
}

function StepNav({ onBack, onNext, saving, uploading }: { onBack: () => void; onNext: () => void; saving: boolean; uploading: boolean }) {
  return (
    <View style={styles.nav}>
      <Button title="Back" variant="secondary" onPress={onBack} disabled={saving} style={{ flex: 1 }} />
      <Button title={uploading ? 'Uploading…' : saving ? 'Saving…' : 'Save & continue'} loading={saving} disabled={uploading} onPress={onNext} style={{ flex: 2 }} />
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
});
