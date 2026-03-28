import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotification } from '../context/NotificationContext';
import {
  getUnidades,
  createUnidad,
  updateUnidad,
  setEstatusUnidad,
  addDocumentoUnidad,
  addActividadUnidad,
  deleteUnidad,
  uploadImagenUnidad,
  deleteImagenUnidad,
  getImagenUrl,
  type UnidadRow,
} from '../api/client';

type Estatus = 'Disponible' | 'En Renta' | 'Taller';
type Tab = 'expediente' | 'documentos' | 'imagenes' | 'historial';

type DocTipo = 'Seguro' | 'Verificación' | 'Tarjeta' | 'Otro';

const defaultForm = {
  placas: '',
  marca: '',
  modelo: '',
  estatus: 'Disponible' as Estatus,
  observaciones: '',
  tipoUnidad: 'remolque_seco' as 'remolque_seco' | 'refrigerado' | 'maquinaria',
};

const TIPOS_UNIDAD = [
  { v: 'remolque_seco', l: 'Remolque seco' },
  { v: 'refrigerado', l: 'Refrigerado' },
  { v: 'maquinaria', l: 'Maquinaria' },
];

function statusPill(e: Estatus) {
  if (e === 'Disponible') return 'badge-disponible';
  if (e === 'En Renta') return 'badge-renta';
  return 'badge-taller';
}

