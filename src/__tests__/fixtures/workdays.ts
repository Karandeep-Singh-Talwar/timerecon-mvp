import { RawEvent } from '@/lib/connectors/types';

export interface SyntheticWorkItemFixture {
  id: string;
  userId: string;
  provider: 'jira' | 'github';
  externalId: string;
  title: string;
  status?: string;
  project?: string;
  itemType?: string;
  description?: string;
  externalUrl?: string;
  metadata?: any;
}

export interface SyntheticEventFixture {
  id: string;
  userId: string;
  provider: 'jira' | 'github' | 'google_calendar';
  eventType: string;
  occurredAt: Date;
  endedAt?: Date | null;
  duration?: number | null;
  title: string;
  description?: string | null;
  workItemId?: string | null;
  metadata?: any;
  externalUrl?: string | null;
}

export interface SyntheticWorkday {
  id: string;
  name: string;
  patternNumber: number;
  date: string; // YYYY-MM-DD
  userId: string;
  userTimezone?: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  workItems: SyntheticWorkItemFixture[];
  rawEvents?: RawEvent[];
  normalizedEvents: SyntheticEventFixture[];
  expected: {
    minAllocations?: number;
    hasHighConfidence?: boolean;
    hasNeedsReview?: boolean;
    hasUnallocatedGap?: boolean;
    targetWorkItemKeys?: string[];
  };
}

// 1. Simple Jira + Git Day
export const pattern1_simpleJiraGit: SyntheticWorkday = {
  id: 'workday-1-simple',
  name: 'Simple Jira + Git Day',
  patternNumber: 1,
  date: '2026-08-10',
  userId: 'user-synth-1',
  workItems: [
    {
      id: 'wi-auth-231',
      userId: 'user-synth-1',
      provider: 'jira',
      externalId: 'AUTH-231',
      title: 'Implement Auth Endpoint',
      status: 'in_progress',
      project: 'AUTH',
      itemType: 'task',
    },
    {
      id: 'wi-bug-442',
      userId: 'user-synth-1',
      provider: 'jira',
      externalId: 'BUG-442',
      title: 'Worker process heap memory leak',
      status: 'in_progress',
      project: 'BUG',
      itemType: 'bug',
    },
    {
      id: 'wi-proj-101',
      userId: 'user-synth-1',
      provider: 'jira',
      externalId: 'PROJ-101',
      title: 'Redesign analytics dashboard UI',
      status: 'in_progress',
      project: 'PROJ',
      itemType: 'story',
    },
  ],
  normalizedEvents: [
    {
      id: 'ev-p1-1',
      userId: 'user-synth-1',
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: new Date('2026-08-10T09:00:00.000Z'),
      endedAt: new Date('2026-08-10T09:30:00.000Z'),
      duration: 30,
      title: 'Daily Engineering Standup',
    },
    {
      id: 'ev-p1-2',
      userId: 'user-synth-1',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-10T09:45:00.000Z'),
      title: 'feat(auth): add login auth handler AUTH-231',
      metadata: { repo: 'auth-service', branch: 'feature/AUTH-231-login' },
      workItemId: 'wi-auth-231',
    },
    {
      id: 'ev-p1-3',
      userId: 'user-synth-1',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-10T10:15:00.000Z'),
      title: 'test(auth): unit tests for token validation AUTH-231',
      metadata: { repo: 'auth-service', branch: 'feature/AUTH-231-login' },
      workItemId: 'wi-auth-231',
    },
    {
      id: 'ev-p1-4',
      userId: 'user-synth-1',
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: new Date('2026-08-10T11:30:00.000Z'),
      title: 'BUG-442: Investigating worker process heap allocation',
      workItemId: 'wi-bug-442',
    },
    {
      id: 'ev-p1-5',
      userId: 'user-synth-1',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-10T14:00:00.000Z'),
      title: 'fix(worker): memory leak fix for socket listener BUG-442',
      metadata: { repo: 'backend-worker', branch: 'fix/BUG-442-leak' },
      workItemId: 'wi-bug-442',
    },
    {
      id: 'ev-p1-6',
      userId: 'user-synth-1',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-10T16:00:00.000Z'),
      title: 'feat(dashboard): add chart widget components PROJ-101',
      metadata: { repo: 'frontend-app', branch: 'feature/PROJ-101-dashboard' },
      workItemId: 'wi-proj-101',
    },
  ],
  expected: {
    minAllocations: 4,
    hasHighConfidence: true,
    targetWorkItemKeys: ['AUTH-231', 'BUG-442', 'PROJ-101'],
  },
};

