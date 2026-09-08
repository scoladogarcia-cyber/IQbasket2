/**
 * @fileoverview Read-only presenter for V46 post-game intelligence.
 * @description Renders descriptive team facts only. It does not fetch, persist,
 * rank players, compare teammates or infer causes from observational BoxScore data.
 */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function translate(t, key, fallback) {
  const value = typeof t === "function" ? t(key, fallback) : fallback;
  return escapeHtml(value || fallback);
}

function factMap(evidenceBundle = {}) {
  return new Map((evidenceBundle.facts || []).map(fact => [fact.metric_key, fact]));
}

function missingMap(evidenceBundle = {}) {
  return new Map((evidenceBundle.missing_data || []).map(item => [item.metric_key, item]));
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "—";
}

function rateLine({ label, made, attempted, metricKey, facts, missing, t }) {
  const fact = facts.get(metricKey);
  if (fact) {
    return `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(made)}/${escapeHtml(attempted)} · ${pct(fact.last_value)}</div>`;
  }

  const reason = missing.get(metricKey)?.reason;
  const note = reason === "LOW_SAMPLE"
    ? translate(t, "game_intelligence_low_sample", "muestra limitada")
    : translate(t, "game_intelligence_unavailable", "sin tasa disponible");
  return `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(made)}/${escapeHtml(attempted)} · <span>${note}</span></div>`;
}

function card(title, icon, body) {
  return `
    <article style="min-width:0;border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#ffffff;">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;font-size:13px;font-weight:800;color:#334155;">
        <span aria-hidden="true">${icon}</span><span>${title}</span>
      </div>
      <div style="display:grid;gap:5px;font-size:13px;line-height:1.45;color:#0f172a;">${body}</div>
    </article>`;
}

/**
 * Create accessible, responsive markup for the deterministic game reading.
 * @param {{intelligence?:{snapshot?:Object,evidenceBundle?:Object},t?:Function}} input
 * @returns {string}
 */
