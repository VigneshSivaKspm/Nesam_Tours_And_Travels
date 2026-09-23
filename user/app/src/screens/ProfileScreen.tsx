import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Colors } from '../theme/colors';
import { currentCustomer } from '../config/constants';

interface ProfileScreenProps {
  onBack: () => void;
}

export function ProfileScreen({ onBack }: ProfileScreenProps) {
  const [name, setName] = useState(currentCustomer.name);
  const [phone, setPhone] = useState(currentCustomer.phone);
  const [email, setEmail] = useState(currentCustomer.email);
  const [emergency, setEmergency] = useState(currentCustomer.emergencyContact);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Profile & Auth</Text>
      </View>

      {saved && (
        <View style={styles.savedBox}>
          <Text style={styles.savedText}>✓ Profile details updated successfully!</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mobile Number & Security Auth</Text>
        <Text style={styles.label}>Verified Phone Number (Mobile Login OTP)</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <Text style={styles.label}>Email Address (For Tax Invoices & E-Tickets)</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />

        <Text style={styles.label}>SOS Emergency Contact Number</Text>
        <TextInput style={styles.input} value={emergency} onChangeText={setEmergency} keyboardType="phone-pad" />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Profile Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notification Channels</Text>
        <View style={styles.item}><Text style={styles.itemText}>SMS Booking Alerts</Text><Text style={styles.activeText}>● ENABLED</Text></View>
        <View style={styles.item}><Text style={styles.itemText}>WhatsApp E-Ticket & Invoice Updates</Text><Text style={styles.activeText}>● ENABLED</Text></View>
        <View style={styles.item}><Text style={styles.itemText}>Email GST Tax Invoice Receipts</Text><Text style={styles.activeText}>● ENABLED</Text></View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { color: Colors.primary, fontWeight: '800', fontSize: 13 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: Colors.black, marginLeft: 12 },

  savedBox: { backgroundColor: '#E6F4EA', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.success, marginBottom: 12 },
  savedText: { color: Colors.success, fontWeight: '800', fontSize: 12, textAlign: 'center' },

  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: Colors.black, marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.black, marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10, fontSize: 12, fontWeight: '600', color: Colors.black },

  saveBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 14 },
  saveBtnText: { color: Colors.white, fontWeight: '900', fontSize: 12 },

  item: { flexDirection: 'row', justifyBetween: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemText: { fontSize: 12, color: Colors.black, fontWeight: '600' },
  activeText: { fontSize: 10, fontWeight: '900', color: Colors.success }
});
