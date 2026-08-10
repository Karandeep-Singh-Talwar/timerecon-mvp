'use client';

import { useState } from 'react';

interface SeedDemoButtonProps {
  onSuccess?: () => void;
  className?: string;
}

export default function SeedDemoButton({ onSuccess, className }: SeedDemoButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/demo/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to seed demo data');
      }

      setMessage('✓ 5 days of reconstructed work successfully seeded!');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during demo reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      <button
        type="button"
        className={className || 'btn btn-primary btn-sm'}
        onClick={handleSeed}
        disabled={loading}
      >
        {loading ? 'Seeding 5-Day Demo Data...' : 'Seed 5-Day Demo Data'}
      </button>

      {message && (
        <span style={{ fontSize: '0.8125rem', color: 'var(--success)', fontWeight: 500 }}>
          {message}
        </span>
      )}

      {error && (
        <span style={{ fontSize: '0.8125rem', color: 'var(--accent-secondary)', fontWeight: 500 }}>
          {error}
        </span>
      )}
    </div>
  );
}
