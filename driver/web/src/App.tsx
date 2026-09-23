import React, { useState, useEffect } from 'react';
import {
  DriverStatus,
  DriverProfile,
  DrivingLicense,
  VehicleDetails,
  TripDetails,
  DriverEarningsSummary,
  WalletDetails,
  PayoutRequest,
  TransactionRecord,
  PreTripVerification,
  TripStatus
} from './types';
import {
  DEFAULT_LICENSE,
  DEFAULT_VEHICLE,
  DEFAULT_EARNINGS_SUMMARY,
  DEFAULT_WALLET
} from './config/constants';

import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DashboardScreen } from './screens/DashboardScreen';
import { DriverLoginScreen } from './screens/DriverLoginScreen';
import { RegistrationScreen } from './screens/RegistrationScreen';
import { PreTripVerificationScreen } from './screens/PreTripVerificationScreen';
import { TripExecutionScreen } from './screens/TripExecutionScreen';
import { EarningsScreen } from './screens/EarningsScreen';
import { WalletPayoutScreen } from './screens/WalletPayoutScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { AlertTriangle, ShieldCheck, PhoneCall, X } from 'lucide-react';

import {
  subscribeToDriverProfile,
  subscribeToActiveTrip,
  subscribeToPayoutRequests,
  syncDriverProfileToFirestore,
  subscribeToMarketplaceTrips,
  updateTripStatusInFirestore,
  requestPayoutInFirestore,
  submitDriverKycInFirestore,
  getExistingDriverProfile
} from './services/driverFirestoreService';
import { subscribeToAuthUser, signOutUser } from './services/authService';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [driverStatus, setDriverStatus] = useState<DriverStatus>('Online');

  // Auth Bootstrap
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<DriverProfile | null>(null);

  // State Stores
  const [license, setLicense] = useState<DrivingLicense>(DEFAULT_LICENSE);
  const [vehicle, setVehicle] = useState<VehicleDetails>(DEFAULT_VEHICLE);

  const [activeTrip, setActiveTrip] = useState<TripDetails | null>(null);
  const [availableTrips, setAvailableTrips] = useState<TripDetails[]>([]);

  const [earnings, setEarnings] = useState<DriverEarningsSummary>(DEFAULT_EARNINGS_SUMMARY);
  const [wallet, setWallet] = useState<WalletDetails>(DEFAULT_WALLET);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  // Pre-Trip Modal / View State
  const [inPreTripVerification, setInPreTripVerification] = useState<boolean>(false);
  const [showSOSModal, setShowSOSModal] = useState<boolean>(false);

  // Bootstrap the session from Firebase Auth — a returning driver with a
  // persisted session skips DriverLoginScreen entirely on page load/refresh.
  useEffect(() => {
    const unsubscribe = subscribeToAuthUser(async (fbUser) => {
      if (!fbUser) {
        setProfile(null);
        setAuthLoading(false);
        return;
      }
      const existing = await getExistingDriverProfile(fbUser.uid);
      setProfile(existing);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync with Firestore
  useEffect(() => {
    if (!profile) return undefined;

    syncDriverProfileToFirestore(profile, driverStatus);
    const unsubscribe = subscribeToMarketplaceTrips((liveTrips) => {
      setAvailableTrips(liveTrips);
    });

    const unsubProfile = subscribeToDriverProfile(profile.id, (liveProfile) => {
      if (liveProfile && liveProfile.name) {
        setProfile(prev => (prev ? { ...prev, ...liveProfile } : prev));
      }
    });

    const unsubActiveTrip = subscribeToActiveTrip(profile.id, (trip) => {
      if (trip && !activeTrip) {
        setActiveTrip({
          id: trip.id,
          bookingId: trip.bookingId || trip.id,
          customerName: trip.customer || 'Passenger',
          customerPhone: trip.phone || '+91 98400 11223',
          pickup: { address: trip.pickupAddress || trip.pickup || 'Pickup Point', lat: 13.0827, lng: 80.2707 },
          drop: { address: trip.dropAddress || trip.drop || 'Destination', lat: 11.9416, lng: 79.8083 },
          pickupDistanceKm: 1.5,
          distanceKm: trip.distanceKm || 155,
          estimatedTimeMin: 120,
          vehicleType: trip.vehicleCategory || trip.vehicle || 'Sedan',
          fareAmount: typeof trip.fare === 'number' ? trip.fare : parseInt(String(trip.fare || '3200').replace(/[^0-9]/g, '')) || 3200,
          driverEarnings: Math.round((typeof trip.fare === 'number' ? trip.fare : parseInt(String(trip.fare || '3200').replace(/[^0-9]/g, '')) || 3200) * 0.85),
          platformCommission: Math.round((typeof trip.fare === 'number' ? trip.fare : parseInt(String(trip.fare || '3200').replace(/[^0-9]/g, '')) || 3200) * 0.15),
          tollCharges: 0,
          customerOTP: trip.boardingOTP || '4892',
          status: trip.status || 'Assigned',
          scheduledTime: `${trip.date || 'Today'}, ${trip.time || '02:30 PM'}`,
          paymentMode: trip.paymentMethod || 'UPI'
        });
        setDriverStatus('Assigned Trip');
      }
    });

    const unsubPayouts = subscribeToPayoutRequests(profile.id, (livePayouts) => {
      setPayoutRequests(livePayouts);
    });

    return () => {
        unsubscribe();
        unsubProfile();
        unsubActiveTrip();
        unsubPayouts();
    };
  }, [driverStatus, profile?.id]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Loading...</span>
      </div>
    );
  }

  if (!profile) {
    return <DriverLoginScreen onComplete={(completedProfile) => setProfile(completedProfile)} />;
  }

  // Status Handlers
  const handleStatusChange = (newStatus: DriverStatus) => {
    setDriverStatus(newStatus);
    syncDriverProfileToFirestore(profile, newStatus);
  };

  // Accept Trip from Marketplace
  const handleAcceptTrip = (trip: TripDetails) => {
    setActiveTrip({ ...trip, status: 'Assigned' });
    setAvailableTrips(prev => prev.filter(t => t.id !== trip.id));
    setDriverStatus('Assigned Trip');
    setActiveTab('dashboard');
    updateTripStatusInFirestore(trip.id, 'Assigned', { driverId: profile.id, driverName: profile.name } as any);
  };

  // Pre-Trip Flow
  const handleStartPreTrip = (trip: TripDetails) => {
    setInPreTripVerification(true);
    setActiveTab('trip');
  };

  const handleCompletePreTripVerification = (verification: PreTripVerification) => {
    if (activeTrip) {
      setActiveTrip({
        ...activeTrip,
        status: 'En Route Pickup',
        preTripVerification: verification,
        startOdometer: verification.odometerReading
      });
      updateTripStatusInFirestore(activeTrip.id, 'En Route Pickup', {
        startOdometer: verification.odometerReading
      });
    }
    setInPreTripVerification(false);
    setDriverStatus('On Trip');
  };

  // Update Trip Status
  const handleUpdateTripStatus = (status: TripStatus, updatedDetails?: Partial<TripDetails>) => {
    if (!activeTrip) return;

    const newTrip = {
      ...activeTrip,
      status: status,
      ...updatedDetails
    };

    setActiveTrip(newTrip);
    updateTripStatusInFirestore(activeTrip.id, status, updatedDetails);

    if (status === 'Completed') {
      // Add earnings to wallet
      const totalEarned = (newTrip.driverEarnings || 702) + (newTrip.tollCharges || 0);
      setWallet(prev => ({
        ...prev,
        availableBalance: prev.availableBalance + totalEarned
      }));
      setEarnings(prev => ({
        ...prev,
        todayEarnings: prev.todayEarnings + totalEarned,
        totalTripsCompleted: prev.totalTripsCompleted + 1
      }));
      setDriverStatus('Online');
    }
  };

  // Handle Request Payout
  const handleRequestPayout = (amount: number, method: 'UPI' | 'Bank Transfer', details: string) => {
    const newRequest: PayoutRequest = {
      id: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: amount,
      requestedAt: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      payoutMethod: method,
      targetDetails: details,
      status: 'Pending'
    };

    setPayoutRequests([newRequest, ...payoutRequests]);
    requestPayoutInFirestore(profile.id, amount, method, details);
    setWallet(prev => ({
      ...prev,
      availableBalance: prev.availableBalance - amount
    }));

    const newTxn: TransactionRecord = {
      id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      type: 'Payout Withdrawal',
      amount: amount,
      isCredit: false,
      timestamp: new Date().toLocaleTimeString(),
      description: `Requested ${method} Payout to ${details}`,
      status: 'Processing'
    };
    setTransactions([newTxn, ...transactions]);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] text-[#111111] font-sans antialiased selection:bg-[#E21E26] selection:text-white flex flex-col">
      
      {/* Header Bar */}
      <Header
        status={driverStatus}
        onStatusChange={handleStatusChange}
        profile={profile}
        wallet={wallet}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadNotificationsCount={1}
        onOpenSOS={() => setShowSOSModal(true)}
        onLogout={() => { signOutUser(); }}
      />

      {/* Main Screen Router Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        
        {/* Pre-Trip Screen Mode Override */}
        {inPreTripVerification && activeTrip ? (
          <PreTripVerificationScreen
            trip={activeTrip}
            onCompleteVerification={handleCompletePreTripVerification}
            onCancel={() => setInPreTripVerification(false)}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardScreen
                status={driverStatus}
                onStatusChange={handleStatusChange}
                profile={profile}
                license={license}
                vehicle={vehicle}
                activeTrip={activeTrip}
                availableTrips={availableTrips}
                earnings={earnings}
                onAcceptTrip={handleAcceptTrip}
                onStartPreTrip={handleStartPreTrip}
                onContinueTrip={(t) => {
                  setActiveTab('trip');
                }}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'trip' && (
              activeTrip ? (
                <TripExecutionScreen trip={activeTrip} onUpdateTripStatus={handleUpdateTripStatus} />
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">No Active Trip</h3>
                  <p className="text-sm text-gray-500">You have no active trip right now. Accept a trip from the marketplace to get started.</p>
                  <button onClick={() => setActiveTab('dashboard')} className="px-6 py-2.5 bg-[#E21E26] text-white text-sm font-bold rounded-xl">
                    Go to Dashboard
                  </button>
                </div>
              )
            )}

            {activeTab === 'registration' && (
              <RegistrationScreen
                driverId={profile.id}
                profile={profile}
                license={license}
                vehicle={vehicle}
                onSaveProfile={setProfile}
                onSaveLicense={setLicense}
                onSaveVehicle={setVehicle}
              />
            )}

            {activeTab === 'earnings' && (
              <EarningsScreen earnings={earnings} />
            )}

            {activeTab === 'wallet' && (
              <WalletPayoutScreen
                wallet={wallet}
                payoutRequests={payoutRequests}
                transactions={transactions}
                onRequestPayout={handleRequestPayout}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationsScreen driverId={profile.id} />
            )}

            {activeTab === 'profile' && (
              <RegistrationScreen
                driverId={profile.id}
                profile={profile}
                license={license}
                vehicle={vehicle}
                onSaveProfile={setProfile}
                onSaveLicense={setLicense}
                onSaveVehicle={setVehicle}
              />
            )}
          </>
        )}

      </main>

      {/* SOS Emergency Modal */}
      {showSOSModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#E21E26] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowSOSModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-[#E21E26]">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
              <div>
                <h2 className="text-lg font-black tracking-tight text-gray-900">NESAM EMERGENCY SOS</h2>
                <p className="text-xs text-[#E21E26] font-bold">24x7 Driver Control & Police Help</p>
              </div>
            </div>

            <p className="text-xs text-gray-600">
              Pressing SOS immediately dispatches live GPS location to NESAM Safety Team and local Police emergency service (112).
            </p>

            <div className="space-y-2 pt-2">
              <a
                href="tel:112"
                className="w-full py-3 bg-[#E21E26] hover:bg-[#C9141B] text-white font-black text-xs rounded-xl shadow flex items-center justify-center gap-2"
              >
                <PhoneCall className="w-4 h-4" /> CALL POLICE EMERGENCY (112)
              </a>

              <a
                href="tel:+919840012345"
                className="w-full py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> CALL NESAM DRIVER CONTROL ROOM
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasActiveTrip={Boolean(activeTrip && activeTrip.status !== 'Completed')}
        unreadCount={1}
      />

    </div>
  );
}

export default App;
