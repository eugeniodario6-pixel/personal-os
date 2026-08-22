'use client';

// HealthKitInit.tsx
// Mounts invisibly in layout — requests HealthKit permission on first native launch
// then syncs weight + recent Garmin workouts into the Personal OS DB.

import { useEffect } from 'react';
import { HealthKit, isNative } from '@/lib/healthkit';
import { logWeight, addWorkoutLog, todayISO } from '@/lib/db';

export default function HealthKitInit() {
  useEffect(() => {
    if (!isNative()) return;

    async function init() {
      try {
        const { authorised } = await HealthKit.requestAuthorization();
        if (!authorised) return;

        localStorage.setItem('hk_authorised', 'true');

        // ── Sync latest weight from Apple Health (Garmin writes here) ──
        const { weight_kg } = await HealthKit.getLatestWeight();
        if (weight_kg && weight_kg > 0) {
          await logWeight(weight_kg);
          console.log('[HealthKit] Weight synced:', weight_kg, 'kg');
        }

        // ── Sync recent workouts (last 7 days) ──
        const { workouts } = await HealthKit.getWorkouts({ days: 7 });
        const today = todayISO();
        for (const w of workouts) {
          if (w.duration_min > 0) {
            const workoutDate = w.start.slice(0, 10);
            await addWorkoutLog({
              date: workoutDate,
              template_id: null,
              name: w.type,
              duration_min: w.duration_min,
              intensity: w.calories > 400 ? 'high' : w.calories > 200 ? 'moderate' : 'low',
              calories_burned: w.calories > 0 ? Math.round(w.calories) : null,
              source: 'healthkit',
              logged_at: w.start,
            });
          }
        }
        console.log('[HealthKit] Workouts synced:', workouts.length);

      } catch (e) {
        console.warn('[HealthKit] Init error:', e);
      }
    }

    init();
  }, []);

  return null;
}
