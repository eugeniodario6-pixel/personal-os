'use client';

import { useEffect, useState, useCallback } from 'react';
import { getTodayPlan, WEEKLY_PLAN } from '@/lib/exercises';
import styles from './page.module.css';

interface ExerciseLog {
  exercise_key: string;
  completed: boolean;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDate(d: Date): string {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function getWeekDates(): Date[] {
  const today = new Date();
  const dow = today.getDay(); // 0=sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function ExercisePage() {
  const today = new Date();
  const todayStr = toISODate(today);
  const todayPlan = getTodayPlan();

  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [weekCompletions, setWeekCompletions] = useState<Record<string, Record<string, boolean>>>({});
  const weekDates = getWeekDates();

  const fetchCompletions = useCallback(async () => {
    try {
      const res = await fetch(`/api/exercise?date=${todayStr}`);
      if (res.ok) {
        const data: ExerciseLog[] = await res.json();
        const map: Record<string, boolean> = {};
        data.forEach((row) => { map[row.exercise_key] = row.completed; });
        setCompletions(map);
      }
    } catch (_) {}
  }, [todayStr]);

  const weekDateKeys = weekDates.map((d) => toISODate(d)).join(',');

  const fetchWeekCompletions = useCallback(async () => {
    const results: Record<string, Record<string, boolean>> = {};
    await Promise.all(
      weekDates.map(async (d) => {
        const dateStr = toISODate(d);
        try {
          const res = await fetch(`/api/exercise?date=${dateStr}`);
          if (res.ok) {
            const data: ExerciseLog[] = await res.json();
            const map: Record<string, boolean> = {};
            data.forEach((row) => { map[row.exercise_key] = row.completed; });
            results[dateStr] = map;
          }
        } catch (_) {}
      })
    );
    setWeekCompletions(results);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDateKeys]);

  useEffect(() => {
    fetchCompletions();
    fetchWeekCompletions();
  }, [fetchCompletions, fetchWeekCompletions]);

  const toggleExercise = async (key: string) => {
    const current = !!completions[key];
    const next = !current;
    setCompletions((prev) => ({ ...prev, [key]: next }));
    try {
      await fetch('/api/exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayStr, exercise_key: key, completed: next }),
      });
    } catch (_) {
      setCompletions((prev) => ({ ...prev, [key]: current }));
    }
  };

  const completedCount = todayPlan.exercises.filter((e) => completions[e.key]).length;
  const totalCount = todayPlan.exercises.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const sessionShort = todayPlan.session.split(' — ')[1] ?? todayPlan.session;
  const dayShort = dayNames[today.getDay() === 0 ? 6 : today.getDay() - 1].toLowerCase();

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>exercise</span>
        <div className={styles.headerRight}>
          <span className={styles.headerDate}>{formatDate(today)}</span>
          <span className={styles.sessionPill}>
            {dayShort} · {sessionShort}
          </span>
        </div>
      </div>

      {/* Programme card */}
      <div className={`${styles.card} ${styles.cardMargin}`}>
        <div className={styles.sessionTitle}>{todayPlan.session}</div>

        {todayPlan.exercises.length === 0 ? (
          <div className={styles.restDay}>rest day — recovery is progress</div>
        ) : (
          <ul className={styles.exerciseList}>
            {todayPlan.exercises.map((ex, idx) => {
              const done = !!completions[ex.key];
              return (
                <li
                  key={ex.key}
                  className={styles.exerciseRow}
                  style={{
                    borderBottom:
                      idx < todayPlan.exercises.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                  onClick={() => toggleExercise(ex.key)}
                >
                  <div className={`${styles.checkbox} ${done ? styles.checked : ''}`}>
                    {done && <span className={styles.checkmark}>✓</span>}
                  </div>
                  <span className={`${styles.exName} ${done ? styles.exDone : ''}`}>
                    {ex.name}
                  </span>
                  <span className={styles.setsReps}>
                    {ex.sets} × {ex.reps}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {todayPlan.exercises.length > 0 && (
          <div
            className={styles.summary}
            style={{ color: allDone ? 'var(--positive)' : 'var(--text-secondary)' }}
          >
            {allDone ? 'session complete 🎉' : `${completedCount} / ${totalCount} exercises`}
          </div>
        )}
      </div>

      {/* Week day pills */}
      <div className={styles.weekRow}>
        {weekDates.map((d, i) => {
          const dateStr = toISODate(d);
          const isToday = dateStr === todayStr;
          const isPast = d < today && !isToday;
          const isFuture = d > today;
          const plan = WEEKLY_PLAN[i];
          const dayCompletions = weekCompletions[dateStr] ?? {};
          const dayTotal = plan?.exercises.length ?? 0;
          const dayDone = plan?.exercises.filter((e) => dayCompletions[e.key]).length ?? 0;
          const fullComplete = dayTotal > 0 && dayDone === dayTotal;
          const isRestDay = dayTotal === 0;

          let pillClass = styles.dayPill;
          if (isToday) pillClass += ` ${styles.dayPillActive}`;
          else if (fullComplete) pillClass += ` ${styles.dayPillComplete}`;
          else if (isPast && !isRestDay) pillClass += ` ${styles.dayPillPast}`;
          else if (isFuture) pillClass += ` ${styles.dayPillFuture}`;

          return (
            <div key={dateStr} className={pillClass}>
              {dayNames[i]}
            </div>
          );
        })}
      </div>
    </main>
  );
}
