/**
 * @fileoverview Pure renderer for the standalone Player Evolution report.
 * @description Uses persisted deterministic Player 360 longitudinal snapshots.
 * It does not calculate new metrics and never invokes an AI provider.
 */

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function number(value, digits = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return parsed.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function trendLabel(value) {
  const direction = String(value || "").toUpperCase();
  if (direction === "UP") return "↗ Ascendente";
  if (direction === "DOWN") return "↘ Descendente";
  if (direction === "STABLE") return "→ Estable";
  return "Datos insuficientes";
}

function metricLabel(key = "") {
  return String(key)
    .replace(/^evaluation\./i, "Evaluación · ")
    .replace(/^game\./i, "Partido · ")
    .replace(/^training\./i, "Entrenamiento · ")
    .replace(/^technification\./i, "Tecnificación · ")
    .replaceAll("_", " ");
}

export class PlayerEvolutionReportRenderer {
  static render({ player = {}, snapshotRow = null, snapshotHistory = [], teamName = "", seasonName = "" } = {}) {
    const playerName = [player.first_name || player.firstName, player.last_name || player.lastName]
      .filter(Boolean).join(" ") || player.name || "Jugador";

    if (!snapshotRow) {
      return `
        <section style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;">
          <h2 style="margin:0 0 8px;font-size:20px;">Evolución de ${escapeHtml(playerName)}</h2>
          <p style="margin:0;color:#64748b;">Todavía no existe un snapshot longitudinal autorizado para este jugador.</p>
        </section>`;
    }

    const snapshot = snapshotRow.snapshot || {};
    const evidence = snapshotRow.evidence_bundle || {};
    const series = Array.isArray(snapshot.series) ? snapshot.series : [];
    const history = Array.isArray(snapshotHistory) ? snapshotHistory : [];

    const seriesHtml = series.length
      ? series.map(item => {
          const trend = item.trend || {};
          const coverage = item.coverage || {};
          const change = Number.isFinite(Number(trend.relative_change_pct))
            ? `${number(trend.relative_change_pct, 1)}%`
            : "—";
          return `
            <article style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;break-inside:avoid;">
              <strong style="display:block;font-size:13px;color:#0f172a;">${escapeHtml(metricLabel(item.key))}</strong>
              <div style="margin-top:5px;font-size:12px;font-weight:800;color:#1e3a8a;">${escapeHtml(trendLabel(trend.direction))}</div>
              <div style="margin-top:5px;font-size:11px;color:#64748b;">
                ${number(trend.first_value, 1)} → ${number(trend.last_value, 1)} · Δ ${escapeHtml(change)} ·
                cobertura ${number(coverage.coverage_pct, 1)}% · n=${number(trend.sample_size, 0)}
              </div>
            </article>`;
        }).join("")
      : '<div style="padding:14px;border:1px dashed #cbd5e1;border-radius:10px;color:#64748b;">El snapshot no contiene series longitudinales.</div>';

    const historyHtml = history.slice(0, 8).map(row => `
      <tr>
        <td style="padding:7px;border-bottom:1px solid #e2e8f0;">${escapeHtml(row.period_start || "")}</td>
        <td style="padding:7px;border-bottom:1px solid #e2e8f0;">${escapeHtml(row.period_end || "")}</td>
        <td style="padding:7px;border-bottom:1px solid #e2e8f0;">${number(row.snapshot?.series?.length, 0)}</td>
        <td style="padding:7px;border-bottom:1px solid #e2e8f0;">${number(row.rejected_observations, 0)}</td>
      </tr>`).join("");

    return `
      <section style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;display:grid;gap:16px;">
        <header style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;">
          <div style="font-size:11px;font-weight:900;color:#1e3a8a;text-transform:uppercase;">IQBasket · Informe independiente</div>
          <h1 style="margin:5px 0 4px;font-size:24px;">Evolución del jugador</h1>
          <h2 style="margin:0;font-size:18px;">${escapeHtml(playerName)}</h2>
          <div style="margin-top:6px;color:#64748b;font-size:12px;">
            ${escapeHtml(teamName)}${seasonName ? ` · ${escapeHtml(seasonName)}` : ""} ·
            ${escapeHtml(snapshotRow.period_start || "")} → ${escapeHtml(snapshotRow.period_end || "")}
          </div>
        </header>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;"><span style="font-size:10px;color:#64748b;font-weight:900;">SEMANAS ELEGIBLES</span><strong style="display:block;font-size:20px;">${number(snapshot.expected_buckets, 0)}</strong></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;"><span style="font-size:10px;color:#64748b;font-weight:900;">MÉTRICAS</span><strong style="display:block;font-size:20px;">${number(series.length, 0)}</strong></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;"><span style="font-size:10px;color:#64748b;font-weight:900;">EVIDENCIAS</span><strong style="display:block;font-size:20px;">${number(evidence?.facts?.length, 0)}</strong></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;"><span style="font-size:10px;color:#64748b;font-weight:900;">DATOS AUSENTES</span><strong style="display:block;font-size:20px;">${number(evidence?.missing_data?.length, 0)}</strong></div>
        </div>

        <section style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;">
          <h3 style="margin:0 0 10px;font-size:15px;">Tendencias observadas</h3>
          <p style="margin:-3px 0 12px;font-size:11px;color:#64748b;">Las tendencias son descriptivas. Una dirección ascendente o descendente no demuestra por sí sola mejora, empeoramiento ni causalidad.</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:9px;">${seriesHtml}</div>
        </section>

        <section style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;overflow:auto;">
          <h3 style="margin:0 0 10px;font-size:15px;">Histórico de snapshots</h3>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead><tr style="background:#f8fafc;"><th style="padding:7px;text-align:left;">Desde</th><th style="padding:7px;text-align:left;">Hasta</th><th style="padding:7px;text-align:left;">Métricas</th><th style="padding:7px;text-align:left;">Observaciones descartadas</th></tr></thead>
            <tbody>${historyHtml || '<tr><td colspan="4" style="padding:10px;color:#64748b;">Sin histórico adicional.</td></tr>'}</tbody>
          </table>
        </section>

        <footer style="font-size:10px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px;">
          Generado desde evidencia longitudinal determinista de IQBasket. No contiene una interpretación IA salvo que ésta se incorpore expresamente en una futura versión autorizada del informe.
        </footer>
      </section>`;
  }
}

export default PlayerEvolutionReportRenderer;
