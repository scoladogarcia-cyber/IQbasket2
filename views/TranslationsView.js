/**
 * @fileoverview Vista de Configuración Integral de IQ Basket (TranslationsView.js).
 * @description Centro neurálgico de administración del club, gestión de roles RBAC,
 * transferencias de mercado, aprobación de adhesiones a equipos, temporadas y traducción multilingüe.
 * 
 * Contiene todas las funcionalidades completas:
 * 1. Control estricto de permisos por matriz de roles (SUPERADMIN, ADMIN, ENTRENADOR, ANALISTA, SCOUT, JUGADOR, INVITADO).
 * 2. Gestión de Clubs y Equipos (creación, edición, activación en vivo).
 * 3. Gestión de Plantilla activa y Mercado Global de Fichajes con modal y buscador.
 * 4. Aprobación y rechazo de solicitudes de traspaso y adhesión multiequipo con badges reactivos.
 * 5. Administración de Usuarios y asignación de equipos autorizados (`user_profiles` + Supabase Auth).
 * 6. Gestión de Temporadas registradas en Supabase.
 * 7. Subvista integrada de Idiomas (`LanguageSettingsView`) y Simulación de Roles para SUPERADMIN.
 */

import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { supabase } from "../config/database.config.js";
import { LanguageSettingsView } from "./LanguageSettingsView.js";
import { I18n } from "../services/I18nService.js";
import { Permission, UserRole, UNIQUE_SUPERADMIN_EMAIL } from "../security/PermissionService.js";
import { TeamAccessRequestService } from "../services/TeamAccessRequestService.js";
import { StaffAssignmentService, StaffRole } from "../services/StaffAssignmentService.js";
import { SeasonManagementService } from "../services/seasons/SeasonManagementService.js";
import { SeasonManagementView } from "./SeasonManagementView.js";
import { RosterManagementService } from "../services/roster/RosterManagementService.js";
import { TransferRequestService } from "../services/transfers/TransferRequestService.js";

function normalizeIsoDate(value = "") {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    ? raw
    : null;
}

function todayLocalIsoDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function shiftIsoDate(value, days) {
  const iso = normalizeIsoDate(value);
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + Number(days || 0));
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function seasonDateBounds(context = null) {
  return {
    start: normalizeIsoDate(context?.start_date || context?.startDate || ""),
    end: normalizeIsoDate(context?.end_date || context?.endDate || "")
  };
}

function isDateInsideSeason(value, context = null) {
  const iso = normalizeIsoDate(value);
  if (!iso) return false;
  const { start, end } = seasonDateBounds(context);
  return (!start || iso >= start) && (!end || iso <= end);
}

function maxIsoDate(...values) {
  const dates = values.map(normalizeIsoDate).filter(Boolean).sort();
  return dates.length ? dates.at(-1) : null;
}

function formatRosterIntervals(player = {}) {
  const stints = Array.isArray(player.rosterStints) ? player.rosterStints : [];
  if (stints.length > 0) {
    return [...stints]
      .sort((a, b) => String(a.valid_from || "").localeCompare(String(b.valid_from || "")))
      .map(stint => {
        const from = normalizeIsoDate(stint.valid_from) || "?";
        const until = normalizeIsoDate(stint.valid_until) || "abierto";
        return `${from} → ${until}`;
      })
      .join(" · ");
  }

  const from = normalizeIsoDate(player.rosterFirstFrom);
  const until = normalizeIsoDate(player.rosterLastUntil);
  return from ? `${from} → ${until || "abierto"}` : "Sin intervalo histórico";
}

export class TranslationsView {
  /**
   * Crea una instancia de TranslationsView.
   * @param {Object} [authController=null] - Controlador de autenticación y roles.
   */
  constructor(authController = null) {
    this.auth = authController;
    this.currentUserRole = this.auth?.getAuthenticatedRole?.() || UserRole.INVITADO;
    this.simulatedRole = this.auth?.previewRole || null;

    const effectiveRole = this.getEffectiveRole();
    this.activeTab = [UserRole.JUGADOR, UserRole.FAMILIA_TUTOR, UserRole.VISOR, UserRole.INVITADO].includes(effectiveRole)
      ? "requests"
      : ([UserRole.ENTRENADOR, UserRole.ANALISTA, UserRole.PREPARADOR_FISICO].includes(effectiveRole) ? "players" : "club");
      
    this.clubSubView = "list"; // 'list' | 'edit-club' | 'edit-team'
    this.selectedTeamForEdit = null;
    this.selectedClubForEdit = null;
    this.selectedUserForProfileCard = null;

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
      { code: "ca", label: "Català (CAT)" },
      { code: "en", label: "English (EN)" },
      { code: "fr", label: "Français (FR)" }
    ];
    this.dbTranslations = [];

    // Temporadas
    this.seasonsList = [];

    // Solicitudes de adhesión multiusuario (Supabase es la fuente de verdad).
    this.joinRequests = [];
    this.teamDirectory = [];
    this.accessRequestService = new TeamAccessRequestService(supabase);
    this.staffAssignmentService = new StaffAssignmentService(supabase, DataStore);
    this.seasonManagementService = new SeasonManagementService(supabase, DataStore);
    this.seasonManagementView = new SeasonManagementView(this.seasonManagementService, this.auth);
    this.rosterManagementService = new RosterManagementService(supabase, DataStore);
    this.rosterState = null;
    this.transferRequestService = new TransferRequestService(supabase);
    this.transferRequestCapabilities = { ready: false };
    this.transfers = [];

    // Mapa de Asignaciones Multiequipo (Usuario Email -> [IDs de Equipos])
    const storedAssignments = localStorage.getItem("iq_user_teams_map");
    this.userTeamAssignments = storedAssignments ? JSON.parse(storedAssignments) : {};

