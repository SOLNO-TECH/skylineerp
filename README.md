# SKYLINE — Sistema de Gestión de Flotilla

Sistema ERP para operación de flotilla construido con **React**, **TypeScript** y **Vite**, con identidad visual corporativa SKYLINE (azul `#2D58A7` y rojo `#E62129`). Incluye **login por roles** conectado a base de datos SQLite.

## Login y roles

El sistema exige iniciar sesión. Los roles disponibles son:

| Rol            | Descripción                                      |
|----------------|--------------------------------------------------|
| **administrador** | Acceso total; puede ver Administración y Proveedores |
| **supervisor** | Gestión operativa y reportes; acceso a Administración |
| **operador**   | Operación diaria: rentas, check-in/out, unidades, clientes y mantenimiento |
| **operador_taller** | Taller/patio: solo **Check-in / Check-out** y **Mantenimiento** (puede listar unidades y rentas para el formulario; no catálogos de unidades, rentas ni clientes) |
| **consulta**   | Solo lectura en módulos permitidos               |

La base de datos se crea en `server/skyline.db`. Usuarios de prueba (tras ejecutar `npm run seed` o `node server/seed.js`):

- `admin@skyline.com` / `admin123` — administrador  
- `supervisor@skyline.com` / `super123` — supervisor  
- `operador@skyline.com` / `oper123` — operador  
- `consulta@skyline.com` / `cons123` — consulta  
- `taller@skyline.com` / `taller123` — operador_taller (solo check-in/out y mantenimiento)  

## Los 5 pilares del sistema

1. **Control de Unidades** — Expediente digital por activo (placas, seguros, documentos) y estatus en tiempo real: Disponible / En Renta / Taller.
2. **Gestión de Rentas** — Calendario de reservaciones, emisión automática de contratos y control de depósitos en garantía.
3. **Check-in / Check-out** — Inventario fotográfico y digital de daños, combustible y herramientas al entregar y recibir la unidad.
4. **Mantenimiento** — Alertas automáticas de servicios preventivos (aceite, llantas, filtros) y registro de reparaciones correctivas.
5. **Administración y Proveedores** — Directorio de talleres/refaccionarias, control de cuentas por pagar y reportes de rentabilidad por unidad.

## Cómo ejecutar

1. Instalar dependencias del frontend y del servidor:

```bash
npm install
cd server && npm install && cd ..
```

2. (Opcional) Crear usuarios de prueba en la base de datos:

```bash
npm run seed
```

3. Iniciar frontend y servidor a la vez (una sola terminal):

```bash
npm run dev
```

Se abrirán el API en el puerto 3001 y Vite en el 5173. En la terminal verás las etiquetas `[api]` y `[web]` para cada salida.

Abre [http://localhost:5173](http://localhost:5173), serás redirigido a **/login**. Inicia sesión con alguno de los usuarios de prueba.

(Si necesitas ejecutarlos por separado: `npm run dev:server` para el API y `npm run dev:client` para el frontend.)

## Scripts

- `npm run dev` — Servidor de desarrollo con HMR.
- `npm run build` — Build de producción.
- `npm run preview` — Vista previa del build.

## Estructura

- `src/theme.css` — Variables de diseño SKYLINE (colores, tipografía, componentes base).
- `src/components/Layout/` — Barra lateral y layout principal.
- `src/pages/` — Páginas por pilar: Dashboard, Unidades, Rentas, CheckInOut, Mantenimiento, Administración.

## Despliegue (Docker / Dokploy)

Define **`JWT_SECRET`** en el entorno. Si la base está vacía, puedes usar **`SKYLINE_INITIAL_ADMIN_PASSWORD`** (≥ 8 caracteres) una vez para crear `admin@skyline.com`.

El `docker-compose.yml` del repo monta el volumen solo en **`/app/server/data`**, con **`SKYLINE_DATA_DIR=/app/server/data`**. Ahí se guardan **`skyline.db`** y la carpeta **`uploads/`**. El código del API (`index.js`, `db.js`, etc.) **no** va en el volumen: así cada despliegue trae rutas nuevas (p. ej. `/api/clientes`).

Si antes montabas **todo** `/app/server` y veías **«Ruta no encontrada»** con un front actualizado, el contenedor estaba sirviendo un `index.js` viejo copiado al volumen. Actualiza el compose como en el repo, vuelve a desplegar y conserva el mismo volumen nombrado: tu `skyline.db` y `uploads` suelen seguir en la raíz de ese volumen, que ahora se ve bajo `/app/server/data`.
