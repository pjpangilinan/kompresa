import { useEffect, useRef, useState } from 'react';
import { Panel } from './Panel';
import type { ProbeData } from '../lib/types';

const ACCEPTED = '.mp4,.mov,.avi,.mkv,.webm,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm';
const MAX_FILE_SIZE_MB = 2048;

type ProbeState =
  | { kind: 'idle' }
  | { kind: 'probing' }
  | { kind: 'ready'; data: ProbeData }
  | { kind: 'error'; message: string };

type FilePickerProps = {
  file: File | null;
  onFile: (file: File | null) => void;
};

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function FilePicker({ file, onFile }: FilePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [probeState, setProbeState] = useState<ProbeState>({ kind: 'idle' });

  useEffect(() => {
    setProbeState({ kind: 'idle' });
    if (!file) return;

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    let cancelled = false;
    let timedOut = setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setProbeState({ kind: 'error', message: 'Probe timed out' });
      URL.revokeObjectURL(url);
      video.remove();
    }, 5000);

    video.onloadedmetadata = () => {
      if (cancelled) return;
      clearTimeout(timedOut);
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const codecMap: Record<string, string> = {
        mp4: 'h264', mkv: 'hevc', mov: 'h264', avi: 'mpeg4', webm: 'vp9',
      };
      const codec = codecMap[ext] ?? 'unknown';
      const pixelCount = video.videoWidth * video.videoHeight;
      let resolution: '480p' | '720p' | '1080p' | '2160p' = '1080p';
      if (pixelCount <= 640 * 480) resolution = '480p';
      else if (pixelCount <= 1280 * 720) resolution = '720p';
      else if (pixelCount <= 1920 * 1080) resolution = '1080p';
      else resolution = '2160p';

      setProbeState({
        kind: 'ready',
        data: {
          duration_sec: video.duration || 0,
          width: video.videoWidth,
          height: video.videoHeight,
          resolution,
          fps: 0,
          video_codec: codec,
          video_bitrate_kbps: 0,
          audio_codec: null,
          audio_bitrate_kbps: null,
        },
      });
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.onerror = () => {
      if (cancelled) return;
      clearTimeout(timedOut);
      setProbeState({ kind: 'error', message: 'Could not read video metadata' });
      URL.revokeObjectURL(url);
      video.remove();
    };

    return () => {
      cancelled = true;
      clearTimeout(timedOut);
      video.remove();
    };
  }, [file]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };

  const fileSizeMb = file ? file.size / (1024 * 1024) : 0;
  const sizeValid = fileSizeMb <= MAX_FILE_SIZE_MB;

  return (
    <Panel glitch="cyan" className="h-full">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative aspect-square w-full flex flex-col items-center justify-center p-6 group transition-colors ${
          dragOver ? 'bg-primary-container/10' : 'hover:bg-surface-container-highest/30'
        }`}
        aria-label="Select video file"
      >
        <div
          className={`absolute inset-4 border-2 border-dashed flex flex-col items-center justify-center transition-colors ${
            dragOver
              ? 'border-primary-container bg-primary-container/5'
              : 'border-outline-variant group-hover:border-primary-container'
          }`}
        >
          {file ? (
            <>
              <span
                className="material-symbols-outlined text-[64px] text-primary-container mb-3"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                movie
              </span>
              <p className="font-label-mono text-label-mono text-on-surface uppercase text-center break-all max-w-full px-4">
                {file.name.length > 24 ? `${file.name.slice(0, 21)}…` : file.name}
              </p>
              <p className="font-label-mono text-label-mono text-primary-container mt-2 text-[10px] tracking-widest">
                {formatSize(fileSizeMb)} // CLICK TO CHANGE
              </p>
            </>
          ) : (
            <>
              <span
                className="material-symbols-outlined text-[80px] text-primary-container mb-4 group-hover:scale-110 transition-transform"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                cloud_upload
              </span>
              <h2 className="font-headline-lg text-headline-lg text-on-surface text-center leading-none tracking-tight uppercase mb-2">
                DROP FILE
              </h2>
              <p className="font-label-mono text-label-mono text-on-surface-variant opacity-60 text-center uppercase text-[10px] tracking-widest">
                MP4 · MKV · AVI · MOV · WEBM
                <br />
                MAX {MAX_FILE_SIZE_MB} MB
              </p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="sr-only"
          aria-label="Upload video file"
        />
      </button>

      {file && !sizeValid ? (
        <div className="px-4 py-2 border-t border-error bg-error-container/30">
          <p className="font-label-mono text-label-mono text-error uppercase" role="alert">
            EXCEEDS {MAX_FILE_SIZE_MB} MB LIMIT
          </p>
        </div>
      ) : null}

      {file && sizeValid ? (
        <div className="border-t border-outline-variant">
          {probeState.kind === 'probing' ? (
            <div className="p-4 flex items-center gap-3">
              <span
                className="material-symbols-outlined text-primary-container text-[24px] animate-spin"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                progress_activity
              </span>
              <span className="font-label-mono text-label-mono text-primary-container uppercase tracking-widest animate-pulse">
                PROBING MEDIA...
              </span>
            </div>
          ) : probeState.kind === 'error' ? (
            <div className="p-4">
              <p className="font-label-mono text-label-mono text-error uppercase" role="alert">
                PROBE FAILED: {probeState.message}
              </p>
            </div>
          ) : probeState.kind === 'ready' ? (
            <dl className="p-4 grid grid-cols-2 gap-x-4 gap-y-2 font-label-mono text-label-mono uppercase">
              <dt className="text-on-surface-variant opacity-60">DURATION</dt>
              <dd className="text-on-surface text-right">{formatDuration(probeState.data.duration_sec)}</dd>

              <dt className="text-on-surface-variant opacity-60">RESOLUTION</dt>
              <dd className="text-on-surface text-right">
                {probeState.data.width}×{probeState.data.height}
              </dd>

              <dt className="text-on-surface-variant opacity-60">CODEC</dt>
              <dd className="text-primary-container text-right">{probeState.data.video_codec.toUpperCase()}</dd>
            </dl>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
