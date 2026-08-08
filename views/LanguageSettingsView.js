/**
 * @fileoverview Vista de Presentación: Administración Dinámica de Idiomas (LanguageSettingsView.js).
 * @description Pantalla Zero Hardcode que permite modificar las traducciones y sincronizarlas mediante TranslationStore, I18nService y SyncEngine.
 * Adaptada para PWA y móvil con soporte oficial para ES, CA, EN y FR.
 */

import { TranslationStore } from "../services/TranslationStore.js";
import { Translation } from "../domain/entities/Translation.js";
import { I18n } from "../services/I18nService.js";

export class LanguageSettingsView {
  /**
   * @param {Object} translationRepo - Instancia opcional de TranslationRepository.
   * @param {Object} syncEngine - Instancia opcional de SyncEngine.
   */
  constructor(translationRepo, syncEngine) {
    this.translationRepo = translationRepo;
    this.syncEngine = syncEngine;
  }

  /**
   * Renderiza el formulario dinámico de traducciones.
   * 
   * @param {string} [currentLangCode] - Código del idioma activo.
   * @param {Array<Object>} [currentDictionary=[]] - Traducciones opcionales.
   * @returns {string} Markup HTML.
   */
  render(currentLangCode = I18n.getLocale(), currentDictionary = []) {
    const rawLangCode = currentLangCode || I18n.getLocale() || "es";
    const langCode = rawLangCode === 'cat' ? 'ca' : rawLangCode;
    const dict = TranslationStore.getDictionary(langCode);

    // Claves principales del sistema a personalizar
    const keysToTranslate = [
      "dashboard", "team", "players", "games", "boxscore", "advanced_stats",
      "lineups", "comparator", "reports", "ask_ai", "profile", "settings",
      "logout", "language", "local", "visitor", "pending", "completed",
      "opponent", "score", "in_favor", "against", "actions", "season",
      "save_changes", "read_only", "view_boxscore", "edit", "search_player",
      "all_positions", "points", "rebounds", "assists", "steals", "turnovers",
      "blocks", "fouls", "pir", "efg", "plus_minus"
    ];

    let rowsHtml = "";
    keysToTranslate.forEach((key) => {
      // Buscar en diccionario local o en array pasado
      const dbEntry = currentDictionary.find((d) => d.key === key);
      const val = dbEntry ? dbEntry.value : (dict[key] || "");

      rowsHtml += `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px; font-weight: 700; color: #1e3a8a; font-family: monospace; font-size: 13px;">
            <code>${key}</code>
          </td>
          <td style="padding: 12px;">
            <input 
              type="text" 
              data-key="${key}" 
              value="${val}" 
              placeholder="${TranslationStore.t(key, key)}" 
              class="i18n-input" 
              style="width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 600; box-sizing: border-box;"
            />
          </td>
        </tr>
      `;
    });

    return `
      <div class="language-settings-view" style="max-width: 1000px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">🌐 ${TranslationStore.t("language", "Administración de Idiomas")}</h2>
          <p style="font-size: 13px; color: #64748b; margin-top: 4px;">
            ${TranslationStore.t("i18n_subtitle", "Personaliza y gestiona las traducciones globales de IQ Basket.")}
          </p>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div class="lang-selector" style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; flex-wrap: wrap;">
            <label for="langCodeInput" style="font-weight: 700; font-size: 13px; color: #334155;">${TranslationStore.t("select_language_iso", "Código ISO / Selección de Idioma")}:</label>
            <select id="langCodeInput" style="padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 13px; min-height: 44px; background: white;">
              <option value="es" ${langCode === 'es' ? 'selected' : ''}>es (Español)</option>
              <option value="ca" ${langCode === 'ca' || langCode === 'cat' ? 'selected' : ''}>ca (Català)</option>
              <option value="en" ${langCode === 'en' ? 'selected' : ''}>en (English)</option>
              <option value="fr" ${langCode === 'fr' ? 'selected' : ''}>fr (Français)</option>
            </select>
          </div>

          <div style="overflow-x: auto;">
            <table class="translations-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="background: #f8fafc; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
                  <th style="padding: 12px; width: 35%;">${TranslationStore.t("system_key", "Clave de Sistema")}</th>
                  <th style="padding: 12px;">${TranslationStore.t("custom_translation", "Traducción Personalizada")}</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <div class="actions" style="margin-top: 20px; display: flex; justify-content: flex-end;">
            <button 
              id="btnSaveLanguage" 
              class="btn-primary" 
              style="background: var(--color-primary, #ea580c); color: white; border: none; padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; min-height: 44px;"
            >
              💾 ${TranslationStore.t("save_changes", "Guardar Traducciones")}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Guarda las traducciones editadas tanto localmente en TranslationStore como en la cola de sincronización.
   */
  async handleSave(langCode = null, langName = "Custom") {
    const rawInput = document.getElementById("langCodeInput")?.value.trim().toLowerCase();
    const targetLang = langCode || (rawInput === 'cat' ? 'ca' : rawInput) || I18n.getLocale();
    const inputs = document.querySelectorAll(".i18n-input");
    
    const translationsToSave = [];
    const newDict = {};

    inputs.forEach((input) => {
      const key = input.getAttribute("data-key");
      const value = input.value.trim();

      if (value) {
        newDict[key] = value;

        if (Translation) {
          const trans = new Translation({
            langCode: targetLang,
            langName,
            key,
            value
          });
          translationsToSave.push(trans);
        }
      }
    });

    // 1. Guardado local inmediato en TranslationStore e I18nService
    TranslationStore.saveDictionary(targetLang, newDict);
    TranslationStore.setLanguage(targetLang);

    // 2. Encolado opcional en BBDD si existe el motor de sincronización
    if (this.syncEngine && typeof this.syncEngine.enqueueOperation === "function") {
      for (const t of translationsToSave) {
        await this.syncEngine.enqueueOperation("translations", "CREATE", typeof t.toJSON === "function" ? t.toJSON() : t);
      }
    }

    alert(`✅ ${TranslationStore.t("i18n_saved_msg", "Traducciones guardadas con éxito para")} [${targetLang.toUpperCase()}].`);
    window.location.reload();
  }
}

export default LanguageSettingsView;