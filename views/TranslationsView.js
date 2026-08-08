/**
 * @fileoverview Vista de Configuración de IQ Basket.
 * Optimizado: Carga diferida y en caché del mercado global de jugadores
 * para que el cambio a la pestaña 'Plantilla' sea instantáneo (0ms).
 */

import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { supabase } from "../config/database.config.js";

export class TranslationsView {
  constructor(authController) {
    this.auth = authController;
    this.currentUserRole = localStorage.getItem("iq_user_role") || "SUPERADMIN";
    this.activeTab = "club";
    this.clubSubView = "list";
    this.selectedTeamForEdit = null;
    this.selectedClubForEdit = null;

    // Paginación y Filtro del Mercado
    this.marketSearchQuery = "";
    this.marketCurrentPage = 1;
    this.marketItemsPerPage = 10;

    // Mercado global en caché
    this.allMarketPlayers = [];
    this.isMarketLoaded = false;

    // Temporadas
    const storedSeasons = localStorage.getItem("iq_seasons");
    this.seasonsList = storedSeasons ? JSON.parse(storedSeasons) : [
      { id: "s-1", name: "2026", isActive: true }
    ];

    // Traspasos locales
    const storedTransfers = localStorage.getItem("iq_transfers");
    this.transfers = storedTransfers ? JSON.parse(storedTransfers) : [];

    // Perfiles
    this.profilesList = [];
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
    const role = this.currentUserRole;
    switch (action) {
      case "VIEW_TAB_TRANSLATIONS":
      case "CREATE_CLUB":
      case "ASSIGN_ADMIN_ROLE":
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

  async _fetchProfiles() {
    try {
      const { data, error } = await supabase.from("profiles").select("*");
      if (!error && data && data.length > 0) {
        this.profilesList = data;
      } else {
        this.profilesList = [
          {
            id: "4b6eee85-028c-4b54-8e50-2b12427c9854",
            display_name: "Sergio Colado García",
            email: "scolado@nechigroup.com",
            role: "Superadmin"
          }
        ];
      }
    } catch (e) {
      console.warn("Error leyendo perfiles:", e);
    }
  }

  /**
   * Carga el mercado global solo 1 vez o cuando se fuerce (force = true)
   */
  async _fetchAllMarketPlayers(force = false) {
    if (this.isMarketLoaded && !force) return;

    try {
      const { data, error } = await supabase.from("players").select("*");
      if (!error && data) {
        const teams = DataStore.getTeams() || [];
        this.allMarketPlayers = data.map(p => {
          const t = teams.find(team => String(team.id).toLowerCase() === String(p.team_id).toLowerCase());
          return {
            ...p,
            team_name: t ? t.name : 'Otro Equipo'
          };
        });
        this.isMarketLoaded = true;
      }
    } catch (e) {
      console.warn("Error cargando mercado de jugadores:", e);
    }
  }

  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (this.activeTab === "users" && this.profilesList.length === 0) {
      await this._fetchProfiles();
    }

    if (this.activeTab === "players" && !this.isMarketLoaded) {
      await this._fetchAllMarketPlayers();
    }

    const isReadOnly = !this._can("EDIT_DATA");
    const activeTeamId = DataStore.getActiveTeamId();
    const players = DataStore.getPlayers() || [];
    const realClubs = DataStore.getClubs() || [];
    const realTeams = DataStore.getTeams() || [];

    const pendingTransfersList = this.transfers.filter(t => t.status === "PENDIENTE");

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
        
        <!-- HEADER CONFIGURACIÓN -->
        <div class="config-header">
          <div>
            <h1>Configuración ⚙️</h1>
            <p>Gestiona los datos de los clubes, equipos, plantilla, permisos, traducciones y temporadas.</p>
          </div>

          <div class="role-selector-chip">
            <span style="font-size: 11px; font-weight: 800; color: #475569;">Rol Activo:</span>
            <select id="select-demo-role">
              <option value="SUPERADMIN" ${this.currentUserRole === 'SUPERADMIN' ? 'selected' : ''}>👑 Superadmin</option>
              <option value="ADMIN" ${this.currentUserRole === 'ADMIN' ? 'selected' : ''}>🔑 Admin Club</option>
              <option value="ENTRENADOR" ${this.currentUserRole === 'ENTRENADOR' ? 'selected' : ''}>📋 Entrenador</option>
              <option value="ANALISTA" ${this.currentUserRole === 'ANALISTA' ? 'selected' : ''}>📈 Analista</option>
              <option value="JUGADOR" ${this.currentUserRole === 'JUGADOR' ? 'selected' : ''}>👤 Jugador</option>
              <option value="INVITADO" ${this.currentUserRole === 'INVITADO' ? 'selected' : ''}>👁️ Invitado (Demo)</option>
            </select>
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
              👤 Usuarios & Roles
            </button>
          ` : ''}

          ${this._can("VIEW_TAB_REQUESTS") ? `
            <button class="tab-btn ${this.activeTab === 'requests' ? 'active' : ''}" data-tab="requests">
              📩 Unirse a un Club
            </button>
          ` : ''}

          ${this._can("VIEW_TAB_SEASONS") ? `
            <button class="tab-btn ${this.activeTab === 'seasons' ? 'active' : ''}" data-tab="seasons">
              📅 Temporadas
            </button>
          ` : ''}

          ${this._can("VIEW_TAB_TRANSLATIONS") ? `
            <button class="tab-btn tab-admin ${this.activeTab === 'translations' ? 'active' : ''}" data-tab="translations">
              🌐 Idiomas & Traducciones 👑
            </button>
          ` : ''}
        </div>

        ${isReadOnly ? `<div class="read-only-banner">ℹ️ Modo Permisos de solo lectura activo (${this.currentUserRole}).</div>` : ''}

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
                <div class="card-title"><span>📊</span> EQUIPOS DEL SISTEMA (${realTeams.length})</div>
                <div class="table-responsive">
                  <table class="data-table">
                    <thead><tr><th>Club</th><th>Equipo</th><th>Categoría</th><th>Entrenador</th><th>Estado</th><th style="text-align: right;">Acción</th></tr></thead>
                    <tbody>${realTeams.length > 0 ? realTeams.map(t => { const isTeamActive = String(t.id).trim().toLowerCase() === String(activeTeamId).trim().toLowerCase(); return `<tr class="${isTeamActive ? 'active-team-row' : ''}"><td><strong>${t.clubName || 'JMJ Manyanet Sant Andreu'}</strong></td><td>${t.name}</td><td><span class="badge-category">${t.category || '-'}</span></td><td><strong>${t.coach_name || t.coach || 'Por definir'}</strong></td><td>${isTeamActive ? `<span class="badge-active-team">🟢 Activo Actual</span>` : `<button type="button" class="btn-set-active-team btn-outline-sm" data-id="${t.id}">Activar</button>`}</td><td style="text-align: right;"><button type="button" class="btn-edit-team btn-secondary-sm" data-id="${t.id}">⚙️ Configurar</button></td></tr>`; }).join("") : `<tr><td colspan="6" style="text-align: center; color: #64748b;">No hay equipos registrados.</td></tr>`}</tbody>
                  </table>
                </div>
              </div>
            ` : ''}
          ` : ''}

          <!-- PESTAÑA 2: PLANTILLA & TRASPASOS -->
          ${this.activeTab === 'players' && this._can("VIEW_TAB_PLAYERS") ? `
            <div class="config-container">
              
              <!-- PANEL DE APROBACIÓN DE TRASPASOS PENDIENTES -->
              ${this._can("APPROVE_TRANSFERS") && pendingTransfersList.length > 0 ? `
                <div class="config-card" style="border: 2px solid #f59e0b; background: #fffbeb;">
                  <div class="card-title" style="color: #b45309;"><span>📩</span> SOLICITUDES DE TRASPASO PENDIENTES (${pendingTransfersList.length})</div>
                  <p style="font-size: 12px; color: #78350f; margin-top: -8px; margin-bottom: 12px;">
                    Aprueba o rechaza el fichaje de jugadores. Al aprobar, el jugador cambia de equipo conservando sus datos históricos.
                  </p>
                  <div class="table-responsive">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Jugador</th>
                          <th>Equipo Solicitante</th>
                          <th style="text-align: right;">Acciones</th>
                        </tr>
                      </thead>
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
                        <option value="Base">Base</option>
                        <option value="Escolta">Escolta</option>
                        <option value="Alero">Alero</option>
                        <option value="Ala-pívot">Ala-pívot</option>
                        <option value="Pívot">Pívot</option>
                      </select>
                    </div>
                    <div style="grid-column: 1 / -1; text-align: right;">
                      <button type="submit" class="btn-secondary">+ Crear y Añadir a la Plantilla</button>
                    </div>
                  </form>
                ` : ''}
              </div>

              <!-- TABLA DE MERCADO / TRASPASOS GLOBAL -->
              <div class="config-card">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                  <div class="card-title" style="margin: 0;"><span>🔄</span> FICHAR JUGADOR EXISTENTE (MERCADO / TRASPASOS) (${sourcePlayersList.length})</div>
                  <div style="display: flex; gap: 6px; width: 100%; max-width: 320px;">
                    <input type="text" id="input-market-search" placeholder="🔍 Buscar por nombre, apellido o club..." value="${this.marketSearchQuery}" style="width: 100%; padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;" />
                  </div>
                </div>

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
                      ${paginatedPlayers.length > 0 ? paginatedPlayers.map(p => {
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
                      }).join("") : `<tr><td colspan="5" style="text-align: center; color: #64748b;">No se encontraron jugadores en el sistema.</td></tr>`}
                    </tbody>
                  </table>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font-size: 12px; color: #64748b;">
                  <span>Mostrando ${paginatedPlayers.length} de ${filteredPlayers.length} jugadores en el mercado</span>
                  <div style="display: flex; gap: 6px; align-items: center;">
                    <button type="button" id="btn-prev-market-page" class="btn-outline-sm" ${this.marketCurrentPage <= 1 ? 'disabled' : ''}>⬅️ Anterior</button>
                    <span style="font-weight: 700; color: #1e3a8a;">Pág. ${this.marketCurrentPage} de ${totalPages}</span>
                    <button type="button" id="btn-next-market-page" class="btn-outline-sm" ${this.marketCurrentPage >= totalPages ? 'disabled' : ''}>Siguiente ➡️</button>
                  </div>
                </div>
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
                  `).join("") : `<p style="font-size: 13px; color: #64748b; grid-column: 1/-1;">No hay jugadores registrados en esta plantilla. ¡Utiliza el formulario superior para añadir el primero!</p>`}
                </div>
              </div>

              <!-- MODAL DE EDICIÓN DE JUGADOR -->
              <div id="modal-edit-player" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); z-index: 9999; align-items: center; justify-content: center;">
                <div class="config-card" style="width: 100%; max-width: 500px; margin: 20px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 800;">✏️ Editar Datos del Jugador</h3>
                    <button type="button" id="btn-close-edit-player-modal" class="btn-outline-sm" style="font-size: 14px;">✕</button>
                  </div>

                  <form id="form-edit-player-modal" class="grid-2-cols">
                    <input type="hidden" id="edit-p-id" />
                    <div class="form-group"><label>Nombre *</label><input type="text" id="edit-p-name" required /></div>
                    <div class="form-group"><label>Apellidos *</label><input type="text" id="edit-p-lastname" required /></div>
                    <div class="form-group"><label>Dorsal / Nº *</label><input type="number" id="edit-p-number" min="0" max="99" required /></div>
                    <div class="form-group">
                      <label>Posición Principal *</label>
                      <select id="edit-p-position" required>
                        <option value="Base">Base</option>
                        <option value="Escolta">Escolta</option>
                        <option value="Alero">Alero</option>
                        <option value="Ala-pívot">Ala-pívot</option>
                        <option value="Pívot">Pívot</option>
                      </select>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                      <label>Estado del Jugador</label>
                      <select id="edit-p-status">
                        <option value="Activo">Activo</option>
                        <option value="Lesionado">Lesionado</option>
                        <option value="Inactivo">Inactivo</option>
                        <option value="TRASPASADO">Traspasado (Histórico)</option>
                      </select>
                    </div>
                    <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
                      <button type="button" id="btn-cancel-edit-player" class="btn-outline-sm">Cancelar</button>
                      <button type="submit" class="btn-primary">💾 Guardar Cambios</button>
                    </div>
                  </form>
                </div>
              </div>

            </div>
          ` : ''}

