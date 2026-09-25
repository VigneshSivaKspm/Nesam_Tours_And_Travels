import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ShieldCheck, PhoneCall, X, CheckCircle2 } from 'lucide-react';
import type {
  DriverAccount,
  DriverEarningsSummary,
  DriverNotification,
  DriverStatus,
  MarketplaceOffer,
  PayoutRequest,
  PreTripPhotos,
  TollReceipt,
  TripDetails,
} from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DashboardScreen } from './screens/DashboardScreen';
import { PreTripVerificationScreen } from './screens/PreTripVerificationScreen';
import { TripExecutionScreen } from './screens/TripExecutionScreen';
import { EarningsScreen } from './screens/EarningsScreen';
import { WalletPayoutScreen } from './screens/WalletPayoutScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RegistrationScreen } from './screens/RegistrationScreen';
import { SUPPORT_PHONE } from './screens/VerificationStatusScreen';
import {
  acceptMarketplaceTrip,
  completeTrip,
  describeFirestoreError,
  markArrivedDestination,
  markNotificationRead,
  markReachedPickup,
  requestPayout,
  setDriverPresence,
  startTripWithOtp,
  submitPreTripVerification,
  subscribeToDriverBookings,
  subscribeToDriverNotifications,
  subscribeToOpenMarketplace,
  subscribeToPayoutRequests,
  updateDriverContactDetails,
} from './services/driverFirestoreService';

interface DriverWorkspaceProps {
  account: DriverAccount;
  onSignOut: () => void;
}

