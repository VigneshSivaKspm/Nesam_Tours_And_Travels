import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Colors } from '../theme/colors';
import { DriverProfile } from '../types/driver';

interface ProfileScreenProps {
  profile: DriverProfile;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ profile }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.phone}>{profile.phone}</Text>
        <Text style={styles.email}>{profile.email}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Document Verification Status</Text>

        <View style={styles.docItem}>
          <Text style={styles.docName}>Driving License (Front & Back)</Text>
          <Text style={styles.statusApproved}>APPROVED</Text>
        </View>

        <View style={styles.docItem}>
          <Text style={styles.docName}>Vehicle RC Document</Text>
          <Text style={styles.statusApproved}>APPROVED</Text>
        </View>

        <View style={styles.docItem}>
          <Text style={styles.docName}>Commercial Insurance Policy</Text>
          <Text style={styles.statusApproved}>APPROVED</Text>
        </View>

        <View style={styles.docItem}>
          <Text style={styles.docName}>Fitness Certificate (FC)</Text>
          <Text style={styles.statusApproved}>APPROVED</Text>
        </View>

        <View style={styles.docItem}>
          <Text style={styles.docName}>State / All-India Taxi Permit</Text>
          <Text style={styles.statusApproved}>APPROVED</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { backgroundColor: Colors.black, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 14 },
  avatar: { width: 72, height: 72, borderRadius: 20, borderWidth: 2, borderColor: Colors.primary, marginBottom: 8 },
  name: { color: Colors.white, fontSize: 18, fontWeight: '900' },
  phone: { color: Colors.primary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  email: { color: '#9CA3AF', fontSize: 11, marginTop: 1 },

  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 12 },
  docItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  docName: { fontSize: 12, fontWeight: '700', color: Colors.black },
  statusApproved: { backgroundColor: '#E6F4EA', color: Colors.success, fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }
});
