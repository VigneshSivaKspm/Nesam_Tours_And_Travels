import React, { useState } from 'react';
import { UserProfile } from '../types';
import { updateUserProfileInFirestore } from '../services/userFirestoreService';

interface ProfileScreenProps {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
  onOpenSavedPlaces: () => void;
  onOpenSupport?: () => void;
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  onUpdateUser,
  onOpenSavedPlaces,
  onOpenSupport,
  onLogout,
}) => {
  const [activeModal, setActiveModal] = useState<'none' | 'edit' | 'wallet' | 'language' | 'settings'>('none');
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [emergency, setEmergency] = useState(user.emergencyContact);
  const [addWalletAmt, setAddWalletAmt] = useState('500');
  const [language, setLanguage] = useState(user.language || 'English');

  // Toggle States for notification settings
  const [pushNotifs, setPushNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(true);

  const handleSaveProfile = () => {
    const updated = {
      ...user,
      name,
      email,
      emergencyContact: emergency,
      language,
    };
    onUpdateUser(updated);
    updateUserProfileInFirestore(user.uid, updated);
    setActiveModal('none');
  };

  const handleAddWalletMoney = () => {
    const amt = parseInt(addWalletAmt) || 0;
    onUpdateUser({
      ...user,
      walletBalance: user.walletBalance + amt,
    });
    alert(`₹${amt} added to NESAM Wallet successfully via Razorpay!`);
    setActiveModal('none');
  };

  return (
    <div className="flex-1 bg-[#F7F7F7] overflow-y-auto p-4 space-y-4 max-w-3xl w-full mx-auto">
      {/* Profile Header Card */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
        {user.photoUrl ? (
          <img src={user.photoUrl} alt={user.name} className="w-16 h-16 rounded-full object-cover border-2 border-[#E31E24]" />
        ) : (
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white border-2 border-[#E31E24]" style={{background: '#E21B23'}}>
            {(user.name || 'U')[0].toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-base font-black text-[#111111]">{user.name}</h2>
          <div className="text-xs text-gray-500 font-bold">{user.phone}</div>
          <div className="text-[10px] text-gray-400">{user.email}</div>
        </div>
        <button
          onClick={() => setActiveModal('edit')}
          className="text-xs font-bold text-[#E31E24] hover:underline"
        >
          Edit
        </button>
      </div>

      {/* NESAM Wallet Card */}
      <div className="bg-white text-gray-900 p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">NESAM WALLET BALANCE</div>
          <div className="text-xl font-black text-[#20A464]">₹{user.walletBalance.toLocaleString()}</div>
        </div>
        <button
          onClick={() => setActiveModal('wallet')}
          className="bg-[#E31E24] text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow hover:bg-[#C41820]"
        >
          + Add Money
        </button>
      </div>

      {/* Menu Options */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        <div
          onClick={onOpenSavedPlaces}
          className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 text-xs font-bold"
        >
          <span className="flex items-center gap-2 text-[#111111]">Saved Locations (Home, Office)</span>
          <span className="text-gray-400">→</span>
        </div>

        <div
          onClick={() => setActiveModal('language')}
          className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 text-xs font-bold"
        >
          <span className="flex items-center gap-2 text-[#111111]">App Language</span>
          <span className="text-[#E31E24] font-bold">{language} →</span>
        </div>

        <div
          onClick={() => setActiveModal('settings')}
          className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 text-xs font-bold"
        >
          <span className="flex items-center gap-2 text-[#111111]">Notification Settings</span>
          <span className="text-gray-400">→</span>
        </div>

        <div className="p-3.5 flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-2 text-gray-700">Emergency Contact</span>
          <span className="text-[10px] text-gray-500 font-normal">{user.emergencyContact}</span>
        </div>

        <div
          onClick={onOpenSupport}
          className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 text-xs font-bold"
        >
          <span className="flex items-center gap-2 text-[#111111]">Contact Help & Support</span>
          <span className="text-gray-400">→</span>
        </div>
      </div>

      {/* App Info & Terms */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 text-xs space-y-2 text-gray-600">
        <div className="flex justify-between">
          <span>Terms of Service</span>
          <span className="font-bold text-[#111111]">View</span>
        </div>
        <div className="flex justify-between">
          <span>Privacy Policy</span>
          <span className="font-bold text-[#111111]">View</span>
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 pt-1">
          <span>NESAM App Version</span>
          <span className="font-mono font-bold">v2.4.0 (Build 882)</span>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="w-full bg-red-50 text-[#D92D20] border border-red-200 py-3 rounded-2xl font-bold text-xs shadow hover:bg-red-100"
      >
        Log Out of Account
      </button>

      {/* ── MODALS ── */}

      {/* Edit Profile Modal */}
      {activeModal === 'edit' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-black text-[#111111]">EDIT PROFILE DETAILS</h3>
            <div>
              <label className="text-[10px] font-bold text-gray-400 block mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 block mb-1">Emergency Contact</label>
              <input
                type="text"
                value={emergency}
                onChange={(e) => setEmergency(e.target.value)}
                className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setActiveModal('none')} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-xl text-xs font-bold">
                Cancel
              </button>
              <button onClick={handleSaveProfile} className="flex-1 bg-[#E31E24] text-white py-2 rounded-xl text-xs font-bold">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Money Modal */}
      {activeModal === 'wallet' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-black text-[#111111]">ADD MONEY TO NESAM WALLET</h3>
            <div>
              <label className="text-[10px] font-bold text-gray-400 block mb-1">Amount (₹)</label>
              <input
                type="number"
                value={addWalletAmt}
                onChange={(e) => setAddWalletAmt(e.target.value)}
                className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-sm font-black text-[#111111]"
              />
            </div>
            <div className="flex gap-2">
              {['200', '500', '1000'].map((val) => (
                <button
                  key={val}
                  onClick={() => setAddWalletAmt(val)}
                  className="flex-1 py-1.5 bg-gray-100 text-xs font-bold rounded-lg border hover:border-[#E31E24]"
                >
                  +₹{val}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setActiveModal('none')} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-xl text-xs font-bold">
                Cancel
              </button>
              <button onClick={handleAddWalletMoney} className="flex-1 bg-[#20A464] text-white py-2 rounded-xl text-xs font-bold">
                Pay via Razorpay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Language Selector Modal */}
      {activeModal === 'language' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-black text-[#111111]">SELECT APP LANGUAGE</h3>
            {['English', 'Tamil (தமிழ்)'].map((lang) => (
              <div
                key={lang}
                onClick={() => {
                  setLanguage(lang);
                  setActiveModal('none');
                }}
                className={`p-3 rounded-xl border text-xs font-bold cursor-pointer flex justify-between ${
                  language.includes(lang.split(' ')[0]) ? 'border-[#E31E24] bg-red-50 text-[#E31E24]' : 'border-gray-200'
                }`}
              >
                <span>{lang}</span>
                {language.includes(lang.split(' ')[0]) && <span>✓</span>}
              </div>
            ))}
            <button onClick={() => setActiveModal('none')} className="w-full bg-gray-200 text-gray-700 py-2 rounded-xl text-xs font-bold">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {activeModal === 'settings' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-black text-[#111111]">NOTIFICATION SETTINGS</h3>
            <div className="flex justify-between items-center text-xs font-bold border-b border-gray-100 pb-2">
              <span>Push Notifications</span>
              <input
                type="checkbox"
                checked={pushNotifs}
                onChange={(e) => setPushNotifs(e.target.checked)}
                className="w-4 h-4 accent-[#E31E24]"
              />
            </div>
            <div className="flex justify-between items-center text-xs font-bold border-b border-gray-100 pb-2">
              <span>SMS Ride Updates</span>
              <input
                type="checkbox"
                checked={smsNotifs}
                onChange={(e) => setSmsNotifs(e.target.checked)}
                className="w-4 h-4 accent-[#E31E24]"
              />
            </div>
            <button onClick={() => setActiveModal('none')} className="w-full bg-[#111111] text-white py-2 rounded-xl text-xs font-bold">
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
