import { WorkItem, UserLearning, NormalizedEvent } from '@prisma/client';
import { TimeSegment } from '@/lib/timeline';
import {
  EvidenceSignal,
  SIGNAL_WEIGHTS,
  calculateConfidence,
  ConfidenceLevel,
} from '@/lib/confidence';

export interface CandidateScore {
  workItemId?: string;
  workItemKey?: string;
  title: string;
  project?: string;
  allocationType: 'work_item' | 'meeting' | 'pr_review' | 'general_engineering' | 'admin' | 'unallocated';
  rawScore: number;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  signals: EvidenceSignal[];
}

const JIRA_KEY_REGEX = /([A-Z]{2,10}-\d+)/gi;

/**
 * Extracts all Jira keys found in events text/metadata.
 */
export function extractJiraKeysFromEvents(events: NormalizedEvent[]): string[] {
  const keys = new Set<string>();

  for (const ev of events) {
    const textToSearch = [
      ev.title,
      ev.description || '',
      JSON.stringify(ev.metadata || {}),
    ].join(' ');

    const matches = textToSearch.match(JIRA_KEY_REGEX);
    if (matches) {
      matches.forEach((k) => keys.add(k.toUpperCase()));
    }
  }

  return Array.from(keys);
}

/**
 * Generates candidate work items and scores them for a time segment.
 */
