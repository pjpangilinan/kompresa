import { apiFetch } from './client';
import type { LoginRequest, LoginResponse } from '../lib/types';

export async function login(req: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/login', {
    method: 'POST',
    body: req,
  });
}

export async function logout(): Promise<void> {
  return apiFetch<void>('/api/logout', { method: 'POST' });
}

export async function checkSession(): Promise<{ authenticated: boolean }> {
  return apiFetch<{ authenticated: boolean }>('/api/session');
}
