'use client';

import { useEffect, useState, useCallback } from 'react';
import { getHabits, addHabit, deactivateHabit, getHabitCompletions, toggleHabitCompletion, getHabitStreak, todayISO, type Habit } from '@/lib/db';
import { hapticMedium, hapticSuccess } from '@/lib/haptic';
import StreakBadge from '@/components/StreakBadge';

const MONO = "'IBM Plex Mono', monospace";
const lbl = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--fg-muted)', margin: 0 };
const border2 = '2px solid var(--border-color)';

export default function HabitsPage() {
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [habits, setHabits] = useState<(Habit & { done: boolean; streak: number })[]>([]);
  const [addName, setAddName] = useState('');
  const [addAfter, setAddAfter] = useState<number | ''>('');
  const [addError, setAddError] = useState('');

  const load = useCallback(async () => {
    const today = todayISO();
    const [all, completions] = await Promise.all([
      getHabits(),
      getHabitCompletions(today),
    ]);
    const completedIds = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
    const enriched = await Promise.all(all.map(async h => ({
      ...h,
      done: completedIds.has(h.id),
      streak: await getHabitStreak(h.id),
    })));
    setHabits(enriched);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: number) => {
    hapticMedium();
    await toggleHabitCompletion(id);
    await load();
  };

  const deleteHabit = async (id: number) => {
    await deactivateHabit(id);
    await load();
  };

  const save = async () => {
    setAddError('');
    if (!addName.trim()) { setAddError('NAME REQUIRED'); return; }
    await addHabit({
      name: addName.trim(),
      active: true,
      stacked_after_habit_id: addAfter !== '' ? Number(addAfter) : null,
      streak_freeze_available: 0,
      created_at: new Date().toISOString(),
    });
    hapticSuccess();
    setAddName(''); setAddAfter('');
    await load();
    setMode('list');
  };

  const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);

  return (
    <div style={{ fontFamily: MONO }}>
      <div style={{ padding: '1rem', borderBottom: border2, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>HABITS</p>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--fg)' }}>HABITS</h1>
          {bestStreak > 0 && (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.65rem', color: 'var(--fg-muted)', fontWeight: 700, letterSpacing: '0.1em' }}>BEST STREAK: {bestStreak} DAYS</p>
          )}
        </div>
        <button onClick={() => { setMode(mode === 'add' ? 'list' : 'add'); setAddError(''); }}
          style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.5rem 0.75rem', border: border2, background: mode === 'add' ? 'var(--fg)' : 'var(--bg)', color: mode === 'add' ? 'var(--bg)' : 'var(--fg)', cursor: 'pointer' }}>
          {mode === 'add' ? '← BACK' : '+ NEW'}
        </button>
      </div>

      {mode === 'add' && (
        <div style={{ padding: '1rem', borderBottom: border2 }}>
          <p style={{ ...lbl, marginBottom: '1rem' }}>NEW HABIT</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {addError && <p style={{ margin: 0, color: 'var(--fg)', background: 'var(--bg-dark)', border: '1px solid var(--fg-muted)', padding: '0.5rem', fontSize: '0.75rem' }}>⚠ {addError}</p>}
            <div>
              <p style={{ ...lbl, marginBottom: '0.25rem' }}>HABIT NAME *</p>
              <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="E.G. MORNING WALK"
                style={{ width: '100%', fontFamily: MONO, fontSize: '0.875rem', background: 'var(--input-bg)', color: 'var(--fg)', border: '2px solid var(--border-color)', padding: '0.5rem 0.75rem', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <p style={{ ...lbl, marginBottom: '0.25rem' }}>STACKED AFTER (OPTIONAL)</p>
              <select value={addAfter} onChange={e => setAddAfter(e.target.value ? Number(e.target.value) : '')}
                style={{ width: '100%', fontFamily: MONO, fontSize: '0.875rem', background: 'var(--input-bg)', color: 'var(--fg)', border: '2px solid var(--border-color)', padding: '0.5rem 0.75rem', outline: 'none', boxSizing: 'border-box' as const }}>
                <option value="">NONE — STANDALONE HABIT</option>
                {habits.map(h => <option key={h.id} value={h.id}>AFTER: {h.name.toUpperCase()}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={save} style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--fg)', color: 'var(--bg)', border: border2, cursor: 'pointer', fontFamily: MONO }}>SAVE HABIT</button>
              <button onClick={() => setMode('list')} style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--bg)', color: 'var(--fg-muted)', border: '2px solid var(--border-color)', cursor: 'pointer', fontFamily: MONO }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {mode === 'list' && (
        <>
          {habits.length === 0 ? (
            <div style={{ padding: '2rem 1rem', color: 'var(--fg-dim)', fontSize: '0.75rem' }}>NO HABITS YET. TAP + NEW TO ADD ONE.</div>
          ) : habits.map(h => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', background: h.done ? 'var(--fg)' : 'var(--bg)', borderBottom: '1px solid var(--bg-dark)' }}>
              <button onClick={() => toggle(h.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, padding: '0.875rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: MONO }}>
                <span style={{ minWidth: '2.5rem', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '0.05em', color: h.done ? 'var(--bg)' : 'var(--fg)' }}>{h.done ? '[X]' : '[ ]'}</span>
                <span style={{ flex: 1, fontSize: '0.875rem', color: h.done ? 'var(--bg)' : 'var(--fg)', textDecoration: h.done ? 'line-through' : 'none' }}>{h.name}</span>
                <StreakBadge streak={h.streak} />
              </button>
              <button onClick={() => deleteHabit(h.id)} style={{ background: 'none', border: 'none', color: 'var(--fg-dim)', cursor: 'pointer', fontSize: '1rem', fontFamily: MONO, padding: '0.875rem 1rem' }}>✕</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
