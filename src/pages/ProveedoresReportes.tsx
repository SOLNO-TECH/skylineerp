import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getReporteCuentasPorPagarApi, getReporteProveedoresPorUnidadApi } from '../api/client';
import type { FacturaPendienteReporte, ReportePorUnidad } from '../api/client';
import {
  CRUD_CELDA_SEC_LEFT,
  CRUD_TABLE,
  CRUD_TABLE_OUTER,
  CRUD_TBODY,
  CRUD_THEAD_TR,
  CrudActionGroup,
  CrudActionIconButton,
  CrudTableTh,
  crudTableRowClass,
} from '../components/crud/crudCorporativo';
import { etiquetaUnidadLista } from '../lib/unidadDisplay';

function fmtMoney(n: number) {
  return `$${(n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ProveedoresReportes() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getReporteCuentasPorPagarApi>> | null>(null);
  const [porUnidad, setPorUnidad] = useState<ReportePorUnidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getReporteCuentasPorPagarApi(), getReporteProveedoresPorUnidadApi()])
      .then(([d, u]) => {
        setData(d);
        setPorUnidad(u);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const nombrePorProveedor = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of data?.proveedores ?? []) {
      m.set(p.id, p.nombreRazonSocial);
    }
    return m;
  }, [data?.proveedores]);

  const proveedoresConSaldo = useMemo(() => {
    return (data?.proveedores ?? [])
      .filter((p) => p.saldoPendiente > 0.01)
      .sort((a, b) => b.saldoPendiente - a.saldoPendiente);
  }, [data?.proveedores]);

  function agruparFacturasPorEstado(rows: FacturaPendienteReporte[]) {
    const pagada = rows.filter((x) => x.estado === 'pagada');
    const parcial = rows.filter((x) => x.estado === 'parcial');
    const pendiente = rows.filter((x) => x.estado === 'pendiente');
    return { pagada, parcial, pendiente };
  }

  const todasFacturasDetalle = data?.facturasPendientesDetalle ?? [];
  const agrupadas = useMemo(() => agruparFacturasPorEstado(todasFacturasDetalle), [todasFacturasDetalle]);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-skyline-border border-t-skyline-blue" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>;
  }

  const tot = data!.totalesGlobales;

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-skyline-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Cuentas por pagar (general)</h2>
        <p className="mt-1 text-sm text-gray-500">Totales de todas las facturas activas de proveedores.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-skyline-bg p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Total facturado</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{fmtMoney(tot.facturado)}</p>
          </div>
          <div className="rounded-lg bg-skyline-bg p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Total pagado</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{fmtMoney(tot.pagado)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200/80">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-900/80">Saldo pendiente</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-800">{fmtMoney(tot.saldo)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-skyline-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Resumen por proveedor</h2>
          <CrudActionGroup aria-label="Datos del reporte">
            <CrudActionIconButton icon="mdi:refresh" title="Actualizar datos" disabled={loading} onClick={load} />
          </CrudActionGroup>
        </div>
        <p className="mt-1 text-sm text-gray-500">Cuánto se adeuda a cada proveedor (saldo &gt; 0).</p>
        {proveedoresConSaldo.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No hay saldos pendientes.</p>
        ) : (
          <ul className="mt-4 divide-y divide-skyline-border">
            {proveedoresConSaldo.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link to={`/administracion/proveedores/${p.id}`} className="font-medium text-skyline-blue hover:underline">
                  {p.nombreRazonSocial}
                </Link>
                <div className="text-right text-sm tabular-nums">
                  <span className="text-gray-500">Facturado {fmtMoney(p.totalFacturado)}</span>
                  <span className="mx-2 text-gray-300">·</span>
                  <span className="text-emerald-700">Pagado {fmtMoney(p.totalPagado)}</span>
                  <span className="mx-2 text-gray-300">·</span>
                  <span className="font-semibold text-amber-600">Saldo {fmtMoney(p.saldoPendiente)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-skyline-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Facturas con saldo</h2>
        <p className="mt-1 text-sm text-gray-500">Detalle de documentos que aún tienen adeudo (parciales y pendientes en esta lista).</p>

        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Parciales ({agrupadas.parcial.length})</h3>
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm">
              {agrupadas.parcial.length === 0 && <li className="text-gray-500">—</li>}
              {agrupadas.parcial.map((r) => (
                <li key={r.facturaId} className="rounded border border-skyline-border bg-skyline-bg/50 p-2">
                  <div className="font-medium text-gray-900">{r.numero}</div>
                  <div className="text-xs text-gray-600">{nombrePorProveedor.get(r.proveedorId) ?? `Proveedor #${r.proveedorId}`}</div>
                  <div className="mt-1 text-xs tabular-nums text-amber-700">Saldo {fmtMoney(r.saldoPendiente)}</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Pendientes ({agrupadas.pendiente.length})</h3>
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm">
              {agrupadas.pendiente.length === 0 && <li className="text-gray-500">—</li>}
              {agrupadas.pendiente.map((r) => (
                <li key={r.facturaId} className="rounded border border-skyline-border bg-skyline-bg/50 p-2">
                  <div className="font-medium text-gray-900">{r.numero}</div>
                  <div className="text-xs text-gray-600">{nombrePorProveedor.get(r.proveedorId) ?? `Proveedor #${r.proveedorId}`}</div>
                  <div className="mt-1 text-xs tabular-nums text-amber-700">Saldo {fmtMoney(r.saldoPendiente)}</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Nota</h3>
            <p className="mt-2 text-sm text-gray-600">
              Las facturas totalmente pagadas no aparecen aquí. Revisa el expediente del proveedor para historial completo
              y pagos aplicados.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-skyline-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Reporte por unidad</h2>
        <p className="mt-1 text-sm text-gray-500">Inversión facturada y pagada asociada a cada activo (campo unidad en factura).</p>
        {porUnidad.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            No hay facturas de proveedores ligadas a unidades. Al registrar facturas, asigna la unidad cuando aplique.
          </p>
        ) : (
          <div className={`${CRUD_TABLE_OUTER} mt-4`}>
            <table className={CRUD_TABLE}>
              <thead>
                <tr className={CRUD_THEAD_TR}>
                  <CrudTableTh className="min-w-[10rem] px-2 py-3 text-left align-middle" icon="mdi:truck-outline" align="start">
                    Unidad
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[4rem] px-2 py-3 text-right align-middle" icon="mdi:file-multiple-outline" align="end">
                    Facturas
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[5rem] px-2 py-3 text-right align-middle" icon="mdi:receipt-text-outline" align="end">
                    Facturado
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[5rem] px-2 py-3 text-right align-middle" icon="mdi:cash-check" align="end">
                    Pagado
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[5rem] px-2 py-3 text-right align-middle" icon="mdi:scale-balance" align="end">
                    Saldo
                  </CrudTableTh>
                </tr>
              </thead>
              <tbody className={CRUD_TBODY}>
                {porUnidad.map((u, rowIdx) => (
                  <tr key={u.unidadId} className={crudTableRowClass(rowIdx)}>
                    <td className={`px-3 py-2.5 align-middle font-semibold text-slate-900 ${CRUD_CELDA_SEC_LEFT}`}>
                      {etiquetaUnidadLista({
                        numeroEconomico: u.numeroEconomico ?? '',
                        placas: u.placas,
                        marca: u.marca,
                        modelo: u.modelo,
                      })}
                    </td>
                    <td className={`px-3 py-2.5 text-right align-middle tabular-nums ${CRUD_CELDA_SEC_LEFT} text-slate-600`}>{u.numFacturas}</td>
                    <td className={`px-3 py-2.5 text-right align-middle tabular-nums ${CRUD_CELDA_SEC_LEFT}`}>{fmtMoney(u.totalFacturado)}</td>
                    <td className={`px-3 py-2.5 text-right align-middle tabular-nums text-emerald-700 ${CRUD_CELDA_SEC_LEFT}`}>{fmtMoney(u.totalPagado)}</td>
                    <td className={`px-3 py-2.5 text-right align-middle font-semibold tabular-nums text-amber-600 ${CRUD_CELDA_SEC_LEFT}`}>
                      {fmtMoney(u.saldoPendiente)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