// 2. Multi-ticket Day
export const pattern2_multiTicket: SyntheticWorkday = {
  id: 'workday-2-multiticket',
  name: 'Multi-ticket Day (6+ tickets, frequent context switching)',
  patternNumber: 2,
  date: '2026-08-11',
  userId: 'user-synth-2',
  workItems: [
    { id: 'wi-fe-101', userId: 'user-synth-2', provider: 'jira', externalId: 'FE-101', title: 'Header Navbar Component', project: 'FE' },
    { id: 'wi-fe-102', userId: 'user-synth-2', provider: 'jira', externalId: 'FE-102', title: 'Footer Links', project: 'FE' },
    { id: 'wi-fe-103', userId: 'user-synth-2', provider: 'jira', externalId: 'FE-103', title: 'User Profile Card', project: 'FE' },
    { id: 'wi-be-201', userId: 'user-synth-2', provider: 'jira', externalId: 'BE-201', title: 'User Profile Endpoint', project: 'BE' },
    { id: 'wi-be-202', userId: 'user-synth-2', provider: 'jira', externalId: 'BE-202', title: 'DB Index Optimization', project: 'BE' },
    { id: 'wi-be-203', userId: 'user-synth-2', provider: 'jira', externalId: 'BE-203', title: 'Session Cache Redis', project: 'BE' },
  ],
  normalizedEvents: [
    { id: 'ev-p2-1', userId: 'user-synth-2', provider: 'github', eventType: 'commit', occurredAt: new Date('2026-08-11T09:15:00.000Z'), title: 'feat: header navbar FE-101', metadata: { repo: 'frontend-app', branch: 'FE-101' }, workItemId: 'wi-fe-101' },
    { id: 'ev-p2-2', userId: 'user-synth-2', provider: 'github', eventType: 'commit', occurredAt: new Date('2026-08-11T10:00:00.000Z'), title: 'feat: user profile route BE-201', metadata: { repo: 'backend-api', branch: 'BE-201' }, workItemId: 'wi-be-201' },
    { id: 'ev-p2-3', userId: 'user-synth-2', provider: 'github', eventType: 'commit', occurredAt: new Date('2026-08-11T11:15:00.000Z'), title: 'fix: footer alignment FE-102', metadata: { repo: 'frontend-app', branch: 'FE-102' }, workItemId: 'wi-fe-102' },
    { id: 'ev-p2-4', userId: 'user-synth-2', provider: 'github', eventType: 'commit', occurredAt: new Date('2026-08-11T13:30:00.000Z'), title: 'perf: add index on user_id BE-202', metadata: { repo: 'backend-api', branch: 'BE-202' }, workItemId: 'wi-be-202' },
    { id: 'ev-p2-5', userId: 'user-synth-2', provider: 'github', eventType: 'commit', occurredAt: new Date('2026-08-11T15:00:00.000Z'), title: 'feat: profile card avatar FE-103', metadata: { repo: 'frontend-app', branch: 'FE-103' }, workItemId: 'wi-fe-103' },
    { id: 'ev-p2-6', userId: 'user-synth-2', provider: 'github', eventType: 'commit', occurredAt: new Date('2026-08-11T16:30:00.000Z'), title: 'feat: redis cache ttl BE-203', metadata: { repo: 'backend-api', branch: 'BE-203' }, workItemId: 'wi-be-203' },
  ],
  expected: {
    minAllocations: 6,
    targetWorkItemKeys: ['FE-101', 'BE-201', 'FE-102', 'BE-202', 'FE-103', 'BE-203'],
  },
};

