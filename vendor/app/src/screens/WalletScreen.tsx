import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Colors } from '../theme/colors';

interface WalletScreenProps {
  balance: number;
}

export const WalletScreen: React.FC<WalletScreenProps> = ({ balance }) => {
  const [amount, setAmount] = useState<string>(String(balance));
  const [success, setSuccess] = useState<boolean>(false);

  const handlePayout = () => {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.tag}>AVAILABLE FLEET WALLET</Text>
        <Text style={styles.val}>₹{balance.toLocaleString('en-IN')}</Text>
        <Text style={styles.sub}>Instant Corporate Payouts to Registered Account</Text>
      </View>

      {success && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>✓ Payout Request Sent to Finance Team!</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.title}>Request Corporate Withdrawal</Text>
        
        <Text style={styles.label}>Amount (₹)</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" />

        <TouchableOpacity style={styles.btn} onPress={handlePayout}>
          <Text style={styles.btnText}>Withdraw Funds</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  hero: { backgroundColor: Colors.black, borderRadius: 16, padding: 20, marginBottom: 14 },
  tag: { color: Colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  val: { color: Colors.white, fontSize: 34, fontWeight: '900', marginTop: 4 },
  sub: { color: '#9CA3AF', fontSize: 11, marginTop: 4 },

  successBox: { backgroundColor: '#E6F4EA', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.success, marginBottom: 12 },
  successText: { color: Colors.success, fontWeight: '800', fontSize: 12, textAlign: 'center' },

  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.black, marginTop: 4 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10, fontSize: 16, fontWeight: '900', marginTop: 4 },
  btn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 14 },
  btnText: { color: Colors.white, fontWeight: '900', fontSize: 13 }
});
