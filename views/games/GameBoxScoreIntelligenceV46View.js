/**
 * @fileoverview BoxScore seguro V46–V48: lectura persistida, informe y métricas.
 * @description Las estadísticas históricas nunca se reescriben al generar informes.
 */
import { GameBoxScoreView as GameBoxScoreBaseView } from "../GameBoxScoreBaseView.js";
import { buildGameIntelligence } from "../../domain/intelligence/GameIntelligenceEngine.js";
import { normalizeGameStatsForIntelligence } from "../../domain/intelligence/GameIntelligenceInputAdapter.js";
import { renderGameIntelligencePanel } from "../components/GameIntelligencePanelV46.js";
import { DataStore } from "../../services/DataStore.js";
import { refreshGameBoxScore } from "../../services/games/GameBoxScoreFreshReadService.js";
import { buildGameReportMetrics, formatMetric } from "../../domain/stats/GameReportMetrics.js";
import { renderFinalGameReport } from "../reports/GameFinalReportRenderer.js";
import { ReportAccessPolicy, ReportType } from "../../security/ReportAccessPolicy.js";
import { ReportExporter } from "../../services/ReportExporter.js";
import { isConfirmedBoxScoreSaveRerender, resolveBoxScorePostSaveDestination } from "./BoxScorePostSaveNavigationV46.js";

export class GameBoxScoreIntelligenceV46View extends GameBoxScoreBaseView {
  async render(containerId = "dashboard-content-area", targetGameId = null) {
    const container = document.getElementById(containerId);
    const saveButton = container?.querySelector("#btn-save-boxscore");
    if (isConfirmedBoxScoreSaveRerender({ targetGameId, selectedGameId: this.selectedGameId, saveButtonDisabled: Boolean(saveButton?.disabled) })) {
      window.location.hash = resolveBoxScorePostSaveDestination(this.isGameScopedOnly);
      return;
    }
    if (targetGameId && container) {
      try {
        await refreshGameBoxScore({ supabase: this.supabase, dataStore: DataStore, gameId: targetGameId });
      } catch (error) {
        console.warn("[GameBoxScore] Lectura no sincronizada:", error);
        container.innerHTML = `<div role="alert" style="padding:24px;color:#991b1b;background:white;border:1px solid #fecaca;border-radius:12px;"><strong>El acta todavía no se ha podido cargar.</strong><p>No se ha modificado ningún dato. Vuelve a abrir este partido desde Partidos cuando la conexión esté disponible. No guardes un acta vacía.</p><a href="#/games" style="color:#1e40af;font-weight:700;">Volver a Partidos</a></div>`;
        return;
      }
    }
    return super.render(containerId, targetGameId);
  }

  _renderGameBoxScoreDetail(container, containerId) {
    const result = super._renderGameBoxScoreDetail(container, containerId);
    this._injectGameIntelligence(container);
    this._installReportActions(container);
    return result;
  }

  /** Corrige el USG legado de 18,5% sin alterar jamás los valores persistidos. */
  _refreshUsageCells(container) {
    const table = container.querySelector("tr[data-player-id]")?.closest("table");
    if (!table) return;
    const trs = [...table.querySelectorAll("tr[data-player-id]")];
    const rows = trs.map(tr => {
      const get = field => Number(tr.querySelector(`.bs-input[data-field="${field}"]`)?.value || 0);
      return { player_id: tr.dataset.playerId, minutes: get("minutes"), fg2_attempted: get("fg2_attempted"), fg3_attempted: get("fg3_attempted"), ft_attempted: get("ft_attempted"), turnovers: get("turnovers") };
    });
    const metrics = buildGameReportMetrics(rows);
    trs.forEach((tr, index) => {
      const cell = tr.cells[tr.cells.length - 1];
      if (cell) {
        cell.textContent = formatMetric(metrics.rows[index].usage, "%");
        cell.classList.add("cell-usage-canonical");
        cell.title = "USG% estimado con acciones y minutos de todos los jugadores; N/D si no es calculable.";
      }
    });
    const foot = table.querySelector("tfoot tr");
    if (foot?.lastElementChild) foot.lastElementChild.textContent = formatMetric(metrics.totals.usage, "%");
  }

