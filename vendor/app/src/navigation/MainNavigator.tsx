import React, { createContext, useContext, useEffect, useState } from 'react';
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
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { PenaltiesScreen } from '../screens/PenaltiesScreen';
import { NotificationPopups } from '../components/NotificationPopups';
import { PenaltyAckModal } from '../components/PenaltyAckModal';
import { useInbox } from '../context/Inbox';
import { markNotificationRead, } from '../services/partnerNotifications';
import { onPushOpened } from '../services/notificationService';
import { navigationRef } from './navigationRef';
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

/** Where a notification's call-to-action leads. */
function openPage(page: string) {
  if (!navigationRef.isReady()) return;
  switch (page) {
    case 'market':
      return navigationRef.navigate('Tabs', { screen: 'Market' });
    case 'trips':
    case 'booking-detail':
      return navigationRef.navigate('Tabs', { screen: 'Trips' });
    case 'wallet':
      return navigationRef.navigate('Wallet');
    case 'profile':
      return navigationRef.navigate('Profile');
    case 'penalties':
      return navigationRef.navigate('Penalties');
    default:
      return navigationRef.navigate('Notifications');
  }
}

/** Popups with tones for new events, the penalty acknowledgement that cannot be skipped, and push taps. */
function WorkspaceOverlays() {
  const { notifications, unacknowledged } = useInbox();
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const pending = unacknowledged.find((x) => !doneIds.includes(x.id));
  useEffect(() => onPushOpened((d) => openPage(d.page)), []);
  return (
    <>
      <NotificationPopups
        notifications={notifications}
        onOpen={(n) => openPage(n.ctaPage)}
        onRead={(n) => {
          if (!n.read) markNotificationRead(n.id).catch(() => undefined);
        }}
      />
      {pending ? <PenaltyAckModal key={pending.id} penalty={pending} onDone={() => setDoneIds((ids) => [...ids, pending.id])} /> : null}
    </>
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
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
        <Stack.Screen name="Penalties" component={PenaltiesScreen} options={{ title: 'Penalties' }} />
      </Stack.Navigator>
      <WorkspaceOverlays />
    </SignOutCtx.Provider>
  );
}
