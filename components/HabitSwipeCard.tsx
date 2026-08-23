'use client';

import { useState, useRef } from 'react';
import { haptic } from '@/lib/haptic';

interface Habit {
  id: number;
  name: string;
  done: boolean;
  streak: number;
  routine: string;
}

interface Props {
  habits: Habit[];
  onToggle: (id: number) => void;
}

const SWIPE_THRESHOLD = 80; // px to trigger action

export default function HabitSwipeCard({ habits, onToggle }: Props) {
  const pending = habits.filter(h => !h.done);
  const done = habits.filter(h => h.done);

  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dismissed, setDismissed] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const currentHabit = pending[index];

  const rotate = Math.min(Math.max(offset / 12, -12), 12);
  const isRight = offset > 0;
  const intensity = Math.min(Math.abs(offset) / SWIPE_THRESHOLD, 1);

  const handleStart = (x: number) => {
    startX.current = x;
    setDragging(true);
    setDismissed(null);
  };

  const handleMove = (x: number) => {
    if (!dragging) return;
    setOffset(x - startX.current);
  };

  const handleEnd = () => {
    setDragging(false);
    if (Math.abs(offset) >= SWIPE_THRESHOLD) {
      const dir = offset > 0 ? 'right' : 'left';
      setDismissed(dir);
      haptic(dir === 'right' ? 'medium' : 'light');
      setTimeout(() => {
        if (dir === 'right') onToggle(currentHabit.id);
        setIndex(i => i + 1);
        setOffset(0);
        setDismissed(null);
      }, 280);
    } else {
      setOffset(0);
    }
  };

  // Reset index if habits change (e.g. after toggle)
  const effectiveIndex = Math.min(index, pending.length - 1);

  const allDone = pending.length === 0;

  return (
    <div style={{ background: 'var(--color-carbon)', borderRadius: 20, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.80), 0 4px 12px rgba(0,0,0,0.40)', padding: 18 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(216,234,255,0.30)', margin: 0 }}>
          Daily Habits
        </p>
        <span style={{ fontSize: 11, color: 'rgba(216,234,255,0.35)', fontFamily: 'var(--font-mono)' }}>
          {done.length}/{habits.length}
        </span>
      </div>

      {/* Progress pills */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {habits.map((h, i) => (
          <div key={h.id} style={{
            flex: 1, height: 3, borderRadius: 99,
            background: h.done ? 'var(--color-electric-cobalt)' : 'rgba(216,234,255,0.08)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Swipe area */}
      {allDone ? (
        <div style={{
          height: 160,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 8,
        }}>
          <div style={{ fontSize: 32 }}>🎯</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(216,234,255,0.85)', margin: 0 }}>All habits done</p>
          <p style={{ fontSize: 12, color: 'rgba(216,234,255,0.35)', margin: 0 }}>Perfect habit day</p>
        </div>
      ) : effectiveIndex >= pending.length ? (
        <div style={{
          height: 160,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 8,
        }}>
          <p style={{ fontSize: 14, color: 'rgba(216,234,255,0.40)', margin: 0 }}>
            {done.length} done · {pending.length - effectiveIndex} pending
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative', height: 180 }}>

          {/* Next card (peek behind) */}
          {effectiveIndex + 1 < pending.length && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(216,234,255,0.04)',
              borderRadius: 16,
              border: 'none',
              transform: 'scale(0.94) translateY(8px)',
              zIndex: 0,
            }} />
          )}

          {/* Active card */}
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'var(--color-carbon)',
              borderRadius: 16,
              border: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.80), 0 4px 12px rgba(0,0,0,0.40)',
              transform: dismissed
                ? `translateX(${dismissed === 'right' ? '120%' : '-120%'}) rotate(${dismissed === 'right' ? 20 : -20}deg)`
                : `translateX(${offset}px) rotate(${rotate}deg)`,
              transition: dismissed ? 'transform 0.28s cubic-bezier(0.4,0,0.2,1), border 0.1s' : dragging ? 'none' : 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
              zIndex: 1,
              cursor: 'grab',
              userSelect: 'none',
              display: 'flex', flexDirection: 'column',
              padding: 20,
              justifyContent: 'space-between',
            }}
            onMouseDown={e => handleStart(e.clientX)}
            onMouseMove={e => handleMove(e.clientX)}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={e => handleStart(e.touches[0].clientX)}
            onTouchMove={e => { e.preventDefault(); handleMove(e.touches[0].clientX); }}
            onTouchEnd={handleEnd}
          >
            {/* Yes / No indicators */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                color: 'rgba(255,255,255,0.50)',
                opacity: !isRight && intensity > 0.2 ? intensity : 0,
                transition: 'opacity 0.1s',
                fontFamily: 'var(--font-mono)',
                borderRadius: 6, padding: '3px 8px',
                background: 'rgba(255,255,255,0.06)',
              }}>SKIP</div>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                color: '#1f58f2',
                opacity: isRight && intensity > 0.2 ? intensity : 0,
                transition: 'opacity 0.1s',
                fontFamily: 'var(--font-mono)',
                borderRadius: 6, padding: '3px 8px',
                background: 'rgba(31,88,242,0.12)',
              }}>DONE</div>
            </div>

            {/* Habit name */}
            <div>
              <p style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'rgba(216,234,255,0.30)', margin: '0 0 8px',
              }}>
                {pending[effectiveIndex].routine === 'morning' ? '☀️ Morning' : pending[effectiveIndex].routine === 'evening' ? '🌙 Evening' : 'Habit'}
              </p>
              <p style={{
                fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
                color: 'rgba(216,234,255,0.90)', margin: 0, lineHeight: 1.2,
              }}>
                {pending[effectiveIndex].name}
              </p>
              {pending[effectiveIndex].streak > 1 && (
                <p style={{ fontSize: 12, color: 'rgba(216,234,255,0.35)', marginTop: 6 }}>
                  🔥 {pending[effectiveIndex].streak} day streak
                </p>
              )}
            </div>

            {/* Counter */}
            <p style={{ fontSize: 11, color: 'rgba(216,234,255,0.25)', margin: 0, fontFamily: 'var(--font-mono)' }}>
              {effectiveIndex + 1} / {pending.length}
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!allDone && effectiveIndex < pending.length && (
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button
            onClick={() => {
              haptic('light');
              setDismissed('left');
              setTimeout(() => { setIndex(i => i + 1); setOffset(0); setDismissed(null); }, 280);
            }}
            style={{
              flex: 1, height: 44, borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              color: 'rgba(255,255,255,0.40)', fontSize: 18,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              transition: 'background 0.15s',
            }}
          >✕</button>
          <button
            onClick={() => {
              haptic('medium');
              setDismissed('right');
              setTimeout(() => {
                onToggle(pending[effectiveIndex].id);
                setIndex(i => i + 1);
                setOffset(0);
                setDismissed(null);
              }, 280);
            }}
            style={{
              flex: 1, height: 44, borderRadius: 12,
              background: 'rgba(31,88,242,0.12)',
              border: 'none',
              color: '#1f58f2', fontSize: 18,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              transition: 'background 0.15s',
            }}
          >✓</button>
        </div>
      )}

      {/* Done habits compact list */}
      {done.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid rgba(216,234,255,0.06)', paddingTop: 14 }}>
          <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(216,234,255,0.25)', margin: '0 0 10px' }}>Completed</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {done.map(h => (
              <span key={h.id} style={{
                fontSize: 11, padding: '4px 10px',
                background: 'rgba(31,88,242,0.12)',
                border: 'none',
                borderRadius: 99, color: 'rgba(216,234,255,0.45)',
                textDecoration: 'line-through',
              }}>
                {h.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
