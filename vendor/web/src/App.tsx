import React, { useState, useEffect } from 'react';
import {
  VendorProfile,
  VendorRecord,
  FleetVehicle,
  FleetDriver,
  OpenTrip,
  BidProposal,
  VendorTrip,
  WalletDetails,
  PayoutRequest,
  TransactionRecord
} from './types';
import {
  DEFAULT_WALLET
} from './config/constants';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { VendorLoginScreen } from './screens/VendorLoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { FleetScreen } from './screens/FleetScreen';
import { DriverManagementScreen } from './screens/DriverManagementScreen';
import { MarketplaceBiddingScreen } from './screens/MarketplaceBiddingScreen';
import { TripAssignmentScreen } from './screens/TripAssignmentScreen';
import { WalletPayoutScreen } from './screens/WalletPayoutScreen';
import { DocumentsVerificationScreen } from './screens/DocumentsVerificationScreen';

const pageMeta: Record<string, { title: string; breadcrumb: string[] }> = {
  dashboard: { title: 'Overview Dashboard', breadcrumb: ['Overview', 'Dashboard'] },
  trips: { title: 'Active Trips Dispatch', breadcrumb: ['Overview', 'Live Trips'] },
  fleet: { title: 'Vehicle Fleet Management', breadcrumb: ['Fleet', 'Vehicles'] },
  drivers: { title: 'Driver Management', breadcrumb: ['Fleet', 'Drivers'] },
  marketplace: { title: 'Open Trip Marketplace & Bidding', breadcrumb: ['Marketplace', 'Open Trips'] },
  wallet: { title: 'Fleet Wallet & Payouts', breadcrumb: ['Finance', 'Wallet & Payouts'] },
  documents: { title: 'Business Verification & Documents', breadcrumb: ['Compliance', 'KYC Verification'] }
};

import {
  saveVehicleToFirestore,
  inviteDriverByVendor,
  subscribeToOpenMarketplaceTrips,
  subscribeToFleetVehicles,
  subscribeToFleetDrivers,
  submitBidToFirestore,
  assignTripInFirestore,
  submitPayoutRequestToFirestore,
  subscribeToVendorActiveTrips,
  subscribeToVendorPayouts
} from './services/vendorFirestoreService';
import type { User } from 'firebase/auth';
import {
  subscribeToAuthUser,
  signOutUser,
  getAuthIntent,
  setAuthIntent,
  resetRecaptchaVerifier,
} from './services/authService';
import { subscribeToVendor, type VendorSnapshot } from './services/onboardingService';
import { describeDataError } from './utils/retry';
import { OnboardingWizard } from './screens/onboarding/OnboardingWizard';
import { AccountStatusScreen } from './screens/AccountStatusScreen';
import { Button, FullScreenLoader } from './components/onboarding/ui';

async function handleSignOut() {
  setAuthIntent(null);
  resetRecaptchaVerifier();
  try {
    await signOutUser();
  } catch (error) {
    console.warn('Sign out failed:', error);
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
  const [vendor, setVendor] = useState<VendorSnapshot | null | undefined>(undefined);
  const [vendorError, setVendorError] = useState('');
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
    setVendorError('');
    setReapplying(false);
    if (!user) return undefined;
    return subscribeToVendor(
      user.uid,
      (snap) => {
        setVendor(snap);
        setVendorError('');
      },
      (error) => setVendorError(describeDataError(error)),
    );
  }, [user?.uid, listenerKey]);

  const status = vendor?.record.status;
  // Leave "reapply" mode once the vendor resubmits or the admin acts.
  useEffect(() => {
    if (status !== 'REJECTED') setReapplying(false);
  }, [status]);

  if (authLoading) return <FullScreenLoader />;
  if (!user) return <VendorLoginScreen />;

  if (vendorError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F5F5F5' }}>
        <div className="max-w-sm w-full bg-white rounded-2xl border border-[#E5E5E5] p-6 text-center shadow-sm">
          <h1 className="text-[16px] font-bold text-[#111] mb-2">Couldn't load your account</h1>
          <p className="text-[13px] text-[#666] mb-5">{vendorError}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="secondary" onClick={handleSignOut}>Sign out</Button>
            <Button onClick={() => setListenerKey((k) => k + 1)}>Try again</Button>
          </div>
        </div>
      </div>
    );
  }

  if (vendor === undefined) return <FullScreenLoader label="Loading your account…" />;

  const phone = user.phoneNumber || vendor?.record.phone || '';

  if (!vendor || status === 'INCOMPLETE' || status === 'CHANGES_REQUESTED' || (status === 'REJECTED' && reapplying)) {
    const notice =
      !vendor && getAuthIntent() === 'login'
        ? `No vendor account is registered to ${phone} yet. Complete the steps below to apply.`
        : undefined;
    return <OnboardingWizard key={user.uid} record={vendor?.record ?? null} phone={phone} notice={notice} onSignOut={handleSignOut} />;
  }

  if (status !== 'APPROVED') {
    return (
      <AccountStatusScreen
        record={vendor.record}
        onSignOut={handleSignOut}
        onReapply={status === 'REJECTED' ? () => setReapplying(true) : undefined}
      />
    );
  }

  return <VendorDashboard profile={vendor.profile} record={vendor.record} />;
}

