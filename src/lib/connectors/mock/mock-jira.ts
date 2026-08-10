import { Connector, BaseWorkItem, RawEvent } from '../types';

export class MockJiraConnector implements Connector {
  readonly provider = 'jira' as const;

  private mockWorkItems: BaseWorkItem[] = [
    {
      externalId: 'AUTH-231',
      provider: 'jira',
      title: 'Implement token refresh flow for NextAuth',
      description: 'Handle silent token refresh and error handling for OAuth integrations.',
      status: 'In Progress',
      project: 'AUTH',
      itemType: 'story',
      externalUrl: 'https://jira.company.com/browse/AUTH-231',
      metadata: { priority: 'High', assignee: 'Dev User' },
      createdAt: new Date('2026-08-01T09:00:00Z'),
      updatedAt: new Date('2026-08-10T11:30:00Z'),
    },
    {
      externalId: 'BUG-442',
      provider: 'jira',
      title: 'Fix memory leak in background worker pool',
      description: 'Redis connection pool is not closing idle connections after job execution.',
      status: 'Done',
      project: 'BUG',
      itemType: 'bug',
      externalUrl: 'https://jira.company.com/browse/BUG-442',
      metadata: { priority: 'Highest', assignee: 'Dev User' },
      createdAt: new Date('2026-08-02T10:00:00Z'),
      updatedAt: new Date('2026-08-09T16:00:00Z'),
    },
    {
      externalId: 'PROJ-101',
      provider: 'jira',
      title: 'Design time allocation confidence algorithm',
      description: 'Define candidate scoring matrix based on evidence strength and temporal proximity.',
      status: 'In Progress',
      project: 'PROJ',
      itemType: 'task',
      externalUrl: 'https://jira.company.com/browse/PROJ-101',
      metadata: { priority: 'Medium', assignee: 'Dev User' },
      createdAt: new Date('2026-08-03T11:00:00Z'),
      updatedAt: new Date('2026-08-10T14:15:00Z'),
    },
    {
      externalId: 'FEAT-505',
      provider: 'jira',
      title: 'Export timesheet to CSV format',
      description: 'Support exporting approved timesheet to CSV with billable flags and custom headers.',
      status: 'To Do',
      project: 'FEAT',
      itemType: 'story',
      externalUrl: 'https://jira.company.com/browse/FEAT-505',
      metadata: { priority: 'Low', assignee: 'Dev User' },
      createdAt: new Date('2026-08-05T14:00:00Z'),
      updatedAt: new Date('2026-08-08T09:00:00Z'),
    },
  ];

  private mockEvents: RawEvent[] = [
    {
      provider: 'jira',
      eventType: 'worklog',
      occurredAt: new Date('2026-08-10T10:00:00Z'),
      duration: 120,
      title: 'Logged 2 hours on AUTH-231',
      description: 'Worked on OAuth token encryption and refresh logic.',
      workItemExternalId: 'AUTH-231',
      externalUrl: 'https://jira.company.com/browse/AUTH-231',
      metadata: { timeSpentSeconds: 7200 },
    },
    {
      provider: 'jira',
      eventType: 'issue_commented',
      occurredAt: new Date('2026-08-10T11:30:00Z'),
      title: 'Commented on AUTH-231',
      description: 'PR is ready for review. Token encryption added.',
      workItemExternalId: 'AUTH-231',
      externalUrl: 'https://jira.company.com/browse/AUTH-231#comment-101',
    },
    {
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: new Date('2026-08-09T16:00:00Z'),
      title: 'Updated BUG-442 status to Done',
      description: 'Resolved memory leak in Redis connection pool.',
      workItemExternalId: 'BUG-442',
      externalUrl: 'https://jira.company.com/browse/BUG-442',
    },
    {
      provider: 'jira',
      eventType: 'issue_updated',
      occurredAt: new Date('2026-08-10T14:15:00Z'),
      title: 'Updated status of PROJ-101 to In Progress',
      description: 'Started designing confidence scoring heuristics.',
      workItemExternalId: 'PROJ-101',
      externalUrl: 'https://jira.company.com/browse/PROJ-101',
    },
  ];

  async fetchWorkItems(userId: string, since: Date): Promise<BaseWorkItem[]> {
    return this.mockWorkItems.filter(
      (item) => !item.updatedAt || item.updatedAt >= since
    );
  }

  async fetchEvents(userId: string, since: Date): Promise<RawEvent[]> {
    return this.mockEvents.filter((event) => event.occurredAt >= since);
  }
}
