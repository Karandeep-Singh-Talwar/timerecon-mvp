'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password.');
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError('');
    setLoading(true);
    setEmail('dev@timerecon.test');
    setPassword('password123');

    try {
      const result = await signIn('credentials', {
        email: 'dev@timerecon.test',
        password: 'password123',
        redirect: false,
      });

      if (result?.error) {
        setError('Demo login failed. You can create a new account via Create one.');
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setError('Something went wrong during demo login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authContainer}>
        <div className={styles.authLogo}>
          <div className={styles.authLogoText}>TimeRecon</div>
          <div className={styles.authLogoSub}>AI Workday Reconstruction</div>
        </div>

        <div className={styles.authCard}>
          <h1 className={styles.authTitle}>Sign in</h1>

          {error && <div className={styles.authError}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              className={`btn btn-primary ${styles.submitBtn}`}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDemoLogin}
              disabled={loading}
              style={{ width: '100%', marginTop: 'var(--space-sm)' }}
            >
              ⚡ Quick Demo Login (dev@timerecon.test)
            </button>
          </form>
        </div>

        <div className={styles.authFooter}>
          Don&apos;t have an account?{' '}
          <Link href="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}
