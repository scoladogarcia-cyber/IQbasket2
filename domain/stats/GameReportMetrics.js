/**
 * @fileoverview Métricas canónicas de un partido, solo lectura y sin datos inventados.
 * @description Una misma fórmula para el informe y el BoxScore. null significa
 * no calculable; 0 es una observación válida. No utiliza usage_pct legado.
 */
import { BoxScoreCalculator } from "./BoxScoreCalculator.js";

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const take = (row, ...keys) => {
  for (const key of keys) if (row?.[key] !== undefined && row[key] !== null) return num(row[key]);
  return 0;
};
const round = (value, digits = 1) => Number(value.toFixed(digits));
const ratio = (numerator, denominator, multiplier = 100) => denominator > 0 ? round(numerator / denominator * multiplier) : null;

/** Estadísticas normalizadas con campos de procedencia originales intactos. */
export function canonicalPlayerRow(row = {}) {
  const box = BoxScoreCalculator.calculatePlayerBoxScore(row);
  const minutes = take(row, "minutes");
  const fg2m = take(row, "fg2_made", "fg2Made");
  const fg2a = take(row, "fg2_attempted", "fg2Attempted");
  const fg3m = take(row, "fg3_made", "fg3Made");
  const fg3a = take(row, "fg3_attempted", "fg3Attempted");
  const ftm = take(row, "ft_made", "ftMade");
  const fta = take(row, "ft_attempted", "ftAttempted");
  const offReb = take(row, "off_reb", "offReb", "rebounds_offensive");
  const defReb = take(row, "def_reb", "defReb", "rebounds_defensive");
  const assists = take(row, "assists");
  const turnovers = take(row, "turnovers");
  const shootingPoints = 2 * fg2m + 3 * fg3m + ftm;
  const attempts = fg2a + fg3a;
  return {
    id: String(row.player_id ?? row.playerId ?? row.id ?? ""), starter: Boolean(row.starter), minutes,
    fg2m, fg2a, fg3m, fg3a, ftm, fta, offReb, defReb, rebounds: offReb + defReb,
    assists, steals: take(row, "steals"), blocks: take(row, "blocks_made", "blocks"), turnovers,
    foulsCommitted: take(row, "fouls_committed"), foulsDrawn: take(row, "fouls_drawn", "fouls_received"),
    shootingPoints, points: shootingPoints, fga: attempts, usageActions: attempts + 0.44 * fta + turnovers,
    efg: ratio(fg2m + 1.5 * fg3m, attempts),
    ts: ratio(shootingPoints, 2 * (attempts + 0.44 * fta)),
    astTo: turnovers > 0 ? round(assists / turnovers) : null,
    pir: box.pir, usage: null
  };
}

const FIELDS = ["minutes", "points", "fg2m", "fg2a", "fg3m", "fg3a", "ftm", "fta", "offReb", "defReb", "rebounds", "assists", "steals", "blocks", "turnovers", "foulsCommitted", "foulsDrawn", "fga", "usageActions", "pir"];

/**
 * Calcula USG% con denominador de acciones del equipo en este MISMO partido.
 * Fuente: FGA + 0.44 FTA + TOV y minutos de todos los jugadores.
 * No interpreta como 0 un jugador sin minutos ni inventa posesiones rivales.
 */
export function buildGameReportMetrics(stats = [], game = {}) {
  const rows = (Array.isArray(stats) ? stats : []).map(canonicalPlayerRow);
  const totals = Object.fromEntries(FIELDS.map(field => [field, rows.reduce((sum, row) => sum + row[field], 0)]));
  const ready = totals.minutes > 0 && totals.usageActions > 0;
  for (const row of rows) {
    row.usage = ready && row.minutes > 0
      ? ratio(row.usageActions * totals.minutes, row.minutes * 5 * totals.usageActions)
      : null;
  }
  totals.efg = ratio(totals.fg2m + 1.5 * totals.fg3m, totals.fga);
  totals.ts = ratio(totals.points, 2 * (totals.fga + 0.44 * totals.fta));
  totals.astTo = totals.turnovers > 0 ? round(totals.assists / totals.turnovers) : null;
  totals.usage = ready ? 100 : null;
  // Estimación estándar basada en acciones: NO es posesión observada ni se deduce de los puntos.
  totals.estimatedPossessions = totals.fga > 0 && totals.minutes > 0
    ? round(totals.fga + 0.44 * totals.fta - totals.offReb + totals.turnovers)
    : null;
  totals.offensiveRating = totals.estimatedPossessions > 0
    ? ratio(totals.points, totals.estimatedPossessions)
    : null;
  const teamScore = game.team_score ?? game.teamScore ?? game.our_score;
  const opponentScore = game.opponent_score ?? game.opponentScore ?? game.opp_score;
  const warnings = [];
  if (teamScore !== undefined && teamScore !== null && totals.points !== num(teamScore))
    warnings.push(`Los puntos del acta (${totals.points}) no coinciden con el marcador (${num(teamScore)}).`);
  if (totals.fga > 0 && totals.minutes > 0 && Math.abs(totals.minutes - 5 * (num(game.periods_count || 4) * num(game.period_minutes || 10) + 5 * num(game.overtime_count || 0))) > 5)
    warnings.push(`Revisar minutos: el acta suma ${totals.minutes}.`);
  if (rows.some(row => row.fg2m > row.fg2a || row.fg3m > row.fg3a || row.ftm > row.fta))
    warnings.push("Hay aciertos superiores a intentos en alguna fila del acta.");
  return { rows, totals, teamScore: teamScore == null ? null : num(teamScore), opponentScore: opponentScore == null ? null : num(opponentScore), warnings,
    methodology: "USG% estimado por acciones (FGA + 0,44×FTA + pérdidas) y minutos de jugador/equipo. ORtg estimado solo para nuestro equipo. Métricas del rival sin intentos completos: N/D." };
}

/** Diferencia deliberada entre cero real y métrica no disponible. */
export const formatMetric = (value, suffix = "", digits = 1) => value === null || value === undefined || !Number.isFinite(Number(value))
  ? "N/D" : `${Number(value).toFixed(digits)}${suffix}`;
