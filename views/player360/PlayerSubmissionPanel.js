import { PlayerSubmissionType } from "../../services/player360/PlayerDataSubmissionService.js";

const STATUS = Object.freeze({
  DRAFT: ["Borrador","#e2e8f0","#475569"],
  SUBMITTED: ["Pendiente de validación","#fef3c7","#92400e"],
  RETURNED: ["Necesita cambios","#ffedd5","#9a3412"],
  APPROVED: ["Validado","#dcfce7","#166534"],
  REJECTED: ["Rechazado","#fee2e2","#991b1b"]
});

function esc(value="") {
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function today() { return new Date().toISOString().slice(0,10); }

export class PlayerSubmissionPanel {
  constructor({ service }={}) {
    this.service=service;
    this.context=null;
    this.items=[];
    this.editingId=null;
    this.lastError=null;
  }

  async load(context={}) {
    this.context=context;
    this.lastError=null;
    try {
      this.items=await this.service.listMine({ teamSeasonId:context.teamSeasonId,limit:100 });
    } catch(error) {
      this.lastError=error;
      this.items=[];
    }
  }
  _status(status) {
    return STATUS[String(status||"").toUpperCase()] || [status||"Estado","#f1f5f9","#475569"];
  }

  _typeLabel(type) {
    return type===PlayerSubmissionType.WELLNESS_CHECKIN
      ? "Check-in de hábitos"
      : "Entrenamiento externo";
  }

  _summary(item={}) {
    const p=item.payload || {};
    if (item.submission_type===PlayerSubmissionType.WELLNESS_CHECKIN) {
      const module=String(p.module||"").toLowerCase()==="nutrition" ? "Nutrición" : "Recuperación";
      return `${module} · ${p.entry_date || ""}`;
    }
    return `${p.title || "Entrenamiento"} · ${p.activity_date || ""}`;
  }

  _history() {
    if (!this.items.length) return `<div class="psub-empty">Todavía no has enviado aportaciones.</div>`;
    return `<div class="psub-history">${this.items.map(item=>{
      const meta=this._status(item.status);
      return `<article class="psub-item">
        <div class="psub-top">
          <div><small>${esc(this._typeLabel(item.submission_type))}</small><strong>${esc(this._summary(item))}</strong></div>
          <span style="background:${meta[1]};color:${meta[2]}">${esc(meta[0])}</span>
        </div>
        ${item.review_note ? `<p class="psub-review">Comentario del revisor: ${esc(item.review_note)}</p>` : ""}
        ${item.status==="DRAFT" || item.status==="RETURNED" ? `<div class="psub-inline">
          <button type="button" data-psub-send="${esc(item.id)}">Enviar al staff</button>
        </div>` : ""}
      </article>`;
    }).join("")}</div>`;
  }
  render() {
    return `<section class="psub-panel">
      <style>
        .psub-panel{display:grid;gap:14px}.psub-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px}
        .psub-card h2,.psub-card h3{margin:0}.psub-card p{color:#64748b;line-height:1.5;font-size:12px}
        .psub-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.psub-form label{display:grid;gap:5px;font-size:12px;font-weight:800;color:#334155}
        .psub-form input,.psub-form textarea{min-height:44px;border:1px solid #cbd5e1;border-radius:9px;padding:9px 10px;font:inherit}.psub-form textarea{min-height:82px;resize:vertical}
        .psub-wide{grid-column:1/-1}.psub-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
        .psub-actions button,.psub-inline button{min-height:44px;border-radius:9px;padding:9px 13px;font-weight:800;cursor:pointer}
        .psub-draft{background:#fff;color:#334155;border:1px solid #cbd5e1}.psub-submit{background:#1e3a8a;color:#fff;border:1px solid #1e3a8a}
        .psub-history{display:grid;gap:8px}.psub-item{border:1px solid #e2e8f0;border-radius:11px;padding:11px}.psub-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
        .psub-top>div{display:grid;gap:3px}.psub-top small{color:#64748b;font-weight:800}.psub-top span{border-radius:999px;padding:4px 8px;font-size:10px;font-weight:900;white-space:nowrap}
        .psub-review{background:#fff7ed;border-radius:8px;padding:8px;color:#9a3412!important}.psub-inline{margin-top:8px}.psub-inline button{border:1px solid #1e3a8a;background:#eff6ff;color:#1e3a8a}
        .psub-empty{padding:18px;border:1px dashed #cbd5e1;border-radius:10px;text-align:center;color:#64748b;font-size:12px}
        @media(max-width:640px){.psub-form{grid-template-columns:1fr}.psub-wide,.psub-actions{grid-column:1}.psub-actions{display:grid}.psub-actions button{width:100%}.psub-top{display:grid}}
      </style>
      <article class="psub-card">
        <h2>Mis aportaciones</h2>
        <p>Lo que declares aquí se guarda como dato provisional. Solo pasa a tu histórico cuando el staff lo valida.</p>
        ${this.lastError ? `<div class="psub-review">${esc(this.lastError.message||this.lastError)}</div>` : ""}
      </article>
      <article class="psub-card">
        <h3>¿Has entrenado fuera del equipo?</h3>
        <p>Registra tecnificación, gimnasio, tiro, academia u otra sesión propia.</p>
        <form id="psub-training-form" class="psub-form">
          <label>Fecha<input id="psub-date" type="date" required max="${today()}" value="${today()}"></label>
          <label>Duración (min)<input id="psub-duration" type="number" min="1" max="600" inputmode="numeric"></label>
          <label class="psub-wide">Título<input id="psub-title" maxlength="120" required placeholder="Ej. Tecnificación de tiro"></label>
          <label>RPE (0-10)<input id="psub-rpe" type="number" min="0" max="10" step="0.5" inputmode="decimal"></label>
          <label>Intensidad (0-10)<input id="psub-intensity" type="number" min="0" max="10" step="0.5" inputmode="decimal"></label>
          <label class="psub-wide">Objetivo<input id="psub-objective" maxlength="240" placeholder="Qué has trabajado"></label>
          <label class="psub-wide">Notas<textarea id="psub-notes" maxlength="500" placeholder="Contexto útil para que el entrenador pueda validarlo"></textarea></label>
          <div class="psub-actions">
            <button type="button" class="psub-draft" id="psub-save-draft">Guardar borrador</button>
            <button type="submit" class="psub-submit">Enviar al staff</button>
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
    const num=id=>{
      const value=form.querySelector(id)?.value;
      return value==="" || value==null ? null : Number(value);
    };
    return {
      activity_date:form.querySelector("#psub-date")?.value,
      title:String(form.querySelector("#psub-title")?.value||"").trim(),
      duration_minutes:num("#psub-duration"),
      rpe:num("#psub-rpe"),
      intensity:num("#psub-intensity"),
      objective:String(form.querySelector("#psub-objective")?.value||"").trim()||null,
      notes:String(form.querySelector("#psub-notes")?.value||"").trim()||null,
      provider_type:"SELF_REPORTED"
    };
  }
  async bind(container,{ onChanged }={}) {
    if (!container) return;
    const refresh=typeof onChanged==="function" ? onChanged : async()=>{};
    const form=container.querySelector("#psub-training-form");
    const persist=async submitNow=>{
      if (!form?.reportValidity()) return;
      const payload=this._trainingPayload(form);
      const button=submitNow ? form.querySelector('button[type="submit"]') : form.querySelector("#psub-save-draft");
      if (button) button.disabled=true;
      try {
        const id=await this.service.saveDraft({
          teamSeasonId:this.context.teamSeasonId,
          playerId:this.context.playerId,
          type:PlayerSubmissionType.EXTERNAL_TRAINING,
          payload
        });
        if (submitNow) await this.service.submit(id);
        form.reset();
        form.querySelector("#psub-date").value=today();
        await this.load(this.context);
        await refresh();
      } catch(error) {
        alert(`❌ ${error.message||error}`);
      } finally {
        if (button) button.disabled=false;
      }
    };

    form?.addEventListener("submit",async event=>{event.preventDefault();await persist(true);});
    form?.querySelector("#psub-save-draft")?.addEventListener("click",()=>persist(false));
    container.querySelectorAll("[data-psub-send]").forEach(button=>{
      button.addEventListener("click",async()=>{
        button.disabled=true;
        try {
          await this.service.submit(button.dataset.psubSend);
          await this.load(this.context);
          await refresh();
        } catch(error) {
          alert(`❌ ${error.message||error}`);
          button.disabled=false;
        }
      });
    });
  }
}

export default PlayerSubmissionPanel;
