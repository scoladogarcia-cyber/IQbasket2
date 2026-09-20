/**
 * @fileoverview Portada infográfica reutilizable para uno o varios partidos.
 * @description Solo utiliza marcadores y actas persistidos de la selección autorizada.
 * Todos los SVG son autocontenidos e imprimibles; N/D no se transforma en cero.
 */
import { buildGameReportMetrics } from "../../domain/stats/GameReportMetrics.js";

const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const numeric = value => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const pct = (made, attempts) => attempts > 0 ? `${(100 * made / attempts).toFixed(1)}%` : "N/D";
const num = value => value === null ? "N/D" : String(value);
const card = (label, value, note = "") => `<div class="iq-overview-card"><span>${escape(label)}</span><strong>${escape(value)}</strong>${note ? `<small>${escape(note)}</small>` : ""}</div>`;

/** @param {Array<{game:object,stats?:object[]}>} entries */
export function buildSelectedGamesSummary(entries = []) {
  if (!Array.isArray(entries) || !entries.length) throw new Error("Selecciona al menos un partido para el resumen.");
  const ids = new Set();
  const rows = entries.map(({ game, stats }) => {
    if (!game?.id || ids.has(String(game.id))) throw new Error("Partido ausente o duplicado en el resumen.");
    ids.add(String(game.id));
    const forPoints = numeric(game.team_score ?? game.teamScore);
    const againstPoints = numeric(game.opponent_score ?? game.opponentScore);
    const metrics = Array.isArray(stats) ? buildGameReportMetrics(stats, game) : null;
    return { id: String(game.id), date: game.date || game.game_date || "", opponent: game.opponent || "Rival",
      forPoints, againstPoints, metrics };
  });
  const scores = rows.filter(row => row.forPoints !== null && row.againstPoints !== null);
  const full = rows.every(row => row.metrics && row.metrics.rows.length > 0);
  const keys = ["points","fg2m","fg2a","fg3m","fg3a","ftm","fta","offReb","defReb","assists","turnovers","steals","pir"];
  const totals = full ? Object.fromEntries(keys.map(key => [key, rows.reduce((sum, row) => sum + row.metrics.totals[key], 0)])) : null;
  const scored = scores.reduce((sum, row) => sum + row.forPoints, 0);
  const conceded = scores.reduce((sum, row) => sum + row.againstPoints, 0);
  const wins = scores.filter(row => row.forPoints > row.againstPoints).length;
  const losses = scores.filter(row => row.forPoints < row.againstPoints).length;
  const ties = scores.filter(row => row.forPoints === row.againstPoints).length;
  const notes = [];
  if (scores.length === rows.length) notes.push(`Marcadores de ${scores.length} partido(s): ${wins} victorias, ${losses} derrotas${ties ? ` y ${ties} empates` : ""}; diferencial ${scored - conceded > 0 ? "+" : ""}${scored - conceded}.`);
  else notes.push(`Solo ${scores.length} de ${rows.length} partidos tienen ambos marcadores. No se interpretan los ausentes como cero.`);
  if (totals) {
    notes.push(`Tiros registrados: ${totals.fg2m}/${totals.fg2a} de dos (${pct(totals.fg2m,totals.fg2a)}) y ${totals.fg3m}/${totals.fg3a} triples (${pct(totals.fg3m,totals.fg3a)}).`);
    notes.push(`Se registran ${totals.offReb + totals.defReb} rebotes (${totals.offReb} ofensivos), ${totals.assists} asistencias y ${totals.turnovers} pérdidas en la muestra.`);
    if (rows.some(row => row.metrics.warnings.length)) notes.push("Hay discrepancias entre el acta y el marcador o los minutos: consultar los avisos de los informes detallados.");
  } else notes.push("Algunas actas individuales no están disponibles: los indicadores de tiro y acciones agregadas se muestran como N/D.");
  return { rows, scores, totals, scored: scores.length === rows.length ? scored : null,
    conceded: scores.length === rows.length ? conceded : null, wins, losses, ties, notes };
}

