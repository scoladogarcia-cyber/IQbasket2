/**
 * @fileoverview V59 ordered canonical PBP and full post-game event editor.
 * @description Extends V58 offline/audit guarantees. Shows every canonical
 * event in basketball order and edits player + action in one audited write.
 */

import { ScopedGameBoxScoreLiveV58View } from "./ScopedGameBoxScoreLiveV58View.js";
import {
  OWN_GAME_EVENT_ACTIONS,
  OPPONENT_GAME_EVENT_ACTIONS,
  canonicalGameEventAction,
  compareGameEventsChronological,
  compareGameEventsLatestFirst,
  gameEventLabel,
  isOpponentEvent
} from "../../domain/games/GameEventCatalog.js";

function esc(value=""){
  return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function periodLabel(event={},regulation=4){
  const n=Number(event.period||1);
  return n>regulation ? ("PR"+(n-regulation)) : ("Q"+n);
}
function playerName(player={}){
  return [player.first_name,player.last_name].filter(Boolean).join(" ")||player.name||"Jugador";
}
function optionHtml(value,label,selected=false){
  return '<option value="'+esc(value)+'"'+(selected?' selected':'')+'>'+esc(label)+'</option>';
}

export class ScopedGameBoxScoreLiveV59View extends ScopedGameBoxScoreLiveV58View {
  constructor(supabaseClient,authController){
    super(supabaseClient,authController);
    this.eventEditorContext=null;
  }

  async _loadLiveData(gameId){
    const snapshot=await this.captureService.getSnapshot(gameId);
    if(!snapshot?.game?.id) throw new Error("No se pudo recuperar el registro canónico de jugadas.");
    this.liveSnapshotPlayers=Array.isArray(snapshot.players)?snapshot.players:[];
    const events=[...(snapshot.events||[])].sort(compareGameEventsLatestFirst);
    return {game:snapshot.game,events,players:this.liveSnapshotPlayers};
  }

  _statsFromEvents(events=[]){
    const normalized=(events||[]).map(event=>({...event,action_type:canonicalGameEventAction(event)}));
    return super._statsFromEvents(normalized);
  }

  _feedMarkup(events=[],limit=12){
    const rows=[...(events||[])].sort(compareGameEventsLatestFirst)
      .map(event=>({...event,action_type:canonicalGameEventAction(event)}));
    const effectiveLimit=Number(limit)>=60?rows.length:limit;
    return super._feedMarkup(rows,effectiveLimit);
  }

  async _mountEventAudit(containerId,gameId){
    const container=document.getElementById(containerId);
    if(!container)return;
    container.querySelector("[data-v58-event-audit]")?.remove();
    container.querySelector("[data-v59-event-audit]")?.remove();

    const snapshot=await this.captureService.getSnapshot(gameId);
    if(!snapshot?.game?.id)return;
    this.eventAuditSnapshot=snapshot;
    this.liveSnapshotPlayers=Array.isArray(snapshot.players)?snapshot.players:[];
    const game=snapshot.game;
    const canEdit=this._canEdit(game);
    const regulation=Number(game.periods_count||4);
    const playerMap=new Map(this.liveSnapshotPlayers.map(p=>[String(p.id),p]));
    const events=[...(snapshot.events||[])].sort(compareGameEventsChronological);
    const grouped=new Map();
    events.forEach(event=>{
      const period=Number(event.period||1);
      if(!grouped.has(period))grouped.set(period,[]);
      grouped.get(period).push(event);
    });

    const groupHtml=[...grouped.entries()].map(([period,rows])=>{
      const label=period>regulation?("PR"+(period-regulation)):("Q"+period);
      const rowsHtml=rows.map(event=>{
        const opponent=isOpponentEvent(event);
        const player=playerMap.get(String(event.player_id||""));
        const displayName=opponent?"Rival":(player?((player.jersey!=null?"#"+player.jersey+" · ":"")+playerName(player)):"Sin jugador");
        return '<article class="v59-event-row '+(opponent?'is-opponent':'')+'" data-event-id="'+esc(event.id)+'">'+
          '<span class="v59-event-seq">'+esc(event.event_sequence??"")+'</span>'+
          '<span class="v59-event-time">'+esc(periodLabel(event,regulation))+' · '+esc(event.game_clock||"--:--")+'</span>'+
          '<strong>'+esc(gameEventLabel(event))+'</strong>'+
          '<em>'+esc(displayName)+'</em>'+
          (canEdit?'<button type="button" data-v59-edit-event="'+esc(event.id)+'">Editar</button>':'')+
        '</article>';
      }).join("");
      return '<section class="v59-period-group">'+
        '<header><strong>'+esc(label)+'</strong><span>'+rows.length+' jugadas</span></header>'+
        '<div class="v59-event-list">'+rowsHtml+'</div>'+
      '</section>';
    }).join("");

    const panel=document.createElement("section");
    panel.dataset.v59EventAudit=gameId;
    panel.className="v59-event-audit";
    panel.innerHTML=
      '<div class="v59-event-audit-head">'+
        '<div><strong>📋 Jugadas del partido</strong><span>'+events.length+' acciones · orden deportivo completo</span></div>'+
        '<span class="v59-event-audit-state">'+(canEdit?'Editable':'Solo lectura')+'</span>'+
      '</div>'+
      '<p class="v59-event-audit-help">Se muestran todas las jugadas por periodo, de inicio a final del cuarto. '+
      (canEdit?'Usa «Editar» para corregir jugador y/o tipo de jugada.':'El partido o tus permisos están en modo solo lectura.')+
      '</p>'+
      '<div class="v59-event-groups">'+(groupHtml||'<div class="v59-event-empty">No hay jugadas registradas.</div>')+'</div>';

    const anchor=container.querySelector("[data-v38-live-game-center]");
    if(anchor)anchor.insertAdjacentElement("afterend",panel); else container.prepend(panel);

    panel.querySelectorAll("[data-v59-edit-event]").forEach(button=>{
      button.addEventListener("click",()=>this._openFullEventEditor({
        containerId,gameId,eventId:String(button.dataset.v59EditEvent||"")
      }));
    });
  }

  _openFullEventEditor({containerId,gameId,eventId}){
    const snapshot=this.eventAuditSnapshot;
    const event=(snapshot?.events||[]).find(row=>String(row.id)===String(eventId));
    if(!event)return;

    document.getElementById("v59-event-editor")?.remove();
    const opponent=isOpponentEvent(event);
    const currentAction=canonicalGameEventAction(event);
    const actions=opponent?OPPONENT_GAME_EVENT_ACTIONS:OWN_GAME_EVENT_ACTIONS;
    const currentPlayer=String(event.player_id||"");
    const currentPlayerObject=(snapshot.players||[]).find(p=>String(p.id)===currentPlayer);

    const playerOptions=opponent?'':(
      '<option value="">Selecciona jugador</option>'+
      (snapshot.players||[]).map(player=>optionHtml(
        player.id,
        '#'+String(player.jersey??'–')+' · '+playerName(player),
        String(player.id)===currentPlayer
      )).join("")
    );
    const actionOptions=actions.map(action=>optionHtml(action.code,action.label,action.code===currentAction)).join("");

    const modal=document.createElement("div");
    modal.id="v59-event-editor";
    modal.className="v59-event-editor-overlay";
    modal.innerHTML=
      '<form class="v59-event-editor" data-v59-editor-form>'+
        '<div class="v59-event-editor-head">'+
          '<div><strong>Editar jugada</strong><span>'+esc(periodLabel(event,Number(snapshot?.game?.periods_count||4)))+' · '+esc(event.game_clock||"--:--")+' · secuencia '+esc(event.event_sequence??"—")+'</span></div>'+
          '<button type="button" data-v59-close-editor aria-label="Cerrar">✕</button>'+
        '</div>'+
        (opponent?'':(
          '<label class="v59-editor-field"><span>Jugador</span><select data-v59-player required>'+playerOptions+'</select></label>'
        ))+
        '<label class="v59-editor-field"><span>Tipo de jugada</span><select data-v59-action required>'+actionOptions+'</select></label>'+
        '<div class="v59-editor-current"><span>Actual</span><strong>'+esc(gameEventLabel(event))+'</strong><em>'+esc(opponent?'Rival':(currentPlayerObject?playerName(currentPlayerObject):'Sin jugador'))+'</em></div>'+
        '<div class="v59-editor-actions"><button type="button" data-v59-cancel>Cancelar</button><button type="submit" class="is-primary" data-v59-save>Guardar cambios</button></div>'+
        '<div class="v59-event-editor-status" role="status"></div>'+
      '</form>';

    document.body.appendChild(modal);
    const close=()=>modal.remove();
    modal.querySelector("[data-v59-close-editor]")?.addEventListener("click",close);
    modal.querySelector("[data-v59-cancel]")?.addEventListener("click",close);
    modal.addEventListener("click",evt=>{if(evt.target===modal)close();});

    modal.querySelector("[data-v59-editor-form]")?.addEventListener("submit",async evt=>{
      evt.preventDefault();
      const action=String(modal.querySelector("[data-v59-action]")?.value||"");
      const playerId=opponent?null:String(modal.querySelector("[data-v59-player]")?.value||"");
      const status=modal.querySelector(".v59-event-editor-status");
      if(!opponent&&!playerId){
        if(status)status.textContent="Selecciona un jugador.";
        return;
      }
      modal.querySelectorAll("button,select").forEach(node=>node.disabled=true);
      if(status)status.textContent="Actualizando jugada, BoxScore y marcador…";
      try{
        const updated=await this.captureService.editEvent({
          gameId,eventId,newPlayerId:playerId||null,newActionType:action,
          reason:"Corrección manual desde editor PBP V59"
        });
        if(updated?.game?.id)this.eventAuditSnapshot=updated;
        close();
        await this.render(containerId,gameId);
      }catch(error){
        modal.querySelectorAll("button,select").forEach(node=>node.disabled=false);
        if(status)status.textContent=String(error?.message||error);
      }
    });
  }
}

if(typeof document!=="undefined"&&!document.getElementById("iqbasket-v59-event-audit-styles")){
  const style=document.createElement("style");
  style.id="iqbasket-v59-event-audit-styles";
  style.textContent=
    '.v59-event-audit{background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:12px;margin:0 0 14px;color:#0f172a}'+
    '.v59-event-audit-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v59-event-audit-head>div{display:grid;gap:2px}.v59-event-audit-head strong{font-size:13px}.v59-event-audit-head span,.v59-event-audit-help{font-size:10px;color:#64748b}'+
    '.v59-event-audit-state{font-size:9px!important;font-weight:900;color:#1d4ed8!important;background:#eff6ff;padding:5px 8px;border-radius:999px}.v59-event-audit-help{line-height:1.45;margin:8px 0 10px}'+
    '.v59-event-groups{display:grid;gap:10px}.v59-period-group{border:1px solid #e2e8f0;border-radius:11px;overflow:hidden}.v59-period-group>header{display:flex;justify-content:space-between;align-items:center;padding:7px 9px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.v59-period-group>header strong{font-size:11px}.v59-period-group>header span{font-size:9px;color:#64748b;font-weight:800}'+
    '.v59-event-list{display:grid}.v59-event-row{display:grid;grid-template-columns:34px 86px minmax(130px,1fr) minmax(130px,1fr) auto;gap:8px;align-items:center;padding:8px 9px;border-bottom:1px solid #e2e8f0;font-size:10px}.v59-event-row:last-child{border-bottom:0}.v59-event-row.is-opponent{background:#fff7ed}.v59-event-seq{color:#94a3b8;font-size:8px;font-weight:800}.v59-event-time{color:#64748b;font-weight:800}.v59-event-row>em{font-style:normal;font-weight:900;color:#1d4ed8}.v59-event-row.is-opponent>em{color:#c2410c}.v59-event-row>button{min-height:36px;border:1px solid #93c5fd;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-weight:850;padding:5px 9px}'+
    '.v59-event-editor-overlay{position:fixed;inset:0;z-index:1000000;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:12px}.v59-event-editor{width:min(560px,100%);max-height:88dvh;overflow:auto;background:#fff;border-radius:16px;padding:14px;color:#0f172a;display:grid;gap:12px}.v59-event-editor-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v59-event-editor-head>div{display:grid;gap:2px}.v59-event-editor-head span{font-size:10px;color:#64748b}.v59-event-editor-head>button{border:0;background:transparent;font-size:22px}'+
    '.v59-editor-field{display:grid;gap:5px}.v59-editor-field>span{font-size:10px;font-weight:900;color:#334155}.v59-editor-field select{width:100%;min-height:44px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#0f172a;padding:8px 10px;font-size:12px}.v59-editor-current{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:9px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:10px}.v59-editor-current>span{color:#64748b;font-weight:800}.v59-editor-current>em{font-style:normal;color:#1d4ed8;font-weight:800}'+
    '.v59-editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v59-editor-actions button{min-height:44px;border-radius:9px;border:1px solid #cbd5e1;background:#fff;color:#334155;font-weight:900}.v59-editor-actions .is-primary{background:#2563eb;border-color:#2563eb;color:#fff}.v59-event-editor-status{font-size:10px;font-weight:800;color:#b45309;min-height:14px}'+
    '@media(max-width:600px){.v59-event-row{grid-template-columns:26px 70px 1fr auto}.v59-event-row>em{grid-column:3/4}.v59-event-row>button{grid-column:4;grid-row:1/3}.v59-editor-current{grid-template-columns:1fr}.v59-editor-actions{grid-template-columns:1fr}}';
  document.head.appendChild(style);
}

export default ScopedGameBoxScoreLiveV59View;
