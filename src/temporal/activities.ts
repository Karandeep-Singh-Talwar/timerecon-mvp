import { IntegrationService } from '@/lib/connectors/service';
import { IntegrationProvider } from '@/lib/connectors/types';
import { reconstructWorkday } from '@/lib/allocation';

export interface SyncIntegrationInput {
  userId: string;
  provider: IntegrationProvider;
  useMock?: boolean;
  since?: string; // ISO string — activities must be JSON-serializable
}

export interface ReconstructWorkdayInput {
  userId: string;
  date: string;
  force?: boolean;
}

export async function syncIntegrationActivity(input: SyncIntegrationInput) {
  return IntegrationService.syncIntegration(input.userId, input.provider, {
    useMock: input.useMock,
    since: input.since ? new Date(input.since) : undefined,
  });
}

export async function reconstructWorkdayActivity(input: ReconstructWorkdayInput) {
  const session = await reconstructWorkday({
    userId: input.userId,
    date: input.date,
    force: input.force,
  });
  return {
    workSessionId: session?.id,
    date: input.date,
    totalMinutes: session?.totalMinutes,
    allocatedMinutes: session?.allocatedMinutes,
    unallocatedMinutes: session?.unallocatedMinutes,
    allocationCount: session?.allocations?.length ?? 0,
  };
}
