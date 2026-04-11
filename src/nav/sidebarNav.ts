/** Catálogo único del sidebar: rutas, iconos y restricción por rol (no aplica a administrador con acceso total). */
export const ROLES_CATALOGO_FLOTAS = ['administrador', 'supervisor', 'operador', 'consulta'] as const;
export const ROLES_ADMIN_FIN = ['administrador', 'supervisor'] as const;

export type NavLinkItem = {
  path: string;
  label: string;
  icon: string;
  end?: boolean;
  roles?: readonly string[];
};

export type NavSection = {
  title: string;
  items: NavLinkItem[];
};

export const SIDEBAR_NAV_SECTIONS: NavSection[] = [
  {
    title: 'OPERACIONES',
    items: [
      { path: '/', label: 'Inicio', icon: 'mdi:view-dashboard', end: true },
      { path: '/unidades', label: 'Unidades', icon: 'mdi:car-side', roles: [...ROLES_CATALOGO_FLOTAS] },
      { path: '/clientes', label: 'Clientes', icon: 'mdi:account-tie', roles: [...ROLES_CATALOGO_FLOTAS] },
      { path: '/checkinout', label: 'Check-in / Check-out', icon: 'mdi:clipboard-check-outline' },
    ],
  },
  {
    title: 'FINANZAS',
    items: [
      { path: '/rentas', label: 'Rentas', icon: 'mdi:calendar-month', roles: [...ROLES_CATALOGO_FLOTAS] },
      { path: '/pagos', label: 'Pagos', icon: 'mdi:cash-multiple', roles: [...ROLES_CATALOGO_FLOTAS] },
      { path: '/gastos', label: 'Gastos', icon: 'mdi:chart-timeline-variant', roles: [...ROLES_ADMIN_FIN] },
    ],
  },
  {
    title: 'GESTIÓN',
    items: [
      { path: '/mantenimiento', label: 'Mantenimiento', icon: 'mdi:wrench' },
      {
        path: '/administracion/proveedores',
        label: 'Proveedores',
        icon: 'mdi:truck-delivery-outline',
        roles: [...ROLES_ADMIN_FIN],
      },
    ],
  },
  {
    title: 'ANÁLISIS',
    items: [
      { path: '/reportes', label: 'Reportes', icon: 'mdi:chart-box', roles: [...ROLES_ADMIN_FIN] },
      { path: '/actividad', label: 'Actividad', icon: 'mdi:history', roles: [...ROLES_ADMIN_FIN] },
    ],
  },
  {
    title: 'SISTEMA',
    items: [
      { path: '/usuarios', label: 'Usuarios', icon: 'mdi:account-cog', roles: ['administrador'] },
      { path: '/configuracion', label: 'Configuración', icon: 'mdi:cog', roles: ['administrador'] },
    ],
  },
];

/** Rutas del menú que se pueden asignar a un administrador con vistas limitadas (sin /perfil: siempre permitido). */
export const SIDEBAR_PATHS_SELECCIONABLES: string[] = [
  ...new Set(
    SIDEBAR_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.path))
  ),
];

export function pathMatchesNavVista(pathname: string, navPath: string): boolean {
  const p = pathname || '/';
  if (navPath === '/') return p === '/' || p === '';
  return p === navPath || p.startsWith(`${navPath}/`);
}

export type UserVistaCheck = {
  rol: string;
  vistasPermitidas?: string[] | null;
};

/** Administrador sin lista o lista vacía = acceso total al menú (comportamiento clásico). */
export function esAdministradorVistasRestringidas(user: UserVistaCheck | null | undefined): boolean {
  return user?.rol === 'administrador' && Array.isArray(user.vistasPermitidas) && user.vistasPermitidas.length > 0;
}

export function puedeVerRutaSidebar(user: UserVistaCheck | null | undefined, pathname: string): boolean {
  if (!user) return false;
  if (!esAdministradorVistasRestringidas(user)) return true;
  const allow = [...(user.vistasPermitidas as string[]), '/perfil'];
  return allow.some((v) => pathMatchesNavVista(pathname, v));
}
