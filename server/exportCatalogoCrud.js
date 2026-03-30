import ExcelJS from 'exceljs';
import { db } from './db.js';

/** @typedef {{ desde?: string, hasta?: string }} FiltroPeriodo */
/** @typedef {{ start: Date | null, end: Date | null, label: string }} RangoPeriodo */
/** @typedef {{ sheet: string, table: string, sql: string, dateColumns: string[] }} HojaDef */

/** @type {HojaDef[]} */
const HOJAS = [
  { sheet: 'roles', table: 'roles', sql: 'SELECT * FROM roles ORDER BY id', dateColumns: [] },
  {
    sheet: 'usuarios',
    table: 'usuarios',
    sql: `SELECT id, email, nombre, apellidos, rfc, curp, telefono, rol, activo, avatar, creado_en, actualizado_en
          FROM usuarios ORDER BY id`,
    dateColumns: ['creado_en', 'actualizado_en'],
  },
  {
    sheet: 'unidades',
    table: 'unidades',
    sql: `SELECT id, placas, marca, modelo, numero_serie_caja, estatus, subestatus_disponible, ubicacion_disponible,
                 tipo_unidad, estado_mantenimiento, horas_motor, kilometraje, combustible_pct, observaciones,
                 activo, creado_en, actualizado_en
          FROM unidades ORDER BY id`,
    dateColumns: ['creado_en', 'actualizado_en'],
  },
  {
    sheet: 'unidad_documentos',
    table: 'unidad_documentos',
    sql: 'SELECT * FROM unidad_documentos ORDER BY id',
    dateColumns: ['fecha_subida'],
  },
  {
    sheet: 'unidad_actividad',
    table: 'unidad_actividad',
    sql: 'SELECT * FROM unidad_actividad ORDER BY id',
    dateColumns: ['fecha'],
  },
  {
    sheet: 'unidad_imagenes',
    table: 'unidad_imagenes',
    sql: 'SELECT * FROM unidad_imagenes ORDER BY id',
    dateColumns: ['fecha_subida'],
  },
  {
    sheet: 'clientes',
    table: 'clientes',
    sql: `SELECT id, tipo, nombre_comercial, razon_social, rfc, curp, representante_legal, telefono, email,
                 direccion, notas, activo, creado_en, actualizado_en
          FROM clientes ORDER BY id`,
    dateColumns: ['creado_en', 'actualizado_en'],
  },
  {
    sheet: 'cliente_documentos',
    table: 'cliente_documentos',
    sql: 'SELECT * FROM cliente_documentos ORDER BY id',
    dateColumns: ['creado_en'],
  },
  {
    sheet: 'rentas',
    table: 'rentas',
    sql: `SELECT id, unidad_id, cliente_id, cliente_nombre, cliente_telefono, cliente_email, fecha_inicio, fecha_fin, estado,
                 monto, deposito, observaciones, creado_en, tipo_servicio, ubicacion_entrega, ubicacion_recoleccion,
                 estado_logistico, precio_base, extras, operador_asignado
          FROM rentas ORDER BY id`,
    dateColumns: ['fecha_inicio', 'fecha_fin', 'creado_en'],
  },
  {
    sheet: 'rentas_refrigerado',
    table: 'rentas_refrigerado',
    sql: 'SELECT * FROM rentas_refrigerado ORDER BY id',
    dateColumns: ['creado_en', 'actualizado_en'],
  },
  {
    sheet: 'rentas_maquinaria',
    table: 'rentas_maquinaria',
    sql: 'SELECT * FROM rentas_maquinaria ORDER BY id',
    dateColumns: ['creado_en', 'actualizado_en'],
  },
  {
    sheet: 'pagos_rentas',
    table: 'pagos',
    sql: 'SELECT * FROM pagos ORDER BY id',
    dateColumns: ['fecha', 'creado_en'],
  },
  {
    sheet: 'rentas_documentos',
    table: 'rentas_documentos',
    sql: 'SELECT * FROM rentas_documentos ORDER BY id',
    dateColumns: ['creado_en'],
  },
  {
    sheet: 'rentas_historial',
    table: 'rentas_historial',
    sql: 'SELECT * FROM rentas_historial ORDER BY id',
    dateColumns: ['fecha'],
  },
  {
    sheet: 'mantenimiento',
    table: 'mantenimiento',
    sql: 'SELECT * FROM mantenimiento ORDER BY id',
    dateColumns: ['fecha_inicio', 'fecha_fin', 'creado_en'],
  },
  {
    sheet: 'checkin_out',
    table: 'checkin_out_registros',
    sql: 'SELECT * FROM checkin_out_registros ORDER BY id',
    dateColumns: ['creado_en'],
  },
  {
    sheet: 'sistema_actividad',
    table: 'sistema_actividad',
    sql: 'SELECT * FROM sistema_actividad ORDER BY id',
    dateColumns: ['fecha'],
  },
  {
    sheet: 'proveedores',
    table: 'proveedores',
    sql: 'SELECT * FROM proveedores ORDER BY id',
    dateColumns: ['creado_en', 'actualizado_en'],
  },
  {
    sheet: 'proveedor_facturas',
    table: 'proveedor_facturas',
    sql: 'SELECT * FROM proveedor_facturas ORDER BY id',
    dateColumns: ['fecha_emision', 'creado_en'],
  },
  {
    sheet: 'proveedor_factura_pagos',
    table: 'proveedor_factura_pagos',
    sql: 'SELECT * FROM proveedor_factura_pagos ORDER BY id',
    dateColumns: ['fecha_pago', 'creado_en'],
  },
];

