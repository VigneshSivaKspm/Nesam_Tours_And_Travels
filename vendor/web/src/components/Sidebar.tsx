import React from "react";
import { VendorProfile } from "../types";
import {
  LayoutDashboard,
  Car,
  Users,
  Gavel,
  Navigation,
  Wallet,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  openTripsCount: number;
  activeTripsCount: number;
  vehiclesCount: number;
  driversCount: number;
  profile: VendorProfile;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  onToggleCollapse,
  openTripsCount,
  activeTripsCount,
  vehiclesCount,
  driversCount,
  profile,
}) => {
  const navGroups: NavGroup[] = [
    {
      label: "Overview",
      items: [
        { id: "dashboard", label: "Overview Dashboard", icon: LayoutDashboard },
        {
          id: "trips",
          label: "Live Trips Dispatch",
          icon: Navigation,
          badge: activeTripsCount > 0 ? `${activeTripsCount}` : undefined,
          badgeColor: "#E21B23",
        },
      ],
    },
    {
      label: "Fleet & Crew",
      items: [
        {
          id: "fleet",
          label: "Vehicle Fleet",
          icon: Car,
          badge: vehiclesCount > 0 ? `${vehiclesCount}` : undefined,
        },
        {
          id: "drivers",
          label: "Driver Management",
          icon: Users,
          badge: driversCount > 0 ? `${driversCount}` : undefined,
        },
      ],
    },
    {
      label: "Marketplace",
      items: [
        {
          id: "marketplace",
          label: "Open Trip Feed & Bids",
          icon: Gavel,
          badge: openTripsCount > 0 ? `${openTripsCount} Open` : undefined,
          badgeColor: "#F59E0B",
        },
      ],
    },
    {
      label: "Finance & Compliance",
      items: [
        { id: "wallet", label: "Wallet & Payouts", icon: Wallet },
        {
          id: "documents",
          label: "Business Verification",
          icon: ShieldCheck,
          badge:
            profile.verificationStatus === "Approved"
              ? "Verified"
              : profile.verificationStatus,
          badgeColor:
            profile.verificationStatus === "Approved" ? "#10B981" : "#F59E0B",
        },
      ],
    },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 h-screen flex flex-col z-40 transition-all duration-300 ease-in-out select-none border-r border-white/10 ${
        collapsed ? "w-[68px]" : "w-[240px]"
      }`}
      style={{ background: "#111111" }}
    >
      {/* Sidebar Top Brand Header */}
      <div className="flex items-center h-16 px-4 border-b border-white/10 shrink-0 justify-between">
        <div
          className="flex items-center gap-3 min-w-0 cursor-pointer"
          onClick={() => setActiveTab("dashboard")}
        >
          <img
            src="/icons/logo.png"
            alt="NESAM Fleet - Vendor Partner"
            className="shrink-0 w-9 h-9 rounded-lg object-contain bg-white/10 p-1 shadow-md"
          />
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-white font-bold text-[13px] leading-tight tracking-wide truncate">
                NESAM FLEET
              </div>
              <div className="text-white/40 text-[9px] font-semibold leading-tight tracking-widest uppercase truncate">
                VENDOR PORTAL
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className="shrink-0 p-1 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 custom-scrollbar">
        {navGroups.map((group) => (
          <div key={group.label}>
            {/* Group Header */}
            {!collapsed && (
              <div className="px-3 pt-3 pb-1 text-[9px] font-bold text-white/30 uppercase tracking-widest">
                {group.label}
              </div>
            )}
            {collapsed && <div className="h-px bg-white/10 mx-2 my-2" />}

            {/* Group Items */}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left group relative transition-all ${
                    isActive
                      ? "text-white font-semibold shadow-sm"
                      : "text-white/60 hover:text-white hover:bg-white/5 font-medium"
                  }`}
                  style={isActive ? { background: "#E21B23" } : {}}
                >
                  <Icon
                    className={`shrink-0 w-[17px] h-[17px] transition-transform group-hover:scale-110 ${
                      isActive
                        ? "text-white"
                        : "text-white/60 group-hover:text-white"
                    }`}
                  />

                  {!collapsed && (
                    <span className="text-[12px] truncate flex-1">
                      {item.label}
                    </span>
                  )}

                  {!collapsed && item.badge && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0"
                      style={{
                        background: isActive
                          ? "rgba(255,255,255,0.25)"
                          : item.badgeColor || "#E21B23",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}

                  {collapsed && item.badge && (
                    <div
                      className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full"
                      style={{ background: item.badgeColor || "#E21B23" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom Vendor Business Card */}
      <div className="shrink-0 border-t border-white/10 p-3 bg-black/20">
        <div
          className="flex items-center gap-3 cursor-pointer p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          onClick={() => setActiveTab("documents")}
        >
          <div
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow"
            style={{ background: "#E21B23" }}
          >
            {profile.companyName.substring(0, 2).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-white text-[12px] font-semibold truncate">
                {profile.companyName}
              </div>
              <div className="text-white/40 text-[10px] font-mono truncate">
                GST: {profile.gstin}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
