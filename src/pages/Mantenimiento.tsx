import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import {
  CRUD_CELDA_PRIMARIO_LEFT,
  CRUD_CELDA_SEC_LEFT,
  CRUD_ERROR_BANNER,
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
import { useNotification } from '../context/NotificationContext';
import {
  getMantenimientos,
  getUnidades,
  getProveedoresCatalogo,
  createMantenimiento,
  updateMantenimiento,
  type MantenimientoRow,
  type UnidadRow,
  type ProveedorCatalogoRow,
} from '../api/client';
import { etiquetaUnidadLista } from '../lib/unidadDisplay';

const TIPOS = [
  { v: 'preventivo', l: 'Preventivo' },
  { v: 'correctivo', l: 'Correctivo' },
  { v: 'revision', l: 'Revisión' },
];

const ESTADOS = [
  { v: 'programado', l: 'Programado' },
  { v: 'en_proceso', l: 'En proceso' },
  { v: 'completado', l: 'Completado' },
  { v: 'pospuesto', l: 'Pospuesto' },
];

function formatearFecha(s: string) {
  if (!s) return '-';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function textoBusquedaMantenimiento(m: MantenimientoRow): string {
  const tipoLabel = TIPOS.find((t) => t.v === m.tipo)?.l ?? m.tipo;
  const estadoLabel = ESTADOS.find((e) => e.v === m.estado)?.l ?? m.estado;
  return [
    m.numeroEconomico,
    m.placas,
    m.unidadId,
    m.marca,
    m.modelo,
    m.descripcion,
    m.proveedorNombre,
    m.proveedorId,
    m.tipo,
    tipoLabel,
    m.estado,
    estadoLabel,
    String(m.costo ?? ''),
    formatearFecha(m.fechaInicio),
    m.fechaFin ? formatearFecha(m.fechaFin) : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function coincideBusqueda(m: MantenimientoRow, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const hay = textoBusquedaMantenimiento(m);
  return t.split(/\s+/).every((p) => p.length > 0 && hay.includes(p));
}

export function Mantenimiento() {
  const [mantenimientos, setMantenimientos] = useState<MantenimientoRow[]>([]);
  const [unidades, setUnidades] = useState<UnidadRow[]>([]);
  const [proveedoresCat, setProveedoresCat] = useState<ProveedorCatalogoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<MantenimientoRow | null>(null);
  const [form, setForm] = useState({
    unidadId: '',
    proveedorId: '',
    tipo: 'preventivo',
    descripcion: '',
    costo: '',
    fechaInicio: '',
    fechaFin: '',
    estado: 'programado',
  });
  const [enviando, setEnviando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroUnidadId, setFiltroUnidadId] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const { toast } = useNotification();

  const hoy = new Date().toISOString().slice(0, 10);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, u, prov] = await Promise.all([
        getMantenimientos(),
        getUnidades(),
        getProveedoresCatalogo().catch(() => [] as ProveedorCatalogoRow[]),
      ]);
      setMantenimientos(m);
      setUnidades(u);
      setProveedoresCat(prov);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({
      unidadId: unidades[0]?.id ?? '',
      proveedorId: '',
      tipo: 'preventivo',
      descripcion: '',
      costo: '',
      fechaInicio: hoy,
      fechaFin: '',
      estado: 'programado',
    });
    setModalAbierto(true);
  };

  const abrirEditar = (m: MantenimientoRow) => {
    setEditando(m);
    setForm({
      unidadId: m.unidadId,
      proveedorId: m.proveedorId ?? '',
      tipo: m.tipo,
      descripcion: m.descripcion,
      costo: String(m.costo ?? ''),
      fechaInicio: m.fechaInicio,
      fechaFin: m.fechaFin ?? '',
      estado: m.estado,
    });
    setModalAbierto(true);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unidadId || !form.fechaInicio) return;
    setEnviando(true);
    try {
      if (editando) {
        await updateMantenimiento(editando.id, {
          tipo: form.tipo,
          descripcion: form.descripcion,
          costo: parseFloat(form.costo) || 0,
          fechaInicio: form.fechaInicio,
          fechaFin: form.fechaFin || null,
          estado: form.estado,
          proveedorId: form.proveedorId || null,
        });
        toast('Mantenimiento actualizado');
      } else {
        await createMantenimiento({
          unidadId: form.unidadId,
          proveedorId: form.proveedorId || undefined,
          tipo: form.tipo,
          descripcion: form.descripcion,
          costo: parseFloat(form.costo) || 0,
          fechaInicio: form.fechaInicio,
          fechaFin: form.fechaFin || undefined,
          estado: form.estado,
        });
      }
      setModalAbierto(false);
      cargar();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const mantenimientosFiltrados = useMemo(
    () =>
      mantenimientos.filter((m) => {
        if (filtroUnidadId && m.unidadId !== filtroUnidadId) return false;
        if (filtroTipo && m.tipo !== filtroTipo) return false;
        if (filtroEstado && m.estado !== filtroEstado) return false;
        if (!coincideBusqueda(m, busqueda)) return false;
        return true;
      }),
    [mantenimientos, filtroUnidadId, filtroTipo, filtroEstado, busqueda]
  );

  const hayFiltros =
    !!busqueda.trim() || !!filtroUnidadId || !!filtroTipo || !!filtroEstado;

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroUnidadId('');
    setFiltroTipo('');
    setFiltroEstado('');
  };

  const activos = mantenimientosFiltrados.filter(
    (m) => m.estado === 'en_proceso' || m.estado === 'programado'
  );
  const completados = mantenimientosFiltrados.filter((m) => m.estado === 'completado');

  return (
    <div>
      <header className={CRUD_HEADER_ROW}>
        <div>
          <h1 className={CRUD_PAGE_TITLE}>Mantenimiento</h1>
          <p className={CRUD_PAGE_SUBTITLE}>
            Asigna unidad y proveedor de servicio; el costo se acumula en el expediente del proveedor en Administración.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
          + Registrar servicio
        </button>
      </header>

      {error && <div className={CRUD_ERROR_BANNER}>{error}</div>}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-skyline-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Activos y programados</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : activos.length === 0 ? (
            <p className="text-sm text-gray-500">
              {hayFiltros
                ? 'Ningún servicio en curso coincide con los filtros.'
                : 'No hay servicios en curso.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {activos.map((m) => (
                <li
                  key={m.id}
                  className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-lg border border-skyline-border p-3 transition hover:bg-skyline-bg"
                  onClick={() => abrirEditar(m)}
                >
                  <div>
                    <strong className="block text-gray-900">
                      {etiquetaUnidadLista({
                        numeroEconomico: m.numeroEconomico ?? '',
                        placas: m.placas ?? m.unidadId,
                        marca: m.marca ?? '—',
                        modelo: m.modelo ?? '',
                      })}
                    </strong>
                    <span className="text-sm text-gray-600">{m.descripcion || m.tipo}</span>
                    {m.proveedorNombre ? (
                      <span className="mt-0.5 block text-xs text-skyline-blue">
                        Proveedor: {m.proveedorNombre}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        m.estado === 'en_proceso' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {ESTADOS.find((e) => e.v === m.estado)?.l ?? m.estado}
                    </span>
                    <span className="text-sm text-gray-500">{formatearFecha(m.fechaInicio)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-skyline-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Historial completado</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : completados.length === 0 ? (
            <p className="text-sm text-gray-500">
              {hayFiltros
                ? 'Ningún servicio completado coincide con los filtros.'
                : 'No hay servicios completados.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {completados.slice(0, 10).map((m) => (
                <li
                  key={m.id}
                  className="flex cursor-pointer items-center justify-between rounded border border-skyline-border p-2 text-sm hover:bg-skyline-bg"
                  onClick={() => abrirEditar(m)}
                >
                  <span>
                    {etiquetaUnidadLista({
                      numeroEconomico: m.numeroEconomico ?? '',
                      placas: m.placas ?? m.unidadId,
                      marca: m.marca ?? '—',
                      modelo: m.modelo ?? '',
                    })}{' '}
                    · {m.tipo}
                  </span>
                  <span className="text-gray-500">
                    {formatearFecha(m.fechaInicio)} · ${(m.costo ?? 0).toLocaleString('es-MX')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Todos los registros</h2>
          {!loading && (
            <p className="text-xs leading-relaxed text-gray-600">
              <span className="font-semibold text-gray-900">
                {mantenimientosFiltrados.length} de {mantenimientos.length}
              </span>{' '}
              registros · Clic en una fila para editar.
            </p>
          )}
        </div>

        {!loading && (
          <div className={`${CRUD_TOOLBAR} mb-4`}>
            <label htmlFor="mant-busqueda" className="block min-w-0 flex-1 lg:max-w-md">
              <span className={CRUD_SEARCH_LABEL}>Buscar</span>
              <div className={CRUD_SEARCH_INNER}>
                <Icon icon="mdi:magnify" className="size-4 shrink-0 text-skyline-muted" aria-hidden />
                <input
                  id="mant-busqueda"
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Núm. económico, placas, descripción, tipo…"
                  className={CRUD_SEARCH_INPUT}
                  autoComplete="off"
                />
              </div>
            </label>
            <div className={`${CRUD_FILTER_GRID} mt-2`}>
              <label className={`block ${CRUD_SEARCH_LABEL}`}>
                Unidad
                <select
                  id="mant-unidad"
                  value={filtroUnidadId}
                  onChange={(e) => setFiltroUnidadId(e.target.value)}
                  className={CRUD_SELECT}
                >
                  <option value="">Todas</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {etiquetaUnidadLista(u)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`block ${CRUD_SEARCH_LABEL}`}>
                Tipo
                <select
                  id="mant-tipo"
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className={CRUD_SELECT}
                >
                  <option value="">Todos</option>
                  {TIPOS.map((t) => (
                    <option key={t.v} value={t.v}>
                      {t.l}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`block ${CRUD_SEARCH_LABEL}`}>
                Estado
                <select
                  id="mant-estado"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className={CRUD_SELECT}
                >
                  <option value="">Todos</option>
                  {ESTADOS.map((e) => (
                    <option key={e.v} value={e.v}>
                      {e.l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {hayFiltros && (
              <div className="mt-2">
                <button type="button" onClick={limpiarFiltros} className="btn btn-outline btn-sm">
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className={CRUD_SPINNER_WRAP}>
            <div className={CRUD_SPINNER} />
          </div>
        ) : (
          <div className={CRUD_TABLE_OUTER}>
            <table className={CRUD_TABLE}>
              <thead>
                <tr className={CRUD_THEAD_TR}>
                  <CrudTableTh className="min-w-[7rem] px-2 py-3.5 text-left align-middle" icon="mdi:truck-outline" align="start">
                    Unidad
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[7rem] px-2 py-3.5 text-left align-middle" icon="mdi:domain" align="start">
                    Proveedor
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[5rem] px-2 py-3.5 text-left align-middle" icon="mdi:wrench-outline" align="start">
                    Tipo
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[8rem] px-2 py-3.5 text-left align-middle" icon="mdi:text-box-outline" align="start">
                    Descripción
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[7rem] px-2 py-3.5 text-left align-middle" icon="mdi:calendar-range" align="start">
                    Fechas
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[5rem] px-2 py-3.5 text-left align-middle" icon="mdi:cash-multiple" align="start">
                    Costo
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[5rem] px-2 py-3.5 text-left align-middle" icon="mdi:bookmark-check-outline" align="start">
                    Estado
                  </CrudTableTh>
                </tr>
              </thead>
              <tbody className={CRUD_TBODY}>
                {mantenimientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                      {mantenimientos.length === 0
                        ? 'Sin registros. Usa «Registrar servicio» para agregar uno.'
                        : hayFiltros
                          ? 'No hay registros que coincidan con la búsqueda o los filtros.'
                          : 'Sin registros.'}
                    </td>
                  </tr>
                ) : (
                  mantenimientosFiltrados.map((m, rowIdx) => (
                    <tr
                      key={m.id}
                      className={crudTableRowClass(rowIdx, { clickable: true })}
                      onClick={() => abrirEditar(m)}
                    >
                      <td className="px-3 py-2.5 align-middle">
                        {(m.numeroEconomico ?? '').trim() ? (
                          <span className="block">
                            <span className={CRUD_CELDA_PRIMARIO_LEFT}>{(m.numeroEconomico ?? '').trim()}</span>
                            <span className={`block text-xs ${CRUD_CELDA_SEC_LEFT} text-slate-600`}>{m.placas ?? m.unidadId}</span>
                          </span>
                        ) : (
                          <span className={CRUD_CELDA_SEC_LEFT}>{m.placas ?? m.unidadId}</span>
                        )}
                      </td>
                      <td className={`px-3 py-2.5 align-middle ${CRUD_CELDA_SEC_LEFT}`}>
                        {m.proveedorNombre ? (
                          <span>{m.proveedorNombre}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className={`px-3 py-2.5 align-middle capitalize ${CRUD_CELDA_SEC_LEFT}`}>{m.tipo}</td>
                      <td className={`max-w-[200px] truncate px-3 py-2.5 align-middle ${CRUD_CELDA_SEC_LEFT}`}>{m.descripcion || '-'}</td>
                      <td className={`px-3 py-2.5 align-middle ${CRUD_CELDA_SEC_LEFT} text-slate-600`}>
                        {formatearFecha(m.fechaInicio)} → {formatearFecha(m.fechaFin ?? '')}
                      </td>
                      <td className={`px-3 py-2.5 align-middle tabular-nums font-semibold ${CRUD_CELDA_SEC_LEFT}`}>
                        ${(m.costo ?? 0).toLocaleString('es-MX')}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs ${
                            m.estado === 'completado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.estado === 'en_proceso'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {ESTADOS.find((e) => e.v === m.estado)?.l ?? m.estado}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModalAbierto(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold">
              {editando ? 'Editar mantenimiento' : 'Registrar servicio'}
            </h3>
            <form onSubmit={enviar} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Unidad</label>
                <select
                  value={form.unidadId}
                  onChange={(e) => setForm((f) => ({ ...f, unidadId: e.target.value }))}
                  className="input w-full"
                  required
                  disabled={!!editando}
                >
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {etiquetaUnidadLista(u)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Proveedor de servicio (taller / refacciones)
                </label>
                <select
                  value={form.proveedorId}
                  onChange={(e) => setForm((f) => ({ ...f, proveedorId: e.target.value }))}
                  className="input w-full"
                >
                  <option value="">Sin proveedor en catálogo</option>
                  {proveedoresCat.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombreRazonSocial}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  El costo de este registro se suma al total de mantenimiento del proveedor en su expediente.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                  className="input w-full"
                >
                  {TIPOS.map((t) => (
                    <option key={t.v} value={t.v}>{t.l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  className="input w-full"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Fecha inicio</label>
                  <input
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Fecha fin</label>
                  <input
                    type="date"
                    value={form.fechaFin}
                    onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Costo</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.costo}
                    onChange={(e) => setForm((f) => ({ ...f, costo: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Estado</label>
                  <select
                    value={form.estado}
                    onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                    className="input w-full"
                  >
                    {ESTADOS.map((e) => (
                      <option key={e.v} value={e.v}>{e.l}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalAbierto(false)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={enviando}>
                  {enviando ? 'Guardando...' : editando ? 'Guardar' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
