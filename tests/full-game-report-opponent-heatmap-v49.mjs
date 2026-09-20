import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildOpponentGameComparison } from "../domain/stats/OpponentGameComparison.js";
import { buildGameShotMaps } from "../domain/analytics/GameReportShotMaps.js";
import { renderFinalGameReportV49 } from "../views/reports/GameFinalReportV49Renderer.js";

const game = { id:"game-fixture", opponent:"<script>rival</script>", venue:"Local", team_score:4, opponent_score:8,periods_count:4,period_minutes:10 };
const stats = [{ player_id:"p1",minutes:40,fg2_made:2,fg2_attempted:4,fg3_made:0,fg3_attempted:1,ft_made:0,ft_attempted:2,off_reb:2,def_reb:3,plus_minus:-4,blocks_received:1,assists:1,turnovers:1 }];
const players = [{id:"p1",first_name:"Ana",last_name:"Test",jersey:9}];
const events = [
  { game_id:game.id,period:1,action_type:"opp_pts",points:2,coord_x:40,coord_y:20,made:true },
  { game_id:game.id,period:1,action_type:"opp_pts",points:2,coord_x:51,coord_y:12,made:true },
  { game_id:game.id,period:2,action_type:"opp_pts",points:3,coord_x:25,coord_y:60,made:true },
  { game_id:game.id,period:2,action_type:"opp_pts",points:1,coord_x:null,coord_y:null,made:true },
  ...Array.from({length:8},()=>({game_id:game.id,action_type:"opp_oreb"})),
  ...Array.from({length:22},()=>({game_id:game.id,action_type:"opp_dreb"})),
  { game_id:"other",action_type:"opp_pts",points:3,coord_x:12,coord_y:80 }
];
const comparison = buildOpponentGameComparison({game,events});
assert.equal(comparison.opponent.fg2m.value,2);
assert.equal(comparison.opponent.fg3m.value,1);
assert.equal(comparison.opponent.ftm.value,1);
assert.equal(comparison.opponent.fg2a.value,null,"Sin intentos registrados no hay porcentajes rivales");
assert.equal(comparison.opponent.fg2pct.value,null);
assert.equal(comparison.opponent.offReb.value,8);
assert.equal(comparison.opponent.defReb.value,22);
assert.equal(comparison.opponent.rebounds.value,30);
assert.equal(comparison.opponent.rebounds.source,"eventos registrados");
assert.equal(comparison.opponent.scoreComplete,true);
assert.equal(buildOpponentGameComparison({game,events:[]}).opponent.rebounds.value,null);
assert.equal(buildOpponentGameComparison({game,events:[{game_id:game.id,action_type:"opp_oreb"}]}).opponent.rebounds.value,null);
const aggregate = buildOpponentGameComparison({game,events,teamStats:{opp_fg2_attempted:6,opp_fg3_attempted:3,opp_off_reb:9,opp_def_reb:10}});
assert.equal(aggregate.opponent.fg2pct.value,33.3);
assert.equal(aggregate.opponent.rebounds.value,19);
assert.equal(aggregate.opponent.rebounds.source,"agregado guardado");
const shotMap = buildGameShotMaps(events,game.id).opponent;
assert.equal(shotMap.observed,3,"El tiro libre no cuenta como tiro de campo");
assert.equal(shotMap.located,3);
assert.equal(shotMap.freeThrows,1);
assert.equal(shotMap.locatedPoints,7);
assert.equal(shotMap.shots.filter(shot=>shot.points===3).length,1);
const html = renderFinalGameReportV49({game,teamName:"JMJ Manyanet",stats,players,events,eventsAvailable:true,periods:[]});
assert.match(html,/Acta individual completa · JMJ Manyanet/);
assert.match(html,/TAP REC/);
assert.match(html,/\+\/−/);
assert.doesNotMatch(html,/Datos adicionales del partido|Detalle de lanzamientos/,"Sin captura opcional no se muestra ninguna sección avanzada vacía");
const withOptional = renderFinalGameReportV49({game,teamName:"JMJ Manyanet",stats:[{...stats[0],fg_rim_made:2}],players,events,eventsAvailable:true,periods:[]});
assert.match(withOptional,/Datos adicionales del partido/);
assert.match(withOptional,/Detalle de lanzamientos/);
assert.match(html,/Comparativa: tiros y rebotes/);
assert.match(html,/eventos registrados/);
assert.match(html,/2\/N\/D/);
assert.match(html,/desde dónde nos han metido los puntos/i);
assert.match(html,/3 canastas de campo localizadas/);
assert.match(html,/Tiros libres/);
assert.match(html,/Guía de lectura · glosario de estadísticas/);
assert.ok(html.lastIndexOf("Guía de lectura") > html.lastIndexOf("Evaluación descriptiva"),"El glosario es la última sección");
assert.match(html,/page-break-before:always/);
assert.ok(!html.includes("<script>rival</script>"),"No inyectar HTML del nombre rival");
assert.match(html,/&lt;script&gt;rival&lt;\/script&gt;/);
const unavailable = renderFinalGameReportV49({game,teamName:"Nuestro equipo",stats,players,events:[],eventsAvailable:false});
assert.match(unavailable,/no están disponibles|no disponibles/i);
assert.doesNotMatch(unavailable,/Canasta rival de 3 puntos, posición registrada/);
const registry = readFileSync(new URL("../services/LazyViewRegistry.js",import.meta.url),"utf8");
const heatmap = readFileSync(new URL("../views/heatmap/HeatmapOpponentV49View.js",import.meta.url),"utf8");
const reader = readFileSync(new URL("../services/games/GameFinalReportReadService.js",import.meta.url),"utf8");
assert.match(registry,/HeatmapOpponentV49View/);
assert.match(heatmap,/super\._fetchEvents\(\)/);
assert.match(heatmap,/data-map-team/);
assert.match(heatmap,/renderOpponentScoringCourt/);
assert.match(reader,/team_game_stats/);
assert.match(reader,/renderFinalGameReportV49/);
assert.doesNotMatch(reader,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
console.log("FINAL_REPORT_HEATMAP_V49_OK: acta, opcionales evidenciados, comparativa rival, mapas y glosario");
