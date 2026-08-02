/**
 * @fileoverview Vista de Presentación: Administración Dinámica de Idiomas (LanguageSettingsView.js).
 * @description Pantalla Zero Hardcode que permite crear/modificar las traducciones en BBDD.
 */

import { i18n } from "../core-modules/i18n/I18nEngine.js";
import { Translation } from "../domain/entities/Translation.js";

export class LanguageSettingsView {
  /**
   * @param {Object} translationRepo - Instancia de TranslationRepository.
   * @param {Object} syncEngine - Instancia de SyncEngine.
   */
  constructor(translationRepo, syncEngine) {
    this.translationRepo = translationRepo;
    this.syncEngine = syncEngine;
  }

  /**
   * Renderiza el formulario dinámico de traducciones.
   * 
   * @param {string} [currentLangCode="en"] - Código del idioma activo.
   * @param {Array<Object>} [currentDictionary=[]] - Traducciones recuperadas de BBDD.
   * @returns {string} Markup HTML.
   */
  render(currentLangCode = "en", currentDictionary = []) {
    const keysToTranslate = [
      "points", "rebounds", "assists", "steals", "turnovers", "blocks",
      "fouls", "pir", "efg", "true_shooting", "plus_minus", "save", "cancel"
    ];

    let rowsHtml = "";
    keysToTranslate.forEach((key) => {
      const existing = currentDictionary.find((d) => d.key === key);
      const val = existing ? existing.value : "";

      rowsHtml += `
        <tr>
          <td><code>${key}</code></td>
          <td>
            <input type="text" data-key="${key}" value="${val}" placeholder="${i18n.t(key)}" class="i18n-input" />
          </td>
        </tr>
      `;
    });

    return `
      <div class="language-settings-view">
        <h2>${i18n.t("language")}</h2>
        <div class="lang-selector">
          <label>Código ISO de Idioma:</label>
          <input type="text" id="langCodeInput" value="${currentLangCode}" placeholder="es, en, ca, fr..." />
        </div>
        <table class="translations-table">
          <thead>
            <tr>
              <th>Clave de Sistema</th>
              <th>Traducción Personalizada</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="actions">
          <button id="btnSaveLanguage" class="btn-primary">${i18n.t("save")}</button>
        </div>
      </div>
    `;
  }

  /**
   * Guarda las traducciones editadas en BBDD.
   */
  async handleSave(langCode, langName = "Custom") {
    const inputs = document.querySelectorAll(".i18n-input");
    const translationsToSave = [];

    inputs.forEach((input) => {
      const key = input.getAttribute("data-key");
      const value = input.value.trim();

      if (value) {
        const trans = new Translation({
          langCode,
          langName,
          key,
          value
        });
        translationsToSave.push(trans);
      }
    });

    for (const t of translationsToSave) {
      await this.syncEngine.enqueueOperation("translations", "CREATE", t.toJSON());
    }

    i18n.loadLanguageFromDB(langCode, translationsToSave);
    i18n.setLanguage(langCode);
  }
}