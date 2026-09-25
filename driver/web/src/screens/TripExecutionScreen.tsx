import React, { useState } from 'react';
import type { TollReceipt, TripDetails, TripStage } from '../types';
import {
  MapPin,
  Navigation,
  PhoneCall,
  KeyRound,
  Gauge,
  Receipt,
  Flag,
  CheckCircle2,
  Loader2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { PhotoUpload } from '../components/PhotoUpload';
import { describeFirestoreError, saveTripTolls } from '../services/driverFirestoreService';

interface TripExecutionScreenProps {
  trip: TripDetails;
  onReachedPickup: (location: { lat: number; lng: number } | null) => Promise<void>;
  onStartTrip: (otp: string) => Promise<void>;
  onArrived: () => Promise<void>;
  onComplete: (endOdometer: number, tolls: TollReceipt[]) => Promise<void>;
}

const PICKUP_RADIUS_KM = 2;
const STAGE_ORDER: TripStage[] = ['En Route Pickup', 'Reached Pickup', 'In Progress', 'Arrived Destination'];
const STAGE_LABELS = ['To Pickup', 'At Pickup', 'On Trip', 'End Trip'];

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

const mapsLink = (loc: TripDetails['pickup']) =>
  loc.lat != null && loc.lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc.address)}`;

export const TripExecutionScreen: React.FC<TripExecutionScreenProps> = ({
  trip,
  onReachedPickup,
  onStartTrip,
  onArrived,
  onComplete,
}) => {
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

  const stageIdx = STAGE_ORDER.indexOf(trip.stage);

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(describeFirestoreError(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const handleReachedPickup = () =>
    run(async () => {
      const here = await getPosition();
      if (here && trip.pickup.lat != null && trip.pickup.lng != null) {
        const d = haversineKm(here, { lat: trip.pickup.lat, lng: trip.pickup.lng });
        if (d > PICKUP_RADIUS_KM) {
          throw new Error(`You are ${d.toFixed(1)} km from the pickup point. Move within ${PICKUP_RADIUS_KM} km to continue.`);
        }
      }
      await onReachedPickup(here);
    }, 'Could not update the trip.');

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(otp)) {
      setError('Enter the 4-digit boarding OTP shown in the customer’s app.');
      return;
    }
    run(() => onStartTrip(otp), 'Incorrect OTP. Please check with the customer and try again.');
  };

  const handleAddToll = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(tollAmount);
    if (!tollName.trim() || !(amount > 0)) {
      setTollError('Enter the toll plaza name and amount.');
      return;
    }
    if (!tollPhoto) {
      setTollError('Upload a photo of the toll receipt.');
      return;
    }
    const next = [
      ...tolls,
      { id: `TOLL-${Date.now()}`, name: tollName.trim(), amount, receiptPhotoUrl: tollPhoto, uploadedAt: new Date().toISOString() },
    ];
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

  const handleComplete = () => {
    const end = Number(endOdometer);
    const start = trip.startOdometer ?? 0;
    if (!(end > 0)) {
      setError('Enter the ending odometer reading.');
      return;
    }
    if (end < start) {
      setError(`Ending reading must be at least the starting reading (${start} km).`);
      return;
    }
    run(() => onComplete(end, tolls), 'Could not complete the trip. Please try again.');
  };

  const totalTolls = tolls.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#E21E26] text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded">Live Trip</span>
            <span className="text-xs text-gray-400 font-mono">{trip.bookingId}</span>
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold mt-1 text-gray-900">{trip.customerName}</h1>
          <p className="text-xs text-gray-500">{trip.scheduledDate} {trip.scheduledTime} • {trip.paymentMode}</p>
        </div>
        <div className="flex items-center gap-3">
          {trip.customerPhone && (
            <a href={`tel:${trip.customerPhone}`} className="flex-1 md:flex-none justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5">
              <PhoneCall className="w-4 h-4" /> Call Customer
            </a>
          )}
          <div className="text-right bg-gray-50 px-4 py-2 rounded-xl border border-gray-200 shrink-0">
            <span className="text-[10px] text-gray-500 font-medium">Your Payout</span>
            <p className="text-lg font-black text-[#E21E26]">₹{trip.driverEarnings.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm grid grid-cols-4 gap-2 text-center">
        {STAGE_LABELS.map((label, i) => (
          <div
            key={label}
            className={`p-2 rounded-xl border text-xs ${
              i === stageIdx ? 'bg-red-50 border-red-300 text-[#E21E26] font-bold' : i < stageIdx ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold' : 'bg-gray-50 border-gray-200 text-gray-400'
            }`}
          >
            <span className="text-[10px] block">STEP {i + 1}</span>
            {label}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3 rounded-xl flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* STEP 1 — driving to pickup */}
      {trip.stage === 'En Route Pickup' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-[#E21E26]" /> Drive to Pickup
          </h2>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-800 font-semibold">{trip.pickup.address}</p>
          </div>
          <p className="text-[11px] text-gray-500">
            Your location is checked when you mark arrival — you must be within {PICKUP_RADIUS_KM} km of the pickup point.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-end">
            <a href={mapsLink(trip.pickup)} target="_blank" rel="noreferrer" className="px-5 py-3 bg-gray-900 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2">
              <Navigation className="w-4 h-4" /> Navigate in Google Maps
            </a>
            <button onClick={handleReachedPickup} disabled={busy} className="px-6 py-3 rounded-xl font-extrabold text-xs text-white bg-[#E21E26] hover:bg-[#C9141B] shadow-md flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />} I've Reached Pickup
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — boarding OTP */}
      {trip.stage === 'Reached Pickup' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border-2 border-[#E21E26] shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Boarding OTP</h2>
              <p className="text-xs text-gray-500">Ask {trip.customerName} for the 4-digit OTP shown in their app.</p>
            </div>
          </div>
          <form onSubmit={handleStart} className="space-y-4 bg-gray-50 p-4 rounded-xl border">
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="• • • •"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl font-mono text-2xl font-extrabold tracking-[0.5em] text-center focus:outline-none focus:border-[#E21E26]"
            />
            <button type="submit" disabled={busy} className="w-full py-3 bg-[#E21E26] hover:bg-[#C9141B] text-white font-extrabold text-xs rounded-xl shadow flex items-center justify-center gap-2 disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Verify OTP &amp; Start Trip
            </button>
          </form>
        </div>
      )}

      {/* STEP 3 — on trip */}
      {trip.stage === 'In Progress' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-md space-y-5">
          <div className="flex items-center justify-between border-b pb-4 gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">● Trip in progress</span>
              <h2 className="text-lg font-extrabold text-gray-900 mt-1">Driving to Destination</h2>
              <p className="text-xs text-gray-500">{trip.drop.address}</p>
            </div>
            {trip.distanceKm > 0 && (
              <div className="text-right shrink-0">
                <span className="text-xs text-gray-500">Est. Distance</span>
                <p className="text-2xl font-black text-gray-900">{trip.distanceKm} km</p>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-end">
            <a href={mapsLink(trip.drop)} target="_blank" rel="noreferrer" className="px-5 py-3 bg-gray-100 text-gray-900 text-xs font-bold rounded-xl flex items-center justify-center gap-2 border">
              <Navigation className="w-4 h-4 text-[#E21E26]" /> Navigate
            </a>
            <button
              onClick={() => run(onArrived, 'Could not update the trip.')}
              disabled={busy}
              className="px-6 py-3 bg-[#111] hover:bg-[#262626] text-white text-xs font-extrabold rounded-xl shadow flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4 text-[#E21E26]" />} Arrived at Destination
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 — end trip */}
      {trip.stage === 'Arrived Destination' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-lg space-y-5">
          <div className="border-b pb-3">
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <Flag className="w-5 h-5 text-[#E21E26]" /> End Trip
            </h2>
            <p className="text-xs text-gray-500">Enter the final odometer reading and add any toll receipts.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
              <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-[#E21E26]" /> Ending Odometer (km)
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={endOdometer}
                onChange={(e) => setEndOdometer(e.target.value.replace(/[^\d]/g, ''))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono font-bold text-lg text-gray-900"
                placeholder={trip.startOdometer ? String(trip.startOdometer + Math.round(trip.distanceKm)) : ''}
              />
              {trip.startOdometer != null && (
                <p className="text-[10px] text-gray-500">
                  Start reading: <span className="font-mono font-bold">{trip.startOdometer} km</span>
                  {Number(endOdometer) > trip.startOdometer && ` • Driven: ${Number(endOdometer) - trip.startOdometer} km`}
                </p>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-emerald-600" /> Toll Receipts
                </label>
                <button onClick={() => setShowTollModal(true)} className="px-2.5 py-1 bg-[#111] text-white text-[11px] font-bold rounded">
                  + Add Toll
                </button>
              </div>
              {tolls.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2">No tolls added.</p>
              ) : (
                <div className="space-y-2 pt-1">
                  {tolls.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs bg-white p-2 rounded border">
                      <img src={t.receiptPhotoUrl} alt="" className="w-8 h-8 rounded object-cover" />
                      <span className="font-semibold text-gray-800 flex-1 truncate">{t.name}</span>
                      <span className="font-mono font-bold text-[#E21E26]">₹{t.amount}</span>
                      <button onClick={() => removeToll(t.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <p className="text-[11px] text-right font-bold text-gray-700">Total tolls: ₹{totalTolls}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border text-xs space-y-1 max-w-md ml-auto">
            <div className="flex justify-between"><span className="text-gray-500">Trip payout</span><span className="font-mono font-bold">₹{trip.driverEarnings}</span></div>
            <div className="flex justify-between text-emerald-700"><span>Toll reimbursement</span><span className="font-mono font-bold">+ ₹{totalTolls}</span></div>
            <div className="border-t pt-1 flex justify-between text-sm font-black text-[#E21E26]"><span>Total earnings</span><span>₹{trip.driverEarnings + totalTolls}</span></div>
          </div>

          <div className="flex justify-end">
            <button onClick={handleComplete} disabled={busy} className="px-8 py-3 bg-[#E21E26] hover:bg-[#C9141B] text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Complete Trip
            </button>
          </div>
        </div>
      )}

      {showTollModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-gray-900">Add Toll Receipt</h3>
            <form onSubmit={handleAddToll} className="space-y-3">
              <input value={tollName} onChange={(e) => setTollName(e.target.value)} placeholder="Toll plaza name" className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input type="number" inputMode="numeric" value={tollAmount} onChange={(e) => setTollAmount(e.target.value)} placeholder="Amount (₹)" className="w-full px-3 py-2 border rounded-lg text-sm font-mono font-bold" />
              <PhotoUpload compact label="Receipt Photo" value={tollPhoto} folder={`trips/${trip.id}/tolls`} name="toll" capture="environment" required onChange={setTollPhoto} />
              {tollError && <p className="text-[11px] text-red-600 font-semibold">{tollError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => { setShowTollModal(false); setTollError(''); }} className="px-3 py-1.5 border text-xs font-bold rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-[#E21E26] text-white text-xs font-bold rounded-lg">Save Receipt</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
