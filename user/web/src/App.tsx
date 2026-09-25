import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { NotificationItem, TripRecord, UserProfile } from './types';
import { AppHeader } from './components/AppHeader';
import { BottomNavigation, NavTab } from './components/BottomNavigation';
import { NetworkBanner } from './components/NetworkBanner';
import { ErrorNotice, FullScreenLoader, secondaryBtn } from './components/ui';
import { AuthFlow } from './screens/AuthFlow';
import { RideBookingScreen } from './screens/RideBookingScreen';
import { ActiveRideScreen } from './screens/ActiveRideScreen';
import { TripsHistoryScreen } from './screens/TripsHistoryScreen';
import { SavedPlacesScreen } from './screens/SavedPlacesScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { OffersScreen } from './screens/OffersScreen';
import { SupportScreen } from './screens/SupportScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { subscribeToAuthUser, signOutUser } from './services/authService';
import { subscribeToCustomerProfile, subscribeToUserNotifications } from './services/userFirestoreService';
import { isLiveRide, subscribeToUserBookings } from './services/rideService';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from './config/constants';
import { describeError } from './utils/retry';

const BLOCKED_STATUSES = ['Blocked', 'Suspended', 'Rejected', 'Inactive'];
/** Completed trips younger than this re-open for a rating prompt. */
const RATING_PROMPT_WINDOW_MS = 3 * 60 * 60 * 1000;

export default function App() {
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [profileError, setProfileError] = useState('');
  const [profileKey, setProfileKey] = useState(0);

  useEffect(
    () =>
      subscribeToAuthUser((u) => {
        setAuthUser(u);
        setProfile(undefined);
        setProfileError('');
      }),
    [],
  );

  useEffect(() => {
    if (!authUser) return undefined;
    setProfileError('');
    return subscribeToCustomerProfile(
      authUser.uid,
      (p) => {
        setProfile(p);
        setProfileError('');
      },
      (e) => setProfileError(describeError(e, 'We couldn’t load your account.')),
    );
  }, [authUser?.uid, profileKey]); // eslint-disable-line react-hooks/exhaustive-deps

  let body: React.ReactNode;
  if (authUser === undefined) body = <FullScreenLoader />;
  else if (!authUser) body = <AuthFlow mode="signed-out" />;
  else if (profile === undefined && profileError)
    body = (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F7F7]">
        <div className="w-full max-w-sm space-y-3">
          <ErrorNotice message={profileError} onRetry={() => setProfileKey((k) => k + 1)} />
          <button onClick={() => void signOutUser()} className={secondaryBtn}>
            Sign out
          </button>
        </div>
      </div>
    );
  else if (profile === undefined) body = <FullScreenLoader label="Loading your account…" />;
  else if (profile === null) body = <AuthFlow mode="needs-profile" uid={authUser.uid} phone={authUser.phoneNumber ?? ''} />;
  else if (BLOCKED_STATUSES.includes(profile.status))
    body = (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F7F7] text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-lg font-black text-gray-900">Account on hold</h1>
          <p className="text-sm text-gray-600">
            Your account is currently {profile.status.toLowerCase()}. Please call{' '}
            <a className="font-bold" href={`tel:${SUPPORT_PHONE}`}>
              {SUPPORT_PHONE_DISPLAY}
            </a>{' '}
            for help.
          </p>
          <button onClick={() => void signOutUser()} className={secondaryBtn}>
            Sign out
          </button>
        </div>
      </div>
    );
  else body = <RiderApp profile={profile} />;

  return (
    <>
      <NetworkBanner />
      {body}
    </>
  );
}

// ── Signed-in rider ─────────────────────────────────────────────────────────

type Overlay = 'saved_places' | 'offers' | 'support' | null;

