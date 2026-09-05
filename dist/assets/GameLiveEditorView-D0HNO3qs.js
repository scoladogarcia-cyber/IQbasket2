import{s as W,G as Q,T as Y,I as U,P as G,D as b,B as Z}from"./index-Co3VTdK8.js";import{LiveScoreHUDView as K}from"./LiveScoreHUDView-DPdZq37X.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";class oe{constructor(e,r){this.gameController=e,this.auth=r,this.supabase=W,this.games=[],this.players=[],this.currentGame=null,this.currentGameStats=[],this.currentPeriods=[],this.filterCondition="Todos",this.sortOrder="desc",this.isEditing=!1,this.entrySubMode="court",this.activePeriodNumber=1,this.isPeriodOvertime=!1,this.selectedPlayerId=null,this.selectedPlayerName=null,this.pendingShot=null,this.liveEventsHistory=[],this.opponentStats={oreb:0,dreb:0,tov:0,ast:0,blk_made:0,blk_received:0,fouls:0},this.continuationDialog=null,this.pendingLockRequests=[],this.gameLockService=new Q(this.supabase,this.auth)}t(e,r=""){return(Y?Y.t(e,r):U.t(e,r))||r}_canEditFullBoxScore(){var e,r;return!!((r=(e=this.auth)==null?void 0:e.canPreview)!=null&&r.call(e,G.EDIT_BOXSCORE,this._gameContext(this.currentGame)))}_isGameLocked(e=null){return Q.isLocked(e||{})}_isTeamSeasonFrozen(e=null){var p,s,i,f;const r=e||this.teamId||((s=(p=b).getActiveTeamId)==null?void 0:s.call(p)),t=((f=(i=b).getActiveSeasonContext)==null?void 0:f.call(i,r))||null;return String((t==null?void 0:t.data_status)||(t==null?void 0:t.dataStatus)||"ACTIVE").toUpperCase()==="FROZEN"}_gameContext(e=null){var r,t;return{teamId:(e==null?void 0:e.team_id)||(e==null?void 0:e.teamId)||this.teamId||b.getActiveTeamId(),seasonId:(e==null?void 0:e.season_id)||(e==null?void 0:e.seasonId)||null,teamSeasonId:(e==null?void 0:e.team_season_id)||(e==null?void 0:e.teamSeasonId)||((t=(r=b).getActiveTeamSeasonId)==null?void 0:t.call(r))}}_canDeleteGame(e=null){var r,t;return this._isGameLocked(e)?!1:!!((t=(r=this.auth)==null?void 0:r.canPreview)!=null&&t.call(r,G.DELETE_GAME,this._gameContext(e)))}_escapeText(e=""){return String(e??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}_pendingLockRequest(e){return(this.pendingLockRequests||[]).find(r=>String(r.game_id||r.gameId)===String(e))||null}async _loadLockRequests(){const e=(this.games||[]).map(t=>t.id).filter(Boolean);if(e.length===0){this.pendingLockRequests=[];return}if(!(this.games||[]).some(t=>this.gameLockService.canReviewRequests(t)||this.gameLockService.canRequestLock(t))){this.pendingLockRequests=[];return}try{this.pendingLockRequests=await this.gameLockService.listPendingRequests(e)}catch(t){console.warn("[GameLiveEditorView] Solicitudes de cierre no disponibles:",(t==null?void 0:t.message)||t),this.pendingLockRequests=[]}}_renderLockRequestsPanel(){const e=(this.pendingLockRequests||[]).filter(r=>{const t=this.games.find(p=>String(p.id)===String(r.game_id||r.gameId));return t&&this.gameLockService.canReviewRequests(t)});return e.length===0?"":`
      <section style="margin-bottom: 18px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 14px;">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
          <div>
            <h2 style="margin:0; font-size:15px; font-weight:900; color:#78350f;">📨 Peticiones de cierre</h2>
            <p style="margin:3px 0 0; font-size:12px; color:#92400e;">Entrenadores y analistas solicitan aquí el bloqueo definitivo del partido.</p>
          </div>
          <span style="background:#fef3c7; color:#92400e; border-radius:999px; padding:4px 9px; font-size:11px; font-weight:900;">${e.length} pendiente${e.length===1?"":"s"}</span>
        </div>
        <div style="display:grid; gap:8px;">
          ${e.map(r=>{const t=this.games.find(f=>String(f.id)===String(r.game_id||r.gameId))||{},p=this._escapeText(t.opponent||t.opponentName||"Rival"),s=this._escapeText(r.request_reason||"Sin comentario"),i=this._escapeText(r.requested_by_role||"Usuario");return`
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap; background:#ffffff; border:1px solid #fde68a; border-radius:10px; padding:10px 12px;">
                <div style="min-width:220px;">
                  <strong style="display:block; color:#0f172a; font-size:13px;">vs ${p} · ${this._escapeText(t.date||"")}</strong>
                  <span style="display:block; color:#64748b; font-size:11px; margin-top:2px;">${i}: ${s}</span>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <button type="button" class="btn-approve-lock-request" data-request-id="${r.id}" style="min-height:40px; border:0; border-radius:8px; padding:8px 12px; background:#166534; color:#ffffff; font-weight:800; cursor:pointer;">✓ Aprobar y cerrar</button>
                  <button type="button" class="btn-reject-lock-request" data-request-id="${r.id}" style="min-height:40px; border:1px solid #fca5a5; border-radius:8px; padding:8px 12px; background:#fff1f2; color:#be123c; font-weight:800; cursor:pointer;">Rechazar</button>
                </div>
              </div>
            `}).join("")}
        </div>
      </section>
    `}async _refreshAfterLockAction(e,r){await b.init(r,!0),this.games=b.getGames(r)||[],this.isEditing=!1,this.currentGame=null,await this._renderGamesList(e,r)}_bindGameLockEvents(e,r){e.querySelectorAll(".btn-lock-game").forEach(t=>{t.addEventListener("click",async p=>{const s=p.currentTarget.dataset.id,i=this.games.find(o=>String(o.id)===String(s));if(!i||!this.gameLockService.canLock(i)){alert("⚠️ No tienes permiso para cerrar este partido.");return}if(!confirm("¿Cerrar este partido? Una vez cerrado nadie podrá modificar sus datos hasta que un Admin o Superadmin lo reabra."))return;const f=prompt("Motivo del cierre (opcional):","Partido revisado y validado");try{p.currentTarget.disabled=!0,await this.gameLockService.setLocked(s,!0,f),await this._refreshAfterLockAction(e,r)}catch(o){console.error("[GameLiveEditorView] Error cerrando partido:",o),alert(`❌ No se pudo cerrar el partido: ${o.message||o}`),p.currentTarget.disabled=!1}})}),e.querySelectorAll(".btn-reopen-game").forEach(t=>{t.addEventListener("click",async p=>{const s=p.currentTarget.dataset.id,i=this.games.find(o=>String(o.id)===String(s));if(!i||!this.gameLockService.canReopen(i)){alert("⚠️ No tienes permiso para reabrir este partido.");return}if(!confirm("¿Reabrir este partido? Volverá a ser editable para los roles autorizados."))return;const f=prompt("Motivo de reapertura (opcional):","Corrección autorizada");try{p.currentTarget.disabled=!0,await this.gameLockService.setLocked(s,!1,f),await this._refreshAfterLockAction(e,r)}catch(o){console.error("[GameLiveEditorView] Error reabriendo partido:",o),alert(`❌ No se pudo reabrir el partido: ${o.message||o}`),p.currentTarget.disabled=!1}})}),e.querySelectorAll(".btn-request-game-lock").forEach(t=>{t.addEventListener("click",async p=>{const s=p.currentTarget.dataset.id,i=this.games.find(o=>String(o.id)===String(s));if(!i||!this.gameLockService.canRequestLock(i)){alert("⚠️ No tienes permiso para solicitar el cierre de este partido.");return}const f=prompt("Comentario para Admin/Superadmin (opcional):","Partido revisado; solicito cierre");if(f!==null)try{p.currentTarget.disabled=!0,await this.gameLockService.requestLock(s,f),await this._refreshAfterLockAction(e,r),alert("✅ Solicitud de cierre enviada.")}catch(o){console.error("[GameLiveEditorView] Error solicitando cierre:",o),alert(`❌ No se pudo solicitar el cierre: ${o.message||o}`),p.currentTarget.disabled=!1}})}),e.querySelectorAll(".btn-approve-lock-request").forEach(t=>{t.addEventListener("click",async p=>{const s=p.currentTarget.dataset.requestId;if(confirm("¿Aprobar la petición y cerrar el partido?"))try{p.currentTarget.disabled=!0,await this.gameLockService.resolveRequest(s,"APPROVED","Cierre aprobado"),await this._refreshAfterLockAction(e,r)}catch(i){console.error("[GameLiveEditorView] Error aprobando cierre:",i),alert(`❌ No se pudo aprobar la petición: ${i.message||i}`),p.currentTarget.disabled=!1}})}),e.querySelectorAll(".btn-reject-lock-request").forEach(t=>{t.addEventListener("click",async p=>{const s=p.currentTarget.dataset.requestId,i=prompt("Motivo del rechazo (opcional):","");if(i!==null)try{p.currentTarget.disabled=!0,await this.gameLockService.resolveRequest(s,"REJECTED",i),await this._refreshAfterLockAction(e,r)}catch(f){console.error("[GameLiveEditorView] Error rechazando cierre:",f),alert(`❌ No se pudo rechazar la petición: ${f.message||f}`),p.currentTarget.disabled=!1}})})}_generateUUID(){return typeof crypto<"u"&&crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(e){const r=Math.random()*16|0;return(e==="x"?r:r&3|8).toString(16)})}async render(e="dashboard-content-area",r=null,t=null){var s,i;const p=document.getElementById(e)||document.getElementById("main-content")||document.querySelector(".app-main-content")||document.body;if(p){if(this.teamId=t||b.getActiveTeamId(),this.players=((i=(s=b).getPlayersEligibleOnDate)==null?void 0:i.call(s,this.teamId,new Date().toISOString().slice(0,10)))||b.getPlayers(this.teamId)||[],r&&r!==this.teamId){await this._openEditForm(r,p);return}this.isEditing&&this.currentGame?this._renderEditForm(p):await this._renderGamesList(p,this.teamId)}}async _renderGamesList(e,r){var E,P,u,a,d,c,_,$,S;this.games=b.getGames(r)||[],await this._loadLockRequests();const t=this._isTeamSeasonFrozen(r),p=!t&&!!((P=(E=this.auth)==null?void 0:E.canPreview)!=null&&P.call(E,G.CREATE_GAME,{teamId:r})),s=!t&&!!((a=(u=this.auth)==null?void 0:u.canPreview)!=null&&a.call(u,G.RECORD_LIVE_GAME,{teamId:r})),i=!t&&!!((c=(d=this.auth)==null?void 0:d.canPreview)!=null&&c.call(d,G.EDIT_GAME,{teamId:r})),f=[...this.games].sort((n,g)=>new Date(n.date||0)-new Date(g.date||0)),o=new Map;f.forEach((n,g)=>{o.set(String(n.id),`P${g+1}`)});const L=[...this.games.filter(n=>{const g=String(n.venue||"").toLowerCase();return this.filterCondition==="Local"?g==="local"||g==="home":this.filterCondition==="Visitante"?g==="visitante"||g==="away":!0})].sort((n,g)=>{const h=new Date(n.date||0),w=new Date(g.date||0);return this.sortOrder==="asc"?h-w:w-h}).map(n=>{const g=Number(n.team_score??n.teamScore??0)>Number(n.opponent_score??n.opponentScore??0),h=g?"background: #166534; color: #ffffff;":"background: #dc2626; color: #ffffff;",w=g?this.t("win","VICTORIA"):this.t("loss","DERROTA"),v=b.getGamePeriodScores(n.id)||[],x=v.filter(k=>!k.is_overtime&&!k.isOvertime),y=v.filter(k=>k.is_overtime||k.isOvertime),I=k=>x[k]?`${x[k].team_score??x[k].teamScore??0}-${x[k].opponent_score??x[k].opponentScore??0}`:"0-0",q=y.length>0?y.map((k,X)=>`<b>OT${X+1}:</b> ${k.team_score??k.teamScore??0}-${k.opponent_score??k.opponentScore??0}`).join(" "):"",M=String(n.venue||"").toLowerCase(),C=M==="home"||M==="local"||n.is_home===!0||n.isHome===!0?this.t("local","Local"):this.t("visitor","Visitante"),F=o.get(String(n.id))||"P-",D=this._escapeText(n.opponent||n.opponent_name||n.opponentName||this.t("opponent","Rival")),j=n.date?U.formatDate?U.formatDate(n.date):n.date:"-",T=this._isGameLocked(n),z=this._pendingLockRequest(n.id),R=i&&!T,m=!t&&!T&&this.gameLockService.canLock(n),J=!t&&T&&this.gameLockService.canReopen(n),B=!t&&!T&&this.gameLockService.canRequestLock(n),A=this._canDeleteGame(n),H=T?'<span style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:900;padding:3px 8px;border-radius:999px;">🔒 Cerrado</span>':z?'<span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:900;padding:3px 8px;border-radius:999px;">⏳ Cierre solicitado</span>':'<span style="background:#dcfce7;color:#166534;font-size:11px;font-weight:900;padding:3px 8px;border-radius:999px;">🔓 Abierto</span>';let O="";return J?O=`<button type="button" class="btn-reopen-game" data-id="${n.id}" style="background:#ecfdf5;color:#166534;border:1px solid #86efac;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;min-height:44px;">🔓 Reabrir</button>`:m?O=`<button type="button" class="btn-lock-game" data-id="${n.id}" style="background:#fff7ed;color:#9a3412;border:1px solid #fdba74;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;min-height:44px;">🔒 Cerrar</button>`:B&&(O=`<button type="button" class="btn-request-game-lock" data-id="${n.id}" ${z?"disabled":""} style="background:${z?"#f1f5f9":"#eff6ff"};color:${z?"#94a3b8":"#1d4ed8"};border:1px solid ${z?"#cbd5e1":"#93c5fd"};padding:8px 12px;border-radius:8px;font-size:12px;font-weight:800;cursor:${z?"not-allowed":"pointer"};min-height:44px;">${z?"⏳ Cierre solicitado":"📨 Solicitar cierre"}</button>`),`
        <div class="game-item-card card" style="background:#ffffff;border:1px solid ${T?"#fecaca":"#e2e8f0"};border-radius:14px;padding:18px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,0.04);flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <div style="padding:10px 14px;border-radius:10px;font-weight:900;font-size:13px;text-align:center;width:85px;${h}">
              <div style="font-size:9px;text-transform:uppercase;opacity:.9;">${w}</div>
              <div style="font-size:16px;font-weight:900;margin-top:2px;">${n.team_score??n.teamScore??0}-${n.opponent_score??n.opponentScore??0}</div>
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <h3 style="margin:0;font-size:16px;font-weight:800;color:#0f172a;">vs ${D}</h3>
                <span style="background:#dbeafe;color:#1e40af;font-size:11px;font-weight:800;padding:2px 8px;border-radius:10px;">${C} (${F})</span>
                ${H}
              </div>
              <div style="font-size:12px;color:#475569;margin:4px 0;">
                📅 ${j} &nbsp;·&nbsp; 🏆 ${this._escapeText(n.competition||"Liga")} &nbsp;·&nbsp; 📍 ${this._escapeText(n.venue_name||n.venueName||"-")}
              </div>
              <div style="font-size:11px;color:#334155;background:#f8fafc;padding:4px 10px;border-radius:6px;border:1px solid #cbd5e1;display:inline-block;">
                <b>${this.t("quarters","CUARTOS")}:</b> Q1: ${I(0)} &nbsp; Q2: ${I(1)} &nbsp; Q3: ${I(2)} &nbsp; Q4: ${I(3)} ${q?`&nbsp; ${q}`:""}
              </div>
              ${T&&n.lock_reason?`<div style="font-size:11px;color:#991b1b;margin-top:5px;">Motivo de cierre: ${this._escapeText(n.lock_reason||n.lockReason)}</div>`:""}
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button class="btn-open-court-direct" data-id="${n.id}" aria-disabled="${!R}" style="background:${R?"#0284c7":"#e2e8f0"};color:${R?"#ffffff":"#64748b"};border:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:${R?"pointer":"not-allowed"};min-height:44px;display:inline-flex;align-items:center;gap:4px;">
              🏀 Pista / Edición${R?"":" 🔒"}
            </button>
            <button onclick="window.location.hash='#/boxscore/${n.id}'" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;min-height:44px;">📋 Boxscore</button>
            <button onclick="window.location.hash='#/reports'" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;min-height:44px;">📊 Informe</button>
            ${O}
            <button class="btn-delete-game-direct" data-id="${n.id}" ${A?"":"disabled"} style="background:${A?"#fee2e2":"#f1f5f9"};border:1px solid ${A?"#fca5a5":"#cbd5e1"};font-size:18px;cursor:${A?"pointer":"not-allowed"};color:${A?"#dc2626":"#94a3b8"};min-height:44px;min-width:44px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;" title="${A?"Eliminar partido":T?"Reabre el partido antes de eliminarlo":"Tu rol no puede eliminar partidos"}">🗑️</button>
          </div>
        </div>
      `}).join("");e.innerHTML=`
      <div style="max-width:1400px;margin:0 auto;font-family:system-ui,-apple-system,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div>
            <h1 style="font-size:24px;font-weight:800;color:#0f172a;margin:0;">${this.t("team_games","Partidos del Equipo")}</h1>
            <span style="font-size:13px;color:#475569;">${this.games.length} ${this.t("registered_games","partidos registrados")}</span>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button id="btn-create-game-hud" aria-disabled="${!s}" style="background:${s?"#f97316":"#e2e8f0"};color:${s?"#ffffff":"#64748b"};border:none;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:900;cursor:${s?"pointer":"not-allowed"};min-height:44px;display:inline-flex;align-items:center;gap:6px;">
              ⚡ Nueva Anotación en Vivo (HUD Pro)${s?"":" 🔒"}
            </button>
            <button id="btn-create-game" aria-disabled="${!p}" style="background:${p?"#0f172a":"#e2e8f0"};color:${p?"#ffffff":"#64748b"};border:none;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:800;cursor:${p?"pointer":"not-allowed"};min-height:44px;display:inline-flex;align-items:center;gap:6px;">
              + 🏀 Registro Rápido
            </button>
          </div>
        </div>

        ${t?`
          <div style="margin-bottom:16px;padding:12px 14px;border-radius:11px;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;font-size:12px;line-height:1.5;">
            🔒 <strong>Temporada cerrada.</strong> Los partidos permanecen disponibles para BoxScore, informes y análisis, pero no pueden editarse, reabrirse ni crearse nuevos hasta reabrir la temporada.
          </div>
        `:""}

        ${this._renderLockRequestsPanel()}

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="filter-btn ${this.filterCondition==="Todos"?"active":""}" data-cond="Todos" style="padding:8px 16px;border-radius:20px;border:none;font-size:12px;font-weight:700;cursor:pointer;min-height:44px;background:${this.filterCondition==="Todos"?"#1e3a8a":"#e2e8f0"};color:${this.filterCondition==="Todos"?"#ffffff":"#334155"};">${this.t("all","Todos")} (${this.games.length})</button>
            <button class="filter-btn ${this.filterCondition==="Local"?"active":""}" data-cond="Local" style="padding:8px 16px;border-radius:20px;border:none;font-size:12px;font-weight:700;cursor:pointer;min-height:44px;background:${this.filterCondition==="Local"?"#1e3a8a":"#e2e8f0"};color:${this.filterCondition==="Local"?"#ffffff":"#334155"};">${this.t("local","Local")}</button>
            <button class="filter-btn ${this.filterCondition==="Visitante"?"active":""}" data-cond="Visitante" style="padding:8px 16px;border-radius:20px;border:none;font-size:12px;font-weight:700;cursor:pointer;min-height:44px;background:${this.filterCondition==="Visitante"?"#1e3a8a":"#e2e8f0"};color:${this.filterCondition==="Visitante"?"#ffffff":"#334155"};">${this.t("visitor","Visitante")}</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:12px;font-weight:700;color:#475569;">${this.t("sort","ORDENAR")}:</label>
            <select id="select-sort-games" style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;font-weight:700;background:#ffffff;color:#0f172a;cursor:pointer;min-height:44px;">
              <option value="desc" ${this.sortOrder==="desc"?"selected":""}>Pn → P1 (Más recientes primero)</option>
              <option value="asc" ${this.sortOrder==="asc"?"selected":""}>P1 → Pn (Antiguos a recientes)</option>
            </select>
          </div>
        </div>

        <div>${L.length>0?L:`<div style="padding:40px;text-align:center;color:#64748b;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">${this.t("no_games_recorded","No hay partidos registrados.")}</div>`}</div>
      </div>
    `,this._bindGameLockEvents(e,r),(_=e.querySelector("#btn-create-game-hud"))==null||_.addEventListener("click",()=>{var n,g;if(this._isTeamSeasonFrozen(r)){alert("🔒 Temporada cerrada. Reábrela antes de registrar un nuevo partido.");return}if(!((g=(n=this.auth)==null?void 0:n.canPreview)!=null&&g.call(n,G.RECORD_LIVE_GAME,{teamId:r}))){alert("⚠️ Tu perfil puede consultar partidos, pero no registrar una anotación en vivo.");return}new K(this.auth).render("dashboard-content-area")}),e.querySelectorAll(".btn-open-court-direct").forEach(n=>{n.addEventListener("click",g=>{var v,x;const h=g.currentTarget.getAttribute("data-id"),w=this.games.find(y=>String(y.id)===String(h));if(this._isGameLocked(w)){alert("🔒 Partido cerrado. Puedes consultar el BoxScore y los informes, pero no modificar datos.");return}if(!((x=(v=this.auth)==null?void 0:v.canPreview)!=null&&x.call(v,G.EDIT_GAME,this._gameContext(w)))){alert("⚠️ Tu perfil puede consultar el partido y su BoxScore, pero no editarlo.");return}this.entrySubMode="court",this._openEditForm(h,e)})}),($=e.querySelector("#btn-create-game"))==null||$.addEventListener("click",()=>{var h,w,v,x;if(this._isTeamSeasonFrozen(r)){alert("🔒 Temporada cerrada. Reábrela antes de registrar un nuevo partido.");return}if(!((w=(h=this.auth)==null?void 0:h.canPreview)!=null&&w.call(h,G.CREATE_GAME,{teamId:r}))){alert("⚠️ Tu perfil no tiene permiso para registrar nuevos partidos.");return}const n=b.getTeamById(r)||{},g=this._generateUUID();this.currentGame={id:g,team_id:r,season_id:b.getActiveSeasonId(r),team_season_id:((x=(v=b).getActiveTeamSeasonId)==null?void 0:x.call(v,r))||null,date:new Date().toISOString().split("T")[0],time:"18:00",opponent:"",competition:n.competition||"Liga",round:"Jornada "+(this.games.length+1),venue:"Local",venue_name:"",status:"Finalizado",edit_state:"OPEN",starter_ids:[],notes:"",video_url:"",team_score:0,opponent_score:0},this.currentPeriods=[1,2,3,4].map(y=>({period_type:"quarter",period_number:y,team_score:0,opponent_score:0,is_overtime:!1})),this.currentGameStats=this.players.map(y=>({player_id:y.id,minutes:0,fg2_made:0,fg2_attempted:0,fg3_made:0,fg3_attempted:0,ft_made:0,ft_attempted:0,off_reb:0,def_reb:0,assists:0,steals:0,blocks_made:0,blocks_received:0,turnovers:0,fouls_committed:0,fouls_drawn:0,plus_minus:0})),this.liveEventsHistory=[],this.entrySubMode="classic",this.isEditing=!0,this._renderEditForm(e)}),e.querySelectorAll(".btn-delete-game-direct").forEach(n=>{n.addEventListener("click",async g=>{var v,x;g.preventDefault(),g.stopPropagation();const h=g.currentTarget.getAttribute("data-id");if(!h)return;const w=this.games.find(y=>String(y.id)===String(h));if(this._isGameLocked(w)){alert("🔒 Partido cerrado. Debes reabrirlo antes de poder eliminarlo.");return}if(!((x=(v=this.auth)==null?void 0:v.can)!=null&&x.call(v,G.DELETE_GAME,this._gameContext(w)))){alert("⚠️ Tu rol no puede eliminar partidos.");return}if(confirm(this.t("confirm_delete_game","¿Estás seguro de que deseas eliminar este partido? Se borrarán todas sus estadísticas, cuartos y jugadas asociadas.")))try{await b.deleteGame(h),this.games=b.getGames(r)||[],await this._renderGamesList(e,r),alert("✅ Partido eliminado correctamente.")}catch(y){console.error("❌ Excepción al eliminar partido:",y),alert(`❌ No se pudo eliminar el partido: ${y.message||y}`)}})}),e.querySelectorAll(".filter-btn").forEach(n=>{n.addEventListener("click",()=>{this.filterCondition=n.getAttribute("data-cond"),this._renderGamesList(e,r)})}),(S=e.querySelector("#select-sort-games"))==null||S.addEventListener("change",n=>{this.sortOrder=n.target.value,this._renderGamesList(e,r)})}async _openEditForm(e,r){var N,L,E,P;this.currentGame=b.getGameById(e)||{};const t=this.currentGame.team_id||this.currentGame.teamId||this.teamId;if(this._isGameLocked(this.currentGame)){this.isEditing=!1,alert("🔒 Partido cerrado. Reabre el partido antes de modificar datos."),await this._renderGamesList(r,t);return}const p=((L=(N=b).getPlayersEligibleOnDate)==null?void 0:L.call(N,t,this.currentGame.date))||b.getPlayers(t)||[],s=((P=(E=b).getSeasonParticipantPlayers)==null?void 0:P.call(E,t))||b.getPlayers(t)||[];this.players=p;let i=b.getGamePeriodScores(e)||[];i.length===0&&this.currentGame&&Array.isArray(this.currentGame.periods)&&this.currentGame.periods.length>0&&(i=this.currentGame.periods),i.length>0?this.currentPeriods=i.map(u=>({period_type:u.period_type||u.periodType||(u.is_overtime||u.isOvertime?"overtime":"quarter"),period_number:Number(u.period_number??u.periodNumber??1),team_score:Number(u.team_score??u.teamScore??0),opponent_score:Number(u.opponent_score??u.opponentScore??0),is_overtime:!!(u.is_overtime??u.isOvertime)})):this.currentPeriods=[1,2,3,4].map(u=>({period_type:"quarter",period_number:u,team_score:0,opponent_score:0,is_overtime:!1}));const f=b.getPlayerGameStats(null,e)||[],o=new Map(this.players.map(u=>[String(u.id),u]));f.forEach(u=>{const a=String(u.player_id??u.playerId??"");if(!a||o.has(a))return;const d=s.find(c=>String(c.id)===a);d&&o.set(a,d)}),this.players=[...o.values()],this.currentGameStats=this.players.map(u=>{const a=f.find(d=>String(d.player_id??d.playerId)===String(u.id));return a?{...a}:{player_id:u.id,minutes:0,fg2_made:0,fg2_attempted:0,fg3_made:0,fg3_attempted:0,ft_made:0,ft_attempted:0,off_reb:0,def_reb:0,assists:0,steals:0,blocks_made:0,blocks_received:0,turnovers:0,fouls_committed:0,fouls_drawn:0,plus_minus:0}});let l=b.getGameEvents(e);if((!l||l.length===0)&&e)try{const u=typeof b.loadGameEvents=="function"?await b.loadGameEvents([e]):[];u&&u.length>0&&(l=u.map(a=>{const d=this.players.find(c=>String(c.id)===String(a.player_id));return{id:a.id,playerId:a.player_id,playerName:d?`#${d.jersey??"-"} ${d.first_name||d.firstName||""}`:"Equipo",action:a.action_type,points:a.points||0,period:Number(a.period||1),isOvertime:Number(a.period||1)>4,isOpponent:!a.player_id&&String(a.action_type||"").includes("opp"),coordinates:a.coord_x!==null&&a.coord_y!==null?{x:Number(a.coord_x),y:Number(a.coord_y),made:a.made}:null}}))}catch(u){console.warn("Aviso recuperando game_events:",u)}this.liveEventsHistory=l||[],this.isEditing=!0,this._renderEditForm(r)}_renderEditFormPreservingScroll(e){const r=window.scrollY||document.documentElement.scrollTop;this._renderEditForm(e),window.scrollTo(0,r)}_renderEditForm(e){const r=this.currentGame||{};let t=r.starter_ids||r.starterIds||[];if(typeof t=="string")try{t=JSON.parse(t)}catch{t=[]}const p=this._canEditFullBoxScore();!p&&this.entrySubMode==="classic"&&(this.entrySubMode="fast");let s=0,i=0;this.currentPeriods.forEach(o=>{s+=Number(o.team_score??o.teamScore??0),i+=Number(o.opponent_score??o.opponentScore??0)});const f=this.players.map(o=>{const l=t.includes(o.id);return`
        <button type="button" class="btn-starter ${l?"active":""}" data-id="${o.id}" style="padding: 8px 10px; border-radius: 8px; border: 1px solid ${l?"#f97316":"#cbd5e1"}; background: ${l?"#fff7ed":"#ffffff"}; color: ${l?"#ea580c":"#334155"}; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; justify-content: space-between; align-items: center; min-height: 40px;">
          <span>#${o.jersey??"-"} ${o.first_name||o.firstName||""}</span>
          <span style="font-size: 9px; opacity: 0.8;">${o.primary_position||o.primaryPosition||"Jugador"}</span>
        </button>
      `}).join("");e.innerHTML=`
      <div style="max-width: 1400px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
        
        <style>
          .st-input, .period-input, .meta-input, .live-input-box {
            color: #0f172a !important;
            background-color: #ffffff !important;
            -webkit-text-fill-color: #0f172a !important;
            opacity: 1 !important;
            font-weight: 700 !important;
            box-sizing: border-box !important;
            line-height: normal !important;
            display: inline-block !important;
            visibility: visible !important;
            padding: 0 !important;
            margin: 0 auto !important;
          }
          .st-input {
            width: 38px !important;
            height: 32px !important;
            text-align: center !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 4px !important;
            font-size: 13px !important;
          }
          .period-input {
            width: 44px !important;
            height: 34px !important;
            text-align: center !important;
            font-size: 15px !important;
            font-weight: 900 !important;
            border-radius: 6px !important;
            border: 1px solid #cbd5e1 !important;
          }
          .btn-period-select.active {
            background: #f97316 !important;
            color: #ffffff !important;
          }
        </style>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0;">🏀 ${this.t("edit_game","Editar Partido")}</h1>
            <span style="font-size: 12px; color: #475569;">vs ${r.opponent||r.opponentName||"Rival"} · ${r.date||""}</span>
          </div>
          
          <button id="btn-cancel-edit" style="background: #ffffff; border: 1px solid #cbd5e1; color: #334155; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 40px;">✕ ${this.t("cancel","Cancelar")}</button>
        </div>

        <form id="form-game-editor" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 16px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;">
            <div>
              <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 2px;">${this.t("date","Fecha")}</label>
              <input type="date" name="date" class="meta-input" data-key="date" value="${r.date||""}" style="width: 100%; height: 40px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;" />
            </div>
            <div>
              <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 2px;">${this.t("opponent","Rival")} *</label>
              <input type="text" name="opponent" class="meta-input" data-key="opponent" value="${r.opponent||r.opponentName||""}" required placeholder="Nombre del rival" style="width: 100%; height: 40px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;" />
            </div>
            <div>
              <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 2px;">${this.t("matchday","Jornada")}</label>
              <input type="text" name="round" class="meta-input" data-key="round" value="${r.round||""}" style="width: 100%; height: 40px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;" />
            </div>
            <div>
              <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 2px;">${this.t("venue","Sede")}</label>
              <select name="venue" class="meta-input" data-key="venue" style="width: 100%; height: 40px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff; color: #0f172a; font-size: 12px;">
                <option value="Local" ${r.venue==="Local"||r.is_home||r.isHome?"selected":""}>${this.t("local","Local")}</option>
                <option value="Visitante" ${r.venue==="Visitante"||r.venue==="Away"?"selected":""}>${this.t("visitor","Visitante")}</option>
              </select>
            </div>
            <div>
              <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 2px;">${this.t("arena","Pabellón / Arena")}</label>
              <input type="text" name="venue_name" class="meta-input" data-key="venue_name" value="${r.venue_name||r.venueName||""}" placeholder="Ej: Pavelló JMJ" style="width: 100%; height: 40px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;" />
            </div>
          </div>

          <div>
            <h3 style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin: 0 0 8px 0;">${this.t("starting_five","QUINTETO TITULAR")} (${t.length}/5)</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px;">
              ${f}
            </div>
          </div>

          <!-- SELECTOR DE MODOS -->
          <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; gap: 6px; width: 100%; flex-wrap: wrap;">
              <button type="button" id="btn-mode-court" style="flex: 1; min-height: 40px; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer; border: 1px solid #cbd5e1; background: ${this.entrySubMode==="court"?"#16a34a":"#ffffff"}; color: ${this.entrySubMode==="court"?"#ffffff":"#334155"};">
                🏀 Modo Pista (Visual)
              </button>
              <button type="button" id="btn-mode-fast" style="flex: 1; min-height: 40px; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer; border: 1px solid #cbd5e1; background: ${this.entrySubMode==="fast"?"#0284c7":"#ffffff"}; color: ${this.entrySubMode==="fast"?"#ffffff":"#334155"};">
                ⚡ Modo Rápido (Botones)
              </button>
              ${p?`
                <button type="button" id="btn-mode-classic" style="flex: 1; min-height: 40px; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer; border: 1px solid #cbd5e1; background: ${this.entrySubMode==="classic"?"#0f172a":"#ffffff"}; color: ${this.entrySubMode==="classic"?"#ffffff":"#334155"};">
                  📊 Acta Oficial (Tabla & Cuadre)
                </button>
              `:""}
            </div>
          </div>

          <div id="entry-mode-content-container">
            ${this.entrySubMode==="court"||this.entrySubMode==="fast"?this._renderBSAGraphicalModeMarkup(s,i):this._renderClassicTableMarkup()}
          </div>

          <div id="continuation-dialog-layer">
            ${this._renderContinuationDialog()}
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
            <button type="submit" id="btn-submit-game-all" style="background: var(--color-primary, #f97316); color: #ffffff; border: none; padding: 12px 28px; border-radius: 8px; font-weight: 900; cursor: pointer; min-height: 44px; font-size: 14px; width: 100%; max-width: 320px;">
              💾 ${this.t("save_changes","Guardar Cambios")}
            </button>
          </div>
        </form>
      </div>
    `,this._bindUnifiedFormEvents(e,p,r)}_renderBSAGraphicalModeMarkup(e,r){const t=this.currentPeriods.filter(i=>!i.is_overtime&&!i.isOvertime),p=this.currentPeriods.filter(i=>i.is_overtime||i.isOvertime),s=i=>({fg2_made:"Canasta de 2 (+2 pts)",fg3_made:"Triple (+3 pts)",ft_made:"Tiro Libre (+1 pt)",fg2_attempted:"Tiro de 2 Fallado",fg3_attempted:"Triple Fallado",ft_attempted:"Tiro Libre Fallado",off_reb:"Rebote Ofensivo",def_reb:"Rebote Defensivo",assists:"Asistencia",steals:"Robo de Balón",blocks_made:"Tapón Realizado",turnovers:"Pérdida de Balón",fouls_committed:"Falta Cometida",fouls_drawn:"Falta Recibida"})[i]||i;return`
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: #0f172a; color: #ffffff; border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; gap: 4px; overflow-x: auto; max-width: 100%;">
            ${t.map((i,f)=>`
              <button type="button" class="btn-period-select ${this.activePeriodNumber===f+1&&!this.isPeriodOvertime?"active":""}" data-period="${f+1}" data-ot="false" style="padding: 6px 10px; border-radius: 6px; border: none; font-weight: 800; font-size: 11px; cursor: pointer; background: ${this.activePeriodNumber===f+1&&!this.isPeriodOvertime?"#f97316":"#334155"}; color: #ffffff; white-space: nowrap;">
                Q${f+1} (${i.team_score??i.teamScore??0}-${i.opponent_score??i.opponentScore??0})
              </button>
            `).join("")}

            ${p.map((i,f)=>`
              <button type="button" class="btn-period-select ${this.activePeriodNumber===f+1&&this.isPeriodOvertime?"active":""}" data-period="${f+1}" data-ot="true" style="padding: 6px 10px; border-radius: 6px; border: none; font-weight: 800; font-size: 11px; cursor: pointer; background: ${this.activePeriodNumber===f+1&&this.isPeriodOvertime?"#f97316":"#475569"}; color: #ffffff; white-space: nowrap;">
                OT${f+1} (${i.team_score??i.teamScore??0}-${i.opponent_score??i.opponentScore??0})
              </button>
            `).join("")}
            
            <button type="button" id="btn-add-overtime" style="padding: 6px 10px; border-radius: 6px; border: 1px dashed #94a3b8; font-weight: 800; font-size: 11px; cursor: pointer; background: transparent; color: #cbd5e1; white-space: nowrap;">
              + OT
            </button>
          </div>

          <div style="font-size: 13px; font-weight: 800;">
            Total: <span style="color: #38bdf8;">${e}</span> - <span style="color: #f43f5e;">${r}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
          <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px;">
            <h3 style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; text-transform: uppercase;">1️⃣ Elige Jugador Activo</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(75px, 1fr)); gap: 6px;">
              ${this.players.map(i=>{const f=this.currentGameStats.find(l=>String(l.player_id??l.playerId)===String(i.id))||{minutes:0},o=Number(f.minutes??f.minutesPlayed??0);return`
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <button type="button" class="live-player-btn ${this.selectedPlayerId===i.id?"active":""}" 
                            data-id="${i.id}" data-name="#${i.jersey??"-"} ${i.first_name||i.firstName||""}"
                            style="display: flex; flex-direction: column; align-items: center; padding: 6px 2px; border: 2px solid ${this.selectedPlayerId===i.id?"#0284c7":"#e2e8f0"}; background: ${this.selectedPlayerId===i.id?"#e0f2fe":"#f8fafc"}; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 1.1rem; font-weight: 900; color: #0f172a;">#${i.jersey??"-"}</span>
                      <span style="font-size: 0.7rem; font-weight: 700; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70px;">${i.first_name||i.firstName||i.name}</span>
                    </button>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                      <span style="font-size: 0.65rem; color: #475569; font-weight: 800;">MIN</span>
                      <input type="number" class="st-input" data-player-id="${i.id}" data-field="minutes" value="${o}" style="width: 38px; height: 26px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.75rem; font-weight: 800; color: #0f172a !important; background: #ffffff !important;" />
                    </div>
                  </div>
                `}).join("")}
            </div>
          </div>

          ${this.entrySubMode==="court"?`
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; align-items: center;">
              <div style="font-size: 11px; font-weight: 800; color: #334155; margin-bottom: 6px; width: 100%; display: flex; justify-content: space-between;">
                <span>📍 Toca en la Cancha</span>
                <span id="court-shot-hint" style="color: #0284c7;">Paso 2: Toca el punto exacto</span>
              </div>
              <div style="position: relative; width: 100%; max-width: 380px; aspect-ratio: 50/47; background: #e09f67; border: 3px solid #ffffff; border-radius: 8px; overflow: hidden; cursor: crosshair;" id="court-canvas-clickarea">
                <svg viewBox="0 0 500 470" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; pointer-events: none;">
                  <rect x="0" y="0" width="500" height="470" fill="none" stroke="#fff" stroke-width="4"/>
                  <rect x="170" y="0" width="160" height="190" fill="rgba(255,255,255,0.15)" stroke="#fff" stroke-width="3"/>
                  <path d="M 170 190 A 80 80 0 0 0 330 190" fill="none" stroke="#fff" stroke-width="3"/>
                  <line x1="220" y1="40" x2="280" y2="40" stroke="#fff" stroke-width="4"/>
                  <circle cx="250" cy="52" r="15" fill="none" stroke="#ff5722" stroke-width="4"/>
                  <path d="M 215 52 A 35 35 0 0 0 285 52" fill="none" stroke="#fff" stroke-width="2"/>
                  <line x1="30" y1="0" x2="30" y2="140" stroke="#fff" stroke-width="3"/>
                  <line x1="470" y1="0" x2="470" y2="140" stroke="#fff" stroke-width="3"/>
                  <path d="M 30 140 A 235 235 0 0 0 470 140" fill="none" stroke="#fff" stroke-width="3"/>
                </svg>
                <div id="live-shot-markers-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
                  ${this.liveEventsHistory.filter(i=>i.coordinates).map(i=>`
                    <div style="position: absolute; left: ${i.coordinates.x}%; top: ${i.coordinates.y}%; transform: translate(-50%, -50%); width: 12px; height: 12px; border-radius: 50%; background: ${i.coordinates.made?"#22c55e":"#ef4444"}; border: 2px solid #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.5);"></div>
                  `).join("")}
                </div>
              </div>
            </div>
          `:""}

          <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
            <h3 style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">2️⃣ Registrar Acción</h3>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              <button type="button" class="btn-live-court-outcome" data-made="true" style="background: #22c55e; color: #ffffff; border: none; padding: 10px 4px; border-radius: 8px; font-weight: 900; font-size: 0.9rem; cursor: pointer;">✔ ANOTADO</button>
              <button type="button" class="btn-live-court-outcome" data-made="false" style="background: #ef4444; color: #ffffff; border: none; padding: 10px 4px; border-radius: 8px; font-weight: 900; font-size: 0.9rem; cursor: pointer;">✖ FALLADO</button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #f8fafc; padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <button type="button" class="btn-court-ft" data-made="true" style="background: #84cc16; color: #ffffff; border: none; padding: 8px 4px; border-radius: 4px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">+1 TL Anotado</button>
              <button type="button" class="btn-court-ft" data-made="false" style="background: #fca5a5; color: #7f1d1d; border: none; padding: 8px 4px; border-radius: 4px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">Fallo TL</button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
              <button type="button" class="btn-fast-action" data-action="off_reb" style="background: #0284c7; color: #ffffff; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Reb Of</button>
              <button type="button" class="btn-fast-action" data-action="def_reb" style="background: #38bdf8; color: #0f172a; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Reb Def</button>
              <button type="button" class="btn-fast-action" data-action="assists" style="background: #6366f1; color: #ffffff; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Asistencia</button>
              <button type="button" class="btn-fast-action" data-action="steals" style="background: #8b5cf6; color: #ffffff; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Robo</button>
              <button type="button" class="btn-fast-action" data-action="blocks_made" style="background: #a855f7; color: #ffffff; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Tapón</button>
              <button type="button" class="btn-fast-action" data-action="turnovers" style="background: #ea580c; color: #ffffff; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Pérdida</button>
              <button type="button" class="btn-fast-action" data-action="fouls_committed" style="background: #f59e0b; color: #ffffff; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Falta Com.</button>
              <button type="button" class="btn-fast-action" data-action="fouls_drawn" style="background: #fbbf24; color: #78350f; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Falta Rec.</button>
            </div>

            <div style="background: #fff7ed; padding: 6px; border-radius: 6px; border: 1px solid #ffedd5; display: flex; flex-direction: column; gap: 4px;">
              <span style="font-size: 9px; font-weight: 800; color: #c2410c; text-transform: uppercase;">Estadísticas del Rival</span>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
                <button type="button" class="btn-opp-action" data-field="points" data-val="2" style="background: #ea580c; color: #ffffff; border: none; padding: 6px 2px; border-radius: 4px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">+2 Rival</button>
                <button type="button" class="btn-opp-action" data-field="points" data-val="3" style="background: #c2410c; color: #ffffff; border: none; padding: 6px 2px; border-radius: 4px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">+3 Rival</button>
                <button type="button" class="btn-opp-action" data-field="points" data-val="1" style="background: #f97316; color: #ffffff; border: none; padding: 6px 2px; border-radius: 4px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">+1 TL Riv</button>
                <button type="button" class="btn-opp-action" data-field="tov" style="background: #fed7aa; color: #9a3412; border: none; padding: 6px 2px; border-radius: 4px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">Pérdida Riv</button>
                <button type="button" class="btn-opp-action" data-field="oreb" style="background: #fed7aa; color: #9a3412; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Reb Of Riv</button>
                <button type="button" class="btn-opp-action" data-field="dreb" style="background: #fed7aa; color: #9a3412; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Reb Def Riv</button>
                <button type="button" class="btn-opp-action" data-field="blk_made" style="background: #fed7aa; color: #9a3412; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Tapón Riv</button>
                <button type="button" class="btn-opp-action" data-field="fouls" style="background: #fed7aa; color: #9a3412; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Falta Riv</button>
              </div>
            </div>
          </div>
        </div>

        <section style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div>
              <h3 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #0f172a;">📋 Historial de Jugadas Registradas (${this.liveEventsHistory.length})</h3>
              <span style="font-size: 0.75rem; color: #475569;">Listado cronológico de acciones del partido</span>
            </div>
            <button type="button" id="btn-clear-all-events" style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">
              Vaciar Jugadas
            </button>
          </div>

          <div style="max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
            ${this.liveEventsHistory.length===0?`
              <div style="padding: 20px; text-align: center; color: #64748b; font-size: 0.85rem;">
                No hay jugadas registradas todavía. Selecciona un jugador y pulsa su acción.
              </div>
            `:`
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                <thead style="background: #f8fafc; color: #334155; position: sticky; top: 0; z-index: 5;">
                  <tr style="border-bottom: 1px solid #cbd5e1;">
                    <th style="padding: 6px 8px;">#</th>
                    <th style="padding: 6px 8px;">Periodo</th>
                    <th style="padding: 6px 8px;">Jugador / Equipo</th>
                    <th style="padding: 6px 8px;">Acción Realizada</th>
                    <th style="padding: 6px 8px; text-align: right;">Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  ${[...this.liveEventsHistory].reverse().map((i,f)=>{const o=this.liveEventsHistory.length-1-f;return`
                      <tr style="border-bottom: 1px solid #f1f5f9; background: ${i.isOpponent?"#fff7ed":"#ffffff"};">
                        <td style="padding: 6px 8px; color: #64748b; font-weight: 700;">${this.liveEventsHistory.length-f}</td>
                        <td style="padding: 6px 8px;">
                          <span style="background: #e2e8f0; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 0.75rem;">
                            ${i.isOvertime?"OT":"Q"}${i.period}
                          </span>
                        </td>
                        <td style="padding: 6px 8px; font-weight: 800; color: #0f172a;">
                          ${i.isOpponent?"🔴 Rival":i.playerName||"Jugador"}
                        </td>
                        <td style="padding: 6px 8px; color: #334155;">
                          ${i.isOpponent?`Acción Rival: ${i.field||i.action_type}`:s(i.action||i.action_type)}
                        </td>
                        <td style="padding: 6px 8px; text-align: right;">
                          <button type="button" class="btn-delete-single-event" data-idx="${o}" style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
                            🗑️ Borrar
                          </button>
                        </td>
                      </tr>
                    `}).join("")}
                </tbody>
              </table>
            `}
          </div>
        </section>
      </div>
    `}_renderContinuationDialog(){if(!this.continuationDialog)return"";const{type:e,shooterName:r}=this.continuationDialog;return e==="shot_missed"?`
        <div class="game-continuation-overlay" style="position: fixed; inset: 0; background: rgba(15,23,42,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;">
          <div class="game-continuation-card" style="background: #ffffff; border-radius: 14px; padding: 20px; max-width: 440px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.3); text-align: center;">
            <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 900; color: #0f172a;">🏀 Tiro Fallado por ${r}</h3>
            <p style="font-size: 12px; color: #475569; margin: 0 0 14px 0;">¿Quién capturó el rebote?</p>
            
            <div style="margin-bottom: 12px;">
              <button type="button" id="btn-cont-opp-dreb" style="width: 100%; background: #fed7aa; color: #9a3412; border: none; padding: 10px; border-radius: 8px; font-weight: 900; cursor: pointer; font-size: 12px; margin-bottom: 10px;">
                🛡️ Rebote Defensivo Rival
              </button>

              <div style="font-size: 11px; font-weight: 800; color: #0284c7; margin-bottom: 6px; text-transform: uppercase;">Rebote Ofensivo de Nuestro Equipo:</div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 6px; max-height: 140px; overflow-y: auto;">
                ${this.players.map(t=>`
                  <button type="button" class="btn-cont-oreb-player" data-id="${t.id}" data-name="#${t.jersey??"-"} ${t.first_name||t.firstName}" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 6px 2px; border-radius: 6px; font-size: 10px; font-weight: 800; cursor: pointer;">
                    #${t.jersey??"-"} ${t.first_name||t.firstName}
                  </button>
                `).join("")}
              </div>
            </div>

            <button type="button" id="btn-close-continuation" style="background: #f1f5f9; border: none; padding: 8px 16px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer;">
              Omitir / No registrar rebote
            </button>
          </div>
        </div>
      `:e==="shot_made"?`
        <div class="game-continuation-overlay" style="position: fixed; inset: 0; background: rgba(15,23,42,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;">
          <div class="game-continuation-card" style="background: #ffffff; border-radius: 14px; padding: 20px; max-width: 440px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.3); text-align: center;">
            <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 900; color: #16a34a;">🎯 ¡Canasta de ${r}!</h3>
            <p style="font-size: 12px; color: #475569; margin: 0 0 14px 0;">¿Hubo asistencia de algún compañero?</p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 6px; margin-bottom: 14px; max-height: 160px; overflow-y: auto;">
              ${this.players.filter(t=>t.id!==this.continuationDialog.shooterId).map(t=>`
                <button type="button" class="btn-cont-ast-player" data-id="${t.id}" data-name="#${t.jersey??"-"} ${t.first_name||t.firstName}" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 6px 2px; border-radius: 6px; font-size: 10px; font-weight: 800; cursor: pointer;">
                  #${t.jersey??"-"} ${t.first_name||t.firstName}
                </button>
              `).join("")}
            </div>

            <button type="button" id="btn-close-continuation" style="background: #f1f5f9; border: none; padding: 8px 16px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer;">
              Sin Asistencia
            </button>
          </div>
        </div>
      `:""}_renderClassicTableMarkup(){let e=0,r=0;this.currentPeriods.forEach(o=>{e+=Number(o.team_score??o.teamScore??0),r+=Number(o.opponent_score??o.opponentScore??0)});let t=0;this.currentGameStats.forEach(o=>{const l=Number(o.fg2_made||0)*2+Number(o.fg3_made||0)*3+Number(o.ft_made||0);t+=l});const p=e===t,s=t-e,i=this.currentPeriods.filter(o=>!o.is_overtime&&!o.isOvertime),f=this.currentPeriods.filter(o=>o.is_overtime||o.isOvertime);return`
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 13px; font-weight: 900; color: #0f172a;">⏱️ Desglose de Puntos por Cuartos</span>
              <span style="font-size: 11px; color: #475569;">(Introduce los parciales del acta oficial)</span>
            </div>

            <div style="padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; ${p?"background: #dcfce7; color: #15803d; border: 1px solid #86efac;":"background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5;"}">
              ${p?`✅ Puntos Cuadrados: Jugadores (${t}) = Cuartos (${e})`:`⚠️ Descuadre de Puntos: Jugadores (${t}) ≠ Cuartos (${e}) [Dif: ${s>0?"+"+s:s} pts]`}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px;">
            ${i.map((o,l)=>`
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 8px; text-align: center;">
                <div style="font-size: 10px; font-weight: 800; color: #475569; margin-bottom: 4px;">Cuarto ${l+1} (Q${l+1})</div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                  <input type="number" class="period-input" data-period-idx="${l}" data-side="team" value="${o.team_score??o.teamScore??0}" min="0" style="color: #1e40af !important; background: #eff6ff !important;" />
                  <span style="font-weight: 900; color: #94a3b8;">-</span>
                  <input type="number" class="period-input" data-period-idx="${l}" data-side="opp" value="${o.opponent_score??o.opponentScore??0}" min="0" style="color: #b91c1c !important; background: #fef2f2 !important;" />
                </div>
              </div>
            `).join("")}

            ${f.map((o,l)=>`
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 8px; text-align: center;">
                <div style="font-size: 10px; font-weight: 800; color: #f97316; margin-bottom: 4px;">Prórroga (OT${l+1})</div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                  <input type="number" class="period-input" data-period-idx="${i.length+l}" data-side="team" value="${o.team_score??o.teamScore??0}" min="0" style="color: #1e40af !important; background: #eff6ff !important;" />
                  <span style="font-weight: 900; color: #94a3b8;">-</span>
                  <input type="number" class="period-input" data-period-idx="${i.length+l}" data-side="opp" value="${o.opponent_score??o.opponentScore??0}" min="0" style="color: #b91c1c !important; background: #fef2f2 !important;" />
                </div>
              </div>
            `).join("")}

            <div style="background: #0f172a; color: #ffffff; border-radius: 8px; padding: 6px 8px; text-align: center; display: flex; flex-direction: column; justify-content: center;">
              <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Marcador Final</div>
              <div style="font-size: 15px; font-weight: 900;">
                <span style="color: #38bdf8;">${e}</span> - <span style="color: #f87171;">${r}</span>
              </div>
            </div>
          </div>
        </div>

        <div style="overflow-x: auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: center;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #334155; font-weight: 800;">
                <th style="padding: 8px; text-align: left;">Jugador</th>
                <th style="padding: 8px;">MIN</th>
                <th style="padding: 8px; background: #eff6ff; color: #1e40af; font-weight: 900;">PTS</th>
                <th style="padding: 8px;">T2C</th><th style="padding: 8px;">T2I</th>
                <th style="padding: 8px;">T3C</th><th style="padding: 8px;">T3I</th>
                <th style="padding: 8px;">TLC</th><th style="padding: 8px;">TLI</th>
                <th style="padding: 8px;">RO</th><th style="padding: 8px;">RD</th>
                <th style="padding: 8px;">AST</th><th style="padding: 8px;">ROB</th><th style="padding: 8px;">TAP</th>
                <th style="padding: 8px;">PER</th><th style="padding: 8px;">FC</th><th style="padding: 8px;">FR</th>
                <th style="padding: 8px; background: #fefce8; color: #854d0e; font-weight: 900;">VAL</th>
              </tr>
            </thead>
            <tbody>
              ${this.players.map(o=>{const l=this.currentGameStats.find(y=>String(y.player_id??y.playerId)===String(o.id))||{},N=Number(l.minutes??l.minutesPlayed??0),L=Number(l.fg2_made??l.fg2Made??0),E=Number(l.fg2_attempted??l.fg2Attempted??0),P=Number(l.fg3_made??l.fg3Made??0),u=Number(l.fg3_attempted??l.fg3Attempted??0),a=Number(l.ft_made??l.ftMade??0),d=Number(l.ft_attempted??l.ftAttempted??0),c=Number(l.off_reb??l.offReb??0),_=Number(l.def_reb??l.defReb??0),$=Number(l.assists??l.ast??0),S=Number(l.steals??l.stl??0),n=Number(l.blocks??l.blocks_made??l.blk??0),g=Number(l.turnovers??l.tov??0),h=Number(l.fouls_committed??l.fouls??0),w=Number(l.fouls_drawn??l.fouls_received??0),v=l.points!==void 0&&l.points!==null?Number(l.points):L*2+P*3+a,x=Z.calculatePlayerBoxScore({minutes:N,fg2_made:L,fg2_attempted:E,fg3_made:P,fg3_attempted:u,ft_made:a,ft_attempted:d,off_reb:c,def_reb:_,assists:$,steals:S,blocks:n,turnovers:g,fouls_committed:h,fouls_drawn:w,points:v});return`
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 6px 8px; font-weight: 800; text-align: left; white-space: nowrap; color: #0f172a;">
                      #${o.jersey??o.number??"-"} ${o.first_name||o.firstName||""} ${o.last_name||o.lastName||""}
                    </td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="minutes" value="${N}" /></td>
                    
                    <td style="padding: 2px; background: #eff6ff; font-weight: 900; color: #1e40af; font-size: 14px;">${x.points}</td>

                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="fg2_made" value="${L}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="fg2_attempted" value="${E}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="fg3_made" value="${P}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="fg3_attempted" value="${u}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="ft_made" value="${a}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="ft_attempted" value="${d}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="off_reb" value="${c}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="def_reb" value="${_}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="assists" value="${$}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="steals" value="${S}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="blocks_made" value="${n}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="turnovers" value="${g}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="fouls_committed" value="${h}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${o.id}" data-field="fouls_drawn" value="${w}" /></td>
                    
                    <td style="padding: 2px; background: #fefce8; font-weight: 800; color: #854d0e; font-size: 13px;">${x.pir}</td>
                  </tr>
                `}).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `}_bindUnifiedFormEvents(e,r,t){var f,o,l,N,L,E,P,u;e.querySelectorAll(".meta-input").forEach(a=>{a.addEventListener("input",d=>{const c=d.target.getAttribute("data-key");c&&this.currentGame&&(this.currentGame[c]=d.target.value)})}),e.querySelectorAll(".btn-starter").forEach(a=>{a.addEventListener("click",()=>{const d=a.getAttribute("data-id");let c=this.currentGame.starter_ids||this.currentGame.starterIds||[];if(typeof c=="string")try{c=JSON.parse(c)}catch{c=[]}if(c.includes(d))c=c.filter(_=>_!==d);else{if(c.length>=5){alert("⚠️ Ya has seleccionado los 5 titulares reglamentarios.");return}c.push(d)}this.currentGame.starter_ids=c,this.currentGame.starterIds=c,this._renderEditFormPreservingScroll(e)})}),(f=e.querySelector("#btn-mode-court"))==null||f.addEventListener("click",()=>{this.entrySubMode="court",this._renderEditFormPreservingScroll(e)}),(o=e.querySelector("#btn-mode-fast"))==null||o.addEventListener("click",()=>{this.entrySubMode="fast",this._renderEditFormPreservingScroll(e)}),(l=e.querySelector("#btn-mode-classic"))==null||l.addEventListener("click",()=>{this.entrySubMode="classic",this._renderEditFormPreservingScroll(e)});const p=()=>{this.isEditing=!1,this._renderGamesList(e,t.team_id||t.teamId||this.teamId||b.getActiveTeamId())};(N=e.querySelector("#btn-cancel-edit"))==null||N.addEventListener("click",p),e.querySelectorAll(".period-input").forEach(a=>{a.addEventListener("input",d=>{const c=Number(d.target.getAttribute("data-period-idx")),_=d.target.getAttribute("data-side"),$=Number(d.target.value||0);this.currentPeriods[c]&&(_==="team"&&(this.currentPeriods[c].team_score=$),_==="opp"&&(this.currentPeriods[c].opponent_score=$)),this._renderEditFormPreservingScroll(e)})}),e.querySelectorAll(".live-player-btn").forEach(a=>{a.addEventListener("click",()=>{this.selectedPlayerId=a.getAttribute("data-id"),this.selectedPlayerName=a.getAttribute("data-name"),this._renderEditFormPreservingScroll(e)})}),e.querySelectorAll(".st-input").forEach(a=>{a.addEventListener("input",d=>{const c=d.target.getAttribute("data-player-id"),_=d.target.getAttribute("data-field"),$=Number(d.target.value||0),S=this.currentGameStats.find(n=>String(n.player_id??n.playerId)===String(c));S&&(S[_]=$),this.entrySubMode==="classic"&&this._renderEditFormPreservingScroll(e)})}),e.querySelectorAll(".btn-period-select").forEach(a=>{a.addEventListener("click",()=>{this.activePeriodNumber=Number(a.getAttribute("data-period")),this.isPeriodOvertime=a.getAttribute("data-ot")==="true",this._renderEditFormPreservingScroll(e)})}),(L=e.querySelector("#btn-add-overtime"))==null||L.addEventListener("click",()=>{const a=this.currentPeriods.filter(d=>d.is_overtime||d.isOvertime).length+1;this.currentPeriods.push({period_type:"overtime",period_number:a,team_score:0,opponent_score:0,is_overtime:!0}),this.activePeriodNumber=a,this.isPeriodOvertime=!0,this._renderEditFormPreservingScroll(e)});const s=e.querySelector("#court-canvas-clickarea");s==null||s.addEventListener("click",a=>{if(!this.selectedPlayerId)return alert("Selecciona primero un jugador");const d=s.getBoundingClientRect(),c=(a.clientX-d.left)/d.width*100,_=(a.clientY-d.top)/d.height*100,$=50,S=11.06,n=(c-$)*5,g=(_-S)*4.7,h=Math.hypot(n,g),w=(c<=6||c>=94)&&_<=29.8,v=h>=235,x=w||v;this.pendingShot={x:parseFloat(c.toFixed(1)),y:parseFloat(_.toFixed(1)),shotType:x?"fg3":"fg2",pts:x?3:2};const y=e.querySelector("#court-shot-hint");y&&(y.innerHTML=`<strong style="color: #16a34a;">${x?"🎯 Triple":"🏀 Tiro 2"} marcado. Pulsa ANOTADO o FALLADO ➔</strong>`)}),e.querySelectorAll(".btn-live-court-outcome").forEach(a=>{a.addEventListener("click",()=>{if(!this.selectedPlayerId)return alert("Selecciona un jugador");if(!this.pendingShot)return alert("Toca primero en la pista");const d=a.getAttribute("data-made")==="true",c=d?`${this.pendingShot.shotType}_made`:`${this.pendingShot.shotType}_attempted`,_=d?this.pendingShot.pts:0,$=this.selectedPlayerId,S=this.selectedPlayerName;this._recordLiveEvent($,S,c,_,{x:this.pendingShot.x,y:this.pendingShot.y,made:d}),this.pendingShot=null,this.continuationDialog={type:d?"shot_made":"shot_missed",shooterId:$,shooterName:S},this._renderEditFormPreservingScroll(e)})}),e.querySelectorAll(".btn-court-ft").forEach(a=>{a.addEventListener("click",()=>{if(!this.selectedPlayerId)return alert("Selecciona un jugador");const d=a.getAttribute("data-made")==="true";this._recordLiveEvent(this.selectedPlayerId,this.selectedPlayerName,d?"ft_made":"ft_attempted",d?1:0,{x:50,y:40.4,made:d})})}),e.querySelectorAll(".btn-fast-action").forEach(a=>{a.addEventListener("click",()=>{if(!this.selectedPlayerId)return alert("Selecciona primero un jugador");const d=a.getAttribute("data-action");let c=null;(d==="off_reb"||d==="def_reb")&&(c={x:50,y:20,made:!0}),this._recordLiveEvent(this.selectedPlayerId,this.selectedPlayerName,d,0,c)})}),e.querySelectorAll(".btn-opp-action").forEach(a=>{a.addEventListener("click",()=>{const d=a.getAttribute("data-field"),c=parseInt(a.getAttribute("data-val")||"1",10);this._recordOpponentEvent(d,c)})}),(E=e.querySelector("#btn-cont-opp-dreb"))==null||E.addEventListener("click",()=>{this._recordOpponentEvent("dreb",1),this.continuationDialog=null,this._renderEditFormPreservingScroll(e)}),e.querySelectorAll(".btn-cont-oreb-player").forEach(a=>{a.addEventListener("click",()=>{const d=a.getAttribute("data-id"),c=a.getAttribute("data-name");this._recordLiveEvent(d,c,"off_reb",0,{x:50,y:20,made:!0}),this.continuationDialog=null,this._renderEditFormPreservingScroll(e)})}),e.querySelectorAll(".btn-cont-ast-player").forEach(a=>{a.addEventListener("click",()=>{const d=a.getAttribute("data-id"),c=a.getAttribute("data-name");this._recordLiveEvent(d,c,"assists",0,null),this.continuationDialog=null,this._renderEditFormPreservingScroll(e)})}),(P=e.querySelector("#btn-close-continuation"))==null||P.addEventListener("click",()=>{this.continuationDialog=null,this._renderEditFormPreservingScroll(e)}),e.querySelectorAll(".btn-delete-single-event").forEach(a=>{a.addEventListener("click",d=>{const c=Number(d.currentTarget.getAttribute("data-idx"));this._removeSingleLiveEvent(c,e)})}),(u=e.querySelector("#btn-clear-all-events"))==null||u.addEventListener("click",()=>{var a;confirm("⚠️ ¿Deseas vaciar todas las jugadas del partido actual?")&&(this.liveEventsHistory=[],(a=this.currentGame)!=null&&a.id&&localStorage.removeItem(`iq_game_events_${this.currentGame.id}`),this._renderEditFormPreservingScroll(e))});const i=e.querySelector("#form-game-editor");i==null||i.addEventListener("submit",async a=>{var w,v,x,y,I,q,M,V,C,F,D,j,T,z,R;a.preventDefault();const d=e.querySelector("#btn-submit-game-all");d&&(d.disabled=!0,d.textContent="⏳ Guardando partido...");const c=new FormData(i);let _=0,$=0;this.currentPeriods.forEach(m=>{_+=Number(m.team_score??m.teamScore??0),$+=Number(m.opponent_score??m.opponentScore??0)});const S=t.team_id||t.teamId||this.teamId||b.getActiveTeamId(),n=b.getActiveSeasonId(),g={team_id:S,season_id:n,date:c.get("date")||((w=this.currentGame)==null?void 0:w.date)||new Date().toISOString().split("T")[0],time:c.get("time")||((v=this.currentGame)==null?void 0:v.time)||"18:00",opponent:c.get("opponent")||((x=this.currentGame)==null?void 0:x.opponent)||((y=this.currentGame)==null?void 0:y.opponentName)||"Rival",competition:c.get("competition")||((I=this.currentGame)==null?void 0:I.competition)||"Liga",round:c.get("round")||((q=this.currentGame)==null?void 0:q.round)||"Jornada 1",venue:c.get("venue")||((M=this.currentGame)==null?void 0:M.venue)||"Local",venue_name:c.get("venue_name")||((V=this.currentGame)==null?void 0:V.venue_name)||((C=this.currentGame)==null?void 0:C.venueName)||"",status:c.get("status")||((F=this.currentGame)==null?void 0:F.status)||"Finalizado",starter_ids:((D=this.currentGame)==null?void 0:D.starter_ids)||((j=this.currentGame)==null?void 0:j.starterIds)||[],team_score:_,opponent_score:$,notes:c.get("notes")||((T=this.currentGame)==null?void 0:T.notes)||"",video_url:c.get("video_url")||((z=this.currentGame)==null?void 0:z.video_url)||((R=this.currentGame)==null?void 0:R.videoUrl)||""};t.id&&(g.id=t.id);const h=this.liveEventsHistory.map((m,J)=>{var H,O,k;const B=m.playerId||m.player_id||null,A=m.action||m.action_type||m.field||"fg2_attempted";return{id:m.id||this._generateUUID(),player_id:B,playerId:B,playerName:m.playerName||"",period:Number(m.period||1),action_type:A,action:A,event_type:A,points:Number(m.points||0),is_opponent:!!m.isOpponent,isOpponent:!!m.isOpponent,made:!!((H=m.coordinates)!=null&&H.made||m.made),coord_x:((O=m.coordinates)==null?void 0:O.x)!==void 0?parseFloat(Number(m.coordinates.x).toFixed(2)):m.coord_x!==void 0?parseFloat(Number(m.coord_x).toFixed(2)):null,coord_y:((k=m.coordinates)==null?void 0:k.y)!==void 0?parseFloat(Number(m.coordinates.y).toFixed(2)):m.coord_y!==void 0?parseFloat(Number(m.coord_y).toFixed(2)):null}});try{const m=await b.saveGameAndStats(g,this.currentGameStats,this.currentPeriods,h);localStorage.setItem(`iq_game_events_${m}`,JSON.stringify(h)),await b.init(S,!0),this.isEditing=!1,alert("✅ "+this.t("game_saved_msg","Partido guardado exitosamente con cuartos, estadísticas y mapa de calor sincronizados.")),this._renderGamesList(e,S)}catch(m){console.error("Error guardando partido:",m),alert(`❌ Error al guardar partido: ${m.message||m}`),d&&(d.disabled=!1,d.textContent="💾 Guardar Cambios")}})}_recordLiveEvent(e,r,t,p,s){var f;const i=this.currentGameStats.find(o=>String(o.player_id??o.playerId)===String(e));if(i&&(t==="fg2_made"?(i.fg2_made=(i.fg2_made||0)+1,i.fg2_attempted=(i.fg2_attempted||0)+1):t==="fg3_made"?(i.fg3_made=(i.fg3_made||0)+1,i.fg3_attempted=(i.fg3_attempted||0)+1):t==="ft_made"?(i.ft_made=(i.ft_made||0)+1,i.ft_attempted=(i.ft_attempted||0)+1):t==="fg2_attempted"?i.fg2_attempted=(i.fg2_attempted||0)+1:t==="fg3_attempted"?i.fg3_attempted=(i.fg3_attempted||0)+1:t==="ft_attempted"?i.ft_attempted=(i.ft_attempted||0)+1:t==="blocks_made"?i.blocks_made=(i.blocks_made||0)+1:t==="fouls_drawn"?i.fouls_drawn=(i.fouls_drawn||0)+1:i[t]=(i[t]||0)+1),p>0){const o=this.currentPeriods.find(l=>l.period_number===this.activePeriodNumber&&!!l.is_overtime===this.isPeriodOvertime);o&&(o.team_score=(o.team_score||0)+p)}this.liveEventsHistory.push({id:this._generateUUID(),timestamp:Date.now(),playerId:e,playerName:r,action:t,points:p,period:this.activePeriodNumber,isOvertime:this.isPeriodOvertime,coordinates:s}),(f=this.currentGame)!=null&&f.id&&localStorage.setItem(`iq_game_events_${this.currentGame.id}`,JSON.stringify(this.liveEventsHistory)),this.selectedPlayerId=null,this.selectedPlayerName=null,this._renderEditFormPreservingScroll(document.getElementById("dashboard-content-area"))}_recordOpponentEvent(e,r){var p;const t=this.currentPeriods.find(s=>s.period_number===this.activePeriodNumber&&!!s.is_overtime===this.isPeriodOvertime);e==="points"?t&&(t.opponent_score=(t.opponent_score||0)+r):this.opponentStats[e]=(this.opponentStats[e]||0)+1,this.liveEventsHistory.push({id:this._generateUUID(),timestamp:Date.now(),isOpponent:!0,field:e,action:`opp_${e}`,points:e==="points"?r:0,period:this.activePeriodNumber,isOvertime:this.isPeriodOvertime}),(p=this.currentGame)!=null&&p.id&&localStorage.setItem(`iq_game_events_${this.currentGame.id}`,JSON.stringify(this.liveEventsHistory)),this._renderEditFormPreservingScroll(document.getElementById("dashboard-content-area"))}_removeSingleLiveEvent(e,r){var p;if(e<0||e>=this.liveEventsHistory.length)return;const[t]=this.liveEventsHistory.splice(e,1);if(t.isOpponent)if(t.field==="points"){const s=this.currentPeriods.find(i=>i.period_number===t.period&&!!i.is_overtime===t.isOvertime);s&&(s.opponent_score=Math.max(0,(s.opponent_score||0)-t.points))}else this.opponentStats[t.field]=Math.max(0,(this.opponentStats[t.field]||0)-1);else{const s=this.currentGameStats.find(i=>String(i.player_id??i.playerId)===String(t.playerId));if(s&&(t.action==="fg2_made"?(s.fg2_made=Math.max(0,s.fg2_made-1),s.fg2_attempted=Math.max(0,s.fg2_attempted-1)):t.action==="fg3_made"?(s.fg3_made=Math.max(0,s.fg3_made-1),s.fg3_attempted=Math.max(0,s.fg3_attempted-1)):t.action==="ft_made"?(s.ft_made=Math.max(0,s.ft_made-1),s.ft_attempted=Math.max(0,s.ft_attempted-1)):t.action==="fg2_attempted"?s.fg2_attempted=Math.max(0,s.fg2_attempted-1):t.action==="fg3_attempted"?s.fg3_attempted=Math.max(0,s.fg3_attempted-1):t.action==="ft_attempted"?s.ft_attempted=Math.max(0,s.ft_attempted-1):t.action==="blocks_made"?s.blocks_made=Math.max(0,s.blocks_made-1):t.action==="fouls_drawn"?s.fouls_drawn=Math.max(0,s.fouls_drawn-1):s[t.action]!==void 0&&(s[t.action]=Math.max(0,s[t.action]-1))),t.points>0){const i=this.currentPeriods.find(f=>f.period_number===t.period&&!!f.is_overtime===t.isOvertime);i&&(i.team_score=Math.max(0,(i.team_score||0)-t.points))}}(p=this.currentGame)!=null&&p.id&&localStorage.setItem(`iq_game_events_${this.currentGame.id}`,JSON.stringify(this.liveEventsHistory)),this._renderEditFormPreservingScroll(r)}}export{oe as GameLiveEditorView};
