/**
 * @fileoverview Informes V50: exportación completa de temporada y ficha individual.
 * @description Mantiene V49, dossier y RBAC. Los informes de jugador leen actas
 * actuales y añaden T2/T3/TC/TL, rebotes, acciones y porcentajes al PDF.
 */
import ReportsView from "./ReportsView.js";
import { DataStore } from "../services/DataStore.js";
import { ReportExporter } from "../services/ReportExporter.js";
import { ReportType } from "../security/ReportAccessPolicy.js";
import { supabase as reportSupabase } from "../config/database.config.js";
import { loadAuthorizedFinalGameReport } from "../services/games/GameFinalReportReadService.js";
import { loadCompleteSeasonReports, buildCompleteSeasonReport } from "../services/reports/CompleteSeasonReportService.js";
import { loadAuthorizedPlayerSeasonStats, replaceScopedPlayerStatsInMemory } from "../services/reports/PlayerSeasonReadService.js";
import { renderPlayerCompleteBoxScore } from "./reports/PlayerCompleteBoxScore.js";

const gameScope = (game, context) => ({
  ...context,
  teamId: game.team_id || game.teamId || context.teamId,
  teamSeasonId: game.team_season_id || game.teamSeasonId || context.teamSeasonId,
  gameId: game.id
});
const normalizeId = value => String(value ?? "");
const safeTitle = value => String(value ?? "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 90);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const sameScope = (a, b) => normalizeId(a.teamId) === normalizeId(b.teamId)
  && normalizeId(a.teamSeasonId) === normalizeId(b.teamSeasonId);

export class ReportsViewV50 extends ReportsView {
  constructor(authController = null) {
    super(authController);
    this._completeSeasonExportRunning = false;
    this._playerPdfRunning = false;
    this._playerReadToken = 0;
    this._playerReportReady = false;
  }

  /** La vista puede filtrar sede, siempre dentro de la temporada activa. */
  _getFilteredGames() {
    const teamId = DataStore.getActiveTeamId?.();
    const activeSeasonGames = DataStore.getGamesForActiveSeason?.(teamId);
    if (!Array.isArray(activeSeasonGames)) return super._getFilteredGames();
    const games = activeSeasonGames.filter(game => {
      if (this.filters.venue === "all") return true;
      const venue = String(game.venue || "").toLowerCase();
      return this.filters.venue === "local"
        ? venue === "local" || venue === "home" || game.is_home === true
        : venue === "visitante" || venue === "away" || game.is_home === false;
    });
    return [...games].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  }

  /**
   * El acta va PRIMERO: la ficha visual legacy ocupaba una pantalla entera y el
   * PDF desplazaba los tiros a páginas posteriores, haciendo parecer que faltan.
   * Se reutiliza exactamente el mismo HTML para pantalla y PDF, sin recálculos.
   */
  _renderSinglePlayerCard(player, games) {
    const detail = renderPlayerCompleteBoxScore({
      player,
      games,
      stats: DataStore.getPlayerGameStats?.(player.id) || []
    });
    const name = [player.first_name ?? player.firstName, player.last_name ?? player.lastName]
      .filter(Boolean).join(" ") || player.name || "Jugador";
    // Se preserva el dorsal 0: player.jersey || '-' lo ocultaba en la ficha antigua.
    const label = `#${player.jersey ?? player.number ?? "–"} ${name}`;
    const original = super._renderSinglePlayerCard(player, games);
    return `<section class="iq-player-report" style="margin-bottom:20px;break-inside:auto">
      <header style="background:#eff6ff;border:1px solid #bfdbfe;padding:12px 14px;border-radius:10px;margin-bottom:10px">
        <h2 style="font-size:18px;color:#172554;margin:0">${escapeHtml(label)}</h2>
        <p style="font-size:11px;margin:4px 0 0;color:#334155">Primero: tiros y estadísticas reales por partido y temporada. Después: gráficas y mapa de tiro, si existen posiciones registradas.</p>
      </header>
      ${detail}
      <div class="iq-player-visuals" style="margin-top:14px;break-before:page;page-break-before:always">
        <h3 style="font-size:13px;color:#334155;margin-bottom:8px">Gráficas complementarias · ${escapeHtml(label)}</h3>
        ${original}
      </div>
    </section>`;
  }

  /** Selección exacta del jugador y de los partidos de la temporada filtrada. */
  _playerSelection(context) {
    const authorized = this._authorizedPlayers();
    const players = this.selectedPlayerId === "all"
      ? authorized
      : authorized.filter(player => normalizeId(player.id) === normalizeId(this.selectedPlayerId));
    if (!players.length) throw new Error("No hay jugadores autorizados en esta selección.");
    const games = this._getFilteredGames();
    if (!games.length) throw new Error("No hay partidos de esta temporada con los filtros seleccionados.");
    if (!context.teamSeasonId) throw new Error("Selecciona una temporada válida para consultar las actas individuales.");
    return { players, games };
  }

  /** Lectura con RLS y RBAC; reemplaza SOLO las actas autorizadas en memoria. */
  async _loadPlayerSelection(context, selection) {
    const stats = await loadAuthorizedPlayerSeasonStats({
      supabase: reportSupabase,
      policy: this.reportAccessPolicy,
      context,
      players: selection.players,
      games: selection.games
    });
    return stats;
  }

  /** No dibujar un informe aparentemente vacío cuando falla la consulta. */
  async _refreshPlayerMode(container) {
    const content = container.querySelector("#report-view-content-area");
    if (!content) return;
    const token = ++this._playerReadToken;
    const context = this._reportContext();
    const selected = normalizeId(this.selectedPlayerId);
    this._playerReportReady = false;
    content.textContent = "Recuperando actas y tiros individuales actualizados…";
    try {
      const selection = this._playerSelection(context);
      const stats = await this._loadPlayerSelection(context, selection);
      if (token !== this._playerReadToken || this.reportMode !== "player"
        || normalizeId(this.selectedPlayerId) !== selected || !sameScope(context, this._reportContext())) return;
      const stillAllowed = selection.players.every(player => this.reportAccessPolicy.canView(ReportType.PLAYER_STATS, {
        ...context, playerId: player.id, playerTeamId: player.team_id || player.teamId || context.teamId
      }));
      if (!stillAllowed) throw new Error("Tus permisos han cambiado durante la consulta.");
      replaceScopedPlayerStatsInMemory(DataStore, { ...selection, stats });
      content.innerHTML = this._renderPlayerReport(selection.players, selection.games);
      this._playerReportReady = true;
      const button = container.querySelector("#btn-export-complete-players");
      if (button) button.disabled = !this._canExportPlayers(context, selection.players) || this._playerPdfRunning;
    } catch (error) {
      console.warn("[ReportsViewV50] Lectura individual cancelada:", error);
      if (token === this._playerReadToken && this.reportMode === "player") {
        content.textContent = `No se ha podido recuperar el informe individual actualizado. ${error.message || "Reintenta la lectura."} No se ha modificado ningún dato.`;
      }
    }
  }

  _canExportPlayers(context, players) {
    return players.length > 0 && players.every(player => this.reportAccessPolicy.canExport(ReportType.PLAYER_STATS, {
      ...context, playerId: player.id, playerTeamId: player.team_id || player.teamId || context.teamId
    }));
  }

  /** Exportación específica sin cifras prefijadas del antiguo PDF personalizado. */
  async _exportCompletePlayers(button) {
    if (this._playerPdfRunning || !this._playerReportReady) return;
    const context = this._reportContext();
    let selection;
    try { selection = this._playerSelection(context); }
    catch (error) { button.title = error.message; return; }
    if (!this._canExportPlayers(context, selection.players)) return;
    // Safari exige abrir la ventana dentro del clic, antes de cualquier await.
    const printWindow = window.open("", "_blank", "width=1024,height=768");
    if (!printWindow) {
      alert("Permite ventanas emergentes para imprimir el informe de jugadores.");
      return;
    }
    this._playerPdfRunning = true;
    button.disabled = true;
    printWindow.document.body.textContent = "Recuperando estadísticas individuales actualizadas…";
    try {
      const selected = normalizeId(this.selectedPlayerId);
      const stats = await this._loadPlayerSelection(context, selection);
      if (!sameScope(context, this._reportContext()) || this.reportMode !== "player"
        || normalizeId(this.selectedPlayerId) !== selected
        || !this._canExportPlayers(this._reportContext(), selection.players)) {
        throw new Error("El jugador, la temporada o los permisos han cambiado durante la exportación.");
      }
      replaceScopedPlayerStatsInMemory(DataStore, { ...selection, stats });
      const report = selection.players.map((player, i) => `<section style="${i ? "break-before:page;page-break-before:always;" : ""}break-inside:auto">
        ${this._renderSinglePlayerCard(player, selection.games)}
      </section>`).join("");
      const team = DataStore.getTeamById?.(context.teamId);
      const season = DataStore.getActiveSeasonDisplayName?.(context.teamId) || "Temporada";
      const name = selection.players.length === 1 ? selection.players[0].first_name || selection.players[0].name || "Jugador" : "Plantilla";
      const html = `<style>@media print{@page{size:A4 landscape;margin:9mm}.iq-player-boxscore{font-size:8px!important}.iq-player-boxscore td,.iq-player-boxscore th{padding:2px 3px!important}.iq-player-detail{break-inside:auto!important}}</style>
        <header style="padding:12px;border-bottom:2px solid #1e3a8a;margin-bottom:14px"><h1>Informe individual completo · ${selection.players.length === 1 ? "Jugador" : "Plantilla"}</h1><p>${String(team?.name || "Equipo").replace(/[&<>"']/g, "")} · ${String(season).replace(/[&<>"']/g, "")} · ${selection.games.length} partidos seleccionados</p></header>${report}`;
      const decision = this.reportAccessPolicy.authorizeExport(ReportType.PLAYER_STATS, {
        ...context,
        playerId: selection.players[0].id,
        playerTeamId: selection.players[0].team_id || selection.players[0].teamId || context.teamId
      });
      if (!ReportExporter.printReport(`IQBasket_Jugador_${safeTitle(name)}_${safeTitle(season)}`, html, {
        authorization: decision, printWindow
      })) throw new Error("El navegador no ha podido preparar el PDF.");
    } catch (error) {
      console.warn("[ReportsViewV50] Exportación individual cancelada:", error);
      if (!printWindow.closed && printWindow.document?.body) {
        printWindow.document.body.textContent = `No se ha generado un PDF incompleto. ${error.message || "Vuelve a intentarlo."}`;
      }
    } finally {
      this._playerPdfRunning = false;
      if (button.isConnected) button.disabled = !this._playerReportReady || !this._canExportPlayers(this._reportContext(), this._authorizedPlayers().filter(player => this.selectedPlayerId === "all" || normalizeId(player.id) === normalizeId(this.selectedPlayerId)));
    }
  }

  /**
   * Exportación COMPLETA: no se aplican los filtros de sede ni de partido de la
   * pantalla. Solo temporada activa, partidos legibles y permiso por recurso.
   */
  _exportableGames(context) {
    const seasonGames = DataStore.getGamesForActiveSeason?.(context.teamId) || [];
    const allowed = this.reportAccessPolicy.filterGames(seasonGames, context);
    return allowed
      .filter(game => this.reportAccessPolicy.canExport(ReportType.GAME_STATS, gameScope(game, context)))
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  }

  /** Apertura sin await para evitar bloqueo de ventana emergente en iOS Safari. */
  async _exportCompleteSeason(button) {
    if (this._completeSeasonExportRunning) return;
    const context = this._reportContext();
    const authorization = this.reportAccessPolicy.authorizeExport(ReportType.SEASON_DOSSIER, context);
    const games = this._exportableGames(context);
    if (!authorization.allowed || !games.length) {
      button.disabled = true;
      button.title = "Sin permiso de exportación o sin partidos autorizados en esta temporada.";
      return;
    }
    const printWindow = window.open("", "_blank", "width=1024,height=768");
    if (!printWindow) {
      alert("El navegador ha bloqueado la ventana. Permite ventanas emergentes para exportar el PDF.");
      return;
    }
    this._completeSeasonExportRunning = true;
    button.disabled = true;
    const initialText = button.textContent;
    button.textContent = `Preparando ${games.length} informe(s)…`;
    printWindow.document.body.textContent = `Preparando los ${games.length} informes autorizados. No cierres esta ventana.`;
    try {
      const reports = await loadCompleteSeasonReports({
        games,
        teamId: context.teamId,
        teamSeasonId: context.teamSeasonId,
        loadReport: gameId => loadAuthorizedFinalGameReport({
          supabase: this.auth?.supabase,
          dataStore: DataStore,
          auth: this.auth,
          gameId
        })
      });
      // Revocar una sesión, cambiar de equipo/temporada o perder permisos durante
      // la lectura debe cancelar el documento antes de sacarlo del navegador.
      const current = this._reportContext();
      if (normalizeId(current.teamId) !== normalizeId(context.teamId)
        || normalizeId(current.teamSeasonId) !== normalizeId(context.teamSeasonId)
        || !this.reportAccessPolicy.canExport(ReportType.SEASON_DOSSIER, current)
        || !reports.every(({ game }) => this.reportAccessPolicy.canExport(ReportType.GAME_STATS, gameScope(game, current)))) {
        throw new Error("El ámbito o los permisos han cambiado durante la exportación.");
      }
      const teamName = DataStore.getTeamById?.(context.teamId)?.name || "Nuestro equipo";
      const seasonName = DataStore.getActiveSeasonDisplayName?.(context.teamId) || "Temporada seleccionada";
      const html = buildCompleteSeasonReport({ reports, teamName, seasonName });
      const freshAuthorization = this.reportAccessPolicy.authorizeExport(ReportType.SEASON_DOSSIER, current);
      if (!ReportExporter.printReport(`IQBasket_Completo_${seasonName}`, html, {
        authorization: freshAuthorization,
        printWindow
      })) throw new Error("El navegador no ha podido abrir la impresión.");
    } catch (error) {
      console.warn("[ReportsViewV50] Exportación completa cancelada:", error);
      if (!printWindow.closed && printWindow.document?.body) {
        printWindow.document.body.textContent = `No se ha generado ningún informe parcial. ${error?.message || "Vuelve a intentarlo."}`;
      }
      button.title = "Se ha cancelado la exportación; revisa la ventana abierta y vuelve a intentarlo.";
    } finally {
      this._completeSeasonExportRunning = false;
      if (button.isConnected) {
        button.textContent = initialText;
        const current = this._reportContext();
        button.disabled = !this.reportAccessPolicy.canExport(ReportType.SEASON_DOSSIER, current)
          || this._exportableGames(current).length === 0;
      }
    }
  }

  /** Botones específicos junto al selector; en Jugador se oculta el PDF obsoleto. */
  async render(containerId = "dashboard-content-area") {
    // Invalida las lecturas asíncronas de jugador al cambiar de pantalla.
    ++this._playerReadToken;
    await super.render(containerId);
    const container = document.getElementById(containerId) || document.getElementById("main-content") || document.querySelector(".app-main-content") || document.body;
    if (this.reportMode === "player") {
      const toolbar = container?.querySelector("#filter-venue")?.parentElement;
      const legacy = toolbar?.querySelector("#btn-open-dossier-modal");
      if (legacy) legacy.style.display = "none";
      if (toolbar) {
        const button = document.createElement("button");
        button.type = "button";
        button.id = "btn-export-complete-players";
        button.textContent = "📥 Exportar informe individual completo (PDF)";
        button.style.cssText = "padding:10px 14px;border-radius:8px;border:1px solid #15803d;background:#15803d;color:#fff;font-size:12px;font-weight:800;min-height:44px;max-width:100%;white-space:normal;cursor:pointer";
        button.disabled = true;
        button.title = "Acta individual por partido, T2/T3/TC/TL, rebotes, acciones, porcentajes, radar y mapa de tiro. Imprimir → Guardar como PDF.";
        button.addEventListener("click", () => { void this._exportCompletePlayers(button); });
        toolbar.append(button);
      }
      await this._refreshPlayerMode(container);
      return;
    }
    if (this.reportMode !== "game" && this.reportMode !== "season_dossier") return;
    const toolbar = container?.querySelector("#filter-venue")?.parentElement;
    if (!toolbar || toolbar.querySelector("#btn-export-complete-season")) return;
    const context = this._reportContext();
    const games = this._exportableGames(context);
    const canExport = this.reportAccessPolicy.canExport(ReportType.SEASON_DOSSIER, context) && games.length > 0;
    const button = document.createElement("button");
    button.type = "button";
    button.id = "btn-export-complete-season";
    button.textContent = "📥 Exportar temporada completa · datos + mapas (PDF)";
    button.disabled = !canExport || this._completeSeasonExportRunning;
    button.title = canExport
      ? `${games.length} partido(s) autorizados: actas completas, comparativas, mapas y glosario final. Imprimir → Guardar como PDF.`
      : "No hay partidos autorizados para exportar o falta el permiso de exportación.";
    button.style.cssText = "padding:10px 14px;border-radius:8px;border:1px solid #0f766e;background:#0f766e;color:#fff;font-size:12px;font-weight:800;min-height:44px;max-width:100%;white-space:normal;cursor:pointer";
    if (!canExport) button.style.cssText += ";opacity:.55;cursor:not-allowed";
    button.addEventListener("click", () => { void this._exportCompleteSeason(button); });
    const oldExport = toolbar.querySelector("#btn-open-dossier-modal");
    if (oldExport) toolbar.insertBefore(button, oldExport);
    else toolbar.append(button);
    const help = document.createElement("span");
    help.textContent = "Completo: todos los partidos autorizados de la temporada, independientemente del filtro Local/Visitante. El PDF personalizado antiguo es una selección distinta.";
    help.style.cssText = "width:100%;font-size:11px;color:#475569";
    toolbar.append(help);
  }
}

export default ReportsViewV50;
