import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Gauge, Loader2, RefreshCw, ShieldCheck, Timer } from 'lucide-react';
import type { TripDetails } from '../types';
import { CameraCapture } from '../components/CameraCapture';
import { ActionError } from '../services/callables';
import { getFirebaseLocation } from '../services/location';
import {
  SLOTS,
  createCaptureSession,
  finalizeVehicleVerification,
  getSlotChallenge,
  submitCapturePhoto,
  uploadCapture,
  type CaptureSession,
  type Challenge,
  type Slot,
} from '../services/verificationService';

interface Props {
  trip: TripDetails;
  onDone: () => void;
  onCancel: () => void;
}

type Phase = 'intro' | 'starting' | 'capturing' | 'review' | 'uploading' | 'odometer' | 'submitting';

/**
 * Step-by-step vehicle verification: front, rear, then dashboard/interior. Each step shows
 * a short-lived instruction, opens the live camera (no gallery), lets the driver retake,
 * and only moves on once the server has accepted the photo.
 */
export const VehicleVerificationScreen: React.FC<Props> = ({ trip, onDone, onCancel }) => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [index, setIndex] = useState(0);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [shot, setShot] = useState<{ blob: Blob; url: string; at: number } | null>(null);
  const [accepted, setAccepted] = useState<Partial<Record<Slot, string>>>({});
  const [reading, setReading] = useState('');
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [consent, setConsent] = useState(false);
  const urls = useRef<string[]>([]);

  const step = SLOTS[index];
  const allDone = SLOTS.every((s) => accepted[s.slot]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Countdown for the current instruction.
  useEffect(() => {
    if (!challenge || phase === 'odometer' || phase === 'submitting') return undefined;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((challenge.expiresAtMs - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [challenge, phase]);

  const fail = (err: unknown, fallback: string) => setError(err instanceof ActionError ? err.message : fallback);

  const openStep = useCallback(async (sessionId: string, i: number) => {
    setError('');
    setShot(null);
    setChallenge(null);
    setPhase('starting');
    try {
      setChallenge(await getSlotChallenge(sessionId, SLOTS[i].slot));
      setIndex(i);
      setPhase('capturing');
    } catch (err) {
      fail(err, 'Could not get the instruction for this photo.');
      setIndex(i);
      setPhase('capturing');
    }
  }, []);

  const begin = async () => {
    setError('');
    setPhase('starting');
    try {
      const s = await createCaptureSession(trip.id);
      setSession(s);
      await openStep(s.sessionId, 0);
    } catch (err) {
      fail(err, 'Could not start the verification.');
      setPhase('intro');
    }
  };

  const onCapture = (blob: Blob, at: number) => {
    const url = URL.createObjectURL(blob);
    urls.current.push(url);
    setShot({ blob, url, at });
    setPhase('review');
  };

  const usePhoto = async () => {
    if (!session || !challenge || !shot) return;
    if (Date.now() > challenge.expiresAtMs) {
      await openStep(session.sessionId, index);
      setError('That instruction expired. A new one has been issued — take the photo again.');
      return;
    }
    setError('');
    setPhase('uploading');
    try {
      const gps = await getFirebaseLocation(6000);
      await uploadCapture(challenge, session.sessionId, shot.blob);
      await submitCapturePhoto({ sessionId: session.sessionId, slot: step.slot, storagePath: challenge.storagePath, capturedAt: shot.at, gps });
      setAccepted((a) => ({ ...a, [step.slot]: shot.url }));
      if (index + 1 < SLOTS.length) await openStep(session.sessionId, index + 1);
      else setPhase('odometer');
    } catch (err) {
      const message = err instanceof ActionError ? err.message : 'The photo could not be submitted. Take it again.';
      // A rejected photo needs a fresh instruction before the next try.
      await openStep(session.sessionId, index);
      setError(message);
    }
  };

  const submit = async () => {
    const n = Number(reading);
    if (!session) return;
    if (!Number.isInteger(n) || n <= 0) return setError('Enter the starting odometer reading in km.');
    setError('');
    setPhase('submitting');
    try {
      await finalizeVerification(session.sessionId, n);
    } catch (err) {
      fail(err, 'The verification could not be submitted.');
      setPhase('odometer');
    }
  };
  const finalizeVerification = async (sessionId: string, n: number) => {
    await finalizeVehicleVerification(sessionId, n);
    onDone();
  };

  const header = (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[#E21E26] flex items-center justify-center shrink-0">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-[#E21E26]">Mandatory safety check</span>
          <h1 className="text-lg font-black text-gray-900">Vehicle Verification</h1>
        </div>
      </div>
      <p className="text-sm text-gray-700">
        Trip <span className="font-mono font-bold text-[#E21E26]">{trip.bookingId}</span>
        {session?.vehicleNumber ? ` · ${session.vehicleNumber}` : ''}
      </p>
    </div>
  );

  if (phase === 'intro') {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        {header}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-3 text-sm text-gray-800">
          <p className="font-bold">You will take 3 photos with the camera, one at a time:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Vehicle front</li>
            <li>Vehicle rear</li>
            <li>Dashboard / interior</li>
          </ol>
          <p>
            For each photo the app shows a short instruction and a 4-digit code that expire after a few minutes. Take the photo straight away. Photos from the
            gallery, old photos or photos of another screen are not accepted, and suspicious photos are flagged to NESAM.
          </p>
          <label className="flex items-start gap-2 font-semibold text-gray-900">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-5 h-5 mt-0.5 accent-[#E21E26]" />
            <span>
              I understand that the photos, the time they were taken and (if I allow it) my location are saved and shared with NESAM to verify the vehicle.
            </span>
          </label>
        </div>
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm font-semibold p-3 rounded-xl">
            {error}
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
          <button onClick={onCancel} className="px-5 py-3 border border-gray-300 text-gray-800 text-sm font-bold rounded-xl">
            Back
          </button>
          <button onClick={() => void begin()} disabled={!consent} className="px-8 py-3 bg-[#E21E26] text-white text-sm font-extrabold rounded-xl disabled:opacity-50">
            Start verification
          </button>
        </div>
      </div>
    );
  }

  const stepper = (
    <div className="grid grid-cols-3 gap-2" aria-label="Progress">
      {SLOTS.map((s, i) => (
        <div
          key={s.slot}
          className={`rounded-xl border p-2 text-center text-xs font-bold ${
            accepted[s.slot]
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : i === index && phase !== 'odometer'
                ? 'bg-red-50 border-red-300 text-[#E21E26]'
                : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}
        >
          {accepted[s.slot] ? (
            <img src={accepted[s.slot]} alt={`${s.label} captured`} className="w-full h-14 object-cover rounded-lg mb-1" />
          ) : (
            <div className="h-14 flex items-center justify-center text-lg">{i + 1}</div>
          )}
          {s.label}
          {accepted[s.slot] && phase !== 'submitting' && session && (
            <button type="button" onClick={() => void openStep(session.sessionId, i)} className="block w-full mt-1 text-[11px] underline">
              Retake
            </button>
          )}
        </div>
      ))}
    </div>
  );

  if (phase === 'odometer' || phase === 'submitting') {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        {header}
        {stepper}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-3">
          <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> All 3 photos accepted
          </p>
          <label className="block">
            <span className="text-sm font-bold text-gray-900 block mb-1">
              Starting odometer reading (km) <span className="text-[#E21E26]">*</span>
            </span>
            <div className="relative max-w-xs">
              <Gauge className="w-5 h-5 text-gray-500 absolute left-3 top-3" />
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={reading}
                onChange={(e) => setReading(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="e.g. 48210"
                className="w-full pl-10 pr-3 py-3 border border-gray-400 rounded-xl text-base font-mono font-bold"
              />
            </div>
          </label>
        </div>
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm font-semibold p-3 rounded-xl">
            {error}
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            onClick={() => session && void openStep(session.sessionId, 0)}
            disabled={phase === 'submitting'}
            className="px-5 py-3 border border-gray-300 text-gray-800 text-sm font-bold rounded-xl"
          >
            Retake photos
          </button>
          <button
            onClick={() => void submit()}
            disabled={phase === 'submitting' || !allDone}
            className="px-8 py-3 bg-[#E21E26] text-white text-sm font-extrabold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {phase === 'submitting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Submit verification
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {header}
      {stepper}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-600">
              Step {index + 1} of {SLOTS.length}
            </p>
            <h2 className="text-lg font-black text-gray-900">Capture {step.label}</h2>
            <p className="text-sm text-gray-700">{step.hint}</p>
          </div>
          {challenge && (
            <span
              className={`shrink-0 flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-lg border ${
                secondsLeft <= 30 ? 'bg-red-50 text-red-700 border-red-300' : 'bg-gray-50 text-gray-800 border-gray-300'
              }`}
            >
              <Timer className="w-4 h-4" />
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
            </span>
          )}
        </div>
        {challenge ? (
          <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 text-sm text-amber-950">
            <p className="font-bold">Now: {challenge.instruction}</p>
            <p>
              Show or write this code in the photo if you can: <span className="font-mono font-extrabold text-lg tracking-widest">{challenge.code}</span>
            </p>
          </div>
        ) : (
          phase !== 'starting' && (
            <button onClick={() => session && void openStep(session.sessionId, index)} className="px-4 py-2 border border-gray-400 rounded-lg text-sm font-bold">
              Get the instruction again
            </button>
          )
        )}
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm font-semibold p-3 rounded-xl flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {phase === 'starting' && (
          <div className="py-10 flex flex-col items-center gap-2 text-gray-700" role="status">
            <Loader2 className="w-7 h-7 animate-spin" />
            <span className="text-sm font-semibold">Preparing…</span>
          </div>
        )}
        {phase === 'capturing' && challenge && <CameraCapture onCapture={onCapture} />}
        {(phase === 'review' || phase === 'uploading') && shot && (
          <div className="space-y-3">
            <img src={shot.url} alt={`${step.label} preview`} className="w-full rounded-2xl border border-gray-300" />
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => {
                  setShot(null);
                  setPhase('capturing');
                }}
                disabled={phase === 'uploading'}
                className="px-5 py-3 border border-gray-400 text-gray-900 text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" /> Retake
              </button>
              <button
                onClick={() => void usePhoto()}
                disabled={phase === 'uploading'}
                className="px-8 py-3 bg-[#E21E26] text-white text-sm font-extrabold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {phase === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {phase === 'uploading' ? 'Checking…' : 'Use this photo'}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-start">
        <button onClick={onCancel} className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-bold rounded-xl">
          Cancel
        </button>
      </div>
    </div>
  );
};
