import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import type { DriverNotification, DriverPenalty, NotificationCategory } from '../types';
import { CATEGORIES, CATEGORY_LABEL, TONE, toneOf } from '../utils/notificationModel';
import { setSoundEnabled, soundEnabled, soundState, unlockSound, playTone } from '../utils/notificationSound';
import { formatDateTime12 } from '../utils/time';

interface NotificationsScreenProps {
  notifications: DriverNotification[];
  penalties: DriverPenalty[];
  penaltiesError: string;
  onMarkRead: (id: string) => void;
  onOpenPenalty: (p: DriverPenalty) => void;
}

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const PENALTY_CLS: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-900 border-amber-300',
  Acknowledged: 'bg-blue-50 text-blue-900 border-blue-300',
  Disputed: 'bg-orange-50 text-orange-900 border-orange-300',
  Paid: 'bg-green-50 text-green-900 border-green-300',
  Deducted: 'bg-green-50 text-green-900 border-green-300',
  Waived: 'bg-gray-100 text-gray-800 border-gray-300',
};

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ notifications, penalties, penaltiesError, onMarkRead, onOpenPenalty }) => {
  const [tab, setTab] = useState<'all' | NotificationCategory>('all');
  const [sound, setSound] = useState(soundEnabled);
  const unread = (c: NotificationCategory | 'all') => notifications.filter((n) => !n.read && (c === 'all' || n.category === c)).length;
  const list = tab === 'all' ? notifications : notifications.filter((n) => n.category === tab);
  const openPenalties = penalties.filter((p) => p.status === 'Pending').length;

  const toggleSound = (on: boolean) => {
    setSoundEnabled(on);
    setSound(on);
    if (on) {
      unlockSound();
      setTimeout(() => playTone('general'), 150);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold flex items-center gap-2"><Bell className="w-5 h-5 text-[#E21E26]" /> Notifications</h1>
            <p className="text-sm text-gray-700 mt-1">Trips, approvals, payments and penalties from NESAM</p>
          </div>
          {unread('all') > 0 && (
            <button onClick={() => notifications.filter((n) => !n.read).forEach((n) => onMarkRead(n.id))} className="text-sm font-bold text-[#E21E26] hover:underline shrink-0">Mark all read</button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <input type="checkbox" checked={sound} onChange={(e) => toggleSound(e.target.checked)} className="w-4 h-4 accent-[#E21E26]" /> Play a sound for new alerts
          {sound && soundState() === 'locked' && <span className="font-normal text-amber-800">(tap anywhere once to enable)</span>}
        </label>
      </div>

      <div role="tablist" aria-label="Notification categories" className="flex gap-1 overflow-x-auto border-b border-gray-300">
        {(['all', ...CATEGORIES] as const).map((k) => {
          const count = k === 'penalties' ? openPenalties + unread('penalties') : unread(k);
          return (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-3 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-[#E21E26] text-[#E21E26]' : 'border-transparent text-gray-700'}`}>
              {k === 'all' ? 'All' : CATEGORY_LABEL[k]}
              {count > 0 && <span className="ml-1 px-1.5 rounded-full bg-[#E21E26] text-white text-xs">{count}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'penalties' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-3">
          <h2 className="text-base font-extrabold text-gray-900">Your penalties</h2>
          {penaltiesError && <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm font-semibold p-3 rounded-xl">{penaltiesError}</div>}
          {!penaltiesError && penalties.length === 0 && <p className="text-center text-sm text-gray-600 py-6">You have no penalties.</p>}
          {penalties.map((p) => (
            <div key={p.id} className="border border-gray-300 rounded-xl p-3 sm:p-4 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">{p.category}</p>
                  <p className="text-sm text-gray-800">{p.reason}</p>
                </div>
                <p className="text-lg font-black text-red-700 shrink-0">{rupees(p.amount)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
                <span className={`px-2 py-0.5 rounded-full border font-bold ${PENALTY_CLS[p.status]}`}>{p.status}</span>
                {p.bookingCode && <span className="font-mono">{p.bookingCode}</span>}
                <span>{p.issuedAt ? formatDateTime12(p.issuedAt) : ''}</span>
                {p.acknowledged && <span className="text-green-800 font-semibold">✓ read {p.acknowledgedAt ? formatDateTime12(p.acknowledgedAt) : ''}</span>}
              </div>
              {p.description && <p className="text-sm text-gray-800">{p.description}</p>}
              {p.disputeNote && <p className="text-sm text-gray-800"><strong>Your dispute:</strong> {p.disputeNote}</p>}
              {p.status === 'Pending' && !p.acknowledged && <button onClick={() => onOpenPenalty(p)} className="mt-1 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg">Read and acknowledge</button>}
              {p.status === 'Acknowledged' && <button onClick={() => onOpenPenalty(p)} className="mt-1 text-sm font-bold text-gray-800 underline">Dispute this penalty</button>}
            </div>
          ))}
        </div>
      )}

      {tab !== 'penalties' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-3">
          {list.length === 0 ? (
            <p className="text-center text-sm text-gray-600 py-8">{tab === 'all' ? 'You have no notifications yet.' : `No ${CATEGORY_LABEL[tab].toLowerCase()} notifications.`}</p>
          ) : (
            list.map((n) => {
              const tone = TONE[toneOf(n)];
              return (
                <button key={n.id} onClick={() => !n.read && onMarkRead(n.id)} className={`w-full text-left flex items-start gap-3 p-3 sm:p-4 rounded-xl border ${n.read ? 'bg-gray-50 border-gray-200' : tone.box}`}>
                  <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: n.read ? '#D1D5DB' : tone.dot }} aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-gray-900">{n.title}</h3>
                      <span className="text-xs text-gray-700 shrink-0 mt-0.5">{n.time}</span>
                    </div>
                    <span className={`inline-block mt-0.5 text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${tone.chip}`}>{CATEGORY_LABEL[n.category]}</span>
                    {n.message && <p className="text-sm text-gray-800 mt-1">{n.message}</p>}
                    {(n.bookingCode || n.bookingId) && <p className="text-xs font-mono text-gray-700 mt-1">Ref {n.bookingCode || n.bookingId}</p>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
