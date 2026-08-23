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
  starting_weight: number | null;
  units: 'metric' | 'imperial';
  non_numeric_mode: boolean;
  timezone: string;
  // Diet profile fields
  height_cm: number | null;
  current_weight_kg: number | null;
  ideal_weight_lbs: number | null;
  protein_target_g: number | null;
  carb_percent: number | null;
  carb_target_g: number | null;
  fat_target_g: number | null;
  score_weights: { protein: number; calories: number; carbs: number; fat: number } | null;
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

export interface MoodEntry {
  id: number;
  user_id: string;
  date: string;
  context: string;
  mood: number;
  stress: number | null;
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

// Cache userId for the session — auth.getUser() is async and called on every
// db function; batching into a single in-flight promise eliminates N redundant
// round-trips per page load.
let _userIdCache: string | null = null;
let _userIdInflight: Promise<string> | null = null;

export function clearUserIdCache() {
  _userIdCache = null;
  _userIdInflight = null;
  _seeded = false;
}

async function getUserId(): Promise<string> {
  if (_userIdCache) return _userIdCache;
  if (_userIdInflight) return _userIdInflight;
  _userIdInflight = supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) throw new Error('Not authenticated');
    _userIdCache = user.id;
    _userIdInflight = null;
    return user.id;
  });
  return _userIdInflight;
}

// Clear cache on sign-out so next login gets a fresh userId
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') clearUserIdCache();
});

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
      protein: data.macro_targets?.protein ?? data.macro_protein ?? 0,
      carbs: data.macro_targets?.carbs ?? data.macro_carbs ?? 0,
      fat: data.macro_targets?.fat ?? data.macro_fat ?? 0,
    },
    weight_goal: data.weight_goal,
    starting_weight: data.starting_weight ?? null,
    units: data.units,
    non_numeric_mode: data.non_numeric_mode,
    timezone: data.timezone,
    height_cm: data.height_cm ?? null,
    current_weight_kg: data.current_weight_kg ?? null,
    ideal_weight_lbs: data.ideal_weight_lbs ?? null,
    protein_target_g: data.protein_target_g ?? null,
    carb_percent: data.carb_percent ?? null,
    carb_target_g: data.carb_target_g ?? null,
    fat_target_g: data.fat_target_g ?? null,
    score_weights: data.score_weights ?? null,
  };
}

