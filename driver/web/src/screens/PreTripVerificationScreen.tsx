import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Gauge, Loader2, ShieldCheck } from 'lucide-react';
import type { PreTripPhotos, TripDetails } from '../types';
import { PhotoUpload } from '../components/PhotoUpload';
import { describeFirestoreError } from '../services/driverFirestoreService';

interface PreTripVerificationScreenProps {
  trip: TripDetails;
  onSubmit: (photos: PreTripPhotos) => Promise<void>;
  onCancel: () => void;
}

export const PreTripVerificationScreen: React.FC<PreTripVerificationScreenProps> = ({ trip, onSubmit, onCancel }) => {
  const [selfie, setSelfie] = useState(trip.preTrip?.selfie ?? '');
  const [vehicleFront, setVehicleFront] = useState(trip.preTrip?.vehicleFront ?? '');
  const [odometer, setOdometer] = useState(trip.preTrip?.odometer ?? '');
  const [rearSeat, setRearSeat] = useState(trip.preTrip?.rearSeat ?? '');
  const [reading, setReading] = useState(trip.preTrip?.odometerReading ? String(trip.preTrip.odometerReading) : '');
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const folder = `trips/${trip.id}`;
  const readingNum = Number(reading);
  const complete = Boolean(selfie && vehicleFront && odometer && rearSeat && readingNum > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (!complete) {
      setError('All 4 photos and the odometer reading are required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({
        selfie,
        vehicleFront,
        odometer,
        rearSeat,
        odometerReading: readingNum,
        capturedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(describeFirestoreError(err, 'Could not submit the pre-trip check. This trip may have been reassigned or cancelled.'));
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#E21E26] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#E21E26]">Mandatory Safety Check</span>
            <h1 className="text-base sm:text-lg font-black">Pre-Trip Vehicle Verification</h1>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Trip <span className="font-mono text-[#E21E26] font-bold">{trip.bookingId}</span> • Pickup: {trip.pickup.address}
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-xs flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <span>Capture all 4 live photos before heading to pickup. They are shared with NESAM operations for safety audit.</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <PhotoUpload label="1. Driver Selfie" hint="Face clearly visible, in uniform" value={selfie} folder={folder} name="selfie" capture="user" required showError={showErrors} onChange={setSelfie} />
          <PhotoUpload label="2. Vehicle Front & Number Plate" hint="Plate must be readable" value={vehicleFront} folder={folder} name="vehicle-front" capture="environment" required showError={showErrors} onChange={setVehicleFront} />
          <div className="space-y-2">
            <PhotoUpload label="3. Odometer / Dashboard" hint="Reading clearly visible" value={odometer} folder={folder} name="odometer" capture="environment" required showError={showErrors} onChange={setOdometer} />
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <label className="text-[11px] font-bold text-gray-700 block mb-1">Starting Odometer Reading (km) <span className="text-[#E21E26]">*</span></label>
              <div className="relative">
                <Gauge className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={reading}
                  onChange={(e) => setReading(e.target.value.replace(/[^\d]/g, ''))}
                  className={`w-full pl-8 pr-3 py-2 border rounded-lg text-sm font-mono font-bold ${showErrors && !(readingNum > 0) ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder="e.g. 48210"
                />
              </div>
            </div>
          </div>
          <PhotoUpload label="4. Rear Passenger Seat" hint="Clean seats and seat covers" value={rearSeat} folder={folder} name="rear-seat" capture="environment" required showError={showErrors} onChange={setRearSeat} />
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3 rounded-xl">{error}</div>}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200">
          <button type="button" onClick={onCancel} disabled={submitting} className="px-4 py-2.5 border border-gray-300 text-gray-700 text-xs font-bold rounded-xl w-full sm:w-auto">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`w-full sm:w-auto px-6 sm:px-8 py-3 rounded-xl text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 ${
              complete ? 'bg-[#E21E26] hover:bg-[#C9141B]' : 'bg-gray-400'
            } disabled:opacity-70`}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {submitting ? 'Submitting...' : 'Submit & Start to Pickup'}
          </button>
        </div>
      </form>
    </div>
  );
};
