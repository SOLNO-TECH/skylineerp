/** Valores `tipo_unidad` persistidos en BD y enviados por la API. */
export const TIPOS_UNIDAD_OPCIONES = [
  { v: 'remolque_seco', l: 'Remolque seco' },
  { v: 'refrigerado', l: 'Refrigerado' },
  { v: 'maquinaria', l: 'Mulita' },
  { v: 'dolly', l: 'Dolly' },
  { v: 'plataforma', l: 'Plataforma' },
  { v: 'camion', l: 'Camión' },
  { v: 'vehiculo_empresarial', l: 'Vehículo empresarial' },
  { v: 'caja_refrigerada_sin_termo', l: 'Caja refrigerada sin termo' },
  { v: 'pickup', l: 'Pickup' },
] as const;

export type TipoUnidadCatalogo = (typeof TIPOS_UNIDAD_OPCIONES)[number]['v'];

const LABEL: Record<TipoUnidadCatalogo, string> = {
  remolque_seco: 'Remolque seco',
  refrigerado: 'Refrigerado',
  maquinaria: 'Mulita',
  dolly: 'Dolly',
  plataforma: 'Plataforma',
  camion: 'Camión',
  vehiculo_empresarial: 'Vehículo empresarial',
  caja_refrigerada_sin_termo: 'Caja refrigerada sin termo',
  pickup: 'Pickup',
};

export function labelTipoUnidad(v?: string | null): string {
  if (!v) return LABEL.remolque_seco;
  return LABEL[v as TipoUnidadCatalogo] ?? v;
}

/** Rentas / BD: datos extendidos de equipo refrigerado */
export function esTipoRefrigeradoCatalogo(v?: string | null): boolean {
  return v === 'refrigerado' || v === 'caja_refrigerada_sin_termo';
}

/** Sugerencia inicial de modalidad en check-in según catálogo. */
export function sugerenciaModalidadCheckin(
  tipoUnidad?: string | null
): 'caja_seca' | 'refrigerado' | 'mulita_patio' {
  if (esTipoRefrigeradoCatalogo(tipoUnidad)) return 'refrigerado';
  if (tipoUnidad === 'maquinaria') return 'mulita_patio';
  return 'caja_seca';
}

/** Sufijo corto en selects largos (listas de unidades). */
export function tipoUnidadSufijoOpcion(t?: string | null): string {
  if (!t) return '';
  if (t === 'refrigerado') return ' · Ref.';
  if (t === 'caja_refrigerada_sin_termo') return ' · Ref.s/t';
  if (t === 'maquinaria') return ' · Mul.';
  if (t === 'dolly') return ' · Dolly';
  if (t === 'pickup') return ' · Pickup';
  if (t === 'camion') return ' · Camión';
  if (t === 'plataforma') return ' · Plat.';
  if (t === 'vehiculo_empresarial') return ' · Veh.emp.';
  return '';
}
