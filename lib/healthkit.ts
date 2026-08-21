// lib/healthkit.ts
// JavaScript interface to the native HealthKit bridge
// Works in Capacitor (native iOS) — gracefully no-ops in browser
//
// Usage:
//   import { HealthKit } from '@/lib/healthkit'
//   const weight = await HealthKit.getLatestWeight()

import { registerPlugin } from '@capacitor/core';

export interface HealthKitPlugin {
  requestAuthorization(): Promise<{ authorised: boolean }>;
  getLatestWeight(): Promise<{ weight_kg: number | null; date: string }>;
  getWorkouts(options: { days: number }): Promise<{ workouts: HealthKitWorkout[] }>;
  getHeartRate(): Promise<{ avg_bpm: number; samples: number }>;
  getSleep(): Promise<{ hours: number }>;
  getSteps(): Promise<{ steps: number }>;
  writeWeight(options: { weight_kg: number }): Promise<void>;
}

export interface HealthKitWorkout {
  type: string;
  duration_min: number;
  calories: number;
  distance_m: number;
  start: string;
  end: string;
  source: string; // e.g. "Garmin Connect"
}

// Register the native plugin — returns a no-op stub in browser
export const HealthKit = registerPlugin<HealthKitPlugin>('HealthKitBridge', {
  web: {
    requestAuthorization: async () => ({ authorised: false }),
    getLatestWeight:      async () => ({ weight_kg: null, date: '' }),
    getWorkouts:          async () => ({ workouts: [] }),
    getHeartRate:         async () => ({ avg_bpm: 0, samples: 0 }),
    getSleep:             async () => ({ hours: 0 }),
    getSteps:             async () => ({ steps: 0 }),
    writeWeight:          async () => {},
  },
});

// ── Convenience: is this running as a native app? ─────────────────────────────
export function isNative(): boolean {
  return typeof (window as any)?.Capacitor?.isNativePlatform === 'function'
    && (window as any).Capacitor.isNativePlatform();
}

// ── Sync latest HealthKit weight → Personal OS DB ──────────────────────────────
// Call this on app launch to pull the latest Garmin/Apple Health weight
export async function syncHealthKitWeight(
  logWeightFn: (kg: number) => Promise<void>
): Promise<{ synced: boolean; weight_kg?: number }> {
  if (!isNative()) return { synced: false };
  try {
    const { authorised } = await HealthKit.requestAuthorization();
    if (!authorised) return { synced: false };
    const { weight_kg } = await HealthKit.getLatestWeight();
    if (weight_kg && weight_kg > 0) {
      await logWeightFn(weight_kg);
      return { synced: true, weight_kg };
    }
    return { synced: false };
  } catch { return { synced: false }; }
}

// ── Sync recent Garmin workouts → Personal OS DB ───────────────────────────────
export async function syncHealthKitWorkouts(
  logWorkoutFn: (name: string, duration_min: number, calories: number) => Promise<void>,
  days = 7
): Promise<{ synced: number }> {
  if (!isNative()) return { synced: 0 };
  try {
    const { authorised } = await HealthKit.requestAuthorization();
    if (!authorised) return { synced: 0 };
    const { workouts } = await HealthKit.getWorkouts({ days });
    let synced = 0;
    for (const w of workouts) {
      if (w.source.toLowerCase().includes('garmin') || w.duration_min > 0) {
        await logWorkoutFn(w.type, w.duration_min, w.calories);
        synced++;
      }
    }
    return { synced };
  } catch { return { synced: 0 }; }
}
