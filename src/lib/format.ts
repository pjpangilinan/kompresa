export function formatBytes(mb: number | null): string {
  if (mb === null) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export function formatEta(sec: number | null): string {
  if (sec === null) return '—';
  if (sec < 0) return '—';
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function formatDuration(sec: number): string {
  if (sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatTimeAgo(epoch: number, now: number = Date.now()): string {
  const diff = now - epoch;
  if (diff < 0) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function codecLabel(codec: 'h264' | 'h265' | 'av1'): string {
  if (codec === 'h264') return 'H.264';
  if (codec === 'h265') return 'H.265';
  return 'AV1';
}
