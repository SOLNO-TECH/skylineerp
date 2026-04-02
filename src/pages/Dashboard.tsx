import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import type { RentaRow, User } from '../api/client';
import {
  getAvatarUrl,
  getUnidades,
  getActividadReciente,
  getRentas,
} from '../api/client';

const COBRANZA_EPS = 0.005;
const DIAS_POR_VENCER = 14;

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

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function limitePorVencerISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + DIAS_POR_VENCER);
  return d.toISOString().slice(0, 10);
}

function totalContratoRenta(r: RentaRow) {
  return (r.monto ?? 0) + (r.deposito ?? 0);
}

function totalPagadoRenta(r: RentaRow) {
  if (r.totalPagado != null) return r.totalPagado;
  return (r.pagos ?? []).reduce((s, p) => s + p.monto, 0);
}

function saldoRenta(r: RentaRow) {
  return totalContratoRenta(r) - totalPagadoRenta(r);
}

function etiquetaUnidadRenta(r: RentaRow) {
  const eco = (r.numeroEconomico ?? '').trim();
  return eco ? `${eco} · ${r.placas}` : r.placas;
}

type MiniListaProps = {
  titulo: string;
  icon: string;
  vacio: string;
  items: RentaRow[];
  max?: number;
  badge?: (r: RentaRow) => ReactNode;
  subtitulo?: (r: RentaRow) => string | undefined;
};