// 3. Long Debugging Session (0 commits, 0 PRs)
export const pattern3_longDebugging: SyntheticWorkday = {
  id: 'workday-3-debugging',
  name: 'Long Debugging Session (3-hour debugging on BUG-442, 0 commits, 0 PRs)',
  patternNumber: 3,
  date: '2026-08-12',
  userId: 'user-synth-3',
  workItems: [
    {
      id: 'wi-bug-442-d',
      userId: 'user-synth-3',
      provider: 'jira',
      externalId: 'BUG-442',
      title: 'Worker process heap memory leak',
      status: 'in_progress',
      project: 'BUG',
      itemType: 'bug',
    },
  ],
  normalizedEvents: [
    {
      id: 'ev-p3-1',
      userId: 'user-synth-3',
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: new Date('2026-08-12T09:30:00.000Z'),
      title: 'BUG-442: Status changed to In Progress',
      workItemId: 'wi-bug-442-d',
    },
    {
      id: 'ev-p3-2',
      userId: 'user-synth-3',
      provider: 'github',
      eventType: 'branch_activity',
      occurredAt: new Date('2026-08-12T09:35:00.000Z'),
      title: 'Active branch fix/BUG-442-heap-leak',
      metadata: { repo: 'backend-worker', branch: 'fix/BUG-442-heap-leak' },
      workItemId: 'wi-bug-442-d',
    },
    {
      id: 'ev-p3-3',
      userId: 'user-synth-3',
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: new Date('2026-08-12T10:15:00.000Z'),
      title: 'BUG-442: Analyzing heap dump for socket retainer leak',
      workItemId: 'wi-bug-442-d',
    },
    {
      id: 'ev-p3-4',
      userId: 'user-synth-3',
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: new Date('2026-08-12T11:30:00.000Z'),
      title: 'BUG-442: Tracing event listener heap retention',
      workItemId: 'wi-bug-442-d',
    },
    {
      id: 'ev-p3-5',
      userId: 'user-synth-3',
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: new Date('2026-08-12T12:45:00.000Z'),
      title: 'BUG-442: Identified memory leak root cause in socket pool cleanup',
      workItemId: 'wi-bug-442-d',
    },
  ],
  expected: {
    targetWorkItemKeys: ['BUG-442'],
  },
};

// 4. Meeting-heavy Day
export const pattern4_meetingHeavy: SyntheticWorkday = {
  id: 'workday-4-meetingheavy',
  name: 'Meeting-heavy Day (4+ meetings, minimal coding)',
  patternNumber: 4,
  date: '2026-08-13',
  userId: 'user-synth-4',
  workItems: [
    { id: 'wi-auth-231-m', userId: 'user-synth-4', provider: 'jira', externalId: 'AUTH-231', title: 'Implement Auth Endpoint', project: 'AUTH' },
  ],
  normalizedEvents: [
    {
      id: 'ev-p4-1',
      userId: 'user-synth-4',
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: new Date('2026-08-13T09:00:00.000Z'),
      endedAt: new Date('2026-08-13T09:30:00.000Z'),
      duration: 30,
      title: 'Daily Standup',
    },
    {
      id: 'ev-p4-2',
      userId: 'user-synth-4',
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: new Date('2026-08-13T10:00:00.000Z'),
      endedAt: new Date('2026-08-13T11:30:00.000Z'),
      duration: 90,
      title: 'Sprint Planning & Backlog Refinement',
    },
    {
      id: 'ev-p4-3',
      userId: 'user-synth-4',
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: new Date('2026-08-13T13:00:00.000Z'),
      endedAt: new Date('2026-08-13T13:30:00.000Z'),
      duration: 30,
      title: '1-on-1 with Engineering Manager',
    },
    {
      id: 'ev-p4-4',
      userId: 'user-synth-4',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-13T14:15:00.000Z'),
      title: 'docs: update auth endpoint spec AUTH-231',
      workItemId: 'wi-auth-231-m',
    },
    {
      id: 'ev-p4-5',
      userId: 'user-synth-4',
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: new Date('2026-08-13T15:00:00.000Z'),
      endedAt: new Date('2026-08-13T16:30:00.000Z'),
      duration: 90,
      title: 'Architecture & Tech Sync',
    },
  ],
  expected: {
    minAllocations: 5,
    hasHighConfidence: true,
  },
};

