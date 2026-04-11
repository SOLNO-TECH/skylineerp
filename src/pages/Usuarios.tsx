import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  CRUD_CELDA_SEC,
  CRUD_ERROR_BANNER,
  CRUD_FILTER_PILL,
  CRUD_FILTER_PILL_ACTIVE,
  CRUD_HEADER_ROW,
  CRUD_PAGE_SUBTITLE,
  CRUD_PAGE_TITLE,
  CRUD_SEARCH_INNER,
  CRUD_SEARCH_INPUT,
  CRUD_SEARCH_LABEL,
  CRUD_SPINNER,
  CRUD_SPINNER_WRAP,
  CRUD_TABLE,
  CRUD_TABLE_OUTER,
  CRUD_TBODY,
  CRUD_THEAD_TR,
  CRUD_TOOLBAR,
  CrudActionGroup,
  CrudActionIconButton,
  CrudTableTh,
  crudTableRowClass,
} from '../components/crud/crudCorporativo';
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
import {
  SIDEBAR_NAV_SECTIONS,
  SIDEBAR_PATHS_SELECCIONABLES,
} from '../nav/sidebarNav';

const ROLES_LABEL: Record<string, string> = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  operador_taller: 'Operador taller (check-in/out y mantenimiento)',
  consulta: 'Consulta',
};

type FiltroEstado = 'todos' | 'activos' | 'inactivos';

const ROL_ADMIN = 'administrador';

