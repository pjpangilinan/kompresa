import { useContext } from 'react';
import { JobsContext, type JobsContextValue } from '../context/jobs-context';

export function useJobsContext(): JobsContextValue {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error('useJobsContext must be used inside JobsProvider');
  return ctx;
}
