import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useVendorData } from '../context/VendorData';
import { useSignOut } from '../navigation/MainNavigator';
import { Card } from '../components/ui';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { formatINR } from '../utils/format';
import { colors, space, type } from '../theme';

function Item({ icon, label, value, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={styles.item} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.ink} />
      <Text style={[styles.label, danger && { color: colors.danger }]}>{label}</Text>
      {value ? <Text style={type.small}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

export function MoreScreen() {
  const navigation = useNavigation();
  const signOut = useSignOut();
  const { profile, drivers, invites, wallet } = useVendorData();

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You’ll need to verify your phone number again to sign back in.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.content}>
        <Text style={type.h1}>More</Text>
        <Text style={[type.small, { marginBottom: space.md }]}>{profile.companyName}</Text>
        <Card style={{ padding: 0 }}>
          <Item icon="people-outline" label="Drivers & invites" value={`${drivers.length} · ${invites.length} invited`} onPress={() => navigation.navigate('Drivers')} />
          <Item icon="wallet-outline" label="Wallet & payouts" value={formatINR(wallet.available)} onPress={() => navigation.navigate('Wallet')} />
          <Item icon="document-text-outline" label="Documents & compliance" onPress={() => navigation.navigate('Documents')} />
          <Item icon="business-outline" label="Business profile" onPress={() => navigation.navigate('Profile')} />
          <Item icon="call-outline" label={`Partner support (${SUPPORT_PHONE_DISPLAY})`} onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
          <Item icon="log-out-outline" label="Sign out" onPress={confirmSignOut} danger />
        </Card>
        <Text style={[type.tiny, { textAlign: 'center' }]}>NESAM Vendor v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
});
