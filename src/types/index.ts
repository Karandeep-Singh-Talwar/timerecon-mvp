// Core types shared between frontend and backend

export type Provider = 'jira' | 'github' | 'google_calendar';

export type EventType =
  | 'commit'
  | 'pr_opened'
  | 'pr_merged'
  | 'pr_review'
  | 'issue_updated'
  | 'issue_commented'
  | 'worklog'
  | 'calendar_event'
  | 'branch_activity';

export type AllocationType =
  | 'work_item'
  | 'meeting'
  | 'pr_review'
  | 'general_engineering'
  | 'admin'
  | 'unallocated';

export type ConfidenceLevel = 'high' | 'medium' | 'needs_review';

export type AllocationStatus = 'suggested' | 'approved' | 'edited' | 'split' | 'merged';

export type WorkSessionStatus = 'draft' | 'in_review' | 'approved';

export type CorrectionType = 'reassign' | 'split' | 'merge' | 'confirm' | 'delete';

export type EvidenceType =
  | 'direct_reference'
  | 'branch_match'
  | 'temporal_overlap'
  | 'repository_match'
  | 'calendar_match'
  | 'commit_message'
  | 'pr_relationship'
  | 'issue_activity'
  | 'user_learning'
  | 'continuity';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
