'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getProfile, getHabits, getHabitCompletions, getHabitStreaks,
  getMeditationSessions, getMeditationLogs, getTodayMacros,
  getWorkoutLogs, getTrainingSessions, getCurrentTrainingWeek,
  toggleHabitCompletion, seedUserData, getDailyScores,
  todayISO, type Habit, type MeditationSession, type DailyScore,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';
import { toast } from '@/components/Toast';
import { DashboardSkeleton } from '@/components/Skeleton';
import QuickLogSheet from '@/components/QuickLogSheet';
import { requestHealthKitPermissions, getHealthData, type HealthData } from '@/lib/healthkit';

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

interface PillarBreakdown {
  name: string;
  score: number;
  maxScore: number;
  delta: number;
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
    { name: 'Eat', score: eatScore, maxScore: 30, delta: eatScore - yEat, reason: calPct <= 0 ? 'Nothing logged' : calPct < 70 ? `${Math.round(calPct)}% of target` : calPct > 110 ? 'Over target' : 'On track' },
    { name: 'Habits', score: Math.round(habitScore), maxScore: 40, delta: Math.round(habitScore - yHabit), reason: habitPct <= 0 ? 'No habits done' : habitPct < 50 ? 'Less than half done' : habitPct < 100 ? `${Math.round(habitPct)}% complete` : 'All done' },
    { name: 'Move', score: moveScore, maxScore: 20, delta: moveScore - yMove, reason: hasWorkout ? 'Workout logged' : 'No workout yet' },
    { name: 'Mind', score: mindScore, maxScore: 10, delta: mindScore - yMind, reason: hasMed ? 'Meditation done' : 'Not yet' },
  ];
}

function getScoreColour(s: number): string {
  if (s >= 75) return '#DAFF01';
  if (s >= 50) return '#ffffff';
  return 'rgba(255,255,255,0.5)';
}

function getScoreExplanation(
  calPct: number, habitPct: number, hasWorkout: boolean, hasMed: boolean,
  protein: number, proteinTarget: number, calories: number, calorieTarget: number,
): string {
  // Find the biggest gap pillar and produce a plain-English sentence
  const gaps: { label: string; missing: number; sentence: string }[] = [];

  // Eat gap (max 30 pts)
  if (calPct <= 0) {
    gaps.push({ label: 'Eat', missing: 30, sentence: "You haven't logged any food — that's the biggest drag on your score." });
  } else if (calPct < 70) {
    const proteinGap = Math.round(proteinTarget - protein);
    if (proteinGap > 10 && protein < proteinTarget * 0.7) {
      gaps.push({ label: 'Eat', missing: 20, sentence: `Protein is ${proteinGap}g short — that's holding your score down.` });
    } else {
      gaps.push({ label: 'Eat', missing: 20, sentence: `Calories are at ${Math.round(calPct)}% of target — log more to lift your score.` });
    }
  }

  // Habits gap (max 40 pts)
  if (habitPct <= 0) {
    gaps.push({ label: 'Habits', missing: 40, sentence: "No habits done yet — completing them is worth the most points." });
  } else if (habitPct < 50) {
    gaps.push({ label: 'Habits', missing: Math.round(40 * (1 - habitPct / 100)), sentence: `Less than half your habits done — finishing them would add the most points.` });
  } else if (habitPct < 100) {
    gaps.push({ label: 'Habits', missing: Math.round(40 * (1 - habitPct / 100)), sentence: `${Math.round(100 - habitPct)}% of habits still to go — knock them out to push your score up.` });
  }

  // Move gap (max 20 pts)
  if (!hasWorkout) {
    gaps.push({ label: 'Move', missing: 20, sentence: "Log a workout to unlock 20 points — even a short session counts." });
  }

  // Mind gap (max 10 pts)
  if (!hasMed) {
    gaps.push({ label: 'Mind', missing: 10, sentence: "Log your meditation to close the loop and hit 10 more points." });
  }

  if (gaps.length === 0) return "You're on track — all pillars are complete.";

  // Return sentence for the highest-missing-points gap
  gaps.sort((a, b) => b.missing - a.missing);
  return gaps[0].sentence;
}

function getTrainingRecommendation(score: number): string {
  if (score >= 80) return 'Train hard today';
  if (score >= 60) return "Moderate session — don't push it";
  return 'Recovery day — keep it light';
}

