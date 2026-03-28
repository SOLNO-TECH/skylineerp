import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  getReporteCuentasPorPagarApi,
  getReporteProveedoresPorUnidadApi,
} from '../api/client';
import type { FacturaPendienteReporte } from '../api/client';

function fmtMoney(n: number) {
  return `$${(n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function agruparFacturasPorEstado(rows: FacturaPendienteReporte[]) {
  let pendiente = 0;
  let parcial = 0;
  let pagada = 0;
  for (const x of rows) {
    if (x.estado === 'pagada') pagada += 1;
    else if (x.estado === 'parcial') parcial += 1;
    else pendiente += 1;
  }
  return { pendiente, parcial, pagada, total: rows.length };
}

export function AdministracionInicio() {
  const [cxp, setCxp] = useState<Awaited<ReturnType<typeof getReporteCuentasPorPagarApi>> | null>(
    null
  );
  const [porUnidad, setPorUnidad] = useState<Awaited<ReturnType<typeof getReporteProveedoresPorUnidadApi>>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getReporteCuentasPorPagarApi(), getReporteProveedoresPorUnidadApi()])
      .then(([d, u]) => {
        setCxp(d);
        setPorUnidad(u);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar el resumen'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const provStats = useMemo(() => {
    const list = cxp?.proveedores ?? [];
    const activos = list.filter((p) => p.activo).length;
    const conAdeudo = list.filter((p) => p.saldoPendiente > 0.01).length;
    return { total: list.length, activos, conAdeudo };
  }, [cxp?.proveedores]);

  const factStats = useMemo(
    () => agruparFacturasPorEstado(cxp?.facturasPendientesDetalle ?? []),
    [cxp?.facturasPendientesDetalle]
  );

  const unidadStats = useMemo(() => {
    const rows = porUnidad ?? [];
    const conFacturas = rows.filter((r) => r.numFacturas > 0).length;
    const totalFacturas = rows.reduce((s, r) => s + r.numFacturas, 0);
    const saldoUnidades = rows.reduce((s, r) => s + (r.saldoPendiente ?? 0), 0);
    return { unidadesEnReporte: rows.length, conFacturas, totalFacturas, saldoUnidades };
  }, [porUnidad]);

  if (loading && !cxp) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-skyline-border border-t-skyline-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    );
  }

  const tot = cxp!.totalesGlobales;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-skyline-border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-skyline-border pb-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-skyline-blue/10 text-skyline-blue">
              <Icon icon="mdi:account-tie-outline" className="size-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Proveedores</h2>
              <p className="text-xs text-gray-500">Registros y facturación agregada en el directorio.</p>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-skyline-bg/80 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Proveedores</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{provStats.total}</dd>
              <dd className="mt-0.5 text-xs text-gray-500">{provStats.activos} activos</dd>
            </div>
            <div className="rounded-lg bg-skyline-bg/80 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Con saldo pendiente</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{provStats.conAdeudo}</dd>
              <dd className="mt-0.5 text-xs text-gray-500">Con facturación pendiente de liquidar</dd>
            </div>
            <div className="rounded-lg bg-skyline-bg/80 px-4 py-3 sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Facturas registradas</dt>
              <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                <span>
                  <strong className="tabular-nums text-gray-900">{factStats.total}</strong> en total
                </span>
                <span className="text-gray-400">·</span>
                <span>
                  {factStats.pendiente} pendientes, {factStats.parcial} parciales, {factStats.pagada} pagadas
                </span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-skyline-border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-skyline-border pb-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-800">
              <Icon icon="mdi:chart-box-outline" className="size-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Reportes (cuentas por pagar)</h2>
              <p className="text-xs text-gray-500">Totales globales y vista por unidad del mismo reporte.</p>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-skyline-bg/80 px-4 py-3 sm:col-span-3 sm:grid sm:grid-cols-3 sm:gap-3 sm:bg-transparent sm:p-0">
              <div className="rounded-lg bg-skyline-bg/80 px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Facturado</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums text-gray-900">{fmtMoney(tot.facturado)}</dd>
              </div>
              <div className="mt-3 rounded-lg bg-skyline-bg/80 px-4 py-3 sm:mt-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Pagado</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums text-gray-900">{fmtMoney(tot.pagado)}</dd>
              </div>
              <div className="mt-3 rounded-lg bg-skyline-bg/80 px-4 py-3 sm:mt-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Saldo por pagar</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums text-amber-900">{fmtMoney(tot.saldo)}</dd>
              </div>
            </div>
            <div className="rounded-lg bg-skyline-bg/80 px-4 py-3 sm:col-span-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Por unidad (reporte)</dt>
              <dd className="mt-1 text-sm text-gray-700">
                <span className="font-semibold text-gray-900">{unidadStats.unidadesEnReporte}</span> unidades en
                el corte;{' '}
                <span className="font-semibold text-gray-900">{unidadStats.conFacturas}</span> con al menos una
                factura ({unidadStats.totalFacturas} facturas). Saldo pendiente asignado a unidades:{' '}
                <span className="font-semibold tabular-nums text-gray-900">
                  {fmtMoney(unidadStats.saldoUnidades)}
                </span>
                .
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="flex flex-wrap gap-4 border-t border-skyline-border pt-6">
        <Link
          to="/administracion/proveedores"
          className="inline-flex items-center gap-2 text-sm font-semibold text-skyline-blue no-underline hover:underline"
        >
          Directorio de proveedores
          <Icon icon="mdi:arrow-right" className="size-4" aria-hidden />
        </Link>
        <Link
          to="/administracion/reportes-proveedores"
          className="inline-flex items-center gap-2 text-sm font-semibold text-skyline-blue no-underline hover:underline"
        >
          Reportes detallados (tablas y listados)
          <Icon icon="mdi:arrow-right" className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
