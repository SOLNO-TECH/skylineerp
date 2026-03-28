import type { ProveedorFacturaRow } from '../api/client';
import { downloadHtmlAsPdf } from './htmlToPdfDownload';
import { svgLogoSkyline } from './pdfSkylineBrand';

/** Datos mínimos del proveedor para el PDF */
export type ProveedorPdfInfo = {
  nombreRazonSocial: string;
  rfc: string;
  contactoNombre: string;
  contactoTelefono: string;
  contactoEmail: string;
  direccion: string;
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

function nombreArchivoPdf(numero: string): string {
  const safe = numero.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'sin-numero';
  return `factura-proveedor-${safe}.pdf`;
}

function buildDocumentHtml(proveedor: ProveedorPdfInfo, factura: ProveedorFacturaRow): string {
  const ahora = new Date().toLocaleString('es-MX');
  const estadoLabel =
    factura.estado === 'pagada' ? 'Pagada' : factura.estado === 'parcial' ? 'Parcialmente pagada' : 'Pendiente de pago';

  const filasPago =
    (factura.pagos || []).length === 0
      ? '<tr><td colspan="5" style="color:#6c757d;font-style:italic;">Sin pagos registrados aún en el sistema.</td></tr>'
      : (factura.pagos || [])
          .map(
            (p) => `
    <tr>
      <td>${esc(fmtFecha(p.fechaPago))}</td>
      <td>${esc(fmtMoney(p.monto))}</td>
      <td>${esc(METODOS[p.metodo] || p.metodo)}</td>
      <td>${esc(p.referencia || '—')}</td>
      <td>${esc(p.observaciones || '—')}</td>
    </tr>`
          )
          .join('');

  const unidadLine =
    factura.unidadPlacas || factura.unidadId
      ? `${esc(factura.unidadPlacas || '—')}${factura.unidadMarca ? ` · ${esc(factura.unidadMarca)} ${esc(factura.unidadModelo || '')}` : ''}`
      : '—';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Factura proveedor ${esc(factura.numero)} — SKYLINE ERP</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #1a1a2e;
      margin: 0;
      padding: 0 0 28px;
      font-size: 12px;
      line-height: 1.5;
      background: #fff;
    }
    .sheet { max-width: 720px; margin: 0 auto; padding: 8px 4px 0; }
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
      margin: 20px 0 18px;
      padding: 18px 20px;
      border-radius: 10px;
      background: linear-gradient(135deg, #2D58A7 0%, #24478a 100%);
      color: #fff;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }
    .hero-monto .label { font-size: 11px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.08em; }
    .hero-monto .amount { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
    .hero-monto .meta { font-size: 12px; opacity: 0.95; }
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
    .totales {
      margin-top: 16px;
      margin-left: auto;
      max-width: 280px;
      border-collapse: collapse;
      font-size: 12px;
    }
    .totales td { padding: 6px 0; border: none; }
    .totales td:last-child { text-align: right; font-weight: 600; }
    .totales tr:last-child td { padding-top: 10px; border-top: 2px solid #2D58A7; font-size: 13px; }
    .pie {
      margin-top: 28px;
      margin-left: auto;
      margin-right: auto;
      max-width: 640px;
      padding-top: 16px;
      border-top: 1px solid #E9ECEF;
      font-size: 10px;
      color: #6c757d;
      line-height: 1.55;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="topbar"></div>
    <div class="head">
      <div class="logo-wrap">${svgLogoSkyline()}</div>
      <div class="head-title">
        <h1>Registro de factura de proveedor</h1>
        <p class="doc-id">Folio interno #${esc(factura.id)} · No. ${esc(factura.numero)}</p>
        <span class="badge">${esc(estadoLabel)}</span>
      </div>
    </div>

    <div class="hero-monto">
      <div>
        <div class="label">Monto total de la factura</div>
        <div class="amount">${esc(fmtMoney(factura.montoTotal))}</div>
      </div>
      <div class="meta">
        Emisión: ${esc(fmtFecha(factura.fechaEmision))}<br />
        Generado: ${esc(ahora)}
      </div>
    </div>

    <div class="grid2">
      <div class="box">
        <h2>Proveedor</h2>
        <dl>
          <dt>Razón social</dt><dd>${esc(proveedor.nombreRazonSocial)}</dd>
          <dt>RFC</dt><dd>${esc(proveedor.rfc)}</dd>
          <dt>Contacto</dt><dd>${esc(proveedor.contactoNombre || proveedor.contactoEmail || proveedor.contactoTelefono)}</dd>
          <dt>Teléfono / Correo</dt><dd>${esc(proveedor.contactoTelefono)} · ${esc(proveedor.contactoEmail)}</dd>
          <dt>Dirección</dt><dd>${esc(proveedor.direccion)}</dd>
        </dl>
      </div>
      <div class="box">
        <h2>Concepto y activo</h2>
        <dl>
          <dt>Concepto</dt><dd>${esc(factura.concepto || '—')}</dd>
          <dt>Unidad relacionada</dt><dd>${unidadLine}</dd>
          <dt>Archivo digital</dt><dd>${esc(factura.archivoNombreOriginal || 'Sin adjunto en sistema')}</dd>
        </dl>
      </div>
    </div>

    <div class="box" style="margin-bottom: 14px;">
      <h2>Pagos aplicados en SKYLINE ERP</h2>
      <table class="data">
        <thead>
          <tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Referencia</th><th>Observaciones</th></tr>
        </thead>
        <tbody>${filasPago}</tbody>
      </table>
      <table class="totales">
        <tr><td>Total factura</td><td>${esc(fmtMoney(factura.montoTotal))}</td></tr>
        <tr><td>Total pagado (registrado)</td><td style="color:#198754;">${esc(fmtMoney(factura.totalPagado))}</td></tr>
        <tr><td><strong>Saldo pendiente</strong></td><td><strong>${esc(fmtMoney(factura.saldoPendiente))}</strong></td></tr>
      </table>
    </div>

    <p class="pie">
      <strong>SKYLINE ERP</strong> — Documento informativo para control de cuentas por pagar.
      No sustituye la factura fiscal original. Conserve el XML/PDF oficial del proveedor según normativa aplicable.
    </p>
  </div>
</body>
</html>`;
}

/**
 * Genera y descarga el PDF en el dispositivo (sin ventanas emergentes).
 */
export async function descargarFacturaProveedorPdf(
  proveedor: ProveedorPdfInfo,
  factura: ProveedorFacturaRow
): Promise<void> {
  const html = buildDocumentHtml(proveedor, factura);
  await downloadHtmlAsPdf(html, nombreArchivoPdf(factura.numero));
}
