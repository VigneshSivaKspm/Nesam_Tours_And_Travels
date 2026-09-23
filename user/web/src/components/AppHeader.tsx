import React from "react";
import { UserProfile } from "../types";
import { NavTab } from "./BottomNavigation";

interface AppHeaderProps {
  user: UserProfile;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unreadNotificationsCount?: number;
  onOpenNotifications: () => void;
  onOpenSavedPlaces: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  user,
  activeTab,
  onSelectTab,
  unreadNotificationsCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white text-[#111827] border-b border-gray-200 shadow-xs">
      <div className="max-web-width px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => onSelectTab("home")}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <img
            src="/icons/logo.png"
            alt="NESAM Tours & Travels"
            className="w-9 h-9 rounded-lg object-contain shadow-xs"
          />
          <div>
            <div className="text-base font-bold tracking-tight text-[#111827] leading-none">
              NESAM{" "}
              <span className="text-xs font-medium text-gray-500">
                TOURS & TRAVELS
              </span>
            </div>
            <div className="text-[10px] text-gray-400 font-normal mt-0.5">
              Safe Journey, Happy Memories
            </div>
          </div>
        </div>

        {/* Professional Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 h-full">
          {[
            { id: "home" as NavTab, label: "Book Ride" },
            { id: "bookings" as NavTab, label: "My Trips" },
            { id: "trips" as NavTab, label: "Live Tracking" },
            {
              id: "notifications" as NavTab,
              label: "Notifications",
              badge: unreadNotificationsCount,
            },
            { id: "profile" as NavTab, label: "Account" },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`h-full flex items-center gap-1.5 text-sm font-medium transition-colors relative ${
                  isActive
                    ? "text-[#E31E24] font-semibold"
                    : "text-gray-600 hover:text-[#111827]"
                }`}
              >
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="bg-[#E31E24] text-white text-[10px] font-semibold px-1.5 py-0.2 rounded-full">
                    {item.badge}
                  </span>
                ) : null}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E31E24] rounded-t-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Action Items */}
        <div className="flex items-center gap-4">
          <a
            href="tel:8531970197"
            className="hidden sm:flex items-center gap-2 text-xs font-semibold text-gray-700 hover:text-[#E31E24] bg-gray-50 hover:bg-gray-100 px-3.5 py-2 rounded-lg border border-gray-200 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5 text-[#E31E24]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            <span>8531970197</span>
          </a>

          <div
            onClick={() => onSelectTab("profile")}
            className="flex items-center gap-2.5 cursor-pointer group"
            title="Account Profile"
          >
            <img
              src={user.photoUrl}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover border border-gray-200 group-hover:border-[#E31E24] transition-colors"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
