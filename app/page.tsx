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
      const habitData = await Promise.all(activeHabits.map(async h => ({ ...h, done: doneIds.has(h.id), streak: await getHabitStreak(h.id) })));
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
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F0F14' }}>
      <p style={{ fontSize: '0.8rem', letterSpacing: '0.15em', color: '#3A3A4A' }}>LOADING...</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: '#0F0F14', paddingTop: '4rem', paddingBottom: '5rem', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Hero ── */}
      <div style={{ padding: '1.5rem 1.25rem 1rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', color: '#7A7A8C', marginBottom: '1.5rem' }}>
          {dateStr}
        </p>

        {/* Score card */}
        <div style={{
          background: 'linear-gradient(135deg, #1E1E28 0%, #17172A 100%)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 20,
          padding: '1.75rem',
          marginBottom: '1rem',
        }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A7A8C', marginBottom: '0.5rem' }}>
            Daily Score
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginBottom: '1rem' }}>
            <span style={{
              fontSize: 'clamp(4.5rem, 24vw, 7rem)',
              fontWeight: 900,
              letterSpacing: '-0.05em',
              lineHeight: 0.9,
              background: 'linear-gradient(135deg, #fff 0%, #F59E0B 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>{score}</span>
            <div style={{ paddingBottom: '0.5rem' }}>
              <span style={{ display: 'inline-block', background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 999, padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em' }}>
                {scoreLabel(score)}
              </span>
              <p style={{ fontSize: '0.65rem', color: '#3A3A4A', marginTop: '0.35rem', fontWeight: 500 }}>out of 100</p>
            </div>
          </div>

          {/* 4-segment bars */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
            {[
              { label: 'EAT',    val: Math.min(calPct, 100),       grad: 'linear-gradient(90deg,#F59E0B,#F97316)' },
              { label: 'HABITS', val: Math.min(habitPct, 100),      grad: 'linear-gradient(90deg,#6366F1,#818CF8)' },
              { label: 'MOVE',   val: workoutsToday > 0 ? 100 : 0, grad: 'linear-gradient(90deg,#10B981,#34D399)' },
              { label: 'MIND',   val: medDone ? 100 : 0,           grad: 'linear-gradient(90deg,#06B6D4,#67E8F9)' },
            ].map(seg => (
              <div key={seg.label}>
                <div style={{ height: 5, background: '#25252F', borderRadius: 999, overflow: 'hidden', marginBottom: '0.35rem' }}>
                  <div style={{ height: '100%', width: `${seg.val}%`, background: seg.val > 0 ? seg.grad : 'transparent', borderRadius: 999, transition: 'width 0.5s ease' }} />
                </div>
                <p style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.08em', color: seg.val > 0 ? '#7A7A8C' : '#2A2A3A', textTransform: 'uppercase' as const }}>{seg.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '0 1.25rem', marginBottom: '0.75rem' }}>
        {/* Calories */}
        <div style={{ background: '#17171F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.25rem' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#7A7A8C', marginBottom: '0.5rem' }}>Calories</p>
          <p style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: '#fff', marginBottom: '0.2rem' }}>{calories.toLocaleString()}</p>
          <p style={{ fontSize: '0.7rem', color: '#3A3A4A', marginBottom: '0.75rem' }}>/ {calorieTarget.toLocaleString()}</p>
          <div style={{ height: 5, background: '#25252F', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(calPct, 100)}%`, background: 'linear-gradient(90deg,#F59E0B,#F97316)', borderRadius: 999, transition: 'width 0.5s ease' }} />
          </div>
        </div>

        {/* Habits */}
        <div style={{ background: '#17171F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.25rem' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#7A7A8C', marginBottom: '0.5rem' }}>Habits</p>
          <p style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: '#fff', marginBottom: '0.2rem' }}>
            {habitDone}<span style={{ fontSize: '1.1rem', color: '#3A3A4A', fontWeight: 500 }}>/{habits.length}</span>
          </p>
          <p style={{ fontSize: '0.7rem', color: '#3A3A4A', marginBottom: '0.75rem' }}>{habits.length > 0 ? `${Math.round(habitPct)}% done` : 'None set'}</p>
          <div style={{ height: 5, background: '#25252F', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(habitPct, 100)}%`, background: 'linear-gradient(90deg,#6366F1,#818CF8)', borderRadius: 999, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      {/* ── Workout + Meditation ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '0 1.25rem', marginBottom: '1.5rem' }}>
        <button onClick={() => { haptic('light'); router.push('/fitness'); }}
          style={{ background: workoutsToday > 0 ? 'linear-gradient(135deg,#10B981,#065F46)' : '#17171F', border: `1px solid ${workoutsToday > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 16, padding: '1.25rem', textAlign: 'left' as const, cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: workoutsToday > 0 ? 'rgba(255,255,255,0.7)' : '#7A7A8C', marginBottom: '0.5rem' }}>Workouts</p>
          <p style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>{workoutsToday}</p>
          <p style={{ fontSize: '0.7rem', color: workoutsToday > 0 ? 'rgba(255,255,255,0.5)' : '#3A3A4A', marginTop: '0.25rem' }}>today</p>
        </button>

        <button onClick={() => { haptic('light'); router.push('/meditation'); }}
          style={{ background: medDone ? 'linear-gradient(135deg,#6366F1,#312E81)' : '#17171F', border: `1px solid ${medDone ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 16, padding: '1.25rem', textAlign: 'left' as const, cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: medDone ? 'rgba(255,255,255,0.7)' : '#7A7A8C', marginBottom: '0.5rem' }}>Meditation</p>
          <p style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>{medDone ? '✓' : '–'}</p>
          <p style={{ fontSize: '0.7rem', color: medDone ? 'rgba(255,255,255,0.5)' : '#3A3A4A', marginTop: '0.25rem' }}>{medDone ? 'done' : 'not done'}</p>
        </button>
      </div>

      {/* ── Quick actions ── */}
      <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        {[
          { label: '+ Meal',     path: '/nutrition?action=add' },
          { label: '+ Workout',  path: '/fitness?action=add' },
          { label: '+ Meditate', path: '/meditation' },
        ].map(b => (
          <button key={b.label} onClick={() => { haptic('light'); router.push(b.path); }}
            style={{ flex: 1, padding: '0.75rem 0.5rem', background: '#17171F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600, color: '#7A7A8C', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '-0.01em' }}>
            {b.label}
          </button>
        ))}
      </div>

      {/* ── Habits ── */}
      <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Habits</p>
          <button onClick={() => { haptic('light'); router.push('/habits'); }}
            style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7A7A8C', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
            Manage →
          </button>
        </div>

        {habits.length === 0 ? (
          <div style={{ background: '#17171F', borderRadius: 16, padding: '2rem', textAlign: 'center' as const, border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ fontSize: '0.875rem', color: '#3A3A4A', marginBottom: '0.75rem' }}>No habits yet</p>
            <button onClick={() => router.push('/habits')}
              style={{ fontSize: '0.8rem', fontWeight: 600, color: '#F59E0B', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
              Add your first →
            </button>
          </div>
        ) : (
          <div style={{ background: '#17171F', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            {habits.map((h, i) => (
              <button key={h.id} onClick={() => toggle(h.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  width: '100%', padding: '1rem 1.25rem',
                  background: h.done ? 'rgba(16,185,129,0.06)' : 'transparent',
                  border: 'none',
                  borderBottom: i < habits.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  cursor: 'pointer', textAlign: 'left' as const,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: h.done ? '#10B981' : 'transparent',
                  border: `2px solid ${h.done ? '#10B981' : '#3A3A4A'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}>
                  {h.done && <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ flex: 1, fontSize: '0.9375rem', fontWeight: 500, color: h.done ? '#7A7A8C' : '#F0F0F5', textDecoration: h.done ? 'line-through' : 'none' }}>
                  {h.name}
                </span>
                {h.streak > 0 && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#F59E0B' }}>{h.streak} 🔥</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Suggested meditation ── */}
      {suggested && (
        <div style={{ padding: '0 1.25rem' }}>
          <p style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>Suggested Session</p>
          <div style={{ background: 'linear-gradient(135deg, #1E1E2E, #13131A)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: '1.5rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#6366F1', marginBottom: '0.5rem' }}>
              {suggested.category} · {suggested.duration_min} min
            </p>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem', letterSpacing: '-0.02em' }}>
              {suggested.name}
            </p>
            <button onClick={() => { haptic('light'); router.push(`/meditation/${suggested.id}`); }}
              style={{ width: '100%', padding: '0.875rem', background: '#6366F1', color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '-0.01em' }}>
              Start Session →
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
