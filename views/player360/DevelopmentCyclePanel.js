/**
 * @fileoverview Player360 panel for the weekly development loop.
 * @description Keeps the UI thin: backend capabilities and RPCs are the final
 * authority for scope, lifecycle, evidence and review decisions.
 */
import { Permission } from "../../security/PermissionService.js";

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const rows = value => Array.isArray(value) ? value : [];

const STATUS_LABEL = Object.freeze({
  ACTIVE: "En curso",
  REVIEW_DUE: "Lista para revisar",
  COMPLETED: "Revisada",
  PAUSED: "Pausada",
  PLANNED: "Pendiente",
  IN_PROGRESS: "En curso",
  SKIPPED: "Omitida"
});

const OUTCOME_LABEL = Object.freeze({
  CONTINUE: "Continuar el foco",
  ADAPT: "Adaptar la siguiente semana",
  ACHIEVED: "Objetivo semanal logrado",
  PAUSE: "Pausar el ciclo"
});

export class DevelopmentCyclePanel {
  constructor({ service, can = () => false } = {}) {
    this.service = service;
    this.can = can;
    this.context = null;
    this.objectiveProfile = null;
    this.capabilities = null;
    this.snapshot = null;
    this.error = null;
  }

  isAvailable() {
    return Boolean(this.can(Permission.VIEW_DEVELOPMENT_CYCLE) && this.capabilities?.ready === true);
  }

  async load({ teamSeasonId, playerId, objectiveProfile = null } = {}) {
    this.context = { teamSeasonId, playerId };
    this.objectiveProfile = objectiveProfile;
    this.error = null;
    if (!this.can(Permission.VIEW_DEVELOPMENT_CYCLE)) {
      this.capabilities = null;
      this.snapshot = null;
      return;
    }

    try {
      this.capabilities = await this.service.getCapabilities({ teamSeasonId, playerId });
      this.snapshot = this.capabilities?.can_view
        ? await this.service.snapshot({ teamSeasonId, playerId })
        : null;
    } catch (error) {
      this.error = error;
      this.snapshot = null;
    }
  }

  _canMutate(permission, backendFlag) {
    return Boolean(this.can(permission) && this.capabilities?.[backendFlag]);
  }

  _primaryTarget() {
    return rows(this.objectiveProfile?.targets)
      .slice()
      .sort((a, b) => (Number(b?.priority_weight) || 0) - (Number(a?.priority_weight) || 0))[0] || null;
  }

  _actionEditor(index, { required = false } = {}) {
    const focus = this._primaryTarget()?.metric_name || "el foco principal";
    const defaults = [
      [`Aplicar ${focus} en una situación real`, `Identificar al final de la semana una situación concreta en la que se haya trabajado ${focus}.`],
      [`Observar ${focus} con intención`, `Registrar una evidencia real de entrenamiento, tecnificación o partido relacionada con ${focus}.`],
      [`Revisar ${focus} con el staff`, `Cerrar la semana con una decisión explícita: continuar, adaptar, lograr o pausar el foco.`]
    ][index] || ["", ""];

    return `<fieldset class="p360c-card p360d-action-row" data-action-index="${index}">
      <legend>Acción ${index + 1}${required ? " *" : " · opcional"}</legend>
      <div class="p360c-form-grid">
        <label><span>Tipo</span><select data-action-type>
          <option value="TRAINING">Entrenamiento</option>
          <option value="TECHNIFICATION">Tecnificación</option>
          <option value="GAME">Partido</option>
          <option value="REFLECTION">Revisión / reflexión</option>
          <option value="OTHER">Otra</option>
        </select></label>
        <label class="p360c-span-2"><span>Acción${required ? " *" : ""}</span>
          <input data-action-title maxlength="180" ${required ? "required" : ""}
            value="${required ? escapeHtml(defaults[0]) : ""}" placeholder="Qué haremos esta semana" /></label>
        <label class="p360c-span-2"><span>Criterio observable${required ? " *" : ""}</span>
          <textarea data-action-criterion maxlength="600" ${required ? "required" : ""}
            placeholder="Cómo sabremos que se ha trabajado">${required ? escapeHtml(defaults[1]) : ""}</textarea></label>
      </div>
    </fieldset>`;
  }

  _renderStart() {
    if (!this.objectiveProfile?.id) {
      return `<div class="p360c-empty">Define primero un perfil objetivo activo. El ciclo semanal siempre nace de un objetivo explícito del staff.</div>`;
    }
    if (!this._canMutate(Permission.CREATE_DEVELOPMENT_CYCLE, "can_create")) {
      return `<div class="p360c-empty">Aún no hay ciclo de desarrollo esta semana. Tu perfil puede consultarlo cuando el staff lo cree.</div>`;
    }

    const focus = this._primaryTarget()?.metric_name || "objetivo principal";
    return `<details class="p360c-card" open>
      <summary>＋ Crear semana de desarrollo</summary>
      <form id="p360d-start-form" class="p360c-form">
        <div class="p360c-note">El ciclo quedará vinculado a la revisión actual de <strong>${escapeHtml(this.objectiveProfile.title)}</strong> y al foco <strong>${escapeHtml(focus)}</strong>. Las revisiones futuras del objetivo no reescriben esta semana.</div>
        ${this._actionEditor(0, { required: true })}
        ${this._actionEditor(1)}
        ${this._actionEditor(2)}
        <div class="p360c-actions"><button type="submit" class="p360c-primary">Crear ciclo semanal</button></div>
      </form>
    </details>`;
  }

