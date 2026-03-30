import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import {
  getRenta,
  addPagoRenta,
  uploadDocumentoRenta,
  updateRenta,
  type RentaRow,
  type PagoRow,
} from '../api/client';
import { Icon } from '@iconify/react';
import { MapRoute } from '../components/MapRoute';
import { descargarComprobanteRentaPdf } from '../lib/comprobanteRenta';

const ESTADOS: Record<string, { label: string; color: string }> = {
  reservada: { label: 'Reservada', color: 'bg-amber-100 text-amber-800' },
  activa: { label: 'Activa', color: 'bg-emerald-100 text-emerald-800' },
  finalizada: { label: 'Finalizada', color: 'bg-slate-100 text-slate-600' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
};

const TIPOS_UNIDAD: Record<string, string> = {
  remolque_seco: 'Remolque seco',
  refrigerado: 'Refrigerado',
  maquinaria: 'Mulita',
};

const TIPOS_SERVICIO: Record<string, string> = {
  solo_renta: 'Solo renta',
  con_operador: 'Con operador',
  con_transporte: 'Con transporte',
};

const ESTADOS_LOG: Record<string, string> = {
  programado: 'Programado',
  en_camino: 'En camino',
  entregado: 'Entregado',
  finalizado: 'Finalizado',
};

const TIPOS_PAGO: Record<string, string> = {
  anticipo: 'Anticipo',
  pago_parcial: 'Pago parcial',
  pago_final: 'Pago final',
  deposito: 'Depósito',
  devolucion_deposito: 'Devolución depósito',
  extra: 'Extra',
};

const METODOS_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
};

