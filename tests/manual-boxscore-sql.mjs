import assert from "node:assert/strict";
import fs from "node:fs";

const sql=fs.readFileSync(new URL("../supabase/ready/20260903_apply_v7_manual_boxscore.sql",import.meta.url),"utf8");
assert.match(sql,/iq_v7_save_manual_boxscore/i);
assert.match(sql,/BOXSCORE_DERIVED_FROM_PLAY_BY_PLAY/i);
assert.match(sql,/GAME_LOCKED/i);
assert.match(sql,/iq_v5_role_for_game/i);
assert.match(sql,/SUPERADMIN'[\s\S]*ADMIN'[\s\S]*ENTRENADOR'[\s\S]*ANALISTA'/i);
assert.match(sql,/iq_v3_player_eligible_on_date/i);
assert.match(sql,/on conflict \(game_id,player_id\)/i);
assert.match(sql,/from public,anon/i);
console.log("MANUAL_BOXSCORE_SQL_OK");
