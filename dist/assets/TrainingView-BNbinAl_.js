import{T as ne,I as re,D as C,P as j}from"./index-Co3VTdK8.js";import{T as se,a as le,E as te,b as ae,P as oe}from"./player360.config-CCSL1AnT.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";function t(m=""){return String(m??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function G(){const m=new Date;return[m.getFullYear(),String(m.getMonth()+1).padStart(2,"0"),String(m.getDate()).padStart(2,"0")].join("-")}function w(m){if(m==null||m==="")return null;const e=Number(m);return Number.isFinite(e)?e:null}function P(m,e=0){if(m==null||m==="")return"—";const i=Number(m);return Number.isFinite(i)?i.toLocaleString(void 0,{maximumFractionDigits:e,minimumFractionDigits:0}):"—"}function X(m="",e=""){const i=l=>{const d=String(l||"").match(/^(\d{2}):(\d{2})$/);if(!d)return null;const o=Number(d[1]),u=Number(d[2]);return o>23||u>59?null:o*60+u},a=i(m),n=i(e);return a===null||n===null||n<=a?null:n-a}function F(m=null){return m&&(m.name||[m.first_name,m.last_name].filter(Boolean).join(" ")||[m.firstName,m.lastName].filter(Boolean).join(" "))||"Jugador"}class ue{constructor(e=null,i=null){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e,this.auth=i,this.service=new se(this.supabase),this.activeTab="training",this.sessions=[],this.externalSessions=[],this.activityTypes=[],this.capabilities=null,this.lastError=null,this.isLoading=!1,this.teamId=null,this.teamSeasonId=null,this.containerId="dashboard-content-area",this.editingTrainingId=null,this.editingExternalId=null}t(e,i=""){var n,l,d,o;const a=((l=(n=ne)==null?void 0:n.t)==null?void 0:l.call(n,e,""))||((o=(d=re)==null?void 0:d.t)==null?void 0:o.call(d,e,""))||"";return!a||a===e||a.startsWith("[MISSING:")?i||e:a}_context(){return{teamId:this.teamId,teamSeasonId:this.teamSeasonId}}_can(e){var i,a;return e?typeof((i=this.auth)==null?void 0:i.canPreview)=="function"?!!this.auth.canPreview(e,this._context()):typeof((a=this.auth)==null?void 0:a.can)=="function"?!!this.auth.can(e,this._context()):!1:!1}_seasonContext(){var e,i;return((i=(e=C).getActiveSeasonContext)==null?void 0:i.call(e,this.teamId))||null}_defaultDate(){const e=this._seasonContext(),i=G(),a=String((e==null?void 0:e.start_date)||(e==null?void 0:e.startDate)||"").slice(0,10),n=String((e==null?void 0:e.end_date)||(e==null?void 0:e.endDate)||"").slice(0,10);return a&&i<a?a:n&&i>n?n:i}_dateInputBounds(){const e=this._seasonContext();return{min:String((e==null?void 0:e.start_date)||(e==null?void 0:e.startDate)||"").slice(0,10),max:String((e==null?void 0:e.end_date)||(e==null?void 0:e.endDate)||"").slice(0,10)}}_playerDirectory(){var n,l,d,o,u,T;const e=((l=(n=C).getSeasonParticipantPlayers)==null?void 0:l.call(n,this.teamId))||((o=(d=C).getTeamPlayers)==null?void 0:o.call(d,this.teamId))||[],i=((T=(u=C).getTeamPlayers)==null?void 0:T.call(u,this.teamId))||[],a=new Map;return[...e,...i].forEach($=>{$!=null&&$.id&&a.set(String($.id),$)}),a}_eligiblePlayers(e){var i,a,n,l,d,o;return((a=(i=C).getPlayersEligibleOnDate)==null?void 0:a.call(i,this.teamId,e))||((l=(n=C).getPlayersForActiveSeason)==null?void 0:l.call(n,this.teamId))||((o=(d=C).getTeamPlayers)==null?void 0:o.call(d,this.teamId))||[]}async _load(){var e,i;this.isLoading=!0,this.lastError=null;try{if(this.capabilities=await this.service.getCapabilities({force:!0}),!((e=this.capabilities)!=null&&e.ready)||!((i=this.capabilities)!=null&&i.training_core)){this.sessions=[],this.externalSessions=[];return}const[a,n,l]=await Promise.all([this._can(j.VIEW_TRAINING)?this.service.listSessions({teamSeasonId:this.teamSeasonId,limit:60}):Promise.resolve([]),this._can(j.VIEW_EXTERNAL_DEVELOPMENT)?this.service.listExternalDevelopment({teamSeasonId:this.teamSeasonId,limit:100}):Promise.resolve([]),this.service.listActivityTypes({teamSeasonId:this.teamSeasonId,includeInactive:!1})]);this.sessions=a,this.externalSessions=n,this.activityTypes=l}catch(a){console.error("[TrainingView] Error cargando Player 360 Training:",a),this.lastError=a,this.capabilities=this.capabilities||{ready:!1}}finally{this.isLoading=!1}}_sessionDuration(e={}){const i=w(e.duration_minutes);return i!==null&&i>0?i:X(String(e.start_time||"").slice(0,5),String(e.end_time||"").slice(0,5))}_sessionSummary(){const e=this.sessions.filter(d=>d.status!=="ARCHIVED"),i=e.reduce((d,o)=>d+(this._sessionDuration(o)||0),0),a=e.map(d=>Number(d.intensity)).filter(Number.isFinite),n=a.length?a.reduce((d,o)=>d+o,0)/a.length:null,l=e.reduce((d,o)=>d+(o.participants||[]).reduce((u,T)=>u+(Number(T.internal_load)||0),0),0);return{sessions:e.length,totalMinutes:i,avgIntensity:n,participantLoad:l}}_externalSummary(){const e=this.externalSessions.reduce((a,n)=>a+(Number(n.duration_minutes)||0),0),i=this.externalSessions.reduce((a,n)=>a+(Number(n.internal_load)||0),0);return{sessions:this.externalSessions.length,totalMinutes:e,totalLoad:i}}_renderKpi(e,i,a=""){return`
      <div class="p360-kpi">
        <span class="p360-kpi-label">${t(e)}</span>
        <strong class="p360-kpi-value">${t(i)}</strong>
        ${a?`<span class="p360-kpi-helper">${t(a)}</span>`:""}
      </div>
    `}_renderBlockRow(e=1){return`
      <div class="p360-block-row" data-block-index="${e}">
        <label>
          <span>${t(this.t("player360.training.block_title","Bloque"))}</span>
          <input type="text" class="p360-block-title" placeholder="Ej. Tiro tras bote" />
        </label>
        <label>
          <span>${t(this.t("player360.training.activity_code","Código / tipo"))}</span>
          <input type="text" class="p360-block-code" placeholder="Ej. SHOOTING" />
        </label>
        <label>
          <span>${t(this.t("player360.training.duration","Minutos"))}</span>
          <input type="number" class="p360-block-duration" min="1" max="300" inputmode="numeric" />
        </label>
        <label>
          <span>${t(this.t("player360.training.intensity","Intensidad 0-10"))}</span>
          <input type="number" class="p360-block-intensity" min="0" max="10" step="0.5" inputmode="decimal" />
        </label>
        <label class="p360-block-objective">
          <span>${t(this.t("player360.training.objective","Objetivo"))}</span>
          <input type="text" class="p360-block-objective-input" placeholder="Objetivo específico del bloque" />
        </label>
        <button type="button" class="p360-remove-block" aria-label="Eliminar bloque">×</button>
      </div>
    `}_renderParticipantChecklist(e){const i=this._eligiblePlayers(e);return i.length?`
      <div class="p360-participant-tools">
        <button type="button" class="p360-link-btn" id="p360-select-all-players">
          ${t(this.t("player360.training.select_all","Seleccionar plantilla"))}
        </button>
        <button type="button" class="p360-link-btn" id="p360-clear-all-players">
          ${t(this.t("player360.training.clear_all","Limpiar"))}
        </button>
      </div>
      <div class="p360-player-check-grid">
        ${i.map(a=>`
          <label class="p360-player-check">
            <input type="checkbox" name="p360-training-player" value="${t(a.id)}" />
            <span class="p360-player-number">#${t(a.jersey??a.number??"—")}</span>
            <span>${t(F(a))}</span>
          </label>
        `).join("")}
      </div>
    `:`
        <p class="p360-empty-inline">
          ${t(this.t("player360.training.no_eligible_players","No hay jugadores elegibles para la fecha seleccionada."))}
        </p>
      `}_renderTrainingForm(){if(!this._can(j.CREATE_TRAINING))return"";const e=this._defaultDate(),i=this._dateInputBounds();return`
      <details class="p360-create-panel" id="p360-create-training-panel">
        <summary>
          <span>＋</span>
          ${t(this.t("player360.training.create","Crear sesión de entrenamiento"))}
        </summary>

        <form id="p360-training-form" class="p360-form">
          <div class="p360-form-grid">
            <label>
              <span>${t(this.t("player360.training.date","Fecha"))}</span>
              <input
                type="date"
                id="p360-training-date"
                value="${t(e)}"
                ${i.min?`min="${t(i.min)}"`:""}
                ${i.max?`max="${t(i.max)}"`:""}
                required
              />
            </label>

            <label class="p360-span-2">
              <span>${t(this.t("player360.training.title","Nombre de la sesión"))}</span>
              <input type="text" id="p360-training-title" maxlength="140" placeholder="Ej. Técnica individual + ventajas 2c1" required />
            </label>

            <label>
              <span>${t(this.t("player360.training.start_time","Inicio"))}</span>
              <input type="time" id="p360-training-start-time" required />
            </label>

            <label>
              <span>${t(this.t("player360.training.end_time","Fin"))}</span>
              <input type="time" id="p360-training-end-time" required />
            </label>

            <label>
              <span>${t(this.t("player360.training.duration","Duración calculada (min)"))}</span>
              <input
                type="number"
                id="p360-training-duration"
                min="1"
                max="600"
                inputmode="numeric"
                readonly
                aria-readonly="true"
                placeholder="Inicio + fin"
              />
            </label>

            <label>
              <span>${t(this.t("player360.training.intensity","Intensidad prevista 0-10"))}</span>
              <input type="number" id="p360-training-intensity" min="0" max="10" step="0.5" inputmode="decimal" />
            </label>

            <label class="p360-span-2">
              <span>${t(this.t("player360.training.objective","Objetivo principal"))}</span>
              <textarea id="p360-training-objective" rows="2" maxlength="500" placeholder="Qué queremos provocar o mejorar"></textarea>
            </label>
          </div>

          <div class="p360-subsection">
            <div class="p360-subsection-head">
              <div>
                <strong>${t(this.t("player360.training.blocks","Bloques de trabajo"))}</strong>
                <small>${t(this.t("player360.training.blocks_help","Divide la sesión en contenidos independientes para poder analizar después qué se entrenó."))}</small>
              </div>
              <button type="button" class="p360-secondary-btn" id="p360-add-block">
                ＋ ${t(this.t("player360.training.add_block","Añadir bloque"))}
              </button>
            </div>
            <div id="p360-blocks-container">
              ${this._renderBlockRow(1)}
            </div>
          </div>

          <div class="p360-subsection">
            <div class="p360-subsection-head">
              <div>
                <strong>${t(this.t("player360.training.planned_roster","Jugadores planificados"))}</strong>
                <small>${t(this.t("player360.training.planned_roster_help","Solo se muestran jugadores elegibles en esa fecha. La asistencia real y el RPE se registran después."))}</small>
              </div>
            </div>
            <div id="p360-training-player-options">
              ${this._renderParticipantChecklist(e)}
            </div>
          </div>

          <div class="p360-form-actions">
            <button
              type="button"
              class="p360-secondary-btn p360-cancel-create"
              id="p360-cancel-training"
            >
              ${t(this.t("common.cancel","Cancelar"))}
            </button>
            <button type="submit" class="p360-primary-btn">
              ${t(this.t("player360.training.save_session","Guardar sesión"))}
            </button>
          </div>
        </form>
      </details>
    `}_attendanceStatusOptions(e="PLANNED"){return Object.entries(le).map(([i,a])=>`
        <option value="${i}" ${String(e).toUpperCase()===i?"selected":""}>
          ${t(a)}
        </option>
      `).join("")}_renderAttendanceEditor(e,i){if(!this._can(j.EDIT_TRAINING))return"";const a=new Set((e.participants||[]).map(o=>String(o.player_id))),n=this._eligiblePlayers(e.session_date).filter(o=>!a.has(String(o.id))),l=(e.participants||[]).filter(o=>String(o.attendance_status||"").toUpperCase()==="PLANNED"),d=String(e.session_date||"")<=G()&&l.length>0;return`
      <details class="p360-attendance-panel">
        <summary>
          ${t(this.t("player360.training.attendance_rpe","Asistencia · minutos · RPE"))}
        </summary>

        <div class="p360-attendance-list">
          ${d?`
            <div class="p360-attendance-bulk">
              <span>
                ${l.length} participante${l.length===1?"":"s"} pendiente${l.length===1?"":"s"} de confirmar.
              </span>
              <button
                type="button"
                class="p360-secondary-btn p360-confirm-planned"
                data-session-id="${t(e.id)}"
              >
                ✓ Marcar planificadas como presentes
              </button>
            </div>
          `:""}

          ${(e.participants||[]).map(o=>{const u=i.get(String(o.player_id));return`
              <div class="p360-attendance-row">
                <div class="p360-attendance-player">
                  <strong>${t(F(u))}</strong>
                  <span>#${t((u==null?void 0:u.jersey)??(u==null?void 0:u.number)??"—")}</span>
                </div>
                <select class="p360-att-status" aria-label="Estado">
                  ${this._attendanceStatusOptions(o.attendance_status)}
                </select>
                <input
                  class="p360-att-minutes"
                  type="number"
                  min="0"
                  max="600"
                  inputmode="numeric"
                  value="${o.participated_minutes??""}"
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
                  value="${o.rpe??""}"
                  placeholder="RPE"
                  aria-label="RPE"
                />
                <input
                  class="p360-att-notes"
                  type="text"
                  maxlength="240"
                  value="${t(o.notes||"")}"
                  placeholder="Nota opcional"
                  aria-label="Nota"
                />
                <button
                  type="button"
                  class="p360-secondary-btn p360-save-attendance"
                  data-session-id="${t(e.id)}"
                  data-player-id="${t(o.player_id)}"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  class="p360-danger-link p360-remove-participant"
                  data-session-id="${t(e.id)}"
                  data-player-id="${t(o.player_id)}"
                  aria-label="Quitar jugador de esta sesión"
                >
                  Quitar
                </button>
                <div class="p360-load-value">
                  Carga: <strong>${P(o.internal_load,1)}</strong>
                </div>
              </div>
            `}).join("")}

          ${n.length?`
            <div class="p360-add-participant-row">
              <select class="p360-new-participant-player" aria-label="Añadir jugador">
                <option value="">Añadir jugador…</option>
                ${n.map(o=>`
                  <option value="${t(o.id)}">
                    #${t(o.jersey??o.number??"—")} · ${t(F(o))}
                  </option>
                `).join("")}
              </select>
              <button
                type="button"
                class="p360-secondary-btn p360-add-participant"
                data-session-id="${t(e.id)}"
              >
                Añadir
              </button>
            </div>
          `:""}
        </div>
      </details>
    `}_renderEditableBlockRow(e={},i=1){return`
      <div
        class="p360-edit-block-row"
        data-block-id="${t(e.id||"")}"
        data-block-order="${t(e.block_order||i)}"
      >
        <label>
          <span>Bloque</span>
          <input type="text" class="p360-edit-block-title" maxlength="140" value="${t(e.title||"")}" placeholder="Nombre del bloque" />
        </label>
        <label>
          <span>Código / tipo</span>
          <input type="text" class="p360-edit-block-code" maxlength="80" value="${t(e.activity_code||"")}" placeholder="Ej. SHOOTING" />
        </label>
        <label>
          <span>Minutos</span>
          <input type="number" class="p360-edit-block-duration" min="1" max="300" inputmode="numeric" value="${t(e.duration_minutes??"")}" />
        </label>
        <label>
          <span>Intensidad</span>
          <input type="number" class="p360-edit-block-intensity" min="0" max="10" step="0.5" inputmode="decimal" value="${t(e.intensity??"")}" />
        </label>
        <label class="p360-edit-block-objective">
          <span>Objetivo</span>
          <input type="text" class="p360-edit-block-objective-input" maxlength="500" value="${t(e.objective||"")}" />
        </label>
        <div class="p360-edit-block-actions">
          <button type="button" class="p360-secondary-btn p360-save-edit-block">Guardar bloque</button>
          <button type="button" class="p360-danger-link p360-delete-edit-block">
            ${e.id?"Eliminar":"Descartar"}
          </button>
        </div>
      </div>
    `}_renderTrainingEditForm(e={}){if(!this._can(j.EDIT_TRAINING))return"";const i=this._dateInputBounds(),a=String(e.start_time||"").slice(0,5),n=String(e.end_time||"").slice(0,5);return`
      <form class="p360-form p360-inline-editor p360-training-edit-form" data-session-id="${t(e.id)}">
        <div class="p360-info-note">
          Corrige los datos generales y los bloques sin recrear la sesión. La asistencia se mantiene separada para proteger el histórico individual.
        </div>
        <div class="p360-form-grid">
          <label>
            <span>Fecha</span>
            <input
              type="date"
              class="p360-edit-training-date"
              value="${t(e.session_date||"")}"
              ${i.min?`min="${t(i.min)}"`:""}
              ${i.max?`max="${t(i.max)}"`:""}
              required
            />
          </label>
          <label class="p360-span-2">
            <span>Nombre de la sesión</span>
            <input type="text" class="p360-edit-training-title" maxlength="140" value="${t(e.title||"")}" required />
          </label>
          <label>
            <span>Inicio</span>
            <input type="time" class="p360-edit-training-start" value="${t(a)}" required />
          </label>
          <label>
            <span>Fin</span>
            <input type="time" class="p360-edit-training-end" value="${t(n)}" required />
          </label>
          <label>
            <span>Duración calculada (min)</span>
            <input type="number" class="p360-edit-training-duration" value="${t(this._sessionDuration(e)||"")}" readonly aria-readonly="true" />
          </label>
          <label>
            <span>Intensidad 0-10</span>
            <input type="number" class="p360-edit-training-intensity" min="0" max="10" step="0.5" inputmode="decimal" value="${t(e.intensity??"")}" />
          </label>
          <label class="p360-span-2">
            <span>Objetivo principal</span>
            <textarea class="p360-edit-training-objective" rows="2" maxlength="500">${t(e.objective||"")}</textarea>
          </label>
        </div>

        <div class="p360-subsection">
          <div class="p360-subsection-head">
            <div>
              <strong>Bloques de trabajo</strong>
              <small>Guarda cada bloque de forma independiente para no sobrescribir el resto por error.</small>
            </div>
            <button
              type="button"
              class="p360-secondary-btn p360-add-edit-block"
              data-session-id="${t(e.id)}"
            >
              ＋ Añadir bloque
            </button>
          </div>
          <div class="p360-edit-block-list">
            ${(e.blocks||[]).length?e.blocks.map((l,d)=>this._renderEditableBlockRow(l,d+1)).join(""):this._renderEditableBlockRow({},1)}
          </div>
        </div>

        <div class="p360-form-actions">
          <button type="button" class="p360-secondary-btn p360-cancel-training-edit">Cancelar</button>
          <button type="submit" class="p360-primary-btn">Guardar corrección</button>
        </div>
      </form>
    `}_renderExternalEditForm(e={}){if(!this._can(j.EDIT_EXTERNAL_DEVELOPMENT))return"";const i=this._dateInputBounds(),a=String(e.activity_date||"").slice(0,10);return`
      <form class="p360-form p360-inline-editor p360-external-edit-form" data-session-id="${t(e.id)}">
        <div class="p360-info-note">
          Corrige la tecnificación sin perder su procedencia ni el histórico de la temporada.
        </div>
        <div class="p360-form-grid">
          <label>
            <span>Fecha</span>
            <input
              type="date"
              class="p360-edit-external-date"
              value="${t(a)}"
              ${i.min?`min="${t(i.min)}"`:""}
              ${i.max?`max="${t(i.max)}"`:""}
              required
            />
          </label>
          <label>
            <span>Jugador</span>
            <select class="p360-edit-external-player" required>
              ${this._renderExternalPlayerOptions(a,e.player_id)}
            </select>
          </label>
          <label class="p360-span-2">
            <span>Actividad</span>
            <input type="text" class="p360-edit-external-title" maxlength="140" value="${t(e.title||"")}" required />
          </label>
          <label>
            <span>Código / tipo</span>
            <input type="text" class="p360-edit-external-code" maxlength="80" value="${t(e.activity_code||"")}" />
          </label>
          <label>
            <span>Proveedor / tecnificador</span>
            <input type="text" class="p360-edit-external-provider" maxlength="140" value="${t(e.provider_name||"")}" />
          </label>
          <label>
            <span>Duración (min)</span>
            <input type="number" class="p360-edit-external-duration" min="1" max="600" inputmode="numeric" value="${t(e.duration_minutes??"")}" />
          </label>
          <label>
            <span>Intensidad 0-10</span>
            <input type="number" class="p360-edit-external-intensity" min="0" max="10" step="0.5" inputmode="decimal" value="${t(e.intensity??"")}" />
          </label>
          <label>
            <span>RPE 0-10</span>
            <input type="number" class="p360-edit-external-rpe" min="0" max="10" step="0.5" inputmode="decimal" value="${t(e.rpe??"")}" />
          </label>
          <label>
            <span>Tipo de proveedor</span>
            <select class="p360-edit-external-provider-type">
              ${Object.entries(te).map(([n,l])=>`
                <option value="${t(n)}" ${String(e.provider_type||ae.EXTERNAL_COACH)===String(n)?"selected":""}>
                  ${t(l)}
                </option>
              `).join("")}
            </select>
          </label>
          <label class="p360-span-2">
            <span>Objetivo</span>
            <textarea class="p360-edit-external-objective" rows="2" maxlength="500">${t(e.objective||"")}</textarea>
          </label>
          <label class="p360-span-2">
            <span>Notas</span>
            <textarea class="p360-edit-external-notes" rows="2" maxlength="500">${t(e.notes||"")}</textarea>
          </label>
        </div>
        <div class="p360-form-actions">
          <button type="button" class="p360-secondary-btn p360-cancel-external-edit">Cancelar</button>
          <button type="submit" class="p360-primary-btn">Guardar corrección</button>
        </div>
      </form>
    `}_renderSessionCard(e,i){const a=(e.participants||[]).filter(l=>["PRESENT","PARTIAL"].includes(String(l.attendance_status||"").toUpperCase())).length,n=(e.participants||[]).reduce((l,d)=>l+(Number(d.internal_load)||0),0);return`
      <article class="p360-session-card">
        <div class="p360-session-top">
          <div>
            <div class="p360-date-badge">${t(e.session_date)}</div>
            <h3>${t(e.title)}</h3>
            ${e.objective?`<p>${t(e.objective)}</p>`:""}
          </div>
          <span class="p360-status p360-status-${t(String(e.status||"").toLowerCase())}">
            ${t(e.status||"PLANNED")}
          </span>
        </div>

        <div class="p360-session-metrics">
          <span>⏱ ${P(this._sessionDuration(e))} min</span>
          <span>⚡ Intensidad ${P(e.intensity,1)}</span>
          <span>👥 ${a}/${(e.participants||[]).length} presentes/parciales</span>
          <span>📊 Carga ${P(n,1)}</span>
        </div>

        ${(e.blocks||[]).length?`
          <div class="p360-block-list">
            ${e.blocks.map(l=>`
              <div class="p360-block-chip">
                <strong>${t(l.title)}</strong>
                <span>
                  ${t(l.activity_code||"GENERAL")}
                  ${l.duration_minutes?` · ${P(l.duration_minutes)} min`:""}
                  ${l.intensity!==null&&l.intensity!==void 0?` · I${P(l.intensity,1)}`:""}
                </span>
              </div>
            `).join("")}
          </div>
        `:`
          <p class="p360-empty-inline">Sin bloques registrados.</p>
        `}

        ${this._renderAttendanceEditor(e,i)}

        ${this.editingTrainingId&&String(this.editingTrainingId)===String(e.id)?this._renderTrainingEditForm(e):""}

        ${this._can(j.EDIT_TRAINING)||this._can(j.DELETE_TRAINING)?`
          <div class="p360-card-actions">
            ${this._can(j.EDIT_TRAINING)?`
              <button
                type="button"
                class="p360-secondary-link p360-edit-session"
                data-session-id="${t(e.id)}"
              >
                ✏️ Editar sesión
              </button>
            `:""}
            ${this._can(j.DELETE_TRAINING)?`
              <button
                type="button"
                class="p360-danger-link p360-archive-session"
                data-session-id="${t(e.id)}"
              >
                Archivar sesión
              </button>
            `:""}
          </div>
        `:""}
      </article>
    `}_renderTrainingPanel(){const e=this._sessionSummary(),i=this._playerDirectory();return`
      <section id="p360-panel-training" class="p360-tab-panel">
        <div class="p360-kpi-grid">
          ${this._renderKpi("Sesiones",String(e.sessions),"Temporada activa")}
          ${this._renderKpi("Minutos planificados",P(e.totalMinutes),"Suma de sesiones")}
          ${this._renderKpi("Intensidad media",P(e.avgIntensity,1),"Escala 0-10")}
          ${this._renderKpi("Carga registrada",P(e.participantLoad,1),"Minutos × RPE")}
        </div>

        ${this._renderTrainingForm()}

        <div class="p360-section-head">
          <div>
            <h2>${t(this.t("player360.training.history","Histórico de entrenamientos"))}</h2>
            <p>La carga solo aparece cuando se registran minutos y RPE del jugador.</p>
          </div>
        </div>

        <div class="p360-session-list">
          ${this.sessions.length?this.sessions.map(a=>this._renderSessionCard(a,i)).join(""):`
              <div class="p360-empty-state">
                <strong>Aún no hay entrenamientos registrados.</strong>
                <span>La primera sesión que guardes aparecerá aquí y quedará vinculada a la temporada.</span>
              </div>
            `}
        </div>
      </section>
    `}_renderExternalPlayerOptions(e,i=""){return`
      <option value="">Selecciona jugador…</option>
      ${this._eligiblePlayers(e).map(n=>`
        <option value="${t(n.id)}" ${String(i)===String(n.id)?"selected":""}>
          #${t(n.jersey??n.number??"—")} · ${t(F(n))}
        </option>
      `).join("")}
    `}_renderExternalForm(){if(!this._can(j.CREATE_EXTERNAL_DEVELOPMENT))return"";const e=this._defaultDate(),i=this._dateInputBounds();return`
      <details class="p360-create-panel" id="p360-create-external-panel">
        <summary>
          <span>＋</span>
          ${t(this.t("player360.external.create","Registrar desarrollo externo"))}
        </summary>

        <form id="p360-external-form" class="p360-form">
          <div class="p360-form-grid">
            <label>
              <span>Fecha</span>
              <input
                type="date"
                id="p360-external-date"
                value="${t(e)}"
                ${i.min?`min="${t(i.min)}"`:""}
                ${i.max?`max="${t(i.max)}"`:""}
                required
              />
            </label>

            <label>
              <span>Jugador</span>
              <select id="p360-external-player" required>
                ${this._renderExternalPlayerOptions(e)}
              </select>
            </label>

            <label class="p360-span-2">
              <span>Actividad</span>
              <input type="text" id="p360-external-title" maxlength="140" placeholder="Ej. Sesión individual de tiro" required />
            </label>

            <label>
              <span>Código / tipo</span>
              <input type="text" id="p360-external-code" maxlength="80" placeholder="Ej. SHOOTING" />
            </label>

            <label>
              <span>Proveedor / tecnificador</span>
              <input type="text" id="p360-external-provider" maxlength="140" placeholder="Nombre opcional" />
            </label>

            <label>
              <span>Duración (min)</span>
              <input type="number" id="p360-external-duration" min="1" max="600" inputmode="numeric" />
            </label>

            <label>
              <span>Intensidad 0-10</span>
              <input type="number" id="p360-external-intensity" min="0" max="10" step="0.5" inputmode="decimal" />
            </label>

            <label>
              <span>RPE 0-10</span>
              <input type="number" id="p360-external-rpe" min="0" max="10" step="0.5" inputmode="decimal" />
            </label>

            <label>
              <span>Tipo de proveedor</span>
              <select id="p360-external-provider-type">
                ${Object.entries(te).map(([a,n])=>`
                  <option value="${t(a)}" ${a===ae.EXTERNAL_COACH?"selected":""}>
                    ${t(n)}
                  </option>
                `).join("")}
              </select>
            </label>

            <label class="p360-span-2">
              <span>Objetivo</span>
              <textarea id="p360-external-objective" rows="2" maxlength="500" placeholder="Qué se trabajó o qué se buscaba mejorar"></textarea>
            </label>

            <label class="p360-span-2">
              <span>Notas</span>
              <textarea id="p360-external-notes" rows="2" maxlength="500" placeholder="Observación deportiva opcional"></textarea>
            </label>
          </div>

          <div class="p360-info-note">
            Este registro identifica trabajo realizado fuera del equipo para no atribuir automáticamente al club una evolución que puede proceder de tecnificación externa.
          </div>

          <div class="p360-form-actions">
            <button
              type="button"
              class="p360-secondary-btn p360-cancel-create"
              id="p360-cancel-external"
            >
              ${t(this.t("common.cancel","Cancelar"))}
            </button>
            <button type="submit" class="p360-primary-btn">Guardar desarrollo externo</button>
          </div>
        </form>
      </details>
    `}_renderExternalPanel(){const e=this._externalSummary(),i=this._playerDirectory();return`
      <section id="p360-panel-external" class="p360-tab-panel" hidden>
        <div class="p360-kpi-grid">
          ${this._renderKpi("Sesiones externas",String(e.sessions),"Temporada activa")}
          ${this._renderKpi("Minutos externos",P(e.totalMinutes),"Volumen registrado")}
          ${this._renderKpi("Carga externa",P(e.totalLoad,1),"Duración × RPE")}
        </div>

        ${this._renderExternalForm()}

        <div class="p360-section-head">
          <div>
            <h2>Histórico de desarrollo externo</h2>
            <p>Procedencia y autoría permanecen separadas del entrenamiento del club.</p>
          </div>
        </div>

        <div class="p360-external-list">
          ${this.externalSessions.length?this.externalSessions.map(a=>{const n=i.get(String(a.player_id));return`
                  <article class="p360-external-card">
                    <div class="p360-session-top">
                      <div>
                        <div class="p360-date-badge">${t(a.activity_date)}</div>
                        <h3>${t(a.title)}</h3>
                        <p>
                          ${t(F(n))}
                          ${a.provider_name?` · ${t(a.provider_name)}`:""}
                        </p>
                      </div>
                      <span class="p360-source-badge">${t(a.source_type||"EXTERNAL_COACH")}</span>
                    </div>

                    <div class="p360-session-metrics">
                      <span>⏱ ${P(a.duration_minutes)} min</span>
                      <span>⚡ I${P(a.intensity,1)}</span>
                      <span>RPE ${P(a.rpe,1)}</span>
                      <span>📊 Carga ${P(a.internal_load,1)}</span>
                    </div>

                    ${a.objective?`<p class="p360-card-text"><strong>Objetivo:</strong> ${t(a.objective)}</p>`:""}
                    ${a.notes?`<p class="p360-card-text"><strong>Nota:</strong> ${t(a.notes)}</p>`:""}

                    ${this.editingExternalId&&String(this.editingExternalId)===String(a.id)?this._renderExternalEditForm(a):""}

                    ${this._can(j.EDIT_EXTERNAL_DEVELOPMENT)?`
                      <div class="p360-card-actions">
                        <button
                          type="button"
                          class="p360-secondary-link p360-edit-external"
                          data-session-id="${t(a.id)}"
                        >
                          ✏️ Editar tecnificación
                        </button>
                      </div>
                    `:""}
                  </article>
                `}).join(""):`
              <div class="p360-empty-state">
                <strong>Aún no hay desarrollo externo registrado.</strong>
                <span>Cuando un jugador realice tecnificación u otro trabajo complementario podrás registrarlo aquí.</span>
              </div>
            `}
        </div>
      </section>
    `}_renderStyles(){return`
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
          grid-template-columns: minmax(150px,1.5fr) 1fr .6fr .6fr 1.3fr auto auto auto;
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
        .p360-card-actions {
          border-top: 1px solid #f1f5f9;
          padding-top: 8px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }
        .p360-secondary-link {
          border: 0;
          padding: 6px 0;
          background: transparent;
          color: #1d4ed8;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .p360-inline-editor {
          border: 1px solid #bfdbfe;
          border-radius: 12px;
          padding: 12px;
          background: #f8fbff;
        }
        .p360-edit-block-list { display: grid; gap: 8px; }
        .p360-edit-block-row {
          display: grid;
          grid-template-columns: minmax(150px,1.2fr) minmax(120px,.8fr) 90px 90px minmax(150px,1.2fr) auto;
          gap: 8px;
          align-items: end;
          border: 1px solid #dbeafe;
          border-radius: 10px;
          padding: 10px;
          background: #fff;
        }
        .p360-edit-block-row label { display: grid; gap: 5px; font-size: 11px; font-weight: 800; color: #475569; }
        .p360-edit-block-row input {
          width: 100%;
          min-height: 40px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 9px;
          color: #0f172a;
          background: #fff;
        }
        .p360-edit-block-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
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
          .p360-attendance-player, .p360-att-notes, .p360-save-attendance, .p360-remove-participant, .p360-load-value {
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
          .p360-edit-block-row { grid-template-columns: 1fr; }
          .p360-edit-block-actions { display: grid; grid-template-columns: 1fr; }
          .p360-edit-block-actions .p360-secondary-btn,
          .p360-edit-block-actions .p360-danger-link { width: 100%; }
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
    `}_applyTab(e){const i=e.querySelector("#p360-panel-training"),a=e.querySelector("#p360-panel-external"),n=e.querySelector('[data-p360-tab="training"]'),l=e.querySelector('[data-p360-tab="external"]'),d=this.activeTab==="external";i&&(i.hidden=d),a&&(a.hidden=!d),n&&n.setAttribute("aria-selected",String(!d)),l&&l.setAttribute("aria-selected",String(d))}_refreshTrainingPlayerOptions(e,i){const a=e.querySelector("#p360-training-player-options");a&&(a.innerHTML=this._renderParticipantChecklist(i),this._bindParticipantSelectionTools(e))}_bindParticipantSelectionTools(e){var i,a;(i=e.querySelector("#p360-select-all-players"))==null||i.addEventListener("click",()=>{e.querySelectorAll('input[name="p360-training-player"]').forEach(n=>{n.checked=!0})}),(a=e.querySelector("#p360-clear-all-players"))==null||a.addEventListener("click",()=>{e.querySelectorAll('input[name="p360-training-player"]').forEach(n=>{n.checked=!1})})}_collectBlocks(e){return[...e.querySelectorAll(".p360-block-row")].map((i,a)=>{var T,$,O,M,B;const n=((T=i.querySelector(".p360-block-title"))==null?void 0:T.value.trim())||"",l=(($=i.querySelector(".p360-block-code"))==null?void 0:$.value.trim())||"",d=w((O=i.querySelector(".p360-block-duration"))==null?void 0:O.value),o=w((M=i.querySelector(".p360-block-intensity"))==null?void 0:M.value),u=((B=i.querySelector(".p360-block-objective-input"))==null?void 0:B.value.trim())||"";return!n&&!l&&d===null&&o===null&&!u?null:{block_order:a+1,title:n||l||`Bloque ${a+1}`,activity_code:l||null,duration_minutes:d,intensity:o,objective:u||null}}).filter(Boolean)}async _bindEvents(e){var O,M,B,z,H;e.querySelectorAll("[data-p360-tab]").forEach(r=>{r.addEventListener("click",()=>{this.activeTab=r.dataset.p360Tab==="external"?"external":"training",this._applyTab(e)})}),this._bindParticipantSelectionTools(e);const i=e.querySelector("#p360-training-date");i==null||i.addEventListener("change",()=>{this._refreshTrainingPlayerOptions(e,i.value)});const a=e.querySelector("#p360-training-start-time"),n=e.querySelector("#p360-training-end-time"),l=e.querySelector("#p360-training-duration"),d=()=>{if(!l)return null;const r=X(a==null?void 0:a.value,n==null?void 0:n.value);return l.value=r===null?"":String(r),r};a==null||a.addEventListener("input",d),n==null||n.addEventListener("input",d);let o=e.querySelectorAll(".p360-block-row").length;(O=e.querySelector("#p360-cancel-training"))==null||O.addEventListener("click",()=>{var b;const r=e.querySelector("#p360-create-training-panel"),s=e.querySelector("#p360-training-form");if(!s)return;s.reset();const c=e.querySelector("#p360-blocks-container");c&&(c.innerHTML=this._renderBlockRow(1)),o=1;const y=((b=s.querySelector("#p360-training-date"))==null?void 0:b.value)||this._defaultDate();this._refreshTrainingPlayerOptions(e,y),r&&(r.open=!1)}),(M=e.querySelector("#p360-add-block"))==null||M.addEventListener("click",()=>{o+=1;const r=e.querySelector("#p360-blocks-container");r&&r.insertAdjacentHTML("beforeend",this._renderBlockRow(o))}),this._delegatedClickContainer&&this._delegatedClickHandler&&this._delegatedClickContainer.removeEventListener("click",this._delegatedClickHandler),this._delegatedClickHandler=async r=>{var N,D,R,E,V,K,U,Q,W,J,Y,Z,ee;const s=r.target.closest(".p360-remove-block");if(s){const p=e.querySelectorAll(".p360-block-row");p.length<=1?(N=p[0])==null||N.querySelectorAll("input").forEach(h=>{h.value=""}):(D=s.closest(".p360-block-row"))==null||D.remove();return}const c=r.target.closest(".p360-edit-session");if(c){this.editingTrainingId=c.dataset.sessionId||null,this.editingExternalId=null,await this.render(this.containerId,this.teamId);return}if(r.target.closest(".p360-cancel-training-edit")){this.editingTrainingId=null,await this.render(this.containerId,this.teamId);return}const b=r.target.closest(".p360-edit-external");if(b){this.editingExternalId=b.dataset.sessionId||null,this.editingTrainingId=null,this.activeTab="external",await this.render(this.containerId,this.teamId);return}if(r.target.closest(".p360-cancel-external-edit")){this.editingExternalId=null,this.activeTab="external",await this.render(this.containerId,this.teamId);return}const A=r.target.closest(".p360-add-edit-block");if(A){const p=(R=A.closest(".p360-training-edit-form"))==null?void 0:R.querySelector(".p360-edit-block-list");if(!p)return;const h=p.querySelectorAll(".p360-edit-block-row").length+1;p.insertAdjacentHTML("beforeend",this._renderEditableBlockRow({},h));return}const v=r.target.closest(".p360-save-edit-block");if(v){const p=v.closest(".p360-edit-block-row"),h=v.closest(".p360-training-edit-form");if(!p||!h)return;const g=(E=p.querySelector(".p360-edit-block-title"))==null?void 0:E.value.trim();if(!g){alert("⚠️ Indica un nombre para el bloque.");return}v.disabled=!0;try{await this.service.saveBlock({trainingSessionId:h.dataset.sessionId,blockId:p.dataset.blockId||null,blockOrder:Number(p.dataset.blockOrder)||1,title:g,activityCode:((V=p.querySelector(".p360-edit-block-code"))==null?void 0:V.value.trim())||null,objective:((K=p.querySelector(".p360-edit-block-objective-input"))==null?void 0:K.value.trim())||null,durationMinutes:w((U=p.querySelector(".p360-edit-block-duration"))==null?void 0:U.value),intensity:w((Q=p.querySelector(".p360-edit-block-intensity"))==null?void 0:Q.value)}),this.editingTrainingId=h.dataset.sessionId,await this.render(this.containerId,this.teamId)}catch(L){console.error("[TrainingView] Error guardando bloque:",L),alert(`❌ ${L.message||L}`),v.disabled=!1}return}const x=r.target.closest(".p360-delete-edit-block");if(x){const p=x.closest(".p360-edit-block-row"),h=x.closest(".p360-training-edit-form");if(!p||!h)return;const g=p.dataset.blockId||null;if(!g){p.remove();return}if(!confirm("¿Eliminar este bloque del entrenamiento?"))return;x.disabled=!0;try{await this.service.deleteBlock({trainingSessionId:h.dataset.sessionId,blockId:g}),this.editingTrainingId=h.dataset.sessionId,await this.render(this.containerId,this.teamId)}catch(L){console.error("[TrainingView] Error eliminando bloque:",L),alert(`❌ ${L.message||L}`),x.disabled=!1}return}const S=r.target.closest(".p360-remove-participant");if(S){if(!confirm("¿Quitar a este jugador de la sesión? Úsalo solo para corregir una inclusión errónea."))return;S.disabled=!0;try{await this.service.removeParticipant({trainingSessionId:S.dataset.sessionId,teamSeasonId:this.teamSeasonId,playerId:S.dataset.playerId}),await this.render(this.containerId,this.teamId)}catch(p){console.error("[TrainingView] Error quitando participante:",p),alert(`❌ ${p.message||p}`),S.disabled=!1}return}const _=r.target.closest(".p360-save-attendance");if(_){const p=_.closest(".p360-attendance-row");if(!p)return;_.disabled=!0;try{await this.service.setParticipant({trainingSessionId:_.dataset.sessionId,playerId:_.dataset.playerId,attendanceStatus:((W=p.querySelector(".p360-att-status"))==null?void 0:W.value)||"PLANNED",participatedMinutes:w((J=p.querySelector(".p360-att-minutes"))==null?void 0:J.value),rpe:w((Y=p.querySelector(".p360-att-rpe"))==null?void 0:Y.value),notes:((Z=p.querySelector(".p360-att-notes"))==null?void 0:Z.value.trim())||null}),await this.render(this.containerId,this.teamId)}catch(h){console.error("[TrainingView] Error guardando asistencia:",h),alert(`❌ ${h.message||h}`),_.disabled=!1}return}const I=r.target.closest(".p360-confirm-planned");if(I){const p=this.sessions.find(g=>String(g.id)===String(I.dataset.sessionId)),h=((p==null?void 0:p.participants)||[]).filter(g=>String(g.attendance_status||"").toUpperCase()==="PLANNED");if(!p||!h.length)return;I.disabled=!0;try{const g=this._sessionDuration(p);for(const L of h)await this.service.setParticipant({trainingSessionId:p.id,playerId:L.player_id,attendanceStatus:"PRESENT",participatedMinutes:g,rpe:w(L.rpe),notes:L.notes||null});await this.render(this.containerId,this.teamId)}catch(g){console.error("[TrainingView] Error confirmando asistencia planificada:",g),alert(`❌ ${g.message||g}`),I.disabled=!1}return}const f=r.target.closest(".p360-add-participant");if(f){const p=f.closest(".p360-add-participant-row"),h=(ee=p==null?void 0:p.querySelector(".p360-new-participant-player"))==null?void 0:ee.value;if(!h)return;f.disabled=!0;try{const g=this.sessions.find(ie=>String(ie.id)===String(f.dataset.sessionId)),L=String((g==null?void 0:g.session_date)||"")<=G();await this.service.setParticipant({trainingSessionId:f.dataset.sessionId,playerId:h,attendanceStatus:L?"PRESENT":"PLANNED",participatedMinutes:L?this._sessionDuration(g):null}),await this.render(this.containerId,this.teamId)}catch(g){console.error("[TrainingView] Error añadiendo participante:",g),alert(`❌ ${g.message||g}`),f.disabled=!1}return}const k=r.target.closest(".p360-archive-session");if(k){if(!confirm("¿Archivar esta sesión? Se conservarán sus datos históricos."))return;k.disabled=!0;try{await this.service.archiveSession(k.dataset.sessionId),await this.render(this.containerId,this.teamId)}catch(p){console.error("[TrainingView] Error archivando sesión:",p),alert(`❌ ${p.message||p}`),k.disabled=!1}}},e.addEventListener("click",this._delegatedClickHandler),this._delegatedClickContainer=e;const u=e.querySelector(".p360-training-edit-form");if(u){const r=u.querySelector(".p360-edit-training-start"),s=u.querySelector(".p360-edit-training-end"),c=u.querySelector(".p360-edit-training-duration"),y=()=>{const b=X(r==null?void 0:r.value,s==null?void 0:s.value);return c&&(c.value=b===null?"":String(b)),b};r==null||r.addEventListener("input",y),s==null||s.addEventListener("input",y),u.addEventListener("submit",async b=>{var _,I,f,k;b.preventDefault();const q=b.currentTarget,A=q.querySelector('button[type="submit"]'),v=(_=q.querySelector(".p360-edit-training-date"))==null?void 0:_.value,x=(I=q.querySelector(".p360-edit-training-title"))==null?void 0:I.value.trim(),S=y();if(!v||!x||S===null){alert("⚠️ Indica fecha, nombre y un horario válido.");return}A.disabled=!0;try{await this.service.updateSession({trainingSessionId:q.dataset.sessionId,teamSeasonId:this.teamSeasonId,sessionDate:v,title:x,objective:((f=q.querySelector(".p360-edit-training-objective"))==null?void 0:f.value.trim())||null,durationMinutes:S,intensity:w((k=q.querySelector(".p360-edit-training-intensity"))==null?void 0:k.value),startTime:(r==null?void 0:r.value)||null,endTime:(s==null?void 0:s.value)||null}),this.editingTrainingId=null,await this.render(this.containerId,this.teamId)}catch(N){console.error("[TrainingView] Error corrigiendo entrenamiento:",N),alert(`❌ ${N.message||N}`),A.disabled=!1}})}const T=e.querySelector(".p360-external-edit-form");if(T){const r=T.querySelector(".p360-edit-external-date");r==null||r.addEventListener("change",()=>{const s=T.querySelector(".p360-edit-external-player");if(s){const c=s.value;s.innerHTML=this._renderExternalPlayerOptions(r.value,c)}}),T.addEventListener("submit",async s=>{var v,x,S,_,I,f,k,N,D,R,E;s.preventDefault();const c=s.currentTarget,y=c.querySelector('button[type="submit"]'),b=(v=c.querySelector(".p360-edit-external-date"))==null?void 0:v.value,q=(x=c.querySelector(".p360-edit-external-player"))==null?void 0:x.value,A=(S=c.querySelector(".p360-edit-external-title"))==null?void 0:S.value.trim();if(!b||!q||!A){alert("⚠️ Indica fecha, jugador y actividad.");return}y.disabled=!0;try{await this.service.updateExternalDevelopment({externalSessionId:c.dataset.sessionId,teamSeasonId:this.teamSeasonId,playerId:q,activityDate:b,title:A,activityCode:((_=c.querySelector(".p360-edit-external-code"))==null?void 0:_.value.trim())||null,providerType:((I=c.querySelector(".p360-edit-external-provider-type"))==null?void 0:I.value)||null,providerName:((f=c.querySelector(".p360-edit-external-provider"))==null?void 0:f.value.trim())||null,objective:((k=c.querySelector(".p360-edit-external-objective"))==null?void 0:k.value.trim())||null,durationMinutes:w((N=c.querySelector(".p360-edit-external-duration"))==null?void 0:N.value),intensity:w((D=c.querySelector(".p360-edit-external-intensity"))==null?void 0:D.value),rpe:w((R=c.querySelector(".p360-edit-external-rpe"))==null?void 0:R.value),notes:((E=c.querySelector(".p360-edit-external-notes"))==null?void 0:E.value.trim())||null}),this.editingExternalId=null,this.activeTab="external",await this.render(this.containerId,this.teamId)}catch(V){console.error("[TrainingView] Error corrigiendo tecnificación:",V),alert(`❌ ${V.message||V}`),y.disabled=!1}})}(B=e.querySelector("#p360-training-form"))==null||B.addEventListener("submit",async r=>{var I,f,k,N,D,R;r.preventDefault();const s=r.currentTarget,c=s.querySelector('button[type="submit"]'),y=(I=s.querySelector("#p360-training-date"))==null?void 0:I.value,b=(f=s.querySelector("#p360-training-title"))==null?void 0:f.value.trim();if(!y||!b){alert("⚠️ Indica fecha y nombre de la sesión.");return}const q=[...s.querySelectorAll('input[name="p360-training-player"]:checked')].map(E=>E.value).filter(Boolean),A=((k=s.querySelector("#p360-training-start-time"))==null?void 0:k.value)||"",v=((N=s.querySelector("#p360-training-end-time"))==null?void 0:N.value)||"",x=X(A,v);if(x===null){alert("⚠️ Indica una hora de inicio y fin válidas. La hora de fin debe ser posterior al inicio.");return}const S=String(y)<=G(),_=q.map(E=>({player_id:E,attendance_status:S?"PRESENT":"PLANNED",participated_minutes:S?x:null}));c.disabled=!0;try{await this.service.createSession({teamSeasonId:this.teamSeasonId,sessionDate:y,title:b,objective:((D=s.querySelector("#p360-training-objective"))==null?void 0:D.value.trim())||null,durationMinutes:x,intensity:w((R=s.querySelector("#p360-training-intensity"))==null?void 0:R.value),startTime:A,endTime:v,blocks:this._collectBlocks(s),participants:_}),await this.render(this.containerId,this.teamId)}catch(E){console.error("[TrainingView] Error creando entrenamiento:",E),alert(`❌ ${E.message||E}`),c.disabled=!1}});const $=e.querySelector("#p360-external-date");$==null||$.addEventListener("change",()=>{const r=e.querySelector("#p360-external-player");r&&(r.innerHTML=this._renderExternalPlayerOptions($.value))}),(z=e.querySelector("#p360-cancel-external"))==null||z.addEventListener("click",()=>{var b;const r=e.querySelector("#p360-create-external-panel"),s=e.querySelector("#p360-external-form");if(!s)return;s.reset();const c=((b=s.querySelector("#p360-external-date"))==null?void 0:b.value)||this._defaultDate(),y=s.querySelector("#p360-external-player");y&&(y.innerHTML=this._renderExternalPlayerOptions(c)),r&&(r.open=!1)}),(H=e.querySelector("#p360-external-form"))==null||H.addEventListener("submit",async r=>{var A,v,x,S,_,I,f,k,N,D,R;r.preventDefault();const s=r.currentTarget,c=s.querySelector('button[type="submit"]'),y=(A=s.querySelector("#p360-external-date"))==null?void 0:A.value,b=(v=s.querySelector("#p360-external-player"))==null?void 0:v.value,q=(x=s.querySelector("#p360-external-title"))==null?void 0:x.value.trim();if(!y||!b||!q){alert("⚠️ Indica fecha, jugador y actividad.");return}c.disabled=!0;try{await this.service.createExternalDevelopment({teamSeasonId:this.teamSeasonId,playerId:b,activityDate:y,title:q,activityCode:((S=s.querySelector("#p360-external-code"))==null?void 0:S.value.trim())||null,providerType:((_=s.querySelector("#p360-external-provider-type"))==null?void 0:_.value)||null,providerName:((I=s.querySelector("#p360-external-provider"))==null?void 0:I.value.trim())||null,objective:((f=s.querySelector("#p360-external-objective"))==null?void 0:f.value.trim())||null,durationMinutes:w((k=s.querySelector("#p360-external-duration"))==null?void 0:k.value),intensity:w((N=s.querySelector("#p360-external-intensity"))==null?void 0:N.value),rpe:w((D=s.querySelector("#p360-external-rpe"))==null?void 0:D.value),sourceType:oe.EXTERNAL_COACH,notes:((R=s.querySelector("#p360-external-notes"))==null?void 0:R.value.trim())||null,provenance:{entered_from:"IQBASKET_PLAYER360_UI"}}),this.activeTab="external",await this.render(this.containerId,this.teamId)}catch(E){console.error("[TrainingView] Error creando desarrollo externo:",E),alert(`❌ ${E.message||E}`),c.disabled=!1}})}async render(e="dashboard-content-area",i=null){var d,o,u,T,$,O,M,B,z,H,r;this.containerId=e,this.teamId=i||((o=(d=C).getActiveTeamId)==null?void 0:o.call(d))||null,this.teamSeasonId=((T=(u=C).getActiveTeamSeasonId)==null?void 0:T.call(u,this.teamId))||null;const a=document.getElementById(e);if(!a)return;if(!this.teamSeasonId){a.innerHTML=`
        <section class="p360-training-view">
          <div class="p360-error">
            No se ha podido resolver un equipo-temporada activo. Selecciona una temporada antes de abrir Player 360 Training.
          </div>
        </section>
      `;return}if(!this._can(j.VIEW_TRAINING)){a.innerHTML=`
        <section class="p360-training-view">
          <div class="p360-error">Tu perfil no tiene permiso para consultar entrenamientos de este equipo-temporada.</div>
        </section>
      `;return}await this._load();const n=((O=($=C).getActiveSeasonDisplayName)==null?void 0:O.call($,this.teamId))||((M=this._seasonContext())==null?void 0:M.name)||"Temporada activa",l=((H=(z=(B=C).getTeamById)==null?void 0:z.call(B,this.teamId))==null?void 0:H.name)||"Equipo";a.innerHTML=`
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
            ${t(l)} · ${t(n)}
          </span>
        </header>

        ${this.lastError?`
          <div class="p360-error">
            No se ha podido cargar Player 360 Training: ${t(this.lastError.message||this.lastError)}
          </div>
        `:""}

        ${(r=this.capabilities)!=null&&r.training_core?"":`
          <div class="p360-readonly">
            El backend Training Core no está disponible en este entorno. No se permiten escrituras.
          </div>
        `}

        <div class="p360-tabs" role="tablist" aria-label="Player 360 Training">
          <button
            type="button"
            class="p360-tab"
            data-p360-tab="training"
            role="tab"
            aria-selected="${this.activeTab!=="external"}"
          >
            🏀 Entrenamientos
          </button>

          ${this._can(j.VIEW_EXTERNAL_DEVELOPMENT)?`
            <button
              type="button"
              class="p360-tab"
              data-p360-tab="external"
              role="tab"
              aria-selected="${this.activeTab==="external"}"
            >
              ⚡ Desarrollo externo
            </button>
          `:""}
        </div>

        ${this._renderTrainingPanel()}
        ${this._can(j.VIEW_EXTERNAL_DEVELOPMENT)?this._renderExternalPanel():""}
      </section>
    `,this._applyTab(a),await this._bindEvents(a)}}export{ue as TrainingView};