function formatearFecha(s: string) {
  if (!s) return '';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function RentaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [renta, setRenta] = useState<RentaRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoTipo, setPagoTipo] = useState('pago_parcial');
  const [pagoMetodo, setPagoMetodo] = useState('efectivo');
  const [enviandoPago, setEnviandoPago] = useState(false);
  const [estadoLogistico, setEstadoLogistico] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getRenta(id)
      .then((r) => {
        setRenta(r);
        setEstadoLogistico(r.estadoLogistico || 'programado');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [id]);

  const agregarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !pagoMonto || !renta) return;
    const pagado = (renta.pagos || []).reduce((s, p) => s + p.monto, 0);
    const saldoPendiente = (renta.monto || 0) + (renta.deposito || 0) - pagado;
    if (saldoPendiente <= 0.005) {
      toast('Esta renta ya está liquidada; no se pueden registrar más pagos.', 'error');
      return;
    }
    setEnviandoPago(true);
    try {
      const r = await addPagoRenta(id, {
        monto: parseFloat(pagoMonto),
        tipo: pagoTipo,
        metodo: pagoMetodo,
      });
      setRenta(r);
      setPagoMonto('');
      toast('Pago registrado correctamente');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al registrar pago', 'error');
    } finally {
      setEnviandoPago(false);
    }
  };

  const subirDocumento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!id || !file) return;
    try {
      const r = await uploadDocumentoRenta(id, file, 'contrato', file.name);
      setRenta(r);
      toast('Documento subido correctamente');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al subir', 'error');
    }
    e.target.value = '';
  };

  const cambiarEstadoLogistico = async () => {
    if (!id) return;
    try {
      const r = await updateRenta(id, { estadoLogistico });
      setRenta(r);
      toast('Estado logístico actualizado');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const exportarComprobantePdf = async () => {
    if (!renta) return;
    try {
      await descargarComprobanteRentaPdf(renta);
      toast('PDF descargado', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo generar el PDF', 'error');
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Cargando expediente...</div>;
  if (error || !renta) return <div className="p-6 text-red-600">{error || 'Renta no encontrada'}</div>;

  const totalPagado = (renta.pagos || []).reduce((s, p) => s + p.monto, 0);
  const saldo = (renta.monto || 0) + (renta.deposito || 0) - totalPagado;
  const pagoCompleto = saldo <= 0.005;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/rentas')}
          className="rounded p-2 text-gray-600 hover:bg-gray-100"
        >
          <Icon icon="mdi:arrow-left" className="text-xl" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            Expediente #{renta.id} · {renta.placas}
          </h1>
          <p className="text-sm text-gray-500">{renta.clienteNombre} · {formatearFecha(renta.fechaInicio)} → {formatearFecha(renta.fechaFin)}</p>
        </div>
        <span className={`badge shrink-0 ${ESTADOS[renta.estado]?.color ?? 'bg-gray-100'}`}>
          {ESTADOS[renta.estado]?.label ?? renta.estado}
        </span>
        <button
          type="button"
          onClick={exportarComprobantePdf}
          className="btn btn-outline inline-flex shrink-0 items-center gap-2"
        >
          <Icon icon="mdi:file-pdf-box" className="size-5 text-red-600" aria-hidden />
          Comprobante PDF
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Información general */}
        <div className="rounded-xl border border-skyline-border bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-5 text-lg font-semibold text-gray-900">Información general</h2>

          <div className="mb-6 rounded-xl border border-skyline-border bg-gradient-to-br from-skyline-blue/[0.06] to-transparent p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-skyline-blue">
              <Icon icon="mdi:account-group-outline" className="size-5" aria-hidden />
              Datos del cliente
            </h3>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-gray-500">Nombre completo</dt>
                <dd className="font-medium text-gray-900">{renta.clienteNombre || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Teléfono</dt>
                <dd className="text-gray-900">{renta.clienteTelefono?.trim() || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500">Correo electrónico</dt>
                <dd className="break-all text-gray-900">{renta.clienteEmail?.trim() || '—'}</dd>
              </div>
            </dl>
            {renta.clienteId ? (
              <div className="mt-4">
                <Link
                  to={`/clientes/${renta.clienteId}`}
                  className="btn btn-outline inline-flex items-center gap-2 text-sm"
                >
                  <Icon icon="mdi:folder-account" className="size-5 text-skyline-blue" aria-hidden />
                  Ver expediente en catálogo de clientes
                </Link>
              </div>
            ) : null}
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-skyline-border p-4">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <Icon icon="mdi:truck-outline" className="size-4 text-skyline-blue" aria-hidden />
                Unidad
              </h3>
              <p className="font-semibold text-gray-900">
                {renta.placas} · {renta.marca} {renta.modelo}
              </p>
              <p className="mt-1 text-sm text-gray-600">{TIPOS_UNIDAD[renta.tipoUnidad ?? 'remolque_seco']}</p>
              <p className="mt-2 text-xs text-gray-500">ID unidad: {renta.unidadId}</p>
            </div>
            <div className="rounded-lg border border-skyline-border p-4">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <Icon icon="mdi:briefcase-outline" className="size-4 text-skyline-blue" aria-hidden />
                Servicio y operación
              </h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Tipo de servicio</dt>
                  <dd className="font-medium">{TIPOS_SERVICIO[renta.tipoServicio ?? 'solo_renta']}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Operador asignado</dt>
                  <dd className="font-medium">{renta.operadorAsignado?.trim() || '—'}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mb-6 rounded-lg border border-skyline-border p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Icon icon="mdi:calendar-range" className="size-4 text-skyline-blue" aria-hidden />
              Periodo y montos del contrato
            </h3>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-gray-500">Fecha inicio</dt>
                <dd className="font-medium">{formatearFecha(renta.fechaInicio)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Fecha fin</dt>
                <dd className="font-medium">{formatearFecha(renta.fechaFin)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Monto total renta</dt>
                <dd className="font-semibold text-gray-900">${(renta.monto ?? 0).toLocaleString('es-MX')}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Depósito</dt>
                <dd className="font-medium">${(renta.deposito ?? 0).toLocaleString('es-MX')}</dd>
              </div>
              {(renta.precioBase != null || renta.extras != null) && (
                <>
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Precio base</dt>
                    <dd>${(renta.precioBase ?? 0).toLocaleString('es-MX')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Extras</dt>
                    <dd>${(renta.extras ?? 0).toLocaleString('es-MX')}</dd>
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500">Estado logístico</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <select
                    value={estadoLogistico}
                    onChange={(e) => setEstadoLogistico(e.target.value)}
                    className="input max-w-xs text-sm"
                    disabled={['finalizada', 'cancelada'].includes(renta.estado)}
                  >
                    {Object.entries(ESTADOS_LOG).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  {estadoLogistico !== (renta.estadoLogistico || 'programado') && (
                    <button type="button" onClick={cambiarEstadoLogistico} className="btn btn-primary text-xs">
                      Guardar
                    </button>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mb-6 rounded-lg border border-skyline-border p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Icon icon="mdi:map-marker-path" className="size-4 text-skyline-blue" aria-hidden />
              Ubicaciones registradas
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium text-gray-500">Entrega</dt>
                <dd className="text-sm text-gray-900">{renta.ubicacionEntrega?.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Recolección</dt>
                <dd className="text-sm text-gray-900">{renta.ubicacionRecoleccion?.trim() || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="mb-6">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Icon icon="mdi:map" className="size-5 text-skyline-blue" aria-hidden />
              Mapa · ruta entrega y recolección
            </h3>
            {(renta.ubicacionEntrega || renta.ubicacionRecoleccion) ? (
              <MapRoute
                ubicacionEntrega={renta.ubicacionEntrega ?? ''}
                ubicacionRecoleccion={renta.ubicacionRecoleccion ?? ''}
                className="shadow-md"
                showHeading={false}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-skyline-border bg-skyline-bg/50 py-10 text-center text-sm text-gray-500">
                No hay direcciones guardadas. Edita la renta para agregar entrega y recolección y ver el mapa aquí.
              </div>
            )}
          </div>

          {renta.observaciones?.trim() && (
            <div className="mb-6 rounded-lg border border-amber-200/80 bg-amber-50/40 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-900/80">Observaciones</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-800">{renta.observaciones}</p>
            </div>
          )}

          {renta.refrigerado && (
            <div className="mb-4 rounded-lg border border-skyline-border p-4">
              <h3 className="text-sm font-semibold text-gray-700">Datos refrigerado</h3>
              <p className="mt-1 text-sm text-gray-600">
                Temp: {renta.refrigerado.temperaturaObjetivo}°C · Combustible: {renta.refrigerado.combustibleInicio}% →{' '}
                {renta.refrigerado.combustibleFin}% · Motor: {renta.refrigerado.horasMotorInicio} → {renta.refrigerado.horasMotorFin} hrs
              </p>
            </div>
          )}
          {renta.maquinaria && (
            <div className="rounded-lg border border-skyline-border p-4">
              <h3 className="text-sm font-semibold text-gray-700">Datos mulita</h3>
              <p className="mt-1 text-sm text-gray-600">
                Operador: {renta.maquinaria.operadorAsignado} · Horas: {renta.maquinaria.horasTrabajadas} · Trabajo:{' '}
                {renta.maquinaria.tipoTrabajo}
              </p>
            </div>
          )}
        </div>

        {/* Pagos */}
        <div className="rounded-xl border border-skyline-border bg-white p-6 pb-7 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Pagos</h2>
          <div className="mb-4 rounded-lg bg-skyline-bg p-4">
            <p className="text-xs text-gray-500">Total renta</p>
            <p className="text-lg font-semibold">${(renta.monto || 0).toLocaleString('es-MX')}</p>
            <p className="text-xs text-gray-500">Depósito</p>
            <p className="font-medium">${(renta.deposito || 0).toLocaleString('es-MX')}</p>
            <p className="mt-2 text-xs font-medium text-gray-700">Pagado: ${totalPagado.toLocaleString('es-MX')}</p>
            <p className={`text-sm font-semibold ${saldo > 0.005 ? 'text-amber-600' : 'text-emerald-600'}`}>
              Saldo: ${saldo.toLocaleString('es-MX')}
            </p>
          </div>
          {pagoCompleto ? (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 text-center">
              <Icon icon="mdi:check-decagram" className="mx-auto mb-2 size-11 text-emerald-600" aria-hidden />
              <p className="font-semibold text-emerald-900">Pago completado</p>
              <p className="mt-1.5 text-sm leading-relaxed text-emerald-800/90">
                El saldo de esta renta está en cero. Ya no es necesario registrar más pagos.
              </p>
            </div>
          ) : (
            <form onSubmit={agregarPago} className="mb-4 space-y-2">
              <input
                type="number"
                step="0.01"
                value={pagoMonto}
                onChange={(e) => setPagoMonto(e.target.value)}
                placeholder="Monto"
                className="input w-full"
                required
              />
              <select value={pagoTipo} onChange={(e) => setPagoTipo(e.target.value)} className="input w-full">
                <option value="anticipo">Anticipo</option>
                <option value="pago_parcial">Pago parcial</option>
                <option value="pago_final">Pago final</option>
                <option value="deposito">Depósito</option>
                <option value="devolucion_deposito">Devolución depósito</option>
                <option value="extra">Extra</option>
              </select>
              <select value={pagoMetodo} onChange={(e) => setPagoMetodo(e.target.value)} className="input w-full">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="cheque">Cheque</option>
              </select>
              <button type="submit" className="btn btn-primary w-full" disabled={enviandoPago}>
                {enviandoPago ? 'Registrando...' : 'Registrar pago'}
              </button>
            </form>
          )}
          <ul className="space-y-2">
            {(renta.pagos || []).length === 0 ? (
              <li className="text-sm text-gray-500">Sin movimientos aún.</li>
            ) : (
              (renta.pagos || []).map((p: PagoRow) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-0.5 border-b border-skyline-border pb-3 text-sm last:border-0"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium text-gray-900">${p.monto.toLocaleString('es-MX')}</span>
                    <span className="text-gray-500">{formatearFecha(p.fecha)}</span>
                  </div>
                  <span className="text-xs text-gray-600">
                    {TIPOS_PAGO[p.tipo] ?? p.tipo} · {METODOS_PAGO[p.metodo] ?? p.metodo}
                    {p.referencia ? ` · Ref. ${p.referencia}` : ''}
                  </span>
                  {p.observaciones?.trim() && (
                    <span className="text-xs text-gray-500">{p.observaciones}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* Documentos e historial */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-skyline-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Documentos</h2>
          <label className="btn btn-outline mb-4 block cursor-pointer text-center">
            <input type="file" className="hidden" accept=".pdf,.doc,.docx,image/*" onChange={subirDocumento} />
            + Subir documento
          </label>
          <ul className="space-y-2">
            {(renta.documentos || []).map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded border border-skyline-border p-2">
                <span className="text-sm">{d.nombre}</span>
                <a href={`/uploads/${d.ruta}`} target="_blank" rel="noreferrer" className="text-sky-600 text-sm hover:underline">
                  Ver
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-skyline-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Historial</h2>
          <ul className="space-y-2">
            {(renta.historial || []).map((h) => (
              <li key={h.id} className="border-b border-skyline-border pb-2 text-sm last:border-0">
                <span className="font-medium">{h.accion}</span>
                {h.detalle && <span className="text-gray-600"> — {h.detalle}</span>}
                <span className="block text-xs text-gray-500">{h.fecha}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
