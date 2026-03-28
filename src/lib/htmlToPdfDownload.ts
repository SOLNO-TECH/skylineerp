import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Parte el lienzo en franjas de altura entera en píxeles y una página PDF por franja.
 * Evita el bug de “líneas duplicadas” al usar la misma imagen con offsets en mm (redondeos / cortes).
 */
function canvasToPagedPdf(canvas: HTMLCanvasElement, fileName: string): void {
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const pdfWidth = pageWidth - 2 * margin;
  const pdfHeight = pageHeight - 2 * margin;

  const srcW = canvas.width;
  const srcH = canvas.height;
  if (srcW <= 0 || srcH <= 0) {
    pdf.save(fileName);
    return;
  }

  // Altura de una página en píxeles (misma anchura que el lienzo → escala uniforme)
  const pageHpx = Math.max(1, Math.floor((pdfHeight / pdfWidth) * srcW));

  let y0 = 0;
  let pageIndex = 0;
  while (y0 < srcH) {
    const sliceH = Math.min(pageHpx, srcH - y0);
    if (sliceH <= 0) break;

    const slice = document.createElement('canvas');
    slice.width = srcW;
    slice.height = sliceH;
    const ctx = slice.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo preparar la imagen para el PDF');
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, srcW, sliceH);
    ctx.drawImage(canvas, 0, y0, srcW, sliceH, 0, 0, srcW, sliceH);

    const jpeg = slice.toDataURL('image/jpeg', 0.92);
    const sliceHmm = (sliceH / srcW) * pdfWidth;

    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(jpeg, 'JPEG', margin, margin, pdfWidth, sliceHmm);

    y0 += sliceH;
    pageIndex++;
  }

  pdf.save(fileName);
}

/**
 * Renders a full HTML document off-screen and downloads it as a multi-page A4 PDF.
 */
export async function downloadHtmlAsPdf(html: string, fileName: string): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:820px;height:400px;border:0;opacity:0;pointer-events:none;overflow:visible;';
  document.body.appendChild(iframe);

  const iDoc = iframe.contentDocument;
  const iWin = iframe.contentWindow;
  if (!iDoc || !iWin) {
    document.body.removeChild(iframe);
    throw new Error('No se pudo preparar el documento para el PDF');
  }

  try {
    iDoc.open();
    iDoc.write(html);
    iDoc.close();

    await new Promise<void>((resolve) => {
      if (iDoc.readyState === 'complete') {
        requestAnimationFrame(() => resolve());
        return;
      }
      iWin.addEventListener('load', () => requestAnimationFrame(() => resolve()), { once: true });
    });

    const root =
      (iDoc.querySelector('.sheet') as HTMLElement | null) ?? iDoc.body;

    /* Buffer extra: html2canvas usa windowHeight; si es menor que el contenido, corta el pie. */
    const layoutH = Math.max(
      root.scrollHeight,
      root.offsetHeight,
      root.getBoundingClientRect().height,
      120
    );
    const bufferPx = 72;
    const captureWindowH = Math.ceil(layoutH + bufferPx);
    iframe.style.height = `${captureWindowH}px`;
    iframe.style.minHeight = `${captureWindowH}px`;

    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));

    const canvas = await html2canvas(root, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 820,
      windowHeight: captureWindowH,
      scrollX: 0,
      scrollY: 0,
    });

    canvasToPagedPdf(canvas, fileName);
  } finally {
    document.body.removeChild(iframe);
  }
}