function getDataAwareNudge(
  calPct: number, habitPct: number, hasWorkout: boolean, hasMed: boolean,
  calorieTarget: number, calories: number, protein: number, proteinTarget: number,
  workoutDaysGap: number,
): { label: string; sub: string; path: string; cta: string } | null {
  const h = new Date().getHours();
  if (calories === 0 && h >= 7) {
    const meal = h < 11 ? 'breakfast' : h < 15 ? 'lunch' : 'dinner';
    return { label: `Nothing logged yet`, sub: `Start with ${meal} — ${calorieTarget} kcal target`, path: '/nutrition?action=add', cta: 'Log meal' };
  }
  if (workoutDaysGap >= 3 && h >= 9 && h < 21) return { label: `${workoutDaysGap} rest days in a row`, sub: "Get a workout in today", path: '/fitness', cta: 'Log workout' };
  if (protein < proteinTarget * 0.5 && h >= 18) return { label: `Protein at ${Math.round((protein / proteinTarget) * 100)}%`, sub: `${Math.round(proteinTarget - protein)}g short — add protein to dinner`, path: '/nutrition?action=add', cta: 'Log dinner' };
  if (!hasWorkout && h >= 9 && h < 21) return { label: "Move hasn't fired today", sub: 'Log any workout — even a walk counts', path: '/fitness', cta: 'Log workout' };
  if (habitPct < 50 && h >= 14) return { label: 'Habits falling behind', sub: `Less than half done — finish before tonight`, path: '/habits', cta: 'View habits' };
  if (!hasMed && h >= 19) return { label: 'Wind down', sub: 'Meditation not done — closes the loop', path: '/meditation', cta: 'Start session' };
  if (calPct > 0 && calPct < 85 && h >= 18) return { label: 'Top up calories', sub: `${Math.round(calorieTarget - calories)} kcal left`, path: '/nutrition?action=add', cta: 'Log meal' };
  return null;
}

