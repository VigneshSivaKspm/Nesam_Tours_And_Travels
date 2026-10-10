import React, { useRef, useState } from 'react';
import type { TollReceipt, TripDetails } from '../types';
import {
  MapPin, Navigation, PhoneCall, KeyRound, Gauge, Receipt, Flag, CheckCircle2, Loader2, Trash2, AlertTriangle, ShieldCheck, Wallet, PlayCircle,
} from 'lucide-react';
import { PhotoUpload } from '../components/PhotoUpload';
import { FarePanel } from '../components/FarePanel';
import { describeFirestoreError, saveTripTolls } from '../services/driverFirestoreService';
import { ActionError } from '../services/callables';
import { newRequestId, recordCollection } from '../services/tripService';
import { formatDate, formatDateTime12, formatTime12 } from '../utils/time';

interface TripExecutionScreenProps {
  trip: TripDetails;
  onStartVerification: () => void;
  onTripStart: (requestId: string) => Promise<void>;
  onReachedPickup: (requestId: string) => Promise<void>;
  onVerifyBoarding: (otp: string) => Promise<void>;
  onTripEnd: (endOdometer: number, tolls: TollReceipt[], requestId: string) => Promise<void>;
}

const mapsLink = (loc: TripDetails['pickup']) =>
  loc.lat != null && loc.lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc.address)}`;

const STEPS = ['Reached Pickup Location', 'Trip Started', 'Trip End'] as const;
const rupees = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN')}`;

