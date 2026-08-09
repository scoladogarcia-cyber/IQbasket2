/**
 * @fileoverview Vista de Configuración de IQ Basket (TranslationsView.js).
 * Traducida dinámicamente sin claves desnudas y sincronizada en tiempo real con Supabase.
 */

import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { supabase } from "../config/database.config.js";
import { LanguageSettingsView } from "./LanguageSettingsView.js";
import { I18n } from "../services/I18nService.js";

export class TranslationsView {
  constructor(authController) {
    this.auth = authController;
    this.currentUserRole = localStorage.getItem("iq_user_role") || "SUPERADMIN";
    this.simulatedRole = localStorage.getItem("iq_simulated_role") || null;

    this.activeTab = "club";
    this.clubSubView = "list"; // 'list' | 'edit-club' | 'edit-team'
    this.selectedTeamForEdit = null;
    this.selectedClubForEdit = null;

    // Sub-vista de administración de idiomas
    this.languageSettingsView = new LanguageSettingsView();

    // Mercado Global
    this.marketSearchQuery = "";
    this.marketCurrentPage = 1;
    this.marketItemsPerPage = 10;
    this.allMarketPlayers = [];
    this.isMarketLoaded = false;

    // Idiomas y Diccionario en Supabase
    this.selectedLangForEdit = localStorage.getItem("iq_lang") || "es";
    this.availableLangs = [
      { code: "es", label: "Español (ES)" },
      { code: "cat", label: "Català (CAT)" },
      { code: "en", label: "English (EN)" },
      { code: "fr", label: "Français (FR)" }
    ];
    this.dbTranslations = [];

    // Temporadas
    this.seasonsList = [];

    // Traspasos
    const storedTransfers = localStorage.getItem("iq_transfers");
    this.transfers = storedTransfers ? JSON.parse(storedTransfers) : [];

    // Perfiles
    this.profilesList = [];
  }

  t(key, fallback = "") {
    return TranslationStore.t(key, fallback);
  }

  getEffectiveRole() {
    return this.simulatedRole || this.currentUserRole;
  }

  showSyncOverlay(message = "⚡ Sincronizando con Supabase...") {
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
      <p style="margin: 0; color: #94a3b8; font-size: 13px;">Guardando cambios en la nube...</p>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    overlay.style.display = "flex";
  }

  hideSyncOverlay() {
    const overlay = document.getElementById("sync-loading-overlay");
    if (overlay) overlay.style.display = "none";
  }

  _can(action) {
    const role = this.getEffectiveRole();
    switch (action) {
      case "VIEW_TAB_TRANSLATIONS":
      case "CREATE_CLUB":
      case "ASSIGN_ADMIN_ROLE":
      case "DELETE_SEASON":
      case "VIEW_TAB_SIMULATION":
        return role === "SUPERADMIN";

      case "VIEW_TAB_USERS":
      case "MANAGE_CLUB_DATA":
      case "CREATE_TEAM":
      case "DELETE_TEAM":
      case "INVITE_USERS":
      case "MANAGE_ROLES":
        return ["SUPERADMIN", "ADMIN"].includes(role);

      case "VIEW_TAB_PLAYERS":
      case "MANAGE_PLAYERS":
      case "APPROVE_TRANSFERS":
        return ["SUPERADMIN", "ADMIN", "ENTRENADOR"].includes(role);

      case "VIEW_TAB_SEASONS":
      case "CREATE_SEASON":
        return ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA"].includes(role);

      case "VIEW_TAB_REQUESTS":
      case "REQUEST_JOIN_CLUB":
        return ["ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"].includes(role);

      case "EDIT_DATA":
        return ["SUPERADMIN", "ADMIN", "ENTRENADOR"].includes(role);

      default:
        return false;
    }
  }

  async _fetchProfiles() {
    try {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (!error && data) {
        this.profilesList = data;
      }
    } catch (e) {
      console.warn("Error leyendo perfiles:", e);
    }
  }

  async _fetchSeasons() {
    try {
      const activeTeamId = DataStore.getActiveTeamId();
      const { data, error } = await supabase.from("seasons").select("*").order("created_at", { ascending: false });
      
      if (!error && data && data.length > 0) {
        this.seasonsList = data;
      } else {
        const storedSeasons = localStorage.getItem("iq_seasons");
        this.seasonsList = storedSeasons ? JSON.parse(storedSeasons) : [
          { id: "d7a70e68-d3d1-4ae9-b590-3d3291bd8a4d", name: "2026", team_id: activeTeamId }
        ];
      }
      this._saveSeasonsLocal();
    } catch (e) {
      console.warn("Error leyendo temporadas de Supabase:", e);
    }
  }

  _saveSeasonsLocal() {
    localStorage.setItem("iq_seasons", JSON.stringify(this.seasonsList));
    const sidebarSeasonSelect = document.getElementById("sidebar-select-season");
    if (sidebarSeasonSelect) {
      const activeSeason = localStorage.getItem("iq_active_season") || "2026";
      sidebarSeasonSelect.innerHTML = this.seasonsList.map(s => `
        <option value="${s.name}" ${String(s.name) === String(activeSeason) ? 'selected' : ''}>
          ${s.name}
        </option>
      `).join("");
    }
  }

  _saveTransfersLocal() {
    localStorage.setItem("iq_transfers", JSON.stringify(this.transfers));
  }

  async _fetchTranslationsForLang(langCode) {
    try {
      const normLang = langCode === "cat" ? "ca" : langCode;
      const { data, error } = await supabase.from("translations").select("*");
      if (!error && data) {
        const uniqueCodes = [...new Set(data.map(d => d.language_code))];
        uniqueCodes.forEach(code => {
          if (!this.availableLangs.some(l => l.code === code)) {
            this.availableLangs.push({ code, label: code.toUpperCase() });
          }
        });

        let filtered = data.filter(d => d.language_code === normLang || d.language_code === langCode);

        if (filtered.length === 0) {
          const defaultKeys = [
            { key: "dashboard", translation: normLang === 'fr' ? 'Tableau de bord' : 'Dashboard' },
            { key: "team", translation: normLang === 'fr' ? 'Équipe' : 'Team' },
            { key: "ask_ai", translation: normLang === 'fr' ? 'Demandez à vos données' : 'Ask your data' },
            { key: "games", translation: normLang === 'fr' ? 'Matchs' : 'Games' },
            { key: "players", translation: normLang === 'fr' ? 'Joueurs' : 'Players' },
            { key: "stats", translation: normLang === 'fr' ? 'Statistiques' : 'Stats' },
            { key: "settings", translation: normLang === 'fr' ? 'Paramètres' : 'Settings' }
          ];

          filtered = defaultKeys.map(item => ({
            key: item.key,
            language_code: normLang,
            translation: item.translation
          }));
        }

        this.dbTranslations = filtered;
      }
    } catch (e) {
      console.warn("Error cargando traducciones de Supabase:", e);
    }
  }

  async _fetchAllMarketPlayers(force = false) {
    if (this.isMarketLoaded && !force && this.allMarketPlayers.length > 0) return;

    try {
      const [pRes, tRes] = await Promise.all([
        supabase.from("players").select("*"),
        supabase.from("teams").select("*")
      ]);

      if (!pRes.error && pRes.data) {
        const teams = tRes.data || DataStore.getTeams() || [];
        this.allMarketPlayers = pRes.data.map(p => {
          const teamObj = teams.find(t => String(t.id).toLowerCase() === String(p.team_id).toLowerCase());
          return {
            ...p,
            team_name: teamObj ? teamObj.name : 'Otro Equipo'
          };
        });
        this.isMarketLoaded = true;
      }
    } catch (e) {
      console.warn("Error cargando mercado global:", e);
    }
  }

  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (this.seasonsList.length === 0) await this._fetchSeasons();
    if (this.activeTab === "users") await this._fetchProfiles();
    if (this.activeTab === "translations") await this._fetchTranslationsForLang(this.selectedLangForEdit);

    const effectiveRole = this.getEffectiveRole();
    const isReadOnly = !this._can("EDIT_DATA");
    const activeTeamId = DataStore.getActiveTeamId();
    const players = DataStore.getPlayers() || [];
    const realClubs = DataStore.getClubs() || [];
    const realTeams = DataStore.getTeams() || [];

    const pendingTransfersList = this.transfers.filter(t => t.status === "PENDIENTE");
    const currentActiveSeasonName = localStorage.getItem("iq_active_season") || "2026";

    // Filtrado y paginación del Mercado
    const sourcePlayersList = this.allMarketPlayers.length > 0 ? this.allMarketPlayers : (DataStore.players || []);
    const filteredPlayers = sourcePlayersList.filter(p => {
      const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      const teamName = (p.team_name || '').toLowerCase();
      const query = this.marketSearchQuery.toLowerCase();
      return fullName.includes(query) || teamName.includes(query);
    });

