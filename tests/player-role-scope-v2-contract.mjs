import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [sql, view] = await Promise.all([
  readFile(new URL("../supabase/ready/20260905_apply_v7_player_role_scope_hotfix.sql", import.meta.url), "utf8"),
  readFile(new URL("../views/TranslationsView.js", import.meta.url), "utf8")
]);

assert.match(sql, /p_team_season_id uuid/i);
assert.match(sql, /from public\.roster_memberships rm[\s\S]*join public\.team_seasons ts/i);
assert.match(sql, /rm\.player_id=p_linked_player_id[\s\S]*rm\.team_season_id=p_team_season_id/i);
assert.match(sql, /PLAYER_LINK_ROSTER_MEMBERSHIP_REQUIRED/i);
assert.doesNotMatch(sql, /select p\.team_id into v_player_team/i);
assert.match(sql, /assigned_team_ids=case when v_role='JUGADOR' then array\[v_player_team\]/i);
assert.match(sql, /team_season_memberships[\s\S]*function_role='JUGADOR'/i);
assert.match(view, /p_team_season_id:\s*newRole === UserRole\.JUGADOR \? provisioningTeamSeasonId : null/);
assert.match(view, /PLAYER_LINK_ROSTER_MEMBERSHIP_REQUIRED/);
assert.match(view, /PLAYER_LINK_SCOPE_DENIED/);

console.log("PLAYER_ROLE_SCOPE_V2_CONTRACT_OK");
