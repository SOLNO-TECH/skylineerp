import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useNotification } from '../context/NotificationContext';
import {
  getRentas,
  getRentasCalendario,
  getUnidades,
  getClientes,
  createRenta,
  updateRenta,
  deleteRenta,
  type RentaRow,
  type RentaCalendario,
  type UnidadRow,
  type ClienteListRow,
} from '../api/client';
import { MapPicker } from '../components/MapPicker';
import { etiquetaUnidadLista } from '../lib/unidadDisplay';
import {
  TIPOS_UNIDAD_OPCIONES,
  esTipoRefrigeradoCatalogo,
  labelTipoUnidad,
} from '../lib/tipoUnidadCatalogo';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const COLOR_POR_TIPO: Record<string, string> = {
  remolque_seco: 'bg-sky-100 text-sky-800',
  refrigerado: 'bg-cyan-100 text-cyan-800',
  maquinaria: 'bg-amber-100 text-amber-800',
  dolly: 'bg-violet-100 text-violet-900',
  plataforma: 'bg-indigo-100 text-indigo-900',
  camion: 'bg-orange-100 text-orange-900',
  vehiculo_empresarial: 'bg-emerald-100 text-emerald-900',
  caja_refrigerada_sin_termo: 'bg-teal-100 text-teal-900',
  pickup: 'bg-lime-100 text-lime-900',
};
const ESTADOS: Record<string, { label: string; color: string }> = {
  reservada: { label: 'Reservada', color: 'bg-amber-100 text-amber-800' },
  activa: { label: 'Activa', color: 'bg-emerald-100 text-emerald-800' },
  finalizada: { label: 'Finalizada', color: 'bg-slate-100 text-slate-600' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
};

function formatearFecha(s: string) {
  if (!s) return '';
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
}

function formatearFechaCompleta(s: string) {
  if (!s) return '';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function hoyStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function obtenerSemanasDelMes(ano: number, mes: number) {
  const primer = new Date(ano, mes - 1, 1);
  const ultimo = new Date(ano, mes, 0);
  const inicioDom = primer.getDay();
  const diasMes = ultimo.getDate();
  const semanas: (number | null)[][] = [];
  let semana: (number | null)[] = [];
  for (let i = 0; i < inicioDom; i++) semana.push(null);
  for (let d = 1; d <= diasMes; d++) {
    semana.push(d);
    if (semana.length === 7) {
      semanas.push(semana);
      semana = [];
    }
  }
  if (semana.length) {
    while (semana.length < 7) semana.push(null);
    semanas.push(semana);
  }
  return semanas;
}

function rentaIncluyeDia(r: RentaCalendario, ano: number, mes: number, dia: number): boolean {
  const dStr = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  return r.fechaInicio <= dStr && dStr <= r.fechaFin;
}

const TIPOS_SERVICIO_OPT = [
  { v: 'solo_renta', l: 'Solo renta' },
  { v: 'con_operador', l: 'Con operador' },
  { v: 'con_transporte', l: 'Con transporte' },
];
const ESTADOS_LOG_OPT = [
  { v: 'programado', l: 'Programado' },
  { v: 'en_camino', l: 'En camino' },
  { v: 'entregado', l: 'Entregado' },
  { v: 'finalizado', l: 'Finalizado' },
];
export function Rentas() {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [rentas, setRentas] = useState<RentaRow[]>([]);
  const [calendario, setCalendario] = useState<RentaCalendario[]>([]);
  const [unidades, setUnidades] = useState<UnidadRow[]>([]);
  const [clientes, setClientes] = useState<ClienteListRow[]>([]);
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [mes, setMes] = useState(() => new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<RentaRow | null>(null);
  const [form, setForm] = useState({
    unidadId: '',
    clienteId: '',
    clienteNombre: '',
    clienteTelefono: '',
    clienteEmail: '',
    fechaInicio: hoyStr(),
    fechaFin: hoyStr(),
    monto: '',
    deposito: '',
    observaciones: '',
    tipoServicio: 'solo_renta',
    ubicacionEntrega: '',
    ubicacionRecoleccion: '',
    estadoLogistico: 'programado',
    precioBase: '',
    extras: '',
    operadorAsignado: '',
    refTemp: '',
    refCombI: '',
    refCombF: '',
    refHorasI: '',
    refHorasF: '',
    maqOperador: '',
    maqHoras: '',
    maqTrabajo: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroLogistico, setFiltroLogistico] = useState('');
  const [filtroTipoUnidad, setFiltroTipoUnidad] = useState('');

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, c, u, cl] = await Promise.all([
        getRentas(),
        getRentasCalendario(ano, mes),
        getUnidades(),
        getClientes(),
      ]);
      setRentas(r);
      setCalendario(c);
      setUnidades(u);
      setClientes(cl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [ano, mes]);

  const proximasRentas = rentas
    .filter((r) => r.fechaInicio >= hoyStr() && !['finalizada', 'cancelada'].includes(r.estado))
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))
    .slice(0, 5);

  const rentasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const matchText = (s: string | undefined | null) => {
      if (!q) return true;
      const t = (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
      return t.includes(q);
    };
    return rentas.filter((r) => {
      if (filtroEstado && r.estado !== filtroEstado) return false;
      const log = r.estadoLogistico || 'programado';
      if (filtroLogistico && log !== filtroLogistico) return false;
      const tipo = r.tipoUnidad || 'remolque_seco';
      if (filtroTipoUnidad && tipo !== filtroTipoUnidad) return false;
      if (!q) return true;
      return (
        matchText(r.placas) ||
        matchText(r.clienteNombre) ||
        matchText(r.operadorAsignado) ||
        matchText(r.ubicacionEntrega) ||
        matchText(r.ubicacionRecoleccion) ||
        matchText(r.id) ||
        matchText(r.clienteTelefono) ||
        matchText(r.clienteEmail)
      );
    });
  }, [rentas, busqueda, filtroEstado, filtroLogistico, filtroTipoUnidad]);

  const filtrosActivos =
    Boolean(busqueda.trim()) ||
    Boolean(filtroEstado) ||
    Boolean(filtroLogistico) ||
    Boolean(filtroTipoUnidad);

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroEstado('');
    setFiltroLogistico('');
    setFiltroTipoUnidad('');
  };

  const abrirNueva = () => {
    setEditando(null);
    const primeraDisponible = unidades.find((u) => u.estatus === 'Disponible')?.id ?? '';
    setForm({
      unidadId: primeraDisponible,
      clienteId: '',
      clienteNombre: '',
      clienteTelefono: '',
      clienteEmail: '',
      fechaInicio: hoyStr(),
      fechaFin: hoyStr(),
      monto: '',
      deposito: '',
      observaciones: '',
      tipoServicio: 'solo_renta',
      ubicacionEntrega: '',
      ubicacionRecoleccion: '',
      estadoLogistico: 'programado',
      precioBase: '',
      extras: '',
      operadorAsignado: '',
      refTemp: '',
      refCombI: '',
      refCombF: '',
      refHorasI: '',
      refHorasF: '',
      maqOperador: '',
      maqHoras: '',
      maqTrabajo: '',
    });
    setErrorForm(null);
    setModalAbierto(true);
  };

  const abrirEditar = (r: RentaRow, ev?: React.MouseEvent) => {
    if (ev) ev.stopPropagation();
    setEditando(r);
    setForm({
      unidadId: r.unidadId,
      clienteId: r.clienteId ?? '',
      clienteNombre: r.clienteNombre,
      clienteTelefono: r.clienteTelefono,
      clienteEmail: r.clienteEmail,
      fechaInicio: r.fechaInicio,
      fechaFin: r.fechaFin,
      monto: String(r.precioBase ?? r.monto ?? ''),
      deposito: String(r.deposito || ''),
      observaciones: r.observaciones || '',
      tipoServicio: r.tipoServicio || 'solo_renta',
      ubicacionEntrega: r.ubicacionEntrega || '',
      ubicacionRecoleccion: r.ubicacionRecoleccion || '',
      estadoLogistico: r.estadoLogistico || 'programado',
      precioBase: String(r.precioBase ?? r.monto ?? ''),
      extras: String(r.extras ?? ''),
      operadorAsignado: r.operadorAsignado || '',
      refTemp: String(r.refrigerado?.temperaturaObjetivo ?? ''),
      refCombI: String(r.refrigerado?.combustibleInicio ?? ''),
      refCombF: String(r.refrigerado?.combustibleFin ?? ''),
      refHorasI: String(r.refrigerado?.horasMotorInicio ?? ''),
      refHorasF: String(r.refrigerado?.horasMotorFin ?? ''),
      maqOperador: r.maquinaria?.operadorAsignado ?? r.operadorAsignado ?? '',
      maqHoras: String(r.maquinaria?.horasTrabajadas ?? ''),
      maqTrabajo: r.maquinaria?.tipoTrabajo ?? '',
    });
    setErrorForm(null);
    setModalAbierto(true);
  };

  const unidadSeleccionada = unidades.find((u) => u.id === form.unidadId);

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditando(null);
  };

  const enviarForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null);
    if (!form.unidadId || !form.clienteNombre.trim() || !form.fechaInicio || !form.fechaFin) {
      setErrorForm('Unidad, cliente, fecha inicio y fin son obligatorios.');
      return;
    }
    if (form.fechaInicio > form.fechaFin) {
      setErrorForm('La fecha de fin debe ser posterior a la de inicio.');
      return;
    }
    setEnviando(true);
    try {
      const pb = parseFloat(form.precioBase || form.monto) || 0;
      const ex = parseFloat(form.extras) || 0;
      const payload: Record<string, unknown> = {
        unidadId: form.unidadId,
        clienteNombre: form.clienteNombre.trim(),
        clienteTelefono: form.clienteTelefono.trim(),
        clienteEmail: form.clienteEmail.trim(),
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        monto: pb + ex || parseFloat(form.monto) || 0,
        deposito: parseFloat(form.deposito) || 0,
        observaciones: form.observaciones.trim(),
        tipoServicio: form.tipoServicio,
        ubicacionEntrega: form.ubicacionEntrega.trim(),
        ubicacionRecoleccion: form.ubicacionRecoleccion.trim(),
        estadoLogistico: form.estadoLogistico,
        precioBase: pb,
        extras: ex,
        operadorAsignado: form.operadorAsignado.trim(),
      };
      if (esTipoRefrigeradoCatalogo(unidadSeleccionada?.tipoUnidad)) {
        payload.refrigerado = {
          temperaturaObjetivo: parseFloat(form.refTemp) || 0,
          combustibleInicio: parseInt(form.refCombI, 10) || 0,
          combustibleFin: parseInt(form.refCombF, 10) || 0,
          horasMotorInicio: parseInt(form.refHorasI, 10) || 0,
          horasMotorFin: parseInt(form.refHorasF, 10) || 0,
        };
      }
      if (unidadSeleccionada?.tipoUnidad === 'maquinaria') {
        payload.maquinaria = {
          operadorAsignado: form.maqOperador.trim(),
          horasTrabajadas: parseFloat(form.maqHoras) || 0,
          tipoTrabajo: form.maqTrabajo.trim(),
        };
        payload.operadorAsignado = form.maqOperador.trim();
      }
      if (form.clienteId) {
        payload.clienteId = form.clienteId;
      }
      if (editando) {
        await updateRenta(editando.id, {
          ...(payload as object),
          estado: editando.estado,
          clienteId: form.clienteId || null,
        } as never);
        toast('Renta actualizada correctamente');
      } else {
        await createRenta(payload as never);
        toast('Reservación creada correctamente');
      }
      cerrarModal();
      cargar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      setErrorForm(msg);
      toast(msg, 'error');
    } finally {
      setEnviando(false);
    }
  };

  const eliminarRenta = async (id: string) => {
    if (!confirm('¿Eliminar esta renta?')) return;
    try {
      await deleteRenta(id);
      toast('Renta eliminada');
      cargar();
      cerrarModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al eliminar';
      setErrorForm(msg);
      toast(msg, 'error');
    }
  };

  const anteriorMes = () => {
    if (mes === 1) {
      setMes(12);
      setAno((a) => a - 1);
    } else setMes((m) => m - 1);
  };
  const siguienteMes = () => {
    if (mes === 12) {
      setMes(1);
      setAno((a) => a + 1);
    } else setMes((m) => m + 1);
  };

  const semanas = obtenerSemanasDelMes(ano, mes);
  const nombreMes = new Date(ano, mes - 1).toLocaleString('es-MX', { month: 'long', year: 'numeric' });

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gestión de Rentas</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Calendario de reservaciones, contratos automáticos y control de depósitos en garantía
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={abrirNueva}>
          + Nueva reservación
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-skyline-border bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Calendario de reservaciones</h2>
          {loading ? (
            <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-skyline-border bg-skyline-bg">
              <span className="text-sm text-gray-500">Cargando...</span>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-skyline-border">
              <div className="flex items-center justify-between border-b border-skyline-border bg-skyline-bg px-4 py-2">
                <button
                  type="button"
                  onClick={anteriorMes}
                  className="rounded p-1.5 text-gray-600 hover:bg-gray-200"
                  aria-label="Mes anterior"
                >
                  ←
                </button>
                <span className="font-medium capitalize text-gray-900">{nombreMes}</span>
                <button
                  type="button"
                  onClick={siguienteMes}
                  className="rounded p-1.5 text-gray-600 hover:bg-gray-200"
                  aria-label="Mes siguiente"
                >
                  →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] table-fixed">
                  <thead>
                    <tr className="border-b border-skyline-border bg-gray-50">
                      {DIAS_SEMANA.map((d) => (
                        <th
                          key={d}
                          className="border-r border-skyline-border py-2 text-center text-xs font-medium text-gray-600 last:border-r-0"
                        >
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {semanas.map((semana, i) => (
                      <tr key={i} className="border-b border-skyline-border last:border-0">
                        {semana.map((dia, j) => {
                          const hoy = new Date();
                          const esHoy =
                            dia !== null &&
                            hoy.getDate() === dia &&
                            hoy.getMonth() + 1 === mes &&
                            hoy.getFullYear() === ano;
                          const rentasDelDia =
                            dia !== null
                              ? calendario.filter((r) => rentaIncluyeDia(r, ano, mes, dia))
                              : [];
                          return (
                            <td
                              key={j}
                              className={`h-20 border-r border-skyline-border p-1 align-top text-sm last:border-r-0 ${
                                dia === null ? 'bg-gray-50' : ''
                              } ${esHoy ? 'bg-sky-50' : ''}`}
                            >
                              {dia !== null && (
                                <>
                                  <span
                                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
                                      esHoy ? 'bg-sky-600 text-white' : 'text-gray-700'
                                    }`}
                                  >
                                    {dia}
                                  </span>
                                  <div className="mt-1 space-y-0.5">
                                    {rentasDelDia.slice(0, 2).map((r) => (
                                      <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => navigate(`/rentas/${r.id}`)}
                                        className={`block w-full truncate rounded px-1 py-0.5 text-left text-xs ${COLOR_POR_TIPO[r.tipoUnidad ?? 'remolque_seco'] ?? ESTADOS[r.estado]?.color ?? 'bg-gray-100'} hover:opacity-90`}
                                        title={`${(r.numeroEconomico ?? '').trim() ? `${(r.numeroEconomico ?? '').trim()} · ` : ''}${r.placas} - ${r.clienteNombre}`}
                                      >
                                        {(r.numeroEconomico ?? '').trim() || r.placas}
                                      </button>
                                    ))}
                                    {rentasDelDia.length > 2 && (
                                      <span className="text-xs text-gray-500">
                                        +{rentasDelDia.length - 2}
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-skyline-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Próximas rentas</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : proximasRentas.length === 0 ? (
            <p className="text-sm text-gray-500">No hay rentas próximas.</p>
          ) : (
            <ul className="space-y-3">
              {proximasRentas.map((r) => (
                <li
                  key={r.id}
                  className="flex cursor-pointer flex-col gap-1 rounded-lg border border-skyline-border p-3 transition hover:bg-skyline-bg"
                  onClick={() => navigate(`/rentas/${r.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">
                      {(r.numeroEconomico ?? '').trim() ? `${(r.numeroEconomico ?? '').trim()} · ${r.placas}` : r.placas}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${COLOR_POR_TIPO[r.tipoUnidad ?? 'remolque_seco'] ?? 'bg-gray-100'}`}>
                      {labelTipoUnidad(r.tipoUnidad)}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">{r.clienteNombre}</span>
                  <span className="text-xs text-gray-500">
                    {formatearFechaCompleta(r.fechaInicio)} → {formatearFechaCompleta(r.fechaFin)}
                  </span>
                  <span className="text-sm font-medium text-sky-600">
                    ${r.monto?.toLocaleString('es-MX') ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-skyline-border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Todas las rentas</h2>
            <p className="text-sm text-gray-500">
              Lista de rentas. Haz clic en una fila para ver el expediente.
            </p>
          </div>
          {!loading && rentas.length > 0 && (
            <div className="flex items-center gap-2 rounded-full border border-skyline-border bg-skyline-bg px-3 py-1 text-xs font-medium text-gray-600">
              <Icon icon="mdi:filter-variant" className="size-4 text-skyline-blue" aria-hidden />
              <span>
                {rentasFiltradas.length === rentas.length ? (
                  <> {rentas.length} rentas </>
                ) : (
                  <>
                    {rentasFiltradas.length} de {rentas.length}
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        {!loading && rentas.length > 0 && (
          <div className="mb-5 rounded-xl border border-skyline-border/90 bg-gradient-to-b from-white via-skyline-bg/40 to-skyline-bg/70 p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-skyline-muted">
                <Icon icon="mdi:tune" className="size-4 text-skyline-blue" aria-hidden />
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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="relative min-w-0 flex-1">
                <label htmlFor="busqueda-rentas" className="sr-only">
                  Buscar rentas
                </label>
                <Icon
                  icon="mdi:magnify"
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400"
                  aria-hidden
                />
                <input
                  id="busqueda-rentas"
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Placas, cliente, teléfono, ubicación, # expediente…"
                  className="input w-full rounded-lg border-skyline-border py-2.5 pl-10 pr-3 shadow-inner shadow-gray-100/80 transition focus:border-skyline-blue focus:ring-skyline-blue/20"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <div className="min-w-[140px] flex-1 sm:flex-initial">
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Estado
                  </label>
                  <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    className="input w-full rounded-lg py-2 text-sm shadow-sm"
                  >
                    <option value="">Todos</option>
                    {Object.entries(ESTADOS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[140px] flex-1 sm:flex-initial">
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Logístico
                  </label>
                  <select
                    value={filtroLogistico}
                    onChange={(e) => setFiltroLogistico(e.target.value)}
                    className="input w-full rounded-lg py-2 text-sm shadow-sm"
                  >
                    <option value="">Todos</option>
                    {ESTADOS_LOG_OPT.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[140px] flex-1 sm:flex-initial">
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Tipo unidad
                  </label>
                  <select
                    value={filtroTipoUnidad}
                    onChange={(e) => setFiltroTipoUnidad(e.target.value)}
                    className="input w-full rounded-lg py-2 text-sm shadow-sm"
                  >
                    <option value="">Todos</option>
                    {TIPOS_UNIDAD_OPCIONES.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : rentas.length === 0 ? (
          <p className="text-sm text-gray-500">No hay rentas registradas.</p>
        ) : rentasFiltradas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-skyline-border bg-skyline-bg/50 py-12 text-center">
            <Icon
              icon="mdi:file-search-outline"
              className="mx-auto mb-3 size-12 text-gray-300"
              aria-hidden
            />
            <p className="font-medium text-gray-700">No hay resultados con estos criterios</p>
            <p className="mt-1 text-sm text-gray-500">Prueba otra búsqueda o restablece los filtros.</p>
            {filtrosActivos && (
              <button type="button" onClick={limpiarFiltros} className="btn btn-outline mt-4 text-sm">
                Limpiar búsqueda y filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-skyline-border/80">
            <table className="w-full text-sm">
              <thead className="border-b border-skyline-border bg-skyline-bg/80">
                <tr className="text-left">
                  <th className="px-3 py-3 font-semibold text-gray-600">Unidad</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">Tipo</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">Cliente</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">Fechas</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">Operador</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">Ubicación</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">Estado</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">Logístico</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">Monto</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-skyline-border bg-white">
                {rentasFiltradas.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer transition hover:bg-skyline-blue/[0.04]"
                    onClick={() => navigate(`/rentas/${r.id}`)}
                  >
                    <td className="px-3 py-2.5 font-medium text-gray-900">
                      {(r.numeroEconomico ?? '').trim() ? (
                        <>
                          <span className="block font-semibold tabular-nums">{(r.numeroEconomico ?? '').trim()}</span>
                          <span className="text-xs font-normal text-gray-600">{r.placas}</span>
                        </>
                      ) : (
                        r.placas
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${COLOR_POR_TIPO[r.tipoUnidad ?? 'remolque_seco'] ?? 'bg-gray-100'}`}>
                        {labelTipoUnidad(r.tipoUnidad)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{r.clienteNombre}</td>
                    <td className="px-3 py-2.5 text-gray-600">
                      {formatearFecha(r.fechaInicio)} - {formatearFecha(r.fechaFin)}
                    </td>
                    <td className="max-w-[100px] truncate px-3 py-2.5 text-gray-600">{r.operadorAsignado || '-'}</td>
                    <td className="max-w-[120px] truncate px-3 py-2.5 text-gray-600" title={r.ubicacionEntrega || ''}>{r.ubicacionEntrega || '-'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${ESTADOS[r.estado]?.color ?? 'bg-gray-100'}`}>
                        {ESTADOS[r.estado]?.label ?? r.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{ESTADOS_LOG_OPT.find((e) => e.v === r.estadoLogistico)?.l ?? r.estadoLogistico ?? '-'}</td>
                    <td className="px-3 py-2.5 font-medium">${(r.monto ?? 0).toLocaleString('es-MX')}</td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(ev) => abrirEditar(r, ev)}
                        className="btn btn-outline btn-sm"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={cerrarModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold">
              {editando ? 'Editar renta' : 'Nueva reservación'}
            </h3>
            {errorForm && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {errorForm}
              </div>
            )}
            <form onSubmit={enviarForm} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Unidad *</label>
                <select
                  value={form.unidadId}
                  onChange={(e) => setForm((f) => ({ ...f, unidadId: e.target.value }))}
                  className="input w-full"
                  required
                >
                  <option value="">Seleccionar unidad</option>
                  {unidades
                    .filter(
                      (u) =>
                        u.estatus === 'Disponible' ||
                        u.id === form.unidadId ||
                        u.id === editando?.unidadId
                    )
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {etiquetaUnidadLista(u)}
                        {u.estatus !== 'Disponible' ? ` (${u.estatus})` : ''}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de servicio</label>
                <select
                  value={form.tipoServicio}
                  onChange={(e) => setForm((f) => ({ ...f, tipoServicio: e.target.value }))}
                  className="input w-full"
                >
                  {TIPOS_SERVICIO_OPT.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ubicación entrega</label>
                <input
                  type="text"
                  value={form.ubicacionEntrega}
                  onChange={(e) => setForm((f) => ({ ...f, ubicacionEntrega: e.target.value }))}
                  className="input w-full"
                  placeholder="Dirección o referencia"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ubicación recolección</label>
                <input
                  type="text"
                  value={form.ubicacionRecoleccion}
                  onChange={(e) => setForm((f) => ({ ...f, ubicacionRecoleccion: e.target.value }))}
                  className="input w-full"
                  placeholder="Dirección o referencia"
                />
              </div>
              <MapPicker
                ubicacionEntrega={form.ubicacionEntrega}
                ubicacionRecoleccion={form.ubicacionRecoleccion}
                onEntregaChange={(v) => setForm((f) => ({ ...f, ubicacionEntrega: v }))}
                onRecoleccionChange={(v) => setForm((f) => ({ ...f, ubicacionRecoleccion: v }))}
                className="mt-2"
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Cliente del catálogo (opcional)
                </label>
                <select
                  value={form.clienteId}
                  onChange={(e) => {
                    const v = e.target.value;
                    const cli = clientes.find((c) => c.id === v);
                    setForm((f) => ({
                      ...f,
                      clienteId: v,
                      clienteNombre: cli
                        ? (cli.nombreComercial || cli.razonSocial || f.clienteNombre).trim() || f.clienteNombre
                        : f.clienteNombre,
                      clienteTelefono: cli ? (cli.telefono || f.clienteTelefono) : f.clienteTelefono,
                      clienteEmail: cli ? (cli.email || f.clienteEmail) : f.clienteEmail,
                    }));
                  }}
                  className="input w-full"
                >
                  <option value="">Sin vínculo — solo datos en esta renta</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.nombreComercial || c.razonSocial || `#${c.id}`).trim()}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Registra primero el expediente en{' '}
                  <button
                    type="button"
                    className="text-skyline-blue underline"
                    onClick={() => {
                      cerrarModal();
                      navigate('/clientes');
                    }}
                  >
                    Clientes
                  </button>{' '}
                  y luego elígelo aquí para mantener documentos y datos alineados.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nombre del cliente *
                </label>
                <input
                  type="text"
                  value={form.clienteNombre}
                  onChange={(e) => setForm((f) => ({ ...f, clienteNombre: e.target.value }))}
                  className="input w-full"
                  placeholder="Nombre completo"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono</label>
                  <input
                    type="tel"
                    value={form.clienteTelefono}
                    onChange={(e) => setForm((f) => ({ ...f, clienteTelefono: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={form.clienteEmail}
                    onChange={(e) => setForm((f) => ({ ...f, clienteEmail: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Fecha inicio *
                  </label>
                  <input
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Fecha fin *</label>
                  <input
                    type="date"
                    value={form.fechaFin}
                    onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                    className="input w-full"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Precio base</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.precioBase || form.monto}
                    onChange={(e) => setForm((f) => ({ ...f, precioBase: e.target.value, monto: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Extras</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.extras}
                    onChange={(e) => setForm((f) => ({ ...f, extras: e.target.value }))}
                    className="input w-full"
                    placeholder="Operador, combustible, etc."
                  />
                </div>
              </div>
              {(form.tipoServicio === 'con_operador' || unidadSeleccionada?.tipoUnidad === 'maquinaria') && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Operador asignado</label>
                  <input
                    type="text"
                    value={form.operadorAsignado || form.maqOperador}
                    onChange={(e) => setForm((f) => ({ ...f, operadorAsignado: e.target.value, maqOperador: e.target.value }))}
                    className="input w-full"
                    placeholder="Nombre del operador"
                  />
                </div>
              )}
              {esTipoRefrigeradoCatalogo(unidadSeleccionada?.tipoUnidad) && (
                <div className="rounded border border-skyline-border p-3">
                  <h4 className="mb-2 text-sm font-semibold text-gray-700">Datos refrigerado</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Temp °C</label>
                      <input type="number" value={form.refTemp} onChange={(e) => setForm((f) => ({ ...f, refTemp: e.target.value }))} className="input w-full" />
                    </div>
                    <div><label className="text-xs text-gray-500">Combustible inicio %</label><input type="number" min={0} max={100} value={form.refCombI} onChange={(e) => setForm((f) => ({ ...f, refCombI: e.target.value }))} className="input w-full" /></div>
                    <div><label className="text-xs text-gray-500">Combustible fin %</label><input type="number" min={0} max={100} value={form.refCombF} onChange={(e) => setForm((f) => ({ ...f, refCombF: e.target.value }))} className="input w-full" /></div>
                    <div><label className="text-xs text-gray-500">Horas motor inicio</label><input type="number" min={0} value={form.refHorasI} onChange={(e) => setForm((f) => ({ ...f, refHorasI: e.target.value }))} className="input w-full" /></div>
                    <div><label className="text-xs text-gray-500">Horas motor fin</label><input type="number" min={0} value={form.refHorasF} onChange={(e) => setForm((f) => ({ ...f, refHorasF: e.target.value }))} className="input w-full" /></div>
                  </div>
                </div>
              )}
              {unidadSeleccionada?.tipoUnidad === 'maquinaria' && (
                <div className="rounded border border-skyline-border p-3">
                  <h4 className="mb-2 text-sm font-semibold text-gray-700">Datos mulita</h4>
                  <div className="space-y-2">
                    <div><label className="text-xs text-gray-500">Horas trabajadas</label><input type="number" min={0} step={0.5} value={form.maqHoras} onChange={(e) => setForm((f) => ({ ...f, maqHoras: e.target.value }))} className="input w-full" /></div>
                    <div><label className="text-xs text-gray-500">Tipo de trabajo</label><input type="text" value={form.maqTrabajo} onChange={(e) => setForm((f) => ({ ...f, maqTrabajo: e.target.value }))} className="input w-full" placeholder="Construcción, demolición, etc." /></div>
                  </div>
                </div>
              )}
              {editando && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Estado</label>
                  <select
                    value={editando.estado}
                    onChange={(e) =>
                      setEditando((ed) =>
                        ed ? { ...ed, estado: e.target.value as RentaRow['estado'] } : null
                      )
                    }
                    className="input w-full"
                  >
                    {Object.entries(ESTADOS).map(([val, { label }]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              )}
              {editando && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Estado logístico</label>
                  <select
                    value={form.estadoLogistico}
                    onChange={(e) => setForm((f) => ({ ...f, estadoLogistico: e.target.value }))}
                    className="input w-full"
                  >
                    {ESTADOS_LOG_OPT.map((o) => (
                      <option key={o.v} value={o.v}>{o.l}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Monto total</label>
                  <input
                    type="text"
                    value={(parseFloat(form.precioBase || form.monto || '0') || 0) + (parseFloat(form.extras || '0') || 0)}
                    readOnly
                    className="input w-full bg-gray-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Depósito</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.deposito}
                    onChange={(e) => setForm((f) => ({ ...f, deposito: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones</label>
                <textarea
                  value={form.observaciones}
                  onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                  className="input w-full"
                  rows={2}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                {editando && (
                  <button
                    type="button"
                    onClick={() => eliminarRenta(editando.id)}
                    className="btn btn-outline-danger"
                  >
                    Eliminar
                  </button>
                )}
                <button type="button" onClick={cerrarModal} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={enviando}>
                  {enviando ? 'Guardando...' : editando ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
