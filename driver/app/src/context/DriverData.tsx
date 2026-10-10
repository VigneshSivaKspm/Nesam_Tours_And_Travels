// Live data for an approved driver, subscribed once per session (mirrors
// driver/web/src/DriverWorkspace.tsx). Screens read from here; every listener
// is torn down on sign-out because the provider is keyed by uid.
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DriverAccount,
  DriverEarningsSummary,
  DriverNotification,
  DriverPenalty,
  DriverWallet,
  LedgerEntry,
  MarketplaceOffer,
  PayoutRequest,
  TripDetails,
} from '../types/driver';
import {
  setDriverPresence,
  subscribeToDriverBookings,
  subscribeToDriverLedger,
  subscribeToDriverNotifications,
  subscribeToDriverPenalties,
  subscribeToDriverWallet,
  subscribeToOpenMarketplace,
  subscribeToPayoutRequests,
} from '../services/driverService';
import { EMPTY_WALLET, summarizeEarnings } from '../utils/ledger';
import { describeError } from '../utils/retry';
import { describeSignals, runDeviceChecks } from '../services/deviceSecurity';
import { registerForPush } from '../services/notificationService';

interface DriverDataValue {
  account: DriverAccount;
  bookings: TripDetails[];
  bookingsLoaded: boolean;
  bookingsError: string;
  activeTrip: TripDetails | null;
  completedTrips: TripDetails[];
  offers: MarketplaceOffer[];
  offersError: string;
  payouts: PayoutRequest[];
  notifications: DriverNotification[];
  penalties: DriverPenalty[];
  /** Plain-language warning when this phone shows signs of being unsafe for trips; empty otherwise. */
  deviceWarning: string;
  unreadCount: number;
  /** Earnings the server has credited (wallet_ledger). */
  earnings: DriverEarningsSummary;
  /** The server wallet (wallets/driver_{uid}); the app never computes a balance. */
  wallet: DriverWallet;
  ledger: LedgerEntry[];
  walletError: string;
}

const Ctx = createContext<DriverDataValue | null>(null);

export function useDriverData(): DriverDataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('DriverDataProvider is missing');
  return v;
}

export function DriverDataProvider({ account, children }: { account: DriverAccount; children: React.ReactNode }) {
  const driverId = account.driver.id;
  const presence = account.driver.presenceStatus;
  const [bookings, setBookings] = useState<TripDetails[]>([]);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);
  const [bookingsError, setBookingsError] = useState('');
  const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
  const [offersError, setOffersError] = useState('');
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [penalties, setPenalties] = useState<DriverPenalty[]>([]);
  const [deviceWarning, setDeviceWarning] = useState('');
  const [wallet, setWallet] = useState<DriverWallet>(EMPTY_WALLET);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [walletError, setWalletError] = useState('');

  useEffect(
    () =>
      subscribeToDriverBookings(
        driverId,
        (b) => {
          setBookings(b);
          setBookingsLoaded(true);
          setBookingsError('');
        },
        (e) => {
          setBookingsLoaded(true);
          setBookingsError(describeError(e, 'We couldn’t load your trips.'));
        },
      ),
    [driverId],
  );
  useEffect(() => subscribeToPayoutRequests(driverId, setPayouts), [driverId]);
  useEffect(
    () =>
      subscribeToDriverWallet(
        driverId,
        (w) => {
          setWallet(w);
          setWalletError('');
        },
        (e) => setWalletError(describeError(e, 'We couldn’t load your wallet.')),
      ),
    [driverId],
  );
  useEffect(() => subscribeToDriverLedger(driverId, setLedger, (e) => setWalletError(describeError(e, 'We couldn’t load your earnings.'))), [driverId]);
  useEffect(() => subscribeToDriverNotifications(driverId, setNotifications), [driverId]);
  useEffect(() => subscribeToDriverPenalties(driverId, setPenalties), [driverId]);

  // Once per session: register this phone for push, log device signals, refresh the Play Integrity verdict.
  useEffect(() => {
    void registerForPush(driverId, 'driver');
    void runDeviceChecks()
      .then((r) => setDeviceWarning(describeSignals(r.signals) || (r.integrity === 'failed' ? 'This phone or app could not be verified as secure. Install NESAM Driver from Google Play on an unmodified phone.' : '')))
      .catch(() => undefined);
  }, [driverId]);

  const activeTrip = useMemo(() => bookings.find((b) => b.status === 'Assigned' || b.status === 'Ongoing') ?? null, [bookings]);

  // The marketplace is only listened to while the driver can take a trip.
  // Fleet drivers get trips from their vendor; the rules refuse them the marketplace.
  const canBrowse = presence === 'Online' && !activeTrip && !account.driver.vendorId;
  useEffect(() => {
    if (!canBrowse) return undefined;
    return subscribeToOpenMarketplace(
      (o) => {
        setOffers(o);
        setOffersError('');
      },
      (e) => setOffersError(describeError(e, 'Open trips are unavailable right now.')),
    );
  }, [canBrowse]);

  // Presence follows the trip: On Trip while one is active, Online after.
  // Written only when the trip state flips, never on every snapshot.
  const hasTrip = !!activeTrip;
  const lastSynced = useRef<string>('');
  useEffect(() => {
    if (!bookingsLoaded) return;
    const want = hasTrip && presence !== 'On Trip' ? 'On Trip' : !hasTrip && presence === 'On Trip' ? 'Online' : null;
    if (!want || lastSynced.current === want) return;
    lastSynced.current = want;
    setDriverPresence(driverId, want).catch(() => {
      lastSynced.current = '';
    });
  }, [hasTrip, presence, driverId, bookingsLoaded]);

  const value = useMemo<DriverDataValue>(() => {
    const completedTrips = bookings
      .filter((b) => b.status === 'Completed')
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
    const earnings = summarizeEarnings(ledger);
    return {
      account,
      bookings,
      bookingsLoaded,
      bookingsError,
      activeTrip,
      completedTrips,
      offers: canBrowse ? offers : [],
      offersError: canBrowse ? offersError : '',
      payouts,
      notifications,
      penalties,
      deviceWarning,
      unreadCount: notifications.filter((n) => !n.read).length,
      earnings,
      wallet,
      ledger,
      walletError,
    };
  }, [account, bookings, bookingsLoaded, bookingsError, activeTrip, canBrowse, offers, offersError, payouts, notifications, penalties, deviceWarning, wallet, ledger, walletError]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
