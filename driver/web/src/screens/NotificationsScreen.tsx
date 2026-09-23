import React, { useState, useEffect } from 'react';
import { Bell, ShieldCheck, DollarSign, Navigation, CheckCircle, Info } from 'lucide-react';
import { subscribeToDriverNotifications } from '../services/driverFirestoreService';

export const NotificationsScreen: React.FC<{ driverId: string }> = ({ driverId }) => {
  const defaultNotifications = [
    {
      id: 'N1',
      title: 'New Trip Assigned (MAA Airport to Guindy)',
      time: '10 min ago',
      desc: 'You have been assigned trip NESAM-BK-4082. Please complete pre-trip live verification.',
      icon: Navigation,
      color: 'bg-red-100 text-[#E21E26]'
    },
    {
      id: 'N2',
      title: 'Instant Payout Approved (₹3,500)',
      time: '2 hours ago',
      desc: 'Your payout request via UPI (muthukumar@okaxis) has been processed.',
      icon: DollarSign,
      color: 'bg-emerald-100 text-emerald-700'
    },
    {
      id: 'N3',
      title: 'Vehicle Fitness Certificate Approved',
      time: 'Yesterday',
      desc: 'NESAM Fleet Admin verified and renewed your Commercial Fitness Certificate status.',
      icon: ShieldCheck,
      color: 'bg-blue-100 text-blue-700'
    }
  ];

  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const unsub = subscribeToDriverNotifications(driverId, (liveNotifs) => {
      setNotifications(liveNotifs.length > 0 ? liveNotifs : defaultNotifications);
    });
    return () => unsub();
  }, [driverId]);

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl mx-auto">
      <div className="bg-white text-gray-900 p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
        <h1 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#E21E26]" /> Driver Notifications &amp; Alerts
        </h1>
        <p className="text-xs text-gray-500 mt-1">Real-time alerts for trip dispatches and payouts</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-3 sm:space-y-4">
        {notifications.map((n, i) => {
          const Icon = n.icon || Info;
          return (
            <div key={n.id || i} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className={`p-2.5 sm:p-3 rounded-xl ${n.color || 'bg-gray-100 text-gray-600'} shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-900">{n.title}</h3>
                  <span className="text-[10px] text-gray-400 font-mono shrink-0 mt-0.5">{n.time || 'Just now'}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{n.desc || n.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
