import React, { useState } from 'react';
import { CreditCard, Car, FileText, Landmark, LogOut, Pencil, ShieldCheck, User, Loader2, CheckCircle2 } from 'lucide-react';
import type { BankDetails, DriverAccount } from '../types';
import { describeFirestoreError } from '../services/driverFirestoreService';

type ContactFields = {
  email: string;
  address: string;
  city: string;
  pincode: string;
  emergencyContactName: string;
  emergencyContact: string;
  bank: BankDetails;
};

interface ProfileScreenProps {
  account: DriverAccount;
  completedTrips: number;
  onEditDocuments: () => void;
  onSaveContact: (fields: ContactFields) => Promise<void>;
  onSignOut: () => void;
}

const Row: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-3 py-2 border-b border-gray-100 last:border-0 text-xs">
    <span className="text-gray-500">{label}</span>
    <span className="font-semibold text-gray-900 text-right break-all">{value || '—'}</span>
  </div>
);

const expiryBadge = (date: string) => {
  if (!date) return null;
  const days = Math.floor((new Date(date).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(days)) return null;
  if (days < 0) return <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Expired</span>;
  if (days <= 30) return <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Expires in {days}d</span>;
  return null;
};

const DocThumb: React.FC<{ label: string; url: string; expiry?: string }> = ({ label, url, expiry }) => (
  <a
    href={url || undefined}
    target="_blank"
    rel="noreferrer"
    className={`border border-gray-200 rounded-xl p-2 bg-gray-50 block ${url ? 'hover:border-[#E21E26]' : 'pointer-events-none opacity-60'}`}
  >
    {url ? (
      <img src={url} alt={label} className="h-20 w-full object-cover rounded-lg" />
    ) : (
      <div className="h-20 w-full rounded-lg bg-gray-200 flex items-center justify-center text-[10px] text-gray-500">Not uploaded</div>
    )}
    <div className="flex items-center justify-between gap-1 mt-1.5">
      <span className="text-[11px] font-bold text-gray-700 truncate">{label}</span>
      {expiry && expiryBadge(expiry)}
    </div>
  </a>
);

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ account, completedTrips, onEditDocuments, onSaveContact, onSignOut }) => {
  const { driver, identity, license, vehicle, bank } = account;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ContactFields>({
    email: driver.email,
    address: driver.address,
    city: driver.city,
    pincode: driver.pincode,
    emergencyContactName: driver.emergencyContactName,
    emergencyContact: driver.emergencyContact,
    bank,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const startEdit = () => {
    setForm({
      email: driver.email,
      address: driver.address,
      city: driver.city,
      pincode: driver.pincode,
      emergencyContactName: driver.emergencyContactName,
      emergencyContact: driver.emergencyContact,
      bank,
    });
    setError('');
    setEditing(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Invalid email.');
    if (!/^\d{6}$/.test(form.pincode)) return setError('Enter a 6-digit pincode.');
    if (!/^[6-9]\d{9}$/.test(form.emergencyContact)) return setError('Enter a valid emergency contact number.');
    if (!/^\d{9,18}$/.test(form.bank.accountNumber)) return setError('Enter a valid bank account number.');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.bank.ifsc.toUpperCase())) return setError('Invalid IFSC code.');
    if (form.bank.upiId && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(form.bank.upiId)) return setError('Invalid UPI ID.');
    setSaving(true);
    setError('');
    try {
      await onSaveContact({ ...form, bank: { ...form.bank, ifsc: form.bank.ifsc.toUpperCase() } });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(describeFirestoreError(err, 'Could not save your changes.'));
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#E21E26]';

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Identity card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
        {driver.photoUrl ? (
          <img src={driver.photoUrl} alt={driver.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-[#E21E26]" />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-[#E21E26] flex items-center justify-center text-white text-2xl font-bold">{driver.name.charAt(0)}</div>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            {driver.name} <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </h1>
          <p className="text-xs text-gray-500 font-mono">{driver.phone}</p>
          <p className="text-xs text-gray-500 mt-1">
            ★ {driver.rating.toFixed(1)} • {completedTrips} trips • Partner since {driver.joiningDate}
            {driver.vendorName ? ` • ${driver.vendorName}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1">
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">ACCOUNT APPROVED</span>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
            driver.docStatus === 'Approved' ? 'bg-emerald-100 text-emerald-700' : driver.docStatus === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}>
            DOCUMENTS: {driver.docStatus.toUpperCase()}
          </span>
        </div>
      </div>

      {driver.docStatus === 'Rejected' && driver.rejectionReason && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-xl">
          <span className="font-bold">Document note from NESAM: </span>{driver.rejectionReason}
        </div>
      )}
      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Profile updated.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {/* Personal & bank */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><User className="w-4 h-4 text-[#E21E26]" /> Contact &amp; Bank</h2>
            {!editing && (
              <button onClick={startEdit} className="text-[11px] font-bold text-[#E21E26] flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</button>
            )}
          </div>
          {editing ? (
            <form onSubmit={save} className="space-y-3">
              <input className={input} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <textarea className={`${input} h-16`} placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className={input} placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <input className={input} placeholder="Pincode" maxLength={6} value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '') })} />
                <input className={input} placeholder="Emergency contact name" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
                <input className={input} placeholder="Emergency mobile" maxLength={10} value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value.replace(/\D/g, '') })} />
              </div>
              <p className="text-[11px] font-bold text-gray-700 pt-1">Bank account</p>
              <input className={input} placeholder="Account holder" value={form.bank.accountHolder} onChange={(e) => setForm({ ...form, bank: { ...form.bank, accountHolder: e.target.value } })} />
              <div className="grid grid-cols-2 gap-2">
                <input className={`${input} font-mono`} placeholder="Account number" value={form.bank.accountNumber} onChange={(e) => setForm({ ...form, bank: { ...form.bank, accountNumber: e.target.value.replace(/\D/g, '') } })} />
                <input className={`${input} font-mono uppercase`} placeholder="IFSC" maxLength={11} value={form.bank.ifsc} onChange={(e) => setForm({ ...form, bank: { ...form.bank, ifsc: e.target.value.toUpperCase() } })} />
                <input className={input} placeholder="Bank name" value={form.bank.bankName} onChange={(e) => setForm({ ...form, bank: { ...form.bank, bankName: e.target.value } })} />
                <input className={`${input} font-mono`} placeholder="UPI ID" value={form.bank.upiId} onChange={(e) => setForm({ ...form, bank: { ...form.bank, upiId: e.target.value.trim() } })} />
              </div>
              {error && <p className="text-[11px] text-red-600 font-semibold">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 border text-xs font-bold rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-1.5 bg-[#E21E26] text-white text-xs font-bold rounded-lg flex items-center gap-1 disabled:opacity-60">
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />} Save
                </button>
              </div>
            </form>
          ) : (
            <>
              <Row label="Email" value={driver.email} />
              <Row label="Date of birth" value={driver.dob} />
              <Row label="Address" value={[driver.address, driver.city, driver.pincode].filter(Boolean).join(', ')} />
              <Row label="Emergency contact" value={driver.emergencyContact ? `${driver.emergencyContactName} (${driver.emergencyContact})` : ''} />
              <div className="flex items-center gap-2 pt-3 text-xs font-bold text-gray-700"><Landmark className="w-4 h-4 text-[#E21E26]" /> Payout account</div>
              <Row label="Account holder" value={bank.accountHolder} />
              <Row label="Account no." value={bank.accountNumber ? `••••${bank.accountNumber.slice(-4)}` : ''} />
              <Row label="IFSC" value={bank.ifsc} />
              <Row label="UPI" value={bank.upiId} />
            </>
          )}
        </div>

        {/* Licence & vehicle */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-2"><CreditCard className="w-4 h-4 text-[#E21E26]" /> Licence &amp; ID</h2>
          <Row label="Licence no." value={license.number} />
          <Row label="Licence valid till" value={license.expiryDate} />
          <Row label="Aadhaar" value={identity.aadhaarNumber ? `XXXX XXXX ${identity.aadhaarNumber.slice(-4)}` : ''} />
          <Row label="PAN" value={identity.panNumber} />
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mt-4 mb-2"><Car className="w-4 h-4 text-[#E21E26]" /> Vehicle</h2>
          <Row label="Registration" value={vehicle.vehicleNumber} />
          <Row label="Vehicle" value={`${vehicle.make} ${vehicle.model} (${vehicle.year})`} />
          <Row label="Category" value={`${vehicle.vehicleType} • ${vehicle.capacity} seats • ${vehicle.fuelType}`} />
          <Row label="Colour" value={vehicle.color} />
        </div>
      </div>

      {/* Documents */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4 text-[#E21E26]" /> Documents</h2>
          <button onClick={onEditDocuments} className="px-3 py-1.5 bg-[#111] text-white text-[11px] font-bold rounded-lg">Update Documents</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DocThumb label="Licence (front)" url={license.frontPhotoUrl} expiry={license.expiryDate} />
          <DocThumb label="Licence (back)" url={license.backPhotoUrl} />
          <DocThumb label="Aadhaar (front)" url={identity.aadhaarFrontUrl} />
          <DocThumb label="Aadhaar (back)" url={identity.aadhaarBackUrl} />
          <DocThumb label="RC" url={vehicle.rcDocUrl} />
          <DocThumb label="Insurance" url={vehicle.insuranceDocUrl} expiry={vehicle.insuranceExpiry} />
          <DocThumb label="Permit" url={vehicle.statePermitDocUrl} expiry={vehicle.permitExpiry} />
          <DocThumb label="Fitness (FC)" url={vehicle.fitnessDocUrl} expiry={vehicle.fitnessExpiry} />
          <DocThumb label="Vehicle front" url={vehicle.frontPhotoUrl} />
          <DocThumb label="Vehicle rear" url={vehicle.rearPhotoUrl} />
          <DocThumb label="Vehicle side" url={vehicle.sidePhotoUrl} />
          <DocThumb label="Interior" url={vehicle.interiorPhotoUrl} />
        </div>
      </div>

      <button onClick={onSignOut} className="w-full lg:hidden py-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );
};