function ordenVistasSeleccion(paths: string[]): string[] {
  const order = [...SIDEBAR_PATHS_SELECCIONABLES];
  const set = new Set(paths);
  return order.filter((p) => set.has(p));
}

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
  /** administrador: «full» = todas las vistas (null en servidor); «custom» = subset. */
  const [adminMenuMode, setAdminMenuMode] = useState<'full' | 'custom'>('full');
  const [adminPathsSeleccion, setAdminPathsSeleccion] = useState<string[]>(() => [...SIDEBAR_PATHS_SELECCIONABLES]);
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
    setAdminMenuMode('full');
    setAdminPathsSeleccion([...SIDEBAR_PATHS_SELECCIONABLES]);
    setModalOpen(true);
  }

  function openEdit(u: UsuarioRow) {
    setEditingId(u.id);
    setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol, activo: !!u.activo });
    if (u.rol === ROL_ADMIN && u.vistasPermitidas && u.vistasPermitidas.length > 0) {
      setAdminMenuMode('custom');
      setAdminPathsSeleccion(ordenVistasSeleccion(u.vistasPermitidas));
    } else {
      setAdminMenuMode('full');
      setAdminPathsSeleccion([...SIDEBAR_PATHS_SELECCIONABLES]);
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  function computeVistasPermitidasPayload(): string[] | null {
    if (form.rol !== ROL_ADMIN) return null;
    if (adminMenuMode === 'full') return null;
    const sel = ordenVistasSeleccion(adminPathsSeleccion);
    if (sel.length === 0) return null;
    if (sel.length >= SIDEBAR_PATHS_SELECCIONABLES.length) return null;
    return sel;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.rol === ROL_ADMIN && adminMenuMode === 'custom') {
      const sel = ordenVistasSeleccion(adminPathsSeleccion);
      if (sel.length === 0) {
        toast('Selecciona al menos una vista del menú para este administrador.', 'error');
        return;
      }
    }
    setSaving(true);
    setError(null);
    const vistasPayload = computeVistasPermitidasPayload();
    const promise = editingId
      ? updateUsuario(editingId, {
          nombre: form.nombre,
          rol: form.rol,
          ...(form.password ? { password: form.password } : {}),
          activo: form.activo,
          vistasPermitidas: vistasPayload,
        })
      : createUsuario({
          nombre: form.nombre,
          email: form.email,
          password: form.password,
          rol: form.rol,
          ...(form.rol === ROL_ADMIN ? { vistasPermitidas: vistasPayload } : {}),
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
      <header className={CRUD_HEADER_ROW}>
        <div>
          <h1 className={CRUD_PAGE_TITLE}>Usuarios</h1>
          <p className={CRUD_PAGE_SUBTITLE}>
            Alta, roles y permisos. Busca por nombre o correo y filtra por rol o estado.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Icon icon="mdi:account-plus" className="size-5" aria-hidden />
          Nuevo usuario
        </button>
      </header>

      {error && <div className={CRUD_ERROR_BANNER}>{error}</div>}

      <div className={CRUD_TOOLBAR}>
        <div className="space-y-4">
          <div>
            <label className="block max-w-xl">
              <span className={CRUD_SEARCH_LABEL}>Buscar</span>
              <div className={CRUD_SEARCH_INNER}>
                <Icon icon="mdi:magnify" className="size-4 shrink-0 text-skyline-muted" aria-hidden />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre o correo electrónico…"
                  className={CRUD_SEARCH_INPUT}
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

          <div className="border-t border-slate-100 pt-3">
            <span className="mb-2 block text-xs font-medium text-gray-600">Rol</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFiltroRol('Todos')}
                className={filtroRol === 'Todos' ? CRUD_FILTER_PILL_ACTIVE : CRUD_FILTER_PILL}
              >
                Todos{' '}
                <span className={filtroRol === 'Todos' ? 'font-bold text-white/95' : 'font-medium text-gray-400'}>
                  ({conteosEstado.total})
                </span>
              </button>
              {roles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFiltroRol(r)}
                  className={filtroRol === r ? CRUD_FILTER_PILL_ACTIVE : CRUD_FILTER_PILL}
                >
                  {ROLES_LABEL[r] ?? r}{' '}
                  <span className={filtroRol === r ? 'font-bold text-white/95' : 'font-medium text-gray-400'}>
                    ({conteosRol[r] ?? 0})
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <span className="mb-2 block text-xs font-medium text-gray-600">Estado</span>
            <div className="flex flex-wrap gap-1.5">
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
                  className={filtroEstado === k ? CRUD_FILTER_PILL_ACTIVE : CRUD_FILTER_PILL}
                >
                  {label}{' '}
                  <span className={filtroEstado === k ? 'font-bold text-white/95' : 'font-medium text-gray-400'}>
                    ({n})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {!loading && (
          <p className="mt-3 text-xs leading-relaxed text-gray-600">
            <span className="font-semibold text-gray-900">
              {filtrados.length} de {usuarios.length}
            </span>{' '}
            usuarios
            {filtrados.length !== usuarios.length && (
              <span className="ml-2 inline-flex align-middle">
                <CrudActionGroup aria-label="Filtros">
                  <CrudActionIconButton
                    icon="mdi:filter-remove-outline"
                    title="Quitar filtros"
                    onClick={() => {
                      setBusqueda('');
                      setFiltroRol('Todos');
                      setFiltroEstado('todos');
                    }}
                  />
                </CrudActionGroup>
              </span>
            )}
          </p>
        )}
      </div>

      <div className={CRUD_TABLE_OUTER}>
        {loading ? (
          <div className={CRUD_SPINNER_WRAP}>
            <div className={CRUD_SPINNER} />
          </div>
        ) : (
          <table className={CRUD_TABLE}>
            <thead>
              <tr className={CRUD_THEAD_TR}>
                <CrudTableTh className="min-w-[8rem] px-2 py-3.5 text-center align-middle" icon="mdi:account-outline">
                  Nombre
                </CrudTableTh>
                <CrudTableTh className="min-w-[10rem] px-2 py-3.5 text-center align-middle" icon="mdi:email-outline">
                  Email
                </CrudTableTh>
                <CrudTableTh className="min-w-[7rem] px-2 py-3.5 text-center align-middle" icon="mdi:shield-account-outline">
                  Rol
                </CrudTableTh>
                <CrudTableTh className="min-w-[5rem] px-2 py-3.5 text-center align-middle" icon="mdi:toggle-switch-outline">
                  Estado
                </CrudTableTh>
                <CrudTableTh className="w-[1%] whitespace-nowrap px-2 py-3.5 text-center align-middle" icon="mdi:cog-outline">
                  Acciones
                </CrudTableTh>
              </tr>
            </thead>
            <tbody className={CRUD_TBODY}>
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                      {usuarios.length === 0 ? (
                        'No hay usuarios registrados. Crea el primero con «Nuevo usuario».'
                      ) : (
                        <>
                          Ningún usuario coincide con la búsqueda o los filtros.{' '}
                          <span className="inline-flex align-middle">
                            <CrudActionGroup aria-label="Filtros">
                              <CrudActionIconButton
                                icon="mdi:filter-remove-outline"
                                title="Limpiar filtros"
                                onClick={() => {
                                  setBusqueda('');
                                  setFiltroRol('Todos');
                                  setFiltroEstado('todos');
                                }}
                              />
                            </CrudActionGroup>
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                )}
                {filtrados.map((u, rowIdx) => (
                  <tr key={u.id} className={crudTableRowClass(rowIdx)}>
                    <td className="px-3 py-2.5 text-center align-middle font-sans text-[13px] font-semibold leading-normal text-slate-900 antialiased">
                      {u.nombre}
                    </td>
                    <td className={`px-3 py-2.5 text-center align-middle text-slate-600 ${CRUD_CELDA_SEC}`}>{u.email}</td>
                    <td className="px-3 py-2.5 text-center align-middle">
                      <div className="flex flex-col items-center gap-1">
                        <span className="inline-flex rounded-full bg-skyline-blue/10 px-2.5 py-0.5 text-xs font-medium capitalize text-skyline-blue">
                          {ROLES_LABEL[u.rol] ?? u.rol}
                        </span>
                        {u.rol === ROL_ADMIN && u.vistasPermitidas && u.vistasPermitidas.length > 0 ? (
                          <span className="inline-flex max-w-[11rem] items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                            <Icon icon="mdi:view-grid-outline" className="size-3 shrink-0" aria-hidden />
                            Menú limitado
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={`px-3 py-2.5 text-center align-middle ${CRUD_CELDA_SEC}`}>
                      {u.activo ? (
                        <span className="font-medium text-emerald-600">Activo</span>
                      ) : (
                        <span className="text-skyline-muted">Inactivo</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle">
                      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:flex-wrap">
                        {confirmDesactivar === u.id ? (
                          <>
                            <span className="text-xs text-gray-500">¿Desactivar usuario?</span>
                            <CrudActionGroup aria-label="Confirmar desactivación">
                              <CrudActionIconButton icon="mdi:close" title="Cancelar" onClick={() => setConfirmDesactivar(null)} />
                              <CrudActionIconButton
                                icon="mdi:account-off-outline"
                                title="Desactivar usuario"
                                danger
                                onClick={() => handleDesactivar(u.id)}
                              />
                            </CrudActionGroup>
                          </>
                        ) : confirmEliminar === u.id ? (
                          <>
                            <span className="max-w-[220px] text-center text-xs leading-snug text-gray-500 sm:text-right">
                              ¿Eliminar definitivamente? Esta acción no se puede deshacer.
                            </span>
                            <CrudActionGroup aria-label="Confirmar eliminación">
                              <CrudActionIconButton icon="mdi:close" title="Cancelar" onClick={() => setConfirmEliminar(null)} />
                              <CrudActionIconButton
                                icon="mdi:delete-forever-outline"
                                title="Eliminar definitivamente"
                                danger
                                onClick={() => handleEliminarDefinitivo(u.id)}
                              />
                            </CrudActionGroup>
                          </>
                        ) : (
                          <CrudActionGroup aria-label="Acciones del usuario">
                            <CrudActionIconButton
                              icon="mdi:pencil-outline"
                              title="Editar usuario"
                              onClick={() => {
                                setConfirmDesactivar(null);
                                setConfirmEliminar(null);
                                openEdit(u);
                              }}
                            />
                            {u.activo && u.id !== currentUser?.id && (
                              <CrudActionIconButton
                                icon="mdi:account-off-outline"
                                title="Desactivar usuario"
                                onClick={() => {
                                  setConfirmEliminar(null);
                                  setConfirmDesactivar(u.id);
                                }}
                              />
                            )}
                            {!u.activo && u.id !== currentUser?.id && (
                              <CrudActionIconButton
                                icon="mdi:delete-forever-outline"
                                title="Eliminar usuario definitivamente"
                                danger
                                onClick={() => {
                                  setConfirmDesactivar(null);
                                  setConfirmEliminar(u.id);
                                }}
                              />
                            )}
                          </CrudActionGroup>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && closeModal()}>
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-skyline-border bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold text-gray-900">
              {editingId ? 'Editar usuario' : 'Nuevo usuario'}
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              {form.rol === ROL_ADMIN
                ? 'Los administradores con menú personalizado solo ven las secciones que marques (sigue teniendo rol administrador en el sistema).'
                : 'Asigna rol y datos de acceso.'}
            </p>
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
                  onChange={(e) => {
                    const nextRol = e.target.value;
                    setForm((f) => ({ ...f, rol: nextRol }));
                    if (nextRol !== ROL_ADMIN) {
                      setAdminMenuMode('full');
                      setAdminPathsSeleccion([...SIDEBAR_PATHS_SELECCIONABLES]);
                    }
                  }}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>{ROLES_LABEL[r] ?? r}</option>
                  ))}
                </select>
              </label>

              {form.rol === ROL_ADMIN && (
                <div className="rounded-xl border border-skyline-border bg-gradient-to-br from-slate-50 to-sky-50/40 p-4 shadow-sm">
                  <div className="mb-3 flex items-start gap-2">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-skyline-blue/15 text-skyline-blue">
                      <Icon icon="mdi:view-dashboard-variant" className="size-5" aria-hidden />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Vistas del menú lateral</p>
                      <p className="text-xs text-slate-500">
                        Elige si ve todo el ERP o solo módulos concretos. El inicio y el perfil siempre están disponibles para quien inicia sesión.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-2 transition-colors hover:bg-white/80 has-[:checked]:border-skyline-blue/40 has-[:checked]:bg-white">
                      <input
                        type="radio"
                        name="adminMenuMode"
                        className="mt-1"
                        checked={adminMenuMode === 'full'}
                        onChange={() => {
                          setAdminMenuMode('full');
                          setAdminPathsSeleccion([...SIDEBAR_PATHS_SELECCIONABLES]);
                        }}
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-800">Acceso completo al menú</span>
                        <span className="block text-xs text-slate-500">Mismo comportamiento que un administrador clásico.</span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-2 transition-colors hover:bg-white/80 has-[:checked]:border-skyline-blue/40 has-[:checked]:bg-white">
                      <input
                        type="radio"
                        name="adminMenuMode"
                        className="mt-1"
                        checked={adminMenuMode === 'custom'}
                        onChange={() => setAdminMenuMode('custom')}
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-800">Personalizar secciones</span>
                        <span className="block text-xs text-slate-500">Activa o desactiva cada módulo con un toque.</span>
                      </span>
                    </label>
                  </div>

                  {adminMenuMode === 'custom' && (
                    <div className="mt-4 space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setAdminPathsSeleccion([...SIDEBAR_PATHS_SELECCIONABLES])}
                        >
                          Marcar todas
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setAdminPathsSeleccion(['/'])}
                        >
                          Solo inicio
                        </button>
                      </div>
                      {SIDEBAR_NAV_SECTIONS.map((section) => (
                        <div key={section.title}>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{section.title}</p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {section.items.map((item) => {
                              const on = adminPathsSeleccion.includes(item.path);
                              return (
                                <button
                                  key={item.path}
                                  type="button"
                                  onClick={() => {
                                    setAdminPathsSeleccion((prev) => {
                                      const wasOn = prev.includes(item.path);
                                      if (wasOn) {
                                        const next = prev.filter((p) => p !== item.path);
                                        if (next.length === 0) {
                                          toast('Debe quedar al menos una vista seleccionada.', 'error');
                                          return prev;
                                        }
                                        return ordenVistasSeleccion(next);
                                      }
                                      return ordenVistasSeleccion([...prev, item.path]);
                                    });
                                  }}
                                  className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                                    on
                                      ? 'border-skyline-blue bg-white shadow-md ring-1 ring-skyline-blue/20'
                                      : 'border-slate-200/80 bg-white/50 opacity-75 hover:border-slate-300 hover:opacity-100'
                                  }`}
                                >
                                  <span
                                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                                      on ? 'bg-skyline-blue text-white' : 'bg-slate-200 text-slate-600'
                                    }`}
                                  >
                                    <Icon icon={item.icon} className="size-5" aria-hidden />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-slate-800">{item.label}</span>
                                    <span className="block truncate font-mono text-[11px] text-slate-500">{item.path}</span>
                                  </span>
                                  <Icon
                                    icon={on ? 'mdi:check-circle' : 'mdi:circle-outline'}
                                    className={`size-6 shrink-0 ${on ? 'text-emerald-600' : 'text-slate-400'}`}
                                    aria-hidden
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
