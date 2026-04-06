import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CRUD_CELDA_PRIMARIO,
  CRUD_CELDA_SEC,
  CRUD_CELDA_TAB,
  CRUD_ERROR_BANNER,
  CRUD_HEADER_ROW,
  CRUD_PAGE_SUBTITLE,
  CRUD_PAGE_TITLE,
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
import { useNotification } from '../context/NotificationContext';
import {
  getUnidades,
  createUnidad,
  updateUnidad,
  setEstatusUnidad,
  deleteDocumentoUnidad,
  addActividadUnidad,
  deleteUnidad,
  uploadImagenUnidad,
  deleteImagenUnidad,
  uploadUnidadExpedienteFoto,
  deleteUnidadExpedienteFoto,
  getDocumentoUrl,
  getImagenUrl,
  uploadDocumentoUnidad,
  type UnidadRow,
  type UnidadExpedienteFotoSlot,
} from '../api/client';
import { TIPOS_UNIDAD_OPCIONES, type TipoUnidadCatalogo } from '../lib/tipoUnidadCatalogo';

type Estatus = 'Disponible' | 'En Renta';
type Tab = 'expediente' | 'documentos' | 'imagenes' | 'historial';
type SubestatusDisponible = 'disponible' | 'taller' | 'almacen_exclusivo' | 'pendiente_placas';
type UbicacionDisponible = 'lote' | 'patio';

type DocTipo = 'Seguro' | 'Verificación' | 'Tarjeta' | 'Otro';
type RotuladaOpcion = 'sin_definir' | 'si' | 'no';

const defaultForm = {
  placas: '',
  numeroEconomico: '',
  marca: '',
  modelo: '',
  estatus: 'Disponible' as Estatus,
  numeroSerieCaja: '',
  tieneGps: false,
  gpsNumero1: '',
  gpsNumero2: '',
  subestatusDisponible: 'disponible' as SubestatusDisponible,
  ubicacionDisponible: 'lote' as UbicacionDisponible,
  observaciones: '',
  tipoUnidad: 'remolque_seco' as TipoUnidadCatalogo,
  gestorFisicoMecanica: '',
  unidadRotulada: 'sin_definir' as RotuladaOpcion,
  valorComercial: '',
  rentaMensual: '',
};

function rotuladaFormToApi(v: RotuladaOpcion): boolean | null {
  if (v === 'si') return true;
  if (v === 'no') return false;
  return null;
}

function rotuladaApiToForm(v: boolean | null | undefined): RotuladaOpcion {
  if (v === true) return 'si';
  if (v === false) return 'no';
  return 'sin_definir';
}

function textoRotulada(v: boolean | null | undefined): string {
  if (v === true) return 'Sí';
  if (v === false) return 'No';
  return 'Sin definir';
}

function parseMontoUnidadInput(s: string): { ok: true; value: number | null } | { ok: false; message: string } {
  const t = s
    .trim()
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '');
  if (!t) return { ok: true, value: null };
  const n = Number(t);
  if (!Number.isFinite(n)) return { ok: false, message: 'Importe inválido (usa solo números).' };
  if (n < 0) return { ok: false, message: 'El importe no puede ser negativo.' };
  return { ok: true, value: n };
}

