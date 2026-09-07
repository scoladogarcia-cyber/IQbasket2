/**
 * @fileoverview Servicio de Exportación e Impresión de Informes: ReportExporter.js
 * @description Genera vistas de impresión optimizadas y exige una autorización
 * de recurso explícita antes de sacar datos fuera de la interfaz.
 */

import { TranslationStore } from "./TranslationStore.js";
import { I18n } from "./I18nService.js";

export class ReportExporter {
  static _activeAuthorization = null;

  /**
   * Ejecuta una exportación síncrona dentro de una decisión de autorización.
   * La decisión se consume únicamente durante el callback y nunca queda global.
   */
  static withAuthorization(authorization, callback) {
    if (!authorization?.allowed) {
      throw new Error(authorization?.reason || "REPORT_EXPORT_DENIED");
    }
    if (typeof callback !== "function") {
      throw new Error("REPORT_EXPORT_CALLBACK_REQUIRED");
    }
    if (ReportExporter._activeAuthorization) {
      throw new Error("REPORT_EXPORT_AUTHORIZATION_REENTRY_DENIED");
    }

    ReportExporter._activeAuthorization = authorization;
    try {
      return callback();
    } finally {
      ReportExporter._activeAuthorization = null;
    }
  }

  static _resolveAuthorization(options = {}) {
    return options?.authorization || ReportExporter._activeAuthorization || null;
  }

  /**
   * Genera una ventana de impresión con estilos CSS embebidos para exportar a PDF.
   * Falla cerrado cuando el caller no aporta una decisión positiva emitida por
   * ReportAccessPolicy. Ocultar el botón nunca se considera una medida de seguridad.
   *
   * @param {string} title Título del documento.
   * @param {string} contentHtml HTML ya reducido al scope autorizado.
   * @param {{authorization?: object}} options Decisión explícita opcional.
   */
  static printReport(title = "Informe_IQ_Basket", contentHtml = "", options = {}) {
    const authorization = ReportExporter._resolveAuthorization(options);
    if (!authorization?.allowed) {
      console.warn("[ReportExporter] Exportación bloqueada: falta autorización de recurso.");
      if (typeof alert === "function") {
        alert("⚠️ No tienes permiso para imprimir este informe o contiene información fuera de tu alcance.");
      }
      return false;
    }

    const printWindow = window.open("", "_blank", "width=1024,height=768");
    if (!printWindow) {
      alert(TranslationStore
        ? TranslationStore.t("popup_blocked", "La ventana emergente para imprimir fue bloqueada. Permite las ventanas emergentes.")
        : "La ventana emergente para imprimir fue bloqueada.");
      return false;
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
          *, *::before, *::after { box-sizing: border-box; }
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
          h1, h2, h3, h4 { margin: 0 0 8px 0; font-weight: 800; }
          svg { max-width: 100%; }
        </style>
      </head>
      <body>
        ${contentHtml}
        <script>
          window.onload = function() {
            window.focus();
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlDoc);
    printWindow.document.close();
    return true;
  }
}

export default ReportExporter;
