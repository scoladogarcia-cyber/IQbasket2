/**
 * @fileoverview V38 read-only Live Game Center on top of the scoped BoxScore.
 * @description Reuses the existing BoxScore route and RLS boundary so families,
 * invited users and staff only see live data they are already authorized to read.
 * No write capability is introduced here.
 */

import { ScopedGameBoxScoreView } from "./ScopedGameBoxScoreView.js";

function actionLabel(action = "") {
  const labels = {
    fg2_made: "+2",
    fg2_attempted: "Tiro de 2 fallado",
    fg3_made: "+3",
    fg3_attempted: "Triple fallado",
    ft_made: "+1 TL",
    ft_attempted: "TL fallado",
    off_reb: "Rebote ofensivo",
    def_reb: "Rebote defensivo",
    assists: "Asistencia",
    steals: "Robo",
    blocks_made: "Tapón",
    turnovers: "Pérdida",
    fouls_committed: "Falta cometida",
    fouls_drawn: "Falta recibida",
    opp_pts: "Puntos rival",
    opp_oreb: "Rebote ofensivo rival",
    opp_dreb: "Rebote defensivo rival",
    opp_tov: "Pérdida rival"
  };
  return labels[action] || String(action || "Jugada").replaceAll("_", " ");
}

function clockOf(event = {}) {
  return String(event.game_clock || event.clock || "").trim() || "--:--";
}

export class ScopedGameBoxScoreLiveV38View extends ScopedGameBoxScoreView {
  constructor(supabaseClient, authController) {
    super(supabaseClient, authController);
    this.livePollTimer = null;
    this.liveGameId = null;
    this.livePollGeneration = 0;
  }

  async render(containerId = "dashboard-content-area", targetGameId = null) {
    this._stopLivePoll();
    const result = await super.render(containerId, targetGameId);
    if (targetGameId) {
      this.liveGameId = String(targetGameId);
      this._mountLiveGameCenter(containerId, this.liveGameId);
      this._startLivePoll(containerId, this.liveGameId);
    }
    return result;
  }

  _stopLivePoll() {
    this.livePollGeneration += 1;
    if (this.livePollTimer) globalThis.clearTimeout?.(this.livePollTimer);
    this.livePollTimer = null;
  }

  _mountLiveGameCenter(containerId, gameId) {
    const container = document.getElementById(containerId);
    if (!container || container.querySelector("[data-v38-live-game-center]")) return;

    const panel = document.createElement("section");
    panel.dataset.v38LiveGameCenter = gameId;
    panel.setAttribute("aria-live", "polite");
    panel.innerHTML = `
      <div class="v38-live-center-head">
        <div><strong>📡 LIVE GAME CENTER</strong><span>Seguimiento de sólo lectura</span></div>
        <span data-v38-live-state class="v38-live-badge">Actualizando…</span>
      </div>
      <div data-v38-live-score class="v38-live-score">—</div>
      <div data-v38-live-feed class="v38-live-center-feed"><div class="v38-live-center-empty">Cargando últimas jugadas…</div></div>
    `;
    container.prepend(panel);
  }

  _playerNameMap() {
    const map = new Map();
    (Array.isArray(this.players) ? this.players : []).forEach(player => {
      const id = String(player.id || player.player_id || "");
      const name = `${player.first_name || player.firstName || ""} ${player.last_name || player.lastName || ""}`.trim()
        || player.name
        || "Jugador";
      if (id) map.set(id, name);
    });
    return map;
  }

  async _loadLiveData(gameId) {
    if (!this.supabase?.from) throw new Error("Backend no disponible.");
    const gameResult = await this.supabase.from("games").select("*").eq("id", gameId).maybeSingle();
    if (gameResult.error) throw gameResult.error;

    const eventsResult = await this.supabase.from("play_by_play_events").select("*").eq("game_id", gameId).limit(500);
    if (eventsResult.error) throw eventsResult.error;

    const indexed = (Array.isArray(eventsResult.data) ? eventsResult.data : []).map((event, index) => ({ event, index }));
    indexed.sort((a, b) => {
      const at = Date.parse(a.event.created_at || a.event.updated_at || "");
      const bt = Date.parse(b.event.created_at || b.event.updated_at || "");
      if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;
      return a.index - b.index;
    });

    return {
      game: gameResult.data || null,
      events: indexed.map(item => item.event).slice(-12).reverse()
    };
  }