// 5. PR Review Day
export const pattern5_prReview: SyntheticWorkday = {
  id: 'workday-5-prreview',
  name: 'PR Review Day (4 PR reviews across 2 repos, 1 PR opened)',
  patternNumber: 5,
  date: '2026-08-14',
  userId: 'user-synth-5',
  workItems: [
    { id: 'wi-pr-105', userId: 'user-synth-5', provider: 'github', externalId: 'PR-105', title: 'Rate limiting implementation', project: 'api-gateway' },
  ],
  normalizedEvents: [
    {
      id: 'ev-p5-1',
      userId: 'user-synth-5',
      provider: 'github',
      eventType: 'pr_review',
      occurredAt: new Date('2026-08-14T09:30:00.000Z'),
      title: 'Review submitted on PR #101: Auth Refactor',
      metadata: { repo: 'auth-service', prNumber: 101 },
    },
    {
      id: 'ev-p5-2',
      userId: 'user-synth-5',
      provider: 'github',
      eventType: 'pr_review',
      occurredAt: new Date('2026-08-14T11:00:00.000Z'),
      title: 'Review submitted on PR #102: DB Migration for Sessions',
      metadata: { repo: 'auth-service', prNumber: 102 },
    },
    {
      id: 'ev-p5-3',
      userId: 'user-synth-5',
      provider: 'github',
      eventType: 'pr_review',
      occurredAt: new Date('2026-08-14T14:00:00.000Z'),
      title: 'Review submitted on PR #103: API Gateway routing',
      metadata: { repo: 'api-gateway', prNumber: 103 },
    },
    {
      id: 'ev-p5-4',
      userId: 'user-synth-5',
      provider: 'github',
      eventType: 'pr_review',
      occurredAt: new Date('2026-08-14T15:30:00.000Z'),
      title: 'Review submitted on PR #104: Redis cache layer',
      metadata: { repo: 'api-gateway', prNumber: 104 },
    },
    {
      id: 'ev-p5-5',
      userId: 'user-synth-5',
      provider: 'github',
      eventType: 'pr_opened',
      occurredAt: new Date('2026-08-14T16:30:00.000Z'),
      title: 'PR #105 opened: Rate limiting implementation PR-105',
      metadata: { repo: 'api-gateway', prNumber: 105 },
      workItemId: 'wi-pr-105',
    },
  ],
  expected: {
    minAllocations: 5,
  },
};

