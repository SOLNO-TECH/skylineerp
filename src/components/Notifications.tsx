import { Icon } from '@iconify/react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getRentasProximosVencimientos,
  getMantenimientos,
  getUnidades,
} from '../api/client';

type Notif = {
  id: string;
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
  tipo: 'mantenimiento' | 'renta' | 'general';
};

const LEIDAS_KEY = 'skyline-notifs-leidas';
const COMBUSTIBLE_UMBRAL_PCT = 20;
const MANTO_VENTANA_DIAS = 30;

function loadLeidasFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(LEIDAS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveLeidasToStorage(ids: Set<string>) {
  try {
    localStorage.setItem(LEIDAS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota */
  }
}

function startOfDayMs(isoDate: string): number {
  const s = isoDate.slice(0, 10);
  return new Date(`${s}T12:00:00`).setHours(0, 0, 0, 0);
}

function formatDateShort(isoDate: string): string {
  const s = isoDate.slice(0, 10);
  return new Date(`${s}T12:00:00`).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  });
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Etiqueta relativa: fechas futuras y pasadas. */
function formatFecha(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const past = diffMs < 0;

  if (!past) {
    if (abs < 60_000) return 'En breve';
    if (abs < 3_600_000) return `En ${Math.max(1, Math.ceil(abs / 60_000))} min`;
    if (abs < 86_400_000) return `En ${Math.max(1, Math.ceil(abs / 3_600_000))} h`;
    const days = Math.ceil(abs / 86_400_000);
    if (days === 1) return 'Mañana';
    return `En ${days} días`;
  }

  if (abs < 60_000) return 'Ahora';
  if (abs < 3_600_000) return `Hace ${Math.floor(abs / 60_000)} min`;
  if (abs < 86_400_000) return `Hace ${Math.floor(abs / 3_600_000)} h`;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

async function buildNotificacionesDesdeApi(): Promise<Omit<Notif, 'leida'>[]> {
  const [rentas, mantos, unidades] = await Promise.all([
    getRentasProximosVencimientos(21),
    getMantenimientos(),
    getUnidades(),
  ]);

  const items: Omit<Notif, 'leida'>[] = [];

  for (const r of rentas) {
    const cliente = (r.clienteNombre || '').trim() || 'Cliente';
    items.push({
      id: `renta-vence-${r.id}`,
      titulo: 'Renta por finalizar',
      mensaje: `${r.placas} — fin ${formatDateShort(r.fechaFin)} · ${cliente}`,
      fecha: `${r.fechaFin.slice(0, 10)}T18:00:00`,
      tipo: 'renta',
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limitEnd = new Date(today);
  limitEnd.setDate(limitEnd.getDate() + MANTO_VENTANA_DIAS);
  const staleBefore = new Date(today);
  staleBefore.setDate(staleBefore.getDate() - 45);

  for (const m of mantos) {
    if (m.estado !== 'programado' && m.estado !== 'en_proceso') continue;
    const startMs = startOfDayMs(m.fechaInicio);
    if (startMs > limitEnd.getTime()) continue;
    if (startMs < staleBefore.getTime()) continue;

    const placas = (m.placas || '').trim() || 'Unidad';
    const estadoLabel = m.estado === 'en_proceso' ? 'En proceso' : 'Programado';
    items.push({
      id: `mantenimiento-${m.id}`,
      titulo: 'Mantenimiento',
      mensaje: `${placas}: ${m.tipo} — ${estadoLabel.toLowerCase()} · ${truncate(m.descripcion, 42)}`,
      fecha: `${m.fechaInicio.slice(0, 10)}T09:00:00`,
      tipo: 'mantenimiento',
    });
  }

  for (const u of unidades) {
    if (u.estatus !== 'En Renta') continue;
    if (u.combustiblePct >= COMBUSTIBLE_UMBRAL_PCT) continue;
    items.push({
      id: `combustible-${u.id}`,
      titulo: 'Combustible bajo',
      mensaje: `${u.placas}: ${u.combustiblePct}% · unidad en renta`,
      fecha: new Date().toISOString(),
      tipo: 'general',
    });
  }

  items.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  return items.slice(0, 25);
}

export function Notifications() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState<Omit<Notif, 'leida'>[]>([]);
  const [leidas, setLeidas] = useState<Set<string>>(loadLeidasFromStorage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setRaw([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await buildNotificacionesDesdeApi();
      setRaw(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las notificaciones');
      setRaw([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const notifs: Notif[] = useMemo(
    () => raw.map((n) => ({ ...n, leida: leidas.has(n.id) })),
    [raw, leidas],
  );

  const sinLeer = notifs.filter((n) => !n.leida).length;

  function marcarLeida(id: string) {
    setLeidas((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveLeidasToStorage(next);
      return next;
    });
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
              {loading
                ? 'Actualizando…'
                : sinLeer > 0
                  ? `${sinLeer} sin leer`
                  : notifs.length > 0
                    ? 'Todo al día'
                    : 'Sin alertas recientes'}
            </p>
          </div>
          {error && (
            <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">{error}</p>
          )}
          <ul className="max-h-80 overflow-y-auto">
            {loading && notifs.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-500">Cargando…</li>
            ) : notifs.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-500">
                No hay rentas por vencer, mantenimientos programados ni alertas de combustible en este momento.
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
                              : 'mdi:fuel'
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
