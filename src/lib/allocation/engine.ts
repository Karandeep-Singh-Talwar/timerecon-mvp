import prisma from '@/lib/db';
import { generateTimeSegments, TimeSegment } from '@/lib/timeline';
import { scoreCandidatesForSegment, CandidateScore } from '@/lib/allocation/candidate';
import { EvidenceSignal } from '@/lib/confidence';
import { reasonAmbiguousSegment } from '@/lib/ai';
import { v4 as uuidv4 } from 'uuid';

export interface ReconstructOptions {
  userId: string;
  date: string; // YYYY-MM-DD
  force?: boolean;
}

function signalHasDirectEventSupport(
  event: TimeSegment['events'][number],
  candidate: CandidateScore,
  signal: EvidenceSignal
): boolean {
  const key = candidate.workItemKey?.toUpperCase();
  const title = event.title.toUpperCase();
  const metadata = JSON.stringify(event.metadata || {}).toUpperCase();
  const directlyLinked = Boolean(candidate.workItemId && event.workItemId === candidate.workItemId);

  switch (signal.type) {
    case 'direct_jira_reference':
      return directlyLinked || Boolean(key && (title.includes(key) || metadata.includes(key)));
    case 'branch_match':
      return Boolean(key && metadata.includes(key));
    case 'repository_match':
      return Boolean(candidate.project && metadata.includes(candidate.project.toUpperCase()));
    case 'pr_relationship':
      return event.eventType.startsWith('pr_') && (directlyLinked || Boolean(key && title.includes(key)));
    case 'commit_message':
      return event.eventType === 'commit' && (directlyLinked || Boolean(key && title.includes(key)));
    case 'issue_activity':
      return (event.eventType.startsWith('issue_') || event.eventType === 'worklog') && directlyLinked;
    case 'calendar_match':
      return event.eventType === 'calendar_event' || event.provider === 'google_calendar';
    // These are inference signals, not raw evidence. They must never be presented as event evidence.
    case 'continuity':
    case 'user_learning':
      return false;
  }
}

