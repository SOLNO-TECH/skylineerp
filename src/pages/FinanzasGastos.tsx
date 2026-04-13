import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  getFinanzasGastosResumenApi,
  type FinanzasGastoMovimiento,
  type FinanzasGastoMovimientoTipo,
  type FinanzasGastosResumen,
} from '../api/client';
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

const enlaces = [
  {
    to: '/mantenimiento',
    label: 'Mantenimiento',
    desc: 'Registrar y editar costos por unidad.',
    icon: 'mdi:wrench-outline' as const,
  },
  {
    to: '/administracion/proveedores',
    label: 'Proveedores',
    desc: 'Facturas, pagos y expediente por proveedor.',
    icon: 'mdi:truck-delivery-outline' as const,
  },
  {
    to: '/administracion/reportes-proveedores',
    label: 'Reportes CxP',
    desc: 'Adeudos y facturación agregada.',
    icon: 'mdi:file-chart-outline' as const,
  },
];

const TIPO_META: Record<
  FinanzasGastoMovimientoTipo,
  { label: string; short: string; color: string; icon: string }
> = {
  mantenimiento: {
    label: 'Mantenimiento',
    short: 'Mant.',
    color: 'bg-violet-100 text-violet-900',
    icon: 'mdi:wrench',
  },
  mulita_mantenimiento: {
    label: 'Mulita + mantenimiento',
    short: 'Mul+mtto',
    color: 'bg-fuchsia-100 text-fuchsia-900',
    icon: 'mdi:link-variant',
  },
  operacion_mulita: {
    label: 'Operación mulita',
    short: 'Mulita',
    color: 'bg-indigo-100 text-indigo-900',
    icon: 'mdi:forklift',
  },
  factura_proveedor: {
    label: 'Factura proveedor',
    short: 'Factura',
    color: 'bg-amber-100 text-amber-900',
    icon: 'mdi:file-document-outline',
  },
  pago_proveedor: {
    label: 'Pago a proveedor',
    short: 'Pago',
    color: 'bg-emerald-100 text-emerald-900',
    icon: 'mdi:cash-minus',
  },
};

