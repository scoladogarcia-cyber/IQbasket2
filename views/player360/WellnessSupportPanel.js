/**
 * Player 360 Nutrition + Recovery support panel.
 *
 * Manual check-ins only. No external imports, AI processing or clinical fields.
 * Every personal read/write is delegated to WellnessService -> backend ABAC.
 * Trend summaries are derived locally only after an authorized read succeeds.
 */

import { Permission } from "../../security/PermissionService.js";
import { WellnessRecommendationEngine } from "../../domain/player360/WellnessRecommendationEngine.js";
import {
  WellnessTrendEngine,
  WELLNESS_TREND_DIRECTION
} from "../../domain/player360/WellnessTrendEngine.js";

const MODULES = Object.freeze({
  nutrition: Object.freeze({
    label: "Nutrición",
    icon: "🥤",
    viewPermission: Permission.VIEW_NUTRITION,
    editPermission: Permission.EDIT_NUTRITION
  }),
  recovery: Object.freeze({
    label: "Recuperación",
    icon: "🌙",
    viewPermission: Permission.VIEW_RECOVERY,
    editPermission: Permission.EDIT_RECOVERY
  })
});

const TREND_LABELS = Object.freeze({
  [WELLNESS_TREND_DIRECTION.UP]: "↑ Sube",
  [WELLNESS_TREND_DIRECTION.DOWN]: "↓ Baja",
  [WELLNESS_TREND_DIRECTION.STABLE]: "→ Estable",
  [WELLNESS_TREND_DIRECTION.INSUFFICIENT]: "Datos insuficientes"
});

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function localIsoDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function displayValue(observation = {}) {
  if (observation.value_type === "BOOLEAN") return observation.value ? "Sí" : "No";
  const value = observation.value;
  if (value === null || value === undefined || value === "") return "—";
  return observation.unit === "HOURS"
    ? `${Number(value).toLocaleString(undefined,{ maximumFractionDigits: 2 })} h`
    : String(value);
}

