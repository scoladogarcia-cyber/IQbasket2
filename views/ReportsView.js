/**
 * @fileoverview V37 secured reports facade.
 * @description Preserves the proven V36 report UI while adding resource-level
 * authorization, fail-closed printing and a standalone Player Evolution report.
 */

import LegacyReportsView from "./ReportsViewLegacyV36.js";
import { DataStore } from "../services/DataStore.js";
import { ReportExporter } from "../services/ReportExporter.js";
import { ReportAccessPolicy, ReportType } from "../security/ReportAccessPolicy.js";
import { LongitudinalAnalyticsService } from "../services/player360/LongitudinalAnalyticsService.js";
import { PlayerEvolutionReportRenderer } from "./reports/PlayerEvolutionReportRenderer.js";

function safePlayerName(player = {}) {
  return [player.first_name || player.firstName, player.last_name || player.lastName]
    .filter(Boolean).join(" ") || player.name || "Jugador";
}

export class ReportsView extends LegacyReportsView {
  constructor(authController = null) {
    super(authController);
    this.reportAccessPolicy = new ReportAccessPolicy(authController);
    this.longitudinalAnalyticsService = new LongitudinalAnalyticsService(authController?.supabase || null);
    this.selectedEvolutionPlayerId = null;
    this._lastEvolutionPayload = null;
  }

  _reportContext(extra = {}) {
    const teamId = DataStore.getActiveTeamId?.() || null;
    const seasonContext = DataStore.getActiveSeasonContext?.(teamId) || null;
    const teamSeasonId = DataStore.getActiveTeamSeasonId?.(teamId)
      || seasonContext?.team_season_id
      || seasonContext?.teamSeasonId
      || null;

    return {
      teamId,
      teamSeasonId,
      seasonId: seasonContext?.season_id || seasonContext?.seasonId || null,
      ...extra
    };
  }

  _rawPlayers() {
    const teamId = DataStore.getActiveTeamId?.() || null;
    return DataStore.getSeasonParticipantPlayers?.(teamId)
      || DataStore.getPlayers?.(teamId)
      || [];
  }

  _authorizedPlayers() {
    return this.reportAccessPolicy.filterPlayers(this._rawPlayers(), this._reportContext());
  }

  /** Player-stat tables/cards must never exceed per-player access. */
  _getSeasonStatsList() {
    const rows = super._getSeasonStatsList();
    const allowed = new Set(this._authorizedPlayers().map(player => String(player.id)));
    return rows.filter(row => allowed.has(String(row.id)));
  }

  _renderPlayerReport(players, games) {
    const safePlayers = this.reportAccessPolicy.filterPlayers(players, this._reportContext());
    return super._renderPlayerReport(safePlayers, games);
  }

  _renderDossierModal(players, games) {
    const safe = this.reportAccessPolicy.sanitizeDossierConfig(
      this.dossierConfig,
      this._reportContext(),
      { players, games }
    );
    this.dossierConfig = { ...this.dossierConfig, ...safe.config };
    return super._renderDossierModal(safe.players, safe.games);
  }

  /**
   * The legacy builder is kept, but it receives only authorized sections and
   * rows, and ReportExporter is opened inside a one-use authorization context.
   */
  _executeDossierPDFExport() {
    const context = this._reportContext();
    const authorization = this.reportAccessPolicy.authorizeExport(ReportType.SEASON_DOSSIER, context);
    if (!authorization.allowed) {
      alert("⚠️ No tienes permiso para exportar este dossier.");
      return false;
    }

    const players = this._rawPlayers();
    const games = super._getFilteredGames();
    const safe = this.reportAccessPolicy.sanitizeDossierConfig(
      this.dossierConfig,
      context,
      { players, games }
    );

    const previousConfig = this.dossierConfig;
    this.dossierConfig = { ...previousConfig, ...safe.config };
    try {
      return ReportExporter.withAuthorization(
        authorization,
        () => super._executeDossierPDFExport()
      );
    } finally {
      this.dossierConfig = previousConfig;
    }
  }

