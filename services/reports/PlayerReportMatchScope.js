/**
 * Exact match scope for individual reports. The explicit "all" option is the
 * only path to season totals; a stale or filtered-out ID must never widen scope.
 */
export function selectPlayerReportGames(games, selectedGameId = "all") {
  if (!Array.isArray(games)) throw new Error("Selección de partidos inválida.");
  const id = String(selectedGameId ?? "");
  if (id === "all") return [...games];
  if (!id) throw new Error("Selecciona un partido válido.");
  const selected = games.filter(game => String(game.id) === id);
  if (selected.length !== 1) throw new Error("El partido seleccionado no está disponible con estos filtros. Selecciona otro partido o la temporada completa.");
  return selected;
}

/** Only explicitly selected games may contribute to an individual shot chart. */
export function filterPlayerReportShots(events, games) {
  const allowed = new Set(games.map(game => String(game.id)));
  return events.filter(event => allowed.has(String(event.game_id ?? event.gameId ?? "")));
}

/** Stable selection identity, used to reject stale asynchronous exports. */
export function playerReportSelectionKey(selection) {
  return JSON.stringify([
    selection.players.map(player => String(player.id)).sort(),
    selection.games.map(game => String(game.id)).sort()
  ]);
}
