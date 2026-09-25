import React from 'react';
import { Bell, Info } from 'lucide-react';
import type { DriverNotification } from '../types';

interface NotificationsScreenProps {
  notifications: DriverNotification[];
  onMarkRead: (id: string) => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ notifications, onMarkRead }) => (
  <div className="space-y-5 sm:space-y-6 max-w-4xl mx-auto">
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between gap-3">
      <div>
        <h1 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#E21E26]" /> Notifications
        </h1>
        <p className="text-xs text-gray-500 mt-1">Account, trip and payout updates from NESAM</p>
      </div>
      {notifications.some((n) => !n.read) && (
        <button
          onClick={() => notifications.filter((n) => !n.read).forEach((n) => onMarkRead(n.id))}
          className="text-xs font-bold text-[#E21E26] hover:underline shrink-0"
        >
          Mark all read
        </button>
      )}
    </div>

    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-3">
      {notifications.length === 0 ? (
        <p className="text-center text-xs text-gray-400 py-8">You have no notifications yet.</p>
      ) : (
        notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => !n.read && onMarkRead(n.id)}
            className={`w-full text-left flex items-start gap-3 p-3 sm:p-4 rounded-xl border ${
              n.read ? 'bg-gray-50 border-gray-200' : 'bg-red-50/50 border-red-200'
            }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 ${n.read ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-[#E21E26]'}`}>
              <Info className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-gray-900">{n.title}</h3>
                <span className="text-[10px] text-gray-400 font-mono shrink-0 mt-0.5">{n.time}</span>
              </div>
              {n.message && <p className="text-xs text-gray-600 mt-1">{n.message}</p>}
            </div>
            {!n.read && <span className="w-2 h-2 rounded-full bg-[#E21E26] mt-2 shrink-0" />}
          </button>
        ))
      )}
    </div>
  </div>
);
