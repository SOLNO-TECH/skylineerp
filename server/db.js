import Database from 'better-sqlite3';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.SKYLINE_DATA_DIR?.trim();
const dbPathOverride = process.env.SKYLINE_DB_PATH?.trim();
/** Docker: `SKYLINE_DATA_DIR=/app/server/data` → `…/data/skyline.db`. También se admite `SKYLINE_DB_PATH` explícito. */
const dbPath = dbPathOverride
  ? dbPathOverride
  : dataDir
    ? join(dataDir, 'skyline.db')
    : join(__dirname, 'skyline.db');
fs.mkdirSync(dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

/** Evita FALLAR la inserción en sistema_actividad si usuarioId es NaN o no existe en usuarios (FK). */
function usuarioIdParaAuditoria(usuarioId) {
  if (usuarioId == null || usuarioId === '') return null;
  const n = Number(usuarioId);
  if (!Number.isFinite(n) || n !== Math.floor(n) || n < 1) return null;
  const row = db.prepare('SELECT 1 FROM usuarios WHERE id = ?').get(n);
  return row ? n : null;
}

export const ROLES = Object.freeze({
  ADMIN: 'administrador',
  SUPERVISOR: 'supervisor',
  OPERADOR: 'operador',
  /** Taller / patio: check-in, check-out y mantenimiento; sin unidades, rentas, clientes ni proveedores. */
  OPERADOR_TALLER: 'operador_taller',
  CONSULTA: 'consulta',
});

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL,
      descripcion TEXT
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'operador',
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now')),
      actualizado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (rol) REFERENCES roles(nombre)
    );

    CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
    CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
  `);

  // Migración: añadir columnas de perfil si no existen
  try {
    const cols = db.prepare("PRAGMA table_info(usuarios)").all().map(r => r.name);
    if (!cols.includes('apellidos')) db.exec('ALTER TABLE usuarios ADD COLUMN apellidos TEXT DEFAULT ""');
    if (!cols.includes('rfc')) db.exec('ALTER TABLE usuarios ADD COLUMN rfc TEXT DEFAULT ""');
    if (!cols.includes('curp')) db.exec('ALTER TABLE usuarios ADD COLUMN curp TEXT DEFAULT ""');
    if (!cols.includes('telefono')) db.exec('ALTER TABLE usuarios ADD COLUMN telefono TEXT DEFAULT ""');
    if (!cols.includes('avatar')) db.exec('ALTER TABLE usuarios ADD COLUMN avatar TEXT DEFAULT ""');
  } catch (err) {
    console.warn('Migración de perfil:', err?.message || err);
  }

  // Insertar roles por defecto si no existen
  const roles = [
    [ROLES.ADMIN, 'Acceso total al sistema'],
    [ROLES.SUPERVISOR, 'Gestión operativa y reportes'],
    [ROLES.OPERADOR, 'Operación diaria: rentas, check-in/out, unidades, clientes'],
    [ROLES.OPERADOR_TALLER, 'Taller: check-in/out y mantenimiento (sin catálogos de unidades, rentas ni clientes)'],
    [ROLES.CONSULTA, 'Solo lectura'],
  ];
  const insertRole = db.prepare(
    'INSERT OR IGNORE INTO roles (nombre, descripcion) VALUES (?, ?)'
  );
  for (const [nombre, desc] of roles) {
    insertRole.run(nombre, desc);
  }

  initUnidades();
  initRentas();
  initRentasExtension();
  initMantenimiento();
  initCheckinOut();
  initSistemaActividad();
  initProveedores();
  migrateMantenimientoProveedor();
  initClientes();
}

/** Añade proveedor_id a mantenimiento (después de que exista la tabla proveedores). */
function migrateMantenimientoProveedor() {
  try {
    const cols = db.prepare('PRAGMA table_info(mantenimiento)').all().map((c) => c.name);
    if (!cols.includes('proveedor_id')) {
      db.exec('ALTER TABLE mantenimiento ADD COLUMN proveedor_id INTEGER');
      db.exec('CREATE INDEX IF NOT EXISTS idx_mantenimiento_proveedor ON mantenimiento(proveedor_id)');
    }
  } catch (e) {
    console.warn('Migración mantenimiento.proveedor_id:', e?.message);
  }
}

function initCheckinOut() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkin_out_registros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      unidad_id INTEGER NOT NULL,
      renta_id INTEGER,
      usuario_id INTEGER,
      colaborador_nombre TEXT DEFAULT '',
      colaborador_rol TEXT DEFAULT '',
      kilometraje INTEGER,
      combustible_pct INTEGER,
      checklist_json TEXT DEFAULT '[]',
      observaciones TEXT DEFAULT '',
      modalidad TEXT DEFAULT 'caja_seca',
      inspeccion_json TEXT DEFAULT '{}',
      creado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unidad_id) REFERENCES unidades(id),
      FOREIGN KEY (renta_id) REFERENCES rentas(id) ON DELETE SET NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
    CREATE INDEX IF NOT EXISTS idx_checkin_out_unidad ON checkin_out_registros(unidad_id);
    CREATE INDEX IF NOT EXISTS idx_checkin_out_creado ON checkin_out_registros(creado_en DESC);
  `);
  migrarCheckinOut();
}

function migrarCheckinOut() {
  try {
    const cols = db.prepare("PRAGMA table_info(checkin_out_registros)").all().map((r) => r.name);
    if (!cols.includes('modalidad')) db.exec("ALTER TABLE checkin_out_registros ADD COLUMN modalidad TEXT DEFAULT 'caja_seca'");
    if (!cols.includes('inspeccion_json')) db.exec("ALTER TABLE checkin_out_registros ADD COLUMN inspeccion_json TEXT DEFAULT '{}'");
  } catch (e) {
    console.warn('Migración checkin_out_registros:', e?.message);
  }
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS checkin_out_imagenes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        registro_id INTEGER NOT NULL,
        nombre_archivo TEXT NOT NULL,
        ruta TEXT NOT NULL,
        descripcion TEXT DEFAULT '',
        creado_en TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (registro_id) REFERENCES checkin_out_registros(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_checkin_out_img_reg ON checkin_out_imagenes(registro_id);
    `);
  } catch (e) {
    console.warn('Migración checkin_out_imagenes:', e?.message);
  }
}

/* ─── Registro global de actividad (auditoría) ─── */
function initSistemaActividad() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sistema_actividad (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT DEFAULT (datetime('now')),
      categoria TEXT NOT NULL,
      accion TEXT NOT NULL,
      detalle TEXT NOT NULL DEFAULT '',
      entidad_tipo TEXT,
      entidad_id TEXT,
      usuario_id INTEGER,
      icon TEXT DEFAULT 'mdi:information',
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sistema_actividad_fecha ON sistema_actividad(fecha DESC);
  `);
  backfillSistemaActividadSiVacio();
}

function backfillSistemaActividadSiVacio() {
  const n = db.prepare('SELECT COUNT(*) as c FROM sistema_actividad').get().c;
  if (n > 0) return;
  try {
    db.prepare(`
      INSERT INTO sistema_actividad (fecha, categoria, accion, detalle, entidad_tipo, entidad_id, usuario_id, icon)
      SELECT a.fecha, 'unidad', a.accion,
        TRIM(a.detalle || ' · ' || COALESCE(u.placas, '')),
        'unidad', CAST(a.unidad_id AS TEXT), NULL, COALESCE(NULLIF(a.icon, ''), 'mdi:information')
      FROM unidad_actividad a
      JOIN unidades u ON u.id = a.unidad_id
    `).run();
  } catch (e) {
    console.warn('Backfill unidad_actividad → sistema:', e?.message);
  }
  try {
    db.prepare(`
      INSERT INTO sistema_actividad (fecha, categoria, accion, detalle, entidad_tipo, entidad_id, usuario_id, icon)
      SELECT h.fecha, 'renta', h.accion,
        TRIM(h.detalle || ' · ' || COALESCE(u.placas, '') || ' · ' || COALESCE(r.cliente_nombre, '')),
        'renta', CAST(h.renta_id AS TEXT), h.usuario_id, 'mdi:file-document'
      FROM rentas_historial h
      JOIN rentas r ON r.id = h.renta_id
      JOIN unidades u ON u.id = r.unidad_id
    `).run();
  } catch (e) {
    console.warn('Backfill rentas_historial → sistema:', e?.message);
  }
}

export function registrarSistemaActividad({
  categoria,
  accion,
  detalle = '',
  entidadTipo = null,
  entidadId = null,
  usuarioId = null,
  icon = 'mdi:information',
}) {
  db.prepare(
    `INSERT INTO sistema_actividad (categoria, accion, detalle, entidad_tipo, entidad_id, usuario_id, icon)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    String(categoria),
    String(accion),
    String(detalle || ''),
    entidadTipo != null ? String(entidadTipo) : null,
    entidadId != null ? String(entidadId) : null,
    usuarioIdParaAuditoria(usuarioId),
    String(icon || 'mdi:information')
  );
}

export function registrarLoginUsuario(usuarioId, nombre, email) {
  registrarSistemaActividad({
    categoria: 'auth',
    accion: 'Inicio de sesión',
    detalle: `${nombre} (${email})`,
    entidadTipo: 'usuario',
    entidadId: String(usuarioId),
    usuarioId,
    icon: 'mdi:login',
  });
}

/* ─── Migración Unidades: tipo y mantenimiento ─── */
function migrarUnidades() {
  try {
    const cols = db.prepare("PRAGMA table_info(unidades)").all().map(r => r.name);
    if (!cols.includes('tipo_unidad')) db.exec("ALTER TABLE unidades ADD COLUMN tipo_unidad TEXT DEFAULT 'remolque_seco'");
    if (!cols.includes('estado_mantenimiento')) db.exec("ALTER TABLE unidades ADD COLUMN estado_mantenimiento TEXT DEFAULT 'disponible'");
    if (!cols.includes('horas_motor')) db.exec('ALTER TABLE unidades ADD COLUMN horas_motor INTEGER DEFAULT 0');
    if (!cols.includes('numero_serie_caja')) db.exec("ALTER TABLE unidades ADD COLUMN numero_serie_caja TEXT DEFAULT ''");
    if (!cols.includes('subestatus_disponible')) db.exec("ALTER TABLE unidades ADD COLUMN subestatus_disponible TEXT DEFAULT 'disponible'");
    if (!cols.includes('ubicacion_disponible')) db.exec("ALTER TABLE unidades ADD COLUMN ubicacion_disponible TEXT DEFAULT 'lote'");
    if (!cols.includes('numero_economico')) {
      db.exec("ALTER TABLE unidades ADD COLUMN numero_economico TEXT DEFAULT ''");
      db.exec("UPDATE unidades SET numero_economico = 'ECO-' || id WHERE TRIM(COALESCE(numero_economico, '')) = ''");
    }
    if (!cols.includes('tiene_gps')) db.exec('ALTER TABLE unidades ADD COLUMN tiene_gps INTEGER NOT NULL DEFAULT 0');
    if (!cols.includes('gps_numero_1')) db.exec("ALTER TABLE unidades ADD COLUMN gps_numero_1 TEXT DEFAULT ''");
    if (!cols.includes('gps_numero_2')) db.exec("ALTER TABLE unidades ADD COLUMN gps_numero_2 TEXT DEFAULT ''");
    if (!cols.includes('gestor_fisico_mecanica')) {
      db.exec("ALTER TABLE unidades ADD COLUMN gestor_fisico_mecanica TEXT DEFAULT ''");
    }
    if (!cols.includes('fm_foto_anterior_ruta')) db.exec("ALTER TABLE unidades ADD COLUMN fm_foto_anterior_ruta TEXT DEFAULT ''");
    if (!cols.includes('fm_foto_vigente_ruta')) db.exec("ALTER TABLE unidades ADD COLUMN fm_foto_vigente_ruta TEXT DEFAULT ''");
    if (!cols.includes('tarjeta_circulacion_ruta')) {
      db.exec("ALTER TABLE unidades ADD COLUMN tarjeta_circulacion_ruta TEXT DEFAULT ''");
    }
    if (!cols.includes('unidad_rotulada')) db.exec('ALTER TABLE unidades ADD COLUMN unidad_rotulada INTEGER');
    db.exec("UPDATE unidades SET estatus = 'Disponible', subestatus_disponible = 'taller' WHERE estatus = 'Taller'");
    // Marcador claro cuando nunca se capturó serie (no es un “formato” de negocio).
    db.exec("UPDATE unidades SET numero_serie_caja = 'PENDIENTE-' || id WHERE TRIM(COALESCE(numero_serie_caja, '')) = ''");
    db.exec("UPDATE unidades SET numero_serie_caja = 'PENDIENTE-' || id WHERE numero_serie_caja = 'SIN-SERIE-' || id");
    // Unidades ya dadas de baja (activo=0) pueden seguir bloqueando placas por UNIQUE en SQLite; liberar placas históricas.
    const bajaMarker = '[baja#';
    const inactivas = db
      .prepare('SELECT id, placas FROM unidades WHERE activo = 0 AND instr(placas, ?) = 0')
      .all(bajaMarker);
    const updPlacas = db.prepare('UPDATE unidades SET placas = ? WHERE id = ?');
    for (const row of inactivas) {
      const base = String(row.placas ?? '').trim();
      const stamp = Date.now();
      updPlacas.run(`${base} [baja#${row.id} ts=${stamp}]`, row.id);
    }
  } catch (e) { console.warn('Migración unidades:', e?.message); }
  try {
    const docCols = db.prepare("PRAGMA table_info(unidad_documentos)").all().map(r => r.name);
    if (!docCols.includes('ruta')) db.exec("ALTER TABLE unidad_documentos ADD COLUMN ruta TEXT DEFAULT ''");
  } catch (e) { console.warn('Migración unidad_documentos:', e?.message); }
}

/* ─── Rentas ─── */
const ESTADOS_RENTA = ['reservada', 'activa', 'finalizada', 'cancelada'];
const TIPOS_SERVICIO = ['solo_renta', 'con_operador', 'con_transporte'];
const ESTADOS_LOGISTICOS = ['programado', 'en_camino', 'entregado', 'finalizado'];
const TIPOS_UNIDAD = [
  'remolque_seco',
  'refrigerado',
  'maquinaria',
  'dolly',
  'plataforma',
  'camion',
  'vehiculo_empresarial',
  'caja_refrigerada_sin_termo',
  'pickup',
];

function unidadUsaDatosRefrigeracion(tipo) {
  return tipo === 'refrigerado' || tipo === 'caja_refrigerada_sin_termo';
}

