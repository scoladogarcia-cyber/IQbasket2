import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(
  new URL("../supabase/ready/20260905_apply_v7_player_role_link_integrity.sql", import.meta.url),
  "utf8"
);

assert.match(sql, /iq_v7_assign_user_role_context\(\s*p_user_id uuid,\s*p_role text,\s*p_linked_player_id uuid default null/i);
assert.match(sql, /if v_role='JUGADOR' then[\s\S]*PLAYER_LINK_REQUIRED/i);
assert.match(sql, /PLAYER_LINK_PLAYER_NOT_FOUND/i);
assert.match(sql, /PLAYER_LINK_SCOPE_DENIED/i);
assert.match(sql, /linked_player_id=case when v_role='JUGADOR'/i);
assert.match(sql, /relation_type='SELF'/i);
assert.match(sql, /status='INACTIVE'/i);
assert.match(sql, /on conflict \(user_id,player_id,relation_type\) do update/i);
assert.match(sql, /return public\.iq_v7_assign_user_role_context\(p_user_id,p_role,null\)/i);
assert.match(sql, /revoke all on function public\.iq_v7_assign_user_role_context\(uuid,text,uuid\) from public, anon/i);
assert.match(sql, /grant execute on function public\.iq_v7_assign_user_role_context\(uuid,text,uuid\) to authenticated/i);

console.log("PLAYER_ROLE_LINK_INTEGRITY_CONTRACT_OK");
