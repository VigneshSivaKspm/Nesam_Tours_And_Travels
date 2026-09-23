import React, { useState } from 'react';
import { TripRecord, DriverInfo } from '../types';
import { MapView } from '../components/MapView';
import { StatusBadge } from '../components/StatusBadge';
import { SafetyCenterModal } from '../components/SafetyCenterModal';

const defaultDriver: DriverInfo = {
  id: 'drv-1',
  name: 'Kumar M.',
  phone: '+91 94432 10987',
  rating: 4.9,
  tripsCount: 1420,
  vehicleName: 'Toyota Innova Crysta',
  vehicleNumber: 'TN 38 BK 4821',
  photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  verified: true,
  currentLat: 11.4580,
  currentLng: 77.4410,
};

interface TrackingScreenProps {
  trip: TripRecord;
  onBack: () => void;
  onTripCompleted: () => void;
}

export const TrackingScreen: React.FC<TrackingScreenProps> = ({
  trip,
  onBack,
  onTripCompleted,
}) => {
  const driver = trip.driver || defaultDriver;
  const [tripState, setTripState] = useState<
    'finding' | 'assigned' | 'tracking' | 'arrived' | 'started' | 'completed' | 'rated'
  >('tracking');

  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  return (
    <div className="flex-1 bg-[#F7F7F7] overflow-y-auto py-8 px-4 sm:px-6">
      {/* ── SAFETY MODAL ── */}
      <SafetyCenterModal
        isOpen={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        driver={driver}
        bookingId={trip.bookingId}
      />

      <div className="max-web-width mx-auto space-y-6">
        {/* Header Bar */}
        <div className="bg-white border border-gray-200 text-gray-900 p-4 rounded-3xl shadow-sm flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-xl border border-gray-200 transition-colors"
          >
            ← Back to Home
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E31E24] animate-pulse shrink-0" />
            <span className="text-xs sm:text-sm font-black uppercase text-gray-900 tracking-wider truncate">
              Live Ride Tracking — #{trip.bookingId}
            </span>
          </div>
          <button
            onClick={() => setShowSafetyModal(true)}
            className="bg-[#E31E24] text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm hover:bg-[#C41820]"
          >
            SAFETY SOS
          </button>
        </div>

        {/* 2-Column Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Driver Card, Trip Status & Controls (5 Columns on Desktop) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Finding Driver */}
            {tripState === 'finding' && (
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm text-center space-y-4">
                <div className="w-12 h-12 rounded-full border-4 border-[#E31E24] border-t-transparent animate-spin mx-auto" />
                <h3 className="text-base font-black text-[#111111]">FINDING YOUR CAPTAIN</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Assigning the nearest top-rated captain in Gobichettipalayam...
                </p>
                <button
                  onClick={() => setTripState('assigned')}
                  className="text-xs font-bold text-[#E31E24] underline"
                >
                  Demo: Skip to Captain Assigned →
                </button>
              </div>
            )}

            {/* Captain Assigned & Live Ride Details */}
            {(tripState === 'assigned' || tripState === 'tracking') && (
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-md space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <StatusBadge status="Driver Assigned" />
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">ETA to Pickup</span>
                    <div className="text-base font-black text-[#E31E24]">06 mins</div>
                  </div>
                </div>

                {/* Captain Info */}
                <div className="flex items-center gap-4">
                  <img
                    src={driver.photoUrl}
                    alt={driver.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#E31E24] shadow-md"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-[#111111]">{driver.name}</h4>
                      <span className="text-[9px] font-bold text-white bg-[#20A464] px-2 py-0.5 rounded-full">
                        ✓ Verified Captain
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 font-medium">
                      {driver.vehicleName} • <strong className="text-[#111111]">{driver.vehicleNumber}</strong>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5 font-bold">
                      Rating: {driver.rating} / 5.0 ({driver.tripsCount} trips completed)
                    </div>
                  </div>
                </div>

                {/* Driver Contact Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <a
                    href={`tel:${driver.phone}`}
                    className="py-3 bg-[#111111] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-black transition-colors"
                  >
                    Call Captain
                  </a>
                  <button
                    onClick={() => alert(`Messaging Captain ${driver.name}`)}
                    className="py-3 bg-gray-100 text-[#111111] text-xs font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-200 border border-gray-300 transition-colors"
                  >
                    Message
                  </button>
                </div>

                {/* OTP & Workflow trigger */}
                <div className="flex justify-between items-center bg-red-50 p-3 rounded-2xl border border-red-100 text-xs">
                  <span>Boarding OTP: <strong className="text-[#E31E24] font-black text-sm">{trip.otp || '8821'}</strong></span>
                  <button
                    onClick={() => setTripState('arrived')}
                    className="text-[#E31E24] font-extrabold hover:underline"
                  >
                    Demo: Captain Arrived →
                  </button>
                </div>
              </div>
            )}

            {/* Captain Arrived Alert */}
            {tripState === 'arrived' && (
              <div className="bg-white p-6 rounded-3xl border-2 border-[#20A464] shadow-md space-y-4 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#20A464] animate-ping" />
                  <h3 className="text-base font-black text-[#20A464]">YOUR CAPTAIN HAS ARRIVED!</h3>
                </div>
                <p className="text-xs text-gray-600">
                  {driver.name} is waiting at {trip.pickup.name}. Share OTP{' '}
                  <strong className="text-[#E31E24]">{trip.otp || '8821'}</strong> with captain to start ride.
                </p>

                <button
                  onClick={() => setTripState('started')}
                  className="w-full bg-[#20A464] text-white py-3.5 rounded-2xl font-bold text-xs shadow-lg hover:bg-green-700"
                >
                  Share OTP & Start Ride →
                </button>
              </div>
            )}

            {/* Active Trip */}
            {tripState === 'started' && (
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-md space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <StatusBadge status="Trip Started" />
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Estimated Arrival</span>
                    <div className="text-base font-black text-[#E31E24]">01:12 PM</div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-bold">Heading To:</span>
                    <span className="font-bold text-[#111111]">{trip.drop.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-bold">Live Speed:</span>
                    <span className="font-bold text-[#20A464]">58 km/h</span>
                  </div>
                </div>

                <button
                  onClick={() => setTripState('completed')}
                  className="w-full bg-[#111111] text-white py-3.5 rounded-2xl font-bold text-xs shadow hover:bg-black"
                >
                  Demo: Complete Ride →
                </button>
              </div>
            )}

            {/* Rating Modal */}
            {tripState === 'completed' && (
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xl space-y-4 text-center">
                <div className="w-16 h-16 rounded-full bg-[#20A464] text-white flex items-center justify-center text-2xl font-black mx-auto shadow-md">
                  ✓
                </div>
                <h3 className="text-lg font-black text-[#111111]">YOU HAVE ARRIVED!</h3>
                <p className="text-xs text-gray-500">Trip completed at {trip.drop.name}</p>

                <div className="py-3 border-y border-gray-100 space-y-3">
                  <div className="text-xs font-bold text-gray-700">How was your trip with {driver.name}?</div>
                  <div className="flex justify-center gap-3 text-2xl">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className={star <= rating ? 'text-amber-400' : 'text-gray-300'}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Tell us about your experience..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={2}
                    className="w-full bg-gray-100 border border-gray-300 rounded-2xl p-3 text-xs font-medium focus:outline-none"
                  />
                </div>

                <button
                  onClick={() => {
                    alert('Thank you for rating your trip!');
                    onTripCompleted();
                  }}
                  className="w-full bg-[#E31E24] text-white py-3.5 rounded-2xl font-bold text-xs shadow hover:bg-[#C41820]"
                >
                  Submit Rating & Finish →
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Full-Height Interactive Map (7 Columns on Desktop) */}
          <div className="lg:col-span-7">
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                Live GPS Satellite Map View
              </h3>
              <MapView
                pickupName={trip.pickup.name}
                dropName={trip.drop.name}
                driverEta="6 mins away"
                showDriver={tripState !== 'finding'}
                driverName={driver.name}
                height="450px"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
