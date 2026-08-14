import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';
import { TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE, TEMPORAL_TASK_QUEUE } from './config';

async function run() {
  const connection = await NativeConnection.connect({ address: TEMPORAL_ADDRESS });
  const workflowsPath = require.resolve('./workflows');

  const worker = await Worker.create({
    connection,
    namespace: TEMPORAL_NAMESPACE,
    taskQueue: TEMPORAL_TASK_QUEUE,
    workflowsPath,
    activities,
  });

  console.log(
    `[Temporal] Worker started queue=${TEMPORAL_TASK_QUEUE} address=${TEMPORAL_ADDRESS} ns=${TEMPORAL_NAMESPACE}`
  );
  await worker.run();
}

run().catch((err) => {
  console.error('[Temporal] Worker failed:', err);
  process.exit(1);
});
