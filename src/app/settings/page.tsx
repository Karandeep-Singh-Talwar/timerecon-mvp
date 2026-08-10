import AppLayout from '@/components/common/AppLayout';
import SeedDemoButton from '@/components/common/SeedDemoButton';
import styles from './page.module.css';

export const metadata = {
  title: 'Settings - TimeRecon',
  description: 'Manage your TimeRecon settings and profile',
};

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Settings
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-xs)' }}>
            Manage your profile, preferences, and demo environment
          </p>
        </div>

        <div className={styles.settingsGrid}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Profile</h2>
            </div>
            <div className="form-group">
              <label className="label" htmlFor="name">Full Name</label>
              <input id="name" className="input" type="text" placeholder="Your name" />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="input" type="email" placeholder="your@email.com" disabled />
            </div>
            <div className={styles.fieldRow}>
              <div className="form-group">
                <label className="label" htmlFor="timezone">Timezone</label>
                <select id="timezone" className="input">
                  <option value="UTC">UTC</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label" htmlFor="workingHours">Working Hours</label>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                  <input id="workingHoursStart" className="input" type="time" defaultValue="09:00" />
                  <span style={{ color: 'var(--text-tertiary)' }}>to</span>
                  <input id="workingHoursEnd" className="input" type="time" defaultValue="17:30" />
                </div>
              </div>
            </div>
            <button className="btn btn-primary">Save Changes</button>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Dogfooding & Demo Environment</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Instantly seed 5 consecutive days of rich developer activity (Monday through Friday) to test the workday reconstruction engine and review interface.
                </p>
              </div>
            </div>
            <SeedDemoButton />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

