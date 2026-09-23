import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
export const auth = getAuth(app);
export const db = getFirestore(app);
