import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { deleteJob, getDownloadUrl, getJob } from '../api/jobs';
import { useJobsContext } from '../hooks/useJobsContext';
import { Panel } from './Panel';
import { JobCard } from './JobCard';
import { isActive } from '../lib/job-status';

export function JobsSidebar() {
  const navigate = useNavigate();
  const { jobs, updateJob, removeJob, clearAll } = useJobsContext();

  const activeIds = jobs
    .filter((j) => j.status !== 'completed' && j.status !== 'failed')
    .map((j) => j.job_id)
    .join(',');

  const { data: _polled } = useQuery({
    queryKey: ['jobs-poll', activeIds],
    queryFn: async () => {
      const active = jobs.filter((j) => isActive(j.status));
      const results = await Promise.allSettled(
        active.map((j) => getJob(j.job_id)),
      );
      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          const j = r.value;
          updateJob(j.job_id, {
            status: j.status,
            progress_pct: j.progress_pct,
            estimated_time_remaining_sec: j.estimated_time_remaining_sec,
            output_file_key: j.output_file_key,
            actual_output_size_mb: j.actual_output_size_mb,
            completed_at: j.completed_at,
            error_message: j.error_message,
          });
        }
      });
      return null;
    },
    enabled: activeIds.length > 0,
    refetchInterval: 2000,
  });

  useEffect(() => {
    void _polled;
  }, [_polled]);

  const handleOpen = (jobId: string) => navigate(`/jobs/${jobId}`);

  const handleDownload = async (jobId: string) => {
    try {
      const { url } = await getDownloadUrl(jobId);
      if (url.startsWith('mock://')) {
        const blob = new Blob(['mock video data'], { type: 'video/mp4' });
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = `kompressa-${jobId.slice(0, 8)}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
        return;
      }
      window.location.href = url;
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await deleteJob(jobId);
    } catch {
    } finally {
      removeJob(jobId);
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      await deleteJob(jobId);
    } catch {
    } finally {
      removeJob(jobId);
    }
  };

  const handleClearAll = () => {
    clearAll();
  };

  return (
    <Panel glitch="cyan" className="h-full">
      <div className="p-4 border-b border-outline-variant flex items-center justify-between gap-2">
        <h2 className="font-headline-md text-headline-md text-primary-container uppercase tracking-widest -skew-x-6">
          <span className="skew-x-6 inline-block">JOB_QUEUE</span>
        </h2>
        <div className="flex items-center gap-2">
          <span className="font-label-mono text-label-mono text-on-surface-variant opacity-60">
            [{jobs.length}]
          </span>
          {jobs.length > 0 ? (
            <button
              type="button"
              onClick={handleClearAll}
              className="font-label-mono text-label-mono text-on-surface-variant opacity-60 hover:text-error hover:opacity-100 uppercase text-[10px] tracking-widest border border-outline-variant hover:border-error px-2 py-0.5 transition-colors"
              aria-label="Clear all jobs"
              title="Clear all jobs"
            >
              CLEAR
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[640px]">
        {jobs.length === 0 ? (
          <div className="text-center py-12 px-4">
            <span
              className="material-symbols-outlined text-[48px] text-on-surface-variant opacity-30 mb-3 inline-block"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              inbox
            </span>
            <p className="font-label-mono text-label-mono text-on-surface-variant opacity-50 uppercase tracking-widest leading-relaxed">
              NO JOBS YET
              <br />
              // AWAITING FIRST COMPRESSION
            </p>
          </div>
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.job_id}
              job={job}
              onOpen={handleOpen}
              onDownload={handleDownload}
              onCancel={handleCancel}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </Panel>
  );
}
