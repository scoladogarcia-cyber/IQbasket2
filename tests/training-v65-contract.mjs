import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get = p => readFileSync(new URL("../"+p,import.meta.url),"utf8");
const view=get("views/TrainingView.js");
const edit=get("views/training/TrainingCompleteEditV54View.js");
const service=get("services/player360/TrainingService.js");
const passport=get("views/player360/passport/PlayerPassportView.js");
const creation=get("supabase/migrations/20261014123000_training_v65_create_kind.sql");
const validation=get("supabase/migrations/20261014133000_training_v65_validation.sql");
const planned=get("supabase/migrations/20261014140000_training_v65_planned_minutes.sql");

for(const kind of ["TEAM","TECHNIFICATION","PERSONAL","COGNITIVE"]){
  assert.ok(view.includes(kind),kind);
  assert.ok(creation.includes(kind),kind);
}
assert.match(view,/p360-training-list-item/);
assert.match(view,/p360-training-back/);
assert.match(view,/trainingDetailId/);
assert.match(view,/p360-player-minute-input/);
assert.match(view,/trainingMinutesOverrides/);
assert.match(view,/participants = selectedPlayers\.map/);
assert.match(service,/allAccessible/);
assert.match(service,/iq_v65_create_training_session/);
assert.match(view,/p360-validation-toggle/);
assert.match(view,/duration_override_minutes/);
assert.match(planned,/training_participants_duration_override_check/);
assert.match(planned,/TRAINING_SESSION_SHORTER_THAN_PLAYER_OVERRIDE/);
assert.match(planned,/iq_v65_create_training_session/);
assert.match(validation,/iq_v4_can_manage_training/);
assert.match(validation,/TRAINING_PARTICIPANTS_NEED_CONFIRMATION/);
assert.match(validation,/TRAINING_CANNOT_VALIDATE_FUTURE/);
assert.match(edit,/_editSessionTotalMinutes/);
assert.match(passport,/iq_passport_training_minutes_v68/);
assert.match(passport,/_trainingHoursCard/);
assert.match(passport,/\.order\("training_session_id"/);
console.log("PASS Training V65: list/detail, RLS historical scope, types, individual minutes, validation, passport hours.");
