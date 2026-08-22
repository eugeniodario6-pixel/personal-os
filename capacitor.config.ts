import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.batman.personalos',
  appName: 'Personal OS',
  webDir: 'out', // Next.js static export
  server: {
    url: 'https://personal-os-xi-gilt.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#000000',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: true,
    scrollEnabled: true,
    allowsLinkPreview: false,
    handleApplicationNotifications: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
