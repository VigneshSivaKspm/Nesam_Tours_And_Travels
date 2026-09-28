import React, { createContext, useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, TabParamList } from './types';
import { useVendorData } from '../context/VendorData';
import { DashboardScreen } from '../screens/DashboardScreen';
import { MarketplaceScreen } from '../screens/MarketplaceScreen';
import { TripsScreen } from '../screens/TripsScreen';
import { FleetScreen } from '../screens/FleetScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { DriversScreen } from '../screens/DriversScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const SignOutCtx = createContext<() => void>(() => undefined);
export const useSignOut = () => useContext(SignOutCtx);

const TAB_ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'grid-outline',
  Market: 'pricetags-outline',
  Trips: 'navigate-outline',
  Fleet: 'car-outline',
  More: 'menu-outline',
};

function Tabs() {
  const { awaitingDispatch, marketTrips } = useVendorData();
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
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Market" component={MarketplaceScreen} options={{ title: 'Marketplace', tabBarBadge: marketTrips.length || undefined }} />
      <Tab.Screen name="Trips" component={TripsScreen} options={{ tabBarBadge: awaitingDispatch.length || undefined }} />
      <Tab.Screen name="Fleet" component={FleetScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

export function MainNavigator({ onSignOut }: { onSignOut: () => void }) {
  return (
    <SignOutCtx.Provider value={onSignOut}>
      <Stack.Navigator screenOptions={{ headerTintColor: colors.ink, headerTitleStyle: { fontWeight: '800' }, headerShadowVisible: false }}>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Drivers" component={DriversScreen} options={{ title: 'Drivers & invites' }} />
        <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet & payouts' }} />
        <Stack.Screen name="Documents" component={DocumentsScreen} options={{ title: 'Documents & compliance' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Business profile' }} />
      </Stack.Navigator>
    </SignOutCtx.Provider>
  );
}
