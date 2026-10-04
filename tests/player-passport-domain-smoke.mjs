import assert from "node:assert/strict";
import { ageOnDate } from "../domain/player360/PlayerAge.js";
import { normalizePassportScore, summarizePassport, latestScoresByAttribute, rightLeftAsymmetries } from "../domain/player360/PlayerPassportScoring.js";
import { deriveFunctionalRoles } from "../domain/player360/PlayerPassportRoles.js";

assert.equal(ageOnDate("2012-02-29", "2026-02-28"), 13);
assert.equal(ageOnDate("2012-02-29", "2026-03-01"), 14);
assert.equal(normalizePassportScore("NE"), null);
assert.equal(normalizePassportScore(0), null);
assert.equal(normalizePassportScore(5), 5);

const catalog = [
  {code:"TEC-BOT-01",name:"Bote D",dimension:"Técnica"},
  {code:"TEC-BOT-02",name:"Bote I",dimension:"Técnica"},
  {code:"TEC-BOT-03",name:"Velocidad",dimension:"Técnica"},
  {code:"TEC-BOT-06",name:"Ritmo",dimension:"Técnica"},
  {code:"TEC-BOT-07",name:"Manipulación",dimension:"Técnica"},
  {code:"TAC-OF-02",name:"Ventaja",dimension:"Táctica"},
  {code:"TAC-OF-04",name:"Pase",dimension:"Táctica"},
  {code:"TAC-OF-08",name:"P&R",dimension:"Táctica"},
  {code:"TAC-OF-11",name:"Crear ventaja",dimension:"Táctica"},
  {code:"TAC-OF-12",name:"Ritmo",dimension:"Táctica"}
];
const evaluations = [{
  id:"e1", evaluation_date:"2026-10-01",
  scores:[
    {metric_code:"TEC-BOT-01",score:4,metadata:{evaluation_context:"P5",evidence_count:8}},
    {metric_code:"TEC-BOT-02",score:2,metadata:{evaluation_context:"P5",evidence_count:8}},
    {metric_code:"TEC-BOT-03",score:4},{metric_code:"TEC-BOT-06",score:4},{metric_code:"TEC-BOT-07",score:4},
    {metric_code:"TAC-OF-02",score:4},{metric_code:"TAC-OF-04",score:4},{metric_code:"TAC-OF-08",score:4},
    {metric_code:"TAC-OF-11",score:4},{metric_code:"TAC-OF-12",score:4}
  ]
}];
const summary = summarizePassport(catalog,evaluations);
assert.equal(summary.ratedCount, 10);
assert.equal(summary.strengths.length, 9);
assert.equal(summary.limiters.length, 1);
assert.equal(rightLeftAsymmetries(summary.attributes)[0].difference, 2);
const roles = deriveFunctionalRoles(latestScoresByAttribute(evaluations));
assert.equal(roles.find(x=>x.code==="PRIMARY_CREATOR").status, "AVAILABLE");
assert.equal(roles.find(x=>x.code==="PRIMARY_CREATOR").score, 4);
console.log("player-passport-domain-smoke OK");
