/**
 * @fileoverview Touch-first quick game capture for per-game delegates.
 * @description Loads only the V21 game snapshot, uses the V28 single-writer lease
 * and persists every action. It never depends on team-wide DataStore scope.
 */
import { Permission } from "../../security/PermissionService.js";
import { GameCaptureDelegationService } from "../../services/games/GameCaptureDelegationService.js";
import { GamePlayStateService } from "../../services/games/GamePlayStateService.js";

const esc = (value = "") => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const ZERO_STATS = Object.freeze({
  starter:false,minutes:0,points:0,fg2_made:0,fg2_attempted:0,fg3_made:0,fg3_attempted:0,
  ft_made:0,ft_attempted:0,off_reb:0,def_reb:0,assists:0,steals:0,blocks:0,blocks_made:0,
  blocks_received:0,turnovers:0,fouls_committed:0,fouls_drawn:0,plus_minus:0
});

const ACTIONS = Object.freeze([
  ["+2","fg2_made",2],["2✕","fg2_miss",0],["+3","fg3_made",3],["3✕","fg3_miss",0],
  ["+1 TL","ft_made",1],["TL ✕","ft_miss",0],["REB O","off_reb",0],["REB D","def_reb",0],
  ["AST","assists",0],["ROB","steals",0],["TAP","blocks_made",0],["PÉR","turnovers",0],
  ["FALTA","fouls_committed",0],["F. REC","fouls_drawn",0]
]);

export class DelegatedQuickEntryView {
  constructor(supabaseClient = null, authController = null, gameId = null) {
    this.auth = authController;
    this.gameId = gameId;
    this.capture = new GameCaptureDelegationService(supabaseClient || authController?.supabase || null);
    this.playState = new GamePlayStateService(supabaseClient || authController?.supabase || null);
    this.snapshot = null;
    this.stats = new Map();
    this.events = [];
    this.selectedPlayerId = null;
    this.history = [];
    this.leaseToken = null;
    this.saving = false;
  }

  _context() {
    const game = this.snapshot?.game || {};
    return { gameId:this.gameId, teamId:game.team_id || null, teamSeasonId:game.team_season_id || null, seasonId:game.season_id || null };
  }

  _can(permission) { return Boolean(this.auth?.canPreview?.(permission, this._context())); }

  async render(containerId = "dashboard-content-area", gameId = null) {
    const container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
    if (!container) return;
    this.container = container;
    if (gameId) this.gameId = gameId;
    if (!this.gameId || !this._can(Permission.RECORD_QUICK_GAME)) {
      container.innerHTML = this._message("Acceso restringido", "No tienes delegada la marcación rápida de este partido.");
      return;
    }
    try {
      this.snapshot = await this.capture.getSnapshot(this.gameId);
      this.events = [...(this.snapshot?.events || [])];
      this.stats = new Map((this.snapshot?.stats || []).map(row => [String(row.player_id), { ...ZERO_STATS, ...row }]));
      (this.snapshot?.players || []).forEach(player => {
        if (!this.stats.has(String(player.id))) this.stats.set(String(player.id), { ...ZERO_STATS, player_id:String(player.id) });
      });
      this._draw();
    } catch (error) {
      container.innerHTML = this._message("No se pudo abrir el partido", error?.message || error);
    }
  }

