import { useState } from 'react';
import { Icon } from '@iconify/react';
import { downloadReporteCatalogoCrudXlsx } from '../api/client';
import { useNotification } from '../context/NotificationContext';

export function Reportes() {
  const { toast } = useNotification();
  const [exporting, setExporting] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  async function handleExportCrud() {
    if (desde && hasta && desde > hasta) {
      toast('Rango inválido: "Desde" no puede ser mayor que "Hasta"', 'error');
      return;
    }
    setExporting(true);
    try {
      await downloadReporteCatalogoCrudXlsx({ desde: desde || undefined, hasta: hasta || undefined });
      toast('Archivo Excel descargado');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo descargar el archivo', 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Reportes</h1>
        <p className="mt-1 text-sm font-medium text-gray-500">
          Exporta los datos del sistema para respaldo o análisis externo
        </p>
      </header>

      <div className="rounded-lg border border-skyline-border bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Exportar datos del sistema</h2>
        <p className="mb-4 text-sm text-gray-500">
          Selecciona un periodo opcional para exportar en Excel los registros del sistema. El archivo se
          genera con formato mejorado, resumen general y gráficas de barras para análisis rápido.
        </p>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm text-gray-600">
            <span className="mb-1 block font-medium text-gray-700">Desde</span>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="text-sm text-gray-600">
            <span className="mb-1 block font-medium text-gray-700">Hasta</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="input w-full"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={() => {
                setDesde('');
                setHasta('');
              }}
              disabled={exporting}
            >
              Limpiar fechas
            </button>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                setDesde(today);
                setHasta(today);
              }}
              disabled={exporting}
            >
              Solo hoy
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary inline-flex items-center gap-2"
            disabled={exporting}
            onClick={() => void handleExportCrud()}
          >
            <Icon icon="mdi:microsoft-excel" className="size-5 text-white" aria-hidden />
            {exporting ? 'Generando…' : 'Descargar reporte global (Excel)'}
          </button>
          <span className="text-xs text-gray-500">Formato .xlsx · hojas por módulo + resumen y gráficas</span>
        </div>
      </div>
    </div>
  );
}
