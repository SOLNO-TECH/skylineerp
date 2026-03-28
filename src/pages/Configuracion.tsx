import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';

const CONFIG_KEY = 'skyline_config';

type ConfigState = {
  nombreEmpresa: string;
  emailContacto: string;
  telefono: string;
  direccion: string;
  rfc: string;
  sitioWeb: string;
  notifMantenimiento: boolean;
  recordatorioSeguros: boolean;
  diasAnticipacionSeguros: number;
  resumenDiario: boolean;
  zonaHoraria: string;
  formatoFecha: string;
};

const defaultConfig: ConfigState = {
  nombreEmpresa: 'SKYLINE',
  emailContacto: 'contacto@skyline.com',
  telefono: '',
  direccion: '',
  rfc: '',
  sitioWeb: '',
  notifMantenimiento: true,
  recordatorioSeguros: true,
  diasAnticipacionSeguros: 7,
  resumenDiario: false,
  zonaHoraria: 'America/Mexico_City',
  formatoFecha: 'DD/MM/YYYY',
};

function loadConfig(): ConfigState {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {}
  return defaultConfig;
}

function saveConfig(config: ConfigState) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function Configuracion() {
  const { toast } = useNotification();
  const [config, setConfig] = useState<ConfigState>(defaultConfig);
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  function update<K extends keyof ConfigState>(key: K, value: ConfigState[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    saveConfig(config);
    toast('Configuración guardada');
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Configuración</h1>
        <p className="mt-1 text-sm font-medium text-gray-500">
          Ajustes generales del sistema, datos de la empresa y preferencias
        </p>
      </header>

      <Link
        to="/perfil"
        className="mb-6 flex items-center gap-3 rounded-xl border border-skyline-border bg-white p-4 shadow-sm transition-all hover:border-skyline-blue hover:shadow-md no-underline"
      >
        <div className="flex size-12 items-center justify-center rounded-lg bg-skyline-blue/10">
          <Icon icon="mdi:account-circle" className="size-6 text-skyline-blue" aria-hidden />
        </div>
        <div>
          <p className="font-semibold text-gray-900">Mi perfil</p>
          <p className="text-xs text-gray-500">Nombre, apellidos, RFC, CURP, foto y más</p>
        </div>
        <Icon icon="mdi:chevron-right" className="ml-auto size-5 text-skyline-muted" aria-hidden />
      </Link>

      <form onSubmit={handleGuardar} className="space-y-6">
        {/* Datos de la empresa */}
        <div className="overflow-hidden rounded-xl border border-skyline-border bg-white shadow-sm">
          <div className="border-b border-skyline-border bg-skyline-bg/50 px-6 py-4">
            <h2 className="flex items-center gap-2.5 text-base font-semibold text-gray-900">
              <span className="flex size-9 items-center justify-center rounded-lg bg-skyline-blue/10">
                <Icon icon="mdi:domain" className="size-5 text-skyline-blue" aria-hidden />
              </span>
              Datos de la empresa
            </h2>
          </div>
          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 sm:col-span-2 sm:flex-row sm:items-center">
              <span className="w-40 shrink-0 text-sm font-medium text-gray-700">Nombre</span>
              <input
                type="text"
                value={config.nombreEmpresa}
                onChange={(e) => update('nombreEmpresa', e.target.value)}
                className="flex-1 rounded-lg border border-skyline-border px-3 py-2.5 text-sm outline-none focus:border-skyline-blue focus:ring-2 focus:ring-skyline-blue/20"
                placeholder="Nombre de la empresa"
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <span className="w-40 shrink-0 text-sm font-medium text-gray-700">Email de contacto</span>
              <input
                type="email"
                value={config.emailContacto}
                onChange={(e) => update('emailContacto', e.target.value)}
                className="flex-1 rounded-lg border border-skyline-border px-3 py-2.5 text-sm outline-none focus:border-skyline-blue focus:ring-2 focus:ring-skyline-blue/20"
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <span className="w-40 shrink-0 text-sm font-medium text-gray-700">Teléfono</span>
              <input
                type="tel"
                value={config.telefono}
                onChange={(e) => update('telefono', e.target.value)}
                className="flex-1 rounded-lg border border-skyline-border px-3 py-2.5 text-sm outline-none focus:border-skyline-blue focus:ring-2 focus:ring-skyline-blue/20"
                placeholder="55 1234 5678"
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2 sm:flex-row sm:items-start">
              <span className="w-40 shrink-0 pt-2.5 text-sm font-medium text-gray-700">Dirección</span>
              <textarea
                value={config.direccion}
                onChange={(e) => update('direccion', e.target.value)}
                rows={2}
                className="flex-1 resize-none rounded-lg border border-skyline-border px-3 py-2.5 text-sm outline-none focus:border-skyline-blue focus:ring-2 focus:ring-skyline-blue/20"
                placeholder="Calle, colonia, ciudad, CP"
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <span className="w-40 shrink-0 text-sm font-medium text-gray-700">RFC</span>
              <input
                type="text"
                value={config.rfc}
                onChange={(e) => update('rfc', e.target.value.toUpperCase())}
                maxLength={13}
                className="flex-1 rounded-lg border border-skyline-border px-3 py-2.5 text-sm outline-none focus:border-skyline-blue focus:ring-2 focus:ring-skyline-blue/20"
                placeholder="XAXX010101XXX"
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <span className="w-40 shrink-0 text-sm font-medium text-gray-700">Sitio web</span>
              <input
                type="url"
                value={config.sitioWeb}
                onChange={(e) => update('sitioWeb', e.target.value)}
                className="flex-1 rounded-lg border border-skyline-border px-3 py-2.5 text-sm outline-none focus:border-skyline-blue focus:ring-2 focus:ring-skyline-blue/20"
                placeholder="https://..."
              />
            </label>
          </div>
        </div>

        {/* Notificaciones y alertas */}
        <div className="overflow-hidden rounded-xl border border-skyline-border bg-white shadow-sm">
          <div className="border-b border-skyline-border bg-skyline-bg/50 px-6 py-4">
            <h2 className="flex items-center gap-2.5 text-base font-semibold text-gray-900">
              <span className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10">
                <Icon icon="mdi:bell-ring" className="size-5 text-amber-600" aria-hidden />
              </span>
              Notificaciones y alertas
            </h2>
          </div>
          <div className="space-y-4 p-6">
            <label className="flex cursor-pointer items-start gap-4 rounded-lg border border-skyline-border p-4 transition-colors hover:bg-skyline-bg/30">
              <input
                type="checkbox"
                checked={config.notifMantenimiento}
                onChange={(e) => update('notifMantenimiento', e.target.checked)}
                className="mt-0.5 size-4 rounded border-skyline-border text-skyline-blue focus:ring-skyline-blue"
              />
              <div>
                <p className="font-medium text-gray-900">Alertas de mantenimiento</p>
                <p className="text-xs text-gray-500">Recibir email cuando una unidad requiera servicio</p>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-4 rounded-lg border border-skyline-border p-4 transition-colors hover:bg-skyline-bg/30">
              <input
                type="checkbox"
                checked={config.recordatorioSeguros}
                onChange={(e) => update('recordatorioSeguros', e.target.checked)}
                className="mt-0.5 size-4 rounded border-skyline-border text-skyline-blue focus:ring-skyline-blue"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Recordatorio de seguros</p>
                <p className="text-xs text-gray-500">Aviso antes del vencimiento</p>
              </div>
              <input
                type="number"
                min={1}
                max={30}
                value={config.diasAnticipacionSeguros}
                onChange={(e) => update('diasAnticipacionSeguros', Math.max(1, Math.min(30, Number(e.target.value) || 7)))}
                disabled={!config.recordatorioSeguros}
                className="w-16 rounded-md border border-skyline-border px-2 py-1.5 text-center text-sm disabled:bg-gray-100 disabled:text-gray-400"
              />
              <span className="self-center text-sm text-gray-500">días antes</span>
            </label>
            <label className="flex cursor-pointer items-start gap-4 rounded-lg border border-skyline-border p-4 transition-colors hover:bg-skyline-bg/30">
              <input
                type="checkbox"
                checked={config.resumenDiario}
                onChange={(e) => update('resumenDiario', e.target.checked)}
                className="mt-0.5 size-4 rounded border-skyline-border text-skyline-blue focus:ring-skyline-blue"
              />
              <div>
                <p className="font-medium text-gray-900">Resumen diario por email</p>
                <p className="text-xs text-gray-500">Rentas del día, check-ins pendientes y vencimientos</p>
              </div>
            </label>
          </div>
        </div>

        {/* Preferencias generales */}
        <div className="overflow-hidden rounded-xl border border-skyline-border bg-white shadow-sm">
          <div className="border-b border-skyline-border bg-skyline-bg/50 px-6 py-4">
            <h2 className="flex items-center gap-2.5 text-base font-semibold text-gray-900">
              <span className="flex size-9 items-center justify-center rounded-lg bg-skyline-blue/10">
                <Icon icon="mdi:cog-outline" className="size-5 text-skyline-blue" aria-hidden />
              </span>
              Preferencias generales
            </h2>
          </div>
          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <span className="w-40 shrink-0 text-sm font-medium text-gray-700">Zona horaria</span>
              <select
                value={config.zonaHoraria}
                onChange={(e) => update('zonaHoraria', e.target.value)}
                className="flex-1 rounded-lg border border-skyline-border px-3 py-2.5 text-sm outline-none focus:border-skyline-blue focus:ring-2 focus:ring-skyline-blue/20"
              >
                <option value="America/Mexico_City">Ciudad de México</option>
                <option value="America/Tijuana">Tijuana (Pacífico)</option>
                <option value="America/Monterrey">Monterrey (Centro)</option>
                <option value="America/Cancun">Cancún (Sureste)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <span className="w-40 shrink-0 text-sm font-medium text-gray-700">Formato de fecha</span>
              <select
                value={config.formatoFecha}
                onChange={(e) => update('formatoFecha', e.target.value)}
                className="flex-1 rounded-lg border border-skyline-border px-3 py-2.5 text-sm outline-none focus:border-skyline-blue focus:ring-2 focus:ring-skyline-blue/20"
              >
                <option value="DD/MM/YYYY">DD/MM/AAAA (31/12/2025)</option>
                <option value="MM/DD/YYYY">MM/DD/AAAA (12/31/2025)</option>
                <option value="YYYY-MM-DD">AAAA-MM-DD (2025-12-31)</option>
              </select>
            </label>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="overflow-hidden rounded-xl border border-skyline-border bg-white shadow-sm">
          <div className="border-b border-skyline-border bg-skyline-bg/50 px-6 py-4">
            <h2 className="flex items-center gap-2.5 text-base font-semibold text-gray-900">
              <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <Icon icon="mdi:link-variant" className="size-5 text-emerald-600" aria-hidden />
              </span>
              Accesos rápidos
            </h2>
          </div>
          <div className="grid gap-3 p-6 sm:grid-cols-2">
            <Link
              to="/usuarios"
              className="flex items-center gap-3 rounded-lg border border-skyline-border p-3 transition-colors hover:border-skyline-blue hover:bg-skyline-blue/5 no-underline"
            >
              <Icon icon="mdi:account-group" className="size-5 text-skyline-muted" aria-hidden />
              <span className="text-sm font-medium text-gray-900">Gestión de usuarios</span>
            </Link>
            <Link
              to="/unidades"
              className="flex items-center gap-3 rounded-lg border border-skyline-border p-3 transition-colors hover:border-skyline-blue hover:bg-skyline-blue/5 no-underline"
            >
              <Icon icon="mdi:car-side" className="size-5 text-skyline-muted" aria-hidden />
              <span className="text-sm font-medium text-gray-900">Control de unidades</span>
            </Link>
          </div>
        </div>

        {/* Sistema */}
        <div className="rounded-xl border border-skyline-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-gray-100">
                <Icon icon="mdi:information" className="size-5 text-gray-500" aria-hidden />
              </div>
              <div>
                <p className="font-medium text-gray-900">SKYLINE ERP</p>
                <p className="text-xs text-gray-500">Versión 1.0</p>
              </div>
            </div>
          </div>
        </div>

        {/* Botón guardar */}
        <div className="flex flex-wrap items-center gap-4 border-t border-skyline-border pt-6">
          <button
            type="submit"
            disabled={guardando}
            className="btn btn-primary"
          >
            <Icon icon="mdi:content-save" className="size-5" aria-hidden />
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {guardado && (
            <span className="flex items-center gap-2 text-sm font-medium text-emerald-600">
              <Icon icon="mdi:check-circle" className="size-5" aria-hidden />
              Configuración guardada
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
