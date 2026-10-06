import React, { useState } from 'react';
import { FleetVehicle, FleetDriver } from '../types';
import { Plus, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
import type { NewVehicle, VehicleCategoryOption } from '../services/vendorFirestoreService';

interface FleetScreenProps {
  vehicles: FleetVehicle[];
  drivers: FleetDriver[];
  categories: VehicleCategoryOption[];
  onAddVehicle: (vehicle: NewVehicle) => Promise<void>;
  onUpdateVehicleStatus: (vehicleId: string, status: FleetVehicle['status']) => Promise<void>;
  onPairDriver: (vehicleId: string, driverId: string) => Promise<void>;
}

// Letters and digits as printed on the RC (state series, "DL 1C…" and BH-series plates all fit).
const REG_NUMBER = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9 ]{6,13}$/;
const currentYear = new Date().getFullYear();

const docBadge: Record<FleetVehicle['docStatus'], { label: string; cls: string }> = {
  Approved: { label: 'Approved', cls: 'text-emerald-600' },
  Pending: { label: 'Awaiting NESAM review', cls: 'text-amber-600' },
  'Needs Correction': { label: 'Needs correction', cls: 'text-amber-700' },
  Rejected: { label: 'Rejected', cls: 'text-red-600' },
};

const emptyForm = { vehicleNumber: '', categoryId: '', make: '', model: '', year: '', seatingCapacity: '' };

