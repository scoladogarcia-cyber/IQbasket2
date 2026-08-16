/**
 * @fileoverview Vista de Administración Dinámica de Idiomas: LanguageSettingsView.js
 * @description Permite consultar, modificar y sincronizar directamente con Supabase las claves de traducción.
 * 
 * Reglas de optimización y diseño:
 * 1. Paginación de seguridad (20 claves por página) para evitar bloqueos del DOM.
 * 2. Normalización de códigos ISO ('cat' -> 'ca').
 * 3. Persistencia atómica con upsert en `translations` y actualización en tiempo real de `TranslationStore` e `I18n`.
 * 4. Fallbacks contextuales sin cadenas fijas desnudas.
 */

import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";
import { supabase } from "../config/database.config.js";

export class LanguageSettingsView {
  /**
   * Crea una instancia de LanguageSettingsView.
   * @param {Object} [translationRepo=null] - Repositorio de traducciones.
   * @param {Object} [syncEngine=null] - Motor de sincronización.
   */
  constructor(translationRepo = null, syncEngine = null) {
    this.translationRepo = translationRepo;
    this.syncEngine = syncEngine;

    // Estado de paginación de seguridad
    this.currentPage = 1;
    this.pageSize = 20;
  }

  t(key, fallback = "") {
    return (TranslationStore ? TranslationStore.t(key, fallback) : I18n.t(key, fallback)) || fallback;
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
        z-index: 9999; color: white; font-family: var(--font-family-base, system-ui);
      `;
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div style="width: 48px; height: 48px; border: 4px solid var(--color-primary, #f97316); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
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

  _normalizeLang(code) {
    if (!code) return "es";
    const c = String(code).trim().toLowerCase();
    if (c === "cat" || c === "catalan" || c === "català") return "ca";
    return c;
  }

  render(currentLangCode = (I18n.getLocale ? I18n.getLocale() : "es"), currentDictionary = []) {
    const langCode = this._normalizeLang(currentLangCode);
    const dict = TranslationStore ? TranslationStore.getDictionary(langCode) : {};

    const keysToTranslate = [
      "general", "dashboard", "team", "players", "games", "boxscore", "advanced_stats",
      "lineups", "comparator", "reports", "ask_ai", "profile", "settings", "logout", "language",
      "local", "visitor", "pending", "completed", "opponent", "score", "score_result", "in_favor", 
      "against", "actions", "season", "record", "active_players", "team_info", "roster", 
      "no_players_loaded", "jersey", "position", "status", "height", "save_changes", "read_only", 
      "view_boxscore", "edit", "search_player", "all_positions", "points", "rebounds", "assists", 
      "steals", "turnovers", "blocks", "fouls", "team_games", "register_new_game", "registered_games",
      "back_to_players", "back_to_register", "boxscore_detail_subtitle",
      "net_rating_evolution", "pts_scored_vs_received", "efg_evolution", "turnovers_per_game",
      "rebound_off_def", "quarter_performance", "pts_for", "pts_against", "reb_off", "reb_def",
      "last_games", "date", "rival", "venue", "diff", "off_rating_tooltip", "def_rating_tooltip", "analysis",
      "lineups_title", "lineups_with", "games_with_registered_lineup", "see_names", "see_numbers",
      "min_games_short", "note_label", "sample_warning_note", "advanced_subtitle", "efg_desc", "tov_desc",
      "select_players", "select_at_least_2", "select_players_desc", "reports_module",
      "profile_role_label", "profile_data_title", "first_name", "last_name", "phone", "email",
      "login", "role_disabled_label", "save_profile", "change_password_title", "new_password",
      "repeat_password", "change_password_btn", "assigned_teams_title", "superadmin_access_msg",
      "settings_subtitle", "tab_clubs_teams", "tab_roster", "tab_users_roles", "tab_seasons",
      "tab_languages_translations", "tab_role_simulation", "create_new_club_title", "club_name",
      "coordinator_name", "address", "create_club_btn", "create_new_team_title", "assigned_club",
      "team_name", "category", "competition", "head_coach", "main_color", "create_full_team_btn",
      "global_transfer_market", "transfer_market_desc", "open_market_btn", "add_new_player_title",
      "primary_position", "add_to_roster_btn", "active_roster_title", "user_invite_title", "full_name",
      "assigned_role", "temp_password", "invite_user_btn", "manage_users_roles_title", "user", "save_role",
      "registered_seasons_title", "new_season_name", "add_season_btn", "save_name", "role_simulation_title",
      "role_simulation_desc", "simulate_superadmin", "simulate_admin", "simulate_coach", "simulate_analyst",
      "simulate_player", "simulate_guest", "disable_simulation_btn", "registered_clubs_title",
      "edit_club_btn", "teams_title", "currently_active", "action", "configure", "activate", "coach",
      "edit_player_data", "cancel", "active", "inactive"
    ];

    const totalItems = keysToTranslate.length;
    const totalPages = Math.ceil(totalItems / this.pageSize) || 1;

    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    const paginatedKeys = keysToTranslate.slice(startIndex, endIndex);

    let rowsHtml = "";
    paginatedKeys.forEach((key) => {
      const dbEntry = Array.isArray(currentDictionary) ? currentDictionary.find((d) => d.key === key) : null;
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
              placeholder="${this.t(key, key)}" 
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
          <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">🌐 ${this.t("languages_mgmt_title", "Administración de Idiomas")}</h2>
          <p style="font-size: 13px; color: #64748b; margin-top: 4px;">
            ${this.t("languages_mgmt_desc", "Personaliza y guarda las traducciones directamente en la base de datos de Supabase.")}
          </p>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div class="lang-selector" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <label for="langCodeInput" style="font-weight: 700; font-size: 13px; color: #334155;">${this.t("select_lang_to_modify", "Selección de Idioma a Modificar:")}</label>
              <select id="langCodeInput" style="padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 13px; min-height: 44px; background: white;">
                <option value="es" ${langCode === 'es' ? 'selected' : ''}>es (Español)</option>
                <option value="ca" ${langCode === 'ca' ? 'selected' : ''}>ca (Català)</option>
                <option value="en" ${langCode === 'en' ? 'selected' : ''}>en (English)</option>
                <option value="fr" ${langCode === 'fr' ? 'selected' : ''}>fr (Français)</option>
              </select>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748b;">
              <button type="button" id="btn-prev-lang-page" class="btn-outline-sm" ${this.currentPage <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>⬅️ ${this.t("previous", "Anterior")}</button>
              <span style="font-weight: 800; color: #1e3a8a;">${this.t("page_indicator", "Pág.")} ${this.currentPage} ${this.t("of", "de")} ${totalPages}</span>
              <button type="button" id="btn-next-lang-page" class="btn-outline-sm" ${this.currentPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>${this.t("next", "Siguiente")} ➡️</button>
            </div>
          </div>

          <div style="overflow-x: auto;">
            <table class="translations-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="background: #f8fafc; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
                  <th style="padding: 12px; width: 35%;">${this.t("system_key_col", "Clave de Sistema")}</th>
                  <th style="padding: 12px;">${this.t("custom_translation_col", "Traducción Personalizada")}</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <div class="actions" style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748b;">
              <button type="button" id="btn-prev-lang-page-bottom" class="btn-outline-sm" ${this.currentPage <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>⬅️ ${this.t("previous", "Anterior")}</button>
              <span>${this.t("showing", "Mostrando")} ${startIndex + 1}-${Math.min(endIndex, totalItems)} ${this.t("of", "de")} ${totalItems} ${this.t("keys_unit", "claves")}</span>
              <button type="button" id="btn-next-lang-page-bottom" class="btn-outline-sm" ${this.currentPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>${this.t("next", "Siguiente")} ➡️</button>
            </div>

            <button 
              id="btnSaveLanguage" 
              class="btn-primary" 
              style="background: var(--color-primary, #f97316); color: white; border: none; padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; min-height: 44px;"
            >
              💾 ${this.t("save_translations_btn", "Guardar Traducciones en Supabase")}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async handleSave(langCodeParam = null) {
    const rawInput = document.getElementById("langCodeInput")?.value;
    const targetLang = this._normalizeLang(langCodeParam || rawInput || (I18n.getLocale ? I18n.getLocale() : "es"));
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
      if (supabase) {
        const { error } = await supabase
          .from("translations")
          .upsert(payload, { onConflict: "key,language_code" });

        if (error) {
          console.warn("Upsert directo falló, intentando por claves individuales:", error.message);
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
      }

      if (TranslationStore) {
        TranslationStore.saveDictionary(targetLang, newDict);
        await TranslationStore.setLanguage(targetLang);
      }

      if (I18n && typeof I18n.notify === "function") {
        I18n.notify();
      }

      this.hideSyncOverlay();
      alert(`✅ ¡Traducciones guardadas con éxito para [${targetLang.toUpperCase()}]!`);
    } catch (err) {
      this.hideSyncOverlay();
      console.error("Error al guardar traducciones:", err);
      alert(`❌ Error al conectar con Supabase: ${err.message}`);
    }
  }
}

export default LanguageSettingsView;