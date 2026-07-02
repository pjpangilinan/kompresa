import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function TopBar() {
  const { authenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50">
      <div className="bg-surface-container-lowest border-b-2 border-primary-container shadow-cyber">
        <div className="h-1 bg-primary-container" />
        <div className="flex items-center justify-between px-4 md:px-8 py-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 group"
            aria-label="Go to dashboard"
          >
            <span
              className="material-symbols-outlined text-primary-container text-[28px] group-hover:scale-110 transition-transform"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              precision_manufacturing
            </span>
            <h1 className="font-headline-md text-headline-md text-primary-container uppercase tracking-widest -skew-x-6 leading-none">
              <span className="skew-x-6 inline-block">KOMPRESSA</span>
            </h1>
          </button>

          <div className="hidden sm:flex items-center gap-2 font-label-mono text-label-mono text-on-surface-variant border border-primary-container/40 px-3 py-1">
            <span
              className="w-2 h-2 rounded-full bg-success"
              aria-hidden="true"
            />
            <span className="uppercase tracking-widest">SYS: NOMINAL</span>
          </div>

          <div className="flex items-center gap-4">
            {authenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="font-label-mono text-label-mono text-on-surface-variant opacity-70 hover:text-primary-container hover:skew-x-2 transition-transform uppercase flex items-center gap-2"
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  logout
                </span>
                LOGOUT
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
