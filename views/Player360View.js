/**
 * Player 360 · Evaluation + Objective Profile view.
 *
 * Phase 4C responsibilities only:
 * - dated human evaluations;
 * - revision-safe editing;
 * - active objective profile;
 * - deterministic gaps.
 *
 * AI, Recovery, Nutrition and Neuro remain outside this view/phase.
 */

import { DataStore } from "../services/DataStore.js";
import { EvaluationService } from "../services/player360/EvaluationService.js";
import { TrainingService } from "../services/player360/TrainingService.js";
import { LongitudinalAnalyticsService } from "../services/player360/LongitudinalAnalyticsService.js";
import { LongitudinalAnalyticsOrchestrator } from "../services/player360/LongitudinalAnalyticsOrchestrator.js";
import { LongitudinalAnalyticsPanel } from "./player360/LongitudinalAnalyticsPanel.js";
import { WellnessService } from "../services/player360/WellnessService.js";
import { WellnessSupportPanel } from "./player360/WellnessSupportPanel.js";
import { ObjectiveGapCalculator } from "../domain/player360/ObjectiveGapCalculator.js";
import { Permission } from "../security/PermissionService.js";
import {
  PLAYER360_EVALUATION_DOMAIN_LABELS
} from "../config/player360.config.js";

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isoDate(value = "") {
  return String(value || "").slice(0, 10);
}

function localIsoDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function displayNumber(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0
  });
}

function playerName(player = {}) {
  return (
    player.name
    || [player.first_name, player.last_name].filter(Boolean).join(" ")
    || [player.firstName, player.lastName].filter(Boolean).join(" ")
    || "Jugador"
  );
}

function byDomain(metrics = []) {
  const map = new Map();
  (Array.isArray(metrics) ? metrics : []).forEach(metric => {
    const domain = String(metric.domain_code || "OTHER").toUpperCase();
    if (!map.has(domain)) map.set(domain, []);
    map.get(domain).push(metric);
  });
  return map;
}

export class Player360View {
  constructor(supabaseClient = null, authController = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;
    this.service = new EvaluationService(this.supabase);
    this.trainingService = new TrainingService(this.supabase);
    this.analyticsService = new LongitudinalAnalyticsService(this.supabase);
    this.analyticsOrchestrator = new LongitudinalAnalyticsOrchestrator({
      dataStore: DataStore,
      trainingService: this.trainingService,
      evaluationService: this.service,
      analyticsService: this.analyticsService
    });
    this.analyticsPanel = new LongitudinalAnalyticsPanel({
      analyticsService: this.analyticsService,
      orchestrator: this.analyticsOrchestrator,
      can: permission => this._can(permission)
    });
    this.wellnessService = new WellnessService(this.supabase);
    this.wellnessPanel = new WellnessSupportPanel({
      service: this.wellnessService,
      can: permission => this._can(permission)
    });

    this.containerId = "dashboard-content-area";
    this.teamId = null;
    this.teamSeasonId = null;
    this.playerId = null;
    this.player = null;

    this.capabilities = null;
    this.metrics = [];
    this.evaluations = [];
    this.objectiveProfile = null;
    this.gaps = [];
    this.lastError = null;
    this.isLoading = false;

    this.activeTab = "evaluation";
    this.editingEvaluationId = null;
  }

