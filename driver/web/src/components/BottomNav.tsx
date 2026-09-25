import React from 'react';
import { Home, Navigation, DollarSign, Wallet, Bell, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hasActiveTrip: boolean;
  unreadCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  hasActiveTrip,
  unreadCount
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'trip', label: 'Trip', icon: Navigation, badge: hasActiveTrip ? 'LIVE' : null },
    { id: 'earnings', label: 'Earnings', icon: DollarSign },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'notifications', label: 'Alerts', icon: Bell, badgeCount: unreadCount },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;

          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
                isActive ? 'text-[#E21E26]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 w-7 h-1 bg-[#E21E26] rounded-b-full" />
              )}

              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />

                {t.badge && (
                  <span className="absolute -top-1.5 -right-4 px-1 bg-[#E21E26] text-white text-[8px] font-extrabold rounded animate-pulse">
                    {t.badge}
                  </span>
                )}

                {t.badgeCount && t.badgeCount > 0 ? (
                  <span className="absolute -top-1 -right-2 min-w-3.5 h-3.5 px-0.5 bg-[#E21E26] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {t.badgeCount > 9 ? '9+' : t.badgeCount}
                  </span>
                ) : null}
              </div>

              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
