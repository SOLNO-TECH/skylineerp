import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const STORAGE_KEY = 'skyline_sidebar_collapsed';

const navItems = [
  { path: '/', label: 'Inicio', icon: 'mdi:view-dashboard' },
  { path: '/unidades', label: 'Control de Unidades', icon: 'mdi:car-side' },
  { path: '/rentas', label: 'Gestión de Rentas', icon: 'mdi:calendar-month' },
  { path: '/clientes', label: 'Clientes', icon: 'mdi:account-tie' },
  { path: '/checkinout', label: 'Check-in / Check-out', icon: 'mdi:clipboard-check-outline' },
  { path: '/mantenimiento', label: 'Mantenimiento', icon: 'mdi:wrench' },
  { path: '/administracion', label: 'Administración y Proveedores', icon: 'mdi:domain', roles: ['administrador', 'supervisor'] },
];

const navItemsBelow = [
  { path: '/usuarios', label: 'Usuarios', icon: 'mdi:account-cog', roles: ['administrador'] },
  { path: '/reportes', label: 'Reportes', icon: 'mdi:chart-box', roles: ['administrador', 'supervisor'] },
  { path: '/actividad', label: 'Actividad', icon: 'mdi:history', roles: ['administrador', 'supervisor'] },
  { path: '/configuracion', label: 'Configuración', icon: 'mdi:cog', roles: ['administrador'] },
];

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {}
  }, [collapsed]);

  const visibleNavItems = navItems.filter(
    (item) => !('roles' in item && item.roles) || hasRole(...(item.roles ?? []))
  );
  const visibleBelow = navItemsBelow.filter(
    (item) => !('roles' in item && item.roles) || hasRole(...(item.roles ?? []))
  );

  function handleLogout() {
    onMobileClose?.();
    logout();
    navigate('/login', { replace: true });
  }

  const linkBase =
    'touch-manipulation mb-0.5 flex items-center rounded-md transition-colors no-underline hover:no-underline';
  const linkActive = 'bg-white/20 text-white';
  const linkInactive = 'text-white/90 hover:bg-white/10 hover:text-white';

  const desktopWidth = collapsed ? 'md:w-[72px] md:min-w-[72px]' : 'md:w-[260px] md:min-w-[260px]';

  function closeIfMobile() {
    onMobileClose?.();
  }

  return (
    <>
      <div className={`hidden shrink-0 transition-[width] duration-200 md:block ${desktopWidth}`} aria-hidden />

      <aside
        id="app-sidebar"
        className={`fixed left-0 top-0 z-[55] flex h-[100dvh] max-h-[100dvh] flex-col bg-skyline-blue shadow-lg transition-[transform,width] duration-200 ease-out max-md:w-[min(288px,calc(100vw-1.25rem))] ${desktopWidth} ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-3 md:justify-center md:px-4 md:py-6">
          <div className="flex min-w-0 flex-1 justify-center md:flex-none">
            {collapsed ? (
              <>
                <div className="flex text-xl font-bold italic tracking-wide max-md:text-2xl md:hidden">
                  <span className="text-white">SKY</span>
                  <span className="text-skyline-red">LINE</span>
                </div>
                <div className="hidden text-xl font-bold italic md:flex md:text-xl">
                  <span className="text-white">S</span>
                  <span className="text-skyline-red">L</span>
                </div>
              </>
            ) : (
              <div className="flex text-xl font-bold italic tracking-wide md:text-2xl">
                <span className="text-white">SKY</span>
                <span className="text-skyline-red">LINE</span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="touch-manipulation shrink-0 rounded-lg p-2 text-white/90 hover:bg-white/10 md:hidden"
            aria-label="Cerrar menú"
            onClick={closeIfMobile}
          >
            <Icon icon="mdi:close" className="size-6" aria-hidden />
          </button>
        </div>

        <nav className={`flex-1 overflow-y-auto overscroll-contain p-3 ${collapsed ? 'md:p-2' : ''}`}>
          {visibleNavItems.map(({ path, label, icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              title={collapsed ? label : undefined}
              onClick={closeIfMobile}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkInactive} gap-3 px-3 py-2.5 ${
                  collapsed ? 'md:justify-center md:gap-0 md:px-2 md:py-2.5' : ''
                }`
              }
            >
              <Icon
                icon={icon}
                className={`shrink-0 ${collapsed ? 'size-5 md:size-6' : 'size-5'}`}
                aria-hidden
              />
              <span className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
            </NavLink>
          ))}
          {visibleBelow.length > 0 && (
            <>
              <hr className="my-3 border-white/15" />
              {visibleBelow.map(({ path, label, icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  title={collapsed ? label : undefined}
                  onClick={closeIfMobile}
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? linkActive : linkInactive} gap-3 px-3 py-2.5 ${
                      collapsed ? 'md:justify-center md:gap-0 md:px-2 md:py-2.5' : ''
                    }`
                  }
                >
                  <Icon
                    icon={icon}
                    className={`shrink-0 ${collapsed ? 'size-5 md:size-6' : 'size-5'}`}
                    aria-hidden
                  />
                  <span className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className={`border-t border-white/10 p-4 ${collapsed ? 'md:p-2' : ''}`}>
          <div
            className={
              collapsed ? 'flex flex-col gap-3 max-md:items-stretch md:items-center md:gap-2' : ''
            }
          >
            {user && (
              <Link
                to="/perfil"
                title={collapsed ? `${user.nombre} (${user.rol})` : undefined}
                onClick={closeIfMobile}
                className={`flex touch-manipulation rounded-md transition-colors hover:bg-white/10 no-underline hover:no-underline ${
                  collapsed
                    ? 'w-full items-center gap-3 px-1 py-1 -mx-1 mb-3 md:mb-0 md:justify-center md:gap-0 md:p-2'
                    : 'items-center gap-3 px-1 py-1 -mx-1 mb-3'
                }`}
              >
                <div
                  className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-sm font-semibold text-white ${
                    collapsed ? 'size-10 md:size-9' : 'size-10'
                  }`}
                  aria-hidden
                >
                  {user.avatar ? (
                    <img src={`/uploads/${user.avatar}`} alt="" className="h-full w-full object-cover" />
                  ) : (
                    user.nombre.charAt(0).toUpperCase()
                  )}
                </div>
                <div className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}>
                  <span className="block truncate text-sm font-semibold text-white">{user.nombre}</span>
                  <span className="block truncate text-xs capitalize text-white/70">{user.rol}</span>
                </div>
              </Link>
            )}
            {user && (
              <button
                type="button"
                onClick={handleLogout}
                title={collapsed ? 'Cerrar sesión' : undefined}
                className={`touch-manipulation flex rounded-md border border-white/30 bg-transparent text-white/95 transition-colors hover:bg-white/15 ${
                  collapsed
                    ? 'w-full items-center justify-center gap-2 px-3 py-2.5 md:justify-center md:gap-0 md:p-2.5'
                    : 'w-full items-center justify-center gap-2 px-3 py-2.5'
                }`}
              >
                <Icon icon="mdi:logout" className="size-4 shrink-0 opacity-90" aria-hidden />
                <span className={`text-xs font-medium ${collapsed ? 'md:hidden' : ''}`}>Cerrar sesión</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expandir panel' : 'Minimizar panel'}
              className="mt-3 hidden w-full touch-manipulation items-center justify-center gap-2 rounded-md py-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white md:flex"
            >
              <Icon
                icon={collapsed ? 'mdi:chevron-double-right' : 'mdi:chevron-double-left'}
                className="size-5"
                aria-hidden
              />
              {!collapsed && <span className="text-xs font-medium">Minimizar</span>}
            </button>
          </div>
          {!collapsed && (
            <span className="mt-3 hidden text-xs text-white/60 md:block">SKYLINE ERP v1.0</span>
          )}
        </div>
      </aside>
    </>
  );
}
