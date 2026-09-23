import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { FleetVehicle } from '../types/vendor';

interface FleetScreenProps {
  vehicles: FleetVehicle[];
}

export const FleetScreen: React.FC<FleetScreenProps> = ({ vehicles }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Text style={styles.title}>Fleet Vehicle Directory</Text>
        <Text style={styles.sub}>{vehicles.length} Vehicles Managed in Fleet</Text>
      </View>

      {vehicles.map(v => (
        <View key={v.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.num}>{v.vehicleNumber}</Text>
            <Text style={styles.status}>{v.status}</Text>
          </View>
          <Text style={styles.make}>{v.makeModel}</Text>
          <Text style={styles.category}>Category: {v.category}</Text>
          <Text style={styles.driver}>Assigned Driver: {v.assignedDriver}</Text>
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
  num: { fontSize: 15, fontWeight: '900', color: Colors.black, fontFamily: 'monospace' },
  status: { backgroundColor: '#E6F4EA', color: Colors.success, fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  make: { fontSize: 12, color: Colors.black, marginTop: 4, fontWeight: '700' },
  category: { fontSize: 11, color: Colors.secondaryText, marginTop: 2 },
  driver: { fontSize: 11, color: Colors.primary, marginTop: 4, fontWeight: '800' }
});