export async function upsertProfile(p: Omit<Profile, 'id' | 'user_id'>): Promise<void> {
  const userId = await getUserId();
  await supabase.from('profile').upsert({
    user_id: userId,
    calorie_target: p.calorie_target,
    macro_targets: { protein: p.macro_targets.protein, carbs: p.macro_targets.carbs, fat: p.macro_targets.fat },
    weight_goal: p.weight_goal,
    starting_weight: p.starting_weight,
    units: p.units,
    non_numeric_mode: p.non_numeric_mode,
    timezone: p.timezone,
    ...(p.height_cm != null ? { height_cm: p.height_cm } : {}),
    ...(p.current_weight_kg != null ? { current_weight_kg: p.current_weight_kg } : {}),
    ...(p.ideal_weight_lbs != null ? { ideal_weight_lbs: p.ideal_weight_lbs } : {}),
    ...(p.protein_target_g != null ? { protein_target_g: p.protein_target_g } : {}),
    ...(p.carb_percent != null ? { carb_percent: p.carb_percent } : {}),
    ...(p.score_weights != null ? { score_weights: p.score_weights } : {}),
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

export async function getMealLogsRange(startDate: string, endDate: string): Promise<(MealLog & { food: FoodItem | null })[]> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('meal_log')
    .select('*, food:food_item(*)')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('logged_at', { ascending: true });
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

export async function renameHabit(id: number, name: string): Promise<void> {
  await supabase.from('habit').update({ name: name.trim() }).eq('id', id);
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

// Batch version — fetches completions for all habits in ONE query instead of N.
// Returns a map of habitId → streak count.
// Batch fetch habit completions for a date range across all habit IDs.
// Returns a map of "habitId|date" → true for completed records.
export async function getHabitCompletionsRange(
  habitIds: number[],
  fromDate: string,
  toDate: string
): Promise<Map<string, boolean>> {
  if (habitIds.length === 0) return new Map();
  const userId = await getUserId();
  const { data } = await supabase
    .from('habit_completion')
    .select('habit_id, date, completed_at')
    .eq('user_id', userId)
    .in('habit_id', habitIds)
    .gte('date', fromDate)
    .lte('date', toDate);

  const result = new Map<string, boolean>();
  for (const row of data ?? []) {
    if (row.completed_at) {
      result.set(`${row.habit_id}|${row.date}`, true);
    }
  }
  return result;
}

export async function getHabitStreaks(habitIds: number[]): Promise<Map<number, number>> {
  if (habitIds.length === 0) return new Map();
  const userId = await getUserId();
  const { data } = await supabase
    .from('habit_completion')
    .select('habit_id, date, completed_at')
    .eq('user_id', userId)
    .in('habit_id', habitIds)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false });

  const byHabit = new Map<number, Set<string>>();
  for (const row of data ?? []) {
    if (!byHabit.has(row.habit_id)) byHabit.set(row.habit_id, new Set());
    byHabit.get(row.habit_id)!.add(row.date);
  }

  const today = new Date();
  const result = new Map<number, number>();
  for (const id of habitIds) {
    const dates = byHabit.get(id) ?? new Set<string>();
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (dates.has(d.toISOString().slice(0, 10))) streak++;
      else break;
    }
    result.set(id, streak);
  }
  return result;
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

// ── Mood Log ──────────────────────────────────────────────────────────────

export async function logMood(mood: number, stress: number | null, context: string): Promise<void> {
  const userId = await getUserId();
  await supabase.from('mood_log').insert({
    user_id: userId,
    mood,
    stress,
    context,
    date: todayISO(),
    logged_at: new Date().toISOString(),
  });
}

export async function getMoodLogs(days: number): Promise<MoodEntry[]> {
  const userId = await getUserId();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data } = await supabase
    .from('mood_log')
    .select('*')
    .eq('user_id', userId)
    .gte('date', since.toISOString().slice(0, 10))
    .order('logged_at', { ascending: false });
  return data ?? [];
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

// Guard so seedUserData only runs once per browser session, not on every page load.
let _seeded = false;

export async function seedUserData(): Promise<void> {
  if (_seeded) return;
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
    // Default diet profile per brief spec
    const calTarget = 1800;
    const carbPct = 0.05;
    const proteinTargetG = 176;
    const carbTargetG = Math.round(calTarget * carbPct / 4);
    const fatTargetG = Math.round((calTarget - proteinTargetG * 4 - carbTargetG * 4) / 9);
    await supabase.from('profile').insert({
      user_id: userId,
      calorie_target: calTarget,
      macro_protein: proteinTargetG,
      macro_carbs: carbTargetG,
      macro_fat: fatTargetG,
      weight_goal: null,
      units: 'metric',
      non_numeric_mode: false,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      height_cm: 175,
      current_weight_kg: 92,
      ideal_weight_lbs: 176,
      protein_target_g: proteinTargetG,
      carb_percent: carbPct,
      score_weights: { protein: 0.4, calories: 0.3, carbs: 0.2, fat: 0.1 },
    });
  }
  _seeded = true;
}

// ── Training Plan ──────────────────────────────────────────────────────────

export interface TrainingWeek {
  week: number;
  phase: string;
  is_deload: boolean;
  pct_working_max: number | null;
  strength_prescription: string;
  cardio_protocol: string;
  cardio_detail: string;
  boxing_focus: string;
  agility_focus: string;
}

export interface LiftSetup {
  lift: string;
  start_weight: number;
  weekly_increment: number;
  working_max: number | null;
}

export interface TrainingSession {
  id: number;
  user_id: string;
  week: number;
  session_type: 'strength' | 'cardio' | 'boxing' | 'agility';
  date: string;
  rpe: number | null;
  notes: string | null;
  completed_at?: string;
}

export interface StrengthSet {
  id: number;
  session_id: number;
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  prescribed_weight: number | null;
  actual_weight: number | null;
  reps: number | null;
  rpe: number | null;
  notes: string | null;
}

export interface Exercise {
  id: number;
  exercise_id: string;
  name: string;
  type: string;
  movement_pattern: string;
  is_main_lift: boolean;
  equipment: string;
  primary_target: string;
  unit: string;
  default_prescription: string;
  cues: string;
  how_to: string;
}

// Training plan week
export async function getTrainingWeek(week: number): Promise<TrainingWeek | null> {
  const { data } = await supabase.from('training_plan').select('*').eq('week', week).single();
  return data ?? null;
}

// Current week number based on programme start date (2026-08-17)
export function getCurrentTrainingWeek(): number {
  const start = new Date('2026-08-17');
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(26, Math.floor(diffDays / 7) + 1));
}

