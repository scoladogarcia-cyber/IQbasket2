/**
 * Player 360 longitudinal analytics + AI evidence presentation.
 *
 * UI/controller responsibilities only:
 * - render deterministic snapshots and persisted AI insights;
 * - request snapshot generation through LongitudinalAnalyticsOrchestrator;
 * - review AI insights through the persistence boundary;
 * - never calculate metrics or call an external model directly.
 */

import { Permission } from "../../security/PermissionService.js";
import {
  PLAYER360_AI_UI_CONFIG,
  PLAYER360_LONGITUDINAL_ASSOCIATIONS,
  PLAYER360_LONGITUDINAL_SOURCE_METRICS
} from "../../config/player360-analytics.config.js";

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayNumber(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0
  });
}

function directionLabel(direction) {
  const normalized = String(direction || "").toUpperCase();
  if (normalized === "UP") return "↗ Tendencia ascendente";
  if (normalized === "DOWN") return "↘ Tendencia descendente";
  if (normalized === "STABLE") return "→ Tendencia estable";
  return "Datos insuficientes";
}

function statusLabel(status) {
  const normalized = String(status || "").toUpperCase();
  const labels = {
    DRAFT: "Borrador",
    APPROVED: "Aprobado",
    REJECTED: "Rechazado",
    ARCHIVED: "Archivado",
    READY: "Disponible",
    INSUFFICIENT_DATA: "Datos insuficientes",
    NO_VARIANCE: "Sin variación"
  };
  return labels[normalized] || normalized || "—";
}

function renderStructuredValue(value) {
  if (Array.isArray(value)) {
    return '<ul class="p360d-list">' + value
      .map(item => '<li>' + escapeHtml(
        typeof item === "object" ? JSON.stringify(item) : item
      ) + '</li>')
      .join("") + '</ul>';
  }
  if (value && typeof value === "object") {
    return '<pre class="p360d-pre">' + escapeHtml(JSON.stringify(value, null, 2)) + '</pre>';
  }
  return '<p>' + escapeHtml(value ?? "") + '</p>';
}

export class LongitudinalAnalyticsPanel {
  constructor({ analyticsService, orchestrator, can } = {}) {
    this.analyticsService = analyticsService;
    this.orchestrator = orchestrator;
    this.can = typeof can === "function" ? can : () => false;

    this.context = null;
    this.capabilities = null;
    this.snapshots = [];
    this.insights = [];
    this.selectedSnapshotId = null;
    this.lastError = null;
  }

  _can(permission) {
    return Boolean(this.can(permission));
  }

  _selectedSnapshot() {
    return this.snapshots.find(row =>
      String(row?.id || "") === String(this.selectedSnapshotId || "")
    ) || this.snapshots[0] || null;
  }

  _metricLabel(key) {
    const normalized = String(key || "");
    for (const [module, mappings] of Object.entries(PLAYER360_LONGITUDINAL_SOURCE_METRICS)) {
      const match = mappings.find(mapping =>
        normalized === module + "." + mapping.metric_code
      );
      if (match) return match.label;
    }

    if (normalized.startsWith("evaluation.")) {
      const code = normalized.split(".")[1] || "";
      const metric = (this.context?.evaluationMetrics || []).find(row =>
        String(row?.code || row?.metric_code || "").toUpperCase() === code.toUpperCase()
      );
      return metric?.name || code;
    }

    return normalized || "Métrica";
  }

  _associationLabel(association = {}) {
    const configured = PLAYER360_LONGITUDINAL_ASSOCIATIONS.find(item =>
      item.left === association.left
      && item.right === association.right
      && Number(item.lag_buckets || 0) === Number(association.lag_buckets || 0)
    );
    return configured?.label
      || this._metricLabel(association.left) + " ↔ " + this._metricLabel(association.right);
  }

