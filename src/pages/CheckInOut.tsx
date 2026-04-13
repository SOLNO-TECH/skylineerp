import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '@iconify/react';
import {
  CRUD_CELDA_PRIMARIO_LEFT,
  CRUD_CELDA_SEC_LEFT,
  CRUD_FILTER_GRID,
  CRUD_SEARCH_INNER,
  CRUD_SEARCH_INPUT,
  CRUD_SEARCH_LABEL,
  CRUD_SELECT,
  CRUD_TABLE,
  CRUD_TABLE_OUTER,
  CRUD_TBODY,
  CRUD_THEAD_TR,
  CRUD_TOOLBAR,
  CrudActionGroup,
  CrudActionIconButton,
  CrudActionIconLink,
  CrudTableTh,
  crudTableRowClass,
} from '../components/crud/crudCorporativo';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  getUnidades,
  getRentas,
  getCheckinOutRegistros,
  createCheckinOutRegistro,
  updateCheckinOutRegistro,
  deleteCheckinOutRegistro,
  uploadCheckinOutImagen,
  deleteCheckinOutImagen,
  getImagenUrl,
  type UnidadRow,
  type RentaRow,
  type CheckinOutRegistro,
  type ChecklistItemPayload,
  type CheckinOutModalidad,
} from '../api/client';
import {
  MODALIDAD_LABEL,
  CAJA_SECA_SECCIONES,
  MULITA_SECCIONES_HASTA_LLANTAS,
  MULITA_SECCIONES_TRAS_LLANTAS,
  REFRIGERACION_PRUEBA_IDS,
  PLATAFORMA_DANOS_CARROCERIA,
  PLATAFORMA_SECCIONES_REVISION,
  DOLLY_DANOS_GENERALES,
  DOLLY_SECCIONES_REVISION,
  CAMION_TRACTO_DANOS_CARROCERIA,
  CAMION_TRACTO_SECCIONES_REVISION,
  CAJA_REF_ST_DANOS_CARROCERIA,
  CAJA_REF_ST_SECCIONES,
  PICKUP_DANOS_CARROCERIA,
  PICKUP_SECCIONES,
  VEH_EMP_DANOS_CARROCERIA,
  VEH_EMP_SECCIONES,
  defaultInspeccionCompleta,
  mergeInspeccionGuardada,
  defaultModalidadPorTipoUnidad,
  type InspeccionCompleta,
  type Tri,
  type MulitaSeccionDef,
  type PlataformaRevisionKey,
  type DollyRevisionKey,
  type CamionTractoRevisionKey,
  type CajaRefSinTermoRevisionKey,
  type PickupRevisionKey,
  type VehiculoEmpresarialRevisionKey,
} from '../lib/checkinInspeccion';
import { labelTipoUnidad, tipoUnidadSufijoOpcion } from '../lib/tipoUnidadCatalogo';
import { etiquetaUnidadLista } from '../lib/unidadDisplay';

const ROLES_COLABORADOR = [
  { v: '', l: 'Sin especificar' },
  { v: 'cliente', l: 'Cliente' },
  { v: 'operador_skyline', l: 'Operador Skyline' },
  { v: 'transportista', l: 'Transportista / tercero' },
  { v: 'supervisor', l: 'Supervisor' },
  { v: 'otro', l: 'Otro' },
];

const CHECKLIST_DOC_IDS = new Set(['doc_tarjeta', 'doc_fisico', 'doc_movimiento', 'doc_orden_salida']);

/** Documentación entregada / verificada en el movimiento (mismo conjunto en check-in y check-out; el ítem 3 cambia el nombre). */
function buildChecklist(tipo: 'checkin' | 'checkout'): ChecklistItemPayload[] {
  const movimientoLabel =
    tipo === 'checkin' ? 'Documento de check-in' : 'Documento de check-out';
  const items: { id: string; label: string }[] = [
    { id: 'doc_tarjeta', label: 'Tarjeta de circulación' },
    { id: 'doc_fisico', label: 'Verificación físico-mecánica' },
    { id: 'doc_movimiento', label: movimientoLabel },
    { id: 'doc_orden_salida', label: 'Orden de salida' },
  ];
  return items.map((i) => ({ id: i.id, label: i.label, presente: true }));
}

function normalizarChecklistGuardado(
  guardado: ChecklistItemPayload[] | undefined,
  tipo: 'checkin' | 'checkout'
): ChecklistItemPayload[] {
  const base = buildChecklist(tipo);
  if (!guardado?.length) return base;
  const porId = new Map(guardado.map((x) => [x.id, x.presente]));
  if (!guardado.every((x) => CHECKLIST_DOC_IDS.has(x.id))) return base;
  return base.map((b) => ({ ...b, presente: porId.get(b.id) ?? b.presente }));
}

function esArchivoVideo(file: File): boolean {
  if (file.type.startsWith('video/')) return true;
  return /\.(mp4|webm|mov|ogv|ogg)$/i.test(file.name);
}

function esNombreVideo(nombre: string): boolean {
  return /\.(mp4|webm|mov|ogv|ogg)$/i.test(nombre);
}

