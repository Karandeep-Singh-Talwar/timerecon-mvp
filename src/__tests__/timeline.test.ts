import { describe, it, expect } from 'vitest';
import { generateTimeSegments } from '@/lib/timeline';
import { NormalizedEvent } from '@prisma/client';

describe('Timeline Engine', () => {
  const date = '2026-08-10';
  const userId = 'user-1';

  it('should generate default timeline when no events are provided', async () => {
    const segments = await generateTimeSegments({
      userId,
      date,
      eventsInput: [],
    });

    expect(segments.length).toBeGreaterThan(0);
    // Should span 09:00 to 17:30 (8.5 hours = 510 minutes)
    const totalMinutes = segments.reduce((sum, s) => sum + s.durationMinutes, 0);
    expect(totalMinutes).toBe(510);
    expect(segments[0].isGap).toBe(true);
  });

  it('should anchor calendar events into fixed time slots', async () => {
    const meetingEvent: NormalizedEvent = {
      id: 'event-1',
      userId,
      provider: 'google_calendar',
      eventType: 'calendar_event',
      occurredAt: new Date(`${date}T10:00:00.000Z`),
      endedAt: new Date(`${date}T11:00:00.000Z`),
      duration: 60,
      title: 'Team Standup & Planning',
      description: null,
      workItemId: null,
      metadata: null,
      externalUrl: null,
      createdAt: new Date(),
    };

    const segments = await generateTimeSegments({
      userId,
      date,
      eventsInput: [meetingEvent],
    });

    const meetingSeg = segments.find((s) => s.isCalendarAnchored);
    expect(meetingSeg).toBeDefined();
    expect(meetingSeg?.durationMinutes).toBe(60);
    expect(meetingSeg?.events[0].title).toBe('Team Standup & Planning');
  });

  it('should cluster non-calendar events occurring within 15 minutes', async () => {
    const commit1: NormalizedEvent = {
      id: 'c1',
      userId,
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date(`${date}T14:00:00.000Z`),
      endedAt: null,
      duration: null,
      title: 'fix: resolve AUTH-231 login bug',
      description: null,
      workItemId: null,
      metadata: { repo: 'auth-service' },
      externalUrl: null,
      createdAt: new Date(),
    };

    const commit2: NormalizedEvent = {
      id: 'c2',
      userId,
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date(`${date}T14:10:00.000Z`),
      endedAt: null,
      duration: null,
      title: 'test: add unit test for auth handler',
      description: null,
      workItemId: null,
      metadata: { repo: 'auth-service' },
      externalUrl: null,
      createdAt: new Date(),
    };

    const segments = await generateTimeSegments({
      userId,
      date,
      eventsInput: [commit1, commit2],
    });

    const clusterSeg = segments.find((s) => s.events.length === 2);
    expect(clusterSeg).toBeDefined();
    expect(clusterSeg?.events.length).toBe(2);
  });

  it('should extend working hours if activity occurs outside 09:00 - 17:30', async () => {
    const earlyEvent: NormalizedEvent = {
      id: 'early-1',
      userId,
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date(`${date}T08:00:00.000Z`),
      endedAt: null,
      duration: null,
      title: 'early commit',
      description: null,
      workItemId: null,
      metadata: null,
      externalUrl: null,
      createdAt: new Date(),
    };

    const segments = await generateTimeSegments({
      userId,
      date,
      eventsInput: [earlyEvent],
    });

    const firstSeg = segments[0];
    expect(firstSeg.startTime.getUTCHours()).toBeLessThan(9);
  });

  it('uses the user timezone when creating working-hour boundaries', async () => {
    const segments = await generateTimeSegments({
      userId,
      date,
      timezone: 'Asia/Kolkata',
      eventsInput: [],
    });

    expect(segments[0].startTime.toISOString()).toBe('2026-08-10T03:30:00.000Z');
    expect(segments.reduce((sum, segment) => sum + segment.durationMinutes, 0)).toBe(510);
  });

  it('merges overlapping calendar events instead of counting time twice', async () => {
    const firstMeeting: NormalizedEvent = {
      id: 'meeting-1', userId, provider: 'google_calendar', eventType: 'calendar_event',
      occurredAt: new Date(`${date}T10:00:00.000Z`), endedAt: new Date(`${date}T11:00:00.000Z`),
      duration: 60, title: 'Planning', description: null, workItemId: null, metadata: null,
      externalUrl: null, createdAt: new Date(),
    };
    const secondMeeting: NormalizedEvent = {
      ...firstMeeting, id: 'meeting-2', occurredAt: new Date(`${date}T10:30:00.000Z`),
      endedAt: new Date(`${date}T11:30:00.000Z`), title: 'Architecture',
    };

    const segments = await generateTimeSegments({ userId, date, eventsInput: [firstMeeting, secondMeeting] });
    const meetings = segments.filter((segment) => segment.isCalendarAnchored);
    expect(meetings).toHaveLength(1);
    expect(meetings[0].durationMinutes).toBe(90);
  });
});
