'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/common/AppLayout';
import SeedDemoButton from '@/components/common/SeedDemoButton';
import styles from './page.module.css';

interface Profile {
  id: string;
  name: string;
  email: string;
  timezone: string;
  workingHoursStart: string;
  workingHoursEnd: string;
}

const TIMEZONE_OPTIONS = [
  'UTC',
  'Asia/Kolkata',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [workingHoursStart, setWorkingHoursStart] = useState('09:00');
  const [workingHoursEnd, setWorkingHoursEnd] = useState('17:30');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/profile');
      if (!res.ok) {
        setMessage({ text: 'Could not load profile.', type: 'error' });
        return;
      }
      const data = await res.json();
      const p = data.profile as Profile;
      setProfile(p);
      setName(p.name || '');
      setTimezone(p.timezone || 'UTC');
      setWorkingHoursStart(p.workingHoursStart || '09:00');
      setWorkingHoursEnd(p.workingHoursEnd || '17:30');
    } catch {
      setMessage({ text: 'Could not load profile.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          timezone,
          workingHoursStart,
          workingHoursEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || 'Failed to save profile.', type: 'error' });
        return;
      }
      const p = data.profile as Profile;
      setProfile(p);
      setMessage({ text: 'Profile saved.', type: 'success' });
      // Refresh layout sidebar name
      window.dispatchEvent(new Event('timerecon:profile-updated'));
    } catch {
      setMessage({ text: 'Failed to save profile.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const timezoneOptions = TIMEZONE_OPTIONS.includes(timezone)
    ? TIMEZONE_OPTIONS
    : [timezone, ...TIMEZONE_OPTIONS];

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

        {message && (
          <div
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-md)',
              fontSize: '0.875rem',
              background: message.type === 'success' ? 'var(--confidence-high-bg)' : 'var(--confidence-low-bg)',
              color: message.type === 'success' ? 'var(--confidence-high)' : 'var(--error)',
              border: `1px solid ${
                message.type === 'success' ? 'var(--confidence-high-border)' : 'var(--confidence-low-border)'
              }`,
            }}
          >
            {message.text}
          </div>
        )}

        <div className={styles.settingsGrid}>
          <form className={styles.section} onSubmit={handleSave}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Profile</h2>
            </div>

            {loading ? (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Loading profile…</p>
            ) : (
              <>
                <div className="form-group">
                  <label className="label" htmlFor="name">
                    Full Name
                  </label>
                  <input
                    id="name"
                    className="input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                  />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    className="input"
                    type="email"
                    value={profile?.email || ''}
                    disabled
                  />
                </div>
                <div className={styles.fieldRow}>
                  <div className="form-group">
                    <label className="label" htmlFor="timezone">
                      Timezone
                    </label>
                    <select
                      id="timezone"
                      className="input"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                    >
                      {timezoneOptions.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz === 'Asia/Kolkata' ? 'Asia/Kolkata (IST)' : tz}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="workingHours">
                      Working Hours
                    </label>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                      <input
                        id="workingHoursStart"
                        className="input"
                        type="time"
                        value={workingHoursStart}
                        onChange={(e) => setWorkingHoursStart(e.target.value)}
                        required
                      />
                      <span style={{ color: 'var(--text-tertiary)' }}>to</span>
                      <input
                        id="workingHoursEnd"
                        className="input"
                        type="time"
                        value={workingHoursEnd}
                        onChange={(e) => setWorkingHoursEnd(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
                <button className="btn btn-primary" type="submit" disabled={saving || loading}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            )}
          </form>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Dogfooding & Demo Environment</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Instantly seed 5 consecutive days of rich developer activity (Monday through Friday)
                  to test the workday reconstruction engine and review interface.
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
