'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getProfile, getHabits, getHabitCompletions, getHabitStreaks,
  getMeditationSessions, getMeditationLogs, getTodayMacros,
  getWorkoutLogs, toggleHabitCompletion, seedUserData,
  todayISO, type Habit, type MeditationSession,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';

function calcScore(calPct: number, habitPct: number, hasWorkout: boolean, hasMed: boolean) {
  const cal = calPct >= 85 && calPct <= 110 ? 30 : calPct >= 70 ? 20 : calPct > 0 ? 10 : 0;
  const hab = Math.round(habitPct * 40) / 100;
  return Math.min(Math.round(cal + hab + (hasWorkout ? 20 : 0) + (hasMed ? 10 : 0)), 100);
}

function scoreLabel(s: number) {
  if (s >= 90) return 'ELITE';
  if (s >= 75) return 'STRONG';
  if (s >= 55) return 'SOLID';
  if (s >= 35) return 'BUILDING';
  return "LET'S GO";
}

export default function TodayPage() {
  const router = useRouter();
  const [calories, setCalories]       = useState(0);
  const [calorieTarget, setCalTarget] = useState(2000);
  const [habits, setHabits]           = useState<(Habit & { done: boolean; streak: number })[]>([]);
  const [workoutsToday, setWorkouts]  = useState(0);
  const [medDone, setMedDone]         = useState(false);
  const [suggested, setSuggested]     = useState<MeditationSession | null>(null);
  const [dateStr, setDateStr]         = useState('');
  const [loading, setLoading]         = useState(true);

  const load = useCallback(async () => {
    try {
      await seedUserData();
      const today = todayISO();
      setDateStr(new Date().toLocaleDateString('en-ZA', { weekday: 'long', month: 'long', day: 'numeric' }));
      const [macros, profile, activeHabits, completions, workouts, medLogs, sessions] = await Promise.all([
        getTodayMacros(), getProfile(), getHabits(), getHabitCompletions(today),
        getWorkoutLogs(today), getMeditationLogs(today), getMeditationSessions(),
      ]);
      setCalories(Math.round(macros.calories));
      setCalTarget(profile?.calorie_target ?? 2000);
      const doneIds = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
      const streaks = await getHabitStreaks(activeHabits.map(h => h.id));
      const habitData = activeHabits.map(h => ({
        ...h, done: doneIds.has(h.id), streak: streaks.get(h.id) ?? 0,
      }));
      setHabits(habitData);
      setWorkouts(workouts.length);
      setMedDone(medLogs.some(m => m.completed));
      const loggedIds = new Set(medLogs.map(m => m.session_id));
      setSuggested(sessions.find(s => !loggedIds.has(s.id)) ?? sessions[0] ?? null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const toggle = async (id: number) => { haptic('medium'); await toggleHabitCompletion(id); await load(); };

  const calPct    = calorieTarget > 0 ? (calories / calorieTarget) * 100 : 0;
  const habitDone = habits.filter(h => h.done).length;
  const habitPct  = habits.length > 0 ? (habitDone / habits.length) * 100 : 0;
  const score     = calcScore(calPct, habitPct, workoutsToday > 0, medDone);

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="label">Loading...</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '5rem', paddingBottom: '5rem' }}>

      {/* ── Hero ── */}
      <div style={{ padding: '0 var(--pad) 2rem', borderBottom: '1px solid var(--border)' }}>
        <p className="label" style={{ marginBottom: '1.5rem' }}>{dateStr}</p>

        {/* Score */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 'clamp(5rem, 26vw, 9rem)', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 0.88, color: 'var(--text)' }}>
            {score}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.75rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text)' }}>
              {scoreLabel(score)}
            </span>
            <span className="label">/ 100 today</span>
          </div>
        </div>

        {/* 4 segment bars */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
          {[
            { label: 'EAT',    val: Math.min(calPct, 100) },
            { label: 'HABITS', val: Math.min(habitPct, 100) },
            { label: 'MOVE',   val: workoutsToday > 0 ? 100 : 0 },
            { label: 'MIND',   val: medDone ? 100 : 0 },
          ].map(seg => (
            <div key={seg.label}>
              <div className="progress" style={{ marginBottom: '0.4rem' }}>
                <div className="progress-fill" style={{ width: `${seg.val}%` }} />
              </div>
              <p className="label-xs" style={{ color: seg.val > 0 ? 'var(--text-2)' : 'var(--text-4)' }}>{seg.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '1.25rem var(--pad)', borderRight: '1px solid var(--border)' }}>
          <p className="label" style={{ marginBottom: '0.5rem' }}>Calories</p>
          <p style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--text)', marginBottom: '0.25rem' }}>
            {calories.toLocaleString()}
          </p>
          <p className="label" style={{ marginBottom: '0.75rem' }}>/ {calorieTarget.toLocaleString()}</p>
          <div className="progress"><div className="progress-fill" style={{ width: `${Math.min(calPct, 100)}%` }} /></div>
        </div>
        <div style={{ padding: '1.25rem var(--pad)' }}>
          <p className="label" style={{ marginBottom: '0.5rem' }}>Habits</p>
          <p style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--text)', marginBottom: '0.25rem' }}>
            {habitDone}<span style={{ fontSize: '1.1rem', color: 'var(--text-4)', fontWeight: 500 }}>/{habits.length}</span>
          </p>
          <p className="label" style={{ marginBottom: '0.75rem' }}>{habits.length > 0 ? `${Math.round(habitPct)}% done` : 'none set'}</p>
          <div className="progress"><div className="progress-fill" style={{ width: `${Math.min(habitPct, 100)}%` }} /></div>
        </div>
      </div>

      {/* ── Status cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => { haptic('light'); router.push('/fitness'); }}
          style={{ padding: '1.25rem var(--pad)', background: workoutsToday > 0 ? 'var(--text)' : 'var(--bg)', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' as const }}>
          <p className="label" style={{ marginBottom: '0.35rem', color: workoutsToday > 0 ? 'var(--invert)' : 'var(--text-3)', opacity: 0.7 }}>Workouts</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.04em', color: workoutsToday > 0 ? 'var(--invert)' : 'var(--text)', margin: 0 }}>{workoutsToday}</p>
        </button>
        <button onClick={() => { haptic('light'); router.push('/meditation'); }}
          style={{ padding: '1.25rem var(--pad)', background: medDone ? 'var(--text)' : 'var(--bg)', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>
          <p className="label" style={{ marginBottom: '0.35rem', color: medDone ? 'var(--invert)' : 'var(--text-3)', opacity: 0.7 }}>Meditation</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.04em', color: medDone ? 'var(--invert)' : 'var(--text)', margin: 0 }}>{medDone ? '✓' : '—'}</p>
        </button>
      </div>

      {/* ── Quick actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: '+ Meal',    path: '/nutrition?action=add' },
          { label: '+ Workout', path: '/fitness?action=add' },
          { label: '+ Meditate',path: '/meditation' },
        ].map((b, i) => (
          <button key={b.label} onClick={() => { haptic('light'); router.push(b.path); }}
            style={{ padding: '0.875rem 0.5rem', background: 'transparent', border: 'none', borderRight: i < 2 ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)' }}>
            {b.label}
          </button>
        ))}
      </div>

      {/* ── Habits ── */}
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem var(--pad)', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Habits</p>
          <button onClick={() => { haptic('light'); router.push('/habits'); }}
            style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Manage →
          </button>
        </div>

        {habits.length === 0 ? (
          <div style={{ padding: '2rem var(--pad)', textAlign: 'center' as const }}>
            <p className="label" style={{ marginBottom: '0.5rem' }}>No habits yet</p>
            <button onClick={() => router.push('/habits')} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Add your first →
            </button>
          </div>
        ) : habits.map(h => (
          <button key={h.id} onClick={() => toggle(h.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', padding: '0.875rem var(--pad)', background: h.done ? 'var(--surface)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' as const, WebkitTapHighlightColor: 'transparent' }}>
            <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-xs)', border: `2px solid ${h.done ? 'var(--text)' : 'var(--border-2)'}`, background: h.done ? 'var(--text)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
              {h.done && <span style={{ fontSize: '0.7rem', color: 'var(--invert)', fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ flex: 1, fontSize: '0.9375rem', fontWeight: 500, color: h.done ? 'var(--text-3)' : 'var(--text)', textDecoration: h.done ? 'line-through' : 'none' }}>
              {h.name}
            </span>
            {h.streak > 0 && (
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-3)', border: '1px solid var(--border-2)', borderRadius: 999, padding: '0.15rem 0.5rem' }}>
                {h.streak}d 🔥
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Suggested meditation ── */}
      {suggested && (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem var(--pad)', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Suggested</p>
            <span className="label">{suggested.duration_min} min</span>
          </div>
          <button onClick={() => { haptic('light'); router.push(`/meditation/${suggested.id}`); }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '1.25rem var(--pad)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>
            <div>
              <p style={{ margin: '0 0 0.35rem', fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.02em', color: 'var(--text)' }}>{suggested.name}</p>
              <p className="label">{suggested.category}</p>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.5rem 1rem', background: 'var(--text)', color: 'var(--invert)', borderRadius: 'var(--radius-xs)', flexShrink: 0 }}>
              Start →
            </span>
          </button>
        </div>
      )}

    </div>
  );
}
