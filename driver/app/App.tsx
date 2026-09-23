import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Colors } from './src/theme/colors';
import { DriverStatus, TripDetails } from './src/types/driver';
import { DEFAULT_DRIVER_PROFILE, DEFAULT_ACTIVE_TRIP, DEFAULT_AVAILABLE_TRIPS, DEFAULT_EARNINGS } from './src/config/constants';

import { DriverHeader } from './src/components/DriverHeader';
import { BottomNav } from './src/components/BottomNav';
import { HomeScreen } from './src/screens/HomeScreen';
import { PreTripVerificationScreen } from './src/screens/PreTripVerificationScreen';
import { TripExecutionScreen } from './src/screens/TripExecutionScreen';
import { EarningsScreen } from './src/screens/EarningsScreen';
import { WalletScreen } from './src/screens/WalletScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [status, setStatus] = useState<DriverStatus>('Online');

  const [activeTrip, setActiveTrip] = useState<TripDetails | null>(DEFAULT_ACTIVE_TRIP);
  const [availableTrips, setAvailableTrips] = useState<TripDetails[]>(DEFAULT_AVAILABLE_TRIPS);
  const [earnings, setEarnings] = useState(DEFAULT_EARNINGS);

  const [inPreTrip, setInPreTrip] = useState<boolean>(false);

  const handleStatusToggle = (newStatus: DriverStatus) => {
    setStatus(newStatus);
  };

  const handleAcceptTrip = (trip: TripDetails) => {
    setActiveTrip({ ...trip, status: 'Assigned' });
    setAvailableTrips(prev => prev.filter(t => t.id !== trip.id));
    setActiveTab('home');
  };

  const handleCompletePreTrip = (startOdometer: number) => {
    if (activeTrip) {
      setActiveTrip({
        ...activeTrip,
        status: 'En Route Pickup',
        startOdometer
      });
    }
    setInPreTrip(false);
    setActiveTab('trip');
  };

  const handleUpdateTripStatus = (newTripStatus: any, extraData?: any) => {
    if (!activeTrip) return;
    const updated = {
      ...activeTrip,
      status: newTripStatus,
      ...extraData
    };
    setActiveTrip(updated);

    if (newTripStatus === 'Completed') {
      const payout = (updated.driverEarnings || 702) + (updated.tollAmount || 0);
      setEarnings(prev => ({
        ...prev,
        today: prev.today + payout,
        walletBalance: prev.walletBalance + payout
      }));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.black} />

      {/* Header */}
      <DriverHeader
        status={status}
        onStatusToggle={handleStatusToggle}
        profile={MOCK_DRIVER_PROFILE}
        walletBalance={earnings.walletBalance}
      />

      {/* Screen Routing */}
      <View style={styles.screenContainer}>
        {inPreTrip && activeTrip ? (
          <PreTripVerificationScreen
            trip={activeTrip}
            onComplete={handleCompletePreTrip}
            onCancel={() => setInPreTrip(false)}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeScreen
                status={status}
                onStatusToggle={handleStatusToggle}
                profile={MOCK_DRIVER_PROFILE}
                activeTrip={activeTrip}
                availableTrips={availableTrips}
                earnings={earnings}
                onStartPreTrip={() => setInPreTrip(true)}
                onContinueTrip={() => setActiveTab('trip')}
                onAcceptTrip={handleAcceptTrip}
              />
            )}

            {activeTab === 'trip' && activeTrip && (
              <TripExecutionScreen
                trip={activeTrip}
                onUpdateStatus={handleUpdateTripStatus}
              />
            )}

            {activeTab === 'earnings' && <EarningsScreen earnings={earnings} />}

            {activeTab === 'wallet' && (
              <WalletScreen
                balance={earnings.walletBalance}
                onRequestPayout={(amount) => {
                  setEarnings(prev => ({ ...prev, walletBalance: prev.walletBalance - amount }));
                }}
              />
            )}

            {activeTab === 'profile' && <ProfileScreen profile={MOCK_DRIVER_PROFILE} />}
          </>
        )}
      </View>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasActiveTrip={Boolean(activeTrip && activeTrip.status !== 'Completed')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  screenContainer: { flex: 1, backgroundColor: Colors.background }
});