function VendorDashboard({ profile, record }: { profile: VendorProfile; record: VendorRecord }) {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);

  // State Stores
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [openTrips, setOpenTrips] = useState<OpenTrip[]>([]);
  const [bidProposals, setBidProposals] = useState<BidProposal[]>([]);
  const [activeTrips, setActiveTrips] = useState<VendorTrip[]>([]);
  const [wallet, setWallet] = useState<WalletDetails>(DEFAULT_WALLET);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  // Firestore Subscriptions — mounted only for APPROVED vendors.
  useEffect(() => {
    const vendorId = profile.id;

    const unsubMarketplace = subscribeToOpenMarketplaceTrips((liveTrips) => {
      setOpenTrips(liveTrips);
    });

    const unsubVehicles = subscribeToFleetVehicles(vendorId, (liveVehicles) => {
      setVehicles(liveVehicles);
    });

    const unsubDrivers = subscribeToFleetDrivers(vendorId, (liveDrivers) => {
      setDrivers(liveDrivers);
    });

    const unsubActiveTrips = subscribeToVendorActiveTrips(vendorId, (liveActiveTrips) => {
      setActiveTrips(liveActiveTrips);
    });

    const unsubPayouts = subscribeToVendorPayouts(vendorId, (livePayouts) => {
      setPayoutRequests(livePayouts);
    });

    return () => {
      unsubMarketplace();
      unsubVehicles();
      unsubDrivers();
      unsubActiveTrips();
      unsubPayouts();
    };
  }, [profile.id]);

  const navigate = (tab: string) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  const meta = pageMeta[activeTab] || pageMeta['dashboard'];

  // Fleet Handlers
  const handleAddVehicle = (newVehicle: FleetVehicle) => {
    setVehicles([newVehicle, ...vehicles]);
    saveVehicleToFirestore(newVehicle, profile.id);
  };

  const handleUpdateVehicleStatus = (vehicleId: string, status: FleetVehicle['status']) => {
    setVehicles(prev => prev.map(v => {
      if (v.id === vehicleId) {
        const updated = { ...v, status };
        saveVehicleToFirestore(updated, profile.id);
        return updated;
      }
      return v;
    }));
  };

  const handleAssignDriver = (vehicleId: string, driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    setVehicles(prev => prev.map(v => {
      if (v.id === vehicleId) {
        const updated = {
          ...v,
          assignedDriverId: driverId || undefined,
          assignedDriverName: driver?.name || undefined
        };
        saveVehicleToFirestore(updated, profile.id);
        return updated;
      }
      return v;
    }));

    if (driver) {
      setDrivers(prev => prev.map(d => {
        if (d.id === driverId) {
          const updated = {
            ...d,
            assignedVehicleNumber: vehicles.find(v => v.id === vehicleId)?.vehicleNumber
          };
          return updated;
        }
        return d;
      }));
    }
  };

  const handleAddDriver = (newDriver: FleetDriver) => {
    setDrivers([newDriver, ...drivers]);
    inviteDriverByVendor(newDriver.phone, profile.id, profile.companyName, newDriver.assignedVehicleNumber);
  };

  const handleUpdateDriverStatus = (driverId: string, status: FleetDriver['status']) => {
    setDrivers(prev => prev.map(d => {
      if (d.id === driverId) {
        const updated = { ...d, status };
        // We cannot update driver docs. Let's just simulate locally or remove this
        // saveDriverToFirestore(updated, profile.id);
        return updated;
      }
      return d;
    }));
  };

  // Marketplace & Bidding Handlers
  const handleAcceptOfferedRate = (trip: OpenTrip) => {
    const newVendorTrip: VendorTrip = {
      id: `VTRIP-${Date.now()}`,
      bookingId: trip.bookingId,
      customerName: 'Verified Booking Customer',
      customerPhone: '+91 98400 11223',
      pickupAddress: trip.pickup.address,
      dropAddress: trip.drop.address,
      scheduledTime: `${trip.travelDate}, ${trip.pickup.time}`,
      vehicleNumber: vehicles[0]?.vehicleNumber || 'TN 09 BX 4821',
      driverId: drivers[0]?.id || 'DRV-7892',
      driverName: drivers[0]?.name || 'Muthu Kumar',
      driverPhone: drivers[0]?.phone || '+91 98450 12345',
      grossFare: trip.offeredPayout,
      platformFee: Math.round(trip.offeredPayout * 0.1),
      vendorPayout: Math.round(trip.offeredPayout * 0.9),
      status: 'Assigned'
    };

    setActiveTrips([newVendorTrip, ...activeTrips]);
    setOpenTrips(prev => prev.filter(t => t.id !== trip.id));
    setActiveTab('trips');
    assignTripInFirestore(trip.id, newVendorTrip.driverId, newVendorTrip.driverName, newVendorTrip.vehicleNumber, profile.id);
  };

  const handleSubmitCounterBid = (trip: OpenTrip, counterRate: number, note: string) => {
    const newBid: BidProposal = {
      id: `BID-${Math.floor(100 + Math.random() * 900)}`,
      tripId: trip.id,
      bookingId: trip.bookingId,
      offeredPayout: trip.offeredPayout,
      vendorCounterRate: counterRate,
      biddingNote: note,
      submittedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      status: 'Pending Review'
    };

    setBidProposals([newBid, ...bidProposals]);
    submitBidToFirestore(newBid, profile.id, profile.companyName || 'Vendor Partner');
  };

  // Dispatch Assignment
  const handleAssignDriverAndVehicle = (tripId: string, driverId: string, vehicleNumber: string) => {
    const driver = drivers.find(d => d.id === driverId);
    setActiveTrips(prev => prev.map(t => t.id === tripId ? {
      ...t,
      driverId: driverId,
      driverName: driver?.name || t.driverName,
      driverPhone: driver?.phone || t.driverPhone,
      vehicleNumber: vehicleNumber
    } : t));
    assignTripInFirestore(tripId, driverId, driver?.name || '', vehicleNumber, profile.id);
  };

  // Wallet Payout Request
  const handleRequestPayout = (amount: number, method: 'UPI' | 'Bank Transfer', details: string) => {
    const newRequest: PayoutRequest = {
      id: `VPO-${Math.floor(100 + Math.random() * 900)}`,
      amount: amount,
      requestedAt: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      payoutMethod: method,
      targetDetails: details,
      status: 'Pending'
    };

    setPayoutRequests([newRequest, ...payoutRequests]);
    setWallet(prev => ({
      ...prev,
      availableBalance: prev.availableBalance - amount
    }));
    submitPayoutRequestToFirestore(newRequest, profile.id);
  };

  return (
    <div className="h-screen flex overflow-hidden font-sans antialiased" style={{ background: '#F5F5F5' }}>
      
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
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
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
          collapsed ? 'lg:ml-[68px]' : 'lg:ml-[240px]'
        }`}
      >
        {/* Mobile Hamburger Header */}
        <div className="lg:hidden fixed top-3 left-3 z-20">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center border border-[#E5E5E5] text-[#111]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
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
          pendingBidsCount={bidProposals.filter(b => b.status === 'Pending Review').length}
        />

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && (
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

          {activeTab === 'fleet' && (
            <FleetScreen
              vehicles={vehicles}
              drivers={drivers}
              onAddVehicle={handleAddVehicle}
              onUpdateVehicleStatus={handleUpdateVehicleStatus}
              onAssignDriver={handleAssignDriver}
            />
          )}

          {activeTab === 'drivers' && (
            <DriverManagementScreen
              drivers={drivers}
              vehicles={vehicles}
              onAddDriver={handleAddDriver}
              onUpdateDriverStatus={handleUpdateDriverStatus}
            />
          )}

          {activeTab === 'marketplace' && (
            <MarketplaceBiddingScreen
              openTrips={openTrips}
              bidProposals={bidProposals}
              onAcceptOfferedRate={handleAcceptOfferedRate}
              onSubmitCounterBid={handleSubmitCounterBid}
            />
          )}

          {activeTab === 'trips' && (
            <TripAssignmentScreen
              activeTrips={activeTrips}
              drivers={drivers}
              vehicles={vehicles}
              onAssignDriverAndVehicle={handleAssignDriverAndVehicle}
            />
          )}

          {activeTab === 'wallet' && (
            <WalletPayoutScreen
              vendorId={profile.id}
              wallet={wallet}
              payoutRequests={payoutRequests}
              transactions={transactions}
              onRequestPayout={handleRequestPayout}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentsVerificationScreen record={record} />
          )}
        </main>
      </div>

    </div>
  );
}

export default App;