  _message(title, text) {
    return `<div style="padding:22px;background:#fff;border:1px solid #fecaca;border-radius:14px;color:#991b1b"><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;
  }

  _draw() {
    const g = this.snapshot.game || {};
    const players = this.snapshot.players || [];
    const period = this._period();
    this.container.innerHTML = `<section class="dq30">
      ${this._styles()}
      <header class="dq30-head"><div><span>MARCACIÓN RÁPIDA</span><h1>${esc(g.opponent ? `vs ${g.opponent}` : "Partido")}</h1><small>${esc(g.date || "")} · ${esc(g.play_state || "")}</small></div>
        <div class="dq30-score"><b id="dq-team">${Number(g.team_score || 0)}</b><i>-</i><b id="dq-opp">${Number(g.opponent_score || 0)}</b></div></header>
      <div class="dq30-context"><label>Periodo <select id="dq-period">${this._periodOptions(period)}</select></label><label>Reloj <input id="dq-clock" value="10:00" inputmode="numeric"></label><span id="dq-save">Listo</span></div>
      <div class="dq30-players">${players.map(p => `<button class="dq30-player" data-id="${esc(p.id)}"><b>#${esc(p.jersey ?? "—")}</b><span>${esc(`${p.first_name || ""} ${p.last_name || ""}`.trim() || "Jugador")}</span></button>`).join("")}</div>
      <div class="dq30-actions">${ACTIONS.map(([label,action,pts]) => `<button class="dq30-action" data-action="${action}" data-points="${pts}">${label}</button>`).join("")}</div>
      <div class="dq30-opp"><strong>Rival</strong><button data-opp="1">+1</button><button data-opp="2">+2</button><button data-opp="3">+3</button></div>
      <footer><button id="dq-undo" class="dq30-undo">↩ Deshacer última acción</button><a href="#/games">Volver a Partidos</a></footer>
    </section>`;
    this._bind();
  }

  _styles() {
    return `<style>
      .dq30{max-width:900px;margin:auto;display:grid;gap:13px;color:#0f172a}.dq30-head{background:#0f172a;color:#fff;border-radius:16px;padding:15px 18px;display:flex;justify-content:space-between;align-items:center}.dq30-head span{font-size:10px;font-weight:900;letter-spacing:.12em;color:#fb923c}.dq30-head h1{margin:3px 0;font-size:22px}.dq30-head small{color:#cbd5e1}.dq30-score{display:flex;gap:12px;align-items:center;font-size:29px}.dq30-score i{font-style:normal;color:#64748b}
      .dq30-context{display:grid;grid-template-columns:1fr 1fr auto;gap:9px;align-items:end;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:11px}.dq30-context label{display:grid;gap:4px;font-size:11px;font-weight:800}.dq30-context select,.dq30-context input{min-height:42px;border:1px solid #cbd5e1;border-radius:8px;padding:7px}.dq30-context span{font-size:11px;color:#64748b;padding:10px}
      .dq30-players{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.dq30-player{min-height:58px;border:2px solid #e2e8f0;background:#fff;border-radius:11px;padding:7px;display:grid;gap:2px;cursor:pointer}.dq30-player b{color:#f97316}.dq30-player span{font-size:11px;font-weight:800}.dq30-player.active{border-color:#2563eb;background:#eff6ff}.dq30-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.dq30-action,.dq30-opp button{min-height:54px;border:0;border-radius:11px;background:#1e293b;color:#fff;font-weight:900;font-size:14px;cursor:pointer}.dq30-action:disabled{opacity:.45}.dq30-opp{display:grid;grid-template-columns:1fr repeat(3,80px);gap:8px;align-items:center;background:#fff7ed;border:1px solid #fed7aa;padding:10px;border-radius:11px}.dq30-opp button{background:#c2410c}.dq30 footer{display:flex;justify-content:space-between;align-items:center;gap:8px}.dq30 footer a{color:#2563eb;font-weight:800}.dq30-undo{min-height:44px;border:1px solid #fecaca;border-radius:9px;background:#fff1f2;color:#be123c;font-weight:900;padding:8px 12px}
      @media(max-width:620px){.dq30-players{grid-template-columns:repeat(3,1fr)}.dq30-actions{grid-template-columns:repeat(3,1fr)}.dq30-context{grid-template-columns:1fr 1fr}.dq30-context span{grid-column:1/-1;padding:0}.dq30-opp{grid-template-columns:1fr repeat(3,1fr)}.dq30-head{border-radius:12px}}
    </style>`;
  }

  _period() {
    const last = this.events[this.events.length - 1];
    return Math.max(1, Number(last?.period || 1));
  }

  _periodOptions(selected) {
    const count = Math.max(4, Number(this.snapshot?.game?.periods_count || 4));
    return Array.from({ length:count + 2 }, (_,i) => i + 1)
      .map(v => `<option value="${v}" ${v===selected ? "selected" : ""}>${v<=count ? `Q${v}` : `OT${v-count}`}</option>`).join("");
  }

  _bind() {
    this.container.querySelectorAll(".dq30-player").forEach(button => button.addEventListener("click", () => {
      this.selectedPlayerId = button.dataset.id;
      this.container.querySelectorAll(".dq30-player").forEach(b => b.classList.toggle("active", b===button));
    }));
    this.container.querySelectorAll(".dq30-action").forEach(button => button.addEventListener("click", () => this._playerAction(button.dataset.action, Number(button.dataset.points || 0))));
    this.container.querySelectorAll("[data-opp]").forEach(button => button.addEventListener("click", () => this._opponentAction(Number(button.dataset.opp || 0))));
    this.container.querySelector("#dq-undo")?.addEventListener("click", () => this._undo());
  }

  async _ensureWritable() {
    let state = String(this.snapshot?.game?.play_state || "SCHEDULED").toUpperCase();
    if (state === "FINISHED" || state === "CANCELLED") throw new Error("El partido ya no admite captura.");
    if (state === "SCHEDULED") {
      if (!this._can(Permission.PREPARE_GAME)) throw new Error("El partido aún no está preparado. Necesitas permiso de Preparar partido.");
      await this.playState.transition({ gameId:this.gameId, targetState:"READY" }); state="READY";
    }
    if (state === "READY") {
      if (!this._can(Permission.START_GAME)) throw new Error("El partido aún no está iniciado. Necesitas permiso de Iniciar partido.");
      await this.playState.transition({ gameId:this.gameId, targetState:"LIVE" }); state="LIVE";
    }
    this.snapshot.game.play_state=state;
    if (!this.leaseToken) {
      const lease = await this.capture.liveSessionService.acquire({ gameId:this.gameId });
      this.leaseToken = lease?.lease_token || this.capture.liveSessionService.getStoredToken(this.gameId) || null;
    }
  }

  _pushHistory() {
    this.history.push({ team:Number(this.snapshot.game.team_score||0), opp:Number(this.snapshot.game.opponent_score||0), events:this.events.length, stats:new Map([...this.stats].map(([k,v]) => [k,{...v}])) });
    if (this.history.length>30) this.history.shift();
  }

  async _playerAction(action, points) {
    if (!this.selectedPlayerId) { alert("Selecciona primero un jugador."); return; }
    try {
      await this._ensureWritable(); this._pushHistory();
      const row = { ...ZERO_STATS, ...(this.stats.get(this.selectedPlayerId) || {}), player_id:this.selectedPlayerId };
      if (action==="fg2_made") { row.fg2_made++; row.fg2_attempted++; row.points+=2; }
      else if (action==="fg2_miss") row.fg2_attempted++;
      else if (action==="fg3_made") { row.fg3_made++; row.fg3_attempted++; row.points+=3; }
      else if (action==="fg3_miss") row.fg3_attempted++;
      else if (action==="ft_made") { row.ft_made++; row.ft_attempted++; row.points++; }
      else if (action==="ft_miss") row.ft_attempted++;
      else { row[action]=Number(row[action]||0)+1; if (action==="blocks_made") row.blocks=Number(row.blocks||0)+1; }
      this.stats.set(this.selectedPlayerId,row);
      this.snapshot.game.team_score=Number(this.snapshot.game.team_score||0)+points;
      this.events.push(this._event(action,points,this.selectedPlayerId,points>0));
      await this._persist(); this._updateScore();
    } catch (error) { alert(error?.message || error); }
  }

  async _opponentAction(points) {
    try {
      await this._ensureWritable(); this._pushHistory();
      this.snapshot.game.opponent_score=Number(this.snapshot.game.opponent_score||0)+points;
      this.events.push(this._event("opp_pts",points,null,true));
      await this._persist(); this._updateScore();
    } catch (error) { alert(error?.message || error); }
  }

  _event(action, points, playerId, made=false) {
    return { player_id:playerId, period:Number(this.container.querySelector("#dq-period")?.value||1), game_clock:this.container.querySelector("#dq-clock")?.value||"10:00", action_type:action, points, made };
  }

  async _persist() {
    const status=this.container.querySelector("#dq-save"); if(status) status.textContent="Guardando…";
    await this.capture.saveCapture({ gameId:this.gameId, teamScore:Number(this.snapshot.game.team_score||0), opponentScore:Number(this.snapshot.game.opponent_score||0), stats:[...this.stats.values()], events:this.events, leaseToken:this.leaseToken });
    if(status) status.textContent="Guardado ✓";
  }

  async _undo() {
    const prev=this.history.pop(); if(!prev) return;
    this.snapshot.game.team_score=prev.team; this.snapshot.game.opponent_score=prev.opp; this.events=this.events.slice(0,prev.events); this.stats=prev.stats;
    try { await this._ensureWritable(); await this._persist(); this._updateScore(); }
    catch(error){ alert(error?.message||error); }
  }

  _updateScore() {
    const t=this.container.querySelector("#dq-team"),o=this.container.querySelector("#dq-opp");
    if(t)t.textContent=Number(this.snapshot.game.team_score||0); if(o)o.textContent=Number(this.snapshot.game.opponent_score||0);
  }
}

export default DelegatedQuickEntryView;
