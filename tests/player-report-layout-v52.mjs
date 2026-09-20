import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderPlayerCompleteBoxScore } from "../views/reports/PlayerCompleteBoxScore.js";

// La prueba V51 comprobaba que las tablas existían, no dónde aparecían.
// Inspeccionar la plantilla real evita importar módulos CDN exclusivos del navegador.
const source = readFileSync(new URL("../views/ReportsViewV50.js", import.meta.url), "utf8");
const start = source.indexOf("  _renderSinglePlayerCard(player, games) {");
const end = source.indexOf("  /** Selección exacta", start);
assert.ok(start > 0 && end > start, "Localizar el renderizador activo de la ficha");
const playerCard = source.slice(start, end);
assert.match(playerCard, /const detail = renderPlayerCompleteBoxScore\(/);
assert.match(playerCard, /const original = super\._renderSinglePlayerCard\(player, games\)/);
assert.ok(playerCard.indexOf("${detail}") > 0 && playerCard.indexOf("${original}") > playerCard.indexOf("${detail}"),
  "En la plantilla de pantalla/PDF el acta debe preceder al radar y mapa");
assert.match(playerCard, /player\.jersey \?\? player\.number/, "Dorsal cero visible");
assert.match(playerCard, /escapeHtml\(label\)/, "Cabecera segura e identificada");
assert.equal((playerCard.match(/\$\{detail\}/g) || []).length, 1, "El acta se inserta una sola vez");

const html = renderPlayerCompleteBoxScore({
  player: { id: "p1", first_name: "Víctor", jersey: 0 },
  games: [{ id: "g1", opponent: "CB Coll", date: "2026-09-19" }],
  stats: [{ player_id: "p1", game_id: "g1", minutes: 13, points: 8,
    fg2_made: 4, fg2_attempted: 4, fg3_made: 0, fg3_attempted: 0,
    ft_made: 0, ft_attempted: 0, off_reb: 1, def_reb: 4 }]
});
assert.match(html, /Acta individual completa · tiros de campo y estadísticas/);
assert.match(html, /T2 C\/I/);
assert.match(html, /TC C\/I/);
assert.match(html, /4\/4/);
console.log("PLAYER_REPORT_LAYOUT_V52_OK: acta y tiros primero, radar después, dorsal cero conservado");
