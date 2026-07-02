import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';

export function Layout() {
  return (
    <div className="min-h-screen w-screen flex flex-col relative">
      <TopBar />
      <main className="flex-grow relative z-10 pt-20 pb-12">
        <Outlet />
      </main>
    </div>
  );
}
