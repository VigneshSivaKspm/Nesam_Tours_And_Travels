import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../theme/colors';
import { currentCustomer } from '../config/constants';
import { PrimaryButton } from '../components/PrimaryButton';

export interface HomeScreenProps {
  onStartBooking: (type: string) => void;
}

export function HomeScreen({ onStartBooking }: HomeScreenProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image source={{ uri: currentCustomer.photoUrl }} style={styles.avatar} />
          <View>
            <Text style={styles.welcomeText}>WELCOME BACK</Text>
            <Text style={styles.nameText}>Hello, {currentCustomer.name}</Text>
          </View>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>NESAM RED</Text>
        </View>
      </View>

      {/* Main Search Banner */}
      <View style={styles.searchCard}>
        <Text style={styles.companySub}>NESAM TOURS & TRAVELS PRIVATE LIMITED</Text>
        <Text style={styles.searchTitle}>Safe Journey, Happy Memories</Text>
        <Text style={styles.searchSubtitle}>Book Airport Taxi, Outstation Cab, One Way Taxi, & Local Rental</Text>

        <TouchableOpacity
          style={styles.searchBox}
          activeOpacity={0.85}
          onPress={() => onStartBooking('Outstation')}
        >
          <Text style={styles.searchPlaceholder}>📍 Enter destination or airport...</Text>
          <View style={styles.goBtn}>
            <Text style={styles.goBtnText}>→</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Services Grid matching Card */}
      <Text style={styles.sectionTitle}>OUR SERVICES</Text>
      <View style={styles.grid}>
        {[
          { type: 'Airport Taxi', desc: 'Coimbatore, Madurai & Chennai', icon: '✈️' },
          { type: 'Outstation Cab', desc: 'Intercity Travel across TN', icon: '🚘' },
          { type: 'One Way Taxi', desc: 'Pay only for one direction', icon: '📍' },
          { type: 'Local Rental', desc: '4hr / 8hr Flexible Rental', icon: '📅' },
        ].map((item, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.categoryCard}
            onPress={() => onStartBooking(item.type)}
          >
            <Text style={styles.categoryIcon}>{item.icon}</Text>
            <Text style={styles.categoryName}>{item.type}</Text>
            <Text style={styles.categoryDesc}>{item.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contact Card matching Card details */}
      <View style={styles.contactCard}>
        <Text style={styles.contactTitle}>📍 REGISTERED OFFICE & HELPLINE</Text>
        <Text style={styles.contactText}>NO.46 GOUNDAR STREET, KODUVILAR PATTI, THENI-625534</Text>
        <Text style={styles.phoneText}>📞 8531970197</Text>
      </View>

      <PrimaryButton
        title="Start Booking Journey →"
        onPress={() => onStartBooking('Airport')}
        style={styles.cta}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  content: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: Colors.primary },
  welcomeText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '800', letterSpacing: 1 },
  nameText: { fontSize: 16, fontWeight: '900', color: Colors.black },
  badge: { backgroundColor: Colors.black, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: Colors.white, fontSize: 9, fontWeight: '900' },
  searchCard: {
    backgroundColor: Colors.black,
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
  },
  companySub: { color: Colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  searchTitle: { color: Colors.white, fontSize: 18, fontWeight: '900' },
  searchSubtitle: { color: Colors.textSecondary, fontSize: 11, marginTop: 2, marginBottom: 16 },
  searchBox: {
    backgroundColor: Colors.darkCharcoal,
    padding: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#333333',
  },
  searchPlaceholder: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  goBtn: { backgroundColor: Colors.primary, width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  goBtnText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: Colors.black, letterSpacing: 0.5, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  categoryCard: {
    width: '48%',
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryIcon: { fontSize: 24, marginBottom: 8 },
  categoryName: { fontSize: 13, fontWeight: '900', color: Colors.black },
  categoryDesc: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  contactCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderWidth: 1,
    padding: 14,
    borderRadius: 20,
    marginBottom: 20,
  },
  contactTitle: { fontSize: 11, fontWeight: '900', color: Colors.primary, marginBottom: 4 },
  contactText: { fontSize: 11, fontWeight: '700', color: Colors.black, marginBottom: 4 },
  phoneText: { fontSize: 12, fontWeight: '900', color: Colors.black },
  cta: { marginTop: 10 },
});
