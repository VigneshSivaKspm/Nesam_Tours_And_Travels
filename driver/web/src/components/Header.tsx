import React, { useState } from "react";
import type { DriverStatus, DriverProfile } from "../types";
import {
  AlertTriangle,
  Wallet,
  Bell,
  ShieldCheck,
  LogOut,
  Home,
  Navigation,
  DollarSign,
  User,
  Menu,
  X,
} from "lucide-react";

interface HeaderProps {
  status: DriverStatus;
  onStatusChange: (status: DriverStatus) => void;
  profile: DriverProfile;
  walletBalance: number;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  unreadNotificationsCount: number;
  onOpenSOS: () => void;
  onLogout: () => void;
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "trip", label: "Trip", icon: Navigation },
  { id: "earnings", label: "Earnings", icon: DollarSign },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "notifications", label: "Alerts", icon: Bell },
  { id: "profile", label: "Profile", icon: User },
];

export const Header: React.FC<HeaderProps> = ({
  status,
  onStatusChange,
  profile,
  walletBalance,
  activeTab,
  setActiveTab,
  unreadNotificationsCount,
  onOpenSOS,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const statusStyles: Record<string, string> = {
    Online: "bg-emerald-50 text-emerald-700 border-emerald-200",
    "On Trip": "bg-red-50 text-[#E21E26] border-red-200",
  };
  const statusDot: Record<string, string> = {
    Online: "bg-emerald-500",
    "On Trip": "bg-[#E21E26]",
  };

  const go = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Logo */}
          <button
            className="flex items-center gap-2.5 shrink-0"
            onClick={() => go("dashboard")}
          >
            <img
              src="/icons/logo.png"
              alt="NESAM Tours & Travels - Driver Partner"
              className="w-9 h-9 rounded-xl object-contain bg-gray-50 border border-gray-200 p-1"
            />
            <div className="text-left hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-gray-900">
                  NESAM
                </span>
                <span className="text-[9px] uppercase font-bold tracking-widest bg-[#E21E26] px-1.5 py-0.5 rounded text-white">
                  DRIVER
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium">
                Drive. Earn. Grow.
              </p>
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-red-50 text-[#E21E26]"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden 2xl:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Status pill */}
            <span
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${
                statusStyles[status] ??
                "bg-gray-100 text-gray-600 border-gray-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  statusDot[status] ?? "bg-gray-400"
                }`}
              />
              {status}
            </span>

            {/* SOS */}
            <button
              onClick={onOpenSOS}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-[#E21E26] border border-red-200 text-xs font-bold transition-colors"
              title="Emergency SOS"
            >
              <AlertTriangle className="w-4 h-4 animate-pulse" />
              <span className="hidden sm:inline">SOS</span>
            </button>

            {/* Wallet */}
            <button
              onClick={() => go("wallet")}
              className={`hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                activeTab === "wallet"
                  ? "bg-[#E21E26] text-white border-[#E21E26]"
                  : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
              }`}
            >
              <Wallet className="w-4 h-4 text-amber-500" />
              <span className="font-bold">
                ₹{walletBalance.toLocaleString("en-IN")}
              </span>
            </button>

            {/* Notifications */}
            <button
              onClick={() => go("notifications")}
              className="relative p-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E21E26] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Profile */}
            <button
              onClick={() => go("profile")}
              className="hidden md:flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors"
            >
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.name}
                  className="w-7 h-7 rounded-full object-cover border border-[#E21E26]"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#E21E26] flex items-center justify-center text-white text-xs font-bold">
                  {(profile.name || "D").charAt(0)}
                </div>
              )}
              <div className="hidden 2xl:block text-left">
                <div className="text-xs font-bold text-gray-900 flex items-center gap-1">
                  {profile.name}
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                  {profile.phone}
                </div>
              </div>
            </button>

            {/* Sign Out (desktop) */}
            <button
              onClick={onLogout}
              className="hidden lg:flex p-2 rounded-lg bg-gray-50 hover:bg-red-50 border border-gray-200 text-gray-500 hover:text-[#E21E26] transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-3">
          {/* Profile row */}
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
            {profile.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={profile.name}
                className="w-10 h-10 rounded-full object-cover border border-[#E21E26]"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#E21E26] flex items-center justify-center text-white text-sm font-bold">
                {(profile.name || "D").charAt(0)}
              </div>
            )}
            <div>
              <div className="text-sm font-bold text-gray-900">
                {profile.name}
              </div>
              <div className="text-[11px] text-gray-400 font-mono">
                {profile.phone}
              </div>
            </div>
          </div>

          {/* Status switcher */}
          <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl">
            {(["Offline", "Online"] as DriverStatus[]).map((st) => {
              const isActive = status === st;
              return (
                <button
                  key={st}
                  onClick={() => { if (status !== st) onStatusChange(st); }}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                    isActive
                      ? st === "Online"
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-600 text-white"
                      : "text-gray-500"
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>

          {/* Nav grid */}
          <div className="grid grid-cols-3 gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-[11px] font-semibold transition-colors ${
                    isActive
                      ? "bg-red-50 text-[#E21E26] border-red-200"
                      : "text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 hover:bg-red-50 border border-gray-200 text-gray-600 hover:text-[#E21E26] text-xs font-bold transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      )}
    </header>
  );
};
