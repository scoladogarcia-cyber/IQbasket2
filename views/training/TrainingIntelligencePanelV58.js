/**
 * @fileoverview Training Intelligence V58 presentation component.
 * @description Read-mostly analytics plus explicit historical focus classification.
 * The owning Training view remains responsible for the stable V54/V55 CRUD flow.
 */

import { DataStore } from "../../services/DataStore.js";
import { TranslationStore } from "../../services/TranslationStore.js";
import { I18n } from "../../services/I18nService.js";
import { trainingIntelligenceV85 } from "../../locales/trainingIntelligenceV85.js";
import { interpolateLanguageV80 } from "../../services/i18n/BundledLanguageCatalogV80.js";
import { Permission } from "../../security/PermissionService.js";
import { TRAINING_FOCUS_OPTIONS, TRAINING_FOCUS_LABELS } from "../../config/trainingEditV54.config.js";
import { buildTrainingIntelligence } from "../../domain/player360/TrainingIntelligenceAnalytics.js";
import { TrainingIntelligenceService } from "../../services/player360/TrainingIntelligenceService.js";

function esc(value=""){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function fmt(value,digits=0){if(value===null||value===undefined||value==="")return "—";const n=Number(value);return Number.isFinite(n)?n.toLocaleString(I18n.getLocale?.() || "es",{maximumFractionDigits:digits}):"—";}
function playerName(id){
  const p=DataStore.getPlayerById?.(id)||{};
  return p.name||[p.first_name,p.last_name].filter(Boolean).join(" ")||"Jugador";
}

export class TrainingIntelligencePanelV58 {
  constructor({client=null,can=()=>false,canEditSession=()=>false,getSessions=()=>[],getTeamSeasonId=()=>null,onRefresh=async()=>{}}={}){
    this.service=new TrainingIntelligenceService(client);
    this.can=can;
    // Historical sessions may belong to a different season with different permissions.
    this.canEditSession=canEditSession;
    this.getSessions=getSessions;
    this.getTeamSeasonId=getTeamSeasonId;
    this.onRefresh=onRefresh;
  }

  /**
   * Resolve feature-specific copy from its lazy-loaded catalog.
   * Shared navigation/taxonomy strings still use the central TranslationStore.
   * This keeps the initial mobile JS bundle below its strict size budget.
   */
  t(key, fallback="", params={}) {
    const lang=I18n.getLocale?.() || "es";
    const featureValue=trainingIntelligenceV85[lang]?.[key] ?? trainingIntelligenceV85.es[key];
    const value=featureValue ?? TranslationStore.t(key,params,fallback);
    return interpolateLanguageV80(value && value!==key ? value : fallback || key,params);
  }

  _focusLabel(code) {
    const normalized=String(code||"").toUpperCase();
    return this.t("training.focus."+normalized,TRAINING_FOCUS_LABELS[normalized]||normalized);
  }

  _classificationRows(analytics){
    if(!this.can(Permission.EDIT_TRAINING)) return "";
    const ids=new Set(analytics.unclassifiedSessionIds||[]);
    const sessions=(this.getSessions()||[]).filter(s=>ids.has(String(s.id)) && this.canEditSession(s)).slice(0,12);
    if(!sessions.length) return "";
    return '<details class="v58-classifier"><summary>'+esc(this.t("training.v58.classifyTitle","Clasificar histórico · {count} sesiones editables",{count:sessions.length}))+'</summary>'+
      '<p>'+esc(this.t("training.v58.classifyHelp","Solo se guardan los focos confirmados."))+'</p>'+
      '<div class="v58-classifier-list">'+sessions.map(session=>
        '<div class="v58-class-row" data-session-id="'+esc(session.id)+'" data-team-season-id="'+esc(session.team_season_id)+'">'+
          '<div><strong>'+esc(session.session_date||"")+'</strong><span>'+esc(session.title||this.t("training.v58.fallbackTraining","Entrenamiento"))+'</span></div>'+
          '<div class="v58-focus-mini">'+TRAINING_FOCUS_OPTIONS.map(item=>
            '<label><input type="checkbox" value="'+esc(item.code)+'"><span>'+esc(this._focusLabel(item.code))+'</span></label>'
          ).join("")+'</div>'+
          '<button type="button" data-v58-save-focus>'+esc(this.t("training.v58.save","Guardar"))+'</button>'+
        '</div>'
      ).join("")+'</div></details>';
  }

  _allocationRows(){
    if(!this.can(Permission.EDIT_TRAINING)) return "";
    const sessions=(this.getSessions()||[])
      .filter(s=>this.canEditSession(s) && Array.isArray(s?.metadata?.training_focus_codes)&&s.metadata.training_focus_codes.length)
      .slice(0,12);
    if(!sessions.length)return "";
    return '<details class="v58-classifier v58-dose"><summary>'+esc(this.t("training.v58.allocationTitle","Dosis por foco · opcional"))+'</summary>'+
      '<p>'+esc(this.t("training.v58.allocationHelp","Los minutos por foco son opcionales."))+'</p>'+
      '<div class="v58-classifier-list">'+sessions.map(session=>{
        const codes=session.metadata.training_focus_codes||[];
        const allocation=session.metadata.training_focus_minutes||{};
        return '<div class="v58-class-row v58-dose-row" data-session-id="'+esc(session.id)+'" data-team-season-id="'+esc(session.team_season_id)+'" data-session-duration="'+esc(session.duration_minutes||0)+'">'+
          '<div><strong>'+esc(session.session_date||"")+'</strong><span>'+esc(session.title||this.t("training.v58.fallbackTraining","Entrenamiento"))+' · '+fmt(session.duration_minutes)+' min</span></div>'+
          '<div class="v58-dose-inputs">'+codes.map(code=>
            '<label><span>'+esc(this._focusLabel(code))+'</span><input type="number" min="0" max="'+esc(session.duration_minutes||600)+'" step="1" inputmode="numeric" data-focus-code="'+esc(code)+'" value="'+esc(allocation[code]??"")+'" placeholder="min"></label>'
          ).join("")+'</div>'+
          '<button type="button" data-v58-save-dose>'+esc(this.t("training.v58.allocationSave","Guardar dosis"))+'</button>'+
        '</div>';
      }).join("")+'</div></details>';
  }

  html(){
    if(!this.can(Permission.VIEW_TRAINING_ANALYTICS)) return "";
    const a=buildTrainingIntelligence(this.getSessions()||[]);
    const focusCards=(a.focuses||[]).map(f=>
      '<div class="v58-focus-card"><span>'+esc(this._focusLabel(f.code))+'</span><strong>'+fmt(f.sessions)+'</strong>'+
      '<small>'+esc(this.t("training.v58.focusMinutes","{minutes} min de sesiones con este foco",{minutes:fmt(f.focusSessionMinutes)}))+'</small></div>'
    ).join("") || '<div class="v58-empty">'+esc(this.t("training.v58.focusEmpty","Aún no hay focos clasificados."))+'</div>';

    const playerRows=(a.players||[]).slice(0,20).map(p=>
      '<tr><td>'+esc(playerName(p.playerId))+'</td><td>'+fmt(p.attendancePct,1)+'%</td><td>'+fmt(p.participatedMinutes)+
      '</td><td>'+fmt(p.avgRpe,1)+'</td><td>'+fmt(p.totalLoad)+'</td></tr>'
    ).join("");
    const weekRows=(a.weeks||[]).slice(-8).reverse().map(w=>
      '<tr><td>'+esc(w.week)+'</td><td>'+fmt(w.sessions)+'</td><td>'+fmt(w.sessionMinutes)+'</td><td>'+fmt(w.avgRpe,1)+
      '</td><td>'+fmt(w.totalLoad)+'</td></tr>'
    ).join("");

    return '<section class="v58-training-intelligence" aria-label="Training Intelligence">'+
      '<div class="v58-head"><div><span>IQBASKET · TRAINING INTELLIGENCE</span><h2>'+esc(this.t("training.v58.heading","Qué entrenamos, cuánto y quién recibe la exposición"))+'</h2></div>'+
      '<b>'+esc(this.t("training.v58.classified","{percent}% clasificado",{percent:fmt(a.totals.focusCoveragePct,1)}))+'</b></div>'+
      '<div class="v58-kpis">'+
        '<article><span>'+esc(this.t("training.v58.sessions","Sesiones"))+'</span><strong>'+fmt(a.totals.sessions)+'</strong></article>'+
        '<article><span>'+esc(this.t("training.v58.hours","Horas"))+'</span><strong>'+fmt((a.totals.sessionMinutes||0)/60,1)+'</strong></article>'+
        '<article><span>'+esc(this.t("training.v58.attendance","Asistencia"))+'</span><strong>'+fmt(a.totals.attendancePct,1)+'%</strong></article>'+
        '<article><span>'+esc(this.t("training.v58.avgRpe","RPE medio"))+'</span><strong>'+fmt(a.totals.avgRpe,1)+'</strong></article>'+
        '<article><span>'+esc(this.t("training.v58.totalLoad","Carga acumulada"))+'</span><strong>'+fmt(a.totals.totalLoad)+'</strong></article>'+
        '<article><span>'+esc(this.t("training.v58.unclassified","Sin clasificar"))+'</span><strong>'+fmt((a.unclassifiedSessionIds||[]).length)+'</strong></article>'+
        '<article><span>'+esc(this.t("training.v58.explicitDose","Dosis explícita"))+'</span><strong>'+fmt(a.totals.explicitFocusAllocationCoveragePct,1)+'%</strong></article>'+
        '<article><span>'+esc(this.t("training.v58.load7","Carga 7 d"))+'</span><strong>'+fmt(a.rolling?.last7?.totalLoad)+'</strong></article>'+
      '</div>'+
      '<div class="v58-focus-grid">'+focusCards+'</div>'+
      '<details class="v58-table-block" open><summary>'+esc(this.t("training.v58.players","Jugadores"))+'</summary><div class="v58-scroll"><table><thead><tr><th>'+esc(this.t("training.v58.player","Jugador"))+'</th><th>'+esc(this.t("training.v58.attendance","Asistencia"))+'</th><th>'+esc(this.t("training.v58.minutes","Min"))+'</th><th>RPE</th><th>'+esc(this.t("training.v58.load","Carga"))+'</th></tr></thead><tbody>'+
        (playerRows||'<tr><td colspan="5">'+esc(this.t("training.v58.noData","Sin datos."))+'</td></tr>')+'</tbody></table></div></details>'+
      '<details class="v58-table-block"><summary>'+esc(this.t("training.v58.latestWeeks","Últimas semanas"))+'</summary><div class="v58-scroll"><table><thead><tr><th>'+esc(this.t("training.v58.week","Semana"))+'</th><th>'+esc(this.t("training.v58.sessionAbbr","Ses."))+'</th><th>'+esc(this.t("training.v58.sessionMinutes","Min sesión"))+'</th><th>RPE</th><th>'+esc(this.t("training.v58.load","Carga"))+'</th></tr></thead><tbody>'+
        (weekRows||'<tr><td colspan="5">'+esc(this.t("training.v58.noData","Sin datos."))+'</td></tr>')+'</tbody></table></div></details>'+
      '<p class="v58-method">'+esc(this.t("training.v58.method","La exposición es descriptiva, no causal."))+'</p>'+
      '<div class="v58-window-note"><strong>'+esc(this.t("training.v58.windows","Ventanas"))+':</strong> 7 d · '+fmt(a.rolling?.last7?.sessionMinutes)+' '+esc(this.t("training.v58.sessionMinutesShort","min sesión"))+' · '+fmt(a.rolling?.last7?.totalLoad)+' carga &nbsp;|&nbsp; 14 d · '+fmt(a.rolling?.last14?.sessionMinutes)+' min &nbsp;|&nbsp; 28 d · '+fmt(a.rolling?.last28?.sessionMinutes)+' min · '+fmt(a.rolling?.last28?.totalLoad)+' carga</div>'+
      this._classificationRows(a)+this._allocationRows()+
    '</section>'+this.styles();
  }

  styles(){
    return '<style>'+
      '.v58-training-intelligence{display:grid;gap:12px;padding:16px;border:1px solid #cbd5e1;border-radius:16px;background:linear-gradient(180deg,#f8fafc,#fff);margin:0 0 16px;color:#0f172a}.v58-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v58-head span{font-size:10px;font-weight:900;color:#1d4ed8;letter-spacing:.06em}.v58-head h2{margin:3px 0 0;font-size:18px}.v58-head b{font-size:12px;background:#dbeafe;color:#1e40af;border-radius:999px;padding:6px 9px;white-space:nowrap}.v58-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.v58-kpis article{padding:10px;border:1px solid #e2e8f0;border-radius:11px;background:#fff}.v58-kpis span{display:block;font-size:9px;text-transform:uppercase;color:#64748b;font-weight:900}.v58-kpis strong{font-size:18px}.v58-focus-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.v58-focus-card{display:grid;gap:2px;padding:10px;border-radius:11px;background:#eef2ff;border:1px solid #c7d2fe}.v58-focus-card span{font-size:11px;font-weight:850}.v58-focus-card strong{font-size:20px}.v58-focus-card small{font-size:9px;color:#475569}.v58-table-block{border:1px solid #e2e8f0;border-radius:11px;background:#fff}.v58-table-block summary,.v58-classifier summary{cursor:pointer;padding:10px 12px;font-weight:850}.v58-scroll{overflow:auto}.v58-table-block table{width:100%;border-collapse:collapse;font-size:11px}.v58-table-block th,.v58-table-block td{padding:8px 10px;border-top:1px solid #f1f5f9;text-align:left;white-space:nowrap}.v58-method{margin:0;font-size:10px;color:#64748b;line-height:1.45}.v58-window-note{font-size:10px;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:8px 10px}.v58-dose-inputs{display:flex;gap:6px;flex-wrap:wrap}.v58-dose-inputs label{display:grid;gap:3px;font-size:9px;font-weight:800;color:#475569}.v58-dose-inputs input{width:82px;min-height:36px;border:1px solid #cbd5e1;border-radius:7px;padding:5px 7px;color:#0f172a;background:#fff}.v58-classifier{border:1px solid #fdba74;border-radius:11px;background:#fff7ed}.v58-classifier>p{font-size:10px;color:#9a3412;padding:0 12px;margin:0 0 8px}.v58-classifier-list{display:grid;gap:7px;padding:0 10px 10px}.v58-class-row{display:grid;grid-template-columns:180px 1fr auto;gap:8px;align-items:center;background:#fff;border:1px solid #fed7aa;border-radius:9px;padding:8px}.v58-class-row>div:first-child{display:grid}.v58-class-row span{font-size:10px;color:#475569}.v58-focus-mini{display:flex;gap:5px;flex-wrap:wrap}.v58-focus-mini label{display:flex;gap:6px;align-items:center;border:1px solid #cbd5e1;border-radius:999px;min-height:44px;padding:8px 10px;font-size:12px;cursor:pointer}.v58-focus-mini input{width:18px;height:18px;accent-color:#ea580c}.v58-class-row button{min-height:44px;border:0;border-radius:8px;background:#ea580c;color:#fff;font-weight:850;padding:6px 10px}@media(max-width:900px){.v58-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.v58-focus-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.v58-class-row{grid-template-columns:1fr}}@media(max-width:560px){.v58-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.v58-focus-grid{grid-template-columns:1fr}.v58-head{display:grid}}'+
    '</style>';
  }

  bind(root){
    root?.querySelectorAll?.("[data-v58-save-dose]").forEach(button=>{
      button.addEventListener("click",async()=>{
        const row=button.closest(".v58-dose-row");if(!row)return;
        const allocations={};
        row.querySelectorAll("[data-focus-code]").forEach(input=>{
          if(String(input.value||"").trim()==="")return;
          const value=Number(input.value);
          if(Number.isFinite(value)&&value>=0)allocations[String(input.dataset.focusCode||"").toUpperCase()]=value;
        });
        const total=Object.values(allocations).reduce((sum,value)=>sum+value,0);
        const duration=Number(row.dataset.sessionDuration||0);
        if(duration>0&&total>duration){globalThis.alert?.(this.t("training.v58.errorDuration","Los minutos por foco no pueden superar la duración de la sesión."));return;}
        button.disabled=true;
        try{
          await this.service.setFocusAllocation({sessionId:row.dataset.sessionId,teamSeasonId:row.dataset.teamSeasonId,allocations});
          await this.onRefresh();
        }catch(error){
          globalThis.alert?.(this.t("training.v58.errorDose","No se pudo guardar la dosis: {error}",{error:String(error?.message||error)}));
          button.disabled=false;
        }
      });
    });
    root?.querySelectorAll?.("[data-v58-save-focus]").forEach(button=>{
      button.addEventListener("click",async()=>{
        const row=button.closest(".v58-class-row"); if(!row)return;
        const codes=[...row.querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value);
        if(!codes.length){globalThis.alert?.(this.t("training.v58.errorFocus","Selecciona al menos un foco."));return;}
        button.disabled=true;
        try{
          await this.service.setFocusCodes({sessionId:row.dataset.sessionId,teamSeasonId:row.dataset.teamSeasonId,focusCodes:codes});
          await this.onRefresh();
        }catch(error){
          globalThis.alert?.(this.t("training.v58.errorClassify","No se pudo clasificar: {error}",{error:String(error?.message||error)}));
          button.disabled=false;
        }
      });
    });
  }

  mount(root){
    const html=this.html(); if(!root||!html)return;
    root.querySelector(".v58-training-intelligence")?.remove();
    root.insertAdjacentHTML("afterbegin",html);
    this.bind(root);
  }
}
export default TrainingIntelligencePanelV58;
