import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['queued', 'QUEUED'],
    ['probing', 'PROBING'],
    ['processing', 'COMPRESSING'],
    ['verifying', 'VERIFYING'],
    ['completed', 'COMPLETE'],
    ['failed', 'FAILED'],
  ] as const)('renders %s status as %s', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
