import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, SearchCheck, Trash2 } from 'lucide-react';
import type { FleetVehicleDoc, StoredFile } from '../../types';
import { saveFleetStep } from '../../services/onboardingService';
import { applyDetection, lookupVehicle, type VehicleLookupResult } from '../../services/vehicleLookup';
import { buildFleetDetails, emptyVehicle, indiaToday, isPlate, normalizePlate, validateVehicle, type VehicleErrors } from '../../utils/fleet';
import { describeDataError } from '../../utils/retry';
import { Button, ErrorBanner, FieldShell, TextField } from '../../components/onboarding/ui';
import { FileUploadField } from '../../components/onboarding/FileUploadField';
import type { StepProps } from './OnboardingWizard';

const TYPE_CHOICES: { value: string; label: string }[] = [
  { value: 'Hatchback', label: 'Hatchback' },
  { value: 'Sedan', label: 'Sedan' },
  { value: 'SUV', label: 'SUV (6+1 / 7+1)' },
  { value: 'Premium SUV', label: 'Innova Crysta' },
  { value: 'Tempo Traveller', label: 'Tempo Traveller' },
];
const DETECT_DELAY_MS = 800;

type Detection = { state: 'idle' } | { state: 'loading' } | { state: 'done'; result: VehicleLookupResult } | { state: 'error'; message: string };
type FileKey = 'rcFiles' | 'insuranceFiles' | 'fitnessFiles' | 'permitFiles' | 'frontPhotoFiles';

const dateInput = (err?: string) =>
  `w-full h-10 px-3 rounded-lg border text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#E21B23]/20 ${err ? 'border-[#E21B23]' : 'border-[#E5E5E5]'}`;

