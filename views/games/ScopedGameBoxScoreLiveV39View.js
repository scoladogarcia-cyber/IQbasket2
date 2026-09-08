/**
 * @fileoverview V39 dedicated spectator Game Center layered on the scoped BoxScore route.
 * @description `#/boxscore/:gameId/live` renders a read-only scoreboard/acta/PBP
 * experience for authorized followers. The normal BoxScore route remains intact.
 * Every query still passes through Supabase RLS; this view introduces no writes.
 */

import { DataStore } from "../../services/DataStore.js";
import { ScopedGameBoxScoreLiveV38View } from "./ScopedGameBoxScoreLiveV38View.js";

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function actionOf(event = {}) {
  return String(event.action_type || event.action || event.event_type || "");
}

function isOpponent(event = {}) {
  const action = actionOf(event);
  return Boolean(event.is_opponent || event.isOpponent || action.startsWith("opp_"));
}

function actionLabel(action = "") {
  const labels = {
    fg2_made: "+2",
    fg2_attempted: "T2 fallado",
    fg3_made: "+3",
    fg3_attempted: "T3 fallado",
    ft_made: "+1 TL",
    ft_attempted: "TL fallado",
    off_reb: "Rebote ofensivo",
    def_reb: "Rebote defensivo",
    assists: "Asistencia",
    steals: "Robo",
    blocks_made: "Tapón",
    turnovers: "Pérdida",
    fouls_committed: "Falta",
    fouls_drawn: "Falta recibida",
    opp_pts: "Puntos rival",
    opp_oreb: "Rebote ofensivo rival",
    opp_dreb: "Rebote defensivo rival",
    opp_tov: "Pérdida rival"
  };
  return labels[action] || action.replaceAll("_", " ") || "Jugada";
}

function eventClock(event = {}) {
  return String(event.game_clock || event.clock || "--:--");
}

function periodLabel(event = {}) {
  const value = Number(event.period || 1);
  return value <= 4 ? `Q${value}` : `PR${value - 4}`;
}

function emptyStats(playerId, name, jersey) {
  return {
    playerId,
    name,
    jersey,
    pts: 0,
    fg2m: 0,
    fg2a: 0,
    fg3m: 0,
    fg3a: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
    ast: 0,
    stl: 0,
    tov: 0,
    pf: 0
  };
}

export class ScopedGameBoxScoreLiveV39View extends ScopedGameBoxScoreLiveV38View {
  constructor(supabaseClient, authController) {
    super(supabaseClient, authController);
    this.streamPollTimer = null;
    this.streamGeneration = 0;
    this.streamTab = "score";
  }

  _isStreamRoute() {
    return /^#\/boxscore\/[0-9a-f-]{36}\/(?:live|stream|marcador)(?:$|[/?])/i.test(String(window.location.hash || ""));
  }

  async render(containerId = "dashboard-content-area", targetGameId = null) {
    if (!targetGameId || !this._isStreamRoute()) {
      this._stopStreamPoll();
      return super.render(containerId, targetGameId);
    }

    this._stopLivePoll();
    this._stopStreamPoll();
    this.liveGameId = String(targetGameId);
    this.players = DataStore.getSeasonParticipantPlayers?.(DataStore.getActiveTeamId?.())
      || DataStore.getPlayers?.()
      || [];

    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = this._streamShell();
    this._bindStreamUi(container);
    await this._refreshStream(containerId, this.liveGameId);
    this._startStreamPoll(containerId, this.liveGameId);
  }

