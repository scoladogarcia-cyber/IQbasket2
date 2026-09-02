/**
 * @fileoverview Vista de Presentación: Informe de Equipo y Plantilla (TeamStatsView.js).
 * @description Presenta la ficha del club, balance colectivo, desglose administrativo y plantilla completa.
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { BoxScoreCalculator } from "../domain/stats/BoxScoreCalculator.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";

export class TeamStatsView {
  constructor(supabaseClient = null, authController = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;

    this.sortState = {
      column: "jersey",
      ascending: true
    };

    this.cachedPlayers = [];
  }

  t(key, fallback = "") {
    return (TranslationStore ? TranslationStore.t(key, fallback) : I18n.t(key, fallback)) || fallback;
  }

  _fetchTeamData(teamId) {
    try {
      const activeTeamId = teamId || DataStore.getActiveTeamId();
      const activeTeam = DataStore.getTeamById(activeTeamId) || {};
      
      const activeSeason = DataStore.getActiveSeasonDisplayName?.(activeTeamId)
        || DataStore.getActiveSeason?.()
        || "Sin temporada";
      const games = DataStore.getGamesForActiveSeason?.(activeTeamId)
        || DataStore.getGames(activeTeamId)
        || [];
      const players = DataStore.getPlayers(activeTeamId) || [];
      const gameIds = new Set(games.map(g => String(g.id)));
      const allPlayerStats = DataStore.getPlayerGameStats() || [];
      const playerStats = allPlayerStats.filter(s => gameIds.has(String(s.game_id || s.gameId || "")));

      const team = {
        id: activeTeamId,
        name: activeTeam.name || "Equipo",
        category: activeTeam.category || "General",
        competition: activeTeam.competition || "Liga",
        coach_name: DataStore.getTeamCoach?.(activeTeamId, activeSeason) || activeTeam.coach_name || activeTeam.coachName || activeTeam.coach || "Por definir",
        periods_count: activeTeam.periods_count || 4,
        period_minutes: activeTeam.period_minutes || 10,
        color: activeTeam.primary_color || activeTeam.color || "#1e3a8a"
      };

      const playedGames = StatsEngine && typeof StatsEngine.filterPlayedGames === "function"
        ? StatsEngine.filterPlayedGames(games)
        : games.filter(g => {
            const teamPts = g.team_score ?? g.teamScore ?? g.our_score ?? null;
            const oppPts = g.opponent_score ?? g.opponentScore ?? g.opp_score ?? null;
            return teamPts !== null && oppPts !== null && (Number(teamPts) > 0 || Number(oppPts) > 0);
          });

      let wins = 0;
      let losses = 0;

      playedGames.forEach((g) => {
        const teamPts = Number(g.team_score ?? g.teamScore ?? g.our_score ?? g.points ?? 0);
        const oppPts = Number(g.opponent_score ?? g.opponentScore ?? g.opp_score ?? g.opp_points ?? 0);
        if (teamPts > oppPts) wins++;
        else if (teamPts < oppPts) losses++;
      });

      const formattedPlayers = (players || []).map((p) => {
        const pRows = (playerStats || []).filter(s => String(s.player_id ?? s.playerId) === String(p.id));
        const gp = pRows.length;

        let totalPts = 0;
        pRows.forEach((r) => {
          const comp = BoxScoreCalculator.calculatePlayerBoxScore(r);
          totalPts += comp.points || 0;
        });

        const realPpg = gp > 0 ? Number((totalPts / gp).toFixed(1)) : (p.ppg !== undefined && p.ppg !== null ? Number(p.ppg) : 0.0);

        return {
          ...p,
          id: p.id,
          fullName: `${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim() || p.name || this.t("player", "Jugador"),
          jerseyNum: (p.jersey !== undefined && p.jersey !== null && p.jersey !== "") ? Number(p.jersey) : (p.number ? Number(p.number) : 99),
          position: p.primary_position || p.primaryPosition || p.position || "Alero",
          statusTxt: String(p.status || "Activo").trim(),
          heightCm: p.height_cm ? Number(p.height_cm) : (p.heightCm ? Number(p.heightCm) : (p.height ? Number(String(p.height).replace(/[^\d]/g, '')) : null)),
          ppg: realPpg
        };
      });

      return {
        team,
        wins,
        losses,
        totalGames: games.length,
        players: formattedPlayers,
        isSuccess: true
      };
    } catch (err) {
      console.error("[TeamStatsView] Error leyendo datos:", err);
      return { isSuccess: false, team: {}, wins: 0, losses: 0, totalGames: 0, players: [] };
    }
  }

  _sortPlayers(players) {
    const { column, ascending } = this.sortState;
    const mult = ascending ? 1 : -1;

    return [...players].sort((a, b) => {
      switch (column) {
        case "jersey":
          return mult * (a.jerseyNum - b.jerseyNum);
        case "name":
          return mult * a.fullName.localeCompare(b.fullName);
        case "position":
          return mult * a.position.localeCompare(b.position);
        case "status":
          return mult * a.statusTxt.localeCompare(b.statusTxt);
        case "height":
          return mult * ((a.heightCm || 0) - (b.heightCm || 0));
        case "ppg":
          return mult * (a.ppg - b.ppg);
        default:
          return 0;
      }
    });
  }

  _renderPlayerRows(players) {
    if (!players || players.length === 0) {
      return `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #64748b;">${this.t("no_players_loaded", "No hay jugadores cargados en la plantilla.")}</td></tr>`;
    }

    return players.map((p) => {
      const heightStr = p.heightCm ? `${p.heightCm} cm` : (p.height || "—");
      const isActivo = p.statusTxt.toLowerCase() === "activo" || p.statusTxt.toLowerCase() === "active";
      const photo = p.photo_url || p.photoUrl || "";

      const avatarMarkup = photo
        ? `<img src="${photo}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 1px solid #cbd5e1; flex-shrink: 0;" />`
        : `<div style="width: 42px; height: 42px; background: #1e3a8a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; flex-shrink: 0;">#${p.jerseyNum !== 99 ? p.jerseyNum : '-'}</div>`;

      return `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px; cursor: pointer;" onclick="window.location.hash='#/player/${p.id}'">
          <td style="padding: 12px; font-weight: 800; color: #0f172a;">#${p.jerseyNum !== 99 ? p.jerseyNum : '-'}</td>
          <td style="padding: 12px; font-weight: 700; color: #0f172a;">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${avatarMarkup}
              <span>${p.fullName}</span>
            </div>
          </td>
          <td style="padding: 12px; color: #475569;">${p.position}</td>
          <td style="padding: 12px;">
            <span style="background: ${isActivo ? '#dcfce7' : '#f1f5f9'}; color: ${isActivo ? '#15803d' : '#64748b'}; padding: 4px 12px; border-radius: 12px; font-weight: 700; font-size: 11px;">
              ${p.statusTxt}
            </span>
          </td>
          <td style="padding: 12px; color: #64748b;">${heightStr}</td>
          <td style="padding: 12px; font-weight: 800; color: var(--color-primary, #f97316);">${p.ppg.toFixed(1)}</td>
        </tr>
      `;
    }).join("");
  }

  _renderPlayerCardsMobile(players) {
    if (!players || players.length === 0) {
      return `<div style="padding: 20px; text-align: center; color: #64748b; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">${this.t("no_players_loaded", "No hay jugadores cargados en la plantilla.")}</div>`;
    }

    return players.map((p) => {
      const isActivo = p.statusTxt.toLowerCase() === "activo" || p.statusTxt.toLowerCase() === "active";
      const photo = p.photo_url || p.photoUrl || "";

      const avatarMarkup = photo
        ? `<img src="${photo}" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0; flex-shrink: 0;" />`
        : `<div style="width: 56px; height: 56px; background: #1e3a8a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; flex-shrink: 0;">#${p.jerseyNum !== 99 ? p.jerseyNum : '-'}</div>`;

      return `
        <div class="team-player-mobile-card card" onclick="window.location.hash='#/player/${p.id}'" style="padding: 16px; border-radius: 12px; background: white; border: 1px solid #e2e8f0; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            ${avatarMarkup}
            <div>
              <strong style="font-size: 15px; color: #0f172a; display: block;">${p.fullName}</strong>
              <span style="font-size: 12px; color: #64748b; font-weight: 500;">#${p.jerseyNum !== 99 ? p.jerseyNum : '-'} · ${p.position}</span>
            </div>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 18px; font-weight: 900; color: var(--color-primary, #f97316); display: block;">${p.ppg.toFixed(1)} <span style="font-size: 10px; color: #64748b;">PPG</span></span>
            <span style="background: ${isActivo ? '#dcfce7' : '#f1f5f9'}; color: ${isActivo ? '#15803d' : '#64748b'}; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700;">${p.statusTxt}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  _attachSortEventListeners(container) {
    const sortHeaders = container.querySelectorAll("[data-sort-player]");
    sortHeaders.forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.getAttribute("data-sort-player");
        if (this.sortState.column === col) {
          this.sortState.ascending = !this.sortState.ascending;
        } else {
          this.sortState.column = col;
          this.sortState.ascending = true;
        }

        const sorted = this._sortPlayers(this.cachedPlayers);
        const tbody = container.querySelector("#roster-table-body");
        if (tbody) tbody.innerHTML = this._renderPlayerRows(sorted);

        const mobileContainer = container.querySelector("#roster-mobile-container");
        if (mobileContainer) mobileContainer.innerHTML = this._renderPlayerCardsMobile(sorted);

        sortHeaders.forEach((header) => {
          const arrowSpan = header.querySelector(".sort-arrow");
          if (arrowSpan) {
            const hCol = header.getAttribute("data-sort-player");
            if (hCol === this.sortState.column) {
              arrowSpan.textContent = this.sortState.ascending ? " ▲" : " ▼";
              arrowSpan.style.color = "#f97316";
            } else {
              arrowSpan.textContent = " ↕";
              arrowSpan.style.color = "#cbd5e1";
            }
          }
        });
      });
    });
  }

  async render(param1 = "dashboard-content-area", param2) {
    let containerId = "dashboard-content-area";
    let teamId = param2;

    if (typeof param1 === "string") {
      containerId = param1;
    } else if (param1 && typeof param1 === "object") {
      teamId = param1.id || param1.teamId;
    }

    const container = document.getElementById(containerId) || document.getElementById("main-content") || document.querySelector(".app-main-content") || document.body;
    if (!container) return;

    const data = this._fetchTeamData(teamId);
    const team = data.team || {};
    this.cachedPlayers = data.players || [];

    const activePlayersCount = this.cachedPlayers.filter(
      (p) => p.statusTxt.toLowerCase() === "activo" || p.statusTxt.toLowerCase() === "active"
    ).length;

    const sortedPlayers = this._sortPlayers(this.cachedPlayers);
    const tableRowsMarkup = this._renderPlayerRows(sortedPlayers);
    const mobileCardsMarkup = this._renderPlayerCardsMobile(sortedPlayers);

    const teamName = team.name || "Equipo";
    const teamCategory = team.category || "General";
    const teamCompetition = team.competition || "Liga";
    const activeSeason = DataStore.getActiveSeasonDisplayName?.(team.id || teamId)
      || DataStore.getActiveSeason?.()
      || "Sin temporada";
    const teamCoach = DataStore.getTeamCoach?.(team.id || teamId, activeSeason) || team.coach_name || "Por definir";
    const teamPeriods = team.periods_count ? `${team.periods_count} × ${team.period_minutes || 10} min` : "4 × 10 min";
    const teamColor = team.color || "#1e3a8a";

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px; font-family: var(--font-family-base, system-ui); max-width: 1400px; margin: 0 auto; padding-bottom: 40px;">
        
        <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">${this.t("team", "Equipo")}</h1>

        <!-- Tarjeta Principal del Equipo -->
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
          <div style="width: 64px; height: 64px; background: ${teamColor}; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: white; font-size: 28px; flex-shrink: 0;">
            🏀
          </div>
          <div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">${teamName}</h2>
            <p style="margin: 4px 0 8px 0; font-size: 12px; color: #64748b;">${teamName}</p>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <span style="background: #dbeafe; color: #1e40af; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;">${teamCategory}</span>
              <span style="background: #ffedd5; color: #c2410c; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;">${teamCompetition}</span>
            </div>
          </div>
        </div>

        <!-- Rejilla de Métricas Rápidas -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px;">
          
          <div class="team-stat-card card" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 10px; font-weight: 800; color: #64748b;">🏆 ${this.t("record", "BALANCE").toUpperCase()}</span>
            <span style="font-size: 22px; font-weight: 900; margin-top: 4px;">
              <strong style="color: #16a34a;">${data.wins}W</strong> - <strong style="color: #dc2626;">${data.losses}L</strong>
            </span>
          </div>

          <div class="team-stat-card card" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 10px; font-weight: 800; color: #64748b;">📅 ${this.t("games", "PARTIDOS").toUpperCase()}</span>
            <span style="font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 4px;">${data.totalGames}</span>
          </div>

          <div class="team-stat-card card" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 10px; font-weight: 800; color: #64748b;">👥 ${this.t("active_players", "JUGADORES ACTIVOS").toUpperCase()}</span>
            <span style="font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 4px;">${activePlayersCount}</span>
          </div>

          <div class="team-stat-card card" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 10px; font-weight: 800; color: #64748b;">📍 ${this.t("season", "TEMPORADA").toUpperCase()}</span>
            <span style="font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 4px;">${activeSeason}</span>
          </div>

        </div>

        <!-- Tabla de Información del Equipo -->
        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px;">
          <h3 style="font-size: 12px; font-weight: 800; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 0; margin-bottom: 16px;">
            ${this.t("team_info", "INFORMACIÓN DEL EQUIPO").toUpperCase()}
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">${this.t("club", "Club")}</span>
              <strong style="color: #0f172a;">${teamName}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">${this.t("category", "Categoría")}</span>
              <strong style="color: #0f172a;">${teamCategory}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">${this.t("competition", "Competición")}</span>
              <strong style="color: #0f172a;">${teamCompetition}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">${this.t("coach", "Entrenador")}</span>
              <strong style="color: #0f172a;">${teamCoach}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">${this.t("periods", "Periodos")}</span>
              <strong style="color: #0f172a;">${teamPeriods}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">${this.t("primary_color", "Color principal")}</span>
              <strong style="color: #0f172a;">${teamColor}</strong>
            </div>
          </div>
        </div>

        <!-- Tabla de Plantilla -->
        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px;">
          <h3 style="font-size: 12px; font-weight: 800; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 0; margin-bottom: 16px;">
            ${this.t("roster", "PLANTILLA").toUpperCase()} (${this.cachedPlayers.length})
          </h3>

          <div class="desktop-only" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 2px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                  <th data-sort-player="jersey" style="padding: 10px 12px; cursor: pointer;">${this.t("jersey", "DORSAL").toUpperCase()} <span class="sort-arrow" style="color: #f97316;">▲</span></th>
                  <th data-sort-player="name" style="padding: 10px 12px; cursor: pointer;">${this.t("player", "JUGADOR").toUpperCase()} <span class="sort-arrow" style="color: #cbd5e1;">↕</span></th>
                  <th data-sort-player="position" style="padding: 10px 12px; cursor: pointer;">${this.t("position", "POSICIÓN").toUpperCase()} <span class="sort-arrow" style="color: #cbd5e1;">↕</span></th>
                  <th data-sort-player="status" style="padding: 10px 12px; cursor: pointer;">${this.t("status", "ESTADO").toUpperCase()} <span class="sort-arrow" style="color: #cbd5e1;">↕</span></th>
                  <th data-sort-player="height" style="padding: 10px 12px; cursor: pointer;">${this.t("height", "ALTURA").toUpperCase()} <span class="sort-arrow" style="color: #cbd5e1;">↕</span></th>
                  <th data-sort-player="ppg" style="padding: 10px 12px; cursor: pointer;">PPG <span class="sort-arrow" style="color: #cbd5e1;">↕</span></th>
                </tr>
              </thead>
              <tbody id="roster-table-body">
                ${tableRowsMarkup}
              </tbody>
            </table>
          </div>

          <div id="roster-mobile-container" class="mobile-only" style="display: flex; flex-direction: column; gap: 12px;">
            ${mobileCardsMarkup}
          </div>
        </div>

      </div>

      <style>
        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
        }
      </style>
    `;

    this._attachSortEventListeners(container);
  }
}

export default TeamStatsView;