/**
 * @fileoverview Informe final imprimible de partido, sin dependencias de escritura.
 * @description La evaluación es descriptiva; N/D nunca se convierte en un cero.
 */
import { buildGameReportMetrics, formatMetric } from "../../domain/stats/GameReportMetrics.js";
import { buildGameShotMaps } from "../../domain/analytics/GameReportShotMaps.js";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const integer = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const pct = value => formatMetric(value, "%");

function shotCourt(map, title) {
  const points = map.shots.map(({ x, y, made }) => `<circle cx="${(x * 4).toFixed(1)}" cy="${(y * 2.15).toFixed(1)}" r="4" fill="${made ? "#15803d" : "#dc2626"}" fill-opacity="0.8" stroke="white" stroke-width="0.8"/>`).join("");
  return `<section class="iq-report-panel iq-map"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(map.coverage)}</p>
    ${map.located ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 215" role="img" aria-label="${escapeHtml(title)}: ${map.located} posiciones registradas">
      <rect x="1" y="1" width="398" height="213" rx="8" fill="#f8fafc" stroke="#64748b" stroke-width="2"/>
      <path d="M100 1 V108 H300 V1 M165 1 V45 H235 V1 M80 1 Q80 175 200 175 Q320 175 320 1" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
      <circle cx="200" cy="20" r="8" fill="none" stroke="#334155" stroke-width="2"/>${points}</svg>` : `<p>Sin coordenadas válidas para dibujar un mapa.</p>`}
    <small>${map.completeOutcomes ? "Verde = anotado; rojo = fallado. Solo se representan tiros con coordenadas." : escapeHtml(map.note || "Solo se muestran registros con coordenadas.")}</small>
  </section>`;
}

function insightLines(metrics, maps, periods) {
  const t = metrics.totals;
  const lines = [];
  if (t.fga > 0) lines.push(`Tiro de campo: ${t.fg2m}/${t.fg2a} de dos y ${t.fg3m}/${t.fg3a} de tres; eFG ${pct(t.efg)}.`);
  if (t.turnovers >= 0 && t.assists >= 0) lines.push(`${t.assists} asistencias y ${t.turnovers} pérdidas; AST/TO ${formatMetric(t.astTo)}.`);
  lines.push(`${t.offReb} rebotes ofensivos y ${t.defReb} defensivos registrados.`);
  if (periods.length) {
    const diffs = periods.map((p, i) => `P${i + 1}: ${integer(p.team_score ?? p.teamScore)}–${integer(p.opponent_score ?? p.opponentScore)}`);
    lines.push(`Parciales capturados: ${diffs.join(" · ")}.`);
  }
  if (maps.opponent.located) lines.push(`Constan ${maps.opponent.located} canastas rivales con posición; faltan los intentos fallados para valorar su eficiencia espacial.`);
  lines.push("Interpretación descriptiva de registros; no se infieren causas, posesiones defensivas ni rendimiento táctico sin datos suficientes.");
  return lines;
}

/** Construye el informe a partir de UN partido y sus filas autorizadas. */
export function renderFinalGameReport({ game, teamName = "Nuestro equipo", players = [], stats = [], periods = [], events = [], eventsAvailable = true, completeRoster = true } = {}) {
  if (!game?.id) throw new Error("Se requiere un partido para construir el informe.");
  const ownName = escapeHtml(teamName);
  const opponent = escapeHtml(game.opponent || "Rival");
  const away = /visitante|away/i.test(String(game.venue || ""));
  const metrics = buildGameReportMetrics(stats, game);
  const maps = buildGameShotMaps(eventsAvailable ? events : [], game.id);
  const playerNames = new Map(players.map(p => [String(p.id), { name: [p.first_name ?? p.firstName, p.last_name ?? p.lastName].filter(Boolean).join(" ") || p.name || "Jugador", jersey: p.jersey ?? p.number ?? "–" }]));
  const home = away ? opponent : ownName;
  const visitor = away ? ownName : opponent;
  const homePoints = away ? metrics.opponentScore : metrics.teamScore;
  const visitorPoints = away ? metrics.teamScore : metrics.opponentScore;
  const head = `<section class="iq-report-panel"><div class="iq-report-eyebrow">IQBasket · Informe final de partido</div><h1>${home} ${homePoints ?? "N/D"} – ${visitorPoints ?? "N/D"} ${visitor}</h1><p>${escapeHtml(game.date || game.game_date || "Sin fecha")} · ${escapeHtml(game.time || "")} · ${escapeHtml(game.competition || "Competición no indicada")} · ${away ? "Nuestro equipo visitante" : "Nuestro equipo local"} · ${escapeHtml(game.venue_name || "Pabellón no indicado")}</p><p>Estado: ${escapeHtml(game.status || game.play_state || "No indicado")} · Partido ID: ${escapeHtml(game.id)}</p></section>`;
  const periodRows = periods.map((p, i) => `<tr><td>${escapeHtml(p.period_type || (p.is_overtime ? "Prórroga" : `Q${p.period_number || i + 1}`))}</td><td>${integer(away ? p.opponent_score ?? p.opponentScore : p.team_score ?? p.teamScore)}</td><td>${integer(away ? p.team_score ?? p.teamScore : p.opponent_score ?? p.opponentScore)}</td></tr>`).join("");
  const scoreTable = `<section class="iq-report-panel"><h2>Resultado y parciales</h2><table class="iq-table"><thead><tr><th>Periodo</th><th>${home}</th><th>${visitor}</th></tr></thead><tbody>${periodRows || `<tr><td colspan="3">Parciales no disponibles</td></tr>`}</tbody></table></section>`;
  const scoreFields = ["minutes", "points", "fg2m", "fg2a", "fg3m", "fg3a", "ftm", "fta", "offReb", "defReb", "assists", "steals", "blocks", "turnovers", "foulsCommitted", "foulsDrawn", "pir"];
  const labels = ["MIN", "PTS", "T2C", "T2I", "T3C", "T3I", "TLC", "TLI", "RO", "RD", "AST", "ROB", "TAP", "PER", "FC", "FR", "VAL"];
  const playerRows = metrics.rows.map(row => {
    const p = playerNames.get(row.id) || { name: "Jugador sin ficha accesible", jersey: "–" };
    return `<tr><th scope="row">#${escapeHtml(p.jersey)} ${escapeHtml(p.name)}</th><td>${row.starter ? "Sí" : "No"}</td>${scoreFields.map(field => `<td>${row[field]}</td>`).join("")}<td>${pct(row.efg)}</td><td>${pct(row.ts)}</td><td>${formatMetric(row.astTo)}</td><td>${pct(row.usage)}</td></tr>`;
  }).join("");
  const totals = metrics.totals;
  const totalCells = scoreFields.map(field => `<td>${totals[field]}</td>`).join("");
  const headers = labels.map(label => `<th>${label}</th>`).join("");
  const acta = `<section class="iq-report-panel"><h2>Acta individual completa · ${ownName}</h2><div class="iq-report-scroll"><table class="iq-table iq-acta"><thead><tr><th>Jugador</th><th>TIT</th>${headers}<th>eFG%</th><th>TS%</th><th>AST/TO</th><th>USG% estim.</th></tr></thead><tbody>${playerRows || `<tr><td colspan="23">Estadísticas no disponibles: no se presenta un acta ficticia a cero.</td></tr>`}</tbody><tfoot><tr><th>TOTAL EQUIPO</th><td>–</td>${totalCells}<td>${pct(totals.efg)}</td><td>${pct(totals.ts)}</td><td>${formatMetric(totals.astTo)}</td><td>${pct(totals.usage)}</td></tr></tfoot></table></div><small>USG% con minutos 0 o sin denominador: N/D. AST/TO sin pérdidas: N/D (no se interpreta como cero). Las filas proceden únicamente de este partido.</small></section>`;
  const metricCards = [["eFG%", pct(totals.efg)], ["TS%", pct(totals.ts)], ["T2", `${totals.fg2m}/${totals.fg2a}`], ["T3", `${totals.fg3m}/${totals.fg3a}`], ["TL", `${totals.ftm}/${totals.fta}`], ["REB (RO+RD)", `${totals.rebounds} (${totals.offReb}+${totals.defReb})`], ["AST / PER", `${totals.assists} / ${totals.turnovers}`], ["VAL FIBA", totals.pir], ["Posesiones propias estim.", formatMetric(totals.estimatedPossessions)], ["ORtg propio estim.", formatMetric(totals.offensiveRating)], ["DRtg / Net rating", "N/D: falta captura rival completa"], ["Uso colectivo", pct(totals.usage)]];
  const metricsHtml = `<section class="iq-report-panel"><h2>Indicadores y comparación</h2><div class="iq-kpis">${metricCards.map(([label, value]) => `<div class="iq-kpi"><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b></div>`).join("")}</div><p>Rival: ${metrics.opponentScore ?? "N/D"} puntos anotados. Sin boxscore completo de lanzamientos rivales no se calculan su eFG, TS, DRtg ni comparativas de eficiencia.</p></section>`;
  const mapHtml = `<section class="iq-report-panel"><h2>Mapas espaciales</h2>${eventsAvailable ? `<div class="iq-maps">${shotCourt(maps.our, "Nuestros tiros: anotados y fallados")}${shotCourt(maps.opponent, "Rival: mapa de canastas registradas")}</div>` : `<p>Eventos espaciales no disponibles. Se conserva el acta sin dibujar mapas inexistentes.</p>`}</section>`;
  const evaluation = `<section class="iq-report-panel"><h2>Evaluación descriptiva y control de calidad</h2><ul>${insightLines(metrics, maps, periods).map(text => `<li>${escapeHtml(text)}</li>`).join("")}</ul>${metrics.warnings.length ? `<div role="alert" class="iq-warning"><strong>Revisiones pendientes:</strong><ul>${metrics.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join("")}</ul></div>` : `<p>Sin discrepancias detectadas entre puntos del acta y marcador ni inconsistencias básicas de tiro/minutos.</p>`}${!completeRoster ? `<p class="iq-warning">Vista limitada por permisos de jugadores: los totales solo cubren las filas autorizadas.</p>` : ""}<p><small>${escapeHtml(metrics.methodology)}</small></p><p><small>El mapa del rival no representa tiros fallados ni porcentaje de acierto sin esa información; no se generan mapas sintéticos.</small></p></section>`;
  const style = `<style>.iq-final-report{max-width:1500px;margin:auto;font:13px system-ui,sans-serif;color:#0f172a;line-height:1.5}.iq-report-panel{background:#fff;border:1px solid #dbe3ef;border-radius:12px;padding:18px;margin:16px 0;break-inside:avoid}.iq-report-eyebrow{text-transform:uppercase;color:#475569;font-weight:800;letter-spacing:.08em}.iq-final-report h1{font-size:25px}.iq-final-report h2{font-size:19px}.iq-final-report h3{font-size:15px}.iq-report-scroll{overflow-x:auto}.iq-table{border-collapse:collapse;width:100%;font-size:11px}.iq-table td,.iq-table th{border-bottom:1px solid #e2e8f0;padding:5px;white-space:nowrap;text-align:center}.iq-table th:first-child{text-align:left}.iq-table thead,.iq-table tfoot{background:#eaf0fa}.iq-acta{font-size:9px}.iq-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:9px}.iq-kpi{padding:10px;background:#f1f5f9;border-radius:8px}.iq-kpi small,.iq-kpi b{display:block}.iq-kpi b{font-size:17px}.iq-maps{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}.iq-map svg{width:100%;max-width:450px}.iq-warning{background:#fff7ed;padding:12px;border-radius:8px;color:#7c2d12}@media print{@page{size:A3 landscape;margin:8mm}.iq-final-report{font-size:10px}.iq-report-panel{padding:8px;margin:8px 0}.iq-acta{font-size:7px}.iq-table td,.iq-table th{padding:2px}.iq-maps{grid-template-columns:1fr 1fr}.iq-kpis{grid-template-columns:repeat(6,1fr)}}@media(max-width:700px){.iq-report-panel{padding:12px}.iq-final-report h1{font-size:20px}}</style>`;
  return `${style}<article class="iq-final-report">${head}${scoreTable}${acta}${metricsHtml}${mapHtml}${evaluation}</article>`;
}
