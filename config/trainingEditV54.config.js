/** Human-readable training categories and safe, non-diagnostic exceptions. */
export const TRAINING_TYPE_OPTIONS = Object.freeze([
  ['GENERAL','General'],['TECHNICAL','Técnico'],['TACTICAL','Táctico'],
  ['PHYSICAL','Físico'],['SHOOTING','Tiro'],['SCRIMMAGE','Juego / partido'],
  ['RECOVERY','Recuperación'],['OTHER','Otro']
]);
export const BLOCK_PARTICIPATION_OPTIONS = Object.freeze([
  ['NONE','Sin detalle registrado'],['FULL','Bloque completo'],
  ['PARTIAL','Solo parte del bloque'],['NOT_ATTENDED','No participó en este bloque']
]);
export const BLOCK_EXCEPTION_OPTIONS = Object.freeze([
  ['','Sin motivo especificado'],['LATE','Llegó tarde'],['EARLY','Salió antes'],
  ['LIMITED','Participación limitada'],['OTHER','Otra circunstancia']
]);


/**
 * Training UX V55: stable, multi-select sporting focus taxonomy.
 * These codes are intentionally few and broad so a coach can register a normal
 * session with a handful of taps. They are persisted in
 * training_sessions.metadata.training_focus_codes and are suitable for
 * longitudinal descriptive analysis. They do not imply causality.
 */
export const TRAINING_FOCUS_OPTIONS = Object.freeze([
  Object.freeze({ code: "TECHNICAL", label: "Técnica", icon: "🏀" }),
  Object.freeze({ code: "SHOOT_FINISH", label: "Tiro / finalización", icon: "🎯" }),
  Object.freeze({ code: "TACTICAL_TEAM", label: "Táctica / colectivo", icon: "🧠" }),
  Object.freeze({ code: "GAME_5V5", label: "Situaciones de juego / 5c5", icon: "⚔️" }),
  Object.freeze({ code: "PHYSICAL", label: "Físico", icon: "💪" }),
  Object.freeze({ code: "RECOVERY_PREMATCH", label: "Recuperación / prepartido", icon: "🔄" })
]);

export const TRAINING_FOCUS_CODES = Object.freeze(
  TRAINING_FOCUS_OPTIONS.map(item => item.code)
);

export const TRAINING_FOCUS_LABELS = Object.freeze(
  Object.fromEntries(TRAINING_FOCUS_OPTIONS.map(item => [item.code, item.label]))
);
