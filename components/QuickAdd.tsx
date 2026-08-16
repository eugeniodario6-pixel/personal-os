'use client';

import { useRouter } from 'next/navigation';

export default function QuickAdd() {
  const router = useRouter();

  const buttons = [
    { label: '+ MEAL', href: '/nutrition?action=add' },
    { label: '+ WORKOUT', href: '/fitness?action=add' },
    { label: '+ MEDITATE', href: '/meditation' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        borderBottom: '2px solid var(--border-strong)',
      }}
    >
      {buttons.map((btn, i) => (
        <button
          key={btn.label}
          className="btn"
          onClick={() => router.push(btn.href)}
          style={{
            borderRadius: 0,
            borderTop: 'none',
            borderBottom: 'none',
            borderLeft: 'none',
            borderRight: i < buttons.length - 1 ? '1px solid var(--border)' : 'none',
            padding: '1rem 0.5rem',
            fontSize: '0.6rem',
            letterSpacing: '0.12em',
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
