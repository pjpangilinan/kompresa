import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ApiException } from '../api/client';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

const ARTIFICIAL_DELAY_MS = 600;

export function Login() {
  const navigate = useNavigate();
  const { state, login, authenticated } = useAuth();

  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  useEffect(() => {
    if (authenticated) navigate('/dashboard', { replace: true });
  }, [authenticated, navigate]);

  useEffect(() => {
    if (state === 'loading') return;
    if (authenticated) navigate('/dashboard', { replace: true });
  }, [state, authenticated, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const start = Date.now();
    try {
      await login({ password, totp });
      const elapsed = Date.now() - start;
      if (elapsed < ARTIFICIAL_DELAY_MS) {
        await new Promise((r) => setTimeout(r, ARTIFICIAL_DELAY_MS - elapsed));
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const elapsed = Date.now() - start;
      if (elapsed < ARTIFICIAL_DELAY_MS) {
        await new Promise((r) => setTimeout(r, ARTIFICIAL_DELAY_MS - elapsed));
      }
      setFailedAttempts((n) => n + 1);
      if (err instanceof ApiException && err.status === 401) {
        setError('Invalid credentials. Access denied.');
      } else if (err instanceof ApiException && err.status === 429) {
        setError('Too many attempts. Cool down before retrying.');
      } else {
        setError('Authentication service unavailable.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const showCaptcha = failedAttempts >= 3;

  return (
    <div className="w-full flex items-center justify-center py-3 relative">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-halftone" />

      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 bg-primary-container translate-x-3 translate-y-3 -z-10 clip-jagged" />

        <div className="relative bg-surface-container-high border-2 border-surface-container-highest clip-jagged p-8 shadow-cyber">
          <div className="glitch-header" />

          <div className="text-center mb-8 mt-2">
            <h1 className="font-headline-lg text-headline-lg text-primary-container uppercase -skew-x-6 leading-none">
              <span className="skew-x-6 inline-block">ACCESS_GATE</span>
            </h1>
            <p className="font-label-mono text-label-mono text-on-surface-variant opacity-60 mt-3 uppercase tracking-widest">
              KOMPRESSA // v1.0
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-8" noValidate>
            <Input
              label="PASSPHRASE"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={submitting}
            />
            <Input
              label="TOTP_CODE"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
              autoComplete="one-time-code"
              required
              disabled={submitting}
            />

            {showCaptcha ? (
              <div className="border-2 border-primary-container p-4 bg-surface-container-lowest">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-primary-container"
                    required
                  />
                  <span className="font-label-mono text-label-mono uppercase text-on-surface">
                    VERIFY_HUMAN
                  </span>
                </label>
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="border-2 border-error bg-error-container/20 p-3 font-label-mono text-label-mono text-error uppercase"
              >
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              loading={submitting}
              disabled={!password || totp.length !== 6}
              icon={
                <span
                  className="material-symbols-outlined text-[28px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  lock_open
                </span>
              }
            >
              AUTHENTICATE
            </Button>
          </form>

          <p className="mt-6 text-center font-label-mono text-label-mono text-on-surface-variant opacity-40 uppercase">
            [ DEV_HINT: passphrase=phantom, totp=000000 ]
          </p>
        </div>
      </div>
    </div>
  );
}
