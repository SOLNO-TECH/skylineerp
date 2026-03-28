import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, error, user } = useAuth();
  const { toast } = useNotification();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from') || '/';

  if (user) {
    navigate(from, { replace: true });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast('Sesión iniciada correctamente');
      navigate(from, { replace: true });
    } catch {
      // error ya está en useAuth
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eceef2]">
      {/* Fondo sobrio: gris-azulado liso + halos muy suaves (sin textura ni vigas de color) */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_0%_-10%,rgba(45,88,167,0.11),transparent_52%),radial-gradient(ellipse_70%_55%_at_100%_105%,rgba(45,88,167,0.06),transparent_48%)]"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        {/* Panel marca — escritorio */}
        <aside className="relative hidden flex-col justify-between border-r border-slate-200/90 bg-white/45 px-12 py-14 backdrop-blur-[6px] lg:flex lg:w-[44%] xl:w-[40%]">
          <div>
            <div className="mb-10">
              <p className="font-sans text-4xl font-bold leading-none tracking-tight text-[#162036] xl:text-5xl">
                <span className="text-skyline-blue">SKY</span>
                <span className="text-skyline-red">LINE</span>
              </p>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.32em] text-slate-500 xl:text-base xl:tracking-[0.36em]">
                Industrial ERP
              </p>
            </div>
            <h1 className="max-w-sm font-sans text-3xl font-semibold leading-tight tracking-tight text-[#162036] xl:text-[2rem]">
              Operaciones claras. Flotilla bajo control.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-600">
              Rentas, unidades, mantenimiento y administración en un solo entorno seguro para tu equipo.
            </p>
            <div className="mt-10 max-w-sm border-t border-slate-200/90 pt-8">
              <ul className="space-y-3.5 text-sm leading-snug text-slate-700">
                <li className="flex gap-3">
                  <Icon icon="mdi:check-bold" className="mt-0.5 size-4 shrink-0 text-skyline-blue" aria-hidden />
                  <span>Acceso cifrado y sesiones con token seguro.</span>
                </li>
                <li className="flex gap-3">
                  <Icon icon="mdi:check-bold" className="mt-0.5 size-4 shrink-0 text-skyline-blue" aria-hidden />
                  <span>Visibilidad en tiempo real de rentas y estatus.</span>
                </li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Formulario */}
        <main className="flex flex-1 flex-col items-center justify-center px-5 py-12 sm:px-8 lg:px-12">
          {/* Marca — móvil */}
          <div className="mb-8 w-full max-w-[420px] text-center lg:hidden">
            <p className="font-sans text-3xl font-bold leading-none tracking-tight text-[#162036] sm:text-4xl">
              <span className="text-skyline-blue">SKY</span>
              <span className="text-skyline-red">LINE</span>
            </p>
            <p className="mt-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 sm:text-sm sm:tracking-[0.32em]">
              Industrial ERP
            </p>
          </div>

          <div className="w-full max-w-[420px]">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_20px_40px_-20px_rgba(15,23,42,0.18),0_0_0_1px_rgba(255,255,255,0.9)_inset]">
              <div className="h-1 bg-gradient-to-r from-skyline-blue via-skyline-blue to-skyline-red" aria-hidden />
              <div className="px-8 pb-9 pt-8 sm:px-10">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-skyline-muted">
                  Acceso al sistema
                </p>
                <h2 className="mt-2 font-sans text-2xl font-semibold tracking-tight text-[#1a1a2e]">
                  Iniciar sesión
                </h2>
                <p className="mt-1.5 text-sm text-gray-500">
                  Introduce tus credenciales corporativas para continuar.
                </p>

                <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
                  {error && (
                    <div
                      className="flex gap-3 rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-800"
                      role="alert"
                    >
                      <Icon icon="mdi:alert-circle-outline" className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
                      <span>{error}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="login-email" className="text-sm font-semibold text-gray-800">
                      Correo electrónico
                    </label>
                    <div className="mt-2 flex items-center gap-3 rounded-xl border border-skyline-border bg-gray-50/80 px-3.5 py-0.5 transition-colors focus-within:border-skyline-blue focus-within:bg-white focus-within:ring-2 focus-within:ring-skyline-blue/20">
                      <Icon icon="mdi:email-outline" className="size-5 shrink-0 text-gray-400" aria-hidden />
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nombre@empresa.com"
                        autoComplete="email"
                        required
                        className="input min-h-[2.75rem] flex-1 border-0 bg-transparent px-0 py-2.5 shadow-none ring-0 focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="login-password" className="text-sm font-semibold text-gray-800">
                      Contraseña
                    </label>
                    <div className="mt-2 flex items-center gap-3 rounded-xl border border-skyline-border bg-gray-50/80 px-3.5 py-0.5 transition-colors focus-within:border-skyline-blue focus-within:bg-white focus-within:ring-2 focus-within:ring-skyline-blue/20">
                      <Icon icon="mdi:lock-outline" className="size-5 shrink-0 text-gray-400" aria-hidden />
                      <input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                        className="input min-h-[2.75rem] flex-1 border-0 bg-transparent px-0 py-2.5 shadow-none ring-0 focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary mt-2 w-full justify-center rounded-xl py-3.5 text-base font-semibold shadow-md shadow-skyline-blue/25 transition-shadow hover:shadow-lg hover:shadow-skyline-blue/30"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="inline-block size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Iniciando sesión…
                      </>
                    ) : (
                      <>
                        <Icon icon="mdi:login" className="size-5" aria-hidden />
                        Iniciar sesión
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            <p className="mt-8 text-center text-xs text-slate-500">
              © {new Date().getFullYear()} Skyline · Uso exclusivo autorizado
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