  async load(context = {}) {
    this.context = { ...context };
    this.lastError = null;
    this.snapshots = [];
    this.insights = [];

    const canViewAnalytics = this._can(Permission.VIEW_LONGITUDINAL_ANALYTICS);
    const canViewAi = this._can(Permission.VIEW_AI_INSIGHTS);

    if ((!canViewAnalytics && !canViewAi) || !this.analyticsService?.supabase) {
      this.capabilities = null;
      return;
    }

    try {
      this.capabilities = await this.analyticsService.getCapabilities({ force: true });
      if (!this.capabilities?.ready) return;

      if (canViewAnalytics) {
        this.snapshots = await this.analyticsService.listSnapshots({
          teamSeasonId: context.teamSeasonId,
          playerId: context.playerId,
          limit: 50
        });
      }

      if (
        this.selectedSnapshotId
        && !this.snapshots.some(row => String(row.id) === String(this.selectedSnapshotId))
      ) {
        this.selectedSnapshotId = null;
      }
      this.selectedSnapshotId = this.selectedSnapshotId || this.snapshots[0]?.id || null;

      if (canViewAi && this.selectedSnapshotId) {
        this.insights = await this.analyticsService.listInsights({
          snapshotId: this.selectedSnapshotId,
          limit: 50
        });
      }
    } catch (error) {
      console.error("[LongitudinalAnalyticsPanel] Error cargando analítica:", error);
      this.lastError = error;
    }
  }

  isAvailable() {
    return Boolean(
      this.capabilities?.ready
      && (
        this._can(Permission.VIEW_LONGITUDINAL_ANALYTICS)
        || this._can(Permission.VIEW_AI_INSIGHTS)
      )
    );
  }

  _renderStyles() {
    return '<style>' +
      '.p360d-panel{display:grid;gap:14px;min-width:0}' +
      '.p360d-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;min-width:0}' +
      '.p360d-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}' +
      '.p360d-head h2,.p360d-head h3{margin:0}' +
      '.p360d-head p{margin:4px 0 0;color:#64748b;font-size:12px;line-height:1.5}' +
      '.p360d-period{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end}' +
      '.p360d-period label{display:grid;gap:5px;font-size:11px;font-weight:800;color:#475569}' +
      '.p360d-period input,.p360d-select,.p360d-review-notes{width:100%;min-height:44px;border:1px solid #cbd5e1;border-radius:9px;padding:9px 10px;background:#fff;color:#0f172a;font:inherit}' +
      '.p360d-primary,.p360d-secondary{min-height:44px;border-radius:9px;padding:9px 13px;font-weight:800;cursor:pointer}' +
      '.p360d-primary{background:#1e3a8a;color:#fff;border:1px solid #1e3a8a}' +
      '.p360d-secondary{background:#fff;color:#334155;border:1px solid #cbd5e1}' +
      '.p360d-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}' +
      '.p360d-kpi{border:1px solid #e2e8f0;border-radius:10px;padding:11px;background:#f8fafc;display:grid;gap:3px}' +
      '.p360d-kpi span{font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase}' +
      '.p360d-kpi strong{font-size:18px}' +
      '.p360d-series{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}' +
      '.p360d-series-card{border:1px solid #e2e8f0;border-radius:11px;padding:11px;display:grid;gap:7px;min-width:0}' +
      '.p360d-series-card h4{margin:0;font-size:13px}' +
      '.p360d-series-meta{display:flex;gap:7px;flex-wrap:wrap;font-size:10px;color:#64748b;font-weight:800}' +
      '.p360d-trend{font-size:12px;font-weight:900;color:#1e3a8a}' +
      '.p360d-associations,.p360d-insights{display:grid;gap:8px}' +
      '.p360d-association,.p360d-insight{border:1px solid #e2e8f0;border-radius:11px;padding:11px;display:grid;gap:8px}' +
      '.p360d-badge{display:inline-flex;width:fit-content;border-radius:999px;padding:4px 8px;background:#f1f5f9;color:#475569;font-size:10px;font-weight:900}' +
      '.p360d-badge-approved{background:#dcfce7;color:#166534}.p360d-badge-rejected{background:#fee2e2;color:#991b1b}.p360d-badge-draft{background:#fef3c7;color:#92400e}' +
      '.p360d-content{display:grid;gap:8px}.p360d-content h5{margin:0;font-size:11px;text-transform:uppercase;color:#64748b}.p360d-content p{margin:0;font-size:12px;line-height:1.5;color:#334155}' +
      '.p360d-list{margin:0;padding-left:20px;color:#334155;font-size:12px;line-height:1.5}' +
      '.p360d-pre{margin:0;max-width:100%;overflow:auto;white-space:pre-wrap;font-size:11px;background:#f8fafc;border-radius:8px;padding:9px}' +
      '.p360d-review{display:grid;gap:8px;border-top:1px solid #f1f5f9;padding-top:8px}.p360d-review-actions{display:flex;gap:8px;flex-wrap:wrap}' +
      '.p360d-note,.p360d-empty,.p360d-error{border-radius:10px;padding:12px;font-size:12px;line-height:1.5}' +
      '.p360d-note{background:#f0f9ff;border:1px solid #bae6fd;color:#0c4a6e}.p360d-empty{background:#f8fafc;border:1px dashed #cbd5e1;color:#64748b;text-align:center}.p360d-error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}' +
      '@media(max-width:900px){.p360d-series{grid-template-columns:repeat(2,minmax(0,1fr))}.p360d-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
      '@media(max-width:640px){.p360d-period{grid-template-columns:1fr}.p360d-period button{width:100%}.p360d-series{grid-template-columns:1fr}.p360d-head{display:grid}.p360d-review-actions{display:grid}.p360d-review-actions button{width:100%}}' +
      '</style>';
  }

