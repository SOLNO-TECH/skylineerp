import bcrypt from 'bcryptjs';
import { db, initDb, ROLES } from './db.js';

initDb();

const passwordHash = bcrypt.hashSync('admin123', 10);

db.prepare(`
  INSERT OR REPLACE INTO usuarios (id, email, password_hash, nombre, rol, activo)
  VALUES (1, 'admin@skyline.com', ?, 'Administrador', ?, 1)
`).run(passwordHash, ROLES.ADMIN);

const insertUser = db.prepare(
  'INSERT OR IGNORE INTO usuarios (email, password_hash, nombre, rol, activo) VALUES (?, ?, ?, ?, 1)'
);
insertUser.run('supervisor@skyline.com', bcrypt.hashSync('super123', 10), 'Supervisor Demo', ROLES.SUPERVISOR);
insertUser.run('operador@skyline.com', bcrypt.hashSync('oper123', 10), 'Operador Demo', ROLES.OPERADOR);
insertUser.run('consulta@skyline.com', bcrypt.hashSync('cons123', 10), 'Consulta Demo', ROLES.CONSULTA);
insertUser.run(
  'taller@skyline.com',
  bcrypt.hashSync('taller123', 10),
  'Jefe Taller Demo',
  ROLES.OPERADOR_TALLER
);

console.log('Base de datos inicializada. Usuarios de prueba:');
console.log('  admin@skyline.com / admin123 (administrador)');
console.log('  supervisor@skyline.com / super123 (supervisor)');
console.log('  operador@skyline.com / oper123 (operador)');
console.log('  consulta@skyline.com / cons123 (consulta)');
console.log('  taller@skyline.com / taller123 (operador_taller · solo check-in/out y mantenimiento)');