  _evidenceOptions() {
    const evidence = rows(this.snapshot?.available_evidence);
    if (!evidence.length) return '<option value="">No hay evidencia reciente disponible</option>';
    return `<option value="">Selecciona evidencia reciente…</option>${evidence.map(item => `
      <option value="${escapeHtml(item.type)}|${escapeHtml(item.id)}">${escapeHtml(item.date || "—")} · ${escapeHtml(item.label || item.type)}</option>
    `).join("")}`;
  }

  _renderAction(action, cycle) {
    const mutable = !["COMPLETED", "PAUSED"].includes(String(cycle.status || "").toUpperCase());
    const canEdit = mutable && this._canMutate(Permission.EDIT_DEVELOPMENT_ACTION, "can_edit_action");
    const canLink = mutable && this._canMutate(Permission.LINK_DEVELOPMENT_EVIDENCE, "can_link_evidence");
    const evidence = rows(action.evidence);

    return `<article class="p360c-card" data-development-action="${escapeHtml(action.id)}">
      <div class="p360c-section-head"><div>
        <div class="p360c-meta">Acción ${escapeHtml(action.action_order)} · ${escapeHtml(action.action_type)}</div>
        <h3>${escapeHtml(action.title)}</h3>
      </div><span class="p360c-badge">${escapeHtml(STATUS_LABEL[action.status] || action.status)}</span></div>
      <p>${escapeHtml(action.success_criterion)}</p>
      ${action.state_note ? `<div class="p360c-note">${escapeHtml(action.state_note)}</div>` : ""}
      <div class="p360c-copy"><span>Evidencia vinculada</span>
        ${evidence.length ? `<ul>${evidence.map(item => `<li>${escapeHtml(item.evidence_date)} · ${escapeHtml(item.label)}</li>`).join("")}</ul>` : '<p class="p360c-meta">Aún sin evidencia vinculada.</p>'}
      </div>
      ${canEdit ? `<form class="p360c-form p360d-state-form" data-action-id="${escapeHtml(action.id)}">
        <div class="p360c-form-grid"><label><span>Estado</span><select data-action-state>
          ${[["PLANNED","Pendiente"],["IN_PROGRESS","En curso"],["COMPLETED","Completada"],["SKIPPED","Omitida"]].map(([value,label]) => `<option value="${value}" ${action.status===value?"selected":""}>${label}</option>`).join("")}
        </select></label><label class="p360c-span-2"><span>Nota interna opcional</span><input data-action-note maxlength="400" value="${escapeHtml(action.state_note || "")}" /></label></div>
        <div class="p360c-actions"><button type="submit" class="p360c-secondary">Actualizar estado</button></div>
      </form>` : ""}
      ${canLink ? `<form class="p360c-form p360d-evidence-form" data-action-id="${escapeHtml(action.id)}">
        <label><span>Conectar evidencia real</span><select data-evidence>${this._evidenceOptions()}</select></label>
        <div class="p360c-actions"><button type="submit" class="p360c-secondary">Vincular evidencia</button></div>
      </form>` : ""}
    </article>`;
  }

  _renderReview(cycle) {
    const actions = rows(cycle.actions);
    const allClosed = actions.length > 0 && actions.every(action => ["COMPLETED","SKIPPED"].includes(action.status));
    const canReview = this._canMutate(Permission.REVIEW_DEVELOPMENT_CYCLE, "can_review");
    if (["COMPLETED","PAUSED"].includes(cycle.status)) {
      return `<article class="p360c-card"><div class="p360c-section-head"><div><h3>Revisión semanal</h3><p>${escapeHtml(OUTCOME_LABEL[cycle.review_outcome] || cycle.review_outcome || "Cerrada")}</p></div><span class="p360c-badge p360c-badge-current">Ciclo cerrado</span></div>${cycle.review_note ? `<div class="p360c-note">${escapeHtml(cycle.review_note)}</div>` : ""}</article>`;
    }
    if (!canReview) return "";
    if (!allClosed) {
      return `<div class="p360c-note">Para revisar la semana, marca primero cada acción como completada u omitida. No se fuerza una valoración mientras queden acciones abiertas.</div>`;
    }
    return `<form class="p360c-card p360c-form" id="p360d-review-form" data-cycle-id="${escapeHtml(cycle.id)}">
      <div class="p360c-section-head"><div><h3>Revisar la semana</h3><p>La revisión cierra el ciclo sin modificar el objetivo histórico.</p></div></div>
      <div class="p360c-form-grid"><label><span>Decisión</span><select data-review-outcome>
        ${Object.entries(OUTCOME_LABEL).map(([value,label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join("")}
      </select></label><label class="p360c-span-2"><span>Nota interna opcional</span><textarea data-review-note maxlength="800"></textarea></label></div>
      <div class="p360c-actions"><button type="submit" class="p360c-primary">Cerrar revisión semanal</button></div>
    </form>`;
  }