// Lift setup
export async function getLiftSetup(): Promise<LiftSetup[]> {
  const userId = await getUserId();
  const { data } = await supabase.from('lift_setup').select('*').eq('user_id', userId);
  return data ?? [];
}

export async function upsertLiftSetup(lifts: Omit<LiftSetup, never>[]): Promise<void> {
  const userId = await getUserId();
  await supabase.from('lift_setup').upsert(
    lifts.map(l => ({ ...l, user_id: userId, updated_at: new Date().toISOString() })),
    { onConflict: 'user_id,lift' }
  );
}

export async function updateWorkingMax(lift: string, workingMax: number): Promise<void> {
  const userId = await getUserId();
  await supabase.from('lift_setup')
    .update({ working_max: workingMax, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('lift', lift);
}

// Calculate prescribed weight for a given lift + week
export function calcPrescribedWeight(lift: LiftSetup, week: TrainingWeek): number | null {
  if (week.phase === 'Base') {
    if (week.is_deload) {
      // 85% of previous week's weight
      const prevWeight = lift.start_weight + lift.weekly_increment * (week.week - 2);
      return Math.round(prevWeight * 0.85 / 2.5) * 2.5;
    }
    return lift.start_weight + lift.weekly_increment * (week.week - 1);
  }
  // Build/Camp/Taper — use % of working max
  if (week.pct_working_max && lift.working_max) {
    return Math.round(lift.working_max * week.pct_working_max / 2.5) * 2.5;
  }
  return null;
}

// Training sessions
export async function createTrainingSession(
  session: Omit<TrainingSession, 'id' | 'user_id'>
): Promise<number> {
  const userId = await getUserId();
  const row = {
    ...session,
    user_id: userId,
    completed_at: session.completed_at ?? new Date().toISOString(),
  };
  const { data, error } = await supabase.from('training_sessions')
    .insert(row)
    .select('id').single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to create session');
  return data.id;
}

export async function getTrainingSessions(week: number): Promise<TrainingSession[]> {
  const userId = await getUserId();
  const { data } = await supabase.from('training_sessions')
    .select('*').eq('user_id', userId).eq('week', week)
    .order('completed_at', { ascending: false });
  return data ?? [];
}

export async function updateTrainingSession(
  id: number, patch: Partial<Pick<TrainingSession, 'rpe' | 'notes'>>
): Promise<void> {
  await supabase.from('training_sessions').update(patch).eq('id', id);
}

// Strength sets
export async function addStrengthSets(sets: Omit<StrengthSet, 'id'>[]): Promise<void> {
  await supabase.from('strength_sets').insert(sets);
}

export async function getStrengthSets(sessionId: number): Promise<StrengthSet[]> {
  const { data } = await supabase.from('strength_sets')
    .select('*').eq('session_id', sessionId).order('exercise_name').order('set_number');
  return data ?? [];
}

// Exercise library
export async function getExercises(type?: string): Promise<Exercise[]> {
  let query = supabase.from('exercises').select('*').order('type').order('name');
  if (type) query = query.eq('type', type);
  const { data } = await query;
  return data ?? [];
}

export async function getExercise(exerciseId: string): Promise<Exercise | null> {
  const { data } = await supabase.from('exercises').select('*').eq('exercise_id', exerciseId).single();
  return data ?? null;
}

// Main lifts only (for strength logging)
export async function getMainLifts(): Promise<Exercise[]> {
  const { data } = await supabase.from('exercises')
    .select('*').eq('is_main_lift', true).order('name');
  return data ?? [];
}

// ── Daily Score ────────────────────────────────────────────────────────────────

export interface DailyScore {
  id: number;
  user_id: string;
  date: string;
  calories_actual: number;
  protein_actual: number;
  carbs_actual: number;
  fat_actual: number;
  protein_score: number;
  calorie_score: number;
  carb_score: number;
  fat_score: number;
  total_score: number;
  computed_at: string;
}

export interface GroceryItem {
  id: number;
  user_id: string;
  name: string;
  quantity_grams: number | null;
  purchased: boolean;
  added_at: string;
  week_of: string;
}

// Compute and upsert daily score for a given date
export async function computeDailyScore(date: string): Promise<DailyScore | null> {
  const userId = await getUserId();
  const [logs, profile] = await Promise.all([getMealLogs(date), getProfile()]);
  if (!profile) return null;

  const actuals = logs.reduce((acc, l) => {
    if (!l.food) return acc;
    const r = l.quantity / l.food.serving_size;
    return {
      calories: acc.calories + l.food.calories * r,
      protein:  acc.protein  + l.food.protein  * r,
      carbs:    acc.carbs    + l.food.carbs    * r,
      fat:      acc.fat      + l.food.fat      * r,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const w = { protein: 0.4, calories: 0.3, carbs: 0.2, fat: 0.1 };
  const pt = profile.macro_targets.protein;
  const ct = profile.calorie_target;
  const carbT = profile.macro_targets.carbs;
  const fatT = profile.macro_targets.fat;

  // Protein: proportional up to 100
  const proteinScore = Math.min(100, (actuals.protein / pt) * 100);

  // Calories: 100 at/under, 1.5x penalty over, light penalty if >10% under
  let calScore = 100;
  if (actuals.calories > ct) {
    const overPct = (actuals.calories - ct) / ct;
    calScore = Math.max(0, 100 - overPct * 150);
  } else if (actuals.calories < ct * 0.9) {
    const underPct = (ct * 0.9 - actuals.calories) / (ct * 0.9);
    calScore = Math.max(0, 100 - underPct * 50);
  }

  // Carbs: 100 at/under, 2x penalty over
  let carbScore = 100;
  if (actuals.carbs > carbT) {
    const overPct = (actuals.carbs - carbT) / carbT;
    carbScore = Math.max(0, 100 - overPct * 200);
  }

  // Fat: 100 within ±15% of target, tapering outside
  const fatDiff = Math.abs(actuals.fat - fatT) / fatT;
  const fatScore = fatDiff <= 0.15 ? 100 : Math.max(0, 100 - (fatDiff - 0.15) * 200);

  const total = Math.round(
    proteinScore * w.protein +
    calScore     * w.calories +
    carbScore    * w.carbs +
    fatScore     * w.fat
  );

  const row = {
    user_id: userId, date,
    calories_actual: Math.round(actuals.calories),
    protein_actual:  Math.round(actuals.protein * 10) / 10,
    carbs_actual:    Math.round(actuals.carbs * 10) / 10,
    fat_actual:      Math.round(actuals.fat * 10) / 10,
    protein_score:   Math.round(proteinScore),
    calorie_score:   Math.round(calScore),
    carb_score:      Math.round(carbScore),
    fat_score:       Math.round(fatScore),
    total_score:     total,
    computed_at:     new Date().toISOString(),
  };

  await supabase.from('daily_score').upsert(row, { onConflict: 'user_id,date' });
  return { id: 0, ...row } as DailyScore;
}

export async function getDailyScores(days: number): Promise<DailyScore[]> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('daily_score')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(days);
  return data ?? [];
}

export async function getDailyScore(date: string): Promise<DailyScore | null> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('daily_score')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();
  return data ?? null;
}

// ── Grocery List ───────────────────────────────────────────────────────────────

export function currentWeekOf(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export async function getGroceryItems(weekOf?: string): Promise<GroceryItem[]> {
  const userId = await getUserId();
  const week = weekOf ?? currentWeekOf();
  const { data } = await supabase
    .from('grocery_item')
    .select('*')
    .eq('user_id', userId)
    .eq('week_of', week)
    .order('added_at', { ascending: true });
  return data ?? [];
}

export async function addGroceryItem(name: string, quantityGrams: number | null): Promise<void> {
  const userId = await getUserId();
  await supabase.from('grocery_item').insert({
    user_id: userId,
    name: name.trim(),
    quantity_grams: quantityGrams,
    purchased: false,
    week_of: currentWeekOf(),
  });
}

export async function toggleGroceryItem(id: number): Promise<void> {
  const { data } = await supabase.from('grocery_item').select('purchased').eq('id', id).single();
  if (data) await supabase.from('grocery_item').update({ purchased: !data.purchased }).eq('id', id);
}

// ── Weight Log ──────────────────────────────────────────────────────────────

export interface WeightEntry {
  id: number;
  user_id: string;
  weight_kg: number;
  logged_at: string;
  note: string | null;
}

export async function logWeight(weight_kg: number, note?: string): Promise<void> {
  const userId = await getUserId();
  await supabase.from('weight_log').upsert({
    user_id: userId,
    weight_kg,
    logged_at: todayISO(),
    note: note ?? null,
  }, { onConflict: 'user_id,logged_at' });
}

export async function getWeightHistory(limit = 52): Promise<WeightEntry[]> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('weight_log')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function deleteWeightEntry(id: number): Promise<void> {
  await supabase.from('weight_log').delete().eq('id', id);
}

// ── Lift History ──────────────────────────────────────────────────────────────

export interface LiftHistory {
  date: string;
  exercise_name: string;
  best_weight: number;
  best_reps: number;
  volume: number; // sum of actual_weight * reps across all sets
}

export async function getLiftHistory(
  exerciseNames: string[],
  weeks: number
): Promise<LiftHistory[]> {
  const userId = await getUserId();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  // Join strength_sets → training_sessions, filter by user + date range + exercise names
  const { data, error } = await supabase
    .from('strength_sets')
    .select('exercise_name, actual_weight, reps, training_sessions!inner(user_id, date)')
    .eq('training_sessions.user_id', userId)
    .gte('training_sessions.date', cutoffISO)
    .in('exercise_name', exerciseNames)
    .not('actual_weight', 'is', null)
    .not('reps', 'is', null);

  if (error || !data) return [];

  // Group by date + exercise_name
  const map = new Map<string, { best_weight: number; best_reps: number; volume: number }>();
  for (const row of data) {
    const session = row.training_sessions as unknown as { date: string };
    const key = `${session.date}||${row.exercise_name}`;
    const weight = row.actual_weight ?? 0;
    const reps = row.reps ?? 0;
    const existing = map.get(key);
    if (existing) {
      if (weight > existing.best_weight) {
        existing.best_weight = weight;
        existing.best_reps = reps;
      }
      existing.volume += weight * reps;
    } else {
      map.set(key, { best_weight: weight, best_reps: reps, volume: weight * reps });
    }
  }

  const results: LiftHistory[] = [];
  for (const [key, val] of map.entries()) {
    const [date, exercise_name] = key.split('||');
    results.push({ date, exercise_name, ...val });
  }
  return results.sort((a, b) => a.date.localeCompare(b.date));
}

// ── PR Tracking ───────────────────────────────────────────────────────────────

export interface ExercisePR {
  exercise_name: string;
  actual_weight: number;
  reps: number;
  volume: number; // actual_weight × reps
  logged_at: string;
}

export interface RecentSet {
  actual_weight: number | null;
  reps: number | null;
  logged_at: string;
  session_id: number;
}

/**
 * Returns the best set (highest actual_weight × reps volume) ever logged
 * for each exercise name in the given list.
 */
export async function getExercisePRs(exerciseNames: string[]): Promise<Map<string, ExercisePR>> {
  if (exerciseNames.length === 0) return new Map();
  const userId = await getUserId();

  // Fetch all sets for these exercise names via training_sessions join
  const { data } = await supabase
    .from('strength_sets')
    .select('exercise_name, actual_weight, reps, training_sessions!inner(user_id, completed_at)')
    .in('exercise_name', exerciseNames)
    .eq('training_sessions.user_id', userId)
    .not('actual_weight', 'is', null)
    .not('reps', 'is', null);

  const result = new Map<string, ExercisePR>();
  for (const row of data ?? []) {
    const weight = row.actual_weight as number;
    const reps = row.reps as number;
    const volume = weight * reps;
    const session = row.training_sessions as unknown as { completed_at: string };
    const logged_at = session?.completed_at ?? '';
    const existing = result.get(row.exercise_name);
    if (!existing || volume > existing.volume) {
      result.set(row.exercise_name, {
        exercise_name: row.exercise_name,
        actual_weight: weight,
        reps,
        volume,
        logged_at,
      });
    }
  }
  return result;
}

/**
 * Returns the last `limit` sets for an exercise across all sessions (most recent first).
 */
export async function getRecentSetsForExercise(exerciseName: string, limit: number): Promise<RecentSet[]> {
  const userId = await getUserId();
  const { data } = await supabase
    .from('strength_sets')
    .select('actual_weight, reps, session_id, training_sessions!inner(user_id, completed_at)')
    .eq('exercise_name', exerciseName)
    .eq('training_sessions.user_id', userId)
    .order('session_id', { ascending: false })
    .limit(limit);

  return (data ?? []).map(row => {
    const session = row.training_sessions as unknown as { completed_at: string };
    return {
      actual_weight: row.actual_weight,
      reps: row.reps,
      session_id: row.session_id,
      logged_at: session?.completed_at ?? '',
    };
  });
}

export async function clearPurchasedGroceries(weekOf?: string): Promise<void> {
  const userId = await getUserId();
  const week = weekOf ?? currentWeekOf();
  await supabase.from('grocery_item').delete()
    .eq('user_id', userId).eq('week_of', week).eq('purchased', true);
}
