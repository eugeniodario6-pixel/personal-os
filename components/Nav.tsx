'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/',          label: 'TODAY',   icon: '◈' },
  { href: '/nutrition', label: 'EAT',     icon: '◎' },
  { href: '/fitness',   label: 'MOVE',    icon: '△' },
  { href: '/habits',    label: 'HABITS',  icon: '□' },
  { href: '/meditation',label: 'MIND',    icon: '○' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {LINKS.map(link => {
        const isActive = link.href === '/'
          ? pathname === '/'
          : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
