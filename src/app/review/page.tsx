'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/common/AppLayout';
import styles from './page.module.css';

interface ReviewSummary {
  date: string;
  totalMinutes: number;
  allocatedMinutes: number;
  unallocatedMinutes: number;
  categories: {
    jira_work: number;
    meetings: number;
    pr_reviews: number;
    general_engineering: number;
    admin: number;
    unallocated: number;
  };
  itemsNeedingReviewCount: number;
  status: string;
  workSessionId?: string;
}

export default function ReviewPage() {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedTimesheetId, setSubmittedTimesheetId] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const fetchSummary = async (targetDate: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/review/summary?date=${targetDate}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch review summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(date);
  }, [date]);

  const handleSubmit = async () => {
    if (!summary?.workSessionId) return;
    setSubmissionError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workSessionId: summary.workSessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubmittedTimesheetId(data.timesheet.id);
        fetchSummary(date);
      } else {
        const data = await res.json();
        setSubmissionError(data.error || 'Could not submit timesheet.');
      }
    } catch (err) {
      console.error('Submission failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadCSV = () => {
    if (submittedTimesheetId) {
      window.open(`/api/timesheets/${submittedTimesheetId}/export`, '_blank');
    }
  };

  const formatHours = (mins: number) => {
    const h = (mins / 60).toFixed(1);
    return `${h} hrs (${mins}m)`;
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className={styles.header}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              End-of-Day Review & Submission
            </h1>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-xs)' }}>
              Review total reconstructed time and finalize your daily timesheet
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
            <input
              type="date"
              className="input"
              style={{ width: 'auto', fontFamily: 'var(--font-mono)' }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: '200px', width: '100%' }} />
        ) : !summary ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <h3>No data to review</h3>
          </div>
        ) : (
          <>
            <div className={styles.summaryGrid}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Total Workday Time</span>
                <span className={styles.statValue}>{formatHours(summary.totalMinutes)}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Allocated Time</span>
                <span className={styles.statValue} style={{ color: 'var(--confidence-high)' }}>
                  {formatHours(summary.allocatedMinutes)}
                </span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Unallocated Time</span>
                <span className={styles.statValue} style={{ color: 'var(--confidence-low)' }}>
                  {formatHours(summary.unallocatedMinutes)}
                </span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Items Needing Review</span>
                <span className={styles.statValue}>{summary.itemsNeedingReviewCount}</span>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">Activity Category Breakdown</h3>
              <div className={styles.categoryList}>
                <div className={styles.categoryRow}>
                  <span>Jira Issue Work</span>
                  <span className="text-mono">{summary.categories.jira_work}m</span>
                </div>
                <div className={styles.categoryRow}>
                  <span>Meetings & Calendar</span>
                  <span className="text-mono">{summary.categories.meetings}m</span>
                </div>
                <div className={styles.categoryRow}>
                  <span>Pull Request Reviews</span>
                  <span className="text-mono">{summary.categories.pr_reviews}m</span>
                </div>
                <div className={styles.categoryRow}>
                  <span>General Engineering</span>
                  <span className="text-mono">{summary.categories.general_engineering}m</span>
                </div>
                <div className={styles.categoryRow}>
                  <span>Admin / Overhead</span>
                  <span className="text-mono">{summary.categories.admin}m</span>
                </div>
                <div className={styles.categoryRow} style={{ borderBottom: 'none' }}>
                  <span>Unallocated Time</span>
                  <span className="text-mono" style={{ color: 'var(--confidence-low)' }}>
                    {summary.categories.unallocated}m
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.actionRow}>
              {submissionError && (
                <p role="alert" style={{ color: 'var(--error)', width: '100%', margin: 0 }}>
                  {submissionError}
                </p>
              )}
              <button
                className="btn btn-primary btn-lg"
                onClick={handleSubmit}
                disabled={submitting || summary.status === 'approved' || summary.itemsNeedingReviewCount > 0}
              >
                {summary.status === 'approved'
                  ? 'Timesheet Finalized & Approved'
                  : submitting
                  ? 'Submitting...'
                  : summary.itemsNeedingReviewCount > 0
                  ? `Review ${summary.itemsNeedingReviewCount} allocation${summary.itemsNeedingReviewCount === 1 ? '' : 's'} first`
                  : 'Approve & Submit Timesheet'}
              </button>

              {(summary.status === 'approved' || submittedTimesheetId) && (
                <button className="btn btn-secondary btn-lg" onClick={handleDownloadCSV}>
                  Download CSV Timesheet
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
