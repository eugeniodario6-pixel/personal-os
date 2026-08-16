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
    haptic('medium');
    await toggleHabitCompletion(id);
    await load();
  };

  const deleteHabit = async (id: number) => {
    haptic('heavy');
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
    <div style={{ minHeight: '100dvh', background: '#0F0F14', paddingTop: '4rem', paddingBottom: '5rem', fontFamily: 'Inter, sans-serif' }}>
      {/* Header card */}
      <div style={{ margin: '0 1rem 1rem', background: '#17171F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A7A8C' }}>DAILY</p>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#fff' }}>Habits</h1>
        </div>
        <button
          onClick={() => { setMode(mode === 'add' ? 'list' : 'add'); setAddError(''); }}
          style={{
            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '0.5rem 1rem', borderRadius: 10, cursor: 'pointer', border: 'none',
            background: mode === 'add' ? '#17171F' : '#fff',
            color: mode === 'add' ? '#7A7A8C' : '#000',
            boxShadow: mode === 'add' ? 'inset 0 0 0 1px rgba(255,255,255,0.07)' : 'none',
          }}
        >
          {mode === 'add' ? '← Back' : '+ New'}
        </button>
      </div>

      {/* Add form */}
      {mode === 'add' && (
        <div style={{ margin: '0 1rem 1rem', background: '#17171F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.25rem' }}>
          <p style={{ margin: '0 0 1rem', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A7A8C' }}>NEW HABIT</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {addError && (
              <div style={{ background: '#1E1E28', borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                ⚠ {addError}
              </div>
            )}
            <div>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A7A8C' }}>Habit Name *</p>
              <input
                value={addName}
                onChange={e => setAddName(e.target.value)}
                placeholder="e.g. Morning walk"
                style={{ width: '100%', boxSizing: 'border-box', background: '#1E1E28', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '0.875rem 1rem', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }}
              />
            </div>
            <div>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A7A8C' }}>Stacked After (optional)</p>
              <select
                value={addAfter}
                onChange={e => setAddAfter(e.target.value ? Number(e.target.value) : '')}
                style={{ width: '100%', boxSizing: 'border-box', background: '#1E1E28', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '0.875rem 1rem', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }}
              >
                <option value="">None — standalone habit</option>
                {habits.map(h => <option key={h.id} value={h.id}>After: {h.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={save}
                style={{ flex: 1, background: '#fff', color: '#000', border: 'none', borderRadius: 10, padding: '0.875rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                Save Habit
              </button>
              <button
                onClick={() => setMode('list')}
                style={{ flex: 1, background: '#17171F', color: '#7A7A8C', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '0.875rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Habit list */}
      {mode === 'list' && (
        <div style={{ margin: '0 1rem', background: '#17171F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
          {habits.length === 0 ? (
            <div style={{ padding: '2rem 1.25rem', color: '#7A7A8C', fontSize: '0.85rem', textAlign: 'center' }}>
              No habits yet. Tap <strong style={{ color: '#fff' }}>+ New</strong> to add one.
            </div>
          ) : habits.map((h, idx) => (
            <div
              key={h.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.875rem 1rem',
                borderBottom: idx < habits.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                background: h.done ? '#1E1E28' : 'transparent',
              }}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggle(h.id)}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: h.done ? 'linear-gradient(135deg,#10B981,#34D399)' : '#25252F',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '0.85rem', fontWeight: 700,
                }}
              >
                {h.done ? '✓' : ''}
              </button>

              {/* Name */}
              <button
                onClick={() => toggle(h.id)}
                style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '0 0.75rem', fontFamily: 'Inter, sans-serif' }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: h.done ? '#7A7A8C' : '#fff', textDecoration: h.done ? 'line-through' : 'none' }}>
                  {h.name}
                </span>
              </button>

              {/* Streak badge */}
              {h.streak > 0 && (
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
                  background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
                  borderRadius: 999, padding: '0.2rem 0.55rem', marginRight: '0.5rem', whiteSpace: 'nowrap',
                }}>
                  🔥 {h.streak}d
                </span>
              )}

              {/* Delete */}
              <button
                onClick={() => deleteHabit(h.id)}
                style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', fontSize: '0.9rem', padding: '0.25rem 0.4rem', flexShrink: 0, fontFamily: 'Inter, sans-serif' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
