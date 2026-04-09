import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs, { existsSync } from 'fs';
import {
  initDb,
  db,
  createUsuario,
  getAllUsuarios,
  getUsuarioByIdAdmin,
  getUsuarioPerfil,
  updateUsuario,
  eliminarUsuarioDefinitivo,
  existeUsuarioPorEmail,
  getAllUnidades,
  getUnidadById,
  createUnidad,
  updateUnidadDb,
  setEstatusUnidad,
  addUnidadDocumento,
  deleteUnidadDocumento,
  addUnidadActividad,
  addUnidadImagen,
  deleteUnidadImagen,
  setUnidadExpedienteFoto,
  clearUnidadExpedienteFotoSlot,
  deleteUnidad,
  existePlacas,
  existeNumeroEconomico,
  getAllRentas,
  getRentaById,
  getRentasPorMes,
  createRenta,
  updateRenta,
  deleteRenta,
  addPago,
  addRentaDocumento,
  getAllMantenimientos,
  getMantenimientosByUnidad,
  createMantenimiento,
  updateMantenimiento,
  getActividadReciente,
  getRentasProximosVencimientos,
  registrarLoginUsuario,
  getCheckinOutRegistros,
  createCheckinOutRegistro,
  updateCheckinOutRegistro,
  deleteCheckinOutRegistro,
  getAllProveedores,
  getProveedoresCatalogo,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  deleteProveedorFactura,
  createProveedorFactura,
  addPagoProveedorFactura,
  getReporteCuentasPorPagar,
  getReporteProveedoresPorUnidad,
  getFinanzasGastosResumen,
  addCheckinOutImagen,
  deleteCheckinOutImagen,
  getCheckinOutRegistroById,
  getAllClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteClienteSoft,
  addClienteDocumento,
  deleteClienteDocumento,
  getUsuariosCatalogoOperadores,
} from './db.js';
import {
  login,
  requireAuth,
  requireRole,
  requireAccesoClientes,
  requireEdicionFlota,
  ROLES,
} from './auth.js';
import { getSoporteReply } from './soporteChat.js';
import { generarBufferExportCrudXlsx } from './exportCatalogoCrud.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** En Docker monta un volumen aquí para persistir BD (y uploads bajo `uploads/`). Ver docker-compose. */
const DATA_DIR = process.env.SKYLINE_DATA_DIR?.trim() || __dirname;
const UPLOADS_BASE = join(DATA_DIR, 'uploads');
const UPLOADS_DIR = join(UPLOADS_BASE, 'unidades');
const DOCS_DIR = join(UPLOADS_BASE, 'documentos');
const AVATAR_DIR = join(UPLOADS_BASE, 'avatares');
const CHECKIN_FOTOS_DIR = join(UPLOADS_BASE, 'checkin-out');
const CLIENTE_DOCS_DIR = join(UPLOADS_BASE, 'clientes');

initDb();

/** Si la BD no tiene usuarios (deploy nuevo), opción de crear admin@skyline.com vía env. */
function bootstrapAdminIfNoUsers() {
  const n = db.prepare('SELECT COUNT(*) as c FROM usuarios').get().c;
  if (n > 0) return;
  const pwd = process.env.SKYLINE_INITIAL_ADMIN_PASSWORD?.trim();
  if (!pwd || pwd.length < 8) {
    console.warn(
      '[Skyline ERP] La base de datos no tiene usuarios. ' +
        'En el contenedor ejecute: cd /app/server && node seed.js ' +
        'o defina SKYLINE_INITIAL_ADMIN_PASSWORD (mín. 8 caracteres) y reinicie para crear admin@skyline.com.'
    );
    return;
  }
  try {
    const hash = bcrypt.hashSync(pwd, 10);
    createUsuario('admin@skyline.com', hash, 'Administrador', ROLES.ADMIN, null);
    console.warn('[Skyline ERP] Usuario inicial creado: admin@skyline.com');
  } catch (e) {
    console.error('[Skyline ERP] No se pudo crear el administrador inicial:', e?.message || e);
  }
}

bootstrapAdminIfNoUsers();

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(DOCS_DIR, { recursive: true });
fs.mkdirSync(AVATAR_DIR, { recursive: true });
fs.mkdirSync(CHECKIN_FOTOS_DIR, { recursive: true });
fs.mkdirSync(CLIENTE_DOCS_DIR, { recursive: true });

/** Serie de caja: acepta camelCase, snake_case o alias por si el cliente/proxy transforma el JSON. */
function pickNumeroSerieCaja(body) {
  if (!body || typeof body !== 'object') return undefined;
  if (
    !('numeroSerieCaja' in body) &&
    !('numero_serie_caja' in body) &&
    !('numeroSerie' in body) &&
    !('serie' in body) &&
    !('numero_serie' in body)
  ) {
    return undefined;
  }
  const v =
    body.numeroSerieCaja ??
    body.numero_serie_caja ??
    body.numeroSerie ??
    body.serie ??
    body.numero_serie;
  return String(v ?? '').trim();
}

/** Evita multipart/proxy: el cliente envía base64 + nombreArchivo. */
function saveUnidadDocumentoFromBase64(unidadId, nombreArchivo, archivoBase64) {
  const b64 = String(archivoBase64)
    .replace(/^data:[^;]+;base64,/i, '')
    .replace(/\s/g, '')
    .trim();
  if (!b64) throw new Error('Archivo vacío');
  let buf;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch {
    throw new Error('Contenido del archivo inválido (base64)');
  }
  if (!buf.length) throw new Error('Archivo vacío');
  if (buf.length > 20 * 1024 * 1024) throw new Error('El archivo supera el máximo de 20 MB');
  const dir = join(DOCS_DIR, String(unidadId));
  fs.mkdirSync(dir, { recursive: true });
  const safeName = String(nombreArchivo || 'documento').replace(/[\\/]/g, '_');
  const extMatch = safeName.match(/\.\w+$/);
  const ext = extMatch ? extMatch[0] : '.bin';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  const fullPath = join(dir, filename);
  fs.writeFileSync(fullPath, buf);
  return { nombre: safeName, ruta: `documentos/${unidadId}/${filename}` };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = join(UPLOADS_DIR, String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = (file.originalname.match(/\.\w+$/) || ['.jpg'])[0];
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, ok);
  },
});

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, AVATAR_DIR);
  },
  filename: (req, file, cb) => {
    const ext = (file.originalname.match(/\.\w+$/) || ['.jpg'])[0];
    cb(null, `user-${req.user.id}${ext}`);
  },
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, ok);
  },
});

const checkinFotoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = join(CHECKIN_FOTOS_DIR, String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.\w+$/) || ['.jpg'])[0];
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  },
});
const uploadCheckinFoto = multer({
  storage: checkinFotoStorage,
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const ok =
      /^image\/(jpeg|png|gif|webp)$/i.test(mime) ||
      /^video\/(mp4|webm|quicktime|ogg)$/i.test(mime) ||
      /\.(mp4|webm|mov|ogv|ogg)$/i.test(file.originalname || '');
    cb(null, !!ok);
  },
});

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '40mb' }));
app.use('/uploads', express.static(UPLOADS_BASE));

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    const result = login(email, password);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }
    try {
      registrarLoginUsuario(result.user.id, result.user.nombre, result.user.email);
    } catch (e) {
      console.error('registrarLoginUsuario:', e);
    }
    return res.json(result);
  } catch (e) {
    console.error('POST /api/auth/login:', e);
    return res.status(500).json({ error: 'Error interno al iniciar sesión' });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/perfil', requireAuth, (req, res) => {
  try {
    const perfil = getUsuarioPerfil(req.user.id);
    if (!perfil) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ perfil });
  } catch (err) {
    console.error('Error GET /api/perfil:', err);
    res.status(500).json({ error: 'Error al cargar perfil' });
  }
});

app.put('/api/perfil', requireAuth, (req, res) => {
  const { nombre, apellidos, rfc, curp, telefono } = req.body || {};
  try {
    const data = {};
    if (nombre != null) data.nombre = String(nombre).trim();
    if (apellidos != null) data.apellidos = String(apellidos).trim();
    if (rfc != null) data.rfc = String(rfc).trim().toUpperCase();
    if (curp != null) data.curp = String(curp).trim().toUpperCase();
    if (telefono != null) data.telefono = String(telefono).trim();
    updateUsuario(req.user.id, data, req.user.id);
    res.json({ perfil: getUsuarioPerfil(req.user.id) });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

/** Quitar foto: POST evita proxies que no reenvían bien DELETE y devuelven HTML 404. */
function clearPerfilAvatar(req, res) {
  try {
    const perfil = getUsuarioPerfil(req.user.id);
    if (!perfil) return res.status(404).json({ error: 'Usuario no encontrado' });
    const ruta = (perfil.avatar || '').trim();
    if (ruta && !ruta.includes('..') && !ruta.startsWith('/')) {
      const abs = join(UPLOADS_BASE, ruta);
      fs.unlink(abs, () => {});
    }
    updateUsuario(req.user.id, { avatar: '' }, req.user.id);
    res.json({ perfil: getUsuarioPerfil(req.user.id) });
  } catch (err) {
    console.error('clearPerfilAvatar:', err);
    res.status(500).json({ error: 'Error al quitar la foto de perfil' });
  }
}

app.post('/api/perfil/avatar/delete', requireAuth, clearPerfilAvatar);
app.delete('/api/perfil/avatar', requireAuth, clearPerfilAvatar);

app.post('/api/perfil/avatar', requireAuth, uploadAvatar.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió ninguna imagen' });
  const ruta = `avatares/${req.file.filename}`;
  try {
    updateUsuario(req.user.id, { avatar: ruta }, req.user.id);
    res.json({ perfil: getUsuarioPerfil(req.user.id) });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Error al subir avatar' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ ok: true });
});

/** Chat de soporte interno (guía integrada, sin APIs de pago). */
app.post('/api/soporte/chat', requireAuth, async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un mensaje' });
    }
    if (messages.length > 28) {
      return res.status(400).json({ error: 'La conversación es demasiado larga; inicia de nuevo.' });
    }
    for (const m of messages) {
      if (!m || typeof m !== 'object') {
        return res.status(400).json({ error: 'Formato de mensaje inválido' });
      }
      if (m.role !== 'user' && m.role !== 'assistant') {
        return res.status(400).json({ error: 'Rol de mensaje inválido' });
      }
      if (typeof m.content !== 'string' || m.content.trim() === '') {
        return res.status(400).json({ error: 'El contenido del mensaje no puede estar vacío' });
      }
      if (m.content.length > 12000) {
        return res.status(400).json({ error: 'Mensaje demasiado largo' });
      }
    }
    if (messages[messages.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'El último mensaje debe ser del usuario' });
    }
    const result = await getSoporteReply(messages, req.user);
    res.json(result);
  } catch (err) {
    console.error('POST /api/soporte/chat', err);
    res.status(500).json({ error: 'No se pudo generar la respuesta de soporte' });
  }
});

app.get('/api/roles', (_req, res) => {
  res.json({ roles: Object.values(ROLES) });
});

/** Catálogo de operadores (rol operador) para asignación en rentas. */
app.get('/api/usuarios/catalogo-operadores', requireAuth, requireEdicionFlota, (req, res) => {
  try {
    const rows = getUsuariosCatalogoOperadores();
    res.json({ usuarios: rows.map((u) => ({ id: String(u.id), nombre: u.nombre || '' })) });
  } catch (err) {
    console.error('GET /api/usuarios/catalogo-operadores:', err);
    res.status(500).json({ error: 'Error al cargar operadores' });
  }
});