    // Perfiles
    this.profilesList = [];
  }

  t(key, fallback = "") {
    const res = TranslationStore ? TranslationStore.t(key, "") : I18n.t(key);
    return (!res || res === key) ? fallback : res;
  }

  getEffectiveRole() {
    this.currentUserRole = this.auth?.getAuthenticatedRole?.() || this.currentUserRole || UserRole.INVITADO;
    this.simulatedRole = this.auth?.previewRole || null;
    return this.auth?.getEffectiveRole?.() || this.simulatedRole || this.currentUserRole;
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
        z-index: 9999; color: white; font-family: var(--font-family-base, system-ui);
      `;
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div style="width: 48px; height: 48px; border: 4px solid var(--color-primary, #f97316); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
      <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 800;">${message}</h3>
      <p style="margin: 0; color: #94a3b8; font-size: 13px;">Guardando cambios en la Base de Datos...</p>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    overlay.style.display = "flex";
  }

  hideSyncOverlay() {
    const overlay = document.getElementById("sync-loading-overlay");
    if (overlay) overlay.style.display = "none";
  }

  _permissionForAction(action) {
    const map = {
      VIEW_TAB_CLUB: Permission.VIEW_CLUBS,
      MANAGE_CLUB_DATA: Permission.MANAGE_CLUBS,
      CREATE_TEAM: Permission.MANAGE_TEAMS,
      VIEW_TAB_USERS: Permission.VIEW_USERS,
      INVITE_USERS: Permission.INVITE_USERS,
      MANAGE_ROLES: Permission.ASSIGN_STANDARD_ROLES,
      ASSIGN_TEAMS_TO_USER: Permission.APPROVE_TEAM_ACCESS,
      APPROVE_JOIN_REQUESTS: Permission.APPROVE_TEAM_ACCESS,
      VIEW_TAB_PLAYERS: Permission.VIEW_ROSTER,
      MANAGE_PLAYERS: Permission.MANAGE_ROSTER,
      REQUEST_TRANSFERS: Permission.REQUEST_TRANSFER,
      APPROVE_TRANSFERS: Permission.APPROVE_TRANSFER,
      VIEW_TAB_SEASONS: Permission.VIEW_SEASONS,
      CREATE_SEASON: Permission.MANAGE_SEASONS,
      VIEW_TAB_REQUESTS: Permission.REQUEST_TEAM_ACCESS,
      REQUEST_JOIN_CLUB: Permission.REQUEST_TEAM_ACCESS,
      EDIT_DATA: Permission.MANAGE_ROSTER
    };
    return map[action] || null;
  }

  _can(action) {
    const effectiveRole = this.getEffectiveRole();

    if (["VIEW_TAB_TRANSLATIONS", "CREATE_CLUB", "DELETE_SEASON", "DELETE_CLUB", "DELETE_TEAM", "VIEW_TAB_SIMULATION", "MODIFY_ACTIVE_ROLE"].includes(action)) {
      return effectiveRole === UserRole.SUPERADMIN;
    }

    if (action === "ASSIGN_ADMIN_ROLE") {
      return Boolean(this.auth?.canPreview?.(Permission.ASSIGN_PRIVILEGED_ROLES));
    }

    if (action === "EDIT_DATA") {
      return Boolean(
        this.auth?.canPreview?.(Permission.MANAGE_CLUBS) ||
        this.auth?.canPreview?.(Permission.MANAGE_ROSTER) ||
        this.auth?.canPreview?.(Permission.MANAGE_SEASONS) ||
        this.auth?.canPreview?.(Permission.EDIT_GAME)
      );
    }

    const permission = this._permissionForAction(action);
    return permission ? Boolean(this.auth?.canPreview?.(permission)) : false;
  }

  _canReal(action, context = {}) {
    if (["VIEW_TAB_TRANSLATIONS", "CREATE_CLUB", "DELETE_SEASON", "DELETE_CLUB", "DELETE_TEAM", "VIEW_TAB_SIMULATION", "MODIFY_ACTIVE_ROLE"].includes(action)) {
      return this.auth?.getAuthenticatedRole?.() === UserRole.SUPERADMIN;
    }
    if (action === "ASSIGN_ADMIN_ROLE") {
      return Boolean(this.auth?.can?.(Permission.ASSIGN_PRIVILEGED_ROLES, context));
    }
    const permission = this._permissionForAction(action);
    return permission ? Boolean(this.auth?.can?.(permission, context)) : false;
  }

  async _fetchProfiles() {
    try {
      if (!supabase || !this.auth?.can?.(Permission.VIEW_USERS)) {
        this.profilesList = [];
        return;
      }

      let query = supabase
        .from("user_profiles")
        .select("id,email,first_name,last_name,phone,role,status,assigned_team_ids,linked_player_id,created_at")
        .order("created_at", { ascending: false });
      const currentUser = this.auth.getCurrentUser?.();

      if (this.auth.getAuthenticatedRole?.() === UserRole.ADMIN) {
        const adminTeamIds = (currentUser?.allowedTeamIds || []).map(String).filter(Boolean);
        if (adminTeamIds.length === 0) {
          this.profilesList = [];
          return;
        }
        query = query.overlaps("assigned_team_ids", adminTeamIds);
      }

      const { data, error } = await query;
      if (!error && data) {
        this.profilesList = this.auth.getAuthenticatedRole?.() === UserRole.SUPERADMIN
          ? data
          : data.filter(p => String(p.email || "").toLowerCase() !== UNIQUE_SUPERADMIN_EMAIL);

        this.profilesList.forEach(profile => {
          const ids = Array.isArray(profile.assigned_team_ids)
            ? profile.assigned_team_ids.map(String)
            : [];
          this.userTeamAssignments[profile.email] = ids;
        });
        this._saveAssignmentsLocal();
      }
    } catch (e) {
      console.warn("Error leyendo perfiles:", e);
    }
  }

  async _fetchSeasons() {
    try {
      const activeTeamId = DataStore.getActiveTeamId();
      if (!supabase) return;
      let query = supabase.from("seasons").select("*").order("created_at", { ascending: false });
      if (activeTeamId) query = query.eq("team_id", activeTeamId);
      const { data, error } = await query;
      
      if (!error && data && data.length > 0) {
        this.seasonsList = data;
      } else {
        const dataStoreSeasons = DataStore.getSeasons?.(activeTeamId) || [];
        const storedSeasons = localStorage.getItem("iq_seasons");
        this.seasonsList = dataStoreSeasons.length > 0
          ? dataStoreSeasons
          : (storedSeasons ? JSON.parse(storedSeasons) : []);
      }
      this._saveSeasonsLocal();
    } catch (e) {
      console.warn("Error leyendo temporadas de Supabase:", e);
    }
  }

  async _refreshCurrentAuthorizationProfile() {
    try {
      const current = this.auth?.getCurrentUser?.();
      if (!supabase || !current?.email) return false;

      const { data, error } = await supabase
        .from("user_profiles")
        .select("id,email,first_name,last_name,phone,role,status,assigned_team_ids,linked_player_id,created_at")
        .eq("email", current.email)
        .maybeSingle();

      if (error || !data) return false;

      const beforeIds = (current.allowedTeamIds || []).map(String).sort().join(",");
      const refreshed = this.auth.setCurrentUser?.({
        ...current,
        ...data,
        email: current.email
      });
      const afterIds = (refreshed?.allowedTeamIds || []).map(String).sort().join(",");

      if (beforeIds !== afterIds) {
        DataStore.setPermissionService?.(this.auth);
        DataStore.isLoaded = false;
        await DataStore.init(null, true);
      }
      return true;
    } catch (e) {
      console.warn("No se pudo refrescar el alcance del usuario:", e);
      return false;
    }
  }

  async _fetchTeamDirectory() {
    try {
      this.teamDirectory = await this.accessRequestService.listTeamDirectory();
    } catch (e) {
      console.warn("Error cargando directorio de equipos:", e);
      this.teamDirectory = [];
    }
  }

  async _fetchJoinRequests() {
    try {
      this.joinRequests = await this.accessRequestService.listRequests();
      this._saveRequestsLocal();
    } catch (e) {
      console.warn("Error cargando solicitudes de acceso:", e);
      this.joinRequests = [];
    }
  }

  async _requestTeamAccess(teamId) {
    await this.accessRequestService.requestAccess(teamId);
    await this._fetchJoinRequests();
  }

  async _reviewTeamAccess(requestId, approve) {
    await this.accessRequestService.reviewRequest(requestId, approve);
    await Promise.all([
      this._fetchJoinRequests(),
      this._fetchProfiles()
    ]);
  }

  async _saveStaffAssignment({ clubId = null, teamId = null, seasonName, role, staffName }) {
    const assignment = await this.staffAssignmentService.upsertAssignment({
      clubId,
      teamId,
      seasonName,
      role,
      staffName
    });
    DataStore.setStaffAssignmentLocal?.(assignment);
    return assignment;
  }

  _saveSeasonsLocal() {
    localStorage.setItem("iq_seasons", JSON.stringify(this.seasonsList));
  }

  _saveRequestsLocal() {
    localStorage.setItem("iq_team_join_requests", JSON.stringify(this.joinRequests));
  }

  _saveAssignmentsLocal() {
    localStorage.setItem("iq_user_teams_map", JSON.stringify(this.userTeamAssignments));
  }

  async _persistUserTeamAssignments(email, teamIds = []) {
    if (!this.auth?.can?.(Permission.APPROVE_TEAM_ACCESS)) {
      throw new Error("No tienes permiso para asignar equipos a usuarios.");
    }

    const normalizedIds = [...new Set((teamIds || []).map(String))];
    for (const teamId of normalizedIds) {
      if (!this.auth.can(Permission.APPROVE_TEAM_ACCESS, { teamId })) {
        throw new Error("No puedes asignar uno o más equipos fuera de tu alcance.");
      }
    }

    const targetProfile = this.profilesList.find(p => String(p.email || "").toLowerCase() === String(email || "").toLowerCase());
    if (targetProfile?.club_id && !this.auth.can(Permission.APPROVE_TEAM_ACCESS, { clubId: targetProfile.club_id })) {
      throw new Error("No puedes gestionar usuarios de otro club.");
    }

    let finalIds = normalizedIds;
    if (this.auth?.getAuthenticatedRole?.() === UserRole.ADMIN) {
      const ownClubTeamIds = new Set((DataStore.getTeams() || []).map(t => String(t.id)));
      const existingIds = Array.isArray(targetProfile?.assigned_team_ids)
        ? targetProfile.assigned_team_ids.map(String)
        : [];
      const externalIds = existingIds.filter(id => !ownClubTeamIds.has(id));
      finalIds = [...new Set([...externalIds, ...normalizedIds])];
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({ assigned_team_ids: finalIds })
      .eq("email", email);

    if (error) throw error;

    this.userTeamAssignments[email] = finalIds;
    this._saveAssignmentsLocal();
  }

  async _refreshTransferRequests(targetTeamSeasonId = null) {
    try {
      this.transferRequestCapabilities = await this.transferRequestService.getCapabilities({ force: true });
      if (!this.transferRequestCapabilities?.ready || !targetTeamSeasonId) {
        this.transfers = [];
        return this.transfers;
      }

      this.transfers = await this.transferRequestService.listPending({
        targetTeamSeasonId
      });
      return this.transfers;
    } catch (error) {
      console.warn("No se pudieron cargar las solicitudes persistentes de traspaso:", error);
      this.transferRequestCapabilities = { ready: false };
      this.transfers = [];
      return [];
    }
  }

  async _fetchTranslationsForLang(langCode) {
    try {
      if (!supabase) return;
      const normLang = langCode === "cat" ? "ca" : langCode;

      let query = supabase
        .from("translations")
        .select("key,language_code,translation,created_at,updated_at");

      query = normLang === "ca"
        ? query.in("language_code", ["ca", "cat"])
        : query.eq("language_code", normLang);

      const { data, error } = await query;
      if (!error && data) {
        this.dbTranslations = data;
      }
    } catch (e) {
      console.warn("Error cargando traducciones de Supabase:", e);
    }
  }

  async _fetchAllMarketPlayers(force = false) {
    if (this.isMarketLoaded && !force && this.allMarketPlayers.length > 0) {
      return this.allMarketPlayers;
    }

    const targetTeamSeasonId = this.rosterState?.teamSeasonId || null;
    if (!targetTeamSeasonId) {
      throw new Error("No se pudo resolver la temporada activa del equipo de destino.");
    }

    const rows = await this.transferRequestService.listMarket({
      targetTeamSeasonId
    });

    this.allMarketPlayers = rows || [];
    this.isMarketLoaded = true;
    return this.allMarketPlayers;
  }

  _renderMarketTable(container) {
    const tableContainer = container.querySelector("#market-modal-table-container");
    if (!tableContainer) return;

    const sourcePlayersList = this.allMarketPlayers.length > 0 ? this.allMarketPlayers : (DataStore.getPlayers() || []);
    const activeTeamId = DataStore.getActiveTeamId();

    const filteredPlayers = sourcePlayersList.filter(p => {
      const fullName = `${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.toLowerCase();
      const teamName = (p.team_name || p.teamName || '').toLowerCase();
      const query = this.marketSearchQuery.toLowerCase();
      return fullName.includes(query) || teamName.includes(query);
    });

    const totalPages = Math.ceil(filteredPlayers.length / this.marketItemsPerPage) || 1;
    if (this.marketCurrentPage > totalPages) this.marketCurrentPage = totalPages;

    const startIndex = (this.marketCurrentPage - 1) * this.marketItemsPerPage;
    const paginatedPlayers = filteredPlayers.slice(startIndex, startIndex + this.marketItemsPerPage);

    tableContainer.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Posición</th>
              <th>Equipo Actual</th>
              <th style="text-align: right;">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${paginatedPlayers.length > 0 ? paginatedPlayers.map(p => {
              const isMyTeam = String(p.team_id).toLowerCase() === String(activeTeamId).toLowerCase();
              const existingTransfer = Boolean(p.pending_to_target)
                || this.transfers.some(t => String(t.playerId) === String(p.id) && t.status === "PENDING");

              return `
                <tr>
                  <td><strong>#${p.jersey ?? p.number ?? '-'} ${p.first_name || ''} ${p.last_name || ''}</strong></td>
                  <td><span class="badge-category">${p.primary_position || p.position || 'Alero'}</span></td>
                  <td>${p.team_name || 'Otro Equipo'}</td>
                  <td style="text-align: right;">
                    ${isMyTeam ? `
                      <span class="badge-active-team">En tu plantilla</span>
                    ` : (existingTransfer ? `
                      <span class="badge-pending">⏳ Solicitado</span>
                    ` : `
                      <button type="button" class="btn-request-transfer btn-secondary-sm" data-id="${p.id}" data-name="${p.first_name || ''} ${p.last_name || ''}" data-team-season-origin="${p.from_team_season_id || ''}">
                        ⚡ Fichar
                      </button>
                    `)}
                  </td>
                </tr>
              `;
            }).join("") : `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">No se encontraron jugadores que coincidan con la búsqueda.</td></tr>`}
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
        <span style="font-size: 12px; color: #64748b;">Página ${this.marketCurrentPage} de ${totalPages} (${filteredPlayers.length} jugadores)</span>
        <div style="display: flex; gap: 6px;">
          <button type="button" id="btn-market-prev" class="btn-outline-sm" ${this.marketCurrentPage <= 1 ? 'disabled' : ''}>← Anterior</button>
          <button type="button" id="btn-market-next" class="btn-outline-sm" ${this.marketCurrentPage >= totalPages ? 'disabled' : ''}>Siguiente →</button>
        </div>
      </div>
    `;

    tableContainer.querySelectorAll(".btn-request-transfer").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        if (!this.auth?.can?.(Permission.REQUEST_TRANSFER, { teamId: activeTeamId })) {
          alert("⚠️ No tienes permiso para solicitar traspasos.");
          return;
        }
        if (!this.transferRequestCapabilities?.ready) {
          alert("⚠️ Las solicitudes persistentes de traspaso todavía no están disponibles.");
          return;
        }

        const playerId = e.currentTarget.getAttribute("data-id");
        const playerName = e.currentTarget.getAttribute("data-name");
        const fromTeamSeasonId = e.currentTarget.getAttribute("data-team-season-origin");
        const targetTeamSeasonId = this.rosterState?.teamSeasonId || null;

        if (!playerId || !fromTeamSeasonId || !targetTeamSeasonId) {
          alert("⚠️ No se pudo resolver el jugador o el ámbito temporal del traspaso.");
          return;
        }

        this.showSyncOverlay("📩 Registrando solicitud de traspaso...");
        try {
          await this.transferRequestService.requestTransfer({
            playerId,
            fromTeamSeasonId,
            toTeamSeasonId: targetTeamSeasonId
          });

          await this._refreshTransferRequests(targetTeamSeasonId);
          this.hideSyncOverlay();
          alert(`✅ Solicitud de fichaje registrada para ${playerName}.`);
          this._renderMarketTable(container);
        } catch (error) {
          this.hideSyncOverlay();
          console.error("Error registrando solicitud de traspaso:", error);
          alert(`❌ No se pudo registrar el traspaso: ${error.message || error}`);
        }
      });
    });

    tableContainer.querySelector("#btn-market-prev")?.addEventListener("click", () => {
      if (this.marketCurrentPage > 1) {
        this.marketCurrentPage--;
        this._renderMarketTable(container);
      }
    });

    tableContainer.querySelector("#btn-market-next")?.addEventListener("click", () => {
      if (this.marketCurrentPage < totalPages) {
        this.marketCurrentPage++;
        this._renderMarketTable(container);
      }
    });
  }

  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId) || document.getElementById("main-content") || document.querySelector(".app-main-content") || document.body;
    if (!container) return;

    const activeTeamId = DataStore.getActiveTeamId();

    if (this.seasonsList.length === 0) await this._fetchSeasons();

    if (this.activeTab === "players") {
      try {
        this.rosterState = await this.rosterManagementService.loadForTeam(activeTeamId);
      } catch (error) {
        console.warn("No se pudo cargar la plantilla v3 por temporada:", error);
        this.rosterState = null;
      }

      if (this._can("REQUEST_TRANSFERS") || this._can("APPROVE_TRANSFERS")) {
        await this._refreshTransferRequests(this.rosterState?.teamSeasonId || null);
      } else {
        this.transfers = [];
      }
    }

    if (this._can("APPROVE_JOIN_REQUESTS") || this.activeTab === "requests") {
      await this._fetchJoinRequests();
    }

    if (this.activeTab === "users") {
      await this._fetchProfiles();
    }

    if (this.activeTab === "requests") {
      await this._refreshCurrentAuthorizationProfile();
      await this._fetchTeamDirectory();
    }
    if (this.activeTab === "translations") await this._fetchTranslationsForLang(this.selectedLangForEdit);
    if (this.activeTab === "seasons") {
      try {
        await this.seasonManagementView.load();
      } catch (error) {
        console.warn("No se pudo cargar la gestión v3 de temporadas:", error);
      }
    }

    const effectiveRole = this.getEffectiveRole();
    const isReadOnly = !this._can("EDIT_DATA");
    const currentUserEmail = this.auth?.getCurrentUser?.()?.email || "";
    
    const currentActiveSeasonContext = DataStore.getActiveSeasonContext?.(activeTeamId) || null;
    const currentActiveSeasonName = DataStore.getActiveSeasonDisplayName?.(activeTeamId)
      || DataStore.getActiveSeason()
      || "Sin temporada";

    const teamPlayers = DataStore.getPlayers() || [];
    const players = this.activeTab === "players" && this.rosterState
      ? this.rosterState.activePlayers
      : teamPlayers;
    const availableRosterPlayers = this.activeTab === "players"
      ? (this.rosterState?.availablePlayers || [])
      : [];
    const historicalRosterPlayers = this.activeTab === "players"
      ? (this.rosterState?.historicalPlayers || [])
      : [];
    const rosterContextName = this.rosterState?.context?.name
      ? String(this.rosterState.context.name).replace(/^(\d{4})\s*[-\/]\s*(\d{4})$/, "$1/$2")
      : currentActiveSeasonName;
    const rosterBackendReady = Boolean(this.rosterState?.capabilities?.ready);
    const rosterRemovalReady = Boolean(
      rosterBackendReady && this.rosterState?.capabilities?.supports_seed_exclusion
    );
    const transferRequestReady = Boolean(this.transferRequestCapabilities?.ready);
    const transferMarketReady = Boolean(
      transferRequestReady && this.transferRequestCapabilities?.market_directory
    );
    const rosterTeamSeasonId = this.rosterState?.teamSeasonId || null;
    const rosterReferenceDate = this.rosterState?.referenceDate
      || normalizeIsoDate(currentActiveSeasonContext?.start_date)
      || normalizeIsoDate(currentActiveSeasonContext?.end_date)
      || todayLocalIsoDate();
    const rosterSeasonContext = this.rosterState?.context || currentActiveSeasonContext;
    const rosterSeasonBounds = seasonDateBounds(rosterSeasonContext);

    const realClubs = DataStore.getClubs() || [];
    const realTeams = DataStore.getTeams() || [];
    const directoryTeams = this.teamDirectory.length > 0 ? this.teamDirectory : realTeams;
    const myAssignedTeamIds = this.auth?.getCurrentUser?.()?.allowedTeamIds || [];

    const pendingTransfersList = this.transfers.filter(t => t.status === "PENDING");
    const pendingJoinRequestsList = this.joinRequests.filter(r => r.status === "PENDIENTE");
    const requestSeasonContexts = DataStore.getSeasons?.(activeTeamId) || [];

    if ([UserRole.JUGADOR, UserRole.FAMILIA_TUTOR, UserRole.VISOR, UserRole.INVITADO].includes(effectiveRole) && !["requests", "players", "seasons"].includes(this.activeTab)) {
      this.activeTab = "requests";
    }

    const allowedSelectableTeams = realTeams;

    const visibleProfiles = this.profilesList;

    const canModifyActiveRole = this._can("MODIFY_ACTIVE_ROLE");

    container.innerHTML = `
      <div class="config-container">
        
        <!-- HEADER CONFIGURACIÓN -->
        <div class="config-header">
          <div>
            <h1>${this.t("settings", "Configuración")} ⚙️</h1>
            <p>${this.t("settings_subtitle", "Gestión de perfil, fichas de usuario, permisos, asignación de equipos e idiomas.")}</p>
          </div>

          <div style="display: flex; gap: 10px; align-items: center;">
            ${this.simulatedRole ? `
              <div style="background: #fef3c7; border: 1px solid #f59e0b; color: #b45309; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
                <span>🎭 ${this.t("simulating_role", "Simulando:")} ${this.simulatedRole}</span>
                <button type="button" id="btn-stop-simulation" style="background: #dc2626; color: white; border: none; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer;">✕ ${this.t("exit", "Salir")}</button>
              </div>
            ` : ''}

            <!-- BOTÓN ROL ACTIVO: HABILITADO SOLO PARA SUPERADMIN -->
            <div class="role-selector-chip">
              <span style="font-size: 11px; font-weight: 800; color: #475569;">${this.t("active_role", "Rol Activo:")}</span>
              <select id="select-demo-role" ${!canModifyActiveRole ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}>
                <option value="SUPERADMIN" ${effectiveRole === 'SUPERADMIN' ? 'selected' : ''}>👑 Superadmin</option>
                <option value="ADMIN" ${effectiveRole === 'ADMIN' ? 'selected' : ''}>🔑 Admin Club</option>
                <option value="ENTRENADOR" ${effectiveRole === 'ENTRENADOR' ? 'selected' : ''}>📋 Entrenador</option>
                <option value="ANALISTA" ${effectiveRole === 'ANALISTA' ? 'selected' : ''}>📈 Analista</option>
                <option value="PREPARADOR_FISICO" ${effectiveRole === 'PREPARADOR_FISICO' ? 'selected' : ''}>💪 Preparador físico</option>
                <option value="JUGADOR" ${effectiveRole === 'JUGADOR' ? 'selected' : ''}>👤 Jugador</option>
                <option value="FAMILIA_TUTOR" ${effectiveRole === 'FAMILIA_TUTOR' ? 'selected' : ''}>👪 Familia / Tutor</option>
                <option value="VISOR" ${effectiveRole === 'VISOR' ? 'selected' : ''}>👁️ Visor</option>
                <option value="INVITADO" ${effectiveRole === 'INVITADO' ? 'selected' : ''}>🧪 Invitado (Demo)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- PESTAÑAS PRINCIPALES FILTRADAS SEGÚN ROL -->
        <div class="config-tabs">
          ${this._can("VIEW_TAB_CLUB") ? `
            <button class="tab-btn ${this.activeTab === 'club' ? 'active' : ''}" data-tab="club">
              🏢 ${this.t("tab_clubs_teams", "Clubs & Equipos")}
            </button>
          ` : ''}
          
          ${this._can("VIEW_TAB_PLAYERS") ? `
            <button class="tab-btn ${this.activeTab === 'players' ? 'active' : ''}" data-tab="players">
              👥 ${this.t("tab_roster", "Plantilla")} (${players.length})
            </button>
          ` : ''}

          ${this._can("VIEW_TAB_USERS") ? `
            <button class="tab-btn ${this.activeTab === 'users' ? 'active' : ''}" data-tab="users">
              👤 ${this.t("tab_users_roles", "Usuarios & Fichas")} (${visibleProfiles.length})
              ${pendingJoinRequestsList.length > 0 ? `<span style="background: #ef4444; color: white; border-radius: 50%; padding: 2px 6px; font-size: 10px; margin-left: 4px; font-weight: 800;">${pendingJoinRequestsList.length}</span>` : ''}
            </button>
          ` : ''}

          ${this._can("VIEW_TAB_SEASONS") ? `
            <button class="tab-btn ${this.activeTab === 'seasons' ? 'active' : ''}" data-tab="seasons">
              📅 ${this.t("tab_seasons", "Temporadas")} (${this.seasonManagementView.state?.seasons?.length ?? this.seasonsList.length})
            </button>
          ` : ''}

          ${this._can("VIEW_TAB_REQUESTS") ? `
            <button class="tab-btn ${this.activeTab === 'requests' ? 'active' : ''}" data-tab="requests">
              🛡️ Mis Equipos & Solicitudes
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

        ${isReadOnly ? `<div class="read-only-banner">ℹ️ Permisos asignados al perfil: <strong>${effectiveRole}</strong>.</div>` : ''}

        <!-- CONTENIDO PESTAÑAS -->
        <div class="tab-content-area">
          
          <!-- PESTAÑA DEDICADA A INVITADOS / JUGADORES / ADHESIÓN -->
          ${this.activeTab === 'requests' && this._can("VIEW_TAB_REQUESTS") ? `
            <div class="config-container">
              
              <!-- 1. SELECCIONAR EQUIPO PERMITIDO Y TEMPORADA EN PANTALLA -->
              <div class="config-card">
                <div class="card-title"><span>👀</span> SELECCIÓN DE VISUALIZACIÓN DE EQUIPOS AUTORIZADOS</div>
                <p style="font-size: 12px; color: #64748b; margin-top: -10px; margin-bottom: 16px;">
                  Solo puedes ver y consultar estadísticas de los equipos que te han sido asignados por el administrador:
                </p>
                <div class="grid-2-cols">
                  <div class="form-group">
                    <label>Equipo Autorizado en Pantalla</label>
                    <select id="select-guest-active-team">
                      ${allowedSelectableTeams.length > 0 ? allowedSelectableTeams.map(t => `
                        <option value="${t.id}" ${String(t.id).toLowerCase() === String(activeTeamId).toLowerCase() ? 'selected' : ''}>
                          ${t.name} (${t.category || 'Baloncesto'})
                        </option>
                      `).join("") : `<option value="" disabled selected>⚠️ No tienes ningún equipo asignado aún</option>`}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Temporada en Pantalla</label>
                    <select id="select-guest-active-season">
                      ${requestSeasonContexts.length > 0
                        ? requestSeasonContexts.map(s => {
                            const value = s.team_season_id || s.teamSeasonId || s.name;
                            const rawLabel = String(s.name || "");
                            const match = rawLabel.match(/^(\\d{4})\\s*[-\\/]\\s*(\\d{4})$/);
                            const label = match ? `${match[1]}/${match[2]}` : rawLabel;
                            const activeValue = currentActiveSeasonContext?.team_season_id
                              || currentActiveSeasonContext?.teamSeasonId
                              || currentActiveSeasonContext?.name
                              || currentActiveSeasonName;
                            const selected = String(value) === String(activeValue)
                              || String(label) === String(currentActiveSeasonName);
                            return `<option value="${value}" ${selected ? 'selected' : ''}>${label}</option>`;
                          }).join("")
                        : `<option value="" disabled selected>Sin temporadas vinculadas</option>`}
                    </select>
                  </div>
                </div>
              </div>

              <!-- 2. SOLICITAR UNIRSE A OTRO EQUIPO -->
              <div class="config-card">
                <div class="card-title"><span>📩</span> SOLICITAR ACCESO A OTROS EQUIPOS</div>
                <p style="font-size: 12px; color: #64748b; margin-top: -10px; margin-bottom: 16px;">
                  Si deseas ver estadísticas o formar parte de un equipo adicional, envía una solicitud que le llegará únicamente a los administradores del club y al Superadmin:
                </p>

                <div class="table-responsive">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Equipo</th>
                        <th>Categoría</th>
                        <th>Competición</th>
                        <th>Estado de tu Solicitud</th>
                        <th style="text-align: right;">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${directoryTeams.length > 0 ? directoryTeams.map(team => {
                        const existingReq = this.joinRequests.find(r => r.userEmail === currentUserEmail && String(r.teamId) === String(team.id));
                        const isAlreadyAssigned = myAssignedTeamIds.includes(String(team.id));

                        return `
                          <tr>
                            <td><strong>${team.name}</strong>${team.club_name ? `<div style="font-size:10px;color:#64748b;">${team.club_name}</div>` : ''}</td>
                            <td><span class="badge-category">${team.category || 'General'}</span></td>
                            <td>${team.competition || 'Oficial'}</td>
                            <td>
                              ${isAlreadyAssigned 
                                ? '<span class="badge-active-team">🟢 Acceso Concedido</span>'
                                : (existingReq 
                                    ? `<span class="${existingReq.status === 'APROBADO' ? 'badge-active-team' : 'badge-pending'}">${existingReq.status}</span>`
                                    : `<span class="badge-inactive">Sin solicitar</span>`)}
                            </td>
                            <td style="text-align: right;">
                              ${isAlreadyAssigned ? `
                                <button type="button" class="btn-outline-sm" disabled>Equipo Asignado</button>
                              ` : (existingReq ? `
                                <button type="button" class="btn-outline-sm" disabled>Solicitud Registrada</button>
                              ` : `
                                <button type="button" class="btn-request-join-team btn-secondary-sm" data-id="${team.id}" data-name="${team.name}">
                                  ✉️ Solicitar Acceso
                                </button>
                              `)}
                            </td>
                          </tr>
                        `;
                      }).join("") : `<tr><td colspan="5" style="text-align: center; color: #64748b;">No hay equipos registrados en el sistema.</td></tr>`}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ` : ''}

          <!-- PESTAÑA 1: CLUBS Y EQUIPOS (ADMIN Y SUPERADMIN) -->
          ${this.activeTab === 'club' && this._can("VIEW_TAB_CLUB") ? `
            ${this.clubSubView === 'list' ? `
              ${this._can("CREATE_CLUB") ? `
                <div class="config-card" style="margin-bottom: 16px;">
                  <div class="card-title"><span>👑</span> CREAR UN NUEVO CLUB (EXCLUSIVO SUPERADMIN)</div>
                  <form id="form-create-club" class="grid-2-cols">
                    <div class="form-group"><label>Nombre del Club *</label><input type="text" id="club-new-name" placeholder="Ej. CB Sants" required /></div>
                    <div class="form-group"><label>Coordinador · temporada ${currentActiveSeasonName}</label><input type="text" id="club-new-coordinator" placeholder="Ej. Marc Soler" /></div>
                    <div class="form-group"><label>Teléfono</label><input type="text" id="club-new-phone" placeholder="Ej. +34 600 000 000" /></div>
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
                    <div class="form-group"><label>Entrenador Principal · temporada ${currentActiveSeasonName}</label><input type="text" id="team-new-coach" placeholder="Ej. Teo Raichman" /></div>
                    <div class="form-group"><label>Color Principal</label><input type="color" id="team-new-color" value="#ea580c" style="width: 100%; height: 38px; border: none; cursor: pointer;" /></div>
                    <div style="grid-column: 1 / -1; text-align: right;"><button type="submit" class="btn-primary">+ Crear Equipo Completo</button></div>
                  </form>
                </div>
              ` : ''}

              <div class="config-card" style="margin-bottom: 16px;">
                <div class="card-title"><span>🏢</span> CLUBS REGISTRADOS (${realClubs.length})</div>
                <div class="table-responsive">
                  <table class="data-table">
                    <thead><tr><th>Nombre del Club</th><th>Coordinador</th><th>Teléfono</th><th>Dirección</th><th style="text-align: right;">Acción</th></tr></thead>
                    <tbody>${realClubs.length > 0 ? realClubs.map(c => `<tr><td><strong>${c.name || 'Sin Nombre'}</strong></td><td>${DataStore.getClubCoordinator?.(c.id, currentActiveSeasonName) || c.coordinator_name || 'No asignado'}<div style="font-size:10px;color:#94a3b8;">${currentActiveSeasonName}</div></td><td>${c.phone || '-'}</td><td>${c.address || '-'}</td><td style="text-align: right;"><button type="button" class="btn-edit-club btn-outline-sm" data-id="${c.id}">✏️ Editar Club</button></td></tr>`).join("") : `<tr><td colspan="5" style="text-align: center; color: #64748b;">No hay clubs registrados.</td></tr>`}</tbody>
                  </table>
                </div>
              </div>

              <div class="config-card">
                <div class="card-title"><span>📊</span> EQUIPOS REGISTRADOS DE TUS ACCESOS (${allowedSelectableTeams.length})</div>
                <div class="table-responsive">
                  <table class="data-table">
                    <thead><tr><th>Club</th><th>Equipo</th><th>Categoría</th><th>Entrenador</th><th>Estado</th><th style="text-align: right;">Acción</th></tr></thead>
                    <tbody>${allowedSelectableTeams.length > 0 ? allowedSelectableTeams.map(t => { const isTeamActive = String(t.id).trim().toLowerCase() === String(activeTeamId).trim().toLowerCase(); return `<tr class="${isTeamActive ? 'active-team-row' : ''}"><td><strong>${t.clubName || 'Club'}</strong></td><td>${t.name}</td><td><span class="badge-category">${t.category || '-'}</span></td><td><strong>${DataStore.getTeamCoach?.(t.id, currentActiveSeasonName) || t.coach_name || t.coach || 'Por definir'}</strong><div style="font-size:10px;color:#94a3b8;">${currentActiveSeasonName}</div></td><td>${isTeamActive ? `<span class="badge-active-team">🟢 Activo Actual</span>` : `<button type="button" class="btn-set-active-team btn-outline-sm" data-id="${t.id}">Activar</button>`}</td><td style="text-align: right;"><button type="button" class="btn-edit-team btn-secondary-sm" data-id="${t.id}">⚙️ Configurar</button></td></tr>`; }).join("") : `<tr><td colspan="6" style="text-align: center; color: #64748b;">No hay equipos registrados asignados.</td></tr>`}</tbody>
                  </table>
                </div>
              </div>
            ` : ''}

            ${this.clubSubView === 'edit-team' ? `
              <div class="config-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                  <div class="card-title" style="margin: 0;"><span>🏆</span> DATOS DEL EQUIPO (${this.selectedTeamForEdit?.name || ''})</div>
                  <button type="button" class="btn-back-to-list btn-outline-sm">⬅️ Volver al Listado</button>
                </div>

                <form id="form-edit-team" class="grid-2-cols">
                  <div class="form-group"><label>Nombre del Club</label><input type="text" value="${this.selectedTeamForEdit?.clubName || 'Club'}" disabled /></div>
                  <div class="form-group"><label>Nombre del Equipo *</label><input type="text" id="edit-team-name" value="${this.selectedTeamForEdit?.name || ''}" ${isReadOnly ? 'disabled' : ''} required /></div>
                  <div class="form-group"><label>Categoría</label><input type="text" id="edit-team-category" value="${this.selectedTeamForEdit?.category || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>Competición</label><input type="text" id="edit-team-competition" value="${this.selectedTeamForEdit?.competition || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>Entrenador Principal · temporada ${currentActiveSeasonName}</label><input type="text" id="edit-team-coach" value="${DataStore.getTeamCoach?.(this.selectedTeamForEdit?.id, currentActiveSeasonName) || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>Color Principal</label><input type="color" id="edit-team-color" value="${this.selectedTeamForEdit?.color || '#ea580c'}" style="width: 100%; height: 38px; border: none; cursor: pointer;" ${isReadOnly ? 'disabled' : ''} /></div>
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
                  <div class="form-group"><label>Nombre del Club *</label><input type="text" id="edit-club-name" value="${this.selectedClubForEdit?.name || ''}" ${!this._can("MANAGE_CLUB_DATA") ? 'disabled' : ''} required /></div>
                  <div class="form-group"><label>Coordinador · temporada ${currentActiveSeasonName}</label><input type="text" id="edit-club-coordinator" value="${DataStore.getClubCoordinator?.(this.selectedClubForEdit?.id, currentActiveSeasonName) || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
                  <div class="form-group"><label>Teléfono</label><input type="text" id="edit-club-phone" value="${this.selectedClubForEdit?.phone || ''}" ${isReadOnly ? 'disabled' : ''} /></div>
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
                      <thead><tr><th>Jugador</th><th>Origen</th><th>Destino</th><th style="text-align: right;">Acciones</th></tr></thead>
                      <tbody>
                        ${pendingTransfersList.map(tr => {
                          const originTeam = realTeams.find(t => String(t.id).toLowerCase() === String(tr.originTeamId).toLowerCase());
                          const targetTeam = realTeams.find(t => String(t.id).toLowerCase() === String(tr.targetTeamId).toLowerCase());
                          return `
                            <tr>
                              <td><strong>${tr.playerName}</strong></td>
                              <td><span class="badge-category">${originTeam ? originTeam.name : 'Equipo origen'}</span></td>
                              <td><span class="badge-active-team">${targetTeam ? targetTeam.name : 'Equipo destino'}</span></td>
                              <td style="text-align: right; display: flex; justify-content: flex-end; gap: 8px;">
                                <button type="button" class="btn-approve-transfer btn-secondary-sm" data-id="${tr.id}" data-player-id="${tr.playerId}" data-target-team="${tr.targetTeamId}" style="background: #16a34a; color: white;">🟢 Aprobar Traspaso</button>
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
              ${this._can("REQUEST_TRANSFERS") && transferMarketReady ? `
              <div class="config-card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                  <h3 style="margin: 0; font-size: 15px; color: #1e3a8a; font-weight: 800;">🔄 Mercado de Fichajes Global</h3>
                  <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Busca y solicita el traspaso de jugadores de cualquier equipo del sistema.</p>
                </div>
                <button type="button" id="btn-open-market-modal" class="btn-primary" style="background: #6366f1; padding: 10px 18px; font-size: 13px;">
                  🔍 Abrir Mercado / Fichar Jugador
                </button>
              </div>
              ` : ''}

              ${this._can("REQUEST_TRANSFERS") && !transferMarketReady ? `
                <div class="read-only-banner">
                  ${transferRequestReady
                    ? 'El directorio seguro del mercado todavía no está disponible. Las solicitudes existentes siguen operativas, pero las nuevas búsquedas quedan desactivadas.'
                    : 'El backend persistente de traspasos todavía no está disponible. El mercado queda desactivado para evitar solicitudes locales no auditables.'}
                </div>
              ` : ''}

              <!-- BLOQUE DE AÑADIR JUGADOR NUEVO -->
              ${this._can("MANAGE_PLAYERS") ? `
                <div class="config-card">
                  <div class="card-title"><span>👥</span> AÑADIR JUGADOR NUEVO · ${rosterContextName}</div>
                   ${!rosterBackendReady ? '<div class="read-only-banner" style="margin-bottom:12px;">La gestión histórica de plantilla está en modo lectura hasta aplicar el backend v3 de roster.</div>' : ''}
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
                    <div class="form-group">
                      <label>Primer día elegible *</label>
                      <input type="date" id="add-p-effective-date" value="${rosterReferenceDate || ''}" ${rosterSeasonBounds.start ? `min="${rosterSeasonBounds.start}"` : ''} ${rosterSeasonBounds.end ? `max="${rosterSeasonBounds.end}"` : ''} required />
                    </div>
                    <div style="grid-column: 1 / -1; text-align: right;">
                      <button type="submit" class="btn-secondary" ${rosterBackendReady && rosterTeamSeasonId ? '' : 'disabled style="opacity:.5;cursor:not-allowed;"'}>+ Crear y Añadir a la Plantilla</button>
                    </div>
                  </form>
                </div>
              ` : ''}

              <!-- JUGADORES PLANTILLA DE LA TEMPORADA ACTIVA -->
              <div class="config-card">
                <div class="card-title"><span>📋</span> PLANTILLA ${rosterContextName} · ${rosterReferenceDate} (${players.length})</div>
                ${this.rosterState && !this.rosterState.persisted ? `
                  <div style="font-size:11px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:9px 11px;margin-bottom:12px;">
                    Esta temporada parte de la plantilla anterior como base. El primer cambio la guardará como plantilla independiente.
                  </div>
                ` : ''}
                <div class="players-grid">
                  ${players.length > 0 ? players.map(p => `
                    <div class="player-card ${p.status === 'TRASPASADO' ? 'player-transferred' : ''}">
                      <div>
                        <strong>#${p.jersey ?? p.number ?? '?'} ${p.first_name || ''} ${p.last_name || ''}</strong>
                        <div style="font-size: 11px; color: #64748b;">
                          ${p.primary_position || p.position || 'Jugador'} • ${p.rosterCurrentFrom ? `Elegible desde ${p.rosterCurrentFrom}` : (p.rosterInherited ? 'Base heredada' : 'Activo en esta temporada')}
                        </div>
                      </div>
                      ${this._can("MANAGE_PLAYERS") ? `
                        <div class="player-card-actions">
                          <button type="button" class="btn-edit-player-modal btn-edit-link" data-id="${p.id}">✏️ Editar</button>
                          <button type="button" class="btn-remove-player-season btn-danger-sm" data-id="${p.id}" ${rosterRemovalReady && rosterTeamSeasonId ? '' : 'disabled'}>
                            Quitar
                          </button>
                        </div>
                      ` : ''}
                    </div>
                  `).join("") : `<p style="font-size: 13px; color: #64748b; grid-column: 1/-1;">No hay jugadores en esta temporada.</p>`}
                </div>
              </div>

              ${historicalRosterPlayers.length > 0 ? `
                <div class="config-card">
                  <div class="card-title"><span>🕘</span> HISTÓRICO DE PLANTILLA · ${rosterContextName} (${historicalRosterPlayers.length})</div>
                  <div style="font-size:11px;color:#64748b;margin:-6px 0 12px;">
                    Jugadores que participaron en esta temporada pero no están elegibles en la fecha de referencia ${rosterReferenceDate}.
                  </div>
                  <div class="players-grid">
                    ${historicalRosterPlayers.map(p => `
                      <div class="player-card player-transferred">
                        <div>
                          <strong>#${p.jersey ?? p.number ?? '?'} ${p.first_name || ''} ${p.last_name || ''}</strong>
                          <div style="font-size:11px;color:#64748b;">
                            ${p.primary_position || p.position || 'Jugador'} · ${formatRosterIntervals(p)}
                          </div>
                        </div>
                        ${this._can("MANAGE_PLAYERS") && rosterBackendReady ? `
                          <button type="button" class="btn-reactivate-player-season btn-secondary-sm" data-id="${p.id}">
                            + Reincorporar
                          </button>
                        ` : ''}
                      </div>
                    `).join("")}
                  </div>
                </div>
              ` : ''}

              ${availableRosterPlayers.length > 0 && this._can("MANAGE_PLAYERS") ? `
                <div class="config-card">
                  <div class="card-title"><span>↩️</span> JUGADORES DEL EQUIPO FUERA DE ${rosterContextName}</div>
                  <div class="players-grid">
                    ${availableRosterPlayers.map(p => `
                      <div class="player-card">
                        <div>
                          <strong>#${p.jersey ?? p.number ?? '?'} ${p.first_name || ''} ${p.last_name || ''}</strong>
                          <div style="font-size:11px;color:#64748b;">${p.primary_position || p.position || 'Jugador'} · No inscrito en esta temporada</div>
                        </div>
                        <button type="button" class="btn-reactivate-player-season btn-secondary-sm" data-id="${p.id}">
                          + Añadir
                        </button>
                      </div>
                    `).join("")}
                  </div>
                </div>
              ` : ''}
              <!-- MODAL DE EDICIÓN DE JUGADOR -->
              <div id="modal-edit-player" class="iq-modal-overlay" style="display:none;">
                <div class="config-card iq-modal-card iq-modal-card-sm">
                  <div class="iq-modal-header">
                    <h3 style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 800;">✏️ Editar Datos del Jugador</h3>
                    <button type="button" id="btn-close-edit-player-modal" class="btn-outline-sm" style="font-size: 14px;">✕</button>
                  </div>

                  <form id="form-edit-player-modal" class="grid-2-cols">
                    <input type="hidden" id="edit-p-id" />
                    <div class="form-group"><label>Nombre *</label><input type="text" id="edit-p-name" ${isReadOnly ? 'disabled' : ''} required /></div>
                    <div class="form-group"><label>Apellidos *</label><input type="text" id="edit-p-lastname" ${isReadOnly ? 'disabled' : ''} required /></div>
                    <div class="form-group"><label>Dorsal / Nº *</label><input type="number" id="edit-p-number" min="0" max="99" ${isReadOnly ? 'disabled' : ''} required /></div>
                    <div class="form-group">
                      <label>Posición Principal *</label>
                      <select id="edit-p-position" ${isReadOnly ? 'disabled' : ''} required>
                        <option value="Base">Base</option><option value="Escolta">Escolta</option><option value="Alero">Alero</option><option value="Ala-pívot">Ala-pívot</option><option value="Pívot">Pívot</option>
                      </select>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                      <label>Estado general del jugador</label>
                      <select id="edit-p-status" ${isReadOnly ? 'disabled' : ''}>
                        <option value="Activo">Activo</option>
                        <option value="Lesionado">Lesionado</option>
                        <option value="Inactivo">Inactivo</option>
                        <option value="TRASPASADO">Traspasado (estado legacy)</option>
                      </select>
                      <small style="font-size:10px;color:#64748b;line-height:1.35;">
                        Este estado descriptivo no cambia la elegibilidad por temporada. Para dar de baja o reincorporar al jugador utiliza «Quitar» / «Reincorporar», que conservan el historial por fechas.
                      </small>
                    </div>
                    <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
                      <button type="button" id="btn-cancel-edit-player" class="btn-outline-sm">Cancelar</button>
                      ${!isReadOnly && rosterBackendReady && rosterTeamSeasonId ? `<button type="submit" class="btn-primary">💾 Guardar Cambios</button>` : ''}
                    </div>
                  </form>
                </div>
              </div>

              <!-- SUBPANTALLA / MODAL DEL MERCADO GLOBAL -->
              <div id="modal-market-global" class="iq-modal-overlay" style="display:none;">
                <div class="config-card iq-modal-card iq-modal-card-lg">
                  <div class="iq-modal-header">
                    <div>
                      <h3 style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 800;">🔄 Mercado de Fichajes Global</h3>
                      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Solo se muestran jugadores con un periodo activo en otro equipo de la misma temporada. No se exponen datos privados de otros equipos.</p>
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

          <!-- PESTAÑA 3: USUARIOS & ROLES (ADMIN Y SUPERADMIN) -->
          ${this.activeTab === 'users' && this._can("VIEW_TAB_USERS") ? `
            <div class="config-container">
              
              <!-- TARJETA DE AVISO DESTACADA: SOLICITUDES DE ADHESIÓN PENDIENTES -->
              ${this._can("APPROVE_JOIN_REQUESTS") && pendingJoinRequestsList.length > 0 ? `
                <div class="config-card" style="border: 2px solid #ea580c; background: #fff7ed; margin-bottom: 16px;">
                  <div class="card-title" style="color: #c2410c;">
                    <span>📩</span> SOLICITUDES DE ADHESIÓN A EQUIPO PENDIENTES (${pendingJoinRequestsList.length})
                  </div>
                  <p style="font-size: 12px; color: #9a3412; margin-top: -10px; margin-bottom: 12px;">
                    Los siguientes usuarios han solicitado unirse a un equipo de tu club. Puedes autorizar su acceso o rechazar la petición:
                  </p>
                  <div class="table-responsive">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Usuario (Email)</th>
                          <th>Equipo Solicitado</th>
                          <th>Fecha Solicitud</th>
                          <th style="text-align: right;">Acciones de Gestión</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${pendingJoinRequestsList.map(req => `
                          <tr>
                            <td><strong>${req.userEmail}</strong></td>
                            <td><span class="badge-category">${req.teamName || 'Equipo'}</span></td>
                            <td>${req.date || '-'}</td>
                            <td style="text-align: right; display: flex; justify-content: flex-end; gap: 8px;">
                              <button type="button" class="btn-approve-join-req btn-secondary-sm" data-id="${req.id}" data-email="${req.userEmail}" data-team-id="${req.teamId}" style="background: #16a34a; color: white;">
                                🟢 Aprobar y Conceder Acceso
                              </button>
                              <button type="button" class="btn-reject-join-req btn-danger-sm" data-id="${req.id}">
                                🔴 Rechazar
                              </button>
                            </td>
                          </tr>
                        `).join("")}
                      </tbody>
                    </table>
                  </div>
                </div>
              ` : ''}

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
                      ${this._can("ASSIGN_ADMIN_ROLE") ? `<option value="ADMIN">Administrador de Club</option>` : ''}
                      <option value="ENTRENADOR" selected>Entrenador</option>
                      <option value="ANALISTA">Analista</option>
                      <option value="PREPARADOR_FISICO">Preparador físico</option>
                      <option value="JUGADOR">Jugador</option>
                      <option value="FAMILIA_TUTOR">Familia / Tutor</option>
                      <option value="VISOR">Visor (Solo Lectura)</option>
                      <option value="INVITADO">Invitado (Demo)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>🔑 Contraseña Temporal *</label>
                    <input type="password" id="new-user-pass" placeholder="Contraseña temporal segura" autocomplete="new-password" required />
                  </div>
                  <div style="grid-column: 1 / -1; text-align: right;">
                    <button type="submit" id="btn-submit-create-user" class="btn-primary">✉️ Dar de Alta e Invitar Usuario</button>
                  </div>
                </form>
              </div>

              <div class="config-card">
                <div class="card-title"><span>👥</span> ADMINISTRAR MIEMBROS, ROLES Y ASIGNACIÓN DE EQUIPOS (${visibleProfiles.length})</div>
                <div class="table-responsive">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Email</th>
                        <th>Rol Asignado</th>
                        <th>Equipos Asignados</th>
                        <th style="text-align: right;">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${visibleProfiles.length > 0 ? visibleProfiles.map(prof => {
                        const assignedIds = this.userTeamAssignments[prof.email] || [];
                        const assignedTeamNames = realTeams
                          .filter(t => assignedIds.includes(String(t.id)))
                          .map(t => t.name);

                        const userHasPending = this.joinRequests.some(r => r.userEmail === prof.email && r.status === 'PENDIENTE');
                        const isUniqueSuperadmin = String(prof.email || "").toLowerCase() === UNIQUE_SUPERADMIN_EMAIL;
                        const isProtectedAdmin = prof.role === UserRole.ADMIN && !this._can("ASSIGN_ADMIN_ROLE");
                        const roleSelectDisabled = isUniqueSuperadmin || isProtectedAdmin;

                        return `
                          <tr>
                            <td>
                              <strong>${(prof.first_name || '') + ' ' + (prof.last_name || '') || 'Sin Nombre'}</strong>
                              ${userHasPending ? '<span style="background: #ea580c; color: white; border-radius: 4px; padding: 2px 6px; font-size: 10px; margin-left: 6px; font-weight: 800;">⏳ Solicitud Pendiente</span>' : ''}
                            </td>
                            <td>${prof.email || '-'}</td>
                            <td>
                              <select class="select-user-role" data-id="${prof.id}" ${roleSelectDisabled ? 'disabled' : ''} style="padding: 4px 8px; border-radius: 6px; font-weight: 700;">
                                ${isUniqueSuperadmin ? `<option value="SUPERADMIN" selected>Superadmin único</option>` : ''}
                                ${!isUniqueSuperadmin && this._can("ASSIGN_ADMIN_ROLE") ? `<option value="ADMIN" ${prof.role === 'ADMIN' ? 'selected' : ''}>Administrador de Club</option>` : ''}
                                ${!isUniqueSuperadmin ? `
                                  <option value="ENTRENADOR" ${prof.role === 'ENTRENADOR' ? 'selected' : ''}>Entrenador</option>
                                  <option value="ANALISTA" ${['ANALISTA','SCOUT'].includes(prof.role) ? 'selected' : ''}>Analista</option>
                                  <option value="PREPARADOR_FISICO" ${prof.role === 'PREPARADOR_FISICO' ? 'selected' : ''}>Preparador físico</option>
                                  <option value="JUGADOR" ${prof.role === 'JUGADOR' ? 'selected' : ''}>Jugador</option>
                                  <option value="FAMILIA_TUTOR" ${prof.role === 'FAMILIA_TUTOR' ? 'selected' : ''}>Familia / Tutor</option>
                                  <option value="VISOR" ${['VISOR','VIEWER'].includes(prof.role) ? 'selected' : ''}>Visor</option>
                                  <option value="INVITADO" ${prof.role === 'INVITADO' ? 'selected' : ''}>Invitado (Demo)</option>
                                ` : ''}
                              </select>
                            </td>
                            <td>
                              ${isUniqueSuperadmin
                                ? '<span class="badge-active-team">🌍 Todos los Equipos</span>' 
                                : (assignedTeamNames.length > 0 
                                    ? `<span class="badge-category">${assignedTeamNames.join(', ')}</span>` 
                                    : '<span class="badge-inactive">Sin Equipos</span>')}
                            </td>
                            <td style="text-align: right; display: flex; justify-content: flex-end; gap: 6px;">
                              <button type="button" class="btn-save-user-role btn-secondary-sm" data-id="${prof.id}" title="Guardar Rol" ${roleSelectDisabled ? 'disabled style="opacity:.5;cursor:not-allowed;"' : ''}>💾 Guardar Rol</button>
                              <button type="button" class="btn-open-user-card btn-outline-sm" data-email="${prof.email}">📇 Ver Ficha / Equipos</button>
                            </td>
                          </tr>
                        `;
                      }).join("") : `<tr><td colspan="5" style="text-align: center; color: #64748b;">No hay usuarios registrados.</td></tr>`}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- MODAL FICHA TÉCNICA DE USUARIO Y ASIGNACIÓN MULTIEQUIPO -->
              <div id="modal-user-card" class="iq-modal-overlay" style="display:none;">
                <div class="config-card iq-modal-card iq-modal-card-md">
                  <div class="iq-modal-header">
                    <h3 style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 800;">📇 FICHA TÉCNICA Y ASIGNACIÓN DE EQUIPOS</h3>
                    <button type="button" id="btn-close-user-card-modal" class="btn-outline-sm" style="font-size: 14px;">✕</button>
                  </div>

                  <div id="user-card-modal-content"></div>
                </div>
              </div>

            </div>
          ` : ''}

          <!-- PESTAÑA 4: TEMPORADAS V3 -->
          ${this.activeTab === 'seasons' && this._can("VIEW_TAB_SEASONS")
            ? this.seasonManagementView.renderMarkup({
                activeTeamId,
                canManage: this._can("CREATE_SEASON")
              })
            : ''}

          <!-- PESTAÑA 5: IDIOMAS Y TRADUCCIONES (SUPERADMIN) -->
          ${this.activeTab === 'translations' && this._can("VIEW_TAB_TRANSLATIONS") ? `
            <div id="translations-subview-container">
              ${this.languageSettingsView.render()}
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
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="PREPARADOR_FISICO" style="padding: 14px; text-align: left; font-weight: 800;">💪 Simular PREPARADOR FÍSICO</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="JUGADOR" style="padding: 14px; text-align: left; font-weight: 800;">👤 Simular JUGADOR</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="FAMILIA_TUTOR" style="padding: 14px; text-align: left; font-weight: 800;">👪 Simular FAMILIA / TUTOR</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="VISOR" style="padding: 14px; text-align: left; font-weight: 800;">👁️ Simular VISOR</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="INVITADO" style="padding: 14px; text-align: left; font-weight: 800;">🧪 Simular INVITADO (Demo)</button>
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
        .config-container { max-width: 1000px; margin: 0 auto; font-family: var(--font-family-base, system-ui); display: flex; flex-direction: column; gap: 16px; }
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
        .form-group input, .form-group select { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; outline: none; background: white; min-height: 44px; box-sizing: border-box; }

        .btn-primary { background: #1e3a8a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; min-height: 44px; }
        .btn-secondary { background: #6366f1; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; min-height: 44px; }
        .btn-secondary-sm { background: #6366f1; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 11px; cursor: pointer; min-height: 36px; }
        .btn-outline-sm { background: white; border: 1px solid #cbd5e1; color: #334155; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 11px; cursor: pointer; min-height: 36px; }
        .btn-danger-sm { background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 6px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; min-height: 36px; }

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
        .player-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .player-card-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }

        .iq-modal-overlay {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100dvh;
          box-sizing: border-box;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(4px);
          z-index: 10020;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          align-items: flex-start;
          justify-content: center;
          padding:
            max(10px, env(safe-area-inset-top))
            max(10px, env(safe-area-inset-right))
            max(12px, env(safe-area-inset-bottom))
            max(10px, env(safe-area-inset-left));
        }
        .iq-modal-card {
          width: 100%;
          max-height: calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          box-sizing: border-box;
          margin: auto 0;
        }
        .iq-modal-card-sm { max-width: 500px; }
        .iq-modal-card-md { max-width: 600px; }
        .iq-modal-card-lg { max-width: 850px; }
        .iq-modal-header {
          position: sticky;
          top: -20px;
          z-index: 2;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin: -4px -4px 16px;
          padding: 4px 4px 10px;
          background: white;
          border-bottom: 1px solid #f1f5f9;
        }

        @media (max-width: 868px) {
          .grid-2-cols, .grid-4-cols, .players-grid { grid-template-columns: 1fr !important; }
          .player-card { align-items: flex-start; flex-wrap: wrap; }
          .player-card-actions { width: 100%; justify-content: flex-start; }
          .iq-modal-card { margin: 0; max-height: calc(100dvh - 20px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); padding: 14px; }
          .iq-modal-header { top: -14px; margin: -2px -2px 12px; padding-top: 2px; }
        }
      </style>
    `;

    // Interceptador de aviso para cambio de Rol Activo si no es SUPERADMIN
    const selectDemoRole = container.querySelector("#select-demo-role");
    if (selectDemoRole && !canModifyActiveRole) {
      selectDemoRole.addEventListener("click", (e) => {
        e.preventDefault();
        alert("⚠️ La modificación del Rol Activo solo está disponible para el perfil SUPERADMIN.");
      });
    }

    // --- BINDING DE EVENTOS PESTAÑAS PRINCIPALES ---
    container.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        this.activeTab = e.currentTarget.getAttribute("data-tab");
        this.clubSubView = "list";
        await this.render(containerId);
      });
    });

    // 1. CREAR CLUB (SUPERADMIN)
    const formCreateClub = container.querySelector("#form-create-club");
    if (formCreateClub) {
      formCreateClub.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!this._canReal("CREATE_CLUB")) return alert("⚠️ Solo el Superadmin puede crear clubes.");
        const name = container.querySelector("#club-new-name")?.value.trim();
        const coordinator = container.querySelector("#club-new-coordinator")?.value.trim();
        const phone = container.querySelector("#club-new-phone")?.value.trim();
        const address = container.querySelector("#club-new-address")?.value.trim();

        if (!name) return alert("Introduce el nombre del club.");

        this.showSyncOverlay("⚡ Creando nuevo club en Supabase...");
        try {
          if (!supabase) throw new Error("Supabase no configurado");
          const { data, error } = await supabase.from("clubs").insert([{
            name,
            coordinator_name: coordinator,
            phone,
            address
          }]).select().single();

          if (error) throw error;

          if (coordinator !== undefined) {
            await this._saveStaffAssignment({
              clubId: data.id,
              seasonName: currentActiveSeasonName,
              role: StaffRole.COORDINATOR,
              staffName: coordinator
            });
          }

          DataStore.isLoaded = false;
          await DataStore.init(activeTeamId, true);
          this.hideSyncOverlay();
          alert(`✅ Club "${name}" creado exitosamente.`);
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error creando club:", err);
          alert(`❌ Error al crear club: ${err.message || err}`);
        }
      });
    }

    // 2. CREAR EQUIPO (SUPERADMIN)
    const formCreateTeam = container.querySelector("#form-create-team");
    if (formCreateTeam) {
      formCreateTeam.addEventListener("submit", async (e) => {
        e.preventDefault();
        const clubId = container.querySelector("#team-new-club-id")?.value;
        const name = container.querySelector("#team-new-name")?.value.trim();
        const category = container.querySelector("#team-new-category")?.value.trim();
        const competition = container.querySelector("#team-new-competition")?.value.trim();
        const coach = container.querySelector("#team-new-coach")?.value.trim();
        const color = container.querySelector("#team-new-color")?.value || "#ea580c";

        if (!name || !clubId) return alert("Introduce los campos obligatorios del equipo.");
        if (!this.auth?.can?.(Permission.MANAGE_TEAMS, { clubId })) return alert("⚠️ No tienes permiso para crear equipos en este club.");

        this.showSyncOverlay("⚡ Creando nuevo equipo en Supabase...");
        try {
          if (!supabase) throw new Error("Supabase no configurado");
          const { data, error } = await supabase.from("teams").insert([{
            club_id: clubId,
            name,
            category,
            competition,
            coach_name: coach,
            color
          }]).select().single();

          if (error) throw error;

          await this._saveStaffAssignment({
            clubId,
            teamId: data.id,
            seasonName: currentActiveSeasonName,
            role: StaffRole.HEAD_COACH,
            staffName: coach
          });

          DataStore.isLoaded = false;
          await DataStore.init(data.id, true);
          this.hideSyncOverlay();
          alert(`✅ Equipo "${name}" creado exitosamente.`);
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error creando equipo:", err);
          alert(`❌ Error al crear equipo: ${err.message || err}`);
        }
      });
    }

    // 3. EDITAR CLUB / CONFIGURAR EQUIPO
    container.querySelectorAll(".btn-edit-club").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.selectedClubForEdit = realClubs.find(c => String(c.id) === String(id));
        this.clubSubView = "edit-club";
        this.render(containerId);
      });
    });

    container.querySelectorAll(".btn-edit-team").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.selectedTeamForEdit = realTeams.find(t => String(t.id) === String(id));
        this.clubSubView = "edit-team";
        this.render(containerId);
      });
    });

    container.querySelectorAll(".btn-back-to-list").forEach(btn => {
      btn.addEventListener("click", () => {
        this.clubSubView = "list";
        this.render(containerId);
      });
    });

    // Guardar Edición de Equipo
    const formEditTeam = container.querySelector("#form-edit-team");
    if (formEditTeam) {
      formEditTeam.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = this.selectedTeamForEdit?.id;
        const name = container.querySelector("#edit-team-name")?.value.trim();
        const category = container.querySelector("#edit-team-category")?.value.trim();
        const competition = container.querySelector("#edit-team-competition")?.value.trim();
        const coach = container.querySelector("#edit-team-coach")?.value.trim();
        const color = container.querySelector("#edit-team-color")?.value;
        if (!this.auth?.can?.(Permission.MANAGE_TEAMS, { teamId: id })) return alert("⚠️ No tienes permiso para modificar este equipo.");

        this.showSyncOverlay("💾 Actualizando equipo en Supabase...");
        try {
          if (!supabase) throw new Error("Supabase no configurado");
          const { error } = await supabase.from("teams").update({
            name, category, competition, color
          }).eq("id", id);

          if (error) throw error;

          await this._saveStaffAssignment({
            clubId: this.selectedTeamForEdit?.club_id || this.selectedTeamForEdit?.clubId || null,
            teamId: id,
            seasonName: currentActiveSeasonName,
            role: StaffRole.HEAD_COACH,
            staffName: coach
          });

          DataStore.isLoaded = false;
          await DataStore.init(activeTeamId, true);
          this.hideSyncOverlay();
          alert("✅ Datos del equipo guardados correctamente.");
          this.clubSubView = "list";
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error guardando equipo:", err);
          alert(`❌ Error al guardar equipo: ${err.message}`);
        }
      });
    }

    // Guardar Edición de Club
    const formEditClub = container.querySelector("#form-edit-club");
    if (formEditClub) {
      formEditClub.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = this.selectedClubForEdit?.id;
        const name = container.querySelector("#edit-club-name")?.value.trim();
        const coordinator = container.querySelector("#edit-club-coordinator")?.value.trim();
        const phone = container.querySelector("#edit-club-phone")?.value.trim();
        const address = container.querySelector("#edit-club-address")?.value.trim();
        if (!this.auth?.can?.(Permission.MANAGE_CLUBS, { clubId: id })) return alert("⚠️ No tienes permiso para modificar este club.");

        this.showSyncOverlay("💾 Actualizando club en Supabase...");
        try {
          if (!supabase) throw new Error("Supabase no configurado");
          const { error } = await supabase.from("clubs").update({
            name, phone, address
          }).eq("id", id);

          if (error) throw error;

          await this._saveStaffAssignment({
            clubId: id,
            seasonName: currentActiveSeasonName,
            role: StaffRole.COORDINATOR,
            staffName: coordinator
          });

          DataStore.isLoaded = false;
          await DataStore.init(activeTeamId, true);
          this.hideSyncOverlay();
          alert("✅ Datos del club guardados correctamente.");
          this.clubSubView = "list";
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error guardando club:", err);
          alert(`❌ Error al guardar club: ${err.message}`);
        }
      });
    }

    // 4. AÑADIR JUGADOR A PLANTILLA ACTIVA
    const formAddPlayer = container.querySelector("#form-add-player");
    if (formAddPlayer) {
      formAddPlayer.addEventListener("submit", async (e) => {
        e.preventDefault();
        const firstName = container.querySelector("#add-p-name")?.value.trim();
        const lastName = container.querySelector("#add-p-lastname")?.value.trim();
        const jersey = Number(container.querySelector("#add-p-number")?.value || 0);
        const position = container.querySelector("#add-p-position")?.value || "Alero";
        const effectiveDate = normalizeIsoDate(
          container.querySelector("#add-p-effective-date")?.value
        );

        if (!firstName || !lastName) return alert("Introduce nombre y apellidos del jugador.");
        if (!effectiveDate) return alert("Indica el primer día en que el jugador será elegible.");
        if (!isDateInsideSeason(effectiveDate, rosterSeasonContext)) {
          return alert("⚠️ El primer día elegible debe estar dentro de las fechas de la temporada.");
        }
        if (!this.auth?.can?.(Permission.MANAGE_ROSTER, { teamId: activeTeamId, teamSeasonId: rosterTeamSeasonId })) return alert("⚠️ No tienes permiso para añadir jugadores a esta plantilla.");

        this.showSyncOverlay("⚡ Añadiendo jugador a la plantilla de la temporada...");
        try {
          if (!rosterBackendReady || !rosterTeamSeasonId) {
            throw new Error("La gestión de plantilla por temporada todavía no está disponible.");
          }

          await this.rosterManagementService.createPlayer({
            teamSeasonId: rosterTeamSeasonId,
            firstName,
            lastName,
            jersey,
            primaryPosition: position,
            effectiveDate
          });

          DataStore.isLoaded = false;
          await DataStore.init(activeTeamId, true);
          this.hideSyncOverlay();
          alert(`✅ Jugador #${jersey} ${firstName} ${lastName} añadido con éxito.`);
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error añadiendo jugador:", err);
          alert(`❌ Error al añadir jugador: ${err.message}`);
        }
      });
    }

    // 5. EDITAR JUGADOR (MODAL)
    container.querySelectorAll(".btn-edit-player-modal").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const player = players.find(p => String(p.id) === String(id));
        if (!player) return;

        container.querySelector("#edit-p-id").value = player.id;
        container.querySelector("#edit-p-name").value = player.first_name || player.firstName || "";
        container.querySelector("#edit-p-lastname").value = player.last_name || player.lastName || "";
        container.querySelector("#edit-p-number").value = player.jersey ?? player.number ?? "";
        container.querySelector("#edit-p-position").value = player.primary_position || player.position || "Alero";
        container.querySelector("#edit-p-status").value = player.status || "Activo";

        const modal = container.querySelector("#modal-edit-player");
        if (modal) modal.style.display = "flex";
      });
    });

    container.querySelector("#btn-close-edit-player-modal")?.addEventListener("click", () => {
      container.querySelector("#modal-edit-player").style.display = "none";
    });
    container.querySelector("#btn-cancel-edit-player")?.addEventListener("click", () => {
      container.querySelector("#modal-edit-player").style.display = "none";
    });

    const formEditPlayer = container.querySelector("#form-edit-player-modal");
    if (formEditPlayer) {
      formEditPlayer.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pId = container.querySelector("#edit-p-id")?.value;
        const firstName = container.querySelector("#edit-p-name")?.value.trim();
        const lastName = container.querySelector("#edit-p-lastname")?.value.trim();
        const jersey = Number(container.querySelector("#edit-p-number")?.value || 0);
        const position = container.querySelector("#edit-p-position")?.value;
        const status = container.querySelector("#edit-p-status")?.value;
        if (!this.auth?.can?.(Permission.MANAGE_ROSTER, { teamId: activeTeamId, teamSeasonId: rosterTeamSeasonId })) return alert("⚠️ No tienes permiso para modificar esta plantilla.");

        this.showSyncOverlay("💾 Guardando cambios del jugador...");
        try {
          if (!rosterBackendReady || !rosterTeamSeasonId) {
            throw new Error("La edición de plantilla por temporada todavía no está disponible.");
          }
          await DataStore.updatePlayer(pId, {
            first_name: firstName,
            last_name: lastName,
            status
          }, Permission.EDIT_PLAYER_MASTER);

          if (rosterBackendReady && rosterTeamSeasonId) {
            await this.rosterManagementService.setMember({
              teamSeasonId: rosterTeamSeasonId,
              playerId: pId,
              status: "ACTIVE",
              jersey,
              primaryPosition: position
            });
          }

          DataStore.isLoaded = false;
          await DataStore.init(activeTeamId, true);
          this.hideSyncOverlay();
          alert("✅ Jugador actualizado correctamente.");
          container.querySelector("#modal-edit-player").style.display = "none";
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error actualizando jugador:", err);
          alert(`❌ Error al actualizar jugador: ${err.message}`);
        }
      });
    }

    // 5B. ALTA/BAJA DE JUGADOR EN LA TEMPORADA ACTIVA
    container.querySelectorAll(".btn-remove-player-season").forEach(btn => {
      btn.addEventListener("click", async () => {
        const playerId = btn.getAttribute("data-id");
        const player = players.find(p => String(p.id) === String(playerId));
        if (!player || !rosterTeamSeasonId || !rosterRemovalReady) return;

        if (!this.auth?.can?.(Permission.MANAGE_ROSTER, {
          teamId: activeTeamId,
          teamSeasonId: rosterTeamSeasonId
        })) {
          alert("⚠️ No tienes permiso para modificar esta plantilla.");
          return;
        }

        const playerName = [player.first_name, player.last_name].filter(Boolean).join(" ") || player.name || "este jugador";
        if (!confirm(
          `Quitar a ${playerName} de ${rosterContextName}?\n\n`
          + "Si solo fue heredado de la temporada anterior y todavía no participó, se excluirá sin crear un historial falso. "
          + "Si ya participó, se conservarán todos sus datos y se cerrará su periodo de elegibilidad."
        )) return;

        const requestedLastDate = prompt(
          "Último día en que el jugador puede participar en esta temporada (AAAA-MM-DD):",
          rosterReferenceDate || ""
        );
        if (requestedLastDate === null) return;
        const lastEligibleDate = normalizeIsoDate(requestedLastDate);
        if (!lastEligibleDate) {
          alert("⚠️ Introduce una fecha válida con formato AAAA-MM-DD.");
          return;
        }
        if (!isDateInsideSeason(lastEligibleDate, rosterSeasonContext)) {
          alert("⚠️ El último día elegible debe estar dentro de las fechas de la temporada.");
          return;
        }

        this.showSyncOverlay("💾 Actualizando plantilla de la temporada...");
        try {
          await this.rosterManagementService.removePlayer({
            teamSeasonId: rosterTeamSeasonId,
            playerId,
            lastEligibleDate
          });
          DataStore.isLoaded = false;
          await DataStore.init(activeTeamId, true);
          this.rosterState = await this.rosterManagementService.loadForTeam(activeTeamId);
          this.hideSyncOverlay();
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error quitando jugador de temporada:", err);
          alert(`❌ No se pudo quitar al jugador de esta temporada: ${err.message || err}`);
        }
      });
    });

    container.querySelectorAll(".btn-reactivate-player-season").forEach(btn => {
      btn.addEventListener("click", async () => {
        const playerId = btn.getAttribute("data-id");
        if (!playerId || !rosterTeamSeasonId || !rosterBackendReady) return;

        if (!this.auth?.can?.(Permission.MANAGE_ROSTER, {
          teamId: activeTeamId,
          teamSeasonId: rosterTeamSeasonId
        })) {
          alert("⚠️ No tienes permiso para modificar esta plantilla.");
          return;
        }

        const player = [...historicalRosterPlayers, ...availableRosterPlayers]
          .find(item => String(item.id) === String(playerId));
        const earliestRejoinDate = player?.rosterLastUntil
          ? shiftIsoDate(player.rosterLastUntil, 1)
          : null;
        const suggestedRejoinDate = maxIsoDate(rosterReferenceDate, earliestRejoinDate)
          || rosterReferenceDate
          || "";

        const requestedFirstDate = prompt(
          "Primer día en que el jugador puede participar en esta temporada (AAAA-MM-DD):",
          suggestedRejoinDate
        );
        if (requestedFirstDate === null) return;
        const firstEligibleDate = normalizeIsoDate(requestedFirstDate);
        if (!firstEligibleDate) {
          alert("⚠️ Introduce una fecha válida con formato AAAA-MM-DD.");
          return;
        }
        if (!isDateInsideSeason(firstEligibleDate, rosterSeasonContext)) {
          alert("⚠️ El primer día elegible debe estar dentro de las fechas de la temporada.");
          return;
        }
        if (player?.rosterLastUntil && firstEligibleDate <= player.rosterLastUntil) {
          alert(`⚠️ La reincorporación debe ser posterior al último periodo cerrado (${player.rosterLastUntil}).`);
          return;
        }

        this.showSyncOverlay("💾 Añadiendo jugador a la temporada...");
        try {
          await this.rosterManagementService.reactivatePlayer({
            teamSeasonId: rosterTeamSeasonId,
            playerId,
            firstEligibleDate
          });
          DataStore.isLoaded = false;
          await DataStore.init(activeTeamId, true);
          this.rosterState = await this.rosterManagementService.loadForTeam(activeTeamId);
          this.hideSyncOverlay();
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error reactivando jugador en temporada:", err);
          alert(`❌ No se pudo añadir al jugador a esta temporada: ${err.message || err}`);
        }
      });
    });

    // 6. MERCADO DE FICHAJES (MODAL Y TABLA)
    container.querySelector("#btn-open-market-modal")?.addEventListener("click", async () => {
      this.showSyncOverlay("⚡ Cargando jugadores elegibles de la temporada...");
      try {
        await this._fetchAllMarketPlayers(true);
        const modal = container.querySelector("#modal-market-global");
        if (modal) {
          modal.style.display = "flex";
          this._renderMarketTable(container);
        }
      } catch (error) {
        console.error("Error cargando directorio seguro de traspasos:", error);
        alert(`❌ No se pudo cargar el mercado de esta temporada: ${error.message || error}`);
      } finally {
        this.hideSyncOverlay();
      }
    });

    container.querySelector("#btn-close-market-modal")?.addEventListener("click", () => {
      const modal = container.querySelector("#modal-market-global");
      if (modal) modal.style.display = "none";
    });

    container.querySelector("#input-market-search")?.addEventListener("input", (e) => {
      this.marketSearchQuery = e.target.value;
      this.marketCurrentPage = 1;
      this._renderMarketTable(container);
    });

    // BINDING FICHA TÉCNICA DE USUARIO Y ASIGNACIÓN MULTIEQUIPO
    const renderUserCardContent = (userProf) => {
      const modalContent = container.querySelector("#user-card-modal-content");
      if (!modalContent) return;

      const userAssignedTeamIds = this.userTeamAssignments[userProf.email] || [];
      const userPendingRequests = this.joinRequests.filter(r => r.userEmail === userProf.email && r.status === 'PENDIENTE');

      modalContent.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          
          <div style="background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h4 style="margin: 0; font-size: 15px; color: #0f172a;">${(userProf.first_name || '') + ' ' + (userProf.last_name || '') || 'Sin Nombre'}</h4>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">${userProf.email}</p>
            </div>
            <span class="badge-active-team">${userProf.role || 'INVITADO'}</span>
          </div>

          ${userPendingRequests.length > 0 ? `
            <div style="background: #fff7ed; border: 1px solid #ffedd5; padding: 12px; border-radius: 8px;">
              <h5 style="margin: 0 0 8px 0; font-size: 12px; color: #c2410c;">📩 SOLICITUDES PENDIENTES DE ESTE USUARIO:</h5>
              ${userPendingRequests.map(r => `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 6px;">
                  <span>Solicita acceso a: <strong>${r.teamName || 'Equipo'}</strong></span>
                  <button type="button" class="btn-approve-join-req btn-secondary-sm" data-id="${r.id}" data-email="${r.userEmail}" data-team-id="${r.teamId}" style="background: #16a34a; color: white;">🟢 Aprobar</button>
                </div>
              `).join("")}
            </div>
          ` : ''}

          <form id="form-save-user-teams-assignment">
            <h5 style="margin: 0 0 10px 0; font-size: 13px; color: #1e3a8a;">🛡️ EQUIPOS PERMITIDOS / ASIGNADOS:</h5>
            
            <div style="max-height: 220px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
              ${realTeams.map(t => {
                const isChecked = userAssignedTeamIds.includes(String(t.id));
                return `
                  <label style="display: flex; align-items: center; gap: 10px; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" class="chk-assign-team" value="${t.id}" ${isChecked ? 'checked' : ''} />
                    <span><strong>${t.name}</strong> (${t.category || 'Equipo'})</span>
                  </label>
                `;
              }).join("")}
            </div>

            <div style="margin-top: 16px; text-align: right;">
              <button type="submit" class="btn-primary">💾 Guardar Asignación de Equipos</button>
            </div>
          </form>

        </div>
      `;

      modalContent.querySelectorAll(".btn-approve-join-req").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          if (!this.auth?.can?.(Permission.APPROVE_TEAM_ACCESS)) return alert("⚠️ No tienes permiso para aprobar accesos.");
          const reqId = e.currentTarget.getAttribute("data-id");
          const email = e.currentTarget.getAttribute("data-email");
          const teamId = e.currentTarget.getAttribute("data-team-id");

          try {
            await this._reviewTeamAccess(reqId, true);
          } catch (err) {
            return alert(`❌ No se pudo conceder el acceso: ${err.message}`);
          }

          alert(`🟢 Solicitud aprobada. Se ha concedido acceso a ${email}.`);
          container.querySelector("#modal-user-card").style.display = "none";
          this.render(containerId);
        });
      });

      modalContent.querySelector("#form-save-user-teams-assignment")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!this.auth?.can?.(Permission.APPROVE_TEAM_ACCESS)) {
          alert("⚠️ No tienes permiso para asignar equipos.");
          return;
        }
        const selectedIds = [];
        modalContent.querySelectorAll(".chk-assign-team:checked").forEach(chk => {
          selectedIds.push(chk.value);
        });

        try {
          await this._persistUserTeamAssignments(userProf.email, selectedIds);
        } catch (err) {
          alert(`❌ No se pudo guardar la asignación: ${err.message}`);
          return;
        }

        alert(`✅ Equipos actualizados correctamente para ${userProf.email}.`);
        container.querySelector("#modal-user-card").style.display = "none";
        this.render(containerId);
      });
    };

    // APROBACIÓN / RECHAZO DESDE LA TARJETA PRINCIPAL DE AVISOS DE ADHESIÓN
    container.querySelectorAll(".btn-approve-join-req").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const reqId = e.currentTarget.getAttribute("data-id");
        const email = e.currentTarget.getAttribute("data-email");
        const teamId = e.currentTarget.getAttribute("data-team-id");
        if (!this.auth?.can?.(Permission.APPROVE_TEAM_ACCESS, { teamId })) {
          alert("⚠️ No tienes permiso para aprobar accesos a este equipo.");
          return;
        }

        try {
          await this._reviewTeamAccess(reqId, true);
        } catch (err) {
          alert(`❌ No se pudo conceder el acceso: ${err.message}`);
          return;
        }

        alert(`🟢 Solicitud aprobada. Se ha concedido acceso al equipo a ${email}.`);
        await this.render(containerId);
      });
    });

    container.querySelectorAll(".btn-reject-join-req").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const reqId = e.currentTarget.getAttribute("data-id");
        if (!this.auth?.can?.(Permission.APPROVE_TEAM_ACCESS)) {
          alert("⚠️ No tienes permiso para rechazar solicitudes.");
          return;
        }

        try {
          await this._reviewTeamAccess(reqId, false);
        } catch (err) {
          alert(`❌ No se pudo rechazar la solicitud: ${err.message}`);
          return;
        }

        alert("🔴 Solicitud de adhesión rechazada.");
        await this.render(containerId);
      });
    });

    container.querySelectorAll(".btn-open-user-card").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const email = e.currentTarget.getAttribute("data-email");
        const userProf = this.profilesList.find(p => p.email === email);

        if (userProf) {
          const modal = container.querySelector("#modal-user-card");
          if (modal) {
            modal.style.display = "flex";
            renderUserCardContent(userProf);
          }
        }
      });
    });

    container.querySelector("#btn-close-user-card-modal")?.addEventListener("click", () => {
      const modal = container.querySelector("#modal-user-card");
      if (modal) modal.style.display = "none";
    });

    // Selector de Equipo Activo en Pantalla (Invitado / Jugador)
    container.querySelector("#select-guest-active-team")?.addEventListener("change", async (e) => {
      const newTeamId = e.target.value;
      if (!newTeamId) return;

      localStorage.setItem("iq_active_team_id", newTeamId);
      DataStore.isLoaded = false;
      await DataStore.init(newTeamId, true);
      alert("🟢 Equipo seleccionado como activo.");
      if (window.iqApp) {
        window.iqApp.teamId = newTeamId;
        await window.iqApp.render();
      }
    });

    // Selector de Temporada Activa en Pantalla (Invitado / Jugador)
    container.querySelector("#select-guest-active-season")?.addEventListener("change", async (e) => {
      const newSeason = e.target.value;
      if (!newSeason) return;

      if (typeof DataStore.setActiveTeamAndSeason === "function") {
        DataStore.setActiveTeamAndSeason(null, newSeason);
      }
      localStorage.setItem("iq_active_season", newSeason);
      DataStore.isLoaded = false;
      await DataStore.init(activeTeamId, true);

      const label = e.target.options[e.target.selectedIndex]?.textContent || newSeason;
      alert(`🟢 Temporada ${label} seleccionada.`);
      if (window.iqApp) await window.iqApp.render();
    });

    // Evento Solicitar unirse a equipo
    container.querySelectorAll(".btn-request-join-team").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const teamId = e.currentTarget.getAttribute("data-id");
        const teamName = e.currentTarget.getAttribute("data-name");

        try {
          await this._requestTeamAccess(teamId);
          alert(`✉️ Solicitud enviada correctamente para unirse a ${teamName}. La solicitud ya es visible para los administradores autorizados y el Superadmin.`);
          await this.render(containerId);
        } catch (err) {
          alert(`❌ No se pudo registrar la solicitud: ${err.message}`);
        }
      });
    });

    // ALTA DE USUARIO E INVITACIÓN DIRECTA (SUPABASE AUTH + USER_PROFILES)
    const formCreateUser = container.querySelector("#form-create-user-profile");
    if (formCreateUser) {
      formCreateUser.addEventListener("submit", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const fullName = container.querySelector("#new-user-name")?.value.trim() || "";
        const email = container.querySelector("#new-user-email")?.value.trim();
        const role = container.querySelector("#new-user-role")?.value || UserRole.ENTRENADOR;
        const tempPassword = container.querySelector("#new-user-pass")?.value || "";

        if (!fullName || !email || !tempPassword) {
          alert("⚠️ Completa los campos obligatorios para dar de alta al usuario.");
          return;
        }
        if (!this.auth?.can?.(Permission.INVITE_USERS)) {
          alert("⚠️ No tienes permiso para invitar usuarios.");
          return;
        }
        if (!this.auth?.canAssignRole?.(role, email)) {
          alert("⚠️ No tienes permiso para asignar ese rol. Solo scolado@nechigroup.com puede ser Superadmin.");
          return;
        }

        const nameParts = fullName.split(" ");
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ");

        this.showSyncOverlay("⚡ Registrando usuario en la Base de Datos IQB...");

        try {
          if (!supabase) throw new Error("Cliente Supabase no configurado");
          const activeTeam = DataStore.getTeamById(activeTeamId);
          const { data: functionData, error: functionError } = await supabase.functions.invoke("admin-users", {
            body: {
              action: "create-user",
              email,
              password: tempPassword,
              firstName,
              lastName,
              role,
              clubId: activeTeam?.club_id || activeTeam?.clubId || null,
              teamIds: activeTeamId ? [activeTeamId] : []
            }
          });

          if (functionError || functionData?.error) {
            this.hideSyncOverlay();
            alert(`❌ Error al crear usuario: ${functionData?.error || functionError?.message || "Error desconocido"}`);
            return;
          }

          await this._fetchProfiles();
          this.hideSyncOverlay();

          alert(`✅ Usuario "${fullName}" (${role}) registrado con éxito.`);
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error creando usuario:", err);
          alert(`❌ Error al conectar con Supabase: ${err.message}`);
        }
      });
    }

    // GUARDAR ROL DE USUARIO EN USER_PROFILES
    container.querySelectorAll(".btn-save-user-role").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const userId = e.currentTarget.getAttribute("data-id");
        const selectEl = container.querySelector(`.select-user-role[data-id="${userId}"]`);
        if (!selectEl) return;

        const newRole = selectEl.value;
        const userObj = this.profilesList.find(p => String(p.id) === String(userId));
        const activeUserEmail = this.auth?.getCurrentUser?.()?.email || "";
        if (!userObj) return;
        if (String(userObj.email || "").toLowerCase() === String(activeUserEmail).toLowerCase()) {
          alert("⚠️ No puedes modificar tu propio rol.");
          return;
        }
        if (!this.auth?.canAssignRole?.(newRole, userObj.email)) {
          alert("⚠️ No tienes permiso para asignar ese rol.");
          return;
        }
        this.showSyncOverlay("💾 Actualizando rol del usuario...");

        try {
          if (!supabase) throw new Error("Cliente Supabase no configurado");
          const { error } = await supabase
            .from("user_profiles")
            .update({ role: newRole })
            .eq("id", userId);

          if (error) {
            this.hideSyncOverlay();
            alert(`❌ Error actualizando rol: ${error.message}`);
            return;
          }

          if (userObj) {
            userObj.role = newRole;
          }

          this.hideSyncOverlay();
          alert(`✅ Rol actualizado a "${newRole}" correctamente.`);
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error al actualizar rol:", err);
          alert(`❌ Error al conectar con Supabase: ${err.message}`);
        }
      });
    });

    // APROBAR Y RECHAZAR TRASPASOS
    container.querySelectorAll(".btn-approve-transfer").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const trId = e.currentTarget.getAttribute("data-id");
        const targetTeamId = e.currentTarget.getAttribute("data-target-team");
        if (!this.auth?.can?.(Permission.APPROVE_TRANSFER, { teamId: targetTeamId })) {
          alert("⚠️ No tienes permiso para aprobar este traspaso.");
          return;
        }

        try {
          const [rosterCapabilities, requestCapabilities] = await Promise.all([
            this.rosterManagementService.getCapabilities(),
            this.transferRequestService.getCapabilities()
          ]);

          if (!rosterCapabilities?.ready || !rosterCapabilities?.supports_multiple_stints) {
            throw new Error("El backend temporal de traspasos todavía no está aplicado.");
          }
          if (!requestCapabilities?.ready || !requestCapabilities?.persistent_requests) {
            throw new Error("El backend persistente de solicitudes de traspaso todavía no está aplicado.");
          }

          if (this.auth?.getAuthenticatedRole?.() !== UserRole.SUPERADMIN) {
            throw new Error("Los traspasos entre equipos están restringidos temporalmente al SUPERADMIN hasta implantar la aprobación doble origen/destino.");
          }

          const transferObj = this.transfers.find(t => String(t.id) === String(trId));
          if (!transferObj?.id) {
            throw new Error("La solicitud ya no está pendiente o no se pudo recuperar.");
          }

          const defaultFirstDateTo = maxIsoDate(
            rosterReferenceDate || todayLocalIsoDate(),
            rosterSeasonBounds.start ? shiftIsoDate(rosterSeasonBounds.start, 1) : null
          );
          const defaultLastDateFrom = shiftIsoDate(defaultFirstDateTo, -1);

          const requestedLastDateFrom = prompt(
            "Último día elegible en el equipo de origen (AAAA-MM-DD):",
            defaultLastDateFrom || ""
          );
          if (requestedLastDateFrom === null) return;
          const lastDateFrom = normalizeIsoDate(requestedLastDateFrom);

          const requestedFirstDateTo = prompt(
            "Primer día elegible en el equipo de destino (AAAA-MM-DD):",
            defaultFirstDateTo
          );
          if (requestedFirstDateTo === null) return;
          const firstDateTo = normalizeIsoDate(requestedFirstDateTo);

          if (!lastDateFrom || !firstDateTo) {
            alert("⚠️ Las dos fechas del traspaso deben tener formato AAAA-MM-DD.");
            return;
          }
          if (!isDateInsideSeason(lastDateFrom, rosterSeasonContext)
              || !isDateInsideSeason(firstDateTo, rosterSeasonContext)) {
            alert("⚠️ Las fechas de salida y alta deben estar dentro de la temporada.");
            return;
          }
          if (firstDateTo <= lastDateFrom) {
            alert("⚠️ La fecha de alta en destino debe ser posterior al último día en origen.");
            return;
          }

          this.showSyncOverlay("⚡ Procesando traspaso temporal seguro...");

          await this.transferRequestService.approveTransfer({
            requestId: transferObj.id,
            lastDateFrom,
            firstDateTo
          });

          DataStore.isLoaded = false;
          await DataStore.init(activeTeamId, true);
          this.rosterState = await this.rosterManagementService.loadForTeam(activeTeamId);
          await this._refreshTransferRequests(this.rosterState?.teamSeasonId || null);
          this.hideSyncOverlay();

          alert(`🟢 Traspaso aprobado. Último día en origen: ${lastDateFrom}. Alta en destino: ${firstDateTo}.`);
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
        const requestId = e.currentTarget.getAttribute("data-id");
        const transferObj = this.transfers.find(
          item => String(item.id) === String(requestId)
        );
        const targetTeamId = transferObj?.targetTeamId || activeTeamId;

        if (!this.auth?.can?.(Permission.APPROVE_TRANSFER, { teamId: targetTeamId })) {
          alert("⚠️ No tienes permiso para rechazar este traspaso.");
          return;
        }
        if (!transferObj?.id) {
          alert("⚠️ La solicitud ya no está pendiente.");
          return;
        }

        const reason = prompt(
          "Motivo del rechazo (opcional):",
          ""
        );
        if (reason === null) return;

        this.showSyncOverlay("🛑 Registrando rechazo del traspaso...");
        try {
          await this.transferRequestService.rejectTransfer({
            requestId: transferObj.id,
            reason
          });
          await this._refreshTransferRequests(this.rosterState?.teamSeasonId || null);
          this.hideSyncOverlay();
          alert("🔴 Solicitud de traspaso rechazada.");
          await this.render(containerId);
        } catch (error) {
          this.hideSyncOverlay();
          console.error("Error rechazando traspaso:", error);
          alert(`❌ No se pudo rechazar el traspaso: ${error.message || error}`);
        }
      });
    });

    // ACTIVAR EQUIPO (ADMIN Y SUPERADMIN)
    container.querySelectorAll(".btn-set-active-team").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const teamId = e.currentTarget.getAttribute("data-id");
        if (!teamId) return;
        if (!this.auth?.can?.(Permission.SELECT_TEAM, { teamId })) {
          alert("⚠️ No tienes permiso para activar este equipo.");
          return;
        }

        this.showSyncOverlay("⚡ Activando equipo en el sistema...");

        try {
          localStorage.setItem("iq_active_team_id", teamId);
          if (typeof DataStore.setActiveTeamAndSeason === "function") {
            DataStore.setActiveTeamAndSeason(teamId, null);
          }
          DataStore.isLoaded = false;
          await DataStore.init(teamId, true);

          this.hideSyncOverlay();
          alert("🟢 Equipo activado correctamente.");

          if (window.iqApp && typeof window.iqApp.render === "function") {
            window.iqApp.teamId = teamId;
            await window.iqApp.render();
          } else {
            await this.render(containerId);
          }
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error al activar equipo:", err);
        }
      });
    });

    // GESTIÓN DE TEMPORADAS
    const formCreateSeason = container.querySelector("#form-create-season");
    if (formCreateSeason) {
      formCreateSeason.addEventListener("submit", async (e) => {
        e.preventDefault();
        const inputName = container.querySelector("#input-new-season-name");
        const seasonName = inputName?.value.trim();

        if (!seasonName) return;
        if (!this.auth?.can?.(Permission.MANAGE_SEASONS, { teamId: activeTeamId })) {
          alert("⚠️ No tienes permiso para crear temporadas en este equipo.");
          return;
        }

        this.showSyncOverlay("⚡ Registrando nueva temporada en Supabase...");

        try {
          if (!supabase) throw new Error("Cliente Supabase no configurado");
          const { data, error } = await supabase
            .from("seasons")
            .insert([{ name: seasonName, team_id: activeTeamId }])
            .select().single();

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
          alert(`✅ Temporada "${seasonName}" creada con éxito.`);
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          console.error("Error creando temporada:", err);
        }
      });
    }

    container.querySelectorAll(".btn-save-season-name").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        const inp = container.querySelector(`.input-season-edit[data-id="${id}"]`);
        const newName = inp?.value.trim();
        if (!newName) return;
        if (!this.auth?.can?.(Permission.MANAGE_SEASONS, { teamId: activeTeamId })) {
          alert("⚠️ No tienes permiso para modificar temporadas.");
          return;
        }

        this.showSyncOverlay("💾 Actualizando temporada...");
        try {
          if (!supabase) throw new Error("Supabase no configurado");
          await supabase.from("seasons").update({ name: newName }).eq("id", id);
          const sObj = this.seasonsList.find(s => String(s.id) === String(id));
          if (sObj) sObj.name = newName;
          this._saveSeasonsLocal();
          this.hideSyncOverlay();
          alert("✅ Nombre de temporada actualizado.");
          await this.render(containerId);
        } catch (err) {
          this.hideSyncOverlay();
          alert(`❌ Error: ${err.message}`);
        }
      });
    });

    container.querySelectorAll(".btn-activate-season").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const name = e.currentTarget.getAttribute("data-name");
        localStorage.setItem("iq_active_season", name);
        if (typeof DataStore.setActiveTeamAndSeason === "function") {
          DataStore.setActiveTeamAndSeason(null, name);
        }
        alert(`🟢 Temporada "${name}" activada.`);
        await this.render(containerId);
      });
    });

    container.querySelectorAll(".btn-delete-season").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const seasonId = e.currentTarget.getAttribute("data-id");
        if (!this._canReal("DELETE_SEASON")) {
          alert("⚠️ Solo el Superadmin puede eliminar temporadas.");
          return;
        }
        if (confirm("⚠️ ¿Estás seguro de eliminar esta temporada de Supabase?")) {
          this.showSyncOverlay("🗑️ Eliminando temporada en Supabase...");
          try {
            if (!supabase) throw new Error("Cliente Supabase no configurado");
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

    if (this.activeTab === "seasons") {
      this.seasonManagementView.bindEvents(container, {
        onBackendUnavailable: () => {
          alert("ℹ️ Esta acción no está disponible para tu rol o el backend seguro no está activo.");
        },
        onChanged: async () => {
          await this.render(containerId);
        },
        onError: (error) => {
          alert(`❌ No se pudo completar la operación: ${error?.message || error}`);
        }
      });
    }

    // PESTAÑA IDIOMAS: GUARDAR EN SUPABASE
    if (this.activeTab === "translations") {
      this.languageSettingsView.bindEvents(container);

      container.querySelectorAll("button, .btn-primary, .btn-save-translations").forEach(btn => {
        if (btn.textContent.includes("Guardar Traducciones")) {
          btn.addEventListener("click", async (e) => {
            e.preventDefault();
            if (!this.auth?.can?.(Permission.MANAGE_TRANSLATIONS)) {
              alert("⚠️ No tienes permiso para modificar traducciones.");
              return;
            }
            this.showSyncOverlay("💾 Guardando diccionario completo en Supabase...");
            try {
              if (TranslationStore && typeof TranslationStore.saveAllToSupabase === "function") {
                await TranslationStore.saveAllToSupabase();
              }
              this.hideSyncOverlay();
              alert("✅ ¡Traducciones guardadas exitosamente en la base de datos!");
            } catch (err) {
              this.hideSyncOverlay();
              console.error("Error guardando traducciones:", err);
              alert(`❌ Error al guardar traducciones: ${err.message || err}`);
            }
          });
        }
      });
    }

    // SIMULACIÓN DE ROLES (EXCLUSIVO SUPERADMIN)
    container.querySelectorAll(".btn-simulate-role").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const roleToSimulate = e.currentTarget.getAttribute("data-role");
        
        if (!this.auth?.setPreviewRole?.(roleToSimulate)) {
          alert("⚠️ Solo el Superadmin puede simular roles.");
          return;
        }
        this.simulatedRole = this.auth.previewRole;
        localStorage.setItem("iq_simulated_role", roleToSimulate);

        alert(`🎭 Simulación activada: La app muestra la interfaz de '${roleToSimulate}'.`);
        await this.render(containerId);
      });
    });

    const resetSimBtn = container.querySelector("#btn-reset-simulation") || container.querySelector("#btn-stop-simulation");
    if (resetSimBtn) {
      resetSimBtn.addEventListener("click", async () => {
        this.auth?.clearPreviewRole?.();
        this.simulatedRole = null;
        this.currentUserRole = this.auth?.getAuthenticatedRole?.() || UserRole.INVITADO;
        localStorage.removeItem("iq_simulated_role");

        alert("🔴 Simulación desactivada. Volviendo a control total de SUPERADMIN.");
        await this.render(containerId);
      });
    }

    if (canModifyActiveRole) {
      container.querySelector("#select-demo-role")?.addEventListener("change", async (e) => {
        const previewRole = e.target.value;
        if (!this.auth?.setPreviewRole?.(previewRole)) return;
        this.simulatedRole = this.auth.previewRole;
        localStorage.setItem("iq_simulated_role", previewRole);
        await this.render(containerId);
      });
    }
  }
}

export default TranslationsView;