function isIconColumn(name) {
  const key = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  return key.includes('icon');
}

function parseDateAtDayStart(text) {
  if (!text || typeof text !== 'string') return null;
  const v = text.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateAtDayEnd(text) {
  if (!text || typeof text !== 'string') return null;
  const v = text.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateValue(value) {
  if (value == null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getPeriodo(filtro = {}) {
  const start = parseDateAtDayStart(filtro.desde);
  const end = parseDateAtDayEnd(filtro.hasta);
  if (start && end && start.getTime() > end.getTime()) {
    throw new Error('El rango de fechas es inválido: "desde" no puede ser mayor que "hasta".');
  }
  let label = 'Sin filtro (todos los registros)';
  if (start && end) label = `Del ${filtro.desde} al ${filtro.hasta}`;
  else if (start) label = `Desde ${filtro.desde}`;
  else if (end) label = `Hasta ${filtro.hasta}`;
  return { start, end, label };
}

function rowMatchesRange(row, dateColumns, range) {
  if (!range.start && !range.end) return true;
  if (!dateColumns.length) return true;
  for (const col of dateColumns) {
    const d = parseDateValue(row[col]);
    if (!d) continue;
    if (range.start && d < range.start) continue;
    if (range.end && d > range.end) continue;
    return true;
  }
  return false;
}

function getColumnList(table) {
  let cols = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => c.name);
  if (table === 'usuarios') cols = cols.filter((c) => c !== 'password_hash');
  return cols.filter((c) => !isIconColumn(c));
}

function styleTitle(rowCell) {
  rowCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  rowCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  rowCell.alignment = { vertical: 'middle', horizontal: 'center' };
}

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
}

function autosizeColumns(ws, min = 12, max = 42) {
  ws.columns.forEach((column) => {
    let width = min;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value == null ? '' : String(cell.value);
      width = Math.max(width, Math.min(max, v.length + 2));
    });
    column.width = width;
  });
}

function columnLetter(idx) {
  let n = idx;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out || 'A';
}

