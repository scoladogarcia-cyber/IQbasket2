/**
 * @fileoverview Deterministic family development-plan presenter.
 * @description Converts explicit sporting objectives and recent activity into a
 * transparent weekly focus. It does not infer causes or replace coaching.
 */
function rows(value) {
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  return String(value ?? "").trim();
}

function orderedTargets(objective = {}) {
  return rows(objective?.targets)
    .filter(target => clean(target?.metric_name || target?.metric_code))
    .sort((a, b) => (Number(b?.priority_weight) || 0) - (Number(a?.priority_weight) || 0))
    .slice(0, 3);
}

function focusLabel(target) {
  return clean(target?.metric_name || target?.metric_code) || "objetivo deportivo";
}

export function buildFamilyWeeklyPlan(context = {}) {
  if (!context?.allowed) {
    return Object.freeze({ allowed: false, reasonCode: context?.reason_code || "DEVELOPMENT_PLAN_NOT_INCLUDED" });
  }

  const objective = context?.objective || null;
  const targets = orderedTargets(objective || {});
  const training = rows(context?.recent_training);
  const technification = rows(context?.recent_external_development);
  const games = rows(context?.recent_games);
  const primaryFocus = targets[0] ? focusLabel(targets[0]) : null;
  const actions = [];
  const limitations = [];

  if (primaryFocus) {
    actions.push(`Mantener como foco compartido esta semana: ${primaryFocus}.`);
    if (training.length) {
      actions.push(`Observar ${primaryFocus} durante las próximas sesiones de equipo y registrar lo que realmente ocurra.`);
    }
    if (technification.length) {
      actions.push(`Conectar la tecnificación con ${primaryFocus} para que el trabajo externo y el objetivo principal hablen el mismo idioma.`);
    }
    actions.push("Revisar el foco con el entrenador al final de la semana antes de cambiar el plan.");
  } else {
    actions.push("Definir con el staff un objetivo deportivo concreto antes de añadir más prioridades.");
    limitations.push("No existe un objetivo activo compartido que permita priorizar el trabajo semanal.");
  }

  if (!training.length) limitations.push("No hay sesiones recientes de equipo visibles en este contexto.");
  if (!technification.length) limitations.push("No hay tecnificación reciente registrada para conectar con el objetivo.");
  if (!games.length) limitations.push("No hay partidos recientes suficientes para contextualizar la semana competitiva.");

  return Object.freeze({
    allowed: true,
    reasonCode: context?.reason_code || "ENTITLED",
    status: primaryFocus ? "OBJECTIVE_READY" : "NEEDS_SHARED_OBJECTIVE",
    objectiveTitle: clean(objective?.title),
    primaryFocus,
    secondaryFocuses: targets.slice(1).map(focusLabel),
    actions: Object.freeze(actions.slice(0, 4)),
    evidence: Object.freeze({
      trainingSessions: training.length,
      technificationSessions: technification.length,
      recentGames: games.length,
      objectiveTargets: targets.length
    }),
    limitations: Object.freeze(limitations),
    disclaimer: "Plan descriptivo basado en objetivos y registros existentes; no prescribe cargas ni sustituye al staff."
  });
}

export default buildFamilyWeeklyPlan;