/** Spec page 13: "fleet documentation" — each vehicle detected from its registration number, with RC, insurance, FC, permit and a front photo. */
export const FleetStep: React.FC<StepProps> = ({ record, onNext, onBack }) => {
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

  const persistedPaths = useMemo(
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

  const setFiles = (key: FileKey) => (updater: (prev: StoredFile[]) => StoredFile[]) => setDraft((d) => ({ ...d, [key]: updater(d[key]) }));

  const resetEditor = () => {
    setDraft(emptyVehicle());
    setDetection({ state: 'idle' });
    setDetectedFor('');
    setErrors({});
  };

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
    resetEditor();
    setAdding(false);
  };

  const handleSave = async () => {
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
    } catch (error) {
      setSaveError(describeDataError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {legacy && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-[12px] font-medium text-blue-900">
          Please add each vehicle below with its own RC, insurance, FC and permit. Earlier combined uploads are kept for reference.
        </div>
      )}

      {vehicles.map((v) => (
        <div key={v.registrationNumber} className="flex items-start gap-3 rounded-xl border border-[#E5E5E5] bg-white p-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-[#111] font-mono">{v.registrationNumber}</div>
            <div className="text-[12px] text-[#555]">{[v.make, v.model].filter(Boolean).join(' ') || v.category}</div>
            <div className="text-[11px] text-[#888]">{[v.category === 'Premium SUV' ? 'Innova Crysta' : v.category, v.seatClass ? `${v.seatClass} seats` : '', v.fuelType].filter(Boolean).join(' • ')}</div>
            <div className="text-[11px] text-[#888]">Insurance {v.insuranceUpto} · FC {v.fitnessUpto} · Permit {v.permitUpto}</div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${v.source === 'vahan' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {v.source === 'vahan' ? 'Register verified' : 'Manual check'}
          </span>
          <button
            type="button"
            onClick={() => setVehicles((list) => list.filter((x) => x.registrationNumber !== v.registrationNumber))}
            className="text-[#999] hover:text-[#E21B23]"
            aria-label={`Remove ${v.registrationNumber}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-4 space-y-4">
          <h2 className="text-[13px] font-bold text-[#111]">{vehicles.length ? 'Add another vehicle' : 'Add a vehicle'}</h2>

          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <TextField
              id="registrationNumber"
              label="Registration Number"
              required
              value={draft.registrationNumber}
              onChange={onPlate}
              error={errors.registrationNumber}
              placeholder="TN 01 AB 1234"
              hint="Make, model, seats and fuel type are filled in automatically from the vehicle register."
            />
            <button
              type="button"
              onClick={() => void detect(draft.registrationNumber)}
              disabled={!isPlate(draft.registrationNumber) || detection.state === 'loading'}
              className="h-10 px-4 border border-[#E5E5E5] bg-white text-[12px] font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-40 hover:border-[#E21B23]"
            >
              {detection.state === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchCheck className="w-4 h-4" />}
              {detectedFor === plate && plate ? 'Check again' : 'Detect vehicle'}
            </button>
          </div>

          {detection.state === 'loading' && (
            <p className="text-[12px] text-[#555] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-[#E21B23]" /> Looking up {draft.registrationNumber} in the vehicle register…</p>
          )}
          {detection.state === 'error' && <ErrorBanner message={detection.message} />}
          {result?.status === 'not_found' && <ErrorBanner message="This registration number was not found in the vehicle register. Check the number on the plate and try again." />}
          {result?.status === 'found' && result.duplicate && <ErrorBanner message="This vehicle is already registered with another NESAM partner. Please contact NESAM support." />}
          {result?.status === 'found' && draft.source === 'vahan' && (
            <div className="border border-emerald-300 bg-emerald-50 rounded-xl p-4 space-y-1" data-testid="detected-vehicle">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <p className="text-[13px] font-extrabold text-[#111] flex-1">Vehicle found</p>
                <span className="text-[10px] font-bold bg-white border border-emerald-300 text-emerald-700 px-2 py-0.5 rounded">
                  {draft.category === 'Premium SUV' ? 'Innova Crysta' : draft.category}
                </span>
              </div>
              <p className="text-[13px] font-bold text-[#111]">{[draft.make, draft.model].filter(Boolean).join(' ')}</p>
              <p className="text-[12px] text-[#555]">{[draft.fuelType, draft.seatClass ? `${draft.seatClass} seats` : '', draft.year].filter(Boolean).join(' • ')}</p>
              <p className="text-[11px] text-[#888]">Registered to {result.vehicle.ownerNameMasked || 'the owner on record'}.</p>
              {result.issues.map((i) => (
                <p key={i.code} className="text-[11px] text-amber-800 font-semibold flex gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {i.message} Enter the dates from your current document below.
                </p>
              ))}
            </div>
          )}
          {manual && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[12px] font-medium text-amber-900">
                Automatic vehicle detection is unavailable right now. Choose the vehicle type — NESAM will verify the vehicle from your documents.
              </div>
              <FieldShell label="Vehicle Type" htmlFor="category" required error={errors.category}>
                <select id="category" className={dateInput(errors.category)} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
                  <option value="">Select</option>
                  {TYPE_CHOICES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </FieldShell>
            </div>
          )}

          <h3 className="text-[13px] font-bold text-[#111] pt-2 border-t border-[#EEE]">Vehicle documents</h3>
          <FileUploadField id="rcFiles" label="RC (registration certificate)" required category="vehicle_rc" files={draft.rcFiles} onChange={setFiles('rcFiles')} persistedPaths={persistedPaths} onBusyChange={onRc} error={errors.rcFiles} max={2} />
          <div className="grid sm:grid-cols-[1fr_200px] gap-4 items-start">
            <FileUploadField id="insuranceFiles" label="Insurance" required category="vehicle_insurance" files={draft.insuranceFiles} onChange={setFiles('insuranceFiles')} persistedPaths={persistedPaths} onBusyChange={onIns} error={errors.insuranceFiles} max={2} />
            <FieldShell label="Insurance valid till" htmlFor="insuranceUpto" required error={errors.insuranceUpto}>
              <input id="insuranceUpto" type="date" className={dateInput(errors.insuranceUpto)} value={draft.insuranceUpto} onChange={(e) => setDraft((d) => ({ ...d, insuranceUpto: e.target.value }))} />
            </FieldShell>
          </div>
          <div className="grid sm:grid-cols-[1fr_200px] gap-4 items-start">
            <FileUploadField id="fitnessFiles" label="FC (fitness certificate)" required category="vehicle_fc" files={draft.fitnessFiles} onChange={setFiles('fitnessFiles')} persistedPaths={persistedPaths} onBusyChange={onFc} error={errors.fitnessFiles} max={2} />
            <FieldShell label="FC valid till" htmlFor="fitnessUpto" required error={errors.fitnessUpto}>
              <input id="fitnessUpto" type="date" className={dateInput(errors.fitnessUpto)} value={draft.fitnessUpto} onChange={(e) => setDraft((d) => ({ ...d, fitnessUpto: e.target.value }))} />
            </FieldShell>
          </div>
          <div className="grid sm:grid-cols-[1fr_200px] gap-4 items-start">
            <FileUploadField id="permitFiles" label="Permit" required category="vehicle_permit" files={draft.permitFiles} onChange={setFiles('permitFiles')} persistedPaths={persistedPaths} onBusyChange={onPermit} error={errors.permitFiles} max={2} />
            <FieldShell label="Permit valid till" htmlFor="permitUpto" required error={errors.permitUpto}>
              <input id="permitUpto" type="date" className={dateInput(errors.permitUpto)} value={draft.permitUpto} onChange={(e) => setDraft((d) => ({ ...d, permitUpto: e.target.value }))} />
            </FieldShell>
          </div>
          <FileUploadField id="frontPhotoFiles" label="Vehicle Front (with plate)" required hint="Clear photo showing the number plate · JPG/PNG/WEBP" category="vehicle_photos" files={draft.frontPhotoFiles} onChange={setFiles('frontPhotoFiles')} persistedPaths={persistedPaths} onBusyChange={onFront} error={errors.frontPhotoFiles} max={1} />

          {Object.keys(errors).length > 0 && <ErrorBanner message="Please fix the highlighted fields." />}
          <div className="flex justify-end gap-2">
            {vehicles.length > 0 && (
              <Button variant="secondary" onClick={() => { resetEditor(); setAdding(false); }}>
                Cancel
              </Button>
            )}
            <Button onClick={addVehicle} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Add Vehicle'}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          + Add another vehicle
        </Button>
      )}

      {stepError && <ErrorBanner message={stepError} />}
      <ErrorBanner message={saveError} onRetry={saveError ? handleSave : undefined} />

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button onClick={handleSave} loading={saving} disabled={uploading}>
          {uploading ? 'Uploading…' : saving ? 'Saving…' : 'Save & Continue'}
        </Button>
      </div>
    </div>
  );
};
