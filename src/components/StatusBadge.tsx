import type { JobStatus } from '../lib/types';
import { isActive } from '../lib/job-status';

const labels: Record<JobStatus, string> = {
  queued: 'QUEUED',
  probing: 'PROBING',
  processing: 'COMPRESSING',
  verifying: 'VERIFYING',
  completed: 'COMPLETE',
  failed: 'FAILED',
};

export function StatusBadge({ status, compact = false }: { status: JobStatus; compact?: boolean }) {
  const styles: Record<JobStatus, string> = {
    queued: 'bg-warning-container text-warning border border-warning',
    probing: 'bg-warning-container text-warning border border-warning',
    processing: 'bg-primary-fixed-dim text-on-primary-fixed border border-primary-fixed',
    verifying: 'bg-tertiary-container text-on-tertiary-container border border-tertiary',
    completed: 'bg-success-container text-success border border-success',
    failed: 'bg-error-container text-error border border-error',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-label-mono uppercase tracking-widest ${
        compact ? 'text-[10px] px-1.5 py-0.5' : 'text-label-mono px-2 py-1'
      } ${styles[status]}`}
    >
      {isActive(status) ? (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            status === 'processing' || status === 'probing' || status === 'verifying'
              ? 'bg-primary-container animate-pulse'
              : 'bg-warning'
          }`}
          aria-hidden="true"
        />
      ) : status === 'completed' ? (
        <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true" />
      ) : null}
      {labels[status]}
    </span>
  );
}
