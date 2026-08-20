'use client';

import { useEffect, useState, useCallback } from 'react';
import { getHabits, addHabit, deactivateHabit, getHabitCompletions, toggleHabitCompletion, getHabitStreaks, todayISO, type Habit } from '@/lib/db';
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
    const streaks = await getHabitStreaks(all.map(h => h.id));
    const enriched = all.map(h => ({ ...h, done: completedIds.has(h.id), streak: streaks.get(h.id) ?? 0 }));
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

  const doneCount = habits.filter(h => h.done).length;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '5rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="label" style={{ marginBottom: 6 }}>Daily</p>
          <h1 style={{ fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1.13, color: 'var(--text)', margin: 0 }}>Habits</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {habits.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '-0.011em' }}>
              {doneCount}/{habits.length}
            </span>
          )}
          <button
            onClick={() => { setMode(mode === 'add' ? 'list' : 'add'); setAddError(''); }}
            className={mode === 'add' ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'}
          >
            {mode === 'add' ? '← Back' : '+ New'}
          </button>
        </div>
      </div>

      {/* ── Add form ── */}
      {mode === 'add' && (
        <div style={{ margin: '16px', background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12, padding: '20px' }}>
          <p style={{ fontSize: 13, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text-2)', marginBottom: 16 }}>New habit</p>
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
              />
            </div>
            <div>
              <p className="label" style={{ marginBottom: 6 }}>Stack after (optional)</p>
              <select value={addAfter} onChange={e => setAddAfter(e.target.value ? Number(e.target.value) : '')}>
                <option value="">None — standalone</option>
                {habits.map(h => <option key={h.id} value={h.id}>After: {h.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button onClick={save} className="btn btn-primary" style={{ flex: 1 }}>Save</button>
              <button onClick={() => setMode('list')} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Habit list ── */}
      {mode === 'list' && (
        <div style={{ margin: '16px', background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12, overflow: 'hidden' }}>
          {habits.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text-2)', marginBottom: 6 }}>No habits tracked yet</p>
              <p style={{ fontSize: 13, color: 'var(--text-4)', letterSpacing: '-0.011em', lineHeight: 1.6, marginBottom: 16 }}>
                Athletes who track daily habits hit their goals 2× more often.
              </p>
              <button
                onClick={() => setMode('add')}
                className="btn btn-primary btn-sm"
              >
                Add your first habit →
              </button>
            </div>
          ) : habits.map((h, idx) => (
            <div
              key={h.id}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '12px 16px',
                borderBottom: idx < habits.length - 1 ? '1px solid var(--border)' : 'none',
                background: h.done ? 'rgba(255,255,255,0.02)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggle(h.id)}
                style={{
                  width: 20, height: 20,
                  borderRadius: 4,
                  border: `1px solid ${h.done ? 'var(--accent)' : 'var(--border-2)'}`,
                  background: h.done ? 'var(--accent)' : 'transparent',
                  cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-fg)',
                  fontSize: 11, fontWeight: 510,
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
                  color: h.done ? 'var(--text-4)' : 'var(--text-2)',
                  textDecoration: h.done ? 'line-through' : 'none',
                }}>
                  {h.name}
                </span>
              </button>

              {/* Streak */}
              {h.streak > 0 && (
                <span className="badge" style={{ marginRight: 8 }}>
                  {h.streak}d 🔥
                </span>
              )}

              {/* Delete */}
              <button
                onClick={() => deleteHabit(h.id)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-4)',
                  cursor: 'pointer', fontSize: 14, padding: '4px 6px', flexShrink: 0,
                  WebkitTapHighlightColor: 'transparent',
                  lineHeight: 1,
                }}
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
