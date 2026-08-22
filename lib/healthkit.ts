import { registerPlugin } from '@capacitor/core';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HealthKitPlugin {
  requestPermissions(): Promise<{ granted: boolean }>;
  getSteps(): Promise<{ steps: number }>;
  getHeartRate(): Promise<{ bpm: number }>;
  getHRV(): Promise<{ ms: number }>;
  getSleep(): Promise<{ hours: number; minutes: number; totalMinutes: number }>;
  getWeight(): Promise<{ kg: number }>;
  getActiveCalories(): Promise<{ kcal: number }>;
  getWorkouts(): Promise<{ workouts: HKWorkout[] }>;
}

export interface HKWorkout {
  type: string;
  duration: number;   // minutes
  calories: number;   // kcal
  date: string;       // ISO8601
}

export interface HealthData {
  steps: number;
  heartRate: number;      // bpm
  hrv: number;            // ms
  sleepHours: number;
  sleepMinutes: number;
  weight: number;         // kg
  activeCalories: number; // kcal
  workouts: HKWorkout[];
  available: boolean;
}

// ── Register plugin ───────────────────────────────────────────────────────────

const HealthKit = registerPlugin<HealthKitPlugin>('HealthKit', {
  // Web fallback — returns empty data so the app doesn't break in browser
  web: {
    requestPermissions: async () => ({ granted: false }),
    getSteps:           async () => ({ steps: 0 }),
    getHeartRate:       async () => ({ bpm: 0 }),
    getHRV:             async () => ({ ms: 0 }),
    getSleep:           async () => ({ hours: 0, minutes: 0, totalMinutes: 0 }),
    getWeight:          async () => ({ kg: 0 }),
    getActiveCalories:  async () => ({ kcal: 0 }),
    getWorkouts:        async () => ({ workouts: [] }),
  },
});

// ── Request permissions ───────────────────────────────────────────────────────

export async function requestHealthKitPermissions(): Promise<boolean> {
  try {
    const { granted } = await HealthKit.requestPermissions();
    return granted;
  } catch {
    return false;
  }
}

// ── Fetch all health data in one call ─────────────────────────────────────────

export async function getHealthData(): Promise<HealthData> {
  const empty: HealthData = {
    steps: 0, heartRate: 0, hrv: 0,
    sleepHours: 0, sleepMinutes: 0,
    weight: 0, activeCalories: 0,
    workouts: [], available: false,
  };

  try {
    const [steps, hr, hrv, sleep, weight, calories, workouts] = await Promise.allSettled([
      HealthKit.getSteps(),
      HealthKit.getHeartRate(),
      HealthKit.getHRV(),
      HealthKit.getSleep(),
      HealthKit.getWeight(),
      HealthKit.getActiveCalories(),
      HealthKit.getWorkouts(),
    ]);

    return {
      steps:          steps.status === 'fulfilled'    ? steps.value.steps           : 0,
      heartRate:      hr.status === 'fulfilled'       ? hr.value.bpm                : 0,
      hrv:            hrv.status === 'fulfilled'      ? hrv.value.ms                : 0,
      sleepHours:     sleep.status === 'fulfilled'    ? sleep.value.hours           : 0,
      sleepMinutes:   sleep.status === 'fulfilled'    ? sleep.value.minutes         : 0,
      weight:         weight.status === 'fulfilled'   ? weight.value.kg             : 0,
      activeCalories: calories.status === 'fulfilled' ? calories.value.kcal         : 0,
      workouts:       workouts.status === 'fulfilled' ? workouts.value.workouts     : [],
      available: true,
    };
  } catch {
    return empty;
  }
}
