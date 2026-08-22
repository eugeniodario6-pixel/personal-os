import { registerPlugin } from '@capacitor/core';

export interface HKWorkout {
  type: string;
  duration: number;   // minutes
  calories: number;   // kcal
  date: string;       // ISO8601
}

export interface HealthKitPlugin {
  requestPermissions(): Promise<{ granted: boolean }>;
  getData(): Promise<HealthData>;
}

export interface HealthData {
  available: boolean;
  steps: number;
  heartRate: number;
  bpm: number;
  hrv: number;
  sleepHours: number;
  sleepMinutes: number;
  weight: number;
  activeCalories: number;
  kcal: number;
  workouts: HKWorkout[];
}

const HealthKit = registerPlugin<HealthKitPlugin>('HealthKit', {
  web: {
    requestPermissions: async () => ({ granted: false }),
    getData: async () => ({
      available: false,
      steps: 0, heartRate: 0, bpm: 0, hrv: 0,
      sleepHours: 0, sleepMinutes: 0,
      weight: 0, activeCalories: 0, kcal: 0, workouts: [],
    }),
  },
});

export async function requestHealthKitPermissions(): Promise<boolean> {
  try {
    const { granted } = await HealthKit.requestPermissions();
    return granted;
  } catch { return false; }
}

export async function getHealthData(): Promise<HealthData> {
  try {
    return await HealthKit.getData();
  } catch {
    return { available: false, steps: 0, heartRate: 0, bpm: 0, hrv: 0, sleepHours: 0, sleepMinutes: 0, weight: 0, activeCalories: 0, kcal: 0, workouts: [] };
  }
}
