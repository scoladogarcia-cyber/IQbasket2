/**
 * @fileoverview Acta de partido completa y legible en móvil/PDF, sin recortes.
 * @description Tablas separadas de acta, ratios y acciones avanzadas. Los campos
 * opcionales ausentes son N/D; no se interpretan como 0 ni se mezclan partidos.
 */
import { buildGameReportMetrics, formatMetric } from "../../domain/stats/GameReportMetrics.js";
const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const present = value => value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value));
const raw = (row, key, alternate = null) => {
  const value = row?.[key] ?? (alternate ? row?.[alternate] : undefined);
  return present(value) ? Number(value) : null;
};
const show = value => value === null || value === undefined ? "N/D" : esc(value);
const madeAttempted = (made, attempts) => `${show(made)}/${show(attempts)}`;
const playerLabel = (player = {}) => `#${esc(player.jersey ?? player.number ?? "–")} ${esc([player.first_name ?? player.firstName, player.last_name ?? player.lastName].filter(Boolean).join(" ") || player.name || "Jugador")}`;
const table = (headers, rows, footer = "") => `<div class="iq-report-scroll" style="overflow-x:auto"><table class="iq-table iq-full-acta" style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr>${headers.map(v => `<th scope="col">${esc(v)}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}">No hay estadísticas de este partido dentro de tu alcance de lectura.</td></tr>`}</tbody>${footer ? `<tfoot>${footer}</tfoot>` : ""}</table></div>`;

/** Mantiene las filas autorizadas y usa la misma fórmula canónica del informe. */
export function renderFullGameBoxScoreTables({ game = {}, players = [], stats = [] } = {}) {
  const computed = buildGameReportMetrics(stats, game);
  const names = new Map(players.map(player => [String(player.id), player]));
  const named = row => `<th scope="row">${names.has(row.id) ? playerLabel(names.get(row.id)) : "Jugador sin ficha accesible"}</th>`;
  const mainHeaders = ["Jugador", "TIT", "MIN", "PTS", "T2 C/I", "T3 C/I", "TL C/I", "RO", "RD", "REB", "AST", "ROB", "TAP", "PER", "FC", "FR", "TAP REC", "+/−", "VAL"];
  const mainCells = (m, r) => [m.starter ? "Sí" : "No", m.minutes, m.points, madeAttempted(m.fg2m, m.fg2a), madeAttempted(m.fg3m, m.fg3a), madeAttempted(m.ftm, m.fta), m.offReb, m.defReb, m.rebounds, m.assists, m.steals, m.blocks, m.turnovers, m.foulsCommitted, m.foulsDrawn, show(raw(r, "blocks_received", "blocksReceived")), show(raw(r, "plus_minus", "plusMinus")), m.pir];
  const mainRows = computed.rows.map((m, i) => `<tr>${named(m)}${mainCells(m, stats[i]).map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("");
  const t = computed.totals;
  const sumOptional = key => stats.length && stats.every(row => raw(row, key) !== null) ? stats.reduce((sum, row) => sum + raw(row, key), 0) : "N/D";
  const totalMain = ["–", t.minutes, t.points, madeAttempted(t.fg2m,t.fg2a), madeAttempted(t.fg3m,t.fg3a), madeAttempted(t.ftm,t.fta), t.offReb,t.defReb,t.rebounds,t.assists,t.steals,t.blocks,t.turnovers,t.foulsCommitted,t.foulsDrawn,sumOptional("blocks_received"),"–",t.pir];
  const footerMain = `<tr><th scope="row">TOTAL EQUIPO</th>${totalMain.map(cell => `<td>${cell}</td>`).join("")}</tr>`;

  const efficiencyHeaders = ["Jugador", "T2%", "T3%", "TL%", "TC C/I", "TC%", "eFG%", "TS%", "AST/PER", "USG% estim.", "Game Score", "ORtg", "DRtg"];
  const ratio = (made, attempts) => attempts > 0 ? formatMetric(made * 100 / attempts, "%") : "N/D";
  const efficiency = (m, r) => [ratio(m.fg2m,m.fg2a),ratio(m.fg3m,m.fg3a),ratio(m.ftm,m.fta),madeAttempted(m.fg2m+m.fg3m,m.fga),ratio(m.fg2m+m.fg3m,m.fga),formatMetric(m.efg,"%"),formatMetric(m.ts,"%"),formatMetric(m.astTo),formatMetric(m.usage,"%"),show(raw(r,"game_score")),show(raw(r,"offensive_rating")),show(raw(r,"defensive_rating"))];
  const efficiencyRows = computed.rows.map((m,i)=>`<tr>${named(m)}${efficiency(m,stats[i]).map(cell=>`<td>${cell}</td>`).join("")}</tr>`).join("");
  const efficiencyTotal = [ratio(t.fg2m,t.fg2a),ratio(t.fg3m,t.fg3a),ratio(t.ftm,t.fta),madeAttempted(t.fg2m+t.fg3m,t.fga),ratio(t.fg2m+t.fg3m,t.fga),formatMetric(t.efg,"%"),formatMetric(t.ts,"%"),formatMetric(t.astTo),formatMetric(t.usage,"%"),"–","–","–"];

  const detailGroups = [
    [["fg_rim_made","ARO C"],["fg_rim_attempted","ARO I"],["fg_mid_made","MEDIA C"],["fg_mid_attempted","MEDIA I"],["fg_corner3_made","ESQ3 C"],["fg_corner3_attempted","ESQ3 I"],["assisted_fg_made","TC asist."],["potential_assists","AST pot."],["secondary_assists","AST sec."]],
    [["drives","ENTR"],["paint_touches","TOQ Z"],["deflections","DESV"],["charges_drawn","C. REC"],["contested_rebounds","REB DIS"],["box_outs","BLO REB"]]
  ];
  const detailTables = detailGroups.map((group,index) => {
    const values = computed.rows.map((m,i)=>`<tr>${named(m)}${group.map(([field])=>`<td>${show(raw(stats[i],field))}</td>`).join("")}</tr>`).join("");
    const totals = group.map(([field])=>`<td>${sumOptional(field)}</td>`).join("");
    return `<h3 style="font-size:14px">${index ? "Acciones y defensa" : "Detalle de lanzamientos y creación"}</h3>${table(["Jugador",...group.map(([,label])=>label)],values,`<tr><th>TOTAL EQUIPO</th>${totals}</tr>`)}`;
  }).join("");

  return `<section class="iq-report-panel iq-full-boxscore"><h2>Acta individual completa · ${esc(game.opponent || "Partido")}</h2><p>Acta principal (cada columna completa; sin recortar la tabla para imprimir).</p>
    ${table(mainHeaders,mainRows,footerMain)}
    <h3 style="font-size:14px;margin-top:14px">Porcentajes y métricas avanzadas</h3>${table(efficiencyHeaders,efficiencyRows,`<tr><th>TOTAL EQUIPO</th>${efficiencyTotal.map(cell=>`<td>${cell}</td>`).join("")}</tr>`)}
    <h3 style="font-size:14px;margin-top:14px">Registro avanzado (si se capturó)</h3>${detailTables}
    <p style="font-size:11px">C = convertidos; I = intentados; N/D = campo no capturado o no calculable. Los totales de métricas no aditivas no se suman. USG se recalcula, no utiliza el valor legado.</p>
  </section>`;
}
