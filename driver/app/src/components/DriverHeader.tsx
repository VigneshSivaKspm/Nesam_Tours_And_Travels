import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../theme/colors';
import { DriverStatus, DriverProfile } from '../types/driver';

interface DriverHeaderProps {
  status: DriverStatus;
  onStatusToggle: (status: DriverStatus) => void;
  profile: DriverProfile;
  walletBalance: number;
}

export const DriverHeader: React.FC<DriverHeaderProps> = ({
  status,
  onStatusToggle,
  profile,
  walletBalance
}) => {
  return (
    <View style={styles.header}>
      {/* Brand & Logo */}
      <View style={styles.brandContainer}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>N</Text>
        </View>
        <View>
          <View style={styles.row}>
            <Text style={styles.brandTitle}>NESAM</Text>
            <View style={styles.driverTag}>
              <Text style={styles.driverTagText}>DRIVER</Text>
            </View>
          </View>
          <Text style={styles.brandSub}>Drive. Earn. Grow.</Text>
        </View>
      </View>

      {/* Duty Switcher */}
      <View style={styles.dutyContainer}>
        <TouchableOpacity
          style={[styles.dutyBtn, status === 'Online' && styles.dutyBtnOnline]}
          onPress={() => onStatusToggle(status === 'Online' ? 'Offline' : 'Online')}
        >
          <View style={[styles.statusDot, { backgroundColor: status === 'Online' ? '#20A464' : '#9CA3AF' }]} />
          <Text style={[styles.dutyText, status === 'Online' && styles.dutyTextActive]}>
            {status}
          </Text>
        </TouchableOpacity>
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
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoText: {
    color: Colors.white,
    fontWeight: '900',
    fontSize: 20
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  brandTitle: {
    color: Colors.white,
    fontWeight: '900',
    fontSize: 16
  },
  driverTag: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  driverTagText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '800'
  },
  brandSub: {
    color: '#9CA3AF',
    fontSize: 10
  },
  dutyContainer: {
    flexDirection: 'row'
  },
  dutyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333333'
  },
  dutyBtnOnline: {
    backgroundColor: 'rgba(32, 164, 100, 0.15)',
    borderColor: Colors.success
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  dutyText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700'
  },
  dutyTextActive: {
    color: Colors.white
  }
});
