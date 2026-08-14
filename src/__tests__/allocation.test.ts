import { describe, it, expect } from 'vitest';
import { calculateConfidence, SIGNAL_WEIGHTS } from '@/lib/confidence';
import { scoreCandidatesForSegment } from '@/lib/allocation/candidate';
import { reasonAmbiguousSegment } from '@/lib/ai';
import { TimeSegment } from '@/lib/timeline';
import { WorkItem, NormalizedEvent } from '@prisma/client';

describe('Allocation Engine & Confidence Calculator', () => {
  it('should calculate confidence scores and levels correctly', () => {
    const signals = [
      {
        type: 'direct_jira_reference' as const,
        weight: 0.30,
        strength: 1.0,
        explanation: 'Direct reference',
      },
      {
        type: 'branch_match' as const,
        weight: 0.20,
        strength: 1.0,
        explanation: 'Branch match',
      },
      {
        type: 'calendar_match' as const,
        weight: 0.25,
        strength: 1.0,
        explanation: 'Calendar match',
      },
      {
        type: 'repository_match' as const,
        weight: 0.15,
        strength: 1.0,
        explanation: 'Repo match',
      },
    ];

    const result = calculateConfidence(signals);
    expect(result.score).toBe(0.9);
    expect(result.level).toBe('high');
  });

  it('should apply competing candidate penalty when gap < 0.15', () => {
    const signals = [
      {
        type: 'direct_jira_reference' as const,
        weight: 0.30,
        strength: 1.0,
        explanation: 'Ref',
      },
      {
        type: 'branch_match' as const,
        weight: 0.20,
        strength: 1.0,
        explanation: 'Branch',
      },
    ];

    // Raw score = 0.50
    const withoutCompeting = calculateConfidence(signals);
    expect(withoutCompeting.score).toBe(0.5);

    // Competing candidate score = 0.40 (gap = 0.10 < 0.15)
    const withCompeting = calculateConfidence(signals, 0.40);
    expect(withCompeting.score).toBe(0.35); // 0.50 * 0.7
    expect(withCompeting.level).toBe('needs_review');
  });

  it('should score candidates for segment with direct Jira key matching', () => {
    const workItem: WorkItem = {
      id: 'wi-1',
      userId: 'u-1',
      provider: 'jira',
      externalId: 'AUTH-231',
      externalUrl: null,
      title: 'Implement Auth Endpoint',
      description: null,
      status: 'in_progress',
      project: 'AUTH',
      itemType: 'task',
      metadata: null,
      lastSyncAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const commitEvent: NormalizedEvent = {
      id: 'e-1',
      userId: 'u-1',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-10T10:00:00Z'),
      endedAt: null,
      duration: null,
      title: 'feat: add login handler for AUTH-231',
      description: null,
      workItemId: null,
      metadata: { branch: 'feature/AUTH-231-login' },
      externalUrl: null,
      providerEventId: null,
      createdAt: new Date(),
    };

    const segment: TimeSegment = {
      startTime: new Date('2026-08-10T09:55:00Z'),
      endTime: new Date('2026-08-10T10:10:00Z'),
      durationMinutes: 15,
      events: [commitEvent],
      isCalendarAnchored: false,
      isGap: false,
    };

    const candidates = scoreCandidatesForSegment(segment, [workItem], []);
    expect(candidates.length).toBeGreaterThan(0);
    const top = candidates[0];
    expect(top.workItemKey).toBe('AUTH-231');
    expect(top.confidenceScore).toBeGreaterThanOrEqual(0.5);
    expect(top.signals.some((s) => s.type === 'direct_jira_reference')).toBe(true);
    expect(top.signals.some((s) => s.type === 'branch_match')).toBe(true);
  });

  it('should handle AI reasoning fallback when API key is not present', async () => {
    const segment: TimeSegment = {
      startTime: new Date('2026-08-10T11:00:00Z'),
      endTime: new Date('2026-08-10T12:00:00Z'),
      durationMinutes: 60,
      events: [],
      isCalendarAnchored: false,
      isGap: true,
    };

    const result = await reasonAmbiguousSegment(segment, [], 'Gap in work');
    expect(result.allocationType).toBe('unallocated');
    expect(result.confidenceLevel).toBe('needs_review');
  });

  it('should allocate bridged gaps when the same work item surrounds them', () => {
    const workItem: WorkItem = {
      id: 'wi-1',
      userId: 'u-1',
      provider: 'jira',
      externalId: 'BUG-442',
      externalUrl: null,
      title: 'Worker leak',
      description: null,
      status: 'in_progress',
      project: 'BUG',
      itemType: 'bug',
      metadata: null,
      lastSyncAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const gap: TimeSegment = {
      startTime: new Date('2026-08-10T10:00:00Z'),
      endTime: new Date('2026-08-10T11:00:00Z'),
      durationMinutes: 60,
      events: [],
      isCalendarAnchored: false,
      isGap: true,
    };

    const candidates = scoreCandidatesForSegment(gap, [workItem], [], 'wi-1', 'wi-1');
    expect(candidates[0].workItemKey).toBe('BUG-442');
    expect(candidates[0].allocationType).toBe('work_item');
    expect(candidates[0].confidenceLevel).toBe('medium');
    expect(candidates[0].signals.some((s) => s.type === 'continuity')).toBe(true);
  });
});
