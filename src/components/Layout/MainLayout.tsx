import { Outlet } from 'react-router-dom';
import { Notifications } from '../Notifications';
import { SupportChat } from '../SupportChat';
import { Sidebar } from './Sidebar';

export function MainLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <SupportChat />
      <main className="min-h-screen flex-1 flex flex-col bg-skyline-bg">
        <header className="sticky top-0 z-40 flex shrink-0 items-center justify-end gap-4 border-b border-skyline-border bg-white px-6 py-3">
          <Notifications />
        </header>
        <div className="flex-1 p-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
