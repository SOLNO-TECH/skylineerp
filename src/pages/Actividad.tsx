import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getActividadReciente, type ActividadItem } from '../api/client';

const LIMITE = 150;

function formatHoraRelativa(fechaStr: string): string {
  if (!fechaStr) return '';
  const normalized = fechaStr.includes('T') ? fechaStr : fechaStr.replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return fechaStr;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffH < 24) return `Hace ${diffH} h`;
  if (diffD === 1) return 'Ayer';
  if (diffD < 7) return `Hace ${diffD} días`;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatFechaCompleta(fechaStr: string): string {
  if (!fechaStr) return '';
  const normalized = fechaStr.includes('T') ? fechaStr : fechaStr.replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return fechaStr;
  return d.toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TIPO_ETIQUETA: Record<ActividadItem['tipo'], string> = {
  unidad: 'Unidad',
  renta: 'Renta',
  usuario: 'Usuario',
  mantenimiento: 'Mantenimiento',
  auth: 'Sesión',
  sistema: 'Sistema',
  proveedor: 'Proveedor',
  cliente: 'Cliente',
};

/** Si el icono de API está vacío o no es mdi:, usar uno por tipo. */
const ICONO_DEFAULT_POR_TIPO: Record<ActividadItem['tipo'], string> = {
  unidad: 'mdi:truck-outline',
  renta: 'mdi:calendar-month',
  usuario: 'mdi:account-outline',
  mantenimiento: 'mdi:wrench-outline',
  auth: 'mdi:login',
  sistema: 'mdi:information-outline',
  proveedor: 'mdi:truck-delivery-outline',
  cliente: 'mdi:account-tie-outline',
};

function iconoActividad(item: ActividadItem): string {
  const raw = (item.icon || '').trim();
  /** p. ej. mdi:car-plus (el «+» no encaja en \w en regex estricta). */
  if (raw.includes(':') && raw.length > 2) return raw;
  return ICONO_DEFAULT_POR_TIPO[item.tipo] ?? 'mdi:information';
}

type FiltroTipo = 'todos' | ActividadItem['tipo'];

export function Actividad() {
  const [items, setItems] = useState<ActividadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroTipo>('todos');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getActividadReciente(LIMITE)
      .then((a) => {
        if (!cancelled) setItems(a);
      })
      .catch((e) => {
        if (!cancelled) {
          setItems([]);
          setError(e instanceof Error ? e.message : 'Error al cargar actividad');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return items;
    return items.filter((i) => i.tipo === filtro);
  }, [items, filtro]);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Actividad</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Registro de auditoría: altas, bajas, ediciones, pagos, documentos, usuarios, mantenimiento e inicios de
            sesión.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as FiltroTipo)}
            className="rounded-md border border-skyline-border bg-white px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
          >
            <option value="todos">Todos</option>
            <option value="unidad">Unidades</option>
            <option value="renta">Rentas</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="usuario">Usuarios</option>
            <option value="proveedor">Proveedores</option>
            <option value="auth">Sesiones</option>
            <option value="sistema">Sistema</option>
          </select>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-skyline-border bg-white shadow-sm">
        <ul className="divide-y divide-skyline-border">
          {loading ? (
            <li className="px-4 py-8 text-center text-sm text-gray-500">Cargando actividad...</li>
          ) : filtrados.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-gray-500">
              {items.length === 0
                ? 'Sin actividad registrada aún. Cada acción en el ERP quedará listada aquí automáticamente.'
                : 'No hay ítems con este filtro.'}
            </li>
          ) : (
            filtrados.map((item) => (
              <li key={item.id} className="flex gap-4 px-4 py-3 hover:bg-gray-50/50">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-skyline-blue/10 text-skyline-blue">
                  <Icon icon={iconoActividad(item)} className="size-4 shrink-0" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{item.accion}</p>
                  {item.detalle ? (
                    <p className="mt-0.5 text-sm text-gray-600">{item.detalle}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-gray-500">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600">
                      {TIPO_ETIQUETA[item.tipo] ?? item.tipo}
                    </span>
                    {item.usuarioNombre ? (
                      <>
                        {' · '}
                        <span>Por: {item.usuarioNombre}</span>
                      </>
                    ) : null}
                    {item.placas ? (
                      <>
                        {' · '}
                        <span>{item.placas}</span>
                      </>
                    ) : null}
                    {item.clienteNombre ? (
                      <>
                        {' · '}
                        <span>{item.clienteNombre}</span>
                      </>
                    ) : null}
                    {item.rentaId ? (
                      <>
                        {' · '}
                        <Link
                          to={`/rentas/${item.rentaId}`}
                          className="text-skyline-blue hover:underline"
                        >
                          Ver expediente
                        </Link>
                      </>
                    ) : null}
                    {item.tipo === 'cliente' && item.clienteId ? (
                      <>
                        {' · '}
                        <Link
                          to={`/clientes/${item.clienteId}`}
                          className="text-skyline-blue hover:underline"
                        >
                          Ver expediente cliente
                        </Link>
                      </>
                    ) : null}
                    {item.mantenimientoId ? (
                      <>
                        {' · '}
                        <Link to="/mantenimiento" className="text-skyline-blue hover:underline">
                          Ver mantenimiento
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium text-gray-700">{formatHoraRelativa(item.fecha)}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">{formatFechaCompleta(item.fecha)}</p>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {!loading && items.length > 0 && (
        <p className="mt-3 text-center text-xs text-gray-400">
          Mostrando hasta {LIMITE} eventos más recientes ·{' '}
          <Link to="/" className="text-skyline-blue hover:underline">
            Volver al inicio
          </Link>
        </p>
      )}
    </div>
  );
}
