import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme/colors';
import { formatINR, formatDistance } from '../utils/format';
import { subscribeToOpenMarketplace, acceptMarketplaceTrip } from '../services/driverFirestoreService';
import type { MarketplaceOffer } from '../types/driver';

export default function MarketplaceScreen({ navigation }: any) {
  const { account } = useAuth();
  const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToOpenMarketplace((data) => setOffers(data));
    return () => unsub();
  }, []);

  const handleAccept = async (offer: MarketplaceOffer) => {
    if (!account) return;
    if (account.driver.presenceStatus !== 'Online') {
      Alert.alert('Go Online', 'You must be Online to accept marketplace trips.');
      return;
    }

    setAcceptingId(offer.id);
    try {
      await acceptMarketplaceTrip(account.driver, account.vehicle.vehicleNumber, offer);
      Alert.alert('Trip Accepted!', 'The trip has been assigned to you. Head to Active Trip.');
      navigation.navigate('TripTab');
    } catch (e: any) {
      const code = e?.code || '';
      if (code === 'permission-denied') {
        Alert.alert('Missed It!', 'Another driver has already accepted this trip.');
      } else {
        Alert.alert('Error', e.message || 'Could not accept trip. Please try again.');
      }
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Marketplace Trips</Text>
        <Text style={styles.subtitle}>{offers.length} available near you</Text>
      </View>

      <FlatList
        data={offers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.topRow}>
              <Text style={styles.category}>{item.vehicleCategory}</Text>
              <Text style={styles.payout}>{formatINR(item.offeredPayout)}</Text>
            </View>
            <Text style={styles.route} numberOfLines={2}>
              📍 {item.pickup.address} → {item.drop.address}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Distance: {formatDistance(item.distanceKm)}</Text>
              {item.travelDate ? <Text style={styles.metaText}>Date: {item.travelDate}</Text> : null}
            </View>
            <TouchableOpacity
              style={[styles.acceptBtn, acceptingId === item.id && { opacity: 0.7 }]}
              onPress={() => handleAccept(item)}
              disabled={acceptingId !== null}
            >
              {acceptingId === item.id ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.acceptBtnText}>Accept Trip</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={styles.emptyText}>No marketplace trips available right now.</Text>
            <Text style={styles.emptySub}>Stay Online — new trip requests appear here in real time.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  header: { padding: 16, paddingTop: 20, borderBottomWidth: 1, borderColor: '#2C2C2E' },
  title: { fontSize: 24, fontWeight: '900', color: Colors.white },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  category: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  payout: { fontSize: 20, fontWeight: '900', color: Colors.online },
  route: { fontSize: 14, color: Colors.white, fontWeight: '600', marginBottom: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  acceptBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  acceptBtnText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyText: { color: Colors.white, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptySub: { color: Colors.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center' },
});