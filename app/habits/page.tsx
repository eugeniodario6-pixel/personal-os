'use client';

import { useEffect, useState, useCallback } from 'react';
import { getHabits, addHabit, deactivateHabit, getHabitCompletions, toggleHabitCompletion, getHabitStreaks, getHabitCompletionsRange, todayISO, type Habit } from '@/lib/db';
import { ScoreRing } from '@/components/ScoreRing';
import { haptic } from '@/lib/haptic';

/** Return last 7 calendar dates (oldest first, today last) as ISO strings */
function getLast7Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Get Mon-indexed day label index (0=Mon … 6=Sun) for a given ISO date */
function dayOfWeekMon(iso: string): number {
  const d = new Date(iso + 'T00:00:00');
  return (d.getDay() + 6) % 7; // JS getDay: 0=Sun → convert to Mon=0
}

interface HabitRow extends Habit {
  done: boolean;
  streak: number;
}

export default function HabitsPage() {
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [addName, setAddName] = useState('');
  const [addAfter, setAddAfter] = useState<number | ''>('');
  const [addError, setAddError] = useState('');
  // Map of "habitId|date" → true for each completed day in the last 7
  const [historyMap, setHistoryMap] = useState<Map<string, boolean>>(new Map());
  const [last7, setLast7] = useState<string[]>([]);

  const load = useCallback(async () => {
    const today = todayISO();
    const days = getLast7Days();
    setLast7(days);
    const fromDate = days[0];

    const [all, completions] = await Promise.all([getHabits(), getHabitCompletions(today)]);
    const completedIds = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
    const ids = all.map(h => h.id);
    const [streaks, history] = await Promise.all([
      getHabitStreaks(ids),
      getHabitCompletionsRange(ids, fromDate, today),
    ]);
    const enriched = all.map(h => ({ ...h, done: completedIds.has(h.id), streak: streaks.get(h.id) ?? 0 }));
    setHabits(enriched);
    setHistoryMap(history);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: number) => { haptic('medium'); await toggleHabitCompletion(id); await load(); };
  const deleteHabit = async (id: number) => { haptic('heavy'); await deactivateHabit(id); await load(); };

  const save = async () => {
    setAddError('');
    if (!addName.trim()) { setAddError('Name required'); return; }
    await addHabit({
      name: addName.trim(), active: true,
      stacked_after_habit_id: addAfter !== '' ? Number(addAfter) : null,
      streak_freeze_available: 0, created_at: new Date().toISOString(),
    });
    setAddName(''); setAddAfter('');
    await load(); setMode('list');
  };

  const doneCount = habits.filter(h => h.done).length;
  const score = habits.length > 0 ? Math.round((doneCount / habits.length) * 100) : 0;

  return (
    <div style={{ minHeight: '100dvh', background: '#000000', paddingTop: '4rem', paddingBottom: '8rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 6 }}>Daily</p>
          <h1 style={{ fontSize: 40, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1.1, color: '#ffffff', margin: 0 }}>Habits</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {habits.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '-0.011em' }}>
                {doneCount}/{habits.length}
              </span>
              <ScoreRing score={score} size={52} />
            </div>
          )}
          <button
            onClick={() => { setMode(mode === 'add' ? 'list' : 'add'); setAddError(''); }}
            className={mode === 'add' ? 'btn-ghost btn btn-sm' : 'btn btn-primary btn-sm'}
          >
            {mode === 'add' ? '← Back' : '+ New'}
          </button>
        </div>
      </div>

      {/* ── Add form ── */}
      {mode === 'add' && (
        <div style={{ margin: '16px 20px', background: '#141414', boxShadow: 'rgba(255,255,255,0.06) 0px 0px 0px 1px inset', borderRadius: 24, padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text-3)', marginBottom: 16 }}>New habit</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {addError && (
              <div style={{ background: 'rgba(235,87,87,0.08)', border: '1px solid rgba(235,87,87,0.2)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: 'var(--color-coral-red)', letterSpacing: '-0.011em' }}>
                {addError}
              </div>
            )}
            <div>
              <p className="label" style={{ marginBottom: 6 }}>Habit name</p>
              <input
                value={addName}
                onChange={e => setAddName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && save()}
                placeholder="e.g. Morning walk"
                autoFocus
                style={{ background: 'var(--surface-2)', boxShadow: 'var(--ring)', borderRadius: 14 }}
              />
            </div>
            <div>
              <p className="label" style={{ marginBottom: 6 }}>Stack after (optional)</p>
              <select
                value={addAfter}
                onChange={e => setAddAfter(e.target.value ? Number(e.target.value) : '')}
                style={{ background: 'var(--surface-2)', boxShadow: 'var(--ring)', borderRadius: 14 }}
              >
                <option value="">None — standalone</option>
                {habits.map(h => <option key={h.id} value={h.id}>After: {h.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button onClick={save} className="btn btn-primary" style={{ flex: 1 }}>Save</button>
              <button onClick={() => setMode('list')} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Habit list ── */}
      {mode === 'list' && (
        <div style={{ margin: '16px 20px', background: '#141414', boxShadow: 'rgba(255,255,255,0.06) 0px 0px 0px 1px inset', borderRadius: 24, overflow: 'hidden' }}>
          {habits.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text)', marginBottom: 6 }}>No habits tracked yet</p>
              <p style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '-0.011em', lineHeight: 1.6, marginBottom: 16 }}>
                Athletes who track daily habits hit their goals 2× more often.
              </p>
              <button
                onClick={() => setMode('add')}
                className="btn btn-primary btn-sm"
              >
                Add your first habit →
              </button>
            </div>
          ) : habits.map((h, idx) => {
            // Build day-of-week label grid aligned Mon → Sun
            // last7 contains the 7 most recent calendar days (oldest→newest)
            // We show exactly those 7 dates with their actual day-of-week labels
            const todayStr = todayISO();

            return (
              <div
                key={h.id}
                style={{
                  padding: '12px 16px 10px',
                  borderBottom: idx < habits.length - 1 ? '1px solid var(--border)' : 'none',
                  background: h.done ? 'rgba(255,255,255,0.02)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                {/* Top row: checkbox + name + badges + delete */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {/* Checkbox */}
                  <button
                    onClick={() => toggle(h.id)}
                    style={{
                      width: 22, height: 22,
                      borderRadius: 5,
                      border: `1px solid var(--border-2)`,
                      background: h.done ? 'var(--text)' : 'transparent',
                      cursor: 'pointer', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--invert)',
                      fontSize: 12, fontWeight: 510,
                      transition: 'all 0.15s',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {h.done ? '✓' : ''}
                  </button>

                  {/* Name */}
                  <button
                    onClick={() => toggle(h.id)}
                    style={{
                      flex: 1, background: 'transparent', border: 'none', cursor: 'pointer',
                      textAlign: 'left', padding: '0 12px',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <span style={{
                      fontSize: 15, fontWeight: 400, letterSpacing: '-0.011em',
                      color: h.done ? 'var(--text-3)' : 'var(--text)',
                      textDecoration: h.done ? 'line-through' : 'none',
                    }}>
                      {h.name}
                    </span>
                  </button>

                  {/* Streak + optional freeze badge */}
                  {h.streak > 0 && (
                    <span className="badge" style={{ marginRight: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {h.streak}d 🔥
                      {h.streak_freeze_available > 0 && (
                        <span style={{
                          fontSize: 11, background: 'rgba(99,211,255,0.15)',
                          border: '1px solid rgba(99,211,255,0.25)',
                          borderRadius: 4, padding: '1px 4px',
                          color: '#63d3ff', lineHeight: 1,
                        }}>
                          ❄️{h.streak_freeze_available}
                        </span>
                      )}
                    </span>
                  )}
                  {/* Freeze badge when there's no streak yet */}
                  {h.streak === 0 && h.streak_freeze_available > 0 && (
                    <span style={{
                      fontSize: 11, background: 'rgba(99,211,255,0.15)',
                      border: '1px solid rgba(99,211,255,0.25)',
                      borderRadius: 4, padding: '1px 4px',
                      color: '#63d3ff', lineHeight: 1,
                      marginRight: 6,
                    }}>
                      ❄️{h.streak_freeze_available}
                    </span>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => deleteHabit(h.id)}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-3)',
                      cursor: 'pointer', fontSize: 14, padding: '4px 6px', flexShrink: 0,
                      WebkitTapHighlightColor: 'transparent',
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* 7-day history dot grid */}
                {last7.length === 7 && (
                  <div style={{
                    display: 'flex', gap: 4, marginTop: 8,
                    paddingLeft: 34, // indent to align under habit name (past checkbox)
                  }}>
                    {last7.map((date) => {
                      const done = historyMap.get(`${h.id}|${date}`) === true;
                      const isToday = date === todayStr;
                      const label = DAY_LABELS[dayOfWeekMon(date)];
                      return (
                        <div key={date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          {/* Day label */}
                          <span style={{
                            fontSize: 9,
                            color: isToday ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)',
                            letterSpacing: '0.02em',
                            lineHeight: 1,
                            fontWeight: isToday ? 600 : 400,
                          }}>
                            {label}
                          </span>
                          {/* Dot */}
                          <div style={{
                            width: 10, height: 10,
                            borderRadius: '50%',
                            background: done
                              ? '#a3e635'  // lime-400 for completed
                              : isToday
                                ? 'rgba(255,255,255,0.12)' // slightly brighter for today if not done
                                : 'rgba(255,255,255,0.07)',  // dark for missed
                            border: isToday && !done ? '1px solid rgba(255,255,255,0.2)' : 'none',
                            transition: 'background 0.2s',
                          }} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
