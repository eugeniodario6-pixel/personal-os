'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getHabits, getHabitCompletions, getHabitStreak,
  getWorkoutLogs, getMeditationLogs,
  type Habit, type WorkoutLog, type MeditationLog,
} from '@/lib/db';
import { calcDailyScore } from '@/lib/score';
import { hapticSuccess } from '@/lib/haptic';
import StreakBadge from '@/components/StreakBadge';

const MONO = "'IBM Plex Mono', monospace";
const border2 = '2px solid #444';
const lbl = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#888', margin: 0 };

interface DayData {
  iso: string;
  dayInit: string;
  habitDone: number;
  habitTotal: number;
  hadWorkout: boolean;
  hadMed: boolean;
  score: number;
}

interface HabitWithStreak extends Habit {
  streak: number;
}

function getLast7Days(): { iso: string; dayInit: string }[] {
  const days = [];
  const DAY_INITS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dayInit = DAY_INITS[d.getDay()];
    days.push({ iso, dayInit });
  }
  return days;
}

function getWeekRange(days: { iso: string }[]): string {
  if (days.length === 0) return '';
  const fmt = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
  };
  return `${fmt(days[0].iso)} – ${fmt(days[days.length - 1].iso)}`;
}

export default function WeekPage() {
  const [days, setDays] = useState<DayData[]>([]);
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);
  const [weekWorkouts, setWeekWorkouts] = useState<WorkoutLog[]>([]);
  const [weekMeds, setWeekMeds] = useState<MeditationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const daySlots = getLast7Days();
      const allHabits = await getHabits();

      // Load streaks
      const habitsWithStreak: HabitWithStreak[] = await Promise.all(
        allHabits.map(async h => ({ ...h, streak: await getHabitStreak(h.id) }))
      );
      setHabits(habitsWithStreak);

      // Load per-day data
      const allWorkouts: WorkoutLog[] = [];
      const allMeds: MeditationLog[] = [];

      const dayData: DayData[] = await Promise.all(daySlots.map(async ({ iso, dayInit }) => {
        const [completions, workouts, meds] = await Promise.all([
          getHabitCompletions(iso),
          getWorkoutLogs(iso),
          getMeditationLogs(iso),
        ]);
        const completedIds = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
        const habitDone = allHabits.filter(h => completedIds.has(h.id)).length;
        const habitTotal = allHabits.length;
        const hadWorkout = workouts.length > 0;
        const hadMed = meds.some(m => m.completed);
        const score = calcDailyScore({
          calorieTarget: 2000,
          calories: 0, // skip calories in weekly
          habitDone,
          habitTotal,
          workoutsToday: workouts.length,
          medDone: hadMed,
        });
        allWorkouts.push(...workouts);
        allMeds.push(...meds);
        return { iso, dayInit, habitDone, habitTotal, hadWorkout, hadMed, score };
      }));

      setDays(dayData);
      setWeekWorkouts(allWorkouts);
      setWeekMeds(allMeds.filter(m => m.completed));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const weeklyAvgScore = days.length > 0
    ? Math.round(days.reduce((sum, d) => sum + d.score, 0) / days.length)
    : 0;

  const totalWorkoutMins = weekWorkouts.reduce((s, w) => s + (w.duration_min ?? 0), 0);

  const habitsPct = days.length > 0
    ? Math.round(
        days.reduce((sum, d) => sum + (d.habitTotal > 0 ? (d.habitDone / d.habitTotal) * 100 : 0), 0) / days.length
      )
    : 0;

  const weekRange = getWeekRange(getLast7Days());

  const topHabits = [...habits].sort((a, b) => b.streak - a.streak).slice(0, 3);

  const handleShare = async () => {
    hapticSuccess();
    const now = new Date();
    const weekNum = Math.ceil((((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7);
    const text = `Week ${weekNum}: Score ${weeklyAvgScore}/100. ${weekWorkouts.length} workout${weekWorkouts.length !== 1 ? 's' : ''}. ${habitsPct}% habits. ${weekMeds.length} meditation${weekMeds.length !== 1 ? 's' : ''}. — Personal OS 🦇`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: ignore
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: '#444', fontFamily: MONO, fontSize: '0.75rem' }}>LOADING...</div>;
  }

  return (
    <div style={{ fontFamily: MONO }}>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: border2 }}>
        <p style={{ ...lbl, marginBottom: '0.25rem' }}>{weekRange}</p>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>WEEK REVIEW</h1>
      </div>

      {/* Big weekly score */}
      <div style={{ padding: '1.5rem 1rem', borderBottom: border2, background: '#000' }}>
        <p style={{ ...lbl, marginBottom: '0.25rem' }}>WEEKLY AVG SCORE</p>
        <div className="animate-fadeIn" style={{ fontSize: '5rem', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: '#fff' }}>
          {weeklyAvgScore}
        </div>
        <p style={{ fontSize: '0.65rem', color: '#888', margin: '0.25rem 0 0.75rem', fontWeight: 700, letterSpacing: '0.2em' }}>/100</p>
        <div style={{ height: 4, background: '#111', border: '1px solid #444' }}>
          <div className="progress-fill" style={{ width: `${weeklyAvgScore}%` }} />
        </div>
      </div>

      {/* 7-day grid */}
      <div style={{ borderBottom: border2 }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
          <span style={lbl}>DAILY BREAKDOWN</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #111' }}>
          {days.map((d) => {
            const allDone = d.habitTotal > 0 && d.habitDone === d.habitTotal;
            return (
              <div
                key={d.iso}
                style={{
                  borderRight: '1px solid #111',
                  padding: '0.75rem 0.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: allDone ? '#fff' : '#000',
                  color: allDone ? '#000' : '#fff',
                }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>{d.dayInit}</span>
                <span style={{ fontSize: '0.55rem', color: allDone ? '#444' : '#555' }}>
                  {d.habitDone}/{d.habitTotal}
                </span>
                <span style={{ fontSize: '0.6rem' }} title="Workout">{d.hadWorkout ? '●' : '○'}</span>
                <span style={{ fontSize: '0.6rem', color: allDone ? '#444' : '#555' }} title="Meditation">{d.hadMed ? '◆' : '◇'}</span>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '0.5rem 1rem', display: 'flex', gap: '1rem' }}>
          <span style={{ fontSize: '0.55rem', color: '#555' }}>● workout ◆ meditation</span>
          <span style={{ fontSize: '0.55rem', color: '#555' }}>inverted = all habits done</span>
        </div>
      </div>

      {/* Streak summary */}
      <div style={{ borderBottom: border2 }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
          <span style={lbl}>TOP STREAKS</span>
        </div>
        {topHabits.length === 0 ? (
          <div style={{ padding: '1rem', color: '#444', fontSize: '0.75rem' }}>NO HABITS YET</div>
        ) : topHabits.map(h => (
          <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
            <span style={{ fontSize: '0.875rem', color: '#fff' }}>{h.name}</span>
            <StreakBadge streak={h.streak} />
          </div>
        ))}
      </div>

      {/* Workouts this week */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: border2 }}>
        <div style={{ borderRight: '1px solid #444', padding: '1rem' }}>
          <p style={{ ...lbl, marginBottom: '0.5rem' }}>WORKOUTS</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: '#fff', margin: 0 }}>{weekWorkouts.length}</p>
          <p style={{ fontSize: '0.65rem', color: '#888', margin: '0.25rem 0 0' }}>{totalWorkoutMins} MINS TOTAL</p>
        </div>
        <div style={{ padding: '1rem' }}>
          <p style={{ ...lbl, marginBottom: '0.5rem' }}>MEDITATIONS</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: '#fff', margin: 0 }}>{weekMeds.length}</p>
          <p style={{ fontSize: '0.65rem', color: '#888', margin: '0.25rem 0 0' }}>THIS WEEK</p>
        </div>
      </div>

      {/* Share */}
      <div style={{ padding: '1rem', borderBottom: border2 }}>
        <button
          onClick={handleShare}
          style={{
            width: '100%',
            padding: '0.875rem 1rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            background: copied ? '#fff' : '#000',
            color: copied ? '#000' : '#fff',
            border: border2,
            cursor: 'pointer',
            fontFamily: MONO,
          }}
        >
          {copied ? 'COPIED ✓' : 'SHARE WEEK'}
        </button>
      </div>
    </div>
  );
}
