// New customer profile (native port of ProfileSetup in user/web AuthFlow.tsx).
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Button, Card, LinkText, Notice, Screen, TextField } from '../../components/ui';
import { choosePhotoSource } from '../../components/photoSource';
import { registerCustomerProfile } from '../../services/userService';
import { PickerError, pickImage, uploadProfilePhoto } from '../../services/storageService';
import { signOutUser } from '../../services/authService';
import { auth } from '../../config/firebase';
import { formatPhone, isValidEmail, isValidIndianMobile, isValidName, localMobile } from '../../utils/format';
import { describeError } from '../../utils/retry';
import { colors, radius, space, type } from '../../theme';
import { getAuthIntent } from './authIntent';

export function ProfileSetupScreen({ phone }: { phone: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emergency, setEmergency] = useState('');
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [photoFailed, setPhotoFailed] = useState(false);

  const own = localMobile(phone);
  const errors = {
    name: !isValidName(name) ? 'Enter your full name (letters and spaces, 2–60 characters).' : '',
    email: !isValidEmail(email) ? 'Enter a valid email address — receipts are sent here.' : '',
    emergency: !isValidIndianMobile(emergency)
      ? 'Enter a 10-digit mobile number for your emergency contact.'
      : emergency === own
        ? 'Your emergency contact must be a different number from yours.'
        : '',
  };
  const valid = !errors.name && !errors.email && !errors.emergency;

  const pickPhoto = async () => {
    const source = await choosePhotoSource();
    if (!source) return;
    try {
      const asset = await pickImage(source);
      if (asset) {
        setPhoto(asset);
        setPhotoFailed(false);
        setError('');
      }
    } catch (e) {
      setError(e instanceof PickerError ? e.message : 'Couldn’t open the photo picker.');
    }
  };

  const save = async (skipPhoto = false) => {
    setTouched(true);
    if (!valid || saving) return;
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError('Your session has expired. Please sign in again.');
      return;
    }
    setSaving(true);
    setError('');
    let photoUrl = '';
    try {
      if (photo && !skipPhoto) {
        try {
          photoUrl = await uploadProfilePhoto(uid, photo, setProgress);
        } catch (e) {
          setPhotoFailed(true);
          setError(`${describeError(e, 'Photo upload failed.')} You can retry, or continue without a photo and add one later.`);
          setSaving(false);
          setProgress(null);
          return;
        }
      }
      await registerCustomerProfile({ name, email, emergencyContact: `+91 ${emergency}`, photoUrl });
      // The profile listener in App.tsx moves on to the main app.
    } catch (e) {
      setError(describeError(e, 'We couldn’t create your profile. Please try again.'));
      setSaving(false);
      setProgress(null);
    }
  };

  const fieldError = (k: keyof typeof errors) => (touched ? errors[k] : '');

  return (
    <Screen>
      <Text style={[type.h1, styles.title]}>Complete your profile</Text>
      <Text style={styles.sub}>
        {getAuthIntent() === 'login' ? 'Set up your profile to continue' : 'Create your passenger profile'} · {formatPhone(phone)}
      </Text>
      <Card>
        <View style={styles.photoRow}>
          <Pressable onPress={() => void pickPhoto()} style={styles.photo} accessibilityRole="button" accessibilityLabel="Add profile photo">
            {photo ? <Image source={{ uri: photo.uri }} style={styles.photoImg} /> : <Text style={styles.photoText}>Add photo</Text>}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>Profile photo</Text>
            <Text style={type.small}>Optional — helps your driver recognise you.</Text>
            {progress != null ? <Text style={styles.progress}>Uploading… {progress}%</Text> : null}
          </View>
        </View>

        <TextField label="Full name" required value={name} onChangeText={setName} autoComplete="name" error={fieldError('name')} placeholder="e.g. Priya Raman" />
        <TextField
          label="Email address"
          required
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          error={fieldError('email')}
          placeholder="you@example.com"
        />
        <TextField
          label="Emergency contact"
          required
          prefix="+91"
          value={emergency}
          onChangeText={(v) => setEmergency(v.replace(/\D/g, '').slice(0, 10))}
          keyboardType="phone-pad"
          maxLength={10}
          error={fieldError('emergency')}
          hint="Shared only when you trigger SOS or share a trip."
          placeholder="Family member or friend"
        />

        <Notice message={error} />
        <Button
          title={saving ? 'Saving…' : photoFailed ? 'Retry upload & continue' : 'Save & start booking'}
          loading={saving}
          onPress={() => void save()}
        />
        {photoFailed && !saving ? <Button title="Continue without photo" variant="secondary" onPress={() => void save(true)} style={{ marginTop: space.sm }} /> : null}
        <View style={styles.signOut}>
          <LinkText onPress={() => void signOutUser()}>Not your number? Sign out</LinkText>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.lg },
  sub: { ...type.small, marginBottom: space.lg, marginTop: 4 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  photo: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  photoImg: { width: '100%', height: '100%' },
  photoText: { fontSize: 11, fontWeight: '700', color: colors.muted, textAlign: 'center' },
  progress: { color: colors.primary, fontWeight: '700', marginTop: 4, fontSize: 12 },
  signOut: { alignItems: 'center', marginTop: space.lg },
});
