/**
 * @fileoverview Explainable functional-role derivation for Player Passport.
 * @description Roles are derived from observed attribute combinations and coverage.
 * They are not positions and never create an overall player rating.
 */
const ROLE_DEFINITIONS = Object.freeze([
  { code:"PRIMARY_CREATOR", label:"Generador primario", attributes:["TEC-BOT-03","TEC-BOT-06","TEC-BOT-07","TAC-OF-02","TAC-OF-04","TAC-OF-08","TAC-OF-11","TAC-OF-12"] },
  { code:"SECONDARY_CREATOR", label:"Generador secundario", attributes:["TAC-OF-06","TEC-PAS-03","TEC-FIN-03","TEC-TIR-04"] },
  { code:"OFFENSIVE_CONNECTOR", label:"Conector ofensivo", attributes:["TEC-PAS-03","TEC-PAS-06","TAC-OF-04","TAC-OF-10","COL-04"] },
  { code:"SPACER", label:"Tirador / spacer", attributes:["TEC-TIR-02","TEC-TIR-03","TEC-TIR-06","TAC-OF-05","TAC-OF-03"] },
  { code:"MOVEMENT_SHOOTER", label:"Tirador en movimiento", attributes:["TEC-TIR-05","TAC-OF-09","TEC-TIR-02","TAC-OF-10"] },
  { code:"RIM_FINISHER", label:"Finalizador de aro", attributes:["TEC-FIN-01","TEC-FIN-02","TEC-FIN-03","TEC-FIN-04","TEC-FIN-05","TEC-FIN-06"] },
  { code:"TRANSITION_THREAT", label:"Amenaza de transición", attributes:["TEC-BOT-03","TEC-FIN-06","TAC-OF-07","MEN-09"] },
  { code:"ADVANTAGE_ATTACKER", label:"Atacante de ventajas", attributes:["TAC-OF-02","TAC-OF-06","TEC-FIN-03","TEC-PAS-03","TAC-OF-11"] },
  { code:"POA_DEFENDER", label:"Defensor POA", attributes:["DEF-02","DEF-03","DEF-04","DEF-05","DEF-10"] },
  { code:"SWITCH_DEFENDER", label:"Defensor versátil / switch", attributes:["DEF-13","DEF-02","DEF-03","DEF-11","DEF-01"] },
  { code:"HELP_DEFENDER", label:"Defensor de ayudas", attributes:["DEF-06","DEF-07","DEF-08","DEF-09","DEF-17","DEF-16"] },
  { code:"REBOUNDER", label:"Reboteador / finalizador de posesión", attributes:["DEF-14","DEF-15","DEF-17","COL-06"] },
  { code:"DEFENSIVE_ORGANIZER", label:"Organizador defensivo", attributes:["DEF-16","DEF-17","DEF-08","DEF-11","DEF-12"] },
  { code:"TWO_WAY_CONNECTOR", label:"Conector bidireccional", attributes:["COL-04","TAC-OF-10","TEC-PAS-03","DEF-07","DEF-16","MEN-09"] }
]);

export function deriveFunctionalRoles(latestScores, { minimumCoverage = 0.6 } = {}) {
  const scoreMap = latestScores instanceof Map ? latestScores : new Map();
  return ROLE_DEFINITIONS.map(role => {
    const observed = role.attributes
      .map(code => ({ code, value: Number(scoreMap.get(code)?.score) }))
      .filter(x => Number.isFinite(x.value));
    const coverage = role.attributes.length ? observed.length / role.attributes.length : 0;
    const score = coverage >= minimumCoverage
      ? observed.reduce((sum,x) => sum + x.value, 0) / observed.length
      : null;
    return {
      ...role,
      score,
      coverage,
      status: score === null ? "INSUFFICIENT_DATA" : "AVAILABLE",
      evidence: observed
    };
  }).sort((a,b) => (b.score ?? -1) - (a.score ?? -1));
}

export { ROLE_DEFINITIONS };
