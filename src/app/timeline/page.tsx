'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/common/AppLayout';
import styles from './page.module.css';

interface EvidenceItem {
  id: string;
  evidenceType: string;
  strength: number;
  explanation: string;
  normalizedEvent?: {
    title: string;
    provider: string;
    eventType: string;
  };
}

interface AllocationItem {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  allocationType: string;
  workItemId?: string;
  workItem?: {
    externalId: string;
    title: string;
    project?: string;
  };
  title: string;
  description?: string;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'needs_review';
  status: string;
  isUserModified: boolean;
  evidence?: EvidenceItem[];
}

interface WorkSessionData {
  id: string;
  date: string;
  totalMinutes: number;
  allocatedMinutes: number;
  unallocatedMinutes: number;
  status: string;
  allocations: AllocationItem[];
}

interface WorkItemOption {
  id: string;
  externalId: string;
  title: string;
  project?: string | null;
}

export default function TimelinePage() {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [workSession, setWorkSession] = useState<WorkSessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reconstructing, setReconstructing] = useState<boolean>(false);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [workItems, setWorkItems] = useState<WorkItemOption[]>([]);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('');
  const [editWorkItemId, setEditWorkItemId] = useState('');

  const fetchTimeline = async (targetDate: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/timeline?date=${targetDate}`);
      if (res.ok) {
        const data = await res.json();
        setWorkSession(data.workSession);
        setWorkItems(data.workItems || []);
      }
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline(date);
  }, [date]);

  const handlePrevDay = () => {
    const d = new Date(`${date}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(`${date}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleReconstruct = async () => {
    setReconstructing(true);
    try {
      const res = await fetch('/api/timeline/reconstruct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      if (res.ok) {
        const data = await res.json();
        setWorkSession(data.workSession);
      }
    } catch (err) {
      console.error('Reconstruction failed:', err);
    } finally {
      setReconstructing(false);
    }
  };

  const handleApproveAllHigh = async () => {
    if (!workSession) return;
    try {
      const res = await fetch('/api/allocations/approve-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workSessionId: workSession.id }),
      });
      if (res.ok) {
        fetchTimeline(date);
      }
    } catch (err) {
      console.error('Approve all failed:', err);
    }
  };

  const handleApproveSingle = async (id: string) => {
    try {
      const res = await fetch(`/api/allocations/${id}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchTimeline(date);
      }
    } catch (err) {
      console.error('Approve single failed:', err);
    }
  };

  const handleStartEdit = (alloc: AllocationItem) => {
    setEditingId(alloc.id);
    setEditTitle(alloc.title);
    setEditType(alloc.allocationType);
    setEditWorkItemId(alloc.workItemId || '');
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/allocations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          allocationType: editType,
          workItemId: editWorkItemId || undefined,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchTimeline(date);
      }
    } catch (err) {
      console.error('Save edit failed:', err);
    }
  };

  const handleLeaveUnallocated = async (id: string) => {
    try {
      const res = await fetch(`/api/allocations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTimeline(date);
      }
    } catch (err) {
      console.error('Could not leave allocation unallocated:', err);
    }
  };

  const handleSplit = async (id: string) => {
    try {
      const res = await fetch(`/api/allocations/${id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        fetchTimeline(date);
      }
    } catch (err) {
      console.error('Split failed:', err);
    }
  };

  const handleMerge = async (id1: string, id2: string) => {
    try {
      const res = await fetch('/api/allocations/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocationId1: id1, allocationId2: id2 }),
      });
      if (res.ok) {
        fetchTimeline(date);
      }
    } catch (err) {
      console.error('Merge failed:', err);
    }
  };

  const toggleEvidence = (id: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getConfidenceBadge = (level: string) => {
    if (level === 'high') return <span className="badge badge-high">&#10003; High</span>;
    if (level === 'medium') return <span className="badge badge-medium">&#9888; Medium</span>;
    if (level === 'needs_review') return <span className="badge badge-low">&#9888; Needs Review</span>;
    return <span className="badge badge-unallocated">Unallocated</span>;
  };

  const getDotStyle = (level: string, isUnallocated: boolean) => {
    if (isUnallocated) return styles.timelineDotUnallocated;
    if (level === 'high') return styles.timelineDotHigh;
    if (level === 'medium') return styles.timelineDotMedium;
    return styles.timelineDotNeedsReview;
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className={styles.header}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Workday Timeline
            </h1>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-xs)' }}>
              Reconstructed activity timeline with AI evidence scoring
            </p>
          </div>

          <div className={styles.actionsGroup}>
            <div className={styles.datePicker}>
              <button className="btn btn-ghost btn-sm" onClick={handlePrevDay}>
                &larr;
              </button>
              <input
                type="date"
                className={styles.dateInput}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <button className="btn btn-ghost btn-sm" onClick={handleNextDay}>
                &rarr;
              </button>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleReconstruct}
              disabled={reconstructing}
            >
              {reconstructing ? 'Reconstructing...' : 'Sync & Reconstruct'}
            </button>

            <button className="btn btn-primary btn-sm" onClick={handleApproveAllHigh}>
              Approve All High-Confidence
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div className="skeleton" style={{ height: '80px', width: '100%' }} />
            <div className="skeleton" style={{ height: '80px', width: '100%' }} />
            <div className="skeleton" style={{ height: '80px', width: '100%' }} />
          </div>
        ) : !workSession || workSession.allocations.length === 0 ? (
          <div className={styles.emptyTimeline}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)', opacity: 0.3 }}>
              &#8987;
            </div>
            <h3 style={{ marginBottom: 'var(--space-sm)' }}>No timeline data for this date</h3>
            <p style={{ color: 'var(--text-tertiary)', maxWidth: '400px', margin: '0 auto 1rem auto' }}>
              Sync your Jira, GitHub, or Google Calendar evidence to reconstruct your workday.
            </p>
            <button className="btn btn-primary" onClick={handleReconstruct} disabled={reconstructing}>
              {reconstructing ? 'Reconstructing...' : 'Reconstruct Workday'}
            </button>
          </div>
        ) : (
          <div className={styles.timeline}>
            <div className={styles.timelineLine} />

            {workSession.allocations.map((alloc, idx) => {
              const isUnallocated = alloc.allocationType === 'unallocated';
              const nextAlloc = workSession.allocations[idx + 1];
              const isEditing = editingId === alloc.id;
              const isEvidenceExpanded = !!expandedEvidence[alloc.id];

              return (
                <div key={alloc.id} className={styles.timelineBlock}>
                  <div className={`${styles.timelineDot} ${getDotStyle(alloc.confidenceLevel, isUnallocated)}`} />

                  <div className="card">
                    {isEditing ? (
                      <div className={styles.editForm}>
                        <h4 style={{ marginBottom: 'var(--space-xs)' }}>Edit Allocation</h4>
                        <div className="form-group">
                          <label className="label">Title</label>
                          <input
                            className="input"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                          />
                        </div>
                          <div className={styles.editRow}>
                            <div className="form-group" style={{ flex: 1 }}>
                            <label className="label">Category</label>
                            <select
                              className="input"
                              value={editType}
                              onChange={(e) => setEditType(e.target.value)}
                            >
                              <option value="work_item">Work Item (Jira)</option>
                              <option value="meeting">Meeting</option>
                              <option value="pr_review">PR Review</option>
                              <option value="general_engineering">General Engineering</option>
                              <option value="admin">Admin</option>
                              <option value="unallocated">Unallocated</option>
                            </select>
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                            <label className="label">Work Item</label>
                            <select
                              className="input"
                              value={editWorkItemId}
                              onChange={(e) => setEditWorkItemId(e.target.value)}
                              disabled={editType === 'unallocated'}
                            >
                              <option value="">No linked work item</option>
                              {workItems.map((workItem) => (
                                <option key={workItem.id} value={workItem.id}>
                                  {workItem.externalId} — {workItem.title}
                                </option>
                              ))}
                            </select>
                            </div>
                        </div>
                        <div className={styles.buttonRow}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSaveEdit(alloc.id)}
                          >
                            Save Changes
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.cardContent}>
                        <div className={styles.blockHeader}>
                          <span className={styles.timeRange}>
                            {formatTime(alloc.startTime)} &ndash; {formatTime(alloc.endTime)} ({alloc.durationMinutes}m)
                          </span>
                          <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
                            {getConfidenceBadge(alloc.confidenceLevel)}
                            {alloc.status === 'approved' && (
                              <span className="badge badge-high" style={{ background: 'var(--confidence-high-bg)' }}>
                                Approved
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className={styles.blockTitle}>
                            {alloc.workItem?.externalId && (
                              <span className={styles.workItemBadge}>{alloc.workItem.externalId}</span>
                            )}
                            {alloc.title}
                          </div>
                          {alloc.description && (
                            <p style={{ fontSize: '0.875rem', marginTop: 'var(--space-xs)', color: 'var(--text-secondary)' }}>
                              {alloc.description}
                            </p>
                          )}
                        </div>

                        <div className={styles.buttonRow}>
                          {alloc.status !== 'approved' && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleApproveSingle(alloc.id)}
                            >
                              Approve
                            </button>
                          )}

                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleStartEdit(alloc)}
                          >
                            Edit
                          </button>

                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleSplit(alloc.id)}
                          >
                            Split
                          </button>

                          {!isUnallocated && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleLeaveUnallocated(alloc.id)}
                            >
                              Leave Unallocated
                            </button>
                          )}

                          {nextAlloc && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleMerge(alloc.id, nextAlloc.id)}
                            >
                              Merge Next
                            </button>
                          )}

                          {alloc.evidence && alloc.evidence.length > 0 && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => toggleEvidence(alloc.id)}
                              style={{ marginLeft: 'auto' }}
                            >
                              {isEvidenceExpanded ? 'Hide Evidence' : 'Why did AI allocate this?'}
                            </button>
                          )}
                        </div>

                        {isEvidenceExpanded && alloc.evidence && (
                          <div className={styles.evidenceSection}>
                            <h5 style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-xs)' }}>
                              EVIDENCE SIGNALS ({alloc.evidence.length})
                            </h5>
                            {alloc.evidence.map((ev) => (
                              <div key={ev.id} className={styles.evidenceItem}>
                                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                  [{ev.evidenceType}]
                                </span>
                                <span>{ev.explanation}</span>
                                <span style={{ marginLeft: 'auto', opacity: 0.6 }}>
                                  Strength: {Math.round(ev.strength * 100)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
