import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { VendorTrip } from '../types/vendor';

interface TripAssignmentScreenProps {
  activeTrips: VendorTrip[];
}

export const TripAssignmentScreen: React.FC<TripAssignmentScreenProps> = ({ activeTrips }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Text style={styles.title}>Active Dispatched Trips</Text>
        <Text style={styles.sub}>Real-time Fleet Driver Monitoring</Text>
      </View>

      {activeTrips.map(t => (
        <View key={t.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.bookingId}>{t.bookingId}</Text>
            <Text style={styles.status}>{t.status}</Text>
          </View>
          <Text style={styles.customer}>{t.customerName}</Text>
          <Text style={styles.route}>Route: {t.route}</Text>
          <Text style={styles.driver}>Assigned Driver: {t.driverName}</Text>
          <Text style={styles.vehicle}>Vehicle: {t.vehicleNumber}</Text>
          <Text style={styles.payout}>Net Vendor Payout: ₹{t.vendorPayout}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  banner: { backgroundColor: Colors.black, borderRadius: 16, padding: 16, marginBottom: 14 },
  title: { color: Colors.white, fontSize: 18, fontWeight: '900' },
  sub: { color: Colors.primary, fontSize: 11, fontWeight: '700', marginTop: 2 },
  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookingId: { fontSize: 11, fontFamily: 'monospace', color: Colors.secondaryText },
  status: { backgroundColor: '#FEE2E2', color: Colors.primary, fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  customer: { fontSize: 14, fontWeight: '800', color: Colors.black, marginTop: 4 },
  route: { fontSize: 12, color: Colors.black, marginTop: 2 },
  driver: { fontSize: 11, color: Colors.secondaryText, marginTop: 4, fontWeight: '700' },
  vehicle: { fontSize: 11, color: Colors.secondaryText, fontFamily: 'monospace' },
  payout: { fontSize: 16, fontWeight: '900', color: Colors.primary, marginTop: 6 }
});
