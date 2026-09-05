import{T as D,I as B,P as U,D as M,B as O}from"./index-Co3VTdK8.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";class X{constructor(s=null){this.auth=s,this.selectedPlayerIds=[],this.modePerGame=!0,this.selectedMetric="pts",this.hasInitialized=!1,this.playerColors=["#1e3a8a","#f97316","#16a34a","#9333ea"]}t(s,a=""){return(D?D.t(s,a):B.t(s,a))||a}_canAccess(){var s,a;return!!((a=(s=this.auth)==null?void 0:s.canPreview)!=null&&a.call(s,U.USE_COMPARATOR))}_getPlayerStatsMap(){const s=new Map;return this.selectedPlayerIds.forEach(a=>{const h=M.getPlayerById(a);if(!h)return;const d=(M.getPlayerGameStats(a)||[]).filter(e=>Number(e.minutes??e.minutesPlayed??0)>0),i=d.length;let l=0,r=0,c=0,g=0,b=0,v=0,k=0,n=0,f=0,m=0,w=0,P=0,A=0,C=0,T=0,R=0,E=0,G=0,z=0;d.forEach(e=>{const p=O.calculatePlayerBoxScore(e),I=Number(e.minutes??e.minutesPlayed??0),y=p.points||0;l+=I,r+=y,c+=Number(e.off_reb??e.rebOff??0),g+=Number(e.def_reb??e.rebDef??0),b+=Number(e.assists??e.ast??0),v+=Number(e.steals??e.stl??0),k+=Number(e.blocks??e.blocks_made??e.blk??0),n+=Number(e.turnovers??e.tov??0),f+=Number(e.fouls_committed??e.fouls??0),m+=Number(e.fouls_drawn??e.fouls_received??0),w+=Number(e.plus_minus??e.plusMinus??0),P+=p.pir||0,A+=p.gameScore||0,C+=Number(e.fg2_made??e.fg2Made??0),T+=Number(e.fg2_attempted??e.fg2Attempted??0),R+=Number(e.fg3_made??e.fg3Made??0),E+=Number(e.fg3_attempted??e.fg3Attempted??0),G+=Number(e.ft_made??e.ftMade??0),z+=Number(e.ft_attempted??e.ftAttempted??0)});const t=this.modePerGame?i>0?1/i:0:l>0?40/l:0,x=T+E,o=C+R,$=x>0?((o+.5*R)/x*100).toFixed(1):"0.0",u=2*(x+.44*z),N=u>0?(r/u*100).toFixed(1):"0.0";s.set(a,{player:h,gamesCount:i,totMin:l,avgMin:i>0?(l/i).toFixed(1):"0.0",pts:(r*t).toFixed(1),offReb:(c*t).toFixed(1),defReb:(g*t).toFixed(1),reb:((c+g)*t).toFixed(1),ast:(b*t).toFixed(1),stl:(v*t).toFixed(1),blk:(k*t).toFixed(1),tov:(n*t).toFixed(1),fc:(f*t).toFixed(1),fr:(m*t).toFixed(1),pm:(w*t).toFixed(1),val:(P*t).toFixed(1),gs:(A*t).toFixed(1),efg:$,ts:N,usg:"18.5%"})}),s}_renderHorizontalBarChart(s){const a=[{key:"pts",label:this.t("points","Puntos")},{key:"offReb",label:this.t("reb_off_short","Reb. of.")},{key:"defReb",label:this.t("reb_def_short","Reb. def.")},{key:"ast",label:this.t("assists","Asistencias")},{key:"stl",label:this.t("steals","Robos")},{key:"blk",label:this.t("blocks","Tapones")}];let h=10;a.forEach(i=>{this.selectedPlayerIds.forEach(l=>{const r=s.get(l);if(r){const c=parseFloat(r[i.key]||0);c>h&&(h=c)}})});const F=this.selectedPlayerIds.map((i,l)=>{const r=s.get(i),c=r?`${r.player.first_name||r.player.firstName||""} ${r.player.last_name||r.player.lastName||""}`.trim():"Jugador";return`
        <span style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #334155; background: #f8fafc; padding: 6px 12px; border-radius: 20px; border: 1px solid #e2e8f0;">
          <span style="width: 10px; height: 10px; background: ${this.playerColors[l%this.playerColors.length]}; border-radius: 50%;"></span>
          ${c}
        </span>
      `}).join(""),d=a.map(i=>{const l=this.selectedPlayerIds.map((r,c)=>{const g=s.get(r),b=parseFloat(g?g[i.key]:0),v=Math.min(100,Math.max(3,b/h*100));return`
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="height: 10px; background: ${this.playerColors[c%this.playerColors.length]}; width: ${v}%; border-radius: 4px; transition: width 0.4s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05);" title="${b}"></div>
            <span style="font-size: 11px; font-weight: 800; color: #0f172a; min-width: 24px;">${b}</span>
          </div>
        `}).join("");return`
        <div style="display: grid; grid-template-columns: 100px 1fr; align-items: center; gap: 14px; font-size: 12px; font-weight: 700; color: #475569;">
          <div style="text-align: right; color: #64748b;">${i.label}</div>
          <div style="display: flex; flex-direction: column; gap: 6px; background: #f8fafc; padding: 6px 10px; border-radius: 8px; border: 1px solid #f1f5f9;">
            ${l}
          </div>
        </div>
      `}).join("");return`
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
          <span>📊 ${this.t("conventional_stats","ESTADÍSTICAS CONVENCIONALES")} (${this.modePerGame?"POR PARTIDO":"POR 40 MIN"})</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
          ${d}
        </div>

        <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; border-top: 1px solid #f1f5f9; padding-top: 14px;">
          ${F}
        </div>
      </div>
    `}_renderComparisonTable(s){const a=this.selectedPlayerIds.map((d,i)=>{const l=s.get(d),r=l?`${l.player.first_name||l.player.firstName||""} ${l.player.last_name||l.player.lastName||""}`.trim().toUpperCase():"JUGADOR";return`
        <th style="padding: 12px; text-align: center; color: ${this.playerColors[i%this.playerColors.length]}; font-weight: 900; font-size: 12px; letter-spacing: 0.02em;">
          ${r}
        </th>
      `}).join(""),F=[{label:this.t("games_played","Partidos Jugados"),key:"gamesCount"},{label:this.t("minutes","Minutos"),key:"avgMin"},{label:this.t("points","Puntos"),key:"pts"},{label:this.t("rebounds","Rebotes"),key:"reb"},{label:this.t("assists","Asistencias"),key:"ast"},{label:this.t("steals","Robos"),key:"stl"},{label:this.t("blocks","Tapones"),key:"blk"},{label:this.t("turnovers","Pérdidas"),key:"tov"},{label:this.t("fouls_committed","Faltas com."),key:"fc"},{label:this.t("fouls_received","Faltas rec."),key:"fr"},{label:"Plus/Minus",key:"pm"},{label:this.t("valuation","Valoración (FIBA)"),key:"val"},{label:"Game Score",key:"gs"},{label:"eFG%",key:"efg",isPct:!0},{label:"TS%",key:"ts",isPct:!0},{label:"USG%",key:"usg"}].map((d,i)=>{const l=i%2===0,r=this.selectedPlayerIds.map(c=>{const g=s.get(c);if(!g)return'<td style="padding: 10px; text-align: center; color: #64748b;">-</td>';const b=g[d.key]??"-";return`
          <td style="padding: 10px; text-align: center; font-weight: 800; color: #0f172a;">
            ${d.isPct?`${b}%`:b}
          </td>
        `}).join("");return`
        <tr style="background: ${l?"#ffffff":"#f8fafc"}; border-bottom: 1px solid #f1f5f9; font-size: 12px;">
          <td style="padding: 10px 14px; font-weight: 700; color: #64748b;">${d.label}</td>
          ${r}
        </tr>
      `}).join("");return`
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
          📋 TABLA COMPARATIVA
        </div>

        <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: #f1f5f9; font-size: 11px; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 12px 14px; color: #475569; font-weight: 800; text-transform: uppercase; width: 25%;">MÉTRICA</th>
                ${a}
              </tr>
            </thead>
            <tbody>
              ${F}
            </tbody>
          </table>
        </div>
      </div>
    `}_renderEvolutionChartSVG(s){const b=[...M.getGames()||[]].sort((t,x)=>new Date(t.date||0)-new Date(x.date||0)),v=Math.max(1,b.length),n={pts:this.t("points","PUNTOS"),val:this.t("valuation","VALORACIÓN FIBA"),reb:this.t("rebounds","REBOTES"),ast:this.t("assists","ASISTENCIAS"),stl:this.t("steals","ROBOS"),blk:this.t("blocks","TAPONES")}[this.selectedMetric]||this.t("points","PUNTOS");let f=0,m=10;this.selectedPlayerIds.forEach(t=>{(M.getPlayerGameStats(t)||[]).forEach(o=>{const $=O.calculatePlayerBoxScore(o);let u=0;switch(this.selectedMetric){case"val":u=$.pir||0;break;case"reb":u=$.rebounds||0;break;case"ast":u=Number(o.assists??o.ast??0);break;case"stl":u=Number(o.steals??o.stl??0);break;case"blk":u=Number(o.blocks??o.blocks_made??o.blk??0);break;case"pts":default:u=$.points||0;break}u>m&&(m=u),u<f&&(f=u)})}),m=Math.ceil(m/4)*4||8;const w=m-f||1,P=4;let A="",C="";for(let t=0;t<=P;t++){const x=f+w/P*t,o=185-t/P*170;A+=`
        <line x1="45" y1="${o.toFixed(1)}" x2="780" y2="${o.toFixed(1)}" stroke="${x===0?"#cbd5e1":"#f1f5f9"}" stroke-dasharray="${x===0?"none":"3 3"}" stroke-width="${x===0?"1.5":"1"}" />
      `,C+=`
        <text x="35" y="${o.toFixed(1)}" font-size="11" font-weight="700" fill="#94a3b8" text-anchor="end" dominant-baseline="central">${Math.round(x)}</text>
      `}const T=this.selectedPlayerIds.map((t,x)=>{if(!s.get(t))return"";const $=this.playerColors[x%this.playerColors.length],u=M.getPlayerGameStats(t)||[],N=new Map(u.map(p=>[String(p.game_id??p.gameId),p])),_=b.map((p,I)=>{const y=N.get(String(p.id));let S=0;if(y){const L=O.calculatePlayerBoxScore(y);switch(this.selectedMetric){case"val":S=L.pir||0;break;case"reb":S=L.rebounds||0;break;case"ast":S=Number(y.assists??y.ast??0);break;case"stl":S=Number(y.steals??y.stl??0);break;case"blk":S=Number(y.blocks??y.blocks_made??y.blk??0);break;case"pts":default:S=L.points||0;break}}const V=v>1?v-1:1,j=45+I/V*735,H=185-(S-f)/w*170;return{x:j,y:H,val:S,label:`P${I+1}`,hasPlayed:!!y}});if(_.length===0)return"";let e=`M ${_[0].x.toFixed(1)},${_[0].y.toFixed(1)}`;for(let p=0;p<_.length-1;p++){const I=_[p],y=_[p+1],S=(I.x+y.x)/2;e+=` C ${S.toFixed(1)},${I.y.toFixed(1)} ${S.toFixed(1)},${y.y.toFixed(1)} ${y.x.toFixed(1)},${y.y.toFixed(1)}`}return`
        <path d="${e}" fill="none" stroke="${$}" stroke-width="2.5" stroke-linecap="round" />
        ${_.map(p=>`
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${$}" stroke="white" stroke-width="1.5">
            <title>${p.label}: ${p.val} ${p.hasPlayed?"":"(Sin registro)"}</title>
          </circle>
        `).join("")}
      `}).join("");let R="",E="";b.forEach((t,x)=>{const o=v>1?v-1:1,$=45+x/o*735;R+=`<line x1="${$.toFixed(1)}" y1="15" x2="${$.toFixed(1)}" y2="185" stroke="#f8fafc" stroke-width="1" />`,E+=`
        <text x="${$.toFixed(1)}" y="210" font-size="11" font-weight="700" fill="#64748b" text-anchor="middle">P${x+1}</text>
      `});const G=b.map((t,x)=>{const o=t.date||t.game_date||null,$=o?B&&typeof B.formatDate=="function"?B.formatDate(o):o:"-",u=t.opponent||"Rival no informado",N=String(t.venue||"").trim().toLowerCase(),_=N.includes("visit")?"Visitante":N.includes("local")?"Local":t.venue||"-",e=t.team_score??t.teamScore??t.our_score??null,p=t.opponent_score??t.opponentScore??t.opp_score??null,I=e!==null&&p!==null?`${e}-${p}`:"-";return`
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 9px 10px; font-weight: 900; color: #1e3a8a; white-space: nowrap;">P${x+1}</td>
          <td style="padding: 9px 10px; color: #475569; white-space: nowrap;">${$}</td>
          <td style="padding: 9px 10px; font-weight: 700; color: #0f172a;">${u}</td>
          <td style="padding: 9px 10px; color: #475569; white-space: nowrap;">${_}</td>
          <td style="padding: 9px 10px; font-weight: 800; color: #0f172a; white-space: nowrap;">${I}</td>
        </tr>
      `}).join(""),z=this.selectedPlayerIds.map((t,x)=>{const o=s.get(t),$=o?`${o.player.first_name||o.player.firstName||""} ${o.player.last_name||o.player.lastName||""}`.trim():"Jugador";return`
        <span style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #334155; background: #f8fafc; padding: 6px 12px; border-radius: 20px; border: 1px solid #e2e8f0;">
          <span style="width: 10px; height: 10px; background: ${this.playerColors[x%this.playerColors.length]}; border-radius: 50%;"></span>
          ${$}
        </span>
      `}).join("");return`
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
            📈 EVOLUCIÓN DE ${n} POR PARTIDO (P1 - P${v})
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            <label style="font-size: 11px; font-weight: 700; color: #64748b;">Métrica:</label>
            <select id="select-evolution-metric" style="padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; background: #ffffff; color: #0f172a; outline: none; cursor: pointer; min-height: 44px;">
              <option value="pts" ${this.selectedMetric==="pts"?"selected":""}>Puntos</option>
              <option value="val" ${this.selectedMetric==="val"?"selected":""}>Valoración (FIBA)</option>
              <option value="reb" ${this.selectedMetric==="reb"?"selected":""}>Rebotes</option>
              <option value="ast" ${this.selectedMetric==="ast"?"selected":""}>Asistencias</option>
              <option value="stl" ${this.selectedMetric==="stl"?"selected":""}>Robos</option>
              <option value="blk" ${this.selectedMetric==="blk"?"selected":""}>Tapones</option>
            </select>
          </div>
        </div>

        <div style="position: relative; width: 100%; height: 210px; margin-bottom: 8px;">
          <svg viewBox="0 0 800 220" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible;">
            ${A}
            ${R}
            ${C}
            ${E}
            ${T}
          </svg>
        </div>

        <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; border-top: 1px solid #f1f5f9; padding-top: 14px;">
          ${z}
        </div>

        <div style="margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 8px;">
            🗓️ REFERENCIA DE PARTIDOS DEL EJE X
          </div>
          <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #e2e8f0; border-radius: 10px;">
            <table style="width: 100%; min-width: 560px; border-collapse: collapse; font-size: 11px;">
              <thead>
                <tr style="background: #f8fafc; color: #64748b; text-align: left;">
                  <th style="padding: 9px 10px;">Ref.</th>
                  <th style="padding: 9px 10px;">Fecha</th>
                  <th style="padding: 9px 10px;">Rival</th>
                  <th style="padding: 9px 10px;">Sede</th>
                  <th style="padding: 9px 10px;">Resultado</th>
                </tr>
              </thead>
              <tbody>
                ${G||'<tr><td colspan="5" style="padding: 14px; text-align: center; color: #64748b;">Sin partidos en el contexto activo.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `}_renderRelativeStrengths(s){const a=[{key:"pts",label:this.t("points","Puntos"),unit:"pts",isInverse:!1},{key:"reb",label:this.t("rebounds","Rebotes"),unit:"reb",isInverse:!1},{key:"ast",label:this.t("assists","Asistencias"),unit:"ast",isInverse:!1},{key:"stl",label:this.t("steals","Robos"),unit:"rob",isInverse:!1},{key:"blk",label:this.t("blocks","Tapones"),unit:"tap",isInverse:!1},{key:"efg",label:"Tiro Efectivo",unit:"%",isInverse:!1},{key:"val",label:"Valoración FIBA",unit:"val",isInverse:!1},{key:"tov",label:"Control de Pérdidas",unit:"per",isInverse:!0}],h=this.selectedPlayerIds.map(d=>s.get(d)).filter(Boolean);return`
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
          ⚡ FORTALEZAS RELATIVAS (COMPARATIVA DINÁMICA DE GRUPO)
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${h.map(d=>{const i=`${d.player.first_name||d.player.firstName||""} ${d.player.last_name||d.player.lastName||""}`.trim(),r=[...a.map(k=>{const n=h.map(A=>parseFloat(A[k.key]||0)),f=Math.max(...n),m=Math.min(...n),w=parseFloat(d[k.key]||0);let P=.5;return f!==m&&(P=k.isInverse?(f-w)/(f-m):(w-m)/(f-m)),{label:k.label,val:w,unit:k.unit,score:P}})].sort((k,n)=>n.score-k.score),c=r[0],g=r[r.length-1],b=`${c.label} (${c.val}${c.unit==="%"?"%":""})`,v=`${g.label} (${g.val}${g.unit==="%"?"%":""})`;return`
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; flex-wrap: wrap; gap: 8px;">
          <span style="font-weight: 800; font-size: 13px; color: #0f172a;">${i}</span>
          <div style="font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span style="color: #64748b;">Mejor en</span> 
            <span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 6px; border: 1px solid #bbf7d0;">${b}</span>
            <span style="color: #64748b;">· Peor en</span> 
            <span style="background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 6px; border: 1px solid #fecaca;">${v}</span>
          </div>
        </div>
      `}).join("")}
        </div>
      </div>
    `}async render(s="dashboard-content-area"){var l,r,c,g,b,v,k;const a=document.getElementById(s)||document.getElementById("main-content")||document.querySelector(".app-main-content")||document.body;if(!a)return;if(!this._canAccess()){a.innerHTML=`
        <div style="padding: 40px; text-align: center; background: #ffffff; border-radius: 14px; border: 1px solid #fecaca; max-width: 600px; margin: 40px auto;">
          <div style="font-size: 40px; margin-bottom: 12px;">🔒</div>
          <h2 style="margin: 0 0 8px 0; color: #991b1b; font-size: 18px; font-weight: 800;">Acceso no permitido</h2>
          <p style="color: #7f1d1d; font-size: 13px; margin: 0 0 20px 0;">Tu rol de usuario de JUGADOR no tiene acceso a la pantalla del Comparador.</p>
          <a href="#/dashboard" style="background: #1e3a8a; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 13px; display: inline-block;">Volver al Dashboard</a>
        </div>
      `;return}const h=((g=(c=M).getSeasonParticipantPlayers)==null?void 0:g.call(c,(r=(l=M).getActiveTeamId)==null?void 0:r.call(l)))||M.getPlayers()||[];this.hasInitialized||(h.length>=2?this.selectedPlayerIds=[String(h[0].id),String(h[1].id)]:h.length===1&&(this.selectedPlayerIds=[String(h[0].id)]),this.hasInitialized=!0);const F=h.map(n=>{const f=this.selectedPlayerIds.includes(String(n.id)),m=this.selectedPlayerIds.indexOf(String(n.id));let w="background: #ffffff; color: #334155; border: 1px solid #cbd5e1;";if(f){const P=this.playerColors[m%this.playerColors.length];w=`background: ${P}; color: #ffffff; border: 1px solid ${P}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);`}return`
        <button type="button" 
                class="btn-select-player-chip" 
                data-id="${n.id}" 
                style="padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; ${w}">
          #${n.jersey??n.number??"-"} ${n.first_name||n.firstName||""} ${n.last_name||n.lastName||""}
          ${f?"✕":"+"}
        </button>
      `}).join(""),d=this.selectedPlayerIds.length>=2,i=d?this._getPlayerStatsMap():new Map;a.innerHTML=`
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">
            🔀 ${this.t("comparator","Comparador de Jugadores")}
          </h1>

          ${d?`
            <div style="background: #e2e8f0; padding: 4px; border-radius: 10px; display: flex; gap: 4px;">
              <button id="btn-mode-pergame" style="padding: 8px 16px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; min-height: 44px; background: ${this.modePerGame?"#ffffff":"transparent"}; color: ${this.modePerGame?"#0f172a":"#64748b"}; box-shadow: ${this.modePerGame?"0 1px 2px rgba(0,0,0,0.1)":"none"};">
                ${this.t("per_game","Por partido")}
              </button>
              <button id="btn-mode-per40" style="padding: 8px 16px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; min-height: 44px; background: ${this.modePerGame?"transparent":"#ffffff"}; color: ${this.modePerGame?"#64748b":"#0f172a"}; box-shadow: ${this.modePerGame?"none":"0 1px 2px rgba(0,0,0,0.1)"};">
                ${this.t("per_40_min","Por 40 min")}
              </button>
            </div>
          `:""}
        </div>

        <!-- Selector de Jugadores Chips -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            ${this.t("select_players","SELECCIONA DE 2 A 4 JUGADORES")} (${this.selectedPlayerIds.length}/4 seleccionados)
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${F}
          </div>
        </div>

        ${d?`
          <div style="display: flex; flex-direction: column; gap: 24px;">
            ${this._renderHorizontalBarChart(i)}
            ${this._renderComparisonTable(i)}
            ${this._renderEvolutionChartSVG(i)}
            ${this._renderRelativeStrengths(i)}
          </div>
        `:`
          <div style="padding: 60px 20px; text-align: center; background: #ffffff; border-radius: 14px; border: 1px dashed #cbd5e1; margin-top: 20px;">
            <div style="width: 56px; height: 56px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 26px; color: #94a3b8;">
              🔀
            </div>
            <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #334155;">
              ${this.selectedPlayerIds.length===1?"Selecciona 1 jugador más para comparar":this.t("select_at_least_2","Selecciona al menos 2 jugadores")}
            </h3>
            <p style="margin: 0; font-size: 13px; color: #64748b;">
              ${this.t("select_players_desc","Pulsa en los botones superiores para añadir o quitar jugadores libremente.")}
            </p>
          </div>
        `}

      </div>
    `,a.querySelectorAll(".btn-select-player-chip").forEach(n=>{n.addEventListener("click",()=>{const f=String(n.getAttribute("data-id"));if(this.selectedPlayerIds.includes(f))this.selectedPlayerIds=this.selectedPlayerIds.filter(m=>m!==f);else{if(this.selectedPlayerIds.length>=4){alert(this.t("max_players_comparator","Puedes seleccionar como máximo 4 jugadores simultáneamente."));return}this.selectedPlayerIds.push(f)}this.render(s)})}),(b=a.querySelector("#btn-mode-pergame"))==null||b.addEventListener("click",()=>{this.modePerGame=!0,this.render(s)}),(v=a.querySelector("#btn-mode-per40"))==null||v.addEventListener("click",()=>{this.modePerGame=!1,this.render(s)}),(k=a.querySelector("#select-evolution-metric"))==null||k.addEventListener("change",n=>{this.selectedMetric=n.target.value,this.render(s)})}}export{X as ComparatorView};