          <!-- PESTAÑA 3: USUARIOS & ROLES -->
          ${this.activeTab === 'users' && this._can("VIEW_TAB_USERS") ? `
            <div class="config-container">
              <div class="config-card">
                <div class="card-title"><span>👤</span> ALTA DE USUARIO E INVITACIÓN</div>
                <form id="form-invite-user" class="grid-2-cols">
                  <div class="form-group"><label>Nombre Completo</label><input type="text" placeholder="Ej. Carlos García" required /></div>
                  <div class="form-group"><label>Correo Electrónico (Email)</label><input type="email" placeholder="usuario@ejemplo.com" required /></div>
                  <div class="form-group">
                    <label>Rol Asignado</label>
                    <select>
                      ${this._can("ASSIGN_ADMIN_ROLE") ? `<option>Superadmin</option><option>Administrador de Club</option>` : ''}
                      <option selected>Entrenador</option>
                      <option>Analista</option>
                      <option>Jugador</option>
                    </select>
                  </div>
                  <div class="form-group"><label>🔑 Contraseña Temporal</label><input type="text" value="BasketIQ2026" readonly /></div>
                  <div style="grid-column: 1 / -1; text-align: right;"><button type="submit" class="btn-primary">✉️ Enviar Invitación</button></div>
                </form>
              </div>

              <div class="config-card">
                <div class="card-title"><span>👥</span> ADMINISTRAR MIEMBROS Y ROLES (${this.profilesList.length})</div>
                <div class="table-responsive">
                  <table class="data-table">
                    <thead><tr><th>Usuario</th><th>Email</th><th>Rol Asignado</th><th style="text-align: right;">Acción</th></tr></thead>
                    <tbody>${this.profilesList.map(prof => `<tr><td><strong>${prof.display_name || 'Sin Nombre'}</strong></td><td>${prof.email}</td><td><select class="select-user-role" data-id="${prof.id}" ${!this._can("ASSIGN_ADMIN_ROLE") ? 'disabled' : ''} style="padding: 4px 8px; border-radius: 6px; font-weight: 700;"><option value="Superadmin" ${prof.role === 'Superadmin' ? 'selected' : ''}>Superadmin</option><option value="Administrador de Club" ${prof.role === 'Administrador de Club' ? 'selected' : ''}>Administrador de Club</option><option value="Entrenador" ${prof.role === 'Entrenador' ? 'selected' : ''}>Entrenador</option><option value="Analista" ${prof.role === 'Analista' ? 'selected' : ''}>Analista</option><option value="Jugador" ${prof.role === 'Jugador' ? 'selected' : ''}>Jugador</option></select></td><td style="text-align: right;"><button type="button" class="btn-save-user-role btn-secondary-sm" data-id="${prof.id}">💾 Guardar Rol</button></td></tr>`).join("")}</tbody>
                  </table>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- PESTAÑA 5: TEMPORADAS -->
          ${this.activeTab === 'seasons' && this._can("VIEW_TAB_SEASONS") ? `
            <div class="config-card">
              <div class="card-title"><span>📅</span> TEMPORADAS DEL EQUIPO</div>
              <div class="seasons-list" style="display: flex; flex-direction: column; gap: 10px;">
                ${this.seasonsList.map(s => `<div class="season-row" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;"><div style="display: flex; align-items: center; gap: 10px; flex: 1; max-width: 320px;"><span style="font-size: 12px; font-weight: 800; color: #475569;">Temporada:</span><input type="text" class="input-season-edit" data-id="${s.id}" value="${s.name}" ${isReadOnly ? 'disabled' : ''} style="font-weight: 800; font-size: 13px; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%;" /></div><div style="display: flex; align-items: center; gap: 10px;"><span class="${s.isActive ? 'badge-active-team' : 'badge-inactive'}">${s.isActive ? '🟢 Activa' : '⚪ Inactiva'}</span>${!isReadOnly ? `<button type="button" class="btn-save-season-name btn-secondary-sm" data-id="${s.id}">💾 Guardar Nombre</button>${!s.isActive ? `<button type="button" class="btn-activate-season btn-outline-sm" data-id="${s.id}">Activar</button>` : ''}<button type="button" class="btn-delete-season btn-danger-sm" data-id="${s.id}">🗑️</button>` : ''}</div></div>`).join("")}
              </div>
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

    // --- EVENTOS ---

    container.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        this.activeTab = e.currentTarget.getAttribute("data-tab");
        this.clubSubView = "list";
        await this.render(containerId);
      });
    });

    // 1. SOLICITAR TRASPASO
    container.querySelectorAll(".btn-request-transfer").forEach(btn => {
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

        alert(`📩 Solicitud de traspaso registrada para ${pName}. Aparece arriba en la sección de aprobaciones.`);
        this.render(containerId);
      });
    });

    // 2. APROBAR TRASPASO (CAMBIO REAL EN SUPABASE)
    container.querySelectorAll(".btn-approve-transfer").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const trId = e.currentTarget.getAttribute("data-id");
        const playerId = e.currentTarget.getAttribute("data-player-id");
        const targetTeamId = e.currentTarget.getAttribute("data-target-team");

        this.showSyncOverlay("🟢 Ejecutando traspaso en la base de datos...");

        try {
          const { error } = await supabase
            .from("players")
            .update({ team_id: targetTeamId, status: "Activo" })
            .eq("id", playerId);

          if (error) {
            this.hideSyncOverlay();
            alert(`❌ Error al traspasar: ${error.message}`);
            return;
          }

          const transferObj = this.transfers.find(t => t.id === trId);
          if (transferObj) transferObj.status = "APROBADO";
          this._saveTransfersLocal();

          // Forzar recarga del mercado
          await this._fetchAllMarketPlayers(true);
          await DataStore.init(activeTeamId, true);

          this.hideSyncOverlay();
          alert("✅ Traspaso completado. El jugador ya está asignado al nuevo equipo.");
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error al aprobar traspaso:", err);
        }
      });
    });

    // RECHAZAR TRASPASO
    container.querySelectorAll(".btn-reject-transfer").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const trId = e.currentTarget.getAttribute("data-id");
        const transferObj = this.transfers.find(t => t.id === trId);
        if (transferObj) transferObj.status = "RECHAZADO";
        this._saveTransfersLocal();
        alert("🔴 Solicitud de traspaso rechazada.");
        this.render(containerId);
      });
    });

    // CREACIÓN DE JUGADOR NUEVO
    const formAddPlayer = container.querySelector("#form-add-player");
    if (formAddPlayer) {
      formAddPlayer.addEventListener("submit", async (e) => {
        e.preventDefault();

        const firstNameInput = container.querySelector("#add-p-name");
        const lastNameInput = container.querySelector("#add-p-lastname");
        const numberInput = container.querySelector("#add-p-number");
        const positionSelect = container.querySelector("#add-p-position");

        const first_name = firstNameInput?.value.trim();
        const last_name = lastNameInput?.value.trim();
        const jersey = parseInt(numberInput?.value, 10);
        const primary_position = positionSelect?.value;

        if (!first_name || !last_name || isNaN(jersey) || !primary_position) {
          alert("⚠️ Todos los campos con asterisco (*) son obligatorios.");
          return;
        }

        const playerPayload = {
          team_id: activeTeamId,
          first_name,
          last_name,
          jersey,
          primary_position,
          secondary_positions: [],
          status: "Activo"
        };

        try {
          this.showSyncOverlay("⚡ Registrando jugador en la base de datos...");

          const { data, error } = await supabase
            .from("players")
            .insert([playerPayload])
            .select()
            .single();

          if (error) {
            this.hideSyncOverlay();
            console.error("Error al insertar jugador en Supabase:", error);
            alert(`❌ No se pudo crear el jugador: ${error.message}`);
            return;
          }

          if (data) {
            await this._fetchAllMarketPlayers(true);
            await DataStore.init(activeTeamId, true);

            this.hideSyncOverlay();
            alert(`✅ Jugador #${data.jersey} ${data.first_name} ${data.last_name} creado con éxito.`);
            await this.render(containerId);
          }
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Excepción creando jugador:", err);
          alert("❌ Ocurrió un error inesperado al guardar el jugador.");
        }
      });
    }

    // MODAL DE EDICIÓN
    container.querySelectorAll(".btn-edit-player-modal").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const pId = e.currentTarget.getAttribute("data-id");
        const player = (this.allMarketPlayers || []).find(p => String(p.id) === String(pId)) || 
                       (DataStore.players || []).find(p => String(p.id) === String(pId));

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

    const closeModal = () => {
      const modal = container.querySelector("#modal-edit-player");
      if (modal) modal.style.display = "none";
    };

    container.querySelector("#btn-close-edit-player-modal")?.addEventListener("click", closeModal);
    container.querySelector("#btn-cancel-edit-player")?.addEventListener("click", closeModal);

    const formEditPlayer = container.querySelector("#form-edit-player-modal");
    if (formEditPlayer) {
      formEditPlayer.addEventListener("submit", async (e) => {
        e.preventDefault();

        const pId = container.querySelector("#edit-p-id")?.value;
        const first_name = container.querySelector("#edit-p-name")?.value.trim();
        const last_name = container.querySelector("#edit-p-lastname")?.value.trim();
        const jersey = parseInt(container.querySelector("#edit-p-number")?.value, 10);
        const primary_position = container.querySelector("#edit-p-position")?.value;
        const status = container.querySelector("#edit-p-status")?.value;

        const updates = { first_name, last_name, jersey, primary_position, status };

        try {
          this.showSyncOverlay("💾 Guardando cambios...");

          const { error } = await supabase
            .from("players")
            .update(updates)
            .eq("id", pId);

          if (error) {
            this.hideSyncOverlay();
            alert(`❌ Error al guardar cambios: ${error.message}`);
            return;
          }

          await this._fetchAllMarketPlayers(true);
          await DataStore.init(DataStore.getActiveTeamId(), true);

          this.hideSyncOverlay();
          closeModal();
          alert(`✅ Jugador actualizado correctamente.`);
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error editando jugador:", err);
        }
      });
    }

    // Activar Equipo
    container.querySelectorAll(".btn-set-active-team").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const newTeamId = e.currentTarget.getAttribute("data-id");
        
        this.showSyncOverlay("⚡ Cambiando de equipo...");
        DataStore.setActiveTeamAndSeason(newTeamId, null);
        await DataStore.init(newTeamId, true);
        
        const sidebarSelect = document.getElementById("sidebar-select-team");
        if (sidebarSelect) sidebarSelect.value = newTeamId;

        this.hideSyncOverlay();
        alert("🟢 Equipo activo cambiado con éxito.");
        await this.render(containerId);
      });
    });

    // Buscador Fichajes
    const searchInput = container.querySelector("#input-market-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.marketSearchQuery = e.target.value;
        this.marketCurrentPage = 1;
        this.render(containerId);
      });
    }

    // Paginación Fichajes
    container.querySelector("#btn-prev-market-page")?.addEventListener("click", () => {
      if (this.marketCurrentPage > 1) {
        this.marketCurrentPage--;
        this.render(containerId);
      }
    });

    container.querySelector("#btn-next-market-page")?.addEventListener("click", () => {
      if (this.marketCurrentPage < totalPages) {
        this.marketCurrentPage++;
        this.render(containerId);
      }
    });

    // Guardar Rol
    container.querySelectorAll(".btn-save-user-role").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const selectEl = container.querySelector(`.select-user-role[data-id="${userId}"]`);
        if (!selectEl) return;

        const newRole = selectEl.value;
        const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
        if (!error) {
          alert("✅ Rol actualizado.");
          await this._fetchProfiles();
          this.render(containerId);
        }
      });
    });

    container.querySelector("#select-demo-role")?.addEventListener("change", (e) => {
      this.currentUserRole = e.target.value;
      localStorage.setItem("iq_user_role", this.currentUserRole);
      this.render(containerId);
    });
  }
}