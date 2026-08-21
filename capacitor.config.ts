import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.batman.personalos',
  appName: 'Personal OS',
  webDir: 'out', // Next.js static export
  server: {
    // During development — loads live from Vercel, no rebuild needed
    url: 'https://personal-os-xi-gilt.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#000000',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: true,
    scrollEnabled: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