  _streamShell() {
    return `
      <main class="v39-stream-root" data-v39-stream-root>
        <header class="v39-stream-topbar">
          <button type="button" data-v39-stream-back aria-label="Volver">←</button>
          <div><strong>IQ BASKET LIVE</strong><span>Marcador y acta en directo</span></div>
          <button type="button" data-v39-stream-share>Compartir</button>
        </header>

        <section class="v39-stream-scoreboard" aria-live="polite">
          <div class="v39-stream-state" data-v39-stream-state>Actualizando…</div>
          <div class="v39-stream-matchup">
            <div class="v39-stream-side"><span data-v39-team-name>Equipo</span><strong data-v39-team-score>0</strong></div>
            <div class="v39-stream-center"><b data-v39-period>Q1</b><strong data-v39-clock>10:00</strong><small data-v39-last-update>—</small></div>
            <div class="v39-stream-side is-opponent"><span data-v39-opponent-name>Rival</span><strong data-v39-opponent-score>0</strong></div>
          </div>
          <div class="v39-stream-last" data-v39-last-play>Todavía no hay jugadas.</div>
        </section>

        <nav class="v39-stream-tabs" role="tablist">
          <button type="button" data-v39-stream-tab="score" class="is-active">Marcador</button>
          <button type="button" data-v39-stream-tab="acta">Acta</button>
          <button type="button" data-v39-stream-tab="pbp">Jugadas</button>
        </nav>

        <section data-v39-stream-panel="score" class="v39-stream-panel is-active">
          <div class="v39-stream-summary-grid">
            <article><span>Última jugada</span><strong data-v39-summary-last>—</strong></article>
            <article><span>Jugadas registradas</span><strong data-v39-event-count>0</strong></article>
            <article><span>Estado</span><strong data-v39-summary-state>—</strong></article>
          </div>
          <div class="v39-stream-feed" data-v39-short-feed></div>
        </section>

        <section data-v39-stream-panel="acta" class="v39-stream-panel">
          <div class="v39-stream-table-wrap">
            <table class="v39-stream-table">
              <thead><tr><th>Jugadora</th><th>PTS</th><th>T2</th><th>T3</th><th>TL</th><th>REB</th><th>AST</th><th>ROB</th><th>PER</th><th>FC</th></tr></thead>
              <tbody data-v39-acta-body></tbody>
            </table>
          </div>
        </section>

        <section data-v39-stream-panel="pbp" class="v39-stream-panel">
          <div class="v39-stream-feed" data-v39-full-feed></div>
        </section>
      </main>`;
  }

