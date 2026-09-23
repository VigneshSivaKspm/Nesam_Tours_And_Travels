import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../theme/colors';
import { VendorProfile } from '../types/vendor';

interface ProfileScreenProps {
  profile: VendorProfile;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ profile }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.company}>{profile.companyName}</Text>
        <Text style={styles.gst}>GSTIN: {profile.gstin}</Text>
        <Text style={styles.phone}>{profile.phone}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Corporate Document Verification</Text>
        
        <View style={styles.item}>
          <Text style={styles.itemName}>GST Registration Certificate</Text>
          <Text style={styles.approved}>APPROVED</Text>
        </View>

        <View style={styles.item}>
          <Text style={styles.itemName}>Company PAN Card</Text>
          <Text style={styles.approved}>APPROVED</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { backgroundColor: Colors.black, borderRadius: 16, padding: 20, marginBottom: 14 },
  company: { color: Colors.white, fontSize: 18, fontWeight: '900' },
  gst: { color: Colors.primary, fontSize: 12, fontWeight: '700', marginTop: 2, fontFamily: 'monospace' },
  phone: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },

  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 12 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemName: { fontSize: 12, fontWeight: '700', color: Colors.black },
  approved: { backgroundColor: '#E6F4EA', color: Colors.success, fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }
});
