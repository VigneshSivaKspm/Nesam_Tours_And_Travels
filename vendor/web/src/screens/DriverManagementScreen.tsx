import React, { useState } from 'react';
import { FleetDriver, FleetVehicle } from '../types';
import { Plus, ShieldCheck, Phone, Clock, AlertTriangle } from 'lucide-react';

interface DriverManagementScreenProps {
  drivers: FleetDriver[];
  vehicles: FleetVehicle[];
  onInviteDriver: (phone: string, vehicleNumber: string) => Promise<void>;
  onSetSuspended: (driverId: string, suspended: boolean) => Promise<void>;
}

const accountBadge: Record<FleetDriver['accountStatus'], { label: string; cls: string }> = {
  Approved: { label: 'Approved by NESAM', cls: 'text-emerald-600' },
  Pending: { label: 'Awaiting NESAM review', cls: 'text-amber-600' },
  'Needs Correction': { label: 'Needs correction', cls: 'text-amber-700' },
  Rejected: { label: 'Rejected', cls: 'text-red-600' },
};

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?';

export const DriverManagementScreen: React.FC<DriverManagementScreenProps> = ({
  drivers,
  vehicles,
  onInviteDriver,
  onSetSuspended
}) => {
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [phone, setPhone] = useState<string>('');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) return setFormError('Enter the driver’s 10-digit mobile number.');
    setSaving(true);
    setFormError('');
    try {
      await onInviteDriver(digits, vehicleNumber);
      setShowAddModal(false);
      setPhone('');
      setVehicleNumber('');
      setNotice(`Invitation saved for +91 ${digits}. The driver joins your fleet by signing up in the NESAM Driver app with this number; NESAM then reviews their documents.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'The invitation was not saved. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSuspended = async (d: FleetDriver) => {
    if (busyId) return;
    setBusyId(d.id);
    setActionError('');
    try { await onSetSuspended(d.id, !d.suspended); }
    catch (err) { setActionError(err instanceof Error ? err.message : 'The change was not saved. Please retry.'); }
    finally { setBusyId(''); }
  };

  return (
    <div className="space-y-6 pb-20">

      {/* Top Banner */}
      <div className="bg-[#111111] text-white p-6 rounded-2xl border border-[#262626] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#E21E26]">FLEET HUMAN RESOURCES</span>
          <h1 className="text-xl font-extrabold mt-0.5">Driver Management</h1>
          <p className="text-xs text-gray-400">Invite drivers to your fleet, see their NESAM verification and duty status</p>
        </div>

        <button
          onClick={() => { setFormError(''); setShowAddModal(true); }}
          className="px-5 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Invite Driver
        </button>
      </div>

      {notice && <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-xs font-semibold">{notice}</div>}
      {actionError && <div role="alert" className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-xl text-xs font-semibold">{actionError}</div>}

      {drivers.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-xs text-gray-500">
          No drivers in your fleet yet. Invited drivers appear here after they sign up in the NESAM Driver app.
        </div>
      )}

      {/* Drivers List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {drivers.map(d => {
          const badge = accountBadge[d.accountStatus];
          return (
            <div key={d.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4 hover:border-[#E21E26] transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 border-b pb-3">
                  {d.photoUrl ? (
                    <img src={d.photoUrl} alt={d.name} className="w-12 h-12 rounded-xl object-cover border-2 border-[#E21E26] shadow-sm" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#E21E26] text-white font-bold flex items-center justify-center">{initials(d.name)}</div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{d.name || 'Name not provided'}</h3>
                    <div className="flex items-center gap-1 text-xs mt-0.5">
                      {d.rating !== null
                        ? <span className="text-amber-500 font-bold">★ {d.rating.toFixed(1)}</span>
                        : <span className="text-gray-400">No ratings yet</span>}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 py-3 text-xs">
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" /> Phone:</span>
                    <span className="font-semibold text-gray-900">{d.phone || '—'}</span>
                  </div>

                  <div className="flex items-center justify-between text-gray-600">
                    <span>DL Number:</span>
                    <span className="font-mono font-bold text-gray-900">{d.licenseNumber || '—'}</span>
                  </div>

                  <div className="flex items-center justify-between text-gray-600">
                    <span>Paired Vehicle:</span>
                    <span className="font-mono font-bold text-[#E21E26]">{d.assignedVehicleNumber || 'Unpaired'}</span>
                  </div>

                  <div className="flex items-center justify-between text-gray-600">
                    <span>Verification:</span>
                    <span className={`font-bold flex items-center gap-1 ${badge.cls}`}>
                      {d.accountStatus === 'Approved' ? <ShieldCheck className="w-3.5 h-3.5" /> : d.accountStatus === 'Pending' ? <Clock className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {badge.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-gray-600">
                    <span>Duty (driver app):</span>
                    <span className={`font-bold ${d.online ? 'text-emerald-600' : 'text-gray-500'}`}>{d.online ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
              </div>

              {/* Fleet suspension (a real driver-record change; duty status is set by the driver) */}
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500">{d.suspended ? 'Suspended from your fleet' : 'Active in your fleet'}</span>
                <button
                  disabled={busyId === d.id}
                  onClick={() => void toggleSuspended(d)}
                  className={`px-2 py-1 text-[10px] font-bold rounded ${d.suspended ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} disabled:opacity-50`}
                >
                  {d.suspended ? 'Reinstate' : 'Suspend'}
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Invite Driver Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">Invite a Driver to Your Fleet</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700 text-sm font-bold">✕</button>
            </div>

            {formError && <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">{formError}</div>}

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Driver’s Mobile Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setFormError(''); }}
                  placeholder="10-digit mobile number"
                  className="w-full px-3 py-2 border rounded text-xs font-semibold"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Suggested Vehicle (optional)</label>
                <select
                  value={vehicleNumber}
                  onChange={e => setVehicleNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-xs font-semibold"
                >
                  <option value="">-- None --</option>
                  {vehicles.filter(v => v.vehicleNumber).map(v => (
                    <option key={v.id} value={v.vehicleNumber}>{v.vehicleNumber}{v.make || v.model ? ` (${[v.make, v.model].filter(Boolean).join(' ')})` : ''}</option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                The driver completes their own profile, licence and documents in the NESAM Driver app. NESAM reviews them before the driver can take trips.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowAddModal(false)} disabled={saving} className="px-4 py-2 border text-xs font-bold rounded-xl">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-6 py-2 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
