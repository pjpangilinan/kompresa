import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { SkipLink } from './SkipLink';

const TOP_BAR_HEIGHT = '4rem';

export function Layout() {
  return (
    <div className="min-h-screen w-screen flex flex-col">
      <SkipLink />
      <TopBar />
      <main
        id="main-content"
        className="flex-grow relative z-10 px-4 md:px-8 pt-4 pb-8 flex items-center justify-center"
        style={{ minHeight: `calc(100vh - ${TOP_BAR_HEIGHT})` }}
      >
        <Outlet />
      </main>
    </div>
  );
}
