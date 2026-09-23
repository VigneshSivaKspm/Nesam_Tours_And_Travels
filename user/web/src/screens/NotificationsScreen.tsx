import React, { useState, useEffect } from 'react';
import { NotificationItem } from '../types';
import { subscribeToUserNotifications } from '../services/userFirestoreService';

export const NotificationsScreen: React.FC<{ recipientId: string }> = ({ recipientId }) => {
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const unsub = subscribeToUserNotifications(recipientId, setNotifs);
    return () => unsub();
  }, [recipientId]);

  const markAllRead = () => {
    setNotifs(notifs.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="flex-1 bg-[#F7F7F7] overflow-y-auto p-4 space-y-3 max-w-3xl w-full mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-sm font-black text-[#111111] uppercase tracking-wider">NOTIFICATIONS</h2>
          <p className="text-[10px] text-gray-500">Booking updates, driver alerts & offers</p>
        </div>
        <button
          onClick={markAllRead}
          className="text-[10px] font-bold text-[#E31E24] hover:underline"
        >
          Mark All Read
        </button>
      </div>

      <div className="space-y-2">
        {notifs.map((n) => (
          <div
            key={n.id}
            className={`p-3.5 rounded-2xl border shadow-sm flex items-start gap-3 transition-all ${
              !n.read ? 'bg-white border-[#E31E24]/40' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-red-50 text-[#E31E24] flex items-center justify-center text-xs shrink-0 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>

            <div className="flex-1">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-[#111111]">{n.title}</h4>
                <span className="text-[9px] text-gray-400 font-bold">{n.time}</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-snug mt-0.5">{n.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