export const FleetScreen: React.FC<FleetScreenProps> = ({
  vehicles,
  drivers,
  categories,
  onAddVehicle,
  onUpdateVehicleStatus,
  onPairDriver
}) => {
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');

  const set = (k: keyof typeof emptyForm, v: string) => { setForm(f => ({ ...f, [k]: v })); setFormError(''); };
  const assignable = drivers.filter(d => d.accountStatus === 'Approved' && !d.suspended);

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const number = form.vehicleNumber.trim().toUpperCase().replace(/\s+/g, ' ');
    const category = categories.find(c => c.id === form.categoryId);
    const year = Number(form.year);
    const seats = Number(form.seatingCapacity);
    if (!REG_NUMBER.test(number)) return setFormError('Enter the registration number as on the RC, e.g. TN 09 BZ 9912.');
    if (vehicles.some(v => v.vehicleNumber.replace(/\s/g, '') === number.replace(/\s/g, ''))) return setFormError('This vehicle is already in your fleet.');
    if (!category) return setFormError('Choose the vehicle category.');
    if (!form.make.trim() || !form.model.trim()) return setFormError('Enter the make and model.');
    if (!Number.isInteger(year) || year < 1990 || year > currentYear + 1) return setFormError(`Enter a manufacturing year between 1990 and ${currentYear + 1}.`);
    if (!Number.isInteger(seats) || seats < 1 || seats > 60) return setFormError('Enter the seating capacity (1–60).');
    setSaving(true);
    try {
      await onAddVehicle({ vehicleNumber: number, categoryId: category.id, category: category.name, make: form.make.trim(), model: form.model.trim(), year: String(year), seatingCapacity: seats });
      setShowAddModal(false);
      setForm(emptyForm);
      setNotice(`${number} was added and is awaiting NESAM document review. It can be dispatched once approved.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'The vehicle was not saved. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  const act = async (id: string, work: () => Promise<void>) => {
    if (busyId) return;
    setBusyId(id);
    setActionError('');
    try { await work(); } catch (err) { setActionError(err instanceof Error ? err.message : 'The change was not saved. Please retry.'); }
    finally { setBusyId(''); }
  };

  return (
    <div className="space-y-6 pb-20">

      {/* Top Banner */}
      <div className="bg-[#111111] text-white p-6 rounded-2xl border border-[#262626] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#E21E26]">FLEET OPERATIONS</span>
          <h1 className="text-xl font-extrabold mt-0.5">Vehicle Fleet Management</h1>
          <p className="text-xs text-gray-400">Register vehicles for NESAM document review and pair them with your drivers</p>
        </div>

        <button
          onClick={() => { setForm(emptyForm); setFormError(''); setShowAddModal(true); }}
          className="px-5 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Vehicle to Fleet
        </button>
      </div>

      {notice && <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-xs font-semibold">{notice}</div>}
      {actionError && <div role="alert" className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-xl text-xs font-semibold">{actionError}</div>}

      {vehicles.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-xs text-gray-500">No vehicles in your fleet yet.</div>
      )}

      {/* Fleet Vehicles Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map(v => {
          const badge = docBadge[v.docStatus];
          return (
            <div key={v.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4 hover:border-[#E21E26] transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <span className="font-mono text-base font-black text-gray-900">{v.vehicleNumber || '—'}</span>
                    <p className="text-xs text-gray-500 font-medium">{[v.make, v.model].filter(Boolean).join(' ') || 'Make / model not recorded'}{v.year ? ` (${v.year})` : ''}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    v.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {v.status === 'Active' ? 'In service' : v.status}
                  </span>
                </div>

                <div className="space-y-2 py-3 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Category / Seats:</span>
                    <span className="font-bold text-gray-900">{v.category || '—'}{v.seatingCapacity ? ` (${v.seatingCapacity} seater)` : ''}</span>
                  </div>

                  <div className="flex justify-between text-gray-600">
                    <span>Paired Driver:</span>
                    <span className="font-bold text-[#E21E26]">{v.assignedDriverName || 'Unpaired'}</span>
                  </div>

                  <div className="flex justify-between text-gray-600">
                    <span>Documents:</span>
                    <span className={`font-bold flex items-center gap-1 ${badge.cls}`}>
                      {v.docStatus === 'Approved' ? <ShieldCheck className="w-3.5 h-3.5" /> : v.docStatus === 'Pending' ? <Clock className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {badge.label}
                    </span>
                  </div>
                  {v.rejectionReason && v.docStatus !== 'Approved' && <p className="text-[11px] text-red-600">{v.rejectionReason}</p>}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-2">
                {/* Driver Pairing Selector */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-1">Pair / Change Driver</label>
                  <select
                    value={v.assignedDriverId}
                    disabled={busyId === v.id}
                    onChange={e => void act(v.id, () => onPairDriver(v.id, e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-semibold"
                  >
                    <option value="">-- No driver --</option>
                    {v.assignedDriverId && !assignable.some(d => d.id === v.assignedDriverId) && (
                      <option value={v.assignedDriverId}>{v.assignedDriverName || 'Current driver'} (not dispatchable)</option>
                    )}
                    {assignable.map(d => (
                      <option key={d.id} value={d.id}>{d.name || 'Unnamed driver'}{d.phone ? ` (${d.phone})` : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Status Toggle */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-gray-500">Fleet Status:</span>
                  <div className="flex gap-1">
                    {(['Active', 'Maintenance', 'Inactive'] as const).map(st => (
                      <button
                        key={st}
                        disabled={busyId === v.id || v.status === st}
                        onClick={() => void act(v.id, () => onUpdateVehicleStatus(v.id, st))}
                        className={`px-2 py-1 text-[10px] font-bold rounded ${v.status === st ? (st === 'Active' ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white') : 'bg-gray-100 text-gray-600'}`}
                      >
                        {st === 'Active' ? 'In service' : st === 'Maintenance' ? 'Service' : 'Inactive'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">Add New Vehicle to Fleet</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700 text-sm font-bold">✕</button>
            </div>

            {formError && <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">{formError}</div>}

            <form onSubmit={handleCreateVehicle} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Vehicle Registration Number</label>
                  <input
                    type="text"
                    value={form.vehicleNumber}
                    onChange={e => set('vehicleNumber', e.target.value)}
                    placeholder="As printed on the RC"
                    className="w-full px-3 py-2 border rounded text-xs font-mono font-bold uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Vehicle Category</label>
                  <select
                    value={form.categoryId}
                    onChange={e => {
                      const c = categories.find(x => x.id === e.target.value);
                      setForm(f => ({ ...f, categoryId: e.target.value, seatingCapacity: f.seatingCapacity || (c?.seatingCapacity ? String(c.seatingCapacity) : '') }));
                      setFormError('');
                    }}
                    className="w-full px-3 py-2 border rounded text-xs font-bold"
                    required
                  >
                    <option value="">{categories.length ? '-- Choose category --' : 'No categories configured by NESAM'}</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Make / Brand</label>
                  <input type="text" value={form.make} onChange={e => set('make', e.target.value)} className="w-full px-3 py-2 border rounded text-xs font-semibold" required />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Model Name</label>
                  <input type="text" value={form.model} onChange={e => set('model', e.target.value)} className="w-full px-3 py-2 border rounded text-xs font-semibold" required />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Manufacturing Year</label>
                  <input type="number" inputMode="numeric" value={form.year} onChange={e => set('year', e.target.value)} className="w-full px-3 py-2 border rounded text-xs font-semibold" required />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Seating Capacity</label>
                  <input type="number" inputMode="numeric" value={form.seatingCapacity} onChange={e => set('seatingCapacity', e.target.value)} className="w-full px-3 py-2 border rounded text-xs font-semibold" required />
                </div>
              </div>

              <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                The vehicle is added as <strong>awaiting review</strong>. NESAM verifies its RC, insurance and permits before it can be dispatched on trips.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowAddModal(false)} disabled={saving} className="px-4 py-2 border text-xs font-bold rounded-xl">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-6 py-2 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow disabled:opacity-50">
                  {saving ? 'Saving…' : 'Add Vehicle to Fleet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
