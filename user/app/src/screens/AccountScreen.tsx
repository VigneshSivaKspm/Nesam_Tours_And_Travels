// Profile, wallet and settings (port of user/web ProfileScreen.tsx).
import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useCustomerData } from '../context/CustomerData';
import { Avatar, Card, Notice, Screen } from '../components/ui';
import { choosePhotoSource } from '../components/photoSource';
import { PickerError, pickImage, uploadProfilePhoto } from '../services/storageService';
import { updateCustomerProfile } from '../services/userService';
import { signOutUser } from '../services/authService';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { formatINR, formatPhone } from '../utils/format';
import { describeError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';

function Item({ icon, label, value, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.item} accessibilityRole={onPress ? 'button' : undefined}>
      <Ionicons name={icon} size={20} color={colors.ink} />
      <Text style={styles.itemLabel}>{label}</Text>
      {value ? (
        <Text style={type.small} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null}
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
    <Screen>
      <Card style={styles.profile}>
        <Pressable onPress={() => void changePhoto()} disabled={photoBusy != null} accessibilityRole="button" accessibilityLabel="Change profile photo">
          <Avatar name={profile.name} photoUrl={profile.photoUrl} size={64} />
          <View style={styles.editBadge}>
            <Ionicons name={photoBusy != null ? 'cloud-upload-outline' : 'camera'} size={12} color={colors.ink} />
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={type.h2} numberOfLines={1}>
            {profile.name}
          </Text>
          <Text style={type.small}>{formatPhone(profile.phone)}</Text>
          <Text style={type.tiny} numberOfLines={1}>
            {profile.email}
          </Text>
          {photoBusy != null ? <Text style={styles.uploading}>Uploading photo… {photoBusy}%</Text> : null}
        </View>
      </Card>
      <Notice message={error} />

      <Card>
        <Text style={type.tiny}>NESAM WALLET</Text>
        <Text style={styles.wallet}>{formatINR(profile.walletBalance)}</Text>
        <Text style={type.small}>Online top-up isn’t available yet. Pay cash or UPI to your driver; refunds and credits appear here.</Text>
      </Card>

      <Card style={{ padding: 0 }}>
        <Item icon="create-outline" label="Edit profile" onPress={() => navigation.navigate('EditProfile')} />
        <Item icon="bookmark-outline" label="Saved places" onPress={() => navigation.navigate('SavedPlaces')} />
        <Item icon="pricetags-outline" label="Offers" onPress={() => navigation.navigate('Offers')} />
        <Item icon="alert-circle-outline" label="Emergency contact" value={profile.emergencyContact ? formatPhone(profile.emergencyContact) : 'Not set'} />
        <Item icon="language-outline" label="Language" value={profile.language} />
        <Item icon="help-buoy-outline" label="Help & support" onPress={() => navigation.navigate('Support')} />
        <Item icon="call-outline" label={`Call support (${SUPPORT_PHONE_DISPLAY})`} onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
      </Card>

      <Pressable onPress={logout} style={styles.logout} accessibilityRole="button">
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
      <Text style={[type.tiny, { textAlign: 'center', marginTop: space.md }]}>NESAM Customer v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploading: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 4 },
  wallet: { fontSize: 26, fontWeight: '900', color: colors.success, marginVertical: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  logout: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
});
