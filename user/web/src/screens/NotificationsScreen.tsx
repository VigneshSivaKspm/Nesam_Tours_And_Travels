import React from 'react';
import { NotificationItem } from '../types';
import { markNotificationRead } from '../services/userFirestoreService';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const NotificationsScreen: React.FC<{ notifications: NotificationItem[] }> = ({ notifications }) => {
  const unread = notifications.filter((n) => !n.read);
  const markAllRead = async () => {
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, 'notifications', n.id), { read: true, readAt: new Date().toISOString() });
    });
    await batch.commit();
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-2xl w-full mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-black text-gray-900">Notifications</h2>
          <p className="text-xs text-gray-500">Booking updates, driver alerts & offers</p>
        </div>
        {unread.length > 0 && (
          <button onClick={markAllRead} className="text-xs font-bold text-[#E31E24] hover:underline">
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-gray-200 text-center text-sm text-gray-500">You’re all caught up.</div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              onClick={() => !n.read && markNotificationRead(n.id).catch(() => undefined)}
              className={`p-3.5 rounded-2xl border flex items-start gap-3 ${!n.read ? 'bg-white border-[#E31E24]/40 cursor-pointer' : 'bg-gray-50 border-gray-200'}`}
            >
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-gray-300' : 'bg-[#E31E24]'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <h4 className="text-sm font-bold text-gray-900">{n.title}</h4>
                  <span className="text-[10px] text-gray-400 shrink-0">{n.time}</span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
