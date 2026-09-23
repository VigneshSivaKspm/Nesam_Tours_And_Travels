import React, { useState } from 'react';
import { FleetVehicle, FleetDriver } from '../types';
import { Car, Plus, Upload, CheckCircle, AlertTriangle, ShieldCheck, UserPlus } from 'lucide-react';

interface FleetScreenProps {
  vehicles: FleetVehicle[];
  drivers: FleetDriver[];
  onAddVehicle: (vehicle: FleetVehicle) => void;
  onUpdateVehicleStatus: (vehicleId: string, status: FleetVehicle['status']) => void;
  onAssignDriver: (vehicleId: string, driverId: string) => void;
}

export const FleetScreen: React.FC<FleetScreenProps> = ({
  vehicles,
  drivers,
  onAddVehicle,
  onUpdateVehicleStatus,
  onAssignDriver
}) => {
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  
  // Add Vehicle form state
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [category, setCategory] = useState<FleetVehicle['category']>('Sedan');
  const [make, setMake] = useState<string>('Maruti Suzuki');
  const [model, setModel] = useState<string>('Dzire Tour S');
  const [year, setYear] = useState<string>('2024');
  const [seatingCapacity, setSeatingCapacity] = useState<number>(4);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [rcDoc, setRcDoc] = useState<string>('https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&auto=format&fit=crop&q=80');
  const [insuranceDoc, setInsuranceDoc] = useState<string>('https://images.unsplash.com/photo-1450133064473-71024230f91b?w=400&auto=format&fit=crop&q=80');

  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedDriver = drivers.find(d => d.id === selectedDriverId);
    
    const newVehicle: FleetVehicle = {
      id: `VEH-${Math.floor(100 + Math.random() * 900)}`,
      vehicleNumber: vehicleNumber.toUpperCase(),
      category: category,
      make: make,
      model: model,
      year: year,
      seatingCapacity: seatingCapacity,
      status: 'Active',
      assignedDriverId: selectedDriverId || undefined,
      assignedDriverName: assignedDriver?.name || undefined,
      rcDocUrl: rcDoc,
      insuranceDocUrl: insuranceDoc,
      docStatus: 'Approved'
    };

    onAddVehicle(newVehicle);
    setShowAddModal(false);
    setVehicleNumber('');
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Banner */}
      <div className="bg-[#111111] text-white p-6 rounded-2xl border border-[#262626] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#E21E26]">FLEET OPERATIONS</span>
          <h1 className="text-xl font-extrabold mt-0.5">Vehicle Fleet Management</h1>
          <p className="text-xs text-gray-400">Register, manage compliance documents, and assign drivers to vehicles</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Vehicle to Fleet
        </button>
      </div>

      {/* Fleet Vehicles Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map(v => (
          <div key={v.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4 hover:border-[#E21E26] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <span className="font-mono text-base font-black text-gray-900">{v.vehicleNumber}</span>
                  <p className="text-xs text-gray-500 font-medium">{v.make} {v.model} ({v.year})</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  v.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                  v.status === 'On Trip' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {v.status}
                </span>
              </div>

              <div className="space-y-2 py-3 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Category / Seats:</span>
                  <span className="font-bold text-gray-900">{v.category} ({v.seatingCapacity} Seater)</span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>Assigned Driver:</span>
                  <span className="font-bold text-[#E21E26]">{v.assignedDriverName || 'Unassigned'}</span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>Document Status:</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Approved
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              {/* Driver Pairing Selector */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">Pair / Change Driver</label>
                <select
                  value={v.assignedDriverId || ''}
                  onChange={e => onAssignDriver(v.id, e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-semibold"
                >
                  <option value="">-- Select Driver --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                  ))}
                </select>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-bold text-gray-500">Fleet Status:</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => onUpdateVehicleStatus(v.id, 'Active')}
                    className={`px-2 py-1 text-[10px] font-bold rounded ${v.status === 'Active' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => onUpdateVehicleStatus(v.id, 'Maintenance')}
                    className={`px-2 py-1 text-[10px] font-bold rounded ${v.status === 'Maintenance' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Service
                  </button>
                </div>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">Add New Vehicle to Fleet</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700 text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateVehicle} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Vehicle Registration Number</label>
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={e => setVehicleNumber(e.target.value)}
                    placeholder="e.g. TN 09 BZ 9912"
                    className="w-full px-3 py-2 border rounded text-xs font-mono font-bold uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Vehicle Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded text-xs font-bold"
                  >
                    <option value="Sedan">Sedan (Dzire / Etios)</option>
                    <option value="SUV">SUV (Innova / Ertiga)</option>
                    <option value="Mini">Mini (Hatchback)</option>
                    <option value="Luxury">Luxury (Camry / Benz)</option>
                    <option value="Tempo Traveller">Tempo Traveller (12+ Seater)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Make / Brand</label>
                  <input
                    type="text"
                    value={make}
                    onChange={e => setMake(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-xs font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Model Name</label>
                  <input
                    type="text"
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-xs font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Manufacturing Year</label>
                  <input
                    type="text"
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-xs font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Seating Capacity</label>
                  <input
                    type="number"
                    value={seatingCapacity}
                    onChange={e => setSeatingCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              {/* Assign Initial Driver */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Assign Registered Driver</label>
                <select
                  value={selectedDriverId}
                  onChange={e => setSelectedDriverId(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-xs font-semibold"
                >
                  <option value="">-- Assign Driver (Optional) --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                  ))}
                </select>
              </div>

              {/* Document Uploads Preview */}
              <div className="border border-dashed border-gray-300 p-4 rounded-xl bg-gray-50 text-center space-y-2">
                <Upload className="w-6 h-6 text-gray-400 mx-auto" />
                <p className="text-xs text-gray-600 font-semibold">Attach RC Book, Insurance & State Permit Documents</p>
                <p className="text-[10px] text-gray-400">PDF, JPG, PNG up to 10MB</p>
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
                  Add Vehicle to Fleet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