/* CRUD Usuarios (solo administrador) */
app.get('/api/usuarios', requireAuth, requireRole(ROLES.ADMIN), (req, res) => {
  try {
    const usuarios = getAllUsuarios();
    res.json({ usuarios });
  } catch (err) {
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

app.post('/api/usuarios', requireAuth, requireRole(ROLES.ADMIN), (req, res) => {
  const { email, password, nombre, rol } = req.body || {};
  if (!email || !password || !nombre || !rol) {
    return res.status(400).json({ error: 'Faltan email, contraseña, nombre o rol' });
  }
  if (!Object.values(ROLES).includes(rol)) {
    return res.status(400).json({ error: 'Rol no válido' });
  }
  if (existeUsuarioPorEmail(email)) {
    return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const id = createUsuario(email, hash, nombre, rol, req.user.id);
    const user = getUsuarioByIdAdmin(Number(id));
    res.status(201).json({ usuario: user });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

app.get('/api/usuarios/:id', requireAuth, requireRole(ROLES.ADMIN), (req, res) => {
  const user = getUsuarioByIdAdmin(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ usuario: user });
});

app.put('/api/usuarios/:id', requireAuth, requireRole(ROLES.ADMIN), (req, res) => {
  const id = Number(req.params.id);
  const user = getUsuarioByIdAdmin(id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const { nombre, apellidos, rfc, curp, telefono, rol, password, activo } = req.body || {};
  const data = {};
  if (nombre != null) data.nombre = nombre;
  if (apellidos != null) data.apellidos = apellidos;
  if (rfc != null) data.rfc = String(rfc).trim().toUpperCase();
  if (curp != null) data.curp = String(curp).trim().toUpperCase();
  if (telefono != null) data.telefono = telefono;
  if (rol != null) {
    if (!Object.values(ROLES).includes(rol)) {
      return res.status(400).json({ error: 'Rol no válido' });
    }
    data.rol = rol;
  }
  if (password !== undefined && password !== '') {
    data.password_hash = bcrypt.hashSync(password, 10);
  }
  if (activo !== undefined) data.activo = !!activo;
  try {
    updateUsuario(id, data, req.user.id);
    res.json({ usuario: getUsuarioByIdAdmin(id) });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

app.post('/api/usuarios/:id/eliminar', requireAuth, requireRole(ROLES.ADMIN), (req, res) => {
  const id = Number(req.params.id);
  const user = getUsuarioByIdAdmin(id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }
  if (user.activo) {
    return res.status(400).json({ error: 'Desactiva el usuario antes de eliminarlo definitivamente' });
  }
  const ruta = (user.avatar || '').trim();
  if (ruta && !ruta.includes('..') && !ruta.startsWith('/')) {
    fs.unlink(join(UPLOADS_BASE, ruta), () => {});
  }
  try {
    eliminarUsuarioDefinitivo(id, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    const msg = err?.message || 'Error al eliminar usuario';
    if (err?.code === 'NOT_FOUND') return res.status(404).json({ error: msg });
    if (err?.code === 'MUST_DEACTIVATE') return res.status(400).json({ error: msg });
    console.error('POST /api/usuarios/:id/eliminar:', err);
    res.status(500).json({ error: msg });
  }
});

app.delete('/api/usuarios/:id', requireAuth, requireRole(ROLES.ADMIN), (req, res) => {
  const id = Number(req.params.id);
  const user = getUsuarioByIdAdmin(id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'No puedes desactivar tu propio usuario' });
  }
  try {
    updateUsuario(id, { activo: false }, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
});

/* CRUD Unidades (autenticado) */
app.get('/api/unidades', requireAuth, (req, res) => {
  try {
    const unidades = getAllUnidades();
    res.json({ unidades });
  } catch (err) {
    res.status(500).json({ error: 'Error al listar unidades' });
  }
});

app.get('/api/unidades/:id', requireAuth, (req, res) => {
  const unidad = getUnidadById(req.params.id);
  if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' });
  res.json({ unidad });
});

app.post('/api/unidades', requireAuth, requireEdicionFlota, (req, res) => {
  const body = req.body || {};
  const {
    placas,
    numeroEconomico,
    marca,
    modelo,
    estatus,
    subestatusDisponible,
    ubicacionDisponible,
    kilometraje,
    combustiblePct,
    observaciones,
    tipoUnidad,
    horasMotor,
    tieneGps,
    gpsNumero1,
    gpsNumero2,
    gestorFisicoMecanica,
    unidadRotulada,
    valorComercial: valorComercialBody,
    rentaMensual: rentaMensualBody,
    pendientePlacasMotivo: pendientePlacasMotivoBody,
    placaFederal: placaFederalBody,
    placaLocal: placaLocalBody,
    mulitaNominaOperadorMensual: mulitaNominaBody,
    mulitaDieselMensual: mulitaDieselBody,
    mulitaHorasExtrasMensual: mulitaHorasBody,
    mulitaCasetasMensual: mulitaCasetasBody,
  } = body;
  const valorComercial = valorComercialBody ?? body.valor_comercial;
  const rentaMensual = rentaMensualBody ?? body.renta_mensual;
  const pendientePlacasMotivo = pendientePlacasMotivoBody ?? body.pendiente_placas_motivo;
  const placaFederal = placaFederalBody ?? body.placa_federal;
  const placaLocal = placaLocalBody ?? body.placa_local;
  const mulitaNominaOperadorMensual = mulitaNominaBody ?? body.mulita_nomina_operador_mensual;
  const mulitaDieselMensual = mulitaDieselBody ?? body.mulita_diesel_mensual;
  const mulitaHorasExtrasMensual = mulitaHorasBody ?? body.mulita_horas_extras_mensual;
  const mulitaCasetasMensual = mulitaCasetasBody ?? body.mulita_casetas_mensual;
  const numeroSerieCaja = pickNumeroSerieCaja(body);
  if (!placas || !marca || !modelo) {
    return res.status(400).json({ error: 'Placas, marca y modelo son requeridos' });
  }
  if (!numeroEconomico || !String(numeroEconomico).trim()) {
    return res.status(400).json({ error: 'El número económico es requerido' });
  }
  if (!numeroSerieCaja) {
    return res.status(400).json({ error: 'El número de serie de la caja es requerido' });
  }
  if (existePlacas(placas)) {
    return res.status(400).json({ error: 'Ya existe una unidad con esas placas' });
  }
  if (existeNumeroEconomico(String(numeroEconomico).trim())) {
    return res.status(400).json({ error: 'Ya existe una unidad con ese número económico' });
  }
  const subPost = String(subestatusDisponible || 'disponible').trim();
  if (subPost === 'pendiente_placas') {
    const m = String(pendientePlacasMotivo ?? '').trim();
    if (m !== 'baja_placas' && m !== 'pendiente_importar') {
      return res.status(400).json({
        error:
          'Con subestatus «Pendiente de placas» debes indicar si es baja de placas o pendiente por importar.',
      });
    }
  }
  try {
    const unidad = createUnidad(
      {
        placas,
        numeroEconomico: String(numeroEconomico).trim(),
        marca,
        modelo,
        estatus,
        numeroSerieCaja,
        subestatusDisponible,
        ubicacionDisponible,
        kilometraje,
        combustiblePct,
        observaciones,
        tipoUnidad,
        horasMotor,
        tieneGps,
        gpsNumero1,
        gpsNumero2,
        gestorFisicoMecanica,
        unidadRotulada,
        valorComercial,
        rentaMensual,
        pendientePlacasMotivo,
        placaFederal,
        placaLocal,
        mulitaNominaOperadorMensual,
        mulitaDieselMensual,
        mulitaHorasExtrasMensual,
        mulitaCasetasMensual,
      },
      req.user.id
    );
    if (!unidad) return res.status(400).json({ error: 'Datos inválidos para registrar unidad' });
    res.status(201).json({ unidad });
  } catch (err) {
    console.error('POST /api/unidades', err);
    const code = err && typeof err === 'object' ? err.code : null;
    const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
    if (code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint failed.*unidades\.placas/i.test(msg)) {
      return res.status(400).json({ error: 'Ya existe una unidad con esas placas' });
    }
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      error: isDev ? `Error al crear unidad: ${msg}` : 'Error al crear unidad',
    });
  }
});

app.put('/api/unidades/:id', requireAuth, requireEdicionFlota, (req, res) => {
  const id = req.params.id;
  const unidad = getUnidadById(id);
  if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' });
  const body = req.body || {};
  const {
    placas,
    marca,
    modelo,
    estatus,
    subestatusDisponible,
    ubicacionDisponible,
    kilometraje,
    combustiblePct,
    observaciones,
    tipoUnidad,
    estadoMantenimiento,
    horasMotor,
    numeroEconomico,
    tieneGps,
    gpsNumero1,
    gpsNumero2,
    gestorFisicoMecanica,
    unidadRotulada,
    valorComercial: valorComercialBodyPut,
    rentaMensual: rentaMensualBodyPut,
    pendientePlacasMotivo: pendientePlacasMotivoBodyPut,
    placaFederal: placaFederalBodyPut,
    placaLocal: placaLocalBodyPut,
    mulitaNominaOperadorMensual: mulitaNominaPut,
    mulitaDieselMensual: mulitaDieselPut,
    mulitaHorasExtrasMensual: mulitaHorasPut,
    mulitaCasetasMensual: mulitaCasetasPut,
  } = body;
  const valorComercial = valorComercialBodyPut ?? body.valor_comercial;
  const rentaMensual = rentaMensualBodyPut ?? body.renta_mensual;
  const pendientePlacasMotivo = pendientePlacasMotivoBodyPut ?? body.pendiente_placas_motivo;
  const placaFederal = placaFederalBodyPut ?? body.placa_federal;
  const placaLocal = placaLocalBodyPut ?? body.placa_local;
  const mulitaNominaOperadorMensual = mulitaNominaPut ?? body.mulita_nomina_operador_mensual;
  const mulitaDieselMensual = mulitaDieselPut ?? body.mulita_diesel_mensual;
  const mulitaHorasExtrasMensual = mulitaHorasPut ?? body.mulita_horas_extras_mensual;
  const mulitaCasetasMensual = mulitaCasetasPut ?? body.mulita_casetas_mensual;
  const numeroSeriePicked = pickNumeroSerieCaja(body);
  const numeroSerieCaja = numeroSeriePicked !== undefined ? numeroSeriePicked : undefined;
  if (placas != null && existePlacas(placas, Number(id))) {
    return res.status(400).json({ error: 'Ya existe otra unidad con esas placas' });
  }
  if (numeroEconomico !== undefined) {
    const ne = String(numeroEconomico).trim();
    if (!ne) {
      return res.status(400).json({ error: 'El número económico no puede estar vacío' });
    }
    if (existeNumeroEconomico(ne, Number(id))) {
      return res.status(400).json({ error: 'Ya existe otra unidad con ese número económico' });
    }
  }
  if (numeroSerieCaja !== undefined && !numeroSerieCaja) {
    return res.status(400).json({ error: 'El número de serie de la caja no puede estar vacío' });
  }
  try {
    const patch = {
      placas,
      marca,
      modelo,
      estatus,
      numeroSerieCaja,
      numeroEconomico,
      subestatusDisponible,
      ubicacionDisponible,
      kilometraje,
      combustiblePct,
      observaciones,
      tipoUnidad,
      estadoMantenimiento,
      horasMotor,
      tieneGps,
      gpsNumero1,
      gpsNumero2,
      gestorFisicoMecanica,
      unidadRotulada,
      valorComercial,
      rentaMensual,
      pendientePlacasMotivo,
      placaFederal,
      placaLocal,
    };
    if (mulitaNominaOperadorMensual !== undefined) {
      patch.mulitaNominaOperadorMensual = mulitaNominaOperadorMensual;
    }
    if (mulitaDieselMensual !== undefined) {
      patch.mulitaDieselMensual = mulitaDieselMensual;
    }
    if (mulitaHorasExtrasMensual !== undefined) {
      patch.mulitaHorasExtrasMensual = mulitaHorasExtrasMensual;
    }
    if (mulitaCasetasMensual !== undefined) {
      patch.mulitaCasetasMensual = mulitaCasetasMensual;
    }
    const updated = updateUnidadDb(id, patch, req.user.id);
    if (!updated) return res.status(400).json({ error: 'Datos inválidos para actualizar unidad' });
    res.json({ unidad: updated });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar unidad' });
  }
});

app.patch('/api/unidades/:id/estatus', requireAuth, requireEdicionFlota, (req, res) => {
  const { estatus } = req.body || {};
  if (!estatus) return res.status(400).json({ error: 'Estatus requerido' });
  try {
    const unidad = setEstatusUnidad(req.params.id, estatus, req.user.id);
    if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada o estatus inválido' });
    res.json({ unidad });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estatus' });
  }
});

app.post('/api/unidades/:id/documentos', requireAuth, requireEdicionFlota, (req, res) => {
  try {
    const tipo = String(req.body?.tipo ?? '').trim();
    const nombreArchivo = String(req.body?.nombreArchivo ?? req.body?.nombre ?? '').trim();
    const archivoBase64 = req.body?.archivoBase64;
    if (!tipo) return res.status(400).json({ error: 'Tipo de documento requerido' });
    if (!nombreArchivo) {
      return res.status(400).json({ error: 'Falta el nombre del archivo (nombreArchivo).' });
    }
    if (typeof archivoBase64 !== 'string' || !String(archivoBase64).trim()) {
      return res.status(400).json({ error: 'Falta el contenido del archivo (archivoBase64).' });
    }
    const { nombre, ruta } = saveUnidadDocumentoFromBase64(req.params.id, nombreArchivo, archivoBase64);
    const unidad = addUnidadDocumento(req.params.id, tipo, nombre, ruta, req.user.id);
    if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.status(201).json({ unidad });
  } catch (err) {
    console.error('POST /api/unidades/:id/documentos', err);
    const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
    const status = /demasiado|inválido|vacío/i.test(msg) ? 400 : 500;
    res.status(status).json({
      error: status === 400 ? msg : 'Error al agregar documento',
    });
  }
});

app.delete('/api/unidades/:id/documentos/:docId', requireAuth, requireEdicionFlota, (req, res) => {
  try {
    const deleted = deleteUnidadDocumento(req.params.docId, req.user.id);
    if (!deleted || String(deleted.unidadId) !== String(req.params.id)) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    if (deleted.ruta) {
      const fullPath = join(UPLOADS_BASE, deleted.ruta);
      fs.unlink(fullPath, () => {});
    }
    const unidad = getUnidadById(req.params.id);
    if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.json({ unidad });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
});

app.post('/api/unidades/:id/actividad', requireAuth, requireEdicionFlota, (req, res) => {
  const { accion, detalle, icon } = req.body || {};
  if (!accion || !detalle) return res.status(400).json({ error: 'Acción y detalle requeridos' });
  try {
    const unidad = addUnidadActividad(req.params.id, accion, detalle, icon, req.user.id);
    if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.status(201).json({ unidad });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar actividad' });
  }
});

const EXPEDIENTE_FOTO_SLOTS = ['fm_anterior', 'fm_vigente', 'tarjeta_circulacion'];

app.post('/api/unidades/:id/expediente-fotos', requireAuth, requireEdicionFlota, upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió ninguna imagen' });
  const slot = String(req.body?.slot || '').trim();
  if (!EXPEDIENTE_FOTO_SLOTS.includes(slot)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Tipo de foto inválido (slot)' });
  }
  const ruta = `unidades/${req.params.id}/${req.file.filename}`;
  try {
    const result = setUnidadExpedienteFoto(req.params.id, slot, ruta, req.user.id);
    if (!result) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Unidad no encontrada' });
    }
    if (result.oldRuta) {
      const fp = join(UPLOADS_BASE, result.oldRuta);
      if (existsSync(fp)) fs.unlink(fp, () => {});
    }
    res.status(201).json({ unidad: result.unidad });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Error al subir foto del expediente' });
  }
});

app.delete('/api/unidades/:id/expediente-fotos/:slot', requireAuth, requireEdicionFlota, (req, res) => {
  const slot = String(req.params.slot || '').trim();
  if (!EXPEDIENTE_FOTO_SLOTS.includes(slot)) {
    return res.status(400).json({ error: 'Tipo de foto inválido' });
  }
  try {
    const result = clearUnidadExpedienteFotoSlot(req.params.id, slot, req.user.id);
    if (!result || String(result.unidad?.id) !== String(req.params.id)) {
      return res.status(404).json({ error: 'Unidad no encontrada' });
    }
    if (result.oldRuta) {
      const fp = join(UPLOADS_BASE, result.oldRuta);
      if (existsSync(fp)) fs.unlinkSync(fp);
    }
    res.json({ unidad: result.unidad });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar foto del expediente' });
  }
});

app.post('/api/unidades/:id/imagenes', requireAuth, requireEdicionFlota, upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió ninguna imagen' });
  const descripcion = (req.body.descripcion || '').trim();
  const ruta = `unidades/${req.params.id}/${req.file.filename}`;
  try {
    const unidad = addUnidadImagen(req.params.id, req.file.originalname, ruta, descripcion, req.user.id);
    if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.status(201).json({ unidad });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

app.delete('/api/unidades/:id/imagenes/:imgId', requireAuth, requireEdicionFlota, (req, res) => {
  try {
    const result = deleteUnidadImagen(req.params.imgId, req.user.id);
    if (!result) return res.status(404).json({ error: 'Imagen no encontrada' });
    const filePath = join(UPLOADS_BASE, result.ruta);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    const unidad = getUnidadById(req.params.id);
    res.json({ unidad });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar imagen' });
  }
});

app.delete('/api/unidades/:id', requireAuth, requireEdicionFlota, (req, res) => {
  try {
    const ok = deleteUnidad(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/unidades/:id', err);
    res.status(500).json({
      error: err?.message ? `Error al eliminar unidad: ${err.message}` : 'Error al eliminar unidad',
    });
  }
});

/* Actividad reciente y vencimientos */
app.get('/api/actividad', requireAuth, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 15, 500);
    const actividad = getActividadReciente(limit);
    res.json({ actividad });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar actividad' });
  }
});

app.get('/api/checkin-out', requireAuth, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 80, 200);
    const registros = getCheckinOutRegistros(limit);
    res.json({ registros });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar registros' });
  }
});

app.post('/api/checkin-out', requireAuth, (req, res) => {
  const body = req.body || {};
  try {
    const row = createCheckinOutRegistro(
      {
        tipo: body.tipo,
        unidadId: body.unidadId,
        rentaId: body.rentaId || null,
        colaboradorNombre: body.colaboradorNombre,
        colaboradorRol: body.colaboradorRol,
        kilometraje: body.kilometraje,
        combustiblePct: body.combustiblePct,
        checklist: body.checklist,
        observaciones: body.observaciones,
        modalidad: body.modalidad,
        inspeccion: body.inspeccion,
      },
      req.user.id
    );
    if (!row) return res.status(400).json({ error: 'Datos inválidos o unidad/renta no coincide' });
    res.status(201).json({ registro: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar check-in/out' });
  }
});

app.put('/api/checkin-out/:id', requireAuth, (req, res) => {
  const body = req.body || {};
  try {
    const row = updateCheckinOutRegistro(
      req.params.id,
      {
        tipo: body.tipo,
        unidadId: body.unidadId,
        rentaId: body.rentaId || null,
        colaboradorNombre: body.colaboradorNombre,
        colaboradorRol: body.colaboradorRol,
        kilometraje: body.kilometraje,
        combustiblePct: body.combustiblePct,
        checklist: body.checklist,
        observaciones: body.observaciones,
        modalidad: body.modalidad,
        inspeccion: body.inspeccion,
      },
      req.user.id
    );
    if (!row) return res.status(400).json({ error: 'No se pudo actualizar el registro' });
    res.json({ registro: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar check-in/out' });
  }
});

app.delete('/api/checkin-out/:id', requireAuth, (req, res) => {
  try {
    const ok = deleteCheckinOutRegistro(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Registro no encontrado' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

app.post('/api/checkin-out/:id/imagenes', requireAuth, uploadCheckinFoto.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo de imagen o video' });
  const descripcion = (req.body.descripcion || '').trim();
  const ruta = `checkin-out/${req.params.id}/${req.file.filename}`;
  try {
    const reg = addCheckinOutImagen(req.params.id, req.file.originalname, ruta, descripcion, req.user.id);
    if (!reg) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.status(201).json({ registro: reg });
  } catch (err) {
    console.error(err);
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Error al subir evidencia' });
  }
});

app.delete('/api/checkin-out/:id/imagenes/:imgId', requireAuth, (req, res) => {
  try {
    const deleted = deleteCheckinOutImagen(req.params.imgId, req.user.id);
    if (!deleted || String(deleted.registroId) !== String(req.params.id)) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    if (deleted.ruta) {
      fs.unlink(join(UPLOADS_BASE, deleted.ruta), () => {});
    }
    const reg = getCheckinOutRegistroById(req.params.id);
    if (!reg) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json({ registro: reg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar imagen' });
  }
});

/* Geocodificación Nominatim: el navegador no puede enviar User-Agent válido (política de uso OSM). */
const NOMINATIM_UA = 'SkylineERP/1.0 (gestión de rentas; contacto: soporte interno)';

app.get('/api/geocode', requireAuth, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q || q.length > 500) {
    return res.status(400).json({ error: 'Dirección inválida' });
  }
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1`;
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': NOMINATIM_UA,
        'Accept-Language': 'es',
      },
    });
    if (!r.ok) {
      return res.status(502).json({ error: 'Geocodificación no disponible' });
    }
    const data = await r.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (hit?.lat != null && hit?.lon != null) {
      return res.json({ lat: parseFloat(hit.lat), lon: parseFloat(hit.lon) });
    }
    return res.json({ lat: null, lon: null });
  } catch (err) {
    console.error('geocode', err);
    return res.status(502).json({ error: 'Error de red' });
  }
});

app.get('/api/reverse-geocode', requireAuth, async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'Coordenadas inválidas' });
  }
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2`;
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': NOMINATIM_UA,
        'Accept-Language': 'es',
      },
    });
    if (!r.ok) {
      return res.status(502).json({ error: 'Geocodificación no disponible' });
    }
    const data = await r.json();
    const name = data?.display_name;
    return res.json({ displayName: name ? String(name) : null });
  } catch (err) {
    console.error('reverse-geocode', err);
    return res.status(502).json({ error: 'Error de red' });
  }
});

app.get('/api/rentas/vencimientos', requireAuth, (req, res) => {
  try {
    const dias = Math.min(parseInt(req.query.dias, 10) || 14, 60);
    const rentas = getRentasProximosVencimientos(dias);
    res.json({ rentas });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar vencimientos' });
  }
});

/* CRUD Rentas */
app.get('/api/rentas', requireAuth, (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const rentas = getAllRentas();
    res.json({ rentas });
  } catch (err) {
    res.status(500).json({ error: 'Error al listar rentas' });
  }
});

app.get('/api/rentas/calendario', requireAuth, (req, res) => {
  const ano = parseInt(req.query.ano, 10);
  const mes = parseInt(req.query.mes, 10);
  if (isNaN(ano) || isNaN(mes) || mes < 1 || mes > 12) {
    return res.status(400).json({ error: 'Parámetros año y mes inválidos' });
  }
  try {
    const rentas = getRentasPorMes(ano, mes);
    res.json({ rentas });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar calendario' });
  }
});

app.get('/api/rentas/:id', requireAuth, (req, res) => {
  const renta = getRentaById(req.params.id);
  if (!renta) return res.status(404).json({ error: 'Renta no encontrada' });
  res.json({ renta });
});

app.post('/api/rentas', requireAuth, requireEdicionFlota, (req, res) => {
  const body = req.body || {};
  const data = {
    unidadId: body.unidadId,
    clienteId: body.clienteId != null && body.clienteId !== '' ? body.clienteId : undefined,
    clienteNombre: body.clienteNombre,
    clienteTelefono: body.clienteTelefono || '',
    clienteEmail: body.clienteEmail || '',
    fechaInicio: body.fechaInicio,
    fechaFin: body.fechaFin,
    monto: body.monto || 0,
    deposito: body.deposito || 0,
    observaciones: body.observaciones || '',
    tipoServicio: body.tipoServicio || 'solo_renta',
    ubicacionEntrega: body.ubicacionEntrega || '',
    ubicacionRecoleccion: body.ubicacionRecoleccion || '',
    precioBase: body.precioBase,
    extras: body.extras,
    operadorAsignado: body.operadorAsignado || '',
    refrigerado: body.refrigerado,
    maquinaria: body.maquinaria,
    facturacionMesNatural: body.facturacionMesNatural,
    facturacionPeriodoDesdeDia: body.facturacionPeriodoDesdeDia,
    facturacionPeriodoHastaDia: body.facturacionPeriodoHastaDia,
  };
  try {
    const renta = createRenta(data, req.user.id);
    if (!renta) return res.status(400).json({ error: 'Datos inválidos o unidad no disponible' });
    res.status(201).json({ renta });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear renta' });
  }
});

app.put('/api/rentas/:id', requireAuth, requireEdicionFlota, (req, res) => {
  const renta = getRentaById(req.params.id);
  if (!renta) return res.status(404).json({ error: 'Renta no encontrada' });
  const body = req.body || {};
  const data = {};
  if (body.unidadId != null) data.unidadId = body.unidadId;
  if (body.clienteId !== undefined) {
    data.clienteId = body.clienteId === null || body.clienteId === '' ? null : body.clienteId;
  }
  if (body.clienteNombre != null) data.clienteNombre = body.clienteNombre;
  if (body.clienteTelefono != null) data.clienteTelefono = body.clienteTelefono;
  if (body.clienteEmail != null) data.clienteEmail = body.clienteEmail;
  if (body.fechaInicio != null) data.fechaInicio = body.fechaInicio;
  if (body.fechaFin != null) data.fechaFin = body.fechaFin;
  if (body.estado != null) data.estado = body.estado;
  if (body.monto != null) data.monto = body.monto;
  if (body.deposito != null) data.deposito = body.deposito;
  if (body.observaciones != null) data.observaciones = body.observaciones;
  if (body.tipoServicio != null) data.tipoServicio = body.tipoServicio;
  if (body.ubicacionEntrega != null) data.ubicacionEntrega = body.ubicacionEntrega;
  if (body.ubicacionRecoleccion != null) data.ubicacionRecoleccion = body.ubicacionRecoleccion;
  if (body.estadoLogistico != null) data.estadoLogistico = body.estadoLogistico;
  if (body.precioBase != null) data.precioBase = body.precioBase;
  if (body.extras != null) data.extras = body.extras;
  if (body.operadorAsignado != null) data.operadorAsignado = body.operadorAsignado;
  if (body.refrigerado != null) data.refrigerado = body.refrigerado;
  if (body.maquinaria != null) data.maquinaria = body.maquinaria;
  if (body.facturacionMesNatural !== undefined) data.facturacionMesNatural = body.facturacionMesNatural;
  if (body.facturacionPeriodoDesdeDia !== undefined) data.facturacionPeriodoDesdeDia = body.facturacionPeriodoDesdeDia;
  if (body.facturacionPeriodoHastaDia !== undefined) data.facturacionPeriodoHastaDia = body.facturacionPeriodoHastaDia;
  try {
    const updated = updateRenta(req.params.id, data, req.user.id);
    res.json({ renta: updated });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar renta' });
  }
});

app.delete('/api/rentas/:id', requireAuth, requireEdicionFlota, (req, res) => {
  try {
    const ok = deleteRenta(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Renta no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar renta' });
  }
});

app.post('/api/rentas/:id/pagos', requireAuth, requireEdicionFlota, (req, res) => {
  const body = req.body || {};
  try {
    const result = addPago(
      req.params.id,
      {
        monto: body.monto,
        tipo: body.tipo || 'pago_parcial',
        metodo: body.metodo || 'efectivo',
        fecha: body.fecha,
        referencia: body.referencia,
        observaciones: body.observaciones,
      },
      req.user.id
    );
    if (!result) return res.status(404).json({ error: 'Renta no encontrada' });
    const renta = getRentaById(req.params.id);
    res.status(201).json({ pago: result, renta });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar pago' });
  }
});

const RENTA_DOCS_DIR = join(UPLOADS_BASE, 'rentas');
fs.mkdirSync(RENTA_DOCS_DIR, { recursive: true });
const rentaDocStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = join(RENTA_DOCS_DIR, String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = (file.originalname.match(/\.\w+$/) || ['.pdf'])[0];
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const uploadRentaDoc = multer({
  storage: rentaDocStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /^application\/(pdf|msword)|^image\//i.test(file.mimetype) || /\.(pdf|doc|docx|jpg|jpeg|png)$/i.test(file.originalname);
    cb(null, !!ok);
  },
});

const clienteDocStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = join(CLIENTE_DOCS_DIR, String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.\w+$/) || ['.pdf'])[0];
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const uploadClienteDoc = multer({
  storage: clienteDocStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /^application\/(pdf|msword)|^image\//i.test(file.mimetype) || /\.(pdf|doc|docx|jpg|jpeg|png)$/i.test(file.originalname);
    cb(null, !!ok);
  },
});

app.get('/api/clientes', requireAuth, requireAccesoClientes, (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ clientes: getAllClientes() });
  } catch (err) {
    console.error('GET /api/clientes', err);
    res.status(500).json({ error: 'Error al listar clientes' });
  }
});

app.get('/api/clientes/:id', requireAuth, requireAccesoClientes, (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const cliente = getClienteById(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ cliente });
  } catch (err) {
    console.error('GET /api/clientes/:id', err);
    res.status(500).json({ error: 'Error al cargar cliente' });
  }
});

