'use client';

// HealthKitInit.tsx
// Runs once per session (native only).
// After page.tsx requests HealthKit permissions, this syncs weight + workouts into the DB.

import { useEffect } from 'react';
import { getHealthData } from '@/lib/healthkit';
import { logWeight, addWorkoutLog } from '@/lib/db';

export default function HealthKitInit() {
  useEffect(() => {
    // Only run in native Capacitor app
    const isNative =
      typeof window !== 'undefined' &&
      typeof (window as any)?.Capacitor?.isNativePlatform === 'function' &&
      (window as any).Capacitor.isNativePlatform();

    if (!isNative) return;
    if (sessionStorage.getItem('hk_synced')) return;

    async function syncToDb() {
      try {
        // Wait for page.tsx to request permissions first
        const authorised = localStorage.getItem('hk_asked') === '1';
        if (!authorised) return;

        const data = await getHealthData();
        if (!data.available) return;

        // Sync latest weight from Apple Health (Garmin writes here)
        if (data.weight > 0) {
          await logWeight(data.weight);
        }

        // Sync recent workouts into DB
        for (const w of data.workouts) {
          if (w.duration > 0) {
            await addWorkoutLog({
              date: w.date.slice(0, 10),
              template_id: null,
              name: w.type,
              duration_min: Math.round(w.duration),
              intensity: w.calories > 400 ? 'high' : w.calories > 200 ? 'moderate' : 'low',
              calories_burned: w.calories > 0 ? Math.round(w.calories) : null,
              source: 'healthkit',
              logged_at: w.date,
            });
          }
        }

        sessionStorage.setItem('hk_synced', '1');
      } catch (e) {
        console.warn('[HealthKit] Sync error:', e);
      }
    }

    // Small delay to let page.tsx request permissions first
    const t = setTimeout(syncToDb, 2500);
    return () => clearTimeout(t);
  }, []);

  return null;
}
