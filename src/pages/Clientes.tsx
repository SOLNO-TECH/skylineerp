import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useNotification } from '../context/NotificationContext';
import {
  getClientes,
  getCliente,
  createCliente,
  updateCliente,
  deleteCliente,
  uploadDocumentoCliente,
  deleteDocumentoCliente,
  getDocumentoUrl,
  type ClienteDetalle,
  type ClienteListRow,
} from '../api/client';

const TIPOS_DOC = [
  { v: 'ine', l: 'INE / identificación oficial' },
  { v: 'contrato', l: 'Contrato' },
  { v: 'acta_constitutiva', l: 'Acta constitutiva' },
  { v: 'comprobante_domicilio', l: 'Comprobante de domicilio' },
  { v: 'poder_notarial', l: 'Poder notarial' },
  { v: 'cedula_fiscal', l: 'Constancia fiscal (CSF)' },
  { v: 'otro', l: 'Otro' },
] as const;

function etiquetaTipoDoc(tipo: string) {
  return TIPOS_DOC.find((x) => x.v === tipo)?.l ?? tipo;
}

function nombreMostrar(c: Pick<ClienteListRow, 'nombreComercial' | 'razonSocial'>) {
  const n = c.nombreComercial?.trim() || c.razonSocial?.trim();
  return n || '(sin nombre)';
}

