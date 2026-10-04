/**
 * @fileoverview V58 offline-first live scorer adapter.
 * @description Extends the stable V44 scorer with durable recovery, ordered
 * idempotent sync, optimistic revision checks and automatic reconnect flush.
 */

import { LiveScoreHUDViewV44 } from "./LiveScoreHUDViewV44.js";

function finite(value) {
  const n=Number(value);
  return Number.isFinite(n) ? n : null;
}
function esc(value=""){
  return String(value??"")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

export class LiveScoreHUDViewV58 extends LiveScoreHUDViewV44 {
  constructor(authController=null, gameId=null) {
    super(authController, gameId);
    this.liveCaptureRevision=null;
    this.livePendingCount=0;
    this.liveConflict=false;
    this.liveRecoveryMessage="";
    this.liveStagePromise=Promise.resolve();
    this.liveOnlineBound=false;
    this.pendingReassignEventId=null;
  }

  _bindOnlineRecovery() {
    if (this.liveOnlineBound || typeof window === "undefined") return;
    this.liveOnlineBound=true;
    window.addEventListener("online", () => {
      if (!this.isExistingGame || !this.gameId || this.liveConflict) return;
      this._flushLiveSync().then(result => {
        if (result?.synced) this._renderHUD();
      }).catch(() => {});
    });
  }

  _restoreOfflinePayload(payload={}) {
    if (!payload || !Array.isArray(payload.events)) return false;
    this.teamScore=Number(payload.teamScore || 0);
    this.opponentScore=Number(payload.opponentScore || 0);
    this.playByPlayEvents=payload.events.map((event,index)=>{
      const periodName=this._periodNameFromNumber(event.period, Number(event.period) > Number(this.gameSnapshot?.game?.periods_count || 4));
      const timeRemaining=this._clockToSeconds(event.game_clock,this._getPeriodDuration(periodName));
      const isOpponent=Boolean(event.is_opponent ?? event.isOpponent ?? String(event.action_type||"").startsWith("opp_"));
      const player=this.roster.find(row=>String(row.id)===String(event.player_id||event.playerId||""));
      return {
        id:String(event.id || `offline-${index}`),
        isOpponent,
        period:periodName,
        timeRemaining,
        game_clock:event.game_clock || this._secondsToClock(timeRemaining),
        minute:Number(event.minute || 0),
        action:event.action_type || event.action || event.event_type,
        action_type:event.action_type || event.action || event.event_type,
        event_type:event.event_type || event.action_type || event.action,
        actionLabel:this._getActionLabelSpanish(event.action_type || event.action || event.event_type),
        points:Number(event.points || 0),
        playerId:event.player_id ? String(event.player_id) : null,
        player_id:event.player_id ? String(event.player_id) : null,
        playerName:isOpponent ? "Rival" : (event.playerName || player?.name || "Jugador"),
        coord_x:event.coord_x ?? null,
        coord_y:event.coord_y ?? null,
        made:Boolean(event.made),
        onCourt:[]
      };
    });
    const last=this.playByPlayEvents.at(-1);
    if(last){
      this.currentPeriod=last.period;
      this.timeRemaining=last.timeRemaining;
    }
    this.undoneEventsStack=[];
    return true;
  }

  async _loadExistingGameSnapshot() {
    await super._loadExistingGameSnapshot();
    this._bindOnlineRecovery();

    const serverRevision=finite(this.gameSnapshot?.game?.capture_revision)
      ?? await this._liveSync().getRevision(this.gameId).catch(()=>null);
    this.liveCaptureRevision=serverRevision;

    const recovery=await this._liveSync().recover(this.gameId).catch(()=>null);
    if(!recovery?.pending?.length) return;

    this.livePendingCount=recovery.pending.length;
    const firstBase=finite(recovery.pending[0]?.baseRevision);
    const remote=finite(recovery.remoteRevision);

    if(firstBase!==null && remote!==null && remote!==firstBase){
      this.liveConflict=true;
      this.liveSyncState="conflict";
      this.liveSyncError="El servidor avanzó mientras este dispositivo tenía datos pendientes.";
      this.liveRecoveryMessage=`Hay ${this.livePendingCount} cambios locales protegidos, pero el partido remoto está en otra revisión. No se sobrescribirá automáticamente.`;
      return;
    }

    const payload=recovery.draft?.payload || recovery.pending.at(-1)?.payload;
    if(this._restoreOfflinePayload(payload)){
      this.liveSyncState="queued";
      this.liveRecoveryMessage=`Recuperadas ${this.livePendingCount} operaciones pendientes de este dispositivo.`;
    }
  }

  _scheduleLiveSync() {
    if(!this.isExistingGame || !this.gameId || this.liveConflict) return;
    const payload=this._buildLivePayload();
    this.liveSyncState="pending";
    this.liveSyncError="";
    this._updateSyncStatusDom();

    this.liveStagePromise=this.liveStagePromise
      .catch(()=>{})
      .then(()=>this._liveSync().stage(this.gameId,payload,{baseRevision:this.liveCaptureRevision}))
      .then(async ()=>{
        this.livePendingCount=await this._liveSync().offlineStore.pendingCount(this.gameId);
        this._updateSyncStatusDom();
      });

    if(this.liveSyncTimer) globalThis.clearTimeout?.(this.liveSyncTimer);
    this.liveSyncTimer=globalThis.setTimeout?.(()=>{
      this.liveStagePromise.then(()=>this._flushLiveSync()).catch(()=>{});
    },300) || null;
  }

  async _flushLiveSync() {
    if(!this.isExistingGame || !this.gameId) return {synced:false,queued:false};
    await this.liveStagePromise.catch(()=>{});
    if(this.liveConflict){
      return {synced:false,queued:true,pending:this.livePendingCount,conflict:true,error:new Error(this.liveSyncError)};
    }

    this.liveSyncState="syncing";
    this._updateSyncStatusDom();
    const result=await this._liveSync().flush(this.gameId);
    this.livePendingCount=Number(result?.pending || 0);

    if(result?.synced){
      this.liveSyncState="synced";
      this.liveSyncError="";
      this.liveConflict=false;
      this.lastLiveSyncAt=new Date();
      const rev=finite(result.revision ?? result.result?.capture_revision);
      if(rev!==null)this.liveCaptureRevision=rev;
    } else {
      this.liveSyncState=result?.conflict ? "conflict" : (result?.queued ? "queued" : "error");
      this.liveConflict=Boolean(result?.conflict);
      this.liveSyncError=String(result?.error?.message || result?.error || "");
    }
    this._updateSyncStatusDom();
    return result;
  }

  _syncStatusText() {
    if(this.liveSyncState==="conflict") return `Conflicto · ${this.livePendingCount} pendientes protegidos`;
    if(this.liveSyncState==="queued") return `Sin cobertura · ${this.livePendingCount || "cambios"} pendientes`;
    if(this.liveSyncState==="pending") return `Guardando · ${Math.max(1,this.livePendingCount)} pendiente`;
    return super._syncStatusText();
  }

  async _beforeFinishLiveCapture() {
    const result=await this._flushLiveSync().catch(error=>({synced:false,queued:true,error}));
    if(result?.synced && !result?.pending) return true;
    const message=result?.conflict
      ? "Existe un conflicto de sincronización. Los datos locales están protegidos y no se cerrará el partido hasta resolverlo."
      : "Quedan datos pendientes de sincronizar. Mantén el partido abierto y recuperará el envío cuando vuelva la conexión.";
    globalThis.alert?.(message);
    return false;
  }


  _getModalContent() {
    if (this.activeModal === "play_by_play") {
      const rows=[...this.playByPlayEvents].reverse();
      return `
        <div class="hud-modal-overlay v42-pbp-overlay">
          <div class="hud-modal-content v42-pbp-modal">
            <div class="v42-modal-heading">
              <div><strong>📋 Jugadas</strong><span>${rows.length} registradas · jugador visible y corregible</span></div>
              <button type="button" class="btn-close-modal" aria-label="Cerrar">✕</button>
            </div>
            <div class="v42-pbp-list">
              ${rows.length ? rows.map(event=>{
                const own=!event.isOpponent;
                const player=this.roster.find(p=>String(p.id)===String(event.player_id||event.playerId||""));
                const name=event.isOpponent ? "Rival" : (player?.name || event.playerName || "Sin jugador");
                const jersey=event.isOpponent ? "" : (player?.jersey ? `#${player.jersey} · ` : "");
                return `
                  <article class="v42-pbp-row ${event.isOpponent ? "is-opponent" : ""}">
                    <div class="v42-pbp-meta">
                      <strong>${esc(event.period||"")}</strong>
                      <span>${esc(event.game_clock || this._secondsToClock(event.timeRemaining??0))}</span>
                    </div>
                    <div class="v42-pbp-main">
                      <strong>${esc(event.actionLabel || this._getActionLabelSpanish(event.action))}</strong>
                      <span>${esc(jersey+name)}</span>
                    </div>
                    <div class="v58-pbp-actions">
                      ${own ? `<button type="button" class="v58-pbp-reassign" data-id="${esc(event.id)}">Cambiar jugador</button>` : ""}
                      <button type="button" class="btn-del-pbp-event v42-pbp-delete" data-id="${esc(event.id)}">Anular</button>
                    </div>
                  </article>`;
              }).join("") : '<div class="v42-pbp-empty">No hay jugadas registradas.</div>'}
            </div>
          </div>
        </div>`;
    }

    if(this.activeModal==="event_player_reassign"){
      const target=this.playByPlayEvents.find(e=>String(e.id)===String(this.pendingReassignEventId));
      const players=this.roster.filter(p=>!target?.onCourt?.length || target.onCourt.includes(p.id) || this.onCourtPlayerIds.includes(p.id));
      return `
        <div class="hud-modal-overlay">
          <div class="hud-modal-content v58-reassign-modal">
            <div class="v42-modal-heading">
              <div><strong>👤 Cambiar jugador</strong><span>${esc(target?.actionLabel || this._getActionLabelSpanish(target?.action || ""))}</span></div>
              <button type="button" class="btn-close-modal" aria-label="Cerrar">✕</button>
            </div>
            <p class="v58-reassign-help">Selecciona el jugador correcto. Se actualizará la jugada y el BoxScore proyectado.</p>
            <div class="v58-reassign-grid">
              ${players.map(p=>`
                <button type="button" class="v58-reassign-player" data-player-id="${esc(p.id)}">
                  <strong>#${esc(p.jersey ?? "–")}</strong><span>${esc(p.name)}</span>
                </button>`).join("")}
            </div>
          </div>
        </div>`;
    }
    return super._getModalContent();
  }

  _bindModalDynamicEvents() {
    super._bindModalDynamicEvents();
    const portal=document.getElementById("hud-dynamic-modal-portal");
    if(!portal)return;

    if(this.activeModal==="play_by_play"){
      portal.querySelectorAll(".v58-pbp-reassign").forEach(button=>{
        button.onclick=event=>{
          event.preventDefault();
          this.pendingReassignEventId=String(button.dataset.id||"");
          this.activeModal="event_player_reassign";
          this._renderHUD();
        };
      });
    }

    if(this.activeModal==="event_player_reassign"){
      portal.querySelectorAll(".v58-reassign-player").forEach(button=>{
        button.onclick=event=>{
          event.preventDefault();
          const item=this.playByPlayEvents.find(row=>String(row.id)===String(this.pendingReassignEventId));
          const player=this.roster.find(row=>String(row.id)===String(button.dataset.playerId||""));
          if(!item||!player)return;
          item.playerId=String(player.id);
          item.player_id=String(player.id);
          item.playerName=player.name;
          this.pendingReassignEventId=null;
          this.undoneEventsStack=[];
          this._recalculateScoreFromEvents();
          this._scheduleLiveSync();
          this.activeModal="play_by_play";
          this._haptic();
          this._renderHUD();
        };
      });
    }
  }

  _renderHUD() {
    super._renderHUD();
    const root=this.container?.querySelector?.(".v38-live-root");
    if(!root)return;
    root.classList.add("v58-offline-live-root");
    if(this.liveRecoveryMessage){
      const tone=this.liveConflict ? "conflict" : "recovered";
      root.insertAdjacentHTML("afterbegin",
        `<div class="v58-recovery ${tone}" role="status">${this.liveRecoveryMessage}</div>`);
    }
  }
}

if(typeof document!=="undefined" && !document.getElementById("iqbasket-v58-offline-styles")){
  const style=document.createElement("style");
  style.id="iqbasket-v58-offline-styles";
  style.textContent=`
    .v58-recovery{margin:8px 10px;padding:10px 12px;border-radius:11px;font-size:11px;font-weight:800;line-height:1.45}
    .v58-recovery.recovered{background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a}
    .v58-recovery.conflict{background:#fff7ed;border:1px solid #fdba74;color:#9a3412}
    .v38-sync[data-state="conflict"]{color:#991b1b;background:#fef2f2;border-color:#fecaca}
    .v58-pbp-actions{display:flex;gap:5px;align-items:center}.v58-pbp-reassign{min-height:40px;border:1px solid #93c5fd;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-weight:850;padding:6px 9px}
    .v58-reassign-modal{width:min(560px,calc(100vw - 16px))!important}.v58-reassign-help{margin:0 0 10px;color:#64748b;font-size:11px;line-height:1.45}.v58-reassign-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.v58-reassign-player{min-height:62px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff;color:#1e3a8a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}.v58-reassign-player strong{font-size:16px}.v58-reassign-player span{font-size:10px;font-weight:800;text-align:center}
    @media(max-width:520px){.v58-pbp-actions{flex-direction:column}.v58-pbp-actions button{width:100%;min-height:34px!important;padding:4px 6px!important}.v58-reassign-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
}

export default LiveScoreHUDViewV58;
