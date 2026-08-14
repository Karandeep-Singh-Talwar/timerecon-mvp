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

type ConnectionState = 'active' | 'expired' | 'disconnected';

export default function IntegrationsPage() {
  const [connectionMap, setConnectionMap] = useState<Record<string, ConnectionState>>({});
  const [lastSyncMap, setLastSyncMap] = useState<Record<string, string>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [connectModalProvider, setConnectModalProvider] = useState<IntegrationItem | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchIntegrations = async () => {
    try {
      const res = await fetch('/api/integrations');
      if (res.ok) {
        const data = await res.json();
        const connMap: Record<string, ConnectionState> = {};
        const syncMap: Record<string, string> = {};
        if (Array.isArray(data.integrations)) {
          data.integrations.forEach((item: { provider: string; status: string; lastSyncAt?: string }) => {
            if (item.status === 'active') {
              connMap[item.provider] = 'active';
            } else if (item.status === 'expired') {
              connMap[item.provider] = 'expired';
            }
            if (item.lastSyncAt) {
              syncMap[item.provider] = new Date(item.lastSyncAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
            }
          });
        }
        setConnectionMap(connMap);
        setLastSyncMap(syncMap);
      }
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
    }
  };

  useEffect(() => {
    fetchIntegrations();

    const searchParams = new URLSearchParams(window.location.search);
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    const provider = searchParams.get('provider');

    if (connected) {
      setMessage({
        text: `${connected.toUpperCase()} connected successfully.`,
        type: 'success',
      });
    } else if (error) {
      if (error === 'unconfigured_provider') {
        const name = provider ? provider.toUpperCase() : 'Integration';
        setMessage({
          text: `${name} OAuth is not configured on this deployment. Please set ${name}_CLIENT_ID and ${name}_CLIENT_SECRET in environment variables, or use Quick Mock Connect for testing.`,
          type: 'error',
        });
      } else if (error === 'mock_disabled') {
        setMessage({
          text: 'Mock integrations are disabled on this production deployment.',
          type: 'error',
        });
      } else if (error === 'oauth_cancelled') {
        setMessage({
          text: 'OAuth authorization was cancelled or failed.',
          type: 'error',
        });
      } else {
        setMessage({
          text: `Integration error: ${error}`,
          type: 'error',
        });
      }
    }
  }, []);

  const pollWorkflow = async (provider: string, workflowId: string) => {
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      const statusRes = await fetch(
        `/api/integrations/${provider}/sync/status?workflowId=${encodeURIComponent(workflowId)}`
      );
      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();
      if (statusData.status === 'COMPLETED') {
        return { ok: true as const, result: statusData.result };
      }
      if (statusData.status === 'FAILED' || statusData.status === 'TERMINATED' || statusData.status === 'CANCELLED') {
        return { ok: false as const, error: `Sync ${String(statusData.status).toLowerCase()}` };
      }
    }
    return { ok: false as const, error: 'Sync timed out waiting for workflow' };
  };

  const handleDisconnect = async (provider: string) => {
    setLoadingMap((prev) => ({ ...prev, [provider]: true }));
    try {
      const res = await fetch('/api/integrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });

      if (res.ok) {
        setConnectionMap((prev) => {
          const next = { ...prev };
          delete next[provider];
          return next;
        });
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
      const data = await res.json();

      if (!res.ok) {
        setMessage({ text: data.error || 'Sync failed or provider offline.', type: 'error' });
        if (String(data.error || '').toLowerCase().includes('expired')) {
          setConnectionMap((prev) => ({ ...prev, [provider]: 'expired' }));
        }
        return;
      }

      if (data.queued && data.workflowId) {
        setMessage({ text: `${provider.toUpperCase()} sync queued…`, type: 'success' });
        const poll = await pollWorkflow(provider, data.workflowId);
        if (poll.ok) {
          setMessage({ text: `${provider.toUpperCase()} data synced successfully.`, type: 'success' });
          fetchIntegrations();
        } else {
          setMessage({ text: poll.error || 'Sync failed.', type: 'error' });
        }
      } else {
        setMessage({ text: `${provider.toUpperCase()} data synced successfully.`, type: 'success' });
        fetchIntegrations();
      }
    } catch {
      setMessage({ text: 'Error triggering sync.', type: 'error' });
    } finally {
      setLoadingMap((prev) => ({ ...prev, [`sync-${provider}`]: false }));
      setTimeout(() => setMessage(null), 5000);
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
            const state = connectionMap[integration.id] || 'disconnected';
            const isConnected = state === 'active';
            const isExpired = state === 'expired';
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
                    {isExpired && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '4px' }}>
                        Auth expired — reconnect to resume sync
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.integrationStatus}>
                  {isConnected || isExpired ? (
                    <>
                      <span className={`${styles.statusDot} ${isExpired ? styles.statusDisconnected : styles.statusConnected}`} />
                      <span style={{ fontSize: '0.8125rem', color: isExpired ? 'var(--error)' : 'var(--success)' }}>
                        {isExpired ? 'Expired' : 'Connected'}
                      </span>

                      {isConnected && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleSyncNow(integration.id)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? 'Syncing...' : 'Sync Now'}
                        </button>
                      )}

                      {isExpired && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => openConnectModal(integration)}
                        >
                          Reconnect
                        </button>
                      )}

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
