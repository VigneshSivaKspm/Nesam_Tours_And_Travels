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
import SupportTickets from "./pages/SupportTickets";
import Offers from "./pages/Offers";
import Reviews from "./pages/Reviews";
import Settings from "./pages/Settings";

// Pages — New (Enterprise Multi-Vendor)
import Vendors from "./pages/Vendors";
import Marketplace from "./pages/Marketplace";
import LiveTrips from "./pages/LiveTrips";
import Penalties from "./pages/Penalties";
import DriverEarnings from "./pages/DriverEarnings";
import VendorFinance from "./pages/VendorFinance";
import CommissionPolicy from "./pages/CommissionPolicy";
import ReportsAnalytics from "./pages/ReportsAnalytics";
import NotificationsPage from "./pages/NotificationsPage";
import StaffRoles from "./pages/StaffRoles";
import SecurityEvents from "./pages/SecurityEvents";
import LegalDocuments from "./pages/LegalDocuments";
import LegalGate from "./components/LegalGate";
import B2BIntegrations from "./pages/B2BIntegrations";
import { AccessProvider } from "./components/AccessContext";
import { NotificationProvider } from "./components/NotificationHost";
import CreateBookingLauncher from "./components/CreateBookingLauncher";
import { Toast, useToast } from "./components/Feedback";
import { canAccessPage } from "./config/permissions";

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
  commission: {
    title: "Commission Policy",
    breadcrumb: ["Finance", "Commission Policy"],
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
  security: { title: "Security & Audit", breadcrumb: ["System", "Security & Audit"] },
  legal: { title: "Terms, Privacy & Consent", breadcrumb: ["System", "Legal documents"] },
  support: {
    title: "Support Tickets",
    breadcrumb: ["Help & Support", "Support Tickets"],
  },
};

function AdminShell({ session }: { session: AdminSession }) {
  const [activePage, setActivePage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const { toast, show: showToast } = useToast(9000);
  const canCreateBooking = session.access.isSuper || session.access.permissions.includes("operations");

  const currentPage = selectedBookingId ? "booking-detail" : activePage;
  const meta = pageMeta[currentPage] || pageMeta["dashboard"];

  const navigate = (page: string) => {
    setActivePage(page);
    setSelectedBookingId(null);
    setMobileNavOpen(false);
  };

  /** Notification / shortcut targets: a booking opens its details, anything else is a page. */
  const openTarget = (page: string, bookingId?: string) => {
    if (page === "booking-detail" && bookingId) {
      setActivePage("bookings");
      setSelectedBookingId(bookingId);
      setMobileNavOpen(false);
      return;
    }
    navigate(pageMeta[page] ? page : "dashboard");
  };

  const renderPage = () => {
    if (!canAccessPage(session.access, currentPage)) {
      return (
        <div className="p-6">
          <div className="max-w-md mx-auto mt-10 bg-white rounded-2xl border border-[#E5E5E5] p-6 text-center shadow-sm">
            <h2 className="text-[15px] font-bold text-[#111] mb-1">No access to {meta.title}</h2>
            <p className="text-[12px] text-[#666]">
              Your role ({session.access.roleName}) does not include this area. Ask a super admin to change your role in Staff &amp; Roles.
            </p>
          </div>
        </div>
      );
    }
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
        return <Dashboard onNavigate={navigate} onSelectBooking={(id) => setSelectedBookingId(id)} />;
      case "trips":
        return <LiveTrips onOpenBooking={(id) => openTarget("booking-detail", id)} />;

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
      case "commission":
        return <CommissionPolicy />;

      // Compliance
      case "penalties":
        return <Penalties />;
      case "reports":
        return <ReportsAnalytics />;

      // System
      case "b2b":
        return <B2BIntegrations />;
      case "notifications":
        return <NotificationsPage onNavigate={setActivePage} />;
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
      case "offers":
        return <Offers />;
      case "reviews":
        return <Reviews />;
      case "settings":
        return <Settings />;
      case "security":
        return <SecurityEvents onOpenBooking={(id) => openTarget("booking-detail", id)} />;
      case "legal":
        return <LegalDocuments />;
      case "support":
        return <SupportTickets />;

      default:
        return <Dashboard onNavigate={navigate} onSelectBooking={(id) => setSelectedBookingId(id)} />;
    }
  };

  return (
    <AccessProvider value={session.access}>
    <NotificationProvider onOpen={openTarget}>
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
          access={session.access}
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
          onCreateBooking={canCreateBooking ? () => setShowCreate(true) : undefined}
          userName={session.user.displayName}
          userEmail={session.user.email}
          userRole={session.access.roleName}
          onSignOut={signOutAdmin}
        />

        <main className="flex-1 overflow-y-auto min-h-0">{renderPage()}</main>
      </div>
      <Toast toast={toast} />
      {showCreate && (
        <CreateBookingLauncher
          onClose={() => setShowCreate(false)}
          onCreated={(b) => {
            setShowCreate(false);
            showToast(`Booking ${b.bookingId} created and waiting for approval.`);
            openTarget("booking-detail", b.id);
          }}
        />
      )}
    </div>
    </NotificationProvider>
    </AccessProvider>
  );
}

export default function App() {
  const [session, setSession] = useState<AdminSession | null | undefined>(
    undefined,
  );
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

  const isActiveAdmin = session.role === "admin" && session.status === "active";

  if (!isActiveAdmin) {
    const [title, message] =
      session.role === "pending" && session.status === "rejected"
        ? ["Request declined", `Your request for staff access was declined${session.rejectionReason ? `: ${session.rejectionReason}` : "."}`]
        : session.role === "pending"
          ? ["Awaiting approval", "Your staff access request has been received. A super admin will assign your role from Staff & Roles."]
          : session.role === "admin"
            ? ["Account deactivated", "Your staff account is deactivated. Contact a super admin if you need access again."]
            : ["Access not authorized", "This account is not a staff account. Contact the platform team if you believe this is a mistake."];
    return (
      <div
        className="h-screen w-screen flex items-center justify-center px-4"
        style={{ background: "#F5F5F5" }}
      >
        <div className="max-w-sm text-center bg-white rounded-2xl border border-[#E5E5E5] p-8 shadow-sm">
          <h1 className="text-[16px] font-bold text-[#111111] mb-2">
            {title}
          </h1>
          <p className="text-[13px] text-[#666] mb-6">
            {message} ({session.user.email})
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

  return (
    <LegalGate>
      <AdminShell session={session} />
    </LegalGate>
  );
}
