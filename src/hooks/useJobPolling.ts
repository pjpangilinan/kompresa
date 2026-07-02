import { useEffect, useRef, useState } from 'react';
import { getJob } from '../api/jobs';
import type { Job } from '../lib/types';

const POLL_INTERVAL_MS = 2000;
const SLOW_DOWN_AFTER_MS = 30000;

type UseJobPollingResult = {
  job: Job | null;
  error: Error | null;
  isPolling: boolean;
};

export function useJobPolling(jobId: string | null): UseJobPollingResult {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    const currentJobId = jobId;
    startedAtRef.current = Date.now();
    let cancelled = false;
    const controller = new AbortController();

    async function tick() {
      if (cancelled) return;
      try {
        const data = await getJob(currentJobId, controller.signal);
        if (cancelled) return;
        setJob(data);
        if (data.status === 'completed' || data.status === 'failed') {
          return;
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err : new Error(String(err)));
        return;
      }

      const elapsed = Date.now() - startedAtRef.current;
      const delay = elapsed > SLOW_DOWN_AFTER_MS ? POLL_INTERVAL_MS * 2 : POLL_INTERVAL_MS;
      setTimeout(tick, delay);
    }

    tick();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [jobId]);

  return {
    job,
    error,
    isPolling: job !== null && job.status !== 'completed' && job.status !== 'failed',
  };
}
