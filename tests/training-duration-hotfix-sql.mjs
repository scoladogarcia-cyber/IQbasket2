import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const apply = readFileSync(
  new URL("../supabase/ready/20260903_fix_v4_training_duration_attendance.sql", import.meta.url),
  "utf8"
);
const rollback = readFileSync(
  new URL("../supabase/ready/20260903_rollback_fix_v4_training_duration_attendance.sql", import.meta.url),
  "utf8"
);

assert.match(
  apply,
  /extract\(epoch from \(p_end_time - p_start_time\)\) \/ 60\.0/i,
  "Backend debe derivar duration desde start/end."
);
assert.match(apply, /TRAINING_TIME_PAIR_REQUIRED/);
assert.match(apply, /TRAINING_TIME_RANGE_INVALID/);
assert.match(apply, /TRAINING_DURATION_MISMATCH/);
assert.match(apply, /TRAINING_DURATION_INVALID/);

assert.match(
  apply,
  /v_default_attendance := case[\s\S]*p_session_date <= current_date then 'PRESENT'[\s\S]*else 'PLANNED'/i,
  "Participantes sin estado deben ser PRESENT en sesiones no futuras."
);
assert.match(
  apply,
  /v_attendance = 'PRESENT'[\s\S]*v_participated_minutes := v_duration_minutes/i,
  "Presencia histórica sin minutos debe heredar la duración de la sesión."
);

assert.match(
  apply,
  /grant execute on function public\.iq_v4_create_training_session[\s\S]*to authenticated/i
);
assert.match(
  apply,
  /revoke all on function public\.iq_v4_create_training_session[\s\S]*from public, anon/i
);

assert.match(
  rollback,
  /upper\(coalesce\(nullif\(participant_item ->> 'attendance_status', ''\), 'PLANNED'\)\)/i,
  "Rollback debe restaurar la semántica anterior de participantes."
);
assert.doesNotMatch(
  rollback,
  /TRAINING_DURATION_MISMATCH/i,
  "Rollback no debe conservar las reglas nuevas."
);

console.log("TRAINING_DURATION_HOTFIX_SQL_OK");
