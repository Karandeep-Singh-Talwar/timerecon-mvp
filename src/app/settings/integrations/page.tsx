'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/common/AppLayout';
import SeedDemoButton from '@/components/common/SeedDemoButton';
import styles from './page.module.css';

interface IntegrationItem {
  id: 'jira' | 'github' | 'google_calendar';
  name: string;
  description: string;
  icon: string;
}

const baseIntegrations: IntegrationItem[] = [
  {
    id: 'jira',
    name: 'Jira Cloud',
    description: 'Import projects, issues, and work context from Jira Cloud',
    icon: '■',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Import commits, pull requests, branches, and code review activity',
    icon: '⚇',
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Import meetings and calendar events',
    icon: '◒',
  },
];

export default function IntegrationsPage() {
  const [connectedMap, setConnectedMap] = useState<Record<string, boolean>>({});
  const [lastSyncMap, setLastSyncMap] = useState<Record<string, string>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [connectModalProvider, setConnectModalProvider] = useState<IntegrationItem | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchIntegrations = async () => {
    try {
      const res = await fetch('/api/integrations');
      if (res.ok) {
        const data = await res.json();
        const connMap: Record<string, boolean> = {};
        const syncMap: Record<string, string> = {};
        if (Array.isArray(data.integrations)) {
          data.integrations.forEach((item: any) => {
            if (item.status === 'active') {
              connMap[item.provider] = true;
              if (item.lastSyncAt) {
                syncMap[item.provider] = new Date(item.lastSyncAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
              }
            }
          });
        }
        setConnectedMap(connMap);
        setLastSyncMap(syncMap);
      }
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleDisconnect = async (provider: string) => {
    setLoadingMap((prev) => ({ ...prev, [provider]: true }));
    try {
      const res = await fetch('/api/integrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });

      if (res.ok) {
        setConnectedMap((prev) => ({ ...prev, [provider]: false }));
        setMessage({ text: `${provider.toUpperCase()} disconnected successfully.`, type: 'success' });
      } else {
        const errData = await res.json();
        setMessage({ text: errData.error || 'Failed to disconnect integration.', type: 'error' });
      }
    } catch (err) {
      console.error('Disconnect error:', err);
      setMessage({ text: 'Error disconnecting integration.', type: 'error' });
    } finally {
      setLoadingMap((prev) => ({ ...prev, [provider]: false }));
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleSyncNow = async (provider: string) => {
    setLoadingMap((prev) => ({ ...prev, [`sync-${provider}`]: true }));
    try {
      const res = await fetch(`/api/integrations/${provider}/sync`, {
        method: 'POST',
      });

      if (res.ok) {
        setMessage({ text: `${provider.toUpperCase()} data synced successfully.`, type: 'success' });
        fetchIntegrations();
      } else {
        setMessage({ text: 'Sync failed or provider offline.', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Error triggering sync.', type: 'error' });
    } finally {
      setLoadingMap((prev) => ({ ...prev, [`sync-${provider}`]: false }));
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const openConnectModal = (item: IntegrationItem) => {
    setConnectModalProvider(item);
  };

  const startOAuthConnect = (providerId: string, mock: boolean) => {
    const url = `/api/integrations/${providerId}/connect${mock ? '?mock=true' : ''}`;
    window.location.href = url;
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Integrations
            </h1>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-xs)' }}>
              Connect your work tools or test mock sync to reconstruct your workday
            </p>
          </div>
          <SeedDemoButton onSuccess={fetchIntegrations} />
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
              border: `1px solid ${message.type === 'success' ? 'var(--confidence-high-border)' : 'var(--confidence-low-border)'}`,
            }}
          >
            {message.text}
          </div>
        )}

        <div className={styles.integrationCards}>
          {baseIntegrations.map((integration) => {
            const isConnected = !!connectedMap[integration.id];
            const isDisconnecting = loadingMap[integration.id];
            const isSyncing = loadingMap[`sync-${integration.id}`];
            const lastSync = lastSyncMap[integration.id];

            return (
              <div key={integration.id} className={styles.integrationCard}>
                <div className={styles.integrationInfo}>
                  <div className={styles.integrationIcon}>{integration.icon}</div>
                  <div>
                    <div className={styles.integrationName}>{integration.name}</div>
                    <div className={styles.integrationDesc}>{integration.description}</div>
                    {isConnected && lastSync && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                        Last synced today at {lastSync}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.integrationStatus}>
                  {isConnected ? (
                    <>
                      <span className={`${styles.statusDot} ${styles.statusConnected}`} />
                      <span style={{ fontSize: '0.8125rem', color: 'var(--success)' }}>Connected</span>
                      
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleSyncNow(integration.id)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? 'Syncing...' : 'Sync Now'}
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDisconnect(integration.id)}
                        disabled={isDisconnecting}
                        style={{ color: 'var(--error)' }}
                      >
                        {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`${styles.statusDot} ${styles.statusDisconnected}`} />
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginRight: 'var(--space-xs)' }}>Disconnected</span>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openConnectModal(integration)}
                      >
                        Connect
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Connect Options Modal */}
        {connectModalProvider && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 'var(--space-md)',
            }}
            onClick={() => setConnectModalProvider(null)}
          >
            <div
              className="card"
              style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-xl)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>
                Connect {connectModalProvider.name}
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)' }}>
                Choose how you want to connect this integration:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: 'var(--space-md)' }}
                  onClick={() => startOAuthConnect(connectModalProvider.id, false)}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600 }}>1. Live OAuth 2.0 Connect</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '2px' }}>
                      Authenticate directly with real {connectModalProvider.name} credentials
                    </div>
                  </div>
                </button>

                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: 'var(--space-md)' }}
                  onClick={() => startOAuthConnect(connectModalProvider.id, true)}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600 }}>2. Quick Mock Connect (Demo Mode)</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      Instantly connect in simulated mode without requiring OAuth client keys
                    </div>
                  </div>
                </button>

                <button
                  className="btn btn-ghost"
                  style={{ width: '100%', marginTop: 'var(--space-xs)' }}
                  onClick={() => setConnectModalProvider(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
