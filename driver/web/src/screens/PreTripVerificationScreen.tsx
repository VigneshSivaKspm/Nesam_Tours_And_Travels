import React, { useState } from 'react';
import { TripDetails, PreTripVerification } from '../types';
import { Camera, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, Gauge } from 'lucide-react';

interface PreTripVerificationScreenProps {
  trip: TripDetails;
  onCompleteVerification: (verification: PreTripVerification) => void;
  onCancel: () => void;
}

export const PreTripVerificationScreen: React.FC<PreTripVerificationScreenProps> = ({
  trip,
  onCompleteVerification,
  onCancel
}) => {
  const [selfie, setSelfie] = useState<string>('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80');
  const [vehicleFront, setVehicleFront] = useState<string>('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=500&auto=format&fit=crop&q=80');
  const [odometerPhoto, setOdometerPhoto] = useState<string>('https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=500&auto=format&fit=crop&q=80');
  const [rearSeat, setRearSeat] = useState<string>('https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=500&auto=format&fit=crop&q=80');
  const [odometerReading, setOdometerReading] = useState<number>(84290);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const handleCapture = (step: 'selfie' | 'vehicle' | 'odometer' | 'rear') => {
    const dummyCaptures = {
      selfie: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
      vehicle: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=500&auto=format&fit=crop&q=80',
      odometer: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=500&auto=format&fit=crop&q=80',
      rear: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=500&auto=format&fit=crop&q=80'
    };

    if (step === 'selfie') setSelfie(dummyCaptures.selfie);
    if (step === 'vehicle') setVehicleFront(dummyCaptures.vehicle);
    if (step === 'odometer') setOdometerPhoto(dummyCaptures.odometer);
    if (step === 'rear') setRearSeat(dummyCaptures.rear);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);

    setTimeout(() => {
      setIsVerifying(false);
      onCompleteVerification({
        id: `PRE-${Date.now()}`,
        tripId: trip.id,
        timestamp: new Date().toLocaleTimeString(),
        driverSelfieUrl: selfie,
        vehicleFrontPhotoUrl: vehicleFront,
        odometerPhotoUrl: odometerPhoto,
        odometerReading: odometerReading,
        rearSeatPhotoUrl: rearSeat,
        verifiedBySystem: true,
        status: 'Passed'
      });
    }, 1200);
  };

  const isAllCaptured = Boolean(selfie && vehicleFront && odometerPhoto && rearSeat && odometerReading > 0);

  return (
    <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6">

      {/* Top Banner */}
      <div className="bg-white text-gray-900 p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#E21E26] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#E21E26]">Mandatory Safety Check</span>
            <h1 className="text-base sm:text-lg font-black">Pre-Trip Live Vehicle Verification</h1>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Trip <span className="font-mono text-[#E21E26] font-bold">{trip.bookingId}</span> • Pickup from {trip.pickup.address}
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-xs flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <span>
          All 4 photos are required by NESAM Safety Policy before starting pickup navigation. Photos are validated by AI live vision.
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">

        {/* 4 Photo Cards Grid */}
        <div className="grid sm:grid-cols-2 gap-4">

          {/* 1. Live Driver Selfie */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800">1. Live Driver Selfie</span>
                {selfie && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">✓ Captured</span>}
              </div>
              <p className="text-[11px] text-gray-500 mb-3">Ensure your face is clearly visible without sunglasses.</p>
              
              <div className="h-40 bg-gray-100 rounded-lg overflow-hidden relative border">
                <img src={selfie} alt="Driver Selfie" className="w-full h-full object-cover" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleCapture('selfie')}
              className="mt-3 w-full py-2 bg-[#111] hover:bg-[#262626] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5 text-[#E21E26]" /> Recapture Driver Selfie
            </button>
          </div>

          {/* 2. Vehicle Front Photo with Plate */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800">2. Vehicle Front & Number Plate</span>
                {vehicleFront && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">✓ Captured</span>}
              </div>
              <p className="text-[11px] text-gray-500 mb-3">Front view with registration number plate clearly legible.</p>

              <div className="h-40 bg-gray-100 rounded-lg overflow-hidden relative border">
                <img src={vehicleFront} alt="Vehicle Front" className="w-full h-full object-cover" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleCapture('vehicle')}
              className="mt-3 w-full py-2 bg-[#111] hover:bg-[#262626] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5 text-[#E21E26]" /> Recapture Vehicle Front
            </button>
          </div>

          {/* 3. Dashboard / Odometer Photo */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800">3. Dashboard / Odometer</span>
                {odometerPhoto && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">✓ Captured</span>}
              </div>
              <p className="text-[11px] text-gray-500 mb-2">Cluster showing start mileage.</p>

              <div className="h-32 bg-gray-100 rounded-lg overflow-hidden relative border mb-3">
                <img src={odometerPhoto} alt="Odometer" className="w-full h-full object-cover" />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">Starting Odometer Reading (KM)</label>
                <div className="relative">
                  <Gauge className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="number"
                    value={odometerReading}
                    onChange={e => setOdometerReading(Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs font-mono font-bold"
                    placeholder="e.g. 84290"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleCapture('odometer')}
              className="mt-3 w-full py-2 bg-[#111] hover:bg-[#262626] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5 text-[#E21E26]" /> Recapture Odometer Photo
            </button>
          </div>

          {/* 4. Rear Passenger Seat Photo */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800">4. Rear Passenger Seat Photo</span>
                {rearSeat && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">✓ Captured</span>}
              </div>
              <p className="text-[11px] text-gray-500 mb-3">Cleanliness and seat covers check.</p>

              <div className="h-40 bg-gray-100 rounded-lg overflow-hidden relative border">
                <img src={rearSeat} alt="Rear Seat" className="w-full h-full object-cover" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleCapture('rear')}
              className="mt-3 w-full py-2 bg-[#111] hover:bg-[#262626] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5 text-[#E21E26]" /> Recapture Seat Photo
            </button>
          </div>

        </div>

        {/* Submit Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 text-xs font-bold rounded-xl w-full sm:w-auto"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={!isAllCaptured || isVerifying}
            className={`w-full sm:w-auto px-6 sm:px-8 py-3 rounded-xl text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 transition-colors ${
              isAllCaptured && !isVerifying
                ? 'bg-[#E21E26] hover:bg-[#C9141B] cursor-pointer'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isVerifying ? (
              <span>AI Verifying Photos...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Submit Live Verification & Start Pickup Navigation
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
};
