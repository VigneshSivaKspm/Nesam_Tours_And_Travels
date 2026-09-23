import React, { useState, useEffect } from 'react';
import {
  LocationItem,
  TripRecord,
  UserProfile,
} from './types';

import { AppHeader } from './components/AppHeader';
import { BottomNavigation, NavTab } from './components/BottomNavigation';

// Screens
import { OnboardingFlow } from './screens/OnboardingFlow';
import { HomeScreen } from './screens/HomeScreen';
import { BookingFlowScreen } from './screens/BookingFlowScreen';
import { TrackingScreen } from './screens/TrackingScreen';
import { TripsHistoryScreen } from './screens/TripsHistoryScreen';
import { SavedPlacesScreen } from './screens/SavedPlacesScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { OffersScreen } from './screens/OffersScreen';
import { SupportScreen } from './screens/SupportScreen';
import { ProfileScreen } from './screens/ProfileScreen';

import {
  subscribeToUserBookings,
  createBookingInFirestore,
  cancelBookingInFirestore,
  getExistingCustomerProfile,
} from './services/userFirestoreService';
import { subscribeToAuthUser, signOutUser } from './services/authService';

const fallbackTrip: TripRecord = {
  id: 'BK-SAMPLE',
  bookingId: 'NTT-2024-0001',
  pickup: { id: 'p1', name: 'Chennai Central', address: 'Kannappar Thidal, Chennai', type: 'other' },
  drop: { id: 'd1', name: 'Chennai Airport Gate 4', address: 'Meenambakkam, Chennai', type: 'airport' },
  tripType: 'Airport',
  date: 'Today',
  time: '10:30 AM',
  vehicle: {
    id: 'veh-sedan',
    name: 'Dzire / Etios',
    category: 'Sedan',
    passengers: 4,
    luggage: 2,
    basePrice: 450,
    perKmRate: 13,
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=300&auto=format&fit=crop&q=80',
    tagline: 'Comfortable sedans with AC',
    eta: '4 mins away'
  },
  fare: 750,
  status: 'Confirmed',
  paymentStatus: 'Paid',
  paymentMethod: 'UPI',
  distanceKm: 22,
  duration: '45 mins',
  otp: '4892'
};

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Primary Navigation State
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [currentScreen, setCurrentScreen] = useState<
    'main' | 'booking_flow' | 'tracking' | 'saved_places' | 'offers' | 'support'
  >('main');

  // Active Data Context
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [activeTrackingTrip, setActiveTrackingTrip] = useState<TripRecord>(fallbackTrip);
  const [bookingServiceType, setBookingServiceType] = useState<
    'Local' | 'Outstation' | 'Airport' | 'One Way' | 'Round Trip'
  >('Outstation');
  const [bookingPreselectedDrop, setBookingPreselectedDrop] = useState<LocationItem | undefined>(undefined);

  // Bootstrap the session from Firebase Auth — a returning user with a
  // persisted session skips OnboardingFlow entirely on page load/refresh.
  useEffect(() => {
    const unsubscribe = subscribeToAuthUser(async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setAuthLoading(false);
        return;
      }
      const profile = await getExistingCustomerProfile(fbUser.uid);
      setUser(profile);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to real-time Firestore bookings for the signed-in customer
  useEffect(() => {
    if (!user) return undefined;
    const unsubscribe = subscribeToUserBookings(user.uid, (liveTrips) => {
      setTrips(liveTrips);
      if (liveTrips.length > 0) {
        const ongoing = liveTrips.find(t => t.status === 'Confirmed' || t.status === 'Driver Assigned' || t.status === 'Trip Started');
        if (ongoing) setActiveTrackingTrip(ongoing);
        else setActiveTrackingTrip(liveTrips[0]);
      }
    });

    return () => unsubscribe();
  }, [user]);

  if (authLoading) {
    return (
      <div className="web-app-container items-center justify-center bg-[#F7F7F7]">
        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Loading...</span>
      </div>
    );
  }

  // If user is not logged in / onboarded
  if (!user) {
    return (
      <div className="web-app-container items-center justify-center bg-[#F7F7F7] p-4">
        <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-xl border border-gray-200">
          <OnboardingFlow
            onComplete={(completedUser) => {
              setUser(completedUser);
            }}
          />
        </div>
      </div>
    );
  }

  // Handle Starting a New Booking Journey
  const handleStartBooking = (
    serviceType: 'Local' | 'Outstation' | 'Airport' | 'One Way' | 'Round Trip',
    dropLocation?: LocationItem
  ) => {
    setBookingServiceType(serviceType);
    setBookingPreselectedDrop(dropLocation);
    setCurrentScreen('booking_flow');
  };

  // Handle Booking Confirmed
  const handleBookingConfirmed = (newTrip: TripRecord) => {
    setTrips([newTrip, ...trips]);
    setActiveTrackingTrip(newTrip);
    setCurrentScreen('tracking');
    // Save to Firestore in real-time
    createBookingInFirestore(newTrip, user.uid);
  };

  // Handle Cancel Trip
  const handleCancelTrip = (tripId: string, reason?: string) => {
    setTrips(
      trips.map((t) =>
        t.id === tripId ? { ...t, status: 'Cancelled', paymentStatus: 'Refunded' } : t
      )
    );
    cancelBookingInFirestore(tripId, reason);
  };

  const unreadNotifCount = 0;

  return (
    <div className="web-app-container">
      {/* Full-width Desktop & Mobile Web Navigation Header */}
      <AppHeader
        user={user}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setCurrentScreen('main');
        }}
        unreadNotificationsCount={unreadNotifCount}
        onOpenNotifications={() => {
          setActiveTab('notifications');
          setCurrentScreen('main');
        }}
        onOpenSavedPlaces={() => setCurrentScreen('saved_places')}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col min-h-0 bg-[#F7F7F7]">
        {currentScreen === 'booking_flow' ? (
          <BookingFlowScreen
            initialServiceType={bookingServiceType}
            initialDropLocation={bookingPreselectedDrop}
            onCancel={() => setCurrentScreen('main')}
            onBookingConfirmed={handleBookingConfirmed}
          />
        ) : currentScreen === 'tracking' ? (
          <TrackingScreen
            trip={activeTrackingTrip}
            onBack={() => setCurrentScreen('main')}
            onTripCompleted={() => {
              setActiveTab('trips');
              setCurrentScreen('main');
            }}
          />
        ) : currentScreen === 'saved_places' ? (
          <div className="max-web-width mx-auto w-full py-6">
            <SavedPlacesScreen ownerId={user.uid} onBack={() => setCurrentScreen('main')} />
          </div>
        ) : currentScreen === 'offers' ? (
          <div className="max-web-width mx-auto w-full py-6">
            <OffersScreen onApplyOffer={() => handleStartBooking('Outstation')} onBack={() => setCurrentScreen('main')} />
          </div>
        ) : currentScreen === 'support' ? (
          <div className="max-web-width mx-auto w-full py-6">
            <SupportScreen customerId={user.uid} onBack={() => setCurrentScreen('main')} />
          </div>
        ) : (
          /* Main Tab Routing */
          <>
            {activeTab === 'home' && (
              <HomeScreen
                onStartBooking={handleStartBooking}
                onOpenSavedPlaces={() => setCurrentScreen('saved_places')}
                onOpenOffers={() => setCurrentScreen('offers')}
              />
            )}

            {activeTab === 'bookings' && (
              <div className="max-web-width mx-auto w-full py-6">
                <TripsHistoryScreen
                  trips={trips}
                  onTrackTrip={(trip) => {
                    setActiveTrackingTrip(trip);
                    setCurrentScreen('tracking');
                  }}
                  onCancelTrip={handleCancelTrip}
                />
              </div>
            )}

            {activeTab === 'trips' && (
              <TrackingScreen
                trip={activeTrackingTrip}
                onBack={() => setActiveTab('home')}
                onTripCompleted={() => setActiveTab('bookings')}
              />
            )}

            {activeTab === 'notifications' && (
              <div className="max-web-width mx-auto w-full py-6">
                <NotificationsScreen recipientId={user.uid} />
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="max-web-width mx-auto w-full py-6">
                <ProfileScreen
                  user={user}
                  onUpdateUser={(updated) => setUser(updated)}
                  onOpenSavedPlaces={() => setCurrentScreen('saved_places')}
                  onOpenSupport={() => setCurrentScreen('support')}
                  onLogout={() => { signOutUser(); }}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Mobile-only Bottom Bar (Hidden on md+ desktop screens) */}
      {currentScreen === 'main' && (
        <div className="md:hidden sticky bottom-0 z-30">
          <BottomNavigation
            activeTab={activeTab}
            onSelectTab={(tab) => setActiveTab(tab)}
            unreadCount={unreadNotifCount}
          />
        </div>
      )}
    </div>
  );
}
