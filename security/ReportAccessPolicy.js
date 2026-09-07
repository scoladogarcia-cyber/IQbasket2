/**
 * @fileoverview Central authorization policy for IQBasket reports.
 * @description A report is never authorized merely because its route/button is visible.
 * Every export is checked against the same RBAC/resource scope used by the application.
 */

import { Permission } from "./permissions.js";

export const ReportType = Object.freeze({
  GAME_STATS: "GAME_STATS",
  PLAYER_STATS: "PLAYER_STATS",
  SEASON_DOSSIER: "SEASON_DOSSIER",
  PLAYER_EVOLUTION: "PLAYER_EVOLUTION"
});

const DOSSIER_SECTION_PERMISSIONS = Object.freeze({
  includeTeamSummary: Permission.VIEW_ADVANCED_TEAM_STATS,
  includeColectiveCharts: Permission.VIEW_ADVANCED_TEAM_STATS,
  includeCalendar: Permission.VIEW_GAMES,
  includeBoxScores: Permission.VIEW_BOXSCORE,
  includeRosterMatrix: Permission.VIEW_ROSTER,
  includePlayerCards: Permission.VIEW_PLAYER_STATS,
  includeShotCharts: Permission.VIEW_ADVANCED_PLAYER_STATS
});

function asId(value) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function uniqueIds(values = []) {
  return [...new Set((values || []).map(asId).filter(Boolean))];
}

export class ReportAccessPolicy {
  constructor(authController = null) {
    this.auth = authController;
  }

  _baseContext(context = {}) {
    return {
      clubId: context.clubId || null,
      teamId: context.teamId || null,
      teamSeasonId: context.teamSeasonId || null,
      seasonId: context.seasonId || null
    };
  }

  _can(permission, context = {}) {
    return Boolean(this.auth?.can?.(permission, context));
  }

  _canViewPlayer(context = {}) {
    const playerId = asId(context.playerId);
    if (!playerId) return false;
    const playerTeamId = asId(context.playerTeamId || context.teamId);
    if (!this.auth?.canAccessPlayer?.(playerId, playerTeamId)) return false;
    return this._can(Permission.VIEW_PLAYER_STATS, {
      ...this._baseContext(context),
      playerId,
      playerTeamId
    });
  }

  _canViewEvolution(context = {}) {
    const playerId = asId(context.playerId);
    if (!playerId) return false;
    const playerTeamId = asId(context.playerTeamId || context.teamId);
    if (!this.auth?.canAccessPlayer?.(playerId, playerTeamId)) return false;

    const scoped = {
      ...this._baseContext(context),
      playerId,
      playerTeamId
    };

    return [
      Permission.VIEW_LONGITUDINAL_ANALYTICS,
      Permission.VIEW_PLAYER_360,
      Permission.VIEW_OWN_PLAYER_360,
      Permission.VIEW_LINKED_PLAYER_360
    ].some(permission => this._can(permission, scoped));
  }

  canView(reportType, context = {}) {
    const type = String(reportType || "").toUpperCase();
    const base = this._baseContext(context);

    if (!this._can(Permission.GENERATE_REPORT, base)) return false;

    switch (type) {
      case ReportType.GAME_STATS:
        return this._can(Permission.VIEW_GAMES, base)
          && this._can(Permission.VIEW_BOXSCORE, base);
      case ReportType.PLAYER_STATS:
        return this._canViewPlayer(context);
      case ReportType.SEASON_DOSSIER:
        return this._can(Permission.VIEW_TEAM, base)
          && this._can(Permission.VIEW_GAMES, base);
      case ReportType.PLAYER_EVOLUTION:
        return this._canViewEvolution(context);
      default:
        return false;
    }
  }

  canExport(reportType, context = {}) {
    return this.canView(reportType, context)
      && this._can(Permission.EXPORT_REPORT, this._baseContext(context));
  }

  /** Returns only players that the current identity may read in this context. */
  filterPlayers(players = [], context = {}) {
    return (players || []).filter(player => {
      const playerId = asId(player?.id);
      const playerTeamId = asId(player?.team_id || player?.teamId || context.teamId);
      return playerId && this._canViewPlayer({
        ...context,
        playerId,
        playerTeamId
      });
    });
  }

  /** Games are additionally expected to have been pre-filtered by DataStore/RLS. */
  filterGames(games = [], context = {}) {
    return (games || []).filter(game => {
      const teamId = asId(game?.team_id || game?.teamId || context.teamId);
      const teamSeasonId = asId(game?.team_season_id || game?.teamSeasonId || context.teamSeasonId);
      return teamId
        && this.canView(ReportType.GAME_STATS, { ...context, teamId, teamSeasonId, gameId: game?.id });
    });
  }

  /**
   * Prevents a season dossier from containing a section/resource that the caller
   * cannot read. Selection arrays are intersected with already-authorized rows.
   */
  sanitizeDossierConfig(config = {}, context = {}, { players = [], games = [] } = {}) {
    const base = this._baseContext(context);
    const safe = { ...config };

    for (const [flag, permission] of Object.entries(DOSSIER_SECTION_PERMISSIONS)) {
      safe[flag] = Boolean(config[flag]) && this._can(permission, base);
    }
    safe.includeGlossary = Boolean(config.includeGlossary);

    const authorizedPlayers = this.filterPlayers(players, context);
    const authorizedPlayerIds = new Set(authorizedPlayers.map(player => String(player.id)));
    const authorizedGames = this.filterGames(games, context);
    const authorizedGameIds = new Set(authorizedGames.map(game => String(game.id)));

    const requestedPlayerIds = uniqueIds(config.selectedPlayerIds);
    const requestedGameIds = uniqueIds(config.selectedGameIds);

    safe.selectedPlayerIds = (requestedPlayerIds.length ? requestedPlayerIds : [...authorizedPlayerIds])
      .filter(id => authorizedPlayerIds.has(id));
    safe.selectedGameIds = (requestedGameIds.length ? requestedGameIds : [...authorizedGameIds])
      .filter(id => authorizedGameIds.has(id));

    return {
      config: safe,
      players: authorizedPlayers,
      games: authorizedGames,
      authorizedPlayerIds: [...authorizedPlayerIds],
      authorizedGameIds: [...authorizedGameIds]
    };
  }

  authorizeExport(reportType, context = {}) {
    const type = String(reportType || "").toUpperCase();
    const allowed = this.canExport(type, context);
    return Object.freeze({
      allowed,
      reportType: type,
      context: Object.freeze({ ...context }),
      reason: allowed ? null : "REPORT_SCOPE_DENIED"
    });
  }
}

export default ReportAccessPolicy;
