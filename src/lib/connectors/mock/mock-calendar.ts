import { Connector, BaseWorkItem, RawEvent } from '../types';

export class MockCalendarConnector implements Connector {
  readonly provider = 'google_calendar' as const;

  async fetchWorkItems(userId: string, since: Date): Promise<BaseWorkItem[]> {
    // Calendar events do not directly produce WorkItems
    return [];
  }

  async fetchEvents(userId: string, since: Date): Promise<RawEvent[]> {
    // Generate dates around today or relative to `since`
    const baseDate = new Date(since.getTime());
    baseDate.setUTCHours(0, 0, 0, 0);

    // If since was set to midnight, build events for today/target date
    const dateStr = baseDate.toISOString().split('T')[0];

    const events: RawEvent[] = [
      {
        provider: 'google_calendar',
        eventType: 'calendar_event',
        occurredAt: new Date(`${dateStr}T09:30:00Z`),
        endedAt: new Date(`${dateStr}T10:00:00Z`),
        duration: 30,
        title: 'Team Standup',
        description: 'Daily engineering sync meeting',
        externalId: 'cal-event-standup-001',
        externalUrl: 'https://calendar.google.com/calendar/event?eid=standup123',
        metadata: {
          attendees: ['alice@company.com', 'bob@company.com', 'dev@company.com'],
          status: 'confirmed',
          location: 'Google Meet',
        },
      },
      {
        provider: 'google_calendar',
        eventType: 'calendar_event',
        occurredAt: new Date(`${dateStr}T14:00:00Z`),
        endedAt: new Date(`${dateStr}T15:00:00Z`),
        duration: 60,
        title: 'Sprint Planning',
        description: 'Planning upcoming sprint items for PROJ-101 and AUTH tickets',
        externalId: 'cal-event-planning-002',
        externalUrl: 'https://calendar.google.com/calendar/event?eid=planning456',
        metadata: {
          attendees: ['product@company.com', 'tech-lead@company.com', 'dev@company.com'],
          status: 'confirmed',
          location: 'Conference Room B',
        },
      },
      {
        provider: 'google_calendar',
        eventType: 'calendar_event',
        occurredAt: new Date(`${dateStr}T16:00:00Z`),
        endedAt: new Date(`${dateStr}T16:30:00Z`),
        duration: 30,
        title: 'Architecture Sync',
        description: 'Discussing token encryption & AI allocation architecture',
        externalId: 'cal-event-arch-003',
        externalUrl: 'https://calendar.google.com/calendar/event?eid=arch789',
        metadata: {
          attendees: ['architect@company.com', 'dev@company.com'],
          status: 'confirmed',
          location: 'Google Meet',
        },
      },
    ];

    return events.filter((event) => event.occurredAt >= since);
  }
}
