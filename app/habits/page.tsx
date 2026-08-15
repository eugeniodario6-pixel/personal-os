'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  db,
  todayISO,
  getHabitStreak,
  toggleHabitCompletion,
  type Habit,
  type HabitCompletion,
} from '@/lib/db';

type ViewMode = 'list' | 'add' | 'calendar';

interface HabitWithMeta {
  habit: Habit;
  streak: number;
  completedToday: boolean;
}

function StreakCalendar({ habitId }: { habitId: number }) {
  const [completions, setCompletions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.habit_completion
      .where('habit_id')
      .equals(habitId)
      .and((c) => c.completed_at !== null)
      .toArray()
      .then((rows) => {
        setCompletions(new Set(rows.map((r) => r.date)));
        setLoading(false);
      });
  }, [habitId]);

  if (loading) return null;

  // Show last 28 days
  const days: string[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #111' }}>
      <p className="label" style={{ marginBottom: '0.5rem' }}>LAST 28 DAYS</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', gap: '2px' }}>
            {week.map((day) => {
              const done = completions.has(day);
              const isToday = day === todayISO();
              return (
                <div
                  key={day}
                  title={day}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    background: done ? '#fff' : '#111',
                    border: isToday ? '1px solid #888' : '1px solid #222',
                    flexShrink: 0,
                    flex: '1 1 0',
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ width: '10px', height: '10px', background: '#fff', border: '1px solid #444' }} />
          <span style={{ fontSize: '0.6rem', color: '#888', fontFamily: "'IBM Plex Mono', monospace" }}>DONE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ width: '10px', height: '10px', background: '#111', border: '1px solid #444' }} />
          <span style={{ fontSize: '0.6rem', color: '#888', fontFamily: "'IBM Plex Mono', monospace" }}>MISSED</span>
        </div>
      </div>
    </div>
  );
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<HabitWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ViewMode>('list');
  const [calendarHabitId, setCalendarHabitId] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formStackedAfter, setFormStackedAfter] = useState<number | ''>('');
  const [formError, setFormError] = useState('');

  const loadData = useCallback(async () => {
    const today = todayISO();
    const allHabits = await db.habit.toArray();
    const completions = await db.habit_completion.where('date').equals(today).toArray();
    const completedMap = new Map<number, HabitCompletion>();
    for (const c of completions) {
      if (!completedMap.has(c.habit_id) || c.completed_at) {
        completedMap.set(c.habit_id, c);
      }
    }

    const withMeta: HabitWithMeta[] = await Promise.all(
      allHabits.map(async (h) => {
        const streak = await getHabitStreak(h.id);
        const c = completedMap.get(h.id);
        return { habit: h, streak, completedToday: !!c?.completed_at };
      })
    );
    setHabits(withMeta);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle = async (habitId: number) => {
    await toggleHabitCompletion(habitId);
    await loadData();
  };

  const handleToggleActive = async (habit: Habit) => {
    await db.habit.update(habit.id, { active: !habit.active });
    await loadData();
  };

  const handleDelete = async (habitId: number) => {
    await db.habit.delete(habitId);
    await db.habit_completion.where('habit_id').equals(habitId).delete();
    await loadData();
  };

  const handleAddHabit = async () => {
    setFormError('');
    if (!formName.trim()) { setFormError('NAME REQUIRED'); return; }

    await db.habit.add({
      id: undefined as unknown as number,
      name: formName.trim(),
      schedule: { type: 'daily' },
      active: true,
      stacked_after_habit_id: formStackedAfter !== '' ? Number(formStackedAfter) : null,
      streak_freeze_available: 0,
      created_at: new Date().toISOString(),
    });

    setFormName('');
    setFormStackedAfter('');
    setFormError('');
    await loadData();
    setMode('list');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', fontFamily: "'IBM Plex Mono', monospace", color: '#444', fontSize: '0.75rem' }}>
        LOADING...
      </div>
    );
  }

  const activeHabits = habits.filter((h) => h.habit.active);
  const inactiveHabits = habits.filter((h) => !h.habit.active);

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '2px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>HABITS</p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', fontFamily: "'IBM Plex Mono', monospace" }}>HABITS</h1>
        </div>
        <button
          className="btn"
          onClick={() => { setMode(mode === 'add' ? 'list' : 'add'); setCalendarHabitId(null); }}
          style={{ fontSize: '0.6rem', padding: '0.5rem 0.75rem' }}
        >
          {mode === 'add' ? '← BACK' : '+ NEW'}
        </button>
      </div>

      {mode === 'add' && (
        <div style={{ padding: '1rem', borderBottom: '2px solid #444' }}>
          <p className="label" style={{ marginBottom: '1rem' }}>NEW HABIT</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {formError && (
              <p style={{ color: '#fff', background: '#111', border: '1px solid #888', padding: '0.5rem', fontSize: '0.75rem', fontFamily: "'IBM Plex Mono', monospace" }}>
                ⚠ {formError}
              </p>
            )}
            <div>
              <p className="label" style={{ marginBottom: '0.25rem' }}>HABIT NAME *</p>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="E.G. MORNING WALK" />
            </div>
            <div>
              <p className="label" style={{ marginBottom: '0.25rem' }}>STACKED AFTER (OPTIONAL)</p>
              <select value={formStackedAfter} onChange={(e) => setFormStackedAfter(e.target.value === '' ? '' : parseInt(e.target.value))}>
                <option value="">NONE — STANDALONE HABIT</option>
                {habits.filter((h) => h.habit.active).map((h) => (
                  <option key={h.habit.id} value={h.habit.id}>
                    AFTER: {h.habit.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-primary btn" onClick={handleAddHabit} style={{ flex: 1 }}>SAVE HABIT</button>
              <button className="btn btn-ghost" onClick={() => setMode('list')} style={{ flex: 1 }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {mode === 'list' && (
        <>
          {habits.length === 0 && (
            <div style={{ padding: '2rem 1rem', color: '#444', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>
              NO HABITS YET. ADD YOUR FIRST ONE.
            </div>
          )}

          {/* Active habits */}
          {activeHabits.length > 0 && (
            <div>
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
                <span className="label">ACTIVE — {activeHabits.length} HABITS</span>
              </div>
              {activeHabits.map(({ habit, streak, completedToday }) => (
                <div key={habit.id}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.875rem 1rem',
                      borderBottom: '1px solid #111',
                      background: completedToday ? '#111' : '#000',
                    }}
                  >
                    <button
                      onClick={() => handleToggle(habit.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginRight: '0.75rem', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: '0.875rem', color: completedToday ? '#fff' : '#444' }}
                    >
                      {completedToday ? '[X]' : '[ ]'}
                    </button>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: '0.875rem', color: completedToday ? '#888' : '#fff', textDecoration: completedToday ? 'line-through' : 'none' }}>
                        {habit.name}
                      </p>
                      {habit.stacked_after_habit_id && (
                        <p className="label" style={{ marginTop: '0.1rem' }}>
                          STACKED AFTER #{habit.stacked_after_habit_id}
                        </p>
                      )}
                    </div>
                    {streak > 0 && (
                      <span style={{ fontSize: '0.65rem', color: '#888', letterSpacing: '0.1em', fontFamily: "'IBM Plex Mono', monospace", marginRight: '0.75rem' }}>
                        {streak}D
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        onClick={() => setCalendarHabitId(calendarHabitId === habit.id ? null : habit.id)}
                        style={{ background: 'none', border: '1px solid #444', color: '#444', cursor: 'pointer', padding: '0.2rem 0.4rem', fontSize: '0.6rem', fontFamily: "'IBM Plex Mono', monospace', letterSpacing: '0.05em" }}
                      >
                        CAL
                      </button>
                      <button
                        onClick={() => handleToggleActive(habit)}
                        style={{ background: 'none', border: '1px solid #444', color: '#444', cursor: 'pointer', padding: '0.2rem 0.4rem', fontSize: '0.6rem', fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        PAUSE
                      </button>
                      <button
                        onClick={() => handleDelete(habit.id)}
                        style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '0.2rem', fontSize: '0.875rem', fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {calendarHabitId === habit.id && <StreakCalendar habitId={habit.id} />}
                </div>
              ))}
            </div>
          )}

          {/* Inactive habits */}
          {inactiveHabits.length > 0 && (
            <div style={{ borderTop: '2px solid #444' }}>
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
                <span className="label">PAUSED — {inactiveHabits.length} HABITS</span>
              </div>
              {inactiveHabits.map(({ habit, streak }) => (
                <div key={habit.id} style={{ display: 'flex', alignItems: 'center', padding: '0.875rem 1rem', borderBottom: '1px solid #111' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: '0.875rem', color: '#444' }}>
                      {habit.name}
                    </p>
                    {streak > 0 && <p className="label" style={{ marginTop: '0.1rem' }}>{streak}D STREAK (PAUSED)</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      onClick={() => handleToggleActive(habit)}
                      style={{ background: 'none', border: '1px solid #444', color: '#888', cursor: 'pointer', padding: '0.2rem 0.4rem', fontSize: '0.6rem', fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      RESUME
                    </button>
                    <button
                      onClick={() => handleDelete(habit.id)}
                      style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '0.2rem', fontSize: '0.875rem', fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
