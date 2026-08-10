import AppLayout from '@/components/common/AppLayout';
import styles from './page.module.css';

export const metadata = {
  title: 'Dashboard - TimeRecon',
  description: 'Your workday reconstruction dashboard',
};

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Good evening
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-xs)' }}>
            Here is your work summary
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>--</div>
            <div className={styles.statLabel}>Hours Today</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>--</div>
            <div className={styles.statLabel}>Allocated</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>--</div>
            <div className={styles.statLabel}>Needs Review</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>--</div>
            <div className={styles.statLabel}>Integrations</div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>&#9776;</div>
            <div className={styles.emptyTitle}>No integrations connected</div>
            <p className={styles.emptyText}>
              Connect Jira, GitHub, and Google Calendar to start reconstructing your workday automatically.
            </p>
            <a href="/settings/integrations" className="btn btn-primary">
              Connect Integrations
            </a>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
