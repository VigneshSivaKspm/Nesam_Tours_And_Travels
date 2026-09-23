import React, { useState } from 'react';
import { VendorProfile } from '../types';
import { ShieldCheck, Upload, CheckCircle, FileText, Building2 } from 'lucide-react';
import { syncVendorProfile } from '../services/vendorFirestoreService';

interface DocumentsVerificationScreenProps {
  profile: VendorProfile;
  onUpdateProfile: (profile: VendorProfile) => void;
}

export const DocumentsVerificationScreen: React.FC<DocumentsVerificationScreenProps> = ({
  profile,
  onUpdateProfile
}) => {
  const [companyName, setCompanyName] = useState<string>(profile.companyName);
  const [gstin, setGstin] = useState<string>(profile.gstin);
  const [panNumber, setPanNumber] = useState<string>(profile.panNumber);
  const [phone, setPhone] = useState<string>(profile.phone);
  const [email, setEmail] = useState<string>(profile.email);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const editedProfile = {
      ...profile,
      companyName,
      gstin,
      panNumber,
      phone,
      email
    };
    onUpdateProfile(editedProfile);
    syncVendorProfile(editedProfile);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-[#111111] text-white p-6 rounded-2xl border border-[#262626] shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#E21E26]" /> Vendor Corporate Verification
          </h1>
          <p className="text-xs text-gray-400 mt-1">Manage business license, GSTIN, PAN and fleet credentials</p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <ShieldCheck className="w-4 h-4" /> VERIFIED VENDOR
        </span>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600" /> Business details updated and saved!
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-gray-900 border-b pb-2">Business Profile & Contact Info</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Company / Firm Name</label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">GSTIN Number</label>
            <input
              type="text"
              value={gstin}
              onChange={e => setGstin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono font-bold uppercase"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">PAN Number</label>
            <input
              type="text"
              value={panNumber}
              onChange={e => setPanNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono font-bold uppercase"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Official Mobile Phone</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold"
              required
            />
          </div>
        </div>

        <h2 className="text-base font-bold text-gray-900 border-b pb-2 pt-2">Corporate Compliance Documents</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-xl p-4 bg-gray-50 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-900">GST Registration Certificate</span>
              <p className="text-[10px] text-gray-500 font-mono">33AAACN9042K1Z8</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
              ✓ Approved
            </span>
          </div>

          <div className="border rounded-xl p-4 bg-gray-50 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-900">Company PAN Card</span>
              <p className="text-[10px] text-gray-500 font-mono">AAACN9042K</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
              ✓ Approved
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow"
          >
            Save Business Profile
          </button>
        </div>
      </form>
    </div>
  );
};
