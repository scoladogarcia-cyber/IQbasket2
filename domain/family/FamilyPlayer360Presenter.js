/**
 * @fileoverview Deterministic family-facing Player360 interpretation.
 * @description Converts already-authorized sporting evidence into neutral,
 * understandable language. It never infers causes, diagnoses or sensitive data.
 */
const METRICS = Object.freeze([
  { key: "points", label: "anotación", minAbs: 0.8, relative: 0.12 },
  { key: "rebounds", label: "rebote", minAbs: 0.6, relative: 0.12 },
  { key: "assists", label: "creación", minAbs: 0.4, relative: 0.12 },
  { key: "minutes", label: "participación", minAbs: 2, relative: 0.10 }
]);

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function average(rows, key) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + finite(row?.[key]), 0) / rows.length;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(finite(value) * factor) / factor;
}

function safeText(value, max = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function splitWindows(games = []) {
  const rows = Array.isArray(games) ? games.filter(Boolean) : [];
  if (rows.length < 6) return null;
  const size = Math.min(5, Math.floor(rows.length / 2));
  return { recent: rows.slice(0, size), previous: rows.slice(size, size * 2) };
}

function metricTrend(metric, recent, previous) {
  const current = average(recent, metric.key);
  const baseline = average(previous, metric.key);
  const delta = current - baseline;
  const relative = Math.abs(baseline) > 0.01 ? delta / Math.abs(baseline) : 0;
  const meaningful = Math.abs(delta) >= metric.minAbs && Math.abs(relative) >= metric.relative;
  const direction = !meaningful ? "STABLE" : delta > 0 ? "UP" : "DOWN";
  return {
    key: metric.key,
    label: metric.label,
    current: round(current),
    previous: round(baseline),
    delta: round(delta),
    direction
  };
}

function threePointTrend(recent, previous) {
  const made = rows => rows.reduce((sum, row) => sum + finite(row?.fg3_made), 0);
  const attempted = rows => rows.reduce((sum, row) => sum + finite(row?.fg3_attempted), 0);
  const recentAttempts = attempted(recent);
  const previousAttempts = attempted(previous);
  if (recentAttempts < 5 || previousAttempts < 5) return null;
  const current = made(recent) / recentAttempts * 100;
  const baseline = made(previous) / previousAttempts * 100;
  const delta = current - baseline;
  return {
    key: "three_point_pct",
    label: "eficacia de 3",
    current: round(current),
    previous: round(baseline),
    delta: round(delta),
    direction: Math.abs(delta) < 5 ? "STABLE" : delta > 0 ? "UP" : "DOWN"
  };
}

function trendSentence(trend) {
  if (trend.direction === "UP") {
    return `${trend.label}: sube de ${trend.previous} a ${trend.current}.`;
  }
  if (trend.direction === "DOWN") {
    return `${trend.label}: baja de ${trend.previous} a ${trend.current}.`;
  }
  return `${trend.label}: se mantiene estable (${trend.current}).`;
}
export function presentFamilyPlayer360(snapshot = {}) {
  const games = Array.isArray(snapshot?.recent_games) ? snapshot.recent_games : [];
  const windows = splitWindows(games);
  const objective = snapshot?.objective || null;
  const evaluations = Array.isArray(snapshot?.shared_evaluations)
    ? snapshot.shared_evaluations
    : [];

  const trends = windows
    ? [
        ...METRICS.map(metric => metricTrend(metric, windows.recent, windows.previous)),
        threePointTrend(windows.recent, windows.previous)
      ].filter(Boolean)
    : [];

  const rising = trends.filter(item => item.direction === "UP");
  const falling = trends.filter(item => item.direction === "DOWN");
  const stable = trends.filter(item => item.direction === "STABLE");
  const latestEvaluation = evaluations[0] || null;

  const whatHappened = games.length
    ? `Hay ${games.length} partidos recientes disponibles para contextualizar la evolución.`
    : "Todavía no hay suficientes partidos registrados para resumir la evolución.";

  const evolution = windows
    ? [...rising, ...falling, ...stable].slice(0, 4).map(trendSentence)
    : ["Necesitamos al menos 6 partidos comparables para mostrar una tendencia responsable."];

  const meaning = [];
  if (rising.length) meaning.push(`La señal más positiva ahora está en ${rising[0].label}.`);
  if (falling.length) meaning.push(`Conviene observar ${falling[0].label} en los próximos partidos sin asumir una causa.`);
  if (!meaning.length && windows) meaning.push("El rendimiento reciente es relativamente estable en los indicadores observados.");
  if (latestEvaluation?.summary) meaning.push(safeText(latestEvaluation.summary, 220));

  const next = [];
  if (objective?.title) next.push(`Objetivo activo: ${safeText(objective.title, 160)}.`);
  if (latestEvaluation?.development_priorities) {
    next.push(`Prioridad compartida por el staff: ${safeText(latestEvaluation.development_priorities, 220)}`);
  }
  if (!next.length) next.push("Mantener el foco en un objetivo observable y revisarlo tras los próximos partidos/entrenamientos.");

  return {
    enoughEvidence: Boolean(windows),
    whatHappened,
    evolution,
    meaning,
    next,
    trends,
    objective,
    latestEvaluation
  };
}

export default presentFamilyPlayer360;
