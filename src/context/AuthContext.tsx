import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { checkSession, login as apiLogin, logout as apiLogout } from '../api/auth';
import { ApiException, setBearerToken } from '../api/client';
import type { LoginRequest } from '../lib/types';
import { AuthContext, type AuthState } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('loading');

  const refresh = useCallback(async () => {
    try {
      const res = await checkSession();
      setState(res.authenticated ? 'authenticated' : 'unauthenticated');
    } catch (err) {
      if (err instanceof ApiException && err.status === 401) {
        setState('unauthenticated');
      } else {
        setState('unauthenticated');
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (req: LoginRequest) => {
    const res = await apiLogin(req);
    if ('token' in res) {
      setBearerToken((res as any).token);
    }
    setState('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
    } finally {
      setState('unauthenticated');
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ state, authenticated: state === 'authenticated', login, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}
