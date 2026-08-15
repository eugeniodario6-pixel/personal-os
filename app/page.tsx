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
import { calcDailyScore, scoreGrade } from '@/lib/score';
import { hapticMedium, hapticLight } from '@/lib/haptic';
import StreakBadge from '@/components/StreakBadge';

const MONO = "'IBM Plex Mono', monospace";
const label = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--fg-muted)', margin: 0 };
const border2 = '2px solid var(--border-color)';

export default function TodayPage() {
  const router = useRouter();
  const [calories, setCalories] = useState(0);
  const [calorieTarget, setCalorieTarget] = useState(2000);
  const [habits, setHabits] = useState<(Habit & { done: boolean; streak: number })[]>([]);
  const [workoutsToday, setWorkoutsToday] = useState(0);
  const [medDone, setMedDone] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [suggested, setSuggested] = useState<MeditationSession | null>(null);
  const [dateStr, setDateStr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      await seedUserData();
      const today = todayISO();
      setDateStr(new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase());

      const [macros, profile, activeHabits, completions, workouts, medLogs, insights, sessions] = await Promise.all([
        getTodayMacros(),
        getProfile(),
        getHabits(),
        getHabitCompletions(today),
        getWorkoutLogs(today),
        getMeditationLogs(today),
        getInsights(),
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
      setInsight(insights[0] ?? null);

      const loggedIds = new Set(medLogs.map(m => m.session_id));
      const unplayed = sessions.find(s => !loggedIds.has(s.id));
      setSuggested(unplayed ?? sessions[0] ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (habitId: number) => {
    hapticMedium();
    await toggleHabitCompletion(habitId);
    await load();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const habitDone = habits.filter(h => h.done).length;
  const habitTotal = habits.length;
  const calPct = Math.min((calories / calorieTarget) * 100, 100);
  const habitPct = habitTotal > 0 ? Math.min((habitDone / habitTotal) * 100, 100) : 0;
  const score = calcDailyScore({ calorieTarget, calories, habitDone, habitTotal, workoutsToday, medDone });
  const grade = scoreGrade(score);

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--fg-dim)', fontFamily: MONO, fontSize: '0.75rem' }}>LOADING...</div>;
  }

  return (
    <div style={{ fontFamily: MONO }}>
      {/* Score Hero */}
      <div style={{ width: '100%', borderBottom: border2, padding: '1.5rem 1rem', background: 'var(--bg)' }}>
        <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--fg-muted)', margin: '0 0 0.25rem' }}>TODAY&apos;S SCORE</p>
        <div className="animate-fadeIn" style={{ fontSize: '5rem', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--fg)' }}>{score}</div>
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--fg-muted)', margin: '0.25rem 0 0.75rem', fontWeight: 700 }}>{grade}</p>
        <div style={{ height: 4, background: 'var(--bg-dark)', border: '1px solid var(--border-color)' }}>
          <div className="progress-fill" style={{ width: `${score}%` }} />
        </div>
      </div>
      {/* Header */}
      <div style={{ padding: '1rem', paddingRight: '4rem', borderBottom: border2, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--fg-muted)', margin: 0, marginBottom: '0.25rem' }}>{dateStr}</p>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--fg)' }}>TODAY</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={() => router.push('/log')} style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.5rem 0.75rem', border: border2, background: 'var(--bg)', color: 'var(--fg)', cursor: 'pointer' }}>+ LOG</button>
          <button onClick={handleSignOut} style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.5rem 0.75rem', border: '2px solid var(--bg-dark)', background: 'var(--bg)', color: 'var(--fg-dim)', cursor: 'pointer' }}>OUT</button>
        </div>
      </div>

      {/* Status grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: border2 }}>
        <div style={{ borderRight: '1px solid var(--border-color)' }}>
          <div style={{ borderBottom: border2, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={label}>CALORIES</span>
            <span style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--fg)' }}>{calories}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--fg-muted)' }}>/ {calorieTarget} TARGET</span>
          </div>
          <div style={{ margin: '0 0.75rem 0.75rem', height: 4, background: 'var(--bg-dark)', border: '1px solid var(--border-color)' }}>
            <div style={{ height: '100%', background: 'var(--fg)', width: `${calPct}%` }} />
          </div>
        </div>
        <div>
          <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={label}>HABITS</span>
            <span style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--fg)' }}>{habitDone}/{habitTotal}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--fg-muted)' }}>{habitTotal > 0 ? `${Math.round(habitPct)}% COMPLETE` : 'NO HABITS SET'}</span>
          </div>
          <div style={{ margin: '0 0.75rem 0.75rem', height: 4, background: 'var(--bg-dark)', border: '1px solid var(--border-color)' }}>
            <div style={{ height: '100%', background: 'var(--fg)', width: `${habitPct}%` }} />
          </div>
        </div>
      </div>

      {/* Workouts + Meditation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: border2 }}>
        <div style={{ borderRight: '1px solid var(--border-color)', background: workoutsToday > 0 ? 'var(--fg)' : 'var(--bg)', color: workoutsToday > 0 ? 'var(--bg)' : 'var(--fg)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ ...label, color: workoutsToday > 0 ? 'var(--bg)' : 'var(--fg-muted)' }}>WORKOUTS</span>
          <span style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>{workoutsToday}</span>
          <span style={{ fontSize: '0.65rem', color: workoutsToday > 0 ? 'var(--bg-mid)' : 'var(--fg-muted)' }}>TODAY</span>
        </div>
        <div style={{ background: medDone ? 'var(--fg)' : 'var(--bg)', color: medDone ? 'var(--bg)' : 'var(--fg)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ ...label, color: medDone ? 'var(--bg)' : 'var(--fg-muted)' }}>MEDITATION</span>
          <span style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>{medDone ? 'DONE' : '–'}</span>
          <span style={{ fontSize: '0.65rem', color: medDone ? 'var(--bg-mid)' : 'var(--fg-muted)' }}>TODAY</span>
        </div>
      </div>

      {/* Quick add */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: border2 }}>
        {[
          { label: '+ MEAL', path: '/nutrition?action=add' },
          { label: '+ WORKOUT', path: '/fitness?action=add' },
          { label: '+ MEDITATE', path: '/meditation' },
        ].map((b, i) => (
          <button key={b.label} onClick={() => { hapticLight(); router.push(b.path); }} style={{ padding: '1rem 0.5rem', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'var(--bg)', color: 'var(--fg)', border: 'none', borderRight: i < 2 ? '1px solid var(--border-color)' : 'none', cursor: 'pointer' }}>
            {b.label}
          </button>
        ))}
      </div>

      {/* Habits */}
      <div>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--bg-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={label}>HABITS TODAY</span>
          <button onClick={() => router.push('/habits')} style={{ fontSize: '0.6rem', color: 'var(--fg-dim)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' }}>MANAGE →</button>
        </div>
        {habits.length === 0 && (
          <div style={{ padding: '1.5rem 1rem', color: 'var(--fg-dim)', fontSize: '0.75rem' }}>NO HABITS YET. <button onClick={() => router.push('/habits')} style={{ color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: '0.75rem', textDecoration: 'underline' }}>ADD ONE →</button></div>
        )}
        {habits.map(h => (
          <button key={h.id} onClick={() => toggle(h.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.875rem 1rem', background: h.done ? 'var(--fg)' : 'var(--bg)', border: 'none', borderBottom: '1px solid var(--bg-dark)', cursor: 'pointer', textAlign: 'left', fontFamily: MONO }}>
            <span style={{ minWidth: '2.5rem', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '0.05em', color: h.done ? 'var(--bg)' : 'var(--fg)' }}>{h.done ? '[X]' : '[ ]'}</span>
            <span style={{ flex: 1, fontSize: '0.875rem', color: h.done ? 'var(--bg)' : 'var(--fg)', textDecoration: h.done ? 'line-through' : 'none' }}>{h.name}</span>
            <StreakBadge streak={h.streak} />
          </button>
        ))}
      </div>

      {/* Suggested meditation */}
      {suggested && (
        <div style={{ borderTop: border2, borderBottom: border2 }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--bg-dark)' }}>
            <span style={label}>START HERE</span>
          </div>
          <button onClick={() => router.push(`/meditation/${suggested.id}`)} style={{ width: '100%', padding: '1rem', background: 'var(--bg-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: MONO }}>
            <div>
              <p style={{ margin: '0 0 0.25rem', fontWeight: 700, fontSize: '1rem', color: 'var(--fg)' }}>{suggested.name}</p>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--fg-muted)' }}>{suggested.category.toUpperCase()} · {suggested.duration_min} MIN</p>
            </div>
            <span style={{ border: border2, background: 'var(--fg)', color: 'var(--bg)', padding: '0.5rem 1rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>START →</span>
          </button>
        </div>
      )}

      {/* Insight card */}
      {insight && (
        <div style={{ borderBottom: border2, padding: '1rem' }}>
          <p style={{ ...label, marginBottom: '0.5rem' }}>INSIGHT</p>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--fg)', lineHeight: 1.6 }}>{insight.relationship}</p>
          <p style={{ ...label }}>{insight.data_points} DATA POINTS · {Math.round(insight.confidence * 100)}% CONFIDENCE</p>
        </div>
      )}
    </div>
  );
}
