/**
 * @fileoverview Resolución de contexto temporada global + equipo-temporada (modelo v3).
 * @description Mantiene la lógica de contexto fuera de DataStore y depende únicamente
 * del contrato de base de datos recibido, no de Supabase directamente.
 */

import { SeasonCatalogRepository } from "../../domain/repositories/SeasonCatalogRepository.js";
import { TeamSeasonRepository } from "../../domain/repositories/TeamSeasonRepository.js";
import { RosterMembershipRepository } from "../../domain/repositories/RosterMembershipRepository.js";
import { TeamSeasonMembershipRepository } from "../../domain/repositories/TeamSeasonMembershipRepository.js";

function normalizeRef(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export class SeasonContextService {
  constructor(dbAdapter) {
    if (!dbAdapter) {
      throw new Error("SeasonContextService requiere un adaptador de base de datos.");
    }

    this.seasons = new SeasonCatalogRepository(dbAdapter);
    this.teamSeasons = new TeamSeasonRepository(dbAdapter);
    this.rosters = new RosterMembershipRepository(dbAdapter);
    this.memberships = new TeamSeasonMembershipRepository(dbAdapter);
  }

  async listByTeam(teamId, { status = "ACTIVE" } = {}) {
    if (!teamId) return [];

    const scopes = await this.teamSeasons.listByTeam(teamId, { status });
    if (!Array.isArray(scopes) || scopes.length === 0) return [];

    const globalSeasonIds = [...new Set(
      scopes.map(scope => scope.season_id).filter(Boolean).map(String)
    )];

    const catalog = await this.seasons.getByIds(globalSeasonIds);
    const catalogMap = new Map((catalog || []).map(season => [String(season.id), season]));

    return scopes
      .map((scope) => {
        const globalSeason = catalogMap.get(String(scope.season_id));
        if (!globalSeason) return null;

        return {
          // Compatibilidad: id sigue representando el legacy season FK usado por games.
          id: scope.legacy_season_id || globalSeason.id,
          legacy_season_id: scope.legacy_season_id || null,
          legacySeasonId: scope.legacy_season_id || null,
          global_season_id: globalSeason.id,
          globalSeasonId: globalSeason.id,
          team_season_id: scope.id,
          teamSeasonId: scope.id,
          team_id: scope.team_id,
          teamId: scope.team_id,
          code: globalSeason.code,
          name: globalSeason.name,
          start_date: globalSeason.start_date,
          end_date: globalSeason.end_date,
          status: scope.status || globalSeason.status || "ACTIVE",
          data_status: scope.data_status || "ACTIVE",
          source: "v3"
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aDate = a.start_date ? new Date(a.start_date).getTime() : 0;
        const bDate = b.start_date ? new Date(b.start_date).getTime() : 0;
        if (aDate !== bDate) return bDate - aDate;
        return String(b.code || b.name || "").localeCompare(String(a.code || a.name || ""));
      });
  }

  resolve(contexts = [], seasonRef = null) {
    if (!Array.isArray(contexts) || contexts.length === 0) return null;
    if (!seasonRef) return contexts[0];

    const target = normalizeRef(seasonRef);
    if (!target) return contexts[0];

    const exact = contexts.find((context) => {
      const refs = [
        context.name,
        context.code,
        context.id,
        context.legacy_season_id,
        context.global_season_id,
        context.team_season_id
      ].map(normalizeRef).filter(Boolean);

      return refs.includes(target);
    });

    if (exact) return exact;

    // Permite compatibilidad con nombres legacy como "2025 - 2026"
    // frente al nombre global "2025/2026".
    const partial = contexts.find((context) => {
      const refs = [context.name, context.code].map(normalizeRef).filter(Boolean);
      return refs.some(ref => ref.includes(target) || target.includes(ref));
    });

    return partial || contexts[0];
  }

  async listRoster(teamSeasonId, { status = null } = {}) {
    if (!teamSeasonId) return [];
    return this.rosters.listByTeamSeason(teamSeasonId, { status });
  }

  async listUserMemberships(userId, { status = "ACTIVE" } = {}) {
    if (!userId) return [];
    return this.memberships.listByUser(userId, { status });
  }
}

export default SeasonContextService;
