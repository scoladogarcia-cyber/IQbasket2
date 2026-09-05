/**
 * @fileoverview Deterministic family growth/funnel engine.
 * @description Converts authorized product evidence into a respectful next-best-action.
 * No payment or authorization decision is made here.
 */
import { FamilyGrowthStage, FAMILY_GROWTH_CONFIG } from "../../config/family-growth.config.js";

const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const rows = value => Array.isArray(value) ? value : [];

function totalDevelopmentSessions(career = []) {
  return rows(career).reduce((sum, row) => sum
    + finite(row?.training_sessions)
    + finite(row?.technification_sessions), 0);
}

function lastGame(passport = {}) {
  return rows(passport.recent_games)[0] || null;
}

function topObjective(player360 = {}) {
  const objective = player360?.objective || null;
  if (!objective) return null;
  const targets = rows(objective.targets);
  const target = [...targets].sort((a, b) => finite(b?.priority_weight) - finite(a?.priority_weight))[0] || null;
  return { ...objective, primaryTarget: target };
}
function resolveStage({ games, player360Allowed, developmentPlanAllowed, aiProductsAvailable }) {
  if (games <= 0) return FamilyGrowthStage.START;
  if (games < FAMILY_GROWTH_CONFIG.minimumGamesForInsightOffer) return FamilyGrowthStage.BUILDING_HISTORY;
  if (!player360Allowed) return FamilyGrowthStage.INSIGHT_READY;
  if (!developmentPlanAllowed) return FamilyGrowthStage.DEVELOPMENT;
  return aiProductsAvailable ? FamilyGrowthStage.ACTION_LOOP : FamilyGrowthStage.DEVELOPMENT;
}

function stageCopy(stage, games) {
  switch (stage) {
    case FamilyGrowthStage.START:
      return { title: "Empieza su historia", body: "Cuando se registren partidos y sesiones, aquí aparecerá su evolución." };
    case FamilyGrowthStage.BUILDING_HISTORY:
      return { title: "Estamos construyendo una base fiable", body: `Ya hay ${games} partido${games === 1 ? "" : "s"}. Con más evidencia podremos comparar periodos con mayor sentido.` };
    case FamilyGrowthStage.INSIGHT_READY:
      return { title: "Ya hay suficiente historia para mirar la evolución", body: "Player360 puede convertir estos registros en tendencias, objetivos y prioridades comprensibles." };
    case FamilyGrowthStage.ACTION_LOOP:
      return { title: "Del análisis al plan semanal", body: "La siguiente capa convierte la evolución en prioridades recurrentes y seguimiento." };
    default:
      return { title: "Evolución en contexto", body: "Relaciona partidos, objetivos y trabajo de desarrollo sin reducir al jugador a un único resultado." };
  }
}
export function buildFamilyGrowthState({ product = {}, passport = {}, player360 = {}, story = null } = {}) {
  const games = finite(passport?.career_totals?.games);
  const sessions = totalDevelopmentSessions(passport?.career);
  const player360Allowed = Boolean(player360?.allowed);
  const developmentPlanAllowed = Boolean(player360?.access?.development_plan);
  const stage = resolveStage({
    games,
    player360Allowed,
    developmentPlanAllowed,
    aiProductsAvailable: FAMILY_GROWTH_CONFIG.aiProductsAvailable
  });
  const copy = stageCopy(stage, games);
  const objective = topObjective(player360);
  const latest = lastGame(passport);

  const offerFamily = stage === FamilyGrowthStage.INSIGHT_READY && String(product?.plan_code || "") === "FAMILY_FREE";
  const offerPro = FAMILY_GROWTH_CONFIG.aiProductsAvailable
    && player360Allowed
    && String(product?.plan_code || "") === "FAMILY";

  return {
    stage,
    games,
    developmentSessions: sessions,
    title: copy.title,
    body: copy.body,
    latestGame: latest,
    objective,
    story,
    conversion: offerFamily ? {
      visible: true, targetPlanCode: "FAMILY", placement: "INSIGHT_READY",
      title: "Desbloquea la evolución completa",
      body: "Player360 añade tendencias, objetivos y prioridades sobre el historial que ya tienes.",
      actionLabel: "Me interesa Family"
    } : offerPro ? {
      visible: true, targetPlanCode: "FAMILY_PRO", placement: "ACTION_LOOP",
      title: "Convierte la evolución en un plan recurrente",
      body: "Family Pro añadirá inteligencia y planificación semanal cuando el piloto IA esté habilitado.",
      actionLabel: "Avísame cuando esté disponible"
    } : { visible: false }
  };
}

export default buildFamilyGrowthState;
