import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../views/player360/passport/PlayerPassportView.js",import.meta.url),"utf8");

assert.match(source,/this\.editorDraft = new Map\(\)/);
assert.match(source,/_editorState\(attribute, latest\)/);
assert.match(source,/Valor actual/);
assert.match(source,/Sin valoración previa/);
assert.match(source,/data-current-score/);
assert.match(source,/Solo se crea una nueva observación para los atributos que toques/);
assert.match(source,/this\._setDraftFromRow\(row,\{score:/);
assert.match(source,/this\.editorDraft\.entries\(\)/);
assert.match(source,/No has modificado ni añadido ninguna valoración/);
assert.match(source,/NE no borra una valoración histórica/);
assert.match(source,/Cambiar el contexto descartará los cambios/);
assert.match(source,/Guardar cambios observados/);

console.log("player-passport-prefill-current-values OK");
