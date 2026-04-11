import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getUsuarioByEmail, getUsuarioById, ROLES } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'skyline-erp-secret-cambiar-en-produccion';
const JWT_EXPIRES = '7d';

export function login(email, password) {
  const user = getUsuarioByEmail(email);
  if (!user || !user.activo) {
    return { success: false, error: 'Credenciales inválidas' };
  }
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    return { success: false, error: 'Credenciales inválidas' };
  }
  const token = jwt.sign(
    { id: user.id, email: user.email, rol: user.rol },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
  return {
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      avatar: user.avatar || '',
      vistasPermitidas: user.vistasPermitidas ?? null,
    },
  };
}

export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
  const user = getUsuarioById(decoded.id);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    avatar: user.avatar || '',
    vistasPermitidas: user.vistasPermitidas ?? null,
  };
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
  req.user = user;
  next();
}

const roleHierarchy = {
  [ROLES.ADMIN]: 4,
  [ROLES.SUPERVISOR]: 3,
  [ROLES.OPERADOR]: 2,
  [ROLES.OPERADOR_TALLER]: 2,
  [ROLES.CONSULTA]: 1,
};

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    const userLevel = roleHierarchy[req.user.rol] ?? 0;
    const hasAccess = allowedRoles.includes(req.user.rol) ||
      (req.user.rol === ROLES.ADMIN);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Sin permiso para esta acción' });
    }
    next();
  };
}

/** Catálogo de clientes (API y menú): excluye operador_taller. */
export const requireAccesoClientes = requireRole(
  ROLES.ADMIN,
  ROLES.SUPERVISOR,
  ROLES.OPERADOR,
  ROLES.CONSULTA
);

/**
 * Alta/edición de unidades y rentas (altas, pagos, documentos): excluye operador_taller.
 * Operador_taller sigue pudiendo GET /api/unidades y /api/rentas para registrar check-in/out.
 */
export const requireEdicionFlota = requireRole(
  ROLES.ADMIN,
  ROLES.SUPERVISOR,
  ROLES.OPERADOR,
  ROLES.CONSULTA
);

export { ROLES };
