import prisma from '@/lib/db';

export interface RecordCorrectionInput {
  userId: string;
  allocationId: string;
  correctionType: 'reassign' | 'split' | 'merge' | 'confirm' | 'delete';
  originalData: Record<string, any>;
  correctedData: Record<string, any>;
}

/**
 * Records a user correction and upserts a UserLearning pattern.
 */
export async function recordUserCorrection(input: RecordCorrectionInput) {
  const { userId, allocationId, correctionType, originalData, correctedData } = input;

  // 1. Create or update UserCorrection record
  const correction = await prisma.userCorrection.upsert({
    where: { allocationId },
    create: {
      allocationId,
      correctionType,
      originalData,
      correctedData,
    },
    update: {
      correctionType,
      originalData,
      correctedData,
    },
  });

  // 2. Extract user learnings if workItem/project/pattern changed
  const originalTitle = (originalData.title || '').toString();
  const correctedTitle = (correctedData.title || '').toString();
  const correctedWorkItemKey = correctedData.workItemKey || correctedData.workItemId;

  if (correctedWorkItemKey) {
    if (originalData.allocationType === 'meeting' || correctedData.allocationType === 'meeting') {
      const pattern = originalTitle || correctedTitle;
      if (pattern) {
        await upsertUserLearning(userId, 'meeting_project', pattern.toLowerCase(), correctedWorkItemKey);
      }
    }

    if (originalData.repo || correctedData.repo) {
      const repoPattern = (originalData.repo || correctedData.repo).toString().toLowerCase();
      await upsertUserLearning(userId, 'repo_project', repoPattern, correctedWorkItemKey);
    }

    if (originalData.branch || correctedData.branch) {
      const branchPattern = (originalData.branch || correctedData.branch).toString().toLowerCase();
      await upsertUserLearning(userId, 'branch_workitem', branchPattern, correctedWorkItemKey);
    }
  }

  return correction;
}

/**
 * Upserts a UserLearning pattern, incrementing occurrences if it already exists.
 */
export async function upsertUserLearning(
  userId: string,
  learningType: string,
  pattern: string,
  resolution: string
) {
  const existing = await prisma.userLearning.findUnique({
    where: {
      userId_learningType_pattern: {
        userId,
        learningType,
        pattern,
      },
    },
  });

  if (existing) {
    return prisma.userLearning.update({
      where: { id: existing.id },
      data: {
        resolution,
        occurrences: existing.occurrences + 1,
        confidence: Math.min(1.0, existing.confidence + 0.1),
      },
    });
  }

  return prisma.userLearning.create({
    data: {
      userId,
      learningType,
      pattern,
      resolution,
      confidence: 1.0,
      occurrences: 1,
    },
  });
}

/**
 * Retrieves all learned patterns for a user.
 */
export async function getUserLearnings(userId: string) {
  return prisma.userLearning.findMany({
    where: { userId },
    orderBy: { occurrences: 'desc' },
  });
}

/**
 * Resets/deletes all learned patterns for a user.
 */
export async function resetUserLearnings(userId: string) {
  return prisma.userLearning.deleteMany({
    where: { userId },
  });
}
