import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ShieldCheck, PhoneCall, X, CheckCircle2 } from 'lucide-react';
import type {
  DriverAccount,
  DriverNotification,
  DriverWallet,
  LedgerEntry,
  DriverStatus,
  MarketplaceOffer,
  DriverPenalty,
  PayoutRequest,
  TollReceipt,
  TripDetails,
} from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DashboardScreen } from './screens/DashboardScreen';
import { VehicleVerificationScreen } from './screens/VehicleVerificationScreen';
import { NotificationPopups } from './components/NotificationPopups';
import { PenaltyAckModal } from './components/PenaltyAckModal';
import { advanceTrip, verifyBoarding } from './services/tripService';
import { getFirebaseLocation } from './services/location';
import { TripExecutionScreen } from './screens/TripExecutionScreen';
import { EarningsScreen } from './screens/EarningsScreen';
import { WalletPayoutScreen } from './screens/WalletPayoutScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RegistrationScreen } from './screens/RegistrationScreen';
import { SUPPORT_PHONE } from './screens/VerificationStatusScreen';
import {
  acceptMarketplaceTrip,
  describeFirestoreError,
  markNotificationRead,
  requestPayout,
  setDriverPresence,
  subscribeToDriverBookings,
  subscribeToDriverLedger,
  subscribeToDriverNotifications,
  subscribeToDriverPenalties,
  subscribeToDriverWallet,
  subscribeToOpenMarketplace,
  subscribeToPayoutRequests,
  updateDriverContactDetails,
} from './services/driverFirestoreService';
import { EMPTY_WALLET, summarizeEarnings } from './services/driverEarnings';

interface DriverWorkspaceProps {
  account: DriverAccount;
  onSignOut: () => void;
}

