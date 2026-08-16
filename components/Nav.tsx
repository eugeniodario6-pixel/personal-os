'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { haptic } from '@/lib/haptic';

const LINKS = [
  { href: '/',           label: 'TODAY',    sub: 'Dashboard'  },
  { href: '/nutrition',  label: 'FUEL',     sub: 'Nutrition'  },
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
      {/* Menu button */}
      <button
        className={`menu-btn${open ? ' open' : ''}`}
        onClick={() => { haptic('light'); setOpen(o => !o); }}
        aria-label="Menu"
      >
        {[0,1,2,3].map(i => <span key={i} className="menu-btn-dot" />)}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 198, background: 'rgba(0,0,0,0.7)' }}
        />
      )}

      {/* Drawer */}
      <nav
        className="nav-drawer"
        style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {LINKS.map(link => {
          const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return (
            <button
              key={link.href}
              className={`nav-item${isActive ? ' active' : ''}`}
              onClick={() => go(link.href)}
            >
              <div>
                <p className="nav-label">{link.label}</p>
                <p className="nav-sub">{link.sub}</p>
              </div>
              {isActive && (
                <span style={{ fontSize: '0.7rem', color: '#000', fontWeight: 700 }}>◈</span>
              )}
            </button>
          );
        })}

        <div style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid #0d0d0d' }}>
          <p className="label-sm" style={{ color: '#1a1a1a' }}>PERSONAL OS · v0.1</p>
        </div>
      </nav>
    </>
  );
}
