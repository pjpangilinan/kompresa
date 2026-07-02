import type { Job } from '../lib/types';
import { isActive } from '../lib/job-status';
import { StatusBadge } from './StatusBadge';
import { ProgressBar } from './ProgressBar';

type JobCardProps = {
  job: Job;
  onOpen: (jobId: string) => void;
  onDownload: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  onDelete: (jobId: string) => void;
};

function formatMb(mb: number | null): string {
  if (mb === null) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function timeAgo(epoch: number): string {
  const diff = Date.now() - epoch;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function JobCard({ job, onOpen, onDownload, onCancel, onDelete }: JobCardProps) {
  const active = isActive(job.status);
  const truncated = job.source_file_key.length > 28
    ? `${job.source_file_key.slice(0, 25)}…`
    : job.source_file_key;

  return (
    <div
      className={`bg-surface-container-lowest border ${
        active
          ? 'border-primary-container glow-cyan'
          : 'border-outline-variant hover:border-primary-container'
      } p-3 transition-colors group`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          type="button"
          onClick={() => onOpen(job.job_id)}
          className="font-label-mono text-label-mono text-on-surface text-left hover:text-primary-container transition-colors truncate flex-1 min-w-0"
          title={job.source_file_key}
        >
          {truncated}
        </button>
        <StatusBadge status={job.status} compact />
      </div>

      {active ? (
        <div className="mb-2">
          <ProgressBar value={job.progress_pct} showPercent />
        </div>
      ) : null}

      <div className="flex items-center justify-between text-[10px] font-label-mono text-on-surface-variant uppercase tracking-wider mb-2">
        <span>{timeAgo(job.created_at)}</span>
        <span>
          {formatMb(null)} → {formatMb(job.actual_output_size_mb ?? job.target_size_mb)}
        </span>
      </div>

      <div className="flex gap-1">
        {active ? (
          <>
            <button
              type="button"
              onClick={() => onCancel(job.job_id)}
              className="flex-1 font-label-mono text-label-mono text-warning hover:text-on-warning hover:bg-warning border border-warning uppercase py-1 transition-colors flex items-center justify-center gap-1"
              aria-label={`Cancel ${truncated}`}
            >
              <span
                className="material-symbols-outlined text-[14px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                stop
              </span>
              CANCEL
            </button>
            <button
              type="button"
              onClick={() => onOpen(job.job_id)}
              className="font-label-mono text-label-mono text-on-surface-variant hover:text-primary-container border border-outline-variant hover:border-primary-container uppercase px-2 py-1 transition-colors"
              aria-label={`View ${truncated}`}
            >
              <span
                className="material-symbols-outlined text-[14px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                visibility
              </span>
            </button>
          </>
        ) : job.status === 'completed' ? (
          <button
            type="button"
            onClick={() => onDownload(job.job_id)}
            className="flex-1 font-label-mono text-label-mono text-primary-container hover:text-on-primary-container hover:bg-primary-container border border-primary-container uppercase py-1 transition-colors flex items-center justify-center gap-1"
            aria-label={`Download ${truncated}`}
          >
            <span
              className="material-symbols-outlined text-[14px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              download
            </span>
            GET
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpen(job.job_id)}
            className="flex-1 font-label-mono text-label-mono text-on-surface-variant hover:text-primary-container border border-outline-variant hover:border-primary-container uppercase py-1 transition-colors flex items-center justify-center gap-1"
          >
            <span
              className="material-symbols-outlined text-[14px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              visibility
            </span>
            VIEW
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(job.job_id)}
          className="font-label-mono text-label-mono text-on-surface-variant hover:text-error border border-outline-variant hover:border-error uppercase px-2 py-1 transition-colors"
          aria-label={`Delete ${truncated}`}
        >
          <span
            className="material-symbols-outlined text-[14px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            delete
          </span>
        </button>
      </div>
    </div>
  );
}
