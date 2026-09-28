import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'NESAM Vendor',
  slug: 'nesam-vendor-app',
  scheme: 'nesamvendor',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: '#F7F7F7',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.nesamtours.vendor',
  },
  android: {
    package: 'com.nesamtours.vendor',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    softwareKeyboardLayoutMode: 'resize',
    predictiveBackGestureEnabled: false,
    permissions: ['android.permission.CAMERA'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
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
      'expo-image-picker',
      {
        photosPermission: 'NESAM Vendor needs your photos to upload business and vehicle documents.',
        cameraPermission: 'NESAM Vendor needs the camera to photograph business and vehicle documents.',
        microphonePermission: false,
      },
    ],
    '@react-native-community/datetimepicker',
    './plugins/withReleaseSigning',
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
};

export default config;
