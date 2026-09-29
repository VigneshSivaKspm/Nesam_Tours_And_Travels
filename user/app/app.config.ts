import type { ExpoConfig } from 'expo/config';

// Google Maps is optional: without a key the app shows route cards with an
// "Open in Google Maps" link instead of an embedded map (never a crash).
// Provide it at build time: GOOGLE_MAPS_ANDROID_API_KEY=... npx expo prebuild
const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() ?? '';

const config: ExpoConfig = {
  owner: 'vigneshsivakspm',
  name: 'NESAM Customer',
  slug: 'nesam-customer-app',
  scheme: 'nesamcustomer',
  version: '1.0.0',
  platforms: ['android', 'ios'],
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: '#F7F7F7',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.nesamtours.customer',
  },
  android: {
    package: 'com.nesamtours.customer',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    softwareKeyboardLayoutMode: 'resize',
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.CAMERA',
    ],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
    ],
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#FFFFFF',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'NESAM uses your location to set your pickup point and share it in an emergency.',
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'NESAM needs access to your photos to set your profile picture.',
        cameraPermission: 'NESAM needs camera access to take your profile picture.',
        microphonePermission: false,
      },
    ],
    '@react-native-community/datetimepicker',
    'expo-sharing',
    './plugins/withReleaseSigning',
    ...(mapsKey ? [['react-native-maps', { androidGoogleMapsApiKey: mapsKey }] as [string, Record<string, string>]] : []),
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
          usesCleartextTraffic: false,
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
  ],
  extra: {
    mapsEnabled: !!mapsKey,
    eas: {
      projectId: '94ce7c34-2741-4406-803d-09ad8d519bbf',
    },
  },
};

export default config;
