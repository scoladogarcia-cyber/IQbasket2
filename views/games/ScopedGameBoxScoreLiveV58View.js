/**
 * @fileoverview V58 canonical PBP + post-game attribution audit for BoxScore.
 * @description Uses game_events through the existing scoped snapshot instead of
 * the legacy play_by_play_events projection. Authorized editors may reassign an
 * own-team event; the server atomically moves its counting stats and audits it.
 */

import { ScopedGameBoxScoreLiveV39View } from "./ScopedGameBoxScoreLiveV39View.js";

function esc(value=""){
  return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function actionOf(event={}){return String(event.action_type||event.action||event.event_type||"");}
function actionLabel(action=""){
  const labels={
    fg2_made:"T2 anotado",fg2_attempted:"T2 fallado",fg3_made:"T3 anotado",
    fg3_attempted:"T3 fallado",ft_made:"TL anotado",ft_attempted:"TL fallado",
    off_reb:"Rebote ofensivo",def_reb:"Rebote defensivo",assists:"Asistencia",
    steals:"Robo",blocks_made:"Tapón",blocks_received:"Tapón recibido",
    turnovers:"Pérdida",fouls_committed:"Falta cometida",fouls_drawn:"Falta recibida",
    opp_pts:"Puntos rival",opp_oreb:"Rebote ofensivo rival",opp_dreb:"Rebote defensivo rival",opp_tov:"Pérdida rival"
  };
  return labels[action]||String(action||"Jugada").replaceAll("_"," ");
}
function isOpponent(event={}){return actionOf(event).startsWith("opp_") || Boolean(event.is_opponent||event.isOpponent);}
function periodLabel(event={},regulation=4){
  const n=Number(event.period||1);
  return n>regulation?`PR${n-regulation}`:`Q${n}`;
}

export class ScopedGameBoxScoreLiveV58View extends ScopedGameBoxScoreLiveV39View {
  constructor(supabaseClient,authController){
    super(supabaseClient,authController);
    this.liveSnapshotPlayers=[];
    this.eventAuditSnapshot=null;
  }

  async _loadLiveData(gameId){
    const snapshot=await this.captureService.getSnapshot(gameId);
    if(!snapshot?.game?.id) throw new Error("No se pudo recuperar el registro canónico de jugadas.");
    this.liveSnapshotPlayers=Array.isArray(snapshot.players)?snapshot.players:[];
    const events=(Array.isArray(snapshot.events)?snapshot.events:[]).map((event,index)=>({event,index}));
    events.sort((a,b)=>{
      const at=Date.parse(a.event.created_at||"");
      const bt=Date.parse(b.event.created_at||"");
      if(Number.isFinite(at)&&Number.isFinite(bt)&&at!==bt)return bt-at;
      return b.index-a.index;
    });
    return {game:snapshot.game,events:events.map(row=>row.event),players:this.liveSnapshotPlayers};
  }

  _playerNameMap(){
    const original=this.players;
    if(this.liveSnapshotPlayers.length)this.players=[...(original||[]),...this.liveSnapshotPlayers];
    const map=super._playerNameMap();
    this.players=original;
    return map;
  }

  _playerLookup(){
    const all=[...(this.players||[]),...(this.liveSnapshotPlayers||[])];
    const map=new Map();
    all.forEach(player=>{
      const id=String(player.id||player.player_id||""); if(!id)return;
      map.set(id,{
        name:player.name||`${player.first_name||player.firstName||""} ${player.last_name||player.lastName||""}`.trim()||"Jugador",
        jersey:player.jersey??player.number??"-"
      });
    });
    return map;
  }

  async render(containerId="dashboard-content-area",targetGameId=null){
    const result=await super.render(containerId,targetGameId);
    if(targetGameId && !this._isStreamRoute()){
      await this._mountEventAudit(containerId,String(targetGameId)).catch(error=>{
        console.warn("[PBP Audit V58]",error);
      });
    }
    return result;
  }

  async _mountEventAudit(containerId,gameId){
    const container=document.getElementById(containerId);
    if(!container)return;
    container.querySelector("[data-v58-event-audit]")?.remove();

    const snapshot=await this.captureService.getSnapshot(gameId);
    if(!snapshot?.game?.id)return;
    this.eventAuditSnapshot=snapshot;
    this.liveSnapshotPlayers=Array.isArray(snapshot.players)?snapshot.players:[];
    const game=snapshot.game;
    const canEdit=this._canEdit(game);
    const regulation=Number(game.periods_count||4);
    const playerMap=new Map(this.liveSnapshotPlayers.map(p=>[String(p.id),p]));
    const events=[...(snapshot.events||[])].reverse();

    const panel=document.createElement("section");
    panel.dataset.v58EventAudit=gameId;
    panel.className="v58-event-audit";
    panel.innerHTML=`
      <div class="v58-event-audit-head">
        <div><strong>📋 Auditoría de jugadas</strong><span>Fuente canónica del registro en vivo · ${events.length} acciones</span></div>
        <span class="v58-event-audit-state">${canEdit?"Editable":"Solo lectura"}</span>
      </div>
      <p class="v58-event-audit-help">
        Aquí puedes comprobar exactamente a qué jugador quedó asignada cada acción.
        ${canEdit?"Si te equivocaste, usa «Cambiar jugador»; el BoxScore se corrige de forma transaccional.":"Para corregir una jugada, el partido debe estar abierto y tu rol debe poder editar el BoxScore."}
      </p>
      <div class="v58-event-audit-list">
        ${events.length?events.map(event=>{
          const opponent=isOpponent(event);
          const player=playerMap.get(String(event.player_id||""));
          const name=opponent?"Rival":(player?`${player.jersey!=null?"#"+player.jersey+" · ":""}${[player.first_name,player.last_name].filter(Boolean).join(" ")||player.name||"Jugador"}`:"Sin jugador");
          return `
            <article class="v58-event-row ${opponent?"is-opponent":""}">
              <span class="v58-event-time">${esc(periodLabel(event,regulation))} · ${esc(event.game_clock||"--:--")}</span>
              <strong>${esc(actionLabel(actionOf(event)))}</strong>
              <em>${esc(name)}</em>
              ${!opponent&&canEdit?`<button type="button" data-v58-reassign-event="${esc(event.id)}">Cambiar jugador</button>`:""}
            </article>`;
        }).join(""):'<div class="v58-event-empty">No hay jugadas registradas.</div>'}
      </div>`;

    const anchor=container.querySelector("[data-v38-live-game-center]");
    if(anchor)anchor.insertAdjacentElement("afterend",panel); else container.prepend(panel);

    panel.querySelectorAll("[data-v58-reassign-event]").forEach(button=>{
      button.addEventListener("click",()=>this._openEventPlayerEditor({
        containerId,gameId,eventId:String(button.dataset.v58ReassignEvent||"")
      }));
    });
  }

  _openEventPlayerEditor({containerId,gameId,eventId}){
    const snapshot=this.eventAuditSnapshot;
    const event=(snapshot?.events||[]).find(row=>String(row.id)===String(eventId));
    if(!event)return;
    document.getElementById("v58-event-player-editor")?.remove();
    const current=String(event.player_id||"");
    const modal=document.createElement("div");
    modal.id="v58-event-player-editor";
    modal.className="v58-event-editor-overlay";
    modal.innerHTML=`
      <div class="v58-event-editor" role="dialog" aria-modal="true" aria-label="Cambiar jugador de la jugada">
        <div class="v58-event-editor-head">
          <div><strong>Cambiar jugador</strong><span>${esc(actionLabel(actionOf(event)))} · ${esc(event.game_clock||"--:--")}</span></div>
          <button type="button" data-v58-close-editor>✕</button>
        </div>
        <div class="v58-event-player-grid">
          ${(snapshot.players||[]).map(player=>{
            const id=String(player.id);
            const name=[player.first_name,player.last_name].filter(Boolean).join(" ")||player.name||"Jugador";
            return `<button type="button" class="${id===current?"is-current":""}" data-v58-new-player="${esc(id)}">
              <strong>#${esc(player.jersey??"–")}</strong><span>${esc(name)}</span>
              ${id===current?"<small>Actual</small>":""}
            </button>`;
          }).join("")}
        </div>
        <div class="v58-event-editor-status" role="status"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector("[data-v58-close-editor]")?.addEventListener("click",()=>modal.remove());
    modal.addEventListener("click",event=>{if(event.target===modal)modal.remove();});
    modal.querySelectorAll("[data-v58-new-player]").forEach(button=>{
      button.addEventListener("click",async()=>{
        const newPlayerId=String(button.dataset.v58NewPlayer||"");
        if(!newPlayerId||newPlayerId===current){modal.remove();return;}
        const status=modal.querySelector(".v58-event-editor-status");
        modal.querySelectorAll("button").forEach(node=>node.disabled=true);
        if(status)status.textContent="Corrigiendo jugada y BoxScore…";
        try{
          await this.captureService.reassignEventPlayer({
            gameId,eventId,newPlayerId,reason:"Corrección manual desde Auditoría PBP V58"
          });
          modal.remove();
          await this.render(containerId,gameId);
        }catch(error){
          modal.querySelectorAll("button").forEach(node=>node.disabled=false);
          if(status)status.textContent=String(error?.message||error);
        }
      });
    });
  }
}

if(typeof document!=="undefined"&&!document.getElementById("iqbasket-v58-event-audit-styles")){
  const style=document.createElement("style");
  style.id="iqbasket-v58-event-audit-styles";
  style.textContent=`
    .v58-event-audit{background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:12px;margin:0 0 14px;color:#0f172a}.v58-event-audit-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v58-event-audit-head>div{display:grid;gap:2px}.v58-event-audit-head strong{font-size:13px}.v58-event-audit-head span,.v58-event-audit-help{font-size:10px;color:#64748b}.v58-event-audit-state{font-size:9px!important;font-weight:900;color:#1d4ed8!important;background:#eff6ff;padding:5px 8px;border-radius:999px}.v58-event-audit-help{line-height:1.45;margin:8px 0}
    .v58-event-audit-list{max-height:420px;overflow:auto;border:1px solid #e2e8f0;border-radius:10px}.v58-event-row{display:grid;grid-template-columns:76px minmax(130px,1fr) minmax(130px,1fr) auto;gap:8px;align-items:center;padding:8px 9px;border-bottom:1px solid #e2e8f0;font-size:10px}.v58-event-row:last-child{border-bottom:0}.v58-event-row.is-opponent{background:#fff7ed}.v58-event-time{color:#64748b;font-weight:800}.v58-event-row>em{font-style:normal;font-weight:900;color:#1d4ed8}.v58-event-row.is-opponent>em{color:#c2410c}.v58-event-row>button{min-height:36px;border:1px solid #93c5fd;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-weight:850;padding:5px 8px}.v58-event-empty{padding:18px;text-align:center;color:#64748b;font-size:10px}
    .v58-event-editor-overlay{position:fixed;inset:0;z-index:1000000;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:12px}.v58-event-editor{width:min(620px,100%);max-height:86dvh;overflow:auto;background:#fff;border-radius:16px;padding:14px;color:#0f172a}.v58-event-editor-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:12px}.v58-event-editor-head>div{display:grid;gap:2px}.v58-event-editor-head span{font-size:11px;color:#64748b}.v58-event-editor-head>button{border:0;background:transparent;font-size:22px}.v58-event-player-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.v58-event-player-grid>button{min-height:68px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;display:grid;place-items:center;padding:7px}.v58-event-player-grid>button.is-current{background:#eff6ff;border-color:#60a5fa}.v58-event-player-grid strong{color:#1d4ed8;font-size:16px}.v58-event-player-grid span{font-size:10px;font-weight:800;text-align:center}.v58-event-player-grid small{font-size:8px;color:#2563eb}.v58-event-editor-status{margin-top:9px;font-size:10px;font-weight:800;color:#b45309}
    @media(max-width:600px){.v58-event-row{grid-template-columns:65px 1fr auto}.v58-event-row>em{grid-column:2/3}.v58-event-row>button{grid-column:3;grid-row:1/3}.v58-event-player-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
}

export default ScopedGameBoxScoreLiveV58View;
