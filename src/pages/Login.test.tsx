import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from './Login';
import { AuthProvider } from '../context/AuthContext';

vi.mock('../api/auth', () => ({
  checkSession: vi.fn().mockResolvedValue({ authenticated: false }),
  login: vi.fn(),
  logout: vi.fn(),
}));

import { login as apiLogin } from '../api/auth';

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both fields and submit button', async () => {
    renderLogin();
    expect(screen.getByLabelText(/passphrase/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/totp/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /authenticate/i })).toBeInTheDocument();
  });

  it('disables submit until both fields valid', () => {
    renderLogin();
    const submit = screen.getByRole('button', { name: /authenticate/i });
    expect(submit).toBeDisabled();
  });

  it('shows error on bad credentials', async () => {
    (apiLogin as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error('Invalid credentials'), { status: 401, code: 'invalid_credentials' }),
    );
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/passphrase/i), 'wrong');
    await user.type(screen.getByLabelText(/totp/i), '000000');
    await user.click(screen.getByRole('button', { name: /authenticate/i }));
    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    expect(alert.textContent).toBeTruthy();
  });

  it('calls apiLogin with both fields on submit', async () => {
    (apiLogin as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ expires_at: Date.now() + 1000 });
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/passphrase/i), 'phantom');
    await user.type(screen.getByLabelText(/totp/i), '000000');
    await user.click(screen.getByRole('button', { name: /authenticate/i }));
    await waitFor(() => {
      expect(apiLogin).toHaveBeenCalledWith({ password: 'phantom', totp: '000000' });
    });
  });
});