function EvidenciaMiniatura({
  src,
  nombreMostrar,
  esVideo,
  soloLectura,
  onQuitar,
}: {
  src: string;
  nombreMostrar: string;
  esVideo: boolean;
  soloLectura?: boolean;
  onQuitar?: () => void;
}) {
  return (
    <div className="relative w-28 shrink-0 overflow-hidden rounded-lg border border-skyline-border bg-white shadow-sm">
      {esVideo ? (
        <video
          src={src}
          className="h-24 w-full bg-black object-cover"
          controls
          playsInline
          preload="metadata"
          title={nombreMostrar}
        />
      ) : (
        <img src={src} alt={nombreMostrar} className="h-24 w-full object-cover" />
      )}
      <p className="truncate px-1 py-0.5 text-[10px] text-gray-500" title={nombreMostrar}>
        {nombreMostrar}
      </p>
      {!soloLectura && onQuitar && (
        <button
          type="button"
          className="absolute right-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-red-700 shadow"
          onClick={onQuitar}
        >
          Quitar
        </button>
      )}
    </div>
  );
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

/** Fecha en tabla: primera línea legible, segunda hora */
function fechaRegistroPartes(s: string) {
  if (!s) return { fecha: '', hora: '' };
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return { fecha: s, hora: '' };
  return {
    fecha: d.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
    hora: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
  };
}

const MODALIDAD_BADGE: Record<CheckinOutModalidad, string> = {
  caja_seca: 'border-slate-200/80 bg-slate-100 text-slate-800',
  refrigerado: 'border-sky-200 bg-sky-100 text-sky-950',
  mulita_patio: 'border-amber-200 bg-amber-100 text-amber-950',
  plataforma: 'border-violet-200 bg-violet-100 text-violet-950',
  dolly: 'border-teal-200 bg-teal-100 text-teal-950',
  camion_tracto: 'border-orange-200 bg-orange-100 text-orange-950',
  caja_ref_sin_termo: 'border-cyan-200 bg-cyan-100 text-cyan-950',
  pickup: 'border-lime-200 bg-lime-100 text-lime-950',
  vehiculo_empresarial: 'border-indigo-200 bg-indigo-100 text-indigo-950',
};

const TITULO_BLOQUE_INSPECCION: Record<CheckinOutModalidad, string> = {
  caja_seca: 'Caja seca (hoja SKYLINE): checklist completo, tabla de llantas y daños / croquis',
  refrigerado: 'Refrigerado: unidad de refrigeración, control de temperatura y prueba de funcionamiento',
  mulita_patio: 'Mulita de patio: hoja de inspección (datos generales, quinta rueda, llantas, frenos, prueba operativa)',
  plataforma: 'Plataforma: hoja de inspección (daños de carrocería, revisión general, llantas, rutina y observaciones)',
  dolly: 'Dolly: hoja de inspección (daños generales, revisión, cuatro llantas, rutina y observaciones)',
  camion_tracto: 'Camión / tracto: motor, frenos, suspensión, transmisión, acople, diez llantas, cabina y rutina',
  caja_ref_sin_termo:
    'Caja refrigerada (sin termo): carrocería, paredes, áreas, suspensión, filtraciones, aislamiento y ocho llantas',
  pickup: 'Pickup: carrocería, motor, frenos, transmisión, interior, caja/batea y cinco llantas',
  vehiculo_empresarial: 'Vehículo empresarial: carrocería, mecánica, interior, cajuela, documentación y cinco llantas',
};

function ModalidadPill({ m }: { m: CheckinOutModalidad }) {
  return (
    <span
      className={`inline-flex max-w-[220px] items-center truncate rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${MODALIDAD_BADGE[m]}`}
      title={MODALIDAD_LABEL[m]}
    >
      {MODALIDAD_LABEL[m]}
    </span>
  );
}

function FormSection({
  step,
  title,
  hint,
  icon,
  children,
  className = '',
}: {
  step?: number;
  title: string;
  hint?: string;
  icon?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/[0.04] ${className}`}
    >
      <div className="flex items-start gap-3 border-b border-slate-100/90 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/40 px-4 py-3.5 sm:px-5">
        {step != null ? (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-skyline-blue text-sm font-bold text-white shadow-sm"
            aria-hidden
          >
            {step}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {icon ? <Icon icon={icon} className="size-5 shrink-0 text-skyline-blue" aria-hidden /> : null}
            <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-slate-900">{title}</h3>
          </div>
          {hint ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function textoBusquedaRegistro(r: CheckinOutRegistro): string {
  const tipoTxt =     r.tipo === 'checkin' ? 'check-in checkin entrada recepción' : 'check-out checkout salida entrega';
  const mod = r.modalidad ? MODALIDAD_LABEL[r.modalidad] : '';
  return [
    r.numeroEconomico,
    r.placas,
    r.marca,
    r.modelo,
    mod,
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

/** Daños por zona (hojas plataforma, dolly, camión/tracto): sin marcar o X = parte dañada. */
function DanioXPick({ label, value, onChange }: { label: string; value: Tri; onChange: (v: Tri) => void }) {
  const damaged = value === 'mal';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100/80 py-2.5 last:border-b-0 even:bg-slate-50/40">
      <span className="max-w-[min(100%,280px)] text-sm font-medium leading-snug text-slate-800">{label}</span>
      <div className="flex shrink-0 gap-1" role="group" aria-label={`Daño: ${label}`}>
        <button
          type="button"
          title="Sin marcar"
          onClick={() => onChange('')}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            !damaged
              ? 'border-slate-400 bg-slate-700 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
          }`}
        >
          Sin marcar
        </button>
        <button
          type="button"
          title="Marcar daño (X)"
          onClick={() => onChange('mal')}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            damaged
              ? 'border-rose-600 bg-rose-600 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:text-rose-800'
          }`}
        >
          X daño
        </button>
      </div>
    </div>
  );
}

function TriPick({ label, value, onChange }: { label: string; value: Tri; onChange: (v: Tri) => void }) {
  const opts: { v: Tri; short: string; long: string; title: string }[] = [
    { v: 'ok', short: '✓', long: 'Bien', title: 'Bien (correcto)' },
    { v: 'mal', short: '✗', long: 'Mal', title: 'Mal (requiere atención)' },
    { v: 'na', short: 'N', long: 'N/A', title: 'No aplica' },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100/80 py-2.5 last:border-b-0 even:bg-slate-50/40">
      <span className="max-w-[min(100%,280px)] text-sm font-medium leading-snug text-slate-800">{label}</span>
      <div className="flex shrink-0 gap-1" role="group" aria-label={`Estado: ${label}`}>
        {opts.map(({ v, short, long, title: aria }) => (
          <button
            key={v}
            type="button"
            title={aria}
            onClick={() => onChange(v)}
            className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors sm:min-w-[4.25rem] ${
              value === v
                ? v === 'ok'
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                  : v === 'mal'
                    ? 'border-rose-600 bg-rose-600 text-white shadow-sm'
                    : 'border-slate-500 bg-slate-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{long}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CheckInOut() {
  const { hasRole } = useAuth();
  const { toast } = useNotification();
  const soloLectura =
    hasRole('consulta') &&
    !hasRole('administrador', 'supervisor', 'operador', 'operador_taller');

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
  const [checklist, setChecklist] = useState<ChecklistItemPayload[]>(() => buildChecklist('checkin'));
  const [observaciones, setObservaciones] = useState('');
  const [modalidad, setModalidad] = useState<CheckinOutModalidad>('caja_seca');
  const [inspeccion, setInspeccion] = useState<InspeccionCompleta>(() => defaultInspeccionCompleta());
  const [fotosPendientes, setFotosPendientes] = useState<File[]>([]);

  const registroEditando = useMemo(
    () => (editandoId ? (registros.find((r) => r.id === editandoId) ?? null) : null),
    [editandoId, registros]
  );

  const fotosPendientesUrls = useMemo(
    () => fotosPendientes.map((f) => URL.createObjectURL(f)),
    [fotosPendientes]
  );
  useEffect(() => {
    return () => {
      for (const u of fotosPendientesUrls) URL.revokeObjectURL(u);
    };
  }, [fotosPendientesUrls]);

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
    if (unidadSel && modalTipo) {
      setChecklist(buildChecklist(modalTipo));
      setKilometraje(String(unidadSel.kilometraje ?? ''));
      setCombustiblePct(String(unidadSel.combustiblePct ?? ''));
      setModalidad(defaultModalidadPorTipoUnidad(unidadSel.tipoUnidad));
      const fresh = defaultInspeccionCompleta();
      fresh.header.nEconomico = (unidadSel.numeroEconomico ?? '').trim();
      fresh.header.hojaPlacas = unidadSel.placas || '';
      fresh.header.hojaKm = String(unidadSel.kilometraje ?? '');
      fresh.header.hojaMarca = unidadSel.marca || '';
      if (unidadSel.tipoUnidad === 'camion') {
        fresh.header.hojaModelo = (unidadSel.modelo ?? '').trim();
        fresh.header.hojaAnio = '';
        fresh.header.hojaTipo = '';
      } else if (unidadSel.tipoUnidad === 'pickup' || unidadSel.tipoUnidad === 'vehiculo_empresarial') {
        fresh.header.hojaModelo = (unidadSel.modelo ?? '').trim();
        fresh.header.hojaAnio = '';
        fresh.header.hojaTipo = '';
      } else {
        fresh.header.hojaTipo = labelTipoUnidad(unidadSel.tipoUnidad);
      }
      setInspeccion(fresh);
    }
  }, [unidadSel?.id, unidadSel?.tipoUnidad, editandoId, modalTipo]);

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
    setChecklist(buildChecklist(tipo));
    setKilometraje('');
    setCombustiblePct('');
    setModalidad('caja_seca');
    setInspeccion(defaultInspeccionCompleta());
    setFotosPendientes([]);
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
    setChecklist(normalizarChecklistGuardado(reg.checklist, reg.tipo));
    setModalidad(reg.modalidad ?? 'caja_seca');
    setInspeccion(mergeInspeccionGuardada(reg.inspeccion));
    setFotosPendientes([]);
  }

  async function eliminarRegistro(reg: CheckinOutRegistro, ev: React.MouseEvent) {
    ev.stopPropagation();
    if (soloLectura) return;
    if (
      !confirm(
        `¿Eliminar el ${reg.tipo === 'checkin' ? 'check-in' : 'check-out'} de ${(reg.numeroEconomico ?? '').trim() || reg.placas} (${reg.placas})? Esta acción no se puede deshacer.`
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
        modalidad,
        inspeccion: inspeccion as unknown as Record<string, unknown>,
      };
      let registro: CheckinOutRegistro;
      if (editandoId) {
        registro = await updateCheckinOutRegistro(editandoId, payload);
        toast('Registro actualizado');
      } else {
        registro = await createCheckinOutRegistro(payload);
        toast(modalTipo === 'checkin' ? 'Check-in registrado' : 'Check-out registrado');
      }
      if (fotosPendientes.length > 0) {
        let u = registro;
        for (const file of fotosPendientes) {
          u = await uploadCheckinOutImagen(registro.id, file);
        }
        registro = u;
        toast(`${fotosPendientes.length} foto(s) de evidencia subida(s)`);
      }
      cerrarModal();
      cargar();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al guardar', 'error');
    } finally {
      setEnviando(false);
    }
  }

  function setTriCaja(id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      cajaSeca: { ...prev.cajaSeca, items: { ...prev.cajaSeca.items, [id]: v } },
    }));
  }

  function setTriMulita(id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      mulita: { ...prev.mulita, items: { ...prev.mulita.items, [id]: v } },
    }));
  }

  function setTriRefPrueba(id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      refrigeracion: {
        ...prev.refrigeracion,
        prueba: { ...prev.refrigeracion.prueba, [id]: v },
      },
    }));
  }

  function setTriRefCarroceria(id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      refrigeracion: {
        ...prev.refrigeracion,
        carroceriaRemolque: {
          ...prev.refrigeracion.carroceriaRemolque,
          items: { ...prev.refrigeracion.carroceriaRemolque.items, [id]: v },
        },
      },
    }));
  }

  const renderMulitaSecciones = (secs: MulitaSeccionDef[]) =>
    secs.map((sec) => (
      <div
        key={sec.titulo}
        className={`rounded-lg bg-white p-3 shadow-sm ${
          sec.clave
            ? 'border-2 border-amber-300 ring-1 ring-amber-200/90 lg:col-span-2'
            : 'border border-skyline-border'
        }`}
      >
        {sec.clave && (
          <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-950">
            Clave en mulitas: quinta rueda y acople con el remolque.
          </p>
        )}
        <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-skyline-blue">
          {sec.titulo}
        </p>
        <div className="space-y-0.5 pr-1">
          {sec.items.map((it) => (
            <TriPick
              key={it.id}
              label={it.label}
              value={inspeccion.mulita.items[it.id] ?? ''}
              onChange={(v) => setTriMulita(it.id, v)}
            />
          ))}
        </div>
      </div>
    ));

  async function quitarFotoGuardada(imgId: string) {
    if (!editandoId) return;
    try {
      const u = await deleteCheckinOutImagen(editandoId, imgId);
      toast('Foto eliminada');
      setRegistros((prev) => prev.map((x) => (x.id === u.id ? u : x)));
      abrirEditar(u);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error');
    }
  }

  function patchHeader(patch: Partial<InspeccionCompleta['header']>) {
    setInspeccion((prev) => ({ ...prev, header: { ...prev.header, ...patch } }));
  }

  const tituloBloqueInspeccion = TITULO_BLOQUE_INSPECCION[modalidad];

  function setTriPlataforma(seccion: PlataformaRevisionKey, id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      plataforma: {
        ...prev.plataforma,
        [seccion]: {
          ...(prev.plataforma[seccion] as Record<string, Tri>),
          [id]: v,
        },
      },
    }));
  }

  function setPlataformaDano(id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      plataforma: {
        ...prev.plataforma,
        danosCarroceria: { ...prev.plataforma.danosCarroceria, [id]: v },
      },
    }));
  }

  function setTriDolly(seccion: DollyRevisionKey, id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      dolly: {
        ...prev.dolly,
        [seccion]: {
          ...(prev.dolly[seccion] as Record<string, Tri>),
          [id]: v,
        },
      },
    }));
  }

  function setDollyDano(id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      dolly: {
        ...prev.dolly,
        danosGenerales: { ...prev.dolly.danosGenerales, [id]: v },
      },
    }));
  }

  function setTriCamionTracto(seccion: CamionTractoRevisionKey, id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      camionTracto: {
        ...prev.camionTracto,
        [seccion]: {
          ...(prev.camionTracto[seccion] as Record<string, Tri>),
          [id]: v,
        },
      },
    }));
  }

  function setCamionTractoDanoCarroceria(id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      camionTracto: {
        ...prev.camionTracto,
        danosCarroceria: { ...prev.camionTracto.danosCarroceria, [id]: v },
      },
    }));
  }

  function setTriCajaRefSinTermo(seccion: CajaRefSinTermoRevisionKey, id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      cajaRefSinTermo: {
        ...prev.cajaRefSinTermo,
        [seccion]: {
          ...(prev.cajaRefSinTermo[seccion] as Record<string, Tri>),
          [id]: v,
        },
      },
    }));
  }

  function setCajaRefDanoCarroceria(id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      cajaRefSinTermo: {
        ...prev.cajaRefSinTermo,
        danosCarroceria: { ...prev.cajaRefSinTermo.danosCarroceria, [id]: v },
      },
    }));
  }

  function setTriPickup(seccion: PickupRevisionKey, id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      pickup: {
        ...prev.pickup,
        [seccion]: {
          ...(prev.pickup[seccion] as Record<string, Tri>),
          [id]: v,
        },
      },
    }));
  }

  function setPickupDanoCarroceria(id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      pickup: {
        ...prev.pickup,
        danosCarroceria: { ...prev.pickup.danosCarroceria, [id]: v },
      },
    }));
  }

  function setTriVehEmp(seccion: VehiculoEmpresarialRevisionKey, id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      vehiculoEmpresarial: {
        ...prev.vehiculoEmpresarial,
        [seccion]: {
          ...(prev.vehiculoEmpresarial[seccion] as Record<string, Tri>),
          [id]: v,
        },
      },
    }));
  }

  function setVehEmpDanoCarroceria(id: string, v: Tri) {
    setInspeccion((prev) => ({
      ...prev,
      vehiculoEmpresarial: {
        ...prev.vehiculoEmpresarial,
        danosCarroceria: { ...prev.vehiculoEmpresarial.danosCarroceria, [id]: v },
      },
    }));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 p-5 shadow-sm ring-1 ring-slate-900/[0.04] sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-slate-500">
            <Icon icon="mdi:clipboard-flow-outline" className="size-6 shrink-0 text-skyline-blue" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wider">Operaciones</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Check-in / Check-out</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Registra recepción y entrega de unidades: colaborador, lecturas, hoja de inspección (caja seca,
            refrigerado, mulita, plataforma, dolly, camión/tracto, caja ref. sin termo, pickup o vehículo empresarial),
            evidencia en fotos o video y documentación entregada.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch lg:flex-row">
          <button
            type="button"
            className="btn inline-flex items-center justify-center gap-2 border-2 border-emerald-600 bg-emerald-50 font-semibold text-emerald-900 shadow-sm hover:bg-emerald-100 disabled:opacity-50"
            disabled={soloLectura}
            onClick={() => abrirModal('checkin')}
          >
            <Icon icon="mdi:login" className="size-5" aria-hidden />
            Check-in (recepción)
          </button>
          <button
            type="button"
            className="btn btn-primary inline-flex items-center justify-center gap-2 font-semibold shadow-md"
            disabled={soloLectura}
            onClick={() => abrirModal('checkout')}
          >
            <Icon icon="mdi:logout" className="size-5" aria-hidden />
            Check-out (entrega)
          </button>
        </div>
      </header>

      {soloLectura && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
          <span className="font-semibold">Solo lectura.</span> Tu rol permite consultar registros; no puedes crear ni
          editar check-in / check-out.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Historial de registros</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Cada fila resume movimiento, tipo de hoja, unidad y quién participó. Clic en la fila para abrir el
              detalle.
            </p>
          </div>
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
          <div className={`${CRUD_TOOLBAR} mx-3 mb-0 mt-3 border-0 sm:mx-4`}>
            <label htmlFor="cio-busqueda" className="block min-w-0 flex-1 lg:max-w-md">
              <span className={CRUD_SEARCH_LABEL}>Buscar</span>
              <div className={CRUD_SEARCH_INNER}>
                <Icon icon="mdi:magnify" className="size-4 shrink-0 text-skyline-muted" aria-hidden />
                <input
                  id="cio-busqueda"
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Placas, cliente, colaborador, observaciones…"
                  className={CRUD_SEARCH_INPUT}
                  autoComplete="off"
                />
              </div>
            </label>
            <div className={`${CRUD_FILTER_GRID} mt-2`}>
              <label className={`block ${CRUD_SEARCH_LABEL}`}>
                Movimiento
                <select
                  id="cio-tipo"
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value as '' | 'checkin' | 'checkout')}
                  className={CRUD_SELECT}
                >
                  <option value="">Todos</option>
                  <option value="checkin">Check-in</option>
                  <option value="checkout">Check-out</option>
                </select>
              </label>
              <label className={`block ${CRUD_SEARCH_LABEL}`}>
                Unidad
                <select
                  id="cio-unidad"
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
          <p className="p-10 text-center text-sm font-medium text-slate-500">Cargando registros…</p>
        ) : registros.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-600">
            Aún no hay registros. Usa <span className="font-semibold text-emerald-800">Check-in</span> o{' '}
            <span className="font-semibold text-blue-800">Check-out</span> arriba para el primero.
          </p>
        ) : registrosFiltrados.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-600">
            No hay registros que coincidan. Prueba otro texto de búsqueda o limpia los filtros.
          </p>
        ) : (
          <div className={`${CRUD_TABLE_OUTER} rounded-none border-x-0 border-b-0 shadow-none`}>
            <table className={`${CRUD_TABLE} min-w-[820px] text-left`}>
              <thead>
                <tr className={CRUD_THEAD_TR}>
                  <CrudTableTh className="min-w-[5.5rem] px-2 py-3.5 text-left align-middle" icon="mdi:calendar-clock" align="start">
                    Fecha
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[6rem] px-2 py-3.5 text-left align-middle" icon="mdi:swap-horizontal" align="start">
                    Movimiento
                  </CrudTableTh>
                  <CrudTableTh
                    className="hidden min-w-[7rem] px-2 py-3.5 text-left align-middle md:table-cell"
                    icon="mdi:file-document-outline"
                    align="start"
                  >
                    Hoja
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[7rem] px-2 py-3.5 text-left align-middle" icon="mdi:truck-outline" align="start">
                    Unidad
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[8rem] px-2 py-3.5 text-left align-middle" icon="mdi:briefcase-outline" align="start">
                    Renta / cliente
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[7rem] px-2 py-3.5 text-left align-middle" icon="mdi:account-outline" align="start">
                    Colaborador
                  </CrudTableTh>
                  <CrudTableTh
                    className="hidden min-w-[6rem] px-2 py-3.5 text-left align-middle lg:table-cell"
                    icon="mdi:account-badge-outline"
                    align="start"
                  >
                    Registró
                  </CrudTableTh>
                  <CrudTableTh className="min-w-[6rem] px-2 py-3.5 text-left align-middle" icon="mdi:gauge" align="start">
                    Km / comb.
                  </CrudTableTh>
                  <CrudTableTh className="w-[1%] whitespace-nowrap px-2 py-3.5 text-center align-middle" icon="mdi:cog-outline" align="center">
                    Acciones
                  </CrudTableTh>
                </tr>
              </thead>
              <tbody className={CRUD_TBODY}>
                {registrosFiltrados.map((r, rowIdx) => {
                  const { fecha, hora } = fechaRegistroPartes(r.creadoEn);
                  const nArchivos = r.imagenes?.length ?? 0;
                  const mod = r.modalidad ?? 'caja_seca';
                  return (
                  <tr
                    key={r.id}
                    className={`${crudTableRowClass(rowIdx, { clickable: !soloLectura })} border-l-[3px] ${
                      r.tipo === 'checkin' ? 'border-l-emerald-500' : 'border-l-blue-500'
                    }`}
                    onClick={() => !soloLectura && abrirEditar(r)}
                  >
                    <td className="px-4 py-3 text-slate-700">
                      <span className="block text-[13px] font-semibold leading-tight text-slate-900">{fecha}</span>
                      {hora ? <span className="text-xs text-slate-500">{hora}</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                          r.tipo === 'checkin'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-blue-100 text-blue-900'
                        }`}
                      >
                        <Icon
                          icon={r.tipo === 'checkin' ? 'mdi:login' : 'mdi:logout'}
                          className="size-3.5 shrink-0"
                          aria-hidden
                        />
                        {r.tipo === 'checkin' ? 'Entrada' : 'Salida'}
                      </span>
                    </td>
                    <td className="hidden max-w-[200px] px-4 py-3 md:table-cell">
                      <div className="flex flex-col gap-1.5">
                        <ModalidadPill m={mod} />
                        {nArchivos > 0 ? (
                          <span className="inline-flex w-fit items-center gap-1 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900">
                            <Icon icon="mdi:folder-multimedia-outline" className="size-3" aria-hidden />
                            {nArchivos} archivo{nArchivos !== 1 ? 's' : ''}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      {(r.numeroEconomico ?? '').trim() ? (
                        <>
                          <span className={`block ${CRUD_CELDA_PRIMARIO_LEFT}`}>{(r.numeroEconomico ?? '').trim()}</span>
                          <span className={`mt-0.5 block text-xs ${CRUD_CELDA_SEC_LEFT} text-slate-600`}>
                            {r.placas} · {r.marca} {r.modelo}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className={CRUD_CELDA_PRIMARIO_LEFT}>{r.placas}</span>
                          <span className={`mt-0.5 block text-xs ${CRUD_CELDA_SEC_LEFT} text-slate-600`}>
                            {r.marca} {r.modelo}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="max-w-[180px] px-4 py-3 text-slate-600">
                      {r.rentaCliente ? (
                        <>
                          <span className="block truncate text-sm font-medium text-slate-800" title={r.rentaCliente}>
                            {r.rentaCliente}
                          </span>
                          {r.rentaId && (
                            <div className="mt-1 flex justify-start">
                              <CrudActionIconLink
                                to={`/rentas/${r.rentaId}`}
                                icon="mdi:folder-outline"
                                title="Ver expediente de renta"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="max-w-[160px] px-4 py-3 text-slate-600">
                      <span className="text-sm">{r.colaboradorNombre || '—'}</span>
                      {r.colaboradorRol && (
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {ROLES_COLABORADOR.find((x) => x.v === r.colaboradorRol)?.l ?? r.colaboradorRol}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{r.usuarioNombre || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                      <span className="font-medium">{r.kilometraje != null ? `${r.kilometraje.toLocaleString('es-MX')} km` : '—'}</span>
                      <span className="mx-1 text-slate-300">·</span>
                      <span>{r.combustiblePct != null ? `${r.combustiblePct}% comb.` : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {soloLectura ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <div className="flex flex-wrap justify-center gap-1">
                          <CrudActionGroup aria-label="Acciones del registro">
                            <CrudActionIconButton icon="mdi:pencil-outline" title="Editar registro" onClick={() => abrirEditar(r)} />
                            <CrudActionIconButton
                              icon="mdi:delete-outline"
                              title="Eliminar registro"
                              danger
                              onClick={(e) => eliminarRegistro(r, e)}
                            />
                          </CrudActionGroup>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalTipo && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4 pt-8 backdrop-blur-[2px] sm:pt-10"
          onClick={cerrarModal}
        >
          <div
            className="notif-menu-open mb-10 w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-900/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`px-5 py-5 text-white sm:px-6 sm:py-6 ${
                modalTipo === 'checkin'
                  ? 'bg-gradient-to-br from-emerald-800 via-emerald-600 to-teal-600'
                  : 'bg-gradient-to-br from-blue-800 via-blue-600 to-indigo-700'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner backdrop-blur-sm">
                    <Icon
                      icon={modalTipo === 'checkin' ? 'mdi:login' : 'mdi:logout'}
                      className="size-7 text-white"
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/75">
                      {editandoId ? 'Edición de registro' : 'Nuevo registro'}
                    </p>
                    <h3 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                      {editandoId
                        ? 'Check-in / Check-out'
                        : modalTipo === 'checkin'
                          ? 'Recepción de unidad (check-in)'
                          : 'Entrega de unidad (check-out)'}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/90">
                      {editandoId
                        ? 'Ajusta lo necesario y guarda. El usuario que creó el registro no cambia.'
                        : modalTipo === 'checkout'
                          ? 'Queda en historial de la unidad y, si vinculas renta, queda ligado al expediente del cliente.'
                          : 'Queda en historial con inspección, evidencia y documentos revisados.'}
                    </p>
                  </div>
                </div>
                {unidadSel ? (
                  <div className="shrink-0 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right shadow-lg backdrop-blur-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Unidad</p>
                    {(unidadSel.numeroEconomico ?? '').trim() ? (
                      <>
                        <p className="font-mono text-xl font-bold tracking-wide">{(unidadSel.numeroEconomico ?? '').trim()}</p>
                        <p className="font-mono text-sm font-semibold text-white/90">{unidadSel.placas}</p>
                      </>
                    ) : (
                      <p className="font-mono text-xl font-bold tracking-wide">{unidadSel.placas}</p>
                    )}
                    <p className="text-sm text-white/85">
                      {unidadSel.marca} {unidadSel.modelo}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 sm:px-6">
              <Icon icon="mdi:clipboard-list-outline" className="hidden size-4 text-slate-400 sm:block" aria-hidden />
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Resumen</span>
              <ModalidadPill m={modalidad} />
              {unidadSel?.tipoUnidad && unidadSel.tipoUnidad !== 'remolque_seco' ? (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-800">
                  Catálogo: {labelTipoUnidad(unidadSel.tipoUnidad)}
                </span>
              ) : null}
            </div>
            <form onSubmit={enviar} className="max-h-[min(85vh,920px)] space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <FormSection
                step={1}
                title="Movimiento y unidad"
                hint="Unidad, renta opcional, colaborador y lecturas de odómetro / combustible del tractor o equipo."
                icon="mdi:truck-check-outline"
              >
              {editandoId && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de movimiento</label>
                  <select
                    value={modalTipo || 'checkin'}
                    onChange={(e) => {
                      const next = e.target.value as 'checkin' | 'checkout';
                      setModalTipo(next);
                      setChecklist((prev) => {
                        const base = buildChecklist(next);
                        const presente = new Map(prev.map((p) => [p.id, p.presente]));
                        return base.map((b) => ({ ...b, presente: presente.get(b.id) ?? b.presente }));
                      });
                    }}
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
                      {etiquetaUnidadLista(u)} ({u.estatus})
                      {tipoUnidadSufijoOpcion(u.tipoUnidad)}
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
              </FormSection>

              <FormSection
                step={2}
                title="Encabezado de la hoja"
                hint="Encabezado tipo hoja física. Con «Caja seca» o «Plataforma» aparecen también Placas, KM, Marca y Tipo del formato."
                icon="mdi:file-document-edit-outline"
              >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-800">Tipo de inspección (hoja)</label>
                <select
                  value={modalidad}
                  onChange={(e) => setModalidad(e.target.value as CheckinOutModalidad)}
                  className="input w-full"
                >
                  {(Object.keys(MODALIDAD_LABEL) as CheckinOutModalidad[]).map((k) => (
                    <option key={k} value={k}>
                      {MODALIDAD_LABEL[k]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Elige la hoja que aplica. Los datos de cada modalidad se conservan si cambias de opción.
                </p>
              </div>

              <fieldset className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                <legend className="px-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                  Datos generales y cierre
                </legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="mb-0.5 block text-xs font-medium text-gray-600">Folio</label>
                    <input
                      type="text"
                      value={inspeccion.header.folio}
                      onChange={(e) => patchHeader({ folio: e.target.value })}
                      className="input w-full text-sm"
                      placeholder="Ej. 351"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs font-medium text-gray-600">Fecha inspección</label>
                    <input
                      type="date"
                      value={inspeccion.header.fechaInspeccion}
                      onChange={(e) => patchHeader({ fechaInspeccion: e.target.value })}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs font-medium text-gray-600">Conductor / operador</label>
                    <input
                      type="text"
                      value={inspeccion.header.conductor}
                      onChange={(e) => patchHeader({ conductor: e.target.value })}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs font-medium text-gray-600">Nº económico</label>
                    <input
                      type="text"
                      value={inspeccion.header.nEconomico}
                      onChange={(e) => patchHeader({ nEconomico: e.target.value })}
                      className="input w-full text-sm"
                    />
                  </div>
                  {(modalidad === 'caja_seca' ||
                    modalidad === 'plataforma' ||
                    modalidad === 'dolly' ||
                    modalidad === 'camion_tracto' ||
                    modalidad === 'caja_ref_sin_termo' ||
                    modalidad === 'pickup' ||
                    modalidad === 'vehiculo_empresarial') && (
                    <>
                      <div>
                        <label className="mb-0.5 block text-xs font-medium text-gray-600">Placas (hoja)</label>
                        <input
                          type="text"
                          value={inspeccion.header.hojaPlacas}
                          onChange={(e) => patchHeader({ hojaPlacas: e.target.value })}
                          className="input w-full text-sm"
                          placeholder="Como en el formato impreso"
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-xs font-medium text-gray-600">KM (hoja)</label>
                        <input
                          type="text"
                          value={inspeccion.header.hojaKm}
                          onChange={(e) => patchHeader({ hojaKm: e.target.value })}
                          className="input w-full text-sm"
                          placeholder="Kilometraje en la hoja"
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-xs font-medium text-gray-600">Marca (hoja)</label>
                        <input
                          type="text"
                          value={inspeccion.header.hojaMarca}
                          onChange={(e) => patchHeader({ hojaMarca: e.target.value })}
                          className="input w-full text-sm"
                        />
                      </div>
                      {modalidad === 'camion_tracto' || modalidad === 'pickup' ? (
                        <>
                          <div>
                            <label className="mb-0.5 block text-xs font-medium text-gray-600">Modelo (hoja)</label>
                            <input
                              type="text"
                              value={inspeccion.header.hojaModelo}
                              onChange={(e) => patchHeader({ hojaModelo: e.target.value })}
                              className="input w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-xs font-medium text-gray-600">Año (hoja)</label>
                            <input
                              type="text"
                              value={inspeccion.header.hojaAnio}
                              onChange={(e) => patchHeader({ hojaAnio: e.target.value })}
                              className="input w-full text-sm"
                              placeholder="Ej. 2022"
                            />
                          </div>
                        </>
                      ) : modalidad === 'vehiculo_empresarial' ? (
                        <>
                          <div>
                            <label className="mb-0.5 block text-xs font-medium text-gray-600">Modelo (hoja)</label>
                            <input
                              type="text"
                              value={inspeccion.header.hojaModelo}
                              onChange={(e) => patchHeader({ hojaModelo: e.target.value })}
                              className="input w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-xs font-medium text-gray-600">Año (hoja)</label>
                            <input
                              type="text"
                              value={inspeccion.header.hojaAnio}
                              onChange={(e) => patchHeader({ hojaAnio: e.target.value })}
                              className="input w-full text-sm"
                              placeholder="Ej. 2022"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-xs font-medium text-gray-600">
                              Tipo (Sedán / Hatchback / SUV)
                            </label>
                            <input
                              type="text"
                              value={inspeccion.header.hojaTipo}
                              onChange={(e) => patchHeader({ hojaTipo: e.target.value })}
                              className="input w-full text-sm"
                              placeholder="Ej. SUV"
                            />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label className="mb-0.5 block text-xs font-medium text-gray-600">Tipo (hoja)</label>
                          <input
                            type="text"
                            value={inspeccion.header.hojaTipo}
                            onChange={(e) => patchHeader({ hojaTipo: e.target.value })}
                            className="input w-full text-sm"
                            placeholder="Ej. 53' caja seca"
                          />
                        </div>
                      )}
                    </>
                  )}
                  {modalidad !== 'dolly' &&
                    modalidad !== 'camion_tracto' &&
                    modalidad !== 'pickup' &&
                    modalidad !== 'vehiculo_empresarial' && (
                    <div>
                      <label className="mb-0.5 block text-xs font-medium text-gray-600">
                        {modalidad === 'plataforma'
                          ? 'Tracto'
                          : modalidad === 'caja_ref_sin_termo'
                            ? 'Caja'
                            : 'Camión / tractor'}
                      </label>
                      <input
                        type="text"
                        value={inspeccion.header.camion}
                        onChange={(e) => patchHeader({ camion: e.target.value })}
                        className="input w-full text-sm"
                        placeholder={
                          modalidad === 'plataforma'
                            ? 'Identificación del tracto'
                            : modalidad === 'caja_ref_sin_termo'
                              ? 'Identificación de la caja'
                              : undefined
                        }
                      />
                    </div>
                  )}
                  {modalidad !== 'plataforma' && modalidad !== 'dolly' && modalidad !== 'caja_ref_sin_termo' && (
                    <div className="sm:col-span-2">
                      <label className="mb-0.5 block text-xs font-medium text-gray-600">
                        Nivel combustible (E / ½ / F u otro)
                      </label>
                      <input
                        type="text"
                        value={inspeccion.header.nivelCombustibleEscala}
                        onChange={(e) => patchHeader({ nivelCombustibleEscala: e.target.value })}
                        className="input w-full text-sm"
                        placeholder="Ej. ¾, mitad…"
                      />
                    </div>
                  )}
                  {modalidad !== 'plataforma' && modalidad !== 'dolly' && modalidad !== 'caja_ref_sin_termo' && (
                    <div className="sm:col-span-2">
                      <label className="mb-0.5 block text-xs font-medium text-gray-600">
                        Detalles a reparar / refacciones (hoja)
                      </label>
                      <textarea
                        value={inspeccion.header.descripcionReparar}
                        onChange={(e) => patchHeader({ descripcionReparar: e.target.value })}
                        className="input min-h-[56px] w-full resize-y text-sm"
                        rows={2}
                        placeholder="Descripción previa de detalles a reparar"
                      />
                    </div>
                  )}
                  {modalidad !== 'plataforma' && modalidad !== 'dolly' && modalidad !== 'caja_ref_sin_termo' && (
                    <div className="sm:col-span-2">
                      <label className="mb-0.5 block text-xs font-medium text-gray-600">Refacciones a utilizar</label>
                      <textarea
                        value={inspeccion.header.refacciones}
                        onChange={(e) => patchHeader({ refacciones: e.target.value })}
                        className="input min-h-[56px] w-full resize-y text-sm"
                        rows={2}
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-0.5 block text-xs font-medium text-gray-600">Mecánico asignado</label>
                    <input
                      type="text"
                      value={inspeccion.header.mecanicoAsignado}
                      onChange={(e) => patchHeader({ mecanicoAsignado: e.target.value })}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-0.5 block text-xs font-medium text-gray-600">Firma de conformidad</label>
                    <input
                      type="text"
                      value={inspeccion.header.firmaConformidad}
                      onChange={(e) => patchHeader({ firmaConformidad: e.target.value })}
                      className="input w-full text-sm"
                      placeholder="Nombre o indicación de firma"
                    />
                  </div>
                </div>
              </fieldset>
              </FormSection>

              <FormSection
                step={3}
                title="Contenido de la inspección"
                hint={tituloBloqueInspeccion}
                icon="mdi:clipboard-check-multiple-outline"
              >
              {modalidad === 'caja_seca' && (
                <div className="space-y-4">
                  <p className="text-xs leading-relaxed text-slate-600">
                    <span className="font-semibold uppercase tracking-wide text-slate-500">Hoja SKYLINE · caja seca.</span>{' '}
                    Marca cada ítem: <strong>Bien</strong> (✔), <strong>Mal</strong> (X) o <strong>N/A</strong>, como en el
                    formato impreso. Describe daños o croquis de carrocería al final.
                  </p>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {CAJA_SECA_SECCIONES.map((sec) => (
                      <div
                        key={sec.titulo}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.03]"
                      >
                        <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-skyline-blue">
                          {sec.titulo}
                        </p>
                        <div className="max-h-96 overflow-y-auto pr-1">
                          {sec.items.map((it) => (
                            <TriPick
                              key={it.id}
                              label={it.label}
                              value={inspeccion.cajaSeca.items[it.id] ?? ''}
                              onChange={(v) => setTriCaja(it.id, v)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-800">Llantas</p>
                    <div className="overflow-x-auto rounded-lg border border-skyline-border">
                      <table className="w-full min-w-[640px] text-left text-xs">
                        <thead className="bg-skyline-bg font-semibold text-gray-600">
                          <tr>
                            <th className="px-2 py-1.5">No.</th>
                            <th className="px-2 py-1.5">Posición</th>
                            <th className="px-2 py-1.5">Marca</th>
                            <th className="px-2 py-1.5">Modelo</th>
                            <th className="px-2 py-1.5">MM</th>
                            <th className="px-2 py-1.5">Sellos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-skyline-border">
                          {inspeccion.cajaSeca.llantas.map((row, i) => (
                            <tr key={i}>
                              <td className="px-2 py-1 text-gray-500">{i + 1}</td>
                              <td className="px-1 py-0.5">
                                <input
                                  className="input w-full py-1 text-xs"
                                  value={row.posicion}
                                  onChange={(e) =>
                                    setInspeccion((p) => {
                                      const ll = [...p.cajaSeca.llantas];
                                      ll[i] = { ...ll[i], posicion: e.target.value };
                                      return { ...p, cajaSeca: { ...p.cajaSeca, llantas: ll } };
                                    })
                                  }
                                />
                              </td>
                              <td className="px-1 py-0.5">
                                <input
                                  className="input w-full py-1 text-xs"
                                  value={row.marca}
                                  onChange={(e) =>
                                    setInspeccion((p) => {
                                      const ll = [...p.cajaSeca.llantas];
                                      ll[i] = { ...ll[i], marca: e.target.value };
                                      return { ...p, cajaSeca: { ...p.cajaSeca, llantas: ll } };
                                    })
                                  }
                                />
                              </td>
                              <td className="px-1 py-0.5">
                                <input
                                  className="input w-full py-1 text-xs"
                                  value={row.modelo}
                                  onChange={(e) =>
                                    setInspeccion((p) => {
                                      const ll = [...p.cajaSeca.llantas];
                                      ll[i] = { ...ll[i], modelo: e.target.value };
                                      return { ...p, cajaSeca: { ...p.cajaSeca, llantas: ll } };
                                    })
                                  }
                                />
                              </td>
                              <td className="px-1 py-0.5">
                                <input
                                  className="input w-full py-1 text-xs"
                                  value={row.mm}
                                  onChange={(e) =>
                                    setInspeccion((p) => {
                                      const ll = [...p.cajaSeca.llantas];
                                      ll[i] = { ...ll[i], mm: e.target.value };
                                      return { ...p, cajaSeca: { ...p.cajaSeca, llantas: ll } };
                                    })
                                  }
                                />
                              </td>
                              <td className="px-1 py-0.5">
                                <input
                                  className="input w-full py-1 text-xs"
                                  value={row.sellos}
                                  onChange={(e) =>
                                    setInspeccion((p) => {
                                      const ll = [...p.cajaSeca.llantas];
                                      ll[i] = { ...ll[i], sellos: e.target.value };
                                      return { ...p, cajaSeca: { ...p.cajaSeca, llantas: ll } };
                                    })
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Daños de carrocería / notas (diagrama en papel)
                    </label>
                    <textarea
                      value={inspeccion.cajaSeca.danosNotas}
                      onChange={(e) =>
                        setInspeccion((p) => ({
                          ...p,
                          cajaSeca: { ...p.cajaSeca, danosNotas: e.target.value },
                        }))
                      }
                      className="input min-h-[72px] w-full resize-y text-sm"
                      rows={3}
                      placeholder="Describe daños o referencia a croquis…"
                    />
                  </div>
                </div>
              )}

              {modalidad === 'refrigerado' && (
                <div className="space-y-5">
                  <p className="text-xs leading-relaxed text-slate-600">
                    Checklist de <strong>unidad de refrigeración</strong>: tres bloques como en operación —
                    datos y condiciones del equipo, control de temperatura y prueba de funcionamiento (Bien · Mal · N/A
                    donde aplique).
                  </p>

                  <section className="rounded-xl border-2 border-sky-200/90 bg-gradient-to-b from-white to-sky-50/40 p-4 shadow-sm">
                    <h4 className="mb-3 flex items-center gap-2 border-b border-sky-100 pb-2 text-sm font-bold text-sky-950">
                      <span className="flex size-7 items-center justify-center rounded-full bg-sky-600 text-xs text-white">
                        1
                      </span>
                      Unidad de Refrigeración
                    </h4>

                    <div className="mb-5">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Datos del equipo</p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {(
                          [
                            ['marca', 'Marca de unidad (Thermo King / Carrier / etc.)'] as const,
                            ['modelo', 'Modelo'] as const,
                            ['numeroSerie', 'Número de serie'] as const,
                            ['horasMotor', 'Horas de motor'] as const,
                            ['tipoCombustible', 'Tipo de combustible'] as const,
                          ] as const
                        ).map(([k, lab]) => (
                          <div key={k}>
                            <label className="mb-0.5 block text-xs font-medium text-gray-700">{lab}</label>
                            <input
                              type="text"
                              className="input w-full text-sm"
                              value={inspeccion.refrigeracion.equipo[k]}
                              onChange={(e) =>
                                setInspeccion((p) => ({
                                  ...p,
                                  refrigeracion: {
                                    ...p.refrigeracion,
                                    equipo: { ...p.refrigeracion.equipo, [k]: e.target.value },
                                  },
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Condiciones</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(
                          [
                            ['nivelDiesel', 'Nivel de diésel de la unidad'] as const,
                            ['nivelAceite', 'Nivel de aceite'] as const,
                            ['nivelAnticongelante', 'Nivel de anticongelante'] as const,
                            ['estadoBateria', 'Estado de batería'] as const,
                          ] as const
                        ).map(([k, lab]) => (
                          <div key={k}>
                            <label className="mb-0.5 block text-xs font-medium text-gray-700">{lab}</label>
                            <input
                              type="text"
                              className="input w-full text-sm"
                              value={inspeccion.refrigeracion.condiciones[k]}
                              onChange={(e) =>
                                setInspeccion((p) => ({
                                  ...p,
                                  refrigeracion: {
                                    ...p.refrigeracion,
                                    condiciones: {
                                      ...p.refrigeracion.condiciones,
                                      [k]: e.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 mb-1 text-xs font-semibold text-gray-700">Fugas visibles (aceite / refrigerante)</p>
                      <p className="mb-2 text-[11px] text-gray-500">
                        <strong>Bien</strong> = sin fuga visible · <strong>Mal</strong> = con fuga · <strong>N/A</strong> si no aplica revisar.
                      </p>
                      <TriPick
                        label="Aceite"
                        value={inspeccion.refrigeracion.condiciones.fugaAceite}
                        onChange={(v) =>
                          setInspeccion((p) => ({
                            ...p,
                            refrigeracion: {
                              ...p.refrigeracion,
                              condiciones: { ...p.refrigeracion.condiciones, fugaAceite: v },
                            },
                          }))
                        }
                      />
                      <TriPick
                        label="Refrigerante"
                        value={inspeccion.refrigeracion.condiciones.fugaRefrigerante}
                        onChange={(v) =>
                          setInspeccion((p) => ({
                            ...p,
                            refrigeracion: {
                              ...p.refrigeracion,
                              condiciones: { ...p.refrigeracion.condiciones, fugaRefrigerante: v },
                            },
                          }))
                        }
                      />
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
                      <span className="flex size-7 items-center justify-center rounded-full bg-slate-700 text-xs text-white">
                        2
                      </span>
                      Control de Temperatura
                    </h4>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {(
                        [
                          ['setPoint', 'Temperatura programada (Set Point)'] as const,
                          ['tempActual', 'Temperatura actual'] as const,
                          [
                            'modoOperacion',
                            'Modo de operación (Continuo / Start-Stop)',
                          ] as const,
                          ['lecturaDisplay', 'Lectura del display'] as const,
                          ['termografo', 'Funcionamiento del termógrafo (si tiene)'] as const,
                          ['registroTemperatura', 'Registro de temperatura (Sí / No)'] as const,
                        ] as const
                      ).map(([k, lab]) => (
                        <div key={k} className={k === 'lecturaDisplay' ? 'sm:col-span-2' : ''}>
                          <label className="mb-0.5 block text-xs font-medium text-gray-700">{lab}</label>
                          <input
                            type="text"
                            className="input w-full text-sm"
                            value={inspeccion.refrigeracion.temperatura[k]}
                            onChange={(e) =>
                              setInspeccion((p) => ({
                                ...p,
                                refrigeracion: {
                                  ...p.refrigeracion,
                                  temperatura: {
                                    ...p.refrigeracion.temperatura,
                                    [k]: e.target.value,
                                  },
                                },
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
                      <span className="flex size-7 items-center justify-center rounded-full bg-emerald-700 text-xs text-white">
                        3
                      </span>
                      Prueba de Funcionamiento
                    </h4>
                    <p className="mb-2 text-[11px] text-gray-500">
                      Marque Bien · Mal · N/A según el comportamiento del equipo.
                    </p>
                    {REFRIGERACION_PRUEBA_IDS.map((it) => (
                      <TriPick
                        key={it.id}
                        label={it.label}
                        value={inspeccion.refrigeracion.prueba[it.id] ?? ''}
                        onChange={(v) => setTriRefPrueba(it.id, v)}
                      />
                    ))}
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
                      <span className="flex size-7 items-center justify-center rounded-full bg-indigo-700 text-xs text-white">
                        4
                      </span>
                      Carrocería del remolque refrigerado
                    </h4>
                    <p className="text-xs leading-relaxed text-slate-600">
                      <span className="font-semibold uppercase tracking-wide text-slate-500">Hoja SKYLINE · remolque refrigerado.</span>{' '}
                      Marca cada ítem: <strong>Bien</strong> (✔), <strong>Mal</strong> (X) o <strong>N/A</strong>, como en el
                      formato impreso. Describe daños o croquis de carrocería al final.
                    </p>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {CAJA_SECA_SECCIONES.map((sec) => (
                        <div
                          key={sec.titulo}
                          className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.03]"
                        >
                          <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-skyline-blue">
                            {sec.titulo}
                          </p>
                          <div className="max-h-96 overflow-y-auto pr-1">
                            {sec.items.map((it) => (
                              <TriPick
                                key={it.id}
                                label={it.label}
                                value={inspeccion.refrigeracion.carroceriaRemolque.items[it.id] ?? ''}
                                onChange={(v) => setTriRefCarroceria(it.id, v)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <p className="mb-2 text-sm font-medium text-gray-800">Llantas</p>
                      <div className="overflow-x-auto rounded-lg border border-skyline-border">
                        <table className="w-full min-w-[640px] text-left text-xs">
                          <thead className="bg-skyline-bg font-semibold text-gray-600">
                            <tr>
                              <th className="px-2 py-1.5">No.</th>
                              <th className="px-2 py-1.5">Posición</th>
                              <th className="px-2 py-1.5">Marca</th>
                              <th className="px-2 py-1.5">Modelo</th>
                              <th className="px-2 py-1.5">MM</th>
                              <th className="px-2 py-1.5">Sellos</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-skyline-border">
                            {inspeccion.refrigeracion.carroceriaRemolque.llantas.map((row, i) => (
                              <tr key={i}>
                                <td className="px-2 py-1 text-gray-500">{i + 1}</td>
                                <td className="px-1 py-0.5">
                                  <input
                                    className="input w-full py-1 text-xs"
                                    value={row.posicion}
                                    onChange={(e) =>
                                      setInspeccion((p) => {
                                        const ll = [...p.refrigeracion.carroceriaRemolque.llantas];
                                        ll[i] = { ...ll[i], posicion: e.target.value };
                                        return {
                                          ...p,
                                          refrigeracion: {
                                            ...p.refrigeracion,
                                            carroceriaRemolque: { ...p.refrigeracion.carroceriaRemolque, llantas: ll },
                                          },
                                        };
                                      })
                                    }
                                  />
                                </td>
                                <td className="px-1 py-0.5">
                                  <input
                                    className="input w-full py-1 text-xs"
                                    value={row.marca}
                                    onChange={(e) =>
                                      setInspeccion((p) => {
                                        const ll = [...p.refrigeracion.carroceriaRemolque.llantas];
                                        ll[i] = { ...ll[i], marca: e.target.value };
                                        return {
                                          ...p,
                                          refrigeracion: {
                                            ...p.refrigeracion,
                                            carroceriaRemolque: { ...p.refrigeracion.carroceriaRemolque, llantas: ll },
                                          },
                                        };
                                      })
                                    }
                                  />
                                </td>
                                <td className="px-1 py-0.5">
                                  <input
                                    className="input w-full py-1 text-xs"
                                    value={row.modelo}
                                    onChange={(e) =>
                                      setInspeccion((p) => {
                                        const ll = [...p.refrigeracion.carroceriaRemolque.llantas];
                                        ll[i] = { ...ll[i], modelo: e.target.value };
                                        return {
                                          ...p,
                                          refrigeracion: {
                                            ...p.refrigeracion,
                                            carroceriaRemolque: { ...p.refrigeracion.carroceriaRemolque, llantas: ll },
                                          },
                                        };
                                      })
                                    }
                                  />
                                </td>
                                <td className="px-1 py-0.5">
                                  <input
                                    className="input w-full py-1 text-xs"
                                    value={row.mm}
                                    onChange={(e) =>
                                      setInspeccion((p) => {
                                        const ll = [...p.refrigeracion.carroceriaRemolque.llantas];
                                        ll[i] = { ...ll[i], mm: e.target.value };
                                        return {
                                          ...p,
                                          refrigeracion: {
                                            ...p.refrigeracion,
                                            carroceriaRemolque: { ...p.refrigeracion.carroceriaRemolque, llantas: ll },
                                          },
                                        };
                                      })
                                    }
                                  />
                                </td>
                                <td className="px-1 py-0.5">
                                  <input
                                    className="input w-full py-1 text-xs"
                                    value={row.sellos}
                                    onChange={(e) =>
                                      setInspeccion((p) => {
                                        const ll = [...p.refrigeracion.carroceriaRemolque.llantas];
                                        ll[i] = { ...ll[i], sellos: e.target.value };
                                        return {
                                          ...p,
                                          refrigeracion: {
                                            ...p.refrigeracion,
                                            carroceriaRemolque: { ...p.refrigeracion.carroceriaRemolque, llantas: ll },
                                          },
                                        };
                                      })
                                    }
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Daños de carrocería / notas (diagrama en papel)
                      </label>
                      <textarea
                        value={inspeccion.refrigeracion.carroceriaRemolque.danosNotas}
                        onChange={(e) =>
                          setInspeccion((p) => ({
                            ...p,
                            refrigeracion: {
                              ...p.refrigeracion,
                              carroceriaRemolque: {
                                ...p.refrigeracion.carroceriaRemolque,
                                danosNotas: e.target.value,
                              },
                            },
                          }))
                        }
                        className="input min-h-[72px] w-full resize-y text-sm"
                        rows={3}
                        placeholder="Describe daños o referencia a croquis…"
                      />
                    </div>
                  </section>
                </div>
              )}

              {modalidad === 'mulita_patio' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-100 bg-amber-50/40 px-3 py-3 sm:px-4">
                    <h4 className="text-sm font-bold tracking-tight text-slate-900">
                      Hoja de inspección — Mulita de patio
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Marca cada punto como en el formato impreso: <strong>Bien</strong> (✔), <strong>Mal</strong> (X) o{' '}
                      <strong>N/A</strong>. Los bloques siguen el orden de la hoja física (secc. 2–12; la 5 es llantas).
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                    <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-skyline-blue">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-skyline-blue/15 text-[11px] font-bold text-skyline-blue">
                        1
                      </span>
                      Datos generales
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="mb-0.5 block text-xs font-medium text-gray-600">Fecha</label>
                        <input
                          type="date"
                          className="input w-full text-sm"
                          value={inspeccion.header.fechaInspeccion}
                          onChange={(e) => patchHeader({ fechaInspeccion: e.target.value })}
                        />
                      </div>
                      {(
                        [
                          ['operador', 'Operador'] as const,
                          ['nEconomico', 'No. económico'] as const,
                          ['vinSerie', 'VIN / serie'] as const,
                          ['marca', 'Marca (ej. Ottawa, Autocar)'] as const,
                          ['modeloAnio', 'Modelo / año'] as const,
                          ['horasUso', 'Horas de uso'] as const,
                        ] as const
                      ).map(([k, lab]) => (
                        <div key={k}>
                          <label className="mb-0.5 block text-xs font-medium text-gray-600">{lab}</label>
                          <input
                            type="text"
                            className="input w-full text-sm"
                            value={inspeccion.mulita.datos[k]}
                            placeholder={k === 'marca' ? 'Ottawa, Autocar…' : undefined}
                            onChange={(e) =>
                              setInspeccion((p) => ({
                                ...p,
                                mulita: {
                                  ...p.mulita,
                                  datos: { ...p.mulita.datos, [k]: e.target.value },
                                },
                              }))
                            }
                          />
                        </div>
                      ))}
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="mb-0.5 block text-xs font-medium text-gray-600">Ubicación</label>
                        <input
                          type="text"
                          className="input w-full text-sm"
                          value={inspeccion.mulita.datos.ubicacion}
                          onChange={(e) =>
                            setInspeccion((p) => ({
                              ...p,
                              mulita: {
                                ...p.mulita,
                                datos: { ...p.mulita.datos, ubicacion: e.target.value },
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">{renderMulitaSecciones(MULITA_SECCIONES_HASTA_LLANTAS)}</div>
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-800">
                        5
                      </span>
                      Llantas
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-skyline-border">
                      <table className="w-full min-w-[520px] text-left text-xs">
                        <thead className="bg-skyline-bg font-semibold text-gray-600">
                          <tr>
                            <th className="px-2 py-2">Posición</th>
                            <th className="px-2 py-2">Estado / vida útil</th>
                            <th className="px-2 py-2">Presión</th>
                            <th className="px-2 py-2">Daños visibles</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-skyline-border">
                          {inspeccion.mulita.llantas.map((row, i) => (
                            <tr key={i}>
                              {(['posicion', 'estado', 'presion', 'danos'] as const).map((field) => (
                                <td key={field} className="px-1 py-0.5">
                                  <input
                                    className="input w-full py-1 text-xs"
                                    value={row[field]}
                                    onChange={(e) =>
                                      setInspeccion((p) => {
                                        const ll = [...p.mulita.llantas];
                                        ll[i] = { ...ll[i], [field]: e.target.value };
                                        return { ...p, mulita: { ...p.mulita, llantas: ll } };
                                      })
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">{renderMulitaSecciones(MULITA_SECCIONES_TRAS_LLANTAS)}</div>
                </div>
              )}

              {modalidad === 'plataforma' && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-3 sm:px-4">
                    <h4 className="text-sm font-bold tracking-tight text-slate-900">
                      Hoja de inspección — Plataforma
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Marque con <strong className="text-rose-700">X</strong> las partes dañadas en carrocería. En revisión
                      general use <strong>Bien</strong> (✓), <strong>Mal</strong> (X) o <strong>N/A</strong> según corresponda.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-violet-800">
                      Daños de carrocería
                    </p>
                    <p className="mb-3 text-[11px] text-slate-500">Marque con una X las partes dañadas.</p>
                    <div className="max-h-72 overflow-y-auto pr-1">
                      {PLATAFORMA_DANOS_CARROCERIA.map((it) => (
                        <DanioXPick
                          key={it.id}
                          label={it.label}
                          value={inspeccion.plataforma.danosCarroceria[it.id] ?? ''}
                          onChange={(v) => setPlataformaDano(it.id, v)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {PLATAFORMA_SECCIONES_REVISION.map((sec) => (
                      <div
                        key={sec.key}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.03]"
                      >
                        <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-skyline-blue">
                          {sec.titulo}
                        </p>
                        <p className="mb-2 text-[11px] text-slate-500">
                          Marque X si está en mal estado y ✓ si está en buen estado (o N/A).
                        </p>
                        <div className="max-h-80 overflow-y-auto pr-1">
                          {sec.items.map((it) => (
                            <TriPick
                              key={it.id}
                              label={it.label}
                              value={(inspeccion.plataforma[sec.key] as Record<string, Tri>)[it.id] ?? ''}
                              onChange={(v) => setTriPlataforma(sec.key, it.id, v)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-800">Llantas</p>
                    <div className="overflow-x-auto rounded-lg border border-skyline-border">
                      <table className="w-full min-w-[720px] text-left text-xs">
                        <thead className="bg-skyline-bg font-semibold text-gray-600">
                          <tr>
                            <th className="px-2 py-1.5">No.</th>
                            <th className="px-2 py-1.5">Posición</th>
                            <th className="px-2 py-1.5">Marca</th>
                            <th className="px-2 py-1.5">Medida</th>
                            <th className="px-2 py-1.5">Estado</th>
                            <th className="px-2 py-1.5">Sellos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-skyline-border">
                          {inspeccion.plataforma.llantas.map((row, i) => (
                            <tr key={i}>
                              <td className="px-2 py-1 text-gray-500">{i + 1}</td>
                              {(['posicion', 'marca', 'medida', 'estado', 'sellos'] as const).map((field) => (
                                <td key={field} className="px-1 py-0.5">
                                  <input
                                    className="input w-full py-1 text-xs"
                                    value={row[field]}
                                    onChange={(e) =>
                                      setInspeccion((p) => {
                                        const ll = [...p.plataforma.llantas];
                                        ll[i] = { ...ll[i], [field]: e.target.value };
                                        return { ...p, plataforma: { ...p.plataforma, llantas: ll } };
                                      })
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Descripción de daños detectados
                    </label>
                    <textarea
                      value={inspeccion.plataforma.descripcionDanos}
                      onChange={(e) =>
                        setInspeccion((p) => ({
                          ...p,
                          plataforma: { ...p.plataforma, descripcionDanos: e.target.value },
                        }))
                      }
                      className="input min-h-[72px] w-full resize-y text-sm"
                      rows={3}
                      placeholder="Detalle de golpes, fisuras, corrosión…"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones generales</label>
                    <textarea
                      value={inspeccion.plataforma.observacionesGenerales}
                      onChange={(e) =>
                        setInspeccion((p) => ({
                          ...p,
                          plataforma: { ...p.plataforma, observacionesGenerales: e.target.value },
                        }))
                      }
                      className="input min-h-[72px] w-full resize-y text-sm"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {modalidad === 'dolly' && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-3 sm:px-4">
                    <h4 className="text-sm font-bold tracking-tight text-slate-900">Hoja de inspección — Dolly</h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Marque con <strong className="text-rose-700">X</strong> las partes dañadas en daños generales. En
                      revisión general use <strong>Bien</strong> (✓), <strong>Mal</strong> (X) o <strong>N/A</strong> según
                      corresponda.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-teal-800">
                      Daños generales
                    </p>
                    <p className="mb-3 text-[11px] text-slate-500">Marque con una X las partes dañadas.</p>
                    <div className="max-h-72 overflow-y-auto pr-1">
                      {DOLLY_DANOS_GENERALES.map((it) => (
                        <DanioXPick
                          key={it.id}
                          label={it.label}
                          value={inspeccion.dolly.danosGenerales[it.id] ?? ''}
                          onChange={(v) => setDollyDano(it.id, v)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {DOLLY_SECCIONES_REVISION.map((sec) => (
                      <div
                        key={sec.key}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.03]"
                      >
                        <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-skyline-blue">
                          {sec.titulo}
                        </p>
                        <p className="mb-2 text-[11px] text-slate-500">
                          Marque X si está en mal estado y ✓ si está en buen estado (o N/A).
                        </p>
                        <div className="max-h-80 overflow-y-auto pr-1">
                          {sec.items.map((it) => (
                            <TriPick
                              key={it.id}
                              label={it.label}
                              value={(inspeccion.dolly[sec.key] as Record<string, Tri>)[it.id] ?? ''}
                              onChange={(v) => setTriDolly(sec.key, it.id, v)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-800">Llantas</p>
                    <div className="overflow-x-auto rounded-lg border border-skyline-border">
                      <table className="w-full min-w-[720px] text-left text-xs">
                        <thead className="bg-skyline-bg font-semibold text-gray-600">
                          <tr>
                            <th className="px-2 py-1.5">No.</th>
                            <th className="px-2 py-1.5">Posición</th>
                            <th className="px-2 py-1.5">Marca</th>
                            <th className="px-2 py-1.5">Medida</th>
                            <th className="px-2 py-1.5">Estado</th>
                            <th className="px-2 py-1.5">Sellos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-skyline-border">
                          {inspeccion.dolly.llantas.map((row, i) => (
                            <tr key={i}>
                              <td className="px-2 py-1 text-gray-500">{i + 1}</td>
                              {(['posicion', 'marca', 'medida', 'estado', 'sellos'] as const).map((field) => (
                                <td key={field} className="px-1 py-0.5">
                                  <input
                                    className="input w-full py-1 text-xs"
                                    value={row[field]}
                                    onChange={(e) =>
                                      setInspeccion((p) => {
                                        const ll = [...p.dolly.llantas];
                                        ll[i] = { ...ll[i], [field]: e.target.value };
                                        return { ...p, dolly: { ...p.dolly, llantas: ll } };
                                      })
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Descripción de daños detectados
                    </label>
                    <textarea
                      value={inspeccion.dolly.descripcionDanos}
                      onChange={(e) =>
                        setInspeccion((p) => ({
                          ...p,
                          dolly: { ...p.dolly, descripcionDanos: e.target.value },
                        }))
                      }
                      className="input min-h-[72px] w-full resize-y text-sm"
                      rows={3}
                      placeholder="Detalle de daños o fallas…"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones generales</label>
                    <textarea
                      value={inspeccion.dolly.observacionesGenerales}
                      onChange={(e) =>
                        setInspeccion((p) => ({
                          ...p,
                          dolly: { ...p.dolly, observacionesGenerales: e.target.value },
                        }))
                      }
                      className="input min-h-[72px] w-full resize-y text-sm"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {modalidad === 'camion_tracto' && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-orange-100 bg-orange-50/50 px-3 py-3 sm:px-4">
                    <h4 className="text-sm font-bold tracking-tight text-slate-900">Hoja de inspección — Camión / tracto</h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Marque con <strong className="text-rose-700">X</strong> las zonas dañadas en carrocería. En revisión
                      general use <strong>Bien</strong> (✓), <strong>Mal</strong> (X) o <strong>N/A</strong> según corresponda.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-orange-900">
                      Daños generales (carrocería)
                    </p>
                    <p className="mb-3 text-[11px] text-slate-500">Marque con una X las partes dañadas.</p>
                    <div className="max-h-80 overflow-y-auto pr-1">
                      {CAMION_TRACTO_DANOS_CARROCERIA.map((it) => (
                        <DanioXPick
                          key={it.id}
                          label={it.label}
                          value={inspeccion.camionTracto.danosCarroceria[it.id] ?? ''}
                          onChange={(v) => setCamionTractoDanoCarroceria(it.id, v)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {CAMION_TRACTO_SECCIONES_REVISION.map((sec) => (
                      <div
                        key={sec.key}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.03]"
                      >
                        <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-skyline-blue">
                          {sec.titulo}
                        </p>
                        <p className="mb-2 text-[11px] text-slate-500">
                          Marque X si está en mal estado y ✓ si está en buen estado (o N/A).
                        </p>
                        <div className="max-h-80 overflow-y-auto pr-1">
                          {sec.items.map((it) => (
                            <TriPick
                              key={it.id}
                              label={it.label}
                              value={(inspeccion.camionTracto[sec.key] as Record<string, Tri>)[it.id] ?? ''}
                              onChange={(v) => setTriCamionTracto(sec.key, it.id, v)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-800">Llantas</p>
                    <div className="overflow-x-auto rounded-lg border border-skyline-border">
                      <table className="w-full min-w-[720px] text-left text-xs">
                        <thead className="bg-skyline-bg font-semibold text-gray-600">
                          <tr>
                            <th className="px-2 py-1.5">No.</th>
                            <th className="px-2 py-1.5">Posición</th>
                            <th className="px-2 py-1.5">Marca</th>
                            <th className="px-2 py-1.5">Medida</th>
                            <th className="px-2 py-1.5">Estado</th>
                            <th className="px-2 py-1.5">Sellos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-skyline-border">
                          {inspeccion.camionTracto.llantas.map((row, i) => (
                            <tr key={i}>
                              <td className="px-2 py-1 text-gray-500">{i + 1}</td>
                              {(['posicion', 'marca', 'medida', 'estado', 'sellos'] as const).map((field) => (
                                <td key={field} className="px-1 py-0.5">
                                  <input
                                    className="input w-full py-1 text-xs"
                                    value={row[field]}
                                    onChange={(e) =>
                                      setInspeccion((p) => {
                                        const ll = [...p.camionTracto.llantas];
                                        ll[i] = { ...ll[i], [field]: e.target.value };
                                        return { ...p, camionTracto: { ...p.camionTracto, llantas: ll } };
                                      })
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Descripción de daños detectados
                    </label>
                    <textarea
                      value={inspeccion.camionTracto.descripcionDanos}
                      onChange={(e) =>
                        setInspeccion((p) => ({
                          ...p,
                          camionTracto: { ...p.camionTracto, descripcionDanos: e.target.value },
                        }))
                      }
                      className="input min-h-[72px] w-full resize-y text-sm"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones generales</label>
                    <textarea
                      value={inspeccion.camionTracto.observacionesGenerales}
                      onChange={(e) =>
                        setInspeccion((p) => ({
                          ...p,
                          camionTracto: { ...p.camionTracto, observacionesGenerales: e.target.value },
                        }))
                      }
                      className="input min-h-[72px] w-full resize-y text-sm"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {modalidad === 'caja_ref_sin_termo' && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/50 px-3 py-3 sm:px-4">
                    <h4 className="text-sm font-bold tracking-tight text-slate-900">
                      Hoja de inspección — Caja refrigerada (sin termo)
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Marque con <strong className="text-rose-700">X</strong> las partes dañadas en carrocería. En revisión
                      general use <strong>Bien</strong> (✓), <strong>Mal</strong> (X) o <strong>N/A</strong> según corresponda.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-cyan-900">
                      Daños de carrocería
                    </p>
                    <p className="mb-3 text-[11px] text-slate-500">Marque con una X las partes dañadas.</p>
                    <div className="max-h-72 overflow-y-auto pr-1">
                      {CAJA_REF_ST_DANOS_CARROCERIA.map((it) => (
                        <DanioXPick
                          key={it.id}
                          label={it.label}
                          value={inspeccion.cajaRefSinTermo.danosCarroceria[it.id] ?? ''}
                          onChange={(v) => setCajaRefDanoCarroceria(it.id, v)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {CAJA_REF_ST_SECCIONES.map((sec) => (
                      <div
                        key={sec.key}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.03]"
                      >
                        <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-skyline-blue">
                          {sec.titulo}
                        </p>
                        <p className="mb-2 text-[11px] text-slate-500">
                          Marque X si está en mal estado y ✓ si está en buen estado (o N/A).
                        </p>
                        <div className="max-h-80 overflow-y-auto pr-1">
                          {sec.items.map((it) => (
                            <TriPick
                              key={it.id}
                              label={it.label}
                              value={(inspeccion.cajaRefSinTermo[sec.key] as Record<string, Tri>)[it.id] ?? ''}
                              onChange={(v) => setTriCajaRefSinTermo(sec.key, it.id, v)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-800">Llantas</p>
                    <div className="overflow-x-auto rounded-lg border border-skyline-border">
                      <table className="w-full min-w-[720px] text-left text-xs">
                        <thead className="bg-skyline-bg font-semibold text-gray-600">
                          <tr>
                            <th className="px-2 py-1.5">No.</th>
                            <th className="px-2 py-1.5">Posición</th>
                            <th className="px-2 py-1.5">Marca</th>
                            <th className="px-2 py-1.5">Medida</th>
                            <th className="px-2 py-1.5">Estado</th>
                            <th className="px-2 py-1.5">Sellos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-skyline-border">
                          {inspeccion.cajaRefSinTermo.llantas.map((row, i) => (
                            <tr key={i}>
                              <td className="px-2 py-1 text-gray-500">{i + 1}</td>
                              {(['posicion', 'marca', 'medida', 'estado', 'sellos'] as const).map((field) => (
                                <td key={field} className="px-1 py-0.5">
                                  <input
                                    className="input w-full py-1 text-xs"
                                    value={row[field]}
                                    onChange={(e) =>
                                      setInspeccion((p) => {
                                        const ll = [...p.cajaRefSinTermo.llantas];
                                        ll[i] = { ...ll[i], [field]: e.target.value };
                                        return { ...p, cajaRefSinTermo: { ...p.cajaRefSinTermo, llantas: ll } };
                                      })
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Descripción de daños detectados
                    </label>
                    <textarea
                      value={inspeccion.cajaRefSinTermo.descripcionDanos}
                      onChange={(e) =>
                        setInspeccion((p) => ({
                          ...p,
                          cajaRefSinTermo: { ...p.cajaRefSinTermo, descripcionDanos: e.target.value },
                        }))
                      }
                      className="input min-h-[72px] w-full resize-y text-sm"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones generales</label>
                    <textarea
                      value={inspeccion.cajaRefSinTermo.observacionesGenerales}
                      onChange={(e) =>
                        setInspeccion((p) => ({
                          ...p,
                          cajaRefSinTermo: { ...p.cajaRefSinTermo, observacionesGenerales: e.target.value },
                        }))
                      }
                      className="input min-h-[72px] w-full resize-y text-sm"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {modalidad === 'pickup' && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-lime-100 bg-lime-50/50 px-3 py-3 sm:px-4">
                    <h4 className="text-sm font-bold tracking-tight text-slate-900">Hoja de inspección — Pickup</h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Marque con <strong className="text-rose-700">X</strong> las partes dañadas en carrocería. En revisión
                      general use <strong>Bien</strong> (✓), <strong>Mal</strong> (X) o <strong>N/A</strong> según corresponda.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-lime-900">
                      Daños de carrocería
                    </p>
                    <div className="max-h-80 overflow-y-auto pr-1">
                      {PICKUP_DANOS_CARROCERIA.map((it) => (
                        <DanioXPick
                          key={it.id}
                          label={it.label}
                          value={inspeccion.pickup.danosCarroceria[it.id] ?? ''}
                          onChange={(v) => setPickupDanoCarroceria(it.id, v)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {PICKUP_SECCIONES.map((sec) => (
                      <div
                        key={sec.key}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.03]"
                      >
                        <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-skyline-blue">
                          {sec.titulo}
                        </p>
                        <p className="mb-2 text-[11px] text-slate-500">
                          Marque X si está en mal estado y ✓ si está en buen estado (o N/A).
                        </p>
                        <div className="max-h-80 overflow-y-auto pr-1">
                          {sec.items.map((it) => (
                            <TriPick
                              key={it.id}
                              label={it.label}
                              value={(inspeccion.pickup[sec.key] as Record<string, Tri>)[it.id] ?? ''}
                              onChange={(v) => setTriPickup(sec.key, it.id, v)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-800">Llantas</p>
                    <div className="overflow-x-auto rounded-lg border border-skyline-border">
                      <table className="w-full min-w-[720px] text-left text-xs">
                        <thead className="bg-skyline-bg font-semibold text-gray-600">
                          <tr>
                            <th className="px-2 py-1.5">No.</th>
                            <th className="px-2 py-1.5">Posición</th>
                            <th className="px-2 py-1.5">Marca</th>
                            <th className="px-2 py-1.5">Medida</th>
                            <th className="px-2 py-1.5">Estado</th>
                            <th className="px-2 py-1.5">Sellos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-skyline-border">
                          {inspeccion.pickup.llantas.map((row, i) => (
                            <tr key={i}>
                              <td className="px-2 py-1 text-gray-500">{i + 1}</td>
                              {(['posicion', 'marca', 'medida', 'estado', 'sellos'] as const).map((field) => (
                                <td key={field} className="px-1 py-0.5">
                                  <input
                                    className="input w-full py-1 text-xs"
                                    value={row[field]}
                                    onChange={(e) =>
                                      setInspeccion((p) => {
                                        const ll = [...p.pickup.llantas];
                                        ll[i] = { ...ll[i], [field]: e.target.value };
                                        return { ...p, pickup: { ...p.pickup, llantas: ll } };
                                      })
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Descripción de daños detectados
                    </label>
                    <textarea
                      value={inspeccion.pickup.descripcionDanos}
                      onChange={(e) =>
                        setInspeccion((p) => ({ ...p, pickup: { ...p.pickup, descripcionDanos: e.target.value } }))
                      }
                      className="input min-h-[72px] w-full resize-y text-sm"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones generales</label>
                    <textarea
                      value={inspeccion.pickup.observacionesGenerales}
                      onChange={(e) =>
                        setInspeccion((p) => ({
                          ...p,
                          pickup: { ...p.pickup, observacionesGenerales: e.target.value },
                        }))
                      }
                      className="input min-h-[72px] w-full resize-y text-sm"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {modalidad === 'vehiculo_empresarial' && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-3 sm:px-4">
                    <h4 className="text-sm font-bold tracking-tight text-slate-900">
                      Hoja de inspección — Vehículo empresarial
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Marque con <strong className="text-rose-700">X</strong> las partes dañadas en carrocería. En revisión
                      general use <strong>Bien</strong> (✓), <strong>Mal</strong> (X) o <strong>N/A</strong> según corresponda.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-indigo-900">
                      Daños de carrocería
                    </p>
                    <div className="max-h-80 overflow-y-auto pr-1">
                      {VEH_EMP_DANOS_CARROCERIA.map((it) => (
                        <DanioXPick
                          key={it.id}
                          label={it.label}
                          value={inspeccion.vehiculoEmpresarial.danosCarroceria[it.id] ?? ''}
                          onChange={(v) => setVehEmpDanoCarroceria(it.id, v)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {VEH_EMP_SECCIONES.map((sec) => (
                      <div
                        key={sec.key}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.03]"
                      >
                        <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-skyline-blue">
                          {sec.titulo}
                        </p>
                        <p className="mb-2 text-[11px] text-slate-500">
                          Marque X si está en mal estado y ✓ si está en buen estado (o N/A).
                        </p>
                        <div className="max-h-80 overflow-y-auto pr-1">
                          {sec.items.map((it) => (
                            <TriPick
                              key={it.id}
                              label={it.label}
                              value={(inspeccion.vehiculoEmpresarial[sec.key] as Record<string, Tri>)[it.id] ?? ''}
                              onChange={(v) => setTriVehEmp(sec.key, it.id, v)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-800">Llantas</p>
                    <div className="overflow-x-auto rounded-lg border border-skyline-border">
                      <table className="w-full min-w-[720px] text-left text-xs">
                        <thead className="bg-skyline-bg font-semibold text-gray-600">
                          <tr>
                            <th className="px-2 py-1.5">No.</th>
                            <th className="px-2 py-1.5">Posición</th>
                            <th className="px-2 py-1.5">Marca</th>
                            <th className="px-2 py-1.5">Medida</th>
                            <th className="px-2 py-1.5">Estado</th>
                            <th className="px-2 py-1.5">Sellos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-skyline-border">
                          {inspeccion.vehiculoEmpresarial.llantas.map((row, i) => (
                            <tr key={i}>
                              <td className="px-2 py-1 text-gray-500">{i + 1}</td>
                              {(['posicion', 'marca', 'medida', 'estado', 'sellos'] as const).map((field) => (
                                <td key={field} className="px-1 py-0.5">
                                  <input
                                    className="input w-full py-1 text-xs"
                                    value={row[field]}
                                    onChange={(e) =>
                                      setInspeccion((p) => {
                                        const ll = [...p.vehiculoEmpresarial.llantas];
                                        ll[i] = { ...ll[i], [field]: e.target.value };
                                        return { ...p, vehiculoEmpresarial: { ...p.vehiculoEmpresarial, llantas: ll } };
                                      })
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Descripción de daños detectados
                    </label>
                    <textarea
                      value={inspeccion.vehiculoEmpresarial.descripcionDanos}
                      onChange={(e) =>
                        setInspeccion((p) => ({
                          ...p,
                          vehiculoEmpresarial: { ...p.vehiculoEmpresarial, descripcionDanos: e.target.value },
                        }))
                      }
                      className="input min-h-[72px] w-full resize-y text-sm"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones generales</label>
                    <textarea
                      value={inspeccion.vehiculoEmpresarial.observacionesGenerales}
                      onChange={(e) =>
                        setInspeccion((p) => ({
                          ...p,
                          vehiculoEmpresarial: { ...p.vehiculoEmpresarial, observacionesGenerales: e.target.value },
                        }))
                      }
                      className="input min-h-[72px] w-full resize-y text-sm"
                      rows={3}
                    />
                  </div>
                </div>
              )}
              </FormSection>

              <FormSection
                step={4}
                title="Evidencia fotográfica y video"
                hint="Imágenes y videos cortos (recomendado MP4 / WebM). Máx. ~80 MB por archivo. Se pueden subir después de guardar el registro."
                icon="mdi:video-vintage"
              >
                <div className="rounded-xl border border-violet-100 bg-violet-50/35 p-3 sm:p-4">
                  <p className="mb-3 text-xs leading-relaxed text-slate-600">
                    Desde el móvil puedes adjuntar fotos o grabaciones (daños, placas, unidad, documentos). Los videos se
                    reproducen al pulsar play.
                  </p>
                {registroEditando && registroEditando.imagenes && registroEditando.imagenes.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-3">
                    {registroEditando.imagenes.map((img) => (
                      <EvidenciaMiniatura
                        key={img.id}
                        src={getImagenUrl(img.ruta)}
                        nombreMostrar={img.nombreArchivo}
                        esVideo={esNombreVideo(img.nombreArchivo)}
                        soloLectura={soloLectura}
                        onQuitar={() => quitarFotoGuardada(img.id)}
                      />
                    ))}
                  </div>
                )}
                {!soloLectura && (
                  <>
                    <label className="btn btn-outline inline-flex cursor-pointer items-center gap-2 text-sm">
                      <Icon icon="mdi:filmstrip-box-multiple" className="size-5" aria-hidden />
                      Añadir fotos o videos
                      <input
                        type="file"
                        accept="image/*,video/mp4,video/webm,video/quicktime,video/ogg"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          if (files.length) setFotosPendientes((prev) => [...prev, ...files]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {fotosPendientes.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {fotosPendientes.map((file, idx) => (
                          <div
                            key={`${file.name}-${file.size}-${idx}`}
                            className="w-28 shrink-0 overflow-hidden rounded-lg border border-skyline-border bg-white"
                          >
                            {esArchivoVideo(file) ? (
                              <video
                                src={fotosPendientesUrls[idx]}
                                className="h-24 w-full bg-black object-cover"
                                controls
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={fotosPendientesUrls[idx]}
                                alt=""
                                className="h-24 w-full object-cover"
                              />
                            )}
                            <div className="flex items-center justify-between gap-1 px-1 py-0.5">
                              <span className="truncate text-[10px] text-gray-600" title={file.name}>
                                {file.name}
                              </span>
                              <button
                                type="button"
                                className="shrink-0 text-[10px] text-red-600"
                                onClick={() =>
                                  setFotosPendientes((prev) => prev.filter((_, j) => j !== idx))
                                }
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                </div>
              </FormSection>

              <FormSection
                step={5}
                title="Documentación entregada y observaciones"
                hint="Constancia de los documentos que se entregan o se verifican en este check-in o check-out. El tercer ítem cambia según el tipo de movimiento."
                icon="mdi:file-document-multiple-outline"
              >
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">Documentos</p>
                <ul className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 sm:p-3">
                  {checklist.map((c) => (
                    <li
                      key={c.id}
                      className={`rounded-lg px-2 py-2 transition-colors ${c.presente ? 'bg-slate-50/80' : 'bg-amber-50/60'}`}
                    >
                      <label className="flex cursor-pointer items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={c.presente}
                          onChange={() => toggleCheck(c.id)}
                          className="mt-1 size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span
                          className={
                            c.presente ? 'font-medium text-slate-800' : 'text-amber-900 line-through opacity-90'
                          }
                        >
                          {c.label}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">Tip:</span> desmarca lo que no aplique o falte en la
                  entrega.
                </p>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-5">
                <label className="mb-1 block text-sm font-semibold text-slate-800">Observaciones libres</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="input min-h-[88px] w-full resize-y"
                  placeholder="Daños, faltantes, condiciones especiales, acuerdos con el cliente…"
                  rows={3}
                />
              </div>
              </FormSection>

              <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6">
                <button type="button" className="btn btn-outline" onClick={cerrarModal}>
                  Cerrar sin guardar
                </button>
                <button type="submit" className="btn btn-primary min-w-[140px] font-semibold shadow-md" disabled={enviando}>
                  {enviando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Registrar movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
