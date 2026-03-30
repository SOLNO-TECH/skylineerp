import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  getUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  eliminarUsuarioDefinitivo,
  getRoles,
  type UsuarioRow,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const ROLES_LABEL: Record<string, string> = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  operador_taller: 'Operador taller (check-in/out y mantenimiento)',
  consulta: 'Consulta',
};

type FiltroEstado = 'todos' | 'activos' | 'inactivos';

export function Usuarios() {
  const { user: currentUser } = useAuth();
  const { toast } = useNotification();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<string>('Todos');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'operador', activo: true });
  const [saving, setSaving] = useState(false);
  const [confirmDesactivar, setConfirmDesactivar] = useState<number | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([getUsuarios(), getRoles()])
      .then(([u, r]) => {
        setUsuarios(u);
        setRoles(r);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const conteosRol = useMemo(() => {
    const m: Record<string, number> = {};
    for (const u of usuarios) {
      m[u.rol] = (m[u.rol] ?? 0) + 1;
    }
    return m;
  }, [usuarios]);

  const conteosEstado = useMemo(() => {
    let activos = 0;
    let inactivos = 0;
    for (const u of usuarios) {
      if (u.activo) activos += 1;
      else inactivos += 1;
    }
    return { activos, inactivos, total: usuarios.length };
  }, [usuarios]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      const coincideTexto =
        !q ||
        u.nombre.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      const coincideRol = filtroRol === 'Todos' || u.rol === filtroRol;
      const activo = !!u.activo;
      const coincideEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'activos' && activo) ||
        (filtroEstado === 'inactivos' && !activo);
      return coincideTexto && coincideRol && coincideEstado;
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado]);

  function openCreate() {
    setEditingId(null);
    setForm({ nombre: '', email: '', password: '', rol: 'operador', activo: true });
    setModalOpen(true);
  }

  function openEdit(u: UsuarioRow) {
    setEditingId(u.id);
    setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol, activo: !!u.activo });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const promise = editingId
      ? updateUsuario(editingId, {
          nombre: form.nombre,
          rol: form.rol,
          ...(form.password ? { password: form.password } : {}),
          activo: form.activo,
        })
      : createUsuario({
          nombre: form.nombre,
          email: form.email,
          password: form.password,
          rol: form.rol,
        });
    promise
      .then(() => {
        toast(editingId ? 'Usuario actualizado' : 'Usuario creado');
        load();
        closeModal();
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Error';
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => setSaving(false));
  }

  function handleDesactivar(id: number) {
    setError(null);
    deleteUsuario(id)
      .then(() => {
        toast('Usuario desactivado');
        load();
        setConfirmDesactivar(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error');
        toast(e instanceof Error ? e.message : 'Error', 'error');
      });
  }

  function handleEliminarDefinitivo(id: number) {
    setError(null);
    eliminarUsuarioDefinitivo(id)
      .then(() => {
        toast('Usuario eliminado definitivamente');
        load();
        setConfirmEliminar(null);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Error';
        setError(msg);
        toast(msg, 'error');
      });
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Usuarios</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Alta, roles y permisos. Busca por nombre o correo y filtra por rol o estado.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Icon icon="mdi:account-plus" className="size-5" aria-hidden />
          Nuevo usuario
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="mb-5 rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1 min-w-0">
            <label className="text-sm font-medium text-gray-700">
              Buscar
              <div className="mt-1 flex items-center gap-2 rounded-md border border-skyline-border bg-white px-3 py-2 transition-colors focus-within:border-skyline-blue focus-within:ring-1 focus-within:ring-skyline-blue">
                <Icon icon="mdi:magnify" className="size-5 shrink-0 text-skyline-muted" aria-hidden />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre o correo electrónico…"
                  className="w-full min-w-0 border-0 bg-transparent text-sm outline-none placeholder:text-gray-400"
                  autoComplete="off"
                />
                {busqueda.trim() !== '' && (
                  <button
                    type="button"
                    onClick={() => setBusqueda('')}
                    className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Limpiar búsqueda"
                  >
                    <Icon icon="mdi:close" className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Rol</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFiltroRol('Todos')}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    filtroRol === 'Todos'
                      ? 'border-skyline-blue bg-skyline-blue text-white'
                      : 'border-skyline-border bg-white text-gray-600 hover:border-skyline-blue hover:text-skyline-blue'
                  }`}
                >
                  Todos <span className={filtroRol === 'Todos' ? 'text-white/90' : 'text-gray-400'}>({conteosEstado.total})</span>
                </button>
                {roles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFiltroRol(r)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      filtroRol === r
                        ? 'border-skyline-blue bg-skyline-blue text-white'
                        : 'border-skyline-border bg-white text-gray-600 hover:border-skyline-blue hover:text-skyline-blue'
                    }`}
                  >
                    {ROLES_LABEL[r] ?? r}{' '}
                    <span className={filtroRol === r ? 'text-white/90' : 'text-gray-400'}>({conteosRol[r] ?? 0})</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { k: 'todos' as const, label: 'Todos', n: conteosEstado.total },
                    { k: 'activos' as const, label: 'Activos', n: conteosEstado.activos },
                    { k: 'inactivos' as const, label: 'Inactivos', n: conteosEstado.inactivos },
                  ]
                ).map(({ k, label, n }) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFiltroEstado(k)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      filtroEstado === k
                        ? 'border-skyline-blue bg-skyline-blue text-white'
                        : 'border-skyline-border bg-white text-gray-600 hover:border-skyline-blue hover:text-skyline-blue'
                    }`}
                  >
                    {label} <span className={filtroEstado === k ? 'text-white/90' : 'text-gray-400'}>({n})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {!loading && (
          <p className="mt-4 text-sm text-gray-500">
            Mostrando <span className="font-semibold text-gray-900">{filtrados.length}</span> de{' '}
            <span className="font-semibold text-gray-900">{usuarios.length}</span> usuarios
            {filtrados.length !== usuarios.length && (
              <button
                type="button"
                className="btn btn-outline btn-sm ml-2"
                onClick={() => {
                  setBusqueda('');
                  setFiltroRol('Todos');
                  setFiltroEstado('todos');
                }}
              >
                Quitar filtros
              </button>
            )}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-skyline-border bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-skyline-border border-t-skyline-blue" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-skyline-border bg-skyline-bg">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Rol</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      {usuarios.length === 0 ? (
                        'No hay usuarios registrados. Crea el primero con «Nuevo usuario».'
                      ) : (
                        <>
                          Ningún usuario coincide con la búsqueda o los filtros.{' '}
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setBusqueda('');
                              setFiltroRol('Todos');
                              setFiltroEstado('todos');
                            }}
                          >
                            Limpiar filtros
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )}
                {filtrados.map((u) => (
                  <tr key={u.id} className="border-b border-skyline-border last:border-0 hover:bg-skyline-blue/[0.04]">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-skyline-blue/10 px-2.5 py-0.5 text-xs font-medium capitalize text-skyline-blue">
                        {ROLES_LABEL[u.rol] ?? u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.activo ? (
                        <span className="text-emerald-600 font-medium">Activo</span>
                      ) : (
                        <span className="text-skyline-muted">Inactivo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {confirmDesactivar === u.id ? (
                          <>
                            <span className="text-xs text-gray-500">¿Desactivar usuario?</span>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setConfirmDesactivar(null)}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleDesactivar(u.id)}
                            >
                              <Icon icon="mdi:account-off-outline" className="size-4 shrink-0" aria-hidden />
                              Desactivar
                            </button>
                          </>
                        ) : confirmEliminar === u.id ? (
                          <>
                            <span className="max-w-[220px] text-right text-xs leading-snug text-gray-500">
                              ¿Eliminar definitivamente? Esta acción no se puede deshacer.
                            </span>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setConfirmEliminar(null)}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleEliminarDefinitivo(u.id)}
                            >
                              <Icon icon="mdi:delete-forever-outline" className="size-4 shrink-0" aria-hidden />
                              Eliminar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDesactivar(null);
                                setConfirmEliminar(null);
                                openEdit(u);
                              }}
                              title="Editar usuario"
                              className="btn btn-outline btn-sm"
                            >
                              <Icon icon="mdi:pencil-outline" className="size-4 shrink-0" aria-hidden />
                              Editar
                            </button>
                            {u.activo && u.id !== currentUser?.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmEliminar(null);
                                  setConfirmDesactivar(u.id);
                                }}
                                title="Desactivar usuario"
                                className="btn btn-outline-secondary btn-sm"
                              >
                                <Icon icon="mdi:account-off-outline" className="size-4 shrink-0" aria-hidden />
                                Desactivar
                              </button>
                            )}
                            {!u.activo && u.id !== currentUser?.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDesactivar(null);
                                  setConfirmEliminar(u.id);
                                }}
                                title="Eliminar usuario definitivamente"
                                className="btn btn-outline-danger btn-sm"
                              >
                                <Icon icon="mdi:delete-forever-outline" className="size-4 shrink-0" aria-hidden />
                                Eliminar
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && closeModal()}>
          <div
            className="w-full max-w-md rounded-lg border border-skyline-border bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {editingId ? 'Editar usuario' : 'Nuevo usuario'}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Nombre
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue disabled:bg-gray-100"
                  required
                  disabled={!!editingId}
                />
                {editingId && <span className="text-xs text-gray-500">El email no se puede cambiar</span>}
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Contraseña {editingId && <span className="text-xs font-normal text-gray-500">(dejar en blanco para no cambiar)</span>}
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  required={!editingId}
                  minLength={6}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Rol
                <select
                  value={form.rol}
                  onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>{ROLES_LABEL[r] ?? r}</option>
                  ))}
                </select>
              </label>
              {editingId && (
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                    className="rounded border-skyline-border text-skyline-blue focus:ring-skyline-blue"
                  />
                  Usuario activo
                </label>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" className="btn btn-outline" onClick={closeModal} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando…' : editingId ? 'Guardar' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