    const totalPages = Math.ceil(filteredPlayers.length / this.marketItemsPerPage) || 1;
    if (this.marketCurrentPage > totalPages) this.marketCurrentPage = totalPages;

    const startIndex = (this.marketCurrentPage - 1) * this.marketItemsPerPage;
    const paginatedPlayers = filteredPlayers.slice(startIndex, startIndex + this.marketItemsPerPage);

    container.innerHTML = `
      <div class="config-container">
        
        <!-- HEADER CONFIGURACIÓN TRADUCIDO -->
        <div class="config-header">
          <div>
            <h1>${this.t("settings", "Configuración")} ⚙️</h1>
            <p>${this.t("settings_subtitle", "Gestiona los datos de los clubes, equipos, plantilla, permisos, traducciones y temporadas.")}</p>
          </div>

          <div style="display: flex; gap: 10px; align-items: center;">
            ${this.simulatedRole ? `
              <div style="background: #fef3c7; border: 1px solid #f59e0b; color: #b45309; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
                <span>🎭 ${this.t("simulating_role", "Simulando:")} ${this.simulatedRole}</span>
                <button type="button" id="btn-stop-simulation" style="background: #dc2626; color: white; border: none; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer;">✕ ${this.t("exit", "Salir")}</button>
              </div>
            ` : ''}

            <div class="role-selector-chip">
              <span style="font-size: 11px; font-weight: 800; color: #475569;">${this.t("active_role", "Rol Activo:")}</span>
              <select id="select-demo-role">
                <option value="SUPERADMIN" ${effectiveRole === 'SUPERADMIN' ? 'selected' : ''}>👑 Superadmin</option>
                <option value="ADMIN" ${effectiveRole === 'ADMIN' ? 'selected' : ''}>🔑 Admin Club</option>
                <option value="ENTRENADOR" ${effectiveRole === 'ENTRENADOR' ? 'selected' : ''}>📋 Entrenador</option>
                <option value="ANALISTA" ${effectiveRole === 'ANALISTA' ? 'selected' : ''}>📈 Analista</option>
                <option value="JUGADOR" ${effectiveRole === 'JUGADOR' ? 'selected' : ''}>👤 Jugador</option>
                <option value="INVITADO" ${effectiveRole === 'INVITADO' ? 'selected' : ''}>👁️ Invitado (Demo)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- PESTAÑAS PRINCIPALES TRADUCIDAS -->
        <div class="config-tabs">
          <button class="tab-btn ${this.activeTab === 'club' ? 'active' : ''}" data-tab="club">
            🏢 ${this.t("tab_clubs_teams", "Clubs & Equipos")}
          </button>
          
          ${this._can("VIEW_TAB_PLAYERS") ? `
            <button class="tab-btn ${this.activeTab === 'players' ? 'active' : ''}" data-tab="players">
              👥 ${this.t("tab_roster", "Plantilla")} (${players.length})
            </button>
          ` : ''}

          ${this._can("VIEW_TAB_USERS") ? `
            <button class="tab-btn ${this.activeTab === 'users' ? 'active' : ''}" data-tab="users">
              👤 ${this.t("tab_users_roles", "Usuarios & Roles")} (${this.profilesList.length})
            </button>
          ` : ''}

          ${this._can("VIEW_TAB_SEASONS") ? `
            <button class="tab-btn ${this.activeTab === 'seasons' ? 'active' : ''}" data-tab="seasons">
              📅 ${this.t("tab_seasons", "Temporadas")} (${this.seasonsList.length})
            </button>
          ` : ''}

          ${this._can("VIEW_TAB_TRANSLATIONS") ? `
            <button class="tab-btn tab-admin ${this.activeTab === 'translations' ? 'active' : ''}" data-tab="translations">
              🌐 ${this.t("tab_languages_translations", "Idiomas & Traducciones")} 👑
            </button>
          ` : ''}

          ${this.currentUserRole === 'SUPERADMIN' ? `
            <button class="tab-btn tab-simulation ${this.activeTab === 'simulation' ? 'active' : ''}" data-tab="simulation">
              🎭 ${this.t("tab_role_simulation", "Simulación de Roles")} 👑
            </button>
          ` : ''}
        </div>

        ${isReadOnly ? `<div class="read-only-banner">ℹ️ ${this.t("read_only_mode", "Modo Permisos de solo lectura activo")} (${effectiveRole}).</div>` : ''}

        <!-- CONTENIDO PESTAÑAS -->
        <div class="tab-content-area">
          
          <!-- PESTAÑA 1: CLUBS Y EQUIPOS -->
          ${this.activeTab === 'club' ? `
            ${this.clubSubView === 'list' ? `
              ${this._can("CREATE_CLUB") ? `
                <div class="config-card" style="margin-bottom: 16px;">
                  <div class="card-title"><span>👑</span> ${this.t("create_new_club_title", "CREAR UN NUEVO CLUB (EXCLUSIVO SUPERADMIN)")}</div>
                  <form id="form-create-club" class="grid-2-cols">
                    <div class="form-group"><label>${this.t("club_name", "Nombre del Club")} *</label><input type="text" id="club-new-name" placeholder="Ej. CB Sants" required /></div>
                    <div class="form-group"><label>${this.t("coordinator_name", "Nombre del Coordinador")}</label><input type="text" id="club-new-coordinator" placeholder="Ej. Marc Soler" /></div>
                    <div class="form-group"><label>${this.t("phone", "Teléfono de Contacto")}</label><input type="text" id="club-new-phone" placeholder="Ej. +34 600 000 000" /></div>
                    <div class="form-group"><label>${this.t("address", "Dirección")}</label><input type="text" id="club-new-address" placeholder="Ej. Av. de Roma 12" /></div>
                    <div style="grid-column: 1 / -1; text-align: right;"><button type="submit" class="btn-primary">+ ${this.t("create_club_btn", "Crear Club")}</button></div>
                  </form>
                </div>
              ` : ''}

              ${this._can("CREATE_TEAM") ? `
                <div class="config-card" style="margin-bottom: 16px;">
                  <div class="card-title"><span>🏆</span> ${this.t("create_new_team_title", "CREAR UN NUEVO EQUIPO")}</div>
                  <form id="form-create-team" class="grid-2-cols">
                    <div class="form-group"><label>${this.t("assigned_club", "Club Asignado")} *</label><select id="team-new-club-id" required>${realClubs.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}</select></div>
                    <div class="form-group"><label>${this.t("team_name", "Nombre del Equipo")} *</label><input type="text" id="team-new-name" placeholder="Ej. Mini Femení B" required /></div>
                    <div class="form-group"><label>${this.t("category", "Categoría")} *</label><input type="text" id="team-new-category" placeholder="Ej. Mini / Alevín" required /></div>
                    <div class="form-group"><label>${this.t("competition", "Competición")} *</label><input type="text" id="team-new-competition" placeholder="Ej. B1 / Preferente" required /></div>
                    <div class="form-group"><label>${this.t("head_coach", "Entrenador Principal")} *</label><input type="text" id="team-new-coach" placeholder="Ej. Teo Raichman" required /></div>
                    <div class="form-group"><label>${this.t("main_color", "Color Principal")}</label><input type="color" id="team-new-color" value="#ea580c" style="width: 100%; height: 38px; border: none; cursor: pointer;" /></div>
                    <div style="grid-column: 1 / -1; text-align: right;"><button type="submit" class="btn-primary">+ ${this.t("create_full_team_btn", "Crear Equipo Completo")}</button></div>
                  </form>
                </div>
              ` : ''}

              <div class="config-card" style="margin-bottom: 16px;">
                <div class="card-title"><span>🏢</span> ${this.t("registered_clubs_title", "CLUBS REGISTRADOS")} (${realClubs.length})</div>
                <div class="table-responsive">
                  <table class="data-table">
                    <thead><tr><th>${this.t("club_name", "Nombre del Club")}</th><th>${this.t("coordinator_name", "Coordinador")}</th><th>${this.t("phone", "Teléfono")}</th><th>${this.t("address", "Dirección")}</th><th style="text-align: right;">${this.t("action", "Acción")}</th></tr></thead>
                    <tbody>${realClubs.length > 0 ? realClubs.map(c => `<tr><td><strong>${c.name || 'Sin Nombre'}</strong></td><td>${c.coordinator_name || 'No asignado'}</td><td>${c.phone || '-'}</td><td>${c.address || '-'}</td><td style="text-align: right;"><button type="button" class="btn-edit-club btn-outline-sm" data-id="${c.id}">✏️ ${this.t("edit_club_btn", "Editar Club")}</button></td></tr>`).join("") : `<tr><td colspan="5" style="text-align: center; color: #64748b;">${this.t("no_clubs_registered", "No hay clubs registrados.")}</td></tr>`}</tbody>
                  </table>
                </div>
              </div>

              <div class="config-card">
                <div class="card-title"><span>📊</span> ${this.t("teams_title", "EQUIPOS REGISTRADOS")} (${realTeams.length})</div>
                <div class="table-responsive">
                  <table class="data-table">
                    <thead><tr><th>${this.t("club_name", "Club")}</th><th>${this.t("team", "Equipo")}</th><th>${this.t("category", "Categoría")}</th><th>${this.t("coach", "Entrenador")}</th><th>${this.t("status", "Estado")}</th><th style="text-align: right;">${this.t("action", "Acción")}</th></tr></thead>
                    <tbody>${realTeams.length > 0 ? realTeams.map(t => { const isTeamActive = String(t.id).trim().toLowerCase() === String(activeTeamId).trim().toLowerCase(); return `<tr class="${isTeamActive ? 'active-team-row' : ''}"><td><strong>${t.clubName || 'JMJ Manyanet Sant Andreu'}</strong></td><td>${t.name}</td><td><span class="badge-category">${t.category || '-'}</span></td><td><strong>${t.coach_name || t.coach || 'Por definir'}</strong></td><td>${isTeamActive ? `<span class="badge-active-team">🟢 ${this.t("currently_active", "Activo Actual")}</span>` : `<button type="button" class="btn-set-active-team btn-outline-sm" data-id="${t.id}">${this.t("activate", "Activar")}</button>`}</td><td style="text-align: right;"><button type="button" class="btn-edit-team btn-secondary-sm" data-id="${t.id}">⚙️ ${this.t("configure", "Configurar")}</button></td></tr>`; }).join("") : `<tr><td colspan="6" style="text-align: center; color: #64748b;">${this.t("no_teams_registered", "No hay equipos registrados.")}</td></tr>`}</tbody>
                  </table>
                </div>
              </div>
            ` : ''}

