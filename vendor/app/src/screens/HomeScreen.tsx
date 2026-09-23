import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { VendorProfile, FleetVehicle, OpenTrip, VendorTrip } from '../types/vendor';

interface HomeScreenProps {
  profile: VendorProfile;
  vehicles: FleetVehicle[];
  openTrips: OpenTrip[];
  activeTrips: VendorTrip[];
  onNavigate: (tab: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  profile,
  vehicles,
  openTrips,
  activeTrips,
  onNavigate
}) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* Corporate Fleet Banner */}
      <View style={styles.heroCard}>
        <Text style={styles.heroTag}>VERIFIED CORPORATE FLEET</Text>
        <Text style={styles.heroTitle}>{profile.companyName}</Text>
        <Text style={styles.heroGst}>GSTIN: {profile.gstin}</Text>
      </View>

      {/* KPI Stats */}
      <View style={styles.grid}>
        <TouchableOpacity style={styles.box} onPress={() => onNavigate('fleet')}>
          <Text style={styles.label}>Fleet Vehicles</Text>
          <Text style={styles.valRed}>{vehicles.length}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.box} onPress={() => onNavigate('marketplace')}>
          <Text style={styles.label}>Open Trips Feed</Text>
          <Text style={styles.valYellow}>{openTrips.length}</Text>
        </TouchableOpacity>
      </View>

      {/* Active Trips Dispatch */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Dispatched Trips</Text>
          <TouchableOpacity onPress={() => onNavigate('trips')}>
            <Text style={styles.linkText}>View All →</Text>
          </TouchableOpacity>
        </View>

        {activeTrips.map(t => (
          <View key={t.id} style={styles.tripItem}>
            <View style={styles.tripRow}>
              <Text style={styles.bookingId}>{t.bookingId}</Text>
              <Text style={styles.statusTag}>{t.status}</Text>
            </View>
            <Text style={styles.customerName}>{t.customerName}</Text>
            <Text style={styles.routeText}>{t.route}</Text>
            <Text style={styles.driverInfo}>Driver: {t.driverName} ({t.vehicleNumber})</Text>
            <Text style={styles.payoutText}>Net Vendor Payout: ₹{t.vendorPayout}</Text>
          </View>
        ))}
      </View>

      {/* Open Bidding Feed */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Open Marketplace Rides</Text>
          <TouchableOpacity onPress={() => onNavigate('marketplace')}>
            <Text style={styles.linkText}>Bid Engine →</Text>
          </TouchableOpacity>
        </View>

        {openTrips.map(ot => (
          <View key={ot.id} style={styles.tripItem}>
            <View style={styles.tripRow}>
              <Text style={styles.bookingId}>{ot.bookingId}</Text>
              <Text style={styles.vehicleCategory}>{ot.vehicleCategory}</Text>
            </View>
            <Text style={styles.routeText}>{ot.route}</Text>
            <View style={styles.payoutRow}>
              <Text style={styles.payoutText}>Offered Rate: ₹{ot.offeredPayout}</Text>
              <TouchableOpacity style={styles.bidBtn} onPress={() => onNavigate('marketplace')}>
                <Text style={styles.bidBtnText}>Bid / Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 32 },
  heroCard: { backgroundColor: Colors.black, borderRadius: 16, padding: 16, marginBottom: 16 },
  heroTag: { color: Colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: Colors.white, fontSize: 18, fontWeight: '900', marginTop: 4 },
  heroGst: { color: '#9CA3AF', fontSize: 11, fontFamily: 'monospace', marginTop: 2 },

  grid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  box: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  label: { fontSize: 11, color: Colors.secondaryText },
  valRed: { fontSize: 22, fontWeight: '900', color: Colors.primary, marginTop: 4 },
  valYellow: { fontSize: 22, fontWeight: '900', color: Colors.warning, marginTop: 4 },

  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.black },
  linkText: { fontSize: 12, fontWeight: '800', color: Colors.primary },

  tripItem: { backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  tripRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  bookingId: { fontSize: 11, fontFamily: 'monospace', color: Colors.secondaryText },
  statusTag: { backgroundColor: '#FEE2E2', color: Colors.primary, fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  vehicleCategory: { backgroundColor: '#FEF3C7', color: '#92400E', fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  customerName: { fontSize: 14, fontWeight: '800', color: Colors.black },
  routeText: { fontSize: 12, color: Colors.black, marginTop: 2 },
  driverInfo: { fontSize: 11, color: Colors.secondaryText, marginTop: 4, fontFamily: 'monospace' },
  payoutText: { fontSize: 14, fontWeight: '900', color: Colors.primary, marginTop: 6 },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  bidBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  bidBtnText: { color: Colors.white, fontWeight: '800', fontSize: 11 }
});
