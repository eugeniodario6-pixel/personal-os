'use client';

import { toggleHabitCompletion } from '@/lib/db';

interface HabitRowProps {
  habitId: string;
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
        background: completed ? '#111' : '#000',
        border: 'none',
        borderBottom: '1px solid #111',
        cursor: 'pointer',
        fontFamily: "'IBM Plex Mono', monospace",
        textAlign: 'left',
      }}
    >
      <span
        className="checkbox-text"
        style={{
          color: completed ? '#fff' : '#444',
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
          color: completed ? '#888' : '#fff',
          textDecoration: completed ? 'line-through' : 'none',
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        {name}
      </span>

      {streak > 0 && (
        <span
          style={{
            fontSize: '0.65rem',
            color: '#888',
            letterSpacing: '0.1em',
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          {streak}D
        </span>
      )}
    </button>
  );
}
