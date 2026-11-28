import assert from "node:assert/strict";
import { COMMERCIAL_PACKAGE_CATALOG as catalog, COMMERCIAL_ROLLOUT_LABELS as labels, COMMERCIAL_EXTENSIONS } from "../config/commercial-package-catalog.config.js";
assert.deepEqual(catalog.map(group => group.id), ["TEAMS", "COACHES", "PLAYERS", "FAMILIES"]);
const offers = catalog.flatMap(group => group.offers);
assert.equal(new Set(offers.map(offer => offer.id)).size, offers.length);
const existingPlans = new Set(["TEAM_STARTER","TEAM_PRO","CLUB","ACADEMY","FAMILY_FREE","FAMILY","FAMILY_PRO"]);
for (const offer of offers) {
  assert.ok(offer.features.length && labels[offer.rollout]);
  assert.ok(offer.planCodes.every(code => existingPlans.has(code)));
  assert.ok(Object.isFrozen(offer) && Object.isFrozen(offer.features));
  assert.ok(!("price" in offer) && !("permissions" in offer) && !("checkout" in offer));
}
assert.deepEqual(offers.find(offer => offer.id === "FAMILY_INCLUDED").planCodes, ["FAMILY_FREE"]);
assert.equal(offers.find(offer => offer.id === "COACH_INDEPENDENT").planCodes.length, 0);
assert.equal(offers.find(offer => offer.id === "PLAYER_INTELLIGENCE").rollout, "GATED");
assert.ok(COMMERCIAL_EXTENSIONS.includes("Scouting Pro"));
console.log("COMMERCIAL_PACKAGE_CATALOG_OK");
