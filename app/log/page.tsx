'use client';

import { useRouter } from 'next/navigation';

const ITEMS = [
  { label: 'MEAL', sub: 'Log food or drink', path: '/nutrition?action=add' },
  { label: 'WORKOUT', sub: 'Log a session', path: '/fitness?action=add' },
  { label: 'HABIT', sub: 'Tick off a habit', path: '/habits' },
  { label: 'MEDITATE', sub: 'Start a session', path: '/meditation' },
];

export default function LogPage() {
  const router = useRouter();
  return (
    <div style={{ fontFamily: 'var(--font-mono)' }}>
      <div style={{ padding: '1rem', borderBottom: '2px solid var(--border-strong)' }}>
        <p className="label" style={{ marginBottom: '0.25rem' }}>QUICK LOG</p>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>WHAT DID YOU DO?</h1>
      </div>
      {ITEMS.map((item) => (
        <button key={item.label} onClick={() => router.push(item.path)}
          style={{ display: 'flex', width: '100%', padding: '1.25rem 1rem', background: 'var(--bg)', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', fontFamily: 'var(--font-mono)' }}>
          <div>
            <p style={{ margin: '0 0 0.25rem', fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.05em' }}>{item.label}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.sub}</p>
          </div>
          <span style={{ color: 'var(--text-ghost)', fontSize: '1.5rem', lineHeight: 1 }}>→</span>
        </button>
      ))}
      <div style={{ borderTop: '2px solid var(--border)', marginTop: '1rem' }} />
      <div style={{ padding: '1rem' }}>
        <button onClick={() => router.push('/')} className="btn btn-block">
          ← BACK
        </button>
      </div>
    </div>
  );
}
