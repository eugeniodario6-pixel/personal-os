'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { hapticLight, hapticMedium } from '@/lib/haptic';

const LINKS = [
  { href: '/',           label: 'TODAY',      icon: '◈' },
  { href: '/nutrition',  label: 'NUTRITION',  icon: '🥩' },
  { href: '/fitness',    label: 'FITNESS',    icon: '🏃' },
  { href: '/habits',     label: 'HABITS',     icon: '✓' },
  { href: '/meditation', label: 'MEDITATION', icon: '🧘' },
  { href: '/week',       label: 'WEEK',       icon: '📅' },
  { href: '/insights',   label: 'INSIGHTS',   icon: '◆' },
  { href: '/settings',   label: 'SETTINGS',   icon: '⚙' },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const navigate = (href: string) => {
    hapticMedium();
    setOpen(false);
    router.push(href);
  };

  const toggle = () => {
    hapticLight();
    setOpen(o => !o);
  };

  return (
    <>
      {/* Floating menu button — fixed top-right */}
      <button
        onClick={toggle}
        aria-label="Open menu"
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 200,
          width: '2.75rem',
          height: '2.75rem',
          borderRadius: '50%',
          border: 'none',
          background: 'var(--fg)',
          color: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '1.1rem',
          fontWeight: 700,
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          transition: 'transform 150ms ease',
        }}
      >
        ⠿
      </button>

      {/* Full-screen overlay */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 199,
            background: 'var(--bg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.25rem',
            animation: 'fadeIn 180ms ease both',
          }}
          onClick={() => setOpen(false)}
        >
          {/* Close button */}
          <button
            onClick={(e) => { e.stopPropagation(); hapticLight(); setOpen(false); }}
            style={{
              position: 'absolute',
              top: '1rem',
              left: '1rem',
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: '50%',
              border: '2px solid var(--border-color)',
              background: 'var(--bg)',
              color: 'var(--fg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem',
              fontWeight: 700,
            }}
          >
            ✕
          </button>

          {/* Nav items */}
          {LINKS.map((link, i) => {
            const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <button
                key={link.href}
                onClick={(e) => { e.stopPropagation(); navigate(link.href); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem 0',
                  animation: `fadeIn 180ms ease ${i * 40}ms both`,
                }}
              >
                {/* Circle icon */}
                <div
                  style={{
                    width: '3.5rem',
                    height: '3.5rem',
                    borderRadius: '50%',
                    background: isActive ? 'var(--fg)' : 'var(--bg-dark)',
                    border: `2px solid ${isActive ? 'var(--fg)' : 'var(--border-color)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.3rem',
                    transition: 'background 150ms ease',
                  }}
                >
                  {link.icon}
                </div>
                {/* Label */}
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: isActive ? 'var(--fg)' : 'var(--fg-muted)',
                    minWidth: '7rem',
                    textAlign: 'left',
                  }}
                >
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
