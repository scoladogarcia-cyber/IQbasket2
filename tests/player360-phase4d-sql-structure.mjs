import assert from "node:assert/strict";
import fs from "node:fs";

const rehearsal = fs.readFileSync(
  new URL("../supabase/drafts/20260903_design_v4_phase4d_longitudinal_ai_rollback.sql", import.meta.url),
  "utf8"
);
const preflight = fs.readFileSync(
  new URL("../supabase/ready/20260903_preflight_v4_phase4d_longitudinal_ai_readonly.sql", import.meta.url),
  "utf8"
);

for (const table of ["player_longitudinal_snapshots", "player_ai_insights"]) {
  assert.match(rehearsal, new RegExp(`create table public\\.${table}\\s*\\(`, "i"));
  assert.match(rehearsal, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
}

for (const helper of [
  "iq_v4_can_view_longitudinal_analytics",
  "iq_v4_can_generate_longitudinal_analytics",
  "iq_v4_can_view_ai_insights",
  "iq_v4_can_generate_ai_insights",
  "iq_v4_can_review_ai_insights"
]) {
  assert.match(
    rehearsal,
    new RegExp(`create or replace function public\\.${helper}\\s*\\(`, "i"),
    `Debe existir el límite backend independiente ${helper}`
  );
}

assert.match(rehearsal, /PLAYER360_LONGITUDINAL_V1/);
assert.match(rehearsal, /PLAYER360_EVIDENCE_V1/);
assert.match(rehearsal, /causal/i, "El diseño debe documentar la separación causal");
assert.match(rehearsal, /revoke insert, update, delete[\s\S]*from authenticated/i);
assert.match(rehearsal, /iq_v4_save_longitudinal_snapshot/i);
assert.match(rehearsal, /iq_v4_save_ai_insight/i);
assert.match(rehearsal, /iq_v4_review_ai_insight/i);
assert.match(rehearsal, /source_fingerprint text not null/i);
assert.match(rehearsal, /provider text not null/i);
assert.match(rehearsal, /model_name text not null/i);
assert.match(rehearsal, /prompt_version text not null/i);
assert.match(rehearsal, /status text not null default 'DRAFT'/i);

assert.match(
  rehearsal,
  /iq_v4_longitudinal_snapshots_select[\s\S]*iq_v4_can_view_longitudinal_analytics\(team_season_id\)/i
);
assert.match(
  rehearsal,
  /iq_v4_ai_insights_select[\s\S]*iq_v4_can_view_ai_insights\(team_season_id\)/i
);
assert.match(
  rehearsal,
  /iq_v4_save_longitudinal_snapshot[\s\S]*iq_v4_can_generate_longitudinal_analytics\(p_team_season_id\)/i
);
assert.match(
  rehearsal,
  /iq_v4_save_ai_insight[\s\S]*iq_v4_can_generate_ai_insights\(v_snapshot\.team_season_id\)/i
);
assert.match(
  rehearsal,
  /iq_v4_review_ai_insight[\s\S]*iq_v4_can_review_ai_insights\(v_insight\.team_season_id\)/i
);

assert.doesNotMatch(
  rehearsal,
  /iq_v4_save_longitudinal_snapshot[\s\S]*iq_v4_can_view_player360_team_season\(p_team_season_id\)/i,
  "Generar analítica no puede depender de un permiso genérico de lectura."
);
assert.doesNotMatch(
  rehearsal,
  /iq_v4_review_ai_insight[\s\S]*iq_v4_can_manage_evaluation\(v_insight\.team_season_id\)/i,
  "Revisar IA no puede reutilizar permisos del módulo de evaluaciones."
);

assert.match(rehearsal, /rollback;\s*[\s\S]*snapshots_rolled_back/i);
assert.doesNotMatch(rehearsal, /\bcommit\s*;/i);

assert.match(preflight, /PRE-FLIGHT READ ONLY/i);
assert.match(preflight, /snapshots_absent/i);
assert.match(preflight, /insights_absent/i);
assert.match(preflight, /view_longitudinal_absent/i);
assert.match(preflight, /generate_longitudinal_absent/i);
assert.match(preflight, /view_ai_absent/i);
assert.match(preflight, /generate_ai_absent/i);
assert.match(preflight, /review_ai_absent/i);
assert.doesNotMatch(
  preflight,
  /\b(create|alter|drop|insert|update|delete|truncate)\s+(table|function|policy|trigger|into|public\.)/i
);

console.log("PLAYER360_PHASE4D_SQL_STRUCTURE_OK");
