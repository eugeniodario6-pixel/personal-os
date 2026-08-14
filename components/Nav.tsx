'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Nav.module.css'

const tabs = [
  { href: '/', label: 'Today' },
  { href: '/meals', label: 'Meals' },
  { href: '/exercise', label: 'Exercise' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`${styles.tab} ${pathname === tab.href ? styles.active : ''}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
