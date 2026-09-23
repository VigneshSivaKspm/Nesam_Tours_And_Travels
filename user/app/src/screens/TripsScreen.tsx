import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '../theme/colors';

interface TripsScreenProps {
  onBack: () => void;
}

export function TripsScreen({ onBack }: TripsScreenProps) {
  const trips = [
    {
      id: 'NST99482',
      date: '24 Aug 2026, 06:30 AM',
      type: 'Outstation (One Way)',
      route: 'Chennai Airport → Tidel Park, OMR',
      vehicle: 'Toyota Innova Crysta',
      driver: 'Senthil Nathan (+91 98400 12345)',
      fare: 2850,
      status: 'Confirmed',
      paymentStatus: 'Paid (Razorpay)',
      otp: '4920'
    },
    {
      id: 'NST88120',
      date: '18 Aug 2026, 09:00 AM',
      type: 'Local Rental (8 hr / 80 km)',
      route: 'Coimbatore Local City Package',
      vehicle: 'Maruti Suzuki Dzire',
      driver: 'Karthik Raja (+91 98450 67890)',
      fare: 1800,
      status: 'Completed',
      paymentStatus: 'Paid',
      otp: '9182'
    }
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Trip Bookings & Invoices</Text>
      </View>

      {trips.map(t => (
        <View key={t.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.bookingId}>{t.id}</Text>
            <Text style={[styles.statusTag, t.status === 'Completed' ? styles.statusCompleted : styles.statusConfirmed]}>
              {t.status}
            </Text>
          </View>

          <Text style={styles.routeText}>{t.route}</Text>
          <Text style={styles.typeText}>{t.type} • {t.date}</Text>
          <Text style={styles.driverText}>Driver: {t.driver}</Text>
          <Text style={styles.vehicleText}>Vehicle: {t.vehicle}</Text>

          <View style={styles.footerRow}>
            <div>
              <Text style={styles.fareLabel}>Total Fare Paid</Text>
              <Text style={styles.fareVal}>₹{t.fare} <Text style={styles.payStatus}>({t.paymentStatus})</Text></Text>
            </div>

            <TouchableOpacity
              style={styles.pdfBtn}
              onPress={() => Alert.alert('Download Invoice', `PDF Tax Invoice for ${t.id} downloaded!`)}
            >
              <Text style={styles.pdfBtnText}>📄 PDF Invoice</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { color: Colors.primary, fontWeight: '800', fontSize: 13 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: Colors.black, marginLeft: 12 },

  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  row: { flexDirection: 'row', justifyBetween: 'space-between', alignItems: 'center' },
  bookingId: { fontSize: 11, fontFamily: 'monospace', color: Colors.textSecondary },
  statusTag: { fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusConfirmed: { backgroundColor: '#DBEAFE', color: '#1E40AF' },
  statusCompleted: { backgroundColor: '#E6F4EA', color: Colors.success },

  routeText: { fontSize: 14, fontWeight: '800', color: Colors.black, marginTop: 4 },
  typeText: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  driverText: { fontSize: 11, color: Colors.black, marginTop: 4, fontWeight: '700' },
  vehicleText: { fontSize: 11, color: Colors.textSecondary },

  footerRow: { flexDirection: 'row', justifyBetween: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  fareLabel: { fontSize: 9, color: Colors.textSecondary },
  fareVal: { fontSize: 15, fontWeight: '900', color: Colors.primary },
  payStatus: { fontSize: 10, color: Colors.textSecondary, fontWeight: 'normal' },

  pdfBtn: { backgroundColor: Colors.black, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  pdfBtnText: { color: Colors.white, fontSize: 10, fontWeight: '800' }
});
