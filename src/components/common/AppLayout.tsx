'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import styles from './AppLayout.module.css';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [userName, setUserName] = useState('Developer');
  const [userEmail, setUserEmail] = useState('');

  const loadUser = async () => {
    try {
      const res = await fetch('/api/user/profile');
      if (!res.ok) return;
      const data = await res.json();
      if (data.profile?.name) setUserName(data.profile.name);
      if (data.profile?.email) setUserEmail(data.profile.email);
    } catch {
      // Keep defaults
    }
  };

  useEffect(() => {
    loadUser();
    const onUpdate = () => loadUser();
    window.addEventListener('timerecon:profile-updated', onUpdate);
    return () => window.removeEventListener('timerecon:profile-updated', onUpdate);
  }, []);

  return (
    <div className={styles.layout}>
      <Sidebar userName={userName} userEmail={userEmail} />
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
