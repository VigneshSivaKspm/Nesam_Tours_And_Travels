import React, { useState } from 'react';
import { UserProfile } from '../types';
import { updateCustomerProfile } from '../services/userFirestoreService';
import { uploadProfilePhoto, validateImageFile } from '../services/storageService';
import { Avatar, ErrorNotice, Modal, Spinner, inputCls, labelCls, primaryBtn } from '../components/ui';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { formatINR, formatPhone, isValidEmail, isValidIndianMobile, isValidName, localMobile } from '../utils/format';
import { describeError } from '../utils/retry';

interface ProfileScreenProps {
  user: UserProfile;
  onOpenSavedPlaces: () => void;
  onOpenSupport: () => void;
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ user, onOpenSavedPlaces, onOpenSupport, onLogout }) => {
  const [editing, setEditing] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState('');

  const changePhoto = async (file: File | undefined) => {
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) {
      setPhotoError(invalid);
      return;
    }
    setPhotoError('');
    setPhotoBusy(0);
    try {
      const url = await uploadProfilePhoto(user.uid, file, setPhotoBusy);
      await updateCustomerProfile(user.uid, { photoUrl: url });
    } catch (e) {
      setPhotoError(describeError(e, 'Couldn’t update your photo.'));
    } finally {
      setPhotoBusy(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl w-full mx-auto">
      <EditProfileModal open={editing} user={user} onClose={() => setEditing(false)} />
      <Modal open={confirmLogout} onClose={() => setConfirmLogout(false)} title="Log out?">
        <p className="text-sm text-gray-600">You’ll need to verify your phone number again to sign back in.</p>
        <div className="flex gap-2 mt-4">
          <button onClick={() => setConfirmLogout(false)} className="flex-1 bg-gray-100 py-3 rounded-2xl text-sm font-bold">
            Stay
          </button>
          <button onClick={onLogout} className="flex-1 bg-[#D92D20] text-white py-3 rounded-2xl text-sm font-bold">
            Log out
          </button>
        </div>
      </Modal>

      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
        <label className="relative cursor-pointer shrink-0" title="Change photo">
          <Avatar name={user.name} photoUrl={user.photoUrl} className="w-16 h-16 text-xl" />
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-[11px]">
            {photoBusy != null ? <Spinner className="w-3 h-3" /> : '✎'}
          </span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => void changePhoto(e.target.files?.[0])} disabled={photoBusy != null} />
        </label>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-black text-gray-900 truncate">{user.name}</h2>
          <div className="text-xs text-gray-600">{formatPhone(user.phone)}</div>
          <div className="text-[11px] text-gray-400 truncate">{user.email}</div>
        </div>
        <button onClick={() => setEditing(true)} className="text-xs font-bold text-[#E31E24] hover:underline">
          Edit
        </button>
      </div>
      {photoError && <ErrorNotice message={photoError} />}

      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">NESAM Wallet</div>
        <div className="text-2xl font-black text-emerald-700">{formatINR(user.walletBalance)}</div>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl mt-3">
          <div className="text-[13px] font-semibold text-yellow-800">Online wallet top-up coming soon</div>
          <div className="text-[12px] text-yellow-700 mt-1">Please pay cash to your driver or via UPI during the trip.</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 text-sm">
        <button onClick={onOpenSavedPlaces} className="w-full p-4 flex justify-between hover:bg-gray-50 font-semibold text-gray-900">
          Saved places <span className="text-gray-400">→</span>
        </button>
        <div className="p-4 flex justify-between">
          <span className="font-semibold text-gray-900">Emergency contact</span>
          <span className="text-gray-600">{user.emergencyContact ? formatPhone(user.emergencyContact) : 'Not set'}</span>
        </div>
        <button onClick={onOpenSupport} className="w-full p-4 flex justify-between hover:bg-gray-50 font-semibold text-gray-900">
          Help & support <span className="text-gray-400">→</span>
        </button>
      </div>

      <button onClick={() => setConfirmLogout(true)} className="w-full bg-red-50 text-[#D92D20] border border-red-200 py-3 rounded-2xl font-bold text-sm hover:bg-red-100">
        Log out
      </button>
    </div>
  );
};

const EditProfileModal: React.FC<{ open: boolean; user: UserProfile; onClose: () => void }> = ({ open, user, onClose }) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [emergency, setEmergency] = useState(localMobile(user.emergencyContact));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (open) {
      setName(user.name);
      setEmail(user.email);
      setEmergency(localMobile(user.emergencyContact));
      setError('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!isValidName(name)) return setError('Enter your full name (letters and spaces, 2–60 characters).');
    if (!isValidEmail(email)) return setError('Enter a valid email address.');
    if (!isValidIndianMobile(emergency)) return setError('Enter a 10-digit emergency contact number.');
    if (emergency === localMobile(user.phone)) return setError('Emergency contact must differ from your own number.');
    setBusy(true);
    setError('');
    try {
      const allowedFields = {
        name,
        email: email.toLowerCase() || null,
        emergencyContact: `+91 ${emergency}` || null,
      };
      await updateCustomerProfile(user.uid, allowedFields);
      onClose();
    } catch (e) {
      setError(describeError(e, 'Couldn’t save your changes.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit profile" dismissible={!busy}>
      <div className="space-y-3">
        <div>
          <label htmlFor="ep-name" className={labelCls}>
            Full name
          </label>
          <input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="ep-email" className={labelCls}>
            Email
          </label>
          <input id="ep-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="ep-em" className={labelCls}>
            Emergency contact (+91)
          </label>
          <input
            id="ep-em"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={emergency}
            onChange={(e) => setEmergency(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className={inputCls}
          />
        </div>
        {error && <ErrorNotice message={error} />}
        <button onClick={() => void save()} disabled={busy} className={primaryBtn}>
          {busy ? <Spinner label="Saving…" /> : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
};
