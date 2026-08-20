'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { haptic } from '@/lib/haptic';

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { href: '/',          icon: '◉', label: 'Today'  },
  { href: '/nutrition', icon: '⊕', label: 'Eat'    },
  { href: '/fitness',   icon: '△', label: 'Move'   },
  { href: '/body',      icon: '◈', label: 'Body'   },
  { href: '/habits',    icon: '✦', label: 'Habits' },
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

// ── Sliding pill nav ──────────────────────────────────────────────────────────
export default function Nav() {
  const pathname  = usePathname();
  const [open, setOpen] = useState(false);
  const [pillX, setPillX] = useState(0);
  const [ready, setReady] = useState(false);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const barRef  = useRef<HTMLDivElement>(null);

  const activeIdx = TABS.findIndex(t =>
    t.href === '/' ? pathname === '/' : pathname.startsWith(t.href)
  );

  // Compute pill position from tab element centres
  useEffect(() => {
    const updatePill = () => {
      const bar = barRef.current;
      const tab = tabRefs.current[activeIdx];
      if (!bar || !tab) return;
      const barRect = bar.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      setPillX(tabRect.left - barRect.left + tabRect.width / 2 - PILL / 2);
      setReady(true);
    };
    updatePill();
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [activeIdx]);

  const PILL    = 44;   // pill circle diameter px
  const BAR_H   = 60;   // bar height px
  const PAD     = 8;    // inner pad

  return (
    <>
      {/* ── Menu button — top right ── */}
      <button
        onClick={() => { haptic('light'); setOpen(o => !o); }}
        style={{
          position: 'fixed', top: 14, right: 16, zIndex: 400,
          width: 36, height: 36, borderRadius: '50%',
          background: open ? '#ffffff' : '#141414',
          boxShadow: open ? 'none' : 'rgba(255,255,255,0.08) 0px 0px 0px 1px inset',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent',
          transition: 'background 0.2s',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 14 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              display: 'block', width: '100%', height: 1.5,
              background: open ? '#000000' : 'rgba(255,255,255,0.7)',
              borderRadius: 1,
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
      </button>

      {/* ── Floating pill tab bar ── */}
      <div style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 300,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div
          ref={barRef}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            height: BAR_H,
            background: '#141414',
            borderRadius: BAR_H / 2,
            boxShadow: 'rgba(255,255,255,0.08) 0px 0px 0px 1px inset',
            padding: `0 ${PAD}px`,
            gap: 0,
          }}
        >
          {/* Sliding white pill */}
          {ready && (
            <div style={{
              position: 'absolute',
              top: (BAR_H - PILL) / 2,
              left: pillX,
              width: PILL,
              height: PILL,
              borderRadius: '50%',
              background: '#ffffff',
              transition: 'left 0.38s cubic-bezier(0.34, 1.3, 0.64, 1)',
              pointerEvents: 'none',
              zIndex: 0,
            }} />
          )}

          {/* Tab items */}
          {TABS.map((tab, i) => {
            const active = i === activeIdx;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                ref={el => { tabRefs.current[i] = el; }}
                onClick={() => haptic('light')}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: BAR_H,
                  textDecoration: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  flexShrink: 0,
                }}
              >
                <span style={{
                  fontSize: 17,
                  lineHeight: 1,
                  color: active ? '#000000' : 'rgba(255,255,255,0.55)',
                  transition: 'color 0.25s',
                  userSelect: 'none',
                }}>
                  {tab.icon}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Backdrop ── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 298,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        />
      )}

      {/* ── Drawer ── */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '72vw', maxWidth: 280,
        background: '#141414',
        boxShadow: 'rgba(255,255,255,0.06) 0px 0px 0px 1px inset',
        zIndex: 299,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 56,
        overflowY: 'auto',
      }}>
        {DRAWER.map(link => {
          const active = link.href === '/'
            ? pathname === '/'
            : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => { haptic('light'); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '12px 20px',
                background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
                gap: 12,
              }}
            >
              <span style={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                background: active ? '#ffffff' : 'transparent',
              }} />
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: 15, fontWeight: active ? 510 : 400,
                  letterSpacing: '-0.011em',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
                  margin: '0 0 2px',
                }}>
                  {link.label}
                </p>
                <p style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.3)',
                  margin: 0, letterSpacing: '0.01em',
                  textTransform: 'uppercase' as const,
                }}>
                  {link.sub}
                </p>
              </div>
            </Link>
          );
        })}

        {/* Version */}
        <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
            Personal OS · v0.1
          </p>
        </div>
      </div>
    </>
  );
}
