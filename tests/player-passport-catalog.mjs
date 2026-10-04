import assert from "node:assert/strict";
import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync(new URL("../config/player-passport.catalog.json", import.meta.url), "utf8"));
assert.equal(catalog.schema_version, "1.0");
assert.equal(catalog.rules.birth_date_field, "players.birth_date");
assert.equal(catalog.rules.age_is_derived, true);
assert.equal(catalog.rules.persist_age, false);
assert.equal(catalog.rules.no_overall_required, true);
assert.equal(catalog.rules.legacy_0_10_auto_conversion, false);
assert.equal(catalog.attributes.length, 69);

const codes = new Set();
let anchorCount = 0;
for (const attribute of catalog.attributes) {
  assert.ok(attribute.code);
  assert.equal(codes.has(attribute.code), false, `duplicate code ${attribute.code}`);
  codes.add(attribute.code);
  assert.ok(["technical","decision","defense","mental","collective"].includes(attribute.family));
  assert.ok(Array.isArray(attribute.anchors));
  assert.equal(attribute.anchors.length, 5, `${attribute.code} must have five anchors`);
  assert.deepEqual(attribute.anchors.map(x => x.level), [1,2,3,4,5]);
  anchorCount += attribute.anchors.length;
}
assert.equal(anchorCount, 345);
console.log("player-passport-catalog OK");
