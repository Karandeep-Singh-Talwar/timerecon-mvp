'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './Sidebar.module.css';

interface SidebarProps {
  userName?: string;
  userEmail?: string;
}

export default function Sidebar({ userName = 'Developer', userEmail = '' }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '\u25A1' },
    { href: '/timeline', label: 'Timeline', icon: '\u25B7' },
    { href: '/review', label: 'Review & Submit', icon: '\u2713' },
  ];

  const settingsItems = [
    { href: '/settings', label: 'Settings', icon: '\u2699' },
    { href: '/settings/integrations', label: 'Integrations', icon: '\u21C4' },
  ];

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoText}>TimeRecon</div>
        <div className={styles.logoSub}>Work Journal</div>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navSection}>Workspace</div>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <div className={styles.navSection}>Account</div>
        {settingsItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${pathname?.startsWith(item.href) ? styles.navItemActive : ''}`}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>{initials}</div>
          <div>
            <div className={styles.userName}>{userName}</div>
            {userEmail && <div className={styles.userEmail}>{userEmail}</div>}
          </div>
        </div>
      </div>
    </aside>
  );
}
