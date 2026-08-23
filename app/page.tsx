'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getProfile, getHabits, getHabitCompletions, getHabitStreak,
  getMeditationSessions, getMeditationLogs, getTodayMacros,
  getWorkoutLogs, toggleHabitCompletion, seedUserData,
  todayISO, type Habit, type MeditationSession,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';

function calcScore(calPct: number, habitPct: number, hasWorkout: boolean, hasMed: boolean): number {
  const cal  = calPct >= 85 && calPct <= 110 ? 30 : calPct >= 70 && calPct <= 120 ? 20 : calPct > 0 ? 10 : 0;
  const hab  = Math.round(habitPct * 40) / 100;
  const work = hasWorkout ? 20 : 0;
  const med  = hasMed ? 10 : 0;
  return Math.min(Math.round(cal + hab + work + med), 100);
}

function scoreLabel(s: number) {
  if (s >= 90) return 'ELITE';
  if (s >= 75) return 'STRONG';
  if (s >= 55) return 'SOLID';
  if (s >= 35) return 'BUILDING';
  if (s > 0)   return 'STARTING';
  return "LET'S GO";
}

export default function TodayPage() {
  const router = useRouter();
  const [calories,      setCalories]      = useState(0);
  const [calTarget,     setCalTarget]     = useState(1800);
  const [habits,        setHabits]        = useState<(Habit & { done: boolean; streak: number })[]>([]);
  const [workouts,      setWorkouts]      = useState(0);
  const [medDone,       setMedDone]       = useState(false);
  const [suggested,     setSuggested]     = useState<MeditationSession | null>(null);
  const [dateStr,       setDateStr]       = useState('');
  const [loading,       setLoading]       = useState(true);
  const [scoreVisible,  setScoreVisible]  = useState(false);

  const load = useCallback(async () => {
    try {
      await seedUserData();
      const today = todayISO();
      setDateStr(new Date().toLocaleDateString('en-ZA', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase());
      const [macros, profile, activeHabits, completions, workoutLogs, medLogs, sessions] = await Promise.all([
        getTodayMacros(), getProfile(), getHabits(), getHabitCompletions(today),
        getWorkoutLogs(today), getMeditationLogs(today), getMeditationSessions(),
      ]);
      setCalories(Math.round(macros.calories));
      setCalTarget(profile?.calorie_target ?? 1800);
      const doneIds = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
      setHabits(await Promise.all(activeHabits.map(async h => ({ ...h, done: doneIds.has(h.id), streak: await getHabitStreak(h.id) }))));
      setWorkouts(workoutLogs.length);
      setMedDone(medLogs.some(m => m.completed));
      const loggedIds = new Set(medLogs.map(m => m.session_id));
      setSuggested(sessions.find(s => !loggedIds.has(s.id)) ?? sessions[0] ?? null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setTimeout(() => setScoreVisible(true), 80); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: number) => { haptic('medium'); await toggleHabitCompletion(id); await load(); };

  const habitDone  = habits.filter(h => h.done).length;
  const habitTotal = habits.length;
  const calPct     = calTarget > 0 ? (calories / calTarget) * 100 : 0;
  const habitPct   = habitTotal > 0 ? (habitDone / habitTotal) * 100 : 0;
  const score      = calcScore(calPct, habitPct, workouts > 0, medDone);
  const scoreCol   = score >= 75 ? 'var(--accent)' : 'var(--text)';

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <p className="label" style={{ color: 'var(--text-ghost)' }}>Loading…</p>
    </div>
  );

  return (
    <div className="page">

      {/* ── Header ── */}
      <div className="page-head">
        <div className="page-head-left">
          <span className="label" style={{ color: 'var(--text-ghost)' }}>{dateStr}</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>Personal OS</span>
        </div>
        <div className="page-head-right">
          <button className="btn btn-sm btn-outline" onClick={() => { haptic('light'); router.push('/log'); }}>
            + Log
          </button>
        </div>
      </div>

      {/* ── Hero score ── */}
      <div className="section" style={{ padding: '2rem var(--page-pad) 1.75rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ opacity: scoreVisible ? 1 : 0, transition: 'opacity 300ms ease' }}>
          <div className="num-hero" style={{ color: scoreCol, marginBottom: '0.5rem' }}>
            {score}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.5rem' }}>
            <span className="label" style={{ color: scoreCol }}>{scoreLabel(score)}</span>
            <span className="label" style={{ color: 'var(--text-ghost)' }}>/ 100 TODAY</span>
          </div>
          {/* Four pillar bars */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            {[
              { key: 'EAT',    pct: Math.min(calPct, 100),           active: calories > 0      },
              { key: 'HABITS', pct: Math.min(habitPct, 100),         active: habitDone > 0     },
              { key: 'MOVE',   pct: workouts > 0 ? 100 : 0,          active: workouts > 0      },
              { key: 'MIND',   pct: medDone ? 100 : 0,               active: medDone           },
            ].map(item => (
              <div key={item.key}>
                <div className="progress" style={{ marginBottom: '0.35rem' }}>
                  <div className="progress-fill" style={{
                    width: `${item.pct}%`,
                    background: item.pct >= 100 ? 'var(--accent)' : item.active ? 'var(--text)' : 'var(--border-strong)',
                  }} />
                </div>
                <span className="label-xs" style={{ color: item.active ? 'var(--text-muted)' : 'var(--text-ghost)' }}>
                  {item.key}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr', margin: '0', borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border)' }}>
        <div className="stat-cell" style={{ padding: '1.25rem var(--page-pad)' }}>
          <p className="label" style={{ marginBottom: '0.5rem' }}>Calories</p>
          <p className="num-xl" style={{ marginBottom: '0.2rem' }}>{calories.toLocaleString()}</p>
          <p className="label-xs">/ {calTarget.toLocaleString()} kcal</p>
          <div className="progress" style={{ marginTop: '0.75rem' }}>
            <div className="progress-fill" style={{ width: `${Math.min(calPct, 100)}%`, background: calPct > 110 ? 'var(--negative)' : 'var(--accent)' }} />
          </div>
        </div>
        <div className="stat-cell" style={{ padding: '1.25rem var(--page-pad)', borderRight: 'none' }}>
          <p className="label" style={{ marginBottom: '0.5rem' }}>Habits</p>
          <p className="num-xl" style={{ marginBottom: '0.2rem' }}>
            {habitDone}<span className="label" style={{ color: 'var(--text-ghost)' }}> / {habitTotal}</span>
          </p>
          <p className="label-xs">{habitTotal > 0 ? `${Math.round(habitPct)}% complete` : 'None added'}</p>
          <div className="progress" style={{ marginTop: '0.75rem' }}>
            <div className="progress-fill" style={{ width: `${Math.min(habitPct, 100)}%`, background: 'var(--accent)' }} />
          </div>
        </div>
      </div>

      {/* ── Status row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'Workouts',   done: workouts > 0,  value: workouts > 0 ? String(workouts) : '0' },
          { key: 'Meditation', done: medDone,        value: medDone ? '✓' : '–' },
        ].map((item, i) => (
          <div
            key={item.key}
            style={{
              padding: '1rem var(--page-pad)',
              borderRight: i === 0 ? '1px solid var(--border)' : 'none',
              borderLeft: item.done ? '2px solid var(--positive)' : '2px solid transparent',
              background: item.done ? 'var(--surface-2)' : 'var(--bg)',
            }}
          >
            <p className="label" style={{ marginBottom: '0.4rem' }}>{item.key}</p>
            <p className="num-lg" style={{ color: item.done ? 'var(--positive)' : 'var(--text-muted)' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: '+ Meal',     path: '/nutrition?action=add' },
          { label: '+ Workout',  path: '/fitness'              },
          { label: '+ Meditate', path: '/meditation'           },
        ].map((b, i) => (
          <button
            key={b.label}
            className="btn btn-ghost t-fast"
            onClick={() => { haptic('light'); router.push(b.path); }}
            style={{ borderRadius: 0, borderRight: i < 2 ? '1px solid var(--border)' : 'none', padding: '0.875rem 0.5rem', fontSize: '0.6rem' }}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* ── Habits today ── */}
      <div className="section-label">
        <span className="label">Habits today</span>
        <button className="btn btn-ghost btn-sm" onClick={() => { haptic('light'); router.push('/habits'); }}>
          Manage
        </button>
      </div>

      {habits.length === 0 ? (
        <div className="empty-state">
          No habits yet —{' '}
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/habits')} style={{ display: 'inline', padding: 0, fontSize: 'inherit' }}>
            add your first
          </button>
        </div>
      ) : habits.map(h => (
        <button
          key={h.id}
          onClick={() => toggle(h.id)}
          className="t-fast"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.875rem',
            width: '100%', padding: '1rem var(--page-pad)',
            background: h.done ? 'var(--surface-2)' : 'var(--bg)',
            border: 'none', borderBottom: '1px solid var(--border)',
            borderLeft: h.done ? '2px solid var(--positive)' : '2px solid transparent',
            cursor: 'pointer', textAlign: 'left',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, minWidth: '2rem', color: h.done ? 'var(--positive)' : 'var(--text-ghost)' }}>
            {h.done ? '[X]' : '[ ]'}
          </span>
          <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, color: h.done ? 'var(--text-muted)' : 'var(--text)', fontFamily: 'var(--font-sans)', textDecoration: h.done ? 'line-through' : 'none' }}>
            {h.name}
          </span>
          {h.streak > 0 && (
            <span className="mono" style={{ fontSize: '0.7rem', fontWeight: 700, color: h.done ? 'var(--text-ghost)' : 'var(--accent)' }}>
              {h.streak}d
            </span>
          )}
        </button>
      ))}

      {/* ── Suggested meditation ── */}
      {suggested && (
        <>
          <div className="section-label">
            <span className="label">Start here</span>
            <span className="label-xs">{suggested.duration_min} min</span>
          </div>
          <button
            className="row t-fast"
            onClick={() => { haptic('light'); router.push(`/meditation/${suggested.id}`); }}
            style={{ width: '100%', border: 'none', justifyContent: 'space-between', background: 'var(--surface)' }}
          >
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: '0 0 0.2rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{suggested.name}</p>
              <p className="label">{suggested.category}</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); haptic('light'); router.push(`/meditation/${suggested.id}`); }}>
              Start
            </button>
          </button>
        </>
      )}

      <div style={{ height: '2rem' }} />
    </div>
  );
}
