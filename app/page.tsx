'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  db,
  seedDatabase,
  todayISO,
  getTodayMacros,
  getTodayHabitStatus,
  getHabitStreak,
  type Habit,
  type HabitCompletion,
  type MeditationSession,
  type Insight,
  type Profile,
} from '@/lib/db';
import StatusGrid from '@/components/StatusGrid';
import QuickAdd from '@/components/QuickAdd';
import HabitRow from '@/components/HabitRow';
import Link from 'next/link';

interface HabitWithStatus {
  habit: Habit;
  streak: number;
  completed: boolean;
}

export default function TodayPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [macros, setMacros] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [habitStatus, setHabitStatus] = useState({ completed: 0, total: 0 });
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [workoutsToday, setWorkoutsToday] = useState(0);
  const [meditationToday, setMeditationToday] = useState(0);
  const [suggestedSession, setSuggestedSession] = useState<MeditationSession | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    await seedDatabase();

    const today = todayISO();
    const [prof, mac, habitStat, activeHabits, completions, workouts, medLogs, sessions, insights] =
      await Promise.all([
        db.profile.get(1),
        getTodayMacros(),
        getTodayHabitStatus(),
        db.habit.where('active').equals(1).toArray(),
        db.habit_completion.where('date').equals(today).toArray(),
        db.workout_log.where('date').equals(today).toArray(),
        db.meditation_log.where('date').equals(today).toArray(),
        db.meditation_session.toArray(),
        db.insight.where('shown').equals(0).limit(1).toArray(),
      ]);

    setProfile(prof ?? null);
    setMacros(mac);
    setHabitStatus(habitStat);
    setWorkoutsToday(workouts.length);
    setMeditationToday(medLogs.reduce((a, l) => a + l.duration_actual_min, 0));

    // Build habit rows with streak data
    const completionMap = new Map<number, HabitCompletion>();
    for (const c of completions) {
      if (!completionMap.has(c.habit_id) || c.completed_at) {
        completionMap.set(c.habit_id, c);
      }
    }

    const habitRows: HabitWithStatus[] = await Promise.all(
      activeHabits.map(async (h) => {
        const c = completionMap.get(h.id);
        const streak = await getHabitStreak(h.id);
        return { habit: h, streak, completed: !!c?.completed_at };
      })
    );
    setHabits(habitRows);

    // Suggest a session (pick one not done today)
    const doneSessions = new Set(medLogs.map((l) => l.session_id));
    const undone = sessions.filter((s) => !doneSessions.has(s.id));
    const pick = undone.length > 0 ? undone[Math.floor(Math.random() * undone.length)] : sessions[0];
    setSuggestedSession(pick ?? null);

    // Insight card (only if data exists)
    setInsight(insights[0] ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).toUpperCase();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          fontFamily: "'IBM Plex Mono', monospace",
          color: '#444',
          fontSize: '0.75rem',
          letterSpacing: '0.15em',
        }}
      >
        LOADING...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          padding: '1rem',
          borderBottom: '2px solid #444',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>
            {dateStr}
          </p>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#fff',
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            TODAY
          </h1>
        </div>
        <Link href="/log" className="btn" style={{ fontSize: '0.6rem', padding: '0.5rem 0.75rem' }}>
          + LOG
        </Link>
      </div>

      {/* Status Grid */}
      <StatusGrid
        calories={macros.calories}
        calorieTarget={profile?.calorie_target ?? 2000}
        habitsCompleted={habitStatus.completed}
        habitsTotal={habitStatus.total}
        workoutsToday={workoutsToday}
        meditationToday={meditationToday}
      />

      {/* Quick Add */}
      <QuickAdd />

      {/* Habit Checklist */}
      <div>
        <div
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid #111',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span className="label">HABITS TODAY</span>
          <Link
            href="/habits"
            style={{
              fontSize: '0.6rem',
              color: '#444',
              textDecoration: 'none',
              letterSpacing: '0.1em',
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            MANAGE →
          </Link>
        </div>

        {habits.length === 0 ? (
          <div
            style={{
              padding: '1.5rem 1rem',
              color: '#444',
              fontSize: '0.75rem',
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            NO ACTIVE HABITS.{' '}
            <Link href="/habits" style={{ color: '#888', textDecoration: 'underline' }}>
              ADD ONE →
            </Link>
          </div>
        ) : (
          habits.map(({ habit, streak, completed }) => (
            <HabitRow
              key={habit.id}
              habitId={habit.id}
              name={habit.name}
              streak={streak}
              completed={completed}
              onToggle={loadData}
            />
          ))
        )}
      </div>

      {/* Suggested Meditation */}
      {suggestedSession && (
        <div style={{ borderTop: '2px solid #444', borderBottom: '2px solid #444', marginTop: '0' }}>
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #111',
            }}
          >
            <span className="label">SUGGESTED MEDITATION</span>
          </div>
          <Link
            href={`/meditation/${suggestedSession.id}`}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div
              style={{
                padding: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <p
                  style={{
                    color: '#fff',
                    fontWeight: 700,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.875rem',
                    marginBottom: '0.25rem',
                  }}
                >
                  {suggestedSession.name}
                </p>
                <p className="label">
                  {suggestedSession.category} · {suggestedSession.duration_min} MIN
                </p>
              </div>
              <span style={{ color: '#444', fontSize: '1.25rem' }}>→</span>
            </div>
          </Link>
        </div>
      )}

      {/* Insight Card — only when data exists */}
      {insight && (
        <div style={{ margin: '0', borderBottom: '2px solid #444' }}>
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #111',
            }}
          >
            <span className="label">INSIGHT</span>
          </div>
          <div style={{ padding: '1rem' }}>
            <p
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.875rem',
                color: '#fff',
                lineHeight: 1.5,
              }}
            >
              {insight.relationship}
            </p>
            <p
              className="label"
              style={{ marginTop: '0.5rem' }}
            >
              {insight.metric_a} × {insight.metric_b} · {insight.data_points} DATA POINTS
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
