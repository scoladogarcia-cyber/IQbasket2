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
assert.doesNotMatch(optionalAbsent,/Datos adicionales del partido/,"No mostrar ninguna sección opcional vacía");
assert.doesNotMatch(optionalAbsent,/<th scope="col">ARO C<\/th>/);
const optionalZeros = Object.fromEntries([
  "fg_rim_made","fg_rim_attempted","fg_mid_made","fg_mid_attempted","fg_corner3_made","fg_corner3_attempted",
  "assisted_fg_made","potential_assists","secondary_assists","drives","paint_touches","deflections",
  "charges_drawn","contested_rebounds","box_outs"
].map(key => [key,0]));
const defaultZeroReport = renderFullGameBoxScoreTables({game:games[0],players,stats:[{...stats[0],...optionalZeros}]});
assert.doesNotMatch(defaultZeroReport,/Datos adicionales del partido/,"Los ceros DEFAULT de Supabase no indican captura");
assert.doesNotMatch(defaultZeroReport,/Detalle de lanzamientos y creación|Acciones y defensa/);
const optionalRecorded = renderFullGameBoxScoreTables({game:games[0],players,stats:[{...stats[0],...optionalZeros,fg_rim_made:1}]});
assert.match(optionalRecorded,/Datos adicionales del partido/);
assert.match(optionalRecorded,/<th scope="col">ARO C<\/th>/);
assert.doesNotMatch(optionalRecorded,/<th scope="col">AST pot\.<\/th>/,"Ocultar columnas cuyo único valor es DEFAULT 0");
assert.doesNotMatch(optionalRecorded,/Acciones y defensa/,"Ocultar el otro grupo sin acciones positivas");
assert.doesNotMatch(renderFinalGameReportV49({game:games[0],players,stats:[{...stats[0],...optionalZeros}],events:events("g-1")}),/Datos adicionales del partido/);

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
const readService = readFileSync(new URL("../services/games/GameFinalReportReadService.js",import.meta.url),"utf8");
const app = readFileSync(new URL("../index.js",import.meta.url),"utf8");
assert.match(app,/this\.authController = this\.permissionService/,"La app real pasa PermissionService, no AuthController");
assert.match(readService,/supabase as configuredSupabase/,"Fuente central de Supabase autenticada");
assert.match(readService,/const client = supabase\?\.from \? supabase : configuredSupabase/,"Sin cliente inyectado, usar instancia autenticada");
assert.match(readService,/refreshGameBoxScore\(\{ supabase: client/);
assert.doesNotMatch(readService,/await supabase\.from\(/,"Ninguna consulta debe usar el parámetro posiblemente indefinido");
assert.match(facade,/btn-export-complete-season/);
assert.match(facade,/getGamesForActiveSeason/);
const exportScope = facade.slice(facade.indexOf("_exportableGames(context)"),facade.indexOf("/** Apertura sin await"));
assert.match(exportScope,/getGamesForActiveSeason\?\.\(context\.teamId\)/,"Exportar temporada activa completa");
assert.doesNotMatch(exportScope,/_getFilteredGames\(/,"El filtro de sede no puede limitar la exportación completa");
assert.match(facade,/independientemente del filtro Local\/Visitante/);
assert.match(facade,/authorizeExport\(ReportType\.SEASON_DOSSIER/);
assert.ok(facade.indexOf('window.open("", "_blank"') < facade.indexOf("await loadCompleteSeasonReports"),"Safari: popup abierto dentro del clic");
assert.match(registry,/ReportsViewV50/);
assert.match(registry,/new Player360View\(supabase, authController\)/,"No modificar otras vistas");
assert.match(exporter,/if \(!authorization\?\.allowed\)/,"El exportador debe validar permisos antes de escribir");
assert.match(exporter,/options\?\.printWindow \|\| window\.open/);
assert.ok(exporter.indexOf("if (!authorization?.allowed)", exporter.indexOf("static printReport")) < exporter.indexOf("const printWindow =",exporter.indexOf("static printReport")),"La autorización precede a la apertura/uso de ventana");
assert.doesNotMatch(facade,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
console.log("COMPLETE_SEASON_REPORT_V50_OK: lectura real con PermissionService, opcionales DEFAULT cero ocultos, mapas, permisos y PDF completo");
