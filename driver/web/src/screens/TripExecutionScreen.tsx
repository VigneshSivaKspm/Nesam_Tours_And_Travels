import React, { useState } from 'react';
import { TripDetails, TripStatus, TollReceipt } from '../types';
import {
  MapPin,
  Navigation,
  PhoneCall,
  KeyRound,
  CheckCircle,
  AlertTriangle,
  Upload,
  Gauge,
  Receipt,
  Flag,
  ShieldCheck,
  CheckCircle2,
  Share2
} from 'lucide-react';

interface TripExecutionScreenProps {
  trip: TripDetails;
  onUpdateTripStatus: (status: TripStatus, updatedTrip?: Partial<TripDetails>) => void;
}

export const TripExecutionScreen: React.FC<TripExecutionScreenProps> = ({
  trip,
  onUpdateTripStatus
}) => {
  const [driverDistanceKm, setDriverDistanceKm] = useState<number>(trip.pickupDistanceKm || 1.2);
  const [inputOTP, setInputOTP] = useState<string>('');
  const [otpError, setOtpError] = useState<boolean>(false);

  // Ending Odometer & Tolls state
  const [endOdometer, setEndOdometer] = useState<number>((trip.startOdometer || 84290) + Math.round(trip.distanceKm));
  const [tollName, setTollName] = useState<string>('Chennasamudram Toll Plaza');
  const [tollAmount, setTollAmount] = useState<number>(trip.tollCharges || 50);
  const [tollsList, setTollsList] = useState<TollReceipt[]>(trip.tolls || []);
  const [showTollModal, setShowTollModal] = useState<boolean>(false);

  const isWithinRadius = driverDistanceKm <= 2.0;

  // Handle Boarding OTP Verification
  const handleVerifyBoardingOTP = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputOTP === trip.customerOTP) {
      setOtpError(false);
      onUpdateTripStatus('In Progress', { startOdometer: trip.startOdometer || 84290 });
    } else {
      setOtpError(true);
    }
  };

  // Add Toll Receipt
  const handleAddToll = (e: React.FormEvent) => {
    e.preventDefault();
    const newToll: TollReceipt = {
      id: `TOLL-${Date.now()}`,
      name: tollName,
      amount: tollAmount,
      receiptPhotoUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&auto=format&fit=crop&q=80',
      uploadedAt: new Date().toLocaleTimeString()
    };
    setTollsList([...tollsList, newToll]);
    setShowTollModal(false);
  };

  // Complete Trip
  const handleCompleteTrip = () => {
    const totalTolls = tollsList.reduce((sum, t) => sum + t.amount, 0);
    onUpdateTripStatus('Completed', {
      endOdometer: endOdometer,
      tollCharges: totalTolls,
      tolls: tollsList
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">

      {/* Top Header Control */}
      <div className="bg-white text-gray-900 p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#E21E26] text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded">
              LIVE TRIP
            </span>
            <span className="text-xs text-gray-400 font-mono">{trip.bookingId}</span>
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold mt-1 text-gray-900">{trip.customerName}</h1>
          <p className="text-xs text-gray-500">Pickup: {trip.pickup.address}</p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`tel:${trip.customerPhone}`}
            className="flex-1 md:flex-none justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <PhoneCall className="w-4 h-4" /> Call Customer
          </a>

          <div className="text-right bg-gray-50 px-4 py-2 rounded-xl border border-gray-200 shrink-0">
            <span className="text-[10px] text-gray-500 font-medium">Driver Fare</span>
            <p className="text-lg font-black text-[#E21E26]">₹{trip.driverEarnings}</p>
          </div>
        </div>
      </div>

      {/* TRIP STEP TIMELINE */}
      <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] shadow-sm">
        <div className="grid grid-cols-4 gap-2 text-center">
          
          <div className={`p-2 rounded-xl border ${
            trip.status === 'Assigned' || trip.status === 'Pre-Trip Pending' || trip.status === 'En Route Pickup'
              ? 'bg-red-50 border-red-300 text-[#E21E26] font-bold'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold'
          }`}>
            <span className="text-[10px] block">STEP 1</span>
            <span className="text-xs">En Route Pickup</span>
          </div>

          <div className={`p-2 rounded-xl border ${
            trip.status === 'Reached Pickup'
              ? 'bg-red-50 border-red-300 text-[#E21E26] font-bold'
              : trip.status === 'In Progress' || trip.status === 'Arrived Destination' || trip.status === 'Completed'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold'
              : 'bg-gray-50 border-gray-200 text-gray-400'
          }`}>
            <span className="text-[10px] block">STEP 2</span>
            <span className="text-xs">Reached Pickup</span>
          </div>

          <div className={`p-2 rounded-xl border ${
            trip.status === 'In Progress'
              ? 'bg-red-50 border-red-300 text-[#E21E26] font-bold'
              : trip.status === 'Arrived Destination' || trip.status === 'Completed'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold'
              : 'bg-gray-50 border-gray-200 text-gray-400'
          }`}>
            <span className="text-[10px] block">STEP 3</span>
            <span className="text-xs">Trip In Progress</span>
          </div>

          <div className={`p-2 rounded-xl border ${
            trip.status === 'Completed'
              ? 'bg-emerald-600 text-white font-bold'
              : 'bg-gray-50 border-gray-200 text-gray-400'
          }`}>
            <span className="text-[10px] block">STEP 4</span>
            <span className="text-xs">End & Tolls</span>
          </div>

        </div>
      </div>

      {/* 2 KM PICKUP RADIUS VERIFICATION WIDGET */}
      {(trip.status === 'Assigned' || trip.status === 'Pre-Trip Pending' || trip.status === 'En Route Pickup') && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-[#E21E26]" /> GPS Location & 2 KM Pickup Radius Restriction
            </h2>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              isWithinRadius ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {isWithinRadius ? '✓ Within 2 KM Radius' : '⚠️ Distance > 2 KM'}
            </span>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-600 font-medium">
                Current Distance to Pickup Location: <span className="font-extrabold text-gray-900 font-mono text-base">{driverDistanceKm} KM</span>
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                NESAM system prevents marking "Reached Pickup" if you are more than 2.0 KM away from customer location.
              </p>
            </div>

            <button
              onClick={() => setDriverDistanceKm(0.3)} // Simulate arriving close
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg shrink-0"
            >
              Simulate GPS Location Update (0.3 KM)
            </button>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => onUpdateTripStatus('Reached Pickup')}
              disabled={!isWithinRadius}
              className={`w-full md:w-auto px-6 py-3 rounded-xl font-extrabold text-xs text-white shadow-md flex items-center justify-center gap-2 transition-all ${
                isWithinRadius
                  ? 'bg-[#E21E26] hover:bg-[#C9141B] cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <MapPin className="w-4 h-4" /> Reached Pickup Location
            </button>
          </div>
        </div>
      )}

      {/* CUSTOMER BOARDING OTP VERIFICATION MODAL / WIDGET */}
      {trip.status === 'Reached Pickup' && (
        <div className="bg-white p-6 rounded-2xl border-2 border-[#E21E26] shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Customer Boarding OTP Verification</h2>
              <p className="text-xs text-gray-500">Ask passenger {trip.customerName} for the 6-digit Boarding OTP</p>
            </div>
          </div>

          <form onSubmit={handleVerifyBoardingOTP} className="space-y-4 bg-gray-50 p-4 rounded-xl border">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Enter 6-Digit OTP</label>
              <input
                type="text"
                maxLength={6}
                value={inputOTP}
                onChange={e => setInputOTP(e.target.value)}
                placeholder="e.g. 482910"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl font-mono text-xl font-extrabold tracking-widest text-center focus:outline-none focus:border-[#E21E26]"
                required
              />
              
            </div>

            {otpError && (
              <div className="p-2 bg-red-100 text-red-700 text-xs font-bold rounded text-center">
                Invalid Boarding OTP! Please check with customer.
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-[#E21E26] hover:bg-[#C9141B] text-white font-extrabold text-xs rounded-xl shadow transition-all"
            >
              Verify OTP & Start Trip
            </button>
          </form>
        </div>
      )}

      {/* LIVE TRIP IN PROGRESS SCREEN */}
      {trip.status === 'In Progress' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                ● Live Trip Metering
              </span>
              <h2 className="text-lg font-extrabold text-gray-900 mt-1">Driving to Destination</h2>
              <p className="text-xs text-gray-500">{trip.drop.address}</p>
            </div>

            <div className="text-right">
              <span className="text-xs text-gray-500">Trip Distance</span>
              <p className="text-2xl font-black text-gray-900">{trip.distanceKm} KM</p>
            </div>
          </div>

          {/* Map Simulation */}
          <div className="h-56 sm:h-64 bg-gray-100 rounded-xl relative overflow-hidden flex items-center justify-center text-gray-700 p-6 border border-gray-200">
            <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />
            <div className="relative z-10 text-center space-y-2">
              <Navigation className="w-12 h-12 text-[#E21E26] mx-auto animate-bounce" />
              <p className="text-sm font-bold text-gray-900">GPS Live Navigation Active</p>
              <p className="text-xs text-gray-500">Guindy / ECR Highway Route • Est 32 Min</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => onUpdateTripStatus('Arrived Destination')}
              className="px-6 py-3 bg-[#111] hover:bg-[#262626] text-white text-xs font-extrabold rounded-xl shadow flex items-center gap-2 transition-all"
            >
              Arrived at Destination <Flag className="w-4 h-4 text-[#E21E26]" />
            </button>
          </div>
        </div>
      )}

      {/* END TRIP, ODOMETER & TOLL UPLOAD */}
      {(trip.status === 'Arrived Destination' || (trip.status as string) === 'Ending Trip') && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-lg space-y-6">
          <div className="border-b pb-3">
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <Flag className="w-5 h-5 text-[#E21E26]" /> End Trip & Toll Settlement
            </h2>
            <p className="text-xs text-gray-500">Enter final odometer reading and upload toll receipts</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* End Odometer */}
            <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
              <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-[#E21E26]" /> Ending Odometer Reading (KM)
              </label>
              <input
                type="number"
                value={endOdometer}
                onChange={e => setEndOdometer(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono font-bold text-lg text-gray-900"
                required
              />
              <p className="text-[10px] text-gray-500">
                Start Reading was: <span className="font-mono font-bold">{trip.startOdometer || 84290} KM</span>
              </p>
            </div>

            {/* Toll Receipts */}
            <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-emerald-600" /> Toll Charges Upload
                </label>
                <button
                  onClick={() => setShowTollModal(true)}
                  className="px-2.5 py-1 bg-[#111] text-white text-[11px] font-bold rounded flex items-center gap-1"
                >
                  + Add Toll Receipt
                </button>
              </div>

              {tollsList.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2">No toll receipts uploaded for this trip yet.</p>
              ) : (
                <div className="space-y-2 pt-1">
                  {tollsList.map(t => (
                    <div key={t.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border">
                      <span className="font-semibold text-gray-800">{t.name}</span>
                      <span className="font-mono font-bold text-[#E21E26]">₹{t.amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Modal to Add Toll */}
          {showTollModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
                <h3 className="text-sm font-bold text-gray-900">Upload Toll Receipt</h3>
                
                <form onSubmit={handleAddToll} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Toll Plaza Name</label>
                    <input
                      type="text"
                      value={tollName}
                      onChange={e => setTollName(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Toll Amount (₹)</label>
                    <input
                      type="number"
                      value={tollAmount}
                      onChange={e => setTollAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded text-xs font-mono font-bold"
                      required
                    />
                  </div>

                  <div className="border border-dashed border-gray-300 p-4 text-center rounded-xl bg-gray-50">
                    <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-500 font-medium">Click to capture / attach photo receipt</p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowTollModal(false)}
                      className="px-3 py-1.5 border text-xs font-bold rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#E21E26] text-white text-xs font-bold rounded-lg"
                    >
                      Save Receipt
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleCompleteTrip}
              className="px-8 py-3 bg-[#E21E26] hover:bg-[#C9141B] text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" /> Complete Trip & Process Driver Payout
            </button>
          </div>
        </div>
      )}

      {/* COMPLETED TRIP SUMMARY CARD */}
      {trip.status === 'Completed' && (
        <div className="bg-white p-6 rounded-2xl border-2 border-emerald-500 shadow-xl space-y-6 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-xl font-black text-gray-900">Trip Completed Successfully!</h2>
            <p className="text-xs text-gray-500 mt-1">Earnings have been credited to your NESAM Driver Wallet.</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border max-w-md mx-auto space-y-2 text-left text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Gross Fare</span>
              <span className="font-mono font-bold">₹{trip.fareAmount}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Toll Reimbursement</span>
              <span className="font-mono font-bold">+ ₹{trip.tollCharges}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>NESAM Platform Fee (10%)</span>
              <span className="font-mono font-bold">- ₹{trip.platformCommission}</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-base font-black text-[#E21E26]">
              <span>Total Credited Earnings</span>
              <span>₹{trip.driverEarnings + trip.tollCharges}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
