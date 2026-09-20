/**
 * @fileoverview Extensión V49 del informe V48 con resumen visual V53.
 * @description Conserva acta, comparativa, mapas y glosario; inserta una portada
 * descriptiva antes del desglose usando exclusivamente el partido consultado.
 */
import { renderFinalGameReport } from "./GameFinalReportRenderer.js";
import { renderFullGameBoxScoreTables } from "./FullGameBoxScoreTables.js";
import { renderGameOpponentComparisonPanel } from "./GameOpponentComparisonPanel.js";
import { renderGameStatisticsGlossary } from "./GameStatisticsGlossary.js";
import { renderOpponentScoringCourt } from "./OpponentScoringCourt.js";
import { buildGameShotMaps } from "../../domain/analytics/GameReportShotMaps.js";
import { renderSelectedGamesOverview } from "./SelectedGamesOverviewV53.js";

const ACTA_START = '<section class="iq-report-panel"><h2>Acta individual completa';
const METRIC_START = '<section class="iq-report-panel"><h2>Indicadores y comparación';
const MAP_START = '<section class="iq-report-panel"><h2>Mapas espaciales';
const EVALUATION_START = '<section class="iq-report-panel"><h2>Evaluación descriptiva';
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const EXTRA_STYLES = `
.iq-full-acta{table-layout:auto}.iq-full-boxscore h3{margin:16px 0 6px}.iq-full-boxscore .iq-table th,.iq-full-boxscore .iq-table td{white-space:nowrap;text-align:center;border:1px solid #e2e8f0;padding:4px}.iq-full-boxscore .iq-table th:first-child{text-align:left}.iq-opponent-comparison .iq-table td{vertical-align:top}.iq-report-glossary{break-before:page;page-break-before:always;break-inside:auto!important}.iq-glossary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 18px}.iq-glossary-entry{border-bottom:1px solid #e2e8f0;padding:4px 0;break-inside:avoid}.iq-glossary-entry strong,.iq-glossary-entry span{display:block}.iq-glossary-entry strong{color:#1e3a8a}.iq-glossary-entry span{font-size:11px;color:#334155}
@media(max-width:650px){.iq-glossary-grid{grid-template-columns:1fr}}
@media print{.iq-full-boxscore{break-inside:auto!important}.iq-full-boxscore .iq-report-scroll{overflow:visible!important}.iq-full-boxscore table{width:100%!important;table-layout:auto}.iq-full-boxscore .iq-table th,.iq-full-boxscore .iq-table td{font-size:7px;padding:2px;white-space:normal;overflow-wrap:anywhere}.iq-full-boxscore .iq-table th:first-child,.iq-full-boxscore .iq-table td:first-child{min-width:80px;text-align:left}.iq-full-boxscore table{break-inside:avoid}.iq-opponent-comparison .iq-table{font-size:10px}.iq-report-glossary{margin-top:0!important;break-before:page!important;page-break-before:always!important}.iq-glossary-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 12px}.iq-glossary-entry{padding:2px 0}.iq-glossary-entry span{font-size:9px}.iq-glossary-entry strong{font-size:9px}}
`;

/** Solo datos del encuentro ya autorizado; la infografía precede al acta. */
export function renderFinalGameReportV49(payload = {}) {
  const { game, players = [], stats = [], teamStats = null, events = [], eventsAvailable = true } = payload;
  const original = renderFinalGameReport(payload);
  const acta = renderFullGameBoxScoreTables({ game, players, stats })
    .replace(/(<h2>Acta individual completa · )[^<]*(<\/h2>)/, (_match, start, end) => `${start}${escapeHtml(payload.teamName || "Nuestro equipo")}${end}`);
  const comparison = renderGameOpponentComparisonPanel({ game, stats, teamStats, events, eventsAvailable });
  const maps = buildGameShotMaps(eventsAvailable ? events : [], game?.id);
  const originalOwnCourt = original.match(/<section class="iq-report-panel iq-map"><h3>Nuestros tiros:[\s\S]*?<\/section>/)?.[0] || '<p>No hay mapa propio disponible.</p>';
  const newMaps = `<section class="iq-report-panel"><h2>Mapas espaciales · tiros y puntos recibidos</h2>${eventsAvailable
    ? `<div class="iq-maps">${originalOwnCourt}${renderOpponentScoringCourt(maps.opponent, { title: "Rival: mapa de canastas registradas · desde dónde nos han metido los puntos" })}</div>`
    : '<p>Los eventos espaciales no están disponibles. No se dibujan tiros inexistentes.</p>'}</section>`;
  const beforeActa = original.indexOf(ACTA_START);
  const beforeMetrics = original.indexOf(METRIC_START);
  const beforeMaps = original.indexOf(MAP_START);
  const beforeEvaluation = original.indexOf(EVALUATION_START);
  const end = original.lastIndexOf("</article>");
  if ([beforeActa,beforeMetrics,beforeMaps,beforeEvaluation,end].some(value => value < 0)
    || !(beforeActa < beforeMetrics && beforeMetrics < beforeMaps && beforeMaps < beforeEvaluation && beforeEvaluation < end)) {
    throw new Error("El contrato de secciones del informe ha cambiado. No se imprime un acta parcial.");
  }
  const overview = renderSelectedGamesOverview([{ game, stats }], { title: "El partido en un vistazo" });
  const metricsPanel = original.slice(beforeMetrics,beforeMaps)
    .replace(/<p>Rival:[\s\S]*?<\/p>(?=<\/section>)/, '<p>Consultar el comparativo anterior para distinguir estadísticas guardadas, recuentos de eventos y datos no disponibles del rival.</p>');
  const enhanced = original.slice(0,beforeActa) + overview + acta + comparison + metricsPanel + newMaps + original.slice(beforeEvaluation,end)
    + renderGameStatisticsGlossary() + original.slice(end);
  return enhanced.replace("</style>", EXTRA_STYLES + "</style>");
}
