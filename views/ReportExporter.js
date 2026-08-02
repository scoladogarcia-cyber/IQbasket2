/**
 * @fileoverview Módulo de Exportación e Impresión de Informes en PDF (ReportExporter.js).
 * @description Permite imprimir o descargar informes en PDF formateados para impresión.
 */

export class ReportExporter {
  /**
   * Abre una ventana de impresión para convertir el HTML en PDF.
   * 
   * @param {string} title - Título del documento.
   * @param {string} htmlContent - Contenido HTML renderizado por las Vistas.
   */
  static printReport(title, htmlContent) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            h2, h3 { color: #111; margin-bottom: 10px; }
            .kpi-grid { display: flex; gap: 15px; margin-bottom: 20px; }
            .kpi-card { border: 1px solid #ccc; padding: 10px; border-radius: 6px; text-align: center; flex: 1; }
            .kpi-val { font-size: 20px; font-weight: bold; display: block; }
            .kpi-lbl { font-size: 11px; color: #666; }
            table.data-table, table.period-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 12px; }
            th { background-color: #f4f4f4; font-weight: bold; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }
}