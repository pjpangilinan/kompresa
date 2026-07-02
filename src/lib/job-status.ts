import type { JobStatus } from '../lib/types';

const activeStatuses = new Set<JobStatus>(['queued', 'probing', 'processing', 'verifying']);

export function isActive(status: JobStatus): boolean {
  return activeStatuses.has(status);
}
