import prisma from '@/lib/db';
import { IntegrationService } from '@/lib/connectors/service';
import { normalizeAndSaveEvents } from '@/lib/normalizer';
import { reconstructWorkday } from '@/lib/allocation';
import { RawEvent } from '@/lib/connectors/types';

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

  // 5. Raw Events for 5 Days
  const rawEvents: RawEvent[] = [
    // Day 1 (Monday): Simple Jira + Git work (AUTH-231, BUG-442), Standup, 1 commit, 1 PR
    {
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: new Date(`${mon}T09:00:00.000Z`),
      endedAt: new Date(`${mon}T09:30:00.000Z`),
      duration: 30,
      title: 'Daily Engineering Standup',
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date(`${mon}T09:45:00.000Z`),
      title: 'feat(auth): add login auth handler AUTH-231',
      workItemExternalId: 'AUTH-231',
      metadata: { repo: 'auth-service', branch: 'feature/AUTH-231-login' },
    },
    {
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: new Date(`${mon}T11:30:00.000Z`),
      title: 'BUG-442: Investigating worker process heap allocation',
      workItemExternalId: 'BUG-442',
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date(`${mon}T14:00:00.000Z`),
      title: 'fix(worker): memory leak fix for socket listener BUG-442',
      workItemExternalId: 'BUG-442',
      metadata: { repo: 'backend-worker', branch: 'fix/BUG-442-leak' },
    },
    {
      provider: 'github',
      eventType: 'pr_opened',
      occurredAt: new Date(`${mon}T16:00:00.000Z`),
      title: 'PR #101 opened: Implement Auth Endpoint AUTH-231',
      workItemExternalId: 'AUTH-231',
      metadata: { repo: 'auth-service', prNumber: 101 },
    },

    // Day 2 (Tuesday): Multi-ticket context switching (FE-101, BE-201), Sprint Planning meeting
    {
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: new Date(`${tue}T09:00:00.000Z`),
      endedAt: new Date(`${tue}T10:30:00.000Z`),
      duration: 90,
      title: 'Sprint Planning & Backlog Refinement',
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date(`${tue}T10:45:00.000Z`),
      title: 'feat(fe): navbar header component FE-101',
      workItemExternalId: 'FE-101',
      metadata: { repo: 'frontend-app', branch: 'FE-101' },
    },
    {
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: new Date(`${tue}T11:30:00.000Z`),
      title: 'FE-101: Updated status to In Progress',
      workItemExternalId: 'FE-101',
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date(`${tue}T14:00:00.000Z`),
      title: 'feat(be): user profile GET endpoint BE-201',
      workItemExternalId: 'BE-201',
      metadata: { repo: 'backend-api', branch: 'BE-201' },
    },
    {
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: new Date(`${tue}T15:15:00.000Z`),
      title: 'BE-201: Added validation middleware for user payload',
      workItemExternalId: 'BE-201',
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date(`${tue}T16:30:00.000Z`),
      title: 'feat(fe): profile avatar dropdown FE-101',
      workItemExternalId: 'FE-101',
      metadata: { repo: 'frontend-app', branch: 'FE-101' },
    },

    // Day 3 (Wednesday): Long 3-hour debugging session (BUG-442) with zero commits, 1 PR review
    {
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: new Date(`${wed}T09:30:00.000Z`),
      title: 'BUG-442: Analyzing heap memory allocation in socket listener',
      workItemExternalId: 'BUG-442',
    },
    {
      provider: 'github',
      eventType: 'branch_activity',
      occurredAt: new Date(`${wed}T09:35:00.000Z`),
      title: 'Active branch fix/BUG-442-heap-leak',
      workItemExternalId: 'BUG-442',
      metadata: { repo: 'backend-worker', branch: 'fix/BUG-442-heap-leak' },
    },
    {
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: new Date(`${wed}T10:30:00.000Z`),
      title: 'BUG-442: Inspecting heap snapshots for socket retainer leak',
      workItemExternalId: 'BUG-442',
    },
    {
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: new Date(`${wed}T11:45:00.000Z`),
      title: 'BUG-442: Identified event listener retention issue in connection pool',
      workItemExternalId: 'BUG-442',
    },
    {
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: new Date(`${wed}T12:30:00.000Z`),
      title: 'BUG-442: Memory leak root cause confirmed and patch verified',
      workItemExternalId: 'BUG-442',
    },
    {
      provider: 'github',
      eventType: 'pr_review',
      occurredAt: new Date(`${wed}T15:00:00.000Z`),
      title: 'Review submitted on PR #88: Redis Session Store Refactor',
      metadata: { repo: 'backend-api', prNumber: 88 },
    },

    // Day 4 (Thursday): Meeting-heavy day (Standup, 1-on-1, Tech Architecture Sync), 1 ticket (PROJ-101)
    {
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: new Date(`${thu}T09:00:00.000Z`),
      endedAt: new Date(`${thu}T09:30:00.000Z`),
      duration: 30,
      title: 'Daily Engineering Standup',
    },
    {
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: new Date(`${thu}T10:00:00.000Z`),
      endedAt: new Date(`${thu}T10:30:00.000Z`),
      duration: 30,
      title: '1-on-1 with Engineering Manager',
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date(`${thu}T11:00:00.000Z`),
      title: 'feat(dashboard): analytics chart widgets draft PROJ-101',
      workItemExternalId: 'PROJ-101',
      metadata: { repo: 'frontend-app', branch: 'feature/PROJ-101' },
    },
    {
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: new Date(`${thu}T14:00:00.000Z`),
      endedAt: new Date(`${thu}T15:30:00.000Z`),
      duration: 90,
      title: 'Tech Architecture Sync',
    },
    {
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: new Date(`${thu}T16:00:00.000Z`),
      title: 'PROJ-101: Updated design specs based on Architecture Sync',
      workItemExternalId: 'PROJ-101',
    },

    // Day 5 (Friday): Mixed day + PR reviews + 1-hour unallocated gap for end-of-week review
    {
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: new Date(`${fri}T09:00:00.000Z`),
      endedAt: new Date(`${fri}T09:30:00.000Z`),
      duration: 30,
      title: 'Weekly Team Standup & Demo Prep',
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date(`${fri}T09:45:00.000Z`),
      title: 'feat(auth): session refresh handler AUTH-231',
      workItemExternalId: 'AUTH-231',
      metadata: { repo: 'auth-service', branch: 'feature/AUTH-231-login' },
    },
    {
      provider: 'github',
      eventType: 'pr_review',
      occurredAt: new Date(`${fri}T11:00:00.000Z`),
      title: 'Review submitted on PR #102: Payment service webhook handler',
      metadata: { repo: 'payment-service', prNumber: 102 },
    },
    {
      provider: 'github',
      eventType: 'pr_review',
      occurredAt: new Date(`${fri}T14:00:00.000Z`),
      title: 'Review submitted on PR #104: UI Notification Center',
      metadata: { repo: 'frontend-app', prNumber: 104 },
    },
    {
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: new Date(`${fri}T15:00:00.000Z`),
      title: 'AUTH-231: Marked ticket as Resolved',
      workItemExternalId: 'AUTH-231',
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
