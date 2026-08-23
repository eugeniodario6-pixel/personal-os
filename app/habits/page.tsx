'use client';

import { useEffect, useState, useCallback } from 'react';
import { getHabits, addHabit, deactivateHabit, getHabitCompletions, toggleHabitCompletion, getHabitStreak, todayISO, type Habit } from '@/lib/db';
import { haptic } from '@/lib/haptic';

export default function HabitsPage() {
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [habits, setHabits] = useState<(Habit & { done: boolean; streak: number })[]>([]);
  const [addName, setAddName] = useState('');
  const [addAfter, setAddAfter] = useState<number | ''>('');
  const [addError, setAddError] = useState('');

  const load = useCallback(async () => {
    const today = todayISO();
    const [all, completions] = await Promise.all([getHabits(), getHabitCompletions(today)]);
    const completedIds = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
    const enriched = await Promise.all(all.map(async h => ({
      ...h, done: completedIds.has(h.id), streak: await getHabitStreak(h.id),
    })));
    setHabits(enriched);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: number) => { haptic('medium'); await toggleHabitCompletion(id); await load(); };
  const remove = async (id: number) => { haptic('heavy'); await deactivateHabit(id); await load(); };
  const save = async () => {
    setAddError('');
    if (!addName.trim()) { setAddError('Name required'); return; }
    await addHabit({ name: addName.trim(), active: true, stacked_after_habit_id: addAfter !== '' ? Number(addAfter) : null, streak_freeze_available: 0, created_at: new Date().toISOString() });
    setAddName(''); setAddAfter(''); await load(); setMode('list');
  };

  return (
    <div className="page">

      <div className="page-head">
        <div className="page-head-left">
          <span className="label" style={{ color: 'var(--text-ghost)' }}>HABITS</span>
          <span className="page-title">Daily Stack</span>
        </div>
        <div className="page-head-right">
          <button className="btn btn-sm btn-outline" onClick={() => { setMode(mode === 'add' ? 'list' : 'add'); setAddError(''); }}>
            {mode === 'add' ? 'Cancel' : '+ New'}
          </button>
        </div>
      </div>

      {mode === 'add' && (
        <div className="section">
          <p className="label" style={{ marginBottom: '1rem' }}>New habit</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {addError && <p className="label" style={{ color: 'var(--negative)' }}>{addError}</p>}
            <div>
              <p className="label" style={{ marginBottom: '0.4rem' }}>Name</p>
              <input value={addName} onChange={e => setAddName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="e.g. Morning walk" autoFocus />
            </div>
            <div>
              <p className="label" style={{ marginBottom: '0.4rem' }}>Stack after (optional)</p>
              <select value={addAfter} onChange={e => setAddAfter(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Standalone</option>
                {habits.map(h => <option key={h.id} value={h.id}>After: {h.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-block" onClick={save}>Save habit</button>
          </div>
        </div>
      )}

      {mode === 'list' && (
        <>
          {habits.length === 0 ? (
            <div className="empty-state">No habits yet — tap + New to add one.</div>
          ) : habits.map(h => (
            <div key={h.id} className={`habit-row t-fast${h.done ? ' done' : ''}`}>
              <button
                onClick={() => toggle(h.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
              >
                <span className="mono" style={{ fontSize: '0.875rem', fontWeight: 700, minWidth: '2rem', color: h.done ? 'var(--positive)' : 'var(--text-ghost)' }}>
                  {h.done ? '[X]' : '[ ]'}
                </span>
                <span style={{ flex: 1, fontSize: '0.875rem', color: h.done ? 'var(--text-ghost)' : 'var(--text)', textDecoration: h.done ? 'line-through' : 'none', fontFamily: 'var(--font-sans)' }}>
                  {h.name}
                </span>
                {h.streak > 0 && (
                  <span className="mono" style={{ fontSize: '0.7rem', fontWeight: 700, color: h.done ? 'var(--text-ghost)' : 'var(--accent)' }}>
                    {h.streak}d
                  </span>
                )}
              </button>
              <button
                onClick={() => remove(h.id)}
                style={{ background: 'none', border: 'none', color: 'var(--text-ghost)', cursor: 'pointer', padding: '0 0 0 0.75rem', fontSize: '1rem', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
