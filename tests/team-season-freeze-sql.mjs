import assert from "node:assert/strict";
import fs from "node:fs";

const apply = fs.readFileSync(
  new URL("../supabase/ready/20260903_apply_v6_team_season_freeze.sql", import.meta.url),
  "utf8"
);
const verify = fs.readFileSync(
  new URL("../supabase/ready/20260903_verify_v6_team_season_freeze_readonly.sql", import.meta.url),
  "utf8"
);
const rollback = fs.readFileSync(
  new URL("../supabase/ready/20260903_rollback_v6_team_season_freeze.sql", import.meta.url),
  "utf8"
);

assert.doesNotMatch(apply, /as \$\s*\n/i, "No debe existir un delimitador SQL '$' incompleto.");
assert.match(apply, /as \$v6_request\$[\s\S]*\$v6_request\$;/i);

assert.match(apply, /data_status='FROZEN'/i);
assert.match(apply, /team_seasons_data_status_v6_check/i);
assert.match(apply, /freeze_token/i);
assert.match(apply, /TEAM_SEASON_FREEZE:/i);
assert.match(apply, /coalesce\(lock_reason,''\) like 'TEAM_SEASON_FREEZE:' \|\| v_token::text/i);

assert.match(
  apply,
  /iq_v6_can_manage_team_season_freeze[\s\S]*in \('SUPERADMIN','ADMIN'\)/i,
  "Cierre/reapertura debe quedar limitado a Superadmin/Admin."
);
assert.match(
  apply,
  /iq_v6_can_request_team_season_freeze[\s\S]*team_season_memberships[\s\S]*'ENTRENADOR','ANALISTA'/i,
  "Entrenador/Analista deben requerir membresía contextual real para solicitar."
);

assert.match(apply, /trg_iq_v6_guard_frozen_team_season_game/i);
assert.match(apply, /trg_iq_v6_guard_frozen_roster_membership/i);
assert.match(apply, /trg_iq_v6_guard_frozen_roster_stint/i);
assert.match(
  apply,
  /iq_v3_can_manage_roster[\s\S]*data_status[\s\S]*'ACTIVE'/i,
  "El helper de plantilla debe negar escritura mientras la temporada está congelada."
);

assert.match(apply, /iq_v6_request_team_season_freeze/i);
assert.match(apply, /iq_v6_set_team_season_data_state/i);
assert.match(apply, /iq_v6_resolve_team_season_freeze_request/i);
assert.match(apply, /team_season_freeze_history/i);
assert.match(apply, /team_season_freeze_requests/i);

assert.match(verify, /TEAM_SEASON_FREEZE_VERIFY/i);
assert.match(verify, /roster_helper_frozen_guard_ok/i);
assert.match(verify, /game_trigger_ok/i);
assert.match(verify, /all_ok/i);

assert.match(
  rollback,
  /REOPEN_FROZEN_TEAM_SEASONS_BEFORE_V6_ROLLBACK/i,
  "Rollback no debe dejar scopes congelados sin sus guardas."
);
assert.doesNotMatch(
  rollback,
  /drop table/i,
  "Rollback V6 debe conservar tablas de auditoría."
);

console.log("TEAM_SEASON_FREEZE_SQL_OK");
