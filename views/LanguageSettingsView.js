/**
 * @fileoverview Vista de Administración Dinámica de Idiomas (LanguageSettingsView.js).
 * Permite modificar traducciones, guardarlas directamente en Supabase (tabla 'translations')
 * y refrescar al instante I18nService y TranslationStore sin perder sincronía ni lanzar errores.
 */

import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";
import { supabase } from "../config/database.config.js";

export class LanguageSettingsView {
  constructor(translationRepo, syncEngine) {
    this.translationRepo = translationRepo;
    this.syncEngine = syncEngine;
  }

  showSyncOverlay(message = "⚡ Guardando idioma...") {
    let overlay = document.getElementById("sync-loading-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "sync-loading-overlay";
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(4px);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 9999; color: white; font-family: system-ui, sans-serif;
      `;
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div style="width: 48px; height: 48px; border: 4px solid #ea580c; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
      <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 800;">${message}</h3>
      <p style="margin: 0; color: #94a3b8; font-size: 13px;">Actualizando diccionario en Supabase...</p>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    overlay.style.display = "flex";
  }

  hideSyncOverlay() {
    const overlay = document.getElementById("sync-loading-overlay");
    if (overlay) overlay.style.display = "none";
  }

  /**
   * Normaliza los códigos de idioma ('cat' -> 'ca')
   */
  _normalizeLang(code) {
    if (!code) return "es";
    const c = String(code).trim().toLowerCase();
    if (c === "cat" || c === "catalan" || c === "català") return "ca";
    return c;
  }

  render(currentLangCode = I18n.getLocale(), currentDictionary = []) {
    const langCode = this._normalizeLang(currentLangCode);
    const dict = TranslationStore.getDictionary(langCode);

    // Claves principales del sistema a personalizar
    const keysToTranslate = [
      "dashboard", "team", "players", "games", "boxscore", "advanced_stats",
      "lineups", "comparator", "reports", "ask_ai", "profile", "settings",
      "logout", "language", "local", "visitor", "pending", "completed",
      "opponent", "score", "in_favor", "against", "actions", "season",
      "record", "active_players", "team_info", "roster", "no_players_loaded",
      "jersey", "position", "status", "height", "save_changes", "read_only", 
      "view_boxscore", "edit", "search_player", "all_positions", "points", 
      "rebounds", "assists", "steals", "turnovers", "blocks", "fouls"
    ];

    let rowsHtml = "";
    keysToTranslate.forEach((key) => {
      const dbEntry = currentDictionary.find((d) => d.key === key);
      const val = dbEntry ? (dbEntry.translation || dbEntry.value) : (dict[key] || "");

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
            Personaliza y guarda las traducciones directamente en la base de datos de Supabase.
          </p>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div class="lang-selector" style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; flex-wrap: wrap;">
            <label for="langCodeInput" style="font-weight: 700; font-size: 13px; color: #334155;">Selección de Idioma a Modificar:</label>
            <select id="langCodeInput" style="padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 13px; min-height: 44px; background: white;">
              <option value="es" ${langCode === 'es' ? 'selected' : ''}>es (Español)</option>
              <option value="ca" ${langCode === 'ca' ? 'selected' : ''}>ca (Català)</option>
              <option value="en" ${langCode === 'en' ? 'selected' : ''}>en (English)</option>
              <option value="fr" ${langCode === 'fr' ? 'selected' : ''}>fr (Français)</option>
            </select>
          </div>

          <div style="overflow-x: auto;">
            <table class="translations-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="background: #f8fafc; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
                  <th style="padding: 12px; width: 35%;">Clave de Sistema</th>
                  <th style="padding: 12px;">Traducción Personalizada</th>
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
              💾 Guardar Traducciones en Supabase
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Guarda las traducciones editadas directamente en Supabase y refresca I18nService.
   */
  async handleSave(langCodeParam = null) {
    const rawInput = document.getElementById("langCodeInput")?.value;
    const targetLang = this._normalizeLang(langCodeParam || rawInput || I18n.getLocale());
    const inputs = document.querySelectorAll(".i18n-input");

    const payload = [];
    const newDict = {};

    inputs.forEach((input) => {
      const key = input.getAttribute("data-key");
      const value = input.value.trim();

      if (key && value) {
        newDict[key] = value;
        payload.push({
          key: key,
          language_code: targetLang,
          translation: value
        });
      }
    });

    if (payload.length === 0) {
      alert("⚠️ No hay campos de traducción para guardar.");
      return;
    }

    this.showSyncOverlay(`💾 Guardando traducciones [${targetLang.toUpperCase()}] en Supabase...`);

    try {
      // 1. Guardar en Supabase (upsert directo en la tabla public.translations)
      const { data, error } = await supabase
        .from("translations")
        .upsert(payload, { onConflict: "key,language_code" });

      if (error) {
        console.warn("Upsert directo falló, ejecutando actualización secuencial de claves:", error.message);
        for (const item of payload) {
          await supabase
            .from("translations")
            .delete()
            .eq("key", item.key)
            .eq("language_code", item.language_code);
          await supabase
            .from("translations")
            .insert([item]);
        }
      }

      // 2. Guardar en memoria local y actualizar I18nService al instante
      TranslationStore.saveDictionary(targetLang, newDict);
      TranslationStore.setLanguage(targetLang);

      if (I18n.dictionaries && I18n.dictionaries[targetLang]) {
        Object.assign(I18n.dictionaries[targetLang], newDict);
      }

      // Notificar suscriptores de forma segura
      if (typeof I18n.notify === "function") {
        I18n.notify();
      } else if (typeof I18n._notify === "function") {
        I18n._notify();
      }

      this.hideSyncOverlay();
      alert(`✅ ¡Traducciones guardadas con éxito en Supabase para [${targetLang.toUpperCase()}]!`);
      
      // Recargar la aplicación para aplicar los cambios globales
      window.location.reload();
    } catch (err) {
      this.hideSyncOverlay();
      console.error("Error al guardar traducciones:", err);
      alert(`❌ Error al conectar con Supabase: ${err.message}`);
    }
  }
}

export default LanguageSettingsView;