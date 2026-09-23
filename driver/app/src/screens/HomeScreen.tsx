import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../theme/colors';
import { DriverStatus, DriverProfile, TripDetails, EarningsData } from '../types/driver';

interface HomeScreenProps {
  status: DriverStatus;
  onStatusToggle: (status: DriverStatus) => void;
  profile: DriverProfile;
  activeTrip: TripDetails | null;
  availableTrips: TripDetails[];
  earnings: EarningsData;
  onStartPreTrip: (trip: TripDetails) => void;
  onContinueTrip: () => void;
  onAcceptTrip: (trip: TripDetails) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  status,
  onStatusToggle,
  profile,
  activeTrip,
  availableTrips,
  earnings,
  onStartPreTrip,
  onContinueTrip,
  onAcceptTrip
}) => {
  const isOnline = status === 'Online' || status === 'On-Duty' || status === 'Assigned Trip' || status === 'On Trip';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* Profile Overview Header Card */}
      <View style={styles.profileCard}>
        <Image source={{ uri: profile.photoUrl }} style={styles.profileImage} />
        <View style={{ flex: 1 }}>
          <Text style={styles.driverName}>{profile.name}</Text>
          <Text style={styles.vehicleInfo}>{profile.vehicleModel} • {profile.vehicleNumber}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.ratingText}>★ {profile.rating}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.statsText}>{profile.totalTrips} Rides Completed</Text>
          </View>
        </View>
      </View>

      {/* Quick Earnings Dashboard */}
      <View style={styles.earningsGrid}>
        <View style={styles.earningBox}>
          <Text style={styles.earningLabel}>Today's Earned</Text>
          <Text style={styles.earningVal}>₹{earnings.today}</Text>
        </View>
        <View style={styles.earningBox}>
          <Text style={styles.earningLabel}>Wallet Balance</Text>
          <Text style={styles.earningValSecondary}>₹{earnings.walletBalance}</Text>
        </View>
      </View>

      {/* Active Trip Banner Card */}
      {activeTrip && (
        <View style={styles.activeTripCard}>
          <View style={styles.tripHeader}>
            <Text style={styles.activeTag}>ASSIGNED RIDE</Text>
            <Text style={styles.bookingId}>{activeTrip.bookingId}</Text>
          </View>

          <Text style={styles.customerName}>{activeTrip.customerName}</Text>
          
          <View style={styles.locationBlock}>
            <Text style={styles.locationLabel}>📍 PICKUP ({activeTrip.pickupDistanceKm} km away)</Text>
            <Text style={styles.locationText}>{activeTrip.pickupAddress}</Text>
          </View>

          <View style={styles.locationBlock}>
            <Text style={styles.locationLabelRed}>🏁 DROP LOCATION</Text>
            <Text style={styles.locationText}>{activeTrip.dropAddress}</Text>
          </View>

          <View style={styles.fareRow}>
            <View>
              <Text style={styles.fareLabel}>Net Driver Payout</Text>
              <Text style={styles.fareVal}>₹{activeTrip.driverEarnings}</Text>
            </View>

            {activeTrip.status === 'Assigned' || activeTrip.status === 'Pre-Trip Pending' ? (
              <TouchableOpacity
                style={styles.preTripBtn}
                onPress={() => onStartPreTrip(activeTrip)}
              >
                <Text style={styles.preTripBtnText}>Pre-Trip Verification</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.continueBtn} onPress={onContinueTrip}>
                <Text style={styles.continueBtnText}>Open Navigation</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Available Trip Feed */}
      <View style={styles.feedSection}>
        <Text style={styles.sectionTitle}>Available Nearby Trips</Text>

        {!isOnline ? (
          <View style={styles.offlineBox}>
            <Text style={styles.offlineTitle}>You are currently Offline</Text>
            <Text style={styles.offlineSub}>Go online to start receiving ride dispatches near you.</Text>
            <TouchableOpacity style={styles.goOnlineBtn} onPress={() => onStatusToggle('Online')}>
              <Text style={styles.goOnlineText}>Go Online</Text>
            </TouchableOpacity>
          </View>
        ) : (
          availableTrips.map(t => (
            <View key={t.id} style={styles.tripItem}>
              <View style={styles.tripItemHeader}>
                <Text style={styles.bookingId}>{t.bookingId}</Text>
                <Text style={styles.distBadge}>{t.pickupDistanceKm} KM away</Text>
              </View>

              <Text style={styles.customerName}>{t.customerName}</Text>
              <Text style={styles.locationText}>📍 {t.pickupAddress}</Text>
              <Text style={styles.locationText}>🏁 {t.dropAddress}</Text>

              <View style={styles.itemFooter}>
                <Text style={styles.fareVal}>₹{t.driverEarnings}</Text>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => onAcceptTrip(t)}>
                  <Text style={styles.acceptBtnText}>Accept Ride</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 32 },
  profileCard: {
    backgroundColor: Colors.black,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16
  },
  profileImage: {
    width: 54,
    height: 54,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary
  },
  driverName: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  vehicleInfo: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  ratingText: { color: Colors.warning, fontWeight: '800', fontSize: 12 },
  dot: { color: '#6B7280' },
  statsText: { color: Colors.success, fontWeight: '700', fontSize: 11 },

  earningsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  earningBox: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border
  },
  earningLabel: { fontSize: 11, color: Colors.secondaryText },
  earningVal: { fontSize: 20, fontWeight: '900', color: Colors.primary, marginTop: 4 },
  earningValSecondary: { fontSize: 20, fontWeight: '900', color: Colors.black, marginTop: 4 },

  activeTripCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: 16
  },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  activeTag: { backgroundColor: Colors.primary, color: Colors.white, fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  bookingId: { fontSize: 11, fontFamily: 'monospace', color: Colors.secondaryText },
  customerName: { fontSize: 15, fontWeight: '800', color: Colors.black, marginBottom: 8 },
  locationBlock: { marginBottom: 6 },
  locationLabel: { fontSize: 10, fontWeight: '800', color: Colors.success },
  locationLabelRed: { fontSize: 10, fontWeight: '800', color: Colors.primary },
  locationText: { fontSize: 12, color: Colors.black, marginTop: 1 },

  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  fareLabel: { fontSize: 10, color: Colors.secondaryText },
  fareVal: { fontSize: 18, fontWeight: '900', color: Colors.primary },
  preTripBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  preTripBtnText: { color: Colors.white, fontWeight: '800', fontSize: 12 },
  continueBtn: { backgroundColor: Colors.black, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  continueBtnText: { color: Colors.white, fontWeight: '800', fontSize: 12 },

  feedSection: { marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.black, marginBottom: 12 },
  offlineBox: { backgroundColor: Colors.white, borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  offlineTitle: { fontSize: 14, fontWeight: '800', color: Colors.black },
  offlineSub: { fontSize: 11, color: Colors.secondaryText, textAlign: 'center', marginTop: 4 },
  goOnlineBtn: { backgroundColor: Colors.success, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 12 },
  goOnlineText: { color: Colors.white, fontWeight: '800', fontSize: 12 },

  tripItem: { backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  tripItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  distBadge: { fontSize: 10, fontWeight: '700', color: Colors.success, backgroundColor: '#E6F4EA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  acceptBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  acceptBtnText: { color: Colors.white, fontWeight: '800', fontSize: 12 }
});
