import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const STORAGE_KEY = 'skyline_sidebar_collapsed';

const navItems = [
  { path: '/', label: 'Inicio', icon: 'mdi:view-dashboard' },
  { path: '/unidades', label: 'Control de Unidades', icon: 'mdi:car-side' },
  { path: '/rentas', label: 'Gestión de Rentas', icon: 'mdi:calendar-month' },
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

export function Sidebar() {
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
    logout();
    navigate('/login', { replace: true });
  }

  const linkBase =
    'mb-0.5 flex items-center rounded-md transition-colors no-underline hover:no-underline';
  const linkActive = 'bg-white/20 text-white';
  const linkInactive = 'text-white/90 hover:bg-white/10 hover:text-white';

  const widthClass = collapsed ? 'w-[72px] min-w-[72px]' : 'w-[260px] min-w-[260px]';

  return (
    <>
      <div
        className={`shrink-0 transition-[width] duration-200 ${widthClass}`}
        aria-hidden
      />
      <aside
      className={`fixed left-0 top-0 z-50 flex h-screen flex-col bg-skyline-blue shadow-lg transition-[width] duration-200 ${widthClass}`}
    >
      <div
        className={`flex items-center border-b border-white/10 py-4 ${
          collapsed ? 'justify-center px-0' : 'justify-center gap-0 px-4 py-6'
        }`}
      >
        {collapsed ? (
          <div className="flex text-xl font-bold italic">
            <span className="text-white">S</span>
            <span className="text-skyline-red">L</span>
          </div>
        ) : (
          <div className="flex text-2xl font-bold italic tracking-wide">
            <span className="text-white">SKY</span>
            <span className="text-skyline-red">LINE</span>
          </div>
        )}
      </div>

      <nav className={`flex-1 overflow-y-auto ${collapsed ? 'p-2' : 'p-3'}`}>
        {visibleNavItems.map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive} ${
                collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
              }`
            }
          >
            <Icon icon={icon} className={collapsed ? 'size-6 shrink-0' : 'size-5 shrink-0'} aria-hidden />
            {!collapsed && <span className="min-w-0 flex-1">{label}</span>}
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
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? linkActive : linkInactive} ${
                    collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                  }`
                }
              >
                <Icon icon={icon} className={collapsed ? 'size-6 shrink-0' : 'size-5 shrink-0'} aria-hidden />
                {!collapsed && <span className="min-w-0 flex-1">{label}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className={`border-t border-white/10 ${collapsed ? 'p-2' : 'p-4'}`}>
        <div className={collapsed ? 'flex flex-col items-center gap-2' : ''}>
          {user && (
            <Link
              to="/perfil"
              title={collapsed ? `${user.nombre} (${user.rol})` : undefined}
              className={`flex rounded-md transition-colors hover:bg-white/10 no-underline hover:no-underline ${
                collapsed ? 'justify-center p-2' : 'items-center gap-3 px-1 py-1 -mx-1 mb-3'
              }`}
            >
              <div
                className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-sm font-semibold text-white ${
                  collapsed ? 'size-9' : 'size-10'
                }`}
                aria-hidden
              >
                {user.avatar ? (
                  <img src={`/uploads/${user.avatar}`} alt="" className="h-full w-full object-cover" />
                ) : (
                  user.nombre.charAt(0).toUpperCase()
                )}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{user.nombre}</span>
                  <span className="block truncate text-xs capitalize text-white/70">{user.rol}</span>
                </div>
              )}
            </Link>
          )}
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              title={collapsed ? 'Cerrar sesión' : undefined}
              className={`flex rounded-md border border-white/30 bg-transparent text-white/95 transition-colors hover:bg-white/15 ${
                collapsed
                  ? 'justify-center p-2.5'
                  : 'w-full items-center justify-center gap-2 px-3 py-2.5'
              }`}
            >
              <Icon icon="mdi:logout" className={collapsed ? 'size-5 opacity-90' : 'size-4 opacity-90'} aria-hidden />
              {!collapsed && <span className="text-xs font-medium">Cerrar sesión</span>}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expandir panel' : 'Minimizar panel'}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md py-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
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
          <span className="mt-3 block text-xs text-white/60">SKYLINE ERP v1.0</span>
        )}
      </div>
    </aside>
    </>
  );
}
