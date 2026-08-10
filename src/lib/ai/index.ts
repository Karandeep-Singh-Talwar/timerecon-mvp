import { TimeSegment } from '@/lib/timeline';
import { CandidateScore } from '@/lib/allocation/candidate';
import { UserLearning } from '@prisma/client';

export interface AIReasoningResult {
  allocationType: 'work_item' | 'meeting' | 'pr_review' | 'general_engineering' | 'admin' | 'unallocated';
  workItemId?: string;
  workItemKey?: string;
  title: string;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'needs_review';
  reasoning: string;
}

/**
 * Disambiguates an ambiguous time segment using Gemini AI or fallback heuristics.
 */
export async function reasonAmbiguousSegment(
  segment: TimeSegment,
  candidates: CandidateScore[],
  surroundingContext?: string,
  userLearnings: UserLearning[] = []
): Promise<AIReasoningResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const topCandidate = candidates[0];
      const durationMinutes = segment.durationMinutes;
      const startTime = segment.startTime.toISOString();
      const endTime = segment.endTime.toISOString();

      const candidateText = candidates
        .map(
          (c) =>
            `- ${c.workItemKey || 'N/A'} (${c.allocationType}): ${c.title}\n  Evidence: ${
              c.signals.map((s) => s.explanation).join('; ') || 'None'
            }\n  Score: ${c.confidenceScore}`
        )
        .join('\n');

      const learningsText = userLearnings
        .map((l) => `- ${l.pattern} -> ${l.resolution}`)
        .join('\n');

      const prompt = `You are a timesheet assistant helping a software developer reconstruct their workday.

Given the following context for a ${durationMinutes}-minute period (${startTime} to ${endTime}):

CANDIDATE WORK ITEMS:
${candidateText || 'No clear candidates.'}

SURROUNDING CONTEXT:
${surroundingContext || 'Normal engineering activity.'}

USER'S LEARNED PREFERENCES:
${learningsText || 'None.'}

Respond strictly in JSON format with the following structure:
{
  "allocation": "WORK_ITEM_KEY or MEETING or UNALLOCATED",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}

Rules:
- If you cannot determine with >50% confidence, respond with "UNALLOCATED"
- Do NOT fabricate evidence
- Maximum confidence score for AI reasoning without deterministic evidence is 0.75
- Prefer the simplest explanation`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonText) {
          const parsed = JSON.parse(jsonText);
          const rawConf = typeof parsed.confidence === 'number' ? parsed.confidence : 0.6;
          // AI confidence capped at max 0.75 if no deterministic evidence corroborates it
          const cappedConf = Math.min(rawConf, 0.75);

          if (parsed.allocation === 'UNALLOCATED' || cappedConf < 0.5) {
            return {
              allocationType: 'unallocated',
              title: 'Unallocated Time',
              confidence: cappedConf,
              confidenceLevel: 'needs_review',
              reasoning: parsed.reasoning || 'AI could not confidently allocate this segment.',
            };
          }

          const matchedCand = candidates.find((c) => c.workItemKey === parsed.allocation);
          if (matchedCand) {
            return {
              allocationType: matchedCand.allocationType,
              workItemId: matchedCand.workItemId,
              workItemKey: matchedCand.workItemKey,
              title: matchedCand.title,
              confidence: cappedConf,
              confidenceLevel: cappedConf >= 0.5 ? 'medium' : 'needs_review',
              reasoning: parsed.reasoning || 'Disambiguated via AI analysis.',
            };
          }
        }
      }
    } catch (error) {
      console.warn('Gemini API call failed, falling back to heuristic reasoning:', error);
    }
  }

  // Fallback Heuristic Reasoning
  const topCandidate = candidates[0];
  if (topCandidate && (topCandidate.workItemId || topCandidate.confidenceScore >= 0.5 || topCandidate.allocationType === 'pr_review')) {
    return {
      allocationType: topCandidate.allocationType,
      workItemId: topCandidate.workItemId,
      workItemKey: topCandidate.workItemKey,
      title: topCandidate.title,
      confidence: topCandidate.confidenceScore,
      confidenceLevel: topCandidate.confidenceLevel,
      reasoning: `Selected candidate based on evidence score: ${topCandidate.signals.map((s) => s.explanation).join(', ') || 'Heuristic candidate match'}`,
    };
  }

  return {
    allocationType: 'unallocated',
    title: topCandidate?.title || 'Unallocated Time',
    confidence: topCandidate ? topCandidate.confidenceScore : 0.0,
    confidenceLevel: 'needs_review',
    reasoning: 'Insufficient deterministic evidence to allocate confidently.',
  };
}
