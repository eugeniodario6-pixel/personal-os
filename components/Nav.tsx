'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const MONO = "'IBM Plex Mono', monospace";

const Icons: Record<string, React.ReactNode> = {
  today: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  nutrition: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
      <line x1="7" y1="2" x2="7" y2="22"/>
      <path d="M21 15V2a5 5 0 0 0-5 5v6h3a2 2 0 0 1 2 2z"/>
      <line x1="21" y1="15" x2="21" y2="22"/>
    </svg>
  ),
  fitness: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  habits: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  meditation: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  week: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="8" y1="14" x2="8" y2="14" strokeWidth="3"/>
      <line x1="12" y1="14" x2="12" y2="14" strokeWidth="3"/>
      <line x1="16" y1="14" x2="16" y2="14" strokeWidth="3"/>
      <line x1="8" y1="18" x2="8" y2="18" strokeWidth="3"/>
      <line x1="12" y1="18" x2="12" y2="18" strokeWidth="3"/>
    </svg>
  ),
  insights: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  settings: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
      <circle cx="9" cy="6" r="2" fill="var(--bg)"/>
      <circle cx="15" cy="12" r="2" fill="var(--bg)"/>
      <circle cx="9" cy="18" r="2" fill="var(--bg)"/>
    </svg>
  ),
};

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const LINKS = [
  { href: '/',           label: 'TODAY',      iconKey: 'today' },
  { href: '/nutrition',  label: 'NUTRITION',  iconKey: 'nutrition' },
  { href: '/fitness',    label: 'FITNESS',    iconKey: 'fitness' },
  { href: '/habits',     label: 'HABITS',     iconKey: 'habits' },
  { href: '/meditation', label: 'MEDITATION', iconKey: 'meditation' },
  { href: '/week',       label: 'WEEK',       iconKey: 'week' },
  { href: '/insights',   label: 'INSIGHTS',   iconKey: 'insights' },
  { href: '/settings',   label: 'SETTINGS',   iconKey: 'settings' },
];

function haptic(ms = 10) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem('pos-theme') as 'dark' | 'light' | null;
    if (stored) setTheme(stored);
  }, []);

  const toggleTheme = () => {
    haptic(8);
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('pos-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const navigate = (href: string) => {
    haptic(15);
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      {/* Floating menu button — top-right, always visible */}
      <button
        onClick={() => { haptic(8); setOpen(o => !o); }}
        aria-label="Open menu"
        style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 200,
          width: '2.75rem', height: '2.75rem', borderRadius: '50%',
          border: 'none', background: 'var(--fg)', color: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: '1.2rem', fontWeight: 700,
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
          fontFamily: MONO,
        }}
      >
        ⠿
      </button>

      {/* Full-screen overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 199,
            background: 'var(--bg)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '1.1rem',
            animation: 'fadeIn 180ms ease both',
          }}
        >
          {/* Close — top-left */}
          <button
            onClick={(e) => { e.stopPropagation(); haptic(8); setOpen(false); }}
            style={{
              position: 'absolute', top: '1rem', left: '1rem',
              width: '2.75rem', height: '2.75rem', borderRadius: '50%',
              border: '2px solid var(--border-color)', background: 'var(--bg)',
              color: 'var(--fg)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
              fontSize: '1rem', fontWeight: 700, fontFamily: MONO,
            }}
          >
            ✕
          </button>

          {/* Theme toggle — top-right */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              width: '2.75rem', height: '2.75rem', borderRadius: '50%',
              border: '2px solid var(--border-color)', background: 'var(--bg)',
              color: 'var(--fg)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
            }}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* Nav items */}
          {LINKS.map((link, i) => {
            const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <button
                key={link.href}
                onClick={(e) => { e.stopPropagation(); navigate(link.href); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0.15rem 0',
                  animation: `fadeIn 180ms ease ${i * 35}ms both`,
                }}
              >
                {/* Circle */}
                <div style={{
                  width: '3.25rem', height: '3.25rem', borderRadius: '50%',
                  background: isActive ? 'var(--fg)' : 'var(--bg-dark)',
                  border: `2px solid ${isActive ? 'var(--fg)' : 'var(--border-color)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isActive ? 'var(--bg)' : 'var(--fg)',
                  transition: 'background 150ms ease',
                }}>
                  {Icons[link.iconKey]}
                </div>
                {/* Label */}
                <span style={{
                  fontFamily: MONO, fontSize: '0.7rem', fontWeight: 700,
                  letterSpacing: '0.15em', textTransform: 'uppercase',
                  color: isActive ? 'var(--fg)' : 'var(--fg-muted)',
                  minWidth: '7rem', textAlign: 'left',
                }}>
                  {link.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
