import fs from 'node:fs';
import assert from 'node:assert/strict';

const corePath = 'supabase/ready/20260904_apply_demo_universe_v1_core.sql';
const rollbackPath = 'supabase/ready/20260904_rollback_demo_universe_v1.sql';
const verifyPath = 'supabase/ready/20260904_verify_demo_universe_v1_readonly.sql';
const testPath = 'tests/demo-universe-v1-sql-structure.mjs';

const mustReplace = (source, before, after, label) => {
  assert.ok(source.includes(before), `missing expected block: ${label}`);
  return source.replace(before, after);
};

let core = fs.readFileSync(corePath, 'utf8');
core = mustReplace(
  core,
  `  'd0000000-0000-4000-8000-000000000005'::uuid,\n  case when g.idx <= 10 then 'LOCKED' else 'OPEN' end,\n  case when g.idx <= 10 then now() - interval '1 day' else null end,\n  case when g.idx <= 10 then (\n    select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1\n  ) else null end,\n  case when g.idx <= 10 then 'Partido demo revisado y validado' else null end`,
  `  'd0000000-0000-4000-8000-000000000005'::uuid,\n  'OPEN',\n  null,\n  null,\n  null`,
  'games must start OPEN'
);

const lockBlock = `\n-- -----------------------------------------------------------------------------\n-- 9. Finalize historical game locks only after every child resource is seeded\n-- -----------------------------------------------------------------------------\n-- The V5 lock guard is intentionally respected. We provide a transaction-local\n-- authenticated SUPERADMIN context so the normal lifecycle trigger performs the\n-- state transition and writes the immutable lock history. No trigger is disabled.\ndo $demo_lock_context$\ndeclare\n  v_admin_id uuid;\n  v_claims text;\nbegin\n  select id into v_admin_id\n  from public.user_profiles\n  where lower(email)='scolado@nechigroup.com'\n  limit 1;\n\n  if v_admin_id is null then\n    raise exception 'DEMO_V1_SUPERADMIN_PROFILE_MISSING';\n  end if;\n\n  v_claims := jsonb_build_object(\n    'sub', v_admin_id::text,\n    'email', 'scolado@nechigroup.com',\n    'role', 'authenticated'\n  )::text;\n\n  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);\n  perform set_config('request.jwt.claim.email', 'scolado@nechigroup.com', true);\n  perform set_config('request.jwt.claim', v_claims, true);\n  perform set_config('request.jwt.claims', v_claims, true);\nend\n$demo_lock_context$;\n\nwith ranked_games as (\n  select id, row_number() over(order by date,id)::int as rn\n  from public.games\n  where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid\n)\nupdate public.games g\nset edit_state='LOCKED',\n    lock_reason='Partido demo revisado y validado'\nfrom ranked_games r\nwhere g.id=r.id\n  and r.rn <= 10;\n\nselect set_config('request.jwt.claim.sub','',true);\nselect set_config('request.jwt.claim.email','',true);\nselect set_config('request.jwt.claim','',true);\nselect set_config('request.jwt.claims','',true);\n`;
core = mustReplace(core, '\ncommit;\n', `${lockBlock}\ncommit;\n`, 'final lock lifecycle insertion');
fs.writeFileSync(corePath, core);

