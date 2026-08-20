'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { haptic } from '@/lib/haptic';
import { useTheme } from './ThemeProvider';

const TABS = [
  { href: '/',           label: 'Today',  icon: '◉' },
  { href: '/nutrition',  label: 'Eat',    icon: '⊕' },
  { href: '/jarvis',     label: 'Jarvis', icon: '⬡', lime: true },
  { href: '/fitness',    label: 'Move',   icon: '△' },
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

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* ── Top-right menu button ── */}
      <div style={{
        position: 'fixed', top: 16, right: 16,
        zIndex: 300,
      }}>
        <button
          onClick={() => { haptic('light'); setOpen(o => !o); }}
          style={{
            width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#141414',
            borderRadius: '50%',
            border: 'none',
            boxShadow: 'rgba(255,255,255,0.06) 0px 0px 0px 1px inset',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.15s',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5, width: 14 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                display: 'block',
                width: '100%',
                height: 1.5,
                background: open ? 'var(--text)' : 'var(--text-3)',
                borderRadius: 1,
                transition: 'background 0.15s',
              }} />
            ))}
          </div>
        </button>
      </div>

      {/* ── Floating pill tab bar ── */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: '7px',
        paddingBottom: 'max(7px, env(safe-area-inset-bottom))',
        background: '#141414',
        borderRadius: 9999,
        boxShadow: 'rgba(255,255,255,0.07) 0px 0px 0px 1px inset, rgba(0,0,0,0.6) 0px 12px 40px 0px',
      }}>
        {TABS.map(tab => {
          const active = isActive(tab.href);
          const isJarvis = (tab as any).lime;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => haptic('light')}
              title={tab.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: active ? 56 : isJarvis ? 54 : 52,
                height: 56,
                borderRadius: 9999,
                background: active
                  ? (isJarvis ? '#DAFF01' : '#DAFF01')
                  : isJarvis ? 'transparent' : 'transparent',
                boxShadow: !active && isJarvis
                  ? 'rgba(218,255,1,0.5) 0px 0px 0px 1.5px inset, rgba(218,255,1,0.15) 0px 0px 12px'
                  : 'none',
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                flexShrink: 0,
              }}
            >
              <span style={{
                fontSize: isJarvis ? 22 : 20,
                color: active ? '#000000' : isJarvis ? '#DAFF01' : 'rgba(255,255,255,0.30)',
                transition: 'color 0.2s',
                lineHeight: 1,
                filter: !active && isJarvis ? 'drop-shadow(0 0 6px #DAFF01)' : 'none',
              }}>
                {tab.icon}
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
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* ── Drawer ── */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '68vw', maxWidth: 260,
        background: '#141414',
        boxShadow: 'rgba(255,255,255,0.06) 0px 0px 0px 1px inset, rgba(0,0,0,0.6) 0px 0px 40px 0px',
        zIndex: 299,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 60,
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
                borderLeft: `2px solid ${active ? 'rgba(255,255,255,0.5)' : 'transparent'}`,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.12s',
                gap: 12,
              }}
            >
              <span style={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                background: active ? 'rgba(255,255,255,0.7)' : 'transparent',
                transition: 'background 0.15s',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 14,
                  fontWeight: active ? 510 : 400,
                  letterSpacing: '-0.011em',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.50)',
                  margin: 0, marginBottom: 1,
                  fontFeatureSettings: '"cv01" on, "ss03" on',
                }}>
                  {link.label}
                </p>
                <p style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.25)',
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}>
                  {link.sub}
                </p>
              </div>
            </Link>
          );
        })}

        {/* Theme toggle */}
        <button
          onClick={() => { haptic('light'); toggle(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px',
            background: 'transparent', border: 'none',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer', marginTop: 'auto',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)' }}>
            {theme === 'dark' ? '○' : '●'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.35)', letterSpacing: '-0.011em' }}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </span>
        </button>

        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.20)', letterSpacing: '-0.01em', fontFamily: 'var(--font-mono)' }}>
            Personal OS · v0.1
          </p>
        </div>
      </div>
    </>
  );
}
