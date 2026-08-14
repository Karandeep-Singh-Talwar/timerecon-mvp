import prisma from '@/lib/db';
import { IntegrationService } from '@/lib/connectors/service';
import { normalizeAndSaveEvents } from '@/lib/normalizer';
import { reconstructWorkday } from '@/lib/allocation';
import { RawEvent } from '@/lib/connectors/types';
import { zonedDateTime } from '@/lib/time';

/**
 * Returns 5 consecutive dates (YYYY-MM-DD) for Monday through Friday
 * of the current week (or most recent Monday).
 */
export function getDogfoodDates(): string[] {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diffToMonday);

  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Seeds 5 consecutive days of rich developer activity (Monday through Friday)
 * for a user and triggers reconstruction for each day.
 */
export async function seedDogfoodData(userId: string, targetDates?: string[]) {
  // 1. Resolve user ID or email
  let user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    user = await prisma.user.findUnique({
      where: { email: userId },
    });
  }
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  const effectiveUserId = user.id;

  const dates = targetDates && targetDates.length === 5 ? targetDates : getDogfoodDates();
  const [mon, tue, wed, thu, fri] = dates;

  // 2. Clean up previous records for idempotency
  const existingSessions = await prisma.workSession.findMany({
    where: { userId: effectiveUserId },
    select: { id: true },
  });
  const sessionIds = existingSessions.map((s) => s.id);

  if (sessionIds.length > 0) {
    const existingAllocations = await prisma.allocation.findMany({
      where: { workSessionId: { in: sessionIds } },
      select: { id: true },
    });
    const allocIds = existingAllocations.map((a) => a.id);

    if (allocIds.length > 0) {
      await prisma.allocationEvidence.deleteMany({
        where: { allocationId: { in: allocIds } },
      });
      await prisma.allocation.deleteMany({
        where: { id: { in: allocIds } },
      });
    }

    await prisma.workSession.deleteMany({
      where: { id: { in: sessionIds } },
    });
  }

  await prisma.normalizedEvent.deleteMany({
    where: { userId: effectiveUserId },
  });

  await prisma.workItem.deleteMany({
    where: { userId: effectiveUserId },
  });

  // 3. Mark Jira, GitHub, and Google Calendar integrations as connected
  await IntegrationService.saveIntegration(
    effectiveUserId,
    'jira',
    { accessToken: 'mock-jira-access-token' },
    'mock-jira-dev-account',
    { connected: true, providerName: 'Jira Cloud' }
  );
  await IntegrationService.saveIntegration(
    effectiveUserId,
    'github',
    { accessToken: 'mock-github-access-token' },
    'mock-github-dev-account',
    { connected: true, providerName: 'GitHub' }
  );
  await IntegrationService.saveIntegration(
    effectiveUserId,
    'google_calendar',
    { accessToken: 'mock-gcal-access-token' },
    'mock-gcal-dev-account',
    { connected: true, providerName: 'Google Calendar' }
  );

  // 4. Create WorkItems
  const workItemsData = [
    {
      externalId: 'AUTH-231',
      provider: 'jira' as const,
      title: 'Implement Auth Endpoint',
      project: 'AUTH',
      itemType: 'task',
      status: 'in_progress',
    },
    {
      externalId: 'BUG-442',
      provider: 'jira' as const,
      title: 'Worker process heap memory leak',
      project: 'BUG',
      itemType: 'bug',
      status: 'in_progress',
    },
    {
      externalId: 'FE-101',
      provider: 'jira' as const,
      title: 'Header Navbar Component',
      project: 'FE',
      itemType: 'story',
      status: 'in_progress',
    },
    {
      externalId: 'BE-201',
      provider: 'jira' as const,
      title: 'User Profile Endpoint',
      project: 'BE',
      itemType: 'task',
      status: 'in_progress',
    },
    {
      externalId: 'PROJ-101',
      provider: 'jira' as const,
      title: 'Redesign analytics dashboard UI',
      project: 'PROJ',
      itemType: 'story',
      status: 'in_progress',
    },
    {
      externalId: 'PR-105',
      provider: 'github' as const,
      title: 'Rate limiting implementation',
      project: 'api-gateway',
      itemType: 'pr',
      status: 'open',
    },
  ];

  for (const item of workItemsData) {
    await prisma.workItem.create({
      data: {
        userId: effectiveUserId,
        provider: item.provider,
        externalId: item.externalId,
        title: item.title,
        project: item.project,
        itemType: item.itemType,
        status: item.status,
      },
    });
  }

  // 5. Raw Events for 5 Days — wall-clock times in the user's timezone
  const tz = user.timezone || 'UTC';
  const at = (day: string, time: string) => zonedDateTime(day, time, tz);
  const rawEvents: RawEvent[] = [
    // Day 1 (Monday): Simple Jira + Git work (AUTH-231, BUG-442), Standup, 1 commit, 1 PR
    {
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: at(mon, '09:00'),
      endedAt: at(mon, '09:30'),
      duration: 30,
      title: 'Daily Engineering Standup',
      externalId: `gcal-standup-${mon}`,
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: at(mon, '09:45'),
      title: 'feat(auth): add login auth handler AUTH-231',
      workItemExternalId: 'AUTH-231',
      externalId: `commit-auth231-${mon}`,
      metadata: { repo: 'auth-service', branch: 'feature/AUTH-231-login', sha: `sha-auth231-${mon}` },
    },
    {
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: at(mon, '11:30'),
      title: 'BUG-442: Investigating worker process heap allocation',
      workItemExternalId: 'BUG-442',
      externalId: `jira-bug442-upd-${mon}-1130`,
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: at(mon, '14:00'),
      title: 'fix(worker): memory leak fix for socket listener BUG-442',
      workItemExternalId: 'BUG-442',
      externalId: `commit-bug442-${mon}`,
      metadata: { repo: 'backend-worker', branch: 'fix/BUG-442-leak', sha: `sha-bug442-${mon}` },
    },
    {
      provider: 'github',
      eventType: 'pr_opened',
      occurredAt: at(mon, '16:00'),
      title: 'PR #101 opened: Implement Auth Endpoint AUTH-231',
      workItemExternalId: 'AUTH-231',
      externalId: `pr-101-${mon}`,
      metadata: { repo: 'auth-service', prNumber: 101 },
    },

    // Day 2 (Tuesday): Multi-ticket context switching (FE-101, BE-201), Sprint Planning meeting
    {
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: at(tue, '09:00'),
      endedAt: at(tue, '10:30'),
      duration: 90,
      title: 'Sprint Planning & Backlog Refinement',
      externalId: `gcal-sprint-${tue}`,
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: at(tue, '10:45'),
      title: 'feat(fe): navbar header component FE-101',
      workItemExternalId: 'FE-101',
      externalId: `commit-fe101a-${tue}`,
      metadata: { repo: 'frontend-app', branch: 'FE-101', sha: `sha-fe101a-${tue}` },
    },
    {
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: at(tue, '11:30'),
      title: 'FE-101: Updated status to In Progress',
      workItemExternalId: 'FE-101',
      externalId: `jira-fe101-upd-${tue}`,
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: at(tue, '14:00'),
      title: 'feat(be): user profile GET endpoint BE-201',
      workItemExternalId: 'BE-201',
      externalId: `commit-be201-${tue}`,
      metadata: { repo: 'backend-api', branch: 'BE-201', sha: `sha-be201-${tue}` },
    },
    {
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: at(tue, '15:15'),
      title: 'BE-201: Added validation middleware for user payload',
      workItemExternalId: 'BE-201',
      externalId: `jira-be201-cmt-${tue}`,
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: at(tue, '16:30'),
      title: 'feat(fe): profile avatar dropdown FE-101',
      workItemExternalId: 'FE-101',
      externalId: `commit-fe101b-${tue}`,
      metadata: { repo: 'frontend-app', branch: 'FE-101', sha: `sha-fe101b-${tue}` },
    },

    // Day 3 (Wednesday): Long 3-hour debugging session (BUG-442) with zero commits, 1 PR review
    {
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: at(wed, '09:30'),
      title: 'BUG-442: Analyzing heap memory allocation in socket listener',
      workItemExternalId: 'BUG-442',
      externalId: `jira-bug442-upd-${wed}-0930`,
    },
    {
      provider: 'github',
      eventType: 'branch_activity',
      occurredAt: at(wed, '09:35'),
      title: 'Active branch fix/BUG-442-heap-leak',
      workItemExternalId: 'BUG-442',
      externalId: `branch-bug442-${wed}`,
      metadata: { repo: 'backend-worker', branch: 'fix/BUG-442-heap-leak' },
    },
    {
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: at(wed, '10:30'),
      title: 'BUG-442: Inspecting heap snapshots for socket retainer leak',
      workItemExternalId: 'BUG-442',
      externalId: `jira-bug442-cmt-${wed}-1030`,
    },
    {
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: at(wed, '11:45'),
      title: 'BUG-442: Identified event listener retention issue in connection pool',
      workItemExternalId: 'BUG-442',
      externalId: `jira-bug442-cmt-${wed}-1145`,
    },
    {
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: at(wed, '12:30'),
      title: 'BUG-442: Memory leak root cause confirmed and patch verified',
      workItemExternalId: 'BUG-442',
      externalId: `jira-bug442-cmt-${wed}-1230`,
    },
    {
      provider: 'github',
      eventType: 'pr_review',
      occurredAt: at(wed, '15:00'),
      title: 'Review submitted on PR #88: Redis Session Store Refactor',
      externalId: `pr-review-88-${wed}`,
      metadata: { repo: 'backend-api', prNumber: 88 },
    },

    // Day 4 (Thursday): Meeting-heavy day (Standup, 1-on-1, Tech Architecture Sync), 1 ticket (PROJ-101)
    {
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: at(thu, '09:00'),
      endedAt: at(thu, '09:30'),
      duration: 30,
      title: 'Daily Engineering Standup',
      externalId: `gcal-standup-${thu}`,
    },
    {
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: at(thu, '10:00'),
      endedAt: at(thu, '10:30'),
      duration: 30,
      title: '1-on-1 with Engineering Manager',
      externalId: `gcal-1on1-${thu}`,
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: at(thu, '11:00'),
      title: 'feat(dashboard): analytics chart widgets draft PROJ-101',
      workItemExternalId: 'PROJ-101',
      externalId: `commit-proj101-${thu}`,
      metadata: { repo: 'frontend-app', branch: 'feature/PROJ-101', sha: `sha-proj101-${thu}` },
    },
    {
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: at(thu, '14:00'),
      endedAt: at(thu, '15:30'),
      duration: 90,
      title: 'Tech Architecture Sync',
      externalId: `gcal-arch-${thu}`,
    },
    {
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: at(thu, '16:00'),
      title: 'PROJ-101: Updated design specs based on Architecture Sync',
      workItemExternalId: 'PROJ-101',
      externalId: `jira-proj101-cmt-${thu}`,
    },

    // Day 5 (Friday): Mixed day + PR reviews + 1-hour unallocated gap for end-of-week review
    {
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: at(fri, '09:00'),
      endedAt: at(fri, '09:30'),
      duration: 30,
      title: 'Weekly Team Standup & Demo Prep',
      externalId: `gcal-standup-${fri}`,
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: at(fri, '09:45'),
      title: 'feat(auth): session refresh handler AUTH-231',
      workItemExternalId: 'AUTH-231',
      externalId: `commit-auth231-${fri}`,
      metadata: { repo: 'auth-service', branch: 'feature/AUTH-231-login', sha: `sha-auth231-${fri}` },
    },
    {
      provider: 'github',
      eventType: 'pr_review',
      occurredAt: at(fri, '11:00'),
      title: 'Review submitted on PR #102: Payment service webhook handler',
      externalId: `pr-review-102-${fri}`,
      metadata: { repo: 'payment-service', prNumber: 102 },
    },
    {
      provider: 'github',
      eventType: 'pr_review',
      occurredAt: at(fri, '14:00'),
      title: 'Review submitted on PR #104: UI Notification Center',
      externalId: `pr-review-104-${fri}`,
      metadata: { repo: 'frontend-app', prNumber: 104 },
    },
    {
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: at(fri, '15:00'),
      title: 'AUTH-231: Marked ticket as Resolved',
      workItemExternalId: 'AUTH-231',
      externalId: `jira-auth231-upd-${fri}`,
    },
  ];

  // 6. Normalize and save events
  await normalizeAndSaveEvents(effectiveUserId, rawEvents);

  // 7. Trigger reconstruction engine for each of the 5 days
  const sessions = [];
  for (const dateStr of dates) {
    const session = await reconstructWorkday({
      userId: effectiveUserId,
      date: dateStr,
      force: true,
    });
    sessions.push(session);
  }

  return {
    success: true,
    userId: effectiveUserId,
    dates,
    workSessionsCount: sessions.length,
  };
}
