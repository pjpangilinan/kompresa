import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDownloadUrl, getJob } from '../api/jobs';
import { ApiException } from '../api/client';
import { AmbientBg } from '../components/AmbientBg';
import { Skeleton } from '../components/Skeleton';

function formatBytes(mb: number | null): string {
  if (mb === null) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export function Download() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [origSizeMb, setOrigSizeMb] = useState<number | null>(null);

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId!),
    enabled: !!jobId,
  });

  useEffect(() => {
    if (job && job.actual_output_size_mb) {
      const reductionPct = 80;
      setOrigSizeMb(job.actual_output_size_mb / (1 - reductionPct / 100));
    }
  }, [job]);

  const handleDownload = async () => {
    if (!jobId) return;
    setDownloadError(null);
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
      const message = err instanceof ApiException ? err.message : 'Failed to fetch download URL';
      setDownloadError(message);
    }
  };

  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (isLoading || !job) {
    return (
      <div className="w-full flex items-center justify-center py-3" aria-busy="true" aria-label="Loading compressed output">
        <div className="w-full max-w-3xl flex flex-col lg:flex-row gap-6 items-center">
          <Skeleton className="w-full max-w-[500px] aspect-video" />
          <div className="flex-1 space-y-4 w-full">
            <Skeleton className="h-16 w-3/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-12 w-48" />
          </div>
        </div>
      </div>
    );
  }

  if (job.status !== 'completed') {
    return (
      <div className="w-full flex items-center justify-center py-3">
        <div className="max-w-2xl w-full bg-surface-container-high border border-error p-6 clip-jagged">
          <h1 className="font-headline-md text-headline-md text-error uppercase -skew-x-6 mb-2">
            <span className="skew-x-6 inline-block">NOT_READY</span>
          </h1>
          <p className="font-label-mono text-label-mono text-on-surface-variant uppercase mb-4">
            JOB STATUS: {job.status.toUpperCase()} // CANNOT DOWNLOAD YET
          </p>
          <button
            onClick={() => navigate(`/jobs/${jobId}`)}
            className="font-label-mono text-label-mono text-primary-container hover:text-on-primary-container hover:bg-primary-container border border-primary-container uppercase px-4 py-2 transition-colors"
          >
            VIEW STATUS
          </button>
        </div>
      </div>
    );
  }

  const reductionPct = origSizeMb && job.actual_output_size_mb
    ? Math.round((1 - job.actual_output_size_mb / origSizeMb) * 100)
    : 0;

  return (
    <div className="w-full flex items-center justify-center py-3 relative">
      <AmbientBg variant="download" />
      <div className="w-full max-w-[1440px] flex flex-col lg:flex-row gap-gutter items-center justify-center relative z-10">
        <div className="w-full lg:w-1/2 flex justify-center">
          <div className="relative group transform -rotate-2 hover:rotate-0 transition-transform duration-300">
            <div className="absolute inset-0 bg-primary-container translate-x-3 translate-y-3 jagged-border z-0" />
            <div className="relative z-10 w-[500px] aspect-video bg-surface-container-high border-2 border-primary-container jagged-border overflow-hidden">
              <div className="w-full h-full bg-gradient-to-br from-surface-container-highest to-surface-container flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[120px] text-primary-container/30"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  play_circle
                </span>
              </div>
              <div className="absolute inset-0 bg-primary-container/20 flex items-center justify-center backdrop-blur-[2px]">
                <div className="bg-surface-container-lowest border-2 border-primary-container px-6 py-2 -skew-x-12 shadow-cyber">
                  <span className="font-headline-md text-headline-md text-primary-container tracking-wider">
                    DOWNLOAD READY
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/2 flex flex-col items-start gap-8 z-20">
          <div className="relative w-full">
            <h1 className="hidden md:block font-headline-xl text-headline-xl text-primary-container uppercase -skew-x-12 leading-none drop-shadow-[4px_4px_0px_rgba(26,26,27,1)] relative z-10">
              COMPRESSION
              <br />
              COMPLETE
            </h1>
            <h1 className="md:hidden font-headline-lg-mobile text-headline-lg-mobile text-primary-container uppercase -skew-x-12 leading-none drop-shadow-[2px_2px_0px_rgba(26,26,27,1)] relative z-10">
              COMPRESSION
              <br />
              COMPLETE
            </h1>
            <div className="absolute -top-4 -left-4 w-16 h-16 bg-primary-container/20 -skew-x-12 z-0" />
          </div>

          <div className="w-full max-w-[400px] bg-surface-container-lowest border border-outline-variant p-6 relative group overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[4px] bg-primary-container">
              <div className="absolute right-4 top-0 w-12 h-full bg-surface-container-lowest -skew-x-12" />
            </div>
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex items-center gap-2 text-on-surface-variant font-label-mono text-label-mono">
                <span className="material-symbols-outlined text-[16px] text-primary-container">
                  memory
                </span>
                <span>DATA_DELTA // ANALYSIS</span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-dotted border-outline-variant pt-4">
                <div className="flex flex-col">
                  <span className="font-label-mono text-label-mono text-on-surface-variant mb-1">
                    ORIGINAL_SIZE
                  </span>
                  <span className="font-stats-lg text-stats-lg text-error">
                    {formatBytes(origSizeMb)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-mono text-label-mono text-on-surface-variant mb-1">
                    NEW_SIZE
                  </span>
                  <span className="font-stats-lg text-stats-lg text-primary-container">
                    {formatBytes(job.actual_output_size_mb)}
                  </span>
                </div>
              </div>
              <div className="w-full mt-4">
                <div className="flex justify-between font-label-mono text-label-mono text-primary-container mb-1">
                  <span>EFFICIENCY</span>
                  <span>{reductionPct}% REDUCTION</span>
                </div>
                <div className="w-full h-2 bg-surface-container-highest overflow-hidden">
                  <div
                    className="h-full bg-primary-container -skew-x-12 origin-left"
                    style={{ width: `${reductionPct}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="absolute inset-0 halftone-bg opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none" />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <button
              onClick={handleDownload}
              className="relative group"
            >
              <div className="absolute inset-0 bg-primary-fixed-dim btn-clip translate-x-2 translate-y-2 transition-transform duration-100 group-hover:translate-x-1 group-hover:translate-y-1 group-active:translate-x-0 group-active:translate-y-0" />
              <div className="relative bg-primary-container text-surface-container-lowest btn-clip px-12 py-4 flex items-center justify-center gap-4 border-2 border-surface-container-lowest transition-transform duration-100 group-hover:-translate-x-1 group-hover:-translate-y-1 group-active:translate-x-0 group-active:translate-y-0">
                <span className="font-headline-md text-headline-md uppercase -skew-x-6 tracking-wide">
                  <span className="skew-x-6 inline-block">EXECUTE_DOWNLOAD</span>
                </span>
                <span
                  className="material-symbols-outlined text-[32px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  download
                </span>
              </div>
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="font-label-mono text-label-mono text-on-surface-variant opacity-70 hover:text-primary-container hover:skew-x-2 transition-transform uppercase px-6 py-4"
            >
              ← COMPRESS ANOTHER
            </button>
          </div>

          {downloadError ? (
            <div
              role="alert"
              className="border-2 border-error bg-error-container/20 p-3 font-label-mono text-label-mono text-error uppercase"
            >
              {downloadError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