  _renderLiveData(containerId, gameId, data) {
    const container = document.getElementById(containerId);
    const panel = container?.querySelector?.(`[data-v38-live-game-center="${CSS.escape(String(gameId))}"]`);
    if (!panel) return false;

    const game = data?.game || {};
    const state = String(game.play_state || game.status || "").toUpperCase();
    const stateNode = panel.querySelector("[data-v38-live-state]");
    if (stateNode) {
      stateNode.textContent = state === "LIVE" ? "● EN DIRECTO" : state === "FINISHED" ? "Finalizado" : "Actualización live";
      stateNode.dataset.state = state || "UNKNOWN";
    }

    const score = panel.querySelector("[data-v38-live-score]");
    if (score) {
      const team = Number(game.team_score ?? 0);
      const opponent = Number(game.opponent_score ?? 0);
      const opponentName = game.opponent || "Rival";
      score.innerHTML = `<strong>${team}</strong><span>–</span><strong>${opponent}</strong><small>${opponentName}</small>`;
    }

    const names = this._playerNameMap();
    const feed = panel.querySelector("[data-v38-live-feed]");
    if (feed) {
      const events = Array.isArray(data?.events) ? data.events : [];
      feed.innerHTML = events.length ? events.map(event => {
        const action = String(event.action_type || event.action || event.event_type || "");
        const isOpponent = Boolean(event.is_opponent || event.isOpponent || action.startsWith("opp_"));
        const playerName = isOpponent
          ? "Rival"
          : (names.get(String(event.player_id || event.playerId || "")) || event.player_name || event.playerName || "Jugador");
        const period = event.period ? `P${event.period}` : "";
        return `
          <div class="v38-live-center-row ${isOpponent ? "is-opponent" : ""}">
            <span>${period}${period ? " · " : ""}${clockOf(event)}</span>
            <strong>${actionLabel(action)}</strong>
            <em>${playerName}</em>
          </div>
        `;
      }).join("") : '<div class="v38-live-center-empty">Todavía no hay jugadas registradas.</div>';
    }
    return true;
  }

  _renderLiveError(containerId, gameId, error) {
    const panel = document.getElementById(containerId)?.querySelector?.(`[data-v38-live-game-center="${CSS.escape(String(gameId))}"]`);
    if (!panel) return;
    const badge = panel.querySelector("[data-v38-live-state]");
    if (badge) {
      badge.textContent = "Seguimiento no disponible";
      badge.dataset.state = "ERROR";
      badge.title = String(error?.message || error || "");
    }
  }

  _startLivePoll(containerId, gameId) {
    const generation = ++this.livePollGeneration;
    const poll = async () => {
      if (generation !== this.livePollGeneration) return;
      const panel = document.getElementById(containerId)?.querySelector?.(`[data-v38-live-game-center="${CSS.escape(String(gameId))}"]`);
      if (!panel) return;

      try {
        const data = await this._loadLiveData(gameId);
        if (generation !== this.livePollGeneration) return;
        this._renderLiveData(containerId, gameId, data);
      } catch (error) {
        if (generation !== this.livePollGeneration) return;
        this._renderLiveError(containerId, gameId, error);
      }

      if (generation === this.livePollGeneration) {
        this.livePollTimer = globalThis.setTimeout?.(poll, 2500) || null;
      }
    };
    poll().catch(() => {});
  }
}

if (typeof document !== "undefined" && !document.getElementById("iqbasket-v38-live-center-styles")) {
  const style = document.createElement("style");
  style.id = "iqbasket-v38-live-center-styles";
  style.textContent = `
    [data-v38-live-game-center]{background:#0f172a;color:#fff;border-radius:14px;padding:12px 14px;margin:0 0 14px;box-shadow:0 8px 24px rgba(15,23,42,.16);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .v38-live-center-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.v38-live-center-head>div{display:flex;flex-direction:column;gap:2px}.v38-live-center-head strong{font-size:12px}.v38-live-center-head span{font-size:9px;color:#94a3b8}.v38-live-badge{font-size:9px!important;font-weight:900!important;color:#166534!important;background:#dcfce7;border-radius:999px;padding:5px 8px}.v38-live-badge[data-state="LIVE"]{color:#fff!important;background:#dc2626}.v38-live-badge[data-state="ERROR"]{color:#92400e!important;background:#fef3c7}
    .v38-live-score{display:flex;align-items:baseline;justify-content:center;gap:9px;padding:8px 0 10px}.v38-live-score strong{font-size:34px}.v38-live-score span{font-size:22px;color:#64748b}.v38-live-score small{font-size:9px;color:#94a3b8;margin-left:4px}
    .v38-live-center-feed{border-top:1px solid #334155}.v38-live-center-row{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:7px 2px;border-bottom:1px solid #1e293b;font-size:10px}.v38-live-center-row>span{color:#94a3b8;font-weight:800}.v38-live-center-row>strong{color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v38-live-center-row>em{font-style:normal;font-weight:800;color:#7dd3fc}.v38-live-center-row.is-opponent>em{color:#fdba74}.v38-live-center-empty{text-align:center;padding:12px 4px;color:#94a3b8;font-size:10px}
  `;
  document.head.appendChild(style);
}

export default ScopedGameBoxScoreLiveV38View;
