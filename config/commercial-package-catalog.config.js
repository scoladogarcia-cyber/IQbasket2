/**
 * Public product positioning, not a security policy or billing catalogue.
 * Plan codes reference existing server plans. Never use this data to authorize,
 * charge, create subscriptions or infer the effective entitlements of a user.
 */
const offer = (id, name, planCodes, features, rollout) => Object.freeze({
  id, name, planCodes: Object.freeze(planCodes), features: Object.freeze(features), rollout
});
const audience = (id, name, buyer, offers) => Object.freeze({
  id, name, buyer, offers: Object.freeze(offers)
});
export const COMMERCIAL_PACKAGE_CATALOG = Object.freeze([
  audience("TEAMS", "IQBasquet Equipos", "Equipo, club o academia", [
    offer("TEAM_STARTER", "Equipo Esencial", ["TEAM_STARTER"],
      ["Plantilla y partidos", "Registro en directo y acta", "Estadísticas básicas", "Gestión de entrenamientos"], "DRAFT"),
    offer("TEAM_PRO", "Equipo Pro", ["TEAM_PRO"],
      ["Analítica avanzada", "Exportación e informes", "Objetivos y tecnificación", "Seguimiento deportivo"], "DRAFT"),
    offer("CLUB_ACADEMY", "Club y academia", ["CLUB", "ACADEMY"],
      ["Gestión multiequipo", "Gobernanza y auditoría", "Analítica de entrenamiento y benchmarking", "Integraciones según plan"], "DRAFT")
  ]),
  audience("COACHES", "IQBasquet Entrenadores", "Entrenador con acceso deportivo autorizado", [
    offer("COACH_PRO", "Entrenador Pro", ["TEAM_PRO", "CLUB", "ACADEMY"],
      ["Análisis de partidos", "Planificación y tecnificación", "Reporting", "Scouting Pro como línea de ampliación"], "TEAM_FUNDED"),
    offer("COACH_INDEPENDENT", "Entrenador independiente", [],
      ["Licencia personal portable", "Scouting y biblioteca profesional"], "DESIGN_REQUIRED")
  ]),
  audience("PLAYERS", "IQBasquet Jugadores", "Jugador o representante legal", [
    offer("PLAYER_PLUS", "Jugador Plus", ["FAMILY"],
      ["Pasaporte del jugador", "Player 360 y tendencias", "Objetivos y plan de desarrollo", "Tecnificación e informes"], "DRAFT"),
    offer("PLAYER_INTELLIGENCE", "Inteligencia y acompañamiento", ["FAMILY_PRO"],
      ["Interpretación longitudinal", "Plan semanal", "Benchmarking contextual", "IA sujeta a piloto y consentimiento"], "GATED")
  ]),
  audience("FAMILIES", "IQBasquet Familias", "Familia o tutor autorizado", [
    offer("FAMILY_INCLUDED", "Acceso familiar incluido", ["FAMILY_FREE"],
      ["Perfil e historial", "Estadísticas básicas", "Cronología básica", "Un jugador"], "EXISTING_FREE"),
    offer("FAMILY_PLUS", "Acompañamiento ampliado", ["FAMILY", "FAMILY_PRO"],
      ["Seguimiento de varios jugadores según plan", "Informes y evolución", "Acceso familiar autorizado"], "DRAFT")
  ])
]);
/** Optional cross-product expansion: not represented as purchasable yet. */
export const COMMERCIAL_EXTENSIONS = Object.freeze([
  "Scouting Pro", "Biblioteca de vídeos, cursos y guías", "Productos de tecnificación",
  "IA por perfil con cuotas y controles de privacidad"
]);
export const COMMERCIAL_ROLLOUT_LABELS = Object.freeze({
  DRAFT: "Diseño comercial · sin venta",
  TEAM_FUNDED: "Vía licencia de equipo/club · sin venta nueva",
  DESIGN_REQUIRED: "Requiere licencia personal y modelo de datos",
  GATED: "Bloqueado hasta aprobar piloto, privacidad y coste",
  EXISTING_FREE: "Plan gratuito existente"
});
