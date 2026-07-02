import { createContext } from 'react';
import type { Job } from '../lib/types';

export type JobsContextValue = {
  jobs: Job[];
  addJob: (job: Job) => void;
  updateJob: (jobId: string, patch: Partial<Job>) => void;
  removeJob: (jobId: string) => void;
  clearAll: () => void;
};

export const JobsContext = createContext<JobsContextValue | null>(null);
