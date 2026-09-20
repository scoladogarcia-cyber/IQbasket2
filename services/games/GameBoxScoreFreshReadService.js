/**
 * @fileoverview Lectura coherente del acta inmediatamente después de finalizar un partido en vivo.
 * @description Consulta exclusivamente las estadísticas del partido solicitado bajo RLS.
 * Actualiza solo su proyección en memoria: no guarda, finaliza ni modifica datos de Supabase.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {{supabase: object, dataStore: object, gameId: string}} dependencies
 * @returns {Promise<boolean>} true si se refrescó un partido presente en el contexto actual.
 */
export async function refreshGameBoxScore({ supabase, dataStore, gameId }) {
  // El modo sin cliente (offline / test aislado) mantiene el comportamiento
  // anterior, sin validar ni consultar IDs sintéticos de los tests.
  if (!supabase?.from || !dataStore?.getGames || !dataStore?.getPlayerGameStats) return false;
  const id = String(gameId || "").trim();
  if (!UUID.test(id)) throw new Error("Identificador del partido inválido.");

  // Un enlace delegado o externo que no pertenece al contexto local se resuelve
  // mediante el snapshot autorizado del flujo existente, sin ampliar acceso.
  const game = (dataStore.getGames() || []).find(row => String(row.id) === id);
  if (!game) return false;

  const { data, error } = await supabase
    .from("player_game_stats")
    .select("*")
    .eq("game_id", id);
  if (error || !Array.isArray(data)) {
    throw new Error("No se pudo recuperar el acta actualizada. No se han modificado los datos del partido.");
  }

  // Ante un marcador con puntos, una respuesta vacía nunca se interpreta como
  // un BoxScore a cero: podría ser un problema transitorio o de autorización.
  const hasTeamPoints = Number(game.team_score ?? game.teamScore ?? 0) > 0;
  if (hasTeamPoints && data.length === 0) {
    throw new Error("El acta no está disponible para lectura todavía. No guardes un acta vacía.");
  }

  // La consulta está limitada por game_id. Conservamos intactas todas las filas
  // de las demás temporadas y partidos; el resto de la caché no se toca.
  const existing = Array.isArray(dataStore.playerGameStats) ? dataStore.playerGameStats : [];
  const normalized = data.map(row =>
    typeof dataStore._normalizeStat === "function"
      ? dataStore._normalizeStat(row)
      : { ...row, game_id: id, gameId: id }
  );
  dataStore.playerGameStats = [
    ...existing.filter(row => String(row.game_id ?? row.gameId ?? "") !== id),
    ...normalized
  ];
  return true;
}
