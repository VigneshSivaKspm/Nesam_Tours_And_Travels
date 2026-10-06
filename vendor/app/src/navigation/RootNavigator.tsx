import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme/colors';

import { VendorAuthScreen } from '../screens/auth/VendorAuthScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { DashboardScreen } from '../screens/main/DashboardScreen';
import { MarketplaceScreen } from '../screens/main/MarketplaceScreen';
import { TripAssignmentScreen } from '../screens/main/TripAssignmentScreen';
import { FleetScreen } from '../screens/main/FleetScreen';
import { DriversScreen } from '../screens/main/DriversScreen';
import { WalletScreen } from '../screens/main/WalletScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';

import type { RootStackParamList, MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.black,
          borderTopColor: Colors.border,
          height: Platform.OS === 'ios' ? 82 : 62,
          paddingBottom: Platform.OS === 'ios' ? 20 : 6,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        sceneStyle: { backgroundColor: Colors.darkBg },
      }}
    >
      <Tab.Screen name="DashboardTab" component={DashboardScreen} options={{ title: 'Home', tabBarIcon: () => <Text>🏠</Text> }} />
      <Tab.Screen name="MarketplaceTab" component={MarketplaceScreen} options={{ title: 'Market', tabBarIcon: () => <Text>🚗</Text> }} />
      <Tab.Screen name="AssignmentsTab" component={TripAssignmentScreen} options={{ title: 'Dispatch', tabBarIcon: () => <Text>📋</Text> }} />
      <Tab.Screen name="FleetTab" component={FleetScreen} options={{ title: 'Fleet', tabBarIcon: () => <Text>🚕</Text> }} />
      <Tab.Screen name="DriversTab" component={DriversScreen} options={{ title: 'Drivers', tabBarIcon: () => <Text>👥</Text> }} />
      <Tab.Screen name="WalletTab" component={WalletScreen} options={{ title: 'Wallet', tabBarIcon: () => <Text>💰</Text> }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Agency', tabBarIcon: () => <Text>🏢</Text> }} />
    </Tab.Navigator>
  );
}

function StatusNoticeScreen({
  icon,
  title,
  sub,
  note,
  onAction,
  actionText,
  onSignOut,
}: {
  icon: string;
  title: string;
  sub: string;
  note?: string;
  onAction?: () => void;
  actionText?: string;
  onSignOut: () => void;
}) {
  return (
    <View style={s.center}>
      <Text style={{ fontSize: 44, marginBottom: 12 }}>{icon}</Text>
      <Text style={s.statusTitle}>{title}</Text>
      <Text style={s.statusSub}>{sub}</Text>
      {note ? (
        <View style={s.noteBox}>
          <Text style={s.noteLabel}>Admin Note:</Text>
          <Text style={s.noteText}>{note}</Text>
        </View>
      ) : null}
      {onAction && actionText ? (
        <Pressable style={s.actionBtn} onPress={onAction}>
          <Text style={s.actionBtnText}>{actionText}</Text>
        </Pressable>
      ) : null}
      <Pressable style={s.signOutBtn} onPress={onSignOut}>
        <Text style={s.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

export function RootNavigator() {
  const { user, vendorRecord, authLoading, vendorLoading, vendorError, retryVendor, signOut } = useAuth();

  if (authLoading || vendorLoading) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: Colors.primary, letterSpacing: -0.5, marginBottom: 16 }}>
          NESAM VENDOR
        </Text>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (vendorError) {
    return (
      <View style={s.center}>
        <Text style={s.statusTitle}>Connection Issue</Text>
        <Text style={s.statusSub}>Could not load your vendor partner account.</Text>
        <Pressable style={s.actionBtn} onPress={retryVendor}>
          <Text style={s.actionBtnText}>Retry Connection</Text>
        </Pressable>
        <Pressable style={s.signOutBtn} onPress={signOut}>
          <Text style={s.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {!user ? (
          <VendorAuthScreen />
        ) : !vendorRecord || vendorRecord.status === 'INCOMPLETE' ? (
          <OnboardingScreen />
        ) : vendorRecord.status === 'PENDING_APPROVAL' ? (
          <StatusNoticeScreen
            icon="⏳"
            title="Application Under Review"
            sub="Your fleet partner onboarding application has been submitted and is currently being reviewed by the NESAM compliance team."
            onAction={retryVendor}
            actionText="Check Status"
            onSignOut={signOut}
          />
        ) : vendorRecord.status === 'CHANGES_REQUESTED' || vendorRecord.status === 'REJECTED' ? (
          <StatusNoticeScreen
            icon="⚠️"
            title="Corrections Requested"
            sub="Admin reviewed your application and requested corrections before approval."
            note={vendorRecord.review?.note}
            onAction={retryVendor}
            actionText="Update Application"
            onSignOut={signOut}
          />
        ) : vendorRecord.status === 'SUSPENDED' ? (
          <StatusNoticeScreen
            icon="🚫"
            title="Account Suspended"
            sub="Your vendor agency account has been disabled. Please contact NESAM Partner Support."
            onSignOut={signOut}
          />
        ) : (
          <MainNavigator />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: Colors.darkBg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  statusTitle: { fontSize: 22, fontWeight: '900', color: Colors.white, textAlign: 'center', marginBottom: 8 },
  statusSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  noteBox: { backgroundColor: '#2C2C2E', borderRadius: 10, padding: 12, marginBottom: 20, width: '100%' },
  noteLabel: { fontSize: 11, fontWeight: '700', color: Colors.warning, marginBottom: 4 },
  noteText: { fontSize: 13, color: Colors.white, lineHeight: 18 },
  actionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  actionBtnText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  signOutBtn: { paddingVertical: 12, alignItems: 'center' },
  signOutText: { color: Colors.textSecondary, fontSize: 13 },
});