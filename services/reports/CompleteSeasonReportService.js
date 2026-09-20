/**
 * @fileoverview Exportación integral de una selección autorizada de partidos.
 * @description Portada agregada solo con actas autorizadas; los informes detallados
 * se reutilizan completos. Nunca produce PDF parcial si falla una lectura.
 */
import { ReportType } from "../../security/ReportAccessPolicy.js";
import { renderSelectedGamesOverview } from "../../views/reports/SelectedGamesOverviewV53.js";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const asId = value => String(value ?? "");
const ARTICLE_OPEN = '<article class="iq-final-report">';
const GLOSSARY_OPEN = '<section class="iq-report-panel iq-report-glossary"';

/** Lee solo la selección autorizada, validando contexto y permiso tras cada lectura. */
export async function loadCompleteSeasonReports({ games, loadReport, teamId, teamSeasonId = null } = {}) {
  if (!Array.isArray(games) || !games.length || typeof loadReport !== "function" || !teamId) {
    throw new Error("Selecciona una temporada con partidos autorizados para exportar.");
  }
  const results = [];
  const seen = new Set();
  for (const selected of games) {
    const id = asId(selected?.id);
    if (!id || seen.has(id)) throw new Error("La selección de partidos contiene un ID vacío o duplicado.");
    seen.add(id);
    const report = await loadReport(id);
    const freshTeam = report?.game?.team_id ?? report?.game?.teamId;
    const freshSeason = report?.game?.team_season_id ?? report?.game?.teamSeasonId;
    const selectedSeason = selected?.team_season_id ?? selected?.teamSeasonId;
    if (asId(report?.game?.id) !== id || asId(freshTeam) !== asId(teamId)
      || (teamSeasonId && asId(freshSeason) !== asId(teamSeasonId))
      || (selectedSeason && asId(freshSeason) !== asId(selectedSeason))
      || !report?.policy?.authorizeExport?.(ReportType.GAME_STATS, report?.context)?.allowed
      || typeof report?.html !== "string") {
      throw new Error("Un partido ha cambiado de ámbito o no permite su exportación. No se ha generado un documento parcial.");
    }
    results.push({ game: report.game, html: report.html, stats: Array.isArray(report.stats) ? report.stats : null });
  }
  return results;
}

/** Extrae solo las secciones de un HTML V49; rechaza cambios del contrato. */
function extractReport(html) {
  const styleEnd = html.indexOf("</style>");
  const articleStart = html.indexOf(ARTICLE_OPEN);
  const articleEnd = html.lastIndexOf("</article>");
  const glossaryStart = html.lastIndexOf(GLOSSARY_OPEN);
  if (!html.startsWith("<style>") || styleEnd < 0 || articleStart < styleEnd
    || glossaryStart <= articleStart || articleEnd <= glossaryStart) {
    throw new Error("El formato del informe de partido ha cambiado. Se cancela la exportación para evitar omisiones.");
  }
  return {
    styles: html.slice(0, styleEnd + "</style>".length),
    content: html.slice(articleStart + ARTICLE_OPEN.length, glossaryStart),
    glossary: html.slice(glossaryStart, articleEnd)
  };
}

/** Portada, dashboard de selección, todos los informes y un único glosario final. */
export function buildCompleteSeasonReport({ reports = [], teamName = "Nuestro equipo", seasonName = "Temporada seleccionada" } = {}) {
  if (!Array.isArray(reports) || !reports.length) throw new Error("No hay informes completos para exportar.");
  const chunks = reports.map(row => extractReport(row?.html || ""));
  const gameRows = reports.map(({ game }, index) => {
    const score = value => value === null || value === undefined ? "N/D" : escapeHtml(value);
    return `<tr><td>${index + 1}</td><td>${escapeHtml(game.date || game.game_date || "Sin fecha")}</td><td>${escapeHtml(game.opponent || "Rival")}</td><td>${score(game.team_score ?? game.teamScore)} – ${score(game.opponent_score ?? game.opponentScore)}</td></tr>`;
  }).join("");
  const intro = `<section class="iq-season-cover"><h1>Informe completo · ${escapeHtml(teamName)}</h1><h2>${escapeHtml(seasonName)}</h2>
    <p>${reports.length} partido(s). Datos, actas, comparativas y mapas disponibles de los encuentros autorizados. Cada sección identifica sus datos no registrados como N/D.</p>
    <h3>Índice de partidos</h3><table class="iq-table"><thead><tr><th>#</th><th>Fecha</th><th>Rival</th><th>Marcador (nuestro equipo – rival)</th></tr></thead><tbody>${gameRows}</tbody></table>
    <p>Los mapas muestran solo eventos con coordenadas reales. La guía de estadísticas está al final del documento.</p></section>`;
  const overview = renderSelectedGamesOverview(reports.map(row => ({game: row.game, stats: row.stats})), {title: "El/los partidos seleccionados: resumen infográfico"});
  const reportsHtml = chunks.map((chunk, index) => `<article class="iq-final-report iq-season-game-report" aria-label="Informe de partido ${index + 1}">${chunk.content}</article>`).join("");
  const finalGlossary = `<article class="iq-final-report">${chunks[0].glossary}</article>`;
  const printStyle = `<style>.iq-season-cover{font:14px system-ui,sans-serif;color:#0f172a;background:white;padding:24px;max-width:1100px;margin:auto}.iq-season-cover h1{font-size:26px}.iq-season-cover table{width:100%;border-collapse:collapse}.iq-season-cover td,.iq-season-cover th{padding:8px;border:1px solid #cbd5e1;text-align:left}.iq-season-cover th{background:#eaf0fa}@media print{.iq-season-cover{break-after:page;page-break-after:always}.iq-season-game-report{break-before:page;page-break-before:always}.iq-season-cover td,.iq-season-cover th{padding:4px;font-size:10px}}@media(max-width:700px){.iq-season-cover{padding:12px;overflow-x:auto}}</style>`;
  return `${chunks[0].styles}${printStyle}<main class="iq-season-complete">${intro}${overview}${reportsHtml}${finalGlossary}</main>`;
}