// 6. Research & Exploration Day
export const pattern6_research: SyntheticWorkday = {
  id: 'workday-6-research',
  name: 'Research & Exploration Day (Few formal artifacts, documentation activity)',
  patternNumber: 6,
  date: '2026-08-15',
  userId: 'user-synth-6',
  workItems: [
    { id: 'wi-proj-101-r', userId: 'user-synth-6', provider: 'jira', externalId: 'PROJ-101', title: 'Architecture Research for Analytics', project: 'PROJ' },
  ],
  normalizedEvents: [
    {
      id: 'ev-p6-1',
      userId: 'user-synth-6',
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: new Date('2026-08-15T09:30:00.000Z'),
      title: 'PROJ-101: Benchmarking GraphQL vs REST performance specs',
      workItemId: 'wi-proj-101-r',
    },
    {
      id: 'ev-p6-2',
      userId: 'user-synth-6',
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: new Date('2026-08-15T11:30:00.000Z'),
      title: 'PROJ-101: Drafting architecture RFC for query optimization',
      workItemId: 'wi-proj-101-r',
    },
    {
      id: 'ev-p6-3',
      userId: 'user-synth-6',
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: new Date('2026-08-15T14:30:00.000Z'),
      title: 'PROJ-101: Attached architectural RFC draft to issue',
      workItemId: 'wi-proj-101-r',
    },
  ],
  expected: {
    targetWorkItemKeys: ['PROJ-101'],
  },
};

// 7. Mixed Day
export const pattern7_mixed: SyntheticWorkday = {
  id: 'workday-7-mixed',
  name: 'Mixed Day (Jira work + meetings + PR reviews + unallocated gap)',
  patternNumber: 7,
  date: '2026-08-17',
  userId: 'user-synth-7',
  workItems: [
    { id: 'wi-auth-231-mix', userId: 'user-synth-7', provider: 'jira', externalId: 'AUTH-231', title: 'Implement Auth Endpoint', project: 'AUTH' },
  ],
  normalizedEvents: [
    {
      id: 'ev-p7-1',
      userId: 'user-synth-7',
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: new Date('2026-08-17T09:00:00.000Z'),
      endedAt: new Date('2026-08-17T09:30:00.000Z'),
      duration: 30,
      title: 'Team Standup',
    },
    {
      id: 'ev-p7-2',
      userId: 'user-synth-7',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-17T09:45:00.000Z'),
      title: 'feat: add session handler AUTH-231',
      workItemId: 'wi-auth-231-mix',
    },
    // 10:30 - 13:30 gap
    {
      id: 'ev-p7-3',
      userId: 'user-synth-7',
      provider: 'github',
      eventType: 'pr_review',
      occurredAt: new Date('2026-08-17T14:00:00.000Z'),
      title: 'Review submitted on PR #202: Payment gateway integration',
      metadata: { repo: 'payment-service', prNumber: 202 },
    },
    {
      id: 'ev-p7-4',
      userId: 'user-synth-7',
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: new Date('2026-08-17T15:30:00.000Z'),
      title: 'AUTH-231: Updated task status to Done',
      workItemId: 'wi-auth-231-mix',
    },
  ],
  expected: {
    hasUnallocatedGap: true,
  },
};

// 8. Ambiguous Work
export const pattern8_ambiguous: SyntheticWorkday = {
  id: 'workday-8-ambiguous',
  name: 'Ambiguous Work (Commits touching files common to 2 active Jira tickets)',
  patternNumber: 8,
  date: '2026-08-18',
  userId: 'user-synth-8',
  workItems: [
    { id: 'wi-auth-231-a', userId: 'user-synth-8', provider: 'jira', externalId: 'AUTH-231', title: 'OAuth Token Service', project: 'AUTH' },
    { id: 'wi-auth-232-a', userId: 'user-synth-8', provider: 'jira', externalId: 'AUTH-232', title: 'JWT Session Validation', project: 'AUTH' },
  ],
  normalizedEvents: [
    {
      id: 'ev-p8-1',
      userId: 'user-synth-8',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-18T10:00:00.000Z'),
      title: 'refactor auth session handler logic in auth-service repo',
      metadata: { repo: 'auth-service' },
    },
    {
      id: 'ev-p8-2',
      userId: 'user-synth-8',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-18T10:10:00.000Z'),
      title: 'update auth core middleware session validator',
      metadata: { repo: 'auth-service' },
    },
  ],
  expected: {
    hasNeedsReview: true,
  },
};

