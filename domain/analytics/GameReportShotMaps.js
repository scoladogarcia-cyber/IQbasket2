/**
 * @fileoverview Cartas de tiro del informe final, por equipo y por partido.
 * @description No atribuye fallos al rival cuando la captura solo contiene sus canastas.
 */
import { resolveShotMade } from "./ShotOutcomeResolver.js";

const coordinate = (row, key, alias) => {
  const raw = row?.[key] ?? row?.[alias] ?? row?.coordinates?.[key === "coord_x" ? "x" : "y"];
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
};

/** @returns {{our: object, opponent: object}} Separación semántica sin modificar eventos. */
export function buildGameShotMaps(events = [], gameId = null) {
  const our = [], opponent = [];
  let ownShots = 0, opponentScores = 0, ownLocated = 0, opponentLocated = 0;
  for (const event of Array.isArray(events) ? events : []) {
    if (gameId && String(event.game_id ?? event.gameId) !== String(gameId)) continue;
    const action = String(event.action_type ?? event.action ?? event.event_type ?? "").toLowerCase();
    const isOpponent = action.startsWith("opp_") || event.is_opponent === true || event.isOpponent === true;
    const ownShot = /^(fg[23]_(made|attempted)|t[23]_(made|attempted))$/.test(action)
      || (!isOpponent && /(?:shot|tiro|triple)/.test(action));
    const opponentScore = isOpponent && (/^opp_pts$/.test(action) || /opp_.*(?:made|scored|canasta)/.test(action));
    if (!ownShot && !opponentScore) continue;
    const x = coordinate(event, "coord_x", "coordX");
    const y = coordinate(event, "coord_y", "coordY");
    const made = resolveShotMade(event);
    if (isOpponent) {
      opponentScores++;
      if (x !== null && y !== null) {
        opponent.push({ x, y, made: true, points: Number(event.points || 0) });
        opponentLocated++;
      }
    } else {
      ownShots++;
      if (x !== null && y !== null) {
        our.push({ x, y, made, points: Number(event.points || 0) });
        ownLocated++;
      }
    }
  }
  return {
    our: { shots: our, observed: ownShots, located: ownLocated, made: our.filter(shot => shot.made).length,
      coverage: ownShots ? `${ownLocated}/${ownShots} tiros localizados` : "No hay tiros registrados",
      completeOutcomes: ownShots > 0 && ownLocated === ownShots },
    opponent: { shots: opponent, observed: opponentScores, located: opponentLocated, made: opponentLocated,
      coverage: opponentScores ? `${opponentLocated}/${opponentScores} canastas localizadas` : "No hay canastas localizadas",
      completeOutcomes: false,
      note: "Mapa de canastas registradas del rival; los tiros fallados no se capturan de forma completa. No se puede calcular su acierto por zonas." }
  };
}
