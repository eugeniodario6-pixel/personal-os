'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import {
  getHabits, getHabitStreaks, getDailyScores, getWeightHistory,
  getWorkoutHistory, getMeditationSessions, getLiftHistory, getMoodLogs,
  type DailyScore, type WeightEntry, type LiftHistory, type MoodEntry,
} from '@/lib/db';
import { supabase } from '@/lib/supabase';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DayHabit { date: string; done: number; total: number }
interface MedDay   { date: string; mins: number; sessions: number }
interface WorkDay  { date: string; sessions: number; minutes: number }

type Period = '7' | '30';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function isoRange(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

function shortLabel(iso: string, period: Period): string {
  const d = new Date(iso + 'T00:00:00');
  if (period === '7') return d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 1);
  if (d.getDate() === 1 || d.getDate() % 7 === 1) return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  return '';
}

const LIME   = '#1F58F2';
const DIM    = 'rgba(255,255,255,0.06)';
const TEXT3  = 'rgba(255,255,255,0.28)';
const TEXT2  = 'rgba(255,255,255,0.55)';

// ─── Mini bar chart ─────────────────────────────────────────────────────────────
function BarChart({
  data, max, color = LIME, height = 80, period, unit = '',
}: {
  data: { label: string; value: number }[];
  max: number;
  color?: string;
  height?: number;
  period: Period;
  unit?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const safeMax = max || 1;
  return (
    <div style={{ position: 'relative' }}>
      {hovered !== null && (
        <div style={{ position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)', background: '#1C1C1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 8px', fontSize: '0.7rem', color: '#fff', whiteSpace: 'nowrap', zIndex: 10 }}>
          {data[hovered]?.value}{unit}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: period === '30' ? 2 : 4, height }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <div style={{
              width: '100%', borderRadius: 3,
              background: d.value > 0 ? (hovered === i ? '#fff' : color) : DIM,
              height: d.value > 0 ? `${Math.max(4, Math.round((d.value / safeMax) * height))}px` : '3px',
              transition: 'background 0.15s, height 0.3s',
              cursor: 'default',
            }} />
          </div>
        ))}
      </div>
      {/* X labels */}
      <div style={{ display: 'flex', gap: period === '30' ? 2 : 4, marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.5rem', color: TEXT3, fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Habit dot grid (GitHub-style) ─────────────────────────────────────────────
function HabitGrid({ data, period }: { data: DayHabit[]; period: Period }) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div>
      <div style={{ display: 'flex', gap: period === '30' ? 2 : 4, flexWrap: 'nowrap', overflowX: 'auto' }}>
        {data.map((d, i) => {
          const pct = d.total > 0 ? d.done / d.total : 0;
          const opacity = pct === 0 ? 0 : pct < 0.5 ? 0.3 : pct < 1 ? 0.65 : 1;
          const size = period === '30' ? 10 : 20;
          return (
            <div key={i} style={{ flex: '0 0 auto', position: 'relative' }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              {hovered === i && (
                <div style={{ position: 'absolute', bottom: size + 4, left: '50%', transform: 'translateX(-50%)', background: '#1C1C1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 8px', fontSize: '0.65rem', color: '#fff', whiteSpace: 'nowrap', zIndex: 10 }}>
                  {d.done}/{d.total}
                </div>
              )}
              <div style={{
                width: size, height: size, borderRadius: period === '30' ? 2 : 5,
                background: pct > 0 ? LIME : DIM,
                opacity: pct > 0 ? opacity : 1,
                transition: 'opacity 0.15s',
                cursor: 'default',
              }} />
            </div>
          );
        })}
      </div>
      {/* Day labels */}
      <div style={{ display: 'flex', gap: period === '30' ? 2 : 4, marginTop: 6, overflowX: 'hidden' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: '0 0 auto', width: period === '30' ? 10 : 20, textAlign: 'center', fontSize: '0.45rem', color: TEXT3, fontFamily: 'var(--font-mono)' }}>
            {shortLabel(d.date, period)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ values, color = LIME, height = 48 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return null;
  const min  = Math.min(...values);
  const max  = Math.max(...values);
  const range = max - min || 1;
  const w = 100, h = height;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts} />
      <polygon fill="url(#sg)" points={`0,${h} ${pts} ${w},${h}`} />
    </svg>
  );
}

// ─── Section card ───────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#141616', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--r)', padding: '18px 18px 14px', ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ icon, title, value, sub }: { icon: string; title: string; value?: string | number; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, color: TEXT2 }}>{icon}</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 510, color: '#fff', letterSpacing: '-0.011em' }}>{title}</span>
      </div>
      {value !== undefined && (
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 510, color: LIME, letterSpacing: '-0.011em' }}>{value}</span>
          {sub && <span style={{ fontSize: '0.55rem', color: TEXT3, marginLeft: 4, fontFamily: 'var(--font-mono)' }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: '0.75rem', color: TEXT3 }}>{label}</span>
      <span style={{ fontSize: '0.8rem', fontWeight: 510, color: color ?? '#fff', letterSpacing: '-0.011em' }}>{value}</span>
    </div>
  );
}

// ─── Apple Health card ────────────────────────────────────────────────────────
function HealthCard() {
  const [hk, setHk] = useState<any>(null);
  useEffect(() => {
    const handler = (e: Event) => setHk((e as CustomEvent).detail);
    window.addEventListener('healthkit-data', handler);
    const cached = (window as any).__healthKitData;
    if (cached?.available) setHk(cached);
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      const d = (window as any).__healthKitData;
      if (d?.available) { setHk(d); clearInterval(poll); }
      if (attempts >= 6) clearInterval(poll);
    }, 2000);
    return () => { window.removeEventListener('healthkit-data', handler); clearInterval(poll); };
  }, []);

  if (!hk) return (
    <Card>
      <SectionLabel icon="♥" title="Apple Health" />
      <p style={{ fontSize: '0.75rem', color: TEXT3, margin: 0 }}>Reading from Apple Health…</p>
    </Card>
  );
  if (!hk.available) return null;
  return (
    <Card>
      <SectionLabel icon="♥" title="Apple Health" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {hk.steps > 0 && (
          <div>
            <p style={{ fontSize: 22, fontWeight: 510, letterSpacing: '-0.022em', color: '#fff', margin: 0, lineHeight: 1 }}>{hk.steps.toLocaleString()}</p>
            <p style={{ fontSize: '0.6rem', color: TEXT3, margin: '4px 0 0', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>STEPS</p>
          </div>
        )}
        {hk.heartRate > 0 && (
          <div>
            <p style={{ fontSize: 22, fontWeight: 510, letterSpacing: '-0.022em', color: '#FF8B8B', margin: 0, lineHeight: 1 }}>{hk.heartRate}</p>
            <p style={{ fontSize: '0.6rem', color: TEXT3, margin: '4px 0 0', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>BPM</p>
          </div>
        )}
        {hk.hrv > 0 && (
          <div>
            <p style={{ fontSize: 22, fontWeight: 510, letterSpacing: '-0.022em', color: '#8B8BFF', margin: 0, lineHeight: 1 }}>{Math.round(hk.hrv)}</p>
            <p style={{ fontSize: '0.6rem', color: TEXT3, margin: '4px 0 0', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>HRV ms</p>
          </div>
        )}
        {hk.sleepHours > 0 && (
          <div>
            <p style={{ fontSize: 22, fontWeight: 510, letterSpacing: '-0.022em', color: '#FFB86B', margin: 0, lineHeight: 1 }}>{hk.sleepHours}h{hk.sleepMinutes > 0 ? `${hk.sleepMinutes}m` : ''}</p>
            <p style={{ fontSize: '0.6rem', color: TEXT3, margin: '4px 0 0', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>SLEEP</p>
          </div>
        )}
        {hk.activeCalories > 0 && (
          <div>
            <p style={{ fontSize: 22, fontWeight: 510, letterSpacing: '-0.022em', color: LIME, margin: 0, lineHeight: 1 }}>{hk.activeCalories}</p>
            <p style={{ fontSize: '0.6rem', color: TEXT3, margin: '4px 0 0', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>KCAL</p>
          </div>
        )}
        {hk.weight > 0 && (
          <div>
            <p style={{ fontSize: 22, fontWeight: 510, letterSpacing: '-0.022em', color: '#fff', margin: 0, lineHeight: 1 }}>{hk.weight}</p>
            <p style={{ fontSize: '0.6rem', color: TEXT3, margin: '4px 0 0', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>KG</p>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function ProgressPage() {
  const [period, setPeriod] = useState<Period>('7');
  const [loading, setLoading] = useState(true);

  // Nutrition
  const [scores, setScores] = useState<DailyScore[]>([]);

  // Habits
  const [habitDays, setHabitDays]     = useState<DayHabit[]>([]);
  const [habitNames, setHabitNames]   = useState<{ name: string; streak: number; id: number }[]>([]);

  // Weight
  const [weights, setWeights] = useState<WeightEntry[]>([]);

  // Workouts
  const [workoutDays, setWorkoutDays] = useState<WorkDay[]>([]);

  // Meditation
  const [medDays, setMedDays] = useState<MedDay[]>([]);

  // Mood
  const [moodLogs, setMoodLogs] = useState<MoodEntry[]>([]);

  // Strength / lift history
  const [liftHistory, setLiftHistory] = useState<LiftHistory[]>([]);
  const [activeLift, setActiveLift] = useState<string>('Back Squat');

  const load = useCallback(async () => {
    setLoading(true);
    const days = parseInt(period);
    const dates = isoRange(days);

    try {
      const MAIN_LIFTS = ['Back Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Barbell Row'];

      const [
        scoresData, habitsData, weightsData, workoutsData, liftData, moodData,
      ] = await Promise.all([
        getDailyScores(days),
        getHabits(),
        getWeightHistory(days),
        getWorkoutHistory(days),
        getLiftHistory(MAIN_LIFTS, Math.ceil(days / 7) + 1),
        getMoodLogs(days),
      ]);

      setMoodLogs(moodData);

      setLiftHistory(liftData);

      // ── Scores / Nutrition
      setScores(scoresData);

      // ── Weights
      setWeights(weightsData);

      // ── Workout days
      const wdMap = new Map<string, { sessions: number; minutes: number }>();
      for (const w of workoutsData) {
        const d = w.date;
        const cur = wdMap.get(d) ?? { sessions: 0, minutes: 0 };
        wdMap.set(d, { sessions: cur.sessions + 1, minutes: cur.minutes + (w.duration_min ?? 0) });
      }
      setWorkoutDays(dates.map(d => ({ date: d, ...( wdMap.get(d) ?? { sessions: 0, minutes: 0 }) })));

      // ── Habits per day — batch query
      const activeHabits = habitsData.filter(h => h.active);
      const streaks = await getHabitStreaks(activeHabits.map(h => h.id));
      setHabitNames(activeHabits.map(h => ({ name: h.name, streak: streaks.get(h.id) ?? 0, id: h.id })).sort((a, b) => b.streak - a.streak));

      if (activeHabits.length > 0) {
        const { data: compData } = await supabase
          .from('habit_completion')
          .select('habit_id, date, completed_at')
          .in('habit_id', activeHabits.map(h => h.id))
          .gte('date', dates[0])
          .lte('date', dates[dates.length - 1]);

        const compByDate = new Map<string, Set<number>>();
        for (const c of compData ?? []) {
          if (!c.completed_at) continue;
          if (!compByDate.has(c.date)) compByDate.set(c.date, new Set());
          compByDate.get(c.date)!.add(c.habit_id);
        }
        setHabitDays(dates.map(d => ({
          date: d,
          done: compByDate.get(d)?.size ?? 0,
          total: activeHabits.length,
        })));
      }

      // ── Meditation — batch query
      const { data: medData } = await supabase
        .from('meditation_log')
        .select('date, duration_actual_min, completed')
        .gte('date', dates[0])
        .lte('date', dates[dates.length - 1]);

      const medMap = new Map<string, { mins: number; sessions: number }>();
      for (const m of medData ?? []) {
        const cur = medMap.get(m.date) ?? { mins: 0, sessions: 0 };
        medMap.set(m.date, { mins: cur.mins + (m.duration_actual_min ?? 0), sessions: cur.sessions + 1 });
      }
      setMedDays(dates.map(d => ({ date: d, ...( medMap.get(d) ?? { mins: 0, sessions: 0 }) })));

    } catch (e) {
      console.error('Progress load failed', e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const days = parseInt(period);
  const dates = isoRange(days);

  // ── Derived: Nutrition ─────────────────────────────────────────────────────
  const scoreMap = new Map(scores.map(s => [s.date, s]));
  const scoreData = dates.map(d => ({ label: shortLabel(d, period), value: scoreMap.get(d)?.total_score ?? 0 }));
  const calData   = dates.map(d => ({ label: shortLabel(d, period), value: scoreMap.get(d)?.calories_actual ?? 0 }));
  const protData  = dates.map(d => ({ label: shortLabel(d, period), value: Math.round(scoreMap.get(d)?.protein_actual ?? 0) }));
  const avgScore  = scores.length ? Math.round(scores.reduce((s, d) => s + d.total_score, 0) / scores.length) : 0;
  const avgCal    = scores.length ? Math.round(scores.reduce((s, d) => s + d.calories_actual, 0) / scores.length) : 0;
  const avgProt   = scores.length ? Math.round(scores.reduce((s, d) => s + d.protein_actual, 0) / scores.length) : 0;

  // ── Derived: Habits ────────────────────────────────────────────────────────
  const totalHabitDone = habitDays.reduce((s, d) => s + d.done, 0);
  const totalHabitPoss = habitDays.reduce((s, d) => s + d.total, 0);
  const habitPct = totalHabitPoss > 0 ? Math.round((totalHabitDone / totalHabitPoss) * 100) : 0;
  const bestStreak = habitNames[0]?.streak ?? 0;

  // ── Derived: Movement ──────────────────────────────────────────────────────
  const workoutData  = workoutDays.map(d => ({ label: shortLabel(d.date, period), value: d.sessions }));
  const totalWorkouts = workoutDays.reduce((s, d) => s + d.sessions, 0);
  const totalMins    = workoutDays.reduce((s, d) => s + d.minutes, 0);
  const workDays     = workoutDays.filter(d => d.sessions > 0).length;

  // ── Derived: Weight ────────────────────────────────────────────────────────
  const sortedWeights = [...weights].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  const weightValues  = sortedWeights.map(w => w.weight_kg);
  const currentWeight = sortedWeights[sortedWeights.length - 1]?.weight_kg ?? null;
  const firstWeight   = sortedWeights[0]?.weight_kg ?? null;
  const weightDelta   = currentWeight && firstWeight ? Math.round((currentWeight - firstWeight) * 10) / 10 : null;

  // ── Derived: Meditation ────────────────────────────────────────────────────
  const medData2     = medDays.map(d => ({ label: shortLabel(d.date, period), value: d.mins }));
  const totalMedSess = medDays.reduce((s, d) => s + d.sessions, 0);
  const totalMedMins = medDays.reduce((s, d) => s + d.mins, 0);
  const medDaysCount = medDays.filter(d => d.sessions > 0).length;
  const medConsistency = Math.round((medDaysCount / days) * 100);

  // ── Derived: Mood ─────────────────────────────────────────────────────────
  // Build per-day average mood (post_meditation only, for trend)
  const moodByDate = new Map<string, { sum: number; count: number }>();
  const stressByDate = new Map<string, { sum: number; count: number }>();
  let sessionsImproved = 0;
  let sessionsPaired = 0;

  // Group logs by date and context for delta computation
  const moodByDateContext = new Map<string, { pre: number | null; post: number | null }>();
  for (const m of moodLogs) {
    const key = m.date;
    if (!moodByDateContext.has(key)) moodByDateContext.set(key, { pre: null, post: null });
    const entry = moodByDateContext.get(key)!;
    if (m.context === 'pre_meditation' && entry.pre === null) entry.pre = m.mood;
    if (m.context === 'post_meditation' && entry.post === null) entry.post = m.mood;
  }
  for (const { pre, post } of moodByDateContext.values()) {
    if (pre !== null && post !== null) {
      sessionsPaired++;
      if (post > pre) sessionsImproved++;
    }
  }

  for (const m of moodLogs) {
    if (m.context === 'post_meditation') {
      const d = moodByDate.get(m.date) ?? { sum: 0, count: 0 };
      moodByDate.set(m.date, { sum: d.sum + m.mood, count: d.count + 1 });
    }
    if (m.stress != null) {
      const d = stressByDate.get(m.date) ?? { sum: 0, count: 0 };
      stressByDate.set(m.date, { sum: d.sum + m.stress, count: d.count + 1 });
    }
  }

  const moodSparkValues = dates
    .map(d => {
      const e = moodByDate.get(d);
      return e ? e.sum / e.count : 0;
    });
  const hasMoodData = moodSparkValues.some(v => v > 0);
  const avgMoodAll = moodLogs.filter(m => m.context === 'post_meditation');
  const avgMood = avgMoodAll.length > 0
    ? Math.round((avgMoodAll.reduce((s, m) => s + m.mood, 0) / avgMoodAll.length) * 10) / 10
    : null;
  const stressLogs = moodLogs.filter(m => m.stress != null);
  const avgStress = stressLogs.length > 0
    ? Math.round((stressLogs.reduce((s, m) => s + (m.stress ?? 0), 0) / stressLogs.length) * 10) / 10
    : null;
  const improvedPct = sessionsPaired > 0 ? Math.round((sessionsImproved / sessionsPaired) * 100) : null;
  const MOOD_EMOJI = ['😔','😕','😐','🙂','😊'];

  // ── Derived: Strength ─────────────────────────────────────────────────────
  const MAIN_LIFTS = ['Back Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Barbell Row'];
  const LIFT_LABELS: Record<string, string> = {
    'Back Squat': 'Squat', 'Bench Press': 'Bench', 'Deadlift': 'Deadlift',
    'Overhead Press': 'OHP', 'Barbell Row': 'Row',
  };

  const currentLiftRows = liftHistory.filter(r => r.exercise_name === activeLift);
  const liftSparkValues = currentLiftRows.map(r => r.best_weight);
  const currentLiftBest = currentLiftRows.length > 0 ? currentLiftRows[currentLiftRows.length - 1].best_weight : null;
  const startingLiftWeight = currentLiftRows.length > 0 ? currentLiftRows[0].best_weight : null;
  const liftImproveKg = currentLiftBest !== null && startingLiftWeight !== null ? Math.round((currentLiftBest - startingLiftWeight) * 10) / 10 : null;
  const liftImprovePct = liftImproveKg !== null && startingLiftWeight !== null && startingLiftWeight > 0 ? Math.round((liftImproveKg / startingLiftWeight) * 100) : null;

  // Weekly volume bars — group by ISO week
  const weeklyVolumeMap = new Map<string, number>();
  for (const row of currentLiftRows) {
    const d = new Date(row.date + 'T00:00:00');
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1);
    const wk = weekStart.toISOString().slice(0, 10);
    weeklyVolumeMap.set(wk, (weeklyVolumeMap.get(wk) ?? 0) + row.volume);
  }
  const weeklyVolumeEntries = [...weeklyVolumeMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  const volumeBarData = weeklyVolumeEntries.map(([wk, vol]) => ({
    label: new Date(wk + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    value: Math.round(vol),
  }));
  const maxVolume = volumeBarData.length > 0 ? Math.max(...volumeBarData.map(d => d.value)) : 1;

  return (
    <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4rem', paddingBottom: '9rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '24px 20px 0' }}>
        <p style={{ margin: '0 0 4px', fontSize: '0.6rem', letterSpacing: '0.1em', color: TEXT3, fontFamily: 'var(--font-mono)' }}>OVERVIEW</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 510, letterSpacing: '-0.022em', color: '#fff', lineHeight: 1.1 }}>Progress</h1>
          {/* Period toggle */}
          <div style={{ display: 'flex', background: '#141616', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 99, padding: 3, gap: 2 }}>
            {(['7', '30'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ padding: '5px 14px', borderRadius: 99, border: 'none', background: period === p ? '#fff' : 'transparent', color: period === p ? '#000' : TEXT3, fontSize: '0.7rem', fontWeight: period === p ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '-0.01em', transition: 'all 0.15s' }}>
                {p}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[120, 160, 140, 120, 140].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 'var(--r)', background: '#111', opacity: 0.5 - i * 0.07 }} />
          ))}
        </div>
      ) : (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── APPLE HEALTH ── */}
          <HealthCard />

          {/* ── EATING ── */}
          <Card>
            <SectionLabel icon="◎" title="Eating" value={avgScore} sub="avg score" />
            <BarChart data={scoreData} max={100} color={LIME} height={72} period={period} unit="/100" />
            <div style={{ marginTop: 14 }}>
              <StatRow label="Avg daily score" value={`${avgScore}/100`} color={avgScore >= 75 ? LIME : avgScore >= 50 ? '#fff' : TEXT2} />
              <StatRow label="Avg calories" value={`${avgCal} kcal`} />
              <StatRow label="Avg protein" value={`${avgProt}g`} />
            </div>
            {/* Protein sparkline */}
            {protData.some(d => d.value > 0) && (
              <div style={{ marginTop: 14 }}>
                <p style={{ margin: '0 0 6px', fontSize: '0.55rem', color: TEXT3, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>PROTEIN TREND</p>
                <Sparkline values={protData.map(d => d.value)} color="#8B8BFF" height={36} />
              </div>
            )}
          </Card>

          {/* ── HABITS ── */}
          <Card>
            <SectionLabel icon="✦" title="Habits" value={`${habitPct}%`} sub="completion" />
            <HabitGrid data={habitDays} period={period} />
            <div style={{ marginTop: 14 }}>
              <StatRow label="Completed" value={`${totalHabitDone} / ${totalHabitPoss}`} />
              <StatRow label="Best streak" value={`${bestStreak}d`} color={bestStreak >= 7 ? LIME : '#fff'} />
            </div>
            {/* Streak leaderboard */}
            {habitNames.slice(0, 5).map((h, i) => (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < Math.min(habitNames.length, 5) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.6rem', color: TEXT3, fontFamily: 'var(--font-mono)', width: 14 }}>{i + 1}</span>
                  <span style={{ fontSize: '0.8rem', color: TEXT2 }}>{h.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Streak fire */}
                  <div style={{ height: 6, width: Math.max(6, Math.min(80, h.streak * 3)), background: h.streak > 0 ? LIME : DIM, borderRadius: 3, opacity: h.streak > 0 ? 0.8 : 1 }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 510, color: h.streak >= 7 ? LIME : '#fff', minWidth: 28, textAlign: 'right' }}>{h.streak}d</span>
                </div>
              </div>
            ))}
          </Card>

          {/* ── MOVEMENT ── */}
          <Card>
            <SectionLabel icon="△" title="Movement" value={totalWorkouts} sub={`session${totalWorkouts !== 1 ? 's' : ''}`} />
            <BarChart data={workoutData} max={Math.max(1, ...workoutDays.map(d => d.sessions))} color="#8B8BFF" height={72} period={period} unit=" sessions" />
            <div style={{ marginTop: 14 }}>
              <StatRow label="Active days" value={`${workDays} / ${days}`} color={workDays >= days * 0.6 ? LIME : '#fff'} />
              <StatRow label="Total time" value={totalMins >= 60 ? `${Math.round(totalMins / 60)}h ${totalMins % 60}m` : `${totalMins}m`} />
              <StatRow label="Frequency" value={`${Math.round((workDays / days) * 7 * 10) / 10}× / wk`} />
            </div>
          </Card>

          {/* ── STRENGTH ── */}
          <Card>
            <SectionLabel icon="▲" title="Strength" value={currentLiftBest ? `${currentLiftBest}kg` : '—'} sub={activeLift} />

            {/* Lift tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
              {MAIN_LIFTS.map(lift => (
                <button key={lift} onClick={() => setActiveLift(lift)} style={{
                  padding: '4px 10px', borderRadius: 99, border: 'none', fontSize: '0.65rem', fontWeight: activeLift === lift ? 700 : 400,
                  background: activeLift === lift ? LIME : 'rgba(255,255,255,0.06)',
                  color: activeLift === lift ? '#000' : TEXT3,
                  cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '-0.01em', transition: 'all 0.15s',
                }}>
                  {LIFT_LABELS[lift]}
                </button>
              ))}
            </div>

            {/* Best weight sparkline */}
            {liftSparkValues.length >= 2 ? (
              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: '0 0 6px', fontSize: '0.55rem', color: TEXT3, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>BEST WEIGHT TREND (kg)</p>
                <Sparkline values={liftSparkValues} color="#FFB86B" height={52} />
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: TEXT3, margin: '0 0 14px' }}>No {activeLift} data in this period. Log a strength session to see your progress.</p>
            )}

            {/* Key stats */}
            <div style={{ marginBottom: 14 }}>
              <StatRow label="Current best" value={currentLiftBest ? `${currentLiftBest}kg` : '—'} color={LIME} />
              <StatRow label="Starting weight" value={startingLiftWeight ? `${startingLiftWeight}kg` : '—'} />
              <StatRow
                label="Total improvement"
                value={liftImproveKg !== null ? `${liftImproveKg > 0 ? '+' : ''}${liftImproveKg}kg${liftImprovePct !== null ? ` (${liftImprovePct > 0 ? '+' : ''}${liftImprovePct}%)` : ''}` : '—'}
                color={liftImproveKg !== null && liftImproveKg > 0 ? LIME : liftImproveKg !== null && liftImproveKg < 0 ? '#FF8B8B' : '#fff'}
              />
              <StatRow label="Sessions logged" value={currentLiftRows.length} />
            </div>

            {/* Weekly volume bar chart */}
            {volumeBarData.length > 0 && (
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '0.55rem', color: TEXT3, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>WEEKLY VOLUME (kg × reps)</p>
                <BarChart data={volumeBarData} max={maxVolume} color="#8B8BFF" height={56} period="30" unit="kg" />
              </div>
            )}
          </Card>

          {/* ── MIND ── */}
          <Card>
            <SectionLabel icon="◉" title="Mind" value={`${medConsistency}%`} sub="consistency" />
            <BarChart data={medData2} max={Math.max(30, ...medDays.map(d => d.mins))} color="#FF8B8B" height={72} period={period} unit="m" />
            <div style={{ marginTop: 14 }}>
              <StatRow label="Sessions" value={totalMedSess} />
              <StatRow label="Total time" value={`${totalMedMins}m`} />
              <StatRow label="Active days" value={`${medDaysCount} / ${days}`} color={medDaysCount >= days * 0.5 ? LIME : '#fff'} />
            </div>
          </Card>

          {/* ── MOOD ── */}
          <Card>
            <SectionLabel
              icon="◌"
              title="Mood"
              value={avgMood !== null ? `${MOOD_EMOJI[Math.round(avgMood) - 1] ?? ''} ${avgMood}` : undefined}
              sub={avgMood !== null ? 'avg' : undefined}
            />
            {!hasMoodData ? (
              <p style={{ fontSize: '0.78rem', color: TEXT3, margin: 0, lineHeight: 1.6 }}>
                Complete a meditation session to start tracking mood
              </p>
            ) : (
              <>
                <div style={{ marginBottom: 8 }}>
                  <p style={{ margin: '0 0 6px', fontSize: '0.55rem', color: TEXT3, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>POST-SESSION MOOD TREND</p>
                  <Sparkline values={moodSparkValues} color="#FF8B8B" height={48} />
                </div>
                <div style={{ marginTop: 14 }}>
                  {avgMood !== null && (
                    <StatRow
                      label="Avg post-session mood"
                      value={`${MOOD_EMOJI[Math.round(avgMood) - 1] ?? ''} ${avgMood} / 5`}
                      color="#FF8B8B"
                    />
                  )}
                  {avgStress !== null && (
                    <StatRow label="Avg stress" value={`${avgStress} / 5`} />
                  )}
                  {improvedPct !== null && (
                    <StatRow
                      label="Sessions where mood improved"
                      value={`${sessionsImproved} / ${sessionsPaired} (${improvedPct}%)`}
                      color={improvedPct >= 60 ? LIME : '#fff'}
                    />
                  )}
                </div>
              </>
            )}
          </Card>

          {/* ── BODY ── */}
          {weights.length > 0 && (
            <Card>
              <SectionLabel
                icon="⊕"
                title="Body"
                value={currentWeight ? `${currentWeight}kg` : '—'}
                sub={weightDelta !== null ? `${weightDelta > 0 ? '+' : ''}${weightDelta}kg` : undefined}
              />
              {weightValues.length >= 2 ? (
                <Sparkline values={weightValues} color="#FFB86B" height={52} />
              ) : (
                <p style={{ fontSize: '0.8rem', color: TEXT3, margin: 0 }}>Log more weight entries to see your trend.</p>
              )}
              <div style={{ marginTop: 14 }}>
                <StatRow label="Entries" value={weights.length} />
                {weightDelta !== null && <StatRow label={`${days}d change`} value={`${weightDelta > 0 ? '+' : ''}${weightDelta}kg`} color={weightDelta <= 0 ? LIME : TEXT2} />}
                {weightValues.length > 0 && <StatRow label="Range" value={`${Math.min(...weightValues)}–${Math.max(...weightValues)}kg`} />}
              </div>
            </Card>
          )}

          {/* ── SCORE HISTORY ── */}
          {scores.length > 0 && (
            <Card>
              <SectionLabel icon="◈" title="Daily Score" value={avgScore} sub="avg" />
              <Sparkline values={[...scores].reverse().map(s => s.total_score)} color={LIME} height={52} />
              <div style={{ marginTop: 14 }}>
                <StatRow label="Best" value={`${Math.max(...scores.map(s => s.total_score))}/100`} color={LIME} />
                <StatRow label="Worst" value={`${Math.min(...scores.map(s => s.total_score))}/100`} />
                <StatRow label="Days tracked" value={scores.length} />
              </div>
            </Card>
          )}

        </div>
      )}
    </div>
  );
}
