import React, { useState } from 'react';
import { VendorTrip, FleetDriver, FleetVehicle } from '../types';
import { CheckCircle2 } from 'lucide-react';
import { dispatchableDriver, dispatchableVehicle } from '../services/vendorMappers';

interface TripAssignmentScreenProps {
  activeTrips: VendorTrip[];
  drivers: FleetDriver[];
  vehicles: FleetVehicle[];
  onAssignDriverAndVehicle: (tripId: string, driverId: string, vehicleId: string) => Promise<void>;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
// A trip can be (re)dispatched until it starts (firestore.rules vendorDispatchOk).
const canDispatch = (t: VendorTrip) => t.status === 'Confirmed' || t.status === 'Assigned';

export const TripAssignmentScreen: React.FC<TripAssignmentScreenProps> = ({
  activeTrips,
  drivers,
  vehicles,
  onAssignDriverAndVehicle
}) => {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string>('');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const readyDrivers = drivers.filter(dispatchableDriver);
  const readyVehicles = vehicles.filter(dispatchableVehicle);

  const openAssign = (trip: VendorTrip) => {
    setSelectedTripId(trip.id);
    setDriverId(readyDrivers.some(d => d.id === trip.driverId) ? trip.driverId : '');
    setVehicleId(readyVehicles.some(v => v.id === trip.vehicleId) ? trip.vehicleId : '');
    setFormError('');
  };

  const pickDriver = (id: string) => {
    setDriverId(id);
    // Default to the driver's paired vehicle when it can be dispatched.
    const paired = readyVehicles.find(v => v.assignedDriverId === id);
    if (paired && !vehicleId) setVehicleId(paired.id);
  };

  const handleConfirmAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripId || saving) return;
    setSaving(true);
    setFormError('');
    try {
      await onAssignDriverAndVehicle(selectedTripId, driverId, vehicleId);
      const d = drivers.find(x => x.id === driverId);
      const v = vehicles.find(x => x.id === vehicleId);
      setNotice(`${d?.name || 'The driver'} is assigned with ${v?.vehicleNumber || 'the vehicle'}. The trip now appears in their NESAM Driver app.`);
      setSelectedTripId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'The trip was not dispatched. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">

      {/* Top Banner */}
      <div className="bg-[#111111] text-white p-6 rounded-2xl border border-[#262626] shadow-xl">
        <span className="text-[10px] uppercase font-bold tracking-widest text-[#E21E26]">FLEET DISPATCH</span>
        <h1 className="text-xl font-extrabold mt-0.5">Vendor Trip Assignment</h1>
        <p className="text-xs text-gray-400">Assign an approved driver and vehicle to trips you have won</p>
      </div>

      {notice && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {activeTrips.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-xs text-gray-500">
          No active trips. Trips you accept or win in the marketplace appear here.
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
                    {trip.tripSubStatus && trip.tripSubStatus !== 'Not Started' ? `${trip.status} · ${trip.tripSubStatus}` : trip.tripStage && trip.tripStage !== trip.status ? `${trip.status} · ${trip.tripStage}` : trip.status}
                  </span>
                </div>
                <h2 className="text-base font-black text-gray-900 mt-1">{trip.customerName || 'Customer'}</h2>
                <p className="text-xs text-gray-500 font-mono">Scheduled: {trip.scheduledTime || '—'}</p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-gray-500 font-medium">Your Payout</span>
                <p className="text-2xl font-black text-[#E21E26]">{trip.vendorPayout !== null ? rupees(trip.vendorPayout) : 'Not recorded'}</p>
                {trip.grossFare !== null && <span className="text-xs text-gray-600">Customer fare (incl. GST): {rupees(trip.grossFare)}</span>}
                {trip.paymentStatus && <span className="block text-xs text-gray-700">Payment: <strong>{trip.paymentStatus}</strong>{trip.balanceDue ? ` · balance ${rupees(trip.balanceDue)}` : ''}</span>}
                {trip.fareLines.some((l) => l.treatment === 'extra') && (
                  <span className="block text-xs text-amber-900">Customer pays separately: {trip.fareLines.filter((l) => l.treatment === 'extra').map((l) => l.label + (l.amount ? ` ${rupees(l.amount)}` : '')).join(', ')}</span>
                )}
                {trip.driverId && <span className={`block text-xs font-semibold ${trip.verificationSubmitted ? 'text-emerald-700' : 'text-gray-600'}`}>{trip.verificationSubmitted ? '✓ Vehicle photos submitted' : 'Vehicle photos not yet submitted'}</span>}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700">Pickup Location</span>
                <p className="font-bold text-gray-900">{trip.pickupAddress || '—'}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-red-700">Drop Location</span>
                <p className="font-bold text-gray-900">{trip.dropAddress || '—'}</p>
              </div>
            </div>

            {/* Assigned Driver & Vehicle Details */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] text-white p-4 rounded-xl">
              {trip.driverId ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E21E26] flex items-center justify-center font-bold text-white text-sm">
                    {(trip.driverName || '?').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{trip.driverName || 'Driver'}</span>
                      {trip.driverPhone && <span className="text-[10px] font-mono text-gray-400">({trip.driverPhone})</span>}
                    </div>
                    <p className="text-xs font-mono text-amber-400 font-bold mt-0.5">
                      Vehicle: {trip.vehicleNumber || '—'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-semibold text-amber-400">No driver assigned yet</p>
              )}

              {canDispatch(trip) && (
                <button
                  onClick={() => openAssign(trip)}
                  className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#262626] border border-[#333] text-gray-200 text-xs font-bold rounded-lg transition-all"
                >
                  {trip.driverId ? 'Change Driver / Vehicle' : 'Assign Driver & Vehicle'}
                </button>
              )}
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

            {formError && <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">{formError}</div>}

            <form onSubmit={handleConfirmAssignment} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Fleet Driver (approved, not suspended)</label>
                <select
                  value={driverId}
                  onChange={e => pickDriver(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold"
                  required
                >
                  <option value="">{readyDrivers.length ? '-- Choose Driver --' : 'No approved drivers in your fleet'}</option>
                  {readyDrivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name || 'Unnamed driver'}{d.phone ? ` (${d.phone})` : ''} — {d.online ? 'Online' : 'Offline'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Fleet Vehicle (documents approved, in service)</label>
                <select
                  value={vehicleId}
                  onChange={e => setVehicleId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold"
                  required
                >
                  <option value="">{readyVehicles.length ? '-- Choose Vehicle --' : 'No approved vehicles in service'}</option>
                  {readyVehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.vehicleNumber}{v.make || v.model ? ` (${[v.make, v.model].filter(Boolean).join(' ')})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setSelectedTripId(null)} disabled={saving} className="px-4 py-2 border text-xs font-bold text-gray-700 rounded-xl">
                  Cancel
                </button>
                <button type="submit" disabled={saving || !driverId || !vehicleId} className="px-6 py-2 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow disabled:opacity-50">
                  {saving ? 'Assigning…' : 'Assign Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
