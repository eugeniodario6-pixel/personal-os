'use client';

import { useRouter } from 'next/navigation';

const ITEMS = [
  { label: 'MEAL', sub: 'Log food or drink', path: '/nutrition?action=add', icon: '◎' },
  { label: 'WORKOUT', sub: 'Log a session', path: '/fitness?action=add', icon: '△' },
  { label: 'HABIT', sub: 'Tick off a habit', path: '/habits', icon: '✦' },
  { label: 'MEDITATE', sub: 'Start a session', path: '/meditation', icon: '◉' },
];

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.80), 0 4px 12px rgba(0,0,0,0.40)';

export default function LogPage() {
  const router = useRouter();
  return (
    <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4.5rem', paddingBottom: '130px' }}>

      {/* Header */}
      <div style={{ padding: '0 16px 24px' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 10, marginTop: 4 }}>
          Quick
        </p>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff', margin: 0 }}>
          Log
        </h1>
      </div>

      {/* Log items */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => router.push(item.path)}
            style={{
              display: 'flex', width: '100%', alignItems: 'center',
              padding: '20px 20px',
              background: 'var(--color-carbon)',
              border: 'none',
              borderRadius: 20,
              boxShadow: CARD_SHADOW,
              cursor: 'pointer',
              textAlign: 'left',
              WebkitTapHighlightColor: 'transparent',
              transition: 'opacity 0.1s',
            }}
          >
            {/* Icon circle */}
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginRight: 16, flexShrink: 0,
              fontSize: 18, color: 'rgba(255,255,255,0.50)',
            }}>
              {item.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: '0 0 3px',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.40)',
              }}>
                {item.label}
              </p>
              <p style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.011em',
                color: '#fff',
              }}>
                {item.sub}
              </p>
            </div>

            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 20, flexShrink: 0 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
