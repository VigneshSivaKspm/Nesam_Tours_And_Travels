import React, { useCallback, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { BusinessRegType, IdentityProofType, StoredFile, VendorDocuments, VendorRecord } from '../../types';
import { BUSINESS_REG_TYPES, IDENTITY_PROOF_TYPES } from '../../config/onboarding';
import { saveDocumentsStep, type VendorKyc } from '../../services/onboardingService';
import { describeDataError } from '../../utils/retry';
import {
  digitsOnly,
  maskTail,
  validateAadhaar,
  validateGstin,
  validatePan,
  validatePassport,
  validateRegistrationNumber,
} from '../../utils/validation';
import { Button, ErrorBanner, SelectField, TextField } from '../../components/onboarding/ui';
import { FileUploadField } from '../../components/onboarding/FileUploadField';

interface DocumentsStepProps {
  record: VendorRecord;
  kyc: VendorKyc | null;
  onKycChange: (kyc: VendorKyc) => void;
  onNext: () => void;
  onBack: () => void;
}

const formatAadhaar = (v: string) => digitsOnly(v).slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ');

function maskIdentity(type: IdentityProofType, number: string): string {
  if (type === 'AADHAAR') return `XXXX XXXX ${digitsOnly(number).slice(-4)}`;
  return maskTail(number.toUpperCase(), 4);
}

export const DocumentsStep: React.FC<DocumentsStepProps> = ({ record, kyc, onKycChange, onNext, onBack }) => {
  const saved = record.documents;
  const [regType, setRegType] = useState<BusinessRegType>(saved?.businessRegistration.type ?? 'GST');
  const [regNumber, setRegNumber] = useState(saved?.businessRegistration.number ?? '');
  const [regFiles, setRegFiles] = useState<StoredFile[]>(saved?.businessRegistration.files ?? []);

  const [idType, setIdType] = useState<IdentityProofType>(saved?.identityProof.type ?? 'AADHAAR');
  // Aadhaar is only ever stored masked, so it can't be prefilled — the saved
  // masked value is kept unless the vendor types a new number.
  const [idNumber, setIdNumber] = useState(
    saved && saved.identityProof.type !== 'AADHAAR' ? kyc?.identityNumber ?? '' : '',
  );
  const [idFiles, setIdFiles] = useState<StoredFile[]>(saved?.identityProof.files ?? []);

  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const persistedPaths = useMemo(
    () => new Set([...(saved?.businessRegistration.files ?? []), ...(saved?.identityProof.files ?? [])].map((f) => f.path)),
    [saved],
  );
  const setBusyFor = useCallback((key: string) => (v: boolean) => setBusy((b) => (b[key] === v ? b : { ...b, [key]: v })), []);
  const onRegBusy = useMemo(() => setBusyFor('reg'), [setBusyFor]);
  const onIdBusy = useMemo(() => setBusyFor('id'), [setBusyFor]);
  const uploading = Object.values(busy).some(Boolean);

  const keepSavedAadhaar = idType === 'AADHAAR' && !idNumber && saved?.identityProof.type === 'AADHAAR' && !!saved.identityProof.maskedNumber;

  const errors = {
    regNumber: regType === 'GST' ? validateGstin(regNumber) : validateRegistrationNumber(regNumber),
    regFiles: regFiles.length ? '' : 'Upload your business registration document.',
    idNumber: keepSavedAadhaar
      ? ''
      : idType === 'AADHAAR' ? validateAadhaar(idNumber) : idType === 'PAN' ? validatePan(idNumber) : validatePassport(idNumber),
    idFiles: idFiles.length ? '' : 'Upload your identity proof (front and back if applicable).',
  };
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : '');
  const regMeta = BUSINESS_REG_TYPES.find((t) => t.value === regType)!;
  const idMeta = IDENTITY_PROOF_TYPES.find((t) => t.value === idType)!;

  const handleSubmit = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean) || uploading) return;
    const cleanId = idType === 'AADHAAR' ? digitsOnly(idNumber) : idNumber.trim().toUpperCase();
    const documents: VendorDocuments = {
      businessRegistration: {
        type: regType,
        number: regType === 'GST' ? regNumber.trim().toUpperCase() : regNumber.trim(),
        files: regFiles,
      },
      identityProof: {
        type: idType,
        maskedNumber: keepSavedAadhaar ? saved!.identityProof.maskedNumber : maskIdentity(idType, cleanId),
        files: idFiles,
      },
    };
    setSaving(true);
    setSaveError('');
    try {
      await saveDocumentsStep(record, documents, cleanId);
      onKycChange({ identityNumber: idType === 'AADHAAR' ? documents.identityProof.maskedNumber : cleanId, payout: kyc?.payout ?? null });
      onNext();
    } catch (error) {
      setSaveError(describeDataError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="text-[13px] font-bold text-[#111] mb-3">Business Registration</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <SelectField
            id="regType"
            label="Document Type"
            required
            value={regType}
            onChange={(v) => setRegType(v as BusinessRegType)}
            options={BUSINESS_REG_TYPES.map(({ value, label }) => ({ value, label }))}
          />
          <TextField
            id="regNumber"
            label={regType === 'GST' ? 'GSTIN' : 'Registration / License Number'}
            required
            value={regNumber}
            onChange={(v) => setRegNumber(regType === 'GST' ? v.toUpperCase().replace(/\s/g, '').slice(0, 15) : v.slice(0, 30))}
            error={err('regNumber')}
            placeholder={regMeta.placeholder}
            autoCapitalize="characters"
          />
        </div>
        <FileUploadField
          id="regFiles"
          label={`${regMeta.label} Copy`}
          required
          category="business_registration"
          files={regFiles}
          onChange={setRegFiles}
          persistedPaths={persistedPaths}
          onBusyChange={onRegBusy}
          error={err('regFiles')}
          max={5}
        />
      </fieldset>

      <fieldset className="space-y-4 pt-2 border-t border-[#F0F0F0]">
        <legend className="text-[13px] font-bold text-[#111] mb-3 pt-4">Vendor Identity Proof</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <SelectField
            id="idType"
            label="ID Type"
            required
            value={idType}
            onChange={(v) => {
              setIdType(v as IdentityProofType);
              setIdNumber('');
            }}
            options={IDENTITY_PROOF_TYPES.map(({ value, label }) => ({ value, label }))}
          />
          <TextField
            id="idNumber"
            label={`${idMeta.label} Number`}
            required
            value={idNumber}
            onChange={(v) =>
              setIdNumber(idType === 'AADHAAR' ? formatAadhaar(v) : v.toUpperCase().replace(/\s/g, '').slice(0, idType === 'PAN' ? 10 : 8))
            }
            error={err('idNumber')}
            hint={keepSavedAadhaar ? `Saved: ${saved!.identityProof.maskedNumber} — leave blank to keep` : undefined}
            placeholder={keepSavedAadhaar ? saved!.identityProof.maskedNumber : idMeta.placeholder}
            inputMode={idType === 'AADHAAR' ? 'numeric' : 'text'}
            autoComplete="off"
          />
        </div>
        <FileUploadField
          id="idFiles"
          label={`${idMeta.label} Copy`}
          required
          hint={idType === 'AADHAAR' ? 'Upload a masked Aadhaar (first 8 digits hidden) · JPG/PNG/PDF' : undefined}
          category="identity_proof"
          files={idFiles}
          onChange={setIdFiles}
          persistedPaths={persistedPaths}
          onBusyChange={onIdBusy}
          error={err('idFiles')}
          max={2}
        />
        <p className="flex items-start gap-1.5 text-[11px] text-[#777]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" />
          ID numbers are stored separately and are visible only to you and the Nesam verification team.
          {idType === 'AADHAAR' && ' Only the last 4 digits of your Aadhaar are retained.'}
        </p>
      </fieldset>

      {submitted && uploading && <ErrorBanner message="Please wait for uploads to finish." />}
      {submitted && Object.values(errors).some(Boolean) && <ErrorBanner message="Please fix the highlighted fields." />}
      <ErrorBanner message={saveError} onRetry={saveError ? handleSubmit : undefined} />

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button onClick={handleSubmit} loading={saving} disabled={uploading}>
          {uploading ? 'Uploading…' : saving ? 'Saving…' : 'Save & Continue'}
        </Button>
      </div>
    </div>
  );
};