  _scopeLegacyPlayerSelector(container) {
    if (this.reportMode !== "player") return;
    const select = container.querySelector("#select-player");
    if (!select) return;

    const safePlayers = this._authorizedPlayers();
    const allowedIds = new Set(safePlayers.map(player => String(player.id)));
    [...select.options].forEach(option => {
      if (option.value !== "all" && !allowedIds.has(String(option.value))) option.remove();
    });

    if (this.selectedPlayerId !== "all" && !allowedIds.has(String(this.selectedPlayerId))) {
      this.selectedPlayerId = safePlayers[0]?.id ? String(safePlayers[0].id) : "all";
      select.value = this.selectedPlayerId;
    }
  }

  _applyDossierExportState(container) {
    const button = container.querySelector("#btn-open-dossier-modal");
    if (!button) return;
    const allowed = this.reportAccessPolicy.canExport(ReportType.SEASON_DOSSIER, this._reportContext());
    button.disabled = !allowed;
    button.style.cursor = allowed ? "pointer" : "not-allowed";
    button.title = allowed
      ? "Exportar únicamente información dentro de tu alcance"
      : "Tu perfil no puede exportar el dossier de temporada";
    if (!allowed) {
      button.style.background = "#cbd5e1";
      button.style.color = "#64748b";
      button.textContent = "📥 Exportar PDF 🔒";
    }
  }

