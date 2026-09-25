import React, { useCallback, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { FleetDetails, StoredFile } from '../../types';
import { VEHICLE_TYPES } from '../../config/onboarding';
import { saveFleetStep } from '../../services/onboardingService';
import { describeDataError } from '../../utils/retry';
import { digitsOnly, validateFleetSize } from '../../utils/validation';
import { Button, ErrorBanner, TextField } from '../../components/onboarding/ui';
import { FileUploadField } from '../../components/onboarding/FileUploadField';
import type { StepProps } from './OnboardingWizard';

const MAX_FLEET_FILES = 20;

export const FleetStep: React.FC<StepProps> = ({ record, onNext, onBack }) => {
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

  const persistedPaths = useMemo(
    () => new Set([...(saved?.rcFiles ?? []), ...(saved?.vehiclePhotos ?? []), ...(saved?.insuranceFiles ?? [])].map((f) => f.path)),
    [saved],
  );
  const busySetter = useCallback((key: string) => (v: boolean) => setBusy((b) => (b[key] === v ? b : { ...b, [key]: v })), []);
  const onRcBusy = useMemo(() => busySetter('rc'), [busySetter]);
  const onPhotoBusy = useMemo(() => busySetter('photo'), [busySetter]);
  const onInsBusy = useMemo(() => busySetter('ins'), [busySetter]);
  const uploading = Object.values(busy).some(Boolean);

  const errors = {
    vehicleTypes: vehicleTypes.length ? '' : 'Select at least one vehicle type.',
    fleetSize: validateFleetSize(fleetSize),
    rcFiles: rcFiles.length ? '' : 'Upload at least one Registration Certificate (RC).',
    vehiclePhotos: vehiclePhotos.length ? '' : 'Upload at least one vehicle photo.',
    insuranceFiles: insuranceFiles.length ? '' : 'Upload insurance / fitness certificates.',
  };
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : '');

  const toggleType = (t: string) =>
    setVehicleTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSubmit = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean) || uploading) return;
    const fleet: FleetDetails = {
      vehicleTypes: VEHICLE_TYPES.filter((t) => vehicleTypes.includes(t)),
      fleetSize: Number(fleetSize),
      rcFiles,
      vehiclePhotos,
      insuranceFiles,
    };
    setSaving(true);
    setSaveError('');
    try {
      await saveFleetStep(record, fleet);
      onNext();
    } catch (error) {
      setSaveError(describeDataError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="block text-[12px] font-semibold text-[#444] mb-1.5">
          Vehicle Types Managed<span className="text-[#E21B23]"> *</span>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Vehicle types">
          {VEHICLE_TYPES.map((t) => {
            const on = vehicleTypes.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggleType(t)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors flex items-center gap-1 ${
                  on ? 'bg-[#FEF2F2] border-[#E21B23] text-[#E21B23]' : 'bg-white border-[#E5E5E5] text-[#555] hover:border-[#BBB]'
                }`}
              >
                {on && <Check className="w-3.5 h-3.5" />}
                {t}
              </button>
            );
          })}
        </div>
        {err('vehicleTypes') && <p role="alert" className="mt-1 text-[11px] font-medium text-[#E21B23]">{err('vehicleTypes')}</p>}
      </div>

      <div className="max-w-[220px]">
        <TextField
          id="fleetSize"
          label="Initial Fleet Size"
          required
          inputMode="numeric"
          maxLength={4}
          value={fleetSize}
          onChange={(v) => setFleetSize(digitsOnly(v))}
          error={err('fleetSize')}
          placeholder="e.g. 5"
          hint="Number of vehicles you operate"
        />
      </div>

      <FileUploadField
        id="rcFiles"
        label="Vehicle Registration Certificates (RC)"
        required
        category="vehicle_rc"
        files={rcFiles}
        onChange={setRcFiles}
        persistedPaths={persistedPaths}
        onBusyChange={onRcBusy}
        error={err('rcFiles')}
        max={MAX_FLEET_FILES}
      />
      <FileUploadField
        id="vehiclePhotos"
        label="Vehicle Photos"
        required
        hint="Clear exterior photos showing the number plate · JPG/PNG/WEBP"
        category="vehicle_photos"
        files={vehiclePhotos}
        onChange={setVehiclePhotos}
        persistedPaths={persistedPaths}
        onBusyChange={onPhotoBusy}
        error={err('vehiclePhotos')}
        max={MAX_FLEET_FILES}
      />
      <FileUploadField
        id="insuranceFiles"
        label="Insurance / Fitness Certificates"
        required
        category="vehicle_insurance"
        files={insuranceFiles}
        onChange={setInsuranceFiles}
        persistedPaths={persistedPaths}
        onBusyChange={onInsBusy}
        error={err('insuranceFiles')}
        max={MAX_FLEET_FILES}
      />

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
