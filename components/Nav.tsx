'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { haptic } from '@/lib/haptic';

const LINKS = [
  { href: '/',            label: 'TODAY',          sub: 'Dashboard' },
  { href: '/nutrition',   label: 'EAT',            sub: 'Nutrition' },
  { href: '/fitness',     label: 'MOVE',           sub: 'Fitness' },
  { href: '/habits',      label: 'HABITS',         sub: 'Daily habits' },
  { href: '/meditation',  label: 'MIND',           sub: 'Meditation' },
  { href: '/insights',    label: 'DATA',           sub: 'Insights' },
  { href: '/settings',    label: 'SETTINGS',       sub: 'Preferences' },
];

const MONO = "'IBM Plex Mono', monospace";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleNav = (href: string) => {
    haptic('light');
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      {/* ── Menu button — fixed top right ── */}
      <button
        onClick={() => { haptic('light'); setOpen(o => !o); }}
        style={{
          position: 'fixed', top: '1rem', right: '1rem',
          zIndex: 200,
          width: '2.5rem', height: '2.5rem',
          background: open ? '#fff' : '#111',
          border: '2px solid #2a2a2a',
          cursor: 'pointer',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '3px',
          padding: '8px',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {[0,1,2,3].map(i => (
          <span key={i} style={{
            display: 'block',
            background: open ? '#000' : '#fff',
            width: '100%', height: '100%',
          }} />
        ))}
      </button>

      {/* ── Backdrop ── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 198,
            background: 'rgba(0,0,0,0.85)',
          }}
        />
      )}

      {/* ── Slide-in drawer from right ── */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '75vw', maxWidth: 300,
        background: '#000',
        borderLeft: '2px solid #1a1a1a',
        zIndex: 199,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', flexDirection: 'column',
        paddingTop: '5rem',
        fontFamily: MONO,
      }}>
        {LINKS.map((link, i) => {
          const isActive = link.href === '/'
            ? pathname === '/'
            : pathname.startsWith(link.href);
          return (
            <button
              key={link.href}
              onClick={() => handleNav(link.href)}
              style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.1rem 1.5rem',
                background: isActive ? '#fff' : 'transparent',
                border: 'none',
                borderBottom: '1px solid #111',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: MONO,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div>
                <p style={{
                  fontSize: '0.875rem', fontWeight: 700,
                  letterSpacing: '0.1em', color: isActive ? '#000' : '#fff',
                  margin: 0, marginBottom: '0.1rem',
                }}>
                  {link.label}
                </p>
                <p style={{
                  fontSize: '0.55rem', fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: isActive ? '#555' : '#333', margin: 0,
                }}>
                  {link.sub}
                </p>
              </div>
              {isActive && (
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#000' }}>◈</span>
              )}
            </button>
          );
        })}

        {/* Bottom of drawer */}
        <div style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid #111' }}>
          <p style={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.15em', color: '#222', textTransform: 'uppercase' }}>
            PERSONAL OS · v0.1
          </p>
        </div>
      </div>
    </>
  );
}
