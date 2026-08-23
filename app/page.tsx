'use client';

export const dynamic = 'force-dynamic';

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
import ScoreSilhouette from '@/components/ScoreSilhouette';
import { requestHealthKitPermissions, getHealthData, type HealthData } from '@/lib/healthkit';

// ── Score logic ────────────────────────────────────────────────────────────────
// Streak bonus per pillar (max 10 each)
function streakBonus(streak: number): number {
  if (streak >= 30) return 10;
  if (streak >= 14) return 8;
  if (streak >= 7)  return 5;
  if (streak >= 3)  return 2;
  return 0;
}

function calcScore(
  calPct: number, morningPct: number, eveningPct: number,
  hasWorkout: boolean, workoutIntensity: 'low'|'moderate'|'high', workoutDuration: number,
  protein: number, proteinTarget: number, streakDays: number
) {
  // Nutrition: 25pts — proportional within 10% threshold
  const calOk = calPct >= 90 && calPct <= 110;
  const protOk = proteinTarget > 0 && protein >= proteinTarget * 0.9;
  const nutritionScore = calOk && protOk ? 25 : calOk || protOk ? Math.round(25 * 0.6) : calPct > 0 ? Math.round(25 * (calPct / 100) * 0.4) : 0;

  // Training: 25pts partial — intensity × duration
  const intensityMult = workoutIntensity === 'high' ? 1.0 : workoutIntensity === 'moderate' ? 0.85 : 0.65;
  const durationPct   = Math.min(workoutDuration / 45, 1);
  const trainingScore = hasWorkout ? Math.round(intensityMult * durationPct * 25) : 0;

  // Morning: 25pts proportional
  const morningScore = Math.round(morningPct * 25 / 100);

  // Evening: 25pts proportional
  const eveningScore = Math.round(eveningPct * 25 / 100);

  // Streak bonus (per overall streak, applied once)
  const bonus = streakBonus(streakDays);

  return nutritionScore + trainingScore + morningScore + eveningScore + bonus;
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
  calPct: number, morningPct: number, eveningPct: number,
  hasWorkout: boolean, workoutIntensity: 'low'|'moderate'|'high', workoutDuration: number,
  protein: number, proteinTarget: number, streakDays: number
): PillarBreakdown[] {
  const calOk  = calPct >= 90 && calPct <= 110;
  const protOk = proteinTarget > 0 && protein >= proteinTarget * 0.9;
  const nutritionScore = calOk && protOk ? 25 : calOk || protOk ? 15 : calPct > 0 ? Math.round(25 * (calPct / 100) * 0.4) : 0;
  const intensityMult  = workoutIntensity === 'high' ? 1.0 : workoutIntensity === 'moderate' ? 0.85 : 0.65;
  const durationPct    = Math.min(workoutDuration / 45, 1);
  const trainingScore  = hasWorkout ? Math.round(intensityMult * durationPct * 25) : 0;
  const morningScore   = Math.round(morningPct * 25 / 100);
  const eveningScore   = Math.round(eveningPct * 25 / 100);
  const bonus          = streakBonus(streakDays);
  return [
    { name: 'Nutrition', score: nutritionScore, maxScore: 25, delta: 0, reason: calPct <= 0 ? 'Nothing logged' : !calOk && !protOk ? `${Math.round(calPct)}% of target` : calOk && !protOk ? 'Calories ✓ · protein short' : !calOk && protOk ? 'Protein ✓ · calories off' : 'On target' },
    { name: 'Training',  score: trainingScore,  maxScore: 25, delta: 0, reason: !hasWorkout ? 'No workout yet' : trainingScore >= 25 ? 'Full session' : 'Partial session' },
    { name: 'Morning',   score: morningScore,   maxScore: 25, delta: 0, reason: morningPct >= 100 ? 'All done' : morningPct > 0 ? `${Math.round(morningPct)}% complete` : 'Not started' },
    { name: 'Evening',   score: eveningScore,   maxScore: 25, delta: 0, reason: eveningPct >= 100 ? 'All done' : eveningPct > 0 ? `${Math.round(eveningPct)}% complete` : 'Not started' },
    { name: 'Streak',    score: bonus,          maxScore: 10, delta: 0, reason: streakDays >= 30 ? `${streakDays}-day streak 🔥` : streakDays >= 7 ? `${streakDays}-day streak` : streakDays >= 3 ? `${streakDays}-day streak` : streakDays > 0 ? `${streakDays} day` : 'No streak yet' },
  ];
}

