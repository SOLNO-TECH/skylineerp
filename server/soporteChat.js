/**
 * Soporte interno Skyline ERP: guía integrada (sin servicios de IA de pago).
 */

const CONOCIMIENTO = [
  {
    keys: ['rol', 'roles', 'permiso', 'permisos', 'acceso', 'administrador', 'supervisor', 'operador', 'consulta'],
    titulo: 'Roles y permisos',
    cuerpo: `Skyline define cuatro roles:
• **Administrador**: acceso total (usuarios, configuración, reportes, administración y proveedores, etc.).
• **Supervisor**: gestión operativa y reportes; accede a Administración y proveedores junto con reportes y actividad. No gestiona usuarios ni configuración global salvo lo que indique el sistema.
• **Operador**: operación diaria (rentas, check-in/check-out, unidades según políticas). No suele ver Usuarios ni Configuración.
• **Consulta**: solo lectura donde el sistema lo permita (por ejemplo listados sin editar).

Si no ves un menú, tu rol puede no incluir ese módulo: pide a un **administrador** que revise tu usuario.`,
  },
  {
    keys: ['unidad', 'unidades', 'placas', 'expediente', 'documento', 'imagen', 'estatus', 'taller'],
    titulo: 'Control de unidades',
    cuerpo: `En **Control de Unidades** (/unidades) administras el inventario. Puedes buscar por placas o modelo, filtrar por estatus y abrir **Expediente** para ver historial, **Documentos** e **Imágenes**. **Editar** modifica datos de la unidad; **Nueva unidad** crea un registro. El estatus (Disponible, En Renta, Taller) ayuda a saber si está asignable a una renta.`,
  },
  {
    keys: ['renta', 'rentas', 'reserv', 'cliente', 'contrato', 'expediente', 'pago', 'depósito', 'deposito', 'saldo', 'pdf', 'comprobante'],
    titulo: 'Gestión de rentas',
    cuerpo: `En **Gestión de Rentas** (/rentas) creas y editas reservaciones y contratos. Al abrir un expediente (/rentas/:id) ves datos del cliente, unidad, fechas y **Pagos**. Puedes registrar pagos (anticipo, parcial, final, depósito, etc.) y descargar **Comprobante PDF** desde la parte superior del expediente. El saldo se calcula con monto + depósito menos lo pagado.`,
  },
  {
    keys: ['check', 'check-in', 'checkin', 'checkout', 'check-out', 'entrega', 'recepción', 'colaborador', 'inventario', 'ódom', 'odomet', 'combustible'],
    titulo: 'Check-in y Check-out',
    cuerpo: `En **Check-in / Check-out** (/checkinout) registras entregas y recepciones de unidades: eliges unidad, renta si aplica, colaborador, kilometraje/combustible e inventario de material según el tipo de unidad (incluye ítems extra para refrigerado o maquinaria en el formulario). Los registros aparecen en la tabla; puedes **Editar** o **Borrar** si tu rol lo permite. Si solo ves lectura, tu rol es de consulta.`,
  },
  {
    keys: ['mantenimiento', 'servicio', 'taller', 'reparación', 'reparacion'],
    titulo: 'Mantenimiento',
    cuerpo: `**Mantenimiento** (/mantenimiento) concentra servicios y reparaciones por unidad: altas, seguimiento de costos y fechas. Usa **Registrar servicio** para nuevos registros y la tabla para revisar historial; los filtros ayudan por unidad, tipo y estado.`,
  },
  {
    keys: ['proveedor', 'proveedores', 'factura', 'facturas', 'cuenta', 'pagar', 'administracion', 'administración'],
    titulo: 'Administración y proveedores',
    cuerpo: `**Administración y Proveedores** (/administracion) está disponible para **administrador** y **supervisor**. Ahí das de alta proveedores, expedientes por proveedor, facturas y pagos asociados. Los reportes de cuentas por pagar y por unidad están en subrutas del menú de administración.`,
  },
  {
    keys: ['usuario', 'usuarios', 'correo', 'email', 'contraseña', 'desactivar', 'activar'],
    titulo: 'Usuarios',
    cuerpo: `**Usuarios** (/usuarios) es solo para **administrador**: crear cuentas, asignar rol, editar y desactivar usuarios. Si un compañero no puede entrar, verifica que esté activo y que el rol sea el correcto.`,
  },
  {
    keys: ['reporte', 'reportes', 'gráfica', 'grafica', 'dashboard'],
    titulo: 'Reportes e inicio',
    cuerpo: `El **Dashboard** (/) ofrece resumen operativo. **Reportes** (/reportes) amplía métricas para roles autorizados (administrador y supervisor). Si no ves el ítem en el menú lateral, tu rol no incluye reportes.`,
  },
  {
    keys: ['actividad', 'historial', 'auditoría', 'auditoria'],
    titulo: 'Actividad del sistema',
    cuerpo: `**Actividad** (/actividad) muestra eventos recientes del sistema para administrador y supervisor, útil para auditoría ligera y seguimiento de acciones.`,
  },
  {
    keys: ['configuración', 'configuracion', 'ajuste', 'empresa', 'parámetro'],
    titulo: 'Configuración',
    cuerpo: `**Configuración** (/configuracion) está restringida al **administrador**. Ahí se ajustan parámetros globales del sistema según lo que exponga la pantalla.`,
  },
  {
    keys: ['perfil', 'avatar', 'contraseña', 'foto', 'datos personales', 'rfc', 'teléfono', 'telefono'],
    titulo: 'Perfil',
    cuerpo: `En **Perfil** (/perfil) puedes actualizar tus datos personales y, si está habilitado, tu avatar. Las credenciales de otros usuarios solo las cambia un administrador desde Usuarios.`,
  },
  {
    keys: ['login', 'iniciar sesión', 'sesión', 'token', 'contraseña olvid', 'no entra', 'error'],
    titulo: 'Acceso al sistema',
    cuerpo: `Si no puedes iniciar sesión: revisa correo y contraseña; confirma con un administrador que tu usuario esté **activo**. El sistema usa autenticación por token; si la sesión expira, vuelve a iniciar sesión. Errores de red suelen indicar que el servidor (API) no está en ejecución.`,
  },
  {
    keys: ['mapa', 'ruta', 'ubicación', 'ubicacion', 'geocod', 'entrega', 'recolección', 'recoleccion'],
    titulo: 'Mapas y ubicaciones',
    cuerpo: `En formularios de rentas y vistas de detalle pueden aparecer mapas o rutas cuando hay coordenadas o direcciones; sirven para referencia operativa. La precisión depende de los datos cargados.`,
  },
  {
    keys: ['notificación', 'notificaciones', 'aviso'],
    titulo: 'Notificaciones',
    cuerpo: `El ícono de campana en la barra superior muestra notificaciones internas del sistema cuando existen eventos relevantes para tu sesión.`,
  },
];

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function respuestaBaseConocimiento(preguntaUsuario) {
  const q = normalizar(preguntaUsuario);
  let mejor = null;
  let score = 0;

  for (const item of CONOCIMIENTO) {
    let s = 0;
    for (const k of item.keys) {
      if (q.includes(normalizar(k))) s += 2;
    }
    for (const word of q.split(/\s+/).filter((w) => w.length > 3)) {
      for (const k of item.keys) {
        if (normalizar(k).includes(word) || word.includes(normalizar(k))) s += 1;
      }
    }
    if (s > score) {
      score = s;
      mejor = item;
    }
  }

  if (mejor && score >= 2) {
    return `**${mejor.titulo}**\n\n${mejor.cuerpo}`;
  }

  if (mejor && score >= 1) {
    return `**${mejor.titulo}** (puede que no sea exactamente tu duda)\n\n${mejor.cuerpo}\n\n— Si necesitas algo más concreto, reformula la pregunta con el nombre del módulo (por ejemplo "rentas", "check-in", "proveedores").`;
  }

  return (
    'Puedo orientarte sobre cómo usar **Skyline ERP** (unidades, rentas, check-in/out, mantenimiento, administración y proveedores, usuarios, reportes, etc.).\n\n' +
    'Describe qué quieres lograr o en qué pantalla estás (por ejemplo: "cómo registro un pago en una renta" o "no veo el menú de usuarios"). ' +
    'Si tu duda es legal, fiscal o contable externa al sistema, consulta con tu asesor.'
  );
}

/**
 * @param {{ role: string, content: string }[]} messages
 * @param {{ rol: string, nombre?: string }} _user Reservado por si en el futuro se personaliza por rol.
 */
export async function getSoporteReply(messages, _user) {
  const safe = Array.isArray(messages) ? messages : [];
  const lastUser = [...safe].reverse().find((m) => m.role === 'user');
  const pregunta = lastUser?.content || '';
  const reply = respuestaBaseConocimiento(pregunta);
  return { reply, source: 'base' };
}
