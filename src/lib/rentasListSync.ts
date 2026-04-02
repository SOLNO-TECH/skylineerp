/** Avisar a listados (p. ej. Pagos) que cambió una renta o sus pagos. */

export const RENTAS_LIST_BUMP_EVENT = 'skyline-rentas-list-bump';
export const RENTAS_LIST_BUMP_STORAGE_KEY = 'skyline_rentas_list_bump';

export function notifyRentasListChanged() {
  try {
    localStorage.setItem(RENTAS_LIST_BUMP_STORAGE_KEY, String(Date.now()));
  } catch {
    /* private mode, etc. */
  }
  window.dispatchEvent(new CustomEvent(RENTAS_LIST_BUMP_EVENT));
}
