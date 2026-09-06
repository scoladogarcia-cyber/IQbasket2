/**
 * @fileoverview Family-facing development support guide.
 * @description Converts already-authorized development evidence into practical,
 * non-clinical support guidance. It never diagnoses causes or replaces staff.
 */
function clean(value, max = 220) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function firstUseful(values = []) {
  return values.map(value => clean(value)).find(Boolean) || "";
}

function activeCycleAction(cycle = {}) {
  const actions = Array.isArray(cycle?.current_cycle?.actions)
    ? cycle.current_cycle.actions
    : [];
  return actions.find(action => !["COMPLETED", "SKIPPED"].includes(String(action?.status || "").toUpperCase()))
    || actions[0]
    || null;
}

export function buildFamilySupportGuide({
  story = null,
  developmentContext = null,
  developmentCycle = null,
  weeklyPlan = null
} = {}) {  const cycle = developmentCycle?.current_cycle || null;
  const action = activeCycleAction(developmentCycle || {});
  const objectiveTitle = firstUseful([
    cycle?.objective_title,
    developmentContext?.objective?.title,
    story?.objective?.title,
    weeklyPlan?.objectiveTitle
  ]);
  const focus = firstUseful([
    action?.title,
    weeklyPlan?.actions?.[0],
    story?.next?.[0],
    objectiveTitle
  ]) || "Seguir acumulando evidencia y mantener una conversación tranquila sobre su experiencia.";

  const observe = [];
  if (action?.success_criterion) {
    observe.push(`Observa si aparece esta conducta: ${clean(action.success_criterion, 260)}`);
  } else if (objectiveTitle) {
    observe.push(`Observa conductas relacionadas con “${objectiveTitle}”, no solo el resultado final.`);
  } else {
    observe.push("Observa esfuerzo, decisiones y sensaciones repetidas antes de sacar conclusiones.");
  }
  if (story?.enoughEvidence) {
    observe.push("Busca patrones que se repitan durante varias sesiones o partidos.");
  } else {
    observe.push("Todavía hay poca evidencia: toma cualquier cambio como una señal a seguir, no como una conclusión.");
  }

  const supportActions = [
    `Pregunta primero cómo lo ha vivido y qué ha intentado respecto a ${objectiveTitle ? `“${objectiveTitle}”` : "su foco actual"}.`,
    "Refuerza una conducta concreta de proceso —decisión, esfuerzo, constancia o atención— antes que el marcador o una cifra aislada.",
    "Ayuda con organización, descanso y disponibilidad para cumplir el plan acordado, sin añadir tareas técnicas por tu cuenta."
  ];
  return {
    objectiveTitle: objectiveTitle || null,
    focus,
    observe,
    supportActions,
    conversationStarter: objectiveTitle
      ? `¿Qué has notado esta semana cuando has intentado mejorar “${objectiveTitle}”?`
      : "¿Qué parte de esta semana te ha hecho sentir que estás mejorando?",
    avoid: [
      "Evita convertir una estadística aislada en un juicio sobre su rendimiento o potencial.",
      "Evita compararle con compañeros: compara hábitos y decisiones con su propio punto de partida.",
      "Evita el análisis en caliente justo después de competir si no lo pide; prioriza escuchar primero."
    ],
    evidenceNote: story?.enoughEvidence
      ? "Hay evidencia suficiente para hablar de tendencias descriptivas, no de causas."
      : "La evidencia todavía es limitada; el foco debe estar en acompañar y observar."
  };
}

export default buildFamilySupportGuide;