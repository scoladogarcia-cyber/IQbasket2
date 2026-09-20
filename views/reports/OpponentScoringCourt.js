/**
 * @fileoverview Pista rival reutilizable por Heatmap e informe PDF.
 * @description Sólo puntos de campo con posición real, mismo sistema porcentual
 * (x,y de 0 a 100) que el anotador; no refleja intentos desconocidos.
 */
const escape = value => String(value ?? "").replace(/[&<>"']/g, key => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[key]);

/** @param {object} map Resultado de buildGameShotMaps(...).opponent */
export function renderOpponentScoringCourt(map = {}, { title = "Desde dónde nos han anotado", periodLabel = "" } = {}) {
  const shots = Array.isArray(map.shots) ? map.shots : [];
  const twos = shots.filter(shot => shot.points === 2);
  const threes = shots.filter(shot => shot.points === 3);
  const locatedPoints = twos.length * 2 + threes.length * 3;
  const markers = shots.map(shot => {
    const x = Number(shot.x), y = Number(shot.y), points = Number(shot.points);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100 || ![2, 3].includes(points)) return "";
    return `<circle cx="${(x * 5).toFixed(1)}" cy="${(y * 4.7).toFixed(1)}" r="7" fill="${points === 3 ? "#f59e0b" : "#2563eb"}" fill-opacity=".84" stroke="white" stroke-width="1.8"><title>Canasta rival de ${points} puntos, posición registrada</title></circle>`;
  }).join("");
  return `<section class="iq-opponent-scoring-court" style="background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:12px;padding:14px;break-inside:avoid">
    <h3 style="margin:0 0 6px;font-size:16px">${escape(title)}</h3>
    ${periodLabel ? `<p style="margin:0 0 6px">${escape(periodLabel)}</p>` : ""}
    <p style="margin:0 0 10px;font-size:12px">${escape(map.coverage || "Sin posiciones registradas")}. Puntos localizados: ${locatedPoints}. ${twos.length} canastas de 2 y ${threes.length} de 3 con posición.</p>
    ${markers ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 470" role="img" aria-label="Pista con ${shots.length} canastas rivales localizadas: ${twos.length} de dos puntos y ${threes.length} de tres" style="display:block;width:100%;max-width:520px;height:auto;margin:auto;background:#c87938;border-radius:8px">
      <rect x="2" y="2" width="496" height="466" fill="none" stroke="#fff" stroke-width="3"/>
      <rect x="170" y="0" width="160" height="190" fill="none" stroke="#fff" stroke-width="2.5"/>
      <path d="M170 190 A80 80 0 0 0 330 190 M30 0 V140 A235 235 0 0 0 470 140 V0" fill="none" stroke="#fff" stroke-width="2.5"/>
      <line x1="220" y1="40" x2="280" y2="40" stroke="#fff" stroke-width="3"/><circle cx="250" cy="52" r="15" fill="none" stroke="#fff" stroke-width="3"/>${markers}</svg>` : `<p role="status">No hay canastas rivales de campo con coordenadas para este filtro.</p>`}
    <p style="font-size:12px;margin:10px 0 4px"><span style="color:#2563eb;font-weight:800">●</span> Canasta rival de 2 · <span style="color:#b45309;font-weight:800">●</span> Canasta rival de 3.</p>
    <small style="display:block;color:#475569">${escape(map.note || "Los tiros libres no tienen posición. Los fallos rivales no están registrados de forma completa: no se muestran porcentajes de acierto.")}</small>
  </section>`;
}
