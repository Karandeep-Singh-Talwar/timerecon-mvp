import { Queue, QueueOptions } from 'bullmq';
import { IntegrationProvider } from '@/lib/connectors/types';

let syncQueueInstance: Queue | null = null;

function getSyncQueue() {
  if (!syncQueueInstance) {
    const connection = process.env.REDIS_URL
      ? { url: process.env.REDIS_URL }
      : { host: '127.0.0.1', port: 6379 };
    syncQueueInstance = new Queue('sync-queue', { connection });
  }
  return syncQueueInstance;
}

export async function enqueueSyncJob(
  userId: string,
  provider: IntegrationProvider,
  options?: { useMock?: boolean; since?: Date }
) {
  return await getSyncQueue().add('sync-job', { userId, provider, options });
}
