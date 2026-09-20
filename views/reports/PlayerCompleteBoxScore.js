/**
 * @fileoverview Desglose individual de tiros y acta para informes de jugador.
 * @description Función pura: únicamente filas de un jugador y partidos autorizados
 * de la temporada recibida. Nunca sustituye información ausente por cifras ficticias.
 */
import { canonicalPlayerRow, formatMetric } from "../../domain/stats/GameReportMetrics.js";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const numberOrNull = value => value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
  ? null : Number(value);
const percentage = (made, attempted) => attempted > 0 ? formatMetric(made * 100 / attempted, "%") : "N/D";
const ratio = (numerator, denominator) => denominator > 0 ? formatMetric(numerator / denominator, "", 1) : "N/D";
const attempts = (made, attempted) => `${made}/${attempted}`;
const cell = value => `<td style="padding:5px 6px;border-bottom:1px solid #e2e8f0;text-align:center">${escapeHtml(value)}</td>`;
const table = (title, headings, rows) => `<div style="margin:14px 0;break-inside:auto"><h3 style="font-size:13px;margin:0 0 6px">${escapeHtml(title)}</h3><div style="overflow-x:auto"><table class="iq-player-boxscore" style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr>${headings.map(label => `<th scope="col" style="padding:5px;background:#eaf0fa;text-align:center">${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
const rowHtml = (label, values, isTotal = false) => `<tr${isTotal ? ' style="font-weight:800;background:#f1f5f9"' : ""}><th scope="row" style="padding:5px;text-align:left;border-bottom:1px solid #e2e8f0">${escapeHtml(label)}</th>${values.map(cell).join("")}</tr>`;

/**
 * @param {{player:object,games:object[],stats:object[]}} payload
 * @returns {string} HTML seguro para pantalla y exportación PDF.
 */
export function renderPlayerCompleteBoxScore({ player, games = [], stats = [] } = {}) {
  if (!player?.id || !Array.isArray(games) || !Array.isArray(stats)) throw new Error("Informe de jugador: contexto inválido.");
  const allowed = new Map(games.filter(game => game?.id).map(game => [String(game.id), game]));
  const byGame = new Map();
  for (const stat of stats) {
    if (String(stat.player_id ?? stat.playerId ?? "") !== String(player.id)) continue;
    const id = String(stat.game_id ?? stat.gameId ?? "");
    if (!allowed.has(id)) continue;
    if (byGame.has(id)) throw new Error("Acta individual duplicada: se ha cancelado el informe para evitar totales incorrectos.");
    byGame.set(id, stat);
  }
  const played = games.filter(game => byGame.has(String(game.id))).map(game => {
    const source = byGame.get(String(game.id));
    const m = canonicalPlayerRow(source);
    const points = numberOrNull(source.points) ?? m.shootingPoints;
    return { game, source, m, points };
  });
  if (!played.length) return `<section class="iq-player-detail" style="padding:12px;border:1px solid #cbd5e1;border-radius:9px"><h3>Acta individual y tiros de campo</h3><p>No existen estadísticas individuales registradas en los partidos autorizados seleccionados. No se muestran ceros inventados.</p></section>`;

  const sum = key => played.reduce((total, row) => total + row.m[key], 0);
  const totalPoints = played.reduce((total, row) => total + row.points, 0);
  const total = Object.fromEntries(["minutes", "fg2m", "fg2a", "fg3m", "fg3a", "ftm", "fta", "offReb", "defReb", "assists", "steals", "blocks", "turnovers", "foulsCommitted", "foulsDrawn", "pir"].map(key => [key, sum(key)]));
  const fgMade = total.fg2m + total.fg3m;
  const fgAttempted = total.fg2a + total.fg3a;
  const gamesCount = played.filter(row => row.m.minutes > 0).length;
  const minutes = total.minutes;
  const label = row => `${row.game.date || "Sin fecha"} · ${row.game.opponent || "Rival"}`;
  const shooting = played.map(row => {
    const m = row.m;
    return rowHtml(label(row), [m.minutes, row.points, attempts(m.fg2m,m.fg2a),percentage(m.fg2m,m.fg2a),attempts(m.fg3m,m.fg3a),percentage(m.fg3m,m.fg3a),attempts(m.fg2m+m.fg3m,m.fga),percentage(m.fg2m+m.fg3m,m.fga),attempts(m.ftm,m.fta),percentage(m.ftm,m.fta)]);
  }).join("") + rowHtml("TOTAL", [minutes,totalPoints,attempts(total.fg2m,total.fg2a),percentage(total.fg2m,total.fg2a),attempts(total.fg3m,total.fg3a),percentage(total.fg3m,total.fg3a),attempts(fgMade,fgAttempted),percentage(fgMade,fgAttempted),attempts(total.ftm,total.fta),percentage(total.ftm,total.fta)], true);
  const rebounding = played.map(row => {
    const m = row.m;
    return rowHtml(label(row), [m.offReb,m.defReb,m.rebounds,m.assists,m.steals,m.blocks,m.turnovers,m.foulsCommitted,m.foulsDrawn,m.pir]);
  }).join("") + rowHtml("TOTAL", [total.offReb,total.defReb,total.offReb+total.defReb,total.assists,total.steals,total.blocks,total.turnovers,total.foulsCommitted,total.foulsDrawn,total.pir], true);
  const efficiency = played.map(row => {
    const m = row.m;
    return rowHtml(label(row), [formatMetric(m.efg,"%"),formatMetric(m.ts,"%"),formatMetric(m.astTo),numberOrNull(row.source.plus_minus ?? row.source.plusMinus) ?? "N/D"]);
  }).join("") + rowHtml("TEMPORADA", [percentage(total.fg2m+1.5*total.fg3m,fgAttempted),percentage(totalPoints,2*(fgAttempted+0.44*total.fta)),ratio(total.assists,total.turnovers),"No aditivo"],true);
  const warnings = played.filter(row => row.points !== row.m.shootingPoints).map(row => `<p style="color:#9a3412">Revisar ${escapeHtml(label(row))}: puntos guardados (${row.points}) y puntos derivados de tiros (${row.m.shootingPoints}) no coinciden.</p>`).join("");
  return `<section class="iq-player-detail" style="margin:12px 0;padding:12px;border:1px solid #cbd5e1;border-radius:9px;break-inside:auto">
    <h2 style="font-size:16px;margin:0 0 8px">Acta individual completa · tiros de campo y estadísticas</h2>
    <p style="font-size:11px;color:#334155">${played.length} actas registradas; ${gamesCount} partidos con minutos. Totales: ${totalPoints} puntos, ${minutes} minutos, ${formatMetric(gamesCount ? totalPoints/gamesCount : null)} puntos/PJ. No se mezclan otras temporadas.</p>
    ${table("Tiros: 2 puntos, triples, tiros de campo y libres",["Partido","MIN","PTS","T2 C/I","T2%","T3 C/I","T3%","TC C/I","TC%","TL C/I","TL%"],shooting)}
    ${table("Rebotes y acciones individuales",["Partido","RO","RD","REB","AST","ROB","TAP","PER","FC","FR","VAL FIBA"],rebounding)}
    ${table("Eficiencia y diferencial",["Partido","eFG%","TS%","AST/PER","+/−"],efficiency)}
    ${warnings}
    <p style="font-size:10px;color:#475569">C/I = convertidos/intentados; TC = tiros de campo (T2 + T3); RO/RD = rebotes ofensivos/defensivos; VAL = valoración FIBA; eFG% pondera el triple; TS% considera también tiros libres; N/D = sin denominador o dato no registrado. Porcentajes de temporada calculados sobre el total de aciertos e intentos, no promediando porcentajes. El diferencial +/− no se suma.</p>
  </section>`;
}
