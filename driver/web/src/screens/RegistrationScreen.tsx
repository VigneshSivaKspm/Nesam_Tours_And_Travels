import React, { useState } from 'react';
import { DriverProfile, DrivingLicense, VehicleDetails, DocumentStatus } from '../types';
import { submitDriverKycInFirestore } from '../services/driverFirestoreService';
import {
  User,
  CreditCard,
  Car,
  FileText,
  CheckCircle,
  Upload,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Camera
} from 'lucide-react';

interface RegistrationScreenProps {
  driverId: string;
  profile: DriverProfile;
  license: DrivingLicense;
  vehicle: VehicleDetails;
  onSaveProfile: (profile: DriverProfile) => void;
  onSaveLicense: (license: DrivingLicense) => void;
  onSaveVehicle: (vehicle: VehicleDetails) => void;
}

export const RegistrationScreen: React.FC<RegistrationScreenProps> = ({
  driverId,
  profile,
  license,
  vehicle,
  onSaveProfile,
  onSaveLicense,
  onSaveVehicle
}) => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [profileForm, setProfileForm] = useState<DriverProfile>(profile);
  const [licenseForm, setLicenseForm] = useState<DrivingLicense>(license);
  const [vehicleForm, setVehicleForm] = useState<VehicleDetails>(vehicle);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const steps = [
    { id: 1, label: 'Driver Profile', icon: User },
    { id: 2, label: 'Driving License', icon: CreditCard },
    { id: 3, label: 'Vehicle Specs', icon: Car },
    { id: 4, label: 'Vehicle Docs', icon: FileText },
    { id: 5, label: 'Verification Status', icon: ShieldCheck }
  ];

  const handleSaveStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeStep === 1) onSaveProfile(profileForm);
    if (activeStep === 2) onSaveLicense(licenseForm);
    if (activeStep === 3 || activeStep === 4) onSaveVehicle(vehicleForm);

    if (activeStep === 4) {
      submitDriverKycInFirestore(driverId, licenseForm, vehicleForm);
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    if (activeStep < 5) setActiveStep(prev => prev + 1);
  };

  const mockUploadImage = (field: string) => {
    const dummyImage = 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&auto=format&fit=crop&q=80';
    if (field === 'dlFront') setLicenseForm({ ...licenseForm, frontPhotoUrl: dummyImage });
    if (field === 'dlBack') setLicenseForm({ ...licenseForm, backPhotoUrl: dummyImage });
    if (field === 'rc') setVehicleForm({ ...vehicleForm, rcDocUrl: dummyImage });
    if (field === 'insurance') setVehicleForm({ ...vehicleForm, insuranceDocUrl: dummyImage });
    if (field === 'fitness') setVehicleForm({ ...vehicleForm, fitnessDocUrl: dummyImage });
    if (field === 'permit') setVehicleForm({ ...vehicleForm, statePermitDocUrl: dummyImage });
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl mx-auto">

      {/* Title Header */}
      <div className="bg-white text-gray-900 p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">Driver Partner Verification</h1>
          <p className="text-xs text-gray-500 mt-1">Complete mandatory profile and vehicle documents verification</p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 self-start sm:self-auto shrink-0">
          <ShieldCheck className="w-4 h-4" /> Account Verified
        </span>
      </div>

      {/* Step Indicator */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 bg-white p-2 sm:p-3 rounded-xl border border-[#E5E5E5] shadow-sm">
        {steps.map((st) => {
          const Icon = st.icon;
          const isActive = activeStep === st.id;
          const isDone = activeStep > st.id;

          return (
            <button
              key={st.id}
              onClick={() => setActiveStep(st.id)}
              className={`flex flex-col items-center py-2 px-1 rounded-lg transition-all ${
                isActive
                  ? 'bg-[#E21E26] text-white font-bold shadow'
                  : isDone
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span className="text-[10px] hidden sm:inline text-center">{st.label}</span>
              <span className="text-[10px] sm:hidden font-mono">Step {st.id}</span>
            </button>
          );
        })}
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" /> Document updated and saved successfully!
        </div>
      )}

      {/* Step Forms */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
        
        {/* STEP 1: DRIVER PROFILE */}
        {activeStep === 1 && (
          <form onSubmit={handleSaveStep} className="space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-[#E21E26]" /> Step 1: Personal Driver Profile
            </h2>

            <div className="flex items-center gap-4 py-2 border-b border-gray-100">
              <img
                src={profileForm.photoUrl}
                alt="Driver Photo"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-[#E21E26] shadow-sm"
              />
              <div>
                <span className="text-xs font-bold text-gray-700">Driver Photo (Live Selfie)</span>
                <p className="text-[11px] text-gray-500 mb-2">Must be a clear front-facing official portrait.</p>
                <div className="relative">
                  <input type="file" accept="image/*" onChange={() => mockUploadImage('profile')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <button type="button" className="px-3 py-1.5 bg-[#111] hover:bg-[#262626] text-white text-xs font-bold rounded-lg flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#E21E26]" /> Capture / Upload Selfie
                  </button>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Full Legal Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#E21E26]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Registered Mobile Number</label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#E21E26]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#E21E26]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Emergency Contact Number</label>
                <input
                  type="text"
                  value={profileForm.emergencyContact}
                  onChange={e => setProfileForm({ ...profileForm, emergencyContact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#E21E26]"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-700 block mb-1">Residential Address</label>
                <textarea
                  value={profileForm.address}
                  onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#E21E26] h-20"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow transition-all"
              >
                Save & Continue to Driving License
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: DRIVING LICENSE */}
        {activeStep === 2 && (
          <form onSubmit={handleSaveStep} className="space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#E21E26]" /> Step 2: Driving License Details
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Driving License Number</label>
                <input
                  type="text"
                  value={licenseForm.number}
                  onChange={e => setLicenseForm({ ...licenseForm, number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono font-bold uppercase focus:outline-none focus:border-[#E21E26]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">License Expiry Date</label>
                <input
                  type="text"
                  value={licenseForm.expiryDate}
                  onChange={e => setLicenseForm({ ...licenseForm, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#E21E26]"
                  required
                />
              </div>
            </div>

            {/* DL Front & Back Upload Cards */}
            <div className="grid md:grid-cols-2 gap-4 pt-2">
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 text-center">
                <span className="text-xs font-bold text-gray-700 block mb-2">Driving License (Front Side)</span>
                {licenseForm.frontPhotoUrl ? (
                  <img src={licenseForm.frontPhotoUrl} alt="DL Front" className="h-32 w-full object-cover rounded-lg mb-3 border" />
                ) : (
                  <div className="h-32 bg-gray-200 rounded-lg flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div className="relative w-full">
                  <input type="file" accept="image/*" onChange={() => mockUploadImage('dlFront')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <button type="button" className="w-full py-2 bg-[#111] hover:bg-[#262626] text-white text-xs font-bold rounded-lg">Upload DL Front Photo</button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 text-center">
                <span className="text-xs font-bold text-gray-700 block mb-2">Driving License (Back Side)</span>
                {licenseForm.backPhotoUrl ? (
                  <img src={licenseForm.backPhotoUrl} alt="DL Back" className="h-32 w-full object-cover rounded-lg mb-3 border" />
                ) : (
                  <div className="h-32 bg-gray-200 rounded-lg flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div className="relative w-full">
                  <input type="file" accept="image/*" onChange={() => mockUploadImage('dlBack')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <button type="button" className="w-full py-2 bg-[#111] hover:bg-[#262626] text-white text-xs font-bold rounded-lg">Upload DL Back Photo</button>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-bold rounded-xl"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow"
              >
                Save & Continue to Vehicle Specs
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: VEHICLE DETAILS */}
        {activeStep === 3 && (
          <form onSubmit={handleSaveStep} className="space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Car className="w-5 h-5 text-[#E21E26]" /> Step 3: Registered Vehicle Information
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Vehicle Registration Number</label>
                <input
                  type="text"
                  value={vehicleForm.vehicleNumber}
                  onChange={e => setVehicleForm({ ...vehicleForm, vehicleNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono font-bold uppercase focus:outline-none focus:border-[#E21E26]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Vehicle Category</label>
                <select
                  value={vehicleForm.vehicleType}
                  onChange={e => setVehicleForm({ ...vehicleForm, vehicleType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold focus:outline-none focus:border-[#E21E26]"
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
                  value={vehicleForm.make}
                  onChange={e => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#E21E26]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Model Name</label>
                <input
                  type="text"
                  value={vehicleForm.model}
                  onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#E21E26]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Manufacturing Year</label>
                <input
                  type="text"
                  value={vehicleForm.year}
                  onChange={e => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#E21E26]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Seating Capacity</label>
                <input
                  type="number"
                  value={vehicleForm.capacity}
                  onChange={e => setVehicleForm({ ...vehicleForm, capacity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#E21E26]"
                  required
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-bold rounded-xl"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow"
              >
                Save & Upload Vehicle Documents
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: VEHICLE DOCUMENTS (RC, Insurance, Fitness, Permit) */}
        {activeStep === 4 && (
          <form onSubmit={handleSaveStep} className="space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#E21E26]" /> Step 4: Mandatory Vehicle Compliance Documents
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              
              {/* RC */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <span className="text-xs font-bold text-gray-800 block mb-1">Registration Certificate (RC)</span>
                <input
                  type="text"
                  placeholder="RC Number"
                  value={vehicleForm.rcNumber}
                  onChange={e => setVehicleForm({ ...vehicleForm, rcNumber: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs font-mono mb-2"
                />
                <div className="relative w-full">
                  <input type="file" accept="image/*" onChange={() => mockUploadImage('rc')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <button type="button" className="w-full py-2 bg-[#111] hover:bg-[#262626] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"><Upload className="w-3.5 h-3.5 text-[#E21E26]" /> Upload RC Document</button>
                </div>
              </div>

              {/* Commercial Insurance */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <span className="text-xs font-bold text-gray-800 block mb-1">Commercial Vehicle Insurance</span>
                <input
                  type="text"
                  placeholder="Insurance Policy #"
                  value={vehicleForm.insuranceNumber}
                  onChange={e => setVehicleForm({ ...vehicleForm, insuranceNumber: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs font-mono mb-2"
                />
                <div className="relative w-full">
                  <input type="file" accept="image/*" onChange={() => mockUploadImage('insurance')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <button type="button" className="w-full py-2 bg-[#111] hover:bg-[#262626] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"><Upload className="w-3.5 h-3.5 text-[#E21E26]" /> Upload Insurance Policy</button>
                </div>
              </div>

              {/* Fitness Certificate */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <span className="text-xs font-bold text-gray-800 block mb-1">Fitness Certificate (FC)</span>
                <input
                  type="text"
                  placeholder="FC Expiry Date"
                  value={vehicleForm.fitnessExpiry}
                  onChange={e => setVehicleForm({ ...vehicleForm, fitnessExpiry: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs mb-2"
                />
                <div className="relative w-full">
                  <input type="file" accept="image/*" onChange={() => mockUploadImage('fitness')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <button type="button" className="w-full py-2 bg-[#111] hover:bg-[#262626] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"><Upload className="w-3.5 h-3.5 text-[#E21E26]" /> Upload Fitness Certificate</button>
                </div>
              </div>

              {/* State Permit */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <span className="text-xs font-bold text-gray-800 block mb-1">State / All India Taxi Permit</span>
                <input
                  type="text"
                  placeholder="Permit Number"
                  value={vehicleForm.statePermitNumber}
                  onChange={e => setVehicleForm({ ...vehicleForm, statePermitNumber: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs font-mono mb-2"
                />
                <div className="relative w-full">
                  <input type="file" accept="image/*" onChange={() => mockUploadImage('permit')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <button type="button" className="w-full py-2 bg-[#111] hover:bg-[#262626] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"><Upload className="w-3.5 h-3.5 text-[#E21E26]" /> Upload State Permit</button>
                </div>
              </div>

            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setActiveStep(3)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-bold rounded-xl"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow"
              >
                Review Verification Status
              </button>
            </div>
          </form>
        )}

        {/* STEP 5: VERIFICATION STATUS SUMMARY */}
        {activeStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#E21E26]" /> Step 5: Document Audit & Status
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              {/* License Card */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-800">Driving License</span>
                  <p className="text-xs text-gray-500 font-mono">{license.number}</p>
                </div>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${license.number ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {license.number ? 'Submitted' : 'Pending'}
                </span>
              </div>

              {/* RC Card */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-800">Vehicle RC & Registration</span>
                  <p className="text-xs text-gray-500 font-mono">{vehicle.vehicleNumber}</p>
                </div>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${vehicle.vehicleNumber ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {vehicle.vehicleNumber ? 'Submitted' : 'Pending'}
                </span>
              </div>

              {/* Commercial Insurance */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-800">Commercial Insurance</span>
                  <p className="text-xs text-gray-500 font-mono">Expires: {vehicle.insuranceExpiry}</p>
                </div>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${vehicle.insuranceExpiry ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {vehicle.insuranceExpiry ? 'Submitted' : 'Pending'}
                </span>
              </div>

              {/* Fitness Certificate */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-800">Fitness & State Permit</span>
                  <p className="text-xs text-gray-500 font-mono">{vehicle.statePermitNumber}</p>
                </div>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${vehicle.statePermitNumber ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {vehicle.statePermitNumber ? 'Submitted' : 'Pending'}
                </span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-emerald-900">Driver Partner Account Active</h3>
                <p className="text-xs text-emerald-700">
                  All documents have been verified by NESAM Super Admin & Fleet Operations. You are ready to accept rides!
                </p>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