  _renderSnapshotSelector() {
    if (!this.snapshots.length) return "";

    return '<label style="display:grid;gap:5px;font-size:11px;font-weight:800;color:#475569;">' +
      '<span>Snapshot analítico</span>' +
      '<select id="p360d-snapshot-select" class="p360d-select">' +
      this.snapshots.map(row => {
        const selected = String(row.id) === String(this.selectedSnapshotId) ? " selected" : "";
        return '<option value="' + escapeHtml(row.id) + '"' + selected + '>' +
          escapeHtml(String(row.period_start || "") + " → " + String(row.period_end || "")) +
          '</option>';
      }).join("") +
      '</select></label>';
  }

  _renderSeries(snapshot) {
    const series = Array.isArray(snapshot?.series) ? snapshot.series : [];
    if (!series.length) {
      return '<div class="p360d-empty">El snapshot no contiene series longitudinales.</div>';
    }

    return '<div class="p360d-series">' + series.map(item => {
      const trend = item.trend || {};
      const coverage = item.coverage || {};
      const change = Number.isFinite(Number(trend.relative_change_pct))
        ? displayNumber(trend.relative_change_pct, 1) + "%"
        : "—";
      return '<article class="p360d-series-card">' +
        '<h4>' + escapeHtml(this._metricLabel(item.key)) + '</h4>' +
        '<div class="p360d-series-meta">' +
          '<span>' + escapeHtml(item.module || "") + '</span>' +
          '<span>Cobertura ' + displayNumber(coverage.coverage_pct, 1) + '%</span>' +
          '<span>n=' + displayNumber(trend.sample_size, 0) + '</span>' +
        '</div>' +
        '<div class="p360d-trend">' + escapeHtml(directionLabel(trend.direction)) + '</div>' +
        '<div class="p360d-series-meta">' +
          '<span>' + displayNumber(trend.first_value, 1) + ' → ' + displayNumber(trend.last_value, 1) + '</span>' +
          '<span>Δ ' + escapeHtml(change) + '</span>' +
        '</div>' +
      '</article>';
    }).join("") + '</div>';
  }

  _renderAssociations(snapshot) {
    const associations = Array.isArray(snapshot?.associations) ? snapshot.associations : [];
    if (!associations.length) return "";

    return '<div class="p360d-card">' +
      '<div class="p360d-head"><div><h3>Patrones descriptivos</h3>' +
      '<p>Asociaciones temporales. Nunca se presentan como causalidad.</p></div></div>' +
      '<div class="p360d-associations">' +
      associations.map(item => {
        const ready = String(item.status).toUpperCase() === "READY";
        return '<article class="p360d-association">' +
          '<strong>' + escapeHtml(this._associationLabel(item)) + '</strong>' +
          '<div class="p360d-series-meta">' +
            '<span>' + escapeHtml(statusLabel(item.status)) + '</span>' +
            '<span>lag ' + displayNumber(item.lag_buckets, 0) + ' semana(s)</span>' +
            '<span>n=' + displayNumber(item.sample_size, 0) + '</span>' +
            (ready ? '<span>r=' + displayNumber(item.coefficient, 2) + '</span>' : '') +
          '</div>' +
          '<div class="p360d-note">Relación descriptiva: no demuestra causalidad ni permite atribuir causa y efecto.</div>' +
        '</article>';
      }).join("") +
      '</div></div>';
  }

