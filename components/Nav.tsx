'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { haptic } from '@/lib/haptic';
import { useTheme } from './ThemeProvider';
import { Home, Utensils, BrainCircuit, Zap, TrendingUp } from 'lucide-react';

const TABS = [
  { href: '/',           label: 'Today',    Icon: Home },
  { href: '/nutrition',  label: 'Eat',      Icon: Utensils },
  { href: '/jarvis',     label: 'Jarvis',   Icon: BrainCircuit, accent: true },
  { href: '/fitness',    label: 'Move',     Icon: Zap },
  { href: '/progress',   label: 'Progress', Icon: TrendingUp },
];

const DRAWER = [
  { href: '/',           label: 'TODAY',    sub: 'Dashboard' },
  { href: '/nutrition',  label: 'EAT',      sub: 'Nutrition' },
  { href: '/fitness',    label: 'MOVE',     sub: 'Fitness' },
  { href: '/body',       label: 'BODY',     sub: 'Weight log' },
  { href: '/habits',     label: 'HABITS',   sub: 'Daily habits' },
  { href: '/meditation', label: 'MIND',     sub: 'Meditation' },
  { href: '/insights',   label: 'DATA',     sub: 'Insights' },
  { href: '/settings',   label: 'SETTINGS', sub: 'Preferences' },
];

// Atlantic ice-white at various opacities
const ICE   = 'rgba(216,234,255,';
const COBALT = '#1f58f2';
const ORANGE = '#ff4105';

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* ── Top-right menu button — wireframe circle ── */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 300 }}>
        <button
          onClick={() => { haptic('light'); setOpen(o => !o); }}
          style={{
            width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#0d0d0f',
            borderRadius: '50%',
            border: `1px solid ${ICE}0.13)`,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            transition: 'border-color 0.15s',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5, width: 14 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                display: 'block',
                width: i === 1 ? '75%' : '100%',
                height: 1,
                background: open ? ICE + '0.8)' : ICE + '0.35)',
                borderRadius: 1,
                transition: 'background 0.15s',
              }} />
            ))}
          </div>
        </button>
      </div>

      {/* ── Floating pill tab bar — Atlantic wireframe ── */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: '6px',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
        background: '#0d0d0f',
        borderRadius: 9999,
        border: `1px solid ${ICE}0.10)`,
      }}>
        {TABS.map(tab => {
          const active = isActive(tab.href);
          const isAccent = tab.accent;
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
                width: 52,
                height: 52,
                borderRadius: 9999,
                background: active
                  ? ICE + '0.08)'
                  : 'transparent',
                border: active
                  ? `1px solid ${ICE}0.15)`
                  : isAccent
                  ? `1px solid ${COBALT}44`
                  : '1px solid transparent',
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                flexShrink: 0,
              }}
            >
              <tab.Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.5}
                color={
                  active
                    ? `rgba(216,234,255,0.90)`
                    : isAccent
                    ? COBALT
                    : `rgba(216,234,255,0.25)`
                }
              />
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
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        />
      )}

      {/* ── Drawer — Atlantic wireframe panel ── */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '68vw', maxWidth: 260,
        background: '#0d0d0f',
        borderLeft: `1px solid ${ICE}0.10)`,
        zIndex: 299,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 72,
        overflowY: 'auto',
      }}>
        {/* Wordmark */}
        <div style={{ padding: '0 20px 24px', borderBottom: `1px solid ${ICE}0.06)` }}>
          <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.20em', color: ICE + '0.25)', margin: 0 }}>
            PERSONAL OS
          </p>
        </div>

        {DRAWER.map(link => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => { haptic('light'); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '12px 20px',
                background: active ? `${ICE}0.04)` : 'transparent',
                borderBottom: `1px solid ${ICE}0.05)`,
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.12s',
                gap: 12,
              }}
            >
              {/* Active indicator — cobalt dot */}
              <span style={{
                width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                background: active ? COBALT : 'transparent',
                transition: 'background 0.15s',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 400,
                  letterSpacing: '0.12em',
                  color: active ? ICE + '0.90)' : ICE + '0.35)',
                  margin: 0, marginBottom: 2,
                }}>
                  {link.label}
                </p>
                <p style={{
                  fontSize: 11,
                  color: ICE + '0.20)',
                  margin: 0,
                  letterSpacing: '0.04em',
                }}>
                  {link.sub}
                </p>
              </div>
              {/* Active chevron */}
              {active && (
                <span style={{ fontSize: 10, color: COBALT, opacity: 0.7 }}>›</span>
              )}
            </Link>
          );
        })}

        {/* Theme toggle */}
        <button
          onClick={() => { haptic('light'); toggle(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 20px',
            background: 'transparent', border: 'none',
            borderTop: `1px solid ${ICE}0.06)`,
            cursor: 'pointer', marginTop: 'auto',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: ICE + '0.25)' }}>
            {theme === 'dark' ? 'LIGHT' : 'DARK'}
          </span>
        </button>

        {/* Version stamp */}
        <div style={{ padding: '10px 20px', borderTop: `1px solid ${ICE}0.05)` }}>
          <p style={{ fontSize: 10, color: ICE + '0.15)', letterSpacing: '0.10em', fontFamily: 'var(--font-mono)', margin: 0 }}>
            v0.1 · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </>
  );
}
