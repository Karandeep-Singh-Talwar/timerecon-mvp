import { Queue, QueueOptions } from 'bullmq';
import { IntegrationProvider } from '@/lib/connectors/types';

const connection = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : { host: '127.0.0.1', port: 6379 };

export const syncQueue = new Queue('sync-queue', { connection });

export async function enqueueSyncJob(
  userId: string,
  provider: IntegrationProvider,
  options?: { useMock?: boolean; since?: Date }
) {
  return await syncQueue.add('sync-job', { userId, provider, options });
}
