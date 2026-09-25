import React from 'react';

export type NavTab = 'home' | 'bookings' | 'notifications' | 'profile';

export const NAV_ITEMS: { id: NavTab; label: string; icon: string }[] = [
  { id: 'home', label: 'Ride', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
  {
    id: 'bookings',
    label: 'Trips',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
  {
    id: 'notifications',
    label: 'Alerts',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  },
  { id: 'profile', label: 'Account', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

export const BottomNavigation: React.FC<{ activeTab: NavTab; onSelectTab: (tab: NavTab) => void; unreadCount?: number }> = ({
  activeTab,
  onSelectTab,
  unreadCount = 0,
}) => (
  <nav className="bg-white border-t border-gray-200 px-2 pt-1.5 flex items-center justify-around pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
    {NAV_ITEMS.map((item) => {
      const isActive = activeTab === item.id;
      const badge = item.id === 'notifications' ? unreadCount : 0;
      return (
        <button
          key={item.id}
          onClick={() => onSelectTab(item.id)}
          aria-current={isActive ? 'page' : undefined}
          className={`flex flex-1 flex-col items-center py-1 rounded-xl ${isActive ? 'text-[#E31E24]' : 'text-gray-400'}`}
        >
          <span className="relative">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2.4 : 1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            {badge > 0 && (
              <span className="absolute -top-1 -right-2 bg-[#E31E24] text-white text-[9px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </span>
          <span className={`text-[10px] mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
        </button>
      );
    })}
  </nav>
);