function formatearFecha(s: string) {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

type FormCliente = {
  tipo: 'persona_fisica' | 'persona_moral';
  nombreComercial: string;
  razonSocial: string;
  rfc: string;
  curp: string;
  representanteLegal: string;
  telefono: string;
  email: string;
  direccion: string;
  notas: string;
};

const formVacio: FormCliente = {
  tipo: 'persona_moral',
  nombreComercial: '',
  razonSocial: '',
  rfc: '',
  curp: '',
  representanteLegal: '',
  telefono: '',
  email: '',
  direccion: '',
  notas: '',
};

/** Texto único para buscar en todos los campos visibles del listado. */
function textoIndexableCliente(c: ClienteListRow): string {
  const tipoLabel = c.tipo === 'persona_fisica' ? 'persona física fisica' : 'persona moral';
  return [
    c.id,
    c.nombreComercial,
    c.razonSocial,
    c.rfc,
    c.curp,
    c.representanteLegal,
    c.telefono,
    c.email,
    c.direccion,
    c.notas,
    tipoLabel,
    String(c.docCount ?? ''),
    String(c.rentasVinculadas ?? ''),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function coincideBusquedaCliente(c: ClienteListRow, qRaw: string): boolean {
  const q = qRaw.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const hay = textoIndexableCliente(c);
  return tokens.every((tok) => hay.includes(tok));
}

function ClientesListPage() {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [lista, setLista] = useState<ClienteListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDocs, setFiltroDocs] = useState('');
  const [filtroRentas, setFiltroRentas] = useState('');
  const [filtroRfc, setFiltroRfc] = useState('');
  const [filtroCurp, setFiltroCurp] = useState('');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [form, setForm] = useState<FormCliente>(formVacio);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getClientes()
      .then(setLista)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar clientes'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hayFiltros =
    !!busqueda.trim() ||
    !!filtroTipo ||
    !!filtroDocs ||
    !!filtroRentas ||
    !!filtroRfc ||
    !!filtroCurp;

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroTipo('');
    setFiltroDocs('');
    setFiltroRentas('');
    setFiltroRfc('');
    setFiltroCurp('');
  };

  const filtrados = useMemo(() => {
    return lista.filter((c) => {
      if (!coincideBusquedaCliente(c, busqueda)) return false;

      if (filtroTipo && c.tipo !== filtroTipo) return false;

      const docs = c.docCount ?? 0;
      if (filtroDocs === 'sin' && docs > 0) return false;
      if (filtroDocs === 'con' && docs < 1) return false;
      if (filtroDocs === 'min3' && docs < 3) return false;

      const rentas = c.rentasVinculadas ?? 0;
      if (filtroRentas === 'sin' && rentas > 0) return false;
      if (filtroRentas === 'con' && rentas < 1) return false;

      const hasRfc = Boolean(c.rfc?.trim());
      if (filtroRfc === 'con' && !hasRfc) return false;
      if (filtroRfc === 'sin' && hasRfc) return false;

      const hasCurp = Boolean(c.curp?.trim());
      if (filtroCurp === 'con' && !hasCurp) return false;
      if (filtroCurp === 'sin' && hasCurp) return false;

      return true;
    });
  }, [lista, busqueda, filtroTipo, filtroDocs, filtroRentas, filtroRfc, filtroCurp]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombreComercial.trim()) {
      toast('El nombre comercial o razón de uso es obligatorio.', 'error');
      return;
    }
    setSaving(true);
    createCliente({
      tipo: form.tipo,
      nombreComercial: form.nombreComercial.trim(),
      razonSocial: form.razonSocial.trim(),
      rfc: form.rfc.trim(),
      curp: form.curp.trim(),
      representanteLegal: form.representanteLegal.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim(),
      direccion: form.direccion.trim(),
      notas: form.notas.trim(),
    })
      .then((c) => {
        toast('Cliente registrado');
        setModalNuevo(false);
        setForm(formVacio);
        load();
        navigate(`/clientes/${c.id}`);
      })
      .catch((err) => toast(err instanceof Error ? err.message : 'Error', 'error'))
      .finally(() => setSaving(false));
  }

  function handleDelete(c: ClienteListRow) {
    const n = nombreMostrar(c);
    if (
      !confirm(
        `¿Desactivar el expediente de «${n}»?\n\nLas rentas vinculadas conservan el nombre guardado en cada contrato, pero dejarán de apuntar al catálogo si editas la renta sin volver a asignar un cliente.`
      )
    )
      return;
    setDeletingId(c.id);
    deleteCliente(c.id)
      .then(() => {
        toast(`Cliente «${n}» desactivado`);
        load();
      })
      .catch((err) => toast(err instanceof Error ? err.message : 'Error', 'error'))
      .finally(() => setDeletingId(null));
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Clientes</h1>
        <p className="mt-1 text-sm font-medium text-gray-500">
          Expedientes con datos fiscales y documentos (INE, contrato, acta constitutiva, etc.). Registra aquí al
          cliente y luego asígnalo en Gestión de rentas.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {loading ? 'Cargando…' : `${filtrados.length} de ${lista.length} clientes activos`}
        </p>
        <button
          type="button"
          className="btn btn-primary inline-flex items-center gap-2"
          onClick={() => {
            setForm(formVacio);
            setModalNuevo(true);
          }}
        >
          <Icon icon="mdi:account-plus" className="size-5" aria-hidden />
          Nuevo cliente
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-4 space-y-4 rounded-xl border border-skyline-border bg-gradient-to-b from-white to-skyline-bg/30 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-skyline-muted">
            <Icon icon="mdi:filter-variant" className="size-4 text-skyline-blue" aria-hidden />
            Buscar y filtrar
          </span>
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-skyline-blue ring-1 ring-skyline-blue/30 transition hover:bg-skyline-blue/10"
            >
              <Icon icon="mdi:close-circle-outline" className="size-3.5" aria-hidden />
              Limpiar todo
            </button>
          )}
        </div>

        <label className="block text-sm font-medium text-gray-700">
          Búsqueda libre (varias palabras: deben aparecer en el expediente)
          <div className="mt-1 flex items-center gap-2 rounded-md border border-skyline-border bg-white px-3 py-2 shadow-inner shadow-gray-100/80 focus-within:border-skyline-blue focus-within:ring-1 focus-within:ring-skyline-blue">
            <Icon icon="mdi:magnify" className="size-5 shrink-0 text-skyline-muted" aria-hidden />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, razón social, RFC, CURP, representante, correo, teléfono, dirección, notas, #id…"
              className="w-full border-0 bg-transparent text-sm outline-none"
              autoComplete="off"
            />
          </div>
        </label>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <label htmlFor="cli-f-tipo" className="mb-1 block text-xs font-medium text-gray-600">
              Tipo de cliente
            </label>
            <select
              id="cli-f-tipo"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="input w-full text-sm"
            >
              <option value="">Todos</option>
              <option value="persona_fisica">Persona física</option>
              <option value="persona_moral">Persona moral</option>
            </select>
          </div>
          <div>
            <label htmlFor="cli-f-docs" className="mb-1 block text-xs font-medium text-gray-600">
              Documentos en expediente
            </label>
            <select
              id="cli-f-docs"
              value={filtroDocs}
              onChange={(e) => setFiltroDocs(e.target.value)}
              className="input w-full text-sm"
            >
              <option value="">Cualquier cantidad</option>
              <option value="sin">Sin documentos (0)</option>
              <option value="con">Con al menos 1</option>
              <option value="min3">3 o más archivos</option>
            </select>
          </div>
          <div>
            <label htmlFor="cli-f-rentas" className="mb-1 block text-xs font-medium text-gray-600">
              Rentas vinculadas
            </label>
            <select
              id="cli-f-rentas"
              value={filtroRentas}
              onChange={(e) => setFiltroRentas(e.target.value)}
              className="input w-full text-sm"
            >
              <option value="">Todas</option>
              <option value="sin">Sin rentas (0)</option>
              <option value="con">Con al menos 1</option>
            </select>
          </div>
          <div>
            <label htmlFor="cli-f-rfc" className="mb-1 block text-xs font-medium text-gray-600">
              RFC registrado
            </label>
            <select
              id="cli-f-rfc"
              value={filtroRfc}
              onChange={(e) => setFiltroRfc(e.target.value)}
              className="input w-full text-sm"
            >
              <option value="">Todos</option>
              <option value="con">Con RFC</option>
              <option value="sin">Sin RFC</option>
            </select>
          </div>
          <div>
            <label htmlFor="cli-f-curp" className="mb-1 block text-xs font-medium text-gray-600">
              CURP registrado
            </label>
            <select
              id="cli-f-curp"
              value={filtroCurp}
              onChange={(e) => setFiltroCurp(e.target.value)}
              className="input w-full text-sm"
            >
              <option value="">Todos</option>
              <option value="con">Con CURP</option>
              <option value="sin">Sin CURP</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-skyline-border bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-skyline-border border-t-skyline-blue" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-skyline-border bg-skyline-bg">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    RFC
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Contacto
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Docs
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Rentas
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      {lista.length === 0 ? (
                        'Aún no hay clientes. Crea el primero para vincularlo a las rentas.'
                      ) : hayFiltros ? (
                        <span>
                          Ningún cliente cumple los filtros actuales.{' '}
                          <button type="button" className="text-skyline-blue underline" onClick={limpiarFiltros}>
                            Quitar filtros
                          </button>
                        </span>
                      ) : (
                        'Sin resultados.'
                      )}
                    </td>
                  </tr>
                )}
                {filtrados.map((c) => (
                  <tr key={c.id} className="border-b border-skyline-border/80 hover:bg-skyline-bg/50">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/clientes/${c.id}`)}
                        className="text-left font-medium text-skyline-blue hover:underline"
                      >
                        {nombreMostrar(c)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.tipo === 'persona_fisica' ? 'Persona física' : 'Persona moral'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.rfc || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{c.telefono || '—'}</div>
                      {c.email ? (
                        <div className="max-w-[200px] truncate text-xs text-gray-500">{c.email}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">{c.docCount ?? 0}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{c.rentasVinculadas ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link to={`/clientes/${c.id}`} className="btn btn-outline btn-sm">
                          Expediente
                        </Link>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm border-red-200 text-red-700 hover:bg-red-50"
                          disabled={deletingId === c.id}
                          onClick={() => handleDelete(c)}
                        >
                          {deletingId === c.id ? '…' : 'Desactivar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalNuevo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !saving && setModalNuevo(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Nuevo cliente</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tipo: e.target.value as FormCliente['tipo'] }))
                  }
                  className="input w-full"
                >
                  <option value="persona_moral">Persona moral</option>
                  <option value="persona_fisica">Persona física</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nombre comercial / uso en operación <span className="text-skyline-red">*</span>
                </label>
                <input
                  value={form.nombreComercial}
                  onChange={(e) => setForm((f) => ({ ...f, nombreComercial: e.target.value }))}
                  className="input w-full"
                  placeholder="Ej. Transportes del Norte"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Razón social (fiscal)</label>
                <input
                  value={form.razonSocial}
                  onChange={(e) => setForm((f) => ({ ...f, razonSocial: e.target.value }))}
                  className="input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">RFC</label>
                  <input
                    value={form.rfc}
                    onChange={(e) => setForm((f) => ({ ...f, rfc: e.target.value.toUpperCase() }))}
                    className="input w-full font-mono uppercase"
                    maxLength={13}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">CURP</label>
                  <input
                    value={form.curp}
                    onChange={(e) => setForm((f) => ({ ...f, curp: e.target.value.toUpperCase() }))}
                    className="input w-full font-mono uppercase"
                    maxLength={18}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Representante legal</label>
                <input
                  value={form.representanteLegal}
                  onChange={(e) => setForm((f) => ({ ...f, representanteLegal: e.target.value }))}
                  className="input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono</label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Correo</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Dirección</label>
                <textarea
                  value={form.direccion}
                  onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                  className="input min-h-[4rem] w-full resize-y"
                  rows={2}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notas internas</label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  className="input min-h-[4rem] w-full resize-y"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn btn-outline" disabled={saving} onClick={() => setModalNuevo(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando…' : 'Crear expediente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ClienteDetallePage({ clienteId }: { clienteId: string }) {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [detalle, setDetalle] = useState<ClienteDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormCliente>(formVacio);
  const [saving, setSaving] = useState(false);
  const [docTipo, setDocTipo] = useState<string>('ine');
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    getCliente(clienteId)
      .then((c) => {
        setDetalle(c);
        setForm({
          tipo: c.tipo,
          nombreComercial: c.nombreComercial,
          razonSocial: c.razonSocial,
          rfc: c.rfc,
          curp: c.curp,
          representanteLegal: c.representanteLegal,
          telefono: c.telefono,
          email: c.email,
          direccion: c.direccion,
          notas: c.notas,
        });
      })
      .catch((e) => {
        setDetalle(null);
        setError(e instanceof Error ? e.message : 'Error al cargar expediente');
      })
      .finally(() => setLoading(false));
  }, [clienteId]);

  useEffect(() => {
    reload();
  }, [reload]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombreComercial.trim()) {
      toast('El nombre comercial es obligatorio.', 'error');
      return;
    }
    setSaving(true);
    updateCliente(clienteId, {
      tipo: form.tipo,
      nombreComercial: form.nombreComercial.trim(),
      razonSocial: form.razonSocial.trim(),
      rfc: form.rfc.trim(),
      curp: form.curp.trim(),
      representanteLegal: form.representanteLegal.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim(),
      direccion: form.direccion.trim(),
      notas: form.notas.trim(),
    })
      .then((c) => {
        setDetalle(c);
        toast('Expediente actualizado');
      })
      .catch((err) => toast(err instanceof Error ? err.message : 'Error', 'error'))
      .finally(() => setSaving(false));
  }

  async function onSubirDoc(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setSubiendoDoc(true);
    try {
      const c = await uploadDocumentoCliente(clienteId, file, docTipo, file.name);
      setDetalle(c);
      toast('Documento subido');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al subir', 'error');
    } finally {
      setSubiendoDoc(false);
    }
  }

  function quitarDoc(docId: string, nombre: string) {
    if (!confirm(`¿Eliminar del expediente el archivo «${nombre}»?`)) return;
    setDeletingDocId(docId);
    deleteDocumentoCliente(clienteId, docId)
      .then((c) => {
        setDetalle(c);
        toast('Documento eliminado');
      })
      .catch((err) => toast(err instanceof Error ? err.message : 'Error', 'error'))
      .finally(() => setDeletingDocId(null));
  }

  if (loading && !detalle) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-skyline-border border-t-skyline-blue" />
      </div>
    );
  }
  if (error || !detalle) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <p>{error || 'Expediente no encontrado.'}</p>
        <button type="button" className="btn btn-outline mt-4" onClick={() => navigate('/clientes')}>
          Volver al listado
        </button>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/clientes')}
          className="rounded p-2 text-gray-600 hover:bg-gray-100"
          aria-label="Volver"
        >
          <Icon icon="mdi:arrow-left" className="text-xl" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">Expediente cliente · #{detalle.id}</h1>
          <p className="text-sm text-gray-500">{nombreMostrar(detalle)}</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-skyline-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Datos generales</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as FormCliente['tipo'] }))}
                  className="input w-full"
                >
                  <option value="persona_moral">Persona moral</option>
                  <option value="persona_fisica">Persona física</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nombre comercial / uso en operación <span className="text-skyline-red">*</span>
                </label>
                <input
                  value={form.nombreComercial}
                  onChange={(e) => setForm((f) => ({ ...f, nombreComercial: e.target.value }))}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Razón social</label>
                <input
                  value={form.razonSocial}
                  onChange={(e) => setForm((f) => ({ ...f, razonSocial: e.target.value }))}
                  className="input w-full"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">RFC</label>
                  <input
                    value={form.rfc}
                    onChange={(e) => setForm((f) => ({ ...f, rfc: e.target.value.toUpperCase() }))}
                    className="input w-full font-mono uppercase"
                    maxLength={13}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">CURP</label>
                  <input
                    value={form.curp}
                    onChange={(e) => setForm((f) => ({ ...f, curp: e.target.value.toUpperCase() }))}
                    className="input w-full font-mono uppercase"
                    maxLength={18}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Representante legal</label>
                <input
                  value={form.representanteLegal}
                  onChange={(e) => setForm((f) => ({ ...f, representanteLegal: e.target.value }))}
                  className="input w-full"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono</label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Correo</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Dirección</label>
                <textarea
                  value={form.direccion}
                  onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                  className="input min-h-[5rem] w-full resize-y"
                  rows={3}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notas internas</label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  className="input min-h-[5rem] w-full resize-y"
                  rows={3}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-skyline-border bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Documentos del expediente</h2>
            <p className="mb-4 text-sm text-gray-500">
              Sube INE, contrato, acta constitutiva u otros archivos. Quedan asociados solo a este cliente.
            </p>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Tipo de documento</label>
                <select value={docTipo} onChange={(e) => setDocTipo(e.target.value)} className="input text-sm">
                  {TIPOS_DOC.map((t) => (
                    <option key={t.v} value={t.v}>
                      {t.l}
                    </option>
                  ))}
                </select>
              </div>
              <label className="btn btn-outline inline-flex cursor-pointer items-center gap-2">
                <Icon icon="mdi:upload" className="size-5" aria-hidden />
                {subiendoDoc ? 'Subiendo…' : 'Seleccionar archivo'}
                <input type="file" className="hidden" disabled={subiendoDoc} onChange={onSubirDoc} />
              </label>
            </div>
            {detalle.documentos.length === 0 ? (
              <p className="text-sm text-gray-500">Aún no hay documentos adjuntos.</p>
            ) : (
              <ul className="divide-y divide-skyline-border rounded-lg border border-skyline-border">
                {detalle.documentos.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium text-gray-900">{d.nombre}</span>
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                        {etiquetaTipoDoc(d.tipo)}
                      </span>
                      <div className="text-xs text-gray-500">{formatearFecha(d.creadoEn)}</div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <a
                        href={getDocumentoUrl(d.ruta)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline btn-sm"
                      >
                        Ver / descargar
                      </a>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm border-red-200 text-red-700"
                        disabled={deletingDocId === d.id}
                        onClick={() => quitarDoc(d.id, d.nombre)}
                      >
                        Quitar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-skyline-border bg-white p-6 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Icon icon="mdi:calendar-month" className="size-5 text-skyline-blue" aria-hidden />
            Rentas vinculadas
          </h2>
          {detalle.rentas.length === 0 ? (
            <p className="text-sm text-gray-500">
              Este cliente no está asignado en ninguna renta todavía. Créalo o edítalo desde{' '}
              <Link to="/rentas" className="text-skyline-blue hover:underline">
                Gestión de rentas
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {detalle.rentas.map((r) => (
                <li key={r.id} className="rounded-lg border border-skyline-border p-3">
                  <Link to={`/rentas/${r.id}`} className="font-medium text-skyline-blue hover:underline">
                    {r.placas} — renta #{r.id}
                  </Link>
                  <div className="mt-1 text-xs text-gray-600">
                    {formatearFecha(r.fechaInicio)} → {formatearFecha(r.fechaFin)} · {r.estado}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function Clientes() {
  const { id } = useParams<{ id: string }>();
  if (id) return <ClienteDetallePage clienteId={id} />;
  return <ClientesListPage />;
}