  _renderInsightContent(content = {}) {
    const sections = [
      ["summary", "Resumen"],
      ["interpretation", "Interpretación"],
      ["priorities", "Prioridades"],
      ["recommendations", "Recomendaciones"],
      ["action_plan", "Plan de acción"]
    ].filter(([key]) => content?.[key] !== undefined && content?.[key] !== null);

    if (!sections.length) {
      return '<div class="p360d-content">' + renderStructuredValue(content) + '</div>';
    }

    return '<div class="p360d-content">' + sections.map(([key, label]) =>
      '<section><h5>' + label + '</h5>' + renderStructuredValue(content[key]) + '</section>'
    ).join("") + '</div>';
  }

  _renderInsights() {
    if (!this._can(Permission.VIEW_AI_INSIGHTS)) return "";
    const canReview = this._can(Permission.REVIEW_AI_INSIGHTS);

    const list = this.insights.length
      ? '<div class="p360d-insights">' + this.insights.map(insight => {
          const status = String(insight.status || "DRAFT").toUpperCase();
          const review = canReview && status === "DRAFT"
            ? '<div class="p360d-review">' +
                '<textarea class="p360d-review-notes" rows="2" placeholder="Nota de revisión opcional"></textarea>' +
                '<div class="p360d-review-actions">' +
                  '<button type="button" class="p360d-primary p360d-review-insight" data-insight-id="' + escapeHtml(insight.id) + '" data-review-status="APPROVED">Aprobar</button>' +
                  '<button type="button" class="p360d-secondary p360d-review-insight" data-insight-id="' + escapeHtml(insight.id) + '" data-review-status="REJECTED">Rechazar</button>' +
                '</div>' +
              '</div>'
            : "";

          return '<article class="p360d-insight">' +
            '<div class="p360d-head"><div>' +
              '<strong>' + escapeHtml(insight.audience || "STAFF") + '</strong>' +
              '<div class="p360d-series-meta"><span>' + escapeHtml(insight.provider || "") + '</span><span>' + escapeHtml(insight.model_name || "") + '</span><span>' + escapeHtml(insight.prompt_version || "") + '</span></div>' +
            '</div><span class="p360d-badge p360d-badge-' + escapeHtml(status.toLowerCase()) + '">' + escapeHtml(statusLabel(status)) + '</span></div>' +
            this._renderInsightContent(insight.content || {}) +
            review +
          '</article>';
        }).join("") + '</div>'
      : '<div class="p360d-empty">Todavía no hay interpretaciones IA guardadas para este snapshot.</div>';

    const generationNote = this._can(Permission.GENERATE_AI_INSIGHTS) && !PLAYER360_AI_UI_CONFIG.generationEnabled
      ? '<div class="p360d-note">La generación externa está bloqueada deliberadamente hasta desplegar el adaptador backend seguro. No se almacenan claves de proveedor ni se realizan llamadas a modelos desde el navegador.</div>'
      : "";

    return '<div class="p360d-card">' +
      '<div class="p360d-head"><div><h3>Interpretación IA</h3>' +
      '<p>Separada de la evidencia objetiva y sometida a revisión humana.</p></div></div>' +
      generationNote + list +
      '</div>';
  }

