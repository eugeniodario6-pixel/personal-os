import Dexie, { type EntityTable } from 'dexie';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: number;
  calorie_target: number;
  macro_targets: { protein: number; carbs: number; fat: number };
  weight_goal: number | null;
  units: 'metric' | 'imperial';
  non_numeric_mode: boolean;
  timezone: string;
}

export interface FoodItem {
  id: number;
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
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_item_id: number;
  quantity: number;
  logged_at: string;
  source: 'barcode' | 'photo' | 'search' | 'manual';
}

export interface WorkoutTemplate {
  id: number;
  name: string;
  category: string;
  default_duration_min: number;
  default_intensity: 'low' | 'moderate' | 'high';
}

export interface WorkoutLog {
  id: number;
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
  name: string;
  schedule: object;
  active: boolean;
  stacked_after_habit_id: number | null;
  streak_freeze_available: number;
  created_at: string;
}

export interface HabitCompletion {
  id: number;
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
  session_id: number;
  date: string;
  completed: boolean;
  duration_actual_min: number;
  logged_at: string;
}

export interface Insight {
  id: number;
  metric_a: string;
  metric_b: string;
  relationship: string;
  data_points: number;
  confidence: number;
  generated_at: string;
  shown: boolean;
}

// ── Database ───────────────────────────────────────────────────────────────

class PersonalOSDatabase extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  food_item!: EntityTable<FoodItem, 'id'>;
  meal_log!: EntityTable<MealLog, 'id'>;
  workout_template!: EntityTable<WorkoutTemplate, 'id'>;
  workout_log!: EntityTable<WorkoutLog, 'id'>;
  habit!: EntityTable<Habit, 'id'>;
  habit_completion!: EntityTable<HabitCompletion, 'id'>;
  meditation_session!: EntityTable<MeditationSession, 'id'>;
  meditation_log!: EntityTable<MeditationLog, 'id'>;
  insight!: EntityTable<Insight, 'id'>;

  constructor() {
    super('PersonalOS');
    this.version(1).stores({
      profile: '++id',
      food_item: '++id, external_id, barcode, name, is_favorite',
      meal_log: '++id, date, meal_type, food_item_id, logged_at',
      workout_template: '++id, name, category',
      workout_log: '++id, date, template_id, logged_at',
      habit: '++id, active, stacked_after_habit_id',
      habit_completion: '++id, habit_id, date',
      meditation_session: '++id, category',
      meditation_log: '++id, session_id, date, logged_at',
      insight: '++id, shown, generated_at',
    });
  }
}

export const db = new PersonalOSDatabase();

// ── Seed Data ──────────────────────────────────────────────────────────────

const MEDITATION_SESSIONS: Omit<MeditationSession, 'id'>[] = [
  {
    name: 'Box breathing',
    category: 'Breathing',
    duration_min: 4,
    audio_url: null,
    instructions:
      'Sit upright, feet flat, hands resting on your knees.\nBreathe in through the nose for 4 counts.\nHold for 4 counts.\nBreathe out through the mouth for 4 counts.\nHold for 4 counts.\nRepeat. If your mind wanders, just come back to the count — that\'s the whole practice, not a failure of it.',
  },
  {
    name: '4-7-8 wind-down',
    category: 'Breathing',
    duration_min: 5,
    audio_url: null,
    instructions:
      'Exhale completely through your mouth.\nInhale through the nose for 4 counts.\nHold for 7 counts.\nExhale through the mouth for 8 counts, with a soft whoosh sound.\nRepeat for 4 full rounds, then let your breath return to normal and sit in the stillness for the rest of the time.',
  },
  {
    name: 'Full body scan',
    category: 'Body scan',
    duration_min: 10,
    audio_url: null,
    instructions:
      'Lie down or sit back. Close your eyes.\nBring attention to your feet — just notice, don\'t change anything.\nMove slowly upward: ankles, calves, knees, thighs, hips.\nContinue through your stomach, chest, hands, arms, shoulders.\nNotice your neck, jaw, face, scalp.\nTake one full breath, scanning the whole body at once.\nOpen your eyes when ready — no need to rush it.',
  },
  {
    name: 'Quick tension release',
    category: 'Body scan',
    duration_min: 6,
    audio_url: null,
    instructions:
      'Starting at your shoulders, tense them up toward your ears for 5 seconds, then release. Notice the difference.\nDo the same with your hands (clench, then open), your jaw (clench, then soften), and your legs (press feet into the floor, then let go).\nFinish with one slow breath through the whole body, top to bottom.',
  },
  {
    name: 'Wind-down for sleep',
    category: 'Sleep',
    duration_min: 8,
    audio_url: null,
    instructions:
      'Lie down, lights off or dim.\nLet your breath slow on its own — don\'t force it.\nPicture your body getting heavier, part by part, starting at your feet.\nIf a thought shows up, picture setting it down beside the bed — you can pick it back up tomorrow.\nNo need to finish this session awake. Falling asleep partway through is a success, not an interruption.',
  },
  {
    name: '3am reset',
    category: 'Sleep',
    duration_min: 5,
    audio_url: null,
    instructions:
      'If you\'ve woken in the night: don\'t check the time again.\nBreathe in for 4, out for 6 — the longer exhale signals your body to settle.\nKeep your eyes closed even if you don\'t feel sleepy yet. Rest is still rest.',
  },
  {
    name: 'Between-meetings reset',
    category: 'Stress release',
    duration_min: 3,
    audio_url: null,
    instructions:
      'Feet flat on the floor. Unclench your jaw.\nTake one breath and notice where you\'re holding tension right now.\nBreathe into that spot for 5 breaths.\nRoll your shoulders back once. Open your eyes. Go.',
  },
  {
    name: 'Naming the noise',
    category: 'Stress release',
    duration_min: 7,
    audio_url: null,
    instructions:
      'Sit and let your mind run without steering it.\nWhen a thought arrives, silently label it: \'planning,\' \'worry,\' \'memory,\' \'nothing.\'\nDon\'t argue with it — just name it and let it pass.\nBy the end, most of what felt urgent will have quieted on its own.',
  },
  {
    name: 'Pre-work primer',
    category: 'Focus',
    duration_min: 5,
    audio_url: null,
    instructions:
      'Sit with your work already in view, but don\'t start yet.\nThree breaths, counting each exhale.\nState (silently or out loud) the one thing you\'re about to focus on.\nBegin.',
  },
  {
    name: 'Single-point focus',
    category: 'Focus',
    duration_min: 10,
    audio_url: null,
    instructions:
      'Pick one object in the room, or your own breath.\nHold attention there. When it drifts — and it will — bring it back without judgment.\nThis is a rep, not a failure state. Ten minutes of drifting-and-returning is the actual workout.',
  },
];

