'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'TODAY' },
  { href: '/nutrition', label: 'EAT' },
  { href: '/fitness', label: 'MOVE' },
  { href: '/habits', label: 'HABITS' },
  { href: '/meditation', label: 'MIND' },
  { href: '/insights', label: 'DATA' },
  { href: '/settings', label: 'SET' },
  { href: '/week', label: 'WEEK' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#000',
        borderTop: '2px solid #444',
        display: 'flex',
        zIndex: 100,
        overflowX: 'auto',
      }}
    >
      {LINKS.map((link) => {
        const isActive =
          link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              flex: '1 0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.75rem 0.4rem',
              fontSize: '0.55rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              fontFamily: "'IBM Plex Mono', monospace",
              color: isActive ? '#fff' : '#444',
              background: isActive ? '#111' : '#000',
              borderTop: isActive ? '2px solid #fff' : '2px solid transparent',
              marginTop: '-2px',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
