import { describe, it, expect } from 'vitest';
import {
  MockJiraConnector,
  MockGithubConnector,
  MockCalendarConnector,
  GithubConnector,
  IntegrationService,
} from '@/lib/connectors';

describe('Connectors & Integration Framework', () => {
  describe('MockJiraConnector', () => {
    const connector = new MockJiraConnector();

    it('has provider "jira"', () => {
      expect(connector.provider).toBe('jira');
    });

    it('fetches work items including AUTH-231 and BUG-442', async () => {
      const workItems = await connector.fetchWorkItems('user-1', new Date('2026-08-01'));
      expect(workItems.length).toBeGreaterThan(0);
      const authTicket = workItems.find((w) => w.externalId === 'AUTH-231');
      expect(authTicket).toBeDefined();
      expect(authTicket?.title).toContain('token refresh');
      expect(authTicket?.project).toBe('AUTH');
    });

    it('fetches Jira events (worklogs, comments)', async () => {
      const events = await connector.fetchEvents('user-1', new Date('2026-08-01'));
      expect(events.length).toBeGreaterThan(0);
      const worklog = events.find((e) => e.eventType === 'worklog');
      expect(worklog).toBeDefined();
      expect(worklog?.workItemExternalId).toBe('AUTH-231');
    });
  });

  describe('MockGithubConnector', () => {
    const connector = new MockGithubConnector();

    it('has provider "github"', () => {
      expect(connector.provider).toBe('github');
    });

    it('fetches PR work items', async () => {
      const workItems = await connector.fetchWorkItems('user-1', new Date('2026-08-01'));
      expect(workItems.length).toBeGreaterThan(0);
      const pr = workItems.find((w) => w.externalId === '42');
      expect(pr).toBeDefined();
      expect(pr?.itemType).toBe('pr');
    });

    it('fetches GitHub commit events containing Jira keys', async () => {
      const events = await connector.fetchEvents('user-1', new Date('2026-08-01'));
      expect(events.length).toBeGreaterThan(0);
      const commit = events.find((e) => e.eventType === 'commit' && e.workItemExternalId === 'AUTH-231');
      expect(commit).toBeDefined();
    });
  });

  describe('MockCalendarConnector', () => {
    const connector = new MockCalendarConnector();

    it('has provider "google_calendar"', () => {
      expect(connector.provider).toBe('google_calendar');
    });

    it('returns empty array for work items', async () => {
      const workItems = await connector.fetchWorkItems('user-1', new Date());
      expect(workItems).toEqual([]);
    });

    it('fetches mock calendar events (Standup, Sprint Planning)', async () => {
      const since = new Date('2026-08-10T00:00:00Z');
      const events = await connector.fetchEvents('user-1', since);
      expect(events.length).toBeGreaterThan(0);
      const standup = events.find((e) => e.title === 'Team Standup');
      expect(standup).toBeDefined();
      expect(standup?.duration).toBe(30);
    });
  });

  describe('GithubConnector Utilities', () => {
    it('correctly extracts Jira key from commit messages and branch names', () => {
      expect(GithubConnector.extractJiraKey('fix(auth): resolve AUTH-231 token refresh')).toBe('AUTH-231');
      expect(GithubConnector.extractJiraKey('feature/PROJ-101-scoring')).toBe('PROJ-101');
      expect(GithubConnector.extractJiraKey('refactor: clean up css')).toBeUndefined();
    });
  });

  describe('IntegrationService Connector Factory', () => {
    it('returns mock connector instances when useMock is true', () => {
      const jira = IntegrationService.getConnector('jira', true);
      expect(jira).toBeInstanceOf(MockJiraConnector);

      const github = IntegrationService.getConnector('github', true);
      expect(github).toBeInstanceOf(MockGithubConnector);

      const cal = IntegrationService.getConnector('google_calendar', true);
      expect(cal).toBeInstanceOf(MockCalendarConnector);
    });
  });
});
