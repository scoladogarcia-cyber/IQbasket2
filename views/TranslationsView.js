/**
 * @fileoverview Vista de Configuración de Traducciones (TranslationsView.js).
 * Pantalla para el SUPERADMIN que permite editar y personalizar las etiquetas de la aplicación.
 */

import { TranslationStore } from "../services/TranslationStore.js";

export class TranslationsView {
  constructor(authController) {
    this.auth = authController;
    this.selectedEditingLang = TranslationStore.currentLang || "es";
  }

  _isSuperAdmin() {
    if (!this.auth || typeof this.auth.hasRole !== "function") return true;
    return this.auth.hasRole("SUPERADMIN");
  }

  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!this._isSuperAdmin()) {
      container.innerHTML = `
        <div style="padding: 24px; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 12px; font-weight: 700;">
          🔒 Acceso restringido: Esta pantalla de administración de traducciones e idiomas es exclusiva para el rol SUPERADMIN.
        </div>`;
      return;
    }

    const dict = TranslationStore.getDictionary(this.selectedEditingLang);

    const rowsMarkup = Object.keys(dict).map(key => {
      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px; font-weight: 700; color: #1e3a8a; font-family: monospace; font-size: 13px;">
            ${key}
          </td>
          <td style="padding: 12px;">
            <input type="text" 
                   class="inp-trans-val" 
                   data-key="${key}" 
                   value="${dict[key] || ''}" 
                   style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 600; box-sizing: border-box;" />
          </td>
        </tr>
      `;
    }).join("");

    container.innerHTML = `
      <div style="max-width: 1000px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; padding-bottom: 40px;">
        
        <!-- Header -->
        <div style="margin-bottom: 24px;">
          <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 10px;">
            ⚙️ Configuración de Idiomas y Traducciones
          </h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">
            Panel de control exclusivo de SUPERADMIN. Edita y guarda los textos de los menús e interfaz para cada idioma.
          </p>
        </div>

        <!-- Panel de Control -->
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <label style="font-size: 13px; font-weight: 700; color: #334155;">Idioma a editar:</label>
              <select id="select-editing-lang" style="padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 800; background: white;">
                <option value="es" ${this.selectedEditingLang === 'es' ? 'selected' : ''}>🇪🇸 Español (ES)</option>
                <option value="cat" ${this.selectedEditingLang === 'cat' ? 'selected' : ''}>🏴󠁥🇸󠁣󠁴󠁿 Català (CAT)</option>
                <option value="en" ${this.selectedEditingLang === 'en' ? 'selected' : ''}>🇬🇧 English (EN)</option>
              </select>
            </div>

            <button id="btn-save-translations" style="background: #1e3a8a; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              💾 Guardar Cambios
            </button>
          </div>

          <!-- Tabla de Claves -->
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="background: #f8fafc; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
                  <th style="padding: 10px 12px; width: 35%;">CLAVE DE TEXTO</th>
                  <th style="padding: 10px 12px;">TRADUCCIÓN EN PANTALLA</th>
                </tr>
              </thead>
              <tbody>
                ${rowsMarkup}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    `;

    // Evento Cambio de Idioma a editar
    container.querySelector("#select-editing-lang")?.addEventListener("change", (e) => {
      this.selectedEditingLang = e.target.value;
      this.render(containerId);
    });

    // Evento Guardar Traducciones
    container.querySelector("#btn-save-translations")?.addEventListener("click", () => {
      const inputs = container.querySelectorAll(".inp-trans-val");
      const updatedDict = {};

      inputs.forEach(inp => {
        const key = inp.getAttribute("data-key");
        updatedDict[key] = inp.value.trim();
      });

      TranslationStore.saveDictionary(this.selectedEditingLang, updatedDict);
      
      alert(`✅ Traducciones para [${this.selectedEditingLang.toUpperCase()}] guardadas correctamente.`);
      
      // Si estamos editando el idioma que está activo actualmente, actualizamos la vista
      if (this.selectedEditingLang === TranslationStore.currentLang) {
        window.location.reload();
      }
    });
  }
}