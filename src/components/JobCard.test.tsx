import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobCard } from './JobCard';
import type { Job } from '../lib/types';

const baseJob: Job = {
  job_id: 'abc-123-def-456',
  source_file_key: 'uploads/test.mp4',
  output_file_key: null,
  target_size_mb: 25,
  actual_output_size_mb: null,
  status: 'queued',
  progress_pct: 0,
  estimated_time_remaining_sec: null,
  output_url: null,
  codec: 'h264',
  error_message: null,
  created_at: Date.now() - 5000,
  completed_at: null,
};

describe('JobCard', () => {
  it('renders filename and status', () => {
    render(
      <JobCard
        job={baseJob}
        onOpen={vi.fn()}
        onDownload={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/test\.mp4/)).toBeInTheDocument();
    expect(screen.getByText('QUEUED')).toBeInTheDocument();
  });

  it('shows CANCEL button for active jobs', () => {
    render(
      <JobCard
        job={{ ...baseJob, status: 'processing', progress_pct: 50 }}
        onOpen={vi.fn()}
        onDownload={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows GET button for completed jobs', () => {
    render(
      <JobCard
        job={{ ...baseJob, status: 'completed', actual_output_size_mb: 24, output_file_key: 'outputs/x.mp4' }}
        onOpen={vi.fn()}
        onDownload={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('24 MB'))).toBeInTheDocument();
  });

  it('calls onCancel when cancel clicked', async () => {
    const onCancel = vi.fn();
    render(
      <JobCard
        job={{ ...baseJob, status: 'processing' }}
        onOpen={vi.fn()}
        onDownload={vi.fn()}
        onCancel={onCancel}
        onDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledWith(baseJob.job_id);
  });

  it('calls onDelete when trash clicked', async () => {
    const onDelete = vi.fn();
    render(
      <JobCard
        job={baseJob}
        onOpen={vi.fn()}
        onDownload={vi.fn()}
        onCancel={vi.fn()}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(baseJob.job_id);
  });
});
