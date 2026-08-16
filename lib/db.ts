// ── Supabase-backed data layer ─────────────────────────────────────────────
// All IDs are bigserial integers (number), user_id is UUID (string).

import { supabase } from './supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: number;
  user_id: string;
  calorie_target: number;
  macro_targets: { protein: number; carbs: number; fat: number };
  weight_goal: number | null;
  units: 'metric' | 'imperial';
  non_numeric_mode: boolean;
  timezone: string;
}

export interface FoodItem {
  id: number;
  user_id: string;
  external_id: string | null;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_unit: string;
  serving_size: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  is_favorite: boolean;
}

export interface MealLog {
  id: number;
  user_id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_item_id: number;
  quantity: number;
  logged_at: string;
  source: 'barcode' | 'photo' | 'search' | 'manual';
}

export interface WorkoutTemplate {
  id: number;
  user_id: string;
  name: string;
  category: string;
  default_duration_min: number;
  default_intensity: 'low' | 'moderate' | 'high';
}

export interface WorkoutLog {
  id: number;
  user_id: string;
  date: string;
  template_id: number | null;
  name: string;
  duration_min: number;
  intensity: 'low' | 'moderate' | 'high';
  calories_burned: number | null;
  source: 'manual' | 'healthkit';
  logged_at: string;
}

export interface Habit {
  id: number;
  user_id: string;
  name: string;
  active: boolean;
  stacked_after_habit_id: number | null;
  streak_freeze_available: number;
  created_at: string;
}

export interface HabitCompletion {
  id: number;
  user_id: string;
  habit_id: number;
  date: string;
  completed_at: string | null;
}

export interface MeditationSession {
  id: number;
  name: string;
  category: string;
  duration_min: number;
  instructions: string | null;
  audio_url: string | null;
}

export interface MeditationLog {
  id: number;
  user_id: string;
  session_id: number;
  date: string;
  completed: boolean;
  duration_actual_min: number;
  logged_at: string;
}

export interface Insight {
  id: number;
  user_id: string;
  metric_a: string;
  metric_b: string;
  relationship: string;
  data_points: number;
  confidence: number;
  generated_at: string;
  shown: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// ── Profile ────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<Profile | null> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('profile')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    user_id: data.user_id,
    calorie_target: data.calorie_target,
    macro_targets: {
      protein: data.macro_protein,
      carbs: data.macro_carbs,
      fat: data.macro_fat,
    },
    weight_goal: data.weight_goal,
    units: data.units,
    non_numeric_mode: data.non_numeric_mode,
    timezone: data.timezone,
  };
}

export async function upsertProfile(p: Omit<Profile, 'id' | 'user_id'>): Promise<void> {
  const userId = await getUserId();
  await supabase.from('profile').upsert({
    user_id: userId,
    calorie_target: p.calorie_target,
    macro_protein: p.macro_targets.protein,
    macro_carbs: p.macro_targets.carbs,
    macro_fat: p.macro_targets.fat,
    weight_goal: p.weight_goal,
    units: p.units,
    non_numeric_mode: p.non_numeric_mode,
    timezone: p.timezone,
  }, { onConflict: 'user_id' });
}

// ── Food Items ─────────────────────────────────────────────────────────────

export async function addFoodItem(item: Omit<FoodItem, 'id' | 'user_id'>): Promise<number> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('food_item')
    .insert({ ...item, user_id: userId })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to add food item');
  return data.id;
}

export async function getFoodItem(id: number): Promise<FoodItem | null> {
  const { data } = await supabase.from('food_item').select('*').eq('id', id).single();
  return data ?? null;
}

// ── Meal Log ───────────────────────────────────────────────────────────────

export async function addMealLog(entry: Omit<MealLog, 'id' | 'user_id'>): Promise<void> {
  const userId = await getUserId();
  await supabase.from('meal_log').insert({ ...entry, user_id: userId });
}

