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

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '5rem' }}>

      {/* Header */}
      <div style={{ padding: '1.5rem var(--pad) 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="label" style={{ marginBottom: '0.35rem' }}>Daily</p>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', margin: 0 }}>Habits</h1>
        </div>
        <button
          onClick={() => { setMode(mode === 'add' ? 'list' : 'add'); setAddError(''); }}
          className={mode === 'add' ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'}
        >
          {mode === 'add' ? '← Back' : '+ New'}
        </button>
      </div>

      {/* Add form */}
      {mode === 'add' && (
        <div style={{ margin: '0 var(--pad) 1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>New Habit</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {addError && (
              <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-2)' }}>
                ⚠ {addError}
              </div>
            )}
            <div>
              <p className="label" style={{ marginBottom: '0.4rem' }}>Habit Name *</p>
              <input value={addName} onChange={e => setAddName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="e.g. Morning walk" />
            </div>
            <div>
              <p className="label" style={{ marginBottom: '0.4rem' }}>Stacked After (optional)</p>
              <select value={addAfter} onChange={e => setAddAfter(e.target.value ? Number(e.target.value) : '')}>
                <option value="">None — standalone habit</option>
                {habits.map(h => <option key={h.id} value={h.id}>After: {h.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={save} className="btn btn-primary" style={{ flex: 1 }}>Save Habit</button>
              <button onClick={() => setMode('list')} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Habit list */}
      {mode === 'list' && (
        <div style={{ margin: '0 var(--pad)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {habits.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center' as const }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', marginBottom: '0.5rem' }}>No habits yet</p>
              <button onClick={() => setMode('add')} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Add your first →
              </button>
            </div>
          ) : habits.map((h, idx) => (
            <div key={h.id} style={{
              display: 'flex', alignItems: 'center', padding: '0.875rem 1rem',
              borderBottom: idx < habits.length - 1 ? '1px solid var(--border)' : 'none',
              background: h.done ? 'var(--surface-2)' : 'transparent',
            }}>
              {/* Checkbox */}
              <button onClick={() => toggle(h.id)} style={{
                width: 28, height: 28, borderRadius: 'var(--radius-xs)', border: `2px solid ${h.done ? 'var(--text)' : 'var(--border-2)'}`,
                background: h.done ? 'var(--text)' : 'transparent',
                cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--invert)', fontSize: '0.8rem', fontWeight: 700,
                transition: 'all 0.15s',
              }}>
                {h.done ? '✓' : ''}
              </button>

              {/* Name */}
              <button onClick={() => toggle(h.id)} style={{
                flex: 1, background: 'transparent', border: 'none', cursor: 'pointer',
                textAlign: 'left', padding: '0 0.875rem',
              }}>
                <span style={{
                  fontSize: '0.9375rem', fontWeight: 500,
                  color: h.done ? 'var(--text-3)' : 'var(--text)',
                  textDecoration: h.done ? 'line-through' : 'none',
                }}>
                  {h.name}
                </span>
              </button>

              {/* Streak */}
              {h.streak > 0 && (
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em',
                  color: 'var(--text-2)', border: '1px solid var(--border-2)',
                  borderRadius: 999, padding: '0.2rem 0.55rem', marginRight: '0.5rem',
                }}>
                  {h.streak}d 🔥
                </span>
              )}

              {/* Delete */}
              <button onClick={() => deleteHabit(h.id)} style={{
                background: 'none', border: 'none', color: 'var(--text-4)',
                cursor: 'pointer', fontSize: '0.9rem', padding: '0.25rem 0.4rem', flexShrink: 0,
              }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
