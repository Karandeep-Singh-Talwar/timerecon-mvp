export type EvidenceSignalType =
  | 'direct_jira_reference'
  | 'branch_match'
  | 'calendar_match'
  | 'repository_match'
  | 'pr_relationship'
  | 'commit_message'
  | 'issue_activity'
  | 'user_learning'
  | 'continuity';

export interface EvidenceSignal {
  type: EvidenceSignalType;
  weight: number;
  strength: number; // 0.0 - 1.0
  explanation: string;
}

export const SIGNAL_WEIGHTS: Record<EvidenceSignalType, number> = {
  direct_jira_reference: 0.30,
  branch_match: 0.20,
  calendar_match: 0.25,
  repository_match: 0.15,
  pr_relationship: 0.20,
  commit_message: 0.15,
  issue_activity: 0.15,
  user_learning: 0.20,
  continuity: 0.10,
};

export type ConfidenceLevel = 'high' | 'medium' | 'needs_review';

export interface ConfidenceResult {
  score: number;
  level: ConfidenceLevel;
}

/**
 * Calculates confidence score based on evidence signals and competing candidate gap.
 */
export function calculateConfidence(
  signals: EvidenceSignal[],
  competingScore?: number
): ConfidenceResult {
  if (!signals || signals.length === 0) {
    return { score: 0.0, level: 'needs_review' };
  }

  // Sum weighted signals
  let rawScore = signals.reduce((sum, s) => sum + s.weight * s.strength, 0);

  // Cap at 1.0
  let score = Math.min(rawScore, 1.0);

  // Apply competing candidate penalty: if top candidate - 2nd candidate < 0.15, score *= 0.7
  if (competingScore !== undefined && (score - competingScore) < 0.15) {
    score *= 0.7;
  }

  // Clamp score
  score = Math.max(0.0, Math.min(1.0, score));
  score = Math.round(score * 100) / 100;

  // Classify level: High (>= 0.80), Medium (0.50-0.79), Needs Review (< 0.50)
  let level: ConfidenceLevel = 'needs_review';
  if (score >= 0.80) {
    level = 'high';
  } else if (score >= 0.50) {
    level = 'medium';
  }

  return { score, level };
}