const RiderApp: React.FC<{ profile: UserProfile }> = ({ profile }) => {
  const [tab, setTab] = useState<NavTab>('home');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState('');
  const [tripsKey, setTripsKey] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [focused, setFocused] = useState<{ id: string; unconfirmed: boolean } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setTripsError('');
    return subscribeToUserBookings(
      profile.uid,
      (t) => {
        setTrips(t);
        setTripsLoading(false);
        setTripsError('');
      },
      (e) => {
        setTripsLoading(false);
        setTripsError(describeError(e, 'We couldn’t load your trips.'));
      },
    );
  }, [profile.uid, tripsKey]);
  useEffect(() => subscribeToUserNotifications(profile.uid, setNotifications), [profile.uid]);

  const liveRide = useMemo(() => trips.find((t) => isLiveRide(t)) ?? null, [trips]);

  // Bring the rider to their live ride (or an unrated trip that just ended)
  // unless they minimised it.
  useEffect(() => {
    if (focused) return;
    const candidate =
      liveRide ??
      trips.find(
        (t) =>
          t.status === 'Completed' &&
          t.rating == null &&
          !!t.completedAt &&
          Date.now() - t.completedAt.getTime() < RATING_PROMPT_WINDOW_MS,
      );
    if (candidate && !dismissed.has(candidate.id)) {
      setFocused({ id: candidate.id, unconfirmed: false });
      setTab('home');
      setOverlay(null);
    }
  }, [liveRide, trips, focused, dismissed]);

  const closeRide = () => {
    if (focused) setDismissed((s) => new Set(s).add(focused.id));
    setFocused(null);
  };

  const selectTab = (t: NavTab) => {
    setTab(t);
    setOverlay(null);
  };

  const unread = notifications.filter((n) => !n.read).length;

  let content: React.ReactNode;
  if (overlay === 'saved_places') content = <SavedPlacesScreen ownerId={profile.uid} onBack={() => setOverlay(null)} />;
  else if (overlay === 'offers') content = <OffersScreen onBack={() => setOverlay(null)} />;
  else if (overlay === 'support') content = <SupportScreen customerId={profile.uid} onBack={() => setOverlay(null)} />;
  else if (tab === 'home')
    content = focused ? (
      <ActiveRideScreen key={focused.id} bookingId={focused.id} unconfirmed={focused.unconfirmed} profile={profile} onClose={closeRide} />
    ) : (
      <div className="flex-1 flex flex-col min-h-0">
        {liveRide && (
          <button
            onClick={() => setFocused({ id: liveRide.id, unconfirmed: false })}
            className="shrink-0 bg-gray-900 text-white text-xs font-bold px-4 py-2.5 text-left flex justify-between"
          >
            <span>Ride in progress · {liveRide.drop.name}</span>
            <span>View →</span>
          </button>
        )}
        <RideBookingScreen
          profile={profile}
          trips={trips}
          hasLiveRide={!!liveRide}
          onRideRequested={(id, unconfirmed) => {
            setDismissed((s) => {
              const n = new Set(s);
              n.delete(id);
              return n;
            });
            setFocused({ id, unconfirmed });
          }}
          onOpenSavedPlaces={() => setOverlay('saved_places')}
        />
      </div>
    );
  else if (tab === 'bookings')
    content = (
      <TripsHistoryScreen
        profile={profile}
        trips={trips}
        loading={tripsLoading}
        error={tripsError}
        onRetry={() => setTripsKey((k) => k + 1)}
        onOpenTrip={(t) => {
          setFocused({ id: t.id, unconfirmed: false });
          setTab('home');
        }}
      />
    );
  else if (tab === 'notifications') content = <NotificationsScreen notifications={notifications} />;
  else
    content = (
      <ProfileScreen
        user={profile}
        onOpenSavedPlaces={() => setOverlay('saved_places')}
        onOpenSupport={() => setOverlay('support')}
        onLogout={() => void signOutUser()}
      />
    );

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[#F7F7F7]">
      <AppHeader
        user={profile}
        activeTab={tab}
        onSelectTab={selectTab}
        unreadNotificationsCount={unread}
        onOpenOffers={() => setOverlay('offers')}
      />
      <main className="flex-1 flex flex-col min-h-0">{content}</main>
      <div className="md:hidden shrink-0">
        <BottomNavigation activeTab={tab} onSelectTab={selectTab} unreadCount={unread} />
      </div>
    </div>
  );
};
