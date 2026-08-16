'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { haptic } from '@/lib/haptic';

// Bottom tabs — 5 main screens
const TABS = [
  { href: '/',          label: 'Today',    icon: '◉' },
  { href: '/nutrition', label: 'Eat',      icon: '⊕' },
  { href: '/fitness',   label: 'Move',     icon: '△' },
  { href: '/body',      label: 'Body',     icon: '◈' },
  { href: '/habits',    label: 'Habits',   icon: '✦' },
];

// Drawer links — all screens
const DRAWER = [
  { href: '/',           label: 'Today',       sub: 'Dashboard' },
  { href: '/nutrition',  label: 'Eat',         sub: 'Nutrition' },
  { href: '/fitness',    label: 'Move',        sub: 'Fitness' },
  { href: '/body',       label: 'Body',        sub: 'Weight log' },
  { href: '/habits',     label: 'Habits',      sub: 'Daily habits' },
  { href: '/meditation', label: 'Mind',        sub: 'Meditation' },
  { href: '/insights',   label: 'Data',        sub: 'Insights' },
  { href: '/settings',   label: 'Settings',    sub: 'Preferences' },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* ── Top bar ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: '3.5rem',
        background: 'rgba(15,15,20,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 1.25rem',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)' }}>
          Personal OS
        </span>
        <button
          onClick={() => { haptic('light'); setOpen(o => !o); }}
          style={{
            width: '2.25rem', height: '2.25rem',
            background: open ? '#fff' : 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '4px',
            padding: '0.55rem',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.15s',
          }}
        >
          {[0,1,2].map(i => (
            <span key={i} style={{
              display: 'block', width: '100%', height: '1.5px',
              background: open ? '#000' : '#fff',
              borderRadius: 2,
            }} />
          ))}
        </button>
      </div>

      {/* ── Bottom tab bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '4.5rem',
        background: 'rgba(15,15,20,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'stretch',
        paddingBottom: 'env(safe-area-inset-bottom)',
        fontFamily: "'Inter', system-ui, sans-serif",
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
                gap: '0.25rem',
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
                borderTop: active ? '2px solid #F59E0B' : '2px solid transparent',
                paddingTop: '0.5rem',
              }}
            >
              <span style={{ fontSize: '1.1rem', color: active ? '#F59E0B' : '#3A3A4A', transition: 'color 0.15s' }}>
                {tab.icon}
              </span>
              <span style={{ fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: active ? '#F59E0B' : '#3A3A4A', transition: 'color 0.15s' }}>
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
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }} />
      )}

      {/* ── Slide-in drawer ── */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '75vw', maxWidth: 300,
        background: '#0F0F14',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 299,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        paddingTop: '4.5rem',
        fontFamily: "'Inter', system-ui, sans-serif",
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
                background: active ? 'rgba(245,158,11,0.08)' : 'transparent',
                borderLeft: active ? '3px solid #F59E0B' : '3px solid transparent',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.1s',
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '1rem', fontWeight: active ? 700 : 500, color: active ? '#fff' : '#7A7A8C', margin: 0, marginBottom: '0.1rem', letterSpacing: '-0.01em' }}>
                  {link.label}
                </p>
                <p style={{ fontSize: '0.65rem', fontWeight: 500, color: active ? 'rgba(255,255,255,0.35)' : '#3A3A4A', margin: 0, letterSpacing: '0.02em' }}>
                  {link.sub}
                </p>
              </div>
              {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 8px #F59E0B' }} />}
            </Link>
          );
        })}

        <div style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', color: '#1E1E28', textTransform: 'uppercase' as const }}>
            Personal OS · v0.1
          </p>
        </div>
      </div>
    </>
  );
}
