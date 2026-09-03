/**
 * @fileoverview Subvista modular para Configuración > Temporadas.
 * @description Gestiona temporada global, vínculo equipo-temporada y staff v3.
 * Todas las escrituras pasan por RPC seguros; no escribe tablas directamente.
 */

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatSeasonName(value = "") {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})\s*[-\/]\s*(\d{4})$/);
  return match ? `${match[1]}/${match[2]}` : raw;
}

function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

const STAFF_LABELS = Object.freeze({
  HEAD_COACH: "Entrenador principal",
  ASSISTANT_COACH: "Ayudante",
  ANALYST: "Analista",
  PHYSICAL_TRAINER: "Preparador físico",
  TEAM_MANAGER: "Delegado / Team manager"
});

export class SeasonManagementView {
  constructor(service, authController = null, freezeService = null) {
    this.service = service;
    this.auth = authController;
    this.freezeService = freezeService;
    this.freezeCapabilities = { ready: false };
    this.freezeRequests = [];
    this.state = null;
  }

  async load() {
    const [state, freezeCapabilities] = await Promise.all([
      this.service.loadOverview(),
      this.freezeService?.getCapabilities?.() || Promise.resolve({ ready: false })
    ]);

    this.state = state;
    this.freezeCapabilities = freezeCapabilities || { ready: false };
    this.freezeRequests = [];

    if (this.freezeCapabilities.ready && this.freezeService?.listRequests) {
      try {
        const scopeIds = (this.state?.teamSeasons || []).map(scope => scope.id).filter(Boolean);
        this.freezeRequests = scopeIds.length
          ? await this.freezeService.listRequests(scopeIds, { status: "PENDING" })
          : [];
      } catch (error) {
        console.warn("[SeasonManagementView] No se pudieron cargar solicitudes de cierre:", error?.message || error);
        this.freezeRequests = [];
      }
    }

    return this.state;
  }

  _hasPendingFreezeRequest(teamSeasonId) {
    return this.freezeRequests.some(request =>
      String(request.team_season_id || request.teamSeasonId || "") === String(teamSeasonId || "")
      && String(request.status || "").toUpperCase() === "PENDING"
    );
  }

  _getActiveStaff(teamSeasonId) {
    return (this.state?.staffAssignments || []).filter(
      assignment =>
        String(assignment.team_season_id) === String(teamSeasonId)
        && String(assignment.status || "ACTIVE").toUpperCase() === "ACTIVE"
    );
  }

  _staffDisplayName(assignment) {
    if (!assignment) return "";
    if (assignment.user_id) {
      const user = this.state?.usersById?.get(String(assignment.user_id));
      if (user) {
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
        return fullName || user.email || "Usuario";
      }
    }
    return assignment.external_name || "Sin asignar";
  }

  _renderStaffGrid(scope) {
    const staff = this._getActiveStaff(scope.id);
    return Object.entries(STAFF_LABELS).map(([role, label]) => {
      const assignments = staff.filter(row => row.staff_role === role);
      const names = assignments.map(row => this._staffDisplayName(row)).filter(Boolean);
      return `
        <div style="padding:10px;background:#f8fafc;border-radius:8px;">
          <div style="font-size:10px;font-weight:800;color:#64748b;">${escapeHtml(label.toUpperCase())}</div>
          <div style="margin-top:4px;font-size:${role === "HEAD_COACH" ? "13px" : "12px"};font-weight:${role === "HEAD_COACH" ? "800" : "700"};color:#0f172a;">
            ${escapeHtml(names.join(", ") || "Sin asignar")}
          </div>
          ${assignments.some(row => row.user_id)
            ? '<div style="font-size:9px;color:#15803d;margin-top:3px;">Usuario vinculado a IQBasket</div>'
            : assignments.length > 0
              ? '<div style="font-size:9px;color:#64748b;margin-top:3px;">Staff externo · sin acceso automático</div>'
              : ''}
        </div>
      `;
    }).join("");
  }

