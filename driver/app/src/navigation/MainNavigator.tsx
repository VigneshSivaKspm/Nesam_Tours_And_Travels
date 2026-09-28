import React, { createContext, useContext, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, TabParamList } from './types';
import { navigationRef } from './navigationRef';
import { useDriverData } from '../context/DriverData';
import { HomeScreen } from '../screens/HomeScreen';
import { TripScreen } from '../screens/TripScreen';
import { EarningsScreen } from '../screens/EarningsScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { PreTripScreen } from '../screens/PreTripScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { UpdateDocumentsScreen } from '../screens/UpdateDocumentsScreen';
import { useTripLocationSharing } from '../hooks/useTripLocationSharing';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const SignOutCtx = createContext<() => void>(() => undefined);
export const useSignOut = () => useContext(SignOutCtx);

const TAB_ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'speedometer-outline',
  Trip: 'navigate-outline',
  Earnings: 'bar-chart-outline',
  Wallet: 'wallet-outline',
  Profile: 'person-circle-outline',
};

function Tabs() {
  const { activeTrip } = useDriverData();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICONS[route.name]} color={color} size={size} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Trip" component={TripScreen} options={{ tabBarBadge: activeTrip ? '●' : undefined, tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.white } }} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/** State restoration: a driver with an assigned / ongoing trip lands on it. */
function TripAutoFocus() {
  const { activeTrip } = useDriverData();
  const tripId = activeTrip?.id ?? null;
  useEffect(() => {
    if (!tripId) return undefined;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = () => {
      if (!navigationRef.isReady()) {
        if (tries++ < 20) timer = setTimeout(attempt, 100);
        return;
      }
      const current = navigationRef.getCurrentRoute()?.name;
      if (current === 'Trip' || current === 'PreTrip') return;
      navigationRef.navigate('Tabs', { screen: 'Trip' });
    };
    timer = setTimeout(attempt, 0);
    return () => clearTimeout(timer);
  }, [tripId]);
  return null;
}

/** Shares the driver's live position with the customer during a trip. */
function LocationSharing() {
  const { activeTrip } = useDriverData();
  useTripLocationSharing(activeTrip);
  return null;
}

export function MainNavigator({ onSignOut }: { onSignOut: () => void }) {
  return (
    <SignOutCtx.Provider value={onSignOut}>
      <Stack.Navigator screenOptions={{ headerTintColor: colors.ink, headerTitleStyle: { fontWeight: '800' }, headerShadowVisible: false }}>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="PreTrip" component={PreTripScreen} options={{ title: 'Pre-trip check' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
        <Stack.Screen name="UpdateDocuments" component={UpdateDocumentsScreen} options={{ title: 'Update documents' }} />
      </Stack.Navigator>
      <TripAutoFocus />
      <LocationSharing />
    </SignOutCtx.Provider>
  );
}
