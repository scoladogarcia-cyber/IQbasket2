-- =============================================================================
-- IQBasket v4 · Phase 4D Installed Functional Smoke · FORCED ROLLBACK
-- Date: 2026-09-03
-- Uses installed Phase 4D objects, performs no external AI call and leaves no rows.
-- =============================================================================

begin;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', up.id::text,
    'email', coalesce(up.email, ''),
    'role', 'authenticated'
  )::text,
  true
)
from public.user_profiles up
where upper(coalesce(up.global_role, up.role, 'USER')) = 'SUPERADMIN'
order by up.created_at nulls last
limit 1;

set local role authenticated;

do $smoke4d$
declare
  v_team_season_id uuid;
  v_player_id uuid;
  v_period_start date;
  v_period_end date;
  v_snapshot_id uuid;
  v_snapshot_id_again uuid;
  v_insight_id uuid;
  v_status text;
  v_reviewed_by uuid;
  v_reviewed_at timestamptz;
  v_snapshot_count integer;
  v_insight_count integer;
begin
  if auth.uid() is null or not public.iq_v3_is_global_superadmin() then
    raise exception 'PHASE4D_SMOKE_AUTH_FAILED';
  end if;

  select
    rm.team_season_id,
    rm.player_id,
    rs.valid_from,
    least(coalesce(rs.valid_until, rs.valid_from + 6), rs.valid_from + 6)
  into
    v_team_season_id,
    v_player_id,
    v_period_start,
    v_period_end
  from public.roster_memberships rm
  join public.roster_membership_stints rs
    on rs.roster_membership_id = rm.id
  where rs.valid_from is not null
  order by rs.valid_from desc, rm.id
  limit 1;

  if v_team_season_id is null
     or v_player_id is null
     or v_period_start is null
     or v_period_end is null then
    raise exception 'PHASE4D_SMOKE_NO_ELIGIBLE_PLAYER';
  end if;

  if not public.iq_v4_can_view_longitudinal_analytics(v_team_season_id)
     or not public.iq_v4_can_generate_longitudinal_analytics(v_team_season_id)
     or not public.iq_v4_can_view_ai_insights(v_team_season_id)
     or not public.iq_v4_can_generate_ai_insights(v_team_season_id)
     or not public.iq_v4_can_review_ai_insights(v_team_season_id) then
    raise exception 'PHASE4D_SMOKE_SUPERADMIN_CAPABILITY_FAILED';
  end if;

  begin
    perform public.iq_v4_has_player360_action_role(
      v_team_season_id,
      array['ADMIN'],
      array['ADMIN'],
      array['ADMIN']
    );
    raise exception 'ASSERT_GENERIC_ACTION_HELPER_EXPOSED';
  exception
    when insufficient_privilege then
      null;
  end;

  v_snapshot_id := public.iq_v4_save_longitudinal_snapshot(
    v_team_season_id,
    v_player_id,
    v_period_start,
    v_period_end,
    'PLAYER360_LONGITUDINAL_V1',
    'phase4d-smoke-v1',
    'synthetic-smoke',
    'ZZ_PHASE4D_SMOKE_FINGERPRINT',
    jsonb_build_object(
      'contract_version','PLAYER360_LONGITUDINAL_V1',
      'calculation_version','phase4d-smoke-v1',
      'player_id',v_player_id,
      'team_season_id',v_team_season_id,
      'period',jsonb_build_object('from',v_period_start,'to',v_period_end),
      'series',jsonb_build_array(),
      'associations',jsonb_build_array(),
      'limitations',jsonb_build_array('SYNTHETIC_SMOKE_ONLY')
    ),
    jsonb_build_object(
      'evidence_version','PLAYER360_EVIDENCE_V1',
      'calculation_version','phase4d-smoke-v1',
      'facts',jsonb_build_array(),
      'missing_data',jsonb_build_array(),
      'limitations',jsonb_build_array('SYNTHETIC_SMOKE_ONLY')
    ),
    0
  );

  if v_snapshot_id is null then
    raise exception 'ASSERT_SNAPSHOT_NOT_CREATED';
  end if;

  v_snapshot_id_again := public.iq_v4_save_longitudinal_snapshot(
    v_team_season_id,
    v_player_id,
    v_period_start,
    v_period_end,
    'PLAYER360_LONGITUDINAL_V1',
    'phase4d-smoke-v1',
    'synthetic-smoke',
    'ZZ_PHASE4D_SMOKE_FINGERPRINT',
    jsonb_build_object(
      'contract_version','PLAYER360_LONGITUDINAL_V1',
      'calculation_version','phase4d-smoke-v1'
    ),
    jsonb_build_object(
      'evidence_version','PLAYER360_EVIDENCE_V1',
      'calculation_version','phase4d-smoke-v1'
    ),
    0
  );

  if v_snapshot_id_again is distinct from v_snapshot_id then
    raise exception 'ASSERT_SNAPSHOT_IDEMPOTENCY_FAILED';
  end if;

  select count(*) into v_snapshot_count
  from public.player_longitudinal_snapshots
  where id = v_snapshot_id;

  if v_snapshot_count <> 1 then
    raise exception 'ASSERT_SNAPSHOT_COUNT_FAILED:%', v_snapshot_count;
  end if;

  v_insight_id := public.iq_v4_save_ai_insight(
    v_snapshot_id,
    'STAFF',
    'es',
    'SMOKE',
    'NO_EXTERNAL_MODEL',
    'phase4d-smoke-prompt-v1',
    jsonb_build_object(
      'summary','Synthetic smoke only',
      'evidence_snapshot_id',v_snapshot_id,
      'causal_claim_allowed',false
    )
  );

  if v_insight_id is null then
    raise exception 'ASSERT_AI_INSIGHT_NOT_CREATED';
  end if;

  select count(*) into v_insight_count
  from public.player_ai_insights
  where id = v_insight_id
    and status = 'DRAFT';

  if v_insight_count <> 1 then
    raise exception 'ASSERT_AI_INSIGHT_DRAFT_FAILED:%', v_insight_count;
  end if;

  if not public.iq_v4_review_ai_insight(
    v_insight_id,
    'APPROVED',
    'Synthetic approval for rollback smoke.'
  ) then
    raise exception 'ASSERT_AI_INSIGHT_REVIEW_RPC_FAILED';
  end if;

  select status, reviewed_by, reviewed_at
    into v_status, v_reviewed_by, v_reviewed_at
  from public.player_ai_insights
  where id = v_insight_id;

  if v_status <> 'APPROVED'
     or v_reviewed_by is distinct from auth.uid()
     or v_reviewed_at is null then
    raise exception 'ASSERT_AI_INSIGHT_REVIEW_STATE_FAILED';
  end if;

  begin
    insert into public.player_longitudinal_snapshots (
      team_season_id,
      player_id,
      period_start,
      period_end,
      contract_version,
      calculation_version,
      source_fingerprint,
      snapshot,
      evidence_bundle
    ) values (
      v_team_season_id,
      v_player_id,
      v_period_start,
      v_period_end,
      'PLAYER360_LONGITUDINAL_V1',
      'direct-write-test',
      'ZZ_DIRECT_WRITE_SHOULD_FAIL',
      '{}'::jsonb,
      '{}'::jsonb
    );
    raise exception 'ASSERT_DIRECT_SNAPSHOT_WRITE_NOT_BLOCKED';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    update public.player_ai_insights
    set status = 'REJECTED'
    where id = v_insight_id;
    raise exception 'ASSERT_DIRECT_AI_UPDATE_NOT_BLOCKED';
  exception
    when insufficient_privilege then
      null;
  end;

  raise notice
    'PLAYER360_PHASE4D_SMOKE_OK team_season=% player=% snapshot=% insight=%',
    v_team_season_id,
    v_player_id,
    v_snapshot_id,
    v_insight_id;
end
$smoke4d$;

reset role;
rollback;