  render() {
    const selectedRow = this._selectedSnapshot();
    const snapshot = selectedRow?.snapshot || null;
    const evidence = selectedRow?.evidence_bundle || null;
    const bounds = this.context?.dateBounds || {};
    const canGenerate = this._can(Permission.GENERATE_LONGITUDINAL_ANALYTICS);

    const generator = canGenerate
      ? '<div class="p360d-card">' +
          '<div class="p360d-head"><div><h3>Actualizar evidencia longitudinal</h3>' +
          '<p>Recalcula con datos reales y respeta altas/bajas de plantilla por stint.</p></div></div>' +
          '<form id="p360d-generate-form" class="p360d-period">' +
            '<label><span>Desde</span><input id="p360d-period-from" type="date" value="' + escapeHtml(bounds.min || "") + '"' +
              (bounds.min ? ' min="' + escapeHtml(bounds.min) + '"' : '') +
              (bounds.max ? ' max="' + escapeHtml(bounds.max) + '"' : '') + ' required /></label>' +
            '<label><span>Hasta</span><input id="p360d-period-to" type="date" value="' + escapeHtml(bounds.max || "") + '"' +
              (bounds.min ? ' min="' + escapeHtml(bounds.min) + '"' : '') +
              (bounds.max ? ' max="' + escapeHtml(bounds.max) + '"' : '') + ' required /></label>' +
            '<button type="submit" class="p360d-primary">Generar snapshot</button>' +
          '</form>' +
        '</div>'
      : "";

    const snapshotArea = selectedRow
      ? '<div class="p360d-card">' +
          '<div class="p360d-head"><div><h2>Evolución longitudinal</h2>' +
          '<p>Datos deterministas; una tendencia ascendente o descendente no implica por sí misma mejora o empeoramiento.</p></div>' +
          this._renderSnapshotSelector() +
          '</div>' +
          '<div class="p360d-summary">' +
            '<div class="p360d-kpi"><span>Periodo</span><strong>' + escapeHtml(String(selectedRow.period_start || "") + " → " + String(selectedRow.period_end || "")) + '</strong></div>' +
            '<div class="p360d-kpi"><span>Semanas elegibles</span><strong>' + displayNumber(snapshot?.expected_buckets, 0) + '</strong></div>' +
            '<div class="p360d-kpi"><span>Hechos IA</span><strong>' + displayNumber(evidence?.facts?.length, 0) + '</strong></div>' +
            '<div class="p360d-kpi"><span>Datos ausentes</span><strong>' + displayNumber(evidence?.missing_data?.length, 0) + '</strong></div>' +
          '</div>' +
          '<div style="height:10px"></div>' +
          this._renderSeries(snapshot) +
        '</div>' +
        this._renderAssociations(snapshot) +
        this._renderInsights()
      : '<div class="p360d-empty">Todavía no existe un snapshot longitudinal para este jugador. Genera el primero para empezar a analizar evolución y cobertura.</div>';

    return '<section class="p360d-panel">' +
      this._renderStyles() +
      (this.lastError ? '<div class="p360d-error">' + escapeHtml(this.lastError.message || this.lastError) + '</div>' : '') +
      generator +
      snapshotArea +
      '</section>';
  }

  async bind(container, { onChanged } = {}) {
    const refresh = typeof onChanged === "function" ? onChanged : () => {};

    container.querySelector("#p360d-snapshot-select")?.addEventListener("change", async event => {
      this.selectedSnapshotId = event.currentTarget.value || null;
      await this.load(this.context);
      await refresh();
    });

    container.querySelector("#p360d-generate-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      const periodStart = form.querySelector("#p360d-period-from")?.value;
      const periodEnd = form.querySelector("#p360d-period-to")?.value;

      if (!periodStart || !periodEnd || periodEnd < periodStart) {
        alert("⚠️ Revisa el periodo de análisis.");
        return;
      }

      submit.disabled = true;
      try {
        const result = await this.orchestrator.generateAndSaveSnapshot({
          teamId: this.context.teamId,
          teamSeasonId: this.context.teamSeasonId,
          playerId: this.context.playerId,
          periodStart,
          periodEnd
        });
        this.selectedSnapshotId = result.snapshotId;
        await this.load(this.context);
        await refresh();
      } catch (error) {
        console.error("[LongitudinalAnalyticsPanel] Error generando snapshot:", error);
        alert("❌ " + (error.message || error));
        submit.disabled = false;
      }
    });

    container.querySelectorAll(".p360d-review-insight").forEach(button => {
      button.addEventListener("click", async () => {
        const status = button.dataset.reviewStatus;
        const card = button.closest(".p360d-insight");
        const notes = card?.querySelector(".p360d-review-notes")?.value.trim() || null;
        if (!confirm(status === "APPROVED"
          ? "¿Aprobar esta interpretación IA?"
          : "¿Rechazar esta interpretación IA?")) return;

        button.disabled = true;
        try {
          await this.analyticsService.reviewAiInsight({
            insightId: button.dataset.insightId,
            status,
            notes
          });
          await this.load(this.context);
          await refresh();
        } catch (error) {
          console.error("[LongitudinalAnalyticsPanel] Error revisando insight:", error);
          alert("❌ " + (error.message || error));
          button.disabled = false;
        }
      });
    });
  }
}

export default LongitudinalAnalyticsPanel;
