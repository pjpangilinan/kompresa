import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Job } from '../lib/types';
import { JobsContext, type JobsContextValue } from './jobs-context';

const STORAGE_KEY = 'kompressa.jobs.v1';

function loadJobs(): Job[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Job[]) : [];
  } catch {
    return [];
  }
}

function saveJobs(jobs: Job[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
  }
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(() => loadJobs());

  useEffect(() => {
    saveJobs(jobs);
  }, [jobs]);

  const addJob = useCallback((job: Job) => {
    setJobs((prev) => {
      const filtered = prev.filter((j) => j.job_id !== job.job_id);
      return [job, ...filtered].slice(0, 20);
    });
  }, []);

  const updateJob = useCallback((jobId: string, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.job_id === jobId ? { ...j, ...patch } : j)));
  }, []);

  const removeJob = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.job_id !== jobId));
  }, []);

  const clearAll = useCallback(() => {
    setJobs([]);
  }, []);

  const value: JobsContextValue = { jobs, addJob, updateJob, removeJob, clearAll };

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}
