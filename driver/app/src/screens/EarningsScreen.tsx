import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../theme/colors';
import { EarningsData } from '../types/driver';

interface EarningsScreenProps {
  earnings: EarningsData;
}

export const EarningsScreen: React.FC<EarningsScreenProps> = ({ earnings }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Financial Ledger</Text>
        <Text style={styles.bannerSub}>10% NESAM Platform Fee Structure</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.box}>
          <Text style={styles.label}>Today's Earnings</Text>
          <Text style={styles.valRed}>₹{earnings.today}</Text>
        </View>
        <View style={styles.box}>
          <Text style={styles.label}>This Week</Text>
          <Text style={styles.val}>₹{earnings.weekly}</Text>
        </View>
        <View style={styles.box}>
          <Text style={styles.label}>This Month</Text>
          <Text style={styles.val}>₹{earnings.monthly}</Text>
        </View>
        <View style={styles.box}>
          <Text style={styles.label}>Commission Rate</Text>
          <Text style={styles.valGreen}>10% Flat</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Trip Credits</Text>

        <View style={styles.rowItem}>
          <View>
            <Text style={styles.rowTitle}>Trip NESAM-BK-4082</Text>
            <Text style={styles.rowSub}>Airport to Guindy</Text>
          </View>
          <Text style={styles.rowAmount}>+ ₹702</Text>
        </View>

        <View style={styles.rowItem}>
          <View>
            <Text style={styles.rowTitle}>Trip NESAM-BK-4050</Text>
            <Text style={styles.rowSub}>Central Station to ECR</Text>
          </View>
          <Text style={styles.rowAmount}>+ ₹825</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  banner: { backgroundColor: Colors.black, borderRadius: 16, padding: 16, marginBottom: 14 },
  bannerTitle: { color: Colors.white, fontSize: 18, fontWeight: '900' },
  bannerSub: { color: Colors.primary, fontSize: 11, fontWeight: '700', marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  box: { width: '48%', backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  label: { fontSize: 10, color: Colors.secondaryText },
  valRed: { fontSize: 20, fontWeight: '900', color: Colors.primary, marginTop: 4 },
  val: { fontSize: 20, fontWeight: '900', color: Colors.black, marginTop: 4 },
  valGreen: { fontSize: 20, fontWeight: '900', color: Colors.success, marginTop: 4 },

  section: { backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 10 },
  rowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowTitle: { fontSize: 12, fontWeight: '800', color: Colors.black },
  rowSub: { fontSize: 10, color: Colors.secondaryText },
  rowAmount: { fontSize: 14, fontWeight: '900', color: Colors.success }
});
