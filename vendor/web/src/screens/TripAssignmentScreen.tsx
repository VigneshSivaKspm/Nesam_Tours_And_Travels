import React, { useState } from 'react';
import { VendorTrip, FleetDriver, FleetVehicle } from '../types';
import { Navigation, UserCheck, Car, PhoneCall, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface TripAssignmentScreenProps {
  activeTrips: VendorTrip[];
  drivers: FleetDriver[];
  vehicles: FleetVehicle[];
  onAssignDriverAndVehicle: (tripId: string, driverId: string, vehicleNumber: string) => void;
}

export const TripAssignmentScreen: React.FC<TripAssignmentScreenProps> = ({
  activeTrips,
  drivers,
  vehicles,
  onAssignDriverAndVehicle
}) => {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string>('');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [assignSuccess, setAssignSuccess] = useState<boolean>(false);

  const handleConfirmAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripId) return;

    onAssignDriverAndVehicle(selectedTripId, driverId, vehicleNumber);
    setSelectedTripId(null);
    setAssignSuccess(true);
    setTimeout(() => setAssignSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 pb-20">

      {/* Top Banner */}
      <div className="bg-[#111111] text-white p-6 rounded-2xl border border-[#262626] shadow-xl">
        <span className="text-[10px] uppercase font-bold tracking-widest text-[#E21E26]">FLEET DISPATCH MONITOR</span>
        <h1 className="text-xl font-extrabold mt-0.5">Vendor Trip Assignment & Monitoring</h1>
        <p className="text-xs text-gray-400">Assign drivers & vehicles to won bookings, track real-time trip status</p>
      </div>

      {assignSuccess && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Driver & vehicle assigned successfully! Push dispatch alert sent to driver mobile app.</span>
        </div>
      )}

      {/* Active Trips List */}
      <div className="space-y-4">
        {activeTrips.map(trip => (
          <div key={trip.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-gray-900">{trip.bookingId}</span>
                  <span className="bg-red-100 text-[#E21E26] font-extrabold px-2 py-0.5 rounded text-[10px]">
                    {trip.status}
                  </span>
                </div>
                <h2 className="text-base font-black text-gray-900 mt-1">{trip.customerName}</h2>
                <p className="text-xs text-gray-500 font-mono">Scheduled: {trip.scheduledTime}</p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-gray-500 font-medium">Vendor Payout</span>
                <p className="text-2xl font-black text-[#E21E26]">₹{trip.vendorPayout}</p>
                <span className="text-[10px] text-gray-400">Gross Fare: ₹{trip.grossFare}</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700">Pickup Location</span>
                <p className="font-bold text-gray-900">{trip.pickupAddress}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-red-700">Drop Location</span>
                <p className="font-bold text-gray-900">{trip.dropAddress}</p>
              </div>
            </div>

            {/* Assigned Driver & Vehicle Details */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] text-white p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E21E26] flex items-center justify-center font-bold text-white text-sm">
                  {trip.driverName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{trip.driverName}</span>
                    <span className="text-[10px] font-mono text-gray-400">({trip.driverPhone})</span>
                  </div>
                  <p className="text-xs font-mono text-amber-400 font-bold mt-0.5">
                    Vehicle: {trip.vehicleNumber}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedTripId(trip.id);
                  setDriverId(trip.driverId);
                  setVehicleNumber(trip.vehicleNumber);
                }}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#262626] border border-[#333] text-gray-200 text-xs font-bold rounded-lg transition-all"
              >
                Change Driver / Vehicle
              </button>
            </div>

          </div>
        ))}
      </div>

      {/* ASSIGNMENT MODAL */}
      {selectedTripId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">Assign Driver & Vehicle</h3>
              <button onClick={() => setSelectedTripId(null)} className="text-gray-400 hover:text-gray-700 text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleConfirmAssignment} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Select Available Fleet Driver</label>
                <select
                  value={driverId}
                  onChange={e => setDriverId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold"
                  required
                >
                  <option value="">-- Choose Driver --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.phone}) - {d.status}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Select Active Fleet Vehicle</label>
                <select
                  value={vehicleNumber}
                  onChange={e => setVehicleNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold"
                  required
                >
                  <option value="">-- Choose Vehicle --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.vehicleNumber}>{v.vehicleNumber} ({v.make} {v.model})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedTripId(null)}
                  className="px-4 py-2 border text-xs font-bold text-gray-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow"
                >
                  Dispatch to Driver Mobile App
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
