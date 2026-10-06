import React, { useState, useEffect } from "react";
import type {
  VendorProfile,
  VendorRecord,
  FleetVehicle,
  FleetDriver,
  OpenTrip,
  BidProposal,
  VendorTrip,
  WalletDetails,
  PayoutRequest,
  TransactionRecord,
} from "./types";

import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { VendorLoginScreen } from "./screens/VendorLoginScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { FleetScreen } from "./screens/FleetScreen";
import { DriverManagementScreen } from "./screens/DriverManagementScreen";
import { MarketplaceBiddingScreen } from "./screens/MarketplaceBiddingScreen";
import { TripAssignmentScreen } from "./screens/TripAssignmentScreen";
import { WalletPayoutScreen } from "./screens/WalletPayoutScreen";
import { DocumentsVerificationScreen } from "./screens/DocumentsVerificationScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { NotificationPopups } from "./components/NotificationPopups";
import { PenaltyAckModal } from "./components/PenaltyAckModal";
import { LegalGate } from "./components/LegalGate";
import type { PartnerNotification, PartnerPenalty } from "./notificationTypes";
import { markNotificationRead, subscribeToVendorNotifications, subscribeToVendorPenalties } from "./services/partnerNotifications";

const pageMeta: Record<string, { title: string; breadcrumb: string[] }> = {
  dashboard: {
    title: "Overview Dashboard",
    breadcrumb: ["Overview", "Dashboard"],
  },
  trips: {
    title: "Active Trips Dispatch",
    breadcrumb: ["Overview", "Live Trips"],
  },
  fleet: {
    title: "Vehicle Fleet Management",
    breadcrumb: ["Fleet", "Vehicles"],
  },
  drivers: { title: "Driver Management", breadcrumb: ["Fleet", "Drivers"] },
  marketplace: {
    title: "Open Trip Marketplace & Bidding",
    breadcrumb: ["Marketplace", "Open Trips"],
  },
  wallet: {
    title: "Fleet Wallet & Payouts",
    breadcrumb: ["Finance", "Wallet & Payouts"],
  },
  documents: {
    title: "Business Verification & Documents",
    breadcrumb: ["Compliance", "KYC Verification"],
  },
  notifications: {
    title: "Notifications & Penalties",
    breadcrumb: ["Overview", "Notifications"],
  },
};

import {
  acceptOfferedRate,
  assignTripInFirestore,
  createVehicle,
  describeActionError,
  inviteDriverByVendor,
  pairVehicleDriver,
  requestVendorPayout,
  setDriverSuspended,
  setVehicleStatus,
  submitBidToFirestore,
  subscribeToFleetDrivers,
  subscribeToFleetVehicles,
  subscribeToOpenMarketplaceTrips,
  subscribeToVehicleCategories,
  subscribeToVendorActiveTrips,
  subscribeToVendorBids,
  subscribeToVendorLedger,
  subscribeToVendorPayouts,
  subscribeToVendorWallet,
  type NewVehicle,
  type VehicleCategoryOption,
} from "./services/vendorFirestoreService";
import { EMPTY_WALLET } from "./services/vendorMappers";
import type { User } from "firebase/auth";
import {
  subscribeToAuthUser,
  signOutUser,
  getAuthIntent,
  setAuthIntent,
  resetRecaptchaVerifier,
} from "./services/authService";
import {
  subscribeToVendor,
  type VendorSnapshot,
} from "./services/onboardingService";
import { describeDataError } from "./utils/retry";
import { OnboardingWizard } from "./screens/onboarding/OnboardingWizard";
import { AccountStatusScreen } from "./screens/AccountStatusScreen";
import { Button, FullScreenLoader } from "./components/onboarding/ui";

async function handleSignOut() {
  setAuthIntent(null);
  resetRecaptchaVerifier();
  try {
    await signOutUser();
  } catch (error) {
    console.warn("Sign out failed:", error);
  }
}

/**
 * Gatekeeper. Routing is driven entirely by two live listeners:
 *   Firebase Auth user  →  vendors/{uid} snapshot  →  screen for its status.
 * When an admin approves the vendor, the snapshot fires and the dashboard
 * mounts immediately — no refresh needed.
 */
