'use client';

import { useTheme } from '@/lib/theme';
import { hapticLight } from '@/lib/haptic';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={() => { hapticLight(); toggle(); }}
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.65rem',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '0.4rem 0.6rem',
        border: '2px solid var(--border-color)',
        background: 'var(--bg)',
        color: 'var(--fg-muted)',
        cursor: 'pointer',
        lineHeight: 1,
      }}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? '☀' : '◑'}
    </button>
  );
}
