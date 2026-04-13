import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  getMulitaGastosSemanaApi,
  getMulitaGastosHistorialUnidadApi,
  upsertMulitaGastoSemanaApi,
  getMulitaGastosMantenimientoUnidadApi,
  createMulitaGastoMantenimientoApi,
  deleteMulitaGastoMantenimientoApi,
  getMulitaEvidenciasApi,
  uploadMulitaEvidenciaApi,
  deleteMulitaEvidenciaApi,
  getMantenimientosUnidad,
  type MulitaGastoSemanalRow,
  type MulitaGastoMantenimientoRow,
  type MulitaEvidenciaRow,
  type MulitaExtraOperacionLinea,
  type MulitaHorasExtraLinea,
  type MantenimientoRow,
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
type PendientePlacasMotivo = 'baja_placas' | 'pendiente_importar';

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
  pendientePlacasMotivo: '' as '' | PendientePlacasMotivo,
  placaFederal: false,
  placaLocal: false,
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

function lunesSemanaISO(base: Date = new Date()): string {
  const d = new Date(base);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function moverDiasISO(iso: string, dias: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Lunes a domingo de la semana de gasto (etiquetas cortas). */
function diasSemanaMulitaDesdeLunes(lunesISO: string): { iso: string; label: string }[] {
  const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
  return labels.map((label, i) => ({ iso: moverDiasISO(lunesISO, i), label }));
}

function resumenFaltasMulitaHistorial(faltas: string[] | undefined): string {
  if (!faltas?.length) return 'Ninguna';
  const sorted = [...faltas].sort();
  return sorted.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`).join(', ');
}

type MulitaLineaHorasExtraForm = { fecha: string; horas: string; precioPorHora: string };

function nuevaLineaHorasExtra(fechaDefault: string): MulitaLineaHorasExtraForm {
  return { fecha: fechaDefault, horas: '', precioPorHora: '' };
}

function horasExtrasLineasFormDesdeApi(r: MulitaGastoSemanalRow, lunesSemana: string): MulitaLineaHorasExtraForm[] {
  if (r.horasExtrasLineas?.length) {
    return r.horasExtrasLineas.map((x) => ({
      fecha: x.fecha,
      horas: String(x.horas),
      precioPorHora: String(x.precioPorHora),
    }));
  }
  if (r.horasExtras != null && r.horasExtras > 0) {
    return [{ fecha: lunesSemana, horas: '1', precioPorHora: String(r.horasExtras) }];
  }
  return [nuevaLineaHorasExtra(lunesSemana)];
}

function diasIsoSemanaDesdeLunes(lunesISO: string): string[] {
  return diasSemanaMulitaDesdeLunes(lunesISO).map((d) => d.iso);
}

function validarYLineasHorasExtrasApi(
  lineas: MulitaLineaHorasExtraForm[],
  lunesSemana: string
): { ok: false; message: string } | { ok: true; payload: MulitaHorasExtraLinea[] } {
  const permitidos = new Set(diasIsoSemanaDesdeLunes(lunesSemana));
  const payload: MulitaHorasExtraLinea[] = [];
  for (const ln of lineas) {
    const fecha = ln.fecha.trim();
    const ht = ln.horas.trim().replace(/,/g, '.');
    const ph = ln.precioPorHora.trim();
    if (!fecha && !ht && !ph) continue;
    if (!fecha || !permitidos.has(fecha)) {
      return {
        ok: false,
        message: 'Horas extras: cada línea con datos debe tener una fecha de la semana seleccionada (lun–dom).',
      };
    }
    const horas = parseFloat(ht);
    if (!Number.isFinite(horas) || horas <= 0) {
      return { ok: false, message: 'Horas extras: indica un número de horas mayor a 0.' };
    }
    const pm = parseMontoUnidadInput(ln.precioPorHora);
    if (!pm.ok || pm.value == null) {
      return { ok: false, message: 'Horas extras: indica un precio por hora válido (MXN).' };
    }
    payload.push({ fecha, horas, precioPorHora: pm.value });
  }
  return { ok: true, payload };
}

function sumaHorasExtrasMxnPreview(lineas: MulitaLineaHorasExtraForm[], lunesSemana: string): number | null {
  const v = validarYLineasHorasExtrasApi(lineas, lunesSemana);
  if (!v.ok) return null;
  let s = 0;
  for (const x of v.payload) {
    s += x.horas * x.precioPorHora;
  }
  return Math.round(s * 100) / 100;
}

function textoResumenHorasExtrasHistorial(r: MulitaGastoSemanalRow): string {
  const lineas = r.horasExtrasLineas ?? [];
  if (!lineas.length) return '—';
  return lineas
    .map(
      (l) =>
        `${l.fecha.slice(8, 10)}/${l.fecha.slice(5, 7)}: ${l.horas}h × ${l.precioPorHora.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
    )
    .join(' · ');
}

type MulitaLineaExtrasOpForm = { fecha: string; concepto: string; cantidad: string };

function nuevaLineaExtrasOp(fechaDefault: string): MulitaLineaExtrasOpForm {
  return { fecha: fechaDefault, concepto: '', cantidad: '' };
}

type MulitaSemanalEd = {
  nomina: string;
  horasExtrasLineas: MulitaLineaHorasExtraForm[];
  extrasOperacionesLineas: MulitaLineaExtrasOpForm[];
  gastosFijosLineas: MulitaLineaExtrasOpForm[];
  diesel: string;
  bonoPuntualidad: string;
  faltasDias: string[];
};

function defaultMulitaSemanalEd(lunesSemana: string): MulitaSemanalEd {
  return {
    nomina: '',
    horasExtrasLineas: [nuevaLineaHorasExtra(lunesSemana)],
    extrasOperacionesLineas: [nuevaLineaExtrasOp(lunesSemana)],
    gastosFijosLineas: [nuevaLineaExtrasOp(lunesSemana)],
    diesel: '',
    bonoPuntualidad: '',
    faltasDias: [],
  };
}

/** Tabla compacta mulitas + drawer: operador/cliente sin renta vinculada. */
const MULITA_TEXTO_SIN_OPERADOR_CLIENTE = 'Aún no tiene vinculado uno';

function extrasOperacionesLineasFormDesdeApi(r: MulitaGastoSemanalRow, lunesSemana: string): MulitaLineaExtrasOpForm[] {
  if (r.extrasOperacionesLineas?.length) {
    return r.extrasOperacionesLineas.map((x) => ({
      fecha: x.fecha,
      concepto: x.concepto,
      cantidad: String(x.cantidad),
    }));
  }
  return [nuevaLineaExtrasOp(lunesSemana)];
}

function gastosFijosLineasFormDesdeApi(r: MulitaGastoSemanalRow, lunesSemana: string): MulitaLineaExtrasOpForm[] {
  if (r.gastosFijosLineas?.length) {
    return r.gastosFijosLineas.map((x) => ({
      fecha: x.fecha,
      concepto: x.concepto,
      cantidad: String(x.cantidad),
    }));
  }
  if (r.gastosFijosMonto != null && r.gastosFijosMonto > 0) {
    return [{ fecha: lunesSemana, concepto: 'Importe previo', cantidad: String(r.gastosFijosMonto) }];
  }
  return [nuevaLineaExtrasOp(lunesSemana)];
}

function validarYExtrasOperacionesApi(
  lineas: MulitaLineaExtrasOpForm[],
  lunesSemana: string
): { ok: false; message: string } | { ok: true; payload: MulitaExtraOperacionLinea[] } {
  const permitidos = new Set(diasIsoSemanaDesdeLunes(lunesSemana));
  const payload: MulitaExtraOperacionLinea[] = [];
  for (const ln of lineas) {
    const fecha = ln.fecha.trim();
    const concepto = ln.concepto.trim().slice(0, 200);
    const ct = ln.cantidad.trim();
    if (!fecha && !concepto && !ct) continue;
    if (!fecha || !permitidos.has(fecha)) {
      return {
        ok: false,
        message: 'Extras operaciones: cada línea con datos debe tener fecha de la semana (lun–dom).',
      };
    }
    if (!concepto) {
      return { ok: false, message: 'Extras operaciones: indica el concepto en cada línea con importe.' };
    }
    const pm = parseMontoUnidadInput(ln.cantidad);
    if (!pm.ok || pm.value == null) {
      return { ok: false, message: 'Extras operaciones: indica cantidad (MXN) válida en cada línea.' };
    }
    payload.push({ fecha, concepto, cantidad: pm.value });
  }
  return { ok: true, payload };
}

function sumaExtrasOperacionesPreview(lineas: MulitaLineaExtrasOpForm[], lunesSemana: string): number | null {
  const v = validarYExtrasOperacionesApi(lineas, lunesSemana);
  if (!v.ok) return null;
  let s = 0;
  for (const x of v.payload) {
    s += x.cantidad;
  }
  return Math.round(s * 100) / 100;
}

function validarYGastosFijosApi(
  lineas: MulitaLineaExtrasOpForm[],
  lunesSemana: string
): { ok: false; message: string } | { ok: true; payload: MulitaExtraOperacionLinea[] } {
  const permitidos = new Set(diasIsoSemanaDesdeLunes(lunesSemana));
  const payload: MulitaExtraOperacionLinea[] = [];
  for (const ln of lineas) {
    const fecha = ln.fecha.trim();
    const concepto = ln.concepto.trim().slice(0, 200);
    const ct = ln.cantidad.trim();
    if (!fecha && !concepto && !ct) continue;
    if (!fecha || !permitidos.has(fecha)) {
      return {
        ok: false,
        message: 'Gastos fijos: cada línea con datos debe tener fecha de la semana (lun–dom).',
      };
    }
    if (!concepto) {
      return { ok: false, message: 'Gastos fijos: indica el concepto en cada línea con importe.' };
    }
    const pm = parseMontoUnidadInput(ln.cantidad);
    if (!pm.ok || pm.value == null) {
      return { ok: false, message: 'Gastos fijos: indica cantidad (MXN) válida en cada línea.' };
    }
    payload.push({ fecha, concepto, cantidad: pm.value });
  }
  return { ok: true, payload };
}

function sumaGastosFijosPreview(lineas: MulitaLineaExtrasOpForm[], lunesSemana: string): number | null {
  const v = validarYGastosFijosApi(lineas, lunesSemana);
  if (!v.ok) return null;
  let s = 0;
  for (const x of v.payload) {
    s += x.cantidad;
  }
  return Math.round(s * 100) / 100;
}

function textoResumenExtrasOpHistorial(r: MulitaGastoSemanalRow): string {
  const lineas = r.extrasOperacionesLineas ?? [];
  if (!lineas.length) return '—';
  return lineas
    .map(
      (l) =>
        `${l.fecha.slice(8, 10)}/${l.fecha.slice(5, 7)}: ${l.concepto.slice(0, 24)}${l.concepto.length > 24 ? '…' : ''} · $${l.cantidad.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
    )
    .join(' · ');
}

function textoResumenGastosFijosHistorial(r: MulitaGastoSemanalRow): string {
  const lineas = r.gastosFijosLineas ?? [];
  if (!lineas.length) return '—';
  return lineas
    .map(
      (l) =>
        `${l.fecha.slice(8, 10)}/${l.fecha.slice(5, 7)}: ${l.concepto.slice(0, 24)}${l.concepto.length > 24 ? '…' : ''} · $${l.cantidad.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
    )
    .join(' · ');
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

const PENDIENTE_PLACAS_MOTIVO_LABEL: Record<PendientePlacasMotivo, string> = {
  baja_placas: 'Baja de placas',
  pendiente_importar: 'Pendiente por importar',
};

function textoTipoPlacaTabla(u: Pick<UnidadRow, 'placaFederal' | 'placaLocal'>): string {
  const f = !!u.placaFederal;
  const l = !!u.placaLocal;
  if (f && l) return 'Fed. · Loc.';
  if (f) return 'Federal';
  if (l) return 'Local';
  return '—';
}

function TipoPlacaSelector({
  placaFederal,
  placaLocal,
  onChange,
}: {
  placaFederal: boolean;
  placaLocal: boolean;
  onChange: (next: { placaFederal: boolean; placaLocal: boolean }) => void;
}) {
  const chipCls = (active: boolean) =>
    `flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
      active
        ? 'border-skyline-blue bg-skyline-blue/10 text-[#24478a] shadow-sm ring-1 ring-skyline-blue/20'
        : 'border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/80'
    }`;
  return (
    <div className="mt-3 rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50/90 via-white to-skyline-blue/[0.04] p-3 shadow-sm shadow-slate-900/[0.02]">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de placa</p>
      <p className="mt-0.5 text-[11px] text-slate-500">Marcación federal y/o local según aplique.</p>
      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
        <label className={chipCls(placaFederal)}>
          <input
            type="checkbox"
            checked={placaFederal}
            onChange={(e) => onChange({ placaFederal: e.target.checked, placaLocal })}
            className="size-4 shrink-0 rounded border-slate-300 text-skyline-blue focus:ring-skyline-blue"
          />
          <Icon icon="mdi:road-variant" className="size-5 shrink-0 text-skyline-blue/80" aria-hidden />
          <span>Federal</span>
        </label>
        <label className={chipCls(placaLocal)}>
          <input
            type="checkbox"
            checked={placaLocal}
            onChange={(e) => onChange({ placaFederal, placaLocal: e.target.checked })}
            className="size-4 shrink-0 rounded border-slate-300 text-skyline-blue focus:ring-skyline-blue"
          />
          <Icon icon="mdi:map-marker-radius" className="size-5 shrink-0 text-skyline-blue/80" aria-hidden />
          <span>Local / estatal</span>
        </label>
      </div>
    </div>
  );
}

function PendientePlacasMotivoSelector({
  value,
  onChange,
}: {
  value: '' | PendientePlacasMotivo;
  onChange: (v: PendientePlacasMotivo) => void;
}) {
  const options: { id: PendientePlacasMotivo; icon: string; hint: string }[] = [
    { id: 'baja_placas', icon: 'mdi:card-off-outline', hint: 'Trámite de baja ante autoridad' },
    { id: 'pendiente_importar', icon: 'mdi:ferry', hint: 'Unidad o placas en proceso de importación' },
  ];
  return (
    <div className="rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/60 to-white p-4 shadow-sm shadow-amber-900/[0.04] md:col-span-2">
      <div className="flex items-start gap-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100/90 text-amber-800">
          <Icon icon="mdi:alert-decagram-outline" className="size-5" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Motivo de pendiente de placas</p>
          <p className="mt-0.5 text-xs text-gray-600">Requerido mientras el subestatus sea «Pendiente de placas».</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const sel = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`flex w-full flex-col items-start rounded-xl border px-4 py-3 text-left transition-all ${
                sel
                  ? 'border-skyline-blue bg-skyline-blue/10 ring-2 ring-skyline-blue/25'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
              }`}
            >
              <span className="flex items-center gap-2 font-semibold text-gray-900">
                <Icon icon={o.icon} className={`size-5 ${sel ? 'text-skyline-blue' : 'text-slate-500'}`} aria-hidden />
                {PENDIENTE_PLACAS_MOTIVO_LABEL[o.id]}
              </span>
              <span className="mt-1 text-xs text-gray-500">{o.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const [filtroTipoUnidad, setFiltroTipoUnidad] = useState<TipoUnidadCatalogo | 'todos'>('todos');
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
      filtroTipoUnidad !== 'todos' ||
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
    filtroTipoUnidad,
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

  const [panelMulitasOpen, setPanelMulitasOpen] = useState(false);
  const [mulitaSemanaInicio, setMulitaSemanaInicio] = useState(lunesSemanaISO());
  const [mulitaEdits, setMulitaEdits] = useState<Record<string, MulitaSemanalEd>>({});
  const [mulitaSavingId, setMulitaSavingId] = useState<string | null>(null);
  const [mulitaLoadingSemana, setMulitaLoadingSemana] = useState(false);
  const [mulitaEditorUnidadId, setMulitaEditorUnidadId] = useState<string | null>(null);
  const [mulitaHistorialUnidadId, setMulitaHistorialUnidadId] = useState<string>('');
  const [mulitaHistorialRows, setMulitaHistorialRows] = useState<MulitaGastoSemanalRow[]>([]);
  const [mulitaHistorialLoading, setMulitaHistorialLoading] = useState(false);
  const [mulitaDrawerMantGastos, setMulitaDrawerMantGastos] = useState<MulitaGastoMantenimientoRow[]>([]);
  const [mulitaDrawerMantenimientos, setMulitaDrawerMantenimientos] = useState<MantenimientoRow[]>([]);
  const [mulitaDrawerEvidencias, setMulitaDrawerEvidencias] = useState<MulitaEvidenciaRow[]>([]);
  const [mulitaDrawerAuxLoading, setMulitaDrawerAuxLoading] = useState(false);
  const [mulitaMantNuevo, setMulitaMantNuevo] = useState({
    mantenimientoId: '',
    fecha: '',
    concepto: '',
    cantidad: '',
  });
  const [mulitaMantSaving, setMulitaMantSaving] = useState(false);
  const [mulitaEvidenciaUploading, setMulitaEvidenciaUploading] = useState(false);

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
      const tipoUnidadActual = (u.tipoUnidad ?? 'remolque_seco') as TipoUnidadCatalogo;
      const byTipoUnidad = filtroTipoUnidad === 'todos' ? true : tipoUnidadActual === filtroTipoUnidad;
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
        byTipoUnidad &&
        (shouldApplyDisponibleFilters ? bySubestatus && byUbicacion : true) &&
        (shouldApplyClienteFilter ? byCliente : true)
      );
    });
  }, [
    unidades,
    filtro,
    filtroSubestatus,
    filtroUbicacion,
    filtroTipoUnidad,
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

  const unidadesMulitas = useMemo(
    () => unidades.filter((u) => (u.tipoUnidad ?? 'remolque_seco') === 'maquinaria'),
    [unidades]
  );

  const mulitasOrdenadas = useMemo(() => {
    return [...unidadesMulitas].sort((a, b) =>
      (a.numeroEconomico ?? '').localeCompare(b.numeroEconomico ?? '', 'es-MX', { numeric: true })
    );
  }, [unidadesMulitas]);

  const mulitaEditorUnidad = useMemo(
    () =>
      mulitaEditorUnidadId ? (mulitasOrdenadas.find((x) => x.id === mulitaEditorUnidadId) ?? null) : null,
    [mulitaEditorUnidadId, mulitasOrdenadas]
  );

  const mulitaDrawerUnidad = mulitaEditorUnidad;

  function totalMulitaSemanalDesdeForm(ed: MulitaSemanalEd, semanaLunes: string): number | null {
    let sum = 0;
    for (const key of ['nomina', 'diesel'] as const) {
      const p = parseMontoUnidadInput(ed[key]);
      if (!p.ok) return null;
      if (p.value != null) sum += p.value;
    }
    const hx = sumaHorasExtrasMxnPreview(ed.horasExtrasLineas, semanaLunes);
    if (hx === null) return null;
    sum += hx;
    const eo = sumaExtrasOperacionesPreview(ed.extrasOperacionesLineas, semanaLunes);
    if (eo === null) return null;
    sum += eo;
    const gf = sumaGastosFijosPreview(ed.gastosFijosLineas, semanaLunes);
    if (gf === null) return null;
    sum += gf;
    if (ed.faltasDias.length === 0) {
      const pb = parseMontoUnidadInput(ed.bonoPuntualidad);
      if (!pb.ok) return null;
      if (pb.value != null) sum += pb.value;
    }
    return sum;
  }

  const totalGastosTodasMulitas = useMemo(() => {
    if (!panelMulitasOpen) return null;
    const totales = mulitasOrdenadas.map((u) => {
      const ed = mulitaEdits[u.id];
      if (!ed) return null;
      return totalMulitaSemanalDesdeForm(ed, mulitaSemanaInicio);
    });
    if (totales.some((x) => x === null)) return null;
    const validos = totales.filter((x): x is number => x != null);
    if (validos.length === 0) return null;
    return validos.reduce((acc, x) => acc + x, 0);
  }, [panelMulitasOpen, mulitasOrdenadas, mulitaEdits, mulitaSemanaInicio]);

  function openPanelMulitas() {
    setMulitaSemanaInicio(lunesSemanaISO());
    setPanelMulitasOpen(true);
    setError(null);
  }

  function closePanelMulitas() {
    if (mulitaSavingId) return;
    setMulitaEditorUnidadId(null);
    setPanelMulitasOpen(false);
  }

  function openMulitaSemanalEditor(id: string) {
    setMulitaEditorUnidadId(id);
    setMulitaHistorialUnidadId(id);
  }

  function closeMulitaSemanalDrawer() {
    if (mulitaSavingId) return;
    setMulitaEditorUnidadId(null);
  }

  function toggleFaltaDiaMulita(unidadId: string, iso: string) {
    setMulitaEdits((prev) => {
      const ed = prev[unidadId];
      if (!ed) return prev;
      const next = new Set(ed.faltasDias);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      const faltasDias = [...next].sort();
      const hayFaltas = faltasDias.length > 0;
      return {
        ...prev,
        [unidadId]: {
          ...ed,
          faltasDias,
          bonoPuntualidad: hayFaltas ? '' : ed.bonoPuntualidad,
        },
      };
    });
  }

  async function guardarGastosMulita(id: string) {
    const ed = mulitaEdits[id];
    if (!ed) return;
    const pn = parseMontoUnidadInput(ed.nomina);
    const pd = parseMontoUnidadInput(ed.diesel);
    const pb = parseMontoUnidadInput(ed.bonoPuntualidad);
    const he = validarYLineasHorasExtrasApi(ed.horasExtrasLineas, mulitaSemanaInicio);
    const eo = validarYExtrasOperacionesApi(ed.extrasOperacionesLineas, mulitaSemanaInicio);
    const gf = validarYGastosFijosApi(ed.gastosFijosLineas, mulitaSemanaInicio);
    if (!pn.ok || !pd.ok || !pb.ok || !he.ok || !eo.ok || !gf.ok) {
      const msg = !he.ok ? he.message : !eo.ok ? eo.message : !gf.ok ? gf.message : 'Revisa los importes semanales (MXN).';
      toast(msg, 'error');
      return;
    }
    setMulitaSavingId(id);
    try {
      const hayFaltas = ed.faltasDias.length > 0;
      const gasto = await upsertMulitaGastoSemanaApi(id, {
        semanaInicio: mulitaSemanaInicio,
        nominaOperador: pn.value,
        diesel: pd.value,
        horasExtrasLineas: he.payload,
        extrasOperacionesLineas: eo.payload,
        gastosFijosLineas: gf.payload,
        faltasDias: ed.faltasDias,
        bonoPuntualidad: hayFaltas ? 0 : pb.value,
      });
      setMulitaEdits((prev) => ({
        ...prev,
        [id]: {
          nomina: gasto.nominaOperador != null ? String(gasto.nominaOperador) : '',
          horasExtrasLineas: horasExtrasLineasFormDesdeApi(gasto, mulitaSemanaInicio),
          extrasOperacionesLineas: extrasOperacionesLineasFormDesdeApi(gasto, mulitaSemanaInicio),
          gastosFijosLineas: gastosFijosLineasFormDesdeApi(gasto, mulitaSemanaInicio),
          diesel: gasto.diesel != null ? String(gasto.diesel) : '',
          faltasDias: gasto.faltasDias ?? [],
          bonoPuntualidad:
            (gasto.faltasDias?.length ?? 0) > 0
              ? ''
              : gasto.bonoPuntualidad != null
                ? String(gasto.bonoPuntualidad)
                : '',
        },
      }));
      if (mulitaHistorialUnidadId === id) {
        setMulitaHistorialLoading(true);
        const rows = await getMulitaGastosHistorialUnidadApi(id, 16);
        setMulitaHistorialRows(rows);
        setMulitaHistorialLoading(false);
      }
      toast('Gasto semanal de mulita guardado.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setMulitaSavingId(null);
    }
  }

  useEffect(() => {
    if (!panelMulitasOpen) return;
    setMulitaLoadingSemana(true);
    getMulitaGastosSemanaApi(mulitaSemanaInicio)
      .then((rows) => {
        const map: Record<string, MulitaSemanalEd> = {};
        for (const u of mulitasOrdenadas) {
          map[u.id] = defaultMulitaSemanalEd(mulitaSemanaInicio);
        }
        for (const r of rows) {
          const faltas = r.faltasDias ?? [];
          map[r.unidadId] = {
            nomina: r.nominaOperador != null ? String(r.nominaOperador) : '',
            horasExtrasLineas: horasExtrasLineasFormDesdeApi(r, mulitaSemanaInicio),
            extrasOperacionesLineas: extrasOperacionesLineasFormDesdeApi(r, mulitaSemanaInicio),
            gastosFijosLineas: gastosFijosLineasFormDesdeApi(r, mulitaSemanaInicio),
            diesel: r.diesel != null ? String(r.diesel) : '',
            faltasDias: faltas,
            bonoPuntualidad:
              faltas.length > 0 ? '' : r.bonoPuntualidad != null ? String(r.bonoPuntualidad) : '',
          };
        }
        setMulitaEdits(map);
      })
      .catch((e) => {
        toast(e instanceof Error ? e.message : 'Error al cargar semana', 'error');
      })
      .finally(() => setMulitaLoadingSemana(false));
  }, [panelMulitasOpen, mulitaSemanaInicio, mulitasOrdenadas, toast]);

  useEffect(() => {
    if (mulitaEditorUnidadId && !mulitasOrdenadas.some((u) => u.id === mulitaEditorUnidadId)) {
      setMulitaEditorUnidadId(null);
    }
  }, [mulitaEditorUnidadId, mulitasOrdenadas]);

  useEffect(() => {
    if (!panelMulitasOpen) return;
    if (!mulitasOrdenadas.length) {
      setMulitaHistorialUnidadId('');
      setMulitaHistorialRows([]);
      return;
    }
    if (!mulitaHistorialUnidadId) {
      setMulitaHistorialUnidadId(mulitasOrdenadas[0].id);
      return;
    }
    setMulitaHistorialLoading(true);
    getMulitaGastosHistorialUnidadApi(mulitaHistorialUnidadId, 16)
      .then((rows) => setMulitaHistorialRows(rows))
      .catch((e) => toast(e instanceof Error ? e.message : 'Error al cargar historial', 'error'))
      .finally(() => setMulitaHistorialLoading(false));
  }, [panelMulitasOpen, mulitaHistorialUnidadId, mulitasOrdenadas, toast]);

  useEffect(() => {
    if (!panelMulitasOpen || !mulitaDrawerUnidad) {
      setMulitaDrawerMantGastos([]);
      setMulitaDrawerMantenimientos([]);
      setMulitaDrawerEvidencias([]);
      return;
    }
    const uid = mulitaDrawerUnidad.id;
    let cancel = false;
    setMulitaMantNuevo((prev) => ({
      mantenimientoId: prev.mantenimientoId,
      fecha: prev.fecha || mulitaSemanaInicio,
      concepto: prev.concepto,
      cantidad: prev.cantidad,
    }));
    setMulitaDrawerAuxLoading(true);
    Promise.all([
      getMulitaGastosMantenimientoUnidadApi(uid).catch(() => [] as MulitaGastoMantenimientoRow[]),
      getMantenimientosUnidad(uid).catch(() => [] as MantenimientoRow[]),
      getMulitaEvidenciasApi(uid, mulitaSemanaInicio).catch(() => [] as MulitaEvidenciaRow[]),
    ])
      .then(([g, m, e]) => {
        if (cancel) return;
        setMulitaDrawerMantGastos(g);
        setMulitaDrawerMantenimientos(m);
        setMulitaDrawerEvidencias(e);
      })
      .catch(() => {
        if (!cancel) toast('No se pudieron cargar datos auxiliares del panel mulita', 'error');
      })
      .finally(() => {
        if (!cancel) setMulitaDrawerAuxLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [panelMulitasOpen, mulitaDrawerUnidad?.id, mulitaSemanaInicio, toast]);

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
      pendientePlacasMotivo:
        u.pendientePlacasMotivo === 'baja_placas' || u.pendientePlacasMotivo === 'pendiente_importar'
          ? u.pendientePlacasMotivo
          : '',
      placaFederal: !!u.placaFederal,
      placaLocal: !!u.placaLocal,
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
    if (
      formNueva.estatus === 'Disponible' &&
      formNueva.subestatusDisponible === 'pendiente_placas' &&
      !formNueva.pendientePlacasMotivo
    ) {
      const msg = 'Indica el motivo de pendiente de placas (baja o pendiente por importar).';
      setError(msg);
      toast(msg, 'error');
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
      pendientePlacasMotivo:
        formNueva.estatus === 'Disponible' && formNueva.subestatusDisponible === 'pendiente_placas'
          ? formNueva.pendientePlacasMotivo || null
          : null,
      placaFederal: formNueva.placaFederal,
      placaLocal: formNueva.placaLocal,
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
    if (
      formEditar.estatus === 'Disponible' &&
      formEditar.subestatusDisponible === 'pendiente_placas' &&
      !formEditar.pendientePlacasMotivo
    ) {
      const msg = 'Indica el motivo de pendiente de placas (baja o pendiente por importar).';
      setError(msg);
      toast(msg, 'error');
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
      pendientePlacasMotivo:
        formEditar.estatus === 'Disponible' && formEditar.subestatusDisponible === 'pendiente_placas'
          ? formEditar.pendientePlacasMotivo || null
          : null,
      placaFederal: formEditar.placaFederal,
      placaLocal: formEditar.placaLocal,
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

  const mulitaDrawerEd =
    mulitaDrawerUnidad != null
      ? (mulitaEdits[mulitaDrawerUnidad.id] ?? defaultMulitaSemanalEd(mulitaSemanaInicio))
      : null;

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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`btn inline-flex items-center gap-2 ${panelMulitasOpen ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => (panelMulitasOpen ? closePanelMulitas() : openPanelMulitas())}
          >
            <Icon icon={panelMulitasOpen ? 'mdi:chevron-up' : 'mdi:forklift'} className="size-5" aria-hidden />
            {panelMulitasOpen ? 'Ocultar mulitas' : 'Unidades Mulitas'}
          </button>
          <button type="button" className="btn btn-primary inline-flex items-center gap-2" onClick={openNueva}>
            <Icon icon="mdi:plus" className="size-5" aria-hidden />
            Nueva unidad
          </button>
        </div>
      </header>

      {error && <div className={CRUD_ERROR_BANNER}>{error}</div>}

      {/* Gastos mulitas: lista compacta + panel lateral (drawer) para captura detallada */}
      {panelMulitasOpen && (
        <>
        <section
          className="mb-6 overflow-hidden rounded-xl border border-skyline-border bg-white shadow-sm"
          aria-labelledby="mulitas-gastos-heading"
        >
          <div className="border-b border-skyline-border bg-slate-50/90 px-5 py-4 sm:px-6">
            <h2 id="mulitas-gastos-heading" className="text-lg font-semibold text-gray-900">
              Unidades Mulitas · gastos de operación (semanal)
            </h2>
            <p className="mt-1.5 text-sm text-gray-600">
              Montos por semana (lunes a domingo). Usa <strong className="font-medium text-slate-800">Editar gastos</strong> para abrir el
              panel lateral: ahí capturas nómina, faltas, bono, diésel, horas extras por línea y extras de operación, sin
              amontonar la tabla principal.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setMulitaSemanaInicio((v) => moverDiasISO(v, -7))}
              >
                Semana anterior
              </button>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Semana (lunes)
                <input
                  type="date"
                  value={mulitaSemanaInicio}
                  onChange={(e) => setMulitaSemanaInicio(e.target.value)}
                  className="ml-2 rounded-md border border-skyline-border bg-white px-2 py-1 text-sm font-medium text-slate-800"
                />
              </label>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setMulitaSemanaInicio((v) => moverDiasISO(v, 7))}
              >
                Semana siguiente
              </button>
            </div>
          </div>

          <div className="px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
            {mulitasOrdenadas.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No hay unidades con tipo Mulita. Registra una unidad y elige «Mulita» en tipo de unidad, o edita una
                existente.
              </p>
            ) : mulitaLoadingSemana ? (
              <div className="py-10 text-center text-sm text-gray-500">Cargando semana…</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-skyline-border">
                <table className="w-full min-w-[36rem] divide-y divide-skyline-border text-sm">
                  <thead>
                    <tr className={CRUD_THEAD_TR}>
                      <CrudTableTh className="min-w-[9rem] px-3 py-3 align-middle" icon="mdi:forklift">
                        Unidad
                      </CrudTableTh>
                      <CrudTableTh className="min-w-[8rem] px-3 py-3 align-middle" icon="mdi:account-hard-hat-outline">
                        Operador
                      </CrudTableTh>
                      <CrudTableTh className="min-w-[8rem] px-3 py-3 align-middle" icon="mdi:briefcase-outline">
                        Cliente / renta
                      </CrudTableTh>
                      <CrudTableTh className="whitespace-nowrap px-3 py-3 align-middle" icon="mdi:sigma">
                        Total semana
                      </CrudTableTh>
                      <CrudTableTh className="w-[1%] whitespace-nowrap px-3 py-3 align-middle" icon="mdi:draw-pen">
                        Gastos
                      </CrudTableTh>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-skyline-border bg-white">
                    {mulitasOrdenadas.map((u, rowIdx) => {
                      const ed = mulitaEdits[u.id] ?? defaultMulitaSemanalEd(mulitaSemanaInicio);
                      const filaTotal = totalMulitaSemanalDesdeForm(ed, mulitaSemanaInicio);
                      const operador = (u.operadorEnRenta ?? '').trim();
                      const cliente = (u.clienteEnRenta ?? '').trim();
                      const abierta = mulitaEditorUnidadId === u.id;
                      return (
                        <tr
                          key={u.id}
                          className={`${crudTableRowClass(rowIdx)} ${abierta ? 'bg-sky-50/80' : ''} cursor-pointer`}
                          onClick={() => openMulitaSemanalEditor(u.id)}
                        >
                          <td className="px-3 py-2.5 align-middle text-center">
                            <div className="font-semibold text-slate-900">
                              {(u.numeroEconomico ?? '').trim() || '—'}
                            </div>
                            <div className="text-xs text-slate-600">{u.placas}</div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {u.marca} {u.modelo}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-middle text-center">
                            {operador ? (
                              <span className="text-sm text-slate-800">{operador}</span>
                            ) : (
                              <span className="mx-auto block max-w-[14rem] text-xs leading-snug text-slate-500">
                                {MULITA_TEXTO_SIN_OPERADOR_CLIENTE}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-middle text-center">
                            {cliente ? (
                              <span className="text-sm text-slate-800">{cliente}</span>
                            ) : (
                              <span className="mx-auto block max-w-[14rem] text-xs leading-snug text-slate-500">
                                {MULITA_TEXTO_SIN_OPERADOR_CLIENTE}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-center font-medium tabular-nums text-slate-900">
                            {filaTotal === null ? '—' : textoMontoUnidadTabla(filaTotal)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 align-middle text-center">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={mulitaSavingId !== null}
                              onClick={(e) => {
                                e.stopPropagation();
                                openMulitaSemanalEditor(u.id);
                              }}
                            >
                              Editar gastos
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {mulitasOrdenadas.length > 0 ? (
            <div className="border-t border-fuchsia-100 bg-fuchsia-50/60 px-4 py-3 text-center text-xs text-fuchsia-950 sm:px-6">
              <span className="font-medium">Gastos de mulita (mantenimiento):</span>{' '}
              al pulsar <strong className="font-semibold">Editar gastos</strong> o la fila de una unidad, en el panel verás la
              sección <strong className="font-semibold">debajo de «Extras de operación»</strong> (fecha, concepto, MXN vinculados a
              una orden de mantenimiento).{' '}
              <Link
                to="/finanzas/gastos?tipo=mulita_mantenimiento"
                className="font-semibold text-skyline-blue underline decoration-skyline-blue/40 underline-offset-2"
              >
                Ver en Finanzas → Gastos
              </Link>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-skyline-border bg-gray-50/80 px-5 py-3 sm:px-6">
            <p className="text-sm text-gray-600">
              {unidadesMulitas.length > 0 && totalGastosTodasMulitas !== null ? (
                <>
                  <span className="font-medium text-gray-800">Suma semanal de mulitas:</span>{' '}
                  <span className="font-semibold text-gray-900">
                    {textoMontoUnidadTabla(totalGastosTodasMulitas)}
                  </span>
                </>
              ) : unidadesMulitas.length > 0 ? (
                <span>Captura importes válidos para ver la suma semanal.</span>
              ) : null}
            </p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={mulitaSavingId !== null}
              onClick={closePanelMulitas}
            >
              Ocultar
            </button>
          </div>

          {mulitasOrdenadas.length > 0 ? (
            <div className="border-t border-skyline-border bg-white px-5 py-4 sm:px-6">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Historial por unidad</span>
                <select
                  value={mulitaHistorialUnidadId}
                  onChange={(e) => setMulitaHistorialUnidadId(e.target.value)}
                  className="rounded-md border border-skyline-border bg-white px-2 py-1 text-sm text-slate-800"
                >
                  {mulitasOrdenadas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {(u.numeroEconomico ?? '').trim() || u.placas} · {u.placas}
                    </option>
                  ))}
                </select>
              </div>
              {mulitaHistorialLoading ? (
                <p className="text-sm text-gray-500">Cargando historial…</p>
              ) : mulitaHistorialRows.length === 0 ? (
                <p className="text-sm text-gray-500">Sin semanas guardadas para esta unidad.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-skyline-border">
                  <table className="min-w-[72rem] w-full divide-y divide-skyline-border text-sm">
                    <thead className="bg-slate-50">
                      <tr className={CRUD_THEAD_TR}>
                        <CrudTableTh className="px-3 py-2.5 align-middle" icon="mdi:calendar">Semana</CrudTableTh>
                        <CrudTableTh className="px-3 py-2.5 align-middle" icon="mdi:cash">Nómina</CrudTableTh>
                        <CrudTableTh className="px-3 py-2.5 align-middle" icon="mdi:calendar-remove-outline">Faltas</CrudTableTh>
                        <CrudTableTh className="px-3 py-2.5 align-middle" icon="mdi:medal-outline">Bono punt.</CrudTableTh>
                        <CrudTableTh className="px-3 py-2.5 align-middle" icon="mdi:gas-station-outline">Diésel</CrudTableTh>
                        <CrudTableTh className="min-w-[10rem] px-3 py-2.5 align-middle" icon="mdi:clock-outline">
                          Horas extras
                        </CrudTableTh>
                        <CrudTableTh className="min-w-[10rem] px-3 py-2.5 align-middle" icon="mdi:clipboard-text-outline">
                          Extras op.
                        </CrudTableTh>
                        <CrudTableTh className="min-w-[10rem] px-3 py-2.5 align-middle" icon="mdi:lock-outline">
                          Gastos fijos
                        </CrudTableTh>
                        <CrudTableTh className="px-3 py-2.5 align-middle" icon="mdi:sigma">Total</CrudTableTh>
                      </tr>
                    </thead>
                    <tbody className={CRUD_TBODY}>
                      {mulitaHistorialRows.map((r, idx) => (
                        <tr key={r.id} className={crudTableRowClass(idx)}>
                          <td className="px-3 py-2 text-center font-medium text-slate-800">{r.semanaInicio}</td>
                          <td className="px-3 py-2 text-center tabular-nums">{textoMontoUnidadTabla(r.nominaOperador)}</td>
                          <td className="max-w-[12rem] px-3 py-2 text-center text-xs text-slate-700">
                            {resumenFaltasMulitaHistorial(r.faltasDias)}
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums">{textoMontoUnidadTabla(r.bonoPuntualidad)}</td>
                          <td className="px-3 py-2 text-center tabular-nums">{textoMontoUnidadTabla(r.diesel)}</td>
                          <td className="max-w-[14rem] px-3 py-2 text-left text-[10px] leading-snug text-slate-700">
                            <div>{textoResumenHorasExtrasHistorial(r)}</div>
                            <div className="mt-0.5 text-center font-semibold tabular-nums text-slate-900">
                              {textoMontoUnidadTabla(r.horasExtras)}
                            </div>
                          </td>
                          <td className="max-w-[14rem] px-3 py-2 text-left text-[10px] leading-snug text-slate-700">
                            <div>{textoResumenExtrasOpHistorial(r)}</div>
                            <div className="mt-0.5 text-center font-semibold tabular-nums text-slate-900">
                              {textoMontoUnidadTabla(r.extrasOperacionesMonto ?? null)}
                            </div>
                          </td>
                          <td className="max-w-[14rem] px-3 py-2 text-left text-[10px] leading-snug text-slate-700">
                            <div>{textoResumenGastosFijosHistorial(r)}</div>
                            <div className="mt-0.5 text-center font-semibold tabular-nums text-slate-900">
                              {textoMontoUnidadTabla(r.gastosFijosMonto ?? null)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center font-semibold tabular-nums">{textoMontoUnidadTabla(r.totalSemanal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </section>
        {mulitaDrawerUnidad && mulitaDrawerEd
          ? (() => {
              const u = mulitaDrawerUnidad;
              const ed = mulitaDrawerEd;
              const domingoSem = moverDiasISO(mulitaSemanaInicio, 6);
              const diasSem = diasSemanaMulitaDesdeLunes(mulitaSemanaInicio);
              const hayFaltas = ed.faltasDias.length > 0;
              const filaTotal = totalMulitaSemanalDesdeForm(ed, mulitaSemanaInicio);
              const operadorDr = (u.operadorEnRenta ?? '').trim();
              const clienteDr = (u.clienteEnRenta ?? '').trim();
              const inputCls =
                'w-full rounded-md border border-skyline-border px-2.5 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue';
              const secTitle = 'mb-3 text-xs font-bold uppercase tracking-wide text-slate-600';
              const secBox = 'rounded-xl border border-skyline-border bg-white p-4 shadow-sm';
              return (
                <div
                  className="fixed inset-0 z-[62]"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="mulita-drawer-title"
                >
                  <div className="absolute inset-0 bg-black/40" onClick={closeMulitaSemanalDrawer} />
                  <div className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl sm:max-w-2xl">
                    <div className="shrink-0 border-b border-skyline-border p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-skyline-blue/10 text-skyline-blue">
                              <Icon icon="mdi:forklift" className="size-5" aria-hidden />
                            </div>
                            <div className="min-w-0">
                              <h2 id="mulita-drawer-title" className="text-lg font-semibold text-gray-900">
                                Gastos semana mulita
                              </h2>
                              <p className="truncate text-sm text-slate-600">
                                Semana desde <span className="font-semibold text-slate-800">{mulitaSemanaInicio}</span>
                              </p>
                            </div>
                          </div>
                          <p className="mt-2 text-sm font-medium text-slate-800">
                            {(u.numeroEconomico ?? '').trim() || '—'} · {u.placas} · {u.marca} {u.modelo}
                          </p>
                        </div>
                        <CrudActionIconButton icon="mdi:close" title="Cerrar panel" onClick={closeMulitaSemanalDrawer} />
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
                      <div className={secBox}>
                        <div className={secTitle}>Contexto</div>
                        <dl className="grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-xs font-medium text-slate-500">Operador vinculado</dt>
                            <dd className="font-medium text-slate-900">
                              {operadorDr || (
                                <span className="font-normal text-slate-500">{MULITA_TEXTO_SIN_OPERADOR_CLIENTE}</span>
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-slate-500">Cliente / renta</dt>
                            <dd className="font-medium text-slate-900">
                              {clienteDr || (
                                <span className="font-normal text-slate-500">{MULITA_TEXTO_SIN_OPERADOR_CLIENTE}</span>
                              )}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className={secBox}>
                        <div className={secTitle}>Nómina y puntualidad</div>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-600">Nómina operador (MXN)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={inputCls}
                            placeholder="MXN"
                            value={ed.nomina}
                            onChange={(e) =>
                              setMulitaEdits((prev) => ({
                                ...prev,
                                [u.id]: { ...ed, nomina: e.target.value },
                              }))
                            }
                          />
                        </label>
                        <div className="mt-4">
                          <span className="mb-2 block text-xs font-medium text-slate-600">Faltas por día</span>
                          <div className="flex flex-wrap gap-1.5">
                            {diasSem.map(({ iso, label }) => {
                              const on = ed.faltasDias.includes(iso);
                              return (
                                <button
                                  key={iso}
                                  type="button"
                                  title={iso}
                                  aria-pressed={on}
                                  onClick={() => toggleFaltaDiaMulita(u.id, iso)}
                                  className={`rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
                                    on
                                      ? 'border-rose-300 bg-rose-100 text-rose-900'
                                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-skyline-blue/50'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                          {hayFaltas ? (
                            <p className="mt-2 text-xs text-rose-700">Con faltas el bono de puntualidad no aplica.</p>
                          ) : null}
                        </div>
                        <label className="mt-4 block">
                          <span className="mb-1 block text-xs font-medium text-slate-600">Bono puntualidad (MXN)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={`${inputCls} ${hayFaltas ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                            placeholder="MXN"
                            disabled={hayFaltas}
                            value={hayFaltas ? '' : ed.bonoPuntualidad}
                            onChange={(e) =>
                              setMulitaEdits((prev) => ({
                                ...prev,
                                [u.id]: { ...ed, bonoPuntualidad: e.target.value },
                              }))
                            }
                          />
                        </label>
                      </div>

                      <div className={secBox}>
                        <div className={secTitle}>Combustible</div>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-600">Diésel semanal (MXN)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={inputCls}
                            placeholder="MXN"
                            value={ed.diesel}
                            onChange={(e) =>
                              setMulitaEdits((prev) => ({
                                ...prev,
                                [u.id]: { ...ed, diesel: e.target.value },
                              }))
                            }
                          />
                        </label>
                      </div>

                      <div className={secBox}>
                        <div className={secTitle}>Horas extras</div>
                        <p className="mb-3 text-xs text-slate-500">Una línea por registro: fecha dentro de la semana, horas y precio por hora.</p>
                        <div className="flex flex-col gap-3">
                          {ed.horasExtrasLineas.map((ln, idx) => {
                            const sub = (() => {
                              const h = parseFloat(ln.horas.trim().replace(/,/g, '.'));
                              const pm = parseMontoUnidadInput(ln.precioPorHora);
                              if (!Number.isFinite(h) || h <= 0 || !pm.ok || pm.value == null) return null;
                              return Math.round(h * pm.value * 100) / 100;
                            })();
                            return (
                              <div
                                key={`drawer-he-${u.id}-${idx}`}
                                className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
                              >
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                                  <label className="block min-w-0">
                                    <span className="mb-1 block text-xs font-medium text-slate-600">Fecha</span>
                                    <input
                                      type="date"
                                      min={mulitaSemanaInicio}
                                      max={domingoSem}
                                      value={ln.fecha}
                                      onChange={(e) =>
                                        setMulitaEdits((prev) => {
                                          const cur = prev[u.id] ?? ed;
                                          const next = [...cur.horasExtrasLineas];
                                          next[idx] = { ...next[idx], fecha: e.target.value };
                                          return { ...prev, [u.id]: { ...cur, horasExtrasLineas: next } };
                                        })
                                      }
                                      className="w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-sm"
                                    />
                                  </label>
                                  <label className="block min-w-0">
                                    <span className="mb-1 block text-xs font-medium text-slate-600">Horas</span>
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.25}
                                      placeholder="0"
                                      value={ln.horas}
                                      onChange={(e) =>
                                        setMulitaEdits((prev) => {
                                          const cur = prev[u.id] ?? ed;
                                          const next = [...cur.horasExtrasLineas];
                                          next[idx] = { ...next[idx], horas: e.target.value };
                                          return { ...prev, [u.id]: { ...cur, horasExtrasLineas: next } };
                                        })
                                      }
                                      className="w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-sm tabular-nums"
                                    />
                                  </label>
                                  <label className="block min-w-0">
                                    <span className="mb-1 block text-xs font-medium text-slate-600">$/hora (MXN)</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="MXN"
                                      value={ln.precioPorHora}
                                      onChange={(e) =>
                                        setMulitaEdits((prev) => {
                                          const cur = prev[u.id] ?? ed;
                                          const next = [...cur.horasExtrasLineas];
                                          next[idx] = { ...next[idx], precioPorHora: e.target.value };
                                          return { ...prev, [u.id]: { ...cur, horasExtrasLineas: next } };
                                        })
                                      }
                                      className="w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-sm"
                                    />
                                  </label>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs text-slate-500">
                                    {sub != null ? <>Subtotal: {textoMontoUnidadTabla(sub)}</> : '\u00a0'}
                                  </span>
                                  <div className="flex gap-2">
                                    {ed.horasExtrasLineas.length > 1 ? (
                                      <button
                                        type="button"
                                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-800"
                                        onClick={() =>
                                          setMulitaEdits((prev) => {
                                            const cur = prev[u.id] ?? ed;
                                            const next = cur.horasExtrasLineas.filter((_, j) => j !== idx);
                                            return {
                                              ...prev,
                                              [u.id]: {
                                                ...cur,
                                                horasExtrasLineas:
                                                  next.length > 0 ? next : [nuevaLineaHorasExtra(mulitaSemanaInicio)],
                                              },
                                            };
                                          })
                                        }
                                      >
                                        Quitar línea
                                      </button>
                                    ) : null}
                                    {idx === ed.horasExtrasLineas.length - 1 ? (
                                      <button
                                        type="button"
                                        className="rounded-md border border-skyline-border bg-white px-2 py-1 text-xs font-semibold text-skyline-blue hover:bg-sky-50"
                                        onClick={() =>
                                          setMulitaEdits((prev) => {
                                            const cur = prev[u.id] ?? ed;
                                            return {
                                              ...prev,
                                              [u.id]: {
                                                ...cur,
                                                horasExtrasLineas: [
                                                  ...cur.horasExtrasLineas,
                                                  nuevaLineaHorasExtra(mulitaSemanaInicio),
                                                ],
                                              },
                                            };
                                          })
                                        }
                                      >
                                        + Línea
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className={secBox}>
                        <div className={secTitle}>Extras de operación</div>
                        <p className="mb-3 text-xs text-slate-500">Conceptos adicionales con fecha y monto en MXN.</p>
                        <div className="flex flex-col gap-3">
                          {ed.extrasOperacionesLineas.map((ln, idx) => {
                            const sub = (() => {
                              const pm = parseMontoUnidadInput(ln.cantidad);
                              if (!pm.ok || pm.value == null) return null;
                              return pm.value;
                            })();
                            return (
                              <div
                                key={`drawer-eo-${u.id}-${idx}`}
                                className="rounded-lg border border-slate-200 bg-white p-3"
                              >
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:items-end">
                                  <label className="block min-w-0 sm:col-span-2">
                                    <span className="mb-1 block text-xs font-medium text-slate-600">Fecha</span>
                                    <input
                                      type="date"
                                      min={mulitaSemanaInicio}
                                      max={domingoSem}
                                      value={ln.fecha}
                                      onChange={(e) =>
                                        setMulitaEdits((prev) => {
                                          const cur = prev[u.id] ?? ed;
                                          const next = [...cur.extrasOperacionesLineas];
                                          next[idx] = { ...next[idx], fecha: e.target.value };
                                          return { ...prev, [u.id]: { ...cur, extrasOperacionesLineas: next } };
                                        })
                                      }
                                      className="w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-sm"
                                    />
                                  </label>
                                  <label className="block min-w-0 sm:col-span-3">
                                    <span className="mb-1 block text-xs font-medium text-slate-600">Concepto</span>
                                    <input
                                      type="text"
                                      maxLength={200}
                                      placeholder="Ej. refacción, viáticos…"
                                      value={ln.concepto}
                                      onChange={(e) =>
                                        setMulitaEdits((prev) => {
                                          const cur = prev[u.id] ?? ed;
                                          const next = [...cur.extrasOperacionesLineas];
                                          next[idx] = { ...next[idx], concepto: e.target.value };
                                          return { ...prev, [u.id]: { ...cur, extrasOperacionesLineas: next } };
                                        })
                                      }
                                      className="w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-sm"
                                    />
                                  </label>
                                  <label className="block min-w-0 sm:col-span-6 sm:max-w-xs">
                                    <span className="mb-1 block text-xs font-medium text-slate-600">Cantidad (MXN)</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="MXN"
                                      value={ln.cantidad}
                                      onChange={(e) =>
                                        setMulitaEdits((prev) => {
                                          const cur = prev[u.id] ?? ed;
                                          const next = [...cur.extrasOperacionesLineas];
                                          next[idx] = { ...next[idx], cantidad: e.target.value };
                                          return { ...prev, [u.id]: { ...cur, extrasOperacionesLineas: next } };
                                        })
                                      }
                                      className="w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-sm"
                                    />
                                  </label>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs text-slate-500">
                                    {sub != null ? <>Subtotal: {textoMontoUnidadTabla(sub)}</> : '\u00a0'}
                                  </span>
                                  <div className="flex gap-2">
                                    {ed.extrasOperacionesLineas.length > 1 ? (
                                      <button
                                        type="button"
                                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-800"
                                        onClick={() =>
                                          setMulitaEdits((prev) => {
                                            const cur = prev[u.id] ?? ed;
                                            const next = cur.extrasOperacionesLineas.filter((_, j) => j !== idx);
                                            return {
                                              ...prev,
                                              [u.id]: {
                                                ...cur,
                                                extrasOperacionesLineas:
                                                  next.length > 0 ? next : [nuevaLineaExtrasOp(mulitaSemanaInicio)],
                                              },
                                            };
                                          })
                                        }
                                      >
                                        Quitar línea
                                      </button>
                                    ) : null}
                                    {idx === ed.extrasOperacionesLineas.length - 1 ? (
                                      <button
                                        type="button"
                                        className="rounded-md border border-skyline-border bg-white px-2 py-1 text-xs font-semibold text-skyline-blue hover:bg-sky-50"
                                        onClick={() =>
                                          setMulitaEdits((prev) => {
                                            const cur = prev[u.id] ?? ed;
                                            return {
                                              ...prev,
                                              [u.id]: {
                                                ...cur,
                                                extrasOperacionesLineas: [
                                                  ...cur.extrasOperacionesLineas,
                                                  nuevaLineaExtrasOp(mulitaSemanaInicio),
                                                ],
                                              },
                                            };
                                          })
                                        }
                                      >
                                        + Línea
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className={secBox}>
                        <div className={secTitle}>Gastos de mulita (mantenimiento)</div>
                        <p className="mb-2 text-xs text-slate-500">
                          Registra gastos por <strong className="font-medium text-slate-700">fecha</strong>,{' '}
                          <strong className="font-medium text-slate-700">concepto</strong> e{' '}
                          <strong className="font-medium text-slate-700">importe (MXN)</strong> vinculados a una orden de
                          mantenimiento de esta unidad. Se reflejan en{' '}
                          <strong className="font-medium text-slate-700">Finanzas → Gastos</strong> como movimientos de tipo
                          «Gastos mulita vinculados a mantenimiento» y suman al total de mantenimiento.
                        </p>
                        <p className="mb-3 text-xs">
                          <Link
                            to="/finanzas/gastos?tipo=mulita_mantenimiento"
                            className="font-medium text-skyline-blue underline decoration-skyline-blue/40 underline-offset-2 hover:decoration-skyline-blue"
                          >
                            Ver estos movimientos en Finanzas → Gastos
                          </Link>
                        </p>
                        {mulitaDrawerAuxLoading ? (
                          <p className="text-xs text-slate-500">Cargando…</p>
                        ) : mulitaDrawerMantenimientos.length === 0 ? (
                          <p className="text-xs text-amber-800">
                            No hay órdenes de mantenimiento para esta unidad. Registra una en el módulo de mantenimiento para poder
                            vincular gastos.
                          </p>
                        ) : (
                          <div className="mb-4 grid gap-2 sm:grid-cols-2">
                            <label className="block sm:col-span-2">
                              <span className="mb-1 block text-xs font-medium text-slate-600">Orden de mantenimiento</span>
                              <select
                                className={inputCls}
                                value={mulitaMantNuevo.mantenimientoId}
                                onChange={(e) =>
                                  setMulitaMantNuevo((p) => ({ ...p, mantenimientoId: e.target.value }))
                                }
                              >
                                <option value="">Selecciona…</option>
                                {mulitaDrawerMantenimientos.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    #{m.id} · {m.tipo} · {(m.descripcion || 'Sin descripción').slice(0, 48)}
                                    {(m.descripcion || '').length > 48 ? '…' : ''}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-600">Fecha</span>
                              <input
                                type="date"
                                className={inputCls}
                                value={mulitaMantNuevo.fecha}
                                onChange={(e) => setMulitaMantNuevo((p) => ({ ...p, fecha: e.target.value }))}
                              />
                            </label>
                            <label className="block sm:col-span-2">
                              <span className="mb-1 block text-xs font-medium text-slate-600">Concepto</span>
                              <input
                                type="text"
                                className={inputCls}
                                placeholder="Describe el gasto"
                                value={mulitaMantNuevo.concepto}
                                onChange={(e) => setMulitaMantNuevo((p) => ({ ...p, concepto: e.target.value }))}
                              />
                            </label>
                            <label className="block sm:col-span-2">
                              <span className="mb-1 block text-xs font-medium text-slate-600">Cantidad (MXN)</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                className={inputCls}
                                placeholder="MXN"
                                value={mulitaMantNuevo.cantidad}
                                onChange={(e) => setMulitaMantNuevo((p) => ({ ...p, cantidad: e.target.value }))}
                              />
                            </label>
                            <div className="sm:col-span-2">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={mulitaMantSaving || mulitaSavingId !== null}
                                onClick={async () => {
                                  if (mulitaMantSaving || mulitaSavingId) return;
                                  const mid = mulitaMantNuevo.mantenimientoId;
                                  const pm = parseMontoUnidadInput(mulitaMantNuevo.cantidad);
                                  if (
                                    !mid ||
                                    !mulitaMantNuevo.fecha ||
                                    !mulitaMantNuevo.concepto.trim() ||
                                    !pm.ok ||
                                    pm.value == null
                                  ) {
                                    toast('Elige mantenimiento, fecha, concepto e importe válido.', 'error');
                                    return;
                                  }
                                  setMulitaMantSaving(true);
                                  try {
                                    await createMulitaGastoMantenimientoApi(u.id, {
                                      mantenimientoId: mid,
                                      fecha: mulitaMantNuevo.fecha,
                                      concepto: mulitaMantNuevo.concepto.trim(),
                                      cantidad: pm.value,
                                    });
                                    const rows = await getMulitaGastosMantenimientoUnidadApi(u.id);
                                    setMulitaDrawerMantGastos(rows);
                                    setMulitaMantNuevo({
                                      mantenimientoId: '',
                                      fecha: mulitaSemanaInicio,
                                      concepto: '',
                                      cantidad: '',
                                    });
                                    toast('Gasto vinculado a mantenimiento registrado.');
                                  } catch (e) {
                                    toast(e instanceof Error ? e.message : 'Error', 'error');
                                  } finally {
                                    setMulitaMantSaving(false);
                                  }
                                }}
                              >
                                {mulitaMantSaving ? 'Guardando…' : 'Añadir gasto'}
                              </button>
                            </div>
                          </div>
                        )}
                        {mulitaDrawerMantGastos.length > 0 ? (
                          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 text-xs">
                            {mulitaDrawerMantGastos.map((g) => (
                              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-2 py-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-800">{g.concepto}</p>
                                  <p className="text-slate-500">
                                    {g.fecha} · Mtto #{g.mantenimientoId}
                                    {g.mantenimientoTipo ? ` · ${g.mantenimientoTipo}` : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold tabular-nums text-slate-900">
                                    {textoMontoUnidadTabla(g.cantidad)}
                                  </span>
                                  <button
                                    type="button"
                                    className="rounded border border-rose-200 px-1.5 py-0.5 text-[11px] font-medium text-rose-800 hover:bg-rose-50"
                                    disabled={mulitaSavingId !== null}
                                    onClick={async () => {
                                      if (mulitaSavingId) return;
                                      if (!window.confirm('¿Eliminar este gasto vinculado?')) return;
                                      try {
                                        await deleteMulitaGastoMantenimientoApi(u.id, g.id);
                                        setMulitaDrawerMantGastos(await getMulitaGastosMantenimientoUnidadApi(u.id));
                                        toast('Gasto eliminado.');
                                      } catch (e) {
                                        toast(e instanceof Error ? e.message : 'Error', 'error');
                                      }
                                    }}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      <div className={secBox}>
                        <div className={secTitle}>Gastos fijos (operación mulita)</div>
                        <p className="mb-3 text-xs text-slate-500">
                          Conceptos recurrentes o fijos de la semana (fecha, concepto, MXN). Se suman al total de{' '}
                          <strong className="font-medium text-slate-700">operación mulita</strong> junto con nómina, diésel, horas
                          extras y extras de operación.
                        </p>
                        <div className="flex flex-col gap-3">
                          {ed.gastosFijosLineas.map((ln, idx) => {
                            const sub = (() => {
                              const pm = parseMontoUnidadInput(ln.cantidad);
                              if (!pm.ok || pm.value == null) return null;
                              return pm.value;
                            })();
                            return (
                              <div
                                key={`drawer-gf-${u.id}-${idx}`}
                                className="rounded-lg border border-slate-200 bg-white p-3"
                              >
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:items-end">
                                  <label className="block min-w-0 sm:col-span-2">
                                    <span className="mb-1 block text-xs font-medium text-slate-600">Fecha</span>
                                    <input
                                      type="date"
                                      min={mulitaSemanaInicio}
                                      max={domingoSem}
                                      value={ln.fecha}
                                      onChange={(e) =>
                                        setMulitaEdits((prev) => {
                                          const cur = prev[u.id] ?? ed;
                                          const next = [...cur.gastosFijosLineas];
                                          next[idx] = { ...next[idx], fecha: e.target.value };
                                          return { ...prev, [u.id]: { ...cur, gastosFijosLineas: next } };
                                        })
                                      }
                                      className="w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-sm"
                                    />
                                  </label>
                                  <label className="block min-w-0 sm:col-span-3">
                                    <span className="mb-1 block text-xs font-medium text-slate-600">Concepto</span>
                                    <input
                                      type="text"
                                      maxLength={200}
                                      placeholder="Ej. seguro, permisos, renta de equipo…"
                                      value={ln.concepto}
                                      onChange={(e) =>
                                        setMulitaEdits((prev) => {
                                          const cur = prev[u.id] ?? ed;
                                          const next = [...cur.gastosFijosLineas];
                                          next[idx] = { ...next[idx], concepto: e.target.value };
                                          return { ...prev, [u.id]: { ...cur, gastosFijosLineas: next } };
                                        })
                                      }
                                      className="w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-sm"
                                    />
                                  </label>
                                  <label className="block min-w-0 sm:col-span-6 sm:max-w-xs">
                                    <span className="mb-1 block text-xs font-medium text-slate-600">Cantidad (MXN)</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="MXN"
                                      value={ln.cantidad}
                                      onChange={(e) =>
                                        setMulitaEdits((prev) => {
                                          const cur = prev[u.id] ?? ed;
                                          const next = [...cur.gastosFijosLineas];
                                          next[idx] = { ...next[idx], cantidad: e.target.value };
                                          return { ...prev, [u.id]: { ...cur, gastosFijosLineas: next } };
                                        })
                                      }
                                      className="w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-sm"
                                    />
                                  </label>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs text-slate-500">
                                    {sub != null ? <>Subtotal: {textoMontoUnidadTabla(sub)}</> : '\u00a0'}
                                  </span>
                                  <div className="flex gap-2">
                                    {ed.gastosFijosLineas.length > 1 ? (
                                      <button
                                        type="button"
                                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-800"
                                        onClick={() =>
                                          setMulitaEdits((prev) => {
                                            const cur = prev[u.id] ?? ed;
                                            const next = cur.gastosFijosLineas.filter((_, j) => j !== idx);
                                            return {
                                              ...prev,
                                              [u.id]: {
                                                ...cur,
                                                gastosFijosLineas:
                                                  next.length > 0 ? next : [nuevaLineaExtrasOp(mulitaSemanaInicio)],
                                              },
                                            };
                                          })
                                        }
                                      >
                                        Quitar línea
                                      </button>
                                    ) : null}
                                    {idx === ed.gastosFijosLineas.length - 1 ? (
                                      <button
                                        type="button"
                                        className="rounded-md border border-skyline-border bg-white px-2 py-1 text-xs font-semibold text-skyline-blue hover:bg-sky-50"
                                        onClick={() =>
                                          setMulitaEdits((prev) => {
                                            const cur = prev[u.id] ?? ed;
                                            return {
                                              ...prev,
                                              [u.id]: {
                                                ...cur,
                                                gastosFijosLineas: [
                                                  ...cur.gastosFijosLineas,
                                                  nuevaLineaExtrasOp(mulitaSemanaInicio),
                                                ],
                                              },
                                            };
                                          })
                                        }
                                      >
                                        + Línea
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className={secBox}>
                        <div className={secTitle}>Evidencias (fotos)</div>
                        <p className="mb-3 text-xs text-slate-500">
                          Imágenes asociadas a esta unidad para la semana <span className="font-medium">{mulitaSemanaInicio}</span>.
                          Formatos de imagen habituales (JPG, PNG, WebP).
                        </p>
                        <div className="mb-4">
                          <input
                            type="file"
                            accept="image/*"
                            disabled={mulitaEvidenciaUploading || mulitaSavingId !== null}
                            className="block w-full max-w-md text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-skyline-blue file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-sky-700"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (!file) return;
                              setMulitaEvidenciaUploading(true);
                              try {
                                await uploadMulitaEvidenciaApi(u.id, file, { semanaInicio: mulitaSemanaInicio });
                                setMulitaDrawerEvidencias(await getMulitaEvidenciasApi(u.id, mulitaSemanaInicio));
                                toast('Evidencia subida.');
                              } catch (err) {
                                toast(err instanceof Error ? err.message : 'Error al subir', 'error');
                              } finally {
                                setMulitaEvidenciaUploading(false);
                              }
                            }}
                          />
                          {mulitaEvidenciaUploading ? (
                            <p className="mt-1 text-xs text-slate-500">Subiendo…</p>
                          ) : null}
                        </div>
                        {mulitaDrawerAuxLoading ? (
                          <p className="text-xs text-slate-500">Cargando evidencias…</p>
                        ) : mulitaDrawerEvidencias.length === 0 ? (
                          <p className="text-xs text-slate-500">Aún no hay fotos para esta semana.</p>
                        ) : (
                          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {mulitaDrawerEvidencias.map((ev) => (
                              <li
                                key={ev.id}
                                className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm"
                              >
                                <button
                                  type="button"
                                  className="block w-full p-0"
                                  onClick={() => setLightboxImg(getImagenUrl(ev.ruta))}
                                  title="Ampliar"
                                >
                                  <img
                                    src={getImagenUrl(ev.ruta)}
                                    alt={ev.nombreArchivo}
                                    className="h-28 w-full object-cover"
                                  />
                                </button>
                                <div className="border-t border-slate-200 p-2">
                                  <p className="truncate text-[11px] font-medium text-slate-800" title={ev.nombreArchivo}>
                                    {ev.nombreArchivo}
                                  </p>
                                  {ev.descripcion ? (
                                    <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-600">{ev.descripcion}</p>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="mt-2 w-full rounded border border-rose-200 py-1 text-[11px] font-medium text-rose-800 hover:bg-rose-50"
                                    disabled={mulitaSavingId !== null}
                                    onClick={async () => {
                                      if (mulitaSavingId) return;
                                      if (!window.confirm('¿Eliminar esta evidencia?')) return;
                                      try {
                                        await deleteMulitaEvidenciaApi(u.id, ev.id);
                                        setMulitaDrawerEvidencias(await getMulitaEvidenciasApi(u.id, mulitaSemanaInicio));
                                        toast('Evidencia eliminada.');
                                      } catch (err) {
                                        toast(err instanceof Error ? err.message : 'Error', 'error');
                                      }
                                    }}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 border-t border-skyline-border bg-slate-50/90 p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total semanal</p>
                          <p className="text-xl font-bold tabular-nums text-slate-900">
                            {filaTotal === null ? '—' : textoMontoUnidadTabla(filaTotal)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={mulitaSavingId !== null}
                          onClick={() => guardarGastosMulita(u.id)}
                        >
                          {mulitaSavingId === u.id ? 'Guardando…' : 'Guardar gastos'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          : null}
        </>
      )}

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
              Tipo unidad
              <select
                value={filtroTipoUnidad}
                onChange={(e) => setFiltroTipoUnidad(e.target.value as TipoUnidadCatalogo | 'todos')}
                className="mt-0.5 w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
              >
                <option value="todos">Todas</option>
                {TIPOS_UNIDAD_OPCIONES.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.l}
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
          <table className={`${CRUD_TABLE} min-w-[1380px]`}>
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
                <CrudTableTh className="min-w-[6.25rem] px-2 py-3.5 align-middle" icon="mdi:shape-outline">
                  Tipo placa
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
                    <span
                      className={`inline-flex max-w-[7rem] justify-center text-[11px] font-medium leading-tight text-slate-600 ${CRUD_CELDA_SEC}`}
                      title={textoTipoPlacaTabla(u)}
                    >
                      {textoTipoPlacaTabla(u)}
                    </span>
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
                  <td colSpan={13} className="px-4 py-10 text-center text-sm text-gray-500">
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
              <div className="md:col-span-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
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
                <TipoPlacaSelector
                  placaFederal={formNueva.placaFederal}
                  placaLocal={formNueva.placaLocal}
                  onChange={(next) => setFormNueva((f) => ({ ...f, ...next }))}
                />
              </div>
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
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                      Subestatus disponible
                      <select
                        value={formNueva.subestatusDisponible}
                        onChange={(e) => {
                          const v = e.target.value as SubestatusDisponible;
                          setFormNueva((f) => ({
                            ...f,
                            subestatusDisponible: v,
                            pendientePlacasMotivo: v === 'pendiente_placas' ? f.pendientePlacasMotivo : '',
                          }));
                        }}
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
                  {formNueva.subestatusDisponible === 'pendiente_placas' ? (
                    <PendientePlacasMotivoSelector
                      value={formNueva.pendientePlacasMotivo}
                      onChange={(v) => setFormNueva((f) => ({ ...f, pendientePlacasMotivo: v }))}
                    />
                  ) : null}
                </>
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
              <div className="md:col-span-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Placas *
                  <input
                    type="text"
                    value={formEditar.placas}
                    onChange={(e) => setFormEditar((f) => ({ ...f, placas: e.target.value.toUpperCase() }))}
                    className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    required
                  />
                </label>
                <TipoPlacaSelector
                  placaFederal={formEditar.placaFederal}
                  placaLocal={formEditar.placaLocal}
                  onChange={(next) => setFormEditar((f) => ({ ...f, ...next }))}
                />
              </div>
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
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                      Subestatus disponible
                      <select
                        value={formEditar.subestatusDisponible}
                        onChange={(e) => {
                          const v = e.target.value as SubestatusDisponible;
                          setFormEditar((f) => ({
                            ...f,
                            subestatusDisponible: v,
                            pendientePlacasMotivo: v === 'pendiente_placas' ? f.pendientePlacasMotivo : '',
                          }));
                        }}
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
                  {formEditar.subestatusDisponible === 'pendiente_placas' ? (
                    <PendientePlacasMotivoSelector
                      value={formEditar.pendientePlacasMotivo}
                      onChange={(v) => setFormEditar((f) => ({ ...f, pendientePlacasMotivo: v }))}
                    />
                  ) : null}
                </>
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
                      Placa: {textoTipoPlacaTabla(selected)}
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
                        {(selected.subestatusDisponible ?? '') === 'pendiente_placas' &&
                        selected.pendientePlacasMotivo &&
                        (selected.pendientePlacasMotivo === 'baja_placas' ||
                          selected.pendientePlacasMotivo === 'pendiente_importar') ? (
                          <span
                            className="max-w-[14rem] rounded-md border border-amber-200/80 bg-amber-50/90 px-2 py-1 text-center text-[12px] font-medium leading-snug text-amber-950"
                            title={PENDIENTE_PLACAS_MOTIVO_LABEL[selected.pendientePlacasMotivo]}
                          >
                            {PENDIENTE_PLACAS_MOTIVO_LABEL[selected.pendientePlacasMotivo]}
                          </span>
                        ) : null}
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
                Tipo placa: {textoTipoPlacaTabla(previewUnidadNueva)}
              </p>
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
                {previewUnidadNueva.estatus === 'Disponible' &&
                previewUnidadNueva.subestatusDisponible === 'pendiente_placas' &&
                previewUnidadNueva.pendientePlacasMotivo &&
                (previewUnidadNueva.pendientePlacasMotivo === 'baja_placas' ||
                  previewUnidadNueva.pendientePlacasMotivo === 'pendiente_importar')
                  ? ` · Motivo: ${PENDIENTE_PLACAS_MOTIVO_LABEL[previewUnidadNueva.pendientePlacasMotivo]}`
                  : ''}
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