export const DriverWorkspace: React.FC<DriverWorkspaceProps> = ({ account, onSignOut }) => {
  const driver = account.driver;
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inPreTrip, setInPreTrip] = useState(false);
  const [editingDocs, setEditingDocs] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const [bookings, setBookings] = useState<TripDetails[]>([]);
  const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [penalties, setPenalties] = useState<DriverPenalty[]>([]);
  const [penaltiesError, setPenaltiesError] = useState('');
  const [ackPenaltyId, setAckPenaltyId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<DriverWallet>(EMPTY_WALLET);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [presenceBusy, setPresenceBusy] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((kind: 'ok' | 'error', text: string) => {
    setToast({ kind, text });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ── Live data ────────────────────────────────────────────────────────────
  useEffect(() => subscribeToDriverBookings(driver.id, setBookings), [driver.id]);
  // The marketplace is for independent drivers; a fleet driver's trips come from its vendor.
  const independent = !driver.vendorId;
  useEffect(() => {
    if (!independent) {
      setOffers([]);
      return undefined;
    }
    return subscribeToOpenMarketplace(setOffers);
  }, [independent]);
  useEffect(() => subscribeToPayoutRequests(driver.id, setPayouts), [driver.id]);
  useEffect(() => subscribeToDriverNotifications(driver.id, setNotifications), [driver.id]);
  useEffect(() => subscribeToDriverPenalties(driver.id, (p) => { setPenalties(p); setPenaltiesError(''); }, setPenaltiesError), [driver.id]);
  // Money comes from the server's partner ledger; the app never computes it.
  useEffect(() => subscribeToDriverWallet(driver.id, setWallet, (m) => notify('error', m)), [driver.id, notify]);
  useEffect(() => subscribeToDriverLedger(driver.id, setLedger, (m) => notify('error', m)), [driver.id, notify]);

  const activeTrip = useMemo(
    () => bookings.find((b) => b.status === 'Assigned' || b.status === 'Ongoing') ?? null,
    [bookings],
  );
  const completedTrips = useMemo(
    () =>
      bookings
        .filter((b) => b.status === 'Completed')
        .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)),
    [bookings],
  );

  // Presence follows the trip: On Trip while one is active, back to Online after.
  const presence: DriverStatus = driver.presenceStatus;
  useEffect(() => {
    if (activeTrip && presence !== 'On Trip') {
      setDriverPresence(driver.id, 'On Trip').catch(() => undefined);
    } else if (!activeTrip && presence === 'On Trip') {
      setDriverPresence(driver.id, 'Online').catch(() => undefined);
    }
  }, [activeTrip, presence, driver.id]);

  // Leave the verification screen if the trip moved on, was cancelled or was reassigned.
  useEffect(() => {
    if (inPreTrip && (!activeTrip || activeTrip.subStatus !== 'Not Started')) setInPreTrip(false);
  }, [inPreTrip, activeTrip]);

  // A penalty must be acknowledged (or disputed) before the driver carries on.
  const mustAcknowledge = useMemo(() => penalties.find((p) => p.status === 'Pending' && !p.acknowledged) ?? null, [penalties]);
  const penaltyToShow = penalties.find((p) => p.id === ackPenaltyId && (p.status === 'Pending' || p.status === 'Acknowledged')) ?? mustAcknowledge;

  // ── Earnings (credited by the server when a trip's fare is verified) ────
  const earnings = useMemo(() => summarizeEarnings(ledger), [ledger]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handlePresenceChange = async (next: DriverStatus) => {
    if (activeTrip) {
      notify('error', 'Finish your current trip before changing your duty status.');
      return;
    }
    setPresenceBusy(true);
    try {
      await setDriverPresence(driver.id, next);
    } catch (err) {
      notify('error', describeFirestoreError(err, 'Could not update your status.'));
    } finally {
      setPresenceBusy(false);
    }
  };

  const handleAccept = async (offer: MarketplaceOffer) => {
    if (activeTrip) {
      notify('error', 'You already have an active trip.');
      return;
    }
    setAcceptingId(offer.id);
    try {
      await acceptMarketplaceTrip(driver, account.vehicle.vehicleNumber, offer);
      notify('ok', 'Trip accepted! Complete the pre-trip check before heading to pickup.');
      setActiveTab('dashboard');
    } catch (err) {
      notify('error', err instanceof Error && !(err as { code?: string }).code
        ? err.message
        : describeFirestoreError(err, 'This trip is no longer available — another partner may have taken it.'));
    } finally {
      setAcceptingId(null);
    }
  };

  const handleVerified = () => {
    setInPreTrip(false);
    setActiveTab('trip');
    notify('ok', 'Vehicle verification submitted. You can now start the trip.');
  };

  const handleTripStart = async (requestId: string) => {
    if (!activeTrip) return;
    const location = await getFirebaseLocation();
    await advanceTrip({ bookingId: activeTrip.id, to: 'Trip Started', location, requestId });
  };

  const handleReachedPickup = async (requestId: string) => {
    if (!activeTrip) return;
    const location = await getFirebaseLocation();
    await advanceTrip({ bookingId: activeTrip.id, to: 'Reached Pickup', location, requestId });
  };

  const handleVerifyBoarding = async (otp: string) => {
    if (!activeTrip) return;
    await verifyBoarding(activeTrip.id, otp);
  };

  const handleTripEnd = async (endOdometer: number, tolls: TollReceipt[], requestId: string) => {
    if (!activeTrip) return;
    const fleetTrip = activeTrip.fleetTrip;
    const location = await getFirebaseLocation();
    await advanceTrip({ bookingId: activeTrip.id, to: 'Trip Ended', location, endOdometer, tolls, requestId });
    notify('ok', fleetTrip
      ? 'Trip ended. Your fleet operator settles your pay for this trip.'
      : 'Trip ended. Your earning is added to your wallet once NESAM verifies the fare, and becomes withdrawable when the customer’s payment is confirmed.');
    setActiveTab('dashboard');
  };

  const handleRequestPayout = async (amount: number, method: 'UPI' | 'Bank Transfer') => {
    await requestPayout(amount, method);
    notify('ok', 'Payout request sent. The amount is held until NESAM Finance transfers it.');
  };

  const goTab = (tab: string) => {
    setEditingDocs(false);
    setInPreTrip(false);
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] text-[#111111] font-sans antialiased flex flex-col">
      <Header
        status={presence}
        onStatusChange={handlePresenceChange}
        profile={driver}
        walletBalance={wallet.available}
        activeTab={activeTab}
        setActiveTab={goTab}
        unreadNotificationsCount={unreadCount}
        onOpenSOS={() => setShowSOS(true)}
        onLogout={onSignOut}
      />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
          <div
            className={`p-3 rounded-xl text-xs font-bold shadow-lg flex items-start gap-2 border ${
              toast.kind === 'ok' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {toast.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{toast.text}</span>
            <button onClick={() => setToast(null)}><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        {inPreTrip && activeTrip ? (
          <VehicleVerificationScreen trip={activeTrip} onDone={handleVerified} onCancel={() => setInPreTrip(false)} />
        ) : editingDocs ? (
          <RegistrationScreen
            uid={driver.id}
            mode="update"
            initial={account}
            currentStatus={driver.approvalStatus}
            onSubmitted={() => {
              setEditingDocs(false);
              notify('ok', 'Documents submitted for re-verification.');
            }}
            onCancel={() => setEditingDocs(false)}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardScreen
                status={presence}
                presenceBusy={presenceBusy}
                onStatusChange={handlePresenceChange}
                account={account}
                activeTrip={activeTrip}
                offers={offers}
                earnings={earnings}
                completedTripsCount={completedTrips.length}
                acceptingId={acceptingId}
                onAcceptTrip={handleAccept}
                onStartPreTrip={() => setInPreTrip(true)}
                onOpenTrip={() => setActiveTab('trip')}
                onNavigate={goTab}
              />
            )}

            {activeTab === 'trip' &&
              (activeTrip ? (
                <TripExecutionScreen
                  key={activeTrip.id}
                  trip={activeTrip}
                  onStartVerification={() => setInPreTrip(true)}
                  onTripStart={handleTripStart}
                  onReachedPickup={handleReachedPickup}
                  onVerifyBoarding={handleVerifyBoarding}
                  onTripEnd={handleTripEnd}
                />
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
                  <h3 className="text-lg font-bold text-gray-800">No Active Trip</h3>
                  <p className="text-sm text-gray-700">Go online and accept a trip from the dashboard to get started.</p>
                  <button onClick={() => goTab('dashboard')} className="px-6 py-3 bg-[#E21E26] text-white text-sm font-bold rounded-xl">
                    Go to Dashboard
                  </button>
                </div>
              ))}

            {activeTab === 'earnings' && (
              <EarningsScreen earnings={earnings} completedTrips={completedTrips} ledger={ledger} fleetDriver={!independent} fleetName={driver.vendorName} />
            )}

            {activeTab === 'wallet' && (
              <WalletPayoutScreen
                wallet={wallet}
                bank={account.bank}
                payoutRequests={payouts}
                ledger={ledger}
                fleetDriver={!independent}
                onRequestPayout={handleRequestPayout}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationsScreen
                notifications={notifications}
                penalties={penalties}
                penaltiesError={penaltiesError}
                onMarkRead={(id) => markNotificationRead(id).catch(() => undefined)}
                onOpenPenalty={(p) => setAckPenaltyId(p.id)}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileScreen
                account={account}
                completedTrips={completedTrips.length}
                onEditDocuments={() => setEditingDocs(true)}
                onSaveContact={(fields) => updateDriverContactDetails(driver.id, fields)}
                onSignOut={onSignOut}
              />
            )}
          </>
        )}
      </main>

      {showSOS && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#E21E26] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button onClick={() => setShowSOS(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 text-[#E21E26]">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
              <div>
                <h2 className="text-lg font-black tracking-tight text-gray-900">NESAM EMERGENCY SOS</h2>
                <p className="text-xs text-[#E21E26] font-bold">24x7 Driver Control &amp; Police Help</p>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <a href="tel:112" className="w-full py-3 bg-[#E21E26] hover:bg-[#C9141B] text-white font-black text-xs rounded-xl shadow flex items-center justify-center gap-2">
                <PhoneCall className="w-4 h-4" /> CALL POLICE EMERGENCY (112)
              </a>
              <a href={`tel:${SUPPORT_PHONE}`} className="w-full py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> CALL NESAM DRIVER CONTROL ROOM
              </a>
            </div>
          </div>
        </div>
      )}

      <NotificationPopups
        notifications={notifications}
        onOpen={(n) => {
          markNotificationRead(n.id).catch(() => undefined);
          if (n.category === 'penalties') goTab('notifications');
          else goTab(['dashboard', 'trip', 'earnings', 'wallet', 'notifications', 'profile'].includes(n.ctaPage) ? n.ctaPage : 'notifications');
        }}
      />
      {penaltyToShow && (
        <PenaltyAckModal
          key={penaltyToShow.id}
          penalty={penaltyToShow}
          onDone={(m) => {
            setAckPenaltyId(null);
            notify('ok', m);
          }}
        />
      )}

      <BottomNav activeTab={activeTab} setActiveTab={goTab} hasActiveTrip={Boolean(activeTrip)} unreadCount={unreadCount} />
    </div>
  );
};
