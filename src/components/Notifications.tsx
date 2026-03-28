import { Icon } from '@iconify/react';
import { useState, useRef, useEffect } from 'react';

type Notif = {
  id: string;
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
  tipo: 'mantenimiento' | 'renta' | 'general';
};

const mockNotifs: Notif[] = [
  {
    id: '1',
    titulo: 'Mantenimiento próximo',
    mensaje: 'GHI-90-12: cambio de aceite vence en 4 días.',
    fecha: new Date().toISOString(),
    leida: false,
    tipo: 'mantenimiento',
  },
  {
    id: '2',
    titulo: 'Renta por finalizar',
    mensaje: 'ABC-12-34 — Check-out programado hoy 10:00.',
    fecha: new Date(Date.now() - 3600000).toISOString(),
    leida: false,
    tipo: 'renta',
  },
  {
    id: '3',
    titulo: 'Seguro por vencer',
    mensaje: 'DEF-56-78: seguro vence el 25 Mar.',
    fecha: new Date(Date.now() - 86400000).toISOString(),
    leida: true,
    tipo: 'general',
  },
];

function formatFecha(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Ahora';
  if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} h`;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

export function Notifications() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>(mockNotifs);
  const ref = useRef<HTMLDivElement>(null);

  const sinLeer = notifs.filter((n) => !n.leida).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function marcarLeida(id: string) {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-10 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900"
        aria-label={sinLeer > 0 ? `${sinLeer} notificaciones nuevas` : 'Notificaciones'}
      >
        <Icon icon="mdi:bell-outline" className="size-6" aria-hidden />
        {sinLeer > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-skyline-red text-[10px] font-bold text-white">
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-menu-open absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-skyline-border bg-white shadow-lg">
          <div className="border-b border-skyline-border bg-skyline-bg px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
            <p className="text-xs text-gray-500">
              {sinLeer > 0 ? `${sinLeer} sin leer` : 'Todo al día'}
            </p>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-500">
                No hay notificaciones.
              </li>
            ) : (
              notifs.map((n) => (
                <li
                  key={n.id}
                  onClick={() => marcarLeida(n.id)}
                  className={`cursor-pointer border-b border-skyline-border px-4 py-3 transition-colors last:border-0 hover:bg-skyline-blue/5 ${
                    !n.leida ? 'bg-skyline-blue/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ${
                        n.tipo === 'mantenimiento'
                          ? 'bg-amber-500/15 text-amber-600'
                          : n.tipo === 'renta'
                            ? 'bg-blue-500/15 text-blue-600'
                            : 'bg-gray-500/15 text-gray-600'
                      }`}
                    >
                      <Icon
                        icon={
                          n.tipo === 'mantenimiento'
                            ? 'mdi:wrench'
                            : n.tipo === 'renta'
                              ? 'mdi:key-chain'
                              : 'mdi:information'
                        }
                        className="size-4"
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${!n.leida ? 'text-gray-900' : 'text-gray-700'}`}>
                        {n.titulo}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{n.mensaje}</p>
                      <span className="mt-1 inline-block text-[10px] text-skyline-muted">
                        {formatFecha(n.fecha)}
                      </span>
                    </div>
                    {!n.leida && (
                      <span className="size-2 shrink-0 rounded-full bg-skyline-blue" aria-hidden />
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