            ${this.clubSubView === 'edit-team' ? `
              <div class="config-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                  <div class="card-title" style="margin: 0;"><span>🏆</span> ${this.t("team_data_title", "DATOS DEL EQUIPO")} (${this.selectedTeamForEdit?.name || ''})</div>
                  <button type="button" class="btn-back-to-list btn-outline-sm">⬅️ ${this.t("back_to_list", "Volver al Listado")}</button>
                </div>

                <form id="form-edit-team" class="grid-2-cols">
                  <div class="form-group"><label>${this.t("club_name", "Nombre del Club")}</label><input type="text" value="${this.selectedTeamForEdit?.clubName || 'JMJ Manyanet Sant Andreu'}" disabled /></div>
                  <div class="form-group"><label>${this.t("team_name", "Nombre del Equipo")} *</label><input type="text" id="edit-team-name" value="${this.selectedTeamForEdit?.name || ''}" ${isReadOnly ? 'disabled' : ''} required /></div>
                  <div class="form-group"><label>${this.t("category", "Categoría")}</label><input type="text" id="edit-team-category" value="${this.selectedTeamForEdit?.category || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>${this.t("competition", "Competición")}</label><input type="text" id="edit-team-competition" value="${this.selectedTeamForEdit?.competition || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>${this.t("head_coach", "Entrenador Principal")}</label><input type="text" id="edit-team-coach" value="${this.selectedTeamForEdit?.coach_name || this.selectedTeamForEdit?.coach || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>${this.t("main_color", "Color Principal")}</label><input type="color" id="edit-team-color" value="${this.selectedTeamForEdit?.color || '#ea580c'}" style="width: 100%; height: 38px; border: none; cursor: pointer;" ${isReadOnly ? 'disabled' : ''} /></div>
                  ${!isReadOnly ? `<div style="grid-column: 1 / -1; text-align: right;"><button type="submit" class="btn-primary">💾 ${this.t("save_team_changes_btn", "Guardar Cambios Equipo")}</button></div>` : ''}
                </form>
              </div>
            ` : ''}

            ${this.clubSubView === 'edit-club' ? `
              <div class="config-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                  <div class="card-title" style="margin: 0;"><span>🏢</span> ${this.t("club_config_title", "CONFIGURACIÓN DEL CLUB")} (${this.selectedClubForEdit?.name || ''})</div>
                  <button type="button" class="btn-back-to-list btn-outline-sm">⬅️ ${this.t("back_to_list", "Volver al Listado")}</button>
                </div>

                <form id="form-edit-club" class="grid-2-cols">
                  <div class="form-group"><label>${this.t("club_name", "Nombre del Club")} *</label><input type="text" id="edit-club-name" value="${this.selectedClubForEdit?.name || ''}" ${!this._can("MANAGE_CLUB_DATA") ? 'disabled' : ''} required /></div>
                  <div class="form-group"><label>${this.t("coordinator_name", "Nombre del Coordinador")}</label><input type="text" id="edit-club-coordinator" value="${this.selectedClubForEdit?.coordinator_name || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>${this.t("phone", "Teléfono de Contacto")}</label><input type="text" id="edit-club-phone" value="${this.selectedClubForEdit?.phone || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>${this.t("address", "Dirección")}</label><input type="text" id="edit-club-address" value="${this.selectedClubForEdit?.address || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  ${!isReadOnly ? `<div style="grid-column: 1 / -1; text-align: right;"><button type="submit" class="btn-primary">💾 ${this.t("save_club_data_btn", "Guardar Datos del Club")}</button></div>` : ''}
                </form>
              </div>
            ` : ''}
          ` : ''}

          <!-- PESTAÑA 2: PLANTILLA -->
          ${this.activeTab === 'players' && this._can("VIEW_TAB_PLAYERS") ? `
            <div class="config-container">
              
              <!-- PANEL DE APROBACIÓN DE TRASPASOS PENDIENTES -->
              ${this._can("APPROVE_TRANSFERS") && pendingTransfersList.length > 0 ? `
                <div class="config-card" style="border: 2px solid #f59e0b; background: #fffbeb;">
                  <div class="card-title" style="color: #b45309;"><span>📩</span> ${this.t("pending_transfers_title", "SOLICITUDES DE TRASPASO PENDIENTES")} (${pendingTransfersList.length})</div>
                  <div class="table-responsive">
                    <table class="data-table">
                      <thead><tr><th>${this.t("player", "Jugador")}</th><th>${this.t("requesting_team", "Equipo Solicitante")}</th><th style="text-align: right;">${this.t("actions", "Acciones")}</th></tr></thead>
                      <tbody>
                        ${pendingTransfersList.map(tr => {
                          const targetTeam = realTeams.find(t => String(t.id).toLowerCase() === String(tr.targetTeamId).toLowerCase());
                          return `
                            <tr>
                              <td><strong>${tr.playerName}</strong></td>
                              <td><span class="badge-category">${targetTeam ? targetTeam.name : 'Nuevo Equipo'}</span></td>
                              <td style="text-align: right; display: flex; justify-content: flex-end; gap: 8px;">
                                <button type="button" class="btn-approve-transfer btn-secondary-sm" data-id="${tr.id}" data-player-id="${tr.playerId}" data-target-team="${tr.targetTeamId}" style="background: #16a34a; color: white;">🟢 ${this.t("approve_transfer", "Aprobar Traspaso")}</button>
                                <button type="button" class="btn-reject-transfer btn-danger-sm" data-id="${tr.id}">🔴 ${this.t("reject", "Rechazar")}</button>
                              </td>
                            </tr>
                          `;
                        }).join("")}
                      </tbody>
                    </table>
                  </div>
                </div>
              ` : ''}

              <!-- BOTÓN PARA ABRIR SUBPANTALLA DEL MERCADO -->
              <div class="config-card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                  <h3 style="margin: 0; font-size: 15px; color: #1e3a8a; font-weight: 800;">🔄 ${this.t("global_transfer_market", "Mercado de Fichajes Global")}</h3>
                  <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">${this.t("transfer_market_desc", "Busca y solicita el traspaso de jugadores de cualquier equipo del sistema.")}</p>
                </div>
                <button type="button" id="btn-open-market-modal" class="btn-primary" style="background: #6366f1; padding: 10px 18px; font-size: 13px;">
                  🔍 ${this.t("open_market_btn", "Abrir Mercado / Fichar Jugador")}
                </button>
              </div>

