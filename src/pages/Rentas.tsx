import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useNotification } from '../context/NotificationContext';
import {
  getRentas,
  getRentasCalendario,
  getUnidades,
  getClientes,
  getUsuariosCatalogoOperadores,
  createRenta,
  updateRenta,
  deleteRenta,
  type RentaRow,
  type RentaCalendario,
  type UnidadRow,
  type ClienteListRow,
  type UsuarioOperadorCatalogoRow,
} from '../api/client';
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
  CrudActionGroup,
  CrudActionIconButton,
  CrudTableTh,
  crudTableRowClass,
} from '../components/crud/crudCorporativo';
import { MapPicker } from '../components/MapPicker';
import { etiquetaUnidadLista } from '../lib/unidadDisplay';
import {
  TIPOS_UNIDAD_OPCIONES,
  esTipoRefrigeradoCatalogo,
  labelTipoUnidad,
} from '../lib/tipoUnidadCatalogo';
import { notifyRentasListChanged } from '../lib/rentasListSync';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_SEMANA_COMPLETO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
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

/** Días desde hoy hasta la fecha (solo fecha local). */
function diasDesdeHoy(iso: string): number {
  const d = new Date(`${iso}T12:00:00`);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

function etiquetaPlazoInicio(fechaInicio: string): { texto: string; clase: string } {
  const d = diasDesdeHoy(fechaInicio);
  if (d === 0) return { texto: 'Inicio hoy', clase: 'bg-sky-600 text-white' };
  if (d === 1) return { texto: 'Mañana', clase: 'bg-sky-500/90 text-white' };
  if (d <= 7) return { texto: `En ${d} días`, clase: 'bg-amber-100 text-amber-900' };
  return { texto: `En ${d} días`, clase: 'bg-slate-100 text-slate-700' };
}

function etiquetaPlazoFinContrato(fechaFin: string): { texto: string; clase: string } {
  const d = diasDesdeHoy(fechaFin);
  if (d < 0) return { texto: 'Fin vencido', clase: 'bg-red-100 text-red-800' };
  if (d === 0) return { texto: 'Termina hoy', clase: 'bg-amber-500 text-white' };
  if (d === 1) return { texto: '1 día restante', clase: 'bg-amber-100 text-amber-900' };
  if (d <= 7) return { texto: `${d} días restantes`, clase: 'bg-emerald-100 text-emerald-900' };
  return { texto: `${d} días restantes`, clase: 'bg-slate-100 text-slate-600' };
}

function operadorIdDesdeNombre(catalog: UsuarioOperadorCatalogoRow[], nombre: string): string {
  const t = nombre.trim();
  if (!t) return '';
  const lo = t.toLowerCase();
  const op = catalog.find((o) => o.nombre.trim().toLowerCase() === lo);
  return op?.id ?? '';
}

function operadorNombreParaGuardar(
  form: { operadorUsuarioId: string; operadorAsignado: string },
  catalog: UsuarioOperadorCatalogoRow[],
): string {
  if (form.operadorUsuarioId) {
    return (catalog.find((o) => o.id === form.operadorUsuarioId)?.nombre || '').trim();
  }
  return (form.operadorAsignado || '').trim();
}

/** Nombre / contacto que se guardan en la renta al vincular un cliente del catálogo. */
function datosClienteParaRenta(cli: ClienteListRow) {
  const clienteNombre =
    (cli.nombreComercial || cli.razonSocial || '').trim() || `Cliente #${cli.id}`;
  return {
    clienteNombre,
    clienteTelefono: (cli.telefono || '').trim(),
    clienteEmail: (cli.email || '').trim(),
  };
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

function ymdISO(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function ultimoDiaDelMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/** Recorte del contrato al mes del calendario (límites de “periodo mensual” natural). */
function periodoFacturacionEnMes(
  r: RentaCalendario,
  ano: number,
  mes: number,
): { inicio: string; fin: string } | null {
  const primerDiaMes = ymdISO(ano, mes, 1);
  const ultimoDiaMes = ymdISO(ano, mes, ultimoDiaDelMes(ano, mes));
  const periodoInicio = r.fechaInicio > primerDiaMes ? r.fechaInicio : primerDiaMes;
  const periodoFin = r.fechaFin < ultimoDiaMes ? r.fechaFin : ultimoDiaMes;
  if (periodoInicio > periodoFin) return null;
  return { inicio: periodoInicio, fin: periodoFin };
}

/**
 * El calendario muestra la renta solo en el primer y último día facturable de ese mes dentro
 * del contrato (no en cada día intermedio).
 */
function rentaIncluyeDia(r: RentaCalendario, ano: number, mes: number, dia: number): boolean {
  const dStr = ymdISO(ano, mes, dia);
  const p = periodoFacturacionEnMes(r, ano, mes);
  if (!p) return false;
  return dStr === p.inicio || dStr === p.fin;
}

function etiquetaAnclaCalendario(r: RentaCalendario, ano: number, mes: number, dia: number): string {
  const dStr = ymdISO(ano, mes, dia);
  const p = periodoFacturacionEnMes(r, ano, mes);
  if (!p) return '';
  if (p.inicio === p.fin) return 'Inicio y fin de periodo (este día)';
  if (dStr === p.inicio) return 'Inicio de periodo mensual en el contrato';
  return 'Fin de periodo mensual en el contrato';
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
  const [operadoresCatalogo, setOperadoresCatalogo] = useState<UsuarioOperadorCatalogoRow[]>([]);
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
    operadorUsuarioId: '',
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
      const [r, c, u, cl, op] = await Promise.all([
        getRentas(),
        getRentasCalendario(ano, mes),
        getUnidades(),
        getClientes(),
        getUsuariosCatalogoOperadores().catch(() => [] as UsuarioOperadorCatalogoRow[]),
      ]);
      setRentas(r);
      setCalendario(c);
      setUnidades(u);
      setClientes(cl);
      setOperadoresCatalogo(op);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [ano, mes]);

  const proximasRentas = useMemo(() => {
    const hoy = hoyStr();
    const enCurso = rentas
      .filter((r) => r.estado === 'activa' && r.fechaInicio <= hoy && r.fechaFin >= hoy)
      .sort((a, b) => a.fechaFin.localeCompare(b.fechaFin));
    const idsCurso = new Set(enCurso.map((r) => r.id));
    const proximasInicio = rentas
      .filter(
        (r) =>
          r.fechaInicio >= hoy &&
          !['finalizada', 'cancelada'].includes(r.estado) &&
          !idsCurso.has(r.id),
      )
      .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
    return [...enCurso, ...proximasInicio];
  }, [rentas]);

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
      operadorUsuarioId: '',
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
      operadorUsuarioId: operadorIdDesdeNombre(
        operadoresCatalogo,
        r.maquinaria?.operadorAsignado ?? r.operadorAsignado ?? '',
      ),
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
  const clienteCatalogoRow = form.clienteId
    ? clientes.find((c) => c.id === form.clienteId)
    : undefined;
  const rentaUsaClienteCatalogo = Boolean(form.clienteId && clienteCatalogoRow);

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditando(null);
  };

  const enviarForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null);
    let clienteNombre = form.clienteNombre.trim();
    let clienteTelefono = form.clienteTelefono.trim();
    let clienteEmail = form.clienteEmail.trim();
    if (form.clienteId && clienteCatalogoRow) {
      const d = datosClienteParaRenta(clienteCatalogoRow);
      clienteNombre = d.clienteNombre;
      clienteTelefono = d.clienteTelefono;
      clienteEmail = d.clienteEmail;
    }

    if (!form.unidadId || !clienteNombre || !form.fechaInicio || !form.fechaFin) {
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
      const operadorNombre = operadorNombreParaGuardar(form, operadoresCatalogo);
      const payload: Record<string, unknown> = {
        unidadId: form.unidadId,
        clienteNombre,
        clienteTelefono,
        clienteEmail,
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
        operadorAsignado: operadorNombre,
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
          operadorAsignado: operadorNombre,
          horasTrabajadas: parseFloat(form.maqHoras) || 0,
          tipoTrabajo: form.maqTrabajo.trim(),
        };
        payload.operadorAsignado = operadorNombre;
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
      notifyRentasListChanged();
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
      notifyRentasListChanged();
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
  const ahoraCal = new Date();
  const calendarioEsMesActual =
    ahoraCal.getFullYear() === ano && ahoraCal.getMonth() + 1 === mes;
  const irAMesActual = () => {
    const n = new Date();
    setAno(n.getFullYear());
    setMes(n.getMonth() + 1);
  };

  return (
    <div>
      <header className={CRUD_HEADER_ROW}>
        <div>
          <h1 className={CRUD_PAGE_TITLE}>Gestión de Rentas</h1>
          <p className={CRUD_PAGE_SUBTITLE}>
            Calendario de reservaciones, contratos automáticos y control de depósitos en garantía
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={abrirNueva}>
          + Nueva reservación
        </button>
      </header>

      {error && <div className={CRUD_ERROR_BANNER}>{error}</div>}

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-skyline-border bg-white shadow-sm ring-1 ring-slate-900/[0.03] lg:col-span-2">
          <div className="border-b border-skyline-border/80 bg-skyline-blue/[0.06] px-4 py-3">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-skyline-blue/15 text-skyline-blue">
                  <Icon icon="mdi:calendar-month" className="size-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-tight text-[#162036]">Calendario de reservaciones</h2>
                  <p className="mt-0.5 text-xs leading-snug text-slate-600">
                    El calendario marca cada renta solo en los <strong className="font-semibold text-slate-700">límites de cada mes</strong> del contrato: el primer y último día facturable de ese mes natural (dentro de la vigencia). Los días intermedios no se repiten, para contratos largos no llena todo el mes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4">
            {loading ? (
              <div
                className="space-y-2 rounded-lg border border-dashed border-skyline-border bg-slate-50/80 p-3"
                aria-busy="true"
                aria-label="Cargando calendario"
              >
                <div className="h-10 animate-pulse rounded-md bg-slate-200/90" />
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="h-[4.5rem] animate-pulse rounded-md bg-slate-100" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-skyline-border shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-skyline-border bg-gradient-to-r from-slate-50 to-skyline-bg px-3 py-2 sm:px-4">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={anteriorMes}
                      className="rounded-lg p-2 text-slate-600 transition hover:bg-white hover:text-skyline-blue hover:shadow-sm"
                      aria-label="Mes anterior"
                    >
                      <Icon icon="mdi:chevron-left" className="size-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={siguienteMes}
                      className="rounded-lg p-2 text-slate-600 transition hover:bg-white hover:text-skyline-blue hover:shadow-sm"
                      aria-label="Mes siguiente"
                    >
                      <Icon icon="mdi:chevron-right" className="size-5" aria-hidden />
                    </button>
                  </div>
                  <span className="order-first w-full text-center text-sm font-semibold capitalize text-[#162036] sm:order-none sm:w-auto sm:flex-1">
                    {nombreMes}
                  </span>
                  <button
                    type="button"
                    onClick={irAMesActual}
                    disabled={calendarioEsMesActual}
                    className="rounded-lg border border-skyline-border/80 bg-white px-3 py-1.5 text-xs font-medium text-skyline-blue shadow-sm transition hover:bg-skyline-bg disabled:cursor-default disabled:opacity-45 disabled:hover:bg-white"
                    title={calendarioEsMesActual ? 'Ya estás viendo el mes en curso' : 'Ir al mes que incluye hoy'}
                  >
                    Mes actual
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] table-fixed">
                    <thead>
                      <tr className="border-b border-skyline-border bg-slate-50/90">
                        {DIAS_SEMANA.map((d, idx) => (
                          <th
                            key={d}
                            title={DIAS_SEMANA_COMPLETO[idx]}
                            scope="col"
                            className="border-r border-skyline-border py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 last:border-r-0"
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
                                className={`h-[5.25rem] border-r border-skyline-border p-1 align-top text-sm last:border-r-0 ${
                                  dia === null ? 'bg-slate-100/80' : 'bg-white'
                                } ${esHoy ? 'bg-sky-50/90 ring-inset ring-1 ring-sky-200' : ''}`}
                              >
                                {dia !== null && (
                                  <>
                                    <span
                                      className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-xs font-semibold ${
                                        esHoy ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-700'
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
                                          className={`block w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-medium leading-tight shadow-sm transition hover:brightness-95 ${COLOR_POR_TIPO[r.tipoUnidad ?? 'remolque_seco'] ?? ESTADOS[r.estado]?.color ?? 'bg-gray-100'} `}
                                          title={`${etiquetaAnclaCalendario(r, ano, mes, dia!)} · Abrir expediente · ${(r.numeroEconomico ?? '').trim() ? `${(r.numeroEconomico ?? '').trim()} · ` : ''}${r.placas} — ${r.clienteNombre}`}
                                        >
                                          {(r.numeroEconomico ?? '').trim() || r.placas}
                                        </button>
                                      ))}
                                      {rentasDelDia.length > 2 && (
                                        <span
                                          className="block pl-0.5 text-[10px] font-medium text-slate-500"
                                          title={`${rentasDelDia.length - 2} renta(s) más este día`}
                                        >
                                          +{rentasDelDia.length - 2} más
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

            <div className="mt-4 rounded-xl border border-skyline-border/90 bg-gradient-to-br from-slate-50/95 via-white to-skyline-bg/40 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Colores por tipo de unidad (mismo catálogo que en unidades)
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {TIPOS_UNIDAD_OPCIONES.map(({ v }) => (
                  <span
                    key={v}
                    className={`rounded-md px-2 py-1 text-[10px] font-medium shadow-sm ${COLOR_POR_TIPO[v] ?? 'bg-gray-100'}`}
                  >
                    {labelTipoUnidad(v)}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Estados de la renta (referencia)</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(['reservada', 'activa', 'finalizada', 'cancelada'] as const).map((k) => (
                  <span
                    key={k}
                    className={`rounded-md px-2 py-1 text-[10px] font-medium shadow-sm ${ESTADOS[k]?.color ?? 'bg-gray-100'}`}
                  >
                    {ESTADOS[k]?.label ?? k}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col rounded-xl border border-skyline-border bg-gradient-to-b from-white to-slate-50/80 p-0 shadow-sm ring-1 ring-slate-900/[0.03]">
          <div className="border-b border-skyline-border/80 bg-skyline-blue/[0.06] px-4 py-3">
            <div className="flex items-start gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-skyline-blue/15 text-skyline-blue">
                <Icon icon="mdi:calendar-star" className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold leading-tight text-[#162036]">Próximas rentas</h2>
                <p className="mt-0.5 text-xs leading-snug text-slate-600">
                  Contratos en curso y los próximos inicios (hoy o futuros). La lista se puede desplazar si hay muchas.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col px-3 pb-3 pt-3">
            {loading ? (
              <ul className="space-y-2.5" aria-busy="true">
                {[1, 2, 3].map((i) => (
                  <li key={i} className="animate-pulse rounded-lg border border-skyline-border/60 bg-white p-3">
                    <div className="mb-2 h-3 w-2/3 rounded bg-slate-200" />
                    <div className="mb-2 h-2.5 w-full rounded bg-slate-100" />
                    <div className="h-2.5 w-1/2 rounded bg-slate-100" />
                  </li>
                ))}
              </ul>
            ) : proximasRentas.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-skyline-border bg-white/60 px-4 py-10 text-center">
                <Icon icon="mdi:calendar-blank-outline" className="mb-2 size-10 text-slate-300" aria-hidden />
                <p className="text-sm font-medium text-slate-700">Sin rentas en curso ni próximos inicios</p>
                <p className="mt-1 max-w-[14rem] text-xs text-slate-500">
                  Las activas en el periodo actual y las reservadas con inicio a partir de hoy aparecerán aquí.
                </p>
              </div>
            ) : (
              <ul className="max-h-[min(70vh,36rem)] space-y-2.5 overflow-y-auto pr-0.5 [scrollbar-color:rgba(148,163,184,0.5)_transparent]">
                {(() => {
                  const hoy = hoyStr();
                  return proximasRentas.map((r) => {
                    const esEnCurso = r.estado === 'activa' && r.fechaInicio <= hoy && r.fechaFin >= hoy;
                    const plazo = esEnCurso ? etiquetaPlazoFinContrato(r.fechaFin) : etiquetaPlazoInicio(r.fechaInicio);
                    const borde = esEnCurso
                      ? 'border-l-emerald-500 bg-emerald-50/35 hover:bg-emerald-50/55'
                      : plazo.texto.includes('Hoy') || plazo.texto === 'Mañana'
                        ? 'border-l-sky-500 bg-sky-50/40 hover:bg-sky-50/70'
                        : 'border-l-slate-300 bg-white hover:bg-slate-50/90';
                    const logLabel =
                      ESTADOS_LOG_OPT.find((o) => o.v === r.estadoLogistico)?.l ?? r.estadoLogistico ?? '—';
                    return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/rentas/${r.id}`)}
                        className={`flex w-full flex-col gap-2 rounded-lg border border-skyline-border/80 p-3 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyline-blue/35 ${borde} border-l-4`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="block truncate font-semibold text-[#162036]">
                              {(r.numeroEconomico ?? '').trim()
                                ? `${(r.numeroEconomico ?? '').trim()} · ${r.placas}`
                                : r.placas}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-slate-600">#{r.id} · {r.clienteNombre}</span>
                          </div>
                          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${plazo.clase}`}>
                            {esEnCurso ? 'En curso' : 'Próximo'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ESTADOS[r.estado]?.color ?? 'bg-gray-100'}`}>
                            {ESTADOS[r.estado]?.label ?? r.estado}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] ${COLOR_POR_TIPO[r.tipoUnidad ?? 'remolque_seco'] ?? 'bg-gray-100'}`}>
                            {labelTipoUnidad(r.tipoUnidad)}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600" title="Estado logístico">
                            {logLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-slate-200/80 pt-2">
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${plazo.clase}`}>{plazo.texto}</span>
                          <span className="truncate text-[11px] text-slate-500">
                            {formatearFechaCompleta(r.fechaInicio)} → {formatearFechaCompleta(r.fechaFin)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold tabular-nums text-skyline-blue">
                            ${(r.monto ?? 0).toLocaleString('es-MX')}
                          </span>
                          <span className="flex items-center gap-0.5 text-xs font-medium text-skyline-blue/90">
                            Expediente
                            <Icon icon="mdi:chevron-right" className="size-4" aria-hidden />
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                  });
                })()}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
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
          <div className={`${CRUD_TOOLBAR} mb-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
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
            <label htmlFor="busqueda-rentas" className="mt-3 block min-w-0 flex-1 lg:max-w-xl">
              <span className={CRUD_SEARCH_LABEL}>Buscar</span>
              <div className={CRUD_SEARCH_INNER}>
                <Icon icon="mdi:magnify" className="size-4 shrink-0 text-skyline-muted" aria-hidden />
                <input
                  id="busqueda-rentas"
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Placas, cliente, teléfono, ubicación, # expediente…"
                  className={CRUD_SEARCH_INPUT}
                  autoComplete="off"
                />
              </div>
            </label>
            <div className={`${CRUD_FILTER_GRID} mt-2`}>
              <label className={`block ${CRUD_SEARCH_LABEL}`}>
                Estado
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className={CRUD_SELECT}
                >
                  <option value="">Todos</option>
                  {Object.entries(ESTADOS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`block ${CRUD_SEARCH_LABEL}`}>
                Logístico
                <select
                  value={filtroLogistico}
                  onChange={(e) => setFiltroLogistico(e.target.value)}
                  className={CRUD_SELECT}
                >
                  <option value="">Todos</option>
                  {ESTADOS_LOG_OPT.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`block ${CRUD_SEARCH_LABEL}`}>
                Tipo unidad
                <select
                  value={filtroTipoUnidad}
                  onChange={(e) => setFiltroTipoUnidad(e.target.value)}
                  className={CRUD_SELECT}
                >
                  <option value="">Todos</option>
                  {TIPOS_UNIDAD_OPCIONES.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        {loading ? (
          <div className={CRUD_SPINNER_WRAP}>
            <div className={CRUD_SPINNER} />
          </div>
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
          <div className={CRUD_TABLE_OUTER}>
            <table className={`${CRUD_TABLE} min-w-[980px]`}>
              <thead>
                <tr className={CRUD_THEAD_TR}>
                  <CrudTableTh className="min-w-[6rem] px-2 py-3.5 text-left align-middle" icon="mdi:truck-outline" align="start">
                    Unidad
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[5rem] px-2 py-3.5 text-left align-middle" icon="mdi:shape-outline" align="start">
                    Tipo
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[7rem] px-2 py-3.5 text-left align-middle" icon="mdi:account-outline" align="start">
                    Cliente
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[6rem] px-2 py-3.5 text-left align-middle" icon="mdi:calendar-range" align="start">
                    Fechas
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[5rem] px-2 py-3.5 text-left align-middle" icon="mdi:account-hard-hat-outline" align="start">
                    Operador
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[6rem] px-2 py-3.5 text-left align-middle" icon="mdi:map-marker-outline" align="start">
                    Ubicación
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[5rem] px-2 py-3.5 text-left align-middle" icon="mdi:bookmark-check-outline" align="start">
                    Estado
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[5rem] px-2 py-3.5 text-left align-middle" icon="mdi:truck-delivery-outline" align="start">
                    Logístico
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[4.5rem] px-2 py-3.5 text-left align-middle" icon="mdi:cash-multiple" align="start">
                    Monto
                  </CrudTableTh>
                  <CrudTableTh className="w-[1%] whitespace-nowrap px-2 py-3.5 text-center align-middle" icon="mdi:cog-outline" align="center">
                    Acciones
                  </CrudTableTh>
                </tr>
              </thead>
              <tbody className={CRUD_TBODY}>
                {rentasFiltradas.map((r, rowIdx) => (
                  <tr
                    key={r.id}
                    className={crudTableRowClass(rowIdx, { clickable: true })}
                    onClick={() => navigate(`/rentas/${r.id}`)}
                  >
                    <td className="px-3 py-2.5 align-middle">
                      {(r.numeroEconomico ?? '').trim() ? (
                        <>
                          <span className={`block ${CRUD_CELDA_PRIMARIO_LEFT}`}>{(r.numeroEconomico ?? '').trim()}</span>
                          <span className={`text-xs ${CRUD_CELDA_SEC_LEFT} text-slate-600`}>{r.placas}</span>
                        </>
                      ) : (
                        <span className={CRUD_CELDA_SEC_LEFT}>{r.placas}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${COLOR_POR_TIPO[r.tipoUnidad ?? 'remolque_seco'] ?? 'bg-gray-100'}`}>
                        {labelTipoUnidad(r.tipoUnidad)}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 align-middle ${CRUD_CELDA_SEC_LEFT}`}>{r.clienteNombre}</td>
                    <td className={`px-3 py-2.5 align-middle ${CRUD_CELDA_SEC_LEFT} text-slate-600`}>
                      {formatearFecha(r.fechaInicio)} - {formatearFecha(r.fechaFin)}
                    </td>
                    <td className={`max-w-[100px] truncate px-3 py-2.5 align-middle ${CRUD_CELDA_SEC_LEFT} text-slate-600`}>{r.operadorAsignado || '-'}</td>
                    <td className={`max-w-[120px] truncate px-3 py-2.5 align-middle ${CRUD_CELDA_SEC_LEFT} text-slate-600`} title={r.ubicacionEntrega || ''}>{r.ubicacionEntrega || '-'}</td>
                    <td className="px-3 py-2.5 align-middle">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${ESTADOS[r.estado]?.color ?? 'bg-gray-100'}`}>
                        {ESTADOS[r.estado]?.label ?? r.estado}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 align-middle text-xs ${CRUD_CELDA_SEC_LEFT} text-slate-600`}>{ESTADOS_LOG_OPT.find((e) => e.v === r.estadoLogistico)?.l ?? r.estadoLogistico ?? '-'}</td>
                    <td className={`px-3 py-2.5 align-middle font-semibold tabular-nums ${CRUD_CELDA_SEC_LEFT}`}>${(r.monto ?? 0).toLocaleString('es-MX')}</td>
                    <td className="px-3 py-2.5 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                      <CrudActionGroup aria-label="Acciones de la renta">
                        <CrudActionIconButton icon="mdi:pencil-outline" title="Editar renta" onClick={(ev) => abrirEditar(r, ev)} />
                      </CrudActionGroup>
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
                <label className="mb-1 block text-sm font-medium text-gray-700">Cliente</label>
                <select
                  value={form.clienteId}
                  onChange={(e) => {
                    const v = e.target.value;
                    const cli = clientes.find((c) => c.id === v);
                    setForm((f) => {
                      if (!cli) {
                        return { ...f, clienteId: v };
                      }
                      return { ...f, clienteId: v, ...datosClienteParaRenta(cli) };
                    });
                  }}
                  className="input w-full"
                >
                  <option value="">Sin catálogo — capturar nombre y contacto abajo</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.nombreComercial || c.razonSocial || `#${c.id}`).trim()}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Con cliente del catálogo no hace falta repetir datos: se toman del expediente en{' '}
                  <button
                    type="button"
                    className="text-skyline-blue underline"
                    onClick={() => {
                      cerrarModal();
                      navigate('/clientes');
                    }}
                  >
                    Clientes
                  </button>
                  .
                </p>
              </div>
              {rentaUsaClienteCatalogo ? (
                <div className="rounded-lg border border-skyline-border bg-slate-50/90 p-3 text-sm">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Datos del catálogo (en esta renta)
                  </p>
                  <dl className="space-y-2 text-slate-800">
                    <div>
                      <dt className="text-xs text-slate-500">Nombre comercial / uso en operación</dt>
                      <dd className="font-semibold">
                        {(clienteCatalogoRow!.nombreComercial || '—').trim() || '—'}
                      </dd>
                    </div>
                    {(clienteCatalogoRow!.razonSocial || '').trim() ? (
                      <div>
                        <dt className="text-xs text-slate-500">Razón social / nombre fiscal</dt>
                        <dd>{(clienteCatalogoRow!.razonSocial || '').trim()}</dd>
                      </div>
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-slate-500">Teléfono</dt>
                        <dd className="font-medium">{datosClienteParaRenta(clienteCatalogoRow!).clienteTelefono || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Email</dt>
                        <dd className="font-medium break-all">
                          {datosClienteParaRenta(clienteCatalogoRow!).clienteEmail || '—'}
                        </dd>
                      </div>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-slate-500">
                    Para corregir teléfono o correo, actualiza el cliente en Clientes; al guardar la renta se envían los
                    valores actuales del catálogo.
                  </p>
                </div>
              ) : null}
              {form.clienteId && !clienteCatalogoRow ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  El cliente vinculado ya no está en el catálogo. Completa nombre y contacto abajo o elige otro cliente.
                </div>
              ) : null}
              {!rentaUsaClienteCatalogo ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Nombre del cliente *
                    </label>
                    <input
                      type="text"
                      value={form.clienteNombre}
                      onChange={(e) => setForm((f) => ({ ...f, clienteNombre: e.target.value }))}
                      className="input w-full"
                      placeholder="Nombre o razón social para la renta"
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
                </>
              ) : null}
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
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Operador asignado <span className="font-normal text-gray-500">(usuarios con rol Operador)</span>
                  </label>
                  <select
                    className="input w-full"
                    value={form.operadorUsuarioId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const u = operadoresCatalogo.find((o) => o.id === id);
                      setForm((f) => ({
                        ...f,
                        operadorUsuarioId: id,
                        operadorAsignado: u ? u.nombre : '',
                        maqOperador: u ? u.nombre : '',
                      }));
                    }}
                  >
                    <option value="">Sin operador asignado</option>
                    {operadoresCatalogo.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                  {operadoresCatalogo.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-700">
                      No hay usuarios activos con rol «Operador». Créalos en{' '}
                      <button
                        type="button"
                        className="font-medium text-skyline-blue underline"
                        onClick={() => {
                          cerrarModal();
                          navigate('/usuarios');
                        }}
                      >
                        Usuarios
                      </button>
                      .
                    </p>
                  ) : null}
                  {Boolean((form.operadorAsignado || form.maqOperador).trim()) && !form.operadorUsuarioId ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Valor guardado anteriormente (texto libre): «{form.operadorAsignado || form.maqOperador}». Elige un
                      operador del catálogo para vincularlo o deja «Sin operador» y guarda para limpiar.
                    </p>
                  ) : null}
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
