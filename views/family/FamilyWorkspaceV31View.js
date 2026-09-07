/**
 * @fileoverview V31 Family workspace with a first-class team dashboard layer.
 * @description Extends the V30 server-masked team snapshot into a richer global
 * team summary while keeping the linked-player support workspace intact.
 * Other-player identity continues to be decided by the backend snapshot.
 */
import { FamilyWorkspaceV30View } from "./FamilyWorkspaceV30View.js";

const esc = (value = "") => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const one = value => n(value).toFixed(1);

export class FamilyWorkspaceV31View extends FamilyWorkspaceV30View {
  _teamSection(snapshot = {}) {
    const team = snapshot.team || {};
    const m = snapshot.team_metrics || {};
    const privacy = snapshot.privacy || {};
    const players = Array.isArray(snapshot.players) ? snapshot.players : [];
    const games = n(m.games);
    const wins = n(m.wins);
    const losses = n(m.losses);
    const winPct = games > 0 ? (wins / games) * 100 : 0;
    const pointDiff = n(m.points_for_avg) - n(m.points_against_avg);
    const astPg = games > 0 ? n(m.assists) / games : 0;
    const rebPg = games > 0 ? n(m.rebounds) / games : 0;
    const tovPg = games > 0 ? n(m.turnovers) / games : 0;

    const rows = players.map(player => `<tr class="${player.linked ? "family-team-linked" : ""}">
      <td><strong>${esc(this._playerIdentity(player))}</strong>${player.linked ? `<small>Tu jugador</small>` : ""}</td>
      <td>${n(player.games)}</td><td>${one(player.mpg)}</td><td>${one(player.ppg)}</td>
      <td>${one(player.rpg)}</td><td>${one(player.apg)}</td><td>${one(player.eval_pg)}</td>
      <td>${n(player.plus_minus) > 0 ? "+" : ""}${n(player.plus_minus)}</td>
    </tr>`).join("");

    const identityText = privacy.show_other_player_names && privacy.show_other_player_jerseys
      ? "Se muestran nombres y dorsales del resto de la plantilla."
      : !privacy.show_other_player_names && !privacy.show_other_player_jerseys
        ? "La identidad del resto está protegida: se muestra sólo su posición, manteniendo sus métricas deportivas comparables."
        : "Nombres y dorsales se muestran según la configuración de privacidad; la posición permanece visible.";

    return `<section class="family-team-v31" aria-labelledby="family-team-v31-title">
      <style>
        .family-team-v31{background:#fff;border:1px solid #cbd5e1;border-radius:18px;padding:20px;margin:18px 0;box-shadow:0 5px 20px rgba(15,23,42,.04);color:#0f172a}.family-team-v31 *{box-sizing:border-box}.family-team-v31 h2{margin:3px 0 5px;font-size:clamp(21px,5vw,28px)}.family-team-v31 p{margin:0;color:#64748b;line-height:1.5}.family-team-eyebrow{font-size:11px!important;font-weight:900;color:#1d4ed8!important;letter-spacing:.12em}.family-team-purpose{margin-top:8px!important;padding:10px 12px;border-radius:10px;background:#eff6ff;color:#1e3a8a!important;font-size:12px}.family-team-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:15px 0}.family-team-kpi{border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:11px;min-height:78px}.family-team-kpi strong{display:block;font-size:20px;line-height:1.15}.family-team-kpi span{display:block;margin-top:5px;font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase}.family-team-kpi.primary{background:#0f172a;border-color:#0f172a}.family-team-kpi.primary strong{color:#fff}.family-team-kpi.primary span{color:#cbd5e1}.family-team-table-title{display:flex;justify-content:space-between;align-items:end;gap:10px;flex-wrap:wrap;margin:18px 0 8px}.family-team-table-title strong{font-size:14px}.family-team-table-title span{font-size:11px;color:#64748b}.family-team-table-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:12px;-webkit-overflow-scrolling:touch}.family-team-v31 table{width:100%;border-collapse:collapse;min-width:720px}.family-team-v31 th,.family-team-v31 td{padding:10px 9px;border-bottom:1px solid #eef2f7;text-align:center;font-size:12px}.family-team-v31 th:first-child,.family-team-v31 td:first-child{text-align:left;min-width:190px}.family-team-v31 th{background:#f8fafc;color:#475569;font-size:10px;text-transform:uppercase}.family-team-v31 td small{display:block;color:#2563eb;font-size:9px;margin-top:2px}.family-team-linked{background:#eff6ff}.family-team-privacy{font-size:11px!important;margin-top:10px!important}
        @media(max-width:760px){.family-team-v31{padding:15px;border-radius:14px}.family-team-kpis{grid-template-columns:repeat(2,1fr)}.family-team-kpi{min-height:72px}}
      </style>
      <p class="family-team-eyebrow">DASHBOARD · VISIÓN GLOBAL DEL EQUIPO</p>
      <h2 id="family-team-v31-title">${esc(team.team_name || "Equipo")} · ${esc(team.season_name || "")}</h2>
      <p>Primero ves el rendimiento global del equipo; después, el área Family profundiza únicamente en tu jugador vinculado.</p>
      <p class="family-team-purpose">🏀 Esta capa usa datos deportivos agregados del equipo. No amplía el acceso a bienestar, nutrición, notas privadas ni otros datos personales de compañeros.</p>
      <div class="family-team-kpis">
        ${this._v31Kpi("Balance", `${wins}-${losses}`, true)}
        ${this._v31Kpi("% victorias", `${one(winPct)}%`)}
        ${this._v31Kpi("PF / partido", one(m.points_for_avg))}
        ${this._v31Kpi("PC / partido", one(m.points_against_avg))}
        ${this._v31Kpi("Diferencial / partido", `${pointDiff > 0 ? "+" : ""}${one(pointDiff)}`)}
        ${this._v31Kpi("eFG%", `${one(m.efg)}%`)}
        ${this._v31Kpi("ORtg", one(m.ortg))}
        ${this._v31Kpi("DRtg", one(m.drtg))}
        ${this._v31Kpi("AST / partido", one(astPg))}
        ${this._v31Kpi("REB / partido", one(rebPg))}
        ${this._v31Kpi("Pérdidas / partido", one(tovPg))}
        ${this._v31Kpi("Partidos", games)}
      </div>
      <div class="family-team-table-title"><strong>Comparación deportiva de plantilla</strong><span>Identidad según privacidad · métricas de temporada</span></div>
      <div class="family-team-table-wrap"><table><thead><tr><th>Jugador / posición</th><th>PJ</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>VAL</th><th>+/-</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="8">Aún no hay estadísticas comparables.</td></tr>`}</tbody></table></div>
      <p class="family-team-privacy">🔐 ${esc(identityText)}</p>
    </section>`;
  }

  _v31Kpi(label, value, primary = false) {
    return `<article class="family-team-kpi${primary ? " primary" : ""}"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`;
  }
}

export default FamilyWorkspaceV31View;
