const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface NutritionData {
  date: string;
  macros: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  targets: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  weight: {
    latest_kg: number | null;
    rolling_avg_kg: number | null;
  };
  projection: {
    tdee: number;
    deficit: number;
    weekly_rate_kg: number;
    eta_weeks: number;
  };
  points: {
    adherence: number;
    bonus: number;
    total: number;
  };
  phase: string;
}

export async function getTodayNutrition(): Promise<NutritionData> {
  const res = await fetch(`${BASE}/api/nutrition/today`);
  if (!res.ok) throw new Error('Failed to fetch nutrition');
  return res.json();
}

export async function syncNutrition(date?: string): Promise<unknown> {
  const res = await fetch(`${BASE}/api/nutrition/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: date ?? new Date().toISOString().split('T')[0] }),
  });
  if (!res.ok) throw new Error('Sync failed');
  return res.json();
}

export async function postWeight(date: string, weight_kg: number): Promise<unknown> {
  const res = await fetch(`${BASE}/api/weight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, weight_kg }),
  });
  if (!res.ok) throw new Error('Weight post failed');
  return res.json();
}