function addResumenSheet(workbook, resumenRows, periodLabel) {
  const ws = workbook.addWorksheet('Resumen');
  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = 'SKYLINE ERP - REPORTE GLOBAL CRUD';
  ws.getRow(1).height = 28;
  styleTitle(ws.getCell('A1'));

  ws.mergeCells('A2:F2');
  ws.getCell('A2').value = `Periodo: ${periodLabel}`;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF4A5568' } };

  ws.addRow([]);
  ws.addRow(['Módulo', 'Tabla', 'Registros', '% del total', 'Gráfica', 'Filtro aplicado']);
  styleHeaderRow(ws.getRow(4));

  const total = resumenRows.reduce((s, r) => s + r.count, 0);
  for (const row of resumenRows) {
    const pct = total > 0 ? row.count / total : 0;
    const bars = '█'.repeat(Math.max(1, Math.round(pct * 30)));
    ws.addRow([
      row.sheet,
      row.table,
      row.count,
      pct,
      bars,
      row.filterApplied ? 'Sí (fecha)' : 'Sin fecha (catálogo)',
    ]);
  }

  const startData = 5;
  const endData = Math.max(startData, ws.rowCount);
  ws.autoFilter = `A4:F${endData}`;
  for (let r = startData; r <= ws.rowCount; r += 1) {
    const isEven = r % 2 === 0;
    if (isEven) {
      ws.getRow(r).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } };
      });
    }
    ws.getCell(`C${r}`).numFmt = '#,##0';
    ws.getCell(`D${r}`).numFmt = '0.00%';
  }
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  autosizeColumns(ws);
}

function addDataSheet(workbook, def, rows, columns, periodLabel, filteredByDate) {
  const ws = workbook.addWorksheet(def.sheet.length <= 31 ? def.sheet : def.sheet.slice(0, 31), {
    properties: { tabColor: { argb: 'FF1D4ED8' } },
  });
  const lastCol = columnLetter(columns.length || 1);
  ws.mergeCells(`A1:${lastCol}1`);
  ws.getCell('A1').value = `SKYLINE ERP · ${def.sheet}`;
  ws.getRow(1).height = 24;
  styleTitle(ws.getCell('A1'));

  ws.mergeCells(`A2:${lastCol}2`);
  ws.getCell('A2').value = `Periodo: ${periodLabel}`;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF4A5568' } };

  ws.mergeCells(`A3:${lastCol}3`);
  ws.getCell('A3').value = filteredByDate
    ? 'Filtro: solo registros dentro del rango indicado'
    : 'Filtro: tabla sin columnas de fecha (se exporta catálogo completo)';
  ws.getCell('A3').font = { size: 10, color: { argb: 'FF718096' } };

  ws.addRow(columns);
  styleHeaderRow(ws.getRow(4));
  ws.getRow(4).height = 24;

  for (const row of rows) {
    ws.addRow(
      columns.map((c) => {
        const v = row[c];
        if (isIconColumn(c)) return undefined;
        return v;
      })
    );
  }
  if (!rows.length) {
    ws.addRow(columns.map(() => ''));
  }

  const endRow = Math.max(5, ws.rowCount);
  ws.autoFilter = `A4:${lastCol}${endRow}`;
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  for (let r = 5; r <= ws.rowCount; r += 1) {
    const isEven = r % 2 === 0;
    ws.getRow(r).height = 20;
    ws.getRow(r).eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }
    });
  }
  autosizeColumns(ws);
}

/**
 * @param {FiltroPeriodo} filtro
 * @returns {Promise<Buffer>}
 */
export async function generarBufferExportCrudXlsx(filtro = {}) {
  const range = getPeriodo(filtro);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Skyline ERP';
  workbook.created = new Date();

  /** @type {{ sheet: string, table: string, count: number, filterApplied: boolean }[]} */
  const resumenRows = [];

  for (const def of HOJAS) {
    const cols = getColumnList(def.table);
    const allRows = db.prepare(def.sql).all();
    const filteredRows = allRows.filter((r) => rowMatchesRange(r, def.dateColumns, range));
    addDataSheet(workbook, def, filteredRows, cols, range.label, def.dateColumns.length > 0);
    resumenRows.push({
      sheet: def.sheet,
      table: def.table,
      count: filteredRows.length,
      filterApplied: def.dateColumns.length > 0,
    });
  }

  addResumenSheet(workbook, resumenRows, range.label);
  const ab = await workbook.xlsx.writeBuffer();
  return Buffer.from(ab);
}
