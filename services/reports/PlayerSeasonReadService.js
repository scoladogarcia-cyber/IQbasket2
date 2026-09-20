/**
 * @fileoverview Lectura actualizada de actas individuales para PDF y vista de jugador.
 * @description Comprueba permiso por jugador y equipo/temporada ANTES de consultar;
 * Supabase aplica además RLS. Solo SELECT, no modifica la base de datos.
 */
import { ReportType } from "../../security/ReportAccessPolicy.js";

const id = value => String(value ?? "");
const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

/**
 * @param {{supabase:object,policy:object,context:object,players:object[],games:object[]}} args
 * @returns {Promise<object[]>} Solo filas de jugadores y partidos autorizados.
 */
export async function loadAuthorizedPlayerSeasonStats({ supabase, policy, context, players = [], games = [] } = {}) {
  if (!supabase?.from || !policy?.canView || !context?.teamId || !context?.teamSeasonId) {
    throw new Error("No se puede validar el ámbito del informe individual.");
  }
  const teamId = id(context.teamId);
  const seasonId = id(context.teamSeasonId);
  if (!Array.isArray(players) || !Array.isArray(games)) throw new Error("Selección de jugador o temporada inválida.");
  const allowedPlayers = players.filter(player => player?.id && policy.canView(ReportType.PLAYER_STATS, {
    ...context, playerId: player.id, playerTeamId: player.team_id || player.teamId || context.teamId
  }));
  if (allowedPlayers.length !== players.length) throw new Error("Hay jugadores sin permiso de consulta; se cancela el informe.");
  const playerIds = [...new Set(allowedPlayers.map(player => id(player.id)))];
  const gameIds = [];
  for (const game of games) {
    if (!game?.id || id(game.team_id || game.teamId) !== teamId
      || (game.team_season_id || game.teamSeasonId) && id(game.team_season_id || game.teamSeasonId) !== seasonId) {
      throw new Error("El partido está fuera del equipo o temporada activos.");
    }
    gameIds.push(id(game.id));
  }
  const uniqueGames = [...new Set(gameIds)];
  if (uniqueGames.length !== gameIds.length) throw new Error("Partidos duplicados en la selección.");
  if (!uniqueGames.length || !playerIds.length) return [];
  const permittedGames = new Set(uniqueGames);
  const permittedPlayers = new Set(playerIds);
  const records = [];
  // Fragmentar evita URLs de consulta demasiado grandes. Paginar impide el
  // truncamiento silencioso de Supabase al superar su límite de filas.
  for (const batchGames of chunks(uniqueGames, 40)) {
    for (const batchPlayers of chunks(playerIds, 20)) {
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("player_game_stats")
          .select("*")
          .in("game_id", batchGames)
          .in("player_id", batchPlayers)
          .range(offset, offset + 999);
        if (error || !Array.isArray(data)) throw new Error("No se pudieron recuperar las estadísticas individuales actualizadas.");
        for (const row of data) {
          if (!permittedGames.has(id(row.game_id ?? row.gameId)) || !permittedPlayers.has(id(row.player_id ?? row.playerId))) {
            throw new Error("La lectura devolvió datos fuera del ámbito autorizado.");
          }
          records.push(row);
        }
        if (data.length < 1000) break;
      }
    }
  }
  return records;
}

/** Actualiza exclusivamente la proyección local de los pares jugador/partido leídos. */
export function replaceScopedPlayerStatsInMemory(dataStore, { players, games, stats }) {
  if (!Array.isArray(dataStore?.playerGameStats) || !Array.isArray(stats)) throw new Error("Caché de estadísticas no inicializada.");
  const playerIds = new Set(players.map(row => id(row.id)));
  const gameIds = new Set(games.map(row => id(row.id)));
  if (stats.some(row => !playerIds.has(id(row.player_id ?? row.playerId)) || !gameIds.has(id(row.game_id ?? row.gameId)))) {
    throw new Error("Se rechazan estadísticas ajenas al ámbito de la caché.");
  }
  const retained = dataStore.playerGameStats.filter(row => !playerIds.has(id(row.player_id ?? row.playerId)) || !gameIds.has(id(row.game_id ?? row.gameId)));
  dataStore.playerGameStats = [...retained, ...stats.map(row => typeof dataStore._normalizeStat === "function" ? dataStore._normalizeStat(row) : row)];
}
