import{T as at,I as Q,D as y,G as nt,P as ot,B as dt}from"./index-Co3VTdK8.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";class ct{constructor(a,r){this.supabase=(a==null?void 0:a.supabase)||(a==null?void 0:a.default)||a,this.auth=r,this.games=[],this.players=[],this.selectedGameId=null,this.gameStats=[]}t(a,r=""){return(at?at.t(a,r):Q.t(a,r))||r}_gameContext(a={}){var e,d,h,c;const r=a.team_id||a.teamId||((d=(e=y).getActiveTeamId)==null?void 0:d.call(e))||null,o=a.team_season_id||a.teamSeasonId||((c=(h=y).getActiveTeamSeasonId)==null?void 0:c.call(h,r))||null;return{teamId:r,teamSeasonId:o,gameId:a.id||null}}_isTeamSeasonFrozen(a={}){var e,d;const{teamId:r}=this._gameContext(a),o=((d=(e=y).getActiveSeasonContext)==null?void 0:d.call(e,r))||null;return String((o==null?void 0:o.data_status)||(o==null?void 0:o.dataStatus)||"ACTIVE").toUpperCase()==="FROZEN"}_canEdit(a=null){var o,e;if(!a||nt.isLocked(a)||this._isTeamSeasonFrozen(a))return!1;const r=this._gameContext(a);return typeof((o=this.auth)==null?void 0:o.canPreview)=="function"?!!this.auth.canPreview(ot.EDIT_BOXSCORE,r):typeof((e=this.auth)==null?void 0:e.can)=="function"?!!this.auth.can(ot.EDIT_BOXSCORE,r):!1}_readOnlyReason(a={}){return this._isTeamSeasonFrozen(a)?"Temporada cerrada · solo lectura":nt.isLocked(a)?"Partido cerrado · solo lectura":"Tu rol puede consultar, pero no editar este BoxScore"}async render(a="dashboard-content-area",r=null){var e,d,h,c;const o=document.getElementById(a);if(o){if(this.games=y.getGames()||[],this.players=((c=(h=y).getSeasonParticipantPlayers)==null?void 0:c.call(h,(d=(e=y).getActiveTeamId)==null?void 0:d.call(e)))||y.getPlayers()||[],this.games.length===0){o.innerHTML=`
        <div style="padding: 24px; color: #dc2626; font-weight: 700; background: white; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
          ${this.t("no_games_recorded","No hay partidos registrados.")}
        </div>
      `;return}if(r){this.selectedGameId=r,this._renderGameBoxScoreDetail(o,a);return}this._renderGamesBoxScoreList(o,a)}}_renderGamesBoxScoreList(a,r){const o=this.games.map(e=>{const h=Number(e.team_score??e.teamScore??0)>Number(e.opponent_score??e.opponentScore??0)?"#16a34a":"#dc2626",c=y.getPlayerGameStats(null,e.id)||[];let A=0,_=0,v=0,x=0,N=0,R=0,B=0,L=0,G=0,I=0,C=0;c.forEach(s=>{A+=Number(s.fg2_made??s.fg2Made??0),_+=Number(s.fg2_attempted??s.fg2Attempted??0),v+=Number(s.fg3_made??s.fg3Made??0),x+=Number(s.fg3_attempted??s.fg3Attempted??0),N+=Number(s.ft_made??s.ftMade??0),R+=Number(s.ft_attempted??s.ftAttempted??0),B+=Number(s.off_reb??s.offReb??0)+Number(s.def_reb??s.defReb??0),L+=Number(s.assists??s.ast??0),G+=Number(s.steals??s.stl??0),I+=Number(s.blocks??s.blocks_made??s.blk??0),C+=Number(s.turnovers??s.tov??0)});const D=A+v,E=_+x,q=E>0?((D+.5*v)/E*100).toFixed(1):"0.0",V=_>0?(A/_*100).toFixed(1):"0.0",j=x>0?(v/x*100).toFixed(1):"0.0",W=R>0?(N/R*100).toFixed(1):"0.0",O=String(e.venue||"").toLowerCase(),X=O==="home"||O==="local"||e.is_home===!0||e.isHome===!0?this.t("local","Local"):this.t("visitor","Visitante"),Z=e.opponent||e.opponent_name||e.opponentName||this.t("opponent","Rival"),K=e.date?Q.formatDate?Q.formatDate(e.date):e.date:"-";return`
        <tr class="game-boxscore-row" style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <td style="padding: 14px 12px;">
            <div style="font-weight: 800; color: #0f172a;">vs ${Z}</div>
            <div style="font-size: 11px; color: #94a3b8; font-weight: 500;">${K} · ${X}</div>
          </td>
          <td style="padding: 14px 12px; text-align: center;">
            <span style="font-weight: 900; color: ${h}; background: #f8fafc; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              ${e.team_score??e.teamScore??0} - ${e.opponent_score??e.opponentScore??0}
            </span>
          </td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 800; color: #1e3a8a;">${q}%</td>
          <td style="padding: 14px 12px; text-align: center;">
            <strong style="color: #0f172a;">${V}%</strong> <span style="font-size: 11px; color: #94a3b8;">(${A}/${_})</span>
          </td>
          <td style="padding: 14px 12px; text-align: center;">
            <strong style="color: #0f172a;">${j}%</strong> <span style="font-size: 11px; color: #94a3b8;">(${v}/${x})</span>
          </td>
          <td style="padding: 14px 12px; text-align: center;">
            <strong style="color: #0f172a;">${W}%</strong> <span style="font-size: 11px; color: #94a3b8;">(${N}/${R})</span>
          </td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 700; color: #0f172a;">${B}</td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 700; color: #0f172a;">${L}</td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 700; color: #0f172a;">${G}</td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 700; color: #0f172a;">${I}</td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 800; color: #dc2626;">${C}</td>
          <td style="padding: 14px 12px; text-align: center;">
            <button class="btn-open-boxscore" data-id="${e.id}" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; min-height: 44px;">
              👁️ Box Score
            </button>
          </td>
        </tr>
      `}).join("");a.innerHTML=`
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">
        
        <div style="margin-bottom: 24px;">
          <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
            📊 ${this.t("boxscore","Registro Estadístico")}
          </h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">
            ${this.t("boxscore_subtitle","Resumen de métricas avanzadas por equipo. Selecciona un partido para ver o editar las estadísticas por jugador.")}
          </p>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                <th style="padding: 10px 12px;">FECHA / ${this.t("opponent","RIVAL").toUpperCase()}</th>
                <th style="padding: 10px 12px; text-align: center;">${this.t("score","RESULTADO").toUpperCase()}</th>
                <th style="padding: 10px 12px; text-align: center;">EFG%</th>
                <th style="padding: 10px 12px; text-align: center;">%T2</th>
                <th style="padding: 10px 12px; text-align: center;">%T3</th>
                <th style="padding: 10px 12px; text-align: center;">%TL</th>
                <th style="padding: 10px 12px; text-align: center;">REB</th>
                <th style="padding: 10px 12px; text-align: center;">AST</th>
                <th style="padding: 10px 12px; text-align: center;">ROB</th>
                <th style="padding: 10px 12px; text-align: center;">TAP</th>
                <th style="padding: 10px 12px; text-align: center;">PER</th>
                <th style="padding: 10px 12px; text-align: center;">${this.t("actions","ACCIONES").toUpperCase()}</th>
              </tr>
            </thead>
            <tbody>
              ${o}
            </tbody>
          </table>
        </div>

      </div>
    `,a.querySelectorAll(".btn-open-boxscore").forEach(e=>{e.addEventListener("click",()=>{const d=e.getAttribute("data-id");window.location.hash=`#/boxscore/${d}`})})}_renderGameBoxScoreDetail(a,r){var s,tt;const o=this.games.find(n=>String(n.id)===String(this.selectedGameId))||this.games[0];this.gameStats=y.getPlayerGameStats(null,o.id)||[];let e=o.starter_ids||o.starterIds||[];if(typeof e=="string")try{e=JSON.parse(e)}catch{e=[]}const d=this._canEdit(o),h=this._readOnlyReason(o);let c=0,A=0,_=0,v=0,x=0,N=0,R=0,B=0,L=0,G=0,I=0,C=0,D=0,E=0,q=0,V=0,j=0;const W=this.players.map(n=>{const t=this.gameStats.find(et=>String(et.player_id??et.playerId)===String(n.id))||{},S=e.includes(n.id)||!!t.starter,l=Number(t.minutes??t.minutesPlayed??0),F=Number(t.fg2_made??t.fg2Made??0),T=Number(t.fg2_attempted??t.fg2Attempted??0),g=Number(t.fg3_made??t.fg3Made??0),p=Number(t.fg3_attempted??t.fg3Attempted??0),$=Number(t.ft_made??t.ftMade??0),i=Number(t.ft_attempted??t.ftAttempted??0),k=Number(t.off_reb??t.offReb??0),f=Number(t.def_reb??t.defReb??0),m=Number(t.assists??t.ast??0),z=Number(t.steals??t.stl??0),w=Number(t.blocks??t.blocks_made??t.blk??0),u=Number(t.turnovers??t.tov??0),M=Number(t.fouls_committed??t.fouls??0),P=Number(t.fouls_drawn??t.fouls_received??0),U=t.points!==void 0&&t.points!==null?Number(t.points):F*2+g*3+$,b=dt.calculatePlayerBoxScore({minutes:l,fg2_made:F,fg2_attempted:T,fg3_made:g,fg3_attempted:p,ft_made:$,ft_attempted:i,off_reb:k,def_reb:f,assists:m,steals:z,blocks:w,turnovers:u,fouls_committed:M,fouls_drawn:P,points:U});c+=l,A+=b.points||0,_+=F,v+=T,x+=g,N+=p,R+=$,B+=i,L+=k,G+=f,I+=m,C+=z,D+=w,E+=u,q+=M,V+=P,j+=b.pir||0;const H=`${b.eFG.toFixed(1)}%`,J=b.pir??0,st=u>0?(m/u).toFixed(1):m.toFixed(1),it=b.usageRate?`${b.usageRate.toFixed(1)}%`:"18.5%";return`
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;" data-player-id="${n.id}">
          <td style="padding: 8px 10px; font-weight: 700; color: #0f172a; white-space: nowrap;">#${n.jersey??n.number??"-"} ${n.first_name||n.firstName||""} ${n.last_name||n.lastName||""}</td>
          <td style="padding: 8px 4px; text-align: center;"><input type="checkbox" class="chk-starter" ${S?"checked":""} ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="minutes" value="${l}" ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center; font-weight: 800; color: #0f172a;" class="cell-pts">${b.points||0}</td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="fg2_made" value="${F}" ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="fg2_attempted" value="${T}" ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="fg3_made" value="${g}" ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="fg3_attempted" value="${p}" ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="ft_made" value="${$}" ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="ft_attempted" value="${i}" ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="off_reb" value="${k}" ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="def_reb" value="${f}" ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="assists" value="${m}" ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="steals" value="${z}" ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="blocks" value="${w}" ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="turnovers" value="${u}" ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="fouls_committed" value="${M}" ${d?"":"disabled"} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="fouls_drawn" value="${P}" ${d?"":"disabled"} /></td>
          
          <td style="padding: 8px 4px; text-align: center; font-weight: 700; color: #a855f7;" class="cell-efg">${H}</td>
          <td style="padding: 8px 4px; text-align: center; font-weight: 800; color: #a855f7;" class="cell-val">${J}</td>
          <td style="padding: 8px 4px; text-align: center; font-weight: 700; color: #166534;" class="cell-astto">${st}</td>
          <td style="padding: 8px 4px; text-align: center; font-weight: 700; color: #1e40af;">${it}</td>
        </tr>
      `}).join(""),O=v+N,Y=_+x,X=O>0?((Y+.5*x)/O*100).toFixed(1):"0.0",Z=E>0?(I/E).toFixed(1):I.toFixed(1),K=this.games.map(n=>`
      <option value="${n.id}" ${String(n.id)===String(o.id)?"selected":""}>
        ${n.date||""} vs ${n.opponent||n.opponentName||this.t("opponent","Rival")} (${n.team_score??n.teamScore??0} - ${n.opponent_score??n.opponentScore??0})
      </option>
    `).join("");a.innerHTML=`
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <a href="#/boxscore" style="background: #f1f5f9; color: #475569; text-decoration: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; min-height: 44px;">
              ← ${this.t("back_to_register","Volver a Registro Estadístico")}
            </a>
            <div>
              <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
                📊 Box Score e Indicadores Avanzados
              </h1>
              <span style="font-size: 12px; color: #64748b;">${this.t("boxscore_detail_subtitle","Estadísticas tradicionales y métricas avanzadas por jugador")} (${this.players.length} ${this.t("players","jugadores")}).</span>
            </div>
          </div>

          ${d?`
            <button id="btn-save-boxscore" style="background: var(--color-primary, #f97316); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; min-height: 44px;">
              💾 ${this.t("save_changes","Guardar Cambios")}
            </button>
          `:`<span style="background: #fef2f2; color: #dc2626; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 8px;">${h}</span>`}
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 280px;">
            <span style="font-size: 18px;">🏆</span>
            <div style="flex: 1; max-width: 500px;">
              <label style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">${this.t("change_game","CAMBIAR DE PARTIDO")}:</label>
              <select id="select-game-bs" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 700; background: white; min-height: 44px;">
                ${K}
              </select>
            </div>
          </div>

          <span style="background: #dbeafe; color: #1e40af; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 8px;">
            ${this.t("score","Resultado")}: ${o.team_score??o.teamScore??0} - ${o.opponent_score??o.opponentScore??0}
          </span>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; background: #f8fafc;">
                <th style="padding: 10px;">${this.t("players","JUGADOR").toUpperCase()}</th>
                <th style="padding: 10px; text-align: center;">TIT</th>
                <th style="padding: 10px; text-align: center;">MIN</th>
                <th style="padding: 10px; text-align: center;">PTS</th>
                <th style="padding: 10px; text-align: center;">T2C</th>
                <th style="padding: 10px; text-align: center;">T2I</th>
                <th style="padding: 10px; text-align: center;">T3C</th>
                <th style="padding: 10px; text-align: center;">T3I</th>
                <th style="padding: 10px; text-align: center;">TLC</th>
                <th style="padding: 10px; text-align: center;">TLI</th>
                <th style="padding: 10px; text-align: center;">RO</th>
                <th style="padding: 10px; text-align: center;">RD</th>
                <th style="padding: 10px; text-align: center;">AST</th>
                <th style="padding: 10px; text-align: center;">ROB</th>
                <th style="padding: 10px; text-align: center;">TAP</th>
                <th style="padding: 10px; text-align: center;">PER</th>
                <th style="padding: 10px; text-align: center;">FC</th>
                <th style="padding: 10px; text-align: center;">FR</th>
                <th style="padding: 10px; text-align: center; color: #a855f7;">%EFG</th>
                <th style="padding: 10px; text-align: center; color: #a855f7;">VAL (FIBA)</th>
                <th style="padding: 10px; text-align: center; color: #166534;">AST/TO</th>
                <th style="padding: 10px; text-align: center; color: #1e40af;">%USG</th>
              </tr>
            </thead>
            <tbody>
              ${W}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-size: 12px; font-weight: 900; color: #0f172a; border-top: 2px solid #e2e8f0;">
                <td style="padding: 12px;">TOTAL / MEDIA</td>
                <td style="padding: 12px; text-align: center;">-</td>
                <td style="padding: 12px; text-align: center;">${c}</td>
                <td style="padding: 12px; text-align: center;">${A}</td>
                <td style="padding: 12px; text-align: center;">${_}</td>
                <td style="padding: 12px; text-align: center;">${v}</td>
                <td style="padding: 12px; text-align: center;">${x}</td>
                <td style="padding: 12px; text-align: center;">${N}</td>
                <td style="padding: 12px; text-align: center;">${R}</td>
                <td style="padding: 12px; text-align: center;">${B}</td>
                <td style="padding: 12px; text-align: center;">${L}</td>
                <td style="padding: 12px; text-align: center;">${G}</td>
                <td style="padding: 12px; text-align: center;">${I}</td>
                <td style="padding: 12px; text-align: center;">${C}</td>
                <td style="padding: 12px; text-align: center;">${D}</td>
                <td style="padding: 12px; text-align: center;">${E}</td>
                <td style="padding: 12px; text-align: center;">${q}</td>
                <td style="padding: 12px; text-align: center;">${V}</td>
                <td style="padding: 12px; text-align: center; color: #a855f7;">${X}%</td>
                <td style="padding: 12px; text-align: center; color: #a855f7;">${j}</td>
                <td style="padding: 12px; text-align: center; color: #166534;">${Z}</td>
                <td style="padding: 12px; text-align: center; color: #1e40af;">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>

      <style>
        .bs-input {
          width: 38px !important;
          height: 32px !important;
          text-align: center !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 4px !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          background-color: #ffffff !important;
          opacity: 1 !important;
          display: inline-block !important;
          visibility: visible !important;
          box-sizing: border-box !important;
          padding: 0 !important;
          margin: 0 auto !important;
          -webkit-text-fill-color: #0f172a !important;
        }
        .bs-input:focus {
          border-color: #f97316 !important;
          outline: 2px solid rgba(249, 115, 22, 0.2) !important;
        }
      </style>
    `,(s=a.querySelector("#select-game-bs"))==null||s.addEventListener("change",n=>{window.location.hash=`#/boxscore/${n.target.value}`}),a.querySelectorAll("tr[data-player-id]").forEach(n=>{const t=S=>{var l;return Number(((l=n.querySelector(`.bs-input[data-field="${S}"]`))==null?void 0:l.value)||0)};n.querySelectorAll(".bs-input").forEach(S=>{S.addEventListener("input",()=>{const l=t("fg2_made"),F=t("fg2_attempted"),T=t("fg3_made"),g=t("fg3_attempted"),p=t("ft_made"),$=t("ft_attempted"),i=t("off_reb"),k=t("def_reb"),f=t("assists"),m=t("steals"),z=t("blocks"),w=t("turnovers"),u=t("fouls_committed"),M=t("fouls_drawn"),P=dt.calculatePlayerBoxScore({fg2_made:l,fg2_attempted:F,fg3_made:T,fg3_attempted:g,ft_made:p,ft_attempted:$,off_reb:i,def_reb:k,assists:f,steals:m,blocks:z,turnovers:w,fouls_committed:u,fouls_drawn:M}),U=n.querySelector(".cell-pts"),b=n.querySelector(".cell-efg"),H=n.querySelector(".cell-val"),J=n.querySelector(".cell-astto");U&&(U.textContent=P.points||0),b&&(b.textContent=`${P.eFG.toFixed(1)}%`),H&&(H.textContent=P.pir??0),J&&(J.textContent=w>0?(f/w).toFixed(1):f.toFixed(1))})})}),d&&((tt=a.querySelector("#btn-save-boxscore"))==null||tt.addEventListener("click",async()=>{var T;const n=a.querySelectorAll("tr[data-player-id]"),t=[],S=[],l=new Set;for(const g of n){const p=g.getAttribute("data-player-id");if(!p||l.has(p))continue;l.add(p);const $=(T=g.querySelector(".chk-starter"))==null?void 0:T.checked;$&&t.push(p);const i=w=>{var u;return Number(((u=g.querySelector(`.bs-input[data-field="${w}"]`))==null?void 0:u.value)||0)},k=i("fg2_made"),f=i("fg3_made"),m=i("ft_made"),z=k*2+f*3+m;S.push({game_id:o.id,player_id:p,starter:!!$,minutes:i("minutes"),points:z,fg2_made:k,fg2_attempted:i("fg2_attempted"),fg3_made:f,fg3_attempted:i("fg3_attempted"),ft_made:m,ft_attempted:i("ft_attempted"),off_reb:i("off_reb"),def_reb:i("def_reb"),rebounds_offensive:i("off_reb"),rebounds_defensive:i("def_reb"),assists:i("assists"),steals:i("steals"),blocks:i("blocks"),blocks_made:i("blocks"),turnovers:i("turnovers"),fouls_committed:i("fouls_committed"),fouls_drawn:i("fouls_drawn"),fouls_received:i("fouls_drawn")})}const F={...o,starter_ids:t};await y.saveGameAndStats(F,S),alert("✅ "+this.t("boxscore_saved_msg","BoxScore guardado y métricas recalculadas exitosamente.")),this.render(r,o.id)}))}}export{ct as GameBoxScoreView};