// Payout requests in these states no longer hold money back from the wallet.
const RELEASED_PAYOUT_STATES = ['Deferred', 'Rejected', 'Cancelled'];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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
  useEffect(() => subscribeToOpenMarketplace(setOffers), []);
  useEffect(() => subscribeToPayoutRequests(driver.id, setPayouts), [driver.id]);
  useEffect(() => subscribeToDriverNotifications(driver.id, setNotifications), [driver.id]);

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

  // Drop out of pre-trip mode if the trip moved on or was cancelled.
  useEffect(() => {
    if (inPreTrip && (!activeTrip || activeTrip.stage !== 'Assigned')) setInPreTrip(false);
  }, [inPreTrip, activeTrip]);

  // ── Earnings & wallet (derived from real trips and payout requests) ─────
  const earnings: DriverEarningsSummary = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now).getTime();
    const weekAgo = today - 6 * 86400000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const sum = { todayEarnings: 0, thisWeekEarnings: 0, thisMonthEarnings: 0, lifetimeEarnings: 0, tollReimbursements: 0 };
    for (const t of completedTrips) {
      const amount = t.driverEarnings + t.tollCharges;
      const at = t.completedAt?.getTime() ?? 0;
      sum.lifetimeEarnings += amount;
      sum.tollReimbursements += t.tollCharges;
      if (at >= today) sum.todayEarnings += amount;
      if (at >= weekAgo) sum.thisWeekEarnings += amount;
      if (at >= monthStart) sum.thisMonthEarnings += amount;
    }
    return { ...sum, totalTripsCompleted: completedTrips.length };
  }, [completedTrips]);

  const wallet = useMemo(() => {
    const paidOut = payouts.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
    const pending = payouts
      .filter((p) => p.status !== 'Paid' && !RELEASED_PAYOUT_STATES.includes(p.status))
      .reduce((s, p) => s + p.amount, 0);
    return {
      availableBalance: Math.max(0, Math.round(earnings.lifetimeEarnings - paidOut - pending)),
      pendingPayouts: pending,
      totalPaidOut: paidOut,
    };
  }, [payouts, earnings.lifetimeEarnings]);

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
      notify('error', describeFirestoreError(err, 'This trip is no longer available — another partner may have taken it.'));
    } finally {
      setAcceptingId(null);
    }
  };

  const handlePreTripSubmit = async (photos: PreTripPhotos) => {
    if (!activeTrip) return;
    await submitPreTripVerification(activeTrip.id, photos);
    setInPreTrip(false);
    setActiveTab('trip');
    notify('ok', 'Pre-trip check submitted. Drive safe to the pickup point.');
  };

  const handleReachedPickup = async (location: { lat: number; lng: number } | null) => {
    if (!activeTrip) return;
    await markReachedPickup(activeTrip.id, location);
  };

  const handleStartTrip = async (otp: string) => {
    if (!activeTrip) return;
    await startTripWithOtp(activeTrip.id, otp);
  };

  const handleArrived = async () => {
    if (!activeTrip) return;
    await markArrivedDestination(activeTrip.id);
  };

  const handleComplete = async (endOdometer: number, tolls: TollReceipt[]) => {
    if (!activeTrip) return;
    await completeTrip(activeTrip.id, endOdometer, tolls);
    notify('ok', 'Trip completed. Earnings added to your wallet.');
    setActiveTab('dashboard');
  };

  const handleRequestPayout = async (amount: number, method: 'UPI' | 'Bank Transfer', details: string) => {
    await requestPayout(driver, amount, method, details);
    notify('ok', 'Payout request submitted. The NESAM finance team will process it shortly.');
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
        walletBalance={wallet.availableBalance}
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
          <PreTripVerificationScreen trip={activeTrip} onSubmit={handlePreTripSubmit} onCancel={() => setInPreTrip(false)} />
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
                acceptingId={acceptingId}
                onAcceptTrip={handleAccept}
                onStartPreTrip={() => setInPreTrip(true)}
                onOpenTrip={() => setActiveTab('trip')}
                onNavigate={goTab}
              />
            )}

            {activeTab === 'trip' &&
              (activeTrip ? (
                activeTrip.stage === 'Assigned' ? (
                  <div className="max-w-md mx-auto text-center bg-white border border-gray-200 rounded-2xl p-8 space-y-4">
                    <ShieldCheck className="w-10 h-10 text-[#E21E26] mx-auto" />
                    <h3 className="text-lg font-bold text-gray-900">Pre-Trip Check Required</h3>
                    <p className="text-sm text-gray-500">Complete the vehicle safety check before starting to the pickup point.</p>
                    <button onClick={() => setInPreTrip(true)} className="px-6 py-2.5 bg-[#E21E26] text-white text-sm font-bold rounded-xl">
                      Start Pre-Trip Check
                    </button>
                  </div>
                ) : (
                  <TripExecutionScreen
                    key={activeTrip.id}
                    trip={activeTrip}
                    onReachedPickup={handleReachedPickup}
                    onStartTrip={handleStartTrip}
                    onArrived={handleArrived}
                    onComplete={handleComplete}
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
                  <h3 className="text-lg font-bold text-gray-800">No Active Trip</h3>
                  <p className="text-sm text-gray-500">Go online and accept a trip from the dashboard to get started.</p>
                  <button onClick={() => goTab('dashboard')} className="px-6 py-2.5 bg-[#E21E26] text-white text-sm font-bold rounded-xl">
                    Go to Dashboard
                  </button>
                </div>
              ))}

            {activeTab === 'earnings' && <EarningsScreen earnings={earnings} completedTrips={completedTrips} />}

            {activeTab === 'wallet' && (
              <WalletPayoutScreen
                availableBalance={wallet.availableBalance}
                pendingPayouts={wallet.pendingPayouts}
                totalPaidOut={wallet.totalPaidOut}
                bank={account.bank}
                payoutRequests={payouts}
                completedTrips={completedTrips}
                onRequestPayout={handleRequestPayout}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationsScreen
                notifications={notifications}
                onMarkRead={(id) => markNotificationRead(id).catch(() => undefined)}
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

      <BottomNav activeTab={activeTab} setActiveTab={goTab} hasActiveTrip={Boolean(activeTrip)} unreadCount={unreadCount} />
    </div>
  );
};
