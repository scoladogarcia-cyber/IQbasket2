import{T as E,I as R,P as D,D as x,B as I}from"./index-Co3VTdK8.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";class L{constructor(n=null,t=null){this.auth=n,this.gameId=t,this.currentStep=1,this.config={gameType:"Oficial",format:"4x10",periodSeconds:600,overtimeSeconds:300,season:"2026",date:new Date().toISOString().split("T")[0],opponent:"",venue:"Local"},this.roster=[],this.onCourtPlayerIds=[],this.currentPeriod="Q1",this.periodsList=["Q1","Q2","Q3","Q4"],this.teamScore=0,this.opponentScore=0,this.playByPlayEvents=[],this.undoneEventsStack=[],this.timeRemaining=600,this.pendingSubOnCourt=[],this.subEvents=[],this.activeModal=null,this.pendingAction=null}t(n,t=""){return(E?E.t(n,t):R.t(n,t))||t}_getActionLabelSpanish(n){return{fg2_made:"Canasta de 2 Puntos (+2)",fg2_attempted:"Tiro de 2 Fallado",fg3_made:"Triple Convertido (+3)",fg3_attempted:"Triple Fallado",ft_made:"Tiro Libre Anotado (+1)",ft_attempted:"Tiro Libre Fallado",off_reb:"Rebote Ofensivo",def_reb:"Rebote Defensivo",assists:"Asistencia",steals:"Robo de Balón",blocks_made:"Tapón a Favor",blocks_received:"Tapón Recibido",turnovers:"Pérdida de Balón",fouls_committed:"Falta Personal Cometida",fouls_drawn:"Falta Personal Recibida",opp_pts:"Puntos Rival",opp_tov:"Pérdida de Balón Rival",opp_oreb:"Rebote Ofensivo Rival",opp_dreb:"Rebote Defensivo Rival"}[n]||String(n).replace(/_/g," ").toUpperCase()}_getPeriodDuration(n){return n.startsWith("OT")?this.config.overtimeSeconds:this.config.periodSeconds}async render(n="dashboard-content-area"){var r,c,e,a,d,f;const t=document.getElementById(n)||document.getElementById("main-content")||document.querySelector(".app-main-content")||document.body;if(!t)return;if(this.container=t,!((c=(r=this.auth)==null?void 0:r.canPreview)!=null&&c.call(r,D.RECORD_LIVE_GAME))){t.innerHTML=`
        <div style="padding:24px;background:white;border:1px solid #fecaca;border-radius:12px;color:#991b1b;">
          <h3 style="margin-top:0;">🔒 Acceso restringido</h3>
          <p style="margin-bottom:0;">Tu perfil no tiene permiso para registrar estadísticas en vivo.</p>
        </div>`;return}const l=x.getActiveTeamId?x.getActiveTeamId():null,i=x.getPlayersEligibleOnDate?x.getPlayersEligibleOnDate(l,new Date().toISOString().slice(0,10))||[]:((a=(e=x).getPlayers)==null?void 0:a.call(e,l))||((f=(d=x).getPlayers)==null?void 0:f.call(d))||[];this.roster.length===0&&i.length>0&&(this.roster=i.map((h,g)=>({id:String(h.id),name:`${h.first_name||h.firstName||""} ${h.last_name||h.lastName||""}`.trim()||h.name||"Jugador",jersey:String(h.jersey??h.number??g+4),isConvoked:!0,isStarter:g<5})),this._syncOnCourtFromStarters()),this.currentStep===1?this._renderPreGameConfig():this.currentStep===2?this._renderHUD():this.currentStep===4&&this._renderPostGameActa()}_syncOnCourtFromStarters(){if(this.onCourtPlayerIds=this.roster.filter(n=>n.isConvoked&&n.isStarter).map(n=>n.id).slice(0,5),this.onCourtPlayerIds.length<5){const n=this.roster.filter(t=>t.isConvoked).map(t=>t.id);this.onCourtPlayerIds=n.slice(0,5)}}_renderPreGameConfig(){this._closeModalLayer();const n=this.roster.filter(i=>i.isConvoked).length,t=this.roster.filter(i=>i.isConvoked&&i.isStarter).length,l=this.roster.map(i=>`
      <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
        <td style="padding: 10px; text-align: center;">
          <input type="checkbox" class="chk-convoke" data-id="${i.id}" ${i.isConvoked?"checked":""} style="width: 18px; height: 18px; cursor: pointer;" />
        </td>
        <td style="padding: 10px; text-align: center;">
          <button type="button" class="btn-star-starter ${i.isStarter?"is-starter":""}" data-id="${i.id}" style="background: none; border: none; font-size: 20px; cursor: pointer; color: ${i.isStarter?"#f97316":"#cbd5e1"};">
            ${i.isStarter?"★":"☆"}
          </button>
        </td>
        <td style="padding: 10px; text-align: center;">
          <input type="text" class="input-jersey" data-id="${i.id}" value="${i.jersey}" style="width: 48px; height: 32px; text-align: center; font-weight: 800; border: 1px solid #cbd5e1; border-radius: 6px; color: #0f172a; background: #ffffff;" />
        </td>
        <td style="padding: 10px 14px; font-weight: 700; color: #0f172a;">
          ${i.name}
        </td>
      </tr>
    `).join("");this.container.innerHTML=`
      <div style="max-width: 1000px; margin: 0 auto; font-family: system-ui, sans-serif; padding-bottom: 90px; box-sizing: border-box;">
        <div style="margin-bottom: 20px;">
          <h1 style="font-size: 24px; font-weight: 900; color: #0f172a; margin: 0;">🏀 Configuración Pre-Partido & Convocatoria</h1>
          <span style="font-size: 13px; color: #64748b;">Ajusta los datos del encuentro y define el quinteto inicial.</span>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px;">
            <div>
              <label class="hud-label">TIPO DE PARTIDO</label>
              <select id="cfg-game-type" class="hud-select">
                <option value="Oficial" ${this.config.gameType==="Oficial"?"selected":""}>Oficial</option>
                <option value="Amistoso" ${this.config.gameType==="Amistoso"?"selected":""}>Amistoso</option>
                <option value="Torneo" ${this.config.gameType==="Torneo"?"selected":""}>Torneo</option>
              </select>
            </div>

            <div>
              <label class="hud-label">FORMATO DE TIEMPO</label>
              <select id="cfg-format" class="hud-select">
                <option value="4x10" ${this.config.format==="4x10"?"selected":""}>4 x 10 min (FIBA)</option>
                <option value="4x12" ${this.config.format==="4x12"?"selected":""}>4 x 12 min (NBA)</option>
                <option value="4x8" ${this.config.format==="4x8"?"selected":""}>4 x 8 min (Cadete/Inf.)</option>
                <option value="minibasket" ${this.config.format==="minibasket"?"selected":""}>Minibasket (6 x 8 min)</option>
              </select>
            </div>

            <div>
              <label class="hud-label">FECHA</label>
              <input type="date" id="cfg-date" value="${this.config.date}" class="hud-input" />
            </div>

            <div>
              <label class="hud-label">RIVAL *</label>
              <input type="text" id="cfg-opponent" placeholder="Ej: CB Sant Gabriel" value="${this.config.opponent}" class="hud-input" />
            </div>

            <div>
              <label class="hud-label">CONDICIÓN</label>
              <select id="cfg-venue" class="hud-select">
                <option value="Local" ${this.config.venue==="Local"?"selected":""}>Local</option>
                <option value="Visitante" ${this.config.venue==="Visitante"?"selected":""}>Visitante</option>
              </select>
            </div>
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
            <h3 style="margin: 0; font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase;">
              📋 PLANTILLA Y CONVOCATORIA (${n} convocados · ${t}/5 titulares)
            </h3>
            <span style="font-size: 11px; font-weight: 800; color: ${t===5?"#16a34a":"#dc2626"};">
              ${t===5?"✔ Quinteto Inicial Completo":"⚠️ Debes seleccionar exactamente 5 titulares (★)"}
            </span>
          </div>

          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                <th style="padding: 10px; text-align: center; width: 60px;">CONV.</th>
                <th style="padding: 10px; text-align: center; width: 60px;">TITULAR</th>
                <th style="padding: 10px; text-align: center; width: 80px;">DORSAL</th>
                <th style="padding: 10px 14px;">JUGADOR</th>
              </tr>
            </thead>
            <tbody>${l}</tbody>
          </table>
        </div>

        <!-- BOTÓN DE INICIO VISIBLE EN MÓVIL Y DESKTOP SIN TAPARSE -->
        <div style="display: flex; justify-content: center; width: 100%; margin-top: 10px; margin-bottom: 40px;">
          <button type="button" id="btn-start-scoring" style="background: #f97316; color: #ffffff; border: none; padding: 14px 28px; border-radius: 10px; font-size: 15px; font-weight: 900; cursor: pointer; min-height: 52px; width: 100%; max-width: 480px; box-shadow: 0 4px 14px rgba(249,115,22,0.4); text-align: center;">
            ⚡ COMENZAR ANOTACIÓN
          </button>
        </div>

      </div>
    `,this._bindPreGameEvents()}_bindPreGameEvents(){var n;this.container.querySelectorAll(".chk-convoke").forEach(t=>{t.addEventListener("change",()=>{const l=this.roster.find(i=>i.id===t.getAttribute("data-id"));l&&(l.isConvoked=t.checked,t.checked||(l.isStarter=!1),this._renderPreGameConfig())})}),this.container.querySelectorAll(".btn-star-starter").forEach(t=>{t.addEventListener("click",()=>{const l=this.roster.find(r=>r.id===t.getAttribute("data-id"));if(!l||!l.isConvoked)return;const i=this.roster.filter(r=>r.isConvoked&&r.isStarter).length;if(!l.isStarter&&i>=5){alert("Ya has seleccionado los 5 titulares. Desmarca una estrella primero.");return}l.isStarter=!l.isStarter,this._renderPreGameConfig()})}),this.container.querySelectorAll(".input-jersey").forEach(t=>{t.addEventListener("change",()=>{const l=this.roster.find(i=>i.id===t.getAttribute("data-id"));l&&(l.jersey=t.value)})}),(n=this.container.querySelector("#btn-start-scoring"))==null||n.addEventListener("click",()=>{var i,r,c,e,a;const t=(i=this.container.querySelector("#cfg-opponent"))==null?void 0:i.value.trim();if(!t)return alert("Introduce el nombre del equipo rival.");const l=this.roster.filter(d=>d.isConvoked&&d.isStarter);if(l.length!==5)return alert(`Debes seleccionar exactamente 5 titulares con la estrella (seleccionados: ${l.length}/5).`);this.config.opponent=t,this.config.gameType=((r=this.container.querySelector("#cfg-game-type"))==null?void 0:r.value)||"Oficial",this.config.format=((c=this.container.querySelector("#cfg-format"))==null?void 0:c.value)||"4x10",this.config.date=((e=this.container.querySelector("#cfg-date"))==null?void 0:e.value)||this.config.date,this.config.venue=((a=this.container.querySelector("#cfg-venue"))==null?void 0:a.value)||"Local",this.config.format==="4x12"?this.config.periodSeconds=720:this.config.format==="4x8"||this.config.format==="minibasket"?this.config.periodSeconds=480:this.config.periodSeconds=600,this.config.format==="minibasket"&&(this.periodsList=["P1","P2","P3","P4","P5","P6"],this.currentPeriod="P1"),this.timeRemaining=this.config.periodSeconds,this._syncOnCourtFromStarters(),this.subEvents=[{id:`sub-init-${Date.now()}`,type:"SUBSTITUTION",period:this.currentPeriod,timeRemaining:this.timeRemaining,playersIn:[...this.onCourtPlayerIds],playersOut:[],onCourt:[...this.onCourtPlayerIds]}],this.currentStep=2,this.render()})}_renderHUD(){const n=this.roster.filter(a=>this.onCourtPlayerIds.includes(a.id)),t=this.config.venue==="Local",l=t?"JMJ Manyanet":this.config.opponent||"Rival",i=t?this.config.opponent||"Rival":"JMJ Manyanet",r=Math.floor(this.timeRemaining/60),c=this.timeRemaining%60,e=`${String(r).padStart(2,"0")}:${String(c).padStart(2,"0")}`;this.container.innerHTML=`
      <div style="max-width: 1400px; margin: 0 auto; font-family: system-ui, sans-serif; padding-bottom: 40px; box-sizing: border-box;">
        <header style="background: #0f172a; color: #ffffff; border-radius: 12px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 13px; font-weight: 800; color: #38bdf8;">${l.toUpperCase()}</span>
            <div style="background: #1e293b; padding: 6px 18px; border-radius: 8px; font-size: 26px; font-weight: 900; border: 1px solid #334155;">
              <span style="color: #38bdf8;">${this.teamScore}</span>
              <span style="color: #64748b; margin: 0 4px;">-</span>
              <span style="color: #f97316;">${this.opponentScore}</span>
            </div>
            <span style="font-size: 13px; font-weight: 800; color: #f97316;">${i.toUpperCase()}</span>
          </div>

          <div style="display: flex; align-items: center; gap: 6px; background: #1e293b; padding: 4px; border-radius: 8px;">
            ${this.periodsList.map(a=>{const d=a.startsWith("OT");return`
                <div style="display: inline-flex; align-items: center; background: ${this.currentPeriod===a?"#f97316":"transparent"}; border-radius: 6px; padding-right: ${d?"4px":"0"};">
                  <button type="button" class="btn-period-hud" data-period="${a}" style="background: transparent; color: #ffffff; border: none; padding: 6px ${d?"6px":"10px"}; font-weight: 800; font-size: 12px; cursor: pointer;">
                    ${a}
                  </button>
                  ${d?`
                    <button type="button" class="btn-remove-ot" data-period="${a}" style="background: rgba(0,0,0,0.3); color: #fca5a5; border: none; border-radius: 50%; width: 16px; height: 16px; font-size: 10px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Eliminar ${a}">✕</button>
                  `:""}
                </div>
              `}).join("")}
            <button type="button" id="btn-add-ot" style="background: #334155; color: #38bdf8; border: none; padding: 6px 10px; border-radius: 6px; font-weight: 900; font-size: 12px; cursor: pointer;">
              +PR
            </button>
          </div>

          <div style="display: flex; gap: 6px;">
            <button type="button" id="btn-hud-undo" style="background: #334155; color: #ffffff; border: none; padding: 8px 12px; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer;">
              ↩ Deshacer
            </button>
            <button type="button" id="btn-hud-redo" style="background: #334155; color: #ffffff; border: none; padding: 8px 12px; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer;">
              ↪ Rehacer
            </button>
            <button type="button" id="btn-hud-subs" style="background: #0284c7; color: #ffffff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer;">
              🔄 Cambios (${e})
            </button>
            <button type="button" id="btn-hud-pbp" style="background: #1e3a8a; color: #ffffff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer;">
              📋 Jugadas (${this.playByPlayEvents.length})
            </button>
          </div>
        </header>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">5 EN PISTA:</span>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${n.map(a=>`
              <div style="background: #eff6ff; border: 1.5px solid #3b82f6; border-radius: 8px; padding: 6px 14px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px; font-weight: 900; color: #1e40af;">#${a.jersey}</span>
                <span style="font-size: 12px; font-weight: 700; color: #0f172a;">${a.name}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px;">
          <div class="hud-action-card">
            <span class="hud-card-title" style="color: #16a34a;">🎯 TIROS DE CAMPO Y LIBRES</span>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <button type="button" class="btn-action-shot" data-action="T2" data-made="true" style="background: #22c55e;">+2 Tiro 2 (In)</button>
              <button type="button" class="btn-action-shot" data-action="T2" data-made="false" style="background: #ef4444;">Tiro 2 Fallo (Out)</button>
              <button type="button" class="btn-action-shot" data-action="T3" data-made="true" style="background: #16a34a;">+3 Triple (In)</button>
              <button type="button" class="btn-action-shot" data-action="T3" data-made="false" style="background: #dc2626;">Triple Fallo (Out)</button>
              <button type="button" class="btn-action-direct" data-action="ft_made" data-pts="1" style="background: #84cc16;">+1 TL Anotado</button>
              <button type="button" class="btn-action-direct" data-action="ft_attempted" data-pts="0" style="background: #f87171;">Fallo TL</button>
            </div>
          </div>

          <div class="hud-action-card">
            <span class="hud-card-title" style="color: #0284c7;">🏀 REBOTES Y CIRCULACIÓN</span>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <button type="button" class="btn-action-direct" data-action="off_reb" data-pts="0" style="background: #0284c7;">Rebote Ofensivo</button>
              <button type="button" class="btn-action-direct" data-action="def_reb" data-pts="0" style="background: #38bdf8; color: #0f172a;">Rebote Defensivo</button>
              <button type="button" class="btn-action-direct" data-action="assists" data-pts="0" style="background: #6366f1;">Asistencia (AST)</button>
              <button type="button" class="btn-action-direct" data-action="steals" data-pts="0" style="background: #8b5cf6;">Robo de Balón</button>
              <button type="button" class="btn-action-direct" data-action="turnovers" data-pts="0" style="background: #ea580c; grid-column: span 2;">Pérdida de Balón (TOV)</button>
            </div>
          </div>

          <div class="hud-action-card">
            <span class="hud-card-title" style="color: #d97706;">🛡️ DEFENSA Y FALTAS</span>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <button type="button" class="btn-action-direct" data-action="blocks_made" data-pts="0" style="background: #a855f7;">Tapón a Favor</button>
              <button type="button" class="btn-action-direct" data-action="blocks_received" data-pts="0" style="background: #d946ef;">Tapón Recibido</button>
              <button type="button" class="btn-action-direct" data-action="fouls_committed" data-pts="0" style="background: #f59e0b;">Falta Cometida (PF)</button>
              <button type="button" class="btn-action-direct" data-action="fouls_drawn" data-pts="0" style="background: #fbbf24; color: #78350f;">Falta Recibida (PFD)</button>
            </div>
          </div>

          <div class="hud-action-card" style="background: #fff7ed; border-color: #fed7aa;">
            <span class="hud-card-title" style="color: #c2410c;">🔴 ACCIÓN DIRECTA RIVAL</span>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
              <button type="button" class="btn-opp-action" data-type="pts" data-val="1" style="background: #f97316;">+1 TL Riv</button>
              <button type="button" class="btn-opp-action" data-type="pts" data-val="2" style="background: #ea580c;">+2 Canasta</button>
              <button type="button" class="btn-opp-action" data-type="pts" data-val="3" style="background: #c2410c;">+3 Triple</button>
              <button type="button" class="btn-opp-action" data-type="dreb" data-val="0" style="background: #fed7aa; color: #9a3412;">Reb Def Riv</button>
              <button type="button" class="btn-opp-action" data-type="oreb" data-val="0" style="background: #fed7aa; color: #9a3412;">Reb Of Riv</button>
              <button type="button" class="btn-opp-action" data-type="tov" data-val="0" style="background: #fed7aa; color: #9a3412;">Pérdida</button>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          <span style="font-size: 12px; color: #64748b;">Periodo actual: <strong>${this.currentPeriod}</strong></span>
          <button type="button" id="btn-hud-finish" style="background: #0f172a; color: #ffffff; border: none; padding: 12px 28px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer;">
            🏁 FINALIZAR PARTIDO & VALIDAR ACTA
          </button>
        </div>
      </div>
    `,this._bindHUDEvents(),this._renderModalLayer()}_closeModalLayer(){this.activeModal=null;const n=document.getElementById("hud-dynamic-modal-portal");n&&n.remove()}_renderModalLayer(){const n=document.getElementById("hud-dynamic-modal-portal");if(n&&n.remove(),!this.activeModal)return;const t=document.createElement("div");t.id="hud-dynamic-modal-portal",t.innerHTML=this._getModalContent(),document.body.appendChild(t),this._bindModalDynamicEvents()}_getModalContent(){if(this.activeModal==="court_shot")return`
        <div class="hud-modal-overlay">
          <div class="hud-modal-content" style="max-width: 500px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <strong style="font-size: 14px; color: #0f172a;">📍 Paso 1: Toca el punto del tiro en la pista</strong>
              <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">✕</button>
            </div>

            <div style="position: relative; width: 100%; aspect-ratio: 50/47; background: #d97736; border: 2px solid #ffffff; border-radius: 8px; overflow: hidden; cursor: crosshair;" id="modal-court-clickarea">
              <svg viewBox="0 0 500 470" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; pointer-events: none;">
                <rect x="0" y="0" width="500" height="470" fill="none" stroke="#fff" stroke-width="4"/>
                <rect x="170" y="0" width="160" height="190" fill="rgba(255,255,255,0.15)" stroke="#fff" stroke-width="3"/>
                <circle cx="250" cy="52" r="15" fill="none" stroke="#ff5722" stroke-width="4"/>
                <path d="M 30 140 A 235 235 0 0 0 470 140" fill="none" stroke="#fff" stroke-width="3"/>
              </svg>
            </div>

            <div id="shot-player-picker" style="display: none; margin-top: 14px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <span style="font-size: 11px; font-weight: 800; color: #64748b; display: block; margin-bottom: 8px;">Paso 2: ¿Quién lanzó?</span>
              <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
                ${this.roster.filter(t=>this.onCourtPlayerIds.includes(t.id)).map(t=>`
                  <button type="button" class="btn-select-shot-player" data-id="${t.id}" data-name="${t.name}" style="background: #1e3a8a !important; color: #ffffff !important; border: none; padding: 8px 2px; border-radius: 6px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
                    <span style="font-weight: 900; font-size: 15px; color: #ffffff !important;">#${t.jersey}</span>
                    <span style="font-size: 10px; font-weight: 700; color: #ffffff !important; opacity: 0.95; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px;">${t.name.split(" ")[0]}</span>
                  </button>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
      `;if(this.activeModal==="player_select")return`
        <div class="hud-modal-overlay">
          <div class="hud-modal-content" style="max-width: 440px; text-align: center;">
            <strong style="font-size: 15px; color: #0f172a; display: block; margin-bottom: 12px;">¿A qué jugador asignar la acción?</strong>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px;">
              ${this.roster.filter(t=>this.onCourtPlayerIds.includes(t.id)).map(t=>`
                <button type="button" class="btn-direct-player-choice" data-id="${t.id}" data-name="${t.name}" style="background: #1e3a8a !important; color: #ffffff !important; border: none; padding: 10px 2px; border-radius: 8px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
                  <span style="font-weight: 900; font-size: 16px; color: #ffffff !important;">#${t.jersey}</span>
                  <span style="font-size: 10px; font-weight: 700; color: #ffffff !important; opacity: 0.95; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px;">${t.name.split(" ")[0]}</span>
                </button>
              `).join("")}
            </div>
            <button type="button" class="btn-close-modal" style="background: #f1f5f9; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; color: #64748b; cursor: pointer;">Cancelar</button>
          </div>
        </div>
      `;if(this.activeModal==="substitutions"){const n=this.roster.filter(e=>e.isConvoked),t=this.pendingSubOnCourt.length,l=t===5,i=Math.floor(this.timeRemaining/60),r=Math.floor(this.timeRemaining%60/10),c=this.timeRemaining%60%10;return`
        <div class="hud-modal-overlay">
          <div class="hud-modal-content" style="max-width: 550px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <strong style="font-size: 16px; font-weight: 900; color: #0f172a;">🔄 Panel de Sustituciones (${this.currentPeriod})</strong>
              <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">✕</button>
            </div>

            <div style="background: #0f172a; color: #ffffff; border-radius: 10px; padding: 14px; display: flex; justify-content: center; align-items: center; gap: 16px; margin-bottom: 16px;">
              <div style="text-align: center;">
                <button type="button" class="btn-clock-adj" data-unit="min" data-val="1">▲</button>
                <div style="font-size: 32px; font-weight: 900; font-family: monospace; color: #38bdf8;">${String(i).padStart(2,"0")}</div>
                <button type="button" class="btn-clock-adj" data-unit="min" data-val="-1">▼</button>
              </div>

              <span style="font-size: 32px; font-weight: 900; color: #64748b;">:</span>

              <div style="text-align: center;">
                <button type="button" class="btn-clock-adj" data-unit="s1" data-val="1">▲</button>
                <div style="font-size: 32px; font-weight: 900; font-family: monospace; color: #f97316;">${r}</div>
                <button type="button" class="btn-clock-adj" data-unit="s1" data-val="-1">▼</button>
              </div>

              <div style="text-align: center;">
                <button type="button" class="btn-clock-adj" data-unit="s2" data-val="1">▲</button>
                <div style="font-size: 32px; font-weight: 900; font-family: monospace; color: #f97316;">${c}</div>
                <button type="button" class="btn-clock-adj" data-unit="s2" data-val="-1">▼</button>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; margin-bottom: 8px;">
              <span>SELECCIÓN DE QUINTETO:</span>
              <span style="color: ${l?"#16a34a":"#dc2626"};">${t} / 5 Seleccionados</span>
            </div>

            ${l?"":`
              <div style="background: #fee2e2; color: #b91c1c; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; margin-bottom: 10px; text-align: center;">
                ${t<5?`Faltan jugadores en campo (${t}/5)`:`Sobran jugadores en campo (${t}/5)`}
              </div>
            `}

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; max-height: 220px; overflow-y: auto; margin-bottom: 16px;">
              ${n.map(e=>{const a=this.pendingSubOnCourt.includes(e.id);return`
                  <button type="button" class="btn-sub-toggle-player ${a?"active":""}" data-id="${e.id}" style="padding: 10px; border-radius: 8px; border: 2px solid ${a?"#16a34a":"#cbd5e1"}; background: ${a?"#f0fdf4":"#ffffff"}; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 2px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <strong style="font-size: 14px; color: #0f172a;">#${e.jersey}</strong>
                      <span style="font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${a?"#dcfce7":"#f1f5f9"}; color: ${a?"#15803d":"#64748b"};">
                        ${a?"EN PISTA":"BANQUILLO"}
                      </span>
                    </div>
                    <span style="font-size: 11px; font-weight: 700; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.name}</span>
                  </button>
                `}).join("")}
            </div>

            <button type="button" id="btn-confirm-substitution" ${l?"":"disabled"} style="width: 100%; background: ${l?"#16a34a":"#cbd5e1"}; color: #ffffff; border: none; padding: 12px; border-radius: 8px; font-weight: 900; font-size: 14px; cursor: ${l?"pointer":"not-allowed"};">
              CONFIRMAR SUSTITUCIÓN (${i}:${String(this.timeRemaining%60).padStart(2,"0")})
            </button>
          </div>
        </div>
      `}return this.activeModal==="play_by_play"?`
        <div class="hud-modal-overlay">
          <div class="hud-modal-content" style="max-width: 650px; max-height: 85vh; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <strong style="font-size: 16px; font-weight: 900; color: #0f172a;">📋 Historial de Jugadas (Play-by-Play)</strong>
              <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">✕</button>
            </div>

            <div style="overflow-y: auto; flex: 1; border: 1px solid #e2e8f0; border-radius: 8px;">
              ${this.playByPlayEvents.length===0?`
                <div style="padding: 30px; text-align: center; color: #94a3b8;">No hay jugadas registradas aún.</div>
              `:`
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                  <thead style="background: #f8fafc; color: #475569; position: sticky; top: 0;">
                    <tr style="border-bottom: 2px solid #e2e8f0;">
                      <th style="padding: 8px;">PER</th>
                      <th style="padding: 8px;">MARCADOR</th>
                      <th style="padding: 8px;">ACCIÓN</th>
                      <th style="padding: 8px;">JUGADOR</th>
                      <th style="padding: 8px; text-align: right;">BORRAR</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${[...this.playByPlayEvents].reverse().map(n=>`
                      <tr style="border-bottom: 1px solid #f1f5f9; background: ${n.isOpponent?"#fff7ed":"#ffffff"};">
                        <td style="padding: 8px; font-weight: 800;">${n.period}</td>
                        <td style="padding: 8px; font-weight: 900; color: #0f172a;">${n.teamScore} - ${n.opponentScore}</td>
                        <td style="padding: 8px; font-weight: 700; color: #334155;">${n.actionLabel}</td>
                        <td style="padding: 8px; font-weight: 700;">${n.playerName}</td>
                        <td style="padding: 8px; text-align: right;">
                          <button type="button" class="btn-del-pbp-event" data-id="${n.id}" style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; border-radius: 4px; padding: 4px 8px; font-weight: 800; cursor: pointer;">🗑️</button>
                        </td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              `}
            </div>
          </div>
        </div>
      `:""}_bindHUDEvents(){this.container.querySelectorAll(".btn-period-hud").forEach(e=>{e.onclick=a=>{a.preventDefault();const d=e.getAttribute("data-period");this.currentPeriod!==d&&(this.subEvents.push({id:`sub-close-${Date.now()}`,type:"SUBSTITUTION",period:this.currentPeriod,timeRemaining:0,playersIn:[],playersOut:[...this.onCourtPlayerIds],onCourt:[...this.onCourtPlayerIds]}),this.currentPeriod=d,this.timeRemaining=this._getPeriodDuration(d),this.pendingSubOnCourt=[...this.onCourtPlayerIds],this.activeModal="substitutions",this._renderHUD())}}),this.container.querySelectorAll(".btn-remove-ot").forEach(e=>{e.onclick=a=>{a.preventDefault(),a.stopPropagation();const d=e.getAttribute("data-period");confirm(`¿Deseas eliminar la prórroga ${d}?`)&&(this.periodsList=this.periodsList.filter(f=>f!==d),this.currentPeriod===d&&(this.currentPeriod=this.periodsList[this.periodsList.length-1],this.timeRemaining=this._getPeriodDuration(this.currentPeriod)),this._renderHUD())}});const n=this.container.querySelector("#btn-add-ot");n&&(n.onclick=e=>{e.preventDefault();const d=`OT${this.periodsList.filter(f=>f.startsWith("OT")).length+1}`;this.periodsList.push(d),this.currentPeriod=d,this.timeRemaining=this.config.overtimeSeconds,this.pendingSubOnCourt=[...this.onCourtPlayerIds],this.activeModal="substitutions",this._renderHUD()});const t=this.container.querySelector("#btn-hud-subs");t&&(t.onclick=e=>{e.preventDefault(),this.pendingSubOnCourt=[...this.onCourtPlayerIds],this.activeModal="substitutions",this._renderHUD()});const l=this.container.querySelector("#btn-hud-pbp");l&&(l.onclick=e=>{e.preventDefault(),this.activeModal="play_by_play",this._renderHUD()});const i=this.container.querySelector("#btn-hud-undo");i&&(i.onclick=e=>{if(e.preventDefault(),this.playByPlayEvents.length===0)return;const a=this.playByPlayEvents.pop();this.undoneEventsStack.push(a),this._recalculateScoreFromEvents(),this._renderHUD()});const r=this.container.querySelector("#btn-hud-redo");r&&(r.onclick=e=>{if(e.preventDefault(),this.undoneEventsStack.length===0)return;const a=this.undoneEventsStack.pop();this.playByPlayEvents.push(a),this._recalculateScoreFromEvents(),this._renderHUD()}),this.container.querySelectorAll(".btn-action-shot").forEach(e=>{e.onclick=a=>{a.preventDefault();const d=e.getAttribute("data-action"),f=e.getAttribute("data-made")==="true";this.pendingAction={type:"shot",shotType:d,made:f,points:f?d==="T3"?3:2:0},this.activeModal="court_shot",this._renderHUD()}}),this.container.querySelectorAll(".btn-action-direct").forEach(e=>{e.onclick=a=>{a.preventDefault();const d=e.getAttribute("data-action"),f=Number(e.getAttribute("data-pts")||0);this.pendingAction={type:"direct",action:d,points:f},this.activeModal="player_select",this._renderHUD()}}),this.container.querySelectorAll(".btn-opp-action").forEach(e=>{e.onclick=a=>{a.preventDefault();const d=e.getAttribute("data-type"),f=Number(e.getAttribute("data-val")||0);let h=`Rival: +${f} Pts`;d==="oreb"&&(h="Rebote Ofensivo Rival"),d==="dreb"&&(h="Rebote Defensivo Rival"),d==="tov"&&(h="Pérdida de Balón Rival"),d==="pts"&&(this.opponentScore+=f);const g=this._getPeriodDuration(this.currentPeriod),s=Math.max(0,g-this.timeRemaining),m=Math.floor(s/60)+1,b={id:`ev-${Date.now()}`,isOpponent:!0,period:this.currentPeriod,timeRemaining:this.timeRemaining,minute:m,action:`opp_${d}`,action_type:`opp_${d}`,event_type:`opp_${d}`,actionLabel:h,points:d==="pts"?f:0,teamScore:this.teamScore,opponentScore:this.opponentScore,playerName:"Rival",player_id:null,onCourt:[...this.onCourtPlayerIds]};this.playByPlayEvents.push(b),this.undoneEventsStack=[],this._renderHUD()}});const c=this.container.querySelector("#btn-hud-finish");c&&(c.onclick=e=>{e.preventDefault(),this._closeModalLayer(),this.currentStep=4,this.render()})}_bindModalDynamicEvents(){const n=document.getElementById("hud-dynamic-modal-portal");if(!n)return;n.querySelectorAll(".btn-close-modal").forEach(i=>{i.onclick=r=>{r.preventDefault(),this._closeModalLayer()}});const t=n.querySelector("#modal-court-clickarea");t&&(t.onclick=i=>{const r=t.getBoundingClientRect(),c=(i.clientX-r.left)/r.width*100,e=(i.clientY-r.top)/r.height*100;this.pendingAction&&(this.pendingAction.coord_x=parseFloat(c.toFixed(1)),this.pendingAction.coord_y=parseFloat(e.toFixed(1)));const a=n.querySelector("#shot-player-picker");a&&(a.style.display="block")}),n.querySelectorAll(".btn-select-shot-player").forEach(i=>{i.onclick=r=>{var s;r.preventDefault();const c=i.getAttribute("data-id"),e=i.getAttribute("data-name");((s=this.pendingAction)==null?void 0:s.points)>0&&(this.teamScore+=this.pendingAction.points);const a=this.pendingAction.shotType==="T3"?this.pendingAction.made?"fg3_made":"fg3_attempted":this.pendingAction.made?"fg2_made":"fg2_attempted",d=this._getPeriodDuration(this.currentPeriod),f=Math.max(0,d-this.timeRemaining),h=Math.floor(f/60)+1,g={id:`ev-${Date.now()}`,isOpponent:!1,period:this.currentPeriod,timeRemaining:this.timeRemaining,minute:h,action:a,action_type:a,event_type:a,actionLabel:this._getActionLabelSpanish(a),points:this.pendingAction.points,teamScore:this.teamScore,opponentScore:this.opponentScore,playerId:c,player_id:c,playerName:e,coord_x:this.pendingAction.coord_x??50,coord_y:this.pendingAction.coord_y??50,made:this.pendingAction.made,onCourt:[...this.onCourtPlayerIds]};this.playByPlayEvents.push(g),this.undoneEventsStack=[],this._closeModalLayer(),this._renderHUD()}}),n.querySelectorAll(".btn-direct-player-choice").forEach(i=>{i.onclick=r=>{var m;r.preventDefault();const c=i.getAttribute("data-id"),e=i.getAttribute("data-name");((m=this.pendingAction)==null?void 0:m.points)>0&&(this.teamScore+=this.pendingAction.points);const a=this.pendingAction.action,d=this._getPeriodDuration(this.currentPeriod),f=Math.max(0,d-this.timeRemaining),h=Math.floor(f/60)+1,g=String(a).endsWith("_made")||String(a).includes("made"),s={id:`ev-${Date.now()}`,isOpponent:!1,period:this.currentPeriod,timeRemaining:this.timeRemaining,minute:h,action:a,action_type:a,event_type:a,actionLabel:this._getActionLabelSpanish(a),points:this.pendingAction.points,teamScore:this.teamScore,opponentScore:this.opponentScore,playerId:c,player_id:c,playerName:e,made:g,onCourt:[...this.onCourtPlayerIds]};this.playByPlayEvents.push(s),this.undoneEventsStack=[],this._closeModalLayer(),this._renderHUD()}}),n.querySelectorAll(".btn-clock-adj").forEach(i=>{i.onclick=r=>{r.preventDefault();const c=i.getAttribute("data-unit"),e=Number(i.getAttribute("data-val")),a=this._getPeriodDuration(this.currentPeriod);let d=Math.floor(this.timeRemaining/60),f=this.timeRemaining%60;c==="min"&&(d=Math.max(0,Math.min(Math.floor(a/60),d+e))),c==="s1"&&(f=Math.max(0,Math.min(59,f+e*10))),c==="s2"&&(f=Math.max(0,Math.min(59,f+e))),this.timeRemaining=Math.min(a,d*60+f),this._renderModalLayer()}}),n.querySelectorAll(".btn-sub-toggle-player").forEach(i=>{i.onclick=r=>{r.preventDefault();const c=i.getAttribute("data-id");if(this.pendingSubOnCourt.includes(c))this.pendingSubOnCourt=this.pendingSubOnCourt.filter(e=>e!==c);else{if(this.pendingSubOnCourt.length>=5){alert("Ya hay 5 jugadores seleccionados para estar en pista.");return}this.pendingSubOnCourt.push(c)}this._renderModalLayer()}});const l=n.querySelector("#btn-confirm-substitution");l&&(l.onclick=i=>{if(i.preventDefault(),this.pendingSubOnCourt.length!==5)return;const r=this.onCourtPlayerIds.filter(e=>!this.pendingSubOnCourt.includes(e)),c=this.pendingSubOnCourt.filter(e=>!this.onCourtPlayerIds.includes(e));this.onCourtPlayerIds=[...this.pendingSubOnCourt],this.subEvents.push({id:`sub-${Date.now()}`,type:"SUBSTITUTION",period:this.currentPeriod,timeRemaining:this.timeRemaining,playersIn:c,playersOut:r,onCourt:[...this.onCourtPlayerIds]}),this._closeModalLayer(),this._renderHUD()}),n.querySelectorAll(".btn-del-pbp-event").forEach(i=>{i.onclick=r=>{r.preventDefault();const c=i.getAttribute("data-id");this.playByPlayEvents=this.playByPlayEvents.filter(e=>e.id!==c),this._recalculateScoreFromEvents(),this._renderModalLayer(),this._renderHUD()}})}_recalculateScoreFromEvents(){let n=0,t=0;this.playByPlayEvents.forEach(l=>{l.isOpponent?t+=l.points||0:n+=l.points||0}),this.teamScore=n,this.opponentScore=t}_renderPostGameActa(){this._closeModalLayer();const n=this.roster.filter(p=>p.isConvoked);let t=0;this.periodsList.forEach(p=>{t+=this._getPeriodDuration(p)});const l=Math.round(t/60),i=l*5,r=new Map;n.forEach(p=>r.set(p.id,0)),this.subEvents.length>0?this.periodsList.forEach(p=>{const o=this._getPeriodDuration(p),u=this.subEvents.filter(_=>_.period===p);if(u.length===0)return;let P=o,A=u[0].onCourt;u.forEach(_=>{const T=Math.max(0,P-_.timeRemaining);A.forEach(C=>{r.set(C,(r.get(C)||0)+T/60)}),P=_.timeRemaining,A=_.onCourt}),A.forEach(_=>{r.set(_,(r.get(_)||0)+P/60)})}):this.roster.filter(o=>o.isStarter).map(o=>o.id).slice(0,5).forEach(o=>{r.set(o,l)});const c=new Map;n.forEach(p=>{const o=Math.round(r.get(p.id)||0);c.set(p.id,{id:p.id,name:p.name,jersey:p.jersey,min:o,pts:0,t2m:0,t2a:0,t3m:0,t3a:0,ftm:0,fta:0,reb:0,oreb:0,dreb:0,ast:0,stl:0,blk:0,tov:0,fouls:0,foulsDrawn:0})}),this.playByPlayEvents.forEach(p=>{const o=p.player_id||p.playerId;if(!p.isOpponent&&o&&c.has(o)){const u=c.get(o);p.action==="fg2_made"?(u.t2m++,u.t2a++,u.pts+=2):p.action==="fg2_attempted"?u.t2a++:p.action==="fg3_made"?(u.t3m++,u.t3a++,u.pts+=3):p.action==="fg3_attempted"?u.t3a++:p.action==="ft_made"?(u.ftm++,u.fta++,u.pts+=1):p.action==="ft_attempted"?u.fta++:p.action==="off_reb"?(u.reb++,u.oreb++):p.action==="def_reb"?(u.reb++,u.dreb++):p.action==="assists"?u.ast++:p.action==="steals"?u.stl++:p.action==="blocks_made"?u.blk++:p.action==="turnovers"?u.tov++:p.action==="fouls_committed"?u.fouls++:p.action==="fouls_drawn"&&u.foulsDrawn++}});let e=0,a=0,d=0,f=0,h=0,g=0,s=0,m=0,b=0,v=0,S=0,y=0;const w=n.map(p=>{const o=c.get(p.id);e+=o.min,a+=o.pts,d+=o.t2m,f+=o.t2a,h+=o.t3m,g+=o.t3a,s+=o.ftm,m+=o.fta,b+=o.reb,v+=o.ast,S+=o.fouls;const u=I?I.calculatePlayerBoxScore({points:o.pts,fg2_made:o.t2m,fg2_attempted:o.t2a,fg3_made:o.t3m,fg3_attempted:o.t3a,ft_made:o.ftm,ft_attempted:o.fta,off_reb:o.oreb,def_reb:o.dreb,assists:o.ast,steals:o.stl,blocks:o.blk,turnovers:o.tov,fouls_committed:o.fouls,fouls_drawn:o.foulsDrawn}).pir||0:o.pts+o.reb+o.ast+o.stl+o.blk+o.foulsDrawn-(o.t2a-o.t2m)-(o.t3a-o.t3m)-(o.fta-o.ftm)-o.tov-o.fouls;return y+=u,`
        <tr data-player-id="${p.id}" style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <td style="padding: 10px; font-weight: 800; color: #0f172a;">#${o.jersey} ${o.name}</td>
          <td style="padding: 6px; text-align: center;">
            <input type="number" class="input-acta-min" data-id="${p.id}" value="${o.min}" style="width: 58px; height: 34px; text-align: center; font-weight: 900; font-size: 14px; border: 1.5px solid #cbd5e1; border-radius: 6px; color: #0f172a !important; background: #ffffff !important; padding: 2px 4px; box-sizing: border-box;" />
          </td>
          <td style="padding: 6px; text-align: center; font-weight: 900; color: #1e3a8a;">${o.pts}</td>
          <td style="padding: 6px; text-align: center;">${o.t2m}/${o.t2a}</td>
          <td style="padding: 6px; text-align: center;">${o.t3m}/${o.t3a}</td>
          <td style="padding: 6px; text-align: center;">${o.ftm}/${o.fta}</td>
          <td style="padding: 6px; text-align: center;">${o.reb}</td>
          <td style="padding: 6px; text-align: center;">${o.ast}</td>
          <td style="padding: 6px; text-align: center; color: #ef4444;">${o.fouls}</td>
          <td style="padding: 6px; text-align: center; font-weight: 900; color: #a855f7;">${u}</td>
        </tr>
      `}).join(""),k=e===i;this.container.innerHTML=`
      <div style="max-width: 1100px; margin: 0 auto; font-family: system-ui, sans-serif; padding-bottom: 60px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: 24px; font-weight: 900; color: #0f172a; margin: 0;">📋 Acta Oficial & Cierre de Partido</h1>
            <span style="font-size: 13px; color: #64748b;">Resultado Final: <strong>${this.teamScore} - ${this.opponentScore}</strong> vs ${this.config.opponent||"Rival"}</span>
          </div>
          <button type="button" id="btn-back-to-hud" style="background: #ffffff; border: 1px solid #cbd5e1; color: #334155; padding: 10px 18px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer;">
            ← Volver al HUD en Vivo
          </button>
        </div>

        <div id="banner-sum-status" style="background: ${k?"#f0fdf4":"#fef2f2"}; border: 1px solid ${k?"#bbf7d0":"#fecaca"}; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <strong id="lbl-sum-title" style="font-size: 13px; color: ${k?"#15803d":"#991b1b"}; display: block;">
              ${k?"✅ Cuadre de Minutos Perfecto":"⚠️ Descuadre en Suma Total de Minutos"}
            </strong>
            <span id="lbl-sum-desc" style="font-size: 12px; color: ${k?"#166534":"#7f1d1d"};">
              Suma actual: <strong id="lbl-sum-min">${e} min</strong> (Esperado: ${i} min para ${l} min de partido).
            </span>
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); overflow-x: auto; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">
                <th style="padding: 10px;">JUGADOR</th>
                <th style="padding: 10px; text-align: center;">MIN</th>
                <th style="padding: 10px; text-align: center; color: #1e3a8a;">PTS</th>
                <th style="padding: 10px; text-align: center;">T2</th>
                <th style="padding: 10px; text-align: center;">T3</th>
                <th style="padding: 10px; text-align: center;">TL</th>
                <th style="padding: 10px; text-align: center;">REB</th>
                <th style="padding: 10px; text-align: center;">AST</th>
                <th style="padding: 10px; text-align: center; color: #ef4444;">FALTAS</th>
                <th style="padding: 10px; text-align: center; color: #a855f7;">VAL FIBA</th>
              </tr>
            </thead>
            <tbody>${w}</tbody>
            <tfoot style="background: #f8fafc; border-top: 2px solid #cbd5e1; font-weight: 900; font-size: 12px; color: #0f172a;">
              <tr>
                <td style="padding: 12px 10px;">TOTALES EQUIPO</td>
                <td id="tot-min" style="padding: 12px 6px; text-align: center; color: ${k?"#15803d":"#dc2626"};">${e}</td>
                <td style="padding: 12px 6px; text-align: center; color: #1e3a8a;">${a}</td>
                <td style="padding: 12px 6px; text-align: center;">${d}/${f}</td>
                <td style="padding: 12px 6px; text-align: center;">${h}/${g}</td>
                <td style="padding: 12px 6px; text-align: center;">${s}/${m}</td>
                <td style="padding: 12px 6px; text-align: center;">${b}</td>
                <td style="padding: 12px 6px; text-align: center;">${v}</td>
                <td style="padding: 12px 6px; text-align: center; color: #ef4444;">${S}</td>
                <td style="padding: 12px 6px; text-align: center; color: #a855f7;">${y}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <button type="button" id="btn-save-final-game" style="width: 100%; background: #f97316; color: #ffffff; border: none; padding: 14px; border-radius: 10px; font-weight: 900; font-size: 15px; cursor: pointer; box-shadow: 0 4px 12px rgba(249,115,22,0.35);">
          💾 GUARDAR PARTIDO Y GENERAR INFORMES
        </button>
      </div>
    `,this._bindActaEvents(c,i,l)}_bindActaEvents(n,t,l){const i=this.container.querySelector("#btn-back-to-hud");i&&(i.onclick=c=>{c.preventDefault(),this.currentStep=2,this.render()}),this.container.querySelectorAll(".input-acta-min").forEach(c=>{c.addEventListener("input",()=>{let e=0;this.container.querySelectorAll(".input-acta-min").forEach(s=>{e+=Number(s.value||0)});const a=this.container.querySelector("#lbl-sum-min"),d=this.container.querySelector("#tot-min"),f=this.container.querySelector("#banner-sum-status"),h=this.container.querySelector("#lbl-sum-title"),g=this.container.querySelector("#lbl-sum-desc");if(a&&(a.textContent=`${e} min`),d&&(d.textContent=e,d.style.color=e===t?"#15803d":"#dc2626"),f&&h&&g){const s=e===t;f.style.background=s?"#f0fdf4":"#fef2f2",f.style.borderColor=s?"#bbf7d0":"#fecaca",h.style.color=s?"#15803d":"#991b1b",h.textContent=s?"✅ Cuadre de Minutos Perfecto":"⚠️ Descuadre en Suma Total de Minutos",g.style.color=s?"#166534":"#7f1d1d",g.innerHTML=`Suma actual: <strong id="lbl-sum-min">${e} min</strong> (Esperado: ${t} min para ${l} min de partido).`}})});const r=this.container.querySelector("#btn-save-final-game");r&&(r.onclick=async c=>{c.preventDefault(),r.disabled=!0,r.textContent="⏳ Guardando partido y parciales...";const e=x.getActiveTeamId?x.getActiveTeamId():null,a=x.getActiveSeasonId?x.getActiveSeasonId():null,d={team_id:e,season_id:a,date:this.config.date,time:"18:00",opponent:this.config.opponent,competition:"Liga",venue:this.config.venue,status:"Finalizado",team_score:this.teamScore,opponent_score:this.opponentScore,starter_ids:this.roster.filter(s=>s.isConvoked&&s.isStarter).map(s=>s.id)},f=[];this.container.querySelectorAll("tr[data-player-id]").forEach(s=>{var S,y;const m=s.getAttribute("data-player-id"),b=n.get(m),v=Number(((S=s.querySelector(".input-acta-min"))==null?void 0:S.value)||0);f.push({player_id:m,starter:!!((y=this.roster.find(w=>w.id===m))!=null&&y.isStarter),minutes:v,points:b.pts,fg2_made:b.t2m,fg2_attempted:b.t2a,fg3_made:b.t3m,fg3_attempted:b.t3a,ft_made:b.ftm,ft_attempted:b.fta,off_reb:b.oreb,def_reb:b.dreb,rebounds:b.reb,assists:b.ast,steals:b.stl,blocks:b.blk,blocks_made:b.blk,blocks_received:0,turnovers:b.tov,fouls_committed:b.fouls,fouls_drawn:b.foulsDrawn,plus_minus:0})});const h=this.periodsList.map(s=>{const m=s.startsWith("OT"),b=parseInt(s.replace(/[^\d]/g,""),10)||1,v=this.playByPlayEvents.filter(y=>y.period===s&&!y.isOpponent).reduce((y,w)=>y+(Number(w.points)||0),0),S=this.playByPlayEvents.filter(y=>y.period===s&&y.isOpponent).reduce((y,w)=>y+(Number(w.points)||0),0);return{period_type:m?"overtime":"quarter",period_number:b,team_score:v,opponent_score:S,is_overtime:m}}),g=this.playByPlayEvents.map((s,m)=>{const b=s.player_id||s.playerId||null,v=s.action_type||s.action||s.event_type,S=parseInt(String(s.period||"1").replace(/[^\d]/g,""),10)||1;return{id:s.id||`ev-${Date.now()}-${m}`,player_id:b,playerId:b,playerName:s.playerName||"",period:S,game_clock:String(s.game_clock||"10:00"),action_type:v,action:v,event_type:v,points:Number(s.points||0),is_opponent:!!s.isOpponent,isOpponent:!!s.isOpponent,made:!!s.made,coord_x:s.coord_x!==void 0&&s.coord_x!==null?parseFloat(Number(s.coord_x).toFixed(2)):null,coord_y:s.coord_y!==void 0&&s.coord_y!==null?parseFloat(Number(s.coord_y).toFixed(2)):null}});try{await x.saveGameAndStats(d,f,h,g),await x.init(e,!0),alert("✅ Partido, cuartos y jugadas registradas con éxito."),window.location.hash==="#/games"?window.dispatchEvent(new HashChangeEvent("hashchange")):window.location.hash="#/games"}catch(s){console.error("Error guardando partido:",s),alert(`❌ Error al guardar: ${s.message||s}`),r.disabled=!1,r.textContent="💾 GUARDAR PARTIDO Y GENERAR INFORMES"}})}}if(!document.getElementById("livescore-hud-custom-styles")){const $=document.createElement("style");$.id="livescore-hud-custom-styles",$.textContent=`
    .hud-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px; }
    .hud-input, .hud-select { width: 100%; height: 38px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 700; padding: 4px 8px; color: #0f172a; background: #ffffff; box-sizing: border-box; }
    .hud-action-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
    .hud-card-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; }
    .btn-action-shot, .btn-action-direct, .btn-opp-action { border: none; color: #ffffff; padding: 12px 6px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; min-height: 48px; display: flex; align-items: center; justify-content: center; text-align: center; }
    .hud-modal-overlay {
      position: fixed !important; inset: 0 !important; background: rgba(15, 23, 42, 0.8) !important;
      display: flex !important; align-items: flex-start !important; justify-content: center !important;
      z-index: 999999 !important; box-sizing: border-box !important; overflow-y: auto !important;
      overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
      padding: max(10px, env(safe-area-inset-top, 0px)) max(10px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(10px, env(safe-area-inset-left, 0px)) !important;
    }
    .hud-modal-content {
      background: #ffffff !important; border-radius: 14px !important; padding: 20px !important;
      width: 100% !important; box-shadow: 0 10px 30px rgba(0,0,0,0.4) !important;
      box-sizing: border-box !important; overflow-y: auto !important; overflow-x: hidden !important;
      max-height: calc(100dvh - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) !important;
      margin: auto 0 !important;
    }
    .btn-clock-adj {
      background: #1e293b; color: #38bdf8; border: 1px solid #334155;
      padding: 4px 10px; border-radius: 4px; font-weight: 900; cursor: pointer;
    }
  `,document.head.appendChild($)}export{L as LiveScoreHUDView};