export function initRentas() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rentas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unidad_id INTEGER NOT NULL,
      cliente_nombre TEXT NOT NULL,
      cliente_telefono TEXT DEFAULT '',
      cliente_email TEXT DEFAULT '',
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'reservada',
      monto REAL DEFAULT 0,
      deposito REAL DEFAULT 0,
      observaciones TEXT DEFAULT '',
      creado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unidad_id) REFERENCES unidades(id)
    );
    CREATE INDEX IF NOT EXISTS idx_rentas_unidad ON rentas(unidad_id);
    CREATE INDEX IF NOT EXISTS idx_rentas_fecha ON rentas(fecha_inicio, fecha_fin);
    CREATE INDEX IF NOT EXISTS idx_rentas_estado ON rentas(estado);
  `);
  const count = db.prepare('SELECT COUNT(*) as n FROM rentas').get();
  if (count.n === 0) {
    const ins = db.prepare(
      'INSERT INTO rentas (unidad_id, cliente_nombre, cliente_telefono, fecha_inicio, fecha_fin, estado, monto) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    ins.run(2, 'Cliente Demo', '55 1234 5678', '2025-03-15', '2025-03-18', 'activa', 4500);
    ins.run(1, 'María García', '55 9876 5432', '2025-03-20', '2025-03-23', 'reservada', 4200);
    ins.run(4, 'Carlos López', '55 1111 2222', '2025-03-25', '2025-03-28', 'reservada', 3800);
  }
}

/* Migración rentas: columnas ERP industrial */
function migrarRentas() {
  try {
    const cols = db.prepare("PRAGMA table_info(rentas)").all().map(r => r.name);
    if (!cols.includes('tipo_servicio')) db.exec("ALTER TABLE rentas ADD COLUMN tipo_servicio TEXT DEFAULT 'solo_renta'");
    if (!cols.includes('ubicacion_entrega')) db.exec("ALTER TABLE rentas ADD COLUMN ubicacion_entrega TEXT DEFAULT ''");
    if (!cols.includes('ubicacion_recoleccion')) db.exec("ALTER TABLE rentas ADD COLUMN ubicacion_recoleccion TEXT DEFAULT ''");
    if (!cols.includes('estado_logistico')) db.exec("ALTER TABLE rentas ADD COLUMN estado_logistico TEXT DEFAULT 'programado'");
    if (!cols.includes('precio_base')) db.exec('ALTER TABLE rentas ADD COLUMN precio_base REAL DEFAULT 0');
    if (!cols.includes('extras')) db.exec('ALTER TABLE rentas ADD COLUMN extras REAL DEFAULT 0');
    if (!cols.includes('operador_asignado')) db.exec("ALTER TABLE rentas ADD COLUMN operador_asignado TEXT DEFAULT ''");
  } catch (e) { console.warn('Migración rentas:', e?.message); }
}

function initRentasExtension() {
  migrarUnidades();
  migrarRentas();
  db.exec(`
    CREATE TABLE IF NOT EXISTS rentas_refrigerado (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      renta_id INTEGER NOT NULL UNIQUE,
      temperatura_objetivo REAL DEFAULT 0,
      combustible_inicio INTEGER DEFAULT 0,
      combustible_fin INTEGER DEFAULT 0,
      horas_motor_inicio INTEGER DEFAULT 0,
      horas_motor_fin INTEGER DEFAULT 0,
      observaciones TEXT DEFAULT '',
      FOREIGN KEY (renta_id) REFERENCES rentas(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS rentas_maquinaria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      renta_id INTEGER NOT NULL UNIQUE,
      operador_asignado TEXT DEFAULT '',
      horas_trabajadas REAL DEFAULT 0,
      tipo_trabajo TEXT DEFAULT '',
      observaciones TEXT DEFAULT '',
      FOREIGN KEY (renta_id) REFERENCES rentas(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS pagos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      renta_id INTEGER NOT NULL,
      monto REAL NOT NULL DEFAULT 0,
      tipo TEXT NOT NULL DEFAULT 'pago_parcial',
      metodo TEXT DEFAULT 'efectivo',
      fecha TEXT DEFAULT (date('now')),
      referencia TEXT DEFAULT '',
      observaciones TEXT DEFAULT '',
      creado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (renta_id) REFERENCES rentas(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS rentas_documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      renta_id INTEGER NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'contrato',
      nombre TEXT NOT NULL,
      ruta TEXT NOT NULL,
      creado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (renta_id) REFERENCES rentas(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS rentas_historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      renta_id INTEGER NOT NULL,
      accion TEXT NOT NULL,
      detalle TEXT DEFAULT '',
      usuario_id INTEGER,
      fecha TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (renta_id) REFERENCES rentas(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
    CREATE INDEX IF NOT EXISTS idx_pagos_renta ON pagos(renta_id);
    CREATE INDEX IF NOT EXISTS idx_rentas_documentos_renta ON rentas_documentos(renta_id);
    CREATE INDEX IF NOT EXISTS idx_rentas_historial_renta ON rentas_historial(renta_id);
  `);
}

function initMantenimiento() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mantenimiento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unidad_id INTEGER NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'preventivo',
      descripcion TEXT DEFAULT '',
      costo REAL DEFAULT 0,
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT,
      estado TEXT NOT NULL DEFAULT 'programado',
      creado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unidad_id) REFERENCES unidades(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_mantenimiento_unidad ON mantenimiento(unidad_id);
    CREATE INDEX IF NOT EXISTS idx_mantenimiento_estado ON mantenimiento(estado);
  `);
}

export function getAllRentas() {
  const rows = db.prepare(
    `SELECT r.id, r.unidad_id, r.cliente_id, r.cliente_nombre, r.cliente_telefono, r.cliente_email, r.fecha_inicio, r.fecha_fin, r.estado,
            r.monto, r.deposito, r.observaciones, r.creado_en,
            r.tipo_servicio, r.ubicacion_entrega, r.ubicacion_recoleccion, r.estado_logistico, r.precio_base, r.extras, r.operador_asignado,
            u.placas, COALESCE(u.numero_economico, '') as numero_economico, u.marca, u.modelo, COALESCE(u.tipo_unidad, 'remolque_seco') as tipo_unidad,
            COALESCE((SELECT SUM(p.monto) FROM pagos p WHERE p.renta_id = r.id), 0) AS total_pagado,
            (SELECT COUNT(*) FROM pagos p WHERE p.renta_id = r.id) AS pagos_count,
            (SELECT MAX(p.fecha) FROM pagos p WHERE p.renta_id = r.id) AS ultima_fecha_pago
     FROM rentas r
     JOIN unidades u ON u.id = r.unidad_id AND u.activo = 1
     ORDER BY r.fecha_inicio DESC`
  ).all();
  return rows.map((r) => {
    const base = mapRentaRow(r);
    return {
      ...base,
      totalPagado: Number(r.total_pagado) || 0,
      pagosCount: Number(r.pagos_count) || 0,
      ultimaFechaPago: r.ultima_fecha_pago ? String(r.ultima_fecha_pago) : undefined,
    };
  });
}

function mapRentaRow(r) {
  return {
    id: String(r.id),
    unidadId: String(r.unidad_id),
    placas: r.placas,
    numeroEconomico: String(r.numero_economico || '').trim(),
    marca: r.marca,
    modelo: r.modelo,
    tipoUnidad: r.tipo_unidad || 'remolque_seco',
    clienteId: r.cliente_id != null && r.cliente_id !== '' ? String(r.cliente_id) : undefined,
    clienteNombre: r.cliente_nombre,
    clienteTelefono: r.cliente_telefono || '',
    clienteEmail: r.cliente_email || '',
    fechaInicio: r.fecha_inicio,
    fechaFin: r.fecha_fin,
    estado: r.estado,
    monto: r.monto || 0,
    deposito: r.deposito || 0,
    observaciones: r.observaciones || '',
    creadoEn: r.creado_en,
    tipoServicio: r.tipo_servicio || 'solo_renta',
    ubicacionEntrega: r.ubicacion_entrega || '',
    ubicacionRecoleccion: r.ubicacion_recoleccion || '',
    estadoLogistico: r.estado_logistico || 'programado',
    precioBase: r.precio_base != null ? r.precio_base : (r.monto || 0),
    extras: r.extras != null ? r.extras : 0,
    operadorAsignado: r.operador_asignado || '',
  };
}

export function getRentaById(id) {
  const r = db.prepare(
    `SELECT r.*, u.placas, COALESCE(u.numero_economico, '') as numero_economico, u.marca, u.modelo, COALESCE(u.tipo_unidad, 'remolque_seco') as tipo_unidad
     FROM rentas r JOIN unidades u ON u.id = r.unidad_id WHERE r.id = ?`
  ).get(Number(id));
  if (!r) return null;
  const base = mapRentaRow(r);
  const ref = db.prepare('SELECT * FROM rentas_refrigerado WHERE renta_id = ?').get(Number(id));
  const maq = db.prepare('SELECT * FROM rentas_maquinaria WHERE renta_id = ?').get(Number(id));
  const pagos = db.prepare('SELECT * FROM pagos WHERE renta_id = ? ORDER BY fecha DESC, creado_en DESC').all(Number(id));
  const docs = db.prepare('SELECT * FROM rentas_documentos WHERE renta_id = ? ORDER BY creado_en DESC').all(Number(id));
  const hist = db.prepare('SELECT * FROM rentas_historial WHERE renta_id = ? ORDER BY fecha DESC').all(Number(id));
  return {
    ...base,
    refrigerado: ref ? {
      temperaturaObjetivo: ref.temperatura_objetivo,
      combustibleInicio: ref.combustible_inicio,
      combustibleFin: ref.combustible_fin,
      horasMotorInicio: ref.horas_motor_inicio,
      horasMotorFin: ref.horas_motor_fin,
      observaciones: ref.observaciones || '',
    } : null,
    maquinaria: maq ? {
      operadorAsignado: maq.operador_asignado || '',
      horasTrabajadas: maq.horas_trabajadas || 0,
      tipoTrabajo: maq.tipo_trabajo || '',
      observaciones: maq.observaciones || '',
    } : null,
    pagos: pagos.map(p => ({
      id: String(p.id),
      monto: p.monto,
      tipo: p.tipo,
      metodo: p.metodo,
      fecha: p.fecha,
      referencia: p.referencia || '',
      observaciones: p.observaciones || '',
      creadoEn: p.creado_en,
    })),
    documentos: docs.map(d => ({
      id: String(d.id),
      tipo: d.tipo,
      nombre: d.nombre,
      ruta: d.ruta,
      creadoEn: d.creado_en,
    })),
    historial: hist.map(h => ({
      id: String(h.id),
      accion: h.accion,
      detalle: h.detalle || '',
      fecha: h.fecha,
    })),
  };
}

export function createRenta(data, usuarioId = null) {
  const {
    unidadId, clienteNombre, clienteTelefono, clienteEmail, clienteId, fechaInicio, fechaFin,
    monto, deposito, observaciones, tipoServicio, ubicacionEntrega, ubicacionRecoleccion,
    precioBase, extras, operadorAsignado, refrigerado, maquinaria,
  } = data;
  let resolvedNombre = String(clienteNombre || '').trim();
  let resolvedTel = String(clienteTelefono || '').trim();
  let resolvedEmail = String(clienteEmail || '').trim();
  let resolvedClienteId = null;
  if (clienteId != null && clienteId !== '') {
    const cid = Number(clienteId);
    if (!Number.isFinite(cid)) return null;
    const cli = db
      .prepare(
        'SELECT id, nombre_comercial, razon_social, telefono, email FROM clientes WHERE id = ? AND activo = 1'
      )
      .get(cid);
    if (!cli) return null;
    resolvedClienteId = cid;
    if (!resolvedNombre) {
      resolvedNombre = String(cli.nombre_comercial || cli.razon_social || '').trim();
    }
    if (!resolvedTel) resolvedTel = String(cli.telefono || '').trim();
    if (!resolvedEmail) resolvedEmail = String(cli.email || '').trim();
  }
  if (!unidadId || !resolvedNombre || !fechaInicio || !fechaFin) return null;
  const u = db.prepare('SELECT id, tipo_unidad FROM unidades WHERE id = ? AND activo = 1').get(Number(unidadId));
  if (!u) return null;
  if (fechaInicio > fechaFin) return null;
  const total = (Number(precioBase) || 0) + (Number(extras) || 0) || Number(monto) || 0;
  const r = db.prepare(
    `INSERT INTO rentas (unidad_id, cliente_id, cliente_nombre, cliente_telefono, cliente_email, fecha_inicio, fecha_fin, estado, monto, deposito, observaciones,
      tipo_servicio, ubicacion_entrega, ubicacion_recoleccion, estado_logistico, precio_base, extras, operador_asignado)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'reservada', ?, ?, ?, ?, ?, ?, 'programado', ?, ?, ?)`
  ).run(
    Number(unidadId),
    resolvedClienteId,
    resolvedNombre,
    resolvedTel,
    resolvedEmail,
    fechaInicio,
    fechaFin,
    total,
    Number(deposito) || 0,
    String(observaciones || '').trim(),
    TIPOS_SERVICIO.includes(tipoServicio) ? tipoServicio : 'solo_renta',
    String(ubicacionEntrega || '').trim(),
    String(ubicacionRecoleccion || '').trim(),
    Number(precioBase) || 0,
    Number(extras) || 0,
    String(operadorAsignado || '').trim()
  );
  const rentaId = r.lastInsertRowid;
  if (unidadUsaDatosRefrigeracion(u.tipo_unidad) && refrigerado) {
    db.prepare(
      `INSERT INTO rentas_refrigerado (renta_id, temperatura_objetivo, combustible_inicio, combustible_fin, horas_motor_inicio, horas_motor_fin, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      rentaId,
      Number(refrigerado.temperaturaObjetivo) || 0,
      Number(refrigerado.combustibleInicio) || 0,
      Number(refrigerado.combustibleFin) || 0,
      Number(refrigerado.horasMotorInicio) || 0,
      Number(refrigerado.horasMotorFin) || 0,
      String(refrigerado.observaciones || '').trim()
    );
  }
  if (u.tipo_unidad === 'maquinaria' && maquinaria) {
    db.prepare(
      `INSERT INTO rentas_maquinaria (renta_id, operador_asignado, horas_trabajadas, tipo_trabajo, observaciones)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      rentaId,
      String(maquinaria.operadorAsignado || '').trim(),
      Number(maquinaria.horasTrabajadas) || 0,
      String(maquinaria.tipoTrabajo || '').trim(),
      String(maquinaria.observaciones || '').trim()
    );
  }
  addRentaHistorial(rentaId, 'Renta creada', `Reservación registrada para ${resolvedNombre}`, usuarioId, 'mdi:calendar-plus');
  return getRentaById(rentaId);
}

function getRentaContextForLog(rentaId) {
  return db.prepare(
    `SELECT r.cliente_nombre, u.placas FROM rentas r JOIN unidades u ON u.id = r.unidad_id WHERE r.id = ?`
  ).get(Number(rentaId));
}

function addRentaHistorial(rentaId, accion, detalle, usuarioId = null, icon = 'mdi:file-document') {
  db.prepare(
    'INSERT INTO rentas_historial (renta_id, accion, detalle, usuario_id) VALUES (?, ?, ?, ?)'
  ).run(rentaId, accion, detalle || '', usuarioId);
  const ctx = getRentaContextForLog(rentaId);
  const base = (detalle || '').trim();
  const line = ctx
    ? (base ? `${base} · ${ctx.placas} · ${ctx.cliente_nombre}` : `${accion} · ${ctx.placas} · ${ctx.cliente_nombre}`)
    : (base || accion);
  registrarSistemaActividad({
    categoria: 'renta',
    accion,
    detalle: line,
    entidadTipo: 'renta',
    entidadId: String(rentaId),
    usuarioId,
    icon,
  });
}

export function updateRenta(id, data, usuarioId = null) {
  const r = db.prepare('SELECT id FROM rentas WHERE id = ?').get(Number(id));
  if (!r) return null;
  const before = db.prepare(
    `SELECT r.*, u.placas FROM rentas r JOIN unidades u ON u.id = r.unidad_id WHERE r.id = ?`
  ).get(Number(id));
  const updates = [];
  const values = [];
  const {
    unidadId, clienteNombre, clienteTelefono, clienteEmail, clienteId, fechaInicio, fechaFin, estado, monto, deposito, observaciones,
    tipoServicio, ubicacionEntrega, ubicacionRecoleccion, estadoLogistico, precioBase, extras, operadorAsignado,
    refrigerado, maquinaria,
  } = data;
  if (unidadId != null) { updates.push('unidad_id = ?'); values.push(Number(unidadId)); }
  if ('clienteId' in data) {
    if (data.clienteId == null || data.clienteId === '') {
      updates.push('cliente_id = NULL');
    } else {
      const cid = Number(data.clienteId);
      const cli = db.prepare('SELECT id FROM clientes WHERE id = ? AND activo = 1').get(cid);
      if (!cli) return null;
      updates.push('cliente_id = ?');
      values.push(cid);
    }
  }
  if (clienteNombre != null) { updates.push('cliente_nombre = ?'); values.push(String(clienteNombre).trim()); }
  if (clienteTelefono != null) { updates.push('cliente_telefono = ?'); values.push(String(clienteTelefono || '')); }
  if (clienteEmail != null) { updates.push('cliente_email = ?'); values.push(String(clienteEmail || '')); }
  if (fechaInicio != null) { updates.push('fecha_inicio = ?'); values.push(fechaInicio); }
  if (fechaFin != null) { updates.push('fecha_fin = ?'); values.push(fechaFin); }
  if (estado != null && ESTADOS_RENTA.includes(estado)) { updates.push('estado = ?'); values.push(estado); }
  if (monto != null && precioBase == null && extras == null) { updates.push('monto = ?'); values.push(Number(monto) || 0); }
  if (deposito != null) { updates.push('deposito = ?'); values.push(Number(deposito) || 0); }
  if (observaciones != null) { updates.push('observaciones = ?'); values.push(String(observaciones || '')); }
  if (tipoServicio != null && TIPOS_SERVICIO.includes(tipoServicio)) { updates.push('tipo_servicio = ?'); values.push(tipoServicio); }
  if (ubicacionEntrega != null) { updates.push('ubicacion_entrega = ?'); values.push(String(ubicacionEntrega || '')); }
  if (ubicacionRecoleccion != null) { updates.push('ubicacion_recoleccion = ?'); values.push(String(ubicacionRecoleccion || '')); }
  if (estadoLogistico != null && ESTADOS_LOGISTICOS.includes(estadoLogistico)) { updates.push('estado_logistico = ?'); values.push(estadoLogistico); }
  if (precioBase != null) { updates.push('precio_base = ?'); values.push(Number(precioBase) || 0); }
  if (extras != null) { updates.push('extras = ?'); values.push(Number(extras) || 0); }
  if (operadorAsignado != null) { updates.push('operador_asignado = ?'); values.push(String(operadorAsignado || '')); }
  if (precioBase != null || extras != null) {
    const row = db.prepare('SELECT precio_base, extras, monto FROM rentas WHERE id = ?').get(Number(id));
    const pb = precioBase != null ? Number(precioBase) || 0 : (row?.precio_base ?? 0);
    const ex = extras != null ? Number(extras) || 0 : (row?.extras ?? 0);
    updates.push('monto = ?');
    values.push(pb + ex || row?.monto || 0);
  }
  if (updates.length > 0) {
    values.push(id);
    db.prepare(`UPDATE rentas SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  if (refrigerado) {
    const ex = db.prepare('SELECT id FROM rentas_refrigerado WHERE renta_id = ?').get(Number(id));
    const vals = [
      Number(refrigerado.temperaturaObjetivo) || 0,
      Number(refrigerado.combustibleInicio) || 0,
      Number(refrigerado.combustibleFin) || 0,
      Number(refrigerado.horasMotorInicio) || 0,
      Number(refrigerado.horasMotorFin) || 0,
      String(refrigerado.observaciones || '').trim(),
    ];
    if (ex) {
      db.prepare(
        `UPDATE rentas_refrigerado SET temperatura_objetivo=?, combustible_inicio=?, combustible_fin=?, horas_motor_inicio=?, horas_motor_fin=?, observaciones=? WHERE renta_id=?`
      ).run(...vals, Number(id));
    } else {
      db.prepare(
        `INSERT INTO rentas_refrigerado (renta_id, temperatura_objetivo, combustible_inicio, combustible_fin, horas_motor_inicio, horas_motor_fin, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(Number(id), ...vals);
    }
  }
  if (maquinaria) {
    const ex = db.prepare('SELECT id FROM rentas_maquinaria WHERE renta_id = ?').get(Number(id));
    const vals = [
      String(maquinaria.operadorAsignado || '').trim(),
      Number(maquinaria.horasTrabajadas) || 0,
      String(maquinaria.tipoTrabajo || '').trim(),
      String(maquinaria.observaciones || '').trim(),
    ];
    if (ex) {
      db.prepare(
        `UPDATE rentas_maquinaria SET operador_asignado=?, horas_trabajadas=?, tipo_trabajo=?, observaciones=? WHERE renta_id=?`
      ).run(...vals, Number(id));
    } else {
      db.prepare(
        `INSERT INTO rentas_maquinaria (renta_id, operador_asignado, horas_trabajadas, tipo_trabajo, observaciones) VALUES (?, ?, ?, ?, ?)`
      ).run(Number(id), ...vals);
    }
  }
  const cambios = [];
  if (before) {
    if (unidadId != null && Number(unidadId) !== before.unidad_id) cambios.push(`Unidad ID ${before.unidad_id} → ${unidadId}`);
    if ('clienteId' in data) cambios.push('Cliente del catálogo actualizado');
    if (clienteNombre != null && String(clienteNombre).trim() !== before.cliente_nombre) cambios.push('Cliente actualizado');
    if (clienteTelefono != null && String(clienteTelefono || '') !== (before.cliente_telefono || '')) cambios.push('Teléfono actualizado');
    if (clienteEmail != null && String(clienteEmail || '') !== (before.cliente_email || '')) cambios.push('Email actualizado');
    if (fechaInicio != null && fechaInicio !== before.fecha_inicio) cambios.push(`Inicio: ${before.fecha_inicio} → ${fechaInicio}`);
    if (fechaFin != null && fechaFin !== before.fecha_fin) cambios.push(`Fin: ${before.fecha_fin} → ${fechaFin}`);
    if (estado != null && estado !== before.estado) cambios.push(`Estado: ${before.estado} → ${estado}`);
    if (deposito != null && Number(deposito) !== (before.deposito || 0)) cambios.push('Depósito actualizado');
    if (observaciones != null && String(observaciones || '') !== (before.observaciones || '')) cambios.push('Observaciones actualizadas');
    if (tipoServicio != null && tipoServicio !== (before.tipo_servicio || 'solo_renta')) cambios.push(`Tipo servicio: ${tipoServicio}`);
    if (ubicacionEntrega != null && String(ubicacionEntrega || '') !== (before.ubicacion_entrega || '')) cambios.push('Ubicación entrega actualizada');
    if (ubicacionRecoleccion != null && String(ubicacionRecoleccion || '') !== (before.ubicacion_recoleccion || '')) cambios.push('Ubicación recolección actualizada');
    if (estadoLogistico != null && estadoLogistico !== (before.estado_logistico || 'programado')) {
      cambios.push(`Logística: ${before.estado_logistico || 'programado'} → ${estadoLogistico}`);
    }
    if (precioBase != null || extras != null) cambios.push('Montos / precios actualizados');
    if (operadorAsignado != null && String(operadorAsignado || '') !== (before.operador_asignado || '')) cambios.push('Operador actualizado');
    if (refrigerado) cambios.push('Datos refrigerado actualizados');
    if (maquinaria) cambios.push('Datos maquinaria actualizados');
    if (monto != null && precioBase == null && extras == null && Number(monto) !== (before.monto || 0)) cambios.push('Monto actualizado');
  }
  if (cambios.length > 0) {
    addRentaHistorial(
      id,
      'Renta editada',
      `${before.placas} · ${cambios.join(' · ')}`,
      usuarioId,
      'mdi:pencil'
    );
  }
  return getRentaById(id);
}

export function deleteRenta(id, usuarioId = null) {
  const snap = db.prepare(
    `SELECT r.id, r.cliente_nombre, u.placas FROM rentas r JOIN unidades u ON u.id = r.unidad_id WHERE r.id = ?`
  ).get(Number(id));
  if (!snap) return null;
  registrarSistemaActividad({
    categoria: 'renta',
    accion: 'Renta eliminada',
    detalle: `${snap.placas} · ${snap.cliente_nombre}`,
    entidadTipo: 'renta',
    entidadId: String(id),
    usuarioId,
    icon: 'mdi:delete',
  });
  db.prepare('DELETE FROM rentas WHERE id = ?').run(Number(id));
  return true;
}

export function getActividadReciente(limit = 15) {
  const max = Math.min(Math.max(1, Number(limit) || 15), 500);
  const rows = db.prepare(
    `SELECT s.id, s.categoria, s.accion, s.detalle, s.fecha, s.icon, s.entidad_tipo, s.entidad_id, s.usuario_id,
            ua.nombre AS usuario_nombre
     FROM sistema_actividad s
     LEFT JOIN usuarios ua ON ua.id = s.usuario_id
     ORDER BY s.fecha DESC
     LIMIT ?`
  ).all(max);
  return rows.map((s) => {
    const tipo = ['unidad', 'renta', 'usuario', 'mantenimiento', 'auth', 'sistema', 'proveedor', 'cliente'].includes(
      s.categoria
    )
      ? s.categoria
      : 'sistema';
    const ic = String(s.icon ?? '')
      .trim()
      .replace(/\s+/g, '');
    const out = {
      tipo,
      id: `s-${s.id}`,
      accion: s.accion,
      detalle: s.detalle || '',
      fecha: s.fecha,
      icon: ic || 'mdi:information',
      usuarioNombre: s.usuario_nombre || undefined,
    };
    if (s.entidad_tipo === 'renta' && s.entidad_id) out.rentaId = String(s.entidad_id);
    if (s.entidad_tipo === 'unidad' && s.entidad_id) out.unidadId = String(s.entidad_id);
    if (s.entidad_tipo === 'mantenimiento' && s.entidad_id) out.mantenimientoId = String(s.entidad_id);
    if (s.entidad_tipo === 'cliente' && s.entidad_id) out.clienteId = String(s.entidad_id);
    return out;
  });
}

export function getRentasProximosVencimientos(dias = 14) {
  const hoy = new Date().toISOString().slice(0, 10);
  const fin = new Date();
  fin.setDate(fin.getDate() + dias);
  const finStr = fin.toISOString().slice(0, 10);
  const rows = db.prepare(
    `SELECT r.id, r.unidad_id, r.cliente_nombre, r.fecha_inicio, r.fecha_fin, r.estado, u.placas, COALESCE(u.numero_economico, '') as numero_economico, u.marca, u.modelo
     FROM rentas r
     JOIN unidades u ON u.id = r.unidad_id AND u.activo = 1
     WHERE r.fecha_fin >= ? AND r.fecha_fin <= ? AND r.estado IN ('activa', 'reservada')
     ORDER BY r.fecha_fin ASC`
  ).all(hoy, finStr);
  return rows.map((r) => ({
    id: String(r.id),
    unidadId: String(r.unidad_id),
    placas: r.placas,
    numeroEconomico: String(r.numero_economico || '').trim(),
    marca: r.marca,
    modelo: r.modelo,
    clienteNombre: r.cliente_nombre,
    fechaFin: r.fecha_fin,
    estado: r.estado,
  }));
}

export function addPago(rentaId, data, usuarioId = null) {
  const { monto, tipo, metodo, fecha, referencia, observaciones } = data;
  if (!rentaId || monto == null) return null;
  const r = db.prepare('SELECT id FROM rentas WHERE id = ?').get(Number(rentaId));
  if (!r) return null;
  const res = db.prepare(
    `INSERT INTO pagos (renta_id, monto, tipo, metodo, fecha, referencia, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    Number(rentaId),
    Number(monto),
    String(tipo || 'pago_parcial'),
    String(metodo || 'efectivo'),
    fecha || new Date().toISOString().slice(0, 10),
    String(referencia || '').trim(),
    String(observaciones || '').trim()
  );
  addRentaHistorial(rentaId, 'Pago registrado', `$${Number(monto).toFixed(2)} - ${tipo || 'pago'}`, usuarioId, 'mdi:cash');
  return { id: String(res.lastInsertRowid) };
}

export function addRentaDocumento(rentaId, tipo, nombre, ruta, usuarioId = null) {
  const r = db.prepare('SELECT id FROM rentas WHERE id = ?').get(Number(rentaId));
  if (!r) return null;
  const res = db.prepare(
    'INSERT INTO rentas_documentos (renta_id, tipo, nombre, ruta) VALUES (?, ?, ?, ?)'
  ).run(Number(rentaId), tipo || 'contrato', nombre, ruta);
  addRentaHistorial(rentaId, 'Documento agregado', `${tipo}: ${nombre}`, usuarioId, 'mdi:file-upload');
  return { id: String(res.lastInsertRowid) };
}

export function addRentaHistorialPublic(rentaId, accion, detalle, usuarioId, icon = 'mdi:note-text') {
  addRentaHistorial(rentaId, accion, detalle, usuarioId, icon);
  return true;
}

/* ─── Mantenimiento ─── */
const TIPOS_MANTENIMIENTO = ['preventivo', 'correctivo', 'revision'];
const ESTADOS_MANTENIMIENTO = ['programado', 'en_proceso', 'completado', 'pospuesto'];

function mapMantenimientoRow(m) {
  const o = {
    id: String(m.id),
    unidadId: String(m.unidad_id),
    tipo: m.tipo,
    descripcion: m.descripcion || '',
    costo: m.costo || 0,
    fechaInicio: m.fecha_inicio,
    fechaFin: m.fecha_fin || null,
    estado: m.estado,
    creadoEn: m.creado_en,
  };
  if (m.placas != null) {
    o.placas = m.placas;
    o.marca = m.marca;
    o.modelo = m.modelo;
    o.numeroEconomico = String(m.numero_economico ?? '').trim();
  }
  if (m.proveedor_id != null && m.proveedor_id !== '') {
    o.proveedorId = String(m.proveedor_id);
  }
  if (m.proveedor_nombre) {
    o.proveedorNombre = m.proveedor_nombre;
  }
  return o;
}

export function getMantenimientosByUnidad(unidadId) {
  const rows = db.prepare(
    `SELECT m.*, p.nombre_razon_social AS proveedor_nombre
     FROM mantenimiento m
     LEFT JOIN proveedores p ON p.id = m.proveedor_id
     WHERE m.unidad_id = ? ORDER BY m.fecha_inicio DESC`
  ).all(Number(unidadId));
  return rows.map((m) => mapMantenimientoRow(m));
}

export function getAllMantenimientos() {
  const rows = db.prepare(
    `SELECT m.*, u.placas, COALESCE(u.numero_economico, '') as numero_economico, u.marca, u.modelo, p.nombre_razon_social AS proveedor_nombre
     FROM mantenimiento m
     JOIN unidades u ON u.id = m.unidad_id
     LEFT JOIN proveedores p ON p.id = m.proveedor_id
     ORDER BY m.fecha_inicio DESC`
  ).all();
  return rows.map((m) => mapMantenimientoRow(m));
}

export function createMantenimiento(data, usuarioId = null) {
  const { unidadId, tipo, descripcion, costo, fechaInicio, fechaFin, estado, proveedorId } = data;
  if (!unidadId || !fechaInicio) return null;
  const u = db.prepare('SELECT id, placas FROM unidades WHERE id = ? AND activo = 1').get(Number(unidadId));
  if (!u) return null;
  let proveedorIdDb = null;
  let provLabel = '';
  if (proveedorId != null && proveedorId !== '') {
    const pid = Number(proveedorId);
    if (!Number.isFinite(pid)) return null;
    const pr = db.prepare('SELECT id, nombre_razon_social FROM proveedores WHERE id = ? AND activo = 1').get(pid);
    if (!pr) return null;
    proveedorIdDb = pid;
    provLabel = ` · ${pr.nombre_razon_social}`;
  }
  const res = db.prepare(
    `INSERT INTO mantenimiento (unidad_id, proveedor_id, tipo, descripcion, costo, fecha_inicio, fecha_fin, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    Number(unidadId),
    proveedorIdDb,
    TIPOS_MANTENIMIENTO.includes(tipo) ? tipo : 'preventivo',
    String(descripcion || '').trim(),
    Number(costo) || 0,
    fechaInicio,
    fechaFin || null,
    ESTADOS_MANTENIMIENTO.includes(estado) ? estado : 'programado'
  );
  const id = res.lastInsertRowid;
  db.prepare("UPDATE unidades SET estado_mantenimiento = 'en_mantenimiento' WHERE id = ?").run(Number(unidadId));
  registrarSistemaActividad({
    categoria: 'mantenimiento',
    accion: 'Mantenimiento creado',
    detalle: `${tipo || 'preventivo'} · ${u.placas}${provLabel} · ${String(descripcion || '').slice(0, 80)}`,
    entidadTipo: 'mantenimiento',
    entidadId: String(id),
    usuarioId,
    icon: 'mdi:wrench',
  });
  return getMantenimientoById(id);
}

function getMantenimientoById(id) {
  const m = db.prepare(
    `SELECT m.*, u.placas, COALESCE(u.numero_economico, '') as numero_economico, u.marca, u.modelo, p.nombre_razon_social AS proveedor_nombre
     FROM mantenimiento m
     JOIN unidades u ON u.id = m.unidad_id
     LEFT JOIN proveedores p ON p.id = m.proveedor_id
     WHERE m.id = ?`
  ).get(Number(id));
  if (!m) return null;
  return mapMantenimientoRow(m);
}

export function updateMantenimiento(id, data, usuarioId = null) {
  const m = db.prepare('SELECT id, unidad_id FROM mantenimiento WHERE id = ?').get(Number(id));
  if (!m) return null;
  const { tipo, descripcion, costo, fechaInicio, fechaFin, estado } = data;
  const updates = [];
  const values = [];
  const campos = [];
  if (tipo != null && TIPOS_MANTENIMIENTO.includes(tipo)) { updates.push('tipo = ?'); values.push(tipo); campos.push('tipo'); }
  if (descripcion != null) { updates.push('descripcion = ?'); values.push(String(descripcion).trim()); campos.push('descripción'); }
  if (costo != null) { updates.push('costo = ?'); values.push(Number(costo) || 0); campos.push('costo'); }
  if (fechaInicio != null) { updates.push('fecha_inicio = ?'); values.push(fechaInicio); campos.push('inicio'); }
  if (fechaFin != null) { updates.push('fecha_fin = ?'); values.push(fechaFin === '' ? null : fechaFin); campos.push('fin'); }
  if ('proveedorId' in data) {
    if (data.proveedorId == null || data.proveedorId === '') {
      updates.push('proveedor_id = NULL');
      campos.push('proveedor (sin vínculo)');
    } else {
      const pid = Number(data.proveedorId);
      if (!Number.isFinite(pid)) return null;
      const pr = db.prepare('SELECT id FROM proveedores WHERE id = ? AND activo = 1').get(pid);
      if (!pr) return null;
      updates.push('proveedor_id = ?');
      values.push(pid);
      campos.push('proveedor');
    }
  }
  if (estado != null && ESTADOS_MANTENIMIENTO.includes(estado)) {
    updates.push('estado = ?');
    values.push(estado);
    campos.push(`estado → ${estado}`);
    if (estado === 'completado') {
      db.prepare("UPDATE unidades SET estado_mantenimiento = 'disponible' WHERE id = ?").run(m.unidad_id);
    }
  }
  if (updates.length > 0) {
    values.push(id);
    db.prepare(`UPDATE mantenimiento SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  if (campos.length > 0) {
    const pl = db.prepare('SELECT placas FROM unidades WHERE id = ?').get(m.unidad_id);
    registrarSistemaActividad({
      categoria: 'mantenimiento',
      accion: 'Mantenimiento actualizado',
      detalle: `#${id} · ${pl?.placas || ''} · ${campos.join(', ')}`,
      entidadTipo: 'mantenimiento',
      entidadId: String(id),
      usuarioId,
      icon: 'mdi:wrench-clock',
    });
  }
  return getMantenimientoById(id);
}

export function getRentasPorMes(ano, mes) {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const fin = `${ano}-${String(mes).padStart(2, '0')}-31`;
  const rows = db.prepare(
    `SELECT r.id, r.unidad_id, r.cliente_nombre, r.fecha_inicio, r.fecha_fin, r.estado, r.estado_logistico,
            u.placas, COALESCE(u.numero_economico, '') as numero_economico, COALESCE(u.tipo_unidad, 'remolque_seco') as tipo_unidad
     FROM rentas r
     JOIN unidades u ON u.id = r.unidad_id AND u.activo = 1
     WHERE (r.fecha_inicio <= ? AND r.fecha_fin >= ?) OR (r.fecha_inicio BETWEEN ? AND ?)
     ORDER BY r.fecha_inicio`
  ).all(fin, inicio, inicio, fin);
  return rows.map(r => ({
    id: String(r.id),
    unidadId: String(r.unidad_id),
    placas: r.placas,
    numeroEconomico: String(r.numero_economico || '').trim(),
    tipoUnidad: r.tipo_unidad || 'remolque_seco',
    clienteNombre: r.cliente_nombre,
    fechaInicio: r.fecha_inicio,
    fechaFin: r.fecha_fin,
    estado: r.estado,
    estadoLogistico: r.estado_logistico || 'programado',
  }));
}

export function getUsuarioByEmail(email) {
  const e = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!e) return undefined;
  return db.prepare(
    'SELECT id, email, password_hash, nombre, avatar, rol, activo FROM usuarios WHERE lower(trim(email)) = ?'
  ).get(e);
}

export function getUsuarioById(id) {
  return db.prepare(
    'SELECT id, email, nombre, avatar, rol, activo, creado_en FROM usuarios WHERE id = ? AND activo = 1'
  ).get(id);
}

export function getAllUsuarios() {
  return db.prepare(
    'SELECT id, email, nombre, rol, activo, creado_en FROM usuarios ORDER BY nombre'
  ).all();
}

/** Catálogo para asignar operador en rentas (usuarios activos con rol operador). */
export function getUsuariosCatalogoOperadores() {
  return db
    .prepare(
      'SELECT id, nombre FROM usuarios WHERE activo = 1 AND rol = ? ORDER BY nombre COLLATE NOCASE'
    )
    .all(ROLES.OPERADOR);
}

export function getUsuarioByIdAdmin(id) {
  const u = db.prepare(
    'SELECT id, email, nombre, apellidos, rfc, curp, telefono, avatar, rol, activo, creado_en FROM usuarios WHERE id = ?'
  ).get(id);
  if (!u) return null;
  return {
    ...u,
    apellidos: u.apellidos || '',
    rfc: u.rfc || '',
    curp: u.curp || '',
    telefono: u.telefono || '',
    avatar: u.avatar || '',
  };
}

export function createUsuario(email, passwordHash, nombre, rol, creadoPorId = null) {
  const run = db.prepare(
    'INSERT INTO usuarios (email, password_hash, nombre, rol, activo) VALUES (?, ?, ?, ?, 1)'
  );
  const result = run.run(email, passwordHash, nombre, rol);
  const newId = result.lastInsertRowid;
  registrarSistemaActividad({
    categoria: 'usuario',
    accion: 'Usuario creado',
    detalle: `${nombre} · ${email} · rol ${rol}`,
    entidadTipo: 'usuario',
    entidadId: String(newId),
    usuarioId: creadoPorId,
    icon: 'mdi:account-plus',
  });
  return newId;
}

export function updateUsuario(id, data, actorId = null) {
  const updates = [];
  const values = [];
  const campos = [];
  if (data.nombre != null) { updates.push('nombre = ?'); values.push(data.nombre); campos.push('nombre'); }
  if (data.apellidos != null) { updates.push('apellidos = ?'); values.push(data.apellidos); campos.push('apellidos'); }
  if (data.rfc != null) { updates.push('rfc = ?'); values.push(data.rfc); campos.push('rfc'); }
  if (data.curp != null) { updates.push('curp = ?'); values.push(data.curp); campos.push('curp'); }
  if (data.telefono != null) { updates.push('telefono = ?'); values.push(data.telefono); campos.push('teléfono'); }
  if (data.avatar != null) { updates.push('avatar = ?'); values.push(data.avatar); campos.push('avatar'); }
  if (data.rol != null) { updates.push('rol = ?'); values.push(data.rol); campos.push('rol'); }
  if (data.password_hash != null) { updates.push('password_hash = ?'); values.push(data.password_hash); campos.push('contraseña'); }
  if (data.activo != null) { updates.push('activo = ?'); values.push(data.activo ? 1 : 0); campos.push(data.activo ? 'reactivado' : 'desactivado'); }
  if (updates.length === 0) return;
  updates.push("actualizado_en = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const u = db.prepare('SELECT email, nombre FROM usuarios WHERE id = ?').get(Number(id));
  const accion = data.activo === false ? 'Usuario desactivado' : 'Usuario actualizado';
  registrarSistemaActividad({
    categoria: 'usuario',
    accion,
    detalle: u ? `${u.nombre} (${u.email}) · ${campos.join(', ')}` : `ID ${id} · ${campos.join(', ')}`,
    entidadTipo: 'usuario',
    entidadId: String(id),
    usuarioId: actorId,
    icon: data.activo === false ? 'mdi:account-off' : 'mdi:account-edit',
  });
}

/**
 * Borra el usuario de la BD. Solo si está desactivado (activo = 0).
 * Anula FKs en auditoría / check-in / historial de rentas.
 */
export function eliminarUsuarioDefinitivo(id, actorId = null) {
  const u = db
    .prepare('SELECT id, email, nombre, activo FROM usuarios WHERE id = ?')
    .get(Number(id));
  if (!u) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (u.activo) {
    const err = new Error('Desactiva el usuario antes de eliminarlo definitivamente');
    err.code = 'MUST_DEACTIVATE';
    throw err;
  }
  const uid = Number(u.id);
  const tx = db.transaction(() => {
    db.prepare('UPDATE sistema_actividad SET usuario_id = NULL WHERE usuario_id = ?').run(uid);
    db.prepare('UPDATE checkin_out_registros SET usuario_id = NULL WHERE usuario_id = ?').run(uid);
    db.prepare('UPDATE rentas_historial SET usuario_id = NULL WHERE usuario_id = ?').run(uid);
    const r = db.prepare('DELETE FROM usuarios WHERE id = ? AND activo = 0').run(uid);
    if (r.changes !== 1) {
      throw new Error('No se pudo eliminar el usuario');
    }
  });
  tx();
  registrarSistemaActividad({
    categoria: 'usuario',
    accion: 'Usuario eliminado definitivamente',
    detalle: `${u.nombre} (${u.email})`,
    entidadTipo: 'usuario',
    entidadId: String(uid),
    usuarioId: actorId,
    icon: 'mdi:account-remove',
  });
}

export function getUsuarioPerfil(id) {
  const u = db.prepare(
    'SELECT id, email, nombre, apellidos, rfc, curp, telefono, avatar, rol, creado_en FROM usuarios WHERE id = ? AND activo = 1'
  ).get(Number(id));
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre || '',
    apellidos: u.apellidos || '',
    rfc: u.rfc || '',
    curp: u.curp || '',
    telefono: u.telefono || '',
    avatar: u.avatar || '',
    rol: u.rol,
    creado_en: u.creado_en,
  };
}

export function existeUsuarioPorEmail(email, excludeId = null) {
  const row = excludeId
    ? db.prepare('SELECT 1 FROM usuarios WHERE email = ? AND id != ?').get(email, excludeId)
    : db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email);
  return !!row;
}

/* ─── Unidades ─── */
const ESTADOS_UNIDAD = ['Disponible', 'En Renta'];
const SUBESTADOS_DISPONIBLE = ['disponible', 'taller', 'almacen_exclusivo', 'pendiente_placas'];
const UBICACIONES_DISPONIBLE = ['lote', 'patio'];

export function initUnidades() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS unidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placas TEXT UNIQUE NOT NULL,
      marca TEXT NOT NULL,
      modelo TEXT NOT NULL,
      estatus TEXT NOT NULL DEFAULT 'Disponible',
      numero_serie_caja TEXT DEFAULT '',
      tiene_gps INTEGER NOT NULL DEFAULT 0,
      gps_numero_1 TEXT DEFAULT '',
      gps_numero_2 TEXT DEFAULT '',
      subestatus_disponible TEXT NOT NULL DEFAULT 'disponible',
      ubicacion_disponible TEXT NOT NULL DEFAULT 'lote',
      kilometraje INTEGER NOT NULL DEFAULT 0,
      combustible_pct INTEGER NOT NULL DEFAULT 0,
      observaciones TEXT DEFAULT '',
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now')),
      actualizado_en TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS unidad_documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unidad_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      nombre TEXT NOT NULL,
      ruta TEXT DEFAULT '',
      fecha_subida TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unidad_id) REFERENCES unidades(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS unidad_actividad (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unidad_id INTEGER NOT NULL,
      accion TEXT NOT NULL,
      detalle TEXT NOT NULL,
      fecha TEXT DEFAULT (datetime('now')),
      icon TEXT DEFAULT 'mdi:information',
      FOREIGN KEY (unidad_id) REFERENCES unidades(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS unidad_imagenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unidad_id INTEGER NOT NULL,
      nombre_archivo TEXT NOT NULL,
      ruta TEXT NOT NULL,
      descripcion TEXT DEFAULT '',
      fecha_subida TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unidad_id) REFERENCES unidades(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_unidad_docs_unidad ON unidad_documentos(unidad_id);
    CREATE INDEX IF NOT EXISTS idx_unidad_act_unidad ON unidad_actividad(unidad_id);
    CREATE INDEX IF NOT EXISTS idx_unidad_img_unidad ON unidad_imagenes(unidad_id);
  `);
  // Seed inicial si no hay unidades
  const count = db.prepare('SELECT COUNT(*) as n FROM unidades').get();
  if (count.n === 0) {
    const ins = db.prepare(
      'INSERT INTO unidades (placas, marca, modelo, estatus, kilometraje, combustible_pct, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    ins.run('ABC-12-34', 'Toyota', 'Hilux', 'Disponible', 48210, 74, 'Sin pendientes críticos.');
    ins.run('DEF-56-78', 'Ford', 'Ranger', 'En Renta', 52940, 41, 'Revisar kit herramientas antes de check-out.');
    ins.run('GHI-90-12', 'Chevrolet', 'Colorado', 'Disponible', 61205, 12, 'En proceso: cambio de aceite y revisión general.');
    ins.run('JKL-34-56', 'Nissan', 'NP300', 'Disponible', 39110, 88, 'Listo para salir.');
    const insDoc = db.prepare(
      'INSERT INTO unidad_documentos (unidad_id, tipo, nombre) VALUES (?, ?, ?)'
    );
    insDoc.run(1, 'Seguro', 'Seguro_ABC-12-34.pdf');
    insDoc.run(1, 'Verificación', 'Verificación_2025.pdf');
    insDoc.run(2, 'Seguro', 'Seguro_DEF-56-78.pdf');
    insDoc.run(3, 'Otro', 'Orden_Taller_1042.pdf');
    insDoc.run(4, 'Tarjeta', 'Tarjeta_Circulación.pdf');
    const insAct = db.prepare(
      'INSERT INTO unidad_actividad (unidad_id, accion, detalle, icon) VALUES (?, ?, ?, ?)'
    );
    insAct.run(1, 'Check-in registrado', 'Inventario actualizado y sin daños nuevos.', 'mdi:clipboard-check-outline');
    insAct.run(2, 'Renta iniciada', 'Contrato #1245 generado.', 'mdi:key-chain');
    insAct.run(3, 'Unidad enviada a taller', 'Servicio preventivo programado.', 'mdi:wrench');
    insAct.run(4, 'Check-out registrado', 'Combustible y herramientas OK.', 'mdi:clipboard-check');
  }
  migrarUnidades();
}

export function getAllUnidades() {
  const rows = db.prepare(
    `SELECT id, placas, COALESCE(numero_economico, '') as numero_economico, marca, modelo, estatus, numero_serie_caja,
            COALESCE(tiene_gps, 0) as tiene_gps, COALESCE(gps_numero_1, '') as gps_numero_1, COALESCE(gps_numero_2, '') as gps_numero_2,
            subestatus_disponible, ubicacion_disponible,
            kilometraje, combustible_pct,           observaciones, creado_en,
            COALESCE(tipo_unidad, 'remolque_seco') as tipo_unidad,
            COALESCE(estado_mantenimiento, 'disponible') as estado_mantenimiento,
            COALESCE(horas_motor, 0) as horas_motor,
            COALESCE(gestor_fisico_mecanica, '') as gestor_fisico_mecanica,
            COALESCE(fm_foto_anterior_ruta, '') as fm_foto_anterior_ruta,
            COALESCE(fm_foto_vigente_ruta, '') as fm_foto_vigente_ruta,
            COALESCE(tarjeta_circulacion_ruta, '') as tarjeta_circulacion_ruta,
            unidad_rotulada,
            (
              SELECT r.cliente_nombre
              FROM rentas r
              WHERE r.unidad_id = unidades.id AND r.estado IN ('reservada', 'activa')
              ORDER BY CASE r.estado WHEN 'activa' THEN 0 ELSE 1 END, r.fecha_inicio DESC
              LIMIT 1
            ) AS cliente_en_renta
     FROM unidades WHERE activo = 1
     ORDER BY CASE WHEN TRIM(COALESCE(numero_economico, '')) = '' THEN 1 ELSE 0 END,
              numero_economico COLLATE NOCASE,
              placas COLLATE NOCASE`
  ).all();
  const docs = db.prepare(
    'SELECT id, unidad_id, tipo, nombre, ruta, fecha_subida FROM unidad_documentos ORDER BY fecha_subida DESC'
  ).all();
  const acts = db.prepare(
    'SELECT id, unidad_id, accion, detalle, fecha, icon FROM unidad_actividad ORDER BY fecha DESC'
  ).all();
  const imgs = db.prepare(
    'SELECT id, unidad_id, nombre_archivo, ruta, descripcion, fecha_subida FROM unidad_imagenes ORDER BY fecha_subida DESC'
  ).all();
  return rows.map(u => ({
    id: String(u.id),
    placas: u.placas,
    numeroEconomico: String(u.numero_economico || '').trim(),
    marca: u.marca,
    modelo: u.modelo,
    estatus: u.estatus,
    numeroSerieCaja: String(u.numero_serie_caja || '').trim(),
    tieneGps: Number(u.tiene_gps) === 1,
    gpsNumero1: String(u.gps_numero_1 || '').trim(),
    gpsNumero2: String(u.gps_numero_2 || '').trim(),
    subestatusDisponible: u.subestatus_disponible || 'disponible',
    ubicacionDisponible: u.ubicacion_disponible || 'lote',
    clienteEnRenta: u.cliente_en_renta || '',
    kilometraje: u.kilometraje,
    combustiblePct: u.combustible_pct,
    observaciones: u.observaciones || '',
    tipoUnidad: u.tipo_unidad || 'remolque_seco',
    estadoMantenimiento: u.estado_mantenimiento || 'disponible',
    horasMotor: u.horas_motor || 0,
    gestorFisicoMecanica: String(u.gestor_fisico_mecanica || '').trim(),
    fmFotoAnteriorRuta: String(u.fm_foto_anterior_ruta || '').trim(),
    fmFotoVigenteRuta: String(u.fm_foto_vigente_ruta || '').trim(),
    tarjetaCirculacionRuta: String(u.tarjeta_circulacion_ruta || '').trim(),
    unidadRotulada:
      u.unidad_rotulada === null || u.unidad_rotulada === undefined ? null : Number(u.unidad_rotulada) === 1,
    documentos: docs.filter(d => d.unidad_id === u.id).map(d => ({
      id: String(d.id),
      nombre: d.nombre,
      tipo: d.tipo,
      ruta: d.ruta || '',
      fechaSubida: d.fecha_subida,
    })),
    actividad: acts.filter(a => a.unidad_id === u.id).map(a => ({
      id: String(a.id),
      accion: a.accion,
      detalle: a.detalle,
      fecha: a.fecha,
      icon: a.icon || 'mdi:information',
    })),
    imagenes: imgs.filter(i => i.unidad_id === u.id).map(i => ({
      id: String(i.id),
      nombreArchivo: i.nombre_archivo,
      ruta: i.ruta,
      descripcion: i.descripcion || '',
      fechaSubida: i.fecha_subida,
    })),
  }));
}

export function getUnidadById(id) {
  const u = db.prepare(
    `SELECT id, placas, COALESCE(numero_economico, '') as numero_economico, marca, modelo, estatus, numero_serie_caja,
            COALESCE(tiene_gps, 0) as tiene_gps, COALESCE(gps_numero_1, '') as gps_numero_1, COALESCE(gps_numero_2, '') as gps_numero_2,
            subestatus_disponible, ubicacion_disponible,
            kilometraje, combustible_pct, observaciones,
            COALESCE(tipo_unidad, 'remolque_seco') as tipo_unidad,
            COALESCE(estado_mantenimiento, 'disponible') as estado_mantenimiento,
            COALESCE(horas_motor, 0) as horas_motor,
            COALESCE(gestor_fisico_mecanica, '') as gestor_fisico_mecanica,
            COALESCE(fm_foto_anterior_ruta, '') as fm_foto_anterior_ruta,
            COALESCE(fm_foto_vigente_ruta, '') as fm_foto_vigente_ruta,
            COALESCE(tarjeta_circulacion_ruta, '') as tarjeta_circulacion_ruta,
            unidad_rotulada,
            (
              SELECT r.cliente_nombre
              FROM rentas r
              WHERE r.unidad_id = unidades.id AND r.estado IN ('reservada', 'activa')
              ORDER BY CASE r.estado WHEN 'activa' THEN 0 ELSE 1 END, r.fecha_inicio DESC
              LIMIT 1
            ) AS cliente_en_renta
     FROM unidades WHERE id = ? AND activo = 1`
  ).get(Number(id));
  if (!u) return null;
  const docs = db.prepare('SELECT id, tipo, nombre, ruta, fecha_subida FROM unidad_documentos WHERE unidad_id = ? ORDER BY fecha_subida DESC').all(u.id);
  const acts = db.prepare('SELECT id, accion, detalle, fecha, icon FROM unidad_actividad WHERE unidad_id = ? ORDER BY fecha DESC').all(u.id);
  const imgs = db.prepare('SELECT id, nombre_archivo, ruta, descripcion, fecha_subida FROM unidad_imagenes WHERE unidad_id = ? ORDER BY fecha_subida DESC').all(u.id);
  return {
    id: String(u.id),
    placas: u.placas,
    numeroEconomico: String(u.numero_economico || '').trim(),
    marca: u.marca,
    modelo: u.modelo,
    estatus: u.estatus,
    numeroSerieCaja: String(u.numero_serie_caja || '').trim(),
    tieneGps: Number(u.tiene_gps) === 1,
    gpsNumero1: String(u.gps_numero_1 || '').trim(),
    gpsNumero2: String(u.gps_numero_2 || '').trim(),
    subestatusDisponible: u.subestatus_disponible || 'disponible',
    ubicacionDisponible: u.ubicacion_disponible || 'lote',
    clienteEnRenta: u.cliente_en_renta || '',
    kilometraje: u.kilometraje,
    combustiblePct: u.combustible_pct,
    observaciones: u.observaciones || '',
    tipoUnidad: u.tipo_unidad || 'remolque_seco',
    estadoMantenimiento: u.estado_mantenimiento || 'disponible',
    horasMotor: u.horas_motor || 0,
    gestorFisicoMecanica: String(u.gestor_fisico_mecanica || '').trim(),
    fmFotoAnteriorRuta: String(u.fm_foto_anterior_ruta || '').trim(),
    fmFotoVigenteRuta: String(u.fm_foto_vigente_ruta || '').trim(),
    tarjetaCirculacionRuta: String(u.tarjeta_circulacion_ruta || '').trim(),
    unidadRotulada:
      u.unidad_rotulada === null || u.unidad_rotulada === undefined ? null : Number(u.unidad_rotulada) === 1,
    documentos: docs.map(d => ({ id: String(d.id), nombre: d.nombre, tipo: d.tipo, ruta: d.ruta || '', fechaSubida: d.fecha_subida })),
    actividad: acts.map(a => ({ id: String(a.id), accion: a.accion, detalle: a.detalle, fecha: a.fecha, icon: a.icon || 'mdi:information' })),
    imagenes: imgs.map(i => ({
      id: String(i.id),
      nombreArchivo: i.nombre_archivo,
      ruta: i.ruta,
      descripcion: i.descripcion || '',
      fechaSubida: i.fecha_subida,
    })),
  };
}

const EXPEDIENTE_FOTO_COLUMN = {
  fm_anterior: 'fm_foto_anterior_ruta',
  fm_vigente: 'fm_foto_vigente_ruta',
  tarjeta_circulacion: 'tarjeta_circulacion_ruta',
};

/** Actualiza ruta de foto de expediente (físico-mecánica o tarjeta). Devuelve ruta anterior para borrar archivo. */
export function setUnidadExpedienteFoto(unidadId, slot, relativePath, usuarioId = null) {
  const col = EXPEDIENTE_FOTO_COLUMN[slot];
  if (!col) return null;
  const row = db.prepare(`SELECT id, ${col} as old_ruta FROM unidades WHERE id = ? AND activo = 1`).get(Number(unidadId));
  if (!row) return null;
  const oldRuta = String(row.old_ruta || '').trim();
  const next = String(relativePath || '').trim();
  db.prepare(`UPDATE unidades SET ${col} = ?, actualizado_en = datetime('now') WHERE id = ?`).run(next, Number(unidadId));
  const label =
    slot === 'fm_anterior'
      ? 'Físico-mecánica anterior'
      : slot === 'fm_vigente'
        ? 'Físico-mecánica vigente'
        : 'Tarjeta de circulación';
  logUnidadActividadRow(unidadId, 'Expediente · foto', `${next ? 'Actualizada' : 'Eliminada'}: ${label}`, 'mdi:camera', usuarioId);
  return { oldRuta, unidad: getUnidadById(unidadId) };
}

export function clearUnidadExpedienteFotoSlot(unidadId, slot, usuarioId = null) {
  return setUnidadExpedienteFoto(unidadId, slot, '', usuarioId);
}

export function addUnidadImagen(unidadId, nombreArchivo, ruta, descripcion = '', usuarioId = null) {
  const u = db.prepare('SELECT id FROM unidades WHERE id = ? AND activo = 1').get(Number(unidadId));
  if (!u) return null;
  db.prepare('INSERT INTO unidad_imagenes (unidad_id, nombre_archivo, ruta, descripcion) VALUES (?, ?, ?, ?)')
    .run(unidadId, nombreArchivo, ruta, descripcion || '');
  logUnidadActividadRow(unidadId, 'Imagen agregada', nombreArchivo, 'mdi:image-plus', usuarioId);
  return getUnidadById(unidadId);
}

export function deleteUnidadImagen(id, usuarioId = null) {
  const row = db.prepare(
    `SELECT i.id, i.unidad_id, i.ruta, i.nombre_archivo, u.placas
     FROM unidad_imagenes i JOIN unidades u ON u.id = i.unidad_id WHERE i.id = ?`
  ).get(Number(id));
  if (!row) return null;
  db.prepare('DELETE FROM unidad_imagenes WHERE id = ?').run(id);
  registrarSistemaActividad({
    categoria: 'unidad',
    accion: 'Imagen eliminada',
    detalle: `${row.nombre_archivo} · ${row.placas}`,
    entidadTipo: 'unidad',
    entidadId: String(row.unidad_id),
    usuarioId,
    icon: 'mdi:image-off',
  });
  return { unidadId: row.unidad_id, ruta: row.ruta };
}

export function existePlacas(placas, excludeId = null) {
  const row = excludeId
    ? db.prepare('SELECT 1 FROM unidades WHERE UPPER(TRIM(placas)) = UPPER(TRIM(?)) AND id != ? AND activo = 1').get(placas, excludeId)
    : db.prepare('SELECT 1 FROM unidades WHERE UPPER(TRIM(placas)) = UPPER(TRIM(?)) AND activo = 1').get(placas);
  return !!row;
}

export function existeNumeroEconomico(ne, excludeId = null) {
  const t = String(ne ?? '').trim();
  if (!t) return false;
  const row = excludeId
    ? db
        .prepare(
          'SELECT 1 FROM unidades WHERE UPPER(TRIM(numero_economico)) = UPPER(TRIM(?)) AND id != ? AND activo = 1'
        )
        .get(t, excludeId)
    : db.prepare('SELECT 1 FROM unidades WHERE UPPER(TRIM(numero_economico)) = UPPER(TRIM(?)) AND activo = 1').get(t);
  return !!row;
}

function logUnidadActividadRow(unidadId, accion, detalle, icon, usuarioId = null) {
  db.prepare('INSERT INTO unidad_actividad (unidad_id, accion, detalle, icon) VALUES (?, ?, ?, ?)').run(
    Number(unidadId),
    accion,
    detalle,
    icon || 'mdi:information'
  );
  const u = db.prepare('SELECT placas FROM unidades WHERE id = ?').get(Number(unidadId));
  const line = u ? `${detalle} · ${u.placas}` : detalle;
  registrarSistemaActividad({
    categoria: 'unidad',
    accion,
    detalle: line,
    entidadTipo: 'unidad',
    entidadId: String(unidadId),
    usuarioId,
    icon: icon || 'mdi:information',
  });
}

export function createUnidad(data, usuarioId = null) {
  const {
    placas,
    numeroEconomico,
    marca,
    modelo,
    estatus = 'Disponible',
    numeroSerieCaja = '',
    tieneGps = false,
    gpsNumero1 = '',
    gpsNumero2 = '',
    subestatusDisponible = 'disponible',
    ubicacionDisponible = 'lote',
    kilometraje = 0,
    combustiblePct = 0,
    observaciones = '',
    tipoUnidad = 'remolque_seco',
    horasMotor = 0,
    gestorFisicoMecanica = '',
    unidadRotulada = null,
  } = data;
  if (!placas || !marca || !modelo) return null;
  const ne = String(numeroEconomico ?? '').trim();
  if (!ne) return null;
  if (!String(numeroSerieCaja || '').trim()) return null;
  const gpsOn = !!tieneGps;
  const gps1 = gpsOn ? String(gpsNumero1 || '').trim() : '';
  const gps2 = gpsOn ? String(gpsNumero2 || '').trim() : '';
  if (gpsOn && !gps1 && !gps2) return null;
  if (existePlacas(placas)) return null;
  if (existeNumeroEconomico(ne)) return null;
  if (!ESTADOS_UNIDAD.includes(estatus)) return null;
  const subestatus = SUBESTADOS_DISPONIBLE.includes(subestatusDisponible) ? subestatusDisponible : 'disponible';
  const ubicacion = UBICACIONES_DISPONIBLE.includes(ubicacionDisponible) ? ubicacionDisponible : 'lote';
  const tipo = TIPOS_UNIDAD.includes(tipoUnidad) ? tipoUnidad : 'remolque_seco';
  const rotSql =
    unidadRotulada === null || unidadRotulada === undefined ? null : unidadRotulada ? 1 : 0;
  const run = db.prepare(
    'INSERT INTO unidades (placas, numero_economico, marca, modelo, estatus, numero_serie_caja, tiene_gps, gps_numero_1, gps_numero_2, subestatus_disponible, ubicacion_disponible, kilometraje, combustible_pct, observaciones, tipo_unidad, horas_motor, gestor_fisico_mecanica, unidad_rotulada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const r = run.run(
    String(placas).trim(),
    ne,
    String(marca).trim(),
    String(modelo).trim(),
    estatus,
    String(numeroSerieCaja || '').trim(),
    gpsOn ? 1 : 0,
    gps1,
    gps2,
    subestatus,
    ubicacion,
    Number(kilometraje) || 0,
    Math.max(0, Math.min(100, Number(combustiblePct) || 0)),
    String(observaciones || '').trim(),
    tipo,
    Number(horasMotor) || 0,
    String(gestorFisicoMecanica || '').trim(),
    rotSql
  );
  const id = r.lastInsertRowid;
  logUnidadActividadRow(
    id,
    'Unidad registrada',
    `Nueva unidad ${ne} · ${placas} (${marca} ${modelo}) agregada al inventario.`,
    'mdi:car-plus',
    usuarioId
  );
  return getUnidadById(id);
}

export function updateUnidadDb(id, data, usuarioId = null) {
  const u = db.prepare('SELECT id, placas FROM unidades WHERE id = ? AND activo = 1').get(Number(id));
  if (!u) return null;
  const updates = [];
  const values = [];
  const {
    placas,
    marca,
    modelo,
    estatus,
    numeroSerieCaja,
    numeroEconomico,
    tieneGps,
    gpsNumero1,
    gpsNumero2,
    subestatusDisponible,
    ubicacionDisponible,
    kilometraje,
    combustiblePct,
    observaciones,
    tipoUnidad,
    estadoMantenimiento,
    horasMotor,
    gestorFisicoMecanica,
    unidadRotulada,
  } = data;
  if (numeroEconomico != null) {
    const ne = String(numeroEconomico).trim();
    if (!ne) return null;
    if (existeNumeroEconomico(ne, Number(id))) return null;
    updates.push('numero_economico = ?');
    values.push(ne);
  }
  if (placas != null) { updates.push('placas = ?'); values.push(String(placas).trim()); }
  if (marca != null) { updates.push('marca = ?'); values.push(String(marca).trim()); }
  if (modelo != null) { updates.push('modelo = ?'); values.push(String(modelo).trim()); }
  if (estatus != null && ESTADOS_UNIDAD.includes(estatus)) { updates.push('estatus = ?'); values.push(estatus); }
  if (numeroSerieCaja != null && String(numeroSerieCaja).trim()) {
    updates.push('numero_serie_caja = ?');
    values.push(String(numeroSerieCaja).trim());
  }
  if (tieneGps != null) {
    const gpsOn = !!tieneGps;
    updates.push('tiene_gps = ?');
    values.push(gpsOn ? 1 : 0);
    const gps1 = gpsOn ? String(gpsNumero1 || '').trim() : '';
    const gps2 = gpsOn ? String(gpsNumero2 || '').trim() : '';
    if (gpsOn && !gps1 && !gps2) return null;
    updates.push('gps_numero_1 = ?');
    values.push(gps1);
    updates.push('gps_numero_2 = ?');
    values.push(gps2);
  } else {
    if (gpsNumero1 != null) { updates.push('gps_numero_1 = ?'); values.push(String(gpsNumero1 || '').trim()); }
    if (gpsNumero2 != null) { updates.push('gps_numero_2 = ?'); values.push(String(gpsNumero2 || '').trim()); }
  }
  if (subestatusDisponible != null && SUBESTADOS_DISPONIBLE.includes(subestatusDisponible)) { updates.push('subestatus_disponible = ?'); values.push(subestatusDisponible); }
  if (ubicacionDisponible != null && UBICACIONES_DISPONIBLE.includes(ubicacionDisponible)) { updates.push('ubicacion_disponible = ?'); values.push(ubicacionDisponible); }
  if (kilometraje != null) { updates.push('kilometraje = ?'); values.push(Number(kilometraje) || 0); }
  if (combustiblePct != null) { updates.push('combustible_pct = ?'); values.push(Math.max(0, Math.min(100, Number(combustiblePct) || 0))); }
  if (observaciones != null) { updates.push('observaciones = ?'); values.push(String(observaciones || '')); }
  if (tipoUnidad != null && TIPOS_UNIDAD.includes(tipoUnidad)) { updates.push('tipo_unidad = ?'); values.push(tipoUnidad); }
  if (estadoMantenimiento != null && ['disponible', 'en_mantenimiento', 'fuera_de_servicio'].includes(estadoMantenimiento)) { updates.push('estado_mantenimiento = ?'); values.push(estadoMantenimiento); }
  if (horasMotor != null) { updates.push('horas_motor = ?'); values.push(Number(horasMotor) || 0); }
  if (gestorFisicoMecanica != null) {
    updates.push('gestor_fisico_mecanica = ?');
    values.push(String(gestorFisicoMecanica || '').trim());
  }
  if (Object.prototype.hasOwnProperty.call(data, 'unidadRotulada')) {
    if (unidadRotulada === null || unidadRotulada === undefined) {
      updates.push('unidad_rotulada = NULL');
    } else {
      updates.push('unidad_rotulada = ?');
      values.push(unidadRotulada ? 1 : 0);
    }
  }
  if (updates.length === 0) return getUnidadById(id);
  updates.push("actualizado_en = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE unidades SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const campos = [];
  if (placas != null) campos.push('placas');
  if (marca != null) campos.push('marca');
  if (modelo != null) campos.push('modelo');
  if (estatus != null) campos.push('estatus');
  if (numeroSerieCaja != null) campos.push('numero_serie_caja');
  if (numeroEconomico != null) campos.push('numero_economico');
  if (tieneGps != null) campos.push('tiene_gps');
  if (gpsNumero1 != null || gpsNumero2 != null) campos.push('gps');
  if (subestatusDisponible != null) campos.push('subestatus_disponible');
  if (ubicacionDisponible != null) campos.push('ubicacion_disponible');
  if (kilometraje != null) campos.push('kilometraje');
  if (combustiblePct != null) campos.push('combustible');
  if (observaciones != null) campos.push('observaciones');
  if (tipoUnidad != null) campos.push('tipo_unidad');
  if (estadoMantenimiento != null) campos.push('estado_mantenimiento');
  if (horasMotor != null) campos.push('horas_motor');
  if (gestorFisicoMecanica != null) campos.push('gestor_fisico_mecanica');
  if (Object.prototype.hasOwnProperty.call(data, 'unidadRotulada')) campos.push('unidad_rotulada');
  if (campos.length > 0) {
    logUnidadActividadRow(
      id,
      'Unidad editada',
      `Datos actualizados: ${campos.join(', ')}`,
      'mdi:pencil',
      usuarioId
    );
  }
  return getUnidadById(id);
}

export function setEstatusUnidad(id, nextEstatus, usuarioId = null) {
  const u = db.prepare('SELECT id, estatus FROM unidades WHERE id = ? AND activo = 1').get(Number(id));
  if (!u || !ESTADOS_UNIDAD.includes(nextEstatus)) return null;
  db.prepare("UPDATE unidades SET estatus = ?, actualizado_en = datetime('now') WHERE id = ?").run(nextEstatus, id);
  const icon = nextEstatus === 'En Renta' ? 'mdi:key-chain' : 'mdi:car';
  logUnidadActividadRow(id, 'Estatus actualizado', `Cambio de ${u.estatus} a ${nextEstatus}.`, icon, usuarioId);
  return getUnidadById(id);
}

export function addUnidadDocumento(unidadId, tipo, nombre, ruta = '', usuarioId = null) {
  const u = db.prepare('SELECT id FROM unidades WHERE id = ? AND activo = 1').get(Number(unidadId));
  if (!u) return null;
  db.prepare('INSERT INTO unidad_documentos (unidad_id, tipo, nombre, ruta) VALUES (?, ?, ?, ?)')
    .run(unidadId, tipo, nombre, String(ruta || '').trim());
  logUnidadActividadRow(unidadId, 'Documento agregado', `${tipo}: ${nombre}`, 'mdi:file-document', usuarioId);
  return getUnidadById(unidadId);
}

export function deleteUnidadDocumento(id, usuarioId = null) {
  const row = db.prepare(
    `SELECT d.id, d.unidad_id, d.nombre, d.ruta, u.placas
     FROM unidad_documentos d
     JOIN unidades u ON u.id = d.unidad_id
     WHERE d.id = ?`
  ).get(Number(id));
  if (!row) return null;
  db.prepare('DELETE FROM unidad_documentos WHERE id = ?').run(Number(id));
  registrarSistemaActividad({
    categoria: 'unidad',
    accion: 'Documento eliminado',
    detalle: `${row.nombre} · ${row.placas}`,
    entidadTipo: 'unidad',
    entidadId: String(row.unidad_id),
    usuarioId,
    icon: 'mdi:file-remove',
  });
  return { unidadId: row.unidad_id, ruta: row.ruta || '' };
}

export function addUnidadActividad(unidadId, accion, detalle, icon = 'mdi:information', usuarioId = null) {
  const u = db.prepare('SELECT id, observaciones FROM unidades WHERE id = ? AND activo = 1').get(Number(unidadId));
  if (!u) return null;
  db.prepare('INSERT INTO unidad_actividad (unidad_id, accion, detalle, icon) VALUES (?, ?, ?, ?)').run(unidadId, accion, detalle, icon);
  if (accion === 'Daño / Observación registrada' && detalle) {
    const obs = (u.observaciones || '').trim();
    const nuevo = obs ? `${obs} | ${detalle}` : detalle;
    db.prepare("UPDATE unidades SET observaciones = ?, actualizado_en = datetime('now') WHERE id = ?").run(nuevo, unidadId);
  }
  const pl = db.prepare('SELECT placas FROM unidades WHERE id = ?').get(Number(unidadId));
  registrarSistemaActividad({
    categoria: 'unidad',
    accion,
    detalle: pl ? `${detalle} · ${pl.placas}` : detalle,
    entidadTipo: 'unidad',
    entidadId: String(unidadId),
    usuarioId,
    icon: icon || 'mdi:information',
  });
  return getUnidadById(unidadId);
}

export function deleteUnidad(id, usuarioId = null) {
  const nid = Number(id);
  const u = db.prepare('SELECT id, placas FROM unidades WHERE id = ? AND activo = 1').get(nid);
  if (!u) return null;
  const basePlacas = String(u.placas ?? '').trim();
  const stamp = Date.now();
  // La columna placas tiene UNIQUE en SQLite: si solo ponemos activo=0, no se pueden volver a usar las mismas placas.
  const placasArchivo = `${basePlacas} [baja#${nid} ts=${stamp}]`;
  registrarSistemaActividad({
    categoria: 'unidad',
    accion: 'Unidad eliminada (baja lógica)',
    detalle: `Placas ${basePlacas}`,
    entidadTipo: 'unidad',
    entidadId: String(nid),
    usuarioId,
    icon: 'mdi:delete',
  });
  db.prepare(
    "UPDATE unidades SET placas = ?, activo = 0, actualizado_en = datetime('now') WHERE id = ?"
  ).run(placasArchivo, nid);
  return true;
}

/* ─── Check-in / Check-out ─── */
export function createCheckinOutRegistro(data, usuarioId = null) {
  const {
    tipo,
    unidadId,
    rentaId,
    colaboradorNombre,
    colaboradorRol,
    kilometraje,
    combustiblePct,
    checklist,
    observaciones,
    modalidad,
    inspeccion,
  } = data;
  if (!tipo || !['checkin', 'checkout'].includes(String(tipo))) return null;
  const u = db.prepare('SELECT id, placas FROM unidades WHERE id = ? AND activo = 1').get(Number(unidadId));
  if (!u) return null;
  let rId = null;
  if (rentaId) {
    const r = db.prepare('SELECT id, unidad_id FROM rentas WHERE id = ?').get(Number(rentaId));
    if (!r || Number(r.unidad_id) !== Number(unidadId)) return null;
    rId = r.id;
  }
  const checklistJson = JSON.stringify(Array.isArray(checklist) ? checklist : []);
  const modalidadesOk = ['caja_seca', 'refrigerado', 'mulita_patio'];
  const modalidadVal = modalidadesOk.includes(String(modalidad)) ? String(modalidad) : 'caja_seca';
  let inspeccionJson = '{}';
  try {
    inspeccionJson = JSON.stringify(inspeccion && typeof inspeccion === 'object' ? inspeccion : {});
  } catch {
    inspeccionJson = '{}';
  }
  const ins = db.prepare(
    `INSERT INTO checkin_out_registros (tipo, unidad_id, renta_id, usuario_id, colaborador_nombre, colaborador_rol,
      kilometraje, combustible_pct, checklist_json, observaciones, modalidad, inspeccion_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    String(tipo),
    Number(unidadId),
    rId,
    usuarioId != null ? Number(usuarioId) : null,
    String(colaboradorNombre || '').trim(),
    String(colaboradorRol || '').trim(),
    kilometraje != null && kilometraje !== '' ? Number(kilometraje) : null,
    combustiblePct != null && combustiblePct !== '' ? Math.max(0, Math.min(100, Number(combustiblePct))) : null,
    checklistJson,
    String(observaciones || '').trim(),
    modalidadVal,
    inspeccionJson
  );
  const newId = ins.lastInsertRowid;
  if ((kilometraje != null && kilometraje !== '') || (combustiblePct != null && combustiblePct !== '')) {
    const parts = [];
    const vals = [];
    if (kilometraje != null && kilometraje !== '') {
      parts.push('kilometraje = ?');
      vals.push(Number(kilometraje));
    }
    if (combustiblePct != null && combustiblePct !== '') {
      parts.push('combustible_pct = ?');
      vals.push(Math.max(0, Math.min(100, Number(combustiblePct))));
    }
    parts.push("actualizado_en = datetime('now')");
    vals.push(Number(unidadId));
    db.prepare(`UPDATE unidades SET ${parts.join(', ')} WHERE id = ?`).run(...vals);
  }
  let listSummary = '';
  try {
    const arr = JSON.parse(checklistJson);
    const ok = arr.filter((x) => x.presente).map((x) => x.label).join(', ');
    const miss = arr.filter((x) => !x.presente).map((x) => x.label).join(', ');
    listSummary = [ok && `Verificado: ${ok}`, miss && `Pendiente/falta: ${miss}`].filter(Boolean).join(' · ');
  } catch {
    listSummary = '';
  }
  const accion = tipo === 'checkin' ? 'Check-in registrado' : 'Check-out registrado';
  const detalleParts = [
    modalidadVal !== 'caja_seca' && `Modalidad: ${modalidadVal}`,
    colaboradorNombre && `Con ${String(colaboradorNombre).trim()}${colaboradorRol ? ` (${colaboradorRol})` : ''}`,
    listSummary,
    observaciones && String(observaciones).trim().slice(0, 100),
  ].filter(Boolean);
  const detalle = detalleParts.join(' · ') || `Unidad ${u.placas}`;
  logUnidadActividadRow(
    unidadId,
    accion,
    detalle,
    tipo === 'checkin' ? 'mdi:clipboard-arrow-left' : 'mdi:clipboard-arrow-right',
    usuarioId
  );
  if (rId) {
    addRentaHistorial(rId, accion, detalle.slice(0, 180), usuarioId, 'mdi:clipboard-check-multiple');
  }
  return getCheckinOutRegistroById(newId);
}

function mapCheckinOutImagenRow(r) {
  return {
    id: String(r.id),
    nombreArchivo: r.nombre_archivo,
    ruta: r.ruta,
    descripcion: r.descripcion || '',
    creadoEn: r.creado_en,
  };
}

function buildCheckinOutImagenesMap() {
  const rows = db.prepare('SELECT * FROM checkin_out_imagenes ORDER BY id ASC').all();
  const m = new Map();
  for (const r of rows) {
    const rid = String(r.registro_id);
    if (!m.has(rid)) m.set(rid, []);
    m.get(rid).push(mapCheckinOutImagenRow(r));
  }
  return m;
}

export function getCheckinOutRegistroById(id) {
  const row = db.prepare(
    `SELECT c.*, u.placas, COALESCE(u.numero_economico, '') as numero_economico, u.marca, u.modelo, ua.nombre AS usuario_nombre,
            r.cliente_nombre AS renta_cliente
     FROM checkin_out_registros c
     JOIN unidades u ON u.id = c.unidad_id
     LEFT JOIN usuarios ua ON ua.id = c.usuario_id
     LEFT JOIN rentas r ON r.id = c.renta_id
     WHERE c.id = ?`
  ).get(Number(id));
  if (!row) return null;
  const imgs = db
    .prepare('SELECT * FROM checkin_out_imagenes WHERE registro_id = ? ORDER BY id ASC')
    .all(Number(id));
  return mapCheckinOutRow(row, imgs.map(mapCheckinOutImagenRow));
}

function mapCheckinOutRow(row, imagenes = []) {
  let checklist = [];
  try {
    checklist = JSON.parse(row.checklist_json || '[]');
  } catch {
    checklist = [];
  }
  let inspeccion = {};
  try {
    inspeccion = JSON.parse(row.inspeccion_json || '{}');
  } catch {
    inspeccion = {};
  }
  return {
    id: String(row.id),
    tipo: row.tipo,
    unidadId: String(row.unidad_id),
    placas: row.placas,
    numeroEconomico: String(row.numero_economico || '').trim(),
    marca: row.marca,
    modelo: row.modelo,
    rentaId: row.renta_id != null ? String(row.renta_id) : null,
    rentaCliente: row.renta_cliente || null,
    usuarioId: row.usuario_id != null ? String(row.usuario_id) : null,
    usuarioNombre: row.usuario_nombre || null,
    colaboradorNombre: row.colaborador_nombre || '',
    colaboradorRol: row.colaborador_rol || '',
    kilometraje: row.kilometraje,
    combustiblePct: row.combustible_pct,
    checklist,
    observaciones: row.observaciones || '',
    modalidad: row.modalidad || 'caja_seca',
    inspeccion,
    imagenes,
    creadoEn: row.creado_en,
  };
}

export function getCheckinOutRegistros(limit = 80) {
  const max = Math.min(Math.max(1, Number(limit) || 80), 200);
  const rows = db.prepare(
    `SELECT c.*, u.placas, COALESCE(u.numero_economico, '') as numero_economico, u.marca, u.modelo, ua.nombre AS usuario_nombre,
            r.cliente_nombre AS renta_cliente
     FROM checkin_out_registros c
     JOIN unidades u ON u.id = c.unidad_id
     LEFT JOIN usuarios ua ON ua.id = c.usuario_id
     LEFT JOIN rentas r ON r.id = c.renta_id
     ORDER BY c.creado_en DESC
     LIMIT ?`
  ).all(max);
  const imgMap = buildCheckinOutImagenesMap();
  return rows.map((row) => mapCheckinOutRow(row, imgMap.get(String(row.id)) || []));
}

export function updateCheckinOutRegistro(registroId, data, usuarioId = null) {
  const id = Number(registroId);
  const existing = db.prepare('SELECT id FROM checkin_out_registros WHERE id = ?').get(id);
  if (!existing) return null;

  const {
    tipo,
    unidadId,
    rentaId,
    colaboradorNombre,
    colaboradorRol,
    kilometraje,
    combustiblePct,
    checklist,
    observaciones,
    modalidad,
    inspeccion,
  } = data;
  if (!tipo || !['checkin', 'checkout'].includes(String(tipo))) return null;
  const u = db.prepare('SELECT placas FROM unidades WHERE id = ? AND activo = 1').get(Number(unidadId));
  if (!u) return null;

  let rId = null;
  if (rentaId != null && rentaId !== '') {
    const r = db.prepare('SELECT id, unidad_id FROM rentas WHERE id = ?').get(Number(rentaId));
    if (!r || Number(r.unidad_id) !== Number(unidadId)) return null;
    rId = r.id;
  }

  const checklistJson = JSON.stringify(Array.isArray(checklist) ? checklist : []);
  const modalidadesOk = ['caja_seca', 'refrigerado', 'mulita_patio'];
  const modalidadVal = modalidadesOk.includes(String(modalidad)) ? String(modalidad) : 'caja_seca';
  let inspeccionJson = '{}';
  try {
    inspeccionJson = JSON.stringify(inspeccion && typeof inspeccion === 'object' ? inspeccion : {});
  } catch {
    inspeccionJson = '{}';
  }
  const km =
    kilometraje != null && kilometraje !== '' ? Number(kilometraje) : null;
  const fuel =
    combustiblePct != null && combustiblePct !== ''
      ? Math.max(0, Math.min(100, Number(combustiblePct)))
      : null;

  db.prepare(
    `UPDATE checkin_out_registros SET tipo=?, unidad_id=?, renta_id=?, colaborador_nombre=?, colaborador_rol=?,
     kilometraje=?, combustible_pct=?, checklist_json=?, observaciones=?, modalidad=?, inspeccion_json=? WHERE id=?`
  ).run(
    String(tipo),
    Number(unidadId),
    rId,
    String(colaboradorNombre || '').trim(),
    String(colaboradorRol || '').trim(),
    km,
    fuel,
    checklistJson,
    String(observaciones || '').trim(),
    modalidadVal,
    inspeccionJson,
    id
  );

  if ((kilometraje != null && kilometraje !== '') || (combustiblePct != null && combustiblePct !== '')) {
    const parts = [];
    const vals = [];
    if (kilometraje != null && kilometraje !== '') {
      parts.push('kilometraje = ?');
      vals.push(Number(kilometraje));
    }
    if (combustiblePct != null && combustiblePct !== '') {
      parts.push('combustible_pct = ?');
      vals.push(Math.max(0, Math.min(100, Number(combustiblePct))));
    }
    parts.push("actualizado_en = datetime('now')");
    vals.push(Number(unidadId));
    db.prepare(`UPDATE unidades SET ${parts.join(', ')} WHERE id = ?`).run(...vals);
  }

  logUnidadActividadRow(
    unidadId,
    'Check-in/out actualizado',
    `${tipo === 'checkin' ? 'Check-in' : 'Check-out'} · ${u.placas}`,
    'mdi:pencil-outline',
    usuarioId
  );

  return getCheckinOutRegistroById(id);
}

export function deleteCheckinOutRegistro(registroId, usuarioId = null) {
  const id = Number(registroId);
  const row = db
    .prepare('SELECT unidad_id, tipo FROM checkin_out_registros WHERE id = ?')
    .get(id);
  if (!row) return false;
  const u = db.prepare('SELECT placas FROM unidades WHERE id = ?').get(row.unidad_id);
  db.prepare('DELETE FROM checkin_out_registros WHERE id = ?').run(id);
  logUnidadActividadRow(
    row.unidad_id,
    'Registro check-in/out eliminado',
    `${row.tipo} · ${u?.placas || ''}`,
    'mdi:delete-outline',
    usuarioId
  );
  return true;
}

export function addCheckinOutImagen(registroId, nombreArchivo, ruta, descripcion = '', usuarioId = null) {
  const ex = db.prepare('SELECT id FROM checkin_out_registros WHERE id = ?').get(Number(registroId));
  if (!ex) return null;
  db.prepare(
    'INSERT INTO checkin_out_imagenes (registro_id, nombre_archivo, ruta, descripcion) VALUES (?,?,?,?)'
  ).run(Number(registroId), String(nombreArchivo || ''), String(ruta || ''), String(descripcion || ''));
  const urow = db.prepare('SELECT unidad_id FROM checkin_out_registros WHERE id = ?').get(Number(registroId));
  if (urow) {
    logUnidadActividadRow(
      urow.unidad_id,
      'Evidencia check-in/out',
      String(nombreArchivo || 'foto'),
      'mdi:camera',
      usuarioId
    );
  }
  return getCheckinOutRegistroById(Number(registroId));
}

export function deleteCheckinOutImagen(imgId, usuarioId = null) {
  const row = db
    .prepare(
      `SELECT i.id, i.registro_id, i.ruta, i.nombre_archivo, c.unidad_id
       FROM checkin_out_imagenes i
       JOIN checkin_out_registros c ON c.id = i.registro_id
       WHERE i.id = ?`
    )
    .get(Number(imgId));
  if (!row) return null;
  db.prepare('DELETE FROM checkin_out_imagenes WHERE id = ?').run(Number(imgId));
  logUnidadActividadRow(
    row.unidad_id,
    'Evidencia check-in/out eliminada',
    String(row.nombre_archivo || ''),
    'mdi:camera-off',
    usuarioId
  );
  return { registroId: String(row.registro_id), ruta: row.ruta };
}

/* ─── Clientes (expediente / acta) y vínculo con rentas ─── */

const TIPOS_CLIENTE = ['persona_fisica', 'persona_moral'];

function initClientes() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL DEFAULT 'persona_moral',
      nombre_comercial TEXT NOT NULL DEFAULT '',
      razon_social TEXT DEFAULT '',
      rfc TEXT DEFAULT '',
      curp TEXT DEFAULT '',
      representante_legal TEXT DEFAULT '',
      telefono TEXT DEFAULT '',
      email TEXT DEFAULT '',
      direccion TEXT DEFAULT '',
      notas TEXT DEFAULT '',
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now')),
      actualizado_en TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS cliente_documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'otro',
      nombre TEXT NOT NULL,
      ruta TEXT NOT NULL,
      creado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_cliente_docs_cliente ON cliente_documentos(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_clientes_activo_nombre ON clientes(activo, nombre_comercial);
  `);
  try {
    const cols = db.prepare("PRAGMA table_info(rentas)").all().map((r) => r.name);
    if (!cols.includes('cliente_id')) {
      db.exec('ALTER TABLE rentas ADD COLUMN cliente_id INTEGER REFERENCES clientes(id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_rentas_cliente ON rentas(cliente_id)');
    }
  } catch (e) {
    console.warn('Migración rentas.cliente_id:', e?.message);
  }
}

function mapClienteRow(c) {
  return {
    id: String(c.id),
    tipo: TIPOS_CLIENTE.includes(c.tipo) ? c.tipo : 'persona_moral',
    nombreComercial: c.nombre_comercial || '',
    razonSocial: c.razon_social || '',
    rfc: c.rfc || '',
    curp: c.curp || '',
    representanteLegal: c.representante_legal || '',
    telefono: c.telefono || '',
    email: c.email || '',
    direccion: c.direccion || '',
    notas: c.notas || '',
    creadoEn: c.creado_en,
    actualizadoEn: c.actualizado_en,
    docCount: c.doc_count != null ? Number(c.doc_count) : undefined,
    rentasVinculadas: c.rentas_vinculadas != null ? Number(c.rentas_vinculadas) : undefined,
  };
}

export function getAllClientes() {
  const rows = db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM cliente_documentos d WHERE d.cliente_id = c.id) AS doc_count,
        (SELECT COUNT(*) FROM rentas r
           JOIN unidades u ON u.id = r.unidad_id AND u.activo = 1
           WHERE r.cliente_id = c.id) AS rentas_vinculadas
       FROM clientes c
       WHERE c.activo = 1
       ORDER BY c.nombre_comercial COLLATE NOCASE, c.razon_social COLLATE NOCASE`
    )
    .all();
  return rows.map((c) => mapClienteRow(c));
}

export function getClienteById(id) {
  const c = db.prepare('SELECT * FROM clientes WHERE id = ? AND activo = 1').get(Number(id));
  if (!c) return null;
  const docs = db
    .prepare('SELECT * FROM cliente_documentos WHERE cliente_id = ? ORDER BY creado_en DESC')
    .all(c.id);
  const rentas = db
    .prepare(
      `SELECT r.id, r.fecha_inicio, r.fecha_fin, r.estado, u.placas
       FROM rentas r
       JOIN unidades u ON u.id = r.unidad_id AND u.activo = 1
       WHERE r.cliente_id = ?
       ORDER BY r.fecha_inicio DESC`
    )
    .all(c.id);
  const base = mapClienteRow({ ...c, doc_count: docs.length, rentas_vinculadas: rentas.length });
  return {
    ...base,
    documentos: docs.map((d) => ({
      id: String(d.id),
      tipo: d.tipo,
      nombre: d.nombre,
      ruta: d.ruta,
      creadoEn: d.creado_en,
    })),
    rentas: rentas.map((r) => ({
      id: String(r.id),
      fechaInicio: r.fecha_inicio,
      fechaFin: r.fecha_fin,
      estado: r.estado,
      placas: r.placas,
    })),
  };
}

export function createCliente(data, usuarioId = null) {
  const {
    tipo = 'persona_moral',
    nombreComercial,
    razonSocial = '',
    rfc = '',
    curp = '',
    representanteLegal = '',
    telefono = '',
    email = '',
    direccion = '',
    notas = '',
  } = data;
  const nc = String(nombreComercial || '').trim();
  if (!nc) return null;
  const t = TIPOS_CLIENTE.includes(tipo) ? tipo : 'persona_moral';
  const r = db
    .prepare(
      `INSERT INTO clientes (tipo, nombre_comercial, razon_social, rfc, curp, representante_legal, telefono, email, direccion, notas)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      t,
      nc,
      String(razonSocial || '').trim(),
      String(rfc || '').trim(),
      String(curp || '').trim(),
      String(representanteLegal || '').trim(),
      String(telefono || '').trim(),
      String(email || '').trim(),
      String(direccion || '').trim(),
      String(notas || '').trim()
    );
  registrarSistemaActividad({
    categoria: 'cliente',
    accion: 'Cliente registrado',
    detalle: nc,
    entidadTipo: 'cliente',
    entidadId: String(r.lastInsertRowid),
    usuarioId,
    icon: 'mdi:account-plus',
  });
  return getClienteById(r.lastInsertRowid);
}

export function updateCliente(id, data, usuarioId = null) {
  const ex = db.prepare('SELECT id FROM clientes WHERE id = ? AND activo = 1').get(Number(id));
  if (!ex) return null;
  const updates = [];
  const values = [];
  const {
    tipo,
    nombreComercial,
    razonSocial,
    rfc,
    curp,
    representanteLegal,
    telefono,
    email,
    direccion,
    notas,
  } = data;
  if (tipo != null && TIPOS_CLIENTE.includes(tipo)) {
    updates.push('tipo = ?');
    values.push(tipo);
  }
  if (nombreComercial != null) {
    updates.push('nombre_comercial = ?');
    values.push(String(nombreComercial).trim());
  }
  if (razonSocial != null) {
    updates.push('razon_social = ?');
    values.push(String(razonSocial || '').trim());
  }
  if (rfc != null) {
    updates.push('rfc = ?');
    values.push(String(rfc || '').trim());
  }
  if (curp != null) {
    updates.push('curp = ?');
    values.push(String(curp || '').trim());
  }
  if (representanteLegal != null) {
    updates.push('representante_legal = ?');
    values.push(String(representanteLegal || '').trim());
  }
  if (telefono != null) {
    updates.push('telefono = ?');
    values.push(String(telefono || '').trim());
  }
  if (email != null) {
    updates.push('email = ?');
    values.push(String(email || '').trim());
  }
  if (direccion != null) {
    updates.push('direccion = ?');
    values.push(String(direccion || '').trim());
  }
  if (notas != null) {
    updates.push('notas = ?');
    values.push(String(notas || '').trim());
  }
  if (updates.length === 0) return getClienteById(id);
  updates.push("actualizado_en = datetime('now')");
  values.push(Number(id));
  db.prepare(`UPDATE clientes SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  registrarSistemaActividad({
    categoria: 'cliente',
    accion: 'Cliente actualizado',
    detalle: `ID ${id}`,
    entidadTipo: 'cliente',
    entidadId: String(id),
    usuarioId,
    icon: 'mdi:account-edit',
  });
  return getClienteById(id);
}

export function deleteClienteSoft(id, usuarioId = null) {
  const c = db.prepare('SELECT nombre_comercial FROM clientes WHERE id = ? AND activo = 1').get(Number(id));
  if (!c) return false;
  db.prepare("UPDATE clientes SET activo = 0, actualizado_en = datetime('now') WHERE id = ?").run(Number(id));
  registrarSistemaActividad({
    categoria: 'cliente',
    accion: 'Cliente desactivado',
    detalle: c.nombre_comercial || String(id),
    entidadTipo: 'cliente',
    entidadId: String(id),
    usuarioId,
    icon: 'mdi:account-off',
  });
  return true;
}

export function addClienteDocumento(clienteId, tipo, nombre, ruta, usuarioId = null) {
  const ex = db.prepare('SELECT id FROM clientes WHERE id = ? AND activo = 1').get(Number(clienteId));
  if (!ex) return null;
  db.prepare(
    'INSERT INTO cliente_documentos (cliente_id, tipo, nombre, ruta) VALUES (?,?,?,?)'
  ).run(Number(clienteId), String(tipo || 'otro').trim(), String(nombre || '').trim(), String(ruta || '').trim());
  registrarSistemaActividad({
    categoria: 'cliente',
    accion: 'Documento de cliente',
    detalle: `${nombre} (${tipo})`,
    entidadTipo: 'cliente',
    entidadId: String(clienteId),
    usuarioId,
    icon: 'mdi:file-upload',
  });
  return getClienteById(clienteId);
}

export function deleteClienteDocumento(docId, usuarioId = null) {
  const row = db
    .prepare(
      `SELECT d.id, d.cliente_id, d.nombre, d.ruta FROM cliente_documentos d WHERE d.id = ?`
    )
    .get(Number(docId));
  if (!row) return null;
  db.prepare('DELETE FROM cliente_documentos WHERE id = ?').run(Number(docId));
  registrarSistemaActividad({
    categoria: 'cliente',
    accion: 'Documento eliminado',
    detalle: row.nombre || '',
    entidadTipo: 'cliente',
    entidadId: String(row.cliente_id),
    usuarioId,
    icon: 'mdi:file-remove',
  });
  return { clienteId: String(row.cliente_id), ruta: row.ruta };
}

/* ─── Proveedores, facturas y pagos (cuentas por pagar) ─── */

function initProveedores() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_razon_social TEXT NOT NULL,
      rfc TEXT DEFAULT '',
      contacto_nombre TEXT DEFAULT '',
      contacto_telefono TEXT DEFAULT '',
      contacto_email TEXT DEFAULT '',
      direccion TEXT DEFAULT '',
      notas TEXT DEFAULT '',
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now')),
      actualizado_en TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS proveedor_facturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proveedor_id INTEGER NOT NULL,
      numero TEXT NOT NULL,
      fecha_emision TEXT NOT NULL,
      monto_total REAL NOT NULL DEFAULT 0,
      concepto TEXT DEFAULT '',
      unidad_id INTEGER,
      archivo_ruta TEXT DEFAULT '',
      archivo_nombre_original TEXT DEFAULT '',
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
      FOREIGN KEY (unidad_id) REFERENCES unidades(id)
    );
    CREATE TABLE IF NOT EXISTS proveedor_factura_pagos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      factura_id INTEGER NOT NULL,
      fecha_pago TEXT NOT NULL,
      monto REAL NOT NULL,
      metodo TEXT NOT NULL DEFAULT 'transferencia',
      referencia TEXT DEFAULT '',
      observaciones TEXT DEFAULT '',
      creado_en TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (factura_id) REFERENCES proveedor_facturas(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prov_fact_num ON proveedor_facturas(proveedor_id, numero);
    CREATE INDEX IF NOT EXISTS idx_prov_fact_prov ON proveedor_facturas(proveedor_id);
    CREATE INDEX IF NOT EXISTS idx_prov_fact_unidad ON proveedor_facturas(unidad_id);
    CREATE INDEX IF NOT EXISTS idx_prov_pago_fact ON proveedor_factura_pagos(factura_id);
  `);
}

function totalPagadoFactura(facturaId) {
  const row = db
    .prepare('SELECT COALESCE(SUM(monto), 0) AS s FROM proveedor_factura_pagos WHERE factura_id = ?')
    .get(Number(facturaId));
  return Number(row?.s ?? 0);
}

function mapProveedorRow(p, extra = {}) {
  const tf = Number(extra.total_facturado ?? 0);
  const tp = Number(extra.total_pagado ?? 0);
  const tm = Number(extra.total_mantenimiento ?? 0);
  return {
    id: String(p.id),
    nombreRazonSocial: p.nombre_razon_social,
    rfc: p.rfc || '',
    contactoNombre: p.contacto_nombre || '',
    contactoTelefono: p.contacto_telefono || '',
    contactoEmail: p.contacto_email || '',
    direccion: p.direccion || '',
    notas: p.notas || '',
    activo: !!p.activo,
    creadoEn: p.creado_en,
    actualizadoEn: p.actualizado_en,
    totalFacturado: tf,
    totalPagado: tp,
    saldoPendiente: Math.round((tf - tp) * 100) / 100,
    totalMantenimiento: Math.round(tm * 100) / 100,
  };
}

function estadoFactura(montoTotal, pagado) {
  const mt = Number(montoTotal) || 0;
  const pg = Number(pagado) || 0;
  if (mt <= 0) return pg > 0 ? 'pagada' : 'pendiente';
  if (pg <= 0) return 'pendiente';
  if (pg + 1e-6 >= mt) return 'pagada';
  return 'parcial';
}

export function getAllProveedores() {
  const rows = db
    .prepare(
      `SELECT p.*,
        (SELECT COALESCE(SUM(f.monto_total), 0) FROM proveedor_facturas f WHERE f.proveedor_id = p.id AND f.activo = 1) AS total_facturado,
        (SELECT COALESCE(SUM(pa.monto), 0) FROM proveedor_factura_pagos pa
          JOIN proveedor_facturas ff ON ff.id = pa.factura_id
          WHERE ff.proveedor_id = p.id AND ff.activo = 1) AS total_pagado,
        (SELECT COALESCE(SUM(m.costo), 0) FROM mantenimiento m WHERE m.proveedor_id = p.id) AS total_mantenimiento
       FROM proveedores p WHERE p.activo = 1 ORDER BY p.nombre_razon_social COLLATE NOCASE`
    )
    .all();
  return rows.map((r) =>
    mapProveedorRow(r, {
      total_facturado: r.total_facturado,
      total_pagado: r.total_pagado,
      total_mantenimiento: r.total_mantenimiento,
    })
  );
}

/** Listado mínimo para selects (cualquier usuario autenticado). */
export function getProveedoresCatalogo() {
  const rows = db
    .prepare(
      'SELECT id, nombre_razon_social FROM proveedores WHERE activo = 1 ORDER BY nombre_razon_social COLLATE NOCASE'
    )
    .all();
  return rows.map((r) => ({
    id: String(r.id),
    nombreRazonSocial: r.nombre_razon_social,
  }));
}

export function getProveedorById(id) {
  const p = db.prepare('SELECT * FROM proveedores WHERE id = ? AND activo = 1').get(Number(id));
  if (!p) return null;
  const sums = db
    .prepare(
      `SELECT
        (SELECT COALESCE(SUM(f.monto_total), 0) FROM proveedor_facturas f WHERE f.proveedor_id = ? AND f.activo = 1) AS total_facturado,
        (SELECT COALESCE(SUM(pa.monto), 0) FROM proveedor_factura_pagos pa
          JOIN proveedor_facturas ff ON ff.id = pa.factura_id
          WHERE ff.proveedor_id = ? AND ff.activo = 1) AS total_pagado,
        (SELECT COALESCE(SUM(m.costo), 0) FROM mantenimiento m WHERE m.proveedor_id = ?) AS total_mantenimiento`
    )
    .get(Number(id), Number(id), Number(id));
  const base = mapProveedorRow(p, {
    total_facturado: sums.total_facturado,
    total_pagado: sums.total_pagado,
    total_mantenimiento: sums.total_mantenimiento,
  });
  const facturasRows = db
    .prepare(
      `SELECT f.*, u.placas AS unidad_placas, u.marca AS unidad_marca, u.modelo AS unidad_modelo
       FROM proveedor_facturas f
       LEFT JOIN unidades u ON u.id = f.unidad_id
       WHERE f.proveedor_id = ? AND f.activo = 1
       ORDER BY f.fecha_emision DESC, f.id DESC`
    )
    .all(Number(id));
  const facturas = facturasRows.map((f) => {
    const pagado = totalPagadoFactura(f.id);
    const mt = Number(f.monto_total) || 0;
    const saldo = Math.round((mt - pagado) * 100) / 100;
    const pagos = db
      .prepare(
        `SELECT id, factura_id, fecha_pago, monto, metodo, referencia, observaciones, creado_en
         FROM proveedor_factura_pagos WHERE factura_id = ? ORDER BY fecha_pago DESC, id DESC`
      )
      .all(f.id);
    return {
      id: String(f.id),
      proveedorId: String(f.proveedor_id),
      numero: f.numero,
      fechaEmision: f.fecha_emision,
      montoTotal: mt,
      concepto: f.concepto || '',
      unidadId: f.unidad_id != null ? String(f.unidad_id) : null,
      unidadPlacas: f.unidad_placas || null,
      unidadMarca: f.unidad_marca || null,
      unidadModelo: f.unidad_modelo || null,
      archivoRuta: f.archivo_ruta || '',
      archivoNombreOriginal: f.archivo_nombre_original || '',
      creadoEn: f.creado_en,
      totalPagado: pagado,
      saldoPendiente: saldo,
      estado: estadoFactura(mt, pagado),
      pagos: pagos.map((x) => ({
        id: String(x.id),
        facturaId: String(x.factura_id),
        fechaPago: x.fecha_pago,
        monto: Number(x.monto),
        metodo: x.metodo,
        referencia: x.referencia || '',
        observaciones: x.observaciones || '',
        creadoEn: x.creado_en,
      })),
    };
  });
  const porEstado = { pagadas: 0, parciales: 0, pendientes: 0 };
  for (const fa of facturas) {
    if (fa.estado === 'pagada') porEstado.pagadas += 1;
    else if (fa.estado === 'parcial') porEstado.parciales += 1;
    else porEstado.pendientes += 1;
  }
  const mantenimientosRows = db
    .prepare(
      `SELECT m.id, m.unidad_id, m.tipo, m.descripcion, m.costo, m.fecha_inicio, m.fecha_fin, m.estado, m.creado_en,
              u.placas AS unidad_placas, COALESCE(u.numero_economico, '') AS unidad_numero_economico, u.marca AS unidad_marca, u.modelo AS unidad_modelo
       FROM mantenimiento m
       JOIN unidades u ON u.id = m.unidad_id
       WHERE m.proveedor_id = ?
       ORDER BY m.fecha_inicio DESC, m.id DESC`
    )
    .all(Number(id));
  const mantenimientos = mantenimientosRows.map((row) => ({
    id: String(row.id),
    unidadId: String(row.unidad_id),
    placas: row.unidad_placas || '',
    numeroEconomico: String(row.unidad_numero_economico || '').trim(),
    marca: row.unidad_marca || '',
    modelo: row.unidad_modelo || '',
    tipo: row.tipo,
    descripcion: row.descripcion || '',
    costo: row.costo || 0,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin || null,
    estado: row.estado,
    creadoEn: row.creado_en,
  }));
  return { ...base, facturas, resumenFacturas: porEstado, mantenimientos };
}

export function createProveedor(data, usuarioId = null) {
  const nombre = String(data.nombreRazonSocial || data.nombre_razon_social || '').trim();
  if (!nombre) return null;
  const r = db
    .prepare(
      `INSERT INTO proveedores (nombre_razon_social, rfc, contacto_nombre, contacto_telefono, contacto_email, direccion, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      nombre,
      String(data.rfc || '').trim(),
      String(data.contactoNombre || data.contacto_nombre || '').trim(),
      String(data.contactoTelefono || data.contacto_telefono || '').trim(),
      String(data.contactoEmail || data.contacto_email || '').trim(),
      String(data.direccion || '').trim(),
      String(data.notas || '').trim()
    );
  const id = r.lastInsertRowid;
  registrarSistemaActividad({
    categoria: 'proveedor',
    accion: 'Proveedor registrado',
    detalle: nombre,
    entidadTipo: 'proveedor',
    entidadId: String(id),
    usuarioId,
    icon: 'mdi:truck-delivery-outline',
  });
  return getProveedorById(id);
}

export function updateProveedor(id, data, usuarioId = null) {
  const p = db.prepare('SELECT id FROM proveedores WHERE id = ? AND activo = 1').get(Number(id));
  if (!p) return null;
  const updates = [];
  const vals = [];
  if (data.nombreRazonSocial != null) {
    updates.push('nombre_razon_social = ?');
    vals.push(String(data.nombreRazonSocial).trim());
  }
  if (data.rfc != null) {
    updates.push('rfc = ?');
    vals.push(String(data.rfc).trim());
  }
  if (data.contactoNombre != null) {
    updates.push('contacto_nombre = ?');
    vals.push(String(data.contactoNombre).trim());
  }
  if (data.contactoTelefono != null) {
    updates.push('contacto_telefono = ?');
    vals.push(String(data.contactoTelefono).trim());
  }
  if (data.contactoEmail != null) {
    updates.push('contacto_email = ?');
    vals.push(String(data.contactoEmail).trim());
  }
  if (data.direccion != null) {
    updates.push('direccion = ?');
    vals.push(String(data.direccion).trim());
  }
  if (data.notas != null) {
    updates.push('notas = ?');
    vals.push(String(data.notas).trim());
  }
  if (updates.length === 0) return getProveedorById(id);
  updates.push("actualizado_en = datetime('now')");
  vals.push(Number(id));
  db.prepare(`UPDATE proveedores SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
  registrarSistemaActividad({
    categoria: 'proveedor',
    accion: 'Proveedor actualizado',
    detalle: `ID ${id}`,
    entidadTipo: 'proveedor',
    entidadId: String(id),
    usuarioId,
    icon: 'mdi:pencil',
  });
  return getProveedorById(id);
}

export function deleteProveedor(id, usuarioId = null) {
  const p = db.prepare('SELECT id, nombre_razon_social FROM proveedores WHERE id = ? AND activo = 1').get(Number(id));
  if (!p) return null;
  db.prepare("UPDATE proveedores SET activo = 0, actualizado_en = datetime('now') WHERE id = ?").run(Number(id));
  registrarSistemaActividad({
    categoria: 'proveedor',
    accion: 'Proveedor desactivado',
    detalle: p.nombre_razon_social,
    entidadTipo: 'proveedor',
    entidadId: String(id),
    usuarioId,
    icon: 'mdi:archive-outline',
  });
  return true;
}

export function deleteProveedorFactura(proveedorId, facturaId, usuarioId = null) {
  const pid = Number(proveedorId);
  const fid = Number(facturaId);
  const f = db
    .prepare('SELECT id, numero, proveedor_id FROM proveedor_facturas WHERE id = ? AND activo = 1')
    .get(fid);
  if (!f || Number(f.proveedor_id) !== pid) return null;
  db.prepare("UPDATE proveedor_facturas SET activo = 0 WHERE id = ?").run(fid);
  registrarSistemaActividad({
    categoria: 'proveedor',
    accion: 'Factura de proveedor eliminada',
    detalle: `#${f.numero} · proveedor ${pid}`,
    entidadTipo: 'proveedor_factura',
    entidadId: String(fid),
    usuarioId,
    icon: 'mdi:file-remove-outline',
  });
  return getProveedorById(pid);
}

export function createProveedorFactura(proveedorId, data, usuarioId = null) {
  const pid = Number(proveedorId);
  const prov = db.prepare('SELECT id FROM proveedores WHERE id = ? AND activo = 1').get(pid);
  if (!prov) return null;
  const numero = String(data.numero || '').trim();
  if (!numero) return null;
  const exists = db
    .prepare('SELECT 1 FROM proveedor_facturas WHERE proveedor_id = ? AND numero = ? AND activo = 1')
    .get(pid, numero);
  if (exists) return { error: 'duplicate_numero' };
  const fecha = String(data.fechaEmision || data.fecha_emision || '').trim();
  if (!fecha) return null;
  const monto = Math.max(0, Number(data.montoTotal ?? data.monto_total) || 0);
  let unidadId = null;
  if (data.unidadId != null && data.unidadId !== '') {
    const uid = Number(data.unidadId);
    const u = db.prepare('SELECT id FROM unidades WHERE id = ? AND activo = 1').get(uid);
    if (!u) return { error: 'unidad_invalida' };
    unidadId = uid;
  }
  const r = db
    .prepare(
      `INSERT INTO proveedor_facturas (proveedor_id, numero, fecha_emision, monto_total, concepto, unidad_id, archivo_ruta, archivo_nombre_original)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      pid,
      numero,
      fecha,
      monto,
      String(data.concepto || '').trim(),
      unidadId,
      String(data.archivoRuta || data.archivo_ruta || '').trim(),
      String(data.archivoNombreOriginal || data.archivo_nombre_original || '').trim()
    );
  const fid = r.lastInsertRowid;
  registrarSistemaActividad({
    categoria: 'proveedor',
    accion: 'Factura de proveedor registrada',
    detalle: `${numero} · $${monto}`,
    entidadTipo: 'proveedor_factura',
    entidadId: String(fid),
    usuarioId,
    icon: 'mdi:file-document-outline',
  });
  return getProveedorById(pid);
}

export function addPagoProveedorFactura(proveedorId, facturaId, data, usuarioId = null) {
  const pid = Number(proveedorId);
  const fid = Number(facturaId);
  const f = db
    .prepare('SELECT id, monto_total, proveedor_id FROM proveedor_facturas WHERE id = ? AND activo = 1')
    .get(fid);
  if (!f || Number(f.proveedor_id) !== pid) return null;
  const fecha = String(data.fechaPago || data.fecha_pago || '').trim();
  if (!fecha) return null;
  const monto = Number(data.monto);
  if (!Number.isFinite(monto) || monto <= 0) return null;
  const metodo = String(data.metodo || 'transferencia').trim() || 'transferencia';
  db.prepare(
    `INSERT INTO proveedor_factura_pagos (factura_id, fecha_pago, monto, metodo, referencia, observaciones)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    fid,
    fecha,
    monto,
    metodo,
    String(data.referencia || '').trim(),
    String(data.observaciones || '').trim()
  );
  registrarSistemaActividad({
    categoria: 'proveedor',
    accion: 'Pago a proveedor registrado',
    detalle: `Factura ${fid} · $${monto} · ${metodo}`,
    entidadTipo: 'proveedor_factura',
    entidadId: String(fid),
    usuarioId,
    icon: 'mdi:cash-check',
  });
  return getProveedorById(pid);
}

export function getReporteCuentasPorPagar() {
  const proveedores = getAllProveedores();
  const facturasPendientes = db
    .prepare(
      `SELECT f.id, f.proveedor_id, f.numero, f.fecha_emision, f.monto_total, f.concepto, f.unidad_id,
        u.placas AS unidad_placas
       FROM proveedor_facturas f
       LEFT JOIN unidades u ON u.id = f.unidad_id
       WHERE f.activo = 1
       ORDER BY f.fecha_emision DESC`
    )
    .all();
  const lista = [];
  for (const row of facturasPendientes) {
    const pagado = totalPagadoFactura(row.id);
    const mt = Number(row.monto_total) || 0;
    const saldo = mt - pagado;
    if (saldo <= 0.005) continue;
    lista.push({
      facturaId: String(row.id),
      proveedorId: String(row.proveedor_id),
      numero: row.numero,
      fechaEmision: row.fecha_emision,
      montoTotal: mt,
      concepto: row.concepto || '',
      totalPagado: pagado,
      saldoPendiente: Math.round(saldo * 100) / 100,
      estado: estadoFactura(mt, pagado),
      unidadId: row.unidad_id != null ? String(row.unidad_id) : null,
      unidadPlacas: row.unidad_placas || null,
    });
  }
  const totales = proveedores.reduce(
    (a, p) => {
      a.facturado += p.totalFacturado;
      a.pagado += p.totalPagado;
      a.saldo += p.saldoPendiente;
      return a;
    },
    { facturado: 0, pagado: 0, saldo: 0 }
  );
  return { proveedores, facturasPendientesDetalle: lista, totalesGlobales: totales };
}

/** Consolidado para Finanzas → Gastos: mantenimiento + facturas y pagos a proveedores. */
export function getFinanzasGastosResumen(limit = 200) {
  const lim = Math.min(Math.max(1, Number(limit) || 200), 500);
  const mant = db
    .prepare(`SELECT COALESCE(SUM(m.costo), 0) AS s FROM mantenimiento m INNER JOIN unidades u ON u.id = m.unidad_id`)
    .get();
  const fact = db.prepare(`SELECT COALESCE(SUM(f.monto_total), 0) AS s FROM proveedor_facturas f WHERE f.activo = 1`).get();
  const pag = db
    .prepare(
      `SELECT COALESCE(SUM(pa.monto), 0) AS s FROM proveedor_factura_pagos pa
       INNER JOIN proveedor_facturas f ON f.id = pa.factura_id AND f.activo = 1`
    )
    .get();
  const facturado = Number(fact.s) || 0;
  const pagado = Number(pag.s) || 0;
  const rows = db
    .prepare(
      `SELECT * FROM (
        SELECT 'mantenimiento' AS tipo,
               CAST(m.id AS TEXT) AS ref_id,
               m.fecha_inicio AS fecha,
               (m.tipo || ' · ' || COALESCE(NULLIF(TRIM(COALESCE(m.descripcion, '')), ''), 'Sin descripción')) AS concepto,
               COALESCE(m.costo, 0) AS monto,
               p.nombre_razon_social AS proveedor_nombre,
               u.placas AS unidad_placas,
               CASE WHEN m.proveedor_id IS NOT NULL THEN CAST(m.proveedor_id AS TEXT) END AS proveedor_id,
               NULL AS factura_id
        FROM mantenimiento m
        INNER JOIN unidades u ON u.id = m.unidad_id
        LEFT JOIN proveedores p ON p.id = m.proveedor_id
        UNION ALL
        SELECT 'factura_proveedor',
               CAST(f.id AS TEXT),
               f.fecha_emision,
               ('Factura ' || f.numero || ' · ' || COALESCE(NULLIF(TRIM(COALESCE(f.concepto, '')), ''), 'Sin concepto')),
               COALESCE(f.monto_total, 0),
               pr.nombre_razon_social,
               uf.placas,
               CAST(pr.id AS TEXT),
               CAST(f.id AS TEXT)
        FROM proveedor_facturas f
        INNER JOIN proveedores pr ON pr.id = f.proveedor_id AND pr.activo = 1
        LEFT JOIN unidades uf ON uf.id = f.unidad_id
        WHERE f.activo = 1
        UNION ALL
        SELECT 'pago_proveedor',
               CAST(pa.id AS TEXT),
               pa.fecha_pago,
               ('Pago factura ' || f.numero || CASE WHEN COALESCE(TRIM(pa.metodo), '') != '' THEN (' · ' || pa.metodo) ELSE '' END),
               COALESCE(pa.monto, 0),
               pr.nombre_razon_social,
               uf.placas,
               CAST(pr.id AS TEXT),
               CAST(f.id AS TEXT)
        FROM proveedor_factura_pagos pa
        INNER JOIN proveedor_facturas f ON f.id = pa.factura_id AND f.activo = 1
        INNER JOIN proveedores pr ON pr.id = f.proveedor_id
        LEFT JOIN unidades uf ON uf.id = f.unidad_id
      )
      ORDER BY fecha DESC, tipo ASC
      LIMIT ?`
    )
    .all(lim);
  return {
    totales: {
      mantenimiento: Number(mant.s) || 0,
      proveedoresFacturado: facturado,
      proveedoresPagado: pagado,
      proveedoresSaldo: facturado - pagado,
    },
    movimientos: rows.map((r) => ({
      tipo: r.tipo,
      id: r.ref_id,
      fecha: r.fecha,
      concepto: r.concepto,
      monto: Number(r.monto) || 0,
      proveedorNombre: r.proveedor_nombre || null,
      unidadPlacas: r.unidad_placas || null,
      proveedorId: r.proveedor_id || null,
      facturaId: r.factura_id || null,
    })),
  };
}

export function getReporteProveedoresPorUnidad() {
  const unidades = db
    .prepare(
      `SELECT id, placas, COALESCE(numero_economico, '') as numero_economico, marca, modelo FROM unidades WHERE activo = 1
       ORDER BY CASE WHEN TRIM(COALESCE(numero_economico, '')) = '' THEN 1 ELSE 0 END,
                numero_economico COLLATE NOCASE,
                placas COLLATE NOCASE`
    )
    .all();
  const out = [];
  for (const u of unidades) {
    const facturas = db
      .prepare(
        `SELECT id, monto_total FROM proveedor_facturas WHERE unidad_id = ? AND activo = 1`
      )
      .all(u.id);
    let facturado = 0;
    let pagado = 0;
    for (const f of facturas) {
      facturado += Number(f.monto_total) || 0;
      pagado += totalPagadoFactura(f.id);
    }
    if (facturado <= 0 && pagado <= 0) continue;
    out.push({
      unidadId: String(u.id),
      placas: u.placas,
      numeroEconomico: String(u.numero_economico || '').trim(),
      marca: u.marca,
      modelo: u.modelo,
      totalFacturado: Math.round(facturado * 100) / 100,
      totalPagado: Math.round(pagado * 100) / 100,
      saldoPendiente: Math.round((facturado - pagado) * 100) / 100,
      numFacturas: facturas.length,
    });
  }
  return out;
}
