import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/ready/20260905_apply_demo_player_self_wellness_v1.sql", import.meta.url),
  "utf8"
);

assert.match(migration, /SYNTHETIC_DEMO_NON_PERSONAL/);
assert.match(migration, /PLAYER_SELF_SERVICE/);
assert.match(migration, /team_season_id='d0000000-0000-4000-8000-000000000005'/);
assert.match(migration, /'nutrition'=any\(modules\)/);
assert.match(migration, /'recovery'=any\(modules\)/);
assert.doesNotMatch(migration, /player360_sensitive_access_grants/);
assert.doesNotMatch(migration, /AI_PROCESS|EXPORT/);

console.log("DEMO_PLAYER_SELF_WELLNESS_CONTRACT_OK");
