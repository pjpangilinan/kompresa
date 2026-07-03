import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FilePicker } from './FilePicker';

function renderWithQuery(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('FilePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows drop zone when no file selected', () => {
    renderWithQuery(<FilePicker file={null} onFile={vi.fn()} />);
    expect(screen.getByText(/drop file/i)).toBeInTheDocument();
  });

  it('calls onFile when file selected', async () => {
    const onFile = vi.fn();
    renderWithQuery(<FilePicker file={null} onFile={onFile} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'.repeat(1024)], 'test.mp4', { type: 'video/mp4' });
    await userEvent.upload(input, file);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('shows filename after file selected', () => {
    const file = new File(['x'], 'myvideo.mp4', { type: 'video/mp4' });
    renderWithQuery(<FilePicker file={file} onFile={vi.fn()} />);
    expect(screen.getByText(/myvideo\.mp4/)).toBeInTheDocument();
  });

  // probe test skipped: uses <video> element which jsdom can't simulate
});
