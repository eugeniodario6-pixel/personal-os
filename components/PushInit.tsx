'use client';

// PushInit.tsx — runs once per session, native only.
// All Capacitor imports are lazy (dynamic) so SSR never touches them.

import { useEffect } from 'react';

export default function PushInit() {
  useEffect(() => {
    const isNative =
      typeof window !== 'undefined' &&
      typeof (window as any)?.Capacitor?.isNativePlatform === 'function' &&
      (window as any).Capacitor.isNativePlatform();

    if (!isNative) return;
    if (sessionStorage.getItem('push_registered')) return;

    const t = setTimeout(async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // Listeners first
        PushNotifications.addListener('pushNotificationReceived', (n) => {
          console.log('[Push] Received:', n);
        });
        PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
          const route = a.notification.data?.route;
          if (route) window.location.href = route;
        });

        // Request permission
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt') {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== 'granted') return;

        await PushNotifications.register();

        PushNotifications.addListener('registration', async (token) => {
          console.log('[Push] Token:', token.value);
          // Retry until user is authenticated (may take a few seconds after app load)
          let attempts = 0;
          const tryStore = async () => {
            attempts++;
            const { supabase } = await import('@/lib/supabase');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              if (attempts < 10) setTimeout(tryStore, 2000);
              return;
            }
            await supabase.from('device_tokens').upsert({
              user_id: user.id,
              token: token.value,
              platform: 'ios',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,platform' });
            sessionStorage.setItem('push_registered', '1');
            console.log('[Push] Token stored ✓');
          };
          await tryStore();
        });

        PushNotifications.addListener('registrationError', (e) => {
          console.error('[Push] Registration error:', e);
        });

      } catch (e) {
        console.error('[Push] Init error:', e);
      }
    }, 1500);

    return () => clearTimeout(t);
  }, []);

  return null;
}
