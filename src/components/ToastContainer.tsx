import { Icon } from '@iconify/react';
import { useLocation } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';

const iconByType = {
  success: 'mdi:check-circle',
  error: 'mdi:alert-circle',
  warning: 'mdi:alert',
  info: 'mdi:information',
};

const styleByType = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
};

const iconStyleByType = {
  success: 'text-emerald-600',
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-sky-600',
};

export function ToastContainer() {
  const { pathname } = useLocation();
  const { toasts, removeToast } = useNotification();
  const isLogin = pathname === '/login';

  if (toasts.length === 0) return null;

  const toastList = toasts.map((t) => (
    <div
      key={t.id}
      className={`toast-from-bell-item pointer-events-auto flex min-w-[280px] max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${styleByType[t.tipo]}`}
      role="alert"
    >
      <Icon
        icon={iconByType[t.tipo]}
        className={`mt-0.5 size-5 shrink-0 ${iconStyleByType[t.tipo]}`}
        aria-hidden
      />
      <p className="flex-1 text-sm font-medium">{t.mensaje}</p>
      <button
        type="button"
        onClick={() => removeToast(t.id)}
        className="-mr-1 -mt-1 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
        aria-label="Cerrar notificación"
      >
        <Icon icon="mdi:close" className="size-4" />
      </button>
    </div>
  ));

  if (isLogin) {
    return (
      <div
        className="fixed bottom-6 left-1/2 z-[100] flex w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 flex-col gap-2"
        aria-live="polite"
        aria-label="Mensajes"
      >
        {toastList}
      </div>
    );
  }

  /* Bajo la barra superior: py-3 + botón campana h-10 + py-3 + separación (~4.5rem) */
  return (
    <div
      className="pointer-events-none fixed right-6 top-[4.5rem] z-[100] flex max-w-sm flex-col items-end gap-1"
      aria-live="polite"
      aria-label="Alertas del sistema"
    >
      <div className="pointer-events-none flex h-2.5 w-full max-w-sm justify-end">
        <span
          className="mr-5 mt-0.5 block h-2 w-2 rotate-45 border-l border-t border-skyline-border bg-white shadow-sm ring-1 ring-black/[0.06]"
          aria-hidden
        />
      </div>
      <div className="flex w-full flex-col items-end gap-2">{toastList}</div>
    </div>
  );
}
