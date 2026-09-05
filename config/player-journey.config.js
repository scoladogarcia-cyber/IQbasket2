/**
 * @fileoverview Player-only journey and micro-challenge product contract.
 * @description Defines process-oriented gamification without rankings, streak
 * punishment, variable rewards or wellness/health triggers.
 */

export const PLAYER_JOURNEY_VERSION = "PLAYER_JOURNEY_V1";

export const PLAYER_JOURNEY_STAGE = Object.freeze({
  EXPLORING: "EXPLORING",
  BUILDING: "BUILDING",
  CONSOLIDATING: "CONSOLIDATING",
  OWNING_PROCESS: "OWNING_PROCESS"
});

export const PLAYER_JOURNEY_STAGE_LABEL = Object.freeze({
  [PLAYER_JOURNEY_STAGE.EXPLORING]: "Empieza tu camino",
  [PLAYER_JOURNEY_STAGE.BUILDING]: "Construyendo hábitos de mejora",
  [PLAYER_JOURNEY_STAGE.CONSOLIDATING]: "Consolidando tu proceso",
  [PLAYER_JOURNEY_STAGE.OWNING_PROCESS]: "Liderando tu desarrollo"
});

export const PLAYER_JOURNEY_SAFETY = Object.freeze({
  playerOnly: true,
  oneNewChallengePerWeek: true,
  leaderboardEnabled: false,
  socialComparisonEnabled: false,
  loginStreakEnabled: false,
  variableRewardsEnabled: false,
  wellnessTriggersAllowed: false,
  healthTriggersAllowed: false,
  masteryClaimFromSelfCompletion: false
});

export const PLAYER_MICRO_CHALLENGE_CATALOG = Object.freeze([
  Object.freeze({
    code: "WEAK_HAND_INTENT",
    category: "TECHNICAL",
    title: "Mano no dominante con intención",
    description: "Busca durante tu próxima sesión tres situaciones reales en las que puedas usar tu mano no dominante con una intención clara.",
    successCriterion: "Al terminar, identifica una situación que hayas resuelto mejor y coméntala con tu entrenador.",
    sortOrder: 10
  }),
  Object.freeze({
    code: "BALL_PROTECTION",
    category: "TECHNICAL",
    title: "Protege mejor el balón",
    description: "Pon atención a tres situaciones con presión defensiva y observa cómo usas cuerpo, distancia y bote para proteger el balón.",
    successCriterion: "Elige una situación en la que hayas mantenido mejor el control y explica qué hiciste.",
    sortOrder: 20
  }),
  Object.freeze({
    code: "FINISHING_CHOICE",
    category: "TECHNICAL",
    title: "Elige mejor cerca del aro",
    description: "Observa tres finalizaciones y céntrate en reconocer por qué elegiste ese recurso y no otro.",
    successCriterion: "Identifica una buena elección y una alternativa que quieras probar en otra ocasión.",
    sortOrder: 30
  }),
  Object.freeze({
    code: "SHOT_SELECTION",
    category: "TECHNICAL",
    title: "Mejor selección de tiro",
    description: "En la próxima sesión, identifica tres tiros y valora si estabas equilibrado, con espacio y dentro de una buena decisión de juego.",
    successCriterion: "Escoge el tiro mejor seleccionado y explica qué condiciones lo hicieron bueno.",
    sortOrder: 40
  }),
  Object.freeze({
    code: "PASSING_WINDOW",
    category: "TACTICAL",
    title: "Ve la ventana de pase",
    description: "Detecta tres momentos en los que aparezca una ventaja de pase, incluso si finalmente no recibes o no pasas el balón.",
    successCriterion: "Recuerda una ventana de pase y comenta qué señal del juego te permitió verla.",
    sortOrder: 50
  }),
  Object.freeze({
    code: "DECISION_SPEED",
    category: "TACTICAL",
    title: "Decide con claridad",
    description: "Identifica tres recepciones y observa cuánto tardas en leer si debes tirar, pasar o atacar.",
    successCriterion: "Elige una decisión clara y explica qué información viste antes de actuar.",
    sortOrder: 60
  }),
  Object.freeze({
    code: "DEFENSIVE_FOOTWORK",
    category: "TACTICAL",
    title: "Primero los pies en defensa",
    description: "Observa tres acciones defensivas y céntrate en tu colocación y desplazamiento antes de intentar recuperar el balón.",
    successCriterion: "Identifica una acción en la que tu posición te ayudó a defender mejor.",
    sortOrder: 70
  }),
  Object.freeze({
    code: "COURT_COMMUNICATION",
    category: "TACTICAL",
    title: "Haz visible tu comunicación",
    description: "Busca tres situaciones en las que una comunicación breve pueda ayudar a un compañero antes o durante la acción.",
    successCriterion: "Recuerda una comunicación útil y qué cambió o pudo cambiar gracias a ella.",
    sortOrder: 80
  })
]);

export default Object.freeze({
  version: PLAYER_JOURNEY_VERSION,
  stages: PLAYER_JOURNEY_STAGE,
  safety: PLAYER_JOURNEY_SAFETY,
  catalog: PLAYER_MICRO_CHALLENGE_CATALOG
});