function displayTrendValue(summary = {}, value, { aggregate = false } = {}) {
  if (value === null || value === undefined || value === "") return "—";

  if (summary.value_type === "BOOLEAN") {
    if (!aggregate) return value ? "Sí" : "No";
    return `${Math.round(Number(value) * 100)}%`;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  const formatted = numeric.toLocaleString(undefined,{ maximumFractionDigits: 2 });
  return summary.unit === "HOURS" ? `${formatted} h` : formatted;
}

function sortEntries(rows) {
  return [...normalizeArray(rows)].sort((a,b) =>
    String(b.entry_date || "").localeCompare(String(a.entry_date || ""))
    || String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );
}

export class WellnessSupportPanel {
  constructor({ service, can, modules = null } = {}) {
    this.service = service;
    this.can = typeof can === "function" ? can : () => false;
    this.allowedModules = Array.isArray(modules)
      ? new Set(modules.map(module => String(module).toLowerCase()))
      : null;
    this.context = null;
    this.backendAvailable = false;
    this.lastError = null;
    this.activeModule = "recovery";
    this.editorOpen = false;
    this.editingEntryId = null;
    this.data = {
      nutrition: { access: null, metrics: [], entries: [] },
      recovery: { access: null, metrics: [], entries: [] }
    };
  }

  _baseCanView(module) {
    return Boolean(this.can(MODULES[module]?.viewPermission));
  }

  _baseCanEdit(module) {
    return Boolean(this.can(MODULES[module]?.editPermission));
  }

  _visibleModules() {
    return Object.keys(MODULES).filter(module =>
      (!this.allowedModules || this.allowedModules.has(module))
      && this._baseCanView(module)
    );
  }

  _dateBounds() {
    return this.context?.dateBounds || {};
  }

  _defaultDate() {
    const today = localIsoDate();
    const { min,max } = this._dateBounds();
    if (min && today < min) return min;
    if (max && today > max) return max;
    return today;
  }

  async load(context = {}) {
    this.context = { ...context };
    this.lastError = null;
    this.backendAvailable = false;

    if (!this.service?.supabase) return;

    const modules = this._visibleModules();
    if (!modules.length) return;

    try {
      for (const module of modules) {
        const [access,metrics] = await Promise.all([
          this.service.resolveAccessContext({
            teamSeasonId: context.teamSeasonId,
            playerId: context.playerId,
            module
          }),
          this.service.listMetrics({
            teamSeasonId: context.teamSeasonId,
            module
          })
        ]);

        const entries = access?.can_read && access?.purpose
          ? await this.service.listEntries({
              teamSeasonId: context.teamSeasonId,
              playerId: context.playerId,
              module,
              purpose: access.purpose,
              fromDate: context.dateBounds?.min || null,
              toDate: context.dateBounds?.max || null,
              limit: 100
            })
          : [];

        this.data[module] = {
          access,
          metrics: normalizeArray(metrics),
          entries: sortEntries(entries)
        };
      }

      this.backendAvailable = true;
      if (!modules.includes(this.activeModule)) {
        this.activeModule = modules[0];
      }
    } catch (error) {
      console.error("[WellnessSupportPanel] Error cargando Nutrition/Recovery:",error);
      this.lastError = error;
      this.backendAvailable = false;
    }
  }

  isAvailable() {
    return Boolean(
      this.backendAvailable
      && this._visibleModules().length > 0
    );
  }

  _entryById(id) {
    return this.data[this.activeModule]?.entries?.find(row =>
      String(row.id) === String(id)
    ) || null;
  }

  _existingValues(entry) {
    return new Map(
      normalizeArray(entry?.observations).map(item => [
        normalizeCode(item.metric_code),
        item.value
      ])
    );
  }

  _metricMap(module = this.activeModule) {
    return new Map(
      normalizeArray(this.data[module]?.metrics).map(metric => [
        normalizeCode(metric.code),
        metric
      ])
    );
  }

  _renderMetricInput(metric, existingValue) {
    const code=normalizeCode(metric.code);
    const id=`p360w-${this.activeModule}-${code}`;
    const common=`class="p360w-input" data-metric-code="${escapeHtml(code)}" data-value-type="${escapeHtml(metric.value_type)}"`;
    const current=existingValue ?? "";

    if (metric.value_type === "BOOLEAN") {
      return `
        <select id="${id}" ${common}>
          <option value="">Sin indicar</option>
          <option value="true" ${current === true ? "selected" : ""}>Sí</option>
          <option value="false" ${current === false ? "selected" : ""}>No</option>
        </select>
      `;
    }

    if (metric.value_type === "CHOICE") {
      const options=normalizeArray(metric.options);
      return `
        <select id="${id}" ${common}>
          <option value="">Sin indicar</option>
          ${options.map(option => `
            <option value="${escapeHtml(option)}" ${String(current) === String(option) ? "selected" : ""}>
              ${escapeHtml(option)}
            </option>
          `).join("")}
        </select>
      `;
    }

    const min=metric.min_value ?? "";
    const max=metric.max_value ?? "";
    const step=metric.step ?? "any";

    if (
      metric.value_type === "SCALE"
      && Number(step) === 1
      && Number.isFinite(Number(min))
      && Number.isFinite(Number(max))
      && Number(max)-Number(min) <= 10
    ) {
      const options=[];
      for(let value=Number(min); value<=Number(max); value+=1) options.push(value);
      return `
        <select id="${id}" ${common}>
          <option value="">Sin indicar</option>
          ${options.map(value => `
            <option value="${value}" ${Number(current) === value ? "selected" : ""}>${value}</option>
          `).join("")}
        </select>
      `;
    }

    return `
      <input
        id="${id}"
        type="number"
        inputmode="decimal"
        min="${escapeHtml(min)}"
        max="${escapeHtml(max)}"
        step="${escapeHtml(step)}"
        value="${escapeHtml(current)}"
        ${common}
      />
    `;
  }

  _renderEditor() {
    if (!this.editorOpen) return "";

    const module=this.activeModule;
    const moduleData=this.data[module] || {};
    const access=moduleData.access || {};
    const editing=this.editingEntryId ? this._entryById(this.editingEntryId) : null;
    const canSave=this._baseCanEdit(module)
      && Boolean(editing ? access.can_update : access.can_create);

    if (!canSave || !access.purpose) return "";

    const existing=this._existingValues(editing);
    const { min,max }=this._dateBounds();
    const entryDate=editing?.entry_date || this._defaultDate();

    return `
      <article class="p360w-card p360w-editor" id="p360w-editor">
        <div class="p360w-head">
          <div>
            <h3>${editing ? "Editar check-in" : "Nuevo check-in"}</h3>
            <p>Solo hábitos y sensaciones estructuradas. No se admite texto libre.</p>
          </div>
          <span class="p360w-badge">Manual</span>
        </div>

        <form id="p360w-form" class="p360w-form">
          <label class="p360w-date">
            <span>Fecha</span>
            <input
              id="p360w-entry-date"
              type="date"
              required
              value="${escapeHtml(entryDate)}"
              ${min ? `min="${escapeHtml(min)}"` : ""}
              ${max ? `max="${escapeHtml(max)}"` : ""}
            />
          </label>

          <div class="p360w-metrics">
            ${moduleData.metrics.map(metric => `
              <label class="p360w-metric">
                <span class="p360w-metric-name">${escapeHtml(metric.name)}</span>
                <small>${escapeHtml(metric.description || "")}</small>
                ${this._renderMetricInput(metric,existing.get(normalizeCode(metric.code)))}
              </label>
            `).join("")}
          </div>

          <div class="p360w-actions">
            <button type="button" class="p360w-secondary" id="p360w-cancel">Cancelar</button>
            <button type="submit" class="p360w-primary">Guardar</button>
          </div>
        </form>
      </article>
    `;
  }

  _latestRecommendations() {
    const entries=this.data[this.activeModule]?.entries || [];
    const latest=entries[0];
    if (!latest) return [];

    const observations=normalizeArray(latest.observations).map(item => ({
      module:this.activeModule,
      metric_code:item.metric_code,
      value:item.value,
      occurred_at:latest.entry_date
    }));

    return WellnessRecommendationEngine.evaluate({ observations });
  }

  _renderRecommendations() {
    if (!this.can(Permission.VIEW_WELLNESS_RECOMMENDATIONS)) return "";

    const recommendations=this._latestRecommendations();
    return `
      <article class="p360w-card">
        <div class="p360w-head">
          <div>
            <h3>Apoyo para el siguiente paso</h3>
            <p>Recomendaciones deterministas, no clínicas y basadas solo en el último check-in.</p>
          </div>
          <span class="p360w-badge">Sin IA</span>
        </div>
        ${recommendations.length ? `
          <div class="p360w-recommendations">
            ${recommendations.map(item => `
              <div class="p360w-recommendation p360w-priority-${escapeHtml(String(item.priority).toLowerCase())}">
                <div>
                  <strong>${escapeHtml(item.title)}</strong>
                  <p>${escapeHtml(item.message)}</p>
                </div>
                <span>${item.priority === "REVIEW" ? "Revisar" : "Apoyo"}</span>
              </div>
            `).join("")}
          </div>
        ` : `
          <div class="p360w-empty">
            No hay recomendaciones prioritarias con el último check-in. Mantén la consistencia de tus hábitos.
          </div>
        `}
      </article>
    `;
  }

  _renderTrends() {
    const data=this.data[this.activeModule] || {};
    if (!data.entries?.length) return "";

    const analysis=WellnessTrendEngine.analyze({
      entries:data.entries,
      metrics:data.metrics,
      shortWindowDays:7,
      longWindowDays:28
    });
    if (!analysis.metrics.length) return "";

    return `
      <section class="p360w-trend-section" aria-label="Tendencias descriptivas de los check-ins">
        <div class="p360w-trend-head">
          <div>
            <h3>Tendencia 7 / 28 días</h3>
            <p>
              Resumen descriptivo anclado al último check-in (${escapeHtml(analysis.anchorDate || "—")}).
              La flecha indica cambio, no si el cambio es bueno o malo.
            </p>
          </div>
          <span class="p360w-badge">Descriptivo</span>
        </div>
        <div class="p360w-trends">
          ${analysis.metrics.map(summary => `
            <article class="p360w-trend">
              <div class="p360w-trend-title">
                <strong>${escapeHtml(summary.name)}</strong>
                <span class="p360w-trend-direction p360w-trend-${escapeHtml(String(summary.direction).toLowerCase())}">
                  ${escapeHtml(TREND_LABELS[summary.direction] || "Datos insuficientes")}
                </span>
              </div>
              <div class="p360w-trend-stats">
                <span>
                  <small>Último</small>
                  <b>${escapeHtml(displayTrendValue(summary,summary.latest_value))}</b>
                </span>
                <span>
                  <small>7 días</small>
                  <b>${escapeHtml(displayTrendValue(summary,summary.short_value,{ aggregate:true }))}</b>
                  <em>n=${summary.short_samples}</em>
                </span>
                <span>
                  <small>28 días</small>
                  <b>${escapeHtml(displayTrendValue(summary,summary.long_value,{ aggregate:true }))}</b>
                  <em>n=${summary.long_samples}</em>
                </span>
              </div>
            </article>
          `).join("")}
        </div>
        <p class="p360w-trend-disclaimer">
          No es un diagnóstico ni una relación causal con el rendimiento. Sirve para observar consistencia y preparar conversaciones con jugador, familia o staff según permisos.
        </p>
      </section>
    `;
  }

  _renderHistory() {
    const module=this.activeModule;
    const data=this.data[module] || {};
    const access=data.access || {};
    const canEdit=this._baseCanEdit(module) && access.can_update;
    const canArchive=this._baseCanEdit(module) && access.can_archive;
    const metricMap=this._metricMap(module);

    if (!data.entries.length) {
      return '<div class="p360w-empty">Todavía no hay check-ins registrados.</div>';
    }

    return `
      <div class="p360w-history">
        ${data.entries.map(entry => `
          <article class="p360w-history-card">
            <div class="p360w-history-top">
              <div>
                <strong>${escapeHtml(entry.entry_date)}</strong>
                <span>${entry.source_type === "PLAYER_SELF_REPORT" ? "Autoregistro" : entry.source_type === "GUARDIAN_REPORT" ? "Tutor" : "Staff"}</span>
              </div>
              ${canEdit || canArchive ? `
                <div class="p360w-inline-actions">
                  ${canEdit ? `<button type="button" class="p360w-link p360w-edit" data-entry-id="${escapeHtml(entry.id)}">Editar</button>` : ""}
                  ${canArchive ? `<button type="button" class="p360w-link p360w-archive" data-entry-id="${escapeHtml(entry.id)}">Archivar</button>` : ""}
                </div>
              ` : ""}
            </div>
            <div class="p360w-values">
              ${normalizeArray(entry.observations).map(observation => {
                const code=normalizeCode(observation.metric_code);
                const metric=metricMap.get(code);
                return `
                  <span>
                    <b>${escapeHtml(metric?.name || code.replaceAll("_"," "))}</b>
                    ${escapeHtml(displayValue(observation))}
                  </span>
                `;
              }).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  _renderStyles() {
    return `
      <style>
        .p360w-panel{display:grid;gap:14px;min-width:0}
        .p360w-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;min-width:0}
        .p360w-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}
        .p360w-head h2,.p360w-head h3{margin:0}.p360w-head p{margin:4px 0 0;color:#64748b;font-size:12px;line-height:1.5}
        .p360w-modules{display:flex;gap:8px;overflow-x:auto}
        .p360w-module{min-height:44px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#475569;padding:9px 14px;font-weight:800;cursor:pointer;white-space:nowrap}
        .p360w-module[aria-selected="true"]{background:#0f766e;border-color:#0f766e;color:#fff}
        .p360w-badge{display:inline-flex;width:max-content;border-radius:999px;padding:4px 8px;background:#ecfdf5;color:#047857;font-size:10px;font-weight:900;white-space:nowrap}
        .p360w-note{background:#f0fdfa;border:1px solid #99f6e4;color:#115e59;border-radius:10px;padding:12px;font-size:12px;line-height:1.5}
        .p360w-locked{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;padding:12px;font-size:12px;line-height:1.5}
        .p360w-empty{background:#f8fafc;border:1px dashed #cbd5e1;color:#64748b;border-radius:10px;padding:13px;text-align:center;font-size:12px;line-height:1.5}
        .p360w-toolbar{display:flex;justify-content:flex-end;margin-bottom:10px}
        .p360w-primary,.p360w-secondary{min-height:44px;border-radius:9px;padding:9px 13px;font-weight:800;cursor:pointer}
        .p360w-primary{background:#0f766e;color:#fff;border:1px solid #0f766e}.p360w-secondary{background:#fff;color:#334155;border:1px solid #cbd5e1}
        .p360w-form{display:grid;gap:14px}.p360w-form label{display:grid;gap:6px;font-size:12px;font-weight:800;color:#334155}
        .p360w-form input,.p360w-form select{width:100%;min-height:44px;border:1px solid #cbd5e1;border-radius:9px;padding:9px 10px;background:#fff;color:#0f172a;font:inherit}
        .p360w-date{max-width:240px}.p360w-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .p360w-metric{border:1px solid #e2e8f0;border-radius:10px;padding:11px;background:#f8fafc;min-width:0}
        .p360w-metric-name{font-weight:900}.p360w-metric small{font-weight:500;color:#64748b;line-height:1.4;min-height:34px}
        .p360w-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
        .p360w-history{display:grid;gap:8px}.p360w-history-card{border:1px solid #e2e8f0;border-radius:11px;padding:11px;display:grid;gap:9px}
        .p360w-history-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.p360w-history-top>div:first-child{display:grid;gap:2px}
        .p360w-history-top span{font-size:10px;color:#64748b;font-weight:800}.p360w-inline-actions{display:flex;gap:7px;flex-wrap:wrap}
        .p360w-link{border:0;background:transparent;color:#0f766e;font-weight:800;cursor:pointer;padding:6px}
        .p360w-values{display:flex;flex-wrap:wrap;gap:7px}.p360w-values span{display:inline-flex;gap:6px;align-items:center;border-radius:999px;background:#f1f5f9;padding:5px 8px;font-size:10px;color:#475569}
        .p360w-values b{font-size:9px;color:#0f172a}
        .p360w-trend-section{display:grid;gap:10px;margin:12px 0 16px;padding:13px;border:1px solid #ccfbf1;background:#f0fdfa;border-radius:12px}
        .p360w-trend-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.p360w-trend-head h3{margin:0;font-size:14px}.p360w-trend-head p{margin:4px 0 0;color:#475569;font-size:11px;line-height:1.45}
        .p360w-trends{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.p360w-trend{display:grid;gap:9px;border:1px solid #d1fae5;background:#fff;border-radius:10px;padding:10px;min-width:0}
        .p360w-trend-title{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.p360w-trend-title strong{font-size:12px;line-height:1.35}
        .p360w-trend-direction{font-size:9px;font-weight:900;white-space:nowrap;color:#475569}.p360w-trend-up{color:#0369a1}.p360w-trend-down{color:#7c3aed}.p360w-trend-stable{color:#047857}.p360w-trend-insufficient{color:#64748b}
        .p360w-trend-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.p360w-trend-stats span{display:grid;gap:1px;background:#f8fafc;border-radius:8px;padding:7px;min-width:0}
        .p360w-trend-stats small{font-size:9px;color:#64748b;font-weight:800}.p360w-trend-stats b{font-size:13px;color:#0f172a}.p360w-trend-stats em{font-style:normal;font-size:8px;color:#94a3b8}
        .p360w-trend-disclaimer{margin:0;color:#64748b;font-size:10px;line-height:1.45}
        .p360w-recommendations{display:grid;gap:8px}.p360w-recommendation{display:flex;justify-content:space-between;gap:10px;border:1px solid #d1fae5;border-radius:11px;padding:11px;background:#f0fdf4}
        .p360w-recommendation strong{font-size:13px}.p360w-recommendation p{margin:4px 0 0;font-size:12px;line-height:1.5;color:#475569}
        .p360w-recommendation>span{font-size:10px;font-weight:900;text-transform:uppercase;color:#047857;white-space:nowrap}
        .p360w-priority-review{background:#fffbeb;border-color:#fde68a}.p360w-priority-review>span{color:#b45309}
        @media(max-width:640px){
          .p360w-head,.p360w-history-top,.p360w-recommendation,.p360w-trend-head{display:grid}
          .p360w-metrics,.p360w-trends{grid-template-columns:1fr}.p360w-date{max-width:none}
          .p360w-actions{display:grid}.p360w-actions button{width:100%}
          .p360w-toolbar .p360w-primary{width:100%}.p360w-inline-actions{justify-content:flex-start}
          .p360w-trend-stats{grid-template-columns:repeat(3,minmax(0,1fr))}
        }
      </style>
    `;
  }

  render() {
    if (!this.isAvailable()) return "";

    const modules=this._visibleModules();
    const module=this.activeModule;
    const moduleData=this.data[module] || { access:null,metrics:[],entries:[] };
    const access=moduleData.access || {};
    const canCreate=this._baseCanEdit(module) && access.can_create && access.purpose;

    return `
      <section class="p360w-panel">
        ${this._renderStyles()}
        <div class="p360w-note">
          Este módulo trabaja con hábitos y sensaciones de apoyo deportivo. No recoge diagnósticos,
          medicación, peso, calorías ni otros datos clínicos. La importación desde apps externas
          permanece desactivada en esta fase.
        </div>

        <div class="p360w-modules" role="tablist" aria-label="Apoyo Nutrition y Recovery">
          ${modules.map(key => `
            <button
              type="button"
              class="p360w-module"
              data-p360w-module="${key}"
              aria-selected="${module===key}"
            >${MODULES[key].icon} ${MODULES[key].label}</button>
          `).join("")}
        </div>

        ${!access.purpose ? `
          <div class="p360w-locked">
            El módulo está disponible, pero este usuario todavía no dispone de una autorización
            ABAC válida para este jugador y esta temporada. No se muestra ni se guarda ningún dato.
          </div>
        ` : `
          <article class="p360w-card">
            <div class="p360w-head">
              <div>
                <h2>${MODULES[module].icon} ${MODULES[module].label}</h2>
                <p>Check-in manual rápido para convertir sensaciones en apoyo práctico.</p>
              </div>
              <span class="p360w-badge">Privado</span>
            </div>
            ${canCreate && !this.editorOpen ? `
              <div class="p360w-toolbar">
                <button type="button" class="p360w-primary" id="p360w-new">＋ Añadir check-in</button>
              </div>
            ` : ""}
            ${this._renderTrends()}
            ${this._renderHistory()}
          </article>

          ${this._renderEditor()}
          ${this._renderRecommendations()}
        `}
      </section>
    `;
  }

  _collectValues(form) {
    return [...form.querySelectorAll(".p360w-input")]
      .map(input => {
        if (input.value === "") return null;
        const type=input.dataset.valueType;
        let value=input.value;
        if (type === "NUMBER" || type === "SCALE") {
          value=Number(value);
          if (!Number.isFinite(value)) return null;
        } else if (type === "BOOLEAN") {
          value=value === "true";
        }
        return {
          metric_code:input.dataset.metricCode,
          value
        };
      })
      .filter(Boolean);
  }

  async bind(container,{ onChanged }={}) {
    if (!container || !this.isAvailable()) return;
    const refresh=typeof onChanged === "function" ? onChanged : () => {};

    container.querySelectorAll("[data-p360w-module]").forEach(button => {
      button.addEventListener("click",async () => {
        this.activeModule=button.dataset.p360wModule;
        this.editorOpen=false;
        this.editingEntryId=null;
        await refresh();
      });
    });

    container.querySelector("#p360w-new")?.addEventListener("click",async () => {
      this.editorOpen=true;
      this.editingEntryId=null;
      await refresh();
      container.querySelector("#p360w-editor")?.scrollIntoView({ block:"start",behavior:"smooth" });
    });

    container.querySelector("#p360w-cancel")?.addEventListener("click",async () => {
      this.editorOpen=false;
      this.editingEntryId=null;
      await refresh();
    });

    container.querySelectorAll(".p360w-edit").forEach(button => {
      button.addEventListener("click",async () => {
        this.editingEntryId=button.dataset.entryId;
        this.editorOpen=true;
        await refresh();
        container.querySelector("#p360w-editor")?.scrollIntoView({ block:"start",behavior:"smooth" });
      });
    });

    container.querySelectorAll(".p360w-archive").forEach(button => {
      button.addEventListener("click",async () => {
        if (!confirm("¿Archivar este check-in? Dejará de aparecer en el seguimiento.")) return;
        button.disabled=true;
        try {
          const access=this.data[this.activeModule]?.access;
          await this.service.archiveEntry({
            entryId:button.dataset.entryId,
            purpose:access?.purpose
          });
          await this.load(this.context);
          await refresh();
        } catch(error) {
          console.error("[WellnessSupportPanel] Error archivando:",error);
          alert(`❌ ${error.message || error}`);
          button.disabled=false;
        }
      });
    });

    container.querySelector("#p360w-form")?.addEventListener("submit",async event => {
      event.preventDefault();
      const form=event.currentTarget;
      const submit=form.querySelector('button[type="submit"]');
      const values=this._collectValues(form);
      if (!values.length) {
        alert("⚠️ Indica al menos un valor.");
        return;
      }

      submit.disabled=true;
      try {
        const access=this.data[this.activeModule]?.access;
        await this.service.saveManualEntry({
          entryId:this.editingEntryId,
          teamSeasonId:this.context.teamSeasonId,
          playerId:this.context.playerId,
          module:this.activeModule,
          entryDate:form.querySelector("#p360w-entry-date")?.value,
          purpose:access?.purpose,
          values
        });
        this.editorOpen=false;
        this.editingEntryId=null;
        await this.load(this.context);
        await refresh();
      } catch(error) {
        console.error("[WellnessSupportPanel] Error guardando:",error);
        alert(`❌ ${error.message || error}`);
        submit.disabled=false;
      }
    });
  }
}

export default WellnessSupportPanel;
