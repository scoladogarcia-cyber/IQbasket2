import{P as A}from"./index-Co3VTdK8.js";const ae=Object.freeze(["PLAYER_SELF_SERVICE","FAMILY_SUPPORT","SPORT_PERFORMANCE","OPERATIONS"]);function ie(i){if(!i||typeof i.rpc!="function")throw new Error("WellnessService: cliente de datos no disponible.")}function m(i,e){if(i==null||i==="")throw new Error(`WellnessService: ${e} es obligatorio.`);return i}function D(i){return Array.isArray(i)?i:[]}class Ee{constructor(e=null){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e}_assertReady(){ie(this.supabase)}async getCapabilities({teamSeasonId:e,playerId:t,module:r,purpose:a}={}){this._assertReady(),m(e,"teamSeasonId"),m(t,"playerId"),m(r,"module"),m(a,"purpose");const{data:o,error:s}=await this.supabase.rpc("iq_v4e2_wellness_capabilities",{p_team_season_id:e,p_player_id:t,p_module:String(r).toLowerCase(),p_purpose:String(a).toUpperCase()});if(s)throw s;return{...o||{},purpose:String(a).toUpperCase()}}async resolveAccessContext({teamSeasonId:e,playerId:t,module:r}={}){return this._assertReady(),(await Promise.all(ae.map(s=>this.getCapabilities({teamSeasonId:e,playerId:t,module:r,purpose:s}).catch(()=>null)))).find(s=>s&&(s.can_read||s.can_create||s.can_update||s.can_archive))||{ready:!0,module:String(r||"").toLowerCase(),purpose:null,can_read:!1,can_create:!1,can_update:!1,can_archive:!1,manual_input_enabled:!0,external_import_enabled:!1,recommendations_enabled:!0,ai_processing_enabled:!1}}async listMetrics({teamSeasonId:e,module:t}={}){this._assertReady(),m(e,"teamSeasonId"),m(t,"module");const{data:r,error:a}=await this.supabase.rpc("iq_v4e2_list_wellness_metric_catalog",{p_team_season_id:e,p_module:String(t).toLowerCase()});if(a)throw a;return D(r)}async listEntries({teamSeasonId:e,playerId:t,module:r,purpose:a,fromDate:o=null,toDate:s=null,limit:n=100}={}){this._assertReady(),m(e,"teamSeasonId"),m(t,"playerId"),m(r,"module"),m(a,"purpose");const{data:l,error:c}=await this.supabase.rpc("iq_v4e2_list_wellness_entries",{p_team_season_id:e,p_player_id:t,p_module:String(r).toLowerCase(),p_purpose:String(a).toUpperCase(),p_from:o,p_to:s,p_limit:Math.max(1,Math.min(Number(n)||100,500))});if(c)throw c;return D(l).map(p=>({...p,observations:D(p==null?void 0:p.observations)}))}async saveManualEntry({entryId:e=null,teamSeasonId:t,playerId:r,module:a,entryDate:o,purpose:s,values:n=[]}={}){this._assertReady(),m(t,"teamSeasonId"),m(r,"playerId"),m(a,"module"),m(o,"entryDate"),m(s,"purpose");const l=D(n).filter(u=>u&&u.metric_code&&u.value!==void 0).map(u=>({metric_code:String(u.metric_code).toUpperCase(),value:u.value}));if(!l.length)throw new Error("WellnessService: indica al menos un valor.");const{data:c,error:p}=await this.supabase.rpc("iq_v4e2_save_manual_wellness_entry",{p_entry_id:e,p_team_season_id:t,p_player_id:r,p_module:String(a).toLowerCase(),p_entry_date:o,p_purpose:String(s).toUpperCase(),p_values:l});if(p)throw p;return c}async archiveEntry({entryId:e,purpose:t}={}){this._assertReady(),m(e,"entryId"),m(t,"purpose");const{data:r,error:a}=await this.supabase.rpc("iq_v4e2_archive_wellness_entry",{p_entry_id:e,p_purpose:String(t).toUpperCase()});if(a)throw a;return!!r}}const g=Object.freeze({NUMBER:"NUMBER",SCALE:"SCALE",BOOLEAN:"BOOLEAN",CHOICE:"CHOICE"});function y(i){return Object.freeze({sensitivity:"WELLNESS_RESTRICTED",enabled:!0,...i})}const ne=Object.freeze([y({module:"recovery",code:"SLEEP_DURATION_HOURS",name:"Duración del sueño",description:"Horas de sueño percibidas/registradas en el último descanso.",value_type:g.NUMBER,unit:"HOURS",min_value:0,max_value:16,step:.25,sort_order:10}),y({module:"recovery",code:"SLEEP_QUALITY",name:"Calidad del sueño",description:"Valoración subjetiva del descanso.",value_type:g.SCALE,unit:"SCALE_1_5",min_value:1,max_value:5,step:1,sort_order:20}),y({module:"recovery",code:"FATIGUE",name:"Fatiga percibida",description:"Sensación general de fatiga antes de la actividad.",value_type:g.SCALE,unit:"SCALE_1_5",min_value:1,max_value:5,step:1,sort_order:30}),y({module:"recovery",code:"MUSCLE_SORENESS",name:"Molestia muscular percibida",description:"Nivel global de carga/molestia muscular percibida, no diagnóstico.",value_type:g.SCALE,unit:"SCALE_1_5",min_value:1,max_value:5,step:1,sort_order:40}),y({module:"recovery",code:"READINESS",name:"Preparación percibida",description:"Sensación general de estar preparado/a para entrenar o competir.",value_type:g.SCALE,unit:"SCALE_1_5",min_value:1,max_value:5,step:1,sort_order:50}),y({module:"recovery",code:"DAILY_ENERGY",name:"Energía percibida",description:"Nivel subjetivo de energía disponible para la actividad diaria o deportiva.",value_type:g.SCALE,unit:"SCALE_1_5",min_value:1,max_value:5,step:1,sort_order:60}),y({module:"nutrition",code:"HYDRATION_ADHERENCE",name:"Hidratación percibida",description:"Valoración de cumplimiento de la pauta personal de hidratación.",value_type:g.SCALE,unit:"SCALE_1_5",min_value:1,max_value:5,step:1,sort_order:10}),y({module:"nutrition",code:"MEAL_REGULARITY",name:"Regularidad de ingestas",description:"Valoración de regularidad respecto a la pauta personal.",value_type:g.SCALE,unit:"SCALE_1_5",min_value:1,max_value:5,step:1,sort_order:20}),y({module:"nutrition",code:"PRE_TRAINING_FUELING",name:"Ingesta previa planificada",description:"Se siguió la pauta personal prevista antes de entrenar/competir.",value_type:g.BOOLEAN,unit:"BOOLEAN",sort_order:30}),y({module:"nutrition",code:"POST_TRAINING_RECOVERY",name:"Recuperación posterior planificada",description:"Se siguió la pauta personal prevista tras entrenar/competir.",value_type:g.BOOLEAN,unit:"BOOLEAN",sort_order:40})]),h=Object.freeze({INFO:"INFO",SUPPORT:"SUPPORT",REVIEW:"REVIEW"}),se=Object.freeze([Object.freeze({module:"recovery",metric_code:"SLEEP_QUALITY",trigger:"LTE",threshold:2,priority:h.SUPPORT,code:"SUPPORT_SLEEP_ROUTINE",title:"Protege tu rutina de descanso",message:"Hoy prioriza una rutina de descanso estable y reduce cambios innecesarios antes de la siguiente sesión."}),Object.freeze({module:"recovery",metric_code:"FATIGUE",trigger:"GTE",threshold:4,priority:h.REVIEW,code:"REVIEW_FATIGUE_LOAD",title:"Revisa la carga del día",message:"La fatiga percibida es alta. Conviene revisar con el staff la intensidad prevista y priorizar calidad de ejecución."}),Object.freeze({module:"recovery",metric_code:"MUSCLE_SORENESS",trigger:"GTE",threshold:4,priority:h.REVIEW,code:"REVIEW_MUSCLE_LOAD",title:"Ajusta la exigencia si es necesario",message:"La molestia muscular percibida es alta. Revisa sensaciones con el staff antes de aumentar la carga."}),Object.freeze({module:"recovery",metric_code:"READINESS",trigger:"LTE",threshold:2,priority:h.REVIEW,code:"REVIEW_READINESS",title:"Prioriza calidad sobre cantidad",message:"La preparación percibida es baja. Antes de la sesión, revisa objetivos y carga para mantener una ejecución de calidad."}),Object.freeze({module:"recovery",metric_code:"DAILY_ENERGY",trigger:"LTE",threshold:2,priority:h.SUPPORT,code:"SUPPORT_DAILY_ENERGY",title:"Protege la energía del día",message:"La energía percibida es baja. Prioriza una preparación sencilla, descanso suficiente y una carga acorde con el objetivo de la sesión."}),Object.freeze({module:"nutrition",metric_code:"HYDRATION_ADHERENCE",trigger:"LTE",threshold:2,priority:h.SUPPORT,code:"SUPPORT_HYDRATION_PLAN",title:"Recupera tu pauta de hidratación",message:"Vuelve a la pauta de hidratación que ya tengas definida y distribúyela de forma regular durante el día."}),Object.freeze({module:"nutrition",metric_code:"MEAL_REGULARITY",trigger:"LTE",threshold:2,priority:h.SUPPORT,code:"SUPPORT_MEAL_REGULARITY",title:"Gana regularidad",message:"Intenta recuperar una pauta regular de ingestas acorde con tu planificación habitual."}),Object.freeze({module:"nutrition",metric_code:"PRE_TRAINING_FUELING",trigger:"EQ",threshold:!1,priority:h.SUPPORT,code:"SUPPORT_PRE_ACTIVITY_ROUTINE",title:"Prepara mejor la próxima sesión",message:"Para la próxima sesión, planifica con antelación tu pauta habitual previa a la actividad."}),Object.freeze({module:"nutrition",metric_code:"POST_TRAINING_RECOVERY",trigger:"EQ",threshold:!1,priority:h.SUPPORT,code:"SUPPORT_POST_ACTIVITY_ROUTINE",title:"Cierra mejor la sesión",message:"Recupera tu pauta habitual posterior a la actividad para reforzar la consistencia de recuperación."})]),Q=Object.freeze({contractVersion:"PLAYER360_WELLNESS_V2",supportedModules:Object.freeze(["nutrition","recovery"]),supportedValueTypes:Object.freeze(Object.values(g)),allowFreeTextValue:!1,manualInputEnabled:!0,externalImportEnabled:!1,recommendationsEnabled:!0,trendWindowsDays:Object.freeze([7,28]),aiProcessingEnabled:!1,defaultMetrics:ne,recommendationRules:se});function q(i){return String(i||"").trim().toUpperCase()}function Z(i){return String(i||"").trim().toLowerCase()}function oe(i,e){const t=q((e==null?void 0:e.metric_code)??(e==null?void 0:e.metricCode)),r=Z(e==null?void 0:e.module);if(t!==q(i.metric_code)||r!==Z(i.module))return!1;const a=e==null?void 0:e.value;switch(String(i.trigger||"").toUpperCase()){case"LTE":return Number.isFinite(Number(a))&&Number(a)<=Number(i.threshold);case"GTE":return Number.isFinite(Number(a))&&Number(a)>=Number(i.threshold);case"EQ":return a===i.threshold;default:return!1}}const J=Object.freeze({[h.REVIEW]:3,[h.SUPPORT]:2,[h.INFO]:1});class le{static evaluate({observations:e=[],rules:t=Q.recommendationRules}={}){if(!Q.recommendationsEnabled)return Object.freeze([]);const r=Array.isArray(e)?e:[],a=[];for(const o of Array.isArray(t)?t:[]){const s=r.filter(n=>oe(o,n));s.length&&a.push(Object.freeze({code:o.code,module:o.module,metric_code:o.metric_code,priority:o.priority,title:o.title,message:o.message,evidence:Object.freeze(s.map(n=>Object.freeze({metric_code:q(n.metric_code??n.metricCode),value:n.value,occurred_at:n.occurred_at??n.occurredAt??null}))),clinical_claim:!1,causal_claim:!1,source:"DETERMINISTIC_RULE"}))}return Object.freeze(a.sort((o,s)=>{const n=(J[s.priority]||0)-(J[o.priority]||0);return n!==0?n:String(o.code).localeCompare(String(s.code))}))}static summarize(e=[]){const t=Array.isArray(e)?e:[];return Object.freeze({total:t.length,review:t.filter(r=>r.priority===h.REVIEW).length,support:t.filter(r=>r.priority===h.SUPPORT).length,info:t.filter(r=>r.priority===h.INFO).length,hasRecommendations:t.length>0})}}const ce=24*60*60*1e3,v=Object.freeze({UP:"UP",DOWN:"DOWN",STABLE:"STABLE",INSUFFICIENT:"INSUFFICIENT"});function R(i){return Array.isArray(i)?i:[]}function I(i){return String(i||"").trim().toUpperCase()}function H(i){const e=String(i||"").slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(e))return null;const t=new Date(`${e}T00:00:00Z`);return Number.isNaN(t.getTime())?null:t}function M(i,e){return new Date(i.getTime()-Math.max(0,e)*ce)}function F(i){const e=R(i).map(Number).filter(Number.isFinite);return e.length?e.reduce((t,r)=>t+r,0)/e.length:null}function k(i){const e=R(i).filter(t=>typeof t=="boolean");return e.length?e.filter(Boolean).length/e.length:null}function z(i,e=2){if(!Number.isFinite(Number(i)))return null;const t=10**e;return Math.round(Number(i)*t)/t}function de(i={}){const e=Number(i.step);if(Number.isFinite(e)&&e>0)return Math.max(e/2,.05);const t=Number(i.min_value),r=Number(i.max_value);return Number.isFinite(t)&&Number.isFinite(r)&&r>t?Math.max((r-t)*.05,.05):.1}function pe(i,e,t){if(!Number.isFinite(Number(i))||!Number.isFinite(Number(e)))return v.INSUFFICIENT;const r=Number(i)-Number(e);return Math.abs(r)<t?v.STABLE:r>0?v.UP:v.DOWN}function W(i={}){const e=H(i.entry_date??i.entryDate);return e?e.getTime():null}function B(i={}){return i.value}function ue(i,e){const t=I(e),r=[];for(const a of R(i)){const o=H(a.entry_date??a.entryDate);if(!o)continue;const s=R(a.observations).find(n=>I((n==null?void 0:n.metric_code)??(n==null?void 0:n.metricCode))===t);!s||B(s)===null||B(s)===void 0||r.push(Object.freeze({date:String(a.entry_date??a.entryDate).slice(0,10),timestamp:o.getTime(),value:B(s),value_type:s.value_type??s.valueType??null,unit:s.unit??null}))}return r.sort((a,o)=>a.timestamp-o.timestamp)}function Y(i,e,t){return i.filter(r=>r.timestamp>=e.getTime()&&r.timestamp<=t.getTime()).map(r=>r.value)}class me{static analyze({entries:e=[],metrics:t=[],shortWindowDays:r=7,longWindowDays:a=28}={}){const o=R(e).filter(_=>W(_)!==null);if(!o.length)return Object.freeze({anchorDate:null,shortWindowDays:r,longWindowDays:a,metrics:Object.freeze([]),clinical_claim:!1,causal_claim:!1,source:"DETERMINISTIC_TREND"});const s=[...o].sort((_,f)=>W(f)-W(_))[0],n=H(s.entry_date??s.entryDate),l=Math.max(1,Number(r)||7),c=Math.max(l,Number(a)||28),p=M(n,l-1),u=M(p,1),L=M(u,l-1),E=M(n,c-1),T=R(t),K=[...new Set([...T.map(_=>I(_.code)),...o.flatMap(_=>R(_.observations).map(f=>I((f==null?void 0:f.metric_code)??(f==null?void 0:f.metricCode))))])].filter(Boolean).map(_=>{const f=T.find(re=>I(re.code)===_)||{},b=ue(o,_);if(!b.length)return null;const w=b[b.length-1],j=String(f.value_type||w.value_type||"").toUpperCase(),S=Y(b,p,n),U=Y(b,L,u),V=Y(b,E,n),C=j==="BOOLEAN",$=C?k(S):F(S),P=C?k(U):F(U),X=C?k(V):F(V),ee=C?.05:de(f),te=pe($,P,ee);return Object.freeze({metric_code:_,name:f.name||_.replaceAll("_"," "),value_type:j||null,unit:f.unit||w.unit||null,latest_value:w.value,latest_date:w.date,short_value:z($),previous_short_value:z(P),long_value:z(X),short_samples:S.length,previous_short_samples:U.length,long_samples:V.length,direction:te,delta_vs_previous:Number.isFinite(Number($))&&Number.isFinite(Number(P))?z(Number($)-Number(P)):null,clinical_claim:!1,causal_claim:!1,source:"DETERMINISTIC_TREND"})}).filter(Boolean).sort((_,f)=>{const b=T.find(S=>I(S.code)===_.metric_code),w=T.find(S=>I(S.code)===f.metric_code);return Number((b==null?void 0:b.sort_order)??999)-Number((w==null?void 0:w.sort_order)??999)||_.metric_code.localeCompare(f.metric_code)});return Object.freeze({anchorDate:String(s.entry_date??s.entryDate).slice(0,10),shortWindowDays:l,longWindowDays:c,metrics:Object.freeze(K),clinical_claim:!1,causal_claim:!1,source:"DETERMINISTIC_TREND"})}}const x=Object.freeze({nutrition:Object.freeze({label:"Nutrición",icon:"🥤",viewPermission:A.VIEW_NUTRITION,editPermission:A.EDIT_NUTRITION}),recovery:Object.freeze({label:"Recuperación",icon:"🌙",viewPermission:A.VIEW_RECOVERY,editPermission:A.EDIT_RECOVERY})}),fe=Object.freeze({[v.UP]:"↑ Sube",[v.DOWN]:"↓ Baja",[v.STABLE]:"→ Estable",[v.INSUFFICIENT]:"Datos insuficientes"});function d(i=""){return String(i??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function N(i){return Array.isArray(i)?i:[]}function O(i){return String(i||"").trim().toUpperCase()}function _e(){const i=new Date;return[i.getFullYear(),String(i.getMonth()+1).padStart(2,"0"),String(i.getDate()).padStart(2,"0")].join("-")}function he(i={}){if(i.value_type==="BOOLEAN")return i.value?"Sí":"No";const e=i.value;return e==null||e===""?"—":i.unit==="HOURS"?`${Number(e).toLocaleString(void 0,{maximumFractionDigits:2})} h`:String(e)}function G(i={},e,{aggregate:t=!1}={}){if(e==null||e==="")return"—";if(i.value_type==="BOOLEAN")return t?`${Math.round(Number(e)*100)}%`:e?"Sí":"No";const r=Number(e);if(!Number.isFinite(r))return String(e);const a=r.toLocaleString(void 0,{maximumFractionDigits:2});return i.unit==="HOURS"?`${a} h`:a}function ge(i){return[...N(i)].sort((e,t)=>String(t.entry_date||"").localeCompare(String(e.entry_date||""))||String(t.created_at||"").localeCompare(String(e.created_at||"")))}class we{constructor({service:e,can:t,modules:r=null}={}){this.service=e,this.can=typeof t=="function"?t:()=>!1,this.allowedModules=Array.isArray(r)?new Set(r.map(a=>String(a).toLowerCase())):null,this.context=null,this.backendAvailable=!1,this.lastError=null,this.activeModule="recovery",this.editorOpen=!1,this.editingEntryId=null,this.data={nutrition:{access:null,metrics:[],entries:[]},recovery:{access:null,metrics:[],entries:[]}}}_baseCanView(e){var t;return!!this.can((t=x[e])==null?void 0:t.viewPermission)}_baseCanEdit(e){var t;return!!this.can((t=x[e])==null?void 0:t.editPermission)}_visibleModules(){return Object.keys(x).filter(e=>(!this.allowedModules||this.allowedModules.has(e))&&this._baseCanView(e))}_dateBounds(){var e;return((e=this.context)==null?void 0:e.dateBounds)||{}}_defaultDate(){const e=_e(),{min:t,max:r}=this._dateBounds();return t&&e<t?t:r&&e>r?r:e}async load(e={}){var r,a,o;if(this.context={...e},this.lastError=null,this.backendAvailable=!1,!((r=this.service)!=null&&r.supabase))return;const t=this._visibleModules();if(t.length)try{for(const s of t){const[n,l]=await Promise.all([this.service.resolveAccessContext({teamSeasonId:e.teamSeasonId,playerId:e.playerId,module:s}),this.service.listMetrics({teamSeasonId:e.teamSeasonId,module:s})]),c=n!=null&&n.can_read&&(n!=null&&n.purpose)?await this.service.listEntries({teamSeasonId:e.teamSeasonId,playerId:e.playerId,module:s,purpose:n.purpose,fromDate:((a=e.dateBounds)==null?void 0:a.min)||null,toDate:((o=e.dateBounds)==null?void 0:o.max)||null,limit:100}):[];this.data[s]={access:n,metrics:N(l),entries:ge(c)}}this.backendAvailable=!0,t.includes(this.activeModule)||(this.activeModule=t[0])}catch(s){console.error("[WellnessSupportPanel] Error cargando Nutrition/Recovery:",s),this.lastError=s,this.backendAvailable=!1}}isAvailable(){return!!(this.backendAvailable&&this._visibleModules().length>0)}_entryById(e){var t,r;return((r=(t=this.data[this.activeModule])==null?void 0:t.entries)==null?void 0:r.find(a=>String(a.id)===String(e)))||null}_existingValues(e){return new Map(N(e==null?void 0:e.observations).map(t=>[O(t.metric_code),t.value]))}_metricMap(e=this.activeModule){var t;return new Map(N((t=this.data[e])==null?void 0:t.metrics).map(r=>[O(r.code),r]))}_renderMetricInput(e,t){const r=O(e.code),a=`p360w-${this.activeModule}-${r}`,o=`class="p360w-input" data-metric-code="${d(r)}" data-value-type="${d(e.value_type)}"`,s=t??"";if(e.value_type==="BOOLEAN")return`
        <select id="${a}" ${o}>
          <option value="">Sin indicar</option>
          <option value="true" ${s===!0?"selected":""}>Sí</option>
          <option value="false" ${s===!1?"selected":""}>No</option>
        </select>
      `;if(e.value_type==="CHOICE"){const p=N(e.options);return`
        <select id="${a}" ${o}>
          <option value="">Sin indicar</option>
          ${p.map(u=>`
            <option value="${d(u)}" ${String(s)===String(u)?"selected":""}>
              ${d(u)}
            </option>
          `).join("")}
        </select>
      `}const n=e.min_value??"",l=e.max_value??"",c=e.step??"any";if(e.value_type==="SCALE"&&Number(c)===1&&Number.isFinite(Number(n))&&Number.isFinite(Number(l))&&Number(l)-Number(n)<=10){const p=[];for(let u=Number(n);u<=Number(l);u+=1)p.push(u);return`
        <select id="${a}" ${o}>
          <option value="">Sin indicar</option>
          ${p.map(u=>`
            <option value="${u}" ${Number(s)===u?"selected":""}>${u}</option>
          `).join("")}
        </select>
      `}return`
      <input
        id="${a}"
        type="number"
        inputmode="decimal"
        min="${d(n)}"
        max="${d(l)}"
        step="${d(c)}"
        value="${d(s)}"
        ${o}
      />
    `}_renderEditor(){if(!this.editorOpen)return"";const e=this.activeModule,t=this.data[e]||{},r=t.access||{},a=this.editingEntryId?this._entryById(this.editingEntryId):null;if(!(this._baseCanEdit(e)&&!!(a?r.can_update:r.can_create))||!r.purpose)return"";const s=this._existingValues(a),{min:n,max:l}=this._dateBounds(),c=(a==null?void 0:a.entry_date)||this._defaultDate();return`
      <article class="p360w-card p360w-editor" id="p360w-editor">
        <div class="p360w-head">
          <div>
            <h3>${a?"Editar check-in":"Nuevo check-in"}</h3>
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
              value="${d(c)}"
              ${n?`min="${d(n)}"`:""}
              ${l?`max="${d(l)}"`:""}
            />
          </label>

          <div class="p360w-metrics">
            ${t.metrics.map(p=>`
              <label class="p360w-metric">
                <span class="p360w-metric-name">${d(p.name)}</span>
                <small>${d(p.description||"")}</small>
                ${this._renderMetricInput(p,s.get(O(p.code)))}
              </label>
            `).join("")}
          </div>

          <div class="p360w-actions">
            <button type="button" class="p360w-secondary" id="p360w-cancel">Cancelar</button>
            <button type="submit" class="p360w-primary">Guardar</button>
          </div>
        </form>
      </article>
    `}_latestRecommendations(){var a;const t=(((a=this.data[this.activeModule])==null?void 0:a.entries)||[])[0];if(!t)return[];const r=N(t.observations).map(o=>({module:this.activeModule,metric_code:o.metric_code,value:o.value,occurred_at:t.entry_date}));return le.evaluate({observations:r})}_renderRecommendations(){if(!this.can(A.VIEW_WELLNESS_RECOMMENDATIONS))return"";const e=this._latestRecommendations();return`
      <article class="p360w-card">
        <div class="p360w-head">
          <div>
            <h3>Apoyo para el siguiente paso</h3>
            <p>Recomendaciones deterministas, no clínicas y basadas solo en el último check-in.</p>
          </div>
          <span class="p360w-badge">Sin IA</span>
        </div>
        ${e.length?`
          <div class="p360w-recommendations">
            ${e.map(t=>`
              <div class="p360w-recommendation p360w-priority-${d(String(t.priority).toLowerCase())}">
                <div>
                  <strong>${d(t.title)}</strong>
                  <p>${d(t.message)}</p>
                </div>
                <span>${t.priority==="REVIEW"?"Revisar":"Apoyo"}</span>
              </div>
            `).join("")}
          </div>
        `:`
          <div class="p360w-empty">
            No hay recomendaciones prioritarias con el último check-in. Mantén la consistencia de tus hábitos.
          </div>
        `}
      </article>
    `}_renderTrends(){var r;const e=this.data[this.activeModule]||{};if(!((r=e.entries)!=null&&r.length))return"";const t=me.analyze({entries:e.entries,metrics:e.metrics,shortWindowDays:7,longWindowDays:28});return t.metrics.length?`
      <section class="p360w-trend-section" aria-label="Tendencias descriptivas de los check-ins">
        <div class="p360w-trend-head">
          <div>
            <h3>Tendencia 7 / 28 días</h3>
            <p>
              Resumen descriptivo anclado al último check-in (${d(t.anchorDate||"—")}).
              La flecha indica cambio, no si el cambio es bueno o malo.
            </p>
          </div>
          <span class="p360w-badge">Descriptivo</span>
        </div>
        <div class="p360w-trends">
          ${t.metrics.map(a=>`
            <article class="p360w-trend">
              <div class="p360w-trend-title">
                <strong>${d(a.name)}</strong>
                <span class="p360w-trend-direction p360w-trend-${d(String(a.direction).toLowerCase())}">
                  ${d(fe[a.direction]||"Datos insuficientes")}
                </span>
              </div>
              <div class="p360w-trend-stats">
                <span>
                  <small>Último</small>
                  <b>${d(G(a,a.latest_value))}</b>
                </span>
                <span>
                  <small>7 días</small>
                  <b>${d(G(a,a.short_value,{aggregate:!0}))}</b>
                  <em>n=${a.short_samples}</em>
                </span>
                <span>
                  <small>28 días</small>
                  <b>${d(G(a,a.long_value,{aggregate:!0}))}</b>
                  <em>n=${a.long_samples}</em>
                </span>
              </div>
            </article>
          `).join("")}
        </div>
        <p class="p360w-trend-disclaimer">
          No es un diagnóstico ni una relación causal con el rendimiento. Sirve para observar consistencia y preparar conversaciones con jugador, familia o staff según permisos.
        </p>
      </section>
    `:""}_renderHistory(){const e=this.activeModule,t=this.data[e]||{},r=t.access||{},a=this._baseCanEdit(e)&&r.can_update,o=this._baseCanEdit(e)&&r.can_archive,s=this._metricMap(e);return t.entries.length?`
      <div class="p360w-history">
        ${t.entries.map(n=>`
          <article class="p360w-history-card">
            <div class="p360w-history-top">
              <div>
                <strong>${d(n.entry_date)}</strong>
                <span>${n.source_type==="PLAYER_SELF_REPORT"?"Autoregistro":n.source_type==="GUARDIAN_REPORT"?"Tutor":"Staff"}</span>
              </div>
              ${a||o?`
                <div class="p360w-inline-actions">
                  ${a?`<button type="button" class="p360w-link p360w-edit" data-entry-id="${d(n.id)}">Editar</button>`:""}
                  ${o?`<button type="button" class="p360w-link p360w-archive" data-entry-id="${d(n.id)}">Archivar</button>`:""}
                </div>
              `:""}
            </div>
            <div class="p360w-values">
              ${N(n.observations).map(l=>{const c=O(l.metric_code),p=s.get(c);return`
                  <span>
                    <b>${d((p==null?void 0:p.name)||c.replaceAll("_"," "))}</b>
                    ${d(he(l))}
                  </span>
                `}).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    `:'<div class="p360w-empty">Todavía no hay check-ins registrados.</div>'}_renderStyles(){return`
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
    `}render(){if(!this.isAvailable())return"";const e=this._visibleModules(),t=this.activeModule,a=(this.data[t]||{access:null}).access||{},o=this._baseCanEdit(t)&&a.can_create&&a.purpose;return`
      <section class="p360w-panel">
        ${this._renderStyles()}
        <div class="p360w-note">
          Este módulo trabaja con hábitos y sensaciones de apoyo deportivo. No recoge diagnósticos,
          medicación, peso, calorías ni otros datos clínicos. La importación desde apps externas
          permanece desactivada en esta fase.
        </div>

        <div class="p360w-modules" role="tablist" aria-label="Apoyo Nutrition y Recovery">
          ${e.map(s=>`
            <button
              type="button"
              class="p360w-module"
              data-p360w-module="${s}"
              aria-selected="${t===s}"
            >${x[s].icon} ${x[s].label}</button>
          `).join("")}
        </div>

        ${a.purpose?`
          <article class="p360w-card">
            <div class="p360w-head">
              <div>
                <h2>${x[t].icon} ${x[t].label}</h2>
                <p>Check-in manual rápido para convertir sensaciones en apoyo práctico.</p>
              </div>
              <span class="p360w-badge">Privado</span>
            </div>
            ${o&&!this.editorOpen?`
              <div class="p360w-toolbar">
                <button type="button" class="p360w-primary" id="p360w-new">＋ Añadir check-in</button>
              </div>
            `:""}
            ${this._renderTrends()}
            ${this._renderHistory()}
          </article>

          ${this._renderEditor()}
          ${this._renderRecommendations()}
        `:`
          <div class="p360w-locked">
            El módulo está disponible, pero este usuario todavía no dispone de una autorización
            ABAC válida para este jugador y esta temporada. No se muestra ni se guarda ningún dato.
          </div>
        `}
      </section>
    `}_collectValues(e){return[...e.querySelectorAll(".p360w-input")].map(t=>{if(t.value==="")return null;const r=t.dataset.valueType;let a=t.value;if(r==="NUMBER"||r==="SCALE"){if(a=Number(a),!Number.isFinite(a))return null}else r==="BOOLEAN"&&(a=a==="true");return{metric_code:t.dataset.metricCode,value:a}}).filter(Boolean)}async bind(e,{onChanged:t}={}){var a,o,s;if(!e||!this.isAvailable())return;const r=typeof t=="function"?t:()=>{};e.querySelectorAll("[data-p360w-module]").forEach(n=>{n.addEventListener("click",async()=>{this.activeModule=n.dataset.p360wModule,this.editorOpen=!1,this.editingEntryId=null,await r()})}),(a=e.querySelector("#p360w-new"))==null||a.addEventListener("click",async()=>{var n;this.editorOpen=!0,this.editingEntryId=null,await r(),(n=e.querySelector("#p360w-editor"))==null||n.scrollIntoView({block:"start",behavior:"smooth"})}),(o=e.querySelector("#p360w-cancel"))==null||o.addEventListener("click",async()=>{this.editorOpen=!1,this.editingEntryId=null,await r()}),e.querySelectorAll(".p360w-edit").forEach(n=>{n.addEventListener("click",async()=>{var l;this.editingEntryId=n.dataset.entryId,this.editorOpen=!0,await r(),(l=e.querySelector("#p360w-editor"))==null||l.scrollIntoView({block:"start",behavior:"smooth"})})}),e.querySelectorAll(".p360w-archive").forEach(n=>{n.addEventListener("click",async()=>{var l;if(confirm("¿Archivar este check-in? Dejará de aparecer en el seguimiento.")){n.disabled=!0;try{const c=(l=this.data[this.activeModule])==null?void 0:l.access;await this.service.archiveEntry({entryId:n.dataset.entryId,purpose:c==null?void 0:c.purpose}),await this.load(this.context),await r()}catch(c){console.error("[WellnessSupportPanel] Error archivando:",c),alert(`❌ ${c.message||c}`),n.disabled=!1}}})}),(s=e.querySelector("#p360w-form"))==null||s.addEventListener("submit",async n=>{var u,L;n.preventDefault();const l=n.currentTarget,c=l.querySelector('button[type="submit"]'),p=this._collectValues(l);if(!p.length){alert("⚠️ Indica al menos un valor.");return}c.disabled=!0;try{const E=(u=this.data[this.activeModule])==null?void 0:u.access;await this.service.saveManualEntry({entryId:this.editingEntryId,teamSeasonId:this.context.teamSeasonId,playerId:this.context.playerId,module:this.activeModule,entryDate:(L=l.querySelector("#p360w-entry-date"))==null?void 0:L.value,purpose:E==null?void 0:E.purpose,values:p}),this.editorOpen=!1,this.editingEntryId=null,await this.load(this.context),await r()}catch(E){console.error("[WellnessSupportPanel] Error guardando:",E),alert(`❌ ${E.message||E}`),c.disabled=!1}})}}export{Ee as W,we as a};