export async function getMealLogs(date: string): Promise<(MealLog & { food: FoodItem | null })[]> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('meal_log')
    .select('*, food:food_item(*)')
    .eq('user_id', userId)
    .eq('date', date)
    .order('logged_at', { ascending: false });
  return (data ?? []).map(row => ({ ...row, food: row.food ?? null }));
}

export async function deleteMealLog(id: number): Promise<void> {
  await supabase.from('meal_log').delete().eq('id', id);
}

// Most recently logged distinct foods — for quick-log recents
export async function getRecentFoods(limit = 8): Promise<FoodItem[]> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('meal_log')
    .select('food:food_item(*), logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(50);
  if (!data) return [];
  const seen = new Set<number>();
  const foods: FoodItem[] = [];
  for (const row of data) {
    const food = (row.food as unknown) as FoodItem | null;
    if (food && !seen.has(food.id)) {
      seen.add(food.id);
      foods.push(food);
      if (foods.length >= limit) break;
    }
  }
  return foods;
}

export async function getTodayMacros(): Promise<{ calories: number; protein: number; carbs: number; fat: number }> {
  const logs = await getMealLogs(todayISO());
  return logs.reduce((acc, l) => {
    if (!l.food) return acc;
    const r = l.quantity / l.food.serving_size;
    return {
      calories: acc.calories + l.food.calories * r,
      protein: acc.protein + l.food.protein * r,
      carbs: acc.carbs + l.food.carbs * r,
      fat: acc.fat + l.food.fat * r,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ── Workout Templates ──────────────────────────────────────────────────────

export async function getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('workout_template')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  return data ?? [];
}

export async function addWorkoutTemplate(t: Omit<WorkoutTemplate, 'id' | 'user_id'>): Promise<number> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('workout_template')
    .insert({ ...t, user_id: userId })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed');
  return data.id;
}

// ── Workout Log ────────────────────────────────────────────────────────────

export async function addWorkoutLog(entry: Omit<WorkoutLog, 'id' | 'user_id'>): Promise<void> {
  const userId = await getUserId();
  await supabase.from('workout_log').insert({ ...entry, user_id: userId });
}

export async function getWorkoutLogs(date: string): Promise<WorkoutLog[]> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('workout_log')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('logged_at');
  return data ?? [];
}

export async function getWorkoutHistory(limit = 30): Promise<WorkoutLog[]> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('workout_log')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function deleteWorkoutLog(id: number): Promise<void> {
  await supabase.from('workout_log').delete().eq('id', id);
}

// ── Habits ─────────────────────────────────────────────────────────────────

export async function getHabits(): Promise<Habit[]> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('habit')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at');
  return data ?? [];
}

export async function addHabit(h: Omit<Habit, 'id' | 'user_id'>): Promise<void> {
  const userId = await getUserId();
  await supabase.from('habit').insert({ ...h, user_id: userId });
}

export async function deactivateHabit(id: number): Promise<void> {
  await supabase.from('habit').update({ active: false }).eq('id', id);
}

export async function getHabitCompletions(date: string): Promise<HabitCompletion[]> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('habit_completion')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date);
  return data ?? [];
}

export async function toggleHabitCompletion(habitId: number): Promise<void> {
  const userId = await getUserId();
  const today = todayISO();
  const { data: existing } = await supabase
    .from('habit_completion')
    .select('*')
    .eq('habit_id', habitId)
    .eq('date', today)
    .single();

  if (existing) {
    await supabase
      .from('habit_completion')
      .update({ completed_at: existing.completed_at ? null : new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('habit_completion').insert({
      user_id: userId,
      habit_id: habitId,
      date: today,
      completed_at: new Date().toISOString(),
    });
  }
}

export async function getHabitStreak(habitId: number): Promise<number> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('habit_completion')
    .select('date, completed_at')
    .eq('user_id', userId)
    .eq('habit_id', habitId)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false });

  if (!data) return 0;
  const completedDates = new Set(data.map(c => c.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (completedDates.has(iso)) streak++;
    else break;
  }
  return streak;
}