export const TripExecutionScreen: React.FC<TripExecutionScreenProps> = ({ trip, onStartVerification, onTripStart, onReachedPickup, onVerifyBoarding, onTripEnd }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [endOdometer, setEndOdometer] = useState('');
  const [tolls, setTolls] = useState<TollReceipt[]>(trip.tolls);
  const [showTollModal, setShowTollModal] = useState(false);
  const [tollName, setTollName] = useState('');
  const [tollAmount, setTollAmount] = useState('');
  const [tollPhoto, setTollPhoto] = useState('');
  const [tollError, setTollError] = useState('');
  // One key per press: a double tap or a retry never repeats the step.
  const requestId = useRef(newRequestId());

  // Current step: 0 = on the way, 1 = at pickup, 2 = trip started, 3 = ended.
  const done = trip.subStatus === 'Not Started' ? 0 : trip.subStatus === 'Reached Pickup' ? 1 : trip.subStatus === 'Trip Started' ? 2 : 3;
  const stamps: (Date | null)[] = [trip.reachedPickupAt, trip.tripStartedAt, trip.tripEndedAt];
  const atPickup = trip.subStatus === 'Reached Pickup';
  const pickupWhen = trip.pickupAt ? `${formatDate(trip.pickupAt)}, ${formatTime12(trip.pickupAt)}` : [trip.scheduledDate, trip.scheduledTime].filter(Boolean).join(' ');
  const boardingOk = trip.boardingVerified || trip.legacyFlow;

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setError('');
    setBusy(true);
    try {
      await fn();
      requestId.current = newRequestId();
    } catch (err) {
      setError(err instanceof ActionError ? err.message : describeFirestoreError(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyBoarding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(otp)) return setError('Enter the 4-digit boarding OTP from the customer.');
    void run(async () => {
      await onVerifyBoarding(otp);
      setOtp('');
    }, 'That code is not correct. Please check with the customer and try again.');
  };

  const handleAddToll = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(tollAmount);
    if (!tollName.trim() || !(amount > 0)) return setTollError('Enter the toll plaza name and amount.');
    if (!tollPhoto) return setTollError('Upload a photo of the toll receipt.');
    const next = [...tolls, { id: `TOLL-${Date.now()}`, name: tollName.trim(), amount, receiptPhotoUrl: tollPhoto, uploadedAt: new Date().toISOString() }];
    try {
      await saveTripTolls(trip.id, next);
      setTolls(next);
      setShowTollModal(false);
      setTollName('');
      setTollAmount('');
      setTollPhoto('');
      setTollError('');
    } catch (err) {
      setTollError(describeFirestoreError(err, 'Could not save the toll receipt.'));
    }
  };

  const removeToll = async (id: string) => {
    const next = tolls.filter((t) => t.id !== id);
    try {
      await saveTripTolls(trip.id, next);
      setTolls(next);
    } catch (err) {
      setError(describeFirestoreError(err, 'Could not remove the toll receipt.'));
    }
  };

  const handleEnd = () => {
    const end = Number(endOdometer);
    const start = trip.startOdometer ?? 0;
    if (!(end > 0)) return setError('Enter the ending odometer reading.');
    if (end < start) return setError(`The ending reading must be at least the starting reading (${start} km).`);
    void run(() => onTripEnd(end, tolls, requestId.current), 'Could not end the trip. Please try again.');
  };

  const totalTolls = tolls.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#E21E26] text-white text-xs font-extrabold uppercase px-2 py-0.5 rounded">{done === 0 ? 'Go to pickup' : done === 1 ? 'At pickup' : 'Live trip'}</span>
            <span className="text-sm text-gray-600 font-mono">{trip.bookingId}</span>
          </div>
          <h1 className="text-xl font-extrabold mt-1 text-gray-900">{trip.customerName || 'Customer'}</h1>
          <p className="text-sm text-gray-700">{[pickupWhen, trip.paymentMode].filter(Boolean).join(' • ')}</p>
        </div>
        <div className="flex items-center gap-3">
          {trip.customerPhone && (
            <a href={`tel:${trip.customerPhone}`} className="flex-1 md:flex-none justify-center px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm flex items-center gap-1.5">
              <PhoneCall className="w-4 h-4" /> Call Customer
            </a>
          )}
          <div className="text-right bg-gray-50 px-4 py-2 rounded-xl border border-gray-200 shrink-0">
            <span className="text-xs text-gray-600 font-medium">Your Payout</span>
            <p className="text-lg font-black text-[#E21E26]">{trip.fleetTrip ? 'Paid by fleet' : trip.driverEarnings !== null ? rupees(trip.driverEarnings) : 'Not recorded'}</p>
            {!trip.fleetTrip && trip.driverEarnings !== null && <span className="text-[11px] text-gray-600">{trip.payoutFinalized ? 'Finalized by NESAM finance' : 'Agreed payout'}</span>}
          </div>
        </div>
      </div>

      {/* The three steps */}
      <ol className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm grid grid-cols-3 gap-2 text-center" aria-label="Trip steps">
        {STEPS.map((label, i) => {
          const complete = done > i;
          const current = done === i;
          return (
            <li key={label} className={`p-2 rounded-xl border text-sm ${current ? 'bg-red-50 border-red-300 text-[#E21E26] font-bold' : complete ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
              <span className="text-xs block">STEP {i + 1}</span>
              {label}
              {stamps[i] && <span className="block text-xs font-normal mt-0.5">{formatTime12(stamps[i])}</span>}
            </li>
          );
        })}
      </ol>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm font-semibold p-3 rounded-xl flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <FarePanel fare={trip.fareAmount} lines={trip.fareBreakup} payment={trip.paymentSummary} />

      {/* Step 1: drive to the pickup and mark arrival */}
      {done === 0 && (
        <>
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><Navigation className="w-5 h-5 text-[#E21E26]" /> Drive to the pickup</h2>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-900 font-semibold">{trip.pickup.address}</p>
            </div>
            <p className="text-sm text-gray-700">When you arrive, tap “Reached Pickup Location”. Your position is checked when your location is shared.</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <a href={mapsLink(trip.pickup)} target="_blank" rel="noreferrer" className="px-5 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
                <Navigation className="w-4 h-4" /> Navigate in Google Maps
              </a>
              <button onClick={() => void run(() => onReachedPickup(requestId.current), 'Could not update the trip.')} disabled={busy} className="px-6 py-3 rounded-xl font-extrabold text-sm text-white bg-[#E21E26] hover:bg-[#C9141B] shadow-md flex items-center justify-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />} Reached Pickup Location
              </button>
            </div>
          </div>
          {!trip.verificationSubmitted && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#E21E26]" /> Vehicle photos</h2>
              <p className="text-sm text-gray-800">Take the 3 vehicle photos (front, rear, dashboard/interior) with the camera {atPickup ? 'before you start the trip' : 'now or at the pickup'}.</p>
              <div className="flex justify-end">
                <button onClick={onStartVerification} className={`px-6 py-3 rounded-xl font-extrabold text-sm flex items-center gap-2 ${atPickup ? 'text-white bg-[#E21E26] hover:bg-[#C9141B] shadow-md' : 'text-gray-900 bg-white border border-gray-400 hover:bg-gray-50'}`}>
                  <ShieldCheck className="w-4 h-4" /> Take vehicle photos
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Step 2: at the pickup — boarding OTP + vehicle photos, then Trip Started */}
      {done === 1 && (
        <>
          {!boardingOk && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border-2 border-[#E21E26] shadow-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center"><KeyRound className="w-6 h-6" /></div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Boarding OTP</h2>
                  <p className="text-sm text-gray-700">Ask {trip.customerName || 'the customer'} for the 4-digit OTP from their app or message. Five wrong tries lock the check for 10 minutes.</p>
                </div>
              </div>
              <form onSubmit={handleVerifyBoarding} className="space-y-3 bg-gray-50 p-4 rounded-xl border">
                <input
                  type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • •" aria-label="Boarding OTP"
                  className="w-full px-4 py-3 border border-gray-400 rounded-xl font-mono text-2xl font-extrabold tracking-[0.5em] text-center focus:outline-none focus:border-[#E21E26]"
                />
                <button type="submit" disabled={busy} className="w-full py-3.5 bg-[#E21E26] hover:bg-[#C9141B] text-white font-extrabold text-sm rounded-xl shadow flex items-center justify-center gap-2 disabled:opacity-60">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} Verify OTP
                </button>
              </form>
            </div>
          )}
          {!trip.verificationSubmitted && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#E21E26]" /> Vehicle photos</h2>
              <p className="text-sm text-gray-800">Take the 3 vehicle photos (front, rear, dashboard/interior) with the camera {atPickup ? 'before you start the trip' : 'now or at the pickup'}.</p>
              <div className="flex justify-end">
                <button onClick={onStartVerification} className={`px-6 py-3 rounded-xl font-extrabold text-sm flex items-center gap-2 ${atPickup ? 'text-white bg-[#E21E26] hover:bg-[#C9141B] shadow-md' : 'text-gray-900 bg-white border border-gray-400 hover:bg-gray-50'}`}>
                  <ShieldCheck className="w-4 h-4" /> Take vehicle photos
                </button>
              </div>
            </div>
          )}

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><PlayCircle className="w-5 h-5 text-[#E21E26]" /> Start the trip</h2>
            <ul className="text-sm space-y-1">
              <li className={`flex items-center gap-2 ${boardingOk ? 'text-emerald-800 font-semibold' : 'text-gray-700'}`}>{boardingOk ? <CheckCircle2 className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />} Boarding OTP {boardingOk ? 'verified' : 'needed'}</li>
              <li className={`flex items-center gap-2 ${trip.verificationSubmitted ? 'text-emerald-800 font-semibold' : 'text-gray-700'}`}>{trip.verificationSubmitted ? <CheckCircle2 className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />} Vehicle photos {trip.verificationSubmitted ? 'submitted' : 'needed'}</li>
            </ul>
            <div className="flex justify-end">
              <button onClick={() => void run(() => onTripStart(requestId.current), 'Could not start the trip.')} disabled={busy || !boardingOk || !trip.verificationSubmitted} className="px-8 py-3.5 rounded-xl font-extrabold text-sm text-white bg-[#E21E26] hover:bg-[#C9141B] shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />} Trip Started
              </button>
            </div>
          </div>
        </>
      )}

      {/* Step 3: on the trip — tolls, collections, end */}
      {done === 2 && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-lg space-y-5">
          <div className="border-b pb-3">
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2"><Flag className="w-5 h-5 text-[#E21E26]" /> Trip End</h2>
            <p className="text-sm text-gray-700">Drive to {trip.drop.address}. At the destination enter the final odometer reading, add toll receipts and record any payment you collected.</p>
            <a href={mapsLink(trip.drop)} target="_blank" rel="noreferrer" className="mt-2 inline-flex px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg items-center gap-2"><Navigation className="w-3.5 h-3.5" /> Navigate to drop</a>
          </div>
          <div className="space-y-5">
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
                <label className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><Gauge className="w-4 h-4 text-[#E21E26]" /> Ending Odometer (km)</label>
                <input type="number" inputMode="numeric" value={endOdometer} onChange={(e) => setEndOdometer(e.target.value.replace(/[^\d]/g, ''))} className="w-full px-3 py-2.5 border border-gray-400 rounded-lg font-mono font-bold text-lg text-gray-900" placeholder={trip.startOdometer ? String(trip.startOdometer + Math.round(trip.distanceKm)) : ''} />
                {trip.startOdometer != null && (
                  <p className="text-xs text-gray-700">Start reading: <span className="font-mono font-bold">{trip.startOdometer} km</span>{Number(endOdometer) > trip.startOdometer && ` • Driven: ${Number(endOdometer) - trip.startOdometer} km`}</p>
                )}
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><Receipt className="w-4 h-4 text-emerald-600" /> Toll Receipts</span>
                  <button type="button" onClick={() => setShowTollModal(true)} className="px-3 py-1.5 bg-[#111] text-white text-xs font-bold rounded">+ Add Toll</button>
                </div>
                {tolls.length === 0 ? (
                  <p className="text-sm text-gray-600 italic py-2">No tolls added.</p>
                ) : (
                  <div className="space-y-2 pt-1">
                    {tolls.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm bg-white p-2 rounded border">
                        <img src={t.receiptPhotoUrl} alt="" className="w-8 h-8 rounded object-cover" />
                        <span className="font-semibold text-gray-900 flex-1 truncate">{t.name}</span>
                        <span className="font-mono font-bold text-[#E21E26]">{rupees(t.amount)}</span>
                        <button type="button" onClick={() => void removeToll(t.id)} aria-label={`Remove ${t.name}`} className="text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                    <p className="text-sm text-right font-bold text-gray-800">Total tolls: {rupees(totalTolls)}</p>
                  </div>
                )}
              </div>
            </div>

            <CollectionForm trip={trip} />

            <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border">
              {trip.fleetTrip
                ? `This is a fleet trip: your fleet operator settles your pay. Toll receipts (${rupees(totalTolls)}) are reviewed by NESAM and reimbursed to the fleet.`
                : 'Your payout is credited after NESAM verifies the fare; tolls are reimbursed once NESAM approves the receipts.'}
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={handleEnd} disabled={busy} className="px-8 py-3.5 bg-[#E21E26] hover:bg-[#C9141B] text-white font-black text-sm rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Trip End
              </button>
            </div>
          </div>
        </div>
      )}

      {done === 3 && (
        <div className="bg-emerald-50 border border-emerald-300 p-5 rounded-2xl text-emerald-900 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" /> Trip ended {trip.tripEndedAt ? `at ${formatDateTime12(trip.tripEndedAt)}` : ''}.
        </div>
      )}

      {showTollModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-900">Add Toll Receipt</h3>
            <form onSubmit={handleAddToll} className="space-y-3">
              <input value={tollName} onChange={(e) => setTollName(e.target.value)} placeholder="Toll plaza name" aria-label="Toll plaza name" className="w-full px-3 py-2.5 border border-gray-400 rounded-lg text-sm" />
              <input type="number" inputMode="numeric" value={tollAmount} onChange={(e) => setTollAmount(e.target.value)} placeholder="Amount (₹)" aria-label="Toll amount" className="w-full px-3 py-2.5 border border-gray-400 rounded-lg text-sm font-mono font-bold" />
              <PhotoUpload compact label="Receipt Photo" value={tollPhoto} folder={`trips/${trip.id}/tolls`} name="toll" capture="environment" required onChange={setTollPhoto} />
              {tollError && <p className="text-sm text-red-700 font-semibold">{tollError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => { setShowTollModal(false); setTollError(''); }} className="px-4 py-2 border border-gray-400 text-sm font-bold rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#E21E26] text-white text-sm font-bold rounded-lg">Save Receipt</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/** The driver records money collected from the customer; each entry is saved as a payment against the driver. */
const CollectionForm: React.FC<{ trip: TripDetails }> = ({ trip }) => {
  const balance = trip.paymentSummary?.balanceDue ?? trip.fareAmount;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer'>('Cash');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const key = useRef(newRequestId());

  const save = async () => {
    const n = Number(amount);
    if (!(n > 0)) return setMsg({ ok: false, text: 'Enter the amount you collected.' });
    if (method !== 'Cash' && reference.trim().length < 4) return setMsg({ ok: false, text: `Enter the ${method === 'UPI' ? 'UPI transaction' : 'transfer'} reference.` });
    setBusy(true);
    setMsg(null);
    try {
      await recordCollection({ bookingId: trip.id, amount: n, method, reference: reference.trim(), requestId: key.current });
      key.current = newRequestId();
      setAmount('');
      setReference('');
      setMsg({ ok: true, text: `${rupees(n)} ${method} recorded as collected by you.` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ActionError ? err.message : 'The payment was not recorded.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
      <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><Wallet className="w-4 h-4 text-emerald-600" /> Payment collected from the customer</p>
      <p className="text-xs text-gray-700">Balance still to be paid: <strong>{rupees(balance)}</strong>. Record cash or other payments you receive; each one is kept with your name.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (₹)" aria-label="Amount collected" className="px-3 py-2.5 border border-gray-400 rounded-lg text-sm font-mono font-bold" />
        <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} aria-label="Payment method" className="px-3 py-2.5 border border-gray-400 rounded-lg text-sm bg-white">
          <option>Cash</option><option>UPI</option><option>Bank Transfer</option>
        </select>
        {method !== 'Cash' && <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === 'UPI' ? 'UPI transaction ID' : 'Reference'} aria-label="Payment reference" className="px-3 py-2.5 border border-gray-400 rounded-lg text-sm" />}
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm font-semibold ${msg.ok ? 'text-emerald-800' : 'text-red-700'}`}>{msg.text}</p>}
      <button type="button" onClick={() => void save()} disabled={busy || balance <= 0} className="px-4 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-lg disabled:opacity-50">{busy ? 'Saving…' : 'Record payment'}</button>
    </div>
  );
};
