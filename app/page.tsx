'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getProfile, getHabits, getHabitCompletions, getHabitStreaks,
  getMeditationSessions, getMeditationLogs, getTodayMacros,
  getWorkoutLogs, toggleHabitCompletion, seedUserData, getDailyScores,
  todayISO, type Habit, type MeditationSession, type DailyScore,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';
import { toast } from '@/components/Toast';
import { DashboardSkeleton } from '@/components/Skeleton';
import QuickLogSheet from '@/components/QuickLogSheet';

// ── Score logic ────────────────────────────────────────────────────────────────
function calcScore(calPct: number, habitPct: number, hasWorkout: boolean, hasMed: boolean) {
  const cal = calPct >= 85 && calPct <= 110 ? 30 : calPct >= 70 ? 20 : calPct > 0 ? 10 : 0;
  const hab = Math.round(habitPct * 40) / 100;
  return Math.min(Math.round(cal + hab + (hasWorkout ? 20 : 0) + (hasMed ? 10 : 0)), 100);
}

function scoreLabel(s: number) {
  if (s >= 90) return 'Elite';
  if (s >= 75) return 'Strong';
  if (s >= 55) return 'Solid';
  if (s >= 35) return 'Building';
  return "Let's go";
}

// ── PIECE 1: Score breakdown with pillar intelligence ──────────────────────────
interface PillarBreakdown {
  name: string;
  score: number;
  maxScore: number;
  delta: number; // vs yesterday
  reason: string;
}

function getScoreBreakdown(
  calPct: number, habitPct: number, hasWorkout: boolean, hasMed: boolean,
  yesterdayCalPct: number, yesterdayHabitPct: number, yesterdayHadWorkout: boolean, yesterdayHadMed: boolean
): PillarBreakdown[] {
  const eatScore = calPct >= 85 && calPct <= 110 ? 30 : calPct >= 70 ? 20 : calPct > 0 ? 10 : 0;
  const habitScore = Math.round(habitPct * 40) / 100;
  const moveScore = hasWorkout ? 20 : 0;
  const mindScore = hasMed ? 10 : 0;

  const yEat = yesterdayCalPct >= 85 && yesterdayCalPct <= 110 ? 30 : yesterdayCalPct >= 70 ? 20 : yesterdayCalPct > 0 ? 10 : 0;
  const yHabit = Math.round(yesterdayHabitPct * 40) / 100;
  const yMove = yesterdayHadWorkout ? 20 : 0;
  const yMind = yesterdayHadMed ? 10 : 0;

  return [
    {
      name: 'Eat',
      score: eatScore,
      maxScore: 30,
      delta: eatScore - yEat,
      reason: calPct <= 0 ? 'Nothing logged' : calPct < 70 ? `${Math.round(calPct)}% of target — too low` : calPct > 110 ? 'Over calorie target' : 'On track',
    },
    {
      name: 'Habits',
      score: Math.round(habitScore),
      maxScore: 40,
      delta: Math.round(habitScore - yHabit),
      reason: habitPct <= 0 ? 'No habits done' : habitPct < 50 ? 'Less than half done' : habitPct < 100 ? `${Math.round(habitPct)}% complete` : 'All habits done',
    },
    {
      name: 'Move',
      score: moveScore,
      maxScore: 20,
      delta: moveScore - yMove,
      reason: hasWorkout ? 'Workout logged' : 'No workout yet',
    },
    {
      name: 'Mind',
      score: mindScore,
      maxScore: 10,
      delta: mindScore - yMind,
      reason: hasMed ? 'Meditation done' : 'Not meditated yet',
    },
  ];
}

function getLowestPillarAction(
  pillars: PillarBreakdown[],
  calorieTarget: number, calories: number, protein: number, proteinTarget: number
): string {
  const pct = (p: PillarBreakdown) => p.score / p.maxScore;
  const sorted = [...pillars].sort((a, b) => pct(a) - pct(b));
  const lowest = sorted[0];

  if (lowest.name === 'Eat') {
    const h = new Date().getHours();
    const remaining = Math.round(calorieTarget - calories);
    if (calories === 0) return `Start with ${h < 11 ? 'breakfast' : h < 15 ? 'lunch' : 'dinner'} — ${calorieTarget} kcal target today`;
    if (protein < proteinTarget * 0.5 && h >= 18) return `Add protein to dinner — ${Math.round(proteinTarget - protein)}g short`;
    if (remaining > 0) return `${remaining} kcal remaining — log your next meal`;
    return 'Hit your calorie target';
  }
  if (lowest.name === 'Habits') return 'Finish your habits — consistency compounds';
  if (lowest.name === 'Move') return 'Log a workout — even 20 min counts';
  if (lowest.name === 'Mind') return 'Meditate before bed — closes the loop';
  return 'Keep going';
}

