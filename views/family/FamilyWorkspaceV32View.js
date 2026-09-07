/**
 * @fileoverview V32 Family workspace with coherent basic longitudinal evidence.
 * @description BASIC_STATS/GAME_HISTORY evidence is enough to show simple,
 * responsible sporting trends even when the commercial advanced Player360
 * entitlement is not included. Advanced objectives/evaluations remain gated.
 */
import { FamilyWorkspaceV31View } from "./FamilyWorkspaceV31View.js";
import { presentFamilyPlayer360 } from "../../domain/family/FamilyPlayer360Presenter.js";

const esc = (value = "") => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function chronologicalRecentGames(passport = {}) {
  const rows = Array.isArray(passport.recent_games) ? passport.recent_games : [];
  return [...rows]
    .filter(row => row && (row.date || row.game_id))
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .slice(-12);
}

export class FamilyWorkspaceV32View extends FamilyWorkspaceV31View {
  _basicStory() {
    const games = chronologicalRecentGames(this.state?.passport || {});
    if (!games.length) return null;
    return presentFamilyPlayer360({ recent_games: games });
  }

  _familyDashboard(growth = {}, weeklyPlan = {}, developmentCycle = {}) {
    const basicStory = this._basicStory();
    const effectiveStory = basicStory?.enoughEvidence
      ? basicStory
      : growth?.story || basicStory || null;
    const dashboard = super._familyDashboard(
      { ...growth, story: effectiveStory },
      weeklyPlan,
      developmentCycle
    );
    return `${dashboard}${this._basicTrendCharts()}`;
  }

  _basicTrendCharts() {
    const games = chronologicalRecentGames(this.state?.passport || {});
    if (games.length < 2) return "";

    return `<section class="family-basic-trends" aria-labelledby="family-basic-trends-title">
      <style>
        .family-basic-trends{background:#fff;border:1px solid #dbe3ee;border-radius:18px;padding:20px;margin:14px 0;color:#0f172a;box-shadow:0 5px 20px rgba(15,23,42,.04)}
        .family-basic-trends *{box-sizing:border-box}.family-basic-trends h2{margin:3px 0 5px;font-size:clamp(20px,5vw,26px)}.family-basic-trends p{margin:0;color:#64748b;line-height:1.5}.family-basic-trends-eyebrow{font-size:11px!important;font-weight:900;color:#1d4ed8!important;letter-spacing:.12em}.family-trend-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:15px}.family-trend-card{border:1px solid #e2e8f0;border-radius:14px;padding:14px;min-width:0}.family-trend-card h3{margin:0 0 3px;font-size:14px}.family-trend-card>p{font-size:11px}.family-trend-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;padding-top:12px}.family-trend-bars{height:150px;min-width:420px;display:grid;grid-template-columns:repeat(var(--count),minmax(24px,1fr));gap:6px;align-items:end;border-bottom:1px solid #cbd5e1;padding:0 4px}.family-trend-bar{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;min-width:0}.family-trend-bar strong{font-size:9px;color:#475569}.family-trend-fill{width:70%;min-height:4px;border-radius:6px 6px 2px 2px;background:#1e3a8a}.family-trend-card.minutes .family-trend-fill{background:#c2410c}.family-trend-bar span{height:18px;font-size:8px;color:#64748b;white-space:nowrap}.family-trend-note{margin-top:10px!important;font-size:10px!important;color:#64748b!important}
        @media(max-width:700px){.family-basic-trends{padding:15px}.family-trend-grid{grid-template-columns:1fr}.family-trend-bars{height:135px}}
      </style>
      <p class="family-basic-trends-eyebrow">EVOLUCIÓN DEPORTIVA · ÚLTIMOS PARTIDOS</p>
      <h2 id="family-basic-trends-title">Tendencias visibles, sin sacar conclusiones de más</h2>
      <p>Se muestran los registros disponibles en orden cronológico. Son una referencia descriptiva para contextualizar la progresión.</p>
      <div class="family-trend-grid">
        ${this._barChart(games,"points","Puntos")}
        ${this._barChart(games,"minutes","Minutos",true)}
      </div>
      <p class="family-trend-note">Las variaciones pueden depender del rival, rol, minutos, contexto del partido y otras circunstancias. IQBasket no las interpreta como causalidad.</p>
    </section>`;
  }

  _barChart(games, key, title, minutes = false) {
    const max = Math.max(1, ...games.map(game => n(game[key])));
    const bars = games.map((game, index) => {
      const value = n(game[key]);
      const height = value <= 0 ? 3 : Math.max(7, Math.round((value / max) * 100));
      const date = String(game.date || "").slice(5).replace("-", "/") || `P${index + 1}`;
      const opponent = game.opponent || "Rival";
      const accessible = `${title}: ${value}. ${opponent}. ${game.date || ""}`;
      return `<div class="family-trend-bar" aria-label="${esc(accessible)}" title="${esc(accessible)}">
        <strong>${esc(value)}</strong><i class="family-trend-fill" style="height:${height}%"></i><span>${esc(date)}</span>
      </div>`;
    }).join("");
    return `<article class="family-trend-card${minutes ? " minutes" : ""}">
      <h3>${esc(title)}</h3><p>${games.length} partidos comparables</p>
      <div class="family-trend-scroll"><div class="family-trend-bars" style="--count:${games.length}">${bars}</div></div>
    </article>`;
  }
}

export { chronologicalRecentGames };
export default FamilyWorkspaceV32View;