  _ensureEvolutionModeButton(container, containerId) {
    const first = container.querySelector(".btn-mode");
    const group = first?.parentElement;
    if (!group || group.querySelector('[data-mode="evolution"]')) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn-mode ${this.reportMode === "evolution" ? "active" : ""}`;
    button.dataset.mode = "evolution";
    button.textContent = "4. Evolución";
    button.style.cssText = [
      "padding:8px 14px",
      "border-radius:8px",
      "border:1px solid #cbd5e1",
      "cursor:pointer",
      `background:${this.reportMode === "evolution" ? "#1e3a8a" : "#fff"}`,
      `color:${this.reportMode === "evolution" ? "#fff" : "#0f172a"}`,
      "font-weight:800"
    ].join(";");
    button.addEventListener("click", () => {
      this.reportMode = "evolution";
      this.render(containerId);
    });
    group.appendChild(button);
  }

  async _loadEvolutionPayload(player) {
    const context = this._reportContext({
      playerId: player?.id || null,
      playerTeamId: player?.team_id || player?.teamId || DataStore.getActiveTeamId?.() || null
    });

    if (!player || !this.reportAccessPolicy.canView(ReportType.PLAYER_EVOLUTION, context)) {
      return { allowed: false, context, player, snapshots: [], snapshot: null };
    }

    let snapshots = [];
    let error = null;
    try {
      snapshots = await this.longitudinalAnalyticsService.listSnapshots({
        teamSeasonId: context.teamSeasonId,
        playerId: player.id,
        limit: 20
      });
    } catch (caught) {
      console.error("[ReportsView] No se pudo cargar evolución longitudinal:", caught);
      error = caught;
    }

    return {
      allowed: true,
      context,
      player,
      snapshots,
      snapshot: snapshots[0] || null,
      error
    };
  }

  async _renderEvolutionMode(container, containerId) {
    const content = container.querySelector("#report-view-content-area");
    const filterBar = container.querySelector("#filter-venue")?.parentElement;
    const legacyExport = container.querySelector("#btn-open-dossier-modal");
    const venue = container.querySelector("#filter-venue");
    if (!content || !filterBar) return;

    if (venue) venue.style.display = "none";
    if (legacyExport) legacyExport.style.display = "none";

    const players = this._authorizedPlayers();
    if (!players.length) {
      content.innerHTML = '<div style="padding:20px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;color:#64748b;">No hay jugadores dentro de tu alcance de lectura.</div>';
      return;
    }

    const allowedIds = new Set(players.map(player => String(player.id)));
    if (!this.selectedEvolutionPlayerId || !allowedIds.has(String(this.selectedEvolutionPlayerId))) {
      this.selectedEvolutionPlayerId = String(players[0].id);
    }
    const player = players.find(row => String(row.id) === String(this.selectedEvolutionPlayerId)) || players[0];

    const select = document.createElement("select");
    select.id = "select-evolution-player";
    select.style.cssText = "padding:6px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:12px;font-weight:700;background:white;color:#0f172a;cursor:pointer";
    select.innerHTML = players.map(row => `<option value="${row.id}" ${String(row.id) === String(player.id) ? "selected" : ""}>#${row.jersey || row.number || ""} ${safePlayerName(row)}</option>`).join("");
    select.addEventListener("change", event => {
      this.selectedEvolutionPlayerId = event.currentTarget.value;
      this.render(containerId);
    });
    filterBar.insertBefore(select, legacyExport || null);

    content.innerHTML = '<div style="padding:18px;color:#64748b;">Cargando evolución autorizada…</div>';
    const payload = await this._loadEvolutionPayload(player);
    this._lastEvolutionPayload = payload;

    if (!payload.allowed) {
      content.innerHTML = '<div style="padding:20px;background:#fff;border:1px solid #fecaca;border-radius:12px;color:#991b1b;">No tienes permiso para consultar la evolución de este jugador.</div>';
      return;
    }

    if (payload.error) {
      content.innerHTML = `<div style="padding:20px;background:#fff;border:1px solid #fecaca;border-radius:12px;color:#991b1b;">No se pudo cargar el informe de evolución: ${String(payload.error.message || payload.error)}</div>`;
      return;
    }

    const team = DataStore.getTeamById?.(payload.context.teamId) || {};
    const season = DataStore.getActiveSeasonContext?.(payload.context.teamId) || {};
    const reportHtml = PlayerEvolutionReportRenderer.render({
      player,
      snapshotRow: payload.snapshot,
      snapshotHistory: payload.snapshots,
      teamName: team.name || "",
      seasonName: season.name || DataStore.getActiveSeasonDisplayName?.(payload.context.teamId) || ""
    });
    content.innerHTML = reportHtml;

    const decision = this.reportAccessPolicy.authorizeExport(ReportType.PLAYER_EVOLUTION, payload.context);
    const printButton = document.createElement("button");
    printButton.type = "button";
    printButton.id = "btn-print-evolution";
    printButton.disabled = !decision.allowed;
    printButton.textContent = decision.allowed ? "🖨️ Imprimir evolución" : "🖨️ Imprimir evolución 🔒";
    printButton.title = decision.allowed
      ? "Imprime exclusivamente la evolución de este jugador"
      : "Tu perfil puede consultar este informe, pero no exportarlo";
    printButton.style.cssText = `margin-left:auto;padding:8px 16px;border-radius:8px;border:none;background:${decision.allowed ? "#16a34a" : "#cbd5e1"};color:${decision.allowed ? "#fff" : "#64748b"};font-weight:900;font-size:12px;cursor:${decision.allowed ? "pointer" : "not-allowed"}`;
    if (legacyExport) filterBar.insertBefore(printButton, legacyExport);
    else filterBar.appendChild(printButton);

    if (decision.allowed) {
      printButton.addEventListener("click", () => {
        const title = `Evolucion_${safePlayerName(player).replace(/\s+/g, "_")}`;
        ReportExporter.withAuthorization(decision, () => {
          ReportExporter.printReport(title, reportHtml);
        });
      });
    }
  }

  async render(containerId = "dashboard-content-area") {
    await super.render(containerId);
    const container = document.getElementById(containerId)
      || document.getElementById("main-content")
      || document.querySelector(".app-main-content")
      || document.body;
    if (!container) return;

    this._scopeLegacyPlayerSelector(container);
    this._applyDossierExportState(container);
    this._ensureEvolutionModeButton(container, containerId);

    if (this.reportMode === "evolution") {
      await this._renderEvolutionMode(container, containerId);
    }
  }
}

export default ReportsView;