export function Unidades() {
  const [unidades, setUnidades] = useState<UnidadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<Estatus | 'Todos'>('Todos');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('expediente');

  const [modalNueva, setModalNueva] = useState(false);
  const [formNueva, setFormNueva] = useState(defaultForm);
  const [savingNueva, setSavingNueva] = useState(false);

  const [modalEditar, setModalEditar] = useState(false);
  const [formEditar, setFormEditar] = useState(defaultForm);
  const [savingEditar, setSavingEditar] = useState(false);

  const [damageDesc, setDamageDesc] = useState('');
  const [newDoc, setNewDoc] = useState<{ tipo: DocTipo; nombre: string }>({ tipo: 'Otro', nombre: '' });
  const [uploading, setUploading] = useState(false);

  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imgDesc, setImgDesc] = useState('');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const { toast } = useNotification();
  const selected = useMemo(
    () => unidades.find((u) => u.id === selectedId) ?? null,
    [unidades, selectedId]
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getUnidades()
      .then(setUnidades)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Estatus, number> = { Disponible: 0, 'En Renta': 0, Taller: 0 };
    for (const u of unidades) c[u.estatus] += 1;
    return c;
  }, [unidades]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unidades.filter((u) => {
      const byStatus = filtro === 'Todos' ? true : u.estatus === filtro;
      const byText = q ? [u.placas, u.marca, u.modelo].some((x) => x.toLowerCase().includes(q)) : true;
      return byStatus && byText;
    });
  }, [unidades, filtro, search]);

  function openDrawer(id: string, nextTab: Tab = 'expediente') {
    setSelectedId(id);
    setTab(nextTab);
    setDrawerOpen(true);
    setDamageDesc('');
    setNewDoc({ tipo: 'Otro', nombre: '' });
    setLightboxImg(null);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function openNueva() {
    setFormNueva(defaultForm);
    setModalNueva(true);
    setError(null);
  }

  function openEditar(u: UnidadRow) {
    setFormEditar({
      placas: u.placas,
      marca: u.marca,
      modelo: u.modelo,
      estatus: u.estatus,
      observaciones: u.observaciones || '',
      tipoUnidad: (u.tipoUnidad ?? 'remolque_seco') as 'remolque_seco' | 'refrigerado' | 'maquinaria',
    });
    setModalEditar(true);
    setSelectedId(u.id);
    setError(null);
  }

  function handleCreateUnidad(e: React.FormEvent) {
    e.preventDefault();
    setSavingNueva(true);
    setError(null);
    createUnidad({
      placas: formNueva.placas.trim(),
      marca: formNueva.marca.trim(),
      modelo: formNueva.modelo.trim(),
      estatus: formNueva.estatus,
      observaciones: formNueva.observaciones.trim(),
      tipoUnidad: formNueva.tipoUnidad,
    })
      .then((u) => {
        toast('Unidad creada correctamente');
        load();
        setModalNueva(false);
        openDrawer(u.id, 'expediente');
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Error';
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => setSavingNueva(false));
  }

  function handleEditarUnidad(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSavingEditar(true);
    setError(null);
    updateUnidad(selectedId, {
      placas: formEditar.placas.trim(),
      marca: formEditar.marca.trim(),
      modelo: formEditar.modelo.trim(),
      estatus: formEditar.estatus,
      observaciones: formEditar.observaciones.trim(),
      tipoUnidad: formEditar.tipoUnidad,
    })
      .then((u) => {
        toast('Unidad actualizada');
        setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
        setModalEditar(false);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Error';
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => setSavingEditar(false));
  }

  function handleSetEstatus(id: string, next: Estatus) {
    setEstatusUnidad(id, next)
      .then((u) => {
        toast(`Estatus actualizado a ${next}`);
        setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error');
        toast(e instanceof Error ? e.message : 'Error', 'error');
      });
  }

  function handleUpdateObservaciones(id: string, obs: string) {
    updateUnidad(id, { observaciones: obs })
      .then((u) => setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x))))
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'));
  }

  function handleAddDamage() {
    if (!selected || !damageDesc.trim()) return;
    addActividadUnidad(selected.id, 'Daño / Observación registrada', damageDesc.trim(), 'mdi:alert-circle-outline')
      .then((u) => {
        toast('Observación registrada');
        setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
        setDamageDesc('');
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error');
        toast(e instanceof Error ? e.message : 'Error', 'error');
      });
  }

  async function handleAddDocument() {
    if (!selected) return;
    const nombre = newDoc.nombre.trim();
    if (!nombre) return;
    setUploading(true);
    setError(null);
    addDocumentoUnidad(selected.id, newDoc.tipo, nombre)
      .then((u) => {
        toast('Documento agregado');
        setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
        setNewDoc({ tipo: 'Otro', nombre: '' });
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error');
        toast(e instanceof Error ? e.message : 'Error', 'error');
      })
      .finally(() => setUploading(false));
  }

  function handleUploadImagen(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selected || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploadingImg(true);
    setError(null);
    uploadImagenUnidad(selected.id, file, imgDesc.trim() || undefined)
      .then((u) => {
        toast('Imagen subida correctamente');
        setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
        setImgDesc('');
        e.target.value = '';
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error');
        toast(err instanceof Error ? err.message : 'Error', 'error');
      })
      .finally(() => setUploadingImg(false));
  }

  function handleDeleteImagen(imgId: string) {
    if (!selected) return;
    setError(null);
    deleteImagenUnidad(selected.id, imgId)
      .then((u) => {
        toast('Imagen eliminada');
        setUnidades((prev) => prev.map((x) => (x.id === u.id ? u : x)));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error');
        toast(err instanceof Error ? err.message : 'Error', 'error');
      });
  }

  function handleEliminarUnidad(id: string) {
    setError(null);
    deleteUnidad(id)
      .then(() => {
        toast('Unidad eliminada');
        load();
        setConfirmEliminar(null);
        if (selectedId === id) closeDrawer();
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error');
        toast(e instanceof Error ? e.message : 'Error', 'error');
      });
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Control de Unidades</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Administra inventario, expedientes, documentos y estatus en tiempo real.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNueva}>
          <Icon icon="mdi:plus" className="size-5" aria-hidden />
          Nueva unidad
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-5 rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700">
              Buscar
              <div className="mt-1 flex items-center gap-2">
                <Icon icon="mdi:magnify" className="size-4 text-skyline-muted" aria-hidden />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Placas, marca o modelo…"
                  className="w-full rounded-md border border-skyline-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                />
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Estatus:</span>
            {(['Todos', 'Disponible', 'En Renta', 'Taller'] as const).map((opt) => {
              const isActive = filtro === opt;
              const count =
                opt === 'Todos' ? unidades.length : opt === 'Disponible' ? counts.Disponible : opt === 'En Renta' ? counts['En Renta'] : counts.Taller;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFiltro(opt)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-skyline-blue bg-skyline-blue text-white'
                      : 'border-skyline-border bg-white text-gray-500 hover:border-skyline-blue hover:text-skyline-blue'
                  }`}
                >
                  {opt} <span className={isActive ? 'text-white/90' : 'text-gray-400'}>({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-gray-500">
            Mostrando <span className="font-semibold text-gray-900">{filtered.length}</span> de{' '}
            <span className="font-semibold text-gray-900">{unidades.length}</span> unidades
          </span>
          <span className="text-sm text-gray-500">
            Haz clic en una fila o en <span className="font-semibold">Expediente</span> para ver documentos y registrar novedades.
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-skyline-border bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-skyline-border border-t-skyline-blue" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-skyline-border bg-skyline-bg">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Placas</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Marca</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Modelo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Estatus</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="cursor-pointer border-b border-skyline-border last:border-0 hover:bg-skyline-blue/5"
                  onClick={() => openDrawer(u.id, 'expediente')}
                >
                  <td className="px-4 py-3 font-semibold text-gray-900">{u.placas}</td>
                  <td className="px-4 py-3 text-gray-700">{u.marca}</td>
                  <td className="px-4 py-3 text-gray-700">{u.modelo}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${statusPill(u.estatus)}`}>{u.estatus}</span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openDrawer(u.id, 'expediente')}
                        className="btn btn-outline btn-sm"
                      >
                        <Icon icon="mdi:folder" className="size-4" aria-hidden />
                        Expediente
                      </button>
                      <button
                        type="button"
                        onClick={() => openDrawer(u.id, 'documentos')}
                        className="btn btn-outline-secondary btn-sm"
                      >
                        <Icon icon="mdi:file-document-outline" className="size-4" aria-hidden />
                        Documentos
                      </button>
                      <button
                        type="button"
                        onClick={() => openDrawer(u.id, 'imagenes')}
                        className="btn btn-outline-secondary btn-sm"
                      >
                        <Icon icon="mdi:image-multiple" className="size-4" aria-hidden />
                        Imágenes
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditar(u);
                        }}
                        className="btn btn-outline btn-sm"
                        title="Editar datos"
                      >
                        <Icon icon="mdi:pencil" className="size-4" aria-hidden />
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                    {unidades.length === 0
                      ? 'No hay unidades. Haz clic en "Nueva unidad" para agregar la primera.'
                      : 'No hay unidades con esos filtros.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Nueva unidad */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !savingNueva && setModalNueva(false)}>
          <div
            className="w-full max-w-md rounded-lg border border-skyline-border bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Nueva unidad</h2>
            <form onSubmit={handleCreateUnidad} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Placas *
                <input
                  type="text"
                  value={formNueva.placas}
                  onChange={(e) => setFormNueva((f) => ({ ...f, placas: e.target.value.toUpperCase() }))}
                  placeholder="ABC-12-34"
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  required
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Marca *
                  <input
                    type="text"
                    value={formNueva.marca}
                    onChange={(e) => setFormNueva((f) => ({ ...f, marca: e.target.value }))}
                    placeholder="Toyota"
                    className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Modelo *
                  <input
                    type="text"
                    value={formNueva.modelo}
                    onChange={(e) => setFormNueva((f) => ({ ...f, modelo: e.target.value }))}
                    placeholder="Hilux"
                    className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    required
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Tipo de unidad
                <select
                  value={formNueva.tipoUnidad}
                  onChange={(e) => setFormNueva((f) => ({ ...f, tipoUnidad: e.target.value as 'remolque_seco' | 'refrigerado' | 'maquinaria' }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                >
                  {TIPOS_UNIDAD.map((t) => (
                    <option key={t.v} value={t.v}>{t.l}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Estatus
                <select
                  value={formNueva.estatus}
                  onChange={(e) => setFormNueva((f) => ({ ...f, estatus: e.target.value as Estatus }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                >
                  {(['Disponible', 'En Renta', 'Taller'] as Estatus[]).map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Observaciones
                <textarea
                  value={formNueva.observaciones}
                  onChange={(e) => setFormNueva((f) => ({ ...f, observaciones: e.target.value }))}
                  placeholder="Notas iniciales..."
                  rows={2}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                />
              </label>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" className="btn btn-outline" onClick={() => setModalNueva(false)} disabled={savingNueva}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingNueva}>
                  {savingNueva ? 'Guardando…' : 'Crear unidad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar unidad */}
      {modalEditar && selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !savingEditar && setModalEditar(false)}>
          <div
            className="w-full max-w-md rounded-lg border border-skyline-border bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Editar unidad</h2>
            <form onSubmit={handleEditarUnidad} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Tipo de unidad
                <select
                  value={formEditar.tipoUnidad}
                  onChange={(e) => setFormEditar((f) => ({ ...f, tipoUnidad: e.target.value as 'remolque_seco' | 'refrigerado' | 'maquinaria' }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                >
                  {TIPOS_UNIDAD.map((t) => (
                    <option key={t.v} value={t.v}>{t.l}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Placas *
                <input
                  type="text"
                  value={formEditar.placas}
                  onChange={(e) => setFormEditar((f) => ({ ...f, placas: e.target.value.toUpperCase() }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                  required
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Marca *
                  <input
                    type="text"
                    value={formEditar.marca}
                    onChange={(e) => setFormEditar((f) => ({ ...f, marca: e.target.value }))}
                    className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Modelo *
                  <input
                    type="text"
                    value={formEditar.modelo}
                    onChange={(e) => setFormEditar((f) => ({ ...f, modelo: e.target.value }))}
                    className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    required
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Estatus
                <select
                  value={formEditar.estatus}
                  onChange={(e) => setFormEditar((f) => ({ ...f, estatus: e.target.value as Estatus }))}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                >
                  {(['Disponible', 'En Renta', 'Taller'] as Estatus[]).map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Observaciones
                <textarea
                  value={formEditar.observaciones}
                  onChange={(e) => setFormEditar((f) => ({ ...f, observaciones: e.target.value }))}
                  rows={2}
                  className="rounded-md border border-skyline-border px-3 py-2 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                />
              </label>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" className="btn btn-outline" onClick={() => setModalEditar(false)} disabled={savingEditar}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEditar}>
                  {savingEditar ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} />
          <div className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="border-b border-skyline-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-skyline-blue/10 text-skyline-blue">
                      <Icon icon="mdi:car-side" className="size-5" aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Unidad {selected.placas}</h2>
                      <p className="mt-0.5 text-sm font-medium text-gray-500">
                        {selected.marca} · {selected.modelo}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`badge ${statusPill(selected.estatus)}`}>{selected.estatus}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditar(selected)}
                    className="btn btn-outline btn-sm inline-flex !size-9 items-center justify-center !gap-0 !p-0"
                    title="Editar unidad"
                  >
                    <Icon icon="mdi:pencil" className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmEliminar(selected.id)}
                    className="btn btn-outline-danger btn-sm inline-flex !size-9 items-center justify-center !gap-0 !p-0"
                    title="Eliminar unidad"
                  >
                    <Icon icon="mdi:delete-outline" className="size-4" aria-hidden />
                  </button>
                  <button type="button" onClick={closeDrawer} className="btn btn-outline-secondary btn-sm">
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(
                  [
                    { k: 'expediente' as Tab, label: 'Expediente' },
                    { k: 'documentos' as Tab, label: 'Documentos' },
                    { k: 'imagenes' as Tab, label: 'Imágenes' },
                    { k: 'historial' as Tab, label: 'Historial' },
                  ]
                ).map((t) => {
                  const active = tab === t.k;
                  return (
                    <button
                      key={t.k}
                      type="button"
                      onClick={() => setTab(t.k)}
                      className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                        active ? 'bg-skyline-blue text-white' : 'bg-white text-gray-600 hover:bg-skyline-blue/5 hover:text-skyline-blue'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'expediente' && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-skyline-border bg-skyline-bg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-gray-900">Cambiar estatus</h3>
                      <span className="text-xs font-semibold uppercase tracking-wider text-skyline-muted">Acción rápida</span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {(['Disponible', 'En Renta', 'Taller'] as Estatus[]).map((e) => {
                        const active = selected.estatus === e;
                        return (
                          <button
                            key={e}
                            type="button"
                            onClick={() => handleSetEstatus(selected.id, e)}
                            className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                              active
                                ? 'border-skyline-blue bg-skyline-blue/10 text-skyline-blue'
                                : 'border-skyline-border bg-white text-gray-700 hover:border-skyline-blue hover:text-skyline-blue'
                            }`}
                          >
                            {e}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Observaciones</h3>
                    <p className="mt-1 text-xs font-medium text-gray-500">Notas del expediente. Se guardan al salir del campo.</p>
                    <textarea
                      value={selected.observaciones}
                      onChange={(e) => {
                        const v = e.target.value;
                        setUnidades((prev) =>
                          prev.map((x) => (x.id === selected.id ? { ...x, observaciones: v } : x))
                        );
                      }}
                      onBlur={(e) => handleUpdateObservaciones(selected.id, e.target.value)}
                      className="mt-3 min-h-[90px] w-full resize-none rounded-md border border-skyline-border px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                    />
                  </div>

                  <div className="rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Registrar daño / novedad</h3>
                    <p className="mt-1 text-xs font-medium text-gray-500">Agrega un evento al historial.</p>
                    <label className="mt-4 block text-sm font-medium text-gray-700">
                      Descripción
                      <textarea
                        value={damageDesc}
                        onChange={(e) => setDamageDesc(e.target.value)}
                        placeholder="Ej. Rayón en puerta trasera, se toma foto."
                        className="mt-2 min-h-[90px] w-full resize-none rounded-md border border-skyline-border px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                      />
                    </label>
                    <div className="mt-4 flex justify-end gap-2">
                      <button type="button" onClick={() => setDamageDesc('')} className="btn btn-outline">
                        Limpiar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddDamage}
                        disabled={!damageDesc.trim()}
                        className={`btn btn-primary ${!damageDesc.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Icon icon="mdi:plus" className="size-5" aria-hidden />
                        Registrar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'documentos' && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Agregar documento</h3>
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      Registra el nombre del documento (archivo físico o digital).
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                        Tipo
                        <select
                          value={newDoc.tipo}
                          onChange={(e) => setNewDoc((d) => ({ ...d, tipo: e.target.value as DocTipo }))}
                          className="rounded-md border border-skyline-border bg-white px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                        >
                          {(['Seguro', 'Verificación', 'Tarjeta', 'Otro'] as DocTipo[]).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                        Nombre del archivo
                        <input
                          value={newDoc.nombre}
                          onChange={(e) => setNewDoc((d) => ({ ...d, nombre: e.target.value }))}
                          placeholder="Ej. Seguro_ABC-12-34.pdf"
                          className="rounded-md border border-skyline-border px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button type="button" onClick={() => setNewDoc({ tipo: 'Otro', nombre: '' })} className="btn btn-outline" disabled={uploading}>
                        Limpiar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddDocument}
                        disabled={uploading || !newDoc.nombre.trim()}
                        className={`btn btn-primary ${uploading || !newDoc.nombre.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {uploading ? 'Guardando…' : (
                          <>
                            <Icon icon="mdi:upload" className="size-5" aria-hidden />
                            Agregar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-skyline-border bg-skyline-bg p-4">
                    <h3 className="text-sm font-semibold text-gray-900">Documentos registrados</h3>
                    <ul className="mt-3 space-y-2">
                      {selected.documentos.length === 0 && (
                        <li className="text-sm text-gray-500">No hay documentos.</li>
                      )}
                      {selected.documentos.map((d) => (
                        <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-skyline-border bg-white px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">{d.nombre}</p>
                            <p className="text-xs text-gray-500">{d.tipo}</p>
                          </div>
                          <span className="text-xs font-semibold text-skyline-muted">
                            {new Date(d.fechaSubida).toLocaleDateString('es-MX')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {tab === 'imagenes' && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Subir imagen</h3>
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      JPG, PNG, GIF o WebP. Máx. 10 MB. Ideal para inventario fotográfico, daños o estado general.
                    </p>
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                        Archivo
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={handleUploadImagen}
                          disabled={uploadingImg}
                          className="block w-full max-w-xs text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-skyline-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:hover:bg-skyline-blue-hover"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                        Descripción (opcional)
                        <input
                          type="text"
                          value={imgDesc}
                          onChange={(e) => setImgDesc(e.target.value)}
                          placeholder="Ej. Vista frontal, daño puerta"
                          className="w-48 rounded-md border border-skyline-border px-3 py-2 text-sm outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                        />
                      </label>
                      {uploadingImg && (
                        <span className="text-sm text-skyline-muted">Subiendo…</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-skyline-border bg-skyline-bg p-4">
                    <h3 className="text-sm font-semibold text-gray-900">Galería de imágenes</h3>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {(selected.imagenes ?? []).length === 0 ? (
                        <div className="col-span-full rounded-lg border-2 border-dashed border-skyline-border bg-white py-12 text-center text-sm text-gray-500">
                          No hay imágenes. Sube la primera para el inventario fotográfico.
                        </div>
                      ) : (
                        (selected.imagenes ?? []).map((img) => (
                          <div
                            key={img.id}
                            className="group relative overflow-hidden rounded-lg border border-skyline-border bg-white shadow-sm"
                          >
                            <button
                              type="button"
                              onClick={() => setLightboxImg(getImagenUrl(img.ruta))}
                              className="block w-full aspect-square overflow-hidden"
                            >
                              <img
                                src={getImagenUrl(img.ruta)}
                                alt={img.descripcion || img.nombreArchivo}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                            </button>
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                              <p className="truncate text-xs font-medium text-white">
                                {img.descripcion || img.nombreArchivo}
                              </p>
                              <p className="text-[10px] text-white/80">
                                {new Date(img.fechaSubida).toLocaleDateString('es-MX')}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteImagen(img.id)}
                              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
                              title="Eliminar imagen"
                            >
                              <Icon icon="mdi:close" className="size-4" aria-hidden />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'historial' && (
                <div className="rounded-lg border border-skyline-border bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900">Actividad</h3>
                  <p className="mt-1 text-xs font-medium text-gray-500">Registro de eventos del expediente.</p>
                  <ul className="mt-4 space-y-0 divide-y divide-skyline-border">
                    {selected.actividad.length === 0 ? (
                      <li className="py-6 text-center text-sm text-gray-500">Sin actividad aún.</li>
                    ) : (
                      selected.actividad.map((a) => (
                        <li key={a.id} className="flex gap-3 py-4">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-skyline-blue/10 text-skyline-blue">
                            <Icon icon={a.icon} className="size-4" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">{a.accion}</p>
                            <p className="mt-0.5 text-xs text-gray-500">{a.detalle}</p>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-skyline-muted">
                            {new Date(a.fecha).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox imagen */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxImg(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImg(null)}
            className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Cerrar"
          >
            <Icon icon="mdi:close" className="size-6" aria-hidden />
          </button>
          <img
            src={lightboxImg}
            alt="Vista ampliada"
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Confirmar eliminar */}
      {confirmEliminar && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-skyline-border bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">¿Eliminar unidad?</h3>
            <p className="mt-2 text-sm text-gray-600">
              La unidad se desactivará y dejará de aparecer en el inventario. Esta acción no se puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmEliminar(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-outline-danger" onClick={() => handleEliminarUnidad(confirmEliminar)}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
