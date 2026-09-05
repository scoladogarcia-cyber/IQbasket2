import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const view = await readFile(
  new URL("../views/TranslationsView.js", import.meta.url),
  "utf8"
);

// New-user provisioning must collect player identity explicitly.
assert.match(view, /id="new-user-player-group"/);
assert.match(view, /id="new-user-player"/);
assert.match(view, /role === UserRole\.JUGADOR && !linkedPlayerId/);
assert.match(view, /teamSeasonIds/);
assert.match(view, /provisioningTeamSeasonId/);
assert.match(view, /supabase\.functions\.invoke\("admin-users"/);

const createUserBlock = view.slice(
  view.indexOf('const formCreateUser = container.querySelector("#form-create-user-profile")'),
  view.indexOf('// Mantén visible el vínculo deportivo')
);
assert.ok(createUserBlock.length > 0);
assert.doesNotMatch(createUserBlock, /\bclubId\s*:/);
assert.doesNotMatch(createUserBlock, /allowed_team_ids/);

// Existing-user role changes must also require and persist the player link.
assert.match(view, /class="user-player-link-group"/);
assert.match(view, /class="select-user-player-link"/);
assert.match(view, /iq_v7_assign_user_role_context/);
assert.match(view, /p_linked_player_id:\s*linkedPlayerId/);
assert.match(view, /debes seleccionar qué jugador representa esta cuenta/);
assert.match(view, /userObj\.linked_player_id = data\?\.linked_player_id \|\| null/);

console.log("ADMIN_USER_PROVISIONING_UI_CONTRACT_OK");
