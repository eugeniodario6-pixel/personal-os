// lib/notifications.ts
// Push notification setup for Capacitor iOS
// Works natively — no-ops in browser

import { PushNotifications } from '@capacitor/push-notifications';
import { isNative } from './healthkit';

// ── Register for push notifications ───────────────────────────────────────────
export async function registerPushNotifications(): Promise<string | null> {
  if (!isNative()) return null;

  // Check / request permission
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt') {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== 'granted') return null;

  // Register with APNs
  await PushNotifications.register();

  return new Promise((resolve) => {
    // Get the APNs device token — send to Supabase to store
    PushNotifications.addListener('registration', async (token) => {
      console.log('APNs token:', token.value);
      await storeDeviceToken(token.value);
      resolve(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration failed:', err);
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
  } catch (e) {
    console.error('Failed to store device token:', e);
  }
}

// ── Listen for incoming notifications ────────────────────────────────────────
export function setupNotificationListeners() {
  if (!isNative()) return;

  // Notification received while app is open
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Notification received:', notification);
    // Could show an in-app toast here
  });

  // User tapped a notification
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data;
    console.log('Notification tapped:', data);
    // Route based on notification type
    if (data?.route) {
      window.location.href = data.route;
    }
  });
}

// ── Notification types we'll send ─────────────────────────────────────────────
// These are sent server-side via Supabase Edge Function → APNs
//
// 1. Daily score ready           → "Your score is 78 today. Protein is the gap."
// 2. Habit streak at risk        → "Cold shower streak at 12 days — don't break it."
// 3. Jarvis nudge (coach)        → "You haven't logged lunch. What did you eat?"
// 4. Workout reminder            → "Training day. Session 3 of 4 this week."
// 5. HealthKit sync complete     → "Garmin workout synced — 45min strength added."
// 6. Weight milestone            → "Down 2kg since you started. Keep going."