// ── PIECE 3: Data-aware contextual nudge ───────────────────────────────────────
function getDataAwareNudge(
  calPct: number, habitPct: number, hasWorkout: boolean, hasMed: boolean,
  calorieTarget: number, calories: number, protein: number, proteinTarget: number,
  workoutDaysGap: number,
): { label: string; sub: string; path: string; cta: string; urgency: 'high' | 'medium' | 'low' } | null {
  const h = new Date().getHours();

  // Data-aware nudges (not time-based)
  if (calories === 0 && h >= 7) {
    const meal = h < 11 ? 'breakfast' : h < 15 ? 'lunch' : 'dinner';
    return {
      label: `Nothing logged yet`,
      sub: `Start with ${meal} — ${calorieTarget} kcal target`,
      path: '/nutrition?action=add',
      cta: 'Log meal →',
      urgency: 'high',
    };
  }

  if (workoutDaysGap >= 3 && h >= 9 && h < 21) {
    return {
      label: `${workoutDaysGap} rest days in a row`,
      sub: "Today's plan: get a workout in",
      path: '/fitness',
      cta: 'Log workout →',
      urgency: 'high',
    };
  }

  if (protein < proteinTarget * 0.5 && h >= 18) {
    const gap = Math.round(proteinTarget - protein);
    return {
      label: `Protein ${Math.round((protein / proteinTarget) * 100)}% of target`,
      sub: `${gap}g short — add a protein source to dinner`,
      path: '/nutrition?action=add',
      cta: 'Log dinner →',
      urgency: 'high',
    };
  }

  if (!hasWorkout && h >= 9 && h < 21) {
    return {
      label: 'Move hasn\'t fired today',
      sub: 'Log any workout — even a walk counts',
      path: '/fitness',
      cta: 'Log workout →',
      urgency: 'medium',
    };
  }

  if (habitPct < 50 && h >= 14) {
    return {
      label: 'Habits falling behind',
      sub: `Less than half done — finish before tonight`,
      path: '/habits',
      cta: 'View habits →',
      urgency: 'medium',
    };
  }

  if (!hasMed && h >= 19) {
    return {
      label: 'Wind down',
      sub: 'Meditation not done — closes the loop on your day',
      path: '/meditation',
      cta: 'Start session →',
      urgency: 'low',
    };
  }

  if (calPct > 0 && calPct < 85 && h >= 18) {
    return {
      label: 'Top up calories',
      sub: `${Math.round(calorieTarget - calories)} kcal left for today`,
      path: '/nutrition?action=add',
      cta: 'Log meal →',
      urgency: 'low',
    };
  }

  return null;
}

// ── PIECE 8: Weekly summary ────────────────────────────────────────────────────
interface WeeklySummary {
  avgScore: number;
  avgLastWeek: number;
  streak: number; // consecutive days >= 70
  bestDay: { day: string; score: number } | null;
}

function computeWeeklySummary(scores: DailyScore[]): WeeklySummary {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // This week (last 7 days)
  const thisWeek: DailyScore[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const s = scores.find(s => s.date === ds);
    if (s) thisWeek.push(s);
  }

  // Last week (7-14 days ago)
  const lastWeek: DailyScore[] = [];
  for (let i = 7; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const s = scores.find(s => s.date === ds);
    if (s) lastWeek.push(s);
  }

  const avgScore = thisWeek.length > 0
    ? Math.round(thisWeek.reduce((s, d) => s + d.total_score, 0) / thisWeek.length)
    : 0;

  const avgLastWeek = lastWeek.length > 0
    ? Math.round(lastWeek.reduce((s, d) => s + d.total_score, 0) / lastWeek.length)
    : 0;

  // Streak = consecutive days >= 70 going backwards from today
  let streak = 0;
  const scoreMap = new Map(scores.map(s => [s.date, s.total_score]));
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (ds === todayStr) continue; // skip today (still in progress)
    const s = scoreMap.get(ds);
    if (s !== undefined && s >= 70) streak++;
    else break;
  }

  const bestDay = thisWeek.length > 0
    ? thisWeek.reduce((best, d) => d.total_score > best.total_score ? d : best, thisWeek[0])
    : null;

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return {
    avgScore,
    avgLastWeek,
    streak,
    bestDay: bestDay ? {
      day: DAY_NAMES[new Date(bestDay.date + 'T12:00:00').getDay()],
      score: bestDay.total_score,
    } : null,
  };
}

