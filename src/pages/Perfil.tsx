import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  getPerfil,
  updatePerfil,
  uploadAvatarPerfil,
  deleteAvatarPerfil,
  getAvatarUrl,
  type PerfilData,
} from '../api/client';

const ROL_LABEL: Record<string, string> = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  operador_taller: 'Operador taller',
  consulta: 'Consulta',
};

export function Perfil() {
  const { user, refreshUser } = useAuth();
  const { toast } = useNotification();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    nombre: '',
    apellidos: '',
    rfc: '',
    curp: '',
    telefono: '',
  });

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    getPerfil()
      .then((p) => {
        setPerfil(p);
        setForm({
          nombre: p.nombre || '',
          apellidos: p.apellidos || '',
          rfc: p.rfc || '',
          curp: p.curp || '',
          telefono: p.telefono || '',
        });
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error');
        // Fallback: usar datos básicos del usuario autenticado
        const fallback: PerfilData = {
          ...user,
          apellidos: '',
          rfc: '',
          curp: '',
          telefono: '',
        };
        setPerfil(fallback);
        setForm({ nombre: user.nombre || '', apellidos: '', rfc: '', curp: '', telefono: '' });
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (user) load();
    else {
      setLoading(false);
      setPerfil(null);
    }
  }, [user, load]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    updatePerfil(form)
      .then((p) => {
        toast('Perfil actualizado');
        setPerfil(p);
        setEditing(false);
        refreshUser();
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Error';
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => setSaving(false));
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !perfil) return;
    setUploadingAvatar(true);
    setError(null);
    uploadAvatarPerfil(file)
      .then((p) => {
        toast('Foto de perfil actualizada');
        setPerfil(p);
        refreshUser();
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Error';
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => {
        setUploadingAvatar(false);
        e.target.value = '';
      });
  }

  function handleRemoveAvatar() {
    if (!perfil?.avatar?.trim()) return;
    if (!confirm('¿Quitar la foto de perfil? Volverá a mostrarse la inicial de tu nombre.')) return;
    setDeletingAvatar(true);
    setError(null);
    deleteAvatarPerfil()
      .then((p) => {
        toast('Foto de perfil eliminada');
        setPerfil(p);
        refreshUser();
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Error';
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => setDeletingAvatar(false));
  }

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-gray-500">No hay sesión activa.</p>
      </div>
    );
  }

  if (loading || !perfil) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-skyline-border border-t-skyline-blue" />
      </div>
    );
  }

  const nombreCompleto = [perfil.nombre, perfil.apellidos].filter(Boolean).join(' ') || perfil.nombre;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Mi perfil</h1>
        <p className="mt-1 text-sm font-medium text-gray-500">
          Datos de tu cuenta en SKYLINE ERP
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-skyline-border bg-white shadow-sm overflow-hidden">
        <div className="border-b border-skyline-border bg-skyline-blue/5 px-6 py-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="relative group">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar || deletingAvatar}
                title="Cambiar foto de perfil"
                className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-skyline-blue text-2xl font-bold text-white ring-2 ring-white ring-offset-2 transition-all hover:ring-skyline-blue hover:ring-offset-4 disabled:opacity-50"
              >
                {perfil.avatar ? (
                  <img
                    src={getAvatarUrl(perfil.avatar)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  nombreCompleto.charAt(0).toUpperCase()
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Icon icon="mdi:camera" className="size-8 text-white" aria-hidden />
                  <span className="text-[10px] font-medium text-white/95">Cambiar</span>
                </div>
              </button>
              <div className="absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-full border-2 border-white bg-skyline-blue shadow-md">
                <Icon icon="mdi:camera-plus" className="size-4 text-white" aria-hidden />
              </div>
              {perfil.avatar?.trim() && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveAvatar();
                  }}
                  disabled={uploadingAvatar || deletingAvatar}
                  title="Quitar foto de perfil"
                  className="absolute -bottom-0.5 -left-0.5 flex size-8 items-center justify-center rounded-full border-2 border-white bg-white text-red-600 shadow-md transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <Icon icon="mdi:trash-can-outline" className="size-4" aria-hidden />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
              {(uploadingAvatar || deletingAvatar) && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              )}
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-xl font-semibold text-gray-900">{nombreCompleto}</h2>
              <p className="mt-0.5 text-sm font-medium capitalize text-skyline-muted">
                {ROL_LABEL[perfil.rol] ?? perfil.rol}
              </p>
              <p className="mt-1 text-sm text-gray-500">{perfil.email}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <dl className="divide-y divide-skyline-border">
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Nombre(s)</dt>
              <dd className="mt-1 sm:col-span-2 sm:mt-0">
                {editing ? (
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                    className="w-full rounded-md border border-skyline-border px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    placeholder="Nombre(s)"
                  />
                ) : (
                  <span className="text-sm text-gray-900">{perfil.nombre || '—'}</span>
                )}
              </dd>
            </div>
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Apellidos</dt>
              <dd className="mt-1 sm:col-span-2 sm:mt-0">
                {editing ? (
                  <input
                    type="text"
                    value={form.apellidos}
                    onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
                    className="w-full rounded-md border border-skyline-border px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    placeholder="Apellido paterno y materno"
                  />
                ) : (
                  <span className="text-sm text-gray-900">{perfil.apellidos || '—'}</span>
                )}
              </dd>
            </div>
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Correo electrónico</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{perfil.email}</dd>
            </div>
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">RFC</dt>
              <dd className="mt-1 sm:col-span-2 sm:mt-0">
                {editing ? (
                  <input
                    type="text"
                    value={form.rfc}
                    onChange={(e) => setForm((f) => ({ ...f, rfc: e.target.value.toUpperCase() }))}
                    maxLength={13}
                    className="w-full rounded-md border border-skyline-border px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    placeholder="XAXX010101XXX"
                  />
                ) : (
                  <span className="text-sm text-gray-900">{perfil.rfc || '—'}</span>
                )}
              </dd>
            </div>
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">CURP</dt>
              <dd className="mt-1 sm:col-span-2 sm:mt-0">
                {editing ? (
                  <input
                    type="text"
                    value={form.curp}
                    onChange={(e) => setForm((f) => ({ ...f, curp: e.target.value.toUpperCase() }))}
                    maxLength={18}
                    className="w-full rounded-md border border-skyline-border px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    placeholder="XAXX010101HDFXXX00"
                  />
                ) : (
                  <span className="text-sm text-gray-900">{perfil.curp || '—'}</span>
                )}
              </dd>
            </div>
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Teléfono</dt>
              <dd className="mt-1 sm:col-span-2 sm:mt-0">
                {editing ? (
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                    className="w-full rounded-md border border-skyline-border px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    placeholder="55 1234 5678"
                  />
                ) : (
                  <span className="text-sm text-gray-900">{perfil.telefono || '—'}</span>
                )}
              </dd>
            </div>
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Rol</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                {ROL_LABEL[perfil.rol] ?? perfil.rol}
              </dd>
            </div>
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">ID de usuario</dt>
              <dd className="mt-1 text-sm text-gray-500 sm:col-span-2 sm:mt-0">#{perfil.id}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-skyline-border bg-skyline-bg px-6 py-4">
            <Link
              to="/configuracion"
              className="inline-flex items-center gap-2.5 rounded-lg border border-skyline-border bg-white px-4 py-2.5 text-sm font-semibold text-skyline-blue shadow-sm transition-all hover:border-skyline-blue hover:bg-skyline-blue/5 hover:shadow-md no-underline"
            >
              <span className="flex size-8 items-center justify-center rounded-md bg-skyline-blue/10">
                <Icon icon="mdi:cog" className="size-4 text-skyline-blue" aria-hidden />
              </span>
              Ir a Configuración
              <Icon icon="mdi:arrow-right" className="size-4 opacity-70" aria-hidden />
            </Link>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="btn btn-outline"
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="btn btn-primary"
                >
                  <Icon icon="mdi:pencil" className="size-4" aria-hidden />
                  Editar perfil
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
