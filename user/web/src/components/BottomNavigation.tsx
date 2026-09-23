import React from 'react';

export type NavTab = 'home' | 'bookings' | 'trips' | 'notifications' | 'profile';

interface BottomNavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unreadCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onSelectTab,
  unreadCount = 0,
}) => {
  const navItems: { id: NavTab; label: string; icon: string; badge?: number }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
    {
      id: 'bookings',
      label: 'Bookings',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    },
    {
      id: 'trips',
      label: 'Live Trip',
      icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
    },
    {
      id: 'notifications',
      label: 'Alerts',
      icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
      badge: unreadCount,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    },
  ];

  return (
    <nav className="sticky bottom-0 z-30 bg-white border-t border-gray-200 px-2 py-2 flex items-center justify-around shadow-[0_-2px_10px_rgba(0,0,0,0.04)] pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-1 flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative ${
              isActive ? 'text-[#E31E24] font-bold' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="relative">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2.5 : 1.8}>
                {item.icon.split(' M').map((path, idx) => (
                  <path key={idx} strokeLinecap="round" strokeLinejoin="round" d={idx === 0 ? path : 'M' + path} />
                ))}
              </svg>
              {item.badge ? (
                <span className="absolute -top-1 -right-2 bg-[#E31E24] text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              ) : null}
            </div>
            <span className={`text-[10px] mt-1 tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
              {item.label}
            </span>
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#E31E24] absolute -bottom-1" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
