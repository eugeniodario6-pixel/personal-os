import { registerPlugin } from '@capacitor/core';

export interface HealthKitPlugin {
  requestPermissions(): Promise<{ granted: boolean }>;
  getData(): Promise<HealthData>;
}

export interface HealthData {
  available: boolean;
  steps: number;
  bpm: number;
  hrv: number;
  sleepHours: number;
  sleepMinutes: number;
  weight: number;
  kcal: number;
}

const HealthKit = registerPlugin<HealthKitPlugin>('HealthKit', {
  web: {
    requestPermissions: async () => ({ granted: false }),
    getData: async () => ({
      available: false,
      steps: 0, bpm: 0, hrv: 0,
      sleepHours: 0, sleepMinutes: 0,
      weight: 0, kcal: 0,
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
    return { available: false, steps: 0, bpm: 0, hrv: 0, sleepHours: 0, sleepMinutes: 0, weight: 0, kcal: 0 };
  }
}
