import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const baseMigration = read("supabase/migrations/20260907072000_family_links_capture_comparison_v1.sql");
const isolationMigration = read("supabase/migrations/20260907072500_quick_capture_capability_isolation_v1.sql");
const permissions = read("security/permissions.js");
const lazyRegistry = read("services/LazyViewRegistry.js");
const quickView = read("views/games/DelegatedQuickEntryView.js");
const familyStaff = read("views/family/FamilyStaffV30View.js");
const familyWorkspace = read("views/family/FamilyWorkspaceV30View.js");
const delegationPanel = read("components/games/GameCaptureDelegationPanel.js");

// Relationship lifetime belongs to user <-> player, never to a team membership.
for (const duration of ["INDEFINITE", "7_DAYS", "30_DAYS", "12_MONTHS"]) {
  assert.match(baseMigration, new RegExp(duration), `Missing Family duration ${duration}`);
}
assert.match(baseMigration, /player360_subject_relationships/);
assert.match(baseMigration, /join public\.roster_memberships rm on rm\.player_id=r\.player_id/);
assert.match(baseMigration, /iq_v30_revoke_family_link/);

// Family team comparison must mask identity in SQL before the browser receives it.
assert.match(baseMigration, /case when a\.id=any\(v_linked\) or v_show_names then a\.first_name else null end/);
assert.match(baseMigration, /case when a\.id=any\(v_linked\) or v_show_jerseys then a\.jersey else null end/);
assert.match(baseMigration, /'primary_position',a\.primary_position/);
assert.match(familyWorkspace, /Los datos personales sensibles de otros jugadores no se incluyen/);

// Quick, live and acta are independent capabilities at RBAC/router level.
assert.match(permissions, /RECORD_QUICK_GAME: "RECORD_QUICK_GAME"/);
assert.match(permissions, /"easy-entry": Permission\.RECORD_QUICK_GAME/);
assert.match(permissions, /live: Permission\.RECORD_LIVE_GAME/);
assert.match(delegationPanel, /Marcación rápida/);
assert.match(delegationPanel, /En vivo · Play-by-play/);
assert.match(delegationPanel, /Acta \/ BoxScore/);

// Critical backend invariant: QUICK never aliases to LIVE.
assert.match(isolationMigration, /d\.capability=upper\(trim\(coalesce\(p_capability,''\)\)\)/);
assert.doesNotMatch(
  isolationMigration,
  /p_capability,''\)\)='RECORD_LIVE_GAME'[\s\S]{0,120}d\.capability='RECORD_QUICK_GAME'/,
  "RECORD_QUICK_GAME must not imply RECORD_LIVE_GAME"
);
assert.match(isolationMigration, /v_can_quick:=iq_private\.can_mutate_game/);
assert.match(isolationMigration, /iq_v21_private\.has_capability\(p_game_id,'RECORD_QUICK_GAME'\)/);
assert.match(isolationMigration, /p_periods is not null and not v_can_live/);
assert.match(isolationMigration, /p_starter_ids is not null and not \(v_can_live or v_can_boxscore\)/);

// Both capture modes share the single-writer lease without sharing permissions.
assert.match(isolationMigration, /create or replace function iq_v28_private\.can_record/);
assert.match(isolationMigration, /or iq_v21_private\.has_capability\(p_game_id,'RECORD_QUICK_GAME'\)/);
assert.match(quickView, /saveCapture\(/);
assert.doesNotMatch(quickView, /import\s+.*DataStore/);
assert.doesNotMatch(quickView, /\bDataStore\./);

// Grouped delegation snapshots must route a QUICK-only user to the scoped quick view.
assert.match(lazyRegistry, /capabilities\.includes\("RECORD_QUICK_GAME"\)/);
assert.match(lazyRegistry, /DelegatedQuickEntryView/);

// Staff UI separates invitation-code expiry from relationship duration.
assert.match(familyStaff, /Indefinidamente/);
assert.match(familyStaff, /7 días/);
assert.match(familyStaff, /30 días/);
assert.match(familyStaff, /12 meses/);
assert.match(familyStaff, /código de seguridad caduca en 7 días/i);

console.log("Family links + capture + comparison V30 contract: OK");