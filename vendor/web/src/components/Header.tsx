import React, { useState, useEffect } from 'react';
import { VendorProfile, WalletDetails } from '../types';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import {
  Wallet,
  Bell,
  Search,
  Plus,
  ShieldCheck,
  Building2,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  Clock,
  ArrowUpRight
} from 'lucide-react';

interface HeaderProps {
  title: string;
  breadcrumb: string[];
  activeTab: string;
  onNavigate: (tab: string) => void;
  wallet: WalletDetails;
  profile: VendorProfile;
  pendingBidsCount: number;
  unreadNotifications: number;
  onQuickAction?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  breadcrumb,
  activeTab,
  onNavigate,
  wallet,
  profile,
  pendingBidsCount,
  unreadNotifications,
  onQuickAction
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const unreadCount = unreadNotifications + (pendingBidsCount > 0 ? 1 : 0);

  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E5E5E5] h-16 flex items-center px-6 gap-4 select-none">
      
      {/* Left: Dynamic Title & Breadcrumbs */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[17px] font-bold text-[#111111] leading-tight truncate">{title}</h1>
        <div className="flex items-center gap-1.5 text-[11px] text-[#999] truncate">
          <span>Nesam Fleet</span>
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span>/</span>
              <span className={i === breadcrumb.length - 1 ? 'text-[#E21B23] font-semibold' : ''}>
                {crumb}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Global Quick Search */}
      <div className="relative hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search trips, drivers, vehicles..."
          className="pl-9 pr-4 py-2 text-[13px] bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg w-60 lg:w-72 focus:outline-none focus:border-[#E21B23] focus:ring-1 focus:ring-[#E21B23]/20 transition-all placeholder-[#999]"
        />
      </div>

      {/* Contextual Action Button */}
      {activeTab === 'fleet' && (
        <button
          onClick={onQuickAction}
          className="hidden sm:flex items-center gap-2 px-3.5 py-2 text-[12px] font-semibold text-white rounded-lg transition-all hover:opacity-90 shadow-sm"
          style={{ background: '#E21B23' }}
        >
          <Plus className="w-4 h-4" />
          Add Vehicle
        </button>
      )}

      {activeTab === 'drivers' && (
        <button
          onClick={onQuickAction}
          className="hidden sm:flex items-center gap-2 px-3.5 py-2 text-[12px] font-semibold text-white rounded-lg transition-all hover:opacity-90 shadow-sm"
          style={{ background: '#E21B23' }}
        >
          <Plus className="w-4 h-4" />
          Add Driver
        </button>
      )}

      {activeTab === 'marketplace' && (
        <button
          onClick={() => onNavigate('marketplace')}
          className="hidden sm:flex items-center gap-2 px-3.5 py-2 text-[12px] font-semibold text-white rounded-lg transition-all hover:opacity-90 shadow-sm"
          style={{ background: '#E21B23' }}
        >
          <ArrowUpRight className="w-4 h-4" />
          View Live Feed
        </button>
      )}

      {/* Fleet Wallet Quick Balance Pill */}
      <button
        onClick={() => onNavigate('wallet')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
          activeTab === 'wallet'
            ? 'bg-[#E21B23] text-white border-[#E21B23] shadow-sm'
            : 'bg-[#F9F9F9] hover:bg-[#F0F0F0] text-gray-700 border-[#E5E5E5]'
        }`}
      >
        <Wallet className={`w-3.5 h-3.5 ${activeTab === 'wallet' ? 'text-white' : 'text-[#E21B23]'}`} />
        <span className="hidden lg:inline text-gray-500 font-normal">Wallet:</span>
        <span className={`font-bold ${wallet.available < 0 && activeTab !== 'wallet' ? 'text-red-600' : ''}`}>{wallet.available < 0 ? '−' : ''}₹{Math.abs(Math.round(wallet.available)).toLocaleString('en-IN')}</span>
      </button>

      {/* Notifications */}
      <button
        onClick={() => onNavigate('notifications')}
        className="relative p-2 text-[#555] hover:text-[#111] hover:bg-[#F5F5F5] rounded-lg transition-all"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 text-[11px] font-bold text-white rounded-full flex items-center justify-center bg-[#E21B23]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Vendor Profile Dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setShowProfileMenu(!showProfileMenu);
          }}
          className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 hover:bg-[#F5F5F5] rounded-lg transition-all border border-transparent hover:border-[#E5E5E5]"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
            style={{ background: '#E21B23' }}
          >
            {(profile.companyName || '?').substring(0, 2).toUpperCase()}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-[12px] font-bold text-[#111] leading-tight flex items-center gap-1">
              <span className="truncate max-w-[140px]">{profile.companyName}</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            </div>
            <div className="text-[10px] text-[#888] font-mono leading-tight">
              {profile.gstin ? `GST: ${profile.gstin}` : 'GSTIN not provided'}
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-[#999] hidden md:block" />
        </button>

        {showProfileMenu && (
          <div className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-2xl border border-[#E5E5E5] z-50 overflow-hidden">
            <div className="p-4 border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <div className="text-[13px] font-bold text-[#111] truncate">{profile.companyName}</div>
              <div className="text-[11px] text-[#666] mt-0.5">{[profile.contactPerson, profile.phone].filter(Boolean).join(' · ')}</div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Verified Fleet Vendor
                </span>
              </div>
            </div>

            <div className="py-1">
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onNavigate('documents');
                }}
                className="w-full text-left px-4 py-2.5 text-[12px] text-[#444] hover:bg-[#F5F5F5] transition-colors flex items-center justify-between"
              >
                <span>Company Verification & KYC</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#999]" />
              </button>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onNavigate('wallet');
                }}
                className="w-full text-left px-4 py-2.5 text-[12px] text-[#444] hover:bg-[#F5F5F5] transition-colors flex items-center justify-between"
              >
                <span>Bank Accounts & Payouts</span>
                <Wallet className="w-3.5 h-3.5 text-[#999]" />
              </button>
            </div>

            <div className="border-t border-[#E5E5E5]">
              <button
                onClick={async () => {
                  setShowProfileMenu(false);
                  try {
                    await signOut(auth);
                  } catch (error) {
                    console.error('Sign out error:', error);
                  }
                  window.location.href = '/';
                }}
                className="w-full text-left px-4 py-2.5 text-[12px] font-semibold transition-colors hover:bg-[#FEF2F2]"
                style={{ color: '#E21B23' }}
              >
                Vendor Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

    </header>
  );
};
