import { PlayerSubmissionType } from "../../services/player360/PlayerDataSubmissionService.js";

const STATUS = Object.freeze({
  DRAFT: ["Borrador", "#e2e8f0", "#475569"],
  SUBMITTED: ["Pendiente de validación", "#fef3c7", "#92400e"],
  RETURNED: ["Necesita cambios", "#ffedd5", "#9a3412"],
  APPROVED: ["Validado", "#dcfce7", "#166534"],
  REJECTED: ["Rechazado", "#fee2e2", "#991b1b"]
});

function esc(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fieldValue(value) {
  return value === null || value === undefined ? "" : value;
}

export class PlayerSubmissionPanel {
  constructor({ service } = {}) {
    this.service = service;
    this.context = null;
    this.items = [];
    this.editingId = null;
    this.lastError = null;
  }

  async load(context = {}) {
    this.context = context;
    this.lastError = null;
    try {
      this.items = await this.service.listMine({
        teamSeasonId: context.teamSeasonId,
        playerId: context.playerId,
        limit: 100
      });
      if (this.editingId && !this.items.some(item => String(item.id) === String(this.editingId))) {
        this.editingId = null;
      }
    } catch (error) {
      this.lastError = error;
      this.items = [];
    }
  }

  _status(status) {
    return STATUS[String(status || "").toUpperCase()] || [status || "Estado", "#f1f5f9", "#475569"];
  }

  _typeLabel(type) {
    return type === PlayerSubmissionType.WELLNESS_CHECKIN
      ? "Check-in de hábitos"
      : "Entrenamiento externo";
  }

  _summary(item = {}) {
    const payload = item.payload || {};
    if (item.submission_type === PlayerSubmissionType.WELLNESS_CHECKIN) {
      const module = String(payload.module || "").toLowerCase() === "nutrition" ? "Nutrición" : "Recuperación";
      return `${module} · ${payload.entry_date || ""}`;
    }
    return `${payload.title || "Entrenamiento"} · ${payload.activity_date || ""}`;
  }

  _editingItem() {
    if (!this.editingId) return null;
    return this.items.find(item => String(item.id) === String(this.editingId)) || null;
  }

  _isEditable(item = {}) {
    return ["DRAFT", "RETURNED"].includes(String(item.status || "").toUpperCase());
  }

  _wellnessCorrectionEditor(item) {
    if (!item || item.submission_type !== PlayerSubmissionType.WELLNESS_CHECKIN) return "";
    const payload = item.payload || {};
    const values = Array.isArray(payload.values) ? payload.values : [];
    return `
      <article class="psub-card psub-correction" data-psub-correction-id="${esc(item.id)}">
        <div class="psub-top">
          <div>
            <small>Corrección solicitada por el staff</small>
            <strong>${esc(this._summary(item))}</strong>
          </div>
          <button type="button" class="psub-cancel-edit" data-psub-cancel-edit style="min-height:40px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#475569;font-weight:800;padding:7px 10px;cursor:pointer;">Cancelar edición</button>
        </div>
        ${item.review_note ? `<p class="psub-review">Qué debes corregir: ${esc(item.review_note)}</p>` : ""}
        <form id="psub-wellness-correction-form" class="psub-form" data-submission-id="${esc(item.id)}">
          <label>Fecha
            <input id="psub-wellness-date" type="date" required max="${today()}" value="${esc(payload.entry_date || today())}">
          </label>
          <label>Módulo
            <select id="psub-wellness-module" required>
              <option value="nutrition" ${String(payload.module || "").toLowerCase() === "nutrition" ? "selected" : ""}>Nutrición</option>
              <option value="recovery" ${String(payload.module || "").toLowerCase() === "recovery" ? "selected" : ""}>Recuperación</option>
            </select>
          </label>
          ${values.map((entry, index) => {
            const value = entry?.value;
            const code = String(entry?.metric_code || `metric_${index + 1}`);
            const label = code.replaceAll("_", " ");
            if (typeof value === "boolean") {
              return `<label>${esc(label)}
                <select class="psub-wellness-value" data-metric-code="${esc(code)}" data-value-kind="BOOLEAN">
                  <option value="true" ${value ? "selected" : ""}>Sí</option>
                  <option value="false" ${!value ? "selected" : ""}>No</option>
                </select>
              </label>`;
            }
            if (typeof value === "number") {
              return `<label>${esc(label)}
                <input class="psub-wellness-value" data-metric-code="${esc(code)}" data-value-kind="NUMBER" type="number" step="any" value="${esc(value)}" required>
              </label>`;
            }
            return `<label>${esc(label)}
              <input class="psub-wellness-value" data-metric-code="${esc(code)}" data-value-kind="TEXT" type="text" value="${esc(fieldValue(value))}" required>
            </label>`;
          }).join("")}
          <div class="psub-actions">
            <button type="button" class="psub-draft" id="psub-save-wellness-correction">Guardar corrección</button>
            <button type="submit" class="psub-submit">Corregir y reenviar</button>
          </div>
        </form>
      </article>`;
  }

  _history() {
    if (!this.items.length) return `<div class="psub-empty">Todavía no has enviado aportaciones.</div>`;
    return `<div class="psub-history">${this.items.map(item => {
      const meta = this._status(item.status);
      const status = String(item.status || "").toUpperCase();
      const editable = this._isEditable(item);
      return `<article class="psub-item">
        <div class="psub-top">
          <div><small>${esc(this._typeLabel(item.submission_type))}</small><strong>${esc(this._summary(item))}</strong></div>
          <span style="background:${meta[1]};color:${meta[2]}">${esc(meta[0])}</span>
        </div>
        ${item.review_note ? `<p class="psub-review">Comentario del revisor: ${esc(item.review_note)}</p>` : ""}
        ${editable ? `<div class="psub-inline">
          <button type="button" data-psub-edit="${esc(item.id)}">${status === "RETURNED" ? "Corregir y reenviar" : "Editar"}</button>
          ${status === "DRAFT" ? `<button type="button" data-psub-send="${esc(item.id)}">Enviar al staff</button>` : ""}
        </div>` : ""}
      </article>`;
    }).join("")}</div>`;
  }

  render() {
    const guardian = String(this.context?.actorRelation || "SELF").toUpperCase() === "GUARDIAN";
    const heading = guardian ? "Aportaciones de familia" : "Mis aportaciones";
    const intro = guardian
      ? "Lo que aportes sobre este jugador queda como dato provisional y con procedencia Familia / Tutor. Solo pasa a su histórico cuando el staff lo valida."
      : "Lo que declares aquí se guarda como dato provisional. Solo pasa a tu histórico cuando el staff lo valida.";
    const editingItem = this._editingItem();
    const editingTraining = editingItem?.submission_type === PlayerSubmissionType.EXTERNAL_TRAINING ? editingItem : null;
    const trainingPayload = editingTraining?.payload || {};

    return `<section class="psub-panel" data-psub-actor-relation="${guardian ? "GUARDIAN" : "SELF"}">
      <style>
        .psub-panel{display:grid;gap:14px}.psub-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px}.psub-correction{border-color:#fdba74;background:#fffaf5}
        .psub-card h2,.psub-card h3{margin:0}.psub-card p{color:#64748b;line-height:1.5;font-size:12px}
        .psub-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.psub-form label{display:grid;gap:5px;font-size:12px;font-weight:800;color:#334155}
        .psub-form input,.psub-form textarea,.psub-form select{min-height:44px;border:1px solid #cbd5e1;border-radius:9px;padding:9px 10px;font:inherit;background:#fff;color:#0f172a}.psub-form textarea{min-height:82px;resize:vertical}
        .psub-wide{grid-column:1/-1}.psub-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
        .psub-actions button,.psub-inline button{min-height:44px;border-radius:9px;padding:9px 13px;font-weight:800;cursor:pointer}
        .psub-draft{background:#fff;color:#334155;border:1px solid #cbd5e1}.psub-submit{background:#1e3a8a;color:#fff;border:1px solid #1e3a8a}
        .psub-history{display:grid;gap:8px}.psub-item{border:1px solid #e2e8f0;border-radius:11px;padding:11px}.psub-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
        .psub-top>div{display:grid;gap:3px}.psub-top small{color:#64748b;font-weight:800}.psub-top span{border-radius:999px;padding:4px 8px;font-size:10px;font-weight:900;white-space:nowrap}
        .psub-review{background:#fff7ed;border-radius:8px;padding:8px;color:#9a3412!important}.psub-inline{margin-top:8px;display:flex;gap:7px;flex-wrap:wrap}.psub-inline button{border:1px solid #1e3a8a;background:#eff6ff;color:#1e3a8a}
        .psub-empty{padding:18px;border:1px dashed #cbd5e1;border-radius:10px;text-align:center;color:#64748b;font-size:12px}
        @media(max-width:640px){.psub-form{grid-template-columns:1fr}.psub-wide,.psub-actions{grid-column:1}.psub-actions{display:grid}.psub-actions button{width:100%}.psub-top{display:grid}.psub-inline{display:grid}.psub-inline button{width:100%}}
      </style>
      <article class="psub-card">
        <h2>${heading}</h2>
        <p>${esc(intro)}</p>
        ${this.lastError ? `<div class="psub-review">${esc(this.lastError.message || this.lastError)}</div>` : ""}
      </article>
      ${editingItem?.submission_type === PlayerSubmissionType.WELLNESS_CHECKIN ? this._wellnessCorrectionEditor(editingItem) : ""}
      <article class="psub-card ${editingTraining ? "psub-correction" : ""}">
        <h3>${editingTraining ? "Corregir entrenamiento devuelto" : (guardian ? "¿Ha entrenado fuera del equipo?" : "¿Has entrenado fuera del equipo?")}</h3>
        <p>${editingTraining && editingItem.review_note ? `Qué debes corregir: ${esc(editingItem.review_note)}` : (guardian ? "Registra una tecnificación, academia u otra sesión que conozcas de este jugador." : "Registra tecnificación, gimnasio, tiro, academia u otra sesión propia.")}</p>
        <form id="psub-training-form" class="psub-form">
          <label>Fecha<input id="psub-date" type="date" required max="${today()}" value="${esc(trainingPayload.activity_date || today())}"></label>
          <label>Duración (min)<input id="psub-duration" type="number" min="1" max="600" inputmode="numeric" value="${esc(fieldValue(trainingPayload.duration_minutes))}"></label>
          <label class="psub-wide">Título<input id="psub-title" maxlength="120" required placeholder="Ej. Tecnificación de tiro" value="${esc(trainingPayload.title || "")}"></label>
          <label>RPE (0-10)<input id="psub-rpe" type="number" min="0" max="10" step="0.5" inputmode="decimal" value="${esc(fieldValue(trainingPayload.rpe))}"></label>
          <label>Intensidad (0-10)<input id="psub-intensity" type="number" min="0" max="10" step="0.5" inputmode="decimal" value="${esc(fieldValue(trainingPayload.intensity))}"></label>
          <label class="psub-wide">Objetivo<input id="psub-objective" maxlength="240" placeholder="Qué has trabajado" value="${esc(trainingPayload.objective || "")}"></label>
          <label class="psub-wide">Notas<textarea id="psub-notes" maxlength="500" placeholder="Contexto útil para que el entrenador pueda validarlo">${esc(trainingPayload.notes || "")}</textarea></label>
          <div class="psub-actions">
            ${editingTraining ? `<button type="button" class="psub-draft" data-psub-cancel-edit>Cancelar edición</button>` : ""}
            <button type="button" class="psub-draft" id="psub-save-draft">${editingTraining ? "Guardar corrección" : "Guardar borrador"}</button>
            <button type="submit" class="psub-submit">${editingTraining ? "Corregir y reenviar" : "Enviar al staff"}</button>
          </div>
        </form>
      </article>
      <article class="psub-card">
        <h3>Estado de mis envíos</h3>
        <p>Borrador → Pendiente → Validado / Necesita cambios / Rechazado.</p>
        ${this._history()}
      </article>
    </section>`;
  }

  _trainingPayload(form) {
    const num = id => {
      const value = form.querySelector(id)?.value;
      return value === "" || value == null ? null : Number(value);
    };
    return {
      activity_date: form.querySelector("#psub-date")?.value,
      title: String(form.querySelector("#psub-title")?.value || "").trim(),
      duration_minutes: num("#psub-duration"),
      rpe: num("#psub-rpe"),
      intensity: num("#psub-intensity"),
      objective: String(form.querySelector("#psub-objective")?.value || "").trim() || null,
      notes: String(form.querySelector("#psub-notes")?.value || "").trim() || null,
      provider_type: String(this.context?.actorRelation || "SELF").toUpperCase() === "GUARDIAN"
        ? "GUARDIAN_REPORTED"
        : "SELF_REPORTED"
    };
  }

  _wellnessCorrectionPayload(form) {
    const values = [...form.querySelectorAll(".psub-wellness-value")].map(input => {
      const kind = input.dataset.valueKind;
      let value = input.value;
      if (kind === "BOOLEAN") value = value === "true";
      if (kind === "NUMBER") value = Number(value);
      return { metric_code: input.dataset.metricCode, value };
    });
    return {
      module: String(form.querySelector("#psub-wellness-module")?.value || "").toLowerCase(),
      entry_date: form.querySelector("#psub-wellness-date")?.value,
      values
    };
  }

  async bind(container, { onChanged } = {}) {
    if (!container) return;
    const refresh = typeof onChanged === "function" ? onChanged : async () => {};
    const cancelEditing = async () => {
      this.editingId = null;
      await refresh();
    };

    container.querySelectorAll("[data-psub-cancel-edit]").forEach(button => {
      button.addEventListener("click", cancelEditing);
    });

    container.querySelectorAll("[data-psub-edit]").forEach(button => {
      button.addEventListener("click", async () => {
        const item = this.items.find(row => String(row.id) === String(button.dataset.psubEdit));
        if (!item || !this._isEditable(item)) return;
        this.editingId = item.id;
        await refresh();
      });
    });

    const form = container.querySelector("#psub-training-form");
    const persistTraining = async submitNow => {
      if (!form?.reportValidity()) return;
      const editing = this._editingItem();
      const submissionId = editing?.submission_type === PlayerSubmissionType.EXTERNAL_TRAINING
        ? editing.id
        : null;
      const payload = this._trainingPayload(form);
      const button = submitNow ? form.querySelector('button[type="submit"]') : form.querySelector("#psub-save-draft");
      if (button) button.disabled = true;
      try {
        const id = await this.service.saveDraft({
          submissionId,
          teamSeasonId: this.context.teamSeasonId,
          playerId: this.context.playerId,
          type: PlayerSubmissionType.EXTERNAL_TRAINING,
          payload
        });
        if (submitNow) await this.service.submit(id);
        this.editingId = null;
        form.reset();
        form.querySelector("#psub-date").value = today();
        await this.load(this.context);
        await refresh();
      } catch (error) {
        alert(`❌ ${error.message || error}`);
      } finally {
        if (button) button.disabled = false;
      }
    };

    form?.addEventListener("submit", async event => {
      event.preventDefault();
      await persistTraining(true);
    });
    form?.querySelector("#psub-save-draft")?.addEventListener("click", () => persistTraining(false));

    const wellnessForm = container.querySelector("#psub-wellness-correction-form");
    const persistWellness = async submitNow => {
      if (!wellnessForm?.reportValidity()) return;
      const editing = this._editingItem();
      if (!editing || editing.submission_type !== PlayerSubmissionType.WELLNESS_CHECKIN) return;
      const button = submitNow
        ? wellnessForm.querySelector('button[type="submit"]')
        : wellnessForm.querySelector("#psub-save-wellness-correction");
      if (button) button.disabled = true;
      try {
        const id = await this.service.saveDraft({
          submissionId: editing.id,
          teamSeasonId: this.context.teamSeasonId,
          playerId: this.context.playerId,
          type: PlayerSubmissionType.WELLNESS_CHECKIN,
          payload: this._wellnessCorrectionPayload(wellnessForm)
        });
        if (submitNow) await this.service.submit(id);
        this.editingId = null;
        await this.load(this.context);
        await refresh();
      } catch (error) {
        alert(`❌ ${error.message || error}`);
      } finally {
        if (button) button.disabled = false;
      }
    };

    wellnessForm?.addEventListener("submit", async event => {
      event.preventDefault();
      await persistWellness(true);
    });
    wellnessForm?.querySelector("#psub-save-wellness-correction")?.addEventListener("click", () => persistWellness(false));

    container.querySelectorAll("[data-psub-send]").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await this.service.submit(button.dataset.psubSend);
          await this.load(this.context);
          await refresh();
        } catch (error) {
          alert(`❌ ${error.message || error}`);
          button.disabled = false;
        }
      });
    });
  }
}

export default PlayerSubmissionPanel;