  _renderCycle(cycle) {
    const baseline = cycle.evidence_snapshot || {};
    return `<section>
      <article class="p360c-card">
        <div class="p360c-section-head"><div><div class="p360c-meta">Semana ${escapeHtml(cycle.week_start)} → ${escapeHtml(cycle.ends_on)}</div>
          <h2>${escapeHtml(cycle.focus_metric_name)}</h2><p>${escapeHtml(cycle.objective_title)} · revisión ${escapeHtml(cycle.objective_revision)}</p></div>
          <span class="p360c-badge p360c-badge-current">${escapeHtml(STATUS_LABEL[cycle.status] || cycle.status)}</span></div>
        <div class="p360c-kpis" style="margin-top:12px;">
          <div class="p360c-kpi"><span>Entrenos 28d</span><strong>${Number(baseline.training_sessions)||0}</strong></div>
          <div class="p360c-kpi"><span>Tecnificaciones 28d</span><strong>${Number(baseline.technification_sessions)||0}</strong></div>
          <div class="p360c-kpi"><span>Partidos 28d</span><strong>${Number(baseline.games)||0}</strong></div>
          <div class="p360c-kpi"><span>Acciones</span><strong>${rows(cycle.actions).length}</strong></div>
        </div>
      </article>
      ${rows(cycle.actions).map(action => this._renderAction(action, cycle)).join("")}
      ${this._renderReview(cycle)}
    </section>`;
  }

  render() {
    if (!this.isAvailable()) return '<div class="p360c-error">Tu perfil no puede consultar ciclos de desarrollo.</div>';
    if (this.error) return `<div class="p360c-error">${escapeHtml(this.error.message || this.error)}</div>`;
    if (!this.capabilities?.can_view) return '<div class="p360c-error">El backend no autoriza este ciclo para el contexto actual.</div>';
    const cycle = this.snapshot?.current_cycle || null;
    return `<section class="p360c-panel" id="p360c-panel-development">
      <div class="p360c-section-head"><div><h2>Plan semanal de desarrollo</h2><p>Objetivo → acción → evidencia → revisión. Sin inferencias causales ni prescripción de cargas.</p></div></div>
      ${cycle ? this._renderCycle(cycle) : this._renderStart()}
    </section>`;
  }

  _collectStartActions(form) {
    return [...form.querySelectorAll(".p360d-action-row")].map(row => ({
      actionType: row.querySelector("[data-action-type]")?.value,
      title: row.querySelector("[data-action-title]")?.value.trim(),
      successCriterion: row.querySelector("[data-action-criterion]")?.value.trim()
    })).filter(item => item.title);
  }

  bind(container, onChanged = async () => {}) {
    container.querySelector("#p360d-start-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await this.service.startCycle({
          teamSeasonId: this.context.teamSeasonId,
          playerId: this.context.playerId,
          objectiveProfileId: this.objectiveProfile?.id,
          actions: this._collectStartActions(form)
        });
        await onChanged();
      } catch (error) {
        alert(`❌ ${error.message || error}`);
        button.disabled = false;
      }
    });

    container.querySelectorAll(".p360d-state-form").forEach(form => form.addEventListener("submit", async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await this.service.setActionState({
          actionId: form.dataset.actionId,
          targetState: form.querySelector("[data-action-state]")?.value,
          note: form.querySelector("[data-action-note]")?.value.trim() || null
        });
        await onChanged();
      } catch (error) {
        alert(`❌ ${error.message || error}`);
        button.disabled = false;
      }
    }));

    container.querySelectorAll(".p360d-evidence-form").forEach(form => form.addEventListener("submit", async event => {
      event.preventDefault();
      const raw = form.querySelector("[data-evidence]")?.value || "";
      const [evidenceType, evidenceId] = raw.split("|");
      if (!evidenceType || !evidenceId) return;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await this.service.linkEvidence({ actionId: form.dataset.actionId, evidenceType, evidenceId });
        await onChanged();
      } catch (error) {
        alert(`❌ ${error.message || error}`);
        button.disabled = false;
      }
    }));

    container.querySelector("#p360d-review-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await this.service.reviewCycle({
          cycleId: form.dataset.cycleId,
          outcome: form.querySelector("[data-review-outcome]")?.value,
          note: form.querySelector("[data-review-note]")?.value.trim() || null
        });
        await onChanged();
      } catch (error) {
        alert(`❌ ${error.message || error}`);
        button.disabled = false;
      }
    });
  }
}

export default DevelopmentCyclePanel;
