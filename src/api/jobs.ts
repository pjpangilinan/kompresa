import { apiFetch } from './client';
import type {
  CompressRequest,
  CompressResponse,
  Job,
  ProbeData,
  UploadInitResponse,
} from '../lib/types';

export async function initUpload(): Promise<UploadInitResponse> {
  return apiFetch<UploadInitResponse>('/api/uploads', { method: 'POST' });
}

export async function probeFile(file: File, signal?: AbortSignal): Promise<ProbeData> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<ProbeData>('/api/probe', {
    method: 'POST',
    body: form,
    signal,
  });
}

export async function createJob(req: CompressRequest): Promise<CompressResponse> {
  return apiFetch<CompressResponse>('/api/compress', {
    method: 'POST',
    body: req,
  });
}

export async function getJob(jobId: string, signal?: AbortSignal): Promise<Job> {
  return apiFetch<Job>(`/api/jobs/${encodeURIComponent(jobId)}`, { signal });
}

export async function getDownloadUrl(jobId: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(`/api/jobs/${encodeURIComponent(jobId)}/download`);
}

export async function deleteJob(jobId: string): Promise<void> {
  return apiFetch<void>(`/api/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
}
