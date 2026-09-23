import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, Text } from 'react-native';
import { Colors } from './src/theme/colors';
import { HomeScreen } from './src/screens/HomeScreen';
import { BookingScreen } from './src/screens/BookingScreen';
import { TripsScreen } from './src/screens/TripsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.black} />

      <View style={styles.content}>
        {activeTab === 'home' && (
          <HomeScreen onStartBooking={() => setActiveTab('booking')} />
        )}
        {activeTab === 'booking' && (
          <BookingScreen onBack={() => setActiveTab('home')} />
        )}
        {activeTab === 'trips' && (
          <TripsScreen onBack={() => setActiveTab('home')} />
        )}
        {activeTab === 'profile' && (
          <ProfileScreen onBack={() => setActiveTab('home')} />
        )}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        {[
          { id: 'home', label: 'Home', icon: '🏠' },
          { id: 'booking', label: 'Book Ride', icon: '🚖' },
          { id: 'trips', label: 'My Rides', icon: '📄' },
          { id: 'profile', label: 'Profile', icon: '👤' }
        ].map(t => (
          <TouchableOpacity
            key={t.id}
            style={styles.navBtn}
            onPress={() => setActiveTab(t.id as any)}
          >
            <Text style={styles.navIcon}>{t.icon}</Text>
            <Text style={[styles.navLabel, activeTab === t.id && styles.navLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  content: { flex: 1, backgroundColor: Colors.lightBg },
  bottomNav: {
    backgroundColor: Colors.black,
    flexDirection: 'row',
    height: 60,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    alignItems: 'center',
    justifyContent: 'space-around'
  },
  navBtn: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  navIcon: { fontSize: 18 },
  navLabel: { color: '#9CA3AF', fontSize: 10, marginTop: 2, fontWeight: '600' },
  navLabelActive: { color: Colors.primary, fontWeight: '900' }
});
