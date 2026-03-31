import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import type { User } from '../api/client';
import {
  getAvatarUrl,
  getUnidades,
  getActividadReciente,
  getRentasProximosVencimientos,
  getRentas,
} from '../api/client';

function welcomeDisplayName(u: User): string {
  const n = u.nombre?.trim();
  if (n) return n;
  const local = u.email?.split('@')[0] ?? '';
  if (!local) return 'Usuario';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function userInitials(u: User): string {
  const n = u.nombre?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] ?? '?').toUpperCase();
  }
  const local = u.email?.split('@')[0] ?? '?';
  return local.slice(0, 2).toUpperCase();
}

function DashboardWelcomeAvatar({ user }: { user: User }) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [user.avatar]);
  const src = user.avatar?.trim() ? getAvatarUrl(user.avatar.trim()) : '';
  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt=""
        className="size-11 shrink-0 rounded-lg object-cover shadow-inner ring-1 ring-black/5"
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <div
      className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-skyline-blue to-[#24478a] text-[0.8rem] font-bold tracking-tight text-white shadow-inner"
      aria-hidden
    >
      {userInitials(user)}
    </div>
  );
}

const statConfig = [
  { label: 'Unidades disponibles', key: 'disponible' as const, icon: 'mdi:car-multiple', variant: 'disponible' },
  { label: 'En renta', key: 'enRenta' as const, icon: 'mdi:key-chain', variant: 'renta' },
  { label: 'En taller', key: 'taller' as const, icon: 'mdi:warehouse', variant: 'taller' },
  { label: 'Rentas activas hoy', key: 'rentasActivas' as const, icon: 'mdi:calendar-today', variant: 'neutral' },
];

const statIconStyles: Record<string, string> = {
  disponible: 'bg-emerald-500/10 text-emerald-600',
  renta: 'bg-blue-500/10 text-blue-600',
  taller: 'bg-skyline-red/10 text-skyline-red',
  neutral: 'bg-skyline-muted/10 text-skyline-muted',
};

const ROLES_CATALOGO_FLOTAS = ['administrador', 'supervisor', 'operador', 'consulta'] as const;

const allPillars = [
  {
    path: '/unidades',
    title: 'Control de Unidades',
    icon: 'mdi:car-side',
    roles: [...ROLES_CATALOGO_FLOTAS],
  },
  {
    path: '/rentas',
    title: 'Gestión de Rentas',
    icon: 'mdi:calendar-month',
    roles: [...ROLES_CATALOGO_FLOTAS],
  },
  { path: '/checkinout', title: 'Check-in / Check-out', icon: 'mdi:clipboard-check-outline' },
  { path: '/mantenimiento', title: 'Mantenimiento', icon: 'mdi:wrench' },
  { path: '/administracion', title: 'Administración y Proveedores', icon: 'mdi:domain', roles: ['administrador', 'supervisor'] as const },
];

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function parseDateOnly(s: string): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildRentasSemanas(fechaInicioRentas: string[], weeks = 6): { semana: string; rentas: number }[] {
  const startCurrentWeek = startOfWeekMonday(new Date());
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(startCurrentWeek);
    start.setDate(start.getDate() - (weeks - 1 - i) * 7);
    return { start, rentas: 0 };
  });

  for (const f of fechaInicioRentas) {
    const d = parseDateOnly(f);
    if (!d) continue;
    for (let i = 0; i < buckets.length; i++) {
      const bucketStart = buckets[i].start;
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setDate(bucketEnd.getDate() + 7);
      if (d >= bucketStart && d < bucketEnd) {
        buckets[i].rentas += 1;
        break;
      }
    }
  }

  return buckets.map((b, idx) => ({ semana: `Sem ${idx + 1}`, rentas: b.rentas }));
}

function formatHoraRelativa(fechaStr: string): string {
  if (!fechaStr) return '';
  const d = new Date(fechaStr.replace(' ', 'T'));
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffH < 24) return `Hace ${diffH} h`;
  if (diffD === 1) return 'Ayer';
  if (diffD < 7) return `Hace ${diffD} días`;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function formatFechaVencimiento(s: string): string {
  if (!s) return '';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function diasHasta(fechaStr: string): number {
  const d = new Date(fechaStr + 'T12:00:00');
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - hoy.getTime()) / 86400000);
}

