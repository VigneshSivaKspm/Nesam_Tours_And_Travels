import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Colors } from '../theme/colors';

interface WalletScreenProps {
  balance: number;
  onRequestPayout: (amount: number, details: string) => void;
}

export const WalletScreen: React.FC<WalletScreenProps> = ({ balance, onRequestPayout }) => {
  const [payoutAmount, setPayoutAmount] = useState<string>(String(balance));
  const [upiId, setUpiId] = useState<string>('muthukumar@okaxis');
  const [successMsg, setSuccessMsg] = useState<boolean>(false);

  const handleRequest = () => {
    onRequestPayout(Number(payoutAmount) || balance, upiId);
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 3000);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Wallet Balance Hero */}
      <View style={styles.walletHero}>
        <Text style={styles.walletTag}>AVAILABLE WALLET BALANCE</Text>
        <Text style={styles.walletVal}>₹{balance}</Text>
        <Text style={styles.walletSub}>Instant transfer to Bank / UPI Account</Text>
      </View>

      {successMsg && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>✓ Payout Request Submitted Successfully!</Text>
        </View>
      )}

      {/* Payout Form Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Request Instant Payout</Text>
        
        <Text style={styles.inputLabel}>Withdrawal Amount (₹)</Text>
        <TextInput
          style={styles.textInput}
          value={payoutAmount}
          onChangeText={setPayoutAmount}
          keyboardType="numeric"
        />

        <Text style={styles.inputLabel}>Target UPI ID / Bank VPA</Text>
        <TextInput
          style={styles.textInput}
          value={upiId}
          onChangeText={setUpiId}
        />

        <TouchableOpacity style={styles.payoutBtn} onPress={handleRequest}>
          <Text style={styles.payoutBtnText}>Confirm Instant Withdrawal</Text>
        </TouchableOpacity>
      </View>

      {/* History */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Payout Logs</Text>
        
        <View style={styles.logItem}>
          <View>
            <Text style={styles.logTitle}>₹3,500 Instant UPI Transfer</Text>
            <Text style={styles.logSub}>muthukumar@okaxis • Yesterday</Text>
          </View>
          <Text style={styles.statusBadge}>COMPLETED</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  walletHero: { backgroundColor: Colors.black, borderRadius: 16, padding: 20, marginBottom: 14 },
  walletTag: { color: Colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  walletVal: { color: Colors.white, fontSize: 36, fontWeight: '900', marginTop: 4 },
  walletSub: { color: '#9CA3AF', fontSize: 11, marginTop: 4 },

  successBox: { backgroundColor: '#E6F4EA', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.success, marginBottom: 12 },
  successText: { color: Colors.success, fontWeight: '800', fontSize: 12, textAlign: 'center' },

  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 10 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: Colors.black, marginTop: 8 },
  textInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10, fontSize: 14, fontWeight: '800', marginTop: 4 },
  payoutBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 14 },
  payoutBtnText: { color: Colors.white, fontWeight: '900', fontSize: 13 },

  logItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  logTitle: { fontSize: 12, fontWeight: '800', color: Colors.black },
  logSub: { fontSize: 10, color: Colors.secondaryText },
  statusBadge: { backgroundColor: '#E6F4EA', color: Colors.success, fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }
});
