import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderFullGameBoxScoreTables } from "../views/reports/FullGameBoxScoreTables.js";

/** Regression: missing quarter data must not masquerade as an actual 0–0. */
const gamesView = readFileSync(new URL("../views/GameLiveEditorView.js",import.meta.url), "utf8");
assert.match(gamesView, /period_number \?\? period\.periodNumber/);
assert.match(gamesView, /return "—"/);
assert.doesNotMatch(gamesView, /const quarterScore = index => quarters\[index\]/);

/** Regression: an empty capture payload must not delete persisted quarters. */
const service = readFileSync(new URL("../services/games/GameCaptureDelegationService.js",import.meta.url), "utf8");
assert.match(service, /Array\.isArray\(periods\) && periods\.length > 0/);
assert.match(service, /total\.team !== Number\(teamScore\)/);

const players = [
  {id:"played",jersey:4,first_name:"Jugó",last_name:"Test"},
  {id:"dnp",jersey:12,first_name:"NoJugó",last_name:"Test"},
  {id:"missingMinute",jersey:13,first_name:"Revisar",last_name:"Minutos"}
];
const stats = [
  {player_id:"played",minutes:20,starter:true,fg2_attempted:1,fg2_made:0,fg3_attempted:0,fg3_made:0,ft_attempted:0,ft_made:0},
  {player_id:"dnp",minutes:0,starter:false},
  {player_id:"missingMinute",minutes:0,starter:false,fg2_attempted:1,fg2_made:1}
];
const report = renderFullGameBoxScoreTables({game:{opponent:"Prueba"},players,stats});
const mainActa = report.slice(report.indexOf("Acta principal"),report.indexOf("No participaron:"));
assert.match(mainActa,/Jugó Test/);
assert.match(mainActa,/Revisar Minutos/,"Una acción real con minutos 0 requiere revisión, no ocultarla");
assert.doesNotMatch(mainActa,/NoJugó Test/);
assert.match(report,/No participaron:[\s\S]*NoJugó Test/);
assert.match(report,/0\.0%/,"0 aciertos de 1 intento debe ser 0%");
assert.match(report,/—/,"0 intentos da porcentaje indefinido, no 0%");
assert.match(report,/N\/D/,"Los opcionales no capturados siguen diferenciados");
assert.match(report,/TOTAL EQUIPO/);

console.log("V64 quarters and DNP report regression OK");
