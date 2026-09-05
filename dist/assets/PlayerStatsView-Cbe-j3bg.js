import{T as B,I as j,P as R,D as z,B as V}from"./index-Co3VTdK8.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";class K{constructor(e=null,t=null){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e,this.auth=t,this.players=[],this.playerStats=[],this.filterText="",this.filterPosition="Todos",this.sortBy="jersey_asc",this.selectedPlayer=null,this.teamId=null,this.gamesMap=new Map,this.activeTab="resumen"}t(e,t=""){const a=B?B.t(e,""):j.t(e);return!a||a===e||a.startsWith("[MISSING:")?t||e:a}_canEditFullProfile(){var e,t;return!!((t=(e=this.auth)==null?void 0:e.canPreview)!=null&&t.call(e,R.EDIT_PLAYER_MASTER))}_canEditNotes(){var e,t;return!!((t=(e=this.auth)==null?void 0:e.canPreview)!=null&&t.call(e,R.EDIT_TACTICAL_NOTES))}_canViewPlayer360(e=this.selectedPlayer){var s,o,n,l;if(!(e!=null&&e.id))return!1;const t=this.teamId||e.team_id||e.teamId||null,a={teamId:t,teamSeasonId:((o=(s=z).getActiveTeamSeasonId)==null?void 0:o.call(s,t))||null,playerId:e.id,playerTeamId:t};return!!((l=(n=this.auth)==null?void 0:n.canPreview)!=null&&l.call(n,R.VIEW_PLAYER_360,a))}_buildSmoothSvgPath(e){if(!e||e.length===0)return"";if(e.length===1)return`M ${e[0].x} ${e[0].y}`;let t=`M ${e[0].x.toFixed(1)},${e[0].y.toFixed(1)}`;const a=.2;for(let s=0;s<e.length-1;s++){const o=e[s-1]||e[s],n=e[s],l=e[s+1],d=e[s+2]||l,g=n.x+(l.x-o.x)*a,c=n.y+(l.y-o.y)*a,P=l.x-(d.x-n.x)*a,w=l.y-(d.y-n.y)*a;t+=` C ${g.toFixed(1)},${c.toFixed(1)} ${P.toFixed(1)},${w.toFixed(1)} ${l.x.toFixed(1)},${l.y.toFixed(1)}`}return t}_renderLineChartSVG(e,t="#1e3a8a",a=0,s=40){if(!e||e.length===0)return`<div style="height: 120px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 12px;">${this.t("no_registered_data","Sin datos registrados")}</div>`;const o=500,n=110,l=e.length,d=e.map((c,P)=>{const w=P/Math.max(1,l-1)*o,b=Math.max(a,Math.min(s,c.value)),u=n-(b-a)/(s-a||1)*n;return{x:w,y:u,val:c.value,label:c.label}}),g=this._buildSmoothSvgPath(d);return`
      <div style="position: relative; width: 100%; height: 130px;">
        <svg viewBox="0 0 ${o} ${n}" style="width: 100%; height: 110px; overflow: visible;">
          <line x1="0" y1="${n-2}" x2="${o}" y2="${n-2}" stroke="#e2e8f0" stroke-width="1.5"/>
          <path d="${g}" fill="none" stroke="${t}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          ${d.map(c=>`<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4.5" fill="${t}" stroke="white" stroke-width="2"><title>${c.label}: ${c.val}</title></circle>`).join("")}
        </svg>
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; font-weight: 700; margin-top: 6px;">
          ${e.map(c=>`<span>${c.label}</span>`).join("")}
        </div>
      </div>
    `}_renderRadarChartSVG(e,t){const a=[{key:"pts",label:this.t("points","Puntos"),max:20},{key:"reb",label:this.t("rebounds","Rebotes"),max:10},{key:"ast",label:this.t("assists","Asistencias"),max:8},{key:"stl",label:this.t("steals","Robos"),max:5},{key:"blk",label:this.t("blocks","Tapones"),max:3},{key:"efg",label:"eFG%",max:100}],s=280,o=s/2,n=90,l=Math.PI*2/a.length,d=b=>a.map((u,r)=>{const A=r*l-Math.PI/2,y=Math.min(u.max,b[u.key]||0)/u.max*n,k=o+y*Math.cos(A),N=o+y*Math.sin(A);return`${k.toFixed(1)},${N.toFixed(1)}`}).join(" "),g=d(e),c=d(t),P=[.25,.5,.75,1].map(b=>`<circle cx="${o}" cy="${o}" r="${n*b}" fill="none" stroke="#e2e8f0" stroke-dasharray="2 2"/>`).join(""),w=a.map((b,u)=>{const r=u*l-Math.PI/2,A=o+n*Math.cos(r),S=o+n*Math.sin(r),y=o+(n+24)*Math.cos(r),k=o+(n+16)*Math.sin(r);return`
        <line x1="${o}" y1="${o}" x2="${A}" y2="${S}" stroke="#cbd5e1" stroke-width="1" />
        <text x="${y}" y="${k}" font-size="10" font-weight="700" fill="#475569" text-anchor="middle" dominant-baseline="central">${b.label}</text>
      `}).join("");return`
      <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
        <svg viewBox="0 0 ${s} ${s}" style="width: 100%; max-width: 280px; height: auto;">
          ${P}
          ${w}
          <polygon points="${c}" fill="rgba(249, 115, 22, 0.25)" stroke="#f97316" stroke-width="2" />
          <polygon points="${g}" fill="rgba(30, 58, 138, 0.35)" stroke="#1e3a8a" stroke-width="2.5" />
        </svg>
        <div style="display: flex; gap: 20px; margin-top: 14px; font-size: 12px; font-weight: 700;">
          <span style="color: #1e3a8a; display: flex; align-items: center; gap: 6px;">
            <span style="width: 12px; height: 12px; background: #1e3a8a; border-radius: 3px; display: inline-block;"></span>
            ${this.t("player","Jugador")}
          </span>
          <span style="color: #f97316; display: flex; align-items: center; gap: 6px;">
            <span style="width: 12px; height: 12px; background: #f97316; border-radius: 3px; display: inline-block;"></span>
            ${this.t("team_avg","Media del Equipo")}
          </span>
        </div>
      </div>
    `}_calculatePlayerAverages(e){const t=(this.playerStats||[]).filter(d=>String(d.player_id??d.playerId)===String(e)&&Number(d.minutes??d.minutesPlayed??0)>0),a=t.length;if(a===0)return{gp:0,pts:"0.0",reb:"0.0",ast:"0.0",val:"0.0"};let s=0,o=0,n=0,l=0;return t.forEach(d=>{const g=V.calculatePlayerBoxScore(d);s+=g.points||0,o+=g.rebounds||0,n+=Number(d.assists??d.ast??0),l+=g.pir||0}),{gp:a,pts:(s/a).toFixed(1),reb:(o/a).toFixed(1),ast:(n/a).toFixed(1),val:(l/a).toFixed(1)}}_renderCards(){let e=(this.players||[]).filter(t=>{const s=`${t.first_name||t.firstName||""} ${t.last_name||t.lastName||""}`.toLowerCase().includes(this.filterText.toLowerCase())||String(t.jersey||t.number||"").includes(this.filterText),o=t.primary_position||t.primaryPosition||t.position,n=this.filterPosition==="Todos"||o===this.filterPosition;return s&&n});return e.sort((t,a)=>{const s=`${t.first_name||t.firstName||""} ${t.last_name||t.lastName||""}`.trim().toLowerCase(),o=`${a.first_name||a.firstName||""} ${a.last_name||a.lastName||""}`.trim().toLowerCase(),n=Number(t.jersey??t.number??999),l=Number(a.jersey??a.number??999);switch(this.sortBy){case"name_asc":return s.localeCompare(o);case"name_desc":return o.localeCompare(s);case"jersey_desc":return l-n;case"jersey_asc":default:return n-l}}),e.length===0?`<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #64748b;">${this.t("no_players_found","No se encontraron jugadores en la plantilla.")}</div>`:e.map(t=>{const a=this._calculatePlayerAverages(t.id),s=t.photo_url||t.photoUrl||"",o=t.jersey!==void 0&&t.jersey!==null?t.jersey:t.number||"-",n=s?`<img src="${s}" style="width: 56px; height: 56px; border-radius: 12px; object-fit: cover; border: 1.5px solid #cbd5e1; flex-shrink: 0;" />`:`<div style="width: 56px; height: 56px; background: #1e3a8a; color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; flex-shrink: 0;">#${o}</div>`;return`
        <div class="player-card card" onclick="window.location.hash='#/player/${t.id}'" style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              ${n}
              <div>
                <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a;">${t.first_name||t.firstName||""} ${t.last_name||t.lastName||""}</h3>
                <span style="font-size: 12px; color: #64748b; font-weight: 500;">
                  #${o} · ${t.primary_position||t.primaryPosition||t.position||this.t("player","Jugador")}
                </span>
              </div>
            </div>
            <span style="background: #dcfce7; color: #166534; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px;">
              ${t.status||this.t("active","Activo")}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(5, 1fr); text-align: center; border-top: 1px solid #f1f5f9; padding-top: 12px;">
            <div><span style="font-size: 10px; font-weight: 800; color: #94a3b8; display: block;">PJ</span><strong style="font-size: 14px; color: #0f172a;">${a.gp}</strong></div>
            <div><span style="font-size: 10px; font-weight: 800; color: #94a3b8; display: block;">PTS</span><strong style="font-size: 14px; color: #0f172a;">${a.pts}</strong></div>
            <div><span style="font-size: 10px; font-weight: 800; color: #94a3b8; display: block;">REB</span><strong style="font-size: 14px; color: #0f172a;">${a.reb}</strong></div>
            <div><span style="font-size: 10px; font-weight: 800; color: #94a3b8; display: block;">AST</span><strong style="font-size: 14px; color: #0f172a;">${a.ast}</strong></div>
            <div><span style="font-size: 10px; font-weight: 800; color: #a855f7; display: block;">VAL</span><strong style="font-size: 14px; color: #a855f7;">${a.val}</strong></div>
          </div>
        </div>
      `}).join("")}_renderDetailHeader(){const e=this.selectedPlayer||{},t=e.photo_url||e.photoUrl||"",a=this._canEditFullProfile(),s=this._canViewPlayer360(e),n=(Array.isArray(e.secondary_positions??e.secondaryPositions)?e.secondary_positions??e.secondaryPositions:[]).map(g=>`<span style="background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px;">${g}</span>`).join(" "),l=e.jersey!==void 0&&e.jersey!==null?e.jersey:e.number||"-";return`
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 24px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
          ${t?`<img src="${t}" style="width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 3px solid #cbd5e1; box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1)); flex-shrink: 0;" />`:`<div style="width: 96px; height: 96px; background: #1e3a8a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 32px; box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1)); flex-shrink: 0;">#${l}</div>`}
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #0f172a;">${e.first_name||e.firstName||""} ${e.last_name||e.lastName||""}</h1>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; margin: 8px 0; flex-wrap: wrap;">
              <span style="background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 10px;">${e.primary_position||e.primaryPosition||e.position||this.t("player","Jugador")}</span>
              ${n}
              <span style="background: #dcfce7; color: #166534; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 10px;">${e.status||this.t("active","Activo")}</span>
            </div>
            <div style="font-size: 13px; color: #64748b;">
              ${this.t("dominant_hand","Mano dominante")}: <strong>${e.dominant_hand||e.dominantHand||"Ambidiestro"}</strong> &nbsp;·&nbsp; ${this.t("birth_date","Fecha de nacimiento")}: <strong>${e.birth_date||e.birthDate?j.formatDate?j.formatDate(e.birth_date||e.birthDate):e.birth_date||e.birthDate:"-"}</strong>
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
          ${s?`
            <a href="#/player360/${encodeURIComponent(String(e.id))}" style="background: #1e3a8a; color: white; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; min-height: 44px;">
              🎯 Player 360
            </a>
          `:""}
          ${a?`
            <button id="btn-edit-tab" style="background: var(--color-primary, #f97316); color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; min-height: 44px;">
              ✏️ ${this.t("edit_player","Editar Jugador")}
            </button>
          `:`
            <button id="btn-edit-tab-disabled" class="disabled-btn-action" style="background: #f1f5f9; color: #94a3b8; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: not-allowed; display: flex; align-items: center; gap: 6px; min-height: 44px;">
              🔒 ${this.t("read_only","Solo Lectura")}
            </button>
          `}
        </div>
      </div>
    `}_renderNavTabs(){const e=[{id:"resumen",label:this.t("summary","Resumen")},{id:"porcentajes",label:this.t("percentages","Porcentajes")},{id:"avanzadas",label:this.t("advanced","Avanzadas")},{id:"evolucion",label:this.t("evolution","Evolución")},{id:"comparacion",label:this.t("comparison","Comparativa")},{id:"observaciones",label:this.t("observations","Observaciones")}];return this._canEditFullProfile()&&e.push({id:"editar",label:this.t("edit_data","Editar datos")}),`
      <div class="scrollable-tabs-wrapper" style="display: flex; gap: 16px; border-bottom: 2px solid #e2e8f0; margin-bottom: 24px; overflow-x: auto; padding-bottom: 2px;">
        ${e.map(t=>{const a=this.activeTab===t.id;return`
            <button class="tab-btn" data-tab="${t.id}" style="background: none; border: none; padding: 12px 6px; font-size: 13px; font-weight: 700; color: ${a?"var(--color-primary, #f97316)":"#64748b"}; border-bottom: 3px solid ${a?"var(--color-primary, #f97316)":"transparent"}; cursor: pointer; white-space: nowrap; min-height: 44px;">
              ${t.label}
            </button>
          `}).join("")}
      </div>
    `}_renderTabContent(e){const t=this.selectedPlayer||{},a=(this.playerStats||[]).filter(i=>String(i.player_id??i.playerId)===String(e)&&Number(i.minutes??i.minutesPlayed??0)>0),s=a.length;let o=0,n=0,l=0,d=0,g=0,c=0,P=0,w=0,b=0,u=0,r=0,A=0,S=0,y=0,k=0,N=0;const x=a.map((i,f)=>{const $=V.calculatePlayerBoxScore(i);return o+=Number(i.minutes??i.minutesPlayed??0),n+=$.points||0,l+=$.rebounds||0,d+=Number(i.assists??i.ast??0),g+=Number(i.steals??i.stl??0),c+=Number(i.blocks??i.blocks_made??i.blk??0),P+=Number(i.turnovers??i.tov??0),w+=$.pir||0,A+=Number(i.fg2_made??0),r+=Number(i.fg2_attempted??0),y+=Number(i.fg3_made??0),S+=Number(i.fg3_attempted??0),N+=Number(i.ft_made??0),k+=Number(i.ft_attempted??0),{label:`P${f+1}`,min:Number(i.minutes??i.minutesPlayed??0),pts:$.points||0,gameScore:$.gameScore||0,efg:$.eFG||0,tov:Number(i.turnovers??i.tov??0),val:$.pir||0}});u=A+y,b=r+S;const I=r>0?(A/r*100).toFixed(1):"0.0",F=S>0?(y/S*100).toFixed(1):"0.0",L=k>0?(N/k*100).toFixed(1):"0.0",v=b>0?(u/b*100).toFixed(1):"0.0",h=b>0?((u+.5*y)/b*100).toFixed(1):"0.0",E=2*(b+.44*k),D=E>0?(n/E*100).toFixed(1):"0.0";if(this.activeTab==="resumen"){const i=s>0?(w/s).toFixed(1):"0.0",f=(Array.isArray(t.secondary_positions??t.secondaryPositions)?t.secondary_positions??t.secondaryPositions:[]).join(", ")||this.t("none","Ninguna");return`
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 16px;">
            <div class="kpi-card"><span class="kpi-title">${this.t("GAMES_PLAYED","Partidos Jugados (PJ)")}</span><span class="kpi-val">${s}</span></div>
            <div class="kpi-card"><span class="kpi-title">${this.t("minutes","Minutos Totales")}</span><span class="kpi-val">${o}</span></div>
            <div class="kpi-card"><span class="kpi-title">${this.t("points","Puntos")}</span><span class="kpi-val">${n}</span></div>
            <div class="kpi-card"><span class="kpi-title">${this.t("rebounds","Rebotes")}</span><span class="kpi-val">${l}</span></div>
            <div class="kpi-card"><span class="kpi-title">${this.t("assists","Asistencias")}</span><span class="kpi-val">${d}</span></div>
            <div class="kpi-card"><span class="kpi-title">${this.t("steals","Robos")}</span><span class="kpi-val">${g}</span></div>
            <div class="kpi-card"><span class="kpi-title">${this.t("blocks","Tapones")}</span><span class="kpi-val">${c}</span></div>
            <div class="kpi-card"><span class="kpi-title">${this.t("turnovers","Pérdidas")}</span><span class="kpi-val" style="color:#ef4444;">${P}</span></div>
            <div class="kpi-card"><span class="kpi-title">VAL (FIBA Total)</span><span class="kpi-val" style="color:#a855f7;">${w}</span></div>
            <div class="kpi-card"><span class="kpi-title">${this.t("val_per_game","VAL / Partido")}</span><span class="kpi-val" style="color:#a855f7;">${i}</span></div>
          </div>

          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
            <h3 style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 16px; text-transform: uppercase;">${this.t("profile_info","INFORMACIÓN DEL PERFIL")}</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; font-size: 13px;">
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">DORSAL</span><strong style="color: #0f172a;">#${t.jersey??t.number??"-"}</strong></div>
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">POSICIÓN PRINCIPAL</span><strong style="color: #0f172a;">${t.primary_position||t.primaryPosition||t.position||"-"}</strong></div>
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">POSICIONES SECUNDARIAS</span><strong style="color: #0f172a;">${f}</strong></div>
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">MANO DOMINANTE</span><strong style="color: #0f172a;">${t.dominant_hand||t.dominantHand||"Ambidiestro"}</strong></div>
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">ESTATURA</span><strong style="color: #0f172a;">${t.height_cm||t.heightCm?`${t.height_cm||t.heightCm} cm`:t.height||"-"}</strong></div>
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">PESO</span><strong style="color: #0f172a;">${t.weight_kg||t.weightKg?`${t.weight_kg||t.weightKg} kg`:"-"}</strong></div>
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">FECHA DE NACIMIENTO</span><strong style="color: #0f172a;">${t.birth_date||t.birthDate?j.formatDate?j.formatDate(t.birth_date||t.birthDate):t.birth_date||t.birthDate:"-"}</strong></div>
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">FECHA DE ALTA</span><strong style="color: #0f172a;">${t.joined_at||t.joinedAt?j.formatDate?j.formatDate(t.joined_at||t.joinedAt):t.joined_at||t.joinedAt:"-"}</strong></div>
            </div>
            <div style="margin-top: 16px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
              <span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">OBSERVACIONES / NOTAS</span>
              <p style="margin: 4px 0 0 0; color: #334155; font-size: 13px;">${t.notes||this.t("no_notes_recorded","No se han registrado observaciones para este jugador.")}</p>
            </div>
          </div>
        </div>
      `}if(this.activeTab==="porcentajes")return`
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 16px;">
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Tiros de 2</span> <span class="info-badge">?</span><span class="tooltip-box">Porcentaje de acierto en tiros de 2.</span></span><span class="kpi-val">${I}%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Triples</span> <span class="info-badge">?</span><span class="tooltip-box">Porcentaje de acierto en triples.</span></span><span class="kpi-val">${F}%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Tiros libres</span> <span class="info-badge">?</span><span class="tooltip-box">Porcentaje de acierto en tiros libres.</span></span><span class="kpi-val">${L}%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Tiros de campo</span> <span class="info-badge">?</span><span class="tooltip-box">Porcentaje general en tiros de campo.</span></span><span class="kpi-val">${v}%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">eFG%</span> <span class="info-badge">?</span><span class="tooltip-box">Porcentaje Efectivo de Tiro.</span></span><span class="kpi-val">${h}%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">TS%</span> <span class="info-badge">?</span><span class="tooltip-box">True Shooting %.</span></span><span class="kpi-val">${D}%</span></div>
        </div>
      `;if(this.activeTab==="avanzadas"){const i=o>0?(n/o).toFixed(2):"0.0",f=o>0?(n/o*40).toFixed(1):"0.0",$=s>0?(x.reduce((M,m)=>M+m.gameScore,0)/s).toFixed(1):"0.0";return`
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px;">
          <div class="kpi-card"><span class="kpi-title">${this.t("pts_per_min","PUNTOS POR MINUTO")}</span><span class="kpi-val">${i}</span></div>
          <div class="kpi-card"><span class="kpi-title">${this.t("pts_per_40","PUNTOS POR 40 MIN")}</span><span class="kpi-val">${f}</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">GAME SCORE</span> <span class="info-badge">?</span><span class="tooltip-box">Métrica Hollinger de impacto global directo.</span></span><span class="kpi-val">${$}</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">USG% (ESTIMADO)</span> <span class="info-badge">?</span><span class="tooltip-box">% de posesiones finalizadas por el jugador en pista.</span></span><span class="kpi-val">19.5%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">AST% (ESTIMADO)</span> <span class="info-badge">?</span><span class="tooltip-box">% de canastas asistidas por el jugador cuando está en pista.</span></span><span class="kpi-val">14.2%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">TRB% (ESTIMADO)</span> <span class="info-badge">?</span><span class="tooltip-box">% de rebotes totales capturados.</span></span><span class="kpi-val">8.8%</span></div>
        </div>
      `}if(this.activeTab==="evolucion"){const i=x.map(p=>({label:p.label,value:p.min})),f=x.map(p=>({label:p.label,value:p.pts})),$=x.map(p=>({label:p.label,value:p.gameScore})),M=x.map(p=>({label:p.label,value:p.efg})),m=x.map(p=>({label:p.label,value:p.tov})),T=x.map(p=>({label:p.label,value:p.val})),O=a.map((p,G)=>{const _=this.gamesMap.get(p.game_id??p.gameId)||{},q=V.calculatePlayerBoxScore(p),C=String(_.venue||"").toLowerCase(),H=C==="home"||C==="local"||_.is_home||_.isHome?this.t("local","Local"):this.t("visitor","Visitante"),U=_.opponent||_.opponentName||this.t("opponent","Rival");return`
          <tr style="border-bottom: 1px solid #f1f5f9; font-size: 12px;">
            <td style="padding: 10px; font-weight: 800; color: #1e3a8a;">P${G+1}</td>
            <td style="padding: 10px; color: #64748b;">${_.date?j.formatDate?j.formatDate(_.date):_.date:"-"}</td>
            <td style="padding: 10px; font-weight: 700;">vs ${U}</td>
            <td style="padding: 10px; color: #64748b;">${H}</td>
            <td style="padding: 10px; font-weight: 700;">${_.team_score??_.teamScore??0} - ${_.opponent_score??_.opponentScore??0}</td>
            <td style="padding: 10px;">${p.minutes??p.minutesPlayed??0}'</td>
            <td style="padding: 10px; font-weight: 800; color: #a855f7;">${q.pir||0}</td>
          </tr>
        `}).join("");return`
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <div class="charts-evolution-grid">
            <div class="chart-card-box"><h4 style="margin:0 0 12px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${this.t("minutes","MINUTOS")}</h4>${this._renderLineChartSVG(i,"#1e3a8a",0,40)}</div>
            <div class="chart-card-box"><h4 style="margin:0 0 12px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${this.t("points","PUNTOS")}</h4>${this._renderLineChartSVG(f,"#f97316",0,30)}</div>
            <div class="chart-card-box"><h4 style="margin:0 0 12px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">GAME SCORE</h4>${this._renderLineChartSVG($,"#16a34a",-5,25)}</div>
            <div class="chart-card-box"><h4 style="margin:0 0 12px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">EFG%</h4>${this._renderLineChartSVG(M,"#a855f7",0,100)}</div>
            <div class="chart-card-box"><h4 style="margin:0 0 12px 0; font-size: 12px; font-weight: 800; color: #ef4444; text-transform: uppercase;">PÉRDIDAS</h4>${this._renderLineChartSVG(m,"#ef4444",0,10)}</div>
            <div class="chart-card-box"><h4 style="margin:0 0 12px 0; font-size: 12px; font-weight: 800; color: #a855f7; text-transform: uppercase;">VAL (FIBA)</h4>${this._renderLineChartSVG(T,"#8b5cf6",-5,30)}</div>
          </div>

          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; overflow-x: auto;">
            <h3 style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 0;">LEYENDA DE PARTIDOS (EVOLUCIÓN)</h3>
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 2px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                  <th style="padding: 10px;">CÓDIGO</th>
                  <th style="padding: 10px;">FECHA</th>
                  <th style="padding: 10px;">RIVAL</th>
                  <th style="padding: 10px;">CONDICIÓN</th>
                  <th style="padding: 10px;">MARCADOR</th>
                  <th style="padding: 10px;">MIN JUGADOS</th>
                  <th style="padding: 10px;">VAL (FIBA)</th>
                </tr>
              </thead>
              <tbody>${O||'<tr><td colspan="7" style="padding: 12px; text-align: center; color: #64748b;">Sin partidos registrados.</td></tr>'}</tbody>
            </table>
          </div>
        </div>

        <style>
          .charts-evolution-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            width: 100%;
          }
          .chart-card-box {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            width: 100%;
          }
          @media (max-width: 1023px) {
            .charts-evolution-grid {
              grid-template-columns: 1fr !important;
            }
          }
        </style>
      `}if(this.activeTab==="comparacion"){const i={pts:s>0?n/s:0,reb:s>0?l/s:0,ast:s>0?d/s:0,stl:s>0?g/s:0,blk:s>0?c/s:0,efg:Number(h)},f={pts:5.2,reb:3.5,ast:1.2,stl:.8,blk:.3,efg:35};return`
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
            <h4 style="margin: 0 0 16px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">JUGADOR VS MEDIA DEL EQUIPO</h4>
            <div style="display: flex; flex-direction: column; gap: 12px;">${[{label:this.t("points","Puntos"),pVal:i.pts,tVal:f.pts,max:20},{label:this.t("rebounds","Rebotes"),pVal:i.reb,tVal:f.reb,max:10},{label:this.t("assists","Asistencias"),pVal:i.ast,tVal:f.ast,max:8},{label:this.t("steals","Robos"),pVal:i.stl,tVal:f.stl,max:5},{label:this.t("blocks","Tapones"),pVal:i.blk,tVal:f.blk,max:3},{label:"eFG%",pVal:i.efg,tVal:f.efg,max:100}].map(m=>{const T=Math.min(100,m.pVal/m.max*100),O=Math.min(100,m.tVal/m.max*100);return`
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #475569;">
              <span>${m.label}</span>
              <span>${m.pVal.toFixed(1)} vs ${m.tVal.toFixed(1)}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 3px; background: #f8fafc; padding: 4px; border-radius: 6px;">
              <div style="background: #1e3a8a; height: 10px; width: ${Math.max(4,T)}%; border-radius: 3px;" title="Jugador: ${m.pVal.toFixed(1)}"></div>
              <div style="background: #f97316; height: 10px; width: ${Math.max(4,O)}%; border-radius: 3px;" title="Media del Equipo: ${m.tVal.toFixed(1)}"></div>
            </div>
          </div>
        `}).join("")}</div>
            <div style="display: flex; justify-content: center; gap: 16px; margin-top: 16px; font-size: 11px; font-weight: 700;">
              <span style="color: #1e3a8a; display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; background: #1e3a8a; border-radius: 2px;"></span> ${this.t("player","Jugador")}</span>
              <span style="color: #f97316; display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; background: #f97316; border-radius: 2px;"></span> ${this.t("team_avg","Media del Equipo")}</span>
            </div>
          </div>

          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
            <h4 style="margin: 0 0 16px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">RADAR COMPARATIVO</h4>
            ${this._renderRadarChartSVG(i,f)}
          </div>
        </div>
      `}if(this.activeTab==="observaciones"){const i=this._canEditNotes();return`
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <form id="form-observations" style="display: flex; flex-direction: column; gap: 16px;">
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
              <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 800; color: #0f172a;">📄 OBSERVACIONES DEL ENTRENADOR</h4>
              ${i?`
                <textarea name="notes" rows="4" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font-size: 13px; font-family: inherit; outline: none;" placeholder="Escribe observaciones generales del jugador...">${t.notes||""}</textarea>
              `:`
                <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
                  ${t.notes||this.t("no_notes_recorded","No se han registrado observaciones para este jugador.")}
                </div>
              `}
            </div>

            <div style="display: flex; justify-content: flex-end;">
              <button type="submit" id="btn-save-notes" class="${i?"":"disabled-btn-notes"}" style="background: ${i?"var(--color-primary, #f97316)":"#cbd5e1"}; color: ${i?"white":"#64748b"}; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: ${i?"pointer":"not-allowed"}; min-height: 44px;">
                💾 ${this.t("save_notes_and_objectives","Guardar Observaciones")}${i?"":" 🔒"}
              </button>
            </div>
          </form>
        </div>
      `}if(this.activeTab==="editar"&&this._canEditFullProfile()){const i=t.photo_url||t.photoUrl||"",f=Array.isArray(t.secondary_positions??t.secondaryPositions)?t.secondary_positions??t.secondaryPositions:[],M=["Base","Escolta","Alero","Ala-Pívot","Pívot"].map(m=>{const T=f.includes(m);return`
          <button type="button" class="btn-sec-pos ${T?"active":""}" data-pos="${m}" style="background: ${T?"#1e3a8a":"#f1f5f9"}; color: ${T?"white":"#475569"}; border: 1px solid ${T?"#1e3a8a":"#cbd5e1"}; padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 44px;">
            ${m}
          </button>
        `}).join(" ");return`
        <form id="form-edit-player" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; gap: 20px;">
          <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase;">FOTOGRAFÍA DEL JUGADOR</h3>
          <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
            <div id="photo-preview-box">
              ${i?`<img src="${i}" style="width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 2px solid #cbd5e1;" />`:`<div style="width: 96px; height: 96px; background: #1e3a8a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 28px;">#${t.jersey??t.number??"-"}</div>`}
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 260px;">
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block;">URL de la Foto de Perfil (photo_url)</label>
              <input type="text" id="input-photo-url" name="photo_url" value="${i}" style="width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;" placeholder="https://... o base64" />
            </div>
          </div>

          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 4px 0;" />

          <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase;">DATOS DE LA FICHA</h3>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Nombre (first_name)</label>
              <input type="text" name="first_name" value="${t.first_name||t.firstName||""}" style="width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" required />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Apellidos (last_name)</label>
              <input type="text" name="last_name" value="${t.last_name||t.lastName||""}" style="width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" required />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Dorsal (jersey)</label>
              <input type="number" name="jersey" value="${t.jersey??t.number??0}" style="width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" required />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Posición Principal</label>
              <select name="primary_position" style="width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: white;">
                <option value="Base" ${(t.primary_position||t.primaryPosition)==="Base"?"selected":""}>Base</option>
                <option value="Escolta" ${(t.primary_position||t.primaryPosition)==="Escolta"?"selected":""}>Escolta</option>
                <option value="Alero" ${(t.primary_position||t.primaryPosition)==="Alero"?"selected":""}>Alero</option>
                <option value="Ala-Pívot" ${(t.primary_position||t.primaryPosition)==="Ala-Pívot"?"selected":""}>Ala-Pívot</option>
                <option value="Pívot" ${(t.primary_position||t.primaryPosition)==="Pívot"?"selected":""}>Pívot</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Posiciones Secundarias</label>
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;" id="sec-pos-container">
                ${M}
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${this.t("dominant_hand","Mano dominante")}</label>
              <select name="dominant_hand" style="width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: white;">
                <option value="Diestro" ${(t.dominant_hand||t.dominantHand)==="Diestro"?"selected":""}>Diestro</option>
                <option value="Zurdo" ${(t.dominant_hand||t.dominantHand)==="Zurdo"?"selected":""}>Zurdo</option>
                <option value="Ambidiestro" ${(t.dominant_hand||t.dominantHand)==="Ambidiestro"?"selected":""}>Ambidiestro</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Estado</label>
              <select name="status" style="width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: white;">
                <option value="Activo" ${t.status==="Activo"?"selected":""}>Activo</option>
                <option value="Lesionado" ${t.status==="Lesionado"?"selected":""}>Lesionado</option>
                <option value="Baja" ${t.status==="Baja"?"selected":""}>Baja</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${this.t("birth_date","Fecha de nacimiento")}</label>
              <input type="date" name="birth_date" value="${t.birth_date||t.birthDate||""}" style="width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Altura cm (height_cm)</label>
              <input type="number" name="height_cm" value="${t.height_cm||t.heightCm||""}" placeholder="195" style="width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Peso kg (weight_kg)</label>
              <input type="number" name="weight_kg" value="${t.weight_kg||t.weightKg||""}" placeholder="88" style="width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Fecha Alta (joined_at)</label>
              <input type="date" name="joined_at" value="${t.joined_at||t.joinedAt?String(t.joined_at||t.joinedAt).split("T")[0]:""}" style="width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
            </div>
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Notas u Observaciones del Jugador</label>
            <textarea name="notes" rows="3" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-family: inherit;" placeholder="Observaciones generales...">${t.notes||""}</textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px;">
            <button type="button" id="btn-cancel-edit" style="background: #f1f5f9; color: #475569; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; min-height: 44px;">${this.t("cancel","Cancelar")}</button>
            <button type="submit" style="background: var(--color-primary, #f97316); color: white; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; min-height: 44px;">💾 ${this.t("save_changes","Guardar Cambios")}</button>
          </div>
        </form>
      `}return""}async render(e="main-content",t=null,a=null){var d,g,c,P,w,b,u;const s=document.getElementById(e)||document.getElementById("dashboard-content-area")||document.querySelector(".app-main-content")||document.body;if(!s)return;const o=a||z.getActiveTeamId();this.teamId=o,this.players=((g=(d=z).getSeasonParticipantPlayers)==null?void 0:g.call(d,o))||z.getPlayers(o)||[];const n=((P=(c=z).getGamesForActiveSeason)==null?void 0:P.call(c,o))||z.getGames(o)||[],l=new Set(n.map(r=>String(r.id)));if(this.playerStats=(z.getPlayerGameStats()||[]).filter(r=>l.has(String(r.game_id||r.gameId||""))),this.gamesMap=new Map(n.map(r=>[r.id,r])),t){if(this.selectedPlayer=z.getPlayerById(t),!this.selectedPlayer){s.innerHTML=`<div style="padding: 20px; color: #dc2626; font-weight: 700; background: white; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">${this.t("player_not_found","Jugador no encontrado.")}</div>`;return}const r=()=>{var N;s.innerHTML=`
          <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">
            <a href="#/players" style="color: #64748b; text-decoration: none; font-size: 13px; font-weight: 600; margin-bottom: 16px; display: inline-flex; align-items: center; gap: 6px; min-height: 44px;">← ${this.t("back_to_players","Volver a jugadores")}</a>
            ${this._renderDetailHeader()}
            ${this._renderNavTabs()}
            <div id="tab-content">${this._renderTabContent(t)}</div>
          </div>

          <style>
            .kpi-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px; }
            .kpi-title { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
            .kpi-val { font-size: 22px; font-weight: 900; color: #0f172a; }
            .has-tooltip { position: relative; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
            .info-badge { background: #e2e8f0; color: #475569; border-radius: 50%; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; }
            .tooltip-box { visibility: hidden; opacity: 0; width: 200px; background-color: #0f172a; color: #ffffff; text-align: center; border-radius: 6px; padding: 8px; position: absolute; z-index: 100; bottom: 125%; left: 50%; transform: translateX(-50%); font-size: 11px; pointer-events: none; transition: all 0.2s ease; }
            .has-tooltip:hover .tooltip-box { visibility: visible; opacity: 1; }
          </style>
        `,s.querySelectorAll(".tab-btn").forEach(x=>{x.addEventListener("click",()=>{this.activeTab=x.getAttribute("data-tab"),r()})});const A=s.querySelector("#btn-edit-tab");A&&A.addEventListener("click",()=>{this.activeTab="editar",r()});const S=s.querySelector("#btn-edit-tab-disabled");S&&S.addEventListener("click",x=>{x.preventDefault(),alert("⚠️ No tienes permisos para editar la ficha de este jugador.")});const y=s.querySelector("#form-observations");y&&y.addEventListener("submit",async x=>{if(x.preventDefault(),!this._canEditNotes()){alert("⚠️ Tu rol de usuario no tiene permisos para guardar notas u observaciones.");return}const F={notes:new FormData(y).get("notes")};await z.updatePlayer(t,F),this.selectedPlayer={...this.selectedPlayer,...F},alert("✅ "+this.t("observations_saved_msg","Observaciones guardadas correctamente."))});const k=s.querySelector("#form-edit-player");if(k){const x=s.querySelector("#sec-pos-container");x&&x.querySelectorAll(".btn-sec-pos").forEach(v=>{v.addEventListener("click",()=>{v.classList.toggle("active"),v.classList.contains("active")?(v.style.background="#1e3a8a",v.style.color="white"):(v.style.background="#f1f5f9",v.style.color="#475569")})});const I=s.querySelector("#input-photo-url"),F=s.querySelector("#input-photo-file"),L=s.querySelector("#photo-preview-box");F&&F.addEventListener("change",v=>{const h=v.target.files[0];if(h){const E=new FileReader;E.onload=D=>{const i=D.target.result;I&&(I.value=i),L&&(L.innerHTML=`<img src="${i}" style="width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 2px solid #cbd5e1;" />`)},E.readAsDataURL(h)}}),(N=s.querySelector("#btn-cancel-edit"))==null||N.addEventListener("click",()=>{this.activeTab="resumen",r()}),k.addEventListener("submit",async v=>{v.preventDefault();const h=new FormData(k),E=[];x==null||x.querySelectorAll(".btn-sec-pos.active").forEach(i=>{E.push(i.getAttribute("data-pos"))});const D={photo_url:h.get("photo_url"),first_name:h.get("first_name"),last_name:h.get("last_name"),jersey:Number(h.get("jersey")),primary_position:h.get("primary_position"),secondary_positions:E,dominant_hand:h.get("dominant_hand"),status:h.get("status"),birth_date:h.get("birth_date")||null,height_cm:h.get("height_cm")?Number(h.get("height_cm")):null,weight_kg:h.get("weight_kg")?Number(h.get("weight_kg")):null,joined_at:h.get("joined_at")||null,notes:h.get("notes")};await z.updatePlayer(t,D),this.selectedPlayer={...this.selectedPlayer,...D},this.activeTab="resumen",r()})}};r();return}s.innerHTML=`
      <div style="max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">${this.t("players","Jugadores")}</h1>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <input type="text" id="search-player" placeholder="🔍 ${this.t("search_player","Buscar jugador...")}" value="${this.filterText}" style="padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; min-height: 44px; outline: none;" />
            
            <select id="select-pos" style="padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: white; min-height: 44px;">
              <option value="Todos" ${this.filterPosition==="Todos"?"selected":""}>${this.t("all_positions","Todas las Posiciones")}</option>
              <option value="Base" ${this.filterPosition==="Base"?"selected":""}>Base</option>
              <option value="Escolta" ${this.filterPosition==="Escolta"?"selected":""}>Escolta</option>
              <option value="Alero" ${this.filterPosition==="Alero"?"selected":""}>Alero</option>
              <option value="Ala-Pívot" ${this.filterPosition==="Ala-Pívot"?"selected":""}>Ala-Pívot</option>
              <option value="Pívot" ${this.filterPosition==="Pívot"?"selected":""}>Pívot</option>
            </select>

            <select id="select-sort" style="padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: white; min-height: 44px;">
              <option value="jersey_asc" ${this.sortBy==="jersey_asc"?"selected":""}>🔢 ${this.t("jersey_asc","Dorsal (Menor a Mayor)")}</option>
              <option value="jersey_desc" ${this.sortBy==="jersey_desc"?"selected":""}>🔢 ${this.t("jersey_desc","Dorsal (Mayor a Menor)")}</option>
              <option value="name_asc" ${this.sortBy==="name_asc"?"selected":""}>🔤 ${this.t("name_asc","Nombre (A - Z)")}</option>
              <option value="name_desc" ${this.sortBy==="name_desc"?"selected":""}>🔤 ${this.t("name_desc","Nombre (Z - A)")}</option>
            </select>
          </div>
        </div>
        <div id="players-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px;">
          ${this._renderCards()}
        </div>
      </div>
    `,(w=s.querySelector("#search-player"))==null||w.addEventListener("input",r=>{this.filterText=r.target.value,s.querySelector("#players-grid").innerHTML=this._renderCards()}),(b=s.querySelector("#select-pos"))==null||b.addEventListener("change",r=>{this.filterPosition=r.target.value,s.querySelector("#players-grid").innerHTML=this._renderCards()}),(u=s.querySelector("#select-sort"))==null||u.addEventListener("change",r=>{this.sortBy=r.target.value,s.querySelector("#players-grid").innerHTML=this._renderCards()})}}export{K as PlayerStatsView};