  renderMarkup({ activeTeamId = null, canManage = false } = {}) {
    const state = this.state || {
      capabilities: { ready: false },
      seasons: [],
      teamSeasons: [],
      teams: [],
      staffAssignments: [],
      usersById: new Map()
    };

    const backendReady = Boolean(state.capabilities?.ready);
    const canWriteContext = Boolean(canManage && backendReady);
    const canWriteGlobal = Boolean(canManage && backendReady && state.capabilities?.global_season_write);
    const freezeReady = Boolean(this.freezeCapabilities?.ready);
    const teamsById = new Map((state.teams || []).map(team => [String(team.id), team]));

    return `
      <div class="config-container season-management-v3">
        <div class="config-card" style="border:1px solid #bbf7d0;background:#f0fdf4;">
          <div class="card-title" style="margin-bottom:8px;color:#166534;"><span>✅</span> TEMPORADAS V3 ACTIVAS</div>
          <div style="font-size:12px;color:#334155;line-height:1.55;">
            Una temporada se crea una sola vez y se vincula a los equipos que participan en ella.
            Entrenadores y resto del staff se asignan específicamente a <strong>Equipo + Temporada</strong>.
          </div>
          <div style="margin-top:10px;font-size:11px;font-weight:800;color:${backendReady ? '#15803d' : '#b45309'};">
            ${backendReady
              ? '✅ Backend seguro disponible · escrituras mediante RPC.'
              : '🟡 Modo lectura · backend de gestión no disponible.'}
          </div>
        </div>

        <div class="config-card">
          <div class="card-title"><span>📅</span> TEMPORADAS GLOBALES (${state.seasons.length})</div>

          ${state.seasons.length > 0 ? state.seasons.map(season => {
            const linkedScopes = state.teamSeasons.filter(
              scope => String(scope.season_id) === String(season.id)
            );
            const linkedTeamIds = new Set(linkedScopes.map(scope => String(scope.team_id)));
            const availableTeams = (state.teams || []).filter(team => !linkedTeamIds.has(String(team.id)));

            return `
              <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:12px;background:#fff;">
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
                  <div>
                    <div style="font-size:16px;font-weight:900;color:#0f172a;">${escapeHtml(formatSeasonName(season.name))}</div>
                    <div style="font-size:11px;color:#64748b;margin-top:3px;">
                      Código: ${escapeHtml(season.code)}
                      ${season.start_date || season.end_date
                        ? ` · ${escapeHtml(formatDate(season.start_date) || "—")} → ${escapeHtml(formatDate(season.end_date) || "—")}`
                        : ''}
                      · ${linkedScopes.length} equipo(s)
                    </div>
                  </div>

                  <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;">
                    <span class="${String(season.status).toUpperCase() === 'ACTIVE' ? 'badge-active-team' : 'badge-inactive'}">
                      ${escapeHtml(season.status || "ACTIVE")}
                    </span>
                    ${canWriteGlobal ? `
                      <button type="button"
                        class="btn-outline-sm season-v3-action"
                        data-action="edit-season"
                        data-season-id="${season.id}">
                        ✏️ Editar
                      </button>
                    ` : ''}
                  </div>
                </div>

                <div style="margin-top:12px;">
                  <div style="font-size:10px;font-weight:800;color:#64748b;margin-bottom:6px;">EQUIPOS VINCULADOS</div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${linkedScopes.length
                      ? linkedScopes.map(scope => {
                          const team = teamsById.get(String(scope.team_id));
                          return `<span class="badge-category">${escapeHtml(team?.name || "Equipo")}</span>`;
                        }).join("")
                      : '<span style="font-size:11px;color:#94a3b8;">Todavía sin equipos vinculados</span>'}
                  </div>
                </div>

                ${canWriteGlobal && availableTeams.length > 0 ? `
                  <div style="margin-top:12px;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
                    <div class="form-group" style="min-width:220px;flex:1;">
                      <label>Vincular otro equipo</label>
                      <select class="season-link-team-select" data-season-id="${season.id}">
                        <option value="">Selecciona equipo…</option>
                        ${availableTeams.map(team => `
                          <option value="${team.id}">${escapeHtml(team.name)}</option>
                        `).join("")}
                      </select>
                    </div>
                    <button type="button"
                      class="btn-secondary-sm season-v3-action"
                      data-action="link-team"
                      data-season-id="${season.id}">
                      + Vincular
                    </button>
                  </div>
                ` : ''}
              </div>
            `;
          }).join("") : '<p style="font-size:12px;color:#64748b;">No hay temporadas globales registradas.</p>'}

          ${canManage ? `
            <div style="margin-top:14px;border-top:1px solid #e2e8f0;padding-top:14px;">
              <button type="button"
                class="btn-primary season-v3-action"
                data-action="create-season"
                ${canWriteGlobal ? '' : 'disabled'}
                style="${canWriteGlobal ? '' : 'opacity:.5;cursor:not-allowed;'}">
                + Nueva temporada global
              </button>
              ${canManage && !canWriteGlobal
                ? '<div style="font-size:10px;color:#64748b;margin-top:6px;">La creación y edición del catálogo global está reservada al SUPERADMIN.</div>'
                : ''}
            </div>
          ` : ''}
        </div>

        <div class="config-card">
          <div class="card-title"><span>🏀</span> EQUIPOS POR TEMPORADA</div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${state.teamSeasons.length > 0 ? state.teamSeasons.map(scope => {
              const team = teamsById.get(String(scope.team_id)) || {};
              const season = state.seasons.find(s => String(s.id) === String(scope.season_id)) || {};
              const isActiveTeam = String(scope.team_id) === String(activeTeamId || "");
              const active = String(scope.status || "ACTIVE").toUpperCase() === "ACTIVE";
              const frozen = Boolean(this.freezeService?.isFrozen?.(scope));
              const pendingFreeze = this._hasPendingFreezeRequest(scope.id);
              const canFreeze = Boolean(freezeReady && this.freezeService?.canFreeze?.(scope));
              const canReopen = Boolean(freezeReady && this.freezeService?.canReopen?.(scope));
              const canRequestFreeze = Boolean(
                freezeReady
                && !pendingFreeze
                && this.freezeService?.canRequestFreeze?.(scope)
              );

              return `
                <div style="border:1px solid ${isActiveTeam ? '#93c5fd' : '#e2e8f0'};border-radius:12px;padding:14px;background:${isActiveTeam ? '#eff6ff' : '#fff'};">
                  <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
                    <div>
                      <div style="font-size:14px;font-weight:900;color:#0f172a;">${escapeHtml(team.name || "Equipo")}</div>
                      <div style="font-size:11px;color:#64748b;margin-top:2px;">
                        ${escapeHtml(formatSeasonName(season.name || ""))}
                        ${team.category ? ` · ${escapeHtml(team.category)}` : ''}
                      </div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
                      <span class="${active ? 'badge-active-team' : 'badge-inactive'}">
                        ${escapeHtml(scope.status || "ACTIVE")}
                      </span>
                      <span style="padding:3px 8px;border-radius:6px;font-size:11px;font-weight:900;background:${frozen ? '#fee2e2' : '#dcfce7'};color:${frozen ? '#991b1b' : '#166534'};">
                        ${frozen ? '🔒 Datos cerrados' : '🟢 Datos abiertos'}
                      </span>
                      ${pendingFreeze ? '<span class="badge-pending">⏳ Cierre solicitado</span>' : ''}
                    </div>
                  </div>

                  <div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:${frozen ? '#fff1f2' : '#f8fafc'};border:1px solid ${frozen ? '#fecdd3' : '#e2e8f0'};">
                    <div style="font-size:11px;font-weight:900;color:${frozen ? '#9f1239' : '#334155'};">
                      ${frozen ? 'Temporada cerrada para edición competitiva' : 'Integridad de temporada'}
                    </div>
                    <div style="margin-top:3px;font-size:10px;line-height:1.5;color:#64748b;">
                      ${frozen
                        ? 'Partidos y plantilla quedan en modo histórico de solo lectura. Para corregir datos es obligatorio reabrir la temporada.'
                        : 'El cierre congela partidos y plantilla sin ocultar estadísticas, informes ni histórico.'}
                    </div>
                    ${freezeReady ? `
                      ${(canFreeze || canReopen || canRequestFreeze) ? `
                        <label style="display:grid;gap:4px;margin-top:9px;font-size:10px;font-weight:800;color:#475569;">
                          Motivo / nota de auditoría
                          <input type="text"
                            class="season-freeze-reason"
                            data-team-season-id="${scope.id}"
                            maxlength="240"
                            placeholder="${frozen ? 'Ej.: Corrección autorizada de datos' : 'Ej.: Temporada finalizada'}"
                            style="width:100%;min-height:44px;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font:inherit;">
                        </label>
                      ` : ''}
                      <div style="margin-top:9px;display:flex;gap:8px;flex-wrap:wrap;">
                        ${canFreeze ? `
                          <button type="button"
                            class="btn-danger-sm season-v3-action"
                            data-action="freeze-scope-data"
                            data-team-season-id="${scope.id}"
                            style="min-height:44px;font-weight:900;">
                            🔒 Cerrar temporada
                          </button>
                        ` : ''}
                        ${canReopen ? `
                          <button type="button"
                            class="btn-secondary-sm season-v3-action"
                            data-action="reopen-scope-data"
                            data-team-season-id="${scope.id}"
                            style="min-height:44px;font-weight:900;">
                            🔓 Reabrir temporada
                          </button>
                        ` : ''}
                        ${canRequestFreeze ? `
                          <button type="button"
                            class="btn-outline-sm season-v3-action"
                            data-action="request-freeze-scope-data"
                            data-team-season-id="${scope.id}"
                            style="min-height:44px;font-weight:900;">
                            📩 Solicitar cierre
                          </button>
                        ` : ''}
                      </div>
                    ` : '<div style="margin-top:6px;font-size:10px;color:#b45309;">Lifecycle V6 no disponible · modo lectura.</div>'}
                  </div>

                  <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;">
                    ${this._renderStaffGrid(scope)}
                  </div>

                  ${canManage ? `
                    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
                      <button type="button"
                        class="btn-secondary-sm season-v3-action"
                        data-action="manage-staff"
                        data-team-season-id="${scope.id}"
                        ${canWriteContext ? '' : 'disabled'}
                        style="${canWriteContext ? '' : 'opacity:.5;cursor:not-allowed;'}">
                        👥 Gestionar staff
                      </button>

                      <button type="button"
                        class="btn-outline-sm season-v3-action"
                        data-action="set-scope-status"
                        data-team-season-id="${scope.id}"
                        data-status="${active ? 'ARCHIVED' : 'ACTIVE'}"
                        ${canWriteContext ? '' : 'disabled'}
                        style="${canWriteContext ? '' : 'opacity:.5;cursor:not-allowed;'}">
                        ${active ? '📦 Archivar vínculo' : '↩️ Reactivar vínculo'}
                      </button>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join("") : '<p style="font-size:12px;color:#64748b;">No hay equipos vinculados a temporadas globales.</p>'}
          </div>
        </div>

        <div class="config-card" style="border:1px solid #e2e8f0;background:#f8fafc;">
          <div class="card-title"><span>🛡️</span> COMPATIBILIDAD Y SEGURIDAD</div>
          <p style="font-size:12px;color:#475569;line-height:1.55;margin:0;">
            IQBasket conserva temporalmente las columnas legacy como respaldo, pero esta pantalla utiliza
            <strong>season_catalog</strong>, <strong>team_seasons</strong> y <strong>team_season_staff_assignments</strong>
            como modelo operativo. No se eliminan históricos desde esta interfaz.
          </p>
        </div>

        <div id="season-v3-modal" class="season-v3-modal" style="display:none;">
          <div class="season-v3-modal-card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <div id="season-v3-modal-title" style="font-size:16px;font-weight:900;color:#0f172a;">Temporada</div>
              <button type="button" class="btn-outline-sm" data-action="close-season-modal">✕</button>
            </div>
            <form id="season-v3-form" style="margin-top:14px;">
              <input type="hidden" id="season-v3-id">
              <div class="grid-2-cols">
                <div class="form-group">
                  <label>Código</label>
                  <input id="season-v3-code" required placeholder="2026-2027">
                </div>
                <div class="form-group">
                  <label>Nombre visible</label>
                  <input id="season-v3-name" required placeholder="2026/2027">
                </div>
                <div class="form-group">
                  <label>Inicio</label>
                  <input id="season-v3-start" type="date">
                </div>
                <div class="form-group">
                  <label>Fin</label>
                  <input id="season-v3-end" type="date">
                </div>
                <div class="form-group">
                  <label>Estado</label>
                  <select id="season-v3-status">
                    <option value="ACTIVE">Activa</option>
                    <option value="INACTIVE">Inactiva</option>
                    <option value="ARCHIVED">Archivada</option>
                  </select>
                </div>
              </div>
              <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px;">
                <button type="button" class="btn-outline-sm" data-action="close-season-modal">Cancelar</button>
                <button type="submit" class="btn-primary">Guardar temporada</button>
              </div>
            </form>
          </div>
        </div>

        <div id="staff-v3-modal" class="season-v3-modal" style="display:none;">
          <div class="season-v3-modal-card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <div>
                <div style="font-size:16px;font-weight:900;color:#0f172a;">Gestionar staff</div>
                <div id="staff-v3-context-label" style="font-size:11px;color:#64748b;margin-top:2px;"></div>
              </div>
              <button type="button" class="btn-outline-sm" data-action="close-staff-modal">✕</button>
            </div>

            <div id="staff-v3-current" style="margin-top:14px;"></div>

            <form id="staff-v3-form" style="margin-top:14px;border-top:1px solid #e2e8f0;padding-top:14px;">
              <input type="hidden" id="staff-v3-team-season-id">
              <div class="grid-2-cols">
                <div class="form-group">
                  <label>Función</label>
                  <select id="staff-v3-role" required>
                    ${Object.entries(STAFF_LABELS).map(([role, label]) => `
                      <option value="${role}">${escapeHtml(label)}</option>
                    `).join("")}
                  </select>
                </div>
                <div class="form-group">
                  <label>Nombre</label>
                  <input id="staff-v3-name" required placeholder="Nombre y apellidos">
                </div>
              </div>
              <p style="font-size:10px;color:#64748b;margin:8px 0 0;">
                Este formulario registra staff externo. Si posteriormente se vincula una cuenta de usuario,
                el acceso se gestionará mediante su membresía contextual.
              </p>
              <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px;">
                <button type="button" class="btn-outline-sm" data-action="close-staff-modal">Cancelar</button>
                <button type="submit" class="btn-primary">Asignar</button>
              </div>
            </form>
          </div>
        </div>

        <style>
          .season-v3-modal {
            position: fixed;
            inset: 0;
            width: 100%;
            height: 100dvh;
            box-sizing: border-box;
            z-index: 10020;
            background: rgba(15, 23, 42, .52);
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            padding:
              max(10px, env(safe-area-inset-top))
              max(10px, env(safe-area-inset-right))
              max(12px, env(safe-area-inset-bottom))
              max(10px, env(safe-area-inset-left));
          }
          .season-v3-modal-card {
            width: min(680px, 100%);
            max-height: calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
            box-sizing: border-box;
            background: white;
            border-radius: 14px;
            padding: 18px;
            margin: auto;
            box-shadow: 0 18px 60px rgba(15, 23, 42, .24);
          }
          @media (max-width: 640px) {
            .season-v3-modal-card {
              width: 100%;
              margin: 0;
              padding: 14px;
              border-radius: 12px;
              max-height: calc(100dvh - 20px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
            }
          }
          .season-v3-staff-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            padding: 9px 0;
            border-bottom: 1px solid #e2e8f0;
          }
        </style>
      </div>
    `;
  }

  _openSeasonModal(container, season = null) {
    const modal = container.querySelector("#season-v3-modal");
    if (!modal) return;

    container.querySelector("#season-v3-modal-title").textContent =
      season ? "Editar temporada global" : "Nueva temporada global";
    container.querySelector("#season-v3-id").value = season?.id || "";
    container.querySelector("#season-v3-code").value = season?.code || "";
    container.querySelector("#season-v3-name").value = formatSeasonName(season?.name || "");
    container.querySelector("#season-v3-start").value = formatDate(season?.start_date);
    container.querySelector("#season-v3-end").value = formatDate(season?.end_date);
    container.querySelector("#season-v3-status").value = season?.status || "ACTIVE";
    modal.style.display = "flex";
  }

  _openStaffModal(container, teamSeasonId) {
    const modal = container.querySelector("#staff-v3-modal");
    if (!modal) return;

    const scope = (this.state?.teamSeasons || []).find(
      item => String(item.id) === String(teamSeasonId)
    );
    const team = (this.state?.teams || []).find(
      item => String(item.id) === String(scope?.team_id)
    );
    const season = (this.state?.seasons || []).find(
      item => String(item.id) === String(scope?.season_id)
    );

    container.querySelector("#staff-v3-team-season-id").value = teamSeasonId;
    container.querySelector("#staff-v3-context-label").textContent =
      `${team?.name || "Equipo"} · ${formatSeasonName(season?.name || "")}`;

    const staff = this._getActiveStaff(teamSeasonId);
    const current = container.querySelector("#staff-v3-current");
    current.innerHTML = staff.length
      ? staff.map(assignment => `
          <div class="season-v3-staff-row">
            <div>
              <div style="font-size:11px;font-weight:800;color:#64748b;">
                ${escapeHtml(STAFF_LABELS[assignment.staff_role] || assignment.staff_role)}
              </div>
              <div style="font-size:13px;font-weight:800;color:#0f172a;margin-top:2px;">
                ${escapeHtml(this._staffDisplayName(assignment))}
              </div>
            </div>
            <button type="button"
              class="btn-danger-sm season-v3-remove-staff"
              data-assignment-id="${assignment.id}">
              Quitar
            </button>
          </div>
        `).join("")
      : '<div style="font-size:12px;color:#64748b;">No hay staff asignado todavía.</div>';

    modal.style.display = "flex";
  }

  bindEvents(container, {
    onBackendUnavailable = null,
    onChanged = null,
    onError = null
  } = {}) {
    const fail = (error) => {
      console.error("[SeasonManagementView]", error);
      if (onError) onError(error);
      else alert(`❌ ${error?.message || error}`);
    };

    const refresh = async () => {
      await this.load();
      if (onChanged) await onChanged();
    };

    container.querySelectorAll(".season-v3-action[disabled]").forEach(button => {
      button.addEventListener("click", () => onBackendUnavailable?.());
    });

    container.querySelector('[data-action="create-season"]:not([disabled])')?.addEventListener("click", () => {
      this._openSeasonModal(container);
    });

    container.querySelectorAll('[data-action="edit-season"]').forEach(button => {
      button.addEventListener("click", () => {
        const season = (this.state?.seasons || []).find(
          item => String(item.id) === String(button.dataset.seasonId)
        );
        if (season) this._openSeasonModal(container, season);
      });
    });

    container.querySelectorAll('[data-action="close-season-modal"]').forEach(button => {
      button.addEventListener("click", () => {
        const modal = container.querySelector("#season-v3-modal");
        if (modal) modal.style.display = "none";
      });
    });

    container.querySelector("#season-v3-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const id = container.querySelector("#season-v3-id").value;
      const payload = {
        code: container.querySelector("#season-v3-code").value.trim(),
        name: container.querySelector("#season-v3-name").value.trim(),
        startDate: container.querySelector("#season-v3-start").value || null,
        endDate: container.querySelector("#season-v3-end").value || null,
        status: container.querySelector("#season-v3-status").value
      };

      try {
        if (id) {
          await this.service.updateGlobalSeason({ seasonId: id, ...payload });
        } else {
          await this.service.createGlobalSeason(payload);
        }
        await refresh();
      } catch (error) {
        fail(error);
      }
    });

    container.querySelectorAll('[data-action="link-team"]').forEach(button => {
      button.addEventListener("click", async () => {
        const seasonId = button.dataset.seasonId;
        const select = container.querySelector(
          `.season-link-team-select[data-season-id="${seasonId}"]`
        );
        const teamId = select?.value;
        if (!teamId) {
          alert("Selecciona primero un equipo.");
          return;
        }

        try {
          await this.service.linkTeamSeason({ teamId, seasonId });
          await refresh();
        } catch (error) {
          fail(error);
        }
      });
    });

    const readFreezeReason = (teamSeasonId) => String(
      container.querySelector(
        `.season-freeze-reason[data-team-season-id="${teamSeasonId}"]`
      )?.value || ""
    ).trim() || null;

    container.querySelectorAll('[data-action="request-freeze-scope-data"]').forEach(button => {
      button.addEventListener("click", async () => {
        const teamSeasonId = button.dataset.teamSeasonId;
        const reason = readFreezeReason(teamSeasonId);

        try {
          await this.freezeService.requestFreeze(teamSeasonId, reason);
          await refresh();
        } catch (error) {
          fail(error);
        }
      });
    });

    container.querySelectorAll('[data-action="freeze-scope-data"]').forEach(button => {
      button.addEventListener("click", async () => {
        const teamSeasonId = button.dataset.teamSeasonId;
        if (!confirm(
          "¿Cerrar esta temporada? Se bloquearán sus partidos abiertos y la plantilla quedará en modo histórico de solo lectura."
        )) return;

        try {
          await this.freezeService.setFrozen(
            teamSeasonId,
            true,
            readFreezeReason(teamSeasonId) || "Cierre de temporada"
          );
          await refresh();
        } catch (error) {
          fail(error);
        }
      });
    });

    container.querySelectorAll('[data-action="reopen-scope-data"]').forEach(button => {
      button.addEventListener("click", async () => {
        const teamSeasonId = button.dataset.teamSeasonId;
        if (!confirm(
          "¿Reabrir esta temporada para corregir datos? Sólo se reabrirán los partidos que fueron bloqueados por su cierre de temporada."
        )) return;

        try {
          await this.freezeService.setFrozen(
            teamSeasonId,
            false,
            readFreezeReason(teamSeasonId) || "Corrección autorizada"
          );
          await refresh();
        } catch (error) {
          fail(error);
        }
      });
    });

    container.querySelectorAll('[data-action="set-scope-status"]:not([disabled])').forEach(button => {
      button.addEventListener("click", async () => {
        const teamSeasonId = button.dataset.teamSeasonId;
        const status = button.dataset.status;
        const actionLabel = status === "ARCHIVED" ? "archivar" : "reactivar";
        if (!confirm(`¿Seguro que quieres ${actionLabel} este vínculo equipo-temporada?`)) return;

        try {
          await this.service.setTeamSeasonStatus({ teamSeasonId, status });
          await refresh();
        } catch (error) {
          fail(error);
        }
      });
    });

    container.querySelectorAll('[data-action="manage-staff"]:not([disabled])').forEach(button => {
      button.addEventListener("click", () => {
        this._openStaffModal(container, button.dataset.teamSeasonId);
      });
    });

    container.querySelectorAll('[data-action="close-staff-modal"]').forEach(button => {
      button.addEventListener("click", () => {
        const modal = container.querySelector("#staff-v3-modal");
        if (modal) modal.style.display = "none";
      });
    });

    container.querySelector("#staff-v3-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const teamSeasonId = container.querySelector("#staff-v3-team-season-id").value;
      const staffRole = container.querySelector("#staff-v3-role").value;
      const externalName = container.querySelector("#staff-v3-name").value.trim();

      if (!externalName) return;

      try {
        await this.service.assignStaff({
          teamSeasonId,
          staffRole,
          externalName
        });
        await refresh();
      } catch (error) {
        fail(error);
      }
    });

    container.querySelector("#staff-v3-current")?.addEventListener("click", async (event) => {
      const button = event.target.closest(".season-v3-remove-staff");
      if (!button) return;
      if (!confirm("¿Quitar esta asignación de staff de la temporada?")) return;

      try {
        await this.service.removeStaff({ assignmentId: button.dataset.assignmentId });
        await refresh();
      } catch (error) {
        fail(error);
      }
    });
  }
}

export default SeasonManagementView;