// ── Dot matrix for 7-day habit history ──────────────────────────────────────
function HabitDotRow({ done, name }: { done: boolean[]; name: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--text-5)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {done.map((d, i) => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: 2,
            background: d ? 'var(--text)' : 'var(--surface-3)',
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Segment bar ──────────────────────────────────────────────────────────────
function Segment({ label, val, path, delta }: { label: string; val: number; path: string; delta?: number }) {
  const router = useRouter();
  const active = val > 0;
  return (
    <button
      onClick={() => { haptic('light'); router.push(path); }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="progress" style={{ marginBottom: 5, height: 2, background: 'var(--surface-3)', borderRadius: 9999, overflow: 'hidden' }}>
        <div className="progress-fill" style={{ height: '100%', width: `${val}%`, background: 'var(--text)', borderRadius: 9999 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <p style={{ fontSize: 10, fontWeight: 510, letterSpacing: '0.01em', textTransform: 'uppercase', color: active ? 'var(--text-3)' : 'var(--text-5)', margin: 0 }}>
          {label}
        </p>
        {delta !== undefined && delta !== 0 && (
          <span style={{ fontSize: 9, color: delta > 0 ? 'var(--text-3)' : 'var(--text-5)', fontWeight: 510 }}>
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Weekly sparkline ─────────────────────────────────────────────────────────
function ScoreSparkline({ scores }: { scores: DailyScore[] }) {
  const today = new Date();
  const points: (number | null)[] = [];
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
  const W = 300, H = 28;
  const pathParts: string[] = [];
  let firstValid = true;
  points.forEach((p, i) => {
    if (p === null) return;
    const x = (i / 6) * W;
    const y = H - ((p - min) / (max - min)) * H;
    pathParts.push(`${firstValid ? 'M' : 'L'} ${x},${y}`);
    firstValid = false;
  });
  let lastValidIdx = -1;
  for (let i = 0; i < points.length; i++) { if (points[i] !== null) lastValidIdx = i; }
  if (lastValidIdx < 0) return null;
  const lastX = (lastValidIdx / 6) * W;
  const lastVal = points[lastValidIdx] as number;
  const lastY = H - ((lastVal - min) / (max - min)) * H;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: 28, marginTop: 4 }}>
      <path d={pathParts.join(' ')} fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="3" fill="var(--text)" />
    </svg>
  );
}

// ── Bento card ───────────────────────────────────────────────────────────────
function BentoCard({ children, onClick, elevated, style }: { children: React.ReactNode; onClick?: () => void; elevated?: boolean; style?: React.CSSProperties }) {
  const base: React.CSSProperties = {
    background: 'var(--surface)',
    borderRadius: 24,
    boxShadow: 'var(--ring)',
    padding: 18,
    ...style,
  };
  if (onClick) {
    return (
      <button onClick={onClick} style={{ ...base, border: 'none', cursor: 'pointer', textAlign: 'left', display: 'block', width: '100%', WebkitTapHighlightColor: 'transparent' }}>
        {children}
      </button>
    );
  }
  return <div style={base}>{children}</div>;
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
  const [workoutDaysGap, setWorkoutDaysGap] = useState(0);
  const [scorePulsed, setScorePulsed] = useState(false);
  const [healthData, setHealthData]   = useState<HealthData | null>(null);

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

      const [macros, profile, activeHabits, completions, workouts, trainingSessions, medLogs, sessions, scores] = await Promise.all([
        getTodayMacros(), getProfile(), getHabits(), getHabitCompletions(today),
        getWorkoutLogs(today), getTrainingSessions(getCurrentTrainingWeek()),
        getMeditationLogs(today), getMeditationSessions(),
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
      // Count workout as done if EITHER workout_log OR training_sessions has an entry today
      const trainingToday = trainingSessions.filter(s => s.date === today);
      setWorkouts(workouts.length + (workouts.length === 0 ? trainingToday.length : 0));
      setMedDone(medLogs.some(m => m.completed));
      const loggedIds = new Set(medLogs.map(m => m.session_id));
      setSuggested(sessions.find(s => !loggedIds.has(s.id)) ?? sessions[0] ?? null);

      const yScore = scores.find(s => s.date === yesterdayStr);
      if (yScore) {
        const yCalPct = yScore.calories_actual > 0 ? (yScore.calories_actual / (profile?.calorie_target ?? 2000)) * 100 : 0;
        setYesterdayCalPct(yCalPct);
        setYesterdayHabitPct(50);
        setYesterdayHadWorkout(false);
        setYesterdayHadMed(false);
      }

      let gap = 0;
      for (let i = 1; i <= 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const { getWorkoutLogs: gwl } = await import('@/lib/db');
        const wl = await gwl(dateStr);
        if (wl.length > 0) break;
        // Also check training_sessions for that date
        const { supabase } = await import('@/lib/supabase');
        const { data: ts } = await supabase
          .from('training_sessions')
          .select('id')
          .eq('date', dateStr)
          .limit(1);
        if ((ts?.length ?? 0) > 0) break;
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

  // ── HealthKit: request permissions on first open, then fetch data ─────────
  useEffect(() => {
    const initHealthKit = async () => {
      try {
        // Always request — let HealthKit decide if it's already been granted
        const granted = await requestHealthKitPermissions();
        localStorage.setItem('hk_asked', '1');
        console.log('[HealthKit] Permission granted:', granted);
        const data = await getHealthData();
        console.log('[HealthKit] Data:', JSON.stringify(data));
        if (data.available) setHealthData(data);
      } catch (e) {
        console.warn('[HealthKit] Error:', e);
      }
    };
    initHealthKit();
  }, []);

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
  const pillars   = getScoreBreakdown(calPct, habitPct, workoutsToday > 0, medDone, yesterdayCalPct, yesterdayHabitPct, yesterdayHadWorkout, yesterdayHadMed);
  const nudge     = getDataAwareNudge(calPct, habitPct, workoutsToday > 0, medDone, calorieTarget, calories, protein, proteinTarget, workoutDaysGap);
  const allDone   = calPct >= 85 && habitPct >= 100 && workoutsToday > 0 && medDone;
  const remaining = Math.max(0, calorieTarget - calories);

  if (loading) return <DashboardSkeleton />;

  return (
    <>
      <style>{`
        @keyframes bento-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .bento-card-anim { animation: bento-in 0.35s ease both; }
        .bento-card-anim:nth-child(1) { animation-delay: 0ms; }
        .bento-card-anim:nth-child(2) { animation-delay: 60ms; }
        .bento-card-anim:nth-child(3) { animation-delay: 120ms; }
        .bento-card-anim:nth-child(4) { animation-delay: 180ms; }
        .bento-card-anim:nth-child(5) { animation-delay: 240ms; }
        .bento-card-anim:nth-child(6) { animation-delay: 300ms; }
      `}</style>

      <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4.5rem', paddingBottom: '100px' }}>

        {/* ── Hero section ── */}
        <div style={{ padding: '0 20px 20px' }}>

          {/* Date */}
          <p style={{ fontSize: 12, letterSpacing: '0.01em', textTransform: 'uppercase', color: 'var(--text-5)', marginBottom: 12, marginTop: 4 }}>
            {dateStr}
          </p>

          {/* Score hero */}
          <div style={{ animation: scorePulsed ? 'score-pulse 0.5s ease' : undefined, marginBottom: 16 }}>
            <div
              className="t-hero"
              style={{
                lineHeight: 0.9,
                color: getScoreColour(score),
                fontFeatureSettings: '"cv01" on, "ss03" on, "zero" on',
              }}
            >
              {score}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 510, letterSpacing: '-0.011em', color: allDone ? 'var(--text)' : 'var(--text-3)' }}>
                {allDone ? 'Perfect day' : scoreLabel(score)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-5)', letterSpacing: '0.01em', textTransform: 'uppercase' }}>/ 100</span>
            </div>
            {/* Score explanation */}
            <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 6, marginBottom: 0, lineHeight: 1.4 }}>
              {getScoreExplanation(calPct, habitPct, workoutsToday > 0, medDone, protein, proteinTarget, calories, calorieTarget)}
            </p>
            {/* Training recommendation */}
            <p style={{ fontSize: 11, fontWeight: 510, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-5)', marginTop: 8, marginBottom: 0 }}>
              {getTrainingRecommendation(score)}
            </p>
          </div>

          {/* Sparkline */}
          {allScores.length >= 2 && <ScoreSparkline scores={allScores} />}

          {/* 4 segment bars */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginTop: 20 }}>
            <Segment label="Eat"    val={Math.min(calPct, 100)}        path="/nutrition" delta={pillars[0]?.delta} />
            <Segment label="Habits" val={Math.min(habitPct, 100)}      path="/habits"    delta={pillars[1]?.delta} />
            <Segment label="Move"   val={workoutsToday > 0 ? 100 : 0} path="/fitness"   delta={pillars[2]?.delta} />
            <Segment label="Mind"   val={medDone ? 100 : 0}           path="/meditation" delta={pillars[3]?.delta} />
          </div>
        </div>

        {/* ── Bento grid ── */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Row 1: Calories + Habits (half-width) */}
          <div className="bento-card-anim" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            {/* Calories card */}
            <BentoCard onClick={() => router.push('/nutrition')}>
              <p className="label" style={{ marginBottom: 8 }}>Calories</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1, color: 'var(--text)' }}>
                  {calories > 0 ? calories.toLocaleString() : '—'}
                </span>
              </div>
              <p className="t-unit" style={{ marginTop: 2, marginBottom: 10 }}>
                {remaining > 0 ? `${remaining} left` : 'Target hit'}
              </p>
              <div style={{ height: 2, background: 'var(--surface-3)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(calPct, 100)}%`, background: 'var(--text)', borderRadius: 9999, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
              </div>
            </BentoCard>

            {/* Habits card */}
            <BentoCard onClick={() => router.push('/habits')}>
              <p className="label" style={{ marginBottom: 8 }}>Habits</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1, color: 'var(--text)' }}>{habitDone}</span>
                <span style={{ fontSize: 13, color: 'var(--text-5)' }}>/{habits.length}</span>
              </div>
              <p className="t-unit" style={{ marginBottom: 10 }}>
                {habits.length > 0 ? `${Math.round(habitPct)}% done` : 'none set'}
              </p>
              {/* 7-day dots */}
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {Array.from({ length: 7 }, (_, i) => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: 2, background: i < habitDone ? 'var(--text)' : 'var(--surface-3)' }} />
                ))}
              </div>
            </BentoCard>
          </div>

          {/* Row 2: Nudge card (full-width) */}
          {(nudge || allDone) && (
            <div className="bento-card-anim">
              <div style={{ background: 'var(--surface)', borderRadius: 24, boxShadow: 'var(--ring)', padding: 18 }}>
                {allDone ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text)', margin: '0 0 4px' }}>Perfect day</p>
                      <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0 }}>All four pillars complete</p>
                    </div>
                    <span style={{ fontSize: 24 }}>◉</span>
                  </div>
                ) : nudge && (
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => router.push(nudge.path)}
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                      <p style={{ fontSize: 14, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text)', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nudge.label}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0, lineHeight: 1.4 }}>{nudge.sub}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 510, color: 'var(--text-3)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {nudge.cta} →
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Row 3: Move + Mind (half-width) */}
          <div className="bento-card-anim" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            {/* Move card */}
            <BentoCard onClick={() => router.push('/fitness')}>
              <p className="label" style={{ marginBottom: 8 }}>Move</p>
              <p style={{ fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1, color: 'var(--text)', marginBottom: 4 }}>
                {workoutsToday > 0 ? '△' : '—'}
              </p>
              <p className="t-unit">
                {workoutsToday > 0 ? `${workoutsToday} workout${workoutsToday > 1 ? 's' : ''}` : 'none today'}
              </p>
              <div style={{ height: 2, background: 'var(--surface-3)', borderRadius: 9999, overflow: 'hidden', marginTop: 10 }}>
                <div style={{ height: '100%', width: workoutsToday > 0 ? '100%' : '0%', background: 'var(--text)', borderRadius: 9999, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
              </div>
            </BentoCard>

            {/* Mind card */}
            <BentoCard onClick={() => router.push('/meditation')}>
              <p className="label" style={{ marginBottom: 8 }}>Mind</p>
              <p style={{ fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1, color: 'var(--text)', marginBottom: 4 }}>
                {medDone ? '✓' : '—'}
              </p>
              <p className="t-unit">
                {medDone ? 'done' : 'not yet'}
              </p>
              <div style={{ height: 2, background: 'var(--surface-3)', borderRadius: 9999, overflow: 'hidden', marginTop: 10 }}>
                <div style={{ height: '100%', width: medDone ? '100%' : '0%', background: 'var(--text)', borderRadius: 9999, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
              </div>
            </BentoCard>
          </div>

          {/* Pillar breakdown card */}
          <div className="bento-card-anim">
            <div style={{ background: 'var(--surface)', borderRadius: 24, boxShadow: 'var(--ring)', padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 510, color: 'var(--text-2)', margin: '0 0 12px' }}>Score breakdown</p>
              {pillars.map(p => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 510, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-4)', width: 48, flexShrink: 0 }}>{p.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 510, color: p.score === p.maxScore ? '#DAFF01' : 'var(--text)', width: 40, flexShrink: 0 }}>{p.score}<span style={{ fontSize: 10, color: 'var(--text-5)', fontWeight: 400 }}>/{p.maxScore}</span></span>
                  <span style={{ fontSize: 12, color: 'var(--text-4)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Row 4: Habits list (full-width) */}
          {habits.length > 0 && (
            <div className="bento-card-anim">
              <div style={{ background: 'var(--surface)', borderRadius: 24, boxShadow: 'var(--ring)', padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 510, color: 'var(--text-2)', margin: 0 }}>Daily habits</p>
                  <button
                    onClick={() => router.push('/habits')}
                    style={{ fontSize: 12, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '-0.01em' }}
                  >
                    Manage →
                  </button>
                </div>
                <div>
                  {habits.map(h => (
                    <button
                      key={h.id}
                      onClick={() => toggle(h.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        width: '100%', padding: '10px 0',
                        background: h.done ? 'rgba(255,255,255,0.02)' : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer', textAlign: 'left',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                        border: `1px solid var(--border-2)`,
                        background: h.done ? 'var(--text)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {h.done && <span style={{ fontSize: 10, color: 'var(--invert)', fontWeight: 510 }}>✓</span>}
                      </div>
                      <span style={{
                        flex: 1, fontSize: 14, fontWeight: 400, letterSpacing: '-0.011em',
                        color: h.done ? 'var(--text-5)' : 'var(--text)',
                        textDecoration: h.done ? 'line-through' : 'none',
                        transition: 'color 0.2s',
                      }}>
                        {h.name}
                      </span>
                      {h.streak > 1 && (
                        <span style={{ fontSize: 11, color: 'var(--text-4)', flexShrink: 0 }}>{h.streak}d</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* HealthKit card — only shows when data is available (native app) */}
          {healthData && healthData.available && (
            <div className="bento-card-anim">
              <div style={{ background: 'var(--surface)', borderRadius: 24, boxShadow: 'var(--ring)', padding: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 510, color: 'var(--text-2)', margin: '0 0 14px' }}>Apple Health</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {/* Steps */}
                  {healthData.steps > 0 && (
                    <div>
                      <p style={{ fontSize: 22, fontWeight: 510, letterSpacing: '-0.022em', color: 'var(--text)', margin: 0, lineHeight: 1 }}>
                        {healthData.steps.toLocaleString()}
                      </p>
                      <p className="label" style={{ marginTop: 4 }}>Steps</p>
                    </div>
                  )}
                  {/* Heart rate */}
                  {healthData.heartRate > 0 && (
                    <div>
                      <p style={{ fontSize: 22, fontWeight: 510, letterSpacing: '-0.022em', color: 'var(--text)', margin: 0, lineHeight: 1 }}>
                        {healthData.heartRate}
                      </p>
                      <p className="label" style={{ marginTop: 4 }}>BPM</p>
                    </div>
                  )}
                  {/* HRV */}
                  {healthData.hrv > 0 && (
                    <div>
                      <p style={{ fontSize: 22, fontWeight: 510, letterSpacing: '-0.022em', color: 'var(--text)', margin: 0, lineHeight: 1 }}>
                        {Math.round(healthData.hrv)}
                      </p>
                      <p className="label" style={{ marginTop: 4 }}>HRV ms</p>
                    </div>
                  )}
                  {/* Sleep */}
                  {healthData.sleepHours > 0 && (
                    <div>
                      <p style={{ fontSize: 22, fontWeight: 510, letterSpacing: '-0.022em', color: 'var(--text)', margin: 0, lineHeight: 1 }}>
                        {healthData.sleepHours}h{healthData.sleepMinutes > 0 ? `${healthData.sleepMinutes}m` : ''}
                      </p>
                      <p className="label" style={{ marginTop: 4 }}>Sleep</p>
                    </div>
                  )}
                  {/* Active calories */}
                  {healthData.activeCalories > 0 && (
                    <div>
                      <p style={{ fontSize: 22, fontWeight: 510, letterSpacing: '-0.022em', color: 'var(--text)', margin: 0, lineHeight: 1 }}>
                        {healthData.activeCalories}
                      </p>
                      <p className="label" style={{ marginTop: 4 }}>Active kcal</p>
                    </div>
                  )}
                  {/* Weight from Health */}
                  {healthData.weight > 0 && (
                    <div>
                      <p style={{ fontSize: 22, fontWeight: 510, letterSpacing: '-0.022em', color: 'var(--text)', margin: 0, lineHeight: 1 }}>
                        {healthData.weight}
                      </p>
                      <p className="label" style={{ marginTop: 4 }}>kg</p>
                    </div>
                  )}
                </div>
                {/* Recent workouts from Health */}
                {healthData.workouts.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    <p className="label" style={{ marginBottom: 8 }}>Recent workouts</p>
                    {healthData.workouts.slice(0, 3).map((w, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                        <span style={{ fontSize: 13, color: 'var(--text)', letterSpacing: '-0.011em' }}>{w.type}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{w.duration} min · {w.calories} kcal</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Row 5: Suggested meditation (full-width) */}
          {suggested && !medDone && (
            <div className="bento-card-anim">
              <div style={{ background: 'var(--surface)', borderRadius: 24, boxShadow: 'var(--ring)', padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div
                    style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
                    onClick={() => router.push(`/meditation/${suggested.id}`)}
                  >
                    <p className="label" style={{ marginBottom: 6 }}>Suggested</p>
                    <p style={{ fontSize: 20, fontWeight: 510, letterSpacing: '-0.012em', color: 'var(--text)', margin: '0 0 4px' }}>{suggested.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-4)' }}>{suggested.category} · {suggested.duration_min} min</p>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={e => { e.stopPropagation(); haptic('light'); router.push(`/meditation/${suggested.id}`); }}
                  >
                    Start →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <QuickLogSheet open={quickLog} onClose={() => setQuickLog(false)} onLogged={() => load()} />


    </>
  );
}
