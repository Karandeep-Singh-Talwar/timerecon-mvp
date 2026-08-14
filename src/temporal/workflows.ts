import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities';

const { syncIntegrationActivity, reconstructWorkdayActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '2s',
    backoffCoefficient: 2,
    maximumAttempts: 5,
  },
});

export async function integrationSyncWorkflow(input: {
  userId: string;
  provider: 'jira' | 'github' | 'google_calendar';
  useMock?: boolean;
  since?: string;
}) {
  return await syncIntegrationActivity(input);
}

export async function workdayReconstructWorkflow(input: {
  userId: string;
  date: string;
  force?: boolean;
}) {
  return await reconstructWorkdayActivity(input);
}
