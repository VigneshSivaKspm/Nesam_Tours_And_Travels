import React from 'react';
import { UserProfile } from '../types';
import { NAV_ITEMS, NavTab } from './BottomNavigation';
import { Avatar } from './ui';

interface AppHeaderProps {
  user: UserProfile;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unreadNotificationsCount?: number;
  onOpenOffers: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ user, activeTab, onSelectTab, unreadNotificationsCount = 0, onOpenOffers }) => (
  <header className="bg-white border-b border-gray-200 shrink-0">
    <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
      <button onClick={() => onSelectTab('home')} className="flex items-center gap-2.5 min-w-0">
        <img src="/icons/logo.png" alt="" className="w-8 h-8 rounded-lg object-contain" />
        <span className="text-sm font-black tracking-tight text-gray-900 truncate">
          NESAM <span className="text-xs font-medium text-gray-500 hidden sm:inline">TOURS & TRAVELS</span>
        </span>
      </button>

      <nav className="hidden md:flex items-center gap-6 h-full">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const badge = item.id === 'notifications' ? unreadNotificationsCount : 0;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative h-full text-sm font-semibold border-b-2 ${
                isActive ? 'border-[#E31E24] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {item.label}
              {badge > 0 && (
                <span className="ml-1.5 bg-[#E31E24] text-white text-[10px] font-bold px-1.5 rounded-full">{badge > 9 ? '9+' : badge}</span>
              )}
            </button>
          );
        })}
        <button onClick={onOpenOffers} className="text-sm font-semibold text-gray-500 hover:text-gray-900">
          Offers
        </button>
      </nav>

      <button onClick={() => onSelectTab('profile')} className="flex items-center gap-2" aria-label="Account">
        <span className="hidden sm:block text-xs font-semibold text-gray-700 max-w-[140px] truncate">{user.name}</span>
        <Avatar name={user.name} photoUrl={user.photoUrl} className="w-8 h-8 text-xs" />
      </button>
    </div>
  </header>
);
