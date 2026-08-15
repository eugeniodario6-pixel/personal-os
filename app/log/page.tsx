'use client';

import { useRouter } from 'next/navigation';

const MONO = "'IBM Plex Mono', monospace";
const label = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#888', margin: 0 };

const ITEMS = [
  { label: 'MEAL', sub: 'Log food or drink', path: '/nutrition?action=add' },
  { label: 'WORKOUT', sub: 'Log a session', path: '/fitness?action=add' },
  { label: 'HABIT', sub: 'Tick off a habit', path: '/habits' },
  { label: 'MEDITATE', sub: 'Start a session', path: '/meditation' },
];

export default function LogPage() {
  const router = useRouter();
  return (
    <div style={{ fontFamily: MONO }}>
      <div style={{ padding: '1rem', borderBottom: '2px solid #444' }}>
        <p style={{ ...label, marginBottom: '0.25rem' }}>QUICK LOG</p>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>WHAT DID YOU DO?</h1>
      </div>
      {ITEMS.map((item) => (
        <button key={item.label} onClick={() => router.push(item.path)}
          style={{ display: 'flex', width: '100%', padding: '1.25rem 1rem', background: '#000', border: 'none', borderBottom: '1px solid #111', cursor: 'pointer', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', fontFamily: MONO }}>
          <div>
            <p style={{ margin: '0 0 0.25rem', fontSize: '1.125rem', fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>{item.label}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>{item.sub}</p>
          </div>
          <span style={{ color: '#444', fontSize: '1.5rem', lineHeight: 1 }}>→</span>
        </button>
      ))}
      <div style={{ borderTop: '2px solid #111', marginTop: '1rem' }} />
      <div style={{ padding: '1rem' }}>
        <button onClick={() => router.push('/')}
          style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.6rem 1rem', background: '#000', border: '2px solid #444', color: '#888', cursor: 'pointer', fontFamily: MONO }}>
          ← BACK
        </button>
      </div>
    </div>
  );
}
