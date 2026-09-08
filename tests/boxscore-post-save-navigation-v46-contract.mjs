import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  isConfirmedBoxScoreSaveRerender,
  resolveBoxScorePostSaveDestination
} from "../views/games/BoxScorePostSaveNavigationV46.js";

assert.equal(resolveBoxScorePostSaveDestination(false), "#/games");
assert.equal(resolveBoxScorePostSaveDestination(true), "#/dashboard");

assert.equal(isConfirmedBoxScoreSaveRerender({
  targetGameId: "game-1",
  selectedGameId: "game-1",
  saveButtonDisabled: true
}), true, "Un guardado confirmado debe activar el retorno a Partidos.");

assert.equal(isConfirmedBoxScoreSaveRerender({
  targetGameId: "game-1",
  selectedGameId: "game-1",
  saveButtonDisabled: false
}), false, "Un guardado fallido/no confirmado no debe navegar.");

assert.equal(isConfirmedBoxScoreSaveRerender({
  targetGameId: "game-2",
  selectedGameId: "game-1",
  saveButtonDisabled: true
}), false, "Cambiar de partido no debe confundirse con un post-save.");

const root = new URL("../", import.meta.url);
const [baseSource, enhancerSource] = await Promise.all([
  readFile(new URL("views/GameBoxScoreBaseView.js", root), "utf8"),
  readFile(new URL("views/games/GameBoxScoreIntelligenceV46View.js", root), "utf8")
]);

assert.match(baseSource, /await this\.render\(containerId, currentGame\.id\)/,
  "La base debe seguir notificando éxito mediante el re-render establecido.");
assert.match(baseSource, /if \(saveButton\) saveButton\.disabled = false/,
  "El error debe reactivar Guardar y no activar la navegación de éxito.");
assert.match(enhancerSource, /window\.location\.hash = resolveBoxScorePostSaveDestination/);
assert.doesNotMatch(enhancerSource, /saveGameAndStats|saveCapture\(/,
  "La extensión UX no puede duplicar la persistencia del BoxScore.");

console.log("V46 BOXSCORE POST-SAVE NAVIGATION OK");
