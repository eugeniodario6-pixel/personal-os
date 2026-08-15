'use client';

import { useEffect, useState, useCallback } from 'react';
import { getHabits, addHabit, deactivateHabit, getHabitCompletions, toggleHabitCompletion, getHabitStreak, todayISO, type Habit } from '@/lib/db';

const MONO = "'IBM Plex Mono', monospace";
const lbl = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#888', margin: 0 };
const border2 = '2px solid #444';

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
    setAddName(''); setAddAfter('');
    await load();
    setMode('list');
  };

  return (
    <div style={{ fontFamily: MONO }}>
      <div style={{ padding: '1rem', borderBottom: border2, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>HABITS</p>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>HABITS</h1>
        </div>
        <button onClick={() => { setMode(mode === 'add' ? 'list' : 'add'); setAddError(''); }}
          style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.5rem 0.75rem', border: border2, background: mode === 'add' ? '#fff' : '#000', color: mode === 'add' ? '#000' : '#fff', cursor: 'pointer' }}>
          {mode === 'add' ? '← BACK' : '+ NEW'}
        </button>
      </div>

      {mode === 'add' && (
        <div style={{ padding: '1rem', borderBottom: border2 }}>
          <p style={{ ...lbl, marginBottom: '1rem' }}>NEW HABIT</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {addError && <p style={{ margin: 0, color: '#fff', background: '#111', border: '1px solid #888', padding: '0.5rem', fontSize: '0.75rem' }}>⚠ {addError}</p>}
            <div>
              <p style={{ ...lbl, marginBottom: '0.25rem' }}>HABIT NAME *</p>
              <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="E.G. MORNING WALK"
                style={{ width: '100%', fontFamily: MONO, fontSize: '0.875rem', background: '#000', color: '#fff', border: '2px solid #444', padding: '0.5rem 0.75rem', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <p style={{ ...lbl, marginBottom: '0.25rem' }}>STACKED AFTER (OPTIONAL)</p>
              <select value={addAfter} onChange={e => setAddAfter(e.target.value ? Number(e.target.value) : '')}
                style={{ width: '100%', fontFamily: MONO, fontSize: '0.875rem', background: '#000', color: '#fff', border: '2px solid #444', padding: '0.5rem 0.75rem', outline: 'none', boxSizing: 'border-box' as const }}>
                <option value="">NONE — STANDALONE HABIT</option>
                {habits.map(h => <option key={h.id} value={h.id}>AFTER: {h.name.toUpperCase()}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={save} style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: '#fff', color: '#000', border: border2, cursor: 'pointer', fontFamily: MONO }}>SAVE HABIT</button>
              <button onClick={() => setMode('list')} style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: '#000', color: '#888', border: '2px solid #444', cursor: 'pointer', fontFamily: MONO }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {mode === 'list' && (
        <>
          {habits.length === 0 ? (
            <div style={{ padding: '2rem 1rem', color: '#444', fontSize: '0.75rem' }}>NO HABITS YET. TAP + NEW TO ADD ONE.</div>
          ) : habits.map(h => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', background: h.done ? '#fff' : '#000', borderBottom: '1px solid #111' }}>
              <button onClick={() => toggle(h.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, padding: '0.875rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: MONO }}>
                <span style={{ minWidth: '2.5rem', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '0.05em', color: h.done ? '#000' : '#fff' }}>{h.done ? '[X]' : '[ ]'}</span>
                <span style={{ flex: 1, fontSize: '0.875rem', color: h.done ? '#000' : '#fff', textDecoration: h.done ? 'line-through' : 'none' }}>{h.name}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: h.done ? '#444' : '#888' }}>{h.streak} DAY{h.streak !== 1 ? 'S' : ''}</span>
              </button>
              <button onClick={() => deleteHabit(h.id)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '1rem', fontFamily: MONO, padding: '0.875rem 1rem' }}>✕</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
