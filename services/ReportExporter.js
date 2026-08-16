/**
 * @fileoverview Servicio de Exportación e Impresión de Informes: ReportExporter.js
 * @description Genera vistas de impresión optimizadas e inyecta estilos CSS para exportación PDF.
 */

import { TranslationStore } from "./TranslationStore.js";
import { DataStore } from "./DataStore.js";
import { I18n } from "./I18nService.js";

export class ReportExporter {
  /**
   * Genera una ventana o iframe de impresión con estilos CSS embebidos para exportar a PDF.
   * @param {string} title - Título del documento.
   * @param {string} contentHtml - Estructura HTML que formará el reporte.
   */
  static printReport(title = "Informe_IQ_Basket", contentHtml = "") {
    const printWindow = window.open("", "_blank", "width=1024,height=768");
    if (!printWindow) {
      alert(TranslationStore ? TranslationStore.t("popup_blocked", "La ventana emergente para imprimir fue bloqueada. Permite las ventanas emergentes.") : "La ventana emergente para imprimir fue bloqueada.");
      return;
    }

    const htmlDoc = `
      <!DOCTYPE html>
      <html lang="${I18n.getLocale ? I18n.getLocale() : 'es'}">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 15mm 12mm;
          }
          *, *::before, *::after {
            box-sizing: border-box;
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #0f172a;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            text-align: center;
            font-size: 11px;
            margin-top: 10px;
          }
          .data-table th, .data-table td {
            padding: 6px 8px;
            border-bottom: 1px solid #e2e8f0;
          }
          .data-table th {
            background-color: #f1f5f9 !important;
            font-weight: 800;
            color: #475569;
            text-transform: uppercase;
          }
          h1, h2, h3, h4 {
            margin: 0 0 8px 0;
            font-weight: 800;
          }
          svg {
            max-width: 100%;
          }
        </style>
      </head>
      <body>
        ${contentHtml}
        <script>
          window.onload = function() {
            window.focus();
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlDoc);
    printWindow.document.close();
  }
}

export default ReportExporter;