import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Colors } from '../theme/colors';
import { OpenTrip } from '../types/vendor';

interface MarketplaceScreenProps {
  openTrips: OpenTrip[];
  onAcceptTrip: (trip: OpenTrip) => void;
}

export const MarketplaceScreen: React.FC<MarketplaceScreenProps> = ({ openTrips, onAcceptTrip }) => {
  const [selectedTrip, setSelectedTrip] = useState<OpenTrip | null>(null);
  const [counterRate, setCounterRate] = useState<string>('4500');
  const [successMsg, setSuccessMsg] = useState<boolean>(false);

  const handleSubmitCounter = () => {
    setSuccessMsg(true);
    setSelectedTrip(null);
    setTimeout(() => setSuccessMsg(false), 3000);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Text style={styles.title}>Trip Marketplace Feed</Text>
        <Text style={styles.sub}>Accept Offered Rate or Submit Counter Bid</Text>
      </View>

      {successMsg && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>✓ Counter Bid Submitted to Customer & Admin!</Text>
        </View>
      )}

      {openTrips.map(ot => (
        <View key={ot.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.bookingId}>{ot.bookingId}</Text>
            <Text style={styles.category}>{ot.vehicleCategory}</Text>
          </View>
          <Text style={styles.route}>{ot.route}</Text>
          <Text style={styles.date}>Travel Date: {ot.travelDate}</Text>
          
          <View style={styles.footerRow}>
            <Text style={styles.payout}>Offered: ₹{ot.offeredPayout}</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.bidBtn} onPress={() => setSelectedTrip(ot)}>
                <Text style={styles.bidBtnText}>Counter Bid</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.acceptBtn} onPress={() => onAcceptTrip(ot)}>
                <Text style={styles.acceptBtnText}>Accept Rate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}

      {/* Counter Bid Prompt Modal / Section */}
      {selectedTrip && (
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Submit Counter Bid: {selectedTrip.bookingId}</Text>
          <Text style={styles.modalSub}>Customer Rate: ₹{selectedTrip.offeredPayout}</Text>

          <Text style={styles.label}>Your Proposed Rate (₹)</Text>
          <TextInput
            style={styles.input}
            value={counterRate}
            onChangeText={setCounterRate}
            keyboardType="numeric"
          />

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitCounter}>
            <Text style={styles.submitBtnText}>Submit Bid Proposal</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setSelectedTrip(null)} style={{ marginTop: 8, alignItems: 'center' }}>
            <Text style={{ color: Colors.secondaryText, fontSize: 11, fontWeight: '700' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  banner: { backgroundColor: Colors.black, borderRadius: 16, padding: 16, marginBottom: 14 },
  title: { color: Colors.white, fontSize: 18, fontWeight: '900' },
  sub: { color: Colors.warning, fontSize: 11, fontWeight: '700', marginTop: 2 },
  successBox: { backgroundColor: '#E6F4EA', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.success, marginBottom: 12 },
  successText: { color: Colors.success, fontWeight: '800', fontSize: 12, textAlign: 'center' },

  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookingId: { fontSize: 11, fontFamily: 'monospace', color: Colors.secondaryText },
  category: { backgroundColor: '#FEF3C7', color: '#92400E', fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  route: { fontSize: 14, fontWeight: '800', color: Colors.black, marginTop: 4 },
  date: { fontSize: 11, color: Colors.secondaryText, marginTop: 2 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  payout: { fontSize: 16, fontWeight: '900', color: Colors.primary },
  btnRow: { flexDirection: 'row', gap: 6 },
  bidBtn: { backgroundColor: Colors.darkCharcoal, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  bidBtnText: { color: Colors.white, fontWeight: '800', fontSize: 11 },
  acceptBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  acceptBtnText: { color: Colors.white, fontWeight: '800', fontSize: 11 },

  modalCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 2, borderColor: Colors.primary, marginTop: 10 },
  modalTitle: { fontSize: 14, fontWeight: '800', color: Colors.black },
  modalSub: { fontSize: 11, color: Colors.secondaryText, marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.black, marginTop: 4 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10, fontSize: 16, fontWeight: '900', color: Colors.primary, marginTop: 4 },
  submitBtn: { backgroundColor: Colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: Colors.white, fontWeight: '900', fontSize: 12 }
});
