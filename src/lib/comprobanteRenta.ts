import type { RentaRow, PagoRow } from '../api/client';
import { downloadHtmlAsPdf } from './htmlToPdfDownload';
import { svgLogoSkyline } from './pdfSkylineBrand';
import { labelTipoUnidad } from './tipoUnidadCatalogo';

const ESTADOS_RENTA: Record<string, string> = {
  reservada: 'Reservada',
  activa: 'Activa',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
};

const TIPOS_SERVICIO: Record<string, string> = {
  solo_renta: 'Solo renta',
  con_operador: 'Con operador',
  con_transporte: 'Con transporte',
};

const ESTADOS_LOG: Record<string, string> = {
  programado: 'Programado',
  en_camino: 'En camino',
  entregado: 'Entregado',
  finalizado: 'Finalizado',
};

const TIPOS_PAGO: Record<string, string> = {
  anticipo: 'Anticipo',
  pago_parcial: 'Pago parcial',
  pago_final: 'Pago final',
  deposito: 'Depósito',
  devolucion_deposito: 'Devolución depósito',
  extra: 'Extra',
};

const METODOS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
};

function esc(s: string | number | undefined | null): string {
  if (s == null || s === '') return '—';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtFecha(s: string) {
  if (!s) return '—';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtMoney(n: number) {
  return `$${(n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function nombreArchivoComprobante(id: string): string {
  const safe = String(id).replace(/[/\\?%*:|"<>]/g, '_');
  return `comprobante-renta-${safe}.pdf`;
}

function buildDocumentHtml(renta: RentaRow): string {
  const totalPagado = (renta.pagos || []).reduce((s, p) => s + p.monto, 0);
  const saldo = (renta.monto || 0) + (renta.deposito || 0) - totalPagado;
  const ahora = new Date().toLocaleString('es-MX');
  const estadoLabel = ESTADOS_RENTA[renta.estado] || renta.estado;

  const filasPago = (renta.pagos || []).length
    ? (renta.pagos as PagoRow[])
        .map(
          (p) => `
    <tr>
      <td>${esc(fmtFecha(p.fecha))}</td>
      <td>${esc(fmtMoney(p.monto))}</td>
      <td>${esc(TIPOS_PAGO[p.tipo] || p.tipo)}</td>
      <td>${esc(METODOS[p.metodo] || p.metodo)}</td>
      <td>${esc(p.referencia || '—')}</td>
      <td>${esc(p.observaciones || '—')}</td>
    </tr>`
        )
        .join('')
    : '<tr><td colspan="6" style="color:#6c757d;font-style:italic;">Sin pagos registrados en el sistema.</td></tr>';

  const tipoUnidadLabel = renta.tipoUnidad
    ? esc(labelTipoUnidad(renta.tipoUnidad))
    : '—';

  const ref = renta.refrigerado;
  const bloqueRefrigerado =
    ref &&
    (ref.temperaturaObjetivo != null ||
      ref.combustibleInicio != null ||
      ref.observaciones ||
      ref.horasMotorInicio != null)
      ? `
    <div class="box" style="margin-bottom: 14px;">
      <h2>Equipamiento refrigerado</h2>
      <dl>
        <dt>Temperatura objetivo (°C)</dt><dd>${esc(ref.temperaturaObjetivo ?? '—')}</dd>
        <dt>Combustible inicio / fin</dt><dd>${esc(ref.combustibleInicio ?? '—')} / ${esc(ref.combustibleFin ?? '—')}</dd>
        <dt>Horas motor inicio / fin</dt><dd>${esc(ref.horasMotorInicio ?? '—')} / ${esc(ref.horasMotorFin ?? '—')}</dd>
        <dt>Observaciones</dt><dd>${esc(ref.observaciones)}</dd>
      </dl>
    </div>`
      : '';

  const maq = renta.maquinaria;
  const bloqueMaquinaria =
    maq &&
    (maq.horasTrabajadas != null ||
      maq.tipoTrabajo ||
      maq.operadorAsignado ||
      maq.observaciones)
      ? `
    <div class="box" style="margin-bottom: 14px;">
      <h2>Mulita</h2>
      <dl>
        <dt>Operador</dt><dd>${esc(maq.operadorAsignado || '—')}</dd>
        <dt>Horas trabajadas</dt><dd>${esc(maq.horasTrabajadas ?? '—')}</dd>
        <dt>Tipo de trabajo</dt><dd>${esc(maq.tipoTrabajo || '—')}</dd>
        <dt>Observaciones</dt><dd>${esc(maq.observaciones)}</dd>
      </dl>
    </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Comprobante renta #${esc(renta.id)} — SKYLINE ERP</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #1a1a2e;
      margin: 0;
      padding: 0 0 24px;
      font-size: 12px;
      line-height: 1.5;
      background: #fff;
    }
    .sheet { max-width: 720px; margin: 0 auto; padding: 8px 4px 36px; }
    .topbar {
      height: 4px;
      background: linear-gradient(90deg, #2D58A7 0%, #2D58A7 62%, #E62129 62%, #E62129 100%);
      border-radius: 2px;
      margin-bottom: 20px;
    }
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }
    .head-title { text-align: right; flex: 1; min-width: 200px; }
    .head-title h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #2D58A7;
      letter-spacing: -0.02em;
    }
    .head-title .doc-id {
      margin: 6px 0 0;
      font-size: 13px;
      color: #495057;
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      background: #F8F9FA;
      border: 1px solid #E9ECEF;
      color: #495057;
    }
    .grid2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 20px;
      margin-bottom: 18px;
    }
    .box {
      border: 1px solid #E9ECEF;
      border-radius: 8px;
      padding: 14px 16px;
      background: #fafbfc;
    }
    .box h2 {
      margin: 0 0 10px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #6c757d;
      font-weight: 700;
    }
    .box dl { margin: 0; }
    .box dt { font-size: 10px; color: #6c757d; margin-top: 8px; font-weight: 600; }
    .box dt:first-child { margin-top: 0; }
    .box dd { margin: 2px 0 0; font-size: 12px; color: #212529; font-weight: 500; }
    .hero-monto {
      margin: 16px 0 16px;
      padding: 16px 18px;
      border-radius: 10px;
      background: linear-gradient(135deg, #2D58A7 0%, #1e3d73 100%);
      color: #fff;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
    }
    .hero-monto .label { font-size: 10px; opacity: 0.92; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }
    .hero-monto .amount { font-size: 28px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; margin-top: 4px; }
    .hero-monto .meta { font-size: 11px; opacity: 0.94; line-height: 1.55; text-align: right; max-width: 280px; }
    .hero-monto .meta strong { font-weight: 700; opacity: 1; }
    table.data {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 11px;
    }
    .data th, .data td {
      padding: 10px 12px;
      border-bottom: 1px solid #E9ECEF;
    }
    .data th {
      text-align: center;
      background: #2D58A7;
      color: #fff;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .data tbody td {
      text-align: left;
    }
    .data tbody td:nth-child(2) {
      text-align: right;
      font-weight: 600;
    }
    .data tbody tr:nth-child(even) { background: #f8f9fa; }
    .data tfoot { border-top: 2px solid #2D58A7; }
    .data tfoot td {
      padding: 8px 12px;
      font-size: 11px;
      background: #f1f3f5;
      font-weight: 600;
      color: #212529;
    }
    .data tfoot td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .data tfoot tr.sub td { background: #f8f9fa; font-weight: 500; color: #495057; }
    .data tfoot tr.total td { font-size: 12px; padding-top: 10px; padding-bottom: 10px; }
    .data tfoot tr.total .num-saldo { font-size: 13px; color: #212529; }
    .data tfoot .paid { color: #146c43; font-weight: 700; }
    .pie {
      margin-top: 20px;
      margin-bottom: 0;
      margin-left: auto;
      margin-right: auto;
      max-width: 640px;
      padding: 14px 8px 20px;
      border-top: 1px solid #E9ECEF;
      font-size: 10px;
      color: #6c757d;
      line-height: 1.55;
      text-align: center;
    }
    .pdf-end-spacer {
      height: 40px;
      width: 100%;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="topbar"></div>
    <div class="head">
      <div class="logo-wrap">${svgLogoSkyline()}</div>
      <div class="head-title">
        <h1>Comprobante de expediente de renta</h1>
        <p class="doc-id">Expediente #${esc(renta.id)} · ${esc(
          (renta.numeroEconomico ?? '').trim() ? `${(renta.numeroEconomico ?? '').trim()} · ${renta.placas}` : renta.placas
        )}</p>
        <span class="badge">${esc(estadoLabel)}</span>
      </div>
    </div>

    <div class="hero-monto">
      <div>
        <div class="label">Saldo pendiente</div>
        <div class="amount">${esc(fmtMoney(saldo))}</div>
      </div>
      <div class="meta">
        <strong>Periodo</strong><br />
        ${esc(fmtFecha(renta.fechaInicio))} — ${esc(fmtFecha(renta.fechaFin))}<br /><br />
        <strong>Estado del contrato</strong> · ${esc(estadoLabel)}<br /><br />
        <strong>Generado</strong><br />
        ${esc(ahora)}
      </div>
    </div>

    <div class="grid2">
      <div class="box">
        <h2>Cliente</h2>
        <dl>
          <dt>Nombre</dt><dd>${esc(renta.clienteNombre)}</dd>
          <dt>Teléfono</dt><dd>${esc(renta.clienteTelefono)}</dd>
          <dt>Correo</dt><dd>${esc(renta.clienteEmail)}</dd>
        </dl>
      </div>
      <div class="box">
        <h2>Unidad</h2>
        <dl>
          <dt>Tipo</dt><dd>${tipoUnidadLabel}</dd>
          ${(renta.numeroEconomico ?? '').trim() ? `<dt>Núm. económico</dt><dd>${esc((renta.numeroEconomico ?? '').trim())}</dd>` : ''}
          <dt>Placas</dt><dd>${esc(renta.placas)}</dd>
          <dt>Vehículo</dt><dd>${esc(`${renta.marca || ''} ${renta.modelo || ''}`.trim() || '—')}</dd>
          <dt>Operador asignado</dt><dd>${esc(renta.operadorAsignado)}</dd>
        </dl>
      </div>
    </div>

    <div class="box" style="margin-bottom: 14px;">
      <h2>Contrato y logística</h2>
      <dl>
        <dt>Servicio</dt><dd>${esc(renta.tipoServicio ? TIPOS_SERVICIO[renta.tipoServicio] || renta.tipoServicio : '—')}</dd>
        <dt>Estado logístico</dt><dd>${esc(renta.estadoLogistico ? ESTADOS_LOG[renta.estadoLogistico] || renta.estadoLogistico : '—')}</dd>
        ${renta.precioBase != null ? `<dt>Precio base</dt><dd>${esc(fmtMoney(renta.precioBase))}</dd>` : ''}
        ${renta.extras != null && renta.extras !== 0 ? `<dt>Extras</dt><dd>${esc(fmtMoney(renta.extras))}</dd>` : ''}
        <dt>Ubicación entrega</dt><dd>${esc(renta.ubicacionEntrega)}</dd>
        <dt>Ubicación recolección</dt><dd>${esc(renta.ubicacionRecoleccion)}</dd>
        <dt>Observaciones</dt><dd>${esc(renta.observaciones)}</dd>
      </dl>
    </div>

    ${bloqueRefrigerado}
    ${bloqueMaquinaria}

    <div class="box" style="margin-bottom: 12px;">
      <h2>Movimientos de pago</h2>
      <table class="data">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Monto</th>
            <th>Tipo</th>
            <th>Método</th>
            <th>Referencia</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>${filasPago}</tbody>
        <tfoot>
          <tr class="sub">
            <td colspan="5">Monto del contrato (renta)</td>
            <td class="num">${esc(fmtMoney(renta.monto || 0))}</td>
          </tr>
          <tr class="sub">
            <td colspan="5">Depósito considerado</td>
            <td class="num">${esc(fmtMoney(renta.deposito || 0))}</td>
          </tr>
          <tr class="sub">
            <td colspan="5">Total pagado acumulado</td>
            <td class="num paid">${esc(fmtMoney(totalPagado))}</td>
          </tr>
          <tr class="total">
            <td colspan="5"><strong>Saldo pendiente</strong></td>
            <td class="num num-saldo"><strong>${esc(fmtMoney(saldo))}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <p class="pie">
      <strong>SKYLINE ERP</strong> — Comprobante informativo del expediente de renta. El mapa de rutas y los documentos adjuntos
      permanecen disponibles en el expediente digital. Conserve este archivo para su control interno.
    </p>
    <div class="pdf-end-spacer" aria-hidden="true"></div>
  </div>
</body>
</html>`;
}

/** Descarga el comprobante como PDF (sin ventanas emergentes). */
export async function descargarComprobanteRentaPdf(renta: RentaRow): Promise<void> {
  const html = buildDocumentHtml(renta);
  await downloadHtmlAsPdf(html, nombreArchivoComprobante(renta.id));
}
