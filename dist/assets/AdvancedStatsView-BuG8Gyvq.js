import{T as nt,I as Y,B as Z,D as c,S as tt}from"./index-Co3VTdK8.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";class gt{constructor(e=null){this.controller=e,this.viewMode="team",this.teamSortField="date",this.teamSortAsc=!1,this.playerSortField="valAvg",this.playerSortAsc=!1}t(e,n=""){return(nt?nt.t(e,n):Y.t(e,n))||n}_calculateFibaVal(e={}){if(Z&&typeof Z.calculatePlayerBoxScore=="function"){const u=Z.calculatePlayerBoxScore(e);return Number(u.pir??u.evaluation??u.val??0)}const n=Number(e.points??Number(e.fg2_made??e.fg2Made??0)*2+Number(e.fg3_made??e.fg3Made??0)*3+Number(e.ft_made??e.ftMade??0)),F=Number(e.off_reb??e.offReb??e.rebounds_offensive??0),x=Number(e.def_reb??e.defReb??e.rebounds_defensive??0),j=Number(e.rebounds??F+x),D=Number(e.assists??e.ast??0),B=Number(e.steals??e.stl??0),R=Number(e.blocks??e.blocks_made??e.blk??0),P=Number(e.fouls_drawn??e.foulsDrawn??e.fouls_received??0),z=Number(e.fg2_made??e.fg2Made??0),S=Number(e.fg2_attempted??e.fg2Attempted??0),E=Number(e.fg3_made??e.fg3Made??0),M=Number(e.fg3_attempted??e.fg3Attempted??0),k=Number(e.ft_made??e.ftMade??0),f=Number(e.ft_attempted??e.ftAttempted??0),V=Math.max(0,S+M-(z+E)),A=Math.max(0,f-k),I=Number(e.turnovers??e.tov??0),m=Number(e.blocks_received??e.blocksReceived??0),U=Number(e.fouls_committed??e.fouls??0);return n+j+D+B+R+P-(V+A+I+m+U)}async render(e="dashboard-content-area"){var ot,at,st,it;const n=document.getElementById(e)||document.getElementById("main-content")||document.querySelector(".app-main-content")||document.body;if(!n)return;const F=c.getActiveTeamId(),x=c.getGames(F)||c.getGames()||[],j=tt&&typeof tt.filterPlayedGames=="function"?tt.filterPlayedGames(x):x.filter(o=>Number(o.team_score??o.teamScore??0)>0||Number(o.opponent_score??o.opponentScore??0)>0),D=Math.max(1,j.length),B=((at=(ot=c).getSeasonParticipantPlayers)==null?void 0:at.call(ot,F))||c.getPlayers(F)||c.getPlayers()||[],R=c.getPlayerGameStats()||[];if(x.length===0){n.innerHTML=`
        <div style="padding: 24px; color: #475569; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
          ${this.t("no_games_recorded","No hay partidos registrados para analizar estadísticas avanzadas.")}
        </div>`;return}let P=0,z=0,S=0,E=0,M=0,k=0,f=0,V=0,A=0;(R||[]).forEach(o=>{P+=Number(o.fg2_made??o.fg2Made??0),z+=Number(o.fg2_attempted??o.fg2Attempted??0),S+=Number(o.fg3_made??o.fg3Made??0),E+=Number(o.fg3_attempted??o.fg3Attempted??0),M+=Number(o.ft_made??o.ftMade??0),k+=Number(o.ft_attempted??o.ftAttempted??0),f+=Number(o.off_reb??o.offReb??o.rebounds_offensive??0),V+=Number(o.def_reb??o.defReb??o.rebounds_defensive??0),A+=Number(o.turnovers??o.tov??0)});const I=P+S,m=z+E,U=m>0?((I+.5*S)/m*100).toFixed(1):"0.0",u=m+.44*k+A||D*70||70,dt=u>0?(A/u*100).toFixed(1):"0.0",et=f*1.5||30,lt=f+et>0?(f/(f+et)*100).toFixed(1):"0.0",pt=m>0?(M/m).toFixed(2):"0.00",d=(o,l,t)=>l!==o?'<span style="color:#cbd5e1;">↕</span>':`<span style="color:#f97316;">${t?"↑":"↓"}</span>`;let q="",J="";if(this.viewMode==="team"){const o=x.map(t=>{const p=Number(t.team_score??t.teamScore??t.our_score??0),s=Number(t.opponent_score??t.opponentScore??t.opp_score??0),i=p>s,O=p-s,G=c.getPlayerGameStats(null,t.id)||[];let N=0,h=0,y=0,v=0,g=0,w=0,T=0,$=0;G.forEach(r=>{N+=Number(r.fg2_made??r.fg2Made??0),h+=Number(r.fg2_attempted??r.fg2Attempted??0),y+=Number(r.fg3_made??r.fg3Made??0),v+=Number(r.fg3_attempted??r.fg3Attempted??0),g+=Number(r.ft_made??r.ftMade??0),w+=Number(r.ft_attempted??r.ftAttempted??0),T+=Number(r.off_reb??r.offReb??r.rebounds_offensive??0),$+=Number(r.turnovers??r.tov??0)});const b=h+v,H=N+y,W=b>0?Number(((H+.5*y)/b*100).toFixed(1)):0,C=b+.44*w+$||70,K=C>0?Number(($/C*100).toFixed(1)):0,a=b>0?Number((g/b).toFixed(2)):0,_=String(t.venue||"").toLowerCase(),L=_==="home"||_==="local"||t.is_home||t.isHome?this.t("local","Local"):this.t("visitor","Visitante"),Q=t.opponent||t.opponent_name||t.opponentName||this.t("opponent","Rival"),X=t.date?Y.formatDate?Y.formatDate(t.date):t.date:"-";return{id:t.id,date:t.date||"",formattedDate:X,opponentText:Q,venueText:L,teamScore:p,oppScore:s,isWin:i,diff:O,efg:W,tovPct:K,offReb:T,ftRate:a}});o.sort((t,p)=>{let s=t[this.teamSortField],i=p[this.teamSortField];return this.teamSortField==="date"&&(s=new Date(t.date||0).getTime(),i=new Date(p.date||0).getTime()),typeof s=="string"?this.teamSortAsc?s.localeCompare(i):i.localeCompare(s):this.teamSortAsc?s-i:i-s});const l=o.map(t=>`
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <td style="padding: 12px 14px; font-weight: 700; color: #0f172a;">
            vs ${t.opponentText}
            <div style="font-size: 11px; color: #64748b; font-weight: 500;">${t.formattedDate} · ${t.venueText}</div>
          </td>
          <td style="padding: 12px; text-align: center;">
            <span style="font-weight: 900; color: ${t.isWin?"#16a34a":"#dc2626"}; background: #f8fafc; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              ${t.teamScore} - ${t.oppScore}
            </span>
          </td>
          <td style="padding: 12px; text-align: center; font-weight: 800; color: #7c3aed;">${t.efg>0?`${t.efg.toFixed(1)}%`:"-"}</td>
          <td style="padding: 12px; text-align: center; font-weight: 700; color: #dc2626;">${t.tovPct>0?`${t.tovPct.toFixed(1)}%`:"-"}</td>
          <td style="padding: 12px; text-align: center; font-weight: 700; color: #2563eb;">${t.offReb}</td>
          <td style="padding: 12px; text-align: center; font-weight: 700; color: #16a34a;">${t.ftRate>0?t.ftRate.toFixed(2):"-"}</td>
        </tr>
      `).join("");q=`
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #f8fafc; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
              <th class="th-sort-team" data-field="date" style="padding: 12px 14px; cursor: pointer;">
                ${this.t("games","PARTIDO").toUpperCase()} ${d("date",this.teamSortField,this.teamSortAsc)}
              </th>
              <th class="th-sort-team" data-field="diff" style="padding: 12px; text-align: center; cursor: pointer;">
                ${this.t("score","RESULTADO").toUpperCase()} ${d("diff",this.teamSortField,this.teamSortAsc)}
              </th>
              <th class="th-sort-team" data-field="efg" style="padding: 12px; text-align: center; color: #7c3aed; cursor: pointer;">
                <span class="has-tooltip">
                  eFG% <span class="info-badge">?</span>
                  <span class="tooltip-box">Effective Field Goal %: Mide la eficacia de tiro premiando en un 50% el triple. Fórmula: [(FGM + 0.5 × 3PM) / FGA].</span>
                </span>
                ${d("efg",this.teamSortField,this.teamSortAsc)}
              </th>
              <th class="th-sort-team" data-field="tovPct" style="padding: 12px; text-align: center; color: #dc2626; cursor: pointer;">
                <span class="has-tooltip">
                  TOV% <span class="info-badge">?</span>
                  <span class="tooltip-box">Turnover Ratio: Porcentaje estimado de posesiones que terminan en pérdida de balón. Fórmula: [TOV / Posesiones].</span>
                </span>
                ${d("tovPct",this.teamSortField,this.teamSortAsc)}
              </th>
              <th class="th-sort-team" data-field="offReb" style="padding: 12px; text-align: center; color: #2563eb; cursor: pointer;">
                <span class="has-tooltip">
                  REB OFF <span class="info-badge">?</span>
                  <span class="tooltip-box">Rebotes ofensivos capturados por el equipo en el partido.</span>
                </span>
                ${d("offReb",this.teamSortField,this.teamSortAsc)}
              </th>
              <th class="th-sort-team" data-field="ftRate" style="padding: 12px; text-align: center; color: #16a34a; cursor: pointer;">
                <span class="has-tooltip">
                  FT RATE <span class="info-badge">?</span>
                  <span class="tooltip-box">Free Throw Rate: Tiros libres convertidos en relación con los tiros de campo intentados. Fórmula: [FTM / FGA].</span>
                </span>
                ${d("ftRate",this.teamSortField,this.teamSortAsc)}
              </th>
            </tr>
          </thead>
          <tbody>${l}</tbody>
        </table>
      `,J=o.map(t=>`
        <div class="adv-card-mobile card" style="padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px;">
            <strong style="color: #0f172a;">vs ${t.opponentText}</strong>
            <span style="padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 11px; background: ${t.isWin?"#dcfce7":"#fee2e2"}; color: ${t.isWin?"#15803d":"#b91c1c"};">${t.teamScore} - ${t.oppScore}</span>
          </div>
          <div style="display: flex; justify-content: space-between; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">eFG%</span><strong style="color: #7c3aed; font-size: 14px;">${t.efg.toFixed(1)}%</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">TOV%</span><strong style="color: #dc2626; font-size: 14px;">${t.tovPct.toFixed(1)}%</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">RO</span><strong style="color: #2563eb; font-size: 14px;">${t.offReb}</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">FTR</span><strong style="color: #16a34a; font-size: 14px;">${t.ftRate.toFixed(2)}</strong></div>
          </div>
        </div>
      `).join("")}else{const o=B.map(t=>{const s=(R||[]).filter(a=>String(a.player_id??a.playerId)===String(t.id)).filter(a=>Number(a.minutes??a.minutesPlayed??0)>0),i=s.length;let O=0,G=0,N=0,h=0,y=0,v=0,g=0,w=0;s.forEach(a=>{const _=Number(a.fg2_made??a.fg2Made??0),rt=Number(a.fg2_attempted??a.fg2Attempted??0),L=Number(a.fg3_made??a.fg3Made??0),Q=Number(a.fg3_attempted??a.fg3Attempted??0),X=Number(a.ft_made??a.ftMade??0);G+=_,N+=rt,h+=L,y+=Q,v+=Number(a.assists??a.ast??0),g+=Number(a.turnovers??a.tov??0),O+=a.points!==void 0&&a.points!==null&&Number(a.points)>0?Number(a.points):_*2+L*3+X,w+=this._calculateFibaVal(a)});const T=N+y,$=G+h,b=T>0?Number((($+.5*h)/T*100).toFixed(1)):0,H=g>0?Number((v/g).toFixed(1)):v,W=i>0?Number((w/i).toFixed(1)):0,C=`${t.first_name||t.firstName||""} ${t.last_name||t.lastName||""}`.trim()||t.name||"Jugador",K=t.jersey!==void 0&&t.jersey!==null?Number(t.jersey):99;return{id:t.id,jerseyNum:K,fullName:C,position:t.primary_position||t.primaryPosition||"Jugador",gp:i,pts:O,efg:b,valAvg:W,astTo:H,tov:g}});o.sort((t,p)=>{let s=t[this.playerSortField],i=p[this.playerSortField];return this.playerSortField==="name"?(s=t.fullName.toLowerCase(),i=p.fullName.toLowerCase(),this.playerSortAsc?s.localeCompare(i):i.localeCompare(s)):this.playerSortAsc?Number(s)-Number(i):Number(i)-Number(s)});const l=o.map(t=>`
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px; cursor: pointer;" onclick="window.location.hash='#/player/${t.id}'">
          <td style="padding: 12px 14px; font-weight: 700; color: #0f172a;">#${t.jerseyNum!==99?t.jerseyNum:"-"} ${t.fullName}</td>
          <td style="padding: 12px; text-align: center; font-weight: 800; color: #0f172a;">${t.pts}</td>
          <td style="padding: 12px; text-align: center; font-weight: 800; color: #7c3aed;">${t.efg.toFixed(1)}%</td>
          <td style="padding: 12px; text-align: center; font-weight: 900; color: #a855f7; font-size: 14px;">${t.valAvg.toFixed(1)}</td>
          <td style="padding: 12px; text-align: center; font-weight: 700; color: #166534;">${t.astTo.toFixed(1)}</td>
          <td style="padding: 12px; text-align: center; font-weight: 700; color: #dc2626;">${t.tov}</td>
        </tr>
      `).join("");q=`
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #f8fafc; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
              <th class="th-sort-player" data-field="name" style="padding: 12px 14px; cursor: pointer;">
                ${this.t("players","JUGADOR").toUpperCase()} ${d("name",this.playerSortField,this.playerSortAsc)}
              </th>
              <th class="th-sort-player" data-field="pts" style="padding: 12px; text-align: center; cursor: pointer;">
                <span class="has-tooltip">
                  ${this.t("total_points","PTS TOTALES").toUpperCase()} <span class="info-badge">?</span>
                  <span class="tooltip-box">Puntos totales acumulados: 2×T2C + 3×T3C + TLC.</span>
                </span>
                ${d("pts",this.playerSortField,this.playerSortAsc)}
              </th>
              <th class="th-sort-player" data-field="efg" style="padding: 12px; text-align: center; color: #7c3aed; cursor: pointer;">
                <span class="has-tooltip">
                  eFG% ACUM. <span class="info-badge">?</span>
                  <span class="tooltip-box">Porcentaje de tiro efectivo acumulado. Fórmula: [(FGM + 0.5 × 3PM) / FGA].</span>
                </span>
                ${d("efg",this.playerSortField,this.playerSortAsc)}
              </th>
              <th class="th-sort-player" data-field="valAvg" style="padding: 12px; text-align: center; color: #a855f7; cursor: pointer;">
                <span class="has-tooltip">
                  VAL / PJ <span class="info-badge">?</span>
                  <span class="tooltip-box">Valoración Oficial FIBA por Partido: (PTS + REB + AST + ROB + TAP + FP_REC) - (TC_FALL + TL_FALL + PER + TAP_REC + FP_COM) dividido entre los partidos disputados (MIN > 0).</span>
                </span>
                ${d("valAvg",this.playerSortField,this.playerSortAsc)}
              </th>
              <th class="th-sort-player" data-field="astTo" style="padding: 12px; text-align: center; color: #166534; cursor: pointer;">
                <span class="has-tooltip">
                  RATIO AST/TO <span class="info-badge">?</span>
                  <span class="tooltip-box">Ratio de pase: Asistencias repartidas por cada pérdida de balón cometida. Fórmula: [AST / TOV].</span>
                </span>
                ${d("astTo",this.playerSortField,this.playerSortAsc)}
              </th>
              <th class="th-sort-player" data-field="tov" style="padding: 12px; text-align: center; color: #dc2626; cursor: pointer;">
                <span class="has-tooltip">
                  ${this.t("turnovers","PÉRDIDAS").toUpperCase()} <span class="info-badge">?</span>
                  <span class="tooltip-box">Total acumulado de pérdidas de balón en la temporada.</span>
                </span>
                ${d("tov",this.playerSortField,this.playerSortAsc)}
              </th>
            </tr>
          </thead>
          <tbody>${l}</tbody>
        </table>
      `,J=o.map(t=>`
        <div class="adv-card-mobile card" style="padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; display: flex; flex-direction: column; gap: 8px; cursor: pointer;" onclick="window.location.hash='#/player/${t.id}'">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px;">
            <strong style="color: #0f172a;">#${t.jerseyNum!==99?t.jerseyNum:"-"} ${t.fullName}</strong>
            <span style="font-size: 11px; color: #475569; font-weight: 600;">${t.position}</span>
          </div>
          <div style="display: flex; justify-content: space-between; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">PTS</span><strong style="font-size: 14px; color: #0f172a;">${t.pts}</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">eFG%</span><strong style="color: #7c3aed; font-size: 14px;">${t.efg.toFixed(1)}%</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">VAL/PJ</span><strong style="color: #a855f7; font-size: 14px;">${t.valAvg.toFixed(1)}</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">AST/TO</span><strong style="color: #166534; font-size: 14px;">${t.astTo.toFixed(1)}</strong></div>
          </div>
        </div>
      `).join("")}n.innerHTML=`
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">

        <!-- Header y Selector de Modo -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">
              📈 ${this.t("advanced_stats","Estadísticas Avanzadas")} & Four Factors
            </h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #475569;">
              ${this.t("advanced_subtitle","Factores clave de rendimiento y métricas de eficiencia.")}
            </p>
          </div>

          <!-- TOGGLE EQUIPO / JUGADORES -->
          <div style="background: #e2e8f0; padding: 4px; border-radius: 10px; display: flex; gap: 4px;">
            <button id="btn-mode-team" style="padding: 10px 18px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; min-height: 44px; background: ${this.viewMode==="team"?"#0f172a":"transparent"}; color: ${this.viewMode==="team"?"#ffffff":"#334155"};">
              🏀 ${this.t("team","Equipo")}
            </button>
            <button id="btn-mode-players" style="padding: 10px 18px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; min-height: 44px; background: ${this.viewMode==="players"?"#0f172a":"transparent"}; color: ${this.viewMode==="players"?"#ffffff":"#334155"};">
              👤 ${this.t("players","Jugadores")}
            </button>
          </div>
        </div>

        <!-- TARJETAS DE FOUR FACTORS GLOBALES -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="card" style="padding: 18px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">
              <span class="has-tooltip">
                EFECTIVE FG (eFG%) <span class="info-badge">?</span>
                <span class="tooltip-box">Effective Field Goal %: Mide la eficacia de tiro bonificando en un 50% los triples anotados. Fórmula: [(FGM + 0.5 × 3PM) / FGA].</span>
              </span>
            </div>
            <div style="font-size: 26px; font-weight: 900; color: #7c3aed; margin-top: 4px;">${U}%</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${this.t("efg_desc","Eficiencia en tiros de campo")}</div>
          </div>

          <div class="card" style="padding: 18px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">
              <span class="has-tooltip">
                TURNOVER RATIO (TOV%) <span class="info-badge">?</span>
                <span class="tooltip-box">Turnover Percentage: Porcentaje de posesiones propias que terminan en pérdida de balón. Fórmula: [TOV / Posesiones].</span>
              </span>
            </div>
            <div style="font-size: 26px; font-weight: 900; color: #dc2626; margin-top: 4px;">${dt}%</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${this.t("tov_desc","Pérdidas estimadas por 100 pos.")}</div>
          </div>

          <div class="card" style="padding: 18px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">
              <span class="has-tooltip">
                REBOTE OFENSIVO (ORB%) <span class="info-badge">?</span>
                <span class="tooltip-box">Offensive Rebound %: Porcentaje de rebotes ofensivos capturados sobre los rechaces en ataque disponibles. Fórmula: [ORB / (ORB + Opp DRB)].</span>
              </span>
            </div>
            <div style="font-size: 26px; font-weight: 900; color: #2563eb; margin-top: 4px;">${lt}%</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${this.t("orb_desc","Porcentaje de rechaces ofensivos")}</div>
          </div>

          <div class="card" style="padding: 18px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">
              <span class="has-tooltip">
                FREE THROW RATE (FTR) <span class="info-badge">?</span>
                <span class="tooltip-box">Free Throw Rate: Capacidad de generar puntos desde el tiro libre por cada tiro de campo lanzado. Fórmula: [FTM / FGA].</span>
              </span>
            </div>
            <div style="font-size: 26px; font-weight: 900; color: #16a34a; margin-top: 4px;">${pt}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${this.t("ftr_desc","Tiros libres anotados por TC")}</div>
          </div>
        </div>

        <!-- TABLA DESKTOP / TARJETAS MÓVIL -->
        <div class="desktop-only" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; overflow-x: visible; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          ${q}
        </div>

        <div class="mobile-only mobile-adv-grid" style="display: flex; flex-direction: column; gap: 12px;">
          ${J}
        </div>

      </div>

      <style>
        .has-tooltip {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }
        .info-badge {
          background: #cbd5e1;
          color: #334155;
          border-radius: 50%;
          width: 14px;
          height: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 800;
          transition: all 0.2s ease;
        }
        .has-tooltip:hover .info-badge {
          background: #f97316;
          color: #ffffff;
        }
        .tooltip-box {
          visibility: hidden;
          opacity: 0;
          width: 250px;
          background-color: #0f172a;
          color: #ffffff;
          text-align: center;
          border-radius: 8px;
          padding: 10px 12px;
          position: absolute;
          z-index: 9999 !important;
          bottom: 135%;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          font-weight: 600;
          line-height: 1.4;
          text-transform: none;
          box-shadow: 0 8px 20px rgba(0,0,0,0.3);
          transition: opacity 0.2s ease, visibility 0.2s ease;
          pointer-events: none;
        }
        .tooltip-box::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -6px;
          border-width: 6px;
          border-style: solid;
          border-color: #0f172a transparent transparent transparent;
        }
        .has-tooltip:hover .tooltip-box {
          visibility: visible;
          opacity: 1;
        }

        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
        }
      </style>
    `,(st=n.querySelector("#btn-mode-team"))==null||st.addEventListener("click",()=>{this.viewMode="team",this.render(e)}),(it=n.querySelector("#btn-mode-players"))==null||it.addEventListener("click",()=>{this.viewMode="players",this.render(e)}),n.querySelectorAll(".th-sort-team").forEach(o=>{o.addEventListener("click",()=>{const l=o.getAttribute("data-field");this.teamSortField===l?this.teamSortAsc=!this.teamSortAsc:(this.teamSortField=l,this.teamSortAsc=!1),this.render(e)})}),n.querySelectorAll(".th-sort-player").forEach(o=>{o.addEventListener("click",()=>{const l=o.getAttribute("data-field");this.playerSortField===l?this.playerSortAsc=!this.playerSortAsc:(this.playerSortField=l,this.playerSortAsc=!1),this.render(e)})})}}export{gt as AdvancedStatsView};
