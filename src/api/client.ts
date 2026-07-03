import type { ApiError } from '../lib/types';

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? '';
const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';

let bearerToken: string | null = null;

export function setBearerToken(token: string | null) {
  bearerToken = token;
}

export class ApiException extends Error {
  status: number;
  code: string;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = 'ApiException';
    this.status = status;
    this.code = error.code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (USE_MOCK) {
    const { mockFetch } = await import('./mocks');
    return mockFetch<T>(path, opts);
  }

  const url = `${API_ORIGIN}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (!(typeof FormData !== 'undefined' && opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
  }

  const init: RequestInit = {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers,
    signal: opts.signal,
  };

  if (opts.body !== undefined) {
    init.body = opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new ApiException(0, {
      code: 'network_error',
      message: err instanceof Error ? err.message : 'Network error',
    });
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const error: ApiError = isJson
      ? payload?.error ?? { code: 'unknown', message: res.statusText }
      : { code: 'unknown', message: String(payload) };
    throw new ApiException(res.status, error);
  }

  return payload as T;
}
