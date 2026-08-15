'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { haptic } from '@/lib/haptic';

const MAIN_LINKS = [
  { href: '/',           label: 'TODAY',  icon: '◈' },
  { href: '/nutrition',  label: 'EAT',    icon: '◎' },
  { href: '/fitness',    label: 'MOVE',   icon: '△' },
  { href: '/habits',     label: 'HABITS', icon: '□' },
  { href: '/meditation', label: 'MIND',   icon: '○' },
];

const MENU_LINKS = [
  { href: '/insights',  label: 'DATA & INSIGHTS' },
  { href: '/settings',  label: 'SETTINGS' },
  { href: '/log',       label: 'QUICK LOG' },
];

const MONO = "'IBM Plex Mono', monospace";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* ── Slide-up menu ── */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 98,
              background: 'rgba(0,0,0,0.7)',
            }}
          />
          {/* Panel */}
          <div style={{
            position: 'fixed', bottom: '5.5rem', left: 0, right: 0,
            background: '#080808', borderTop: '2px solid #2a2a2a',
            zIndex: 99, fontFamily: MONO,
          }}>
            {MENU_LINKS.map((link, i) => (
              <button
                key={link.href}
                onClick={() => {
                  haptic('light');
                  setMenuOpen(false);
                  router.push(link.href);
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '1.1rem 1.25rem',
                  background: 'none', border: 'none',
                  borderBottom: i < MENU_LINKS.length - 1 ? '1px solid #1a1a1a' : 'none',
                  cursor: 'pointer', fontFamily: MONO,
                  color: '#fff', fontSize: '0.8rem', fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  textAlign: 'left',
                }}
              >
                {link.label}
                <span style={{ color: '#333', fontSize: '1rem' }}>→</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Bottom nav ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#000', borderTop: '2px solid #1a1a1a',
        display: 'flex', zIndex: 100,
      }}>
        {MAIN_LINKS.map(link => {
          const isActive = link.href === '/'
            ? pathname === '/'
            : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => haptic('light')}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '0.75rem 0.25rem 0.6rem',
                fontSize: '0.48rem', fontWeight: 700, letterSpacing: '0.12em',
                fontFamily: MONO, color: isActive ? '#fff' : '#333',
                textDecoration: 'none',
                borderTop: `2px solid ${isActive ? '#fff' : 'transparent'}`,
                marginTop: '-2px',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: '1rem', marginBottom: '0.2rem', lineHeight: 1 }}>
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}

        {/* ── Menu button ── */}
        <button
          onClick={() => { haptic('light'); setMenuOpen(o => !o); }}
          style={{
            flex: 1,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '0.75rem 0.25rem 0.6rem',
            fontSize: '0.48rem', fontWeight: 700, letterSpacing: '0.12em',
            fontFamily: MONO, color: menuOpen ? '#fff' : '#333',
            background: 'none', border: 'none', cursor: 'pointer',
            borderTop: `2px solid ${menuOpen ? '#fff' : 'transparent'}`,
            marginTop: '-2px',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: '1rem', marginBottom: '0.2rem', lineHeight: 1 }}>
            {menuOpen ? '✕' : '≡'}
          </span>
          MORE
        </button>
      </nav>
    </>
  );
}
