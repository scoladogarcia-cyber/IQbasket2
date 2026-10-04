/**
 * @fileoverview Training V58 intelligence shell.
 * @description Extends the stable V54/V55 editing experience with a compact,
 * read-mostly analytics surface and a fast historical focus classifier.
 */

import { TrainingCompleteEditV54View } from "./TrainingCompleteEditV54View.js";
import { DataStore } from "../../services/DataStore.js";
import { Permission } from "../../security/PermissionService.js";
import { TRAINING_FOCUS_OPTIONS, TRAINING_FOCUS_LABELS } from "../../config/trainingEditV54.config.js";
import { buildTrainingIntelligence } from "../../domain/player360/TrainingIntelligenceAnalytics.js";
import { TrainingIntelligenceService } from "../../services/player360/TrainingIntelligenceService.js";

function esc(value=""){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function fmt(value,digits=0){const n=Number(value);return Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:digits}):"—";}
function playerName(id){
  const p=DataStore.getPlayerById?.(id)||{};
  return p.name||[p.first_name,p.last_name].filter(Boolean).join(" ")||"Jugador";
}

export class TrainingIntelligenceV58View extends TrainingCompleteEditV54View {
  constructor(client=null,auth=null){
    super(client,auth);
    this.intelligenceService=new TrainingIntelligenceService(this.supabase);
  }

  _focusLabel(code){return TRAINING_FOCUS_LABELS[String(code||"").toUpperCase()]||String(code||"");}

  _classificationRows(analytics){
    if(!this._can(Permission.EDIT_TRAINING)) return "";
    const ids=new Set(analytics.unclassifiedSessionIds||[]);
    const sessions=(this.sessions||[]).filter(s=>ids.has(String(s.id))).slice(0,12);
    if(!sessions.length) return "";
    return `
      <details class="v58-classifier">
        <summary>Clasificar histórico · ${ids.size} sesiones pendientes</summary>
        <p>Solo se guardan los focos que confirmes; IQBasket no inventa clasificaciones históricas.</p>
        <div class="v58-classifier-list">
          ${sessions.map(session=>`
            <div class="v58-class-row" data-session-id="${esc(session.id)}">
              <div><strong>${esc(session.session_date||"")}</strong><span>${esc(session.title||"Entrenamiento")}</span></div>
              <div class="v58-focus-mini">
                ${TRAINING_FOCUS_OPTIONS.map(item=>`
                  <label><input type="checkbox" value="${esc(item.code)}"><span>${esc(item.label)}</span></label>
                `).join("")}
              </div>
              <button type="button" data-v58-save-focus>Guardar</button>
            </div>`).join("")}
        </div>
      </details>`;
  }

