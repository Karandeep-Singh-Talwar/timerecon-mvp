export const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
export const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';
export const TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'timerecon';

export function useTemporalJobs(): boolean {
  return process.env.USE_TEMPORAL === 'true';
}