export function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  // undefined = still loading, null = no vendors/{uid} doc yet
  const [vendor, setVendor] = useState<VendorSnapshot | null | undefined>(
    undefined,
  );
  const [vendorError, setVendorError] = useState("");
  const [listenerKey, setListenerKey] = useState(0);
  const [reapplying, setReapplying] = useState(false);

  useEffect(() => {
    return subscribeToAuthUser((fbUser) => {
      setUser(fbUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    setVendor(undefined);
    setVendorError("");
    setReapplying(false);
    if (!user) return undefined;
    return subscribeToVendor(
      user.uid,
      (snap) => {
        setVendor(snap);
        setVendorError("");
      },
      (error) => setVendorError(describeDataError(error)),
    );
  }, [user?.uid, listenerKey]);

  const status = vendor?.record.status;
  // Leave "reapply" mode once the vendor resubmits or the admin acts.
  useEffect(() => {
    if (status !== "REJECTED") setReapplying(false);
  }, [status]);

  if (authLoading) return <FullScreenLoader />;
  if (!user) return <VendorLoginScreen />;

  if (vendorError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "#F5F5F5" }}
      >
        <div className="max-w-sm w-full bg-white rounded-2xl border border-[#E5E5E5] p-6 text-center shadow-sm">
          <h1 className="text-[16px] font-bold text-[#111] mb-2">
            Couldn't load your account
          </h1>
          <p className="text-[13px] text-[#666] mb-5">{vendorError}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="secondary" onClick={handleSignOut}>
              Sign out
            </Button>
            <Button onClick={() => setListenerKey((k) => k + 1)}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (vendor === undefined)
    return <FullScreenLoader label="Loading your account…" />;

  const phone = user.phoneNumber || vendor?.record.phone || "";

  if (
    !vendor ||
    status === "INCOMPLETE" ||
    status === "CHANGES_REQUESTED" ||
    (status === "REJECTED" && reapplying)
  ) {
    const notice =
      !vendor && getAuthIntent() === "login"
        ? `No vendor account is registered to ${phone} yet. Complete the steps below to apply.`
        : undefined;
    return (
      <OnboardingWizard
        key={user.uid}
        record={vendor?.record ?? null}
        phone={phone}
        notice={notice}
        onSignOut={handleSignOut}
      />
    );
  }

  if (status !== "APPROVED") {
    return (
      <AccountStatusScreen
        record={vendor.record}
        onSignOut={handleSignOut}
        onReapply={
          status === "REJECTED" ? () => setReapplying(true) : undefined
        }
      />
    );
  }

  return (
    <LegalGate role="vendor">
      <VendorDashboard profile={vendor.profile} record={vendor.record} />
    </LegalGate>
  );
}

function VendorDashboard({
  profile,
  record,
}: {
  profile: VendorProfile;
  record: VendorRecord;
}) {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);

  // Live Firestore data only — nothing here is simulated or kept locally.
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [categories, setCategories] = useState<VehicleCategoryOption[]>([]);
  const [openTrips, setOpenTrips] = useState<OpenTrip[]>([]);
  const [bids, setBids] = useState<BidProposal[]>([]);
  const [activeTrips, setActiveTrips] = useState<VendorTrip[]>([]);
  const [wallet, setWallet] = useState<WalletDetails>(EMPTY_WALLET);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [notifications, setNotifications] = useState<PartnerNotification[]>([]);
  const [penalties, setPenalties] = useState<PartnerPenalty[]>([]);
  const [penaltiesError, setPenaltiesError] = useState("");
  const [ackPenaltyId, setAckPenaltyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  // Firestore Subscriptions — mounted only for APPROVED vendors.
  useEffect(() => {
    const vendorId = profile.id;
    setLoadError("");
    const unsubs = [
      subscribeToOpenMarketplaceTrips(setOpenTrips, setLoadError),
      subscribeToVendorBids(vendorId, setBids, setLoadError),
      subscribeToFleetVehicles(vendorId, setVehicles, setLoadError),
      subscribeToFleetDrivers(vendorId, setDrivers, setLoadError),
      subscribeToVehicleCategories(setCategories, setLoadError),
      subscribeToVendorActiveTrips(vendorId, setActiveTrips, setLoadError),
      subscribeToVendorPayouts(vendorId, setPayoutRequests, setLoadError),
      subscribeToVendorWallet(vendorId, setWallet, setLoadError),
      subscribeToVendorLedger(vendorId, setTransactions, setLoadError),
      subscribeToVendorNotifications(vendorId, setNotifications),
      subscribeToVendorPenalties(vendorId, (p) => { setPenalties(p); setPenaltiesError(""); }, setPenaltiesError),
    ];
    return () => unsubs.forEach((u) => u());
  }, [profile.id, retryKey]);

  const navigate = (tab: string) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  // A penalty must be acknowledged (or disputed) before the vendor carries on.
  const mustAcknowledge = penalties.find((p) => p.status === "Pending" && !p.acknowledged) ?? null;
  const penaltyToShow = penalties.find((p) => p.id === ackPenaltyId && (p.status === "Pending" || p.status === "Acknowledged")) ?? mustAcknowledge;
  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const meta = pageMeta[activeTab] || pageMeta["dashboard"];
  const vendorName = profile.companyName;

  // Every action awaits Firestore / the server and reports a real failure.
  const run = async (work: () => Promise<unknown>, fallback: string) => {
    try {
      await work();
    } catch (e) {
      throw new Error(describeActionError(e, fallback));
    }
  };

  // Fleet Handlers
  const handleAddVehicle = (v: NewVehicle) =>
    run(() => createVehicle(profile.id, v), "The vehicle was not saved. Please retry.");
  const handleUpdateVehicleStatus = (vehicleId: string, status: FleetVehicle["status"]) =>
    run(() => setVehicleStatus(vehicleId, status), "The vehicle status was not changed. Please retry.");
  const handlePairDriver = (vehicleId: string, driverId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return Promise.reject(new Error("This vehicle is no longer in your fleet."));
    const driver = driverId ? drivers.find((d) => d.id === driverId) ?? null : null;
    return run(() => pairVehicleDriver(vehicle, driver, vehicles), "The driver was not paired. Please retry.");
  };
  const handleInviteDriver = (phone: string, vehicleNumber: string) =>
    run(() => inviteDriverByVendor(phone, profile.id, vendorName, vehicleNumber), "The invitation was not saved. Please retry.");
  const handleSetDriverSuspended = (driverId: string, suspended: boolean) =>
    run(() => setDriverSuspended(driverId, suspended), "The driver status was not changed. Please retry.");

  // Marketplace & Bidding Handlers
  const handleAcceptOfferedRate = async (trip: OpenTrip) => {
    await run(() => acceptOfferedRate(trip.id, profile.id, vendorName), "Could not accept this trip. Please retry.");
    setActiveTab("trips");
  };
  const handleSubmitCounterBid = (trip: OpenTrip, counterRate: number, note: string) =>
    run(() => submitBidToFirestore(trip, counterRate, note, profile.id, vendorName), "The bid was not submitted. Please retry.");

  // Dispatch Assignment
  const handleAssignDriverAndVehicle = (tripId: string, driverId: string, vehicleId: string) => {
    const driver = drivers.find((d) => d.id === driverId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!driver || !vehicle) return Promise.reject(new Error("Choose a driver and a vehicle from your fleet."));
    return run(() => assignTripInFirestore(tripId, driver, vehicle), "The trip was not dispatched. Please retry.");
  };

  // Wallet Payout Request
  const handleRequestPayout = (amount: number, method: "UPI" | "Bank Transfer") =>
    run(() => requestVendorPayout(`VPO-${crypto.randomUUID()}`, amount, method), "Payout request failed. Please retry.");

  return (
    <div
      className="h-screen flex overflow-hidden font-sans antialiased"
      style={{ background: "#F5F5F5" }}
    >
      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Fixed Collapsible Sidebar */}
      <div
        className={`lg:relative fixed z-40 h-screen transition-transform duration-300 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <Sidebar
          activeTab={activeTab}
          setActiveTab={navigate}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          openTripsCount={openTrips.length}
          activeTripsCount={activeTrips.length}
          vehiclesCount={vehicles.length}
          driversCount={drivers.length}
          profile={profile}
        />
      </div>

      {/* Main Workspace */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300 ${
          collapsed ? "lg:ml-[68px]" : "lg:ml-[240px]"
        }`}
      >
        {/* Mobile Hamburger Header */}
        <div className="lg:hidden fixed top-3 left-3 z-20">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center border border-[#E5E5E5] text-[#111]"
          >
            <svg
              className="w-5 h-5"
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

        {/* Professional Clean White Header */}
        <Header
          title={meta.title}
          breadcrumb={meta.breadcrumb}
          activeTab={activeTab}
          onNavigate={navigate}
          wallet={wallet}
          profile={profile}
          pendingBidsCount={bids.filter((b) => b.status === "Pending Review").length}
          unreadNotifications={unreadNotifications}
        />

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 lg:p-8">
          {loadError && (
            <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center justify-between gap-3">
              <span>{loadError}</span>
              <button type="button" className="underline shrink-0" onClick={() => setRetryKey((k) => k + 1)}>
                Retry
              </button>
            </div>
          )}

          {activeTab === "dashboard" && (
            <DashboardScreen
              profile={profile}
              vehicles={vehicles}
              drivers={drivers}
              openTrips={openTrips}
              activeTrips={activeTrips}
              wallet={wallet}
              onNavigate={navigate}
            />
          )}

          {activeTab === "fleet" && (
            <FleetScreen
              vehicles={vehicles}
              drivers={drivers}
              categories={categories}
              onAddVehicle={handleAddVehicle}
              onUpdateVehicleStatus={handleUpdateVehicleStatus}
              onPairDriver={handlePairDriver}
            />
          )}

          {activeTab === "drivers" && (
            <DriverManagementScreen
              drivers={drivers}
              vehicles={vehicles}
              onInviteDriver={handleInviteDriver}
              onSetSuspended={handleSetDriverSuspended}
            />
          )}

          {activeTab === "marketplace" && (
            <MarketplaceBiddingScreen
              openTrips={openTrips}
              bidProposals={bids}
              onAcceptOfferedRate={handleAcceptOfferedRate}
              onSubmitCounterBid={handleSubmitCounterBid}
            />
          )}

          {activeTab === "trips" && (
            <TripAssignmentScreen
              activeTrips={activeTrips}
              drivers={drivers}
              vehicles={vehicles}
              onAssignDriverAndVehicle={handleAssignDriverAndVehicle}
            />
          )}

          {activeTab === "wallet" && (
            <WalletPayoutScreen
              profile={profile}
              wallet={wallet}
              payoutRequests={payoutRequests}
              transactions={transactions}
              onRequestPayout={handleRequestPayout}
            />
          )}

          {activeTab === "documents" && (
            <DocumentsVerificationScreen record={record} />
          )}

          {activeTab === "notifications" && (
            <NotificationsScreen
              notifications={notifications}
              penalties={penalties}
              penaltiesError={penaltiesError}
              onMarkRead={(id) => markNotificationRead(id).catch(() => undefined)}
              onOpenPenalty={(p) => setAckPenaltyId(p.id)}
            />
          )}
        </main>
      </div>

      {notice && (
        <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xl" onAnimationEnd={() => setNotice("")}>
          {notice}
        </div>
      )}
      <NotificationPopups
        notifications={notifications}
        onOpen={(n) => {
          markNotificationRead(n.id).catch(() => undefined);
          const page = n.category === "penalties" ? "notifications" : ["marketplace", "trips", "wallet", "documents", "dashboard"].includes(n.ctaPage) ? n.ctaPage : n.category === "bookings" ? "marketplace" : "notifications";
          navigate(page);
        }}
      />
      {penaltyToShow && (
        <PenaltyAckModal
          key={penaltyToShow.id}
          penalty={penaltyToShow}
          onDone={(m) => {
            setAckPenaltyId(null);
            setNotice(m);
            setTimeout(() => setNotice(""), 4000);
          }}
        />
      )}
    </div>
  );
}

export default App;