  _renderPanel(){
    if(!this._can(Permission.VIEW_TRAINING_ANALYTICS)) return "";
    const a=buildTrainingIntelligence(this.sessions||[]);
    const unclassified=(a.unclassifiedSessionIds||[]).length;
    const focusCards=(a.focuses||[]).map(f=>`
      <div class="v58-focus-card"><span>${esc(this._focusLabel(f.code))}</span><strong>${fmt(f.sessions)}</strong><small>${fmt(f.focusSessionMinutes)} min de sesiones con este foco</small></div>
    `).join("") || '<div class="v58-empty">Aún no hay focos clasificados.</div>';

    const playerRows=(a.players||[]).slice(0,20).map(p=>`
      <tr><td>${esc(playerName(p.playerId))}</td><td>${fmt(p.attendancePct,1)}%</td><td>${fmt(p.participatedMinutes)}</td><td>${fmt(p.avgRpe,1)}</td><td>${fmt(p.totalLoad)}</td></tr>
    `).join("");

    const weekRows=(a.weeks||[]).slice(-8).reverse().map(w=>`
      <tr><td>${esc(w.week)}</td><td>${fmt(w.sessions)}</td><td>${fmt(w.sessionMinutes)}</td><td>${fmt(w.avgRpe,1)}</td><td>${fmt(w.totalLoad)}</td></tr>
    `).join("");

    return `
      <section class="v58-training-intelligence" aria-label="Training Intelligence">
        <div class="v58-head"><div><span>IQBASKET · TRAINING INTELLIGENCE</span><h2>Qué entrenamos, cuánto y quién recibe la exposición</h2></div><b>${fmt(a.totals.focusCoveragePct,1)}% clasificado</b></div>
        <div class="v58-kpis">
          <article><span>Sesiones</span><strong>${fmt(a.totals.sessions)}</strong></article>
          <article><span>Horas</span><strong>${fmt((a.totals.sessionMinutes||0)/60,1)}</strong></article>
          <article><span>Asistencia</span><strong>${fmt(a.totals.attendancePct,1)}%</strong></article>
          <article><span>RPE medio</span><strong>${fmt(a.totals.avgRpe,1)}</strong></article>
          <article><span>Carga acumulada</span><strong>${fmt(a.totals.totalLoad)}</strong></article>
          <article><span>Sin clasificar</span><strong>${fmt(unclassified)}</strong></article>
        </div>
        <div class="v58-focus-grid">${focusCards}</div>
        <details class="v58-table-block" open><summary>Jugadores</summary>
          <div class="v58-scroll"><table><thead><tr><th>Jugador</th><th>Asistencia</th><th>Min</th><th>RPE</th><th>Carga</th></tr></thead><tbody>${playerRows||'<tr><td colspan="5">Sin datos.</td></tr>'}</tbody></table></div>
        </details>
        <details class="v58-table-block"><summary>Últimas semanas</summary>
          <div class="v58-scroll"><table><thead><tr><th>Semana</th><th>Ses.</th><th>Min sesión</th><th>RPE</th><th>Carga</th></tr></thead><tbody>${weekRows||'<tr><td colspan="5">Sin datos.</td></tr>'}</tbody></table></div>
        </details>
        <p class="v58-method">Exposición a un foco = minutos participados en sesiones que contenían ese foco. No implica que todos esos minutos se dedicaran exclusivamente a él ni demuestra causalidad con el rendimiento.</p>
        ${this._classificationRows(a)}
      </section>
      <style>
        .v58-training-intelligence{display:grid;gap:12px;padding:16px;border:1px solid #cbd5e1;border-radius:16px;background:linear-gradient(180deg,#f8fafc,#fff);margin:0 0 16px;color:#0f172a}
        .v58-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v58-head span{font-size:10px;font-weight:900;color:#1d4ed8;letter-spacing:.06em}.v58-head h2{margin:3px 0 0;font-size:18px}.v58-head b{font-size:12px;background:#dbeafe;color:#1e40af;border-radius:999px;padding:6px 9px;white-space:nowrap}
        .v58-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.v58-kpis article{padding:10px;border:1px solid #e2e8f0;border-radius:11px;background:#fff}.v58-kpis span{display:block;font-size:9px;text-transform:uppercase;color:#64748b;font-weight:900}.v58-kpis strong{font-size:18px}
        .v58-focus-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.v58-focus-card{display:grid;gap:2px;padding:10px;border-radius:11px;background:#eef2ff;border:1px solid #c7d2fe}.v58-focus-card span{font-size:11px;font-weight:850}.v58-focus-card strong{font-size:20px}.v58-focus-card small{font-size:9px;color:#475569}
        .v58-table-block{border:1px solid #e2e8f0;border-radius:11px;background:#fff}.v58-table-block summary,.v58-classifier summary{cursor:pointer;padding:10px 12px;font-weight:850}.v58-scroll{overflow:auto}.v58-table-block table{width:100%;border-collapse:collapse;font-size:11px}.v58-table-block th,.v58-table-block td{padding:8px 10px;border-top:1px solid #f1f5f9;text-align:left;white-space:nowrap}
        .v58-method{margin:0;font-size:10px;color:#64748b;line-height:1.45}.v58-classifier{border:1px solid #fdba74;border-radius:11px;background:#fff7ed}.v58-classifier>p{font-size:10px;color:#9a3412;padding:0 12px;margin:0 0 8px}.v58-classifier-list{display:grid;gap:7px;padding:0 10px 10px}.v58-class-row{display:grid;grid-template-columns:180px 1fr auto;gap:8px;align-items:center;background:#fff;border:1px solid #fed7aa;border-radius:9px;padding:8px}.v58-class-row>div:first-child{display:grid}.v58-class-row span{font-size:10px;color:#475569}.v58-focus-mini{display:flex;gap:5px;flex-wrap:wrap}.v58-focus-mini label{display:flex;gap:4px;align-items:center;border:1px solid #cbd5e1;border-radius:999px;padding:4px 6px;font-size:9px}.v58-class-row button{min-height:36px;border:0;border-radius:8px;background:#ea580c;color:#fff;font-weight:850;padding:6px 10px}
        @media(max-width:900px){.v58-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.v58-focus-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.v58-class-row{grid-template-columns:1fr}}
        @media(max-width:560px){.v58-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.v58-focus-grid{grid-template-columns:1fr}.v58-head{display:grid}}
      </style>`;
  }

  _bindPanel(container){
    container.querySelectorAll("[data-v58-save-focus]").forEach(button=>{
      button.onclick=async()=>{
        const row=button.closest(".v58-class-row"); if(!row)return;
        const codes=[...row.querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value);
        if(!codes.length){globalThis.alert?.("Selecciona al menos un foco.");return;}
        button.disabled=true;
        try{
          await this.intelligenceService.setFocusCodes({sessionId:row.dataset.sessionId,teamSeasonId:this.teamSeasonId,focusCodes:codes});
          await this.render(this.containerId,this.teamId);
        }catch(error){
          globalThis.alert?.(`No se pudo clasificar: ${error?.message||error}`);
          button.disabled=false;
        }
      };
    });
  }

  async render(containerId="dashboard-content-area",teamId=null){
    await super.render(containerId,teamId);
    const container=document.getElementById(containerId); if(!container)return;
    const root=container.querySelector(".p360-training-view")||container;
    const html=this._renderPanel(); if(!html)return;
    root.insertAdjacentHTML("afterbegin",html);
    this._bindPanel(root);
  }
}
export default TrainingIntelligenceV58View;
