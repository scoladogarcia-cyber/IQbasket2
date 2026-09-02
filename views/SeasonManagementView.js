/**
 * @fileoverview Subvista modular para Configuración > Temporadas.
 * @description Presenta el modelo v3 sin mezclarlo con la tabla legacy.
 * Las escrituras permanecen bloqueadas hasta instalar el backend RPC de Fase 3.
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

const STAFF_LABELS = Object.freeze({
  HEAD_COACH: "Entrenador principal",
  ASSISTANT_COACH: "Ayudante",
  ANALYST: "Analista",
  PHYSICAL_TRAINER: "Preparador físico",
  TEAM_MANAGER: "Delegado / Team manager"
});

export class SeasonManagementView {
  constructor(service, authController = null) {
    this.service = service;
    this.auth = authController;
    this.state = null;
  }

  async load() {
    this.state = await this.service.loadOverview();
    return this.state;
  }

  _getLegacyCoach(teamSeason) {
    const legacyId = teamSeason?.legacy_season_id;
    const row = (this.state?.legacySeasons || []).find(
      season => String(season.id) === String(legacyId || "")
    );
    return row?.coach_name || null;
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

  renderMarkup({ activeTeamId = null, canManage = false } = {}) {
    const state = this.state || {
      capabilities: { ready: false },
      seasons: [],
      teamSeasons: [],
      teams: [],
      staffAssignments: [],
      legacySeasons: [],
      usersById: new Map()
    };

    const backendReady = Boolean(state.capabilities?.ready);
    const canWrite = Boolean(canManage && backendReady);
    const teamsById = new Map((state.teams || []).map(team => [String(team.id), team]));

    return `
      <div class="config-container season-management-v3">
        <div class="config-card" style="border: 1px solid #bfdbfe; background: #eff6ff;">
          <div class="card-title" style="margin-bottom:8px;"><span>🧭</span> MODELO DE TEMPORADAS V3</div>
          <div style="font-size:12px;color:#334155;line-height:1.55;">
            La temporada se crea una sola vez para toda IQBasket y después se vincula a cada equipo.
            El staff pertenece a <strong>Equipo + Temporada</strong>, no al equipo de forma permanente.
          </div>
          <div style="margin-top:10px;font-size:11px;font-weight:800;color:${backendReady ? '#15803d' : '#b45309'};">
            ${backendReady
              ? '✅ Backend de gestión v3 disponible.'
              : '🟡 Modo lectura: el backend seguro de edición todavía no está aplicado. No se modificará ningún dato.'}
          </div>
        </div>

        <div class="config-card">
          <div class="card-title"><span>📅</span> TEMPORADAS GLOBALES (${state.seasons.length})</div>
          ${state.seasons.length > 0 ? state.seasons.map(season => {
            const linkedScopes = state.teamSeasons.filter(
              scope => String(scope.season_id) === String(season.id)
            );
            return `
              <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:10px;background:#f8fafc;">
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
                  <div>
                    <div style="font-size:16px;font-weight:900;color:#0f172a;">${escapeHtml(formatSeasonName(season.name))}</div>
                    <div style="font-size:11px;color:#64748b;margin-top:3px;">
                      Código: ${escapeHtml(season.code)} · ${linkedScopes.length} equipo(s) vinculado(s)
                    </div>
                  </div>
                  <span class="${String(season.status).toUpperCase() === 'ACTIVE' ? 'badge-active-team' : 'badge-inactive'}">
                    ${escapeHtml(season.status || "ACTIVE")}
                  </span>
                </div>
              </div>
            `;
          }).join("") : '<p style="font-size:12px;color:#64748b;">No hay temporadas globales registradas.</p>'}

          ${canManage ? `
            <div style="margin-top:14px;border-top:1px solid #e2e8f0;padding-top:14px;">
              <button type="button" class="btn-primary season-v3-action" data-action="create-season" ${canWrite ? '' : 'disabled'} style="${canWrite ? '' : 'opacity:.5;cursor:not-allowed;'}">
                + Nueva temporada global
              </button>
            </div>
          ` : ''}
        </div>

        <div class="config-card">
          <div class="card-title"><span>🏀</span> EQUIPOS POR TEMPORADA</div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${state.teamSeasons.length > 0 ? state.teamSeasons.map(scope => {
              const team = teamsById.get(String(scope.team_id)) || {};
              const season = state.seasons.find(s => String(s.id) === String(scope.season_id)) || {};
              const staff = this._getActiveStaff(scope.id);
              const headCoach = staff.find(row => row.staff_role === "HEAD_COACH");
              const legacyCoach = this._getLegacyCoach(scope);
              const isActiveTeam = String(scope.team_id) === String(activeTeamId || "");

              return `
                <div style="border:1px solid ${isActiveTeam ? '#93c5fd' : '#e2e8f0'};border-radius:12px;padding:14px;background:${isActiveTeam ? '#eff6ff' : '#fff'};">
                  <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
                    <div>
                      <div style="font-size:14px;font-weight:900;color:#0f172a;">${escapeHtml(team.name || "Equipo")}</div>
                      <div style="font-size:11px;color:#64748b;margin-top:2px;">
                        ${escapeHtml(formatSeasonName(season.name || ""))} · ${escapeHtml(team.category || "")}
                      </div>
                    </div>
                    <span class="${String(scope.status).toUpperCase() === 'ACTIVE' ? 'badge-active-team' : 'badge-inactive'}">
                      ${escapeHtml(scope.status || "ACTIVE")}
                    </span>
                  </div>

                  <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;">
                    <div style="padding:10px;background:#f8fafc;border-radius:8px;">
                      <div style="font-size:10px;font-weight:800;color:#64748b;">ENTRENADOR PRINCIPAL</div>
                      <div style="margin-top:4px;font-size:13px;font-weight:800;color:#0f172a;">
                        ${escapeHtml(headCoach ? this._staffDisplayName(headCoach) : (legacyCoach || "Sin asignar"))}
                      </div>
                      ${!headCoach && legacyCoach ? '<div style="font-size:9px;color:#b45309;margin-top:3px;">Compatibilidad legacy · pendiente de migrar a v3</div>' : ''}
                    </div>

                    ${Object.entries(STAFF_LABELS)
                      .filter(([role]) => role !== "HEAD_COACH")
                      .map(([role, label]) => {
                        const assignments = staff.filter(row => row.staff_role === role);
                        const names = assignments.map(row => this._staffDisplayName(row)).filter(Boolean);
                        return `
                          <div style="padding:10px;background:#f8fafc;border-radius:8px;">
                            <div style="font-size:10px;font-weight:800;color:#64748b;">${escapeHtml(label.toUpperCase())}</div>
                            <div style="margin-top:4px;font-size:12px;font-weight:700;color:#334155;">
                              ${escapeHtml(names.join(", ") || "Sin asignar")}
                            </div>
                          </div>
                        `;
                      }).join("")}
                  </div>

                  ${canManage ? `
                    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
                      <button type="button"
                        class="btn-secondary-sm season-v3-action"
                        data-action="manage-staff"
                        data-team-season-id="${scope.id}"
                        ${canWrite ? '' : 'disabled'}
                        style="${canWrite ? '' : 'opacity:.5;cursor:not-allowed;'}">
                        👥 Gestionar staff
                      </button>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join("") : '<p style="font-size:12px;color:#64748b;">No hay equipos vinculados a temporadas globales.</p>'}
          </div>
        </div>

        <div class="config-card" style="border:1px solid #fde68a;background:#fffbeb;">
          <div class="card-title" style="color:#92400e;"><span>🧹</span> COMPATIBILIDAD LEGACY</div>
          <p style="font-size:12px;color:#78350f;line-height:1.55;margin:0;">
            La tabla antigua <code>seasons</code> y <code>coach_name</code> se mantienen únicamente para no perder
            información mientras migramos. Esta pantalla ya no crea, renombra ni elimina temporadas legacy.
          </p>
        </div>
      </div>
    `;
  }

  bindEvents(container, { onBackendUnavailable = null } = {}) {
    container.querySelectorAll(".season-v3-action[disabled]").forEach(button => {
      button.addEventListener("click", () => {
        onBackendUnavailable?.();
      });
    });
  }
}

export default SeasonManagementView;
