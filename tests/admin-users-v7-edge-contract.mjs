import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../supabase/functions/admin-users/index.ts", import.meta.url),
  "utf8"
);

// Authentication and authorization must be server-side and fail closed.
assert.match(source, /authorization\.startsWith\("Bearer "\)/);
assert.match(source, /callerClient\.auth\.getUser\(\)/);
assert.match(source, /user_account_controls/);
assert.match(source, /account_status\s*!==\s*"ACTIVE"/);
assert.match(source, /iq_v3_is_global_superadmin/);
assert.doesNotMatch(source, /user_metadata[^\n]{0,120}(role|permission)/i);

// V7 identity model only: legacy V6 provisioning columns must never return.
assert.match(source, /assigned_team_ids/);
assert.match(source, /global_role/);
assert.match(source, /linked_player_id/);
assert.doesNotMatch(source, /\ballowed_team_ids\b/);
assert.doesNotMatch(source, /\bclub_id\b/);
assert.doesNotMatch(source, /\bteam_id:\s*requestedTeamIds\[0\]/);

// Privilege escalation and cross-scope provisioning are denied.
assert.match(source, /requestedRole === "SUPERADMIN"/);
assert.match(source, /requestedRole === "ADMIN" && callerRole !== "SUPERADMIN"/);
assert.match(source, /requestedTeamIds\.some\(\(teamId\) => !actorTeamIds\.has\(teamId\)\)/);
assert.match(source, /teamSeasonRows\.some\(\(row\) => !actorTeamIds\.has\(String\(row\.team_id\)\)\)/);

// Player identity is mandatory, relational and compatibility-safe.
assert.match(source, /requestedRole !== "JUGADOR"/);
assert.match(source, /requestedRole === "JUGADOR" && !linkedPlayerId/);
assert.match(source, /relation_type:\s*"SELF"/);
assert.match(source, /user_player_links/);
assert.doesNotMatch(source, /needs_player_link/);

// Auth creation stays behind service_role and is compensated on DB failure.
assert.match(source, /adminClient\.auth\.admin\.createUser/);
assert.match(source, /email_confirm:\s*true/);
assert.match(source, /cleanupProvisioning/);
assert.match(source, /adminClient\.auth\.admin\.deleteUser/);
assert.match(source, /status:\s*"approved"/);

console.log("ADMIN_USERS_V7_EDGE_CONTRACT_OK");
