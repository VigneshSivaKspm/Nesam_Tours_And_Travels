// Firebase for the Driver app: same project, Auth users, Firestore and
// Storage as the Driver Web panel. This is the public client configuration
// (identifiers, not secrets) — access is enforced by firestore.rules and
// storage.rules.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyClCvf1FUnXb6na8UeZ_knRBTCakAVJCQs',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'nesamtoursandtravels-202f5.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'nesamtoursandtravels-202f5',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'nesamtoursandtravels-202f5.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '391292064102',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:391292064102:web:9a8c8d3cbd314cc167b8a7',
};

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// initializeAuth may only run once per app; Fast Refresh re-evaluates this
// module, so fall back to the existing instance.
function createAuth(): Auth {
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app);
  }
}
export const auth = createAuth();

// React Native has no IndexedDB, so the cache is in-memory; the live
// listeners re-hydrate everything (active ride included) on app start.
// Long-polling auto-detection avoids WebChannel stalls on some networks.
function createFirestore(): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    return getFirestore(app);
  }
}
export const db = createFirestore();
export const storage = getStorage(app);
