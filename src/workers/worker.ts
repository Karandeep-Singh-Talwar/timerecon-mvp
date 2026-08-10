import { Worker, Job } from 'bullmq';
import { IntegrationService } from '../lib/connectors/service';
import { IntegrationProvider } from '../lib/connectors/types';
import dotenv from 'dotenv';
dotenv.config();

const connection = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : { host: '127.0.0.1', port: 6379 };

const worker = new Worker(
  'sync-queue',
  async (job: Job) => {
    const { userId, provider, options } = job.data as {
      userId: string;
      provider: IntegrationProvider;
      options?: { useMock?: boolean; since?: string };
    };

    console.log(`[Worker] Starting sync for user ${userId}, provider ${provider}`);
    const sinceDate = options?.since ? new Date(options.since) : undefined;

    try {
      const result = await IntegrationService.syncIntegration(userId, provider, {
        ...options,
        since: sinceDate,
      });
      console.log(`[Worker] Sync complete for ${provider}:`, result);
      return result;
    } catch (error) {
      console.error(`[Worker] Error syncing ${provider}:`, error);
      throw error;
    }
  },
  { connection }
);

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

console.log('[Worker] Started sync worker');
