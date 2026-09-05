import{T as E,I as G,D as w,P as C}from"./index-Co3VTdK8.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";class z{static printReport(e="Informe_IQ_Basket",i=""){const r=window.open("","_blank","width=1024,height=768");if(!r){alert(E?E.t("popup_blocked","La ventana emergente para imprimir fue bloqueada. Permite las ventanas emergentes."):"La ventana emergente para imprimir fue bloqueada.");return}const s=`
      <!DOCTYPE html>
      <html lang="${G.getLocale?G.getLocale():"es"}">
      <head>
        <meta charset="UTF-8">
        <title>${e}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 15mm 12mm;
          }
          *, *::before, *::after {
            box-sizing: border-box;
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #0f172a;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            text-align: center;
            font-size: 11px;
            margin-top: 10px;
          }
          .data-table th, .data-table td {
            padding: 6px 8px;
            border-bottom: 1px solid #e2e8f0;
          }
          .data-table th {
            background-color: #f1f5f9 !important;
            font-weight: 800;
            color: #475569;
            text-transform: uppercase;
          }
          h1, h2, h3, h4 {
            margin: 0 0 8px 0;
            font-weight: 800;
          }
          svg {
            max-width: 100%;
          }
        </style>
      </head>
      <body>
        ${i}
        <script>
          window.onload = function() {
            window.focus();
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        <\/script>
      </body>
      </html>
    `;r.document.open(),r.document.write(s),r.document.close()}}class J{constructor(e=null){this.auth=e,this.reportMode="game",this.selectedGameId="all",this.selectedPlayerId="all",this.filters={venue:"all",opponentId:"all"},this.seasonMetricMode="per_game",this.sortField="val",this.sortAsc=!1,this.dossierConfig={includeTeamSummary:!0,includeColectiveCharts:!0,includeCalendar:!0,includeBoxScores:!0,includeRosterMatrix:!0,includePlayerCards:!0,includeShotCharts:!0,includeGlossary:!0,selectedGameIds:[],selectedPlayerIds:[]},this.showDossierModal=!1}t(e,i=""){return(E?E.t(e,i):G.t(e,i))||i}_calculateFibaVal(e={}){const i=Number(e.points??Number(e.fg2_made??e.fg2Made??0)*2+Number(e.fg3_made??e.fg3Made??0)*3+Number(e.ft_made??e.ftMade??0)),r=Number(e.off_reb??e.offReb??e.rebounds_offensive??0),s=Number(e.def_reb??e.defReb??e.rebounds_defensive??0),o=Number(e.rebounds??r+s),l=Number(e.assists??e.ast??0),c=Number(e.steals??e.stl??0),t=Number(e.blocks??e.blocks_made??e.blk??0),a=Number(e.fouls_drawn??e.foulsDrawn??e.fouls_received??0),n=Number(e.fg2_made??e.fg2Made??0),d=Number(e.fg2_attempted??e.fg2Attempted??0),m=Number(e.fg3_made??e.fg3Made??0),b=Number(e.fg3_attempted??e.fg3Attempted??0),$=Number(e.ft_made??e.ftMade??0),x=Number(e.ft_attempted??e.ftAttempted??0),p=Math.max(0,d+b-(n+m)),u=Math.max(0,x-$),v=Number(e.turnovers??e.tov??0),S=Number(e.blocks_received??e.blocksReceived??0),g=Number(e.fouls_committed??e.fouls??0);return i+o+l+c+t+a-(p+u+v+S+g)}_getFilteredGames(){var r,s,o,l,c,t;const e=((s=(r=w).getActiveTeamId)==null?void 0:s.call(r))||null;let i=(e?(l=(o=w).getGames)==null?void 0:l.call(o,e):null)||((t=(c=w).getGames)==null?void 0:t.call(c))||[];return this.filters.venue!=="all"&&(i=i.filter(a=>{const n=String(a.venue||"").toLowerCase();return this.filters.venue==="local"?n==="local"||n==="home"||a.is_home:n==="visitante"||n==="away"||!a.is_home})),[...i].sort((a,n)=>new Date(a.date||0)-new Date(n.date||0))}_getGameShotEvents(e=null,i=null){var l,c;const r=this._getFilteredGames(),s=new Set(r.map(t=>String(t.id)));let o=((c=(l=w).getGameEvents)==null?void 0:c.call(l,e))||[];return(!e||e==="all")&&(o=o.filter(t=>s.has(String(t.game_id??t.gameId)))),i&&i!=="all"&&(o=o.filter(t=>String(t.player_id??t.playerId)===String(i))),o.filter(t=>{var m,b;const a=String(t.action_type??t.action??"").toLowerCase(),n=a.includes("fg")||a.includes("shot")||a.includes("t2")||a.includes("t3")||a.includes("canasta")||a.includes("tiro"),d=Number(t.coord_x??((m=t.coordinates)==null?void 0:m.x)??0)>0||Number(t.coord_y??((b=t.coordinates)==null?void 0:b.y)??0)>0;return n&&d})}_extractGameBoxScore(e,i){var o,l;const r=((l=(o=w).getPlayerGameStats)==null?void 0:l.call(o,null,e))||[],s=[];return i.forEach(c=>{const t=r.find(a=>String(a.player_id??a.playerId)===String(c.id));if(t){const a=Number(t.minutes??t.minutesPlayed??0),n=Number(t.points??Number(t.fg2_made||0)*2+Number(t.fg3_made||0)*3+Number(t.ft_made||0)),d=Number(t.off_reb??t.offReb??0),m=Number(t.def_reb??t.defReb??0),b=Number(t.rebounds??d+m),$=Number(t.assists??t.ast??0),x=Number(t.steals??t.stl??0),p=Number(t.blocks??t.blocks_made??t.blk??0),u=Number(t.turnovers??t.tov??0),v=this._calculateFibaVal(t);s.push({id:c.id,name:`#${c.jersey??c.number??"-"} ${c.first_name||c.firstName||""} ${c.last_name||c.lastName||""}`.trim()||c.name,min:a,pts:n,reb:b,ast:$,stl:x,blk:p,tov:u,val:v,played:a>0})}}),s.sort((c,t)=>t.val-c.val)}_getSelectedGameData(){var $,x,p,u,v,S,g,N;const e=this._getFilteredGames();if(!e.length)return null;const i=(x=($=w).getActiveTeamId)==null?void 0:x.call($),r=((u=(p=w).getSeasonParticipantPlayers)==null?void 0:u.call(p,i))||((S=(v=w).getPlayers)==null?void 0:S.call(v,i))||[];if(this.selectedGameId==="all"){let P=0,k=0;const f={};r.forEach(h=>{f[h.id]={id:h.id,name:`#${h.jersey??h.number??"-"} ${h.first_name||h.firstName||""} ${h.last_name||h.lastName||""}`.trim()||h.name,min:0,pts:0,reb:0,ast:0,stl:0,blk:0,tov:0,val:0,gp:0}}),e.forEach(h=>{P+=Number(h.team_score??h.teamScore??0),k+=Number(h.opponent_score??h.opponentScore??0),this._extractGameBoxScore(h.id,r).forEach(_=>{_.played&&(f[_.id].gp+=1,f[_.id].min+=_.min,f[_.id].pts+=_.pts,f[_.id].reb+=_.reb,f[_.id].ast+=_.ast,f[_.id].stl+=_.stl,f[_.id].blk+=_.blk,f[_.id].tov+=_.tov,f[_.id].val+=_.val)})});const A=Object.values(f).map(h=>{const I=h.gp>0?h.gp:1;return{...h,avgMin:h.gp>0?(h.min/I).toFixed(1):"0.0",pts:h.gp>0?Number((h.pts/I).toFixed(1)):0,reb:h.gp>0?Number((h.reb/I).toFixed(1)):0,ast:h.gp>0?Number((h.ast/I).toFixed(1)):0,stl:h.gp>0?Number((h.stl/I).toFixed(1)):0,blk:h.gp>0?Number((h.blk/I).toFixed(1)):0,tov:h.gp>0?Number((h.tov/I).toFixed(1)):0,val:h.gp>0?Number((h.val/I).toFixed(1)):0}}).sort((h,I)=>I.val-h.val),R=e.length||1,T=(P/R).toFixed(1),y=(k/R).toFixed(1),M=Math.round(Number(T)*.96)||75,F=(Number(T)/M*100).toFixed(1),L=(Number(y)/M*100).toFixed(1);return{game:{id:"all",opponent:`Temporada Completa (${e.length} PJ)`,date:"Global",venue:"Todos",isSeasonAverage:!0,totalTeamPts:P,totalOppPts:k},teamPts:T,oppPts:y,diffPts:(Number(T)-Number(y)).toFixed(1),poss:M,offRtg:F,defRtg:L,netRtg:(Number(F)-Number(L)).toFixed(1),playersList:A,periodScores:[]}}const s=e.find(P=>String(P.id)===String(this.selectedGameId))||e[0];if(!s)return null;this.selectedGameId=s.id;const o=this._extractGameBoxScore(s.id,r),l=Number(s.team_score??s.teamScore??o.reduce((P,k)=>P+k.pts,0)),c=Number(s.opponent_score??s.opponentScore??0),t=l-c,a=Math.round(l*.95)||70,n=(l/a*100).toFixed(1),d=(c/a*100).toFixed(1),m=(Number(n)-Number(d)).toFixed(1),b=((N=(g=w).getGamePeriodScores)==null?void 0:N.call(g,s.id))||[];return{game:s,teamPts:l,oppPts:c,diffPts:t,poss:a,offRtg:n,defRtg:d,netRtg:m,playersList:o,periodScores:b}}_getSeasonStatsList(){var o,l,c,t,a,n;const e=(l=(o=w).getActiveTeamId)==null?void 0:l.call(o),i=((t=(c=w).getSeasonParticipantPlayers)==null?void 0:t.call(c,e))||((n=(a=w).getPlayers)==null?void 0:n.call(a,e))||[],r=this._getFilteredGames(),s=new Set(r.map(d=>String(d.id)));return i.map(d=>{var R,T;const $=(((T=(R=w).getPlayerGameStats)==null?void 0:T.call(R,d.id))||[]).filter(y=>s.has(String(y.game_id||y.gameId))).filter(y=>Number(y.minutes??y.minutesPlayed??0)>0),x=$.length;let p=0,u=0,v=0,S=0,g=0,N=0,P=0,k=0;$.forEach(y=>{p+=Number(y.minutes??y.minutesPlayed??0),u+=Number(y.points??Number(y.fg2_made||0)*2+Number(y.fg3_made||0)*3+Number(y.ft_made||0));const M=Number(y.off_reb??y.offReb??0),F=Number(y.def_reb??y.defReb??0);v+=Number(y.rebounds??M+F),S+=Number(y.assists??y.ast??0),g+=Number(y.steals??y.stl??0),N+=Number(y.blocks??y.blocks_made??0),P+=Number(y.turnovers??y.tov??0),k+=this._calculateFibaVal(y)});const f=p>0?40/p:0,A=x>0?x:1;return{id:d.id,name:`#${d.jersey??d.number??"-"} ${d.first_name||d.firstName||""} ${d.last_name||d.lastName||""}`.trim()||d.name,jersey:d.jersey||"",position:d.primary_position||d.primaryPosition||"Jugador",gamesCount:x,min:p,ptsTot:u,rebTot:v,astTot:S,stlTot:g,blkTot:N,tovTot:P,valTot:k,ptsPJ:x>0?(u/A).toFixed(1):"0.0",rebPJ:x>0?(v/A).toFixed(1):"0.0",astPJ:x>0?(S/A).toFixed(1):"0.0",stlPJ:x>0?(g/A).toFixed(1):"0.0",blkPJ:x>0?(N/A).toFixed(1):"0.0",tovPJ:x>0?(P/A).toFixed(1):"0.0",valPJ:x>0?(k/A).toFixed(1):"0.0",pts40:(u*f).toFixed(1),reb40:(v*f).toFixed(1),ast40:(S*f).toFixed(1),stl40:(g*f).toFixed(1),blk40:(N*f).toFixed(1),tov40:(P*f).toFixed(1),val40:(k*f).toFixed(1)}}).sort((d,m)=>Number(m.valPJ)-Number(d.valPJ))}_generateRadarChartSVG(e={pts:10,reb:5,ast:3,stl:2,val:12}){const o=["PTS","REB","AST","ROB","VAL"],l=[25,12,8,4,25],c=[e.pts||0,e.reb||0,e.ast||0,e.stl||0,e.val||0],t=Math.PI*2/o.length,a=c.map((n,d)=>{const m=Math.min(Math.max(n/l[d],.1),1.15),b=d*t-Math.PI/2;return{x:130+85*m*Math.cos(b),y:130+85*m*Math.sin(b)}});return`
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; align-items: center;">
        <span style="font-size: 11px; font-weight: 800; color: #475569; margin-bottom: 8px;">PERFIL DE IMPACTO (RADAR STATS)</span>
        <svg viewBox="0 0 260 260" style="width: 100%; max-width: 220px; height: auto;">
          ${[.33,.66,1].map(n=>`
            <circle cx="130" cy="130" r="${85*n}" fill="none" stroke="#e2e8f0" stroke-width="1" />
          `).join("")}
          ${o.map((n,d)=>{const m=d*t-Math.PI/2,b=130+105*Math.cos(m),$=130+105*Math.sin(m);return`
              <line x1="130" y1="130" x2="${130+85*Math.cos(m)}" y2="${130+85*Math.sin(m)}" stroke="#cbd5e1" stroke-width="1"/>
              <text x="${b}" y="${$+4}" font-size="10" font-weight="800" fill="#64748b" text-anchor="middle">${n}</text>
            `}).join("")}
          <polygon points="${a.map(n=>`${n.x.toFixed(1)},${n.y.toFixed(1)}`).join(" ")}" fill="rgba(30, 58, 138, 0.25)" stroke="#1e3a8a" stroke-width="2.5" />
        </svg>
      </div>
    `}_generateBarPerformanceSVG(e=[]){const o=Math.max(...e.map(c=>Number(c.val||0)),15),l=Math.max(12,Math.min(26,(460-30*2)/(e.length||1)-6));return`
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px;">
        <span style="font-size: 11px; font-weight: 800; color: #475569; margin-bottom: 8px; display: block;">PROGRESIÓN DE VALORACIÓN FIBA POR PARTIDO</span>
        <svg viewBox="0 0 460 160" style="width: 100%; height: auto;">
          <line x1="30" y1="135" x2="430" y2="135" stroke="#cbd5e1" stroke-width="1.5" />
          ${e.map((c,t)=>{const a=Number(c.val||0),n=Math.max(4,Math.abs(a)/o*100),d=30+t*((460-30*2)/(e.length||1))+4,m=a>=0?135-n:135,b=a>=10?"#16a34a":a>=0?"#1e3a8a":"#dc2626";return`
              <rect x="${d}" y="${m}" width="${l}" height="${n}" rx="3" fill="${b}" />
              <text x="${d+l/2}" y="${m-4}" font-size="9" font-weight="800" text-anchor="middle" fill="#0f172a">${a}</text>
              <text x="${d+l/2}" y="150" font-size="8" font-weight="700" text-anchor="middle" fill="#64748b">J${t+1}</text>
            `}).join("")}
        </svg>
      </div>
    `}_generateLeadTrackerSVG(e=[]){if(!e||!e.length)return"";const i=600,r=120,s=25;let o=0;const l=[{x:s,y:r/2}];e.forEach((t,a)=>{const n=Number((t.team_score??t.teamScore??0)-(t.opponent_score??t.opponentScore??0));o+=n;const d=s+(a+1)/Math.max(e.length,1)*(i-2*s),m=r/2-Math.max(-45,Math.min(45,o*2.2));l.push({x:d,y:m,diffAcc:o,q:`Q${a+1}`})});let c=`M ${l[0].x},${l[0].y}`;for(let t=0;t<l.length-1;t++){const a=l[t],n=l[t+1],d=(a.x+n.x)/2;c+=` C ${d},${a.y} ${d},${n.y} ${n.x},${n.y}`}return`
      <div style="margin: 12px 0;">
        <span style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">Lead Tracker (Evolución del Marcador)</span>
        <svg viewBox="0 0 ${i} ${r}" style="width: 100%; height: 110px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; margin-top: 4px;">
          <line x1="${s}" y1="${r/2}" x2="${i-s}" y2="${r/2}" stroke="#94a3b8" stroke-dasharray="4" />
          <path d="${c}" fill="none" stroke="#1e3a8a" stroke-width="2.5" />
          ${l.slice(1).map(t=>`
            <circle cx="${t.x}" cy="${t.y}" r="4" fill="${t.diffAcc>=0?"#16a34a":"#dc2626"}" />
            <text x="${t.x}" y="${t.y-6}" font-size="9" font-weight="800" text-anchor="middle" fill="#0f172a">${t.diffAcc>0?`+${t.diffAcc}`:t.diffAcc}</text>
          `).join("")}
        </svg>
      </div>
    `}_generateShotChartSVG(e=[]){if(!e||e.length===0)return`
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 180px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 11px; font-weight: 700; text-align: center; padding: 12px;">
          📍 Sin tiros de campo registrados en el mapa espacial para esta selección.
        </div>
      `;const s=e.map(o=>{var n,d,m;const l=String(o.action_type??o.action??"").toLowerCase(),c=l.includes("made")||l.includes("anotad")||!!(o.made??((n=o.coordinates)==null?void 0:n.made)),t=Number(o.coord_x??((d=o.coordinates)==null?void 0:d.x)??50),a=Number(o.coord_y??((m=o.coordinates)==null?void 0:m.y)??50);return{x:t/100*300,y:a/100*230,made:c}});return`
      <div style="display: flex; flex-direction: column; align-items: center; margin: 8px 0;">
        <span style="font-size: 11px; font-weight: 800; color: #475569; margin-bottom: 4px;">MAPA ESPACIAL DE TIRO (${s.length} LANZAMIENTOS)</span>
        <svg viewBox="0 0 300 230" style="width: 100%; max-width: 320px; background: #d97736; border: 2px solid #ffffff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.15);">
          <rect x="5" y="5" width="290" height="220" fill="none" stroke="#ffffff" stroke-width="2" />
          <rect x="100" y="5" width="100" height="100" fill="rgba(255,255,255,0.1)" stroke="#ffffff" stroke-width="1.5" />
          <circle cx="150" cy="105" r="28" fill="none" stroke="#ffffff" stroke-width="1.5" />
          <path d="M 30,5 L 30,45 A 120,120 0 0,0 270,45 L 270,5" fill="none" stroke="#ffffff" stroke-width="1.5" />
          <circle cx="150" cy="30" r="10" fill="none" stroke="#ff5722" stroke-width="3" />
          
          ${s.map(o=>`
            <circle cx="${o.x.toFixed(1)}" cy="${o.y.toFixed(1)}" r="4.5" 
              fill="${o.made?"#22c55e":"#ef4444"}" 
              stroke="#ffffff" stroke-width="1.5" />
          `).join("")}
        </svg>
        <div style="font-size: 10px; font-weight: 800; color: #475569; margin-top: 4px;">🟢 Anotado | 🔴 Fallado</div>
      </div>
    `}_renderGlossarySection(){return`
      <div style="page-break-before: always; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-top: 24px;">
        <h3 style="font-size: 13px; font-weight: 900; color: #0f172a; border-bottom: 2px solid #1e3a8a; padding-bottom: 6px; margin-top: 0;">
          📖 GLOSARIO Y METODOLOGÍA ANALÍTICA OFICIAL FIBA / ACB
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; font-size: 11px; color: #334155; margin-top: 10px;">
          <div><strong>VAL / PIR (FIBA):</strong> (PTS + REB + AST + ROB + TAP + FP Recibidas) - (Tiros Campo Fallados + TL Fallados + PER + TAP Recibidos + FC Cometidas).</div>
          <div><strong>OFF / DEF RTG:</strong> Eficiencia de puntos anotados y concedidos por cada 100 posesiones estimadas.</div>
          <div><strong>NET RATING:</strong> Diferencial neto (Offensive Rating - Defensive Rating).</div>
          <div><strong>POSESIONES:</strong> Volumen estimado de juego mediante ritmo acumulado.</div>
          <div><strong>PER (Pérdidas):</strong> Pérdidas de balón que entregan la posesión al rival.</div>
          <div><strong>VAL/40:</strong> Rendimiento normalizado por cada 40 minutos en pista.</div>
        </div>
      </div>
    `}_renderGameReport(e){if(!e)return'<p style="padding: 20px;">No hay datos para mostrar con los filtros actuales.</p>';const{game:i,teamPts:r,oppPts:s,diffPts:o,poss:l,offRtg:c,defRtg:t,netRtg:a,playersList:n,periodScores:d}=e,m=this._getGameShotEvents(i.id==="all"?null:i.id);return`
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 900;">${i.opponent} (${i.venue})</h2>
              <span style="font-size: 12px; color: #64748b;">
                ${i.isSeasonAverage?"Acumulado de temporada · Promedio de partidos":`${i.date||""} · Competición Oficial`}
              </span>
            </div>
            <div style="text-align: right;">
              ${i.isSeasonAverage?'<span style="font-size: 11px; font-weight: 800; color: #64748b; display: block;">PROMEDIO POR PARTIDO</span>':""}
              <div style="font-size: 28px; font-weight: 900; color: ${o>=0?"#16a34a":"#dc2626"};">
                ${r} - ${s}
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 14px;">
            <div>${d.length?this._generateLeadTrackerSVG(d):'<p style="font-size:12px; color:#64748b; padding:10px;">Evolución global de temporada</p>'}</div>
            <div>${this._generateShotChartSVG(m)}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:8px; text-align:center;" title="Puntos anotados por cada 100 posesiones">
            <span style="font-size:10px; font-weight:800; color:#64748b;">OFF RATING ⓘ</span>
            <strong style="display:block; font-size:18px; color:#0f172a;">${c}</strong>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:8px; text-align:center;" title="Puntos recibidos por cada 100 posesiones">
            <span style="font-size:10px; font-weight:800; color:#64748b;">DEF RATING ⓘ</span>
            <strong style="display:block; font-size:18px; color:#0f172a;">${t}</strong>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:8px; text-align:center;" title="Diferencial neto entre ataque y defensa">
            <span style="font-size:10px; font-weight:800; color:#64748b;">NET RATING ⓘ</span>
            <strong style="display:block; font-size:18px; color:${Number(a)>=0?"#16a34a":"#dc2626"};">${Number(a)>0?`+${a}`:a}</strong>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:8px; text-align:center;" title="Número total de posesiones del encuentro">
            <span style="font-size:10px; font-weight:800; color:#64748b;">POSESIONES ⓘ</span>
            <strong style="display:block; font-size:18px; color:#0f172a;">${l}</strong>
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; overflow-x: auto;">
          <h3 style="font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-top: 0;">
            ${i.isSeasonAverage?"Promedios por Jugador en Temporada":"Box Score Oficial FIBA"} (${n.length} Jugadores)
          </h3>
          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 12px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-weight: 800;">
                <th style="text-align: left; padding: 8px;">JUGADOR</th>
                <th title="Minutos jugados">MIN ⓘ</th>
                <th title="Puntos anotados">PTS ⓘ</th>
                <th title="Rebotes totales">REB ⓘ</th>
                <th title="Asistencias">AST ⓘ</th>
                <th title="Robos de balón">ROB ⓘ</th>
                <th title="Tapones">TAP ⓘ</th>
                <th title="Pérdidas de balón">PER ⓘ</th>
                <th title="Valoración Oficial FIBA">VAL (FIBA) ⓘ</th>
              </tr>
            </thead>
            <tbody>
              ${n.length?n.map(b=>`
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="text-align: left; padding: 8px; font-weight: 700;">${b.name}</td>
                  <td>${b.min}'</td><td>${b.pts}</td><td>${b.reb}</td><td>${b.ast}</td>
                  <td>${b.stl}</td><td>${b.blk}</td><td style="color:#dc2626;">${b.tov}</td>
                  <td style="font-weight: 900; color:#1e3a8a;">${b.val}</td>
                </tr>
              `).join(""):'<tr><td colspan="9" style="padding:16px; color:#64748b;">No hay estadísticas registradas para este encuentro.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `}_renderSinglePlayerCard(e,i){var P,k;const r=new Set(i.map(f=>String(f.id))),o=(((k=(P=w).getPlayerGameStats)==null?void 0:k.call(P,e.id))||[]).filter(f=>r.has(String(f.game_id||f.gameId))&&Number(f.minutes??f.minutesPlayed??0)>0);let l=0,c=0,t=0,a=0,n=0,d=0,m=0,b=0;const $=[];o.forEach((f,A)=>{const R=this._calculateFibaVal(f);l+=Number(f.minutes??f.minutesPlayed??0),c+=Number(f.points??0);const T=Number(f.off_reb??f.offReb??0),y=Number(f.def_reb??f.defReb??0);t+=Number(f.rebounds??T+y),a+=Number(f.assists??f.ast??0),n+=Number(f.steals??f.stl??0),d+=Number(f.blocks??f.blocks_made??0),m+=Number(f.turnovers??f.tov??0),b+=R,$.push({gameIdx:A+1,val:R})});const x=o.length,p=x>0?x:1,u=l>0?40/l:0,v=x>0?(b/p).toFixed(1):"0.0",S=(b*u).toFixed(1),g={pts:x>0?Number((c/p).toFixed(1)):0,reb:x>0?Number((t/p).toFixed(1)):0,ast:x>0?Number((a/p).toFixed(1)):0,stl:x>0?Number((n/p).toFixed(1)):0,val:Number(v)},N=this._getGameShotEvents(null,e.id);return`
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 900; color: #0f172a;">#${e.jersey||"-"} ${e.first_name||""} ${e.last_name||""}</h2>
            <span style="font-size: 12px; color: #64748b;">Posición: ${e.primary_position||"Alero"} · ${x} Partidos Disputados (${l} min)</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <div style="background:#eff6ff; border: 1px solid #bfdbfe; padding:8px 14px; border-radius:8px; text-align:center;" title="Valoración FIBA oficial por partido jugado">
              <span style="font-size:9px; color:#1e40af; font-weight:800;">VAL FIBA/PJ ⓘ</span>
              <strong style="display:block; font-size:18px; color:#1e40af;">${v}</strong>
            </div>
            <div style="background:#f0fdf4; border: 1px solid #bbf7d0; padding:8px 14px; border-radius:8px; text-align:center;" title="Valoración FIBA proyectada a 40 minutos">
              <span style="font-size:9px; color:#15803d; font-weight:800;">VAL FIBA/40 ⓘ</span>
              <strong style="display:block; font-size:18px; color:#15803d;">${S}</strong>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 16px;">
          ${this._generateRadarChartSVG(g)}
          ${this._generateBarPerformanceSVG($)}
        </div>

        <div style="margin-top: 14px;">
          ${this._generateShotChartSVG(N)}
        </div>
      </div>
    `}_renderPlayerReport(e,i){if(this.selectedPlayerId==="all")return`
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="font-size: 13px; font-weight: 800; color: #1e3a8a; margin-bottom: 4px;">
            👤 FICHAS TÉCNICAS INDIVIDUALES (${e.length} JUGADORES)
          </div>
          ${e.map(s=>this._renderSinglePlayerCard(s,i)).join("")}
        </div>
      `;const r=e.find(s=>String(s.id)===String(this.selectedPlayerId))||e[0];return r?this._renderSinglePlayerCard(r,i):'<p style="padding: 20px;">Selecciona un jugador.</p>'}_renderSeasonDossier(e,i){const r=this.seasonMetricMode==="per_40",s=this.seasonMetricMode==="totals";return`
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; overflow-x: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
            <h2 style="margin: 0; font-size: 15px; font-weight: 900; color: #0f172a;">MATRIZ ACUMULADA DE PLANTILLA (ESTÁNDAR FIBA / ACB)</h2>
            <div style="display: flex; gap: 6px;">
              <button class="btn-metric-toggle" data-metric="per_game" style="font-size: 11px; padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: ${this.seasonMetricMode==="per_game"?"#1e3a8a":"#ffffff"}; color: ${this.seasonMetricMode==="per_game"?"#ffffff":"#0f172a"}; font-weight: 800; cursor: pointer;">Por Partido</button>
              <button class="btn-metric-toggle" data-metric="per_40" style="font-size: 11px; padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: ${r?"#1e3a8a":"#ffffff"}; color: ${r?"#ffffff":"#0f172a"}; font-weight: 800; cursor: pointer;">Por 40 Min</button>
              <button class="btn-metric-toggle" data-metric="totals" style="font-size: 11px; padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: ${s?"#1e3a8a":"#ffffff"}; color: ${s?"#ffffff":"#0f172a"}; font-weight: 800; cursor: pointer;">Totales</button>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 12px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-weight: 800; color: #475569;">
                <th style="text-align: left; padding: 8px;">JUGADOR</th>
                <th title="Partidos donde jugó al menos 1 minuto">PJ ⓘ</th>
                <th title="Minutos totales en pista">MIN ⓘ</th>
                <th title="Puntos anotados">PTS ⓘ</th>
                <th title="Rebotes totales">REB ⓘ</th>
                <th title="Asistencias">AST ⓘ</th>
                <th title="Robos de balón">ROB ⓘ</th>
                <th title="Pérdidas de balón">PER ⓘ</th>
                <th title="Valoración FIBA oficial">VAL (FIBA) ⓘ</th>
              </tr>
            </thead>
            <tbody>
              ${i.map(o=>`
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="text-align: left; padding: 8px; font-weight: 700; color: #0f172a;">${o.name}</td>
                  <td>${o.gamesCount}</td>
                  <td>${o.min}'</td>
                  <td>${r?o.pts40:s?o.ptsTot:o.ptsPJ}</td>
                  <td>${r?o.reb40:s?o.rebTot:o.rebPJ}</td>
                  <td>${r?o.ast40:s?o.astTot:o.astPJ}</td>
                  <td>${r?o.stl40:s?o.stlTot:o.stlPJ}</td>
                  <td style="color:#dc2626;">${r?o.tov40:s?o.tovTot:o.tovPJ}</td>
                  <td style="font-weight: 900; color: #1e3a8a;">${r?o.val40:s?o.valTot:o.valPJ}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `}_renderDossierModal(e,i){return this.showDossierModal?`
      <div id="dossier-modal-backdrop" style="position: fixed; inset: 0; background: rgba(15,23,42,0.75); display: flex; align-items: center; justify-content: center; z-index: 99999; padding: 16px; box-sizing: border-box;">
        <div style="background: #ffffff; border-radius: 14px; width: 100%; max-width: 650px; padding: 22px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
            <h2 style="font-size: 17px; font-weight: 900; color: #0f172a; margin: 0;">⚙️ Configurar Dossier Oficial de Temporada</h2>
            <button type="button" id="btn-close-dossier-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b;">✕</button>
          </div>

          <div style="margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="font-size: 11px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; display: block; margin-bottom: 8px;">1. Secciones y Gráficas:</strong>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px;">
              <label><input type="checkbox" id="chk-dos-summary" ${this.dossierConfig.includeTeamSummary?"checked":""}> Resumen y Ratings Colectivos</label>
              <label><input type="checkbox" id="chk-dos-charts" ${this.dossierConfig.includeColectiveCharts?"checked":""}> Gráficas de Evolución (Radar & Barras)</label>
              <label><input type="checkbox" id="chk-dos-matrix" ${this.dossierConfig.includeRosterMatrix?"checked":""}> Matriz Acumulada de Plantilla</label>
              <label><input type="checkbox" id="chk-dos-shots" ${this.dossierConfig.includeShotCharts?"checked":""}> Mapas de Tiro (Shot Charts)</label>
              <label><input type="checkbox" id="chk-dos-glossary" ${this.dossierConfig.includeGlossary?"checked":""}> Glosario Oficial FIBA</label>
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">2. Fichas de Jugadores a Incluir:</strong>
              <div>
                <button type="button" id="btn-sel-all-players" style="font-size: 10px; font-weight: 800; color: #0284c7; background: none; border: none; cursor: pointer;">Todos</button>
                <span style="color: #cbd5e1;">|</span>
                <button type="button" id="btn-desel-all-players" style="font-size: 10px; font-weight: 800; color: #dc2626; background: none; border: none; cursor: pointer;">Ninguno</button>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px; max-height: 120px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px;">
              ${e.map(r=>`
                <label style="font-size: 11px; display: flex; align-items: center; gap: 4px;">
                  <input type="checkbox" class="chk-export-p" value="${r.id}" ${this.dossierConfig.selectedPlayerIds.includes(String(r.id))?"checked":""}>
                  #${r.jersey??r.number??""} ${r.first_name||r.firstName||""}
                </label>
              `).join("")}
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">3. Partidos / Box Scores a Incluir:</strong>
              <div>
                <button type="button" id="btn-sel-all-games" style="font-size: 10px; font-weight: 800; color: #0284c7; background: none; border: none; cursor: pointer;">Todos</button>
                <span style="color: #cbd5e1;">|</span>
                <button type="button" id="btn-desel-all-games" style="font-size: 10px; font-weight: 800; color: #dc2626; background: none; border: none; cursor: pointer;">Ninguno</button>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px; max-height: 120px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px;">
              ${i.map((r,s)=>`
                <label style="font-size: 11px; display: flex; align-items: center; gap: 4px;">
                  <input type="checkbox" class="chk-export-g" value="${r.id}" ${this.dossierConfig.selectedGameIds.includes(String(r.id))?"checked":""}>
                  P${s+1} vs ${r.opponent||"Rival"}
                </label>
              `).join("")}
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" id="btn-cancel-dossier" style="padding: 10px 18px; border-radius: 8px; border: 1px solid #cbd5e1; background: white; font-weight: 800; cursor: pointer; font-size: 12px;">Cancelar</button>
            <button type="button" id="btn-generate-final-dossier" style="padding: 10px 22px; border-radius: 8px; border: none; background: #16a34a; color: white; font-weight: 900; cursor: pointer; font-size: 13px; box-shadow: 0 2px 8px rgba(22,163,74,0.3);">📥 Generar y Descargar Dossier PDF</button>
          </div>
        </div>
      </div>
    `:""}_executeDossierPDFExport(){var n,d,m,b,$,x,p,u,v,S;const e=(d=(n=w).getActiveTeamId)==null?void 0:d.call(n);if(!((b=(m=this.auth)==null?void 0:m.can)!=null&&b.call(m,C.EXPORT_REPORT,{teamId:e})))return alert("⚠️ Tu perfil no tiene permiso para exportar informes."),!1;const r=(((x=($=w).getTeamById)==null?void 0:x.call($,e))||{}).name||"JMJ Manyanet Sant Andreu",s=this._getFilteredGames(),o=((u=(p=w).getSeasonParticipantPlayers)==null?void 0:u.call(p,e))||((S=(v=w).getPlayers)==null?void 0:S.call(v,e))||[],l=this._getSeasonStatsList(),c=s.filter(g=>this.dossierConfig.selectedGameIds.includes(String(g.id))),t=o.filter(g=>this.dossierConfig.selectedPlayerIds.includes(String(g.id)));let a=`
      <div style="page-break-after: always; text-align: center; padding-top: 120px; font-family: system-ui, sans-serif;">
        <div style="font-size: 34px; font-weight: 900; color: #1e3a8a; letter-spacing: 2px;">IQ BASKET STATS</div>
        <div style="font-size: 14px; font-weight: 800; color: #f97316; margin-top: 8px; text-transform: uppercase;">DOSSIER TÉCNICO OFICIAL DE TEMPORADA</div>
        
        <div style="margin: 40px auto; width: 140px; height: 4px; background: #1e3a8a; border-radius: 2px;"></div>

        <h1 style="font-size: 26px; font-weight: 900; color: #0f172a; margin-bottom: 6px;">${r}</h1>
        <div style="font-size: 13px; color: #64748b; font-weight: 700;">
          Temporada 2026 · Partidos analizados: ${c.length} · Plantilla: ${t.length}
        </div>

        <div style="margin-top: 180px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          Documento Oficial para Cuerpo Técnico y Dirección Deportiva<br/>
          Estándar FIBA / ACB © IQ Basket
        </div>
      </div>
    `;if(this.dossierConfig.includeRosterMatrix&&(a+=`
        <div style="page-break-after: always; padding-top: 10px;">
          <h2 style="font-size: 16px; font-weight: 900; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 4px; margin-bottom: 14px;">MATRIZ ACUMULADA DE PLANTILLA</h2>
          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 11px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-weight: 800;">
                <th style="text-align: left; padding: 6px;">JUGADOR</th>
                <th>PJ</th><th>MIN</th><th>PTS/PJ</th><th>REB/PJ</th><th>AST/PJ</th><th>ROB/PJ</th><th>PER/PJ</th><th>VAL/PJ</th><th>VAL/40</th>
              </tr>
            </thead>
            <tbody>
              ${l.map(g=>`
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="text-align: left; padding: 6px; font-weight: 700;">${g.name}</td>
                  <td>${g.gamesCount}</td><td>${g.min}'</td>
                  <td>${g.ptsPJ}</td><td>${g.rebPJ}</td><td>${g.astPJ}</td><td>${g.stlPJ}</td>
                  <td style="color:#dc2626;">${g.tovPJ}</td>
                  <td style="font-weight: 900; color: #1e3a8a;">${g.valPJ}</td>
                  <td style="font-weight: 800; color: #15803d;">${g.val40}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `),t.length>0&&t.forEach(g=>{a+=`
          <div style="page-break-after: always; padding-top: 10px;">
            ${this._renderSinglePlayerCard(g,s)}
          </div>
        `}),c.length>0&&c.forEach(g=>{var P,k;const N={game:g,teamPts:Number(g.team_score??g.teamScore??0),oppPts:Number(g.opponent_score??g.opponentScore??0),diffPts:Number(g.team_score??0)-Number(g.opponent_score??0),poss:70,offRtg:"85.0",defRtg:"90.0",netRtg:"-5.0",playersList:this._extractGameBoxScore(g.id,o),periodScores:((k=(P=w).getGamePeriodScores)==null?void 0:k.call(P,g.id))||[]};a+=`
          <div style="page-break-after: always; padding-top: 10px;">
            ${this._renderGameReport(N)}
          </div>
        `}),this.dossierConfig.includeGlossary&&(a+=this._renderGlossarySection()),z&&typeof z.printReport=="function")z.printReport(`Dossier_Temporada_${r.replace(/\s+/g,"_")}`,a);else{const g=window.open("","_blank");g.document.write(`<html><head><title>Dossier Temporada</title></head><body>${a}</body></html>`),g.document.close(),g.print()}}async render(e="dashboard-content-area"){var a,n,d,m,b,$,x,p;const i=document.getElementById(e)||document.getElementById("main-content")||document.querySelector(".app-main-content")||document.body;if(!i)return;const r=(n=(a=w).getActiveTeamId)==null?void 0:n.call(a),s=!!((m=(d=this.auth)==null?void 0:d.canPreview)!=null&&m.call(d,C.EXPORT_REPORT,{teamId:r})),o=this._getFilteredGames(),l=(($=(b=w).getSeasonParticipantPlayers)==null?void 0:$.call(b,r))||((p=(x=w).getPlayers)==null?void 0:p.call(x,r))||[];this.dossierConfig.selectedPlayerIds.length===0&&l.length>0&&(this.dossierConfig.selectedPlayerIds=l.map(u=>String(u.id))),this.dossierConfig.selectedGameIds.length===0&&o.length>0&&(this.dossierConfig.selectedGameIds=o.map(u=>String(u.id)));const c=this._getSelectedGameData(),t=this._getSeasonStatsList();i.innerHTML=`
      <div style="max-width: 1400px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; padding-bottom: 40px;">
        
        <!-- Header con Selector de Modo -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px;">
          <h1 style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 0;">
            ${this.t("reports_module","Módulo de Informes y Reportes")}
          </h1>

          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn-mode ${this.reportMode==="game"?"active":""}" data-mode="game" style="padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.reportMode==="game"?"#1e3a8a":"#fff"}; color: ${this.reportMode==="game"?"#fff":"#0f172a"}; font-weight: 800;">1. Partido</button>
            <button type="button" class="btn-mode ${this.reportMode==="player"?"active":""}" data-mode="player" style="padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.reportMode==="player"?"#1e3a8a":"#fff"}; color: ${this.reportMode==="player"?"#fff":"#0f172a"}; font-weight: 800;">2. Jugador</button>
            <button type="button" class="btn-mode ${this.reportMode==="season_dossier"?"active":""}" data-mode="season_dossier" style="padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.reportMode==="season_dossier"?"#1e3a8a":"#fff"}; color: ${this.reportMode==="season_dossier"?"#fff":"#0f172a"}; font-weight: 800;">3. Dossier Temporada</button>
          </div>
        </div>

        <!-- Barra de Filtros Limpia -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 18px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
          <span style="font-size: 11px; font-weight: 900; color: #64748b;">FILTROS:</span>
          
          <select id="filter-venue" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 700; background: white; color: #0f172a; cursor: pointer;">
            <option value="all" ${this.filters.venue==="all"?"selected":""}>Sede: Todas</option>
            <option value="local" ${this.filters.venue==="local"?"selected":""}>Local</option>
            <option value="visitante" ${this.filters.venue==="visitante"?"selected":""}>Visitante</option>
          </select>

          ${this.reportMode==="game"?`
            <select id="select-game" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 700; background: white; color: #0f172a; cursor: pointer;">
              <option value="all" ${this.selectedGameId==="all"?"selected":""}>-- Todos los Partidos (Temporada Completa) --</option>
              ${o.map((u,v)=>`<option value="${u.id}" ${String(u.id)===String(this.selectedGameId)?"selected":""}>P${v+1} (${u.date||""}) vs ${u.opponent||"Rival"}</option>`).join("")}
            </select>
          `:""}

          ${this.reportMode==="player"?`
            <select id="select-player" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 700; background: white; color: #0f172a; cursor: pointer;">
              <option value="all" ${this.selectedPlayerId==="all"?"selected":""}>-- Todos los Jugadores (Fichas de Plantilla) --</option>
              ${l.map(u=>`<option value="${u.id}" ${String(u.id)===String(this.selectedPlayerId)?"selected":""}>#${u.jersey||""} ${u.first_name||""} ${u.last_name||""}</option>`).join("")}
            </select>
          `:""}

          <button type="button" id="btn-open-dossier-modal" ${s?"":"disabled"} style="margin-left: auto; padding: 8px 16px; border-radius: 8px; border: none; background: ${s?"#16a34a":"#cbd5e1"}; color: ${s?"white":"#64748b"}; font-weight: 900; font-size: 12px; cursor: ${s?"pointer":"not-allowed"}; display: flex; align-items: center; gap: 6px; box-shadow: ${s?"0 2px 6px rgba(22,163,74,0.3)":"none"};" title="${s?"Exportar PDF personalizado":"Tu perfil no tiene permiso para exportar"}">
            📥 Exportar PDF Personalizado${s?"":" 🔒"}
          </button>
        </div>

        <!-- Contenido del Reporte -->
        <div id="report-view-content-area">
          ${this.reportMode==="game"?this._renderGameReport(c):""}
          ${this.reportMode==="player"?this._renderPlayerReport(l,o):""}
          ${this.reportMode==="season_dossier"?this._renderSeasonDossier(o,t):""}
          ${this._renderGlossarySection()}
        </div>

        ${this._renderDossierModal(l,o)}
      </div>
    `,this._bindEvents(i,e,l,o)}_bindEvents(e,i,r,s){var o,l,c,t,a,n,d,m,b,$,x;e.querySelectorAll(".btn-mode").forEach(p=>{p.addEventListener("click",()=>{this.reportMode=p.dataset.mode,this.render(i)})}),e.querySelectorAll(".btn-metric-toggle").forEach(p=>{p.addEventListener("click",()=>{this.seasonMetricMode=p.dataset.metric,this.render(i)})}),(o=e.querySelector("#select-game"))==null||o.addEventListener("change",p=>{this.selectedGameId=p.target.value,this.render(i)}),(l=e.querySelector("#select-player"))==null||l.addEventListener("change",p=>{this.selectedPlayerId=p.target.value,this.render(i)}),(c=e.querySelector("#filter-venue"))==null||c.addEventListener("change",p=>{this.filters.venue=p.target.value,this.render(i)}),(t=e.querySelector("#btn-open-dossier-modal"))==null||t.addEventListener("click",()=>{this.showDossierModal=!0,this.render(i)}),(a=e.querySelector("#btn-close-dossier-modal"))==null||a.addEventListener("click",()=>{this.showDossierModal=!1,this.render(i)}),(n=e.querySelector("#btn-cancel-dossier"))==null||n.addEventListener("click",()=>{this.showDossierModal=!1,this.render(i)}),(d=e.querySelector("#btn-sel-all-players"))==null||d.addEventListener("click",()=>{this.dossierConfig.selectedPlayerIds=r.map(p=>String(p.id)),this.render(i)}),(m=e.querySelector("#btn-desel-all-players"))==null||m.addEventListener("click",()=>{this.dossierConfig.selectedPlayerIds=[],this.render(i)}),(b=e.querySelector("#btn-sel-all-games"))==null||b.addEventListener("click",()=>{this.dossierConfig.selectedGameIds=s.map(p=>String(p.id)),this.render(i)}),($=e.querySelector("#btn-desel-all-games"))==null||$.addEventListener("click",()=>{this.dossierConfig.selectedGameIds=[],this.render(i)}),e.querySelectorAll(".chk-export-p").forEach(p=>{p.addEventListener("change",()=>{const u=p.value;p.checked?this.dossierConfig.selectedPlayerIds.includes(u)||this.dossierConfig.selectedPlayerIds.push(u):this.dossierConfig.selectedPlayerIds=this.dossierConfig.selectedPlayerIds.filter(v=>v!==u)})}),e.querySelectorAll(".chk-export-g").forEach(p=>{p.addEventListener("change",()=>{const u=p.value;p.checked?this.dossierConfig.selectedGameIds.includes(u)||this.dossierConfig.selectedGameIds.push(u):this.dossierConfig.selectedGameIds=this.dossierConfig.selectedGameIds.filter(v=>v!==u)})}),(x=e.querySelector("#btn-generate-final-dossier"))==null||x.addEventListener("click",()=>{var u,v,S,g,N,P,k,f,A;const p=(v=(u=w).getActiveTeamId)==null?void 0:v.call(u);if(!((g=(S=this.auth)==null?void 0:S.can)!=null&&g.call(S,C.EXPORT_REPORT,{teamId:p}))){alert("⚠️ Tu perfil no tiene permiso para exportar informes.");return}this.dossierConfig.includeTeamSummary=((N=e.querySelector("#chk-dos-summary"))==null?void 0:N.checked)??!0,this.dossierConfig.includeColectiveCharts=((P=e.querySelector("#chk-dos-charts"))==null?void 0:P.checked)??!0,this.dossierConfig.includeRosterMatrix=((k=e.querySelector("#chk-dos-matrix"))==null?void 0:k.checked)??!0,this.dossierConfig.includeShotCharts=((f=e.querySelector("#chk-dos-shots"))==null?void 0:f.checked)??!0,this.dossierConfig.includeGlossary=((A=e.querySelector("#chk-dos-glossary"))==null?void 0:A.checked)??!0,this.showDossierModal=!1,this._executeDossierPDFExport()})}}export{J as ReportsView};
