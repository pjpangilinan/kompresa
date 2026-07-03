import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createJob, initUpload } from '../api/jobs';
import { ApiException } from '../api/client';
import { useJobsContext } from '../hooks/useJobsContext';
import { Panel } from '../components/Panel';
import { FilePicker } from '../components/FilePicker';
import { JobsSidebar } from '../components/JobsSidebar';
import { Button } from '../components/Button';
import type { Codec, Job, Resolution } from '../lib/types';

const MAX_FILE_SIZE_MB = 2048;

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'uploading'; pct: number }
  | { kind: 'creating' }
  | { kind: 'error'; message: string };

export function Dashboard() {
  const navigate = useNavigate();
  const { addJob } = useJobsContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [targetSize, setTargetSize] = useState<number>(25);
  const [codec, setCodec] = useState<Codec>('h264');
  const [audioBitrate, setAudioBitrate] = useState<64 | 96 | 128 | 192 | 256 | 320>(128);
  const [maxResolution, setMaxResolution] = useState<Resolution>('1080p');
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' });

  const fileSizeMb = file ? file.size / (1024 * 1024) : 0;
  const sizeValid = fileSizeMb <= MAX_FILE_SIZE_MB;
  const targetValid = targetSize >= 1 && targetSize <= 2048;
  const canStart = file !== null && sizeValid && targetValid;
  const isBusy = submit.kind === 'uploading' || submit.kind === 'creating';

  const handleStart = async () => {
    if (!file || !canStart || isBusy) return;
    setSubmit({ kind: 'uploading', pct: 0 });
      try {
        const init = await initUpload();
        setSubmit({ kind: 'uploading', pct: 5 });
        if (!init.upload_url.startsWith('mock://')) {
          try {
            const xhr = new XMLHttpRequest();
            await new Promise<void>((resolve, reject) => {
              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                  setSubmit({ kind: 'uploading', pct: 5 + Math.round((e.loaded / e.total) * 90) });
                }
              };
              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) resolve();
                else reject(new Error(`Upload failed (${xhr.status})`));
              };
              xhr.onerror = () => reject(new Error('Upload network error'));
              xhr.open('PUT', init.upload_url);
              xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
              xhr.send(file);
            });
          } catch (err) {
            throw err;
          }
        }
        setSubmit({ kind: 'uploading', pct: 95 });
      setSubmit({ kind: 'creating' });
      const result = await createJob({
        file_id: init.file_id,
        target_size_mb: targetSize,
        codec,
        max_resolution: maxResolution,
        audio_bitrate_kbps: audioBitrate,
      });
      const seed: Job = {
        job_id: result.job_id,
        source_file_key: file.name,
        output_file_key: null,
        target_size_mb: targetSize,
        actual_output_size_mb: null,
        status: result.status,
        progress_pct: 0,
        estimated_time_remaining_sec: null,
        output_url: null,
        codec,
        error_message: null,
        created_at: Date.now(),
        completed_at: null,
      };
      addJob(seed);
      navigate(`/jobs/${result.job_id}`);
    } catch (err) {
      const message =
        err instanceof ApiException
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Unknown error';
      setSubmit({ kind: 'error', message });
    }
  };

  return (
    <div className="w-full flex items-center justify-center py-3">
      <div className="w-full max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-stretch">
        <div className="col-span-1 md:col-span-4">
          <FilePicker file={file} onFile={setFile} />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            aria-hidden="true"
          />
        </div>

        <div className="col-span-1 md:col-span-4 flex flex-col gap-4">
          <Panel glitch="cyan" className="flex-1">
            <div className="p-5 border-b border-outline-variant flex items-center gap-2">
              <span
                className="material-symbols-outlined text-primary-container"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                tune
              </span>
              <h2 className="font-headline-md text-headline-md text-primary-container uppercase tracking-widest -skew-x-6">
                <span className="skew-x-6 inline-block">CONFIG.SYS</span>
              </h2>
            </div>

            <form
              className="p-5 space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                void handleStart();
              }}
            >
              <div className="flex flex-col relative pt-2">
                <label
                  htmlFor="target-size"
                  className="font-label-mono text-label-mono text-on-surface-variant opacity-60 uppercase absolute -top-2 left-0 bg-surface-container-high px-1 z-10 tracking-widest"
                >
                  TARGET_SIZE (MB)
                </label>
                <input
                  id="target-size"
                  type="number"
                  min={1}
                  max={2048}
                  value={targetSize}
                  onChange={(e) => setTargetSize(Number(e.target.value))}
                  className="bg-transparent border-0 border-b-2 border-surface-container-highest focus:border-primary-container focus:ring-0 focus:outline-none font-body-lg text-body-lg text-on-surface py-3 px-0 transition-colors w-full"
                />
                {!targetValid ? (
                  <span className="font-label-mono text-label-mono text-error mt-2 uppercase" role="alert">
                    1–2048 MB
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-label-mono text-label-mono text-on-surface-variant opacity-60 uppercase tracking-widest">
                  VIDEO_CODEC
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['h264', 'h265', 'av1'] as Codec[]).map((c) => (
                    <label key={c} className="cursor-pointer">
                      <input
                        checked={codec === c}
                        onChange={() => setCodec(c)}
                        className="peer sr-only"
                        name="codec"
                        type="radio"
                        value={c}
                      />
                      <div className="font-label-mono text-label-mono text-center py-2 border-2 border-surface-container-highest peer-checked:bg-primary-container peer-checked:text-on-primary-container peer-checked:border-primary-container hover:bg-surface-container-highest transition-colors uppercase">
                        {c === 'h264' ? 'H.264' : c === 'h265' ? 'H.265' : 'AV1'}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-label-mono text-label-mono text-on-surface-variant opacity-60 uppercase tracking-widest">
                  MAX_RESOLUTION
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {(['480p', '720p', '1080p', '2160p'] as Resolution[]).map((r) => (
                    <label key={r} className="cursor-pointer">
                      <input
                        checked={maxResolution === r}
                        onChange={() => setMaxResolution(r)}
                        className="peer sr-only"
                        name="max_resolution"
                        type="radio"
                        value={r}
                      />
                      <div className="font-label-mono text-label-mono text-center py-2 border-2 border-surface-container-highest peer-checked:bg-primary-container peer-checked:text-on-primary-container peer-checked:border-primary-container hover:bg-surface-container-highest transition-colors uppercase text-[10px]">
                        {r.toUpperCase()}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="audio-bitrate"
                  className="font-label-mono text-label-mono text-on-surface-variant opacity-60 uppercase tracking-widest"
                >
                  AUDIO_BITRATE
                </label>
                <select
                  id="audio-bitrate"
                  value={audioBitrate}
                  onChange={(e) =>
                    setAudioBitrate(Number(e.target.value) as 64 | 96 | 128 | 192 | 256 | 320)
                  }
                  className="bg-surface-container-lowest border-2 border-surface-container-highest focus:border-primary-container focus:ring-0 focus:outline-none font-label-mono text-label-mono text-on-surface py-2 px-3 w-full uppercase appearance-none"
                >
                  {[64, 96, 128, 192, 256, 320].map((b) => (
                    <option key={b} value={b}>
                      {b} KBPS
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="submit"
                loading={isBusy}
                disabled={!canStart || isBusy || (submit.kind === 'error' ? false : false)}
                icon={
                  <span
                    className="material-symbols-outlined text-[32px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    bolt
                  </span>
                }
              >
                {submit.kind === 'uploading'
                  ? `UPLOADING ${submit.pct}%`
                  : submit.kind === 'creating'
                  ? 'SPAWNING WORKER'
                  : 'START COMPRESSION'}
              </Button>

              {submit.kind === 'error' ? (
                <div
                  role="alert"
                  className="border-2 border-error bg-error-container/20 p-3 font-label-mono text-label-mono text-error uppercase"
                >
                  {submit.message}
                </div>
              ) : null}
            </form>
          </Panel>
        </div>

        <div className="col-span-1 md:col-span-4">
          <JobsSidebar />
        </div>
      </div>
    </div>
  );
}
