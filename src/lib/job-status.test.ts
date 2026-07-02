import { describe, expect, it } from 'vitest';
import { isActive } from './job-status';

describe('isActive', () => {
  it('returns true for active statuses', () => {
    expect(isActive('queued')).toBe(true);
    expect(isActive('probing')).toBe(true);
    expect(isActive('processing')).toBe(true);
    expect(isActive('verifying')).toBe(true);
  });

  it('returns false for terminal statuses', () => {
    expect(isActive('completed')).toBe(false);
    expect(isActive('failed')).toBe(false);
  });
});
