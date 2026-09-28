// Live data for an approved driver, subscribed once per session (mirrors
// driver/web/src/DriverWorkspace.tsx). Screens read from here; every listener
// is torn down on sign-out because the provider is keyed by uid.
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DriverAccount, DriverEarningsSummary, DriverNotification, MarketplaceOffer, PayoutRequest, TripDetails } from '../types/driver';
import {
  setDriverPresence,
  subscribeToDriverBookings,
  subscribeToDriverNotifications,
  subscribeToOpenMarketplace,
  subscribeToPayoutRequests,
} from '../services/driverService';
import { summarizeEarnings, summarizeWallet, type WalletSummary } from '../utils/earnings';
import { describeError } from '../utils/retry';

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
  unreadCount: number;
  earnings: DriverEarningsSummary;
  wallet: WalletSummary;
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
  useEffect(() => subscribeToDriverNotifications(driverId, setNotifications), [driverId]);

  const activeTrip = useMemo(() => bookings.find((b) => b.status === 'Assigned' || b.status === 'Ongoing') ?? null, [bookings]);

  // The marketplace is only listened to while the driver can take a trip.
  const canBrowse = presence === 'Online' && !activeTrip;
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
    const earnings = summarizeEarnings(completedTrips);
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
      unreadCount: notifications.filter((n) => !n.read).length,
      earnings,
      wallet: summarizeWallet(earnings.lifetimeEarnings, payouts),
    };
  }, [account, bookings, bookingsLoaded, bookingsError, activeTrip, canBrowse, offers, offersError, payouts, notifications]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
