import { createContext } from 'react';
import type { LoginRequest } from '../lib/types';

export type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthContextValue = {
  state: AuthState;
  authenticated: boolean;
  login: (req: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
