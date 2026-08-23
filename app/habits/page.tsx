'use client';

export const dynamic = 'force-dynamic';

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

function dayOfWeekMon(iso: string): number {
  const d = new Date(iso + 'T00:00:00');
  return (d.getDay() + 6) % 7;
}

interface HabitRow extends Habit {
  done: boolean;
  streak: number;
}

export default function HabitsPage() {
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [addName, setAddName] = useState('');
  const [addRoutine, setAddRoutine] = useState<'morning' | 'evening'>('morning');
  const [addAfter, setAddAfter] = useState<number | ''>('');
  const [addError, setAddError] = useState('');
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
      name: addName.trim(),
      active: true,
      routine: addRoutine,
      stacked_after_habit_id: addAfter !== '' ? Number(addAfter) : null,
      streak_freeze_available: 0,
      created_at: new Date().toISOString(),
    });
    setAddName(''); setAddAfter(''); setAddRoutine('morning');
    await load(); setMode('list');
  };

  const morning = habits.filter(h => h.routine === 'morning');
  const evening = habits.filter(h => h.routine === 'evening');

  const morningDone = morning.filter(h => h.done).length;
  const eveningDone = evening.filter(h => h.done).length;
  const morningScore = morning.length > 0 ? Math.round((morningDone / morning.length) * 100) : 0;
  const eveningScore = evening.length > 0 ? Math.round((eveningDone / evening.length) * 100) : 0;

  const totalDone = habits.filter(h => h.done).length;
  const totalScore = habits.length > 0 ? Math.round((totalDone / habits.length) * 100) : 0;

  const renderHabitItem = (h: HabitRow, idx: number, groupLen: number) => {
    const todayStr = todayISO();
    return (
      <div
        key={h.id}
        style={{
          padding: '12px 16px 10px',
          borderBottom: idx < groupLen - 1 ? '1px solid var(--border)' : 'none',
          background: h.done ? 'rgba(255,255,255,0.02)' : 'transparent',
          transition: 'background 0.15s',
        }}
      >
        {/* Top row: checkbox + name + badges + delete */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
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
            paddingLeft: 34,
          }}>
            {last7.map((date) => {
              const done = historyMap.get(`${h.id}|${date}`) === true;
              const isToday = date === todayStr;
              const label = DAY_LABELS[dayOfWeekMon(date)];
              return (
                <div key={date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{
                    fontSize: 9,
                    color: isToday ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)',
                    letterSpacing: '0.02em',
                    lineHeight: 1,
                    fontWeight: isToday ? 600 : 400,
                  }}>
                    {label}
                  </span>
                  <div style={{
                    width: 10, height: 10,
                    borderRadius: '50%',
                    background: done
                      ? '#a3e635'
                      : isToday
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(255,255,255,0.07)',
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
  };

  const renderRoutineBlock = (
    label: string,
    emoji: string,
    accentColor: string,
    group: HabitRow[],
    done: number,
    score: number,
  ) => (
    <div style={{ margin: '0 20px 20px' }}>
      {/* Block header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{emoji}</span>
          <span style={{
            fontWeight: 510,
            color: 'rgba(255,255,255,0.55)',
            textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11,
          }}>
            {label}
          </span>
        </div>
        {group.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', letterSpacing: '-0.011em' }}>
              {done}/{group.length}
            </span>
            <ScoreRing score={score} size={40} />
          </div>
        )}
      </div>

      {/* Habit card */}
      <div style={{
        background: '#141414',
        boxShadow: `rgba(255,255,255,0.06) 0px 0px 0px 1px inset`,
        borderRadius: 'var(--r)',
        overflow: 'hidden',
        borderTop: `2px solid ${accentColor}22`,
      }}>
        {group.length === 0 ? (
          <div style={{ padding: '20px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '-0.011em' }}>
              No {label.toLowerCase()} habits yet
            </p>
          </div>
        ) : (
          group.map((h, idx) => renderHabitItem(h, idx, group.length))
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: '#000000', paddingTop: '4rem', paddingBottom: '8rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 6 }}>Daily</p>
          <h1 style={{ fontSize: 40, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1.1, color: '#ffffff', margin: 0 }}>Routines</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {habits.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '-0.011em' }}>
                {totalDone}/{habits.length}
              </span>
              <ScoreRing score={totalScore} size={52} />
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
        <div style={{ margin: '16px 20px', background: '#141414', boxShadow: 'rgba(255,255,255,0.06) 0px 0px 0px 1px inset', borderRadius: 'var(--r)', padding: 20 }}>
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
                style={{ background: 'var(--surface-2)', border: '1px solid rgba(216,234,255,0.08)', borderRadius: 14 }}
              />
            </div>

            {/* Routine toggle */}
            <div>
              <p className="label" style={{ marginBottom: 6 }}>Routine</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['morning', 'evening'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setAddRoutine(r)}
                    style={{
                      flex: 1, padding: '10px 0',
                      borderRadius: 12,
                      border: addRoutine === r
                        ? `1px solid ${r === 'morning' ? 'rgba(251,191,36,0.5)' : 'rgba(139,92,246,0.5)'}`
                        : '1px solid rgba(216,234,255,0.08)',
                      background: addRoutine === r
                        ? r === 'morning' ? 'rgba(251,191,36,0.08)' : 'rgba(139,92,246,0.08)'
                        : 'var(--surface-2)',
                      color: addRoutine === r ? 'var(--text)' : 'var(--text-3)',
                      fontSize: 13, fontWeight: addRoutine === r ? 510 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      WebkitTapHighlightColor: 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    {r === 'morning' ? '🌅' : '🌙'} {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="label" style={{ marginBottom: 6 }}>Stack after (optional)</p>
              <select
                value={addAfter}
                onChange={e => setAddAfter(e.target.value ? Number(e.target.value) : '')}
                style={{ background: 'var(--surface-2)', border: '1px solid rgba(216,234,255,0.08)', borderRadius: 14 }}
              >
                <option value="">None — standalone</option>
                {habits.filter(h => h.routine === addRoutine).map(h => (
                  <option key={h.id} value={h.id}>After: {h.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button onClick={save} className="btn btn-primary" style={{ flex: 1 }}>Save</button>
              <button onClick={() => setMode('list')} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Routine blocks ── */}
      {mode === 'list' && (
        <div style={{ marginTop: 8 }}>
          {renderRoutineBlock('Morning', '🌅', '#fbbf24', morning, morningDone, morningScore)}
          {renderRoutineBlock('Evening', '🌙', '#8b5cf6', evening, eveningDone, eveningScore)}
        </div>
      )}
    </div>
  );
}