function textoMontoUnidadTabla(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const EXPEDIENTE_FOTO_LABELS: Record<UnidadExpedienteFotoSlot, string> = {
  fm_anterior: 'Físico-mecánica (anterior)',
  fm_vigente: 'Físico-mecánica (vigente)',
  tarjeta_circulacion: 'Tarjeta de circulación',
};

function rutaPorExpedienteSlot(u: UnidadRow | null | undefined, slot: UnidadExpedienteFotoSlot): string {
  if (!u) return '';
  if (slot === 'fm_anterior') return (u.fmFotoAnteriorRuta ?? '').trim();
  if (slot === 'fm_vigente') return (u.fmFotoVigenteRuta ?? '').trim();
  return (u.tarjetaCirculacionRuta ?? '').trim();
}

const SUBESTATUS_LABEL: Record<SubestatusDisponible, string> = {
  disponible: 'Disponible',
  taller: 'En taller',
  almacen_exclusivo: 'Almacén exclusivo',
  pendiente_placas: 'Pendiente de placas',
};

const UBICACION_LABEL: Record<UbicacionDisponible, string> = {
  lote: 'Lote',
  patio: 'Patio',
};

/** Valores generados cuando en BD la serie quedó vacía (no son un formato de negocio). */
const SERIE_PLACEHOLDER_RE = /^(SIN-SERIE|PENDIENTE)-\d+$/;

function esSeriePlaceholder(serie: string | undefined): boolean {
  const s = String(serie ?? '').trim();
  return !s || SERIE_PLACEHOLDER_RE.test(s);
}

/** Texto en tablas y badges: si falta serie guardada, mensaje claro en lugar del código interno. */
function textoSerieCrud(serie: string | undefined): string {
  return esSeriePlaceholder(serie) ? 'Pendiente de capturar' : String(serie ?? '').trim();
}

/** Hay renta reservada o activa (el API rellena `clienteEnRenta` con esa subconsulta). */
function rentaVinculadaActiva(u: UnidadRow): boolean {
  return Boolean((u.clienteEnRenta ?? '').trim());
}

/** Estatus para listado/filtros: si hay renta vinculada se muestra En Renta aunque el campo en BD siga en Disponible. */
function estatusOperativoListado(u: UnidadRow): Estatus {
  if (u.estatus === 'En Renta') return 'En Renta';
  if (rentaVinculadaActiva(u)) return 'En Renta';
  return 'Disponible';
}

/** Chips discretos estilo corporativo (sin mayúsculas agresivas). */
function pillSiNo(active: boolean) {
  return active
    ? 'inline-flex items-center justify-center rounded border border-emerald-200/70 bg-emerald-50/90 px-2 py-0.5 text-[11px] font-medium text-emerald-900'
    : 'inline-flex items-center justify-center rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600';
}

function pillRotulada(v: boolean | null | undefined) {
  if (v === true) {
    return 'inline-flex items-center justify-center rounded border border-emerald-200/70 bg-emerald-50/90 px-2 py-0.5 text-[11px] font-medium text-emerald-900';
  }
  if (v === false) {
    return 'inline-flex items-center justify-center rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600';
  }
  return 'inline-flex items-center justify-center rounded border border-amber-200/80 bg-amber-50/80 px-2 py-0.5 text-[11px] font-medium text-amber-900';
}

function estatusCorporativoClass(e: Estatus) {
  if (e === 'Disponible') {
    return pillSiNo(true);
  }
  return 'inline-flex items-center justify-center rounded border border-[#2D58A7]/25 bg-[#2D58A7]/[0.08] px-2 py-0.5 text-[11px] font-medium text-[#24478a]';
}

function pillRotuladaText(v: boolean | null | undefined) {
  if (v === true) return 'Sí';
  if (v === false) return 'No';
  return 'Sin definir';
}

export function Unidades() {
  const [unidades, setUnidades] = useState<UnidadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<Estatus | 'Todos'>('Todos');
  const [filtroSubestatus, setFiltroSubestatus] = useState<SubestatusDisponible | 'todos'>('todos');
  const [filtroUbicacion, setFiltroUbicacion] = useState<UbicacionDisponible | 'todos'>('todos');
  const [filtroCliente, setFiltroCliente] = useState('todos');
  const [filtroGps, setFiltroGps] = useState<'todos' | 'con_gps' | 'sin_gps'>('todos');
  const [filtroRotulada, setFiltroRotulada] = useState<'todos' | 'si' | 'no' | 'sin_definir'>('todos');
  const [filtroGestor, setFiltroGestor] = useState<'todos' | 'con_gestor' | 'sin_gestor'>('todos');
  const [filtroFmAnterior, setFiltroFmAnterior] = useState<'todos' | 'con_foto' | 'sin_foto'>('todos');
  const [filtroFmVigente, setFiltroFmVigente] = useState<'todos' | 'con_foto' | 'sin_foto'>('todos');
  const [filtroTarjetaFoto, setFiltroTarjetaFoto] = useState<'todos' | 'con_foto' | 'sin_foto'>('todos');
  const [filtrosExtraOpen, setFiltrosExtraOpen] = useState(false);

  const filtrosExtraActivos = useMemo(() => {
    return (
      filtroSubestatus !== 'todos' ||
      filtroUbicacion !== 'todos' ||
      filtroCliente !== 'todos' ||
      filtroGps !== 'todos' ||
      filtroRotulada !== 'todos' ||
      filtroGestor !== 'todos' ||
      filtroFmAnterior !== 'todos' ||
      filtroFmVigente !== 'todos' ||
      filtroTarjetaFoto !== 'todos'
    );
  }, [
    filtroSubestatus,
    filtroUbicacion,
    filtroCliente,
    filtroGps,
    filtroRotulada,
    filtroGestor,
    filtroFmAnterior,
    filtroFmVigente,
    filtroTarjetaFoto,
  ]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('expediente');

  const [modalNueva, setModalNueva] = useState(false);
  const [formNueva, setFormNueva] = useState(defaultForm);
  const [savingNueva, setSavingNueva] = useState(false);

  const [modalEditar, setModalEditar] = useState(false);
  const [formEditar, setFormEditar] = useState(defaultForm);
  const [savingEditar, setSavingEditar] = useState(false);

  const [damageDesc, setDamageDesc] = useState('');
  const [newDoc, setNewDoc] = useState<{ tipo: DocTipo; file: File | null }>({ tipo: 'Otro', file: null });
  const [uploading, setUploading] = useState(false);

  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imgDesc, setImgDesc] = useState('');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [nuevaImagenes, setNuevaImagenes] = useState<File[]>([]);
  const [previewUnidadNueva, setPreviewUnidadNueva] = useState<UnidadRow | null>(null);
  const [expedienteArchivosNueva, setExpedienteArchivosNueva] = useState<{
    fmAnterior: File | null;
    fmVigente: File | null;
    tarjeta: File | null;
  }>({ fmAnterior: null, fmVigente: null, tarjeta: null });
  const [expedienteSlotUploading, setExpedienteSlotUploading] = useState<UnidadExpedienteFotoSlot | null>(null);

  const { toast } = useNotification();
  const selected = useMemo(
    () => unidades.find((u) => u.id === selectedId) ?? null,
    [unidades, selectedId]
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getUnidades()
      .then(setUnidades)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Estatus, number> = { Disponible: 0, 'En Renta': 0 };
    for (const u of unidades) {
      c[estatusOperativoListado(u)] += 1;
    }
    return c;
  }, [unidades]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unidades.filter((u) => {
      const op = estatusOperativoListado(u);
      const byStatus = filtro === 'Todos' ? true : op === filtro;
      const bySubestatus =
        filtroSubestatus === 'todos' ? true : (u.subestatusDisponible ?? 'disponible') === filtroSubestatus;
      const byUbicacion =
        filtroUbicacion === 'todos' ? true : (u.ubicacionDisponible ?? 'lote') === filtroUbicacion;
      const cliente = (u.clienteEnRenta ?? '').trim();
      const byCliente = filtroCliente === 'todos' ? true : cliente.toLowerCase() === filtroCliente.toLowerCase();
      const serieBusqueda = esSeriePlaceholder(u.numeroSerieCaja) ? 'pendiente' : (u.numeroSerieCaja ?? '');
      const ne = (u.numeroEconomico ?? '').trim();
      const gps1 = (u.gpsNumero1 ?? '').trim();
      const gps2 = (u.gpsNumero2 ?? '').trim();
      const gestor = (u.gestorFisicoMecanica ?? '').trim();
      const fmAnterior = (u.fmFotoAnteriorRuta ?? '').trim();
      const fmVigente = (u.fmFotoVigenteRuta ?? '').trim();
      const tarjeta = (u.tarjetaCirculacionRuta ?? '').trim();
      const byGps =
        filtroGps === 'todos'
          ? true
          : filtroGps === 'con_gps'
            ? !!u.tieneGps
            : !u.tieneGps;
      const byRotulada =
        filtroRotulada === 'todos'
          ? true
          : filtroRotulada === 'si'
            ? u.unidadRotulada === true
            : filtroRotulada === 'no'
              ? u.unidadRotulada === false
              : u.unidadRotulada == null;
      const byGestor =
        filtroGestor === 'todos'
          ? true
          : filtroGestor === 'con_gestor'
            ? !!gestor
            : !gestor;
      const byFmAnterior =
        filtroFmAnterior === 'todos'
          ? true
          : filtroFmAnterior === 'con_foto'
            ? !!fmAnterior
            : !fmAnterior;
      const byFmVigente =
        filtroFmVigente === 'todos'
          ? true
          : filtroFmVigente === 'con_foto'
            ? !!fmVigente
            : !fmVigente;
      const byTarjeta =
        filtroTarjetaFoto === 'todos'
          ? true
          : filtroTarjetaFoto === 'con_foto'
            ? !!tarjeta
            : !tarjeta;
      const byText = q
        ? [ne, u.placas, u.marca, u.modelo, serieBusqueda, cliente, gps1, gps2, gestor].some((x) =>
            x.toLowerCase().includes(q)
          )
        : true;
      const shouldApplyDisponibleFilters = filtro === 'Disponible' || filtro === 'Todos';
      const shouldApplyClienteFilter = filtro === 'En Renta' || filtro === 'Todos';
      return (
        byStatus &&
        byText &&
        byGps &&
        byRotulada &&
        byGestor &&
        byFmAnterior &&
        byFmVigente &&
        byTarjeta &&
        (shouldApplyDisponibleFilters ? bySubestatus && byUbicacion : true) &&
        (shouldApplyClienteFilter ? byCliente : true)
      );
    });
  }, [
    unidades,
    filtro,
    filtroSubestatus,
    filtroUbicacion,
    filtroCliente,
    filtroGps,
    filtroRotulada,
    filtroGestor,
    filtroFmAnterior,
    filtroFmVigente,
    filtroTarjetaFoto,
    search,
  ]);

  const clientesEnRenta = useMemo(() => {
    const set = new Set<string>();
    for (const u of unidades) {
      if (estatusOperativoListado(u) !== 'En Renta') continue;
      const c = (u.clienteEnRenta ?? '').trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es-MX'));
  }, [unidades]);

  function openDrawer(id: string, nextTab: Tab = 'expediente') {
    setSelectedId(id);
    setTab(nextTab);
    setDrawerOpen(true);
    setDamageDesc('');
    setNewDoc({ tipo: 'Otro', file: null });
    setLightboxImg(null);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function openNueva() {
    setFormNueva({ ...defaultForm });
    setNuevaImagenes([]);
    setExpedienteArchivosNueva({ fmAnterior: null, fmVigente: null, tarjeta: null });
    setModalNueva(true);
    setError(null);
  }

  function openEditar(u: UnidadRow) {
    setFormEditar({
      placas: u.placas,
      numeroEconomico: (u.numeroEconomico ?? '').trim(),
      marca: u.marca,
      modelo: u.modelo,
      estatus: u.estatus,
      numeroSerieCaja: esSeriePlaceholder(u.numeroSerieCaja) ? '' : (u.numeroSerieCaja || ''),
      tieneGps: !!u.tieneGps,
      gpsNumero1: (u.gpsNumero1 ?? '').trim(),
      gpsNumero2: (u.gpsNumero2 ?? '').trim(),
      subestatusDisponible: (u.subestatusDisponible ?? 'disponible') as SubestatusDisponible,
      ubicacionDisponible: (u.ubicacionDisponible ?? 'lote') as UbicacionDisponible,
      observaciones: u.observaciones || '',
      tipoUnidad: (u.tipoUnidad ?? 'remolque_seco') as TipoUnidadCatalogo,
      gestorFisicoMecanica: (u.gestorFisicoMecanica ?? '').trim(),
      unidadRotulada: rotuladaApiToForm(u.unidadRotulada),
      valorComercial: u.valorComercial != null ? String(u.valorComercial) : '',
      rentaMensual: u.rentaMensual != null ? String(u.rentaMensual) : '',
    });
    setModalEditar(true);
    setSelectedId(u.id);
    setError(null);
  }

  function handleCreateUnidad(e: React.FormEvent) {
    e.preventDefault();
    const vc = parseMontoUnidadInput(formNueva.valorComercial);
    const rm = parseMontoUnidadInput(formNueva.rentaMensual);
    if (!vc.ok) {
      setError(vc.message);
      toast(vc.message, 'error');
      return;
    }
    if (!rm.ok) {
      setError(rm.message);
      toast(rm.message, 'error');
      return;
    }
    setSavingNueva(true);
    setError(null);
    createUnidad({
      placas: formNueva.placas.trim(),
      numeroEconomico: formNueva.numeroEconomico.trim(),
      marca: formNueva.marca.trim(),
      modelo: formNueva.modelo.trim(),
      estatus: formNueva.estatus,
      numeroSerieCaja: formNueva.numeroSerieCaja.trim(),
      tieneGps: !!formNueva.tieneGps,
      gpsNumero1: formNueva.gpsNumero1.trim(),
      gpsNumero2: formNueva.gpsNumero2.trim(),
      subestatusDisponible: formNueva.subestatusDisponible,
      ubicacionDisponible: formNueva.ubicacionDisponible,
      observaciones: formNueva.observaciones.trim(),
      tipoUnidad: formNueva.tipoUnidad,
      gestorFisicoMecanica: formNueva.gestorFisicoMecanica.trim(),
      unidadRotulada: rotuladaFormToApi(formNueva.unidadRotulada),
      valorComercial: vc.value,
      rentaMensual: rm.value,
    })
      .then(async (u) => {
        let cur = u;
        if (expedienteArchivosNueva.fmAnterior) {
          cur = await uploadUnidadExpedienteFoto(cur.id, 'fm_anterior', expedienteArchivosNueva.fmAnterior);
        }
        if (expedienteArchivosNueva.fmVigente) {
          cur = await uploadUnidadExpedienteFoto(cur.id, 'fm_vigente', expedienteArchivosNueva.fmVigente);
        }
        if (expedienteArchivosNueva.tarjeta) {
          cur = await uploadUnidadExpedienteFoto(cur.id, 'tarjeta_circulacion', expedienteArchivosNueva.tarjeta);
        }
        if (nuevaImagenes.length > 0) {
          let updated = cur;
          for (const file of nuevaImagenes) {
            updated = await uploadImagenUnidad(updated.id, file, 'Registro inicial');
          }
          cur = updated;
        }
        toast('Unidad creada correctamente');
        load();
        setModalNueva(false);
        setPreviewUnidadNueva(cur);
        setNuevaImagenes([]);
        setExpedienteArchivosNueva({ fmAnterior: null, fmVigente: null, tarjeta: null });
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Error';
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => setSavingNueva(false));
  }

  function handleEditarUnidad(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    const vc = parseMontoUnidadInput(formEditar.valorComercial);
    const rm = parseMontoUnidadInput(formEditar.rentaMensual);
    if (!vc.ok) {
      setError(vc.message);
      toast(vc.message, 'error');
      return;
    }
    if (!rm.ok) {
      setError(rm.message);
      toast(rm.message, 'error');
      return;
    }
    setSavingEditar(true);
    setError(null);
    updateUnidad(selectedId, {
      placas: formEditar.placas.trim(),
      numeroEconomico: formEditar.numeroEconomico.trim(),
      marca: formEditar.marca.trim(),
      modelo: formEditar.modelo.trim(),
      estatus: formEditar.estatus,
      numeroSerieCaja: formEditar.numeroSerieCaja.trim(),
      tieneGps: !!formEditar.tieneGps,
      gpsNumero1: formEditar.gpsNumero1.trim(),
      gpsNumero2: formEditar.gpsNumero2.trim(),
      subestatusDisponible: formEditar.subestatusDisponible,
      ubicacionDisponible: formEditar.ubicacionDisponible,
      observaciones: formEditar.observaciones.trim(),
      tipoUnidad: formEditar.tipoUnidad,
      gestorFisicoMecanica: formEditar.gestorFisicoMecanica.trim(),
      unidadRotulada: rotuladaFormToApi(formEditar.unidadRotulada),
      valorComercial: vc.value,
      rentaMensual: rm.value,
    })
      .then((u) => {
        toast('Unidad actualizada');
        setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
        setModalEditar(false);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Error';
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => setSavingEditar(false));
  }

  const unidadEditarSnapshot = useMemo(
    () => (modalEditar && selectedId ? unidades.find((x) => x.id === selectedId) : null),
    [modalEditar, selectedId, unidades]
  );

  async function handleExpedienteFotoEdit(slot: UnidadExpedienteFotoSlot, file: File | null) {
    if (!file || !selectedId) return;
    setExpedienteSlotUploading(slot);
    try {
      const u = await uploadUnidadExpedienteFoto(selectedId, slot, file);
      setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
      toast('Foto del expediente guardada');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al subir', 'error');
    } finally {
      setExpedienteSlotUploading(null);
    }
  }

  async function handleExpedienteFotoEliminar(slot: UnidadExpedienteFotoSlot) {
    if (!selectedId) return;
    setExpedienteSlotUploading(slot);
    try {
      const u = await deleteUnidadExpedienteFoto(selectedId, slot);
      setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
      toast('Foto eliminada');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al eliminar', 'error');
    } finally {
      setExpedienteSlotUploading(null);
    }
  }

  function handleSetEstatus(id: string, next: Estatus) {
    setEstatusUnidad(id, next)
      .then((u) => {
        toast(`Estatus actualizado a ${next}`);
        setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error');
        toast(e instanceof Error ? e.message : 'Error', 'error');
      });
  }

  function handleUpdateObservaciones(id: string, obs: string) {
    updateUnidad(id, { observaciones: obs })
      .then((u) => setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x))))
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'));
  }

  function handleAddDamage() {
    if (!selected || !damageDesc.trim()) return;
    addActividadUnidad(selected.id, 'Daño / Observación registrada', damageDesc.trim(), 'mdi:alert-circle-outline')
      .then((u) => {
        toast('Observación registrada');
        setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
        setDamageDesc('');
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error');
        toast(e instanceof Error ? e.message : 'Error', 'error');
      });
  }

  async function handleAddDocument() {
    if (!selected) return;
    if (!newDoc.file) return;
    setUploading(true);
    setError(null);
    uploadDocumentoUnidad(selected.id, newDoc.tipo, newDoc.file)
      .then((u) => {
        toast('Documento subido');
        setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
        setNewDoc({ tipo: 'Otro', file: null });
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error');
        toast(e instanceof Error ? e.message : 'Error', 'error');
      })
      .finally(() => setUploading(false));
  }

  function handleDeleteDocument(docId: string) {
    if (!selected) return;
    setUploading(true);
    setError(null);
    deleteDocumentoUnidad(selected.id, docId)
      .then((u) => {
        toast('Documento eliminado');
        setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error');
        toast(e instanceof Error ? e.message : 'Error', 'error');
      })
      .finally(() => setUploading(false));
  }

  function handleUploadImagen(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selected || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploadingImg(true);
    setError(null);
    uploadImagenUnidad(selected.id, file, imgDesc.trim() || undefined)
      .then((u) => {
        toast('Imagen subida correctamente');
        setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
        setImgDesc('');
        e.target.value = '';
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error');
        toast(err instanceof Error ? err.message : 'Error', 'error');
      })
      .finally(() => setUploadingImg(false));
  }

  function handleDeleteImagen(imgId: string) {
    if (!selected) return;
    setError(null);
    deleteImagenUnidad(selected.id, imgId)
      .then((u) => {
        toast('Imagen eliminada');
        setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error');
        toast(err instanceof Error ? err.message : 'Error', 'error');
      });
  }

  function handleNuevaImagenesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setNuevaImagenes((prev) => [...prev, ...files].slice(0, 8));
    e.target.value = '';
  }

  function removeNuevaImagen(idx: number) {
    setNuevaImagenes((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleEliminarUnidad(id: string) {
    setError(null);
    deleteUnidad(id)
      .then(() => {
        toast('Unidad eliminada');
        load();
        setConfirmEliminar(null);
        if (selectedId === id) closeDrawer();
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error');
        toast(e instanceof Error ? e.message : 'Error', 'error');
      });
  }

  return (
    <div>
      <header className={CRUD_HEADER_ROW}>
        <div>
          <h1 className={CRUD_PAGE_TITLE}>Control de Unidades</h1>
          <p className={CRUD_PAGE_SUBTITLE}>
            Administra inventario, expedientes, documentos y estatus en tiempo real.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNueva}>
          <Icon icon="mdi:plus" className="size-5" aria-hidden />
          Nueva unidad
        </button>
      </header>

      {error && <div className={CRUD_ERROR_BANNER}>{error}</div>}

      {/* Toolbar — compacto; filtros detallados en panel plegable */}
      <div className={CRUD_TOOLBAR}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-3">
          <label className="min-w-0 flex-1 lg:max-w-md">
            <span className="text-xs font-medium text-gray-600">Buscar</span>
            <div className="mt-0.5 flex items-center gap-1.5 rounded-md border border-skyline-border bg-gray-50/80 px-2 transition-colors focus-within:border-skyline-blue focus-within:ring-1 focus-within:ring-skyline-blue">
              <Icon icon="mdi:magnify" className="size-4 shrink-0 text-skyline-muted" aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Núm. económico, placas, marca, modelo…"
                className="min-h-[2rem] w-full border-0 bg-transparent py-1 text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
            </div>
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500">Estatus</span>
            {(['Todos', 'Disponible', 'En Renta'] as const).map((opt) => {
              const isActive = filtro === opt;
              const count =
                opt === 'Todos' ? unidades.length : opt === 'Disponible' ? counts.Disponible : counts['En Renta'];
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFiltro(opt)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'border-skyline-blue bg-skyline-blue text-white shadow-sm'
                      : 'border-skyline-border bg-white text-gray-600 hover:border-skyline-blue hover:text-skyline-blue'
                  }`}
                >
                  {opt}{' '}
                  <span className={isActive ? 'font-bold text-white/95' : 'font-medium text-gray-400'}>({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-gray-600">
          <span className="font-semibold text-gray-900">
            {filtered.length} de {unidades.length}
          </span>{' '}
          unidades · Clic en una fila o en <span className="font-semibold text-gray-800">Expediente</span> para ver
          documentos.
        </p>

        <button
          type="button"
          onClick={() => setFiltrosExtraOpen((v) => !v)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-skyline-border bg-slate-50/80 px-2 py-1.5 text-xs font-semibold text-skyline-blue transition-colors hover:border-skyline-blue hover:bg-skyline-blue/5 sm:w-auto sm:justify-start"
        >
          <Icon icon={filtrosExtraOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'} className="size-4" aria-hidden />
          {filtrosExtraOpen ? 'Ocultar filtros adicionales' : 'Más filtros'}
          {filtrosExtraActivos ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
              Activos
            </span>
          ) : null}
        </button>

        {filtrosExtraOpen ? (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            <label className="text-xs font-medium text-gray-600">
              Disp.: subestatus
              <select
                value={filtroSubestatus}
                onChange={(e) => setFiltroSubestatus(e.target.value as SubestatusDisponible | 'todos')}
                className="mt-0.5 w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
              >
                <option value="todos">Todos</option>
                {(Object.keys(SUBESTATUS_LABEL) as SubestatusDisponible[]).map((k) => (
                  <option key={k} value={k}>
                    {SUBESTATUS_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Disp.: ubicación
              <select
                value={filtroUbicacion}
                onChange={(e) => setFiltroUbicacion(e.target.value as UbicacionDisponible | 'todos')}
                className="mt-0.5 w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
              >
                <option value="todos">Todas</option>
                {(Object.keys(UBICACION_LABEL) as UbicacionDisponible[]).map((k) => (
                  <option key={k} value={k}>
                    {UBICACION_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              En renta: cliente
              <select
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
              >
                <option value="todos">Todos</option>
                {clientesEnRenta.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              GPS
              <select
                value={filtroGps}
                onChange={(e) => setFiltroGps(e.target.value as 'todos' | 'con_gps' | 'sin_gps')}
                className="mt-0.5 w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
              >
                <option value="todos">Todos</option>
                <option value="con_gps">Con GPS</option>
                <option value="sin_gps">Sin GPS</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Rotulada
              <select
                value={filtroRotulada}
                onChange={(e) => setFiltroRotulada(e.target.value as 'todos' | 'si' | 'no' | 'sin_definir')}
                className="mt-0.5 w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
              >
                <option value="todos">Todas</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
                <option value="sin_definir">Sin definir</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Gestor FM
              <select
                value={filtroGestor}
                onChange={(e) => setFiltroGestor(e.target.value as 'todos' | 'con_gestor' | 'sin_gestor')}
                className="mt-0.5 w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
              >
                <option value="todos">Todos</option>
                <option value="con_gestor">Con gestor</option>
                <option value="sin_gestor">Sin gestor</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              FM anterior
              <select
                value={filtroFmAnterior}
                onChange={(e) => setFiltroFmAnterior(e.target.value as 'todos' | 'con_foto' | 'sin_foto')}
                className="mt-0.5 w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
              >
                <option value="todos">Todos</option>
                <option value="con_foto">Con foto</option>
                <option value="sin_foto">Sin foto</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              FM vigente
              <select
                value={filtroFmVigente}
                onChange={(e) => setFiltroFmVigente(e.target.value as 'todos' | 'con_foto' | 'sin_foto')}
                className="mt-0.5 w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
              >
                <option value="todos">Todos</option>
                <option value="con_foto">Con foto</option>
                <option value="sin_foto">Sin foto</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Tarjeta circulación
              <select
                value={filtroTarjetaFoto}
                onChange={(e) => setFiltroTarjetaFoto(e.target.value as 'todos' | 'con_foto' | 'sin_foto')}
                className="mt-0.5 w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
              >
                <option value="todos">Todos</option>
                <option value="con_foto">Con foto</option>
                <option value="sin_foto">Sin foto</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div className={CRUD_TABLE_OUTER}>
        {loading ? (
          <div className={CRUD_SPINNER_WRAP}>
            <div className={CRUD_SPINNER} />
          </div>
        ) : (
          <table className={`${CRUD_TABLE} min-w-[1280px]`}>
            <thead>
              <tr className={CRUD_THEAD_TR}>
                <CrudTableTh className="w-[4.5rem] px-2 py-3.5 align-middle" icon="mdi:image-outline">
                  Foto
                </CrudTableTh>
                <CrudTableTh className="w-[5.75rem] px-2 py-3.5 align-middle" icon="mdi:tag-outline">
                  No. econ.
                </CrudTableTh>
                <CrudTableTh className="w-[6.25rem] px-2 py-3.5 align-middle" icon="mdi:card-outline">
                  Placas
                </CrudTableTh>
                <CrudTableTh className="min-w-[5.5rem] px-2 py-3.5 align-middle" icon="mdi:domain">
                  Marca
                </CrudTableTh>
                <CrudTableTh className="min-w-[5.5rem] px-2 py-3.5 align-middle" icon="mdi:car-outline">
                  Modelo
                </CrudTableTh>
                <CrudTableTh className="min-w-[6.5rem] px-2 py-3.5 align-middle" icon="mdi:cash-multiple">
                  Valor comercial
                </CrudTableTh>
                <CrudTableTh className="min-w-[6.5rem] px-2 py-3.5 align-middle" icon="mdi:calendar-month-outline">
                  Renta / mes
                </CrudTableTh>
                <CrudTableTh
                  className="min-w-[7.5rem] max-w-[11rem] px-2 py-3.5 align-middle"
                  icon="mdi:barcode-scan"
                >
                  Serie caja
                </CrudTableTh>
                <CrudTableTh className="min-w-[7.5rem] px-2 py-3.5 align-middle" icon="mdi:bookmark-check-outline">
                  Estatus
                </CrudTableTh>
                <CrudTableTh
                  className="min-w-[11rem] px-2 py-3.5 align-middle"
                  icon="mdi:crosshairs-gps"
                  title="GPS, rotulado y gestor físico-mecánica"
                >
                  GPS · Rotul. · Gestor
                </CrudTableTh>
                <CrudTableTh className="min-w-[7.5rem] px-2 py-3.5 align-middle" icon="mdi:map-marker-outline">
                  Ubicación
                </CrudTableTh>
                <CrudTableTh className="w-[1%] whitespace-nowrap px-2 py-3.5 align-middle" icon="mdi:cog-outline">
                  Acciones
                </CrudTableTh>
              </tr>
            </thead>
            <tbody className={CRUD_TBODY}>
              {filtered.map((u, rowIdx) => {
                const estatusTabla = estatusOperativoListado(u);
                return (
                <tr
                  key={u.id}
                  className={crudTableRowClass(rowIdx, { clickable: true })}
                  onClick={() => openDrawer(u.id, 'expediente')}
                >
                  <td className="px-3 py-2.5 text-center align-middle">
                    <div className="flex justify-center">
                      {u.imagenes?.[0] ? (
                        <img
                          src={getImagenUrl(u.imagenes[0].ruta)}
                          alt={`Unidad ${u.placas}`}
                          className="size-11 rounded object-cover ring-1 ring-slate-200/90"
                        />
                      ) : (
                        <div className="flex size-11 items-center justify-center rounded bg-slate-100 text-slate-400 ring-1 ring-slate-200/80">
                          <Icon icon="mdi:image-off-outline" className="size-[18px]" aria-hidden />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    <span className={`block w-full ${CRUD_CELDA_PRIMARIO}`}>
                      {(u.numeroEconomico ?? '').trim() || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    <span className={`block w-full ${CRUD_CELDA_SEC}`}>{u.placas}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    <span className={`mx-auto line-clamp-2 max-w-[10rem] ${CRUD_CELDA_SEC}`} title={u.marca}>
                      {u.marca}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    <span className={`mx-auto line-clamp-2 max-w-[10rem] ${CRUD_CELDA_SEC}`} title={u.modelo}>
                      {u.modelo}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    <span
                      className={`block tabular-nums ${CRUD_CELDA_SEC}`}
                      title={textoMontoUnidadTabla(u.valorComercial)}
                    >
                      {textoMontoUnidadTabla(u.valorComercial)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    <span
                      className={`block tabular-nums ${CRUD_CELDA_SEC}`}
                      title={textoMontoUnidadTabla(u.rentaMensual)}
                    >
                      {textoMontoUnidadTabla(u.rentaMensual)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    <span
                      className={`mx-auto block max-w-[11rem] ${CRUD_CELDA_TAB}`}
                      title={textoSerieCrud(u.numeroSerieCaja)}
                    >
                      {textoSerieCrud(u.numeroSerieCaja)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className={estatusCorporativoClass(estatusTabla)}>{estatusTabla}</span>
                      {estatusTabla === 'Disponible' && (u.subestatusDisponible ?? 'disponible') !== 'disponible' ? (
                        <span className="inline-flex max-w-[11rem] justify-center rounded border border-slate-200/90 bg-white px-2 py-0.5 text-center text-[11px] font-medium leading-tight text-slate-600">
                          {SUBESTATUS_LABEL[u.subestatusDisponible ?? 'disponible']}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    <div className="mx-auto flex max-w-[15rem] flex-col items-center gap-2">
                      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">GPS</span>
                          <span className={pillSiNo(!!u.tieneGps)}>{u.tieneGps ? 'Sí' : 'No'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Rotul.</span>
                          <span className={pillRotulada(u.unidadRotulada)}>{pillRotuladaText(u.unidadRotulada)}</span>
                        </span>
                      </div>
                      {(u.gestorFisicoMecanica ?? '').trim() ? (
                        <div
                          className="w-full border-t border-slate-200/80 pt-2"
                          title={(u.gestorFisicoMecanica ?? '').trim()}
                        >
                          <p className="mb-1 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                            Gestor
                          </p>
                          <div className="flex flex-col items-center gap-1">
                            <Icon icon="mdi:account-tie-outline" className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                            <span className="break-words text-center text-[11px] font-medium leading-snug text-slate-600">
                              {(u.gestorFisicoMecanica ?? '').trim()}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    {estatusTabla === 'Disponible' ? (
                      <div className="flex justify-center">
                        <span className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[13px] font-medium text-slate-700 shadow-sm shadow-slate-900/[0.03]">
                          <Icon icon="mdi:map-marker-outline" className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                          {UBICACION_LABEL[u.ubicacionDisponible ?? 'lote']}
                        </span>
                      </div>
                    ) : (
                      <span className="block text-center text-[13px] font-medium leading-normal text-slate-300">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                    <CrudActionGroup aria-label="Acciones de la unidad">
                      <CrudActionIconButton
                        icon="mdi:folder-outline"
                        title="Expediente"
                        onClick={() => openDrawer(u.id, 'expediente')}
                      />
                      <CrudActionIconButton
                        icon="mdi:file-document-outline"
                        title="Documentos"
                        onClick={() => openDrawer(u.id, 'documentos')}
                      />
                      <CrudActionIconButton
                        icon="mdi:image-multiple-outline"
                        title="Imágenes"
                        onClick={() => openDrawer(u.id, 'imagenes')}
                      />
                      <CrudActionIconButton
                        icon="mdi:pencil-outline"
                        title="Editar datos"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditar(u);
                        }}
                      />
                    </CrudActionGroup>
                  </td>
                </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-sm text-gray-500">
                    {unidades.length === 0
                      ? 'No hay unidades. Haz clic en "Nueva unidad" para agregar la primera.'
                      : 'No hay unidades con esos filtros.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Nueva unidad */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !savingNueva && setModalNueva(false)}>
          <div
            className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl border border-skyline-border bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Nueva unidad</h2>
            <form onSubmit={handleCreateUnidad} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 md:col-span-2">
                Placas *
                <input
                  type="text"
                  value={formNueva.placas}
                  onChange={(e) => setFormNueva((f) => ({ ...f, placas: e.target.value.toUpperCase() }))}
                  placeholder="ABC-12-34"
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 md:col-span-2">
                Número económico *
                <input
                  type="text"
                  value={formNueva.numeroEconomico}
                  onChange={(e) => setFormNueva((f) => ({ ...f, numeroEconomico: e.target.value.toUpperCase() }))}
                  placeholder="Ej. 101, ECO-12, UN-045"
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  required
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  Identificador operativo único para ubicar la unidad rápido (independiente de las placas).
                </span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Marca *
                  <input
                    type="text"
                    value={formNueva.marca}
                    onChange={(e) => setFormNueva((f) => ({ ...f, marca: e.target.value }))}
                    placeholder="Toyota"
                    className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Modelo *
                  <input
                    type="text"
                    value={formNueva.modelo}
                    onChange={(e) => setFormNueva((f) => ({ ...f, modelo: e.target.value }))}
                    placeholder="Hilux"
                    className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    required
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 md:col-span-2">
                Tipo de unidad
                <select
                  value={formNueva.tipoUnidad}
                  onChange={(e) => setFormNueva((f) => ({ ...f, tipoUnidad: e.target.value as TipoUnidadCatalogo }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                >
                  {TIPOS_UNIDAD_OPCIONES.map((t) => (
                    <option key={t.v} value={t.v}>{t.l}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Valor comercial (MXN)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formNueva.valorComercial}
                    onChange={(e) => setFormNueva((f) => ({ ...f, valorComercial: e.target.value }))}
                    placeholder="Opcional, ej. 450000"
                    className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Renta mensual (MXN)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formNueva.rentaMensual}
                    onChange={(e) => setFormNueva((f) => ({ ...f, rentaMensual: e.target.value }))}
                    placeholder="Opcional, ej. 18500"
                    className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Estatus
                <select
                  value={formNueva.estatus}
                  onChange={(e) => setFormNueva((f) => ({ ...f, estatus: e.target.value as Estatus }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                >
                  {(['Disponible', 'En Renta'] as Estatus[]).map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Número de serie de la caja
                <input
                  type="text"
                  value={formNueva.numeroSerieCaja}
                  onChange={(e) => setFormNueva((f) => ({ ...f, numeroSerieCaja: e.target.value.toUpperCase() }))}
                  placeholder="Serie / VIN"
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  required
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  Sin formato fijo: letras, números y guiones según tu VIN o número de caja. Se guarda en mayúsculas.
                </span>
              </label>
              <div className="rounded-md border border-skyline-border p-3 md:col-span-2">
                <p className="text-sm font-medium text-gray-700">GPS</p>
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!formNueva.tieneGps}
                    onChange={(e) =>
                      setFormNueva((f) => ({
                        ...f,
                        tieneGps: e.target.checked,
                        gpsNumero1: e.target.checked ? f.gpsNumero1 : '',
                        gpsNumero2: e.target.checked ? f.gpsNumero2 : '',
                      }))
                    }
                  />
                  Esta unidad tiene GPS
                </label>
                {formNueva.tieneGps ? (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                      Núm. económico GPS 1
                      <input
                        type="text"
                        value={formNueva.gpsNumero1}
                        onChange={(e) => setFormNueva((f) => ({ ...f, gpsNumero1: e.target.value.toUpperCase() }))}
                        placeholder="Ej. GPS-001"
                        className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                      Núm. económico GPS 2 (opcional)
                      <input
                        type="text"
                        value={formNueva.gpsNumero2}
                        onChange={(e) => setFormNueva((f) => ({ ...f, gpsNumero2: e.target.value.toUpperCase() }))}
                        placeholder="Ej. GPS-002"
                        className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
              {formNueva.estatus === 'Disponible' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                    Subestatus disponible
                    <select
                      value={formNueva.subestatusDisponible}
                      onChange={(e) => setFormNueva((f) => ({ ...f, subestatusDisponible: e.target.value as SubestatusDisponible }))}
                      className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    >
                      {(Object.keys(SUBESTATUS_LABEL) as SubestatusDisponible[]).map((k) => (
                        <option key={k} value={k}>{SUBESTATUS_LABEL[k]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                    Ubicación
                    <select
                      value={formNueva.ubicacionDisponible}
                      onChange={(e) => setFormNueva((f) => ({ ...f, ubicacionDisponible: e.target.value as UbicacionDisponible }))}
                      className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    >
                      {(Object.keys(UBICACION_LABEL) as UbicacionDisponible[]).map((k) => (
                        <option key={k} value={k}>{UBICACION_LABEL[k]}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <div className="rounded-md border border-skyline-border bg-skyline-bg/40 p-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-gray-900">Físico-mecánica, tarjeta de circulación y rotulación</h3>
                <p className="mt-1 text-xs text-gray-600">
                  Registra el gestor del trámite, evidencia del FM anterior y del vigente, foto de la tarjeta y si la unidad está rotulada.
                </p>
                <label className="mt-3 flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Gestor (renovación físico-mecánica)
                  <input
                    type="text"
                    value={formNueva.gestorFisicoMecanica}
                    onChange={(e) => setFormNueva((f) => ({ ...f, gestorFisicoMecanica: e.target.value }))}
                    placeholder="Ej. nombre, proveedor o área interna"
                    className="rounded-md border border-skyline-border bg-white px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  />
                </label>
                <label className="mt-3 flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  ¿Unidad rotulada?
                  <select
                    value={formNueva.unidadRotulada}
                    onChange={(e) => setFormNueva((f) => ({ ...f, unidadRotulada: e.target.value as RotuladaOpcion }))}
                    className="rounded-md border border-skyline-border bg-white px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  >
                    <option value="sin_definir">Sin definir</option>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    {EXPEDIENTE_FOTO_LABELS.fm_anterior}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setExpedienteArchivosNueva((p) => ({ ...p, fmAnterior: f }));
                      }}
                      className="block w-full text-xs text-gray-600 file:mr-2 file:rounded-md file:border-0 file:bg-skyline-blue file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                    />
                    <div className="mt-1 flex items-center gap-2">
                      {expedienteArchivosNueva.fmAnterior ? (
                        <>
                          <span className="text-xs text-gray-600 truncate">{expedienteArchivosNueva.fmAnterior.name}</span>
                          <button
                            type="button"
                            className="shrink-0 text-xs text-red-600"
                            onClick={() => setExpedienteArchivosNueva((p) => ({ ...p, fmAnterior: null }))}
                          >
                            Quitar
                          </button>
                        </>
                      ) : null}
                    </div>
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    {EXPEDIENTE_FOTO_LABELS.fm_vigente}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setExpedienteArchivosNueva((p) => ({ ...p, fmVigente: f }));
                      }}
                      className="block w-full text-xs text-gray-600 file:mr-2 file:rounded-md file:border-0 file:bg-skyline-blue file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                    />
                    <div className="mt-1 flex items-center gap-2">
                      {expedienteArchivosNueva.fmVigente ? (
                        <>
                          <span className="text-xs text-gray-600 truncate">{expedienteArchivosNueva.fmVigente.name}</span>
                          <button
                            type="button"
                            className="shrink-0 text-xs text-red-600"
                            onClick={() => setExpedienteArchivosNueva((p) => ({ ...p, fmVigente: null }))}
                          >
                            Quitar
                          </button>
                        </>
                      ) : null}
                    </div>
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 sm:col-span-2">
                    {EXPEDIENTE_FOTO_LABELS.tarjeta_circulacion}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setExpedienteArchivosNueva((p) => ({ ...p, tarjeta: f }));
                      }}
                      className="block w-full text-xs text-gray-600 file:mr-2 file:rounded-md file:border-0 file:bg-skyline-blue file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                    />
                    <div className="mt-1 flex items-center gap-2">
                      {expedienteArchivosNueva.tarjeta ? (
                        <>
                          <span className="text-xs text-gray-600 truncate">{expedienteArchivosNueva.tarjeta.name}</span>
                          <button
                            type="button"
                            className="shrink-0 text-xs text-red-600"
                            onClick={() => setExpedienteArchivosNueva((p) => ({ ...p, tarjeta: null }))}
                          >
                            Quitar
                          </button>
                        </>
                      ) : null}
                    </div>
                  </label>
                </div>
              </div>
              <div className="rounded-md border border-skyline-border p-3 md:col-span-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Imágenes al registrar
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    onChange={handleNuevaImagenesChange}
                    className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-skyline-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:hover:bg-skyline-blue-hover"
                  />
                </label>
                {nuevaImagenes.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {nuevaImagenes.map((img, idx) => (
                      <div key={`${img.name}-${idx}`} className="rounded-md border border-skyline-border bg-skyline-bg px-2 py-1 text-xs">
                        <p className="truncate">{img.name}</p>
                        <button type="button" className="mt-1 text-red-600" onClick={() => removeNuevaImagen(idx)}>Quitar</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 md:col-span-2">
                Observaciones
                <textarea
                  value={formNueva.observaciones}
                  onChange={(e) => setFormNueva((f) => ({ ...f, observaciones: e.target.value }))}
                  placeholder="Notas iniciales..."
                  rows={2}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                />
              </label>
              <div className="mt-2 flex justify-end gap-2 md:col-span-2">
                <button type="button" className="btn btn-outline" onClick={() => setModalNueva(false)} disabled={savingNueva}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingNueva}>
                  {savingNueva ? 'Guardando…' : 'Crear unidad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar unidad */}
      {modalEditar && selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !savingEditar && setModalEditar(false)}>
          <div
            className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl border border-skyline-border bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Editar unidad</h2>
            <form onSubmit={handleEditarUnidad} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 md:col-span-2">
                Tipo de unidad
                <select
                  value={formEditar.tipoUnidad}
                  onChange={(e) => setFormEditar((f) => ({ ...f, tipoUnidad: e.target.value as TipoUnidadCatalogo }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                >
                  {TIPOS_UNIDAD_OPCIONES.map((t) => (
                    <option key={t.v} value={t.v}>{t.l}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Valor comercial (MXN)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formEditar.valorComercial}
                    onChange={(e) => setFormEditar((f) => ({ ...f, valorComercial: e.target.value }))}
                    placeholder="Opcional"
                    className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Renta mensual (MXN)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formEditar.rentaMensual}
                    onChange={(e) => setFormEditar((f) => ({ ...f, rentaMensual: e.target.value }))}
                    placeholder="Opcional"
                    className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 md:col-span-2">
                Placas *
                <input
                  type="text"
                  value={formEditar.placas}
                  onChange={(e) => setFormEditar((f) => ({ ...f, placas: e.target.value.toUpperCase() }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 md:col-span-2">
                Número económico *
                <input
                  type="text"
                  value={formEditar.numeroEconomico}
                  onChange={(e) => setFormEditar((f) => ({ ...f, numeroEconomico: e.target.value.toUpperCase() }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  required
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Marca *
                  <input
                    type="text"
                    value={formEditar.marca}
                    onChange={(e) => setFormEditar((f) => ({ ...f, marca: e.target.value }))}
                    className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Modelo *
                  <input
                    type="text"
                    value={formEditar.modelo}
                    onChange={(e) => setFormEditar((f) => ({ ...f, modelo: e.target.value }))}
                    className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    required
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Estatus
                <select
                  value={formEditar.estatus}
                  onChange={(e) => setFormEditar((f) => ({ ...f, estatus: e.target.value as Estatus }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                >
                  {(['Disponible', 'En Renta'] as Estatus[]).map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Número de serie de la caja
                <input
                  type="text"
                  value={formEditar.numeroSerieCaja}
                  onChange={(e) => setFormEditar((f) => ({ ...f, numeroSerieCaja: e.target.value.toUpperCase() }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  required
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  Mismo criterio que en el alta. Si antes aparecía «Pendiente», aquí va el número real de la caja.
                </span>
              </label>
              <div className="rounded-md border border-skyline-border p-3 md:col-span-2">
                <p className="text-sm font-medium text-gray-700">GPS</p>
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!formEditar.tieneGps}
                    onChange={(e) =>
                      setFormEditar((f) => ({
                        ...f,
                        tieneGps: e.target.checked,
                        gpsNumero1: e.target.checked ? f.gpsNumero1 : '',
                        gpsNumero2: e.target.checked ? f.gpsNumero2 : '',
                      }))
                    }
                  />
                  Esta unidad tiene GPS
                </label>
                {formEditar.tieneGps ? (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                      Núm. económico GPS 1
                      <input
                        type="text"
                        value={formEditar.gpsNumero1}
                        onChange={(e) => setFormEditar((f) => ({ ...f, gpsNumero1: e.target.value.toUpperCase() }))}
                        placeholder="Ej. GPS-001"
                        className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                      Núm. económico GPS 2 (opcional)
                      <input
                        type="text"
                        value={formEditar.gpsNumero2}
                        onChange={(e) => setFormEditar((f) => ({ ...f, gpsNumero2: e.target.value.toUpperCase() }))}
                        placeholder="Ej. GPS-002"
                        className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
              {formEditar.estatus === 'Disponible' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                    Subestatus disponible
                    <select
                      value={formEditar.subestatusDisponible}
                      onChange={(e) => setFormEditar((f) => ({ ...f, subestatusDisponible: e.target.value as SubestatusDisponible }))}
                      className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    >
                      {(Object.keys(SUBESTATUS_LABEL) as SubestatusDisponible[]).map((k) => (
                        <option key={k} value={k}>{SUBESTATUS_LABEL[k]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                    Ubicación
                    <select
                      value={formEditar.ubicacionDisponible}
                      onChange={(e) => setFormEditar((f) => ({ ...f, ubicacionDisponible: e.target.value as UbicacionDisponible }))}
                      className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    >
                      {(Object.keys(UBICACION_LABEL) as UbicacionDisponible[]).map((k) => (
                        <option key={k} value={k}>{UBICACION_LABEL[k]}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <div className="rounded-md border border-skyline-border bg-skyline-bg/40 p-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-gray-900">Físico-mecánica, tarjeta de circulación y rotulación</h3>
                <p className="mt-1 text-xs text-gray-600">
                  Los cambios de texto se guardan con «Guardar». Las fotos se suben al elegir archivo (reemplazan la anterior).
                </p>
                <label className="mt-3 flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Gestor (renovación físico-mecánica)
                  <input
                    type="text"
                    value={formEditar.gestorFisicoMecanica}
                    onChange={(e) => setFormEditar((f) => ({ ...f, gestorFisicoMecanica: e.target.value }))}
                    placeholder="Ej. nombre, proveedor o área interna"
                    className="rounded-md border border-skyline-border bg-white px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  />
                </label>
                <label className="mt-3 flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  ¿Unidad rotulada?
                  <select
                    value={formEditar.unidadRotulada}
                    onChange={(e) => setFormEditar((f) => ({ ...f, unidadRotulada: e.target.value as RotuladaOpcion }))}
                    className="rounded-md border border-skyline-border bg-white px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  >
                    <option value="sin_definir">Sin definir</option>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {(['fm_anterior', 'fm_vigente'] as const).map((slot) => {
                    const ruta = rutaPorExpedienteSlot(unidadEditarSnapshot, slot);
                    const busy = expedienteSlotUploading === slot;
                    return (
                      <div key={slot} className="rounded-md border border-skyline-border bg-white p-3">
                        <p className="text-sm font-medium text-gray-800">{EXPEDIENTE_FOTO_LABELS[slot]}</p>
                        {ruta ? (
                          <button
                            type="button"
                            onClick={() => setLightboxImg(getImagenUrl(ruta))}
                            className="mt-2 block w-full overflow-hidden rounded-md border border-skyline-border"
                          >
                            <img
                              src={getImagenUrl(ruta)}
                              alt=""
                              className="max-h-28 w-full object-cover"
                            />
                          </button>
                        ) : (
                          <p className="mt-2 text-xs text-gray-500">Sin foto</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <label className="text-xs font-semibold text-skyline-blue cursor-pointer">
                            {busy ? 'Subiendo…' : ruta ? 'Cambiar' : 'Subir'}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/gif,image/webp"
                              disabled={busy || savingEditar}
                              className="sr-only"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = '';
                                if (f) void handleExpedienteFotoEdit(slot, f);
                              }}
                            />
                          </label>
                          {ruta ? (
                            <button
                              type="button"
                              disabled={busy || savingEditar}
                              className="text-xs font-semibold text-red-600 disabled:opacity-50"
                              onClick={() => void handleExpedienteFotoEliminar(slot)}
                            >
                              Quitar
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  <div className="rounded-md border border-skyline-border bg-white p-3 sm:col-span-2">
                    <p className="text-sm font-medium text-gray-800">{EXPEDIENTE_FOTO_LABELS.tarjeta_circulacion}</p>
                    {(() => {
                      const slot = 'tarjeta_circulacion' as const;
                      const ruta = rutaPorExpedienteSlot(unidadEditarSnapshot, slot);
                      const busy = expedienteSlotUploading === slot;
                      return (
                        <>
                          {ruta ? (
                            <button
                              type="button"
                              onClick={() => setLightboxImg(getImagenUrl(ruta))}
                              className="mt-2 block w-full overflow-hidden rounded-md border border-skyline-border"
                            >
                              <img src={getImagenUrl(ruta)} alt="" className="max-h-36 w-full object-contain bg-gray-50" />
                            </button>
                          ) : (
                            <p className="mt-2 text-xs text-gray-500">Sin foto</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <label className="text-xs font-semibold text-skyline-blue cursor-pointer">
                              {busy ? 'Subiendo…' : ruta ? 'Cambiar' : 'Subir'}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                disabled={busy || savingEditar}
                                className="sr-only"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  e.target.value = '';
                                  if (f) void handleExpedienteFotoEdit(slot, f);
                                }}
                              />
                            </label>
                            {ruta ? (
                              <button
                                type="button"
                                disabled={busy || savingEditar}
                                className="text-xs font-semibold text-red-600 disabled:opacity-50"
                                onClick={() => void handleExpedienteFotoEliminar(slot)}
                              >
                                Quitar
                              </button>
                            ) : null}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 md:col-span-2">
                Observaciones
                <textarea
                  value={formEditar.observaciones}
                  onChange={(e) => setFormEditar((f) => ({ ...f, observaciones: e.target.value }))}
                  rows={2}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                />
              </label>
              <div className="mt-2 flex justify-end gap-2 md:col-span-2">
                <button type="button" className="btn btn-outline" onClick={() => setModalEditar(false)} disabled={savingEditar}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEditar}>
                  {savingEditar ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} />
          <div className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="border-b border-skyline-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-skyline-blue/10 text-skyline-blue">
                      <Icon icon="mdi:car-side" className="size-5" aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {(selected.numeroEconomico ?? '').trim()
                          ? `${(selected.numeroEconomico ?? '').trim()} · ${selected.placas}`
                          : `Unidad ${selected.placas}`}
                      </h2>
                      <p className="mt-0.5 text-sm font-medium text-gray-500">
                        {selected.marca} · {selected.modelo}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={estatusCorporativoClass(estatusOperativoListado(selected))}>
                      {estatusOperativoListado(selected)}
                    </span>
                    <span className="rounded-md border border-slate-200/80 bg-white px-2 py-1 text-center text-[13px] font-medium text-slate-700">
                      Serie: {textoSerieCrud(selected.numeroSerieCaja)}
                    </span>
                    <span className="rounded-md border border-slate-200/80 bg-white px-2 py-1 text-center text-[13px] font-medium text-slate-700">
                      Valor com.: {textoMontoUnidadTabla(selected.valorComercial)}
                    </span>
                    <span className="rounded-md border border-slate-200/80 bg-white px-2 py-1 text-center text-[13px] font-medium text-slate-700">
                      Renta / mes: {textoMontoUnidadTabla(selected.rentaMensual)}
                    </span>
                    <span className="rounded-md border border-slate-200/80 bg-white px-2 py-1 text-center text-[13px] font-medium text-slate-700">
                      GPS: {selected.tieneGps ? 'Sí' : 'No'}
                    </span>
                    {selected.tieneGps && (selected.gpsNumero1 || selected.gpsNumero2) ? (
                      <span className="rounded-md border border-slate-200/80 bg-white px-2 py-1 text-center text-[13px] font-medium text-slate-700">
                        GPS Econ.: {[selected.gpsNumero1, selected.gpsNumero2].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                    {estatusOperativoListado(selected) === 'Disponible' ? (
                      <>
                        <span className="rounded-md border border-slate-200/80 bg-white px-2 py-1 text-center text-[13px] font-medium text-slate-700">
                          {SUBESTATUS_LABEL[selected.subestatusDisponible ?? 'disponible']}
                        </span>
                        <span className="rounded-md border border-slate-200/80 bg-white px-2 py-1 text-center text-[13px] font-medium text-slate-700">
                          {UBICACION_LABEL[selected.ubicacionDisponible ?? 'lote']}
                        </span>
                      </>
                    ) : (
                      <span className="rounded-md border border-slate-200/80 bg-white px-2 py-1 text-center text-[13px] font-medium text-slate-700">
                        Cliente: {selected.clienteEnRenta || 'Sin cliente'}
                      </span>
                    )}
                  </div>
                </div>
                <CrudActionGroup aria-label="Acciones del panel">
                  <CrudActionIconButton icon="mdi:pencil-outline" title="Editar unidad" onClick={() => openEditar(selected)} />
                  <CrudActionIconButton
                    icon="mdi:delete-outline"
                    title="Eliminar unidad"
                    danger
                    onClick={() => setConfirmEliminar(selected.id)}
                  />
                  <CrudActionIconButton icon="mdi:close" title="Cerrar panel" onClick={closeDrawer} />
                </CrudActionGroup>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(
                  [
                    { k: 'expediente' as Tab, label: 'Expediente' },
                    { k: 'documentos' as Tab, label: 'Documentos' },
                    { k: 'imagenes' as Tab, label: 'Imágenes' },
                    { k: 'historial' as Tab, label: 'Historial' },
                  ]
                ).map((t) => {
                  const active = tab === t.k;
                  return (
                    <button
                      key={t.k}
                      type="button"
                      onClick={() => setTab(t.k)}
                      className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                        active ? 'bg-skyline-blue text-white' : 'bg-white text-gray-600 hover:bg-skyline-blue/5 hover:text-skyline-blue'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'expediente' && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-skyline-border bg-skyline-bg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-gray-900">Cambiar estatus</h3>
                      <span className="text-xs font-semibold uppercase tracking-wider text-skyline-muted">Acción rápida</span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(['Disponible', 'En Renta'] as Estatus[]).map((e) => {
                        const active = selected.estatus === e;
                        return (
                          <button
                            key={e}
                            type="button"
                            onClick={() => handleSetEstatus(selected.id, e)}
                            className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                              active
                                ? 'border-skyline-blue bg-skyline-blue/10 text-skyline-blue'
                                : 'border-skyline-border bg-white text-gray-700 hover:border-skyline-blue hover:text-skyline-blue'
                            }`}
                          >
                            {e}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Observaciones</h3>
                    <p className="mt-1 text-xs font-medium text-gray-500">Notas del expediente. Se guardan al salir del campo.</p>
                    <textarea
                      value={selected.observaciones}
                      onChange={(e) => {
                        const v = e.target.value;
                        setUnidades((prev) =>
                          prev.map((x) => (x.id === selected.id ? { ...x, observaciones: v } : x))
                        );
                      }}
                      onBlur={(e) => handleUpdateObservaciones(selected.id, e.target.value)}
                      className="mt-3 min-h-[90px] w-full resize-none rounded-md border border-skyline-border px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    />
                  </div>

                  <div className="rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Físico-mecánica y circulación</h3>
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      Gestor, rotulación y fotos se editan desde «Editar unidad».
                    </p>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500">Gestor</dt>
                        <dd className="font-medium text-gray-900 text-right">
                          {(selected.gestorFisicoMecanica ?? '').trim() || '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500">Rotulada</dt>
                        <dd className="font-medium text-gray-900">{textoRotulada(selected.unidadRotulada)}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {(['fm_anterior', 'fm_vigente', 'tarjeta_circulacion'] as const).map((slot) => {
                        const ruta = rutaPorExpedienteSlot(selected, slot);
                        return (
                          <div key={slot} className="rounded-md border border-skyline-border bg-skyline-bg/50 p-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                              {slot === 'tarjeta_circulacion' ? 'Tarjeta' : slot === 'fm_anterior' ? 'FM ant.' : 'FM vig.'}
                            </p>
                            {ruta ? (
                              <button
                                type="button"
                                onClick={() => setLightboxImg(getImagenUrl(ruta))}
                                className="mt-1 block w-full overflow-hidden rounded border border-skyline-border"
                              >
                                <img src={getImagenUrl(ruta)} alt="" className="h-16 w-full object-cover" />
                              </button>
                            ) : (
                              <p className="mt-1 text-xs text-gray-400">Sin foto</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Registrar daño / novedad</h3>
                    <p className="mt-1 text-xs font-medium text-gray-500">Agrega un evento al historial.</p>
                    <label className="mt-4 block text-sm font-medium text-gray-700">
                      Descripción
                      <textarea
                        value={damageDesc}
                        onChange={(e) => setDamageDesc(e.target.value)}
                        placeholder="Ej. Rayón en puerta trasera, se toma foto."
                        className="mt-2 min-h-[90px] w-full resize-none rounded-md border border-skyline-border px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                      />
                    </label>
                    <div className="mt-4 flex justify-end gap-2">
                      <button type="button" onClick={() => setDamageDesc('')} className="btn btn-outline">
                        Limpiar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddDamage}
                        disabled={!damageDesc.trim()}
                        className={`btn btn-primary ${!damageDesc.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Icon icon="mdi:plus" className="size-5" aria-hidden />
                        Registrar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'documentos' && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Agregar documento</h3>
                    <p className="mt-1 text-xs font-medium text-gray-500">Selecciona un archivo y súbelo al expediente de la unidad.</p>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                        Tipo
                        <select
                          value={newDoc.tipo}
                          onChange={(e) => setNewDoc((d) => ({ ...d, tipo: e.target.value as DocTipo }))}
                          className="rounded-md border border-skyline-border bg-white px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                        >
                          {(['Seguro', 'Verificación', 'Tarjeta', 'Otro'] as DocTipo[]).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                        Archivo
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
                          onChange={(e) => setNewDoc((d) => ({ ...d, file: e.target.files?.[0] || null }))}
                          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-skyline-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:hover:bg-skyline-blue-hover"
                        />
                        <span className="text-xs font-normal text-gray-500">
                          El nombre en el listado será el del archivo. Tipos habituales: PDF, imágenes, Word, Excel, PowerPoint o TXT (máx. 20 MB).
                        </span>
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button type="button" onClick={() => setNewDoc({ tipo: 'Otro', file: null })} className="btn btn-outline" disabled={uploading}>
                        Limpiar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddDocument}
                        disabled={uploading || !newDoc.file}
                        className={`btn btn-primary ${uploading || !newDoc.file ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {uploading ? 'Subiendo…' : (
                          <>
                            <Icon icon="mdi:upload" className="size-5" aria-hidden />
                            Agregar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-skyline-border bg-skyline-bg p-4">
                    <h3 className="text-sm font-semibold text-gray-900">Documentos registrados</h3>
                    <ul className="mt-3 space-y-2">
                      {selected.documentos.length === 0 && (
                        <li className="text-sm text-gray-500">No hay documentos.</li>
                      )}
                      {selected.documentos.map((d) => (
                        <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-skyline-border bg-white px-3 py-2">
                          <div className="min-w-0">
                            {d.ruta ? (
                              <a
                                href={getDocumentoUrl(d.ruta)}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate text-sm font-semibold text-skyline-blue hover:underline"
                                title="Abrir documento"
                              >
                                {d.nombre}
                              </a>
                            ) : (
                              <p className="truncate text-sm font-semibold text-gray-900">{d.nombre}</p>
                            )}
                            <p className="text-xs text-gray-500">{d.tipo}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-skyline-muted">
                              {new Date(d.fechaSubida).toLocaleDateString('es-MX')}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(d.id)}
                              className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                              disabled={uploading}
                            >
                              Borrar
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {tab === 'imagenes' && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Subir imagen</h3>
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      JPG, PNG, GIF o WebP. Máx. 10 MB. Ideal para inventario fotográfico, daños o estado general.
                    </p>
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                        Archivo
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={handleUploadImagen}
                          disabled={uploadingImg}
                          className="block w-full max-w-xs text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-skyline-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:hover:bg-skyline-blue-hover"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                        Descripción (opcional)
                        <input
                          type="text"
                          value={imgDesc}
                          onChange={(e) => setImgDesc(e.target.value)}
                          placeholder="Ej. Vista frontal, daño puerta"
                          className="w-48 rounded-md border border-skyline-border px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                        />
                      </label>
                      {uploadingImg && (
                        <span className="text-sm text-skyline-muted">Subiendo…</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-skyline-border bg-skyline-bg p-4">
                    <h3 className="text-sm font-semibold text-gray-900">Galería de imágenes</h3>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {(selected.imagenes ?? []).length === 0 ? (
                        <div className="col-span-full rounded-lg border-2 border-dashed border-skyline-border bg-white py-12 text-center text-sm text-gray-500">
                          No hay imágenes. Sube la primera para el inventario fotográfico.
                        </div>
                      ) : (
                        (selected.imagenes ?? []).map((img) => (
                          <div
                            key={img.id}
                            className="group relative overflow-hidden rounded-lg border border-skyline-border bg-white shadow-sm"
                          >
                            <button
                              type="button"
                              onClick={() => setLightboxImg(getImagenUrl(img.ruta))}
                              className="block w-full aspect-square overflow-hidden"
                            >
                              <img
                                src={getImagenUrl(img.ruta)}
                                alt={img.descripcion || img.nombreArchivo}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                            </button>
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                              <p className="truncate text-xs font-medium text-white">
                                {img.descripcion || img.nombreArchivo}
                              </p>
                              <p className="text-[10px] text-white/80">
                                {new Date(img.fechaSubida).toLocaleDateString('es-MX')}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteImagen(img.id)}
                              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
                              title="Eliminar imagen"
                            >
                              <Icon icon="mdi:close" className="size-4" aria-hidden />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'historial' && (
                <div className="rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900">Actividad</h3>
                  <p className="mt-1 text-xs font-medium text-gray-500">Registro de eventos del expediente.</p>
                  <ul className="mt-4 space-y-0 divide-y divide-skyline-border">
                    {selected.actividad.length === 0 ? (
                      <li className="py-6 text-center text-sm text-gray-500">Sin actividad aún.</li>
                    ) : (
                      selected.actividad.map((a) => (
                        <li key={a.id} className="flex gap-3 py-4">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-skyline-blue/10 text-skyline-blue">
                            <Icon icon={a.icon} className="size-4" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">{a.accion}</p>
                            <p className="mt-0.5 text-xs text-gray-500">{a.detalle}</p>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-skyline-muted">
                            {new Date(a.fecha).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {previewUnidadNueva && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-skyline-border bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Vista previa de la nueva unidad</h3>
            <p className="mt-1 text-sm text-gray-500">Revisa los datos antes de entrar al expediente completo.</p>
            <div className="mt-4 rounded-lg border border-skyline-border bg-skyline-bg p-4">
              <p className="text-base font-semibold text-gray-900">
                {(previewUnidadNueva.numeroEconomico ?? '').trim()
                  ? `${(previewUnidadNueva.numeroEconomico ?? '').trim()} · ${previewUnidadNueva.placas} · ${previewUnidadNueva.marca} ${previewUnidadNueva.modelo}`
                  : `${previewUnidadNueva.placas} · ${previewUnidadNueva.marca} ${previewUnidadNueva.modelo}`}
              </p>
              <p className="mt-1 text-sm text-gray-600">Serie: {textoSerieCrud(previewUnidadNueva.numeroSerieCaja)}</p>
              <p className="mt-1 text-sm text-gray-600">
                Valor comercial: {textoMontoUnidadTabla(previewUnidadNueva.valorComercial)} · Renta mensual:{' '}
                {textoMontoUnidadTabla(previewUnidadNueva.rentaMensual)}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                GPS: {previewUnidadNueva.tieneGps ? 'Sí' : 'No'}
                {previewUnidadNueva.tieneGps
                  ? ` · ${[previewUnidadNueva.gpsNumero1, previewUnidadNueva.gpsNumero2].filter(Boolean).join(' · ') || 'Sin número capturado'}`
                  : ''}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Estatus: {previewUnidadNueva.estatus}
                {previewUnidadNueva.estatus === 'Disponible'
                  ? ` · ${SUBESTATUS_LABEL[previewUnidadNueva.subestatusDisponible ?? 'disponible']} · ${UBICACION_LABEL[previewUnidadNueva.ubicacionDisponible ?? 'lote']}`
                  : ` · Cliente: ${previewUnidadNueva.clienteEnRenta || 'Sin cliente'}`}
              </p>
              {(previewUnidadNueva.imagenes ?? []).length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(previewUnidadNueva.imagenes ?? []).slice(0, 3).map((img) => (
                    <img
                      key={img.id}
                      src={getImagenUrl(img.ruta)}
                      alt={img.descripcion || img.nombreArchivo}
                      className="aspect-square w-full rounded-md object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setPreviewUnidadNueva(null)}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const id = previewUnidadNueva.id;
                  setPreviewUnidadNueva(null);
                  openDrawer(id, 'expediente');
                }}
              >
                Ver expediente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox imagen */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxImg(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImg(null)}
            className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Cerrar"
          >
            <Icon icon="mdi:close" className="size-6" aria-hidden />
          </button>
          <img
            src={lightboxImg}
            alt="Vista ampliada"
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Confirmar eliminar */}
      {confirmEliminar && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-skyline-border bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">¿Eliminar unidad?</h3>
            <p className="mt-2 text-sm text-gray-600">
              La unidad se desactivará y dejará de aparecer en el inventario. Esta acción no se puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmEliminar(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-outline-danger" onClick={() => handleEliminarUnidad(confirmEliminar)}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
