'use client';

// HealthKitInit.tsx
// Runs once on app launch (native only).
// Syncs latest HealthKit weight + recent Garmin workouts into the Personal OS DB.
// Permission request is handled by page.tsx — this just does the DB write.

import { useEffect } from 'react';
import { isNative, getHealthData } from '@/lib/healthkit';
import { logWeight, addWorkoutLog, todayISO } from '@/lib/db';

export default function HealthKitInit() {
  useEffect(() => {
    if (!isNative()) return;

    const alreadyRan = sessionStorage.getItem('hk_synced');
    if (alreadyRan) return;

    async function syncToDb() {
      try {
        const authorised = localStorage.getItem('hk_asked') === '1';
        if (!authorised) return; // wait for page.tsx to request permission first

        const data = await getHealthData();
        if (!data.available) return;

        // Sync weight
        if (data.weight > 0) {
          await logWeight(data.weight);
          console.log('[HealthKit] Weight synced:', data.weight, 'kg');
        }

        // Sync workouts to DB
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
        console.log('[HealthKit] DB sync complete. Workouts:', data.workouts.length);
      } catch (e) {
        console.warn('[HealthKit] Sync error:', e);
      }
    }

    // Small delay to let page.tsx request permissions first
    const t = setTimeout(syncToDb, 2000);
    return () => clearTimeout(t);
  }, []);

  return null;
}