function MiniListaRentas({ titulo, icon, vacio, items, max = 5, badge, subtitulo }: MiniListaProps) {
  const slice = items.slice(0, max);
  return (
    <div className="rounded-lg border border-skyline-border/90 bg-skyline-bg/40 p-3">
      <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-skyline-muted">
        <Icon icon={icon} className="size-3.5 shrink-0 text-skyline-blue" aria-hidden />
        {titulo}
        <span className="ml-auto tabular-nums text-gray-500">({items.length})</span>
      </h4>
      <ul className="space-y-0">
        {slice.length === 0 ? (
          <li className="py-2 text-center text-xs text-skyline-muted">{vacio}</li>
        ) : (
          slice.map((r) => (
            <li key={r.id} className="border-b border-skyline-border/80 last:border-0">
              <Link
                to={`/rentas/${r.id}`}
                className="flex items-start justify-between gap-2 py-2 no-underline hover:bg-white/80 rounded-md -mx-1 px-1"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-gray-900">{etiquetaUnidadRenta(r)}</p>
                  <p className="truncate text-[11px] text-gray-500">{r.clienteNombre}</p>
                  {subtitulo?.(r) ? <p className="truncate text-[10px] text-gray-400">{subtitulo(r)}</p> : null}
                </div>
                {badge ? <div className="shrink-0">{badge(r)}</div> : null}
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function Dashboard() {
  const { hasRole, user } = useAuth();
  const [unidades, setUnidades] = useState<{ estatus: string }[]>([]);
  const [fechasInicioRentas, setFechasInicioRentas] = useState<string[]>([]);
  const [actividad, setActividad] = useState<
    { id: string; accion: string; detalle: string; fecha: string; icon: string; usuarioNombre?: string }[]
  >([]);
  const [rentasFull, setRentasFull] = useState<RentaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getUnidades(), getActividadReciente(10), getRentas()])
      .then(([u, a, r]) => {
        setUnidades(u);
        setActividad(a);
        setRentasFull(r);
        setFechasInicioRentas(r.map((item) => item.fechaInicio));
      })
      .catch(() => {
        setUnidades([]);
        setFechasInicioRentas([]);
        setActividad([]);
        setRentasFull([]);
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

  const rentasPorVencerPanel = useMemo(() => {
    const hoyStr = hoyISO();
    const limiteStr = limitePorVencerISO();
    const activaOReservada = (r: RentaRow) => r.estado === 'activa' || r.estado === 'reservada';

    const porVencer = rentasFull
      .filter((r) => activaOReservada(r) && r.fechaFin >= hoyStr && r.fechaFin <= limiteStr)
      .sort((a, b) => a.fechaFin.localeCompare(b.fechaFin));

    const vencidas = rentasFull
      .filter((r) => activaOReservada(r) && r.fechaFin < hoyStr)
      .sort((a, b) => b.fechaFin.localeCompare(a.fechaFin));

    const liquidada = (r: RentaRow) => saldoRenta(r) <= COBRANZA_EPS;
    const conAdeudo = (r: RentaRow) => saldoRenta(r) > COBRANZA_EPS;

    const cobradas = rentasFull
      .filter((r) => liquidada(r) && r.estado !== 'cancelada')
      .sort((a, b) => (b.ultimaFechaPago || b.fechaFin).localeCompare(a.ultimaFechaPago || a.fechaFin));

    const porCobrar = rentasFull
      .filter(conAdeudo)
      .sort((a, b) => saldoRenta(b) - saldoRenta(a));

    return { porVencer, vencidas, cobradas, porCobrar };
  }, [rentasFull]);

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
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-skyline-muted">
            <Icon icon="mdi:calendar-multiple-check" className="size-4" aria-hidden />
            Rentas y cobranza
          </h3>
          <p className="mb-4 text-xs text-gray-500">
            Por vencer (próximos {DIAS_POR_VENCER} días), vencidas sin cerrar, pendientes de cobro y liquidadas.
          </p>
          {loading ? (
            <p className="py-6 text-center text-sm text-skyline-muted">Cargando...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MiniListaRentas
                  titulo="Por vencer"
                  icon="mdi:calendar-clock"
                  vacio={`Ninguna en los próximos ${DIAS_POR_VENCER} días`}
                  items={rentasPorVencerPanel.porVencer}
                  badge={(r) => {
                    const d = diasHasta(r.fechaFin);
                    const urgente = d <= 2;
                    return (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          urgente ? 'bg-amber-500/20 text-amber-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `${d} d.`}
                      </span>
                    );
                  }}
                  subtitulo={(r) => `Vence ${formatFechaVencimiento(r.fechaFin)}`}
                />
                <MiniListaRentas
                  titulo="Vencidas"
                  icon="mdi:calendar-remove"
                  vacio="Sin contratos vencidos (activos/reservados)"
                  items={rentasPorVencerPanel.vencidas}
                  badge={() => (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-800">
                      Vencida
                    </span>
                  )}
                  subtitulo={(r) => `Fin ${formatFechaVencimiento(r.fechaFin)}`}
                />
                <MiniListaRentas
                  titulo="Por cobrar"
                  icon="mdi:cash-clock"
                  vacio="Sin adeudos pendientes"
                  items={rentasPorVencerPanel.porCobrar}
                  badge={(r) => (
                    <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                      ${saldoRenta(r).toLocaleString('es-MX')}
                    </span>
                  )}
                  subtitulo={(r) =>
                    `Contrato $${totalContratoRenta(r).toLocaleString('es-MX')} · Pagado $${totalPagadoRenta(r).toLocaleString('es-MX')}`
                  }
                />
                <MiniListaRentas
                  titulo="Cobradas"
                  icon="mdi:cash-check"
                  vacio="Aún no hay rentas liquidadas"
                  items={rentasPorVencerPanel.cobradas}
                  badge={() => (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      Liquidado
                    </span>
                  )}
                  subtitulo={(r) =>
                    r.ultimaFechaPago
                      ? `Último pago ${formatFechaVencimiento(r.ultimaFechaPago)}`
                      : `Contrato $${totalContratoRenta(r).toLocaleString('es-MX')}`
                  }
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-3 border-t border-skyline-border pt-4">
                <Link
                  to="/rentas"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-skyline-blue no-underline hover:underline"
                >
                  Ver rentas
                  <Icon icon="mdi:arrow-right" className="size-4" aria-hidden />
                </Link>
                <Link
                  to="/pagos"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-skyline-blue no-underline hover:underline"
                >
                  Ver cobranza (pagos)
                  <Icon icon="mdi:arrow-right" className="size-4" aria-hidden />
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
