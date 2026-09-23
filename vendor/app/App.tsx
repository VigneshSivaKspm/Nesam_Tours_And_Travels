import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Colors } from './src/theme/colors';
import { OpenTrip, VendorTrip } from './src/types/vendor';
import { DEFAULT_VENDOR_PROFILE, DEFAULT_VEHICLES, DEFAULT_OPEN_TRIPS, DEFAULT_ACTIVE_TRIPS } from './src/config/constants';

import { VendorHeader } from './src/components/VendorHeader';
import { BottomNav } from './src/components/BottomNav';
import { HomeScreen } from './src/screens/HomeScreen';
import { FleetScreen } from './src/screens/FleetScreen';
import { MarketplaceScreen } from './src/screens/MarketplaceScreen';
import { TripAssignmentScreen } from './src/screens/TripAssignmentScreen';
import { WalletScreen } from './src/screens/WalletScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [openTrips, setOpenTrips] = useState<OpenTrip[]>(DEFAULT_OPEN_TRIPS);
  const [activeTrips, setActiveTrips] = useState<VendorTrip[]>(DEFAULT_ACTIVE_TRIPS);
  const [walletBalance, setWalletBalance] = useState<number>(48500);

  const handleAcceptTrip = (trip: OpenTrip) => {
    const newActive: VendorTrip = {
      id: `VT-${Date.now()}`,
      bookingId: trip.bookingId,
      customerName: 'Verified Booking Customer',
      route: trip.route,
      driverName: 'Muthu Kumar',
      vehicleNumber: 'TN 09 BX 4821',
      vendorPayout: Math.round(trip.offeredPayout * 0.9),
      status: 'Assigned'
    };

    setActiveTrips([newActive, ...activeTrips]);
    setOpenTrips(prev => prev.filter(t => t.id !== trip.id));
    setActiveTab('trips');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.black} />

      <VendorHeader profile={MOCK_VENDOR_PROFILE} walletBalance={walletBalance} />

      <View style={styles.screenContainer}>
        {activeTab === 'home' && (
          <HomeScreen
            profile={MOCK_VENDOR_PROFILE}
            vehicles={MOCK_VEHICLES}
            openTrips={openTrips}
            activeTrips={activeTrips}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'fleet' && <FleetScreen vehicles={MOCK_VEHICLES} />}

        {activeTab === 'marketplace' && (
          <MarketplaceScreen openTrips={openTrips} onAcceptTrip={handleAcceptTrip} />
        )}

        {activeTab === 'trips' && <TripAssignmentScreen activeTrips={activeTrips} />}

        {activeTab === 'wallet' && <WalletScreen balance={walletBalance} />}

        {activeTab === 'profile' && <ProfileScreen profile={MOCK_VENDOR_PROFILE} />}
      </View>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} openTripsCount={openTrips.length} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  screenContainer: { flex: 1, backgroundColor: Colors.background }
});
