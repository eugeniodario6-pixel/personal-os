// lib/notifications.ts
// Push notification setup for Capacitor iOS
// Uses lazy imports so it never breaks server-side rendering

import { isNative } from './healthkit';

// ── Register for push notifications ───────────────────────────────────────────
export async function registerPushNotifications(): Promise<string | null> {
  if (!isNative()) return null;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt') {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== 'granted') return null;

  await PushNotifications.register();

  return new Promise((resolve) => {
    PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] APNs token:', token.value);
      await storeDeviceToken(token.value);
      resolve(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration failed:', err);
      resolve(null);
    });
  });
}

// ── Store device token in Supabase ────────────────────────────────────────────
async function storeDeviceToken(token: string): Promise<void> {
  try {
    const { supabase } = await import('./supabase');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('device_tokens').upsert({
      user_id: user.id,
      token,
      platform: 'ios',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform' });
    console.log('[Push] Token stored in Supabase');
  } catch (e) {
    console.error('[Push] Failed to store token:', e);
  }
}

// ── Listen for incoming notifications ─────────────────────────────────────────
export async function setupNotificationListeners(): Promise<void> {
  if (!isNative()) return;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[Push] Received:', notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data;
    console.log('[Push] Tapped:', data);
    if (data?.route) {
      window.location.href = data.route;
    }
  });
}