              <!-- BLOQUE DE AÑADIR JUGADOR NUEVO -->
              <div class="config-card">
                <div class="card-title"><span>👥</span> ${this.t("add_new_player_title", "AÑADIR JUGADOR NUEVO A LA PLANTILLA")}</div>
                ${this._can("MANAGE_PLAYERS") ? `
                  <form id="form-add-player" class="grid-4-cols">
                    <div class="form-group"><label>${this.t("first_name", "Nombre")} *</label><input type="text" id="add-p-name" placeholder="Ej. Pablo" required /></div>
                    <div class="form-group"><label>${this.t("last_name", "Apellidos")} *</label><input type="text" id="add-p-lastname" placeholder="Ej. García" required /></div>
                    <div class="form-group"><label>${this.t("jersey", "Dorsal / Nº")} *</label><input type="number" id="add-p-number" placeholder="Ej. 10" required min="0" max="99" /></div>
                    <div class="form-group">
                      <label>${this.t("primary_position", "Posición Principal")} *</label>
                      <select id="add-p-position" required>
                        <option value="Base">Base</option><option value="Escolta">Escolta</option><option value="Alero">Alero</option><option value="Ala-pívot">Ala-pívot</option><option value="Pívot">Pívot</option>
                      </select>
                    </div>
                    <div style="grid-column: 1 / -1; text-align: right;">
                      <button type="submit" class="btn-secondary">+ ${this.t("add_to_roster_btn", "Crear y Añadir a la Plantilla")}</button>
                    </div>
                  </form>
                ` : ''}
              </div>

              <!-- JUGADORES PLANTILLA ACTIVA -->
              <div class="config-card">
                <div class="card-title"><span>📋</span> ${this.t("active_roster_title", "JUGADORES EN TU PLANTILLA ACTIVA")} (${players.length})</div>
                <div class="players-grid">
                  ${players.length > 0 ? players.map(p => `
                    <div class="player-card ${p.status === 'TRASPASADO' ? 'player-transferred' : ''}">
                      <div>
                        <strong>#${p.jersey ?? '?'} ${p.first_name || ''} ${p.last_name || ''}</strong>
                        <div style="font-size: 11px; color: #64748b;">
                          ${p.primary_position || p.position || 'Jugador'} • ${p.status === 'TRASPASADO' ? '⚠️ ' + this.t("transferred_historical", "Traspasado (Histórico)") : this.t("active", "Activo")}
                        </div>
                      </div>
                      ${this._can("MANAGE_PLAYERS") ? `<button type="button" class="btn-edit-player-modal btn-edit-link" data-id="${p.id}">✏️ ${this.t("edit", "Editar")}</button>` : ''}
                    </div>
                  `).join("") : `<p style="font-size: 13px; color: #64748b; grid-column: 1/-1;">${this.t("no_players_in_roster", "No hay jugadores registrados en esta plantilla.")}</p>`}
                </div>
              </div>

