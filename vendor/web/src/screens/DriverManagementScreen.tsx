import React, { useState } from 'react';
import { FleetDriver, FleetVehicle } from '../types';
import { Users, Plus, ShieldCheck, Phone, Mail, Car, Award, Camera, Upload } from 'lucide-react';

interface DriverManagementScreenProps {
  drivers: FleetDriver[];
  vehicles: FleetVehicle[];
  onAddDriver: (driver: FleetDriver) => void;
  onUpdateDriverStatus: (driverId: string, status: FleetDriver['status']) => void;
}

export const DriverManagementScreen: React.FC<DriverManagementScreenProps> = ({
  drivers,
  vehicles,
  onAddDriver,
  onUpdateDriverStatus
}) => {
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form state
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [licenseNumber, setLicenseNumber] = useState<string>('');
  const [licenseExpiry, setLicenseExpiry] = useState<string>('2032-12-31');
  const [assignedVehicleNumber, setAssignedVehicleNumber] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');

  const handleCreateDriver = (e: React.FormEvent) => {
    e.preventDefault();
    const newDriver: FleetDriver = {
      id: `DRV-${Math.floor(1000 + Math.random() * 9000)}`,
      name: name,
      phone: phone,
      email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@nesamexpress.com`,
      photoUrl: photoUrl,
      licenseNumber: licenseNumber.toUpperCase(),
      licenseExpiry: licenseExpiry,
      status: 'Available',
      assignedVehicleNumber: assignedVehicleNumber || undefined,
      rating: 5.0,
      totalTrips: 0,
      docStatus: 'Approved'
    };

    onAddDriver(newDriver);
    setShowAddModal(false);
    setName('');
    setPhone('');
    setLicenseNumber('');
  };

  return (
    <div className="space-y-6 pb-20">

      {/* Top Banner */}
      <div className="bg-[#111111] text-white p-6 rounded-2xl border border-[#262626] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#E21E26]">FLEET HUMAN RESOURCES</span>
          <h1 className="text-xl font-extrabold mt-0.5">Driver Management</h1>
          <p className="text-xs text-gray-400">Onboard drivers, verify licenses, track ratings & trip history</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Driver to Fleet
        </button>
      </div>

      {/* Drivers List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {drivers.map(d => (
          <div key={d.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4 hover:border-[#E21E26] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 border-b pb-3">
                <img
                  src={d.photoUrl}
                  alt={d.name}
                  className="w-12 h-12 rounded-xl object-cover border-2 border-[#E21E26] shadow-sm"
                />
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{d.name}</h3>
                  <span className="text-[10px] font-mono text-gray-500">{d.id}</span>
                  <div className="flex items-center gap-1 text-xs text-amber-500 font-bold mt-0.5">
                    ★ {d.rating} <span className="text-gray-400 font-normal text-[11px]">({d.totalTrips} Rides)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 py-3 text-xs">
                <div className="flex items-center justify-between text-gray-600">
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" /> Phone:</span>
                  <span className="font-semibold text-gray-900">{d.phone}</span>
                </div>

                <div className="flex items-center justify-between text-gray-600">
                  <span>DL Number:</span>
                  <span className="font-mono font-bold text-gray-900">{d.licenseNumber}</span>
                </div>

                <div className="flex items-center justify-between text-gray-600">
                  <span>Assigned Vehicle:</span>
                  <span className="font-mono font-bold text-[#E21E26]">{d.assignedVehicleNumber || 'Unassigned'}</span>
                </div>

                <div className="flex items-center justify-between text-gray-600">
                  <span>Verification:</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Approved
                  </span>
                </div>
              </div>
            </div>

            {/* Status Switcher */}
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500">Availability:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => onUpdateDriverStatus(d.id, 'Available')}
                  className={`px-2 py-1 text-[10px] font-bold rounded ${d.status === 'Available' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  Available
                </button>
                <button
                  onClick={() => onUpdateDriverStatus(d.id, 'Offline')}
                  className={`px-2 py-1 text-[10px] font-bold rounded ${d.status === 'Offline' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  Offline
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Add Driver Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">Add Fleet Driver Partner</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700 text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateDriver} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Full Legal Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Muthu Kumar"
                  className="w-full px-3 py-2 border rounded text-xs font-semibold"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Mobile Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98400 12345"
                    className="w-full px-3 py-2 border rounded text-xs font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="driver@nesam.com"
                    className="w-full px-3 py-2 border rounded text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Driving License Number</label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={e => setLicenseNumber(e.target.value)}
                    placeholder="TN-01-2018-0094821"
                    className="w-full px-3 py-2 border rounded text-xs font-mono font-bold uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">License Expiry Date</label>
                  <input
                    type="text"
                    value={licenseExpiry}
                    onChange={e => setLicenseExpiry(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Pair Vehicle Number</label>
                <select
                  value={assignedVehicleNumber}
                  onChange={e => setAssignedVehicleNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-xs font-semibold"
                >
                  <option value="">-- Assign Vehicle (Optional) --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.vehicleNumber}>{v.vehicleNumber} ({v.make} {v.model})</option>
                  ))}
                </select>
              </div>

              <div className="border border-dashed border-gray-300 p-4 rounded-xl bg-gray-50 text-center space-y-2">
                <Camera className="w-6 h-6 text-gray-400 mx-auto" />
                <p className="text-xs text-gray-600 font-semibold">Upload Driving License (Front & Back) & Selfie Photo</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow"
                >
                  Save & Register Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