export function Dashboard() {
  const { hasRole, user } = useAuth();
  const [unidades, setUnidades] = useState<{ estatus: string }[]>([]);
  const [fechasInicioRentas, setFechasInicioRentas] = useState<string[]>([]);
  const [actividad, setActividad] = useState<
    { id: string; accion: string; detalle: string; fecha: string; icon: string; usuarioNombre?: string }[]
  >([]);
  const [vencimientos, setVencimientos] = useState<
    { id: string; placas: string; numeroEconomico?: string; clienteNombre: string; fechaFin: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getUnidades(),
      getActividadReciente(10),
      getRentasProximosVencimientos(14),
      getRentas(),
    ])
      .then(([u, a, v, r]) => {
        setUnidades(u);
        setActividad(a);
        setVencimientos(v);
        setFechasInicioRentas(r.map((item) => item.fechaInicio));
      })
      .catch(() => {
        setUnidades([]);
        setFechasInicioRentas([]);
        setActividad([]);
        setVencimientos([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const disponible = unidades.filter((u) => u.estatus === 'Disponible').length;
    const enRenta = unidades.filter((u) => u.estatus === 'En Renta').length;
    const taller = unidades.filter((u) => u.estatus === 'Taller').length;
    return { disponible, enRenta, taller, rentasActivas: enRenta };
  }, [unidades]);

  const stats = useMemo(
    () =>
      statConfig.map(({ label, key, icon, variant }) => ({
        label,
        value: loading ? '—' : String(counts[key]),
        icon,
        variant,
      })),
    [counts, loading]
  );

  const estadoFlotilla = useMemo(() => {
    const data = [
      { name: 'Disponibles', value: counts.disponible, color: '#198754' },
      { name: 'En renta', value: counts.enRenta, color: '#0d6efd' },
      { name: 'En taller', value: counts.taller, color: '#E62129' },
    ].filter((d) => d.value > 0);
    return data.length > 0 ? data : [{ name: 'Sin unidades', value: 1, color: '#E9ECEF' }];
  }, [counts]);

  const rentasPorSemana = useMemo(
    () => buildRentasSemanas(fechasInicioRentas, 6),
    [fechasInicioRentas]
  );

  const pillars = allPillars.filter(
    (p) => !('roles' in p && p.roles) || hasRole(...(p.roles ?? []))
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-8 flex flex-col gap-5 border-b border-skyline-border/80 pb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[#162036]">
            Panel de control
          </h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Resumen operativo de tu flotilla
          </p>
        </div>
        {user && (
          <div className="flex w-full shrink-0 items-center gap-3 rounded-xl border border-skyline-border bg-white px-4 py-3 shadow-sm sm:w-auto sm:max-w-md sm:py-2.5">
            <DashboardWelcomeAvatar user={user} />
            <div className="min-w-0 flex-1 sm:flex-initial">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-skyline-muted">
                Bienvenido
              </p>
              <p className="truncate font-semibold leading-tight text-[#162036]">{welcomeDisplayName(user)}</p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
        )}
      </header>

      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen de flotilla">
        {stats.map(({ label, value, icon, variant }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-lg border border-skyline-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div
              className={`flex size-11 shrink-0 items-center justify-center rounded-md ${statIconStyles[variant]}`}
            >
              <Icon icon={icon} className="size-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <span className="block text-2xl font-bold tracking-tight text-gray-900">
                {value}
              </span>
              <span className="mt-0.5 block text-xs font-medium text-gray-500">
                {label}
              </span>
            </div>
          </div>
        ))}
      </section>

      <section aria-label="Módulos del sistema" className="mb-10">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-skyline-muted">
          Módulos del sistema
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {pillars.map(({ path, title, icon }) => (
            <Link
              key={path}
              to={path}
              title={title}
              className="group relative flex flex-col items-center rounded-lg border border-skyline-border bg-white p-5 text-center transition-all hover:border-skyline-blue hover:bg-skyline-blue/5 hover:shadow-md no-underline hover:no-underline"
            >
              <div className="mb-3 flex size-12 items-center justify-center rounded-md bg-skyline-blue/10 text-skyline-blue transition-colors group-hover:bg-skyline-blue group-hover:text-white">
                <Icon icon={icon} className="size-6" aria-hidden />
              </div>
              <span className="text-sm font-semibold text-gray-900">{title}</span>
              <Icon
                icon="mdi:chevron-right"
                className="absolute right-2 top-2 size-5 text-skyline-muted opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-skyline-blue"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </section>

      {/* Gráficos */}
      <section className="mb-10 grid gap-6 lg:grid-cols-2" aria-label="Métricas">
        <div className="rounded-lg border border-skyline-border bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-skyline-muted">
            Rentas por semana
          </h3>
          <div className="h-64 min-h-[256px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={256} minWidth={0}>
              <AreaChart data={rentasPorSemana}>
                <defs>
                  <linearGradient id="colorRentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2D58A7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2D58A7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-skyline-border" />
                <XAxis dataKey="semana" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E9ECEF' }}
                  formatter={(value) => [value != null ? `${value} rentas` : '—', 'Rentas']}
                />
                <Area type="monotone" dataKey="rentas" stroke="#2D58A7" strokeWidth={2} fill="url(#colorRentas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-skyline-border bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-skyline-muted">
            Estado de la flotilla
          </h3>
          <div className="h-64 min-h-[256px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={256} minWidth={0}>
              <PieChart>
                <Pie
                  data={estadoFlotilla}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {estadoFlotilla.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value != null ? `${value} unidades` : '—', 'Cantidad']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Actividad reciente + Próximos vencimientos */}
      <section className="grid gap-6 lg:grid-cols-2" aria-label="Actividad y vencimientos">
        <div className="rounded-lg border border-skyline-border bg-white p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-skyline-muted">
            <Icon icon="mdi:history" className="size-4" aria-hidden />
            Actividad reciente
          </h3>
          <ul className="space-y-0 divide-y divide-skyline-border">
            {loading ? (
              <li className="py-4 text-center text-sm text-skyline-muted">Cargando...</li>
            ) : actividad.length === 0 ? (
              <li className="py-4 text-center text-sm text-skyline-muted">Sin actividad reciente</li>
            ) : (
              actividad.map((item) => (
                <li key={item.id} className="flex gap-3 py-3 first:pt-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-skyline-blue/10 text-skyline-blue">
                    <Icon icon={item.icon} className="size-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.accion}</p>
                    <p className="text-xs text-gray-500">{item.detalle}</p>
                    {item.usuarioNombre ? (
                      <p className="text-[11px] text-gray-400">Por: {item.usuarioNombre}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-skyline-muted">{formatHoraRelativa(item.fecha)}</span>
                </li>
              ))
            )}
          </ul>
          <Link
            to="/actividad"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-skyline-blue no-underline hover:underline"
          >
            Ver toda la actividad
            <Icon icon="mdi:arrow-right" className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="rounded-lg border border-skyline-border bg-white p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-skyline-muted">
            <Icon icon="mdi:calendar-alert" className="size-4" aria-hidden />
            Rentas por vencer
          </h3>
          <ul className="space-y-0">
            {loading ? (
              <li className="py-4 text-center text-sm text-skyline-muted">Cargando...</li>
            ) : vencimientos.length === 0 ? (
              <li className="py-4 text-center text-sm text-skyline-muted">No hay rentas por vencer en los próximos 14 días</li>
            ) : (
              vencimientos.map((v) => {
                const dias = diasHasta(v.fechaFin);
                const urgente = dias <= 2;
                return (
                  <Link
                    key={v.id}
                    to={`/rentas/${v.id}`}
                    className={`flex items-center justify-between gap-3 border-b border-skyline-border py-3 last:border-0 last:pb-0 no-underline hover:bg-skyline-bg/50 ${
                      urgente ? 'bg-amber-50/50 -mx-2 px-2 rounded-md' : ''
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {(v.numeroEconomico ?? '').trim() ? `${(v.numeroEconomico ?? '').trim()} · ${v.placas}` : v.placas} —{' '}
                        {v.clienteNombre}
                      </p>
                      <p className="text-xs text-gray-500">Vence: {formatFechaVencimiento(v.fechaFin)}</p>
                    </div>
                    {urgente ? (
                      <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `${dias} días`}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-skyline-muted">{dias} días</span>
                    )}
                  </Link>
                );
              })
            )}
          </ul>
          <Link
            to="/rentas"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-skyline-blue no-underline hover:underline"
          >
            Ver todas las rentas
            <Icon icon="mdi:arrow-right" className="size-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
