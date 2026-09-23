import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import {
  subscribeToAdminSession,
  signOutAdmin,
  type AdminSession,
} from "./services/authService";

// Pages — Existing
import Dashboard from "./pages/Dashboard";
import Bookings from "./pages/Bookings";
import BookingDetails from "./pages/BookingDetails";
import Customers from "./pages/Customers";
import Drivers from "./pages/Drivers";
import Vehicles from "./pages/Vehicles";
import VehicleCategories from "./pages/VehicleCategories";
import Payments from "./pages/Payments";
import Invoices from "./pages/Invoices";
import Services from "./pages/Services";
import TourPackages from "./pages/TourPackages";
import Locations from "./pages/Locations";
import Pricing from "./pages/Pricing";
import Offers from "./pages/Offers";
import Reviews from "./pages/Reviews";
import Settings from "./pages/Settings";
import GenericPage from "./pages/GenericPage";

// Pages — New (Enterprise Multi-Vendor)
import Vendors from "./pages/Vendors";
import Marketplace from "./pages/Marketplace";
import LiveTrips from "./pages/LiveTrips";
import Penalties from "./pages/Penalties";
import DriverEarnings from "./pages/DriverEarnings";
import VendorFinance from "./pages/VendorFinance";
import ReportsAnalytics from "./pages/ReportsAnalytics";
import NotificationsPage from "./pages/NotificationsPage";
import StaffRoles from "./pages/StaffRoles";
import B2BIntegrations from "./pages/B2BIntegrations";

const pageMeta: Record<string, { title: string; breadcrumb: string[] }> = {
  dashboard: { title: "Dashboard", breadcrumb: ["Dashboard"] },
  bookings: { title: "All Bookings", breadcrumb: ["Bookings"] },
  "booking-detail": {
    title: "Booking Details",
    breadcrumb: ["Bookings", "Details"],
  },
  trips: { title: "Live Trips", breadcrumb: ["Bookings", "Live Trips"] },
  marketplace: {
    title: "Open Trip Marketplace",
    breadcrumb: ["Bookings", "Marketplace"],
  },
  customers: { title: "Customers", breadcrumb: ["People", "Customers"] },
  vendors: { title: "Vendor Management", breadcrumb: ["People", "Vendors"] },
  drivers: { title: "Drivers", breadcrumb: ["People", "Drivers"] },
  vehicles: { title: "Vehicles", breadcrumb: ["Fleet", "Vehicles"] },
  categories: {
    title: "Vehicle Categories",
    breadcrumb: ["Fleet", "Categories"],
  },
  services: { title: "Services", breadcrumb: ["Content", "Services"] },
  packages: {
    title: "Tour Packages",
    breadcrumb: ["Content", "Tour Packages"],
  },
  locations: { title: "Locations", breadcrumb: ["Content", "Locations"] },
  pricing: {
    title: "Pricing & Fare Management",
    breadcrumb: ["Content", "Pricing & Fare"],
  },
  offers: {
    title: "Offers & Coupons",
    breadcrumb: ["Content", "Offers & Coupons"],
  },
  payments: { title: "Payments", breadcrumb: ["Finance", "Payments"] },
  invoices: { title: "Invoices", breadcrumb: ["Finance", "Invoices"] },
  earnings: {
    title: "Driver Earnings & TDS",
    breadcrumb: ["Finance", "Driver Earnings"],
  },
  "vendor-finance": {
    title: "Vendor Finance & GST",
    breadcrumb: ["Finance", "Vendor Finance"],
  },
  penalties: {
    title: "Penalties & Disputes",
    breadcrumb: ["Compliance", "Penalties"],
  },
  reports: {
    title: "Reports & Analytics",
    breadcrumb: ["Compliance", "Reports"],
  },
  b2b: {
    title: "Corporate & B2B Integrations",
    breadcrumb: ["System", "B2B Integrations"],
  },
  notifications: {
    title: "Notifications",
    breadcrumb: ["System", "Notifications"],
  },
  reviews: { title: "Reviews & Ratings", breadcrumb: ["System", "Reviews"] },
  staff: { title: "Staff & Roles", breadcrumb: ["System", "Staff & Roles"] },
  settings: { title: "Settings", breadcrumb: ["System", "Settings"] },
};

