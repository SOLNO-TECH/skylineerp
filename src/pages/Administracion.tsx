import { NavLink, Outlet } from 'react-router-dom';
import { Icon } from '@iconify/react';

const subNav = [
  { to: '/administracion', end: true, label: 'Resumen', icon: 'mdi:view-dashboard-outline' as const },
  { to: '/administracion/proveedores', end: false, label: 'Proveedores', icon: 'mdi:truck-delivery-outline' as const },
  { to: '/administracion/reportes-proveedores', end: false, label: 'Reportes CxP', icon: 'mdi:file-chart-outline' as const },
];

export function Administracion() {
  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-900">Administración y proveedores</h1>
        <p className="mt-1 text-sm font-medium text-gray-500">
          Directorio de proveedores, facturas, pagos y cuentas por pagar.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-skyline-border pb-3">
        {subNav.map(({ to, end, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors no-underline ${
                isActive
                  ? 'border-skyline-blue bg-skyline-blue text-white'
                  : 'border-skyline-border bg-white text-gray-600 hover:border-skyline-blue hover:text-skyline-blue'
              }`
            }
          >
            <Icon icon={icon} className="size-5 shrink-0" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
