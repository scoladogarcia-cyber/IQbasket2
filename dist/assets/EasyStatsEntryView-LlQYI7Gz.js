import{T as k,I as E,D as p,P as A,B as $}from"./index-Co3VTdK8.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";class P{constructor(t=null,o=null,a=null,i=null){this.gameController=t,this.authController=o,this.i18n=a,this.gameId=i,this.game=null,this.players=[],this.gameStats=[],this.periodScores=[],this.activeMode="acta",this.selectedPlayerId=null,this.selectedPlayerName=null,this.actionHistory=[],this.pendingShot=null}t(t,o=""){return(k?k.t(t,o):E.t(t,o))||o}_canAccess(t=null){var i,e,d,r,n,l;const o=(t==null?void 0:t.team_id)||(t==null?void 0:t.teamId)||((e=(i=p).getActiveTeamId)==null?void 0:e.call(i))||null,a=(t==null?void 0:t.team_season_id)||(t==null?void 0:t.teamSeasonId)||((r=(d=p).getActiveTeamSeasonId)==null?void 0:r.call(d,o))||null;return!!((l=(n=this.authController)==null?void 0:n.canPreview)!=null&&l.call(n,A.RECORD_LIVE_GAME,{teamId:o,teamSeasonId:a}))}_canEditBoxScore(t=null){var i,e,d,r,n,l;const o=(t==null?void 0:t.team_id)||(t==null?void 0:t.teamId)||((e=(i=p).getActiveTeamId)==null?void 0:e.call(i))||null,a=(t==null?void 0:t.team_season_id)||(t==null?void 0:t.teamSeasonId)||((r=(d=p).getActiveTeamSeasonId)==null?void 0:r.call(d,o))||null;return!!((l=(n=this.authController)==null?void 0:n.canPreview)!=null&&l.call(n,A.EDIT_BOXSCORE,{teamId:o,teamSeasonId:a}))}_isTeamSeasonFrozen(t=null){var i,e,d,r,n,l;const o=t||((i=this.game)==null?void 0:i.team_id)||((e=this.game)==null?void 0:e.teamId)||((r=(d=p).getActiveTeamId)==null?void 0:r.call(d)),a=((l=(n=p).getActiveSeasonContext)==null?void 0:l.call(n,o))||null;return String((a==null?void 0:a.data_status)||(a==null?void 0:a.dataStatus)||"ACTIVE").toUpperCase()==="FROZEN"}async render(t="dashboard-content-area",o=null){var e,d,r,n;const a=typeof t=="string"?document.getElementById(t):t;if(!a)return;this.container=a,o&&(this.gameId=o);const i=p.getGames()||[];if(this.game=(this.gameId?i.find(l=>String(l.id)===String(this.gameId)):null)||i[0]||{},!this._canAccess(this.game)){this.renderAccessDenied();return}if(this._isTeamSeasonFrozen()){a.innerHTML=`
        <div style="padding:24px;background:#ffffff;border:1px solid #fecdd3;border-radius:12px;color:#9f1239;">
          <h3 style="margin-top:0;">🔒 Temporada cerrada</h3>
          <p style="margin-bottom:12px;">La temporada está congelada. Este partido sigue disponible en consulta, pero no admite registro ni edición.</p>
          <button type="button" id="btn-back-frozen-season" style="min-height:44px;border:0;border-radius:8px;padding:9px 14px;background:#0f172a;color:#ffffff;font-weight:800;cursor:pointer;">Volver a Partidos</button>
        </div>`,(e=a.querySelector("#btn-back-frozen-season"))==null||e.addEventListener("click",()=>{window.location.hash="#/games"});return}if(String(this.game.edit_state||this.game.editState||"OPEN").toUpperCase()==="LOCKED"){a.innerHTML=`
        <div style="padding:24px;background:#ffffff;border:1px solid #fecaca;border-radius:12px;color:#991b1b;">
          <h3 style="margin-top:0;">🔒 Partido cerrado</h3>
          <p style="margin-bottom:12px;">Este partido está bloqueado y no admite cambios. El BoxScore y los informes continúan disponibles en modo consulta.</p>
          <button type="button" id="btn-back-locked-game" style="min-height:44px;border:0;border-radius:8px;padding:9px 14px;background:#0f172a;color:#ffffff;font-weight:800;cursor:pointer;">Volver a Partidos</button>
        </div>`,(d=a.querySelector("#btn-back-locked-game"))==null||d.addEventListener("click",()=>{window.location.hash="#/games"});return}this.activeMode==="acta"&&!this._canEditBoxScore(this.game)&&(this.activeMode="rapido"),this.players=((n=(r=p).getPlayersEligibleOnDate)==null?void 0:n.call(r,this.game.team_id||p.getActiveTeamId(),this.game.date))||p.getPlayers(this.game.team_id||p.getActiveTeamId())||[],this.gameStats=p.getPlayerGameStats(null,this.game.id)||[],this.periodScores=p.getGamePeriodScores(this.game.id)||[],this.renderLayout(),this.bindEvents()}renderAccessDenied(){var t;this.container.innerHTML=`
      <div style="max-width: 520px; margin: 40px auto; padding: 28px; background: #ffffff; border-radius: 12px; border: 1px solid #fee2e2; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); font-family: var(--font-family-base, system-ui);">
        <div style="font-size: 3rem; margin-bottom: 12px;">🔒</div>
        <h2 style="font-size: 1.3rem; font-weight: 800; color: #991b1b; margin: 0 0 8px 0;">
          ${this.t("auth_error_title","Acceso Restringido")}
        </h2>
        <p style="font-size: 0.95rem; color: #475569; line-height: 1.5; margin: 0 0 16px 0;">
          ${this.t("easy_entry.access_denied_desc","La entrada y edición de estadísticas está reservada exclusivamente para roles técnicos y analistas.")}
        </p>
        <button id="btn-back-dashboard" style="background: #0f172a; color: #ffffff; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 700; cursor: pointer; min-height: 44px;">
          ${this.t("back_to_list","Volver al Inicio")}
        </button>
      </div>
    `,(t=this.container.querySelector("#btn-back-dashboard"))==null||t.addEventListener("click",()=>{window.location.hash="#/dashboard"})}renderLayout(){var f;const t=this.game.venue==="Local"||this.game.is_home,o=this.game.opponent||this.game.opponentName||"Rival",a=((f=p.getTeamById(this.game.team_id))==null?void 0:f.name)||"JMJ Manyanet Sant Andreu",i=t?a:o,e=t?o:a,d=Number(this.game.team_score??this.game.teamScore??0),r=Number(this.game.opponent_score??this.game.opponentScore??0),n=this._canEditBoxScore(this.game),s=(p.getGames()||[]).map(c=>`
      <option value="${c.id}" ${String(c.id)===String(this.game.id)?"selected":""}>
        ${c.date||""} vs ${c.opponent||c.opponentName||"Rival"} (${c.team_score??c.teamScore??0} - ${c.opponent_score??c.opponentScore??0})
      </option>
    `).join("");this.container.innerHTML=`
      <div class="easy-entry-wrapper" style="max-width: 1400px; margin: 0 auto; padding: 12px; font-family: var(--font-family-base, system-ui); box-sizing: border-box; display: flex; flex-direction: column; gap: 16px;">
        
        <!-- HEADER PRINCIPAL -->
        <header style="background: #0f172a; color: #ffffff; border-radius: 12px; padding: 14px 20px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px;">
          <div>
            <span style="font-size: 0.75rem; color: #f97316; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">TOMA DE DATOS & ACTA OFICIAL</span>
            <h1 style="margin: 2px 0 0 0; font-size: 1.25rem; font-weight: 900; color: #ffffff;">${i} vs ${e}</h1>
          </div>

          <!-- Marcador en Vivo -->
          <div style="display: flex; align-items: center; gap: 16px; background: #1e293b; padding: 6px 20px; border-radius: 8px; border: 1px solid #334155;">
            <span style="font-size: 1.6rem; font-weight: 900; color: #38bdf8;" id="score-home">${d}</span>
            <span style="color: #94a3b8; font-weight: 900; font-size: 1.2rem;">-</span>
            <span style="font-size: 1.6rem; font-weight: 900; color: #f97316;" id="score-away">${r}</span>
          </div>

          <!-- Selector de Partido y Deshacer -->
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <select id="select-change-game" style="background: #1e293b; color: #ffffff; border: 1px solid #475569; padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; font-weight: 700; min-height: 44px;">
              ${s}
            </select>
            <button id="btn-undo" style="background: #dc2626; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 0.85rem; cursor: pointer; min-height: 44px;">
              ↩ ${this.t("easy_entry.undo","Deshacer")}
            </button>
          </div>
        </header>

        <!-- SELECTOR DE MODOS -->
        <div style="display: grid; grid-template-columns: repeat(${n?3:2}, 1fr); gap: 12px;">
          <button class="mode-selector-btn ${this.activeMode==="pista"?"active-mode":""}" data-mode="pista" style="padding: 12px; font-size: 0.9rem; font-weight: 800; border-radius: 10px; border: 1px solid #cbd5e1; cursor: pointer; min-height: 48px; background: ${this.activeMode==="pista"?"#0f172a":"#ffffff"}; color: ${this.activeMode==="pista"?"#ffffff":"#334155"};">
            🏀 Modo Pista (Visual)
          </button>
          <button class="mode-selector-btn ${this.activeMode==="rapido"?"active-mode":""}" data-mode="rapido" style="padding: 12px; font-size: 0.9rem; font-weight: 800; border-radius: 10px; border: 1px solid #cbd5e1; cursor: pointer; min-height: 48px; background: ${this.activeMode==="rapido"?"#0f172a":"#ffffff"}; color: ${this.activeMode==="rapido"?"#ffffff":"#334155"};">
            ⚡ Modo Rápido (Botones)
          </button>
          ${n?`
          <button class="mode-selector-btn ${this.activeMode==="acta"?"active-mode":""}" data-mode="acta" style="padding: 12px; font-size: 0.9rem; font-weight: 800; border-radius: 10px; border: 1px solid #cbd5e1; cursor: pointer; min-height: 48px; background: ${this.activeMode==="acta"?"#0f172a":"#ffffff"}; color: ${this.activeMode==="acta"?"#ffffff":"#334155"};">
            📋 Acta Oficial (Tabla & Cuadre)
          </button>
          `:""}
        </div>

        <!-- CONTENEDOR ACTIVO -->
        <main id="entry-main-content">
          ${this.activeMode==="acta"&&n?this.renderActaMode():this.activeMode==="pista"?this.renderCourtMode():this.renderFastMode()}
        </main>

        <!-- FEEDBACK FOOTER -->
        <footer style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; font-size: 0.85rem; color: #334155; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <span id="last-action-feed" style="font-weight: 600; color: #0f172a;">${this.t("easy_entry.ready_hint","Selecciona un jugador o modifica los datos directamente.")}</span>
          <span style="color: #64748b;">Acciones registradas: <strong id="action-count" style="color: #0f172a;">${this.actionHistory.length}</strong></span>
        </footer>
      </div>

      <style>
        .acta-input {
          width: 40px !important;
          height: 34px !important;
          text-align: center !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          background-color: #ffffff !important;
          display: inline-block !important;
          visibility: visible !important;
          box-sizing: border-box !important;
          padding: 0 !important;
          margin: 0 auto !important;
          -webkit-text-fill-color: #0f172a !important;
          line-height: normal !important;
        }
        .acta-input:focus {
          border-color: #f97316 !important;
          outline: 2px solid rgba(249, 115, 22, 0.2) !important;
        }
        .q-score-input {
          width: 44px !important;
          height: 36px !important;
          text-align: center !important;
          font-size: 15px !important;
          font-weight: 900 !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          background: #ffffff !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          line-height: normal !important;
        }
      </style>
    `}renderPlayerList(){return`
      <section style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px;">
        <h2 style="font-size: 0.85rem; margin: 0 0 10px 0; font-weight: 800; color: #0f172a; text-transform: uppercase;">1️⃣ ${this.t("players","JUGADORES")}</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(85px, 1fr)); gap: 8px;">
          ${this.players.map(t=>`
            <button type="button"
                    class="player-card-btn ${this.selectedPlayerId===t.id?"active-player":""}" 
                    data-player-id="${t.id}"
                    data-player-name="#${t.jersey??t.number??"-"} ${t.first_name||""} ${t.last_name||""}".trim()
                    style="display: flex; flex-direction: column; align-items: center; padding: 10px 4px; border: 2px solid ${this.selectedPlayerId===t.id?"#f97316":"#e2e8f0"}; background: ${this.selectedPlayerId===t.id?"#fff7ed":"#f8fafc"}; border-radius: 8px; cursor: pointer; min-height: 48px;">
              <span style="font-size: 1.2rem; font-weight: 900; color: #0f172a;">#${t.jersey??t.number??"-"}</span>
              <span style="font-size: 0.75rem; font-weight: 700; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75px;">${t.first_name||t.name||"Jugador"}</span>
            </button>
          `).join("")}
        </div>
      </section>
    `}renderFastMode(){return`
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
        ${this.renderPlayerList()}
        
        <section style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 12px;">
          <h2 style="font-size: 0.85rem; margin: 0; font-weight: 800; color: #0f172a; text-transform: uppercase;">2️⃣ ${this.t("easy_entry.add_action","Registrar Acción")}</h2>
          
          <div>
            <div style="font-size: 0.75rem; font-weight: 800; color: #16a34a; margin-bottom: 4px;">CANASTAS CONVERTIDAS</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <button class="action-btn" data-action="FGM2" data-pts="2" style="background: #22c55e; color: #ffffff; border: none; padding: 14px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer; min-height: 48px;">+2 Canasta</button>
              <button class="action-btn" data-action="FGM3" data-pts="3" style="background: #16a34a; color: #ffffff; border: none; padding: 14px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer; min-height: 48px;">+3 Triple</button>
              <button class="action-btn" data-action="FTM" data-pts="1" style="background: #84cc16; color: #ffffff; border: none; padding: 14px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer; min-height: 48px;">+1 Libre</button>
            </div>
          </div>

          <div>
            <div style="font-size: 0.75rem; font-weight: 800; color: #dc2626; margin-bottom: 4px;">TIROS FALLADOS</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <button class="action-btn" data-action="FGA2_MISS" data-pts="0" style="background: #f87171; color: #ffffff; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer; min-height: 44px;">Fallo T2</button>
              <button class="action-btn" data-action="FGA3_MISS" data-pts="0" style="background: #ef4444; color: #ffffff; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer; min-height: 44px;">Fallo T3</button>
              <button class="action-btn" data-action="FTA_MISS" data-pts="0" style="background: #fca5a5; color: #7f1d1d; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer; min-height: 44px;">Fallo TL</button>
            </div>
          </div>

          <div>
            <div style="font-size: 0.75rem; font-weight: 800; color: #0284c7; margin-bottom: 4px;">REBOTES / FALTAS / PÉRDIDAS</div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
              <button class="action-btn" data-action="DREB" style="background: #38bdf8; color: #0f172a; border: none; padding: 10px 4px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; min-height: 44px;">Reb Def</button>
              <button class="action-btn" data-action="OREB" style="background: #7dd3fc; color: #0f172a; border: none; padding: 10px 4px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; min-height: 44px;">Reb Of</button>
              <button class="action-btn" data-action="FOUL" style="background: #fbbf24; color: #78350f; border: none; padding: 10px 4px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; min-height: 44px;">Falta</button>
              <button class="action-btn" data-action="TOV" style="background: #fb923c; color: #7c2d12; border: none; padding: 10px 4px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; min-height: 44px;">Pérdida</button>
            </div>
          </div>
        </section>
      </div>
    `}renderCourtMode(){return`
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; align-items: start;">
        ${this.renderPlayerList()}
        
        <section style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; align-items: center;">
          <div style="font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 8px; width: 100%; display: flex; justify-content: space-between;">
            <span>📍 Toca el punto exacto en la pista</span>
            <span id="shot-status-hint" style="color: #f97316; font-weight: 800;">Paso 2: Toca el punto</span>
          </div>

          <div style="position: relative; width: 100%; max-width: 440px; aspect-ratio: 50/47; background: #d97736; border: 3px solid #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); cursor: crosshair;" id="court-canvas-container">
            <svg viewBox="0 0 500 470" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; pointer-events: none;">
              <rect x="0" y="0" width="500" height="470" fill="none" stroke="#fff" stroke-width="4"/>
              <rect x="170" y="0" width="160" height="190" fill="rgba(255,255,255,0.15)" stroke="#fff" stroke-width="3"/>
              <path d="M 170 190 A 80 80 0 0 0 330 190" fill="none" stroke="#fff" stroke-width="3"/>
              <path d="M 170 190 A 80 80 0 0 1 330 190" stroke-dasharray="8,8" fill="none" stroke="#fff" stroke-width="2"/>
              <line x1="220" y1="40" x2="280" y2="40" stroke="#fff" stroke-width="4"/>
              <circle cx="250" cy="52" r="15" fill="none" stroke="#ff5722" stroke-width="4"/>
              <path d="M 215 52 A 35 35 0 0 0 285 52" fill="none" stroke="#fff" stroke-width="2"/>
              <line x1="30" y1="0" x2="30" y2="140" stroke="#fff" stroke-width="3"/>
              <line x1="470" y1="0" x2="470" y2="140" stroke="#fff" stroke-width="3"/>
              <path d="M 30 140 A 235 235 0 0 0 470 140" fill="none" stroke="#fff" stroke-width="3"/>
            </svg>
            <div id="shot-markers-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
          </div>
        </section>

        <section style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
          <h2 style="font-size: 0.85rem; margin: 0; font-weight: 800; color: #0f172a; text-transform: uppercase;">3️⃣ Resultado del Tiro</h2>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button class="shot-outcome-btn" data-made="true" style="background: #22c55e; color: #ffffff; border: none; padding: 14px 8px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer; min-height: 48px;">
              ✔ ${this.t("made","CONVERTIDO")}
            </button>
            <button class="shot-outcome-btn" data-made="false" style="background: #ef4444; color: #ffffff; border: none; padding: 14px 8px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer; min-height: 48px;">
              ✖ ${this.t("missed","FALLADO")}
            </button>
          </div>

          <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; margin-top: 10px; text-transform: uppercase;">OTRAS ACCIONES RÁPIDAS</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <button class="action-btn" data-action="FTM" data-pts="1" style="background: #84cc16; color: #ffffff; border: none; padding: 10px; border-radius: 6px; font-weight: 700; cursor: pointer; min-height: 44px;">+1 Libre</button>
            <button class="action-btn" data-action="DREB" style="background: #0284c7; color: #ffffff; border: none; padding: 10px; border-radius: 6px; font-weight: 700; cursor: pointer; min-height: 44px;">Rebote</button>
            <button class="action-btn" data-action="FOUL" style="background: #f59e0b; color: #ffffff; border: none; padding: 10px; border-radius: 6px; font-weight: 700; cursor: pointer; min-height: 44px;">Falta</button>
            <button class="action-btn" data-action="TOV" style="background: #ea580c; color: #ffffff; border: none; padding: 10px; border-radius: 6px; font-weight: 700; cursor: pointer; min-height: 44px;">Pérdida</button>
          </div>
        </section>
      </div>
    `}renderActaMode(){const t=(i,e=!1)=>{const d=this.periodScores.find(r=>Number(r.period_number)===i);if(d)return Number(e?d.opponent_score||0:d.team_score||0);if(this.game.periods&&Array.isArray(this.game.periods)){const r=this.game.periods[i-1];if(r)return Number(e?r.opponent_score||0:r.team_score||0)}return 0},o=[1,2,3,4].map(i=>({quarter:i,team:t(i,!1),opp:t(i,!0)})),a=this.players.map(i=>{const e=this.gameStats.find(S=>String(S.player_id??S.playerId)===String(i.id))||{},d=Number(e.minutes??e.minutesPlayed??0),r=Number(e.fg2_made??e.fg2Made??0),n=Number(e.fg2_attempted??e.fg2Attempted??0),l=Number(e.fg3_made??e.fg3Made??0),s=Number(e.fg3_attempted??e.fg3Attempted??0),f=Number(e.ft_made??e.ftMade??0),c=Number(e.ft_attempted??e.ftAttempted??0),u=Number(e.off_reb??e.offReb??0),h=Number(e.def_reb??e.defReb??0),g=Number(e.assists??e.ast??0),m=Number(e.steals??e.stl??0),y=Number(e.blocks??e.blocks_made??e.blk??0),v=Number(e.turnovers??e.tov??0),b=Number(e.fouls_committed??e.fouls??0),x=Number(e.fouls_drawn??e.fouls_received??0),_=e.points!==void 0&&e.points!==null?Number(e.points):r*2+l*3+f,w=$.calculatePlayerBoxScore({minutes:d,fg2_made:r,fg2_attempted:n,fg3_made:l,fg3_attempted:s,ft_made:f,ft_attempted:c,off_reb:u,def_reb:h,assists:g,steals:m,blocks:y,turnovers:v,fouls_committed:b,fouls_drawn:x,points:_});return`
        <tr data-player-id="${i.id}" style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-weight: 800; color: #0f172a; white-space: nowrap;">
            #${i.jersey??i.number??"-"} ${i.first_name||""} ${i.last_name||""}
          </td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="minutes" value="${d}" /></td>
          <td style="padding: 6px; text-align: center; font-weight: 900; color: #1e3a8a; font-size: 14px;" class="cell-pts">${w.points||0}</td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="fg2_made" value="${r}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="fg2_attempted" value="${n}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="fg3_made" value="${l}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="fg3_attempted" value="${s}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="ft_made" value="${f}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="ft_attempted" value="${c}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="off_reb" value="${u}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="def_reb" value="${h}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="assists" value="${g}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="steals" value="${m}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="blocks" value="${y}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="turnovers" value="${v}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="fouls_committed" value="${b}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="fouls_drawn" value="${x}" /></td>
          <td style="padding: 6px; text-align: center; font-weight: 900; color: #a855f7; font-size: 14px;" class="cell-val">${w.pir??0}</td>
        </tr>
      `}).join("");return`
      <div style="display: flex; flex-direction: column; gap: 16px;">
        
        <!-- Desglose por Cuartos -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
            <h3 style="margin: 0; font-size: 0.9rem; font-weight: 800; color: #0f172a; text-transform: uppercase;">
              ⏱️ Desglose de Puntos por Cuartos
            </h3>
            <span id="badge-cuadre" style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 800;">
              ✅ Puntos Cuadrados: Jugadores (${this.game.team_score||0}) = Cuartos (${this.game.team_score||0})
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)) 160px; gap: 12px; align-items: center;">
            ${o.map(i=>`
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                <span style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">Cuarto ${i.quarter} (Q${i.quarter})</span>
                <div style="display: flex; justify-content: center; align-items: center; gap: 6px;">
                  <input type="number" class="q-score-input" data-q="${i.quarter}" data-side="team" value="${i.team}" style="color: #1e3a8a !important; -webkit-text-fill-color: #1e3a8a !important;" />
                  <span style="font-weight: 800; color: #94a3b8;">-</span>
                  <input type="number" class="q-score-input" data-q="${i.quarter}" data-side="opp" value="${i.opp}" style="color: #f97316 !important; -webkit-text-fill-color: #f97316 !important;" />
                </div>
              </div>
            `).join("")}

            <div style="background: #0f172a; border-radius: 8px; padding: 12px; text-align: center; color: #ffffff;">
              <span style="font-size: 9px; font-weight: 800; letter-spacing: 0.05em; display: block; color: #94a3b8;">MARCADOR FINAL</span>
              <strong id="label-marcador-final" style="font-size: 20px; font-weight: 900; color: #38bdf8;">
                ${this.game.team_score||0} - ${this.game.opponent_score||0}
              </strong>
            </div>
          </div>
        </div>

        <!-- Tabla Acta Oficial -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 style="margin: 0; font-size: 0.9rem; font-weight: 800; color: #0f172a; text-transform: uppercase;">
              📋 Planilla de Jugadores
            </h3>
            <button id="btn-save-acta" style="background: #f97316; color: #ffffff; border: none; padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; min-height: 44px;">
              💾 Guardar Acta Oficial
            </button>
          </div>

          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; background: #f8fafc;">
                <th style="padding: 10px 12px;">JUGADOR</th>
                <th style="padding: 10px 6px; text-align: center;">MIN</th>
                <th style="padding: 10px 6px; text-align: center; color: #1e3a8a;">PTS</th>
                <th style="padding: 10px 6px; text-align: center;">T2C</th>
                <th style="padding: 10px 6px; text-align: center;">T2I</th>
                <th style="padding: 10px 6px; text-align: center;">T3C</th>
                <th style="padding: 10px 6px; text-align: center;">T3I</th>
                <th style="padding: 10px 6px; text-align: center;">TLC</th>
                <th style="padding: 10px 6px; text-align: center;">TLI</th>
                <th style="padding: 10px 6px; text-align: center;">RO</th>
                <th style="padding: 10px 6px; text-align: center;">RD</th>
                <th style="padding: 10px 6px; text-align: center;">AST</th>
                <th style="padding: 10px 6px; text-align: center;">ROB</th>
                <th style="padding: 10px 6px; text-align: center;">TAP</th>
                <th style="padding: 10px 6px; text-align: center;">PER</th>
                <th style="padding: 10px 6px; text-align: center;">FC</th>
                <th style="padding: 10px 6px; text-align: center;">FR</th>
                <th style="padding: 10px 6px; text-align: center; color: #a855f7;">VAL</th>
              </tr>
            </thead>
            <tbody id="acta-table-body">
              ${a}
            </tbody>
          </table>
        </div>

      </div>
    `}bindEvents(){var t,o;this.container.querySelectorAll(".mode-selector-btn").forEach(a=>{a.addEventListener("click",()=>{const i=a.getAttribute("data-mode");i==="acta"&&!this._canEditBoxScore(this.game)||(this.activeMode=i,this.renderLayout(),this.bindEvents())})}),(t=this.container.querySelector("#select-change-game"))==null||t.addEventListener("change",a=>{this.gameId=a.target.value,this.render(this.container,this.gameId)}),(o=this.container.querySelector("#btn-undo"))==null||o.addEventListener("click",()=>{this.undoLastAction()}),this.activeMode==="acta"?this.bindActaEvents():this.activeMode==="pista"?(this.bindPlayerSelection(),this.bindCourtModeActions()):this.activeMode==="rapido"&&(this.bindPlayerSelection(),this.bindFastModeActions())}bindPlayerSelection(){const t=this.container.querySelectorAll(".player-card-btn");t.forEach(o=>{o.addEventListener("click",()=>{this.selectedPlayerId=o.getAttribute("data-player-id"),this.selectedPlayerName=o.getAttribute("data-player-name"),t.forEach(a=>{a.style.border="2px solid #e2e8f0",a.style.background="#f8fafc"}),o.style.border="2px solid #f97316",o.style.background="#fff7ed",this.updateFeed(`Jugador activo: <strong>${this.selectedPlayerName}</strong>`)})})}bindFastModeActions(){this.container.querySelectorAll(".action-btn").forEach(t=>{t.addEventListener("click",()=>{if(!this.selectedPlayerId)return alert(this.t("search_player","Selecciona primero un jugador"));const o=t.getAttribute("data-action"),a=parseInt(t.getAttribute("data-pts")||"0",10);this.saveEvent({action:o,points:a})})})}bindCourtModeActions(){const t=this.container.querySelector("#court-canvas-container");t==null||t.addEventListener("click",o=>{if(!this.selectedPlayerId)return alert("Primero selecciona el jugador");const a=t.getBoundingClientRect(),i=(o.clientX-a.left)/a.width*100,e=(o.clientY-a.top)/a.height*100,r=Math.hypot((i-50)*1.5,(e-11)*1.5)>42||e>55;this.pendingShot={x:parseFloat(i.toFixed(1)),y:parseFloat(e.toFixed(1)),shotType:r?"T3":"T2"};const n=this.container.querySelector("#shot-status-hint");n&&(n.innerHTML=`<span style="color:#16a34a; font-weight:800;">${this.pendingShot.shotType} marcado. Pulsa CONVERTIDO o FALLADO ➔</span>`)}),this.container.querySelectorAll(".shot-outcome-btn").forEach(o=>{o.addEventListener("click",()=>{if(!this.selectedPlayerId)return alert("Selecciona un jugador");if(!this.pendingShot)return alert("Toca primero en la pista dónde se lanzó el tiro");const a=o.getAttribute("data-made")==="true",i=this.pendingShot.shotType==="T3",e=a?i?3:2:0,d=a?i?"FGM3":"FGM2":i?"FGA3_MISS":"FGA2_MISS";this.saveEvent({action:d,points:e,coordinates:{x:this.pendingShot.x,y:this.pendingShot.y},made:a}),this.drawShotMarker(this.pendingShot.x,this.pendingShot.y,a),this.pendingShot=null;const r=this.container.querySelector("#shot-status-hint");r&&(r.textContent="Paso 2: Toca el punto")})}),this.container.querySelectorAll(".action-btn").forEach(o=>{o.addEventListener("click",()=>{if(!this.selectedPlayerId)return alert("Selecciona primero un jugador");const a=o.getAttribute("data-action"),i=parseInt(o.getAttribute("data-pts")||"0",10);this.saveEvent({action:a,points:i})})})}bindActaEvents(){var t;this._canEditBoxScore(this.game)&&(this.container.querySelectorAll("#acta-table-body tr").forEach(o=>{const a=i=>{var e;return Number(((e=o.querySelector(`.acta-input[data-field="${i}"]`))==null?void 0:e.value)||0)};o.querySelectorAll(".acta-input").forEach(i=>{i.addEventListener("input",()=>{const e=a("fg2_made"),d=a("fg2_attempted"),r=a("fg3_made"),n=a("fg3_attempted"),l=a("ft_made"),s=a("ft_attempted"),f=a("off_reb"),c=a("def_reb"),u=a("assists"),h=a("steals"),g=a("blocks"),m=a("turnovers"),y=a("fouls_committed"),v=a("fouls_drawn"),b=$.calculatePlayerBoxScore({fg2_made:e,fg2_attempted:d,fg3_made:r,fg3_attempted:n,ft_made:l,ft_attempted:s,off_reb:f,def_reb:c,assists:u,steals:h,blocks:g,turnovers:m,fouls_committed:y,fouls_drawn:v}),x=o.querySelector(".cell-pts"),_=o.querySelector(".cell-val");x&&(x.textContent=b.points||0),_&&(_.textContent=b.pir??0)})})}),(t=this.container.querySelector("#btn-save-acta"))==null||t.addEventListener("click",async()=>{if(!this._canEditBoxScore(this.game))return;const o=this.container.querySelectorAll("#acta-table-body tr[data-player-id]"),a=[];for(const n of o){const l=n.getAttribute("data-player-id");if(!l)continue;const s=g=>{var m;return Number(((m=n.querySelector(`.acta-input[data-field="${g}"]`))==null?void 0:m.value)||0)},f=s("fg2_made"),c=s("fg3_made"),u=s("ft_made"),h=f*2+c*3+u;a.push({game_id:this.game.id,player_id:l,minutes:s("minutes"),points:h,fg2_made:f,fg2_attempted:s("fg2_attempted"),fg3_made:c,fg3_attempted:s("fg3_attempted"),ft_made:u,ft_attempted:s("ft_attempted"),off_reb:s("off_reb"),def_reb:s("def_reb"),rebounds_offensive:s("off_reb"),rebounds_defensive:s("def_reb"),assists:s("assists"),steals:s("steals"),blocks:s("blocks"),blocks_made:s("blocks"),turnovers:s("turnovers"),fouls_committed:s("fouls_committed"),fouls_drawn:s("fouls_drawn"),fouls_received:s("fouls_drawn")})}const i=[1,2,3,4].map(n=>{var l,s;return{period_number:n,period_type:"quarter",team_score:Number(((l=this.container.querySelector(`.q-score-input[data-q="${n}"][data-side="team"]`))==null?void 0:l.value)||0),opponent_score:Number(((s=this.container.querySelector(`.q-score-input[data-q="${n}"][data-side="opp"]`))==null?void 0:s.value)||0)}}),e=i.reduce((n,l)=>n+l.team_score,0),d=i.reduce((n,l)=>n+l.opponent_score,0),r={...this.game,team_score:e,opponent_score:d};await p.saveGameAndStats(r,a,i),alert("✅ "+this.t("acta_saved_msg","Acta Oficial guardada correctamente.")),this.render(this.container,this.game.id)}))}drawShotMarker(t,o,a){const i=this.container.querySelector("#shot-markers-layer");if(!i)return;const e=document.createElement("div");e.style.position="absolute",e.style.left=`${t}%`,e.style.top=`${o}%`,e.style.transform="translate(-50%, -50%)",e.style.width="12px",e.style.height="12px",e.style.borderRadius="50%",e.style.background=a?"#22c55e":"#ef4444",e.style.border="2px solid #ffffff",e.style.boxShadow="0 0 4px rgba(0,0,0,0.5)",i.appendChild(e)}saveEvent(t){const o={id:Date.now(),playerId:this.selectedPlayerId,playerName:this.selectedPlayerName,...t};if(this.actionHistory.push(o),o.points>0){const i=Number(this.game.team_score??this.game.teamScore??0);this.game.team_score=i+o.points;const e=this.container.querySelector("#score-home");e&&(e.textContent=this.game.team_score)}this.updateFeed(`✅ ${this.selectedPlayerName} - ${o.action} ${o.points>0?"(+"+o.points+"p)":""}`);const a=this.container.querySelector("#action-count");a&&(a.textContent=this.actionHistory.length),this.selectedPlayerId=null,this.selectedPlayerName=null,this.container.querySelectorAll(".player-card-btn").forEach(i=>{i.style.border="2px solid #e2e8f0",i.style.background="#f8fafc"})}undoLastAction(){if(this.actionHistory.length===0)return alert(this.t("easy_entry.nothing_to_undo","No hay ninguna acción previa para deshacer."));const t=this.actionHistory.pop();if(t.points>0){this.game.team_score=Math.max(0,(this.game.team_score||0)-t.points);const a=this.container.querySelector("#score-home");a&&(a.textContent=this.game.team_score)}if(t.coordinates){const a=this.container.querySelector("#shot-markers-layer");a&&a.lastChild&&a.removeChild(a.lastChild)}this.updateFeed(`↩ Deshecho: ${t.playerName} (${t.action})`);const o=this.container.querySelector("#action-count");o&&(o.textContent=this.actionHistory.length)}updateFeed(t){const o=this.container.querySelector("#last-action-feed");o&&(o.innerHTML=t)}}export{P as EasyStatsEntryView};
