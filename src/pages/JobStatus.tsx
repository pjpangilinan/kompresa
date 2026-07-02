import { useNavigate, useParams } from 'react-router-dom';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { Skeleton } from '../components/Skeleton';
import { useJobPolling } from '../hooks/useJobPolling';

function formatEta(sec: number | null): string {
  if (sec === null) return '—';
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function JobStatus() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { job, error } = useJobPolling(jobId ?? null);

  if (error) {
    return (
      <div className="w-full flex items-center justify-center py-3">
        <div className="max-w-2xl w-full">
          <Panel glitch="warning">
            <div className="p-6 md:p-8">
              <h1 className="font-headline-lg text-headline-lg text-warning uppercase mb-2 -skew-x-6">
                <span className="skew-x-6 inline-block">SIGNAL_LOST</span>
              </h1>
              <p className="font-label-mono text-label-mono text-on-surface-variant uppercase mb-4">
                {error.message}
              </p>
              <Button onClick={() => navigate('/dashboard')}>RETURN TO UPLOAD</Button>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="w-full flex items-center justify-center py-3" aria-busy="true" aria-label="Loading job status">
        <div className="w-full max-w-2xl">
          <Panel>
            <div className="p-6 border-b border-outline-variant flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="p-6 space-y-6">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-2 w-full" />
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  if (job.status === 'completed') {
    return (
      <div className="w-full flex items-center justify-center py-3">
        <div className="max-w-2xl w-full">
          <Panel glitch="success">
            <div className="p-6 md:p-10 text-center">
              <StatusBadge status={job.status} />
              <h1 className="font-headline-lg text-headline-lg text-primary-container uppercase -skew-x-6 leading-none mt-6 break-words">
                <span className="skew-x-6 inline-block">COMPRESSION<br />COMPLETE</span>
              </h1>
              <p className="font-label-mono text-label-mono text-on-surface-variant mt-4 uppercase">
                JOB_ID: {job.job_id.slice(0, 8)}
              </p>
              <div className="mt-8">
                <Button
                  onClick={() => navigate(`/download/${job.job_id}`)}
                  icon={
                    <span
                      className="material-symbols-outlined text-[32px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      download
                    </span>
                  }
                >
                  EXECUTE_DOWNLOAD
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  if (job.status === 'failed') {
    return (
      <div className="w-full flex items-center justify-center py-3">
        <div className="max-w-2xl w-full">
          <Panel glitch="warning">
            <div className="p-6 md:p-8">
              <StatusBadge status={job.status} />
              <h1 className="font-headline-lg text-headline-lg text-error uppercase mt-4 -skew-x-6">
                <span className="skew-x-6 inline-block">ENCODE_FAILED</span>
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                {job.error_message ?? 'Unknown error during compression.'}
              </p>
              <div className="mt-6">
                <Button onClick={() => navigate('/dashboard')}>RETRY UPLOAD</Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex items-center justify-center py-3">
      <div className="w-full max-w-2xl">
        <Panel glitch="cyan" shadow>
          <div className="p-6 border-b border-outline-variant flex items-center justify-between flex-wrap gap-3">
            <span className="font-label-mono text-label-mono text-on-surface-variant opacity-60 uppercase">
              JOB_ID: {job.job_id.slice(0, 8)}
            </span>
            <StatusBadge status={job.status} />
          </div>

          <div className="p-6">
            <h1 className="font-headline-lg text-headline-lg text-primary-container uppercase -skew-x-6 leading-none mb-2">
              <span className="skew-x-6 inline-block">COMPRESSING</span>
            </h1>
            <p className="font-label-mono text-label-mono text-on-surface-variant uppercase tracking-widest opacity-70">
              FFMPEG // TWO_PASS // {job.codec.toUpperCase()}
            </p>

            <div className="mt-8 space-y-6">
              <ProgressBar value={job.progress_pct} label="PROGRESS" />

              <div className="grid grid-cols-3 gap-4 border-t border-dotted border-outline-variant pt-4">
                <div className="flex flex-col">
                  <span className="font-label-mono text-label-mono text-on-surface-variant mb-1 uppercase">
                    TARGET
                  </span>
                  <span className="font-stats-lg text-stats-lg text-on-surface">
                    {job.target_size_mb} MB
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-mono text-label-mono text-on-surface-variant mb-1 uppercase">
                    CODEC
                  </span>
                  <span className="font-stats-lg text-stats-lg text-primary-container uppercase">
                    {job.codec === 'h264' ? 'H.264' : job.codec === 'h265' ? 'H.265' : 'AV1'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-mono text-label-mono text-on-surface-variant mb-1 uppercase">
                    ETA
                  </span>
                  <span className="font-stats-lg text-stats-lg text-primary-container">
                    {formatEta(job.estimated_time_remaining_sec)}
                  </span>
                </div>
              </div>

              <div className="flex justify-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/dashboard')}
                  icon={
                    <span
                      className="material-symbols-outlined text-[24px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      arrow_back
                    </span>
                  }
                >
                  DASHBOARD
                </Button>
              </div>

              <div className="font-label-mono text-label-mono text-on-surface-variant opacity-50 text-center uppercase text-[10px]">
                STREAM // {job.status.toUpperCase()} // POLLING @ 2s
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
