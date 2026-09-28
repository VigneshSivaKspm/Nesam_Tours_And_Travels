import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import type { User } from 'firebase/auth';
import { RecaptchaProvider } from './src/components/RecaptchaVerifier';
import { NetworkBanner } from './src/components/NetworkBanner';
import { FullScreenLoader } from './src/components/ui';
import { AuthScreen } from './src/screens/auth/AuthScreen';
import { ProfileSetupScreen } from './src/screens/auth/ProfileSetupScreen';
import { AccountHoldScreen, LoadErrorScreen } from './src/screens/auth/AccountStateScreens';
import { MainNavigator } from './src/navigation/MainNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { CustomerDataProvider } from './src/context/CustomerData';
import { signOutUser, subscribeToAuthUser } from './src/services/authService';
import { subscribeToCustomerProfile } from './src/services/userService';
import type { UserProfile } from './src/types';
import { describeError } from './src/utils/retry';
import { colors } from './src/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const BLOCKED_STATUSES = ['Blocked', 'Suspended', 'Rejected', 'Inactive'];

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.primary, background: colors.bg, card: colors.card, text: colors.ink, border: colors.border },
};

interface ProfileState {
  /** The uid + attempt this result belongs to; stale results are ignored. */
  key: string;
  profile?: UserProfile | null;
  error: string;
}

function Root() {
  // undefined = still resolving; null = signed out / no profile doc yet.
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [profileState, setProfileState] = useState<ProfileState>({ key: '', error: '' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => subscribeToAuthUser(setAuthUser), []);

  const uid = authUser?.uid;
  const key = uid ? `${uid}#${attempt}` : '';
  useEffect(() => {
    if (!uid) return undefined;
    const k = `${uid}#${attempt}`;
    return subscribeToCustomerProfile(
      uid,
      (p) => setProfileState({ key: k, profile: p, error: '' }),
      (e) => setProfileState({ key: k, error: describeError(e, 'We couldn’t load your account.') }),
    );
  }, [uid, attempt]);

  const current = profileState.key === key ? profileState : null;
  const profile = current?.profile;
  const profileError = current?.error ?? '';

  const resolved = authUser !== undefined && (!authUser || profile !== undefined || !!profileError);
  useEffect(() => {
    if (resolved) void SplashScreen.hideAsync().catch(() => undefined);
  }, [resolved]);

  if (authUser === undefined) return <FullScreenLoader />;
  if (!authUser) return <AuthScreen />;
  if (profile === undefined && profileError) {
    return <LoadErrorScreen message={profileError} onRetry={() => setAttempt((k) => k + 1)} onSignOut={() => void signOutUser()} />;
  }
  if (profile === undefined) return <FullScreenLoader label="Loading your account…" />;
  if (profile === null) return <ProfileSetupScreen phone={authUser.phoneNumber ?? ''} />;
  if (BLOCKED_STATUSES.includes(profile.status)) return <AccountHoldScreen status={profile.status} onSignOut={() => void signOutUser()} />;

  return (
    <CustomerDataProvider key={profile.uid} profile={profile}>
      <MainNavigator />
    </CustomerDataProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <RecaptchaProvider>
        <NavigationContainer ref={navigationRef} theme={navTheme}>
          <StatusBar style="dark" />
          <Root />
          <NetworkBanner />
        </NavigationContainer>
      </RecaptchaProvider>
    </SafeAreaProvider>
  );
}
