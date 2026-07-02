import type {
  CompressRequest,
  CompressResponse,
  Job,
  JobStatus,
  LoginRequest,
  ProbeData,
  Resolution,
  UploadInitResponse,
} from '../lib/types';

interface MockJob extends Job {
  _targetDuration: number;
  _startedAt: number;
}

const mockJobs = new Map<string, MockJob>();
const mockFiles = new Map<string, { name: string; size: number }>();

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const AUTH_COOKIE = 'phantom_session';

function isAuthed(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c.startsWith(`${AUTH_COOKIE}=`));
}

function setAuthCookie(): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + 12 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${AUTH_COOKIE}=1; expires=${expires}; path=/; SameSite=Strict`;
}

function clearAuthCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

function nextStatus(job: MockJob): JobStatus {
  const elapsed = (Date.now() - job._startedAt) / 1000;
  const t = job._targetDuration;
  if (elapsed < 0.5) return 'queued';
  if (elapsed < 1) return 'probing';
  if (elapsed < t - 1) return 'processing';
  if (elapsed < t) return 'verifying';
  return 'completed';
}

function recomputeJob(job: MockJob): MockJob {
  const status = nextStatus(job);
  const elapsed = Math.max(0, (Date.now() - job._startedAt) / 1000);
  const t = job._targetDuration;
  let progress = 0;
  if (status === 'queued') progress = 0;
  else if (status === 'probing') progress = 5;
  else if (status === 'processing') {
    const processElapsed = elapsed - 1;
    progress = Math.min(95, 5 + (processElapsed / (t - 2)) * 90);
  } else if (status === 'verifying') progress = 96;
  else if (status === 'completed') progress = 100;

  const remaining = status === 'completed' ? 0 : Math.max(0, t - elapsed);

  return {
    ...job,
    status,
    progress_pct: Math.floor(progress),
    estimated_time_remaining_sec: Math.ceil(remaining),
    output_file_key: status === 'completed' ? `outputs/${job.job_id}.mp4` : null,
    output_url: status === 'completed' ? `mock://download/${job.job_id}` : null,
    actual_output_size_mb: status === 'completed' ? job.target_size_mb * 0.97 : null,
    completed_at: status === 'completed' ? Date.now() : null,
  };
}

export async function mockFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const method = opts.method ?? 'GET';
  await delay(120);

  const publicPaths = ['/api/login'];
  if (!publicPaths.includes(path) && !isAuthed() && path !== '/api/session') {
    throw Object.assign(new Error('Unauthorized'), { status: 401, code: 'unauthorized' });
  }

  if (path === '/api/login' && method === 'POST') {
    const body = opts.body as LoginRequest;
    if (!body?.password || !body?.totp) {
      throw Object.assign(new Error('Missing credentials'), { status: 400, code: 'bad_request' });
    }
    if (body.password !== 'phantom' || body.totp !== '000000') {
      throw Object.assign(new Error('Invalid credentials'), {
        status: 401,
        code: 'invalid_credentials',
      });
    }
    setAuthCookie();
    return { expires_at: Date.now() + 12 * 60 * 60 * 1000 } as T;
  }

  if (path === '/api/logout' && method === 'POST') {
    clearAuthCookie();
    return undefined as T;
  }

  if (path === '/api/session' && method === 'GET') {
    return { authenticated: isAuthed() } as T;
  }

  if (path === '/api/uploads' && method === 'POST') {
    const file_id = uuid();
    mockFiles.set(file_id, { name: 'mock.mp4', size: 0 });
    const res: UploadInitResponse = {
      upload_url: `mock://upload/${file_id}`,
      file_id,
      expires_at: Date.now() + 15 * 60 * 1000,
    };
    return res as T;
  }

  if (path === '/api/probe' && method === 'POST') {
    const sizes: Array<[number, number, Resolution]> = [
      [1920, 1080, '1080p'],
      [1280, 720, '720p'],
      [3840, 2160, '2160p'],
      [854, 480, '480p'],
    ];
    const [width, height, resolution] = sizes[Math.floor(Math.random() * sizes.length)];
    const probe: ProbeData = {
      duration_sec: 30 + Math.random() * 600,
      width,
      height,
      resolution,
      fps: [24, 30, 60][Math.floor(Math.random() * 3)],
      video_codec: ['h264', 'hevc', 'vp9'][Math.floor(Math.random() * 3)],
      video_bitrate_kbps: 2000 + Math.floor(Math.random() * 18000),
      audio_codec: 'aac',
      audio_bitrate_kbps: 128,
    };
    return probe as T;
  }

  if (path === '/api/compress' && method === 'POST') {
    const body = opts.body as CompressRequest;
    if (!body?.file_id) {
      throw Object.assign(new Error('Missing file_id'), { status: 400, code: 'bad_request' });
    }
    const job_id = uuid();
    const job: MockJob = {
      job_id,
      source_file_key: `uploads/${body.file_id}`,
      output_file_key: null,
      target_size_mb: body.target_size_mb,
      actual_output_size_mb: null,
      status: 'queued',
      progress_pct: 0,
      estimated_time_remaining_sec: null,
      output_url: null,
      codec: body.codec,
      error_message: null,
      created_at: Date.now(),
      completed_at: null,
      _targetDuration: 10 + Math.random() * 8,
      _startedAt: Date.now(),
    };
    mockJobs.set(job_id, job);
    const res: CompressResponse = { job_id, status: 'queued' };
    return res as T;
  }

  const jobMatch = path.match(/^\/api\/jobs\/([0-9a-f-]+)(?:\/download)?$/i);
  if (jobMatch) {
    const jobId = jobMatch[1];
    const job = mockJobs.get(jobId);
    if (!job) {
      throw Object.assign(new Error('Job not found'), { status: 404, code: 'not_found' });
    }
    if (path.endsWith('/download')) {
      return { url: `mock://download/${jobId}.mp4` } as T;
    }
    if (method === 'DELETE') {
      mockJobs.delete(jobId);
      return undefined as T;
    }
    const updated = recomputeJob(job);
    mockJobs.set(jobId, updated);
    return { ...updated } as T;
  }

  throw Object.assign(new Error('Not implemented in mock'), { status: 501, code: 'not_implemented' });
}
