import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { VendorProfile } from '../types/vendor';

interface VendorHeaderProps {
  profile: VendorProfile;
  walletBalance: number;
}

export const VendorHeader: React.FC<VendorHeaderProps> = ({ profile, walletBalance }) => {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>N</Text>
        </View>
        <View>
          <View style={styles.row}>
            <Text style={styles.brandTitle}>NESAM</Text>
            <View style={styles.vendorTag}>
              <Text style={styles.vendorTagText}>FLEET VENDOR</Text>
            </View>
          </View>
          <Text style={styles.companyName}>{profile.companyName}</Text>
        </View>
      </View>

      <View style={styles.walletBox}>
        <Text style={styles.walletLabel}>Fleet Wallet</Text>
        <Text style={styles.walletVal}>₹{walletBalance.toLocaleString('en-IN')}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.black,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#262626'
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoText: { color: Colors.white, fontWeight: '900', fontSize: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandTitle: { color: Colors.white, fontWeight: '900', fontSize: 16 },
  vendorTag: { backgroundColor: Colors.warning, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  vendorTagText: { color: Colors.black, fontSize: 8, fontWeight: '900' },
  companyName: { color: '#9CA3AF', fontSize: 10 },
  walletBox: { backgroundColor: '#1A1A1A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#333' },
  walletLabel: { color: '#9CA3AF', fontSize: 9 },
  walletVal: { color: Colors.white, fontSize: 14, fontWeight: '900' }
});
