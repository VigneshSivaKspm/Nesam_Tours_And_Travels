import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { navigationRef } from './navigationRef';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, TabParamList } from './types';
import { useCustomerData } from '../context/CustomerData';
import { BookScreen } from '../screens/BookScreen';
import { TripsScreen } from '../screens/TripsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { ActiveRideScreen } from '../screens/ActiveRideScreen';
import { SavedPlacesScreen } from '../screens/SavedPlacesScreen';
import { OffersScreen } from '../screens/OffersScreen';
import { SupportScreen } from '../screens/SupportScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Rides the rider minimised this session — not re-opened automatically.
interface RideFocus {
  dismiss: (bookingId: string) => void;
  undismiss: (bookingId: string) => void;
}
const RideFocusCtx = createContext<RideFocus>({ dismiss: () => undefined, undismiss: () => undefined });
export const useRideFocus = () => useContext(RideFocusCtx);

const TAB_ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Book: 'car-sport',
  Trips: 'receipt-outline',
  Alerts: 'notifications-outline',
  Account: 'person-circle-outline',
};

function Tabs() {
  const { unreadCount } = useCustomerData();
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
      <Tab.Screen name="Book" component={BookScreen} options={{ title: 'Book' }} />
      <Tab.Screen name="Trips" component={TripsScreen} options={{ title: 'My Trips' }} />
      <Tab.Screen name="Alerts" component={NotificationsScreen} options={{ title: 'Alerts', tabBarBadge: unreadCount > 0 ? unreadCount : undefined }} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

/** State restoration: open the live ride (or an unrated finished one) on launch. */
function RideAutoFocus({ dismissed }: { dismissed: React.MutableRefObject<Set<string>> }) {
  const { liveRide, unratedTrip } = useCustomerData();
  const candidateId = (liveRide ?? unratedTrip)?.id ?? null;

  useEffect(() => {
    if (!candidateId || dismissed.current.has(candidateId)) return undefined;
    // The navigator mounts in the same commit; wait until it can navigate.
    let tries = 0;
    const attempt = () => {
      if (!navigationRef.isReady()) {
        if (tries++ < 20) timer = setTimeout(attempt, 100);
        return;
      }
      if (navigationRef.getCurrentRoute()?.name === 'ActiveRide') return;
      navigationRef.navigate('ActiveRide', { bookingId: candidateId });
    };
    let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(attempt, 0);
    return () => clearTimeout(timer);
  }, [candidateId, dismissed]);
  return null;
}

export function MainNavigator() {
  const dismissed = useRef<Set<string>>(new Set());
  const dismiss = useCallback((id: string) => {
    dismissed.current.add(id);
  }, []);
  const undismiss = useCallback((id: string) => {
    dismissed.current.delete(id);
  }, []);
  const focus = useMemo(() => ({ dismiss, undismiss }), [dismiss, undismiss]);

  return (
    <RideFocusCtx.Provider value={focus}>
      <Stack.Navigator screenOptions={{ headerTintColor: colors.ink, headerTitleStyle: { fontWeight: '800' }, headerShadowVisible: false }}>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="ActiveRide" component={ActiveRideScreen} options={{ title: 'Your ride' }} />
        <Stack.Screen name="SavedPlaces" component={SavedPlacesScreen} options={{ title: 'Saved places' }} />
        <Stack.Screen name="Offers" component={OffersScreen} options={{ title: 'Offers' }} />
        <Stack.Screen name="Support" component={SupportScreen} options={{ title: 'Help & support' }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit profile' }} />
      </Stack.Navigator>
      <RideAutoFocus dismissed={dismissed} />
    </RideFocusCtx.Provider>
  );
}
