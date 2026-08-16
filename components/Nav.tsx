'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { haptic } from '@/lib/haptic';
import { useTheme } from './ThemeProvider';

const TABS = [
  { href: '/',           label: 'Today',  icon: '◉' },
  { href: '/nutrition',  label: 'Eat',    icon: '⊕' },
  { href: '/fitness',    label: 'Move',   icon: '△' },
  { href: '/body',       label: 'Body',   icon: '◈' },
  { href: '/habits',     label: 'Habits', icon: '✦' },
];

const DRAWER = [
  { href: '/',           label: 'Today',    sub: 'Dashboard' },
  { href: '/nutrition',  label: 'Eat',      sub: 'Nutrition' },
  { href: '/fitness',    label: 'Move',     sub: 'Fitness' },
  { href: '/body',       label: 'Body',     sub: 'Weight log' },
  { href: '/habits',     label: 'Habits',   sub: 'Daily habits' },
  { href: '/meditation', label: 'Mind',     sub: 'Meditation' },
  { href: '/insights',   label: 'Data',     sub: 'Insights' },
  { href: '/settings',   label: 'Settings', sub: 'Preferences' },
];

const btnStyle: React.CSSProperties = {
  width: '2.25rem', height: '2.25rem',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xs)',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent',
  transition: 'background 0.15s',
};

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* ── Floating buttons — top right ── */}
      <div style={{
        position: 'fixed', top: '1rem', right: '1rem',
        zIndex: 300,
        display: 'flex', gap: '0.5rem',
      }}>
        {/* Theme toggle */}
        <button onClick={() => { haptic('light'); toggle(); }} style={btnStyle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          <span style={{ fontSize: '0.875rem', lineHeight: 1 }}>{theme === 'dark' ? '☀︎' : '☽'}</span>
        </button>

        {/* Menu */}
        <button
          onClick={() => { haptic('light'); setOpen(o => !o); }}
          style={{ ...btnStyle, background: open ? 'var(--text)' : 'var(--surface)' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '14px' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                display: 'block', width: '100%', height: '1.5px',
                background: open ? 'var(--invert)' : 'var(--text)',
                borderRadius: 2,
                transition: 'background 0.15s',
              }} />
            ))}
          </div>
        </button>
      </div>

      {/* ── Bottom tab bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '4.25rem',
        background: 'var(--bg)',
        borderTop: '1px solid var(--border)',
        zIndex: 300,
        display: 'flex', alignItems: 'stretch',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {TABS.map(tab => {
          const active = isActive(tab.href);
          return (
            <Link key={tab.href} href={tab.href}
              onClick={() => haptic('light')}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '0.2rem',
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
                borderTop: `2px solid ${active ? 'var(--text)' : 'transparent'}`,
                paddingTop: '0.35rem',
              }}
            >
              <span style={{ fontSize: '1rem', color: active ? 'var(--text)' : 'var(--text-4)' }}>
                {tab.icon}
              </span>
              <span style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: active ? 'var(--text)' : 'var(--text-4)' }}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── Backdrop ── */}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 298,
          background: 'rgba(0,0,0,0.4)',
        }} />
      )}

      {/* ── Drawer ── */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '72vw', maxWidth: 280,
        background: 'var(--bg)',
        borderLeft: '1px solid var(--border)',
        zIndex: 299,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        paddingTop: '4rem',
        overflowY: 'auto',
      }}>
        {DRAWER.map(link => {
          const active = isActive(link.href);
          return (
            <Link key={link.href} href={link.href}
              onClick={() => { haptic('light'); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '1rem 1.5rem',
                background: active ? 'var(--surface)' : 'transparent',
                borderLeft: `2px solid ${active ? 'var(--text)' : 'transparent'}`,
                borderBottom: '1px solid var(--border)',
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '1rem', fontWeight: active ? 700 : 400, color: 'var(--text)', margin: 0, marginBottom: '0.1rem' }}>
                  {link.label}
                </p>
                <p className="label" style={{ margin: 0 }}>{link.sub}</p>
              </div>
              {active && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text)' }} />}
            </Link>
          );
        })}

        {/* Theme toggle in drawer */}
        <button onClick={() => { haptic('light'); toggle(); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem 1.5rem', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', marginTop: 'auto', WebkitTapHighlightColor: 'transparent' }}>
          <span style={{ fontSize: '1rem', color: 'var(--text)' }}>{theme === 'dark' ? '☀︎' : '☽'}</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-2)' }}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </span>
        </button>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
          <p className="label" style={{ color: 'var(--text-4)' }}>Personal OS · v0.1</p>
        </div>
      </div>
    </>
  );
}
