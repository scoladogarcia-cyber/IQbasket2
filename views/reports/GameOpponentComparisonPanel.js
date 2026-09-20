/** @fileoverview Comparativo explícito de nuestro equipo vs rival, sin ceros inventados. */
import { buildGameReportMetrics, formatMetric } from "../../domain/stats/GameReportMetrics.js";
import { buildOpponentGameComparison } from "../../domain/stats/OpponentGameComparison.js";
const esc = v => String(v ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[ch]);
const val = entry => entry?.value === null || entry?.value === undefined ? "N/D" : String(entry.value);
const valWithSource = entry => `<strong>${esc(val(entry))}</strong><small style="display:block;color:#64748b">${esc(entry?.source || "no disponible")}</small>`;
const own = (value, qualifier = "acta") => `<strong>${esc(value ?? "N/D")}</strong><small style="display:block;color:#64748b">${esc(qualifier)}</small>`;
const pct = (m,a) => a > 0 ? formatMetric(m * 100 / a,"%") : "N/D";
const score = (m,a) => m.value === null || a.value === null ? "N/D" : `${m.value}/${a.value}`;
const scoreSource = (m,a) => m.source === a.source ? m.source : `${m.source}; ${a.source}`;

/** @returns {string} HTML escapado y autocontenido para pantalla e impresión. */
export function renderGameOpponentComparisonPanel({ game = {}, stats = [], teamStats = null, events = [], eventsAvailable = true } = {}) {
  const totals = buildGameReportMetrics(stats,game).totals;
  const { opponent: opp, warnings } = buildOpponentGameComparison({game,teamStats,events,eventsAvailable});
  const pair = (made,attempted) => ({value:score(made,attempted),source:scoreSource(made,attempted)});
  const rows = [
    ["Puntos",own(game.team_score ?? game.teamScore ?? game.our_score),valWithSource(opp.points)],
    ["Tiros de 2 (C/I)",own(`${totals.fg2m}/${totals.fg2a}`),valWithSource(pair(opp.fg2m,opp.fg2a))],
    ["Acierto T2%",own(pct(totals.fg2m,totals.fg2a)),valWithSource(opp.fg2pct.value === null ? opp.fg2pct : {...opp.fg2pct, value:`${opp.fg2pct.value}%`})],
    ["Tiros de 3 (C/I)",own(`${totals.fg3m}/${totals.fg3a}`),valWithSource(pair(opp.fg3m,opp.fg3a))],
    ["Acierto T3%",own(pct(totals.fg3m,totals.fg3a)),valWithSource(opp.fg3pct.value === null ? opp.fg3pct : {...opp.fg3pct,value:`${opp.fg3pct.value}%`})],
    ["Tiros libres (C/I)",own(`${totals.ftm}/${totals.fta}`),valWithSource(pair(opp.ftm,opp.fta))],
    ["Acierto TL%",own(pct(totals.ftm,totals.fta)),valWithSource(opp.ftpct.value === null ? opp.ftpct : {...opp.ftpct,value:`${opp.ftpct.value}%`})],
    ["Tiros de campo (C/I)",own(`${totals.fg2m+totals.fg3m}/${totals.fga}`),valWithSource(pair(opp.fgm,opp.fga))],
    ["Acierto TC%",own(pct(totals.fg2m+totals.fg3m,totals.fga)),valWithSource(opp.fgpct.value === null ? opp.fgpct : {...opp.fgpct,value:`${opp.fgpct.value}%`})],
    ["Rebotes ofensivos",own(totals.offReb),valWithSource(opp.offReb)],
    ["Rebotes defensivos",own(totals.defReb),valWithSource(opp.defReb)],
    ["Rebotes totales",own(totals.rebounds),valWithSource(opp.rebounds)],
    ["Pérdidas",own(totals.turnovers),valWithSource(opp.turnovers)]
  ];
  return `<section class="iq-report-panel iq-opponent-comparison"><h2>Comparativa: tiros y rebotes · nuestro equipo / ${esc(game.opponent || "rival")}</h2>
    <p>Los valores rivales indican su fuente debajo. «Eventos registrados» representa el recuento encontrado, no una certificación de acta completa. Si faltan intentos, se muestran aciertos conocidos / N/D y nunca porcentajes ficticios.</p>
    <div class="iq-report-scroll" style="overflow-x:auto"><table class="iq-table" style="width:100%;border-collapse:collapse;min-width:420px"><thead><tr><th>Estadística</th><th>Nuestro equipo</th><th>${esc(game.opponent || "Rival")}</th></tr></thead><tbody>
      ${rows.map(([label,our,their])=>`<tr><th scope="row">${esc(label)}</th><td>${our}</td><td>${their}</td></tr>`).join("")}
    </tbody></table></div>
    ${warnings.length ? `<p style="font-weight:750;color:#92400e">Calidad y cobertura:</p><ul>${warnings.map(w=>`<li>${esc(w)}</li>`).join("")}</ul>` : ""}
  </section>`;
}