function formatearFecha(s: string) {
  if (!s) return '—';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

type FiltroTipo = 'todos' | FinanzasGastoMovimientoTipo;

const TIPOS_GASTO_QUERY: Set<FiltroTipo> = new Set([
  'todos',
  'mantenimiento',
  'mulita_mantenimiento',
  'operacion_mulita',
  'factura_proveedor',
  'pago_proveedor',
]);

function filtroTipoDesdeQuery(v: string | null): FiltroTipo {
  if (v && TIPOS_GASTO_QUERY.has(v as FiltroTipo)) return v as FiltroTipo;
  return 'todos';
}

export function FinanzasGastos() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<FinanzasGastosResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>(() => filtroTipoDesdeQuery(searchParams.get('tipo')));

  useEffect(() => {
    setFiltroTipo(filtroTipoDesdeQuery(searchParams.get('tipo')));
  }, [searchParams]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    getFinanzasGastosResumenApi(300)
      .then((r) => {
        if (!cancel) setData(r);
      })
      .catch((e) => {
        if (!cancel) setError(e instanceof Error ? e.message : 'Error al cargar');
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const filtrados = useMemo(() => {
    const movs = data?.movimientos ?? [];
    const q = busqueda.trim().toLowerCase();
    return movs.filter((m) => {
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;
      if (!q) return true;
      const blob = [
        m.concepto,
        m.proveedorNombre,
        m.unidadPlacas,
        m.id,
        TIPO_META[m.tipo].label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [data, busqueda, filtroTipo]);

  const tot = data?.totales;

  return (
    <div>
      <header className={CRUD_HEADER_ROW}>
        <div>
          <h1 className={CRUD_PAGE_TITLE}>Gastos</h1>
          <p className={CRUD_PAGE_SUBTITLE}>
            Control de egresos y compromisos según lo registrado en el ERP: costos de mantenimiento de flota, facturas de
            proveedores, operación de mulitas y pagos aplicados a esas facturas.
          </p>
        </div>
      </header>

      <div className="mb-6 rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white p-4 text-sm text-slate-700 shadow-sm">
        <p className="flex items-start gap-2">
          <Icon icon="mdi:information-outline" className="mt-0.5 size-5 shrink-0 text-skyline-blue" aria-hidden />
          <span>
            <strong className="font-semibold text-slate-900">Cómo leer los importes:</strong> el total de{' '}
            <em>mantenimiento</em> incluye costos del módulo de mantenimiento más los gastos mulita vinculados a una orden de
            mantenimiento;{' '}
            <em>operación mulitas</em> suma nómina operador, diésel, horas extras, extras de operación, gastos fijos de operación y
            bono de puntualidad por unidad mulita. En
            proveedores,{' '}
            <em>facturado</em> es el monto de facturas activas; <em>pagado</em>, lo abonado; <em>saldo</em>, la diferencia
            (cuentas por pagar). En la tabla, una misma operación puede aparecer como factura y luego como uno o más pagos:
            no sumes ambos como “doble gasto” en un mismo análisis de caja.
          </span>
        </p>
      </div>

      {loading ? (
        <div className={CRUD_SPINNER_WRAP}>
          <div className={CRUD_SPINNER} />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <>
          <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumen de gastos">
            <div className="rounded-xl border border-skyline-border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-skyline-muted">Mantenimiento</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                ${(tot?.mantenimiento ?? 0).toLocaleString('es-MX')}
              </p>
              <p className="mt-1 text-xs text-gray-500">Suma de costos en órdenes de mantenimiento</p>
            </div>
            <div className="rounded-xl border border-skyline-border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-skyline-muted">Operación mulitas</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-900">
                ${(tot?.operacionMulitas ?? 0).toLocaleString('es-MX')}
              </p>
              <p className="mt-1 text-xs text-gray-500">Nómina, diésel, horas extras, extras operación y bono puntualidad</p>
            </div>
            <div className="rounded-xl border border-skyline-border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-skyline-muted">Proveedores facturado</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900">
                ${(tot?.proveedoresFacturado ?? 0).toLocaleString('es-MX')}
              </p>
              <p className="mt-1 text-xs text-gray-500">Total de facturas registradas (activas)</p>
            </div>
            <div className="rounded-xl border border-skyline-border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-skyline-muted">Proveedores pagado</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
                ${(tot?.proveedoresPagado ?? 0).toLocaleString('es-MX')}
              </p>
              <p className="mt-1 text-xs text-gray-500">Pagos aplicados a facturas</p>
            </div>
            <div className="rounded-xl border border-skyline-border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-skyline-muted">Saldo CxP</p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  (tot?.proveedoresSaldo ?? 0) > 0.01 ? 'text-red-700' : 'text-slate-700'
                }`}
              >
                ${(tot?.proveedoresSaldo ?? 0).toLocaleString('es-MX')}
              </p>
              <p className="mt-1 text-xs text-gray-500">Facturado menos pagado (pendiente por liquidar)</p>
            </div>
          </section>

          <div className={`${CRUD_TOOLBAR} mb-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-skyline-muted">
                <Icon icon="mdi:format-list-bulleted" className="size-4 text-skyline-blue" aria-hidden />
                Movimientos recientes
              </span>
              <span className="text-xs text-gray-500">Hasta 300 registros · más antiguos en cada módulo</span>
            </div>
            <label htmlFor="busqueda-gastos" className="mt-3 block min-w-0 flex-1 lg:max-w-xl">
              <span className={CRUD_SEARCH_LABEL}>Buscar</span>
              <div className={CRUD_SEARCH_INNER}>
                <Icon icon="mdi:magnify" className="size-4 shrink-0 text-skyline-muted" aria-hidden />
                <input
                  id="busqueda-gastos"
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Concepto, proveedor, placas, tipo…"
                  className={CRUD_SEARCH_INPUT}
                  autoComplete="off"
                />
              </div>
            </label>
            <div className={`${CRUD_FILTER_GRID} mt-2`}>
              <label className={`block ${CRUD_SEARCH_LABEL}`}>
                Tipo de movimiento
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
                  className={CRUD_SELECT}
                >
                  <option value="todos">Todos</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="mulita_mantenimiento">Gastos mulita vinculados a mantenimiento</option>
                  <option value="operacion_mulita">Operación mulitas</option>
                  <option value="factura_proveedor">Facturas proveedor</option>
                  <option value="pago_proveedor">Pagos a proveedor</option>
                </select>
              </label>
            </div>
          </div>

          <div className={CRUD_TABLE_OUTER}>
            <table className={`${CRUD_TABLE} min-w-[880px]`}>
              <thead>
                <tr className={CRUD_THEAD_TR}>
                  <CrudTableTh className="min-w-[6.5rem] px-2 py-3 text-left align-middle" icon="mdi:tag-outline" align="start">
                    Tipo
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[6rem] px-2 py-3 text-left align-middle" icon="mdi:calendar" align="start">
                    Fecha
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[14rem] px-2 py-3 text-left align-middle" icon="mdi:text-box-outline" align="start">
                    Concepto
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[7rem] px-2 py-3 text-left align-middle" icon="mdi:domain" align="start">
                    Proveedor
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[5.5rem] px-2 py-3 text-left align-middle" icon="mdi:truck-outline" align="start">
                    Unidad
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[5rem] px-2 py-3 text-right align-middle" icon="mdi:cash" align="end">
                    Monto
                  </CrudTableTh>
                  <CrudTableTh className="w-[1%] px-2 py-3 text-center align-middle" icon="mdi:link-variant" align="center">
                    Origen
                  </CrudTableTh>
                </tr>
              </thead>
              <tbody className={CRUD_TBODY}>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-skyline-muted">
                      No hay movimientos con estos criterios.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((m, rowIdx) => (
                    <MovimientoRow key={`${m.tipo}-${m.id}`} m={m} rowIdx={rowIdx} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <section className="mt-10" aria-label="Accesos rápidos">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-skyline-muted">
          Registrar o revisar en el sistema
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {enlaces.map((e) => (
            <li key={e.to}>
              <Link
                to={e.to}
                className="flex h-full flex-col rounded-xl border border-skyline-border bg-white p-4 shadow-sm transition-colors hover:border-skyline-blue/40 hover:bg-skyline-blue/[0.03] no-underline"
              >
                <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-skyline-blue/10 text-skyline-blue">
                  <Icon icon={e.icon} className="size-6" aria-hidden />
                </span>
                <span className="font-semibold text-gray-900">{e.label}</span>
                <span className="mt-1 text-sm text-gray-600">{e.desc}</span>
                <span className="mt-3 text-sm font-medium text-skyline-blue">Abrir →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MovimientoRow({ m, rowIdx }: { m: FinanzasGastoMovimiento; rowIdx: number }) {
  const meta = TIPO_META[m.tipo];
  const linkMantenimiento = m.tipo === 'mantenimiento' || m.tipo === 'mulita_mantenimiento';
  const linkProveedor = m.proveedorId != null && m.proveedorId !== '';

  return (
    <tr className={crudTableRowClass(rowIdx)}>
      <td className="px-3 py-2.5 align-middle">
        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${meta.color}`}>
          <Icon icon={meta.icon} className="size-3.5 shrink-0" aria-hidden />
          {meta.short}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle text-sm text-slate-700">{formatearFecha(m.fecha)}</td>
      <td className="max-w-[22rem] px-3 py-2.5 align-middle text-sm text-slate-800">
        <span className="line-clamp-2" title={m.concepto}>
          {m.concepto}
        </span>
      </td>
      <td className="max-w-[10rem] truncate px-3 py-2.5 align-middle text-sm text-slate-600" title={m.proveedorNombre ?? ''}>
        {m.proveedorNombre ?? '—'}
      </td>
      <td className="px-3 py-2.5 align-middle text-sm text-slate-600">{m.unidadPlacas ?? '—'}</td>
      <td className="px-3 py-2.5 text-right align-middle text-sm font-semibold tabular-nums text-slate-900">
        ${m.monto.toLocaleString('es-MX')}
      </td>
      <td className="px-3 py-2.5 text-center align-middle">
        {linkMantenimiento ? (
          <Link
            to="/mantenimiento"
            className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-skyline-blue"
            title="Ir a mantenimiento"
          >
            <Icon icon="mdi:wrench-outline" className="size-4" aria-hidden />
          </Link>
        ) : linkProveedor ? (
          <Link
            to={`/administracion/proveedores/${m.proveedorId}`}
            className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-skyline-blue"
            title="Expediente del proveedor"
          >
            <Icon icon="mdi:open-in-new" className="size-4" aria-hidden />
          </Link>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
}
