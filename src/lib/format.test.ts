import { describe, expect, it } from 'vitest';
import { codecLabel, formatBytes, formatDuration, formatEta, formatTimeAgo } from './format';

describe('formatBytes', () => {
  it('returns em-dash for null', () => {
    expect(formatBytes(null)).toBe('—');
  });

  it('formats MB', () => {
    expect(formatBytes(500)).toBe('500.0 MB');
    expect(formatBytes(25.5)).toBe('25.5 MB');
  });

  it('converts to GB at 1024+', () => {
    expect(formatBytes(1024)).toBe('1.00 GB');
    expect(formatBytes(2048)).toBe('2.00 GB');
  });
});

describe('formatEta', () => {
  it('returns em-dash for null', () => {
    expect(formatEta(null)).toBe('—');
  });

  it('returns em-dash for negative', () => {
    expect(formatEta(-5)).toBe('—');
  });

  it('formats seconds under 60', () => {
    expect(formatEta(45)).toBe('45s');
  });

  it('formats minutes and seconds over 60', () => {
    expect(formatEta(60)).toBe('1m 0s');
    expect(formatEta(125)).toBe('2m 5s');
  });
});

describe('formatDuration', () => {
  it('formats zero', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('pads seconds to 2 digits', () => {
    expect(formatDuration(5)).toBe('0:05');
  });

  it('handles minutes', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(125)).toBe('2:05');
  });

  it('handles hours via minutes', () => {
    expect(formatDuration(3600)).toBe('60:00');
  });

  it('returns 0:00 for negative', () => {
    expect(formatDuration(-1)).toBe('0:00');
  });
});

describe('formatTimeAgo', () => {
  const now = 1_700_000_000_000;

  it('formats seconds', () => {
    expect(formatTimeAgo(now - 5_000, now)).toBe('5s ago');
  });

  it('formats minutes', () => {
    expect(formatTimeAgo(now - 5 * 60_000, now)).toBe('5m ago');
  });

  it('formats hours', () => {
    expect(formatTimeAgo(now - 5 * 3_600_000, now)).toBe('5h ago');
  });

  it('formats days', () => {
    expect(formatTimeAgo(now - 5 * 86_400_000, now)).toBe('5d ago');
  });

  it('handles future times', () => {
    expect(formatTimeAgo(now + 1000, now)).toBe('just now');
  });
});

describe('codecLabel', () => {
  it('maps h264 to H.264', () => {
    expect(codecLabel('h264')).toBe('H.264');
  });

  it('maps h265 to H.265', () => {
    expect(codecLabel('h265')).toBe('H.265');
  });

  it('maps av1 to AV1', () => {
    expect(codecLabel('av1')).toBe('AV1');
  });
});
