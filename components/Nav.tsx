'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { haptic } from '@/lib/haptic';

const LINKS = [
  { href: '/',           label: 'TODAY',    sub: 'Dashboard'  },
  { href: '/nutrition',  label: 'EAT',      sub: 'Nutrition'  },
  { href: '/fitness',    label: 'TRAIN',    sub: 'Fitness'    },
  { href: '/habits',     label: 'HABITS',   sub: 'Daily'      },
  { href: '/meditation', label: 'MIND',     sub: 'Meditation' },
  { href: '/insights',   label: 'DATA',     sub: 'Insights'   },
  { href: '/settings',   label: 'SETTINGS', sub: 'Preferences'},
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const go = (href: string) => {
    haptic('light');
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        className={`menu-btn t-fast${open ? ' open' : ''}`}
        onClick={() => { haptic('light'); setOpen(o => !o); }}
        aria-label="Menu"
      >
        {[0,1,2,3].map(i => <span key={i} className="menu-btn-dot" />)}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 198, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
        />
      )}

      <nav
        className="nav-drawer t-slide"
        style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {LINKS.map(link => {
          const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return (
            <button
              key={link.href}
              className={`nav-item t-fast${isActive ? ' active' : ''}`}
              onClick={() => go(link.href)}
            >
              <div>
                <p className="nav-label">{link.label}</p>
                <p className="nav-sub">{link.sub}</p>
              </div>
              {isActive && (
                <span style={{ color: 'var(--accent)', fontSize: '0.65rem' }}>◈</span>
              )}
            </button>
          );
        })}
        <div style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <p className="label-xs" style={{ color: 'var(--text-ghost)' }}>PERSONAL OS · v0.1</p>
        </div>
      </nav>
    </>
  );
}
