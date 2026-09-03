/**
 * Player 360 · Training Core + External Development.
 *
 * UI responsibilities only:
 * - responsive presentation;
 * - local form validation;
 * - permission-aware controls;
 * - delegating persistence to TrainingService.
 *
 * Backend RLS/RPC remains authoritative.
 */

import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";
import { Permission } from "../security/PermissionService.js";
import { TrainingService } from "../services/player360/TrainingService.js";
import {
  EXTERNAL_PROVIDER_LABELS,
  EXTERNAL_PROVIDER_TYPE,
  PLAYER360_SOURCE_TYPE,
  TRAINING_ATTENDANCE_LABELS
} from "../config/player360.config.js";

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localIsoDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function displayNumber(value, digits = 0) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0
  });
}

/**
 * Calculates same-day duration from two HH:MM values.
 * Returns null for incomplete/invalid ranges so UI and backend cannot diverge.
 */
function minutesBetweenTimes(startTime = "", endTime = "") {
  const parse = value => {
    const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return (hours * 60) + minutes;
  };

  const start = parse(startTime);
  const end = parse(endTime);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

function playerName(player = null) {
  if (!player) return "Jugador";
  return (
    player.name
    || [player.first_name, player.last_name].filter(Boolean).join(" ")
    || [player.firstName, player.lastName].filter(Boolean).join(" ")
    || "Jugador"
  );
}

export class TrainingView {
  constructor(supabaseClient = null, authController = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;
    this.service = new TrainingService(this.supabase);

    this.activeTab = "training";
    this.sessions = [];
    this.externalSessions = [];
    this.activityTypes = [];
    this.capabilities = null;
    this.lastError = null;
    this.isLoading = false;
    this.teamId = null;
    this.teamSeasonId = null;
    this.containerId = "dashboard-content-area";
    this.editingSessionId = null;
    this.editingExternalId = null;
  }

  t(key, fallback = "") {
    const translated = TranslationStore?.t?.(key, "") || I18n?.t?.(key, "") || "";
    if (!translated || translated === key || translated.startsWith("[MISSING:")) {
      return fallback || key;
    }
    return translated;
  }

  _context() {
    return {
      teamId: this.teamId,
      teamSeasonId: this.teamSeasonId
    };
  }

  _can(permission) {
    if (!permission) return false;
    if (typeof this.auth?.canPreview === "function") {
      return Boolean(this.auth.canPreview(permission, this._context()));
    }
    if (typeof this.auth?.can === "function") {
      return Boolean(this.auth.can(permission, this._context()));
    }
    return false;
  }

  _seasonContext() {
    return DataStore.getActiveSeasonContext?.(this.teamId) || null;
  }

  _defaultDate() {
    const context = this._seasonContext();
    const today = localIsoDate();
    const start = String(context?.start_date || context?.startDate || "").slice(0, 10);
    const end = String(context?.end_date || context?.endDate || "").slice(0, 10);

    if (start && today < start) return start;
    if (end && today > end) return end;
    return today;
  }

  _dateInputBounds() {
    const context = this._seasonContext();
    return {
      min: String(context?.start_date || context?.startDate || "").slice(0, 10),
      max: String(context?.end_date || context?.endDate || "").slice(0, 10)
    };
  }

  _playerDirectory() {
    const participants = DataStore.getSeasonParticipantPlayers?.(this.teamId)
      || DataStore.getTeamPlayers?.(this.teamId)
      || [];

    const all = DataStore.getTeamPlayers?.(this.teamId) || [];
    const map = new Map();

    [...participants, ...all].forEach(player => {
      if (player?.id) map.set(String(player.id), player);
    });

    return map;
  }

  _eligiblePlayers(date) {
    return DataStore.getPlayersEligibleOnDate?.(this.teamId, date)
      || DataStore.getPlayersForActiveSeason?.(this.teamId)
      || DataStore.getTeamPlayers?.(this.teamId)
      || [];
  }

  async _load() {
    this.isLoading = true;
    this.lastError = null;

    try {
      this.capabilities = await this.service.getCapabilities({ force: true });

      if (!this.capabilities?.ready || !this.capabilities?.training_core) {
        this.sessions = [];
        this.externalSessions = [];
        return;
      }

      const [sessions, externalSessions, activityTypes] = await Promise.all([
        this._can(Permission.VIEW_TRAINING)
          ? this.service.listSessions({
              teamSeasonId: this.teamSeasonId,
              limit: 60
            })
          : Promise.resolve([]),
        this._can(Permission.VIEW_EXTERNAL_DEVELOPMENT)
          ? this.service.listExternalDevelopment({
              teamSeasonId: this.teamSeasonId,
              limit: 100
            })
          : Promise.resolve([]),
        this.service.listActivityTypes({
          teamSeasonId: this.teamSeasonId,
          includeInactive: false
        })
      ]);

      this.sessions = sessions;
      this.externalSessions = externalSessions;
      this.activityTypes = activityTypes;
    } catch (error) {
      console.error("[TrainingView] Error cargando Player 360 Training:", error);
      this.lastError = error;
      this.capabilities = this.capabilities || { ready: false };
    } finally {
      this.isLoading = false;
    }
  }

  _sessionDuration(session = {}) {
    const stored = numberOrNull(session.duration_minutes);
    if (stored !== null && stored > 0) return stored;
    return minutesBetweenTimes(
      String(session.start_time || "").slice(0, 5),
      String(session.end_time || "").slice(0, 5)
    );
  }

  _sessionSummary() {
    const sessions = this.sessions.filter(session => session.status !== "ARCHIVED");
    const totalMinutes = sessions.reduce(
      (sum, session) => sum + (this._sessionDuration(session) || 0),
      0
    );
    const intensityValues = sessions
      .map(session => Number(session.intensity))
      .filter(Number.isFinite);
    const avgIntensity = intensityValues.length
      ? intensityValues.reduce((sum, value) => sum + value, 0) / intensityValues.length
      : null;
    const participantLoad = sessions.reduce(
      (sum, session) => sum + (session.participants || []).reduce(
        (inner, participant) => inner + (Number(participant.internal_load) || 0),
        0
      ),
      0
    );

    return {
      sessions: sessions.length,
      totalMinutes,
      avgIntensity,
      participantLoad
    };
  }

  _externalSummary() {
    const totalMinutes = this.externalSessions.reduce(
      (sum, session) => sum + (Number(session.duration_minutes) || 0),
      0
    );
    const totalLoad = this.externalSessions.reduce(
      (sum, session) => sum + (Number(session.internal_load) || 0),
      0
    );

    return {
      sessions: this.externalSessions.length,
      totalMinutes,
      totalLoad
    };
  }

  _renderKpi(label, value, helper = "") {
    return `
      <div class="p360-kpi">
        <span class="p360-kpi-label">${escapeHtml(label)}</span>
        <strong class="p360-kpi-value">${escapeHtml(value)}</strong>
        ${helper ? `<span class="p360-kpi-helper">${escapeHtml(helper)}</span>` : ""}
      </div>
    `;
  }

  _renderBlockRow(index = 1, block = {}) {
    return `
      <div class="p360-block-row" data-block-index="${index}">
        <label>
          <span>${escapeHtml(this.t("player360.training.block_title", "Bloque"))}</span>
          <input type="text" class="p360-block-title" value="${escapeHtml(block.title || "")}" placeholder="Ej. Tiro tras bote" />
        </label>
        <label>
          <span>${escapeHtml(this.t("player360.training.activity_code", "Código / tipo"))}</span>
          <input type="text" class="p360-block-code" value="${escapeHtml(block.activity_code || "")}" placeholder="Ej. SHOOTING" />
        </label>
        <label>
          <span>${escapeHtml(this.t("player360.training.duration", "Minutos"))}</span>
          <input type="number" class="p360-block-duration" min="1" max="300" inputmode="numeric" value="${escapeHtml(block.duration_minutes ?? "")}" />
        </label>
        <label>
          <span>${escapeHtml(this.t("player360.training.intensity", "Intensidad 0-10"))}</span>
          <input type="number" class="p360-block-intensity" min="0" max="10" step="0.5" inputmode="decimal" value="${escapeHtml(block.intensity ?? "")}" />
        </label>
        <label class="p360-block-objective">
          <span>${escapeHtml(this.t("player360.training.objective", "Objetivo"))}</span>
          <input type="text" class="p360-block-objective-input" value="${escapeHtml(block.objective || "")}" placeholder="Objetivo específico del bloque" />
        </label>
        <button type="button" class="p360-remove-block" aria-label="Eliminar bloque">×</button>
      </div>
    `;
  }

  _renderParticipantChecklist(date, selectedIds = []) {
    const players = this._eligiblePlayers(date);
    const selected = new Set((selectedIds || []).map(String));
    if (!players.length) {
      return `
        <p class="p360-empty-inline">
          ${escapeHtml(this.t(
            "player360.training.no_eligible_players",
            "No hay jugadores elegibles para la fecha seleccionada."
          ))}
        </p>
      `;
    }

    return `
      <div class="p360-participant-tools">
        <button type="button" class="p360-link-btn" id="p360-select-all-players">
          ${escapeHtml(this.t("player360.training.select_all", "Seleccionar plantilla"))}
        </button>
        <button type="button" class="p360-link-btn" id="p360-clear-all-players">
          ${escapeHtml(this.t("player360.training.clear_all", "Limpiar"))}
        </button>
      </div>
      <div class="p360-player-check-grid">
        ${players.map(player => `
          <label class="p360-player-check">
            <input type="checkbox" name="p360-training-player" value="${escapeHtml(player.id)}" ${selected.has(String(player.id)) ? "checked" : ""} />
            <span class="p360-player-number">#${escapeHtml(player.jersey ?? player.number ?? "—")}</span>
            <span>${escapeHtml(playerName(player))}</span>
          </label>
        `).join("")}
      </div>
    `;
  }

  _renderTrainingForm() {
    const editing = this.sessions.find(item => String(item.id) === String(this.editingSessionId)) || null;
    const canCreate = this._can(Permission.CREATE_TRAINING);
    const canEdit = this._can(Permission.EDIT_TRAINING) && Boolean(this.capabilities?.update_training);
    if ((!editing && !canCreate) || (editing && !canEdit)) return "";

    const date = editing?.session_date || this._defaultDate();
    const bounds = this._dateInputBounds();
    const selectedIds = (editing?.participants || []).map(item => item.player_id).filter(Boolean);
    const blocks = (editing?.blocks || []).length ? editing.blocks : [{}];
    const startTime = String(editing?.start_time || "").slice(0, 5);
    const endTime = String(editing?.end_time || "").slice(0, 5);
    const duration = editing ? this._sessionDuration(editing) : "";

    return `
      <details class="p360-create-panel" id="p360-create-training-panel" ${editing ? "open" : ""}>
        <summary>
          <span>${editing ? "✏️" : "＋"}</span>
          ${escapeHtml(editing
            ? this.t("player360.training.edit", "Editar sesión de entrenamiento")
            : this.t("player360.training.create", "Crear sesión de entrenamiento"))}
        </summary>

        <form id="p360-training-form" class="p360-form" data-editing-session-id="${escapeHtml(editing?.id || "")}">
          <div class="p360-form-grid">
            <label>
              <span>${escapeHtml(this.t("player360.training.date", "Fecha"))}</span>
              <input
                type="date"
                id="p360-training-date"
                value="${escapeHtml(date)}"
                ${bounds.min ? `min="${escapeHtml(bounds.min)}"` : ""}
                ${bounds.max ? `max="${escapeHtml(bounds.max)}"` : ""}
                required
              />
            </label>

            <label class="p360-span-2">
              <span>${escapeHtml(this.t("player360.training.title", "Nombre de la sesión"))}</span>
              <input type="text" id="p360-training-title" maxlength="140" value="${escapeHtml(editing?.title || "")}" placeholder="Ej. Técnica individual + ventajas 2c1" required />
            </label>

            <label>
              <span>${escapeHtml(this.t("player360.training.start_time", "Inicio"))}</span>
              <input type="time" id="p360-training-start-time" value="${escapeHtml(startTime)}" required />
            </label>

            <label>
              <span>${escapeHtml(this.t("player360.training.end_time", "Fin"))}</span>
              <input type="time" id="p360-training-end-time" value="${escapeHtml(endTime)}" required />
            </label>

            <label>
              <span>${escapeHtml(this.t("player360.training.duration", "Duración calculada (min)"))}</span>
              <input type="number" id="p360-training-duration" min="1" max="600" inputmode="numeric"
                value="${escapeHtml(duration)}" readonly aria-readonly="true" placeholder="Inicio + fin" />
            </label>

            <label>
              <span>${escapeHtml(this.t("player360.training.intensity", "Intensidad prevista 0-10"))}</span>
              <input type="number" id="p360-training-intensity" min="0" max="10" step="0.5" inputmode="decimal" value="${escapeHtml(editing?.intensity ?? "")}" />
            </label>

            <label class="p360-span-2">
              <span>${escapeHtml(this.t("player360.training.objective", "Objetivo principal"))}</span>
              <textarea id="p360-training-objective" rows="2" maxlength="500" placeholder="Qué queremos provocar o mejorar">${escapeHtml(editing?.objective || "")}</textarea>
            </label>
          </div>

          <div class="p360-subsection">
            <div class="p360-subsection-head">
              <div>
                <strong>${escapeHtml(this.t("player360.training.blocks", "Bloques de trabajo"))}</strong>
                <small>${escapeHtml(this.t("player360.training.blocks_help", "Divide la sesión en contenidos independientes para poder analizar después qué se entrenó."))}</small>
              </div>
              <button type="button" class="p360-secondary-btn" id="p360-add-block">
                ＋ ${escapeHtml(this.t("player360.training.add_block", "Añadir bloque"))}
              </button>
            </div>
            <div id="p360-blocks-container">
              ${blocks.map((block,index) => this._renderBlockRow(index + 1, block)).join("")}
            </div>
          </div>

          <div class="p360-subsection">
            <div class="p360-subsection-head">
              <div>
                <strong>${escapeHtml(this.t("player360.training.planned_roster", "Jugadores de la sesión"))}</strong>
                <small>${escapeHtml(editing
                  ? "Los jugadores que continúan seleccionados conservan asistencia, minutos y RPE. Desmarcar un jugador elimina su registro de esta sesión."
                  : this.t("player360.training.planned_roster_help", "Solo se muestran jugadores elegibles en esa fecha. La asistencia real y el RPE se registran después."))}</small>
              </div>
            </div>
            <div id="p360-training-player-options">
              ${this._renderParticipantChecklist(date, selectedIds)}
            </div>
          </div>

          <div class="p360-form-actions">
            <button type="button" class="p360-secondary-btn p360-cancel-create" id="p360-cancel-training">
              ${escapeHtml(this.t("common.cancel", "Cancelar"))}
            </button>
            <button type="submit" class="p360-primary-btn">
              ${escapeHtml(editing ? "Guardar correcciones" : this.t("player360.training.save_session", "Guardar sesión"))}
            </button>
          </div>
        </form>
      </details>
    `;
  }

  _attendanceStatusOptions(selected = "PLANNED") {
    return Object.entries(TRAINING_ATTENDANCE_LABELS)
      .map(([value, label]) => `
        <option value="${value}" ${String(selected).toUpperCase() === value ? "selected" : ""}>
          ${escapeHtml(label)}
        </option>
      `)
      .join("");
  }

  _renderAttendanceEditor(session, directory) {
    if (!this._can(Permission.EDIT_TRAINING)) return "";

    const existing = new Set(
      (session.participants || []).map(row => String(row.player_id))
    );
    const eligible = this._eligiblePlayers(session.session_date)
      .filter(player => !existing.has(String(player.id)));
    const plannedParticipants = (session.participants || []).filter(
      participant => String(participant.attendance_status || "").toUpperCase() === "PLANNED"
    );
    const canConfirmPlanned = String(session.session_date || "") <= localIsoDate()
      && plannedParticipants.length > 0;

    return `
      <details class="p360-attendance-panel">
        <summary>
          ${escapeHtml(this.t("player360.training.attendance_rpe", "Asistencia · minutos · RPE"))}
        </summary>

        <div class="p360-attendance-list">
          ${canConfirmPlanned ? `
            <div class="p360-attendance-bulk">
              <span>
                ${plannedParticipants.length} participante${plannedParticipants.length === 1 ? "" : "s"} pendiente${plannedParticipants.length === 1 ? "" : "s"} de confirmar.
              </span>
              <button
                type="button"
                class="p360-secondary-btn p360-confirm-planned"
                data-session-id="${escapeHtml(session.id)}"
              >
                ✓ Marcar planificadas como presentes
              </button>
            </div>
          ` : ""}

          ${(session.participants || []).map(participant => {
            const player = directory.get(String(participant.player_id));
            return `
              <div class="p360-attendance-row">
                <div class="p360-attendance-player">
                  <strong>${escapeHtml(playerName(player))}</strong>
                  <span>#${escapeHtml(player?.jersey ?? player?.number ?? "—")}</span>
                </div>
                <select class="p360-att-status" aria-label="Estado">
                  ${this._attendanceStatusOptions(participant.attendance_status)}
                </select>
                <input
                  class="p360-att-minutes"
                  type="number"
                  min="0"
                  max="600"
                  inputmode="numeric"
                  value="${participant.participated_minutes ?? ""}"
                  placeholder="Min"
                  aria-label="Minutos"
                />
                <input
                  class="p360-att-rpe"
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  inputmode="decimal"
                  value="${participant.rpe ?? ""}"
                  placeholder="RPE"
                  aria-label="RPE"
                />
                <input
                  class="p360-att-notes"
                  type="text"
                  maxlength="240"
                  value="${escapeHtml(participant.notes || "")}"
                  placeholder="Nota opcional"
                  aria-label="Nota"
                />
                <button
                  type="button"
                  class="p360-secondary-btn p360-save-attendance"
                  data-session-id="${escapeHtml(session.id)}"
                  data-player-id="${escapeHtml(participant.player_id)}"
                >
                  Guardar
                </button>
                <div class="p360-load-value">
                  Carga: <strong>${displayNumber(participant.internal_load, 1)}</strong>
                </div>
              </div>
            `;
          }).join("")}

          ${eligible.length ? `
            <div class="p360-add-participant-row">
              <select class="p360-new-participant-player" aria-label="Añadir jugador">
                <option value="">Añadir jugador…</option>
                ${eligible.map(player => `
                  <option value="${escapeHtml(player.id)}">
                    #${escapeHtml(player.jersey ?? player.number ?? "—")} · ${escapeHtml(playerName(player))}
                  </option>
                `).join("")}
              </select>
              <button
                type="button"
                class="p360-secondary-btn p360-add-participant"
                data-session-id="${escapeHtml(session.id)}"
              >
                Añadir
              </button>
            </div>
          ` : ""}
        </div>
      </details>
    `;
  }

  _renderSessionCard(session, directory) {
    const present = (session.participants || []).filter(
      participant => ["PRESENT", "PARTIAL"].includes(
        String(participant.attendance_status || "").toUpperCase()
      )
    ).length;
    const load = (session.participants || []).reduce(
      (sum, participant) => sum + (Number(participant.internal_load) || 0),
      0
    );

    return `
      <article class="p360-session-card">
        <div class="p360-session-top">
          <div>
            <div class="p360-date-badge">${escapeHtml(session.session_date)}</div>
            <h3>${escapeHtml(session.title)}</h3>
            ${session.objective
              ? `<p>${escapeHtml(session.objective)}</p>`
              : ""}
          </div>
          <span class="p360-status p360-status-${escapeHtml(String(session.status || "").toLowerCase())}">
            ${escapeHtml(session.status || "PLANNED")}
          </span>
        </div>

        <div class="p360-session-metrics">
          <span>⏱ ${displayNumber(this._sessionDuration(session))} min</span>
          <span>⚡ Intensidad ${displayNumber(session.intensity, 1)}</span>
          <span>👥 ${present}/${(session.participants || []).length} presentes/parciales</span>
          <span>📊 Carga ${displayNumber(load, 1)}</span>
        </div>

        ${(session.blocks || []).length ? `
          <div class="p360-block-list">
            ${session.blocks.map(block => `
              <div class="p360-block-chip">
                <strong>${escapeHtml(block.title)}</strong>
                <span>
                  ${escapeHtml(block.activity_code || "GENERAL")}
                  ${block.duration_minutes ? ` · ${displayNumber(block.duration_minutes)} min` : ""}
                  ${block.intensity !== null && block.intensity !== undefined
                    ? ` · I${displayNumber(block.intensity, 1)}`
                    : ""}
                </span>
              </div>
            `).join("")}
          </div>
        ` : `
          <p class="p360-empty-inline">Sin bloques registrados.</p>
        `}

        ${this._renderAttendanceEditor(session, directory)}

        ${this._can(Permission.EDIT_TRAINING) || this._can(Permission.DELETE_TRAINING) ? `
          <div class="p360-card-actions" style="display:flex;gap:12px;flex-wrap:wrap;">
            ${this._can(Permission.EDIT_TRAINING) && this.capabilities?.update_training ? `
              <button type="button" class="p360-link-btn p360-edit-session" data-session-id="${escapeHtml(session.id)}">
                ✏️ Editar sesión
              </button>
            ` : ""}
            ${this._can(Permission.DELETE_TRAINING) ? `
              <button type="button" class="p360-danger-link p360-archive-session" data-session-id="${escapeHtml(session.id)}">
                Archivar sesión
              </button>
            ` : ""}
          </div>
        ` : ""}
      </article>
    `;
  }

  _renderTrainingPanel() {
    const summary = this._sessionSummary();
    const directory = this._playerDirectory();

    return `
      <section id="p360-panel-training" class="p360-tab-panel">
        <div class="p360-kpi-grid">
          ${this._renderKpi("Sesiones", String(summary.sessions), "Temporada activa")}
          ${this._renderKpi("Minutos planificados", displayNumber(summary.totalMinutes), "Suma de sesiones")}
          ${this._renderKpi("Intensidad media", displayNumber(summary.avgIntensity, 1), "Escala 0-10")}
          ${this._renderKpi("Carga registrada", displayNumber(summary.participantLoad, 1), "Minutos × RPE")}
        </div>

        ${this._renderTrainingForm()}

        <div class="p360-section-head">
          <div>
            <h2>${escapeHtml(this.t("player360.training.history", "Histórico de entrenamientos"))}</h2>
            <p>La carga solo aparece cuando se registran minutos y RPE del jugador.</p>
          </div>
        </div>

        <div class="p360-session-list">
          ${this.sessions.length
            ? this.sessions.map(session => this._renderSessionCard(session, directory)).join("")
            : `
              <div class="p360-empty-state">
                <strong>Aún no hay entrenamientos registrados.</strong>
                <span>La primera sesión que guardes aparecerá aquí y quedará vinculada a la temporada.</span>
              </div>
            `}
        </div>
      </section>
    `;
  }

  _renderExternalPlayerOptions(date, selectedId = "") {
    const players = this._eligiblePlayers(date);
    return `
      <option value="">Selecciona jugador…</option>
      ${players.map(player => `
        <option value="${escapeHtml(player.id)}" ${String(selectedId) === String(player.id) ? "selected" : ""}>
          #${escapeHtml(player.jersey ?? player.number ?? "—")} · ${escapeHtml(playerName(player))}
        </option>
      `).join("")}
    `;
  }

  _renderExternalForm() {
    const editing = this.externalSessions.find(item => String(item.id) === String(this.editingExternalId)) || null;
    const canCreate = this._can(Permission.CREATE_EXTERNAL_DEVELOPMENT);
    const canEdit = this._can(Permission.EDIT_EXTERNAL_DEVELOPMENT)
      && Boolean(this.capabilities?.update_external_development);
    if ((!editing && !canCreate) || (editing && !canEdit)) return "";

    const date = editing?.activity_date || this._defaultDate();
    const bounds = this._dateInputBounds();

    return `
      <details class="p360-create-panel" id="p360-create-external-panel" ${editing ? "open" : ""}>
        <summary>
          <span>${editing ? "✏️" : "＋"}</span>
          ${escapeHtml(editing ? "Editar tecnificación / desarrollo externo" : this.t("player360.external.create", "Registrar desarrollo externo"))}
        </summary>

        <form id="p360-external-form" class="p360-form" data-editing-external-id="${escapeHtml(editing?.id || "")}">
          <div class="p360-form-grid">
            <label>
              <span>Fecha</span>
              <input type="date" id="p360-external-date" value="${escapeHtml(date)}"
                ${bounds.min ? `min="${escapeHtml(bounds.min)}"` : ""}
                ${bounds.max ? `max="${escapeHtml(bounds.max)}"` : ""} required />
            </label>

            <label>
              <span>Jugador</span>
              <select id="p360-external-player" required>
                ${this._renderExternalPlayerOptions(date, editing?.player_id || "")}
              </select>
            </label>

            <label class="p360-span-2">
              <span>Actividad</span>
              <input type="text" id="p360-external-title" maxlength="140" value="${escapeHtml(editing?.title || "")}" placeholder="Ej. Sesión individual de tiro" required />
            </label>

            <label>
              <span>Código / tipo</span>
              <input type="text" id="p360-external-code" maxlength="80" value="${escapeHtml(editing?.activity_code || "")}" placeholder="Ej. SHOOTING" />
            </label>

            <label>
              <span>Proveedor / tecnificador</span>
              <input type="text" id="p360-external-provider" maxlength="140" value="${escapeHtml(editing?.provider_name || "")}" placeholder="Nombre opcional" />
            </label>

            <label>
              <span>Duración (min)</span>
              <input type="number" id="p360-external-duration" min="1" max="600" inputmode="numeric" value="${escapeHtml(editing?.duration_minutes ?? "")}" />
            </label>

            <label>
              <span>Intensidad 0-10</span>
              <input type="number" id="p360-external-intensity" min="0" max="10" step="0.5" inputmode="decimal" value="${escapeHtml(editing?.intensity ?? "")}" />
            </label>

            <label>
              <span>RPE 0-10</span>
              <input type="number" id="p360-external-rpe" min="0" max="10" step="0.5" inputmode="decimal" value="${escapeHtml(editing?.rpe ?? "")}" />
            </label>

            <label>
              <span>Tipo de proveedor</span>
              <select id="p360-external-provider-type">
                ${Object.entries(EXTERNAL_PROVIDER_LABELS).map(([value,label]) => `
                  <option value="${escapeHtml(value)}" ${String(editing?.provider_type || EXTERNAL_PROVIDER_TYPE.EXTERNAL_COACH) === String(value) ? "selected" : ""}>
                    ${escapeHtml(label)}
                  </option>
                `).join("")}
              </select>
            </label>

            <label class="p360-span-2">
              <span>Objetivo</span>
              <textarea id="p360-external-objective" rows="2" maxlength="500" placeholder="Qué se trabajó o qué se buscaba mejorar">${escapeHtml(editing?.objective || "")}</textarea>
            </label>

            <label class="p360-span-2">
              <span>Notas</span>
              <textarea id="p360-external-notes" rows="2" maxlength="500" placeholder="Observación deportiva opcional">${escapeHtml(editing?.notes || "")}</textarea>
            </label>
          </div>

          <div class="p360-info-note">
            ${editing
              ? "Corrige únicamente el registro seleccionado. La procedencia externa se conserva separada del entrenamiento del club."
              : "Este registro identifica trabajo realizado fuera del equipo para no atribuir automáticamente al club una evolución que puede proceder de tecnificación externa."}
          </div>

          <div class="p360-form-actions">
            <button type="button" class="p360-secondary-btn p360-cancel-create" id="p360-cancel-external">
              ${escapeHtml(this.t("common.cancel", "Cancelar"))}
            </button>
            <button type="submit" class="p360-primary-btn">${editing ? "Guardar correcciones" : "Guardar desarrollo externo"}</button>
          </div>
        </form>
      </details>
    `;
  }

  _renderExternalPanel() {
    const summary = this._externalSummary();
    const directory = this._playerDirectory();

    return `
      <section id="p360-panel-external" class="p360-tab-panel" hidden>
        <div class="p360-kpi-grid">
          ${this._renderKpi("Sesiones externas", String(summary.sessions), "Temporada activa")}
          ${this._renderKpi("Minutos externos", displayNumber(summary.totalMinutes), "Volumen registrado")}
          ${this._renderKpi("Carga externa", displayNumber(summary.totalLoad, 1), "Duración × RPE")}
        </div>

        ${this._renderExternalForm()}

        <div class="p360-section-head">
          <div>
            <h2>Histórico de desarrollo externo</h2>
            <p>Procedencia y autoría permanecen separadas del entrenamiento del club.</p>
          </div>
        </div>

        <div class="p360-external-list">
          ${this.externalSessions.length
            ? this.externalSessions.map(session => {
                const player = directory.get(String(session.player_id));
                return `
                  <article class="p360-external-card">
                    <div class="p360-session-top">
                      <div>
                        <div class="p360-date-badge">${escapeHtml(session.activity_date)}</div>
                        <h3>${escapeHtml(session.title)}</h3>
                        <p>
                          ${escapeHtml(playerName(player))}
                          ${session.provider_name ? ` · ${escapeHtml(session.provider_name)}` : ""}
                        </p>
                      </div>
                      <span class="p360-source-badge">${escapeHtml(session.source_type || "EXTERNAL_COACH")}</span>
                    </div>

                    <div class="p360-session-metrics">
                      <span>⏱ ${displayNumber(session.duration_minutes)} min</span>
                      <span>⚡ I${displayNumber(session.intensity, 1)}</span>
                      <span>RPE ${displayNumber(session.rpe, 1)}</span>
                      <span>📊 Carga ${displayNumber(session.internal_load, 1)}</span>
                    </div>

                    ${session.objective ? `<p class="p360-card-text"><strong>Objetivo:</strong> ${escapeHtml(session.objective)}</p>` : ""}
                    ${session.notes ? `<p class="p360-card-text"><strong>Nota:</strong> ${escapeHtml(session.notes)}</p>` : ""}
                    ${this._can(Permission.EDIT_EXTERNAL_DEVELOPMENT) && this.capabilities?.update_external_development ? `
                      <div class="p360-card-actions">
                        <button type="button" class="p360-link-btn p360-edit-external" data-external-id="${escapeHtml(session.id)}">
                          ✏️ Editar tecnificación
                        </button>
                      </div>
                    ` : ""}
                  </article>
                `;
              }).join("")
            : `
              <div class="p360-empty-state">
                <strong>Aún no hay desarrollo externo registrado.</strong>
                <span>Cuando un jugador realice tecnificación u otro trabajo complementario podrás registrarlo aquí.</span>
              </div>
            `}
        </div>
      </section>
    `;
  }

  _renderStyles() {
    return `
      <style>
        .p360-training-view {
          display: grid;
          gap: 18px;
          padding: 18px;
          color: #0f172a;
          font-family: var(--font-family-base, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }
        .p360-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 18px;
          background: linear-gradient(135deg, #0f172a, #1e3a8a);
          color: white;
          border-radius: 16px;
        }
        .p360-hero h1 {
          margin: 0 0 6px;
          font-size: clamp(22px, 4vw, 30px);
          color: #ffffff !important;
        }
        .p360-hero p { margin: 0; color: #dbeafe; max-width: 760px; line-height: 1.5; }
        .p360-context-pill {
          flex: 0 0 auto;
          color: #ffffff !important;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .p360-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 2px;
        }
        .p360-tab {
          min-height: 44px;
          padding: 10px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: white;
          color: #334155;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }
        .p360-tab[aria-selected="true"] {
          color: white;
          background: #1e3a8a;
          border-color: #1e3a8a;
        }
        .p360-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .p360-kpi {
          min-width: 0;
          padding: 14px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          display: grid;
          gap: 4px;
        }
        .p360-kpi-label { color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .p360-kpi-value { font-size: 24px; color: #0f172a; }
        .p360-kpi-helper { color: #94a3b8; font-size: 11px; }
        .p360-create-panel, .p360-attendance-panel {
          background: white;
          border: 1px solid #dbe3ee;
          border-radius: 14px;
          overflow: clip;
        }
        .p360-create-panel > summary,
        .p360-attendance-panel > summary {
          cursor: pointer;
          min-height: 48px;
          padding: 13px 15px;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 8px;
          list-style: none;
        }
        .p360-create-panel > summary::-webkit-details-marker,
        .p360-attendance-panel > summary::-webkit-details-marker { display: none; }
        .p360-form { padding: 0 15px 15px; display: grid; gap: 16px; }
        .p360-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .p360-form label,
        .p360-block-row label {
          display: grid;
          gap: 6px;
          color: #334155;
          font-size: 12px;
          font-weight: 700;
          min-width: 0;
        }
        .p360-form input,
        .p360-form select,
        .p360-form textarea,
        .p360-attendance-row input,
        .p360-attendance-row select,
        .p360-add-participant-row select {
          width: 100%;
          min-height: 44px;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          padding: 9px 10px;
          background: white;
          color: #0f172a;
          font: inherit;
        }
        .p360-form textarea { resize: vertical; }
        .p360-span-2 { grid-column: 1 / -1; }
        .p360-subsection {
          border-top: 1px solid #edf2f7;
          padding-top: 14px;
          display: grid;
          gap: 12px;
        }
        .p360-subsection-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }
        .p360-subsection-head div { display: grid; gap: 3px; }
        .p360-subsection-head small { color: #64748b; font-weight: 400; line-height: 1.45; }
        #p360-blocks-container { display: grid; gap: 10px; }
        .p360-block-row {
          position: relative;
          display: grid;
          grid-template-columns: 1.4fr 1fr .6fr .6fr 1.6fr auto;
          gap: 8px;
          align-items: end;
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #f8fafc;
        }
        .p360-remove-block {
          width: 40px;
          height: 40px;
          border: 0;
          border-radius: 9px;
          background: #fee2e2;
          color: #991b1b;
          font-size: 22px;
          cursor: pointer;
        }
        .p360-player-check-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          max-height: 280px;
          overflow-y: auto;
          padding-right: 2px;
        }
        .p360-player-check {
          min-height: 44px;
          display: flex !important;
          grid-template-columns: none !important;
          align-items: center;
          gap: 8px !important;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          padding: 8px;
          background: white;
        }
        .p360-player-check input { width: 18px; min-height: 18px; }
        .p360-player-number {
          min-width: 30px;
          font-weight: 900;
          color: #1e3a8a;
        }
        .p360-participant-tools { display: flex; gap: 8px; margin-bottom: 8px; }
        .p360-link-btn, .p360-danger-link {
          border: 0;
          background: transparent;
          padding: 6px 0;
          cursor: pointer;
          font-weight: 700;
        }
        .p360-link-btn { color: #1d4ed8; }
        .p360-danger-link { color: #b91c1c; }
        .p360-primary-btn, .p360-secondary-btn {
          min-height: 44px;
          border-radius: 9px;
          padding: 9px 13px;
          font-weight: 800;
          cursor: pointer;
        }
        .p360-primary-btn { border: 1px solid #1e3a8a; background: #1e3a8a; color: white; }
        .p360-secondary-btn { border: 1px solid #cbd5e1; background: white; color: #334155; }
        .p360-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }
        .p360-section-head { display: flex; justify-content: space-between; gap: 12px; align-items: end; }
        .p360-section-head h2 { margin: 0; font-size: 18px; }
        .p360-section-head p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
        .p360-session-list, .p360-external-list { display: grid; gap: 12px; }
        .p360-session-card, .p360-external-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 14px;
          display: grid;
          gap: 12px;
        }
        .p360-session-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
        .p360-session-top h3 { margin: 4px 0; font-size: 17px; }
        .p360-session-top p { margin: 0; color: #64748b; font-size: 12px; line-height: 1.45; }
        .p360-date-badge { font-size: 11px; color: #1d4ed8; font-weight: 900; }
        .p360-status, .p360-source-badge {
          padding: 5px 8px;
          border-radius: 999px;
          background: #e0e7ff;
          color: #3730a3;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
        }
        .p360-status-completed { background: #dcfce7; color: #166534; }
        .p360-status-cancelled { background: #fee2e2; color: #991b1b; }
        .p360-session-metrics {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }
        .p360-block-list { display: flex; gap: 8px; flex-wrap: wrap; }
        .p360-block-chip {
          display: grid;
          gap: 2px;
          padding: 8px 10px;
          border-radius: 9px;
          background: #f1f5f9;
          font-size: 11px;
        }
        .p360-block-chip span { color: #64748b; }
        .p360-attendance-panel { border-radius: 10px; }
        .p360-attendance-list { display: grid; gap: 8px; padding: 0 10px 10px; }
        .p360-attendance-bulk {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #dbe3ee;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }
        .p360-attendance-row {
          display: grid;
          grid-template-columns: minmax(150px,1.5fr) 1fr .6fr .6fr 1.3fr auto auto;
          gap: 7px;
          align-items: center;
          padding: 8px;
          border-radius: 9px;
          background: #f8fafc;
        }
        .p360-attendance-player { display: grid; font-size: 12px; }
        .p360-attendance-player span { color: #64748b; font-size: 10px; }
        .p360-load-value { font-size: 11px; color: #475569; white-space: nowrap; }
        .p360-add-participant-row { display: flex; gap: 8px; }
        .p360-add-participant-row select { flex: 1; }
        .p360-card-actions { border-top: 1px solid #f1f5f9; padding-top: 8px; }
        .p360-card-text { margin: 0; color: #475569; font-size: 12px; line-height: 1.5; }
        .p360-info-note {
          border-left: 3px solid #0ea5e9;
          background: #f0f9ff;
          padding: 10px 12px;
          border-radius: 8px;
          color: #0c4a6e;
          font-size: 12px;
          line-height: 1.45;
        }
        .p360-empty-state {
          padding: 26px;
          display: grid;
          gap: 5px;
          text-align: center;
          border: 1px dashed #cbd5e1;
          border-radius: 14px;
          color: #64748b;
          background: #f8fafc;
        }
        .p360-empty-state strong { color: #334155; }
        .p360-empty-inline { margin: 0; color: #64748b; font-size: 12px; }
        .p360-error, .p360-readonly {
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.45;
        }
        .p360-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .p360-readonly { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }

        @media (max-width: 980px) {
          .p360-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .p360-block-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .p360-block-objective { grid-column: 1 / -1; }
          .p360-remove-block { position: absolute; top: 8px; right: 8px; }
          .p360-attendance-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .p360-attendance-player, .p360-att-notes, .p360-save-attendance, .p360-load-value {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 640px) {
          .p360-training-view {
            padding: 12px;
            padding-bottom: calc(104px + env(safe-area-inset-bottom, 0px));
            gap: 14px;
          }
          .p360-hero { display: grid; border-radius: 12px; }
          .p360-context-pill { justify-self: start; white-space: normal; }
          .p360-kpi-grid { grid-template-columns: 1fr 1fr; }
          .p360-form-grid { grid-template-columns: 1fr; }
          .p360-span-2 { grid-column: auto; }
          .p360-block-row { grid-template-columns: 1fr; padding-top: 46px; }
          .p360-block-objective { grid-column: auto; }
          .p360-player-check-grid { grid-template-columns: 1fr; max-height: 240px; }
          .p360-subsection-head { display: grid; }
          .p360-subsection-head .p360-secondary-btn { width: 100%; }
          .p360-form-actions {
            display: grid;
            grid-template-columns: 1fr;
          }
          .p360-form-actions .p360-primary-btn,
          .p360-form-actions .p360-secondary-btn { width: 100%; }
          .p360-session-top { display: grid; }
          .p360-status, .p360-source-badge { justify-self: start; }
          .p360-attendance-row { grid-template-columns: 1fr 1fr; }
          .p360-attendance-bulk { align-items: stretch; flex-direction: column; }
          .p360-attendance-bulk .p360-secondary-btn { width: 100%; }
          .p360-add-participant-row { display: grid; }
        }
      </style>
    `;
  }

  _applyTab(container) {
    const trainingPanel = container.querySelector("#p360-panel-training");
    const externalPanel = container.querySelector("#p360-panel-external");
    const trainingTab = container.querySelector('[data-p360-tab="training"]');
    const externalTab = container.querySelector('[data-p360-tab="external"]');

    const external = this.activeTab === "external";
    if (trainingPanel) trainingPanel.hidden = external;
    if (externalPanel) externalPanel.hidden = !external;
    if (trainingTab) trainingTab.setAttribute("aria-selected", String(!external));
    if (externalTab) externalTab.setAttribute("aria-selected", String(external));
  }

  _refreshTrainingPlayerOptions(container, date, selectedIds = []) {
    const target = container.querySelector("#p360-training-player-options");
    if (!target) return;
    target.innerHTML = this._renderParticipantChecklist(date, selectedIds);
    this._bindParticipantSelectionTools(container);
  }

  _bindParticipantSelectionTools(container) {
    container.querySelector("#p360-select-all-players")?.addEventListener("click", () => {
      container.querySelectorAll('input[name="p360-training-player"]').forEach(input => {
        input.checked = true;
      });
    });

    container.querySelector("#p360-clear-all-players")?.addEventListener("click", () => {
      container.querySelectorAll('input[name="p360-training-player"]').forEach(input => {
        input.checked = false;
      });
    });
  }

  _collectBlocks(form) {
    return [...form.querySelectorAll(".p360-block-row")]
      .map((row, index) => {
        const title = row.querySelector(".p360-block-title")?.value.trim() || "";
        const code = row.querySelector(".p360-block-code")?.value.trim() || "";
        const duration = numberOrNull(row.querySelector(".p360-block-duration")?.value);
        const intensity = numberOrNull(row.querySelector(".p360-block-intensity")?.value);
        const objective = row.querySelector(".p360-block-objective-input")?.value.trim() || "";

        if (!title && !code && duration === null && intensity === null && !objective) {
          return null;
        }

        return {
          block_order: index + 1,
          title: title || code || `Bloque ${index + 1}`,
          activity_code: code || null,
          duration_minutes: duration,
          intensity,
          objective: objective || null
        };
      })
      .filter(Boolean);
  }

  async _bindEvents(container) {
    container.querySelectorAll("[data-p360-tab]").forEach(button => {
      button.addEventListener("click", () => {
        this.activeTab = button.dataset.p360Tab === "external" ? "external" : "training";
        this._applyTab(container);
      });
    });

    this._bindParticipantSelectionTools(container);

    const trainingDate = container.querySelector("#p360-training-date");
    trainingDate?.addEventListener("change", () => {
      const selectedIds = [...container.querySelectorAll('input[name="p360-training-player"]:checked')]
        .map(input => input.value);
      this._refreshTrainingPlayerOptions(container, trainingDate.value, selectedIds);
    });

    const trainingStart = container.querySelector("#p360-training-start-time");
    const trainingEnd = container.querySelector("#p360-training-end-time");
    const trainingDuration = container.querySelector("#p360-training-duration");
    const syncTrainingDuration = () => {
      if (!trainingDuration) return null;
      const duration = minutesBetweenTimes(trainingStart?.value, trainingEnd?.value);
      trainingDuration.value = duration === null ? "" : String(duration);
      return duration;
    };
    trainingStart?.addEventListener("input", syncTrainingDuration);
    trainingEnd?.addEventListener("input", syncTrainingDuration);

    let blockCounter = container.querySelectorAll(".p360-block-row").length;

    container.querySelector("#p360-cancel-training")?.addEventListener("click", async () => {
      if (this.editingSessionId) {
        this.editingSessionId = null;
        await this.render(this.containerId, this.teamId);
        return;
      }

      const panel = container.querySelector("#p360-create-training-panel");
      const form = container.querySelector("#p360-training-form");
      if (!form) return;
      form.reset();
      const blocks = container.querySelector("#p360-blocks-container");
      if (blocks) blocks.innerHTML = this._renderBlockRow(1);
      blockCounter = 1;
      const date = form.querySelector("#p360-training-date")?.value || this._defaultDate();
      this._refreshTrainingPlayerOptions(container, date);
      if (panel) panel.open = false;
    });

    container.querySelector("#p360-add-block")?.addEventListener("click", () => {
      blockCounter += 1;
      const target = container.querySelector("#p360-blocks-container");
      if (target) target.insertAdjacentHTML("beforeend", this._renderBlockRow(blockCounter));
    });

    if (this._delegatedClickContainer && this._delegatedClickHandler) {
      this._delegatedClickContainer.removeEventListener(
        "click",
        this._delegatedClickHandler
      );
    }

    this._delegatedClickHandler = async event => {
      const removeBlock = event.target.closest(".p360-remove-block");
      if (removeBlock) {
        const rows = container.querySelectorAll(".p360-block-row");
        if (rows.length <= 1) {
          rows[0]?.querySelectorAll("input").forEach(input => { input.value = ""; });
        } else {
          removeBlock.closest(".p360-block-row")?.remove();
        }
        return;
      }

      const saveAttendance = event.target.closest(".p360-save-attendance");
      if (saveAttendance) {
        const row = saveAttendance.closest(".p360-attendance-row");
        if (!row) return;

        saveAttendance.disabled = true;
        try {
          await this.service.setParticipant({
            trainingSessionId: saveAttendance.dataset.sessionId,
            playerId: saveAttendance.dataset.playerId,
            attendanceStatus: row.querySelector(".p360-att-status")?.value || "PLANNED",
            participatedMinutes: numberOrNull(row.querySelector(".p360-att-minutes")?.value),
            rpe: numberOrNull(row.querySelector(".p360-att-rpe")?.value),
            notes: row.querySelector(".p360-att-notes")?.value.trim() || null
          });
          await this.render(this.containerId, this.teamId);
        } catch (error) {
          console.error("[TrainingView] Error guardando asistencia:", error);
          alert(`❌ ${error.message || error}`);
          saveAttendance.disabled = false;
        }
        return;
      }

      const confirmPlanned = event.target.closest(".p360-confirm-planned");
      if (confirmPlanned) {
        const session = this.sessions.find(
          item => String(item.id) === String(confirmPlanned.dataset.sessionId)
        );
        const planned = (session?.participants || []).filter(
          participant => String(participant.attendance_status || "").toUpperCase() === "PLANNED"
        );
        if (!session || !planned.length) return;

        confirmPlanned.disabled = true;
        try {
          const duration = this._sessionDuration(session);
          for (const participant of planned) {
            await this.service.setParticipant({
              trainingSessionId: session.id,
              playerId: participant.player_id,
              attendanceStatus: "PRESENT",
              participatedMinutes: duration,
              rpe: numberOrNull(participant.rpe),
              notes: participant.notes || null
            });
          }
          await this.render(this.containerId, this.teamId);
        } catch (error) {
          console.error("[TrainingView] Error confirmando asistencia planificada:", error);
          alert(`❌ ${error.message || error}`);
          confirmPlanned.disabled = false;
        }
        return;
      }

      const addParticipant = event.target.closest(".p360-add-participant");
      if (addParticipant) {
        const wrapper = addParticipant.closest(".p360-add-participant-row");
        const playerId = wrapper?.querySelector(".p360-new-participant-player")?.value;
        if (!playerId) return;

        addParticipant.disabled = true;
        try {
          const session = this.sessions.find(
            item => String(item.id) === String(addParticipant.dataset.sessionId)
          );
          const alreadyOccurred = String(session?.session_date || "") <= localIsoDate();
          await this.service.setParticipant({
            trainingSessionId: addParticipant.dataset.sessionId,
            playerId,
            attendanceStatus: alreadyOccurred ? "PRESENT" : "PLANNED",
            participatedMinutes: alreadyOccurred
              ? this._sessionDuration(session)
              : null
          });
          await this.render(this.containerId, this.teamId);
        } catch (error) {
          console.error("[TrainingView] Error añadiendo participante:", error);
          alert(`❌ ${error.message || error}`);
          addParticipant.disabled = false;
        }
        return;
      }

      const editSession = event.target.closest(".p360-edit-session");
      if (editSession) {
        this.editingSessionId = editSession.dataset.sessionId;
        this.activeTab = "training";
        await this.render(this.containerId, this.teamId);
        document.querySelector("#p360-create-training-panel")?.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }

      const editExternal = event.target.closest(".p360-edit-external");
      if (editExternal) {
        this.editingExternalId = editExternal.dataset.externalId;
        this.activeTab = "external";
        await this.render(this.containerId, this.teamId);
        document.querySelector("#p360-create-external-panel")?.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }

      const archive = event.target.closest(".p360-archive-session");
      if (archive) {
        if (!confirm("¿Archivar esta sesión? Se conservarán sus datos históricos.")) return;
        archive.disabled = true;
        try {
          await this.service.archiveSession(archive.dataset.sessionId);
          await this.render(this.containerId, this.teamId);
        } catch (error) {
          console.error("[TrainingView] Error archivando sesión:", error);
          alert(`❌ ${error.message || error}`);
          archive.disabled = false;
        }
      }
    };

    container.addEventListener("click", this._delegatedClickHandler);
    this._delegatedClickContainer = container;

    container.querySelector("#p360-training-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      const date = form.querySelector("#p360-training-date")?.value;
      const title = form.querySelector("#p360-training-title")?.value.trim();

      if (!date || !title) {
        alert("⚠️ Indica fecha y nombre de la sesión.");
        return;
      }

      const selectedPlayers = [...form.querySelectorAll('input[name="p360-training-player"]:checked')]
        .map(input => input.value)
        .filter(Boolean);

      const startTime = form.querySelector("#p360-training-start-time")?.value || "";
      const endTime = form.querySelector("#p360-training-end-time")?.value || "";
      const durationMinutes = minutesBetweenTimes(startTime, endTime);

      if (durationMinutes === null) {
        alert("⚠️ Indica una hora de inicio y fin válidas. La hora de fin debe ser posterior al inicio.");
        return;
      }

      const alreadyOccurred = String(date) <= localIsoDate();
      const participants = selectedPlayers.map(playerId => ({
        player_id: playerId,
        attendance_status: alreadyOccurred ? "PRESENT" : "PLANNED",
        participated_minutes: alreadyOccurred ? durationMinutes : null
      }));

      submit.disabled = true;
      try {
        if (this.editingSessionId) {
          await this.service.updateSession({
            trainingSessionId: this.editingSessionId,
            sessionDate: date,
            title,
            objective: form.querySelector("#p360-training-objective")?.value.trim() || null,
            durationMinutes,
            intensity: numberOrNull(form.querySelector("#p360-training-intensity")?.value),
            startTime,
            endTime,
            blocks: this._collectBlocks(form),
            participantIds: selectedPlayers
          });
          this.editingSessionId = null;
        } else {
          await this.service.createSession({
            teamSeasonId: this.teamSeasonId,
            sessionDate: date,
            title,
            objective: form.querySelector("#p360-training-objective")?.value.trim() || null,
            durationMinutes,
            intensity: numberOrNull(form.querySelector("#p360-training-intensity")?.value),
            startTime,
            endTime,
            blocks: this._collectBlocks(form),
            participants
          });
        }
        await this.render(this.containerId, this.teamId);
      } catch (error) {
        console.error("[TrainingView] Error creando entrenamiento:", error);
        alert(`❌ ${error.message || error}`);
        submit.disabled = false;
      }
    });

    const externalDate = container.querySelector("#p360-external-date");
    externalDate?.addEventListener("change", () => {
      const select = container.querySelector("#p360-external-player");
      if (select) select.innerHTML = this._renderExternalPlayerOptions(externalDate.value);
    });

    container.querySelector("#p360-cancel-external")?.addEventListener("click", async () => {
      if (this.editingExternalId) {
        this.editingExternalId = null;
        await this.render(this.containerId, this.teamId);
        return;
      }
      const panel = container.querySelector("#p360-create-external-panel");
      const form = container.querySelector("#p360-external-form");
      if (!form) return;
      form.reset();
      const date = form.querySelector("#p360-external-date")?.value || this._defaultDate();
      const select = form.querySelector("#p360-external-player");
      if (select) select.innerHTML = this._renderExternalPlayerOptions(date);
      if (panel) panel.open = false;
    });

    container.querySelector("#p360-external-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');

      const date = form.querySelector("#p360-external-date")?.value;
      const playerId = form.querySelector("#p360-external-player")?.value;
      const title = form.querySelector("#p360-external-title")?.value.trim();

      if (!date || !playerId || !title) {
        alert("⚠️ Indica fecha, jugador y actividad.");
        return;
      }

      submit.disabled = true;
      try {
        const payload = {
          playerId,
          activityDate: date,
          title,
          activityCode: form.querySelector("#p360-external-code")?.value.trim() || null,
          providerType: form.querySelector("#p360-external-provider-type")?.value || null,
          providerName: form.querySelector("#p360-external-provider")?.value.trim() || null,
          objective: form.querySelector("#p360-external-objective")?.value.trim() || null,
          durationMinutes: numberOrNull(form.querySelector("#p360-external-duration")?.value),
          intensity: numberOrNull(form.querySelector("#p360-external-intensity")?.value),
          rpe: numberOrNull(form.querySelector("#p360-external-rpe")?.value),
          sourceType: PLAYER360_SOURCE_TYPE.EXTERNAL_COACH,
          notes: form.querySelector("#p360-external-notes")?.value.trim() || null,
          provenance: { entered_from: "IQBASKET_PLAYER360_UI" }
        };

        if (this.editingExternalId) {
          await this.service.updateExternalDevelopment({
            externalDevelopmentId: this.editingExternalId,
            ...payload
          });
          this.editingExternalId = null;
        } else {
          await this.service.createExternalDevelopment({
            teamSeasonId: this.teamSeasonId,
            ...payload
          });
        }
        this.activeTab = "external";
        await this.render(this.containerId, this.teamId);
      } catch (error) {
        console.error("[TrainingView] Error creando desarrollo externo:", error);
        alert(`❌ ${error.message || error}`);
        submit.disabled = false;
      }
    });
  }

  async render(containerId = "dashboard-content-area", teamId = null) {
    this.containerId = containerId;
    this.teamId = teamId || DataStore.getActiveTeamId?.() || null;
    this.teamSeasonId = DataStore.getActiveTeamSeasonId?.(this.teamId) || null;

    const container = document.getElementById(containerId);
    if (!container) return;

    if (!this.teamSeasonId) {
      container.innerHTML = `
        <section class="p360-training-view">
          <div class="p360-error">
            No se ha podido resolver un equipo-temporada activo. Selecciona una temporada antes de abrir Player 360 Training.
          </div>
        </section>
      `;
      return;
    }

    if (!this._can(Permission.VIEW_TRAINING)) {
      container.innerHTML = `
        <section class="p360-training-view">
          <div class="p360-error">Tu perfil no tiene permiso para consultar entrenamientos de este equipo-temporada.</div>
        </section>
      `;
      return;
    }

    await this._load();

    const seasonName = DataStore.getActiveSeasonDisplayName?.(this.teamId)
      || this._seasonContext()?.name
      || "Temporada activa";
    const teamName = DataStore.getTeamById?.(this.teamId)?.name || "Equipo";

    container.innerHTML = `
      <section class="p360-training-view">
        ${this._renderStyles()}

        <header class="p360-hero">
          <div>
            <h1>Player 360 · Entrenamiento</h1>
            <p>
              Registra qué se entrena, quién participa y qué carga genera.
              El desarrollo externo se mantiene separado para conservar la procedencia real de cada mejora.
            </p>
          </div>
          <span class="p360-context-pill">
            ${escapeHtml(teamName)} · ${escapeHtml(seasonName)}
          </span>
        </header>

        ${this.lastError ? `
          <div class="p360-error">
            No se ha podido cargar Player 360 Training: ${escapeHtml(this.lastError.message || this.lastError)}
          </div>
        ` : ""}

        ${!this.capabilities?.training_core ? `
          <div class="p360-readonly">
            El backend Training Core no está disponible en este entorno. No se permiten escrituras.
          </div>
        ` : ""}

        <div class="p360-tabs" role="tablist" aria-label="Player 360 Training">
          <button
            type="button"
            class="p360-tab"
            data-p360-tab="training"
            role="tab"
            aria-selected="${this.activeTab !== "external"}"
          >
            🏀 Entrenamientos
          </button>

          ${this._can(Permission.VIEW_EXTERNAL_DEVELOPMENT) ? `
            <button
              type="button"
              class="p360-tab"
              data-p360-tab="external"
              role="tab"
              aria-selected="${this.activeTab === "external"}"
            >
              ⚡ Desarrollo externo
            </button>
          ` : ""}
        </div>

        ${this._renderTrainingPanel()}
        ${this._can(Permission.VIEW_EXTERNAL_DEVELOPMENT)
          ? this._renderExternalPanel()
          : ""}
      </section>
    `;

    this._applyTab(container);
    await this._bindEvents(container);
  }
}

export default TrainingView;