const DEFAULT_WORKOUT_TEMPLATES: Omit<WorkoutTemplate, 'id'>[] = [
  { name: 'Morning Run', category: 'Cardio', default_duration_min: 30, default_intensity: 'moderate' },
  { name: 'HIIT', category: 'Cardio', default_duration_min: 20, default_intensity: 'high' },
  { name: 'Upper Body', category: 'Strength', default_duration_min: 45, default_intensity: 'moderate' },
  { name: 'Lower Body', category: 'Strength', default_duration_min: 45, default_intensity: 'moderate' },
  { name: 'Full Body', category: 'Strength', default_duration_min: 60, default_intensity: 'moderate' },
  { name: 'Yoga', category: 'Flexibility', default_duration_min: 30, default_intensity: 'low' },
  { name: 'Walk', category: 'Cardio', default_duration_min: 45, default_intensity: 'low' },
  { name: 'Cycling', category: 'Cardio', default_duration_min: 60, default_intensity: 'moderate' },
];

const DEFAULT_HABITS: Omit<Habit, 'id'>[] = [
  {
    name: 'Morning water',
    schedule: { type: 'daily' },
    active: true,
    stacked_after_habit_id: null,
    streak_freeze_available: 0,
    created_at: new Date().toISOString(),
  },
  {
    name: 'Read 20 pages',
    schedule: { type: 'daily' },
    active: true,
    stacked_after_habit_id: null,
    streak_freeze_available: 0,
    created_at: new Date().toISOString(),
  },
  {
    name: 'No screens before bed',
    schedule: { type: 'daily' },
    active: true,
    stacked_after_habit_id: null,
    streak_freeze_available: 0,
    created_at: new Date().toISOString(),
  },
];

export async function seedDatabase(): Promise<void> {
  // Only seed if empty
  const sessionCount = await db.meditation_session.count();
  if (sessionCount > 0) return;

  await db.transaction('rw', [db.profile, db.meditation_session, db.workout_template, db.habit], async () => {
    // Profile
    const profileCount = await db.profile.count();
    if (profileCount === 0) {
      await db.profile.add({
        id: 1,
        calorie_target: 2000,
        macro_targets: { protein: 150, carbs: 200, fat: 65 },
        weight_goal: null,
        units: 'metric',
        non_numeric_mode: false,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }

    // Meditation sessions
    await db.meditation_session.bulkAdd(MEDITATION_SESSIONS as MeditationSession[]);

    // Workout templates
    await db.workout_template.bulkAdd(DEFAULT_WORKOUT_TEMPLATES as WorkoutTemplate[]);

    // Default habits
    await db.habit.bulkAdd(DEFAULT_HABITS as Habit[]);
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTodayMacros(): Promise<{
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}> {
  const today = todayISO();
  const logs = await db.meal_log.where('date').equals(today).toArray();
  const result = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const log of logs) {
    const food = await db.food_item.get(log.food_item_id);
    if (!food) continue;
    const ratio = log.quantity / food.serving_size;
    result.calories += food.calories * ratio;
    result.protein += food.protein * ratio;
    result.carbs += food.carbs * ratio;
    result.fat += food.fat * ratio;
  }
  return result;
}

export async function getTodayHabitStatus(): Promise<{ completed: number; total: number }> {
  const today = todayISO();
  const activeHabits = await db.habit.where('active').equals(1).toArray();
  const completions = await db.habit_completion.where('date').equals(today).toArray();
  const completedIds = new Set(
    completions.filter((c) => c.completed_at !== null).map((c) => c.habit_id)
  );
  return {
    completed: activeHabits.filter((h) => completedIds.has(h.id)).length,
    total: activeHabits.length,
  };
}

export async function toggleHabitCompletion(habitId: number): Promise<void> {
  const today = todayISO();
  const existing = await db.habit_completion
    .where('[habit_id+date]')
    .equals([habitId, today])
    .first();

  if (existing) {
    if (existing.completed_at) {
      await db.habit_completion.update(existing.id, { completed_at: null });
    } else {
      await db.habit_completion.update(existing.id, { completed_at: new Date().toISOString() });
    }
  } else {
    await db.habit_completion.add({
      id: undefined as unknown as number,
      habit_id: habitId,
      date: today,
      completed_at: new Date().toISOString(),
    });
  }
}

export async function getHabitStreak(habitId: number): Promise<number> {
  const completions = await db.habit_completion
    .where('habit_id')
    .equals(habitId)
    .and((c) => c.completed_at !== null)
    .toArray();

  const completedDates = new Set(completions.map((c) => c.date));
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (completedDates.has(iso)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
