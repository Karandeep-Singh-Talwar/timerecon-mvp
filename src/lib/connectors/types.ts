export type IntegrationProvider = 'jira' | 'github' | 'google_calendar';

export interface BaseWorkItem {
  externalId: string;
  provider: IntegrationProvider;
  title: string;
  description?: string;
  status?: string;
  project?: string;
  itemType?: string;
  externalUrl?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export type EventType =
  | 'commit'
  | 'pr_opened'
  | 'pr_review'
  | 'pr_merged'
  | 'issue_updated'
  | 'issue_commented'
  | 'worklog'
  | 'calendar_event'
  | 'branch_activity';

export interface RawEvent {
  provider: IntegrationProvider;
  eventType: EventType;
  occurredAt: Date;
  endedAt?: Date;
  duration?: number; // duration in minutes
  title: string;
  description?: string;
  externalId?: string;
  externalUrl?: string;
  workItemExternalId?: string;
  metadata?: Record<string, any>;
}

export interface Connector {
  provider: IntegrationProvider;
  fetchWorkItems(userId: string, since: Date): Promise<BaseWorkItem[]>;
  fetchEvents(userId: string, since: Date): Promise<RawEvent[]>;
}