  _bindStreamUi(container) {
    container.querySelector("[data-v39-stream-back]")?.addEventListener("click", () => {
      window.location.hash = `#/boxscore/${encodeURIComponent(this.liveGameId)}`;
    });
    container.querySelector("[data-v39-stream-share]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      try {
        await navigator.clipboard?.writeText?.(window.location.href);
        button.textContent = "Enlace copiado";
      } catch {
        button.textContent = "Copia la URL";
      }
      setTimeout(() => { button.textContent = "Compartir"; }, 1800);
    });
    container.querySelectorAll("[data-v39-stream-tab]").forEach(button => {
      button.addEventListener("click", () => this._selectStreamTab(container, button.dataset.v39StreamTab));
    });
  }

  _selectStreamTab(container, tab) {
    this.streamTab = ["score", "acta", "pbp"].includes(tab) ? tab : "score";
    container.querySelectorAll("[data-v39-stream-tab]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.v39StreamTab === this.streamTab);
    });
    container.querySelectorAll("[data-v39-stream-panel]").forEach(panel => {
      panel.classList.toggle("is-active", panel.dataset.v39StreamPanel === this.streamTab);
    });
  }

  _stopStreamPoll() {
    this.streamGeneration += 1;
    if (this.streamPollTimer) globalThis.clearTimeout?.(this.streamPollTimer);
    this.streamPollTimer = null;
  }

  _startStreamPoll(containerId, gameId) {
    const generation = ++this.streamGeneration;
    const poll = async () => {
      if (generation !== this.streamGeneration) return;
      await this._refreshStream(containerId, gameId);
      if (generation === this.streamGeneration) {
        this.streamPollTimer = globalThis.setTimeout?.(poll, 2000) || null;
      }
    };
    this.streamPollTimer = globalThis.setTimeout?.(poll, 2000) || null;
  }

  async _refreshStream(containerId, gameId) {
    const container = document.getElementById(containerId);
    if (!container?.querySelector?.("[data-v39-stream-root]")) return;
    try {
      const data = await this._loadLiveData(gameId);
      this._renderStreamData(container, data);
    } catch (error) {
      const state = container.querySelector("[data-v39-stream-state]");
      if (state) {
        state.textContent = "Seguimiento no disponible";
        state.dataset.state = "ERROR";
        state.title = String(error?.message || error || "");
      }
    }
  }

  _playerLookup() {
    const map = new Map();
    (this.players || []).forEach(player => {
      const id = String(player.id || player.player_id || "");
      if (!id) return;
      map.set(id, {
        name: player.name || `${player.first_name || player.firstName || ""} ${player.last_name || player.lastName || ""}`.trim() || "Jugador",
        jersey: player.jersey ?? player.number ?? "-"
      });
    });
    return map;
  }

  _statsFromEvents(events = []) {
    const players = this._playerLookup();
    const stats = new Map();
    events.forEach(event => {
      if (isOpponent(event)) return;
      const playerId = String(event.player_id || event.playerId || "");
      if (!playerId) return;
      const player = players.get(playerId) || { name: event.player_name || event.playerName || "Jugador", jersey: "-" };
      if (!stats.has(playerId)) stats.set(playerId, emptyStats(playerId, player.name, player.jersey));
      const row = stats.get(playerId);
      switch (actionOf(event)) {
        case "fg2_made": row.fg2m += 1; row.fg2a += 1; row.pts += 2; break;
        case "fg2_attempted": row.fg2a += 1; break;
        case "fg3_made": row.fg3m += 1; row.fg3a += 1; row.pts += 3; break;
        case "fg3_attempted": row.fg3a += 1; break;
        case "ft_made": row.ftm += 1; row.fta += 1; row.pts += 1; break;
        case "ft_attempted": row.fta += 1; break;
        case "off_reb": row.oreb += 1; break;
        case "def_reb": row.dreb += 1; break;
        case "assists": row.ast += 1; break;
        case "steals": row.stl += 1; break;
        case "turnovers": row.tov += 1; break;
        case "fouls_committed": row.pf += 1; break;
        default: break;
      }
    });
    return [...stats.values()].sort((a, b) => b.pts - a.pts || String(a.jersey).localeCompare(String(b.jersey), undefined, { numeric: true }));
  }

  _feedMarkup(events = [], limit = 12) {
    const players = this._playerLookup();
    const rows = events.slice(0, limit);
    if (!rows.length) return '<div class="v39-stream-empty">Todavía no hay jugadas registradas.</div>';
    return rows.map(event => {
      const opponent = isOpponent(event);
      const player = players.get(String(event.player_id || event.playerId || ""));
      const playerName = opponent ? "Rival" : (player?.name || event.player_name || event.playerName || "Jugador");
      return `
        <div class="v39-stream-feed-row ${opponent ? "is-opponent" : ""}">
          <span>${periodLabel(event)} · ${escapeHtml(eventClock(event))}</span>
          <strong>${escapeHtml(actionLabel(actionOf(event)))}</strong>
          <em>${escapeHtml(playerName)}</em>
        </div>`;
    }).join("");
  }

  _renderStreamData(container, data = {}) {
    const game = data.game || {};
    const events = Array.isArray(data.events) ? data.events : [];
    const last = events[0] || null;
    const state = String(game.play_state || game.status || "").toUpperCase();
    const team = DataStore.getTeamById?.(game.team_id || game.teamId || DataStore.getActiveTeamId?.()) || {};

    const setText = (selector, value) => {
      const node = container.querySelector(selector);
      if (node) node.textContent = String(value ?? "");
    };
    setText("[data-v39-team-name]", team.name || "Equipo");
    setText("[data-v39-opponent-name]", game.opponent || "Rival");
    setText("[data-v39-team-score]", Number(game.team_score ?? 0));
    setText("[data-v39-opponent-score]", Number(game.opponent_score ?? 0));
    setText("[data-v39-period]", last ? periodLabel(last) : "Q1");
    setText("[data-v39-clock]", last ? eventClock(last) : "10:00");
    setText("[data-v39-last-update]", `Actualizado ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
    setText("[data-v39-event-count]", events.length);
    setText("[data-v39-summary-state]", state === "LIVE" ? "En directo" : state === "FINISHED" ? "Finalizado" : state || "—");

    const stateNode = container.querySelector("[data-v39-stream-state]");
    if (stateNode) {
      stateNode.textContent = state === "LIVE" ? "● EN DIRECTO" : state === "FINISHED" ? "FINAL" : "ACTUALIZANDO";
      stateNode.dataset.state = state || "UNKNOWN";
    }

    const lastText = last
      ? `${periodLabel(last)} ${eventClock(last)} · ${actionLabel(actionOf(last))} · ${isOpponent(last) ? "Rival" : (this._playerLookup().get(String(last.player_id || last.playerId || ""))?.name || "Jugador")}`
      : "Todavía no hay jugadas.";
    setText("[data-v39-last-play]", lastText);
    setText("[data-v39-summary-last]", last ? actionLabel(actionOf(last)) : "—");

    const shortFeed = container.querySelector("[data-v39-short-feed]");
    if (shortFeed) shortFeed.innerHTML = this._feedMarkup(events, 6);
    const fullFeed = container.querySelector("[data-v39-full-feed]");
    if (fullFeed) fullFeed.innerHTML = this._feedMarkup(events, 30);

    const acta = container.querySelector("[data-v39-acta-body]");
    if (acta) {
      const rows = this._statsFromEvents(events);
      acta.innerHTML = rows.length ? rows.map(row => `
        <tr>
          <td><strong>#${escapeHtml(row.jersey)}</strong> ${escapeHtml(row.name)}</td>
          <td><b>${row.pts}</b></td><td>${row.fg2m}/${row.fg2a}</td><td>${row.fg3m}/${row.fg3a}</td><td>${row.ftm}/${row.fta}</td>
          <td>${row.oreb + row.dreb}</td><td>${row.ast}</td><td>${row.stl}</td><td>${row.tov}</td><td>${row.pf}</td>
        </tr>`).join("") : '<tr><td colspan="10" class="v39-stream-empty">Sin estadísticas individuales todavía.</td></tr>';
    }
  }
}

if (typeof document !== "undefined" && !document.getElementById("iqbasket-v39-stream-styles")) {
  const style = document.createElement("style");
  style.id = "iqbasket-v39-stream-styles";
  style.textContent = `
    .v39-stream-root{max-width:900px;margin:0 auto 110px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f172a}.v39-stream-topbar{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;margin-bottom:10px}.v39-stream-topbar>button{min-height:42px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;font-weight:850;padding:7px 10px}.v39-stream-topbar>div{display:grid}.v39-stream-topbar strong{font-size:12px;color:#f97316}.v39-stream-topbar span{font-size:9px;color:#64748b}
    .v39-stream-scoreboard{background:#0f172a;color:#fff;border-radius:18px;padding:10px 12px 13px;box-shadow:0 10px 28px rgba(15,23,42,.22)}.v39-stream-state{text-align:center;font-size:9px;font-weight:950;color:#94a3b8;letter-spacing:.08em}.v39-stream-state[data-state="LIVE"]{color:#fca5a5}.v39-stream-matchup{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-top:4px}.v39-stream-side{display:grid;gap:1px;text-align:center}.v39-stream-side span{font-size:11px;font-weight:900;color:#38bdf8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v39-stream-side.is-opponent span{color:#fb923c}.v39-stream-side strong{font-size:46px;line-height:1}.v39-stream-center{display:grid;place-items:center;min-width:78px}.v39-stream-center b{font-size:10px;color:#cbd5e1}.v39-stream-center strong{font-size:24px}.v39-stream-center small{font-size:7px;color:#64748b}.v39-stream-last{margin-top:8px;padding:6px 8px;border-radius:9px;background:#1e293b;color:#e2e8f0;text-align:center;font-size:9px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .v39-stream-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:10px 0}.v39-stream-tabs button{min-height:42px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#475569;font-weight:900}.v39-stream-tabs button.is-active{background:#f97316;border-color:#f97316;color:#fff}.v39-stream-panel{display:none}.v39-stream-panel.is-active{display:block}.v39-stream-summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:8px}.v39-stream-summary-grid article{display:grid;gap:3px;padding:10px;background:#fff;border:1px solid #e2e8f0;border-radius:11px}.v39-stream-summary-grid span{font-size:8px;color:#64748b;font-weight:800}.v39-stream-summary-grid strong{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .v39-stream-feed{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}.v39-stream-feed-row{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:10px}.v39-stream-feed-row:last-child{border-bottom:0}.v39-stream-feed-row>span{color:#64748b;font-weight:800}.v39-stream-feed-row>strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v39-stream-feed-row>em{font-style:normal;font-weight:900;color:#0284c7}.v39-stream-feed-row.is-opponent>em{color:#ea580c}.v39-stream-empty{text-align:center;padding:16px;color:#64748b;font-size:10px}
    .v39-stream-table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:12px;background:#fff}.v39-stream-table{border-collapse:collapse;min-width:680px;width:100%;font-size:10px}.v39-stream-table th,.v39-stream-table td{padding:8px 7px;border-bottom:1px solid #e2e8f0;text-align:center}.v39-stream-table th{position:sticky;top:0;background:#f8fafc;color:#475569;font-size:8px}.v39-stream-table th:first-child,.v39-stream-table td:first-child{text-align:left;min-width:170px}.v39-stream-table td:first-child strong{color:#1d4ed8}
    @media(max-width:520px){.v39-stream-root{margin-left:-2px;margin-right:-2px}.v39-stream-side strong{font-size:40px}.v39-stream-side span{font-size:10px}.v39-stream-summary-grid{grid-template-columns:1fr 1fr 1fr}.v39-stream-summary-grid article{padding:8px 6px}.v39-stream-topbar>button:last-child{font-size:10px}}
  `;
  document.head.appendChild(style);
}

export default ScopedGameBoxScoreLiveV39View;
