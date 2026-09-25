import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyClCvf1FUnXb6na8UeZ_knRBTCakAVJCQs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "nesamtoursandtravels-202f5.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "nesamtoursandtravels-202f5",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "nesamtoursandtravels-202f5.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "391292064102",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:391292064102:web:9a8c8d3cbd314cc167b8a7",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-ZEE41TN9EK"
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// --- Firebase App Check (reCAPTCHA Enterprise) -------------------------------
// OFF by default. Enable only after the reCAPTCHA Enterprise key is registered
// as an App Check provider for this web app in the Firebase console — otherwise
// the token exchange 403s and Firebase applies a 24h client-side throttle.
// To turn on: set VITE_APPCHECK_ENABLED=true (and VITE_RECAPTCHA_ENTERPRISE_SITE_KEY).
const recaptchaEnterpriseSiteKey =
  import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY ||
  '6LemkLMtAAAAANiJqI4vXxZ06QYSuIwilOgxf5Q7';

if (
  import.meta.env.VITE_APPCHECK_ENABLED === 'true' &&
  typeof window !== 'undefined' &&
  !('__APP_CHECK_STARTED__' in window)
) {
  (window as unknown as Record<string, unknown>).__APP_CHECK_STARTED__ = true;

  // Local dev: set VITE_APPCHECK_DEBUG_TOKEN=true, then register the printed
  // token under App Check > Apps > Manage debug tokens.
  const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  if (debugToken) {
    (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugToken === 'true' ? true : debugToken;
  }

  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaEnterpriseSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('[firebase] App Check init skipped:', err);
  }
}

export const auth = getAuth(app);

// Persistent (IndexedDB) cache so trip history and the active ride render
// offline and survive reloads. Falls back to the in-memory cache where
// IndexedDB is unavailable (private mode, some embedded webviews) or when
// Firestore was already initialised (Vite HMR).
function createFirestore(): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn('[firebase] persistent cache unavailable, using memory cache:', err);
    return getFirestore(app);
  }
}

export const db = createFirestore();
export const storage = getStorage(app);
