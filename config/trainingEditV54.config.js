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
