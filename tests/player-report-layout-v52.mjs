import assert from "node:assert/strict";
import { ReportsViewV50 } from "../views/ReportsViewV50.js";
import { ReportsView } from "../views/ReportsView.js";
import { DataStore } from "../services/DataStore.js";

// V51 probaba existencia de tablas, no su posición; el PDF mostraba antes
// una ficha gráfica muy alta y el usuario no llegaba al acta con tiros.
const originalCard = ReportsView.prototype._renderSinglePlayerCard;
const originalRead = DataStore.getPlayerGameStats;
ReportsView.prototype._renderSinglePlayerCard = () => '<div id="legacy-player-visuals">Radar y mapa</div>';
DataStore.getPlayerGameStats = () => [{
  player_id: "p1", game_id: "g1", minutes: 13, points: 8,
  fg2_made: 4, fg2_attempted: 4, fg3_made: 0, fg3_attempted: 0,
  ft_made: 0, ft_attempted: 0, off_reb: 1, def_reb: 4
}];
try {
  const view = Object.create(ReportsViewV50.prototype);
  const html = view._renderSinglePlayerCard(
    { id: "p1", first_name: "Víctor", last_name: "Prueba", jersey: 0 },
    [{ id: "g1", opponent: "CB Coll", date: "2026-09-19" }]
  );
  assert.match(html, /#0 Víctor Prueba/);
  assert.match(html, /Acta individual completa · tiros de campo y estadísticas/);
  assert.match(html, /T2 C\/I/);
  assert.match(html, /TC C\/I/);
  assert.match(html, /4\/4/);
  assert.ok(html.indexOf("Acta individual completa") < html.indexOf("legacy-player-visuals"),
    "Acta y tiros deben preceder al radar y mapa tanto en pantalla como en PDF");
  assert.equal((html.match(/Acta individual completa/g) || []).length, 1,
    "No duplicar tablas individuales al reutilizar la ficha legacy");
} finally {
  if (originalCard) ReportsView.prototype._renderSinglePlayerCard = originalCard;
  else delete ReportsView.prototype._renderSinglePlayerCard;
  DataStore.getPlayerGameStats = originalRead;
}
console.log("PLAYER_REPORT_LAYOUT_V52_OK: tiros y acta primero, gráficos después, dorsal cero conservado");
