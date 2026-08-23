'use client';

import { useRouter } from 'next/navigation';
import { haptic } from '@/lib/haptic';

const ITEMS = [
  { label: 'Meal',      sub: 'Log food or drink',  path: '/nutrition?action=add' },
  { label: 'Workout',   sub: 'Log a session',       path: '/fitness'             },
  { label: 'Habit',     sub: 'Tick off a habit',    path: '/habits'              },
  { label: 'Meditate',  sub: 'Start a session',     path: '/meditation'          },
];

export default function LogPage() {
  const router = useRouter();
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-left">
          <span className="label" style={{ color: 'var(--text-ghost)' }}>QUICK LOG</span>
          <span className="page-title">What did you do?</span>
        </div>
      </div>

      {ITEMS.map((item, i) => (
        <button
          key={item.label}
          className="row t-fast"
          onClick={() => { haptic('light'); router.push(item.path); }}
          style={{ width: '100%', border: 'none', justifyContent: 'space-between' }}
        >
          <div style={{ textAlign: 'left' }}>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{item.label}</p>
            <p className="label" style={{ marginTop: '0.2rem' }}>{item.sub}</p>
          </div>
          <span style={{ color: 'var(--text-ghost)', fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>›</span>
        </button>
      ))}
    </div>
  );
}