function getScoreColour(_s: number): string {
  return '#1F58F2'; // Always electric cobalt
}

function getScoreExplanation(
  calPct: number, habitPct: number, hasWorkout: boolean, hasMed: boolean,
  protein: number, proteinTarget: number, calories: number, calorieTarget: number,
): string {
  // Find the biggest gap pillar and produce a plain-English sentence
  const gaps: { label: string; missing: number; sentence: string }[] = [];

  // Eat gap (max 25 pts)
  const calOk = calPct >= 85 && calPct <= 115;
  const protOk = proteinTarget > 0 && protein >= proteinTarget * 0.9 && protein <= proteinTarget * 1.1;
  if (calPct <= 0) {
    gaps.push({ label: 'Eat', missing: 25, sentence: "You haven't logged any food — that's the biggest drag on your score." });
  } else if (!calOk && !protOk) {
    const proteinGap = Math.round(proteinTarget - protein);
    if (proteinGap > 10 && protein < proteinTarget * 0.7) {
      gaps.push({ label: 'Eat', missing: 25, sentence: `Protein is ${proteinGap}g short and calories are off — fixing both unlocks full Eat points.` });
    } else {
      gaps.push({ label: 'Eat', missing: 25, sentence: `Calories are at ${Math.round(calPct)}% of target — log more to lift your score.` });
    }
  } else if (!calOk || !protOk) {
    gaps.push({ label: 'Eat', missing: 13, sentence: !calOk ? `Calories at ${Math.round(calPct)}% — hit the target to unlock full Eat points.` : `Protein short — hit your target to max out Eat points.` });
  }

  // Habits gap (max 25 pts)
  if (habitPct <= 0) {
    gaps.push({ label: 'Habits', missing: 25, sentence: "No habits done yet — completing them is worth the most points." });
  } else if (habitPct < 50) {
    gaps.push({ label: 'Habits', missing: Math.round(25 * (1 - habitPct / 100)), sentence: `Less than half your habits done — finishing them would add the most points.` });
  } else if (habitPct < 100) {
    gaps.push({ label: 'Habits', missing: Math.round(25 * (1 - habitPct / 100)), sentence: `${Math.round(100 - habitPct)}% of habits still to go — knock them out to push your score up.` });
  }

  // Move gap (max 25 pts)
  if (!hasWorkout) {
    gaps.push({ label: 'Move', missing: 25, sentence: "Log a workout to unlock 25 points — even a short session counts." });
  }

  // Mind gap (max 15 pts)
  if (!hasMed) {
    gaps.push({ label: 'Mind', missing: 15, sentence: "Log your meditation to close the loop and hit 15 more points." });
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
      <div className="progress" style={{ marginBottom: 5, height: 2, background: 'rgba(216,234,255,0.08)', borderRadius: 9999, overflow: 'hidden' }}>
        <div className="progress-fill" style={{ height: '100%', width: `${val}%`, background: active ? '#1f58f2' : 'rgba(216,234,255,0.08)', borderRadius: 9999, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 5 }}>
        <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: active ? 'rgba(216,234,255,0.55)' : 'rgba(216,234,255,0.20)', margin: 0 }}>
          {label}
        </p>
        {delta !== undefined && delta !== 0 && (
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: delta > 0 ? '#1f58f2' : '#ff4105' }}>
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
    background: '#111113',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.06)',
    padding: 18,
    position: 'relative',
    overflow: 'hidden',
    ...style,
  };
  if (onClick) {
    return (
      <button onClick={onClick} style={{ ...base, cursor: 'pointer', textAlign: 'left', display: 'block', width: '100%', WebkitTapHighlightColor: 'transparent' }}>
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

  // ── HealthKit: fetch data directly via plugin after page loads ───────────────
  useEffect(() => {
    // Also listen for native push event (in case Swift pushes proactively)
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.available) setHealthData(d);
    };
    window.addEventListener('healthkit-data', handler);

    // Check window cache (data may have arrived before React mounted)
    const cached = (window as any).__healthKitData;
    if (cached?.available) setHealthData(cached);

    // Poll window.__healthKitData every 2s for up to 12s (Swift pushes after 5s)
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      const d = (window as any).__healthKitData;
      if (d?.available) {
        console.log('[HealthKit] Poll found data, attempt', attempts);
        setHealthData(d);
        clearInterval(poll);
      }
      if (attempts >= 6) clearInterval(poll);
    }, 2000);

    return () => {
      window.removeEventListener('healthkit-data', handler);
      clearInterval(poll);
    };
  }, []);

  const toggle = async (id: number) => {
    haptic('medium');
    await toggleHabitCompletion(id);
    const h = habits.find(h => h.id === id);
    if (h) toast(h.done ? `${h.name} unchecked` : `${h.name} done ✓`);
    await load();
  };

  const calPct      = calorieTarget > 0 ? (calories / calorieTarget) * 100 : 0;
  const morningHabits = habits.filter(h => h.routine === 'morning');
  const eveningHabits = habits.filter(h => h.routine === 'evening');
  const morningDone   = morningHabits.filter(h => h.done).length;
  const eveningDone   = eveningHabits.filter(h => h.done).length;
  const morningPct    = morningHabits.length > 0 ? (morningDone / morningHabits.length) * 100 : 100;
  const eveningPct    = eveningHabits.length > 0 ? (eveningDone / eveningHabits.length) * 100 : 100;
  const habitDone     = habits.filter(h => h.done).length;
  const habitPct      = habits.length > 0 ? (habitDone / habits.length) * 100 : 0;
  // Training partial scoring defaults (full session equivalent until we track per-workout intensity here)
  const bestIntensity: 'low'|'moderate'|'high' = 'moderate';
  const bestDuration = 45;
  // Streak: consecutive days where total_score >= 70
  const sortedScores = [...allScores].sort((a, b) => b.date.localeCompare(a.date));
  let streakDays = 0;
  for (const s of sortedScores) {
    if (s.total_score >= 70) streakDays++;
    else break;
  }
  const score   = calcScore(calPct, morningPct, eveningPct, workoutsToday > 0, bestIntensity, bestDuration, protein, proteinTarget, streakDays);
  const pillars = getScoreBreakdown(calPct, morningPct, eveningPct, workoutsToday > 0, bestIntensity, bestDuration, protein, proteinTarget, streakDays);
  const nudge     = getDataAwareNudge(calPct, habitPct, workoutsToday > 0, medDone, calorieTarget, calories, protein, proteinTarget, workoutDaysGap);
  const allDone   = calPct >= 85 && habitPct >= 100 && workoutsToday > 0 && medDone;
  const remaining = Math.max(0, calorieTarget - calories);

  if (loading) return <DashboardSkeleton />;

  const GAP = 10;
  const PAD = 16;

  return (
    <>
      <style>{`
        @keyframes bento-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .ba { animation: bento-in 0.4s cubic-bezier(0.22,1,0.36,1) both; }
        .ba:nth-child(1) { animation-delay: 0ms; }
        .ba:nth-child(2) { animation-delay: 55ms; }
        .ba:nth-child(3) { animation-delay: 110ms; }
        .ba:nth-child(4) { animation-delay: 165ms; }
        .ba:nth-child(5) { animation-delay: 220ms; }
        .ba:nth-child(6) { animation-delay: 275ms; }
        .ba:nth-child(7) { animation-delay: 330ms; }
      `}</style>

      <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4.5rem', paddingBottom: '130px' }}>

        {/* ── Page header ── */}
        <div style={{ padding: `0 ${PAD}px 20px` }}>
          <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 12, marginTop: 4 }}>
            {dateStr}
          </p>

          {/* Score hero row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 'clamp(72px,22vw,96px)',
                fontWeight: 700,
                letterSpacing: '-0.04em',
                lineHeight: 0.88,
                color: '#fff',
                animation: scorePulsed ? 'score-pulse 0.5s ease' : undefined,
              }}>
                {score}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.011em', color: allDone ? '#fff' : 'rgba(255,255,255,0.60)' }}>
                  {allDone ? 'Perfect day' : scoreLabel(score)}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>/ 100</span>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 6, lineHeight: 1.4, maxWidth: 240 }}>
                {getScoreExplanation(calPct, habitPct, workoutsToday > 0, medDone, protein, proteinTarget, calories, calorieTarget)}
              </p>
            </div>
            <div style={{ flexShrink: 0 }}>
              <ScoreSilhouette score={score} height={130} />
            </div>
          </div>

          {/* Weekly sparkline */}
          {allScores.length >= 2 && <ScoreSparkline scores={allScores} />}

          {/* 5 pillar bars */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginTop: 18 }}>
            <Segment label="Eat"    val={Math.min(calPct, 100)}                              path="/nutrition"  delta={pillars[0]?.delta} />
            <Segment label="Move"   val={workoutsToday > 0 ? 100 : 0}                        path="/fitness"    delta={pillars[2]?.delta} />
            <Segment label="Habits" val={Math.min(habitPct, 100)}                            path="/habits"     delta={pillars[1]?.delta} />
            <Segment label="Mind"   val={medDone ? 100 : 0}                                  path="/meditation" delta={pillars[3]?.delta} />
            <Segment label="Streak" val={Math.min(Math.round((streakDays / 7) * 100), 100)} path="/"           delta={pillars[4]?.delta} />
          </div>
        </div>

        {/* ── Bento grid ── */}
        <div style={{ padding: `0 ${PAD}px`, display: 'flex', flexDirection: 'column', gap: GAP }}>

          {/* ROW A — Calories (wide) + Habits (narrow) */}
          <div className="ba" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP }}>

            {/* Calories */}
            <button
              onClick={() => router.push('/nutrition')}
              style={{
                background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)',
                padding: 18, textAlign: 'left', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                display: 'flex', flexDirection: 'column', gap: 0,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)' }}>Calories</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 8 }}>
                <span style={{ fontSize: 'clamp(36px,10vw,48px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>
                  {calories > 0 ? calories.toLocaleString() : '—'}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 3, display: 'block' }}>
                {remaining > 0 ? `${remaining} left` : 'On target'}
              </span>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginTop: 14 }}>
                <div style={{ height: '100%', width: `${Math.min(calPct, 100)}%`, background: '#fff', borderRadius: 99, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
              </div>
            </button>

            {/* Habits */}
            <button
              onClick={() => router.push('/habits')}
              style={{
                background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)',
                padding: 18, textAlign: 'left', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                display: 'flex', flexDirection: 'column', gap: 0,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)' }}>Habits</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 8 }}>
                <span style={{ fontSize: 'clamp(36px,10vw,48px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>{habitDone}</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.28)', letterSpacing: '-0.01em' }}>/{habits.length}</span>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 3, display: 'block' }}>
                {habits.length > 0 ? `${Math.round(habitPct)}% done` : 'none set'}
              </span>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 14 }}>
                {Array.from({ length: Math.min(habits.length, 7) }, (_, i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: 2, background: i < habitDone ? '#fff' : 'rgba(255,255,255,0.10)' }} />
                ))}
              </div>
            </button>
          </div>

          {/* ROW B — Move + Mind */}
          <div className="ba" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP }}>

            {/* Move */}
            <button
              onClick={() => router.push('/fitness')}
              style={{
                background: workoutsToday > 0 ? '#0f1f0f' : '#111113',
                borderRadius: 20,
                border: workoutsToday > 0 ? '1px solid rgba(120,220,100,0.14)' : '1px solid rgba(255,255,255,0.06)',
                padding: 18, textAlign: 'left', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                display: 'flex', flexDirection: 'column', gap: 0,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)' }}>Move</span>
              <span style={{ fontSize: 'clamp(36px,10vw,48px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff', marginTop: 8, display: 'block' }}>
                {workoutsToday > 0 ? workoutsToday : '—'}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 3, display: 'block' }}>
                {workoutsToday > 0 ? `workout${workoutsToday > 1 ? 's' : ''} today` : 'none logged'}
              </span>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginTop: 14 }}>
                <div style={{ height: '100%', width: workoutsToday > 0 ? '100%' : '0%', background: workoutsToday > 0 ? '#78dc64' : 'transparent', borderRadius: 99, transition: 'width 0.8s' }} />
              </div>
            </button>

            {/* Mind */}
            <button
              onClick={() => router.push('/meditation')}
              style={{
                background: medDone ? '#0f0f1f' : '#111113',
                borderRadius: 20,
                border: medDone ? '1px solid rgba(100,120,255,0.14)' : '1px solid rgba(255,255,255,0.06)',
                padding: 18, textAlign: 'left', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                display: 'flex', flexDirection: 'column', gap: 0,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)' }}>Mind</span>
              <span style={{ fontSize: 'clamp(36px,10vw,48px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff', marginTop: 8, display: 'block' }}>
                {medDone ? '✓' : '—'}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 3, display: 'block' }}>
                {medDone ? 'complete' : 'not yet'}
              </span>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginTop: 14 }}>
                <div style={{ height: '100%', width: medDone ? '100%' : '0%', background: medDone ? '#6478ff' : 'transparent', borderRadius: 99, transition: 'width 0.8s' }} />
              </div>
            </button>
          </div>

          {/* ROW C — Nudge / all done (full width) */}
          {(nudge || allDone) && (
            <div className="ba">
              <div
                onClick={() => nudge && router.push(nudge.path)}
                style={{
                  background: '#111113',
                  borderRadius: 20,
                  borderLeft: allDone ? '2px solid #78dc64' : '2px solid rgba(255,65,5,0.8)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '16px 18px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: nudge ? 'pointer' : 'default',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {allDone ? 'Perfect day ✔' : nudge?.label}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', margin: 0, lineHeight: 1.4 }}>
                    {allDone ? 'All four pillars complete' : nudge?.sub}
                  </p>
                </div>
                {nudge && !allDone && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.50)', flexShrink: 0, marginLeft: 12, whiteSpace: 'nowrap' }}>
                    {nudge.cta} →
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ROW D — Macro stats row: Protein / Carbs / Fat */}
          <div className="ba" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: GAP }}>
            {([['Protein', protein, proteinTarget, 'g'], ['Carbs', carbs, carbTarget, 'g'], ['Fat', fat, fatTarget, 'g']] as [string, number, number, string][]).map(([label, val, target, unit]) => (
              <button
                key={label}
                onClick={() => router.push('/nutrition')}
                style={{
                  background: '#111113', borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)',
                  padding: '14px 14px 12px', textAlign: 'left', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                  display: 'flex', flexDirection: 'column', gap: 0,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginTop: 6 }}>
                  <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1, color: '#fff' }}>{Math.round(val)}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>{unit}</span>
                </div>
                <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
                  <div style={{ height: '100%', width: `${target > 0 ? Math.min((val / target) * 100, 100) : 0}%`, background: 'rgba(255,255,255,0.45)', borderRadius: 99, transition: 'width 0.8s' }} />
                </div>
              </button>
            ))}
          </div>

          {/* ROW E — Score breakdown (full width) */}
          <div className="ba" style={{ background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', padding: 18 }}>
            <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', margin: '0 0 14px' }}>Score breakdown</p>
            {pillars.map((p, idx) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: idx < pillars.length - 1 ? 12 : 0, marginBottom: idx < pillars.length - 1 ? 12 : 0, borderBottom: idx < pillars.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', width: 50, flexShrink: 0 }}>{p.name}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: p.score === p.maxScore ? '#78dc64' : '#fff', width: 38, flexShrink: 0, letterSpacing: '-0.02em' }}>
                  {p.score}
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontWeight: 400 }}>/{p.maxScore}</span>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', width: `${(p.score / p.maxScore) * 100}%`, background: p.score === p.maxScore ? '#78dc64' : 'rgba(255,255,255,0.55)', borderRadius: 99, transition: 'width 0.8s' }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{p.reason}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ROW F — Daily habits */}
          {habits.length > 0 && (() => {
            const morningHabits = habits.filter(h => h.routine === 'morning');
            const eveningHabits = habits.filter(h => h.routine === 'evening');
            const otherHabits = habits.filter(h => h.routine !== 'morning' && h.routine !== 'evening');
            const renderHabitRow = (h: typeof habits[0]) => (
              <button
                key={h.id}
                onClick={() => toggle(h.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '11px 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer', textAlign: 'left',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: h.done ? '#fff' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {h.done && <span style={{ fontSize: 10, color: '#000', fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{
                  flex: 1, fontSize: 14, fontWeight: 500, letterSpacing: '-0.011em',
                  color: h.done ? 'rgba(255,255,255,0.30)' : '#fff',
                  textDecoration: h.done ? 'line-through' : 'none',
                  transition: 'color 0.2s',
                }}>
                  {h.name}
                </span>
                {h.streak > 1 && (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', flexShrink: 0 }}>{h.streak}d</span>
                )}
              </button>
            );
            const renderBlockHeader = (icon: string, label: string, group: typeof habits) => {
              const done = group.filter(h => h.done).length;
              const allGroupDone = group.length > 0 && done === group.length;
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 2px' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.40)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>{icon} {label}</span>
                  <span style={{ fontSize: 11, color: allGroupDone ? '#78dc64' : 'rgba(255,255,255,0.30)' }}>{done}/{group.length}</span>
                </div>
              );
            };
            const hasSections = morningHabits.length > 0 || eveningHabits.length > 0;
            return (
              <div className="ba" style={{ background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', margin: 0 }}>Daily habits</p>
                  <button
                    onClick={() => router.push('/habits')}
                    style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.40)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Manage →
                  </button>
                </div>
                {hasSections ? (
                  <>
                    {morningHabits.length > 0 && (
                      <div style={{ marginBottom: eveningHabits.length > 0 ? 12 : 0 }}>
                        {renderBlockHeader('☀️', 'Morning', morningHabits)}
                        {morningHabits.map(renderHabitRow)}
                      </div>
                    )}
                    {eveningHabits.length > 0 && (
                      <div>
                        {renderBlockHeader('🌙', 'Evening', eveningHabits)}
                        {eveningHabits.map(renderHabitRow)}
                      </div>
                    )}
                    {otherHabits.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        {otherHabits.map(renderHabitRow)}
                      </div>
                    )}
                  </>
                ) : habits.map(renderHabitRow)}
              </div>
            );
          })()}

          {/* ROW G — Apple Health */}
          {healthData && healthData.available && (
            <div className="ba" style={{ background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', padding: 18 }}>
              <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', margin: '0 0 16px' }}>Apple Health</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                {healthData.steps > 0 && (
                  <div>
                    <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: '#fff', margin: 0, lineHeight: 1 }}>{healthData.steps.toLocaleString()}</p>
                    <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginTop: 5 }}>Steps</p>
                  </div>
                )}
                {healthData.heartRate > 0 && (
                  <div>
                    <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: '#fff', margin: 0, lineHeight: 1 }}>{healthData.heartRate}</p>
                    <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginTop: 5 }}>BPM</p>
                  </div>
                )}
                {healthData.hrv > 0 && (
                  <div>
                    <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: '#fff', margin: 0, lineHeight: 1 }}>{Math.round(healthData.hrv)}</p>
                    <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginTop: 5 }}>HRV ms</p>
                  </div>
                )}
                {healthData.sleepHours > 0 && (
                  <div>
                    <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: '#fff', margin: 0, lineHeight: 1 }}>
                      {healthData.sleepHours}h{healthData.sleepMinutes > 0 ? `${healthData.sleepMinutes}m` : ''}
                    </p>
                    <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginTop: 5 }}>Sleep</p>
                  </div>
                )}
                {healthData.activeCalories > 0 && (
                  <div>
                    <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: '#fff', margin: 0, lineHeight: 1 }}>{healthData.activeCalories}</p>
                    <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginTop: 5 }}>Active kcal</p>
                  </div>
                )}
                {healthData.weight > 0 && (
                  <div>
                    <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: '#fff', margin: 0, lineHeight: 1 }}>{healthData.weight}</p>
                    <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginTop: 5 }}>kg</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ROW H — Suggested meditation */}
          {suggested && !medDone && (
            <div className="ba" style={{ background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div
                  style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
                  onClick={() => router.push(`/meditation/${suggested.id}`)}
                >
                  <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', margin: '0 0 8px' }}>Suggested</p>
                  <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', margin: '0 0 4px' }}>{suggested.name}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{suggested.category} · {suggested.duration_min} min</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); haptic('light'); router.push(`/meditation/${suggested.id}`); }}
                  style={{
                    background: '#fff', color: '#000', border: 'none',
                    borderRadius: 99, padding: '8px 16px',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    flexShrink: 0, marginLeft: 12, letterSpacing: '-0.01em',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  Start
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <QuickLogSheet open={quickLog} onClose={() => setQuickLog(false)} onLogged={() => load()} />
    </>
  );
}