  _installReportActions(container) {
    if (!container) return;
    this._refreshUsageCells(container);
    container.addEventListener("input", event => {
      if (event.target?.matches?.("tr[data-player-id] .bs-input")) this._refreshUsageCells(container);
    });
    const game = this.games.find(item => String(item.id) === String(this.selectedGameId));
    if (!game || !this.supabase?.from) return;
    const context = this._gameContext(game);
    const policy = new ReportAccessPolicy(this.auth);
    if (!policy.canView(ReportType.GAME_STATS, context)) return;
    const table = container.querySelector("tr[data-player-id]")?.closest("table");
    const shell = table?.parentElement;
    if (!shell) return;
    const toolbar = document.createElement("div");
    toolbar.id = "final-game-report-actions";
    toolbar.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;margin:12px 0;";
    const button = document.createElement("button");
    button.type = "button";
    button.id = "btn-final-game-report";
    button.textContent = "📄 Informe final completo · acta, métricas y mapas";
    button.style.cssText = "padding:12px 16px;background:#1e3a8a;color:#fff;border:0;border-radius:10px;font-weight:800;cursor:pointer;min-height:44px;";
    toolbar.append(button);
    shell.parentElement?.insertBefore(toolbar, shell);
    button.addEventListener("click", async () => {
      if (!policy.canView(ReportType.GAME_STATS, context)) return;
      button.disabled = true;
      button.textContent = "Cargando datos guardados del partido…";
      const existing = container.querySelector("#final-game-report-v48");
      existing?.remove();
      const output = document.createElement("section");
      output.id = "final-game-report-v48";
      toolbar.after(output);
      try {
        await refreshGameBoxScore({ supabase: this.supabase, dataStore: DataStore, gameId: game.id });
        const { data: latestGame, error: gameError } = await this.supabase.from("games").select("*").eq("id", game.id).single();
        if (gameError || !latestGame || String(latestGame.team_id) !== String(context.teamId)) throw new Error("El partido no está disponible para consulta.");
        if (!policy.canView(ReportType.GAME_STATS, this._gameContext(latestGame))) throw new Error("Acceso al partido no autorizado.");
        const rawPlayers = DataStore.getSeasonParticipantPlayers?.(context.teamId) || this.players;
        const players = policy.filterPlayers(rawPlayers, context);
        const allowedIds = new Set(players.map(p => String(p.id)));
        const allStats = DataStore.getPlayerGameStats(null, game.id) || [];
        const scopedStats = allStats.filter(row => allowedIds.has(String(row.player_id ?? row.playerId)));
        const { data: periodData, error: periodError } = await this.supabase.from("game_period_scores").select("*").eq("game_id", game.id).order("period_number", { ascending: true });
        if (periodError) throw new Error("No se pudieron consultar los parciales. Reinténtalo.");
        let events = [], eventsAvailable = true;
        try {
          events = await DataStore.loadGameEvents([game.id], true);
          if (!Array.isArray(events)) eventsAvailable = false;
        } catch (error) {
          console.warn("[FinalReport] Cartas espaciales no disponibles:", error);
          eventsAvailable = false;
        }
        const html = renderFinalGameReport({ game: latestGame, teamName: DataStore.getTeamById?.(context.teamId)?.name || "Nuestro equipo", players, stats: scopedStats, periods: periodData || [], events: events || [], eventsAvailable, completeRoster: scopedStats.length === allStats.length });
        output.innerHTML = html;
        const print = document.createElement("button");
        print.type = "button";
        print.textContent = "🖨️ Imprimir / guardar PDF completo";
        print.style.cssText = "background:#15803d;color:white;border:0;padding:12px 16px;border-radius:9px;font-weight:800;cursor:pointer;min-height:44px;";
        if (!policy.canExport(ReportType.GAME_STATS, context)) print.hidden = true;
        output.prepend(print);
        print.addEventListener("click", () => {
          const decision = policy.authorizeExport(ReportType.GAME_STATS, this._gameContext(latestGame));
          if (!decision.allowed) return;
          ReportExporter.printReport(`Informe_${game.date || "partido"}`, html, { authorization: decision });
        });
        output.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        console.warn("[FinalReport] No se pudo recuperar el informe:", error);
        output.textContent = "No se pudo recuperar el informe completo. No se ha escrito ni modificado ningún dato. Comprueba la conexión y vuelve a intentarlo.";
        output.setAttribute("role", "alert");
      } finally {
        button.disabled = false;
        button.textContent = "📄 Informe final completo · acta, métricas y mapas";
      }
    });
  }

  /** Panel V46 conservado sin afectar a la edición del BoxScore. */
  _injectGameIntelligence(container) {
    if (!container || !Array.isArray(this.gameStats)) return;
    try {
      container.querySelector("#game-intelligence-v46")?.remove();
      const canonicalStats = normalizeGameStatsForIntelligence(this.gameStats);
      const intelligence = buildGameIntelligence({ playerStats: canonicalStats });
      const markup = renderGameIntelligencePanel({ intelligence, t: (key, fallback) => this.t(key, fallback) });
      const tableShell = container.querySelector("table")?.parentElement;
      if (!tableShell) return;
      tableShell.insertAdjacentHTML("beforebegin", markup);
    } catch (error) {
      console.warn("[GameIntelligenceV46] Read-only panel unavailable", error);
    }
  }
}

export default GameBoxScoreIntelligenceV46View;