app.post('/api/clientes', requireAuth, requireAccesoClientes, (req, res) => {
  try {
    const cliente = createCliente(req.body || {}, req.user.id);
    if (!cliente) return res.status(400).json({ error: 'Nombre comercial es requerido' });
    res.status(201).json({ cliente });
  } catch (err) {
    console.error('POST /api/clientes', err);
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

app.put('/api/clientes/:id', requireAuth, requireAccesoClientes, (req, res) => {
  try {
    const cliente = updateCliente(req.params.id, req.body || {}, req.user.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ cliente });
  } catch (err) {
    console.error('PUT /api/clientes/:id', err);
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

app.delete('/api/clientes/:id', requireAuth, requireAccesoClientes, (req, res) => {
  try {
    const ok = deleteClienteSoft(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/clientes/:id', err);
    res.status(500).json({ error: 'Error al desactivar cliente' });
  }
});

app.post('/api/clientes/:id/documentos', requireAuth, requireAccesoClientes, uploadClienteDoc.single('documento'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún documento' });
  const tipo = (req.body.tipo || 'otro').trim();
  const nombre = (req.body.nombre || req.file.originalname).trim();
  const ruta = `clientes/${req.params.id}/${req.file.filename}`;
  try {
    const cliente = addClienteDocumento(req.params.id, tipo, nombre, ruta, req.user.id);
    if (!cliente) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.status(201).json({ cliente });
  } catch (err) {
    console.error('POST cliente documento', err);
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Error al subir documento' });
  }
});

app.delete('/api/clientes/:id/documentos/:docId', requireAuth, requireAccesoClientes, (req, res) => {
  try {
    const out = deleteClienteDocumento(req.params.docId, req.user.id);
    if (!out || String(out.clienteId) !== String(req.params.id)) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    if (out.ruta && !out.ruta.includes('..')) {
      const abs = join(UPLOADS_BASE, out.ruta);
      fs.unlink(abs, () => {});
    }
    const cliente = getClienteById(req.params.id);
    res.json({ cliente });
  } catch (err) {
    console.error('DELETE cliente documento', err);
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
});

app.post('/api/rentas/:id/documentos', requireAuth, requireEdicionFlota, uploadRentaDoc.single('documento'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún documento' });
  const tipo = (req.body.tipo || 'contrato').trim();
  const nombre = (req.body.nombre || req.file.originalname).trim();
  const ruta = `rentas/${req.params.id}/${req.file.filename}`;
  try {
    const result = addRentaDocumento(req.params.id, tipo, nombre, ruta, req.user.id);
    if (!result) return res.status(404).json({ error: 'Renta no encontrada' });
    const renta = getRentaById(req.params.id);
    res.status(201).json({ renta });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Error al subir documento' });
  }
});

/* Mantenimiento */
app.get('/api/mantenimiento', requireAuth, (req, res) => {
  try {
    const mantenimientos = getAllMantenimientos();
    res.json({ mantenimientos });
  } catch (err) {
    res.status(500).json({ error: 'Error al listar mantenimientos' });
  }
});

app.get('/api/unidades/:id/mantenimiento', requireAuth, (req, res) => {
  try {
    const mantenimientos = getMantenimientosByUnidad(req.params.id);
    res.json({ mantenimientos });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar historial de mantenimiento' });
  }
});

app.post('/api/mantenimiento', requireAuth, (req, res) => {
  const body = req.body || {};
  try {
    const mantenimiento = createMantenimiento(
      {
        unidadId: body.unidadId,
        proveedorId: body.proveedorId,
        tipo: body.tipo || 'preventivo',
        descripcion: body.descripcion || '',
        costo: body.costo || 0,
        fechaInicio: body.fechaInicio,
        fechaFin: body.fechaFin,
        estado: body.estado || 'programado',
      },
      req.user.id
    );
    if (!mantenimiento) return res.status(400).json({ error: 'Datos inválidos' });
    res.status(201).json({ mantenimiento });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear mantenimiento' });
  }
});

app.put('/api/mantenimiento/:id', requireAuth, (req, res) => {
  const body = req.body || {};
  try {
    const patch = {
      tipo: body.tipo,
      descripcion: body.descripcion,
      costo: body.costo,
      fechaInicio: body.fechaInicio,
      fechaFin: body.fechaFin,
      estado: body.estado,
    };
    if (Object.prototype.hasOwnProperty.call(body, 'proveedorId')) {
      patch.proveedorId = body.proveedorId;
    }
    const mantenimiento = updateMantenimiento(req.params.id, patch, req.user.id);
    if (!mantenimiento) return res.status(404).json({ error: 'Mantenimiento no encontrado' });
    res.json({ mantenimiento });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar mantenimiento' });
  }
});

/* Proveedores y cuentas por pagar */
const PROVEEDOR_FACTURAS_DIR = join(UPLOADS_BASE, 'proveedores');
fs.mkdirSync(PROVEEDOR_FACTURAS_DIR, { recursive: true });
const proveedorFacturaStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = join(PROVEEDOR_FACTURAS_DIR, String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.\w+$/) || ['.pdf'])[0].toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const uploadProveedorFactura = multer({
  storage: proveedorFacturaStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const ok =
      /^application\/(pdf|xml|octet-stream)/i.test(file.mimetype) ||
      /^text\/xml/i.test(file.mimetype) ||
      /\.(pdf|xml)$/i.test(name);
    cb(null, !!ok);
  },
});

const proveedoresHandlers = [requireAuth, requireRole(ROLES.ADMIN, ROLES.SUPERVISOR)];

/** Excel multihoja: volcado de tablas CRUD (sin contraseñas). Administrador y supervisor. */
app.get('/api/reportes/export-crud-xlsx', ...proveedoresHandlers, async (req, res) => {
  try {
    const desde = typeof req.query.desde === 'string' ? req.query.desde.trim() : '';
    const hasta = typeof req.query.hasta === 'string' ? req.query.hasta.trim() : '';
    const buf = await generarBufferExportCrudXlsx({ desde, hasta });
    const d = new Date().toISOString().slice(0, 10);
    const suffix = [desde || null, hasta || null].filter(Boolean).join('_a_');
    const safeSuffix = suffix ? `-${suffix.replace(/[^\d_a-zA-Z-]/g, '')}` : '';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="skyline-catalogo-crud${safeSuffix}-${d}.xlsx"`
    );
    res.send(buf);
  } catch (err) {
    console.error('export-crud-xlsx', err);
    res.status(500).json({ error: 'No se pudo generar el archivo Excel' });
  }
});

app.get('/api/proveedores/reportes/cuentas-pagar', ...proveedoresHandlers, (_req, res) => {
  try {
    res.json(getReporteCuentasPorPagar());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
});

/** Movimientos de gasto / CxP consolidados (administrador y supervisor). */
app.get('/api/finanzas/gastos', ...proveedoresHandlers, (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const lim = parseInt(String(req.query.limit ?? ''), 10);
    res.json(getFinanzasGastosResumen(Number.isFinite(lim) ? lim : 200));
  } catch (err) {
    console.error('GET /api/finanzas/gastos', err);
    res.status(500).json({ error: 'Error al cargar gastos' });
  }
});

app.get('/api/proveedores/reportes/por-unidad', ...proveedoresHandlers, (_req, res) => {
  try {
    res.json({ unidades: getReporteProveedoresPorUnidad() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
});

/** Catálogo activo para asignar proveedor en mantenimiento (solo lectura). */
app.get('/api/proveedores/catalogo', requireAuth, (_req, res) => {
  try {
    res.json({ proveedores: getProveedoresCatalogo() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar catálogo de proveedores' });
  }
});

app.get('/api/proveedores', ...proveedoresHandlers, (_req, res) => {
  try {
    res.json({ proveedores: getAllProveedores() });
  } catch (err) {
    res.status(500).json({ error: 'Error al listar proveedores' });
  }
});

app.get('/api/proveedores/:id', ...proveedoresHandlers, (req, res) => {
  try {
    const p = getProveedorById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ proveedor: p });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar proveedor' });
  }
});

app.post('/api/proveedores', ...proveedoresHandlers, (req, res) => {
  const body = req.body || {};
  try {
    const p = createProveedor(body, req.user.id);
    if (!p) return res.status(400).json({ error: 'Nombre o razón social requerido' });
    res.status(201).json({ proveedor: p });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
});

app.put('/api/proveedores/:id', ...proveedoresHandlers, (req, res) => {
  try {
    const p = updateProveedor(req.params.id, req.body || {}, req.user.id);
    if (!p) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ proveedor: p });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
});

app.post(
  '/api/proveedores/:id/facturas',
  ...proveedoresHandlers,
  uploadProveedorFactura.single('archivo'),
  (req, res) => {
    const body = req.body || {};
    let archivoRuta = '';
    let archivoNombreOriginal = '';
    if (req.file) {
      archivoRuta = `proveedores/${req.params.id}/${req.file.filename}`;
      archivoNombreOriginal = req.file.originalname || '';
    }
    try {
      const result = createProveedorFactura(
        req.params.id,
        {
          numero: body.numero,
          fechaEmision: body.fechaEmision,
          montoTotal: body.montoTotal,
          concepto: body.concepto,
          unidadId: body.unidadId || null,
          archivoRuta,
          archivoNombreOriginal,
        },
        req.user.id
      );
      if (!result) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'Datos de factura inválidos' });
      }
      if (result.error === 'duplicate_numero') {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        return res.status(409).json({ error: 'Ya existe una factura con ese número para este proveedor' });
      }
      if (result.error === 'unidad_invalida') {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'La unidad indicada no existe' });
      }
      res.status(201).json({ proveedor: result });
    } catch (err) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      console.error(err);
      res.status(500).json({ error: 'Error al registrar factura' });
    }
  }
);

app.post('/api/proveedores/:id/facturas/:facturaId/pagos', ...proveedoresHandlers, (req, res) => {
  try {
    const p = addPagoProveedorFactura(req.params.id, req.params.facturaId, req.body || {}, req.user.id);
    if (!p) return res.status(404).json({ error: 'Factura no encontrada' });
    res.status(201).json({ proveedor: p });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar pago' });
  }
});

app.delete('/api/proveedores/:id/facturas/:facturaId', ...proveedoresHandlers, (req, res) => {
  try {
    const p = deleteProveedorFactura(req.params.id, req.params.facturaId, req.user.id);
    if (!p) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json({ proveedor: p });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar factura' });
  }
});

app.delete('/api/proveedores/:id', ...proveedoresHandlers, (req, res) => {
  try {
    const ok = deleteProveedor(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar proveedor' });
  }
});

/** Frontend compilado (Vite `dist/`) junto al servidor: mismo origen para /api y sin VITE_API_ROOT. */
const distPath = join(__dirname, '..', 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    if (req.path.startsWith('/uploads')) {
      return res.status(404).send('Not found');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    res.sendFile(join(distPath, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`Servidor SKYLINE ERP en http://localhost:${PORT}`);
});
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      `[Skyline ERP] El puerto ${PORT} ya está en uso. Cierra el otro Node que lo ocupa ` +
        `(PowerShell: netstat -ano | findstr :${PORT}  luego  taskkill /PID <número> /F) ` +
        `o define otra variable PORT y reinicia. Mientras tanto Vite en :5173 puede parecer «funcionar» ` +
        `pero las llamadas a /api irán al proceso viejo y verás HTML en lugar de JSON.`
    );
  } else {
    console.error('[Skyline ERP] Error al escuchar:', err);
  }
  process.exit(1);
});
