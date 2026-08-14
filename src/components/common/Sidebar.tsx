'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  userName?: string;
  userEmail?: string;
}

export default function Sidebar({ userName = 'Developer', userEmail = '' }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '□' },
    { href: '/timeline', label: 'Timeline', icon: '▷' },
    { href: '/review', label: 'Review & Submit', icon: '✓' },
  ];

  const settingsItems = [
    { href: '/settings', label: 'Settings', icon: '⚙' },
    { href: '/settings/integrations', label: 'Integrations', icon: '⇆' },
  ];

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    try {
      await signOut({ redirect: false });
    } catch {
      // Ignore network abort
    }
    window.location.href = '/login';
  };

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

        <button
          className={styles.navItem}
          onClick={handleSignOut}
          style={{ color: 'var(--error)', marginTop: 'var(--space-xs)' }}
        >
          <span className={styles.navIcon}>⎋</span>
          Sign Out
        </button>
      </nav>

      <div className={styles.footer}>
        <div
          className={styles.userInfo}
          onClick={handleSignOut}
          title="Click to sign out"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', minWidth: 0 }}>
            <div className={styles.avatar}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div className={styles.userName}>{userName}</div>
              {userEmail ? (
                <div className={styles.userEmail}>{userEmail}</div>
              ) : (
                <div className={styles.userEmail} style={{ color: 'var(--text-tertiary)' }}>Sign Out</div>
              )}
            </div>
          </div>
          <span style={{ fontSize: '0.875rem', color: 'var(--error)', opacity: 0.8, marginLeft: '4px' }}>⎋</span>
        </div>
      </div>
    </aside>
  );
}
