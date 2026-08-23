'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { getHabits, addHabit, deactivateHabit, getHabitCompletions, toggleHabitCompletion, getHabitStreaks, getHabitCompletionsRange, todayISO, type Habit } from '@/lib/db';
import { ScoreRing } from '@/components/ScoreRing';
import { haptic } from '@/lib/haptic';

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

function HabitItem({ h, idx, total, last7, historyMap, onToggle, onDelete }: {
  h: HabitRow;
  idx: number;
  total: number;
  last7: string[];
  historyMap: Map<string, boolean>;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const todayStr = todayISO();
  return (
    <div style={{
      padding: '12px 16px 10px',
      borderBottom: idx < total - 1 ? '1px solid var(--border)' : 'none',
      background: h.done ? 'rgba(31,88,242,0.04)' : 'transparent',
      transition: 'background 0.15s',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Checkbox */}
        <button
          onClick={() => onToggle(h.id)}
          style={{
            width: 22, height: 22, borderRadius: 5,
            border: '1px solid var(--border-2)',
            background: h.done ? '#1F58F2' : 'transparent',
            cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 12, fontWeight: 510,
            transition: 'all 0.15s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {h.done ? '✓' : ''}
        </button>

        {/* Name */}
        <button
          onClick={() => onToggle(h.id)}
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

        {/* Streak */}
        {h.streak > 0 && (
          <span className="badge" style={{ marginRight: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            {h.streak}d 🔥
            {h.streak_freeze_available > 0 && (
              <span style={{ fontSize: 11, background: 'rgba(99,211,255,0.15)', border: '1px solid rgba(99,211,255,0.25)', borderRadius: 4, padding: '1px 4px', color: '#63d3ff', lineHeight: 1 }}>
                ❄️{h.streak_freeze_available}
              </span>
            )}
          </span>
        )}
        {h.streak === 0 && h.streak_freeze_available > 0 && (
          <span style={{ fontSize: 11, background: 'rgba(99,211,255,0.15)', border: '1px solid rgba(99,211,255,0.25)', borderRadius: 4, padding: '1px 4px', color: '#63d3ff', lineHeight: 1, marginRight: 6 }}>
            ❄️{h.streak_freeze_available}
          </span>
        )}

        {/* Delete */}
        <button
          onClick={() => onDelete(h.id)}
          style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, padding: '4px 6px', flexShrink: 0, WebkitTapHighlightColor: 'transparent', lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      {/* 7-day dot grid */}
      {last7.length === 7 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 8, paddingLeft: 34 }}>
          {last7.map((date) => {
            const done = historyMap.get(`${h.id}|${date}`) === true;
            const isToday = date === todayStr;
            const label = DAY_LABELS[dayOfWeekMon(date)];
            return (
              <div key={date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 9, color: isToday ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)', letterSpacing: '0.02em', lineHeight: 1, fontWeight: isToday ? 600 : 400 }}>
                  {label}
                </span>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: done ? '#1F58F2' : isToday ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
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
}

function HabitBlock({ label, icon, list, done, last7, historyMap, onToggle, onDelete }: {
  label: string;
  icon: string;
  list: HabitRow[];
  done: number;
  last7: string[];
  historyMap: Map<string, boolean>;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  if (list.length === 0) return null;
  const allDone = done === list.length;
  return (
    <div>
      {/* Block header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>{icon}</span>
          <span style={{ fontSize: 10, letterSpacing: '0.10em', color: 'rgba(255,255,255,0.28)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
        </div>
        <span style={{ fontSize: 10, letterSpacing: '0.06em', color: allDone ? '#1F58F2' : 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)' }}>
          {done}/{list.length}
        </span>
      </div>

      {/* Card */}
      <div style={{ background: 'var(--color-carbon)', borderRadius: 20, border: 'none', overflow: 'hidden' }}>
        {list.map((h, idx) => (
          <HabitItem
            key={h.id}
            h={h} idx={idx} total={list.length}
            last7={last7} historyMap={historyMap}
            onToggle={onToggle} onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

export default function HabitsPage() {
  const [mode, setMode]       = useState<'list' | 'add'>('list');
  const [habits, setHabits]   = useState<HabitRow[]>([]);
  const [addName, setAddName] = useState('');
  const [addAfter, setAddAfter] = useState<number | ''>('');
  const [addError, setAddError] = useState('');
  const [historyMap, setHistoryMap] = useState<Map<string, boolean>>(new Map());
  const [last7, setLast7]     = useState<string[]>([]);

  const load = useCallback(async () => {
    const today = todayISO();
    const days = getLast7Days();
    setLast7(days);
    const [all, completions] = await Promise.all([getHabits(), getHabitCompletions(today)]);
    const completedIds = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
    const ids = all.map(h => h.id);
    const [streaks, history] = await Promise.all([
      getHabitStreaks(ids),
      getHabitCompletionsRange(ids, days[0], today),
    ]);
    setHabits(all.map(h => ({ ...h, done: completedIds.has(h.id), streak: streaks.get(h.id) ?? 0 })));
    setHistoryMap(history);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: number) => { haptic('medium'); await toggleHabitCompletion(id); await load(); };
  const deleteHabit = async (id: number) => { haptic('heavy'); await deactivateHabit(id); await load(); };

  const save = async () => {
    setAddError('');
    if (!addName.trim()) { setAddError('Name required'); return; }
    await addHabit({ name: addName.trim(), active: true, routine: 'morning', stacked_after_habit_id: addAfter !== '' ? Number(addAfter) : null, streak_freeze_available: 0, created_at: new Date().toISOString() });
    setAddName(''); setAddAfter('');
    await load(); setMode('list');
  };

  const morningHabits = habits.filter(h => h.schedule?.time === 'morning');
  const eveningHabits = habits.filter(h => h.schedule?.time === 'evening');
  const ungrouped     = habits.filter(h => !h.schedule?.time);
  const doneCount     = habits.filter(h => h.done).length;
  const score         = habits.length > 0 ? Math.round((doneCount / habits.length) * 100) : 0;

  return (
    <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4rem', paddingBottom: '8rem' }}>

      {/* Header */}
      <div style={{ padding: '20px 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 8 }}>Daily</p>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff', margin: 0 }}>Habits</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {habits.length > 0 && (
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>{doneCount}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', letterSpacing: '-0.01em' }}>/{habits.length}</span>
            </div>
          )}
          <button
            onClick={() => { setMode(mode === 'add' ? 'list' : 'add'); setAddError(''); }}
            style={{
              background: mode === 'add' ? 'rgba(255,255,255,0.10)' : '#fff',
              color: mode === 'add' ? '#fff' : '#000',
              border: 'none', borderRadius: 99,
              padding: '8px 16px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            {mode === 'add' ? 'Cancel' : '+ New'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {habits.length > 0 && mode === 'list' && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ background: 'var(--color-carbon)', borderRadius: 20, border: 'none', padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Progress</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.50)' }}>{doneCount}/{habits.length}</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${score}%`, background: '#fff', borderRadius: 99, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      {habits.length > 0 && mode === 'list' && (() => {
        const streakSum = habits.reduce((a, h) => a + h.streak, 0);
        const maxStreak = habits.reduce((a, h) => Math.max(a, h.streak), 0);
        return (
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[['Streak', maxStreak + 'd', 'Best streak'], ['Done', doneCount.toString(), 'Today'], ['Rate', score + '%', 'Completion']].map(([lbl, val, sub]) => (
                <div key={lbl} style={{ background: 'var(--color-carbon)', borderRadius: 18, border: 'none', padding: '14px 14px 12px' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', display: 'block', marginBottom: 6 }}>{lbl}</span>
                  <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1, display: 'block' }}>{val}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', display: 'block', marginTop: 3 }}>{sub}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Add form */}
      {mode === 'add' && (
        <div style={{ margin: '0 16px 16px', background: 'var(--color-carbon)', borderRadius: 20, border: 'none', padding: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', marginBottom: 20 }}>New habit</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {addError && (
              <div style={{ background: 'rgba(235,87,87,0.08)', border: '1px solid rgba(235,87,87,0.2)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#ff6b6b' }}>
                {addError}
              </div>
            )}
            <div>
              <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginBottom: 8 }}>Habit name</p>
              <input value={addName} onChange={e => setAddName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="e.g. Morning walk" autoFocus
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: '14px 16px', color: '#fff', fontSize: 15, width: '100%' }} />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginBottom: 8 }}>Stack after (optional)</p>
              <select value={addAfter} onChange={e => setAddAfter(e.target.value ? Number(e.target.value) : '')}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: '14px 16px', color: '#fff', fontSize: 15, width: '100%' }}>
                <option value="">None — standalone</option>
                {habits.map(h => <option key={h.id} value={h.id}>After: {h.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button onClick={save}
                style={{ flex: 1, background: '#fff', color: '#000', border: 'none', borderRadius: 99, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setMode('list')}
                style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: 99, padding: '14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Habit list */}
      {mode === 'list' && (
        <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 4 }}>
          {habits.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--color-carbon)', borderRadius: 20, border: 'none' }}>
              <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', marginBottom: 8 }}>No habits yet</p>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6, marginBottom: 20 }}>Athletes who track daily habits hit their goals 2× more often.</p>
              <button onClick={() => setMode('add')} style={{ background: '#fff', color: '#000', border: 'none', borderRadius: 99, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Add your first habit</button>
            </div>
          ) : (
            <>
              <HabitBlock label="MORNING" icon="☀️" list={morningHabits} done={morningHabits.filter(h => h.done).length} last7={last7} historyMap={historyMap} onToggle={toggle} onDelete={deleteHabit} />
              <HabitBlock label="EVENING" icon="🌙" list={eveningHabits} done={eveningHabits.filter(h => h.done).length} last7={last7} historyMap={historyMap} onToggle={toggle} onDelete={deleteHabit} />
              {ungrouped.length > 0 && (
                <HabitBlock label="ALL DAY" icon="○" list={ungrouped} done={ungrouped.filter(h => h.done).length} last7={last7} historyMap={historyMap} onToggle={toggle} onDelete={deleteHabit} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
