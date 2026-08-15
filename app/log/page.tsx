'use client';

import { useRouter } from 'next/navigation';

const LOG_ITEMS = [
  {
    key: 'meal',
    label: 'MEAL',
    sub: 'Log food and calories',
    href: '/nutrition?action=add',
  },
  {
    key: 'workout',
    label: 'WORKOUT',
    sub: 'Log a workout session',
    href: '/fitness?action=add',
  },
  {
    key: 'habit',
    label: 'HABIT CHECK',
    sub: "Mark today's habits done",
    href: '/habits',
  },
  {
    key: 'meditation',
    label: 'MEDITATION',
    sub: 'Start a session',
    href: '/meditation',
  },
];

export default function LogPage() {
  const router = useRouter();

  return (
    <div>
      {/* Header */}
      <div
        style={{
          padding: '1rem',
          borderBottom: '2px solid #444',
        }}
      >
        <p className="label" style={{ marginBottom: '0.25rem' }}>
          QUICK LOG
        </p>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#fff',
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          WHAT DID YOU DO?
        </h1>
      </div>

      {/* Log options */}
      <div>
        {LOG_ITEMS.map((item, i) => (
          <button
            key={item.key}
            onClick={() => router.push(item.href)}
            style={{
              display: 'flex',
              width: '100%',
              padding: '1.25rem 1rem',
              background: '#000',
              border: 'none',
              borderBottom: i < LOG_ITEMS.length - 1 ? '1px solid #111' : 'none',
              cursor: 'pointer',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: "'IBM Plex Mono', monospace",
              textAlign: 'left',
            }}
          >
            <div>
              <p
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: '#fff',
                  marginBottom: '0.25rem',
                  letterSpacing: '0.05em',
                }}
              >
                {item.label}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#888' }}>{item.sub}</p>
            </div>
            <span style={{ color: '#444', fontSize: '1.5rem', lineHeight: 1 }}>
              →
            </span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '2px solid #111', marginTop: '1rem' }} />

      {/* Back button */}
      <div style={{ padding: '1rem' }}>
        <button className="btn btn-ghost" onClick={() => router.back()} style={{ width: '100%' }}>
          ← BACK
        </button>
      </div>
    </div>
  );
}