let rollback = fs.readFileSync(rollbackPath, 'utf8');
const reopenBlock = `\n-- Reopen only demo games through the normal V5 lifecycle before deleting child\n-- rows. This keeps the immutable lock guard active even during emergency rollback.\ndo $demo_reopen_context$\ndeclare\n  v_admin_id uuid;\n  v_claims text;\nbegin\n  if exists (\n    select 1 from public.games\n    where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid\n      and upper(coalesce(edit_state,'OPEN'))='LOCKED'\n  ) then\n    select id into v_admin_id\n    from public.user_profiles\n    where lower(email)='scolado@nechigroup.com'\n    limit 1;\n\n    if v_admin_id is null then\n      raise exception 'DEMO_V1_ROLLBACK_SUPERADMIN_PROFILE_MISSING';\n    end if;\n\n    v_claims := jsonb_build_object(\n      'sub', v_admin_id::text,\n      'email', 'scolado@nechigroup.com',\n      'role', 'authenticated'\n    )::text;\n\n    perform set_config('request.jwt.claim.sub', v_admin_id::text, true);\n    perform set_config('request.jwt.claim.email', 'scolado@nechigroup.com', true);\n    perform set_config('request.jwt.claim', v_claims, true);\n    perform set_config('request.jwt.claims', v_claims, true);\n\n    update public.games\n    set edit_state='OPEN',\n        lock_reason='Demo Universe V1 rollback'\n    where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid\n      and upper(coalesce(edit_state,'OPEN'))='LOCKED';\n\n    perform set_config('request.jwt.claim.sub','',true);\n    perform set_config('request.jwt.claim.email','',true);\n    perform set_config('request.jwt.claim','',true);\n    perform set_config('request.jwt.claims','',true);\n  end if;\nend\n$demo_reopen_context$;\n`;
rollback = mustReplace(rollback, '\\set ON_ERROR_STOP on\nbegin;\n', `\\set ON_ERROR_STOP on\nbegin;\n${reopenBlock}`, 'rollback reopen lifecycle');
fs.writeFileSync(rollbackPath, rollback);

let verify = fs.readFileSync(verifyPath, 'utf8');
const verifyLockBlock = `\n  if (select count(*) from public.games where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid and upper(coalesce(edit_state,'OPEN'))='LOCKED') <> 10\n     or (select count(*) from public.games where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid and upper(coalesce(edit_state,'OPEN'))='OPEN') <> 2\n     or (select count(*) from public.game_lock_history h join public.games g on g.id=h.game_id where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid and upper(h.action)='LOCKED') <> 10 then\n    raise exception 'DEMO_V1_VERIFY_LOCK_STATE_FAILED';\n  end if;\n`;
verify = mustReplace(
  verify,
  `  if (select count(*) from public.game_events e join public.games g on g.id=e.game_id where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) < 100\n     or (select count(*) from public.play_by_play_events e join public.games g on g.id=e.game_id where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) < 100 then\n    raise exception 'DEMO_V1_VERIFY_PBP_TOO_SMALL';\n  end if;\n`,
  `  if (select count(*) from public.game_events e join public.games g on g.id=e.game_id where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) < 100\n     or (select count(*) from public.play_by_play_events e join public.games g on g.id=e.game_id where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) < 100 then\n    raise exception 'DEMO_V1_VERIFY_PBP_TOO_SMALL';\n  end if;\n${verifyLockBlock}`,
  'verify lock state'
);
fs.writeFileSync(verifyPath, verify);

let test = fs.readFileSync(testPath, 'utf8');
const testInsert = `assert.match(core,/IQB-DEMO-2026-27-V1/);\nassert.match(core,/\\'OPEN\\',\\s*null,\\s*null,\\s*null/i);\nassert.match(core,/DEMO_V1_SUPERADMIN_PROFILE_MISSING/);\nassert.match(core,/set edit_state='LOCKED'/i);\nassert.match(core,/request\\.jwt\\.claims/i);`;
test = mustReplace(test, `assert.match(core,/IQB-DEMO-2026-27-V1/);`, testInsert, 'static core lock assertions');
test = mustReplace(
  test,
  `assert.match(verify,/DEMO_V1_VERIFY_BOXSCORE_SCORE_MISMATCH/);`,
  `assert.match(verify,/DEMO_V1_VERIFY_BOXSCORE_SCORE_MISMATCH/);\nassert.match(verify,/DEMO_V1_VERIFY_LOCK_STATE_FAILED/);\nassert.match(rollback,/set edit_state='OPEN'/i);\nassert.match(rollback,/DEMO_V1_ROLLBACK_SUPERADMIN_PROFILE_MISSING/);`,
  'static verify rollback assertions'
);
fs.writeFileSync(testPath, test);

console.log('Demo Universe V1 lock ordering patch applied.');
