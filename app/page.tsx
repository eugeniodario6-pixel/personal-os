'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getProfile, getHabits, getHabitCompletions, getHabitStreak,
  getMeditationSessions, getMeditationLogs, getTodayMacros,
  getWorkoutLogs, getInsights, toggleHabitCompletion, seedUserData,
  todayISO, type Habit, type MeditationSession, type Insight,
} from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptic';

const MONO = "'IBM Plex Mono', monospace";

function calcScore(p: {
  calPct: number;
  habitPct: number;
  hasWorkout: boolean;
  hasMed: boolean;
}): number {
  // Calories: 30pts (best when 85–110% of target)
  const calScore = p.calPct >= 85 && p.calPct <= 110
    ? 30
    : p.calPct >= 70 && p.calPct <= 120
    ? 20
    : p.calPct > 0 ? 10 : 0;
  // Habits: 40pts
  const habitScore = Math.round(p.habitPct * 40) / 100;
  // Workout: 20pts
  const workoutScore = p.hasWorkout ? 20 : 0;
  // Meditation: 10pts
  const medScore = p.hasMed ? 10 : 0;
  return Math.min(Math.round(calScore + habitScore + workoutScore + medScore), 100);
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'ELITE';
  if (score >= 75) return 'STRONG';
  if (score >= 55) return 'SOLID';
  if (score >= 35) return 'BUILDING';
  if (score > 0)   return 'STARTING';
  return 'LET\'S GO';
}

function scoreColor(score: number): string {
  if (score >= 75) return '#F5A623';
  return '#ffffff';
}

