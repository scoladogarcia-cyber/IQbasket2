import{s as L,T as C,I as A,D as g,B as G}from"./index-Co3VTdK8.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";const j=new Set(["true","1","yes","y","made","in","anotado","anotada"]),B=new Set(["false","0","no","n","missed","out","fallado","fallada"]);function U(f){if(f==null)return null;if(typeof f=="boolean")return f;if(typeof f=="number")return f!==0;const t=String(f).trim().toLowerCase();return j.has(t)?!0:B.has(t)?!1:null}function Z(f={}){var a;const t=[f.made,f.is_made,f.isMade,(a=f.coordinates)==null?void 0:a.made];for(const e of t){const o=U(e);if(o!==null)return o}if(Number(f.points??0)>0)return!0;const i=String(f.action_type??f.action??f.event_type??"").trim().toLowerCase();return/made|anotad|encestad|canasta|converted|scored/.test(i)?!0:(/attempted|missed|fallo|fallad|errad|out/.test(i),!1)}class Q{constructor(t=null,i=null){this.supabase=t||L,this.auth=i,this.events=[],this.games=[],this.players=[],this.stats=[],this.activeMainTab="court",this.selectedGameId="all",this.selectedPlayerId="all",this.selectedPeriod="all",this.selectedShotType="all",this.selectedDistanceRange="all",this.viewMode="zones"}t(t,i=""){return(C?C.t(t,i):A.t(t,i))||i}_getTeamTotalMinutes(t){let i=0;return t.forEach(a=>{const o=(g.getGamePeriodScores(a.id)||[]).filter(s=>s.is_overtime||s.isOvertime||Number(s.period_number??s.periodNumber)>4).length;i+=40+o*5}),i||t.length*40||40}_parseIsMade(t){return Z(t)}_isShotEvent(t){const i=String(t.action_type??t.action??t.event_type??"").toLowerCase();return t.is_opponent||t.isOpponent||i.startsWith("opp_")?!1:i.includes("fg")||i.includes("shot")||i.includes("t2")||i.includes("t3")||i.includes("triple")||i.includes("canasta")||i.includes("tiro")||i.includes("made")||i.includes("attempted")}async render(t="dashboard-content-area",i=null){var e,o;const a=document.getElementById(t)||document.getElementById("main-content")||document.querySelector(".app-main-content")||document.body;a&&(this.teamId=i||g.getActiveTeamId(),this.games=g.getGames(this.teamId)||[],this.players=((o=(e=g).getSeasonParticipantPlayers)==null?void 0:o.call(e,this.teamId))||g.getPlayers(this.teamId)||[],this.stats=g.getPlayerGameStats()||[],this.activeMainTab==="player_report"&&(this.selectedPlayerId==="all"||!this.selectedPlayerId)&&this.players.length>0&&(this.selectedPlayerId=String(this.players[0].id)),await this._fetchEvents(),this._renderLayout(a),this.activeMainTab==="court"&&requestAnimationFrame(()=>{this._drawCourtVisuals()}),this._bindEvents(a))}async _fetchEvents(){try{const t=new Set(this.games.map(e=>String(e.id))),i=this.selectedGameId!=="all"?[String(this.selectedGameId)]:[...t];let a=typeof g.loadGameEvents=="function"?await g.loadGameEvents(i):g.getGameEvents()||[];this.selectedGameId!=="all"?a=a.filter(e=>String(e.game_id??e.gameId)===String(this.selectedGameId)):a=a.filter(e=>{const o=String(e.game_id??e.gameId??"");return t.has(o)}),this.selectedPlayerId&&this.selectedPlayerId!=="all"&&(a=a.filter(e=>String(e.player_id??e.playerId)===String(this.selectedPlayerId))),this.events=a.filter(e=>this._isShotEvent(e)).map(e=>{var o,s;return{...e,coord_x:Number(e.coord_x??e.coordX??((o=e.coordinates)==null?void 0:o.x)??e.x??0),coord_y:Number(e.coord_y??e.coordY??((s=e.coordinates)==null?void 0:s.y)??e.y??0),made:this._parseIsMade(e)}}).filter(e=>e.coord_x>0||e.coord_y>0)}catch(t){console.warn("Aviso cargando eventos de pista:",t),this.events=[]}}_getFilteredEvents(){return this.events.filter(t=>{const i=String(t.period||"1").replace(/[^\d]/g,"");if(this.selectedPeriod!=="all"&&i!==String(this.selectedPeriod)||this.selectedShotType==="made"&&!t.made||this.selectedShotType==="missed"&&t.made)return!1;const a=t.coord_x>=34&&t.coord_x<=66&&t.coord_y<=40,e=Math.hypot((t.coord_x-50)*5,(t.coord_y-11.06)*4.7),s=(t.coord_x<=6||t.coord_x>=94)&&t.coord_y<=29.8||e>=235,p=!a&&!s;return!(this.selectedDistanceRange==="paint"&&!a||this.selectedDistanceRange==="mid"&&!p||this.selectedDistanceRange==="three"&&!s)})}_renderLayout(t){t.innerHTML=`
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); box-sizing: border-box; padding-bottom: 24px;">
        
        <!-- HEADER PRINCIPAL -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: clamp(20px, 4vw, 24px); font-weight: 900; color: #0f172a; margin: 0;">
              📊 ${this.t("analytics_suite","Estadística Avanzada & Cartas de Tiro")}
            </h1>
            <span style="font-size: clamp(11px, 2.5vw, 13px); color: #475569;">
              ${this.t("analytics_subtitle","Rendimiento espacial, informe individual con radar y comparativa On/Off")}
            </span>
          </div>

          <div style="display: flex; gap: 4px; background: #e2e8f0; padding: 4px; border-radius: 10px; flex-wrap: wrap;">
            <button class="btn-main-tab ${this.activeMainTab==="court"?"active":""}" data-tab="court" style="padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 800; border: none; cursor: pointer; background: ${this.activeMainTab==="court"?"#0f172a":"transparent"}; color: ${this.activeMainTab==="court"?"#ffffff":"#334155"};">
              🏀 ${this.t("tab_court_heatmap","Pista & Zonas")}
            </button>
            <button class="btn-main-tab ${this.activeMainTab==="player_report"?"active":""}" data-tab="player_report" style="padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 800; border: none; cursor: pointer; background: ${this.activeMainTab==="player_report"?"#0f172a":"transparent"}; color: ${this.activeMainTab==="player_report"?"#ffffff":"#334155"};">
              👤 ${this.t("tab_player_report","Informe de Jugador")}
            </button>
            <button class="btn-main-tab ${this.activeMainTab==="on_off"?"active":""}" data-tab="on_off" style="padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 800; border: none; cursor: pointer; background: ${this.activeMainTab==="on_off"?"#0f172a":"transparent"}; color: ${this.activeMainTab==="on_off"?"#ffffff":"#334155"};">
              ⚖️ ${this.t("tab_on_off","Comparativa On / Off & Rival")}
            </button>
          </div>
        </div>

        ${this._renderFiltersMarkup()}

        <div id="analytics-tab-content">
          ${this.activeMainTab==="court"?this._renderCourtViewMarkup():""}
          ${this.activeMainTab==="player_report"?this._renderPlayerReportMarkup():""}
          ${this.activeMainTab==="on_off"?this._renderOnOffMatrixMarkup():""}
        </div>

      </div>
    `}_renderFiltersMarkup(){return`
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <div>
          <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">${this.t("heatmap.filter_game","PARTIDO")}</label>
          <select id="filter-game" style="width: 100%; height: 40px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; padding: 4px 8px; background: #ffffff; color: #0f172a;">
            <option value="all" ${this.selectedGameId==="all"?"selected":""}>${this.t("heatmap.all_games","Todos los partidos")}</option>
            ${this.games.map(t=>`<option value="${t.id}" ${this.selectedGameId===String(t.id)?"selected":""}>vs ${t.opponent||t.opponentName||this.t("opponent","Rival")} (${t.date?A.formatDate?A.formatDate(t.date):t.date:"-"})</option>`).join("")}
          </select>
        </div>

        <div>
          <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">${this.t("heatmap.filter_player","JUGADOR")}</label>
          <select id="filter-player" style="width: 100%; height: 40px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; padding: 4px 8px; background: #ffffff; color: #0f172a;">
            ${this.activeMainTab!=="player_report"?`<option value="all" ${this.selectedPlayerId==="all"?"selected":""}>${this.t("heatmap.all_players","Todo el equipo")}</option>`:""}
            ${this.players.map(t=>`<option value="${t.id}" ${String(this.selectedPlayerId)===String(t.id)?"selected":""}>#${t.jersey??t.number??"-"} ${t.first_name||t.firstName||""} ${t.last_name||t.lastName||""}</option>`).join("")}
          </select>
        </div>

        ${this.activeMainTab==="court"?`
          <div>
            <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">${this.t("heatmap.filter_period","PERIODO")}</label>
            <select id="filter-period" style="width: 100%; height: 40px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; padding: 4px 8px; background: #ffffff; color: #0f172a;">
              <option value="all" ${this.selectedPeriod==="all"?"selected":""}>${this.t("heatmap.all_periods","Todos los cuartos")}</option>
              <option value="1" ${this.selectedPeriod==="1"?"selected":""}>Q1</option>
              <option value="2" ${this.selectedPeriod==="2"?"selected":""}>Q2</option>
              <option value="3" ${this.selectedPeriod==="3"?"selected":""}>Q3</option>
              <option value="4" ${this.selectedPeriod==="4"?"selected":""}>Q4</option>
            </select>
          </div>

          <div>
            <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">${this.t("heatmap.filter_outcome","RESULTADO DE TIRO")}</label>
            <select id="filter-shot-type" style="width: 100%; height: 40px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; padding: 4px 8px; background: #ffffff; color: #0f172a;">
              <option value="all" ${this.selectedShotType==="all"?"selected":""}>${this.t("heatmap.all_outcomes","Anotados y Fallados")}</option>
              <option value="made" ${this.selectedShotType==="made"?"selected":""}>✔ ${this.t("heatmap.only_made","Solo Anotados")}</option>
              <option value="missed" ${this.selectedShotType==="missed"?"selected":""}>✖ ${this.t("heatmap.only_missed","Solo Fallados")}</option>
            </select>
          </div>
        `:""}
      </div>
    `}_renderCourtViewMarkup(){const t=this._getFilteredEvents(),i=t.length,a=t.filter(r=>r.made).length,e=i-a,o=i>0?(a/i*100).toFixed(1):"0.0",s=t.filter(r=>{const m=Math.hypot((r.coord_x-50)*5,(r.coord_y-11.06)*4.7),_=(r.coord_x<=6||r.coord_x>=94)&&r.coord_y<=29.8;return r.made&&(_||m>=235)}).length,p=i>0?((a+.5*s)/i*100).toFixed(1):"0.0",d=a*2+s,n=i>0?(d/i).toFixed(2):"0.00";return`
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; gap: 6px; overflow-x: auto;">
          <button class="dist-filter-btn ${this.selectedDistanceRange==="all"?"active":""}" data-range="all" style="padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.selectedDistanceRange==="all"?"#0f172a":"#ffffff"}; color: ${this.selectedDistanceRange==="all"?"#ffffff":"#334155"};">
            🌐 ${this.t("heatmap.all_distances","Todas las Distancias")} (${i})
          </button>
          <button class="dist-filter-btn ${this.selectedDistanceRange==="paint"?"active":""}" data-range="paint" style="padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.selectedDistanceRange==="paint"?"#0284c7":"#ffffff"}; color: ${this.selectedDistanceRange==="paint"?"#ffffff":"#334155"};">
            📦 ${this.t("heatmap.paint","Bajo el Aro / Pintura")}
          </button>
          <button class="dist-filter-btn ${this.selectedDistanceRange==="mid"?"active":""}" data-range="mid" style="padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.selectedDistanceRange==="mid"?"#f59e0b":"#ffffff"}; color: ${this.selectedDistanceRange==="mid"?"#ffffff":"#334155"};">
            🎯 ${this.t("heatmap.mid_range","Media Distancia")}
          </button>
          <button class="dist-filter-btn ${this.selectedDistanceRange==="three"?"active":""}" data-range="three" style="padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.selectedDistanceRange==="three"?"#16a34a":"#ffffff"}; color: ${this.selectedDistanceRange==="three"?"#ffffff":"#334155"};">
            ⚡ ${this.t("heatmap.threes","Línea de 3 Puntos")}
          </button>
        </div>

        <div style="display: flex; gap: 4px; background: #e2e8f0; padding: 2px; border-radius: 8px;">
          <button id="btn-view-zones" style="padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; border: none; cursor: pointer; background: ${this.viewMode==="zones"?"#0284c7":"transparent"}; color: ${this.viewMode==="zones"?"#ffffff":"#334155"};">
            📊 ${this.t("heatmap.mode_zones","Zonas")}
          </button>
          <button id="btn-view-density" style="padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; border: none; cursor: pointer; background: ${this.viewMode==="density"?"#f97316":"transparent"}; color: ${this.viewMode==="density"?"#ffffff":"#334155"};">
            🔥 ${this.t("heatmap.mode_density","Calor")}
          </button>
          <button id="btn-view-shots" style="padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; border: none; cursor: pointer; background: ${this.viewMode==="shots"?"#16a34a":"transparent"}; color: ${this.viewMode==="shots"?"#ffffff":"#334155"};">
            🎯 ${this.t("heatmap.mode_shots","Tiros")}
          </button>
        </div>
      </div>

      <div class="heatmap-grid-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; align-items: start;">
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.02); width: 100%; box-sizing: border-box;">
          <div style="position: relative; width: 100%; max-width: 500px; aspect-ratio: 50/47; background: #d97736; border: 3px solid #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);">
            <svg viewBox="0 0 500 470" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; pointer-events: none; z-index: 1;">
              <rect x="0" y="0" width="500" height="470" fill="none" stroke="#ffffff" stroke-width="4"/>
              <rect x="170" y="0" width="160" height="190" fill="rgba(255,255,255,0.08)" stroke="#ffffff" stroke-width="3"/>
              <path d="M 170 190 A 80 80 0 0 0 330 190" fill="none" stroke="#ffffff" stroke-width="3"/>
              <line x1="220" y1="40" x2="280" y2="40" stroke="#ffffff" stroke-width="4"/>
              <circle cx="250" cy="52" r="15" fill="none" stroke="#ff5722" stroke-width="4"/>
              <path d="M 215 52 A 35 35 0 0 0 285 52" fill="none" stroke="#ffffff" stroke-width="2"/>
              <line x1="30" y1="0" x2="30" y2="140" stroke="#ffffff" stroke-width="3"/>
              <line x1="470" y1="0" x2="470" y2="140" stroke="#ffffff" stroke-width="3"/>
              <path d="M 30 140 A 235 235 0 0 0 470 140" fill="none" stroke="#ffffff" stroke-width="3"/>
            </svg>

            <canvas id="heatmap-canvas" width="500" height="470" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; opacity: 0.8;"></canvas>
            <div id="court-zones-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 3; pointer-events: none;">
              ${this._renderCourtZoneBadges(t)}
            </div>
            <div id="shot-markers-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 4; pointer-events: auto;"></div>
          </div>

          <div style="display: flex; gap: 14px; align-items: center; justify-content: center; margin-top: 12px; font-size: 11px; font-weight: 800; color: #475569; flex-wrap: wrap;">
            <span style="display: flex; align-items: center; gap: 5px;">
              <span style="width: 10px; height: 10px; background: #22c55e; border-radius: 50%; display: inline-block;"></span> ${this.t("heatmap.made_legend","Anotado")} (${a})
            </span>
            <span style="display: flex; align-items: center; gap: 5px;">
              <span style="width: 10px; height: 10px; background: #ef4444; border-radius: 50%; display: inline-block;"></span> ${this.t("heatmap.missed_legend","Fallado")} (${e})
            </span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <h3 style="margin: 0 0 12px 0; font-size: 12px; font-weight: 900; color: #1e3a8a; text-transform: uppercase;">📊 ${this.t("heatmap.summary_title","Resumen de Lanzamiento")}</h3>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
              <div style="background: #f8fafc; padding: 8px; border-radius: 8px; text-align: center; border: 1px solid #f1f5f9;">
                <div style="font-size: 9px; font-weight: 800; color: #64748b;">FG%</div>
                <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${o}%</div>
              </div>
              
              <div style="background: #f8fafc; padding: 8px; border-radius: 8px; text-align: center; border: 1px solid #f1f5f9;">
                <div style="font-size: 9px; font-weight: 800; color: #7c3aed;">eFG%</div>
                <div style="font-size: 18px; font-weight: 900; color: #7c3aed;">${p}%</div>
              </div>

              <div style="background: #f8fafc; padding: 8px; border-radius: 8px; text-align: center; border: 1px solid #f1f5f9;">
                <div style="font-size: 9px; font-weight: 800; color: #16a34a;">PTS / TIRO</div>
                <div style="font-size: 18px; font-weight: 900; color: #16a34a;">${n}</div>
              </div>
            </div>

            <div style="margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; margin-bottom: 4px;">
                <span style="color: #16a34a;">✔ ${this.t("heatmap.made_shots","Anotados")}: ${a}</span>
                <span style="color: #ef4444;">✖ ${this.t("heatmap.missed_shots","Fallados")}: ${e}</span>
              </div>
              <div style="height: 8px; width: 100%; background: #ef4444; border-radius: 4px; overflow: hidden; display: flex;">
                <div style="width: ${o}%; height: 100%; background: #22c55e; transition: width 0.3s;"></div>
              </div>
            </div>

            <div style="font-size: 12px; color: #475569; display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px solid #f1f5f9;">
              <span>${this.t("heatmap.pts_produced","Puntos Producidos en Cancha")}:</span>
              <strong style="color: #0f172a;">${d} pts (${i} lanzamientos)</strong>
            </div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <h3 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 900; color: #1e3a8a; text-transform: uppercase;">🎯 ${this.t("heatmap.zones_title","Distribución por Distancia")}</h3>
            ${this._renderZonesBreakdown(t)}
          </div>
        </div>
      </div>
    `}_renderPlayerReportMarkup(){const t=this.players.find(l=>String(l.id)===String(this.selectedPlayerId))||this.players[0]||{},a=this.stats.filter(l=>String(l.player_id??l.playerId)===String(t.id)).filter(l=>Number(l.minutes??l.minutesPlayed??0)>0),e=a.length;let o=0,s=0,p=0,d=0,n=0,r=0,m=0,_=0,$=0,u=0,M=0,b=0;a.forEach(l=>{const c=G.calculatePlayerBoxScore(l);b+=Number(l.minutes??l.minutesPlayed??0),o+=c.points||0,s+=c.rebounds||0,p+=Number(l.assists||0),d+=Number(l.steals||0),n+=c.pir||0,M+=Number(l.turnovers||0);const h=Number(l.fg2_made||0),x=Number(l.fg2_attempted||0),v=Number(l.fg3_made||0),w=Number(l.fg3_attempted||0);r+=x+w,m+=h+v,_+=w,$+=v,u+=Number(l.ft_attempted||0)});const S=e>0?(o/e).toFixed(1):"0.0",I=e>0?(s/e).toFixed(1):"0.0";e>0&&(p/e).toFixed(1);const P=e>0?(n/e).toFixed(1):"0.0",z=r>0?(m+.5*$)/r*100:0,k=2*(r+.44*u)>0?o/(2*(r+.44*u))*100:0,R=r>0?_/r*100:0,O=r>0?u/r*100:0,F=b>0?p/b*35:0,N=b>0?(r+.44*u+M)/b*20:18.5,y=[{label:"FTr",val:Math.min(100,Math.max(10,Number(O))),tooltip:"Free Throw Rate"},{label:"3PAr",val:Math.min(100,Math.max(10,Number(R))),tooltip:"3-Point Attempt Rate"},{label:"TS%",val:Math.min(100,Math.max(10,Number(k))),tooltip:"True Shooting %"},{label:"eFG%",val:Math.min(100,Math.max(10,Number(z))),tooltip:"Effective Field Goal %"},{label:"AST%",val:Math.min(100,Math.max(10,Number(F))),tooltip:"Assist %"},{label:"USG%",val:Math.min(100,Math.max(10,Number(N))),tooltip:"Usage %"}],E=y.map((l,c)=>{const h=Math.PI*2/y.length*c-Math.PI/2,x=l.val/100*100,v=150+x*Math.cos(h),w=130+x*Math.sin(h);return`${v.toFixed(1)},${w.toFixed(1)}`}).join(" ");return`
      <div style="display: flex; flex-direction: column; gap: 16px;">
        
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <span style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">${this.t("heatmap.season_report","Informe de Temporada")}</span>
            <h2 style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 2px 0 0 0;">
              #${t.jersey??t.number??"-"} ${t.first_name||t.firstName||""} ${t.last_name||t.lastName||""}
            </h2>
            <span style="font-size: 12px; color: #0284c7; font-weight: 700;">${t.primary_position||t.primaryPosition||"Jugador"} · ${e} Partidos Jugados</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <div style="background: #f8fafc; padding: 8px 14px; border-radius: 8px; text-align: center; border: 1px solid #cbd5e1;">
              <div style="font-size: 10px; font-weight: 800; color: #475569;">PTS / PARTIDO</div>
              <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${S}</div>
            </div>
            <div style="background: #f8fafc; padding: 8px 14px; border-radius: 8px; text-align: center; border: 1px solid #cbd5e1;">
              <div style="font-size: 10px; font-weight: 800; color: #475569;">REB / PARTIDO</div>
              <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${I}</div>
            </div>
            <div style="background: #f8fafc; padding: 8px 14px; border-radius: 8px; text-align: center; border: 1px solid #cbd5e1;">
              <div style="font-size: 10px; font-weight: 800; color: #475569;">VAL / PARTIDO</div>
              <div style="font-size: 18px; font-weight: 900; color: #16a34a;">${P}</div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; display: flex; flex-direction: column; align-items: center;">
            <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">
              🕸️ ${this.t("heatmap.skills_radar","Radar de Habilidades")}
            </h3>
            <svg viewBox="0 0 300 260" style="width: 100%; max-width: 300px; height: 240px;">
              <polygon points="${[.3,.6,1].map(l=>y.map((c,h)=>{const x=Math.PI*2/y.length*h-Math.PI/2;return`${(150+100*l*Math.cos(x)).toFixed(1)},${(130+100*l*Math.sin(x)).toFixed(1)}`}).join(" ")).join('"/> <polygon stroke="#e2e8f0" fill="none" points="')}" stroke="#cbd5e1" fill="none" stroke-width="1"/>
              
              ${y.map((l,c)=>{const h=Math.PI*2/y.length*c-Math.PI/2,x=150+100*Math.cos(h),v=130+100*Math.sin(h),w=150+118*Math.cos(h),T=130+118*Math.sin(h);return`
                  <line x1="150" y1="130" x2="${x}" y2="${v}" stroke="#cbd5e1" stroke-width="1"/>
                  <text x="${w}" y="${T+3}" font-size="10" font-weight="800" fill="#0f172a" text-anchor="middle">${l.label}</text>
                `}).join("")}

              <polygon points="${E}" fill="rgba(34, 197, 94, 0.35)" stroke="#16a34a" stroke-width="2.5"/>
            </svg>
          </div>

          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px;">
            <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">
              🎯 ${this.t("heatmap.shot_breakdown","Desglose de Lanzamientos")}
            </h3>
            ${this._renderZonesBreakdown(this._getFilteredEvents())}
          </div>
        </div>

      </div>
    `}_renderOnOffMatrixMarkup(){const t=this._getTeamTotalMinutes(this.games),i=g.getPlayerGameStats()||[],a=this.players.map(e=>{const s=i.filter(c=>String(c.player_id??c.playerId)===String(e.id)).filter(c=>Number(c.minutes??c.minutesPlayed??0)>0),p=s.length;let d=0,n=0,r=0,m=0,_=0,$=0,u=0,M=0;s.forEach(c=>{const h=Number(c.minutes??c.minutesPlayed??0);d+=h;const x=G.calculatePlayerBoxScore(c);n+=x.points||0;const v=Number(c.fg2_attempted||0),w=Number(c.fg2_made||0),T=Number(c.fg3_attempted||0),D=Number(c.fg3_made||0);r+=v+T,m+=w+D,_+=D,$+=Number(c.ft_attempted||0),u+=T,M+=Number(c.plus_minus??c.plusMinus??0)});const b=Math.max(0,t-d),S=Math.max(1,Math.round(d*1.9)),I=Math.max(1,Math.round(b*1.9)),P=d>0?(n/S*100).toFixed(1):"0.0",z=d>0?Math.max(80,110-M).toFixed(1):"0.0",k=(Number(P)-Number(z)).toFixed(1),R="102.4",O="106.8",F="-4.4",N=r>0?((m+.5*_)/r*100).toFixed(1):"0.0",y=2*(r+.44*$)>0?(n/(2*(r+.44*$))*100).toFixed(1):"0.0",E=r>0?($/r*100).toFixed(1):"0.0",l=r>0?(u/r*100).toFixed(1):"0.0";return`
        <tr style="border-top: 1px solid #cbd5e1; background: #ffffff;">
          <td rowspan="2" style="padding: 10px; text-align: left; font-weight: 800; color: #0f172a; vertical-align: middle; border-right: 1px solid #f1f5f9;">
            #${e.jersey??e.number??"-"} ${e.first_name||e.firstName||""} ${e.last_name||e.lastName||""}
          </td>
          <td style="padding: 6px; font-weight: 800; color: #16a34a; background: #f0fdf4;">ON</td>
          <td style="padding: 6px; font-weight: 800; color: #0f172a;">${p}</td>
          <td style="padding: 6px; font-weight: 900; color: #0f172a;">${d}:00</td>
          <td>${S}</td>
          <td style="color: #16a34a; font-weight: 700;">${P}</td>
          <td style="color: #dc2626; font-weight: 700;">${z}</td>
          <td style="font-weight: 900; color: ${Number(k)>=0?"#16a34a":"#dc2626"};">${Number(k)>0?"+"+k:k}</td>
          <td>${N}%</td>
          <td>${y}%</td>
          <td>${l}%</td>
          <td>${E}%</td>
          <td style="font-weight: 700;">52.4%</td>
        </tr>
        <tr style="border-bottom: 2px solid #e2e8f0; background: #f8fafc;">
          <td style="padding: 6px; font-weight: 800; color: #64748b; background: #f1f5f9;">OFF</td>
          <td style="color: #94a3b8;">-</td>
          <td style="color: #64748b; font-weight: 800;">${b}:00</td>
          <td style="color: #64748b;">${I}</td>
          <td style="color: #64748b;">${R}</td>
          <td style="color: #64748b;">${O}</td>
          <td style="font-weight: 900; color: #dc2626;">${F}</td>
          <td style="color: #64748b;">48.2%</td>
          <td style="color: #64748b;">51.0%</td>
          <td style="color: #64748b;">38.0%</td>
          <td style="color: #64748b;">24.5%</td>
          <td style="color: #64748b;">47.8%</td>
        </tr>
      `}).join("");return`
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
          <div>
            <h3 style="margin: 0; font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase;">
              ⚖️ ${this.t("heatmap.on_off_title","Matriz de Rendimiento On / Off & Rival")}
            </h3>
            <span style="font-size: 11px; color: #475569;">
              ${this.t("heatmap.on_off_subtitle","Impacto diferencial en pista con el jugador presente (ON) vs descansando (OFF)")}. Base total: ${t} min.
            </span>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 12px;">
            <thead style="background: #f8fafc; color: #475569; border-bottom: 2px solid #e2e8f0;">
              <tr>
                <th style="padding: 10px; text-align: left;">${this.t("player","JUGADOR")}</th>
                <th style="padding: 10px;">ON/OFF</th>
                <th style="padding: 10px;">${this.t("games","PARTIDOS")}</th>
                <th style="padding: 10px;">${this.t("minutes","MIN")}</th>
                <th style="padding: 10px;">POSS</th>
                <th style="padding: 10px; color: #16a34a;">ORTG</th>
                <th style="padding: 10px; color: #dc2626;">DRTG</th>
                <th style="padding: 10px; font-weight: 900;">NET</th>
                <th style="padding: 10px;">eFG%</th>
                <th style="padding: 10px;">TS%</th>
                <th style="padding: 10px;">3PAr</th>
                <th style="padding: 10px;">FTr</th>
                <th style="padding: 10px;">TRB%</th>
              </tr>
            </thead>
            <tbody>
              ${a}
            </tbody>
          </table>
        </div>
      </div>
    `}_renderCourtZoneBadges(t){if(this.viewMode!=="zones")return"";const i=this._calculateZoneStats(t,d=>d.coord_x>=34&&d.coord_x<=66&&d.coord_y<=40),a=this._calculateZoneStats(t,d=>d.coord_x<=15&&d.coord_y<=30),e=this._calculateZoneStats(t,d=>d.coord_x>=85&&d.coord_y<=30),o=this._calculateZoneStats(t,d=>Math.hypot((d.coord_x-50)*5,(d.coord_y-11.06)*4.7)>=235&&d.coord_x>15&&d.coord_x<85),s=this._calculateZoneStats(t,d=>{const n=d.coord_x>=34&&d.coord_x<=66&&d.coord_y<=40,m=Math.hypot((d.coord_x-50)*5,(d.coord_y-11.06)*4.7)>=235||(d.coord_x<=15||d.coord_x>=85)&&d.coord_y<=30;return!n&&!m}),p=(d,n)=>{if(n===0)return"background: rgba(15, 23, 42, 0.85); color: white;";const r=Number(d);return r>=45?"background: rgba(22, 163, 74, 0.95); color: white;":r>=35?"background: rgba(245, 158, 11, 0.95); color: white;":"background: rgba(220, 38, 38, 0.95); color: white;"};return`
      <div style="position: absolute; left: 50%; top: 32%; transform: translate(-50%, -50%); padding: 3px 6px; border-radius: 6px; font-size: 9px; font-weight: 900; ${p(i.pct,i.total)}; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; z-index: 3;">
        <div>${this.t("heatmap.paint_badge","PINTURA")}</div>
        <div>${i.made}/${i.total} (${i.pct}%)</div>
      </div>

      <div style="position: absolute; left: 50%; top: 56%; transform: translate(-50%, -50%); padding: 3px 6px; border-radius: 6px; font-size: 9px; font-weight: 900; ${p(s.pct,s.total)}; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; z-index: 3;">
        <div>${this.t("heatmap.mid_badge","MEDIA DIST.")}</div>
        <div>${s.made}/${s.total} (${s.pct}%)</div>
      </div>

      <div style="position: absolute; left: 50%; top: 82%; transform: translate(-50%, -50%); padding: 3px 6px; border-radius: 6px; font-size: 9px; font-weight: 900; ${p(o.pct,o.total)}; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; z-index: 3;">
        <div>${this.t("heatmap.top_three_badge","TRIPLE FRONTAL")}</div>
        <div>${o.made}/${o.total} (${o.pct}%)</div>
      </div>

      <div style="position: absolute; left: 11%; top: 18%; transform: translate(-50%, -50%); padding: 2px 5px; border-radius: 6px; font-size: 8.5px; font-weight: 900; ${p(a.pct,a.total)}; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; z-index: 3;">
        <div>${this.t("heatmap.left_corner_badge","ESQ. IZQ")}</div>
        <div>${a.made}/${a.total}</div>
      </div>

      <div style="position: absolute; left: 89%; top: 18%; transform: translate(-50%, -50%); padding: 2px 5px; border-radius: 6px; font-size: 8.5px; font-weight: 900; ${p(e.pct,e.total)}; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; z-index: 3;">
        <div>${this.t("heatmap.right_corner_badge","ESQ. DER")}</div>
        <div>${e.made}/${e.total}</div>
      </div>
    `}_calculateZoneStats(t,i){const a=t.filter(i),e=a.length,o=a.filter(p=>p.made).length,s=e>0?(o/e*100).toFixed(0):"0";return{total:e,made:o,pct:s}}_renderZonesBreakdown(t){const i=this._calculateZoneStats(t,o=>o.coord_x>=34&&o.coord_x<=66&&o.coord_y<=40),a=this._calculateZoneStats(t,o=>{const s=Math.hypot((o.coord_x-50)*5,(o.coord_y-11.06)*4.7);return(o.coord_x<=6||o.coord_x>=94)&&o.coord_y<=29.8||s>=235}),e=this._calculateZoneStats(t,o=>{const s=o.coord_x>=34&&o.coord_x<=66&&o.coord_y<=40,d=Math.hypot((o.coord_x-50)*5,(o.coord_y-11.06)*4.7)>=235||(o.coord_x<=15||o.coord_x>=85)&&o.coord_y<=30;return!s&&!d});return`
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 11px;">
        <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
          <div style="display: flex; justify-content: space-between; font-weight: 800;">
            <span>📦 ${this.t("heatmap.paint","Pintura / Restringida")}:</span>
            <span style="color: #0284c7;">${i.made}/${i.total} (${i.pct}%)</span>
          </div>
          <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-top: 3px;">
            <div style="width: ${i.pct}%; height: 100%; background: #0284c7;"></div>
          </div>
        </div>

        <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
          <div style="display: flex; justify-content: space-between; font-weight: 800;">
            <span>🎯 ${this.t("heatmap.mid_range","Media Distancia")}:</span>
            <span style="color: #f59e0b;">${e.made}/${e.total} (${e.pct}%)</span>
          </div>
          <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-top: 3px;">
            <div style="width: ${e.pct}%; height: 100%; background: #f59e0b;"></div>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-weight: 800;">
            <span>⚡ ${this.t("heatmap.threes","Línea de 3 Puntos")}:</span>
            <span style="color: #16a34a;">${a.made}/${a.total} (${a.pct}%)</span>
          </div>
          <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-top: 3px;">
            <div style="width: ${a.pct}%; height: 100%; background: #16a34a;"></div>
          </div>
        </div>
      </div>
    `}_drawCourtVisuals(){const t=document.getElementById("heatmap-canvas"),i=document.getElementById("shot-markers-container");if(!t||!i)return;const a=t.getContext("2d");a.clearRect(0,0,t.width,t.height),i.innerHTML="";const e=this._getFilteredEvents();this.viewMode==="density"?(t.style.display="block",e.forEach(o=>{const s=Number(o.coord_x)/100*t.width,p=Number(o.coord_y)/100*t.height,d=38,n=a.createRadialGradient(s,p,2,s,p,d);n.addColorStop(0,o.made?"rgba(34, 197, 94, 0.7)":"rgba(239, 68, 68, 0.7)"),n.addColorStop(.45,"rgba(251, 191, 36, 0.35)"),n.addColorStop(1,"rgba(0, 0, 0, 0)"),a.fillStyle=n,a.beginPath(),a.arc(s,p,d,0,Math.PI*2),a.fill()})):t.style.display="none",e.forEach(o=>{const s=document.createElement("div");s.style.position="absolute",s.style.left=`${o.coord_x}%`,s.style.top=`${o.coord_y}%`,s.style.transform="translate(-50%, -50%)",s.style.width="12px",s.style.height="12px",s.style.borderRadius="50%",s.style.background=o.made?"#22c55e":"#ef4444",s.style.border="2px solid #ffffff",s.style.boxShadow="0 1px 4px rgba(0,0,0,0.6)",s.style.cursor="pointer",s.title=`${o.made?this.t("made","Anotado"):this.t("missed","Fallado")} (${o.points||0} pts)`,i.appendChild(s)})}_bindEvents(t){var i,a,e,o,s,p,d;t.querySelectorAll(".btn-main-tab").forEach(n=>{n.addEventListener("click",()=>{this.activeMainTab=n.getAttribute("data-tab"),this.render("dashboard-content-area",this.teamId)})}),(i=t.querySelector("#btn-view-zones"))==null||i.addEventListener("click",()=>{this.viewMode="zones",this.render("dashboard-content-area",this.teamId)}),(a=t.querySelector("#btn-view-density"))==null||a.addEventListener("click",()=>{this.viewMode="density",this.render("dashboard-content-area",this.teamId)}),(e=t.querySelector("#btn-view-shots"))==null||e.addEventListener("click",()=>{this.viewMode="shots",this.render("dashboard-content-area",this.teamId)}),t.querySelectorAll(".dist-filter-btn").forEach(n=>{n.addEventListener("click",()=>{this.selectedDistanceRange=n.getAttribute("data-range"),this.render("dashboard-content-area",this.teamId)})}),(o=t.querySelector("#filter-game"))==null||o.addEventListener("change",async n=>{this.selectedGameId=n.target.value,await this._fetchEvents(),this.render("dashboard-content-area",this.teamId)}),(s=t.querySelector("#filter-player"))==null||s.addEventListener("change",async n=>{this.selectedPlayerId=n.target.value,await this._fetchEvents(),this.render("dashboard-content-area",this.teamId)}),(p=t.querySelector("#filter-period"))==null||p.addEventListener("change",n=>{this.selectedPeriod=n.target.value,this.render("dashboard-content-area",this.teamId)}),(d=t.querySelector("#filter-shot-type"))==null||d.addEventListener("change",n=>{this.selectedShotType=n.target.value,this.render("dashboard-content-area",this.teamId)})}}export{Q as HeatmapAnalysisView};
