/**
 * @fileoverview Informes V50: exportación completa y visible de datos + mapas.
 * @description Extensión aditiva de V49: mantiene informes de partido, dossier
 * configurable, evolución y RBAC existentes. No escribe en la base de datos.
 */
import ReportsView from "./ReportsView.js";
import { DataStore } from "../services/DataStore.js";
import { ReportExporter } from "../services/ReportExporter.js";
import { ReportType } from "../security/ReportAccessPolicy.js";
import { loadAuthorizedFinalGameReport } from "../services/games/GameFinalReportReadService.js";
import { loadCompleteSeasonReports, buildCompleteSeasonReport } from "../services/reports/CompleteSeasonReportService.js";

const gameScope = (game, context) => ({
  ...context,
  teamId: game.team_id || game.teamId || context.teamId,
  teamSeasonId: game.team_season_id || game.teamSeasonId || context.teamSeasonId,
  gameId: game.id
});
const normalizeId = value => String(value ?? "");

export class ReportsViewV50 extends ReportsView {
  constructor(authController = null) {
    super(authController);
    this._completeSeasonExportRunning = false;
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

  /** Botón explícito junto al selector: visible incluso al elegir «Todos». */
  async render(containerId = "dashboard-content-area") {
    await super.render(containerId);
    if (this.reportMode !== "game" && this.reportMode !== "season_dossier") return;
    const container = document.getElementById(containerId) || document.getElementById("main-content") || document.querySelector(".app-main-content") || document.body;
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
