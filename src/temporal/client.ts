import { Client, Connection } from '@temporalio/client';
import { TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE, TEMPORAL_TASK_QUEUE } from './config';
import type { IntegrationProvider } from '@/lib/connectors/types';

let clientPromise: Promise<Client> | null = null;

async function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
      return new Client({ connection, namespace: TEMPORAL_NAMESPACE });
    })();
  }
  return clientPromise;
}

export async function startIntegrationSync(params: {
  userId: string;
  provider: IntegrationProvider;
  useMock?: boolean;
  since?: Date;
}) {
  const client = await getClient();
  const workflowId = `sync:${params.userId}:${params.provider}`;
  return client.workflow.start('integrationSyncWorkflow', {
    taskQueue: TEMPORAL_TASK_QUEUE,
    workflowId,
    args: [
      {
        userId: params.userId,
        provider: params.provider,
        useMock: params.useMock,
        since: params.since?.toISOString(),
      },
    ],
    workflowIdConflictPolicy: 'TERMINATE_EXISTING',
  });
}

export async function startWorkdayReconstruct(params: {
  userId: string;
  date: string;
  force?: boolean;
}) {
  const client = await getClient();
  const workflowId = `reconstruct:${params.userId}:${params.date}`;
  return client.workflow.start('workdayReconstructWorkflow', {
    taskQueue: TEMPORAL_TASK_QUEUE,
    workflowId,
    args: [
      {
        userId: params.userId,
        date: params.date,
        force: params.force,
      },
    ],
    workflowIdConflictPolicy: 'TERMINATE_EXISTING',
  });
}

export async function getWorkflowStatus(workflowId: string) {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId);
  const description = await handle.describe();
  let result: unknown = null;
  if (description.status.name === 'COMPLETED') {
    result = await handle.result();
  }
  return {
    workflowId,
    status: description.status.name,
    result,
  };
}
