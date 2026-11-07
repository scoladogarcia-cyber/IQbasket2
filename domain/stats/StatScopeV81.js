/**
 * @fileoverview Identidad y ámbito canónicos de estadísticas.
 * @description Evita mezclar temporadas, partidos y jugadores al leer una
 * caché compartida. No modifica los datos ni inventa partidas estadísticas.
 */
const id = value => value === null || value === undefined ? "" : String(value);

/** Selecciona exclusivamente filas de los partidos aportados por el contexto autorizado. */
export function selectScopedPlayerStatsV81(stats = [], games = []) {
  if (!Array.isArray(stats) || !Array.isArray(games)) {
    throw new TypeError("La selección estadística requiere listas de partidos y estadísticas.");
  }
  const gameIds = new Set();
  for (const game of games) {
    const key = id(game?.id);
    if (!key || gameIds.has(key)) throw new Error("Identificador de partido ausente o duplicado.");
    gameIds.add(key);
  }
  const seen = new Set();
  const selected = [];
  for (const row of stats) {
    const gameId = id(row?.game_id ?? row?.gameId);
    if (!gameIds.has(gameId)) continue;
    const playerId = id(row?.player_id ?? row?.playerId);
    if (!playerId) throw new Error("Estadística sin identificador de jugador en el partido activo.");
    const identity = JSON.stringify([gameId,playerId]);
    if (seen.has(identity)) throw new Error("Dos filas para el mismo jugador y partido: "+identity);
    seen.add(identity);
    selected.push(row);
  }
  return selected;
}

/**
 * Compara una proyección calculada con el valor legado almacenado.
 * Nunca corrige silenciosamente datos ni presupone que el valor persistido
 * corresponde a una fórmula concreta.
 */
export function valuationDiscrepancyV81(row, computedPir) {
  const source=row?.evaluation;
  if(source===null||source===undefined||source==="") {
    return {stored:null,calculated:computedPir,mismatch:false,comparable:false};
  }
  const stored=Number(source);
  return {stored,calculated:computedPir,mismatch:!Number.isFinite(stored)||stored!==computedPir,comparable:Number.isFinite(stored)};
}