// Generic placeholder pages (content pages not yet built)
const genericPages: Record<string, { desc: string; icon: string }> = {
  categories: {
    desc: "Manage vehicle categories including Sedan, SUV, Innova, Tempo Traveller and configure fare rules per category.",
    icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z",
  },
  services: {
    desc: "Configure Airport Taxi, Outstation Cab, One Way Taxi, Local Rental, Corporate and Recurring services.",
    icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01",
  },
  offers: {
    desc: "Create discount codes and promotional coupons with usage limits, expiry dates and service restrictions.",
    icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z",
  },
  invoices: {
    desc: "View, download and manage GST-compliant tax invoices for all completed bookings. Auto-generate customer receipts.",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
};

function AdminShell({ session }: { session: AdminSession }) {
  const [activePage, setActivePage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const currentPage = selectedBookingId ? "booking-detail" : activePage;
  const meta = pageMeta[currentPage] || pageMeta["dashboard"];

  const navigate = (page: string) => {
    setActivePage(page);
    setSelectedBookingId(null);
    setMobileNavOpen(false);
  };

  const renderPage = () => {
    if (selectedBookingId) {
      return (
        <BookingDetails
          bookingId={selectedBookingId}
          onBack={() => setSelectedBookingId(null)}
        />
      );
    }

    switch (activePage) {
      // Overview
      case "dashboard":
        return <Dashboard onNavigate={navigate} />;
      case "trips":
        return <LiveTrips />;

      // Bookings
      case "bookings":
        return <Bookings onSelectBooking={(id) => setSelectedBookingId(id)} />;
      case "marketplace":
        return <Marketplace />;

      // People
      case "customers":
        return <Customers />;
      case "vendors":
        return <Vendors />;
      case "drivers":
        return <Drivers />;

      // Fleet
      case "vehicles":
        return <Vehicles />;
      case "categories":
        return <VehicleCategories />;

      // Finance
      case "payments":
        return <Payments />;
      case "invoices":
        return <Invoices />;
      case "earnings":
        return <DriverEarnings />;
      case "vendor-finance":
        return <VendorFinance />;

      // Compliance
      case "penalties":
        return <Penalties />;
      case "reports":
        return <ReportsAnalytics />;

      // System
      case "b2b":
        return <B2BIntegrations />;
      case "notifications":
        return <NotificationsPage />;
      case "staff":
        return <StaffRoles />;
      case "services":
        return <Services />;
      case "packages":
        return <TourPackages />;
      case "locations":
        return <Locations />;
      case "pricing":
        return <Pricing />;
      case "reviews":
        return <Reviews />;
      case "settings":
        return <Settings />;

      // Generic placeholder pages
      default:
        const gp = genericPages[activePage];
        if (gp) {
          return (
            <GenericPage
              title={meta.title}
              description={gp.desc}
              icon={gp.icon}
            />
          );
        }
        return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div
      className="h-screen flex overflow-hidden"
      style={{ background: "#F5F5F5" }}
    >
      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`lg:relative fixed z-40 h-screen transition-transform duration-300 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <Sidebar
          activePage={activePage}
          onNavigate={navigate}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          userName={session.user.displayName}
          userEmail={session.user.email}
        />
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300 ${collapsed ? "lg:ml-[68px]" : "lg:ml-[240px]"}`}
      >
        {/* Mobile hamburger */}
        <div className="lg:hidden fixed top-0 left-0 z-20 p-3">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="w-10 h-10 bg-white rounded-lg shadow flex items-center justify-center border border-[#E5E5E5]"
          >
            <svg
              className="w-5 h-5 text-[#111]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        <Header
          title={meta.title}
          breadcrumb={meta.breadcrumb}
          onNavigate={navigate}
          userName={session.user.displayName}
          userEmail={session.user.email}
          userRole={session.role}
          onSignOut={signOutAdmin}
        />

        <main className="flex-1 overflow-y-auto min-h-0">{renderPage()}</main>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<AdminSession | null | undefined>(undefined);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    return subscribeToAdminSession(setSession);
  }, []);

  if (session === undefined) {
    return (
      <div
        className="h-screen w-screen flex items-center justify-center"
        style={{ background: "#F5F5F5" }}
      >
        <div className="text-[13px] text-[#999]">Loading…</div>
      </div>
    );
  }

  if (session === null) {
    if (authMode === "signup") {
      return <Signup onBackToLogin={() => setAuthMode("signin")} />;
    }
    return <Login onSignUp={() => setAuthMode("signup")} />;
  }

  if (session.role !== "admin") {
    return (
      <div
        className="h-screen w-screen flex items-center justify-center px-4"
        style={{ background: "#F5F5F5" }}
      >
        <div className="max-w-sm text-center bg-white rounded-2xl border border-[#E5E5E5] p-8 shadow-sm">
          <h1 className="text-[16px] font-bold text-[#111111] mb-2">
            Access Not Authorized
          </h1>
          <p className="text-[13px] text-[#666] mb-6">
            This account ({session.user.email}) is signed in but does not have
            Super Admin access. Contact the platform team if you believe this
            is a mistake.
          </p>
          <button
            onClick={() => signOutAdmin()}
            className="px-4 py-2 text-[13px] font-semibold text-white rounded-lg hover:opacity-90 active:scale-95 transition-all"
            style={{ background: "#E21B23" }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <AdminShell session={session} />;
}
