import{T as k,I as T,D as x}from"./index-Co3VTdK8.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";class F{constructor(a=null){this.auth=a,this.showNames=!1,this.sortBy="net_rating",this.minGames=1}t(a,n=""){return(k?k.t(a,n):T.t(a,n))||n}_getLineupsData(){var y,b,_,$;const a=x.getGames()||[],n=(($=(_=x).getSeasonParticipantPlayers)==null?void 0:$.call(_,(b=(y=x).getActiveTeamId)==null?void 0:b.call(y)))||x.getPlayers()||[],u=new Map(n.map(e=>[String(e.id),e]));if(n.length===0)return[];const g=new Map;if(a.forEach((e,i)=>{let t=e.starter_ids||e.starterIds||[];if(typeof t=="string")try{t=JSON.parse(t)}catch{t=[]}const r=x.getPlayerGameStats(null,e.id)||[];if(!Array.isArray(t)||t.length<5){const s=[...r].sort((c,M)=>Number(M.minutes||0)-Number(c.minutes||0)).map(c=>c.player_id||c.playerId).filter(Boolean);s.length>=5?t=s.slice(0,5):t=n.slice(0,5).map(c=>c.id)}else t=t.slice(0,5);const d=[...t].map(s=>String(s)).sort(),p=d.join("_");let f=Number(e.team_score??e.teamScore??e.our_score??0),w=Number(e.opponent_score??e.opponentScore??e.opp_score??0),v=0,N=0,R=0,m=0,o=0,S=0;r.forEach(s=>{const c=Number(s.fg2_attempted??s.fg2Attempted??0),M=Number(s.fg3_attempted??s.fg3Attempted??0),G=Number(s.fg2_made??s.fg2Made??0),L=Number(s.fg3_made??s.fg3Made??0);v+=c+M,N+=G+L,R+=L,m+=Number(s.ft_attempted??s.ftAttempted??0),o+=Number(s.turnovers??s.tov??0),S+=Number(s.off_reb??s.offReb??0)+Number(s.def_reb??s.defReb??0)}),g.has(p)||g.set(p,{playerIds:d,gamesCount:0,minutes:0,ptsScored:0,ptsConceded:0,fga:0,fgm:0,fg3m:0,fta:0,turnovers:0,rebounds:0});const l=g.get(p);l.gamesCount+=1,l.minutes+=18,l.ptsScored+=f,l.ptsConceded+=w,l.fga+=v||45,l.fgm+=N||18,l.fg3m+=R,l.fta+=m,l.turnovers+=o||12,l.rebounds+=S||24}),g.size===0&&n.length>=5){const e=n.slice(0,5).map(i=>String(i.id)).sort();g.set(e.join("_"),{playerIds:e,gamesCount:1,minutes:20,ptsScored:50,ptsConceded:50,fga:40,fgm:16,fg3m:4,fta:10,turnovers:10,rebounds:25})}const h=[];return g.forEach((e,i)=>{const t=e.gamesCount;if(t<this.minGames)return;const r=e.fga+.44*e.fta+e.turnovers||e.minutes*1.8||70,d=r>0?Number((e.ptsScored/r*100).toFixed(1)):70,p=r>0?Number((e.ptsConceded/r*100).toFixed(1)):70,f=Number((d-p).toFixed(1)),w=e.ptsScored-e.ptsConceded,v=e.fga>0?Number(((e.fgm+.5*e.fg3m)/e.fga*100).toFixed(1)):45,N=e.playerIds.map(m=>{const o=u.get(m);return`#${(o==null?void 0:o.jersey)??(o==null?void 0:o.number)??"?"}`}),R=e.playerIds.map(m=>{const o=u.get(m);return o?`${o.first_name||o.firstName||""} ${o.last_name||o.lastName||""}`.trim():"Jugador"});h.push({key:i,jerseysList:N,jerseysLabel:N.join(" - "),namesList:R,namesLabel:R.join(" · "),games:t,minutes:e.minutes,possessions:Math.round(r),offRtg:d,defRtg:p,netRtg:f,plusMinus:w,efg:v,rebounds:e.rebounds,turnovers:e.turnovers})}),h.sort((e,i)=>{switch(this.sortBy){case"min":return i.minutes-e.minutes;case"plus_minus":return i.plusMinus-e.plusMinus;case"off_rtg":return i.offRtg-e.offRtg;case"def_rtg":return e.defRtg-i.defRtg;case"net_rating":default:return i.netRtg-e.netRtg}}),h}async render(a="dashboard-content-area"){var _,$,e,i;const n=document.getElementById(a)||document.getElementById("main-content")||document.querySelector(".app-main-content")||document.body;if(!n)return;const u=this._getLineupsData(),g=u.length,h=((_=x.getGames())==null?void 0:_.length)||0,y=u.map(t=>{const r=t.netRtg>0,d=r?"#16a34a":"#dc2626",p=t.plusMinus>0,f=p?`+${t.plusMinus}`:`${t.plusMinus}`,w=t.plusMinus<0?"#dc2626":p?"#16a34a":"#64748b";return`
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <td style="padding: 12px 14px; font-weight: 800; color: #0f172a; white-space: nowrap;">
            ${this.showNames?t.namesLabel:t.jerseysLabel}
          </td>
          <td style="padding: 12px; text-align: center; color: #475569; font-weight: 700;">${t.games}</td>
          <td style="padding: 12px; text-align: center; color: #475569; font-weight: 700;">${t.minutes}'</td>
          <td style="padding: 12px; text-align: center; color: #475569; font-weight: 700;">${t.possessions}</td>
          <td style="padding: 12px; text-align: center; color: #1e40af; font-weight: 800;">${t.offRtg}</td>
          <td style="padding: 12px; text-align: center; color: #f97316; font-weight: 800;">${t.defRtg}</td>
          <td style="padding: 12px; text-align: center; font-weight: 900; color: ${d};">
            ${r?"+":""}${t.netRtg}
          </td>
          <td style="padding: 12px; text-align: center; font-weight: 800; color: ${w};">
            ${f}
          </td>
          <td style="padding: 12px; text-align: center; color: #475569; font-weight: 700;">${t.efg}%</td>
          <td style="padding: 12px; text-align: center; color: #475569; font-weight: 700;">${t.rebounds}</td>
          <td style="padding: 12px; text-align: center; color: #dc2626; font-weight: 700;">${t.turnovers}</td>
        </tr>
      `}).join(""),b=u.map(t=>{const r=t.netRtg>0,d=t.plusMinus>0;return`
        <div class="lineup-mobile-card card" style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; display: flex; flex-direction: column; gap: 10px;">
          <div class="lineup-players-badges" style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${(this.showNames?t.namesList:t.jerseysList).map(f=>`<span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px;">${f}</span>`).join("")}
          </div>
          <div class="lineup-kpis-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: #f8fafc; padding: 8px; border-radius: 8px; text-align: center;">
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">MIN</span><strong style="color: #0f172a;">${t.minutes}'</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">NET RTG</span><strong style="color: ${r?"#16a34a":"#dc2626"};">${r?"+":""}${t.netRtg}</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">+/-</span><strong style="color: ${d?"#16a34a":"#dc2626"};">${d?"+":""}${t.plusMinus}</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">eFG%</span><strong style="color: #0f172a;">${t.efg}%</strong></div>
          </div>
        </div>
      `}).join("");n.innerHTML=`
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">
              🏀 ${this.t("lineups_title","Análisis de Quintetos")}
            </h1>
          </div>

          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <button id="btn-toggle-names" style="background: #ffffff; border: 1px solid #cbd5e1; color: #334155; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; min-height: 44px;">
              ${this.showNames?"🔢 "+this.t("see_jerseys","Ver dorsales"):"👤 "+this.t("see_names","Ver nombres")}
            </button>

            <select id="select-sort-lineups" style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; background: #ffffff; color: #0f172a; outline: none; min-height: 44px;">
              <option value="net_rating" ${this.sortBy==="net_rating"?"selected":""}>${this.t("sort_by_net_rtg","Ordenar por Net Rating")}</option>
              <option value="min" ${this.sortBy==="min"?"selected":""}>${this.t("sort_by_minutes","Ordenar por Minutos")}</option>
              <option value="plus_minus" ${this.sortBy==="plus_minus"?"selected":""}>${this.t("sort_by_plus_minus","Ordenar por +/-")}</option>
              <option value="off_rtg" ${this.sortBy==="off_rtg"?"selected":""}>${this.t("sort_by_off_rtg","Ordenar por OFF RTG")}</option>
              <option value="def_rtg" ${this.sortBy==="def_rtg"?"selected":""}>${this.t("sort_by_def_rtg","Ordenar por DEF RTG")}</option>
            </select>

            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 12px; color: #94a3b8;">🔍</span>
              <input type="number" id="input-min-games" value="${this.minGames}" min="1" style="width: 50px; height: 44px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 8px; text-align: center; font-size: 12px; font-weight: 700; background: #ffffff; color: #0f172a;" />
              <span style="font-size: 12px; color: #64748b; font-weight: 600;">${this.t("min_games_short","part. mínimo")}</span>
            </div>
          </div>
        </div>

        <div style="font-size: 13px; color: #64748b; margin-bottom: 20px;">
          ${this.t("showing","Mostrando")} <strong>${g}</strong> ${this.t("lineups_with","quintetos con")} ≥ ${this.minGames} ${this.t("game_s","partido")} · <strong>${h}</strong> ${this.t("games_with_registered_lineup","partidos con quinteto registrado")}
        </div>

        <div class="desktop-only" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                <th style="padding: 10px 14px;">${this.t("lineup","QUINTETO").toUpperCase()}</th>
                <th style="padding: 10px; text-align: center;">PART.</th>
                <th style="padding: 10px; text-align: center;">MIN</th>
                <th style="padding: 10px; text-align: center;">POS.</th>
                <th style="padding: 10px; text-align: center;">OFF RTG</th>
                <th style="padding: 10px; text-align: center;">DEF RTG</th>
                <th style="padding: 10px; text-align: center; color: #2563eb;">NET RTG</th>
                <th style="padding: 10px; text-align: center;">+/-</th>
                <th style="padding: 10px; text-align: center;">EFG%</th>
                <th style="padding: 10px; text-align: center;">REB</th>
                <th style="padding: 10px; text-align: center; color: #dc2626;">PER</th>
              </tr>
            </thead>
            <tbody>
              ${y.length>0?y:`<tr><td colspan="11" style="padding: 24px; text-align: center; color: #64748b;">${this.t("no_lineups_found","No se encontraron quintetos que cumplan los criterios.")}</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="mobile-only mobile-lineups-grid" style="margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px;">
          ${b.length>0?b:`<div style="padding: 24px; text-align: center; color: #64748b; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1;">${this.t("no_lineups_found","No se encontraron quintetos que cumplan los criterios.")}</div>`}
        </div>

        <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 10px; padding: 14px 18px; color: #854d0e; font-size: 13px; font-weight: 600;">
          <strong>${this.t("note_label","Nota:")}</strong> ${this.t("sample_warning_note","Las muestras de minutos son reducidas. Interpreta los resultados con precaución.")}
        </div>

      </div>

      <style>
        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
        }
      </style>
    `,($=n.querySelector("#btn-toggle-names"))==null||$.addEventListener("click",()=>{this.showNames=!this.showNames,this.render(a)}),(e=n.querySelector("#select-sort-lineups"))==null||e.addEventListener("change",t=>{this.sortBy=t.target.value,this.render(a)}),(i=n.querySelector("#input-min-games"))==null||i.addEventListener("change",t=>{this.minGames=Math.max(1,Number(t.target.value||1)),this.render(a)})}}export{F as LineupsView};