              <!-- MODAL DE EDICIÓN DE JUGADOR (Imagen 2) -->
              <div id="modal-edit-player" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); z-index: 9999; align-items: center; justify-content: center;">
                <div class="config-card" style="width: 100%; max-width: 500px; margin: 20px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 800;">✏️ ${this.t("edit_player_data", "Editar Datos del Jugador")}</h3>
                    <button type="button" id="btn-close-edit-player-modal" class="btn-outline-sm" style="font-size: 14px;">✕</button>
                  </div>

                  <form id="form-edit-player-modal" class="grid-2-cols">
                    <input type="hidden" id="edit-p-id" />
                    <div class="form-group"><label>${this.t("first_name", "Nombre")} *</label><input type="text" id="edit-p-name" ${isReadOnly ? 'disabled' : ''} required /></div>
                    <div class="form-group"><label>${this.t("last_name", "Apellidos")} *</label><input type="text" id="edit-p-lastname" ${isReadOnly ? 'disabled' : ''} required /></div>
                    <div class="form-group"><label>${this.t("jersey", "Dorsal / Nº")} *</label><input type="number" id="edit-p-number" min="0" max="99" ${isReadOnly ? 'disabled' : ''} required /></div>
                    <div class="form-group">
                      <label>${this.t("primary_position", "Posición Principal")} *</label>
                      <select id="edit-p-position" ${isReadOnly ? 'disabled' : ''} required>
                        <option value="Base">Base</option><option value="Escolta">Escolta</option><option value="Alero">Alero</option><option value="Ala-pívot">Ala-pívot</option><option value="Pívot">Pívot</option>
                      </select>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                      <label>${this.t("status", "Estado del Jugador")}</label>
                      <select id="edit-p-status" ${isReadOnly ? 'disabled' : ''}>
                        <option value="Activo">${this.t("active", "Activo")}</option>
                        <option value="Lesionado">Lesionado</option>
                        <option value="Inactivo">${this.t("inactive", "Inactivo")}</option>
                        <option value="TRASPASADO">Traspasado (Histórico)</option>
                      </select>
                    </div>
                    <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
                      <button type="button" id="btn-cancel-edit-player" class="btn-outline-sm">${this.t("cancel", "Cancelar")}</button>
                      ${!isReadOnly ? `<button type="submit" class="btn-primary">💾 ${this.t("save_changes", "Guardar Cambios")}</button>` : ''}
                    </div>
                  </form>
                </div>
              </div>

              <!-- SUBPANTALLA / MODAL DEL MERCADO GLOBAL -->
              <div id="modal-market-global" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); z-index: 9999; align-items: center; justify-content: center;">
                <div class="config-card" style="width: 100%; max-width: 850px; max-height: 90vh; overflow-y: auto; margin: 20px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                      <h3 style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 800;">🔄 ${this.t("global_transfer_market", "Mercado de Fichajes Global")}</h3>
                      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">${this.t("market_sub_desc", "Mostrando todos los jugadores registrados en la base de datos de Supabase.")}</p>
                    </div>
                    <button type="button" id="btn-close-market-modal" class="btn-outline-sm" style="font-size: 16px; padding: 4px 10px;">✕</button>
                  </div>
                  <div style="margin-bottom: 12px;">
                    <input type="text" id="input-market-search" placeholder="🔍 ${this.t("search_player_placeholder", "Buscar por nombre, apellido o club...")}" value="${this.marketSearchQuery}" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
                  </div>
                  <div id="market-modal-table-container"></div>
                </div>
              </div>

            </div>
          ` : ''}

          <!-- PESTAÑA 3: USUARIOS & ROLES -->
          ${this.activeTab === 'users' && this._can("VIEW_TAB_USERS") ? `
            <div class="config-container">
              
              <div class="config-card">
                <div class="card-title"><span>👤</span> ${this.t("user_invite_title", "ALTA DE USUARIO E INVITACIÓN DIRECTA")}</div>
                <form id="form-create-user-profile" class="grid-2-cols">
                  <div class="form-group">
                    <label>${this.t("full_name", "Nombre Completo")} *</label>
                    <input type="text" id="new-user-name" placeholder="Ej. Carlos García" required />
                  </div>
                  <div class="form-group">
                    <label>${this.t("email", "Correo Electrónico (Email)")} *</label>
                    <input type="email" id="new-user-email" placeholder="usuario@ejemplo.com" required />
                  </div>
                  <div class="form-group">
                    <label>${this.t("assigned_role", "Rol Asignado")} *</label>
                    <select id="new-user-role">
                      ${this._can("ASSIGN_ADMIN_ROLE") ? `<option value="Superadmin">Superadmin</option><option value="Administrador de Club">Administrador de Club</option>` : ''}
                      <option value="Entrenador" selected>Entrenador</option>
                      <option value="Analista">Analista</option>
                      <option value="Jugador">Jugador</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>🔑 ${this.t("temp_password", "Contraseña Temporal")} *</label>
                    <input type="text" id="new-user-pass" value="BasketIQ2026" required />
                  </div>
                  <div style="grid-column: 1 / -1; text-align: right;">
                    <button type="submit" class="btn-primary">✉️ ${this.t("invite_user_btn", "Dar de Alta e Invitar Usuario")}</button>
                  </div>
                </form>
              </div>

              <div class="config-card">
                <div class="card-title"><span>👥</span> ${this.t("manage_users_roles_title", "ADMINISTRAR MIEMBROS Y ROLES")} (${this.profilesList.length})</div>
                <div class="table-responsive">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>${this.t("user", "Usuario")}</th>
                        <th>${this.t("email", "Email")}</th>
                        <th>${this.t("assigned_role", "Rol Asignado")}</th>
                        <th style="text-align: right;">${this.t("action", "Acción")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${this.profilesList.length > 0 ? this.profilesList.map(prof => `
                        <tr>
                          <td><strong>${prof.display_name || 'Sin Nombre'}</strong></td>
                          <td>${prof.email || '-'}</td>
                          <td>
                            <select class="select-user-role" data-id="${prof.id}" ${!this._can("ASSIGN_ADMIN_ROLE") ? 'disabled' : ''} style="padding: 4px 8px; border-radius: 6px; font-weight: 700;">
                              <option value="Superadmin" ${prof.role === 'Superadmin' ? 'selected' : ''}>Superadmin</option>
                              <option value="Administrador de Club" ${prof.role === 'Administrador de Club' ? 'selected' : ''}>Administrador de Club</option>
                              <option value="Entrenador" ${prof.role === 'Entrenador' ? 'selected' : ''}>Entrenador</option>
                              <option value="Analista" ${prof.role === 'Analista' ? 'selected' : ''}>Analista</option>
                              <option value="Jugador" ${prof.role === 'Jugador' ? 'selected' : ''}>Jugador</option>
                            </select>
                          </td>
                          <td style="text-align: right;">
                            <button type="button" class="btn-save-user-role btn-secondary-sm" data-id="${prof.id}">💾 ${this.t("save_role", "Guardar Rol")}</button>
                          </td>
                        </tr>
                      `).join("") : `<tr><td colspan="4" style="text-align: center; color: #64748b;">${this.t("no_users_registered", "No hay usuarios registrados.")}</td></tr>`}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ` : ''}

          <!-- PESTAÑA 4: TEMPORADAS (Imagen 3) -->
          ${this.activeTab === 'seasons' && this._can("VIEW_TAB_SEASONS") ? `
            <div class="config-card">
              <div class="card-title"><span>📅</span> ${this.t("registered_seasons_title", "TEMPORADAS REGISTRADAS EN SUPABASE")} (${this.seasonsList.length})</div>

              ${!isReadOnly ? `
                <form id="form-create-season" class="grid-inline" style="margin-bottom: 20px;">
                  <div class="form-group" style="flex: 2;">
                    <label>${this.t("new_season_name", "Nombre de la Nueva Temporada")} *</label>
                    <input type="text" id="input-new-season-name" placeholder="Ej. 2026 o 2026/2027" required />
                  </div>
                  <div style="align-self: flex-end;">
                    <button type="submit" class="btn-primary">+ ${this.t("add_season_btn", "Añadir Temporada")}</button>
                  </div>
                </form>
              ` : ''}

              <div class="seasons-list" style="display: flex; flex-direction: column; gap: 10px;">
                ${this.seasonsList.length > 0 ? this.seasonsList.map(s => {
                  const sNameClean = String(s.name).trim();
                  const activeClean = String(currentActiveSeasonName).trim();
                  const isSeasonActive = sNameClean === activeClean || activeClean.includes(sNameClean) || sNameClean.includes(activeClean);

                  return `
                    <div class="season-row" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
                      <div style="display: flex; align-items: center; gap: 10px; flex: 1; max-width: 380px;">
                        <span style="font-size: 12px; font-weight: 800; color: #475569;">${this.t("season", "Temporada")}:</span>
                        <input type="text" class="input-season-edit" data-id="${s.id}" value="${s.name}" ${isReadOnly ? 'disabled' : ''} style="font-weight: 800; font-size: 13px; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%;" />
                      </div>

                      <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="${isSeasonActive ? 'badge-active-team' : 'badge-inactive'}">
                          ${isSeasonActive ? '🟢 ' + this.t("active", "Activa") : '⚪ ' + this.t("inactive", "Inactiva")}
                        </span>

                        ${!isReadOnly ? `
                          <button type="button" class="btn-save-season-name btn-secondary-sm" data-id="${s.id}">💾 ${this.t("save_name", "Guardar Nombre")}</button>
                          ${!isSeasonActive ? `<button type="button" class="btn-activate-season btn-outline-sm" data-id="${s.id}" data-name="${s.name}">${this.t("activate", "Activar")}</button>` : ''}
                        ` : ''}

                        ${this._can("DELETE_SEASON") ? `
                          <button type="button" class="btn-delete-season btn-danger-sm" data-id="${s.id}" title="${this.t("delete_season", "Eliminar Temporada")}">🗑️</button>
                        ` : ''}
                      </div>
                    </div>
                  `;
                }).join("") : `<p style="font-size: 13px; color: #64748b;">${this.t("no_seasons_registered", "No hay temporadas registradas en Supabase.")}</p>`}
              </div>
            </div>
          ` : ''}

          <!-- PESTAÑA 5: IDIOMAS Y TRADUCCIONES -->
          ${this.activeTab === 'translations' && this._can("VIEW_TAB_TRANSLATIONS") ? `
            <div id="translations-subview-container">
              ${this.languageSettingsView.render()}
            </div>
          ` : ''}

          <!-- PESTAÑA 6: SIMULACIÓN DE ROLES (EXCLUSIVO SUPERADMIN) -->
          ${this.activeTab === 'simulation' && this.currentUserRole === 'SUPERADMIN' ? `
            <div class="config-card" style="border: 2px solid #6366f1;">
              <div class="card-title" style="color: #4f46e5;"><span>🎭</span> ${this.t("role_simulation_title", "MODO SIMULACIÓN DE PANTALLAS Y PERMISOS")}</div>
              <p style="font-size: 13px; color: #475569; margin-top: -8px; margin-bottom: 20px;">
                ${this.t("role_simulation_desc", "Selecciona un rol para simular la interfaz y comprobar de inmediato qué opciones y botones puede ver y ejecutar cada perfil de usuario en toda la app.")}
              </p>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="SUPERADMIN" style="padding: 14px; text-align: left; font-weight: 800;">👑 ${this.t("simulate_superadmin", "Simular SUPERADMIN")}</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="ADMIN" style="padding: 14px; text-align: left; font-weight: 800;">🔑 ${this.t("simulate_admin", "Simular ADMIN CLUB")}</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="ENTRENADOR" style="padding: 14px; text-align: left; font-weight: 800;">📋 ${this.t("simulate_coach", "Simular ENTRENADOR")}</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="ANALISTA" style="padding: 14px; text-align: left; font-weight: 800;">📈 ${this.t("simulate_analyst", "Simular ANALISTA")}</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="JUGADOR" style="padding: 14px; text-align: left; font-weight: 800;">👤 ${this.t("simulate_player", "Simular JUGADOR")}</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="INVITADO" style="padding: 14px; text-align: left; font-weight: 800;">👁️ ${this.t("simulate_guest", "Simular INVITADO (Demo)")}</button>
              </div>

              ${this.simulatedRole ? `
                <div style="text-align: right;">
                  <button type="button" id="btn-reset-simulation" class="btn-danger-sm" style="padding: 10px 18px; font-weight: 800;">🔴 ${this.t("disable_simulation_btn", "Desactivar Simulación (Volver a Modo Real)")}</button>
                </div>
              ` : ''}
            </div>
          ` : ''}

        </div>

      </div>

      <!-- ESTILOS RESPONSIVE -->
      <style>
        .config-container { max-width: 1000px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; gap: 16px; }
        .config-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        .config-header h1 { font-size: 22px; font-weight: 900; color: #0f172a; margin: 0; }
        .config-header p { font-size: 12px; color: #64748b; margin: 2px 0 0 0; }
        
        .role-selector-chip { display: flex; align-items: center; gap: 8px; background: #f1f5f9; padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; }
        .role-selector-chip select { background: white; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 700; outline: none; cursor: pointer; }

        .config-tabs { display: flex; gap: 6px; border-bottom: 2px solid #e2e8f0; overflow-x: auto; padding-bottom: 2px; }
        .tab-btn { background: #f1f5f9; border: 1px solid #cbd5e1; border-bottom: none; padding: 8px 14px; border-radius: 8px 8px 0 0; font-size: 12px; font-weight: 700; color: #475569; cursor: pointer; white-space: nowrap; }
        .tab-btn.active { background: #1e3a8a; color: white; border-color: #1e3a8a; }
        .tab-btn.tab-admin { background: #fef3c7; color: #92400e; border-color: #fde68a; }
        .tab-btn.tab-simulation { background: #e0e7ff; color: #3730a3; border-color: #c7d2fe; }

        .read-only-banner { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 10px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; }
        .config-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
        .card-title { font-size: 12px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.04em; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }

        .grid-2-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-4-cols { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }
        .grid-inline { display: flex; gap: 12px; align-items: flex-end; }

        .form-group { display: flex; flex-direction: column; gap: 4px; }
        .form-group label { font-size: 11px; font-weight: 700; color: #475569; }
        .form-group input, .form-group select { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; outline: none; background: white; }

        .btn-primary { background: #1e3a8a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; }
        .btn-secondary { background: #6366f1; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; }
        .btn-secondary-sm { background: #6366f1; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 11px; cursor: pointer; }
        .btn-outline-sm { background: white; border: 1px solid #cbd5e1; color: #334155; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 11px; cursor: pointer; }
        .btn-danger-sm { background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 6px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; }

        .table-responsive { overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; text-align: left; }
        .data-table th, .data-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        .data-table th { background: #f8fafc; font-weight: 800; color: #475569; }

        .active-team-row { background: #f0fdf4; }
        .badge-category { background: #e0e7ff; color: #3730a3; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; }
        .badge-active-team { background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; }
        .badge-pending { background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; }
        .badge-inactive { background: #f1f5f9; color: #64748b; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; }

        .players-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .player-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; }

        @media (max-width: 868px) {
          .grid-2-cols, .grid-4-cols, .players-grid { grid-template-columns: 1fr !important; }
        }
      </style>
    `;

    // --- BINDING DE EVENTOS PESTAÑAS PRINCIPALES ---

    container.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        this.activeTab = e.currentTarget.getAttribute("data-tab");
        this.clubSubView = "list";
        await this.render(containerId);
      });
    });

    // BINDING APROBAR Y RECHAZAR TRASPASOS
    container.querySelectorAll(".btn-approve-transfer").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const trId = e.currentTarget.getAttribute("data-id");
        const playerId = e.currentTarget.getAttribute("data-player-id");
        const targetTeamId = e.currentTarget.getAttribute("data-target-team");

        this.showSyncOverlay("⚡ Procesando y aprobando traspaso en Supabase...");

        try {
          const { error } = await supabase
            .from("players")
            .update({ team_id: targetTeamId, status: "Activo" })
            .eq("id", playerId);

          if (error) {
            this.hideSyncOverlay();
            alert(`❌ Error al actualizar equipo del jugador en Supabase: ${error.message}`);
            return;
          }

          const transferObj = this.transfers.find(t => String(t.id) === String(trId));
          if (transferObj) {
            transferObj.status = "APROBADO";
          }
          this._saveTransfersLocal();

          DataStore.isLoaded = false;
          await DataStore.init(activeTeamId, true);
          this.hideSyncOverlay();

          alert("🟢 ¡Traspaso aprobado! El jugador ya forma parte del nuevo equipo.");
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error aprobando traspaso:", err);
          alert(`❌ Error durante el traspaso: ${err.message}`);
        }
      });
    });

    container.querySelectorAll(".btn-reject-transfer").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const trId = e.currentTarget.getAttribute("data-id");

        const transferObj = this.transfers.find(t => String(t.id) === String(trId));
        if (transferObj) {
          transferObj.status = "RECHAZADO";
        }
        this._saveTransfersLocal();

        alert("🔴 Solicitud de traspaso rechazada.");
        await this.render(containerId);
      });
    });

    // BINDING ACTIVAR EQUIPO
    container.querySelectorAll(".btn-set-active-team").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const teamId = e.currentTarget.getAttribute("data-id");
        if (!teamId) return;

        this.showSyncOverlay("⚡ Activando equipo en el sistema...");

        try {
          localStorage.setItem("iq_active_team_id", teamId);
          
          if (typeof DataStore.setActiveTeamAndSeason === "function") {
            DataStore.setActiveTeamAndSeason(teamId, null);
          }
          
          DataStore.isLoaded = false;
          await DataStore.init(teamId, true);

          const sidebarSelect = document.getElementById("sidebar-select-team");
          if (sidebarSelect) sidebarSelect.value = teamId;

          const mobileSelect = document.getElementById("mobile-select-team");
          if (mobileSelect) mobileSelect.value = teamId;

          this.hideSyncOverlay();
          alert("🟢 Equipo activado correctamente. Se han sincronizado los datos.");

          if (window.iqApp && typeof window.iqApp.render === "function") {
            window.iqApp.teamId = teamId;
            await window.iqApp.render();
          } else {
            await this.render(containerId);
          }
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error al activar equipo:", err);
          alert("❌ No se pudo activar el equipo seleccionado.");
        }
      });
    });

    // EVENTOS EDITAR CLUB Y CONFIGURAR EQUIPO
    container.querySelectorAll(".btn-edit-club").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        this.selectedClubForEdit = realClubs.find(c => String(c.id) === String(id));
        this.clubSubView = "edit-club";
        this.render(containerId);
      });
    });

    container.querySelectorAll(".btn-edit-team").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        this.selectedTeamForEdit = realTeams.find(t => String(t.id) === String(id));
        this.clubSubView = "edit-team";
        this.render(containerId);
      });
    });

    container.querySelectorAll(".btn-back-to-list").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.clubSubView = "list";
        this.render(containerId);
      });
    });

    // FORMULARIO CREAR CLUB
    const formCreateClub = container.querySelector("#form-create-club");
    if (formCreateClub) {
      formCreateClub.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = container.querySelector("#club-new-name")?.value.trim();
        const coordinator_name = container.querySelector("#club-new-coordinator")?.value.trim() || "";
        const phone = container.querySelector("#club-new-phone")?.value.trim() || "";
        const address = container.querySelector("#club-new-address")?.value.trim() || "";

        if (!name) return;

        this.showSyncOverlay("⚡ Registrando nuevo club en Supabase...");

        try {
          const { data, error } = await supabase
            .from("clubs")
            .insert([{ name, coordinator_name, phone, address }])
            .select();

          if (error) {
            this.hideSyncOverlay();
            alert(`❌ Error al crear club en Supabase: ${error.message}`);
            return;
          }

          await DataStore.init(activeTeamId, true);
          this.hideSyncOverlay();
          alert("✅ Club creado con éxito en la base de datos.");
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error creando club:", err);
          alert(`❌ Error al conectar con Supabase: ${err.message}`);
        }
      });
    }

    // FORMULARIO CREAR EQUIPO
    const formCreateTeam = container.querySelector("#form-create-team");
    if (formCreateTeam) {
      formCreateTeam.addEventListener("submit", async (e) => {
        e.preventDefault();
        const club_id = container.querySelector("#team-new-club-id")?.value;
        const name = container.querySelector("#team-new-name")?.value.trim();
        const category = container.querySelector("#team-new-category")?.value.trim();
        const competition = container.querySelector("#team-new-competition")?.value.trim();
        const coach_name = container.querySelector("#team-new-coach")?.value.trim();
        const color = container.querySelector("#team-new-color")?.value || "#ea580c";

        if (!name || !club_id) return;

        this.showSyncOverlay("⚡ Registrando nuevo equipo en Supabase...");

        try {
          const { data, error } = await supabase
            .from("teams")
            .insert([{ club_id, name, category, competition, coach_name, color }])
            .select();

          if (error) {
            this.hideSyncOverlay();
            alert(`❌ Error al crear equipo: ${error.message}`);
            return;
          }

          await DataStore.init(activeTeamId, true);
          this.hideSyncOverlay();
          alert("✅ Equipo creado exitosamente.");
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error creando equipo:", err);
        }
      });
    }

    // FORMULARIO GUARDAR CAMBIOS DE CLUB
    const formEditClub = container.querySelector("#form-edit-club");
    if (formEditClub) {
      formEditClub.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!this.selectedClubForEdit) return;

        const name = container.querySelector("#edit-club-name")?.value.trim();
        const coordinator_name = container.querySelector("#edit-club-coordinator")?.value.trim();
        const phone = container.querySelector("#edit-club-phone")?.value.trim();
        const address = container.querySelector("#edit-club-address")?.value.trim();

        this.showSyncOverlay("💾 Guardando datos del club en Supabase...");

        try {
          const { data: updatedClub, error } = await supabase
            .from("clubs")
            .update({ name, coordinator_name, phone, address })
            .eq("id", this.selectedClubForEdit.id)
            .select();

          if (error) {
            this.hideSyncOverlay();
            alert(`❌ Supabase denegó los cambios en el club: ${error.message}`);
            return;
          }

          await DataStore.init(activeTeamId, true);
          this.hideSyncOverlay();

          alert("✅ Datos del club actualizados correctamente.");
          this.clubSubView = "list";
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error al actualizar club:", err);
          alert(`❌ Error al conectar con Supabase: ${err.message}`);
        }
      });
    }

    // FORMULARIO GUARDAR CAMBIOS DE EQUIPO
    const formEditTeam = container.querySelector("#form-edit-team");
    if (formEditTeam) {
      formEditTeam.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!this.selectedTeamForEdit) return;

        const name = container.querySelector("#edit-team-name")?.value.trim();
        const category = container.querySelector("#edit-team-category")?.value.trim();
        const competition = container.querySelector("#edit-team-competition")?.value.trim();
        const coach_name = container.querySelector("#edit-team-coach")?.value.trim();
        const color = container.querySelector("#edit-team-color")?.value;

        this.showSyncOverlay("💾 Guardando cambios del equipo en Supabase...");

        try {
          const { data: updatedTeam, error } = await supabase
            .from("teams")
            .update({ name, category, competition, coach_name, color })
            .eq("id", this.selectedTeamForEdit.id)
            .select();

          if (error) {
            this.hideSyncOverlay();
            alert(`❌ Supabase denegó los cambios en el equipo: ${error.message}`);
            return;
          }

          await DataStore.init(activeTeamId, true);
          this.hideSyncOverlay();

          alert("✅ Configuración del equipo actualizada en Supabase correctamente.");
          this.clubSubView = "list";
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error al actualizar equipo:", err);
          alert(`❌ Error al conectar con Supabase: ${err.message}`);
        }
      });
    }

    // FORMULARIO CREAR JUGADOR NUEVO
    const formAddPlayer = container.querySelector("#form-add-player");
    if (formAddPlayer) {
      formAddPlayer.addEventListener("submit", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const first_name = container.querySelector("#add-p-name")?.value.trim();
        const last_name = container.querySelector("#add-p-lastname")?.value.trim();
        const jersey = parseInt(container.querySelector("#add-p-number")?.value, 10);
        const primary_position = container.querySelector("#add-p-position")?.value;

        if (!first_name || !last_name || isNaN(jersey)) {
          alert("⚠️ Rellena todos los campos obligatorios del jugador.");
          return;
        }

        this.showSyncOverlay("⚡ Registrando jugador en Supabase...");

        try {
          const { data, error } = await supabase
            .from("players")
            .insert([{
              team_id: activeTeamId,
              first_name,
              last_name,
              jersey,
              primary_position,
              status: "Activo"
            }])
            .select();

          if (error) {
            this.hideSyncOverlay();
            alert(`❌ Error al insertar jugador en Supabase: ${error.message}`);
            return;
          }

          DataStore.isLoaded = false;
          await DataStore.init(activeTeamId, true);
          this.hideSyncOverlay();

          alert(`✅ Jugador #${jersey} ${first_name} ${last_name} registrado correctamente.`);
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error guardando jugador nuevo:", err);
          alert(`❌ Error de conexión: ${err.message}`);
        }
      });
    }

    // EDICIÓN DE JUGADORES
    container.querySelectorAll(".btn-edit-player-modal").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const pId = e.currentTarget.getAttribute("data-id");
        const player = (players || []).find(p => String(p.id) === String(pId)) || 
                       (this.allMarketPlayers || []).find(p => String(p.id) === String(pId));

        if (!player) {
          alert("⚠️ No se encontró la información del jugador.");
          return;
        }

        const modal = container.querySelector("#modal-edit-player");
        if (modal) {
          container.querySelector("#edit-p-id").value = player.id;
          container.querySelector("#edit-p-name").value = player.first_name || "";
          container.querySelector("#edit-p-lastname").value = player.last_name || "";
          container.querySelector("#edit-p-number").value = player.jersey ?? 0;
          container.querySelector("#edit-p-position").value = player.primary_position || player.position || "Alero";
          container.querySelector("#edit-p-status").value = player.status || "Activo";

          modal.style.display = "flex";
        }
      });
    });

    const closePlayerModal = () => {
      const modal = container.querySelector("#modal-edit-player");
      if (modal) modal.style.display = "none";
    };

    container.querySelector("#btn-close-edit-player-modal")?.addEventListener("click", closePlayerModal);
    container.querySelector("#btn-cancel-edit-player")?.addEventListener("click", closePlayerModal);

    const formEditPlayer = container.querySelector("#form-edit-player-modal");
    if (formEditPlayer) {
      formEditPlayer.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (isReadOnly) {
          alert("ℹ️ Permisos insuficientes para modificar la plantilla en este modo.");
          return;
        }

        const pId = container.querySelector("#edit-p-id")?.value;
        const first_name = container.querySelector("#edit-p-name")?.value.trim();
        const last_name = container.querySelector("#edit-p-lastname")?.value.trim();
        const jersey = parseInt(container.querySelector("#edit-p-number")?.value, 10);
        const primary_position = container.querySelector("#edit-p-position")?.value;
        const status = container.querySelector("#edit-p-status")?.value;

        const updates = { first_name, last_name, jersey, primary_position, status };

        try {
          this.showSyncOverlay("💾 Guardando cambios del jugador...");

          const { error } = await supabase
            .from("players")
            .update(updates)
            .eq("id", pId);

          if (error) {
            this.hideSyncOverlay();
            alert(`❌ Error al guardar en Supabase: ${error.message}`);
            return;
          }

          await DataStore.init(activeTeamId, true);
          this.hideSyncOverlay();
          closePlayerModal();

          alert("✅ Datos del jugador actualizados con éxito.");
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error guardando cambios del jugador:", err);
        }
      });
    }

    // MODAL MERCADO
    const renderMarketTable = () => {
      const tableContainer = container.querySelector("#market-modal-table-container");
      if (!tableContainer) return;

      const filtered = (this.allMarketPlayers || []).filter(p => {
        const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
        const teamName = (p.team_name || '').toLowerCase();
        const query = this.marketSearchQuery.toLowerCase();
        return fullName.includes(query) || teamName.includes(query);
      });

      const totalPages = Math.ceil(filtered.length / this.marketItemsPerPage) || 1;
      if (this.marketCurrentPage > totalPages) this.marketCurrentPage = totalPages;

      const startIndex = (this.marketCurrentPage - 1) * this.marketItemsPerPage;
      const paginated = filtered.slice(startIndex, startIndex + this.marketItemsPerPage);

      tableContainer.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>${this.t("player", "Jugador")}</th>
                <th>${this.t("primary_position", "Posición")}</th>
                <th>${this.t("current_team", "Equipo Actual")}</th>
                <th>${this.t("status", "Estado")}</th>
                <th style="text-align: right;">${this.t("action", "Acción")}</th>
              </tr>
            </thead>
            <tbody>
              ${paginated.length > 0 ? paginated.map(p => {
                const isOwnPlayer = String(p.team_id).toLowerCase() === String(activeTeamId).toLowerCase();
                const pendingTransfer = this.transfers.find(t => String(t.playerId) === String(p.id) && t.status === 'PENDIENTE');

                return `
                  <tr style="${isOwnPlayer ? 'opacity: 0.55; background: #f8fafc;' : ''}">
                    <td><strong>#${p.jersey ?? '?'} ${p.first_name} ${p.last_name || ''}</strong></td>
                    <td>${p.primary_position || p.position || 'Jugador'}</td>
                    <td>${isOwnPlayer ? '🟢 Tu Equipo' : (p.team_name || 'Otro Equipo')}</td>
                    <td>
                      ${isOwnPlayer 
                        ? '<span class="badge-active-team">' + this.t("in_roster", "En plantilla") + '</span>' 
                        : (pendingTransfer ? '<span class="badge-pending">⏳ ' + this.t("pending_approval", "Traspaso Pendiente") + '</span>' : '<span class="badge-inactive">' + this.t("available", "Disponible") + '</span>')}
                    </td>
                    <td style="text-align: right;">
                      ${isOwnPlayer ? `
                        <button type="button" class="btn-outline-sm" disabled>${this.t("in_your_roster", "En Tu Plantilla")}</button>
                      ` : (pendingTransfer ? `
                        <button type="button" class="btn-outline-sm" disabled>${this.t("pending_approval", "Pendiente Aprobación")}</button>
                      ` : `
                        <button type="button" class="btn-request-transfer btn-secondary-sm" data-id="${p.id}" data-name="${p.first_name} ${p.last_name || ''}">
                          📩 ${this.t("request_transfer", "Solicitar Traspaso")}
                        </button>
                      `)}
                    </td>
                  </tr>
                `;
              }).join("") : `<tr><td colspan="5" style="text-align: center; color: #64748b;">${this.t("no_players_in_db", "No se encontraron jugadores en la base de datos.")}</td></tr>`}
            </tbody>
          </table>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font-size: 12px; color: #64748b;">
          <span>${this.t("showing", "Mostrando")} ${paginated.length} ${this.t("of", "de")} ${filtered.length} ${this.t("players", "jugadores")}</span>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button type="button" id="btn-prev-market-modal-page" class="btn-outline-sm" ${this.marketCurrentPage <= 1 ? 'disabled' : ''}>⬅️ ${this.t("previous", "Anterior")}</button>
            <span style="font-weight: 700; color: #1e3a8a;">${this.t("page_indicator", "Pág.")} ${this.marketCurrentPage} ${this.t("of", "de")} ${totalPages}</span>
            <button type="button" id="btn-next-market-modal-page" class="btn-outline-sm" ${this.marketCurrentPage >= totalPages ? 'disabled' : ''}>${this.t("next", "Siguiente")} ➡️</button>
          </div>
        </div>
      `;

      tableContainer.querySelectorAll(".btn-request-transfer").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const pId = e.currentTarget.getAttribute("data-id");
          const pName = e.currentTarget.getAttribute("data-name");

          const transferObj = {
            id: "tr-" + Date.now(),
            playerId: pId,
            playerName: pName,
            targetTeamId: activeTeamId,
            status: "PENDIENTE"
          };

          this.transfers.push(transferObj);
          this._saveTransfersLocal();

          alert(`📩 Solicitud de traspaso registrada para ${pName}.`);
          renderMarketTable();
        });
      });

      tableContainer.querySelector("#btn-prev-market-modal-page")?.addEventListener("click", () => {
        if (this.marketCurrentPage > 1) {
          this.marketCurrentPage--;
          renderMarketTable();
        }
      });

      tableContainer.querySelector("#btn-next-market-modal-page")?.addEventListener("click", () => {
        if (this.marketCurrentPage < totalPages) {
          this.marketCurrentPage++;
          renderMarketTable();
        }
      });
    };

    container.querySelector("#btn-open-market-modal")?.addEventListener("click", async () => {
      this.showSyncOverlay("⚡ Cargando mercado global de jugadores...");
      await this._fetchAllMarketPlayers(true);
      this.hideSyncOverlay();

      const modal = container.querySelector("#modal-market-global");
      if (modal) {
        modal.style.display = "flex";
        renderMarketTable();
      }
    });

    container.querySelector("#btn-close-market-modal")?.addEventListener("click", () => {
      const modal = container.querySelector("#modal-market-global");
      if (modal) modal.style.display = "none";
    });

    // --- 8. EVENTOS IDIOMAS Y TRADUCCIONES CON PAGINACIÓN EN BINDING ---
    if (this.activeTab === "translations") {
      // Evento Guardar Traducciones
      const btnSaveLang = container.querySelector("#btnSaveLanguage");
      if (btnSaveLang) {
        btnSaveLang.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();

          this.showSyncOverlay("🌐 Actualizando traducciones en caliente...");
          
          if (typeof this.languageSettingsView.handleSave === "function") {
            await this.languageSettingsView.handleSave();
          }

          const currentLang = localStorage.getItem("iq_lang") || "es";
          if (I18n && typeof I18n.changeLanguage === "function") {
            I18n.changeLanguage(currentLang);
          }
          if (TranslationStore && typeof TranslationStore.setLanguage === "function") {
            TranslationStore.setLanguage(currentLang);
          }

          this.hideSyncOverlay();
          alert("✅ Traducciones aplicadas y actualizadas en pantalla.");
          await this.render(containerId);
        });
      }

      // Evento Selector de Idioma a editar
      const langSelector = container.querySelector("#langCodeInput");
      if (langSelector) {
        langSelector.addEventListener("change", async (e) => {
          const selectedCode = e.target.value;
          this.selectedLangForEdit = selectedCode;
          this.languageSettingsView.currentPage = 1;
          await this.render(containerId);
        });
      }

      // Eventos de Paginación Idiomas
      const setupLangPaginationEvents = (prevBtnId, nextBtnId) => {
        container.querySelector(prevBtnId)?.addEventListener("click", async () => {
          if (this.languageSettingsView.currentPage > 1) {
            this.languageSettingsView.currentPage--;
            await this.render(containerId);
          }
        });

        container.querySelector(nextBtnId)?.addEventListener("click", async () => {
          this.languageSettingsView.currentPage++;
          await this.render(containerId);
        });
      };

      setupLangPaginationEvents("#btn-prev-lang-page", "#btn-next-lang-page");
      setupLangPaginationEvents("#btn-prev-lang-page-bottom", "#btn-next-lang-page-bottom");
    }

    // 9. GESTIÓN DE TEMPORADAS
    container.querySelectorAll(".btn-save-season-name").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const seasonId = e.currentTarget.getAttribute("data-id");
        const inputEl = container.querySelector(`.input-season-edit[data-id="${seasonId}"]`);
        if (!inputEl) return;

        const newName = inputEl.value.trim();
        if (!newName) {
          alert("⚠️ El nombre de la temporada no puede estar vacío.");
          return;
        }

        this.showSyncOverlay("💾 Guardando nombre de la temporada en Supabase...");

        try {
          const { error } = await supabase
            .from("seasons")
            .update({ name: newName })
            .eq("id", seasonId);

          if (error) {
            this.hideSyncOverlay();
            alert(`❌ Supabase rechazó el cambio de nombre: ${error.message}`);
            return;
          }

          const seasonObj = this.seasonsList.find(s => String(s.id) === String(seasonId));
          if (seasonObj) {
            seasonObj.name = newName;
          }

          localStorage.setItem("iq_active_season", newName);
          this._saveSeasonsLocal();
          this.hideSyncOverlay();

          alert(`✅ Temporada actualizada a "${newName}" en Supabase correctamente.`);
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error actualizando temporada:", err);
          alert(`❌ Error al conectar con Supabase: ${err.message}`);
        }
      });
    });

    container.querySelectorAll(".btn-activate-season").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const seasonName = e.currentTarget.getAttribute("data-name");
        localStorage.setItem("iq_active_season", seasonName);
        this._saveSeasonsLocal();
        alert(`🟢 Temporada "${seasonName}" activada en el sistema.`);
        await this.render(containerId);
      });
    });

    container.querySelectorAll(".btn-delete-season").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const seasonId = e.currentTarget.getAttribute("data-id");
        if (confirm("⚠️ ¿Estás seguro de eliminar esta temporada de Supabase?")) {
          this.showSyncOverlay("🗑️ Eliminando temporada en Supabase...");
          try {
            const { error } = await supabase.from("seasons").delete().eq("id", seasonId);
            if (error) {
              this.hideSyncOverlay();
              alert(`❌ No se pudo eliminar de Supabase: ${error.message}`);
              return;
            }
            this.seasonsList = this.seasonsList.filter(s => String(s.id) !== String(seasonId));
            this._saveSeasonsLocal();
            this.hideSyncOverlay();
            await this.render(containerId);
          } catch (err) {
            this.hideSyncOverlay();
            console.error("Error borrando temporada:", err);
          }
        }
      });
    });

    const formCreateSeason = container.querySelector("#form-create-season");
    if (formCreateSeason) {
      formCreateSeason.addEventListener("submit", async (e) => {
        e.preventDefault();
        const inputName = container.querySelector("#input-new-season-name");
        const seasonName = inputName?.value.trim();

        if (!seasonName) return;

        this.showSyncOverlay("⚡ Registrando nueva temporada en Supabase...");

        const newSeasonPayload = {
          name: seasonName,
          team_id: activeTeamId
        };

        try {
          const { data, error } = await supabase
            .from("seasons")
            .insert([newSeasonPayload])
            .select()
            .single();

          if (error) {
            this.hideSyncOverlay();
            alert(`❌ Error al insertar temporada en Supabase: ${error.message}`);
            return;
          }

          if (data) {
            this.seasonsList.unshift(data);
            localStorage.setItem("iq_active_season", seasonName);
            this._saveSeasonsLocal();
          }

          this.hideSyncOverlay();
          alert(`✅ Temporada "${seasonName}" creada con éxito en Supabase.`);
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error creando temporada:", err);
          alert(`❌ Error inesperado: ${err.message}`);
        }
      });
    }

    // 10. SIMULACIÓN DE ROLES
    container.querySelectorAll(".btn-simulate-role").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const roleToSimulate = e.currentTarget.getAttribute("data-role");
        
        this.simulatedRole = roleToSimulate;
        localStorage.setItem("iq_simulated_role", roleToSimulate);
        localStorage.setItem("iq_user_role", roleToSimulate);

        alert(`🎭 Simulación activada: La app muestra la interfaz de '${roleToSimulate}'.`);
        
        const appContainer = document.getElementById("app");
        if (appContainer) appContainer.innerHTML = "";
        window.location.reload();
      });
    });

    const resetSimBtn = container.querySelector("#btn-reset-simulation") || container.querySelector("#btn-stop-simulation");
    if (resetSimBtn) {
      resetSimBtn.addEventListener("click", async () => {
        this.simulatedRole = null;
        localStorage.removeItem("iq_simulated_role");
        localStorage.setItem("iq_user_role", "SUPERADMIN");

        alert("🔴 Simulación desactivada. Volviendo a control total de SUPERADMIN.");
        window.location.reload();
      });
    }

    container.querySelector("#select-demo-role")?.addEventListener("change", (e) => {
      this.currentUserRole = e.target.value;
      this.simulatedRole = null;
      localStorage.removeItem("iq_simulated_role");
      localStorage.setItem("iq_user_role", this.currentUserRole);
      window.location.reload();
    });
  }
}

export default TranslationsView;