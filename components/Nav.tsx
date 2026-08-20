'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { haptic } from '@/lib/haptic';
import { useTheme } from './ThemeProvider';

const TABS = [
  { href: '/',           label: 'Today',     icon: '◉' },
  { href: '/nutrition',  label: 'Eat',       icon: '⊕' },
  { href: '/fitness',    label: 'Move',      icon: '△' },
  { href: '/body',       label: 'Body',      icon: '◈' },
  { href: '/habits',     label: 'Habits',    icon: '✦' },
];

const DRAWER = [
  { href: '/',           label: 'Today',     sub: 'Dashboard' },
  { href: '/nutrition',  label: 'Eat',       sub: 'Nutrition' },
  { href: '/fitness',    label: 'Move',      sub: 'Fitness' },
  { href: '/body',       label: 'Body',      sub: 'Weight log' },
  { href: '/habits',     label: 'Habits',    sub: 'Daily habits' },
  { href: '/meditation', label: 'Mind',      sub: 'Meditation' },
  { href: '/insights',   label: 'Data',      sub: 'Insights' },
  { href: '/settings',   label: 'Settings',  sub: 'Preferences' },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* ── Top-right controls ── */}
      <div style={{
        position: 'fixed', top: 12, right: 12,
        zIndex: 300,
        display: 'flex', gap: 6,
      }}>
        {/* Theme toggle */}
        <button
          onClick={() => { haptic('light'); toggle(); }}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          style={{
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 1, color: 'var(--text-3)' }}>
            {theme === 'dark' ? '○' : '●'}
          </span>
        </button>

        {/* Menu trigger */}
        <button
          onClick={() => { haptic('light'); setOpen(o => !o); }}
          style={{
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: open ? 'var(--text)' : 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.15s',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5, width: 13 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                display: 'block',
                width: '100%',
                height: 1,
                background: open ? 'var(--invert)' : 'var(--text-3)',
                borderRadius: 1,
                transition: 'background 0.15s',
              }} />
            ))}
          </div>
        </button>
      </div>

      {/* ── Bottom tab bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 56,
        background: 'rgba(8, 9, 10, 0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--border)',
        zIndex: 300,
        display: 'flex', alignItems: 'stretch',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {TABS.map(tab => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => haptic('light')}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 3,
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
                borderTop: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
                transition: 'border-color 0.15s',
              }}
            >
              <span style={{
                fontSize: 14,
                color: active ? 'var(--accent)' : 'var(--text-4)',
                transition: 'color 0.15s',
                lineHeight: 1,
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: active ? 510 : 400,
                letterSpacing: '0.01em',
                fontFeatureSettings: '"cv01" on, "ss03" on',
                color: active ? 'var(--text-2)' : 'var(--text-4)',
                transition: 'color 0.15s',
              }}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── Backdrop ── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 298,
            background: 'rgba(8,9,10,0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* ── Drawer ── */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '68vw', maxWidth: 260,
        background: 'var(--color-carbon)',
        boxShadow: 'var(--color-graphite) 0px 0px 0px 1px inset, var(--shadow-xl)',
        zIndex: 299,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 56,
        overflowY: 'auto',
      }}>
        {DRAWER.map(link => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => { haptic('light'); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '10px 16px',
                background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
                borderLeft: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
                borderBottom: '1px solid var(--border)',
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.12s',
                gap: 12,
              }}
            >
              {/* Active dot */}
              <span style={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                background: active ? 'var(--accent)' : 'transparent',
                transition: 'background 0.15s',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 14,
                  fontWeight: active ? 510 : 400,
                  letterSpacing: '-0.011em',
                  color: active ? 'var(--text)' : 'var(--text-2)',
                  margin: 0,
                  marginBottom: 1,
                  fontFeatureSettings: '"cv01" on, "ss03" on',
                }}>
                  {link.label}
                </p>
                <p style={{
                  fontSize: 12,
                  color: 'var(--text-4)',
                  margin: 0,
                  letterSpacing: '0.01em',
                }}>
                  {link.sub}
                </p>
              </div>
            </Link>
          );
        })}

        {/* Theme row */}
        <button
          onClick={() => { haptic('light'); toggle(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px',
            background: 'transparent', border: 'none',
            borderTop: '1px solid var(--border)',
            cursor: 'pointer', marginTop: 'auto',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
            {theme === 'dark' ? '○' : '●'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-3)', letterSpacing: '-0.011em' }}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </span>
        </button>

        {/* Version */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, color: 'var(--text-4)', letterSpacing: '-0.01em', fontFamily: 'var(--font-mono)' }}>
            Personal OS · v0.1
          </p>
        </div>
      </div>
    </>
  );
}