// 9. No Evidence Gap (2+ hours zero events)
export const pattern9_noEvidenceGap: SyntheticWorkday = {
  id: 'workday-9-gap',
  name: 'No Evidence Gap (2+ hours zero digital events during working hours)',
  patternNumber: 9,
  date: '2026-08-19',
  userId: 'user-synth-9',
  workItems: [
    { id: 'wi-auth-231-g', userId: 'user-synth-9', provider: 'jira', externalId: 'AUTH-231', title: 'Implement Auth Endpoint', project: 'AUTH' },
    { id: 'wi-bug-442-g', userId: 'user-synth-9', provider: 'jira', externalId: 'BUG-442', title: 'Worker process heap leak', project: 'BUG' },
  ],
  normalizedEvents: [
    {
      id: 'ev-p9-1',
      userId: 'user-synth-9',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-19T09:30:00.000Z'),
      title: 'feat: auth middleware handler AUTH-231',
      workItemId: 'wi-auth-231-g',
    },
    // Gap from 10:30 to 14:00 (3.5 hours)
    {
      id: 'ev-p9-2',
      userId: 'user-synth-9',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-19T14:30:00.000Z'),
      title: 'fix: worker process socket leak fix BUG-442',
      workItemId: 'wi-bug-442-g',
    },
  ],
  expected: {
    hasUnallocatedGap: true,
    hasNeedsReview: true,
  },
};

// 10. Weekend / Irregular Hours Work
export const pattern10_weekendWork: SyntheticWorkday = {
  id: 'workday-10-weekend',
  name: 'Weekend / Irregular Hours Work (Saturday 14:00-17:00 activity)',
  patternNumber: 10,
  date: '2026-08-22', // Saturday
  userId: 'user-synth-10',
  workItems: [
    { id: 'wi-bug-442-wk', userId: 'user-synth-10', provider: 'jira', externalId: 'BUG-442', title: 'Worker process memory leak', project: 'BUG' },
  ],
  normalizedEvents: [
    {
      id: 'ev-p10-1',
      userId: 'user-synth-10',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-22T14:00:00.000Z'),
      title: 'fix(hotfix): urgent production memory leak fix BUG-442',
      workItemId: 'wi-bug-442-wk',
    },
    {
      id: 'ev-p10-2',
      userId: 'user-synth-10',
      provider: 'github',
      eventType: 'pr_opened',
      occurredAt: new Date('2026-08-22T15:30:00.000Z'),
      title: 'Hotfix PR #300 for BUG-442 production issue',
      workItemId: 'wi-bug-442-wk',
    },
    {
      id: 'ev-p10-3',
      userId: 'user-synth-10',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-22T16:45:00.000Z'),
      title: 'test: verify memory allocation under load BUG-442',
      workItemId: 'wi-bug-442-wk',
    },
  ],
  expected: {
    targetWorkItemKeys: ['BUG-442'],
  },
};

// 11. Timezone Edge Case (IST UTC+5:30)
export const pattern11_timezoneEdge: SyntheticWorkday = {
  id: 'workday-11-timezone',
  name: 'Timezone Edge Case (Developer in IST UTC+5:30 spanning midnight UTC)',
  patternNumber: 11,
  date: '2026-08-20',
  userId: 'user-synth-11',
  userTimezone: 'Asia/Kolkata',
  workItems: [
    { id: 'wi-auth-231-tz', userId: 'user-synth-11', provider: 'jira', externalId: 'AUTH-231', title: 'Implement Auth Endpoint', project: 'AUTH' },
  ],
  normalizedEvents: [
    {
      id: 'ev-p11-1',
      userId: 'user-synth-11',
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: new Date('2026-08-20T03:30:00.000Z'), // 09:00 IST
      endedAt: new Date('2026-08-20T04:00:00.000Z'),
      duration: 30,
      title: 'Morning Engineering Standup IST',
    },
    {
      id: 'ev-p11-2',
      userId: 'user-synth-11',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-20T06:00:00.000Z'), // 11:30 IST
      title: 'feat: add core auth logic AUTH-231',
      workItemId: 'wi-auth-231-tz',
    },
    {
      id: 'ev-p11-3',
      userId: 'user-synth-11',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-20T18:00:00.000Z'), // 23:30 IST late night deploy
      title: 'fix: late night patch deployment AUTH-231',
      workItemId: 'wi-auth-231-tz',
    },
  ],
  expected: {
    targetWorkItemKeys: ['AUTH-231'],
  },
};