  _context() {
    return {
      teamId: this.teamId,
      teamSeasonId: this.teamSeasonId,
      playerId: this.playerId,
      playerTeamId: this.teamId
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

  _dateBounds() {
    const context = this._seasonContext();
    return {
      min: isoDate(context?.start_date || context?.startDate),
      max: isoDate(context?.end_date || context?.endDate)
    };
  }

  _defaultDate() {
    const today = localIsoDate();
    const { min, max } = this._dateBounds();
    if (min && today < min) return min;
    if (max && today > max) return max;
    return today;
  }

  _evaluationById(id) {
    return this.evaluations.find(row => String(row.id) === String(id)) || null;
  }

  _metricLabel(metric = {}) {
    return metric.name || metric.metric_name || metric.code || metric.metric_code || "Métrica";
  }

  _domainLabel(domain) {
    const code = String(domain || "OTHER").toUpperCase();
    return PLAYER360_EVALUATION_DOMAIN_LABELS[code] || code;
  }

  async _load() {
    this.isLoading = true;
    this.lastError = null;

    try {
      this.capabilities = await this.service.getCapabilities({ force: true });

      if (!this.capabilities?.ready) {
        this.metrics = [];
        this.evaluations = [];
        this.objectiveProfile = null;
        this.gaps = [];
        await this.wellnessPanel.load({
          teamId: this.teamId,
          teamSeasonId: this.teamSeasonId,
          playerId: this.playerId,
          dateBounds: this._dateBounds()
        });
        return;
      }

      const canViewEvaluation = this._can(Permission.VIEW_PLAYER_EVALUATION);
      const canViewObjective = this._can(Permission.VIEW_OBJECTIVE_PROFILE);

      const [metrics, evaluations, objectiveProfile] = await Promise.all([
        (canViewEvaluation || canViewObjective)
          ? this.service.listMetrics({ teamSeasonId: this.teamSeasonId })
          : Promise.resolve([]),
        canViewEvaluation
          ? this.service.listEvaluations({
              teamSeasonId: this.teamSeasonId,
              playerId: this.playerId,
              includeHistory: false
            })
          : Promise.resolve([]),
        canViewObjective
          ? this.service.getActiveObjectiveProfile({
              teamSeasonId: this.teamSeasonId,
              playerId: this.playerId
            })
          : Promise.resolve(null)
      ]);

      this.metrics = metrics;
      this.evaluations = evaluations;
      this.objectiveProfile = objectiveProfile;

      this.gaps = objectiveProfile?.id
        ? await this.service.getObjectiveGap(objectiveProfile.id)
        : [];

      await Promise.all([
        this.analyticsPanel.load({
          teamId: this.teamId,
          teamSeasonId: this.teamSeasonId,
          playerId: this.playerId,
          dateBounds: this._dateBounds(),
          evaluationMetrics: this.metrics
        }),
        this.wellnessPanel.load({
          teamId: this.teamId,
          teamSeasonId: this.teamSeasonId,
          playerId: this.playerId,
          dateBounds: this._dateBounds()
        })
      ]);
    } catch (error) {
      console.error("[Player360View] Error cargando Phase 4C:", error);
      this.lastError = error;
    } finally {
      this.isLoading = false;
    }
  }

  _renderStyles() {
    return `
      <style>
        .p360c-view {
          width: 100%;
          max-width: 1280px;
          margin: 0 auto;
          display: grid;
          gap: 16px;
          color: #0f172a;
          font-family: var(--font-family-base, system-ui, -apple-system, sans-serif);
          box-sizing: border-box;
        }
        .p360c-view * { box-sizing: border-box; }
        .p360c-back {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          width: fit-content;
          color: #475569;
          text-decoration: none;
          font-weight: 700;
          font-size: 13px;
        }
        .p360c-hero {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          padding: 20px;
          border-radius: 16px;
          background: linear-gradient(135deg, #0f172a, #1e3a8a);
          color: white;
        }
        .p360c-hero h1 { margin: 0 0 5px; font-size: clamp(22px, 4vw, 30px); }
        .p360c-hero p { margin: 0; color: #dbeafe; line-height: 1.5; }
        .p360c-context {
          flex: 0 0 auto;
          border: 1px solid rgba(255,255,255,.24);
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }
        .p360c-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: thin;
        }
        .p360c-tab {
          min-height: 44px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 9px 14px;
          background: white;
          color: #475569;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }
        .p360c-tab[aria-selected="true"] {
          background: #1e3a8a;
          color: white;
          border-color: #1e3a8a;
        }
        .p360c-panel { display: grid; gap: 14px; min-width: 0; }
        .p360c-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px;
          min-width: 0;
        }
        .p360c-section-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        .p360c-section-head h2,
        .p360c-section-head h3 { margin: 0; }
        .p360c-section-head p { margin: 4px 0 0; color: #64748b; font-size: 12px; line-height: 1.5; }
        .p360c-badge {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          border-radius: 999px;
          padding: 4px 9px;
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
        }
        .p360c-badge-private { background: #fef3c7; color: #92400e; }
        .p360c-badge-current { background: #dcfce7; color: #166534; }
        .p360c-form { display: grid; gap: 14px; }
        .p360c-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .p360c-form label {
          display: grid;
          gap: 6px;
          min-width: 0;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
        }
        .p360c-form input,
        .p360c-form select,
        .p360c-form textarea {
          width: 100%;
          min-height: 44px;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          padding: 9px 10px;
          background: white;
          color: #0f172a;
          font: inherit;
        }
        .p360c-form textarea { resize: vertical; min-height: 88px; }
        .p360c-span-2 { grid-column: 1 / -1; }
        .p360c-check {
          display: flex !important;
          grid-template-columns: none !important;
          align-items: center;
          gap: 8px !important;
          min-height: 44px;
        }
        .p360c-check input { width: 18px; min-height: 18px; }
        .p360c-domain-groups { display: grid; gap: 14px; }
        .p360c-domain {
          display: grid;
          gap: 8px;
          border-top: 1px solid #e2e8f0;
          padding-top: 12px;
        }
        .p360c-domain:first-child { border-top: 0; padding-top: 0; }
        .p360c-domain-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .06em;
          color: #1e3a8a;
          font-weight: 900;
        }
        .p360c-metric-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .p360c-metric {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px;
          background: #f8fafc;
          min-width: 0;
        }
        .p360c-metric label { gap: 5px; }
        .p360c-metric small { color: #64748b; font-weight: 500; line-height: 1.4; }
        .p360c-target-row {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(90px,.6fr) minmax(90px,.6fr);
          gap: 8px;
          align-items: end;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px;
          background: #f8fafc;
        }
        .p360c-target-label { display: grid; gap: 3px; }
        .p360c-target-label strong { font-size: 13px; }
        .p360c-target-label span { color: #64748b; font-size: 11px; }
        .p360c-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }
        .p360c-primary, .p360c-secondary, .p360c-danger {
          min-height: 44px;
          border-radius: 9px;
          padding: 9px 13px;
          font-weight: 800;
          cursor: pointer;
        }
        .p360c-primary { background: #1e3a8a; color: white; border: 1px solid #1e3a8a; }
        .p360c-secondary { background: white; color: #334155; border: 1px solid #cbd5e1; }
        .p360c-danger { background: #fff; color: #b91c1c; border: 1px solid #fecaca; }
        .p360c-history { display: grid; gap: 10px; }
        .p360c-eval-card { display: grid; gap: 12px; }
        .p360c-eval-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }
        .p360c-eval-top h3 { margin: 3px 0 0; font-size: 16px; }
        .p360c-meta { color: #64748b; font-size: 11px; font-weight: 700; }
        .p360c-copy-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap: 8px;
        }
        .p360c-copy {
          background: #f8fafc;
          border-radius: 9px;
          padding: 10px;
          min-width: 0;
        }
        .p360c-copy span {
          display: block;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 4px;
        }
        .p360c-copy p {
          margin: 0;
          color: #334155;
          font-size: 12px;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .p360c-score-list {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .p360c-score {
          border: 1px solid #dbeafe;
          background: #eff6ff;
          color: #1e3a8a;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 800;
        }
        .p360c-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap: 8px;
        }
        .p360c-kpi {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px;
          background: white;
          display: grid;
          gap: 3px;
        }
        .p360c-kpi span { color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; }
        .p360c-kpi strong { font-size: 20px; }
        .p360c-gap-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .p360c-gap {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 11px;
          display: grid;
          gap: 5px;
          background: white;
        }
        .p360c-gap-head { display: flex; justify-content: space-between; gap: 8px; }
        .p360c-gap-title { font-weight: 900; font-size: 13px; }
        .p360c-gap-domain { color: #64748b; font-size: 10px; font-weight: 800; }
        .p360c-gap-values { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; }
        .p360c-gap-status { font-size: 11px; font-weight: 900; }
        .p360c-gap-pending { color: #b45309; }
        .p360c-gap-met { color: #15803d; }
        .p360c-gap-missing { color: #64748b; }
        .p360c-empty, .p360c-error, .p360c-note {
          border-radius: 10px;
          padding: 13px;
          font-size: 12px;
          line-height: 1.5;
        }
        .p360c-empty { border: 1px dashed #cbd5e1; color: #64748b; background: #f8fafc; text-align: center; }
        .p360c-error { border: 1px solid #fecaca; color: #991b1b; background: #fef2f2; }
        .p360c-note { border: 1px solid #bae6fd; color: #0c4a6e; background: #f0f9ff; }
        details.p360c-card > summary {
          min-height: 44px;
          cursor: pointer;
          font-weight: 900;
          display: flex;
          align-items: center;
          list-style: none;
        }
        details.p360c-card > summary::-webkit-details-marker { display:none; }

        @media (max-width: 900px) {
          .p360c-metric-grid, .p360c-gap-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .p360c-copy-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .p360c-view { gap: 12px; }
          .p360c-hero { display: grid; padding: 16px; border-radius: 12px; }
          .p360c-context { justify-self: start; white-space: normal; }
          .p360c-form-grid { grid-template-columns: 1fr; }
          .p360c-span-2 { grid-column: auto; }
          .p360c-metric-grid, .p360c-gap-grid { grid-template-columns: 1fr; }
          .p360c-target-row { grid-template-columns: 1fr 1fr; }
          .p360c-target-label { grid-column: 1 / -1; }
          .p360c-kpis { grid-template-columns: 1fr 1fr; }
          .p360c-eval-top, .p360c-section-head { display: grid; }
          .p360c-actions { display: grid; grid-template-columns: 1fr; }
          .p360c-actions > * { width: 100%; }
        }
      </style>
    `;
  }

  _renderTabs() {
    const tabs = [];
    if (this._can(Permission.VIEW_PLAYER_EVALUATION)) {
      tabs.push({ id: "evaluation", label: "🧭 Evaluación" });
    }
    if (this._can(Permission.VIEW_OBJECTIVE_PROFILE)) {
      tabs.push({ id: "objective", label: "🎯 Perfil objetivo" });
    }
    if (this.analyticsPanel.isAvailable()) {
      tabs.push({ id: "analytics", label: "📈 Evolución + IA" });
    }
    if (this.wellnessPanel.isAvailable()) {
      tabs.push({ id: "wellness", label: "🌱 Apoyo" });
    }

    if (!tabs.some(tab => tab.id === this.activeTab)) {
      this.activeTab = tabs[0]?.id || "evaluation";
    }

    return `
      <div class="p360c-tabs" role="tablist" aria-label="Player 360">
        ${tabs.map(tab => `
          <button
            type="button"
            class="p360c-tab"
            data-p360c-tab="${tab.id}"
            aria-selected="${this.activeTab === tab.id}"
          >${tab.label}</button>
        `).join("")}
      </div>
    `;
  }

  _renderMetricInputs(existingScores = []) {
    const existing = new Map(
      (existingScores || []).map(score => [
        String(score.metric_code || "").toUpperCase(),
        score
      ])
    );

    return [...byDomain(this.metrics).entries()].map(([domain, metrics]) => `
      <section class="p360c-domain">
        <div class="p360c-domain-title">${escapeHtml(this._domainLabel(domain))}</div>
        <div class="p360c-metric-grid">
          ${metrics.map(metric => {
            const value = existing.get(String(metric.code).toUpperCase())?.score ?? "";
            return `
              <div class="p360c-metric">
                <label>
                  <span>${escapeHtml(metric.name)}</span>
                  <input
                    class="p360c-eval-score"
                    data-metric-code="${escapeHtml(metric.code)}"
                    type="number"
                    inputmode="decimal"
                    min="${escapeHtml(metric.scale_min)}"
                    max="${escapeHtml(metric.scale_max)}"
                    step="${escapeHtml(metric.scale_step)}"
                    value="${escapeHtml(value)}"
                    placeholder="—"
                    aria-label="${escapeHtml(metric.name)}"
                  />
                  <small>Escala ${escapeHtml(metric.scale_min)}–${escapeHtml(metric.scale_max)}</small>
                </label>
              </div>
            `;
          }).join("")}
        </div>
      </section>
    `).join("");
  }

  _renderEvaluationForm() {
    const canCreate = this._can(Permission.CREATE_PLAYER_EVALUATION);
    const canEdit = this._can(Permission.EDIT_PLAYER_EVALUATION);
    const editing = this.editingEvaluationId
      ? this._evaluationById(this.editingEvaluationId)
      : null;

    if ((!editing && !canCreate) || (editing && !canEdit)) return "";

    const { min, max } = this._dateBounds();
    const date = editing?.evaluation_date || this._defaultDate();

    return `
      <details class="p360c-card" id="p360c-evaluation-editor" ${editing ? "open" : ""}>
        <summary>
          ${editing ? "✏️ Crear nueva revisión de la evaluación" : "＋ Nueva evaluación"}
        </summary>
        <form class="p360c-form" id="p360c-evaluation-form">
          <div class="p360c-note">
            Una edición no sobrescribe el histórico: crea una nueva revisión y conserva la anterior.
          </div>

          <div class="p360c-form-grid">
            <label>
              <span>Fecha *</span>
              <input
                id="p360c-evaluation-date"
                type="date"
                required
                min="${escapeHtml(min)}"
                max="${escapeHtml(max)}"
                value="${escapeHtml(date)}"
              />
            </label>
            <label>
              <span>Tipo</span>
              <select id="p360c-evaluation-type">
                ${["GENERAL","TECHNICAL","TACTICAL","PHYSICAL"].map(type => `
                  <option value="${type}" ${String(editing?.evaluation_type || "GENERAL") === type ? "selected" : ""}>
                    ${type === "GENERAL" ? "General" : this._domainLabel(type)}
                  </option>
                `).join("")}
              </select>
            </label>
            <label class="p360c-span-2">
              <span>Título *</span>
              <input
                id="p360c-evaluation-title"
                type="text"
                required
                maxlength="140"
                value="${escapeHtml(editing?.title || "")}"
                placeholder="Ej. Evaluación mensual de desarrollo"
              />
            </label>
            <label>
              <span>Procedencia</span>
              <select id="p360c-evaluation-source">
                ${[
                  ["CLUB_COACH","Entrenador del club"],
                  ["EXTERNAL_COACH","Entrenador / tecnificador externo"],
                  ["OTHER","Otra fuente"]
                ].map(([value,label]) => `
                  <option value="${value}" ${String(editing?.source_type || "CLUB_COACH") === value ? "selected" : ""}>
                    ${label}
                  </option>
                `).join("")}
              </select>
            </label>
            <label>
              <span>Nombre del evaluador externo (opcional)</span>
              <input
                id="p360c-evaluator-name"
                type="text"
                maxlength="120"
                value="${escapeHtml(editing?.evaluator_name || "")}"
              />
            </label>
            <label class="p360c-span-2">
              <span>Resumen</span>
              <textarea id="p360c-evaluation-summary">${escapeHtml(editing?.summary || "")}</textarea>
            </label>
            <label>
              <span>Fortalezas</span>
              <textarea id="p360c-evaluation-strengths">${escapeHtml(editing?.strengths || "")}</textarea>
            </label>
            <label>
              <span>Prioridades de desarrollo</span>
              <textarea id="p360c-evaluation-priorities">${escapeHtml(editing?.development_priorities || "")}</textarea>
            </label>
            <label class="p360c-check p360c-span-2">
              <input
                id="p360c-evaluation-private"
                type="checkbox"
                ${editing?.is_private ? "checked" : ""}
              />
              <span>Evaluación privada para roles autorizados del cuerpo técnico</span>
            </label>
          </div>

          <div class="p360c-domain-groups">
            ${this._renderMetricInputs(editing?.scores || [])}
          </div>

          <div class="p360c-actions">
            ${editing ? `
              <button type="button" class="p360c-secondary" id="p360c-cancel-evaluation-edit">
                Cancelar revisión
              </button>
            ` : ""}
            <button type="submit" class="p360c-primary">
              ${editing ? "Guardar nueva revisión" : "Guardar evaluación"}
            </button>
          </div>
        </form>
      </details>
    `;
  }

  _renderEvaluationCard(evaluation) {
    const canEdit = this._can(Permission.EDIT_PLAYER_EVALUATION);
    const canArchive = this._can(Permission.ARCHIVE_PLAYER_EVALUATION);

    return `
      <article class="p360c-card p360c-eval-card">
        <div class="p360c-eval-top">
          <div>
            <div class="p360c-meta">
              ${escapeHtml(evaluation.evaluation_date)} · revisión ${escapeHtml(evaluation.revision || 1)}
            </div>
            <h3>${escapeHtml(evaluation.title)}</h3>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <span class="p360c-badge p360c-badge-current">Actual</span>
            ${evaluation.is_private
              ? '<span class="p360c-badge p360c-badge-private">Privada</span>'
              : '<span class="p360c-badge">Staff</span>'}
          </div>
        </div>

        <div class="p360c-meta">
          ${escapeHtml(evaluation.evaluation_type || "GENERAL")} ·
          ${escapeHtml(evaluation.source_type || "CLUB_COACH")}
          ${evaluation.evaluator_name ? " · " + escapeHtml(evaluation.evaluator_name) : ""}
        </div>

        <div class="p360c-score-list">
          ${(evaluation.scores || []).map(score => `
            <span class="p360c-score">
              ${escapeHtml(score.metric_name || score.metric_code)}:
              ${displayNumber(score.score, 1)}
            </span>
          `).join("") || '<span class="p360c-meta">Sin puntuaciones visibles</span>'}
        </div>

        ${evaluation.summary || evaluation.strengths || evaluation.development_priorities ? `
          <div class="p360c-copy-grid">
            <div class="p360c-copy">
              <span>Resumen</span>
              <p>${escapeHtml(evaluation.summary || "—")}</p>
            </div>
            <div class="p360c-copy">
              <span>Fortalezas</span>
              <p>${escapeHtml(evaluation.strengths || "—")}</p>
            </div>
            <div class="p360c-copy">
              <span>Prioridades</span>
              <p>${escapeHtml(evaluation.development_priorities || "—")}</p>
            </div>
          </div>
        ` : ""}

        ${canEdit || canArchive ? `
          <div class="p360c-actions">
            ${canEdit ? `
              <button
                type="button"
                class="p360c-secondary p360c-edit-evaluation"
                data-evaluation-id="${escapeHtml(evaluation.id)}"
              >✏️ Revisar</button>
            ` : ""}
            ${canArchive ? `
              <button
                type="button"
                class="p360c-danger p360c-archive-evaluation"
                data-evaluation-id="${escapeHtml(evaluation.id)}"
              >Archivar</button>
            ` : ""}
          </div>
        ` : ""}
      </article>
    `;
  }

  _renderEvaluationPanel() {
    if (!this._can(Permission.VIEW_PLAYER_EVALUATION)) {
      return '<div class="p360c-error">Tu perfil no puede consultar evaluaciones de este jugador.</div>';
    }

    return `
      <section class="p360c-panel" id="p360c-panel-evaluation">
        ${this._renderEvaluationForm()}

        <div class="p360c-section-head">
          <div>
            <h2>Histórico de evaluaciones</h2>
            <p>Cada fecha representa una observación humana estructurada; no sustituye las estadísticas objetivas.</p>
          </div>
          <span class="p360c-badge">${this.evaluations.length} actuales</span>
        </div>

        <div class="p360c-history">
          ${this.evaluations.length
            ? this.evaluations.map(item => this._renderEvaluationCard(item)).join("")
            : '<div class="p360c-empty">Todavía no hay evaluaciones registradas para esta temporada.</div>'}
        </div>
      </section>
    `;
  }

  _renderTargetInputs() {
    const currentTargets = new Map(
      (this.objectiveProfile?.targets || []).map(target => [
        String(target.metric_code || "").toUpperCase(),
        target
      ])
    );

    return [...byDomain(this.metrics).entries()].map(([domain, metrics]) => `
      <section class="p360c-domain">
        <div class="p360c-domain-title">${escapeHtml(this._domainLabel(domain))}</div>
        <div style="display:grid;gap:8px;">
          ${metrics.map(metric => {
            const current = currentTargets.get(String(metric.code).toUpperCase());
            return `
              <div class="p360c-target-row">
                <div class="p360c-target-label">
                  <strong>${escapeHtml(metric.name)}</strong>
                  <span>Escala ${escapeHtml(metric.scale_min)}–${escapeHtml(metric.scale_max)}</span>
                </div>
                <label>
                  <span>Objetivo</span>
                  <input
                    class="p360c-target-score"
                    data-metric-code="${escapeHtml(metric.code)}"
                    type="number"
                    inputmode="decimal"
                    min="${escapeHtml(metric.scale_min)}"
                    max="${escapeHtml(metric.scale_max)}"
                    step="${escapeHtml(metric.scale_step)}"
                    value="${escapeHtml(current?.target_score ?? "")}"
                    placeholder="—"
                  />
                </label>
                <label>
                  <span>Prioridad</span>
                  <input
                    class="p360c-target-weight"
                    data-metric-code="${escapeHtml(metric.code)}"
                    type="number"
                    inputmode="decimal"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value="${escapeHtml(current?.priority_weight ?? 1)}"
                  />
                </label>
              </div>
            `;
          }).join("")}
        </div>
      </section>
    `).join("");
  }

  _renderObjectiveForm() {
    const canCreate = this._can(Permission.CREATE_OBJECTIVE_PROFILE);
    const canEdit = this._can(Permission.EDIT_OBJECTIVE_PROFILE);
    const hasProfile = Boolean(this.objectiveProfile?.id);
    if ((!hasProfile && !canCreate) || (hasProfile && !canEdit)) return "";

    const { min, max } = this._dateBounds();
    const effectiveDate = this.objectiveProfile?.effective_date || this._defaultDate();

    return `
      <details class="p360c-card" id="p360c-objective-editor">
        <summary>
          ${hasProfile ? "✏️ Revisar perfil objetivo" : "＋ Crear perfil objetivo"}
        </summary>
        <form class="p360c-form" id="p360c-objective-form">
          <div class="p360c-note">
            Guardar cambios crea una nueva revisión del perfil. Los gaps se calculan de forma determinista contra la última evaluación disponible.
          </div>

          <div class="p360c-form-grid">
            <label>
              <span>Fecha de vigencia *</span>
              <input
                id="p360c-objective-effective-date"
                type="date"
                required
                min="${escapeHtml(min)}"
                max="${escapeHtml(max)}"
                value="${escapeHtml(effectiveDate)}"
              />
            </label>
            <label>
              <span>Fecha objetivo</span>
              <input
                id="p360c-objective-target-date"
                type="date"
                min="${escapeHtml(effectiveDate || min)}"
                max="${escapeHtml(max)}"
                value="${escapeHtml(this.objectiveProfile?.target_date || "")}"
              />
            </label>
            <label class="p360c-span-2">
              <span>Nombre del perfil *</span>
              <input
                id="p360c-objective-title"
                type="text"
                required
                maxlength="140"
                value="${escapeHtml(this.objectiveProfile?.title || "")}"
                placeholder="Ej. Perfil objetivo final de temporada"
              />
            </label>
            <label class="p360c-span-2">
              <span>Razonamiento / propósito</span>
              <textarea id="p360c-objective-rationale">${escapeHtml(this.objectiveProfile?.rationale || "")}</textarea>
            </label>
          </div>

          <div class="p360c-domain-groups">
            ${this._renderTargetInputs()}
          </div>

          <div class="p360c-actions">
            <button type="submit" class="p360c-primary">
              ${hasProfile ? "Guardar nueva revisión" : "Crear perfil objetivo"}
            </button>
          </div>
        </form>
      </details>
    `;
  }

  _renderGapCard(row) {
    const status = ObjectiveGapCalculator.classify(row);
    const statusMarkup = status === "NO_DATA"
      ? '<span class="p360c-gap-status p360c-gap-missing">Sin evaluación</span>'
      : (status === "TARGET_MET"
        ? '<span class="p360c-gap-status p360c-gap-met">Objetivo alcanzado</span>'
        : `<span class="p360c-gap-status p360c-gap-pending">Faltan ${displayNumber(row.gap_to_target, 1)}</span>`);

    return `
      <div class="p360c-gap">
        <div class="p360c-gap-head">
          <div>
            <div class="p360c-gap-title">${escapeHtml(row.metric_name || row.metric_code)}</div>
            <div class="p360c-gap-domain">${escapeHtml(this._domainLabel(row.domain_code))}</div>
          </div>
          ${statusMarkup}
        </div>
        <div class="p360c-gap-values">
          <span>Actual: <strong>${displayNumber(row.current_score, 1)}</strong></span>
          <span>Objetivo: <strong>${displayNumber(row.target_score, 1)}</strong></span>
          <span>Prioridad: <strong>${displayNumber(row.priority_weight, 1)}</strong></span>
        </div>
      </div>
    `;
  }

  _renderObjectivePanel() {
    if (!this._can(Permission.VIEW_OBJECTIVE_PROFILE)) {
      return '<div class="p360c-error">Tu perfil no puede consultar el perfil objetivo de este jugador.</div>';
    }

    const summary = ObjectiveGapCalculator.summarize(this.gaps);

    return `
      <section class="p360c-panel" id="p360c-panel-objective">
        ${this._renderObjectiveForm()}

        ${this.objectiveProfile ? `
          <article class="p360c-card">
            <div class="p360c-section-head">
              <div>
                <h2>${escapeHtml(this.objectiveProfile.title)}</h2>
                <p>
                  Vigente desde ${escapeHtml(this.objectiveProfile.effective_date)}
                  ${this.objectiveProfile.target_date
                    ? " · objetivo " + escapeHtml(this.objectiveProfile.target_date)
                    : ""}
                  · revisión ${escapeHtml(this.objectiveProfile.revision || 1)}
                </p>
              </div>
              <span class="p360c-badge p360c-badge-current">Perfil activo</span>
            </div>

            ${this.objectiveProfile.rationale
              ? `<div class="p360c-note">${escapeHtml(this.objectiveProfile.rationale)}</div>`
              : ""}

            <div class="p360c-kpis" style="margin-top:12px;">
              <div class="p360c-kpi"><span>Objetivos</span><strong>${summary.total_targets}</strong></div>
              <div class="p360c-kpi"><span>Con datos</span><strong>${summary.targets_with_data}</strong></div>
              <div class="p360c-kpi"><span>Alcanzados</span><strong>${summary.targets_met}</strong></div>
              <div class="p360c-kpi"><span>Pendientes</span><strong>${summary.targets_pending}</strong></div>
            </div>

            <div class="p360c-gap-grid" style="margin-top:12px;">
              ${this.gaps.map(row => this._renderGapCard(row)).join("")}
            </div>

            ${this._can(Permission.ARCHIVE_OBJECTIVE_PROFILE) ? `
              <div class="p360c-actions" style="margin-top:12px;">
                <button
                  type="button"
                  class="p360c-danger"
                  id="p360c-archive-objective"
                  data-profile-id="${escapeHtml(this.objectiveProfile.id)}"
                >Archivar perfil objetivo</button>
              </div>
            ` : ""}
          </article>
        ` : '<div class="p360c-empty">Todavía no existe un perfil objetivo activo para este jugador.</div>'}
      </section>
    `;
  }

  _renderBody() {
    if (this.activeTab === "objective") return this._renderObjectivePanel();
    if (this.activeTab === "analytics") return this.analyticsPanel.render();
    if (this.activeTab === "wellness") return this.wellnessPanel.render();
    return this._renderEvaluationPanel();
  }

  _bindTabs(container) {
    container.querySelectorAll("[data-p360c-tab]").forEach(button => {
      button.addEventListener("click", () => {
        const requested = button.dataset.p360cTab;
        this.activeTab = ["evaluation", "objective", "analytics", "wellness"].includes(requested)
          ? requested
          : "evaluation";
        this._renderLoaded(container);
      });
    });
  }

  _collectEvaluationScores(form) {
    return [...form.querySelectorAll(".p360c-eval-score")]
      .map(input => {
        const score = finiteOrNull(input.value);
        if (score === null) return null;
        return {
          metric_code: input.dataset.metricCode,
          score
        };
      })
      .filter(Boolean);
  }

  _collectTargets(form) {
    const weights = new Map(
      [...form.querySelectorAll(".p360c-target-weight")].map(input => [
        input.dataset.metricCode,
        finiteOrNull(input.value) ?? 1
      ])
    );

    return [...form.querySelectorAll(".p360c-target-score")]
      .map(input => {
        const target = finiteOrNull(input.value);
        if (target === null) return null;
        return {
          metric_code: input.dataset.metricCode,
          target_score: target,
          priority_weight: weights.get(input.dataset.metricCode) ?? 1
        };
      })
      .filter(Boolean);
  }

  _bindEvaluationEvents(container) {
    container.querySelector("#p360c-cancel-evaluation-edit")?.addEventListener("click", () => {
      this.editingEvaluationId = null;
      this._renderLoaded(container);
    });

    container.querySelectorAll(".p360c-edit-evaluation").forEach(button => {
      button.addEventListener("click", () => {
        this.editingEvaluationId = button.dataset.evaluationId;
        this._renderLoaded(container);
        container.querySelector("#p360c-evaluation-editor")?.scrollIntoView({
          block: "start",
          behavior: "smooth"
        });
      });
    });

    container.querySelectorAll(".p360c-archive-evaluation").forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("¿Archivar esta evaluación? El histórico de revisiones se conservará.")) return;
        button.disabled = true;
        try {
          await this.service.archiveEvaluation(button.dataset.evaluationId);
          this.editingEvaluationId = null;
          await this.render(this.containerId, this.playerId, this.teamId);
        } catch (error) {
          console.error("[Player360View] Error archivando evaluación:", error);
          alert(`❌ ${error.message || error}`);
          button.disabled = false;
        }
      });
    });

    container.querySelector("#p360c-evaluation-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      const scores = this._collectEvaluationScores(form);

      if (!scores.length) {
        alert("⚠️ Puntúa al menos una métrica.");
        return;
      }

      submit.disabled = true;
      try {
        await this.service.saveEvaluation({
          teamSeasonId: this.teamSeasonId,
          playerId: this.playerId,
          evaluationDate: form.querySelector("#p360c-evaluation-date")?.value,
          title: form.querySelector("#p360c-evaluation-title")?.value.trim(),
          evaluationType: form.querySelector("#p360c-evaluation-type")?.value,
          sourceType: form.querySelector("#p360c-evaluation-source")?.value,
          evaluatorName: form.querySelector("#p360c-evaluator-name")?.value.trim() || null,
          summary: form.querySelector("#p360c-evaluation-summary")?.value.trim() || null,
          strengths: form.querySelector("#p360c-evaluation-strengths")?.value.trim() || null,
          developmentPriorities: form.querySelector("#p360c-evaluation-priorities")?.value.trim() || null,
          isPrivate: Boolean(form.querySelector("#p360c-evaluation-private")?.checked),
          shareWithPlayer: false,
          scores,
          provenance: { entered_from: "IQBASKET_PLAYER360_PHASE4C_UI" },
          existingEvaluationId: this.editingEvaluationId
        });

        this.editingEvaluationId = null;
        await this.render(this.containerId, this.playerId, this.teamId);
      } catch (error) {
        console.error("[Player360View] Error guardando evaluación:", error);
        alert(`❌ ${error.message || error}`);
        submit.disabled = false;
      }
    });
  }

  _bindObjectiveEvents(container) {
    const effectiveDate = container.querySelector("#p360c-objective-effective-date");
    effectiveDate?.addEventListener("change", () => {
      const targetDate = container.querySelector("#p360c-objective-target-date");
      if (targetDate) targetDate.min = effectiveDate.value;
    });

    container.querySelector("#p360c-objective-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      const targets = this._collectTargets(form);

      if (!targets.length) {
        alert("⚠️ Define al menos un objetivo.");
        return;
      }

      submit.disabled = true;
      try {
        await this.service.saveObjectiveProfile({
          teamSeasonId: this.teamSeasonId,
          playerId: this.playerId,
          effectiveDate: form.querySelector("#p360c-objective-effective-date")?.value,
          targetDate: form.querySelector("#p360c-objective-target-date")?.value || null,
          title: form.querySelector("#p360c-objective-title")?.value.trim(),
          rationale: form.querySelector("#p360c-objective-rationale")?.value.trim() || null,
          targets,
          provenance: { entered_from: "IQBASKET_PLAYER360_PHASE4C_UI" },
          expectedActiveProfileId: this.objectiveProfile?.id || null
        });

        await this.render(this.containerId, this.playerId, this.teamId);
      } catch (error) {
        console.error("[Player360View] Error guardando perfil objetivo:", error);
        alert(`❌ ${error.message || error}`);
        submit.disabled = false;
      }
    });

    container.querySelector("#p360c-archive-objective")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      if (!confirm("¿Archivar el perfil objetivo activo? Se conservará su histórico.")) return;
      button.disabled = true;

      try {
        await this.service.archiveObjectiveProfile(button.dataset.profileId);
        await this.render(this.containerId, this.playerId, this.teamId);
      } catch (error) {
        console.error("[Player360View] Error archivando perfil objetivo:", error);
        alert(`❌ ${error.message || error}`);
        button.disabled = false;
      }
    });
  }

  _renderLoaded(container) {
    const seasonName = DataStore.getActiveSeasonDisplayName?.(this.teamId)
      || this._seasonContext()?.name
      || "Temporada activa";
    const teamName = DataStore.getTeamById?.(this.teamId)?.name || "Equipo";

    container.innerHTML = `
      <section class="p360c-view">
        ${this._renderStyles()}
        <a class="p360c-back" href="#/player/${escapeHtml(this.playerId)}">← Volver a la ficha del jugador</a>

        <header class="p360c-hero">
          <div>
            <h1>Player 360 · ${escapeHtml(playerName(this.player))}</h1>
            <p>
              Evaluación humana, perfil objetivo, evolución longitudinal y apoyo de hábitos.
              Los check-ins de Nutrition/Recovery se mantienen separados de estadísticas e IA.
            </p>
          </div>
          <span class="p360c-context">${escapeHtml(teamName)} · ${escapeHtml(seasonName)}</span>
        </header>

        ${this.lastError ? `
          <div class="p360c-error">
            No se ha podido cargar Player 360: ${escapeHtml(this.lastError.message || this.lastError)}
          </div>
        ` : ""}

        ${!this.capabilities?.evaluation || !this.capabilities?.objective_profile ? `
          <div class="p360c-note">
            Algunas capacidades de Phase 4C no están disponibles en este entorno.
          </div>
        ` : ""}

        ${this._renderTabs()}
        ${this._renderBody()}
      </section>
    `;

    this._bindTabs(container);
    this._bindEvaluationEvents(container);
    this._bindObjectiveEvents(container);
    void this.analyticsPanel.bind(container, {
      onChanged: async () => {
        this.activeTab = "analytics";
        this._renderLoaded(container);
      }
    });
    void this.wellnessPanel.bind(container, {
      onChanged: async () => {
        this.activeTab = "wellness";
        this._renderLoaded(container);
      }
    });
  }

  async render(containerId = "dashboard-content-area", playerId = null, teamId = null) {
    this.containerId = containerId;
    this.teamId = teamId || DataStore.getActiveTeamId?.() || null;
    this.teamSeasonId = DataStore.getActiveTeamSeasonId?.(this.teamId) || null;
    this.playerId = playerId;
    this.player = DataStore.getPlayerById?.(playerId) || null;

    const container = document.getElementById(containerId);
    if (!container) return;

    if (!this.playerId || !this.player) {
      container.innerHTML = '<div class="p360c-error">Jugador no encontrado.</div>';
      return;
    }

    if (!this.teamSeasonId) {
      container.innerHTML = '<div class="p360c-error">No se ha podido resolver el equipo-temporada activo.</div>';
      return;
    }

    if (!this._can(Permission.VIEW_PLAYER_360)) {
      container.innerHTML = `
        <div class="p360c-error">
          Tu perfil no tiene permiso para consultar Player 360 de este jugador.
        </div>
      `;
      return;
    }

    await this._load();
    this._renderLoaded(container);
  }
}

export default Player360View;
