import{T as A,I,D as p,S as k,B as L}from"./index-Co3VTdK8.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";class D{constructor(o=null,e=null){this.supabase=(o==null?void 0:o.supabase)||(o==null?void 0:o.default)||o,this.auth=e,this.sortState={column:"jersey",ascending:!0},this.cachedPlayers=[]}t(o,e=""){return(A?A.t(o,e):I.t(o,e))||e}_fetchTeamData(o){var e,n,s,r,a,i,f,c,m,b;try{const l=o||p.getActiveTeamId(),d=p.getTeamById(l)||{},v=((n=(e=p).getActiveSeasonDisplayName)==null?void 0:n.call(e,l))||((r=(s=p).getActiveSeason)==null?void 0:r.call(s))||"Sin temporada",h=((i=(a=p).getGamesForActiveSeason)==null?void 0:i.call(a,l))||p.getGames(l)||[],C=((c=(f=p).getSeasonParticipantPlayers)==null?void 0:c.call(f,l))||p.getPlayers(l)||[],N=new Set(h.map(t=>String(t.id))),w=(p.getPlayerGameStats()||[]).filter(t=>N.has(String(t.game_id||t.gameId||""))),$={id:l,name:d.name||"Equipo",category:d.category||"General",competition:d.competition||"Liga",coach_name:((b=(m=p).getTeamCoach)==null?void 0:b.call(m,l,v))||d.coach_name||d.coachName||d.coach||"Por definir",periods_count:d.periods_count||4,period_minutes:d.period_minutes||10,color:d.primary_color||d.color||"#1e3a8a"},S=k&&typeof k.filterPlayedGames=="function"?k.filterPlayedGames(h):h.filter(t=>{const y=t.team_score??t.teamScore??t.our_score??null,g=t.opponent_score??t.opponentScore??t.opp_score??null;return y!==null&&g!==null&&(Number(y)>0||Number(g)>0)});let x=0,u=0;S.forEach(t=>{const y=Number(t.team_score??t.teamScore??t.our_score??t.points??0),g=Number(t.opponent_score??t.opponentScore??t.opp_score??t.opp_points??0);y>g?x++:y<g&&u++});const P=(C||[]).map(t=>{const y=(w||[]).filter(_=>String(_.player_id??_.playerId)===String(t.id)),g=y.length;let T=0;y.forEach(_=>{const E=L.calculatePlayerBoxScore(_);T+=E.points||0});const z=g>0?Number((T/g).toFixed(1)):t.ppg!==void 0&&t.ppg!==null?Number(t.ppg):0;return{...t,id:t.id,fullName:`${t.first_name||t.firstName||""} ${t.last_name||t.lastName||""}`.trim()||t.name||this.t("player","Jugador"),jerseyNum:t.jersey!==void 0&&t.jersey!==null&&t.jersey!==""?Number(t.jersey):t.number?Number(t.number):99,position:t.primary_position||t.primaryPosition||t.position||"Alero",statusTxt:String(t.status||"Activo").trim(),heightCm:t.height_cm?Number(t.height_cm):t.heightCm?Number(t.heightCm):t.height?Number(String(t.height).replace(/[^\d]/g,"")):null,ppg:z}});return{team:$,wins:x,losses:u,totalGames:h.length,players:P,isSuccess:!0}}catch(l){return console.error("[TeamStatsView] Error leyendo datos:",l),{isSuccess:!1,team:{},wins:0,losses:0,totalGames:0,players:[]}}}_sortPlayers(o){const{column:e,ascending:n}=this.sortState,s=n?1:-1;return[...o].sort((r,a)=>{switch(e){case"jersey":return s*(r.jerseyNum-a.jerseyNum);case"name":return s*r.fullName.localeCompare(a.fullName);case"position":return s*r.position.localeCompare(a.position);case"status":return s*r.statusTxt.localeCompare(a.statusTxt);case"height":return s*((r.heightCm||0)-(a.heightCm||0));case"ppg":return s*(r.ppg-a.ppg);default:return 0}})}_renderPlayerRows(o){return!o||o.length===0?`<tr><td colspan="6" style="padding: 20px; text-align: center; color: #64748b;">${this.t("no_players_loaded","No hay jugadores cargados en la plantilla.")}</td></tr>`:o.map(e=>{const n=e.heightCm?`${e.heightCm} cm`:e.height||"—",s=e.statusTxt.toLowerCase()==="activo"||e.statusTxt.toLowerCase()==="active",r=e.photo_url||e.photoUrl||"",a=r?`<img src="${r}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 1px solid #cbd5e1; flex-shrink: 0;" />`:`<div style="width: 42px; height: 42px; background: #1e3a8a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; flex-shrink: 0;">#${e.jerseyNum!==99?e.jerseyNum:"-"}</div>`;return`
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px; cursor: pointer;" onclick="window.location.hash='#/player/${e.id}'">
          <td style="padding: 12px; font-weight: 800; color: #0f172a;">#${e.jerseyNum!==99?e.jerseyNum:"-"}</td>
          <td style="padding: 12px; font-weight: 700; color: #0f172a;">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${a}
              <span>${e.fullName}</span>
            </div>
          </td>
          <td style="padding: 12px; color: #475569;">${e.position}</td>
          <td style="padding: 12px;">
            <span style="background: ${s?"#dcfce7":"#f1f5f9"}; color: ${s?"#15803d":"#64748b"}; padding: 4px 12px; border-radius: 12px; font-weight: 700; font-size: 11px;">
              ${e.statusTxt}
            </span>
          </td>
          <td style="padding: 12px; color: #64748b;">${n}</td>
          <td style="padding: 12px; font-weight: 800; color: var(--color-primary, #f97316);">${e.ppg.toFixed(1)}</td>
        </tr>
      `}).join("")}_renderPlayerCardsMobile(o){return!o||o.length===0?`<div style="padding: 20px; text-align: center; color: #64748b; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">${this.t("no_players_loaded","No hay jugadores cargados en la plantilla.")}</div>`:o.map(e=>{const n=e.statusTxt.toLowerCase()==="activo"||e.statusTxt.toLowerCase()==="active",s=e.photo_url||e.photoUrl||"",r=s?`<img src="${s}" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0; flex-shrink: 0;" />`:`<div style="width: 56px; height: 56px; background: #1e3a8a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; flex-shrink: 0;">#${e.jerseyNum!==99?e.jerseyNum:"-"}</div>`;return`
        <div class="team-player-mobile-card card" onclick="window.location.hash='#/player/${e.id}'" style="padding: 16px; border-radius: 12px; background: white; border: 1px solid #e2e8f0; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            ${r}
            <div>
              <strong style="font-size: 15px; color: #0f172a; display: block;">${e.fullName}</strong>
              <span style="font-size: 12px; color: #64748b; font-weight: 500;">#${e.jerseyNum!==99?e.jerseyNum:"-"} · ${e.position}</span>
            </div>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 18px; font-weight: 900; color: var(--color-primary, #f97316); display: block;">${e.ppg.toFixed(1)} <span style="font-size: 10px; color: #64748b;">PPG</span></span>
            <span style="background: ${n?"#dcfce7":"#f1f5f9"}; color: ${n?"#15803d":"#64748b"}; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700;">${e.statusTxt}</span>
          </div>
        </div>
      `}).join("")}_attachSortEventListeners(o){const e=o.querySelectorAll("[data-sort-player]");e.forEach(n=>{n.addEventListener("click",()=>{const s=n.getAttribute("data-sort-player");this.sortState.column===s?this.sortState.ascending=!this.sortState.ascending:(this.sortState.column=s,this.sortState.ascending=!0);const r=this._sortPlayers(this.cachedPlayers),a=o.querySelector("#roster-table-body");a&&(a.innerHTML=this._renderPlayerRows(r));const i=o.querySelector("#roster-mobile-container");i&&(i.innerHTML=this._renderPlayerCardsMobile(r)),e.forEach(f=>{const c=f.querySelector(".sort-arrow");c&&(f.getAttribute("data-sort-player")===this.sortState.column?(c.textContent=this.sortState.ascending?" ▲":" ▼",c.style.color="#f97316"):(c.textContent=" ↕",c.style.color="#cbd5e1"))})})})}async render(o="dashboard-content-area",e){var w,$,S,x,u,P;let n="dashboard-content-area",s=e;typeof o=="string"?n=o:o&&typeof o=="object"&&(s=o.id||o.teamId);const r=document.getElementById(n)||document.getElementById("main-content")||document.querySelector(".app-main-content")||document.body;if(!r)return;const a=this._fetchTeamData(s),i=a.team||{};this.cachedPlayers=a.players||[];const f=this.cachedPlayers.filter(t=>t.statusTxt.toLowerCase()==="activo"||t.statusTxt.toLowerCase()==="active").length,c=this._sortPlayers(this.cachedPlayers),m=this._renderPlayerRows(c),b=this._renderPlayerCardsMobile(c),l=i.name||"Equipo",d=i.category||"General",v=i.competition||"Liga",h=(($=(w=p).getActiveSeasonDisplayName)==null?void 0:$.call(w,i.id||s))||((x=(S=p).getActiveSeason)==null?void 0:x.call(S))||"Sin temporada",C=((P=(u=p).getTeamCoach)==null?void 0:P.call(u,i.id||s,h))||i.coach_name||"Por definir",N=i.periods_count?`${i.periods_count} × ${i.period_minutes||10} min`:"4 × 10 min",j=i.color||"#1e3a8a";r.innerHTML=`
      <div style="display: flex; flex-direction: column; gap: 24px; font-family: var(--font-family-base, system-ui); max-width: 1400px; margin: 0 auto; padding-bottom: 40px;">
        
        <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">${this.t("team","Equipo")}</h1>

        <!-- Tarjeta Principal del Equipo -->
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
          <div style="width: 64px; height: 64px; background: ${j}; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: white; font-size: 28px; flex-shrink: 0;">
            🏀
          </div>
          <div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">${l}</h2>
            <p style="margin: 4px 0 8px 0; font-size: 12px; color: #64748b;">${l}</p>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <span style="background: #dbeafe; color: #1e40af; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;">${d}</span>
              <span style="background: #ffedd5; color: #c2410c; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;">${v}</span>
            </div>
          </div>
        </div>

        <!-- Rejilla de Métricas Rápidas -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px;">
          
          <div class="team-stat-card card" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 10px; font-weight: 800; color: #64748b;">🏆 ${this.t("record","BALANCE").toUpperCase()}</span>
            <span style="font-size: 22px; font-weight: 900; margin-top: 4px;">
              <strong style="color: #16a34a;">${a.wins}W</strong> - <strong style="color: #dc2626;">${a.losses}L</strong>
            </span>
          </div>

          <div class="team-stat-card card" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 10px; font-weight: 800; color: #64748b;">📅 ${this.t("games","PARTIDOS").toUpperCase()}</span>
            <span style="font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 4px;">${a.totalGames}</span>
          </div>

          <div class="team-stat-card card" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 10px; font-weight: 800; color: #64748b;">👥 ${this.t("active_players","JUGADORES ACTIVOS").toUpperCase()}</span>
            <span style="font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 4px;">${f}</span>
          </div>

          <div class="team-stat-card card" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 10px; font-weight: 800; color: #64748b;">📍 ${this.t("season","TEMPORADA").toUpperCase()}</span>
            <span style="font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 4px;">${h}</span>
          </div>

        </div>

        <!-- Tabla de Información del Equipo -->
        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px;">
          <h3 style="font-size: 12px; font-weight: 800; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 0; margin-bottom: 16px;">
            ${this.t("team_info","INFORMACIÓN DEL EQUIPO").toUpperCase()}
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">${this.t("club","Club")}</span>
              <strong style="color: #0f172a;">${l}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">${this.t("category","Categoría")}</span>
              <strong style="color: #0f172a;">${d}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">${this.t("competition","Competición")}</span>
              <strong style="color: #0f172a;">${v}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">${this.t("coach","Entrenador")}</span>
              <strong style="color: #0f172a;">${C}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">${this.t("periods","Periodos")}</span>
              <strong style="color: #0f172a;">${N}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">${this.t("primary_color","Color principal")}</span>
              <strong style="color: #0f172a;">${j}</strong>
            </div>
          </div>
        </div>

        <!-- Tabla de Plantilla -->
        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px;">
          <h3 style="font-size: 12px; font-weight: 800; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 0; margin-bottom: 16px;">
            ${this.t("roster","PLANTILLA").toUpperCase()} (${this.cachedPlayers.length})
          </h3>

          <div class="desktop-only" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 2px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                  <th data-sort-player="jersey" style="padding: 10px 12px; cursor: pointer;">${this.t("jersey","DORSAL").toUpperCase()} <span class="sort-arrow" style="color: #f97316;">▲</span></th>
                  <th data-sort-player="name" style="padding: 10px 12px; cursor: pointer;">${this.t("player","JUGADOR").toUpperCase()} <span class="sort-arrow" style="color: #cbd5e1;">↕</span></th>
                  <th data-sort-player="position" style="padding: 10px 12px; cursor: pointer;">${this.t("position","POSICIÓN").toUpperCase()} <span class="sort-arrow" style="color: #cbd5e1;">↕</span></th>
                  <th data-sort-player="status" style="padding: 10px 12px; cursor: pointer;">${this.t("status","ESTADO").toUpperCase()} <span class="sort-arrow" style="color: #cbd5e1;">↕</span></th>
                  <th data-sort-player="height" style="padding: 10px 12px; cursor: pointer;">${this.t("height","ALTURA").toUpperCase()} <span class="sort-arrow" style="color: #cbd5e1;">↕</span></th>
                  <th data-sort-player="ppg" style="padding: 10px 12px; cursor: pointer;">PPG <span class="sort-arrow" style="color: #cbd5e1;">↕</span></th>
                </tr>
              </thead>
              <tbody id="roster-table-body">
                ${m}
              </tbody>
            </table>
          </div>

          <div id="roster-mobile-container" class="mobile-only" style="display: flex; flex-direction: column; gap: 12px;">
            ${b}
          </div>
        </div>

      </div>

      <style>
        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
        }
      </style>
    `,this._attachSortEventListeners(r)}}export{D as TeamStatsView};
