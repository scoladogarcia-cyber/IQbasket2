/**
 * @fileoverview Comparación del partido con origen explícito y sin inventar intentos.
 * @description El rival no tiene acta individual: usa agregados persistidos y,
 * si faltan, recuentos de eventos opp_pts/opp_oreb/opp_dreb del partido.
 * Los tiros libres no se representan como tiros de campo ni en el mapa.
 */
const numeric = value => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const stored = (row, key) => numeric(row?.[key]);
const opponentAction = event => String(event?.action_type ?? event?.action ?? "").trim().toLowerCase();

/** @returns {{opponent:object,warnings:string[]}} Datos y procedencia para UI y PDF. */
export function buildOpponentGameComparison({ game = {}, teamStats = null, events = [], eventsAvailable = true } = {}) {
  const gameId = String(game.id ?? "");
  const allowedEvents = eventsAvailable && Array.isArray(events)
    ? events.filter(event => String(event?.game_id ?? event?.gameId ?? "") === gameId)
    : [];
  const pointsEvents = allowedEvents.filter(event => opponentAction(event) === "opp_pts" && [1, 2, 3].includes(numeric(event.points)));
  const scoreFromEvents = pointsEvents.reduce((sum, event) => sum + Number(event.points), 0);
  const markerScore = numeric(game.opponent_score ?? game.opponentScore ?? game.opp_score);
  const scoreComplete = eventsAvailable && pointsEvents.length > 0 && markerScore !== null && scoreFromEvents === markerScore;
  const counts = {
    fg2m: pointsEvents.filter(event => Number(event.points) === 2).length,
    fg3m: pointsEvents.filter(event => Number(event.points) === 3).length,
    ftm: pointsEvents.filter(event => Number(event.points) === 1).length,
    offReb: allowedEvents.filter(event => opponentAction(event) === "opp_oreb").length,
    defReb: allowedEvents.filter(event => opponentAction(event) === "opp_dreb").length
  };
  const warnings = [];
  if (pointsEvents.length && !scoreComplete) warnings.push(`Los eventos rivales suman ${scoreFromEvents} puntos y el marcador indica ${markerScore ?? "N/D"}. Los aciertos de eventos son parciales.`);
  const choose = (column, fallback, evidence) => {
    const value = stored(teamStats, column);
    if (value !== null) return { value, source: "agregado guardado" };
    return evidence ? { value: fallback, source: "eventos registrados" } : { value: null, source: "no disponible" };
  };
  const opponent = {
    points: { value: markerScore, source: "marcador" },
    fg2m: choose("opp_fg2_made", counts.fg2m, pointsEvents.length > 0),
    fg2a: choose("opp_fg2_attempted", null, false),
    fg3m: choose("opp_fg3_made", counts.fg3m, pointsEvents.length > 0),
    fg3a: choose("opp_fg3_attempted", null, false),
    ftm: choose("opp_ft_made", counts.ftm, pointsEvents.length > 0),
    fta: choose("opp_ft_attempted", null, false),
    offReb: choose("opp_off_reb", counts.offReb, counts.offReb > 0),
    defReb: choose("opp_def_reb", counts.defReb, counts.defReb > 0),
    turnovers: choose("opp_turnovers", allowedEvents.filter(event => opponentAction(event) === "opp_tov").length,
      allowedEvents.some(event => opponentAction(event) === "opp_tov")),
    scoreComplete,
    observedPointEvents: pointsEvents.length,
    recordedPoints: scoreFromEvents
  };
  // Sólo si están documentados los dos componentes: nunca 0 por ausencia.
  const add = (a, b) => a.value === null || b.value === null
    ? { value: null, source: "no disponible" }
    : { value: a.value + b.value, source: a.source === b.source ? a.source : "fuentes combinadas" };
  const percent = (made, attempts) => made.value === null || attempts.value === null || attempts.value <= 0
    ? { value: null, source: "no disponible" }
    : { value: Number((made.value * 100 / attempts.value).toFixed(1)), source: "calculado" };
  opponent.rebounds = add(opponent.offReb, opponent.defReb);
  opponent.fgm = add(opponent.fg2m, opponent.fg3m);
  opponent.fga = add(opponent.fg2a, opponent.fg3a);
  opponent.fg2pct = percent(opponent.fg2m, opponent.fg2a);
  opponent.fg3pct = percent(opponent.fg3m, opponent.fg3a);
  opponent.ftpct = percent(opponent.ftm, opponent.fta);
  opponent.fgpct = percent(opponent.fgm, opponent.fga);
  if (!teamStats && !pointsEvents.length) warnings.push("No hay agregados ni eventos suficientes del rival para comparar los lanzamientos.");
  if (opponent.fga.value === null) warnings.push("Los intentos de campo del rival no están disponibles; sus porcentajes de tiro figuran como N/D.");
  if (opponent.rebounds.value === null) warnings.push("El total de rebotes del rival no está disponible; se muestran los recuentos que existan sin completar con ceros.");
  return { opponent, warnings };
}
