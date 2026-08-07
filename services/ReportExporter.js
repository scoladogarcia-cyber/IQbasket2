/**
 * @fileoverview Módulo de Exportación e Impresión de Informes en PDF (ReportExporter.js).
 * @description Permite imprimir o descargar informes en PDF formateados para impresión con soporte multilingüe.
 */

import { TranslationStore } from "./TranslationStore.js";

export class ReportExporter {
  /**
   * Abre una ventana de impresión para convertir el HTML en PDF en el idioma activo.
   * 
   * @param {string} title - Título del documento.
   * @param {string} htmlContent - Contenido HTML renderizado por las Vistas.
   */
  static printReport(title, htmlContent) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert(TranslationStore.t("allow_popups", "Por favor, permite las ventanas emergentes para generar el informe en PDF."));
      return;
    }

    const currentLang = TranslationStore.currentLang || "es";
    const documentTitle = title || TranslationStore.t("report", "Informe Estadístico");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${currentLang}">
        <head>
          <meta charset="UTF-8">
          <title>${documentTitle}</title>
          <style>
            @media print {
              @page { margin: 15mm; size: auto; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; color: #0f172a; line-height: 1.4; }
            h2, h3 { color: #0f172a; margin-bottom: 10px; font-weight: 800; }
            .kpi-grid { display: flex; gap: 15px; margin-bottom: 20px; }
            .kpi-card { border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; text-align: center; flex: 1; background: #f8fafc; }
            .kpi-val { font-size: 22px; font-weight: 900; display: block; color: #1e3a8a; }
            .kpi-lbl { font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; }
            table.data-table, table.period-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: center; font-size: 12px; }
            th { background-color: #f1f5f9; font-weight: 800; color: #475569; text-transform: uppercase; }
            .print-footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: right; border-top: 1px solid #e2e8f0; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px;">
            <div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #1e3a8a;">IQ BASKET</h1>
              <span style="font-size: 12px; color: #64748b;">${TranslationStore.t("app_tagline", "Análisis estadístico de baloncesto")}</span>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              <strong>${TranslationStore.t("season", "Temporada")}:</strong> 2026<br/>
              <span>${new Date().toLocaleDateString(currentLang)}</span>
            </div>
          </div>

          ${htmlContent}

          <div class="print-footer">
            IQ Basket Stats & Analytics · ${TranslationStore.t("generated_report", "Informe generado automáticamente")}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 300);
  }
}