export function renderGameIntelligencePanel({ intelligence = {}, t = null } = {}) {
  const snapshot = intelligence.snapshot || {};
  const evidenceBundle = intelligence.evidenceBundle || {};
  const metrics = snapshot.metrics || {};
  const facts = factMap(evidenceBundle);
  const missing = missingMap(evidenceBundle);
  const title = translate(t, "game_intelligence_title", "Lectura del partido");
  const subtitle = translate(t, "game_intelligence_subtitle", "Lectura descriptiva basada en el BoxScore guardado");

  if (snapshot.quality_status === "NO_DATA" || Number(metrics.tracked_players || 0) === 0) {
    return `
      <section id="game-intelligence-v46" aria-labelledby="game-intelligence-v46-title" style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:14px;padding:18px;background:#f8fafc;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div>
            <h2 id="game-intelligence-v46-title" style="margin:0;font-size:17px;color:#0f172a;">🧠 ${title}</h2>
            <p style="margin:4px 0 0;font-size:12px;color:#64748b;">${subtitle}</p>
          </div>
          <span style="font-size:11px;font-weight:800;color:#475569;border:1px solid #cbd5e1;border-radius:999px;padding:5px 9px;background:white;">${translate(t, "game_intelligence_descriptive", "DESCRIPTIVA")}</span>
        </div>
        <p style="margin:14px 0 0;font-size:13px;color:#475569;">${translate(t, "game_intelligence_no_data", "Todavía no hay un BoxScore guardado suficiente para generar esta lectura.")}</p>
      </section>`;
  }

  const efg = facts.get("competition.game.effective_fg_pct");
  const astTo = facts.get("competition.game.assist_turnover_ratio");
  const mismatch = (evidenceBundle.missing_data || []).some(item => item.reason === "BOX_SCORE_POINTS_MISMATCH");

  const shooting = [
    rateLine({ label: "2P", made: metrics.fg2_made, attempted: metrics.fg2_attempted, metricKey: "competition.game.fg2_pct", facts, missing, t }),
    rateLine({ label: "3P", made: metrics.fg3_made, attempted: metrics.fg3_attempted, metricKey: "competition.game.fg3_pct", facts, missing, t }),
    rateLine({ label: "TL", made: metrics.ft_made, attempted: metrics.ft_attempted, metricKey: "competition.game.ft_pct", facts, missing, t }),
    `<div><strong>eFG%:</strong> ${efg ? pct(efg.last_value) : translate(t, "game_intelligence_low_sample", "muestra limitada")}</div>`
  ].join("");

  const ballCare = [
    `<div><strong>AST:</strong> ${escapeHtml(metrics.assists)}</div>`,
    `<div><strong>${translate(t, "turnovers_short", "PER")}:</strong> ${escapeHtml(metrics.turnovers)}</div>`,
    `<div><strong>AST/PER:</strong> ${astTo ? escapeHtml(Number(astTo.last_value).toFixed(2)) : translate(t, "game_intelligence_ratio_limited", "ratio no interpretable")}</div>`
  ].join("");

  const rebounding = [
    `<div><strong>${translate(t, "rebounds_total_short", "REB")}:</strong> ${escapeHtml(metrics.total_reb)}</div>`,
    `<div>${translate(t, "offensive_rebounds_short", "Ofensivos")}: <strong>${escapeHtml(metrics.off_reb)}</strong></div>`,
    `<div>${translate(t, "defensive_rebounds_short", "Defensivos")}: <strong>${escapeHtml(metrics.def_reb)}</strong></div>`
  ].join("");

  const defense = [
    `<div><strong>${translate(t, "steals_short", "ROB")}:</strong> ${escapeHtml(metrics.steals)}</div>`,
    `<div><strong>${translate(t, "blocks_short", "TAP")}:</strong> ${escapeHtml(metrics.blocks)}</div>`,
    `<div><strong>${translate(t, "fouls_committed_short", "FC")}:</strong> ${escapeHtml(metrics.fouls_committed)}</div>`
  ].join("");

  const qualityNotice = mismatch
    ? `<div role="status" style="margin-top:12px;padding:10px 12px;border:1px solid #fbbf24;border-radius:10px;background:#fffbeb;color:#78350f;font-size:12px;line-height:1.45;"><strong>${translate(t, "game_intelligence_data_check", "Revisar datos")}:</strong> ${translate(t, "game_intelligence_points_mismatch", "los puntos guardados no coinciden con los puntos derivados de los tiros anotados. La lectura se marca como limitada y no corrige el dato automáticamente.")}</div>`
    : "";

  return `
    <section id="game-intelligence-v46" aria-labelledby="game-intelligence-v46-title" data-intelligence-mode="DESCRIPTIVE_ONLY" style="margin-bottom:20px;border:1px solid #cbd5e1;border-radius:14px;padding:18px;background:#f8fafc;box-shadow:0 1px 2px rgba(15,23,42,0.03);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
        <div>
          <h2 id="game-intelligence-v46-title" style="margin:0;font-size:17px;color:#0f172a;">🧠 ${title}</h2>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">${subtitle}</p>
        </div>
        <span style="font-size:11px;font-weight:800;color:#475569;border:1px solid #cbd5e1;border-radius:999px;padding:5px 9px;background:white;">${translate(t, "game_intelligence_descriptive", "DESCRIPTIVA")}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;">
        ${card(translate(t, "game_intelligence_shooting", "Tiro"), "🎯", shooting)}
        ${card(translate(t, "game_intelligence_ball", "Cuidado del balón"), "🏀", ballCare)}
        ${card(translate(t, "game_intelligence_rebounding", "Rebote"), "↕️", rebounding)}
        ${card(translate(t, "game_intelligence_defense", "Actividad defensiva"), "🛡️", defense)}
      </div>
      ${qualityNotice}
      <p style="margin:12px 0 0;font-size:11px;line-height:1.45;color:#64748b;">${translate(t, "game_intelligence_guardrail", "Las tasas con muestra insuficiente se ocultan para evitar falsa precisión. Esta lectura no clasifica jugadoras ni establece causas.")}</p>
    </section>`;
}

export default renderGameIntelligencePanel;
