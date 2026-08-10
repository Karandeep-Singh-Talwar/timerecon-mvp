import { Connector, BaseWorkItem, RawEvent } from '../types';

export class MockGithubConnector implements Connector {
  readonly provider = 'github' as const;

  private mockWorkItems: BaseWorkItem[] = [
    {
      externalId: '42',
      provider: 'github',
      title: 'fix(auth): resolve AUTH-231 token refresh issue',
      description: 'Implement token encryption and auto-refresh flow for Jira & GitHub OAuth tokens.',
      status: 'open',
      project: 'timerecon/app',
      itemType: 'pr',
      externalUrl: 'https://github.com/timerecon/app/pull/42',
      metadata: { author: 'devuser', branch: 'feature/AUTH-231' },
      createdAt: new Date('2026-08-10T09:15:00Z'),
      updatedAt: new Date('2026-08-10T12:00:00Z'),
    },
    {
      externalId: '45',
      provider: 'github',
      title: 'feat(allocator): add evidence scoring engine for PROJ-101',
      description: 'Calculate candidate work item confidence using direct references and temporal proximity.',
      status: 'in_progress',
      project: 'timerecon/app',
      itemType: 'pr',
      externalUrl: 'https://github.com/timerecon/app/pull/45',
      metadata: { author: 'devuser', branch: 'feature/PROJ-101-scoring' },
      createdAt: new Date('2026-08-10T13:30:00Z'),
      updatedAt: new Date('2026-08-10T15:00:00Z'),
    },
  ];

  private mockEvents: RawEvent[] = [
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-10T09:45:00Z'),
      title: 'Commit: fix(auth): resolve AUTH-231 token refresh issue',
      description: 'Added AES-256-GCM encryption helper and token refresh logic.',
      externalId: 'c01a9b4',
      externalUrl: 'https://github.com/timerecon/app/commit/c01a9b4',
      workItemExternalId: 'AUTH-231',
      metadata: { repo: 'timerecon/app', branch: 'feature/AUTH-231', sha: 'c01a9b4' },
    },
    {
      provider: 'github',
      eventType: 'branch_activity',
      occurredAt: new Date('2026-08-10T09:15:00Z'),
      title: 'Created branch feature/AUTH-231',
      description: 'Branch created from main for ticket AUTH-231.',
      workItemExternalId: 'AUTH-231',
      metadata: { branch: 'feature/AUTH-231', repo: 'timerecon/app' },
    },
    {
      provider: 'github',
      eventType: 'pr_opened',
      occurredAt: new Date('2026-08-10T10:15:00Z'),
      title: 'Opened PR #42: fix(auth): resolve AUTH-231 token refresh issue',
      description: 'PR #42 opened targeting main.',
      externalId: '42',
      externalUrl: 'https://github.com/timerecon/app/pull/42',
      workItemExternalId: '42',
      metadata: { prNumber: 42, repo: 'timerecon/app', jiraKey: 'AUTH-231' },
    },
    {
      provider: 'github',
      eventType: 'pr_review',
      occurredAt: new Date('2026-08-10T11:00:00Z'),
      title: 'Reviewed PR #38: Refactor database client',
      description: 'Approved changes with comments on pool settings.',
      externalId: 'rev-38-1',
      externalUrl: 'https://github.com/timerecon/app/pull/38#pullrequestreview-1',
      workItemExternalId: '38',
      metadata: { prNumber: 38, repo: 'timerecon/app', reviewState: 'APPROVED' },
    },
    {
      provider: 'github',
      eventType: 'commit',
      occurredAt: new Date('2026-08-10T14:30:00Z'),
      title: 'Commit: feat(allocator): scoring matrix implementation for PROJ-101',
      description: 'Added candidate evidence weights and proximity scoring.',
      externalId: 'd82f3a1',
      externalUrl: 'https://github.com/timerecon/app/commit/d82f3a1',
      workItemExternalId: 'PROJ-101',
      metadata: { repo: 'timerecon/app', branch: 'feature/PROJ-101-scoring', sha: 'd82f3a1' },
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
