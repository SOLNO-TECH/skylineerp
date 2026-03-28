const API_BASE = '/api';

/**
 * Si Vite no reenvía /api, define en `.env.local` la URL del **backend** (no la del frontend):
 * VITE_API_ROOT=http://127.0.0.1:3001
 *
 * Si apuntas por error al mismo origen que Vite (p. ej. :5173), /api devuelve index.html y fallan los DELETE.
 */
function resolveApiUrl(path: string): string {
  const raw = (import.meta.env.VITE_API_ROOT as string | undefined)?.trim()?.replace(/\/$/, '') || '';
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!raw) return p;
  try {
    const base = raw.includes('://') ? raw : `http://${raw}`;
    const apiRoot = new URL(base);
    if (typeof window !== 'undefined' && apiRoot.origin === window.location.origin) {
      return p;
    }
    const originAndPath = `${apiRoot.origin}${apiRoot.pathname}`.replace(/\/$/, '');
    return `${originAndPath}${p}`;
  } catch {
    return p;
  }
}
const FETCH_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    return res;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('El servidor no respondió. Comprueba que el backend esté corriendo (npm run dev).');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonOrThrow(res: Response, text: string): unknown {
  const ct = res.headers.get('content-type') || '';
  const looksHtml = ct.includes('text/html') || text.trim().startsWith('<');
  if (looksHtml) {
    let detalle = '';
    if (res.status === 404) {
      detalle =
        ' (404: suele ser ruta API inexistente o backend antiguo; reinicia el proceso «api» del npm run dev).';
    } else if (res.status === 502 || res.status === 504) {
      detalle = ' (el proxy no llegó al puerto 3001; arranca el backend o revisa vite.config).';
    } else {
      detalle =
        ' (a menudo Vite devolvió la página HTML: no uses VITE_API_ROOT apuntando al mismo host que el frontend; déjalo vacío o usa http://127.0.0.1:3001).';
    }
    throw new Error(
      `El servidor devolvió HTML en lugar de JSON.${detalle} Ejecuta «npm run dev» desde la raíz del proyecto (api + web) y abre http://localhost:5173.`
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta inválida del servidor: ${text.slice(0, 100)}`);
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = parseJsonOrThrow(res, text) as T;
  return data;
}

function getToken(): string | null {
  return localStorage.getItem('skyline_token');
}

export type User = {
  id: number;
  email: string;
  nombre: string;
  rol: string;
  avatar?: string;
};

export type PerfilData = User & {
  apellidos: string;
  rfc: string;
  curp: string;
  telefono: string;
  creado_en?: string;
};

export type LoginResponse = {
  success: true;
  token: string;
  user: User;
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseResponse<LoginResponse & { error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || 'Error al iniciar sesión');
  }
  if (!data.success || !data.token) {
    throw new Error('Respuesta inválida del servidor');
  }
  return data;
}

export async function getMe(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetchWithTimeout(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await parseResponse<{ user?: User }>(res);
  return data.user ?? null;
}

export function logoutStorage(): void {
  localStorage.removeItem('skyline_token');
  localStorage.removeItem('skyline_user');
}

export function saveSession(token: string, user: User): void {
  localStorage.setItem('skyline_token', token);
  localStorage.setItem('skyline_user', JSON.stringify(user));
}

export async function getPerfil(): Promise<PerfilData> {
  const res = await fetchWithAuth(`${API_BASE}/perfil`);
  const data = await parseResponse<{ perfil?: PerfilData; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al cargar perfil');
  return data.perfil!;
}

export async function updatePerfil(p: Partial<{ nombre: string; apellidos: string; rfc: string; curp: string; telefono: string }>): Promise<PerfilData> {
  const res = await fetchWithAuth(`${API_BASE}/perfil`, {
    method: 'PUT',
    body: JSON.stringify(p),
  });
  const data = await parseResponse<{ perfil?: PerfilData; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al actualizar perfil');
  return data.perfil!;
}

export async function uploadAvatarPerfil(file: File): Promise<PerfilData> {
  const token = getToken();
  const form = new FormData();
  form.append('avatar', file);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/perfil/avatar`, {
    method: 'POST',
    headers,
    body: form,
  });
  const data = await parseResponse<{ perfil?: PerfilData; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al subir avatar');
  return data.perfil!;
}

export function getAvatarUrl(ruta: string): string {
  return ruta ? `/uploads/${ruta}` : '';
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('skyline_user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const finalUrl =
    url.startsWith('http://') || url.startsWith('https://') ? url : resolveApiUrl(url);
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  return fetchWithTimeout(finalUrl, { ...options, headers });
}

/** Geocodificación vía API: Nominatim exige User-Agent identificable (no usable en fetch directo desde el navegador). */
export async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const q = address.trim();
  if (!q || q.length > 500) return null;
  const res = await fetchWithAuth(`${API_BASE}/geocode?q=${encodeURIComponent(q)}`);
  const data = await parseResponse<{ lat?: number | null; lon?: number | null; error?: string }>(res);
  if (!res.ok) return null;
  if (
    data.lat != null &&
    data.lon != null &&
    Number.isFinite(data.lat) &&
    Number.isFinite(data.lon)
  ) {
    return [data.lat, data.lon];
  }
  return null;
}

export async function reverseGeocodeCoords(lat: number, lon: number): Promise<string | null> {
  const res = await fetchWithAuth(`${API_BASE}/reverse-geocode?lat=${lat}&lon=${lon}`);
  const data = await parseResponse<{ displayName?: string | null; error?: string }>(res);
  if (!res.ok) return null;
  const name = data.displayName?.trim();
  return name || null;
}

export type UsuarioRow = User & { activo: number; creado_en?: string };

export async function getUsuarios(): Promise<UsuarioRow[]> {
  const res = await fetchWithAuth(`${API_BASE}/usuarios`);
  const data = await parseResponse<{ usuarios?: UsuarioRow[]; error?: string }>(res);
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Error al cargar usuarios');
  return data.usuarios ?? [];
}

export async function createUsuario(p: { email: string; password: string; nombre: string; rol: string }): Promise<UsuarioRow> {
  const res = await fetchWithAuth(`${API_BASE}/usuarios`, {
    method: 'POST',
    body: JSON.stringify(p),
  });
  const data = await parseResponse<{ usuario?: UsuarioRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
  return data.usuario!;
}

export async function updateUsuario(id: number, p: { nombre?: string; rol?: string; password?: string; activo?: boolean }): Promise<UsuarioRow> {
  const res = await fetchWithAuth(`${API_BASE}/usuarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(p),
  });
  const data = await parseResponse<{ usuario?: UsuarioRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al actualizar usuario');
  return data.usuario!;
}

export async function deleteUsuario(id: number): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/usuarios/${id}`, { method: 'DELETE' });
  const data = await parseResponse<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al desactivar usuario');
}

export async function getRoles(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/roles`);
  const data = await parseResponse<{ roles?: string[] }>(res);
  if (!res.ok) return [];
  return data.roles ?? [];
}

/* ─── Proveedores y cuentas por pagar ─── */

export type ProveedorResumen = {
  id: string;
  nombreRazonSocial: string;
  rfc: string;
  contactoNombre: string;
  contactoTelefono: string;
  contactoEmail: string;
  direccion: string;
  notas: string;
  activo: boolean;
  creadoEn?: string;
  actualizadoEn?: string;
  totalFacturado: number;
  totalPagado: number;
  saldoPendiente: number;
};

export type ProveedorFacturaPagoRow = {
  id: string;
  facturaId: string;
  fechaPago: string;
  monto: number;
  metodo: string;
  referencia: string;
  observaciones: string;
  creadoEn: string;
};

export type ProveedorFacturaRow = {
  id: string;
  proveedorId: string;
  numero: string;
  fechaEmision: string;
  montoTotal: number;
  concepto: string;
  unidadId: string | null;
  unidadPlacas?: string | null;
  unidadMarca?: string | null;
  unidadModelo?: string | null;
  archivoRuta: string;
  archivoNombreOriginal: string;
  creadoEn: string;
  totalPagado: number;
  saldoPendiente: number;
  estado: 'pendiente' | 'parcial' | 'pagada';
  pagos: ProveedorFacturaPagoRow[];
};

export type ProveedorDetalle = ProveedorResumen & {
  facturas: ProveedorFacturaRow[];
  resumenFacturas: { pagadas: number; parciales: number; pendientes: number };
};

export type FacturaPendienteReporte = {
  facturaId: string;
  proveedorId: string;
  numero: string;
  fechaEmision: string;
  montoTotal: number;
  concepto: string;
  totalPagado: number;
  saldoPendiente: number;
  estado: string;
  unidadId: string | null;
  unidadPlacas: string | null;
};

export type ReporteCuentasPorPagar = {
  proveedores: ProveedorResumen[];
  facturasPendientesDetalle: FacturaPendienteReporte[];
  totalesGlobales: { facturado: number; pagado: number; saldo: number };
};

export type ReportePorUnidad = {
  unidadId: string;
  placas: string;
  marca: string;
  modelo: string;
  totalFacturado: number;
  totalPagado: number;
  saldoPendiente: number;
  numFacturas: number;
};

export async function getProveedores(): Promise<ProveedorResumen[]> {
  const res = await fetchWithAuth(`${API_BASE}/proveedores`);
  const data = await parseResponse<{ proveedores?: ProveedorResumen[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al cargar proveedores');
  return data.proveedores ?? [];
}

export async function getProveedor(id: string): Promise<ProveedorDetalle> {
  const res = await fetchWithAuth(`${API_BASE}/proveedores/${id}`);
  const data = await parseResponse<{ proveedor?: ProveedorDetalle; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al cargar proveedor');
  return data.proveedor!;
}

export async function createProveedorApi(p: {
  nombreRazonSocial: string;
  rfc?: string;
  contactoNombre?: string;
  contactoTelefono?: string;
  contactoEmail?: string;
  direccion?: string;
  notas?: string;
}): Promise<ProveedorDetalle> {
  const res = await fetchWithAuth(`${API_BASE}/proveedores`, {
    method: 'POST',
    body: JSON.stringify(p),
  });
  const data = await parseResponse<{ proveedor?: ProveedorDetalle; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al crear proveedor');
  return data.proveedor!;
}

export async function updateProveedorApi(
  id: string,
  p: Partial<{
    nombreRazonSocial: string;
    rfc: string;
    contactoNombre: string;
    contactoTelefono: string;
    contactoEmail: string;
    direccion: string;
    notas: string;
  }>
): Promise<ProveedorDetalle> {
  const res = await fetchWithAuth(`${API_BASE}/proveedores/${id}`, {
    method: 'PUT',
    body: JSON.stringify(p),
  });
  const data = await parseResponse<{ proveedor?: ProveedorDetalle; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al actualizar proveedor');
  return data.proveedor!;
}

export async function deleteProveedorApi(id: string): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/proveedores/${id}`, { method: 'DELETE' });
  const data = await parseResponse<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al desactivar proveedor');
}

export async function createProveedorFactura(
  proveedorId: string,
  fields: {
    numero: string;
    fechaEmision: string;
    montoTotal: number;
    concepto?: string;
    unidadId?: string;
    archivo?: File | null;
  }
): Promise<ProveedorDetalle> {
  const token = getToken();
  const form = new FormData();
  form.append('numero', fields.numero);
  form.append('fechaEmision', fields.fechaEmision);
  form.append('montoTotal', String(fields.montoTotal));
  if (fields.concepto) form.append('concepto', fields.concepto);
  if (fields.unidadId) form.append('unidadId', fields.unidadId);
  if (fields.archivo) form.append('archivo', fields.archivo);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchWithTimeout(`${API_BASE}/proveedores/${proveedorId}/facturas`, {
    method: 'POST',
    headers,
    body: form,
  });
  const data = await parseResponse<{ proveedor?: ProveedorDetalle; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al registrar factura');
  return data.proveedor!;
}

export async function addPagoProveedorFactura(
  proveedorId: string,
  facturaId: string,
  p: {
    fechaPago: string;
    monto: number;
    metodo?: string;
    referencia?: string;
    observaciones?: string;
  }
): Promise<ProveedorDetalle> {
  const res = await fetchWithAuth(`${API_BASE}/proveedores/${proveedorId}/facturas/${facturaId}/pagos`, {
    method: 'POST',
    body: JSON.stringify(p),
  });
  const data = await parseResponse<{ proveedor?: ProveedorDetalle; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al registrar pago');
  return data.proveedor!;
}

export async function deleteProveedorFacturaApi(proveedorId: string, facturaId: string): Promise<ProveedorDetalle> {
  const res = await fetchWithAuth(`${API_BASE}/proveedores/${proveedorId}/facturas/${facturaId}`, {
    method: 'DELETE',
  });
  const data = await parseResponse<{ proveedor?: ProveedorDetalle; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al eliminar factura');
  return data.proveedor!;
}

export async function getReporteCuentasPorPagarApi(): Promise<ReporteCuentasPorPagar> {
  const res = await fetchWithAuth(`${API_BASE}/proveedores/reportes/cuentas-pagar`);
  const data = await parseResponse<ReporteCuentasPorPagar & { error?: string }>(res);
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Error al cargar reporte');
  return data as ReporteCuentasPorPagar;
}

export async function getReporteProveedoresPorUnidadApi(): Promise<ReportePorUnidad[]> {
  const res = await fetchWithAuth(`${API_BASE}/proveedores/reportes/por-unidad`);
  const data = await parseResponse<{ unidades?: ReportePorUnidad[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al cargar reporte');
  return data.unidades ?? [];
}

/* ─── Unidades ─── */
export type UnidadDoc = { id: string; nombre: string; tipo: string; fechaSubida: string };
export type UnidadAct = { id: string; accion: string; detalle: string; fecha: string; icon: string };
export type UnidadImg = { id: string; nombreArchivo: string; ruta: string; descripcion: string; fechaSubida: string };

export type UnidadRow = {
  id: string;
  placas: string;
  marca: string;
  modelo: string;
  estatus: 'Disponible' | 'En Renta' | 'Taller';
  kilometraje: number;
  combustiblePct: number;
  observaciones: string;
  tipoUnidad?: 'remolque_seco' | 'refrigerado' | 'maquinaria';
  estadoMantenimiento?: 'disponible' | 'en_mantenimiento' | 'fuera_de_servicio';
  horasMotor?: number;
  documentos: UnidadDoc[];
  actividad: UnidadAct[];
  imagenes?: UnidadImg[];
};

export async function getUnidades(): Promise<UnidadRow[]> {
  const res = await fetchWithAuth(`${API_BASE}/unidades`);
  const data = await parseResponse<{ unidades?: UnidadRow[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al cargar unidades');
  return data.unidades ?? [];
}

export async function getUnidad(id: string): Promise<UnidadRow> {
  const res = await fetchWithAuth(`${API_BASE}/unidades/${id}`);
  const data = await parseResponse<{ unidad?: UnidadRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al cargar unidad');
  return data.unidad!;
}

export async function createUnidad(p: {
  placas: string;
  marca: string;
  modelo: string;
  estatus?: string;
  kilometraje?: number;
  combustiblePct?: number;
  observaciones?: string;
  tipoUnidad?: 'remolque_seco' | 'refrigerado' | 'maquinaria';
  horasMotor?: number;
}): Promise<UnidadRow> {
  const res = await fetchWithAuth(`${API_BASE}/unidades`, {
    method: 'POST',
    body: JSON.stringify(p),
  });
  const data = await parseResponse<{ unidad?: UnidadRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al crear unidad');
  return data.unidad!;
}

export async function updateUnidad(
  id: string,
  p: Partial<{
    placas: string;
    marca: string;
    modelo: string;
    estatus: string;
    kilometraje: number;
    combustiblePct: number;
    observaciones: string;
    tipoUnidad: string;
    estadoMantenimiento: string;
    horasMotor: number;
  }>
): Promise<UnidadRow> {
  const res = await fetchWithAuth(`${API_BASE}/unidades/${id}`, {
    method: 'PUT',
    body: JSON.stringify(p),
  });
  const data = await parseResponse<{ unidad?: UnidadRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al actualizar unidad');
  return data.unidad!;
}

export async function setEstatusUnidad(id: string, estatus: string): Promise<UnidadRow> {
  const res = await fetchWithAuth(`${API_BASE}/unidades/${id}/estatus`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estatus }),
  });
  const data = await parseResponse<{ unidad?: UnidadRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al actualizar estatus');
  return data.unidad!;
}

export async function addDocumentoUnidad(id: string, tipo: string, nombre: string): Promise<UnidadRow> {
  const res = await fetchWithAuth(`${API_BASE}/unidades/${id}/documentos`, {
    method: 'POST',
    body: JSON.stringify({ tipo, nombre }),
  });
  const data = await parseResponse<{ unidad?: UnidadRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al agregar documento');
  return data.unidad!;
}

export async function addActividadUnidad(
  id: string,
  accion: string,
  detalle: string,
  icon?: string
): Promise<UnidadRow> {
  const res = await fetchWithAuth(`${API_BASE}/unidades/${id}/actividad`, {
    method: 'POST',
    body: JSON.stringify({ accion, detalle, icon }),
  });
  const data = await parseResponse<{ unidad?: UnidadRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al registrar actividad');
  return data.unidad!;
}

export async function deleteUnidad(id: string): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/unidades/${id}`, { method: 'DELETE' });
  const data = await parseResponse<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al eliminar unidad');
}

export function getImagenUrl(ruta: string): string {
  return `/uploads/${ruta}`;
}

export async function uploadImagenUnidad(
  id: string,
  file: File,
  descripcion?: string
): Promise<UnidadRow> {
  const token = getToken();
  const form = new FormData();
  form.append('imagen', file);
  if (descripcion) form.append('descripcion', descripcion);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/unidades/${id}/imagenes`, {
    method: 'POST',
    headers,
    body: form,
  });
  const data = await parseResponse<{ unidad?: UnidadRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al subir imagen');
  return data.unidad!;
}

export async function deleteImagenUnidad(unidadId: string, imgId: string): Promise<UnidadRow> {
  const res = await fetchWithAuth(`${API_BASE}/unidades/${unidadId}/imagenes/${imgId}`, {
    method: 'DELETE',
  });
  const data = await parseResponse<{ unidad?: UnidadRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al eliminar imagen');
  return data.unidad!;
}

/* ─── Rentas ─── */
export type RentaRefrigerado = {
  temperaturaObjetivo: number;
  combustibleInicio: number;
  combustibleFin: number;
  horasMotorInicio: number;
  horasMotorFin: number;
  observaciones: string;
};

export type RentaMaquinaria = {
  operadorAsignado: string;
  horasTrabajadas: number;
  tipoTrabajo: string;
  observaciones: string;
};

export type PagoRow = {
  id: string;
  monto: number;
  tipo: string;
  metodo: string;
  fecha: string;
  referencia: string;
  observaciones: string;
  creadoEn: string;
};

export type RentaDocumento = {
  id: string;
  tipo: string;
  nombre: string;
  ruta: string;
  creadoEn: string;
};

export type RentaHistorialItem = {
  id: string;
  accion: string;
  detalle: string;
  fecha: string;
};

export type RentaRow = {
  id: string;
  unidadId: string;
  placas: string;
  marca: string;
  modelo: string;
  tipoUnidad?: 'remolque_seco' | 'refrigerado' | 'maquinaria';
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail: string;
  fechaInicio: string;
  fechaFin: string;
  estado: 'reservada' | 'activa' | 'finalizada' | 'cancelada';
  monto: number;
  deposito: number;
  observaciones: string;
  creadoEn?: string;
  tipoServicio?: 'solo_renta' | 'con_operador' | 'con_transporte';
  ubicacionEntrega?: string;
  ubicacionRecoleccion?: string;
  estadoLogistico?: 'programado' | 'en_camino' | 'entregado' | 'finalizado';
  precioBase?: number;
  extras?: number;
  operadorAsignado?: string;
  refrigerado?: RentaRefrigerado | null;
  maquinaria?: RentaMaquinaria | null;
  pagos?: PagoRow[];
  documentos?: RentaDocumento[];
  historial?: RentaHistorialItem[];
};

export type RentaCalendario = {
  id: string;
  unidadId: string;
  placas: string;
  tipoUnidad?: string;
  clienteNombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  estadoLogistico?: string;
};

export type ActividadItem = {
  tipo: 'unidad' | 'renta' | 'usuario' | 'mantenimiento' | 'auth' | 'sistema' | 'proveedor';
  id: string;
  accion: string;
  detalle: string;
  fecha: string;
  icon: string;
  placas?: string;
  clienteNombre?: string;
  rentaId?: string;
  unidadId?: string;
  mantenimientoId?: string;
  usuarioNombre?: string;
};

export type VencimientoRenta = {
  id: string;
  unidadId: string;
  placas: string;
  marca: string;
  modelo: string;
  clienteNombre: string;
  fechaFin: string;
  estado: string;
};

export async function getActividadReciente(limit = 15): Promise<ActividadItem[]> {
  const res = await fetchWithAuth(`${API_BASE}/actividad?limit=${limit}`);
  const data = await parseResponse<{ actividad?: ActividadItem[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al cargar actividad');
  return data.actividad ?? [];
}

export async function getRentasProximosVencimientos(dias = 14): Promise<VencimientoRenta[]> {
  const res = await fetchWithAuth(`${API_BASE}/rentas/vencimientos?dias=${dias}`);
  const data = await parseResponse<{ rentas?: VencimientoRenta[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al cargar vencimientos');
  return data.rentas ?? [];
}

export async function getRentas(): Promise<RentaRow[]> {
  const res = await fetchWithAuth(`${API_BASE}/rentas`);
  const data = await parseResponse<{ rentas?: RentaRow[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al cargar rentas');
  return data.rentas ?? [];
}

export async function getRentasCalendario(ano: number, mes: number): Promise<RentaCalendario[]> {
  const res = await fetchWithAuth(`${API_BASE}/rentas/calendario?ano=${ano}&mes=${mes}`);
  const data = await parseResponse<{ rentas?: RentaCalendario[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al cargar calendario');
  return data.rentas ?? [];
}

export async function getRenta(id: string): Promise<RentaRow> {
  const res = await fetchWithAuth(`${API_BASE}/rentas/${id}`);
  const data = await parseResponse<{ renta?: RentaRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al cargar renta');
  return data.renta!;
}

export async function createRenta(p: {
  unidadId: string;
  clienteNombre: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  fechaInicio: string;
  fechaFin: string;
  monto?: number;
  deposito?: number;
  observaciones?: string;
  tipoServicio?: string;
  ubicacionEntrega?: string;
  ubicacionRecoleccion?: string;
  precioBase?: number;
  extras?: number;
  operadorAsignado?: string;
  refrigerado?: Partial<RentaRefrigerado>;
  maquinaria?: Partial<RentaMaquinaria>;
}): Promise<RentaRow> {
  const res = await fetchWithAuth(`${API_BASE}/rentas`, {
    method: 'POST',
    body: JSON.stringify({
      unidadId: p.unidadId,
      clienteNombre: p.clienteNombre,
      clienteTelefono: p.clienteTelefono ?? '',
      clienteEmail: p.clienteEmail ?? '',
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,
      monto: p.monto ?? 0,
      deposito: p.deposito ?? 0,
      observaciones: p.observaciones ?? '',
      tipoServicio: p.tipoServicio ?? 'solo_renta',
      ubicacionEntrega: p.ubicacionEntrega ?? '',
      ubicacionRecoleccion: p.ubicacionRecoleccion ?? '',
      precioBase: p.precioBase,
      extras: p.extras,
      operadorAsignado: p.operadorAsignado ?? '',
      refrigerado: p.refrigerado,
      maquinaria: p.maquinaria,
    }),
  });
  const data = await parseResponse<{ renta?: RentaRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al crear renta');
  return data.renta!;
}

export async function updateRenta(
  id: string,
  p: Partial<{
    unidadId: string;
    clienteNombre: string;
    clienteTelefono: string;
    clienteEmail: string;
    fechaInicio: string;
    fechaFin: string;
    estado: string;
    monto: number;
    deposito: number;
    observaciones: string;
    tipoServicio: string;
    ubicacionEntrega: string;
    ubicacionRecoleccion: string;
    estadoLogistico: string;
    precioBase: number;
    extras: number;
    operadorAsignado: string;
    refrigerado: Partial<RentaRefrigerado>;
    maquinaria: Partial<RentaMaquinaria>;
  }>
): Promise<RentaRow> {
  const res = await fetchWithAuth(`${API_BASE}/rentas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(p),
  });
  const data = await parseResponse<{ renta?: RentaRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al actualizar renta');
  return data.renta!;
}

export async function deleteRenta(id: string): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/rentas/${id}`, { method: 'DELETE' });
  const data = await parseResponse<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al eliminar renta');
}

export async function addPagoRenta(rentaId: string, p: { monto: number; tipo?: string; metodo?: string; fecha?: string; referencia?: string; observaciones?: string }): Promise<RentaRow> {
  const res = await fetchWithAuth(`${API_BASE}/rentas/${rentaId}/pagos`, {
    method: 'POST',
    body: JSON.stringify(p),
  });
  const data = await parseResponse<{ renta?: RentaRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al registrar pago');
  return data.renta!;
}

export async function uploadDocumentoRenta(rentaId: string, file: File, tipo: string, nombre?: string): Promise<RentaRow> {
  const token = getToken();
  const form = new FormData();
  form.append('documento', file);
  form.append('tipo', tipo);
  if (nombre) form.append('nombre', nombre);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/rentas/${rentaId}/documentos`, {
    method: 'POST',
    headers,
    body: form,
  });
  const data = await parseResponse<{ renta?: RentaRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al subir documento');
  return data.renta!;
}

/* ─── Mantenimiento ─── */
export type MantenimientoRow = {
  id: string;
  unidadId: string;
  placas?: string;
  marca?: string;
  modelo?: string;
  tipo: string;
  descripcion: string;
  costo: number;
  fechaInicio: string;
  fechaFin: string | null;
  estado: string;
  creadoEn: string;
};

export async function getMantenimientos(): Promise<MantenimientoRow[]> {
  const res = await fetchWithAuth(`${API_BASE}/mantenimiento`);
  const data = await parseResponse<{ mantenimientos?: MantenimientoRow[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al cargar mantenimientos');
  return data.mantenimientos ?? [];
}

export async function getMantenimientosUnidad(unidadId: string): Promise<MantenimientoRow[]> {
  const res = await fetchWithAuth(`${API_BASE}/unidades/${unidadId}/mantenimiento`);
  const data = await parseResponse<{ mantenimientos?: MantenimientoRow[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al cargar historial');
  return data.mantenimientos ?? [];
}

export async function createMantenimiento(p: {
  unidadId: string;
  tipo?: string;
  descripcion?: string;
  costo?: number;
  fechaInicio: string;
  fechaFin?: string;
  estado?: string;
}): Promise<MantenimientoRow> {
  const res = await fetchWithAuth(`${API_BASE}/mantenimiento`, {
    method: 'POST',
    body: JSON.stringify(p),
  });
  const data = await parseResponse<{ mantenimiento?: MantenimientoRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al crear mantenimiento');
  return data.mantenimiento!;
}

export async function updateMantenimiento(id: string, p: Partial<{ tipo: string; descripcion: string; costo: number; fechaInicio: string; fechaFin: string | null; estado: string }>): Promise<MantenimientoRow> {
  const res = await fetchWithAuth(`${API_BASE}/mantenimiento/${id}`, {
    method: 'PUT',
    body: JSON.stringify(p),
  });
  const data = await parseResponse<{ mantenimiento?: MantenimientoRow; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al actualizar mantenimiento');
  return data.mantenimiento!;
}

/* ─── Check-in / Check-out ─── */
export type ChecklistItemPayload = { id: string; label: string; presente: boolean };

export type CheckinOutRegistro = {
  id: string;
  tipo: 'checkin' | 'checkout';
  unidadId: string;
  placas: string;
  marca: string;
  modelo: string;
  rentaId: string | null;
  rentaCliente: string | null;
  usuarioId: string | null;
  usuarioNombre: string | null;
  colaboradorNombre: string;
  colaboradorRol: string;
  kilometraje: number | null;
  combustiblePct: number | null;
  checklist: ChecklistItemPayload[];
  observaciones: string;
  creadoEn: string;
};

export async function getCheckinOutRegistros(limit = 80): Promise<CheckinOutRegistro[]> {
  const res = await fetchWithAuth(`${API_BASE}/checkin-out?limit=${limit}`);
  const data = await parseResponse<{ registros?: CheckinOutRegistro[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al cargar registros');
  return data.registros ?? [];
}

export async function createCheckinOutRegistro(p: {
  tipo: 'checkin' | 'checkout';
  unidadId: string;
  rentaId?: string | null;
  colaboradorNombre?: string;
  colaboradorRol?: string;
  kilometraje?: number | string;
  combustiblePct?: number | string;
  checklist: ChecklistItemPayload[];
  observaciones?: string;
}): Promise<CheckinOutRegistro> {
  const res = await fetchWithAuth(`${API_BASE}/checkin-out`, {
    method: 'POST',
    body: JSON.stringify(p),
  });
  const data = await parseResponse<{ registro?: CheckinOutRegistro; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al registrar');
  return data.registro!;
}

export async function updateCheckinOutRegistro(
  id: string,
  p: {
    tipo: 'checkin' | 'checkout';
    unidadId: string;
    rentaId?: string | null;
    colaboradorNombre?: string;
    colaboradorRol?: string;
    kilometraje?: number | string;
    combustiblePct?: number | string;
    checklist: ChecklistItemPayload[];
    observaciones?: string;
  }
): Promise<CheckinOutRegistro> {
  const res = await fetchWithAuth(`${API_BASE}/checkin-out/${id}`, {
    method: 'PUT',
    body: JSON.stringify(p),
  });
  const data = await parseResponse<{ registro?: CheckinOutRegistro; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Error al actualizar');
  return data.registro!;
}

export async function deleteCheckinOutRegistro(id: string): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/checkin-out/${id}`, { method: 'DELETE' });
  if (res.ok) return;
  const data = await parseResponse<{ error?: string }>(res);
  throw new Error(data.error || 'Error al eliminar');
}

export type SoporteChatMessage = { role: 'user' | 'assistant'; content: string };

export type SoporteChatResponse = { reply: string; source?: string };

const SOPORTE_TIMEOUT_MS = 30000;

export async function downloadReporteCatalogoCrudXlsx(params?: {
  desde?: string;
  hasta?: string;
}): Promise<void> {
  const qs = new URLSearchParams();
  if (params?.desde) qs.set('desde', params.desde);
  if (params?.hasta) qs.set('hasta', params.hasta);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchWithAuth(`${API_BASE}/reportes/export-crud-xlsx${suffix}`);
  if (!res.ok) {
    const text = await res.text();
    let msg = 'Error al exportar';
    try {
      const data = JSON.parse(text) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/html') || ct.startsWith('text/')) {
    throw new Error(
      'El servidor devolvió texto/HTML. Comprueba que el backend esté activo (npm run dev) y la URL de desarrollo.'
    );
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date().toISOString().slice(0, 10);
  const span =
    params?.desde && params?.hasta
      ? `${params.desde}_a_${params.hasta}`
      : params?.desde
      ? `desde_${params.desde}`
      : params?.hasta
      ? `hasta_${params.hasta}`
      : '';
  a.href = url;
  a.download = `skyline-catalogo-crud${span ? `-${span}` : ''}-${d}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function sendSoporteChat(messages: SoporteChatMessage[]): Promise<SoporteChatResponse> {
  const token = getToken();
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), SOPORTE_TIMEOUT_MS);
  try {
    const headers = new Headers({
      'Content-Type': 'application/json',
    });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const url = resolveApiUrl(`${API_BASE}/soporte/chat`);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages }),
      signal: ctrl.signal,
    });
    const data = await parseResponse<SoporteChatResponse & { error?: string }>(res);
    if (!res.ok) throw new Error(data.error || 'Error de soporte');
    if (!data.reply?.trim()) throw new Error('Respuesta vacía del asistente');
    return { reply: data.reply, source: data.source };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('El asistente tardó demasiado. Intenta de nuevo con una pregunta más corta.');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
