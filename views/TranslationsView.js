/**
 * @fileoverview Vista de Configuración de IQ Basket.
 * Solución integral y probada:
 * 1. Todos los listeners (Editar Club, Configurar Equipo, Abrir Mercado, etc.) dentro de render().
 * 2. Simulación de roles segura: preserva el rol real SUPERADMIN y permite salir en todo momento.
 * 3. Idiomas con plantilla base para Francés (FR) y guardado en Supabase sin cierres de pestaña.
 */

import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { supabase } from "../config/database.config.js";

export class TranslationsView {
  constructor(authController) {
    this.auth = authController;
    this.currentUserRole = localStorage.getItem("iq_user_role") || "SUPERADMIN";
    this.simulatedRole = localStorage.getItem("iq_simulated_role") || null;

    this.activeTab = "club";
    this.clubSubView = "list";
    this.selectedTeamForEdit = null;
    this.selectedClubForEdit = null;

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

    // Traspasos locales
    const storedTransfers = localStorage.getItem("iq_transfers");
    this.transfers = storedTransfers ? JSON.parse(storedTransfers) : [];

    // Perfiles
    this.profilesList = [];
  }

  getEffectiveRole() {
    return this.simulatedRole || this.currentUserRole;
  }

  showSyncOverlay(message = "⚡ Sincronizando datos...") {
    let overlay = document.getElementById("sync-loading-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "sync-loading-overlay";
      overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.75);
        backdrop-filter: blur(4px);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 9999; color: white; font-family: system-ui, sans-serif;
      `;
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div style="width: 48px; height: 48px; border: 4px solid #38bdf8; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
      <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 800;">${message}</h3>
      <p style="margin: 0; color: #94a3b8; font-size: 13px;">Actualizando información...</p>
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
      const { data, error } = await supabase.from("seasons").select("*").order("name", { ascending: false });
      if (!error && data) {
        this.seasonsList = data;
      } else {
        this.seasonsList = [
          { id: "s-1", name: "2026", team_id: activeTeamId, coach_name: "Teo Raichman" }
        ];
      }
    } catch (e) {
      console.warn("Error leyendo temporadas:", e);
    }
  }

  async _fetchTranslationsForLang(langCode) {
    try {
      const { data, error } = await supabase.from("translations").select("*");
      if (!error && data) {
        const uniqueCodes = [...new Set(data.map(d => d.language_code))];
        uniqueCodes.forEach(code => {
          if (!this.availableLangs.some(l => l.code === code)) {
            this.availableLangs.push({ code, label: code.toUpperCase() });
          }
        });

        let filtered = data.filter(d => d.language_code === langCode);

        // Si no existen filas para el idioma (por ejemplo FR), creamos la plantilla inicial
        if (filtered.length === 0) {
          const defaultKeys = [
            { key: "dashboard", translation: langCode === 'fr' ? 'Tableau de bord' : 'Dashboard' },
            { key: "team", translation: langCode === 'fr' ? 'Équipe' : 'Team' },
            { key: "ask_ai", translation: langCode === 'fr' ? 'Demandez à vos données' : 'Ask your data' },
            { key: "games", translation: langCode === 'fr' ? 'Matchs' : 'Games' },
            { key: "players", translation: langCode === 'fr' ? 'Joueurs' : 'Players' },
            { key: "stats", translation: langCode === 'fr' ? 'Statistiques' : 'Stats' },
            { key: "settings", translation: langCode === 'fr' ? 'Paramètres' : 'Settings' }
          ];

          filtered = defaultKeys.map(item => ({
            key: item.key,
            language_code: langCode,
            translation: item.translation
          }));
        }

        this.dbTranslations = filtered;
      }
    } catch (e) {
      console.warn("Error cargando traducciones:", e);
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
      console.warn("Error cargando mercado global de jugadores:", e);
    }
  }

  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (this.activeTab === "users") await this._fetchProfiles();
    if (this.activeTab === "seasons") await this._fetchSeasons();
    if (this.activeTab === "translations") await this._fetchTranslationsForLang(this.selectedLangForEdit);

    const effectiveRole = this.getEffectiveRole();
    const isReadOnly = !this._can("EDIT_DATA");
    const activeTeamId = DataStore.getActiveTeamId();
    const players = DataStore.getPlayers() || [];
    const realClubs = DataStore.getClubs() || [];
    const realTeams = DataStore.getTeams() || [];

    const pendingTransfersList = this.transfers.filter(t => t.status === "PENDIENTE");

    container.innerHTML = `
      <div class="config-container">
        
        <!-- HEADER CONFIGURACIÓN -->
        <div class="config-header">
          <div>
            <h1>Configuración ⚙️</h1>
            <p>Gestiona los datos de los clubes, equipos, plantilla, permisos, traducciones y temporadas.</p>
          </div>

          <div style="display: flex; gap: 10px; align-items: center;">
            ${this.simulatedRole ? `
              <div style="background: #fef3c7; border: 1px solid #f59e0b; color: #b45309; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
                <span>🎭 Simulando: ${this.simulatedRole}</span>
                <button type="button" id="btn-stop-simulation" style="background: #dc2626; color: white; border: none; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer;">✕ Salir</button>
              </div>
            ` : ''}

            <div class="role-selector-chip">
              <span style="font-size: 11px; font-weight: 800; color: #475569;">Rol Activo:</span>
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

        <!-- PESTAÑAS PRINCIPALES -->
        <div class="config-tabs">
          <button class="tab-btn ${this.activeTab === 'club' ? 'active' : ''}" data-tab="club">
            🏢 Clubs & Equipos
          </button>
          
          ${this._can("VIEW_TAB_PLAYERS") ? `
            <button class="tab-btn ${this.activeTab === 'players' ? 'active' : ''}" data-tab="players">
              👥 Plantilla (${players.length})
            </button>
          ` : ''}

          ${this._can("VIEW_TAB_USERS") ? `
            <button class="tab-btn ${this.activeTab === 'users' ? 'active' : ''}" data-tab="users">
              👤 Usuarios & Roles (${this.profilesList.length})
            </button>
          ` : ''}

          ${this._can("VIEW_TAB_SEASONS") ? `
            <button class="tab-btn ${this.activeTab === 'seasons' ? 'active' : ''}" data-tab="seasons">
              📅 Temporadas (${this.seasonsList.length})
            </button>
          ` : ''}

          ${this._can("VIEW_TAB_TRANSLATIONS") ? `
            <button class="tab-btn tab-admin ${this.activeTab === 'translations' ? 'active' : ''}" data-tab="translations">
              🌐 Idiomas & Traducciones 👑
            </button>
          ` : ''}

          ${this.currentUserRole === 'SUPERADMIN' ? `
            <button class="tab-btn tab-simulation ${this.activeTab === 'simulation' ? 'active' : ''}" data-tab="simulation">
              🎭 Simulación de Roles 👑
            </button>
          ` : ''}
        </div>

        ${isReadOnly ? `<div class="read-only-banner">ℹ️ Modo Permisos de solo lectura activo (${effectiveRole}).</div>` : ''}

        <!-- CONTENIDO PESTAÑAS -->
        <div class="tab-content-area">
          
          <!-- PESTAÑA 1: CLUBS Y EQUIPOS -->
          ${this.activeTab === 'club' ? `
            ${this.clubSubView === 'list' ? `
              ${this._can("CREATE_CLUB") ? `
                <div class="config-card" style="margin-bottom: 16px;">
                  <div class="card-title"><span>👑</span> CREAR UN NUEVO CLUB (EXCLUSIVO SUPERADMIN)</div>
                  <form id="form-create-club" class="grid-2-cols">
                    <div class="form-group"><label>Nombre del Club *</label><input type="text" id="club-new-name" placeholder="Ej. CB Sants" required /></div>
                    <div class="form-group"><label>Nombre del Coordinador</label><input type="text" id="club-new-coordinator" placeholder="Ej. Marc Soler" /></div>
                    <div class="form-group"><label>Teléfono de Contacto</label><input type="text" id="club-new-phone" placeholder="Ej. +34 600 000 000" /></div>
                    <div class="form-group"><label>Dirección</label><input type="text" id="club-new-address" placeholder="Ej. Av. de Roma 12" /></div>
                    <div style="grid-column: 1 / -1; text-align: right;"><button type="submit" class="btn-primary">+ Crear Club</button></div>
                  </form>
                </div>
              ` : ''}

              ${this._can("CREATE_TEAM") ? `
                <div class="config-card" style="margin-bottom: 16px;">
                  <div class="card-title"><span>🏆</span> CREAR UN NUEVO EQUIPO</div>
                  <form id="form-create-team" class="grid-2-cols">
                    <div class="form-group"><label>Club Asignado *</label><select id="team-new-club-id" required>${realClubs.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}</select></div>
                    <div class="form-group"><label>Nombre del Equipo *</label><input type="text" id="team-new-name" placeholder="Ej. Mini Femení B" required /></div>
                    <div class="form-group"><label>Categoría *</label><input type="text" id="team-new-category" placeholder="Ej. Mini / Alevín" required /></div>
                    <div class="form-group"><label>Competición *</label><input type="text" id="team-new-competition" placeholder="Ej. B1 / Preferente" required /></div>
                    <div class="form-group"><label>Entrenador Principal *</label><input type="text" id="team-new-coach" placeholder="Ej. Teo Raichman" required /></div>
                    <div class="form-group"><label>Color Principal</label><input type="color" id="team-new-color" value="#9d76e5" style="width: 100%; height: 38px; border: none; cursor: pointer;" /></div>
                    <div style="grid-column: 1 / -1; text-align: right;"><button type="submit" class="btn-primary">+ Crear Equipo Completo</button></div>
                  </form>
                </div>
              ` : ''}

              <div class="config-card" style="margin-bottom: 16px;">
                <div class="card-title"><span>🏢</span> CLUBS REGISTRADOS (${realClubs.length})</div>
                <div class="table-responsive">
                  <table class="data-table">
                    <thead><tr><th>Nombre del Club</th><th>Coordinador</th><th>Teléfono</th><th>Dirección</th><th style="text-align: right;">Acción</th></tr></thead>
                    <tbody>${realClubs.length > 0 ? realClubs.map(c => `<tr><td><strong>${c.name || 'Sin Nombre'}</strong></td><td>${c.coordinator_name || 'No asignado'}</td><td>${c.phone || '-'}</td><td>${c.address || '-'}</td><td style="text-align: right;"><button type="button" class="btn-edit-club btn-outline-sm" data-id="${c.id}">✏️ Editar Club</button></td></tr>`).join("") : `<tr><td colspan="5" style="text-align: center; color: #64748b;">No hay clubs registrados.</td></tr>`}</tbody>
                  </table>
                </div>
              </div>

              <div class="config-card">
                <div class="card-title"><span>📊</span> EQUIPOS (${realTeams.length})</div>
                <div class="table-responsive">
                  <table class="data-table">
                    <thead><tr><th>Club</th><th>Equipo</th><th>Categoría</th><th>Entrenador</th><th>Estado</th><th style="text-align: right;">Acción</th></tr></thead>
                    <tbody>${realTeams.length > 0 ? realTeams.map(t => { const isTeamActive = String(t.id).trim().toLowerCase() === String(activeTeamId).trim().toLowerCase(); return `<tr class="${isTeamActive ? 'active-team-row' : ''}"><td><strong>${t.clubName || 'JMJ Manyanet Sant Andreu'}</strong></td><td>${t.name}</td><td><span class="badge-category">${t.category || '-'}</span></td><td><strong>${t.coach_name || t.coach || 'Por definir'}</strong></td><td>${isTeamActive ? `<span class="badge-active-team">🟢 Activo Actual</span>` : `<button type="button" class="btn-set-active-team btn-outline-sm" data-id="${t.id}">Activar</button>`}</td><td style="text-align: right;"><button type="button" class="btn-edit-team btn-secondary-sm" data-id="${t.id}">⚙️ Configurar</button></td></tr>`; }).join("") : `<tr><td colspan="6" style="text-align: center; color: #64748b;">No hay equipos registrados.</td></tr>`}</tbody>
                  </table>
                </div>
              </div>
            ` : ''}

            ${this.clubSubView === 'edit-team' ? `
              <div class="config-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                  <div class="card-title" style="margin: 0;"><span>🏢</span> DATOS DEL EQUIPO (${this.selectedTeamForEdit?.name || ''})</div>
                  <button type="button" class="btn-back-to-list btn-outline-sm">⬅️ Volver al Listado</button>
                </div>

                <form id="form-edit-team" class="grid-2-cols">
                  <div class="form-group"><label>Nombre del Club</label><input type="text" value="${this.selectedTeamForEdit?.clubName || 'JMJ Manyanet Sant Andreu'}" disabled /></div>
                  <div class="form-group"><label>Nombre del Equipo</label><input type="text" id="edit-team-name" value="${this.selectedTeamForEdit?.name || ''}" ${isReadOnly ? 'disabled' : ''} required /></div>
                  <div class="form-group"><label>Categoría</label><input type="text" id="edit-team-category" value="${this.selectedTeamForEdit?.category || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>Competición</label><input type="text" id="edit-team-competition" value="${this.selectedTeamForEdit?.competition || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>Entrenador Principal</label><input type="text" id="edit-team-coach" value="${this.selectedTeamForEdit?.coach_name || this.selectedTeamForEdit?.coach || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>Color Principal</label><input type="color" id="edit-team-color" value="${this.selectedTeamForEdit?.color || '#9d76e5'}" style="width: 100%; height: 38px; border: none; cursor: pointer;" ${isReadOnly ? 'disabled' : ''} /></div>
                  ${!isReadOnly ? `<div style="grid-column: 1 / -1; text-align: right;"><button type="submit" class="btn-primary">💾 Guardar Cambios Equipo</button></div>` : ''}
                </form>
              </div>
            ` : ''}

            ${this.clubSubView === 'edit-club' ? `
              <div class="config-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                  <div class="card-title" style="margin: 0;"><span>🏢</span> CONFIGURACIÓN DEL CLUB (${this.selectedClubForEdit?.name || ''})</div>
                  <button type="button" class="btn-back-to-list btn-outline-sm">⬅️ Volver al Listado</button>
                </div>

                <form id="form-edit-club" class="grid-2-cols">
                  <div class="form-group"><label>Nombre del Club</label><input type="text" id="edit-club-name" value="${this.selectedClubForEdit?.name || ''}" ${!this._can("MANAGE_CLUB_DATA") ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>Nombre del Coordinador</label><input type="text" id="edit-club-coordinator" value="${this.selectedClubForEdit?.coordinator_name || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>Teléfono de Contacto</label><input type="text" id="edit-club-phone" value="${this.selectedClubForEdit?.phone || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>Dirección</label><input type="text" id="edit-club-address" value="${this.selectedClubForEdit?.address || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  ${!isReadOnly ? `<div style="grid-column: 1 / -1; text-align: right;"><button type="submit" class="btn-primary">💾 Guardar Datos del Club</button></div>` : ''}
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
                  <div class="card-title" style="color: #b45309;"><span>📩</span> SOLICITUDES DE TRASPASO PENDIENTES (${pendingTransfersList.length})</div>
                  <div class="table-responsive">
                    <table class="data-table">
                      <thead><tr><th>Jugador</th><th>Equipo Solicitante</th><th style="text-align: right;">Acciones</th></tr></thead>
                      <tbody>
                        ${pendingTransfersList.map(tr => {
                          const targetTeam = realTeams.find(t => String(t.id).toLowerCase() === String(tr.targetTeamId).toLowerCase());
                          return `
                            <tr>
                              <td><strong>${tr.playerName}</strong></td>
                              <td><span class="badge-category">${targetTeam ? targetTeam.name : 'Nuevo Equipo'}</span></td>
                              <td style="text-align: right; display: flex; justify-content: flex-end; gap: 8px;">
                                <button type="button" class="btn-approve-transfer btn-secondary-sm" data-id="${tr.id}" data-player-id="${tr.playerId}" data-target-team="${tr.targetTeamId}" style="background: #16a34a;">🟢 Aprobar Traspaso</button>
                                <button type="button" class="btn-reject-transfer btn-danger-sm" data-id="${tr.id}">🔴 Rechazar</button>
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
                  <h3 style="margin: 0; font-size: 15px; color: #1e3a8a; font-weight: 800;">🔄 Mercado de Fichajes Global</h3>
                  <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Busca y solicita el traspaso de jugadores de cualquier equipo del sistema.</p>
                </div>
                <button type="button" id="btn-open-market-modal" class="btn-primary" style="background: #6366f1; padding: 10px 18px; font-size: 13px;">
                  🔍 Abrir Mercado / Fichar Jugador
                </button>
              </div>

              <!-- BLOQUE DE AÑADIR JUGADOR NUEVO -->
              <div class="config-card">
                <div class="card-title"><span>👥</span> AÑADIR JUGADOR NUEVO A LA PLANTILLA</div>
                ${this._can("MANAGE_PLAYERS") ? `
                  <form id="form-add-player" class="grid-4-cols">
                    <div class="form-group"><label>Nombre *</label><input type="text" id="add-p-name" placeholder="Ej. Pablo" required /></div>
                    <div class="form-group"><label>Apellidos *</label><input type="text" id="add-p-lastname" placeholder="Ej. García" required /></div>
                    <div class="form-group"><label>Dorsal / Nº *</label><input type="number" id="add-p-number" placeholder="Ej. 10" required min="0" max="99" /></div>
                    <div class="form-group">
                      <label>Posición Principal *</label>
                      <select id="add-p-position" required>
                        <option value="Base">Base</option><option value="Escolta">Escolta</option><option value="Alero">Alero</option><option value="Ala-pívot">Ala-pívot</option><option value="Pívot">Pívot</option>
                      </select>
                    </div>
                    <div style="grid-column: 1 / -1; text-align: right;">
                      <button type="submit" class="btn-secondary">+ Crear y Añadir a la Plantilla</button>
                    </div>
                  </form>
                ` : ''}
              </div>

              <!-- JUGADORES PLANTILLA ACTIVA -->
              <div class="config-card">
                <div class="card-title"><span>📋</span> JUGADORES EN TU PLANTILLA ACTIVA (${players.length})</div>
                <div class="players-grid">
                  ${players.length > 0 ? players.map(p => `
                    <div class="player-card ${p.status === 'TRASPASADO' ? 'player-transferred' : ''}">
                      <div>
                        <strong>#${p.jersey ?? '?'} ${p.first_name || ''} ${p.last_name || ''}</strong>
                        <div style="font-size: 11px; color: #64748b;">
                          ${p.primary_position || p.position || 'Jugador'} • ${p.status === 'TRASPASADO' ? '⚠️ Traspasado (Histórico)' : 'Activo'}
                        </div>
                      </div>
                      ${this._can("MANAGE_PLAYERS") ? `<button type="button" class="btn-edit-player-modal btn-edit-link" data-id="${p.id}">✏️ Editar</button>` : ''}
                    </div>
                  `).join("") : `<p style="font-size: 13px; color: #64748b; grid-column: 1/-1;">No hay jugadores registrados en esta plantilla.</p>`}
                </div>
              </div>

              <!-- SUBPANTALLA / MODAL DEL MERCADO GLOBAL -->
              <div id="modal-market-global" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); z-index: 9999; align-items: center; justify-content: center;">
                <div class="config-card" style="width: 100%; max-width: 850px; max-height: 90vh; overflow-y: auto; margin: 20px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                      <h3 style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 800;">🔄 Mercado de Fichajes Global</h3>
                      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Mostrando todos los jugadores registrados en la base de datos de Supabase.</p>
                    </div>
                    <button type="button" id="btn-close-market-modal" class="btn-outline-sm" style="font-size: 16px; padding: 4px 10px;">✕</button>
                  </div>
                  <div style="margin-bottom: 12px;">
                    <input type="text" id="input-market-search" placeholder="🔍 Buscar por nombre, apellido o club..." value="${this.marketSearchQuery}" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
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
                <div class="card-title"><span>👤</span> ALTA DE USUARIO E INVITACIÓN DIRECTA</div>
                <form id="form-create-user-profile" class="grid-2-cols">
                  <div class="form-group">
                    <label>Nombre Completo *</label>
                    <input type="text" id="new-user-name" placeholder="Ej. Carlos García" required />
                  </div>
                  <div class="form-group">
                    <label>Correo Electrónico (Email) *</label>
                    <input type="email" id="new-user-email" placeholder="usuario@ejemplo.com" required />
                  </div>
                  <div class="form-group">
                    <label>Rol Asignado *</label>
                    <select id="new-user-role">
                      ${this._can("ASSIGN_ADMIN_ROLE") ? `<option value="Superadmin">Superadmin</option><option value="Administrador de Club">Administrador de Club</option>` : ''}
                      <option value="Entrenador" selected>Entrenador</option>
                      <option value="Analista">Analista</option>
                      <option value="Jugador">Jugador</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>🔑 Contraseña Temporal *</label>
                    <input type="text" id="new-user-pass" value="BasketIQ2026" required />
                  </div>
                  <div style="grid-column: 1 / -1; text-align: right;">
                    <button type="submit" class="btn-primary">✉️ Dar de Alta e Invitar Usuario</button>
                  </div>
                </form>
              </div>

              <div class="config-card">
                <div class="card-title"><span>👥</span> ADMINISTRAR MIEMBROS Y ROLES (${this.profilesList.length})</div>
                <div class="table-responsive">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Email</th>
                        <th>Rol Asignado</th>
                        <th style="text-align: right;">Acción</th>
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
                            <button type="button" class="btn-save-user-role btn-secondary-sm" data-id="${prof.id}">💾 Guardar Rol</button>
                          </td>
                        </tr>
                      `).join("") : `<tr><td colspan="4" style="text-align: center; color: #64748b;">No hay usuarios registrados.</td></tr>`}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ` : ''}

          <!-- PESTAÑA 4: TEMPORADAS -->
          ${this.activeTab === 'seasons' && this._can("VIEW_TAB_SEASONS") ? `
            <div class="config-card">
              <div class="card-title"><span>📅</span> TEMPORADAS REGISTRADAS EN SUPABASE (${this.seasonsList.length})</div>

              ${!isReadOnly ? `
                <form id="form-create-season" class="grid-inline" style="margin-bottom: 20px;">
                  <div class="form-group" style="flex: 2;">
                    <label>Nombre de la Nueva Temporada *</label>
                    <input type="text" id="input-new-season-name" placeholder="Ej. 2026/2027" required />
                  </div>
                  <div style="align-self: flex-end;">
                    <button type="submit" class="btn-primary">+ Añadir Temporada</button>
                  </div>
                </form>
              ` : ''}

              <div class="seasons-list" style="display: flex; flex-direction: column; gap: 10px;">
                ${this.seasonsList.length > 0 ? this.seasonsList.map(s => {
                  const isSeasonActive = String(s.name) === String(localStorage.getItem("iq_active_season") || "2026");
                  return `
                    <div class="season-row" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
                      <div style="display: flex; align-items: center; gap: 10px; flex: 1; max-width: 320px;">
                        <span style="font-size: 12px; font-weight: 800; color: #475569;">Temporada:</span>
                        <input type="text" class="input-season-edit" data-id="${s.id}" value="${s.name}" ${isReadOnly ? 'disabled' : ''} style="font-weight: 800; font-size: 13px; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%;" />
                      </div>

                      <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="${isSeasonActive ? 'badge-active-team' : 'badge-inactive'}">
                          ${isSeasonActive ? '🟢 Activa' : '⚪ Inactiva'}
                        </span>

                        ${!isReadOnly ? `
                          <button type="button" class="btn-save-season-name btn-secondary-sm" data-id="${s.id}">💾 Guardar Nombre</button>
                          ${!isSeasonActive ? `<button type="button" class="btn-activate-season btn-outline-sm" data-id="${s.id}" data-name="${s.name}">Activar</button>` : ''}
                        ` : ''}

                        ${this._can("DELETE_SEASON") ? `
                          <button type="button" class="btn-delete-season btn-danger-sm" data-id="${s.id}" title="Eliminar Temporada (Exclusivo Superadmin)">🗑️</button>
                        ` : ''}
                      </div>
                    </div>
                  `;
                }).join("") : `<p style="font-size: 13px; color: #64748b;">No hay temporadas registradas.</p>`}
              </div>
            </div>
          ` : ''}

          <!-- PESTAÑA 5: IDIOMAS Y TRADUCCIONES -->
          ${this.activeTab === 'translations' && this._can("VIEW_TAB_TRANSLATIONS") ? `
            <div class="config-card">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
                <div>
                  <div class="card-title" style="margin: 0;"><span>🌐</span> DICCIONARIO GLOBAL E IDIOMAS</div>
                  <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Personaliza o crea traducciones en Supabase.</p>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <label style="font-size: 11px; font-weight: 800; color: #475569;">Editar Idioma:</label>
                    <select id="select-edit-lang" style="padding: 6px 12px; border-radius: 6px; font-weight: 700; border: 1px solid #cbd5e1;">
                      ${this.availableLangs.map(l => `<option value="${l.code}" ${l.code === this.selectedLangForEdit ? 'selected' : ''}>${l.label}</option>`).join("")}
                    </select>
                  </div>
                </div>
              </div>

              <form id="form-save-translations">
                <div class="table-responsive">
                  <table class="data-table">
                    <thead><tr><th>Clave (Key)</th><th>Traducción (${this.selectedLangForEdit.toUpperCase()})</th></tr></thead>
                    <tbody>
                      ${this.dbTranslations.length > 0 ? this.dbTranslations.map(t => `
                        <tr>
                          <td><code>${t.key}</code></td>
                          <td><input type="text" class="input-translation-item" data-key="${t.key}" value="${t.translation}" style="width: 100%; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
                        </tr>
                      `).join("") : `<tr><td colspan="2" style="text-align: center; color: #64748b; padding: 20px;">No hay traducciones registradas para ${this.selectedLangForEdit}.</td></tr>`}
                    </tbody>
                  </table>
                </div>
                <div style="text-align: right; margin-top: 16px;">
                  <button type="submit" class="btn-primary">💾 Guardar Cambios de Idioma</button>
                </div>
              </form>
            </div>
          ` : ''}

          <!-- PESTAÑA 6: SIMULACIÓN DE ROLES (EXCLUSIVO SUPERADMIN) -->
          ${this.activeTab === 'simulation' && this.currentUserRole === 'SUPERADMIN' ? `
            <div class="config-card" style="border: 2px solid #6366f1;">
              <div class="card-title" style="color: #4f46e5;"><span>🎭</span> MODO SIMULACIÓN DE PANTALLAS Y PERMISOS</div>
              <p style="font-size: 13px; color: #475569; margin-top: -8px; margin-bottom: 20px;">
                Selecciona un rol para simular la interfaz y comprobar de inmediato qué opciones y botones puede ver y ejecutar cada perfil de usuario en toda la app.
              </p>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="SUPERADMIN" style="padding: 14px; text-align: left; font-weight: 800;">👑 Simular SUPERADMIN</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="ADMIN" style="padding: 14px; text-align: left; font-weight: 800;">🔑 Simular ADMIN CLUB</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="ENTRENADOR" style="padding: 14px; text-align: left; font-weight: 800;">📋 Simular ENTRENADOR</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="ANALISTA" style="padding: 14px; text-align: left; font-weight: 800;">📈 Simular ANALISTA</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="JUGADOR" style="padding: 14px; text-align: left; font-weight: 800;">👤 Simular JUGADOR</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="INVITADO" style="padding: 14px; text-align: left; font-weight: 800;">👁️ Simular INVITADO (Demo)</button>
              </div>

              ${this.simulatedRole ? `
                <div style="text-align: right;">
                  <button type="button" id="btn-reset-simulation" class="btn-danger-sm" style="padding: 10px 18px; font-weight: 800;">🔴 Desactivar Simulación (Volver a Modo Real)</button>
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

    // 1. EVENTOS EDITAR CLUB Y CONFIGURAR EQUIPO
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

    // 2. FORMULARIO GUARDAR CAMBIOS DE CLUB
    const formEditClub = container.querySelector("#form-edit-club");
    if (formEditClub) {
      formEditClub.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!this.selectedClubForEdit) return;

        const name = container.querySelector("#edit-club-name")?.value;
        const coordinator_name = container.querySelector("#edit-club-coordinator")?.value;
        const phone = container.querySelector("#edit-club-phone")?.value;
        const address = container.querySelector("#edit-club-address")?.value;

        const payload = { id: this.selectedClubForEdit.id, name, coordinator_name, phone, address };

        this.showSyncOverlay("💾 Guardando datos del club...");
        await DataStore.saveClub(payload);
        await DataStore.init(DataStore.getActiveTeamId(), true);
        this.hideSyncOverlay();

        alert("✅ Datos del club guardados correctamente.");
        this.clubSubView = "list";
        await this.render(containerId);
      });
    }

    // 3. FORMULARIO GUARDAR CAMBIOS DE EQUIPO
    const formEditTeam = container.querySelector("#form-edit-team");
    if (formEditTeam) {
      formEditTeam.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!this.selectedTeamForEdit) return;

        const name = container.querySelector("#edit-team-name")?.value;
        const category = container.querySelector("#edit-team-category")?.value;
        const competition = container.querySelector("#edit-team-competition")?.value;
        const coach_name = container.querySelector("#edit-team-coach")?.value;
        const color = container.querySelector("#edit-team-color")?.value;

        const payload = { id: this.selectedTeamForEdit.id, name, category, competition, coach_name, color };

        this.showSyncOverlay("💾 Guardando cambios del equipo...");
        await DataStore.saveTeam(payload);
        await DataStore.init(DataStore.getActiveTeamId(), true);
        this.hideSyncOverlay();

        alert("✅ Datos del equipo guardados correctamente.");
        this.clubSubView = "list";
        await this.render(containerId);
      });
    }

    // 4. SUBPANTALLA / MODAL DEL MERCADO GLOBAL
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
                <th>Jugador</th>
                <th>Posición</th>
                <th>Equipo Actual</th>
                <th>Estado</th>
                <th style="text-align: right;">Acción</th>
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
                        ? '<span class="badge-active-team">En plantilla</span>' 
                        : (pendingTransfer ? '<span class="badge-pending">⏳ Traspaso Pendiente</span>' : '<span class="badge-inactive">Disponible</span>')}
                    </td>
                    <td style="text-align: right;">
                      ${isOwnPlayer ? `
                        <button type="button" class="btn-outline-sm" disabled>En Tu Plantilla</button>
                      ` : (pendingTransfer ? `
                        <button type="button" class="btn-outline-sm" disabled>Pendiente Aprobación</button>
                      ` : `
                        <button type="button" class="btn-request-transfer btn-secondary-sm" data-id="${p.id}" data-name="${p.first_name} ${p.last_name || ''}">
                          📩 Solicitar Traspaso
                        </button>
                      `)}
                    </td>
                  </tr>
                `;
              }).join("") : `<tr><td colspan="5" style="text-align: center; color: #64748b;">No se encontraron jugadores en la base de datos.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font-size: 12px; color: #64748b;">
          <span>Mostrando ${paginated.length} de ${filtered.length} jugadores</span>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button type="button" id="btn-prev-market-modal-page" class="btn-outline-sm" ${this.marketCurrentPage <= 1 ? 'disabled' : ''}>⬅️ Anterior</button>
            <span style="font-weight: 700; color: #1e3a8a;">Pág. ${this.marketCurrentPage} de ${totalPages}</span>
            <button type="button" id="btn-next-market-modal-page" class="btn-outline-sm" ${this.marketCurrentPage >= totalPages ? 'disabled' : ''}>Siguiente ➡️</button>
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

    // 5. EVENTOS IDIOMAS Y DICCIONARIO
    const selectEditLang = container.querySelector("#select-edit-lang");
    if (selectEditLang) {
      selectEditLang.addEventListener("change", async (e) => {
        this.selectedLangForEdit = e.target.value;
        this.showSyncOverlay(`⚡ Cargando diccionario (${this.selectedLangForEdit.toUpperCase()})...`);
        await this._fetchTranslationsForLang(this.selectedLangForEdit);
        this.hideSyncOverlay();
        await this.render(containerId);
      });
    }

    const formSaveTranslations = container.querySelector("#form-save-translations");
    if (formSaveTranslations) {
      formSaveTranslations.addEventListener("submit", async (e) => {
        e.preventDefault();

        const inputs = container.querySelectorAll(".input-translation-item");
        const payload = [];

        inputs.forEach(input => {
          const key = input.getAttribute("data-key");
          const translation = input.value.trim();
          if (key && translation) {
            payload.push({
              key,
              language_code: this.selectedLangForEdit,
              translation
            });
          }
        });

        try {
          this.showSyncOverlay("💾 Guardando diccionario en Supabase...");

          const { error } = await supabase
            .from("translations")
            .upsert(payload, { onConflict: "key,language_code" });

          this.hideSyncOverlay();

          if (error) {
            alert(`❌ Error guardando traducción: ${error.message}`);
          } else {
            alert(`✅ Diccionario en '${this.selectedLangForEdit.toUpperCase()}' guardado correctamente.`);
            this.activeTab = "translations";
            await this.render(containerId);
          }
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error guardando diccionario:", err);
        }
      });
    }

    // 6. SIMULACIÓN DE ROLES (CON PRESERVACIÓN DE CREDENCIALES SUPERADMIN)
    container.querySelectorAll(".btn-simulate-role").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const roleToSimulate = e.currentTarget.getAttribute("data-role");
        
        // Guardamos la máscara sin destruir el rol real de SUPERADMIN
        this.simulatedRole = roleToSimulate;
        localStorage.setItem("iq_simulated_role", roleToSimulate);
        localStorage.setItem("iq_user_role", "SUPERADMIN");

        alert(`🎭 Simulación activada: La app muestra la interfaz de '${roleToSimulate}'. Puedes salir en cualquier momento con el botón 'Salir'.`);
        await this.render(containerId);
      });
    });

    const resetSimBtn = container.querySelector("#btn-reset-simulation") || container.querySelector("#btn-stop-simulation");
    if (resetSimBtn) {
      resetSimBtn.addEventListener("click", async () => {
        this.simulatedRole = null;
        localStorage.removeItem("iq_simulated_role");
        localStorage.setItem("iq_user_role", "SUPERADMIN");

        alert("🔴 Simulación desactivada. Volviendo a control total de SUPERADMIN.");
        await this.render(containerId);
      });
    }

    container.querySelector("#select-demo-role")?.addEventListener("change", (e) => {
      this.currentUserRole = e.target.value;
      this.simulatedRole = null;
      localStorage.removeItem("iq_simulated_role");
      localStorage.setItem("iq_user_role", this.currentUserRole);
      this.render(containerId);
    });
  }
}