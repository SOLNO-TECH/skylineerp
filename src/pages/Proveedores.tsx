import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  CRUD_CELDA_SEC_LEFT,
  CRUD_ERROR_BANNER,
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
  getProveedores,
  createProveedorApi,
  updateProveedorApi,
  deleteProveedorApi,
  type ProveedorResumen,
} from '../api/client';
import { useNotification } from '../context/NotificationContext';

function fmtMoney(n: number) {
  return `$${(n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type ProveedorFormState = {
  nombreRazonSocial: string;
  rfc: string;
  contactoNombre: string;
  contactoTelefono: string;
  contactoEmail: string;
  direccion: string;
  notas: string;
};

function ProveedorFormFields({
  idPrefix,
  form,
  setForm,
}: {
  idPrefix: string;
  form: ProveedorFormState;
  setForm: Dispatch<SetStateAction<ProveedorFormState>>;
}) {
  const id = (s: string) => `${idPrefix}-${s}`;
  return (
    <div className="flex flex-col gap-5">
      <section
        className="rounded-xl border border-skyline-border bg-gradient-to-b from-white to-skyline-bg/40 p-4 shadow-sm"
        aria-labelledby={id('sec-fiscal')}
      >
        <h3
          id={id('sec-fiscal')}
          className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-skyline-muted"
        >
          <Icon icon="mdi:domain" className="size-4 text-skyline-blue" aria-hidden />
          Datos fiscales
        </h3>
        <div className="space-y-3">
          <div>
            <label htmlFor={id('nombre')} className="text-sm font-medium text-gray-800">
              Nombre / Razón social <span className="text-skyline-red">*</span>
            </label>
            <input
              id={id('nombre')}
              required
              value={form.nombreRazonSocial}
              onChange={(e) => setForm((f) => ({ ...f, nombreRazonSocial: e.target.value }))}
              placeholder="Ej. Proveedora del Norte S.A. de C.V."
              className="input mt-1.5 w-full"
            />
          </div>
          <div>
            <label htmlFor={id('rfc')} className="text-sm font-medium text-gray-800">
              RFC
            </label>
            <input
              id={id('rfc')}
              value={form.rfc}
              onChange={(e) => setForm((f) => ({ ...f, rfc: e.target.value.toUpperCase() }))}
              placeholder="Opcional — 12 o 13 caracteres"
              maxLength={13}
              className="input mt-1.5 w-full font-mono uppercase tracking-wide"
            />
          </div>
        </div>
      </section>

      <section
        className="rounded-xl border border-skyline-border bg-gradient-to-b from-white to-skyline-bg/40 p-4 shadow-sm"
        aria-labelledby={id('sec-contacto')}
      >
        <h3
          id={id('sec-contacto')}
          className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-skyline-muted"
        >
          <Icon icon="mdi:account-card-details-outline" className="size-4 text-skyline-blue" aria-hidden />
          Contacto
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={id('contacto')} className="text-sm font-medium text-gray-800">
              Nombre del contacto
            </label>
            <input
              id={id('contacto')}
              value={form.contactoNombre}
              onChange={(e) => setForm((f) => ({ ...f, contactoNombre: e.target.value }))}
              placeholder="Persona de confianza"
              className="input mt-1.5 w-full"
            />
          </div>
          <div>
            <label htmlFor={id('tel')} className="text-sm font-medium text-gray-800">
              Teléfono
            </label>
            <input
              id={id('tel')}
              inputMode="tel"
              autoComplete="tel"
              value={form.contactoTelefono}
              onChange={(e) => setForm((f) => ({ ...f, contactoTelefono: e.target.value }))}
              placeholder="+52 …"
              className="input mt-1.5 w-full"
            />
          </div>
        </div>
        <div className="mt-3">
          <label htmlFor={id('email')} className="text-sm font-medium text-gray-800">
            Correo electrónico
          </label>
          <input
            id={id('email')}
            type="email"
            autoComplete="email"
            value={form.contactoEmail}
            onChange={(e) => setForm((f) => ({ ...f, contactoEmail: e.target.value }))}
            placeholder="facturacion@empresa.com"
            className="input mt-1.5 w-full"
          />
        </div>
      </section>

      <section
        className="rounded-xl border border-skyline-border bg-gradient-to-b from-white to-skyline-bg/40 p-4 shadow-sm"
        aria-labelledby={id('sec-ubicacion')}
      >
        <h3
          id={id('sec-ubicacion')}
          className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-skyline-muted"
        >
          <Icon icon="mdi:map-marker-outline" className="size-4 text-skyline-blue" aria-hidden />
          Ubicación y notas
        </h3>
        <div className="space-y-3">
          <div>
            <label htmlFor={id('dir')} className="text-sm font-medium text-gray-800">
              Dirección
            </label>
            <input
              id={id('dir')}
              value={form.direccion}
              onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
              placeholder="Calle, número, colonia, ciudad…"
              className="input mt-1.5 w-full"
            />
          </div>
          <div>
            <label htmlFor={id('notas')} className="text-sm font-medium text-gray-800">
              Notas internas
            </label>
            <textarea
              id={id('notas')}
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              rows={3}
              placeholder="Condiciones de pago, referencias, etc. (solo visible en Skyline)"
              className="input mt-1.5 min-h-[5rem] w-full resize-y"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export function Proveedores() {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [lista, setLista] = useState<ProveedorResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [editProveedorId, setEditProveedorId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombreRazonSocial: '',
    rfc: '',
    contactoNombre: '',
    contactoTelefono: '',
    contactoEmail: '',
    direccion: '',
    notas: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getProveedores()
      .then(setLista)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (p) =>
        p.nombreRazonSocial.toLowerCase().includes(q) ||
        p.rfc.toLowerCase().includes(q) ||
        p.contactoEmail.toLowerCase().includes(q) ||
        p.contactoNombre.toLowerCase().includes(q) ||
        p.contactoTelefono.toLowerCase().includes(q)
    );
  }, [lista, busqueda]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombreRazonSocial.trim()) return;
    setSaving(true);
    createProveedorApi({
      nombreRazonSocial: form.nombreRazonSocial.trim(),
      rfc: form.rfc.trim(),
      contactoNombre: form.contactoNombre.trim(),
      contactoTelefono: form.contactoTelefono.trim(),
      contactoEmail: form.contactoEmail.trim(),
      direccion: form.direccion.trim(),
      notas: form.notas.trim(),
    })
      .then((p) => {
        toast('Proveedor creado');
        setModalNuevo(false);
        setForm({
          nombreRazonSocial: '',
          rfc: '',
          contactoNombre: '',
          contactoTelefono: '',
          contactoEmail: '',
          direccion: '',
          notas: '',
        });
        load();
        navigate(`/administracion/proveedores/${p.id}`);
      })
      .catch((err) => {
        toast(err instanceof Error ? err.message : 'Error', 'error');
      })
      .finally(() => setSaving(false));
  }

  function abrirEditar(p: ProveedorResumen) {
    setEditProveedorId(p.id);
    setForm({
      nombreRazonSocial: p.nombreRazonSocial,
      rfc: p.rfc,
      contactoNombre: p.contactoNombre,
      contactoTelefono: p.contactoTelefono,
      contactoEmail: p.contactoEmail,
      direccion: p.direccion,
      notas: p.notas,
    });
    setModalEditar(true);
  }

  function cerrarEditar() {
    setModalEditar(false);
    setEditProveedorId(null);
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editProveedorId || !form.nombreRazonSocial.trim()) return;
    setSaving(true);
    updateProveedorApi(editProveedorId, {
      nombreRazonSocial: form.nombreRazonSocial.trim(),
      rfc: form.rfc.trim(),
      contactoNombre: form.contactoNombre.trim(),
      contactoTelefono: form.contactoTelefono.trim(),
      contactoEmail: form.contactoEmail.trim(),
      direccion: form.direccion.trim(),
      notas: form.notas.trim(),
    })
      .then(() => {
        toast('Datos del proveedor guardados');
        cerrarEditar();
        load();
      })
      .catch((err) => toast(err instanceof Error ? err.message : 'Error', 'error'))
      .finally(() => setSaving(false));
  }

  function handleDeleteProveedor(p: ProveedorResumen) {
    const msg =
      '¿Eliminar este proveedor del directorio?\n\n' +
      'Se dará de baja el expediente; las facturas dejan de mostrarse en reportes activos. ' +
      'Los archivos adjuntos no se borran del servidor.';
    if (!confirm(msg)) return;
    setDeletingId(p.id);
    deleteProveedorApi(p.id)
      .then(() => {
        toast(`Proveedor «${p.nombreRazonSocial}» eliminado`);
        load();
      })
      .catch((err) => toast(err instanceof Error ? err.message : 'Error', 'error'))
      .finally(() => setDeletingId(null));
  }

  return (
    <div>
      <header className={CRUD_HEADER_ROW}>
        <div>
          <h2 className={CRUD_PAGE_TITLE}>Proveedores</h2>
          <p className={CRUD_PAGE_SUBTITLE}>
            Directorio fiscal, facturas y vínculo con mantenimiento. Desde aquí das de alta y abres el expediente.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setForm({
              nombreRazonSocial: '',
              rfc: '',
              contactoNombre: '',
              contactoTelefono: '',
              contactoEmail: '',
              direccion: '',
              notas: '',
            });
            setModalNuevo(true);
          }}
        >
          <Icon icon="mdi:plus" className="size-5" aria-hidden />
          Nuevo proveedor
        </button>
      </header>

      {error && <div className={CRUD_ERROR_BANNER}>{error}</div>}

      <div className={CRUD_TOOLBAR}>
        <label className="block min-w-0 flex-1 lg:max-w-md">
          <span className={CRUD_SEARCH_LABEL}>Buscar</span>
          <div className={CRUD_SEARCH_INNER}>
            <Icon icon="mdi:magnify" className="size-4 shrink-0 text-skyline-muted" aria-hidden />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Razón social, RFC, correo o contacto…"
              className={CRUD_SEARCH_INPUT}
            />
          </div>
        </label>
        <p className="mt-2 text-xs leading-relaxed text-gray-600">
          <span className="font-semibold text-gray-900">
            {loading ? '…' : `${filtrados.length} de ${lista.length}`}
          </span>{' '}
          proveedores en el directorio.
        </p>
      </div>

      <div className={CRUD_TABLE_OUTER}>
        {loading ? (
          <div className={CRUD_SPINNER_WRAP}>
            <div className={CRUD_SPINNER} />
          </div>
        ) : (
          <table className={`${CRUD_TABLE} min-w-[960px]`}>
            <thead>
              <tr className={CRUD_THEAD_TR}>
                <CrudTableTh className="min-w-[10rem] px-2 py-3.5 text-left align-middle" icon="mdi:domain" align="start">
                  Proveedor
                </CrudTableTh>
                <CrudTableTh className="w-[6.5rem] px-2 py-3.5 text-left align-middle" icon="mdi:identifier" align="start">
                  RFC
                </CrudTableTh>
                <CrudTableTh className="min-w-[8rem] px-2 py-3.5 text-left align-middle" icon="mdi:account-outline" align="start">
                  Contacto
                </CrudTableTh>
                <CrudTableTh className="min-w-[5.5rem] px-2 py-3.5 text-right align-middle" icon="mdi:receipt-text-outline" align="end">
                  Facturado
                </CrudTableTh>
                <CrudTableTh className="min-w-[5.5rem] px-2 py-3.5 text-right align-middle" icon="mdi:cash-check" align="end">
                  Pagado
                </CrudTableTh>
                <CrudTableTh className="min-w-[5.5rem] px-2 py-3.5 text-right align-middle" icon="mdi:scale-balance" align="end">
                  Saldo
                </CrudTableTh>
                <CrudTableTh
                  className="min-w-[5.5rem] px-2 py-3.5 text-right align-middle"
                  icon="mdi:wrench-outline"
                  align="end"
                  title="Suma de costos de mantenimiento vinculados a este proveedor"
                >
                  Mantenimiento
                </CrudTableTh>
                <CrudTableTh className="w-[1%] whitespace-nowrap px-2 py-3.5 text-center align-middle" icon="mdi:cog-outline" align="center">
                  Acciones
                </CrudTableTh>
              </tr>
            </thead>
            <tbody className={CRUD_TBODY}>
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                      {lista.length === 0
                        ? 'No hay proveedores. Crea uno con «Nuevo proveedor».'
                        : 'Ningún resultado para la búsqueda.'}
                    </td>
                  </tr>
                )}
                {filtrados.map((p, rowIdx) => (
                  <tr key={p.id} className={crudTableRowClass(rowIdx)}>
                    <td className={`px-3 py-2.5 align-middle font-semibold text-slate-900 ${CRUD_CELDA_SEC_LEFT}`}>
                      {p.nombreRazonSocial}
                    </td>
                    <td className={`px-3 py-2.5 align-middle tabular-nums ${CRUD_CELDA_SEC_LEFT} text-slate-600`}>{p.rfc || '—'}</td>
                    <td className={`max-w-[200px] px-3 py-2.5 align-middle ${CRUD_CELDA_SEC_LEFT} text-slate-600`}>
                      <span className="line-clamp-2">
                        {p.contactoNombre || p.contactoEmail || p.contactoTelefono || '—'}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 text-right align-middle tabular-nums ${CRUD_CELDA_SEC_LEFT}`}>{fmtMoney(p.totalFacturado)}</td>
                    <td className={`px-3 py-2.5 text-right align-middle tabular-nums ${CRUD_CELDA_SEC_LEFT}`}>{fmtMoney(p.totalPagado)}</td>
                    <td
                      className={`px-3 py-2.5 text-right align-middle font-semibold tabular-nums ${CRUD_CELDA_SEC_LEFT} ${
                        p.saldoPendiente > 0.01 ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {fmtMoney(p.saldoPendiente)}
                    </td>
                    <td className={`px-3 py-2.5 text-right align-middle tabular-nums text-violet-800 ${CRUD_CELDA_SEC_LEFT}`}>
                      {fmtMoney(p.totalMantenimiento ?? 0)}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <CrudActionGroup aria-label="Acciones del proveedor">
                          <CrudActionIconButton icon="mdi:pencil-outline" title="Editar proveedor" onClick={() => abrirEditar(p)} />
                          <CrudActionIconButton
                            icon="mdi:delete-outline"
                            title="Eliminar proveedor"
                            danger
                            disabled={deletingId === p.id}
                            onClick={() => handleDeleteProveedor(p)}
                          />
                        </CrudActionGroup>
                        <Link
                          to={`/administracion/proveedores/${p.id}`}
                          className="btn btn-primary btn-sm inline-flex items-center gap-1.5 no-underline"
                        >
                          <Icon icon="mdi:receipt-text-outline" className="size-4" aria-hidden />
                          Expediente
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      {modalNuevo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => !saving && setModalNuevo(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-nuevo-proveedor-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-skyline-border bg-white shadow-2xl shadow-gray-900/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-skyline-border bg-gradient-to-r from-skyline-blue/[0.06] to-transparent px-6 py-5">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-skyline-blue/10 text-skyline-blue">
                  <Icon icon="mdi:truck-delivery-outline" className="size-6" aria-hidden />
                </div>
                <div>
                  <h2 id="modal-nuevo-proveedor-title" className="text-lg font-semibold text-gray-900">
                    Nuevo proveedor
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Completa los datos básicos; después podrás cargar facturas en el expediente.
                  </p>
                </div>
              </div>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-0 px-6 pb-6 pt-5">
              <ProveedorFormFields idPrefix="nuevo" form={form} setForm={setForm} />
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-skyline-border pt-5">
                <p className="text-xs text-gray-500">
                  <span className="text-skyline-red">*</span> Campo obligatorio
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={saving}
                    onClick={() => setModalNuevo(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <Icon icon="mdi:folder-arrow-right-outline" className="size-5" aria-hidden />
                    {saving ? 'Guardando…' : 'Crear y abrir expediente'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalEditar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => !saving && cerrarEditar()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-editar-proveedor-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-skyline-border bg-white shadow-2xl shadow-gray-900/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-skyline-border bg-gradient-to-r from-skyline-blue/[0.06] to-transparent px-6 py-5">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-skyline-blue/10 text-skyline-blue">
                  <Icon icon="mdi:pencil-circle-outline" className="size-6" aria-hidden />
                </div>
                <div>
                  <h2 id="modal-editar-proveedor-title" className="text-lg font-semibold text-gray-900">
                    Editar datos del proveedor
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Actualiza razón social y contacto. Facturas y pagos se gestionan desde «Expediente» en la tabla.
                  </p>
                </div>
              </div>
            </div>
            <form onSubmit={handleUpdate} className="flex flex-col gap-0 px-6 pb-6 pt-5">
              <ProveedorFormFields idPrefix="editar" form={form} setForm={setForm} />
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-skyline-border pt-5">
                <p className="text-xs text-gray-500">
                  <span className="text-skyline-red">*</span> Campo obligatorio
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={saving}
                    onClick={() => cerrarEditar()}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <Icon icon="mdi:content-save-outline" className="size-5" aria-hidden />
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
