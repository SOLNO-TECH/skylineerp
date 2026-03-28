import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
    <div className="flex min-h-screen items-center justify-center bg-skyline-bg p-6">
      <div className="w-full max-w-md rounded-lg border border-skyline-border bg-white p-8 shadow-sm">
        <div className="mb-1 text-center text-2xl font-bold italic tracking-wide">
          <span className="text-skyline-blue">SKY</span>
          <span className="text-skyline-red">LINE</span>
        </div>
        <p className="mb-6 text-center text-sm font-medium text-gray-500">
          Sistema de gestión de flotilla
        </p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {error && (
            <div
              className="rounded-md bg-red-500/10 px-3 py-2.5 text-sm font-medium text-skyline-red"
              role="alert"
            >
              {error}
            </div>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-900">
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@skyline.com"
              autoComplete="email"
              required
              className="rounded-md border border-skyline-border bg-white px-3 py-2.5 text-[15px] text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-skyline-blue focus:ring-2 focus:ring-skyline-blue/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-900">
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="rounded-md border border-skyline-border bg-white px-3 py-2.5 text-[15px] text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-skyline-blue focus:ring-2 focus:ring-skyline-blue/20"
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary mt-1 rounded-md py-3 text-base"
            disabled={submitting}
          >
            {submitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
