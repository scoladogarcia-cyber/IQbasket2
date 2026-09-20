import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderFinalGameReportV49 } from "../views/reports/GameFinalReportV49Renderer.js";
import { renderFullGameBoxScoreTables } from "../views/reports/FullGameBoxScoreTables.js";
import { loadCompleteSeasonReports, buildCompleteSeasonReport } from "../services/reports/CompleteSeasonReportService.js";

const teamId = "team-1";
const seasonId = "season-1";
const players = [{ id: "p-1", first_name: "Ana", last_name: "Test", jersey: 8 }];
const stats = [{ player_id: "p-1", minutes: 40, fg2_made: 1, fg2_attempted: 2, fg3_made: 0, fg3_attempted: 1, ft_made: 0, ft_attempted: 0 }];
const game = (id, opponent) => ({ id, team_id: teamId, team_season_id: seasonId, opponent, team_score: 2, opponent_score: 2 });
const events = id => [
  { game_id:id, action_type:"fg2_made", points:2, coord_x:45, coord_y:15, made:true },
  { game_id:id, action_type:"opp_pts", points:2, coord_x:50, coord_y:20, made:true }
];
const games = [game("g-1", "CB Coll"),game("g-2", "<script>inject</script>")];
const reports = games.map(row => ({
  game:row,
  html:renderFinalGameReportV49({game:row,teamName:"JMJ Manyanet",players,stats,events:events(row.id),eventsAvailable:true,periods:[]})
}));
const joined = buildCompleteSeasonReport({reports,teamName:"JMJ Manyanet",seasonName:"2026/2027"});
assert.match(joined,/2026\/2027/);
assert.match(joined,/CB Coll/);
assert.equal((joined.match(/class="iq-final-report iq-season-game-report"/g)||[]).length,2);
assert.equal((joined.match(/Guía de lectura · glosario de estadísticas/g)||[]).length,1,"Glosario una sola vez y al final");
assert.ok(joined.lastIndexOf("Guía de lectura") > joined.lastIndexOf("Evaluación descriptiva"));
assert.equal((joined.match(/Desde dónde nos han metido los puntos/gi)||[]).length,2);
assert.match(joined,/Nuestros tiros: anotados y fallados/);
assert.match(joined,/T2 C\/I/);
assert.match(joined,/Comparativa: tiros y rebotes/);
assert.match(joined,/&lt;script&gt;inject&lt;\/script&gt;/);
assert.ok(!joined.includes("<script>inject</script>"));
assert.doesNotMatch(joined,/>85\.0</,"No utilizar métricas de ejemplo del dossier antiguo");
assert.throws(()=>buildCompleteSeasonReport({reports:[]}));
assert.throws(()=>buildCompleteSeasonReport({reports:[{game:games[0],html:"informe incompleto"}]}));

const optionalAbsent = renderFullGameBoxScoreTables({game:games[0],players,stats});
assert.match(optionalAbsent,/Datos adicionales del partido \(solo si se anotaron\)/);
assert.match(optionalAbsent,/No se anotaron datos adicionales/);
assert.doesNotMatch(optionalAbsent,/<th scope="col">ARO C<\/th>/,"No crear una tabla toda N\/D");
const optionalZero = renderFullGameBoxScoreTables({game:games[0],players,stats:[{...stats[0],fg_rim_made:0}]});
assert.match(optionalZero,/<th scope="col">ARO C<\/th>/,"Cero registrado no equivale a N\/D");
assert.match(optionalZero,/Detalle de lanzamientos y creación/);

const policy = allowed => ({authorizeExport:()=>({allowed})});
const read = id => Promise.resolve({game:games.find(g=>g.id===id),html:reports.find(r=>r.game.id===id).html,context:{teamId},policy:policy(true)});
const loaded = await loadCompleteSeasonReports({games,teamId,teamSeasonId:seasonId,loadReport:read});
assert.equal(loaded.length,2);
await assert.rejects(loadCompleteSeasonReports({games,teamId,teamSeasonId:"other",loadReport:read}),/ámbito/);
await assert.rejects(loadCompleteSeasonReports({games,teamId,teamSeasonId:seasonId,loadReport:async id=>({...await read(id),policy:policy(false)})}),/ámbito/);
await assert.rejects(loadCompleteSeasonReports({games,teamId,teamSeasonId:seasonId,loadReport:async id=>id==="g-2" ? Promise.reject(new Error("Lectura fallida")) : read(id)}),/Lectura fallida/);
await assert.rejects(loadCompleteSeasonReports({games:[games[0],games[0]],teamId,loadReport:read}),/duplicado/);

const facade = readFileSync(new URL("../views/ReportsViewV50.js",import.meta.url),"utf8");
const registry = readFileSync(new URL("../services/LazyViewRegistry.js",import.meta.url),"utf8");
const exporter = readFileSync(new URL("../services/ReportExporter.js",import.meta.url),"utf8");
assert.match(facade,/btn-export-complete-season/);
assert.match(facade,/getGamesForActiveSeason/);
assert.match(facade,/authorizeExport\(ReportType\.SEASON_DOSSIER/);
assert.ok(facade.indexOf('window.open("", "_blank"') < facade.indexOf("await loadCompleteSeasonReports"),"Safari: popup abierto dentro del clic");
assert.match(registry,/ReportsViewV50/);
assert.match(registry,/new Player360View\(supabase, authController\)/,"No modificar otras vistas");
assert.match(exporter,/if \(!authorization\?\.allowed\)/,"El exportador debe validar permisos antes de escribir");
assert.match(exporter,/options\?\.printWindow \|\| window\.open/);
assert.ok(exporter.indexOf("if (!authorization?.allowed)", exporter.indexOf("static printReport")) < exporter.indexOf("const printWindow =",exporter.indexOf("static printReport")),"La autorización precede a la apertura/uso de ventana");
assert.doesNotMatch(facade,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
console.log("COMPLETE_SEASON_REPORT_V50_OK: dos partidos, ambos mapas, un glosario, permisos, sin PDF parcial y claridad opcionales");
