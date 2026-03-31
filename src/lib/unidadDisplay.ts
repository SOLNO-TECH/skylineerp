import type { UnidadRow } from '../api/client';

/** Etiqueta compacta para selectores y listas: número económico primero, luego placas y datos de catálogo. */
export function etiquetaUnidadLista(u: Pick<UnidadRow, 'numeroEconomico' | 'placas' | 'marca' | 'modelo'>): string {
  const ne = (u.numeroEconomico ?? '').trim();
  const rest = `${u.placas} — ${u.marca} ${u.modelo}`;
  return ne ? `${ne} · ${rest}` : rest;
}