function scoreChart(rows) {
  const valid = rows.filter(row => row.forPoints !== null && row.againstPoints !== null);
  if (!valid.length) return "<p>No hay marcadores completos para graficar.</p>";
  const width = 640, plotWidth = 490, max = Math.max(1, ...valid.flatMap(row => [row.forPoints,row.againstPoints]));
  const height = Math.max(100, valid.length * 47 + 34);
  const bars = valid.map((row, i) => {
    const y = 18 + i * 47;
    const a = row.forPoints / max * plotWidth, b = row.againstPoints / max * plotWidth;
    return `<text x="3" y="${y + 18}" font-size="11" fill="#334155">P${i + 1}</text><rect x="38" y="${y}" width="${a}" height="14" rx="2" fill="#1e40af"/><rect x="38" y="${y + 17}" width="${b}" height="14" rx="2" fill="#ea580c"/><text x="${42 + a}" y="${y + 11}" font-size="10">${row.forPoints}</text><text x="${42 + b}" y="${y + 28}" font-size="10">${row.againstPoints}</text>`;
  }).join("");
  return `<svg role="img" aria-label="Comparación de puntos anotados y recibidos por partido" viewBox="0 0 ${width} ${height}" style="width:100%;height:auto">${bars}</svg><small>Azul: nuestro equipo · Naranja: rival. P1, P2… siguen el orden de la selección.</small>`;
}
function proportionChart(totals) {
  if (!totals) return "<p>Desglose de tiros: N/D (faltan actas).</p>";
  const attempts = [totals.fg2a,totals.fg3a,totals.fta];
  const colors = ["#1e40af","#0891b2","#d97706"];
  const names = ["T2","T3","TL"];
  const max = Math.max(1,...attempts);
  return `<svg role="img" aria-label="Volumen de lanzamientos por tipo" viewBox="0 0 360 150" style="width:100%;height:auto">${attempts.map((count,i)=>`<text x="4" y="${26+i*43}" font-size="12">${names[i]}</text><rect x="42" y="${12+i*43}" width="${count/max*255}" height="22" rx="3" fill="${colors[i]}"/><text x="${47+count/max*255}" y="${27+i*43}" font-size="11">${count}</text>`).join("")}</svg><small>Intentos registrados, no porcentajes ni posesiones estimadas.</small>`;
}

/** Portada/primer bloque antes del BoxScore y mapas detallados. */
export function renderSelectedGamesOverview(entries = [], { title = "Resumen visual de los partidos seleccionados" } = {}) {
  const s = buildSelectedGamesSummary(entries);
  const t = s.totals;
  const cards = [
    card("Partidos seleccionados", s.rows.length, `${s.wins} V · ${s.losses} D${s.ties ? ` · ${s.ties} E` : ""}`),
    card("Puntos a favor", num(s.scored), s.scored === null ? "Marcadores incompletos" : `${(s.scored/s.rows.length).toFixed(1)} por partido`),
    card("Puntos en contra", num(s.conceded)),
    card("Diferencial", s.scored === null ? "N/D" : `${s.scored - s.conceded > 0 ? "+" : ""}${s.scored-s.conceded}`),
    card("Tiro de 2", t ? pct(t.fg2m,t.fg2a) : "N/D", t ? `${t.fg2m}/${t.fg2a}` : "Acta incompleta"),
    card("Triple", t ? pct(t.fg3m,t.fg3a) : "N/D", t ? `${t.fg3m}/${t.fg3a}` : "Acta incompleta"),
    card("Tiros libres", t ? pct(t.ftm,t.fta) : "N/D", t ? `${t.ftm}/${t.fta}` : "Acta incompleta"),
    card("Rebotes", t ? t.offReb+t.defReb : "N/D", t ? `${t.offReb} RO · ${t.defReb} RD` : ""),
    card("Asistencias / pérdidas", t ? `${t.assists} / ${t.turnovers}` : "N/D"),
    card("Valoración FIBA acumulada", t ? t.pir : "N/D", "Suma de actas disponibles")
  ].join("");
  const style = `<style>.iq-overview{background:#fff;border:2px solid #dbeafe;border-radius:14px;padding:18px;margin:16px 0;break-inside:auto;color:#0f172a}.iq-overview h2{color:#1e3a8a;margin:0 0 8px}.iq-overview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(138px,1fr));gap:9px}.iq-overview-card{background:#eff6ff;border-left:4px solid #1e40af;border-radius:7px;padding:10px;break-inside:avoid}.iq-overview-card span,.iq-overview-card strong,.iq-overview-card small{display:block}.iq-overview-card span{font-size:10px;text-transform:uppercase;font-weight:800}.iq-overview-card strong{font-size:21px}.iq-overview-card small{font-size:10px;color:#475569}.iq-overview-charts{display:grid;grid-template-columns:1fr 1fr;gap:12px}.iq-overview-charts>div{border:1px solid #cbd5e1;border-radius:9px;padding:8px;break-inside:avoid}.iq-overview li{margin:4px 0}@media(max-width:650px){.iq-overview-charts{grid-template-columns:1fr}}@media print{.iq-overview{break-inside:auto!important}.iq-overview-charts{grid-template-columns:1fr 1fr}.iq-overview-grid{grid-template-columns:repeat(5,minmax(0,1fr))}.iq-overview-card{padding:6px}.iq-overview-card strong{font-size:17px}}</style>`;
  return `${style}<section class="iq-overview" aria-label="Resumen visual selección"><h2>${escape(title)}</h2><p>${s.rows.length} partido(s) de la selección autorizada. Indicadores calculados solo con marcadores y actas realmente disponibles.</p><div class="iq-overview-grid">${cards}</div><div class="iq-overview-charts"><div><h3>Puntos: equipo frente a rivales</h3>${scoreChart(s.rows)}</div><div><h3>Volumen de tiros por tipo</h3>${proportionChart(t)}</div></div><h3>Lectura rápida · basada en los datos</h3><ul>${s.notes.map(note=>`<li>${escape(note)}</li>`).join("")}</ul><p style="font-size:10px;color:#475569">La comparación describe esta muestra; no atribuye causas ni proyecta resultados. N/D = dato no disponible. Actas, comparativas y mapas desglosados a continuación.</p></section>`;
}
