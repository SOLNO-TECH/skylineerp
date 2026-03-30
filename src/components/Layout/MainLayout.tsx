import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { Notifications } from '../Notifications';
import { SupportChat } from '../SupportChat';
import { Sidebar } from './Sidebar';

export function MainLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      {/* Overlay móvil detrás del drawer */}
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Cerrar menú de navegación"
          className="fixed inset-0 z-[50] bg-black/45 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      <SupportChat />
      <main className="flex min-h-screen min-w-0 flex-1 flex-col bg-skyline-bg">
        <header className="sticky top-0 z-40 flex shrink-0 items-center gap-3 border-b border-skyline-border bg-white px-4 py-3 sm:px-6">
          <button
            type="button"
            className="touch-manipulation rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
            aria-expanded={mobileNavOpen}
            aria-controls="app-sidebar"
            aria-label="Abrir menú"
            onClick={() => setMobileNavOpen(true)}
          >
            <Icon icon="mdi:menu" className="size-6" aria-hidden />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#162036] md:hidden">
            SKYLINE ERP
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Notifications />
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6 md:p-8">
          <div className="mx-auto w-full min-w-0 max-w-6xl">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
