import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  getUnidades,
  getRentas,
  getCheckinOutRegistros,
  createCheckinOutRegistro,
  updateCheckinOutRegistro,
  deleteCheckinOutRegistro,
  type UnidadRow,
  type RentaRow,
  type CheckinOutRegistro,
  type ChecklistItemPayload,
} from '../api/client';

const ROLES_COLABORADOR = [
  { v: '', l: 'Sin especificar' },
  { v: 'cliente', l: 'Cliente' },
  { v: 'operador_skyline', l: 'Operador Skyline' },
  { v: 'transportista', l: 'Transportista / tercero' },
  { v: 'supervisor', l: 'Supervisor' },
  { v: 'otro', l: 'Otro' },
];

const BASE_MATERIAL: { id: string; label: string }[] = [
  { id: 'gato', label: 'Gato hidráulico y base' },
  { id: 'llanta', label: 'Llanta de refacción' },
  { id: 'cruceta', label: 'Cruceta / barra de fuerza' },
  { id: 'triangulos', label: 'Triángulos reflejantes' },
  { id: 'extintor', label: 'Extintor vigente' },
  { id: 'herramientas', label: 'Kit herramientas básico' },
  { id: 'llaves', label: 'Llaves de unidad / control' },
  { id: 'documentos', label: 'Documentación (circulación, seguro visible)' },
];

const MATERIAL_REFRIGERADO: { id: string; label: string }[] = [
  { id: 'mangueras', label: 'Mangueras / conexiones refrigeración' },
  { id: 'candado', label: 'Candado de puerta / equipo' },
  { id: 'temperatura', label: 'Equipo de frío operando / registro temp.' },
];

const MATERIAL_MAQUINARIA: { id: string; label: string }[] = [
  { id: 'implementos', label: 'Implementos / accesorios acoplados' },
  { id: 'seguridad_maq', label: 'Elementos de seguridad (cintas, señalización)' },
];

function buildChecklist(tipoUnidad?: string): ChecklistItemPayload[] {
  const items = [...BASE_MATERIAL];
  if (tipoUnidad === 'refrigerado') items.push(...MATERIAL_REFRIGERADO);
  if (tipoUnidad === 'maquinaria') items.push(...MATERIAL_MAQUINARIA);
  return items.map((i) => ({ id: i.id, label: i.label, presente: true }));
}