// 12. Missing API Data
export const pattern12_missingApiData: SyntheticWorkday = {
  id: 'workday-12-missingapi',
  name: 'Missing API Data (Jira succeeds, GitHub connector times out / returns empty)',
  patternNumber: 12,
  date: '2026-08-21',
  userId: 'user-synth-12',
  workItems: [
    { id: 'wi-auth-231-m', userId: 'user-synth-12', provider: 'jira', externalId: 'AUTH-231', title: 'Implement Auth Endpoint', project: 'AUTH' },
  ],
  rawEvents: [
    {
      externalId: 'raw-jira-1',
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: new Date('2026-08-21T09:30:00.000Z'),
      title: 'AUTH-231: status in_progress',
      workItemExternalId: 'AUTH-231',
    },
    {
      externalId: 'raw-jira-2',
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: new Date('2026-08-21T11:00:00.000Z'),
      title: 'AUTH-231: Updated OAuth callback parameters',
      workItemExternalId: 'AUTH-231',
    },
    {
      externalId: 'raw-jira-3',
      provider: 'jira',
      eventType: 'worklog',
      occurredAt: new Date('2026-08-21T14:30:00.000Z'),
      title: 'AUTH-231: 3 hours logged on auth implementation',
      workItemExternalId: 'AUTH-231',
    },
  ],
  normalizedEvents: [
    {
      id: 'ev-p12-1',
      userId: 'user-synth-12',
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: new Date('2026-08-21T09:30:00.000Z'),
      title: 'AUTH-231: status in_progress',
      workItemId: 'wi-auth-231-m',
    },
    {
      id: 'ev-p12-2',
      userId: 'user-synth-12',
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: new Date('2026-08-21T11:00:00.000Z'),
      title: 'AUTH-231: Updated OAuth callback parameters',
      workItemId: 'wi-auth-231-m',
    },
    {
      id: 'ev-p12-3',
      userId: 'user-synth-12',
      provider: 'jira',
      eventType: 'worklog',
      occurredAt: new Date('2026-08-21T14:30:00.000Z'),
      title: 'AUTH-231: 3 hours logged on auth implementation',
      workItemId: 'wi-auth-231-m',
    },
  ],
  expected: {
    targetWorkItemKeys: ['AUTH-231'],
  },
};

// 13. Duplicate Events
export const pattern13_duplicateEvents: SyntheticWorkday = {
  id: 'workday-13-duplicate',
  name: 'Duplicate Events (Same commit/event ingested multiple times via re-syncs)',
  patternNumber: 13,
  date: '2026-08-24',
  userId: 'user-synth-13',
  workItems: [
    { id: 'wi-auth-231-dup', userId: 'user-synth-13', provider: 'jira', externalId: 'AUTH-231', title: 'Implement Auth Endpoint', project: 'AUTH' },
  ],
  rawEvents: [
    {
      externalId: 'raw-dup-1',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-24T10:00:00.000Z'),
      title: 'feat: add login auth handler AUTH-231',
      workItemExternalId: 'AUTH-231',
      metadata: { sha: 'sha-998877' },
    },
    {
      externalId: 'raw-dup-2',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-24T10:00:00.000Z'),
      title: 'feat: add login auth handler AUTH-231',
      workItemExternalId: 'AUTH-231',
      metadata: { sha: 'sha-998877' },
    },
    {
      externalId: 'raw-dup-3',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-24T10:00:00.000Z'),
      title: 'feat: add login auth handler AUTH-231',
      workItemExternalId: 'AUTH-231',
      metadata: { sha: 'sha-998877' },
    },
  ],
  normalizedEvents: [
    {
      id: 'ev-p13-1',
      userId: 'user-synth-13',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-24T10:00:00.000Z'),
      title: 'feat: add login auth handler AUTH-231',
      workItemId: 'wi-auth-231-dup',
      metadata: { sha: 'sha-998877' },
    },
  ],
  expected: {
    targetWorkItemKeys: ['AUTH-231'],
  },
};

