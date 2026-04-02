import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getRentas, type RentaRow } from '../api/client';
import { RENTAS_LIST_BUMP_EVENT, RENTAS_LIST_BUMP_STORAGE_KEY } from '../lib/rentasListSync';
import {
  CRUD_FILTER_GRID,
  CRUD_HEADER_ROW,
  CRUD_PAGE_SUBTITLE,
  CRUD_PAGE_TITLE,
  CRUD_SEARCH_INNER,
  CRUD_SEARCH_INPUT,
  CRUD_SEARCH_LABEL,
  CRUD_SELECT,
  CRUD_SPINNER,
  CRUD_SPINNER_WRAP,
  CRUD_TABLE,
  CRUD_TABLE_OUTER,
  CRUD_TBODY,
  CRUD_THEAD_TR,
  CRUD_TOOLBAR,
  CrudTableTh,
  crudTableRowClass,
} from '../components/crud/crudCorporativo';

const EPS = 0.005;

const ESTADO_RENTA: Record<string, { label: string; color: string }> = {
  reservada: { label: 'Reservada', color: 'bg-amber-100 text-amber-800' },
  activa: { label: 'Activa', color: 'bg-emerald-100 text-emerald-800' },
  finalizada: { label: 'Finalizada', color: 'bg-slate-100 text-slate-600' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
};

function formatearFechaCorta(s: string) {
  if (!s) return '—';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function totalContrato(r: RentaRow) {
  return (r.monto ?? 0) + (r.deposito ?? 0);
}

function totalPagadoListado(r: RentaRow) {
  if (r.totalPagado != null) return r.totalPagado;
  return (r.pagos ?? []).reduce((s, p) => s + p.monto, 0);
}

function pagosCountListado(r: RentaRow) {
  if (r.pagosCount != null) return r.pagosCount;
  return r.pagos?.length ?? 0;
}

function saldoPendiente(r: RentaRow) {
  return totalContrato(r) - totalPagadoListado(r);
}

function badgeCobranza(r: RentaRow) {
  const saldo = saldoPendiente(r);
  const n = pagosCountListado(r);
  if (totalContrato(r) <= EPS && n === 0) {
    return { label: 'Sin monto', color: 'bg-slate-100 text-slate-600' };
  }
  if (saldo <= EPS) {
    return { label: 'Liquidado', color: 'bg-emerald-100 text-emerald-800' };
  }
  if (n === 0) {
    return { label: 'Pendiente', color: 'bg-amber-100 text-amber-900' };
  }
  return { label: 'Parcial', color: 'bg-sky-100 text-sky-900' };
}

type FiltroCobranza = 'todos' | 'liquidado' | 'adeudo' | 'pendiente' | 'parcial';

export function FinanzasPagos() {
  const navigate = useNavigate();
  const location = useLocation();
  const [rentas, setRentas] = useState<RentaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCobranza, setFiltroCobranza] = useState<FiltroCobranza>('todos');
  const [filtroEstadoRenta, setFiltroEstadoRenta] = useState<string>('');
  const rentasRef = useRef<RentaRow[]>([]);
  rentasRef.current = rentas;

  /** Sin pantalla de carga si ya hay filas (p. ej. volver del expediente o otra pestaña). */
  const refetchRentasSilently = useCallback(() => {
    getRentas()
      .then((rows) => setRentas(rows))
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'));
  }, []);

  useEffect(() => {
    if (location.pathname !== '/pagos') return;
    let cancel = false;
    const showBlockingLoad = rentasRef.current.length === 0;
    if (showBlockingLoad) setLoading(true);
    setError(null);
    getRentas()
      .then((rows) => {
        if (!cancel) setRentas(rows);
      })
      .catch((e) => {
        if (!cancel) setError(e instanceof Error ? e.message : 'Error al cargar');
      })
      .finally(() => {
        if (!cancel && showBlockingLoad) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [location.pathname, location.key]);

  useEffect(() => {
    if (location.pathname !== '/pagos') return;

    function onRentasBump() {
      refetchRentasSilently();
    }

    function onStorage(e: StorageEvent) {
      if (e.key === RENTAS_LIST_BUMP_STORAGE_KEY && e.newValue != null) {
        refetchRentasSilently();
      }
    }

    function onPageShow(pe: PageTransitionEvent) {
      if (pe.persisted) refetchRentasSilently();
    }

    window.addEventListener(RENTAS_LIST_BUMP_EVENT, onRentasBump);
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', onPageShow as (ev: Event) => void);
    return () => {
      window.removeEventListener(RENTAS_LIST_BUMP_EVENT, onRentasBump);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', onPageShow as (ev: Event) => void);
    };
  }, [location.pathname, refetchRentasSilently]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return rentas.filter((r) => {
      const saldo = saldoPendiente(r);
      const n = pagosCountListado(r);

      if (filtroEstadoRenta && r.estado !== filtroEstadoRenta) return false;

      switch (filtroCobranza) {
        case 'liquidado':
          if (saldo > EPS) return false;
          break;
        case 'adeudo':
          if (saldo <= EPS) return false;
          break;
        case 'pendiente':
          if (saldo <= EPS || n > 0) return false;
          break;
        case 'parcial':
          if (saldo <= EPS || n === 0) return false;
          break;
        default:
          break;
      }

      if (!q) return true;
      const idStr = String(r.id);
      const blob = [
        idStr,
        r.clienteNombre,
        r.placas,
        (r.numeroEconomico ?? '').trim(),
        r.clienteTelefono,
        r.clienteEmail,
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rentas, busqueda, filtroCobranza, filtroEstadoRenta]);

  const filtrosActivos =
    filtroCobranza !== 'todos' || !!filtroEstadoRenta || busqueda.trim().length > 0;

  function limpiarFiltros() {
    setBusqueda('');
    setFiltroCobranza('todos');
    setFiltroEstadoRenta('');
  }

  const conAdeudo = useMemo(() => rentas.filter((r) => saldoPendiente(r) > EPS).length, [rentas]);

  if (loading) {
    return (
      <div>
        <header className={CRUD_HEADER_ROW}>
          <div>
            <h1 className={CRUD_PAGE_TITLE}>Pagos</h1>
            <p className={CRUD_PAGE_SUBTITLE}>Cobranza por expediente de renta.</p>
          </div>
        </header>
        <div className={CRUD_SPINNER_WRAP}>
          <div className={CRUD_SPINNER} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <header className={CRUD_HEADER_ROW}>
          <div>
            <h1 className={CRUD_PAGE_TITLE}>Pagos</h1>
            <p className={CRUD_PAGE_SUBTITLE}>Cobranza por expediente de renta.</p>
          </div>
        </header>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <header className={CRUD_HEADER_ROW}>
        <div>
          <h1 className={CRUD_PAGE_TITLE}>Pagos</h1>
          <p className={CRUD_PAGE_SUBTITLE}>
            Pagos registrados por cliente y renta. Haz clic en una fila para abrir el expediente y registrar o revisar
            movimientos.
          </p>
          <p className="mt-2 text-xs font-medium text-skyline-muted">
            {conAdeudo > 0 ? (
              <>
                <span className="text-amber-800">{conAdeudo}</span> expediente{conAdeudo === 1 ? '' : 's'} con saldo
                pendiente
              </>
            ) : (
              'No hay adeudos pendientes en las rentas actuales.'
            )}
          </p>
        </div>
      </header>

      <div className={`${CRUD_TOOLBAR} mb-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-skyline-muted">
            <Icon icon="mdi:filter-variant" className="size-4 text-skyline-blue" aria-hidden />
            Buscar y filtrar
          </span>
          {filtrosActivos && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-skyline-blue ring-1 ring-skyline-blue/30 transition hover:bg-skyline-blue/10"
            >
              <Icon icon="mdi:close-circle-outline" className="size-3.5" aria-hidden />
              Limpiar
            </button>
          )}
        </div>
        <label htmlFor="busqueda-pagos" className="mt-3 block min-w-0 flex-1 lg:max-w-xl">
          <span className={CRUD_SEARCH_LABEL}>Buscar</span>
          <div className={CRUD_SEARCH_INNER}>
            <Icon icon="mdi:magnify" className="size-4 shrink-0 text-skyline-muted" aria-hidden />
            <input
              id="busqueda-pagos"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Cliente, placas, # expediente…"
              className={CRUD_SEARCH_INPUT}
              autoComplete="off"
            />
          </div>
        </label>
        <div className={`${CRUD_FILTER_GRID} mt-2`}>
          <label className={`block ${CRUD_SEARCH_LABEL}`}>
            Cobranza
            <select
              value={filtroCobranza}
              onChange={(e) => setFiltroCobranza(e.target.value as FiltroCobranza)}
              className={CRUD_SELECT}
            >
              <option value="todos">Todas</option>
              <option value="liquidado">Liquidado</option>
              <option value="adeudo">Con adeudo</option>
              <option value="pendiente">Pendiente (sin pagos)</option>
              <option value="parcial">Parcial (con pagos, falta saldo)</option>
            </select>
          </label>
          <label className={`block ${CRUD_SEARCH_LABEL}`}>
            Estado renta
            <select
              value={filtroEstadoRenta}
              onChange={(e) => setFiltroEstadoRenta(e.target.value)}
              className={CRUD_SELECT}
            >
              <option value="">Todos</option>
              {Object.entries(ESTADO_RENTA).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {rentas.length === 0 ? (
        <p className="text-sm text-gray-500">No hay rentas registradas.</p>
      ) : filtradas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-skyline-border bg-skyline-bg/50 py-12 text-center">
          <Icon icon="mdi:cash-off" className="mx-auto mb-3 size-12 text-gray-300" aria-hidden />
          <p className="font-medium text-gray-700">No hay resultados con estos criterios</p>
          {filtrosActivos && (
            <button type="button" onClick={limpiarFiltros} className="btn btn-outline mt-4 text-sm">
              Limpiar búsqueda y filtros
            </button>
          )}
        </div>
      ) : (
        <div className={CRUD_TABLE_OUTER}>
          <table className={`${CRUD_TABLE} min-w-[960px]`}>
            <thead>
              <tr className={CRUD_THEAD_TR}>
                <CrudTableTh className="min-w-[4.5rem] px-2 py-3 text-left align-middle" icon="mdi:pound" align="start">
                  Exp.
                </CrudTableTh>
                <CrudTableTh className="min-w-[8rem] px-2 py-3 text-left align-middle" icon="mdi:account-outline" align="start">
                  Cliente
                </CrudTableTh>
                <CrudTableTh className="min-w-[7rem] px-2 py-3 text-left align-middle" icon="mdi:truck-outline" align="start">
                  Unidad
                </CrudTableTh>
                <CrudTableTh className="min-w-[6.5rem] px-2 py-3 text-left align-middle" icon="mdi:calendar-range" align="start">
                  Periodo
                </CrudTableTh>
                <CrudTableTh className="min-w-[5rem] px-2 py-3 text-left align-middle" icon="mdi:file-sign" align="start">
                  Contrato
                </CrudTableTh>
                <CrudTableTh className="min-w-[5rem] px-2 py-3 text-left align-middle" icon="mdi:cash-check" align="start">
                  Pagado
                </CrudTableTh>
                <CrudTableTh className="min-w-[5rem] px-2 py-3 text-left align-middle" icon="mdi:cash-minus" align="start">
                  Saldo
                </CrudTableTh>
                <CrudTableTh className="min-w-[4rem] px-2 py-3 text-center align-middle" icon="mdi:numeric" align="center">
                  Mov.
                </CrudTableTh>
                <CrudTableTh className="min-w-[5rem] px-2 py-3 text-left align-middle" icon="mdi:calendar-clock" align="start">
                  Último pago
                </CrudTableTh>
                <CrudTableTh className="min-w-[5.5rem] px-2 py-3 text-left align-middle" icon="mdi:bookmark-check-outline" align="start">
                  Cobranza
                </CrudTableTh>
                <CrudTableTh className="min-w-[5rem] px-2 py-3 text-left align-middle" icon="mdi:flag-outline" align="start">
                  Estado
                </CrudTableTh>
                <CrudTableTh className="w-[1%] px-2 py-3 text-center align-middle" icon="mdi:open-in-new" align="center">
                  Expediente
                </CrudTableTh>
              </tr>
            </thead>
            <tbody className={CRUD_TBODY}>
              {filtradas.map((r, rowIdx) => {
                const pagado = totalPagadoListado(r);
                const saldo = saldoPendiente(r);
                const nPagos = pagosCountListado(r);
                const totalContr = totalContrato(r);
                const cob = badgeCobranza(r);
                const est = ESTADO_RENTA[r.estado];
                return (
                  <tr
                    key={r.id}
                    className={crudTableRowClass(rowIdx, { clickable: true })}
                    onClick={() => navigate(`/rentas/${r.id}`)}
                  >
                    <td className="px-3 py-2.5 align-middle font-semibold tabular-nums text-slate-900">#{r.id}</td>
                    <td className="max-w-[10rem] truncate px-3 py-2.5 align-middle text-sm" title={r.clienteNombre}>
                      {r.clienteNombre || '—'}
                    </td>
                    <td className="px-3 py-2.5 align-middle text-sm">
                      {(r.numeroEconomico ?? '').trim() ? (
                        <span className="font-medium">{r.numeroEconomico}</span>
                      ) : null}
                      {(r.numeroEconomico ?? '').trim() ? (
                        <span className="block text-xs text-slate-600">{r.placas}</span>
                      ) : (
                        <span>{r.placas}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-middle text-xs text-slate-600">
                      {formatearFechaCorta(r.fechaInicio)} – {formatearFechaCorta(r.fechaFin)}
                    </td>
                    <td className="px-3 py-2.5 align-middle text-sm font-semibold tabular-nums">${totalContr.toLocaleString('es-MX')}</td>
                    <td className="px-3 py-2.5 align-middle text-sm tabular-nums text-slate-700">${pagado.toLocaleString('es-MX')}</td>
                    <td className="px-3 py-2.5 align-middle text-sm font-semibold tabular-nums">
                      {saldo <= EPS ? (
                        <span className="text-emerald-700">$0</span>
                      ) : (
                        <span className="text-amber-800">${saldo.toLocaleString('es-MX')}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle text-sm tabular-nums text-slate-600">{nPagos}</td>
                    <td className="px-3 py-2.5 align-middle text-xs text-slate-600">
                      {r.ultimaFechaPago ? formatearFechaCorta(r.ultimaFechaPago) : '—'}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${cob.color}`}>{cob.label}</span>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${est?.color ?? 'bg-gray-100'}`}>{est?.label ?? r.estado}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => navigate(`/rentas/${r.id}`)}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-skyline-blue"
                        title="Abrir expediente"
                      >
                        <Icon icon="mdi:file-document-outline" className="size-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
