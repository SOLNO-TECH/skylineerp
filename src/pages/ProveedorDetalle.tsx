import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  getProveedor,
  updateProveedorApi,
  deleteProveedorApi,
  deleteProveedorFacturaApi,
  createProveedorFactura,
  addPagoProveedorFactura,
  getUnidades,
  type ProveedorDetalle,
  type ProveedorFacturaRow,
  type UnidadRow,
} from '../api/client';
import { useNotification } from '../context/NotificationContext';
import { descargarFacturaProveedorPdf } from '../lib/facturaProveedorPdf';

function fmtMoney(n: number) {
  return `$${(n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const METODOS: { v: string; l: string }[] = [
  { v: 'efectivo', l: 'Efectivo' },
  { v: 'transferencia', l: 'Transferencia' },
  { v: 'tarjeta', l: 'Tarjeta' },
  { v: 'cheque', l: 'Cheque' },
];

function estadoBadge(estado: string) {
  if (estado === 'pagada') return 'bg-emerald-100 text-emerald-800';
  if (estado === 'parcial') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}

export function ProveedorDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [prov, setProv] = useState<ProveedorDetalle | null>(null);
  const [unidades, setUnidades] = useState<UnidadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    nombreRazonSocial: '',
    rfc: '',
    contactoNombre: '',
    contactoTelefono: '',
    contactoEmail: '',
    direccion: '',
    notas: '',
  });
  const [savingProv, setSavingProv] = useState(false);
  const [deletingProv, setDeletingProv] = useState(false);
  const [deletingFacturaId, setDeletingFacturaId] = useState<string | null>(null);

  const [factForm, setFactForm] = useState({
    numero: '',
    fechaEmision: '',
    montoTotal: '',
    concepto: '',
    unidadId: '',
    archivo: null as File | null,
  });
  const [savingFact, setSavingFact] = useState(false);

  const [pagoForms, setPagoForms] = useState<Record<string, { fechaPago: string; monto: string; metodo: string; referencia: string }>>(
    {}
  );
  const [savingPagoId, setSavingPagoId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getProveedor(id)
      .then((p) => {
        setProv(p);
        setEditForm({
          nombreRazonSocial: p.nombreRazonSocial,
          rfc: p.rfc,
          contactoNombre: p.contactoNombre,
          contactoTelefono: p.contactoTelefono,
          contactoEmail: p.contactoEmail,
          direccion: p.direccion,
          notas: p.notas,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getUnidades().then(setUnidades).catch(() => {});
  }, []);

  function getPagoForm(fid: string) {
    return (
      pagoForms[fid] ?? {
        fechaPago: new Date().toISOString().slice(0, 10),
        monto: '',
        metodo: 'transferencia',
        referencia: '',
      }
    );
  }

  function setPagoForm(fid: string, patch: Partial<(typeof pagoForms)[string]>) {
    setPagoForms((prev) => ({ ...prev, [fid]: { ...getPagoForm(fid), ...patch } }));
  }

  function handleSaveProveedor(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSavingProv(true);
    updateProveedorApi(id, editForm)
      .then((p) => {
        setProv(p);
        toast('Datos del proveedor guardados');
      })
      .catch((err) => toast(err instanceof Error ? err.message : 'Error', 'error'))
      .finally(() => setSavingProv(false));
  }

  function handleEliminarProveedor() {
    if (!id || !prov) return;
    if (
      !confirm(
        '¿Dar de baja este proveedor?\n\nEl expediente ya no aparecerá en el directorio. Las facturas asociadas dejan de contabilizarse en los reportes visibles.'
      )
    ) {
      return;
    }
    setDeletingProv(true);
    deleteProveedorApi(id)
      .then(() => {
        toast('Proveedor eliminado');
        navigate('/administracion/proveedores');
      })
      .catch((err) => toast(err instanceof Error ? err.message : 'Error', 'error'))
      .finally(() => setDeletingProv(false));
  }

  function handleEliminarFactura(f: ProveedorFacturaRow) {
    if (!id) return;
    if (
      !confirm(
        `¿Eliminar del expediente la factura ${f.numero}?\n\nLos pagos registrados dejan de mostrarse en este módulo.`
      )
    ) {
      return;
    }
    setDeletingFacturaId(f.id);
    deleteProveedorFacturaApi(id, f.id)
      .then(() => getProveedor(id))
      .then((p) => {
        setProv(p);
        setEditForm({
          nombreRazonSocial: p.nombreRazonSocial,
          rfc: p.rfc,
          contactoNombre: p.contactoNombre,
          contactoTelefono: p.contactoTelefono,
          contactoEmail: p.contactoEmail,
          direccion: p.direccion,
          notas: p.notas,
        });
        toast('Factura eliminada');
      })
      .catch((err) => toast(err instanceof Error ? err.message : 'Error', 'error'))
      .finally(() => setDeletingFacturaId(null));
  }

  function proveedorParaPdf() {
    if (!prov) return null;
    return {
      nombreRazonSocial: prov.nombreRazonSocial,
      rfc: prov.rfc,
      contactoNombre: prov.contactoNombre,
      contactoTelefono: prov.contactoTelefono,
      contactoEmail: prov.contactoEmail,
      direccion: prov.direccion,
    };
  }

  async function descargarPdfFactura(f: ProveedorFacturaRow) {
    const info = proveedorParaPdf();
    if (!info) return;
    try {
      await descargarFacturaProveedorPdf(info, f);
      toast('PDF descargado', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo generar el PDF', 'error');
    }
  }

  function handleNuevaFactura(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !factForm.numero.trim() || !factForm.fechaEmision || !factForm.montoTotal) return;
    const numeroRegistro = factForm.numero.trim();
    setSavingFact(true);
    createProveedorFactura(id, {
      numero: numeroRegistro,
      fechaEmision: factForm.fechaEmision,
      montoTotal: parseFloat(factForm.montoTotal) || 0,
      concepto: factForm.concepto.trim(),
      unidadId: factForm.unidadId || undefined,
      archivo: factForm.archivo,
    })
      .then((p) => {
        setProv(p);
        setFactForm({
          numero: '',
          fechaEmision: '',
          montoTotal: '',
          concepto: '',
          unidadId: '',
          archivo: null,
        });
        const nueva = p.facturas.find((x) => x.numero === numeroRegistro);
        const info = {
          nombreRazonSocial: p.nombreRazonSocial,
          rfc: p.rfc,
          contactoNombre: p.contactoNombre,
          contactoTelefono: p.contactoTelefono,
          contactoEmail: p.contactoEmail,
          direccion: p.direccion,
        };
        if (nueva) {
          descargarFacturaProveedorPdf(info, nueva)
            .then(() => toast('Factura registrada. PDF descargado.', 'success'))
            .catch(() =>
              toast('Factura registrada. No se pudo generar el PDF; usa «PDF factura» en el listado.', 'error')
            );
        } else {
          toast('Factura registrada');
        }
      })
      .catch((err) => toast(err instanceof Error ? err.message : 'Error', 'error'))
      .finally(() => setSavingFact(false));
  }

  function handlePago(facturaId: string) {
    if (!id) return;
    const pf = getPagoForm(facturaId);
    const m = parseFloat(pf.monto);
    if (!pf.fechaPago || !Number.isFinite(m) || m <= 0) return;
    setSavingPagoId(facturaId);
    addPagoProveedorFactura(id, facturaId, {
      fechaPago: pf.fechaPago,
      monto: m,
      metodo: pf.metodo,
      referencia: pf.referencia.trim(),
    })
      .then((p) => {
        setProv(p);
        setPagoForm(facturaId, { monto: '', referencia: '' });
        toast('Pago registrado');
      })
      .catch((err) => toast(err instanceof Error ? err.message : 'Error', 'error'))
      .finally(() => setSavingPagoId(null));
  }

  if (loading && !prov) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-skyline-border border-t-skyline-blue" />
      </div>
    );
  }

  if (error || !prov || !id) {
    return (
      <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600">
        {error || 'Proveedor no encontrado'}
        <div className="mt-2">
          <Link to="/administracion/proveedores" className="font-medium text-skyline-blue hover:underline">
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/administracion/proveedores"
          className="btn btn-outline-secondary btn-sm no-underline"
        >
          <Icon icon="mdi:arrow-left" className="size-4" aria-hidden />
          Proveedores
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{prov.nombreRazonSocial}</h2>
            <p className="mt-0.5 text-sm text-gray-500">RFC: {prov.rfc || '—'}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:flex sm:flex-wrap">
            <div className="rounded-lg border border-skyline-border bg-skyline-bg px-4 py-2 text-center sm:text-left">
              <p className="text-xs font-medium text-gray-500">Facturado</p>
              <p className="text-lg font-semibold tabular-nums text-gray-900">{fmtMoney(prov.totalFacturado)}</p>
            </div>
            <div className="rounded-lg border border-skyline-border bg-skyline-bg px-4 py-2 text-center sm:text-left">
              <p className="text-xs font-medium text-gray-500">Pagado</p>
              <p className="text-lg font-semibold tabular-nums text-emerald-700">{fmtMoney(prov.totalPagado)}</p>
            </div>
            <div className="rounded-lg border border-skyline-border bg-skyline-bg px-4 py-2 text-center sm:text-left">
              <p className="text-xs font-medium text-gray-500">Saldo</p>
              <p
                className={`text-lg font-semibold tabular-nums ${
                  prov.saldoPendiente > 0.01 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {fmtMoney(prov.saldoPendiente)}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-gray-600">
          <span className="rounded-full bg-white px-2 py-1 ring-1 ring-skyline-border">
            Pagadas: {prov.resumenFacturas.pagadas}
          </span>
          <span className="rounded-full bg-white px-2 py-1 ring-1 ring-skyline-border">
            Parciales: {prov.resumenFacturas.parciales}
          </span>
          <span className="rounded-full bg-white px-2 py-1 ring-1 ring-skyline-border">
            Pendientes: {prov.resumenFacturas.pendientes}
          </span>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm ml-auto"
            disabled={deletingProv}
            onClick={() => void handleEliminarProveedor()}
          >
            <Icon icon="mdi:delete-outline" className="size-4" aria-hidden />
            {deletingProv ? 'Eliminando…' : 'Eliminar proveedor'}
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSaveProveedor} className="rounded-xl border border-skyline-border bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Datos del proveedor</h3>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Nombre / Razón social *
              <input
                required
                value={editForm.nombreRazonSocial}
                onChange={(e) => setEditForm((f) => ({ ...f, nombreRazonSocial: e.target.value }))}
                className="input mt-1 w-full"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              RFC
              <input
                value={editForm.rfc}
                onChange={(e) => setEditForm((f) => ({ ...f, rfc: e.target.value.toUpperCase() }))}
                className="input mt-1 w-full"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Contacto
                <input
                  value={editForm.contactoNombre}
                  onChange={(e) => setEditForm((f) => ({ ...f, contactoNombre: e.target.value }))}
                  className="input mt-1 w-full"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Teléfono
                <input
                  value={editForm.contactoTelefono}
                  onChange={(e) => setEditForm((f) => ({ ...f, contactoTelefono: e.target.value }))}
                  className="input mt-1 w-full"
                />
              </label>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Correo
              <input
                type="email"
                value={editForm.contactoEmail}
                onChange={(e) => setEditForm((f) => ({ ...f, contactoEmail: e.target.value }))}
                className="input mt-1 w-full"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Dirección
              <input
                value={editForm.direccion}
                onChange={(e) => setEditForm((f) => ({ ...f, direccion: e.target.value }))}
                className="input mt-1 w-full"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Notas
              <textarea
                value={editForm.notas}
                onChange={(e) => setEditForm((f) => ({ ...f, notas: e.target.value }))}
                rows={2}
                className="input mt-1 w-full"
              />
            </label>
          </div>
          <button type="submit" className="btn btn-primary mt-4" disabled={savingProv}>
            {savingProv ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>

        <form onSubmit={handleNuevaFactura} className="rounded-xl border border-skyline-border bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Registrar factura</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
              Número de factura *
              <input
                required
                value={factForm.numero}
                onChange={(e) => setFactForm((f) => ({ ...f, numero: e.target.value }))}
                className="input mt-1 w-full"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Fecha emisión *
              <input
                required
                type="date"
                value={factForm.fechaEmision}
                onChange={(e) => setFactForm((f) => ({ ...f, fechaEmision: e.target.value }))}
                className="input mt-1 w-full"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Monto total *
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={factForm.montoTotal}
                onChange={(e) => setFactForm((f) => ({ ...f, montoTotal: e.target.value }))}
                className="input mt-1 w-full"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
              Concepto (reparación, refacciones, servicio…)
              <input
                value={factForm.concepto}
                onChange={(e) => setFactForm((f) => ({ ...f, concepto: e.target.value }))}
                className="input mt-1 w-full"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
              Unidad relacionada (opcional)
              <select
                value={factForm.unidadId}
                onChange={(e) => setFactForm((f) => ({ ...f, unidadId: e.target.value }))}
                className="input mt-1 w-full"
              >
                <option value="">— Sin asignar —</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.placas} · {u.marca} {u.modelo}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
              Archivo PDF o XML (opcional)
              <input
                type="file"
                accept=".pdf,.xml,application/pdf,text/xml,application/xml"
                onChange={(e) => setFactForm((f) => ({ ...f, archivo: e.target.files?.[0] ?? null }))}
                className="mt-1 w-full text-sm text-gray-600"
              />
            </label>
          </div>
          <button type="submit" className="btn btn-primary mt-4" disabled={savingFact}>
            {savingFact ? 'Registrando…' : 'Registrar factura'}
          </button>
        </form>
      </div>

      <section className="rounded-xl border border-skyline-border bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Facturas y pagos</h3>
        {prov.facturas.length === 0 ? (
          <p className="text-sm text-gray-500">No hay facturas. Registra la primera arriba.</p>
        ) : (
          <ul className="space-y-4">
            {prov.facturas.map((f) => (
              <li key={f.id} className="rounded-lg border border-skyline-border bg-skyline-bg/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">Factura {f.numero}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${estadoBadge(f.estado)}`}>
                        {f.estado}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Emisión: {f.fechaEmision}
                      {f.unidadPlacas && (
                        <>
                          {' '}
                          · Unidad: {f.unidadPlacas} {f.unidadMarca && `(${f.unidadMarca})`}
                        </>
                      )}
                    </p>
                    {f.concepto && <p className="mt-1 text-sm text-gray-700">{f.concepto}</p>}
                    {f.archivoRuta && (
                      <a
                        href={`/uploads/${f.archivoRuta}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline btn-sm mt-2 no-underline"
                      >
                        <Icon icon="mdi:file-pdf-box" className="size-4" aria-hidden />
                        {f.archivoNombreOriginal || 'Ver adjunto'}
                      </a>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <div className="mb-3 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => descargarPdfFactura(f)}
                        className="btn btn-outline btn-sm"
                      >
                        <Icon icon="mdi:file-pdf-box" className="size-4 text-red-600" aria-hidden />
                        PDF factura
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        disabled={deletingFacturaId === f.id}
                        onClick={() => handleEliminarFactura(f)}
                      >
                        <Icon icon="mdi:file-remove-outline" className="size-4" aria-hidden />
                        {deletingFacturaId === f.id ? '…' : 'Eliminar factura'}
                      </button>
                    </div>
                    <p>
                      Total: <span className="font-semibold tabular-nums">{fmtMoney(f.montoTotal)}</span>
                    </p>
                    <p className="text-emerald-700">
                      Pagado: <span className="font-semibold tabular-nums">{fmtMoney(f.totalPagado)}</span>
                    </p>
                    <p className={f.saldoPendiente > 0.01 ? 'text-amber-600' : 'text-emerald-600'}>
                      Saldo: <span className="font-semibold tabular-nums">{fmtMoney(f.saldoPendiente)}</span>
                    </p>
                  </div>
                </div>

                {f.pagos.length > 0 && (
                  <div className="mt-3 border-t border-skyline-border pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Pagos registrados</p>
                    <ul className="space-y-1.5 text-sm text-gray-700">
                      {f.pagos.map((p) => (
                        <li key={p.id} className="flex flex-wrap justify-between gap-2 border-b border-skyline-border/60 pb-1.5 last:border-0">
                          <span>
                            {p.fechaPago} · {METODOS.find((m) => m.v === p.metodo)?.l ?? p.metodo}
                            {p.referencia && ` · Ref. ${p.referencia}`}
                          </span>
                          <span className="font-medium tabular-nums text-emerald-700">{fmtMoney(p.monto)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-3 border-t border-skyline-border pt-3">
                  <p className="mb-2 text-xs font-semibold text-skyline-blue">Registrar pago</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="text-xs font-medium text-gray-600">
                      Fecha
                      <input
                        type="date"
                        value={getPagoForm(f.id).fechaPago}
                        onChange={(e) => setPagoForm(f.id, { fechaPago: e.target.value })}
                        className="input mt-0.5 w-full sm:w-36"
                      />
                    </label>
                    <label className="text-xs font-medium text-gray-600">
                      Monto
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={getPagoForm(f.id).monto}
                        onChange={(e) => setPagoForm(f.id, { monto: e.target.value })}
                        className="input mt-0.5 w-full sm:w-28"
                      />
                    </label>
                    <label className="text-xs font-medium text-gray-600">
                      Método
                      <select
                        value={getPagoForm(f.id).metodo}
                        onChange={(e) => setPagoForm(f.id, { metodo: e.target.value })}
                        className="input mt-0.5 w-full sm:w-36"
                      >
                        {METODOS.map((m) => (
                          <option key={m.v} value={m.v}>
                            {m.l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-[140px] flex-1 text-xs font-medium text-gray-600">
                      Referencia
                      <input
                        value={getPagoForm(f.id).referencia}
                        onChange={(e) => setPagoForm(f.id, { referencia: e.target.value })}
                        className="input mt-0.5 w-full"
                        placeholder="Folio transferencia, cheque…"
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary text-sm"
                      disabled={savingPagoId === f.id}
                      onClick={() => handlePago(f.id)}
                    >
                      {savingPagoId === f.id ? 'Guardando…' : 'Registrar pago'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}