// My Account: profile, refund credits, preferences, payments & support, privacy.
import React, { useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useCustomerData } from '../context/CustomerData';
import { Notice, Screen } from '../components/ui';
import { choosePhotoSource } from '../components/photoSource';
import { PickerError, pickImage, uploadProfilePhoto } from '../services/storageService';
import { updateCustomerProfile } from '../services/userService';
import { signOutUser } from '../services/authService';
import { COMPANY_LEGAL_NAME, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { formatINR, formatPhone, initials } from '../utils/format';
import { describeError } from '../utils/retry';
import { colors, radius, space } from '../theme';

function Item({ icon, label, value, onPress, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress?: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.item, !last && styles.itemLine, pressed && onPress && { backgroundColor: '#F8FAFC' }]}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <Ionicons name={icon} size={26} color={colors.ink} />
      <Text style={styles.itemLabel}>{label}</Text>
      {value ? (
        <Text style={styles.itemValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={22} color={colors.slate} /> : null}
    </Pressable>
  );
}

export function AccountScreen() {
  const navigation = useNavigation();
  const { profile } = useCustomerData();
  const [photoBusy, setPhotoBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  const changePhoto = async () => {
    const source = await choosePhotoSource();
    if (!source) return;
    setError('');
    try {
      const asset = await pickImage(source);
      if (!asset) return;
      setPhotoBusy(0);
      const url = await uploadProfilePhoto(profile.uid, asset, setPhotoBusy);
      await updateCustomerProfile(profile.uid, { photoUrl: url });
    } catch (e) {
      setError(e instanceof PickerError ? e.message : describeError(e, 'Couldn’t update your photo.'));
    } finally {
      setPhotoBusy(null);
    }
  };

  const logout = () =>
    Alert.alert('Log out?', 'You’ll need to verify your phone number again to sign back in.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          signOutUser().catch(() => setError('Couldn’t log out. Please try again.'));
        },
      },
    ]);

  return (
    <Screen bg={colors.page}>
      <Text style={styles.title} accessibilityRole="header">
        My Account
      </Text>

      <View style={[styles.card, styles.profile]}>
        <Pressable onPress={() => void changePhoto()} disabled={photoBusy != null} accessibilityRole="button" accessibilityLabel="Change profile photo">
          {profile.photoUrl ? (
            <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.initials]}>
              <Text style={styles.initialsText}>{initials(profile.name)}</Text>
            </View>
          )}
          <View style={styles.camBadge}>
            <Ionicons name={photoBusy != null ? 'cloud-upload-outline' : 'camera'} size={13} color={colors.ink} />
          </View>
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('EditProfile')} accessibilityRole="button" accessibilityLabel={`${profile.name}. Manage your profile`}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.name}
          </Text>
          <Text style={styles.manage}>{photoBusy != null ? `Uploading photo… ${photoBusy}%` : 'Manage your profile'}</Text>
          <Text style={styles.phone}>{formatPhone(profile.phone)}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('EditProfile')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Edit profile">
          <Ionicons name="create-outline" size={28} color={colors.slate} />
        </Pressable>
      </View>
      <Notice message={error} />

      <Pressable style={[styles.card, styles.wallet]} onPress={() => navigation.navigate('PaymentHistory')} accessibilityRole="button" accessibilityLabel={`Refund credits ${formatINR(profile.walletBalance)}. Open history`}>
        <Ionicons name="wallet-outline" size={36} color={colors.ink} />
        <View style={{ flex: 1 }}>
          <Text style={styles.walletLabel}>Refund credits</Text>
          <Text style={styles.walletValue}>{formatINR(profile.walletBalance)}</Text>
        </View>
        <Text style={styles.history}>History</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.slate} />
      </Pressable>

      <Text style={styles.section}>PROFILE & PREFERENCES</Text>
      <View style={styles.card0}>
        <Item icon="person-outline" label="Edit profile" onPress={() => navigation.navigate('EditProfile')} />
        <Item icon="bookmark-outline" label="Saved places" onPress={() => navigation.navigate('SavedPlaces')} />
        {/* Language preference - English active */}
        <Item icon="language-outline" label="Language" value={profile.language || 'English'} last />
      </View>

      <Text style={styles.section}>PAYMENTS & SUPPORT</Text>
      <View style={styles.card0}>
        <Item icon="card-outline" label="Payment history" onPress={() => navigation.navigate('PaymentHistory')} />
        <Item icon="help-circle-outline" label="Help & support" onPress={() => navigation.navigate('Support')} />
        <Item icon="call-outline" label={`Call ${SUPPORT_PHONE_DISPLAY}`} onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} last />
      </View>

      <Text style={styles.section}>PRIVACY</Text>
      <View style={styles.card0}>
        <Item icon="shield-checkmark-outline" label="Privacy & terms" onPress={() => navigation.navigate('LegalDocuments')} last />
      </View>

      <Pressable onPress={logout} style={styles.logout} accessibilityRole="button">
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
      <Text style={styles.footer}>{COMPANY_LEGAL_NAME}</Text>
      <Text style={styles.version}>Customer app v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: '900', color: colors.ink, marginBottom: space.lg },
  card: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, padding: space.lg, marginBottom: space.md },
  card0: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden', marginBottom: space.md },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  initials: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontSize: 28, fontWeight: '800', color: colors.primary },
  camBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 21, fontWeight: '800', color: colors.ink },
  manage: { fontSize: 16, color: colors.slate, marginTop: 2 },
  phone: { fontSize: 13, color: colors.slate, marginTop: 2 },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  walletLabel: { fontSize: 15, color: colors.slate },
  walletValue: { fontSize: 28, fontWeight: '900', color: colors.success },
  history: { fontSize: 16, fontWeight: '800', color: colors.primary },
  section: { fontSize: 14, fontWeight: '700', color: colors.slate, letterSpacing: 0.6, marginTop: space.md, marginBottom: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, minHeight: 60 },
  itemLine: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  itemLabel: { flex: 1, fontSize: 17, fontWeight: '500', color: colors.ink },
  itemValue: { fontSize: 16, color: colors.slate, maxWidth: '45%' },
  logout: { alignItems: 'center', justifyContent: 'center', minHeight: 52, marginTop: space.lg },
  logoutText: { color: colors.primary, fontWeight: '800', fontSize: 19 },
  footer: { textAlign: 'center', fontSize: 14, color: colors.slate },
  version: { textAlign: 'center', fontSize: 12, color: colors.slate, marginTop: 2 },
});
