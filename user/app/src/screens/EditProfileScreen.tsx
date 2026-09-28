// Edit contact details (port of EditProfileModal in user/web ProfileScreen.tsx),
// plus the language preference the customers/{uid} rules already allow.
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useCustomerData } from '../context/CustomerData';
import { Button, Chip, Notice, Screen, TextField } from '../components/ui';
import { updateCustomerProfile } from '../services/userService';
import { formatPhone, isValidEmail, isValidIndianMobile, isValidName, localMobile } from '../utils/format';
import { describeError } from '../utils/retry';
import { space, type } from '../theme';

const LANGUAGES = ['English', 'தமிழ் (Tamil)', 'हिन्दी (Hindi)'];

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const { profile } = useCustomerData();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [emergency, setEmergency] = useState(localMobile(profile.emergencyContact));
  const [language, setLanguage] = useState(profile.language || 'English');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saved = useRef(false);

  const dirty =
    name.trim() !== profile.name ||
    email.trim().toLowerCase() !== profile.email ||
    emergency !== localMobile(profile.emergencyContact) ||
    language !== (profile.language || 'English');

  // Hardware back / header back with unsaved edits asks before discarding.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirty || saved.current) return;
        e.preventDefault();
        Alert.alert('Discard changes?', 'Your edits have not been saved.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    [navigation, dirty],
  );

  const save = async () => {
    if (!isValidName(name)) return setError('Enter your full name (letters and spaces, 2–60 characters).');
    if (!isValidEmail(email)) return setError('Enter a valid email address.');
    if (!isValidIndianMobile(emergency)) return setError('Enter a 10-digit emergency contact number.');
    if (emergency === localMobile(profile.phone)) return setError('Emergency contact must differ from your own number.');
    setBusy(true);
    setError('');
    try {
      await updateCustomerProfile(profile.uid, {
        name,
        email: email.toLowerCase(),
        emergencyContact: `+91 ${emergency}`,
        language,
      });
      saved.current = true;
      navigation.goBack();
    } catch (e) {
      setError(describeError(e, 'Couldn’t save your changes.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Screen edges={[]}>
      <TextField label="Mobile number" value={formatPhone(profile.phone)} editable={false} hint="Your login number can’t be changed here. Contact support to move your account." />
      <TextField label="Full name" required value={name} onChangeText={setName} autoComplete="name" />
      <TextField label="Email" required value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <TextField
        label="Emergency contact"
        required
        prefix="+91"
        value={emergency}
        onChangeText={(v) => setEmergency(v.replace(/\D/g, '').slice(0, 10))}
        keyboardType="phone-pad"
        maxLength={10}
      />
      <Text style={[type.label, { marginBottom: space.sm }]}>Preferred language</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {LANGUAGES.map((l) => (
          <Chip key={l} label={l} active={language === l} onPress={() => setLanguage(l)} />
        ))}
      </View>
      <Notice message={error} style={{ marginTop: space.md }} />
      <Button title={busy ? 'Saving…' : 'Save changes'} loading={busy} disabled={!dirty} onPress={() => void save()} style={{ marginTop: space.md }} />
    </Screen>
  );
}
