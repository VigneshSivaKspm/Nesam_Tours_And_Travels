import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  openTripsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, openTripsCount }) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'fleet', label: 'Fleet', icon: '🚗' },
    { id: 'marketplace', label: 'Bids', icon: '⚖️', badge: openTripsCount > 0 ? `${openTripsCount}` : null },
    { id: 'trips', label: 'Dispatches', icon: '🗺️' },
    { id: 'wallet', label: 'Wallet', icon: '💳' }
  ];

  return (
    <View style={styles.nav}>
      {tabs.map(t => {
        const isActive = activeTab === t.id;
        return (
          <TouchableOpacity key={t.id} style={styles.tabBtn} onPress={() => onTabChange(t.id)}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{t.icon}</Text>
              {t.badge && <View style={styles.badge}><Text style={styles.badgeText}>{t.badge}</Text></View>}
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  nav: {
    backgroundColor: Colors.black,
    flexDirection: 'row',
    height: 64,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    alignItems: 'center',
    justifyContent: 'space-around'
  },
  tabBtn: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  iconContainer: { position: 'relative' },
  icon: { fontSize: 18 },
  badge: { position: 'absolute', top: -4, right: -12, backgroundColor: Colors.primary, paddingHorizontal: 4, borderRadius: 4 },
  badgeText: { color: Colors.white, fontSize: 8, fontWeight: '900' },
  tabLabel: { color: '#9CA3AF', fontSize: 10, marginTop: 2, fontWeight: '600' },
  tabLabelActive: { color: Colors.primary, fontWeight: '800' }
});