export function scoreCandidatesForSegment(
  segment: TimeSegment,
  workItems: WorkItem[],
  userLearnings: UserLearning[] = [],
  prevWorkItemId?: string,
  nextWorkItemId?: string
): CandidateScore[] {
  // If gap with no events
  if (segment.isGap && segment.events.length === 0) {
    return [
      {
        title: 'Unallocated Time',
        allocationType: 'unallocated',
        rawScore: 0,
        confidenceScore: 0.0,
        confidenceLevel: 'needs_review',
        signals: [],
      },
    ];
  }

  // If calendar anchored event
  if (segment.isCalendarAnchored && segment.events.length > 0) {
    const calEvent = segment.events[0];
    const signals: EvidenceSignal[] = [
      {
        type: 'calendar_match',
        weight: 0.85,
        strength: 1.0,
        explanation: `Calendar event: "${calEvent.title}"`,
      },
    ];

    // Check user learning for meeting -> project / workItem
    const meetingLearning = userLearnings.find(
      (l) => l.learningType === 'meeting_project' && calEvent.title.toLowerCase().includes(l.pattern.toLowerCase())
    );

    let candidateWorkItem = workItems.find(
      (w) =>
        calEvent.workItemId === w.id ||
        (calEvent.title && (calEvent.title.includes(w.externalId) || calEvent.title.includes(w.title)))
    );

    if (meetingLearning) {
      signals.push({
        type: 'user_learning',
        weight: SIGNAL_WEIGHTS.user_learning,
        strength: 1.0,
        explanation: `Learned pattern: "${meetingLearning.pattern}" maps to "${meetingLearning.resolution}"`,
      });
      const learnedItem = workItems.find(
        (w) => w.externalId.toUpperCase() === meetingLearning.resolution.toUpperCase() || w.id === meetingLearning.resolution
      );
      if (learnedItem) candidateWorkItem = learnedItem;
    }

    const { score, level } = calculateConfidence(signals);

    return [
      {
        workItemId: candidateWorkItem?.id,
        workItemKey: candidateWorkItem?.externalId,
        title: calEvent.title || 'Meeting',
        project: candidateWorkItem?.project || undefined,
        allocationType: 'meeting',
        rawScore: score,
        confidenceScore: score,
        confidenceLevel: level,
        signals,
      },
    ];
  }

  // For non-calendar segments: evaluate each workItem + fallback
  const extractedKeys = extractJiraKeysFromEvents(segment.events);
  const candidateScores: CandidateScore[] = [];

  for (const workItem of workItems) {
    const signals: EvidenceSignal[] = [];
    const itemKey = workItem.externalId.toUpperCase();

    // 1. Direct Jira Reference (0.30)
    const hasDirectRef = segment.events.some((ev) => {
      const titleUpper = ev.title.toUpperCase();
      const metaStr = JSON.stringify(ev.metadata || {}).toUpperCase();
      return ev.workItemId === workItem.id || titleUpper.includes(itemKey) || metaStr.includes(itemKey);
    });
    if (hasDirectRef) {
      signals.push({
        type: 'direct_jira_reference',
        weight: SIGNAL_WEIGHTS.direct_jira_reference,
        strength: 1.0,
        explanation: `Direct reference to ${itemKey} in commit/PR/event text`,
      });
    }

    // 2. Branch Match (0.20)
    const hasBranchMatch = segment.events.some((ev) => {
      if (!ev.metadata || typeof ev.metadata !== 'object') return false;
      const meta = ev.metadata as Record<string, any>;
      const branch = (meta.branch || meta.branchName || '').toUpperCase();
      return branch.includes(itemKey);
    });
    if (hasBranchMatch) {
      signals.push({
        type: 'branch_match',
        weight: SIGNAL_WEIGHTS.branch_match,
        strength: 1.0,
        explanation: `Branch name matches ${itemKey}`,
      });
    }

    // 3. Repository Match (0.15)
    const hasRepoMatch = segment.events.some((ev) => {
      if (!ev.metadata || typeof ev.metadata !== 'object') return false;
      const meta = ev.metadata as Record<string, any>;
      const repo = (meta.repo || meta.repository || '').toLowerCase();
      return workItem.project && repo.includes(workItem.project.toLowerCase());
    });
    if (hasRepoMatch) {
      signals.push({
        type: 'repository_match',
        weight: SIGNAL_WEIGHTS.repository_match,
        strength: 0.8,
        explanation: `Repository matches project ${workItem.project}`,
      });
    }

    // 4. PR Relationship (0.20)
    const hasPRRel = segment.events.some(
      (ev) => ev.eventType.startsWith('pr_') && (ev.workItemId === workItem.id || ev.title.toUpperCase().includes(itemKey))
    );
    if (hasPRRel) {
      signals.push({
        type: 'pr_relationship',
        weight: SIGNAL_WEIGHTS.pr_relationship,
        strength: 1.0,
        explanation: `Pull Request activity linked to ${itemKey}`,
      });
    }

    // 5. Commit Message (0.15)
    const hasCommitMatch = segment.events.some((ev) => {
      if (ev.eventType !== 'commit') return false;
      const titleUpper = ev.title.toUpperCase();
      const workTitleLower = workItem.title.toLowerCase();
      return (
        ev.workItemId === workItem.id ||
        titleUpper.includes(itemKey) ||
        titleUpper.toLowerCase().includes(workTitleLower) ||
        (workTitleLower.length > 5 && workTitleLower.includes(ev.title.toLowerCase()))
      );
    });
    if (hasCommitMatch) {
      signals.push({
        type: 'commit_message',
        weight: SIGNAL_WEIGHTS.commit_message,
        strength: 0.8,
        explanation: `Commit message matches work item title or issue key`,
      });
    }

    // 6. Issue Activity (0.15)
    const hasIssueActivity = segment.events.some(
      (ev) =>
        (ev.eventType.startsWith('issue_') || ev.eventType === 'worklog') &&
        (ev.workItemId === workItem.id || ev.title.toUpperCase().includes(itemKey))
    );
    if (hasIssueActivity) {
      signals.push({
        type: 'issue_activity',
        weight: SIGNAL_WEIGHTS.issue_activity,
        strength: 1.0,
        explanation: `Jira issue update/comment for ${itemKey}`,
      });
    }

    // 7. User Learning (0.20)
    const matchedLearning = userLearnings.find(
      (l) =>
        (l.learningType === 'repo_project' || l.learningType === 'branch_workitem') &&
        l.resolution.toUpperCase() === itemKey
    );
    if (matchedLearning) {
      signals.push({
        type: 'user_learning',
        weight: SIGNAL_WEIGHTS.user_learning,
        strength: 1.0,
        explanation: `User learning pattern matched for ${itemKey}`,
      });
    }

    // 8. Continuity (0.10)
    if (workItem.id === prevWorkItemId || workItem.id === nextWorkItemId) {
      signals.push({
        type: 'continuity',
        weight: SIGNAL_WEIGHTS.continuity,
        strength: 1.0,
        explanation: `Temporal continuity with adjacent segment (${itemKey})`,
      });
    }

    if (signals.length > 0) {
      const rawScore = signals.reduce((s, sig) => s + sig.weight * sig.strength, 0);
      const allocationType = segment.events.some((e) => e.eventType === 'pr_review')
        ? 'pr_review'
        : 'work_item';

      candidateScores.push({
        workItemId: workItem.id,
        workItemKey: workItem.externalId,
        title: workItem.title,
        project: workItem.project || undefined,
        allocationType,
        rawScore,
        confidenceScore: rawScore, // Will be refined with competing score
        confidenceLevel: 'needs_review',
        signals,
      });
    }
  }

  // Sort candidate scores descending by rawScore
  candidateScores.sort((a, b) => b.rawScore - a.rawScore);

  // Apply competing score penalty using calculateConfidence
  for (let i = 0; i < candidateScores.length; i++) {
    const competingScore = candidateScores[i + 1]?.rawScore;
    const conf = calculateConfidence(candidateScores[i].signals, competingScore);
    candidateScores[i].confidenceScore = conf.score;
    candidateScores[i].confidenceLevel = conf.level;
  }

  // Fallback candidate if no candidate scored
  if (candidateScores.length === 0) {
    const firstEv = segment.events[0];
    const isPR = segment.events.some((e) => e.eventType.startsWith('pr_') || e.eventType === 'pr_review');
    const allocationType = isPR ? 'pr_review' : 'general_engineering';
    candidateScores.push({
      title: firstEv ? firstEv.title : 'Engineering Activity',
      allocationType,
      rawScore: isPR ? 0.6 : 0.3,
      confidenceScore: isPR ? 0.6 : 0.3,
      confidenceLevel: isPR ? 'medium' : 'needs_review',
      signals: [],
    });
  }

  return candidateScores;
}