// 14. Incorrect Jira Metadata
export const pattern14_incorrectJiraMetadata: SyntheticWorkday = {
  id: 'workday-14-incorrectmeta',
  name: 'Incorrect Jira Metadata (Issue key in commit belongs to closed/different project)',
  patternNumber: 14,
  date: '2026-08-25',
  userId: 'user-synth-14',
  workItems: [
    { id: 'wi-auth-231-inc', userId: 'user-synth-14', provider: 'jira', externalId: 'AUTH-231', title: 'Implement Auth Endpoint', project: 'AUTH' },
  ],
  normalizedEvents: [
    {
      id: 'ev-p14-1',
      userId: 'user-synth-14',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-25T10:00:00.000Z'),
      title: 'fix: update legacy configuration CLOSED-999',
      metadata: { repo: 'auth-service' },
    },
    {
      id: 'ev-p14-2',
      userId: 'user-synth-14',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-25T11:00:00.000Z'),
      title: 'refactor old module CLOSED-999',
      metadata: { repo: 'auth-service' },
    },
  ],
  expected: {
    hasNeedsReview: true,
  },
};

// 15. Work Spanning Multiple Tickets
export const pattern15_multiTicketSpan: SyntheticWorkday = {
  id: 'workday-15-multispan',
  name: 'Work Spanning Multiple Tickets (Refactoring touching AUTH-231 and BUG-442)',
  patternNumber: 15,
  date: '2026-08-26',
  userId: 'user-synth-15',
  workItems: [
    { id: 'wi-auth-231-s', userId: 'user-synth-15', provider: 'jira', externalId: 'AUTH-231', title: 'Implement Auth Endpoint', project: 'AUTH' },
    { id: 'wi-bug-442-s', userId: 'user-synth-15', provider: 'jira', externalId: 'BUG-442', title: 'Worker process heap memory leak', project: 'BUG' },
  ],
  normalizedEvents: [
    {
      id: 'ev-p15-1',
      userId: 'user-synth-15',
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-26T10:00:00.000Z'),
      title: 'refactor worker authentication to fix memory leak AUTH-231 BUG-442',
      metadata: { repo: 'backend-worker', branch: 'refactor/auth-leak' },
    },
    {
      id: 'ev-p15-2',
      userId: 'user-synth-15',
      provider: 'github',
      eventType: 'pr_opened',
      occurredAt: new Date('2026-08-26T14:00:00.000Z'),
      title: 'Refactor worker auth and resolve leak AUTH-231 BUG-442',
      metadata: { repo: 'backend-worker', prNumber: 404 },
    },
  ],
  expected: {
    targetWorkItemKeys: ['AUTH-231', 'BUG-442'],
  },
};

export const SYNTHETIC_WORKDAYS: SyntheticWorkday[] = [
  pattern1_simpleJiraGit,
  pattern2_multiTicket,
  pattern3_longDebugging,
  pattern4_meetingHeavy,
  pattern5_prReview,
  pattern6_research,
  pattern7_mixed,
  pattern8_ambiguous,
  pattern9_noEvidenceGap,
  pattern10_weekendWork,
  pattern11_timezoneEdge,
  pattern12_missingApiData,
  pattern13_duplicateEvents,
  pattern14_incorrectJiraMetadata,
  pattern15_multiTicketSpan,
];
