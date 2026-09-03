-- =============================================================================
-- IQBasket v3 · RELEASE CANDIDATE FINAL VERIFICATION · READ ONLY
-- Date: 2026-09-03
--
-- Certifies Phase 3C + 3D + 3E + 3F without persistent writes.
-- =============================================================================

begin read only;

do $$
declare
  v_superadmin_id uuid;
  v_superadmin_email text;
  v_target_ts uuid;
begin
  select up.id, up.email
    into v_superadmin_id, v_superadmin_email
  from public.user_profiles up
  where upper(coalesce(up.global_role, up.role, 'USER')) = 'SUPERADMIN'
  order by up.created_at nulls last
  limit 1;

  if v_superadmin_id is null then
    raise exception 'RC_SUPERADMIN_REQUIRED';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_superadmin_id::text,
      'email', coalesce(v_superadmin_email, ''),
      'role', 'authenticated'
    )::text,
    true
  );

  select target.id
    into v_target_ts
  from public.team_seasons target
  where exists (
    select 1
    from public.team_seasons src
    join public.roster_memberships rm
      on rm.team_season_id = src.id
    join public.roster_membership_stints rs
      on rs.roster_membership_id = rm.id
     and rs.valid_until is null
    where src.season_id = target.season_id
      and src.id <> target.id
  )
  order by target.created_at desc
  limit 1;

  if v_target_ts is null then
    raise exception 'RC_MARKET_TARGET_REQUIRED';
  end if;

  perform set_config('iq.rc.target_team_season_id', v_target_ts::text, true);
end $$;

set local role authenticated;

with integrity as (
  select
    (
      select count(*)
      from public.player_game_stats pgs
      join public.games g on g.id = pgs.game_id
      where g.team_season_id is not null
        and not public.iq_v3_player_eligible_on_date(
          pgs.player_id,
          g.team_season_id,
          g.date::date
        )
    ) as invalid_stats,
    (
      select count(*)
      from public.game_events ge
      join public.games g on g.id = ge.game_id
      where ge.player_id is not null
        and g.team_season_id is not null
        and not public.iq_v3_player_eligible_on_date(
          ge.player_id,
          g.team_season_id,
          g.date::date
        )
    ) as invalid_events
),
synthetic as (
  select count(*) as synthetic_players
  from public.players p
  where p.last_name = 'TEMP_PLAYER'
    and p.first_name in (
      'ZZ_SMOKE_TEMPORAL',
      'ZZ_SMOKE_SEED',
      'ZZ_SMOKE_3D'
    )
),
market as (
  select count(*) as market_candidates
  from public.iq_v3_list_transfer_market(
    current_setting('iq.rc.target_team_season_id')::uuid
  )
),
defs as (
  select
    pg_get_functiondef(
      to_regprocedure('public.iq_v3_can_manage_team_season(uuid)')
    ) as general_manage_def,
    pg_get_functiondef(
      to_regprocedure('public.iq_v3_can_request_transfer(uuid)')
    ) as transfer_request_def
)
select
  'IQBASKET_V3_RELEASE_CANDIDATE' as section,

  -- Phase 3C
  to_regclass('public.roster_membership_stints') is not null as phase3c_stints_ok,
  to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null
    as phase3c_eligibility_ok,
  to_regprocedure('public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)') is not null
    as phase3c_create_ok,
  to_regprocedure('public.iq_v3_remove_roster_member(uuid,uuid,date)') is not null
    as phase3c_remove_ok,

  -- Phase 3D
  to_regclass('public.roster_transfer_requests') is not null as phase3d_table_ok,
  (
    select c.relrowsecurity
    from pg_class c
    where c.oid = 'public.roster_transfer_requests'::regclass
  ) as phase3d_rls_ok,
  to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is not null
    as phase3d_request_ok,
  to_regprocedure('public.iq_v3_approve_transfer_request(uuid,date,date)') is not null
    as phase3d_approve_ok,
  to_regprocedure('public.iq_v3_reject_transfer_request(uuid,text)') is not null
    as phase3d_reject_ok,

  -- Phase 3E
  to_regprocedure('public.iq_v3_list_transfer_market(uuid)') is not null
    as phase3e_market_ok,
  m.market_candidates,

  -- Phase 3F
  to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is not null
    as phase3f_roster_helper_ok,
  position('ENTRENADOR' in d.general_manage_def) = 0
    and position('AYUDANTE' in d.general_manage_def) = 0
    as general_admin_not_broadened,
  position('iq_v3_can_manage_roster(p_to_team_season_id)' in d.transfer_request_def) > 0
    as transfer_request_uses_roster_helper,
  public.iq_v3_can_manage_roster(
    current_setting('iq.rc.target_team_season_id')::uuid
  ) as superadmin_roster_ok,
  public.iq_v3_can_request_transfer(
    current_setting('iq.rc.target_team_season_id')::uuid
  ) as superadmin_request_ok,
  public.iq_v3_can_approve_transfer_request() as superadmin_approve_ok,

  -- Counts / integrity
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  (select count(*) from public.roster_transfer_requests) as transfer_requests,
  s.synthetic_players,
  i.invalid_stats,
  i.invalid_events,

  (
    to_regclass('public.roster_membership_stints') is not null
    and to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null
    and to_regprocedure('public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)') is not null
    and to_regprocedure('public.iq_v3_remove_roster_member(uuid,uuid,date)') is not null
    and to_regclass('public.roster_transfer_requests') is not null
    and (
      select c.relrowsecurity
      from pg_class c
      where c.oid = 'public.roster_transfer_requests'::regclass
    )
    and to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is not null
    and to_regprocedure('public.iq_v3_approve_transfer_request(uuid,date,date)') is not null
    and to_regprocedure('public.iq_v3_reject_transfer_request(uuid,text)') is not null
    and to_regprocedure('public.iq_v3_list_transfer_market(uuid)') is not null
    and m.market_candidates > 0
    and to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is not null
    and position('ENTRENADOR' in d.general_manage_def) = 0
    and position('AYUDANTE' in d.general_manage_def) = 0
    and position('iq_v3_can_manage_roster(p_to_team_season_id)' in d.transfer_request_def) > 0
    and public.iq_v3_can_manage_roster(
      current_setting('iq.rc.target_team_season_id')::uuid
    )
    and public.iq_v3_can_request_transfer(
      current_setting('iq.rc.target_team_season_id')::uuid
    )
    and public.iq_v3_can_approve_transfer_request()
    and s.synthetic_players = 0
    and i.invalid_stats = 0
    and i.invalid_events = 0
  ) as release_candidate_ok
from integrity i
cross join synthetic s
cross join market m
cross join defs d;

reset role;
rollback;
