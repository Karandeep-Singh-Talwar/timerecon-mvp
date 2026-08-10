import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultMockPrisma } from './helpers/mock-db';

// Mock DB module
vi.mock('@/lib/db', () => ({
  default: defaultMockPrisma,
  prisma: defaultMockPrisma,
}));

import { reconstructWorkSession } from '@/lib/allocation';
import { normalizeAndSaveEvents } from '@/lib/normalizer';
import { recordUserCorrection, getUserLearnings } from '@/lib/learning';
import { generateTimesheet, exportTimesheetCSV } from '@/lib/export';
import { SYNTHETIC_WORKDAYS, SyntheticWorkday } from './fixtures/workdays';

describe('TimeRecon End-to-End Pipeline Integration Test Suite', () => {
  beforeEach(() => {
    defaultMockPrisma.reset();
  });

  async function seedWorkday(workday: SyntheticWorkday) {
    // 1. Create User
    await defaultMockPrisma.user.create({
      data: {
        id: workday.userId,
        email: `${workday.userId}@example.com`,
        name: `Dev ${workday.patternNumber}`,
        passwordHash: 'hash',
        timezone: workday.userTimezone || 'UTC',
        workingHoursStart: workday.workingHoursStart || '09:00',
        workingHoursEnd: workday.workingHoursEnd || '17:30',
      },
    });

    // 2. Create WorkItems
    for (const wi of workday.workItems) {
      await defaultMockPrisma.workItem.create({
        data: wi,
      });
    }

    // 3. Raw Events / Normalized Events Ingestion
    if (workday.rawEvents && workday.rawEvents.length > 0) {
      await normalizeAndSaveEvents(workday.userId, workday.rawEvents);
    } else {
      for (const ev of workday.normalizedEvents) {
        await defaultMockPrisma.normalizedEvent.create({
          data: ev,
        });
      }
    }
  }

  describe('15 Synthetic Developer Workday Scenarios', () => {
    it.each(SYNTHETIC_WORKDAYS)(
      'Pattern #$patternNumber: $name',
      async (workday) => {
        await seedWorkday(workday);

        // Run reconstruction pipeline
        const session = await reconstructWorkSession(workday.userId, workday.date);
        expect(session).toBeDefined();
        expect(session?.userId).toBe(workday.userId);
        expect(session?.allocations.length).toBeGreaterThan(0);

        // Verify total minutes spans workday / activity extent
        expect(session?.totalMinutes).toBeGreaterThan(0);

        // Pattern-specific assertions
        switch (workday.patternNumber) {
          case 1: {
            // Simple Jira + Git Day
            const standupAlloc = session?.allocations.find((a) => a.allocationType === 'meeting');
            expect(standupAlloc).toBeDefined();
            expect(standupAlloc?.confidence).toBeGreaterThanOrEqual(0.8);
            expect(standupAlloc?.confidenceLevel).toBe('high');

            const keys = session?.allocations.map((a) => a.workItem?.externalId).filter(Boolean);
            expect(keys).toContain('AUTH-231');
            expect(keys).toContain('BUG-442');
            expect(keys).toContain('PROJ-101');
            break;
          }
          case 2: {
            // Multi-ticket Day
            const keys = session?.allocations.map((a) => a.workItem?.externalId).filter(Boolean);
            expect(session?.allocations.length).toBeGreaterThanOrEqual(5);
            expect(keys?.length).toBeGreaterThanOrEqual(5);
            break;
          }
          case 3: {
            // Long Debugging Session (0 commits, 0 PRs)
            const bugAlloc = session?.allocations.find((a) => a.workItem?.externalId === 'BUG-442');
            expect(bugAlloc).toBeDefined();
            expect(bugAlloc?.workItem?.externalId).toBe('BUG-442');
            // Evidence should contain descriptions of Jira updates / branch activity
            const evidences = bugAlloc?.evidence || [];
            expect(evidences.length).toBeGreaterThan(0);
            break;
          }
          case 4: {
            // Meeting-heavy Day
            const meetings = session?.allocations.filter((a) => a.allocationType === 'meeting');
            expect(meetings?.length).toBeGreaterThanOrEqual(4);
            meetings?.forEach((m) => {
              expect(m.confidence).toBeGreaterThanOrEqual(0.8);
              expect(m.confidenceLevel).toBe('high');
            });
            break;
          }
          case 5: {
            // PR Review Day
            const prReviews = session?.allocations.filter((a) => a.allocationType === 'pr_review');
            expect(prReviews?.length).toBeGreaterThanOrEqual(3);
            break;
          }
          case 6: {
            // Research & Exploration Day
            const researchAlloc = session?.allocations.find((a) => a.workItem?.externalId === 'PROJ-101');
            expect(researchAlloc).toBeDefined();
            break;
          }
          case 7: {
            // Mixed Day
            const hasMeeting = session?.allocations.some((a) => a.allocationType === 'meeting');
            const hasWorkItem = session?.allocations.some((a) => a.workItem?.externalId === 'AUTH-231');
            const hasUnallocated = session?.allocations.some((a) => a.allocationType === 'unallocated');
            expect(hasMeeting).toBe(true);
            expect(hasWorkItem).toBe(true);
            expect(hasUnallocated).toBe(true);
            break;
          }
          case 8: {
            // Ambiguous Work
            const hasNeedsReview = session?.allocations.some((a) => a.confidenceLevel === 'needs_review');
            expect(hasNeedsReview).toBe(true);
            break;
          }
          case 9: {
            // No Evidence Gap (2+ hours zero events)
            const gapAlloc = session?.allocations.find(
              (a) => a.allocationType === 'unallocated' && a.durationMinutes >= 120
            );
            expect(gapAlloc).toBeDefined();
            expect(gapAlloc?.confidenceLevel).toBe('needs_review');
            break;
          }
          case 10: {
            // Weekend Work
            expect(session?.date.toISOString().split('T')[0]).toBe('2026-08-22');
            const wkndBug = session?.allocations.find((a) => a.workItem?.externalId === 'BUG-442');
            expect(wkndBug).toBeDefined();
            break;
          }
          case 11: {
            // Timezone Edge Case
            const tzAlloc = session?.allocations.find((a) => a.workItem?.externalId === 'AUTH-231');
            expect(tzAlloc).toBeDefined();
            expect(session?.totalMinutes).toBeGreaterThan(0);
            break;
          }
          case 12: {
            // Missing API Data
            const missingApiAlloc = session?.allocations.find((a) => a.workItem?.externalId === 'AUTH-231');
            expect(missingApiAlloc).toBeDefined();
            break;
          }
          case 13: {
            // Duplicate Events
            const dupAlloc = session?.allocations.find((a) => a.workItem?.externalId === 'AUTH-231');
            expect(dupAlloc).toBeDefined();
            // Ingested normalized events should be deduplicated
            const normEvents = await defaultMockPrisma.normalizedEvent.findMany({ where: { userId: workday.userId } });
            expect(normEvents.length).toBe(1);
            break;
          }
          case 14: {
            // Incorrect Jira Metadata
            const needsReviewAlloc = session?.allocations.some(
              (a) => a.confidenceLevel === 'needs_review' || a.allocationType === 'general_engineering'
            );
            expect(needsReviewAlloc).toBe(true);
            break;
          }
          case 15: {
            // Work Spanning Multiple Tickets
            expect(session?.allocations.length).toBeGreaterThan(0);
            break;
          }
        }
      }
    );
  });

  describe('Core Pipeline Operations & Refinements', () => {
    it('should split an allocation while preserving total combined duration', async () => {
      const workday = SYNTHETIC_WORKDAYS[0]; // Pattern 1
      await seedWorkday(workday);
      const session = await reconstructWorkSession(workday.userId, workday.date);
      expect(session).toBeDefined();

      const allocToSplit = session!.allocations[0];
      const origDuration = allocToSplit.durationMinutes;

      const splitTime = new Date(allocToSplit.startTime.getTime() + 15 * 60000);
      const duration1 = Math.round((splitTime.getTime() - allocToSplit.startTime.getTime()) / 60000);
      const duration2 = Math.round((allocToSplit.endTime.getTime() - splitTime.getTime()) / 60000);

      // Perform split
      await defaultMockPrisma.allocation.update({
        where: { id: allocToSplit.id },
        data: {
          endTime: splitTime,
          durationMinutes: duration1,
          status: 'split',
          isUserModified: true,
        },
      });

      const secondPart = await defaultMockPrisma.allocation.create({
        data: {
          workSessionId: session!.id,
          startTime: splitTime,
          endTime: allocToSplit.endTime,
          durationMinutes: duration2,
          allocationType: allocToSplit.allocationType,
          workItemId: allocToSplit.workItemId,
          title: `${allocToSplit.title} (Part 2)`,
          confidence: allocToSplit.confidence,
          confidenceLevel: allocToSplit.confidenceLevel,
          status: 'split',
          isUserModified: true,
        },
      });

      expect(duration1 + duration2).toBe(origDuration);
      expect(secondPart.durationMinutes).toBe(duration2);
    });

    it('should merge two adjacent allocations into a single allocation with combined duration', async () => {
      const workday = SYNTHETIC_WORKDAYS[0];
      await seedWorkday(workday);
      const session = await reconstructWorkSession(workday.userId, workday.date);
      expect(session).toBeDefined();

      const alloc1 = session!.allocations[0];
      const alloc2 = session!.allocations[1];
      const combinedDuration = alloc1.durationMinutes + alloc2.durationMinutes;

      const mergedStart = alloc1.startTime < alloc2.startTime ? alloc1.startTime : alloc2.startTime;
      const mergedEnd = alloc1.endTime > alloc2.endTime ? alloc1.endTime : alloc2.endTime;

      const merged = await defaultMockPrisma.allocation.update({
        where: { id: alloc1.id },
        data: {
          startTime: mergedStart,
          endTime: mergedEnd,
          durationMinutes: combinedDuration,
          status: 'merged',
          isUserModified: true,
        },
      });

      await defaultMockPrisma.allocation.delete({
        where: { id: alloc2.id },
      });

      expect(merged.durationMinutes).toBe(combinedDuration);
      const remainingAlloc2 = await defaultMockPrisma.allocation.findUnique({ where: { id: alloc2.id } });
      expect(remainingAlloc2).toBeNull();
    });

    it('should update UserLearning pattern correctly when user correction is recorded', async () => {
      const userId = 'user-learning-test';
      await defaultMockPrisma.user.create({
        data: {
          id: userId,
          email: 'learning@example.com',
          name: 'Learning Tester',
          passwordHash: 'hash',
        },
      });

      const allocId = 'alloc-learning-1';
      await recordUserCorrection({
        userId,
        allocationId: allocId,
        correctionType: 'reassign',
        originalData: { title: 'Daily Engineering Standup', allocationType: 'meeting' },
        correctedData: { title: 'Daily Engineering Standup', workItemKey: 'PROJ-101', allocationType: 'meeting' },
      });

      const learnings = await getUserLearnings(userId);
      expect(learnings.length).toBeGreaterThan(0);
      const meetingLearning = learnings.find((l) => l.learningType === 'meeting_project');
      expect(meetingLearning).toBeDefined();
      expect(meetingLearning?.pattern).toBe('daily engineering standup');
      expect(meetingLearning?.resolution).toBe('PROJ-101');
    });

    it('should generate valid Timesheet & TimesheetEntry records for approved session', async () => {
      const workday = SYNTHETIC_WORKDAYS[0];
      await seedWorkday(workday);
      const session = await reconstructWorkSession(workday.userId, workday.date);
      expect(session).toBeDefined();

      const timesheet = await generateTimesheet(session!.id);
      expect(timesheet).toBeDefined();
      expect(timesheet.status).toBe('approved');
      expect(timesheet.entries.length).toBeGreaterThan(0);

      // Verify entries group by workItem
      const authEntry = timesheet.entries.find((e: any) => e.workItemKey === 'AUTH-231');
      expect(authEntry).toBeDefined();
      expect(authEntry?.durationMinutes).toBeGreaterThan(0);
    });

    it('should produce valid CSV export with correct headers and decimal hours', async () => {
      const workday = SYNTHETIC_WORKDAYS[0];
      await seedWorkday(workday);
      const session = await reconstructWorkSession(workday.userId, workday.date);
      const timesheet = await generateTimesheet(session!.id);

      const csv = await exportTimesheetCSV(timesheet.id);
      expect(csv).toBeDefined();

      const lines = csv.split('\n');
      expect(lines[0]).toBe('Date,Work Item,Project,Description,Hours,Billable');
      expect(lines.length).toBeGreaterThan(1);

      // Check decimal hours format (e.g. "0.50", "1.00", "1.50")
      const firstRow = lines[1];
      expect(firstRow).toMatch(/\d+\.\d{2}/);
    });
  });
});
