import{D as o,P as A}from"./index-Co3VTdK8.js";import{W as $,a as P}from"./WellnessSupportPanel-C6BjKQNQ.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";function l(i=""){return String(i??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function T(i={}){return i.name||[i.first_name,i.last_name].filter(Boolean).join(" ")||[i.firstName,i.lastName].filter(Boolean).join(" ")||"Jugador"}function S(i=""){return String(i||"").slice(0,10)}class z{constructor(e=null,t=null){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e,this.auth=t,this.service=new $(this.supabase),this.containerId="dashboard-content-area",this.teamId=null,this.teamSeasonId=null,this.playerId=null,this.players=[],this.panel=new P({service:this.service,can:r=>this._can(r),modules:["nutrition"]}),this.panel.activeModule="nutrition"}_context(){return{teamId:this.teamId,teamSeasonId:this.teamSeasonId,playerId:this.playerId,playerTeamId:this.teamId}}_can(e){var t,r;return e?typeof((t=this.auth)==null?void 0:t.canPreview)=="function"?!!this.auth.canPreview(e,this._context()):typeof((r=this.auth)==null?void 0:r.can)=="function"?!!this.auth.can(e,this._context()):!1:!1}_seasonContext(){var e,t;return((t=(e=o).getActiveSeasonContext)==null?void 0:t.call(e,this.teamId))||null}_dateBounds(){const e=this._seasonContext();return{min:S((e==null?void 0:e.start_date)||(e==null?void 0:e.startDate)),max:S((e==null?void 0:e.end_date)||(e==null?void 0:e.endDate))}}_resolvePlayers(){var e,t,r,s,n,d;return((t=(e=o).getSeasonParticipantPlayers)==null?void 0:t.call(e,this.teamId))||((s=(r=o).getPlayersForActiveSeason)==null?void 0:s.call(r,this.teamId))||((d=(n=o).getTeamPlayers)==null?void 0:d.call(n,this.teamId))||[]}_selectedPlayer(){return this.players.find(e=>String(e.id)===String(this.playerId))||this.players[0]||null}_renderStyles(){return`
      <style>
        .nutrition-view {
          width:100%;
          max-width:1180px;
          margin:0 auto;
          padding:18px;
          display:grid;
          gap:16px;
          color:#0f172a;
          font-family:var(--font-family-base,system-ui,-apple-system,sans-serif);
          box-sizing:border-box;
        }
        .nutrition-view *{box-sizing:border-box}
        .nutrition-hero{
          padding:20px;
          border-radius:16px;
          background:linear-gradient(135deg,#14532d,#0f766e);
          color:#fff;
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:16px;
        }
        .nutrition-hero h1{margin:0 0 6px;font-size:clamp(22px,4vw,30px);color:#fff!important}
        .nutrition-hero p{margin:0;color:#d1fae5;line-height:1.5;max-width:760px}
        .nutrition-context{
          border:1px solid rgba(255,255,255,.28);
          border-radius:999px;
          padding:7px 11px;
          font-size:11px;
          font-weight:900;
          white-space:nowrap;
          color:#fff!important;
        }
        .nutrition-selector{
          background:#fff;
          border:1px solid #dbe3ee;
          border-radius:14px;
          padding:14px;
          display:grid;
          grid-template-columns:minmax(0,1fr) auto;
          gap:12px;
          align-items:end;
        }
        .nutrition-selector label{display:grid;gap:6px;font-size:12px;font-weight:800;color:#334155}
        .nutrition-selector select{
          width:100%;
          min-height:44px;
          border:1px solid #cbd5e1;
          border-radius:9px;
          padding:9px 10px;
          background:#fff;
          color:#0f172a;
          font:inherit;
        }
        .nutrition-player360{
          min-height:44px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          padding:9px 13px;
          border-radius:9px;
          background:#f8fafc;
          border:1px solid #cbd5e1;
          color:#334155;
          text-decoration:none;
          font-size:12px;
          font-weight:800;
        }
        .nutrition-empty,.nutrition-error{
          border-radius:12px;
          padding:16px;
          background:#fff;
          line-height:1.5;
          font-size:13px;
        }
        .nutrition-empty{border:1px dashed #cbd5e1;color:#64748b}
        .nutrition-error{border:1px solid #fecaca;color:#991b1b;background:#fef2f2}
        @media(max-width:640px){
          .nutrition-view{padding:12px;padding-bottom:calc(104px + env(safe-area-inset-bottom,0px))}
          .nutrition-hero{display:grid;border-radius:12px}
          .nutrition-context{justify-self:start;white-space:normal}
          .nutrition-selector{grid-template-columns:1fr}
          .nutrition-player360{width:100%}
        }
      </style>
    `}async render(e="dashboard-content-area",t=null,r=null){var p,u,h,m,f,g,x,y,I,v,b;this.containerId=e,this.teamId=r||((u=(p=o).getActiveTeamId)==null?void 0:u.call(p))||null,this.teamSeasonId=((m=(h=o).getActiveTeamSeasonId)==null?void 0:m.call(h,this.teamId))||null,this.players=this._resolvePlayers();const s=this.players.find(a=>String(a.id)===String(t));this.playerId=(s==null?void 0:s.id)||((f=this.players[0])==null?void 0:f.id)||null;const n=document.getElementById(e);if(!n)return;if(!this.teamSeasonId){n.innerHTML=`
        <section class="nutrition-view">
          ${this._renderStyles()}
          <div class="nutrition-error">Selecciona una temporada activa antes de abrir Nutrición.</div>
        </section>
      `;return}if(!this.players.length){n.innerHTML=`
        <section class="nutrition-view">
          ${this._renderStyles()}
          <div class="nutrition-empty">No hay jugadores disponibles en la plantilla de esta temporada.</div>
        </section>
      `;return}const d=this._selectedPlayer();if(this.playerId=(d==null?void 0:d.id)||null,!this._can(A.VIEW_NUTRITION)){n.innerHTML=`
        <section class="nutrition-view">
          ${this._renderStyles()}
          <div class="nutrition-error">Tu perfil no dispone de acceso a datos de nutrición.</div>
        </section>
      `;return}await this.panel.load({teamId:this.teamId,teamSeasonId:this.teamSeasonId,playerId:this.playerId,dateBounds:this._dateBounds()});const w=((x=(g=o).getTeamById)==null?void 0:x.call(g,this.teamId))||{},c=((I=(y=o).getActiveSeasonDisplayName)==null?void 0:I.call(y,this.teamId))||((v=this._seasonContext())==null?void 0:v.name)||"";n.innerHTML=`
      <section class="nutrition-view">
        ${this._renderStyles()}
        <header class="nutrition-hero">
          <div>
            <h1>🥤 Nutrición</h1>
            <p>
              Seguimiento deportivo no clínico por jugador, integrado con Player 360 y protegido
              mediante permisos RBAC + autorización contextual ABAC.
            </p>
          </div>
          <span class="nutrition-context">
            ${l(w.name||"Equipo")}${c?` · ${l(c)}`:""}
          </span>
        </header>

        <div class="nutrition-selector">
          <label>
            <span>Jugador</span>
            <select id="nutrition-player-select">
              ${this.players.map(a=>`
                <option value="${l(a.id)}" ${String(a.id)===String(this.playerId)?"selected":""}>
                  #${l(a.jersey??a.number??"—")} · ${l(T(a))}
                </option>
              `).join("")}
            </select>
          </label>
          <a class="nutrition-player360" href="#/player360/${encodeURIComponent(String(this.playerId))}">
            Abrir Player 360
          </a>
        </div>

        ${this.panel.isAvailable()?this.panel.render():'<div class="nutrition-error">El servicio de Nutrición no está disponible para este contexto.</div>'}
      </section>
    `,(b=n.querySelector("#nutrition-player-select"))==null||b.addEventListener("change",a=>{const _=a.target.value;window.location.hash=`#/nutrition/${encodeURIComponent(String(_))}`}),await this.panel.bind(n,{onChanged:async()=>{await this.render(this.containerId,this.playerId,this.teamId)}})}}export{z as NutritionView};