export default function TodayPage() {
  const router = useRouter();
  const [calories, setCalories] = useState(0);
  const [calorieTarget, setCalorieTarget] = useState(2000);
  const [habits, setHabits] = useState<(Habit & { done: boolean; streak: number })[]>([]);
  const [workoutsToday, setWorkoutsToday] = useState(0);
  const [medDone, setMedDone] = useState(false);
  const [suggested, setSuggested] = useState<MeditationSession | null>(null);
  const [dateStr, setDateStr] = useState('');
  const [loading, setLoading] = useState(true);
  const [scoreVisible, setScoreVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      await seedUserData();
      const today = todayISO();
      setDateStr(new Date().toLocaleDateString('en-ZA', {
        weekday: 'long', month: 'long', day: 'numeric'
      }).toUpperCase());

      const [macros, profile, activeHabits, completions, workouts, medLogs, sessions] = await Promise.all([
        getTodayMacros(),
        getProfile(),
        getHabits(),
        getHabitCompletions(today),
        getWorkoutLogs(today),
        getMeditationLogs(today),
        getMeditationSessions(),
      ]);

      setCalories(Math.round(macros.calories));
      setCalorieTarget(profile?.calorie_target ?? 2000);

      const completedIds = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
      const habitData = await Promise.all(activeHabits.map(async h => ({
        ...h,
        done: completedIds.has(h.id),
        streak: await getHabitStreak(h.id),
      })));
      setHabits(habitData);
      setWorkoutsToday(workouts.length);
      setMedDone(medLogs.some(m => m.completed));

      const loggedIds = new Set(medLogs.map(m => m.session_id));
      const unplayed = sessions.find(s => !loggedIds.has(s.id));
      setSuggested(unplayed ?? sessions[0] ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setTimeout(() => setScoreVisible(true), 100);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (habitId: number) => {
    haptic('medium');
    await toggleHabitCompletion(habitId);
    await load();
  };

  const handleSignOut = async () => {
    haptic('light');
    await supabase.auth.signOut();
    router.push('/login');
  };

  const habitDone = habits.filter(h => h.done).length;
  const habitTotal = habits.length;
  const calPct = calorieTarget > 0 ? (calories / calorieTarget) * 100 : 0;
  const habitPct = habitTotal > 0 ? (habitDone / habitTotal) * 100 : 0;
  const score = calcScore({ calPct, habitPct, hasWorkout: workoutsToday > 0, hasMed: medDone });
  const calBarPct = Math.min(calPct, 100);
  const habitBarPct = Math.min(habitPct, 100);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', fontFamily: MONO }}>
        <p className="label">LOADING...</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: MONO }}>

      {/* ── Hero score ── */}
      <div style={{ padding: '2rem 1.25rem 1.5rem', borderBottom: '2px solid #1a1a1a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <p className="label" style={{ marginBottom: '0.3rem' }}>{dateStr}</p>
            <p className="label" style={{ color: '#333' }}>PERSONAL OS</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => { haptic('light'); router.push('/log'); }}
              style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.5rem 0.875rem', border: '2px solid #2a2a2a', background: '#000', color: '#fff', cursor: 'pointer', fontFamily: MONO }}
            >
              + LOG
            </button>
            <button
              onClick={handleSignOut}
              style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.5rem 0.875rem', border: '2px solid #1a1a1a', background: '#000', color: '#333', cursor: 'pointer', fontFamily: MONO }}
            >
              OUT
            </button>
          </div>
        </div>

        {/* Big score */}
        <div className={scoreVisible ? 'score-animate' : ''} style={{ opacity: scoreVisible ? 1 : 0 }}>
          <div style={{
            fontSize: 'clamp(5rem, 28vw, 9rem)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 0.85,
            color: scoreColor(score),
            fontFamily: MONO,
            marginBottom: '0.75rem',
          }}>
            {score}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', color: scoreColor(score) }}>
              {scoreLabel(score)}
            </p>
            <p className="label">/ 100 TODAY</p>
          </div>
        </div>

        {/* Score breakdown bar */}
        <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.25rem' }}>
          {[
            { label: 'EAT', val: Math.min(calPct, 100), active: calories > 0 },
            { label: 'HABITS', val: habitBarPct, active: habitDone > 0 },
            { label: 'MOVE', val: workoutsToday > 0 ? 100 : 0, active: workoutsToday > 0 },
            { label: 'MIND', val: medDone ? 100 : 0, active: medDone },
          ].map(item => (
            <div key={item.label}>
              <div style={{ height: 3, background: '#111', marginBottom: '0.35rem' }}>
                <div className="progress-fill" style={{ width: `${item.val}%`, background: item.val === 100 ? '#F5A623' : '#fff' }} />
              </div>
              <p className="label-sm" style={{ color: item.active ? '#666' : '#2a2a2a' }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '2px solid #1a1a1a' }}>
        {/* Calories */}
        <div style={{ borderRight: '1px solid #1a1a1a', padding: '1.25rem' }}>
          <p className="label" style={{ marginBottom: '0.5rem' }}>CALORIES</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff', marginBottom: '0.25rem' }}>
            {calories.toLocaleString()}
          </p>
          <p className="label" style={{ color: '#333' }}>/ {calorieTarget.toLocaleString()}</p>
          <div style={{ marginTop: '0.75rem', height: 3, background: '#111' }}>
            <div className="progress-fill" style={{ width: `${calBarPct}%` }} />
          </div>
        </div>
        {/* Habits */}
        <div style={{ padding: '1.25rem' }}>
          <p className="label" style={{ marginBottom: '0.5rem' }}>HABITS</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff', marginBottom: '0.25rem' }}>
            {habitDone}<span style={{ fontSize: '1rem', color: '#333', fontWeight: 400 }}>/{habitTotal}</span>
          </p>
          <p className="label" style={{ color: '#333' }}>{habitTotal > 0 ? `${Math.round(habitPct)}% DONE` : 'NO HABITS'}</p>
          <div style={{ marginTop: '0.75rem', height: 3, background: '#111' }}>
            <div className="progress-fill" style={{ width: `${habitBarPct}%` }} />
          </div>
        </div>
      </div>

      {/* ── Status pills ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '2px solid #1a1a1a' }}>
        <div style={{
          borderRight: '1px solid #1a1a1a',
          padding: '1rem 1.25rem',
          background: workoutsToday > 0 ? '#fff' : '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <p className="label" style={{ color: workoutsToday > 0 ? '#555' : '#333', marginBottom: '0.2rem' }}>WORKOUTS</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: workoutsToday > 0 ? '#000' : '#fff', lineHeight: 1 }}>{workoutsToday}</p>
          </div>
          <span style={{ fontSize: '1.5rem', opacity: workoutsToday > 0 ? 1 : 0.15 }}>△</span>
        </div>
        <div style={{
          padding: '1rem 1.25rem',
          background: medDone ? '#fff' : '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <p className="label" style={{ color: medDone ? '#555' : '#333', marginBottom: '0.2rem' }}>MEDITATION</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: medDone ? '#000' : '#fff', lineHeight: 1 }}>{medDone ? '✓' : '–'}</p>
          </div>
          <span style={{ fontSize: '1.5rem', opacity: medDone ? 1 : 0.15 }}>○</span>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '2px solid #1a1a1a' }}>
        {[
          { label: '+ MEAL',    path: '/nutrition?action=add' },
          { label: '+ WORKOUT', path: '/fitness?action=add' },
          { label: '+ MEDITATE',path: '/meditation' },
        ].map((b, i) => (
          <button
            key={b.label}
            onClick={() => { haptic('light'); router.push(b.path); }}
            style={{
              padding: '0.875rem 0.5rem',
              fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', background: '#000', color: '#555',
              border: 'none', borderRight: i < 2 ? '1px solid #1a1a1a' : 'none',
              cursor: 'pointer', fontFamily: MONO,
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* ── Habits ── */}
      <div>
        <div className="section-header">
          <p className="label">HABITS TODAY</p>
          <button
            onClick={() => { haptic('light'); router.push('/habits'); }}
            style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.12em', color: '#333', background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO }}
          >
            MANAGE →
          </button>
        </div>

        {habits.length === 0 && (
          <div style={{ padding: '2rem 1.25rem' }}>
            <p className="label" style={{ color: '#2a2a2a', marginBottom: '0.5rem' }}>NO HABITS YET</p>
            <button
              onClick={() => router.push('/habits')}
              style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: '#555', background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, textDecoration: 'underline' }}
            >
              ADD YOUR FIRST →
            </button>
          </div>
        )}

        {habits.map(h => (
          <button
            key={h.id}
            onClick={() => toggle(h.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.875rem',
              width: '100%', padding: '1rem 1.25rem',
              background: h.done ? '#fff' : '#000',
              border: 'none', borderBottom: '1px solid #0f0f0f',
              cursor: 'pointer', textAlign: 'left', fontFamily: MONO,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, minWidth: '1.75rem',
              color: h.done ? '#000' : '#333',
              transform: h.done ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 0.1s ease',
            }}>
              {h.done ? '[X]' : '[ ]'}
            </span>
            <span style={{
              flex: 1, fontSize: '0.875rem', fontWeight: 600,
              color: h.done ? '#000' : '#fff',
              textDecoration: h.done ? 'line-through' : 'none',
            }}>
              {h.name}
            </span>
            {h.streak > 0 ? (
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: h.done ? '#555' : '#F5A623', letterSpacing: '0.05em' }}>
                {h.streak}🔥
              </span>
            ) : (
              <span style={{ fontSize: '0.65rem', color: '#222' }}>–</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Suggested meditation ── */}
      {suggested && (
        <div style={{ borderTop: '2px solid #1a1a1a', borderBottom: '2px solid #1a1a1a' }}>
          <div className="section-header">
            <p className="label">START HERE</p>
            <p className="label" style={{ color: '#222' }}>{suggested.duration_min} MIN</p>
          </div>
          <button
            onClick={() => { haptic('light'); router.push(`/meditation/${suggested.id}`); }}
            style={{
              width: '100%', padding: '1.25rem',
              background: '#080808', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center',
              border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: MONO,
            }}
          >
            <div>
              <p style={{ margin: '0 0 0.3rem', fontWeight: 700, fontSize: '1rem', color: '#fff', letterSpacing: '-0.01em' }}>
                {suggested.name}
              </p>
              <p className="label">{suggested.category.toUpperCase()}</p>
            </div>
            <span style={{
              border: '2px solid #fff', background: '#fff', color: '#000',
              padding: '0.5rem 1rem', fontSize: '0.65rem', fontWeight: 700,
              letterSpacing: '0.1em', whiteSpace: 'nowrap',
            }}>
              START →
            </span>
          </button>
        </div>
      )}

      {/* ── Bottom padding ── */}
      <div style={{ height: '2rem' }} />
    </div>
  );
}