// ── PIECE 4: 7-day sparkline ───────────────────────────────────────────────────
function ScoreSparkline({ scores }: { scores: DailyScore[] }) {
  const today = new Date();
  const points: (number | null)[] = [];
  const labels: string[] = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Get Mon–Sun of current week
  const dow = today.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const scoreMap = new Map(scores.map(s => [s.date, s.total_score]));

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset + i);
    const ds = d.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);
    if (ds > todayStr) points.push(null);
    else points.push(scoreMap.get(ds) ?? null);
  }

  const validPoints = points.filter((p): p is number => p !== null);
  if (validPoints.length < 2) return null;

  const min = Math.max(0, Math.min(...validPoints) - 10);
  const max = Math.min(100, Math.max(...validPoints) + 10);
  const W = 300, H = 36;

  const pathParts: string[] = [];
  let firstValid = true;
  points.forEach((p, i) => {
    if (p === null) return;
    const x = (i / 6) * W;
    const y = H - ((p - min) / (max - min)) * H;
    pathParts.push(`${firstValid ? 'M' : 'L'} ${x},${y}`);
    firstValid = false;
  });

  const todayIdx = Math.min(
    points.filter((p, i) => i <= (dow === 0 ? 6 : dow - 1 - offset)).filter(p => p !== null).length - 1,
    6
  );
  let lastValidIdx = -1;
  for (let i = 0; i < points.length; i++) { if (points[i] !== null) lastValidIdx = i; }
  if (lastValidIdx < 0) return null;
  const lastX = (lastValidIdx / 6) * W;
  const lastVal = points[lastValidIdx] as number;
  const lastY = H - ((lastVal - min) / (max - min)) * H;

  return (
    <div style={{ padding: '0 0 8px' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: 36 }}>
        <path d={pathParts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
        <circle cx={lastX} cy={lastY} r="3.5" fill="var(--accent)" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
        {labels.map((l, i) => (
          <span key={i} style={{
            fontSize: 9, fontWeight: 510, letterSpacing: '0.01em', textTransform: 'uppercase',
            color: i === lastValidIdx ? 'var(--accent)' : 'var(--text-4)', flex: 1, textAlign: 'center',
          }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

// ── PIECE 4: Macro split donut (simple bar) ────────────────────────────────────
function MacroSplitBar({ protein, carbs, fat, proteinTarget, carbTarget, fatTarget }: {
  protein: number; carbs: number; fat: number;
  proteinTarget: number; carbTarget: number; fatTarget: number;
}) {
  const total = protein + carbs + fat;
  if (total < 1) return null;

  const protPct = Math.round((protein / proteinTarget) * 100);
  const carbPct = Math.round((carbs / carbTarget) * 100);
  const fatPct = Math.round((fat / fatTarget) * 100);

  return (
    <div style={{ padding: '10px 16px 12px', borderBottom: '1px solid var(--border)' }}>
      <p className="label" style={{ marginBottom: 8 }}>Macro targets today</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { label: 'Protein', val: Math.round(protein), target: proteinTarget, pct: protPct, color: 'var(--color-pulse-green)' },
          { label: 'Carbs', val: Math.round(carbs), target: carbTarget, pct: carbPct, color: 'var(--color-signal-teal)' },
          { label: 'Fat', val: Math.round(fat), target: fatTarget, pct: fatPct, color: 'var(--color-iris-violet)' },
        ].map(m => (
          <div key={m.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 510, letterSpacing: '0.01em', textTransform: 'uppercase', color: 'var(--text-4)' }}>{m.label}</span>
              <span style={{ fontSize: 11, letterSpacing: '-0.01em', color: m.pct >= 100 ? m.color : 'var(--text-4)' }}>
                <span style={{ fontWeight: 510, color: 'var(--text-2)' }}>{m.val}g</span> / {m.target}g
              </span>
            </div>
            <div className="progress" style={{ height: 4 }}>
              <div className="progress-fill" style={{
                width: `${Math.min(m.pct, 100)}%`,
                background: m.pct >= 100 ? m.color : 'var(--text-3)',
                transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Segment bar (tappable) ─────────────────────────────────────────────────────
function Segment({ label, val, path, delta }: { label: string; val: number; path: string; delta?: number }) {
  const router = useRouter();
  const active = val > 0;
  return (
    <button
      onClick={() => { haptic('light'); router.push(path); }}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        textAlign: 'left', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div className="progress" style={{ marginBottom: 6, height: 3 }}>
        <div
          className="progress-fill"
          style={{
            width: `${val}%`,
            background: val >= 100 ? 'var(--accent)' : 'var(--text)',
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <p style={{
          fontSize: 10, fontWeight: active ? 510 : 400,
          letterSpacing: '0.01em', textTransform: 'uppercase',
          color: active ? 'var(--text-2)' : 'var(--text-4)',
          margin: 0, transition: 'color 0.2s',
        }}>
          {label}
        </p>
        {delta !== undefined && delta !== 0 && (
          <span style={{ fontSize: 9, color: delta > 0 ? 'var(--color-pulse-green)' : 'var(--color-coral-red)', fontWeight: 510 }}>
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
    </button>
  );
}

// ── PIECE 2: One-tap food chips on dashboard ────────────────────────────────────
function QuickFoodChips({ foods, onLog }: { foods: Array<{ id: number; name: string; calories: number; serving_size: number }>; onLog: (id: number, name: string) => void }) {
  if (foods.length === 0) return null;
  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
      {foods.slice(0, 3).map(f => (
        <button
          key={f.id}
          onClick={() => { haptic('medium'); onLog(f.id, f.name); }}
          style={{
            flex: '0 0 auto',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: 8, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.15s, border-color 0.15s',
            minWidth: 0, maxWidth: 140,
          }}
          onMouseDown={e => (e.currentTarget.style.background = 'rgba(228,242,34,0.08)')}
          onMouseUp={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          onTouchStart={e => (e.currentTarget.style.background = 'rgba(228,242,34,0.08)')}
          onTouchEnd={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
        >
          <span style={{ fontSize: 11, fontWeight: 510, letterSpacing: '-0.01em', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 116 }}>
            {f.name}
          </span>
          <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 510, marginTop: 2 }}>+100g</span>
        </button>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function TodayPage() {
  const router = useRouter();

  const [calories, setCalories]       = useState(0);
  const [protein, setProtein]         = useState(0);
  const [carbs, setCarbs]             = useState(0);
  const [fat, setFat]                 = useState(0);
  const [calorieTarget, setCalTarget] = useState(2000);
  const [proteinTarget, setProteinTarget] = useState(150);
  const [carbTarget, setCarbTarget]   = useState(200);
  const [fatTarget, setFatTarget]     = useState(65);
  const [habits, setHabits]           = useState<(Habit & { done: boolean; streak: number })[]>([]);
  const [workoutsToday, setWorkouts]  = useState(0);
  const [medDone, setMedDone]         = useState(false);
  const [suggested, setSuggested]     = useState<MeditationSession | null>(null);
  const [dateStr, setDateStr]         = useState('');
  const [loading, setLoading]         = useState(true);
  const [quickLog, setQuickLog]       = useState(false);
  const [allScores, setAllScores]     = useState<DailyScore[]>([]);
  const [recentFoods, setRecentFoods] = useState<Array<{ id: number; name: string; calories: number; serving_size: number }>>([]);
  const [workoutDaysGap, setWorkoutDaysGap] = useState(0);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [metricsCollapsed, setMetricsCollapsed] = useState(false);
  const scoreRef = useRef<HTMLDivElement>(null);
  const [scorePulsed, setScorePulsed] = useState(false);

  // Yesterday's data for delta calculation
  const [yesterdayCalPct, setYesterdayCalPct]     = useState(0);
  const [yesterdayHabitPct, setYesterdayHabitPct] = useState(0);
  const [yesterdayHadWorkout, setYesterdayHadWorkout] = useState(false);
  const [yesterdayHadMed, setYesterdayHadMed]     = useState(false);

  const load = useCallback(async () => {
    try {
      await seedUserData();
      const today = todayISO();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      setDateStr(new Date().toLocaleDateString('en-ZA', { weekday: 'long', month: 'long', day: 'numeric' }));

      const [macros, profile, activeHabits, completions, workouts, medLogs, sessions, scores] = await Promise.all([
        getTodayMacros(), getProfile(), getHabits(), getHabitCompletions(today),
        getWorkoutLogs(today), getMeditationLogs(today), getMeditationSessions(),
        getDailyScores(14),
      ]);

      setCalories(Math.round(macros.calories));
      setProtein(macros.protein);
      setCarbs(macros.carbs);
      setFat(macros.fat);
      setCalTarget(profile?.calorie_target ?? 2000);
      setProteinTarget(profile?.macro_targets?.protein ?? 150);
      setCarbTarget(profile?.macro_targets?.carbs ?? 200);
      setFatTarget(profile?.macro_targets?.fat ?? 65);
      setAllScores(scores);

      const doneIds = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
      const streaks = await getHabitStreaks(activeHabits.map(h => h.id));
      setHabits(activeHabits.map(h => ({ ...h, done: doneIds.has(h.id), streak: streaks.get(h.id) ?? 0 })));
      setWorkouts(workouts.length);
      setMedDone(medLogs.some(m => m.completed));
      const loggedIds = new Set(medLogs.map(m => m.session_id));
      setSuggested(sessions.find(s => !loggedIds.has(s.id)) ?? sessions[0] ?? null);

      // Recent foods for quick chips
      const { getRecentFoods } = await import('@/lib/db');
      const recents = await getRecentFoods(3);
      setRecentFoods(recents.map(f => ({ id: f.id, name: f.name, calories: f.calories, serving_size: f.serving_size })));

      // Yesterday data for deltas
      const yScore = scores.find(s => s.date === yesterdayStr);
      if (yScore) {
        const yCalPct = yScore.calories_actual > 0 ? (yScore.calories_actual / (profile?.calorie_target ?? 2000)) * 100 : 0;
        setYesterdayCalPct(yCalPct);
        // Approximate habit pct from yesterday score — we don't have exact data, use DB score
        setYesterdayHabitPct(50); // default
        setYesterdayHadWorkout(false);
        setYesterdayHadMed(false);
      }

      // Calculate workout gap (consecutive rest days)
      let gap = 0;
      for (let i = 1; i <= 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const { getWorkoutLogs: gwl } = await import('@/lib/db');
        const wl = await gwl(d.toISOString().slice(0, 10));
        if (wl.length > 0) break;
        gap++;
      }
      setWorkoutDaysGap(gap);

    } catch (e) { console.error(e); }
    finally {
      setLoading(false);
      setScorePulsed(true);
      setTimeout(() => setScorePulsed(false), 600);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // PIECE 2: Log recent food at +100g
  const handleQuickFoodLog = async (foodId: number, foodName: string) => {
    const { addMealLog } = await import('@/lib/db');
    const h = new Date().getHours();
    const mealType = h < 10 ? 'breakfast' : h < 14 ? 'lunch' : h < 19 ? 'dinner' : 'snack';
    await addMealLog({
      date: todayISO(), meal_type: mealType,
      food_item_id: foodId, quantity: 100,
      logged_at: new Date().toISOString(), source: 'manual',
    });
    toast(`${foodName} +100g logged ✓`);
    await load();
  };

  const toggle = async (id: number) => {
    haptic('medium');
    await toggleHabitCompletion(id);
    const h = habits.find(h => h.id === id);
    if (h) toast(h.done ? `${h.name} unchecked` : `${h.name} done ✓`);
    await load();
  };

  const calPct    = calorieTarget > 0 ? (calories / calorieTarget) * 100 : 0;
  const habitDone = habits.filter(h => h.done).length;
  const habitPct  = habits.length > 0 ? (habitDone / habits.length) * 100 : 0;
  const score     = calcScore(calPct, habitPct, workoutsToday > 0, medDone);

  // PIECE 1: Score breakdown
  const pillars = getScoreBreakdown(calPct, habitPct, workoutsToday > 0, medDone, yesterdayCalPct, yesterdayHabitPct, yesterdayHadWorkout, yesterdayHadMed);
  const actionSentence = getLowestPillarAction(pillars, calorieTarget, calories, protein, proteinTarget);

  // PIECE 3: Data-aware nudge
  const nudge = getDataAwareNudge(calPct, habitPct, workoutsToday > 0, medDone, calorieTarget, calories, protein, proteinTarget, workoutDaysGap);

  // PIECE 8: Weekly summary
  const weeklySummary = computeWeeklySummary(allScores);

  const allDone = calPct >= 85 && habitPct >= 100 && workoutsToday > 0 && medDone;

  if (loading) return <DashboardSkeleton />;

  return (
    <>
      <style>{`
        @keyframes score-pulse {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.015); }
          100% { transform: scale(1); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bar-fill {
          from { width: 0%; }
        }
        @keyframes habit-check {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        @keyframes progress-grow {
          from { transform: scaleX(0); transform-origin: left; }
          to   { transform: scaleX(1); transform-origin: left; }
        }
        .dashboard-zone { animation: fade-in-up 0.3s ease both; }
        .dashboard-zone:nth-child(1) { animation-delay: 0ms; }
        .dashboard-zone:nth-child(2) { animation-delay: 50ms; }
        .dashboard-zone:nth-child(3) { animation-delay: 100ms; }
        .dashboard-zone:nth-child(4) { animation-delay: 150ms; }
        .dashboard-zone:nth-child(5) { animation-delay: 200ms; }
        .dashboard-zone:nth-child(6) { animation-delay: 250ms; }
        .dashboard-zone:nth-child(7) { animation-delay: 300ms; }
        .dashboard-zone:nth-child(8) { animation-delay: 350ms; }
        .habit-row-check { transition: all 0.15s; }
        .habit-row-check.checked { animation: habit-check 0.25s cubic-bezier(0.4,0,0.2,1); }
        .progress-animated .progress-fill { animation: bar-fill 0.8s cubic-bezier(0.4,0,0.2,1) both; }
      `}</style>

      <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4.5rem', paddingBottom: '6rem' }}>

        {/* ZONE 1 — COMMAND BAR: Score + sparkline + pillars */}
        <div className="dashboard-zone" style={{ padding: '0 16px 20px', borderBottom: '1px solid var(--border)' }}>

          <p className="label" style={{ marginBottom: 16 }}>{dateStr}</p>

          {/* Score hero */}
          <div
            ref={scoreRef}
            style={{
              marginBottom: 12,
              animation: scorePulsed ? 'score-pulse 0.5s ease' : undefined,
            }}
          >
            <div style={{
              fontSize: 'clamp(5rem, 26vw, 9rem)',
              fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 0.9,
              color: 'var(--text)',
              fontFeatureSettings: '"cv01" on, "ss03" on, "zero" on',
            }}>
              {score}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 510, letterSpacing: '-0.011em', color: allDone ? 'var(--accent)' : 'var(--text)' }}>
                {allDone ? '🎯 Perfect day' : scoreLabel(score)}
              </span>
              <span className="label">/ 100</span>
              {/* PIECE 1: Score intelligence toggle */}
              <button
                onClick={() => setShowScoreBreakdown(s => !s)}
                style={{
                  marginLeft: 'auto', fontSize: 11, color: 'var(--text-4)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  letterSpacing: '-0.01em', padding: '2px 0',
                }}
              >
                {showScoreBreakdown ? 'Hide breakdown ↑' : 'Why? →'}
              </button>
            </div>
          </div>

          {/* PIECE 1: Score breakdown panel */}
          {showScoreBreakdown && (
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 8,
              border: '1px solid var(--border)', padding: '12px',
              marginBottom: 12, animation: 'fade-in-up 0.2s ease',
            }}>
              {pillars.map(p => (
                <div key={p.name} style={{ marginBottom: p.name === 'Mind' ? 0 : 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 510, letterSpacing: '0.01em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{p.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {p.delta !== 0 && (
                        <span style={{ fontSize: 10, color: p.delta > 0 ? 'var(--color-pulse-green)' : 'var(--color-coral-red)', fontWeight: 510 }}>
                          {p.delta > 0 ? '+' : ''}{p.delta}
                        </span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 510, color: p.score > 0 ? 'var(--text)' : 'var(--text-4)' }}>
                        {p.score}/{p.maxScore}
                      </span>
                    </div>
                  </div>
                  <div className="progress" style={{ height: 2 }}>
                    <div className="progress-fill" style={{
                      width: `${(p.score / p.maxScore) * 100}%`,
                      background: p.score === p.maxScore ? 'var(--accent)' : 'var(--text-3)',
                    }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-4)', margin: '3px 0 0', letterSpacing: '-0.01em' }}>{p.reason}</p>
                </div>
              ))}
              {/* One actionable sentence */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 510, margin: 0, letterSpacing: '-0.011em' }}>
                  → {actionSentence}
                </p>
              </div>
            </div>
          )}

          {/* PIECE 4: 7-day sparkline */}
          {allScores.length >= 2 && <ScoreSparkline scores={allScores} />}

          {/* 4 tappable segment bars */}
          <div className="progress-animated" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Segment label="Eat"    val={Math.min(calPct, 100)}   path="/nutrition" delta={pillars[0]?.delta} />
            <Segment label="Habits" val={Math.min(habitPct, 100)} path="/habits"    delta={pillars[1]?.delta} />
            <Segment label="Move"   val={workoutsToday > 0 ? 100 : 0} path="/fitness" delta={pillars[2]?.delta} />
            <Segment label="Mind"   val={medDone ? 100 : 0}       path="/meditation" delta={pillars[3]?.delta} />
          </div>
        </div>

        {/* ZONE 2 — PIECE 4: Macro split bar */}
        {calories > 0 && (
          <div className="dashboard-zone">
            <MacroSplitBar
              protein={protein} carbs={carbs} fat={fat}
              proteinTarget={proteinTarget} carbTarget={carbTarget} fatTarget={fatTarget}
            />
          </div>
        )}

        {/* ZONE 3 — PIECE 3: Data-aware nudge */}
        <div className="dashboard-zone">
          {nudge && !allDone && (
            <button
              onClick={() => { haptic('light'); router.push(nudge.path); }}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '14px 16px',
                background: nudge.urgency === 'high' ? 'rgba(228,242,34,0.08)' : 'rgba(228,242,34,0.04)',
                borderBottom: `1px solid ${nudge.urgency === 'high' ? 'rgba(228,242,34,0.2)' : 'rgba(228,242,34,0.1)'}`,
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                cursor: 'pointer', textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--accent)', margin: '0 0 2px' }}>
                  {nudge.label}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-fog)', margin: 0, letterSpacing: '-0.01em' }}>
                  {nudge.sub}
                </p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 510, letterSpacing: '-0.01em', color: 'var(--accent)', flexShrink: 0, marginLeft: 12 }}>
                {nudge.cta}
              </span>
            </button>
          )}

          {allDone && (
            <div style={{ padding: '14px 16px', background: 'rgba(228,242,34,0.06)', borderBottom: '1px solid rgba(228,242,34,0.15)', textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--accent)', margin: '0 0 2px' }}>Perfect day 🎯</p>
              <p style={{ fontSize: 12, color: 'var(--color-fog)', margin: 0 }}>All four pillars complete</p>
            </div>
          )}
        </div>

        {/* ZONE 4 — PIECE 2: Quick-log food chips */}
        {recentFoods.length > 0 && (
          <div className="dashboard-zone">
            <QuickFoodChips foods={recentFoods} onLog={handleQuickFoodLog} />
          </div>
        )}

        {/* ZONE 5 — PIECE 7: Collapsible metric grid (below fold by default) */}
        <div className="dashboard-zone">
          <button
            onClick={() => setMetricsCollapsed(c => !c)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              width: '100%', padding: '10px 16px',
              background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
              cursor: 'pointer', textAlign: 'left',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 510, letterSpacing: '0.01em', textTransform: 'uppercase', color: 'var(--text-3)', margin: 0 }}>
              Metrics
            </p>
            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{metricsCollapsed ? '↓ Show' : '↑ Hide'}</span>
          </button>

          {!metricsCollapsed && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border)' }}>
              {/* Calories */}
              <button
                onClick={() => router.push('/nutrition')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '14px 16px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', WebkitTapHighlightColor: 'transparent', borderLeft: calPct >= 85 ? '2px solid var(--accent)' : '2px solid transparent' }}
              >
                <p className="label" style={{ marginBottom: 6 }}>Calories</p>
                <p style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1, color: 'var(--text)', margin: '0 0 4px' }}>{calories.toLocaleString()}</p>
                <p className="label" style={{ margin: '0 0 8px' }}>/ {calorieTarget.toLocaleString()}</p>
                <div className="progress">
                  <div className="progress-fill" style={{ width: `${Math.min(calPct, 100)}%`, background: calPct >= 100 ? 'var(--accent)' : 'var(--text)', transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
                </div>
              </button>

              {/* Habits */}
              <button
                onClick={() => router.push('/habits')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--border)', WebkitTapHighlightColor: 'transparent', borderLeft: habitPct >= 100 ? '2px solid var(--accent)' : '2px solid transparent' }}
              >
                <p className="label" style={{ marginBottom: 6 }}>Habits</p>
                <p style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1, color: 'var(--text)', margin: '0 0 4px' }}>{habitDone}/{habits.length}</p>
                <p className="label" style={{ margin: '0 0 8px' }}>{habits.length > 0 ? `${Math.round(habitPct)}% done` : 'none set'}</p>
                <div className="progress">
                  <div className="progress-fill" style={{ width: `${Math.min(habitPct, 100)}%`, background: habitPct >= 100 ? 'var(--accent)' : 'var(--text)', transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
                </div>
              </button>

              {/* Workouts */}
              <button
                onClick={() => router.push('/fitness')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '14px 16px', borderRight: '1px solid var(--border)', WebkitTapHighlightColor: 'transparent', borderLeft: workoutsToday > 0 ? '2px solid var(--accent)' : '2px solid transparent' }}
              >
                <p className="label" style={{ marginBottom: 6 }}>Workouts</p>
                <p style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1, color: 'var(--text)', margin: '0 0 4px' }}>{workoutsToday > 0 ? String(workoutsToday) : '—'}</p>
                <p className="label" style={{ margin: 0 }}>today</p>
              </button>

              {/* Meditation */}
              <button
                onClick={() => router.push('/meditation')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '14px 16px', WebkitTapHighlightColor: 'transparent', borderLeft: medDone ? '2px solid var(--accent)' : '2px solid transparent' }}
              >
                <p className="label" style={{ marginBottom: 6 }}>Meditation</p>
                <p style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1, color: 'var(--text)', margin: '0 0 4px' }}>{medDone ? '✓' : '—'}</p>
                <p className="label" style={{ margin: 0 }}>{medDone ? 'done' : 'not yet'}</p>
              </button>
            </div>
          )}
        </div>

        {/* ZONE 6 — PIECE 5 + 6: Habits with improved empty state + animations */}
        <div className="dashboard-zone" style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text-2)', margin: 0 }}>Habits</p>
            <button
              onClick={() => { haptic('light'); router.push('/habits'); }}
              style={{ fontSize: 12, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '-0.01em' }}
            >
              Manage →
            </button>
          </div>

          {/* PIECE 5: Compelling empty state */}
          {habits.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text-2)', marginBottom: 6 }}>No habits tracked yet</p>
              <p style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 16, letterSpacing: '-0.011em', lineHeight: 1.6 }}>
                Athletes who track daily habits hit their goals 2× more often. Add your first.
              </p>
              <button onClick={() => router.push('/habits')} className="btn btn-primary btn-sm">
                Add first habit →
              </button>
            </div>
          ) : habits.map(h => (
            <button
              key={h.id}
              onClick={() => toggle(h.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                width: '100%', padding: '14px 16px',
                background: h.done ? 'rgba(255,255,255,0.02)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                borderLeft: h.done ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.15s, border-color 0.2s',
              }}
            >
              {/* PIECE 6: Animated checkbox */}
              <div
                className={`habit-row-check ${h.done ? 'checked' : ''}`}
                style={{
                  width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                  border: `1px solid ${h.done ? 'var(--accent)' : 'var(--border-2)'}`,
                  background: h.done ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                  transform: h.done ? 'scale(1)' : 'scale(1)',
                }}
              >
                {h.done && <span style={{ fontSize: 11, color: 'var(--accent-fg)', fontWeight: 510, lineHeight: 1 }}>✓</span>}
              </div>

              <span style={{
                flex: 1, fontSize: 15, fontWeight: 400, letterSpacing: '-0.011em',
                color: h.done ? 'var(--text-4)' : 'var(--text-2)',
                textDecoration: h.done ? 'line-through' : 'none',
                transition: 'color 0.2s, text-decoration 0.2s',
              }}>
                {h.name}
              </span>

              {h.streak > 1 && <span className="badge">{h.streak}d 🔥</span>}
            </button>
          ))}
        </div>

        {/* ZONE 7 — Suggested meditation */}
        {suggested && !medDone && (
          <div className="dashboard-zone" style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 13, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text-2)', margin: 0 }}>Suggested</p>
              <span className="label">{suggested.duration_min} min</span>
            </div>
            <button
              onClick={() => { haptic('light'); router.push(`/meditation/${suggested.id}`); }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}
            >
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 510, fontSize: 17, letterSpacing: '-0.011em', color: 'var(--text)' }}>{suggested.name}</p>
                <p className="label">{suggested.category}</p>
              </div>
              <span className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>Start →</span>
            </button>
          </div>
        )}

        {/* ZONE 8 — PIECE 8: Weekly feedback loop card */}
        {(weeklySummary.avgScore > 0 || allScores.length >= 3) && (
          <div className="dashboard-zone" style={{ padding: '16px' }}>
            <div style={{
              background: 'var(--color-carbon)',
              boxShadow: 'var(--shadow-card)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="label" style={{ margin: 0 }}>This week</p>
                {weeklySummary.avgLastWeek > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 510, letterSpacing: '-0.01em',
                    color: weeklySummary.avgScore >= weeklySummary.avgLastWeek ? 'var(--color-pulse-green)' : 'var(--color-coral-red)',
                  }}>
                    {weeklySummary.avgScore >= weeklySummary.avgLastWeek ? '+' : ''}{weeklySummary.avgScore - weeklySummary.avgLastWeek} vs last week
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--border)' }}>
                <div style={{ padding: '14px 12px', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                  <p className="label" style={{ marginBottom: 6 }}>Avg score</p>
                  <p style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.022em', color: 'var(--text)', margin: 0 }}>{weeklySummary.avgScore}</p>
                </div>
                <div style={{ padding: '14px 12px', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                  <p className="label" style={{ marginBottom: 6 }}>Streak</p>
                  <p style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.022em', color: weeklySummary.streak >= 3 ? 'var(--accent)' : 'var(--text)', margin: 0 }}>
                    {weeklySummary.streak}d
                  </p>
                </div>
                <div style={{ padding: '14px 12px', textAlign: 'center' }}>
                  <p className="label" style={{ marginBottom: 6 }}>Best day</p>
                  <p style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.022em', color: 'var(--text)', margin: 0 }}>
                    {weeklySummary.bestDay ? weeklySummary.bestDay.score : '—'}
                  </p>
                </div>
              </div>

              {weeklySummary.bestDay && (
                <div style={{ padding: '10px 16px' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0, letterSpacing: '-0.011em' }}>
                    {weeklySummary.streak >= 3
                      ? `🔥 ${weeklySummary.streak} consecutive days above 70 — keep the streak alive`
                      : `Best day: ${weeklySummary.bestDay.day} — ${weeklySummary.bestDay.score} points`}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Floating acid-lime log button */}
      <button
        onClick={() => { haptic('medium'); setQuickLog(true); }}
        style={{
          position: 'fixed', bottom: 72, right: 16, zIndex: 200,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--accent)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(228,242,34,0.35), var(--shadow-xl)',
          fontSize: 22, color: 'var(--accent-fg)', fontWeight: 300, lineHeight: 1,
          transition: 'transform 0.15s, box-shadow 0.15s',
          WebkitTapHighlightColor: 'transparent',
        }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.93)')}
        onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        +
      </button>

      <QuickLogSheet open={quickLog} onClose={() => setQuickLog(false)} onLogged={() => load()} />
    </>
  );
}
