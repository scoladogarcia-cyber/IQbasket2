import fs from "node:fs";
import assert from "node:assert/strict";
import { AuthorizationContextService } from "../services/security/AuthorizationContextService.js";
import { FamilyWorkspaceService } from "../services/family/FamilyWorkspaceService.js";
import { PermissionService } from "../security/PermissionService.js";
import { buildFamilySupportGuide } from "../domain/family/FamilySupportGuide.js";

const migration = fs.readFileSync(
  "supabase/migrations/20260906073715_family_scoped_player_support_v1.sql",
  "utf8"
);
const authContextSource = fs.readFileSync("services/security/AuthorizationContextService.js", "utf8");
const familyViewSource = fs.readFileSync("views/family/FamilyWorkspaceView.js", "utf8");
const layoutSource = fs.readFileSync("views/LayoutView.js", "utf8");
const routerSource = fs.readFileSync("index.js", "utf8");

assert.match(migration, /iq_v17_family_authorization_scope/);
assert.match(migration, /player360_subject_relationships/);
assert.match(migration, /relationship_type='GUARDIAN'/);
assert.match(migration, /\('ACTIVE','ACTIVO'\)/);
assert.match(migration, /security definer[\s\S]*set search_path=''/i);
assert.match(migration, /revoke all on function[\s\S]*from public,anon,authenticated/i);
assert.doesNotMatch(migration, /\bcreate table\b|\binsert into\b|\bupdate public\b|\bdelete from\b/i);
assert.doesNotMatch(migration, /user_player_links/i);
assert.match(authContextSource, /iq_v17_family_authorization_scope/);
assert.match(familyViewSource, /Mis jugadores/);
assert.match(familyViewSource, /Cómo puedo ayudar/);
assert.match(layoutSource, /Mis jugadores/);
assert.match(routerSource, /getAuthenticatedRole\(\) === UserRole\.FAMILIA_TUTOR[\s\S]*familyworkspace/);
function thenable(data = []) {
  const chain = {
    select() { return chain; },
    eq() { return chain; },
    in() { return chain; },
    then(resolve, reject) {
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    }
  };
  return chain;
}

const PLAYER_1 = "11111111-1111-4111-8111-111111111111";
const PLAYER_2 = "22222222-2222-4222-8222-222222222222";
const PLAYER_3 = "33333333-3333-4333-8333-333333333333";
const TEAM_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const TEAM_2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const TS_1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const TS_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const SEASON = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const scope = {
  linked_player_ids: [PLAYER_1, PLAYER_2],
  allowed_team_ids: [TEAM_1, TEAM_2],
  allowed_team_season_ids: [TS_1, TS_2],
  allowed_global_season_ids: [SEASON],
  relationships: []
};
const authClient = {
  from() { return thenable([]); },
  async rpc(name) {
    assert.equal(name, "iq_v17_family_authorization_scope");
    return { data: scope, error: null };
  }
};
const enriched = await new AuthorizationContextService(authClient).enrichProfile({
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  role: "FAMILIA_TUTOR",
  account_status: "ACTIVE"
});
assert.deepEqual(new Set(enriched.linkedPlayerIds), new Set([PLAYER_1, PLAYER_2]));
assert.deepEqual(new Set(enriched.allowedTeamIds), new Set([TEAM_1, TEAM_2]));
assert.deepEqual(new Set(enriched.allowedTeamSeasonIds), new Set([TS_1, TS_2]));
assert.equal(enriched.authorizationModel, "V17_FAMILY_SCOPED");

const permissionService = new PermissionService({
  ...enriched,
  email: "family@example.com",
  account_status: "ACTIVE"
});
assert.equal(permissionService.canAccessPlayer(PLAYER_1), true);
assert.equal(permissionService.canAccessPlayer(PLAYER_2), true);
assert.equal(permissionService.canAccessPlayer(PLAYER_3), false);
assert.equal(permissionService.canAccessTeam(TEAM_1), true);
assert.equal(permissionService.canAccessTeamSeason(TS_2), true);
const familyClient = {
  async rpc(name) {
    assert.equal(name, "iq_v8_family_list_players");
    return {
      data: [{
        relationship_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        player: { id: PLAYER_1, first_name: "Alex", last_name: "Demo", primary_position: "BASE" },
        latest_context: { team_id: TEAM_1, team_season_id: TS_1, team_name: "U16 A", season_name: "2026/2027" }
      }],
      error: null
    };
  }
};
const normalized = await new FamilyWorkspaceService(familyClient).listPlayers();
assert.equal(normalized[0].player_id, PLAYER_1);
assert.equal(normalized[0].first_name, "Alex");
assert.equal(normalized[0].team_name, "U16 A");
assert.equal(normalized[0].team_season_id, TS_1);

const guide = buildFamilySupportGuide({
  story: { enoughEvidence: true, next: ["Mantener foco"] },
  developmentCycle: {
    current_cycle: {
      objective_title: "Lectura de ventaja",
      actions: [{ title: "Detectar la segunda ayuda", status: "IN_PROGRESS", success_criterion: "Reconoce la ayuda antes de decidir" }]
    }
  }
});
assert.match(guide.focus, /segunda ayuda/i);
assert.ok(guide.supportActions.length >= 3);
assert.ok(guide.avoid.length >= 3);
assert.doesNotMatch(JSON.stringify(guide), /diagnos|lesi[oó]n|causad/i);
assert.match(guide.conversationStarter, /Lectura de ventaja/);

console.log("FAMILY_SCOPED_PLAYER_SUPPORT_V1_CONTRACT_OK");