'use client';

import { toggleHabitCompletion } from '@/lib/db';

interface HabitRowProps {
  habitId: number;
  name: string;
  streak: number;
  completed: boolean;
  onToggle: () => void;
}

export default function HabitRow({
  habitId,
  name,
  streak,
  completed,
  onToggle,
}: HabitRowProps) {
  async function handleToggle() {
    await toggleHabitCompletion(habitId);
    onToggle();
  }

  return (
    <button
      onClick={handleToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        width: '100%',
        padding: '0.875rem 1rem',
        background: completed ? 'var(--surface-2)' : 'var(--bg)',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        borderLeft: completed ? '2px solid var(--positive)' : '2px solid transparent',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        textAlign: 'left',
      }}
    >
      <span
        className="checkbox-text"
        style={{
          color: completed ? 'var(--positive)' : 'var(--text-ghost)',
          minWidth: '2.5rem',
          fontSize: '0.875rem',
        }}
      >
        {completed ? '[X]' : '[ ]'}
      </span>

      <span
        style={{
          flex: 1,
          fontSize: '0.875rem',
          color: completed ? 'var(--text-muted)' : 'var(--text)',
          textDecoration: completed ? 'line-through' : 'none',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {name}
      </span>

      {streak > 0 && (
        <span
          style={{
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {streak}D
        </span>
      )}
    </button>
  );
}