export async function reconstructWorkday(options: ReconstructOptions) {
  const { userId, date } = options;

  // 1. Fetch user to get timezone / working hours
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // 2. Generate temporal segments
  const segments = await generateTimeSegments({
    userId,
    date,
    workingHoursStart: user.workingHoursStart,
    workingHoursEnd: user.workingHoursEnd,
    timezone: user.timezone,
  });

  // 3. Fetch WorkItems and UserLearnings
  const workItems = await prisma.workItem.findMany({
    where: { userId },
  });

  const userLearnings = await prisma.userLearning.findMany({
    where: { userId },
  });

  // 4. Fetch existing session & user modified allocations
  const targetDate = new Date(`${date}T00:00:00.000Z`);
  const existingSession = await prisma.workSession.findUnique({
    where: {
      userId_date: {
        userId,
        date: targetDate,
      },
    },
    include: {
      allocations: true,
    },
  });

  const modifiedAllocations = existingSession?.allocations.filter((a) => a.isUserModified) || [];

  const tasks = segments.map((seg, i) => async () => {
    // Check if segment overlaps a user-modified allocation
    const modifiedMatch = modifiedAllocations.find(
      (m) =>
        (m.startTime >= seg.startTime && m.startTime < seg.endTime) ||
        (m.endTime > seg.startTime && m.endTime <= seg.endTime)
    );

    if (modifiedMatch) {
      return {
        startTime: modifiedMatch.startTime,
        endTime: modifiedMatch.endTime,
        durationMinutes: modifiedMatch.durationMinutes,
        allocationType: modifiedMatch.allocationType,
        workItemId: modifiedMatch.workItemId || undefined,
        title: modifiedMatch.title,
        description: modifiedMatch.description || undefined,
        confidence: modifiedMatch.confidence,
        confidenceLevel: modifiedMatch.confidenceLevel,
        status: modifiedMatch.status,
        isUserModified: true,
        evidence: [],
      };
    }

    const candidates = scoreCandidatesForSegment(seg, workItems, userLearnings, undefined);
    const topCandidate = candidates[0];

    let finalAllocation: {
      allocationType: string;
      workItemId?: string;
      title: string;
      confidence: number;
      confidenceLevel: string;
      description?: string;
    };

    if (
      !topCandidate ||
      topCandidate.confidenceScore < 0.80 ||
      (candidates[1] && topCandidate.confidenceScore - candidates[1].confidenceScore < 0.15)
    ) {
      // Ambiguous case -> run AI / heuristic disambiguation
      const aiResult = await reasonAmbiguousSegment(seg, candidates, undefined, userLearnings);
      finalAllocation = {
        allocationType: aiResult.allocationType,
        workItemId: aiResult.workItemId,
        title: aiResult.title,
        confidence: aiResult.confidence,
        confidenceLevel: aiResult.confidenceLevel,
        description: aiResult.reasoning,
      };
    } else {
      finalAllocation = {
        allocationType: topCandidate.allocationType,
        workItemId: topCandidate.workItemId,
        title: topCandidate.title,
        confidence: topCandidate.confidenceScore,
        confidenceLevel: topCandidate.confidenceLevel,
        description: topCandidate.signals.map((s) => s.explanation).join('; '),
      };
    }

    const evidenceItems = seg.events.flatMap((ev) => {
      if (!topCandidate || topCandidate.signals.length === 0) return [];
      return topCandidate.signals.filter((sig) => signalHasDirectEventSupport(ev, topCandidate, sig)).map((sig) => ({
        normalizedEventId: ev.id,
        evidenceType: sig.type,
        strength: sig.strength,
        explanation: sig.explanation,
      }));
    });

    return {
      startTime: seg.startTime,
      endTime: seg.endTime,
      durationMinutes: seg.durationMinutes,
      allocationType: finalAllocation.allocationType,
      workItemId: finalAllocation.workItemId,
      title: finalAllocation.title,
      description: finalAllocation.description,
      confidence: finalAllocation.confidence,
      confidenceLevel: finalAllocation.confidenceLevel,
      status: 'suggested',
      isUserModified: false,
      evidence: evidenceItems,
    };
  });

  const allocationPayloads = await Promise.all(tasks.map((t) => t()));

  let totalMinutes = 0;
  let allocatedMinutes = 0;
  let unallocatedMinutes = 0;

  allocationPayloads.forEach((payload, i) => {
    totalMinutes += segments[i].durationMinutes;
    if (payload.isUserModified) {
       allocatedMinutes += payload.durationMinutes;
    } else {
       if (payload.confidenceLevel === 'high' || payload.confidenceLevel === 'medium') {
         allocatedMinutes += payload.durationMinutes;
       } else {
         unallocatedMinutes += payload.durationMinutes;
       }
    }
  });

  const sessionStartTime = segments[0]?.startTime || new Date(`${date}T09:00:00.000Z`);
  const sessionEndTime = segments[segments.length - 1]?.endTime || new Date(`${date}T17:30:00.000Z`);

  // 6. DB Transaction
  const workSession = await prisma.$transaction(async (tx) => {
    const session = await tx.workSession.upsert({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
      create: {
        userId,
        date: targetDate,
        startTime: sessionStartTime,
        endTime: sessionEndTime,
        totalMinutes,
        allocatedMinutes,
        unallocatedMinutes,
        status: 'draft',
      },
      update: {
        startTime: sessionStartTime,
        endTime: sessionEndTime,
        totalMinutes,
        allocatedMinutes,
        unallocatedMinutes,
      },
    });

    // Delete non-user-modified allocations
    await tx.allocation.deleteMany({
      where: {
        workSessionId: session.id,
        isUserModified: false,
      },
    });

    // Create new allocations and evidence
    const allocationsToCreate = [];
    const evidenceToCreate: any[] = [];

    for (let sortOrder = 0; sortOrder < allocationPayloads.length; sortOrder++) {
      const payload = allocationPayloads[sortOrder];
      if (payload.isUserModified) continue; // Already preserved

      const allocId = uuidv4();
      allocationsToCreate.push({
        id: allocId,
        workSessionId: session.id,
        startTime: payload.startTime,
        endTime: payload.endTime,
        durationMinutes: payload.durationMinutes,
        allocationType: payload.allocationType,
        workItemId: payload.workItemId,
        title: payload.title,
        description: payload.description,
        confidence: payload.confidence,
        confidenceLevel: payload.confidenceLevel,
        status: payload.status,
        isUserModified: false,
        sortOrder,
      });

      if (payload.evidence.length > 0) {
        evidenceToCreate.push(
          ...payload.evidence.map((ev) => ({
            allocationId: allocId,
            normalizedEventId: ev.normalizedEventId,
            evidenceType: ev.evidenceType,
            strength: ev.strength,
            explanation: ev.explanation,
          }))
        );
      }
    }

    if (allocationsToCreate.length > 0) {
      await tx.allocation.createMany({ data: allocationsToCreate });
    }
    if (evidenceToCreate.length > 0) {
      await tx.allocationEvidence.createMany({ data: evidenceToCreate });
    }

    return tx.workSession.findUnique({
      where: { id: session.id },
      include: {
        allocations: {
          orderBy: { startTime: 'asc' },
          include: {
            workItem: true,
            evidence: {
              include: {
                normalizedEvent: true,
              },
            },
          },
        },
      },
    });
  });

  return workSession;
}

export async function reconstructWorkSession(userId: string, date: string, force?: boolean) {
  return reconstructWorkday({ userId, date, force });
}