function formatFechaRegistro(s: string) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function textoBusquedaRegistro(r: CheckinOutRegistro): string {
  const tipoTxt = r.tipo === 'checkin' ? 'check-in checkin entrada recepción' : 'check-out checkout salida entrega';
  return [
    r.placas,
    r.marca,
    r.modelo,
    r.rentaCliente,
    r.rentaId,
    r.colaboradorNombre,
    r.colaboradorRol,
    ROLES_COLABORADOR.find((x) => x.v === r.colaboradorRol)?.l,
    r.usuarioNombre,
    r.observaciones,
    String(r.kilometraje ?? ''),
    String(r.combustiblePct ?? ''),
    tipoTxt,
    formatFechaRegistro(r.creadoEn),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function coincideBusquedaRegistro(r: CheckinOutRegistro, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const hay = textoBusquedaRegistro(r);
  return t.split(/\s+/).every((p) => p.length > 0 && hay.includes(p));
}

export function CheckInOut() {
  const { hasRole } = useAuth();
  const { toast } = useNotification();
  const soloLectura = hasRole('consulta') && !hasRole('administrador', 'supervisor', 'operador');

  const [unidades, setUnidades] = useState<UnidadRow[]>([]);
  const [rentas, setRentas] = useState<RentaRow[]>([]);
  const [registros, setRegistros] = useState<CheckinOutRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTipo, setModalTipo] = useState<'checkin' | 'checkout' | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'checkin' | 'checkout' | ''>('');
  const [filtroUnidadId, setFiltroUnidadId] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [unidadId, setUnidadId] = useState('');
  const [rentaId, setRentaId] = useState('');
  const [colaboradorNombre, setColaboradorNombre] = useState('');
  const [colaboradorRol, setColaboradorRol] = useState('');
  const [kilometraje, setKilometraje] = useState('');
  const [combustiblePct, setCombustiblePct] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItemPayload[]>(() => buildChecklist());
  const [observaciones, setObservaciones] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r, reg] = await Promise.all([getUnidades(), getRentas(), getCheckinOutRegistros(100)]);
      setUnidades(u);
      setRentas(r);
      setRegistros(reg);
    } catch {
      toast('No se pudieron cargar los datos', 'error');
      setUnidades([]);
      setRentas([]);
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const unidadSel = useMemo(() => unidades.find((u) => u.id === unidadId), [unidades, unidadId]);

  useEffect(() => {
    if (editandoId) return;
    if (unidadSel) {
      setChecklist(buildChecklist(unidadSel.tipoUnidad));
      setKilometraje(String(unidadSel.kilometraje ?? ''));
      setCombustiblePct(String(unidadSel.combustiblePct ?? ''));
    }
  }, [unidadSel?.id, unidadSel?.tipoUnidad, editandoId]);

  const rentasUnidad = useMemo(() => {
    if (!unidadId) return [];
    const list = rentas.filter(
      (r) => r.unidadId === unidadId && ['activa', 'reservada'].includes(r.estado)
    );
    if (editandoId && rentaId && !list.some((r) => r.id === rentaId)) {
      const extra = rentas.find((r) => r.id === rentaId && r.unidadId === unidadId);
      if (extra) return [extra, ...list];
    }
    return list;
  }, [rentas, unidadId, editandoId, rentaId]);

  const registrosFiltrados = useMemo(
    () =>
      registros.filter((r) => {
        if (filtroTipo && r.tipo !== filtroTipo) return false;
        if (filtroUnidadId && r.unidadId !== filtroUnidadId) return false;
        if (!coincideBusquedaRegistro(r, busqueda)) return false;
        return true;
      }),
    [registros, filtroTipo, filtroUnidadId, busqueda]
  );

  const hayFiltros = !!busqueda.trim() || !!filtroTipo || !!filtroUnidadId;

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroTipo('');
    setFiltroUnidadId('');
  };

  function abrirModal(tipo: 'checkin' | 'checkout') {
    setEditandoId(null);
    setModalTipo(tipo);
    setUnidadId('');
    setRentaId('');
    setColaboradorNombre('');
    setColaboradorRol('');
    setObservaciones('');
    setChecklist(buildChecklist());
    setKilometraje('');
    setCombustiblePct('');
  }

  function cerrarModal() {
    setModalTipo(null);
    setEditandoId(null);
  }

  function abrirEditar(reg: CheckinOutRegistro) {
    if (soloLectura) return;
    setEditandoId(reg.id);
    setModalTipo(reg.tipo);
    setUnidadId(reg.unidadId);
    setRentaId(reg.rentaId || '');
    setColaboradorNombre(reg.colaboradorNombre || '');
    setColaboradorRol(reg.colaboradorRol || '');
    setKilometraje(reg.kilometraje != null ? String(reg.kilometraje) : '');
    setCombustiblePct(reg.combustiblePct != null ? String(reg.combustiblePct) : '');
    setObservaciones(reg.observaciones || '');
    const u = unidades.find((x) => x.id === reg.unidadId);
    setChecklist(
      reg.checklist && reg.checklist.length > 0 ? reg.checklist : buildChecklist(u?.tipoUnidad)
    );
  }

  async function eliminarRegistro(reg: CheckinOutRegistro, ev: React.MouseEvent) {
    ev.stopPropagation();
    if (soloLectura) return;
    if (
      !confirm(
        `¿Eliminar el ${reg.tipo === 'checkin' ? 'check-in' : 'check-out'} de ${reg.placas}? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    try {
      await deleteCheckinOutRegistro(reg.id);
      toast('Registro eliminado');
      cargar();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al eliminar', 'error');
    }
  }

  function toggleCheck(id: string) {
    setChecklist((prev) => prev.map((c) => (c.id === id ? { ...c, presente: !c.presente } : c)));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!modalTipo || !unidadId) {
      toast('Selecciona una unidad', 'error');
      return;
    }
    setEnviando(true);
    try {
      const payload = {
        tipo: modalTipo,
        unidadId,
        rentaId: rentaId || null,
        colaboradorNombre: colaboradorNombre.trim(),
        colaboradorRol,
        kilometraje: kilometraje === '' ? undefined : kilometraje,
        combustiblePct: combustiblePct === '' ? undefined : combustiblePct,
        checklist,
        observaciones: observaciones.trim(),
      };
      if (editandoId) {
        await updateCheckinOutRegistro(editandoId, payload);
        toast('Registro actualizado');
      } else {
        await createCheckinOutRegistro(payload);
        toast(modalTipo === 'checkin' ? 'Check-in registrado' : 'Check-out registrado');
      }
      cerrarModal();
      cargar();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al guardar', 'error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Check-in / Check-out</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Entrega y recepción con colaborador, unidad, renta opcional e inventario de material según tipo de equipo
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline"
            disabled={soloLectura}
            onClick={() => abrirModal('checkin')}
          >
            <Icon icon="mdi:clipboard-arrow-left" className="size-5" aria-hidden />
            Check-in
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={soloLectura}
            onClick={() => abrirModal('checkout')}
          >
            <Icon icon="mdi:clipboard-arrow-right" className="size-5" aria-hidden />
            Check-out
          </button>
        </div>
      </header>

      {soloLectura && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Tu rol solo permite consultar. No puedes registrar check-in ni check-out.
        </div>
      )}

      <div className="rounded-lg border border-skyline-border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-skyline-border px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Registros recientes</h2>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto">
            {!loading && registros.length > 0 && (
              <span className="text-sm text-gray-500">
                Mostrando{' '}
                <span className="font-medium text-gray-700">{registrosFiltrados.length}</span> de{' '}
                {registros.length}
              </span>
            )}
            <button
              type="button"
              onClick={() => cargar()}
              disabled={loading}
              className="btn btn-outline inline-flex shrink-0 items-center gap-2"
            >
              <Icon icon="mdi:refresh" className={`size-5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Actualizar
            </button>
          </div>
        </div>

        {!loading && (
          <div className="flex flex-col gap-3 border-b border-skyline-border bg-skyline-bg/50 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[min(100%,200px)] flex-1">
              <label htmlFor="cio-busqueda" className="mb-1 block text-xs font-medium text-gray-600">
                Buscar
              </label>
              <input
                id="cio-busqueda"
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Placas, cliente, colaborador, observaciones…"
                className="input w-full"
                autoComplete="off"
              />
            </div>
            <div className="min-w-[130px]">
              <label htmlFor="cio-tipo" className="mb-1 block text-xs font-medium text-gray-600">
                Tipo
              </label>
              <select
                id="cio-tipo"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as '' | 'checkin' | 'checkout')}
                className="input w-full"
              >
                <option value="">Todos</option>
                <option value="checkin">Check-in</option>
                <option value="checkout">Check-out</option>
              </select>
            </div>
            <div className="min-w-[160px]">
              <label htmlFor="cio-unidad" className="mb-1 block text-xs font-medium text-gray-600">
                Unidad
              </label>
              <select
                id="cio-unidad"
                value={filtroUnidadId}
                onChange={(e) => setFiltroUnidadId(e.target.value)}
                className="input w-full"
              >
                <option value="">Todas</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.placas} — {u.marca} {u.modelo}
                  </option>
                ))}
              </select>
            </div>
            {hayFiltros && (
              <button type="button" onClick={limpiarFiltros} className="btn btn-outline text-sm">
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {loading ? (
          <p className="p-8 text-center text-sm text-skyline-muted">Cargando…</p>
        ) : registros.length === 0 ? (
          <p className="p-8 text-center text-sm text-skyline-muted">
            Aún no hay registros. Usa Check-in o Check-out para el primero.
          </p>
        ) : registrosFiltrados.length === 0 ? (
          <p className="p-8 text-center text-sm text-skyline-muted">
            No hay registros que coincidan con la búsqueda o los filtros.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-skyline-border bg-skyline-bg text-xs font-semibold uppercase tracking-wide text-skyline-muted">
                <tr>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Unidad</th>
                  <th className="px-4 py-2">Renta / cliente</th>
                  <th className="px-4 py-2">Colaborador</th>
                  <th className="px-4 py-2">Registró</th>
                  <th className="px-4 py-2">Km / comb.</th>
                  <th className="px-4 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-skyline-border">
                {registrosFiltrados.map((r) => (
                  <tr
                    key={r.id}
                    className={soloLectura ? 'hover:bg-gray-50/80' : 'cursor-pointer hover:bg-gray-50/80'}
                    onClick={() => !soloLectura && abrirEditar(r)}
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">{formatFechaRegistro(r.creadoEn)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.tipo === 'checkin'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        <Icon
                          icon={r.tipo === 'checkin' ? 'mdi:login' : 'mdi:logout'}
                          className="size-3.5"
                          aria-hidden
                        />
                        {r.tipo === 'checkin' ? 'Check-in' : 'Check-out'}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {r.placas}
                      <span className="block text-xs font-normal text-gray-500">
                        {r.marca} {r.modelo}
                      </span>
                    </td>
                    <td className="max-w-[180px] px-4 py-2 text-gray-600">
                      {r.rentaCliente ? (
                        <>
                          <span className="block truncate" title={r.rentaCliente}>
                            {r.rentaCliente}
                          </span>
                          {r.rentaId && (
                            <Link
                              to={`/rentas/${r.rentaId}`}
                              className="btn btn-outline btn-sm no-underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Expediente
                            </Link>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="max-w-[160px] px-4 py-2 text-gray-600">
                      {r.colaboradorNombre || '—'}
                      {r.colaboradorRol && (
                        <span className="block text-xs text-gray-400">
                          {ROLES_COLABORADOR.find((x) => x.v === r.colaboradorRol)?.l ?? r.colaboradorRol}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{r.usuarioNombre || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-600">
                      {r.kilometraje != null ? `${r.kilometraje.toLocaleString('es-MX')} km` : '—'}
                      <br />
                      {r.combustiblePct != null ? `${r.combustiblePct}%` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      {soloLectura ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => abrirEditar(r)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={(e) => eliminarRegistro(r, e)}
                          >
                            Borrar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalTipo && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10"
          onClick={cerrarModal}
        >
          <div
            className="notif-menu-open mb-10 w-full max-w-lg rounded-xl border border-skyline-border bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-skyline-border bg-skyline-bg px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editandoId
                  ? 'Editar registro check-in / check-out'
                  : modalTipo === 'checkin'
                    ? 'Check-in (recepción)'
                    : 'Check-out (entrega)'}
              </h3>
              <p className="text-sm text-gray-500">
                {editandoId
                  ? 'Modifica los datos y guarda. El usuario que registró originalmente no cambia.'
                  : `Completa unidad, colaborador, lecturas e inventario. Se guarda en historial de la unidad${
                      modalTipo === 'checkout' ? ' y en la renta si la vinculas.' : '.'
                    }`}
              </p>
            </div>
            <form onSubmit={enviar} className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
              {editandoId && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de movimiento</label>
                  <select
                    value={modalTipo || 'checkin'}
                    onChange={(e) => setModalTipo(e.target.value as 'checkin' | 'checkout')}
                    className="input w-full"
                  >
                    <option value="checkin">Check-in (recepción)</option>
                    <option value="checkout">Check-out (entrega)</option>
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Unidad *</label>
                <select
                  value={unidadId}
                  onChange={(e) => {
                    setUnidadId(e.target.value);
                    setRentaId('');
                  }}
                  className="input w-full"
                  required
                  disabled={!!editandoId}
                >
                  <option value="">Seleccionar…</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.placas} — {u.marca} {u.modelo} ({u.estatus})
                      {u.tipoUnidad === 'refrigerado' ? ' · Ref.' : u.tipoUnidad === 'maquinaria' ? ' · Máq.' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Renta asociada (opcional)</label>
                <select
                  value={rentaId}
                  onChange={(e) => setRentaId(e.target.value)}
                  className="input w-full"
                  disabled={!unidadId || rentasUnidad.length === 0}
                >
                  <option value="">Sin vincular a renta</option>
                  {rentasUnidad.map((r) => (
                    <option key={r.id} value={r.id}>
                      #{r.id} · {r.clienteNombre} · {r.estado}
                    </option>
                  ))}
                </select>
                {unidadId && rentasUnidad.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">No hay rentas activas o reservadas para esta unidad.</p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Colaborador (nombre)</label>
                  <input
                    type="text"
                    value={colaboradorNombre}
                    onChange={(e) => setColaboradorNombre(e.target.value)}
                    className="input w-full"
                    placeholder="Ej. cliente, operador de patio…"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Rol del colaborador</label>
                  <select
                    value={colaboradorRol}
                    onChange={(e) => setColaboradorRol(e.target.value)}
                    className="input w-full"
                  >
                    {ROLES_COLABORADOR.map((o) => (
                      <option key={o.v || 'x'} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Kilometraje</label>
                  <input
                    type="number"
                    min={0}
                    value={kilometraje}
                    onChange={(e) => setKilometraje(e.target.value)}
                    className="input w-full"
                    placeholder="Odómetro"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Combustible (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={combustiblePct}
                    onChange={(e) => setCombustiblePct(e.target.value)}
                    className="input w-full"
                    placeholder="0–100"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Inventario / material
                  {unidadSel?.tipoUnidad === 'refrigerado' && (
                    <span className="ml-2 font-normal text-skyline-blue">· ítems refrigerado incluidos</span>
                  )}
                  {unidadSel?.tipoUnidad === 'maquinaria' && (
                    <span className="ml-2 font-normal text-skyline-blue">· ítems maquinaria incluidos</span>
                  )}
                </p>
                <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-skyline-border p-3">
                  {checklist.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={c.presente}
                          onChange={() => toggleCheck(c.id)}
                          className="mt-0.5 rounded border-gray-300"
                        />
                        <span className={c.presente ? 'text-gray-800' : 'text-amber-800 line-through opacity-80'}>
                          {c.label}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-gray-500">Desmarca lo que falte o no aplique en este momento.</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="input min-h-[80px] w-full resize-y"
                  placeholder="Daños, faltantes, condiciones especiales…"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-skyline-border pt-4">
                <button type="button" className="btn btn-outline" onClick={cerrarModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={enviando}>
                  {enviando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