export async function getTodayHabitStatus(): Promise<{ completed: number; total: number }> {
  const habits = await getHabits();
  const completions = await getHabitCompletions(todayISO());
  const completedIds = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
  return { completed: habits.filter(h => completedIds.has(h.id)).length, total: habits.length };
}

// ── Meditation Sessions ────────────────────────────────────────────────────

export async function getMeditationSessions(): Promise<MeditationSession[]> {
  const { data } = await supabase.from('meditation_session').select('*').order('id');
  return data ?? [];
}

export async function getMeditationSession(id: number): Promise<MeditationSession | null> {
  const { data } = await supabase.from('meditation_session').select('*').eq('id', id).single();
  return data ?? null;
}

// ── Meditation Log ─────────────────────────────────────────────────────────

export async function getMeditationLogs(date: string): Promise<MeditationLog[]> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('meditation_log')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date);
  return data ?? [];
}

export async function addMeditationLog(entry: Omit<MeditationLog, 'id' | 'user_id'>): Promise<void> {
  const userId = await getUserId();
  await supabase.from('meditation_log').insert({ ...entry, user_id: userId });
}

// ── Insights ───────────────────────────────────────────────────────────────

export async function getInsights(): Promise<Insight[]> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('insight')
    .select('*')
    .eq('user_id', userId)
    .eq('shown', true)
    .order('generated_at', { ascending: false });
  return data ?? [];
}

// ── Seed default data for new users ───────────────────────────────────────

const DEFAULT_WORKOUT_TEMPLATES = [
  { name: 'Morning Run', category: 'Cardio', default_duration_min: 30, default_intensity: 'moderate' as const },
  { name: 'HIIT', category: 'Cardio', default_duration_min: 20, default_intensity: 'high' as const },
  { name: 'Upper Body', category: 'Strength', default_duration_min: 45, default_intensity: 'moderate' as const },
  { name: 'Lower Body', category: 'Strength', default_duration_min: 45, default_intensity: 'moderate' as const },
  { name: 'Full Body', category: 'Strength', default_duration_min: 60, default_intensity: 'moderate' as const },
  { name: 'Yoga', category: 'Flexibility', default_duration_min: 30, default_intensity: 'low' as const },
  { name: 'Walk', category: 'Cardio', default_duration_min: 45, default_intensity: 'low' as const },
  { name: 'Cycling', category: 'Cardio', default_duration_min: 60, default_intensity: 'moderate' as const },
];

const DEFAULT_HABITS = [
  { name: 'Morning water', active: true, stacked_after_habit_id: null, streak_freeze_available: 0, created_at: new Date().toISOString() },
  { name: 'Read 20 pages', active: true, stacked_after_habit_id: null, streak_freeze_available: 0, created_at: new Date().toISOString() },
  { name: 'No screens before bed', active: true, stacked_after_habit_id: null, streak_freeze_available: 0, created_at: new Date().toISOString() },
];

export async function seedUserData(): Promise<void> {
  const userId = await getUserId();

  const { count: tCount } = await supabase
    .from('workout_template')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (!tCount || tCount === 0) {
    await supabase.from('workout_template').insert(
      DEFAULT_WORKOUT_TEMPLATES.map(t => ({ ...t, user_id: userId }))
    );
  }

  const { count: hCount } = await supabase
    .from('habit')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (!hCount || hCount === 0) {
    await supabase.from('habit').insert(
      DEFAULT_HABITS.map(h => ({ ...h, user_id: userId }))
    );
  }

  const { count: pCount } = await supabase
    .from('profile')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (!pCount || pCount === 0) {
    await supabase.from('profile').insert({
      user_id: userId,
      calorie_target: 2000,
      macro_protein: 150,
      macro_carbs: 200,
      macro_fat: 65,
      weight_goal: null,
      units: 'metric',
      non_numeric_mode: false,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }
}
